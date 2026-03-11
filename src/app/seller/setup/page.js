'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Check, Package, ArrowRight } from 'lucide-react';
import PhilippineIDVerification from '@/components/PhilippineIDVerification';
import styles from './page.module.css';

const STEPS = [
    { id: 1, title: 'Personal Info', sub: 'About you as a seller' },
    { id: 2, title: 'Store Details', sub: 'Your shop information' },
    { id: 3, title: 'Address', sub: 'Pick-up & store location' },
    { id: 4, title: 'Verification', sub: 'Philippine ID check' },
];

// ─── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar({ currentStep }) {
    return (
        <aside className={styles.sidebar}>
            <div className={styles.sidebarLogo}><span>BID</span>Pal</div>
            <p className={styles.sidebarTagline}>Seller Onboarding</p>

            <div className={styles.stepsList}>
                {STEPS.map(s => (
                    <div
                        key={s.id}
                        className={`${styles.sidebarStep} ${currentStep === s.id ? styles.active : ''} ${currentStep > s.id ? styles.completed : ''}`}
                    >
                        <div className={styles.sidebarStepNum}>
                            {currentStep > s.id ? <Check size={14} /> : s.id}
                        </div>
                        <div className={styles.sidebarStepText}>
                            <span className={styles.sidebarStepTitle}>{s.title}</span>
                            <span className={styles.sidebarStepSub}>{s.sub}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.sidebarFooter}>© 2026 BIDPal · All rights reserved</div>
        </aside>
    );
}

// ─── Step 1: Personal Information ──────────────────────────────────────────
function PersonalInfoStep({ data, onChange, onNext }) {
    const isValid = data.firstName && data.lastName && data.birthday && data.gender && data.contactNumber;
    return (
        <div className={styles.formArea}>
            <h2 className={styles.formTitle}>Personal <span className={styles.redText}>Information</span></h2>
            <p className={styles.formSubtitle}>Tell us a bit about yourself. This helps us verify your account.</p>

            <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                    <label>First Name</label>
                    <input className={styles.input} placeholder="Juan" value={data.firstName} onChange={e => onChange({ firstName: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Last Name</label>
                    <input className={styles.input} placeholder="Dela Cruz" value={data.lastName} onChange={e => onChange({ lastName: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Middle Name (Optional)</label>
                    <input className={styles.input} placeholder="Santos" value={data.middleName} onChange={e => onChange({ middleName: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Birthday</label>
                    <input className={styles.input} type="date" max={new Date().toISOString().split('T')[0]} value={data.birthday} onChange={e => onChange({ birthday: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Gender</label>
                    <select className={styles.select} value={data.gender} onChange={e => onChange({ gender: e.target.value })}>
                        <option value="">Select Gender</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Non-binary</option>
                        <option>Prefer not to say</option>
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label>Contact Number</label>
                    <input className={styles.input} type="tel" placeholder="+63 917 123 4567" value={data.contactNumber} onChange={e => onChange({ contactNumber: e.target.value })} />
                </div>
                <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                    <label>Bio / Short Introduction (Optional)</label>
                    <textarea className={styles.textarea} rows={3} placeholder="A bit about who you are and what you sell..." value={data.bio} onChange={e => onChange({ bio: e.target.value })} />
                </div>
            </div>

            <div className={styles.formActions}>
                <button className={styles.nextBtn} onClick={onNext} disabled={!isValid}>
                    Next Step <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}

// ─── Step 2: Store Information ─────────────────────────────────────────────
function StoreInfoStep({ data, onChange, onNext, onBack }) {
    const isValid = data.storeName && data.category && data.description;
    return (
        <div className={styles.formArea}>
            <h2 className={styles.formTitle}>Store <span className={styles.redText}>Details</span></h2>
            <p className={styles.formSubtitle}>Describe your shop. Make it memorable for buyers.</p>

            <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                    <label>Store Name</label>
                    <input className={styles.input} placeholder="e.g. Juan's Vintage Corner" value={data.storeName} onChange={e => onChange({ storeName: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Business Category</label>
                    <select className={styles.select} value={data.category} onChange={e => onChange({ category: e.target.value })}>
                        <option value="">Select Category</option>
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
                <div className={styles.formGroup}>
                    <label>Store Handle</label>
                    <input className={styles.input} placeholder="juansvintage" value={data.handle} onChange={e => onChange({ handle: e.target.value })} />
                </div>
                <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                    <label>Store Description</label>
                    <textarea className={styles.textarea} rows={4} placeholder="Tell buyers what makes your store unique..." value={data.description} onChange={e => onChange({ description: e.target.value })} />
                </div>
            </div>

            <div className={styles.formActions}>
                <button className={styles.backBtn} onClick={onBack}>Back</button>
                <button className={styles.nextBtn} onClick={onNext} disabled={!isValid}>
                    Next Step <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}

// ─── Step 3: Address ───────────────────────────────────────────────────────
function AddressStep({ data, onChange, onNext, onBack }) {
    const isValid = data.street && data.barangay && data.city && data.province && data.region && data.zipCode;
    return (
        <div className={styles.formArea}>
            <h2 className={styles.formTitle}>Pick-up <span className={styles.redText}>Address</span></h2>
            <p className={styles.formSubtitle}>This is where buyers' shipments will originate. Use your store or home address.</p>

            <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                    <label>Region</label>
                    <select className={styles.select} value={data.region} onChange={e => onChange({ region: e.target.value })}>
                        <option value="">Select Region</option>
                        <option>NCR – Metro Manila</option>
                        <option>Region I – Ilocos</option>
                        <option>Region II – Cagayan Valley</option>
                        <option>Region III – Central Luzon</option>
                        <option>Region IV-A – CALABARZON</option>
                        <option>Region IV-B – MIMAROPA</option>
                        <option>Region V – Bicol</option>
                        <option>Region VI – Western Visayas</option>
                        <option>Region VII – Central Visayas</option>
                        <option>Region VIII – Eastern Visayas</option>
                        <option>Region IX – Zamboanga Peninsula</option>
                        <option>Region X – Northern Mindanao</option>
                        <option>Region XI – Davao</option>
                        <option>Region XII – SOCCSKSARGEN</option>
                        <option>Region XIII – Caraga</option>
                        <option>BARMM</option>
                        <option>CAR – Cordillera</option>
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label>Province</label>
                    <input className={styles.input} placeholder="e.g. Davao del Sur" value={data.province} onChange={e => onChange({ province: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>City / Municipality</label>
                    <input className={styles.input} placeholder="e.g. Davao City" value={data.city} onChange={e => onChange({ city: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Barangay</label>
                    <input className={styles.input} placeholder="e.g. Talomo" value={data.barangay} onChange={e => onChange({ barangay: e.target.value })} />
                </div>
                <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                    <label>Street Address / Building / House No.</label>
                    <input className={styles.input} placeholder="e.g. 123 Rizal St., Unit 4B, Sunrise Bldg." value={data.street} onChange={e => onChange({ street: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Zip Code</label>
                    <input className={styles.input} type="text" maxLength={4} placeholder="e.g. 8000" value={data.zipCode} onChange={e => onChange({ zipCode: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Landmark (Optional)</label>
                    <input className={styles.input} placeholder="e.g. Near SM Mindpro" value={data.landmark} onChange={e => onChange({ landmark: e.target.value })} />
                </div>
            </div>

            <div className={styles.formActions}>
                <button className={styles.backBtn} onClick={onBack}>Back</button>
                <button className={styles.nextBtn} onClick={onNext} disabled={!isValid}>
                    Next Step <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}

// ─── Step 4: ID Verification ────────────────────────────────────────────────
function VerificationStep({ onVerify, onBack }) {
    return (
        <div className={styles.formArea}>
            <h2 className={styles.formTitle}>Identity <span className={styles.redText}>Verification</span></h2>
            <p className={styles.formSubtitle}>Upload a valid Philippine government-issued ID to complete your registration.</p>
            <PhilippineIDVerification onVerify={onVerify} />
            <div className={styles.formActions}>
                <button className={styles.backBtn} onClick={onBack}>Back</button>
            </div>
        </div>
    );
}

// ─── Get Started Page ───────────────────────────────────────────────────────
function GetStartedPage() {
    return (
        <div className={styles.successPage}>
            <div className={styles.successLeft}>
                <div className={styles.successContent}>
                    <p className={styles.successEyebrow}>🎉 Setup Complete</p>
                    <h1 className={styles.successTitle}>
                        Get<br /><span>Started</span>
                    </h1>
                    <p className={styles.successSubtitle}>
                        Your store is all set! Add your first product and
                        start your first auction on BIDPal today.
                    </p>
                    <Link href="/seller/add-product" className={styles.successBtn}>
                        <Package size={20} /> Add your first product <ArrowRight size={18} />
                    </Link>
                </div>
            </div>

            <div className={styles.successRight}>
                <div className={styles.storeCard}>
                    <p className={styles.storeCardLabel}>Your Store Overview</p>
                    {[
                        { label: 'Products Listed', value: '0' },
                        { label: 'Active Auctions', value: '0' },
                        { label: 'Total Revenue', value: '₱ 0' },
                        { label: 'Account Status', value: 'Verified ✓', green: true },
                    ].map((row, i) => (
                        <div className={styles.storeCardStat} key={i}>
                            <span className={styles.storeCardStatLabel}>{row.label}</span>
                            <span className={`${styles.storeCardStatValue} ${row.green ? styles.green : ''}`}>{row.value}</span>
                        </div>
                    ))}
                </div>
                <p className={styles.successQuote}>
                    "Every expert was once a beginner.<br />Your journey starts with that first product."
                </p>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
function SetupPageInner() {
    const searchParams = useSearchParams();
    const isDone = searchParams.get('done') === '1';

    const [step, setStep] = useState(1);
    const [setupComplete, setSetupComplete] = useState(false);

    const [personal, setPersonal] = useState({ firstName: '', lastName: '', middleName: '', birthday: '', gender: '', contactNumber: '', bio: '' });
    const [store, setStore] = useState({ storeName: '', category: '', handle: '', description: '' });
    const [address, setAddress] = useState({ region: '', province: '', city: '', barangay: '', street: '', zipCode: '', landmark: '' });

    const merge = (setter) => (patch) => setter(prev => ({ ...prev, ...patch }));

    if (isDone || setupComplete) return <GetStartedPage />;

    return (
        <div className={styles.setupPage}>
            <Sidebar currentStep={step} />
            <div className={styles.main}>
                {step === 1 && <PersonalInfoStep data={personal} onChange={merge(setPersonal)} onNext={() => setStep(2)} />}
                {step === 2 && <StoreInfoStep data={store} onChange={merge(setStore)} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
                {step === 3 && <AddressStep data={address} onChange={merge(setAddress)} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
                {step === 4 && <VerificationStep onVerify={() => setTimeout(() => setSetupComplete(true), 1500)} onBack={() => setStep(3)} />}
            </div>
        </div>
    );
}

export default function SellerSetup() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
            <SetupPageInner />
        </Suspense>
    );
}
