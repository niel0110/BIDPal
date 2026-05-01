'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useSubmitLock } from '@/hooks/useSubmitLock';
import { BUYER_TERMS, SELLER_TERMS } from '@/components/TermsModal/termsContent';
import AuthLogo from '@/components/AuthLogo';
import styles from './page.module.css';

/* ─── Terms Modal (overlay) ─────────────────────────────────────────────── */
function TermsModal({ role, onClose }) {
    const sections = role === 'Seller' ? SELLER_TERMS : BUYER_TERMS;
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1rem',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580,
                    maxHeight: '88vh', display: 'flex', flexDirection: 'column',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.25rem 1.5rem 1rem', borderBottom: '1px solid #f0f0f0' }}>
                    <div>
                        <p style={{ margin: '0 0 0.2rem', fontSize: '0.72rem', fontWeight: 700, color: '#D32F2F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {role} Account
                        </p>
                        <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#111' }}>Terms &amp; Conditions</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: '#f5f5f5', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '1rem' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                    {sections.map((sec, si) => (
                        <div key={sec.id} style={{ marginBottom: '1.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem', paddingBottom: '0.45rem', borderBottom: '1.5px solid #f2f2f2' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, minWidth: 22, background: '#D32F2F', color: '#fff', borderRadius: '50%', fontSize: '0.65rem', fontWeight: 800 }}>{si + 1}</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1a1a1a' }}>{sec.icon} {sec.title}</span>
                            </div>
                            {sec.content.map((item, i) => (
                                <div key={i} style={{ marginBottom: '0.75rem', paddingLeft: '0.2rem' }}>
                                    <p style={{ margin: '0 0 0.2rem', fontSize: '0.78rem', fontWeight: 700, color: '#333' }}>{item.heading}</p>
                                    <p style={{ margin: 0, fontSize: '0.76rem', color: '#555', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{item.body}</p>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0' }}>
                    <button
                        onClick={onClose}
                        style={{ width: '100%', padding: '0.75rem', background: '#D32F2F', color: '#fff', border: 'none', borderRadius: 9, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                        Done Reading
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Sign-Up Page ──────────────────────────────────────────────────────── */
export default function SignUp() {
    const router = useRouter();
    const { register } = useAuth();
    const { isSubmitting, runWithLock } = useSubmitLock();

    const [selectedRole, setSelectedRole] = useState('Buyer');
    const [email, setEmail]               = useState('');
    const [password, setPassword]         = useState('');
    const [confirm, setConfirm]           = useState('');
    const [error, setError]               = useState('');
    const [message, setMessage]           = useState('');
    const [agreed, setAgreed]             = useState(false);
    const [showTerms, setShowTerms]       = useState(false);
    const [verificationStep, setVerificationStep] = useState('details');
    const [verificationCode, setVerificationCode] = useState('');

    const sendVerificationCode = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/auth/send-verification-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, purpose: 'register' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to send verification code.');
        return data;
    };

    const verifyCode = async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/api/auth/verify-email-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code: verificationCode, purpose: 'register' }),
        });
        const data = await res.json();
        if (!res.ok) {
            const err = new Error(data.error || 'Unable to verify code.');
            err.code = data.code;
            throw err;
        }
        return data.token;
    };

    const handleResendCode = async () => {
        setError('');
        setMessage('');
        setVerificationCode('');
        try {
            const data = await sendVerificationCode();
            setMessage(data.devCode
                ? `Development code: ${data.devCode}`
                : 'A new verification code was sent to your email. Use the latest code only.');
        } catch (err) {
            setError(err.message || 'Unable to resend verification code.');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        await runWithLock(async () => {
            setError('');
            setMessage('');
            if (!email || !password || !confirm) {
                setError('All fields are required.');
                return;
            }
            if (password !== confirm) {
                setError('Passwords do not match.');
                return;
            }
            if (!agreed) {
                setError('Please agree to the Terms & Conditions before continuing.');
                return;
            }
            try {
                if (verificationStep === 'details') {
                    const data = await sendVerificationCode();
                    setVerificationStep('code');
                    setMessage(data.devCode
                        ? `Development code: ${data.devCode}`
                        : 'We sent a 6-digit verification code to your email.');
                    return;
                }

                if (!verificationCode) {
                    setError('Please enter the verification code sent to your email.');
                    return;
                }

                const emailVerificationToken = await verifyCode();
                const role   = selectedRole.toLowerCase();
                const result = await register({ email, password, role, emailVerificationToken });
                if (!result.success) { setError(result.error); return; }
                router.push(role === 'seller' ? '/seller/setup' : '/buyer/setup');
            } catch (err) {
                if (['CODE_EXPIRED', 'TOO_MANY_ATTEMPTS', 'INVALID_CODE'].includes(err.code)) {
                    setVerificationCode('');
                    setError(`${err.message} You can send a new code below.`);
                    return;
                }
                setError(err.message || 'Something went wrong. Please try again.');
            }
        });
    };

    return (
        <>
            {showTerms && <TermsModal role={selectedRole} onClose={() => setShowTerms(false)} />}

            <div className={styles.authContainer}>
                <div className={styles.authLeft}>
                    <div className={styles.authLogo}><AuthLogo /></div>
                </div>

                <div className={styles.authRight}>
                    <div className={styles.authFormWrapper}>
                        <div className={styles.mobileLogo}>
                            <img src="/BIDPaL Logo.png" alt="BIDPal" className={styles.mobileLogoImg} />
                            <span className={styles.mobileLogoText}>
                                <span style={{ color: '#d02440' }}>B</span>
                                <span style={{ color: '#542769' }}>I</span>
                                <span style={{ color: '#fba91d' }}>D</span>
                                <span style={{ color: '#ef4f25' }}>P</span>
                                <span style={{ color: '#d02440' }}>a</span>
                                <span style={{ color: '#542769' }}>l</span>
                            </span>
                        </div>
                        <h1 className={styles.authTitle}>
                            Create <span className={styles.redText}>account</span>
                        </h1>

                        {/* Role toggle */}
                        <div className={styles.roleGrid}>
                            {['Buyer', 'Seller'].map((r) => (
                                <div
                                    key={r}
                                    className={`${styles.roleOption} ${selectedRole === r ? styles.roleActive : ''}`}
                                    onClick={() => { setSelectedRole(r); setAgreed(false); }}
                                >
                                    <div className={styles.roleLabel}>{r}</div>
                                    <div className={styles.roleSub}>{r === 'Buyer' ? 'I want to bid' : 'I want to sell'}</div>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit} className={styles.mainForm} noValidate>
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setVerificationStep('details');
                                    setVerificationCode('');
                                }}
                                className={styles.input}
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`${styles.input} ${styles.inputGroup}`}
                            />
                            <input
                                type="password"
                                placeholder="Confirm password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                className={`${styles.input} ${styles.inputGroup}`}
                            />
                            {verificationStep === 'code' && (
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="Verification code"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className={`${styles.input} ${styles.inputGroup}`}
                                />
                            )}
                            {verificationStep === 'code' && (
                                <button
                                    type="button"
                                    className={styles.resendCodeBtn}
                                    disabled={isSubmitting}
                                    onClick={() => runWithLock(handleResendCode)}
                                >
                                    Send new code
                                </button>
                            )}

                            {/* Submit button */}
                            <button
                                type="submit"
                                disabled={!agreed || isSubmitting}
                                style={{
                                    width: '100%',
                                    marginTop: '1.1rem',
                                    padding: '0.78rem',
                                    border: 'none',
                                    borderRadius: 8,
                                    fontSize: '0.95rem',
                                    fontWeight: 700,
                                    cursor: agreed && !isSubmitting ? 'pointer' : 'not-allowed',
                                    background: agreed && !isSubmitting ? '#D32F2F' : '#e0e0e0',
                                    color: agreed && !isSubmitting ? '#fff' : '#aaa',
                                    transition: 'background 0.2s, color 0.2s',
                                    boxShadow: agreed && !isSubmitting ? '0 4px 14px rgba(211,47,47,0.28)' : 'none',
                                }}
                            >
                                {isSubmitting
                                    ? (verificationStep === 'details' ? 'Sending code...' : 'Creating account...')
                                    : (verificationStep === 'details' ? 'Send verification code' : 'Verify and create account')}
                            </button>

                            {/* ── T&C circle checkbox — below Create account ── */}
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    marginTop: '0.7rem',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                }}
                                onClick={() => setAgreed((v) => !v)}
                            >
                                {/* Circle */}
                                <div
                                    style={{
                                        width: 20,
                                        height: 20,
                                        minWidth: 20,
                                        borderRadius: '50%',
                                        border: agreed ? '2px solid #D32F2F' : '2px solid #bbb',
                                        background: agreed ? '#D32F2F' : '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'background 0.18s, border-color 0.18s',
                                    }}
                                    onClick={(e) => { e.stopPropagation(); setAgreed((v) => !v); }}
                                >
                                    {agreed && (
                                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </div>

                                {/* Text */}
                                <span style={{ fontSize: '0.75rem', color: '#555', fontWeight: 500, lineHeight: 1.4 }}>
                                    I agree to the{' '}
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setShowTerms(true); }}
                                        style={{ color: '#D32F2F', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
                                    >
                                        Terms &amp; Conditions
                                    </span>
                                </span>
                            </div>

                            {error && (
                                <p style={{ color: '#D32F2F', fontSize: '0.82rem', margin: '0.5rem 0 0', padding: 0 }}>
                                    {error}
                                </p>
                            )}
                            {message && (
                                <p style={{ color: '#166534', fontSize: '0.82rem', margin: '0.5rem 0 0', padding: 0 }}>
                                    {message}
                                </p>
                            )}

                            <button
                                type="button"
                                className={styles.toggleAuth}
                                onClick={() => router.push('/signin')}
                            >
                                Already have an account?{' '}
                                <span className={styles.toggleLink}>Sign In</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}
