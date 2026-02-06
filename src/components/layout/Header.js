'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, Search, AlignJustify, User, ShoppingCart, Home, Heart, MessageCircle, LogOut, LayoutDashboard, Package, Gavel, BarChart3, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

import Logo from '@/components/Logo';
import styles from './Header.module.css';

export default function Header() {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
    router.push('/');
  };

  // Close menu when clicking outside (simple implementation for now)
  // In a real app, use a click-outside hook

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
              {(!user || user.role !== 'seller') && (
                <>
                  <Link href="/" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.purple}`}>
                      <Home size={18} />
                    </div>
                    <span>Home</span>
                  </Link>
                  <Link href="/wishlist" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.red}`}>
                      <Heart size={18} />
                    </div>
                    <span>Wishlist</span>
                  </Link>
                  <Link href="/messages" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.orange}`}>
                      <MessageCircle size={18} />
                    </div>
                    <span>Messages</span>
                  </Link>
                  <Link href="/profile" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.yellow}`}>
                      <User size={18} />
                    </div>
                    <span>My Account</span>
                  </Link>
                </>
              )}


              {user && user.role === 'seller' && (
                <>
                  <Link href="/seller" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.red}`}>
                      <LayoutDashboard size={18} />
                    </div>
                    <span>Dashboard</span>
                  </Link>
                  <Link href="/seller/inventory" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.blue}`}>
                      <Package size={18} />
                    </div>
                    <span>Inventory</span>
                  </Link>
                  <Link href="/seller/auctions" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.orange}`}>
                      <Gavel size={18} />
                    </div>
                    <span>My Auctions</span>
                  </Link>
                  <Link href="/seller/analytics" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.green}`}>
                      <BarChart3 size={18} />
                    </div>
                    <span>Analytics</span>
                  </Link>
                  <Link href="/seller/settings" className={styles.dropdownItem} onClick={() => setIsMenuOpen(false)}>
                    <div className={`${styles.iconCircle} ${styles.dark}`}>
                      <Settings size={18} />
                    </div>
                    <span>Settings</span>
                  </Link>
                </>
              )}



              {user && (user.role !== 'seller') && (
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

        <div className={styles.searchSection}>
          <div className={styles.searchWrapper}>
            <Search size={20} className={styles.searchIcon} color="#333" />
            <input
              type="text"
              placeholder="Search essentials, groceries and more..."
              className={styles.searchInput}
            />
            <AlignJustify size={20} className={styles.filterIcon} style={{ transform: 'rotate(90deg)' }} /> {/* Using explicit rotate for list filter look */}
          </div>
        </div>

        <div className={styles.rightSection}>
          {user ? (
            <Link href="/profile" className={styles.navItem}>
              <User size={20} className={styles.navIcon} color="#FBC02D" />
              <span>My Account</span>
            </Link>
          ) : (
            <Link href="/" className={styles.navItem}>
              <User size={20} className={styles.navIcon} color="#FBC02D" />
              <span>Sign Up/Sign In</span>
            </Link>
          )}
          {user && user.role === 'seller' ? (
            <button onClick={handleLogout} className={styles.navItem} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              <LogOut size={20} className={styles.navIcon} color="#D32F2F" />
              <span>Logout</span>
            </button>
          ) : (
            <Link href="/cart" className={styles.navItem}>
              <ShoppingCart size={20} className={styles.cartIcon} color="#D32F2F" />
              <span>Cart</span>
            </Link>
          )}

        </div>

      </header>
    </div>
  );
}
