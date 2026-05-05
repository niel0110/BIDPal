'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingCart, Package, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import styles from './ProductCard.module.css';

function formatCondition(raw) {
    if (!raw) return null;
    return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ProductCard({ data, compact = false }) {
    const { user } = useAuth();
    const { addToCart, isInCart } = useCart();
    const router = useRouter();

    const [isAdding, setIsAdding] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [localAvailability, setLocalAvailability] = useState(data.availability);

    const mainImg = (data.images?.length
        ? data.images.map(i => i.image_url || i).filter(Boolean)
        : (data.image ? [data.image] : [])
    ).filter(img => img && img !== 'noposter')[0] || null;

    useEffect(() => {
        if (!user || !data.seller_id) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem('bidpal_token');
        fetch(`${apiUrl}/api/follows/check/${data.seller_id}`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setIsFollowing(d.is_following); })
            .catch(() => {});
    }, [user, data.seller_id]);

    const handleCardClick = () => {
        router.push(`/product/${data.products_id}`);
    };

    const handleToggleFollow = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) { router.push('/'); return; }
        if (isFollowLoading) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem('bidpal_token');
        setIsFollowLoading(true);
        const endpoint = isFollowing ? '/api/follows/unfollow' : '/api/follows/follow';
        try {
            const res = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ followed_seller_id: data.seller_id })
            });
            if (res.ok) setIsFollowing(prev => !prev);
        } catch (err) {
            console.error('Follow toggle error:', err);
        } finally {
            setIsFollowLoading(false);
        }
    };

    const handleAddToCart = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) { router.push('/'); return; }
        if (isAlreadyInCart || isSoldOut) return;
        setIsAdding(true);
        await addToCart(data.products_id);
        setLocalAvailability(prev => (prev != null ? Math.max(0, prev - 1) : prev));
        setIsAdding(false);
    };

    const handleBuyNow = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) { router.push('/'); return; }
        if (isSoldOut) return;

        router.push(`/checkout?product_id=${data.products_id}`);
    };

    const conditionLabel = formatCondition(data.condition);
    const displayPrice = data.price ?? data.starting_price;
    const isAlreadyInCart = isInCart(data.products_id);
    const isSoldOut = data.isSoldOut || localAvailability === 0 || data.status === 'sold' || data.product_status === 'sold';
    const lowStock = localAvailability > 0 && localAvailability <= 5;
    const sellerName = data.seller_name || data.store_name || data.seller || 'Unknown Store';
    const sellerAvatar = data.seller_avatar || data.seller_logo || null;

    return (
        <div
            className={`${styles.cardWrapper} ${compact ? styles.compactWrapper : ''}`}
            onClick={handleCardClick}
        >
            <div className={styles.card}>

                {/* Image */}
                <div className={styles.imageWrapper}>
                    <img
                        src={mainImg || 'https://placehold.co/280x280?text=No+Image'}
                        alt={data.title}
                        className={`${styles.image} ${isSoldOut ? styles.grayscale : ''}`}
                    />

                    {isSoldOut && <div className={styles.soldBadge}>Sold Out</div>}
                    {!isSoldOut && conditionLabel && (
                        <div className={styles.condBadge}>{conditionLabel}</div>
                    )}

                    <div className={styles.overlayBadge}>
                        <Package size={12} />
                        <span>
                            {isSoldOut
                                ? 'Sold Out'
                                : lowStock
                                    ? `${localAvailability} left`
                                    : localAvailability != null
                                        ? `${localAvailability} in stock`
                                        : 'In Stock'}
                        </span>
                    </div>
                </div>


                {/* Footer */}
                <div className={styles.footer}>
                    <div className={styles.sellerRow}>
                        <Link
                            href={`/store/${data.seller_id}`}
                            className={styles.sellerLink}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className={styles.sellerInfo}>
                                <div className={styles.avatar} style={{
                                    backgroundImage: sellerAvatar ? `url(${sellerAvatar})` : 'none',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }} />
                                <span className={styles.sellerName}>{sellerName}</span>
                            </div>
                        </Link>
                        <button
                            className={`${styles.followBtn} ${isFollowing ? styles.followingBtn : ''}`}
                            onClick={handleToggleFollow}
                            disabled={isFollowLoading}
                        >
                            {isFollowLoading ? '...' : isFollowing ? 'Following' : '+ Follow'}
                        </button>
                    </div>

                    <div className={styles.itemInfo}>
                        <div className={styles.titleRow}>
                            <span className={styles.titleText}>{data.title}</span>
                            <span className={styles.priceText}>
                                {displayPrice != null ? `₱${Number(displayPrice).toLocaleString('en-PH')}` : '—'}
                            </span>
                        </div>
                        <div className={styles.actionRow}>
                            <div className={styles.actionButtons}>
                            <button
                                className={`${styles.cartBtn} ${isAlreadyInCart ? styles.cartBtnAdded : ''}`}
                                onClick={handleAddToCart}
                                disabled={isAdding || isAlreadyInCart || isSoldOut}
                            >
                                <ShoppingCart size={13} />
                                {isAdding ? 'Adding…' : isAlreadyInCart ? 'Added ✓' : 'Add to Cart'}
                            </button>
                            <button
                                className={styles.buyNowBtn}
                                onClick={handleBuyNow}
                                disabled={isAdding || isSoldOut}
                            >
                                <Zap size={13} />
                                Buy Now
                            </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
