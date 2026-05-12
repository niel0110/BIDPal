'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Logo from '@/components/Logo';
import PhilippineIDVerification from '@/components/PhilippineIDVerification';
import RouteGuard from '@/components/auth/RouteGuard';
import styles from './page.module.css';

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

function getAge(isoDate) {
    if (!isoDate) return 0;
    const today = new Date();
    const dob = new Date(isoDate);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

function getMaxDate(minAge) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - minAge);
    return d.toISOString().split('T')[0];
}

function BuyerSetupInner() {
    const { user, updateUser } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [isResubmission, setIsResubmission] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [checking, setChecking] = useState(false);
    const [initLoading, setInitLoading] = useState(true);

    // ── Detect rejection / already-profiled buyer on mount ────────────────────
    useEffect(() => {
        if (!user?.user_id) { setInitLoading(false); return; }
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem('bidpal_token');
        fetch(`${apiUrl}/api/users/${user.user_id}`, {
            headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        })
            .then(r => r.json())
            .then(data => {
                if (data.kyc_status === 'approved') {
                    updateUser({ kyc_status: 'approved' });
                    router.replace('/');
                    return;
                }
                if (data.kyc_status === 'pending') {
                    setIsPending(true);
                    return;
                }
                if (data.kyc_status === 'rejected') {
                    setIsResubmission(true);
                    setStep(2);
                } else if (data.Fname) {
                    // Profile complete but skipped KYC earlier
                    setStep(2);
                }
            })
            .catch(() => { /* non-critical — stay on step 1 */ })
            .finally(() => setInitLoading(false));
    }, [user?.user_id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Step 1 state ──────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        middleName: '',
        birthday: '',
        gender: '',
        contactNumber: '',
        isStudent: false,
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [touched, setTouched] = useState(false);

    // ── Step 2 state ──────────────────────────────────────────────────────────
    const [kycSubmitting, setKycSubmitting] = useState(false);
    const [kycError, setKycError] = useState('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
    const toggle = (key) => () => setForm(f => ({ ...f, [key]: !f[key] }));

    const minAge = form.isStudent ? 15 : 18;
    const age = getAge(form.birthday);
    const ageValid = form.birthday && age >= minAge;
    const ageTooYoung = form.birthday && age < minAge;

    const isValid =
        form.firstName.trim() &&
        form.lastName.trim() &&
        ageValid &&
        form.gender &&
        form.contactNumber.replace(/\D/g, '').length === 11;

    // ── Step 1: save profile, advance to step 2 ───────────────────────────────
    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setTouched(true);
        if (!isValid || !user?.user_id) return;

        setSubmitting(true);
        setError('');
        try {
            const token = localStorage.getItem('bidpal_token');
            const res = await fetch(`${apiUrl}/api/users/${user.user_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    Fname: form.firstName.trim(),
                    Lname: form.lastName.trim(),
                    Mname: form.middleName.trim() || null,
                    Birthday: form.birthday || null,
                    Gender: form.gender,
                    contact_num: form.contactNumber.replace(/\D/g, ''),
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save profile.');

            updateUser({
                Fname: form.firstName.trim(),
                Lname: form.lastName.trim(),
                Gender: form.gender,
                contact_num: form.contactNumber.replace(/\D/g, ''),
            });
            setStep(2);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // ── Step 2: upload ID photos ──────────────────────────────────────────────
    const handleKycVerify = async ({ type, number, frontFile, backFile }) => {
        if (!user?.user_id) return;
        setKycSubmitting(true);
        setKycError('');
        try {
            const token = localStorage.getItem('bidpal_token');
            const formData = new FormData();
            formData.append('id_photo_front', frontFile);
            formData.append('id_photo_back', backFile);
            formData.append('id_type', type);
            formData.append('id_number', number);

            const res = await fetch(`${apiUrl}/api/users/${user.user_id}/kyc`, {
                method: 'POST',
                headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to submit ID.');

            updateUser({ kyc_status: 'pending' });
            setIsPending(true);
        } catch (err) {
            setKycError(err.message);
        } finally {
            setKycSubmitting(false);
        }
    };

    // ── Re-check verification status (for pending screen) ────────────────
    const handleCheckStatus = async () => {
        if (!user?.user_id) return;
        setChecking(true);
        const token = localStorage.getItem('bidpal_token');
        try {
            const r = await fetch(`${apiUrl}/api/users/${user.user_id}`, {
                headers: { ...(token && { Authorization: `Bearer ${token}` }) },
            });
            const data = await r.json();
            if (data.kyc_status === 'approved') {
                updateUser({ kyc_status: 'approved' });
                router.replace('/');
            } else if (data.kyc_status === 'rejected') {
                updateUser({ kyc_status: 'rejected' });
                setIsPending(false);
                setIsResubmission(true);
                setStep(2);
            }
        } catch {
            // non-critical — stay on pending screen
        } finally {
            setChecking(false);
        }
    };

    // ── Side panel content per step ───────────────────────────────────────────
    const sideContent = step === 1 ? (
        <>
            <h2 className={styles.sideHeading}>Your marketplace,<br />your way.</h2>
            <p className={styles.sideText}>
                Join thousands of buyers discovering unique finds and live auctions on BIDPal every day.
            </p>
        </>
    ) : (
        <>
            <h2 className={styles.sideHeading}>
                {isResubmission ? <>Try again,<br />we&apos;re here.</> : <>Stay safe,<br />stay trusted.</>}
            </h2>
            <p className={styles.sideText}>
                {isResubmission
                    ? 'Upload a clearer photo of your valid Philippine government-issued ID to complete verification.'
                    : 'Verifying your ID helps protect every transaction on BIDPal. Your information is encrypted and stored securely.'}
            </p>
            <div className={styles.sideFeatures}>
                {['Encrypted & secure upload', 'Reviewed within 24–48 hrs', 'Required for full bidding access'].map(f => (
                    <div key={f} className={styles.sideFeatureItem}>
                        <span className={styles.sideFeatureDot} />
                        <span>{f}</span>
                    </div>
                ))}
            </div>
        </>
    );

    if (initLoading) return null;

    return (
        <div className={styles.page}>
            {/* Decorative side panel */}
            <div className={styles.side}>
                <div className={styles.sideContent}>
                    <Logo white />
                    {sideContent}
                    <div className={styles.sideDots}>
                        <span style={step === 1 ? { background: 'white', width: 24, borderRadius: 4 } : {}} />
                        <span style={step === 2 ? { background: 'white', width: 24, borderRadius: 4 } : {}} />
                    </div>
                </div>
            </div>

            {/* Form side */}
            <div className={styles.formWrap}>
                <div className={styles.mobileLogo}><Logo /></div>

                <div className={styles.card}>
                    {/* ── Pending verification screen ── */}
                    {isPending ? (
                        <div className={styles.pendingPanel}>
                            <div className={styles.pendingIcon}>⏳</div>
                            <h1 className={`${styles.title} ${styles.pendingTitle}`}>
                                Verification <span>Under Review</span>
                            </h1>
                            <p className={`${styles.sub} ${styles.pendingSub}`}>
                                Your ID has been submitted and is being reviewed by our team.
                                This typically takes <strong>24–48 hours</strong>. You&apos;ll receive a
                                notification once your account is approved.
                            </p>
                            <div className={styles.pendingList}>
                                {[
                                    { icon: '✅', label: 'Documents received' },
                                    { icon: '⏳', label: 'Under review by BIDPal team' },
                                    { icon: '○', label: 'Approved — full access granted' },
                                ].map(({ icon, label }) => (
                                    <div key={label} className={styles.pendingListItem}>
                                        <span className={styles.pendingListIcon}>{icon}</span>
                                        {label}
                                    </div>
                                ))}
                            </div>
                            <button
                                className={styles.btn}
                                onClick={handleCheckStatus}
                                disabled={checking}
                            >
                                {checking ? 'Checking…' : 'Check Verification Status'}
                            </button>
                            <p className={styles.pendingFootnote}>
                                Already notified of approval? Tap &quot;Check Verification Status&quot; above.
                            </p>
                        </div>
                    ) : (
                    <>
                    {/* Step progress bar */}
                    <div className={styles.stepBar}>
                        <div className={`${styles.stepNode} ${styles.stepDone}`}>
                            <span>1</span>
                        </div>
                        <div className={`${styles.stepConnector} ${step >= 2 ? styles.stepConnectorDone : ''}`} />
                        <div className={`${styles.stepNode} ${step >= 2 ? styles.stepDone : styles.stepTodo}`}>
                            <span>2</span>
                        </div>
                        <div className={styles.stepLabels}>
                            <span className={step === 1 ? styles.stepLabelActive : ''}>Profile</span>
                            <span className={step === 2 ? styles.stepLabelActive : ''}>Verify ID</span>
                        </div>
                    </div>

                    {/* ── Step 1: Profile ── */}
                    {step === 1 && (
                        <>
                            <div className={styles.cardHeader}>
                                <h1 className={styles.title}>Complete Your <span>Profile</span></h1>
                                <p className={styles.sub}>Step 1 of 2 — A few details before you start bidding.</p>
                            </div>

                            <form onSubmit={handleProfileSubmit} className={styles.form}>
                                <div className={styles.row}>
                                    <div className={styles.field}>
                                        <label>First Name<span className={styles.req}>*</span></label>
                                        <input
                                            value={form.firstName}
                                            onChange={set('firstName')}
                                            placeholder="Juan"
                                            className={`${styles.input} ${touched && !form.firstName.trim() ? styles.err : ''}`}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label>Last Name<span className={styles.req}>*</span></label>
                                        <input
                                            value={form.lastName}
                                            onChange={set('lastName')}
                                            placeholder="Dela Cruz"
                                            className={`${styles.input} ${touched && !form.lastName.trim() ? styles.err : ''}`}
                                        />
                                    </div>
                                </div>

                                <div className={styles.field}>
                                    <label>Middle Name <span className={styles.opt}>(optional)</span></label>
                                    <input
                                        value={form.middleName}
                                        onChange={set('middleName')}
                                        placeholder="Santos"
                                        className={styles.input}
                                    />
                                </div>

                                <div className={styles.studentToggle} onClick={toggle('isStudent')}>
                                    <div className={`${styles.toggleTrack} ${form.isStudent ? styles.toggleOn : ''}`}>
                                        <div className={styles.toggleThumb} />
                                    </div>
                                    <div>
                                        <span className={styles.toggleLabel}>I am a student</span>
                                        <span className={styles.toggleHint}>
                                            {form.isStudent ? 'Minimum age: 15 years old' : 'Minimum age: 18 years old'}
                                        </span>
                                    </div>
                                </div>

                                <div className={styles.row}>
                                    <div className={styles.field}>
                                        <label>Birthday<span className={styles.req}>*</span></label>
                                        <div className={styles.dateWrap}>
                                            <input
                                                type="date"
                                                value={form.birthday}
                                                onChange={set('birthday')}
                                                max={getMaxDate(minAge)}
                                                className={`${styles.input} ${touched && (!form.birthday || ageTooYoung) ? styles.err : ''}`}
                                            />
                                        </div>
                                        {touched && ageTooYoung && (
                                            <span className={styles.fieldErr}>Must be at least {minAge} years old{form.isStudent ? ' (student)' : ''}.</span>
                                        )}
                                        {touched && !form.birthday && !ageTooYoung && (
                                            <span className={styles.fieldErr}>Birthday is required.</span>
                                        )}
                                    </div>
                                    <div className={styles.field}>
                                        <label>Gender<span className={styles.req}>*</span></label>
                                        <select
                                            value={form.gender}
                                            onChange={set('gender')}
                                            className={`${styles.input} ${touched && !form.gender ? styles.err : ''}`}
                                        >
                                            <option value="">Select Gender</option>
                                            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className={styles.field}>
                                    <label>Contact Number<span className={styles.req}>*</span></label>
                                    <div className={styles.phoneWrap}>
                                        <span className={styles.phonePrefix}>+63</span>
                                        <input
                                            value={form.contactNumber.startsWith('0')
                                                ? form.contactNumber.slice(1)
                                                : form.contactNumber.startsWith('+63')
                                                    ? form.contactNumber.slice(3)
                                                    : form.contactNumber}
                                            onChange={(e) => {
                                                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                setForm(f => ({ ...f, contactNumber: '0' + digits }));
                                            }}
                                            placeholder="9XXXXXXXXX"
                                            maxLength={10}
                                            className={`${styles.input} ${styles.phoneInput} ${touched && form.contactNumber.replace(/\D/g, '').length !== 11 ? styles.err : ''}`}
                                        />
                                    </div>
                                </div>

                                {error && <p className={styles.errorMsg}>{error}</p>}

                                <button type="submit" className={styles.btn} disabled={submitting}>
                                    {submitting ? 'Saving…' : 'Next: Verify ID →'}
                                </button>

                                <p className={styles.disclaimer}>
                                    By continuing, you agree to BIDPal&apos;s Terms of Service and Privacy Policy.
                                </p>
                            </form>
                        </>
                    )}

                    {/* ── Step 2: ID Verification ── */}
                    {step === 2 && (
                        <>
                            <div className={styles.cardHeader}>
                                <h1 className={styles.title}>
                                    {isResubmission ? <>Re-submit Your <span>ID</span></> : <>Verify Your <span>Identity</span></>}
                                </h1>
                                <p className={styles.sub}>
                                    {isResubmission
                                        ? 'Your previous submission was rejected. Please upload a clear, valid Philippine government-issued ID.'
                                        : 'Step 2 of 2 — Upload a valid Philippine government-issued ID.'}
                                </p>
                            </div>

                            {isResubmission && (
                                <div className={styles.rejectionBanner}>
                                    <span className={styles.rejectionIcon}>⚠️</span>
                                    <div>
                                        <strong>ID Rejected</strong>
                                        <p>Your submitted ID was not accepted. Make sure the photo is clear, unobstructed, and shows a valid Philippine government-issued ID.</p>
                                    </div>
                                </div>
                            )}

                            {kycError && <p className={styles.errorMsg}>{kycError}</p>}

                            <PhilippineIDVerification
                                onVerify={handleKycVerify}
                                submitting={kycSubmitting}
                            />
                        </>
                    )}
                    </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function BuyerSetup() {
    return (
        <RouteGuard>
            <Suspense fallback={null}>
                <BuyerSetupInner />
            </Suspense>
        </RouteGuard>
    );
}
