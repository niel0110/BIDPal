'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check } from 'lucide-react';
import styles from './ImageAdjuster.module.css';

/**
 * ImageAdjuster
 * - Auto-fits image to cover the crop area on load
 * - Scroll wheel / trackpad pinch → zoom towards cursor
 * - Click & drag → reposition
 * - transform-origin: 0 0 with manual offset math for predictable behavior
 */
export default function ImageAdjuster({ 
    file, 
    aspect = 1,       // e.g. 1 for square, 4 for wide banner
    shape = 'rect',   // 'rect' | 'round'
    onSave, 
    onCancel 
}) {
    const [imageSrc, setImageSrc] = useState(null);
    const [zoom, setZoom]   = useState(1);
    const [crop, setCrop]   = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const containerRef = useRef(null);
    const imgRef       = useRef(null);
    // Refs keep the latest values accessible in non-React event handlers
    const zoomRef      = useRef(1);
    const cropRef      = useRef({ x: 0, y: 0 });
    const dragStart    = useRef({ mx: 0, my: 0, cx: 0, cy: 0 });

    // Sync refs whenever state changes
    useEffect(() => { zoomRef.current = zoom; }, [zoom]);
    useEffect(() => { cropRef.current = crop; }, [crop]);

    // Load file
    useEffect(() => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setImageSrc(reader.result);
        reader.readAsDataURL(file);
    }, [file]);

    // ── Boundary clamp ──────────────────────────────────────────────────────
    // Ensures the crop frame is always fully covered by the image (no empty edges)
    const clampCrop = useCallback((newCrop, currentZoom) => {
        const img  = imgRef.current;
        const cont = containerRef.current;
        if (!img || !cont) return newCrop;

        const scaledW = img.naturalWidth  * currentZoom;
        const scaledH = img.naturalHeight * currentZoom;
        const contW   = cont.clientWidth;
        const contH   = cont.clientHeight;

        // x must stay in [contW - scaledW, 0]  (image right ≥ container right, image left ≤ 0)
        // y must stay in [contH - scaledH, 0]
        return {
            x: Math.min(0, Math.max(contW - scaledW, newCrop.x)),
            y: Math.min(0, Math.max(contH - scaledH, newCrop.y)),
        };
    }, []);

    // ── Auto-fit on image load ──────────────────────────────────────────────
    const handleImgLoad = useCallback(() => {
        const img  = imgRef.current;
        const cont = containerRef.current;
        if (!img || !cont) return;

        const cW = cont.clientWidth;
        const cH = cont.clientHeight;
        const iW = img.naturalWidth;
        const iH = img.naturalHeight;

        // Cover: scale so image fills the full container in both dimensions
        const fitZoom = Math.max(cW / iW, cH / iH);

        // Center the image inside the container (already covers, so clamp will keep it)
        const raw = { x: (cW - iW * fitZoom) / 2, y: (cH - iH * fitZoom) / 2 };
        const clamped = clampCrop(raw, fitZoom);

        setZoom(fitZoom);
        setCrop(clamped);
        zoomRef.current = fitZoom;
        cropRef.current = clamped;
    }, [clampCrop]);

    // ── Scroll / trackpad → zoom towards cursor ─────────────────────────────
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const img  = imgRef.current;
        const cont = containerRef.current;
        if (!img || !cont) return;

        const rect  = cont.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;   // cursor relative to container
        const mouseY = e.clientY - rect.top;

        // Pinch on trackpad uses deltaY with ctrlKey, regular scroll also uses deltaY
        const scaleFactor = e.deltaY < 0 ? 1.08 : 0.92;

        const prevZoom = zoomRef.current;
        const prevCrop = cropRef.current;

        // Minimum zoom = cover zoom (no empty edges)
        const minZoom = Math.max(
            cont.clientWidth  / img.naturalWidth,
            cont.clientHeight / img.naturalHeight
        );
        const newZoom = Math.min(8, Math.max(minZoom, prevZoom * scaleFactor));

        // Zoom towards cursor: keep the point under the cursor stationary
        const ratio  = newZoom / prevZoom;
        const newCropX = mouseX - (mouseX - prevCrop.x) * ratio;
        const newCropY = mouseY - (mouseY - prevCrop.y) * ratio;

        const newCrop = clampCrop({ x: newCropX, y: newCropY }, newZoom);

        zoomRef.current = newZoom;
        cropRef.current = newCrop;
        setZoom(newZoom);
        setCrop(newCrop);
    }, [clampCrop]);

    // Attach wheel as non-passive so we can preventDefault
    // imageSrc is a dep so the effect reruns once the DOM is actually rendered
    // (component returns null until imageSrc is set, so containerRef is null on first mount)
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [handleWheel, imageSrc]);

    // ── Mouse drag ──────────────────────────────────────────────────────────
    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = {
            mx: e.clientX,
            my: e.clientY,
            cx: cropRef.current.x,
            cy: cropRef.current.y,
        };
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const { mx, my, cx, cy } = dragStart.current;
        const raw     = { x: cx + (e.clientX - mx), y: cy + (e.clientY - my) };
        const newCrop = clampCrop(raw, zoomRef.current);
        cropRef.current = newCrop;
        setCrop(newCrop);
    };

    const handleMouseUp = () => setIsDragging(false);

    // ── Touch drag ──────────────────────────────────────────────────────────
    const handleTouchStart = (e) => {
        if (e.touches.length !== 1) return;
        setIsDragging(true);
        dragStart.current = {
            mx: e.touches[0].clientX,
            my: e.touches[0].clientY,
            cx: cropRef.current.x,
            cy: cropRef.current.y,
        };
    };

    const handleTouchMove = (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const { mx, my, cx, cy } = dragStart.current;
        const raw     = {
            x: cx + (e.touches[0].clientX - mx),
            y: cy + (e.touches[0].clientY - my),
        };
        const newCrop = clampCrop(raw, zoomRef.current);
        cropRef.current = newCrop;
        setCrop(newCrop);
    };

    // ── Crop & export ───────────────────────────────────────────────────────
    const getCroppedImage = async () => {
        const image = imgRef.current;
        const cont  = containerRef.current;
        if (!image || !cont) return;

        const outputWidth  = aspect >= 2 ? 1200 : 600;
        const outputHeight = Math.round(outputWidth / aspect);

        const canvas = document.createElement('canvas');
        canvas.width  = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext('2d');

        // crop.x/y = top-left of scaled image relative to container
        // Invert: what image coords map to container top-left?
        const sx     = -cropRef.current.x / zoomRef.current;
        const sy     = -cropRef.current.y / zoomRef.current;
        const sWidth  = cont.clientWidth  / zoomRef.current;
        const sHeight = cont.clientHeight / zoomRef.current;

        ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, outputWidth, outputHeight);

        return new Promise((resolve) =>
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92)
        );
    };

    const handleSave = async () => {
        const blob = await getCroppedImage();
        onSave(blob);
    };

    if (!imageSrc) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3>Adjust Image</h3>
                    <button onClick={onCancel} className={styles.closeBtn}><X size={20} /></button>
                </div>

                <div className={styles.body}>
                    <div
                        ref={containerRef}
                        className={`${styles.cropArea} ${shape === 'round' ? styles.round : ''}`}
                        style={{ aspectRatio: aspect }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleMouseUp}
                    >
                        <img
                            ref={imgRef}
                            src={imageSrc}
                            alt="Adjust"
                            className={styles.sourceImg}
                            onLoad={handleImgLoad}
                            style={{
                                transform: `translate(${crop.x}px, ${crop.y}px) scale(${zoom})`,
                                transformOrigin: '0 0',
                                cursor: isDragging ? 'grabbing' : 'grab',
                            }}
                            draggable={false}
                        />
                    </div>
                    <p className={styles.tip}>Drag to reposition · Scroll / pinch to zoom</p>
                </div>

                <div className={styles.footer}>
                    <button onClick={onCancel} className={styles.cancelBtn}>Cancel</button>
                    <button onClick={handleSave} className={styles.saveBtn}>
                        <Check size={18} />
                        Apply & Save
                    </button>
                </div>
            </div>
        </div>
    );
}
