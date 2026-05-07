'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search, Filter, Plus, X, Gavel, Tag, Calendar, Clock } from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';

const CONDITIONS = ['Brand New', 'Like New', 'Lightly Used', 'Used', 'Heavily Used', 'For Parts'];

export default function SelectProductPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedCondition, setSelectedCondition] = useState('');
    const filterRef = useRef(null);

    const [scheduleProduct, setScheduleProduct] = useState(null);
    const [saleType, setSaleType] = useState('bid');
    const [scheduleForm, setScheduleForm] = useState({ startDate: '', startTime: '', fixedPrice: '' });
    const [scheduleToast, setScheduleToast] = useState(null);
    const [isScheduling, setIsScheduling] = useState(false);

    const openScheduleModal = (product) => {
        setScheduleProduct(product);
        setSaleType('bid');
        setScheduleForm({ startDate: '', startTime: '', fixedPrice: '' });
        setScheduleToast(null);
    };
    const closeScheduleModal = () => { setScheduleProduct(null); setScheduleToast(null); };

    const handleScheduleSubmit = async (e) => {
        e.preventDefault();
        if (!scheduleProduct || !user) return;
        setIsScheduling(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const now = new Date();
            const payload = {
                product_id: scheduleProduct.products_id,
                user_id: user.user_id || user.id,
                seller_id: user.seller_id,
                sale_type: saleType,
                starting_bid: saleType === 'bid' ? scheduleProduct.starting_price : null,
                reserve_price: saleType === 'bid' ? scheduleProduct.reserve_price : null,
                buy_now_price: saleType === 'sale' ? (parseFloat(scheduleForm.fixedPrice) || scheduleProduct.buy_now_price) : null,
                start_date: saleType === 'sale' ? now.toISOString().slice(0, 10) : scheduleForm.startDate,
                start_time: saleType === 'sale' ? now.toTimeString().slice(0, 5) : scheduleForm.startTime,
            };
            const res = await fetch(`${apiUrl}/api/auctions/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) { setScheduleToast({ type: 'error', message: data.error || 'Failed to schedule' }); return; }
            setScheduleToast({ type: 'success', message: saleType === 'sale' ? 'Item posted!' : 'Auction scheduled!' });
            setTimeout(() => { closeScheduleModal(); router.push('/seller/auctions'); }, 1800);
        } catch {
            setScheduleToast({ type: 'error', message: 'An error occurred. Please try again.' });
        } finally {
            setIsScheduling(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (filterRef.current && !filterRef.current.contains(e.target)) {
                setFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchProducts = async () => {
            if (!user) return;
            try {
                const userId = user.user_id || user.id;
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');

                // Only fetch products that are NOT scheduled or active (available for auction)
                const res = await fetch(`${apiUrl}/api/products/seller/${userId}`, {
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });

                const responseData = await res.json();
                if (res.ok) {
                    // Only show draft/pending products ready to be scheduled
                    const availableProducts = (responseData.data || []).filter(
                        p => p.status === 'draft' || p.status === 'pending' || !p.status
                    );
                    setProducts(availableProducts);
                } else {
                    console.error('Failed to fetch products:', responseData.error);
                }
            } catch (error) {
                console.error('Error fetching inventory:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchProducts();
        } else {
            setLoading(false);
        }
    }, [user]);

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCondition = !selectedCondition ||
            (product.condition || '').toLowerCase().replace(/_/g, ' ') === selectedCondition.toLowerCase();
        return matchesSearch && matchesCondition;
    });

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Link href="/seller/auctions" className={styles.backLink}>
                    <span className={styles.backLinkIcon}>
                        <ChevronLeft size={18} strokeWidth={2.5} />
                    </span>
                    <span>My Auctions</span>
                </Link>
                <div className={styles.titleArea}>
                    <h1>Select Product</h1>
                    <p>Choose an item from your inventory to schedule for auction or sale.</p>
                </div>
            </header>

            <div className={styles.controls}>
                <div className={styles.searchBar}>
                    <Search size={16} className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className={styles.clearBtn} onClick={() => setSearchQuery('')}>
                            <X size={14} />
                        </button>
                    )}
                </div>
                <div className={styles.filterWrapper} ref={filterRef}>
                    <button
                        className={`${styles.filterBtn} ${selectedCondition ? styles.filterActive : ''}`}
                        onClick={() => setFilterOpen(prev => !prev)}
                    >
                        <Filter size={15} />
                    </button>
                    {filterOpen && (
                        <div className={styles.filterDropdown}>
                            <button
                                className={`${styles.filterOption} ${!selectedCondition ? styles.filterOptionActive : ''}`}
                                onClick={() => { setSelectedCondition(''); setFilterOpen(false); }}
                            >All</button>
                            {CONDITIONS.map(c => (
                                <button
                                    key={c}
                                    className={`${styles.filterOption} ${selectedCondition === c ? styles.filterOptionActive : ''}`}
                                    onClick={() => { setSelectedCondition(c); setFilterOpen(false); }}
                                >{c}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading products...</div>
            ) : (
                <div className={styles.productGrid}>
                    {filteredProducts.length === 0 && !loading ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1.5rem', color: '#aaa', fontSize: '0.8rem' }}>
                            {searchQuery ? 'No draft products match your search.' : 'No draft products available. Add a product first.'}
                        </div>
                    ) : (
                        filteredProducts.map((product) => (
                            <div key={product.products_id} className={styles.productCard}>
                                <div className={styles.imageWrapper}>
                                    <img
                                        src={product.images && product.images.length > 0 ? product.images[0].image_url : 'https://placehold.co/200x200?text=No+Image'}
                                        alt={product.name}
                                        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                    />
                                </div>
                                <div className={styles.productInfo}>
                                    <strong>{product.name}</strong>
                                    <span>Draft · Ready to schedule</span>
                                </div>
                                <button className={styles.selectBtn} onClick={() => openScheduleModal(product)}>
                                    Select for Auction
                                </button>
                            </div>
                        ))
                    )}

                    <Link href="/seller/add-product" className={styles.addCard}>
                        <div className={styles.plusCircle}>
                            <Plus size={32} color="var(--color-primary)" />
                        </div>
                        <span>Add New Product</span>
                    </Link>
                </div>
            )}

            {scheduleProduct && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
                }} onClick={closeScheduleModal}>
                    <div style={{
                        background: 'white', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 500,
                        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)'
                    }} onClick={e => e.stopPropagation()}>
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem', background: '#f8fafc', borderRadius: 12, marginBottom: '1.5rem' }}>
                            <img
                                src={scheduleProduct.images?.[0]?.image_url || 'https://placehold.co/56x56?text=No+Image'}
                                alt={scheduleProduct.name}
                                style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scheduleProduct.name}</div>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                                    {scheduleProduct.reserve_price > 0 && (
                                        <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                                            Reserve: <strong style={{ color: '#D32F2F' }}>₱{Number(scheduleProduct.reserve_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                    )}
                                    {scheduleProduct.starting_price > 0 && (
                                        <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                                            Starting: <strong style={{ color: '#0f172a' }}>₱{Number(scheduleProduct.starting_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleScheduleSubmit}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Sale Type</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                    {[
                                        { id: 'bid', icon: <Gavel size={18} />, label: 'Bid it', sub: 'Live auction' },
                                    ].map(opt => (
                                        <button key={opt.id} type="button" onClick={() => setSaleType(opt.id)} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.65rem',
                                            padding: '0.75rem 1rem', borderRadius: 12, cursor: 'pointer',
                                            border: `2px solid ${saleType === opt.id ? '#D32F2F' : '#e2e8f0'}`,
                                            background: saleType === opt.id ? '#fff1f2' : 'white',
                                            color: saleType === opt.id ? '#D32F2F' : '#475569',
                                            fontWeight: 600, fontSize: '0.85rem', textAlign: 'left'
                                        }}>
                                            {opt.icon}
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{opt.label}</div>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.7 }}>{opt.sub}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {saleType === 'sale' && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Buy Now Price</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 0.85rem', background: '#fafafa' }}>
                                        <span style={{ fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>₱</span>
                                        <input type="number" step="0.01" min="0" placeholder="0.00" required={saleType === 'sale'}
                                            value={scheduleForm.fixedPrice}
                                            onChange={e => setScheduleForm(p => ({ ...p, fixedPrice: e.target.value }))}
                                            style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem 0', fontSize: '0.9rem', outline: 'none', color: '#0f172a' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {saleType !== 'sale' && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Date & Time</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                        <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa' }}>
                                            <Calendar size={15} color="#94a3b8" />
                                            <input type="date" required value={scheduleForm.startDate}
                                                onChange={e => setScheduleForm(p => ({ ...p, startDate: e.target.value }))}
                                                style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', color: '#0f172a', flex: 1, minWidth: 0 }}
                                            />
                                        </div>
                                        <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa' }}>
                                            <Clock size={15} color="#94a3b8" />
                                            <input type="time" required value={scheduleForm.startTime}
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

                            <button type="submit" disabled={isScheduling} style={{
                                width: '100%', background: '#D32F2F', color: 'white', border: 'none',
                                borderRadius: 12, padding: '0.9rem', fontWeight: 700, fontSize: '0.92rem',
                                cursor: isScheduling ? 'not-allowed' : 'pointer', opacity: isScheduling ? 0.7 : 1,
                            }}>
                                {isScheduling ? (saleType === 'sale' ? 'Posting...' : 'Scheduling...') : (saleType === 'sale' ? 'Post Item' : 'Confirm Schedule')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
