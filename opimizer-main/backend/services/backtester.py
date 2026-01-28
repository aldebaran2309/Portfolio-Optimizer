import pandas as pd
import numpy as np
import yfinance as yf
from typing import List, Dict

class Backtester:
    async def run_backtest(self, symbols: List[str], asset_type: str, weights: Dict[str, float], start_date: str, end_date: str) -> Dict:
        """Run backtest with given weights using advanced performance metrics"""
        try:
            # Fetch data
            data = yf.download(symbols, start=start_date, end=end_date, progress=False)
            
            if data.empty:
                raise ValueError("No data available")
            
            # Get prices
            prices = data['Adj Close'] if 'Adj Close' in data.columns else data['Close']
            if len(symbols) == 1:
                prices = pd.DataFrame(prices, columns=[symbols[0]])
            
            # Calculate returns
            returns = prices.pct_change().dropna()
            
            # Portfolio returns: Rportfolio = wᵀr
            portfolio_returns = pd.Series(0.0, index=returns.index)
            for symbol in symbols:
                if symbol in weights:
                    portfolio_returns += returns[symbol] * weights[symbol]
            
            # Cumulative returns
            cumulative_returns = (1 + portfolio_returns).cumprod()
            
            # Calculate metrics
            total_return = float(cumulative_returns.iloc[-1] - 1)
            
            # CAGR (Compound Annual Growth Rate)
            n_years = len(portfolio_returns) / 252
            cagr = float((cumulative_returns.iloc[-1] ** (1 / n_years)) - 1) if n_years > 0 else 0
            
            # Volatility (standard deviation)
            volatility = float(portfolio_returns.std() * np.sqrt(252))
            
            # Sharpe Ratio: SR = (Rp - Rf) / σp
            sharpe = float(cagr / volatility) if volatility > 0 else 0
            
            # Sortino Ratio: SoR = (Rp - Rf) / σd
            # Focus only on downside risk
            downside_returns = portfolio_returns[portfolio_returns < 0]
            downside_std = float(downside_returns.std() * np.sqrt(252))
            sortino = float(cagr / downside_std) if downside_std > 0 else 0
            
            # Maximum Drawdown
            running_max = cumulative_returns.cummax()
            drawdown = (cumulative_returns - running_max) / running_max
            max_drawdown = float(drawdown.min())
            
            # Calmar Ratio: CAGR / |Max Drawdown|
            calmar = float(cagr / abs(max_drawdown)) if max_drawdown != 0 else 0
            
            # Win rate
            win_rate = float(len(portfolio_returns[portfolio_returns > 0]) / len(portfolio_returns))
            
            # Best/Worst days
            best_day = float(portfolio_returns.max())
            worst_day = float(portfolio_returns.min())
            
            # Average win/loss
            winning_returns = portfolio_returns[portfolio_returns > 0]
            losing_returns = portfolio_returns[portfolio_returns < 0]
            avg_win = float(winning_returns.mean()) if len(winning_returns) > 0 else 0
            avg_loss = float(losing_returns.mean()) if len(losing_returns) > 0 else 0
            
            # Profit factor (sum of wins / sum of losses)
            profit_factor = float(winning_returns.sum() / abs(losing_returns.sum())) if len(losing_returns) > 0 and losing_returns.sum() != 0 else 0
            
            # Value at Risk (VaR) at 95% confidence
            var_95 = float(portfolio_returns.quantile(0.05))
            
            # Conditional Value at Risk (CVaR) - expected loss beyond VaR
            cvar_95 = float(portfolio_returns[portfolio_returns <= var_95].mean())
            
            # Ulcer Index (downside volatility measure)
            drawdown_squared = (drawdown ** 2).mean()
            ulcer_index = float(np.sqrt(drawdown_squared))
            
            # Pain Index (average drawdown)
            pain_index = float(abs(drawdown.mean()))
            
            # Recovery factor
            recovery_factor = float(total_return / abs(max_drawdown)) if max_drawdown != 0 else 0
            
            # Downside deviation (for Sortino calculation)
            downside_deviation = float(downside_std / np.sqrt(252))  # Daily
            
            return {
                # Core metrics
                'total_return': total_return,
                'cagr': cagr,
                'volatility': volatility,
                
                # Risk-adjusted returns
                'sharpe_ratio': sharpe,
                'sortino_ratio': sortino,
                'calmar_ratio': calmar,
                'information_ratio': float(cagr / volatility) if volatility > 0 else 0,
                
                # Drawdown metrics
                'max_drawdown': max_drawdown,
                'ulcer_index': ulcer_index,
                'pain_index': pain_index,
                'recovery_factor': recovery_factor,
                
                # Win/Loss metrics
                'win_rate': win_rate,
                'profit_factor': profit_factor,
                'avg_win': avg_win,
                'avg_loss': avg_loss,
                'best_day': best_day,
                'worst_day': worst_day,
                
                # Risk metrics
                'downside_deviation': downside_deviation,
                'downside_risk': downside_std,
                'var_95': var_95,
                'cvar_95': cvar_95,
                
                # Time series
                'cumulative_returns': [
                    {'date': date.strftime('%Y-%m-%d'), 'value': float(val)}
                    for date, val in cumulative_returns.items()
                ],
                'daily_returns': [
                    {'date': date.strftime('%Y-%m-%d'), 'value': float(val)}
                    for date, val in portfolio_returns.items()
                ],
                'drawdown_series': [
                    {'date': date.strftime('%Y-%m-%d'), 'value': float(val)}
                    for date, val in drawdown.items()
                ],
                
                # Metadata
                'metrics_description': {
                    'sharpe_ratio': 'SR = (Rp - Rf) / σp',
                    'sortino_ratio': 'SoR = (Rp - Rf) / σd (downside only)',
                    'calmar_ratio': 'CAGR / |Max Drawdown|',
                    'ulcer_index': 'Sqrt of mean squared drawdowns',
                    'var_95': '5% worst case loss',
                    'cvar_95': 'Expected loss beyond VaR'
                }
            }
        
        except Exception as e:
            raise ValueError(f"Backtesting error: {str(e)}")
