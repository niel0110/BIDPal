import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import SellerVerification from './pages/SellerVerification';
import BuyerVerification from './pages/BuyerVerification';
import Moderation from './pages/Moderation';
import UserManagement from './pages/UserManagement';
import Disputes from './pages/Disputes';
import CancellationReviews from './pages/CancellationReviews';
import Login from './pages/Login';
import RevenueManagement from './pages/RevenueManagement';

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
        <main className="main-content" style={{ padding: !isAuthenticated ? '0' : '40px' }}>
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
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
