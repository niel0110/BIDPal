'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import styles from './PhilippineIDVerification.module.css';

const PHILIPPINE_IDS = [
    'UMID',
    "Driver's License",
    'PhilID (National ID)',
    'Passport',
    'SSS ID',
    'PRC ID',
    'Postal ID',
    "Voter's ID",
    'School ID',
];

export default function PhilippineIDVerification({ onVerify, submitting }) {
    const [selectedIdType, setSelectedIdType] = useState('');
    const [idNumber, setIdNumber] = useState('');
    const [frontImage, setFrontImage] = useState(null);
    const [frontFile, setFrontFile] = useState(null);
    const [backImage, setBackImage] = useState(null);
    const [backFile, setBackFile] = useState(null);
    const [touched, setTouched] = useState(false);

    const missing = [
        !selectedIdType && 'ID Type',
        !idNumber.trim() && 'ID Number',
        !frontImage && 'Front of ID',
        !backImage && 'Back of ID',
    ].filter(Boolean);

    const isReady = missing.length === 0;

    const makeImageHandler = (setImg, setFile) => (e) => {
        const file = e.target.files[0];
        if (file) {
            setFile(file);
            setImg(URL.createObjectURL(file));
        }
    };

    const handleVerify = () => {
        setTouched(true);
        if (!isReady) return;
        if (onVerify) onVerify({ type: selectedIdType, number: idNumber, frontFile, backFile });
    };

    const UploadBox = ({ image, file, setImg, setFile, label }) => (
        <div className={styles.uploadGroup}>
            <label>{label}<span className={styles.req}>*</span></label>
            <div className={`${styles.uploadBox} ${touched && !image ? styles.uploadBoxError : ''}`}>
                {image ? (
                    <div className={styles.previewWrapper}>
                        <img src={image} alt={label} className={styles.preview} />
                        <button
                            onClick={() => { setImg(null); setFile(null); }}
                            className={styles.removeBtn}
                            type="button"
                        >
                            Change
                        </button>
                    </div>
                ) : (
                    <label className={styles.uploadPlaceholder}>
                        <input type="file" accept="image/*" onChange={makeImageHandler(setImg, setFile)} hidden />
                        <Upload size={28} />
                        <span>Click to upload</span>
                        <p>Ensure all details are clearly visible</p>
                    </label>
                )}
            </div>
            {touched && !image && (
                <span className={styles.errorMsg}>Please upload a photo</span>
            )}
        </div>
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <ShieldIcon className={styles.shieldIcon} />
                <div className={styles.headerText}>
                    <h3>Identity Verification</h3>
                    <p>Upload both sides of a valid Philippine government-issued ID.</p>
                </div>
            </div>

            <div className={styles.form}>
                {/* ID Type + ID Number side by side */}
                <div className={styles.topRow}>
                    <div className={styles.inputGroup}>
                        <label>ID Type<span className={styles.req}>*</span></label>
                        <select
                            value={selectedIdType}
                            onChange={e => setSelectedIdType(e.target.value)}
                            className={`${styles.select} ${touched && !selectedIdType ? styles.fieldError : ''}`}
                        >
                            <option value="">Select ID Type</option>
                            {PHILIPPINE_IDS.map(id => (
                                <option key={id} value={id}>{id}</option>
                            ))}
                        </select>
                        {touched && !selectedIdType && (
                            <span className={styles.errorMsg}>Please select an ID type</span>
                        )}
                    </div>

                    <div className={styles.inputGroup}>
                        <label>ID Number<span className={styles.req}>*</span></label>
                        <input
                            type="text"
                            placeholder="Enter ID Number"
                            value={idNumber}
                            onChange={e => setIdNumber(e.target.value)}
                            className={`${styles.input} ${touched && !idNumber.trim() ? styles.fieldError : ''}`}
                        />
                        {touched && !idNumber.trim() && (
                            <span className={styles.errorMsg}>ID number is required</span>
                        )}
                    </div>
                </div>

                {/* Front & Back side by side */}
                <div className={styles.idPhotoRow}>
                    <UploadBox
                        image={frontImage} file={frontFile}
                        setImg={setFrontImage} setFile={setFrontFile}
                        label="Front of ID"
                    />
                    <UploadBox
                        image={backImage} file={backFile}
                        setImg={setBackImage} setFile={setBackFile}
                        label="Back of ID"
                    />
                </div>

                {/* Pre-submit checklist */}
                {!touched && (
                    <div className={styles.checklist}>
                        {[
                            { label: 'ID Type selected', done: !!selectedIdType },
                            { label: 'ID Number entered', done: !!idNumber.trim() },
                            { label: 'Front of ID uploaded', done: !!frontImage },
                            { label: 'Back of ID uploaded', done: !!backImage },
                        ].map(item => (
                            <div key={item.label} className={`${styles.checkItem} ${item.done ? styles.checkDone : ''}`}>
                                <span className={styles.checkDot} />
                                {item.label}
                            </div>
                        ))}
                    </div>
                )}

                <button
                    className={styles.verifyBtn}
                    onClick={handleVerify}
                    disabled={submitting}
                    type="button"
                >
                    {submitting ? 'Submitting…' : 'Submit for Verification'}
                </button>
            </div>
        </div>
    );
}

function ShieldIcon({ className }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeLinejoin="round" className={className}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
}
