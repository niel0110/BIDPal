import React, { useState, useEffect } from 'react';
import { Scale, Clock, RefreshCw, X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface Dispute {
  dispute_id: string;
  order_id: string;
  reporter_id: string;
  reason: string;
  status: string;
  created_at: string;
  User: { Fname: string; Lname: string } | null;
  Orders: { total_amount: number } | null;
}

const Disputes = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open');

  const fetchDisputes = async () => {
    setLoading(true);
    let query = supabase
      .from('Disputes')
      .select('dispute_id, order_id, reporter_id, reason, status, created_at, User:reporter_id(Fname, Lname), Orders(total_amount)')
      .order('created_at', { ascending: false });

    if (filter !== 'all') query = query.eq('status', filter);

    const { data, error } = await query;
    if (!error && data) setDisputes(data as Dispute[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchDisputes();

    const channel = supabase
      .channel('disputes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Disputes' }, fetchDisputes)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [filter]);

  const handleResolve = async (id: string, resolution: 'refund' | 'escrow_release' | 'partial_settlement') => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('Disputes')
        .update({
          status: 'resolved',
          resolution_type: resolution,
          resolved_at: new Date().toISOString(),
        })
        .eq('dispute_id', id);

      if (error) throw error;
      setDisputes(prev => prev.filter(d => d.dispute_id !== id));
      setSelectedDispute(null);
    } catch (err) {
      console.error('Error resolving dispute:', err);
      alert('Failed to resolve dispute.');
    } finally {
      setActionLoading(false);
    }
  };

  const resolutionLabel: Record<string, string> = {
    refund: 'Full Refund to Buyer',
    escrow_release: 'Release Payment to Seller',
    partial_settlement: 'Partial Settlement',
  };

  const openCount = disputes.filter(d => d.status === 'open').length;

  return (
    <div className="disputes-page">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Dispute Resolution</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Mediate conflicts between buyers and sellers.</p>
        </div>
        <button onClick={fetchDisputes} className="btn btn-outline" style={{ padding: '8px 12px' }}>
          <RefreshCw size={18} className={loading ? 'spin' : ''} />
        </button>
      </header>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['open', 'resolved', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 18px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              background: filter === f ? 'var(--accent-primary)' : '#f3f4f6',
              color: filter === f ? 'white' : 'var(--text-secondary)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'open' && openCount > 0 && (
              <span style={{ marginLeft: '6px', background: 'var(--danger)', color: 'white', borderRadius: '10px', padding: '1px 7px', fontSize: '11px' }}>
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass" style={{ padding: '100px', textAlign: 'center' }}>Loading disputes...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedDispute ? '1fr 400px' : '1fr', gap: '24px', transition: 'all 0.3s ease' }}>
          <div className="glass" style={{ padding: '24px' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Reporter</th>
                    <th>Reason</th>
                    <th>Order Amount</th>
                    <th>Date Filed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {disputes.map(d => (
                      <motion.tr
                        key={d.dispute_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedDispute(d)}
                        style={{ cursor: 'pointer', background: selectedDispute?.dispute_id === d.dispute_id ? '#FEF2F2' : 'transparent' }}
                      >
                        <td>
                          <div style={{ fontWeight: 500 }}>{d.User ? `${d.User.Fname} ${d.User.Lname}` : '—'}</div>
                        </td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '14px' }}>
                          {d.reason}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {d.Orders ? `₱${d.Orders.total_amount.toLocaleString()}` : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <Clock size={13} />
                            {new Date(d.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${d.status === 'open' ? 'badge-pending' : 'badge-success'}`}>
                            {d.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {disputes.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No disputes found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <AnimatePresence>
            {selectedDispute && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass"
                style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '20px' }}>Dispute Mediation</h3>
                  <button onClick={() => setSelectedDispute(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Reporter: <strong>{selectedDispute.User ? `${selectedDispute.User.Fname} ${selectedDispute.User.Lname}` : '—'}</strong>
                    </p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <MessageSquare size={16} color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <p style={{ fontSize: '14px', lineHeight: '1.5' }}>"{selectedDispute.reason}"</p>
                    </div>
                  </div>

                  <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Order Details</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Order ID</span>
                        <span style={{ fontWeight: 500 }}>{selectedDispute.order_id || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Amount</span>
                        <span style={{ fontWeight: 600 }}>{selectedDispute.Orders ? `₱${selectedDispute.Orders.total_amount.toLocaleString()}` : '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Filed</span>
                        <span>{new Date(selectedDispute.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedDispute.status === 'open' ? (
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Resolution Action</p>
                    {(['refund', 'escrow_release', 'partial_settlement'] as const).map(res => (
                      <button
                        key={res}
                        onClick={() => handleResolve(selectedDispute.dispute_id, res)}
                        disabled={actionLoading}
                        className={res === 'refund' ? 'btn btn-primary' : 'btn btn-outline'}
                        style={{ justifyContent: 'center' }}
                      >
                        {resolutionLabel[res]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '13px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Scale size={15} /> This dispute has been resolved.
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default Disputes;
