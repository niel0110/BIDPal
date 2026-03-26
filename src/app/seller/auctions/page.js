'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    MoreHorizontal,
    Clock,
    TrendingUp,
    Calendar,
    CheckCircle2,
    Package
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function MyAuctions() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('all');
    const [auctions, setAuctions] = useState([]);
    const [draftProducts, setDraftProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300); // 300ms delay

        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            try {
                const userId = user.user_id || user.id;
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');

                // If drafts tab is selected, fetch draft products
                if (activeTab === 'drafts') {
                    // Build URL with search parameter
                    const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
                    const res = await fetch(`${apiUrl}/api/products/seller/${userId}?status=draft${searchParam}`, {
                        headers: {
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    });

                    if (res.ok) {
                        const data = await res.json();
                        // Filter on frontend for drafts since backend doesn't support search for products
                        let products = data.data || [];
                        if (debouncedSearch && debouncedSearch.trim()) {
                            const searchLower = debouncedSearch.toLowerCase().trim();
                            products = products.filter(product =>
                                product.name?.toLowerCase().includes(searchLower) ||
                                product.description?.toLowerCase().includes(searchLower)
                            );
                        }
                        setDraftProducts(products);
                        setAuctions([]);
                    } else {
                        console.error('Failed to fetch draft products');
                        setDraftProducts([]);
                    }
                } else {
                    // Fetch auctions for other tabs with search
                    const statusParam = activeTab !== 'all' ? `status=${activeTab}` : '';
                    const searchParam = debouncedSearch ? `search=${encodeURIComponent(debouncedSearch)}` : '';
                    const params = [statusParam, searchParam].filter(Boolean).join('&');
                    const queryString = params ? `?${params}` : '';

                    const res = await fetch(`${apiUrl}/api/auctions/seller/${userId}${queryString}`, {
                        headers: {
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    });

                    if (res.ok) {
                        const data = await res.json();
                        setAuctions(data.data || []);
                        setDraftProducts([]);
                    } else {
                        const errorData = await res.json();
                        console.error('Failed to fetch auctions:', res.status, errorData);
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            setLoading(true);
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user, activeTab, debouncedSearch]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <h1>My Auctions</h1>
                    <p>Manage your live, scheduled, and past auctions.</p>
                </div>
                <div className={styles.buttonGroup}>
                    <Link href="/seller/inventory" className={styles.productsBtn}>
                        <Package size={20} />
                        My Products
                    </Link>
                    <Link href="/seller/auctions/create" className={styles.createBtn}>
                        <Plus size={20} />
                        Create Auction
                    </Link>
                </div>
            </header>

            <div className={styles.tabsContainer}>
                <div className={styles.tabs}>
                    {['all', 'active', 'scheduled', 'completed', 'drafts'].map(tab => (
                        <button
                            key={tab}
                            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
                <div className={styles.searchBox}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search auctions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className={styles.auctionGrid}>
                {loading ? (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', color: '#888' }}>
                        <p>Loading {activeTab === 'drafts' ? 'draft products' : 'auctions'}...</p>
                    </div>
                ) : activeTab === 'drafts' ? (
                    // Show draft products
                    draftProducts.length > 0 ? draftProducts.map(product => (
                        <div key={product.products_id} className={styles.auctionCard}>
                            <div className={styles.cardHeader}>
                                <span className={`${styles.statusBadge} ${styles.drafts}`}>
                                    <Package size={12} />
                                    DRAFT
                                </span>
                                <span className={styles.auctionId}>#{product.products_id.slice(0, 8)}</span>
                                <button className={styles.moreBtn}><MoreHorizontal size={18} /></button>
                            </div>

                            <div className={styles.cardBody}>
                                <img
                                    src={product.images && product.images.length > 0 ? product.images[0].image_url : 'https://placehold.co/200x200?text=No+Image'}
                                    alt={product.name}
                                    className={styles.thumbnail}
                                />
                                <div className={styles.info}>
                                    <h3>{product.name}</h3>
                                    <div className={styles.meta}>
                                        <Clock size={14} />
                                        <span>Not scheduled</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.cardFooter}>
                                <div className={styles.metric}>
                                    <span className={styles.metricLabel}>Starting Price</span>
                                    <span className={styles.metricValue}>
                                        ₱ {(product.starting_price || product.price || 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className={styles.metric}>
                                    <span className={styles.metricLabel}>Condition</span>
                                    <span className={styles.metricValue} style={{ textTransform: 'capitalize' }}>
                                        {product.condition || 'New'}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.cardActions}>
                                <Link href={`/seller/inventory`} className={styles.secondaryBtn}>View in Inventory</Link>
                                <Link href={`/seller/auctions/schedule?id=${product.products_id}`} className={styles.primaryBtn}>Schedule Auction</Link>
                            </div>
                        </div>
                    )) : (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', color: '#888' }}>
                            <Package size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                            <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No draft products</p>
                            <p style={{ fontSize: '0.9rem' }}>All your products are scheduled or active.</p>
                        </div>
                    )
                ) : (
                    // Show auctions
                    auctions.length > 0 ? auctions.map(auction => {
                        const startTime = new Date(auction.start_time);
                        const formattedStartTime = startTime.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        });

                        return (
                        <div key={auction.auction_id} className={styles.auctionCard}>
                            <div className={styles.cardHeader}>
                                <span className={`${styles.statusBadge} ${styles[auction.status === 'ended' ? 'completed' : auction.status]}`}>
                                    {auction.status === 'active' && <TrendingUp size={12} />}
                                    {auction.status === 'scheduled' && <Calendar size={12} />}
                                    {(auction.status === 'completed' || auction.status === 'ended') && <CheckCircle2 size={12} />}
                                    {(auction.status === 'ended' ? 'completed' : auction.status).toUpperCase()}
                                </span>
                                <span className={styles.auctionId}>#{auction.auction_id.slice(0, 8)}</span>
                                <button className={styles.moreBtn}><MoreHorizontal size={18} /></button>
                            </div>

                            <div className={styles.cardBody}>
                                <img
                                    src={auction.product_image || 'https://placehold.co/200x200?text=No+Image'}
                                    alt={auction.product_name}
                                    className={styles.thumbnail}
                                />
                                <div className={styles.info}>
                                    <h3>{auction.product_name}</h3>
                                    <div className={styles.meta}>
                                        <Clock size={14} />
                                        <span>{formattedStartTime}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.cardFooter}>
                                <div className={styles.metric}>
                                    <span className={styles.metricLabel}>
                                        {auction.status === 'completed' ? 'Final Price' : auction.buy_now_price > 0 ? 'Buy Now Price' : 'Starting Bid'}
                                    </span>
                                    <span className={styles.metricValue}>
                                        ₱ {(auction.buy_now_price > 0 ? auction.buy_now_price : auction.current_price || auction.reserve_price || 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className={styles.metric}>
                                    <span className={styles.metricLabel}>Type</span>
                                    <span className={styles.metricValue}>
                                        {auction.buy_now_price > 0 ? 'Fixed Sale' : 'Auction'}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.cardActions}>
                                {auction.status === 'scheduled' && <button className={styles.primaryBtn}>Promote</button>}
                                {auction.status === 'active' && <Link href="/seller" className={styles.primaryBtn}>Control Hub</Link>}
                                {(auction.status === 'completed' || auction.status === 'ended') && (
                                    <Link href={`/seller/auctions/${auction.auction_id}/results`} className={styles.primaryBtn}>
                                        View Results
                                    </Link>
                                )}
                            </div>
                        </div>
                        );
                    }) : (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', color: '#888' }}>
                            <Calendar size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                            <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No auctions yet</p>
                            <p style={{ fontSize: '0.9rem' }}>Create your first auction to start selling.</p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
