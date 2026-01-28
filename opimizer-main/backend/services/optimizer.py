import pandas as pd
import numpy as np
import cvxpy as cp
import yfinance as yf
from typing import List, Dict

class PortfolioOptimizer:
    async def optimize(self, symbols: List[str], asset_type: str, start_date: str, end_date: str, risk_tolerance: float = 0.5, include_drawdown_penalty: bool = True) -> Dict:
        """Optimize portfolio using Mean-Variance Optimization with optional drawdown penalty"""
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
            
            # Expected returns (μ) - mean of historical returns
            mu = returns.mean().values
            
            # Covariance matrix (Σ)
            Sigma = returns.cov().values
            
            # Number of assets
            n = len(symbols)
            
            # Optimization variables
            w = cp.Variable(n)
            
            # Expected portfolio return: μp = Σ(wi * μi) = wᵀμ
            ret = mu @ w
            
            # Portfolio variance: σp² = wᵀΣw
            risk = cp.quad_form(w, Sigma)
            
            # Calculate maximum drawdown penalty if requested
            drawdown_penalty = 0
            if include_drawdown_penalty:
                # Calculate historical portfolio returns with equal weights
                equal_weights = np.ones(n) / n
                historical_portfolio_returns = returns @ equal_weights
                cumulative_returns = (1 + historical_portfolio_returns).cumprod()
                running_max = cumulative_returns.cummax()
                drawdown = (cumulative_returns - running_max) / running_max
                max_drawdown = abs(drawdown.min())
                
                # Drawdown penalty: £[max(-Rportfolio, 0)²]
                # Approximate with historical max drawdown
                drawdown_penalty = max_drawdown ** 2
            
            # Risk-adjusted objective with drawdown penalty
            # L = -δ · £[Rportfolio] - (1 - δ) · DrawdownPenalty
            # Converted to maximization: maximize(return - λ*risk - drawdown_penalty)
            lambda_risk = 1 - risk_tolerance
            
            if include_drawdown_penalty:
                objective = cp.Maximize(ret - lambda_risk * risk - 0.5 * drawdown_penalty)
            else:
                objective = cp.Maximize(ret - lambda_risk * risk)
            
            # Constraints
            constraints = [
                cp.sum(w) == 1,  # Weights sum to 1: wᵀ1 = 1
                w >= 0  # No short selling: wi ≥ 0
            ]
            
            # Solve
            problem = cp.Problem(objective, constraints)
            problem.solve()
            
            if w.value is None:
                raise ValueError("Optimization failed to converge")
            
            # Results
            weights = {symbol: float(weight) for symbol, weight in zip(symbols, w.value)}
            
            # Calculate portfolio metrics
            portfolio_return = float(mu @ w.value)
            portfolio_variance = float(w.value @ Sigma @ w.value)
            portfolio_std = float(np.sqrt(portfolio_variance))
            
            # Calculate portfolio returns time series for advanced metrics
            portfolio_returns = returns @ w.value
            
            # Sharpe ratio (assuming risk-free rate = 0)
            # SR = (Rp - Rf) / σp
            sharpe_ratio = float(portfolio_return / portfolio_std) if portfolio_std > 0 else 0
            
            # Sortino ratio (downside risk only)
            # SoR = (Rp - Rf) / σd
            downside_returns = portfolio_returns[portfolio_returns < 0]
            downside_std = float(downside_returns.std()) if len(downside_returns) > 0 else portfolio_std
            sortino_ratio = float(portfolio_return / downside_std) if downside_std > 0 else 0
            
            # Maximum Drawdown
            cumulative = (1 + portfolio_returns).cumprod()
            running_max = cumulative.cummax()
            drawdown_series = (cumulative - running_max) / running_max
            max_drawdown_value = float(drawdown_series.min())
            
            # Annualize metrics (assuming daily returns)
            annualized_return = float((1 + portfolio_return) ** 252 - 1)
            annualized_std = float(portfolio_std * np.sqrt(252))
            annualized_sharpe = float(annualized_return / annualized_std) if annualized_std > 0 else 0
            
            # Annualized Sortino
            annualized_downside_std = float(downside_std * np.sqrt(252))
            annualized_sortino = float(annualized_return / annualized_downside_std) if annualized_downside_std > 0 else 0
            
            # Calmar Ratio (return / max drawdown)
            calmar_ratio = float(annualized_return / abs(max_drawdown_value)) if max_drawdown_value != 0 else 0
            
            return {
                'weights': weights,
                'expected_return': portfolio_return,
                'annualized_return': annualized_return,
                'risk': portfolio_std,
                'annualized_risk': annualized_std,
                'sharpe_ratio': sharpe_ratio,
                'annualized_sharpe': annualized_sharpe,
                'sortino_ratio': sortino_ratio,
                'annualized_sortino': annualized_sortino,
                'max_drawdown': max_drawdown_value,
                'calmar_ratio': calmar_ratio,
                'downside_risk': downside_std,
                'annualized_downside_risk': annualized_downside_std,
                'covariance_matrix': Sigma.tolist(),
                'optimization_method': 'Mean-Variance with Drawdown Penalty' if include_drawdown_penalty else 'Mean-Variance'
            }
        
        except Exception as e:
            raise ValueError(f"Optimization error: {str(e)}")
