'use client';

import { useState, Suspense, useEffect } from 'react';
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
    DollarSign
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
    const { user, logout } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const isSeller = user?.role?.toLowerCase() === 'seller';

    const [activeTab, setActiveTab] = useState(isSeller ? 'merchant-insights' : 'profile');
    const [addressState, setAddressState] = useState('list'); // 'list' or 'add'
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [avatarMessage, setAvatarMessage] = useState('');

    useEffect(() => {
        const validTabs = ['profile', 'address', 'notifications', 'payment', 'wishlist', 'security', 'privacy', 'help', 'invite', 'merchant-insights', 'store-profile'];
        if (tabParam && validTabs.includes(tabParam)) {
            setActiveTab(tabParam);
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
        { id: 'notifications', label: 'Notification', icon: <Bell size={20} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={20} /> },
        { id: 'help', label: 'Help Center', icon: <HelpCircle size={20} /> },
    ];

    const menuItems = isSeller ? sellerMenuItems : buyerMenuItems;

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setAvatarLoading(true);
        setAvatarMessage('');

        try {
            const formData = new FormData();
            formData.append('avatar', file);

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            const res = await fetch(`${apiUrl}/api/users/${user.user_id}/avatar`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                setAvatarMessage({ type: 'error', text: 'Error uploading avatar. Please try again.' });
                return;
            }

            // Update local storage with new avatar
            const updatedUser = { ...user, Avatar: data.avatarUrl };
            localStorage.setItem('bidpal_user', JSON.stringify(updatedUser));

            setAvatarMessage({ type: 'success', text: '✓ Avatar updated successfully!' });
            setTimeout(() => setAvatarMessage(''), 3000);

            // Refresh the page to show updated avatar
            window.location.reload();
        } catch (err) {
            setAvatarMessage({ type: 'error', text: 'Error uploading avatar. Please try again.' });
            console.error('Error:', err);
        } finally {
            setAvatarLoading(false);
        }
    };

    const [sidebarName, setSidebarName] = useState('');

    // Fetch the latest user name from the API so the sidebar is always up to date
    useEffect(() => {
        if (!user?.user_id) return;
        // Seed immediately from cached data
        const cached = [user.Fname, user.Mname, user.Lname].filter(Boolean).join(' ');
        if (cached) setSidebarName(cached);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
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
            .catch(() => {});
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
        <div className={styles.container}>
            {/* Sidebar - Desktop */}
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
                            <label htmlFor="avatarInput" className={styles.editAvatarLabel}>
                                <button
                                    className={styles.editAvatar}
                                    type="button"
                                    title="Upload profile picture"
                                    disabled={avatarLoading}
                                >
                                    <Camera size={14} />
                                </button>
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
                                onClick={() => setActiveTab(item.id)}
                            >
                                <div className={styles.navIcon}>{item.icon}</div>
                                <span>{item.label}</span>
                                <ChevronRight size={16} className={styles.navArrow} />
                            </button>
                        ))}
                    </nav>

                    <button className={styles.logoutNavBtn} onClick={() => {
                        logout();
                        router.push('/signin');
                    }}>
                        <div className={styles.navIcon}><LogOut size={20} /></div>
                        <span>Logout</span>
                    </button>
                </aside>
            )}

            {/* Main Content Area */}
            <main className={`${styles.content} ${activeTab === 'wishlist' ? styles.fullWidth : ''}`}>
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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
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
            .catch(() => {})
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

    const initials = storeName ? storeName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?';

    if (loading) {
        return (
            <div className={styles.section}>
                <div className={styles.loadingPlaceholder}><p>Loading store profile...</p></div>
            </div>
        );
    }

    return (
        <div className={styles.section}>
            {/* Store Hero Header */}
            <div className={styles.storeHero}>
                <div className={styles.storeHeroBg} />
                <div className={styles.storeHeroContent}>
                    <div className={styles.storeAvatar}>
                        {initials}
                    </div>
                    <div className={styles.storeHeroInfo}>
                        <h2 className={styles.storeHeroName}>{storeName || 'Your Store'}</h2>
                        {storeHandle && (
                            <span className={styles.storeHeroHandle}>bidpal.com/{storeHandle}</span>
                        )}
                        <span className={styles.storeHeroBadge}>{businessCategory || 'No category set'}</span>
                    </div>
                </div>
            </div>

            <header className={styles.sectionHeader} style={{ marginTop: '2rem' }}>
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
                            <option value="">Select Category</option>
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
    const [gender, setGender] = useState('');
    const [bio, setBio] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

    useEffect(() => {
        if (!user?.user_id) return;
        // Seed form from cached user data immediately
        setFirstName(user.Fname || '');
        setMiddleName(user.Mname || '');
        setLastName(user.Lname || '');
        setEmail(user.email || '');
        setPhone(user.contact_num || '');
        setBirthday(user.Birthday ? user.Birthday.split('T')[0] : '');
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
                setBirthday(data.Birthday ? data.Birthday.split('T')[0] : '');
                setGender(data.Gender || '');
                setBio(data.Bio || '');
            })
            .catch(() => {});
    }, [user?.user_id]);

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
                    Birthday: birthday || null,
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
                        <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Juan" />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Middle Name <span className={styles.optionalTag}>(Optional)</span></label>
                        <input type="text" value={middleName} onChange={e => setMiddleName(e.target.value)} placeholder="Santos" />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Last Name</label>
                        <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dela Cruz" />
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
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+63 917 123 4567" />
                    </div>
                </div>

                {/* Birthday + Gender row */}
                <div className={styles.formGrid2}>
                    <div className={styles.formGroup}>
                        <label><Calendar size={14} style={{ display: 'inline', marginRight: 5 }} />Birthday</label>
                        <input
                            type="date"
                            value={birthday}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={e => setBirthday(e.target.value)}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Gender</label>
                        <div className={styles.selectWrapper}>
                            <select value={gender} onChange={e => setGender(e.target.value)}>
                                <option value="">Select Gender</option>
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
    const [formData, setFormData] = useState({
        addressType: 'Home',
        Line1: '',
        Line2: '',
        region: '',
        province: '',
        city: '',
        barangay: '',
        isDefault: false
    });
    const [regions, setRegions] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [barangays, setBarangays] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [addresses, setAddresses] = useState([]);
    const [fetchingAddresses, setFetchingAddresses] = useState(false);
    const [loadingLocations, setLoadingLocations] = useState(false);
    const { getCurrentLocation, location: geoLocation, error: geoError, loading: geoLoading } = useGeolocation();

    // Fetch regions and addresses on component mount
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            const res = await fetch(`${apiUrl}/api/addresses/user/${user.user_id}`);

            if (!res.ok) {
                console.error('API Response Status:', res.status);
                setAddresses([]);
                return;
            }

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('Invalid content type:', contentType);
                setAddresses([]);
                return;
            }

            const data = await res.json();

            if (Array.isArray(data)) {
                setAddresses(data);
            } else {
                setAddresses([]);
            }
        } catch (err) {
            console.error('Error fetching addresses:', err);
            setAddresses([]);
        } finally {
            setFetchingAddresses(false);
        }
    };

    const fetchRegions = async () => {
        setLoadingLocations(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            const res = await fetch(`${apiUrl}/api/addresses/locations/regions`);

            if (!res.ok) {
                console.error('Error fetching regions - Status:', res.status);
                setRegions([]);
                setLoadingLocations(false);
                return;
            }

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('Invalid content type for regions:', contentType);
                setRegions([]);
                setLoadingLocations(false);
                return;
            }

            const data = await res.json();
            console.log('Regions fetched:', data);
            const regionsData = Array.isArray(data) ? data : [];
            setRegions(regionsData);
        } catch (err) {
            console.error('Error fetching regions:', err);
            setRegions([]);
        } finally {
            setLoadingLocations(false);
        }
    };

    const fetchProvinces = async (region) => {
        if (!region) {
            setProvinces([]);
            setCities([]);
            setBarangays([]);
            return;
        }
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            const res = await fetch(`${apiUrl}/api/addresses/locations/provinces/${region}`);

            if (!res.ok) {
                console.error('Error fetching provinces - Status:', res.status);
                setProvinces([]);
                return;
            }

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('Invalid content type for provinces:', contentType);
                setProvinces([]);
                return;
            }

            const data = await res.json();
            console.log('Provinces fetched for region', region, ':', data);
            const provincesData = Array.isArray(data) ? data : [];
            setProvinces(provincesData);
            setFormData(prev => ({ ...prev, province: '', city: '', barangay: '' }));
            setCities([]);
            setBarangays([]);
        } catch (err) {
            console.error('Error fetching provinces:', err);
            setProvinces([]);
        }
    };

    const fetchCities = async (region, province) => {
        if (!region || !province) {
            setCities([]);
            return;
        }
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            const res = await fetch(`${apiUrl}/api/addresses/locations/cities/${region}/${province}`);

            if (!res.ok) {
                console.error('Error fetching cities - Status:', res.status);
                setCities([]);
                return;
            }

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('Invalid content type for cities:', contentType);
                setCities([]);
                return;
            }

            const data = await res.json();
            console.log('Cities fetched for province', province, ':', data);
            const citiesData = Array.isArray(data) ? data : [];
            setCities(citiesData);
            setFormData(prev => ({ ...prev, city: '', barangay: '' }));
            setBarangays([]);
        } catch (err) {
            console.error('Error fetching cities:', err);
            setCities([]);
        }
    };

    const fetchBarangays = async (city) => {
        if (!city) {
            setBarangays([]);
            return;
        }
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            const res = await fetch(`${apiUrl}/api/addresses/locations/barangays/${city}`);

            if (!res.ok) {
                console.error('Error fetching barangays - Status:', res.status);
                setBarangays([]);
                return;
            }

            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('Invalid content type for barangays:', contentType);
                setBarangays([]);
                return;
            }

            const data = await res.json();
            console.log('Barangays fetched for city', city, ':', data);
            const barangaysData = Array.isArray(data) ? data : [];
            setBarangays(barangaysData);
            setFormData(prev => ({ ...prev, barangay: '' }));
        } catch (err) {
            console.error('Error fetching barangays:', err);
            setBarangays([]);
        }
    };

    const handleRegionChange = (e) => {
        const region = e.target.value;
        setFormData(prev => ({ ...prev, region }));
        fetchProvinces(region);
    };

    const handleProvinceChange = (e) => {
        const province = e.target.value;
        setFormData(prev => ({ ...prev, province }));
        fetchCities(formData.region, province);
    };

    const handleCityChange = (e) => {
        const city = e.target.value;
        setFormData(prev => ({ ...prev, city }));
        fetchBarangays(city);
    };

    const handleMapSelect = (locationData) => {
        console.log('Map location selected:', locationData);
        
        setFormData(prev => ({
            ...prev,
            Line1: locationData.address || '',
            city: locationData.city || '',
            barangay: locationData.barangay || '',
            region: locationData.region || '',
            province: locationData.province || ''
        }));
        
        setShowMap(false);
        setMessage({ type: 'success', text: '✓ Location selected from map!' });
        setTimeout(() => setMessage(''), 3000);
    };

    const handleSaveAddress = async () => {
        if (!user) return;

        // More lenient validation - allow manual entry for missing fields from map
        if (!formData.Line1) {
            setMessage({ type: 'error', text: 'Street address is required' });
            return;
        }

        if (!formData.city && !formData.barangay) {
            setMessage({ type: 'error', text: 'Please select a city/municipality or barangay' });
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            
            const payload = {
                user_id: user.user_id,
                Line1: formData.Line1,
                Line2: formData.Line2 || null,
                Barangay: formData.barangay || null,
                municipality_city: formData.city || null,
                region: formData.region || null,
                province: formData.province || null,
                Country: 'Philippines',
                address_type: formData.addressType,
                is_default: formData.isDefault,
                zip_code: null
            };

            console.log('Sending address payload:', payload);

            const res = await fetch(`${apiUrl}/api/addresses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                console.error('Backend error response:', data);
                const errorMsg = data.error || 'Error saving address. Please try again.';
                setMessage({ type: 'error', text: errorMsg });
                return;
            }

            console.log('Address saved successfully:', data);
            setMessage({ type: 'success', text: '✓ Address saved successfully!' });
            setTimeout(() => {
                setState('list');
                setFormData({
                    addressType: 'Home',
                    Line1: '',
                    Line2: '',
                    region: '',
                    province: '',
                    city: '',
                    barangay: '',
                    isDefault: false
                });
                fetchUserAddresses();
            }, 1500);
        } catch (err) {
            console.error('Network error:', err);
            setMessage({ type: 'error', text: `Error: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    if (state === 'add') {
        return (
            <div className={styles.section}>
                {showMap && (
                    <MapComponent
                        onSelectLocation={handleMapSelect}
                        onClose={() => setShowMap(false)}
                    />
                )}

                <header className={styles.sectionHeader}>
                    <button className={styles.backBtn} onClick={() => setState('list')}>
                        <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /> Back
                    </button>
                    <h1>Add New Address</h1>
                </header>

                {message && (
                    <div className={`${styles.messageBox} ${message.type === 'error' ? styles.errorMessage : styles.successMessage}`}>
                        {message.text}
                    </div>
                )}

                <div className={styles.addressForm}>
                        <div className={styles.formGroup}>
                            <label>Address Name</label>
                            <select
                                value={formData.addressType}
                                onChange={(e) => setFormData(prev => ({ ...prev, addressType: e.target.value }))}
                                className={styles.selectInput}
                            >
                                <option>Home</option>
                                <option>Office</option>
                                <option>Apartment</option>
                                <option>Other</option>
                            </select>
                        </div>

                        <button
                            className={styles.geolocationBtn}
                            onClick={() => setShowMap(true)}
                        >
                            <MapPin size={20} />
                            Open Map to Select Location
                        </button>

                        {formData.Line1 && (
                            <>
                                <div className={styles.formGroup}>
                                    <label>Location Selected</label>
                                    <div className={styles.selectedLocation}>
                                        <MapPin size={18} />
                                        <div>
                                            <p className={styles.locationMain}>{formData.Line1}</p>
                                            {formData.city && <p className={styles.locationSub}>{formData.barangay}, {formData.city}</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Additional Details (Optional)</label>
                                    <textarea
                                        placeholder="Apt number, building name, etc."
                                        value={formData.Line2}
                                        onChange={(e) => setFormData(prev => ({ ...prev, Line2: e.target.value }))}
                                        rows={3}
                                        className={styles.textarea}
                                    />
                                </div>

                                <div className={styles.checkboxGroup}>
                                    <input
                                        type="checkbox"
                                        id="defaultAddr"
                                        checked={formData.isDefault}
                                        onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                                    />
                                    <label htmlFor="defaultAddr">Make this your default address</label>
                                </div>

                                <div className={styles.buttonGroup}>
                                    <button 
                                        className={styles.primaryBtn}
                                        onClick={handleSaveAddress}
                                        disabled={loading}
                                    >
                                        {loading ? 'Saving...' : 'Save Address'}
                                    </button>
                                    <button 
                                        className={styles.secondaryBtn}
                                        onClick={() => setState('list')}
                                        disabled={loading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}

                </div>
            </div>
        );
    }

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Addresses</h1>
                <p>Manage your delivery locations for faster checkout.</p>
            </header>

            {fetchingAddresses ? (
                <div className={styles.loadingPlaceholder}>
                    <p>Loading your addresses...</p>
                </div>
            ) : addresses.length === 0 ? (
                <div className={styles.noResults}>
                    <p>No addresses saved yet.</p>
                </div>
            ) : (
                <div className={styles.addressList}>
                    {addresses.map((addr, i) => (
                        <div key={i} className={styles.addressCard}>
                            <div className={styles.addressIcon}>
                                <MapPin size={24} color="white" />
                            </div>
                            <div className={styles.addressInfo}>
                                <div className={styles.addressTypeLine}>
                                    <h3>{addr.address_type || 'Address'}</h3>
                                    {addr.is_default && <span className={styles.defaultBadge}>Default</span>}
                                </div>
                                <p>{addr.Line1}</p>
                                {(addr.Barangay || addr['Municipality/City']) && (
                                    <p className={styles.addressSubtext}>
                                        {addr.Barangay && `${addr.Barangay}, `}{addr['Municipality/City']}
                                        {addr.province && `, ${addr.province}`}
                                    </p>
                                )}
                            </div>
                            <button className={styles.editBtn}><Pencil size={18} /></button>
                        </div>
                    ))}
                </div>
            )}

            <button className={styles.addFullBtn} onClick={() => setState('add')}>
                <Plus size={20} /> Add New Address
            </button>
        </div>
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
    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Help Center</h1>
                <p>Find answers or contact support.</p>
            </header>
            <div className={styles.contactList}>
                <div className={styles.contactCard}>
                    <div className={styles.contactIcon}><Mail /></div>
                    <span>Email Support</span>
                </div>
                <div className={styles.contactCard}>
                    <div className={styles.contactIcon}><MessageSquare /></div>
                    <span>Live Chat</span>
                </div>
            </div>
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
    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>My Wishlist</h1>
            </header>
            <div className={styles.noResults}>
                <p>Your wishlist is empty.</p>
            </div>
        </div>
    );
}
