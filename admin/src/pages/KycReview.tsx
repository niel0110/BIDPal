import { useState, useEffect } from 'react';
import { Check, X, Shield, Clock, Search, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';

interface User {
  user_id: string;
  Fname: string;
  Lname: string;
  email: string;
  contact_num: string;
  create_at: string;
  kyc_status: string;
}

const KycReview = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPendingUsers = async () => {
    try {
      const response = await api.get('/kyc/pending');
      setUsers(response.data);
    } catch (err) {
      console.error('Error fetching pending KYC users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const handleAction = async (userId: string, status: string) => {
    try {
        await api.patch(`/users/${userId}/kyc`, { 
            status, 
            note: status === 'approved' ? 'Your identity verification has been approved.' : 'Verification failed. Please re-submit your ID.' 
        });
        
        // Optimistic UI update or just refetch
        setUsers(users.filter(u => u.user_id !== userId));
        setSelectedUser(null);
    } catch (err) {
        console.error('Error updating KYC status:', err);
        alert('Failed to update status. Please try again.');
    }
  };

  const filteredUsers = users.filter(u => 
    `${u.Fname} ${u.Lname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="kyc-page">
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>KYC Account Review</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review and approve user identity verifications.</p>
        </div>
        <div className="glass" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={18} color="var(--text-secondary)" />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '200px' }}
          />
        </div>
      </header>

      {loading ? (
          <div className="glass" style={{ padding: '100px', textAlign: 'center' }}>Loading pending reviews...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedUser ? '1fr 400px' : '1fr', gap: '24px', transition: 'all 0.3s ease' }}>
          <div className="glass" style={{ padding: '24px' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Submitted At</th>
                    <th>Contact</th>
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
                        exit={{ opacity: 0, x: -20 }}
                        onClick={() => setSelectedUser(user)}
                        style={{ cursor: 'pointer', background: selectedUser?.user_id === user.user_id ? '#FEF2F2' : 'transparent' }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                              {user.Fname[0]}{user.Lname[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500 }}>{user.Fname} {user.Lname}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                            <Clock size={14} color="var(--text-secondary)" />
                            {new Date(user.create_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={{ fontSize: '14px' }}>{user.contact_num}</td>
                        <td>
                          <span className="badge badge-pending">Pending Review</span>
                        </td>
                        <td>
                          <button className="btn btn-outline" style={{ padding: '6px' }}>
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {filteredUsers.length === 0 && (
                      <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No pending reviews found.</td>
                      </tr>
                  )}
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
                  <h3 style={{ fontSize: '20px' }}>Verification Details</h3>
                  <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--border)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Shield size={40} color="var(--accent-primary)" />
                  </div>
                  <h4>{selectedUser.Fname} {selectedUser.Lname}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Registered on {new Date(selectedUser.create_at).toLocaleDateString()}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Identity Document</p>
                    <div style={{ height: '150px', background: '#000', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      [ID Document Image Placeholder]
                    </div>
                  </div>

                  <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Selfie Verification</p>
                    <div style={{ height: '150px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      [Selfie Image Placeholder]
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button onClick={() => handleAction(selectedUser.user_id, 'rejected')} className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <X size={18} /> Reject
                  </button>
                  <button onClick={() => handleAction(selectedUser.user_id, 'approved')} className="btn btn-primary">
                    <Check size={18} /> Approve
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default KycReview;
