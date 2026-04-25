import React, { useState, useEffect } from 'react';
import { Users, Search, Shield, ShieldAlert, ShieldOff, UserCheck, MoreHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface ViolationRecord {
  standing: string;
  strike_count: number;
}

interface User {
  user_id: string;
  Fname: string;
  Lname: string;
  email: string;
  role: string;
  is_verified: boolean;
  Avatar?: string;
  kyc_status?: string;
  Violation_Records: ViolationRecord[] | null;
}

const getStanding = (user: User): string => {
  const vr = user.Violation_Records?.[0];
  return vr?.standing || 'Active';
};

const StandingBadge = ({ standing }: { standing: string }) => {
  const map: Record<string, { bg: string; color: string }> = {
    Active: { bg: '#d1fae5', color: '#065f46' },
    Probationary: { bg: '#fef3c7', color: '#92400e' },
    Suspended: { bg: '#fee2e2', color: '#991b1b' },
    Blacklisted: { bg: '#000', color: '#fff' },
  };
  const style = map[standing] || { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ background: style.bg, color: style.color, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
      {standing}
    </span>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [updating, setUpdating] = useState(false);
  const [standingFilter, setStandingFilter] = useState<string>('all');

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('User')
      .select('user_id, Fname, Lname, email, role, is_verified, Avatar, kyc_status, Violation_Records(standing, strike_count)')
      .order('Fname', { ascending: true });

    if (!error && data) setUsers(data as User[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel('users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'User' }, fetchUsers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Violation_Records' }, fetchUsers)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleUpdateStanding = async (userId: string, standing: string) => {
    setUpdating(true);
    try {
      const { data: existing } = await supabase
        .from('Violation_Records')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase.from('Violation_Records').update({ standing }).eq('user_id', userId);
      } else {
        await supabase.from('Violation_Records').insert([{ user_id: userId, standing, strike_count: 0 }]);
      }

      if (standing === 'Blacklisted') {
        await supabase.from('User').update({ role: 'Banned' }).eq('user_id', userId);
      }

      setSelectedUser(prev => prev ? { ...prev, Violation_Records: [{ standing, strike_count: prev.Violation_Records?.[0]?.strike_count || 0 }] } : null);
      await fetchUsers();
    } catch (err) {
      console.error('Error updating standing:', err);
      alert('Failed to update standing.');
    } finally {
      setUpdating(false);
    }
  };

  const filtered = users.filter(u => {
    const nameMatch = `${u.Fname} ${u.Lname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const standingMatch = standingFilter === 'all' || getStanding(u) === standingFilter;
    return nameMatch && standingMatch;
  });

  const standings = ['all', 'Active', 'Probationary', 'Suspended', 'Blacklisted'];

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
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '250px' }}
          />
        </div>
      </header>

      {/* Standing filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {standings.map(s => (
          <button
            key={s}
            onClick={() => setStandingFilter(s)}
            style={{
              padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              background: standingFilter === s ? 'var(--accent-primary)' : '#f3f4f6',
              color: standingFilter === s ? 'white' : 'var(--text-secondary)',
            }}
          >
            {s === 'all' ? 'All Users' : s}
          </button>
        ))}
      </div>

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
                    <th>Verified</th>
                    <th>Strikes</th>
                    <th>Standing</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map(user => (
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
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', overflow: 'hidden', flexShrink: 0 }}>
                              {user.Avatar ? <img src={user.Avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${user.Fname?.[0] || '?'}${user.Lname?.[0] || '?'}`}
                            </div>
                            <div>
                              <div style={{ fontWeight: 500 }}>{user.Fname} {user.Lname}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ textTransform: 'capitalize', fontSize: '14px' }}>{user.role}</td>
                        <td>
                          {user.is_verified
                            ? <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '14px' }}><UserCheck size={14} /> Verified</div>
                            : <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '14px' }}><ShieldOff size={14} /> Unverified</div>
                          }
                        </td>
                        <td style={{ fontSize: '14px', fontWeight: 600, color: (user.Violation_Records?.[0]?.strike_count || 0) > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          {user.Violation_Records?.[0]?.strike_count || 0}
                        </td>
                        <td><StandingBadge standing={getStanding(user)} /></td>
                        <td>
                          <button className="btn btn-outline" style={{ padding: '6px' }} onClick={e => { e.stopPropagation(); setSelectedUser(user); }}>
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No users found.</td>
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
                  <h3 style={{ fontSize: '20px' }}>User Details</h3>
                  <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(45deg, var(--accent-primary), var(--accent-secondary))', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold', color: 'white', overflow: 'hidden' }}>
                    {selectedUser.Avatar ? <img src={selectedUser.Avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${selectedUser.Fname?.[0] || '?'}${selectedUser.Lname?.[0] || '?'}`}
                  </div>
                  <h4 style={{ fontSize: '18px', fontWeight: 700 }}>{selectedUser.Fname} {selectedUser.Lname}</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{selectedUser.email}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textTransform: 'capitalize' }}>{selectedUser.role}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Account Info</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>ID Verification</span>
                        <span style={{ fontWeight: 600, color: selectedUser.is_verified ? 'var(--success)' : 'var(--text-secondary)' }}>
                          {selectedUser.kyc_status || (selectedUser.is_verified ? 'approved' : 'unverified')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Current Standing</span>
                        <StandingBadge standing={getStanding(selectedUser)} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Strike Count</span>
                        <span style={{ fontWeight: 600 }}>{selectedUser.Violation_Records?.[0]?.strike_count || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Update Standing</p>
                    <button disabled={updating} onClick={() => handleUpdateStanding(selectedUser.user_id, 'Active')} className="btn btn-outline" style={{ justifyContent: 'flex-start', color: 'var(--success)' }}>
                      <Shield size={18} /> Re-activate Account
                    </button>
                    <button disabled={updating} onClick={() => handleUpdateStanding(selectedUser.user_id, 'Probationary')} className="btn btn-outline" style={{ justifyContent: 'flex-start', color: 'var(--warning)' }}>
                      <ShieldAlert size={18} /> Place on Probation
                    </button>
                    <button disabled={updating} onClick={() => handleUpdateStanding(selectedUser.user_id, 'Suspended')} className="btn btn-outline" style={{ justifyContent: 'flex-start', color: 'var(--danger)' }}>
                      <ShieldOff size={18} /> Suspend Account
                    </button>
                    <button disabled={updating} onClick={() => handleUpdateStanding(selectedUser.user_id, 'Blacklisted')} className="btn btn-outline" style={{ justifyContent: 'flex-start', color: '#000', borderColor: '#000' }}>
                      <Users size={18} /> Blacklist Identity
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

export default UserManagement;
