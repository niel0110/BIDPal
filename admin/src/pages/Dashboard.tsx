import React, { useState, useEffect } from 'react';
import { Users, AlertCircle, ShoppingBag, Scale, TrendingUp, CheckCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import api from '../api/axios';

const data = [
  { name: 'Mon', value: 400 },
  { name: 'Tue', value: 300 },
  { name: 'Wed', value: 600 },
  { name: 'Thu', value: 800 },
  { name: 'Fri', value: 500 },
  { name: 'Sat', value: 900 },
  { name: 'Sun', value: 1100 },
];

const Dashboard = () => {
  const [stats, setStats] = useState({
    pendingKyc: 0,
    flaggedListings: 0,
    openDisputes: 0,
    suspendedUsers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/stats');
        setStats(response.data);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh stats every 30 seconds for "real-time" feel
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard">
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Platform Overview</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Welcome back, Administrator. {loading ? 'Fetching latest data...' : "Here's what's happening today."}</p>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '24px',
        marginBottom: '40px'
      }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ background: '#FEF2F2', padding: '10px', borderRadius: '12px' }}>
              <Users color="var(--accent-primary)" size={24} />
            </div>
            <span style={{ color: 'var(--success)', fontSize: '14px', fontWeight: 600 }}>Active</span>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '12px' }}>Users on Probation/Suspended</span>
          <span style={{ fontSize: '28px', fontWeight: 800 }}>{stats.suspendedUsers}</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ background: '#FFF7ED', padding: '10px', borderRadius: '12px' }}>
              <CheckCircle color="var(--warning)" size={24} />
            </div>
            <span style={{ color: 'var(--warning)', fontSize: '14px', fontWeight: 600 }}>Action Required</span>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '12px' }}>KYC Reviews Pending</span>
          <span style={{ fontSize: '28px', fontWeight: 800 }}>{stats.pendingKyc}</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ background: '#FEF2F2', padding: '10px', borderRadius: '12px' }}>
              <AlertCircle color="var(--danger)" size={24} />
            </div>
            <span style={{ color: 'var(--danger)', fontSize: '14px', fontWeight: 600 }}>Review List</span>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '12px' }}>Flagged Listings</span>
          <span style={{ fontSize: '28px', fontWeight: 800 }}>{stats.flaggedListings}</span>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ background: '#F5F3FF', padding: '10px', borderRadius: '12px' }}>
              <Scale color="var(--accent-secondary)" size={24} />
            </div>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '12px' }}>Open Customer Disputes</span>
          <span style={{ fontSize: '28px', fontWeight: 800 }}>{stats.openDisputes}</span>
        </motion.div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="glass" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '20px' }}>Platform Activity</h3>
            <div className="badge badge-success">Live Updates</div>
          </div>
          <div style={{ width: '100%', height: '300px', minHeight: '300px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'white', 
                    border: '1px solid #E2E8F0', 
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '24px' }}>Recent System Alerts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {stats.flaggedListings > 0 ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertCircle color="var(--danger)" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>{stats.flaggedListings} Listings Flagged</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pending manual review</p>
                </div>
                <div className="badge badge-danger">High</div>
              </div>
            ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No alerts at this time.</p>
            )}
            {stats.pendingKyc > 0 && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle color="var(--warning)" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>{stats.pendingKyc} KYC Applications</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Identity verification required</p>
                </div>
                <div className="badge badge-pending">Normal</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
