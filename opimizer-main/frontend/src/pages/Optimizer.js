import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Plus, X, TrendingUp, Loader } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Optimizer = () => {
  const [assetType, setAssetType] = useState('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [popularAssets, setPopularAssets] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [riskTolerance, setRiskTolerance] = useState(0.5);
  const [rebalanceFreq, setRebalanceFreq] = useState('daily');
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [optimizing, setOptimizing] = useState(false);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchPopularAssets();
  }, [assetType]);

  useEffect(() => {
    if (searchQuery.length >= 1) {
      const timer = setTimeout(() => {
        handleSearch();
      }, 300); // Debounce search
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, assetType]);

  const fetchPopularAssets = async () => {
    try {
      const response = await axios.get(`${API}/assets/popular/${assetType}`);
      setPopularAssets(response.data.assets || []);
    } catch (error) {
      console.error('Error fetching popular assets:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await axios.post(`${API}/assets/search`, {
        query: searchQuery,
        asset_type: assetType
      });
      setSearchResults(response.data.assets || []);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const addAsset = (asset) => {
    if (!selectedAssets.find(a => a.symbol === asset.symbol)) {
      setSelectedAssets([...selectedAssets, asset]);
      toast.success(`Added ${asset.symbol}`);
    }
  };

  const removeAsset = (symbol) => {
    setSelectedAssets(selectedAssets.filter(a => a.symbol !== symbol));
  };

  const handleOptimize = async () => {
    if (selectedAssets.length < 2) {
      toast.error('Select at least 2 assets');
      return;
    }

    setOptimizing(true);
    try {
      const response = await axios.post(`${API}/optimize`, {
        symbols: selectedAssets.map(a => a.symbol),
        asset_type: assetType,
        start_date: startDate,
        end_date: endDate,
        risk_tolerance: riskTolerance,
        rebalance_freq: rebalanceFreq
      });
      setResults(response.data);
      toast.success('Optimization complete!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Optimization failed');
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="container mx-auto max-w-7xl">
        <h1 className="text-5xl font-black tracking-tighter mb-8">PORTFOLIO OPTIMIZER</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Asset Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Asset Type & Search */}
            <div className="glass rounded-md p-6">
              <h2 className="text-2xl font-bold mb-4">Select Assets</h2>
              
              <div className="flex gap-2 mb-4">
                <button
                  data-testid="asset-type-stock"
                  onClick={() => setAssetType('stock')}
                  className={`px-6 py-2 rounded-sm font-bold transition-colors ${
                    assetType === 'stock'
                      ? 'bg-electric-indigo text-white'
                      : 'bg-gunmetal border border-white/10 text-slate-400'
                  }`}
                >
                  Stocks
                </button>
                <button
                  data-testid="asset-type-crypto"
                  onClick={() => setAssetType('crypto')}
                  className={`px-6 py-2 rounded-sm font-bold transition-colors ${
                    assetType === 'crypto'
                      ? 'bg-electric-indigo text-white'
                      : 'bg-gunmetal border border-white/10 text-slate-400'
                  }`}
                >
                  Crypto
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  data-testid="asset-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to search (e.g., AAPL, Bitcoin)..."
                  className="flex-1 px-4 py-2 bg-gunmetal border border-white/10 focus:border-electric-indigo focus:ring-1 focus:ring-electric-indigo/50 text-white placeholder:text-white/20 rounded-sm outline-none"
                />
                {searching && (
                  <div className="px-4 py-2 text-slate-400">
                    Searching...
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-slate-500">Search Results:</p>
                  {searchResults.map((asset) => (
                    <div
                      key={asset.symbol}
                      className="flex items-center justify-between p-3 bg-charcoal/50 border border-white/5 rounded-sm hover:border-electric-indigo/50 transition-colors"
                    >
                      <div>
                        <p className="font-bold text-white">{asset.symbol}</p>
                        <p className="text-sm text-slate-400">{asset.name}</p>
                      </div>
                      <button
                        data-testid={`add-asset-${asset.symbol}`}
                        onClick={() => addAsset(asset)}
                        className="p-2 bg-neon-mint/20 text-neon-mint rounded-sm hover:bg-neon-mint/30 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Popular Examples */}
              {!searchQuery && popularAssets.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-slate-500">Popular {assetType === 'stock' ? 'Stocks' : 'Cryptocurrencies'}:</p>
                  {popularAssets.map((asset) => (
                    <div
                      key={asset.symbol}
                      className="flex items-center justify-between p-3 bg-charcoal/50 border border-white/5 rounded-sm hover:border-electric-indigo/50 transition-colors"
                    >
                      <div>
                        <p className="font-bold text-white">{asset.symbol}</p>
                        <p className="text-sm text-slate-400">{asset.name}</p>
                      </div>
                      <button
                        data-testid={`add-asset-${asset.symbol}`}
                        onClick={() => addAsset(asset)}
                        className="p-2 bg-neon-mint/20 text-neon-mint rounded-sm hover:bg-neon-mint/30 transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Assets */}
            <div className="glass rounded-md p-6">
              <h3 className="text-xl font-bold mb-4">Selected Assets ({selectedAssets.length})</h3>
              {selectedAssets.length === 0 ? (
                <p className="text-slate-400 text-center py-8">No assets selected</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedAssets.map((asset) => (
                    <div
                      key={asset.symbol}
                      data-testid={`selected-asset-${asset.symbol}`}
                      className="flex items-center gap-2 px-4 py-2 bg-electric-indigo/20 border border-electric-indigo/30 rounded-sm"
                    >
                      <span className="font-mono text-sm text-white">{asset.symbol}</span>
                      <button
                        onClick={() => removeAsset(asset.symbol)}
                        className="text-white/60 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Configuration */}
          <div className="space-y-6">
            <div className="glass rounded-md p-6">
              <h2 className="text-2xl font-bold mb-6">Configuration</h2>

              <div className="space-y-4">
                {/* Risk Tolerance */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    Risk Tolerance: {riskTolerance.toFixed(2)}
                  </label>
                  <input
                    data-testid="risk-tolerance-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={riskTolerance}
                    onChange={(e) => setRiskTolerance(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gunmetal rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Conservative</span>
                    <span>Aggressive</span>
                  </div>
                </div>

                {/* Rebalance Frequency */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Rebalance Frequency</label>
                  <select
                    data-testid="rebalance-frequency"
                    value={rebalanceFreq}
                    onChange={(e) => setRebalanceFreq(e.target.value)}
                    className="w-full px-4 py-2 bg-gunmetal border border-white/10 text-white rounded-sm outline-none focus:border-electric-indigo"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="on-demand">On-Demand</option>
                  </select>
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Start Date</label>
                  <input
                    data-testid="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-gunmetal border border-white/10 text-white rounded-sm outline-none focus:border-electric-indigo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">End Date</label>
                  <input
                    data-testid="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 bg-gunmetal border border-white/10 text-white rounded-sm outline-none focus:border-electric-indigo"
                  />
                </div>

                {/* Optimize Button */}
                <button
                  data-testid="optimize-button"
                  onClick={handleOptimize}
                  disabled={optimizing || selectedAssets.length < 2}
                  className="w-full px-6 py-3 bg-electric-indigo text-white font-bold rounded-sm hover:bg-electric-indigo/90 glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {optimizing ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-5 h-5" />
                      Optimize Portfolio
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className="mt-8 glass rounded-md p-6">
            <h2 className="text-3xl font-bold mb-6">Optimization Results</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-charcoal/50 border border-white/5 rounded-sm">
                <p className="text-sm text-slate-400 mb-1">Expected Return</p>
                <p className="text-2xl font-black text-neon-mint">
                  {(results.annualized_return * 100).toFixed(2)}%
                </p>
              </div>
              <div className="p-4 bg-charcoal/50 border border-white/5 rounded-sm">
                <p className="text-sm text-slate-400 mb-1">Risk (Volatility)</p>
                <p className="text-2xl font-black text-amber-400">
                  {(results.annualized_risk * 100).toFixed(2)}%
                </p>
              </div>
              <div className="p-4 bg-charcoal/50 border border-white/5 rounded-sm">
                <p className="text-sm text-slate-400 mb-1">Sharpe Ratio</p>
                <p className="text-2xl font-black text-electric-indigo">
                  {results.annualized_sharpe.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-charcoal/50 border border-white/5 rounded-sm">
                <p className="text-sm text-slate-400 mb-1">Rebalance</p>
                <p className="text-lg font-bold text-white capitalize">
                  {rebalanceFreq}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold mb-4">Optimal Weights</h3>
              <div className="space-y-2">
                {Object.entries(results.weights).map(([symbol, weight]) => (
                  <div key={symbol} className="flex items-center gap-4">
                    <span className="font-mono text-sm text-emerald-400 w-24">{symbol}</span>
                    <div className="flex-1 bg-gunmetal rounded-full h-8 overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-electric-indigo to-neon-mint flex items-center justify-end pr-3"
                        style={{ width: `${weight * 100}%` }}
                      >
                        <span className="text-sm font-bold text-white">
                          {(weight * 100).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Optimizer;
