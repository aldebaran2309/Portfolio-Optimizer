from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from pydantic import BaseModel
from auth.dependencies import get_current_user
from auth.encryption import encryption_manager
from datetime import datetime, timezone
from bson import ObjectId
from pathlib import Path
import os
import uuid

router = APIRouter(prefix='/api/kyc', tags=['kyc'])

# Create KYC documents directory
KYC_STORAGE_PATH = Path('/app/kyc_documents')
KYC_STORAGE_PATH.mkdir(exist_ok=True, parents=True)

# Models
class KYCDataRequest(BaseModel):
    document_type: str  # PAN, AADHAR, SSN, PASSPORT
    document_number: str
    country: str  # IN, US

class KYCStatusResponse(BaseModel):
    kyc_status: str
    documents: list
    verification_pending: bool

@router.post('/submit-document-data')
async def submit_kyc_data(
    request: KYCDataRequest,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Validate document type
    valid_types = ['PAN', 'AADHAR', 'SSN', 'PASSPORT']
    if request.document_type.upper() not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Invalid document type. Must be one of: {valid_types}'
        )
    
    # Encrypt sensitive data
    encrypted_number = encryption_manager.encrypt(request.document_number)
    
    # Check if document already exists
    existing_doc = await db.kyc_documents.find_one({
        'user_id': user_id,
        'document_type': request.document_type.upper()
    })
    
    if existing_doc:
        # Update existing document
        await db.kyc_documents.update_one(
            {'_id': existing_doc['_id']},
            {'$set': {
                'encrypted_number': encrypted_number,
                'country': request.country.upper(),
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        doc_id = str(existing_doc['_id'])
    else:
        # Create new document
        doc = {
            'user_id': user_id,
            'document_type': request.document_type.upper(),
            'encrypted_number': encrypted_number,
            'country': request.country.upper(),
            'verified': False,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
        result = await db.kyc_documents.insert_one(doc)
        doc_id = str(result.inserted_id)
    
    # Update user KYC status
    await db.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {
            'kyc_status': 'submitted',
            'updated_at': datetime.now(timezone.utc)
        }}
    )
    
    return {
        'document_id': doc_id,
        'message': 'KYC document submitted successfully',
        'masked_number': encryption_manager.get_masked_display(encrypted_number)
    }

@router.post('/upload-document-file')
async def upload_document_file(
    file: UploadFile = File(...),
    document_type: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Validate file type
    allowed_extensions = {'pdf', 'jpg', 'jpeg', 'png'}
    file_extension = file.filename.split('.')[-1].lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Only PDF, JPG, JPEG, and PNG files are allowed'
        )
    
    # Validate file size (max 5MB)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='File size must be less than 5MB'
        )
    
    # Create unique filename
    unique_filename = f"{user_id}_{document_type.upper()}_{uuid.uuid4()}.{file_extension}"
    filepath = KYC_STORAGE_PATH / unique_filename
    
    # Save file
    with open(filepath, 'wb') as f:
        f.write(contents)
    
    # Store metadata in database
    file_doc = {
        'user_id': user_id,
        'document_type': document_type.upper(),
        'filename': unique_filename,
        'filepath': str(filepath),
        'file_size': len(contents),
        'uploaded_at': datetime.now(timezone.utc)
    }
    
    result = await db.kyc_files.insert_one(file_doc)
    
    return {
        'file_id': str(result.inserted_id),
        'filename': unique_filename,
        'message': 'Document file uploaded successfully'
    }

@router.get('/status')
async def get_kyc_status(current_user: dict = Depends(get_current_user)):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Get user
    user = await db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User not found'
        )
    
    # Get all KYC documents
    documents = await db.kyc_documents.find({'user_id': user_id}).to_list(100)
    
    # Format documents
    formatted_docs = []
    for doc in documents:
        formatted_docs.append({
            'id': str(doc['_id']),
            'document_type': doc['document_type'],
            'country': doc.get('country'),
            'masked_number': encryption_manager.get_masked_display(doc['encrypted_number']),
            'verified': doc.get('verified', False),
            'created_at': doc.get('created_at')
        })
    
    # Check if all required documents are submitted
    doc_types = [d['document_type'] for d in documents]
    country = user.get('country', 'IN')
    
    if country == 'IN':
        required_docs = {'PAN', 'AADHAR'}
    elif country == 'US':
        required_docs = {'SSN', 'PASSPORT'}
    else:
        required_docs = set()
    
    has_all_docs = required_docs.issubset(set(doc_types))
    verification_pending = has_all_docs and not all(d.get('verified', False) for d in documents)
    
    return {
        'kyc_status': user.get('kyc_status', 'pending'),
        'documents': formatted_docs,
        'has_all_documents': has_all_docs,
        'verification_pending': verification_pending,
        'country': country
    }

@router.get('/documents')
async def get_user_documents(current_user: dict = Depends(get_current_user)):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Get all documents
    documents = await db.kyc_documents.find({'user_id': user_id}).to_list(100)
    
    formatted_docs = []
    for doc in documents:
        formatted_docs.append({
            'id': str(doc['_id']),
            'document_type': doc['document_type'],
            'country': doc.get('country'),
            'masked_number': encryption_manager.get_masked_display(doc['encrypted_number']),
            'verified': doc.get('verified', False),
            'created_at': doc.get('created_at'),
            'updated_at': doc.get('updated_at')
        })
    
    return {'documents': formatted_docs}

@router.delete('/document/{document_id}')
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Verify document belongs to user
    document = await db.kyc_documents.find_one({
        '_id': ObjectId(document_id),
        'user_id': user_id
    })
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Document not found'
        )
    
    # Delete document
    await db.kyc_documents.delete_one({'_id': ObjectId(document_id)})
    
    return {'message': 'Document deleted successfully'}
