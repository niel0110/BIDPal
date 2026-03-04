'use client';

import { useState, Suspense, useEffect } from 'react';
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

function AccountContent() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const isSeller = user?.role === 'seller';

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
        return user.role === 'seller' ? 'Seller' : 'Buyer';
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

                    <button className={styles.logoutNavBtn} onClick={logout}>
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
        { label: 'Total Revenue', value: '₱ 452,100', change: '+12.5%', isPositive: true, icon: <DollarSign size={24} />, color: 'purple' },
        { label: 'Items Sold', value: '1,280', change: '+8.2%', isPositive: true, icon: <ShoppingBag size={24} />, color: 'blue' },
        { label: 'Followers', value: '842', change: '+15.1%', isPositive: true, icon: <Users size={24} />, color: 'orange' },
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
                    {[40, 65, 80, 50, 95, 70, 85].map((h, i) => (
                        <div key={i} className={styles.barWrapper}>
                            <div className={styles.bar} style={{ height: `${h}%` }}></div>
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
                        <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1000" alt="Banner" />
                        <button className={styles.changeBannerBtn}><Camera size={18} /> Edit Banner</button>
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label>Store Name</label>
                    <input type="text" defaultValue="Retro Vault" />
                </div>

                <div className={styles.formGroup}>
                    <label>Store Handle</label>
                    <div className={styles.inputWithPrefix}>
                        <span className={styles.prefix}>bidpal.com/</span>
                        <input type="text" defaultValue="retrovault" />
                    </div>
                </div>

                <div className={styles.formGroup}>
                    <label>Store Description</label>
                    <textarea
                        rows={4}
                        defaultValue="Premium curator of vintage electronics and analog rarities. Based in Davao City, serving collectors nationwide."
                    />
                </div>

                <div className={styles.formGroup}>
                    <label>Business Category</label>
                    <div className={styles.selectWrapper}>
                        <select defaultValue="Gadgets">
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
    if (state === 'add') {
        return (
            <div className={styles.section}>
                <header className={styles.sectionHeader}>
                    <button className={styles.backBtn} onClick={() => setState('list')}>
                        <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /> Back
                    </button>
                    <h1>Add New Address</h1>
                </header>

                <div className={styles.mapPlaceholder}>
                    <MapPin size={48} color="var(--color-primary)" />
                    <p>Interactive Map Integration</p>
                </div>

                <div className={styles.addressForm}>
                    <div className={styles.formGroup}>
                        <label>Address Name</label>
                        <input type="text" placeholder="e.g. Home, Office, Apartment" />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Full Address Details</label>
                        <div className={styles.inputWithIcon}>
                            <input type="text" placeholder="Street, Building, Barangay, City" />
                            <MapPin size={18} color="#999" />
                        </div>
                    </div>
                    <div className={styles.checkboxGroup}>
                        <input type="checkbox" id="defaultAddr" />
                        <label htmlFor="defaultAddr">Make this as the default address</label>
                    </div>
                    <button className={styles.primaryBtn}>Add Address</button>
                </div>
            </div>
        );
    }

    const addresses = [
        { type: 'Home', detail: 'Matina Crossing, Davao City', isDefault: true },
        { type: 'School', detail: 'University of Southeastern Philippines' }
    ];

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Addresses</h1>
                <p>Manage your delivery locations for faster checkout.</p>
            </header>

            <div className={styles.addressList}>
                {addresses.map((addr, i) => (
                    <div key={i} className={styles.addressCard}>
                        <div className={styles.addressIcon}>
                            <MapPin size={24} color="white" />
                        </div>
                        <div className={styles.addressInfo}>
                            <div className={styles.addressTypeLine}>
                                <h3>{addr.type}</h3>
                                {addr.isDefault && <span className={styles.defaultBadge}>Default</span>}
                            </div>
                            <p>{addr.detail}</p>
                        </div>
                        <button className={styles.editBtn}><Pencil size={18} /></button>
                    </div>
                ))}
            </div>

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
