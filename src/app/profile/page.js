'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import BackButton from '@/components/BackButton';
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
    MessageSquare,
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
    FileText
} from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGeolocation } from '@/hooks/useGeolocation';

const MapComponent = dynamic(() => import('@/components/map/MapComponent'), {
    ssr: false,
    loading: () => <div className={styles.loadingFallback}>Loading map...</div>
});

function AccountContent() {
    const { user, logout, updateUser } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
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
        const validTabs = ['profile', 'address', 'notifications', 'payment', 'wishlist', 'security', 'privacy', 'help', 'invite', 'merchant-insights', 'store-profile', 'pickup-address'];
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
        { id: 'security', label: 'Security', icon: <ShieldCheck size={20} /> },
        { id: 'privacy', label: 'Privacy Policy', icon: <Lock size={20} /> },
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

    // Fetch the latest user name from the API so the sidebar is always up to date
    useEffect(() => {
        if (!user?.user_id) return;
        // Seed immediately from cached data
        const cached = [user.Fname, user.Mname, user.Lname].filter(Boolean).join(' ');
        if (cached) setSidebarName(cached);

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
                    <button className={styles.globalBack} onClick={() => router.push(isSeller ? '/seller' : '/')}>
                        <ArrowLeft size={18} />
                        <span>{isSeller ? 'Back to Seller Hub' : 'Back to Marketplace'}</span>
                    </button>

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
                {/* Mobile back-to-menu button */}
                <button className={styles.mobileMenuBack} onClick={() => setMobileView('menu')}>
                    <ChevronLeft size={16} />
                    <span>Back</span>
                </button>

                {activeTab === 'profile' && <ProfileSection />}
                {activeTab === 'address' && <AddressSection state={addressState} setState={setAddressState} />}
                {activeTab === 'notifications' && <NotificationSection />}
                {activeTab === 'payment' && <PaymentSection />}
                {activeTab === 'wishlist' && <WishlistSection />}
                {activeTab === 'security' && <SecuritySection />}
                {activeTab === 'privacy' && <PrivacySection />}
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

export default function AccountPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AccountContent />
        </Suspense>
    );
}

function MerchantInsightsSection() {
    const kpis = [
        { label: 'Total Revenue', value: '₱ 0', change: '0%', isPositive: true, icon: <DollarSign size={24} />, color: 'purple' },
        { label: 'Items Sold', value: '0', change: '0%', isPositive: true, icon: <ShoppingBag size={24} />, color: 'blue' },
        { label: 'Followers', value: '0', change: '0%', isPositive: true, icon: <Users size={24} />, color: 'orange' },
    ];

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Merchant Insights</h1>
                <p>Overview of your store performance and business growth.</p>
            </header>

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
                                {kpi.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                <span>{kpi.change}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.chartMock}>
                <h3>Revenue Growth</h3>
                <div className={styles.barChart}>
                    {[0, 0, 0, 0, 0, 0, 0].map((h, i) => (
                        <div key={i} className={styles.barWrapper}>
                            <div className={styles.bar} style={{ height: `10%` }}></div>
                            <span className={styles.barLabel}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.insightAlert}>
                <Zap size={20} fill="#FBC02D" color="#FBC02D" />
                <p>Your store engagement is up <strong>15%</strong> this week. Keep going!</p>
            </div>
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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

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
                    setStoreName(data.store_name || '');
                    setStoreHandle(data.store_handle || '');
                    setStoreDescription(data.store_description || '');
                    setBusinessCategory(data.business_category || '');
                }
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [user?.user_id]);

    const handleSave = async () => {
        if (!seller?.seller_id) return;
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
            setMessage({ type: 'success', text: '✓ Store profile updated successfully!' });
            setTimeout(() => setMessage(''), 4000);
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
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
            <header className={styles.sectionHeader}>
                <h1>Store Profile</h1>
                <p>Public information visible to buyers on your store page.</p>
            </header>

            {message && (
                <div className={`${styles.messageBox} ${message.type === 'error' ? styles.errorMessage : styles.successMessage}`}>
                    {message.text}
                </div>
            )}

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
                    disabled={saving || !storeName}
                >
                    {saving ? 'Saving...' : 'Save Store Profile'}
                </button>
            </div>
        </div>
    );
}


function ProfileSection() {
    const { user } = useAuth();
    const [firstName, setFirstName] = useState('');
    const [middleName, setMiddleName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [birthday, setBirthday] = useState('');
    const birthdayPickerRef = useRef(null);
    const [gender, setGender] = useState('');
    const [bio, setBio] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    useEffect(() => {
        if (!user?.user_id) return;
        // Seed form from cached user data immediately
        setFirstName(user.Fname || '');
        setMiddleName(user.Mname || '');
        setLastName(user.Lname || '');
        setEmail(user.email || '');
        setPhone(user.contact_num || '');
        setBirthday(user.Birthday ? toDisplayBirthday(user.Birthday.split('T')[0]) : '');
        setGender(user.Gender || '');
        setBio(user.Bio || '');

        // Then refresh from the API to get the latest values
        const token = localStorage.getItem('bidpal_token');
        fetch(`${apiUrl}/api/users/${user.user_id}`, {
            headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                setFirstName(data.Fname || '');
                setMiddleName(data.Mname || '');
                setLastName(data.Lname || '');
                setEmail(data.email || '');
                setPhone(data.contact_num || '');
                setBirthday(data.Birthday ? toDisplayBirthday(data.Birthday.split('T')[0]) : '');
                setGender(data.Gender || '');
                setBio(data.Bio || '');
            })
            .catch(() => { });
    }, [user?.user_id]);

    const toDisplayBirthday = (iso) => {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        return `${m}/${d}/${y}`;
    };

    const toISOBirthday = (display) => {
        if (!display) return '';
        const [m, d, y] = display.split('/');
        if (!m || !d || !y || y.length < 4) return '';
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    };

    const handleBirthdayChange = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.slice(0, 2) + '/' + val.slice(2);
        if (val.length > 5) val = val.slice(0, 5) + '/' + val.slice(5);
        setBirthday(val.slice(0, 10));
    };

    const handleSaveProfile = async () => {
        if (!user) return;
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
                    Birthday: birthday ? toISOBirthday(birthday) : null,
                    Gender: gender || null,
                    Bio: bio || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error updating profile.');
            const updatedUser = { ...user, Fname: firstName, Mname: middleName, Lname: lastName, contact_num: phone, Birthday: birthday, Gender: gender, Bio: bio };
            localStorage.setItem('bidpal_user', JSON.stringify(updatedUser));
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
                        <label>First Name</label>
                        <input type="text" value={firstName} onChange={e => setFirstName(e.target.value.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s\-]/g, ''))} placeholder="Juan" />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Middle Name <span className={styles.optionalTag}>(Optional)</span></label>
                        <input type="text" value={middleName} onChange={e => setMiddleName(e.target.value.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ\s\-]/g, ''))} placeholder="Santos" />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Last Name</label>
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
                        <label><Calendar size={14} style={{ display: 'inline', marginRight: 5 }} />Birthday</label>
                        <div className={styles.dateWrapper}>
                            <input
                                type="text"
                                placeholder="mm/dd/yyyy"
                                value={birthday}
                                maxLength={10}
                                onChange={handleBirthdayChange}
                            />
                            <button
                                type="button"
                                className={styles.calendarBtn}
                                onClick={() => birthdayPickerRef.current?.showPicker()}
                            >
                                <Calendar size={16} />
                            </button>
                            <input
                                ref={birthdayPickerRef}
                                type="date"
                                max={new Date().toISOString().split('T')[0]}
                                onChange={e => setBirthday(toDisplayBirthday(e.target.value))}
                            />
                        </div>
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

                <button className={styles.primaryBtn} onClick={handleSaveProfile} disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
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
                            {confirmDialog.icon || (confirmDialog.isAlert ? '⚠️' : '🗑️')}
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
                            {confirmDialog.icon || (confirmDialog.isAlert ? '⚠️' : '🗑️')}
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
                    {confirmDialog.isAlert ? '⚠️' : '🗑️'}
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

function PrivacySection() {
    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Privacy Policy</h1>
                <p>Last Updated: January 08, 2026</p>
            </header>
            <div className={styles.policyContent}>
                <p>Your privacy is important to us. This policy explains how we handle your data.</p>
                {/* Simplified for brevity in this specific task context */}
            </div>
        </div>
    );
}

function HelpCenterSection() {
    const [activePanel, setActivePanel] = useState(null); // 'privacy' | 'terms' | 'faq' | null

    const helpItems = [
        { id: 'privacy',  label: 'Privacy Policy',      icon: <Lock size={20} /> },
        { id: 'terms',    label: 'Terms & Agreements',  icon: <FileText size={20} /> },
        { id: 'faq',      label: 'FAQs',                icon: <HelpCircle size={20} /> },
        { id: 'email',    label: 'Email Support',       icon: <Mail size={20} /> },
        { id: 'chat',     label: 'Live Chat',           icon: <MessageSquare size={20} /> },
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
            a: 'You can send a message to the BIDPal Admin via in-app messaging, email us at support@bidpal.com, or use Live Chat from this Help Center.'
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
                    <li>Email: support@bidpal.com</li>
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
                        style={{ cursor: ['privacy', 'terms', 'faq'].includes(item.id) ? 'pointer' : 'default' }}
                        onClick={() => ['privacy', 'terms', 'faq'].includes(item.id) ? setActivePanel(item.id) : null}
                    >
                        <div className={styles.contactIcon}>{item.icon}</div>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {['privacy', 'terms', 'faq'].includes(item.id) && <ChevronRight size={18} color="#aaa" />}
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
    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Invite Friends</h1>
                <p>Spread the word and earn rewards.</p>
            </header>
            <button className={styles.primaryBtn}>Generate Invite Link</button>
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
                // If successful, remove from local state immediately
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

    if (loading) {
        return (
            <div className={styles.section}>
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

    const getBadgeLabel = (status) => {
        switch (status?.toLowerCase()) {
            case 'active': return '🔴 Live Now';
            case 'scheduled': return '🕐 Scheduled';
            case 'ended': return 'Ended';
            case 'completed': return 'Completed';
            default: return status;
        }
    };

    const getButtonStyle = (status) => {
        switch (status?.toLowerCase()) {
            case 'active': return { background: '#D32F2F' };
            case 'scheduled': return { background: '#1976D2' };
            default: return { background: '#555' };
        }
    };

    const getButtonLabel = (status) => {
        switch (status?.toLowerCase()) {
            case 'active': return 'Bid Now →';
            case 'scheduled': return 'View Auction →';
            default: return 'View Detail →';
        }
    };

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <div className={styles.wishlistBack}>
                    <BackButton label="Back" />
                </div>
                <h1>My Wishlist</h1>
                <p>You have {items.length} item{items.length !== 1 ? 's' : ''} in your wishlist.</p>
            </header>

            <div className={styles.wishlistGrid}>
                {items.map((item) => (
                    <div
                        key={item.auction_id}
                        className={styles.wishlistCard}
                        onClick={() => router.push(`/live?id=${item.auction_id}`)}
                    >
                        <div className={styles.wishlistImageWrapper}>
                            <img
                                src={item.image || '/placeholder-product.png'}
                                alt={item.title}
                                className={styles.wishlistImage}
                            />
                            <div className={`${styles.wishlistBadge} ${getStatusBadgeClass(item.status)}`}>
                                {getBadgeLabel(item.status)}
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
                                    style={getButtonStyle(item.status)}
                                    onClick={(e) => { e.stopPropagation(); router.push(`/live?id=${item.auction_id}`); }}
                                >
                                    {getButtonLabel(item.status)}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
