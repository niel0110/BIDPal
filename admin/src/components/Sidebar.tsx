import React from 'react';
import { LayoutDashboard, ShieldCheck, AlertOctagon, Scale, Users, Settings, LogOut, Ban } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: ShieldCheck, label: 'Seller Verification', path: '/seller-verification' },
  { icon: AlertOctagon, label: 'Listing Moderation', path: '/moderation' },
  { icon: Ban, label: 'Cancellation Reviews', path: '/cancellations' },
  { icon: Scale, label: 'Disputes', path: '/disputes' },
  { icon: Users, label: 'User standing', path: '/users' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

const Sidebar = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/login');
  };

  return (
    <div className="sidebar" style={{
      width: '280px',
      height: '100vh',
      background: 'white',
      display: 'flex',
      flexDirection: 'column',
      padding: '40px 20px',
      position: 'sticky',
      top: 0
    }}>
      <div className="logo" style={{
        marginBottom: '50px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <img src="/logo.png" alt="BIDPal Logo" style={{ width: '45px', height: '45px', objectFit: 'contain' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-primary)', lineHeight: 1 }}>BIDPal</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin Portal</span>
        </div>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '10px',
              textDecoration: 'none',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              background: isActive ? '#FEF2F2' : 'transparent',
              transition: 'all 0.2s',
              fontWeight: isActive ? 600 : 500,
              fontSize: '14px'
            })}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <button 
        onClick={handleLogout}
        className="btn btn-outline" 
        style={{ marginTop: 'auto', justifyContent: 'center', width: '100%', borderColor: '#FEE2E2', color: '#991B1B' }}
      >
        <LogOut size={18} />
        <span>Log Out</span>
      </button>
    </div>
  );
};

export default Sidebar;
