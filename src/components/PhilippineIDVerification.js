'use client';

import { useState } from 'react';
import { Camera, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import styles from './PhilippineIDVerification.module.css';

const PHILIPPINE_IDS = [
    'UMID',
    'Driver\'s License',
    'PhilID (National ID)',
    'Passport',
    'SSS ID',
    'PRC ID',
    'Postal ID',
    'Voter\'s ID',
];

export default function PhilippineIDVerification({ onVerify }) {
    const [selectedIdType, setSelectedIdType] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [idImage, setIdImage] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const [verified, setVerified] = useState(false);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setIdImage(URL.createObjectURL(file));
        }
    };

    const handleVerify = () => {
        if (!selectedIdType || !idNumber || !idImage) return;
        setVerifying(true);
        // Simulate verification process
        setTimeout(() => {
            setVerifying(false);
            setVerified(true);
            if (onVerify) onVerify({ type: selectedIdType, number: idNumber });
        }, 2000);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <ShieldIcon className={styles.shieldIcon} />
                <div className={styles.headerText}>
                    <h3>Identity Verification</h3>
                    <p>Select a valid Philippine ID to verify your seller account.</p>
                </div>
            </div>

            {!verified ? (
                <div className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label>ID Type</label>
                        <select
                            value={selectedIdType}
                            onChange={(e) => setSelectedIdType(e.target.value)}
                            className={styles.select}
                        >
                            <option value="">Select ID Type</option>
                            {PHILIPPINE_IDS.map(id => (
                                <option key={id} value={id}>{id}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>ID Number</label>
                        <input
                            type="text"
                            placeholder="Enter ID Number"
                            value={idNumber}
                            onChange={(e) => setIdNumber(e.target.value)}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.uploadGroup}>
                        <label>Upload ID Photo</label>
                        <div className={styles.uploadBox}>
                            {idImage ? (
                                <div className={styles.previewWrapper}>
                                    <img src={idImage} alt="ID Preview" className={styles.preview} />
                                    <button onClick={() => setIdImage(null)} className={styles.removeBtn}>Change</button>
                                </div>
                            ) : (
                                <label className={styles.uploadPlaceholder}>
                                    <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                                    <Upload size={32} />
                                    <span>Click to upload front of ID</span>
                                    <p>Ensure all details are clearly visible</p>
                                </label>
                            )}
                        </div>
                    </div>

                    <button
                        className={styles.verifyBtn}
                        onClick={handleVerify}
                        disabled={!selectedIdType || !idNumber || !idImage || verifying}
                    >
                        {verifying ? 'Verifying...' : 'Verify Identity'}
                    </button>
                </div>
            ) : (
                <div className={styles.verifiedState}>
                    <CheckCircle size={48} color="#4CAF50" />
                    <h4>Identity Verified</h4>
                    <p>Your {selectedIdType} has been successfully verified.</p>
                </div>
            )}
        </div>
    );
}

function ShieldIcon({ className }) {
    return (
        <svg
            width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" className={className}
        >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
}
