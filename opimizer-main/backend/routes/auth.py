from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from auth.jwt_handler import create_access_token, create_refresh_token, verify_token
from auth.password import hash_password, verify_password
from auth.dependencies import get_current_user
from twilio.rest import Client
import os
import re

router = APIRouter(prefix='/api/auth', tags=['authentication'])

# Twilio client
twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
twilio_verify_service = os.getenv('TWILIO_VERIFY_SERVICE_SID')

if twilio_account_sid and twilio_auth_token and twilio_verify_service:
    twilio_client = Client(twilio_account_sid, twilio_auth_token)
else:
    twilio_client = None

# Models
class PhoneOTPRequest(BaseModel):
    phone_number: str = Field(..., description='Phone number in E.164 format')

class VerifyOTPRequest(BaseModel):
    phone_number: str
    code: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str
    phone_number: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

# Helper functions
def validate_phone_number(phone: str) -> bool:
    pattern = r'^\+[1-9]\d{1,14}$'
    return bool(re.match(pattern, phone))

@router.post('/send-otp')
async def send_otp(request: PhoneOTPRequest, db = Depends(lambda: None)):
    if not twilio_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='SMS service not configured. Please add Twilio credentials.'
        )
    
    if not validate_phone_number(request.phone_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid phone number format. Use E.164 format (e.g., +14155552671)'
        )
    
    try:
        verification = twilio_client.verify.services(twilio_verify_service).verifications.create(
            to=request.phone_number,
            channel='sms'
        )
        return {
            'status': verification.status,
            'message': f'OTP sent to {request.phone_number}'
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Failed to send OTP: {str(e)}'
        )

@router.post('/verify-otp')
async def verify_otp(request: VerifyOTPRequest):
    if not twilio_client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='SMS service not configured'
        )
    
    try:
        check = twilio_client.verify.services(twilio_verify_service).verification_checks.create(
            to=request.phone_number,
            code=request.code
        )
        
        is_valid = check.status == 'approved'
        
        return {
            'valid': is_valid,
            'status': check.status
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Verification failed: {str(e)}'
        )

@router.post('/register')
async def register(request: RegisterRequest, db = Depends(lambda: None)):
    from server import db as database
    
    # Check if user exists
    existing_user = await database.users.find_one({'email': request.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Email already registered'
        )
    
    # Check if phone number exists
    existing_phone = await database.users.find_one({'phone_number': request.phone_number})
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Phone number already registered'
        )
    
    # Hash password
    hashed_password = hash_password(request.password)
    
    # Create user
    user_doc = {
        'email': request.email,
        'hashed_password': hashed_password,
        'full_name': request.full_name,
        'phone_number': request.phone_number,
        'phone_verified': False,
        'kyc_status': 'pending',
        'is_active': True,
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc)
    }
    
    result = await database.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Generate tokens
    access_token = create_access_token({'sub': user_id, 'email': request.email})
    refresh_token = create_refresh_token({'sub': user_id})
    
    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': 'bearer',
        'user': {
            'id': user_id,
            'email': request.email,
            'full_name': request.full_name,
            'phone_number': request.phone_number
        }
    }

@router.post('/login')
async def login(request: LoginRequest):
    from server import db as database
    
    # Find user
    user = await database.users.find_one({'email': request.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid credentials'
        )
    
    # Verify password
    if not verify_password(request.password, user['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid credentials'
        )
    
    # Check if user is active
    if not user.get('is_active', True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Account is deactivated'
        )
    
    user_id = str(user['_id'])
    
    # Generate tokens
    access_token = create_access_token({'sub': user_id, 'email': user['email']})
    refresh_token = create_refresh_token({'sub': user_id})
    
    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': 'bearer',
        'user': {
            'id': user_id,
            'email': user['email'],
            'full_name': user.get('full_name'),
            'phone_number': user.get('phone_number'),
            'kyc_status': user.get('kyc_status', 'pending')
        }
    }

@router.post('/refresh')
async def refresh_access_token(request: RefreshTokenRequest):
    payload = verify_token(request.refresh_token)
    
    if not payload or payload.get('type') != 'refresh':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid refresh token'
        )
    
    user_id = payload.get('sub')
    
    # Generate new access token
    access_token = create_access_token({'sub': user_id})
    
    return {
        'access_token': access_token,
        'token_type': 'bearer'
    }

@router.get('/me')
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    from server import db as database
    from bson import ObjectId
    
    user_id = current_user.get('sub')
    user = await database.users.find_one({'_id': ObjectId(user_id)})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User not found'
        )
    
    return {
        'id': str(user['_id']),
        'email': user['email'],
        'full_name': user.get('full_name'),
        'phone_number': user.get('phone_number'),
        'phone_verified': user.get('phone_verified', False),
        'kyc_status': user.get('kyc_status', 'pending'),
        'created_at': user.get('created_at')
    }

@router.post('/verify-phone')
async def verify_phone_number(
    request: VerifyOTPRequest,
    current_user: dict = Depends(get_current_user)
):
    from server import db as database
    from bson import ObjectId
    
    # Verify OTP first
    verification_result = await verify_otp(request)
    
    if not verification_result['valid']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid OTP'
        )
    
    # Update user's phone verification status
    user_id = current_user.get('sub')
    await database.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {
            'phone_verified': True,
            'phone_number': request.phone_number,
            'updated_at': datetime.now(timezone.utc)
        }}
    )
    
    return {
        'message': 'Phone number verified successfully',
        'phone_verified': True
    }
