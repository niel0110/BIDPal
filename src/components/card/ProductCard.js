import { useState } from 'react';
import { Heart, Zap, Truck, Tag, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import styles from './ProductCard.module.css';

export default function ProductCard({ data }) {
    const { user } = useAuth();
    const { addToCart, isInCart } = useCart();
    const [isAdding, setIsAdding] = useState(false);

    const isAlreadyInCart = isInCart(data.products_id);

    const handleAddToCart = async (e) => {
        e.stopPropagation();
        if (!user) {
            alert('Please sign in to add items to cart');
            return;
        }

        if (isAlreadyInCart) return;

        setIsAdding(true);
        const result = await addToCart(data.products_id);
        setIsAdding(false);

        if (!result.success) {
            alert(result.error || 'Failed to add to cart');
        }
    };

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
                    <div className={styles.price}>₱{data.price?.toLocaleString()}</div>
                    <div className={styles.wishlistInfo}>
                        <span className={styles.separator}>|</span>
                        <span>{data.wishlistCount} users added</span>
                    </div>
                </div>

                <div className={styles.tags}>
                    <div className={`${styles.tag} ${styles.purpleTag}`}>
                        <Truck size={12} /> Free Shipping
                    </div>
                </div>

                <div className={styles.actions}>
                    <button 
                        className={styles.cartBtn} 
                        onClick={handleAddToCart}
                        disabled={isAdding || isAlreadyInCart || data.isSoldOut}
                    >
                        <ShoppingCart size={16} />
                        {isAdding ? 'Adding...' : isAlreadyInCart ? 'Added to Cart ✓' : 'Add to Cart'}
                    </button>
                    
                    <button className={styles.flashBtn} disabled={data.isSoldOut}>
                        <Zap size={16} fill="white" />
                        {data.flashDate ? `Flash Bid on ${data.flashDate}` : 'Join Flash Bid'}
                    </button>
                </div>
            </div>
        </div>
    );
}
