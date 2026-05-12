'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, X, Gavel, Tag, Calendar, Clock, MoreVertical, Edit2 } from 'lucide-react';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function InventoryPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

    // Schedule modal state
    const [scheduleProduct, setScheduleProduct] = useState(null); // { products_id, name, images, reserve_price, starting_price }
    const [saleType, setSaleType] = useState('bid');
    const [scheduleForm, setScheduleForm] = useState({ startDate: '', startTime: '', fixedPrice: '', bidIncrement: '' });
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleToast, setScheduleToast] = useState(null);
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    const [productToEdit, setProductToEdit] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchProducts = async () => {
        if (!user) return;
        try {
            const userId = user.user_id || user.id;
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');

            const res = await fetch(`${apiUrl}/api/products/seller/${userId}`, {
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Network error' }));
                throw new Error(errorData.error || 'Failed to fetch products');
            }

            const responseData = await res.json();
            const allProducts = responseData.data || [];
            setProducts(allProducts.filter(p => p.status === 'draft' || p.status === 'pending' || !p.status));
        } catch (error) {
            console.error('Error fetching inventory:', error.message);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchProducts();
        else setLoading(false);
    }, [user]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveDropdownId(null);
        if (activeDropdownId) {
            window.addEventListener('click', handleClickOutside);
        }
        return () => window.removeEventListener('click', handleClickOutside);
    }, [activeDropdownId]);

    const handleDeleteClick = (product) => {
        setProductToDelete(product);
        setShowDeleteConfirm(true);
        setActiveDropdownId(null);
    };

    const confirmDelete = async () => {
        if (!productToDelete) return;
        const productId = productToDelete.products_id;
        
        setDeletingId(productId);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');

            const res = await fetch(`${apiUrl}/api/products/${productId}`, {
                method: 'DELETE',
                headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
            });

            if (res.ok) {
                setProducts(products.filter(p => p.products_id !== productId));
            } else {
                const errorData = await res.json();
                alert(`Failed to delete product: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error deleting product:', error);
        } finally {
            setDeletingId(null);
            setProductToDelete(null);
        }
    };

    const handleEditClick = (product) => {
        setProductToEdit({ ...product });
        setActiveDropdownId(null);
    };

    const handleUpdateProduct = async (e) => {
        e.preventDefault();
        if (!productToEdit) return;
        setIsUpdating(true);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');

            const res = await fetch(`${apiUrl}/api/products/${productToEdit.products_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    name: productToEdit.name,
                    description: productToEdit.description,
                    starting_price: productToEdit.starting_price,
                    reserve_price: productToEdit.reserve_price
                })
            });

            if (res.ok) {
                const updatedProduct = await res.json();
                setProducts(products.map(p => p.products_id === productToEdit.products_id ? { ...p, ...productToEdit } : p));
                setProductToEdit(null);
            } else {
                const errorData = await res.json();
                alert(`Failed to update product: ${errorData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error updating product:', error);
            alert('Error updating product. Please try again.');
        } finally {
            setIsUpdating(false);
        }
    };

    const openScheduleModal = (product) => {
        setScheduleProduct(product);
        setSaleType('bid');
        setScheduleForm({ startDate: '', startTime: '', fixedPrice: '', bidIncrement: product?.bid_increment ? String(product.bid_increment) : '' });
        setScheduleToast(null);
    };

    const isAlreadyScheduled = scheduleToast?.type === 'error' && scheduleToast?.message?.toLowerCase().includes('already scheduled');

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
            let startISO, endISO;

            if (saleType === 'sale') {
                startISO = now.toISOString();
            } else {
                const startDateObj = new Date(`${scheduleForm.startDate}T${scheduleForm.startTime}:00`);
                startISO = startDateObj.toISOString();
                
                if (scheduleForm.endDate && scheduleForm.endTime) {
                    const endDateObj = new Date(`${scheduleForm.endDate}T${scheduleForm.endTime}:00`);
                    endISO = endDateObj.toISOString();
                }
            }

            const payload = {
                product_id: scheduleProduct.products_id,
                user_id: user.user_id || user.id,
                seller_id: user.seller_id,
                sale_type: saleType,
                starting_bid: saleType === 'bid' ? scheduleProduct.starting_price : null,
                reserve_price: saleType === 'bid' ? scheduleProduct.reserve_price : null,
                buy_now_price: saleType === 'sale' ? (parseFloat(scheduleForm.fixedPrice) || scheduleProduct.buy_now_price) : null,
                start_timestamp: startISO,
                end_timestamp: endISO,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                availability: saleType === 'sale' ? 1 : (scheduleForm.availability || 1),
            };

            const res = await fetch(`${apiUrl}/api/auctions/schedule`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!res.ok) {
                setScheduleToast({ type: 'error', message: data.error || 'Failed to schedule auction' });
                return;
            }

            setScheduleToast({ type: 'success', message: saleType === 'sale' ? 'Item posted successfully!' : 'Auction scheduled successfully!' });
            setTimeout(() => {
                closeScheduleModal();
                router.push('/seller/auctions');
            }, 1800);
        } catch (err) {
            setScheduleToast({ type: 'error', message: 'An error occurred. Please try again.' });
        } finally {
            setIsScheduling(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <Link href="/seller/auctions" className={styles.backLink}>
                        <span className={styles.backLinkIcon}><ChevronLeft size={18} strokeWidth={2.5} /></span>
                        <span>My Auctions</span>
                    </Link>
                    <button onClick={fetchProducts} className={styles.refreshBtn} title="Refresh Inventory">
                        <Clock size={16} />
                    </button>
                </div>
                <div className={styles.headerTitle}>
                    <div className={styles.titleIcon}>
                        <Tag size={24} />
                    </div>
                    <div>
                        <h1 className={styles.title}>My Products</h1>
                        <p className={styles.subtitle}>Draft products ready to be scheduled</p>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className={styles.loadingState}>
                    <div className={styles.spinner}></div>
                    <p>Loading inventory...</p>
                </div>
            ) : (
                <div className={styles.contentArea}>
                    {products.length === 0 ? (
                        <div className={styles.emptyState}>
                            <div className={styles.emptyIconWrapper}>
                                <Plus size={48} strokeWidth={1} />
                            </div>
                            <h3>No Draft Products</h3>
                            <p>You don't have any products in draft. Start by creating a new listing to get started with your auction.</p>
                            <Link href="/seller/add-product" className={styles.createFirstBtn}>
                                <Plus size={18} /> Create New Product
                            </Link>
                        </div>
                    ) : (
                        <div className={styles.productGrid}>
                            {products.map((product) => {
                                const isDeleting = deletingId === product.products_id;
                                return (
                                    <div key={product.products_id} className={styles.productCard}>
                                        <div className={styles.imageWrapper}>
                                            <img
                                                src={product.images && product.images.length > 0 ? product.images[0].image_url : 'https://placehold.co/200x200?text=No+Image'}
                                                alt={product.name}
                                                className={styles.productImage}
                                            />
                                            <div className={styles.actionWrapper}>
                                                <button
                                                    className={styles.actionBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveDropdownId(activeDropdownId === product.products_id ? null : product.products_id);
                                                    }}
                                                    title="Actions"
                                                >
                                                    <MoreVertical size={18} />
                                                </button>

                                                {activeDropdownId === product.products_id && (
                                                    <div className={styles.dropdown}>
                                                        <button 
                                                            className={styles.dropdownItem}
                                                            onClick={() => handleEditClick(product)}
                                                        >
                                                            <Edit2 size={14} /> Edit
                                                        </button>
                                                        <button 
                                                            className={`${styles.dropdownItem} ${styles.delete}`}
                                                            onClick={() => handleDeleteClick(product)}
                                                        >
                                                            <Trash2 size={14} /> Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className={styles.badge}>Draft</div>
                                        </div>
                                        <div className={styles.productInfo}>
                                            <strong className={styles.productName}>{product.name}</strong>
                                            <div className={styles.productMeta}>
                                                <span className={styles.priceInfo}>
                                                    Start: ₱{Number(product.starting_price || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            className={styles.scheduleBtn}
                                            onClick={() => openScheduleModal(product)}
                                        >
                                            <Calendar size={14} /> Schedule Now
                                        </button>
                                    </div>
                                );
                            })}

                            <Link href="/seller/add-product" className={styles.addCard}>
                                <div className={styles.addCardImage}>
                                    <div className={styles.addCardPlusCircle}>
                                        <Plus size={26} strokeWidth={2.5} />
                                    </div>
                                </div>
                                <div className={styles.addCardInfo}>
                                    <strong>New Product</strong>
                                    <span>Tap to create listing</span>
                                </div>
                                <span className={styles.addCardBtn}>+ Add New</span>
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* Schedule Modal */}
            {scheduleProduct && (
                <div className={styles.modalOverlay} onClick={closeScheduleModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className={styles.modalTitle}>
                                    {saleType === 'sale' ? 'Post Product' : 'Schedule Auction'}
                                </h2>
                                <p className={styles.modalSubtitle}>
                                    {saleType === 'sale' ? 'Set a price and list this item immediately' : 'Set when this item goes live'}
                                </p>
                            </div>
                            <button onClick={closeScheduleModal} className={styles.modalCloseBtn}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className={styles.modalProductBrief}>
                            <img
                                src={scheduleProduct.images?.[0]?.image_url || 'https://placehold.co/56x56?text=No+Image'}
                                alt={scheduleProduct.name}
                                className={styles.modalProductImage}
                            />
                            <div className={styles.modalProductInfo}>
                                <div className={styles.modalProductName}>{scheduleProduct.name}</div>
                                <div className={styles.modalProductPricing}>
                                    {scheduleProduct.reserve_price > 0 && (
                                        <span>
                                            Reserve: <strong>₱{Number(scheduleProduct.reserve_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                    )}
                                    {scheduleProduct.starting_price > 0 && (
                                        <span>
                                            Starting Bid: <strong>₱{Number(scheduleProduct.starting_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleScheduleSubmit}>
                            <div className={styles.formGroup}>
                                <label className={styles.fieldLabel}>Sale Type</label>
                                <div className={styles.saleTypeGrid}>
                                    {[
                                        { id: 'bid', icon: <Gavel size={15} />, label: 'Bid it', sub: 'Live auction' },
                                        { id: 'sale', icon: <Tag size={15} />, label: 'Fixed sale', sub: 'Set price' },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => setSaleType(opt.id)}
                                            className={`${styles.saleTypeBtn} ${saleType === opt.id ? styles.active : ''}`}
                                        >
                                            <span className={styles.saleTypeIcon}>{opt.icon}</span>
                                            <div className={styles.saleTypeText}>
                                                <div className={styles.saleTypeLabel}>{opt.label}</div>
                                                <div className={styles.saleTypeSub}>{opt.sub}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {saleType === 'sale' && (
                                <div className={styles.modalPriceGrid}>
                                    <div className={styles.formGroup}>
                                        <label className={styles.fieldLabel}>Buy Now Price</label>
                                        <div className={styles.inputContainer}>
                                            <span className={styles.inputPrefix}>₱</span>
                                            <input
                                                type="number" step="0.01" min="0" placeholder="0.00" required={saleType === 'sale'}
                                                value={scheduleForm.fixedPrice}
                                                onChange={e => setScheduleForm(p => ({ ...p, fixedPrice: e.target.value }))}
                                                className={styles.modalInput}
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label className={styles.fieldLabel}>Stock</label>
                                        <div className={`${styles.inputContainer} ${styles.disabled}`}>
                                            <input
                                                type="number" value="1" disabled
                                                className={styles.modalInput}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {saleType !== 'sale' && (
                                <div className={styles.formGroup}>
                                    <label className={styles.fieldLabel}>Date & Time</label>
                                    <div className={styles.dateTimeGrid}>
                                        <div className={styles.inputContainer}>
                                            <Calendar size={15} className={styles.inputIcon} />
                                            <input
                                                type="date" required
                                                value={scheduleForm.startDate}
                                                onChange={e => setScheduleForm(p => ({ ...p, startDate: e.target.value }))}
                                                className={styles.modalInput}
                                            />
                                        </div>
                                        <div className={styles.inputContainer}>
                                            <Clock size={15} className={styles.inputIcon} />
                                            <input
                                                type="time" required
                                                value={scheduleForm.startTime}
                                                onChange={e => setScheduleForm(p => ({ ...p, startTime: e.target.value }))}
                                                className={styles.modalInput}
                                            />
                                        </div>
                                    </div>
                                    <p className={styles.inputHint}>Your item will automatically go live at the scheduled time.</p>
                                </div>
                            )}

                            {scheduleToast && (
                                <div className={`${styles.toast} ${styles[scheduleToast.type]}`}>
                                    {scheduleToast.type === 'success' ? '✓ ' : '✕ '}{scheduleToast.message}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isScheduling || isAlreadyScheduled}
                                className={styles.modalSubmitBtn}
                            >
                                {isScheduling
                                    ? (saleType === 'sale' ? 'Posting...' : 'Scheduling...')
                                    : (saleType === 'sale' ? 'Post Item' : 'Confirm Schedule')
                                }
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Product Modal */}
            {productToEdit && (
                <div className={styles.modalOverlay} onClick={() => setProductToEdit(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className={styles.modalTitle}>Edit Product</h2>
                                <p className={styles.modalSubtitle}>Update your listing details</p>
                            </div>
                            <button onClick={() => setProductToEdit(null)} className={styles.modalCloseBtn}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateProduct} className={styles.editForm}>
                            <div className={styles.formGroup}>
                                <label className={styles.fieldLabel}>Product Name</label>
                                <input 
                                    className={styles.formInput}
                                    value={productToEdit.name}
                                    onChange={e => setProductToEdit({...productToEdit, name: e.target.value})}
                                    placeholder="e.g. iPhone 15 Pro Max"
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.fieldLabel}>Description</label>
                                <textarea 
                                    className={styles.formTextarea}
                                    value={productToEdit.description}
                                    onChange={e => setProductToEdit({...productToEdit, description: e.target.value})}
                                    placeholder="Describe your product in detail..."
                                    required
                                />
                            </div>

                            <div className={styles.modalPriceGrid}>
                                <div className={styles.formGroup}>
                                    <label className={styles.fieldLabel}>Starting Price</label>
                                    <div className={styles.inputContainer}>
                                        <span className={styles.inputPrefix}>₱</span>
                                        <input 
                                            type="number"
                                            className={styles.modalInput}
                                            value={productToEdit.starting_price}
                                            onChange={e => setProductToEdit({...productToEdit, starting_price: e.target.value})}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label className={styles.fieldLabel}>Reserve Price</label>
                                    <div className={styles.inputContainer}>
                                        <span className={styles.inputPrefix}>₱</span>
                                        <input 
                                            type="number"
                                            className={styles.modalInput}
                                            value={productToEdit.reserve_price}
                                            onChange={e => setProductToEdit({...productToEdit, reserve_price: e.target.value})}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                className={styles.modalSubmitBtn}
                                disabled={isUpdating}
                            >
                                {isUpdating ? 'Updating...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmationModal 
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title="Delete Product"
                message={`Are you sure you want to delete "${productToDelete?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                type="danger"
            />
        </div>
    );
}
