'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import AuctionCard from '@/components/card/AuctionCard';
import ProductCard from '@/components/card/ProductCard';
import { Gavel, Package } from 'lucide-react';
import styles from './page.module.css';

export default function SearchPage() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q') || '';

    const [auctions, setAuctions] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        if (!query) return;

        const fetchResults = async () => {
            setLoading(true);
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
                const q = encodeURIComponent(query);

                const [auctionRes, productRes] = await Promise.all([
                    fetch(`${apiUrl}/api/auctions?search=${q}&limit=20`),
                    fetch(`${apiUrl}/api/products?search=${q}&limit=20`),
                ]);

                const auctionJson = await auctionRes.json();
                const productJson = await productRes.json();

                const fetchedAuctions = auctionJson.data || [];
                const fetchedProducts = productJson.data || [];

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
    }, [query]);

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
                    {!loading && query && (
                        <p className={styles.count}>{totalResults} result{totalResults !== 1 ? 's' : ''} found</p>
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

                {loading && (
                    <div className={styles.loading}>Searching...</div>
                )}

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
