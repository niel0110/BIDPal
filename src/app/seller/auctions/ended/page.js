'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft, RotateCcw, Trash2, Package, Clock, Calendar,
    AlertOctagon, Wifi, WifiOff, MoreHorizontal, X, CheckCircle2, AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

export default function EndedAuctionsPage() {
    const { user } = useAuth();
    const [auctions, setAuctions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [openDropdown, setOpenDropdown] = useState(null);
    const dropdownRef = useRef(null);
    const [deletingId, setDeletingId] = useState(null);

    // Reschedule modal
    const [rescheduleTarget, setRescheduleTarget] = useState(null);
    const [rescheduleForm, setRescheduleForm] = useState({ startDate: '', startTime: '' });
    const [rescheduleToast, setRescheduleToast] = useState(null);
    const [isRescheduling, setIsRescheduling] = useState(false);

    const [modalConfig, setModalConfig] = useState({ isOpen: false });
    const showModal = (cfg) => setModalConfig({ isOpen: true, showCancel: true, ...cfg });

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!user) return;
        const fetchAuctions = async () => {
            setLoading(true);
            try {
                const userId = user.user_id || user.id;
                const token = localStorage.getItem('bidpal_token');
                const res = await fetch(`${apiUrl}/api/auctions/seller/${userId}?status=ended`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (res.ok) {
                    const data = await res.json();
                    setAuctions(data.data || []);
                }
            } catch (err) {
                console.error('Failed to fetch ended auctions:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAuctions();
    }, [user, refreshKey]);

    const openReschedule = (auction) => {
        setRescheduleTarget(auction);
        setRescheduleForm({ startDate: '', startTime: '' });
        setRescheduleToast(null);
    };

    const handleReschedule = async (e) => {
        e.preventDefault();
        if (!rescheduleTarget) return;
        setIsRescheduling(true);
        setRescheduleToast(null);
        try {
            const token = localStorage.getItem('bidpal_token');
            const startTimestamp = new Date(`${rescheduleForm.startDate}T${rescheduleForm.startTime}:00`).toISOString();
            if (isNaN(new Date(startTimestamp).getTime())) {
                setRescheduleToast({ type: 'error', message: 'Invalid date or time selected.' });
                return;
            }
            const payload = { start_time: startTimestamp };
            const res = await fetch(`${apiUrl}/api/auctions/${rescheduleTarget.auction_id}/reschedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });

            let data = {};
            try { data = await res.json(); } catch { /* non-JSON response */ }

            if (!res.ok) {
                setRescheduleToast({ type: 'error', message: data.error || `Server error (${res.status})` });
            } else {
                setRescheduleToast({ type: 'success', message: 'Rescheduled! Moving to Scheduled…' });
                setTimeout(() => {
                    setRescheduleTarget(null);
                    setRefreshKey(k => k + 1);
                }, 1500);
            }
        } catch (err) {
            console.error('Reschedule error:', err);
            setRescheduleToast({ type: 'error', message: err?.message || 'Network error. Please try again.' });
        } finally {
            setIsRescheduling(false);
        }
    };

    const handleMoveToDraft = (auction) => {
        showModal({
            title: 'Move to Drafts',
            message: `This will remove the failed auction and move "${auction.product_name}" back to your drafts so you can reschedule it fresh.`,
            type: 'warning',
            confirmText: 'Move to Drafts',
            onConfirm: async () => {
                setDeletingId(auction.auction_id);
                try {
                    const token = localStorage.getItem('bidpal_token');
                    const res = await fetch(`${apiUrl}/api/auctions/${auction.auction_id}`, {
                        method: 'DELETE',
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                    });
                    if (res.ok) {
                        setAuctions(prev => prev.filter(a => a.auction_id !== auction.auction_id));
                        showModal({
                            title: 'Moved to Drafts',
                            message: `"${auction.product_name}" is now in your drafts. You can schedule a new auction from there.`,
                            type: 'success', showCancel: false
                        });
                    } else {
                        const d = await res.json();
                        showModal({ title: 'Error', message: d.error || 'Failed to move.', type: 'danger', showCancel: false });
                    }
                } catch {
                    showModal({ title: 'Error', message: 'Network error.', type: 'danger', showCancel: false });
                } finally {
                    setDeletingId(null);
                }
            }
        });
    };

    const handleDelete = (auction) => {
        showModal({
            title: 'Delete Auction',
            message: `Permanently delete the auction record for "${auction.product_name}"? The product will be moved back to drafts.`,
            type: 'danger',
            confirmText: 'Delete',
            onConfirm: async () => {
                setDeletingId(auction.auction_id);
                try {
                    const token = localStorage.getItem('bidpal_token');
                    const res = await fetch(`${apiUrl}/api/auctions/${auction.auction_id}`, {
                        method: 'DELETE',
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                    });
                    if (res.ok) {
                        setAuctions(prev => prev.filter(a => a.auction_id !== auction.auction_id));
                    } else {
                        const d = await res.json();
                        showModal({ title: 'Error', message: d.error || 'Failed to delete.', type: 'danger', showCancel: false });
                    }
                } catch {
                    showModal({ title: 'Error', message: 'Network error.', type: 'danger', showCancel: false });
                } finally {
                    setDeletingId(null);
                }
            }
        });
    };

    // Separate never-went-live from went-live-but-no-winner
    const neverLive = auctions.filter(a => !a.live_started_at);
    const wentLiveNoWinner = auctions.filter(a => !!a.live_started_at);

    if (loading) return <BIDPalLoader />;

    return (
        <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <Link href="/seller/auctions" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    textDecoration: 'none', background: '#f4f4f5', border: '1px solid #e4e4e7',
                    borderRadius: 10, padding: '0.45rem 0.85rem 0.45rem 0.55rem',
                    color: '#3f3f46', fontSize: '0.875rem', fontWeight: 600, marginBottom: '1.25rem'
                }}>
                    <ChevronLeft size={16} />
                    My Auctions
                </Link>
                <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.8rem', fontWeight: 900, color: '#0f172a' }}>
                    Unsuccessful Auctions
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
                    Auctions that were never streamed or ended without a successful bid. Reschedule or move back to drafts.
                </p>
            </div>

            {auctions.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '4rem 2rem',
                    background: '#f8fafc', borderRadius: 16, border: '1.5px dashed #e2e8f0'
                }}>
                    <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>All Clear!</h3>
                    <p style={{ margin: 0, color: '#64748b' }}>No unsuccessful auctions. Great work keeping your schedule!</p>
                </div>
            ) : (
                <>
                    {/* Never Went Live */}
                    {neverLive.length > 0 && (
                        <section style={{ marginBottom: '2.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '2px solid #fef3c7' }}>
                                <WifiOff size={18} color="#b45309" />
                                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Never Streamed ({neverLive.length})
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                                {neverLive.map(auction => (
                                    <AuctionCard
                                        key={auction.auction_id}
                                        auction={auction}
                                        variant="never-live"
                                        openDropdown={openDropdown}
                                        setOpenDropdown={setOpenDropdown}
                                        dropdownRef={dropdownRef}
                                        deletingId={deletingId}
                                        onReschedule={() => openReschedule(auction)}
                                        onMoveToDraft={() => handleMoveToDraft(auction)}
                                        onDelete={() => handleDelete(auction)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Went Live But No Winner */}
                    {wentLiveNoWinner.length > 0 && (
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', paddingBottom: '0.6rem', borderBottom: '2px solid #fee2e2' }}>
                                <Wifi size={18} color="#dc2626" />
                                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Streamed — No Winner ({wentLiveNoWinner.length})
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                                {wentLiveNoWinner.map(auction => (
                                    <AuctionCard
                                        key={auction.auction_id}
                                        auction={auction}
                                        variant="no-winner"
                                        openDropdown={openDropdown}
                                        setOpenDropdown={setOpenDropdown}
                                        dropdownRef={dropdownRef}
                                        deletingId={deletingId}
                                        onReschedule={() => openReschedule(auction)}
                                        onMoveToDraft={() => handleMoveToDraft(auction)}
                                        onDelete={() => handleDelete(auction)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}

            {/* Reschedule Modal */}
            {rescheduleTarget && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
                }} onClick={() => setRescheduleTarget(null)}>
                    <div style={{
                        background: 'white', borderRadius: 20, padding: 'clamp(1.25rem,5vw,2rem)',
                        width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.18)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Reschedule Auction</h2>
                                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>Set a new date and time</p>
                            </div>
                            <button onClick={() => setRescheduleTarget(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px', cursor: 'pointer', display: 'flex' }}>
                                <X size={18} color="#64748b" />
                            </button>
                        </div>

                        {/* Product preview */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem', background: '#fef9c3', borderRadius: 12, marginBottom: '1.25rem', border: '1px solid #fde047' }}>
                            <img src={rescheduleTarget.product_image || 'https://placehold.co/52x52?text=?'} alt={rescheduleTarget.product_name}
                                style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rescheduleTarget.product_name}</div>
                                <div style={{ fontSize: '0.72rem', color: '#92400e', marginTop: '0.2rem', fontWeight: 600 }}>
                                    {rescheduleTarget.live_started_at ? 'Streamed — No Winner' : 'Never Streamed'}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleReschedule}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' }}>New Date</label>
                                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa' }}>
                                    <Calendar size={14} color="#94a3b8" />
                                    <input type="date" required value={rescheduleForm.startDate}
                                        onChange={e => setRescheduleForm(p => ({ ...p, startDate: e.target.value }))}
                                        style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', color: '#0f172a', flex: 1 }}
                                    />
                                </div>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' }}>New Time</label>
                                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa' }}>
                                    <Clock size={14} color="#94a3b8" />
                                    <input type="time" required value={rescheduleForm.startTime}
                                        onChange={e => setRescheduleForm(p => ({ ...p, startTime: e.target.value }))}
                                        style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', color: '#0f172a', flex: 1 }}
                                    />
                                </div>
                            </div>
                            {rescheduleToast && (
                                <div style={{
                                    padding: '0.7rem 0.9rem', borderRadius: 9, marginBottom: '1rem',
                                    background: rescheduleToast.type === 'success' ? '#f0fdf4' : '#fff1f2',
                                    border: `1px solid ${rescheduleToast.type === 'success' ? '#bbf7d0' : '#fecdd3'}`,
                                    color: rescheduleToast.type === 'success' ? '#166534' : '#991b1b',
                                    fontSize: '0.8rem', fontWeight: 600
                                }}>
                                    {rescheduleToast.type === 'success' ? '✓ ' : '✕ '}{rescheduleToast.message}
                                </div>
                            )}

                            <button type="submit" disabled={isRescheduling} style={{
                                width: '100%', background: '#D32F2F', color: 'white', border: 'none',
                                borderRadius: 12, padding: '0.9rem', fontWeight: 700, fontSize: '0.9rem',
                                cursor: isRescheduling ? 'not-allowed' : 'pointer', opacity: isRescheduling ? 0.7 : 1
                            }}>
                                {isRescheduling ? 'Rescheduling…' : 'Confirm Reschedule'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationModal
                {...modalConfig}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}

function AuctionCard({ auction, variant, openDropdown, setOpenDropdown, dropdownRef, deletingId, onReschedule, onMoveToDraft, onDelete }) {
    const isDeleting = deletingId === auction.auction_id;
    const isNeverLive = variant === 'never-live';

    return (
        <div style={{
            background: 'white', borderRadius: 16, border: '1.5px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden'
        }}>
            {/* Card top bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    background: isNeverLive ? '#fef3c7' : '#fee2e2',
                    color: isNeverLive ? '#92400e' : '#dc2626',
                    padding: '0.3rem 0.7rem', borderRadius: 6, fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase'
                }}>
                    {isNeverLive ? <WifiOff size={11} /> : <AlertOctagon size={11} />}
                    {isNeverLive ? 'Not Streamed' : 'No Winner'}
                </span>
                <span style={{ flex: 1, fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                    #{auction.auction_id.slice(0, 8)}
                </span>
                <div style={{ position: 'relative' }} ref={openDropdown === auction.auction_id ? dropdownRef : null}>
                    <button
                        onClick={() => setOpenDropdown(openDropdown === auction.auction_id ? null : auction.auction_id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: 6 }}
                    >
                        <MoreHorizontal size={18} color="#94a3b8" />
                    </button>
                    {openDropdown === auction.auction_id && (
                        <div style={{
                            position: 'absolute', right: 0, top: '110%', background: 'white', borderRadius: 10,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0',
                            minWidth: 160, zIndex: 50, overflow: 'hidden'
                        }}>
                            <button onClick={() => { setOpenDropdown(null); onReschedule(); }} style={dropItem}>
                                <RotateCcw size={14} /> Reschedule
                            </button>
                            <button onClick={() => { setOpenDropdown(null); onMoveToDraft(); }} style={dropItem}>
                                <Package size={14} /> Move to Drafts
                            </button>
                            <button onClick={() => { setOpenDropdown(null); onDelete(); }} disabled={isDeleting}
                                style={{ ...dropItem, color: '#dc2626' }}>
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Product info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem' }}>
                <img
                    src={auction.product_image || 'https://placehold.co/64x64?text=?'}
                    alt={auction.product_name}
                    style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {auction.product_name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                        <Clock size={12} />
                        {isNeverLive
                            ? `Scheduled: ${new Date(auction.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`
                            : `Streamed: ${new Date(auction.live_started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`
                        }
                    </div>
                    {auction.reserve_price > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                            Starting bid: <strong>₱{Number(auction.reserve_price || auction.current_price).toLocaleString()}</strong>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.6rem', padding: '0 1rem 1rem' }}>
                <button onClick={onReschedule} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    background: '#D32F2F', color: 'white', border: 'none', borderRadius: 10,
                    padding: '0.65rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer'
                }}>
                    <RotateCcw size={14} /> Reschedule
                </button>
                <button onClick={onMoveToDraft} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                    background: '#f1f5f9', color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 10,
                    padding: '0.65rem', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer'
                }}>
                    <Package size={14} /> Move to Drafts
                </button>
            </div>
        </div>
    );
}

const dropItem = {
    width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.65rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '0.82rem', fontWeight: 600, color: '#374151', textAlign: 'left',
    transition: 'background 0.1s'
};
