'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    Store,
    MapPin,
    CreditCard,
    Video,
    Plus,
    Camera,
    ChevronRight,
    Save,
    CheckCircle,
    Clock,
} from 'lucide-react';
import styles from './page.module.css';

export default function SellerSettings() {
    const { user } = useAuth();
    const logoInputRef = useRef(null);
    const bannerInputRef = useRef(null);
    const [activeSection, setActiveSection] = useState('profile');

    const [profile, setProfile] = useState({
        store_name: '',
        store_description: '',
        business_category: '',
        store_handle: '',
        logo_url: '',
        banner_url: ''
    });

    const [business, setBusiness] = useState({
        full_name: '',
        phone: '',
        address_line1: '',
        city_province: ''
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const initialProfileRef = useRef(null);

    useEffect(() => {
        if (!user?.user_id) return;

        const fetchData = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');
                
                // Fetch seller profile
                const res = await fetch(`${apiUrl}/api/sellers/user/${user.user_id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    const nextProfile = {
                        seller_id: data.seller_id,
                        store_name: data.store_name || '',
                        store_description: data.store_description || '',
                        business_category: data.business_category || '',
                        store_handle: data.store_handle || '',
                        logo_url: data.logo_url || '',
                        banner_url: data.banner_url || ''
                    };
                    setProfile(nextProfile);
                    initialProfileRef.current = {
                        store_name: nextProfile.store_name,
                        store_description: nextProfile.store_description,
                        business_category: nextProfile.business_category,
                        store_handle: nextProfile.store_handle
                    };
                }
            } catch (err) {
                console.error('Settings fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const hasProfileChanges = (() => {
        const initial = initialProfileRef.current;
        if (!initial) return false;
        return (
            profile.store_name !== initial.store_name ||
            profile.store_description !== initial.store_description ||
            profile.business_category !== initial.business_category ||
            profile.store_handle !== initial.store_handle
        );
    })();

    const canSaveProfile = Boolean(profile.seller_id && hasProfileChanges && !saving);

    const handleSaveProfile = async () => {
        if (!canSaveProfile) return;
        setSaving(true);
        setSaveStatus('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${apiUrl}/api/sellers/${profile.seller_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    store_name: profile.store_name,
                    store_description: profile.store_description,
                    business_category: profile.business_category,
                    store_handle: profile.store_handle
                })
            });

            if (res.ok) {
                initialProfileRef.current = {
                    store_name: profile.store_name,
                    store_description: profile.store_description,
                    business_category: profile.business_category,
                    store_handle: profile.store_handle
                };
                setSaveStatus('Changes saved successfully!');
                setTimeout(() => setSaveStatus(''), 3000);
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (err) {
            setSaveStatus('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (event, type) => {
        const file = event.target.files[0];
        if (!file) return;

        setSaving(true);
        setSaveStatus(`Uploading ${type}...`);
        
        const formData = new FormData();
        formData.append(type, file);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            
            const endpoint = type === 'logo' ? `/api/sellers/${profile.seller_id}/logo` : `/api/sellers/${profile.seller_id}/banner`;
            
            const res = await fetch(`${apiUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                if (type === 'logo') {
                    setProfile(prev => ({ ...prev, logo_url: data.logoUrl }));
                } else {
                    setProfile(prev => ({ ...prev, banner_url: data.bannerUrl }));
                }
                setSaveStatus(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully!`);
                setTimeout(() => setSaveStatus(''), 3000);
            } else {
                const errorData = await res.json();
                throw new Error(errorData.error || `Failed to upload ${type}`);
            }
        } catch (err) {
            setSaveStatus('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const navItems = [
        { id: 'profile', label: 'Store Profile', icon: <Store size={20} /> },
        { id: 'business', label: 'Business Info', icon: <MapPin size={20} /> },
        { id: 'payout', label: 'Payout Settings', icon: <CreditCard size={20} /> },
        { id: 'live', label: 'Live Preferences', icon: <Video size={20} /> },
    ];


    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <h1>Settings</h1>
                    <p>Manage your store preferences and business account.</p>
                </div>
                <button className={styles.saveBtn} onClick={handleSaveProfile} disabled={!canSaveProfile}>
                    {saving ? 'Saving...' : (
                        <>
                            <Save size={18} />
                            Save Changes
                        </>
                    )}
                </button>
                {saveStatus && <p className={styles.statusMsg}>{saveStatus}</p>}
            </header>

            <div className={styles.settingsWrapper}>
                {/* Navigation Sidebar */}
                <nav className={styles.sideNav}>
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            className={`${styles.navItem} ${activeSection === item.id ? styles.activeNav : ''}`}
                            onClick={() => setActiveSection(item.id)}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                            <ChevronRight size={16} className={styles.navArrow} />
                        </button>
                    ))}
                </nav>

                {/* Content Area */}
                <main className={styles.content}>
                    {activeSection === 'profile' && (
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <h2>Store Profile</h2>
                                <p>How customers see your shop on the marketplace.</p>
                            </div>

                            <div className={styles.mediaUploads}>
                                <div 
                                    className={styles.bannerUpload}
                                    onClick={() => bannerInputRef.current?.click()}
                                    style={{ 
                                        backgroundImage: profile.banner_url ? `url(${profile.banner_url})` : 'none',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <input 
                                        type="file" 
                                        ref={bannerInputRef} 
                                        hidden 
                                        accept="image/*" 
                                        onChange={(e) => handleFileUpload(e, 'banner')}
                                    />
                                    {!profile.banner_url && (
                                        <div className={styles.bannerPlaceholder}>
                                            <Camera size={32} color="#ccc" />
                                            <span>Change Banner</span>
                                        </div>
                                    )}
                                </div>
                                <div className={styles.logoUpload}>
                                    <div 
                                        className={styles.logoPlaceholder}
                                        style={{ 
                                            backgroundImage: profile.logo_url ? `url(${profile.logo_url})` : 'none',
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center'
                                        }}
                                    >
                                        {!profile.logo_url && <Camera size={24} color="#ccc" />}
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={logoInputRef} 
                                        hidden 
                                        accept="image/*" 
                                        onChange={(e) => handleFileUpload(e, 'logo')}
                                    />
                                    <button 
                                        className={styles.changeBtn}
                                        onClick={() => logoInputRef.current?.click()}
                                    >
                                        Change Logo
                                    </button>
                                </div>
                            </div>

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Store Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter store name" 
                                        value={profile.store_name}
                                        onChange={e => setProfile({...profile, store_name: e.target.value})}
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Bio / Description</label>
                                    <textarea 
                                        rows="4" 
                                        placeholder="Tell buyers about your shop..."
                                        value={profile.store_description}
                                        onChange={e => setProfile({...profile, store_description: e.target.value})}
                                    ></textarea>
                                    <span className={styles.charCount}>{profile.store_description.length} / 500</span>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Store Category</label>
                                    <select 
                                        value={profile.business_category}
                                        onChange={e => setProfile({...profile, business_category: e.target.value})}
                                    >
                                        <option>Fashion & Accessories</option>
                                        <option>Gadgets & Electronics</option>
                                        <option>Collectibles & Antiques</option>
                                        <option>Home & Living</option>
                                        <option>Books & Hobbies</option>
                                        <option>Sports & Outdoors</option>
                                        <option>Art & Crafts</option>
                                        <option>Food & Beverages</option>
                                        <option>Others</option>
                                    </select>
                                </div>
                            </div>
                        </section>
                    )}

                    {activeSection === 'business' && (
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <h2>Business Information</h2>
                                <p>Legal identity and contact details for verification.</p>
                            </div>

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Full Legal Name</label>
                                    <input type="text" placeholder="Your full legal name" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Phone Number</label>
                                    <div className={styles.verifiedInput}>
                                        <input type="tel" placeholder="+63 9XX XXX XXXX" />
                                        <CheckCircle size={18} color="#388E3C" />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Business Address</label>
                                    <input type="text" placeholder="Street Address, Building, Floor" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>City & Province</label>
                                    <input type="text" placeholder="e.g. Makati City, Metro Manila" />
                                </div>
                            </div>
                        </section>
                    )}

                    {activeSection === 'payout' && (
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <h2>Payout Settings</h2>
                                <p>Manage where your sales revenue is deposited.</p>
                            </div>

                            <div className={styles.payoutOptions}>
                                <div className={styles.emptyPayout}>
                                    <p>No payout methods added yet.</p>
                                </div>

                                <button className={styles.addPayoutBtn}>
                                    <Plus size={20} />
                                    <span>Add Payout Method</span>
                                </button>
                            </div>
                        </section>
                    )}

                    {activeSection === 'live' && (
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <h2>Live Session Preferences</h2>
                                <p>Default settings for your auction broadcasts.</p>
                            </div>

                            <div className={styles.toggleGroup}>
                                <div className={styles.toggleItem}>
                                    <div className={styles.itemInfo}>
                                        <h4>Record Live Sessions</h4>
                                        <p>Automatically save a recording of your stream.</p>
                                    </div>
                                    <label className={styles.switch}>
                                        <input type="checkbox" defaultChecked />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.toggleItem}>
                                    <div className={styles.itemInfo}>
                                        <h4>Auto-Next Product</h4>
                                        <p>Start the next auction in queue immediately after closing.</p>
                                    </div>
                                    <label className={styles.switch}>
                                        <input type="checkbox" />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Default Bidding Time (Minutes)</label>
                                <div className={styles.timeInput}>
                                    <Clock size={18} />
                                    <input type="number" defaultValue="5" min="1" max="60" />
                                </div>
                            </div>
                        </section>
                    )}

                </main>
            </div>
        </div>
    );
}
