'use client';

import Link from 'next/link';
import { ChevronLeft, Plus } from 'lucide-react';
import styles from './page.module.css';

const mockProducts = [
    { id: 1, name: 'XYZ name.jpg', size: '24 Mb', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=200&auto=format&fit=crop' },
    { id: 2, name: 'XYZ name.jpg', size: '24 Mb', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=200&auto=format&fit=crop' },
];

export default function InventoryPage() {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Link href="/seller" className={styles.backLink}>
                    <ChevronLeft size={24} />
                    <span>Products</span>
                </Link>
                <h1 className={styles.title}>My Products</h1>
            </header>

            <div className={styles.productGrid}>
                {mockProducts.map((product) => (
                    <div key={product.id} className={styles.productCard}>
                        <div className={styles.imageWrapper}>
                            <img src={product.image} alt={product.name} />
                        </div>
                        <div className={styles.productInfo}>
                            <strong>{product.name}</strong>
                            <span>{product.size}</span>
                        </div>
                    </div>
                ))}

                <Link href="/seller/add-product" className={styles.addCard}>
                    <div className={styles.plusCircle}>
                        <Plus size={48} color="var(--color-primary)" strokeWidth={1.5} />
                    </div>
                </Link>
            </div>
        </div>
    );
}
