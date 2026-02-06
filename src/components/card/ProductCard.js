import { Heart, Zap, Truck, Tag } from 'lucide-react';
import styles from './ProductCard.module.css';

export default function ProductCard({ data }) {
    // data: { image, badges: [], title, price, wishlistCount, isSoldOut, flashDate }
    return (
        <div className={styles.card}>
            <div className={styles.imageWrapper}>
                <img src={data.image || 'https://placehold.co/200x200'} alt={data.title} className={styles.image} />

                <div className={styles.badges}>
                    {data.isSoldOut ? (
                        <div className={`${styles.badge} ${styles.gray}`}>SOLD OUT</div>
                    ) : (
                        data.badges?.map((badge, idx) => (
                            <div key={idx} className={`${styles.badge} ${styles[badge.color]}`}>
                                {badge.text}
                            </div>
                        ))
                    )}
                </div>

                <button className={styles.heartBtn}>
                    <Heart size={16} />
                </button>
            </div>

            <div className={styles.content}>
                <h3 className={styles.title}>{data.title}</h3>
                <div className={styles.priceRow}>
                    <span className={styles.price}>₱ {data.price}</span>
                    <span>| {data.wishlistCount} users added this to wishlist</span>
                </div>

                <div className={styles.tags}>
                    <div className={`${styles.tag} ${styles.purpleTag}`}>
                        <Truck size={12} /> Free Shipping
                    </div>
                    <div className={`${styles.tag} ${styles.orangeTag}`}>
                        <Tag size={12} /> ₱20 off
                    </div>
                </div>

                <button className={styles.flashBtn}>
                    <Zap size={16} fill="white" />
                    {data.flashDate ? `Flash Bid on ${data.flashDate}` : 'Join Flash Bid'}
                </button>
            </div>
        </div>
    );
}
