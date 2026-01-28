from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Dict, Optional
from auth.dependencies import get_current_user
from datetime import datetime, timezone
from bson import ObjectId
import httpx
import os

router = APIRouter(prefix='/api/brokers', tags=['brokers'])

class BrokerLinkRequest(BaseModel):
    broker: str  # zerodha, upstox, angel_one, alpaca, ibkr, schwab
    request_token: Optional[str] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None

@router.get('/available')
async def get_available_brokers():
    """List all available broker integrations"""
    brokers = [
        {
            'id': 'zerodha',
            'name': 'Zerodha (India)',
            'country': 'IN',
            'auth_type': 'oauth',
            'configured': bool(os.getenv('ZERODHA_API_KEY'))
        },
        {
            'id': 'upstox',
            'name': 'Upstox (India)',
            'country': 'IN',
            'auth_type': 'oauth',
            'configured': bool(os.getenv('UPSTOX_CLIENT_ID'))
        },
        {
            'id': 'angel_one',
            'name': 'Angel One (India)',
            'country': 'IN',
            'auth_type': 'api_key',
            'configured': bool(os.getenv('ANGEL_ONE_API_KEY'))
        },
        {
            'id': 'alpaca',
            'name': 'Alpaca (US)',
            'country': 'US',
            'auth_type': 'oauth',
            'configured': bool(os.getenv('ALPACA_CLIENT_ID'))
        },
        {
            'id': 'ibkr',
            'name': 'Interactive Brokers',
            'country': 'GLOBAL',
            'auth_type': 'api_key',
            'configured': bool(os.getenv('IBKR_ACCOUNT_ID'))
        },
        {
            'id': 'schwab',
            'name': 'Charles Schwab (US)',
            'country': 'US',
            'auth_type': 'oauth',
            'configured': bool(os.getenv('SCHWAB_CLIENT_ID'))
        }
    ]
    
    return {'brokers': brokers}

@router.post('/link')
async def link_broker(
    request: BrokerLinkRequest,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    from auth.encryption import encryption_manager
    
    user_id = current_user.get('sub')
    
    # Store broker connection (encrypted)
    doc = {
        'user_id': user_id,
        'broker': request.broker,
        'encrypted_api_key': encryption_manager.encrypt(request.api_key) if request.api_key else None,
        'encrypted_api_secret': encryption_manager.encrypt(request.api_secret) if request.api_secret else None,
        'is_active': True,
        'last_sync': None,
        'linked_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc)
    }
    
    # Check if broker already linked
    existing = await db.broker_connections.find_one({
        'user_id': user_id,
        'broker': request.broker
    })
    
    if existing:
        await db.broker_connections.update_one(
            {'_id': existing['_id']},
            {'$set': doc}
        )
        connection_id = str(existing['_id'])
    else:
        result = await db.broker_connections.insert_one(doc)
        connection_id = str(result.inserted_id)
    
    return {
        'connection_id': connection_id,
        'message': f'{request.broker.title()} linked successfully',
        'note': 'Holdings sync will be available once broker implements API integration'
    }

@router.get('/connections')
async def get_broker_connections(current_user: dict = Depends(get_current_user)):
    from server import db
    
    user_id = current_user.get('sub')
    connections = await db.broker_connections.find({'user_id': user_id}).to_list(100)
    
    formatted = []
    for conn in connections:
        formatted.append({
            'id': str(conn['_id']),
            'broker': conn['broker'],
            'is_active': conn.get('is_active', True),
            'last_sync': conn.get('last_sync'),
            'linked_at': conn.get('linked_at'),
            'holdings_count': 0  # Placeholder for future implementation
        })
    
    return {'connections': formatted}

@router.delete('/connections/{connection_id}')
async def unlink_broker(
    connection_id: str,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    result = await db.broker_connections.delete_one({
        '_id': ObjectId(connection_id),
        'user_id': user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Connection not found')
    
    return {'message': 'Broker unlinked successfully'}

@router.post('/sync/{connection_id}')
async def sync_broker_holdings(
    connection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Placeholder for broker sync - requires actual broker API implementation"""
    from server import db
    
    user_id = current_user.get('sub')
    
    connection = await db.broker_connections.find_one({
        '_id': ObjectId(connection_id),
        'user_id': user_id
    })
    
    if not connection:
        raise HTTPException(status_code=404, detail='Connection not found')
    
    # Update last sync time
    await db.broker_connections.update_one(
        {'_id': ObjectId(connection_id)},
        {'$set': {
            'last_sync': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }}
    )
    
    return {
        'message': 'Sync initiated',
        'note': 'Full broker API integration pending. Holdings will auto-sync once APIs are configured with valid keys.',
        'broker': connection['broker'],
        'status': 'pending_api_implementation'
    }
