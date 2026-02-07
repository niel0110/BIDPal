'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import styles from './page.module.css';

export default function CartPage() {
    const router = useRouter();
    const [cartItems, setCartItems] = useState([
        {
            id: 1,
            name: 'PixelPast Analog Camera',
            price: 2500,
            quantity: 1,
            image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=200',
            seller: 'RetroVault'
        },
        {
            id: 2,
            name: 'Golden Horizon Set',
            price: 1500,
            quantity: 2,
            image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=200',
            seller: 'EleganceCo'
        }
    ]);

    const [subtotal, setSubtotal] = useState(0);
    const shipping = 150;

    useEffect(() => {
        const total = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        setSubtotal(total);
    }, [cartItems]);

    const updateQuantity = (id, delta) => {
        setCartItems(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const removeItem = (id) => {
        setCartItems(prev => prev.filter(item => item.id !== id));
    };

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
                                <div key={item.id} className={styles.cartItem}>
                                    <div className={styles.itemImageWrapper}>
                                        <img src={item.image} alt={item.name} />
                                    </div>
                                    <div className={styles.itemDetails}>
                                        <div className={styles.itemMainInfo}>
                                            <h3>{item.name}</h3>
                                            <p className={styles.sellerName}>Sold by: {item.seller}</p>
                                        </div>
                                        <div className={styles.itemActions}>
                                            <div className={styles.quantityControl}>
                                                <button onClick={() => updateQuantity(item.id, -1)} disabled={item.quantity <= 1}>
                                                    <Minus size={16} />
                                                </button>
                                                <span>{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)}>
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                            <div className={styles.priceInfo}>
                                                <span className={styles.itemPrice}>₱ {(item.price * item.quantity).toLocaleString()}</span>
                                                <button className={styles.removeBtn} onClick={() => removeItem(item.id)}>
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
                                <button className={styles.checkoutBtn}>
                                    <span>Proceed to Checkout</span>
                                    <ArrowRight size={20} />
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
