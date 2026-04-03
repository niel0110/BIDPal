'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './AuctionCard.module.css';

export default function AuctionCard({ data }) {
    const { user } = useAuth();
    const router = useRouter();
    const [isLiked, setIsLiked] = useState(data.is_liked || false);
    const [isLiking, setIsLiking] = useState(false);

    // All images — deduplicate and filter nulls
    const allImages = data.images?.length
        ? [...new Set(data.images)]
        : (data.image ? [data.image] : []);

    const [activeImg, setActiveImg] = useState(allImages[0] || null);

    useEffect(() => {
        setIsLiked(data.is_liked || false);
    }, [data.is_liked]);

    useEffect(() => {
        const imgs = data.images?.length
            ? [...new Set(data.images)]
            : (data.image ? [data.image] : []);
        setActiveImg(imgs[0] || null);
    }, [data.image, data.images]);

    const handleCardClick = () => {
        router.push(`/live?id=${data.id}`);
    };

    const handleToggleLike = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) { router.push('/signin'); return; }
        if (isLiking) return;
        try {
            setIsLiking(true);
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/dashboard/auction/${data.id}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.user_id })
            });
            const result = await res.json();
            if (res.ok && result.success) setIsLiked(result.liked);
        } catch (err) {
            console.error('Error toggling like:', err);
        } finally {
            setIsLiking(false);
        }
    };

    return (
        <div className={styles.cardLink} onClick={handleCardClick}>
            <div className={styles.card}>

                {/* Main image */}
                <div className={styles.imageWrapper}>
                    <img
                        src={activeImg || 'https://placehold.co/280x280?text=No+Image'}
                        alt={data.title}
                        className={styles.image}
                    />

                    {data.status === 'active' && (
                        <div className={styles.liveBadge}>🔴 LIVE</div>
                    )}
                    {data.status === 'scheduled' && (
                        <div className={styles.scheduledBadge}>Starts Soon</div>
                    )}

                    <button
                        className={`${styles.heartBtn} ${isLiked ? styles.activeHeart : ''}`}
                        onClick={handleToggleLike}
                        disabled={isLiking}
                        title={isLiked ? 'Remove from wishlist' : 'Add to wishlist'}
                    >
                        <Heart size={18} fill={isLiked ? '#D32F2F' : 'none'} color={isLiked ? '#D32F2F' : 'white'} />
                    </button>

                    <div className={`${styles.overlayBadge} ${styles.redBadge}`}>
                        <User size={12} />
                        <span>{data.viewers}</span>
                        <span>|</span>
                        <span>{data.timeLeft}</span>
                    </div>
                </div>

                {/* Thumbnail strip — only when multiple images */}
                {allImages.length > 1 && (
                    <div className={styles.thumbStrip} onClick={e => e.stopPropagation()}>
                        {allImages.map((img, i) => (
                            <button
                                key={i}
                                className={`${styles.thumb} ${activeImg === img ? styles.thumbActive : ''}`}
                                onClick={e => { e.stopPropagation(); setActiveImg(img); }}
                            >
                                <img src={img} alt={`${data.title} ${i + 1}`} />
                            </button>
                        ))}
                    </div>
                )}

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
                                    backgroundImage: data.seller_avatar ? `url(${data.seller_avatar})` : 'none',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center'
                                }} />
                                <span className={styles.sellerName}>{data.seller}</span>
                            </div>
                        </Link>
                        <button
                            className={styles.followBtn}
                            onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            {data.isFollowing ? 'Following' : '+ Follow'}
                        </button>
                    </div>

                    <div className={styles.itemInfo}>
                        <div className={styles.titleRow}>
                            <span className={styles.titleText}>{data.title}</span>
                            <span className={styles.priceText}>₱{Number(data.price || 0).toLocaleString('en-PH')}</span>
                        </div>
                        <div className={styles.bidRow}>
                            <span>Current Bid ({data.bids_count ?? 0} bids)</span>
                            <span className={styles.bidValue}>₱{Number(data.currentBid || 0).toLocaleString('en-PH')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
