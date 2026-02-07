import { useState } from 'react';
import {
    LayoutGrid, Shirt, Footprints, ShoppingBag, Gem,
    Smartphone, Monitor, Armchair, Sprout, Music
} from 'lucide-react';
import styles from './CategoryNav.module.css';

const categories = [
    { id: 'all', label: 'All', icon: LayoutGrid, colorClass: 'all' },
    { id: 'clothing', label: 'Clothing', icon: Shirt, colorClass: 'clothing' },
    { id: 'shoes', label: 'Shoes', icon: Footprints, colorClass: 'shoes' },
    { id: 'bags', label: 'Bags', icon: ShoppingBag, colorClass: 'bags' },
    { id: 'jewelry', label: 'Jewelry', icon: Gem, colorClass: 'jewelry' },
    { id: 'gadgets', label: 'Gadgets', icon: Smartphone, colorClass: 'gadgets' },
    { id: 'appliances', label: 'Appliances', icon: Monitor, colorClass: 'appliances' },
    { id: 'furniture', label: 'Furniture', icon: Armchair, colorClass: 'furniture' },
    { id: 'garden', label: 'Garden', icon: Sprout, colorClass: 'garden' },
    { id: 'instruments', label: 'Instruments', icon: Music, colorClass: 'instruments' },
];

export default function CategoryNav() {
    const [activeId, setActiveId] = useState('all');

    return (
        <div className={styles.navContainer}>
            <div className={styles.scrollWrapper}>
                {categories.map((cat) => (
                    <div
                        key={cat.id}
                        className={`${styles.categoryItem} ${activeId === cat.id ? styles.active : ''}`}
                        onClick={() => setActiveId(cat.id)}
                    >
                        <div className={`${styles.iconCircle} ${styles[cat.colorClass]}`}>
                            <cat.icon size={24} />
                        </div>
                        <span className={styles.label}>{cat.label}</span>
                        {activeId === cat.id && <div className={styles.activeLine} />}
                    </div>
                ))}
            </div>
        </div>
    );
}
