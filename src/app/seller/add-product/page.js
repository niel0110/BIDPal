'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Info, Grid, Camera, Truck, Plus, X, Trash2, Upload } from 'lucide-react';
import styles from './page.module.css';
import Button from '@/components/ui/Button';

const steps = [
    { id: 'description', name: 'Description', icon: <Info size={18} /> },
    { id: 'categories', name: 'Categories', icon: <Grid size={18} /> },
    { id: 'photos', name: 'Photos', icon: <Camera size={18} /> },
    { id: 'delivery', name: 'Delivery', icon: <Truck size={18} /> },
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
    const [currentStep, setCurrentStep] = useState(0);
    const [activeCategory, setActiveCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: 'Graphic card GIGABYTE GeForce',
        description: 'The NVIDIA RTX 3050 graphics card is a design equipped with 8GB of GDDR6 memory, supports PCI-E 4.0 and offers a number of unique technologies from NVIDIA to enhance the smoothness and high quality of generated graphics. At the same time, it provides support for Ray Tracing, allowing you to enjoy photorealistic graphics.',
        availability: '',
        length: '0',
        width: '0',
        height: '0',
        price: '',
        categories: ['Laptop components', 'Desktop Computers']
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

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Final submit
            console.log('Submitting product:', formData);
            router.push('/seller/inventory');
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        } else {
            router.back();
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button className={styles.backBtn} onClick={handleBack}>
                    <ChevronLeft size={24} />
                    <span>Add Product</span>
                </button>
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
                                <input type="number" value={formData.length} onChange={(e) => setFormData({ ...formData, length: e.target.value })} />
                            </div>
                            <div className={styles.dimField}>
                                <span>Width [mm]</span>
                                <input type="number" value={formData.width} onChange={(e) => setFormData({ ...formData, width: e.target.value })} />
                            </div>
                            <div className={styles.dimField}>
                                <span>Height [mm]</span>
                                <input type="number" value={formData.height} onChange={(e) => setFormData({ ...formData, height: e.target.value })} />
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
                            <div className={styles.uploadCard}>
                                <div className={styles.uploadInner}>
                                    <Upload size={32} color="#00A3FF" strokeWidth={1.5} />
                                    <span>Upload a photo</span>
                                </div>
                                <div className={styles.uploadMeta}>
                                    <span>Max size - 25Mb.</span>
                                    <span>Jpg, Png, Gif</span>
                                </div>
                            </div>

                            <div className={styles.photoCard}>
                                <div className={styles.photoPreview}>
                                    <img src="https://images.unsplash.com/photo-1526170315870-efeca63c5d53?q=80&w=200&auto=format&fit=crop" alt="preview" />
                                </div>
                                <div className={styles.photoInfoDetailed}>
                                    <strong>XYZ name.jpg</strong>
                                    <span>24 Mb</span>
                                </div>
                            </div>

                            <div className={styles.photoCard}>
                                <div className={styles.photoPreview}>
                                    <img src="https://images.unsplash.com/photo-1585314062340-f1a5a7c9328d?q=80&w=200&auto=format&fit=crop" alt="preview" />
                                    <div className={styles.deleteOverlay}>
                                        <div className={styles.trashCircle}>
                                            <Trash2 size={24} color="white" fill="white" />
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.photoInfoDetailed}>
                                    <strong>XYZ name.jpg</strong>
                                    <span>24 Mb</span>
                                </div>
                            </div>

                            <div className={styles.photoCard}>
                                <div className={styles.photoPreview}>
                                    <img src="https://images.unsplash.com/photo-1572635196237-14b3f281503f?q=80&w=200&auto=format&fit=crop" alt="preview" />
                                </div>
                                <div className={styles.photoInfoDetailed}>
                                    <div className={styles.progressRow}>
                                        <strong>87%</strong>
                                        <span>20/24 Mb</span>
                                    </div>
                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill} style={{ width: '87%' }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className={styles.stepContent}>
                        <h2 className={styles.stepTitle}>Select delivery options</h2>

                        <div className={styles.deliveryOptionsList}>
                            <label className={styles.deliveryOptionCard}>
                                <input type="checkbox" className={styles.hiddenCheck} />
                                <div className={styles.customCheck}>
                                    <div className={styles.checkInner} />
                                </div>
                                <span>Self pickup</span>
                            </label>

                            <label className={styles.deliveryOptionCard}>
                                <input type="checkbox" className={styles.hiddenCheck} defaultChecked />
                                <div className={styles.customCheck}>
                                    <div className={styles.checkInner} />
                                </div>
                                <span>Online payment</span>
                            </label>

                            <label className={styles.deliveryOptionCard}>
                                <input type="checkbox" className={styles.hiddenCheck} defaultChecked />
                                <div className={styles.customCheck}>
                                    <div className={styles.checkInner} />
                                </div>
                                <span>Courier cash on delivery</span>
                            </label>
                        </div>

                        <div className={styles.inputGroup} style={{ marginTop: '2.5rem' }}>
                            <label className={styles.shippingTimeLabel}>Shipping time</label>
                            <input
                                type="text"
                                placeholder="Specify a date"
                                value={formData.shippingTime || ''}
                                onChange={(e) => setFormData({ ...formData, shippingTime: e.target.value })}
                                className={styles.dateInput}
                            />
                        </div>
                    </div>
                )}

                <div className={styles.footer}>
                    {currentStep > 0 && (
                        <button className={styles.backLink} onClick={handleBack}>Back</button>
                    )}
                    <button className={styles.nextBtn} onClick={handleNext}>
                        {currentStep === steps.length - 1 ? 'Add' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    );
}
