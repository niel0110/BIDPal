'use client';

import BIDPalLoader from '@/components/BIDPalLoader';
import { useState, useEffect, useRef } from 'react';
import {
    Plus,
    Search,
    MoreHorizontal,
    Clock,
    TrendingUp,
    Calendar,
    Package,
    Trash2,
    X,
    Edit2,
    AlertTriangle,
    CheckCircle2,
    Info,
    AlertOctagon,
    Users,
    ChevronDown,
    ChevronLeft,
    Gavel,
    Tag
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { io } from 'socket.io-client';

export default function MyAuctions() {
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('all');
    const [auctions, setAuctions] = useState([]);
    const [reminderCounts, setReminderCounts] = useState({}); // { auction_id: count }
    const [promotedAuctions, setPromotedAuctions] = useState({}); // { auction_id: true } once promoted
    const [promotingId, setPromotingId] = useState(null);
    const [draftProducts, setDraftProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [deletingId, setDeletingId] = useState(null);
    const [openDropdown, setOpenDropdown] = useState(null);
    const dropdownRef = useRef(null);
    const [cleaningInventory, setCleaningInventory] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [selectMode, setSelectMode] = useState(false);
    const [expandedCard, setExpandedCard] = useState(null);

    const [refreshKey, setRefreshKey] = useState(0);

    // Schedule modal state
    const [scheduleProduct, setScheduleProduct] = useState(null);
    const [saleType, setSaleType] = useState('bid');
    const [scheduleForm, setScheduleForm] = useState({ startDate: '', startTime: '', fixedPrice: '', bidIncrement: '' });
    const [scheduleToast, setScheduleToast] = useState(null);
    const [isScheduling, setIsScheduling] = useState(false);

    // Reschedule modal state (for ended never-went-live auctions)
    const [rescheduleAuction, setRescheduleAuction] = useState(null); // { auction_id, product_name, product_image, incremental_bid_step }
    const [rescheduleForm, setRescheduleForm] = useState({ startDate: '', startTime: '' });
    const [rescheduleToast, setRescheduleToast] = useState(null);
    const [isRescheduling, setIsRescheduling] = useState(false);

    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        confirmText: 'OK',
        cancelText: 'Cancel',
        showCancel: true,
        extraContent: null,
        onConfirm: null
    });

    const showModal = (config) => {
        setModalConfig({
            isOpen: true,
            title: config.title || 'Notification',
            message: config.message || '',
            type: config.type || 'info',
            confirmText: config.confirmText || 'OK',
            cancelText: config.cancelText || 'Cancel',
            showCancel: config.showCancel !== undefined ? config.showCancel : true,
            extraContent: config.extraContent || null,
            onConfirm: config.onConfirm || null
        });
    };

    const openScheduleModal = (item, isAuction = false) => {
        const product = isAuction ? {
            products_id: item.product_id,
            name: item.product_name,
            images: item.product_image ? [{ image_url: item.product_image }] : [],
            reserve_price: item.reserve_price || item.current_price,
            starting_price: item.starting_price || item.current_price,
            buy_now_price: item.buy_now_price,
        } : item;
        setScheduleProduct(product);
        setSaleType('bid');
        setScheduleForm({ startDate: '', startTime: '', fixedPrice: '' });
        setScheduleToast(null);
    };

    const closeScheduleModal = () => {
        setScheduleProduct(null);
        setScheduleToast(null);
    };

    const handleScheduleSubmit = async (e) => {
        e.preventDefault();
        if (!scheduleProduct || !user) return;
        setIsScheduling(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');
            const now = new Date();
            const payload = {
                product_id: scheduleProduct.products_id,
                user_id: user.user_id || user.id,
                seller_id: user.seller_id,
                sale_type: saleType,
                starting_bid: saleType === 'bid' ? scheduleProduct.starting_price : null,
                reserve_price: saleType === 'bid' ? scheduleProduct.reserve_price : null,
                buy_now_price: saleType === 'sale' ? (parseFloat(scheduleForm.fixedPrice) || scheduleProduct.buy_now_price) : null,
                start_date: saleType === 'sale' ? now.toISOString().slice(0, 10) : scheduleForm.startDate,
                start_time: saleType === 'sale' ? now.toTimeString().slice(0, 5) : scheduleForm.startTime,
                bid_increment: saleType === 'bid' ? parseFloat(scheduleForm.bidIncrement) : null,
            };
            const res = await fetch(`${apiUrl}/api/auctions/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) {
                setScheduleToast({ type: 'error', message: data.error || 'Failed to schedule' });
                return;
            }
            setScheduleToast({ type: 'success', message: saleType === 'sale' ? 'Item posted successfully!' : 'Auction scheduled successfully!' });
            setTimeout(() => {
                closeScheduleModal();
                setRefreshKey(k => k + 1);
            }, 1800);
        } catch {
            setScheduleToast({ type: 'error', message: 'An error occurred. Please try again.' });
        } finally {
            setIsScheduling(false);
        }
    };

    const openRescheduleModal = (auction) => {
        setRescheduleAuction({
            auction_id: auction.auction_id,
            product_name: auction.product_name,
            product_image: auction.product_image,
            incremental_bid_step: auction.incremental_bid_step || 0,
            reserve_price: auction.reserve_price || 0,
        });
        setRescheduleForm({ startDate: '', startTime: '' });
        setRescheduleToast(null);
    };

    const closeRescheduleModal = () => {
        setRescheduleAuction(null);
        setRescheduleToast(null);
    };

    const handleRescheduleSubmit = async (e) => {
        e.preventDefault();
        if (!rescheduleAuction || !user) return;
        setIsRescheduling(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');

            const startTimestamp = new Date(`${rescheduleForm.startDate}T${rescheduleForm.startTime}:00`).toISOString();
            if (isNaN(new Date(startTimestamp).getTime())) {
                setRescheduleToast({ type: 'error', message: 'Invalid date or time selected.' });
                return;
            }

            const payload = {
                start_time: startTimestamp,
            };
            const res = await fetch(`${apiUrl}/api/auctions/${rescheduleAuction.auction_id}/reschedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });

            // Safe JSON parse — server may return HTML on unhandled routes
            let data = {};
            try { data = await res.json(); } catch { /* non-JSON response */ }

            if (!res.ok) {
                setRescheduleToast({ type: 'error', message: data.error || `Server error (${res.status})` });
                return;
            }
            setRescheduleToast({ type: 'success', message: 'Auction rescheduled successfully!' });
            setTimeout(() => {
                closeRescheduleModal();
                setRefreshKey(k => k + 1);
            }, 1500);
        } catch (err) {
            console.error('Reschedule error:', err);
            setRescheduleToast({ type: 'error', message: err?.message || 'An error occurred. Please try again.' });
        } finally {
            setIsRescheduling(false);
        }
    };

    const handlePromote = async (auctionId) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem('bidpal_token');
        setPromotingId(auctionId);
        try {
            const res = await fetch(`${apiUrl}/api/auctions/${auctionId}/promote`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) {
                showModal({ title: 'Promote Failed', message: data.error || 'Could not promote auction.', type: 'error', showCancel: false });
            } else if (data.already_promoted) {
                showModal({
                    title: 'Already Promoted',
                    message: 'You already promoted this auction. Your followers were notified earlier. Go to your dashboard to start the live auction.',
                    type: 'info',
                    confirmText: 'Go to Dashboard',
                    showCancel: false,
                    onConfirm: () => router.push('/seller')
                });
                setPromotedAuctions(prev => ({ ...prev, [auctionId]: true }));
            } else {
                const msg = data.notified === 0
                    ? 'Auction promoted! You have no followers yet, but the auction is ready. Head to your dashboard to go live!'
                    : `Auction promoted! ${data.notified} follower${data.notified === 1 ? '' : 's'} have been notified. Head to your dashboard to go live!`;
                showModal({
                    title: 'Promotion Sent!',
                    message: msg,
                    type: 'success',
                    confirmText: 'Go to Dashboard',
                    showCancel: false,
                    onConfirm: () => router.push('/seller')
                });
                setPromotedAuctions(prev => ({ ...prev, [auctionId]: true }));
            }
        } catch {
            showModal({ title: 'Error', message: 'Network error. Please try again.', type: 'error', showCancel: false });
        } finally {
            setPromotingId(null);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setOpenDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounce search query
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300); // 300ms delay

        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            try {
                const userId = user.user_id || user.id;
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');

                // If drafts tab is selected, fetch draft products
                if (activeTab === 'drafts') {
                    // Build URL with search parameter
                    const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : '';
                    const res = await fetch(`${apiUrl}/api/products/seller/${userId}?status=draft${searchParam}`, {
                        headers: {
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    });

                    if (res.ok) {
                        const data = await res.json();
                        // Filter on frontend for drafts since backend doesn't support search for products
                        let products = data.data || [];
                        if (debouncedSearch && debouncedSearch.trim()) {
                            const searchLower = debouncedSearch.toLowerCase().trim();
                            products = products.filter(product =>
                                product.name?.toLowerCase().includes(searchLower) ||
                                product.description?.toLowerCase().includes(searchLower)
                            );
                        }
                        setDraftProducts(products);
                        setAuctions([]);
                    } else {
                        console.error('Failed to fetch draft products');
                        setDraftProducts([]);
                    }
                } else {
                    // Fetch auctions for other tabs with search
                    const statusParam = activeTab !== 'all' ? `status=${activeTab}` : '';
                    const searchParam = debouncedSearch ? `search=${encodeURIComponent(debouncedSearch)}` : '';
                    const params = [statusParam, searchParam].filter(Boolean).join('&');
                    const queryString = params ? `?${params}` : '';

                    const res = await fetch(`${apiUrl}/api/auctions/seller/${userId}${queryString}`, {
                        headers: {
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    });

                    if (res.ok) {
                        const data = await res.json();
                        const auctionList = data.data || [];
                        setAuctions(auctionList);
                        setDraftProducts([]);

                        // Fetch reminder counts + promoted status for scheduled auctions
                        const scheduled = auctionList.filter(a => a.status === 'scheduled');
                        if (scheduled.length > 0) {
                            const [counts, promotedStatuses] = await Promise.all([
                                Promise.all(
                                    scheduled.map(a =>
                                        fetch(`${apiUrl}/api/auctions/${a.auction_id}/reminder-count`)
                                            .then(r => r.ok ? r.json() : { count: 0 })
                                            .then(d => [a.auction_id, d.count || 0])
                                            .catch(() => [a.auction_id, 0])
                                    )
                                ),
                                Promise.all(
                                    scheduled.map(a =>
                                        fetch(`${apiUrl}/api/auctions/${a.auction_id}/promoted`, {
                                            headers: token ? { Authorization: `Bearer ${token}` } : {}
                                        })
                                            .then(r => r.ok ? r.json() : { promoted: false })
                                            .then(d => [a.auction_id, d.promoted || false])
                                            .catch(() => [a.auction_id, false])
                                    )
                                )
                            ]);
                            setReminderCounts(Object.fromEntries(counts));
                            setPromotedAuctions(Object.fromEntries(promotedStatuses));
                        }
                    } else {
                        const errorData = await res.json();
                        console.error('Failed to fetch auctions:', res.status, errorData);
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            setLoading(true);
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user, activeTab, debouncedSearch, refreshKey]);

    // ── Real-time reminder count updates via Socket.IO ───────────────────────
    useEffect(() => {
        const scheduled = auctions.filter(a => a.status === 'scheduled');
        if (scheduled.length === 0) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const socket = io(apiUrl, { transports: ['websocket', 'polling'] });

        socket.on('connect', () => {
            // Join each scheduled auction room to receive count updates
            scheduled.forEach(a => socket.emit('join-auction', a.auction_id));
        });

        socket.on('reminder-count-update', ({ auction_id, count }) => {
            if (auction_id) {
                setReminderCounts(prev => ({ ...prev, [auction_id]: count }));
            }
        });

        return () => {
            scheduled.forEach(a => socket.emit('leave-auction', a.auction_id));
            socket.disconnect();
        };
    }, [auctions]);

    // Clear selections when changing tabs
    useEffect(() => {
        setSelectedItems([]);
        setSelectMode(false);
    }, [activeTab]);

    const toggleSelectMode = () => {
        setSelectMode(!selectMode);
        setSelectedItems([]);
    };

    const toggleItemSelection = (itemId) => {
        if (!selectMode) return;

        setSelectedItems(prev =>
            prev.includes(itemId)
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId]
        );
    };

    const handleCardClick = (itemId, e) => {
        if (e.target.closest('button') || e.target.closest('a') || e.target.type === 'checkbox') {
            return;
        }
        if (selectMode) {
            toggleItemSelection(itemId);
        } else {
            setExpandedCard(prev => prev === itemId ? null : itemId);
        }
    };

    const toggleSelectAll = () => {
        const currentItems = activeTab === 'drafts'
            ? draftProducts.map(p => p.products_id)
            : auctions.map(a => a.auction_id);

        if (selectedItems.length === currentItems.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(currentItems);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedItems.length === 0) {
            alert('No items selected');
            return;
        }

        const itemType = activeTab === 'drafts' ? 'products' : 'auctions';
        
        showModal({
            title: 'Confirm Deletion',
            message: `Are you sure you want to delete ${selectedItems.length} selected ${itemType}?`,
            type: 'danger',
            confirmText: 'Delete',
            onConfirm: async () => {
                setCleaningInventory(true);
                let successCount = 0;
                let failCount = 0;
                let lastErrorMessage = '';

                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                    const token = localStorage.getItem('bidpal_token');

                    await Promise.all(selectedItems.map(async (itemId) => {
                        try {
                            const endpoint = activeTab === 'drafts'
                                ? `${apiUrl}/api/products/${itemId}`
                                : `${apiUrl}/api/auctions/${itemId}`;

                            const res = await fetch(endpoint, {
                                method: 'DELETE',
                                headers: {
                                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                }
                            });

                            if (res.ok) {
                                successCount++;
                            } else {
                                const errorData = await res.json();
                                failCount++;
                                lastErrorMessage = errorData.error || 'Error occurred';
                            }
                        } catch (error) {
                            console.error('Error deleting item:', error);
                            failCount++;
                            lastErrorMessage = 'Network error';
                        }
                    }));

                    // Refresh the list
                    if (activeTab === 'drafts') {
                        setDraftProducts(draftProducts.filter(p => !selectedItems.includes(p.products_id)));
                    } else {
                        setAuctions(auctions.filter(a => !selectedItems.includes(a.auction_id)));
                    }

                    setSelectedItems([]);
                    setSelectMode(false);
                    
                    showModal({
                        title: 'Deletion Result',
                        message: (
                            <div className={styles.resultSummary}>
                                <div className={styles.resultBadge} style={{ background: '#ecfdf5', color: '#059669' }}>
                                    <CheckCircle2 size={18} />
                                    <span>{successCount} Success</span>
                                </div>
                                {failCount > 0 && (
                                    <div className={styles.resultBadge} style={{ background: '#fef2f2', color: '#dc2626' }}>
                                        <AlertTriangle size={18} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span>{failCount} Failed</span>
                                            {lastErrorMessage && (
                                                <small style={{ fontSize: '0.75rem', opacity: 0.8 }}>{lastErrorMessage}</small>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ),
                        type: successCount > 0 && failCount === 0 ? 'success' : 'warning',
                        confirmText: 'Done',
                        showCancel: false
                    });

                } catch (error) {
                    console.error('Error deleting selected items:', error);
                    showModal({
                        title: 'Error',
                        message: 'Error deleting items. Please try again.',
                        type: 'danger',
                        showCancel: false
                    });
                } finally {
                    setCleaningInventory(false);
                }
            }
        });
    };

    const handleDeleteAuction = async (auctionId, productName) => {
        let deleteAssociatedProduct = false;

        const updateDeleteProduct = (e) => {
            deleteAssociatedProduct = e.target.checked;
        };

        showModal({
            title: 'Delete Auction',
            message: `Are you sure you want to delete the auction for "${productName}"?`,
            type: 'danger',
            confirmText: 'Delete',
            extraContent: (
                <label className={styles.checkboxLabel}>
                    <input 
                        type="checkbox" 
                        onChange={updateDeleteProduct}
                        className={styles.modalCheckbox}
                    />
                    <span>Also permanently delete the associated product</span>
                </label>
            ),
            onConfirm: async () => {
                setDeletingId(auctionId);
                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                    const token = localStorage.getItem('bidpal_token');

                    const res = await fetch(`${apiUrl}/api/auctions/${auctionId}?deleteProduct=${deleteAssociatedProduct}`, {
                        method: 'DELETE',
                        headers: {
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    });

                    if (res.ok) {
                        const data = await res.json();
                        setAuctions(auctions.filter(a => a.auction_id !== auctionId));
                        
                        showModal({
                            title: 'Success',
                            message: data.message || 'Auction deleted successfully.',
                            type: 'success',
                            showCancel: false
                        });
                    } else {
                        const errorData = await res.json();
                        showModal({
                            title: 'Error',
                            message: `Failed to delete auction: ${errorData.error || 'Unknown error'}`,
                            type: 'danger',
                            showCancel: false
                        });
                    }
                } catch (error) {
                    console.error('Error deleting auction:', error);
                    showModal({
                        title: 'Error',
                        message: 'Error deleting auction. Please try again.',
                        type: 'danger',
                        showCancel: false
                    });
                } finally {
                    setDeletingId(null);
                }
            }
        });
    };

    const handleDeleteProduct = async (productId, productName) => {
        showModal({
            title: 'Delete Product',
            message: `Are you sure you want to delete "${productName}"?`,
            type: 'danger',
            confirmText: 'Delete',
            onConfirm: async () => {
                setDeletingId(productId);
                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                    const token = localStorage.getItem('bidpal_token');

                    const res = await fetch(`${apiUrl}/api/products/${productId}`, {
                        method: 'DELETE',
                        headers: {
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        }
                    });

                    if (res.ok) {
                        setDraftProducts(draftProducts.filter(p => p.products_id !== productId));
                        showModal({
                            title: 'Success',
                            message: 'Product deleted successfully',
                            type: 'success',
                            showCancel: false
                        });
                    } else {
                        const errorData = await res.json();
                        showModal({
                            title: 'Error',
                            message: `Failed to delete product: ${errorData.error || 'Unknown error'}`,
                            type: 'danger',
                            showCancel: false
                        });
                    }
                } catch (error) {
                    console.error('Error deleting product:', error);
                    showModal({
                        title: 'Error',
                        message: 'Error deleting product. Please try again.',
                        type: 'danger',
                        showCancel: false
                    });
                } finally {
                    setDeletingId(null);
                }
            }
        });
    };

    const handleCleanInventory = async () => {
        let itemsToClean = [];
        let itemType = '';

        if (activeTab === 'drafts') {
            itemsToClean = draftProducts;
            itemType = 'draft products';
        } else if (activeTab === 'scheduled') {
            itemsToClean = auctions.filter(a => a.status === 'scheduled');
            itemType = 'scheduled auctions';
        } else if (activeTab === 'completed') {
            itemsToClean = auctions.filter(a => (a.status === 'ended' || a.status === 'completed') && a.winner_user_id);
            itemType = 'completed auctions';
        } else {
            showModal({
                title: 'Information',
                message: 'Clean inventory is only available for Drafts, Scheduled, and Completed tabs.',
                type: 'info',
                showCancel: false
            });
            return;
        }

        if (itemsToClean.length === 0) {
            showModal({
                title: 'Empty',
                message: `No ${itemType} to clean.`,
                type: 'info',
                showCancel: false
            });
            return;
        }

        const confirmMessage = activeTab === 'drafts'
            ? `Are you sure you want to delete all ${itemsToClean.length} draft products?\n\nThis action cannot be undone.`
            : `Are you sure you want to delete all ${itemsToClean.length} ${itemType}?\n\nProducts will be moved back to draft status.`;

        showModal({
            title: 'Clean Inventory',
            message: confirmMessage,
            type: 'warning',
            confirmText: 'Clean All',
            onConfirm: async () => {
                setCleaningInventory(true);
                let successCount = 0;
                let failCount = 0;
                let lastErrorMessage = '';

                try {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                    const token = localStorage.getItem('bidpal_token');

                    await Promise.all(itemsToClean.map(async (item) => {
                        const id = item.products_id || item.auction_id;
                        const endpoint = activeTab === 'drafts' ? `products/${id}` : `auctions/${id}`;
                        
                        try {
                            const res = await fetch(`${apiUrl}/api/${endpoint}`, {
                                method: 'DELETE',
                                headers: {
                                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                                }
                            });
                            if (res.ok) {
                                successCount++;
                            } else {
                                const errorData = await res.json();
                                failCount++;
                                lastErrorMessage = errorData.error || 'Error occurred';
                            }
                        } catch (err) {
                            failCount++;
                            lastErrorMessage = 'Network error';
                        }
                    }));

                    // Refresh the list
                    if (activeTab === 'drafts') {
                        setDraftProducts([]);
                    } else if (activeTab === 'scheduled') {
                        setAuctions(auctions.filter(a => a.status !== 'scheduled'));
                    } else if (activeTab === 'completed') {
                        setAuctions(auctions.filter(a => !((a.status === 'ended' || a.status === 'completed') && a.winner_user_id)));
                    }

                    showModal({
                        title: 'Cleanup Complete',
                        message: (
                            <div className={styles.resultSummary}>
                                <div className={styles.resultBadge} style={{ background: '#ecfdf5', color: '#059669' }}>
                                    <CheckCircle2 size={18} />
                                    <span>{successCount} Cleaned</span>
                                </div>
                                {failCount > 0 && (
                                    <div className={styles.resultBadge} style={{ background: '#fef2f2', color: '#dc2626' }}>
                                        <AlertTriangle size={18} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span>{failCount} Errors</span>
                                            {lastErrorMessage && (
                                                <small style={{ fontSize: '0.75rem', opacity: 0.8 }}>{lastErrorMessage}</small>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ),
                        type: 'success',
                        confirmText: 'Great!',
                        showCancel: false
                    });

                } catch (error) {
                    console.error('Error cleaning inventory:', error);
                    showModal({
                        title: 'Error',
                        message: 'Error cleaning inventory. Please try again.',
                        type: 'danger',
                        showCancel: false
                    });
                } finally {
                    setCleaningInventory(false);
                }
            }
        });
    };

    const bidAuctions = auctions.filter(a => a.sale_type === 'bid' || (!a.sale_type && !(a.buy_now_price > 0)));

    const renderDraftCard = (product) => {
        const isDeleting = deletingId === product.products_id;
        const isSelected = selectedItems.includes(product.products_id);
        return (
            <div
                key={product.products_id}
                className={`${styles.auctionCard} ${isSelected ? styles.selectedCard : ''} ${selectMode ? styles.clickableCard : ''}`}
                onClick={(e) => handleCardClick(product.products_id, e)}
            >
                <div className={styles.cardHeader}>
                    <span className={`${styles.statusBadge} ${styles.drafts}`}>
                        <Package size={12} />
                        DRAFT
                    </span>
                    <span className={styles.auctionId}>#{product.products_id.slice(0, 8)}</span>
                    {!selectMode && (
                        <button
                            className={`${styles.chevronBtn} ${expandedCard === product.products_id ? styles.chevronOpen : ''}`}
                            onClick={() => setExpandedCard(prev => prev === product.products_id ? null : product.products_id)}
                        >
                            <ChevronDown size={16} />
                        </button>
                    )}
                    {!selectMode && (
                        <div className={styles.dropdownContainer} ref={openDropdown === product.products_id ? dropdownRef : null}>
                            <button className={styles.moreBtn} onClick={() => setOpenDropdown(openDropdown === product.products_id ? null : product.products_id)}>
                                <MoreHorizontal size={18} />
                            </button>
                            {openDropdown === product.products_id && (
                                <div className={styles.dropdownMenu}>
                                    <Link href={`/seller/add-product?id=${product.products_id}`} className={styles.dropdownItem} onClick={() => setOpenDropdown(null)}>
                                        <Edit2 size={14} />
                                        Edit
                                    </Link>
                                    <button
                                        className={`${styles.dropdownItem} ${styles.deleteItem}`}
                                        onClick={() => { setOpenDropdown(null); handleDeleteProduct(product.products_id, product.name); }}
                                        disabled={isDeleting}
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {expandedCard !== product.products_id && (
                    <div className={styles.cardSummary}>
                        <img src={product.images?.[0]?.image_url || 'https://placehold.co/200x200?text=No+Image'} alt={product.name} className={styles.summaryThumb} />
                        <span className={styles.summaryName}>{product.name}</span>
                    </div>
                )}
                {expandedCard === product.products_id && (
                    <>
                        <div className={styles.cardBody}>
                            <img src={product.images?.[0]?.image_url || 'https://placehold.co/200x200?text=No+Image'} alt={product.name} className={styles.thumbnail} />
                            <div className={styles.info}>
                                <h3>{product.name}</h3>
                                <div className={styles.meta}><Clock size={14} /><span>Not scheduled</span></div>
                            </div>
                        </div>
                        <div className={styles.cardFooter}>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>Starting Price</span>
                                <span className={styles.metricValue}>₱ {(product.starting_price || product.price || 0).toLocaleString()}</span>
                            </div>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>Condition</span>
                                <span className={styles.metricValue} style={{ textTransform: 'capitalize' }}>{product.condition || 'New'}</span>
                            </div>
                        </div>
                        <div className={styles.cardActions}>
                            <Link href="/seller/inventory" className={styles.secondaryBtn}>View in Inventory</Link>
                            <button className={styles.primaryBtn} onClick={() => openScheduleModal(product)}>Schedule Auction</button>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const renderGridContent = () => {
        if (loading) return <div style={{ gridColumn: '1 / -1' }}><BIDPalLoader size="section" /></div>;
        if (activeTab === 'drafts') {
            if (!draftProducts.length) return (
                <div className={styles.emptyState}>
                    <Package size={40} className={styles.emptyIcon} />
                    <p className={styles.emptyTitle}>No draft products</p>
                    <p className={styles.emptyDesc}>All your products are scheduled or active.</p>
                </div>
            );
            return draftProducts.map(renderDraftCard);
        }
        if (!auctions.length) return (
            <div className={styles.emptyState}>
                <Calendar size={40} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No auctions yet</p>
                <p className={styles.emptyDesc}>Create your first auction to start selling.</p>
            </div>
        );
        if (!bidAuctions.length) return (
            <div className={styles.emptyState}>
                <Calendar size={40} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No auctions yet</p>
                <p className={styles.emptyDesc}>Create your first auction to start selling.</p>
            </div>
        );
        return bidAuctions.map(renderAuctionCard);
    };

    const sectionHeader = (label, icon) => (
        <div style={{
            gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 0.1rem', borderBottom: '2px solid #f0f0f0', marginTop: '0.25rem'
        }}>
            {icon}
            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        </div>
    );

    const renderAuctionCard = (auction) => {
        const startTime = new Date(auction.start_time);
        const formattedStartTime = startTime.toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        });
        const isDeleting = deletingId === auction.auction_id;
        const isActive = auction.status === 'active';
        const isScheduled = auction.status === 'scheduled';
        // Completed = had a winner (successful bid)
        const isCompletedLive = (auction.status === 'ended' || auction.status === 'completed') && !!auction.winner_user_id;
        // Ended = no winner (never went live OR went live but no bid won)
        const isEndedOverdue = auction.status === 'ended' && !auction.winner_user_id;
        const isSelected = selectedItems.includes(auction.auction_id);

        // Badge display values
        const badgeStatus = isEndedOverdue ? 'ended' : isCompletedLive ? 'completed' : auction.status;
        const badgeLabel = badgeStatus.toUpperCase();

        return (
            <div
                key={auction.auction_id}
                className={`${styles.auctionCard} ${isSelected ? styles.selectedCard : ''} ${selectMode ? styles.clickableCard : ''}`}
                onClick={(e) => handleCardClick(auction.auction_id, e)}
            >
                <div className={styles.cardHeader}>
                    <span className={`${styles.statusBadge} ${styles[badgeStatus]}`}>
                        {isActive && <TrendingUp size={12} />}
                        {isScheduled && <Calendar size={12} />}
                        {isCompletedLive && <CheckCircle2 size={12} />}
                        {isEndedOverdue && <AlertOctagon size={12} />}
                        {badgeLabel}
                    </span>
                    <span className={styles.auctionId}>#{auction.auction_id.slice(0, 8)}</span>
                    {!selectMode && (
                        <button
                            className={`${styles.chevronBtn} ${expandedCard === auction.auction_id ? styles.chevronOpen : ''}`}
                            onClick={() => setExpandedCard(prev => prev === auction.auction_id ? null : auction.auction_id)}
                        >
                            <ChevronDown size={16} />
                        </button>
                    )}
                    {!selectMode && (
                        <div className={styles.dropdownContainer} ref={openDropdown === auction.auction_id ? dropdownRef : null}>
                            <button
                                className={styles.moreBtn}
                                onClick={() => setOpenDropdown(openDropdown === auction.auction_id ? null : auction.auction_id)}
                            >
                                <MoreHorizontal size={18} />
                            </button>
                            {openDropdown === auction.auction_id && (
                                <div className={styles.dropdownMenu}>
                                    {isScheduled && (
                                        <button
                                            className={styles.dropdownItem}
                                            onClick={() => { setOpenDropdown(null); openScheduleModal(auction, true); }}
                                        >
                                            <Edit2 size={14} />
                                            Edit
                                        </button>
                                    )}
                                    {isEndedOverdue && (
                                        <button
                                            className={styles.dropdownItem}
                                            onClick={() => { setOpenDropdown(null); openRescheduleModal(auction); }}
                                        >
                                            <Calendar size={14} />
                                            Reschedule
                                        </button>
                                    )}
                                    {isCompletedLive && (
                                        <Link
                                            href={`/seller/auctions/${auction.auction_id}/results`}
                                            className={styles.dropdownItem}
                                            onClick={() => setOpenDropdown(null)}
                                        >
                                            <CheckCircle2 size={14} />
                                            View Results
                                        </Link>
                                    )}
                                    {!isActive && (
                                        <button
                                            className={`${styles.dropdownItem} ${styles.deleteItem}`}
                                            onClick={() => { setOpenDropdown(null); handleDeleteAuction(auction.auction_id, auction.product_name); }}
                                            disabled={isDeleting}
                                        >
                                            <Trash2 size={14} />
                                            Delete
                                        </button>
                                    )}
                                    {isActive && (
                                        <div className={styles.dropdownItem} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                            <X size={14} />
                                            Can&apos;t delete
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {expandedCard !== auction.auction_id && (
                    <div className={styles.cardSummary}>
                        <img
                            src={auction.product_image || 'https://placehold.co/200x200?text=No+Image'}
                            alt={auction.product_name}
                            className={styles.summaryThumb}
                        />
                        <div className={styles.summaryInfo}>
                            <span className={styles.summaryName}>{auction.product_name}</span>
                            <span className={styles.summaryMeta}>{formattedStartTime}</span>
                        </div>
                    </div>
                )}

                {expandedCard === auction.auction_id && (
                    <>
                        <div className={styles.cardBody}>
                            <img
                                src={auction.product_image || 'https://placehold.co/200x200?text=No+Image'}
                                alt={auction.product_name}
                                className={styles.thumbnail}
                            />
                            <div className={styles.info}>
                                <h3>{auction.product_name}</h3>
                                <div className={styles.meta}>
                                    <Clock size={14} />
                                    <span>{formattedStartTime}</span>
                                </div>
                                {isEndedOverdue && (
                                    <div className={styles.meta} style={{ color: '#dc2626', marginTop: '0.25rem' }}>
                                        <AlertOctagon size={14} />
                                        <span>Not streamed — scheduled time passed</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.cardFooter}>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>
                                    {isCompletedLive ? 'Final Price' : auction.buy_now_price > 0 ? 'Buy Now Price' : 'Starting Bid'}
                                </span>
                                <span className={styles.metricValue}>
                                    ₱ {(auction.buy_now_price > 0 ? auction.buy_now_price : auction.current_price || auction.reserve_price || 0).toLocaleString()}
                                </span>
                            </div>
                            <div className={styles.metric}>
                                <span className={styles.metricLabel}>Type</span>
                                <span className={styles.metricValue}>
                                    {auction.buy_now_price > 0 ? 'Fixed Sale' : 'Auction'}
                                </span>
                            </div>
                        </div>

                        <div className={styles.cardActions}>
                            {isScheduled && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'space-between' }}>
                                    <button
                                        className={styles.primaryBtn}
                                        onClick={() => handlePromote(auction.auction_id)}
                                        disabled={promotingId === auction.auction_id || promotedAuctions[auction.auction_id]}
                                        style={promotedAuctions[auction.auction_id] ? { opacity: 0.6, cursor: 'default' } : {}}
                                    >
                                        {promotingId === auction.auction_id ? 'Sending...' : promotedAuctions[auction.auction_id] ? 'Promoted' : 'Promote'}
                                    </button>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        background: '#ede9fe', borderRadius: '20px',
                                        padding: '0.3rem 0.75rem', border: '1px solid #c4b5fd',
                                        fontSize: '0.78rem', fontWeight: 700, color: '#5b21b6'
                                    }}>
                                        <Users size={13} strokeWidth={2.5} />
                                        <span style={{ fontSize: '0.9rem' }}>{reminderCounts[auction.auction_id] ?? 0}</span>
                                    </div>
                                </div>
                            )}
                            {isActive && <Link href="/seller" className={styles.primaryBtn}>Control Hub</Link>}
                            {isCompletedLive && (
                                <Link href={`/seller/auctions/${auction.auction_id}/results`} className={styles.primaryBtn}>
                                    View Results
                                </Link>
                            )}
                            {isEndedOverdue && (
                                <button
                                    className={styles.primaryBtn}
                                    onClick={() => openRescheduleModal(auction)}
                                    style={{ background: '#D32F2F' }}
                                >
                                    Reschedule
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <Link href="/seller" className={styles.backLink}>
                        <span className={styles.backLinkIcon}>
                            <ChevronLeft size={18} strokeWidth={2.5} />
                        </span>
                        <span>Back</span>
                    </Link>
                    <h1>My Auctions</h1>
                    <p>Manage your live, scheduled, and past auctions.</p>
                </div>
                <div className={styles.buttonGroup}>
                    {selectMode ? (
                        <>
                            {selectedItems.length === 1 && (
                                activeTab === 'drafts' ? (
                                    <Link
                                        href={`/seller/add-product?id=${selectedItems[0]}`}
                                        className={styles.selectAllBtn}
                                        style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                                    >
                                        <Edit2 size={18} />
                                        Edit Details
                                    </Link>
                                ) : (
                                    <button
                                        className={styles.selectAllBtn}
                                        style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                                        onClick={() => {
                                            const auction = auctions.find(a => a.auction_id === selectedItems[0]);
                                            if (auction) openScheduleModal(auction, true);
                                        }}
                                    >
                                        <Edit2 size={18} />
                                        Edit Details
                                    </button>
                                )
                            )}
                            {selectedItems.length > 0 && (
                                <button
                                    onClick={handleDeleteSelected}
                                    disabled={cleaningInventory}
                                    className={styles.deleteSelectedBtn}
                                >
                                    <Trash2 size={18} />
                                    Delete {selectedItems.length > 1 ? `Selected (${selectedItems.length})` : ''}
                                </button>
                            )}
                            <button
                                onClick={toggleSelectMode}
                                className={styles.cancelBtn}
                            >
                                <X size={18} />
                                {selectedItems.length > 0 ? 'Finish' : 'Cancel'}
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/seller/inventory" className={styles.productsBtn} title="My Products">
                                <Package size={20} />
                                <span className={styles.btnLabel}>My Products</span>
                            </Link>
                            <Link href="/seller/auctions/ended" className={styles.unsuccessfulBtn} title="Unsuccessful Auctions">
                                <AlertOctagon size={20} />
                                <span className={styles.btnLabel}>Unsuccessful</span>
                            </Link>
                            <Link href="/seller/auctions/create" className={styles.createBtn} title="Create Auction">
                                <Plus size={20} />
                                <span className={styles.btnLabel}>Create Auction</span>
                            </Link>
                        </>
                    )}
                </div>
            </header>

            <div className={styles.tabsContainer}>
                <div className={styles.tabs}>
                    {['all', 'active', 'scheduled', 'completed', 'drafts'].map(tab => (
                        <button
                            key={tab}
                            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
                <div className={styles.searchBox}>
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search auctions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className={styles.auctionGrid}>
                {renderGridContent()}
            </div>

            <ConfirmationModal
                {...modalConfig}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
            />

            {/* Reschedule Modal — for ended (never went live) auctions */}
            {rescheduleAuction && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
                }} onClick={closeRescheduleModal}>
                    <div style={{
                        background: 'white', borderRadius: 20, padding: 'clamp(1.25rem, 5vw, 2rem)', width: '100%', maxWidth: 480,
                        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Reschedule Auction</h2>
                                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>Set a new date and time for this auction</p>
                            </div>
                            <button onClick={closeRescheduleModal} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px', cursor: 'pointer', display: 'flex' }}>
                                <X size={18} color="#64748b" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem', background: '#fef2f2', borderRadius: 12, marginBottom: '1.5rem', border: '1px solid #fecdd3' }}>
                            <img
                                src={rescheduleAuction.product_image || 'https://placehold.co/56x56?text=No+Image'}
                                alt={rescheduleAuction.product_name}
                                style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rescheduleAuction.product_name}</div>
                                <div style={{ fontSize: '0.73rem', color: '#dc2626', marginTop: '0.25rem', fontWeight: 600 }}>⚠️ Previously ended — not streamed</div>
                            </div>
                        </div>

                        <form onSubmit={handleRescheduleSubmit}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>New Date &amp; Time</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa' }}>
                                        <Calendar size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
                                        <input type="date" required value={rescheduleForm.startDate}
                                            onChange={e => setRescheduleForm(p => ({ ...p, startDate: e.target.value }))}
                                            style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', color: '#0f172a', flex: 1 }}
                                        />
                                    </div>
                                    <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa' }}>
                                        <Clock size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
                                        <input type="time" required value={rescheduleForm.startTime}
                                            onChange={e => setRescheduleForm(p => ({ ...p, startTime: e.target.value }))}
                                            style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', color: '#0f172a', flex: 1 }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {rescheduleToast && (
                                <div style={{
                                    padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1rem',
                                    background: rescheduleToast.type === 'success' ? '#f0fdf4' : '#fff1f2',
                                    border: `1px solid ${rescheduleToast.type === 'success' ? '#bbf7d0' : '#fecdd3'}`,
                                    color: rescheduleToast.type === 'success' ? '#166534' : '#991b1b',
                                    fontSize: '0.82rem', fontWeight: 600
                                }}>
                                    {rescheduleToast.type === 'success' ? '✓ ' : '✕ '}{rescheduleToast.message}
                                </div>
                            )}

                            <button type="submit" disabled={isRescheduling} style={{
                                width: '100%', background: '#D32F2F', color: 'white', border: 'none',
                                borderRadius: 12, padding: '0.9rem', fontWeight: 700, fontSize: '0.92rem',
                                cursor: isRescheduling ? 'not-allowed' : 'pointer', opacity: isRescheduling ? 0.7 : 1,
                                transition: 'opacity 0.15s'
                            }}>
                                {isRescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Schedule Modal */}
            {scheduleProduct && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
                }} onClick={closeScheduleModal}>
                    <div style={{
                        background: 'white', borderRadius: 20, padding: 'clamp(1.25rem, 5vw, 2rem)', width: '100%', maxWidth: 500,
                        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                                    {saleType === 'sale' ? 'Post Product' : 'Schedule Auction'}
                                </h2>
                                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                                    {saleType === 'sale' ? 'Set a price and list this item immediately' : 'Set when this item goes live'}
                                </p>
                            </div>
                            <button onClick={closeScheduleModal} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px', cursor: 'pointer', display: 'flex' }}>
                                <X size={18} color="#64748b" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem', background: '#f8fafc', borderRadius: 12, marginBottom: '1.5rem' }}>
                            <img
                                src={scheduleProduct.images?.[0]?.image_url || 'https://placehold.co/56x56?text=No+Image'}
                                alt={scheduleProduct.name}
                                style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scheduleProduct.name}</div>
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.3rem' }}>
                                    {scheduleProduct.reserve_price > 0 && (
                                        <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                                            Reserve: <strong style={{ color: '#D32F2F' }}>₱{Number(scheduleProduct.reserve_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                    )}
                                    {scheduleProduct.starting_price > 0 && (
                                        <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
                                            Starting Bid: <strong style={{ color: '#0f172a' }}>₱{Number(scheduleProduct.starting_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleScheduleSubmit}>
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Sale Type</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                    {[
                                        { id: 'bid', icon: <Gavel size={18} />, label: 'Bid it', sub: 'Live auction' },
                                        { id: 'sale', icon: <Tag size={18} />, label: 'Fixed sale', sub: 'Set price' },
                                    ].map(opt => (
                                        <button key={opt.id} type="button" onClick={() => setSaleType(opt.id)} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.65rem',
                                            padding: '0.75rem 1rem', borderRadius: 12, cursor: 'pointer',
                                            border: `2px solid ${saleType === opt.id ? '#D32F2F' : '#e2e8f0'}`,
                                            background: saleType === opt.id ? '#fff1f2' : 'white',
                                            color: saleType === opt.id ? '#D32F2F' : '#475569',
                                            fontWeight: 600, fontSize: '0.85rem', textAlign: 'left'
                                        }}>
                                            {opt.icon}
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{opt.label}</div>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.7 }}>{opt.sub}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {saleType === 'sale' && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Buy Now Price</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 0.85rem', background: '#fafafa' }}>
                                        <span style={{ fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>₱</span>
                                        <input type="number" step="0.01" min="0" placeholder="0.00" required={saleType === 'sale'}
                                            value={scheduleForm.fixedPrice}
                                            onChange={e => setScheduleForm(p => ({ ...p, fixedPrice: e.target.value }))}
                                            style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem 0', fontSize: '0.9rem', outline: 'none', color: '#0f172a' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {saleType !== 'sale' && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Bid Increment</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0 0.85rem', background: '#fafafa' }}>
                                        <span style={{ fontWeight: 700, color: '#475569', fontSize: '0.9rem' }}>₱</span>
                                        <input type="number" step="1" min="1" placeholder="50" required
                                            value={scheduleForm.bidIncrement}
                                            onChange={e => setScheduleForm(p => ({ ...p, bidIncrement: e.target.value }))}
                                            style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.75rem 0', fontSize: '0.9rem', outline: 'none', color: '#0f172a' }}
                                        />
                                    </div>
                                    <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.35rem', marginBottom: 0 }}>
                                        Every new bid must increase by this seller-set amount.
                                    </p>
                                </div>
                            )}

                            {saleType !== 'sale' && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>Date & Time</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa' }}>
                                            <Calendar size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
                                            <input type="date" required value={scheduleForm.startDate}
                                                onChange={e => setScheduleForm(p => ({ ...p, startDate: e.target.value }))}
                                                style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', color: '#0f172a', flex: 1, minWidth: 0, width: '100%' }}
                                            />
                                        </div>
                                        <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '0.6rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fafafa' }}>
                                            <Clock size={15} color="#94a3b8" style={{ flexShrink: 0 }} />
                                            <input type="time" required value={scheduleForm.startTime}
                                                onChange={e => setScheduleForm(p => ({ ...p, startTime: e.target.value }))}
                                                style={{ border: 'none', background: 'transparent', fontSize: '0.85rem', outline: 'none', color: '#0f172a', flex: 1, minWidth: 0, width: '100%' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {saleType !== 'sale' && (
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
                                    Your item will automatically go live at the scheduled time.
                                </p>
                            )}

                            {scheduleToast && (
                                <div style={{
                                    padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1rem',
                                    background: scheduleToast.type === 'success' ? '#f0fdf4' : '#fff1f2',
                                    border: `1px solid ${scheduleToast.type === 'success' ? '#bbf7d0' : '#fecdd3'}`,
                                    color: scheduleToast.type === 'success' ? '#166534' : '#991b1b',
                                    fontSize: '0.82rem', fontWeight: 600
                                }}>
                                    {scheduleToast.type === 'success' ? '✓ ' : '✕ '}{scheduleToast.message}
                                </div>
                            )}

                            <button type="submit" disabled={isScheduling} style={{
                                width: '100%', background: '#D32F2F', color: 'white', border: 'none',
                                borderRadius: 12, padding: '0.9rem', fontWeight: 700, fontSize: '0.92rem',
                                cursor: isScheduling ? 'not-allowed' : 'pointer', opacity: isScheduling ? 0.7 : 1,
                                transition: 'opacity 0.15s'
                            }}>
                                {isScheduling ? (saleType === 'sale' ? 'Posting...' : 'Scheduling...') : (saleType === 'sale' ? 'Post Item' : 'Confirm Schedule')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
