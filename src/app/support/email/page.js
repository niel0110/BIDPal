'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Mail, Send, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const categories = [
  'Account and verification',
  'Order or payment',
  'Auction or bidding',
  'Seller or listing',
  'Dispute or safety concern',
  'Other concern',
];

export default function EmailSupportPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fullName = useMemo(() => {
    const name = [user?.Fname, user?.Lname].filter(Boolean).join(' ').trim();
    return name || user?.email?.split('@')[0] || '';
  }, [user]);

  const [form, setForm] = useState({
    name: fullName,
    email: user?.email || '',
    category: categories[0],
    referenceId: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    setForm(current => ({
      ...current,
      name: current.name || fullName,
      email: current.email || user?.email || '',
    }));
  }, [fullName, user?.email]);

  const updateField = (field, value) => {
    setStatus(null);
    setForm(current => ({ ...current, [field]: value }));
  };

  const canSubmit = form.email.trim()
    && form.category
    && form.subject.trim().length >= 5
    && form.message.trim().length >= 20
    && !submitting;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setStatus(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('bidpal_token') : null;
      const res = await fetch(`${API_URL}/api/support/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          user_id: user?.user_id || null,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Unable to send your inquiry right now.');
      }

      setStatus({ type: 'success', message: data.delivery?.inApp ? 'Inquiry sent to BIDPal support.' : 'Inquiry sent to BIDPal support email.' });
      setForm(current => ({
        ...current,
        referenceId: '',
        subject: '',
        message: '',
      }));
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <button className={styles.backBtn} onClick={() => router.back()} type="button">
          <ArrowLeft size={18} />
          Back
        </button>

        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <Mail size={26} />
          </div>
          <div>
            <p className={styles.kicker}>BIDPal Support</p>
            <h1>Email Support</h1>
            <p>Submit your concern here. BIDPal support will review it and reply through your email.</p>
          </div>
        </div>

        <div className={styles.notice}>
          <ShieldCheck size={18} />
          <span>Use the email address where you want to receive replies.</span>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Name</span>
              <input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder={loading ? 'Loading account...' : 'Your name'}
              />
            </label>

            <label className={styles.field}>
              <span>Reply email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
          </div>

          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Concern type</span>
              <select value={form.category} onChange={(event) => updateField('category', event.target.value)}>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Order, auction, or listing ID</span>
              <input
                value={form.referenceId}
                onChange={(event) => updateField('referenceId', event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Subject</span>
            <input
              value={form.subject}
              onChange={(event) => updateField('subject', event.target.value)}
              placeholder="Briefly summarize your concern"
              maxLength={120}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Message</span>
            <textarea
              value={form.message}
              onChange={(event) => updateField('message', event.target.value)}
              placeholder="Tell us what happened, what you expected, and any important details."
              maxLength={1500}
              required
            />
            <small>{form.message.length} / 1500 characters</small>
          </label>

          <button className={styles.submitBtn} type="submit" disabled={!canSubmit}>
            <Send size={18} />
            {submitting ? 'Sending...' : 'Send Support Inquiry'}
          </button>
        </form>

        {status && (
          <div className={styles.toastOverlay} onClick={() => setStatus(null)}>
            <div
              className={`${styles.toast} ${status.type === 'success' ? styles.success : styles.error}`}
              onClick={(event) => event.stopPropagation()}
            >
              {status.type === 'success' ? <CheckCircle2 size={20} /> : null}
              <span>{status.message}</span>
              <button type="button" onClick={() => setStatus(null)}>OK</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
