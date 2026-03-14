'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Grid, Camera, X, Trash2, Upload, ChevronLeft } from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '@/context/AuthContext';

const steps = [
    { id: 'description', name: 'Description', icon: <Info size={18} /> },
    { id: 'categories', name: 'Categories', icon: <Grid size={18} /> },
    { id: 'photos', name: 'Photos', icon: <Camera size={18} /> },
];

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
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        availability: '',
        length: '',
        width: '',
        height: '',
        price: '',
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

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length + images.length > 10) {
            alert('Max 10 images allowed');
            return;
        }
        
        setImages(prev => [...prev, ...files]);
        
        const newPreviews = files.map(file => URL.createObjectURL(file));
        setPreviewUrls(prev => [...prev, ...newPreviews]);
        e.target.value = null;
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
                if (formData.availability) submitData.append('availability', formData.availability);
                if (formData.length) submitData.append('length_mm', formData.length);
                if (formData.width) submitData.append('width_mm', formData.width);
                if (formData.height) submitData.append('height_mm', formData.height);
                if (formData.price) submitData.append('price', formData.price);
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
                                maxLength={60}
                            />
                            <div className={styles.charCount}>{formData.description.length}/60</div>
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

                        <div className={styles.inputGroup}>
                            <label>Initial price</label>
                            <input
                                type="text"
                                placeholder="Product price"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            />
                        </div>
                    </div>
                )}

                {currentStep === 1 && (
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

                {currentStep === 2 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Add product photos (max 10)</h2>
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
                                    <Upload size={32} color="#00A3FF" strokeWidth={1.5} />
                                    <span>Upload a photo</span>
                                </div>
                                <div className={styles.uploadMeta}>
                                    <span>Max size - 25Mb.</span>
                                    <span>Jpg, Png, Gif</span>
                                </div>
                            </label>

                            {previewUrls.map((url, idx) => (
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
                                      <strong style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px', display: 'inline-block'}} title={images[idx]?.name}>{images[idx]?.name || `Image ${idx + 1}`}</strong>
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
