'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, Filter, Plus, X } from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';

const CONDITIONS = ['Brand New', 'Like New', 'Lightly Used', 'Used', 'Heavily Used', 'For Parts'];

export default function SelectProductPage() {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterOpen, setFilterOpen] = useState(false);
    const [selectedCondition, setSelectedCondition] = useState('');
    const filterRef = useRef(null);

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
