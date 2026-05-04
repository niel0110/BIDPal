'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle2, CreditCard, Truck, MapPin, Package, Printer, Loader2, XCircle, ShoppingBag } from 'lucide-react';
import styles from './ReceiptModal.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

/**
 * ReceiptModal — reusable receipt popup.
 *
 * Props:
 *   orderId       — UUID of the order to fetch/display
 *   paymentRef    — optional payment reference string (shown immediately, before fetch)
 *   paidAt        — optional ISO date string
 *   method        — optional payment method string
 *   onClose       — callback when the modal should close
 *   onViewOrders  — optional callback to navigate to orders list (shown as "View My Orders" button)
 */
export default function ReceiptModal({ orderId, paymentRef, paidAt, method, onClose, onViewOrders }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!orderId) return;
        setLoading(true);
        setError(null);
        fetch(`${API_URL}/api/orders/${orderId}/receipt`)
            .then(r => r.json())
            .then(d => {
                if (d.error) throw new Error(d.error);
                setData(d);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [orderId]);

    // Prevent background scroll while open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const paymentReference = data?.payment_reference || paymentRef || '—';
    const paidAtDate = data?.paid_at || paidAt;
    const paymentMethod = data?.payment_method || method || 'cash_on_delivery';
    const isCod = ['cash_on_delivery', 'cod', 'cash'].includes(String(paymentMethod).toLowerCase());
    const isPaid = !isCod && ['processing', 'shipped', 'completed'].includes(data?.status);
    const totalLabel = isCod ? 'Amount to Collect' : 'Total Paid';
    const methodLabel = paymentMethod === 'gcash' ? 'GCash' : 'Cash on Delivery';

    const formatAddress = (addr) => {
        if (!addr) return '—';
        return [addr.Line1, addr.Line2, addr['Household/blk st.'], addr.Barangay, addr['Municipality/City'], addr.province, addr['zip code']]
            .filter(Boolean).join(', ');
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>

                {/* ── Top bar ── */}
                <div className={styles.topBar}>
                    <div className={styles.topBarLeft}>
                        <span className={styles.brand}>BIDPal</span>
                        {data && (
                            <span className={styles.brandSub}>
                                {isCod ? 'Order Summary' : 'Payment Receipt'}
                            </span>
                        )}
                    </div>
                    <div className={styles.topBarRight}>
                        <button className={styles.printBtn} onClick={() => window.print()} title="Print receipt">
                            <Printer size={16} />
                        </button>
                        <button className={styles.closeBtn} onClick={onClose} title="Close">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Content ── */}
                <div className={styles.body} id="receipt-print">
                    {loading ? (
                        <div className={styles.stateCenter}>
                            <Loader2 size={32} className={styles.spin} color="#D32F2F" />
                            <p>Loading receipt…</p>
                        </div>
                    ) : error ? (
                        <div className={styles.stateCenter}>
                            <XCircle size={40} color="#D32F2F" />
                            <p className={styles.errorMsg}>{error}</p>
                        </div>
                    ) : data ? (
                        <>
                            {/* Status badge */}
                            <div className={styles.statusRow}>
                                {isCod ? (
                                    <span className={styles.badgePending}>Collect on Delivery</span>
                                ) : isPaid ? (
                                    <span className={styles.badgePaid}>
                                        <CheckCircle2 size={14} /> Payment Confirmed
                                    </span>
                                ) : (
                                    <span className={styles.badgePending}>Pending</span>
                                )}
                            </div>

                            <div className={styles.divider} />

                            {/* Reference row */}
                            <div className={styles.refGrid}>
                                {paymentReference && paymentReference !== '—' && (
                                    <div className={styles.refItem}>
                                        <span className={styles.refLabel}>Payment Reference</span>
                                        <span className={styles.refValue}>{paymentReference}</span>
                                    </div>
                                )}
                                <div className={styles.refItem}>
                                    <span className={styles.refLabel}>Order ID</span>
                                    <span className={styles.refValueSmall}>{data.order_id}</span>
                                </div>
                                {paidAtDate && (
                                    <div className={styles.refItem}>
                                        <span className={styles.refLabel}>Date & Time</span>
                                        <span className={styles.refValueSmall}>
                                            {new Date(paidAtDate).toLocaleString('en-PH', {
                                                month: 'long', day: 'numeric', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.divider} />

                            {/* Product */}
                            {data.product && (
                                <div className={styles.productRow}>
                                    {data.product.image && (
                                        <img src={data.product.image} alt={data.product.name} className={styles.productImg} />
                                    )}
                                    <div className={styles.productInfo}>
                                        <span className={styles.productTag}>
                                            {data.order_type === 'auction' ? 'Auction Win' : 'Purchase'}
                                        </span>
                                        <p className={styles.productName}>{data.product.name}</p>
                                        <p className={styles.productPrice}>₱{(data.product.price || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            )}

                            <div className={styles.divider} />

                            {/* Price breakdown */}
                            <div className={styles.breakdown}>
                                <div className={styles.breakdownRow}>
                                    <span>Item Total</span>
                                    <span>₱{(data.product?.price || 0).toLocaleString()}</span>
                                </div>
                                <div className={styles.breakdownRow}>
                                    <span>Shipping Fee</span>
                                    <span>₱{(data.shipping_fee || 0).toLocaleString()}</span>
                                </div>
                                <div className={`${styles.breakdownRow} ${styles.totalRow}`}>
                                    <span>{totalLabel}</span>
                                    <span>₱{(data.total_amount || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className={styles.divider} />

                            {/* Info blocks */}
                            <div className={styles.infoGrid}>
                                <div className={styles.infoBlock}>
                                    <div className={styles.infoIcon}><CreditCard size={14} /></div>
                                    <div>
                                        <p className={styles.infoLabel}>Payment Method</p>
                                        <p className={styles.infoValue}>{methodLabel}</p>
                                    </div>
                                </div>
                                {isCod && (
                                    <div className={styles.infoBlock}>
                                        <div className={styles.infoIcon}><Truck size={14} /></div>
                                        <div>
                                            <p className={styles.infoLabel}>Payment Status</p>
                                            <p className={styles.infoValue}>Cash will be received once delivered.</p>
                                        </div>
                                    </div>
                                )}
                                {data.buyer && (
                                    <div className={styles.infoBlock}>
                                        <div className={styles.infoIcon}><Package size={14} /></div>
                                        <div>
                                            <p className={styles.infoLabel}>Buyer</p>
                                            <p className={styles.infoValue}>{data.buyer.name}</p>
                                            <p className={styles.infoSub}>{data.buyer.email}</p>
                                        </div>
                                    </div>
                                )}
                                {data.seller && (
                                    <div className={styles.infoBlock}>
                                        <div className={styles.infoIcon}><Package size={14} /></div>
                                        <div>
                                            <p className={styles.infoLabel}>Seller</p>
                                            <p className={styles.infoValue}>{data.seller.name}</p>
                                        </div>
                                    </div>
                                )}
                                {data.shipping_address && (
                                    <div className={styles.infoBlock}>
                                        <div className={styles.infoIcon}><MapPin size={14} /></div>
                                        <div>
                                            <p className={styles.infoLabel}>Ship To</p>
                                            <p className={styles.infoValue}>{formatAddress(data.shipping_address)}</p>
                                        </div>
                                    </div>
                                )}
                                {data.tracking_number && (
                                    <div className={styles.infoBlock}>
                                        <div className={styles.infoIcon}><Truck size={14} /></div>
                                        <div>
                                            <p className={styles.infoLabel}>Tracking</p>
                                            <p className={styles.infoValue}>{data.courier} · {data.tracking_number}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className={styles.receiptFooter}>
                                <p>Thank you for using BIDPal! 🎉</p>
                                <p className={styles.footerSub}>
                                    {isCod
                                        ? 'This is an order summary. Cash will be collected upon delivery.'
                                        : `Keep this as proof of payment. Reference: ${paymentReference}`}
                                </p>
                            </div>
                        </>
                    ) : null}
                </div>

                {/* ── Footer actions ── */}
                {!loading && !error && data && onViewOrders && (
                    <div className={styles.footer}>
                        <button className={styles.viewOrdersBtn} onClick={onViewOrders}>
                            <ShoppingBag size={16} /> View My Orders
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
