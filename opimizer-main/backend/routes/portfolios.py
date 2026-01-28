from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List, Optional
from auth.dependencies import get_current_user
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(prefix='/api/portfolios', tags=['portfolios'])

class PortfolioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: bool = False

class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None

@router.post('/')
async def create_portfolio(
    portfolio: PortfolioCreate,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    # If this is default, unset other defaults
    if portfolio.is_default:
        await db.portfolios.update_many(
            {'user_id': user_id},
            {'$set': {'is_default': False}}
        )
    
    # Check if user has no portfolios, make first one default
    portfolio_count = await db.portfolios.count_documents({'user_id': user_id})
    is_default = portfolio.is_default or (portfolio_count == 0)
    
    doc = {
        'user_id': user_id,
        'name': portfolio.name,
        'description': portfolio.description,
        'is_default': is_default,
        'created_at': datetime.now(timezone.utc),
        'updated_at': datetime.now(timezone.utc)
    }
    
    result = await db.portfolios.insert_one(doc)
    
    return {
        'portfolio_id': str(result.inserted_id),
        'message': 'Portfolio created successfully',
        'is_default': is_default
    }

@router.get('/')
async def get_portfolios(current_user: dict = Depends(get_current_user)):
    from server import db
    
    user_id = current_user.get('sub')
    portfolios = await db.portfolios.find({'user_id': user_id}).to_list(100)
    
    formatted = []
    for p in portfolios:
        # Count holdings
        holdings_count = await db.portfolio_holdings.count_documents({
            'user_id': user_id,
            'portfolio_id': str(p['_id'])
        })
        
        formatted.append({
            'id': str(p['_id']),
            'name': p['name'],
            'description': p.get('description'),
            'is_default': p.get('is_default', False),
            'holdings_count': holdings_count,
            'created_at': p.get('created_at'),
            'updated_at': p.get('updated_at')
        })
    
    return {'portfolios': formatted}

@router.get('/default')
async def get_default_portfolio(current_user: dict = Depends(get_current_user)):
    from server import db
    
    user_id = current_user.get('sub')
    portfolio = await db.portfolios.find_one({'user_id': user_id, 'is_default': True})
    
    if not portfolio:
        # Create default portfolio
        doc = {
            'user_id': user_id,
            'name': 'Main Portfolio',
            'description': 'My primary investment portfolio',
            'is_default': True,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
        result = await db.portfolios.insert_one(doc)
        portfolio = doc
        portfolio['_id'] = result.inserted_id
    
    return {
        'id': str(portfolio['_id']),
        'name': portfolio['name'],
        'description': portfolio.get('description'),
        'is_default': True
    }

@router.put('/{portfolio_id}')
async def update_portfolio(
    portfolio_id: str,
    update: PortfolioUpdate,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Verify ownership
    portfolio = await db.portfolios.find_one({
        '_id': ObjectId(portfolio_id),
        'user_id': user_id
    })
    
    if not portfolio:
        raise HTTPException(status_code=404, detail='Portfolio not found')
    
    # If setting as default, unset others
    if update.is_default:
        await db.portfolios.update_many(
            {'user_id': user_id, '_id': {'$ne': ObjectId(portfolio_id)}},
            {'$set': {'is_default': False}}
        )
    
    update_data = {'updated_at': datetime.now(timezone.utc)}
    if update.name is not None:
        update_data['name'] = update.name
    if update.description is not None:
        update_data['description'] = update.description
    if update.is_default is not None:
        update_data['is_default'] = update.is_default
    
    await db.portfolios.update_one(
        {'_id': ObjectId(portfolio_id)},
        {'$set': update_data}
    )
    
    return {'message': 'Portfolio updated successfully'}

@router.delete('/{portfolio_id}')
async def delete_portfolio(
    portfolio_id: str,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Verify ownership
    portfolio = await db.portfolios.find_one({
        '_id': ObjectId(portfolio_id),
        'user_id': user_id
    })
    
    if not portfolio:
        raise HTTPException(status_code=404, detail='Portfolio not found')
    
    # Don't allow deleting default if it has holdings
    if portfolio.get('is_default'):
        holdings_count = await db.portfolio_holdings.count_documents({
            'user_id': user_id,
            'portfolio_id': portfolio_id
        })
        if holdings_count > 0:
            raise HTTPException(
                status_code=400,
                detail='Cannot delete default portfolio with holdings. Move holdings first.'
            )
    
    # Delete portfolio and all its holdings
    await db.portfolio_holdings.delete_many({
        'user_id': user_id,
        'portfolio_id': portfolio_id
    })
    
    await db.portfolios.delete_one({'_id': ObjectId(portfolio_id)})
    
    return {'message': 'Portfolio deleted successfully'}
