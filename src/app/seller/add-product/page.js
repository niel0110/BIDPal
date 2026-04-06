'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Grid, Camera, X, Trash2, Upload, ChevronLeft, Package, DollarSign } from 'lucide-react';
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

const categoriesData = [
    {
        id: 'electronics',
        name: 'Electronics',
        groups: [
            {
                title: 'Phones and Accessories',
                items: ['Smartphones', 'Smartwatches', 'Tablets', 'Accessories GSM', 'Cases and covers']
            },
            {
                title: 'Computers',
                items: ['Laptops', 'Laptop components', 'Desktop Computers', 'Computer components', 'Printers and scanners']
            },
            {
                title: 'Audio & Video',
                items: ['TVs', 'Projectors', 'Headphones', 'Audio for home', 'Home cinema']
            },
            {
                title: 'Gaming & Consoles',
                items: ['Consoles PlayStation 5', 'Consoles Xbox Series X/S', 'Consoles PlayStation 4', 'Consoles Xbox One', 'Consoles Nintendo Switch']
            },
            {
                title: 'Minor appliances',
                items: ['Kitchen, cooking', 'Hygiene and care', 'For home', 'Vacuum cleaners']
            },
            {
                title: 'Large Appliances',
                items: ['Fridges', 'Washing machines', 'Clothes dryers', 'Free-standing kitchens']
            },
            {
                title: 'Photography',
                items: ['Digital cameras', 'Lenses', 'Photo accessories', 'Instant cameras (Instax, Polaroid)']
            }
        ]
    },
    {
        id: 'fashion',
        name: 'Fashion',
        groups: [
            { title: 'Women', items: ['Dresses', 'Tops', 'Pants', 'Shoes', 'Bags', 'Accessories'] },
            { title: 'Men', items: ['Shirts', 'Jeans', 'Suits', 'Shoes', 'Watches', 'Accessories'] },
            { title: 'Kids', items: ['Baby clothes', 'Kid clothes', 'Toys', 'Gear'] },
            { title: 'Luxury & Jewelry', items: ['Necklaces', 'Rings', 'Luxury Watches', 'Vintage Bags'] }
        ]
    },
    {
        id: 'home',
        name: 'Home & Living',
        groups: [
            { title: 'Furniture', items: ['Sofa', 'Bed', 'Dining Table', 'Chairs', 'Storage'] },
            { title: 'Decor & Lighting', items: ['Lamps', 'Wall Art', 'Textiles', 'Kitchenware'] },
            { title: 'Garden & Tools', items: ['Plants', 'Tools', 'Outdoor Furniture', 'Lighting'] }
        ]
    },
    {
        id: 'culture',
        name: 'Collectibles & Culture',
        groups: [
            { title: 'Books', items: ['Fiction', 'Non-fiction', 'Comics', 'Antiquarian'] },
            { title: 'Music & Film', items: ['Vinyl', 'CDs/DVDs', 'Instruments', 'Audio Equipment'] },
            { title: 'Collectibles', items: ['Trading Cards', 'Action Figures', 'Antiques', 'Numismatics'] }
        ]
    },
    {
        id: 'sports',
        name: 'Sports & Outdoors',
        groups: [
            { title: 'Exercise', items: ['Gym', 'Yoga', 'Bicycles', 'Weights'] },
            { title: 'Outdoors', items: ['Tents', 'Backpacks', 'Sleeping Bags', 'Camping Gear'] },
            { title: 'Team Sports', items: ['Basketball', 'Football', 'Tennis', 'Golf'] }
        ]
    },
    {
        id: 'automotive',
        name: 'Automotive & Parts',
        groups: [
            { title: 'Car Parts', items: ['Wheels & Tires', 'Engines', 'Lighting', 'Filters'] },
            { title: 'Interior & Audio', items: ['Seats', 'Head Units', 'Mats', 'Organizers'] },
            { title: 'Accessories', items: ['Cleaning', 'Tools', 'Safety'] }
        ]
    },
];

export default function AddProductPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [activeCategory, setActiveCategory] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [images, setImages] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [imageErrors, setImageErrors] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanSlots, setScanSlots] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        condition: '',
        brand: '',
        specifications: '',
        availability: '1',
        length: '',
        width: '',
        height: '',
        price: '',
        reservePrice: '',
        startingPrice: '',
        categories: []
    });

    const toggleCategory = (catName) => {
        setFormData(prev => {
            const exists = prev.categories.includes(catName);
            if (exists) {
                return { ...prev, categories: prev.categories.filter(c => c !== catName) };
            }
            if (prev.categories.length >= 3) return prev;
            return { ...prev, categories: [...prev.categories, catName] };
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
        img.onload = () => { URL.revokeObjectURL(url); resolve({ valid: true, url }); };
        img.onerror = () => { URL.revokeObjectURL(url); resolve({ valid: false, error: `"${file.name}" could not be read. The file may be corrupted.` }); };
        img.src = url;
    });

    const checkImageContent = async (file) => {
        try {
            const base64 = await new Promise((resolve, reject) => {
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                    const MAX = 800;
                    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(url);
                    resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
                };
                img.onerror = reject;
                img.src = url;
            });

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const res = await fetch(`${apiUrl}/api/image-moderation/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' })
            });

            if (!res.ok) return { allowed: true };

            const data = await res.json();
            if (data.safe === false) {
                return { allowed: false, error: `"${file.name}" was rejected: ${data.reason}` };
            }
            return { allowed: true };
        } catch {
            return { allowed: true };
        }
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        e.target.value = null;

        if (files.length + images.length > 10) {
            setImageErrors(['You can upload a maximum of 10 images.']);
            return;
        }

        setImageErrors([]);
        setIsScanning(true);

        const slots = files.map(file => ({
            file,
            url: URL.createObjectURL(file),
            status: 'scanning',
            error: null
        }));
        setScanSlots(slots);

        const errors = [];
        const validFiles = [];
        const validPreviews = [];

        for (let i = 0; i < slots.length; i++) {
            const { file, url } = slots[i];

            const result = await validateImage(file);
            if (!result.valid) {
                setScanSlots(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'rejected' } : s));
                errors.push(result.error);
                continue;
            }

            const contentCheck = await checkImageContent(file);
            if (!contentCheck.allowed) {
                setScanSlots(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'rejected' } : s));
                errors.push(contentCheck.error);
                continue;
            }

            setScanSlots(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'ok' } : s));
            validFiles.push(file);
            validPreviews.push(url);
        }

        setIsScanning(false);
        setTimeout(() => setScanSlots([]), 2500);

        if (errors.length > 0) setImageErrors(errors);
        if (validFiles.length > 0) {
            setImages(prev => [...prev, ...validFiles]);
            setPreviewUrls(prev => [...prev, ...validPreviews]);
        }
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => {
            const newPreviews = [...prev];
            URL.revokeObjectURL(newPreviews[index]); // Free memory
            newPreviews.splice(index, 1);
            return newPreviews;
        });
    };

    const handleApplyRecommendation = (prices) => {
        setFormData(prev => ({
            ...prev,
            reservePrice: prices.reservePrice.toString(),
            startingPrice: prices.startingBid.toString()
        }));
    };

    const handleNext = async () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Product added — proceed to seller dashboard
            if (!user) {
                alert("You must be logged in to add a product.");
                return;
            }
            if (!formData.name) {
                alert("Please enter a product name.");
                setCurrentStep(0);
                return;
            }
            
            setIsSubmitting(true);
            try {
                const submitData = new FormData();
                if (user.user_id) submitData.append('user_id', user.user_id);
                if (user.seller_id) submitData.append('seller_id', user.seller_id);
                submitData.append('name', formData.name);
                submitData.append('description', formData.description);
                // Convert condition to lowercase with underscores for database
                const dbCondition = formData.condition.toLowerCase().replace(/\s+/g, '_');
                submitData.append('condition', dbCondition);
                submitData.append('brand', formData.brand);
                submitData.append('specifications', formData.specifications);
                submitData.append('availability', formData.availability);
                submitData.append('reserve_price', formData.reservePrice);
                submitData.append('starting_price', formData.startingPrice);
                if (formData.length) submitData.append('length_mm', formData.length);
                if (formData.width) submitData.append('width_mm', formData.width);
                if (formData.height) submitData.append('height_mm', formData.height);
                submitData.append('categories', JSON.stringify(formData.categories));
                
                images.forEach(img => {
                    submitData.append('images', img);
                });
                
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');
                
                const res = await fetch(`${apiUrl}/api/products`, {
                    method: 'POST',
                    headers: {
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: submitData
                });
                
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to add product');
                
                console.log('Product added!', data);
                router.push('/seller/inventory');
            } catch (error) {
                alert(error.message);
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

    return (
        <div className={styles.container}>
            {/* Page Title with Back Button */}
            <div className={styles.pageHeader}>
                <button className={styles.backBtn} onClick={handleBack} aria-label="Go back">
                    <ChevronLeft size={20} />
                </button>
                <h1 className={styles.pageTitle}>Add New Product</h1>
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

                        <div className={styles.inputGroup}>
                            <label>Number of units available</label>
                            <input
                                type="text"
                                placeholder="Availability"
                                value={formData.availability}
                                onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                            />
                        </div>

                        <div className={styles.dimensionsRow}>
                            <label className={styles.fullWidth}>Dimensions (optional)</label>
                            <div className={styles.dimField}>
                                <span>Length [mm]</span>
                                <input type="number" min="0" value={formData.length} onChange={(e) => setFormData({ ...formData, length: e.target.value })} />
                            </div>
                            <div className={styles.dimField}>
                                <span>Width [mm]</span>
                                <input type="number" min="0" value={formData.width} onChange={(e) => setFormData({ ...formData, width: e.target.value })} />
                            </div>
                            <div className={styles.dimField}>
                                <span>Height [mm]</span>
                                <input type="number" min="0" value={formData.height} onChange={(e) => setFormData({ ...formData, height: e.target.value })} />
                            </div>
                        </div>

                    </div>
                )}

                {currentStep === 1 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Product Details</h2>

                        <div className={styles.inputGroup}>
                            <label>Condition *</label>
                            <div className={styles.conditionGrid} style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', marginBottom: '20px'}}>
                                {conditionOptions.map(cond => (
                                    <div key={cond} style={{padding: '12px', border: `2px solid ${formData.condition === cond ? '#00A3FF' : '#ddd'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', backgroundColor: formData.condition === cond ? '#E3F2FD' : 'white'}} onClick={() => setFormData({ ...formData, condition: cond })}>
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
                            <div className={styles.categorySide}>
                                {categoriesData.map(cat => (
                                    <button
                                        key={cat.id}
                                        className={`${styles.catItem} ${activeCategory === cat.id ? styles.activeCatItem : ''}`}
                                        onClick={() => setActiveCategory(cat.id === activeCategory ? null : cat.id)}
                                    >
                                        {cat.name}
                                        <ChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} />
                                    </button>
                                ))}
                            </div>

                            {activeCategory && (
                                <div className={styles.subcategoryGrid}>
                                    {categoriesData.find(c => c.id === activeCategory)?.groups.map((group, idx) => (
                                        <div key={idx} className={styles.subGroup}>
                                            <h3>{group.title}</h3>
                                            {group.items.map(item => (
                                                <label key={item} className={styles.subItem}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.categories.includes(item)}
                                                        onChange={() => toggleCategory(item)}
                                                    />
                                                    <div className={styles.customCheckSmall}>
                                                        {formData.categories.includes(item) && <div className={styles.checkInnerSmall} />}
                                                    </div>
                                                    <span>{item}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className={styles.selectedCats}>
                            <strong>Selected categories:</strong>
                            {formData.categories.map(cat => (
                                <span key={cat} className={styles.catBadge}>
                                    {cat} <X size={12} onClick={() => toggleCategory(cat)} style={{ cursor: 'pointer' }} />
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
                                category: formData.categories[0] || 'General',
                                condition: formData.condition,
                                brand: formData.brand,
                                specifications: formData.specifications
                            }}
                            onApplyRecommendation={handleApplyRecommendation}
                        />

                        <div style={{marginTop: '20px'}}>
                            <div className={styles.inputGroup}>
                                <label>Reserve Price (Minimum Selling Price) *</label>
                                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                    <span style={{fontSize: '1.2rem', fontWeight: 'bold'}}>₱</span>
                                    <input type="number" step="0.01" min="0" placeholder="0.00" value={formData.reservePrice} onChange={(e) => setFormData({ ...formData, reservePrice: e.target.value })} required style={{flex: 1}} />
                                </div>
                                <small>The minimum price you'll accept for this item</small>
                            </div>

                            <div className={styles.inputGroup}>
                                <label>Starting Bid Price *</label>
                                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                    <span style={{fontSize: '1.2rem', fontWeight: 'bold'}}>₱</span>
                                    <input type="number" step="0.01" min="0" placeholder="0.00" value={formData.startingPrice} onChange={(e) => setFormData({ ...formData, startingPrice: e.target.value })} required style={{flex: 1}} />
                                </div>
                                <small>The initial bid amount to attract buyers</small>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Add product photos (max 10)</h2>

                        {imageErrors.length > 0 && (
                            <div className={styles.imageErrorBox}>
                                {imageErrors.map((err, i) => <p key={i}>⚠ {err}</p>)}
                                <button className={styles.imageErrorDismiss} onClick={() => setImageErrors([])}>Dismiss</button>
                            </div>
                        )}

                        <div className={styles.photoGridDetailed}>
                            <label className={styles.uploadCard} style={{cursor: isScanning ? 'not-allowed' : 'pointer', opacity: isScanning ? 0.5 : 1}}>
                                <input
                                    type="file"
                                    hidden
                                    multiple
                                    accept="image/jpeg, image/png, image/gif, image/webp"
                                    onChange={handleFileSelect}
                                    disabled={isScanning}
                                />
                                <div className={styles.uploadInner}>
                                    <Upload size={32} color="#00A3FF" strokeWidth={1.5} />
                                    <span>Upload a photo</span>
                                </div>
                                <div className={styles.uploadMeta}>
                                    <span>Max size - 25Mb.</span>
                                    <span>Jpg, Png, Gif, Webp</span>
                                    <span>Content is scanned automatically</span>
                                </div>
                            </label>

                            {scanSlots.map((slot, idx) => (
                                <div key={`scan-${idx}`} className={styles.photoCard}>
                                    <div className={styles.photoPreview} style={{position:'relative'}}>
                                        <img src={slot.url} alt={slot.file.name} style={{filter: slot.status === 'rejected' ? 'brightness(0.4)' : 'none'}} />
                                        {slot.status === 'scanning' && (
                                            <div className={styles.scanOverlay}>
                                                <div className={styles.scanningSpinner} />
                                                <span>Scanning...</span>
                                            </div>
                                        )}
                                        {slot.status === 'ok' && (
                                            <div className={styles.scanOverlayOk}>✓</div>
                                        )}
                                        {slot.status === 'rejected' && (
                                            <div className={styles.scanOverlayRejected}>
                                                <span style={{fontSize:'1.8rem'}}>✕</span>
                                                <span style={{fontSize:'0.7rem',textAlign:'center',padding:'0 8px'}}>Rejected</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.photoInfoDetailed}>
                                        <strong style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100px',display:'inline-block'}}>{slot.file.name}</strong>
                                        <span>{(slot.file.size / (1024 * 1024)).toFixed(2)} Mb</span>
                                    </div>
                                </div>
                            ))}

                            {scanSlots.length === 0 && previewUrls.map((url, idx) => (
                              <div key={idx} className={styles.photoCard}>
                                  <div className={styles.photoPreview}>
                                      <img src={url} alt={`preview ${idx}`} />
                                      <div className={styles.deleteOverlay} onClick={() => removeImage(idx)}>
                                          <div className={styles.trashCircle}>
                                              <Trash2 size={24} color="white" fill="white" />
                                          </div>
                                      </div>
                                  </div>
                                  <div className={styles.photoInfoDetailed}>
                                      <strong style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100px',display:'inline-block'}} title={images[idx]?.name}>{images[idx]?.name || `Image ${idx + 1}`}</strong>
                                      <span>{images[idx]?.size ? (images[idx].size / (1024 * 1024)).toFixed(2) : 0} Mb</span>
                                  </div>
                              </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className={styles.footer}>
                    {currentStep > 0 && (
                        <button className={styles.backLink} onClick={handleBack}>Back</button>
                    )}
                    <button className={styles.nextBtn} onClick={handleNext} disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : (currentStep === steps.length - 1 ? 'Add' : 'Next')}
                    </button>
                </div>
            </div>
        </div>
    );
}
