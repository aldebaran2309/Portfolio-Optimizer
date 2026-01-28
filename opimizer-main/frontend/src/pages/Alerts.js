import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Bell, Plus, Trash2, Power, PowerOff } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Alerts = () => {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAlert, setNewAlert] = useState({
    alert_type: 'price_above',
    symbol: '',
    target_price: '',
    frequency: 'once'
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    fetchAlerts();
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 1) {
      const timer = setTimeout(() => searchAssets(), 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchAssets = async () => {
    try {
      const response = await axios.post(`${API}/assets/search`, {
        query: searchQuery,
        asset_type: 'stock'
      });
      setSearchResults(response.data.assets || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/alerts/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    if (newAlert.alert_type !== 'rebalance_reminder' && (!newAlert.symbol || !newAlert.target_price)) {
      toast.error('Please enter symbol and target price');
      return;
    }

    try {
      await axios.post(
        `${API}/alerts/`,
        {
          alert_type: newAlert.alert_type,
          symbol: newAlert.symbol || null,
          target_price: newAlert.target_price ? parseFloat(newAlert.target_price) : null,
          frequency: newAlert.frequency,
          message: `Alert for ${newAlert.symbol || 'portfolio'}`
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Alert created successfully');
      setShowAddModal(false);
      setNewAlert({
        alert_type: 'price_above',
        symbol: '',
        target_price: '',
        frequency: 'once'
      });
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to create alert');
    }
  };

  const handleToggle = async (alertId) => {
    try {
      const response = await axios.put(
        `${API}/alerts/${alertId}/toggle`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.is_active ? 'Alert activated' : 'Alert deactivated');
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to toggle alert');
    }
  };

  const handleDelete = async (alertId) => {
    try {
      await axios.delete(`${API}/alerts/${alertId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Alert deleted');
      fetchAlerts();
    } catch (error) {
      toast.error('Failed to delete alert');
    }
  };

  return (
    <div className="min-h-screen p-8 bg-obsidian">
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-5xl font-black tracking-tighter mb-2">ALERTS & NOTIFICATIONS</h1>
            <p className="text-slate-400">Set price alerts and rebalancing reminders</p>
          </div>
          <Button
            data-testid="add-alert-button"
            onClick={() => setShowAddModal(true)}
            className="bg-electric-indigo hover:bg-electric-indigo/90 glow flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Alert
          </Button>
        </div>

        {/* Alerts List */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Your Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-12 h-12 border-4 border-electric-indigo border-t-transparent rounded-full mx-auto" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No alerts yet. Create your first alert!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    data-testid={`alert-${alert.id}`}
                    className={`p-4 rounded-sm border transition-all ${
                      alert.is_active
                        ? 'bg-charcoal/50 border-electric-indigo/30'
                        : 'bg-charcoal/30 border-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Bell className={`w-5 h-5 ${
                            alert.is_active ? 'text-electric-indigo' : 'text-slate-500'
                          }`} />
                          <span className="font-bold text-white">
                            {alert.alert_type === 'price_above' ? 'Price Above' :
                             alert.alert_type === 'price_below' ? 'Price Below' :
                             'Rebalance Reminder'}
                          </span>
                          {alert.symbol && (
                            <span className="text-emerald-400 font-mono">{alert.symbol}</span>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-slate-400">
                          {alert.target_price && (
                            <span>Target: ${alert.target_price}</span>
                          )}
                          <span>Frequency: {alert.frequency}</span>
                          <span>Triggered: {alert.triggered_count} times</span>
                          {alert.last_triggered && (
                            <span>Last: {new Date(alert.last_triggered).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggle(alert.id)}
                          className={`p-2 rounded transition-colors ${
                            alert.is_active
                              ? 'text-neon-mint hover:bg-neon-mint/10'
                              : 'text-slate-500 hover:bg-slate-500/10'
                          }`}
                          title={alert.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {alert.is_active ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                        </button>
                        <button
                          onClick={() => handleDelete(alert.id)}
                          className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Alert Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="glass w-full max-w-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Create Alert</CardTitle>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Alert Type</label>
                  <Select value={newAlert.alert_type} onValueChange={(val) => setNewAlert({ ...newAlert, alert_type: val })}>
                    <SelectTrigger className="bg-gunmetal border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price_above">Price Above</SelectItem>
                      <SelectItem value="price_below">Price Below</SelectItem>
                      <SelectItem value="rebalance_reminder">Rebalance Reminder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newAlert.alert_type !== 'rebalance_reminder' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-2">Symbol</label>
                      <Input
                        type="text"
                        value={newAlert.symbol}
                        onChange={(e) => {
                          setNewAlert({ ...newAlert, symbol: e.target.value });
                          setSearchQuery(e.target.value);
                        }}
                        placeholder="AAPL"
                        className="bg-gunmetal border-white/10 text-white"
                      />
                      {searchResults.length > 0 && (
                        <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                          {searchResults.slice(0, 5).map((asset) => (
                            <button
                              key={asset.symbol}
                              onClick={() => {
                                setNewAlert({ ...newAlert, symbol: asset.symbol });
                                setSearchResults([]);
                              }}
                              className="w-full p-2 text-left bg-charcoal/50 hover:bg-charcoal rounded-sm text-sm"
                            >
                              <span className="font-bold text-white">{asset.symbol}</span>
                              <span className="text-slate-400 ml-2">{asset.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-300 mb-2">Target Price</label>
                      <Input
                        type="number"
                        value={newAlert.target_price}
                        onChange={(e) => setNewAlert({ ...newAlert, target_price: e.target.value })}
                        placeholder="150.00"
                        step="0.01"
                        className="bg-gunmetal border-white/10 text-white"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Frequency</label>
                  <Select value={newAlert.frequency} onValueChange={(val) => setNewAlert({ ...newAlert, frequency: val })}>
                    <SelectTrigger className="bg-gunmetal border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Once</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleCreateAlert}
                  className="w-full bg-electric-indigo hover:bg-electric-indigo/90 glow"
                >
                  Create Alert
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
