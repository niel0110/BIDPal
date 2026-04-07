'use client';

import styles from './BIDPalLoader.module.css';

const DOT_COLORS = ['#d02440', '#542769', '#fba91d', '#ef4f25'];

/**
 * BIDPal branded 4-dot loading indicator.
 * @param {'page'|'section'|'inline'} size
 *   - page    : full-page centered (default)
 *   - section : centered within a container (min-height 200px)
 *   - inline  : small inline dots, no wrapper padding
 */
export default function BIDPalLoader({ size = 'page' }) {
    const dots = (
        <div className={styles.dots}>
            {DOT_COLORS.map((color, i) => (
                <span
                    key={i}
                    className={styles.dot}
                    style={{ background: color, animationDelay: `${i * 0.15}s` }}
                />
            ))}
        </div>
    );

    if (size === 'inline') return dots;

    return (
        <div className={size === 'section' ? styles.sectionWrapper : styles.pageWrapper}>
            {dots}
        </div>
    );
}
