'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';

export default function InventoryPage() {
    const { user } = useAuth();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

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

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Network error' }));
                throw new Error(errorData.error || 'Failed to fetch products');
            }

            const responseData = await res.json();
            const allProducts = responseData.data || [];

            // Filter to show only draft products (not scheduled, not active, not ended/completed)
            const draftProducts = allProducts.filter(product =>
                product.status === 'draft' ||
                product.status === 'pending' ||
                !product.status
            );

            setProducts(draftProducts);
        } catch (error) {
            console.error('Error fetching inventory:', error.message);
            setProducts([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchProducts();
        } else {
            setLoading(false);
        }
    }, [user]);

    const handleDelete = async (productId, productName) => {
        if (!confirm(`Are you sure you want to delete "${productName}"?`)) {
            return;
        }

        setDeletingId(productId);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');

            const res = await fetch(`${apiUrl}/api/products/${productId}`, {
                method: 'DELETE',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });

            if (res.ok) {
                // Remove the product from the list
                setProducts(products.filter(p => p.products_id !== productId));
                alert('Product deleted successfully');
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

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <BackButton label="Back" />
                <div>
                    <h1 className={styles.title}>My Products</h1>
                    <p style={{ color: '#999', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        Draft products ready to be scheduled
                    </p>
                </div>
            </header>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading inventory...</div>
            ) : (
                <div className={styles.productGrid}>
                    {products.length === 0 ? (
                        <div style={{
                            gridColumn: '1 / -1',
                            textAlign: 'center',
                            padding: '3rem',
                            color: '#999'
                        }}>
                            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No draft products available</p>
                            <p style={{ fontSize: '0.9rem' }}>Products that are scheduled or completed won't appear here</p>
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
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                background: 'rgba(220, 38, 38, 0.9)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '6px',
                                                cursor: isDeleting ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
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
                                    <Link href={`/seller/auctions/schedule?id=${product.products_id}`} className={styles.scheduleBtn}>
                                        Schedule
                                    </Link>
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
        </div>
    );
}
