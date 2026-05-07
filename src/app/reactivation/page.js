'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ShieldX, Clock, CheckCircle, XCircle, Upload, Send,
    RotateCcw, AlertTriangle, FileText, Loader
} from 'lucide-react';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function fmt(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function UploadCard({ label, file, preview, inputRef, onChange }) {
    return (
        <div className={styles.field}>
            <label className={styles.label}>{label} <span className={styles.required}>*</span></label>
            <div
                className={styles.uploadZone}
                onClick={() => inputRef.current?.click()}
                style={file ? { borderColor: '#16a34a', background: '#f0fdf4' } : {}}
            >
                {preview ? (
                    <img src={preview} alt={`${label} preview`} className={styles.idPreview} />
                ) : file ? (
                    <>
                        <FileText size={28} color="#16a34a" />
                        <span className={styles.uploadLabel} style={{ color: '#16a34a' }}>{file.name}</span>
                        <span className={styles.uploadSub}>Click to change</span>
                    </>
                ) : (
                    <>
                        <Upload size={28} color="#9ca3af" />
                        <span className={styles.uploadLabel}>Click to upload {label.toLowerCase()}</span>
                        <span className={styles.uploadSub}>JPG, PNG or PDF · max 10 MB</span>
                    </>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,application/pdf"
                style={{ display: 'none' }}
                onChange={onChange}
            />
        </div>
    );
}

function ReactivationPageInner() {
    const searchParams = useSearchParams();
    const initialEmail = searchParams.get('email') || '';

    const [email, setEmail] = useState(initialEmail);
    const [step, setStep] = useState(initialEmail ? 'checking' : 'email');
    const [statusData, setStatusData] = useState(null);
    const [userName, setUserName] = useState('');

    const [frontIdFile, setFrontIdFile] = useState(null);
    const [frontIdPreview, setFrontIdPreview] = useState(null);
    const [backIdFile, setBackIdFile] = useState(null);
    const [backIdPreview, setBackIdPreview] = useState(null);
    const [message, setMessage] = useState('');

    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const frontFileInputRef = useRef(null);
    const backFileInputRef = useRef(null);

    const checkStatus = async (emailToCheck) => {
        if (!emailToCheck?.trim()) return;
        setStep('checking');
        setErrorMsg('');
        try {
            const res = await fetch(`${API_URL}/api/reactivation/status?email=${encodeURIComponent(emailToCheck.trim())}`);
            const data = await res.json();
            setStatusData(data);
            if (data.name) setUserName(data.name);
            setStep(data.status === 'no_request' ? 'form' : data.status);
        } catch {
            setErrorMsg('Connection error. Please try again.');
            setStep('email');
        }
    };

    useEffect(() => {
        if (initialEmail) checkStatus(initialEmail);
    }, []); // eslint-disable-line

    const handleFileChange = (e, side) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setErrorMsg('');
        const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

        if (side === 'front') {
            setFrontIdFile(file);
            setFrontIdPreview(previewUrl);
            return;
        }

        setBackIdFile(file);
        setBackIdPreview(previewUrl);
    };

    const handleSubmit = async () => {
        if (!frontIdFile || !backIdFile) {
            setErrorMsg('Please upload both the front and back of your government-issued ID.');
            return;
        }
        setErrorMsg('');
        setUploading(true);
        try {
            const uploadDocument = async (file, side) => {
                const formData = new FormData();
                formData.append('idDocument', file);
                formData.append('side', side);
                const uploadRes = await fetch(`${API_URL}/api/reactivation/upload-id`, { method: 'POST', body: formData });
                const payload = await uploadRes.json().catch(() => ({}));
                if (!uploadRes.ok) {
                    throw new Error(payload.error || `Failed to upload the ${side} of your ID`);
                }
                return payload.url;
            };

            const [frontUrl, backUrl] = await Promise.all([
                uploadDocument(frontIdFile, 'front'),
                uploadDocument(backIdFile, 'back'),
            ]);
            setUploading(false);
            setSubmitting(true);

            const submitRes = await fetch(`${API_URL}/api/reactivation/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    id_document_url: frontUrl,
                    id_document_front_url: frontUrl,
                    id_document_back_url: backUrl,
                    user_message: message,
                }),
            });
            const submitData = await submitRes.json();
            if (!submitRes.ok) throw new Error(submitData.error || 'Submission failed');
            setStatusData(prev => ({ ...(prev || {}), created_at: new Date().toISOString() }));
            setStep('pending');
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setUploading(false);
            setSubmitting(false);
        }
    };

    const handleResubmit = () => {
        setFrontIdFile(null);
        setFrontIdPreview(null);
        setBackIdFile(null);
        setBackIdPreview(null);
        setMessage('');
        setErrorMsg('');
        setStep('form');
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                {/* Logo */}
                <Link href="/signin" className={styles.logoLink}>
                    <ShieldX size={28} className={styles.logoIcon} />
                    <span className={styles.logoText}>BIDPal</span>
                </Link>

                {/* ── Email lookup ── */}
                {(step === 'email') && (
                    <div className={styles.card}>
                        <div className={styles.cardIcon} style={{ background: '#fef2f2', color: '#cc2b41' }}>
                            <ShieldX size={32} />
                        </div>
                        <h1 className={styles.cardTitle}>Account Reactivation</h1>
                        <p className={styles.cardDesc}>
                            If your account has been permanently banned and you wish to appeal,
                            enter your registered email address to begin the process.
                        </p>
                        <div className={styles.field}>
                            <label className={styles.label}>Registered Email Address</label>
                            <input
                                type="email"
                                className={styles.input}
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && checkStatus(email)}
                            />
                        </div>
                        {errorMsg && <p className={styles.error}>{errorMsg}</p>}
                        <button className={styles.primaryBtn} onClick={() => checkStatus(email)} disabled={!email.trim()}>
                            Check Account Status
                        </button>
                        <Link href="/signin" className={styles.backLink}>Back to Sign In</Link>
                    </div>
                )}

                {/* ── Checking ── */}
                {step === 'checking' && (
                    <div className={styles.card}>
                        <div className={styles.cardIcon} style={{ background: '#f0f4ff', color: '#2563eb' }}>
                            <Loader size={32} className={styles.spin} />
                        </div>
                        <h1 className={styles.cardTitle}>Checking Account</h1>
                        <p className={styles.cardDesc}>Please wait…</p>
                    </div>
                )}

                {/* ── Not found ── */}
                {step === 'not_found' && (
                    <div className={styles.card}>
                        <div className={styles.cardIcon} style={{ background: '#f9fafb', color: '#6b7280' }}>
                            <XCircle size={32} />
                        </div>
                        <h1 className={styles.cardTitle}>Account Not Found</h1>
                        <p className={styles.cardDesc}>
                            No account is registered with <strong>{email}</strong>. Please check the email address and try again.
                        </p>
                        <button className={styles.secondaryBtn} onClick={() => setStep('email')}>Try Again</button>
                        <Link href="/signup" className={styles.backLink}>Create a new account</Link>
                    </div>
                )}

                {/* ── Not banned ── */}
                {step === 'not_banned' && (
                    <div className={styles.card}>
                        <div className={styles.cardIcon} style={{ background: '#f0fdf4', color: '#16a34a' }}>
                            <CheckCircle size={32} />
                        </div>
                        <h1 className={styles.cardTitle}>Account Is Active</h1>
                        <p className={styles.cardDesc}>
                            The account for <strong>{email}</strong> is not blacklisted. You can sign in normally.
                        </p>
                        <Link href="/signin" className={styles.primaryBtn} style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                            Go to Sign In
                        </Link>
                    </div>
                )}

                {/* ── Form ── */}
                {step === 'form' && (
                    <div className={styles.card}>
                        <div className={styles.cardIcon} style={{ background: '#fef2f2', color: '#cc2b41' }}>
                            <RotateCcw size={32} />
                        </div>
                        <h1 className={styles.cardTitle}>Request Reactivation{userName ? `, ${userName.split(' ')[0]}` : ''}</h1>
                        <p className={styles.cardDesc}>
                            To reactivate your account, you must submit a valid government-issued ID for identity
                            verification. Upon approval, your account will be fully reset — all previous activity
                            will be permanently erased and you will start fresh.
                        </p>

                        <div className={styles.warningBox}>
                            <AlertTriangle size={16} />
                            <span>
                                <strong>Important:</strong> Approval permanently wipes all transaction history,
                                bids, and platform activity. This action cannot be undone.
                            </span>
                        </div>

                        <UploadCard
                            label="Government-Issued ID Front"
                            file={frontIdFile}
                            preview={frontIdPreview}
                            inputRef={frontFileInputRef}
                            onChange={(e) => handleFileChange(e, 'front')}
                        />

                        <UploadCard
                            label="Government-Issued ID Back"
                            file={backIdFile}
                            preview={backIdPreview}
                            inputRef={backFileInputRef}
                            onChange={(e) => handleFileChange(e, 'back')}
                        />

                        {/* Optional message */}
                        <div className={styles.field}>
                            <label className={styles.label}>Message to Admin <span className={styles.optional}>(optional)</span></label>
                            <textarea
                                className={styles.textarea}
                                rows={3}
                                placeholder="Briefly explain your situation or reason for requesting reactivation…"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                        </div>

                        {errorMsg && <p className={styles.error}>{errorMsg}</p>}

                        <button
                            className={styles.primaryBtn}
                            onClick={handleSubmit}
                            disabled={uploading || submitting}
                        >
                            {uploading ? 'Uploading ID…' : submitting ? 'Submitting…' : (
                                <><Send size={15} style={{ marginRight: 6 }} />Submit Reactivation Request</>
                            )}
                        </button>
                        <Link href="/signin" className={styles.backLink}>Cancel — Back to Sign In</Link>
                    </div>
                )}

                {/* ── Pending ── */}
                {step === 'pending' && (
                    <div className={styles.card}>
                        <div className={styles.cardIcon} style={{ background: '#fffbeb', color: '#d97706' }}>
                            <Clock size={32} />
                        </div>
                        <h1 className={styles.cardTitle}>Request Under Review</h1>
                        <p className={styles.cardDesc}>
                            Your reactivation request has been submitted and is being reviewed by our team.
                            {statusData?.created_at && ` Submitted on ${fmt(statusData.created_at)}.`}
                        </p>
                        <div className={styles.infoBox}>
                            <p>We will process your request as soon as possible. Once approved, you will be able to sign in with a fresh account.</p>
                        </div>
                        <Link href="/signin" className={styles.secondaryBtn} style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                            Back to Sign In
                        </Link>
                    </div>
                )}

                {/* ── Approved ── */}
                {step === 'approved' && (
                    <div className={styles.card}>
                        <div className={styles.cardIcon} style={{ background: '#f0fdf4', color: '#16a34a' }}>
                            <CheckCircle size={32} />
                        </div>
                        <h1 className={styles.cardTitle}>Account Reactivated</h1>
                        <p className={styles.cardDesc}>
                            Your account has been successfully reactivated{statusData?.reviewed_at ? ` on ${fmt(statusData.reviewed_at)}` : ''}.
                            You can now sign in and start fresh.
                        </p>
                        {statusData?.admin_notes && (
                            <div className={styles.infoBox}>
                                <p>{statusData.admin_notes}</p>
                            </div>
                        )}
                        <Link href="/signin" className={styles.primaryBtn} style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                            Sign In Now
                        </Link>
                    </div>
                )}

                {/* ── Rejected ── */}
                {step === 'rejected' && (
                    <div className={styles.card}>
                        <div className={styles.cardIcon} style={{ background: '#fef2f2', color: '#cc2b41' }}>
                            <XCircle size={32} />
                        </div>
                        <h1 className={styles.cardTitle}>Request Denied</h1>
                        <p className={styles.cardDesc}>
                            Your reactivation request was reviewed and denied
                            {statusData?.reviewed_at ? ` on ${fmt(statusData.reviewed_at)}` : ''}.
                        </p>
                        {statusData?.admin_notes && (
                            <div className={styles.rejectedBox}>
                                <strong>Reason:</strong>
                                <p>{statusData.admin_notes}</p>
                            </div>
                        )}
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', textAlign: 'center', marginBottom: '1rem' }}>
                            You may submit a new request with updated information.
                        </p>
                        <button className={styles.primaryBtn} onClick={handleResubmit}>
                            <RotateCcw size={15} style={{ marginRight: 6 }} />
                            Submit New Request
                        </button>
                        <Link href="/signin" className={styles.backLink}>Back to Sign In</Link>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ReactivationPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8f9fa' }} />}>
            <ReactivationPageInner />
        </Suspense>
    );
}
