import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict
import asyncio
from binance.client import Client as BinanceClient
import os

class DataFetcher:
    def __init__(self):
        self.binance_client = None
        # Initialize Binance client if API keys are available
        binance_key = os.getenv('BINANCE_API_KEY')
        binance_secret = os.getenv('BINANCE_API_SECRET')
        if binance_key and binance_secret:
            self.binance_client = BinanceClient(binance_key, binance_secret)
    
    async def search_assets(self, query: str, asset_type: str) -> List[Dict]:
        """Search for assets based on query"""
        if asset_type == 'stock':
            # Popular stocks matching query
            popular_stocks = [
                {'symbol': 'AAPL', 'name': 'Apple Inc.'},
                {'symbol': 'MSFT', 'name': 'Microsoft Corporation'},
                {'symbol': 'GOOGL', 'name': 'Alphabet Inc.'},
                {'symbol': 'AMZN', 'name': 'Amazon.com Inc.'},
                {'symbol': 'TSLA', 'name': 'Tesla Inc.'},
                {'symbol': 'META', 'name': 'Meta Platforms Inc.'},
                {'symbol': 'NVDA', 'name': 'NVIDIA Corporation'},
                {'symbol': 'JPM', 'name': 'JPMorgan Chase & Co.'},
                {'symbol': 'V', 'name': 'Visa Inc.'},
                {'symbol': 'JNJ', 'name': 'Johnson & Johnson'},
            ]
            return [s for s in popular_stocks if query.upper() in s['symbol'] or query.lower() in s['name'].lower()]
        else:
            # Popular crypto
            popular_crypto = [
                {'symbol': 'BTC-USD', 'name': 'Bitcoin'},
                {'symbol': 'ETH-USD', 'name': 'Ethereum'},
                {'symbol': 'BNB-USD', 'name': 'Binance Coin'},
                {'symbol': 'XRP-USD', 'name': 'Ripple'},
                {'symbol': 'ADA-USD', 'name': 'Cardano'},
                {'symbol': 'SOL-USD', 'name': 'Solana'},
                {'symbol': 'DOGE-USD', 'name': 'Dogecoin'},
                {'symbol': 'MATIC-USD', 'name': 'Polygon'},
            ]
            return [c for c in popular_crypto if query.upper() in c['symbol'] or query.lower() in c['name'].lower()]
    
    async def fetch_historical_data(self, symbols: List[str], asset_type: str, start_date: str, end_date: str) -> Dict:
        """Fetch historical price data"""
        try:
            # Use yfinance for both stocks and crypto
            data = yf.download(symbols, start=start_date, end=end_date, progress=False)
            
            if data.empty:
                raise ValueError("No data fetched")
            
            # Handle single vs multiple symbols
            if len(symbols) == 1:
                prices = data['Adj Close' if 'Adj Close' in data.columns else 'Close'].to_dict()
                return {
                    'dates': [d.strftime('%Y-%m-%d') for d in data.index],
                    'prices': {symbols[0]: [float(v) if not pd.isna(v) else None for v in data['Adj Close' if 'Adj Close' in data.columns else 'Close']]}
                }
            else:
                result = {
                    'dates': [d.strftime('%Y-%m-%d') for d in data.index],
                    'prices': {}
                }
                
                for symbol in symbols:
                    if 'Adj Close' in data.columns:
                        prices = data['Adj Close'][symbol] if len(symbols) > 1 else data['Adj Close']
                    else:
                        prices = data['Close'][symbol] if len(symbols) > 1 else data['Close']
                    
                    result['prices'][symbol] = [float(v) if not pd.isna(v) else None for v in prices]
                
                return result
        
        except Exception as e:
            raise ValueError(f"Error fetching data: {str(e)}")
    
    def calculate_returns(self, prices_df: pd.DataFrame) -> pd.DataFrame:
        """Calculate returns from price data"""
        return prices_df.pct_change().dropna()
    
    def calculate_features(self, prices_df: pd.DataFrame) -> pd.DataFrame:
        """Calculate technical features for ML"""
        features = pd.DataFrame(index=prices_df.index)
        
        for col in prices_df.columns:
            # Returns at different periods
            features[f'{col}_return_1d'] = prices_df[col].pct_change(1)
            features[f'{col}_return_5d'] = prices_df[col].pct_change(5)
            features[f'{col}_return_10d'] = prices_df[col].pct_change(10)
            
            # Moving averages
            features[f'{col}_ma_5'] = prices_df[col].rolling(5).mean() / prices_df[col]
            features[f'{col}_ma_10'] = prices_df[col].rolling(10).mean() / prices_df[col]
            features[f'{col}_ma_20'] = prices_df[col].rolling(20).mean() / prices_df[col]
            
            # Volatility
            features[f'{col}_vol_5'] = prices_df[col].pct_change().rolling(5).std()
            features[f'{col}_vol_10'] = prices_df[col].pct_change().rolling(10).std()
            features[f'{col}_vol_20'] = prices_df[col].pct_change().rolling(20).std()
            
            # RSI
            delta = prices_df[col].diff()
            gain = (delta.where(delta > 0, 0)).rolling(14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
            rs = gain / loss
            features[f'{col}_rsi'] = 100 - (100 / (1 + rs))
        
        return features.dropna()
