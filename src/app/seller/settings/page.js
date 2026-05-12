'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Camera, Save, X, CheckCircle, ChevronLeft } from 'lucide-react';
import styles from './page.module.css';
import ImageAdjuster from '@/components/ui/ImageAdjuster';

export default function SellerSettings() {
    const { user } = useAuth();
    const router = useRouter();
    const logoInputRef = useRef(null);
    const bannerInputRef = useRef(null);

    const [profile, setProfile] = useState({
        seller_id: '',
        store_name: '',
        store_description: '',
        business_category: '',
        store_handle: '',
        logo_url: '',
        banner_url: ''
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [adjustingFile, setAdjustingFile] = useState(null);
    const [adjustType, setAdjustType] = useState('logo'); // 'logo' or 'banner'
    const [pendingLogo, setPendingLogo] = useState(null); // { blob, previewUrl }
    const [pendingBanner, setPendingBanner] = useState(null); // { blob, previewUrl }

    useEffect(() => {
        if (!user?.user_id) return;

        const fetchData = async () => {
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                const token = localStorage.getItem('bidpal_token');
                const res = await fetch(`${apiUrl}/api/sellers/user/${user.user_id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setProfile({
                        seller_id: data.seller_id,
                        store_name: data.store_name || '',
                        store_description: data.store_description || '',
                        business_category: data.business_category || '',
                        store_handle: data.store_handle || '',
                        logo_url: data.logo_url || '',
                        banner_url: data.banner_url || ''
                    });
                }
            } catch (err) {
                console.error('Settings fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const handleSaveProfile = async () => {
        if (!profile.seller_id || saving) return;
        setSaving(true);
        setErrorMsg('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            const token = localStorage.getItem('bidpal_token');

            // 1. Upload pending images first if any
            let finalLogoUrl = profile.logo_url;
            let finalBannerUrl = profile.banner_url;

            if (pendingLogo) {
                const formData = new FormData();
                formData.append('logo', pendingLogo.blob, 'logo.jpg');
                const logoRes = await fetch(`${apiUrl}/api/sellers/${profile.seller_id}/logo`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                if (logoRes.ok) {
                    const data = await logoRes.json();
                    finalLogoUrl = data.logoUrl;
                }
            }

            if (pendingBanner) {
                const formData = new FormData();
                formData.append('banner', pendingBanner.blob, 'banner.jpg');
                const bannerRes = await fetch(`${apiUrl}/api/sellers/${profile.seller_id}/banner`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                if (bannerRes.ok) {
                    const data = await bannerRes.json();
                    finalBannerUrl = data.bannerUrl;
                }
            }

            // 2. Save the rest of the profile data
            const res = await fetch(`${apiUrl}/api/sellers/${profile.seller_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    store_name: profile.store_name,
                    store_description: profile.store_description,
                    business_category: profile.business_category,
                    store_handle: profile.store_handle,
                    logo_url: finalLogoUrl || null,
                    banner_url: finalBannerUrl || null,
                })
            });
            
            if (res.ok) {
                setPendingLogo(null);
                setPendingBanner(null);
                setProfile(prev => ({ ...prev, logo_url: finalLogoUrl, banner_url: finalBannerUrl }));
                setShowSuccessModal(true);
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (err) {
            setErrorMsg(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleFileSelect = (event, type) => {
        const file = event.target.files[0];
        if (!file) return;
        setAdjustType(type);
        setAdjustingFile(file);
    };

    const handleImageAdjusted = (blob) => {
        const type = adjustType;
        const previewUrl = URL.createObjectURL(blob);
        
        if (type === 'logo') {
            setPendingLogo({ blob, previewUrl });
        } else {
            setPendingBanner({ blob, previewUrl });
        }
        
        setAdjustingFile(null);
        if (logoInputRef.current) logoInputRef.current.value = '';
        if (bannerInputRef.current) bannerInputRef.current.value = '';
    };

    const handleRemoveImage = (type) => {
        if (type === 'logo') {
            setProfile(prev => ({ ...prev, logo_url: '' }));
            setPendingLogo(null);
        } else {
            setProfile(prev => ({ ...prev, banner_url: '' }));
            setPendingBanner(null);
        }
    };

    if (loading) return <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>Loading…</div>;

    return (
        <div className={styles.container}>
            {/* Back button */}
            <button className={styles.backBtn} onClick={() => router.back()}>
                <ChevronLeft size={18} />
                Back
            </button>

            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <h1>Settings</h1>
                    <p>Manage your store preferences and business account.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {errorMsg && <p className={styles.errorMsg}>{errorMsg}</p>}
                    <button
                        className={styles.saveBtn}
                        onClick={handleSaveProfile}
                        disabled={!profile.seller_id || saving}
                    >
                        {saving ? 'Saving...' : (
                            <>
                                <Save size={18} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </header>

            <div className={styles.content}>
                <div className={styles.sectionHeader}>
                    <h2>Store Profile</h2>
                    <p>How customers see your shop on the marketplace.</p>
                </div>

                {/* Banner */}
                <div className={styles.mediaUploads}>
                    <div className={styles.bannerUpload}>
                        {(pendingBanner?.previewUrl || profile.banner_url) && (
                            <img
                                src={pendingBanner?.previewUrl || profile.banner_url}
                                alt="Store banner"
                                className={styles.bannerImg}
                            />
                        )}
                        {!(pendingBanner?.previewUrl || profile.banner_url) && (
                            <div
                                className={styles.bannerPlaceholder}
                                onClick={() => bannerInputRef.current?.click()}
                            >
                                <Camera size={32} color="#ccc" />
                                <span>Click to upload banner</span>
                            </div>
                        )}
                        {(pendingBanner?.previewUrl || profile.banner_url) && (
                            <div className={styles.bannerOverlay}>
                                <button
                                    type="button"
                                    className={styles.overlayEditBtn}
                                    onClick={() => bannerInputRef.current?.click()}
                                >
                                    <Camera size={16} /> Change
                                </button>
                                <button
                                    type="button"
                                    className={styles.overlayRemoveBtn}
                                    onClick={() => handleRemoveImage('banner')}
                                >
                                    <X size={16} /> Remove
                                </button>
                            </div>
                        )}
                        <input
                            type="file"
                            ref={bannerInputRef}
                            hidden
                            accept="image/*"
                            onChange={(e) => handleFileSelect(e, 'banner')}
                        />
                    </div>

                    {/* Logo */}
                    <div className={styles.logoWrapper}>
                        <div className={styles.logoPlaceholder}>
                            {(pendingLogo?.previewUrl || profile.logo_url)
                                ? <img src={pendingLogo?.previewUrl || profile.logo_url} alt="Store logo" className={styles.logoImg} />
                                : <Camera size={24} color="#ccc" />
                            }
                        </div>
                        <input
                            type="file"
                            ref={logoInputRef}
                            hidden
                            accept="image/*"
                            onChange={(e) => handleFileSelect(e, 'logo')}
                        />
                        <div className={styles.logoBtns}>
                            <span className={styles.logoBtnLabel}>Store Logo</span>
                            <button className={styles.changeBtn} onClick={() => logoInputRef.current?.click()}>
                                Change Logo
                            </button>
                            {(pendingLogo?.previewUrl || profile.logo_url) && (
                                <button
                                    className={styles.removeBtn}
                                    onClick={() => handleRemoveImage('logo')}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Form fields */}
                <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                        <label>Store Name</label>
                        <input
                            type="text"
                            placeholder="Enter store name"
                            value={profile.store_name}
                            onChange={e => setProfile({ ...profile, store_name: e.target.value })}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Bio / Description</label>
                        <textarea
                            rows="4"
                            placeholder="Tell buyers about your shop..."
                            value={profile.store_description}
                            onChange={e => setProfile({ ...profile, store_description: e.target.value })}
                        />
                        <span className={styles.charCount}>{profile.store_description.length} / 500</span>
                    </div>
                    <div className={styles.formGroup}>
                        <label>Store Category</label>
                        <select
                            value={profile.business_category}
                            onChange={e => setProfile({ ...profile, business_category: e.target.value })}
                        >
                            <option value="">Select a category</option>
                            <option>Fashion &amp; Accessories</option>
                            <option>Gadgets &amp; Electronics</option>
                            <option>Collectibles &amp; Antiques</option>
                            <option>Home &amp; Living</option>
                            <option>Books &amp; Hobbies</option>
                            <option>Sports &amp; Outdoors</option>
                            <option>Art &amp; Crafts</option>
                            <option>Food &amp; Beverages</option>
                            <option>Others</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccessModal && (
                <div className={styles.modalBackdrop} onClick={() => setShowSuccessModal(false)}>
                    <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalIcon}>
                            <CheckCircle size={48} color="#22c55e" />
                        </div>
                        <h3 className={styles.modalTitle}>Changes Saved!</h3>
                        <p className={styles.modalBody}>Your store profile has been updated successfully.</p>
                        <button
                            className={styles.modalBtn}
                            onClick={() => setShowSuccessModal(false)}
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
            {adjustingFile && (
                <ImageAdjuster 
                    file={adjustingFile}
                    aspect={adjustType === 'logo' ? 1 : 4}
                    shape={adjustType === 'logo' ? 'round' : 'rect'}
                    onSave={handleImageAdjusted}
                    onCancel={() => setAdjustingFile(null)}
                />
            )}
        </div>
    );
}
