import { useState, useEffect } from 'react';
import { RotateCcw, Clock, CheckCircle, XCircle, ExternalLink, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ReactivationRequest {
  id: string;
  user_id: string;
  email: string;
  user_name: string;
  status: 'pending' | 'approved' | 'rejected';
  id_document_url: string;
  id_document_front_url?: string | null;
  id_document_back_url?: string | null;
  user_message: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: '#d97706', bg: '#fffbeb', border: '#fde68a', Icon: Clock },
  approved: { label: 'Approved', color: '#16a34a', bg: '#f0fdf4', border: '#86efac', Icon: CheckCircle },
  rejected: { label: 'Rejected', color: '#cc2b41', bg: '#fef2f2', border: '#fecdd3', Icon: XCircle },
};

export default function ReactivationRequests() {
  const [requests, setRequests] = useState<ReactivationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<ReactivationRequest | null>(null);
  const [modalType, setModalType] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');

  const token = localStorage.getItem('admin_token');

  const fetchRequestsDirect = async () => {
    const { data: rows, error } = await supabase
      .from('Reactivation_Requests')
      .select('id, email, status, id_document_url, id_document_front_url, id_document_back_url, user_message, admin_notes, created_at, reviewed_at, user_id')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const userIds = [...new Set((rows || []).map(r => r.user_id).filter(Boolean))];
    let userMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('User')
        .select('user_id, Fname, Lname')
        .in('user_id', userIds);

      if (usersError) throw usersError;
      if (users) users.forEach(u => { userMap[u.user_id] = `${u.Fname} ${u.Lname}`; });
    }

    return (rows || []).map(r => ({
      ...r,
      id_document_front_url: r.id_document_front_url || r.id_document_url,
      id_document_back_url: r.id_document_back_url || null,
      user_name: userMap[r.user_id] || r.email,
    }));
  };

  const fetchRequests = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/reactivation`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load reactivation requests');
      }
      if (!Array.isArray(data)) {
        throw new Error('Unexpected reactivation response');
      }
      setRequests(data);
    } catch (err: any) {
      try {
        const fallbackRows = await fetchRequestsDirect();
        setRequests(fallbackRows);
        setLoadError(token ? 'Admin session expired on the API. Showing live Supabase data instead.' : 'Admin API token is missing. Showing live Supabase data instead.');
      } catch (fallbackErr: any) {
        setRequests([]);
        setLoadError(fallbackErr?.message || err?.message || 'Failed to load reactivation requests');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);
  useEffect(() => {
    const channel = supabase
      .channel('admin-reactivation-requests-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'Reactivation_Requests' },
        () => { fetchRequests(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const openApprove = (req: ReactivationRequest) => {
    setSelectedRequest(req);
    setAdminNotes('Your account has been reactivated. You may now log in and start fresh with a clean slate.');
    setActionError('');
    setModalType('approve');
  };

  const openReject = (req: ReactivationRequest) => {
    setSelectedRequest(req);
    setAdminNotes('');
    setActionError('');
    setModalType('reject');
  };

  const closeModal = () => {
    if (processing) return;
    setModalType(null);
    setSelectedRequest(null);
    setAdminNotes('');
    setActionError('');
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setProcessing(true);
    setActionError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/reactivation/${selectedRequest.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: adminNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve');
      closeModal();
      fetchRequests();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !adminNotes.trim()) {
      setActionError('Please provide a reason for rejection.');
      return;
    }
    setProcessing(true);
    setActionError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/reactivation/${selectedRequest.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: adminNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject');
      closeModal();
      fetchRequests();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <RotateCcw size={24} color="var(--accent-primary)" />
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#111', margin: 0, letterSpacing: '-0.02em' }}>
            Reactivation Requests
          </h1>
          {pendingCount > 0 && (
            <span style={{
              background: '#fef2f2', color: 'var(--accent-primary)', border: '1px solid #fecdd3',
              fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            }}>
              {pendingCount} pending
            </span>
          )}
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
          Review blacklisted user reactivation requests. Approving will permanently wipe all account data.
        </p>
        {loadError && (
          <div style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: '#fff7ed',
            border: '1px solid #fed7aa',
            color: '#9a3412',
            fontSize: '0.82rem',
            fontWeight: 600,
          }}>
            {loadError}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px', borderRadius: 8, border: '1.5px solid',
              borderColor: filter === f ? 'var(--accent-primary)' : '#e5e7eb',
              background: filter === f ? '#fef2f2' : 'white',
              color: filter === f ? 'var(--accent-primary)' : '#6b7280',
              fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit',
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #f3f4f6', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#9ca3af' }}>
            <RotateCcw size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No {filter === 'all' ? '' : filter} requests</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                {['User', 'Submitted', 'Status', 'ID Documents', 'Message', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((req, i) => {
                const cfg = STATUS_CONFIG[req.status];
                const StatusIcon = cfg.Icon;
                return (
                  <tr key={req.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f9fafb' : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    {/* User */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111' }}>{req.user_name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{req.email}</div>
                    </td>

                    {/* Date */}
                    <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {timeAgo(req.created_at)}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                        fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      }}>
                        <StatusIcon size={11} />
                        {cfg.label}
                      </span>
                    </td>

                    {/* ID Document */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <a
                          href={req.id_document_front_url || req.id_document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#2563eb', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}
                        >
                          <FileText size={13} />
                          Front ID
                          <ExternalLink size={11} />
                        </a>
                        {req.id_document_back_url && (
                          <a
                            href={req.id_document_back_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#2563eb', fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}
                          >
                            <FileText size={13} />
                            Back ID
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Message */}
                    <td style={{ padding: '14px 16px', maxWidth: 180 }}>
                      {req.user_message ? (
                        <span style={{ fontSize: '0.78rem', color: '#374151', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                          {req.user_message}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#d1d5db' }}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px' }}>
                      {req.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => openApprove(req)}
                            style={{
                              padding: '5px 12px', borderRadius: 7, border: 'none',
                              background: '#16a34a', color: 'white',
                              fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openReject(req)}
                            style={{
                              padding: '5px 12px', borderRadius: 7, border: '1.5px solid #fecdd3',
                              background: 'white', color: '#cc2b41',
                              fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                            {req.reviewed_at ? timeAgo(req.reviewed_at) : '—'}
                          </div>
                          {req.admin_notes && (
                            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {req.admin_notes}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Approve Modal ── */}
      {modalType === 'approve' && selectedRequest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={20} color="#16a34a" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111' }}>Approve Reactivation</div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{selectedRequest.user_name} · {selectedRequest.email}</div>
                </div>
              </div>

              {/* Warning */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, marginBottom: 16 }}>
                <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: '0.78rem', color: '#92400e', lineHeight: 1.5 }}>
                  <strong>This action cannot be undone.</strong> All bids, orders, transaction history,
                  reviews, and platform activity will be permanently deleted. The user will start fresh
                  with only their email address preserved.
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Message to User
                </label>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: '#111', lineHeight: 1.5 }}
                />
              </div>

              {actionError && <p style={{ color: '#cc2b41', fontSize: '0.82rem', fontWeight: 600, margin: '0 0 12px' }}>{actionError}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 24px 24px' }}>
              <button onClick={closeModal} disabled={processing} style={{ padding: '0.75rem', border: '1.5px solid #e5e7eb', borderRadius: 10, background: 'white', color: '#374151', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={handleApprove} disabled={processing} style={{ padding: '0.75rem', border: 'none', borderRadius: 10, background: '#16a34a', color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: processing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: processing ? 0.7 : 1 }}>
                {processing ? 'Processing…' : 'Approve & Wipe Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {modalType === 'reject' && selectedRequest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <XCircle size={20} color="#cc2b41" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#111' }}>Reject Request</div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{selectedRequest.user_name} · {selectedRequest.email}</div>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Reason for Rejection <span style={{ color: '#cc2b41' }}>*</span>
                </label>
                <textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  rows={4}
                  placeholder="Explain why the request is being denied…"
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: '#111', lineHeight: 1.5 }}
                />
              </div>

              {actionError && <p style={{ color: '#cc2b41', fontSize: '0.82rem', fontWeight: 600, margin: '0 0 12px' }}>{actionError}</p>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 24px 24px' }}>
              <button onClick={closeModal} disabled={processing} style={{ padding: '0.75rem', border: '1.5px solid #e5e7eb', borderRadius: 10, background: 'white', color: '#374151', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={handleReject} disabled={processing} style={{ padding: '0.75rem', border: 'none', borderRadius: 10, background: '#cc2b41', color: 'white', fontWeight: 700, fontSize: '0.875rem', cursor: processing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: processing ? 0.7 : 1 }}>
                {processing ? 'Rejecting…' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
