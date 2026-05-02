'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import CategoryNav from '@/components/home/CategoryNav';
import HeroBanner from '@/components/home/HeroBanner';
import AuctionCard from '@/components/card/AuctionCard';
import ProductCard from '@/components/card/ProductCard';
import styles from './page.module.css';

function HomeInner() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const sortParam   = searchParams.get('sort') || 'recent';

  const [allAuctions, setAllAuctions] = useState([]);
  const [fixedProducts, setFixedProducts] = useState([]);
  const [, setLoadingContent] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Search results state
  const [searchAuctions, setSearchAuctions] = useState([]);
  const [searchProducts, setSearchProducts] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const router = useRouter();
  const redirectAfterAuth = useRef(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/signin');
      return;
    }
    if (user.role?.toLowerCase() === 'seller') {
      const target = !user.Fname
        ? '/seller/setup'
        : (redirectAfterAuth.current || '/seller');
      redirectAfterAuth.current = null;
      router.replace(target);
    } else if (!user.Fname || user.kyc_status !== 'approved') {
      router.replace('/buyer/setup');
    }
  }, [user, loading, router]);

  const [, setLikedAuctionIds] = useState(new Set());

  const CATEGORY_KEYWORDS = {
    clothing:    ['cloth', 'shirt', 'dress', 'pants', 'top', 'wear', 'apparel', 'fashion', 'blouse', 'skirt', 'suit', 'jacket', 'coat', 'jeans'],
    shoes:       ['shoe', 'footwear', 'sneaker', 'boot', 'sandal', 'slipper', 'heel'],
    bags:        ['bag', 'purse', 'tote', 'pouch', 'backpack', 'luggage', 'satchel', 'handbag', 'clutch'],
    jewelry:     ['jewel', 'necklace', 'ring', 'watch', 'bracelet', 'gem', 'earring', 'pendant', 'luxury'],
    gadgets:     ['gadget', 'electron', 'phone', 'tablet', 'laptop', 'computer', 'camera', 'gaming', 'headphone', 'audio', 'tv', 'charger', 'cable', 'tech'],
    appliances:  ['appliance', 'kitchen', 'laundry', 'refriger', 'vacuum', 'blender', 'oven', 'microwave'],
    furniture:   ['furniture', 'sofa', 'bed', 'dining', 'table', 'chair', 'storage', 'couch', 'decor', 'shelf', 'cabinet'],
    garden:      ['garden', 'plant', 'outdoor', 'lawn', 'tool', 'pot', 'soil'],
    instruments: ['instrument', 'music', 'guitar', 'piano', 'violin', 'drum', 'vinyl', 'bass', 'keyboard'],
  };

  const matchesCategory = (item, category) => {
    if (category === 'all') return true;
    const keywords = CATEGORY_KEYWORDS[category] || [category];
    const haystack = (item.category || '').toLowerCase();
    return keywords.some(kw => haystack.includes(kw));
  };

  const fetchHomeData = async (category = 'all') => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const catParam = category !== 'all' ? `&category=${encodeURIComponent(category)}` : '';

      const [auctionRes, fixedRes] = await Promise.all([
        fetch(`${apiUrl}/api/auctions?sale_type=bid&limit=50${catParam}`),
        fetch(`${apiUrl}/api/auctions?sale_type=sale&limit=50${catParam}`),
      ]);
      const auctionJson = await auctionRes.json();
      const fetchedAuctions = auctionJson.data || [];

      // Fixed price = only explicit sale_type=sale auction listings
      const fixedAuctionJson = fixedRes.ok ? await fixedRes.json() : { data: [] };
      const fixedAuctionItems = (fixedAuctionJson.data || []).map(a => ({
        products_id: a.products_id,
        name: a.title,
        price: a.price,
        images: a.images?.length ? a.images.map(url => ({ image_url: url })) : [],
        seller_name: a.seller,
        seller_avatar: a.seller_avatar,
        seller_id: a.seller_id,
        category: a.category,
      }));

      const filteredFixed = category === 'all'
        ? fixedAuctionItems
        : fixedAuctionItems.filter(p => matchesCategory(p, category));
      setFixedProducts(filteredFixed);

      if (user?.user_id) {
        try {
          const wishRes = await fetch(`${apiUrl}/api/dashboard/wishlist/${user.user_id}`);
          if (wishRes.ok) {
            const wishData = await wishRes.json();
            const likedIds = new Set(wishData.map(item => item.auction_id));
            setLikedAuctionIds(likedIds);
            setAllAuctions(fetchedAuctions.map(a => ({ ...a, is_liked: likedIds.has(a.id) })));
          } else {
            setAllAuctions(fetchedAuctions);
          }
        } catch {
          setAllAuctions(fetchedAuctions);
        }
      } else {
        setAllAuctions(fetchedAuctions);
      }
    } catch {
      // API server not reachable
    } finally {
      setLoadingContent(false);
    }
  };

  useEffect(() => {
    fetchHomeData('all');
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
        const [auctionRes, fixedRes] = await Promise.all([
          fetch(`${apiUrl}/api/auctions?sale_type=bid&search=${q}&limit=20`),
          fetch(`${apiUrl}/api/auctions?sale_type=sale&search=${q}&limit=20`),
        ]);
        const auctionJson = await auctionRes.json();
        const fixedJson = await fixedRes.json();
        const lq = searchQuery.toLowerCase();
        setSearchAuctions((auctionJson.data || []).filter(a =>
          a.title?.toLowerCase().includes(lq) ||
          a.seller?.toLowerCase().includes(lq) ||
          a.category?.toLowerCase().includes(lq)
        ));
        setSearchProducts((fixedJson.data || []).map(a => ({
          products_id: a.products_id,
          name: a.title,
          price: a.price,
          images: a.images?.length ? a.images.map(url => ({ image_url: url })) : [],
          seller_name: a.seller,
          seller_avatar: a.seller_avatar,
          seller_id: a.seller_id,
          category: a.category,
        })));
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearchLoading(false);
      }
    };
    fetchSearch();
  }, [searchQuery, sortParam]);

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    fetchHomeData(cat);
  };

  // sale_type comes from backend (needs restart); fall back to detecting fixed-price by currentBid===0 with price set
  const isBidAuction = (a) => a.sale_type !== 'sale';
  const liveAuctions = allAuctions.filter(a => a.status === 'active' && isBidAuction(a));
  const scheduledAuctions = allAuctions.filter(a => a.status === 'scheduled' && isBidAuction(a));


  if (loading || !user) return null;

  return (
    <main className={styles.main}>
      <Header />
      <CategoryNav activeId={selectedCategory} onSelect={handleCategorySelect} />

      {/* ── Search results view ── */}
      {searchQuery ? (
        <>
          <div className={styles.searchResultsHeader}>
            <div>
              <h2 className={styles.searchResultsTitle}>
                Results for <span className={styles.redText}>&quot;{searchQuery}&quot;</span>
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
              <p>No results for <strong>&quot;{searchQuery}&quot;</strong></p>
              <p className={styles.noResultsSub}>Try different keywords or browse below.</p>
            </div>
          )}
        </>
      ) : (
        /* ── Normal home view ── */
        <>
          <HeroBanner />

          <section className={styles.section}>
            <div className={`${styles.sectionHeader} ${styles.staticIndicator}`}>
              <h2 className={styles.sectionTitle}>
                {selectedCategory === 'all' ? <>Live <span className={styles.redText}>Auctions</span></> : <><span className={styles.redText} style={{ textTransform: 'capitalize' }}>{selectedCategory}</span> Live</>}
              </h2>
            </div>
            <div className={styles.horizontalScroll}>
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

          <section className={styles.section}>
              <div className={`${styles.sectionHeader} ${styles.staticIndicator}`}>
                <h2 className={styles.sectionTitle}>
                  {selectedCategory === 'all'
                    ? <>Fixed Price <span className={styles.redText}>Sale</span></>
                    : <><span className={styles.redText} style={{ textTransform: 'capitalize' }}>{selectedCategory}</span> Fixed Price</>}
                </h2>
              </div>
              <div className={styles.horizontalScroll}>
                {fixedProducts.length > 0
                  ? fixedProducts.map(item => (
                      <ProductCard key={item.products_id} data={{
                        ...item,
                        title: item.name,
                        image: item.images?.[0]?.image_url,
                        wishlistCount: item.wishlist_count || 0,
                      }} />
                    ))
                  : <div className={styles.emptyState}>No fixed price items at the moment.</div>}
              </div>
            </section>
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
