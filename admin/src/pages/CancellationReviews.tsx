import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, User } from 'lucide-react';
import api from '../api/axios';

interface CancellationRecord {
  cancellation_id: string;
  auction_id: string;
  order_id: string | null;
  reason: string;
  within_window: boolean;
  weekly_cancellation_number: number;
  triggered_violation: boolean;
  cancelled_at: string;
  User: { user_id: string; email: string; Fname: string; Lname: string } | null;
  Auctions: { Products: { name: string; Product_Images: { image_url: string }[] } } | null;
  Violation_Events: {
    violation_event_id: string;
    strike_number: number;
    resolution_status: string;
    Moderation_Cases: { moderation_case_id: string; case_status: string; decision: string | null } | null;
  } | null;
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function strikeColor(n: number) {
  if (n === 1) return '#f59e0b';
  if (n === 2) return '#f97316';
  return '#dc2626';
}

const CancellationReviews = () => {
  const [records, setRecords] = useState<CancellationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [note, setNote] = useState('');

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await api.get('/violations/moderation/cancellation-reviews');
      setRecords(res.data);
    } catch (err) {
      console.error('Error fetching cancellation reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleAction = async (cancellationId: string, action: 'validate' | 'flag') => {
    setActionLoading(cancellationId + action);
    try {
      await api.post(`/violations/moderation/cancellation-reviews/${cancellationId}/${action}`, {
        moderator_note: note
      });
      setNote('');
      setExpanded(null);
      await fetchRecords();
    } catch (err) {
      console.error('Action failed:', err);
      alert('Action failed. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = records.filter(r => {
    const status = r.Violation_Events?.Moderation_Cases?.case_status;
    if (filter === 'pending') return !status || status === 'pending' || status === 'under_review';
    if (filter === 'resolved') return status === 'resolved';
    return true;
  });

  const pendingCount = records.filter(r => {
    const s = r.Violation_Events?.Moderation_Cases?.case_status;
    return !s || s === 'pending' || s === 'under_review';
  }).length;

  return (
    <div style={{ maxWidth: '900px' }}>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px' }}>Cancellation Reviews</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Review buyer cancellation reasons and decide to validate or flag as bogus.
          </p>
        </div>
        <button
          onClick={fetchRecords}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px' }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['all', 'pending', 'resolved'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              background: filter === f ? '#7C3AED' : '#f3f4f6',
              color: filter === f ? 'white' : 'var(--text-secondary)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && pendingCount > 0 && (
              <span style={{ marginLeft: '6px', background: '#dc2626', color: 'white', borderRadius: '10px', padding: '1px 7px', fontSize: '11px' }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="glass" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No cancellation records found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(record => {
            const isExpanded = expanded === record.cancellation_id;
            const ve = record.Violation_Events;
            const mc = ve?.Moderation_Cases;
            const isResolved = mc?.case_status === 'resolved';
            const productName = record.Auctions?.Products?.name || 'Unknown Item';
            const image = record.Auctions?.Products?.Product_Images?.[0]?.image_url;
            const buyerName = record.User ? `${record.User.Fname} ${record.User.Lname}` : 'Unknown';

            return (
              <div
                key={record.cancellation_id}
                className="glass"
                style={{ borderRadius: '12px', overflow: 'hidden', border: ve ? `2px solid ${strikeColor(ve.strike_number)}22` : '1px solid #e5e7eb' }}
              >
                {/* Row header */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : record.cancellation_id)}
                  style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
                >
                  {image ? (
                    <img src={image} alt={productName} style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px' }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', background: '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={20} color="#9ca3af" />
                    </div>
                  )}

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{productName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <User size={11} style={{ marginRight: '3px' }} />
                      {buyerName} · {record.User?.email}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {ve && (
                      <span style={{ background: strikeColor(ve.strike_number) + '20', color: strikeColor(ve.strike_number), padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                        Strike {ve.strike_number}
                      </span>
                    )}
                    {!ve && (
                      <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>
                        No violation
                      </span>
                    )}
                    <span style={{
                      background: isResolved ? '#d1fae5' : '#fef3c7',
                      color: isResolved ? '#065f46' : '#92400e',
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600
                    }}>
                      {isResolved ? mc?.decision || 'Resolved' : 'Pending'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>{timeAgo(record.cancelled_at)}</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f4f6' }}>
                    <div style={{ paddingTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Buyer's Reason</div>
                        <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', minHeight: '60px' }}>
                          {record.reason || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No reason provided</span>}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Details</div>
                        <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span>Cancellation #{record.weekly_cancellation_number} this week</span>
                          <span>{record.within_window ? '✅ Within payment window' : '⚠️ Outside payment window'}</span>
                          <span>{record.triggered_violation ? '⚡ Triggered a violation' : 'No violation triggered'}</span>
                          {ve && <span>Resolution: <strong>{ve.resolution_status}</strong></span>}
                        </div>
                      </div>
                    </div>

                    {!isResolved && (
                      <>
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px' }}>Moderator Note (optional)</label>
                          <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Add a note about this decision..."
                            style={{ width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '8px 12px', fontSize: '13px', resize: 'vertical', minHeight: '60px', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => handleAction(record.cancellation_id, 'validate')}
                            disabled={!!actionLoading}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#059669', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
                          >
                            <CheckCircle size={15} />
                            {actionLoading === record.cancellation_id + 'validate' ? 'Processing...' : 'Validate Reason'}
                          </button>
                          <button
                            onClick={() => handleAction(record.cancellation_id, 'flag')}
                            disabled={!!actionLoading}
                            style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' }}
                          >
                            <XCircle size={15} />
                            {actionLoading === record.cancellation_id + 'flag' ? 'Processing...' : 'Flag as Bogus'}
                          </button>
                        </div>
                      </>
                    )}

                    {isResolved && (
                      <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={16} color="#059669" />
                        <span style={{ fontSize: '13px', color: '#065f46' }}>
                          Decision: <strong>{mc?.decision || 'resolved'}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CancellationReviews;
