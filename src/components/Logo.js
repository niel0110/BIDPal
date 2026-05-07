import Link from 'next/link';

export default function Logo({ className = '', white = false, href = '/' }) {
    return (
        <Link href={href} style={{ textDecoration: 'none' }}>
            <div className={`flex items-center gap-2 ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <img
                    src="/BIDPaL Logo.png"
                    alt="BIDPal Logo"
                    style={{ height: '32px', width: 'auto', filter: white ? 'brightness(0) invert(1)' : 'none' }}
                />
                <span style={{ fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {white ? (
                        <span style={{ color: 'white' }}>BIDPal</span>
                    ) : (
                        <>
                            <span style={{ color: '#d02440' }}>B</span>
                            <span style={{ color: '#542769' }}>I</span>
                            <span style={{ color: '#fba91d' }}>D</span>
                            <span style={{ color: '#ef4f25' }}>P</span>
                            <span style={{ color: '#d02440' }}>a</span>
                            <span style={{ color: '#542769' }}>l</span>
                        </>
                    )}
                </span>
            </div>
        </Link>
    );
}
