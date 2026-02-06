import styles from './Input.module.css';

export default function Input({ icon, onIconClick, className = '', ...props }) {
    return (
        <div className={`${styles.wrapper} ${className}`}>
            <input
                className={styles.input}
                {...props}
            />
            {icon && (
                <button
                    type="button"
                    className={styles.icon}
                    onClick={onIconClick}
                >
                    {icon}
                </button>
            )}
        </div>
    );
}
