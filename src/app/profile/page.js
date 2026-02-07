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
} from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';

function BuyerAccountContent() {
    const { logout } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');

    const [activeTab, setActiveTab] = useState('profile');
    const [addressState, setAddressState] = useState('list'); // 'list' or 'add'

    useEffect(() => {
        if (tabParam && ['profile', 'address', 'notifications', 'payment', 'wishlist', 'security', 'privacy', 'help', 'invite'].includes(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    const menuItems = [
        { id: 'profile', label: 'Edit Profile', icon: <User size={20} /> },
        { id: 'address', label: 'Address', icon: <MapPin size={20} /> },
        { id: 'notifications', label: 'Notification', icon: <Bell size={20} /> },
        { id: 'payment', label: 'Payment', icon: <CreditCard size={20} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={20} /> },
        { id: 'privacy', label: 'Privacy Policy', icon: <Lock size={20} /> },
        { id: 'help', label: 'Help Center', icon: <HelpCircle size={20} /> },
        { id: 'invite', label: 'Invite Friends', icon: <UserPlus size={20} /> },
    ];


    return (
        <div className={styles.container}>
            {/* Sidebar - Desktop - Hidden for Wishlist */}
            {activeTab !== 'wishlist' && (
                <aside className={styles.sidebar}>
                    <button className={styles.globalBack} onClick={() => router.push('/')}>
                        <ArrowLeft size={18} />
                        <span>Back to Marketplace</span>
                    </button>

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
            </main>
        </div>
    );
}

export default function BuyerAccount() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <BuyerAccountContent />
        </Suspense>
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

function WishlistSection() {
    const [wishlistItems, setWishlistItems] = useState([
        {
            id: 1,
            name: 'PixelPast Analog Camera',
            price: '2,500',
            wishlistCount: 199,
            image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=300',
            date: 'December 1, 10:00 am',
            description: 'Capture timeless moments with the PixelPast Analog Camera. Featuring a classic retro design combined with modern optics, this camera is perfect for photography enthusiasts who love the look and feel of film.'
        },
        {
            id: 2,
            name: 'Golden Horizon Set',
            price: '1,500',
            wishlistCount: 399,
            image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=300',
            date: 'December 1, 10:00 am',
            description: 'Elevate your style with the Golden Horizon Set. This exquisite collection includes premium accessories designed to make a statement, featuring fine craftsmanship and elegant gold finishes.'
        },
        {
            id: 3,
            name: 'Sunbeam Lounge Sofa',
            price: '2,500',
            wishlistCount: 396,
            image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=300',
            date: 'December 1, 10:00 am',
            description: 'Experience ultimate comfort with the Sunbeam Lounge Sofa. Its ergonomic design and soft, durable fabric provide the perfect spot for relaxation in any modern living space.'
        },
        {
            id: 4,
            name: 'Jetsetter Carry-On',
            price: '500',
            wishlistCount: 121,
            image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&q=80&w=300',
            date: 'December 1, 10:00 am',
            description: 'Travel in style and convenience with the Jetsetter Carry-On. Lightweight, durable, and featuring smooth 360-degree wheels, it’s the ideal companion for your short trips and weekend getaways.'
        },
        {
            id: 5,
            name: 'ToastMist 2-Slot',
            price: '700',
            wishlistCount: 152,
            image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=300',
            date: 'December 1, 10:00 am',
            description: 'Start your morning right with the ToastMist 2-Slot Toaster. With multiple browning levels and a sleek stainless steel finish, it combines performance with modern kitchen aesthetics.'
        },
        {
            id: 6,
            name: 'Versa DuoTone Classic',
            price: '100',
            wishlistCount: 121,
            image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=300',
            date: 'December 2, 12:00 am',
            description: 'The Versa DuoTone Classic is a versatile pair of sneakers that blends comfort with contemporary design. Perfect for everyday wear, it features a dual-tone color scheme and cushioned soles.'
        }
    ]);

    const [selectedItem, setSelectedItem] = useState(null);
    const router = useRouter();

    const handleRemoveFromWishlist = (e, id) => {
        e.stopPropagation();
        setWishlistItems(wishlistItems.filter(item => item.id !== id));
    };

    return (
        <div className={styles.section}>
            <button className={styles.globalBack} onClick={() => router.push('/')}>
                <ArrowLeft size={18} />
                <span>Back to Marketplace</span>
            </button>

            <header className={styles.sectionHeader}>
                <div className={styles.wishlistTitleHeader}>
                    <div className={styles.wishlistTitle}>
                        <span className={styles.purpleText}>My</span>
                        <span className={styles.orangeText}> Wish</span>
                        <span className={styles.yellowText}>list</span>
                    </div>
                </div>
            </header>

            <div className={styles.wishlistGrid}>
                {wishlistItems.map((item) => (
                    <div
                        key={item.id}
                        className={styles.wishlistCard}
                        onClick={() => setSelectedItem(item)}
                    >
                        <div className={styles.wishlistImageWrapper}>
                            <img src={item.image} alt={item.name} className={styles.wishlistImage} />
                        </div>
                        <div className={styles.wishlistInfo}>
                            <div className={styles.wishlistHeader}>
                                <h3 className={styles.wishlistItemName}>{item.name}</h3>
                                <button
                                    className={styles.wishlistHeart}
                                    onClick={(e) => handleRemoveFromWishlist(e, item.id)}
                                >
                                    <Heart size={20} fill="#FF4444" color="#FF4444" />
                                </button>
                            </div>
                            <div className={styles.wishlistPriceRow}>
                                <span className={styles.wishlistPrice}>₱ {item.price}</span>
                                <span className={styles.wishlistSeparator}>|</span>
                                <span className={styles.wishlistCountText}>{item.wishlistCount} users added this to wishlist</span>
                            </div>
                            <div className={styles.wishlistBadges}>
                                <div className={styles.badgeFreeShipping}>
                                    <Truck size={14} />
                                    <span>Free Shipping</span>
                                </div>
                                <div className={styles.badgeDiscount}>
                                    <Plus size={14} style={{ transform: 'rotate(45deg)' }} />
                                    <span>₱20 off</span>
                                </div>
                            </div>
                            <div className={styles.flashBidBanner}>
                                <Zap size={14} fill="white" />
                                <span>Flash Bid on {item.date}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* PRODUCT DETAIL MODAL */}
            {selectedItem && (
                <div className={styles.modalOverlay} onClick={() => setSelectedItem(null)}>
                    <div className={styles.detailModalContent} onClick={e => e.stopPropagation()}>
                        <button className={styles.modalCloseBtn} onClick={() => setSelectedItem(null)}>
                            <X size={20} />
                        </button>

                        <div className={styles.modalBody}>
                            <div className={styles.modalImageWrapper}>
                                <img src={selectedItem.image} alt={selectedItem.name} className={styles.modalImage} />
                            </div>

                            <div className={styles.modalInfoArea}>
                                <div className={styles.modalTitleRow}>
                                    <h2>{selectedItem.name}</h2>
                                    <button
                                        className={styles.modalHeartBtn}
                                        onClick={(e) => {
                                            handleRemoveFromWishlist(e, selectedItem.id);
                                            setSelectedItem(null);
                                        }}
                                    >
                                        <Heart size={24} fill="#FF4444" color="#FF4444" />
                                    </button>
                                </div>
                                <div className={styles.modalPrice}>₱ {selectedItem.price}</div>

                                <div className={styles.modalStats}>
                                    <Heart size={16} fill="#FF4444" color="#FF4444" />
                                    <span>{selectedItem.wishlistCount} people love this</span>
                                </div>

                                <div className={styles.modalDescription}>
                                    <h3>Description</h3>
                                    <p>{selectedItem.description}</p>
                                </div>

                                <div className={styles.modalFooter}>
                                    <button className={styles.modalActionBtn}>Explore Item</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

