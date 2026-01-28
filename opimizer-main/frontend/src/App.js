import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import '@/App.css';
import Dashboard from './pages/Dashboard';
import Optimizer from './pages/Optimizer';
import ModelTraining from './pages/ModelTraining';
import Backtesting from './pages/Backtesting';
import Auth from './pages/Auth';
import KYC from './pages/KYC';
import Portfolio from './pages/Portfolio';
import Alerts from './pages/Alerts';
import Brokers from './pages/Brokers';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Activity, TrendingUp, Brain, LineChart, User, LogOut, Wallet, Bell, Link2 } from 'lucide-react';
import { Toaster } from 'sonner';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-obsidian">
      <div className="animate-spin w-12 h-12 border-4 border-electric-indigo border-t-transparent rounded-full" />
    </div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return children;
};

const Navigation = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  // Don't show navigation on auth pages
  if (location.pathname === '/auth' || !user) {
    return null;
  }
  
  const navItems = [
    { path: '/dashboard', icon: Activity, label: 'Dashboard' },
    { path: '/portfolio', icon: Wallet, label: 'My Portfolio' },
    { path: '/optimizer', icon: TrendingUp, label: 'Optimizer' },
    { path: '/models', icon: Brain, label: 'ML Models' },
    { path: '/backtest', icon: LineChart, label: 'Backtest' },
    { path: '/alerts', icon: Bell, label: 'Alerts' },
    { path: '/brokers', icon: Link2, label: 'Brokers' },
  ];
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/5">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-gradient-to-tr from-electric-indigo to-neon-mint flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-white">QUANTUM LEDGER</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                    className={`px-6 py-2 rounded-sm font-bold tracking-wide transition-all duration-300 flex items-center gap-2 ${
                      isActive
                        ? 'bg-electric-indigo text-white glow'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
              <Link
                to="/kyc"
                className="p-2 text-slate-400 hover:text-white transition-colors"
                title="KYC Status"
              >
                <User className="w-5 h-5" />
              </Link>
              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                title="Logout"
                data-testid="logout-button"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <AuthProvider>
      <div className="App min-h-screen bg-obsidian">
        <div className="noise-overlay" />
        <Toaster position="top-right" />
        <BrowserRouter>
          <Navigation />
          <div className="pt-20">
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
              <Route path="/optimizer" element={<ProtectedRoute><Optimizer /></ProtectedRoute>} />
              <Route path="/models" element={<ProtectedRoute><ModelTraining /></ProtectedRoute>} />
              <Route path="/backtest" element={<ProtectedRoute><Backtesting /></ProtectedRoute>} />
              <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
              <Route path="/brokers" element={<ProtectedRoute><Brokers /></ProtectedRoute>} />
              <Route path="/kyc" element={<ProtectedRoute><KYC /></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;
