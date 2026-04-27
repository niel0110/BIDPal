import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, ChevronDown, ChevronUp, User, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SellerInfo {
  user_id: string;
  store_name: string;
}

interface AuctionInfo {
  auction_id: string;
  products_id: string;
  seller_id: string;
  Seller: SellerInfo | null;
  Products: { name: string; Product_Images: { image_url: string }[] } | null;
}

interface CancellationRecord {
  cancellation_id: string;
  auction_id: string;
  order_id: string | null;
  reason: string;
  within_window: boolean;
  weekly_cancellation_number: number;
  triggered_violation: boolean;
  cancelled_at: string;
  moderation_status: string | null;
  User: { user_id: string; email: string; Fname: string; Lname: string } | null;
  Auctions: AuctionInfo | null;
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

function buyerName(user: CancellationRecord['User']) {
  if (!user) return 'Unknown';
  const name = `${user.Fname || ''} ${user.Lname || ''}`.trim();
  return name || user.email || 'Unknown';
}

const CancellationReviews = () => {
  const [records, setRecords] = useState<CancellationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchRecords = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('Order_Cancellations')
      .select(`
        cancellation_id,
        auction_id,
        order_id,
        reason,
        within_window,
        weekly_cancellation_number,
        triggered_violation,
        cancelled_at,
        moderation_status,
        violation_event_id,
        User:user_id (user_id, email, Fname, Lname),
        Auctions:auction_id (
          auction_id,
          products_id,
          seller_id,
          Seller:seller_id (user_id, store_name),
          Products:products_id (name, Product_Images(image_url))
        ),
        Violation_Events:violation_event_id (
          violation_event_id,
          strike_number,
          resolution_status,
          Moderation_Cases (moderation_case_id, case_status, decision)
        )
      `)
      .order('cancelled_at', { ascending: false })
      .limit(200);

    if (!error && data) setRecords(data as unknown as CancellationRecord[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();

    const channel = supabase
      .channel('cancellations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Order_Cancellations' }, fetchRecords)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Moderation_Cases' }, fetchRecords)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const sendNotification = async (userId: string, type: string, title: string, message: string, referenceType: string) => {
    await supabase.from('Notifications').insert([{
      user_id: userId,
      type,
      payload: { title, message },
      reference_type: referenceType,
      read_at: '2099-12-31T23:59:59.000Z',
    }]);
  };

  const handleAction = async (cancellationId: string, action: 'validate' | 'flag') => {
    setActionLoading(cancellationId + action);
    const record = records.find(r => r.cancellation_id === cancellationId);
    if (!record) return;

    const ve = record.Violation_Events;
    const buyerId = record.User?.user_id;
    const sellerId = (record.Auctions as any)?.Seller?.user_id;
    const productName = (record.Auctions as any)?.Products?.name || 'the item';
    const storeName = (record.Auctions as any)?.Seller?.store_name || 'the seller';
    const isValidate = action === 'validate';

    try {
      // 1. Update Order_Cancellations moderation status
      await supabase
        .from('Order_Cancellations')
        .update({
          moderation_status: isValidate ? 'validated' : 'flagged',
          moderator_note: note || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('cancellation_id', cancellationId);

      // 2. Update Violation_Events resolution
      if (ve?.violation_event_id) {
        await supabase
          .from('Violation_Events')
          .update({ resolution_status: isValidate ? 'resolved' : 'confirmed' })
          .eq('violation_event_id', ve.violation_event_id);
      }

      // 3. Update Moderation_Cases
      if (ve?.Moderation_Cases?.moderation_case_id) {
        await supabase
          .from('Moderation_Cases')
          .update({
            case_status: 'resolved',
            decision: isValidate ? 'reduce_strike' : 'confirm_violation',
            decision_reason: note || (isValidate ? 'Cancellation reason validated by admin' : 'Flagged as bogus buyer'),
            resolved_at: new Date().toISOString(),
          })
          .eq('moderation_case_id', ve.Moderation_Cases.moderation_case_id);
      }

      // 4. For flag: mark buyer account in Violation_Records
      if (!isValidate && buyerId) {
        await supabase
          .from('Violation_Records')
          .update({ account_status: 'flagged_bogus' })
          .eq('user_id', buyerId);
      }

      // 5. Notify buyer
      if (buyerId) {
        await sendNotification(
          buyerId,
          isValidate ? 'order_update' : 'account_violation',
          isValidate ? '✅ Cancellation Validated' : '🚫 Cancellation Flagged',
          isValidate
            ? `Your cancellation for "${productName}" has been reviewed and validated by our team.${ve ? ' Your strike has been reduced.' : ''}`
            : `Your cancellation for "${productName}" was flagged as invalid by our team. Further violations may result in account suspension.`,
          'cancellation'
        );
      }

      // 6. Notify seller
      if (sellerId) {
        await sendNotification(
          sellerId,
          'order_update',
          isValidate ? '📦 Order Cancellation Approved' : '⚠️ Cancellation Dispute Resolved',
          isValidate
            ? `A buyer's cancellation for "${productName}" has been validated. The order has been officially cancelled.`
            : `A fraudulent cancellation attempt for "${productName}" was flagged by our team. The buyer has been penalized.`,
          'cancellation'
        );
      }

      setNote('');
      setExpanded(null);
      showToast(isValidate ? 'Cancellation validated — buyer & seller notified.' : 'Flagged as bogus — buyer & seller notified.');
      await fetchRecords();
    } catch (err) {
      console.error('Action failed:', err);
      showToast('Action failed. Please try again.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const isResolved = (r: CancellationRecord) => {
    const mc = r.Violation_Events?.Moderation_Cases?.case_status;
    const ms = r.moderation_status;
    return mc === 'resolved' || ms === 'validated' || ms === 'flagged';
  };

  const filtered = records.filter(r => {
    if (filter === 'pending') return !isResolved(r);
    if (filter === 'resolved') return isResolved(r);
    return true;
  });

  const pendingCount = records.filter(r => !isResolved(r)).length;

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          background: toast.type === 'success' ? '#059669' : '#dc2626',
          color: 'white', padding: '12px 20px', borderRadius: '10px',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <Bell size={16} /> {toast.msg}
        </div>
      )}

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
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </header>

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
            const resolved = isResolved(record);
            const productName = (record.Auctions as any)?.Products?.name || 'Unknown Item';
            const image = (record.Auctions as any)?.Products?.Product_Images?.[0]?.image_url;
            const name = buyerName(record.User);
            const storeName = (record.Auctions as any)?.Seller?.store_name;

            const resolutionLabel = mc?.decision === 'reduce_strike' || record.moderation_status === 'validated'
              ? 'Validated'
              : mc?.decision === 'confirm_violation' || record.moderation_status === 'flagged'
                ? 'Flagged as Bogus'
                : mc?.decision || 'Resolved';

            return (
              <div
                key={record.cancellation_id}
                className="glass"
                style={{ borderRadius: '12px', overflow: 'hidden', border: ve ? `2px solid ${strikeColor(ve.strike_number)}22` : '1px solid #e5e7eb' }}
              >
                <div
                  onClick={() => setExpanded(isExpanded ? null : record.cancellation_id)}
                  style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
                >
                  {image ? (
                    <img src={image} alt={productName} style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', background: '#f3f4f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={20} color="#9ca3af" />
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {name} · {record.User?.email || '—'}
                      {storeName && <span style={{ marginLeft: '6px', color: '#7C3AED' }}>• {storeName}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    {ve ? (
                      <span style={{ background: strikeColor(ve.strike_number) + '20', color: strikeColor(ve.strike_number), padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                        Strike {ve.strike_number}
                      </span>
                    ) : (
                      <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '3px 10px', borderRadius: '20px', fontSize: '12px' }}>
                        No violation
                      </span>
                    )}
                    <span style={{
                      background: resolved ? '#d1fae5' : '#fef3c7',
                      color: resolved ? '#065f46' : '#92400e',
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                    }}>
                      {resolved ? resolutionLabel : 'Pending'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>{timeAgo(record.cancelled_at)}</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

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
                          {storeName && <span>Seller: <strong>{storeName}</strong></span>}
                          {ve && <span>Strike resolution: <strong>{ve.resolution_status}</strong></span>}
                        </div>
                      </div>
                    </div>

                    {!resolved ? (
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
                        <div style={{ marginBottom: '8px', fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Bell size={12} /> Buyer{sellerId(record) ? ' & seller' : ''} will be notified automatically.
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
                    ) : (
                      <div style={{ padding: '12px 16px', borderRadius: '8px', background: resolutionLabel.includes('Validated') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${resolutionLabel.includes('Validated') ? '#bbf7d0' : '#fecaca'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {resolutionLabel.includes('Validated')
                          ? <CheckCircle size={16} color="#059669" />
                          : <AlertTriangle size={16} color="#dc2626" />
                        }
                        <span style={{ fontSize: '13px', color: resolutionLabel.includes('Validated') ? '#065f46' : '#991b1b' }}>
                          Decision: <strong>{resolutionLabel}</strong>
                          {mc?.decision_reason && <span style={{ marginLeft: '6px', opacity: 0.8 }}>— {(mc as any).decision_reason}</span>}
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

// Helper to get seller user_id from a record
function sellerId(record: CancellationRecord): string | null {
  return (record.Auctions as any)?.Seller?.user_id || null;
}

export default CancellationReviews;
