'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import CategoryNav from '@/components/home/CategoryNav';
import HeroBanner from '@/components/home/HeroBanner';
import AuctionCard from '@/components/card/AuctionCard';
import ProductCard from '@/components/card/ProductCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Logo from '@/components/Logo';
import { ChevronRight } from 'lucide-react';
import styles from './page.module.css';

const auctionData = [
  { id: 1, title: 'Blackstride Classics', price: '1200', currentBid: '1700', seller: '@seller321', viewers: 98, timeLeft: '00h: 25m: 37s', isFollowing: true },
  { id: 2, title: 'Blue Nocturne Dress', price: '900', currentBid: '1400', seller: '@seller456', viewers: 76, timeLeft: '00h: 41m: 26s', isFollowing: false },
  { id: 3, title: 'CloudStride Sneakers', price: '500', currentBid: '1500', seller: '@seller789', viewers: 98, timeLeft: '03h: 42m: 51s', isFollowing: true },
  { id: 4, title: 'AmberSnap Purse', price: '1200', currentBid: '1700', seller: '@seller321', viewers: 99, timeLeft: '05h: 14m: 52s', isFollowing: false },
  { id: 5, title: 'Ivory Luxe Boots', price: '900', currentBid: '1400', seller: '@seller456', viewers: 76, timeLeft: '08h: 41m: 26s', isFollowing: false },
];

const weeklyDeals = [
  { id: 1, title: 'Chestnut Charm Backpack', price: '500', wishlistCount: 123, isSoldOut: true },
  { id: 2, title: 'PixelPast Analog Camera', price: '500', wishlistCount: 123, badges: [{ text: '32% OFF', color: 'yellow' }, { text: 'HOT', color: 'red' }], flashDate: 'December 1, 10:00 am' },
  { id: 3, title: 'Chestnut Charm Backpack', price: '500', wishlistCount: 123, isSoldOut: true },
  { id: 4, title: 'Chestnut Charm Backpack', price: '500', wishlistCount: 123, isSoldOut: true },
];

const clearanceSale = [
  { id: 1, title: 'Amethyst Gleam Earrings', price: '2500', wishlistCount: 131, badges: [{ text: '50% off', color: 'yellow' }] },
  { id: 2, title: 'BreezeStep Flats', price: '700', wishlistCount: 157, badges: [{ text: '50% off', color: 'yellow' }] },
  { id: 3, title: 'Ocean Breeze Sling', price: '500', wishlistCount: 104, badges: [{ text: '50% off', color: 'yellow' }] },
];

export default function Home() {
  const { user, login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [selectedRole, setSelectedRole] = useState('buyer');
  const [showPassword, setShowPassword] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const router = useRouter();

  const handleScroll = (e) => {
    const element = e.target;
    const progress = element.scrollLeft / (element.scrollWidth - element.clientWidth);
    setScrollProgress(progress);
  };

  useEffect(() => {
    if (user?.role === 'seller') {
      router.push('/seller');
    }
  }, [user, router]);

  const handleAuth = (e) => {
    e.preventDefault();
    console.log(`${isLogin ? 'Signing In' : 'Signing Up'} as`, selectedRole);
    login({ name: 'User', email: 'user@example.com', role: selectedRole });
    if (selectedRole === 'seller') {
      router.push('/seller');
    }
  };

  const EyeIcon = (
    <div onClick={() => setShowPassword(!showPassword)} style={{ cursor: 'pointer' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {showPassword ? (
          <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </>
        ) : (
          <>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </>
        )}
      </svg>
    </div>
  );

  if (!user) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authLeft}>
          <div className={styles.authLogo}>
            <Logo />
          </div>
        </div>
        <div className={styles.authRight}>
          <div className={styles.authFormWrapper}>
            <h1 className={styles.authTitle}>
              {isLogin ? 'Sign ' : 'Create '}
              <span className={styles.redText}>{isLogin ? 'In' : 'account'}</span>
            </h1>

            <div className={styles.roleGrid}>
              <div
                className={`${styles.roleOption} ${selectedRole === 'buyer' ? styles.roleActive : ''}`}
                onClick={() => setSelectedRole('buyer')}
              >
                <div className={styles.roleLabel}>Buyer</div>
                <div className={styles.roleSub}>I want to bid</div>
              </div>
              <div
                className={`${styles.roleOption} ${selectedRole === 'seller' ? styles.roleActive : ''}`}
                onClick={() => setSelectedRole('seller')}
              >
                <div className={styles.roleLabel}>Seller</div>
                <div className={styles.roleSub}>I want to sell</div>
              </div>
            </div>

            <form onSubmit={handleAuth} className={styles.mainForm}>
              <Input type="email" placeholder="Email address" />
              <div style={{ marginTop: '1rem' }}>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  icon={EyeIcon}
                />
              </div>
              {!isLogin && (
                <div style={{ marginTop: '1rem' }}>
                  <Input type="password" placeholder="Confirm password" />
                </div>
              )}

              <div className={styles.formFooter}>
                <Button type="submit" variant="primary" fullWidth>
                  {isLogin ? 'Sign In' : 'Create account'}
                </Button>
                <button
                  type="button"
                  className={styles.toggleAuth}
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className={styles.main}>
      <Header />
      <CategoryNav />
      <HeroBanner />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Ongoing <span className={styles.redText}>Auctions</span></h2>
          <div className={styles.viewAll}>View all <ChevronRight size={16} /></div>
          {/* Custom Scroll Indicator */}
          <div className={styles.scrollIndicator}>
            <div
              className={styles.scrollThumb}
              style={{
                left: `${scrollProgress * 100}%`,
                transform: `translateX(-${scrollProgress * 100}%)`
              }}
            />
          </div>
        </div>
        <div className={styles.horizontalScroll} onScroll={handleScroll}>
          {auctionData.map(item => (
            <AuctionCard key={item.id} data={item} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.sectionHeader} ${styles.staticIndicator}`}>
          <h2 className={styles.sectionTitle}>Weekly <span className={styles.redText}>Deals</span></h2>
          <div className={styles.viewAll}>View all <ChevronRight size={16} /></div>
        </div>
        <div className={styles.grid}>
          {weeklyDeals.map(item => (
            <ProductCard key={item.id} data={item} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.sectionHeader} ${styles.staticIndicator}`}>
          <h2 className={styles.sectionTitle}>12.12 <span className={styles.redText}>Clearance Sale</span></h2>
          <div className={styles.viewAll}>View all <ChevronRight size={16} /></div>
        </div>
        <div className={styles.grid}>
          {clearanceSale.map(item => (
            <ProductCard key={item.id} data={item} />
          ))}
        </div>
      </section>
    </main>
  );
}
