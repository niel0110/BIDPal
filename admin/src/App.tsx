import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import AdminNotificationBell from './components/AdminNotificationBell';
import Dashboard from './pages/Dashboard';
import SellerVerification from './pages/SellerVerification';
import BuyerVerification from './pages/BuyerVerification';
import Moderation from './pages/Moderation';
import UserManagement from './pages/UserManagement';
import Disputes from './pages/Disputes';
import CancellationReviews from './pages/CancellationReviews';
import Login from './pages/Login';
import RevenueManagement from './pages/RevenueManagement';
import ReactivationRequests from './pages/ReactivationRequests';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('admin_token');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};


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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh' }}>
          {/* Top bar with notification bell */}
          {isAuthenticated && (
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 100,
              background: 'white',
              borderBottom: '1px solid #f3f4f6',
              padding: '0 40px',
              height: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
            }}>
              <AdminNotificationBell />
            </div>
          )}
          <main className="main-content" style={{ padding: !isAuthenticated ? '0' : '40px', flex: 1 }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Protected Routes */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/seller-verification" element={<ProtectedRoute><SellerVerification /></ProtectedRoute>} />
            <Route path="/moderation" element={<ProtectedRoute><Moderation /></ProtectedRoute>} />
            <Route path="/disputes" element={<ProtectedRoute><Disputes /></ProtectedRoute>} />
            <Route path="/cancellations" element={<ProtectedRoute><CancellationReviews /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
            <Route path="/buyer-verification" element={<ProtectedRoute><BuyerVerification /></ProtectedRoute>} />
            <Route path="/revenue" element={<ProtectedRoute><RevenueManagement /></ProtectedRoute>} />
            <Route path="/reactivation-requests" element={<ProtectedRoute><ReactivationRequests /></ProtectedRoute>} />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
