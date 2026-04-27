'use client';

import { useState } from 'react';
import { Heart, ShoppingCart, Package } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import styles from './ProductCard.module.css';

function formatCondition(raw) {
    if (!raw) return null;
    return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function ProductCard({ data }) {
    const { user } = useAuth();
    const { addToCart, isInCart } = useCart();
    const [isAdding, setIsAdding] = useState(false);
    const [liked, setLiked] = useState(false);

    const isAlreadyInCart = isInCart(data.products_id);
    const isSoldOut = data.isSoldOut || data.availability === 0 || data.status === 'sold';

    const handleAddToCart = async (e) => {
        e.stopPropagation();
        if (!user) {
            alert('Please sign in to add items to cart');
            return;
        }
        if (isAlreadyInCart || isSoldOut) return;
        setIsAdding(true);
        const result = await addToCart(data.products_id);
        setIsAdding(false);
        if (!result.success) {
            alert(result.error || 'Failed to add to cart');
        }
    };

    const conditionLabel = formatCondition(data.condition);
    const displayPrice = data.price ?? data.starting_price;
    const lowStock = data.availability > 0 && data.availability <= 5;

    return (
        <div className={styles.card}>
            <div className={styles.imageWrapper}>
                <img
                    src={(data.image && data.image !== 'noposter') ? data.image : 'https://placehold.co/400x400?text=No+Image'}
                    alt={data.title}
                    className={styles.image}
                />

                {isSoldOut && (
                    <div className={styles.soldOutOverlay}>Sold Out</div>
                )}

                <button
                    className={`${styles.heartBtn} ${liked ? styles.heartActive : ''}`}
                    onClick={e => { e.stopPropagation(); setLiked(l => !l); }}
                    aria-label="Save to wishlist"
                >
                    <Heart size={15} fill={liked ? '#cc2b41' : 'none'} stroke={liked ? '#cc2b41' : '#555'} />
                </button>

                {conditionLabel && !isSoldOut && (
                    <div className={styles.conditionBadge}>{conditionLabel}</div>
                )}
            </div>

            <div className={styles.content}>
                <h3 className={styles.title}>{data.title}</h3>

                <div className={styles.priceRow}>
                    <span className={styles.price}>
                        {displayPrice != null
                            ? `₱${Number(displayPrice).toLocaleString()}`
                            : <span className={styles.noPrice}>Price not set</span>
                        }
                    </span>
                    {lowStock && (
                        <span className={styles.stockWarn}>
                            <Package size={11} /> {data.availability} left
                        </span>
                    )}
                </div>

                <button
                    className={`${styles.cartBtn} ${isAlreadyInCart ? styles.cartBtnAdded : ''}`}
                    onClick={handleAddToCart}
                    disabled={isAdding || isAlreadyInCart || isSoldOut}
                >
                    <ShoppingCart size={15} />
                    {isAdding ? 'Adding…' : isAlreadyInCart ? 'Added ✓' : isSoldOut ? 'Sold Out' : 'Add to Cart'}
                </button>
            </div>
        </div>
    );
}
