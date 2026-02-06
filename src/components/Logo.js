export default function Logo({ className = '' }) {
    return (
        <div className={`flex items-center gap-2 ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="10" fill="var(--color-primary)" />
                <path d="M0 20H10C15.5228 20 20 24.4772 20 30V40H0V20Z" fill="var(--color-purple)" />
                <path d="M20 0H40V20H20V0Z" fill="var(--color-orange)" style={{ borderTopRightRadius: '10px' }} />
                <path d="M20 20H40V40H20V20Z" fill="var(--color-yellow)" style={{ borderBottomRightRadius: '10px' }} />
                {/* Simplified shapes for the icon based on visual approximation */}
                <rect x="22" y="0" width="18" height="18" rx="4" fill="var(--color-orange)" />
                <rect x="22" y="22" width="18" height="18" rx="4" fill="var(--color-yellow)" />
                <path d="M0 22 H18 V36 A4 4 0 0 1 14 40 H4 A4 4 0 0 1 0 36 Z" fill="var(--color-purple)" />
            </svg>
            <span style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.02em', lineHeight: 1 }}>
                <span style={{ color: 'var(--color-primary)' }}>B</span>
                <span style={{ color: 'var(--color-orange)' }}>I</span>
                <span style={{ color: 'var(--color-yellow)' }}>D</span>
                <span style={{ color: 'var(--color-purple)' }}>Pal</span>
            </span>
        </div>
    );
}
