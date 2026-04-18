import React, { useState, useEffect } from 'react';
import { Users, Search, Shield, ShieldAlert, ShieldOff, UserCheck, MoreHorizontal, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';

interface User {
  user_id: string;
  Fname: string;
  Lname: string;
  email: string;
  role: string;
  is_verified: boolean;
  Avatar?: string;
  standing?: string; // Will be fetched from violation records or joined
}

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [updating, setUpdating] = useState(false);

  // Note: Using the general /users endpoint for now, ideally an admin search endpoint
  const fetchUsers = async () => {
    try {
      setLoading(true);
      // We'll call the general users endpoint and then potentially standing for the selected user
      // In a real production system, this would be a single admin-only join query
      const response = await api.get('/../../users'); // Adjusting path to reach non-admin routes if needed, but best to have an admin endpoint
      // Actually, let's assume the admin has an endpoint for this or we handle it gracefully
      setUsers(response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateStanding = async (userId: string, standing: string) => {
    try {
      setUpdating(true);
      await api.patch(`/users/${userId}/standing`, { 
        standing,
        reason: `Administrative action: Set to ${standing}`
      });
      
      // Update local state
      if (selectedUser && selectedUser.user_id === userId) {
        setSelectedUser({ ...selectedUser, standing });
      }
      
      alert(`User standing updated to ${standing}`);
    } catch (err) {
      console.error('Error updating standing:', err);
      alert('Failed to update standing.');
    } finally {
      setUpdating(false);
    }
  };

  const getStandingBadge = (standing?: string) => {
    switch (standing) {
      case 'Active': return <span className="badge badge-success">Active</span>;
      case 'Probationary': return <span className="badge badge-pending">Probation</span>;
      case 'Suspended': return <span className="badge badge-danger">Suspended</span>;
      case 'Blacklisted': return <span className="badge" style={{ background: '#000', color: '#fff' }}>Blacklisted</span>;
      default: return <span className="badge badge-outline">Standard</span>;
    }
  };

  const filteredUsers = users.filter(u => 
    `${u.Fname} ${u.Lname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="user-management">
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>User Standing</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage account health and platform access restrictions.</p>
        </div>
        <div className="glass" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={18} color="var(--text-secondary)" />
          <input 
            type="text" 
            placeholder="Search users by name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '250px' }}
          />
        </div>
      </header>

      {loading ? (
        <div className="glass" style={{ padding: '100px', textAlign: 'center' }}>Loading user directory...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 400px' : '1fr', gap: '24px', transition: 'all 0.3s ease' }}>
          <div className="glass" style={{ padding: '24px' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>ID Verified</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredUsers.map((user) => (
                      <motion.tr 
                        key={user.user_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedUser(user)}
                        style={{ cursor: 'pointer', background: selectedUser?.user_id === user.user_id ? '#FEF2F2' : 'transparent' }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', overflow: 'hidden' }}>
                              {user.Avatar ? <img src={user.Avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${user.Fname[0]}${user.Lname[0]}`}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500 }}>{user.Fname} {user.Lname}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ textTransform: 'capitalize', fontSize: '14px' }}>{user.role}</span>
                        </td>
                        <td>
                          {user.is_verified ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '14px' }}>
                              <UserCheck size={14} /> Verified
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                              <ShieldOff size={14} /> Unverified
                            </div>
                          )}
                        </td>
                        <td>{getStandingBadge(user.standing)}</td>
                        <td>
                          <button className="btn btn-outline" style={{ padding: '6px' }}>
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          <AnimatePresence>
            {selectedUser && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass" 
                style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '20px' }}>User Context</h3>
                  <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--accent-primary), var(--accent-secondary))', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
                        {selectedUser.Avatar ? <img src={selectedUser.Avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : `${selectedUser.Fname[0]}${selectedUser.Lname[0]}`}
                    </div>
                    <h4>{selectedUser.Fname} {selectedUser.Lname}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{selectedUser.email}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <h5 style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Current Standing</h5>
                        {getStandingBadge(selectedUser.standing)}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <h5 style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Update Standing</h5>
                        <button 
                            disabled={updating}
                            onClick={() => handleUpdateStanding(selectedUser.user_id, 'Active')}
                            className="btn btn-outline" style={{ justifyContent: 'flex-start', color: 'var(--success)' }}
                        >
                            <Shield size={18} /> Re-activate Account
                        </button>
                        <button 
                            disabled={updating}
                            onClick={() => handleUpdateStanding(selectedUser.user_id, 'Probationary')}
                            className="btn btn-outline" style={{ justifyContent: 'flex-start', color: 'var(--warning)' }}
                        >
                            <ShieldAlert size={18} /> Place on Probation
                        </button>
                        <button 
                            disabled={updating}
                            onClick={() => handleUpdateStanding(selectedUser.user_id, 'Suspended')}
                            className="btn btn-outline" style={{ justifyContent: 'flex-start', color: 'var(--danger)' }}
                        >
                            <ShieldOff size={18} /> Suspend Account
                        </button>
                        <button 
                            disabled={updating}
                            onClick={() => handleUpdateStanding(selectedUser.user_id, 'Blacklisted')}
                            className="btn btn-outline" style={{ justifyContent: 'flex-start', color: '#000', borderColor: '#000' }}
                        >
                            <AlertCircle size={18} /> Blacklist Identity
                        </button>
                    </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

// Simple X icon since I didn't import it in this block
const X = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

export default UserManagement;
