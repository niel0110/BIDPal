import { useState, useEffect } from 'react';
import { AlertCircle, Check, X, Search, Eye, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface Product {
  products_id: string;
  title: string;
  description: string;
  price: number;
  status: string;
  Seller: { store_name: string } | null;
  image_url?: string;
}

const Moderation = () => {
  const [listings, setListings] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchFlaggedListings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('Products')
      .select('products_id, title, description, price, status, image_url, Seller(store_name)')
      .eq('status', 'under_review')
      .order('products_id', { ascending: false });

    if (!error && data) setListings(data as unknown as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchFlaggedListings();

    const channel = supabase
      .channel('moderation-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Products' }, fetchFlaggedListings)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleModerate = async (productId: string, action: 'approve' | 'reject' | 'revise') => {
    setActionLoading(true);
    try {
      const statusMap = { approve: 'active', reject: 'rejected', revise: 'draft' };
      const { error } = await supabase
        .from('Products')
        .update({ status: statusMap[action] })
        .eq('products_id', productId);

      if (error) throw error;
      setListings(prev => prev.filter(l => l.products_id !== productId));
      setSelectedListing(null);
    } catch (err) {
      console.error('Error moderating listing:', err);
      alert('Failed to update listing. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = listings.filter(l =>
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.Seller?.store_name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="moderation-page">
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Listing Moderation</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review and moderate flagged or suspicious products.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchFlaggedListings} className="btn btn-outline" style={{ padding: '8px 12px' }}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
          <div className="glass" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Search size={18} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Search listings..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ background: 'none', border: 'none', color: 'var(--text-primary)', outline: 'none', width: '200px' }}
            />
          </div>
        </div>
      </header>

      {loading && listings.length === 0 ? (
        <div className="glass" style={{ padding: '100px', textAlign: 'center' }}>Loading listings for review...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedListing ? '1fr 450px' : '1fr', gap: '24px', transition: 'all 0.3s ease' }}>
          <div className="glass" style={{ padding: '24px' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Seller</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filtered.map(item => (
                      <motion.tr
                        key={item.products_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -20 }}
                        onClick={() => setSelectedListing(item)}
                        style={{ cursor: 'pointer', background: selectedListing?.products_id === item.products_id ? '#FEF2F2' : 'transparent' }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--border)', flexShrink: 0, overflow: 'hidden' }}>
                              {item.image_url
                                ? <img src={item.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={20} color="var(--text-secondary)" /></div>
                              }
                            </div>
                            <div style={{ fontWeight: 500 }}>{item.title}</div>
                          </div>
                        </td>
                        <td>{item.Seller?.store_name ?? '—'}</td>
                        <td style={{ fontWeight: 600 }}>₱{item.price.toLocaleString()}</td>
                        <td><span className="badge badge-danger">Under Review</span></td>
                        <td>
                          <button className="btn btn-outline" style={{ padding: '6px' }} onClick={e => { e.stopPropagation(); setSelectedListing(item); }}>
                            <Eye size={16} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No flagged listings found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <AnimatePresence>
            {selectedListing && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass"
                style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '20px' }}>Listing Details</h3>
                  <button onClick={() => setSelectedListing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ height: '200px', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
                    {selectedListing.image_url
                      ? <img src={selectedListing.image_url} alt={selectedListing.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>No Image Available</div>
                    }
                  </div>

                  <div>
                    <h4 style={{ fontSize: '18px', marginBottom: '8px' }}>{selectedListing.title}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>{selectedListing.description}</p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Price</p>
                      <p style={{ fontWeight: 'bold' }}>₱{selectedListing.price.toLocaleString()}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Seller</p>
                      <p style={{ fontWeight: 'bold' }}>{selectedListing.Seller?.store_name ?? '—'}</p>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button onClick={() => handleModerate(selectedListing.products_id, 'reject')} disabled={actionLoading} className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}>
                      <X size={18} /> Reject
                    </button>
                    <button onClick={() => handleModerate(selectedListing.products_id, 'approve')} disabled={actionLoading} className="btn btn-primary">
                      <Check size={18} /> Approve
                    </button>
                  </div>
                  <button onClick={() => handleModerate(selectedListing.products_id, 'revise')} disabled={actionLoading} className="btn btn-outline" style={{ color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.2)', justifyContent: 'center' }}>
                    Send for Revision
                  </button>
                </div>
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

export default Moderation;
