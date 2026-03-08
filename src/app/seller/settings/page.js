'use client';

import { useState } from 'react';
import {
    Store,
    MapPin,
    CreditCard,
    Video,
    Plus,
    Settings as SettingsIcon,
    Camera,
    ChevronRight,
    Save,
    CheckCircle,
    Clock,
    Globe
} from 'lucide-react';
import styles from './page.module.css';

export default function SellerSettings() {
    const [activeSection, setActiveSection] = useState('profile');

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
                <button className={styles.saveBtn}>
                    <Save size={18} />
                    Save Changes
                </button>
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
                                <div className={styles.bannerUpload}>
                                    <div className={styles.bannerPlaceholder}>
                                        <Camera size={32} color="#ccc" />
                                        <span>Change Banner</span>
                                    </div>
                                </div>
                                <div className={styles.logoUpload}>
                                    <div className={styles.logoPlaceholder}>
                                        <Camera size={24} color="#ccc" />
                                    </div>
                                    <button className={styles.changeBtn}>Change Logo</button>
                                </div>
                            </div>

                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Store Name</label>
                                    <input type="text" placeholder="Enter store name" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Bio / Description</label>
                                    <textarea rows="4" placeholder="Tell buyers about your shop..."></textarea>
                                    <span className={styles.charCount}>0 / 500</span>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Store Category</label>
                                    <select>
                                        <option>Antiques & Collectibles</option>
                                        <option>Fashion & Accessories</option>
                                        <option>Home & Living</option>
                                        <option>Electronics</option>
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
