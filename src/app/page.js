'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import CategoryNav from '@/components/home/CategoryNav';
import HeroBanner from '@/components/home/HeroBanner';
import AuctionCard from '@/components/card/AuctionCard';
import Button from '@/components/ui/Button';
import AuthLogo from '@/components/AuthLogo';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import { ChevronRight } from 'lucide-react';
import styles from './page.module.css';


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
  
  const [allAuctions, setAllAuctions] = useState([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

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

  const [likedAuctionIds, setLikedAuctionIds] = useState(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        
        // Fetch auctions
        const auctionRes = await fetch(`${apiUrl}/api/auctions?limit=50`);
        const auctionJson = await auctionRes.json();
        const fetchedAuctions = auctionJson.data || [];

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
        console.error('Failed to fetch home content:', err);
      } finally {
        setLoadingContent(false);
      }
    };

    fetchData();
  }, [user?.user_id]);

  const handleScroll = (e) => {
    const element = e.target;
    const progress = element.scrollLeft / (element.scrollWidth - element.clientWidth);
    setScrollProgress(progress);
  };

  const filterByCategory = (items, field = 'category') => {
    if (selectedCategory === 'all') return items;
    return items.filter(item =>
      item[field]?.toLowerCase() === selectedCategory.toLowerCase()
    );
  };

  const auctions = filterByCategory(allAuctions);
  const liveAuctions = auctions.filter(a => a.status === 'active');
  const scheduledAuctions = auctions.filter(a => a.status === 'scheduled');


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

            {!isLogin && (
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
            )}

            <form onSubmit={isLogin ? handleSignIn : handleSignUp} className={styles.mainForm}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => {
                  console.log('Email changed:', e.target.value);
                  setEmail(e.target.value);
                }}
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
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
      <CategoryNav activeId={selectedCategory} onSelect={setSelectedCategory} />
      <HeroBanner />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {selectedCategory === 'all' ? <>Live <span className={styles.redText}>Auctions</span></> : <><span className={styles.redText} style={{ textTransform: 'capitalize' }}>{selectedCategory}</span> Live</>}
          </h2>
          <Link href="/live" className={styles.viewAll}>View all <ChevronRight size={16} /></Link>
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
          {liveAuctions.length > 0 ? (
            liveAuctions.map(item => (
              <AuctionCard key={item.id} data={item} />
            ))
          ) : (
            <div className={styles.emptyState}>No live auctions at the moment.</div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.sectionHeader} ${styles.staticIndicator}`}>
          <h2 className={styles.sectionTitle}>
            {selectedCategory === 'all' ? <>Scheduled <span className={styles.redText}>Auctions</span></> : <><span className={styles.redText} style={{ textTransform: 'capitalize' }}>{selectedCategory}</span> Scheduled</>}
          </h2>
          <Link href="/auctions" className={styles.viewAll}>View all <ChevronRight size={16} /></Link>
        </div>
        <div className={styles.horizontalScroll}>
          {scheduledAuctions.length > 0 ? (
            scheduledAuctions.map(item => (
              <AuctionCard key={item.id} data={item} />
            ))
          ) : (
            <div className={styles.emptyState}>No scheduled auctions at the moment.</div>
          )}
        </div>
      </section>
    </main>
  );
}
