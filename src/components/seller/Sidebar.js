'use client';

import Link from 'next/link';
import { LayoutDashboard, Package, Gavel, BarChart3, Settings, LogOut, Store } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './Sidebar.module.css';


const navItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, href: '/seller' },
    { name: 'My Store', icon: <Store size={20} />, href: '/seller/store' },
    { name: 'Inventory', icon: <Package size={20} />, href: '/seller/inventory' },
    { name: 'My Auctions', icon: <Gavel size={20} />, href: '/seller/auctions' },
    { name: 'Analytics', icon: <BarChart3 size={20} />, href: '/seller/analytics' },
    { name: 'Settings', icon: <Settings size={20} />, href: '/seller/settings' },
];

export default function Sidebar() {
    const pathname = usePathname();

    const { logout } = useAuth();

    return (
        <aside className={styles.sidebar}>
            <nav className={styles.nav}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                        >
                            <span className={styles.icon}>{item.icon}</span>
                            <span className={styles.name}>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className={styles.footer}>
                <button className={styles.logoutBtn} onClick={() => logout()}>
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
}
