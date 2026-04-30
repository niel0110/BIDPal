'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, SlidersHorizontal, User, ShoppingCart, Home, Heart, MessageCircle, LogOut, LayoutDashboard, Package, Gavel, BarChart3, ClipboardList, AlignJustify, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

import Logo from '@/components/Logo';
import NotificationBell from '@/components/NotificationBell';
import { useNotifications } from '@/hooks/useNotifications';
import styles from './Header.module.css';

export default function Header() {
  const { user, logout } = useAuth();
  const { totalUnreadCount, unreadMsgCount } = useNotifications();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSort, setActiveSort] = useState('recent');
  const router = useRouter();
  const pathname = usePathname();
  const debounceRef = useRef(null);

  // Debounced progressive search — push URL after 350ms of no typing
  useEffect(() => {
    if (!pathname || pathname !== '/') return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = searchQuery.trim();
      if (q) {
        router.push(`/?q=${encodeURIComponent(q)}&sort=${activeSort}`, { scroll: false });
      } else {
        // No search query — keep URL clean
        router.replace('/', { scroll: false });
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery, activeSort, pathname]);

  const SORT_OPTIONS = [
    { id: 'recent',     label: 'Most Recent' },
    { id: 'price_asc',  label: 'Price: Low to High' },
    { id: 'price_desc', label: 'Price: High to Low' },
    { id: 'popular',    label: 'Most Popular' },
    { id: 'name_asc',   label: 'Name A–Z' },
  ];

  const applyFilter = (sortId) => {
    setActiveSort(sortId);
    setShowFilter(false);
    const q = searchQuery.trim();
    if (q) {
      router.push(`/?q=${encodeURIComponent(q)}&sort=${sortId}`);
    }
    // No search active — sort will apply when user next searches
  };

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (q) router.push(`/?q=${encodeURIComponent(q)}&sort=${activeSort}`);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    router.push('/');
  };

  return (
    <div className={styles.headerContainer}>
      <header className={styles.mainHeader}>
        <div className={styles.leftSection}>
          <button
            className={styles.menuBtn}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <AlignJustify size={20} color="#666" />
          </button>

          {isMenuOpen && (
            <div className={styles.dropdownMenu}>
              {(!user || user.role?.toLowerCase() !== 'seller') && (
                <>
                  <Link href="/" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.purple}`}>
                      <Home size={18} />
                    </div>
                    <span>Home</span>
                  </Link>
                  <Link href="/profile?tab=wishlist" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.red}`}>
                      <Heart size={18} />
                    </div>
                    <span>Wishlist</span>
                  </Link>
                  <Link href="/messages" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className={`${styles.iconCircle} ${styles.orange}`}>
                        <MessageCircle size={18} />
                      </div>
                      <span>Messages</span>
                    </div>
                    {totalUnreadCount > 0 && (
                        <span style={{ background: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                        </span>
                    )}
                  </Link>
                  <Link href="/profile" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.yellow}`}>
                      <User size={18} />
                    </div>
                    <span>My Account</span>
                  </Link>
                </>
              )}


              {user && user.role?.toLowerCase() === 'seller' && (
                <>
                  <Link href="/seller" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.purple}`}>
                      <LayoutDashboard size={18} />
                    </div>
                    <span>Dashboard</span>
                  </Link>
                  <Link href="/seller/auctions" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.red}`}>
                      <Gavel size={18} />
                    </div>
                    <span>My Auctions</span>
                  </Link>
                  <Link href="/messages" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className={`${styles.iconCircle} ${styles.orange}`}>
                        <MessageCircle size={18} />
                      </div>
                      <span>Messages</span>
                    </div>
                    {totalUnreadCount > 0 && (
                        <span style={{ background: '#ef4444', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>
                            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                        </span>
                    )}
                  </Link>
                  <Link href="/profile" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.yellow}`}>
                      <User size={18} />
                    </div>
                    <span>My Account</span>
                  </Link>
                </>
              )}


              {user && (
                <>
                  <div className={styles.menuDivider}>Account</div>
                  <button className={styles.dropdownItem} onClick={handleLogout}>
                    <div className={`${styles.iconCircle} ${styles.dark}`}>
                      <LogOut size={18} />
                    </div>
                    <span>Logout</span>
                  </button>
                </>
              )}


            </div>
          )}

          <Logo />
        </div>

        {/* Only show search bar on the buyer home page */}
        {(!user || user.role?.toLowerCase() !== 'seller') && pathname === '/' && (
          <div className={styles.searchSection} style={{ position: 'relative' }}>
            <div className={styles.searchWrapper}>
              <Search size={20} className={styles.searchIcon} color="#333" style={{ cursor: 'pointer' }} onClick={handleSearch} />
              <input
                type="text"
                placeholder="Search essentials, groceries and more..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
              />
              <SlidersHorizontal
                size={18}
                className={styles.filterIcon}
                onClick={() => setShowFilter(!showFilter)}
                style={{ cursor: 'pointer', color: showFilter ? '#D32F2F' : '#666' }}
              />
            </div>

            {showFilter && (
              <div className={styles.filterPanel}>
                <p className={styles.filterLabel}>Sort by</p>
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    className={`${styles.filterOption} ${activeSort === opt.id ? styles.filterOptionActive : ''}`}
                    onClick={() => applyFilter(opt.id)}
                  >
                    {opt.label}
                    {activeSort === opt.id && <span className={styles.filterCheck}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={styles.rightSection}>
          {(!user || user.role?.toLowerCase() !== 'seller') && pathname === '/' && (
            <button
              className={styles.mobileSearchToggle}
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
            >
              {isMobileSearchOpen ? <X size={20} /> : <Search size={20} />}
            </button>
          )}

          {user && user.role?.toLowerCase() === 'seller' ? null : (
            <>
              <Link href="/orders" className={styles.navItem}>
                <ClipboardList size={18} className={styles.navIcon} color="#673AB7" />
                <span>Orders</span>
              </Link>
              <Link href="/cart" className={styles.navItem}>
                <ShoppingCart size={18} className={styles.cartIcon} color="#D32F2F" />
                <span>Cart</span>
              </Link>
            </>
          )}

          {/* Orders link for sellers beside notifications */}
          {user && user.role?.toLowerCase() === 'seller' && (
            <Link href="/seller/orders" className={styles.navItem}>
              <ClipboardList size={18} className={styles.navIcon} color="#673AB7" />
              <span>Orders</span>
            </Link>
          )}

          {/* Notification Bell - Shows for all logged-in users */}
          {user && <NotificationBell />}

          {!user && (
            <Link href="/signin" className={styles.navItem}>
              <User size={18} className={styles.navIcon} color="#FBC02D" />
              <span>Sign Up/Sign In</span>
            </Link>
          )}
        </div>
      </header >

      {/* Mobile Search Bar Row */}
      {isMobileSearchOpen && (!user || user.role?.toLowerCase() !== 'seller') && pathname === '/' && (
        <div className={styles.mobileSearchRow}>
          <div className={styles.searchWrapper}>
            <Search size={18} color="#333" onClick={handleSearch} />
            <input
              type="text"
              placeholder="Search..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
            <SlidersHorizontal
              size={18}
              onClick={() => setShowFilter(!showFilter)}
              style={{ color: showFilter ? '#D32F2F' : '#666' }}
            />
          </div>
          {showFilter && (
            <div className={styles.mobileFilterPanel}>
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`${styles.filterOption} ${activeSort === opt.id ? styles.filterOptionActive : ''}`}
                  onClick={() => applyFilter(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div >
  );
}
