'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Clock } from 'lucide-react';
import styles from './AuctionCard.module.css';

export default function AuctionCard({ data }) {
    const router = useRouter();

    const handleCardClick = () => {
        router.push(`/live?id=${data.id}`);
    };

    // data: { image, viewers, timeLeft, seller, isFollowing, title, price, currentBid }
    return (
        <div className={styles.cardLink} onClick={handleCardClick}>
            <div className={styles.card}>
                <div className={styles.imageWrapper}>
                    {/* Placeholder image if not provided */}
                    <img 
                        src={data.image || 'https://placehold.co/280x280'} 
                        alt={data.title} 
                        className={styles.image} 
                    />

                    <div className={`${styles.overlayBadge} ${styles.redBadge}`}>
                        <User size={12} />
                        <span>{data.viewers}</span>
                        <span>|</span>
                        <span>{data.timeLeft}</span>
                    </div>
                </div>

                <div className={styles.footer}>
                    <div className={styles.sellerRow}>
                        <Link 
                            href={`/store/${data.seller_id}`} 
                            className={styles.sellerLink}
                            onClick={(e) => e.stopPropagation()}
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
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            {data.isFollowing ? 'Following' : '+ Follow'}
                        </button>
                    </div>

                    <div className={styles.itemInfo}>
                        <div className={styles.titleRow}>
                            <span>{data.title}</span>
                            <span>₱ {data.price}</span>
                        </div>
                        <div className={styles.bidRow}>
                            <span>Current Bid</span>
                            <span>₱ {data.currentBid}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
