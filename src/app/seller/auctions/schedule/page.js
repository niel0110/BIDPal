'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Gavel, Tag, Calendar, Clock, Info } from 'lucide-react';
import styles from './page.module.css';

export default function ScheduleAuctionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const productId = searchParams.get('id');

    const [saleType, setSaleType] = useState('bid'); // 'bid' or 'sale'
    const [formData, setFormData] = useState({
        price: '',
        startingBid: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
    });

    const handleBack = () => router.back();

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Scheduling product:', { productId, saleType, ...formData });
        router.push('/seller/auctions');
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
                <div className={styles.productBrief}>
                    <div className={styles.briefImg}>
                        <img src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=200&auto=format&fit=crop" alt="product" />
                    </div>
                    <div className={styles.briefInfo}>
                        <h2>XYZ name.jpg</h2>
                        <p>ID: {productId || '---'}</p>
                    </div>
                </div>

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
                                    <input type="date" required />
                                </div>
                            </div>
                            <div className={styles.field}>
                                <label>Start Time</label>
                                <div className={styles.inputWithIcon}>
                                    <Clock size={18} />
                                    <input type="time" required />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.infoAlert}>
                        <Info size={18} />
                        <p>Your item will automatically go live at the scheduled time.</p>
                    </div>

                    <button type="submit" className={styles.confirmBtn}>
                        Confirm Schedule
                    </button>
                </form>
            </div>
        </div>
    );
}
