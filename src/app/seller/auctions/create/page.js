'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, Filter, Plus } from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';

export default function SelectProductPage() {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

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
                    // Filter out scheduled and active products
                    const availableProducts = (responseData.data || []).filter(
                        p => p.status !== 'scheduled' && p.status !== 'active'
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

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Link href="/seller/auctions" className={styles.backLink}>
                    <ChevronLeft size={24} />
                    <span>My Auctions</span>
                </Link>
                <div className={styles.titleArea}>
                    <h1>Select Product</h1>
                    <p>Choose an item from your inventory to schedule for auction or sale.</p>
                </div>
            </header>

            <div className={styles.controls}>
                <div className={styles.searchBar}>
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Search your inventory..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className={styles.filterBtn}>
                    <Filter size={20} />
                    <span>Filter</span>
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading products...</div>
            ) : (
                <div className={styles.productGrid}>
                    {filteredProducts.length === 0 && !loading ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#666' }}>
                            {searchQuery ? 'No products found matching your search.' : 'No products available for auction. Add products first.'}
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
                                    <span style={{ textTransform: 'capitalize' }}>Status: {product.status}</span>
                                </div>
                                <Link href={`/seller/auctions/schedule?id=${product.products_id}`} className={styles.selectBtn}>
                                    Select for Auction
                                </Link>
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
        </div>
    );
}
