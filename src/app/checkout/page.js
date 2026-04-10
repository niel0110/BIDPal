'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import BackButton from '@/components/BackButton';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, MapPin, Plus, CreditCard, Truck, CheckCircle2, Loader2, AlertCircle, X, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function CheckoutPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const auctionId = searchParams.get('auction_id');

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [orderData, setOrderData] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery');
    const [shippingFee, setShippingFee] = useState(150);
    const [error, setError] = useState(null);

    // Modal state
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [modalError, setModalError] = useState('');

    // Fetch order/auction data
    useEffect(() => {
        const fetchOrderData = async () => {
            if (!user || !auctionId) {
                setLoading(false);
                return;
            }

            try {
                // Fetch auction wins to get order details
                const winsRes = await fetch(`${API_URL}/api/orders/user/${user.user_id}/auction-wins`);
                if (!winsRes.ok) throw new Error('Failed to fetch auction data');

                const wins = await winsRes.json();
                const auction = wins.find(w => w.auction_id === auctionId);

                if (!auction) {
                    setError('Auction not found or you are not the winner');
                    setLoading(false);
                    return;
                }

                setOrderData(auction);
            } catch (err) {
                console.error('Error fetching order data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchOrderData();
    }, [user, auctionId]);

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
    }, [user]);

    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    // Calculate shipping fee based on location (simplified)
    useEffect(() => {
        if (!selectedAddressId) return;

        const selectedAddress = addresses.find(addr => addr.address_id === selectedAddressId);
        if (selectedAddress) {
            // Calculate shipping based on region (simplified logic)
            const region = selectedAddress.region?.toLowerCase() || '';
            if (region.includes('ncr') || region.includes('metro manila')) {
                setShippingFee(100);
            } else if (region.includes('luzon')) {
                setShippingFee(150);
            } else if (region.includes('visayas')) {
                setShippingFee(200);
            } else if (region.includes('mindanao')) {
                setShippingFee(250);
            } else {
                setShippingFee(150); // Default
            }
        }
    }, [selectedAddressId, addresses]);

    const handlePlaceOrder = () => {
        if (!selectedAddressId) {
            setModalError('Please select a shipping address before placing your order.');
            setShowErrorModal(true);
            return;
        }
        if (!paymentMethod) {
            setModalError('Please select a payment method before placing your order.');
            setShowErrorModal(true);
            return;
        }
        setShowConfirmModal(true);
    };

    const handleConfirmOrder = async () => {
        setShowConfirmModal(false);
        setProcessing(true);
        setError(null);

        try {
            const res = await fetch(`${API_URL}/api/orders/auction/${auctionId}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.user_id,
                    payment_method: paymentMethod,
                    shipping_address_id: selectedAddressId,
                    shipping_fee: shippingFee,
                    total_amount: (orderData?.total || 0) + shippingFee
                })
            });

            const data = await res.json();

            if (res.ok) {
                setShowSuccessModal(true);
            } else {
                throw new Error(data.error || 'Failed to create order');
            }
        } catch (err) {
            console.error('Error placing order:', err);
            setError(err.message);
            setModalError(err.message);
            setShowErrorModal(true);
        } finally {
            setProcessing(false);
        }
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

    if (!user) {
        return (
            <div className={styles.checkoutContainer}>
                <div className={styles.errorState}>
                    <AlertCircle size={48} color="#f44336" />
                    <h2>Please sign in</h2>
                    <p>You need to be logged in to checkout.</p>
                    <BackButton label="Go Back" />
                </div>
            </div>
        );
    }

    if (error || !orderData) {
        return (
            <div className={styles.checkoutContainer}>
                <div className={styles.errorState}>
                    <AlertCircle size={48} color="#f44336" />
                    <h2>Unable to process checkout</h2>
                    <p>{error || 'Order not found'}</p>
                    <BackButton label="Back to Orders" />
                </div>
            </div>
        );
    }

    const subtotal = orderData.total || 0;
    const total = subtotal + shippingFee;

    return (
        <>
        <div className={styles.checkoutContainer}>
            <div className={styles.checkoutContent}>
                <header className={styles.checkoutHeader}>
                    <BackButton label="Back" />
                    <h1>Checkout</h1>
                </header>

                <div className={styles.checkoutMain}>
                    {/* Left Column - Forms */}
                    <div className={styles.checkoutForms}>
                        {/* Shipping Address Section */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <div className={styles.sectionTitle}>
                                    <MapPin size={20} />
                                    <h2>Shipping Address</h2>
                                </div>
                                {addresses.length > 0 && (
                                    <button
                                        className={styles.changeBtn}
                                        onClick={() => router.push('/profile?tab=address')}
                                    >
                                        <Plus size={16} />
                                        Add New
                                    </button>
                                )}
                            </div>

                            {addresses.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <MapPin size={32} color="#ccc" />
                                    <p>No addresses found</p>
                                    <button
                                        className={styles.addAddressBtn}
                                        onClick={() => router.push('/profile?tab=address')}
                                    >
                                        <Plus size={18} />
                                        Add Shipping Address
                                    </button>
                                </div>
                            ) : (
                                <div className={styles.addressList}>
                                    {addresses.map(address => (
                                        <div
                                            key={address.address_id}
                                            className={`${styles.addressCard} ${selectedAddressId === address.address_id ? styles.selected : ''}`}
                                            onClick={() => setSelectedAddressId(address.address_id)}
                                        >
                                            <input
                                                type="radio"
                                                name="address"
                                                checked={selectedAddressId === address.address_id}
                                                onChange={() => setSelectedAddressId(address.address_id)}
                                                className={styles.radio}
                                            />
                                            <div className={styles.addressInfo}>
                                                <div className={styles.addressHeader}>
                                                    <span className={styles.addressName}>
                                                        {user?.Fname || 'User'} {user?.Lname || ''}
                                                    </span>
                                                    {address.is_default && (
                                                        <span className={styles.defaultBadge}>Default</span>
                                                    )}
                                                </div>
                                                <p className={styles.addressText}>
                                                    {formatAddress(address)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Payment Method Section */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <div className={styles.sectionTitle}>
                                    <CreditCard size={20} />
                                    <h2>Payment Method</h2>
                                </div>
                            </div>

                            <div className={styles.paymentMethods}>
                                <div
                                    className={`${styles.paymentCard} ${paymentMethod === 'cash_on_delivery' ? styles.selected : ''}`}
                                    onClick={() => setPaymentMethod('cash_on_delivery')}
                                >
                                    <input
                                        type="radio"
                                        name="payment"
                                        value="cash_on_delivery"
                                        checked={paymentMethod === 'cash_on_delivery'}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className={styles.radio}
                                    />
                                    <div className={styles.paymentInfo}>
                                        <Truck size={24} />
                                        <div>
                                            <h3>Cash on Delivery</h3>
                                            <p>Pay when you receive the item</p>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className={`${styles.paymentCard} ${paymentMethod === 'gcash' ? styles.selected : ''}`}
                                    onClick={() => setPaymentMethod('gcash')}
                                >
                                    <input
                                        type="radio"
                                        name="payment"
                                        value="gcash"
                                        checked={paymentMethod === 'gcash'}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className={styles.radio}
                                    />
                                    <div className={styles.paymentInfo}>
                                        <CreditCard size={24} />
                                        <div>
                                            <h3>GCash</h3>
                                            <p>Pay securely with GCash</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Shipping Method */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <div className={styles.sectionTitle}>
                                    <Truck size={20} />
                                    <h2>Shipping Method</h2>
                                </div>
                            </div>

                            <div className={styles.shippingCard}>
                                <CheckCircle2 size={20} color="#4caf50" />
                                <div className={styles.shippingInfo}>
                                    <h3>Standard Delivery</h3>
                                    <p>Estimated delivery: 3-5 business days</p>
                                </div>
                                <span className={styles.shippingFee}>
                                    ₱{shippingFee.toLocaleString()}
                                </span>
                            </div>
                        </section>
                    </div>

                    {/* Right Column - Order Summary */}
                    <aside className={styles.orderSummary}>
                        <div className={styles.summaryCard}>
                            <h2>Order Summary</h2>

                            {/* Product Info */}
                            <div className={styles.productInfo}>
                                <div className={styles.productImage}>
                                    <img
                                        src={orderData.items[0]?.image || 'https://placehold.co/100x100?text=No+Image'}
                                        alt={orderData.items[0]?.name}
                                    />
                                </div>
                                <div className={styles.productDetails}>
                                    <h3>{orderData.items[0]?.name}</h3>
                                    <p>Auction Win</p>
                                    <span className={styles.price}>₱{subtotal.toLocaleString()}</span>
                                </div>
                            </div>

                            <div className={styles.summaryDivider}></div>

                            {/* Price Breakdown */}
                            <div className={styles.priceBreakdown}>
                                <div className={styles.summaryRow}>
                                    <span>Subtotal</span>
                                    <span>₱{subtotal.toLocaleString()}</span>
                                </div>
                                <div className={styles.summaryRow}>
                                    <span>Shipping Fee</span>
                                    <span>₱{shippingFee.toLocaleString()}</span>
                                </div>
                                <div className={styles.summaryDivider}></div>
                                <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                                    <span>Total</span>
                                    <span>₱{total.toLocaleString()}</span>
                                </div>
                            </div>

                            <button
                                className={styles.placeOrderBtn}
                                onClick={handlePlaceOrder}
                                disabled={processing || !selectedAddressId}
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className={styles.spin} size={20} />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Place Order</span>
                                        <span>₱{total.toLocaleString()}</span>
                                    </>
                                )}
                            </button>

                            <p className={styles.secureText}>
                                🔒 Secure checkout with BIDPal Buyer Protection
                            </p>
                        </div>
                    </aside>
                </div>
            </div>
        </div>

        {/* ── Confirm Payment Modal ── */}
        {showConfirmModal && (
            <div className={styles.modalOverlay}>
                <div className={styles.modal}>
                    <div className={styles.modalHeader}>
                        <ShoppingBag size={22} className={styles.modalIcon} />
                        <h3>Confirm Payment</h3>
                        <button className={styles.modalClose} onClick={() => setShowConfirmModal(false)}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className={styles.modalBody}>
                        <div className={styles.confirmProduct}>
                            <img
                                src={orderData.items[0]?.image || 'https://placehold.co/60x60?text=Item'}
                                alt={orderData.items[0]?.name}
                                className={styles.confirmProductImg}
                            />
                            <div>
                                <p className={styles.confirmProductName}>{orderData.items[0]?.name}</p>
                                <p className={styles.confirmProductSub}>Auction Win</p>
                            </div>
                        </div>

                        <div className={styles.confirmBreakdown}>
                            <div className={styles.confirmRow}>
                                <span>Item Total</span>
                                <span>₱{subtotal.toLocaleString()}</span>
                            </div>
                            <div className={styles.confirmRow}>
                                <span>Shipping Fee</span>
                                <span>₱{shippingFee.toLocaleString()}</span>
                            </div>
                            <div className={styles.confirmRow}>
                                <span>Payment Method</span>
                                <span>{paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : 'GCash'}</span>
                            </div>
                            <div className={styles.confirmDivider} />
                            <div className={`${styles.confirmRow} ${styles.confirmTotal}`}>
                                <span>Total</span>
                                <span>₱{(subtotal + shippingFee).toLocaleString()}</span>
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

        {/* ── Success Modal ── */}
        {showSuccessModal && (
            <div className={styles.modalOverlay}>
                <div className={`${styles.modal} ${styles.modalCenter}`}>
                    <div className={styles.successIcon}>
                        <CheckCircle2 size={48} />
                    </div>
                    <h3 className={styles.successTitle}>Order Placed!</h3>
                    <p className={styles.successMsg}>
                        Your order has been placed successfully. The seller will prepare your item for shipping.
                    </p>
                    <button className={styles.modalConfirmBtn} onClick={() => router.push('/orders')}>
                        View My Orders
                    </button>
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
        </>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={<BIDPalLoader />}>
            <CheckoutPageInner />
        </Suspense>
    );
}
