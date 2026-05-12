'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
    Trash2, ShoppingBag, ArrowRight, Loader2, ChevronLeft, Shield, Tag, 
    MapPin, Plus, CreditCard, Truck, CheckCircle2, AlertCircle, X, Smartphone, Copy,
    Archive, Clock, Info
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import RouteGuard from '@/components/auth/RouteGuard';
import styles from './page.module.css';

export default function CartPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { 
        cartItems, 
        stashedItems, 
        cartLimit, 
        loading, 
        removeItem, 
        stashItem, 
        unstashItem, 
        refreshCart 
    } = useCart();

    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [checkoutError, setCheckoutError] = useState('');
    const shipping = 150;

    // Checkout states
    const [addresses, setAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery');
    
    // Modal states
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showGcashModal, setShowGcashModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [modalError, setModalError] = useState('');
    const [gcashCopied, setGcashCopied] = useState(false);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    // Sync selection when items load
    useEffect(() => {
        if (cartItems.length > 0) {
            setSelectedIds(new Set(cartItems.map(i => i.cart_id)));
        }
    }, [cartItems.length]);

    // Fetch user addresses
    const fetchAddresses = useCallback(async () => {
        if (!user) return;

        try {
            const res = await fetch(`${API_URL}/api/addresses/user/${user.user_id}`);
            if (!res.ok) throw new Error('Failed to fetch addresses');

            const data = await res.json();
            setAddresses(data);

            // Auto-select default address
            const defaultAddress = data.find(addr => addr.is_default);
            if (defaultAddress) {
                setSelectedAddressId(defaultAddress.address_id);
            }
        } catch (err) {
            console.error('Error fetching addresses:', err);
        }
    }, [user, API_URL]);

    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    const toggleItem = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const availableItems = cartItems.filter(i => i.status !== 'sold' && (i.availability === undefined || i.availability > 0));
    const allSelected = availableItems.length > 0 && selectedIds.size === availableItems.length;
    const toggleAll = () => {
        setSelectedIds(allSelected ? new Set() : new Set(availableItems.map(i => i.cart_id)));
    };

    const selectedItems = cartItems.filter(i => selectedIds.has(i.cart_id));
    const subtotal = selectedItems.reduce((acc, i) => acc + (i.price * (i.quantity || 1)), 0);
    
    // Calculate total shipping (150 per unique seller)
    const uniqueSellers = new Set(selectedItems.map(i => i.seller_id || 'unknown')).size;
    const totalShipping = selectedItems.length > 0 ? uniqueSellers * shipping : 0;
    const total = subtotal + totalShipping;

    const handleCheckout = () => {
        if (!user || selectedItems.length === 0) return;

        if (user?.accountStatus?.status === 'suspended' || user?.accountStatus?.status === 'banned') {
            setModalError('Your account is currently restricted. Checkout and payment are disabled until your account is reactivated.');
            setShowErrorModal(true);
            return;
        }
        
        if (!selectedAddressId) {
            setModalError('Please select a shipping address before checking out.');
            setShowErrorModal(true);
            return;
        }

        setShowConfirmModal(true);
    };

    const handleConfirmOrder = () => {
        setShowConfirmModal(false);
        if (paymentMethod === 'gcash') {
            setShowGcashModal(true);
        } else {
            submitPayment();
        }
    };

    const submitPayment = async () => {
        setShowGcashModal(false);
        setIsCheckingOut(true);
        setCheckoutError('');

        try {
            // Group selected items by seller so we create one order per seller
            const bySeller = selectedItems.reduce((groups, item) => {
                const sid = item.seller_id || 'unknown';
                if (!groups[sid]) groups[sid] = [];
                groups[sid].push(item);
                return groups;
            }, {});

            const payment_reference = paymentMethod === 'gcash' 
                ? `BDP-CART-${Date.now().toString(36).toUpperCase()}` 
                : null;
            const paid_at = paymentMethod === 'gcash' ? new Date().toISOString() : null;
            const status = 'processing';

            for (const [sellerId, items] of Object.entries(bySeller)) {
                const groupSubtotal = items.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0);
                const groupTotal = groupSubtotal + (shipping);
                
                const orderRes = await fetch(`${API_URL}/api/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        buyer_id: user.user_id,
                        seller_id: sellerId !== 'unknown' ? sellerId : undefined,
                        address_id: selectedAddressId,
                        total_amount: groupTotal,
                        shipping_fee: shipping,
                        payment_method: paymentMethod,
                        payment_reference,
                        paid_at,
                        status,
                        payment_confirmed: paymentMethod === 'cash_on_delivery',
                        items: items.map(item => ({
                            products_id: item.id,
                            quantity: item.quantity || 1,
                            price: item.price
                        }))
                    })
                });

                const orderData = await orderRes.json();
                if (!orderRes.ok) throw new Error(orderData.error || 'Failed to place order');
            }

            // Remove only the checked-out items from cart
            for (const item of selectedItems) {
                await removeItem(item.cart_id);
            }
            await refreshCart();
            
            // Redirect to orders
            router.push('/orders');
        } catch (err) {
            console.error(err);
            setModalError(err.message);
            setShowErrorModal(true);
        } finally {
            setIsCheckingOut(false);
        }
    };

    const copyGcashNumber = () => {
        navigator.clipboard.writeText('09171234567').catch(() => {});
        setGcashCopied(true);
        setTimeout(() => setGcashCopied(false), 2000);
    };

    const formatAddress = (address) => {
        const parts = [
            address.Line1,
            address.Line2,
            address['Household/blk st.'],
            address.Barangay,
            address['Municipality/City'],
            address.province,
            address['zip code']
        ].filter(Boolean);
        return parts.join(', ');
    };

    if (loading) return <BIDPalLoader />;

    return (
        <RouteGuard>
            <div className={styles.cartContainer}>
                <div className={styles.cartContent}>

                    {/* Header */}
                    <header className={styles.cartHeader}>
                        <button className={styles.backBtn} onClick={() => router.back()}>
                            <ChevronLeft size={18} />
                            Continue Shopping
                        </button>
                        <div className={styles.headerRow}>
                            <h1 className={styles.cartTitle}>Shopping Cart</h1>
                            <div className={styles.cartStats}>
                                <span className={styles.itemCount}>
                                    {cartItems.length} / {cartLimit} Active
                                </span>
                                {stashedItems.length > 0 && (
                                    <span className={styles.stashedCount}>
                                        {stashedItems.length} Stashed
                                    </span>
                                )}
                            </div>
                        </div>
                    </header>

                    {cartItems.length >= cartLimit && (
                        <div className={styles.limitAlert}>
                            <Info size={16} />
                            <span>Your active cart is full. New items will automatically move older ones to &quot;Saved for Later&quot;.</span>
                        </div>
                    )}

                    {cartItems.length > 0 ? (
                        <div className={styles.cartMain}>
                            {/* Items panel */}
                            <div className={styles.itemsPanel}>

                                {/* Select all row */}
                                <div className={styles.selectAllRow}>
                                    <label className={styles.selectAllLabel}>
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleAll}
                                            className={styles.checkbox}
                                        />
                                        <span>Select all</span>
                                    </label>
                                    {selectedIds.size > 0 && (
                                        <span className={styles.selectedCount}>{selectedIds.size} selected</span>
                                    )}
                                </div>

                                {/* Items list */}
                                <div className={styles.itemsList}>
                                    {cartItems.map(item => {
                                        const isSelected = selectedIds.has(item.cart_id);
                                        const isSold = item.status === 'sold';
                                        
                                        return (
                                            <div
                                                key={item.cart_id}
                                                className={`${styles.cartItem} ${isSelected ? styles.cartItemSelected : ''} ${isSold ? styles.cartItemSold : ''}`}
                                                onClick={() => !isSold && toggleItem(item.cart_id)}
                                                style={isSold ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
                                            >
                                                {/* Checkbox */}
                                                <div className={styles.itemCheckbox} onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => !isSold && toggleItem(item.cart_id)}
                                                        disabled={isSold}
                                                        className={styles.checkbox}
                                                    />
                                                </div>

                                                {/* Image */}
                                                <Link href={`/product/${item.id}`} onClick={e => e.stopPropagation()} className={styles.itemImage}>
                                                    <img
                                                        src={item.image || 'https://placehold.co/100x100?text=No+Image'}
                                                        alt={item.name}
                                                    />
                                                </Link>

                                                {/* Info */}
                                                <div className={styles.itemInfo}>
                                                    <Link href={`/product/${item.id}`} onClick={e => e.stopPropagation()} className={styles.itemName} style={{ textDecoration: 'none', color: 'inherit' }}>{item.name}</Link>
                                                    <div className={styles.itemSeller}>Sold by: {item.seller}</div>
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                                        {item.condition && (
                                                            <span className={styles.conditionBadge}>{item.condition}</span>
                                                        )}
                                                        {isSold && (
                                                            <span className={styles.soldBadge}>Sold Out</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Price & actions */}
                                                <div className={styles.itemRight}>
                                                    <div className={styles.itemPrice}>
                                                        ₱{item.price.toLocaleString('en-PH')}
                                                    </div>
                                                    <div className={styles.itemActions}>
                                                        <button
                                                            className={styles.stashBtn}
                                                            onClick={e => { e.stopPropagation(); stashItem(item.cart_id); }}
                                                            title="Save for Later"
                                                        >
                                                            <Archive size={16} />
                                                            <span>Save for Later</span>
                                                        </button>
                                                        <button
                                                            className={styles.removeBtn}
                                                            onClick={e => { e.stopPropagation(); removeItem(item.cart_id); }}
                                                            title="Remove"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Order summary */}
                            <aside className={styles.summaryPanel}>
                                <div className={styles.summaryCard}>
                                    <h2 className={styles.summaryTitle}>Order Summary</h2>

                                    <div className={styles.summaryLines}>
                                        <div className={styles.summaryRow}>
                                            <span>Subtotal ({selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''})</span>
                                            <span>₱{subtotal.toLocaleString('en-PH')}</span>
                                        </div>
                                        <div className={styles.summaryRow}>
                                            <span>Shipping</span>
                                            <span>{selectedItems.length > 0 ? `₱${totalShipping.toLocaleString('en-PH')}` : '—'}</span>
                                        </div>
                                    </div>

                                    <div className={styles.summaryDivider} />

                                    <div className={styles.totalRow}>
                                        <span>Total</span>
                                        <span className={styles.totalAmount}>₱{total.toLocaleString('en-PH')}</span>
                                    </div>

                                    {/* Checkout Steps (Address & Payment) */}
                                    <div className={styles.checkoutSteps}>
                                        {/* Shipping Address Section */}
                                        <section className={styles.section} style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid #eee' }}>
                                            <div className={styles.sectionHeader}>
                                                <div className={styles.sectionTitle}>
                                                    <MapPin size={16} />
                                                    <h2 style={{ fontSize: '0.85rem', textTransform: 'none', color: '#111', letterSpacing: 'normal' }}>Shipping Address</h2>
                                                </div>
                                                {addresses.length > 0 && (
                                                    <button
                                                        className={styles.changeBtn}
                                                        onClick={() => router.push(`/profile?tab=address&returnTo=/cart`)}
                                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                                    >
                                                        Change
                                                    </button>
                                                )}
                                            </div>

                                            {addresses.length === 0 ? (
                                                <div className={styles.emptyState} style={{ padding: '1rem 0' }}>
                                                    <button
                                                        className={styles.addAddressBtn}
                                                        onClick={() => router.push(`/profile?tab=address&returnTo=/cart`)}
                                                        style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}
                                                    >
                                                        <Plus size={14} /> Add Address
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className={styles.addressList}>
                                                    {addresses.map(address => (
                                                        <div
                                                            key={address.address_id}
                                                            className={`${styles.addressCard} ${selectedAddressId === address.address_id ? styles.selected : ''}`}
                                                            onClick={() => setSelectedAddressId(address.address_id)}
                                                            style={{ padding: '0.75rem' }}
                                                        >
                                                            <input
                                                                type="radio"
                                                                checked={selectedAddressId === address.address_id}
                                                                onChange={() => setSelectedAddressId(address.address_id)}
                                                                className={styles.radio}
                                                                style={{ width: '14px', height: '14px' }}
                                                            />
                                                            <div className={styles.addressInfo}>
                                                                <div className={styles.addressHeader}>
                                                                    <span className={styles.addressName} style={{ fontSize: '0.8rem' }}>
                                                                        {user?.Fname} {user?.Lname}
                                                                    </span>
                                                                    {address.is_default && <span className={styles.defaultBadge} style={{ fontSize: '0.6rem' }}>Default</span>}
                                                                </div>
                                                                <p className={styles.addressText} style={{ fontSize: '0.75rem' }}>{formatAddress(address)}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </section>

                                        {/* Payment Method Section */}
                                        <section className={styles.section} style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #eee' }}>
                                            <div className={styles.sectionHeader}>
                                                <div className={styles.sectionTitle}>
                                                    <CreditCard size={16} />
                                                    <h2 style={{ fontSize: '0.85rem', textTransform: 'none', color: '#111', letterSpacing: 'normal' }}>Payment Method</h2>
                                                </div>
                                            </div>

                                            <div className={styles.paymentMethods} style={{ gap: '0.5rem' }}>
                                                <div
                                                    className={`${styles.paymentCard} ${paymentMethod === 'cash_on_delivery' ? styles.selected : ''}`}
                                                    onClick={() => setPaymentMethod('cash_on_delivery')}
                                                    style={{ padding: '0.75rem' }}
                                                >
                                                    <input
                                                        type="radio"
                                                        checked={paymentMethod === 'cash_on_delivery'}
                                                        onChange={() => setPaymentMethod('cash_on_delivery')}
                                                        className={styles.radio}
                                                        style={{ width: '14px', height: '14px' }}
                                                    />
                                                    <div className={styles.paymentInfo}>
                                                        <Truck size={16} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Cash on Delivery</span>
                                                    </div>
                                                </div>

                                                <div
                                                    className={`${styles.paymentCard} ${paymentMethod === 'gcash' ? styles.selected : ''}`}
                                                    onClick={() => setPaymentMethod('gcash')}
                                                    style={{ padding: '0.75rem' }}
                                                >
                                                    <input
                                                        type="radio"
                                                        checked={paymentMethod === 'gcash'}
                                                        onChange={() => setPaymentMethod('gcash')}
                                                        className={styles.radio}
                                                        style={{ width: '14px', height: '14px' }}
                                                    />
                                                    <div className={styles.paymentInfo}>
                                                        <CreditCard size={16} />
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>GCash Simulation</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </section>
                                    </div>

                                    {checkoutError && (
                                        <div className={styles.errorBox}>
                                            {checkoutError}
                                        </div>
                                    )}

                                    <button
                                        className={styles.checkoutBtn}
                                        onClick={handleCheckout}
                                        disabled={isCheckingOut || selectedItems.length === 0}
                                    >
                                        {isCheckingOut ? (
                                            <>
                                                <Loader2 size={18} className={styles.spin} />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                Checkout ({selectedItems.length})
                                                <ArrowRight size={18} />
                                            </>
                                        )}
                                    </button>

                                    <div className={styles.secureNote}>
                                        <Shield size={13} />
                                        Secure checkout with BIDPal Payment Protection
                                    </div>

                                    {/* Promo / info strip */}
                                    <div className={styles.promoStrip}>
                                        <Tag size={13} />
                                        <span>Free shipping on orders over ₱5,000</span>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    ) : (
                        <div className={styles.emptyCart}>
                            <ShoppingBag size={64} color="#ddd" strokeWidth={1} />
                            <h2>Your cart is empty</h2>
                            <p>Looks like you haven&apos;t added anything yet.</p>
                            <Link href="/" className={styles.exploreBtn}>Start Browsing</Link>
                            
                            {stashedItems.length > 0 && (
                                <div className={styles.stashedOnlyBox}>
                                    <p>You have <strong>{stashedItems.length}</strong> items saved for later.</p>
                                    <button onClick={() => document.getElementById('stashed-section')?.scrollIntoView({ behavior: 'smooth' })} className={styles.viewStashedBtn}>View Stashed Items</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Stashed items section - ALWAYS visible if there are stashed items */}
                    {stashedItems.length > 0 && (
                        <div id="stashed-section" className={styles.stashedSection} style={{ marginTop: '2rem' }}>
                            <div className={styles.stashedHeader}>
                                <div className={styles.stashedTitle}>
                                    <Clock size={18} />
                                    <h2>Saved for Later</h2>
                                    <span className={styles.stashedBadge}>{stashedItems.length}</span>
                                </div>
                                <p className={styles.stashedSub}>Items here don&apos;t count toward your cart limit and aren&apos;t included in checkout.</p>
                            </div>
                            
                            <div className={styles.stashedList}>
                                {stashedItems.map(item => {
                                    const isUnavailable = item.status === 'sold' || item.availability <= 0;
                                    return (
                                        <div key={item.cart_id} className={`${styles.stashedItem} ${isUnavailable ? styles.stashedItemUnavailable : ''}`}>
                                            <Link href={`/product/${item.id}`} className={styles.stashedImg} style={{ textDecoration: 'none', opacity: isUnavailable ? 0.6 : 1 }}>
                                                <img src={item.image || 'https://placehold.co/100x100?text=No+Image'} alt={item.name} />
                                            </Link>
                                            <div className={styles.stashedInfo}>
                                                <Link href={`/product/${item.id}`} className={styles.stashedName} style={{ textDecoration: 'none', color: 'inherit' }}>{item.name}</Link>
                                                <p className={styles.stashedSeller}>Sold by: {item.seller}</p>
                                                <div className={styles.stashedMeta}>
                                                    <div className={styles.stashedPrice}>₱{item.price.toLocaleString('en-PH')}</div>
                                                    {isUnavailable && (
                                                        <span className={styles.soldBadgeSmall}>Sold Out</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={styles.stashedActions}>
                                                <button
                                                    className={styles.unstashBtn}
                                                    onClick={() => !isUnavailable && unstashItem(item.cart_id)}
                                                    disabled={isUnavailable}
                                                    style={isUnavailable ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                                >
                                                    {isUnavailable ? 'Unavailable' : 'Move to Cart'}
                                                </button>
                                                <button
                                                    className={styles.stashedRemove}
                                                    onClick={() => removeItem(item.cart_id)}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Confirm Checkout Modal ── */}
                {showConfirmModal && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <div className={styles.modalHeader}>
                                <ShoppingBag size={22} className={styles.modalIcon} />
                                <h3>Confirm Checkout</h3>
                                <button className={styles.modalClose} onClick={() => setShowConfirmModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.modalBody}>
                                <div className={styles.confirmBreakdown}>
                                    <div className={styles.confirmRow}>
                                        <span>Items Selected</span>
                                        <span>{selectedItems.length}</span>
                                    </div>
                                    <div className={styles.confirmRow}>
                                        <span>Subtotal</span>
                                        <span>₱{subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className={styles.confirmRow}>
                                        <span>Shipping Total</span>
                                        <span>₱{(shipping * Object.keys(selectedItems.reduce((acc, i) => ({...acc, [i.seller_id]:1}), {})).length).toLocaleString()}</span>
                                    </div>
                                    <div className={styles.confirmRow}>
                                        <span>Payment Method</span>
                                        <span>{paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : 'GCash Simulation'}</span>
                                    </div>
                                    <div className={styles.confirmDivider} />
                                    <div className={`${styles.confirmRow} ${styles.confirmTotal}`}>
                                        <span>Total</span>
                                        <span>₱{total.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.modalFooter}>
                                <button className={styles.modalCancelBtn} onClick={() => setShowConfirmModal(false)}>
                                    Cancel
                                </button>
                                <button className={styles.modalConfirmBtn} onClick={handleConfirmOrder}>
                                    <CheckCircle2 size={18} />
                                    Confirm Order
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Premium GCash Simulation Modal ── */}
                {showGcashModal && (
                    <div className={styles.modalOverlay}>
                        <div className={`${styles.modal} ${styles.premiumGcashModal}`}>
                            <div className={styles.bottomSheetHandle}></div>
                            <div className={styles.premiumHeader}>
                                <div className={styles.headerBrand}>
                                    <div className={styles.gcashLogo}>G</div>
                                    <div className={styles.headerTitle}>
                                        <h3>GCash Payment</h3>
                                        <p>Transaction Simulation</p>
                                    </div>
                                </div>
                                <button className={styles.modalClose} onClick={() => setShowGcashModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className={styles.premiumBody}>
                                <div className={styles.paymentGuide}>
                                    <span className={styles.guideStep}>Step 1: Send Payment</span>
                                    <p>Send the exact amount to the merchant account below via GCash <strong>Express Send</strong>.</p>
                                </div>

                                <div className={styles.gcashCard}>
                                    <div className={styles.cardHeader}>
                                        <Smartphone size={14} />
                                        <span>Merchant Account</span>
                                    </div>
                                    <div className={styles.cardNumberRow}>
                                        <span className={styles.premiumNumber}>0917 123 4567</span>
                                        <button className={styles.premiumCopyBtn} onClick={copyGcashNumber}>
                                            {gcashCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                            <span>{gcashCopied ? 'Copied' : 'Copy'}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.amountCard}>
                                    <span className={styles.amountLabel}>Amount to Pay</span>
                                    <div className={styles.premiumAmount}>
                                        <span className={styles.currency}>₱</span>
                                        {total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>

                                <div className={styles.premiumAlerts}>
                                    <div className={styles.alertLine}>
                                        <Shield size={16} />
                                        <span>This is a <strong>secure simulation</strong>. No real funds will be deducted from your account.</span>
                                    </div>
                                    <div className={styles.alertLine}>
                                        <Info size={16} />
                                        <span>Ensure you copy the exact amount to prevent order processing delays.</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.premiumFooter}>
                                <button 
                                    className={styles.secondaryBtn} 
                                    onClick={() => setShowGcashModal(false)}
                                    disabled={isCheckingOut}
                                >
                                    Cancel
                                </button>
                                <button 
                                    className={styles.primaryBtn} 
                                    onClick={submitPayment}
                                    disabled={isCheckingOut}
                                >
                                    {isCheckingOut ? (
                                        <><Loader2 size={18} className={styles.spin} /> Processing...</>
                                    ) : (
                                        'I have sent the payment'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Error Modal ── */}
                {showErrorModal && (
                    <div className={styles.modalOverlay}>
                        <div className={`${styles.modal} ${styles.modalCenter}`}>
                            <button className={styles.modalClose} onClick={() => setShowErrorModal(false)}>
                                <X size={20} />
                            </button>
                            <div className={styles.errorIcon}>
                                <AlertCircle size={48} />
                            </div>
                            <h3 className={styles.errorTitle}>Something went wrong</h3>
                            <p className={styles.errorMsg}>{modalError}</p>
                            <button className={styles.modalDismissBtn} onClick={() => setShowErrorModal(false)}>
                                OK, Got it
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </RouteGuard>
    );
}
