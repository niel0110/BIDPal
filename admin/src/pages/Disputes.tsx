import React, { useState, useEffect } from 'react';
import { Scale, Search, Clock, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/axios';

interface Dispute {
  dispute_id: string;
  order_id: string;
  reporter_id: string;
  reason: string;
  status: string;
  created_at: string;
  User: { Fname: string; Lname: string };
  Orders: { total_amount: number };
}

const Disputes = () => {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/disputes');
      setDisputes(response.data);
    } catch (err) {
      console.error('Error fetching disputes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  const handleResolve = async (id: string, resolution: string) => {
    try {
      await api.post(`/disputes/${id}/resolve`, { 
          resolution,
          notes: `Resolved by admin as ${resolution}`
      });
      setDisputes(disputes.filter(d => d.dispute_id !== id));
      setSelectedDispute(null);
      alert('Dispute resolved successfully.');
    } catch (err) {
      console.error('Error resolving dispute:', err);
      alert('Failed to resolve dispute.');
    }
  };

  return (
    <div className="disputes-page">
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Dispute Resolution</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Mediate conflicts between buyers and sellers.</p>
      </header>

      {loading ? (
          <div className="glass" style={{ padding: '100px', textAlign: 'center' }}>Loading disputes...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedDispute ? '1fr 400px' : '1fr', gap: '24px' }}>
          <div className="glass" style={{ padding: '24px' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Reporter</th>
                    <th>Reason</th>
                    <th>Order Amt</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {disputes.map((d) => (
                      <motion.tr 
                        key={d.dispute_id}
                        onClick={() => setSelectedDispute(d)}
                        style={{ cursor: 'pointer', background: selectedDispute?.dispute_id === d.dispute_id ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                      >
                        <td>{d.User.Fname} {d.User.Lname}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.reason}</td>
                        <td>₱{d.Orders.total_amount.toLocaleString()}</td>
                        <td>{new Date(d.created_at).toLocaleDateString()}</td>
                        <td><span className="badge badge-pending">{d.status}</span></td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {disputes.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No open disputes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <AnimatePresence>
              {selectedDispute && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="glass" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <h3>Dispute Mediation</h3>
                      <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Reporter: {selectedDispute.User.Fname} {selectedDispute.User.Lname}</p>
                          <p style={{ fontWeight: 500 }}>"{selectedDispute.reason}"</p>
                      </div>

                      <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Order Details</p>
                          <p>Order ID: {selectedDispute.order_id}</p>
                          <p>Amount: ₱{selectedDispute.Orders.total_amount.toLocaleString()}</p>
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <button onClick={() => handleResolve(selectedDispute.dispute_id, 'refund')} className="btn btn-primary">Full Refund</button>
                          <button onClick={() => handleResolve(selectedDispute.dispute_id, 'escrow_release')} className="btn btn-outline">Release Payment</button>
                          <button onClick={() => setSelectedDispute(null)} className="btn btn-outline" style={{ color: 'var(--text-secondary)' }}>Close</button>
                      </div>
                  </motion.div>
              )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default Disputes;
