'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShoppingCart, Heart, Flag, X, CheckCircle, ShieldCheck, Star, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import BIDPalLoader from '@/components/BIDPalLoader';
import Header from '@/components/layout/Header';
import styles from './page.module.css';

function formatCondition(raw) {
    if (!raw) return null;
    return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ProductDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { addToCart, isInCart } = useCart();

    const [product, setProduct] = useState(null);
    const [seller, setSeller] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mainImg, setMainImg] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [liked, setLiked] = useState(false);
    const [addError, setAddError] = useState('');

    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDetails, setReportDetails] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportDone, setReportDone] = useState(false);

    useEffect(() => {
        if (!id) return;
        const fetchProduct = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const res = await fetch(`${apiUrl}/api/products/${id}`);
                if (!res.ok) throw new Error('Product not found');
                const data = await res.json();
                setProduct(data);
                const images = data.images || [];
                setMainImg(images[0]?.image_url || null);
                if (data.seller_id) {
                    const sellerRes = await fetch(`${apiUrl}/api/sellers/${data.seller_id}`);
                    if (sellerRes.ok) setSeller(await sellerRes.json());
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProduct();
    }, [id]);

    const handleAddToCart = async () => {
        if (!user) { router.push('/'); return; }
        setIsAdding(true);
        setAddError('');
        const result = await addToCart(product.products_id);
        setIsAdding(false);
        if (!result.success) setAddError(result.error || 'Failed to add to cart');
    };

    const handleBuyNow = () => {
        if (!user) { router.push('/'); return; }
        if (isSoldOut) return;
        router.push(`/checkout?product_id=${product.products_id}`);
    };

    const handleReport = async (e) => {
        e.preventDefault();
        if (!user) { router.push('/'); return; }
        if (!reportReason) return;
        setReportSubmitting(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${apiUrl}/api/disputes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    reported_user_id: product.seller_id,
                    reported_user_name: seller?.store_name || 'Unknown Store',
                    context: `Product Report | Product: ${product.name} | Product ID: ${product.products_id}`,
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

    if (loading) return <BIDPalLoader />;

    if (!product) return (
        <main style={{ background: '#f8f9fb', minHeight: '100vh' }}>
            <Header />
            <div style={{ padding: '6rem 2rem', textAlign: 'center' }}>
                <h2 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Product not found</h2>
                <button onClick={() => router.back()} style={{ color: '#D32F2F', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}>
                    ← Go back
                </button>
            </div>
        </main>
    );

    const thumbs = (product.images || []).filter(img => img?.image_url && img.image_url !== 'noposter');
    const displayPrice = product.price ?? product.starting_price;
    const conditionLabel = formatCondition(product.condition);
    const isSoldOut = product.status === 'sold' || product.availability === 0;
    const isAlreadyInCart = isInCart(product.products_id);
    const lowStock = product.availability > 0 && product.availability <= 5;
    const isVerified = seller?.User?.kyc_status === 'approved';
    const isOwnListing = Boolean(
        user &&
        (
            user.seller_id === product.seller_id ||
            user.user_id === seller?.user_id ||
            user.user_id === seller?.User?.user_id
        )
    );

    return (
        <main style={{ background: '#f8f9fb', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Header />

            {/* ── Top bar ── */}
            <div style={{
                background: 'white', borderBottom: '1px solid #f1f5f9',
                padding: '0 1.5rem', height: 44,
                display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
                <button
                    onClick={() => router.back()}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, padding: '4px 0', fontFamily: 'inherit' }}
                >
                    ← Back
                </button>
                <span style={{ color: '#e2e8f0' }}>|</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Product Detail</span>
            </div>

            {/* ── Main card ── */}
            <div className={styles.pageWrapper}>
                <div className={styles.productCard}>

                    {/* ── LEFT: image gallery ── */}
                    <div className={styles.detailLeft}>
                        <div className={styles.imgWrapper}>
                            <img
                                src={mainImg || 'https://placehold.co/600x600?text=No+Image'}
                                alt={product.name}
                                className={styles.mainImg}
                            />
                            {isSoldOut && <div className={styles.soldOverlay}>SOLD OUT</div>}
                            {!isOwnListing && (
                                <button
                                    className={styles.heartBtn}
                                    onClick={() => setLiked(l => !l)}
                                >
                                    <Heart size={16} fill={liked ? '#D32F2F' : 'none'} color={liked ? '#D32F2F' : 'white'} />
                                </button>
                            )}
                        </div>

                        {thumbs.length > 1 && (
                            <div className={styles.thumbnailRow}>
                                {thumbs.slice(0, 6).map((img, idx) => (
                                    <img
                                        key={idx}
                                        src={img.image_url}
                                        alt=""
                                        className={`${styles.thumbImg} ${mainImg === img.image_url ? styles.thumbImgActive : ''}`}
                                        onClick={() => setMainImg(img.image_url)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── RIGHT: product info ── */}
                    <div className={styles.detailRight}>

                        {/* Header: title + badge + price */}
                        <div className={styles.productHeader}>
                            <h2 className={styles.productTitle}>{product.name}</h2>
                            <span className={styles.statusBadge}>
                                {isSoldOut ? 'Sold Out' : '🏷 Fixed Price'}
                            </span>
                            <div className={styles.priceRow}>
                                <span className={styles.priceBig}>
                                    {displayPrice != null ? `₱${Number(displayPrice).toLocaleString('en-PH')}` : '—'}
                                </span>
                                <span className={styles.priceLabel}>fixed price</span>
                            </div>
                        </div>

                        {/* Item Specifications */}
                        <div className={styles.specSection}>
                            <h3>Item Specifications</h3>
                            <div className={styles.specGrid}>
                                {conditionLabel && (
                                    <div className={styles.specItem}>
                                        <span className={styles.specItemLabel}>Condition: </span>{conditionLabel}
                                    </div>
                                )}
                                {product.availability != null && (
                                    <div className={styles.specItem}>
                                        <span className={styles.specItemLabel}>Stock: </span>
                                        <span style={{ color: lowStock ? '#d97706' : 'inherit' }}>
                                            {isSoldOut ? 'Sold Out' : `${product.availability} available`}
                                        </span>
                                    </div>
                                )}
                                {product.brand && (
                                    <div className={styles.specItem}>
                                        <span className={styles.specItemLabel}>Brand: </span>{product.brand}
                                    </div>
                                )}
                                {product.category && (
                                    <div className={styles.specItem}>
                                        <span className={styles.specItemLabel}>Category: </span>{product.category}
                                    </div>
                                )}
                            </div>
                            {product.specifications && (
                                <p className={styles.specText} style={{ marginTop: '0.5rem' }}>{product.specifications}</p>
                            )}
                        </div>

                        {/* Description */}
                        {product.description && (
                            <div className={styles.specSection}>
                                <h3>Description</h3>
                                <p className={styles.specText}>{product.description}</p>
                            </div>
                        )}

                        {/* Seller card */}
                        {seller && (
                            <div className={styles.sellerCard}>
                                <div className={styles.sellerHead}>
                                    <div
                                        className={styles.sellerAvatarLg}
                                        style={{
                                            backgroundImage: seller.logo_url ? `url(${seller.logo_url})` : 'none',
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                        }}
                                    >
                                        {!seller.logo_url && (seller.store_name?.[0]?.toUpperCase() || 'S')}
                                    </div>
                                    <div className={styles.sellerMeta}>
                                        <div className={styles.sellerNameBold}>{seller.store_name}</div>
                                        {seller.full_name && (
                                            <div className={styles.sellerSubName}>{seller.full_name}</div>
                                        )}
                                    </div>
                                    {!isOwnListing && (
                                        <button
                                            className={styles.visitBtn}
                                            onClick={() => router.push(`/store/${product.seller_id}`)}
                                        >
                                            Visit
                                        </button>
                                    )}
                                </div>
                                <div className={styles.sellerStatsRow}>
                                    {isVerified && (
                                        <span className={styles.sellerStat}>
                                            <ShieldCheck size={13} color="#1d4ed8" /> Verified Seller
                                        </span>
                                    )}
                                    {seller.stats?.rating && (
                                        <span className={styles.sellerStat}>
                                            <Star size={13} color="#f59e0b" /> {seller.stats.rating} Rating
                                        </span>
                                    )}
                                    {seller.stats?.salesCount > 0 && (
                                        <span className={styles.sellerStat}>
                                            {seller.stats.salesCount.toLocaleString()} Sales
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {isOwnListing ? (
                            <div className={styles.sellerListingActions}>
                                <div className={styles.ownerNotice}>
                                    This is your fixed-price listing.
                                </div>
                                <button
                                    className={styles.manageListingBtn}
                                    onClick={() => router.push('/seller/orders')}
                                >
                                    Manage Fixed Price Listings
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Purchase actions */}
                                {addError && <div className={styles.addError}>{addError}</div>}
                                <div className={styles.purchaseActions}>
                                    <button
                                        className={`${styles.addCartBtn} ${isAlreadyInCart ? styles.addCartBtnSuccess : ''}`}
                                        onClick={handleAddToCart}
                                        disabled={isAdding || isAlreadyInCart || isSoldOut}
                                    >
                                        <ShoppingCart size={18} />
                                        {isAdding ? 'Adding…' : isAlreadyInCart ? 'Added to Cart ✓' : isSoldOut ? 'Sold Out' : 'Add to Cart'}
                                    </button>
                                    <button
                                        className={styles.buyNowBtn}
                                        onClick={handleBuyNow}
                                        disabled={isAdding || isSoldOut}
                                    >
                                        <Zap size={18} />
                                        Buy Now
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Report */}
                        {user && !isOwnListing && (
                            <button
                                className={styles.reportBtn}
                                onClick={() => { setReportOpen(true); setReportDone(false); setReportReason(''); setReportDetails(''); }}
                            >
                                <Flag size={13} />
                                Report Product
                            </button>
                        )}
                    </div>
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
                                <button className={styles.reportCloseBtn} onClick={() => setReportOpen(false)}>Done</button>
                            </div>
                        ) : (
                            <form onSubmit={handleReport}>
                                <div className={styles.modalHeader}>
                                    <div className={styles.modalHeaderLeft}>
                                        <Flag size={16} color="#D32F2F" />
                                        <div>
                                            <h3 className={styles.modalTitle}>Report Product</h3>
                                            <p className={styles.modalSubtitle}>{product.name}</p>
                                        </div>
                                    </div>
                                    <button type="button" className={styles.modalClose} onClick={() => setReportOpen(false)}>
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Reason <span className={styles.required}>*</span></label>
                                    <select className={styles.formSelect} value={reportReason} onChange={e => setReportReason(e.target.value)} required>
                                        <option value="">Select a reason…</option>
                                        <option value="Fake or counterfeit products">Fake or counterfeit products</option>
                                        <option value="Misleading product description">Misleading product description</option>
                                        <option value="Prohibited or illegal item">Prohibited or illegal item</option>
                                        <option value="Wrong category">Wrong category</option>
                                        <option value="Spam or duplicate listing">Spam or duplicate listing</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.formLabel}>Additional details <span className={styles.optional}>(optional)</span></label>
                                    <textarea className={styles.formTextarea} placeholder="Describe the issue…" value={reportDetails} onChange={e => setReportDetails(e.target.value)} rows={3} />
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={styles.cancelBtn} onClick={() => setReportOpen(false)}>Cancel</button>
                                    <button type="submit" className={styles.submitReportBtn} disabled={!reportReason || reportSubmitting}>
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
