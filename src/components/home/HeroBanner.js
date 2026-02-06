import styles from './HeroBanner.module.css';

export default function HeroBanner() {
    return (
        <div className={styles.heroContainer}>
            <div className={styles.banner}>
                <div className={styles.content}>
                    <h1 className={styles.flashText}>FLASH<br />SALE</h1>
                    <h2 className={styles.subText}>Limited Time Clearance Sale</h2>
                    <div className={styles.discountText}>UP TO 20% OFF</div>
                </div>
                <div className={styles.dateText}>12.12</div>
            </div>
        </div>
    );
}
