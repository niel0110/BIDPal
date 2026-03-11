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

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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

    const getUserDisplayName = () => {
        if (!user) return '';
        const firstName = user.Fname || '';
        const middleName = user.Mname || '';
        const lastName = user.Lname || '';
        return [firstName, middleName, lastName].filter(Boolean).join(' ');
    };

    const getUserRole = () => {
        if (!user) return '';
        return user.role?.toLowerCase() === 'seller' ? 'Seller' : 'Buyer';
    };

    const getAvatarImage = () => {
        if (user?.Avatar) {
            return user.Avatar;
        }
        // Fallback to a placeholder based on role and name
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
    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Store Profile</h1>
                <p>Public information about your merchant brand.</p>
            </header>

            <div className={styles.profileForm}>
                <div className={styles.bannerUpload}>
                    <div className={styles.bannerPreview}>
                        <div className={styles.emptyBanner}>No Banner Uploaded</div>
                        <button className={styles.changeBannerBtn}><Camera size={18} /> Edit Banner</button>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label>Store Name</label>
                    <input type="text" placeholder="Enter store name" />
                </div>

                <div className={styles.formGroup}>
                    <label>Store Handle</label>
                    <div className={styles.inputWithPrefix}>
                        <span className={styles.prefix}>bidpal.com/</span>
                        <input type="text" placeholder="storehandle" />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label>Store Description</label>
                    <textarea
                        rows={4}
                        placeholder="Tell buyers about your store..."
                    />
                </div>

                <div className={styles.formGroup}>
                    <label>Business Category</label>
                    <div className={styles.selectWrapper}>
                        <select defaultValue="">
                            <option value="" disabled>Select Category</option>
                            <option>Gadgets</option>
                            <option>Fashion</option>
                            <option>Collectibles</option>
                            <option>Home Decor</option>
                        </select>
                        <ChevronDown size={18} color="#999" />
                    </div>
                </div>

                <button className={styles.primaryBtn}>Save Changes</button>
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
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (user) {
            setFirstName(user.Fname || '');
            setMiddleName(user.Mname || '');
            setLastName(user.Lname || '');
            setEmail(user.email || '');
            setPhone(user.contact_num || '');
        }
    }, [user]);

    const handleSaveProfile = async () => {
        if (!user) return;

        setLoading(true);
        setMessage('');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/users/${user.user_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    Fname: firstName,
                    Mname: middleName,
                    Lname: lastName,
                    contact_num: phone
                })
            });

            const data = await res.json();

            if (!res.ok) {
                setMessage({ type: 'error', text: 'Error updating profile. Please try again.' });
                return;
            }

            // Update local storage and auth context
            const updatedUser = { ...user, Fname: firstName, Mname: middleName, Lname: lastName, contact_num: phone };
            localStorage.setItem('bidpal_user', JSON.stringify(updatedUser));

            setMessage({ type: 'success', text: '✓ Your profile has been updated successfully!' });

            setTimeout(() => setMessage(''), 5000);
        } catch (err) {
            setMessage({ type: 'error', text: 'Error updating profile. Please try again.' });
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Personal Information</h1>
                <p>Update your personal information to keep your account secure.</p>
            </header>

            {message && (
                <div className={`${styles.messageBox} ${message.type === 'error' ? styles.errorMessage : styles.successMessage}`}>
                    {message.text}
                </div>
            )}

            <div className={styles.profileForm}>
                <div className={styles.formGroup}>
                    <label>First Name</label>
                    <div className={styles.inputWithIcon}>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                        />
                        <button
                            className={styles.editIconBtn}
                            type="button"
                            title="Edit first name"
                        >
                            <Pencil size={18} />
                        </button>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label>Middle Name</label>
                    <div className={styles.inputWithIcon}>
                        <input
                            type="text"
                            value={middleName}
                            onChange={(e) => setMiddleName(e.target.value)}
                        />
                        <button
                            className={styles.editIconBtn}
                            type="button"
                            title="Edit middle name"
                        >
                            <Pencil size={18} />
                        </button>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label>Last Name</label>
                    <div className={styles.inputWithIcon}>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                        />
                        <button
                            className={styles.editIconBtn}
                            type="button"
                            title="Edit last name"
                        >
                            <Pencil size={18} />
                        </button>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label>Email</label>
                    <div className={styles.readOnlyInputWrapper}>
                        <input
                            type="email"
                            value={email}
                            disabled
                            title="Email cannot be changed"
                        />
                        <div className={styles.lockedIconWrapper}>
                            <Lock size={18} color="#999" />
                        </div>
                    </div>
                    <p className={styles.helperText}>Email is used for sign-in and cannot be changed</p>
                </div>

                <div className={styles.formGroup}>
                    <label>Phone Number</label>
                    <div className={styles.inputWithIcon}>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                        <button
                            className={styles.editIconBtn}
                            type="button"
                            title="Edit phone number"
                        >
                            <Pencil size={18} />
                        </button>
                    </div>
                </div>

                <button
                    className={styles.primaryBtn}
                    onClick={handleSaveProfile}
                    disabled={loading}
                >
                    {loading ? 'Updating...' : 'Update Profile'}
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
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
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            
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
