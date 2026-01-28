import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/portfolio/history`);
      setHistory(response.data.history || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="container mx-auto">
        {/* Hero Section */}
        <div className="relative mb-12 overflow-hidden rounded-md">
          <div className="absolute inset-0 bg-gradient-to-tr from-electric-indigo/20 via-transparent to-transparent" />
          <div className="relative p-12 glass">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none uppercase mb-4">
              Portfolio<br />Optimizer AI
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl">
              Advanced ML-powered portfolio optimization with 7 machine learning models, real-time market data, and sophisticated risk management.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Activity}
            title="Total Portfolios"
            value={history.length}
            trend="+12%"
            positive
          />
          <StatCard
            icon={TrendingUp}
            title="Avg Return"
            value={calculateAvgReturn(history)}
            trend="+8.3%"
            positive
          />
          <StatCard
            icon={DollarSign}
            title="Best Sharpe"
            value={getBestSharpe(history)}
            trend="1.85"
            positive
          />
          <StatCard
            icon={TrendingDown}
            title="Avg Risk"
            value={calculateAvgRisk(history)}
            trend="-2.1%"
            positive={false}
          />
        </div>

        {/* Recent Optimizations */}
        <div className="glass rounded-md p-6">
          <h2 className="text-3xl font-bold mb-6">Recent Optimizations</h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-electric-indigo border-t-transparent rounded-full mx-auto" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p>No optimizations yet. Start by creating your first portfolio!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item, idx) => (
                <div
                  key={idx}
                  data-testid={`portfolio-item-${idx}`}
                  className="p-4 bg-charcoal/50 border border-white/5 rounded-md hover:border-electric-indigo/50 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm text-emerald-400">
                        {item.symbols?.join(', ') || 'N/A'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-300">
                        Return: <span className="font-bold text-neon-mint">
                          {((item.annualized_return || 0) * 100).toFixed(2)}%
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Sharpe: {(item.sharpe_ratio || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, title, value, trend, positive }) => (
  <div className="glass rounded-md p-6 border border-white/5 hover:border-electric-indigo/50 transition-colors duration-300">
    <div className="flex items-center justify-between mb-3">
      <Icon className="w-8 h-8 text-electric-indigo" />
      <span className={`text-sm font-mono ${positive ? 'text-neon-mint' : 'text-red-400'}`}>
        {trend}
      </span>
    </div>
    <h3 className="text-sm text-slate-400 mb-1">{title}</h3>
    <p className="text-2xl font-black">{value}</p>
  </div>
);

const calculateAvgReturn = (history) => {
  if (history.length === 0) return '0.00%';
  const avg = history.reduce((sum, item) => sum + (item.annualized_return || 0), 0) / history.length;
  return `${(avg * 100).toFixed(2)}%`;
};

const getBestSharpe = (history) => {
  if (history.length === 0) return '0.00';
  const best = Math.max(...history.map(item => item.sharpe_ratio || 0));
  return best.toFixed(2);
};

const calculateAvgRisk = (history) => {
  if (history.length === 0) return '0.00%';
  const avg = history.reduce((sum, item) => sum + (item.risk || 0), 0) / history.length;
  return `${(avg * 100).toFixed(2)}%`;
};

export default Dashboard;
