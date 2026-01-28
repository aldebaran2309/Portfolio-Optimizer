from fastapi import APIRouter, HTTPException, status, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from auth.dependencies import get_current_user
from datetime import datetime, timezone
from bson import ObjectId
from services.enhanced_data_fetcher import enhanced_data_fetcher
import asyncio

router = APIRouter(prefix='/api/alerts', tags=['alerts'])

class AlertCreate(BaseModel):
    alert_type: str  # price_above, price_below, rebalance_reminder
    symbol: Optional[str] = None
    target_price: Optional[float] = None
    frequency: Optional[str] = 'once'  # once, daily, weekly
    message: Optional[str] = None

@router.post('/')
async def create_alert(
    alert: AlertCreate,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    doc = {
        'user_id': user_id,
        'alert_type': alert.alert_type,
        'symbol': alert.symbol,
        'target_price': alert.target_price,
        'frequency': alert.frequency,
        'message': alert.message,
        'is_active': True,
        'triggered_count': 0,
        'last_triggered': None,
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc)
    }
    
    result = await db.alerts.insert_one(doc)
    
    return {
        'alert_id': str(result.inserted_id),
        'message': 'Alert created successfully'
    }

@router.get('/')
async def get_alerts(current_user: dict = Depends(get_current_user)):
    from server import db
    
    user_id = current_user.get('sub')
    alerts = await db.alerts.find({'user_id': user_id}).to_list(100)
    
    formatted = []
    for alert in alerts:
        formatted.append({
            'id': str(alert['_id']),
            'alert_type': alert['alert_type'],
            'symbol': alert.get('symbol'),
            'target_price': alert.get('target_price'),
            'frequency': alert.get('frequency'),
            'message': alert.get('message'),
            'is_active': alert.get('is_active', True),
            'triggered_count': alert.get('triggered_count', 0),
            'last_triggered': alert.get('last_triggered'),
            'created_at': alert.get('created_at')
        })
    
    return {'alerts': formatted}

@router.put('/{alert_id}/toggle')
async def toggle_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    alert = await db.alerts.find_one({
        '_id': ObjectId(alert_id),
        'user_id': user_id
    })
    
    if not alert:
        raise HTTPException(status_code=404, detail='Alert not found')
    
    new_status = not alert.get('is_active', True)
    
    await db.alerts.update_one(
        {'_id': ObjectId(alert_id)},
        {'$set': {
            'is_active': new_status,
            'updated_at': datetime.now(timezone.utc)
        }}
    )
    
    return {'is_active': new_status}

@router.delete('/{alert_id}')
async def delete_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    result = await db.alerts.delete_one({
        '_id': ObjectId(alert_id),
        'user_id': user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Alert not found')
    
    return {'message': 'Alert deleted successfully'}

@router.get('/check')
async def check_alerts(current_user: dict = Depends(get_current_user)):
    """Check and return triggered alerts"""
    from server import db
    
    user_id = current_user.get('sub')
    alerts = await db.alerts.find({
        'user_id': user_id,
        'is_active': True
    }).to_list(100)
    
    triggered_alerts = []
    
    for alert in alerts:
        should_trigger = False
        
        if alert['alert_type'] in ['price_above', 'price_below'] and alert.get('symbol'):
            # Check price alerts
            price_data = await enhanced_data_fetcher.fetch_real_time_price(
                alert['symbol'],
                'stock'
            )
            
            if price_data:
                current_price = price_data['price']
                target_price = alert.get('target_price', 0)
                
                if alert['alert_type'] == 'price_above' and current_price >= target_price:
                    should_trigger = True
                elif alert['alert_type'] == 'price_below' and current_price <= target_price:
                    should_trigger = True
        
        elif alert['alert_type'] == 'rebalance_reminder':
            # Check if enough time has passed since last trigger
            last_triggered = alert.get('last_triggered')
            if not last_triggered or \
               (datetime.now(timezone.utc) - last_triggered).days >= 7:
                should_trigger = True
        
        if should_trigger:
            # Update alert
            await db.alerts.update_one(
                {'_id': alert['_id']},
                {'$set': {
                    'last_triggered': datetime.now(timezone.utc),
                    'triggered_count': alert.get('triggered_count', 0) + 1,
                    'updated_at': datetime.now(timezone.utc)
                }}
            )
            
            triggered_alerts.append({
                'id': str(alert['_id']),
                'alert_type': alert['alert_type'],
                'symbol': alert.get('symbol'),
                'message': alert.get('message') or f"Alert triggered for {alert.get('symbol', 'portfolio')}"
            })
    
    return {'triggered_alerts': triggered_alerts}
