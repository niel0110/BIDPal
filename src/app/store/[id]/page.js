'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import CategoryNav from '@/components/home/CategoryNav';
import ProductCard from '@/components/card/ProductCard';
import { useAuth } from '@/context/AuthContext';
import {
    Calendar,
    Star,
    MessageCircle,
    CheckCircle,
    ShieldCheck,
    Users
} from 'lucide-react';
import styles from './page.module.css';

export default function StorePage() {
    const { id } = useParams();
    const { user } = useAuth();
    const router = useRouter();
    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [reviews, setReviews] = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);

    useEffect(() => {
        const fetchStoreData = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');
                
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

                // Fetch follow status if user is logged in
                if (user) {
                    const followRes = await fetch(`${apiUrl}/api/follows/following/${user.user_id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (followRes.ok) {
                        const following = await followRes.json();
                        const isFound = following.some(f => f.Seller.seller_id === id);
                        setIsFollowing(isFound);
                    }
                }

            } catch (err) {
                console.error('Failed to fetch store data:', err);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchStoreData();
    }, [id, user]);

    useEffect(() => {
        if (activeTab !== 'reviews' || !store) return;
        const fetchReviews = async () => {
            setReviewsLoading(true);
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const res = await fetch(`${apiUrl}/api/reviews/seller/${id}`);
                if (res.ok) setReviews(await res.json());
            } catch (err) {
                console.error('Failed to fetch reviews:', err);
            } finally {
                setReviewsLoading(false);
            }
        };
        fetchReviews();
    }, [activeTab, id, store]);

    const handleFollow = async () => {
        if (!user) {
            router.push('/login');
            return;
        }

        setFollowLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const endpoint = isFollowing ? '/api/follows/unfollow' : '/api/follows/follow';
            
            const res = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ followed_seller_id: id })
            });

            if (res.ok) {
                setIsFollowing(!isFollowing);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update follow status');
            }
        } catch (err) {
            console.error('Follow error:', err);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleMessage = async () => {
        if (!user) {
            router.push('/login');
            return;
        }

        // For now, redirect to messages page. 
        // In a more advanced implementation, this could open a direct chat.
        router.push(`/messages?receiverId=${store.user_id}`);
    };

    if (loading) return (
        <div className={styles.main}>
            <Header />
            <BIDPalLoader />
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
                            <span className={styles.statValue}>{store.stats?.rating || "0.0"}</span>
                            <span className={styles.statLabel}>Rating</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statValue}>{store.stats?.followerCount || 0}</span>
                            <span className={styles.statLabel}>Followers</span>
                        </div>
                        <div className={styles.statItem}>
                            <span className={styles.statValue}>{store.stats?.salesCount || 0}</span>
                            <span className={styles.statLabel}>Sales</span>
                        </div>
                    </div>
                </div>

                <div className={styles.followActions}>
                    <button 
                        className={styles.messageBtn}
                        onClick={handleMessage}
                        title="Message Seller"
                    >
                        <MessageCircle size={18} />
                    </button>
                    <button 
                        className={`${styles.followBtn} ${isFollowing ? styles.following : ''}`}
                        onClick={handleFollow}
                        disabled={followLoading}
                    >
                        {followLoading ? '...' : (isFollowing ? 'Following' : 'Follow Store')}
                    </button>
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
                                <span>{store.stats?.salesCount || 0} Total Sales</span>
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
                        <div
                            className={`${styles.tab} ${activeTab === 'reviews' ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab('reviews')}
                        >
                            Reviews {store.stats?.reviewCount ? `(${store.stats.reviewCount})` : ''}
                        </div>
                    </div>

                    {activeTab === 'reviews' ? (
                        <div className={styles.reviewsList}>
                            {reviewsLoading ? (
                                <BIDPalLoader size="section" />
                            ) : reviews.length > 0 ? (
                                <>
                                    <div className={styles.reviewsSummary}>
                                        <span className={styles.reviewsAvg}>
                                            {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
                                        </span>
                                        <div className={styles.reviewsStars}>
                                            {[1,2,3,4,5].map(s => {
                                                const avg = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
                                                return (
                                                    <Star key={s} size={18}
                                                        fill={s <= Math.round(avg) ? '#f59e0b' : 'none'}
                                                        stroke={s <= Math.round(avg) ? '#f59e0b' : '#d1d5db'}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <span className={styles.reviewsCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
                                    </div>

                                    {reviews.map(r => (
                                        <div key={r.review_id} className={styles.reviewCard}>
                                            <div className={styles.reviewCardTop}>
                                                <div className={styles.reviewerInfo}>
                                                    {r.reviewer.avatar ? (
                                                        <img src={r.reviewer.avatar} alt={r.reviewer.name} className={styles.reviewerAvatar} />
                                                    ) : (
                                                        <div className={styles.reviewerAvatarFallback}>
                                                            {r.reviewer.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className={styles.reviewerName}>{r.reviewer.name}</p>
                                                        <p className={styles.reviewDate}>
                                                            {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={styles.reviewStars}>
                                                    {[1,2,3,4,5].map(s => (
                                                        <Star key={s} size={14}
                                                            fill={s <= r.rating ? '#f59e0b' : 'none'}
                                                            stroke={s <= r.rating ? '#f59e0b' : '#d1d5db'}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            {r.product_name && (
                                                <p className={styles.reviewProduct}>Purchased: {r.product_name}</p>
                                            )}
                                            {r.comment && (
                                                <p className={styles.reviewComment}>{r.comment}</p>
                                            )}
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <div className={styles.loading}>No reviews yet.</div>
                            )}
                        </div>
                    ) : (
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
                    )}
                </div>
            </div>
        </main>
    );
}
