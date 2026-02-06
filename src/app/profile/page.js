'use client';

import { useState } from 'react';
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
    Settings
} from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function BuyerAccount() {
    const { logout } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('profile');
    const [addressState, setAddressState] = useState('list'); // 'list' or 'add'

    const menuItems = [
        { id: 'profile', label: 'Edit Profile', icon: <User size={20} /> },
        { id: 'address', label: 'Address', icon: <MapPin size={20} /> },
        { id: 'orders', label: 'My Orders', icon: <ClipboardList size={20} /> },
        { id: 'notifications', label: 'Notification', icon: <Bell size={20} /> },
        { id: 'payment', label: 'Payment', icon: <CreditCard size={20} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={20} /> },
        { id: 'privacy', label: 'Privacy Policy', icon: <Lock size={20} /> },
        { id: 'help', label: 'Help Center', icon: <HelpCircle size={20} /> },
        { id: 'invite', label: 'Invite Friends', icon: <UserPlus size={20} /> },
    ];


    return (
        <div className={styles.container}>
            {/* Sidebar - Desktop */}
            <aside className={styles.sidebar}>
                <div className={styles.userBrief}>
                    <div className={styles.avatarWrapper}>
                        <img
                            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Lilian"
                            alt="Lilian Grace"
                            className={styles.avatar}
                        />
                        <button className={styles.editAvatar}>
                            <Pencil size={14} />
                        </button>
                    </div>
                    <h2 className={styles.userName}>Lilian Grace Dawatan</h2>
                    <p className={styles.userRole}>Buyer Member</p>
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
            </aside>

            {/* Main Content Area */}
            <main className={styles.content}>
                {activeTab === 'profile' && <ProfileSection />}
                {activeTab === 'address' && <AddressSection state={addressState} setState={setAddressState} />}
                {activeTab === 'notifications' && <NotificationSection />}
                {activeTab === 'payment' && <PaymentSection />}
                {activeTab === 'security' && <SecuritySection />}
                {activeTab === 'privacy' && <PrivacySection />}
                {activeTab === 'help' && <HelpCenterSection />}
                {activeTab === 'invite' && <InviteSection />}
                {activeTab === 'orders' && (
                    <div className={styles.placeholderSection}>
                        <h2>My Orders</h2>
                        <p>Your order history will appear here.</p>
                    </div>
                )}
            </main>
        </div>
    );
}

function ProfileSection() {
    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Edit Profile</h1>
                <p>Update your personal information to keep your account secure.</p>
            </header>

            <div className={styles.profileForm}>
                <div className={styles.formGroup}>
                    <label>Full Name</label>
                    <input type="text" defaultValue="Lilian Grace Dawatan" />
                </div>
                <div className={styles.formGroup}>
                    <label>Nickname</label>
                    <input type="text" defaultValue="Lilian" />
                </div>
                <div className={styles.formGroup}>
                    <label>Date of Birth</label>
                    <div className={styles.inputWithIcon}>
                        <input type="text" defaultValue="10/22/2002" />
                        <Calendar size={18} color="#999" />
                    </div>
                </div>
                <div className={styles.formGroup}>
                    <label>Email</label>
                    <div className={styles.inputWithIcon}>
                        <input type="email" defaultValue="lgdawatan@usep.edu.ph" />
                        <Mail size={18} color="#999" />
                    </div>
                </div>
                <div className={styles.formGroup}>
                    <label>Phone Number</label>
                    <input type="tel" defaultValue="09091234567" />
                </div>
                <div className={styles.formGroup}>
                    <label>Gender</label>
                    <div className={styles.selectWrapper}>
                        <select defaultValue="Female">
                            <option>Female</option>
                            <option>Male</option>
                            <option>Rather not say</option>
                        </select>
                        <ChevronDown size={18} color="#999" />
                    </div>
                </div>
                <button className={styles.primaryBtn}>Update Profile</button>
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
        { type: 'School', detail: 'University of Southeastern Philippines' },
        { type: 'Office', detail: 'Toril, Davao City' },
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
        { label: 'Sound', enabled: true },
        { label: 'Vibrate', enabled: false },
        { label: 'Special Offers', enabled: true },
        { label: 'Promo & Discount', enabled: true },
        { label: 'Payments', enabled: true },
        { label: 'Cashback', enabled: true },
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
        { name: 'Apple Pay', status: 'Connected', icon: <img src="https://upload.wikimedia.org/wikipedia/commons/b/b0/Apple_Pay_logo.svg" alt="Apple Pay" width="24" /> },
        { name: 'Mastercard', status: 'Connected', icon: <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" width="24" />, detail: '**** **** **** 1234' },
    ];

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <div className={styles.titleWithAction}>
                    <h1>Payment</h1>
                    <button className={styles.iconBtn}><Settings size={20} /></button>
                </div>
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
                <button className={styles.secondaryBtnLarge}>My E-Wallet</button>
            </div>

            <button className={styles.addFullBtn}>
                <Plus size={20} /> Add New Card
            </button>
        </div>
    );
}

function SecuritySection() {
    const toggles = [
        { label: 'Remember me', enabled: true },
        { label: 'Face ID', enabled: true },
        { label: 'Biometric ID', enabled: false },
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

                <div className={styles.navActionItem}>
                    <span>Google Authenticator</span>
                    <ChevronRight size={18} />
                </div>
            </div>

            <div className={styles.buttonStack}>
                <button className={styles.secondaryBtnLarge}>Change Pin</button>
                <button className={styles.secondaryBtnLarge}>Change Password</button>
            </div>
        </div>
    );
}

function PrivacySection() {
    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <div className={styles.backTitle}>
                    <ChevronRight size={24} style={{ transform: 'rotate(180deg)' }} className={styles.backIcon} />
                    <h1>Privacy Policy</h1>
                </div>
                <div className={styles.datesLine}>
                    <p>Effective Date: June 24, 2025</p>
                    <p>Last Updated: January 08, 2026</p>
                </div>
            </header>

            <div className={styles.policyContent}>
                <p className={styles.introText}>
                    <span className={styles.brandLi}>BID</span>
                    <span className={styles.brandBid}>Pal</span> values your privacy and is committed to protecting your personal information. This Privacy Policy outlines how we collect, use, and safeguard your data when you use our mobile app and services.
                </p>

                <div className={styles.policySection}>
                    <h3>1. Information We Collect</h3>
                    <ul>
                        <li><strong>Account Info:</strong> Name, email, phone number, password</li>
                        <li><strong>Auction Activity:</strong> Bids, items listed, purchase history</li>
                        <li><strong>Payment Details:</strong> Credit/debit card info (processed securely by third-party gateways)</li>
                        <li><strong>Device Info:</strong> IP address, device ID, OS, app version</li>
                        <li><strong>Communications:</strong> Messages, feedback, chat logs</li>
                    </ul>
                </div>

                <div className={styles.policySection}>
                    <h3>2. How We Use Your Data</h3>
                    <ul>
                        <li>To process transactions and facilitate live auctions</li>
                        <li>To provide customer support and resolve disputes</li>
                        <li>To personalize content and recommend items</li>
                        <li>To send updates, alerts, and promotional content (optional)</li>
                        <li>To improve app performance and detect fraud</li>
                    </ul>
                </div>

                <div className={styles.policySection}>
                    <h3>3. Data Sharing</h3>
                    <ul>
                        <li>With logistics partners for delivery</li>
                        <li>With payment gateways for processing</li>
                        <li>With customer support agents</li>
                        <li>Legal authorities if required by law</li>
                    </ul>
                </div>

                <div className={styles.policySection}>
                    <h3>4. Your Rights</h3>
                    <ul>
                        <li>Access or correct your information</li>
                        <li>Request deletion of your account</li>
                        <li>Opt out of marketing communications</li>
                        <li>File complaints under [Philippine DPA / GDPR] as applicable</li>
                    </ul>
                </div>

                <div className={styles.policySection}>
                    <h3>5. Security</h3>
                    <p>We implement industry-standard encryption and authentication to protect your data.</p>
                </div>

                <div className={styles.policySection}>
                    <h3>6. Children's Privacy</h3>
                    <p>BIDPal is not intended for users under 18. We do not knowingly collect data from minors.</p>
                </div>

                <div className={styles.policySection}>
                    <h3>7. Changes to This Policy</h3>
                    <p>We may update this policy periodically. You will be notified via app notification or email.</p>
                </div>

                <div className={styles.policySection}>
                    <h3>8. Contact Us</h3>
                    <p>For questions or concerns, contact us at:</p>
                    <div className={styles.contactInfo}>
                        <div className={styles.contactItem}>
                            <Mail size={18} />
                            <span>support@bidpalapp.com</span>
                        </div>
                        <div className={styles.contactItem}>
                            <Phone size={18} />
                            <span>+639091234567</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HelpCenterSection() {
    const [activeSubTab, setActiveSubTab] = useState('faq');
    const [activeCategory, setActiveCategory] = useState('General');

    const faqs = [
        { q: 'What is BIDPal?', a: 'BIDPal is a vibrant live auction marketplace where buyers and sellers interact in real-time to bid, sell, and win unique items.' },
        { q: 'How to use BIDPal?', a: 'Sign up, find a live auction, and start bidding! It\'s that simple.' },
        { q: 'How to sell products in BIDPal?', a: 'Switch to a seller account and use the "Add Product" flow to start your first auction.' },
        { q: 'Can I cancel the bidding?', a: 'Bids are usually final, but check our cancellation policy for specific cases.' },
    ];

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Help Center</h1>
                <div className={styles.subTabs}>
                    <button
                        className={`${styles.subTab} ${activeSubTab === 'faq' ? styles.activeSubTab : ''}`}
                        onClick={() => setActiveSubTab('faq')}
                    >
                        FAQ
                    </button>
                    <button
                        className={`${styles.subTab} ${activeSubTab === 'contact' ? styles.activeSubTab : ''}`}
                        onClick={() => setActiveSubTab('contact')}
                    >
                        Contact us
                    </button>
                </div>
            </header>

            {activeSubTab === 'faq' ? (
                <div className={styles.helpView}>
                    <div className={styles.categoryScroll}>
                        {['General', 'Account', 'Service', 'Payment'].map(cat => (
                            <button
                                key={cat}
                                className={`${styles.catChip} ${activeCategory === cat ? styles.activeChip : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className={styles.searchBox}>
                        <Search size={18} color="#999" />
                        <input type="text" placeholder="Search for questions..." />
                    </div>

                    <div className={styles.accordionList}>
                        {faqs.map((faq, i) => (
                            <details key={i} className={styles.faqItem}>
                                <summary className={styles.faqQuestion}>
                                    <span>{faq.q}</span>
                                    <ChevronDown size={18} className={styles.accordionArrow} />
                                </summary>
                                <p className={styles.faqAnswer}>{faq.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            ) : (
                <div className={styles.helpView}>
                    <div className={styles.contactList}>
                        {[
                            { name: 'Customer Service', icon: <HelpCircle /> },
                            { name: 'WhatsApp', icon: <MessageSquare /> },
                            { name: 'Website', icon: <Globe /> },
                            { name: 'Facebook', icon: <Facebook /> },
                            { name: 'Instagram', icon: <Instagram /> },
                        ].map((item, i) => (
                            <div key={i} className={styles.contactCard}>
                                <div className={styles.contactIcon}>{item.icon}</div>
                                <span>{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function InviteSection() {
    const [searchQuery, setSearchQuery] = useState('');
    const friends = [
        { name: 'Russell Ann Varquez', phone: '+639991212123' },
        { name: 'Keilah Maira España', phone: '+639991212123' },
        { name: 'Xnea Manlangit', phone: '+639991212123' },
        { name: 'Julie Mae Bagnnotan', phone: '+639991212123' },
        { name: 'KC Bongato', phone: '+639991212123' },
        { name: 'Jenifer Cal', phone: '+639991212123' },
        { name: 'Lara Audrey Superales', phone: '+639991212123' },
        { name: 'Mona Arsonillo', phone: '+639991212123' },
        { name: 'Avi Abellana', phone: '+639991212123' },
        { name: 'Niel Patrick Israel', phone: '+639991212123' },
    ];

    const filteredFriends = friends.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.phone.includes(searchQuery)
    );

    return (
        <div className={styles.section}>
            <header className={styles.sectionHeader}>
                <h1>Invite Friends</h1>
                <p>Share the fun and invite your friends to join BIDPal!</p>
            </header>

            <div className={styles.searchBox}>
                <Search size={18} color="#999" />
                <input
                    type="text"
                    placeholder="Search by name or number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className={styles.friendsList}>
                {filteredFriends.length > 0 ? (
                    filteredFriends.map((f, i) => (
                        <div key={i} className={styles.friendCard}>
                            <div className={styles.friendAvatar}>
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${f.name}`} alt={f.name} />
                            </div>
                            <div className={styles.friendInfo}>
                                <h3>{f.name}</h3>
                                <p>{f.phone}</p>
                            </div>
                            <button className={styles.inviteBtn}>Invite</button>
                        </div>
                    ))
                ) : (
                    <div className={styles.noResults}>
                        <p>No friends found matching "{searchQuery}"</p>
                    </div>
                )}
            </div>
        </div>
    );
}

