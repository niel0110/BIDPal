'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Search, Filter, Plus } from 'lucide-react';
import styles from './page.module.css';

const mockProducts = [
    { id: 1, name: 'XYZ name.jpg', size: '24 Mb', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=200&auto=format&fit=crop' },
    { id: 2, name: 'XYZ name.jpg', size: '24 Mb', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=200&auto=format&fit=crop' },
    { id: 3, name: 'Retro Camera Kit', size: '48 Mb', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=200' },
];

export default function SelectProductPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Link href="/seller/auctions" className={styles.backLink}>
                    <ChevronLeft size={24} />
                    <span>My Auctions</span>
                </Link>
                <div className={styles.titleArea}>
                    <h1>Select Product</h1>
                    <p>Choose an item from your inventory to schedule for auction or sale.</p>
                </div>
            </header>

            <div className={styles.controls}>
                <div className={styles.searchBar}>
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder="Search your inventory..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className={styles.filterBtn}>
                    <Filter size={20} />
                    <span>Filter</span>
                </button>
            </div>

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
                        <Link href={`/seller/auctions/schedule?id=${product.id}`} className={styles.selectBtn}>
                            Select for Auction
                        </Link>
                    </div>
                ))}

                <Link href="/seller/add-product" className={styles.addCard}>
                    <div className={styles.plusCircle}>
                        <Plus size={32} color="var(--color-primary)" />
                    </div>
                    <span>Add New Product</span>
                </Link>
            </div>
        </div>
    );
}
