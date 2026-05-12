'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Info, Grid, Camera, X, Trash2, Upload, ChevronLeft, Package, DollarSign, AlertTriangle } from 'lucide-react';
import styles from '../../../add-product/page.module.css'; // Reuse add-product styles
import { useAuth } from '@/context/AuthContext';
import BIDPalLoader from '@/components/BIDPalLoader';

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

export default function EditProductPage() {
    const router = useRouter();
    const params = useParams();
    const editId = params.id;
    const { user, loading: authLoading } = useAuth();
    
    const [currentStep, setCurrentStep] = useState(0);
    const [activeCategory, setActiveCategory] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [existingImageUrls, setExistingImageUrls] = useState([]);
    const [images, setImages] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [fullPreviewUrl, setFullPreviewUrl] = useState(null);
    const [imageErrors, setImageErrors] = useState([]);
    const [validationModal, setValidationModal] = useState(null);
    const [formData, setFormData] = useState(defaultFormData);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

    useEffect(() => {
        if (!editId || authLoading) return;
        if (!user) {
            router.push('/signin');
            return;
        }

        const fetchProduct = async () => {
            try {
                const token = localStorage.getItem('bidpal_token');
                const res = await fetch(`${apiUrl}/api/products/${editId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Product not found');
                const p = await res.json();
                
                // Verify ownership
                if (p.seller_id !== user.seller_id && user.user_id !== p.user_id) {
                    router.push('/seller/inventory');
                    return;
                }

                setFormData({
                    name: p.name || '',
                    description: p.description || '',
                    condition: CONDITION_REVERSE_MAP[p.condition] || 'Used',
                    brand: p.brand || '',
                    size: p.size || '',
                    specifications: p.specifications || '',
                    availability: p.availability?.toString() || '1',
                    price: p.price?.toString() || '',
                    reservePrice: p.reserve_price?.toString() || '',
                    startingPrice: p.starting_price?.toString() || '',
                    bidIncrement: (p.bid_increment || p.incremental_bid_step)?.toString() || '',
                    categories: normalizeCategoryList(p.categories),
                });
                
                const imgs = Array.isArray(p.images)
                    ? p.images.map(img => (typeof img === 'string' ? img : img.image_url)).filter(Boolean)
                    : [];
                setExistingImageUrls(imgs);
            } catch (err) {
                console.error('Failed to load product:', err);
                router.push('/seller/inventory');
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [editId, user, authLoading]);

    const toggleGroup = (catId, groupIdx) => {
        const key = `${catId}-${groupIdx}`;
        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

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

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length + images.length + existingImageUrls.length > 10) {
            setImageErrors(['Maximum 10 images allowed.']);
            return;
        }

        const newPreviewUrls = files.map(file => URL.createObjectURL(file));
        setImages(prev => [...prev, ...files]);
        setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
        setImageErrors([]);
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => {
            URL.revokeObjectURL(prev[index]);
            return prev.filter((_, i) => i !== index);
        });
    };


    const handleNext = async () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            setIsSubmitting(true);
            try {
                const submitData = new FormData();
                submitData.append('name', formData.name);
                submitData.append('description', formData.description);
                submitData.append('condition', CONDITION_MAP[formData.condition] || 'good');
                submitData.append('brand', formData.brand);
                submitData.append('specifications', formData.specifications);
                submitData.append('availability', formData.availability);
                
                // Auction fields
                submitData.append('reserve_price', formData.reservePrice || '0');
                submitData.append('starting_price', formData.startingPrice || '0');
                submitData.append('bid_increment', formData.bidIncrement || '0');
                
                // Fixed price field
                if (formData.price) submitData.append('price', formData.price);
                
                if (formData.size) submitData.append('size', formData.size);
                submitData.append('categories', JSON.stringify(formData.categories));
                
                // New images
                images.forEach(img => submitData.append('images', img));
                
                // Keep existing images (backend needs to know which ones to keep)
                submitData.append('existing_images', JSON.stringify(existingImageUrls));

                const token = localStorage.getItem('bidpal_token');
                const res = await fetch(`${apiUrl}/api/products/${editId}`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${token}` },
                    body: submitData,
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to update product');
                }

                router.push(`/product/${editId}`);
            } catch (error) {
                setValidationModal({ title: 'Update Failed', message: error.message });
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    if (loading || authLoading) return <BIDPalLoader />;

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <button className={styles.backBtn} onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : router.back()}>
                    <ChevronLeft size={20} />
                    <span>{currentStep > 0 ? 'Previous' : 'Back'}</span>
                </button>
                <h1 className={styles.pageTitle}>Edit Product</h1>
            </div>

            <div className={styles.stepper}>
                {steps.map((step, index) => (
                    <div key={step.id} className={styles.stepWrapper}>
                        <div className={styles.stepLineWrapper}>
                            <div className={`${styles.stepCircle} ${index <= currentStep ? styles.activeCircle : ''}`}>
                                {index < currentStep ? '✓' : step.icon}
                            </div>
                            {index < steps.length - 1 && (
                                <div className={`${styles.line} ${index < currentStep ? styles.activeLine : ''}`} />
                            )}
                        </div>
                        <span className={`${styles.stepName} ${index === currentStep ? styles.activeName : ''}`}>
                            {step.name}
                        </span>
                    </div>
                ))}
            </div>

            <div className={styles.formCard}>
                {currentStep === 0 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Basic Information</h2>
                        <div className={styles.inputGroup}>
                            <label>Product name</label>
                            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} maxLength={60} />
                            <div className={styles.charCount}>{formData.name.length}/60</div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Description</label>
                            <textarea rows={6} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} maxLength={2000} />
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
                                    <div key={cond} className={`${styles.conditionItem} ${formData.condition === cond ? styles.conditionItemActive : ''}`} onClick={() => setFormData({...formData, condition: cond})}>
                                        {cond}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Brand *</label>
                            <input type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
                        </div>
                        <div className={styles.inputGroup}>
                            <label>Specifications</label>
                            <textarea rows={4} value={formData.specifications} onChange={e => setFormData({...formData, specifications: e.target.value})} />
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Categories (max 3)</h2>
                        <div className={styles.categoryLayout}>
                            <div className={styles.categorySide}>
                                {categoriesData.map(cat => (
                                    <button key={cat.id} className={`${styles.catItem} ${activeCategory === cat.id ? styles.activeCatItem : ''}`} onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}>
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                            {activeCategory && (
                                <div className={styles.subcategoryDesktopPanel}>
                                    {categoriesData.find(c => c.id === activeCategory).groups.map((group, idx) => (
                                        <div key={idx} className={styles.subGroupAccordion}>
                                            <div className={styles.subGroupHeader}>{group.title}</div>
                                            <div className={styles.subItemsList}>
                                                {group.items.map(item => {
                                                    const val = `${activeCategory}:${group.title}:${item}`;
                                                    return (
                                                        <label key={item} className={styles.subItem}>
                                                            <input type="checkbox" checked={formData.categories.includes(val)} onChange={() => toggleCategory(val)} />
                                                            <span>{item}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Set Your Price</h2>
                        <div className={styles.inputGroup}>
                            <label>Product Price *</label>
                            <div className={styles.priceInputWrapper}>
                                <span className={styles.pesoSign}>₱</span>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    placeholder="0.00" 
                                    value={formData.price} 
                                    onChange={e => setFormData({...formData, price: e.target.value})} 
                                    required
                                />
                            </div>
                            <small className={styles.fieldHint}>This is the final selling price for your item.</small>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Photos</h2>
                        <div className={styles.photoGridDetailed}>
                            <label className={styles.uploadCard}>
                                <input type="file" hidden multiple onChange={handleFileSelect} />
                                <Upload size={24} color="#D32F2F" />
                                <span>Add Photos</span>
                            </label>
                            {existingImageUrls.map((url, idx) => (
                                <div key={`ex-${idx}`} className={styles.photoCard}>
                                    <div className={styles.photoPreview}>
                                        <img src={url} alt="" />
                                        <div className={styles.deleteCorner} onClick={() => setExistingImageUrls(prev => prev.filter((_, i) => i !== idx))}>
                                            <Trash2 size={16} color="white" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {previewUrls.map((url, idx) => (
                                <div key={`new-${idx}`} className={styles.photoCard}>
                                    <div className={styles.photoPreview}>
                                        <img src={url} alt="" />
                                        <div className={styles.deleteCorner} onClick={() => removeImage(idx)}>
                                            <Trash2 size={16} color="white" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.footer}>
                    {currentStep > 0 && (
                        <button className={styles.backLink} onClick={() => setCurrentStep(currentStep - 1)}>Back</button>
                    )}
                    <button className={styles.nextBtn} onClick={handleNext} disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : currentStep === steps.length - 1 ? 'Save Changes' : 'Next Step'}
                    </button>
                </div>
            </div>

            {validationModal && (
                <div className={styles.modalOverlay} onClick={() => setValidationModal(null)}>
                    <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
                        <h3>{validationModal.title}</h3>
                        <p>{validationModal.message}</p>
                        <button onClick={() => setValidationModal(null)}>OK</button>
                    </div>
                </div>
            )}
        </div>
    );
}
