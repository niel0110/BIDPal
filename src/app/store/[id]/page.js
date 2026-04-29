'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import ProductCard from '@/components/card/ProductCard';
import { useAuth } from '@/context/AuthContext';
import { Calendar, Star, MessageCircle, CheckCircle, ShieldCheck, Users, Flag, X, RefreshCw } from 'lucide-react';
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
    const [followerCount, setFollowerCount] = useState(0);
    const [completedAuctions, setCompletedAuctions] = useState([]);
    const [completedLoading, setCompletedLoading] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDetails, setReportDetails] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportDone, setReportDone] = useState(false);
    const [productScroll, setProductScroll] = useState({ progress: 0, ratio: 0.3 });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    const fetchStore = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/sellers/${id}`);
            if (!res.ok) return;
            const data = await res.json();
            setStore(data);
            setFollowerCount(prev => data.stats?.followerCount ?? prev);
        } catch {}
    };

    useEffect(() => {
        if (!id) return;

        const init = async () => {
            try {
                const token = localStorage.getItem('bidpal_token');

                const [, productsRes] = await Promise.all([
                    fetchStore(),
                    fetch(`${apiUrl}/api/products/seller/${id}?has_price=true`)
                ]);
                if (productsRes.ok) {
                    const d = await productsRes.json();
                    setProducts(d.data || []);
                }

                if (user) {
                    const followRes = await fetch(`${apiUrl}/api/follows/following/${user.user_id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (followRes.ok) {
                        const following = await followRes.json();
                        setIsFollowing(following.some(f => f.Seller?.seller_id === id));
                    }
                }
            } catch (err) {
                console.error('Failed to load store:', err);
            } finally {
                setLoading(false);
            }
        };

        init();

        // Poll store stats every 30s for real-time follower/sales updates
        const poll = setInterval(fetchStore, 30000);
        return () => clearInterval(poll);
    }, [id, user]);

    useEffect(() => {
        if (activeTab !== 'reviews' || !store) return;
        const load = async () => {
            setReviewsLoading(true);
            try {
                const res = await fetch(`${apiUrl}/api/reviews/seller/${id}`);
                if (res.ok) setReviews(await res.json());
            } catch {}
            setReviewsLoading(false);
        };
        load();
    }, [activeTab, id, store]);

    useEffect(() => {
        if (activeTab !== 'completed' || !store) return;
        const load = async () => {
            setCompletedLoading(true);
            try {
                const res = await fetch(`${apiUrl}/api/auctions/seller/${id}?status=completed&limit=50`);
                if (res.ok) {
                    const d = await res.json();
                    setCompletedAuctions(d.data || []);
                }
            } catch {}
            setCompletedLoading(false);
        };
        load();
    }, [activeTab, id, store]);

    const handleFollow = async () => {
        if (!user) { router.push('/login'); return; }
        setFollowLoading(true);
        try {
            const token = localStorage.getItem('bidpal_token');
            const endpoint = isFollowing ? '/api/follows/unfollow' : '/api/follows/follow';
            const res = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ followed_seller_id: id })
            });
            if (res.ok) {
                setIsFollowing(f => !f);
                setFollowerCount(c => isFollowing ? Math.max(0, c - 1) : c + 1);
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

    const handleProductScroll = (e) => {
        const { scrollLeft, scrollWidth, clientWidth } = e.target;
        const maxScroll = scrollWidth - clientWidth;
        setProductScroll({
            progress: maxScroll > 0 ? scrollLeft / maxScroll : 0,
            ratio: Math.min(clientWidth / scrollWidth, 1),
        });
    };

    const handleMessage = () => {
        if (!user) { router.push('/login'); return; }
        router.push(`/messages?receiverId=${store.user_id}`);
    };

    const handleReport = async (e) => {
        e.preventDefault();
        if (!user) { router.push('/login'); return; }
        if (!reportReason) return;
        setReportSubmitting(true);
        try {
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${apiUrl}/api/disputes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    reported_user_id: store.user_id,
                    reported_user_name: store.store_name,
                    context: 'Seller Store Report',
                    reason: reportReason,
                    details: reportDetails,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to submit report');
            }
            setReportDone(true);
        } catch (err) {
            console.error('Report error:', err);
            alert(err.message || 'Failed to submit report. Please try again.');
        } finally {
            setReportSubmitting(false);
        }
    };

    if (loading) return <div className={styles.main}><Header /><BIDPalLoader /></div>;
    if (!store) return <div className={styles.main}><Header /><div className={styles.empty}>Store not found.</div></div>;

    const joinedDate = store.User?.create_at
        ? new Date(store.User.create_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'Recently';
    const isVerified = store.User?.kyc_status === 'approved';
    const sellerFullName = store.User?.Fname
        ? `${store.User.Fname} ${store.User.Lname || ''}`.trim()
        : null;

    return (
        <main className={styles.main}>
            <Header />

            {/* ── Seller Profile Header (no banner) ── */}
            <section className={styles.profileHeader}>
                <div className={styles.profileInner}>

                    <div className={styles.avatarWrapper}>
                        <img
                            src={store.logo_url || 'https://placehold.co/200x200?text=Store'}
                            alt={store.store_name}
                            className={styles.avatar}
                        />
                    </div>

                    <div className={styles.storeInfo}>
                        <div className={styles.handle}>@{store.store_handle || 'seller'}</div>
                        <h1 className={styles.storeName}>{store.store_name}</h1>
                        {sellerFullName && (
                            <div className={styles.sellerRealName}>by {sellerFullName}</div>
                        )}
                        {isVerified && (
                            <div className={styles.verifiedBadge}>
                                <ShieldCheck size={13} />
                                <span>Verified Seller</span>
                            </div>
                        )}
                        <div className={styles.statsBar}>
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{store.stats?.rating || '0.0'}</span>
                                <span className={styles.statLabel}>Rating</span>
                            </div>
                            <div className={styles.statDivider} />
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{followerCount.toLocaleString()}</span>
                                <span className={styles.statLabel}>Followers</span>
                            </div>
                            <div className={styles.statDivider} />
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{(store.stats?.salesCount || 0).toLocaleString()}</span>
                                <span className={styles.statLabel}>Sales</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button className={styles.messageBtn} onClick={handleMessage} title="Message Seller">
                            <MessageCircle size={16} />
                            <span>Message</span>
                        </button>
                        <button
                            className={`${styles.followBtn} ${isFollowing ? styles.following : ''}`}
                            onClick={handleFollow}
                            disabled={followLoading}
                        >
                            {followLoading ? '...' : (isFollowing ? '✓ Following' : 'Follow Store')}
                        </button>
                        {user && user.user_id !== store.user_id && (
                            <button
                                className={styles.reportBtn}
                                onClick={() => { setReportOpen(true); setReportDone(false); setReportReason(''); setReportDetails(''); }}
                                title="Report this store"
                            >
                                <Flag size={14} />
                                <span>Report</span>
                            </button>
                        )}
                    </div>

                </div>
            </section>

            {/* ── Body ── */}
            <div className={styles.container}>

                <aside className={styles.sidebar}>
                    <div className={styles.card}>
                        <h3 className={styles.cardTitle}>About Store</h3>
                        <p className={styles.description}>
                            {store.store_description || 'Welcome to our store! We provide high-quality items and premium service to all our customers.'}
                        </p>
                    </div>

                    <div className={styles.card}>
                        <h3 className={styles.cardTitle}>Store Info</h3>
                        <div className={styles.infoList}>
                            <div className={styles.infoItem}>
                                <Calendar size={16} color="#666" />
                                <span>Joined {joinedDate}</span>
                            </div>
                            {store.business_category && (
                                <div className={styles.infoItem}>
                                    <Star size={16} color="#f59e0b" />
                                    <span>{store.business_category}</span>
                                </div>
                            )}
                            {isVerified && (
                                <div className={styles.infoItem}>
                                    <CheckCircle size={16} color="#16a34a" />
                                    <span>Verified Seller</span>
                                </div>
                            )}
                            <div className={styles.infoItem}>
                                <Users size={16} color="#666" />
                                <span>{(store.stats?.salesCount || 0).toLocaleString()} Total Sales</span>
                            </div>
                            {store.stats?.reviewCount > 0 && (
                                <div className={styles.infoItem}>
                                    <Star size={16} color="#f59e0b" />
                                    <span>{store.stats.rating} avg · {store.stats.reviewCount} review{store.stats.reviewCount !== 1 ? 's' : ''}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                <div className={styles.contentArea}>
                    <div className={styles.tabs}>
                        <div className={`${styles.tab} ${activeTab === 'all' ? styles.activeTab : ''}`} onClick={() => setActiveTab('all')}>
                            Fixed Price {products.length > 0 ? `(${products.length})` : ''}
                        </div>
                        <div className={`${styles.tab} ${activeTab === 'completed' ? styles.activeTab : ''}`} onClick={() => setActiveTab('completed')}>
                            Completed Auctions
                        </div>
                        <div className={`${styles.tab} ${activeTab === 'reviews' ? styles.activeTab : ''}`} onClick={() => setActiveTab('reviews')}>
                            Reviews {store.stats?.reviewCount ? `(${store.stats.reviewCount})` : ''}
                        </div>
                    </div>

                    {activeTab === 'completed' ? (
                        <div className={styles.completedGrid}>
                            {completedLoading ? (
                                <BIDPalLoader size="section" />
                            ) : completedAuctions.length > 0 ? (
                                completedAuctions.map(a => (
                                    <div key={a.auction_id} className={styles.completedCard}>
                                        <div className={styles.completedImgWrap}>
                                            <img
                                                src={a.product_image || 'https://placehold.co/400x300?text=No+Image'}
                                                alt={a.product_name}
                                                className={styles.completedImg}
                                            />
                                            <span className={styles.completedBadge}>
                                                {a.status === 'completed' ? 'Sold' : 'Ended'}
                                            </span>
                                        </div>
                                        <div className={styles.completedInfo}>
                                            <p className={styles.completedName}>{a.product_name}</p>
                                            <p className={styles.completedPrice}>
                                                ₱{(a.final_price || a.current_price || 0).toLocaleString()}
                                            </p>
                                            {a.end_time && (
                                                <p className={styles.completedDate}>
                                                    {new Date(a.end_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.empty}>No completed auctions yet.</div>
                            )}
                        </div>
                    ) : activeTab === 'reviews' ? (
                        <div className={styles.reviewsList}>
                            {reviewsLoading ? (
                                <BIDPalLoader size="section" />
                            ) : reviews.length > 0 ? (
                                <>
                                    {(() => {
                                        const avg = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
                                        const starCounts = [5,4,3,2,1].map(s => ({
                                            star: s,
                                            count: reviews.filter(r => r.rating === s).length,
                                            pct: Math.round((reviews.filter(r => r.rating === s).length / reviews.length) * 100)
                                        }));
                                        return (
                                            <div className={styles.reviewsSummary}>
                                                <div className={styles.reviewsLeft}>
                                                    <span className={styles.reviewsAvg}>{avg.toFixed(1)}</span>
                                                    <div className={styles.reviewsStars}>
                                                        {[1,2,3,4,5].map(s => (
                                                            <Star key={s} size={16}
                                                                fill={s <= Math.round(avg) ? '#f59e0b' : 'none'}
                                                                stroke={s <= Math.round(avg) ? '#f59e0b' : '#d1d5db'}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className={styles.reviewsCount}>
                                                        {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <div className={styles.reviewsBars}>
                                                    {starCounts.map(({ star, count, pct }) => (
                                                        <div key={star} className={styles.reviewsBarRow}>
                                                            <span className={styles.reviewsBarLabel}>{star} ★</span>
                                                            <div className={styles.reviewsBarTrack}>
                                                                <div className={styles.reviewsBarFill} style={{ width: `${pct}%` }} />
                                                            </div>
                                                            <span className={styles.reviewsBarCount}>{count}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {reviews.map((r, idx) => {
                                        const initial = (r.reviewer?.name || 'B').charAt(0).toUpperCase();
                                        return (
                                        <div key={r.review_id || idx} className={styles.reviewCard}>
                                            <div className={styles.reviewCardTop}>
                                                <div className={styles.reviewerInfo}>
                                                    {r.reviewer?.avatar ? (
                                                        <img src={r.reviewer.avatar} alt={r.reviewer.name} className={styles.reviewerAvatar} />
                                                    ) : (
                                                        <div className={styles.reviewerAvatarFallback}>{initial}</div>
                                                    )}
                                                    <div>
                                                        <p className={styles.reviewerName}>{r.reviewer?.name || 'Buyer'}</p>
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
                                        );
                                    })}
                                </>
                            ) : (
                                <div className={styles.empty}>No reviews yet.</div>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Scroll indicator */}
                            {products.length > 0 && (
                                <div className={styles.scrollIndicatorBar}>
                                    <div
                                        className={styles.scrollThumb}
                                        style={{
                                            width: `${productScroll.ratio * 100}%`,
                                            left: `${productScroll.progress * (100 - productScroll.ratio * 100)}%`,
                                        }}
                                    />
                                </div>
                            )}
                            <div
                                className={styles.productScroll}
                                onScroll={handleProductScroll}
                            >
                                {products.length > 0 ? (
                                    products.map(item => (
                                        <ProductCard key={item.products_id} data={{
                                            ...item,
                                            title: item.name,
                                            image: item.images?.[0]?.image_url,
                                            wishlistCount: item.wishlist_count || 0,
                                        }} />
                                    ))
                                ) : (
                                    <div className={styles.empty}>No products listed yet.</div>
                                )}
                            </div>
                        </>
                    )}
                </div>

            </div>

            {/* ── Report Modal ── */}
            {reportOpen && (
                <div className={styles.modalOverlay} onClick={() => setReportOpen(false)}>
                    <div className={styles.modalBox} onClick={e => e.stopPropagation()}>

                        {reportDone ? (
                            <div className={styles.reportSuccess}>
                                <div className={styles.reportSuccessIcon}>
                                    <CheckCircle size={36} color="#16a34a" />
                                </div>
                                <h3 className={styles.reportSuccessTitle}>Report Submitted</h3>
                                <p className={styles.reportSuccessMsg}>
                                    Our team will review your report within 24–48 hours. Thank you for helping keep BIDPal safe.
                                </p>
                                <button
                                    className={styles.reportCloseBtn}
                                    onClick={() => setReportOpen(false)}
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleReport}>
                                {/* Header */}
                                <div className={styles.modalHeader}>
                                    <div className={styles.modalHeaderLeft}>
                                        <Flag size={16} color="#D32F2F" />
                                        <div>
                                            <h3 className={styles.modalTitle}>Report Store</h3>
                                            <p className={styles.modalSubtitle}>{store.store_name}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.modalClose}
                                        onClick={() => setReportOpen(false)}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Reason */}
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>
                                        Reason <span className={styles.required}>*</span>
                                    </label>
                                    <select
                                        value={reportReason}
                                        onChange={e => setReportReason(e.target.value)}
                                        required
                                        className={styles.formSelect}
                                    >
                                        <option value="">Select a reason…</option>
                                        <option value="Fake or counterfeit products">Fake or counterfeit products</option>
                                        <option value="Misleading product descriptions">Misleading product descriptions</option>
                                        <option value="Scam or fraudulent activity">Scam or fraudulent activity</option>
                                        <option value="Inappropriate content">Inappropriate content</option>
                                        <option value="Harassment or threatening behavior">Harassment or threatening behavior</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                {/* Details */}
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>
                                        Additional Details
                                        <span className={styles.optional}> (optional)</span>
                                    </label>
                                    <textarea
                                        value={reportDetails}
                                        onChange={e => setReportDetails(e.target.value)}
                                        rows={3}
                                        placeholder="Provide any additional context that may help our team…"
                                        className={styles.formTextarea}
                                    />
                                </div>

                                {/* Actions */}
                                <div className={styles.modalActions}>
                                    <button
                                        type="button"
                                        className={styles.cancelBtn}
                                        onClick={() => setReportOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className={styles.submitReportBtn}
                                        disabled={reportSubmitting || !reportReason}
                                    >
                                        {reportSubmitting ? 'Submitting…' : 'Submit Report'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </main>
    );
}
