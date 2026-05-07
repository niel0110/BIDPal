'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, Suspense, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
    User,
    MapPin,
    ClipboardList,
    Bell,
    CreditCard,
    ShieldCheck,
    Lock,
    HelpCircle,
    UserPlus,
    ChevronRight,
    ArrowLeft,
    Camera,
    Calendar,
    Mail,
    Phone,
    ChevronDown,
    Plus,
    Pencil,
    Search,
    Facebook,
    Instagram,
    Globe,
    Settings,
    Heart,
    Truck,
    Zap,
    LogOut,
    X,
    TrendingUp,
    Store,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    ShoppingBag,
    Users,
    DollarSign,
    ChevronLeft,
    Trash2,
    AlertTriangle,
    CheckCircle,
    Shield,
    ShieldAlert,
    ShieldX,
    Ban,
    Clock,
    FileText,
    Copy,
    Share2,
    QrCode
} from 'lucide-react';
import styles from './page.module.css';
import BackButton from '@/components/BackButton';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGeolocation } from '@/hooks/useGeolocation';

const MapComponent = dynamic(() => import('@/components/map/MapComponent'), {
    ssr: false,
    loading: () => <div className={styles.loadingFallback}>Loading map...</div>
});

const STANDING_CFG = {
    clean:      { label: 'Good Standing',        color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', Icon: ShieldCheck },
    warned:     { label: 'Strike 1 — Warned',    color: '#b45309', bg: '#fffbeb', border: '#fde68a', Icon: Shield },
    restricted: { label: 'Strike 2 — Restricted',color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', Icon: ShieldAlert },
    suspended:  { label: 'Strike 3 — Suspended', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', Icon: ShieldX },
};

function StandingPill({ userId }) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const [cfg, setCfg] = useState(null);

    useEffect(() => {
        if (!userId) return;
        fetch(`${apiUrl}/api/violations/user/${userId}/record`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                const status = data?.account_status || 'clean';
                setCfg(STANDING_CFG[status] || STANDING_CFG.clean);
            })
            .catch(() => setCfg(STANDING_CFG.clean));
    }, [userId]);

    if (!cfg) return null;
    const { Icon } = cfg;
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 20, padding: '3px 10px', marginTop: '6px',
            fontSize: '0.72rem', fontWeight: 700, color: cfg.color,
        }}>
            <Icon size={12} color={cfg.color} />
            {cfg.label}
        </div>
    );
}

function AccountContent() {
    const { user, logout, updateUser } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const returnTo = searchParams.get('returnTo');
    const isSeller = user?.role?.toLowerCase() === 'seller';

    const [activeTab, setActiveTab] = useState(isSeller ? 'merchant-insights' : 'profile');
    const [addressState, setAddressState] = useState('list'); // 'list' or 'add'
    const [sellerAddressState, setSellerAddressState] = useState('list'); // 'list' or 'add'
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [avatarMessage, setAvatarMessage] = useState('');
    const [mobileView, setMobileView] = useState('menu'); // 'menu' | 'content'

    const handleNavClick = (tabId) => {
        setActiveTab(tabId);
        setMobileView('content');
    };

    useEffect(() => {
        const validTabs = ['profile', 'address', 'notifications', 'payment', 'wishlist', 'security', 'help', 'invite', 'merchant-insights', 'store-profile', 'pickup-address', 'account-standing'];
        if (tabParam && validTabs.includes(tabParam)) {
            setActiveTab(tabParam);
            setMobileView('content');
        }
    }, [tabParam]);

    const buyerMenuItems = [
        { id: 'profile', label: 'Edit Profile', icon: <User size={20} /> },
        { id: 'address', label: 'Address', icon: <MapPin size={20} /> },
        { id: 'notifications', label: 'Notification', icon: <Bell size={20} /> },
        { id: 'payment', label: 'Payment', icon: <CreditCard size={20} /> },
        { id: 'account-standing', label: 'Account Standing', icon: <Shield size={20} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={20} /> },
        { id: 'help', label: 'Help Center', icon: <HelpCircle size={20} /> },
        { id: 'invite', label: 'Invite Friends', icon: <UserPlus size={20} /> },
    ];

    const sellerMenuItems = [
        { id: 'merchant-insights', label: 'Merchant Insights', icon: <BarChart3 size={20} /> },
        { id: 'store-profile', label: 'Store Profile', icon: <Store size={20} /> },
        { id: 'profile', label: 'Personal Info', icon: <User size={20} /> },
        { id: 'pickup-address', label: 'Pickup Address', icon: <MapPin size={20} /> },
        { id: 'notifications', label: 'Notification', icon: <Bell size={20} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={20} /> },
        { id: 'help', label: 'Help Center', icon: <HelpCircle size={20} /> },
    ];

    const menuItems = isSeller ? sellerMenuItems : buyerMenuItems;

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        // Client-side validation
        if (file.size > 5 * 1024 * 1024) {
            setAvatarMessage({ type: 'error', text: 'Image must be under 5MB.' });
            return;
        }
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/jpg'].includes(file.type)) {
            setAvatarMessage({ type: 'error', text: 'Only JPG, PNG or GIF images allowed.' });
            return;
        }

        setAvatarLoading(true);
        setAvatarMessage('');

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${apiUrl}/api/users/${user.user_id}/avatar`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                setAvatarMessage({ type: 'error', text: data.error || 'Upload failed. Please try again.' });
                return;
            }

            // Update user state in context + localStorage without page reload
            updateUser({ Avatar: data.avatarUrl });
            setAvatarMessage({ type: 'success', text: '✓ Profile photo updated!' });
            setTimeout(() => setAvatarMessage(''), 3000);
        } catch (err) {
            setAvatarMessage({ type: 'error', text: 'Network error. Please try again.' });
            console.error('Avatar upload error:', err);
        } finally {
            setAvatarLoading(false);
            // Reset file input so the same file can be re-selected if needed
            e.target.value = '';
        }
    };

    const [sidebarName, setSidebarName] = useState('');
    const [kycStatus, setKycStatus] = useState(null);

    // Fetch the latest user name and kyc_status from the API so the sidebar is always up to date
    useEffect(() => {
        if (!user?.user_id) return;
        const cached = [user.Fname, user.Mname, user.Lname].filter(Boolean).join(' ');
        if (cached) setSidebarName(cached);
        if (user?.kyc_status) setKycStatus(user.kyc_status);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem('bidpal_token');
        fetch(`${apiUrl}/api/users/${user.user_id}`, {
            headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                const name = [data.Fname, data.Mname, data.Lname].filter(Boolean).join(' ');
                setSidebarName(name || data.email || '');
                setKycStatus(data.kyc_status || null);
            })
            .catch(() => { });
    }, [user?.user_id]);

    const getUserDisplayName = () => sidebarName || user?.email || '';

    const getUserRole = () => {
        if (!user) return '';
        return user.role?.toLowerCase() === 'seller' ? 'Seller' : 'Buyer';
    };

    const getAvatarImage = () => {
        if (user?.Avatar) {
            return user.Avatar;
        }
        const seed = user?.Fname || 'user';
        return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    };

    return (
        <div className={`${styles.container} ${mobileView === 'content' ? styles.mobileShowContent : ''}`}>
            {/* Sidebar / Menu */}
            {activeTab !== 'wishlist' && (
                <aside className={styles.sidebar}>
                    <div className={styles.globalBack}><BackButton /></div>

                    <div className={styles.userBrief}>
                        {avatarMessage && (
                            <div className={`${styles.avatarMessage} ${avatarMessage.type === 'error' ? styles.errorMessage : styles.successMessage}`}>
                                {avatarMessage.text}
                            </div>
                        )}

                        <div className={styles.avatarWrapper}>
                            <img
                                src={getAvatarImage()}
                                alt={getUserDisplayName()}
                                className={styles.avatar}
                            />
                            <input
                                type="file"
                                id="avatarInput"
                                className={styles.avatarFileInput}
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                disabled={avatarLoading}
                            />
                            <label
                                htmlFor="avatarInput"
                                className={`${styles.editAvatarLabel} ${avatarLoading ? styles.editAvatarDisabled : ''}`}
                                title="Upload profile picture"
                            >
                                <span className={styles.editAvatar}>
                                    <Camera size={14} />
                                </span>
                            </label>
                        </div>
                        <h2 className={styles.userName}>{getUserDisplayName()}</h2>
                        <p className={styles.userRole}>{getUserRole()} Member</p>
                        {!isSeller && <StandingPill userId={user?.user_id} />}

                        {isSeller && kycStatus === 'rejected' && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '20px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#b91c1c', cursor: 'pointer' }} onClick={() => router.push('/seller/setup')}>
                                <ShieldX size={13} color="#b91c1c" /> Verification Rejected — Re-submit
                            </div>
                        )}
                        {isSeller && kycStatus === 'pending' && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '20px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#b45309' }}>
                                <Clock size={13} color="#b45309" /> Verification Pending
                            </div>
                        )}
                        {isSeller && (kycStatus === 'approved' || kycStatus === null) && kycStatus === 'approved' && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700, color: '#15803d' }}>
                                <ShieldCheck size={13} color="#15803d" /> Verified Seller
                            </div>
                        )}
                    </div>

                    <nav className={styles.nav}>
                        {menuItems.map(item => (
                            <button
                                key={item.id}
                                className={`${styles.navItem} ${activeTab === item.id ? styles.activeNav : ''}`}
                                onClick={() => handleNavClick(item.id)}
                            >
                                <div className={styles.navIcon}>{item.icon}</div>
                                <span>{item.label}</span>
                                <ChevronRight size={16} className={styles.navArrow} />
                            </button>
                        ))}
                    </nav>

                </aside>
            )}

            {/* Main Content Area */}
            <main className={`${styles.content} ${activeTab === 'wishlist' ? styles.fullWidth : ''}`}>
                {/* Mobile back-to-menu button — hidden when inside address add/edit form or wishlist */}
                {!(activeTab === 'address' && addressState === 'add') && activeTab !== 'wishlist' && (
                    <button
                        className={styles.mobileMenuBack}
                        onClick={() => returnTo ? router.replace(returnTo) : setMobileView('menu')}
                    >
                        <span className={styles.mobileBackIcon}><ChevronLeft size={16} /></span>
                        <span>Back</span>
                    </button>
                )}

                {activeTab === 'profile' && <ProfileSection />}
                {activeTab === 'address' && <AddressSection state={addressState} setState={setAddressState} />}
                {activeTab === 'notifications' && <NotificationSection />}
                {activeTab === 'payment' && <PaymentSection />}
                {activeTab === 'wishlist' && <WishlistSection />}
                {activeTab === 'account-standing' && <AccountStandingSection />}
                {activeTab === 'security' && <SecuritySection />}
                {activeTab === 'help' && <HelpCenterSection />}
                {activeTab === 'invite' && <InviteSection />}

                {/* Seller Specific Sections */}
                {activeTab === 'merchant-insights' && <MerchantInsightsSection />}
                {activeTab === 'store-profile' && <StoreProfileSection />}
                {activeTab === 'pickup-address' && <SellerAddressSection state={sellerAddressState} setState={setSellerAddressState} />}
            </main>
        </div>
    );
}

function AccountStandingSection() {
    const { user } = useAuth();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.user_id) return;
        Promise.all([
            fetch(`${apiUrl}/api/violations/user/${user.user_id}/cancellation-limit`).then(r => r.ok ? r.json() : null),
            fetch(`${apiUrl}/api/violations/user/${user.user_id}/record`).then(r => r.ok ? r.json() : null),
        ]).then(([limit, record]) => {
            setData({ limit, record });
        }).catch(() => { }).finally(() => setLoading(false));
    }, [user]);

    const STATUS_CONFIG = {
        clean: { label: 'Good Standing', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', Icon: ShieldCheck },
        warned: { label: 'Strike 1 — Warned', color: '#b45309', bg: '#fffbeb', border: '#fde68a', Icon: Shield },
        restricted: { label: 'Strike 2 — Restricted', color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', Icon: ShieldAlert },
        suspended: { label: 'Strike 3 — Suspended', color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', Icon: ShieldX },
    };

    const status = data?.record?.account_status || 'clean';
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.clean;
    const StatusIcon = cfg.Icon;
    const strikes = data?.record?.strike_count || 0;
    const cancellationsThisWeek = data?.limit?.cancellationsThisWeek || 0;
    const remaining = data?.limit?.remainingCancellations ?? 3;
    const canCancel = data?.limit?.canCancel !== false;

    const STRIKE_STEPS = [
        { n: 1, Icon: Shield, color: '#b45309', bg: '#fffbeb', border: '#fde68a', title: 'Strike 1 — Warning', desc: 'A formal warning is issued. You can still bid and cancel within limits.' },
        { n: 2, Icon: ShieldAlert, color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', title: 'Strike 2 — Restricted', desc: 'Payment pre-authorization is required before placing any bids.' },
        { n: 3, Icon: ShieldX, color: '#b91c1c', bg: '#fef2f2', border: '#fecaca', title: 'Strike 3 — Suspended', desc: 'Your account is suspended and placed under moderation review.' },
    ];

    if (loading) return <div style={{ padding: '1.5rem', color: '#9ca3af', textAlign: 'center' }}>Loading…</div>;

    return (
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <header style={{ marginBottom: '0.9rem' }}>
                <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111', margin: 0 }}>Account Standing</h1>
                <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
                    Your anti-bogus status and weekly cancellation usage.
                </p>
            </header>

            {/* Status card */}
            <div style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 12, padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                <StatusIcon size={24} color={cfg.color} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', color: cfg.color }}>{cfg.label}</p>
                    <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: cfg.color, opacity: 0.85, lineHeight: 1.4 }}>
                        {status === 'clean' ? 'Your account is in good standing. Keep it up!' :
                            status === 'warned' ? 'You have received a warning. Avoid further cancellations.' :
                                status === 'restricted' ? 'Pre-authorization required before bidding.' :
                                    'Your account is under moderation review.'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    {[1, 2, 3].map(n => (
                        <div key={n} style={{ width: 9, height: 9, borderRadius: '50%', background: n <= strikes ? '#dc2626' : '#e5e7eb', boxShadow: n <= strikes ? '0 0 0 2px #fecaca' : 'none' }} />
                    ))}
                </div>
            </div>

            {/* Weekly cancellations */}
            <div style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '0.8rem 1rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Cancellations This Week</p>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: canCancel ? '#111' : '#dc2626' }}>{cancellationsThisWeek} / 3</span>
                </div>
                <div style={{ height: 6, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden', marginBottom: '0.45rem' }}>
                    <div style={{ height: '100%', width: `${Math.min((cancellationsThisWeek / 3) * 100, 100)}%`, background: cancellationsThisWeek >= 3 ? '#ef4444' : cancellationsThisWeek === 2 ? '#f59e0b' : '#673AB7', borderRadius: 6, transition: 'width 0.4s' }} />
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: canCancel ? '#6b7280' : '#dc2626', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {canCancel
                        ? <><ShieldCheck size={12} color="#673AB7" /> {remaining} cancellation{remaining !== 1 ? 's' : ''} remaining this week</>
                        : <><Ban size={12} color="#dc2626" /> Limit reached — next cancellation triggers a strike</>
                    }
                </p>
            </div>

            {/* Anti-bogus explanation */}
            <div style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '0.8rem 1rem', marginBottom: '0.75rem' }}>
                <p style={{ margin: '0 0 0.6rem', fontWeight: 700, fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px' }}>How the Anti-Bogus System Works</p>
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', color: '#374151', lineHeight: 1.55 }}>
                    BIDPal uses a <strong>three-strike system</strong> to keep auctions fair. You may cancel up to <strong>3 different orders per week</strong>. Each cancelled item counts as one cancellation — not each attempt.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {STRIKE_STEPS.map(({ n, Icon: SIcon, color, bg, border, title, desc }) => (
                        <div key={n} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', background: strikes >= n ? bg : '#fafafa', border: `1px solid ${strikes >= n ? border : '#e5e7eb'}`, borderRadius: 9, padding: '0.6rem 0.75rem' }}>
                            <SIcon size={15} color={strikes >= n ? color : '#9ca3af'} style={{ flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.78rem', color: strikes >= n ? color : '#374151' }}>{title}</p>
                                <p style={{ margin: '0.1rem 0 0', fontSize: '0.73rem', color: '#6b7280', lineHeight: 1.4 }}>{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reset info */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', padding: '0.6rem 0.85rem', background: '#f9f9f9', border: '1px solid #e5e7eb', borderRadius: 9 }}>
                <Clock size={13} color="#9ca3af" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: '0.73rem', color: '#6b7280', lineHeight: 1.5 }}>
                    Weekly count resets every 7 days.
                    {data?.limit?.weekResetDate && (
                        <> Next reset: <strong>{new Date(new Date(data.limit.weekResetDate).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></>
                    )}
                </p>
            </div>
        </div>
    );
}

export default function AccountPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AccountContent />
        </Suspense>
    );
}

function MerchantInsightsSection() {
    const { user } = useAuth();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const token = typeof window !== 'undefined' ? localStorage.getItem('bidpal_token') : null;

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        revenue: 0, itemsSold: 0, followers: 0,
        revenueByDay: Array(7).fill(0),
        thisWeek: 0, prevWeek: 0,
        thisMonthItems: 0, prevMonthItems: 0,
    });

    useEffect(() => {
        if (!user?.user_id) return;
        let cancelled = false;

        const load = async () => {
            try {
                const headers = { ...(token && { Authorization: `Bearer ${token}` }) };

                // Fetch seller profile (for seller_id)
                const sellerRes = await fetch(`${apiUrl}/api/sellers/user/${user.user_id}`, { headers });
                if (!sellerRes.ok) { setLoading(false); return; }
                const sellerData = await sellerRes.json();
                const seller_id = sellerData.seller_id;

                // Fetch seller detail (for follower count + rating)
                const detailRes = await fetch(`${apiUrl}/api/sellers/${seller_id}`, { headers });
                const detail = detailRes.ok ? await detailRes.json() : null;
                const followers = detail?.stats?.followerCount || 0;

                // Fetch seller orders
                const ordersRes = await fetch(`${apiUrl}/api/orders/seller/${seller_id}`, { headers });
                const orders = ordersRes.ok ? await ordersRes.json() : [];

                // Only count completed/delivered orders
                const done = orders.filter(o =>
                    o.status === 'completed' || o.status === 'delivered'
                );

                const now = new Date();
                const msPerDay = 1000 * 60 * 60 * 24;

                // Revenue by day — last 7 days (index 0 = 6 days ago, index 6 = today)
                const revenueByDay = Array(7).fill(0);
                let thisWeek = 0, prevWeek = 0;
                let thisMonthItems = 0, prevMonthItems = 0;

                done.forEach(o => {
                    const amount = o.total || o.total_amount || 0;
                    const date = new Date(o.placed_at || o.created_at);
                    const daysAgo = Math.floor((now - date) / msPerDay);
                    const monthsAgo = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());

                    if (daysAgo >= 0 && daysAgo < 7) { revenueByDay[6 - daysAgo] += amount; thisWeek += amount; thisMonthItems++; }
                    if (daysAgo >= 7 && daysAgo < 14) { prevWeek += amount; }
                    if (monthsAgo === 0) thisMonthItems++;
                    if (monthsAgo === 1) prevMonthItems++;
                });

                const totalRevenue = done.reduce((s, o) => s + (o.total || o.total_amount || 0), 0);

                if (!cancelled) {
                    setStats({ revenue: totalRevenue, itemsSold: done.length, followers, revenueByDay, thisWeek, prevWeek, thisMonthItems, prevMonthItems });
                    setLoading(false);
                }
            } catch (err) {
                console.error('Merchant insights error:', err);
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [user?.user_id]);

    const pct = (curr, prev) => {
        if (prev === 0 && curr === 0) return { label: '0%', pos: true };
        if (prev === 0) return { label: '+100%', pos: true };
        const v = ((curr - prev) / prev * 100).toFixed(1);
        return { label: `${v > 0 ? '+' : ''}${v}%`, pos: Number(v) >= 0 };
    };

    const revChange = pct(stats.thisWeek, stats.prevWeek);
    const itemChange = pct(stats.thisMonthItems, stats.prevMonthItems);

    const kpis = [
        { label: 'Total Revenue', value: `₱${stats.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, change: revChange.label, isPositive: revChange.pos, icon: <DollarSign size={24} />, color: 'purple' },
        { label: 'Items Sold', value: stats.itemsSold.toLocaleString(), change: itemChange.label, isPositive: itemChange.pos, icon: <ShoppingBag size={24} />, color: 'blue' },
        { label: 'Followers', value: stats.followers.toLocaleString(), change: '—', isPositive: true, icon: <Users size={24} />, color: 'orange' },
    ];

    const maxBar = Math.max(...stats.revenueByDay, 1);
    const dayLabels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
    });

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Merchant Insights</h1>
                <p>Overview of your store performance and business growth.</p>
            </header>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>Loading insights…</div>
            ) : (
                <>
                    <div className={styles.kpiGrid}>
                        {kpis.map((kpi, idx) => (
                            <div key={idx} className={styles.kpiCard}>
                                <div className={`${styles.iconBox} ${styles[kpi.color]}`}>
                                    {kpi.icon}
                                </div>
                                <div className={styles.kpiInfo}>
                                    <span className={styles.mLabel}>{kpi.label}</span>
                                    <h2 className={styles.mValue}>{kpi.value}</h2>
                                    <div className={`${styles.kpiChange} ${kpi.isPositive ? styles.positive : styles.negative}`}>
                                        {kpi.change !== '—' && (kpi.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
                                        <span>{kpi.change}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className={styles.chartMock}>
                        <h3>Revenue Growth <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#888' }}>— last 7 days</span></h3>
                        <div className={styles.barChart}>
                            {stats.revenueByDay.map((amount, i) => (
                                <div key={i} className={styles.barWrapper} title={`₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}>
                                    <div className={styles.bar} style={{ height: `${Math.max((amount / maxBar) * 100, amount > 0 ? 8 : 4)}%`, background: amount > 0 ? 'var(--accent-primary, #cc2b41)' : undefined }}></div>
                                    <span className={styles.barLabel}>{dayLabels[i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {stats.itemsSold === 0 ? (
                        <div className={styles.insightAlert}>
                            <Zap size={20} fill="#FBC02D" color="#FBC02D" />
                            <p>No completed orders yet. List your first product to start selling!</p>
                        </div>
                    ) : (
                        <div className={styles.insightAlert}>
                            <Zap size={20} fill="#FBC02D" color="#FBC02D" />
                            <p>You've sold <strong>{stats.itemsSold}</strong> item{stats.itemsSold !== 1 ? 's' : ''} with total revenue of <strong>₱{stats.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>. Keep it up!</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function StoreProfileSection() {
    const { user } = useAuth();
    const [seller, setSeller] = useState(null);
    const [storeName, setStoreName] = useState('');
    const [storeHandle, setStoreHandle] = useState('');
    const [storeDescription, setStoreDescription] = useState('');
    const [businessCategory, setBusinessCategory] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [bannerUrl, setBannerUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const [bannerUploading, setBannerUploading] = useState(false);
    const [message, setMessage] = useState('');
    const initialStoreRef = useRef(null);
    const logoInputRef = useRef(null);
    const bannerInputRef = useRef(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const token = typeof window !== 'undefined' ? localStorage.getItem('bidpal_token') : null;

    useEffect(() => {
        if (!user?.user_id) return;
        setLoading(true);
        fetch(`${apiUrl}/api/sellers/user/${user.user_id}`, {
            headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        })
            .then(r => r.json())
            .then(data => {
                if (data?.seller_id) {
                    setSeller(data);
                    const initialStore = {
                        storeName: data.store_name || '',
                        storeHandle: data.store_handle || '',
                        storeDescription: data.store_description || '',
                        businessCategory: data.business_category || '',
                    };
                    setStoreName(initialStore.storeName);
                    setStoreHandle(initialStore.storeHandle);
                    setStoreDescription(initialStore.storeDescription);
                    setBusinessCategory(initialStore.businessCategory);
                    setLogoUrl(data.logo_url || '');
                    setBannerUrl(data.banner_url || '');
                    initialStoreRef.current = initialStore;
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [user?.user_id]);

    const hasStoreChanges = (() => {
        const initial = initialStoreRef.current;
        if (!initial) return false;
        return (
            storeName !== initial.storeName ||
            storeHandle !== initial.storeHandle ||
            storeDescription !== initial.storeDescription ||
            businessCategory !== initial.businessCategory
        );
    })();

    const canSaveStore = Boolean(seller?.seller_id && hasStoreChanges && !saving);

    const handleSave = async () => {
        if (!canSaveStore) return;
        setSaving(true);
        setMessage('');
        try {
            const res = await fetch(`${apiUrl}/api/sellers/${seller.seller_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    store_name: storeName,
                    store_handle: storeHandle,
                    store_description: storeDescription,
                    business_category: businessCategory,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update store.');
            setSeller(data.data);
            initialStoreRef.current = { storeName, storeHandle, storeDescription, businessCategory };
            setMessage({ type: 'success', text: '✓ Store info updated successfully!' });
            setTimeout(() => setMessage(''), 4000);
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = async (e, type) => {
        const file = e.target.files?.[0];
        if (!file || !seller?.seller_id) return;
        const setUploading = type === 'logo' ? setLogoUploading : setBannerUploading;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append(type, file);
            const endpoint = type === 'logo'
                ? `/api/sellers/${seller.seller_id}/logo`
                : `/api/sellers/${seller.seller_id}/banner`;
            const res = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                body: formData,
            });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            if (type === 'logo') setLogoUrl(data.logoUrl || '');
            else setBannerUrl(data.bannerUrl || '');
        } catch {
            setMessage({ type: 'error', text: `Failed to upload ${type}. Please try again.` });
            setTimeout(() => setMessage(''), 4000);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleRemoveImage = async (type) => {
        if (!seller?.seller_id) return;
        const payload = type === 'logo' ? { logo_url: null } : { banner_url: null };
        try {
            const res = await fetch(`${apiUrl}/api/sellers/${seller.seller_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Remove failed');
            if (type === 'logo') setLogoUrl('');
            else setBannerUrl('');
        } catch {
            setMessage({ type: 'error', text: `Failed to remove ${type}.` });
            setTimeout(() => setMessage(''), 4000);
        }
    };

    if (loading) {
        return (
            <div className={styles.section}>
                <BIDPalLoader size="section" />
            </div>
        );
    }

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h1>Store Profile</h1>
                    <p>Public information visible to buyers on your store page.</p>
                </div>
                <Link href="/seller/store" className={styles.viewStoreBtn}>
                    <Store size={14} />
                    View My Store
                    <ArrowUpRight size={14} />
                </Link>
            </header>

            {message && (
                <div className={`${styles.messageBox} ${message.type === 'error' ? styles.errorMessage : styles.successMessage}`}>
                    {message.text}
                </div>
            )}

            {/* ── Banner ── */}
            <div className={styles.formGroup} style={{ marginBottom: '1.25rem' }}>
                <label className={styles.formLabel}>Store Banner</label>
                <div className={styles.bannerUploadArea}>
                    {bannerUrl ? (
                        <div className={styles.bannerPreviewWrap}>
                            <img src={bannerUrl} alt="Store banner" className={styles.bannerPreviewImg} />
                            <div className={styles.bannerOverlay}>
                                <button onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading} className={styles.bannerActionBtn}>
                                    <Camera size={14} />
                                    {bannerUploading ? 'Uploading…' : 'Change Banner'}
                                </button>
                                <button onClick={() => handleRemoveImage('banner')} className={`${styles.bannerActionBtn} ${styles.bannerRemoveBtn}`}>
                                    <X size={14} /> Remove
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => bannerInputRef.current?.click()} disabled={bannerUploading} className={styles.bannerUploadPlaceholder}>
                            <Camera size={22} color="#ccc" />
                            <span>{bannerUploading ? 'Uploading…' : 'Upload Store Banner'}</span>
                            <small>Recommended: 1200 × 300 px · JPG or PNG</small>
                        </button>
                    )}
                    <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(e, 'banner')} />
                </div>
            </div>

            {/* ── Logo ── */}
            <div className={styles.formGroup} style={{ marginBottom: '1.75rem' }}>
                <label className={styles.formLabel}>Store Logo</label>
                <div className={styles.logoUploadRow}>
                    <div className={styles.logoPreviewCircle}>
                        {logoUrl
                            ? <img src={logoUrl} alt="Store logo" className={styles.logoPreviewImg} />
                            : <Store size={26} color="#ccc" />
                        }
                    </div>
                    <div className={styles.logoUploadActions}>
                        <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading} className={styles.logoActionBtn}>
                            <Camera size={14} />
                            {logoUploading ? 'Uploading…' : logoUrl ? 'Change Logo' : 'Upload Logo'}
                        </button>
                        {logoUrl && (
                            <button onClick={() => handleRemoveImage('logo')} className={`${styles.logoActionBtn} ${styles.logoRemoveBtn}`}>
                                <X size={14} /> Remove
                            </button>
                        )}
                    </div>
                    <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageUpload(e, 'logo')} />
                </div>
            </div>

            {/* ── Text fields ── */}
            <div className={styles.storeInfoDivider}>Edit Store Info</div>

            <div className={styles.profileForm}>
                <div className={styles.formGrid2}>
                    <div className={styles.formGroup}>
                        <label>Store Name</label>
                        <div className={styles.inputWithIcon}>
                            <input
                                type="text"
                                value={storeName}
                                onChange={e => setStoreName(e.target.value)}
                                placeholder="e.g. Juan's Vintage Corner"
                            />
                            <Store size={17} style={{ position: 'absolute', right: '1.25rem', color: '#ccc', pointerEvents: 'none' }} />
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Store Handle</label>
                        <div className={styles.inputWithPrefix}>
                            <span className={styles.prefix}>bidpal.com/</span>
                            <input
                                type="text"
                                value={storeHandle}
                                onChange={e => setStoreHandle(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                placeholder="juansvintage"
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label>Business Category</label>
                    <div className={styles.selectWrapper}>
                        <select value={businessCategory} onChange={e => setBusinessCategory(e.target.value)}>
                            <option value="" disabled hidden>Select Category</option>
                            <option>Fashion &amp; Accessories</option>
                            <option>Gadgets &amp; Electronics</option>
                            <option>Collectibles &amp; Antiques</option>
                            <option>Home &amp; Living</option>
                            <option>Books &amp; Hobbies</option>
                            <option>Sports &amp; Outdoors</option>
                            <option>Art &amp; Crafts</option>
                            <option>Food &amp; Beverages</option>
                            <option>Others</option>
                        </select>
                        <ChevronDown size={18} color="#999" />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label>Store Description</label>
                    <textarea
                        rows={4}
                        value={storeDescription}
                        onChange={e => setStoreDescription(e.target.value)}
                        placeholder="Tell buyers what makes your store unique..."
                        className={styles.storeTextarea}
                    />
                    <p className={styles.helperText}>{storeDescription.length} / 500 characters</p>
                </div>

                <button
                    className={styles.primaryBtn}
                    onClick={handleSave}
                    disabled={!canSaveStore}
                >
                    {saving ? 'Saving...' : 'Save Store Info'}
                </button>
            </div>
        </div>
    );
}


function getAge(isoDate) {
    if (!isoDate) return 0;
    const today = new Date();
    const dob = new Date(isoDate);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

function getMaxDate(minAge) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - minAge);
    return d.toISOString().split('T')[0];
}

function toISODate(raw) {
    if (!raw) return '';
    if (raw.includes('T')) return raw.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // MM/DD/YYYY legacy format
    const [m, d, y] = raw.split('/');
    if (!m || !d || !y || y.length < 4) return '';
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function ProfileSection() {
    const { user, updateUser } = useAuth();
    const [firstName, setFirstName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [birthday, setBirthday] = useState(''); // YYYY-MM-DD
    const [gender, setGender] = useState('');
    const [bio, setBio] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const initRef = useRef(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    const seedForm = (data) => {
        const bday = toISODate(data.Birthday || '');
        setFirstName(data.Fname || '');
        setMiddleName(data.Mname || '');
        setLastName(data.Lname || '');
        setEmail(data.email || '');
        setPhone(data.contact_num || '');
        setBirthday(bday);
        setGender(data.Gender || '');
        setBio(data.Bio || '');
        return { firstName: data.Fname || '', middleName: data.Mname || '', lastName: data.Lname || '', phone: data.contact_num || '', birthday: bday, gender: data.Gender || '', bio: data.Bio || '' };
    };

    useEffect(() => {
        if (!user?.user_id) return;
        fetch(`${apiUrl}/api/users/${user.user_id}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                const init2 = seedForm(data);
                initRef.current = init2;
            })
            .catch(() => { });
    }, [user?.user_id]);

    const hasChanges = (() => {
        const init = initRef.current;
        if (!init) return false;
        return (
            firstName !== init.firstName ||
            middleName !== init.middleName ||
            lastName !== init.lastName ||
            phone !== init.phone ||
            birthday !== init.birthday ||
            gender !== init.gender ||
            bio !== init.bio
        );
    })();

    const ageErr = birthday ? getAge(birthday) < 18 : false;
    const canSave = hasChanges && !loading;

    const handleSaveProfile = async () => {
        if (!user || !canSave) return;
        setLoading(true);
        setMessage('');
        try {
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${apiUrl}/api/users/${user.user_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    Fname: firstName,
                    Mname: middleName,
                    Lname: lastName,
                    contact_num: phone,
                    Birthday: birthday || null,
                    Gender: gender || null,
                    Bio: bio || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error updating profile.');

            updateUser({ Fname: firstName, Mname: middleName, Lname: lastName, contact_num: phone, Birthday: birthday, Gender: gender, Bio: bio });
            initRef.current = { firstName, middleName, lastName, phone, birthday, gender, bio };

            setMessage({ type: 'success', text: '✓ Profile updated successfully!' });
            setTimeout(() => setMessage(''), 5000);
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Personal Information</h1>
                <p>Keep your account details up to date.</p>
            </header>

            {message && (
                <div className={`${styles.messageBox} ${message.type === 'error' ? styles.errorMessage : styles.successMessage}`}>
                    {message.text}
                </div>
            )}

            <div className={styles.profileForm}>
                {/* Name row — 3 columns */}
                <div className={styles.formGrid3}>
                    <div className={styles.formGroup}>
                        <label>First Name <span style={{ color: '#cc2b41' }}>*</span></label>
                        <input type="text" value={firstName} onChange={e => setFirstName(e.target.value.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s\-]/g, ''))} placeholder="Juan" />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Middle Name <span className={styles.optionalTag}>(Optional)</span></label>
                        <input type="text" value={middleName} onChange={e => setMiddleName(e.target.value.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s\-]/g, ''))} placeholder="Santos" />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Last Name <span style={{ color: '#cc2b41' }}>*</span></label>
                        <input type="text" value={lastName} onChange={e => setLastName(e.target.value.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s\-]/g, ''))} placeholder="Dela Cruz" />
                    </div>
                </div>

                {/* Contact row */}
                <div className={styles.formGrid2}>
                    <div className={styles.formGroup}>
                        <label>Email</label>
                        <div className={styles.readOnlyInputWrapper}>
                            <input type="email" value={email} disabled title="Email cannot be changed" />
                            <div className={styles.lockedIconWrapper}><Lock size={18} color="#ccc" /></div>
                        </div>
                        <p className={styles.helperText}>Email is used for sign-in and cannot be changed</p>
                    </div>
                    <div className={styles.formGroup}>
                        <label>Phone Number</label>
                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #eee', borderRadius: '14px', overflow: 'hidden', padding: '0 1.1rem', background: '#f5f5f5' }}>
                            <span style={{ color: '#555', fontWeight: 600, whiteSpace: 'nowrap', paddingRight: '8px', borderRight: '1px solid #eee' }}>09</span>
                            <input
                                type="tel"
                                placeholder="171234567"
                                maxLength={9}
                                value={phone ? phone.slice(2) : ''}
                                onChange={e => {
                                    const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 9);
                                    setPhone('09' + digits);
                                }}
                                style={{ border: 'none', outline: 'none', flex: 1, padding: '1.1rem 0 1.1rem 8px', fontFamily: 'inherit', fontSize: 'inherit', background: 'transparent' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Birthday + Gender row */}
                <div className={styles.formGrid2}>
                    <div className={styles.formGroup}>
                        <label>Birthday</label>
                        <input
                            type="date"
                            value={birthday}
                            max={getMaxDate(18)}
                            onChange={e => setBirthday(e.target.value)}
                            style={ageErr ? { borderColor: '#cc2b41', background: '#fff8f8' } : {}}
                        />
                        {ageErr && (
                            <span style={{ fontSize: '0.78rem', color: '#cc2b41', fontWeight: 600, marginTop: '-2px' }}>
                                You must be at least 18 years old.
                            </span>
                        )}
                    </div>
                    <div className={styles.formGroup}>
                        <label>Gender</label>
                        <div className={styles.selectWrapper}>
                            <select value={gender} onChange={e => setGender(e.target.value)}>
                                <option value="" disabled hidden>Select Gender</option>
                                <option>Male</option>
                                <option>Female</option>
                                <option>Non-binary</option>
                                <option>Prefer not to say</option>
                            </select>
                            <ChevronDown size={18} color="#999" />
                        </div>
                    </div>
                </div>

                {/* Bio */}
                <div className={styles.formGroup}>
                    <label>Bio <span className={styles.optionalTag}>(Optional)</span></label>
                    <textarea
                        rows={3}
                        value={bio}
                        onChange={e => setBio(e.target.value)}
                        placeholder="A short intro about yourself..."
                        className={styles.storeTextarea}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '0.5rem' }}>
                    <button
                        className={styles.primaryBtn}
                        onClick={handleSaveProfile}
                        disabled={!canSave}
                        style={{ flex: 1, marginTop: 0 }}
                    >
                        {loading ? 'Saving…' : 'Save Changes'}
                    </button>
                    {!hasChanges && !loading && (
                        <span style={{ fontSize: '0.78rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>No changes yet</span>
                    )}
                </div>
            </div>
        </div>
    );
}


function AddressSection({ state, setState }) {
    const { user } = useAuth();
    const [showMap, setShowMap] = useState(false);
    const [pinnedLocation, setPinnedLocation] = useState(null); // raw OSM data from map
    const emptyForm = {
        addressType: 'Home',
        Line1: '',
        Line2: '',
        household_blk_st: '',
        region: '',
        province: '',
        city: '',
        barangay: '',
        zip_code: '',
        isDefault: false
    };
    const [formData, setFormData] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [regions, setRegions] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [barangays, setBarangays] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [addresses, setAddresses] = useState([]);
    const [fetchingAddresses, setFetchingAddresses] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [settingDefaultId, setSettingDefaultId] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm }
    const { getCurrentLocation, location: geoLocation, error: geoError, loading: geoLoading } = useGeolocation();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    useEffect(() => {
        fetchRegions();
        if (state === 'list' && user?.user_id) {
            fetchUserAddresses();
        }
    }, [state, user?.user_id]);


    const fetchUserAddresses = async () => {
        if (!user?.user_id) return;
        setFetchingAddresses(true);
        try {
            const res = await fetch(`${apiUrl}/api/addresses/user/${user.user_id}`);
            if (!res.ok) { setAddresses([]); return; }
            const data = await res.json();
            setAddresses(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching addresses:', err);
            setAddresses([]);
        } finally {
            setFetchingAddresses(false);
        }
    };

    const fetchRegions = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/addresses/locations/regions`);
            if (!res.ok) return;
            const data = await res.json();
            setRegions(Array.isArray(data) ? data : []);
        } catch (err) { console.error('Error fetching regions:', err); }
    };

    const fetchProvinces = async (region) => {
        if (!region) { setProvinces([]); setCities([]); setBarangays([]); return; }
        try {
            const res = await fetch(`${apiUrl}/api/addresses/locations/provinces/${encodeURIComponent(region)}`);
            if (!res.ok) { setProvinces([]); return; }
            const data = await res.json();
            setProvinces(Array.isArray(data) ? data : []);
            setCities([]); setBarangays([]);
        } catch (err) { setProvinces([]); }
    };

    const fetchCities = async (region, province) => {
        if (!region || !province) { setCities([]); return; }
        try {
            const res = await fetch(`${apiUrl}/api/addresses/locations/cities/${encodeURIComponent(region)}/${encodeURIComponent(province)}`);
            if (!res.ok) { setCities([]); return; }
            const data = await res.json();
            setCities(Array.isArray(data) ? data : []);
            setBarangays([]);
        } catch (err) { setCities([]); }
    };

    const fetchBarangays = async (city) => {
        if (!city) { setBarangays([]); return; }
        try {
            const res = await fetch(`${apiUrl}/api/addresses/locations/barangays/${encodeURIComponent(city)}`);
            if (!res.ok) { setBarangays([]); return; }
            const data = await res.json();
            setBarangays(Array.isArray(data) ? data : []);
        } catch (err) { setBarangays([]); }
    };

    const handleRegionChange = (e) => {
        const region = e.target.value;
        setFormData(prev => ({ ...prev, region, province: '', city: '', barangay: '' }));
        fetchProvinces(region);
    };

    const handleProvinceChange = (e) => {
        const province = e.target.value;
        setFormData(prev => ({ ...prev, province, city: '', barangay: '' }));
        fetchCities(formData.region, province);
    };

    const handleCityChange = (e) => {
        const city = e.target.value;
        setFormData(prev => ({ ...prev, city, barangay: '' }));
        fetchBarangays(city);
    };

    const handleMapSelect = async (locationData) => {
        // Store the raw OSM location for display
        setPinnedLocation(locationData);

        // Always fill the street address (Line1) from the map
        const street = locationData.address || '';

        // Attempt to fuzzy-match OSM region string to our backend region list
        // OSM returns e.g. "Davao Region" – backend may store "Region XI (Davao Region)"
        const osmRegion = locationData.region || '';
        const osmProvince = locationData.province || '';
        const osmCity = locationData.city || '';
        const osmBarangay = locationData.barangay || '';

        // Try to find a matching backend region (substring match, case-insensitive)
        const matchedRegion = regions.find(
            r => osmRegion && (
                r.region?.toLowerCase().includes(osmRegion.toLowerCase()) ||
                osmRegion.toLowerCase().includes(r.region?.toLowerCase() || '') ||
                r.name?.toLowerCase().includes(osmRegion.toLowerCase()) ||
                osmRegion.toLowerCase().includes(r.name?.toLowerCase() || '')
            )
        );

        let resolvedRegion = matchedRegion?.region || '';
        let resolvedProvince = '';
        let resolvedCity = '';
        let resolvedBarangay = '';
        let fetchedProvinces = [];
        let fetchedCities = [];
        let fetchedBarangays = [];

        // If we matched a region, try to cascade down
        if (resolvedRegion) {
            try {
                const res = await fetch(`${apiUrl}/api/addresses/locations/provinces/${encodeURIComponent(resolvedRegion)}`);
                if (res.ok) {
                    const data = await res.json();
                    fetchedProvinces = Array.isArray(data) ? data : [];
                    setProvinces(fetchedProvinces);

                    // Fuzzy-match province
                    const matchedProv = fetchedProvinces.find(
                        p => osmProvince && (
                            p.toLowerCase().includes(osmProvince.toLowerCase()) ||
                            osmProvince.toLowerCase().includes(p.toLowerCase())
                        )
                    );
                    resolvedProvince = matchedProv || '';

                    if (resolvedProvince) {
                        const r2 = await fetch(`${apiUrl}/api/addresses/locations/cities/${encodeURIComponent(resolvedRegion)}/${encodeURIComponent(resolvedProvince)}`);
                        if (r2.ok) {
                            const d2 = await r2.json();
                            fetchedCities = Array.isArray(d2) ? d2 : [];
                            setCities(fetchedCities);

                            // Fuzzy-match city
                            const matchedCity = fetchedCities.find(
                                c => osmCity && (
                                    c.toLowerCase().includes(osmCity.toLowerCase()) ||
                                    osmCity.toLowerCase().includes(c.toLowerCase())
                                )
                            );
                            resolvedCity = matchedCity || '';

                            if (resolvedCity) {
                                const r3 = await fetch(`${apiUrl}/api/addresses/locations/barangays/${encodeURIComponent(resolvedCity)}`);
                                if (r3.ok) {
                                    const d3 = await r3.json();
                                    fetchedBarangays = Array.isArray(d3) ? d3 : [];
                                    setBarangays(fetchedBarangays);

                                    // Fuzzy-match barangay
                                    const matchedBrgy = fetchedBarangays.find(
                                        b => osmBarangay && (
                                            b.toLowerCase().includes(osmBarangay.toLowerCase()) ||
                                            osmBarangay.toLowerCase().includes(b.toLowerCase())
                                        )
                                    );
                                    resolvedBarangay = matchedBrgy || '';
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Error cascading location from map pin:', err);
            }
        }

        // Apply whatever we could resolve, fall back to OSM raw text for city/barangay
        setFormData(prev => ({
            ...prev,
            Line1: street,
            region: resolvedRegion,
            province: resolvedProvince,
            // If we couldn't match city/barangay to dropdown, keep OSM text as raw value
            city: resolvedCity || osmCity,
            barangay: resolvedBarangay || osmBarangay,
        }));

        setShowMap(false);
        setMessage({ type: 'success', text: '✓ Location pinned! Review and adjust the fields below.' });
        setTimeout(() => setMessage(''), 5000);
    };

    const buildPayload = (withUserId = true) => ({
        ...(withUserId && { user_id: user.user_id }),
        Line1: formData.Line1,
        Line2: formData.Line2 || null,
        household_blk_st: formData.household_blk_st || null,
        Barangay: formData.barangay || null,
        municipality_city: formData.city || null,
        region: formData.region || null,
        province: formData.province || null,
        zip_code: formData.zip_code || null,
        Country: 'Philippines',
        address_type: formData.addressType,
        is_default: formData.isDefault,
    });

    // CREATE
    const handleSaveAddress = async () => {
        if (!user) return;
        if (!formData.Line1) { setMessage({ type: 'error', text: 'Street address is required.' }); return; }
        if (!formData.city && !formData.barangay) { setMessage({ type: 'error', text: 'Please select a city or barangay.' }); return; }
        setLoading(true); setMessage('');
        try {
            const res = await fetch(`${apiUrl}/api/addresses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload(true))
            });
            const data = await res.json();
            if (!res.ok) { setMessage({ type: 'error', text: data.error || 'Error saving address.' }); return; }
            setMessage({ type: 'success', text: '✓ Address saved successfully!' });
            setTimeout(() => { setState('list'); setFormData(emptyForm); fetchUserAddresses(); }, 1200);
        } catch (err) {
            setMessage({ type: 'error', text: `Error: ${err.message}` });
        } finally { setLoading(false); }
    };

    // UPDATE
    const handleUpdateAddress = async () => {
        if (!user || !editingId) return;
        if (!formData.Line1) { setMessage({ type: 'error', text: 'Street address is required.' }); return; }
        setLoading(true); setMessage('');
        try {
            const res = await fetch(`${apiUrl}/api/addresses/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload(false))
            });
            const data = await res.json();
            if (!res.ok) { setMessage({ type: 'error', text: data.error || 'Error updating address.' }); return; }
            setMessage({ type: 'success', text: '✓ Address updated successfully!' });
            setTimeout(() => { setEditingId(null); setState('list'); setFormData(emptyForm); fetchUserAddresses(); }, 1200);
        } catch (err) {
            setMessage({ type: 'error', text: `Error: ${err.message}` });
        } finally { setLoading(false); }
    };

    // DELETE
    const handleDeleteAddress = (addressId) => {
        setConfirmDialog({
            title: 'Delete Address',
            message: 'Are you sure you want to delete this address? This action cannot be undone.',
            confirmLabel: 'Yes, Delete',
            onConfirm: async () => {
                setConfirmDialog(null);
                setDeletingId(addressId);
                try {
                    const res = await fetch(`${apiUrl}/api/addresses/${addressId}`, { method: 'DELETE' });
                    if (!res.ok) {
                        const d = await res.json();
                        setConfirmDialog({ title: 'Error', message: d.error || 'Failed to delete address.', isAlert: true });
                        return;
                    }
                    fetchUserAddresses();
                } catch (err) {
                    setConfirmDialog({ title: 'Error', message: err.message, isAlert: true });
                } finally { setDeletingId(null); }
            }
        });
    };

    // SET DEFAULT
    const handleSetDefault = async (addressId) => {
        setSettingDefaultId(addressId);
        try {
            const res = await fetch(`${apiUrl}/api/addresses/${addressId}/default`, { method: 'PATCH' });
            if (!res.ok) {
                const d = await res.json();
                setConfirmDialog({ title: 'Error', message: d.error || 'Failed to set default address.', isAlert: true });
                return;
            }
            fetchUserAddresses();
        } catch (err) {
            setConfirmDialog({ title: 'Error', message: err.message, isAlert: true });
        } finally { setSettingDefaultId(null); }
    };

    // UNSET DEFAULT
    const handleUnsetDefault = (addressId) => {
        setConfirmDialog({
            title: 'Remove Default',
            message: 'Remove the default designation from this address? You can always set a new default later.',
            confirmLabel: 'Yes, Remove',
            onConfirm: async () => {
                setConfirmDialog(null);
                setSettingDefaultId(addressId);
                try {
                    const res = await fetch(`${apiUrl}/api/addresses/${addressId}/unset-default`, { method: 'PATCH' });
                    if (!res.ok) {
                        const d = await res.json();
                        setConfirmDialog({ title: 'Error', message: d.error || 'Failed to remove default.', isAlert: true });
                        return;
                    }
                    fetchUserAddresses();
                } catch (err) {
                    setConfirmDialog({ title: 'Error', message: err.message, isAlert: true });
                } finally { setSettingDefaultId(null); }
            }
        });
    };

    // OPEN EDIT
    const openEdit = (addr) => {
        const region = addr.region || '';
        const province = addr.province || '';
        const city = addr['Municipality/City'] || '';
        const barangay = addr.Barangay || '';
        setFormData({
            addressType: addr.address_type || 'Home',
            Line1: addr.Line1 || '',
            Line2: addr.Line2 || '',
            household_blk_st: addr['Household/blk st.'] || '',
            region, province, city, barangay,
            zip_code: addr['zip code'] || '',
            isDefault: addr.is_default || false,
        });
        if (region) fetchProvinces(region);
        if (region && province) fetchCities(region, province);
        if (city) fetchBarangays(city);
        setEditingId(addr.address_id);
        setState('add');
    };

    if (state === 'add') {
        const isEditing = !!editingId;
        const formIsValid = formData.Line1 && (formData.city || formData.barangay);
        return (
            <>
                {/* ── Custom Confirm / Alert Dialog ── */}
                {confirmDialog && (
                    <div className={styles.dialogOverlay} onClick={() => !confirmDialog.onConfirm && setConfirmDialog(null)}>
                        <div className={styles.dialogCard} onClick={e => e.stopPropagation()}>
                            <div className={styles.dialogIcon}>
                                {confirmDialog.isAlert
                                    ? <AlertTriangle size={28} color="#f59e0b" />
                                    : <Trash2 size={28} color="#D32F2F" />
                                }
                            </div>
                            <h2 className={styles.dialogTitle}>{confirmDialog.title || 'Confirm'}</h2>
                            <p className={styles.dialogMessage}>{confirmDialog.message}</p>
                            <div className={styles.dialogActions}>
                                {!confirmDialog.isAlert && (
                                    <button
                                        className={styles.dialogCancelBtn}
                                        onClick={() => setConfirmDialog(null)}
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    className={confirmDialog.isAlert ? styles.dialogOkBtn : styles.dialogConfirmBtn}
                                    onClick={confirmDialog.onConfirm || (() => setConfirmDialog(null))}
                                >
                                    {confirmDialog.confirmLabel || (confirmDialog.isAlert ? 'OK' : 'Confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div className={styles.section}>
                    {showMap && (
                        <MapComponent onSelectLocation={handleMapSelect} onClose={() => setShowMap(false)} />
                    )}

                    <header className={styles.sectionHeader}>
                        <button className={styles.backBtn} onClick={() => { setState('list'); setEditingId(null); setFormData(emptyForm); setPinnedLocation(null); }}>
                            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /> Back
                        </button>
                        <h1>{isEditing ? 'Edit Address' : 'Add New Address'}</h1>
                        <p>{isEditing ? 'Update your delivery address details.' : 'Add a new delivery location.'}</p>
                    </header>

                    {message && (
                        <div className={`${styles.messageBox} ${message.type === 'error' ? styles.errorMessage : styles.successMessage}`}>
                            {message.text}
                        </div>
                    )}

                    <div className={styles.addressForm}>
                        {/* Address Label */}
                        <div className={styles.formGroup}>
                            <label>Address Label</label>
                            <div className={styles.selectWrapper}>
                                <select value={formData.addressType} onChange={(e) => setFormData(prev => ({ ...prev, addressType: e.target.value }))}>
                                    <option>Home</option>
                                    <option>Office</option>
                                    <option>Apartment</option>
                                    <option>Other</option>
                                </select>
                                <ChevronDown size={18} color="#999" />
                            </div>
                        </div>

                        {/* Map Pin Button + Pinned Location Banner */}
                        <button className={styles.geolocationBtn} onClick={() => setShowMap(true)} type="button">
                            <MapPin size={18} />
                            {pinnedLocation ? 'Change Map Pin' : 'Pin on Map (Optional)'}
                        </button>

                        {/* Show what the map detected — lets buyer see & correct if needed */}
                        {pinnedLocation && (
                            <div className={styles.pinnedBanner}>
                                <MapPin size={14} />
                                <div className={styles.pinnedDetails}>
                                    <span className={styles.pinnedTitle}>Map detected:</span>
                                    <span>
                                        {[pinnedLocation.address, pinnedLocation.barangay, pinnedLocation.city, pinnedLocation.province, pinnedLocation.region]
                                            .filter(Boolean).join(', ')}
                                    </span>
                                </div>
                                <button
                                    className={styles.clearPinBtn}
                                    onClick={() => {
                                        setPinnedLocation(null);
                                        setFormData(prev => ({ ...prev, Line1: '', city: '', barangay: '', region: '', province: '' }));
                                        setProvinces([]); setCities([]); setBarangays([]);
                                    }}
                                    title="Clear pin"
                                    type="button"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Region → Province → City → Barangay */}
                        <div className={styles.formGrid2}>
                            <div className={styles.formGroup}>
                                <label>Region</label>
                                <div className={styles.selectWrapper}>
                                    <select value={formData.region} onChange={handleRegionChange}>
                                        <option value="">Select Region</option>
                                        {regions.map((r, i) => <option key={i} value={r.region}>{r.name || r.region}</option>)}
                                    </select>
                                    <ChevronDown size={18} color="#999" />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Province</label>
                                <div className={styles.selectWrapper}>
                                    <select value={formData.province} onChange={handleProvinceChange} disabled={provinces.length === 0}>
                                        <option value="">Select Province</option>
                                        {provinces.map((p, i) => <option key={i} value={p}>{p}</option>)}
                                    </select>
                                    <ChevronDown size={18} color="#999" />
                                </div>
                            </div>
                        </div>

                        <div className={styles.formGrid2}>
                            <div className={styles.formGroup}>
                                <label>City / Municipality <span className={styles.optionalTag}>*</span></label>
                                {cities.length > 0 ? (
                                    <div className={styles.selectWrapper}>
                                        <select value={formData.city} onChange={handleCityChange}>
                                            <option value="">Select City</option>
                                            {cities.map((c, i) => <option key={i} value={c}>{c}</option>)}
                                        </select>
                                        <ChevronDown size={18} color="#999" />
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder={pinnedLocation ? `Detected: ${pinnedLocation.city || 'unknown'} — type to override` : 'Select a region first'}
                                        value={formData.city}
                                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                                    />
                                )}
                            </div>
                            <div className={styles.formGroup}>
                                <label>Barangay <span className={styles.optionalTag}>*</span></label>
                                {barangays.length > 0 ? (
                                    <div className={styles.selectWrapper}>
                                        <select
                                            value={formData.barangay}
                                            onChange={(e) => setFormData(prev => ({ ...prev, barangay: e.target.value }))}
                                        >
                                            <option value="">Select Barangay</option>
                                            {barangays.map((b, i) => <option key={i} value={b}>{b}</option>)}
                                        </select>
                                        <ChevronDown size={18} color="#999" />
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder={pinnedLocation ? `Detected: ${pinnedLocation.barangay || 'unknown'} — type to override` : 'Select a city first'}
                                        value={formData.barangay}
                                        onChange={(e) => setFormData(prev => ({ ...prev, barangay: e.target.value }))}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Street Line 1 */}
                        <div className={styles.formGroup}>
                            <label>Street Address <span className={styles.optionalTag}>*</span></label>
                            <input
                                type="text"
                                placeholder="e.g. 123 Rizal Street"
                                value={formData.Line1}
                                onChange={(e) => setFormData(prev => ({ ...prev, Line1: e.target.value }))}
                            />
                        </div>

                        {/* Blk/Lot + ZIP */}
                        <div className={styles.formGrid2}>
                            <div className={styles.formGroup}>
                                <label>House / Block / Lot <span className={styles.optionalTag}>(Optional)</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. Blk 4 Lot 12"
                                    value={formData.household_blk_st}
                                    onChange={(e) => setFormData(prev => ({ ...prev, household_blk_st: e.target.value }))}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>ZIP Code <span className={styles.optionalTag}>(Optional)</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. 1000"
                                    maxLength={4}
                                    value={formData.zip_code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value.replace(/\D/g, '') }))}
                                />
                            </div>
                        </div>

                        {/* Additional Details */}
                        <div className={styles.formGroup}>
                            <label>Additional Details <span className={styles.optionalTag}>(Optional)</span></label>
                            <textarea
                                placeholder="Apartment number, landmark, delivery instructions..."
                                value={formData.Line2}
                                onChange={(e) => setFormData(prev => ({ ...prev, Line2: e.target.value }))}
                                rows={3}
                                className={styles.storeTextarea}
                            />
                        </div>

                        {/* Default toggle */}
                        <div className={styles.checkboxGroup}>
                            <input
                                type="checkbox"
                                id="defaultAddr"
                                checked={formData.isDefault}
                                onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                            />
                            <label htmlFor="defaultAddr">Set as my default address</label>
                        </div>

                        {/* Actions */}
                        <div className={styles.buttonGroup}>
                            <button
                                className={styles.primaryBtn}
                                onClick={editingId ? handleUpdateAddress : handleSaveAddress}
                                disabled={loading || !formIsValid}
                            >
                                {loading ? 'Saving...' : editingId ? 'Update Address' : 'Save Address'}
                            </button>
                            <button
                                className={styles.secondaryBtn}
                                onClick={() => { setState('list'); setEditingId(null); setFormData(emptyForm); setPinnedLocation(null); }}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // LIST VIEW
    return (
        <>
            {/* ── Custom Confirm / Alert Dialog ── */}
            {confirmDialog && (
                <div className={styles.dialogOverlay} onClick={() => !confirmDialog.onConfirm && setConfirmDialog(null)}>
                    <div className={styles.dialogCard} onClick={e => e.stopPropagation()}>
                        <div className={styles.dialogIcon}>
                            {confirmDialog.isAlert
                                ? <AlertTriangle size={28} color="#f59e0b" />
                                : <Trash2 size={28} color="#D32F2F" />
                            }
                        </div>
                        <h2 className={styles.dialogTitle}>{confirmDialog.title || 'Confirm'}</h2>
                        <p className={styles.dialogMessage}>{confirmDialog.message}</p>
                        <div className={styles.dialogActions}>
                            {!confirmDialog.isAlert && (
                                <button
                                    className={styles.dialogCancelBtn}
                                    onClick={() => setConfirmDialog(null)}
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                className={confirmDialog.isAlert ? styles.dialogOkBtn : styles.dialogConfirmBtn}
                                onClick={confirmDialog.onConfirm || (() => setConfirmDialog(null))}
                            >
                                {confirmDialog.confirmLabel || (confirmDialog.isAlert ? 'OK' : 'Confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.section}>
                <header className={styles.sectionHeader}>
                    <h1>Addresses</h1>
                    <p>Manage your delivery locations for faster checkout.</p>
                </header>

                {fetchingAddresses ? (
                    <BIDPalLoader size="section" />
                ) : addresses.length === 0 ? (
                    <div className={styles.noResults}><p>No addresses saved yet.</p></div>
                ) : (
                    <div className={styles.addressList}>
                        {addresses.map((addr) => (
                            <div key={addr.address_id} className={`${styles.addressCard} ${addr.is_default ? styles.defaultAddressCard : ''}`}>
                                <div className={styles.addressIcon}>
                                    <MapPin size={24} color="white" />
                                </div>

                                <div className={styles.addressInfo}>
                                    <div className={styles.addressTypeLine}>
                                        <h3>{addr.address_type || 'Address'}</h3>
                                        {addr.is_default && <span className={styles.defaultBadge}>Default</span>}
                                    </div>
                                    <p>{addr.Line1}</p>
                                    {addr['Household/blk st.'] && (
                                        <p className={styles.addressSubtext}>{addr['Household/blk st.']}</p>
                                    )}
                                    {(addr.Barangay || addr['Municipality/City']) && (
                                        <p className={styles.addressSubtext}>
                                            {addr.Barangay && `${addr.Barangay}, `}
                                            {addr['Municipality/City']}
                                            {addr.province && `, ${addr.province}`}
                                            {addr['zip code'] && ` ${addr['zip code']}`}
                                        </p>
                                    )}
                                </div>

                                <div className={styles.addressActions}>
                                    {addr.is_default ? (
                                        <button
                                            className={styles.unsetDefaultBtn}
                                            onClick={() => handleUnsetDefault(addr.address_id)}
                                            disabled={settingDefaultId === addr.address_id}
                                            title="Click to remove default"
                                        >
                                            {settingDefaultId === addr.address_id ? '...' : '★ Default'}
                                        </button>
                                    ) : (
                                        <button
                                            className={styles.setDefaultBtn}
                                            onClick={() => handleSetDefault(addr.address_id)}
                                            disabled={settingDefaultId === addr.address_id}
                                            title="Set as default"
                                        >
                                            {settingDefaultId === addr.address_id ? '...' : 'Set Default'}
                                        </button>
                                    )}
                                    <button
                                        className={styles.editBtn}
                                        onClick={() => openEdit(addr)}
                                        title="Edit address"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={() => handleDeleteAddress(addr.address_id)}
                                        disabled={deletingId === addr.address_id}
                                        title="Delete address"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <button className={styles.addFullBtn} onClick={() => { setFormData(emptyForm); setEditingId(null); setPinnedLocation(null); setState('add'); }}>
                    <Plus size={20} /> Add New Address
                </button>
            </div>
        </>
    );
}

function SellerAddressSection({ state, setState }) {
    const { user } = useAuth();
    const [showMap, setShowMap] = useState(false);
    const [pinnedLocation, setPinnedLocation] = useState(null);
    const emptyForm = {
        Line1: '',
        Line2: '',
        household_blk_st: '',
        region: '',
        province: '',
        city: '',
        barangay: '',
        zip_code: '',
        isDefault: false
    };
    const [formData, setFormData] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null);
    const [regions, setRegions] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [barangays, setBarangays] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [addresses, setAddresses] = useState([]);
    const [fetchingAddresses, setFetchingAddresses] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [settingDefaultId, setSettingDefaultId] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    useEffect(() => {
        fetchRegions();
        if (state === 'list' && user?.user_id) {
            fetchUserAddresses();
        }
    }, [state, user?.user_id]);

    const fetchUserAddresses = async () => {
        if (!user?.user_id) return;
        setFetchingAddresses(true);
        try {
            const res = await fetch(`${apiUrl}/api/addresses/user/${user.user_id}`);
            if (!res.ok) { setAddresses([]); return; }
            const data = await res.json();
            const all = Array.isArray(data) ? data : [];
            setAddresses(all.filter(a => a.address_type === 'pickup'));
        } catch (err) {
            console.error('Error fetching addresses:', err);
            setAddresses([]);
        } finally {
            setFetchingAddresses(false);
        }
    };

    const fetchRegions = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/addresses/locations/regions`);
            if (!res.ok) return;
            const data = await res.json();
            setRegions(Array.isArray(data) ? data : []);
        } catch (err) { console.error('Error fetching regions:', err); }
    };

    const fetchProvinces = async (region) => {
        if (!region) { setProvinces([]); setCities([]); setBarangays([]); return; }
        try {
            const res = await fetch(`${apiUrl}/api/addresses/locations/provinces/${encodeURIComponent(region)}`);
            if (!res.ok) { setProvinces([]); return; }
            const data = await res.json();
            setProvinces(Array.isArray(data) ? data : []);
            setCities([]); setBarangays([]);
        } catch (err) { setProvinces([]); }
    };

    const fetchCities = async (region, province) => {
        if (!region || !province) { setCities([]); return; }
        try {
            const res = await fetch(`${apiUrl}/api/addresses/locations/cities/${encodeURIComponent(region)}/${encodeURIComponent(province)}`);
            if (!res.ok) { setCities([]); return; }
            const data = await res.json();
            setCities(Array.isArray(data) ? data : []);
            setBarangays([]);
        } catch (err) { setCities([]); }
    };

    const fetchBarangays = async (city) => {
        if (!city) { setBarangays([]); return; }
        try {
            const res = await fetch(`${apiUrl}/api/addresses/locations/barangays/${encodeURIComponent(city)}`);
            if (!res.ok) { setBarangays([]); return; }
            const data = await res.json();
            setBarangays(Array.isArray(data) ? data : []);
        } catch (err) { setBarangays([]); }
    };

    const handleRegionChange = (e) => {
        const region = e.target.value;
        setFormData(prev => ({ ...prev, region, province: '', city: '', barangay: '' }));
        fetchProvinces(region);
    };

    const handleProvinceChange = (e) => {
        const province = e.target.value;
        setFormData(prev => ({ ...prev, province, city: '', barangay: '' }));
        fetchCities(formData.region, province);
    };

    const handleCityChange = (e) => {
        const city = e.target.value;
        setFormData(prev => ({ ...prev, city, barangay: '' }));
        fetchBarangays(city);
    };

    const handleMapSelect = async (locationData) => {
        setPinnedLocation(locationData);
        const street = locationData.address || '';
        const osmRegion = locationData.region || '';
        const osmProvince = locationData.province || '';
        const osmCity = locationData.city || '';
        const osmBarangay = locationData.barangay || '';

        const matchedRegion = regions.find(
            r => osmRegion && (
                r.region?.toLowerCase().includes(osmRegion.toLowerCase()) ||
                osmRegion.toLowerCase().includes(r.region?.toLowerCase() || '') ||
                r.name?.toLowerCase().includes(osmRegion.toLowerCase()) ||
                osmRegion.toLowerCase().includes(r.name?.toLowerCase() || '')
            )
        );

        let resolvedRegion = matchedRegion?.region || '';
        let resolvedProvince = '';
        let resolvedCity = '';
        let resolvedBarangay = '';

        if (resolvedRegion) {
            try {
                const res = await fetch(`${apiUrl}/api/addresses/locations/provinces/${encodeURIComponent(resolvedRegion)}`);
                if (res.ok) {
                    const data = await res.json();
                    const fetchedProvinces = Array.isArray(data) ? data : [];
                    setProvinces(fetchedProvinces);
                    const matchedProv = fetchedProvinces.find(
                        p => osmProvince && (
                            p.toLowerCase().includes(osmProvince.toLowerCase()) ||
                            osmProvince.toLowerCase().includes(p.toLowerCase())
                        )
                    );
                    resolvedProvince = matchedProv || '';
                    if (resolvedProvince) {
                        const r2 = await fetch(`${apiUrl}/api/addresses/locations/cities/${encodeURIComponent(resolvedRegion)}/${encodeURIComponent(resolvedProvince)}`);
                        if (r2.ok) {
                            const d2 = await r2.json();
                            const fetchedCities = Array.isArray(d2) ? d2 : [];
                            setCities(fetchedCities);
                            const matchedCity = fetchedCities.find(
                                c => osmCity && (
                                    c.toLowerCase().includes(osmCity.toLowerCase()) ||
                                    osmCity.toLowerCase().includes(c.toLowerCase())
                                )
                            );
                            resolvedCity = matchedCity || '';
                            if (resolvedCity) {
                                const r3 = await fetch(`${apiUrl}/api/addresses/locations/barangays/${encodeURIComponent(resolvedCity)}`);
                                if (r3.ok) {
                                    const d3 = await r3.json();
                                    const fetchedBarangays = Array.isArray(d3) ? d3 : [];
                                    setBarangays(fetchedBarangays);
                                    const matchedBrgy = fetchedBarangays.find(
                                        b => osmBarangay && (
                                            b.toLowerCase().includes(osmBarangay.toLowerCase()) ||
                                            osmBarangay.toLowerCase().includes(b.toLowerCase())
                                        )
                                    );
                                    resolvedBarangay = matchedBrgy || '';
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Error cascading location from map pin:', err);
            }
        }

        setFormData(prev => ({
            ...prev,
            Line1: street,
            region: resolvedRegion,
            province: resolvedProvince,
            city: resolvedCity || osmCity,
            barangay: resolvedBarangay || osmBarangay,
        }));

        setShowMap(false);
        setMessage({ type: 'success', text: '✓ Location pinned! Review and adjust the fields below.' });
        setTimeout(() => setMessage(''), 5000);
    };

    const buildPayload = (withUserId = true) => ({
        ...(withUserId && { user_id: user.user_id }),
        Line1: formData.Line1,
        Line2: formData.Line2 || null,
        household_blk_st: formData.household_blk_st || null,
        Barangay: formData.barangay || null,
        municipality_city: formData.city || null,
        region: formData.region || null,
        province: formData.province || null,
        zip_code: formData.zip_code || null,
        Country: 'Philippines',
        address_type: 'pickup',
        is_default: formData.isDefault,
    });

    const handleSaveAddress = async () => {
        if (!user) return;
        if (!formData.Line1) { setMessage({ type: 'error', text: 'Street address is required.' }); return; }
        if (!formData.city && !formData.barangay) { setMessage({ type: 'error', text: 'Please select a city or barangay.' }); return; }
        setLoading(true); setMessage('');
        try {
            const res = await fetch(`${apiUrl}/api/addresses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload(true))
            });
            const data = await res.json();
            if (!res.ok) { setMessage({ type: 'error', text: data.error || 'Error saving address.' }); return; }
            setMessage({ type: 'success', text: '✓ Pickup address saved successfully!' });
            setTimeout(() => { setState('list'); setFormData(emptyForm); fetchUserAddresses(); }, 1200);
        } catch (err) {
            setMessage({ type: 'error', text: `Error: ${err.message}` });
        } finally { setLoading(false); }
    };

    const handleUpdateAddress = async () => {
        if (!user || !editingId) return;
        if (!formData.Line1) { setMessage({ type: 'error', text: 'Street address is required.' }); return; }
        setLoading(true); setMessage('');
        try {
            const res = await fetch(`${apiUrl}/api/addresses/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload(false))
            });
            const data = await res.json();
            if (!res.ok) { setMessage({ type: 'error', text: data.error || 'Error updating address.' }); return; }
            setMessage({ type: 'success', text: '✓ Pickup address updated successfully!' });
            setTimeout(() => { setEditingId(null); setState('list'); setFormData(emptyForm); fetchUserAddresses(); }, 1200);
        } catch (err) {
            setMessage({ type: 'error', text: `Error: ${err.message}` });
        } finally { setLoading(false); }
    };

    const handleDeleteAddress = (addressId) => {
        setConfirmDialog({
            title: 'Delete Pickup Address',
            message: 'Are you sure you want to delete this pickup address? This action cannot be undone.',
            confirmLabel: 'Yes, Delete',
            onConfirm: async () => {
                setConfirmDialog(null);
                setDeletingId(addressId);
                try {
                    const res = await fetch(`${apiUrl}/api/addresses/${addressId}`, { method: 'DELETE' });
                    if (!res.ok) {
                        const d = await res.json();
                        setConfirmDialog({ title: 'Error', message: d.error || 'Failed to delete address.', isAlert: true });
                        return;
                    }
                    fetchUserAddresses();
                } catch (err) {
                    setConfirmDialog({ title: 'Error', message: err.message, isAlert: true });
                } finally { setDeletingId(null); }
            }
        });
    };

    const handleSetDefault = async (addressId) => {
        setSettingDefaultId(addressId);
        try {
            const res = await fetch(`${apiUrl}/api/addresses/${addressId}/default`, { method: 'PATCH' });
            if (!res.ok) {
                const d = await res.json();
                setConfirmDialog({ title: 'Error', message: d.error || 'Failed to set default address.', isAlert: true });
                return;
            }
            fetchUserAddresses();
        } catch (err) {
            setConfirmDialog({ title: 'Error', message: err.message, isAlert: true });
        } finally { setSettingDefaultId(null); }
    };

    const handleUnsetDefault = (addressId) => {
        setConfirmDialog({
            title: 'Remove Default',
            message: 'Remove the default designation from this pickup address?',
            confirmLabel: 'Yes, Remove',
            onConfirm: async () => {
                setConfirmDialog(null);
                setSettingDefaultId(addressId);
                try {
                    const res = await fetch(`${apiUrl}/api/addresses/${addressId}/unset-default`, { method: 'PATCH' });
                    if (!res.ok) {
                        const d = await res.json();
                        setConfirmDialog({ title: 'Error', message: d.error || 'Failed to remove default.', isAlert: true });
                        return;
                    }
                    fetchUserAddresses();
                } catch (err) {
                    setConfirmDialog({ title: 'Error', message: err.message, isAlert: true });
                } finally { setSettingDefaultId(null); }
            }
        });
    };

    const openEdit = (addr) => {
        const region = addr.region || '';
        const province = addr.province || '';
        const city = addr['Municipality/City'] || '';
        const barangay = addr.Barangay || '';
        setFormData({
            Line1: addr.Line1 || '',
            Line2: addr.Line2 || '',
            household_blk_st: addr['Household/blk st.'] || '',
            region, province, city, barangay,
            zip_code: addr['zip code'] || '',
            isDefault: addr.is_default || false,
        });
        if (region) fetchProvinces(region);
        if (region && province) fetchCities(region, province);
        if (city) fetchBarangays(city);
        setEditingId(addr.address_id);
        setState('add');
    };

    const ConfirmDialogMarkup = () => confirmDialog ? (
        <div className={styles.dialogOverlay} onClick={() => !confirmDialog.onConfirm && setConfirmDialog(null)}>
            <div className={styles.dialogCard} onClick={e => e.stopPropagation()}>
                <div className={styles.dialogIcon}>
                    {confirmDialog.isAlert
                        ? <AlertTriangle size={26} color="#f59e0b" />
                        : <Trash2 size={26} color="#D32F2F" />
                    }
                </div>
                <h2 className={styles.dialogTitle}>{confirmDialog.title || 'Confirm'}</h2>
                <p className={styles.dialogMessage}>{confirmDialog.message}</p>
                <div className={styles.dialogActions}>
                    {!confirmDialog.isAlert && (
                        <button className={styles.dialogCancelBtn} onClick={() => setConfirmDialog(null)}>Cancel</button>
                    )}
                    <button
                        className={confirmDialog.isAlert ? styles.dialogOkBtn : styles.dialogConfirmBtn}
                        onClick={confirmDialog.onConfirm || (() => setConfirmDialog(null))}
                    >
                        {confirmDialog.confirmLabel || (confirmDialog.isAlert ? 'OK' : 'Confirm')}
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    if (state === 'add') {
        const isEditing = !!editingId;
        const formIsValid = formData.Line1 && (formData.city || formData.barangay);
        return (
            <>
                <ConfirmDialogMarkup />
                <div className={styles.section}>
                    {showMap && (
                        <MapComponent onSelectLocation={handleMapSelect} onClose={() => setShowMap(false)} />
                    )}
                    <header className={styles.sectionHeader}>
                        <button className={styles.backBtn} onClick={() => { setState('list'); setEditingId(null); setFormData(emptyForm); setPinnedLocation(null); }}>
                            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /> Back
                        </button>
                        <h1>{isEditing ? 'Edit Pickup Address' : 'Add Pickup Address'}</h1>
                        <p>{isEditing ? 'Update your store pickup/drop-off location.' : 'Add a new pickup location for your store.'}</p>
                    </header>

                    {message && (
                        <div className={`${styles.messageBox} ${message.type === 'error' ? styles.errorMessage : styles.successMessage}`}>
                            {message.text}
                        </div>
                    )}

                    <div className={styles.addressForm}>
                        <button className={styles.geolocationBtn} onClick={() => setShowMap(true)} type="button">
                            <MapPin size={18} />
                            {pinnedLocation ? 'Change Map Pin' : 'Pin on Map (Optional)'}
                        </button>

                        {pinnedLocation && (
                            <div className={styles.pinnedBanner}>
                                <MapPin size={14} />
                                <div className={styles.pinnedDetails}>
                                    <span className={styles.pinnedTitle}>Map detected:</span>
                                    <span>
                                        {[pinnedLocation.address, pinnedLocation.barangay, pinnedLocation.city, pinnedLocation.province, pinnedLocation.region]
                                            .filter(Boolean).join(', ')}
                                    </span>
                                </div>
                                <button
                                    className={styles.clearPinBtn}
                                    onClick={() => {
                                        setPinnedLocation(null);
                                        setFormData(prev => ({ ...prev, Line1: '', city: '', barangay: '', region: '', province: '' }));
                                        setProvinces([]); setCities([]); setBarangays([]);
                                    }}
                                    title="Clear pin"
                                    type="button"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        <div className={styles.formGrid2}>
                            <div className={styles.formGroup}>
                                <label>Region</label>
                                <div className={styles.selectWrapper}>
                                    <select value={formData.region} onChange={handleRegionChange}>
                                        <option value="">Select Region</option>
                                        {regions.map((r, i) => <option key={i} value={r.region}>{r.name || r.region}</option>)}
                                    </select>
                                    <ChevronDown size={18} color="#999" />
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Province</label>
                                <div className={styles.selectWrapper}>
                                    <select value={formData.province} onChange={handleProvinceChange} disabled={provinces.length === 0}>
                                        <option value="">Select Province</option>
                                        {provinces.map((p, i) => <option key={i} value={p}>{p}</option>)}
                                    </select>
                                    <ChevronDown size={18} color="#999" />
                                </div>
                            </div>
                        </div>

                        <div className={styles.formGrid2}>
                            <div className={styles.formGroup}>
                                <label>City / Municipality <span className={styles.optionalTag}>*</span></label>
                                {cities.length > 0 ? (
                                    <div className={styles.selectWrapper}>
                                        <select value={formData.city} onChange={handleCityChange}>
                                            <option value="">Select City</option>
                                            {cities.map((c, i) => <option key={i} value={c}>{c}</option>)}
                                        </select>
                                        <ChevronDown size={18} color="#999" />
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder={pinnedLocation ? `Detected: ${pinnedLocation.city || 'unknown'} — type to override` : 'Select a region first'}
                                        value={formData.city}
                                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                                    />
                                )}
                            </div>
                            <div className={styles.formGroup}>
                                <label>Barangay <span className={styles.optionalTag}>*</span></label>
                                {barangays.length > 0 ? (
                                    <div className={styles.selectWrapper}>
                                        <select value={formData.barangay} onChange={(e) => setFormData(prev => ({ ...prev, barangay: e.target.value }))}>
                                            <option value="">Select Barangay</option>
                                            {barangays.map((b, i) => <option key={i} value={b}>{b}</option>)}
                                        </select>
                                        <ChevronDown size={18} color="#999" />
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder={pinnedLocation ? `Detected: ${pinnedLocation.barangay || 'unknown'} — type to override` : 'Select a city first'}
                                        value={formData.barangay}
                                        onChange={(e) => setFormData(prev => ({ ...prev, barangay: e.target.value }))}
                                    />
                                )}
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Street Address <span className={styles.optionalTag}>*</span></label>
                            <input
                                type="text"
                                placeholder="e.g. 123 Rizal Street"
                                value={formData.Line1}
                                onChange={(e) => setFormData(prev => ({ ...prev, Line1: e.target.value }))}
                            />
                        </div>

                        <div className={styles.formGrid2}>
                            <div className={styles.formGroup}>
                                <label>House / Block / Lot <span className={styles.optionalTag}>(Optional)</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. Blk 4 Lot 12"
                                    value={formData.household_blk_st}
                                    onChange={(e) => setFormData(prev => ({ ...prev, household_blk_st: e.target.value }))}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>ZIP Code <span className={styles.optionalTag}>(Optional)</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. 1000"
                                    maxLength={4}
                                    value={formData.zip_code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value.replace(/\D/g, '') }))}
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Additional Details <span className={styles.optionalTag}>(Optional)</span></label>
                            <textarea
                                placeholder="Landmark, directions, or other notes for buyers..."
                                value={formData.Line2}
                                onChange={(e) => setFormData(prev => ({ ...prev, Line2: e.target.value }))}
                                rows={3}
                                className={styles.storeTextarea}
                            />
                        </div>

                        <div className={styles.checkboxGroup}>
                            <input
                                type="checkbox"
                                id="defaultPickup"
                                checked={formData.isDefault}
                                onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                            />
                            <label htmlFor="defaultPickup">Set as default pickup address</label>
                        </div>

                        <div className={styles.buttonGroup}>
                            <button
                                className={styles.primaryBtn}
                                onClick={editingId ? handleUpdateAddress : handleSaveAddress}
                                disabled={loading || !formIsValid}
                            >
                                {loading ? 'Saving...' : editingId ? 'Update Address' : 'Save Address'}
                            </button>
                            <button
                                className={styles.secondaryBtn}
                                onClick={() => { setState('list'); setEditingId(null); setFormData(emptyForm); setPinnedLocation(null); }}
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // LIST VIEW
    return (
        <>
            <ConfirmDialogMarkup />
            <div className={styles.section}>
                <header className={styles.sectionHeader}>
                    <h1>Pickup Address</h1>
                    <p>Manage your store pickup and drop-off locations.</p>
                </header>

                {fetchingAddresses ? (
                    <BIDPalLoader size="section" />
                ) : addresses.length === 0 ? (
                    <div className={styles.noResults}><p>No pickup address saved yet.</p></div>
                ) : (
                    <div className={styles.addressList}>
                        {addresses.map((addr) => (
                            <div key={addr.address_id} className={`${styles.addressCard} ${addr.is_default ? styles.defaultAddressCard : ''}`}>
                                <div className={styles.addressIcon}>
                                    <MapPin size={24} color="white" />
                                </div>
                                <div className={styles.addressInfo}>
                                    <div className={styles.addressTypeLine}>
                                        <h3>Pickup</h3>
                                        {addr.is_default && <span className={styles.defaultBadge}>Default</span>}
                                    </div>
                                    <p>{addr.Line1}</p>
                                    {addr['Household/blk st.'] && (
                                        <p className={styles.addressSubtext}>{addr['Household/blk st.']}</p>
                                    )}
                                    {(addr.Barangay || addr['Municipality/City']) && (
                                        <p className={styles.addressSubtext}>
                                            {addr.Barangay && `${addr.Barangay}, `}
                                            {addr['Municipality/City']}
                                            {addr.province && `, ${addr.province}`}
                                            {addr['zip code'] && ` ${addr['zip code']}`}
                                        </p>
                                    )}
                                </div>
                                <div className={styles.addressActions}>
                                    {addr.is_default ? (
                                        <button
                                            className={styles.unsetDefaultBtn}
                                            onClick={() => handleUnsetDefault(addr.address_id)}
                                            disabled={settingDefaultId === addr.address_id}
                                            title="Click to remove default"
                                        >
                                            {settingDefaultId === addr.address_id ? '...' : '★ Default'}
                                        </button>
                                    ) : (
                                        <button
                                            className={styles.setDefaultBtn}
                                            onClick={() => handleSetDefault(addr.address_id)}
                                            disabled={settingDefaultId === addr.address_id}
                                            title="Set as default"
                                        >
                                            {settingDefaultId === addr.address_id ? '...' : 'Set Default'}
                                        </button>
                                    )}
                                    <button
                                        className={styles.editBtn}
                                        onClick={() => openEdit(addr)}
                                        title="Edit address"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={() => handleDeleteAddress(addr.address_id)}
                                        disabled={deletingId === addr.address_id}
                                        title="Delete address"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <button className={styles.addFullBtn} onClick={() => { setFormData(emptyForm); setEditingId(null); setPinnedLocation(null); setState('add'); }}>
                    <Plus size={20} /> Add Pickup Address
                </button>
            </div>
        </>
    );
}

function NotificationSection() {
    const settings = [
        { label: 'General Notification', enabled: true },
        { label: 'Special Offers', enabled: true },
        { label: 'Payments', enabled: true },
        { label: 'App Updates', enabled: true },
    ];

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Notifications</h1>
                <p>Choose what updates you want to receive.</p>
            </header>

            <div className={styles.toggleList}>
                {settings.map((s, i) => (
                    <div key={i} className={styles.toggleItem}>
                        <span>{s.label}</span>
                        <label className={styles.switch}>
                            <input type="checkbox" defaultChecked={s.enabled} />
                            <span className={styles.slider}></span>
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PaymentSection() {
    const methods = [
        { name: 'Paypal', status: 'Connected', icon: <img src="https://cdn-icons-png.flaticon.com/512/174/174861.png" alt="Paypal" width="24" /> },
        { name: 'Mastercard', status: 'Connected', icon: <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" width="24" />, detail: '**** **** **** 1234' },
    ];

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Payment</h1>
                <p>Securely manage your saved payment methods.</p>
            </header>

            <div className={styles.paymentList}>
                {methods.map((m, i) => (
                    <div key={i} className={styles.paymentCard}>
                        <div className={styles.paymentBrand}>
                            {m.icon}
                            <div className={styles.paymentMeta}>
                                <span className={styles.paymentName}>{m.name}</span>
                                {m.detail && <span className={styles.paymentDetail}>{m.detail}</span>}
                            </div>
                        </div>
                        <span className={styles.connectionStatus}>{m.status}</span>
                    </div>
                ))}
            </div>

            <button className={styles.addFullBtn}>
                <Plus size={20} /> Add New Card
            </button>
        </div>
    );
}

function SecuritySection() {
    const toggles = [
        { label: 'Two-Factor Authentication', enabled: true },
        { label: 'Biometric Login', enabled: false },
    ];

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Security</h1>
                <p>Keep your account protected with extra security layers.</p>
            </header>

            <div className={styles.toggleList}>
                {toggles.map((t, i) => (
                    <div key={i} className={styles.toggleItem}>
                        <span>{t.label}</span>
                        <label className={styles.switch}>
                            <input type="checkbox" defaultChecked={t.enabled} />
                            <span className={styles.slider}></span>
                        </label>
                    </div>
                ))}
            </div>

            <div className={styles.buttonStack}>
                <button className={styles.secondaryBtnLarge}>Update Password</button>
            </div>
        </div>
    );
}

function HelpCenterSection() {
    const [activePanel, setActivePanel] = useState(null); // 'privacy' | 'terms' | 'faq' | null
    const router = useRouter();

    const helpItems = [
        { id: 'privacy', label: 'Privacy Policy', icon: <Lock size={20} /> },
        { id: 'terms', label: 'Terms & Agreements', icon: <FileText size={20} /> },
        { id: 'faq', label: 'FAQs', icon: <HelpCircle size={20} /> },
        { id: 'email', label: 'Email Support', detail: 'support@bidpal.shop', icon: <Mail size={20} /> },
    ];

    const faqItems = [
        {
            q: 'How do I place a bid?',
            a: 'Navigate to an active auction, enter a bid amount higher than the current highest bid, and confirm. All bids are binding once placed.'
        },
        {
            q: 'How do I know if I won an auction?',
            a: 'You will receive an in-app notification and email when the auction ends confirming your win. Check your order history for next steps.'
        },
        {
            q: 'Can I cancel a bid?',
            a: 'Bids are binding and cannot be cancelled once submitted. Please review your bid amount carefully before confirming.'
        },
        {
            q: 'What payment methods are accepted?',
            a: 'BIDPal accepts major credit and debit cards, processed securely through our third-party payment gateway partners.'
        },
        {
            q: 'How do I track my order?',
            a: 'Go to your profile and view your Purchase History. Each order shows its current shipping status and tracking information.'
        },
        {
            q: 'What is the return or refund policy?',
            a: 'Returns are subject to each seller\'s individual policy. For disputes, contact the seller directly via in-app chat or reach out to BIDPal support.'
        },
        {
            q: 'How do I start selling on BIDPal?',
            a: 'Register as a Seller, complete identity verification using a valid Philippine government ID, set up your store profile, and start listing items.'
        },
        {
            q: 'How does live auction streaming work?',
            a: 'Sellers can broadcast live auctions using BIDPal\'s built-in streaming feature. Buyers can watch and place bids in real time during the broadcast.'
        },
        {
            q: 'How do I contact BIDPal support?',
            a: 'You can email BIDPal support at support@bidpal.shop. Include your account email, order or auction ID if applicable, and a short description of the issue.'
        },
        {
            q: 'How do I delete my account?',
            a: 'Go to Profile > Security and submit an account deletion request. Your personal data will be permanently removed within 30 days, subject to legal retention obligations.'
        },
    ];

    const privacyContent = (
        <div className={styles.policyContent}>
            <p style={{ marginBottom: '1.5rem', color: '#555', lineHeight: 1.7 }}>
                <strong>Effective Date:</strong> June 24, 2025 &nbsp;|&nbsp; <strong>Last Updated:</strong> January 08, 2026
            </p>
            <p style={{ marginBottom: '2rem', color: '#555', lineHeight: 1.7 }}>
                BIDPal values your privacy and is committed to protecting your personal information in accordance with the <strong>Republic Act No. 10173 – Data Privacy Act of 2012 (DPA)</strong> and applicable international standards including the GDPR where relevant.
            </p>

            {[
                {
                    title: '1. Information We Collect',
                    items: [
                        'Account & Profile: Full name, email, contact number, date of birth, gender, avatar, and account role (Buyer or Seller).',
                        'Identity Verification: Government-issued ID images (UMID, Driver\'s License, PhilID, Passport, Voter\'s ID, SSS/GSIS, PRC, TIN) for Seller verification.',
                        'Auction & Transaction Data: Bid history, purchase history, cart contents, payment method, order and shipping status.',
                        'Location & Address: Full shipping/billing address using Philippine regional hierarchy (Region, Province, City/Municipality, Barangay).',
                        'Communications: In-app messages, reviews, ratings, and support tickets.',
                        'Live Streaming Data: Real-time video/audio transmitted via Agora SDK during live auctions (not permanently stored unless required for disputes).',
                        'Device & Technical Info: IP address, device model, OS, app version, session logs, and crash reports.',
                    ]
                },
                {
                    title: '2. How We Use Your Data',
                    items: [
                        'To create and manage your account and authenticate your identity.',
                        'To process bids, transactions, payments, and deliveries.',
                        'To verify Seller identity and maintain platform integrity.',
                        'To power live auction streaming and real-time bidding.',
                        'To send transactional notifications (bid won, payment due, order updates).',
                        'To detect fraud, prevent abuse, and ensure platform security.',
                        'To personalize content and provide item recommendations.',
                        'To send optional promotional communications (with your consent).',
                        'To comply with legal obligations under Philippine law.',
                    ]
                },
                {
                    title: '3. Data Sharing',
                    items: [
                        'Supabase – Database, authentication, file storage, and real-time infrastructure.',
                        'Agora SDK – Live video/audio streaming for auction broadcasts.',
                        'Google Maps API / Leaflet – Address lookup and location display.',
                        'Google Generative AI – Content moderation and personalized recommendations.',
                        'Payment Gateway Providers – Secure payment processing.',
                        'Logistics Partners – Shipping address and order details for delivery fulfillment.',
                        'Legal / Regulatory Authorities – When required by law, court order, or the National Privacy Commission (NPC).',
                        'We do not sell your personal data to any third party.',
                    ]
                },
                {
                    title: '4. Data Retention',
                    items: [
                        'Active account data: Retained for the duration of account activity.',
                        'Transaction and bid records: 5 years (for legal and tax compliance).',
                        'Identity verification documents: Duration of account + 1 year after deletion.',
                        'Chat and messaging logs: 2 years or upon account deletion.',
                        'Device and usage logs: 90 days.',
                        'Deleted account data: Up to 30 days before permanent erasure.',
                    ]
                },
                {
                    title: '5. Your Rights',
                    items: [
                        'Right to be Informed – Know what data we collect and how it is used.',
                        'Right to Access – Request a copy of your personal data we hold.',
                        'Right to Rectification – Correct inaccurate or incomplete information.',
                        'Right to Erasure – Request deletion of your account and data.',
                        'Right to Object – Object to processing for marketing or profiling.',
                        'Right to Data Portability – Receive your data in a machine-readable format.',
                        'Right to Lodge a Complaint – File a complaint with the National Privacy Commission (NPC) at www.privacy.gov.ph.',
                    ]
                },
                {
                    title: '6. Security',
                    items: [
                        'TLS/HTTPS encryption for all data in transit.',
                        'Bcrypt hashing for stored passwords.',
                        'Row-level security (RLS) enforced at the database level via Supabase.',
                        'Session token management and role-based access controls.',
                        'Regular security assessments and vulnerability monitoring.',
                        'In the event of a data breach, affected users and the NPC will be notified within 72 hours as required by law.',
                    ]
                },
                {
                    title: '7. Children\'s Privacy',
                    items: [
                        'BIDPal is strictly intended for users 18 years of age and older.',
                        'We do not knowingly collect data from minors.',
                        'Accounts identified as belonging to users under 18 will be suspended and their data deleted.',
                    ]
                },
                {
                    title: '8. Changes to This Policy',
                    items: [
                        'We may update this Privacy Policy periodically.',
                        'Material changes will be communicated via in-app notification and/or email.',
                        'Continued use of BIDPal after the effective date constitutes acceptance of the revised policy.',
                    ]
                },
            ].map(({ title, items }) => (
                <div key={title} className={styles.policySection}>
                    <h3>{title}</h3>
                    <ul>
                        {items.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                </div>
            ))}

            <div className={styles.policySection}>
                <h3>9. Contact Us</h3>
                <p>For privacy inquiries, send a message to the BIDPal Admin via in-app messaging, or reach us at:</p>
                <ul>
                    <li>Email: support@bidpal.shop</li>
                    <li>National Privacy Commission: www.privacy.gov.ph | info@privacy.gov.ph | Hotline: 8234-2228</li>
                </ul>
                <p style={{ marginTop: '1rem' }}>We aim to respond to all inquiries within <strong>3–5 business days</strong>.</p>
            </div>
        </div>
    );

    const termsContent = (
        <div className={styles.policyContent}>
            <p style={{ marginBottom: '1.5rem', color: '#555', lineHeight: 1.7 }}>
                <strong>Effective Date:</strong> June 24, 2025 &nbsp;|&nbsp; <strong>Last Updated:</strong> January 08, 2026
            </p>
            <p style={{ marginBottom: '2rem', color: '#555', lineHeight: 1.7 }}>
                By accessing or using BIDPal, you agree to be bound by these Terms and Agreements. Please read them carefully before using our platform.
            </p>

            {[
                {
                    title: '1. Eligibility',
                    items: [
                        'You must be at least 18 years old to use BIDPal.',
                        'By registering, you confirm that all information provided is accurate and complete.',
                        'BIDPal is primarily intended for users in the Philippines.',
                    ]
                },
                {
                    title: '2. Account Responsibilities',
                    items: [
                        'You are responsible for maintaining the confidentiality of your account credentials.',
                        'You must notify BIDPal immediately of any unauthorized use of your account.',
                        'You may not share, transfer, or sell your account to another person.',
                        'BIDPal reserves the right to suspend or terminate accounts that violate these Terms.',
                    ]
                },
                {
                    title: '3. Bidding Rules',
                    items: [
                        'All bids placed on BIDPal are legally binding commitments to purchase.',
                        'Once a bid is placed, it cannot be retracted or cancelled.',
                        'Shill bidding, bid manipulation, or any form of fraudulent bidding is strictly prohibited.',
                        'The highest bidder at the close of an auction is obligated to complete the purchase.',
                        'Failure to complete a winning purchase may result in account suspension.',
                    ]
                },
                {
                    title: '4. Seller Obligations',
                    items: [
                        'Sellers must complete identity verification using a valid Philippine government-issued ID.',
                        'All listings must be accurate, truthful, and not misleading.',
                        'Sellers are responsible for fulfilling orders promptly after a successful auction or purchase.',
                        'Counterfeit, prohibited, or illegal items must not be listed.',
                        'Sellers must honor the stated price and shipping terms.',
                    ]
                },
                {
                    title: '5. Prohibited Items and Conduct',
                    items: [
                        'Illegal, counterfeit, or stolen goods.',
                        'Weapons, explosives, or hazardous materials.',
                        'Items that infringe intellectual property rights.',
                        'Harassment, abuse, or threatening conduct toward other users.',
                        'Spamming, phishing, or fraudulent activity of any kind.',
                    ]
                },
                {
                    title: '6. Fees and Payments',
                    items: [
                        'BIDPal may charge platform fees for certain transactions, which will be disclosed before confirmation.',
                        'Payments are processed securely by third-party payment gateway providers.',
                        'BIDPal does not store full credit/debit card details on its servers.',
                        'All prices are displayed in Philippine Peso (₱).',
                    ]
                },
                {
                    title: '7. Dispute Resolution',
                    items: [
                        'Disputes between buyers and sellers should first be attempted through in-app messaging.',
                        'BIDPal support may mediate disputes but is not liable for the outcome of private transactions.',
                        'BIDPal reserves the right to issue refunds, suspend listings, or ban users in cases of fraud.',
                    ]
                },
                {
                    title: '8. Limitation of Liability',
                    items: [
                        'BIDPal is a platform and is not a party to transactions between buyers and sellers.',
                        'BIDPal is not liable for losses arising from user-to-user transactions, delivery issues, or item disputes.',
                        'Service availability is provided on an "as is" basis and BIDPal does not guarantee uninterrupted access.',
                    ]
                },
                {
                    title: '9. Governing Law',
                    items: [
                        'These Terms are governed by the laws of the Republic of the Philippines.',
                        'Any disputes shall be subject to the jurisdiction of Philippine courts.',
                    ]
                },
                {
                    title: '10. Changes to These Terms',
                    items: [
                        'BIDPal may update these Terms at any time.',
                        'Continued use of the platform after changes constitutes acceptance of the revised Terms.',
                        'Material changes will be communicated via in-app notification or email.',
                    ]
                },
            ].map(({ title, items }) => (
                <div key={title} className={styles.policySection}>
                    <h3>{title}</h3>
                    <ul>
                        {items.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                </div>
            ))}
        </div>
    );

    const panelTitles = { privacy: 'Privacy Policy', terms: 'Terms & Agreements', faq: 'FAQs' };

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Help Center</h1>
                <p>Find answers or contact support.</p>
            </header>

            <div className={styles.contactList}>
                {helpItems.map(item => (
                    <div
                        key={item.id}
                        className={styles.contactCard}
                        style={{ cursor: ['privacy', 'terms', 'faq', 'email'].includes(item.id) ? 'pointer' : 'default' }}
                        onClick={() => item.id === 'email'
                            ? router.push('/support/email')
                            : ['privacy', 'terms', 'faq'].includes(item.id)
                                ? setActivePanel(item.id)
                                : null}
                    >
                        <div className={styles.contactIcon}>{item.icon}</div>
                        <span className={styles.contactText}>
                            <span>{item.label}</span>
                            {item.detail && <span className={styles.contactDetail}>{item.detail}</span>}
                        </span>
                        {['privacy', 'terms', 'faq', 'email'].includes(item.id) && <ChevronRight size={18} color="#aaa" />}
                    </div>
                ))}
            </div>

            {activePanel && (
                <div className={styles.helpOverlay} onClick={() => setActivePanel(null)}>
                    <div className={styles.helpPanel} onClick={e => e.stopPropagation()}>
                        <div className={styles.helpPanelHeader}>
                            <h2>{panelTitles[activePanel]}</h2>
                            <button className={styles.helpPanelCloseBtn} onClick={() => setActivePanel(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className={styles.helpPanelBody}>
                            {activePanel === 'privacy' && privacyContent}
                            {activePanel === 'terms' && termsContent}
                            {activePanel === 'faq' && (
                                <div>
                                    {faqItems.map((item, i) => (
                                        <details key={i} className={styles.faqItem}>
                                            <summary className={styles.faqQuestion}>
                                                <span>{item.q}</span>
                                                <ChevronDown size={18} className={styles.accordionArrow} />
                                            </summary>
                                            <p className={styles.faqAnswer}>{item.a}</p>
                                        </details>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function InviteSection() {
    const { user } = useAuth();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const [invite, setInvite] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const fetchInvite = async () => {
        if (!user) return;
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('bidpal_token');
            const appOrigin = process.env.NEXT_PUBLIC_APP_URL || 'https://bidpal.shop';
            const browserOrigin = typeof window !== 'undefined' ? window.location.origin : appOrigin;
            const origin = browserOrigin.includes('localhost') || browserOrigin.includes('127.0.0.1')
                ? appOrigin
                : browserOrigin;
            const res = await fetch(`${apiUrl}/api/invites/me?origin=${encodeURIComponent(origin)}`, {
                headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to generate invite link');
            setInvite(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyInvite = async () => {
        if (!invite?.inviteLink) return;
        await navigator.clipboard.writeText(invite.inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    const shareInvite = async () => {
        if (!invite?.inviteLink) return;
        if (navigator.share) {
            await navigator.share({
                title: 'Join me on BIDPal',
                text: 'Shop live auctions and fixed-price finds with my BIDPal invite.',
                url: invite.inviteLink,
            });
            return;
        }
        copyInvite();
    };

    return (
        <div className={styles.section}>
            <div className={styles.inviteHero}>
                <header className={styles.sectionHeader}>
                    <h1>Invite Friends</h1>
                    <p>Spread the word and earn rewards.</p>
                </header>
                <button className={styles.primaryBtn} onClick={fetchInvite} disabled={loading}>
                    {loading ? 'Generating...' : invite ? 'Refresh Invite Link' : 'Generate Invite Link'}
                </button>
            </div>

            {error && <div className={styles.inviteError}>{error}</div>}

            {invite && (
                <div className={styles.invitePanel}>
                    <div className={styles.inviteQrCard}>
                        <div className={styles.inviteQrHeader}>
                            <QrCode size={18} />
                            <span>Your QR Code</span>
                        </div>
                        <div className={styles.inviteQrBox}>
                            <img src={invite.qrCodeUrl} alt="Invite QR code" />
                        </div>
                        <p>Friends can scan this to sign up with your invite.</p>
                    </div>

                    <div className={styles.inviteDetails}>
                        <div className={styles.inviteCodeBox}>
                            <span>Invite Code</span>
                            <strong>{invite.inviteCode}</strong>
                        </div>

                        <label className={styles.inviteLinkLabel}>Invite Link</label>
                        <div className={styles.inviteLinkBox}>
                            <input value={invite.inviteLink} readOnly />
                            <button onClick={copyInvite} aria-label="Copy invite link">
                                <Copy size={16} />
                            </button>
                        </div>

                        <div className={styles.inviteActions}>
                            <button className={styles.inviteActionBtn} onClick={copyInvite}>
                                <Copy size={16} />
                                {copied ? 'Copied' : 'Copy Link'}
                            </button>
                            <button className={styles.inviteActionBtnDark} onClick={shareInvite}>
                                <Share2 size={16} />
                                Share
                            </button>
                        </div>

                        <div className={styles.inviteStats}>
                            <div>
                                <strong>{invite.acceptedInvites || 0}</strong>
                                <span>Accepted invites</span>
                            </div>
                            <p>{invite.rewardLabel}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function WishlistSection() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const router = useRouter();
    const isSeller = user?.role?.toLowerCase() === 'seller';


    useEffect(() => {
        if (user?.user_id) {
            fetchWishlist();
        }
    }, [user?.user_id]);


    const fetchWishlist = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${apiUrl}/api/dashboard/wishlist/${user.user_id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch wishlist');
            setItems(data);
        } catch (err) {
            console.error('Error fetching wishlist:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleLike = async (e, auctionId) => {
        e.stopPropagation();
        try {
            const res = await fetch(`${apiUrl}/api/dashboard/auction/${auctionId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.user_id })
            });

            if (res.ok) {
                setItems(prev => prev.filter(item => item.auction_id !== auctionId));
            }
        } catch (err) {
            console.error('Error toggling like:', err);
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status?.toLowerCase()) {
            case 'active': return styles.badgeLive;
            case 'scheduled': return styles.badgeScheduled;
            default: return styles.badgeEnded;
        }
    };

    const getBadgeLabel = (item) => {
        if (item.product_status === 'sold') return 'Sold';
        switch (item.status?.toLowerCase()) {
            case 'active': return '🔴 Live Now';
            case 'scheduled': return '🕐 Scheduled';
            case 'ended': return 'Ended';
            case 'completed': return 'Completed';
            default: return item.status;
        }
    };

    const getButtonStyle = (item) => {
        if (item.product_status === 'sold') return { background: '#333', opacity: 0.6, cursor: 'not-allowed' };
        switch (item.status?.toLowerCase()) {
            case 'active': return { background: '#D32F2F' };
            case 'scheduled': return { background: '#1976D2' };
            default: return { background: '#555' };
        }
    };

    const getButtonLabel = (item) => {
        if (item.product_status === 'sold') return 'Sold';
        switch (item.status?.toLowerCase()) {
            case 'active': return 'Bid Now →';
            case 'scheduled': return 'View Auction →';
            default: return 'View Detail →';
        }
    };

    if (loading) {
        return (
            <div className={styles.section}>
                <div className={styles.wishlistBack}>
                    <BackButton />
                </div>
                <header className={styles.sectionHeader}>
                    <h1>My Wishlist</h1>
                </header>
                <BIDPalLoader size="section" />
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.section}>
                <div className={styles.wishlistBack}>
                    <BackButton />
                </div>
                <header className={styles.sectionHeader}>
                    <h1>My Wishlist</h1>
                </header>
                <div className={styles.errorMessage}>
                    <p>Error: {error}. Please try again later.</p>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className={styles.section}>
                <div className={styles.wishlistBack}>
                    <BackButton />
                </div>
                <header className={styles.sectionHeader}>
                    <h1>My Wishlist</h1>
                </header>
                <div className={styles.emptyWishlist}>
                    <div className={styles.emptyIconWrapper}>
                        <Heart size={48} fill="#eee" stroke="#ddd" />
                    </div>
                    <h2>Your wishlist is empty</h2>
                    <p>Looks like you haven't added anything to your wishlist yet. Explore our live auctions and find something you love!</p>
                    <button className={styles.browseBtn} onClick={() => router.push('/search')}>
                        Browse Auctions
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.section}>
            <div className={styles.wishlistBack}>
                <BackButton />
            </div>
            <header className={styles.sectionHeader}>
                <h1>My Wishlist</h1>
                <p>You have {items.length} item{items.length !== 1 ? 's' : ''} in your wishlist.</p>
            </header>

            <div className={styles.wishlistGrid}>
                {items.map((item) => (
                    <div
                        key={item.auction_id}
                        className={styles.wishlistCard}
                        onClick={() => {
                            if (item.product_status !== 'sold') {
                                router.push(`/live?id=${item.auction_id}`);
                            }
                        }}
                    >
                        <div className={styles.wishlistImageWrapper}>
                            <img
                                src={item.image || '/placeholder-product.png'}
                                alt={item.title}
                                className={`${styles.wishlistImage} ${item.product_status === 'sold' ? styles.grayscale : ''}`}
                            />
                            <div className={`${styles.wishlistBadge} ${item.product_status === 'sold' ? styles.badgeEnded : getStatusBadgeClass(item.status)}`}>
                                {getBadgeLabel(item)}
                            </div>
                            <button
                                className={styles.wishlistHeartBtn}
                                onClick={(e) => handleToggleLike(e, item.auction_id)}
                                title="Remove from wishlist"
                            >
                                <Heart size={18} fill="#D32F2F" color="#D32F2F" />
                            </button>
                        </div>

                        <div className={styles.wishlistInfo}>
                            <div className={styles.wishlistHeader}>
                                <span className={styles.wishlistSeller}>{item.seller}</span>
                                <h3 className={styles.wishlistName}>{item.title}</h3>
                                {item.description && (
                                    <p className={styles.wishlistDesc}>{item.description}</p>
                                )}
                            </div>

                            {item.status === 'scheduled' && item.start_time && (
                                <div className={styles.wishlistScheduleRow}>
                                    <span className={styles.wishlistScheduleLabel}>Starts</span>
                                    <span className={styles.wishlistScheduleValue}>
                                        {new Date(item.start_time).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        {' · '}
                                        {new Date(item.start_time).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            )}

                            <div className={styles.wishlistPriceRow}>
                                <div>
                                    <span className={styles.priceLabel}>
                                        {item.status === 'active' ? 'Current Bid' : 'Starting Price'}
                                    </span>
                                    <span className={styles.priceValue}>
                                        ₱{Number(item.current_price || 0).toLocaleString('en-PH')}
                                    </span>
                                </div>
                                <button
                                    className={styles.viewAuctionBtn}
                                    style={getButtonStyle(item)}
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        if (item.product_status !== 'sold') {
                                            router.push(`/live?id=${item.auction_id}`);
                                        }
                                    }}
                                    disabled={item.product_status === 'sold'}
                                >
                                    {getButtonLabel(item)}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
