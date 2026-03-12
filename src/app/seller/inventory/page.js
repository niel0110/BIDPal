'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus } from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';

export default function InventoryPage() {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            if (!user) return;
            try {
                const userId = user.user_id || user.id;
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');
                
                const res = await fetch(`${apiUrl}/api/products/seller/${userId}`, {
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    }
                });
                
                const responseData = await res.json();
                if (res.ok) {
                    setProducts(responseData.data || []);
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

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Link href="/seller" className={styles.backLink}>
                    <ChevronLeft size={24} />
                    <span>Products</span>
                </Link>
                <h1 className={styles.title}>My Products</h1>
            </header>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading inventory...</div>
            ) : (
                <div className={styles.productGrid}>
                    {products.map((product) => {
                        const isScheduledOrActive = product.status === 'scheduled' || product.status === 'active';

                        return (
                        <div key={product.products_id} className={styles.productCard}>
                            <div className={styles.imageWrapper}>
                                <img
                                   src={product.images && product.images.length > 0 ? product.images[0].image_url : 'https://placehold.co/200x200?text=No+Image'}
                                   alt={product.name}
                                   style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                />
                                {isScheduledOrActive && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '8px',
                                        background: product.status === 'scheduled' ? '#FF9800' : '#4CAF50',
                                        color: 'white',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase'
                                    }}>
                                        {product.status}
                                    </div>
                                )}
                            </div>
                            <div className={styles.productInfo}>
                                <strong>{product.name}</strong>
                                <span style={{ textTransform: 'capitalize', color: isScheduledOrActive ? '#666' : '#333' }}>
                                    Status: {product.status}
                                </span>
                            </div>
                            {isScheduledOrActive ? (
                                <button
                                    className={styles.scheduledBtn}
                                    disabled
                                >
                                    {product.status === 'scheduled' ? 'Scheduled' : 'In Auction'}
                                </button>
                            ) : (
                                <Link href={`/seller/auctions/schedule?id=${product.products_id}`} className={styles.scheduleBtn}>
                                    Schedule
                                </Link>
                            )}
                        </div>
                        );
                    })}

                    <Link href="/seller/add-product" className={styles.addCard}>
                        <div className={styles.plusCircle}>
                            <Plus size={48} color="var(--color-primary)" strokeWidth={1.5} />
                        </div>
                    </Link>
                </div>
            )}
        </div>
    );
}
