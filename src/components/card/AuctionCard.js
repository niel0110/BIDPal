'use client';

import Link from 'next/link';
import { User, Clock } from 'lucide-react';
import styles from './AuctionCard.module.css';

export default function AuctionCard({ data }) {
    // data: { image, viewers, timeLeft, seller, isFollowing, title, price, currentBid }
    return (
        <Link href="/live" className={styles.cardLink}>
            <div className={styles.card}>
                <div className={styles.imageWrapper}>
                    {/* Placeholder image if not provided */}
                    <div className={styles.image} style={{
                        background: `url(${data.image || 'https://placehold.co/280x280'}) center/cover`
                    }} />

                    <div className={`${styles.overlayBadge} ${styles.redBadge}`}>
                        <User size={12} />
                        <span>{data.viewers}</span>
                        <span>|</span>
                        <span>{data.timeLeft}</span>
                    </div>
                </div>

                <div className={styles.footer}>
                    <div className={styles.sellerRow}>
                        <div className={styles.sellerInfo}>
                            <div className={styles.avatar} /> {/* Placeholder avatar */}
                            <span className={styles.sellerName}>{data.seller}</span>
                        </div>
                        <button className={styles.followBtn} onClick={(e) => e.preventDefault()}>
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
        </Link>
    );
}
