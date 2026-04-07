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
    Users
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { io } from 'socket.io-client';

export default function MyAuctions() {
    const { user } = useAuth();
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
                showModal({ title: 'Already Promoted', message: 'You already promoted this auction. Your followers were notified earlier.', type: 'info', showCancel: false });
                setPromotedAuctions(prev => ({ ...prev, [auctionId]: true }));
            } else {
                const msg = data.notified === 0
                    ? 'Auction promoted! You have no followers yet, but the auction is ready to attract buyers.'
                    : `Auction promoted! ${data.notified} follower${data.notified === 1 ? '' : 's'} have been notified.`;
                showModal({ title: '🚀 Promotion Sent!', message: msg, type: 'success', showCancel: false });
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
    }, [user, activeTab, debouncedSearch]);

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
        // Don't select if clicking on buttons, links, or checkboxes
        if (e.target.closest('button') || e.target.closest('a') || e.target.type === 'checkbox') {
            return;
        }

        if (selectMode) {
            toggleItemSelection(itemId);
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
            itemsToClean = auctions.filter(a => a.status === 'ended' || a.status === 'completed');
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
                        setAuctions(auctions.filter(a => a.status !== 'ended' && a.status !== 'completed'));
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

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <h1>My Auctions</h1>
                    <p>Manage your live, scheduled, and past auctions.</p>
                </div>
                <div className={styles.buttonGroup}>
                    {selectMode ? (
                        <>
                            {selectedItems.length === 1 && (
                                <Link
                                    href={activeTab === 'drafts' 
                                        ? `/seller/add-product?id=${selectedItems[0]}` 
                                        : `/seller/auctions/schedule?id=${auctions.find(a => a.auction_id === selectedItems[0])?.product_id}`
                                    }
                                    className={styles.selectAllBtn} // Reusing style for consistency
                                    style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
                                >
                                    <Edit2 size={18} />
                                    Edit Details
                                </Link>
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
                            {(activeTab === 'drafts' || activeTab === 'scheduled' || activeTab === 'completed') && (
                                <>
                                    <button
                                        onClick={toggleSelectMode}
                                        className={styles.selectBtn}
                                        title="Enter edit mode"
                                    >
                                        <Edit2 size={18} />
                                        Edit
                                    </button>
                                </>
                            )}
                            <Link href="/seller/inventory" className={styles.productsBtn}>
                                <Package size={20} />
                                My Products
                            </Link>
                            <Link href="/seller/auctions/create" className={styles.createBtn}>
                                <Plus size={20} />
                                Create Auction
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
                {loading ? (
                    <div style={{ gridColumn: '1 / -1' }}>
                        <BIDPalLoader size="section" />
                    </div>
                ) : activeTab === 'drafts' ? (
                    // Show draft products
                    draftProducts.length > 0 ? draftProducts.map(product => {
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
                                <div className={styles.dropdownContainer} ref={openDropdown === product.products_id ? dropdownRef : null}>
                                    <button
                                        className={styles.moreBtn}
                                        onClick={() => setOpenDropdown(openDropdown === product.products_id ? null : product.products_id)}
                                    >
                                        <MoreHorizontal size={18} />
                                    </button>
                                    {openDropdown === product.products_id && (
                                        <div className={styles.dropdownMenu}>
                                            <Link
                                                href={`/seller/add-product?id=${product.products_id}`}
                                                className={styles.dropdownItem}
                                                onClick={() => setOpenDropdown(null)}
                                            >
                                                <Edit2 size={16} />
                                                Edit Product
                                            </Link>
                                            <button
                                                className={`${styles.dropdownItem} ${styles.deleteItem}`}
                                                onClick={() => {
                                                    setOpenDropdown(null);
                                                    handleDeleteProduct(product.products_id, product.name);
                                                }}
                                                disabled={isDeleting}
                                            >
                                                <Trash2 size={16} />
                                                Delete Product
                                            </button>
                                        </div>
                                    )}
                                </div>
                                )}
                            </div>

                            <div className={styles.cardBody}>
                                <img
                                    src={product.images && product.images.length > 0 ? product.images[0].image_url : 'https://placehold.co/200x200?text=No+Image'}
                                    alt={product.name}
                                    className={styles.thumbnail}
                                />
                                <div className={styles.info}>
                                    <h3>{product.name}</h3>
                                    <div className={styles.meta}>
                                        <Clock size={14} />
                                        <span>Not scheduled</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.cardFooter}>
                                <div className={styles.metric}>
                                    <span className={styles.metricLabel}>Starting Price</span>
                                    <span className={styles.metricValue}>
                                        ₱ {(product.starting_price || product.price || 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className={styles.metric}>
                                    <span className={styles.metricLabel}>Condition</span>
                                    <span className={styles.metricValue} style={{ textTransform: 'capitalize' }}>
                                        {product.condition || 'New'}
                                    </span>
                                </div>
                            </div>

                            <div className={styles.cardActions}>
                                <Link href={`/seller/inventory`} className={styles.secondaryBtn}>View in Inventory</Link>
                                <Link href={`/seller/auctions/schedule?id=${product.products_id}`} className={styles.primaryBtn}>Schedule Auction</Link>
                            </div>
                        </div>
                        );
                    }) : (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', color: '#888' }}>
                            <Package size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                            <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No draft products</p>
                            <p style={{ fontSize: '0.9rem' }}>All your products are scheduled or active.</p>
                        </div>
                    )
                ) : (
                    // Show auctions
                    auctions.length > 0 ? auctions.map(auction => {
                        const startTime = new Date(auction.start_time);
                        const formattedStartTime = startTime.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        });

                        const isDeleting = deletingId === auction.auction_id;
                        const isActive = auction.status === 'active';
                        const isScheduled = auction.status === 'scheduled';
                        const isCompleted = auction.status === 'ended' || auction.status === 'completed';
                        const isSelected = selectedItems.includes(auction.auction_id);

                        return (
                        <div 
                            key={auction.auction_id} 
                            className={`${styles.auctionCard} ${isSelected ? styles.selectedCard : ''} ${selectMode ? styles.clickableCard : ''}`}
                            onClick={(e) => handleCardClick(auction.auction_id, e)}
                        >
                            <div className={styles.cardHeader}>
                                <span className={`${styles.statusBadge} ${styles[auction.status === 'ended' ? 'completed' : auction.status]}`}>
                                    {auction.status === 'active' && <TrendingUp size={12} />}
                                    {auction.status === 'scheduled' && <Calendar size={12} />}
                                    {(auction.status === 'completed' || auction.status === 'ended') && <CheckCircle2 size={12} />}
                                    {(auction.status === 'ended' ? 'completed' : auction.status).toUpperCase()}
                                </span>
                                <span className={styles.auctionId}>#{auction.auction_id.slice(0, 8)}</span>
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
                                                <Link
                                                    href={`/seller/auctions/schedule?id=${auction.product_id}`}
                                                    className={styles.dropdownItem}
                                                    onClick={() => setOpenDropdown(null)}
                                                >
                                                    <Edit2 size={16} />
                                                    Edit Schedule
                                                </Link>
                                            )}
                                            {isCompleted && (
                                                <Link
                                                    href={`/seller/auctions/${auction.auction_id}/results`}
                                                    className={styles.dropdownItem}
                                                    onClick={() => setOpenDropdown(null)}
                                                >
                                                    <CheckCircle2 size={16} />
                                                    View Results
                                                </Link>
                                            )}
                                            {!isActive && (
                                                <button
                                                    className={`${styles.dropdownItem} ${styles.deleteItem}`}
                                                    onClick={() => {
                                                        setOpenDropdown(null);
                                                        handleDeleteAuction(auction.auction_id, auction.product_name);
                                                    }}
                                                    disabled={isDeleting}
                                                >
                                                    <Trash2 size={16} />
                                                    Delete Auction
                                                </button>
                                            )}
                                            {isActive && (
                                                <div className={styles.dropdownItem} style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                                    <X size={16} />
                                                    Cannot delete active auction
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                )}
                            </div>

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
                                </div>
                            </div>

                            <div className={styles.cardFooter}>
                                <div className={styles.metric}>
                                    <span className={styles.metricLabel}>
                                        {auction.status === 'completed' ? 'Final Price' : auction.buy_now_price > 0 ? 'Buy Now Price' : 'Starting Bid'}
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
                                {auction.status === 'scheduled' && (
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
                                {auction.status === 'active' && <Link href="/seller" className={styles.primaryBtn}>Control Hub</Link>}
                                {(auction.status === 'completed' || auction.status === 'ended') && (
                                    <Link href={`/seller/auctions/${auction.auction_id}/results`} className={styles.primaryBtn}>
                                        View Results
                                    </Link>
                                )}
                            </div>
                        </div>
                        );
                    }) : (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 2rem', color: '#888' }}>
                            <Calendar size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                            <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No auctions yet</p>
                            <p style={{ fontSize: '0.9rem' }}>Create your first auction to start selling.</p>
                        </div>
                    )
                )}
            </div>

            <ConfirmationModal 
                {...modalConfig} 
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} 
            />
        </div>
    );
}
