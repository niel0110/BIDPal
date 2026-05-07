'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ProductCard from '@/components/card/ProductCard';
import { useAuth } from '@/context/AuthContext';
import {
    Calendar, Star, CheckCircle, ShieldCheck, Users,
    ChevronLeft, ChevronRight, Camera, Pencil, Check, X,
} from 'lucide-react';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function SellerStorePage() {
    const { user } = useAuth();
    const router = useRouter();

    const [store, setStore] = useState(null);
    const [products, setProducts] = useState([]);
    const [completedAuctions, setCompletedAuctions] = useState([]);
    const [sellerOrders, setSellerOrders] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [followerCount, setFollowerCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

    // Avatar upload
    const [logoUploading, setLogoUploading] = useState(false);
    const logoInputRef = useRef(null);

    // About store inline edit
    const [editingAbout, setEditingAbout] = useState(false);
    const [aboutDraft, setAboutDraft] = useState('');
    const [savingAbout, setSavingAbout] = useState(false);

    const onSaleScrollRef = useRef(null);
    const soldScrollRef = useRef(null);
    const completedScrollRef = useRef(null);

    const fetchStore = useCallback(async (sellerId) => {
        try {
            const res = await fetch(`${API_URL}/api/sellers/${sellerId}`);
            if (!res.ok) return;
            const data = await res.json();
            setStore(data);
            setFollowerCount(data.stats?.followerCount ?? 0);
        } catch {}
    }, []);

    useEffect(() => {
        if (!user?.seller_id) return;
        const sid = user.seller_id;

        const init = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('bidpal_token');
                const [, productsRes, completedRes, reviewsRes, ordersRes] = await Promise.all([
                    fetchStore(sid),
                    fetch(`${API_URL}/api/auctions?sale_type=sale&seller_id=${sid}&limit=1000`),
                    fetch(`${API_URL}/api/auctions/seller/${sid}?status=completed&limit=1000`),
                    fetch(`${API_URL}/api/reviews/seller/${sid}`),
                    fetch(`${API_URL}/api/orders/seller/${sid}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);

                if (productsRes.ok) { const d = await productsRes.json(); setProducts(d.data || []); }
                if (completedRes.ok) { const d = await completedRes.json(); setCompletedAuctions(d.data || []); }
                if (reviewsRes.ok) setReviews(await reviewsRes.json());
                if (ordersRes.ok) setSellerOrders(await ordersRes.json());
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [user?.seller_id, fetchStore]);

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !user?.seller_id) return;
        setLogoUploading(true);
        try {
            const token = localStorage.getItem('bidpal_token');
            const formData = new FormData();
            formData.append('logo', file);
            const res = await fetch(`${API_URL}/api/sellers/${user.seller_id}/logo`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (res.ok) await fetchStore(user.seller_id);
        } catch (err) {
            console.error('Logo upload error:', err);
        } finally {
            setLogoUploading(false);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    const handleSaveAbout = async () => {
        if (!user?.seller_id || !store) return;
        setSavingAbout(true);
        try {
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${API_URL}/api/sellers/${user.seller_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ store_description: aboutDraft }),
            });
            if (res.ok) {
                setStore(prev => ({ ...prev, store_description: aboutDraft }));
                setEditingAbout(false);
            }
        } catch (err) {
            console.error('Save about error:', err);
        } finally {
            setSavingAbout(false);
        }
    };

    const scrollRow = (ref, direction) => {
        const node = ref.current;
        if (!node) return;
        node.scrollBy({ left: direction === 'left' ? -300 : 300, behavior: 'smooth' });
    };

    if (loading) return <BIDPalLoader />;
    if (!store) return <div className={styles.empty}>Store not found.</div>;

    const isVerified = store.User?.kyc_status === 'approved';
    const joinedDate = store.User?.create_at
        ? new Date(store.User.create_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'Recently';

    const soldFixedOrders = sellerOrders.filter(o =>
        (o.order_type || 'regular') === 'regular' &&
        o.status !== 'cancelled' &&
        o.product?.products_id
    );
    const soldProductIds = new Set(soldFixedOrders.map(o => o.product.products_id));
    const visibleProducts = products.filter(p => !soldProductIds.has(p.products_id));
    const soldFixedCards = soldFixedOrders.map(o => ({
        auction_id: `fixed-${o.order_id}`,
        product_name: o.product?.name || 'Fixed Price Item',
        product_image: o.product?.image || null,
        final_price: o.product?.final_price || o.total_amount || 0,
        end_time: o.placed_at,
        status: 'sold',
    }));

    const avatarSrc = store.logo_url || store.User?.Avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(store.store_name || 'Store')}&background=cc2b41&color=fff&size=200`;

    const renderSliderHeader = (title, count, ref) => (
        <div className={styles.sliderHeader}>
            <h2>{title} <span>{count}</span></h2>
            {count > 1 && (
                <div className={styles.sliderControls}>
                    <button type="button" onClick={() => scrollRow(ref, 'left')}><ChevronLeft size={16} /></button>
                    <button type="button" onClick={() => scrollRow(ref, 'right')}><ChevronRight size={16} /></button>
                </div>
            )}
        </div>
    );

    const renderSoldCard = (item) => (
        <div key={item.auction_id} className={styles.completedCard}>
            <div className={styles.completedImgWrap}>
                <img src={item.product_image || 'https://placehold.co/400x300?text=No+Image'} alt={item.product_name} className={styles.completedImg} />
                <span className={styles.completedBadge}>Sold</span>
            </div>
            <div className={styles.completedInfo}>
                <p className={styles.completedName}>{item.product_name}</p>
                <p className={styles.completedPrice}>₱{(item.final_price || 0).toLocaleString()}</p>
                {item.end_time && (
                    <p className={styles.completedDate}>
                        {new Date(item.end_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                )}
            </div>
        </div>
    );

    return (
        <div className={styles.page}>

            {/* ── Banner ── */}
            {store.banner_url && (
                <div className={styles.bannerSection}>
                    <img src={store.banner_url} alt="Store banner" className={styles.bannerImage} />
                </div>
            )}

            {/* ── Profile Header ── */}
            <section className={styles.profileHeader}>
                <div className={styles.profileInner}>

                    {/* Avatar */}
                    <div className={styles.avatarWrapper}>
                        <img src={avatarSrc} alt={store.store_name} className={styles.avatar} />
                        <button
                            className={styles.avatarEditBtn}
                            onClick={() => logoInputRef.current?.click()}
                            disabled={logoUploading}
                            title="Change store photo"
                        >
                            <Camera size={14} />
                            <span>{logoUploading ? 'Uploading…' : 'Edit'}</span>
                        </button>
                        <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
                    </div>

                    {/* Store info */}
                    <div className={styles.storeInfo}>
                        <div className={styles.handle}>@{store.store_handle || 'seller'}</div>
                        <h1 className={styles.storeName}>{store.store_name}</h1>
                        {isVerified && (
                            <div className={styles.verifiedBadge}>
                                <ShieldCheck size={13} /> <span>Verified Seller</span>
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
                            <div className={styles.statDivider} />
                            <div className={styles.statItem}>
                                <span className={styles.statValue}>{reviews.length}</span>
                                <span className={styles.statLabel}>Reviews</span>
                            </div>
                        </div>
                    </div>

                    {/* Edit store settings link */}
                    <button className={styles.editStoreBtn} onClick={() => router.push('/seller/settings')}>
                        <Pencil size={14} /> Edit Store Info
                    </button>

                </div>
            </section>

            {/* ── Body ── */}
            <div className={styles.container}>

                {/* Sidebar */}
                <aside className={styles.sidebar}>

                    {/* About Store */}
                    <div className={styles.card}>
                        <div className={styles.cardTitleRow}>
                            <h3 className={styles.cardTitle}>About Store</h3>
                            {!editingAbout && (
                                <button className={styles.inlineEditBtn} onClick={() => { setAboutDraft(store.store_description || ''); setEditingAbout(true); }}>
                                    <Pencil size={13} />
                                </button>
                            )}
                        </div>

                        {editingAbout ? (
                            <div className={styles.aboutEditWrap}>
                                <textarea
                                    className={styles.aboutTextarea}
                                    value={aboutDraft}
                                    onChange={e => setAboutDraft(e.target.value)}
                                    rows={4}
                                    placeholder="Tell customers about your store…"
                                    autoFocus
                                />
                                <div className={styles.aboutEditActions}>
                                    <button className={styles.aboutCancelBtn} onClick={() => setEditingAbout(false)} disabled={savingAbout}>
                                        <X size={13} /> Cancel
                                    </button>
                                    <button className={styles.aboutSaveBtn} onClick={handleSaveAbout} disabled={savingAbout}>
                                        <Check size={13} /> {savingAbout ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className={styles.description}>
                                {store.store_description || 'No description yet. Click the edit icon to add one.'}
                            </p>
                        )}
                    </div>

                    {/* Store Info */}
                    <div className={styles.card}>
                        <h3 className={styles.cardTitle}>Store Info</h3>
                        <div className={styles.infoList}>
                            <div className={styles.infoItem}><Calendar size={16} color="#666" /><span>Joined {joinedDate}</span></div>
                            {store.business_category && (
                                <div className={styles.infoItem}><Star size={16} color="#f59e0b" /><span>{store.business_category}</span></div>
                            )}
                            {isVerified && (
                                <div className={styles.infoItem}><CheckCircle size={16} color="#16a34a" /><span>Verified Seller</span></div>
                            )}
                            <div className={styles.infoItem}><Users size={16} color="#666" /><span>{(store.stats?.salesCount || 0).toLocaleString()} Total Sales</span></div>
                            {store.stats?.reviewCount > 0 && (
                                <div className={styles.infoItem}>
                                    <Star size={16} color="#f59e0b" />
                                    <span>{store.stats.rating} avg · {store.stats.reviewCount} review{store.stats.reviewCount !== 1 ? 's' : ''}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Main content */}
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

                    {/* Completed Auctions */}
                    {activeTab === 'completed' && (
                        <div className={styles.sliderSection}>
                            {renderSliderHeader('Completed Auctions', completedAuctions.length, completedScrollRef)}
                            <div className={styles.completedSlider} ref={completedScrollRef}>
                                {completedAuctions.length > 0 ? completedAuctions.map(a => (
                                    <div key={a.auction_id} className={styles.completedCard}>
                                        <div className={styles.completedImgWrap}>
                                            <img src={a.product_image || 'https://placehold.co/400x300?text=No+Image'} alt={a.product_name} className={styles.completedImg} />
                                            <span className={styles.completedBadge}>Sold</span>
                                        </div>
                                        <div className={styles.completedInfo}>
                                            <p className={styles.completedName}>{a.product_name}</p>
                                            <p className={styles.completedPrice}>₱{(a.final_price || a.current_price || 0).toLocaleString()}</p>
                                            {a.end_time && <p className={styles.completedDate}>{new Date(a.end_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                                        </div>
                                    </div>
                                )) : <div className={`${styles.empty} ${styles.panelState}`}>No completed auctions yet.</div>}
                            </div>
                        </div>
                    )}

                    {/* Reviews */}
                    {activeTab === 'reviews' && (
                        <div className={styles.reviewsList}>
                            {reviews.length > 0 ? (
                                <>
                                    {(() => {
                                        const avg = reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
                                        const starCounts = [5,4,3,2,1].map(s => ({
                                            star: s,
                                            count: reviews.filter(r => r.rating === s).length,
                                            pct: Math.round((reviews.filter(r => r.rating === s).length / reviews.length) * 100),
                                        }));
                                        return (
                                            <div className={styles.reviewsSummary}>
                                                <div className={styles.reviewsLeft}>
                                                    <span className={styles.reviewsAvg}>{avg.toFixed(1)}</span>
                                                    <div className={styles.reviewsStars}>
                                                        {[1,2,3,4,5].map(s => (
                                                            <Star key={s} size={16} fill={s <= Math.round(avg) ? '#f59e0b' : 'none'} stroke={s <= Math.round(avg) ? '#f59e0b' : '#d1d5db'} />
                                                        ))}
                                                    </div>
                                                    <span className={styles.reviewsCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
                                                </div>
                                                <div className={styles.reviewsBars}>
                                                    {starCounts.map(({ star, count, pct }) => (
                                                        <div key={star} className={styles.reviewsBarRow}>
                                                            <span className={styles.reviewsBarLabel}>{star} ★</span>
                                                            <div className={styles.reviewsBarTrack}><div className={styles.reviewsBarFill} style={{ width: `${pct}%` }} /></div>
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
                                                        {r.reviewer?.avatar
                                                            ? <img src={r.reviewer.avatar} alt={r.reviewer.name} className={styles.reviewerAvatar} />
                                                            : <div className={styles.reviewerAvatarFallback}>{initial}</div>
                                                        }
                                                        <div>
                                                            <p className={styles.reviewerName}>{r.reviewer?.name || 'Buyer'}</p>
                                                            <p className={styles.reviewDate}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                        </div>
                                                    </div>
                                                    <div className={styles.reviewStars}>
                                                        {[1,2,3,4,5].map(s => <Star key={s} size={14} fill={s <= r.rating ? '#f59e0b' : 'none'} stroke={s <= r.rating ? '#f59e0b' : '#d1d5db'} />)}
                                                    </div>
                                                </div>
                                                {r.product_name && <p className={styles.reviewProduct}>Purchased: {r.product_name}</p>}
                                                {r.comment && <p className={styles.reviewComment}>{r.comment}</p>}
                                            </div>
                                        );
                                    })}
                                </>
                            ) : <div className={styles.empty}>No reviews yet.</div>}
                        </div>
                    )}

                    {/* Fixed Price Listings */}
                    {activeTab === 'all' && (
                        <div className={styles.fixedPriceSections}>
                            <section className={styles.sliderSection}>
                                {renderSliderHeader('On Sale', visibleProducts.length, onSaleScrollRef)}
                                <div className={styles.productScroll} ref={onSaleScrollRef}>
                                    {visibleProducts.length > 0 ? visibleProducts.map(item => (
                                        <ProductCard key={item.id || item.products_id} data={{
                                            ...item,
                                            title: item.title || item.name,
                                            image: item.image || item.images?.[0]?.image_url || item.images?.[0],
                                            seller_name: item.seller_name || item.seller,
                                            wishlistCount: item.wishlist_count || 0,
                                        }} />
                                    )) : <div className={`${styles.empty} ${styles.panelState}`}>No fixed price listings yet.</div>}
                                </div>
                            </section>
                            <section className={styles.sliderSection}>
                                {renderSliderHeader('Sold', soldFixedCards.length, soldScrollRef)}
                                {soldFixedCards.length > 0
                                    ? <div className={styles.completedSlider} ref={soldScrollRef}>{soldFixedCards.map(renderSoldCard)}</div>
                                    : <div className={`${styles.empty} ${styles.panelState}`}>No sold items yet.</div>
                                }
                            </section>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
