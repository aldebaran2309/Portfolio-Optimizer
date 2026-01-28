import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Link2, CheckCircle, XCircle, RefreshCw, Trash2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Brokers = () => {
  const { token } = useAuth();
  const [availableBrokers, setAvailableBrokers] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [credentials, setCredentials] = useState({
    api_key: '',
    api_secret: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [brokersRes, connectionsRes] = await Promise.all([
        axios.get(`${API}/brokers/available`),
        axios.get(`${API}/brokers/connections`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setAvailableBrokers(brokersRes.data.brokers || []);
      setConnections(connectionsRes.data.connections || []);
    } catch (error) {
      console.error('Error fetching broker data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkBroker = async () => {
    if (!credentials.api_key) {
      toast.error('Please enter API credentials');
      return;
    }

    try {
      await axios.post(
        `${API}/brokers/link`,
        {
          broker: selectedBroker.id,
          api_key: credentials.api_key,
          api_secret: credentials.api_secret
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`${selectedBroker.name} linked successfully!`);
      setShowLinkModal(false);
      setCredentials({ api_key: '', api_secret: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to link broker');
    }
  };

  const handleSync = async (connectionId, brokerName) => {
    try {
      const response = await axios.post(
        `${API}/brokers/sync/${connectionId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(response.data.message);
      if (response.data.note) {
        toast.info(response.data.note, { duration: 5000 });
      }
    } catch (error) {
      toast.error('Sync failed');
    }
  };

  const handleUnlink = async (connectionId) => {
    try {
      await axios.delete(`${API}/brokers/connections/${connectionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Broker unlinked');
      fetchData();
    } catch (error) {
      toast.error('Failed to unlink broker');
    }
  };

  const isLinked = (brokerId) => {
    return connections.some(c => c.broker === brokerId);
  };

  return (
    <div className="min-h-screen p-8 bg-obsidian">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-5xl font-black tracking-tighter mb-2">BROKER ACCOUNTS</h1>
          <p className="text-slate-400">Link your brokerage accounts to auto-import holdings</p>
        </div>

        {/* Connected Brokers */}
        {connections.length > 0 && (
          <Card className="glass mb-8">
            <CardHeader>
              <CardTitle>Connected Brokers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {connections.map((conn) => (
                  <div
                    key={conn.id}
                    className="p-4 bg-charcoal/50 border border-neon-mint/30 rounded-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-neon-mint" />
                        <div>
                          <h3 className="font-bold text-white capitalize">
                            {conn.broker.replace('_', ' ')}
                          </h3>
                          <p className="text-sm text-slate-400">
                            Linked {new Date(conn.linked_at).toLocaleDateString()}
                            {conn.last_sync && ` • Last sync: ${new Date(conn.last_sync).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleSync(conn.id, conn.broker)}
                          className="bg-electric-indigo hover:bg-electric-indigo/90"
                          size="sm"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sync
                        </Button>
                        <button
                          onClick={() => handleUnlink(conn.id)}
                          className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Brokers */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Available Brokers</CardTitle>
            <CardDescription>Click to link your brokerage account</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-12 h-12 border-4 border-electric-indigo border-t-transparent rounded-full mx-auto" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableBrokers.map((broker) => {
                  const linked = isLinked(broker.id);
                  return (
                    <button
                      key={broker.id}
                      onClick={() => {
                        if (!linked) {
                          setSelectedBroker(broker);
                          setShowLinkModal(true);
                        }
                      }}
                      disabled={linked}
                      className={`p-6 rounded-sm border text-left transition-all ${
                        linked
                          ? 'bg-charcoal/30 border-white/5 opacity-60 cursor-not-allowed'
                          : 'bg-charcoal/50 border-white/10 hover:border-electric-indigo/50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <Link2 className={`w-8 h-8 ${
                          linked ? 'text-neon-mint' : 'text-electric-indigo'
                        }`} />
                        {linked && <CheckCircle className="w-5 h-5 text-neon-mint" />}
                        {!broker.configured && !linked && (
                          <XCircle className="w-5 h-5 text-amber-400" title="API keys not configured" />
                        )}
                      </div>
                      <h3 className="font-bold text-white text-lg mb-1">{broker.name}</h3>
                      <p className="text-sm text-slate-400 mb-2">{broker.country}</p>
                      <p className="text-xs text-slate-500">
                        Auth: {broker.auth_type === 'oauth' ? 'OAuth' : 'API Key'}
                      </p>
                      {linked && (
                        <p className="text-xs text-neon-mint mt-2">✓ Connected</p>
                      )}
                      {!broker.configured && !linked && (
                        <p className="text-xs text-amber-400 mt-2">⚠ Configure API keys in .env</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Link Broker Modal */}
        {showLinkModal && selectedBroker && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="glass w-full max-w-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Link {selectedBroker.name}</CardTitle>
                  <button
                    onClick={() => setShowLinkModal(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
                <CardDescription>
                  Enter your API credentials to link this broker
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">API Key</label>
                  <Input
                    type="text"
                    value={credentials.api_key}
                    onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })}
                    placeholder="Enter your API key"
                    className="bg-gunmetal border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">API Secret (Optional)</label>
                  <Input
                    type="password"
                    value={credentials.api_secret}
                    onChange={(e) => setCredentials({ ...credentials, api_secret: e.target.value })}
                    placeholder="Enter your API secret"
                    className="bg-gunmetal border-white/10 text-white"
                  />
                </div>

                <div className="p-3 bg-amber-400/10 border border-amber-400/30 rounded-sm">
                  <p className="text-xs text-amber-400">
                    ⚠ Your credentials are encrypted and stored securely. They're only used to fetch your holdings.
                  </p>
                </div>

                <Button
                  onClick={handleLinkBroker}
                  className="w-full bg-electric-indigo hover:bg-electric-indigo/90 glow"
                >
                  Link Broker
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Brokers;
