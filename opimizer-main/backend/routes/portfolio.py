from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict
from auth.dependencies import get_current_user
from datetime import datetime, timezone
from bson import ObjectId
from services.enhanced_data_fetcher import enhanced_data_fetcher
from services.ml_trainer import MLTrainer
from services.optimizer import PortfolioOptimizer
import yfinance as yf
import pandas as pd
import numpy as np

router = APIRouter(prefix='/api/portfolio', tags=['portfolio'])

# Models
class HoldingCreate(BaseModel):
    symbol: str
    asset_type: str  # stock or crypto
    quantity: float
    purchase_price: Optional[float] = None
    purchase_date: Optional[str] = None

class HoldingUpdate(BaseModel):
    quantity: Optional[float] = None
    purchase_price: Optional[float] = None
    purchase_date: Optional[str] = None

class PortfolioAnalysisRequest(BaseModel):
    start_date: str = '2022-01-01'
    end_date: Optional[str] = None

@router.post('/holdings')
async def add_holding(
    holding: HoldingCreate,
    portfolio_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Get portfolio (default if not specified)
    if not portfolio_id:
        portfolio = await db.portfolios.find_one({'user_id': user_id, 'is_default': True})
        if not portfolio:
            # Create default portfolio
            portfolio_doc = {
                'user_id': user_id,
                'name': 'Main Portfolio',
                'description': 'My primary investment portfolio',
                'is_default': True,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc)
            }
            result = await db.portfolios.insert_one(portfolio_doc)
            portfolio_id = str(result.inserted_id)
        else:
            portfolio_id = str(portfolio['_id'])
    
    # Get current price
    price_data = await enhanced_data_fetcher.fetch_real_time_price(holding.symbol, holding.asset_type)
    current_price = price_data['price'] if price_data else None
    
    # Check if holding already exists in this portfolio
    existing = await db.portfolio_holdings.find_one({
        'user_id': user_id,
        'portfolio_id': portfolio_id,
        'symbol': holding.symbol
    })
    
    if existing:
        # Update quantity
        new_quantity = existing['quantity'] + holding.quantity
        await db.portfolio_holdings.update_one(
            {'_id': existing['_id']},
            {'$set': {
                'quantity': new_quantity,
                'current_price': current_price,
                'updated_at': datetime.now(timezone.utc)
            }}
        )
        holding_id = str(existing['_id'])
    else:
        # Create new holding
        doc = {
            'user_id': user_id,
            'portfolio_id': portfolio_id,
            'symbol': holding.symbol,
            'asset_type': holding.asset_type,
            'quantity': holding.quantity,
            'purchase_price': holding.purchase_price,
            'purchase_date': holding.purchase_date,
            'current_price': current_price,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
        result = await db.portfolio_holdings.insert_one(doc)
        holding_id = str(result.inserted_id)
    
    return {
        'holding_id': holding_id,
        'portfolio_id': portfolio_id,
        'message': 'Holding added successfully',
        'current_price': current_price
    }

@router.get('/holdings')
async def get_holdings(
    portfolio_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Get portfolio
    if not portfolio_id:
        portfolio = await db.portfolios.find_one({'user_id': user_id, 'is_default': True})
        if portfolio:
            portfolio_id = str(portfolio['_id'])
    
    query = {'user_id': user_id}
    if portfolio_id:
        query['portfolio_id'] = portfolio_id
    
    holdings = await db.portfolio_holdings.find(query).to_list(100)
    
    # Update current prices
    total_value = 0
    total_investment = 0
    
    formatted_holdings = []
    for holding in holdings:
        # Fetch current price
        price_data = await enhanced_data_fetcher.fetch_real_time_price(
            holding['symbol'],
            holding.get('asset_type', 'stock')
        )
        
        current_price = price_data['price'] if price_data else holding.get('current_price', 0)
        purchase_price = holding.get('purchase_price', current_price)
        quantity = holding['quantity']
        
        current_value = current_price * quantity
        investment = purchase_price * quantity if purchase_price else current_value
        gain_loss = current_value - investment
        gain_loss_percent = (gain_loss / investment * 100) if investment > 0 else 0
        
        total_value += current_value
        total_investment += investment
        
        formatted_holdings.append({
            'id': str(holding['_id']),
            'symbol': holding['symbol'],
            'asset_type': holding.get('asset_type', 'stock'),
            'quantity': quantity,
            'purchase_price': purchase_price,
            'current_price': current_price,
            'current_value': current_value,
            'investment': investment,
            'gain_loss': gain_loss,
            'gain_loss_percent': gain_loss_percent,
            'purchase_date': holding.get('purchase_date'),
            'price_change': price_data.get('change') if price_data else None,
            'price_change_percent': price_data.get('change_percent') if price_data else None
        })
    
    total_gain_loss = total_value - total_investment
    total_gain_loss_percent = (total_gain_loss / total_investment * 100) if total_investment > 0 else 0
    
    return {
        'holdings': formatted_holdings,
        'summary': {
            'total_value': total_value,
            'total_investment': total_investment,
            'total_gain_loss': total_gain_loss,
            'total_gain_loss_percent': total_gain_loss_percent,
            'holdings_count': len(formatted_holdings)
        }
    }

@router.put('/holdings/{holding_id}')
async def update_holding(
    holding_id: str,
    update: HoldingUpdate,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Verify ownership
    holding = await db.portfolio_holdings.find_one({
        '_id': ObjectId(holding_id),
        'user_id': user_id
    })
    
    if not holding:
        raise HTTPException(status_code=404, detail='Holding not found')
    
    # Update fields
    update_data = {'updated_at': datetime.now(timezone.utc)}
    if update.quantity is not None:
        update_data['quantity'] = update.quantity
    if update.purchase_price is not None:
        update_data['purchase_price'] = update.purchase_price
    if update.purchase_date is not None:
        update_data['purchase_date'] = update.purchase_date
    
    await db.portfolio_holdings.update_one(
        {'_id': ObjectId(holding_id)},
        {'$set': update_data}
    )
    
    return {'message': 'Holding updated successfully'}

@router.delete('/holdings/{holding_id}')
async def delete_holding(
    holding_id: str,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Verify ownership and delete
    result = await db.portfolio_holdings.delete_one({
        '_id': ObjectId(holding_id),
        'user_id': user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Holding not found')
    
    return {'message': 'Holding deleted successfully'}

@router.post('/analyze')
async def analyze_portfolio(
    request: PortfolioAnalysisRequest,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    
    # Get user holdings
    holdings = await db.portfolio_holdings.find({'user_id': user_id}).to_list(100)
    
    if len(holdings) < 2:
        raise HTTPException(
            status_code=400,
            detail='Need at least 2 holdings for portfolio analysis'
        )
    
    symbols = [h['symbol'] for h in holdings]
    
    # Fetch historical data
    end_date = request.end_date or datetime.now().strftime('%Y-%m-%d')
    data = yf.download(symbols, start=request.start_date, end=end_date, progress=False)
    
    if data.empty:
        raise HTTPException(status_code=400, detail='Unable to fetch historical data')
    
    # Calculate current weights
    total_value = 0
    current_values = {}
    
    for holding in holdings:
        price_data = await enhanced_data_fetcher.fetch_real_time_price(
            holding['symbol'],
            holding.get('asset_type', 'stock')
        )
        current_price = price_data['price'] if price_data else 0
        value = current_price * holding['quantity']
        current_values[holding['symbol']] = value
        total_value += value
    
    current_weights = {symbol: value / total_value for symbol, value in current_values.items()}
    
    # Calculate returns and risk
    prices = data['Adj Close'] if 'Adj Close' in data.columns else data['Close']
    if len(symbols) == 1:
        prices = pd.DataFrame(prices, columns=[symbols[0]])
    
    returns = prices.pct_change().dropna()
    mu = returns.mean().values
    Sigma = returns.cov().values
    
    # Portfolio metrics with current weights
    weights_array = np.array([current_weights.get(s, 0) for s in symbols])
    portfolio_return = float(mu @ weights_array)
    portfolio_variance = float(weights_array @ Sigma @ weights_array)
    portfolio_std = float(np.sqrt(portfolio_variance))
    
    # Annualize
    annualized_return = float((1 + portfolio_return) ** 252 - 1)
    annualized_std = float(portfolio_std * np.sqrt(252))
    sharpe_ratio = float(annualized_return / annualized_std) if annualized_std > 0 else 0
    
    # Get optimized weights
    optimizer = PortfolioOptimizer()
    optimized = await optimizer.optimize(
        symbols,
        'stock',
        request.start_date,
        end_date,
        risk_tolerance=0.5
    )
    
    # Calculate difference
    weight_differences = {}
    recommendations = []
    
    for symbol in symbols:
        current_w = current_weights.get(symbol, 0)
        optimal_w = optimized['weights'].get(symbol, 0)
        diff = optimal_w - current_w
        weight_differences[symbol] = {
            'current': current_w,
            'optimal': optimal_w,
            'difference': diff
        }
        
        if abs(diff) > 0.05:  # 5% threshold
            action = 'Increase' if diff > 0 else 'Decrease'
            recommendations.append({
                'symbol': symbol,
                'action': action,
                'current_weight': current_w * 100,
                'optimal_weight': optimal_w * 100,
                'difference': abs(diff) * 100
            })
    
    return {
        'current_portfolio': {
            'weights': current_weights,
            'expected_return': portfolio_return,
            'annualized_return': annualized_return,
            'risk': portfolio_std,
            'annualized_risk': annualized_std,
            'sharpe_ratio': sharpe_ratio,
            'total_value': total_value
        },
        'optimized_portfolio': {
            'weights': optimized['weights'],
            'expected_return': optimized['expected_return'],
            'annualized_return': optimized['annualized_return'],
            'risk': optimized['risk'],
            'annualized_risk': optimized['annualized_risk'],
            'sharpe_ratio': optimized['annualized_sharpe']
        },
        'recommendations': recommendations,
        'weight_differences': weight_differences,
        'potential_improvement': {
            'return_increase': optimized['annualized_return'] - annualized_return,
            'risk_change': optimized['annualized_risk'] - annualized_std,
            'sharpe_improvement': optimized['annualized_sharpe'] - sharpe_ratio
        }
    }

@router.get('/value-history')
async def get_portfolio_value_history(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    from server import db
    
    user_id = current_user.get('sub')
    holdings = await db.portfolio_holdings.find({'user_id': user_id}).to_list(100)
    
    if len(holdings) == 0:
        return {'history': [], 'current_value': 0}
    
    symbols = [h['symbol'] for h in holdings]
    quantities = {h['symbol']: h['quantity'] for h in holdings}
    
    # Fetch historical data
    from datetime import timedelta
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    data = yf.download(
        symbols,
        start=start_date.strftime('%Y-%m-%d'),
        end=end_date.strftime('%Y-%m-%d'),
        progress=False
    )
    
    if data.empty:
        return {'history': [], 'current_value': 0}
    
    prices = data['Adj Close'] if 'Adj Close' in data.columns else data['Close']
    if len(symbols) == 1:
        prices = pd.DataFrame(prices, columns=[symbols[0]])
    
    # Calculate portfolio value over time
    history = []
    for date, row in prices.iterrows():
        total_value = 0
        for symbol in symbols:
            price = row[symbol] if not pd.isna(row[symbol]) else 0
            total_value += price * quantities[symbol]
        
        history.append({
            'date': date.strftime('%Y-%m-%d'),
            'value': float(total_value)
        })
    
    current_value = history[-1]['value'] if history else 0
    
    return {
        'history': history,
        'current_value': current_value
    }
