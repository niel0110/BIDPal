'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import BackButton from '@/components/BackButton';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Tag, Package, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const STATUS_LABEL = {
    pending_payment: 'Awaiting Payment',
    processing: 'To Ship',
    shipped: 'Shipped',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

function peso(value) {
    return `₱${Number(value || 0).toLocaleString('en-PH')}`;
}

function listingImage(listing) {
    return (
        listing.image ||
        listing.images?.[0]?.image_url ||
        listing.images?.[0] ||
        'https://placehold.co/96x96?text=Item'
    );
}

export default function SellerOrdersPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [orders, setOrders] = useState([]);
    const [fixedListings, setFixedListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchOrders = useCallback(async () => {
        if (!user) return;

        let sellerId = user.seller_id;
        if (!sellerId) {
            try {
                const res = await fetch(`${API_URL}/api/seller/user/${user.user_id}`);
                if (res.ok) {
                    const data = await res.json();
                    sellerId = data.seller_id;
                }
            } catch {
                // Keep the page graceful if the session is stale.
            }
        }

        if (!sellerId) {
            setLoading(false);
            return;
        }

        try {
            const [ordersRes, listingsRes] = await Promise.all([
                fetch(`${API_URL}/api/orders/seller/${sellerId}`),
                fetch(`${API_URL}/api/auctions?sale_type=sale&seller_id=${sellerId}&limit=50`),
            ]);

            if (ordersRes.ok) setOrders(await ordersRes.json());
            if (listingsRes.ok) {
                const data = await listingsRes.json();
                setFixedListings(data.data || []);
            }
        } catch (err) {
            console.error('Error fetching seller fixed-price listings:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const fixedOrderByProduct = useMemo(() => {
        const entries = orders
            .filter(order => order.order_type === 'regular' || !order.auction_id)
            .map(order => [order.product?.products_id, order])
            .filter(([productId]) => productId);

        return new Map(entries);
    }, [orders]);

    const visibleListings = useMemo(() => {
        const q = search.trim().toLowerCase();
        return fixedListings
            .map(listing => ({
                ...listing,
                order: fixedOrderByProduct.get(listing.products_id),
            }))
            .filter(listing => {
                if (!q) return true;
                return (
                    listing.title?.toLowerCase().includes(q) ||
                    listing.order?.order_id?.toLowerCase().includes(q) ||
                    listing.order?.buyer?.name?.toLowerCase().includes(q)
                );
            });
    }, [fixedListings, fixedOrderByProduct, search]);

    const openListing = (listing) => {
        if (listing.order?.order_id) {
            router.push(`/seller/orders/${listing.order.order_id}`);
            return;
        }

        router.push(`/product/${listing.products_id}`);
    };

    if (loading) return <BIDPalLoader />;

    return (
        <div className={styles.page}>
            <div className={styles.pageHeader}>
                <BackButton label="Back" />
                <div className={styles.titleRow}>
                    <h1>Fixed Price Listings</h1>
                    <div className={styles.searchBar}>
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search listing, order, or buyer..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <section className={styles.fixedSection}>
                <div className={styles.fixedSectionHeader}>
                    <Tag size={16} />
                    <h2>Fixed Price Listings</h2>
                    <span className={styles.fixedCount}>{visibleListings.length}</span>
                </div>

                {visibleListings.length === 0 ? (
                    <div className={styles.empty}>
                        <Package size={48} strokeWidth={1.4} />
                        <p>No fixed-price listings found</p>
                    </div>
                ) : (
                    <div className={styles.fixedGrid}>
                        {visibleListings.map(listing => (
                            <button
                                type="button"
                                key={listing.id}
                                className={styles.fixedCard}
                                onClick={() => openListing(listing)}
                            >
                                <img
                                    src={listingImage(listing)}
                                    alt={listing.title || 'Fixed price item'}
                                    className={styles.fixedCardImg}
                                />
                                <div className={styles.fixedCardInfo}>
                                    <p className={styles.fixedCardName}>{listing.title || 'Fixed Price Item'}</p>
                                    <p className={styles.fixedCardPrice}>{peso(listing.price)}</p>
                                    <span className={`${styles.fixedCardBadge} ${listing.order ? styles[`fixedBadge_${listing.order.status}`] || '' : ''}`}>
                                        {listing.order ? STATUS_LABEL[listing.order.status] || listing.order.status : 'For Sale'}
                                    </span>
                                </div>
                                <ChevronRight size={18} className={styles.fixedCardArrow} />
                            </button>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
