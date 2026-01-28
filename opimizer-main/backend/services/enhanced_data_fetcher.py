import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Optional
import asyncio
from binance.client import Client as BinanceClient
from polygon import RESTClient
import os
import json

class EnhancedDataFetcher:
    def __init__(self):
        # Polygon client
        self.polygon_key = os.getenv('POLYGON_API_KEY')
        if self.polygon_key:
            self.polygon_client = RESTClient(self.polygon_key)
        else:
            self.polygon_client = None
        
        # Binance client (public data doesn't need auth)
        try:
            self.binance_client = BinanceClient()
        except:
            self.binance_client = None
        
        # Popular stocks and crypto cache
        self.popular_stocks = [
            {'symbol': 'AAPL', 'name': 'Apple Inc.', 'type': 'stock'},
            {'symbol': 'MSFT', 'name': 'Microsoft Corporation', 'type': 'stock'},
            {'symbol': 'GOOGL', 'name': 'Alphabet Inc.', 'type': 'stock'},
            {'symbol': 'AMZN', 'name': 'Amazon.com Inc.', 'type': 'stock'},
            {'symbol': 'TSLA', 'name': 'Tesla Inc.', 'type': 'stock'},
            {'symbol': 'META', 'name': 'Meta Platforms Inc.', 'type': 'stock'},
            {'symbol': 'NVDA', 'name': 'NVIDIA Corporation', 'type': 'stock'},
            {'symbol': 'JPM', 'name': 'JPMorgan Chase & Co.', 'type': 'stock'},
            {'symbol': 'V', 'name': 'Visa Inc.', 'type': 'stock'},
            {'symbol': 'JNJ', 'name': 'Johnson & Johnson', 'type': 'stock'},
            {'symbol': 'WMT', 'name': 'Walmart Inc.', 'type': 'stock'},
            {'symbol': 'PG', 'name': 'Procter & Gamble', 'type': 'stock'},
            {'symbol': 'MA', 'name': 'Mastercard Inc.', 'type': 'stock'},
            {'symbol': 'UNH', 'name': 'UnitedHealth Group', 'type': 'stock'},
            {'symbol': 'HD', 'name': 'Home Depot Inc.', 'type': 'stock'},
            {'symbol': 'BAC', 'name': 'Bank of America', 'type': 'stock'},
            {'symbol': 'DIS', 'name': 'Walt Disney Company', 'type': 'stock'},
            {'symbol': 'NFLX', 'name': 'Netflix Inc.', 'type': 'stock'},
            {'symbol': 'ADBE', 'name': 'Adobe Inc.', 'type': 'stock'},
            {'symbol': 'CRM', 'name': 'Salesforce Inc.', 'type': 'stock'},
        ]
        
        self.popular_crypto = [
            {'symbol': 'BTC-USD', 'name': 'Bitcoin', 'type': 'crypto'},
            {'symbol': 'ETH-USD', 'name': 'Ethereum', 'type': 'crypto'},
            {'symbol': 'BNB-USD', 'name': 'Binance Coin', 'type': 'crypto'},
            {'symbol': 'XRP-USD', 'name': 'Ripple', 'type': 'crypto'},
            {'symbol': 'ADA-USD', 'name': 'Cardano', 'type': 'crypto'},
            {'symbol': 'SOL-USD', 'name': 'Solana', 'type': 'crypto'},
            {'symbol': 'DOGE-USD', 'name': 'Dogecoin', 'type': 'crypto'},
            {'symbol': 'MATIC-USD', 'name': 'Polygon', 'type': 'crypto'},
            {'symbol': 'DOT-USD', 'name': 'Polkadot', 'type': 'crypto'},
            {'symbol': 'AVAX-USD', 'name': 'Avalanche', 'type': 'crypto'},
        ]
    
    async def search_assets(self, query: str, asset_type: Optional[str] = None, limit: int = 10) -> List[Dict]:
        """Enhanced search with autocomplete"""
        query_lower = query.lower()
        results = []
        
        if asset_type == 'stock' or asset_type is None:
            # Search in popular stocks
            stock_matches = [
                s for s in self.popular_stocks
                if query_lower in s['symbol'].lower() or query_lower in s['name'].lower()
            ]
            results.extend(stock_matches)
            
            # Try Polygon search if available
            if self.polygon_client and len(results) < limit:
                try:
                    polygon_results = self.polygon_client.reference_tickers_v3(
                        search=query,
                        market='stocks',
                        active=True,
                        limit=10
                    )
                    
                    for ticker in polygon_results:
                        if len(results) >= limit:
                            break
                        results.append({
                            'symbol': ticker.ticker,
                            'name': ticker.name,
                            'type': 'stock'
                        })
                except Exception as e:
                    print(f"Polygon search error: {e}")
        
        if asset_type == 'crypto' or asset_type is None:
            # Search in popular crypto
            crypto_matches = [
                c for c in self.popular_crypto
                if query_lower in c['symbol'].lower() or query_lower in c['name'].lower()
            ]
            results.extend(crypto_matches)
        
        # Remove duplicates
        seen = set()
        unique_results = []
        for item in results:
            if item['symbol'] not in seen:
                seen.add(item['symbol'])
                unique_results.append(item)
        
        return unique_results[:limit]
    
    async def get_popular_examples(self, asset_type: str = 'stock', limit: int = 5) -> List[Dict]:
        """Get popular examples to show in UI"""
        if asset_type == 'stock':
            return self.popular_stocks[:limit]
        else:
            return self.popular_crypto[:limit]
    
    async def fetch_real_time_price(self, symbol: str, asset_type: str = 'stock') -> Optional[Dict]:
        """Fetch real-time price from multiple sources"""
        try:
            # Try Polygon for stocks
            if asset_type == 'stock' and self.polygon_client:
                try:
                    snapshot = self.polygon_client.get_snapshot_ticker('stocks', symbol)
                    if snapshot and snapshot.day:
                        return {
                            'symbol': symbol,
                            'price': snapshot.day.c,
                            'change': snapshot.day.c - snapshot.day.o,
                            'change_percent': ((snapshot.day.c - snapshot.day.o) / snapshot.day.o) * 100,
                            'volume': snapshot.day.v,
                            'source': 'polygon'
                        }
                except Exception as e:
                    print(f"Polygon real-time error: {e}")
            
            # Try Binance for crypto
            if asset_type == 'crypto' and self.binance_client:
                try:
                    # Convert symbol format
                    binance_symbol = symbol.replace('-USD', 'USDT')
                    ticker = self.binance_client.get_ticker(symbol=binance_symbol)
                    return {
                        'symbol': symbol,
                        'price': float(ticker['lastPrice']),
                        'change': float(ticker['priceChange']),
                        'change_percent': float(ticker['priceChangePercent']),
                        'volume': float(ticker['volume']),
                        'source': 'binance'
                    }
                except Exception as e:
                    print(f"Binance real-time error: {e}")
            
            # Fallback to yfinance
            ticker = yf.Ticker(symbol)
            info = ticker.info
            return {
                'symbol': symbol,
                'price': info.get('currentPrice') or info.get('regularMarketPrice'),
                'change': info.get('regularMarketChange'),
                'change_percent': info.get('regularMarketChangePercent'),
                'volume': info.get('volume'),
                'source': 'yfinance'
            }
        
        except Exception as e:
            print(f"Error fetching real-time price: {e}")
            return None
    
    async def fetch_historical_data(self, symbols: List[str], asset_type: str, start_date: str, end_date: str) -> Dict:
        """Fetch historical price data from best available source"""
        try:
            # Use yfinance as primary source (most reliable for both stocks and crypto)
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

# Create instance
enhanced_data_fetcher = EnhancedDataFetcher()
