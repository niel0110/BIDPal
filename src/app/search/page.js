'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import AuctionCard from '@/components/card/AuctionCard';
import ProductCard from '@/components/card/ProductCard';
import { useAuth } from '@/context/AuthContext';
import { Gavel, Package, ArrowUpDown } from 'lucide-react';
import styles from './page.module.css';

function SearchPageInner() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q') || '';
    const sort  = searchParams.get('sort') || 'recent';

    const [auctions, setAuctions] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const { user } = useAuth();

    useEffect(() => {
        const fetchResults = async () => {
            setLoading(true);
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const q = encodeURIComponent(query);
                const productUrl = query
                    ? `${apiUrl}/api/products?search=${q}&sort=${sort}&limit=20`
                    : `${apiUrl}/api/products?sort=${sort}&limit=20`;
                const auctionUrl = query
                    ? `${apiUrl}/api/auctions?search=${q}&limit=20`
                    : null;

                const [auctionRes, productRes] = await Promise.all([
                    auctionUrl ? fetch(auctionUrl) : Promise.resolve({ json: () => ({ data: [] }) }),
                    fetch(productUrl),
                ]);

                const auctionJson = await auctionRes.json();
                const productJson = await productRes.json();

                let fetchedAuctions = auctionJson.data || [];
                const fetchedProducts = productJson.data || [];

                // Fetch wishlist if logged in to mark auctions as liked
                if (user?.user_id) {
                    try {
                        const wishRes = await fetch(`${apiUrl}/api/dashboard/wishlist/${user.user_id}`);
                        if (wishRes.ok) {
                            const wishData = await wishRes.json();
                            const likedIds = new Set(wishData.map(item => item.auction_id));
                            fetchedAuctions = fetchedAuctions.map(a => ({
                                ...a,
                                is_liked: likedIds.has(a.id)
                            }));
                        }
                    } catch (wishErr) {
                        console.error('Failed to fetch wishlist for search:', wishErr);
                    }
                }

                // Client-side filter as fallback if API doesn't support search param
                const lq = query.toLowerCase();
                setAuctions(fetchedAuctions.filter(a =>
                    a.title?.toLowerCase().includes(lq) ||
                    a.seller?.toLowerCase().includes(lq) ||
                    a.category?.toLowerCase().includes(lq)
                ));
                setProducts(fetchedProducts.filter(p =>
                    p.name?.toLowerCase().includes(lq) ||
                    p.category?.toLowerCase().includes(lq) ||
                    p.description?.toLowerCase().includes(lq)
                ));
            } catch (err) {
                console.error('Search failed:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [query, sort, user?.user_id]);

    const totalResults = auctions.length + products.length;

    const showAuctions = activeTab === 'all' || activeTab === 'auctions';
    const showProducts = activeTab === 'all' || activeTab === 'products';

    return (
        <main className={styles.main}>
            <Header />

            <div className={styles.container}>
                <div className={styles.resultsMeta}>
                    {query ? (
                        <h1 className={styles.title}>
                            Results for <span className={styles.query}>&ldquo;{query}&rdquo;</span>
                        </h1>
                    ) : (
                        <h1 className={styles.title}>Search</h1>
                    )}
                    {!loading && (
                        <p className={styles.count}>
                            {query ? `${totalResults} result${totalResults !== 1 ? 's' : ''} found` : 'Browsing products'}
                            {sort !== 'recent' && (
                                <span className={styles.sortBadge}>
                                    <ArrowUpDown size={12} />
                                    {{ price_asc: 'Price ↑', price_desc: 'Price ↓', popular: 'Popular', name_asc: 'A–Z' }[sort]}
                                </span>
                            )}
                        </p>
                    )}
                </div>

                {query && (
                    <div className={styles.tabs}>
                        {[
                            { id: 'all', label: 'All' },
                            { id: 'auctions', label: `Auctions (${auctions.length})` },
                            { id: 'products', label: `Products (${products.length})` },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                {loading && <BIDPalLoader size="section" />}

                {!loading && query && totalResults === 0 && (
                    <div className={styles.empty}>
                        <p>No results found for &ldquo;{query}&rdquo;</p>
                        <p className={styles.emptySub}>Try different keywords or browse categories on the home page.</p>
                    </div>
                )}

                {!loading && showAuctions && auctions.length > 0 && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>
                            <Gavel size={18} /> Auctions
                        </h2>
                        <div className={styles.auctionGrid}>
                            {auctions.map(item => (
                                <AuctionCard key={item.id} data={item} />
                            ))}
                        </div>
                    </section>
                )}

                {!loading && showProducts && products.length > 0 && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>
                            <Package size={18} /> Products
                        </h2>
                        <div className={styles.productGrid}>
                            {products.map(item => (
                                <ProductCard key={item.products_id} data={{
                                    ...item,
                                    title: item.name,
                                    image: item.images?.[0]?.image_url,
                                    wishlistCount: item.wishlist_count || 0,
                                }} />
                            ))}
                        </div>
                    </section>
                )}

                {!query && (
                    <div className={styles.empty}>
                        <p>Enter a search term to find auctions and products.</p>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<BIDPalLoader />}>
            <SearchPageInner />
        </Suspense>
    );
}
