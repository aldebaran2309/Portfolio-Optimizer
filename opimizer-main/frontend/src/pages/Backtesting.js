import React, { useState } from 'react';
import axios from 'axios';
import { LineChart, TrendingUp, Loader, BarChart3, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Backtesting = () => {
  const [assetType, setAssetType] = useState('stock');
  const [symbols, setSymbols] = useState('AAPL,MSFT,GOOGL');
  const [weights, setWeights] = useState('0.33,0.33,0.34');
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  const handleRunBacktest = async () => {
    const symbolList = symbols.split(',').map(s => s.trim()).filter(s => s);
    const weightList = weights.split(',').map(w => parseFloat(w.trim())).filter(w => !isNaN(w));
    
    if (symbolList.length === 0) {
      toast.error('Enter at least one symbol');
      return;
    }
    
    if (symbolList.length !== weightList.length) {
      toast.error('Number of symbols must match number of weights');
      return;
    }
    
    const weightSum = weightList.reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1) > 0.01) {
      toast.error('Weights must sum to 1.0');
      return;
    }

    const weightsObj = {};
    symbolList.forEach((symbol, idx) => {
      weightsObj[symbol] = weightList[idx];
    });

    setRunning(true);
    try {
      const response = await axios.post(`${API}/backtest`, {
        symbols: symbolList,
        asset_type: assetType,
        weights: weightsObj,
        start_date: startDate,
        end_date: endDate
      });
      
      setResults(response.data);
      toast.success('Backtest completed!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Backtest failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center gap-3 mb-8">
          <BarChart3 className="w-12 h-12 text-electric-indigo" />
          <h1 className="text-5xl font-black tracking-tighter">BACKTESTING</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1">
            <div className="glass rounded-md p-6">
              <h2 className="text-2xl font-bold mb-6">Backtest Config</h2>

              <div className="space-y-4">
                {/* Asset Type */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Asset Type</label>
                  <div className="flex gap-2">
                    <button
                      data-testid="backtest-asset-type-stock"
                      onClick={() => setAssetType('stock')}
                      className={`flex-1 px-4 py-2 rounded-sm font-bold transition-colors ${
                        assetType === 'stock'
                          ? 'bg-electric-indigo text-white'
                          : 'bg-gunmetal border border-white/10 text-slate-400'
                      }`}
                    >
                      Stocks
                    </button>
                    <button
                      data-testid="backtest-asset-type-crypto"
                      onClick={() => setAssetType('crypto')}
                      className={`flex-1 px-4 py-2 rounded-sm font-bold transition-colors ${
                        assetType === 'crypto'
                          ? 'bg-electric-indigo text-white'
                          : 'bg-gunmetal border border-white/10 text-slate-400'
                      }`}
                    >
                      Crypto
                    </button>
                  </div>
                </div>

                {/* Symbols */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Symbols (comma-separated)</label>
                  <input
                    data-testid="backtest-symbols"
                    type="text"
                    value={symbols}
                    onChange={(e) => setSymbols(e.target.value)}
                    placeholder="AAPL,MSFT,GOOGL"
                    className="w-full px-4 py-2 bg-gunmetal border border-white/10 focus:border-electric-indigo text-white rounded-sm outline-none"
                  />
                </div>

                {/* Weights */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Weights (must sum to 1.0)</label>
                  <input
                    data-testid="backtest-weights"
                    type="text"
                    value={weights}
                    onChange={(e) => setWeights(e.target.value)}
                    placeholder="0.33,0.33,0.34"
                    className="w-full px-4 py-2 bg-gunmetal border border-white/10 focus:border-electric-indigo text-white rounded-sm outline-none"
                  />
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Start Date</label>
                  <input
                    data-testid="backtest-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-gunmetal border border-white/10 text-white rounded-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">End Date</label>
                  <input
                    data-testid="backtest-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 bg-gunmetal border border-white/10 text-white rounded-sm outline-none"
                  />
                </div>

                {/* Run Button */}
                <button
                  data-testid="run-backtest-button"
                  onClick={handleRunBacktest}
                  disabled={running}
                  className="w-full px-6 py-3 bg-electric-indigo text-white font-bold rounded-sm hover:bg-electric-indigo/90 glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {running ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Activity className="w-5 h-5" />
                      Run Backtest
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2">
            {results ? (
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="glass rounded-md p-6">
                  <h2 className="text-2xl font-bold mb-6">Performance Metrics</h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard
                      icon={TrendingUp}
                      label="CAGR"
                      value={`${(results.cagr * 100).toFixed(2)}%`}
                      color="text-neon-mint"
                    />
                    <MetricCard
                      icon={Activity}
                      label="Sharpe Ratio"
                      value={results.sharpe_ratio.toFixed(2)}
                      color="text-electric-indigo"
                    />
                    <MetricCard
                      icon={LineChart}
                      label="Volatility"
                      value={`${(results.volatility * 100).toFixed(2)}%`}
                      color="text-amber-400"
                    />
                    <MetricCard
                      icon={BarChart3}
                      label="Max Drawdown"
                      value={`${(results.max_drawdown * 100).toFixed(2)}%`}
                      color="text-red-400"
                    />
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass rounded-md p-6">
                    <h3 className="text-xl font-bold mb-4">Additional Metrics</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Return</span>
                        <span className="font-bold text-white">{(results.total_return * 100).toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sortino Ratio</span>
                        <span className="font-bold text-white">{results.sortino_ratio.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Win Rate</span>
                        <span className="font-bold text-white">{(results.win_rate * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Best Day</span>
                        <span className="font-bold text-neon-mint">{(results.best_day * 100).toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Worst Day</span>
                        <span className="font-bold text-red-400">{(results.worst_day * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="glass rounded-md p-6">
                    <h3 className="text-xl font-bold mb-4">Portfolio Weights</h3>
                    <div className="space-y-2">
                      {symbols.split(',').map((symbol, idx) => {
                        const weight = weights.split(',')[idx];
                        return (
                          <div key={symbol} className="flex items-center gap-3">
                            <span className="font-mono text-sm text-emerald-400 w-20">{symbol.trim()}</span>
                            <div className="flex-1 bg-gunmetal rounded-full h-6 overflow-hidden">
                              <div
                                className="h-full bg-electric-indigo flex items-center justify-end pr-2"
                                style={{ width: `${parseFloat(weight) * 100}%` }}
                              >
                                <span className="text-xs font-bold text-white">
                                  {(parseFloat(weight) * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Cumulative Returns Chart */}
                <div className="glass rounded-md p-6">
                  <h3 className="text-xl font-bold mb-6">Cumulative Returns</h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLine data={results.cumulative_returns} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="date"
                          stroke="#94A3B8"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                        />
                        <YAxis
                          stroke="#94A3B8"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => value.toFixed(2)}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '8px'
                          }}
                          labelStyle={{ color: '#94A3B8' }}
                          itemStyle={{ color: '#10B981' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#10B981"
                          strokeWidth={2}
                          dot={false}
                        />
                      </RechartsLine>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass rounded-md p-12 text-center">
                <BarChart3 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Configure backtest parameters and run to see results</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ icon: Icon, label, value, color }) => (
  <div className="p-4 bg-charcoal/50 border border-white/5 rounded-sm">
    <Icon className={`w-6 h-6 ${color} mb-2`} />
    <p className="text-xs text-slate-500 mb-1">{label}</p>
    <p className={`text-xl font-black ${color}`}>{value}</p>
  </div>
);

export default Backtesting;
