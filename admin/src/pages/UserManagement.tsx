import { useState, useEffect } from 'react';
import { Search, Shield, ShieldAlert, ShieldOff, UserCheck, X, Ban } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface ViolationRecord {
  account_status: string;
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
  violation_record: ViolationRecord | null;
  active_cart_count?: number;
  stashed_cart_count?: number;
}

// DB account_status → display standing
const STATUS_TO_STANDING: Record<string, string> = {
  clean:      'Active',
  warned:     'Probationary',
  restricted: 'Suspended',
  suspended:  'Blacklisted',
};

// Display standing → DB account_status
const STANDING_TO_STATUS: Record<string, string> = {
  Active:       'clean',
  Probationary: 'warned',
  Suspended:    'restricted',
  Blacklisted:  'suspended',
};

const getStanding = (user: User): string => {
  const status = user.violation_record?.account_status;
  return STATUS_TO_STANDING[status || 'clean'] || 'Active';
};

const STANDING_CONFIG: Record<string, { bg: string; color: string; border: string }> = {
  Active:       { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
  Probationary: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  Suspended:    { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  Blacklisted:  { bg: '#111',    color: '#fff',    border: '#000' },
};

const StandingBadge = ({ standing }: { standing: string }) => {
  const cfg = STANDING_CONFIG[standing] || { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
      {standing}
    </span>
  );
};

const standingCounts = (users: User[]) => ({
  all:          users.length,
  Active:       users.filter(u => getStanding(u) === 'Active').length,
  Probationary: users.filter(u => getStanding(u) === 'Probationary').length,
  Suspended:    users.filter(u => getStanding(u) === 'Suspended').length,
  Blacklisted:  users.filter(u => getStanding(u) === 'Blacklisted').length,
});

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [updating, setUpdating] = useState(false);
  const [standingFilter, setStandingFilter] = useState<string>('all');

  const fetchUsers = async () => {
    setLoading(true);
    const { data: userData, error } = await supabase
      .from('User')
      .select('user_id, Fname, Lname, email, role, is_verified, Avatar, kyc_status')
      .or('role.eq.Buyer,role.eq.buyer')
      .order('Fname', { ascending: true });

    if (error) {
      console.error('UserManagement fetch error:', error);
      setLoading(false);
      return;
    }

    if (!userData || userData.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    // Extract user IDs for subsequent lookups
    const ids = userData.map((u: any) => u.user_id);

    // Fetch Violation Records
    const { data: vrData, error: vrError } = await supabase
      .from('Violation_Records')
      .select('*')
      .in('user_id', ids);

    if (vrError) console.error('Violation_Records fetch error:', vrError);

    const vrMap: Record<string, any> = {};
    if (vrData) {
      for (const vr of vrData as any[]) {
        vrMap[vr.user_id] = vr;
      }
    }

    // Fetch Cart Stats
    const { data: cartData, error: cartError } = await supabase
      .from('Cart_items')
      .select('user_id, is_stashed')
      .in('user_id', ids);

    if (cartError) console.error('Cart_items fetch error:', cartError);

    const cartMap: Record<string, { active: number, stashed: number }> = {};
    if (cartData) {
      for (const item of cartData as any[]) {
        if (!cartMap[item.user_id]) cartMap[item.user_id] = { active: 0, stashed: 0 };
        if (item.is_stashed) cartMap[item.user_id].stashed++;
        else cartMap[item.user_id].active++;
      }
    }

    setUsers(userData.map((u: any) => ({ 
      ...u, 
      violation_record: vrMap[u.user_id] || null,
      active_cart_count: cartMap[u.user_id]?.active || 0,
      stashed_cart_count: cartMap[u.user_id]?.stashed || 0
    })));
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
    const account_status = STANDING_TO_STATUS[standing] || 'clean';
    setUpdating(true);
    try {
      const { data: existing } = await supabase
        .from('Violation_Records')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await supabase.from('Violation_Records').update({ account_status }).eq('user_id', userId);
      } else {
        await supabase.from('Violation_Records').insert([{ user_id: userId, account_status, strike_count: 0 }]);
      }

      if (standing === 'Blacklisted') {
        await supabase.from('User').update({ role: 'Banned' }).eq('user_id', userId);
      }

      setSelectedUser(prev => prev ? {
        ...prev,
        violation_record: { account_status, strike_count: prev.violation_record?.strike_count || 0 }
      } : null);
      await fetchUsers();
    } catch (err) {
      console.error('Error updating standing:', err);
      alert('Failed to update standing.');
    } finally {
      setUpdating(false);
    }
  };

  const counts = standingCounts(users);

  const filtered = users.filter(u => {
    const nameMatch = `${u.Fname} ${u.Lname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const standingMatch = standingFilter === 'all' || getStanding(u) === standingFilter;
    return nameMatch && standingMatch;
  });

  const filterTabs = [
    { key: 'all', label: 'All Buyers', count: counts.all, color: 'var(--accent-primary)' },
    { key: 'Active', label: 'Active', count: counts.Active, color: '#16a34a' },
    { key: 'Probationary', label: 'Probationary', count: counts.Probationary, color: '#d97706' },
    { key: 'Suspended', label: 'Suspended', count: counts.Suspended, color: '#dc2626' },
    { key: 'Blacklisted', label: 'Blacklisted', count: counts.Blacklisted, color: '#111' },
  ];

  return (
    <div>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Buyer Standing</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage buyer account health and platform access restrictions.</p>
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

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStandingFilter(tab.key)}
            style={{
              padding: '7px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
              background: standingFilter === tab.key ? tab.color : '#f3f4f6',
              color: standingFilter === tab.key ? 'white' : 'var(--text-secondary)',
            }}
          >
            {tab.label}
            <span style={{
              background: standingFilter === tab.key ? 'rgba(255,255,255,0.25)' : '#e5e7eb',
              color: standingFilter === tab.key ? 'white' : 'var(--text-secondary)',
              borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 700,
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass" style={{ padding: '100px', textAlign: 'center' }}>Loading buyers...</div>
      ) : (
        <div className="glass" style={{ padding: '24px' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>ID Verified</th>
                  <th>Cart (Active/Stashed)</th>
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
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent-primary),var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                            {user.Avatar ? <img src={user.Avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${user.Fname?.[0] || '?'}${user.Lname?.[0] || '?'}`}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{user.Fname} {user.Lname}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {user.is_verified
                          ? <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}><UserCheck size={14} /> Verified</div>
                          : <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '13px' }}><ShieldOff size={14} /> Unverified</div>
                        }
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: (user.active_cart_count || 0) > 10 ? '#D32F2F' : 'var(--text-primary)' }}>
                            {user.active_cart_count || 0}
                          </span>
                          <span style={{ color: '#94a3b8' }}>/</span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: (user.stashed_cart_count || 0) > 20 ? '#6366f1' : 'var(--text-secondary)' }}>
                            {user.stashed_cart_count || 0}
                          </span>
                          {(user.stashed_cart_count || 0) > 30 && (
                            <span title="Potential Joy Reserver" style={{ background: '#fef2f2', color: '#dc2626', fontSize: '10px', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fecdd3', fontWeight: 700 }}>JOY?</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: (user.violation_record?.strike_count || 0) > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          {user.violation_record?.strike_count || 0}
                        </span>
                      </td>
                      <td><StandingBadge standing={getStanding(user)} /></td>
                      <td>
                        <button className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '12px' }}
                          onClick={e => { e.stopPropagation(); setSelectedUser(user); }}>
                          Manage
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                      No buyers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '460px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Banner */}
              {(() => {
                const standing = getStanding(selectedUser);
                return (
                  <div style={{ background: standing === 'Active' ? 'linear-gradient(135deg,#16a34a,#22c55e)' : standing === 'Probationary' ? 'linear-gradient(135deg,#d97706,#f59e0b)' : standing === 'Suspended' ? 'linear-gradient(135deg,#dc2626,#f87171)' : 'linear-gradient(135deg,#111,#374151)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {selectedUser.Avatar ? <img src={selectedUser.Avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${selectedUser.Fname?.[0] || '?'}${selectedUser.Lname?.[0] || '?'}`}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '16px', color: 'white' }}>{selectedUser.Fname} {selectedUser.Lname}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>{selectedUser.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                        {standing}
                      </span>
                      <button onClick={() => setSelectedUser(null)} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '8px', color: 'white', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center' }}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Body */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Account info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {[
                    { label: 'ID Verification', value: selectedUser.kyc_status || (selectedUser.is_verified ? 'approved' : 'none'), ok: selectedUser.is_verified },
                    { label: 'Strikes', value: String(selectedUser.violation_record?.strike_count || 0), ok: (selectedUser.violation_record?.strike_count || 0) === 0 },
                    { label: 'Active Cart', value: String(selectedUser.active_cart_count || 0), ok: (selectedUser.active_cart_count || 0) <= 12 },
                    { label: 'Stashed', value: String(selectedUser.stashed_cart_count || 0), ok: (selectedUser.stashed_cart_count || 0) <= 25 },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '12px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.label}</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: item.ok ? 'var(--text-primary)' : 'var(--danger)', textTransform: 'capitalize' }}>{item.value}</div>
                    </div>
                  ))}
                </div>


                {/* Standing actions */}
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Update Standing</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button disabled={updating} onClick={() => handleUpdateStanding(selectedUser.user_id, 'Active')}
                      className="btn btn-outline"
                      style={{ justifyContent: 'flex-start', gap: '8px', color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4', fontSize: '13px' }}>
                      <Shield size={15} /> Re-activate
                    </button>
                    <button disabled={updating} onClick={() => handleUpdateStanding(selectedUser.user_id, 'Probationary')}
                      className="btn btn-outline"
                      style={{ justifyContent: 'flex-start', gap: '8px', color: '#d97706', borderColor: '#fde68a', background: '#fffbeb', fontSize: '13px' }}>
                      <ShieldAlert size={15} /> Probationary
                    </button>
                    <button disabled={updating} onClick={() => handleUpdateStanding(selectedUser.user_id, 'Suspended')}
                      className="btn btn-outline"
                      style={{ justifyContent: 'flex-start', gap: '8px', color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', fontSize: '13px' }}>
                      <ShieldOff size={15} /> Suspend
                    </button>
                    <button disabled={updating} onClick={() => handleUpdateStanding(selectedUser.user_id, 'Blacklisted')}
                      className="btn btn-outline"
                      style={{ justifyContent: 'flex-start', gap: '8px', color: 'white', borderColor: '#111', background: '#111', fontSize: '13px' }}>
                      <Ban size={15} /> Blacklist
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;
