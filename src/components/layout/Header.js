'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Search, AlignJustify, User, ShoppingCart, Home, Heart, MessageCircle, LogOut, LayoutDashboard, Package, Gavel, BarChart3, Settings, ClipboardList } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

import Logo from '@/components/Logo';
import { useNotifications } from '@/hooks/useNotifications';
import styles from './Header.module.css';

export default function Header() {
  const { user, logout } = useAuth();
  const { totalUnreadCount, unreadMsgCount } = useNotifications();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    router.push('/');
  };

  return (
    <div className={styles.headerContainer}>
      <div className={styles.topBar}></div>
      <header className={styles.mainHeader}>
        <div className={styles.leftSection}>
          <button
            className={styles.menuBtn}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <AlignJustify size={24} color="#666" />
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

        {/* Only show search bar for buyers, not sellers */}
        {user && user.role?.toLowerCase() === 'seller' ? null : (
          <div className={styles.searchSection}>
            <div className={styles.searchWrapper}>
              <Search size={20} className={styles.searchIcon} color="#333" />
              <input
                type="text"
                placeholder="Search essentials, groceries and more..."
                className={styles.searchInput}
              />
              <AlignJustify size={20} className={styles.filterIcon} style={{ transform: 'rotate(90deg)' }} />
            </div>
          </div>
        )}

        <div className={styles.rightSection}>
          {user && user.role?.toLowerCase() === 'seller' ? null : (
            <>
              <Link href="/orders" className={styles.navItem}>
                <ClipboardList size={20} className={styles.navIcon} color="#673AB7" />
                <span>Orders</span>
              </Link>
              <Link href="/cart" className={styles.navItem}>
                <ShoppingCart size={20} className={styles.cartIcon} color="#D32F2F" />
                <span>Cart</span>
              </Link>
            </>
          )}

          {user ? (
            <Link href="/settings" className={styles.navItem}>
              <Settings size={20} className={styles.navIcon} color="#FBC02D" />
              <span>Settings</span>
            </Link>
          ) : (
            <Link href="/" className={styles.navItem}>
              <User size={20} className={styles.navIcon} color="#FBC02D" />
              <span>Sign Up/Sign In</span>
            </Link>
          )}
        </div>

      </header >
    </div >
  );
}
