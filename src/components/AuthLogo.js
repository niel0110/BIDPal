export default function AuthLogo({ className = '' }) {
    return (
        <div className={`${className}`} style={{
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '0.75rem',
        }}>
            <img
                src="/BIDPaL Logo.png"
                alt="BIDPal Logo"
                style={{ height: '80px', width: 'auto' }}
            />
            <span style={{
                fontSize: '3rem',
                fontWeight: '800',
                letterSpacing: '-0.02em',
                lineHeight: 1
            }}>
                <span style={{ color: '#d02440' }}>B</span>
                <span style={{ color: '#542769' }}>I</span>
                <span style={{ color: '#fba91d' }}>D</span>
                <span style={{ color: '#ef4f25' }}>P</span>
                <span style={{ color: '#d02440' }}>a</span>
                <span style={{ color: '#542769' }}>l</span>
            </span>
        </div>
    );
}
