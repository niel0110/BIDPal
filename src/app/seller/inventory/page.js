'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, X, Gavel, Tag, Calendar, Clock } from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function InventoryPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

    // Schedule modal state
    const [scheduleProduct, setScheduleProduct] = useState(null); // { products_id, name, images, reserve_price, starting_price }
    const [saleType, setSaleType] = useState('bid');
    const [scheduleForm, setScheduleForm] = useState({ startDate: '', startTime: '', fixedPrice: '', bidIncrement: '' });
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleToast, setScheduleToast] = useState(null);

    const fetchProducts = async () => {
        if (!user) return;
        try {
            const userId = user.user_id || user.id;
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');

            const res = await fetch(`${apiUrl}/api/products/seller/${userId}`, {
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Network error' }));
                throw new Error(errorData.error || 'Failed to fetch products');
            }

            const responseData = await res.json();
            const allProducts = responseData.data || [];
            setProducts(allProducts.filter(p => p.status === 'draft' || p.status === 'pending' || !p.status));
        } catch (error) {
            console.error('Error fetching inventory:', error.message);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchProducts();
        else setLoading(false);
    }, [user]);

    const handleDelete = async (productId, productName) => {
        if (!confirm(`Are you sure you want to delete "${productName}"?`)) return;

        setDeletingId(productId);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');

            const res = await fetch(`${apiUrl}/api/products/${productId}`, {
                method: 'DELETE',
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
            });

            if (res.ok) {
                setProducts(products.filter(p => p.products_id !== productId));
            } else {
                const errorData = await res.json();
                alert(`Failed to delete product: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Error deleting product. Please try again.');
        } finally {
            setDeletingId(null);
        }
    };

    const openScheduleModal = (product) => {
        setScheduleProduct(product);
        setSaleType('bid');
        setScheduleForm({ startDate: '', startTime: '', fixedPrice: '' });
        setScheduleToast(null);
    };

    const closeScheduleModal = () => {
        setScheduleProduct(null);
        setScheduleToast(null);
    };

    const handleScheduleSubmit = async (e) => {
        e.preventDefault();
        if (!scheduleProduct || !user) return;
        setIsScheduling(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');

            const now = new Date();
            let startISO, endISO;

            if (saleType === 'sale') {
                startISO = now.toISOString();
            } else {
                const startDateObj = new Date(`${scheduleForm.startDate}T${scheduleForm.startTime}:00`);
                startISO = startDateObj.toISOString();
                
                if (scheduleForm.endDate && scheduleForm.endTime) {
                    const endDateObj = new Date(`${scheduleForm.endDate}T${scheduleForm.endTime}:00`);
                    endISO = endDateObj.toISOString();
                }
            }

            const payload = {
                product_id: scheduleProduct.products_id,
                user_id: user.user_id || user.id,
                seller_id: user.seller_id,
                sale_type: saleType,
                starting_bid: saleType === 'bid' ? scheduleProduct.starting_price : null,
                reserve_price: saleType === 'bid' ? scheduleProduct.reserve_price : null,
                buy_now_price: saleType === 'sale' ? (parseFloat(scheduleForm.fixedPrice) || scheduleProduct.buy_now_price) : null,
                start_timestamp: startISO,
                end_timestamp: endISO,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                bid_increment: saleType === 'bid' ? parseFloat(scheduleForm.bidIncrement) : null,
                availability: saleType === 'sale' ? 1 : (scheduleForm.availability || 1),
            };

            const res = await fetch(`${apiUrl}/api/auctions/schedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) {
                setScheduleToast({ type: 'error', message: data.error || 'Failed to schedule auction' });
                return;
            }

            setScheduleToast({ type: 'success', message: saleType === 'sale' ? 'Item posted successfully!' : 'Auction scheduled successfully!' });
            setTimeout(() => {
                closeScheduleModal();
                router.push('/seller/auctions');
            }, 1800);
        } catch (err) {
            setScheduleToast({ type: 'error', message: 'An error occurred. Please try again.' });
        } finally {
            setIsScheduling(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Link href="/seller/auctions" className={styles.backLink}>
                    <span className={styles.backLinkIcon}><ChevronLeft size={18} strokeWidth={2.5} /></span>
                    <span>My Auctions</span>
                </Link>
                <h1 className={styles.title}>My Products</h1>
                <p className={styles.subtitle}>Draft products ready to be scheduled</p>
            </header>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading inventory...</div>
            ) : (
                <div className={styles.productGrid}>
                    {products.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1.5rem 1rem', color: '#999' }}>
                            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#555', marginBottom: '0.35rem' }}>No draft products available</p>
                            <p style={{ fontSize: '0.75rem', color: '#bbb' }}>Products that are scheduled or completed won't appear here</p>
                        </div>
                    ) : (
                        products.map((product) => {
                            const isDeleting = deletingId === product.products_id;
                            return (
                                <div key={product.products_id} className={styles.productCard}>
                                    <div className={styles.imageWrapper}>
                                        <img
                                            src={product.images && product.images.length > 0 ? product.images[0].image_url : 'https://placehold.co/200x200?text=No+Image'}
                                            alt={product.name}
                                            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                        />
                                        <button
                                            onClick={() => handleDelete(product.products_id, product.name)}
                                            disabled={isDeleting}
                                            style={{
                                                position: 'absolute', top: '8px', right: '8px',
                                                background: 'rgba(220, 38, 38, 0.9)', color: 'white',
                                                border: 'none', borderRadius: '4px', padding: '6px',
                                                cursor: isDeleting ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                opacity: isDeleting ? 0.5 : 1
                                            }}
                                            title="Delete product"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className={styles.productInfo}>
                                        <strong>{product.name}</strong>
                                        <span style={{ textTransform: 'capitalize', color: '#999', fontSize: '0.85rem' }}>
                                            Draft • Ready to schedule
                                        </span>
                                    </div>
                                    <button
                                        className={styles.scheduleBtn}
                                        onClick={() => openScheduleModal(product)}
                                    >
                                        Schedule
                                    </button>
                                </div>
                            );
                        })
                    )}

                    <Link href="/seller/add-product" className={styles.addCard}>
                        <div className={styles.plusCircle}>
                            <Plus size={48} color="var(--color-primary)" strokeWidth={1.5} />
                        </div>
                    </Link>
                </div>
            )}

            {/* Schedule Modal */}
            {scheduleProduct && (
                <div className={styles.modalOverlay} onClick={closeScheduleModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>

                        {/* Modal header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                                    {saleType === 'sale' ? 'Post Product' : 'Schedule Auction'}
                                </h2>
                                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                                    {saleType === 'sale' ? 'Set a price and list this item immediately' : 'Set when this item goes live'}
                                </p>
                            </div>
                            <button onClick={closeScheduleModal} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px', cursor: 'pointer', display: 'flex' }}>
                                <X size={18} color="#64748b" />
                            </button>
                        </div>

                        {/* Product brief */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem', background: '#f8fafc', borderRadius: 12, marginBottom: '1.5rem' }}>
                            <img
                                src={scheduleProduct.images?.[0]?.image_url || 'https://placehold.co/56x56?text=No+Image'}
                                alt={scheduleProduct.name}
                                style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scheduleProduct.name}</div>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.3rem' }}>
                                    {scheduleProduct.reserve_price > 0 && (
                                        <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                                            Reserve: <strong style={{ color: '#D32F2F' }}>₱{Number(scheduleProduct.reserve_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                    )}
                                    {scheduleProduct.starting_price > 0 && (
                                        <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                                            Starting Bid: <strong style={{ color: '#0f172a' }}>₱{Number(scheduleProduct.starting_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleScheduleSubmit}>
                            {/* Sale type */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Sale Type</label>
                                <div className={styles.modalGrid}>
                                    {[
                                        { id: 'bid', icon: <Gavel size={18} />, label: 'Bid it', sub: 'Live auction' },
                                        { id: 'sale', icon: <Tag size={18} />, label: 'Fixed sale', sub: 'Set price' },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setSaleType(opt.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.65rem',
                                                padding: '0.75rem 1rem', borderRadius: 12, cursor: 'pointer',
                                                border: `2px solid ${saleType === opt.id ? '#D32F2F' : '#e2e8f0'}`,
                                                background: saleType === opt.id ? '#fff1f2' : 'white',
                                                color: saleType === opt.id ? '#D32F2F' : '#475569',
                                                fontWeight: 600, fontSize: '0.85rem', textAlign: 'left'
                                            }}
                                        >
                                            {opt.icon}
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{opt.label}</div>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.7 }}>{opt.sub}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Fixed price input (sale type only) */}
                            {saleType === 'sale' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Buy Now Price</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 0.85rem', background: '#fafafa' }}>
                                            <span style={{ fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>₱</span>
                                            <input
                                                type="number" step="0.01" min="0" placeholder="0.00" required={saleType === 'sale'}
                                                value={scheduleForm.fixedPrice}
                                                onChange={e => setScheduleForm(p => ({ ...p, fixedPrice: e.target.value }))}
                                                style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem 0', fontSize: '0.9rem', outline: 'none', color: '#0f172a' }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Stock (Quantity)</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 0.85rem', background: '#fafafa' }}>
                                            <input
                                                type="number" value="1" disabled
                                                style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem 0', fontSize: '0.9rem', outline: 'none', color: '#94a3b8', cursor: 'not-allowed' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {saleType !== 'sale' && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Bid Increment</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 0.85rem', background: '#fafafa' }}>
                                        <span style={{ fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>₱</span>
                                        <input
                                            type="number" step="1" min="1" placeholder="50" required
                                            value={scheduleForm.bidIncrement}
                                            onChange={e => setScheduleForm(p => ({ ...p, bidIncrement: e.target.value }))}
                                            style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem 0', fontSize: '0.9rem', outline: 'none', color: '#0f172a' }}
                                        />
                                    </div>
                                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.35rem', marginBottom: 0 }}>
                                        Every new bid must increase by this seller-set amount.
                                    </p>
                                </div>
                            )}

                            {/* Date & time (auction only) */}
                            {saleType !== 'sale' && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Date & Time</label>
                                    <div className={styles.modalGrid}>
                                        <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa' }}>
                                            <Calendar size={15} color="#94a3b8" />
                                            <input
                                                type="date" required
                                                value={scheduleForm.startDate}
                                                onChange={e => setScheduleForm(p => ({ ...p, startDate: e.target.value }))}
                                                style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', color: '#0f172a', flex: 1, minWidth: 0 }}
                                            />
                                        </div>
                                        <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa' }}>
                                            <Clock size={15} color="#94a3b8" />
                                            <input
                                                type="time" required
                                                value={scheduleForm.startTime}
                                                onChange={e => setScheduleForm(p => ({ ...p, startTime: e.target.value }))}
                                                style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', color: '#0f172a', flex: 1, minWidth: 0 }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {saleType !== 'sale' && (
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
                                    Your item will automatically go live at the scheduled time.
                                </p>
                            )}

                            {/* Toast */}
                            {scheduleToast && (
                                <div style={{
                                    padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1rem',
                                    background: scheduleToast.type === 'success' ? '#f0fdf4' : '#fff1f2',
                                    border: `1px solid ${scheduleToast.type === 'success' ? '#bbf7d0' : '#fecdd3'}`,
                                    color: scheduleToast.type === 'success' ? '#166534' : '#991b1b',
                                    fontSize: '0.82rem', fontWeight: 600
                                }}>
                                    {scheduleToast.type === 'success' ? '✓ ' : '✕ '}{scheduleToast.message}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isScheduling}
                                style={{
                                    width: '100%', background: '#D32F2F', color: 'white', border: 'none',
                                    borderRadius: 12, padding: '0.9rem', fontWeight: 700, fontSize: '0.92rem',
                                    cursor: isScheduling ? 'not-allowed' : 'pointer', opacity: isScheduling ? 0.7 : 1,
                                    transition: 'opacity 0.15s'
                                }}
                            >
                                {isScheduling
                                    ? (saleType === 'sale' ? 'Posting...' : 'Scheduling...')
                                    : (saleType === 'sale' ? 'Post Item' : 'Confirm Schedule')
                                }
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
