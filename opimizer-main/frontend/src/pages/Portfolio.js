import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, PieChart, Sparkles, X, Search, FolderPlus, Folder } from 'lucide-react';
import { LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Portfolio = () => {
  const { user, token, isGuest } = useAuth();
  const navigate = useNavigate();
  
  const [holdings, setHoldings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Multiple portfolios
  const [portfolios, setPortfolios] = useState([]);
  const [currentPortfolio, setCurrentPortfolio] = useState(null);
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  
  // Value history
  const [valueHistory, setValueHistory] = useState([]);
  const [historyDays, setHistoryDays] = useState(30);
  
  // Add holding form
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [newHolding, setNewHolding] = useState({
    symbol: '',
    asset_type: 'stock',
    quantity: '',
    purchase_price: '',
    purchase_date: ''
  });

  useEffect(() => {
    if (isGuest) {
      toast.error('Please sign up to manage your portfolio');
      navigate('/auth');
      return;
    }
    if (!token) {
      navigate('/auth');
      return;
    }
    fetchPortfolios();
  }, [token, isGuest]);

  useEffect(() => {
    if (currentPortfolio) {
      fetchHoldings();
      fetchValueHistory();
    }
  }, [currentPortfolio]);

  const fetchPortfolios = async () => {
    try {
      const response = await axios.get(`${API}/portfolios/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const portfoliosList = response.data.portfolios || [];
      setPortfolios(portfoliosList);
      
      // Set current to default or first
      const defaultPortfolio = portfoliosList.find(p => p.is_default) || portfoliosList[0];
      if (defaultPortfolio) {
        setCurrentPortfolio(defaultPortfolio);
      }
    } catch (error) {
      console.error('Error fetching portfolios:', error);
    }
  };

  const fetchValueHistory = async () => {
    if (!currentPortfolio) return;
    try {
      const response = await axios.get(
        `${API}/portfolio/value-history?days=${historyDays}&portfolio_id=${currentPortfolio.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setValueHistory(response.data.history || []);
    } catch (error) {
      console.error('Error fetching value history:', error);
    }
  };

  useEffect(() => {
    if (searchQuery.length >= 1) {
      const timer = setTimeout(() => {
        searchAssets();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchAssets = async () => {
    try {
      const response = await axios.post(`${API}/assets/search`, {
        query: searchQuery,
        asset_type: newHolding.asset_type
      });
      setSearchResults(response.data.assets || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const selectAsset = (asset) => {
    setSelectedAsset(asset);
    setNewHolding({ ...newHolding, symbol: asset.symbol, asset_type: asset.type });
    setSearchQuery('');
    setSearchResults([]);
  };

  const fetchHoldings = async () => {
    if (!currentPortfolio) return;
    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/portfolio/holdings?portfolio_id=${currentPortfolio.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHoldings(response.data.holdings || []);
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Error fetching holdings:', error);
      toast.error('Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortfolio = async () => {
    if (!newPortfolioName.trim()) {
      toast.error('Please enter a portfolio name');
      return;
    }

    try {
      await axios.post(
        `${API}/portfolios/`,
        { name: newPortfolioName, description: '', is_default: false },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Portfolio created!');
      setShowPortfolioModal(false);
      setNewPortfolioName('');
      fetchPortfolios();
    } catch (error) {
      toast.error('Failed to create portfolio');
    }
  };

  const handleAddHolding = async () => {
    if (!selectedAsset || !newHolding.quantity) {
      toast.error('Please select an asset and enter quantity');
      return;
    }

    try {
      await axios.post(
        `${API}/portfolio/holdings`,
        {
          symbol: newHolding.symbol,
          asset_type: newHolding.asset_type,
          quantity: parseFloat(newHolding.quantity),
          purchase_price: newHolding.purchase_price ? parseFloat(newHolding.purchase_price) : null,
          purchase_date: newHolding.purchase_date || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Holding added successfully');
      setShowAddModal(false);
      setSelectedAsset(null);
      setNewHolding({
        symbol: '',
        asset_type: 'stock',
        quantity: '',
        purchase_price: '',
        purchase_date: ''
      });
      fetchHoldings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add holding');
    }
  };

  const handleDeleteHolding = async (holdingId) => {
    try {
      await axios.delete(`${API}/portfolio/holdings/${holdingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Holding deleted');
      fetchHoldings();
    } catch (error) {
      toast.error('Failed to delete holding');
    }
  };

  const handleAnalyze = async () => {
    if (holdings.length < 2) {
      toast.error('Need at least 2 holdings for analysis');
      return;
    }

    setAnalyzing(true);
    try {
      const response = await axios.post(
        `${API}/portfolio/analyze`,
        {
          start_date: '2022-01-01',
          end_date: new Date().toISOString().split('T')[0]
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAnalysis(response.data);
      toast.success('Portfolio analyzed!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian">
        <div className="animate-spin w-12 h-12 border-4 border-electric-indigo border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-obsidian">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-5xl font-black tracking-tighter mb-2">MY PORTFOLIO</h1>
              <p className="text-slate-400">Track holdings and get AI-powered recommendations</p>
            </div>
            
            {/* Portfolio Switcher */}
            {portfolios.length > 0 && (
              <div className="ml-8">
                <Select
                  value={currentPortfolio?.id}
                  onValueChange={(val) => {
                    const selected = portfolios.find(p => p.id === val);
                    setCurrentPortfolio(selected);
                  }}
                >
                  <SelectTrigger className="bg-gunmetal border-white/10 text-white w-64">
                    <div className="flex items-center gap-2">
                      <Folder className="w-4 h-4" />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {portfolios.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.is_default && '(Default)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              data-testid="create-portfolio-button"
              onClick={() => setShowPortfolioModal(true)}
              className="bg-gunmetal hover:bg-gunmetal/80 border border-white/10 flex items-center gap-2"
            >
              <FolderPlus className="w-5 h-5" />
              New Portfolio
            </Button>
            <Button
              data-testid="add-holding-button"
              onClick={() => setShowAddModal(true)}
              className="bg-electric-indigo hover:bg-electric-indigo/90 glow flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Holding
            </Button>
          </div>
        </div>

        {/* Portfolio Summary */}
        {summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="glass">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="w-6 h-6 text-neon-mint" />
                    <p className="text-sm text-slate-400">Total Value</p>
                  </div>
                  <p className="text-3xl font-black text-white">
                    ${summary.total_value.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    {summary.total_gain_loss >= 0 ? (
                      <TrendingUp className="w-6 h-6 text-neon-mint" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    )}
                    <p className="text-sm text-slate-400">Total Gain/Loss</p>
                  </div>
                  <p className={`text-3xl font-black ${summary.total_gain_loss >= 0 ? 'text-neon-mint' : 'text-red-400'}`}>
                    ${Math.abs(summary.total_gain_loss).toFixed(2)}
                  </p>
                  <p className={`text-sm ${summary.total_gain_loss >= 0 ? 'text-neon-mint' : 'text-red-400'}`}>
                    {summary.total_gain_loss >= 0 ? '+' : '-'}{Math.abs(summary.total_gain_loss_percent).toFixed(2)}%
                  </p>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <PieChart className="w-6 h-6 text-electric-indigo" />
                    <p className="text-sm text-slate-400">Investment</p>
                  </div>
                  <p className="text-3xl font-black text-white">
                    ${summary.total_investment.toFixed(2)}
                  </p>
                </CardContent>
              </Card>

              <Card className="glass">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Sparkles className="w-6 h-6 text-amber-400" />
                    <p className="text-sm text-slate-400">Holdings</p>
                  </div>
                  <p className="text-3xl font-black text-white">
                    {summary.holdings_count}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Value History Chart */}
            {valueHistory.length > 0 && (
              <Card className="glass mb-8">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Portfolio Value History</CardTitle>
                    <Select
                      value={historyDays.toString()}
                      onValueChange={(val) => {
                        setHistoryDays(parseInt(val));
                        setTimeout(() => fetchValueHistory(), 100);
                      }}
                    >
                      <SelectTrigger className="bg-gunmetal border-white/10 text-white w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 Days</SelectItem>
                        <SelectItem value="30">30 Days</SelectItem>
                        <SelectItem value="90">90 Days</SelectItem>
                        <SelectItem value="365">1 Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={valueHistory} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="date"
                          stroke="#94A3B8"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getMonth() + 1}/${date.getDate()}`;
                          }}
                        />
                        <YAxis
                          stroke="#94A3B8"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => `$${value.toFixed(0)}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '8px'
                          }}
                          labelStyle={{ color: '#94A3B8' }}
                          formatter={(value) => [`$${value.toFixed(2)}`, 'Value']}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#10B981"
                          strokeWidth={2}
                          fill="url(#colorValue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Holdings List */}
        <Card className="glass mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your Holdings</span>
              {holdings.length >= 2 && (
                <Button
                  data-testid="analyze-button"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="bg-neon-mint text-black hover:bg-neon-mint/90 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {analyzing ? 'Analyzing...' : 'Get AI Recommendations'}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {holdings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 mb-4">No holdings yet. Add your first investment!</p>
                <Button
                  onClick={() => setShowAddModal(true)}
                  className="bg-electric-indigo hover:bg-electric-indigo/90"
                >
                  Add Holding
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {holdings.map((holding) => (
                  <div
                    key={holding.id}
                    data-testid={`holding-${holding.symbol}`}
                    className="p-4 bg-charcoal/50 border border-white/5 rounded-sm hover:border-electric-indigo/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-white">{holding.symbol}</h3>
                          <span className="text-xs px-2 py-1 bg-electric-indigo/20 text-electric-indigo rounded">
                            {holding.asset_type}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500">Quantity</p>
                            <p className="font-bold text-white">{holding.quantity}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Current Price</p>
                            <p className="font-bold text-white">${holding.current_price?.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Current Value</p>
                            <p className="font-bold text-white">${holding.current_value?.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Purchase Price</p>
                            <p className="font-bold text-white">${holding.purchase_price?.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Gain/Loss</p>
                            <p className={`font-bold ${holding.gain_loss >= 0 ? 'text-neon-mint' : 'text-red-400'}`}>
                              ${Math.abs(holding.gain_loss).toFixed(2)} ({holding.gain_loss >= 0 ? '+' : '-'}{Math.abs(holding.gain_loss_percent).toFixed(2)}%)
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteHolding(holding.id)}
                        className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-6">
            <Card className="glass border-2 border-neon-mint">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-neon-mint" />
                  AI-Powered Portfolio Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current vs Optimized */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-charcoal/50 rounded-sm">
                    <h3 className="text-lg font-bold mb-4">Current Portfolio</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Annual Return:</span>
                        <span className="font-bold text-white">
                          {(analysis.current_portfolio.annualized_return * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Risk (Volatility):</span>
                        <span className="font-bold text-white">
                          {(analysis.current_portfolio.annualized_risk * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sharpe Ratio:</span>
                        <span className="font-bold text-white">
                          {analysis.current_portfolio.sharpe_ratio.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-neon-mint/10 border border-neon-mint/30 rounded-sm">
                    <h3 className="text-lg font-bold mb-4 text-neon-mint">Optimized Portfolio</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Annual Return:</span>
                        <span className="font-bold text-neon-mint">
                          {(analysis.optimized_portfolio.annualized_return * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Risk (Volatility):</span>
                        <span className="font-bold text-neon-mint">
                          {(analysis.optimized_portfolio.annualized_risk * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sharpe Ratio:</span>
                        <span className="font-bold text-neon-mint">
                          {analysis.optimized_portfolio.sharpe_ratio.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                {analysis.recommendations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold mb-4">Rebalancing Recommendations</h3>
                    <div className="space-y-3">
                      {analysis.recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-charcoal/50 border border-white/5 rounded-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-lg font-bold text-emerald-400">
                                {rec.symbol}
                              </span>
                              <span className={`px-3 py-1 rounded text-sm font-bold ${
                                rec.action === 'Increase'
                                  ? 'bg-neon-mint/20 text-neon-mint'
                                  : 'bg-amber-400/20 text-amber-400'
                              }`}>
                                {rec.action}
                              </span>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-slate-400">
                                Current: {rec.current_weight.toFixed(1)}% → Optimal: {rec.optimal_weight.toFixed(1)}%
                              </p>
                              <p className="font-bold text-white">
                                Adjust by {rec.difference.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Potential Improvement */}
                <div className="p-4 bg-electric-indigo/10 border border-electric-indigo/30 rounded-sm">
                  <h3 className="text-lg font-bold mb-3">Potential Improvement</h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400 mb-1">Return Increase</p>
                      <p className="text-2xl font-black text-neon-mint">
                        +{(analysis.potential_improvement.return_increase * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Risk Change</p>
                      <p className="text-2xl font-black text-white">
                        {(analysis.potential_improvement.risk_change * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Sharpe Improvement</p>
                      <p className="text-2xl font-black text-electric-indigo">
                        +{analysis.potential_improvement.sharpe_improvement.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Holding Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="glass w-full max-w-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Add Holding</CardTitle>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setSelectedAsset(null);
                      setSearchQuery('');
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Asset Type */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Asset Type</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewHolding({ ...newHolding, asset_type: 'stock' })}
                      className={`flex-1 px-4 py-2 rounded-sm font-bold transition-colors ${
                        newHolding.asset_type === 'stock'
                          ? 'bg-electric-indigo text-white'
                          : 'bg-gunmetal border border-white/10 text-slate-400'
                      }`}
                    >
                      Stock
                    </button>
                    <button
                      onClick={() => setNewHolding({ ...newHolding, asset_type: 'crypto' })}
                      className={`flex-1 px-4 py-2 rounded-sm font-bold transition-colors ${
                        newHolding.asset_type === 'crypto'
                          ? 'bg-electric-indigo text-white'
                          : 'bg-gunmetal border border-white/10 text-slate-400'
                      }`}
                    >
                      Crypto
                    </button>
                  </div>
                </div>

                {/* Search Asset */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Search Asset</label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={selectedAsset ? selectedAsset.name : searchQuery}
                      onChange={(e) => {
                        if (!selectedAsset) {
                          setSearchQuery(e.target.value);
                        }
                      }}
                      placeholder="Type to search..."
                      disabled={!!selectedAsset}
                      className="bg-gunmetal border-white/10 text-white"
                    />
                    {selectedAsset && (
                      <button
                        onClick={() => setSelectedAsset(null)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {searchResults.length > 0 && !selectedAsset && (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {searchResults.map((asset) => (
                        <button
                          key={asset.symbol}
                          onClick={() => selectAsset(asset)}
                          className="w-full p-2 text-left bg-charcoal/50 hover:bg-charcoal rounded-sm"
                        >
                          <p className="font-bold text-white">{asset.symbol}</p>
                          <p className="text-xs text-slate-400">{asset.name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Quantity</label>
                  <Input
                    type="number"
                    value={newHolding.quantity}
                    onChange={(e) => setNewHolding({ ...newHolding, quantity: e.target.value })}
                    placeholder="10"
                    step="0.01"
                    className="bg-gunmetal border-white/10 text-white"
                  />
                </div>

                {/* Purchase Price (Optional) */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    Purchase Price (Optional)
                  </label>
                  <Input
                    type="number"
                    value={newHolding.purchase_price}
                    onChange={(e) => setNewHolding({ ...newHolding, purchase_price: e.target.value })}
                    placeholder="150.00"
                    step="0.01"
                    className="bg-gunmetal border-white/10 text-white"
                  />
                </div>

                {/* Purchase Date (Optional) */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    Purchase Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={newHolding.purchase_date}
                    onChange={(e) => setNewHolding({ ...newHolding, purchase_date: e.target.value })}
                    className="bg-gunmetal border-white/10 text-white"
                  />
                </div>

                <Button
                  onClick={handleAddHolding}
                  disabled={!selectedAsset || !newHolding.quantity}
                  className="w-full bg-electric-indigo hover:bg-electric-indigo/90 glow"
                >
                  Add Holding
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Create Portfolio Modal */}
        {showPortfolioModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="glass w-full max-w-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Create Portfolio</CardTitle>
                  <button
                    onClick={() => setShowPortfolioModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Portfolio Name</label>
                  <Input
                    type="text"
                    value={newPortfolioName}
                    onChange={(e) => setNewPortfolioName(e.target.value)}
                    placeholder="e.g., Growth Portfolio, Dividend Stocks"
                    className="bg-gunmetal border-white/10 text-white"
                  />
                </div>

                <Button
                  onClick={handleCreatePortfolio}
                  className="w-full bg-electric-indigo hover:bg-electric-indigo/90 glow"
                >
                  Create Portfolio
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Portfolio;
