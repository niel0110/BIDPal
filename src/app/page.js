'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import CategoryNav from '@/components/home/CategoryNav';
import HeroBanner from '@/components/home/HeroBanner';
import AuctionCard from '@/components/card/AuctionCard';
import ProductCard from '@/components/card/ProductCard';
import Button from '@/components/ui/Button';
import AuthLogo from '@/components/AuthLogo';
import { useSubmitLock } from '@/hooks/useSubmitLock';
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
  const { user, loading, login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [selectedRole, setSelectedRole] = useState('buyer');
  const [showPassword, setShowPassword] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  
  const [auctions, setAuctions] = useState([]);
  const [deals, setDeals] = useState([]);
  const [clearance, setClearance] = useState([]);
  const [loadingContent, setLoadingContent] = useState(true);

  const { isSubmitting, runWithLock } = useSubmitLock();
  const router = useRouter();
  const redirectAfterAuth = useRef(null);

  useEffect(() => {
    if (!loading && user?.role?.toLowerCase() === 'seller') {
      const target = redirectAfterAuth.current || '/seller';
      redirectAfterAuth.current = null;
      router.replace(target);
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        
        // Fetch auctions
        const auctionRes = await fetch(`${apiUrl}/api/auctions?limit=10`);
        const auctionJson = await auctionRes.json();
        setAuctions(auctionJson.data || []);

        // Fetch weekly deals (just get some products for now)
        const productsRes = await fetch(`${apiUrl}/api/products?limit=8`);
        const productsJson = await productsRes.json();
        const allProducts = productsJson.data || [];
        
        // Split them for variety in the UI
        setDeals(allProducts.slice(0, 4));
        setClearance(allProducts.slice(4, 7));

      } catch (err) {
        console.error('Failed to fetch home content:', err);
      } finally {
        setLoadingContent(false);
      }
    };

    fetchData();
  }, []);

  const handleScroll = (e) => {
    const element = e.target;
    const progress = element.scrollLeft / (element.scrollWidth - element.clientWidth);
    setScrollProgress(progress);
  };


  const handleSignIn = async (e) => {
    e.preventDefault();
    await runWithLock(async () => {
      setError('');
      console.log('SignIn attempt:', { email, password });
      if (!email || !password) {
        setError('Email and password are required.');
        return;
      }
      console.log('Calling login with:', { email, password });
      const result = await login({ email, password });
      console.log('Login result:', result);
      if (!result.success) {
        setError(result.error);
        return;
      }
      console.log('Login successful, redirecting...');
      if (result.user?.role?.toLowerCase() === 'seller') {
        router.push('/seller');
      } else {
        router.push('/');
      }
    });
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    await runWithLock(async () => {
      setError('');

      console.log('SIGNUP FORM SUBMITTED');
      console.log('Email value:', email, 'Type:', typeof email, 'Length:', email?.length);
      console.log('Password value:', password, 'Type:', typeof password, 'Length:', password?.length);
      console.log('ConfirmPassword value:', confirmPassword, 'Type:', typeof confirmPassword, 'Length:', confirmPassword?.length);
      console.log('Which function am I calling?', typeof register);

      if (!email || !password || !confirmPassword) {
        console.log('VALIDATION FAILED: Missing fields');
        console.log('email exists?', !!email);
        console.log('password exists?', !!password);
        console.log('confirmPassword exists?', !!confirmPassword);
        setError('All fields are required.');
        return;
      }

      if (password !== confirmPassword) {
        console.log('VALIDATION FAILED: Passwords do not match');
        setError('Passwords do not match.');
        return;
      }

      console.log('Validation passed, calling register function now...');
      console.log('About to call register with:', { email, password });

      // Set redirect target before register so useEffect picks it up
      if (selectedRole === 'seller') {
        redirectAfterAuth.current = '/seller/setup';
      }

      try {
        const result = await register({ email, password, role: selectedRole });
        console.log('Register function returned:', result);

        if (!result.success) {
          console.log('Registration failed:', result.error);
          redirectAfterAuth.current = null;
          setError(result.error);
          return;
        }

        console.log('Registration successful!');
        // Sellers are redirected by the useEffect via redirectAfterAuth ref
        if (selectedRole !== 'seller') {
          router.push('/');
        }
      } catch (err) {
        console.error('ERROR during register:', err);
        setError(err.message);
      }
    });
  };

  const handleToggleAuth = () => {
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setShowPassword(false);
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authLeft}>
          <div className={styles.authLogo}>
            <AuthLogo />
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

            <form onSubmit={isLogin ? handleSignIn : handleSignUp} className={styles.mainForm}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                  console.log('Email changed:', e.target.value);
                  setEmail(e.target.value);
                }}
                style={{ width: '100%', padding: '10px', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <div style={{ marginTop: '1rem' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    console.log('Password changed:', e.target.value);
                    setPassword(e.target.value);
                  }}
                  style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                {isLogin && (
                  <Link href="/forgot-password" className={styles.forgotPassword}>
                    Forgot password?
                  </Link>
                )}
              </div>
              {!isLogin && (
                <div style={{ marginTop: '1rem' }}>
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => {
                      console.log('Confirm password changed:', e.target.value);
                      setConfirmPassword(e.target.value);
                    }}
                    style={{ width: '100%', padding: '10px', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
              )}
              {error && <div style={{ color: 'red', marginTop: 8, marginBottom: '1rem' }}>{error}</div>}

              <div className={styles.formFooter}>
                <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
                  {isSubmitting
                    ? (isLogin ? 'Signing In...' : 'Creating account...')
                    : (isLogin ? 'Sign In' : 'Create account')}
                </Button>
              </div>

              <div className={styles.otherOptions}>
                <p className={styles.dividerText}>or continue with</p>
                <div className={styles.socialButtons}>
                  <button type="button" className={styles.socialBtn}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </button>
                  <button type="button" className={styles.socialBtn}>
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </button>
                  <button type="button" className={styles.socialBtn}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                  </button>
                </div>
              </div>
              <button
                type="button"
                className={styles.toggleAuth}
                onClick={handleToggleAuth}
              >
                {isLogin ? (
                  <>
                    Don't have an account? <span className={styles.toggleLink}>Sign Up</span>
                  </>
                ) : (
                  <>
                    Already have an account? <span className={styles.toggleLink}>Sign In</span>
                  </>
                )}
              </button>
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
          {auctions.length > 0 ? (
            auctions.map(item => (
              <AuctionCard key={item.id} data={item} />
            ))
          ) : (
            <div className={styles.emptyState}>No ongoing auctions at the moment.</div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.sectionHeader} ${styles.staticIndicator}`}>
          <h2 className={styles.sectionTitle}>Weekly <span className={styles.redText}>Deals</span></h2>
          <div className={styles.viewAll}>View all <ChevronRight size={16} /></div>
        </div>
        <div className={styles.grid}>
          {deals.length > 0 ? (
            deals.map(item => (
              <ProductCard key={item.products_id} data={{
                ...item,
                title: item.name,
                image: item.images?.[0]?.image_url,
                wishlistCount: Math.floor(Math.random() * 200)
              }} />
            ))
          ) : (
            <div className={styles.emptyState}>Coming soon!</div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.sectionHeader} ${styles.staticIndicator}`}>
          <h2 className={styles.sectionTitle}>12.12 <span className={styles.redText}>Clearance Sale</span></h2>
          <div className={styles.viewAll}>View all <ChevronRight size={16} /></div>
        </div>
        <div className={styles.grid}>
          {clearance.length > 0 ? (
            clearance.map(item => (
              <ProductCard key={item.products_id} data={{
                ...item,
                title: item.name,
                image: item.images?.[0]?.image_url,
                wishlistCount: Math.floor(Math.random() * 200),
                badges: [{ text: '50% off', color: 'yellow' }]
              }} />
            ))
          ) : (
            <div className={styles.emptyState}>Coming soon!</div>
          )}
        </div>
      </section>
    </main>
  );
}
