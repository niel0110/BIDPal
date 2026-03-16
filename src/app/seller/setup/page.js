'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Check, Package, ArrowRight, Loader2 } from 'lucide-react';
import PhilippineIDVerification from '@/components/PhilippineIDVerification';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

const STEPS = [
    { id: 1, title: 'Personal Info', sub: 'About you as a seller' },
    { id: 2, title: 'Store Details', sub: 'Your shop information' },
    { id: 3, title: 'Address', sub: 'Pick-up & store location' },
    { id: 4, title: 'Verification', sub: 'Philippine ID check' },
];

// ─── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar({ currentStep, onStepClick }) {
    return (
        <aside className={styles.sidebar}>
            <div className={styles.sidebarLogo}><span>BID</span>Pal</div>
            <p className={styles.sidebarTagline}>Seller Onboarding</p>

            <div className={styles.stepsList}>
                {STEPS.map(s => {
                    const isCompleted = currentStep > s.id;
                    const isActive = currentStep === s.id;
                    return (
                        <div
                            key={s.id}
                            className={`${styles.sidebarStep} ${isActive ? styles.active : ''} ${isCompleted ? styles.completed : ''} ${isCompleted ? styles.clickable : ''}`}
                            onClick={() => isCompleted && onStepClick(s.id)}
                            title={isCompleted ? `Go back to ${s.title}` : undefined}
                            style={isCompleted ? { cursor: 'pointer' } : undefined}
                        >
                            <div className={styles.sidebarStepNum}>
                                {isCompleted ? <Check size={14} /> : s.id}
                            </div>
                            <div className={styles.sidebarStepText}>
                                <span className={styles.sidebarStepTitle}>{s.title}</span>
                                <span className={styles.sidebarStepSub}>{s.sub}</span>
                            </div>
                        </div>
                    );
                })}
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
                    <label>First Name<span style={{ color: 'red' }}>*</span></label>
                    <input className={styles.input} type="text" placeholder="Juan" value={data.firstName} onChange={e => onChange({ firstName: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Last Name<span style={{ color: 'red' }}>*</span></label>
                    <input className={styles.input} type="text" placeholder="Dela Cruz" value={data.lastName} onChange={e => onChange({ lastName: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Middle Name (Optional)</label>
                    <input className={styles.input} placeholder="Santos" value={data.middleName} onChange={e => onChange({ middleName: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Birthday<span style={{ color: 'red' }}>*</span></label>
                    <input className={styles.input} type="date" max={new Date().toISOString().split('T')[0]} value={data.birthday} onChange={e => onChange({ birthday: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Gender<span style={{ color: 'red' }}>*</span></label>
                    <select className={styles.select} value={data.gender} onChange={e => onChange({ gender: e.target.value })}>
                        <option value="">Select Gender</option>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Non-binary</option>
                        <option>Prefer not to say</option>
                    </select>
                </div>
                <div className={styles.formGroup}>
                    <label>Contact Number<span style={{ color: 'red' }}>*</span></label>
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
                    <label>Store Name<span style={{ color: 'red' }}>*</span></label>
                    <input className={styles.input} placeholder="e.g. Juan's Vintage Corner" value={data.storeName} onChange={e => onChange({ storeName: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                    <label>Business Category<span style={{ color: 'red' }}>*</span></label>
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
                    <label>Store Handle<span style={{ color: 'red' }}>*</span></label>
                    <input className={styles.input} placeholder="juansvintage" value={data.handle} onChange={e => onChange({ handle: e.target.value })} />
                </div>
                <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                    <label>Store Description<span style={{ color: 'red' }}>*</span></label>
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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';

    const [regions, setRegions] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [barangays, setBarangays] = useState([]);

    const [loadingRegions, setLoadingRegions] = useState(true);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const [loadingBarangays, setLoadingBarangays] = useState(false);

    // Load regions on mount
    useEffect(() => {
        setLoadingRegions(true);
        fetch(`${apiUrl}/api/addresses/locations/regions`)
            .then(r => r.json())
            .then(d => setRegions(Array.isArray(d) ? d : []))
            .catch(() => setRegions([]))
            .finally(() => setLoadingRegions(false));
    }, [apiUrl]);

    // When region changes → load provinces
    useEffect(() => {
        if (!data.region) { setProvinces([]); setCities([]); setBarangays([]); return; }
        setLoadingProvinces(true);
        setProvinces([]); setCities([]); setBarangays([]);
        fetch(`${apiUrl}/api/addresses/locations/provinces/${encodeURIComponent(data.region)}`)
            .then(r => r.json())
            .then(d => setProvinces(Array.isArray(d) ? d : []))
            .catch(() => setProvinces([]))
            .finally(() => setLoadingProvinces(false));
    }, [data.region, apiUrl]);

    // When province changes → load cities
    useEffect(() => {
        if (!data.region || !data.province) { setCities([]); setBarangays([]); return; }
        setLoadingCities(true);
        setCities([]); setBarangays([]);
        fetch(`${apiUrl}/api/addresses/locations/cities/${encodeURIComponent(data.region)}/${encodeURIComponent(data.province)}`)
            .then(r => r.json())
            .then(d => setCities(Array.isArray(d) ? d : []))
            .catch(() => setCities([]))
            .finally(() => setLoadingCities(false));
    }, [data.province, data.region, apiUrl]);

    // When city changes → load barangays
    useEffect(() => {
        if (!data.municipality_city) { setBarangays([]); return; }
        setLoadingBarangays(true);
        setBarangays([]);
        fetch(`${apiUrl}/api/addresses/locations/barangays/${encodeURIComponent(data.municipality_city)}`)
            .then(r => r.json())
            .then(d => setBarangays(Array.isArray(d) ? d : []))
            .catch(() => setBarangays([]))
            .finally(() => setLoadingBarangays(false));
    }, [data.municipality_city, apiUrl]);

    const isValid = data.Line1 && data.Barangay && data.municipality_city && data.province && data.region && data.zip_code;

    const SelectWithLoader = ({ loading, children, ...props }) => (
        <div style={{ position: 'relative' }}>
            <select className={styles.select} disabled={loading} {...props}>
                {children}
            </select>
            {loading && (
                <span style={{ position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)', color: '#D32F2F', display: 'flex' }}>
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                </span>
            )}
        </div>
    );

    return (
        <div className={styles.formArea}>
            <h2 className={styles.formTitle}>Pick-up <span className={styles.redText}>Address</span></h2>
            <p className={styles.formSubtitle}>This is where buyers' shipments will originate. Use your store or home address.</p>

            <style>{`@keyframes spin { from { transform: translateY(-50%) rotate(0deg); } to { transform: translateY(-50%) rotate(360deg); } }`}</style>

            <div className={styles.formGrid}>
                {/* Region */}
                <div className={styles.formGroup}>
                    <label>Region<span style={{ color: 'red' }}>*</span></label>
                    <SelectWithLoader loading={loadingRegions} value={data.region} onChange={e => onChange({ region: e.target.value, province: '', municipality_city: '', Barangay: '' })}>
                        <option value="">{loadingRegions ? 'Loading…' : 'Select Region'}</option>
                        {regions.map(r => <option key={r.region} value={r.region}>{r.name}</option>)}
                    </SelectWithLoader>
                </div>

                {/* Province */}
                <div className={styles.formGroup}>
                    <label>Province<span style={{ color: 'red' }}>*</span></label>
                    <SelectWithLoader loading={loadingProvinces} value={data.province} onChange={e => onChange({ province: e.target.value, municipality_city: '', Barangay: '' })}>
                        <option value="">{!data.region ? 'Select a region first' : loadingProvinces ? 'Loading…' : 'Select Province'}</option>
                        {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                    </SelectWithLoader>
                </div>

                {/* City / Municipality */}
                <div className={styles.formGroup}>
                    <label>City / Municipality<span style={{ color: 'red' }}>*</span></label>
                    <SelectWithLoader loading={loadingCities} value={data.municipality_city} onChange={e => onChange({ municipality_city: e.target.value, Barangay: '' })}>
                        <option value="">{!data.province ? 'Select a province first' : loadingCities ? 'Loading…' : 'Select City / Municipality'}</option>
                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                    </SelectWithLoader>
                </div>

                {/* Barangay */}
                <div className={styles.formGroup}>
                    <label>Barangay<span style={{ color: 'red' }}>*</span></label>
                    <SelectWithLoader loading={loadingBarangays} value={data.Barangay} onChange={e => onChange({ Barangay: e.target.value })}>
                        <option value="">{!data.municipality_city ? 'Select a city first' : loadingBarangays ? 'Loading…' : 'Select Barangay'}</option>
                        {barangays.map(b => <option key={b} value={b}>{b}</option>)}
                    </SelectWithLoader>
                </div>

                {/* Street / House No. */}
                <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                    <label>Street Address / Building / House No.<span style={{ color: 'red' }}>*</span></label>
                    <input
                        className={styles.input}
                        placeholder="e.g. 123 Rizal St., Unit 4B, Sunrise Bldg."
                        value={data.Line1}
                        onChange={e => onChange({ Line1: e.target.value })}
                    />
                </div>

                {/* Unit / Floor (Line2) */}
                <div className={styles.formGroup}>
                    <label>Unit / Floor / Bldg Name <span style={{ fontWeight: 400, color: '#aaa' }}>(Optional)</span></label>
                    <input
                        className={styles.input}
                        placeholder="e.g. Unit 4B, Sunrise Tower"
                        value={data.Line2}
                        onChange={e => onChange({ Line2: e.target.value })}
                    />
                </div>

                {/* Zip Code */}
                <div className={styles.formGroup}>
                    <label>Zip Code<span style={{ color: 'red' }}>*</span></label>
                    <input
                        className={styles.input}
                        type="text"
                        maxLength={5}
                        placeholder="e.g. 8000"
                        value={data.zip_code}
                        onChange={e => onChange({ zip_code: e.target.value })}
                    />
                </div>

                {/* Landmark */}
                <div className={`${styles.formGroup} ${styles.formGridFull}`}>
                    <label>Landmark / Directions <span style={{ fontWeight: 400, color: '#aaa' }}>(Optional)</span></label>
                    <input
                        className={styles.input}
                        placeholder="e.g. Near SM Mindpro, beside the Petron station"
                        value={data.household_blk_st}
                        onChange={e => onChange({ household_blk_st: e.target.value })}
                    />
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
                        Your store is all set! Head to your dashboard to add products
                        and start your first auction on BIDPal today.
                    </p>
                    <Link href="/seller" className={styles.successBtn}>
                        <Package size={20} /> Go to Dashboard <ArrowRight size={18} />
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
    const { user } = useAuth();

    const router = useRouter();
    const [step, setStep] = useState(1);
    const [setupComplete, setSetupComplete] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [checkingSetup, setCheckingSetup] = useState(true);

    // All form state must be declared here (above any early returns) to follow Rules of Hooks
    const [personal, setPersonal] = useState({ firstName: '', lastName: '', middleName: '', birthday: '', gender: '', contactNumber: '', bio: '' });
    const [store, setStore] = useState({ storeName: '', category: '', handle: '', description: '' });
    const [address, setAddress] = useState({ region: '', province: '', municipality_city: '', Barangay: '', Line1: '', Line2: '', zip_code: '', household_blk_st: '' });

    // If user already has a seller account, redirect to dashboard immediately
    useEffect(() => {
        if (!user?.user_id) {
            setCheckingSetup(false);
            return;
        }
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
        const token = localStorage.getItem('bidpal_token');
        fetch(`${apiUrl}/api/sellers/user/${user.user_id}`, {
            headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        })
            .then(res => {
                if (res.ok) {
                    // Already has a seller account — kick them to the dashboard
                    router.replace('/seller');
                } else {
                    setCheckingSetup(false);
                }
            })
            .catch(() => setCheckingSetup(false));
    }, [user?.user_id]);

    if (checkingSetup) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Loading...
            </div>
        );
    }

    const merge = (setter) => (patch) => setter(prev => ({ ...prev, ...patch }));

    const handleSetupComplete = async () => {
        if (!user?.user_id) return;
        setSubmitError('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
            const token = localStorage.getItem('bidpal_token');

            // Step 1: Update personal info & set role to Seller
            const userRes = await fetch(`${apiUrl}/api/users/${user.user_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    Fname: personal.firstName,
                    Lname: personal.lastName,
                    Mname: personal.middleName || null,
                    Birthday: personal.birthday || null,
                    Gender: personal.gender,
                    contact_num: personal.contactNumber,
                    Bio: personal.bio || null,
                    role: 'Seller',
                }),
            });
            const userData = await userRes.json();
            if (!userRes.ok) throw new Error(userData.error || 'Failed to save profile.');

            // Step 2: Create seller profile with store details
            const sellerRes = await fetch(`${apiUrl}/api/sellers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    store_name: store.storeName,
                    business_category: store.category || null,
                    store_handle: store.handle || null,
                    store_description: store.description || null,
                    user_id: user.user_id,
                }),
            });
            const sellerData = await sellerRes.json();
            if (!sellerRes.ok) throw new Error(sellerData.error || 'Failed to create seller profile.');

            // Step 3: Save pick-up address
            const addressRes = await fetch(`${apiUrl}/api/addresses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    user_id: user.user_id,
                    Line1: address.Line1,
                    Line2: address.Line2 || null,
                    household_blk_st: address.household_blk_st || null,
                    Barangay: address.Barangay || null,
                    municipality_city: address.municipality_city || null,
                    zip_code: address.zip_code || null,
                    region: address.region || null,
                    province: address.province || null,
                    address_type: 'pickup',
                    is_default: true,
                    Country: 'Philippines',
                }),
            });
            const addressData = await addressRes.json();
            if (!addressRes.ok) throw new Error(addressData.error || 'Failed to save address.');

            setSetupComplete(true);
        } catch (err) {
            setSubmitError(err.message);
        }
    };

    if (isDone || setupComplete) return <GetStartedPage />;

    return (
        <div className={styles.setupPage}>
            <Sidebar currentStep={step} onStepClick={setStep} />
            <div className={styles.main}>
                {step === 1 && <PersonalInfoStep data={personal} onChange={merge(setPersonal)} onNext={() => setStep(2)} />}
                {step === 2 && <StoreInfoStep data={store} onChange={merge(setStore)} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
                {step === 3 && <AddressStep data={address} onChange={merge(setAddress)} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
                {step === 4 && (
                    <>
                        {submitError && <p style={{ color: 'red', padding: '0 2rem' }}>{submitError}</p>}
                        <VerificationStep onVerify={handleSetupComplete} onBack={() => setStep(3)} />
                    </>
                )}
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
