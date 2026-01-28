#!/usr/bin/env python3

import requests
import json
import time
import sys
from datetime import datetime, timedelta

class PortfolioOptimizerTester:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })

    def test_api_health(self):
        """Test basic API connectivity"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            if success:
                details += f", Response: {response.json()}"
            self.log_test("API Health Check", success, details)
            return success
        except Exception as e:
            self.log_test("API Health Check", False, str(e))
            return False

    def test_asset_search_stocks(self):
        """Test asset search for stocks"""
        try:
            payload = {
                "query": "AAPL",
                "asset_type": "stock"
            }
            response = requests.post(f"{self.api_url}/assets/search", json=payload, timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                assets = data.get('assets', [])
                success = len(assets) > 0 and any('AAPL' in asset.get('symbol', '') for asset in assets)
                details += f", Found {len(assets)} assets"
            
            self.log_test("Asset Search - Stocks", success, details)
            return success
        except Exception as e:
            self.log_test("Asset Search - Stocks", False, str(e))
            return False

    def test_asset_search_crypto(self):
        """Test asset search for crypto"""
        try:
            payload = {
                "query": "BTC",
                "asset_type": "crypto"
            }
            response = requests.post(f"{self.api_url}/assets/search", json=payload, timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                assets = data.get('assets', [])
                success = len(assets) > 0 and any('BTC' in asset.get('symbol', '') for asset in assets)
                details += f", Found {len(assets)} assets"
            
            self.log_test("Asset Search - Crypto", success, details)
            return success
        except Exception as e:
            self.log_test("Asset Search - Crypto", False, str(e))
            return False

    def test_data_fetch(self):
        """Test historical data fetching"""
        try:
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
            
            payload = {
                "symbols": ["AAPL", "MSFT"],
                "asset_type": "stock",
                "start_date": start_date,
                "end_date": end_date
            }
            response = requests.post(f"{self.api_url}/data/fetch", json=payload, timeout=30)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                success = 'data' in data and 'prices' in data['data']
                details += f", Data keys: {list(data.keys())}"
            
            self.log_test("Data Fetch", success, details)
            return success
        except Exception as e:
            self.log_test("Data Fetch", False, str(e))
            return False

    def test_portfolio_optimization(self):
        """Test portfolio optimization"""
        try:
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
            
            payload = {
                "symbols": ["AAPL", "MSFT", "GOOGL"],
                "asset_type": "stock",
                "risk_tolerance": 0.5,
                "start_date": start_date,
                "end_date": end_date,
                "rebalance_freq": "daily"
            }
            response = requests.post(f"{self.api_url}/optimize", json=payload, timeout=60)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                required_keys = ['weights', 'expected_return', 'risk', 'sharpe_ratio']
                success = all(key in data for key in required_keys)
                details += f", Keys: {list(data.keys())}"
                if success:
                    weights_sum = sum(data['weights'].values())
                    success = abs(weights_sum - 1.0) < 0.01
                    details += f", Weights sum: {weights_sum:.3f}"
            
            self.log_test("Portfolio Optimization", success, details)
            return success
        except Exception as e:
            self.log_test("Portfolio Optimization", False, str(e))
            return False

    def test_backtesting(self):
        """Test backtesting functionality"""
        try:
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
            
            payload = {
                "symbols": ["AAPL", "MSFT"],
                "asset_type": "stock",
                "weights": {"AAPL": 0.6, "MSFT": 0.4},
                "start_date": start_date,
                "end_date": end_date
            }
            response = requests.post(f"{self.api_url}/backtest", json=payload, timeout=60)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                required_keys = ['cagr', 'sharpe_ratio', 'volatility', 'max_drawdown']
                success = all(key in data for key in required_keys)
                details += f", Keys: {list(data.keys())}"
            
            self.log_test("Backtesting", success, details)
            return success
        except Exception as e:
            self.log_test("Backtesting", False, str(e))
            return False

    def test_ml_training_start(self):
        """Test ML model training initiation"""
        try:
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')  # 2 years for ML
            
            payload = {
                "symbols": ["AAPL", "MSFT"],
                "asset_type": "stock",
                "start_date": start_date,
                "end_date": end_date
            }
            response = requests.post(f"{self.api_url}/models/train", json=payload, timeout=30)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                success = 'task_id' in data and 'status' in data
                details += f", Task ID: {data.get('task_id', 'N/A')}"
                
                # Test status endpoint
                if success and data.get('task_id'):
                    task_id = data['task_id']
                    time.sleep(2)  # Wait a bit
                    status_response = requests.get(f"{self.api_url}/models/status/{task_id}", timeout=10)
                    if status_response.status_code == 200:
                        status_data = status_response.json()
                        details += f", Status: {status_data.get('status', 'unknown')}"
            
            self.log_test("ML Training Start", success, details)
            return success
        except Exception as e:
            self.log_test("ML Training Start", False, str(e))
            return False

    def test_portfolio_history(self):
        """Test portfolio history retrieval"""
        try:
            response = requests.get(f"{self.api_url}/portfolio/history", timeout=10)
            success = response.status_code == 200
            details = f"Status: {response.status_code}"
            
            if success:
                data = response.json()
                success = 'history' in data
                history = data.get('history', [])
                details += f", History items: {len(history)}"
            
            self.log_test("Portfolio History", success, details)
            return success
        except Exception as e:
            self.log_test("Portfolio History", False, str(e))
            return False

    def test_rebalance_frequencies(self):
        """Test all rebalance frequency options"""
        frequencies = ['daily', 'weekly', 'on-demand']
        all_success = True
        
        for freq in frequencies:
            try:
                end_date = datetime.now().strftime('%Y-%m-%d')
                start_date = (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d')
                
                payload = {
                    "symbols": ["AAPL", "MSFT"],
                    "asset_type": "stock",
                    "risk_tolerance": 0.5,
                    "start_date": start_date,
                    "end_date": end_date,
                    "rebalance_freq": freq
                }
                response = requests.post(f"{self.api_url}/optimize", json=payload, timeout=60)
                success = response.status_code == 200
                details = f"Status: {response.status_code}, Frequency: {freq}"
                
                self.log_test(f"Rebalance Frequency - {freq}", success, details)
                if not success:
                    all_success = False
                    
            except Exception as e:
                self.log_test(f"Rebalance Frequency - {freq}", False, str(e))
                all_success = False
        
        return all_success

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Portfolio Optimizer Backend Tests")
        print("=" * 60)
        
        # Test basic connectivity first
        if not self.test_api_health():
            print("❌ API is not accessible. Stopping tests.")
            return False
        
        # Run all tests
        tests = [
            self.test_asset_search_stocks,
            self.test_asset_search_crypto,
            self.test_data_fetch,
            self.test_portfolio_optimization,
            self.test_backtesting,
            self.test_ml_training_start,
            self.test_portfolio_history,
            self.test_rebalance_frequencies
        ]
        
        for test in tests:
            try:
                test()
                time.sleep(1)  # Brief pause between tests
            except Exception as e:
                print(f"❌ Test {test.__name__} crashed: {e}")
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Save detailed results
        results = {
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "total_tests": self.tests_run,
                "passed_tests": self.tests_passed,
                "success_rate": success_rate
            },
            "test_results": self.test_results
        }
        
        with open('/app/backend_test_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = PortfolioOptimizerTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)