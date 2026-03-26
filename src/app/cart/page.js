'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Trash2, Plus, Minus, ShoppingBag, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import styles from './page.module.css';

export default function CartPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { cartItems, loading, removeItem, refreshCart } = useCart();
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [subtotal, setSubtotal] = useState(0);
    const shipping = 150;

    useEffect(() => {
        const total = cartItems.reduce((acc, item) => acc + (item.price), 0);
        setSubtotal(total);
    }, [cartItems]);

    const handleCheckout = async () => {
        if (!user || cartItems.length === 0) return;
        
        setIsCheckingOut(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            
            // 1. Create Order
            const orderRes = await fetch(`${apiUrl}/api/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyer_id: user.user_id,
                    address_id: null, // Would normally come from an address selector
                    total_amount: subtotal + shipping,
                    items: cartItems.map(item => ({
                        products_id: item.id,
                        quantity: 1,
                        price: item.price
                    }))
                })
            });

            if (!orderRes.ok) throw new Error('Failed to place order');

            // 2. Clear Cart
            await fetch(`${apiUrl}/api/cart/user/${user.user_id}`, {
                method: 'DELETE'
            });

            await refreshCart();
            alert('Order placed successfully!');
            router.push('/orders');
        } catch (err) {
            console.error(err);
            alert('Checkout failed. Please try again.');
        } finally {
            setIsCheckingOut(false);
        }
    };

    if (loading) return (
        <div className={styles.loadingContainer}>
            <Loader2 className={styles.spinner} size={40} />
            <p>Loading your cart...</p>
        </div>
    );

    if (!user) return (
        <div className={styles.cartContainer}>
            <div className={styles.emptyCart}>
                <h2>Please sign in</h2>
                <p>You need to be logged in to view your cart.</p>
                <Link href="/" className={styles.exploreBtn}>Go to Login</Link>
            </div>
        </div>
    );

    return (
        <div className={styles.cartContainer}>
            <div className={styles.cartContent}>
                <header className={styles.cartHeader}>
                    <button className={styles.backBtn} onClick={() => router.push('/')}>
                        <ChevronLeft size={20} />
                        <span>Continue Shopping</span>
                    </button>
                    <h1>Your Shopping Cart</h1>
                    <div className={styles.itemCount}>
                        {cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'}
                    </div>
                </header>

                {cartItems.length > 0 ? (
                    <div className={styles.cartMain}>
                        <div className={styles.itemsList}>
                            {cartItems.map(item => (
                                <div key={item.cart_id} className={styles.cartItem}>
                                    <div className={styles.itemImageWrapper}>
                                        <img src={item.image || 'https://placehold.co/200x200?text=No+Image'} alt={item.name} />
                                    </div>
                                    <div className={styles.itemDetails}>
                                        <div className={styles.itemMainInfo}>
                                            <h3>{item.name}</h3>
                                            <p className={styles.sellerName}>Sold by: {item.seller}</p>
                                            <span className={styles.itemCondition}>{item.condition}</span>
                                        </div>
                                        <div className={styles.itemActions}>
                                            <div className={styles.priceInfo}>
                                                <span className={styles.itemPrice}>₱ {item.price.toLocaleString()}</span>
                                                <button className={styles.removeBtn} onClick={() => removeItem(item.cart_id)}>
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <aside className={styles.orderSummary}>
                            <div className={styles.summaryCard}>
                                <h2>Order Summary</h2>
                                <div className={styles.summaryRow}>
                                    <span>Subtotal</span>
                                    <span>₱ {subtotal.toLocaleString()}</span>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span>Estimated Shipping</span>
                                    <span>₱ {shipping.toLocaleString()}</span>
                                </div>
                                <div className={styles.summaryDivider}></div>
                                <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                                    <span>Total</span>
                                    <span>₱ {(subtotal + shipping).toLocaleString()}</span>
                                </div>
                                <button 
                                    className={styles.checkoutBtn} 
                                    onClick={handleCheckout}
                                    disabled={isCheckingOut}
                                >
                                    {isCheckingOut ? (
                                        <>
                                            <Loader2 className={styles.spin} size={20} />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Proceed to Checkout</span>
                                            <ArrowRight size={20} />
                                        </>
                                    )}
                                </button>
                                <p className={styles.securePrompt}>
                                    Secure checkout with BIDPal Payment Protection
                                </p>
                            </div>
                        </aside>
                    </div>
                ) : (
                    <div className={styles.emptyCart}>
                        <ShoppingBag size={64} color="#ddd" strokeWidth={1} />
                        <h2>Your cart is empty</h2>
                        <p>Looks like you haven't added anything to your cart yet.</p>
                        <Link href="/" className={styles.exploreBtn}>
                            Start Browsing
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
