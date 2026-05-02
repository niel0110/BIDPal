'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { CheckCircle2, Printer, ArrowLeft, Package, Truck, MapPin, CreditCard, Smartphone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function ReceiptPageInner() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    const orderId = params?.orderId;
    const refFromUrl = searchParams.get('ref');
    const paidAtFromUrl = searchParams.get('paid_at');
    const methodFromUrl = searchParams.get('method');

    const [receipt, setReceipt] = useState(null);
    const [loading, setLoading] = useState(Boolean(orderId));
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!orderId) return;
        fetch(`${API_URL}/api/orders/${orderId}/receipt`)
            .then(r => r.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setReceipt(data);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [orderId]);

    if (loading) return <BIDPalLoader />;

    if (error || !receipt) {
        return (
            <div className={styles.page}>
                <div className={styles.errorState}>
                    <Package size={48} color="#ddd" strokeWidth={1.5} />
                    <h2>Receipt not found</h2>
                    <p>{error || 'This receipt could not be loaded.'}</p>
                    <button className={styles.backBtn} onClick={() => router.push('/orders')}>
                        <ArrowLeft size={16} /> Back to Orders
                    </button>
                </div>
            </div>
        );
    }

    const paymentRef = receipt.payment_reference || refFromUrl || '—';
    const paidAt = receipt.paid_at || paidAtFromUrl;
    const method = receipt.payment_method || methodFromUrl || 'cash_on_delivery';
    const methodLabel = method === 'gcash' ? 'GCash' : 'Cash on Delivery';

    const formatAddress = (addr) => {
        if (!addr) return '—';
        return [
            addr.Line1, addr.Line2, addr['Household/blk st.'],
            addr.Barangay, addr['Municipality/City'], addr.province, addr['zip code']
        ].filter(Boolean).join(', ');
    };

    const isCod = ['cash_on_delivery', 'cod', 'cash'].includes(String(method || '').toLowerCase());
    const isPaid = !isCod && ['processing', 'shipped', 'completed'].includes(receipt.status);
    const totalLabel = isCod ? 'Amount to Collect' : 'Total Paid';

    return (
        <div className={styles.page}>
            <div className={styles.container}>

                {/* Nav bar */}
                <div className={styles.nav}>
                    <button className={styles.backBtn} onClick={() => router.push('/orders')}>
                        <ArrowLeft size={16} /> My Orders
                    </button>
                    <button className={styles.printBtn} onClick={() => window.print()}>
                        <Printer size={16} /> Print Receipt
                    </button>
                </div>

                {/* Receipt card */}
                <div className={styles.receiptCard} id="receipt-print">

                    {/* Header */}
                    <div className={styles.receiptHeader}>
                        <div className={styles.brandRow}>
                            <span className={styles.brand}>BIDPal</span>
                            <span className={styles.brandSub}>{isCod ? 'Order Payment Summary' : 'Official Payment Receipt'}</span>
                        </div>
                        {isCod ? (
                            <div className={styles.pendingBadge}>Collect on Delivery</div>
                        ) : isPaid ? (
                            <div className={styles.paidBadge}>
                                <CheckCircle2 size={16} />
                                Payment Confirmed
                            </div>
                        ) : (
                            <div className={styles.pendingBadge}>Pending</div>
                        )}
                    </div>

                    <div className={styles.divider} />

                    {/* Reference */}
                    <div className={styles.refSection}>
                        <div className={styles.refBlock}>
                            <span className={styles.refLabel}>Payment Reference</span>
                            <span className={styles.refValue}>{paymentRef}</span>
                        </div>
                        <div className={styles.refBlock}>
                            <span className={styles.refLabel}>Order ID</span>
                            <span className={styles.refValueSmall}>{receipt.order_id}</span>
                        </div>
                        {paidAt && (
                            <div className={styles.refBlock}>
                                <span className={styles.refLabel}>Date & Time</span>
                                <span className={styles.refValueSmall}>
                                    {new Date(paidAt).toLocaleString('en-PH', {
                                        month: 'long', day: 'numeric', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className={styles.divider} />

                    {/* Product */}
                    {receipt.product && (
                        <div className={styles.productRow}>
                            {receipt.product.image && (
                                <img src={receipt.product.image} alt={receipt.product.name} className={styles.productImg} />
                            )}
                            <div className={styles.productInfo}>
                                <span className={styles.auctionTag}>Auction Win</span>
                                <p className={styles.productName}>{receipt.product.name}</p>
                                <p className={styles.productPrice}>₱{(receipt.product.price || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    )}

                    <div className={styles.divider} />

                    {/* Price breakdown */}
                    <div className={styles.breakdown}>
                        <div className={styles.breakdownRow}>
                            <span>Item Total</span>
                            <span>₱{(receipt.product?.price || 0).toLocaleString()}</span>
                        </div>
                        <div className={styles.breakdownRow}>
                            <span>Shipping Fee</span>
                            <span>₱{(receipt.shipping_fee || 0).toLocaleString()}</span>
                        </div>
                        <div className={`${styles.breakdownRow} ${styles.totalRow}`}>
                            <span>{totalLabel}</span>
                            <span>₱{(receipt.total_amount || 0).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className={styles.divider} />

                    {/* Info grid */}
                    <div className={styles.infoGrid}>

                        <div className={styles.infoBlock}>
                            <div className={styles.infoIcon}>
                                {method === 'gcash' ? <Smartphone size={15} /> : <CreditCard size={15} />}
                            </div>
                            <div>
                                <p className={styles.infoLabel}>Payment Method</p>
                                <p className={styles.infoValue}>{methodLabel}</p>
                            </div>
                        </div>
                        {isCod && (
                            <div className={styles.infoBlock}>
                                <div className={styles.infoIcon}><Truck size={15} /></div>
                                <div>
                                    <p className={styles.infoLabel}>Payment Status</p>
                                    <p className={styles.infoValue}>Cash will be received once delivered.</p>
                                </div>
                            </div>
                        )}

                        {receipt.buyer && (
                            <div className={styles.infoBlock}>
                                <div className={styles.infoIcon}><Package size={15} /></div>
                                <div>
                                    <p className={styles.infoLabel}>Buyer</p>
                                    <p className={styles.infoValue}>{receipt.buyer.name}</p>
                                    <p className={styles.infoSub}>{receipt.buyer.email}</p>
                                </div>
                            </div>
                        )}

                        {receipt.seller && (
                            <div className={styles.infoBlock}>
                                <div className={styles.infoIcon}><Package size={15} /></div>
                                <div>
                                    <p className={styles.infoLabel}>Seller</p>
                                    <p className={styles.infoValue}>{receipt.seller.name}</p>
                                </div>
                            </div>
                        )}

                        {receipt.shipping_address && (
                            <div className={styles.infoBlock}>
                                <div className={styles.infoIcon}><MapPin size={15} /></div>
                                <div>
                                    <p className={styles.infoLabel}>Ship To</p>
                                    <p className={styles.infoValue}>{formatAddress(receipt.shipping_address)}</p>
                                </div>
                            </div>
                        )}

                        {receipt.tracking_number && (
                            <div className={styles.infoBlock}>
                                <div className={styles.infoIcon}><Truck size={15} /></div>
                                <div>
                                    <p className={styles.infoLabel}>Tracking</p>
                                    <p className={styles.infoValue}>{receipt.courier} · {receipt.tracking_number}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className={styles.receiptFooter}>
                        <p>Thank you for using BIDPal!</p>
                        <p className={styles.footerSub}>
                            {isCod ? 'This is an order summary for cash collection on delivery.' : 'Keep this receipt as proof of payment.'}
                            {' '}Reference: <strong>{paymentRef}</strong>
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                    <button className={styles.ordersBtn} onClick={() => router.push('/orders')}>
                        View My Orders
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function ReceiptPage() {
    return (
        <Suspense fallback={<BIDPalLoader />}>
            <ReceiptPageInner />
        </Suspense>
    );
}
