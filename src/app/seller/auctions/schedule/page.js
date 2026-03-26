'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Gavel, Tag, Calendar, Clock, Info } from 'lucide-react';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';
import PriceRecommendation from '@/components/pricing/PriceRecommendation';

export default function ScheduleAuctionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const productId = searchParams.get('id');
    const { user } = useAuth();

    const [saleType, setSaleType] = useState('bid'); // 'bid' or 'sale'
    const [formData, setFormData] = useState({
        price: '',
        startingBid: '',
        startDate: '',
        startTime: '',
    });
    const { isSubmitting, runWithLock } = useSubmitLock();
    
    const [productDetails, setProductDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(true);

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

    const handleBack = () => router.back();

    const handleApplyRecommendation = (prices) => {
        setFormData(prev => ({
            ...prev,
            startingBid: prices.startingBid.toString(),
            price: prices.reservePrice.toString()
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await runWithLock(async () => {
             try {
                if (!user) {
                    alert('You must be logged in to schedule an item.');
                    return;
                }
                
                const payload = {
                    product_id: productId,
                    user_id: user.user_id || user.id,
                    seller_id: user.seller_id,
                    sale_type: saleType,
                    starting_bid: saleType === 'bid' ? formData.startingBid : null,
                    buy_now_price: saleType === 'sale' ? formData.price : null,
                    start_date: formData.startDate,
                    start_time: formData.startTime,
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
                    alert(errorMessage);

                    // If product is already scheduled, redirect to My Auctions
                    if (errorMessage.includes('already has a')) {
                        router.push('/seller/auctions');
                    }
                    return;
                }

                console.log('Successfully scheduled:', data);
                alert('Auction scheduled successfully!');
                router.push('/seller/auctions');
            } catch (err) {
                console.error(err);
                alert('An error occurred while scheduling the auction.');
            }
        });
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <button className={styles.backBtn} onClick={handleBack}>
                    <ChevronLeft size={24} />
                    <span>Schedule Item</span>
                </button>
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
                        <p style={{ "wordWrap": "break-word" }}>ID: {productId || '---'}</p>
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
                                    <span>Live auction experience</span>
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
                                    <strong>Just for sale</strong>
                                    <span>Fixed price listing</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Price Recommendation */}
                    {productDetails && saleType === 'bid' && (
                        <PriceRecommendation
                            productData={{
                                name: productDetails.name,
                                description: productDetails.description,
                                category: productDetails.categories?.[0] || 'General',
                                condition: productDetails.condition || 'Good',
                                brand: productDetails.brand,
                                specifications: productDetails.specifications
                            }}
                            onApplyRecommendation={handleApplyRecommendation}
                        />
                    )}

                    <div className={styles.section}>
                        <label className={styles.sectionLabel}>
                            {saleType === 'bid' ? 'Auction Pricing' : 'Fixed Pricing'}
                        </label>
                        <div className={styles.inputGroup}>
                            <label>{saleType === 'bid' ? 'Starting Bid' : 'Price'}</label>
                            <div className={styles.priceInputWrapper}>
                                <span className={styles.currency}>₱</span>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={saleType === 'bid' ? formData.startingBid : formData.price}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        [saleType === 'bid' ? 'startingBid' : 'price']: e.target.value
                                    })}
                                    required
                                />
                            </div>
                        </div>
                    </div>

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
