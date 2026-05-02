'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { Gavel, Tag, Calendar, Clock, Info } from 'lucide-react';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';

function ScheduleAuctionPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const productId = searchParams.get('id');
    const { user } = useAuth();

    const [saleType, setSaleType] = useState('bid'); // 'bid' or 'sale'
    const [formData, setFormData] = useState({
        startDate: '',
        startTime: '',
        fixedPrice: '',
        bidIncrement: '',
    });
    const { isSubmitting, runWithLock } = useSubmitLock();
    
    const [productDetails, setProductDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(true);
    const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }

    const showToast = (type, message, redirectTo = null) => {
        setToast({ type, message });
        setTimeout(() => {
            setToast(null);
            if (redirectTo) router.push(redirectTo);
        }, 2200);
    };

    useEffect(() => {
        const fetchProduct = async () => {
            if (!productId) return;
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');
                
                const res = await fetch(`${apiUrl}/api/products/${productId}`, {
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    setProductDetails(data);
                }
            } catch (err) {
                console.error("Failed to fetch product for scheduling:", err);
            } finally {
                setLoadingDetails(false);
            }
        };

        fetchProduct();
    }, [productId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await runWithLock(async () => {
             try {
                if (!user) {
                    alert('You must be logged in to schedule an item.');
                    return;
                }
                
                // Use the already-set prices from product details
                const payload = {
                    product_id: productId,
                    user_id: user.user_id || user.id,
                    seller_id: user.seller_id,
                    sale_type: saleType,
                    starting_bid: saleType === 'bid' ? productDetails?.starting_price : null,
                    reserve_price: saleType === 'bid' ? productDetails?.reserve_price : null,
                    buy_now_price: saleType === 'sale' ? (parseFloat(formData.fixedPrice) || productDetails?.buy_now_price) : null,
                    start_date: formData.startDate,
                    start_time: formData.startTime,
                    bid_increment: saleType === 'bid' ? parseFloat(formData.bidIncrement) : null,
                };
                
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');
                
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
                    const errorMessage = data.error || 'Failed to schedule auction';
                    const redirectTo = errorMessage.includes('already has a') ? '/seller/auctions' : null;
                    showToast('error', errorMessage, redirectTo);
                    return;
                }

                console.log('Successfully scheduled:', data);
                showToast('success', 'Auction scheduled successfully!', '/seller/auctions');
            } catch (err) {
                console.error(err);
                showToast('error', 'An error occurred while scheduling the auction.');
            }
        });
    };

    return (
        <div className={styles.container}>

            {/* Toast notification */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.9rem 1.4rem',
                    borderRadius: '12px',
                    background: toast.type === 'success' ? '#1a1a2e' : '#2d1b1b',
                    border: `1px solid ${toast.type === 'success' ? '#4ade80' : '#f87171'}`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                    minWidth: '280px',
                    maxWidth: '420px',
                    animation: 'slideUp 0.3s ease',
                }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: toast.type === 'success' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: '1rem',
                    }}>
                        {toast.type === 'success' ? '✓' : '✕'}
                    </div>
                    <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: toast.type === 'success' ? '#4ade80' : '#f87171' }}>
                            {toast.type === 'success' ? 'Success' : 'Error'}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#ccc', marginTop: '1px' }}>{toast.message}</p>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateX(-50%) translateY(16px); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>

            <header className={styles.header}>
                <BackButton label="Schedule Item" />
            </header>

            <div className={styles.scheduleCard}>
                {loadingDetails ? (
                     <div style={{ textAlign: 'center', padding: '2rem' }}>Loading product details...</div>
                ) : (
                <div className={styles.productBrief}>
                    <div className={styles.briefImg}>
                        <img 
                           src={productDetails?.images && productDetails.images.length > 0 ? productDetails.images[0].image_url : "https://placehold.co/200x200?text=No+Image"} 
                           alt={productDetails?.name || "Product"} 
                        />
                    </div>
                    <div className={styles.briefInfo}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2>{productDetails?.name || "Unknown Product"}</h2>
                            {productDetails?.status && (
                                <span style={{ 
                                    padding: '4px 8px', 
                                    borderRadius: '4px', 
                                    fontSize: '0.7rem', 
                                    fontWeight: 'bold',
                                    background: (productDetails.status === 'scheduled' || productDetails.status === 'active') ? '#ffebee' : '#f5f5f5',
                                    color: (productDetails.status === 'scheduled' || productDetails.status === 'active') ? '#d32f2f' : '#757575',
                                    border: `1px solid ${(productDetails.status === 'scheduled' || productDetails.status === 'active') ? '#ffcdd2' : '#e0e0e0'}`
                                }}>
                                    {productDetails.status.toUpperCase()}
                                </span>
                            )}
                        </div>
                        <p>ID: {productId ? `${productId.slice(0, 8)}…` : '---'}</p>
                    </div>
                </div>
                )}

                {(productDetails?.status === 'scheduled' || productDetails?.status === 'active') ? (
                    <div className={styles.alreadyScheduledInfo}>
                        <div className={styles.errorIcon}>
                            <Info size={32} color="#d32f2f" />
                        </div>
                        <h3>Product Already Scheduled</h3>
                        <p>This item is currently {productDetails.status === 'scheduled' ? 'scheduled for an upcoming auction' : 'in an active auction'}. You cannot schedule it again until the current auction ends.</p>
                        <button 
                            type="button" 
                            className={styles.backToInventoryBtn}
                            onClick={() => router.push('/seller/auctions')}
                        >
                            View Active Auctions
                        </button>
                    </div>
                ) : (
                <form onSubmit={handleSubmit}>
                    <div className={styles.section}>
                        <label className={styles.sectionLabel}>Select Sale Type</label>
                        <div className={styles.typeGrid}>
                            <div
                                className={`${styles.typeCard} ${saleType === 'bid' ? styles.activeType : ''}`}
                                onClick={() => setSaleType('bid')}
                            >
                                <div className={styles.typeIcon}>
                                    <Gavel size={24} />
                                </div>
                                <div className={styles.typeText}>
                                    <strong>Bid it</strong>
                                    <span>Live auction</span>
                                </div>
                            </div>
                            <div
                                className={`${styles.typeCard} ${saleType === 'sale' ? styles.activeType : ''}`}
                                onClick={() => setSaleType('sale')}
                            >
                                <div className={styles.typeIcon}>
                                    <Tag size={24} />
                                </div>
                                <div className={styles.typeText}>
                                    <strong>Fixed sale</strong>
                                    <span>Set price listing</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className={styles.section}>
                        <label className={styles.sectionLabel}>
                            {saleType === 'bid' ? 'Auction Pricing' : 'Fixed Pricing'}
                        </label>

                        {saleType === 'bid' ? (
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <div className={styles.priceDisplay} style={{ flex: 1 }}>
                                    <div className={styles.priceDisplayIcon}>
                                        <Gavel size={18} />
                                    </div>
                                    <div className={styles.priceDisplayContent}>
                                        <div className={styles.priceDisplayLabel}>Reserve Price</div>
                                        <div className={styles.priceDisplayValue}>
                                            ₱{productDetails?.reserve_price?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                        </div>
                                        <div className={styles.priceDisplayNote}>Minimum acceptable price</div>
                                    </div>
                                </div>
                                <div className={styles.priceDisplay} style={{ flex: 1 }}>
                                    <div className={styles.priceDisplayIcon} style={{ background: '#f0fdf4', color: '#166534' }}>
                                        <Gavel size={18} />
                                    </div>
                                    <div className={styles.priceDisplayContent}>
                                        <div className={styles.priceDisplayLabel}>Starting Bid</div>
                                        <div className={styles.priceDisplayValue}>
                                            ₱{productDetails?.starting_price?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                        </div>
                                        <div className={styles.priceDisplayNote}>Initial bid amount</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.field}>
                                <label>Buy Now Price *</label>
                                <div className={styles.inputWithIcon}>
                                    <span className={styles.pesoIcon}>₱</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        required={saleType === 'sale'}
                                        value={formData.fixedPrice}
                                        onChange={(e) => setFormData({ ...formData, fixedPrice: e.target.value })}
                                    />
                                </div>
                                <small className={styles.fieldNote}>Set the fixed price buyers will pay</small>
                            </div>
                        )}
                    </div>

                    {saleType === 'bid' && (
                        <div className={styles.section}>
                            <label className={styles.sectionLabel}>Bid Increment</label>
                            <div className={styles.field}>
                                <div className={styles.inputWithIcon}>
                                    <span className={styles.pesoIcon}>₱</span>
                                    <input
                                        type="number"
                                        step="1"
                                        min="1"
                                        placeholder="50"
                                        required
                                        value={formData.bidIncrement}
                                        onChange={(e) => setFormData({ ...formData, bidIncrement: e.target.value })}
                                    />
                                </div>
                                <small className={styles.fieldNote}>Every new bid must increase by this seller-set amount.</small>
                            </div>
                        </div>
                    )}

                    <div className={styles.section}>
                        <label className={styles.sectionLabel}>Date & Time</label>
                        <div className={styles.dateTimeGrid}>
                            <div className={styles.field}>
                                <label>Start Date</label>
                                <div className={styles.inputWithIcon}>
                                    <Calendar size={18} />
                                    <input 
                                        type="date" 
                                        required 
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className={styles.field}>
                                <label>Start Time</label>
                                <div className={styles.inputWithIcon}>
                                    <Clock size={18} />
                                    <input 
                                        type="time" 
                                        required 
                                        value={formData.startTime}
                                        onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.infoAlert}>
                        <Info size={18} />
                        <p>Your item will automatically go live at the scheduled time.</p>
                    </div>

                    <button type="submit" className={styles.confirmBtn} disabled={isSubmitting}>
                        {isSubmitting ? 'Scheduling...' : 'Confirm Schedule'}
                    </button>
                </form>
                )}
            </div>
        </div>
    );
}

export default function ScheduleAuctionPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
            <ScheduleAuctionPageInner />
        </Suspense>
    );
}
