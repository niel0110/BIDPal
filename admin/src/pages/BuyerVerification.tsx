import React, { useState, useEffect } from 'react';
import { Check, X, Clock, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface User {
  user_id: string;
  Fname: string;
  Lname: string;
  email: string;
  contact_num: string;
  create_at: string;
  kyc_status: string;
  kyc_reviewed_at?: string | null;
  Avatar: string | null;
}

function KycPhoto({ userId, side, label }: { userId: string; side: 'front' | 'back'; label: string }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ok' | 'missing'>('loading');

  React.useEffect(() => {
    setStatus('loading');
    setUrl(null);
    supabase.storage
      .from('kyc-documents')
      .createSignedUrl(`${userId}_${side}.jpg`, 3600)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) {
          setStatus('missing');
        } else {
          setUrl(data.signedUrl);
          setStatus('ok');
        }
      });
  }, [userId, side]);

  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{label}</p>
      {status === 'loading' && (
        <div style={{ height: '140px', background: '#F1F5F9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
          Loading…
        </div>
      )}
      {status === 'missing' && (
        <div style={{ height: '140px', background: '#E2E8F0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
          No image uploaded
        </div>
      )}
      {status === 'ok' && url && (
        <img
          src={url}
          alt={label}
          onError={() => setStatus('missing')}
          style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', display: 'block', cursor: 'pointer' }}
          onClick={() => window.open(url, '_blank')}
        />
      )}
    </div>
  );
}

function statusBadge(kyc_status: string | null) {
  if (kyc_status === 'approved') return <span className="badge badge-success">Approved</span>;
  if (kyc_status === 'rejected') return <span className="badge badge-danger">Rejected</span>;
  if (kyc_status === 'pending') return <span className="badge badge-pending">Pending Review</span>;
  if (!kyc_status) return <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>Not Submitted</span>;
  return <span className="badge badge-pending" style={{ background: '#e0e7ff', color: '#3730a3' }}>ID Submitted</span>;
}

const BuyerVerification = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const fetchAllBuyers = async () => {
    const { data, error } = await supabase
      .from('User')
      .select('user_id, Fname, Lname, email, contact_num, create_at, kyc_status, Avatar')
      .or('role.eq.Buyer,role.eq.buyer')
      .order('create_at', { ascending: false });

    if (error) {
      console.error('BuyerVerification fetch error:', error);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const buyerIds = data.map((u: { user_id: string }) => u.user_id);

    const { data: notifs } = await supabase
      .from('Notifications')
      .select('user_id, created_at, payload')
      .in('user_id', buyerIds)
      .eq('type', 'system')
      .order('created_at', { ascending: false });

    const reviewMap: Record<string, string> = {};
    if (notifs) {
      for (const n of notifs) {
        if (!reviewMap[n.user_id] &&
          (n.payload?.title?.includes('Verification Approved') || n.payload?.title?.includes('Verification Rejected'))) {
          reviewMap[n.user_id] = n.created_at;
        }
      }
    }

    setUsers(data.map((u: any) => ({ ...u, kyc_reviewed_at: reviewMap[u.user_id] ?? null })));
    setLoading(false);
  };

  useEffect(() => {
    fetchAllBuyers();

    const channel = supabase
      .channel('buyer-verification')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'User' }, () => {
        fetchAllBuyers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAction = async (userId: string, status: 'approved' | 'rejected') => {
    setActionLoading(true);
    try {
      const reviewedAt = new Date().toISOString();

      const { error } = await supabase
        .from('User')
        .update({ kyc_status: status, is_verified: status === 'approved' })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.from('Notifications').insert([{
        user_id: userId,
        type: status === 'approved' ? 'kyc_approved' : 'kyc_rejected',
        payload: {
          title: status === 'approved' ? 'Buyer Verification Approved' : 'Buyer Verification Rejected',
          message: status === 'approved'
            ? 'Your identity has been verified. You now have full access to bidding and purchasing on BIDPal.'
            : 'Your submitted ID was not accepted. Please re-submit a clear, valid Philippine government-issued ID to complete verification.',
        },
        read_at: '2099-12-31T23:59:59.000Z',
        created_at: reviewedAt,
      }]);

      setUsers(prev => prev.map(u =>
        u.user_id === userId ? { ...u, kyc_status: status, kyc_reviewed_at: reviewedAt } : u
      ));
      setSelectedUser(prev => prev?.user_id === userId ? { ...prev, kyc_status: status, kyc_reviewed_at: reviewedAt } : prev);
    } catch (err) {
      console.error('Error updating verification status:', err);
      alert('Failed to update status. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const isDecided = (kyc_status: string | null) => kyc_status === 'approved' || kyc_status === 'rejected';

  const statusCounts = {
    all:      users.length,
    pending:  users.filter(u => !isDecided(u.kyc_status)).length,
    approved: users.filter(u => u.kyc_status === 'approved').length,
    rejected: users.filter(u => u.kyc_status === 'rejected').length,
  };

  const filtered = users.filter(u => {
    const nameMatch = `${u.Fname} ${u.Lname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch =
      statusFilter === 'all' ||
      (statusFilter === 'pending' && !isDecided(u.kyc_status)) ||
      u.kyc_status === statusFilter;
    return nameMatch && statusMatch;
  });

  const filterTabs: { key: typeof statusFilter; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: 'var(--accent-primary)' },
    { key: 'pending', label: 'Needs Review', color: '#f59e0b' },
    { key: 'approved', label: 'Approved', color: '#16a34a' },
    { key: 'rejected', label: 'Rejected', color: '#dc2626' },
  ];

  return (
    <div>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Buyer Verification</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review and approve buyer identity verifications.</p>
        </div>
        <div className="glass" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Search size={18} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Search buyers..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '200px' }}
          />
        </div>
      </header>

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            style={{
              padding: '7px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
              background: statusFilter === tab.key ? tab.color : '#f3f4f6',
              color: statusFilter === tab.key ? 'white' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {tab.label}
            <span style={{
              background: statusFilter === tab.key ? 'rgba(255,255,255,0.25)' : '#e5e7eb',
              color: statusFilter === tab.key ? 'white' : 'var(--text-secondary)',
              borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 700,
            }}>
              {statusCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass" style={{ padding: '100px', textAlign: 'center' }}>Loading buyer verifications...</div>
      ) : (
        <div className="glass" style={{ padding: '24px' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Submitted</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((user) => (
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
                          {user.Avatar ? (
                            <img src={user.Avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(45deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: 'white', flexShrink: 0 }}>
                              {user.Fname?.[0]}{user.Lname?.[0]}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 500 }}>{user.Fname} {user.Lname}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                          <Clock size={14} color="var(--text-secondary)" />
                          {new Date(user.create_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </td>
                      <td style={{ fontSize: '14px' }}>{user.contact_num || '—'}</td>
                      <td>{statusBadge(user.kyc_status)}</td>
                      <td>
                        <button onClick={e => { e.stopPropagation(); setSelectedUser(user); }} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>
                          Review
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                      No {statusFilter === 'pending' ? 'unreviewed' : statusFilter === 'all' ? '' : statusFilter} buyers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
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
              style={{ width: '600px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'white', borderRadius: '20px', boxShadow: '0 24px 64px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Coloured status banner at top */}
              {(() => {
                const bannerBg = selectedUser.kyc_status === 'approved'
                  ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                  : selectedUser.kyc_status === 'rejected'
                    ? 'linear-gradient(135deg,#dc2626,#f87171)'
                    : 'linear-gradient(135deg,#3b82f6,#6366f1)';
                const bannerLabel = selectedUser.kyc_status === 'approved' ? 'Verified Buyer' : selectedUser.kyc_status === 'rejected' ? 'Verification Rejected' : 'Pending Review';
                return (
                  <div style={{ background: bannerBg, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: 'white', flexShrink: 0, overflow: 'hidden' }}>
                        {selectedUser.Avatar
                          ? <img src={selectedUser.Avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : `${selectedUser.Fname?.[0]}${selectedUser.Lname?.[0]}`}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '16px', color: 'white' }}>{selectedUser.Fname} {selectedUser.Lname}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>{selectedUser.email}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ background: 'rgba(255,255,255,0.25)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(255,255,255,0.4)' }}>
                        {bannerLabel}
                      </span>
                      <button onClick={() => setSelectedUser(null)} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '8px', color: 'white', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center' }}>
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Body */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                {/* Meta row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>Contact Number</p>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{selectedUser.contact_num || '—'}</p>
                  </div>
                  <div style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '4px' }}>Registered</p>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                      {new Date(selectedUser.create_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Review timestamp */}
                {selectedUser.kyc_reviewed_at && (
                  <div style={{
                    padding: '12px 16px', borderRadius: '10px',
                    background: selectedUser.kyc_status === 'approved' ? '#f0fdf4' : '#fff1f2',
                    border: `1px solid ${selectedUser.kyc_status === 'approved' ? '#bbf7d0' : '#fecdd3'}`,
                    fontSize: '13px', fontWeight: 600,
                    color: selectedUser.kyc_status === 'approved' ? '#15803d' : '#be123c',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    {selectedUser.kyc_status === 'approved' ? <Check size={15} /> : <X size={15} />}
                    {selectedUser.kyc_status === 'approved' ? 'Approved' : 'Rejected'} on{' '}
                    {new Date(selectedUser.kyc_reviewed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}

                {/* ID Photos */}
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Submitted ID Document</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <KycPhoto userId={selectedUser.user_id} side="front" label="Front" />
                    <KycPhoto userId={selectedUser.user_id} side="back" label="Back" />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>Click an image to open full size.</p>
                </div>

                {/* Actions — only shown for unreviewed / pending buyers */}
                {!isDecided(selectedUser.kyc_status) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '4px', borderTop: '1px solid #E2E8F0' }}>
                    <button
                      onClick={() => handleAction(selectedUser.user_id, 'rejected')}
                      disabled={actionLoading}
                      className="btn btn-outline"
                      style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <X size={16} /> Reject
                    </button>
                    <button
                      onClick={() => handleAction(selectedUser.user_id, 'approved')}
                      disabled={actionLoading}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Check size={16} /> Approve
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BuyerVerification;
