'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Info, Grid, Camera, X, Trash2, Upload, ChevronLeft, Package, DollarSign, AlertTriangle } from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';
import PriceRecommendation from '@/components/pricing/PriceRecommendation';

const steps = [
    { id: 'description', name: 'Description', icon: <Info size={18} /> },
    { id: 'details', name: 'Details', icon: <Package size={18} /> },
    { id: 'categories', name: 'Categories', icon: <Grid size={18} /> },
    { id: 'pricing', name: 'Pricing', icon: <DollarSign size={18} /> },
    { id: 'photos', name: 'Photos', icon: <Camera size={18} /> },
];

const conditionOptions = ['Brand New', 'Like New', 'Lightly Used', 'Used', 'Heavily Used', 'For Parts'];
const CONDITION_MAP = {
    'Brand New': 'new',
    'Like New': 'like_new',
    'Lightly Used': 'good',
    'Used': 'fair',
    'Heavily Used': 'poor',
    'For Parts': 'poor'
};
const CONDITION_REVERSE_MAP = {
    'new': 'Brand New',
    'like_new': 'Like New',
    'good': 'Lightly Used',
    'fair': 'Used',
    'poor': 'Heavily Used',
};

const categoriesData = [
    {
        id: 'electronics',
        name: 'Electronics',
        groups: [
            { title: 'Phones & Tablets', items: ['Smartphones', 'Tablets', 'Smartwatches', 'Accessories'] },
            { title: 'Computers', items: ['Laptops', 'Desktop Computers', 'Components', 'Printers'] },
            { title: 'Audio & Video', items: ['TVs', 'Headphones', 'Projectors', 'Home Audio'] },
            { title: 'Gaming', items: ['PlayStation', 'Xbox', 'Nintendo Switch', 'PC Gaming'] },
            { title: 'Appliances', items: ['Kitchen', 'Laundry', 'Refrigerators', 'Vacuums'] },
            { title: 'Photography', items: ['Cameras', 'Lenses', 'Accessories', 'Instant Cameras'] },
        ]
    },
    {
        id: 'fashion',
        name: 'Fashion',
        groups: [
            { title: 'Women', items: ['Dresses', 'Tops', 'Pants', 'Shoes', 'Bags'] },
            { title: 'Men', items: ['Shirts', 'Jeans', 'Suits', 'Shoes', 'Watches'] },
            { title: 'Kids', items: ['Baby Clothes', 'Kids Clothes', 'Toys'] },
            { title: 'Luxury & Jewelry', items: ['Necklaces', 'Rings', 'Watches', 'Bags'] },
        ]
    },
    {
        id: 'home',
        name: 'Home & Living',
        groups: [
            { title: 'Furniture', items: ['Sofa', 'Bed', 'Dining Table', 'Storage'] },
            { title: 'Decor & Lighting', items: ['Lamps', 'Wall Art', 'Kitchenware', 'Textiles'] },
            { title: 'Garden & Tools', items: ['Plants', 'Tools', 'Outdoor Furniture'] },
        ]
    },
    {
        id: 'culture',
        name: 'Collectibles',
        groups: [
            { title: 'Books', items: ['Fiction', 'Non-fiction', 'Comics', 'Rare Books'] },
            { title: 'Music & Film', items: ['Vinyl', 'CDs/DVDs', 'Instruments'] },
            { title: 'Collectibles', items: ['Trading Cards', 'Action Figures', 'Antiques'] },
        ]
    },
    {
        id: 'sports',
        name: 'Sports & Outdoors',
        groups: [
            { title: 'Fitness', items: ['Gym Equipment', 'Yoga', 'Bicycles'] },
            { title: 'Outdoors', items: ['Tents', 'Backpacks', 'Camping Gear'] },
            { title: 'Team Sports', items: ['Basketball', 'Football', 'Tennis', 'Golf'] },
        ]
    },
    {
        id: 'automotive',
        name: 'Automotive',
        groups: [
            { title: 'Car Parts', items: ['Wheels & Tires', 'Engines', 'Filters'] },
            { title: 'Interior & Audio', items: ['Seats', 'Head Units', 'Organizers'] },
            { title: 'Accessories', items: ['Cleaning', 'Tools', 'Safety'] },
        ]
    },
];

const defaultFormData = {
    name: '',
    description: '',
    condition: '',
    brand: '',
    size: '',
    specifications: '',
    availability: '1',
    price: '',
    reservePrice: '',
    startingPrice: '',
    bidIncrement: '',
    categories: []
};

const normalizeCategoryValue = (category) => {
    if (typeof category === 'string') return category;
    if (category && typeof category === 'object') {
        return category.category_name || category.name || category.category || '';
    }
    return '';
};

const normalizeCategoryList = (categories) => (
    Array.isArray(categories)
        ? categories.map(normalizeCategoryValue).filter(Boolean)
        : []
);

const normalizeFormData = (raw) => {
    const safe = raw && typeof raw === 'object' ? raw : {};

    return {
        ...defaultFormData,
        ...safe,
        name: typeof safe.name === 'string' ? safe.name : '',
        description: typeof safe.description === 'string' ? safe.description : '',
        condition: typeof safe.condition === 'string' ? safe.condition : '',
        brand: typeof safe.brand === 'string' ? safe.brand : '',
        size: typeof safe.size === 'string' ? safe.size : '',
        specifications: typeof safe.specifications === 'string' ? safe.specifications : '',
        availability: safe.availability != null ? String(safe.availability) : '1',
        price: safe.price != null ? String(safe.price) : '',
        reservePrice: safe.reservePrice != null ? String(safe.reservePrice) : '',
        startingPrice: safe.startingPrice != null ? String(safe.startingPrice) : '',
        bidIncrement: safe.bidIncrement != null ? String(safe.bidIncrement) : '',
        categories: normalizeCategoryList(safe.categories),
    };
};

function AddProductPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('id'); // present when editing a draft
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [activeCategory, setActiveCategory] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({});

    const toggleGroup = (catId, groupIdx) => {
        const key = `${catId}-${groupIdx}`;
        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editLoading, setEditLoading] = useState(!!editId);
    const [existingImageUrls, setExistingImageUrls] = useState([]); // for edit mode
    const [images, setImages] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [imageDataUrls, setImageDataUrls] = useState([]); // base64 copies for sessionStorage persistence
    const [fullPreviewUrl, setFullPreviewUrl] = useState(null);
    const [imageErrors, setImageErrors] = useState([]);
    const [validationModal, setValidationModal] = useState(null); // { title, message }
    const [formData, setFormData] = useState(defaultFormData);

    // ── Helpers for image persistence ──────────────────────────────────────
    const readAsDataUrl = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });

    const dataUrlToFile = (dataUrl, filename, mimeType) => {
        if (typeof dataUrl !== 'string' || !dataUrl.includes(',')) return null;
        const arr = dataUrl.split(',');
        const mimeMatch = arr[0]?.match(/:(.*?);/);
        const mime = mimeType || mimeMatch?.[1];
        if (!mime || !arr[1]) return null;
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new File([u8arr], filename, { type: mime });
    };

    const SS_FORM = 'bidpal_ap_form';
    const SS_STEP = 'bidpal_ap_step';
    const SS_IMGS = 'bidpal_ap_images';

    const clearDraft = () => {
        sessionStorage.removeItem(SS_FORM);
        sessionStorage.removeItem(SS_STEP);
        sessionStorage.removeItem(SS_IMGS);
    };

    // ── Load product for editing ──────────────────────────────────────────
    useEffect(() => {
        if (!editId) return;
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        clearDraft(); // don't restore old draft when editing a specific product
        (async () => {
            try {
                const res = await fetch(`${apiUrl}/api/products/${editId}`);
                if (!res.ok) throw new Error('Product not found');
                const p = await res.json();
                setFormData(normalizeFormData({
                    name: p.name || p.title || '',
                    description: p.description || '',
                    condition: CONDITION_REVERSE_MAP[p.condition] || '',
                    brand: p.brand || '',
                    size: p.size || '',
                    specifications: p.specifications || '',
                    availability: p.availability?.toString() || '1',
                    price: '',
                    reservePrice: p.reserve_price?.toString() || '',
                    startingPrice: p.starting_price?.toString() || '',
                    bidIncrement: (p.bid_increment || p.incremental_bid_step)?.toString() || '',
                    categories: p.categories,
                }));
                // Load existing images as URL previews
                const imgs = Array.isArray(p.images)
                    ? p.images.map(img => (typeof img === 'string' ? img : img.image_url)).filter(Boolean)
                    : [];
                setExistingImageUrls(imgs);
            } catch (err) {
                console.error('Failed to load product for editing:', err);
            } finally {
                setEditLoading(false);
            }
        })();
    }, [editId]);

    // ── Restore draft on mount (new product only) ──────────────────────────
    useEffect(() => {
        if (editId) return; // skip for edit mode
        try {
            const savedForm = sessionStorage.getItem(SS_FORM);
            if (savedForm) setFormData(normalizeFormData(JSON.parse(savedForm)));

            const savedStep = sessionStorage.getItem(SS_STEP);
            if (savedStep) setCurrentStep(parseInt(savedStep, 10) || 0);

            const savedImgs = sessionStorage.getItem(SS_IMGS);
            if (savedImgs) {
                const parsed = JSON.parse(savedImgs);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const normalizedImages = parsed
                        .filter(img => img && typeof img === 'object')
                        .map(img => ({
                            dataUrl: typeof img.dataUrl === 'string' ? img.dataUrl : '',
                            name: typeof img.name === 'string' ? img.name : 'image.jpg',
                            type: typeof img.type === 'string' ? img.type : 'image/jpeg',
                        }))
                        .filter(img => img.dataUrl);
                    const restoredImages = normalizedImages
                        .map(img => {
                            const file = dataUrlToFile(img.dataUrl, img.name, img.type);
                            return file ? { ...img, file } : null;
                        })
                        .filter(Boolean);
                    setImages(restoredImages.map(img => img.file));
                    setPreviewUrls(restoredImages.map(img => img.dataUrl));
                    setImageDataUrls(restoredImages.map(img => img.dataUrl));
                }
            }
        } catch { /* ignore corrupt storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Auto-save draft on every change ───────────────────────────────────
    useEffect(() => {
        try { sessionStorage.setItem(SS_FORM, JSON.stringify(formData)); } catch { }
    }, [formData]);

    useEffect(() => {
        try { sessionStorage.setItem(SS_STEP, currentStep.toString()); } catch { }
    }, [currentStep]);

    useEffect(() => {
        if (imageDataUrls.length === 0) { sessionStorage.removeItem(SS_IMGS); return; }
        try {
            const payload = imageDataUrls.map((dataUrl, i) => ({
                dataUrl,
                name: images[i]?.name || `image_${i}.jpg`,
                type: images[i]?.type || 'image/jpeg',
            }));
            sessionStorage.setItem(SS_IMGS, JSON.stringify(payload));
        } catch { /* quota exceeded — skip image caching */ }
    }, [imageDataUrls, images]);

    const isFormComplete = () =>
        formData.name.trim().length > 0 &&
        formData.condition.trim().length > 0 &&
        formData.brand.trim().length > 0 &&
        formData.categories.length > 0 &&
        formData.reservePrice.toString().trim().length > 0 &&
        formData.startingPrice.toString().trim().length > 0 &&
        formData.bidIncrement.toString().trim().length > 0;

    const toggleCategory = (catName) => {
        const normalizedCategory = normalizeCategoryValue(catName);
        if (!normalizedCategory) return;

        setFormData(prev => {
            const exists = prev.categories.includes(normalizedCategory);
            if (exists) {
                return { ...prev, categories: prev.categories.filter(c => c !== normalizedCategory) };
            }
            if (prev.categories.length >= 3) return prev;
            return { ...prev, categories: [...prev.categories, normalizedCategory] };
        });
    };

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const MAX_SIZE_BYTES = 25 * 1024 * 1024;

    const validateImage = (file) => new Promise((resolve) => {
        if (!ALLOWED_TYPES.includes(file.type)) {
            resolve({ valid: false, error: `"${file.name}" is not a supported type. Use JPG, PNG, GIF, or WEBP.` });
            return;
        }
        if (file.size > MAX_SIZE_BYTES) {
            resolve({ valid: false, error: `"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 25 MB.` });
            return;
        }
        const url = URL.createObjectURL(file);
        const img = new Image();
        // Don't revoke on success — url is reused as the preview src
        img.onload = () => { resolve({ valid: true, url }); };
        img.onerror = () => { URL.revokeObjectURL(url); resolve({ valid: false, error: `"${file.name}" could not be read. The file may be corrupted.` }); };
        img.src = url;
    });

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        e.target.value = null;

        if (files.length + images.length > 10) {
            setImageErrors(['You can upload a maximum of 10 images.']);
            return;
        }

        setImageErrors([]);
        const results = await Promise.all(files.map(f => validateImage(f)));

        const errors = [];
        const validFiles = [];
        const validPreviews = [];

        results.forEach((result, i) => {
            if (!result.valid) { errors.push(result.error); return; }
            validFiles.push(files[i]);
            validPreviews.push(result.url);
        });

        if (errors.length > 0) setImageErrors(errors);
        if (validFiles.length > 0) {
            setImages(prev => [...prev, ...validFiles]);
            setPreviewUrls(prev => [...prev, ...validPreviews]);
            // Also read as base64 for sessionStorage persistence
            const dataUrls = await Promise.all(validFiles.map(f => readAsDataUrl(f)));
            setImageDataUrls(prev => [...prev, ...dataUrls]);
        }
    };

    const removeImage = (e, index) => {
        e.stopPropagation();
        setImages(prev => prev.filter((_, i) => i !== index));
        setImageDataUrls(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => {
            const newPreviews = [...prev];
            if (newPreviews[index]?.startsWith('blob:')) {
                URL.revokeObjectURL(newPreviews[index]); // Free memory (blob URLs only)
            }
            newPreviews.splice(index, 1);
            return newPreviews;
        });
    };

    const handleApplyRecommendation = (prices) => {
        setFormData(prev => ({
            ...prev,
            reservePrice: prices.reservePrice.toString(),
            startingPrice: prices.startingBid.toString(),
            bidIncrement: prices.bidIncrement.toString()
        }));
    };

    const handleNext = async () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Product added — proceed to seller dashboard
            if (!user) {
                setValidationModal({ title: 'Not Logged In', message: 'You must be logged in to add a product.' });
                return;
            }
            if (!formData.name) {
                setCurrentStep(0);
                setValidationModal({ title: 'Missing Field', message: 'Please enter a product name to continue.' });
                return;
            }
            if (Number(formData.startingPrice) > Number(formData.reservePrice)) {
                setCurrentStep(3);
                setValidationModal({ title: 'Invalid Price', message: 'The starting bid cannot exceed the reserve price limit.' });
                return;
            }
            if (!formData.bidIncrement || Number(formData.bidIncrement) <= 0) {
                setCurrentStep(3);
                setValidationModal({ title: 'Missing Field', message: 'Please enter a bid increment greater than ₱0.' });
                return;
            }
            
            setIsSubmitting(true);
            try {
                const submitData = new FormData();
                if (user.user_id) submitData.append('user_id', user.user_id);
                if (user.seller_id) submitData.append('seller_id', user.seller_id);
                submitData.append('name', formData.name);
                submitData.append('description', formData.description);
                submitData.append('condition', CONDITION_MAP[formData.condition] || 'good');
                submitData.append('brand', formData.brand);
                submitData.append('specifications', formData.specifications);
                submitData.append('availability', formData.availability);
                submitData.append('reserve_price', formData.reservePrice);
                submitData.append('starting_price', formData.startingPrice);
                submitData.append('bid_increment', formData.bidIncrement);
                if (formData.size) submitData.append('size', formData.size);
                submitData.append('categories', JSON.stringify(formData.categories));
                images.forEach(img => submitData.append('images', img));

                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');

                const url = editId
                    ? `${apiUrl}/api/products/${editId}`
                    : `${apiUrl}/api/products`;
                const method = editId ? 'PUT' : 'POST';

                const res = await fetch(url, {
                    method,
                    headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                    body: submitData,
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || (editId ? 'Failed to update product' : 'Failed to add product'));

                clearDraft();
                router.push('/seller/auctions');
            } catch (error) {
                setValidationModal({ title: 'Submission Failed', message: error.message || 'Something went wrong. Please try again.' });
                console.error(error);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        } else {
            // First step — go back to dashboard
            router.push('/seller');
        }
    };

    if (editLoading) return (
        <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>Loading product…</p>
        </div>
    );

    return (
        <div className={styles.container}>
            {/* Page Title with Back Button */}
            <div className={styles.pageHeader}>
                <button className={styles.backBtn} onClick={handleBack} aria-label="Go back">
                    <ChevronLeft size={20} />
                    <span>{currentStep > 0 ? 'Previous' : 'Back'}</span>
                </button>
                <h1 className={styles.pageTitle}>{editId ? 'Edit Product' : 'Add New Product'}</h1>
            </div>

            {/* Stepper */}
            <div className={styles.stepper}>
                {steps.map((step, index) => (
                    <div key={step.id} className={styles.stepWrapper}>
                        <div className={styles.stepLineWrapper}>
                            <div
                                className={`${styles.stepCircle} ${index <= currentStep ? styles.activeCircle : ''}`}
                            >
                                {index < currentStep ? (
                                    <div className={styles.check}>✓</div>
                                ) : (
                                    step.icon
                                )}
                            </div>
                            {index < steps.length - 1 && (
                                <div className={`${styles.line} ${index < currentStep ? styles.activeLine : ''}`} />
                            )}
                        </div>
                        <span className={`${styles.stepName} ${index === currentStep ? styles.activeName : ''}`}>{step.name}</span>
                    </div>
                ))}
            </div>

            <div className={styles.formCard}>
                {currentStep === 0 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Fill in the basic information about your item</h2>

                        <div className={styles.inputGroup}>
                            <label>Product name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                maxLength={60}
                            />
                            <div className={styles.charCount}>{formData.name.length}/60</div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Description</label>
                            <textarea
                                rows={6}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                maxLength={2000}
                            />
                            <div className={styles.charCount}>{formData.description.length}/2000</div>
                        </div>

                    </div>
                )}

                {currentStep === 1 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Product Details</h2>

                        <div className={styles.inputGroup}>
                            <label>Condition *</label>
                            <div className={styles.conditionGrid}>
                                {conditionOptions.map(cond => (
                                    <div
                                        key={cond}
                                        className={`${styles.conditionItem} ${formData.condition === cond ? styles.conditionItemActive : ''}`}
                                        onClick={() => setFormData({ ...formData, condition: cond })}
                                    >
                                        {cond}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Brand *</label>
                            <input type="text" placeholder="e.g., Apple, Samsung, Nike" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} required />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Size <span style={{ fontWeight: 400, color: '#999' }}>(optional)</span></label>
                            <input type="text" placeholder="e.g., S, M, L, XL, 42, 28×32, One Size" value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} />
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Specifications</label>
                            <textarea rows={4} placeholder="List key specifications (e.g., RAM, Storage, Size, Material)" value={formData.specifications} onChange={(e) => setFormData({ ...formData, specifications: e.target.value })} />
                            <small>One spec per line for better readability</small>
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Select the category your goods belong to (max. 3)</h2>
                        <div className={styles.categoryLayout}>
                            {/* Left: category list */}
                            <div className={styles.categorySide}>
                                {categoriesData.map(cat => (
                                    <div key={cat.id} className={styles.catAccordion}>
                                        <button
                                            className={`${styles.catItem} ${activeCategory === cat.id ? styles.activeCatItem : ''}`}
                                            onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
                                        >
                                            {cat.name}
                                            <ChevronLeft size={14} style={{ transform: activeCategory === cat.id ? 'rotate(270deg)' : 'rotate(180deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                                        </button>
                                        {/* Mobile-only: inline accordion */}
                                        {activeCategory === cat.id && (
                                            <div className={styles.subcategoryMobilePanel}>
                                                {cat.groups.map((group, idx) => {
                                                    const key = `${cat.id}-${idx}`;
                                                    const isOpen = expandedGroups[key];
                                                    return (
                                                        <div key={idx} className={styles.subGroupAccordion}>
                                                            <button className={styles.subGroupHeader} onClick={() => toggleGroup(cat.id, idx)}>
                                                                <span>{group.title}</span>
                                                                <ChevronLeft size={13} style={{ transform: isOpen ? 'rotate(270deg)' : 'rotate(180deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                                                            </button>
                                                            {isOpen && (
                                                                <div className={styles.subItemsList}>
                                                                    {group.items.map(item => (
                                                                        <label key={item} className={styles.subItem}>
                                                                            <input type="checkbox" checked={formData.categories.includes(`${cat.id}:${group.title}:${item}`)} onChange={() => toggleCategory(`${cat.id}:${group.title}:${item}`)} />
                                                                            <div className={styles.customCheckSmall}>
                                                                                {formData.categories.includes(`${cat.id}:${group.title}:${item}`) && <div className={styles.checkInnerSmall} />}
                                                                            </div>
                                                                            <span>{item}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Desktop-only: side panel */}
                            {activeCategory && (() => {
                                const activeCat = categoriesData.find(c => c.id === activeCategory);
                                if (!activeCat) return null;
                                return (
                                    <div className={styles.subcategoryDesktopPanel}>
                                        <div className={styles.desktopPanelTitle}>{activeCat.name}</div>
                                        {activeCat.groups.map((group, idx) => {
                                            const key = `${activeCategory}-${idx}`;
                                            const isOpen = expandedGroups[key];
                                            return (
                                                <div key={idx} className={styles.subGroupAccordion}>
                                                    <button className={styles.subGroupHeader} onClick={() => toggleGroup(activeCategory, idx)}>
                                                        <span>{group.title}</span>
                                                        <ChevronLeft size={13} style={{ transform: isOpen ? 'rotate(270deg)' : 'rotate(180deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
                                                    </button>
                                                    {isOpen && (
                                                        <div className={styles.subItemsList}>
                                                            {group.items.map(item => (
                                                                <label key={item} className={styles.subItem}>
                                                                    <input type="checkbox" checked={formData.categories.includes(`${activeCategory}:${group.title}:${item}`)} onChange={() => toggleCategory(`${activeCategory}:${group.title}:${item}`)} />
                                                                    <div className={styles.customCheckSmall}>
                                                                        {formData.categories.includes(`${activeCategory}:${group.title}:${item}`) && <div className={styles.checkInnerSmall} />}
                                                                    </div>
                                                                    <span>{item}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className={styles.selectedCats}>
                            <strong>Selected categories:</strong>
                            {formData.categories.map(cat => (
                                <span key={cat} className={styles.catBadge}>
                                    {(typeof cat === 'string' ? cat : normalizeCategoryValue(cat)).split(':').pop()} <X size={12} onClick={() => toggleCategory(cat)} style={{ cursor: 'pointer' }} />
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Pricing Strategy</h2>

                        <PriceRecommendation
                            productData={{
                                name: formData.name,
                                description: formData.description,
                                category: normalizeCategoryValue(formData.categories[0]) || 'General',
                                condition: formData.condition,
                                brand: formData.brand,
                                specifications: formData.specifications
                            }}
                            onApplyRecommendation={handleApplyRecommendation}
                        />

                        <div className={styles.inputGroup}>
                            <label>Reserve Price *</label>
                            <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <span className={styles.pesoSign}>₱</span>
                                <input type="number" step="0.01" min="0" placeholder="0.00" value={formData.reservePrice} onChange={(e) => setFormData({ ...formData, reservePrice: e.target.value })} required style={{flex: 1}} />
                            </div>
                            <small className={styles.fieldHint}>The maximum price limit for this item — bidding cannot exceed this amount</small>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Starting Bid Price *</label>
                            <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <span className={styles.pesoSign}>₱</span>
                                <input type="number" step="0.01" min="0" max={formData.reservePrice || undefined} placeholder="0.00" value={formData.startingPrice} onChange={(e) => setFormData({ ...formData, startingPrice: e.target.value })} required style={{flex: 1}} />
                            </div>
                            <small className={styles.fieldHint}>The initial bid amount to attract buyers. Must not exceed the reserve limit.</small>
                        </div>

                        <div className={styles.inputGroup}>
                            <label>Bid Increment *</label>
                            <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                                <span className={styles.pesoSign}>₱</span>
                                <input type="number" step="1" min="1" placeholder="50" value={formData.bidIncrement} onChange={(e) => setFormData({ ...formData, bidIncrement: e.target.value })} required style={{flex: 1}} />
                            </div>
                            <small className={styles.fieldHint}>Minimum amount each new bid must exceed the current one.</small>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>
                            {editId ? 'Product photos' : 'Add product photos (max 10)'}
                        </h2>

                        {imageErrors.length > 0 && (
                            <div className={styles.imageErrorBox}>
                                {imageErrors.map((err, i) => <p key={i}>⚠ {err}</p>)}
                                <button className={styles.imageErrorDismiss} onClick={() => setImageErrors([])}>Dismiss</button>
                            </div>
                        )}

                        <div className={styles.photoGridDetailed}>
                            <label className={styles.uploadCard} style={{cursor: 'pointer'}}>
                                <input
                                    type="file"
                                    hidden
                                    multiple
                                    accept="image/jpeg, image/png, image/gif, image/webp"
                                    onChange={handleFileSelect}
                                />
                                <div className={styles.uploadInner}>
                                    <Upload size={24} color="#D32F2F" strokeWidth={1.5} />
                                    <span>{editId ? 'Add more photos' : 'Upload a photo'}</span>
                                </div>
                                <div className={styles.uploadMeta}>
                                    <span>Max size - 25Mb.</span>
                                    <span>Jpg, Png, Gif, Webp</span>
                                </div>
                            </label>

                            {/* Existing images (edit mode) */}
                            {existingImageUrls.map((url, idx) => (
                                <div key={`existing-${idx}`} className={styles.photoCard}>
                                    <div className={styles.photoPreview} onClick={() => setFullPreviewUrl(url)} style={{cursor: 'pointer'}}>
                                        <img src={url} alt={`existing ${idx + 1}`} />
                                        <div style={{ position:'absolute', bottom:4, left:4, background:'rgba(0,0,0,0.55)', color:'white', fontSize:'0.6rem', fontWeight:700, padding:'2px 6px', borderRadius:4 }}>
                                            Existing
                                        </div>
                                    </div>
                                    <div className={styles.photoInfoDetailed}>
                                        <strong style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100px',display:'inline-block'}}>Photo {idx + 1}</strong>
                                        <span>Saved</span>
                                    </div>
                                </div>
                            ))}

                            {/* New images being added */}
                            {previewUrls.map((url, idx) => (
                              <div key={`new-${idx}`} className={styles.photoCard}>
                                  <div className={styles.photoPreview} onClick={() => setFullPreviewUrl(url)} style={{cursor: 'pointer'}}>
                                      <img src={url} alt={`preview ${idx}`} />
                                      <div className={styles.deleteCorner} onClick={(e) => removeImage(e, idx)}>
                                          <Trash2 size={16} color="white" />
                                      </div>
                                  </div>
                                  <div className={styles.photoInfoDetailed}>
                                      <strong style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100px',display:'inline-block'}} title={images[idx]?.name}>{images[idx]?.name || `Image ${idx + 1}`}</strong>
                                      <span>{images[idx]?.size ? (images[idx].size / (1024 * 1024)).toFixed(2) : 0} Mb</span>
                                  </div>
                              </div>
                            ))}
                        </div>

                        {editId && existingImageUrls.length === 0 && previewUrls.length === 0 && (
                            <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: '0.75rem' }}>
                                No photos yet. Upload new ones above.
                            </p>
                        )}
                    </div>
                )}

                {/* Full Image Preview Modal */}
                {fullPreviewUrl && (
                    <div className={styles.fullPreviewModal} onClick={() => setFullPreviewUrl(null)}>
                        <div className={styles.fullPreviewContent} onClick={e => e.stopPropagation()}>
                            <button className={styles.closePreviewBtn} onClick={() => setFullPreviewUrl(null)}>
                                <X size={24} />
                            </button>
                            <img src={fullPreviewUrl} alt="Full Preview" />
                        </div>
                    </div>
                )}

                <div className={styles.footer}>
                    {currentStep > 0 && (
                        <button className={styles.backLink} onClick={handleBack}>Back</button>
                    )}
                    <button
                        className={styles.nextBtn}
                        onClick={handleNext}
                        disabled={isSubmitting || (currentStep === steps.length - 1 && !isFormComplete())}
                    >
                        {isSubmitting
                            ? (editId ? 'Saving...' : 'Submitting...')
                            : (currentStep === steps.length - 1
                                ? (editId ? 'Save Changes' : 'Add Product')
                                : 'Next')
                        }
                    </button>
                </div>
            </div>

            {/* Validation Error Modal */}
            {validationModal && (
                <div className={styles.validationOverlay} onClick={() => setValidationModal(null)}>
                    <div className={styles.validationModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.validationIcon}>
                            <AlertTriangle size={26} />
                        </div>
                        <h3 className={styles.validationTitle}>{validationModal.title}</h3>
                        <p className={styles.validationMessage}>{validationModal.message}</p>
                        <button className={styles.validationBtn} onClick={() => setValidationModal(null)}>OK</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AddProductPage() {
    return (
        <Suspense fallback={null}>
            <AddProductPageInner />
        </Suspense>
    );
}
