import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import KycReview from './pages/KycReview';
import Moderation from './pages/Moderation';
import UserManagement from './pages/UserManagement';
import Disputes from './pages/Disputes';
import Login from './pages/Login';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('admin_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

// Placeholder components
const Placeholder = ({ title }: { title: string }) => (
  <div style={{ padding: '20px' }}>
    <h1 style={{ marginBottom: '20px' }}>{title}</h1>
    <div className="glass" style={{ padding: '100px', textAlign: 'center', color: 'var(--text-secondary)' }}>
      Module for {title} is currently under development.
    </div>
  </div>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(!!localStorage.getItem('admin_token'));

  // Simple listener for storage changes (to handle login/logout across components)
  React.useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('admin_token'));
    };
    window.addEventListener('storage', handleStorageChange);
    // Also check periodically as backup for same-window changes
    const interval = setInterval(handleStorageChange, 500);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <Router>
      <div className="admin-layout">
        {isAuthenticated && <Sidebar />}
        <main className="main-content" style={{ padding: !isAuthenticated ? '0' : '40px' }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Protected Routes */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/kyc" element={<ProtectedRoute><KycReview /></ProtectedRoute>} />
            <Route path="/moderation" element={<ProtectedRoute><Moderation /></ProtectedRoute>} />
            <Route path="/disputes" element={<ProtectedRoute><Disputes /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Placeholder title="Admin Settings" /></ProtectedRoute>} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
