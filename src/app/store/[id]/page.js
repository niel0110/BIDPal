'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import ProductCard from '@/components/card/ProductCard';
import { useAuth } from '@/context/AuthContext';
import { Calendar, Star, MessageCircle, CheckCircle, ShieldCheck, Users, Flag, X, ChevronLeft, ChevronRight, Camera } from 'lucide-react';
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
    const [sellerOrders, setSellerOrders] = useState([]);
    const [completedLoading, setCompletedLoading] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDetails, setReportDetails] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportDone, setReportDone] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const logoInputRef = useRef(null);
    const onSaleScrollRef = useRef(null);
    const soldScrollRef = useRef(null);
    const completedScrollRef = useRef(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    const fetchStore = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/sellers/${id}`);
            if (!res.ok) return;
            const data = await res.json();
            setStore(data);
            setFollowerCount(prev => data.stats?.followerCount ?? prev);
            return data;
        } catch {}
    };

    useEffect(() => {
        if (!id) return;

        const init = async () => {
            setLoading(true);
            setCompletedLoading(true);
            setReviewsLoading(true);
            try {
                const token = localStorage.getItem('bidpal_token');

                const [, productsRes, completedRes, reviewsRes, ordersRes] = await Promise.all([
                    fetchStore(),
                    fetch(`${apiUrl}/api/auctions?sale_type=sale&seller_id=${id}&limit=1000`),
                    fetch(`${apiUrl}/api/auctions/seller/${id}?status=completed&limit=1000`),
                    fetch(`${apiUrl}/api/reviews/seller/${id}`),
                    fetch(`${apiUrl}/api/orders/seller/${id}`),
                ]);

                if (productsRes.ok) {
                    const d = await productsRes.json();
                    setProducts(d.data || []);
                }
                if (completedRes.ok) {
                    const d = await completedRes.json();
                    setCompletedAuctions(d.data || []);
                }
                if (reviewsRes.ok) {
                    setReviews(await reviewsRes.json());
                }
                if (ordersRes.ok) {
                    setSellerOrders(await ordersRes.json());
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
                setCompletedLoading(false);
                setReviewsLoading(false);
            }
        };

        init();

        // Poll store stats every 30s for real-time follower/sales updates
        const poll = setInterval(fetchStore, 30000);
        return () => clearInterval(poll);
    }, [id, user]);

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

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoUploading(true);
        try {
            const token = localStorage.getItem('bidpal_token');
            const formData = new FormData();
            formData.append('logo', file);
            const res = await fetch(`${apiUrl}/api/sellers/${id}/logo`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (res.ok) await fetchStore();
        } catch (err) {
            console.error('Logo upload error:', err);
        } finally {
            setLogoUploading(false);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    const scrollRow = (ref, direction) => {
        const node = ref.current;
        if (!node) return;
        const amount = Math.max(220, Math.floor(node.clientWidth * 0.8));
        node.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    };

    if (loading) return <div className={styles.main}><Header /><BIDPalLoader /></div>;
    if (!store) return <div className={styles.main}><Header /><div className={styles.empty}>Store not found.</div></div>;

    const isOwnStore = user?.seller_id === id;

    const joinedDate = store.User?.create_at
        ? new Date(store.User.create_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'Recently';
    const isVerified = store.User?.kyc_status === 'approved';
    const sellerFullName = store.User?.Fname
        ? `${store.User.Fname} ${store.User.Lname || ''}`.trim()
        : null;
    const soldFixedOrders = sellerOrders.filter(order =>
        (order.order_type || 'regular') === 'regular' &&
        order.status !== 'cancelled' &&
        order.product?.products_id
    );
    const soldProductIds = new Set(soldFixedOrders.map(order => order.product.products_id));
    const visibleProducts = products.filter(item =>
        !soldProductIds.has(item.products_id)
    );
    const soldFixedCards = soldFixedOrders.map(order => ({
        auction_id: `fixed-${order.order_id}`,
        product_name: order.product?.name || 'Fixed Price Item',
        product_image: order.product?.image || null,
        final_price: order.product?.final_price || order.total_amount || 0,
        end_time: order.placed_at,
        status: 'sold',
    }));

    const renderSliderHeader = (title, count, ref) => (
        <div className={styles.sliderHeader}>
            <h2>{title} <span>{count}</span></h2>
            {count > 1 && (
                <div className={styles.sliderControls}>
                    <button type="button" onClick={() => scrollRow(ref, 'left')} aria-label={`Scroll ${title} left`}>
                        <ChevronLeft size={16} />
                    </button>
                    <button type="button" onClick={() => scrollRow(ref, 'right')} aria-label={`Scroll ${title} right`}>
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );

    const renderSoldCard = (item) => (
        <div key={item.auction_id} className={styles.completedCard}>
            <div className={styles.completedImgWrap}>
                <img
                    src={item.product_image || 'https://placehold.co/400x300?text=No+Image'}
                    alt={item.product_name}
                    className={styles.completedImg}
                />
                <span className={styles.completedBadge}>
                    {item.status === 'sold' ? 'Sold' : 'Ended'}
                </span>
            </div>
            <div className={styles.completedInfo}>
                <p className={styles.completedName}>{item.product_name}</p>
                <p className={styles.completedPrice}>
                    ₱{(item.final_price || item.current_price || 0).toLocaleString()}
                </p>
                {item.end_time && (
                    <p className={styles.completedDate}>
                        {new Date(item.end_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                )}
            </div>
        </div>
    );

    return (
        <main className={styles.main}>
            <Header />

            {/* ── Banner ── */}
            {store.banner_url && (
                <div className={styles.bannerSection}>
                    <img src={store.banner_url} alt="Store banner" className={styles.bannerImage} />
                </div>
            )}

            {/* ── Seller Profile Header ── */}
            <section className={styles.profileHeader}>
                <div className={styles.profileInner}>

                    <div className={styles.avatarWrapper}>
                        <img
                            src={store.logo_url || store.User?.Avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(store.store_name || 'Store')}&background=cc2b41&color=fff&size=200`}
                            alt={store.store_name}
                            className={styles.avatar}
                        />
                        {isOwnStore && (
                            <>
                                <button
                                    className={styles.avatarEditBtn}
                                    onClick={() => logoInputRef.current?.click()}
                                    disabled={logoUploading}
                                    title="Change store photo"
                                >
                                    <Camera size={14} />
                                    <span>{logoUploading ? 'Uploading…' : 'Edit'}</span>
                                </button>
                                <input
                                    ref={logoInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleLogoUpload}
                                />
                            </>
                        )}
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
                            Fixed Price Listings {(visibleProducts.length + soldFixedCards.length) > 0 ? `(${visibleProducts.length + soldFixedCards.length})` : ''}
                        </div>
                        <div className={`${styles.tab} ${activeTab === 'completed' ? styles.activeTab : ''}`} onClick={() => setActiveTab('completed')}>
                            Completed Auctions {completedAuctions.length > 0 ? `(${completedAuctions.length})` : ''}
                        </div>
                        <div className={`${styles.tab} ${activeTab === 'reviews' ? styles.activeTab : ''}`} onClick={() => setActiveTab('reviews')}>
                            Reviews {reviews.length > 0 ? `(${reviews.length})` : ''}
                        </div>
                    </div>

                    {activeTab === 'completed' ? (
                        <div className={styles.sliderSection}>
                            {renderSliderHeader('Completed Auctions', completedAuctions.length, completedScrollRef)}
                            <div className={styles.completedSlider} ref={completedScrollRef}>
                            {completedLoading ? (
                                <div className={styles.panelState}>
                                    <BIDPalLoader size="section" />
                                </div>
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
                                <div className={`${styles.empty} ${styles.panelState}`}>No completed auctions yet.</div>
                            )}
                            </div>
                        </div>
                    ) : activeTab === 'reviews' ? (
                        <div className={styles.reviewsList}>
                            {reviewsLoading ? (
                                <div className={styles.panelState}>
                                    <BIDPalLoader size="section" />
                                </div>
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
                                            <div className={styles.reviewFooter}>
                                                <p className={styles.reviewDate}>
                                                    {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </p>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </>
                            ) : (
                                <div className={styles.empty}>No reviews yet.</div>
                            )}
                        </div>
                    ) : (
                        <div className={styles.fixedPriceSections}>
                            <section className={styles.sliderSection}>
                                {renderSliderHeader('On Sale', visibleProducts.length, onSaleScrollRef)}
                                <div className={styles.productScroll} ref={onSaleScrollRef}>
                                {visibleProducts.length > 0 ? (
                                    visibleProducts.map(item => (
                                        <ProductCard key={item.id || item.products_id} data={{
                                            ...item,
                                            title: item.title || item.name,
                                            image: item.image || item.images?.[0]?.image_url || item.images?.[0],
                                            seller_name: item.seller_name || item.seller,
                                            wishlistCount: item.wishlist_count || 0,
                                        }} />
                                    ))
                                ) : (
                                    <div className={`${styles.empty} ${styles.panelState}`}>No fixed price listings yet.</div>
                                )}
                                </div>
                            </section>

                            <section className={styles.sliderSection}>
                                {renderSliderHeader('Sold', soldFixedCards.length, soldScrollRef)}
                                {soldFixedCards.length > 0 ? (
                                    <div className={styles.completedSlider} ref={soldScrollRef}>
                                        {soldFixedCards.map(renderSoldCard)}
                                    </div>
                                ) : (
                                    <div className={`${styles.empty} ${styles.panelState}`}>No sold fixed-price items yet.</div>
                                )}
                            </section>
                        </div>
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
