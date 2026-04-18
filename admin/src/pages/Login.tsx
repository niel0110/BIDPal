import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import axios from 'axios';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Use the general auth login endpoint
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email,
        password
      });

      const { user, token } = response.data;

      // Check if the user is an admin
      if (user.role?.toLowerCase() !== 'admin') {
        throw new Error('Access denied. You do not have administrator privileges.');
      }

      // Store token and user info
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(user));

      // Redirect to dashboard
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F8FAFC',
      backgroundImage: 'radial-gradient(at 0% 0%, hsla(0,100%,95%,1) 0, transparent 50%), radial-gradient(at 100% 100%, hsla(260,100%,95%,1) 0, transparent 50%)'
    }}>
      <div className="glass" style={{
        width: '100%',
        maxWidth: '450px',
        padding: '50px',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '40px' }}>
          <img src="/logo.png" alt="BIDPal Logo" style={{ width: '80px', height: '80px', marginBottom: '20px' }} />
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '8px' }}>BIDPal Admin</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Secure portal for platform oversight</p>
        </div>

        {error && (
          <div style={{ 
            background: '#FEF2F2', 
            color: '#991B1B', 
            padding: '12px 16px', 
            borderRadius: '12px', 
            marginBottom: '24px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            fontSize: '14px',
            border: '1px solid #FEE2E2',
            textAlign: 'left'
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Email Address</label>
            <div className="glass" style={{ padding: '2px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'none', background: '#F1F5F9' }}>
              <Mail size={18} color="var(--text-secondary)" />
              <input 
                type="email" 
                required
                placeholder="admin@bidpal.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', padding: '12px 0', width: '100%', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Password</label>
            <div className="glass" style={{ padding: '2px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: 'none', background: '#F1F5F9' }}>
              <Lock size={18} color="var(--text-secondary)" />
              <input 
                type="password" 
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ background: 'none', border: 'none', color: 'var(--text-primary)', padding: '12px 0', width: '100%', outline: 'none' }}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary" 
            style={{ 
              width: '100%', 
              justifyContent: 'center', 
              padding: '16px', 
              fontSize: '16px', 
              marginTop: '10px',
              transition: 'all 0.3s'
            }}
          >
            {loading ? <Loader2 size={24} className="spin" /> : <>Sign In <ArrowRight size={20} /></>}
          </button>
        </form>

        <p style={{ marginTop: '30px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Authorized personnel only. All access is logged.
        </p>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Login;
