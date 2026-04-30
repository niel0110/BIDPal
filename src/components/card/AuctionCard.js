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
    const [isFollowing, setIsFollowing] = useState(data.isFollowing || false);
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [interestedCount, setInterestedCount] = useState(
        data.status === 'scheduled' ? (data.reminder_count ?? 0) : (data.bids_count ?? 0)
    );

    // All images — deduplicate and filter nulls/noposter
    const allImages = (data.images?.length
        ? [...new Set(data.images)]
        : (data.image ? [data.image] : [])).filter(img => img && img !== 'noposter');

    const [activeImg, setActiveImg] = useState(allImages[0] || null);

    useEffect(() => {
        setIsLiked(data.is_liked || false);
    }, [data.is_liked]);

    useEffect(() => {
        setInterestedCount(
            data.status === 'scheduled' ? (data.reminder_count ?? 0) : (data.bids_count ?? 0)
        );
    }, [data.reminder_count, data.bids_count, data.status]);

    // Check follow status once user is known
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

    useEffect(() => {
        const imgs = (data.images?.length
            ? [...new Set(data.images)]
            : (data.image ? [data.image] : [])).filter(img => img && img !== 'noposter');
        setActiveImg(imgs[0] || null);
    }, [data.image, data.images]);

    const handleCardClick = () => {
        router.push(`/live?id=${data.id}`);
    };

    const handleToggleFollow = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) { router.push('/signin'); return; }
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
                        <span>{interestedCount}</span>
                        <span>|</span>
                        <span>{data.timeLeft}</span>
                    </div>
                </div>

                {/* Thumbnail strip — always rendered to keep card height uniform */}
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
                            className={`${styles.followBtn} ${isFollowing ? styles.followingBtn : ''}`}
                            onClick={handleToggleFollow}
                            disabled={isFollowLoading}
                        >
                            {isFollowLoading ? '...' : isFollowing ? 'Following' : '+ Follow'}
                        </button>
                    </div>

                    <div className={styles.itemInfo}>
                        <span className={styles.titleText}>{data.title}</span>
                        <div className={styles.bidRow}>
                            <span className={styles.bidLabel}>Starting Bid</span>
                            <span className={styles.bidValue}>₱{Number(data.price || 0).toLocaleString('en-PH')}</span>
                        </div>
                        <div className={styles.bidRow}>
                            <span className={styles.bidLabel}>{data.bids_count ?? 0} bid{(data.bids_count ?? 0) !== 1 ? 's' : ''}</span>
                            <span className={styles.bidValue}>Current ₱{Number(data.currentBid || 0).toLocaleString('en-PH')}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
