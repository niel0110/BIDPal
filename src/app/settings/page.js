'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronDown,
    ShieldCheck,
    Lock,
    LogOut,
    ArrowLeft,
    Globe,
    Zap,
    Monitor,
    Bell,
    CreditCard
} from 'lucide-react';
import styles from './page.module.css';

export default function SettingsPage() {
    const router = useRouter();
    const [activeSection, setActiveSection] = useState('general');

    const navItems = [
        { id: 'general', label: 'General', icon: <Globe size={18} /> },
        { id: 'experience', label: 'Experience', icon: <Zap size={18} /> },
        { id: 'regional', label: 'Regional', icon: <Monitor size={18} /> },
        { id: 'account', label: 'Account', icon: <ShieldCheck size={18} /> },
    ];

    const scrollToSection = (id) => {
        setActiveSection(id);
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className={styles.container}>
            <button className={styles.globalBack} onClick={() => router.push('/')}>
                <ArrowLeft size={16} />
                <span>Back to Marketplace</span>
            </button>

            <header className={styles.headerWrap}>
                <div className={styles.titleMain}>
                    <h1>Settings</h1>
                    <p>Manage your account preferences and app behavior.</p>
                </div>
            </header>

            <div className={styles.contentGrid}>
                {/* Minimal Lateral Navigation */}
                <aside>
                    <div className={styles.navRail}>
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                className={`${styles.railItem} ${activeSection === item.id ? styles.activeRail : ''}`}
                                onClick={() => scrollToSection(item.id)}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Settings Content Area */}
                <div className={styles.settingsArea}>

                    {/* General Preferences */}
                    <section id="general" className={styles.settingsGroup}>
                        <div className={styles.groupHeader}>
                            <h2>General Preferences</h2>
                        </div>
                        <div className={styles.cardGrid}>
                            <div className={styles.premiumCard}>
                                <div className={styles.controlGroup}>
                                    <label className={styles.controlLabel}>Language</label>
                                    <div className={styles.customSelect}>
                                        <select defaultValue="en">
                                            <option value="en">English</option>
                                            <option value="ph">Tagalog</option>
                                        </select>
                                        <ChevronDown className={styles.selectArrow} size={18} />
                                    </div>
                                </div>
                                <div className={styles.controlGroup}>
                                    <label className={styles.controlLabel}>Currency</label>
                                    <div className={styles.customSelect}>
                                        <select defaultValue="php">
                                            <option value="php">PHP (₱)</option>
                                            <option value="usd">USD ($)</option>
                                        </select>
                                        <ChevronDown className={styles.selectArrow} size={18} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Display & Experience */}
                    <section id="experience" className={styles.settingsGroup}>
                        <div className={styles.groupHeader}>
                            <h2>Display & Experience</h2>
                        </div>
                        <div className={styles.cardGrid}>
                            <div className={styles.premiumCard}>
                                <div className={styles.toggleRow}>
                                    <div className={styles.toggleText}>
                                        <h4>Dark Mode</h4>
                                        <p>Toggle dark interface theme</p>
                                    </div>
                                    <label className={styles.switch}>
                                        <input type="checkbox" />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>
                                <div className={styles.toggleRow}>
                                    <div className={styles.toggleText}>
                                        <h4>Animations</h4>
                                        <p>Enable app-wide transitions</p>
                                    </div>
                                    <label className={styles.switch}>
                                        <input type="checkbox" defaultChecked />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Regional Settings */}
                    <section id="regional" className={styles.settingsGroup}>
                        <div className={styles.groupHeader}>
                            <h2>Regional Settings</h2>
                        </div>
                        <div className={styles.cardGrid}>
                            <div className={styles.premiumCard}>
                                <div className={styles.controlGroup}>
                                    <label className={styles.controlLabel}>Timezone</label>
                                    <div className={styles.customSelect}>
                                        <select defaultValue="manila">
                                            <option value="manila">Manila (GMT+8)</option>
                                            <option value="tokyo">Tokyo (GMT+9)</option>
                                        </select>
                                        <ChevronDown className={styles.selectArrow} size={18} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Account Actions */}
                    <section id="account" className={styles.settingsGroup}>
                        <div className={styles.groupHeader}>
                            <h2>Account Center</h2>
                        </div>
                        <div className={styles.actionStack}>
                            <div className={styles.actionNode}>
                                <div className={styles.nodeIcon}><Lock size={20} /></div>
                                <span>Privacy</span>
                            </div>
                            <div className={styles.actionNode}>
                                <div className={styles.nodeIcon}><CreditCard size={20} /></div>
                                <span>Payouts</span>
                            </div>
                            <div className={`${styles.actionNode} ${styles.dangerNode}`}>
                                <div className={styles.nodeIcon}><LogOut size={20} /></div>
                                <span>Deactivate</span>
                            </div>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
}
