import React, { useState } from 'react';
import axios from 'axios';
import { Brain, Play, CheckCircle, Loader, AlertCircle, Plus, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ModelTraining = () => {
  const [assetType, setAssetType] = useState('stock');
  const [symbols, setSymbols] = useState('AAPL,MSFT,GOOGL');
  const [selectedAssets, setSelectedAssets] = useState([
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corporation' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' }
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [training, setTraining] = useState(false);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState(null);

  const handleSearch = React.useCallback(async () => {
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
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, assetType]);

  React.useEffect(() => {
    if (searchQuery.length >= 1) {
      const timer = setTimeout(() => {
        handleSearch();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, assetType, handleSearch]);

  const addAsset = (asset) => {
    if (!selectedAssets.find(a => a.symbol === asset.symbol)) {
      const newAssets = [...selectedAssets, asset];
      setSelectedAssets(newAssets);
      setSymbols(newAssets.map(a => a.symbol).join(','));
      toast.success(`Added ${asset.symbol}`);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeAsset = (symbol) => {
    const newAssets = selectedAssets.filter(a => a.symbol !== symbol);
    setSelectedAssets(newAssets);
    setSymbols(newAssets.map(a => a.symbol).join(','));
  };

  const handleStartTraining = async () => {
    if (selectedAssets.length === 0) {
      toast.error('Please select at least one asset');
      return;
    }

    setTraining(true);
    setResults(null);
    try {
      const symbolList = selectedAssets.map(a => a.symbol);
      const response = await axios.post(`${API}/models/train`, {
        symbols: symbolList,
        asset_type: assetType,
        start_date: startDate,
        end_date: endDate
      });
      
      const newTaskId = response.data.task_id;
      setTaskId(newTaskId);
      toast.success('Training started!');
      
      pollTrainingStatus(newTaskId);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start training');
      setTraining(false);
    }
  };

  const pollTrainingStatus = async (id) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`${API}/models/status/${id}`);
        const data = response.data;
        setStatus(data);

        if (data.status === 'completed') {
          clearInterval(interval);
          setResults(data.results);
          setTraining(false);
          toast.success('Training completed!');
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setTraining(false);
          toast.error(data.error || 'Training failed');
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen p-8 bg-obsidian">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center gap-3 mb-8">
          <Brain className="w-12 h-12 text-electric-indigo" />
          <h1 className="text-5xl font-black tracking-tighter">ML MODEL TRAINING</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Asset Selection Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Asset Search */}
            <div className="glass rounded-md p-6">
              <h2 className="text-2xl font-bold mb-4">Select Assets for Training</h2>
              
              <div className="flex gap-2 mb-4">
                <button
                  data-testid="train-asset-type-stock"
                  onClick={() => {
                    setAssetType('stock');
                    setSelectedAssets([]);
                    setSymbols('');
                  }}
                  className={`px-6 py-2 rounded-sm font-bold transition-colors ${
                    assetType === 'stock'
                      ? 'bg-electric-indigo text-white'
                      : 'bg-gunmetal border border-white/10 text-slate-400'
                  }`}
                >
                  Stocks
                </button>
                <button
                  data-testid="train-asset-type-crypto"
                  onClick={() => {
                    setAssetType('crypto');
                    setSelectedAssets([]);
                    setSymbols('');
                  }}
                  className={`px-6 py-2 rounded-sm font-bold transition-colors ${
                    assetType === 'crypto'
                      ? 'bg-electric-indigo text-white'
                      : 'bg-gunmetal border border-white/10 text-slate-400'
                  }`}
                >
                  Crypto
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Search & Add Assets
                </label>
                <div className="relative">
                  <Input
                    data-testid="asset-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${assetType === 'stock' ? 'stocks' : 'crypto'} (e.g., ${assetType === 'stock' ? 'AAPL, Tesla' : 'Bitcoin, ETH'})...`}
                    className="bg-gunmetal border-white/10 focus:border-electric-indigo text-white placeholder:text-white/30 pr-10"
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                </div>
                
                {searching && (
                  <p className="text-sm text-slate-400 mt-2">Searching across entire market...</p>
                )}

                {searchResults.length > 0 && (
                  <div className="mt-2 max-h-64 overflow-y-auto space-y-2 border border-white/10 rounded-sm p-2 bg-charcoal/50">
                    <p className="text-xs text-slate-500 px-2 py-1">
                      Found {searchResults.length} result(s)
                    </p>
                    {searchResults.map((asset) => (
                      <button
                        key={asset.symbol}
                        onClick={() => addAsset(asset)}
                        className="w-full p-3 text-left bg-gunmetal hover:bg-gunmetal/70 border border-white/5 hover:border-electric-indigo/50 rounded-sm transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-white">{asset.symbol}</p>
                          <p className="text-sm text-slate-400">{asset.name}</p>
                        </div>
                        <Plus className="w-5 h-5 text-neon-mint" />
                      </button>
                    ))}
                  </div>
                )}

                {!searching && searchQuery && searchResults.length === 0 && (
                  <p className="text-sm text-slate-400 mt-2">
                    No results found. Try different keywords.
                  </p>
                )}
              </div>

              {/* Selected Assets */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">
                  Selected Assets ({selectedAssets.length})
                </label>
                {selectedAssets.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-white/10 rounded-sm text-center">
                    <p className="text-slate-400">No assets selected. Search and add assets above.</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedAssets.map((asset) => (
                      <div
                        key={asset.symbol}
                        data-testid={`selected-${asset.symbol}`}
                        className="flex items-center gap-2 px-4 py-2 bg-electric-indigo/20 border border-electric-indigo/30 rounded-sm"
                      >
                        <div>
                          <p className="font-mono text-sm font-bold text-white">{asset.symbol}</p>
                          <p className="text-xs text-slate-400">{asset.name}</p>
                        </div>
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
          </div>

          {/* Configuration Panel */}
          <div className="space-y-6">
            <div className="glass rounded-md p-6">
              <h2 className="text-2xl font-bold mb-6">Training Config</h2>

              <div className="space-y-4">
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Start Date</label>
                  <Input
                    data-testid="training-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-gunmetal border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">End Date</label>
                  <Input
                    data-testid="training-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-gunmetal border-white/10 text-white"
                  />
                </div>

                {/* Train Button */}
                <Button
                  data-testid="start-training-button"
                  onClick={handleStartTraining}
                  disabled={training || selectedAssets.length === 0}
                  className="w-full px-6 py-3 bg-electric-indigo text-white font-bold rounded-sm hover:bg-electric-indigo/90 glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {training ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Training...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Start Training
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Models Info */}
            <div className="glass rounded-md p-6">
              <h3 className="text-lg font-bold mb-4">Models to Train</h3>
              <div className="space-y-2 text-sm">
                {[
                  'Linear Regression',
                  'Ridge Regression',
                  'Lasso Regression',
                  'Elastic Net',
                  'Random Forest',
                  'Gradient Boosting',
                  'XGBoost'
                ].map((model) => (
                  <div key={model} className="flex items-center gap-2 text-slate-300">
                    <div className="w-2 h-2 rounded-full bg-electric-indigo" />
                    {model}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            {training && status && (
              <div className="glass rounded-md p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Training Progress</h2>
                  <span className="text-sm font-mono text-neon-mint">{status.progress}%</span>
                </div>
                
                <div className="w-full bg-gunmetal rounded-full h-4 overflow-hidden mb-4">
                  <div
                    className="h-full bg-gradient-to-r from-electric-indigo to-neon-mint transition-all duration-500"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>

                {status.current_model && (
                  <p className="text-sm text-slate-400">
                    Current: <span className="text-white font-bold">{status.current_model}</span>
                  </p>
                )}
              </div>
            )}

            {results && (
              <div className="space-y-6">
                {/* Best Model */}
                <div className="glass rounded-md p-6 border-2 border-electric-indigo">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-8 h-8 text-neon-mint" />
                    <div>
                      <h2 className="text-2xl font-bold">Best Model</h2>
                      <p className="text-lg text-electric-indigo font-bold">{results.best_model?.name}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <MetricCard
                      label="Test R²"
                      value={(results.best_model?.metrics?.test_r2 || 0).toFixed(4)}
                      color="text-neon-mint"
                    />
                    <MetricCard
                      label="Test MSE"
                      value={(results.best_model?.metrics?.test_mse || 0).toFixed(6)}
                      color="text-amber-400"
                    />
                    <MetricCard
                      label="Test MAE"
                      value={(results.best_model?.metrics?.test_mae || 0).toFixed(6)}
                      color="text-blue-400"
                    />
                  </div>
                </div>

                {/* All Models Comparison */}
                <div className="glass rounded-md p-6">
                  <h2 className="text-2xl font-bold mb-6">Model Comparison</h2>
                  
                  <div className="space-y-4">
                    {Object.entries(results.models || {}).sort((a, b) => b[1].test_r2 - a[1].test_r2).map(([name, metrics]) => (
                      <div
                        key={name}
                        data-testid={`model-result-${name.toLowerCase().replace(/\s+/g, '-')}`}
                        className="p-4 bg-charcoal/50 border border-white/5 rounded-sm hover:border-electric-indigo/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-white">{name}</h3>
                          {name === results.best_model?.name && (
                            <span className="px-3 py-1 bg-neon-mint/20 text-neon-mint text-xs font-bold rounded-sm">
                              BEST
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500">Test R²</p>
                            <p className="font-mono text-white">{(metrics.test_r2 || 0).toFixed(4)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Test MSE</p>
                            <p className="font-mono text-white">{(metrics.test_mse || 0).toFixed(6)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Test MAE</p>
                            <p className="font-mono text-white">{(metrics.test_mae || 0).toFixed(6)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Training Info */}
                <div className="glass rounded-md p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-300">
                      <p><span className="font-bold">Symbols:</span> {results.symbols?.join(', ')}</p>
                      <p><span className="font-bold">Date Range:</span> {results.date_range}</p>
                      <p><span className="font-bold">Data Points:</span> {results.data_points}</p>
                      <p><span className="font-bold">Results saved to:</span> <span className="font-mono text-emerald-400">/app/model_comparison_results.json</span></p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!training && !results && (
              <div className="glass rounded-md p-12 text-center">
                <Brain className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Configure training parameters and start training to see results</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, color }) => (
  <div className="p-3 bg-gunmetal/50 rounded-sm">
    <p className="text-xs text-slate-500 mb-1">{label}</p>
    <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
  </div>
);

export default ModelTraining;
