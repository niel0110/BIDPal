'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import CategoryNav from '@/components/home/CategoryNav';
import ProductCard from '@/components/card/ProductCard';
import { 
    Calendar, 
    MapPin, 
    Star, 
    MessageCircle, 
    CheckCircle, 
    ShieldCheck,
    Users
} from 'lucide-react';
import styles from './page.module.css';

export default function StorePage() {
    const { id } = useParams();
    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        const fetchStoreData = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                
                // Fetch store profile
                const storeRes = await fetch(`${apiUrl}/api/sellers/${id}`);
                if (!storeRes.ok) {
                    const text = await storeRes.text();
                    console.error("Store fetch failed:", text);
                    throw new Error(`Failed to fetch store: ${storeRes.status}`);
                }
                const storeData = await storeRes.json();
                setStore(storeData);

                // Fetch store products
                const productsRes = await fetch(`${apiUrl}/api/products/seller/${id}`);
                if (!productsRes.ok) {
                    const text = await productsRes.text();
                    console.error("Products fetch failed:", text);
                    throw new Error(`Failed to fetch products: ${productsRes.status}`);
                }
                const productsData = await productsRes.json();
                setProducts(productsData.data || []);

            } catch (err) {
                console.error('Failed to fetch store data:', err);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchStoreData();
    }, [id]);

    if (loading) return (
        <div className={styles.main}>
            <Header />
            <div className={styles.loading}>Loading Storefront...</div>
        </div>
    );

    if (!store) return (
        <div className={styles.main}>
            <Header />
            <div className={styles.loading}>Store not found.</div>
        </div>
    );

    const joinedDate = store.User?.create_at ? new Date(store.User.create_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    }) : 'Recently';

    return (
        <main className={styles.main}>
            <Header />
            <CategoryNav />

            {/* Hero Branding Section */}
            <section className={styles.storeHero}>
                {store.banner_url ? (
                    <img src={store.banner_url} alt="Banner" className={styles.banner} />
                ) : (
                    <div className={styles.bannerPlaceholder} />
                )}
                <div className={styles.bannerOverlay} />
            </section>

            <section className={styles.headerContent}>
                <div className={styles.logoWrapper}>
                    <img 
                        src={store.logo_url || 'https://placehold.co/200x200?text=Store'} 
                        alt={store.store_name} 
                        className={styles.logo} 
                    />
                </div>
                
                <div className={styles.storeBasicInfo}>
                    <div className={styles.handle}>@{store.store_handle || 'seller'}</div>
                    <h1 className={styles.storeName}>{store.store_name}</h1>
                    
                    <div className={styles.statsBar}>
                        <div className={styles.statItem}>
                            <span className={styles.statValue}>4.9</span>
                            <span className={styles.statLabel}>Rating</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statValue}>1.2k</span>
                            <span className={styles.statLabel}>Followers</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statValue}>98%</span>
                            <span className={styles.statLabel}>Response</span>
                        </div>
                    </div>
                </div>

                <div className={styles.followActions}>
                    <button className={styles.messageBtn}>
                        <MessageCircle size={18} />
                    </button>
                    <button className={styles.followBtn}>Follow Store</button>
                </div>
            </section>

            <div className={styles.container}>
                {/* Sidebar Info */}
                <aside className={styles.sidebar}>
                    <div className={styles.card}>
                        <h3 className={styles.cardTitle}>About Store</h3>
                        <p className={styles.description}>
                            {store.store_description || "Welcome to our store! We provide high-quality items and premium service to all our customers."}
                        </p>
                    </div>

                    <div className={styles.card}>
                        <h3 className={styles.cardTitle}>Store Info</h3>
                        <div className={styles.infoList}>
                            <div className={styles.infoItem}>
                                <Calendar size={18} color="#666" />
                                <span>Joined {joinedDate}</span>
                            </div>
                            <div className={styles.infoItem}>
                                <CheckCircle size={18} color="#4CAF50" />
                                <span>Verified Seller</span>
                            </div>
                            <div className={styles.infoItem}>
                                <ShieldCheck size={18} color="#2196F3" />
                                <span>Authenticity Guaranteed</span>
                            </div>
                            <div className={styles.infoItem}>
                                <Users size={18} color="#666" />
                                <span>1,245 Total Sales</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className={styles.contentArea}>
                    <div className={styles.tabs}>
                        <div 
                            className={`${styles.tab} ${activeTab === 'all' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            All Products ({products.length})
                        </div>
                        <div 
                            className={`${styles.tab} ${activeTab === 'auctions' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('auctions')}
                        >
                            Active Auctions
                        </div>
                    </div>

                    <div className={styles.productGrid}>
                        {products.length > 0 ? (
                            products.map(item => (
                                <ProductCard key={item.products_id} data={{
                                    ...item,
                                    title: item.name,
                                    image: item.images?.[0]?.image_url,
                                    wishlistCount: Math.floor(Math.random() * 200)
                                }} />
                            ))
                        ) : (
                            <div className={styles.loading}>No products listed yet.</div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
