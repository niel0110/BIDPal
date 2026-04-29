'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import CategoryNav from '@/components/home/CategoryNav';
import HeroBanner from '@/components/home/HeroBanner';
import AuctionCard from '@/components/card/AuctionCard';
import ProductCard from '@/components/card/ProductCard';
import Button from '@/components/ui/Button';
import AuthLogo from '@/components/AuthLogo';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import { X } from 'lucide-react';
import styles from './page.module.css';

function HomeInner() {
  const { user, loading, login, register } = useAuth();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const sortParam   = searchParams.get('sort') || 'recent';

  const [scrollProgress, setScrollProgress] = useState({ progress: 0, ratio: 0.3 });
  const [fixedScrollProgress, setFixedScrollProgress] = useState({ progress: 0, ratio: 0.3 });

  const [allAuctions, setAllAuctions] = useState([]);
  const [fixedProducts, setFixedProducts] = useState([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Search results state
  const [searchAuctions, setSearchAuctions] = useState([]);
  const [searchProducts, setSearchProducts] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const router = useRouter();
  const redirectAfterAuth = useRef(null);

  useEffect(() => {
    if (loading) return;
    if (user?.role?.toLowerCase() === 'seller') {
      // New seller (no Fname) always goes to setup; returning seller uses redirectAfterAuth or dashboard
      const target = !user.Fname
        ? '/seller/setup'
        : (redirectAfterAuth.current || '/seller');
      redirectAfterAuth.current = null;
      router.replace(target);
    } else if (user && !user.Fname) {
      // Buyer hasn't completed their profile yet
      router.replace('/buyer/setup');
    }
  }, [user, loading, router]);

  const [likedAuctionIds, setLikedAuctionIds] = useState(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

        // Fetch auctions and fixed-price products in parallel
        const [auctionRes, productsRes] = await Promise.all([
          fetch(`${apiUrl}/api/auctions?limit=50`),
          fetch(`${apiUrl}/api/products?has_price=true&sort=recent&limit=20`),
        ]);
        const auctionJson = await auctionRes.json();
        const fetchedAuctions = auctionJson.data || [];
        if (productsRes.ok) {
          const productsJson = await productsRes.json();
          setFixedProducts(productsJson.data || []);
        }

        // Fetch wishlist if logged in
        if (user?.user_id) {
          try {
            const wishRes = await fetch(`${apiUrl}/api/dashboard/wishlist/${user.user_id}`);
            if (wishRes.ok) {
              const wishData = await wishRes.json();
              const likedIds = new Set(wishData.map(item => item.auction_id));
              setLikedAuctionIds(likedIds);
              
              // Mark auctions as liked
              setAllAuctions(fetchedAuctions.map(a => ({
                ...a,
                is_liked: likedIds.has(a.id)
              })));
            } else {
              setAllAuctions(fetchedAuctions);
            }
          } catch (wishErr) {
            console.error('Failed to fetch wishlist:', wishErr);
            setAllAuctions(fetchedAuctions);
          }
        } else {
          setAllAuctions(fetchedAuctions);
        }

      } catch (err) {
        // API server not reachable — show empty state silently in dev
      } finally {
        setLoadingContent(false);
      }
    };

    fetchData();
  }, [user?.user_id]);

  // Fetch search results when query or sort changes
  useEffect(() => {
    if (!searchQuery) {
      setSearchAuctions([]);
      setSearchProducts([]);
      return;
    }
    const fetchSearch = async () => {
      setSearchLoading(true);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const q = encodeURIComponent(searchQuery);
        const [auctionRes, productRes] = await Promise.all([
          fetch(`${apiUrl}/api/auctions?search=${q}&limit=20`),
          fetch(`${apiUrl}/api/products?search=${q}&sort=${sortParam}&limit=20`),
        ]);
        const auctionJson = await auctionRes.json();
        const productJson = await productRes.json();
        const lq = searchQuery.toLowerCase();
        setSearchAuctions((auctionJson.data || []).filter(a =>
          a.title?.toLowerCase().includes(lq) ||
          a.seller?.toLowerCase().includes(lq) ||
          a.category?.toLowerCase().includes(lq)
        ));
        setSearchProducts(productJson.data || []);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearchLoading(false);
      }
    };
    fetchSearch();
  }, [searchQuery, sortParam]);

  const handleScroll = (e) => {
    const { scrollLeft, scrollWidth, clientWidth } = e.target;
    const maxScroll = scrollWidth - clientWidth;
    setScrollProgress({
      progress: maxScroll > 0 ? scrollLeft / maxScroll : 0,
      ratio: Math.min(clientWidth / scrollWidth, 1),
    });
  };

  const handleFixedScroll = (e) => {
    const { scrollLeft, scrollWidth, clientWidth } = e.target;
    const maxScroll = scrollWidth - clientWidth;
    setFixedScrollProgress({
      progress: maxScroll > 0 ? scrollLeft / maxScroll : 0,
      ratio: Math.min(clientWidth / scrollWidth, 1),
    });
  };

  const CATEGORY_KEYWORDS = {
    clothing: ['clothing', 'fashion', 'shirt', 'dress', 'pants', 'tops', 'jeans', 'suits', 'apparel', 'wear', 'baby clothes', 'kids clothes', 'women', 'men'],
    shoes: ['shoes', 'shoe', 'footwear', 'sneakers', 'boots', 'sandals'],
    bags: ['bags', 'bag', 'handbag', 'backpack', 'purse', 'luggage', 'tote'],
    jewelry: ['jewelry', 'jewellery', 'necklace', 'ring', 'watches', 'bracelet', 'gems', 'luxury'],
    gadgets: ['gadgets', 'electronics', 'smartphone', 'phones', 'tablet', 'laptop', 'computers', 'camera', 'gaming', 'headphone', 'tv', 'audio', 'photography'],
    appliances: ['appliances', 'appliance', 'kitchen', 'laundry', 'refrigerator', 'vacuum'],
    furniture: ['furniture', 'sofa', 'bed', 'dining', 'table', 'chair', 'storage', 'couch', 'decor', 'home'],
    garden: ['garden', 'plants', 'outdoor', 'lawn', 'tools'],
    instruments: ['instruments', 'instrument', 'music', 'guitar', 'piano', 'violin', 'drums', 'vinyl'],
  };

  const filterByCategory = (items, field = 'category') => {
    if (selectedCategory === 'all') return items;
    const keywords = CATEGORY_KEYWORDS[selectedCategory] || [selectedCategory];
    return items.filter(item => {
      const val = item[field]?.toLowerCase() || '';
      return keywords.some(kw => val.includes(kw));
    });
  };

  const auctions = filterByCategory(allAuctions);
  const liveAuctions = auctions.filter(a => a.status === 'active');
  const scheduledAuctions = auctions.filter(a => a.status === 'scheduled');
  const filteredFixed = filterByCategory(fixedProducts);


  if (loading) return null;

  return (
    <main className={styles.main}>
      <Header />
      <CategoryNav activeId={selectedCategory} onSelect={setSelectedCategory} />

      {/* ── Search results view ── */}
      {searchQuery ? (
        <>
          <div className={styles.searchResultsHeader}>
            <div>
              <h2 className={styles.searchResultsTitle}>
                Results for <span className={styles.redText}>"{searchQuery}"</span>
              </h2>
              <p className={styles.searchResultsCount}>
                {searchLoading ? 'Searching…' : `${searchAuctions.length + searchProducts.length} result${searchAuctions.length + searchProducts.length !== 1 ? 's' : ''} found`}
                {sortParam !== 'recent' && (
                  <span className={styles.sortChip}>
                    {{ price_asc: 'Price ↑', price_desc: 'Price ↓', popular: 'Popular', name_asc: 'A–Z' }[sortParam]}
                  </span>
                )}
              </p>
            </div>
            <Link href="/" className={styles.clearSearch}>
              <X size={14} /> Clear
            </Link>
          </div>

          {searchLoading && <div className={styles.searchLoading}>Searching…</div>}

          {!searchLoading && searchAuctions.length > 0 && (
            <section className={styles.section}>
              <div className={`${styles.sectionHeader} ${styles.staticIndicator}`}>
                <h2 className={styles.sectionTitle}>Auctions</h2>
              </div>
              <div className={styles.horizontalScroll}>
                {searchAuctions.map(item => <AuctionCard key={item.id} data={item} />)}
              </div>
            </section>
          )}

          {!searchLoading && searchProducts.length > 0 && (
            <section className={styles.section}>
              <div className={`${styles.sectionHeader} ${styles.staticIndicator}`}>
                <h2 className={styles.sectionTitle}>Products</h2>
              </div>
              <div className={styles.horizontalScroll}>
                {searchProducts.map(item => (
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

          {!searchLoading && searchAuctions.length === 0 && searchProducts.length === 0 && (
            <div className={styles.noResults}>
              <p>No results for <strong>"{searchQuery}"</strong></p>
              <p className={styles.noResultsSub}>Try different keywords or browse below.</p>
            </div>
          )}
        </>
      ) : (
        /* ── Normal home view ── */
        <>
          <HeroBanner />

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                {selectedCategory === 'all' ? <>Live <span className={styles.redText}>Auctions</span></> : <><span className={styles.redText} style={{ textTransform: 'capitalize' }}>{selectedCategory}</span> Live</>}
              </h2>
              <div className={styles.scrollIndicator}>
                <div className={styles.scrollThumb} style={{
                  width: `${scrollProgress.ratio * 100}%`,
                  left: `${scrollProgress.progress * (100 - scrollProgress.ratio * 100)}%`,
                }} />
              </div>
            </div>
            <div className={styles.horizontalScroll} onScroll={handleScroll}>
              {liveAuctions.length > 0
                ? liveAuctions.map(item => <AuctionCard key={item.id} data={item} />)
                : <div className={styles.emptyState}>No live auctions at the moment.</div>}
            </div>
          </section>

          <section className={styles.section}>
            <div className={`${styles.sectionHeader} ${styles.staticIndicator}`}>
              <h2 className={styles.sectionTitle}>
                {selectedCategory === 'all' ? <>Scheduled <span className={styles.redText}>Auctions</span></> : <><span className={styles.redText} style={{ textTransform: 'capitalize' }}>{selectedCategory}</span> Scheduled</>}
              </h2>
            </div>
            <div className={styles.horizontalScroll}>
              {scheduledAuctions.length > 0
                ? scheduledAuctions.map(item => <AuctionCard key={item.id} data={item} />)
                : <div className={styles.emptyState}>No scheduled auctions at the moment.</div>}
            </div>
          </section>

          {filteredFixed.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  {selectedCategory === 'all'
                    ? <>Fixed Price <span className={styles.redText}>Products</span></>
                    : <><span className={styles.redText} style={{ textTransform: 'capitalize' }}>{selectedCategory}</span> Products</>}
                </h2>
                <div className={styles.scrollIndicator}>
                  <div className={styles.scrollThumb} style={{
                    width: `${fixedScrollProgress.ratio * 100}%`,
                    left: `${fixedScrollProgress.progress * (100 - fixedScrollProgress.ratio * 100)}%`,
                  }} />
                </div>
              </div>
              <div className={styles.horizontalScroll} onScroll={handleFixedScroll}>
                {filteredFixed.map(item => (
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
        </>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeInner />
    </Suspense>
  );
}
