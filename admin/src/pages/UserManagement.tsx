import { useState, useEffect } from 'react';
import { Search, Shield, ShieldAlert, ShieldOff, UserCheck, X, Ban, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface ViolationRecord {
  account_status: string;
  strike_count: number;
  suspension_expires_at?: string | null;
  suspension_reason?: string | null;
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

interface SuspendOptions {
  suspensionDays?: number;
  suspensionUntil?: string;
  reason?: string;
  
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
  // role === 'Banned' is the authoritative blacklist signal
  if (user.role === 'Banned') return 'Blacklisted';
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

// ── Generic Confirmation Modal ────────────────────────────────────────────────
interface ConfirmActionModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor: string;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmActionModal = ({ title, message, confirmLabel, confirmColor, onConfirm, onClose }: ConfirmActionModalProps) => (
  <div
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
    onClick={onClose}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 16 }}
      style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '380px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', borderTop: `5px solid ${confirmColor}` }}
      onClick={e => e.stopPropagation()}
    >
      <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800, color: '#111' }}>{title}</h3>
      <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '14px', lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onClose}
          style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: confirmColor, color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {confirmLabel}
        </button>
      </div>
    </motion.div>
  </div>
);
// ─────────────────────────────────────────────────────────────────────────────

// ── Suspend Duration Modal ────────────────────────────────────────────────────
interface SuspendModalProps {
  user: User;
  onConfirm: (opts: SuspendOptions) => void;
  onClose: () => void;
}

const DURATION_OPTIONS: { label: string; value: number | 'custom' }[] = [
  { label: '3 Days',  value: 3  },
  { label: '7 Days',  value: 7  },
  { label: '30 Days', value: 30 },
  { label: 'Custom',  value: 'custom' },
];

const SuspendModal = ({ user, onConfirm, onClose }: SuspendModalProps) => {
  const [selectedDays, setSelectedDays] = useState<number | 'custom'>(7);
  const [customDate, setCustomDate] = useState('');
  const [reason, setReason] = useState('');

  const minDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const handleConfirm = () => {
    if (selectedDays === 'custom') {
      if (!customDate) { alert('Please select a custom end date.'); return; }
      onConfirm({ suspensionUntil: customDate, reason: reason.trim() || undefined });
    } else {
      onConfirm({ suspensionDays: selectedDays, reason: reason.trim() || undefined });
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', borderTop: '5px solid #dc2626' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: '#111' }}>Suspend Account</h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>{user.Fname} {user.Lname} &middot; {user.email}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', borderRadius: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Duration */}
        <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#9ca3af' }}>Suspension Duration</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {DURATION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSelectedDays(opt.value)}
              style={{
                padding: '8px 16px', borderRadius: '20px', border: '1.5px solid', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
                background: selectedDays === opt.value ? '#dc2626' : 'white',
                color:      selectedDays === opt.value ? 'white'    : '#374151',
                borderColor: selectedDays === opt.value ? '#dc2626' : '#e5e7eb',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Custom date */}
        {selectedDays === 'custom' && (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#9ca3af' }}>End Date</p>
            <input
              type="date"
              value={customDate}
              min={minDate}
              onChange={e => setCustomDate(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
        )}

        {/* Reason */}
        <div style={{ marginBottom: '24px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#9ca3af' }}>Reason <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></p>
          <textarea
            placeholder="e.g. Repeated payment violations..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#dc2626,#991b1b)', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,38,38,0.3)', fontFamily: 'inherit' }}
          >
            Confirm Suspension
          </button>
        </div>
      </motion.div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [updating, setUpdating] = useState(false);
  const [standingFilter, setStandingFilter] = useState<string>('all');
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ title: string; message: string; confirmLabel: string; confirmColor: string; onConfirm: () => void } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: userData, error } = await supabase
      .from('User')
      .select('user_id, Fname, Lname, email, role, is_verified, Avatar, kyc_status')
      .or('role.eq.Buyer,role.eq.buyer,role.eq.Banned')
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

    const ids = userData.map((u: any) => u.user_id);

    const { data: vrData, error: vrError } = await supabase
      .from('Violation_Records')
      .select('*')
      .in('user_id', ids);

    if (vrError) console.error('Violation_Records fetch error:', vrError);

    const vrMap: Record<string, any> = {};
    if (vrData) {
      for (const vr of vrData as any[]) vrMap[vr.user_id] = vr;
    }

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
      stashed_cart_count: cartMap[u.user_id]?.stashed || 0,
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

  const handleUpdateStanding = async (userId: string, standing: string, opts?: SuspendOptions) => {
    const account_status = STANDING_TO_STATUS[standing] || 'clean';
    setUpdating(true);
    try {
      const { data: existing } = await supabase
        .from('Violation_Records')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      const updatePayload: any = { account_status };

      if (standing === 'Suspended') {
        let expires: Date | null = null;
        if (opts?.suspensionUntil) {
          expires = new Date(opts.suspensionUntil);
        } else if (opts?.suspensionDays) {
          expires = new Date();
          expires.setDate(expires.getDate() + opts.suspensionDays);
        }
        updatePayload.suspension_expires_at = expires ? expires.toISOString() : null;
        updatePayload.suspension_reason = opts?.reason || null;
      } else {
        updatePayload.suspension_expires_at = null;
        updatePayload.suspension_reason = null;
      }

      if (existing) {
        await supabase.from('Violation_Records').update(updatePayload).eq('user_id', userId);
      } else {
        await supabase.from('Violation_Records').insert([{ user_id: userId, strike_count: 0, ...updatePayload }]);
      }

      if (standing === 'Blacklisted') {
        await supabase.from('User').update({ role: 'Banned' }).eq('user_id', userId);
      } else {
        const { data: uRow } = await supabase.from('User').select('role').eq('user_id', userId).single();
        if (uRow?.role === 'Banned') {
          await supabase.from('User').update({ role: 'Buyer' }).eq('user_id', userId);
        }
      }

      setSelectedUser(prev => prev ? {
        ...prev,
        violation_record: {
          account_status,
          strike_count: prev.violation_record?.strike_count || 0,
          suspension_expires_at: updatePayload.suspension_expires_at,
          suspension_reason: updatePayload.suspension_reason,
        }
      } : null);

      setShowSuspendModal(false);
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
    { key: 'all',          label: 'All Buyers',  count: counts.all,          color: 'var(--accent-primary)' },
    { key: 'Active',       label: 'Active',       count: counts.Active,       color: '#16a34a' },
    { key: 'Probationary', label: 'Probationary', count: counts.Probationary, color: '#d97706' },
    { key: 'Suspended',    label: 'Suspended',    count: counts.Suspended,    color: '#dc2626' },
    { key: 'Blacklisted',  label: 'Blacklisted',  count: counts.Blacklisted,  color: '#111' },
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
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <StandingBadge standing={getStanding(user)} />
                          {getStanding(user) === 'Suspended' && user.violation_record?.suspension_expires_at && (
                            <span style={{ fontSize: '11px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Clock size={10} />
                              Until {new Date(user.violation_record.suspension_expires_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      </td>
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
                    <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
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
            onClick={() => { setSelectedUser(null); setShowSuspendModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Banner */}
              {(() => {
                const standing = getStanding(selectedUser);
                const bannerBg =
                  standing === 'Active'       ? 'linear-gradient(135deg,#16a34a,#22c55e)' :
                  standing === 'Probationary' ? 'linear-gradient(135deg,#d97706,#f59e0b)' :
                  standing === 'Suspended'    ? 'linear-gradient(135deg,#dc2626,#f87171)' :
                                                'linear-gradient(135deg,#111,#374151)';
                return (
                  <div style={{ background: bannerBg, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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

                {/* Account info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {[
                    { label: 'ID Verification', value: selectedUser.kyc_status || (selectedUser.is_verified ? 'approved' : 'none'), ok: selectedUser.is_verified },
                    { label: 'Strikes',          value: String(selectedUser.violation_record?.strike_count || 0), ok: (selectedUser.violation_record?.strike_count || 0) === 0 },
                    { label: 'Active Cart',      value: String(selectedUser.active_cart_count || 0), ok: (selectedUser.active_cart_count || 0) <= 12 },
                    { label: 'Stashed',          value: String(selectedUser.stashed_cart_count || 0), ok: (selectedUser.stashed_cart_count || 0) <= 25 },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '12px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{item.label}</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: item.ok ? 'var(--text-primary)' : 'var(--danger)', textTransform: 'capitalize' }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Suspension info banner */}
                {getStanding(selectedUser) === 'Suspended' && selectedUser.violation_record?.suspension_expires_at && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Clock size={15} color="#dc2626" style={{ flexShrink: 0 }} />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>
                        Suspended until {new Date(selectedUser.violation_record.suspension_expires_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                      {selectedUser.violation_record.suspension_reason && (
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                          Reason: {selectedUser.violation_record.suspension_reason}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Standing actions */}
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Update Standing</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button disabled={updating} onClick={() => setPendingAction({
                        title: 'Re-activate Account',
                        message: `Are you sure you want to re-activate ${selectedUser.Fname} ${selectedUser.Lname}'s account? This will restore full platform access.`,
                        confirmLabel: 'Re-activate',
                        confirmColor: '#16a34a',
                        onConfirm: () => handleUpdateStanding(selectedUser.user_id, 'Active'),
                      })}
                      className="btn btn-outline"
                      style={{ justifyContent: 'flex-start', gap: '8px', color: '#16a34a', borderColor: '#bbf7d0', background: '#f0fdf4', fontSize: '13px' }}>
                      <Shield size={15} /> Re-activate
                    </button>
                    <button disabled={updating} onClick={() => setPendingAction({
                        title: 'Set Probationary',
                        message: `Are you sure you want to place ${selectedUser.Fname} ${selectedUser.Lname} on probation? They will see a persistent warning banner in the app.`,
                        confirmLabel: 'Set Probationary',
                        confirmColor: '#d97706',
                        onConfirm: () => handleUpdateStanding(selectedUser.user_id, 'Probationary'),
                      })}
                      className="btn btn-outline"
                      style={{ justifyContent: 'flex-start', gap: '8px', color: '#d97706', borderColor: '#fde68a', background: '#fffbeb', fontSize: '13px' }}>
                      <ShieldAlert size={15} /> Probationary
                    </button>
                    <button disabled={updating} onClick={() => setShowSuspendModal(true)}
                      className="btn btn-outline"
                      style={{ justifyContent: 'flex-start', gap: '8px', color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', fontSize: '13px' }}>
                      <ShieldOff size={15} /> Suspend
                    </button>
                    <button disabled={updating} onClick={() => setPendingAction({
                        title: 'Blacklist Account',
                        message: `Are you sure you want to permanently blacklist ${selectedUser.Fname} ${selectedUser.Lname}? They will be banned from logging in and all access will be revoked.`,
                        confirmLabel: 'Blacklist',
                        confirmColor: '#111',
                        onConfirm: () => handleUpdateStanding(selectedUser.user_id, 'Blacklisted'),
                      })}
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

      {/* Suspend Duration Modal */}
      <AnimatePresence>
        {showSuspendModal && selectedUser && (
          <SuspendModal
            user={selectedUser}
            onConfirm={opts => handleUpdateStanding(selectedUser.user_id, 'Suspended', opts)}
            onClose={() => setShowSuspendModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Generic Confirmation Modal */}
      <AnimatePresence>
        {pendingAction && (
          <ConfirmActionModal
            title={pendingAction.title}
            message={pendingAction.message}
            confirmLabel={pendingAction.confirmLabel}
            confirmColor={pendingAction.confirmColor}
            onConfirm={pendingAction.onConfirm}
            onClose={() => setPendingAction(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;
