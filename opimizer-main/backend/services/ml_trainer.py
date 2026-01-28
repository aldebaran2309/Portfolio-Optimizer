import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import yfinance as yf
from typing import List, Dict, Callable
import json
from datetime import datetime

class MLTrainer:
    def __init__(self):
        self.models = {
            'Linear Regression': LinearRegression(),
            'Ridge Regression': Ridge(alpha=1.0),
            'Lasso Regression': Lasso(alpha=0.1),
            'Elastic Net': ElasticNet(alpha=0.1, l1_ratio=0.5),
            'Random Forest': RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42),
            'Gradient Boosting': GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42),
            'XGBoost': XGBRegressor(n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42)
        }
    
    async def train_all_models(self, symbols: List[str], asset_type: str, start_date: str, end_date: str, progress_callback: Callable = None) -> Dict:
        """Train all models and compare performance using advanced metrics"""
        try:
            # Fetch data
            data = yf.download(symbols, start=start_date, end=end_date, progress=False)
            
            if data.empty:
                raise ValueError("No data available for training")
            
            # Prepare features and target
            prices = data['Adj Close'] if 'Adj Close' in data.columns else data['Close']
            if len(symbols) == 1:
                prices = pd.DataFrame(prices, columns=[symbols[0]])
            
            X, y = self._prepare_features_target(prices)
            
            if len(X) < 50:
                raise ValueError("Insufficient data for training (need at least 50 samples)")
            
            # Train-test split
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            
            # Train all models
            results = {}
            total_models = len(self.models)
            
            for idx, (name, model) in enumerate(self.models.items()):
                if progress_callback:
                    progress = int((idx / total_models) * 100)
                    progress_callback(progress, name)
                
                # Train
                model.fit(X_train, y_train)
                
                # Predict
                y_pred_train = model.predict(X_train)
                y_pred_test = model.predict(X_test)
                
                # Standard metrics
                train_mse = float(mean_squared_error(y_train, y_pred_train))
                test_mse = float(mean_squared_error(y_test, y_pred_test))
                train_r2 = float(r2_score(y_train, y_pred_train))
                test_r2 = float(r2_score(y_test, y_pred_test))
                train_mae = float(mean_absolute_error(y_train, y_pred_train))
                test_mae = float(mean_absolute_error(y_test, y_pred_test))
                
                # Advanced metrics
                
                # 1. Directional Accuracy (predict up/down correctly)
                train_direction_accuracy = float(np.mean((y_train > 0) == (y_pred_train > 0)))
                test_direction_accuracy = float(np.mean((y_test > 0) == (y_pred_test > 0)))
                
                # 2. Downside Risk Focus (penalize underestimating negative returns)
                downside_errors = y_pred_test[y_test < 0] - y_test[y_test < 0]
                downside_mse = float(np.mean(downside_errors ** 2)) if len(downside_errors) > 0 else 0
                
                # 3. Upside Capture (ability to predict positive returns)
                upside_pred = y_pred_test[y_test > 0]
                upside_actual = y_test[y_test > 0]
                upside_r2 = float(r2_score(upside_actual, upside_pred)) if len(upside_actual) > 5 else 0
                
                # 4. Maximum Prediction Error (worst case)
                max_error = float(np.max(np.abs(y_test - y_pred_test)))
                
                # 5. Information Ratio (excess return / tracking error)
                tracking_error = float(np.std(y_test - y_pred_test))
                information_ratio = float(test_r2 / tracking_error) if tracking_error > 0 else 0
                
                results[name] = {
                    # Standard metrics
                    'train_mse': train_mse,
                    'test_mse': test_mse,
                    'train_r2': train_r2,
                    'test_r2': test_r2,
                    'train_mae': train_mae,
                    'test_mae': test_mae,
                    
                    # Advanced metrics
                    'test_direction_accuracy': test_direction_accuracy,
                    'train_direction_accuracy': train_direction_accuracy,
                    'downside_mse': downside_mse,
                    'upside_r2': upside_r2,
                    'max_error': max_error,
                    'information_ratio': information_ratio,
                    
                    # Combined score (weighted)
                    'combined_score': float(
                        0.3 * test_r2 +  # Accuracy
                        0.2 * test_direction_accuracy +  # Direction
                        0.2 * (1 - min(downside_mse, 1)) +  # Downside protection
                        0.15 * upside_r2 +  # Upside capture
                        0.15 * min(information_ratio, 1)  # Consistency
                    )
                }
            
            if progress_callback:
                progress_callback(100, "Complete")
            
            # Find best model based on combined score (not just test R2)
            best_model_name = max(results.items(), key=lambda x: x[1]['combined_score'])[0]
            
            # Save results to file
            output = {
                'timestamp': datetime.now().isoformat(),
                'symbols': symbols,
                'date_range': f"{start_date} to {end_date}",
                'data_points': len(X),
                'models': results,
                'best_model': {
                    'name': best_model_name,
                    'metrics': results[best_model_name],
                    'selection_criteria': 'Combined score (accuracy, direction, risk-adjusted)'
                },
                'formulas_used': {
                    'mse': 'MSE = (1/n)Σ(pi - p̂i)²',
                    'direction_accuracy': 'Proportion of correct up/down predictions',
                    'downside_mse': 'MSE for negative returns only',
                    'information_ratio': 'R² / Tracking Error'
                }
            }
            
            # Save to file
            with open('/app/model_comparison_results.json', 'w') as f:
                json.dump(output, f, indent=2)
            
            return output
        
        except Exception as e:
            raise ValueError(f"Training error: {str(e)}")
    
    def _prepare_features_target(self, prices: pd.DataFrame):
        """Prepare features and target for ML"""
        features = pd.DataFrame()
        
        for col in prices.columns:
            # Lagged returns
            for lag in [1, 2, 3, 5, 10]:
                features[f'{col}_return_lag_{lag}'] = prices[col].pct_change(lag)
            
            # Moving averages
            for window in [5, 10, 20]:
                features[f'{col}_ma_{window}'] = prices[col].rolling(window).mean() / prices[col]
            
            # Volatility
            for window in [5, 10, 20]:
                features[f'{col}_vol_{window}'] = prices[col].pct_change().rolling(window).std()
            
            # RSI
            delta = prices[col].diff()
            gain = (delta.where(delta > 0, 0)).rolling(14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
            rs = gain / loss
            features[f'{col}_rsi'] = 100 - (100 / (1 + rs))
            
            # MACD
            ema_12 = prices[col].ewm(span=12).mean()
            ema_26 = prices[col].ewm(span=26).mean()
            features[f'{col}_macd'] = (ema_12 - ema_26) / prices[col]
        
        # Target: next period return (average of all assets)
        target = prices.pct_change().shift(-1).mean(axis=1)
        
        # Align and drop NaN
        features = features.dropna()
        target = target.loc[features.index].dropna()
        features = features.loc[target.index]
        
        return features, target
    
    def predict_returns(self, model_name: str, X):
        """Predict returns using trained model"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        return self.models[model_name].predict(X)
