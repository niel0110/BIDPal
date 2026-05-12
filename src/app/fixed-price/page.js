'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import ProductCard from '@/components/card/ProductCard';
import CategoryNav from '@/components/home/CategoryNav';
import BIDPalLoader from '@/components/BIDPalLoader';
import styles from './page.module.css';

export default function FixedPricePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const fetchProducts = async (category = 'all') => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const catParam = category !== 'all' ? `&category=${encodeURIComponent(category)}` : '';
      
      // Fetch only sale type auctions
      const res = await fetch(`${apiUrl}/api/auctions?sale_type=sale&limit=100${catParam}`);
      if (res.ok) {
        const json = await res.json();
        const items = (json.data || []).map(a => ({
            products_id: a.products_id,
            name: a.title,
            price: a.price,
            images: a.images?.length ? a.images.map(url => ({ image_url: url })) : [],
            seller_name: a.seller,
            seller_avatar: a.seller_avatar,
            seller_id: a.seller_id,
            category: a.category,
            availability: a.availability,
            wishlist_count: a.wishlist_count || 0,
        }));
        setProducts(items);
      }
    } catch (err) {
      console.error('Failed to fetch fixed price products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(selectedCategory);
  }, []);

  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    fetchProducts(cat);
  };

  return (
    <main className={styles.main}>
      <Header />
      <CategoryNav activeId={selectedCategory} onSelect={handleCategorySelect} />

      <div className={styles.pageHeader}>
        <Link href="/" className={styles.backLink}>
          <ChevronLeft size={18} /> Back to Home
        </Link>
        <h1 className={styles.pageTitle}>
          Fixed Price <span className={styles.red}>Sale</span>
        </h1>
        <p className={styles.pageDesc}>Shop verified items at a fixed price and checkout instantly</p>
      </div>

      {loading ? (
        <div className={styles.loaderWrap}><BIDPalLoader size="section" /></div>
      ) : products.length === 0 ? (
        <div className={styles.empty}>
          <p>No fixed price items found{selectedCategory !== 'all' ? ` in ${selectedCategory}` : ''}.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {products.map(item => (
            <ProductCard 
                key={item.products_id} 
                data={{
                    ...item,
                    title: item.name,
                    image: item.images?.[0]?.image_url,
                    availability: item.availability,
                    wishlistCount: item.wishlist_count || 0,
                }} 
            />
          ))}
        </div>
      )}
    </main>
  );
}
