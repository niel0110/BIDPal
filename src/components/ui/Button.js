import styles from './Button.module.css';

export default function Button({ children, variant = 'primary', fullWidth = false, className = '', ...props }) {
    return (
        <button
            className={`${styles.button} ${styles[variant]} ${fullWidth ? styles.fullWidth : ''} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
