'use client';

import {
    TrendingUp,
    Users,
    ShoppingBag,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    MoreVertical,
    Calendar
} from 'lucide-react';
import styles from './page.module.css';

export default function Analytics() {
    const kpis = [
        { label: 'Total Revenue', value: '₱ 452,100', change: '+12.5%', isPositive: true, icon: <DollarSign size={24} />, color: 'purple' },
        { label: 'Items Sold', value: '1,280', change: '+8.2%', isPositive: true, icon: <ShoppingBag size={24} />, color: 'blue' },
        { label: 'Avg. Bid Increase', value: '34%', change: '-2.4%', isPositive: false, icon: <TrendingUp size={24} />, color: 'red' },
        { label: 'New Followers', value: '842', change: '+15.1%', isPositive: true, icon: <Users size={24} />, color: 'orange' },
    ];

    const topProducts = [
        { name: 'Vintage Leather Satchel', category: 'Bags', sales: 45, revenue: '₱ 144,000' },
        { name: 'Silver Pocket Watch', category: 'Jewelry', sales: 32, revenue: '₱ 38,400' },
        { name: 'Retro Camera Kit', category: 'Gadgets', sales: 28, revenue: '₱ 347,200' },
    ];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <h1>Analytics</h1>
                    <p>Track your business growth and performance insights.</p>
                </div>
                <div className={styles.timeFilter}>
                    <Calendar size={18} />
                    <span>Last 30 Days</span>
                </div>
            </header>

            {/* KPI Grid */}
            <div className={styles.kpiGrid}>
                {kpis.map((kpi, idx) => (
                    <div key={idx} className={styles.kpiCard}>
                        <div className={`${styles.iconBox} ${styles[kpi.color]}`}>
                            {kpi.icon}
                        </div>
                        <div className={styles.kpiInfo}>
                            <span className={styles.kpiLabel}>{kpi.label}</span>
                            <h2 className={styles.kpiValue}>{kpi.value}</h2>
                            <div className={`${styles.kpiChange} ${kpi.isPositive ? styles.positive : styles.negative}`}>
                                {kpi.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                <span>{kpi.change} vs last month</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.mainGrid}>
                {/* Sales Chart Mockup */}
                <section className={styles.chartSection}>
                    <div className={styles.sectionHeader}>
                        <h3>Revenue Overview</h3>
                        <button className={styles.iconBtn}><MoreVertical size={18} /></button>
                    </div>
                    <div className={styles.chartContainer}>
                        {/* Visual simulation of a bar chart */}
                        <div className={styles.barChart}>
                            {[65, 40, 80, 50, 95, 70, 85, 45, 60, 75, 55, 90].map((h, i) => (
                                <div key={i} className={styles.barWrapper}>
                                    <div className={styles.bar} style={{ height: `${h}%` }}>
                                        <div className={styles.barTooltip}>₱ {(h * 1000).toLocaleString()}</div>
                                    </div>
                                    <span className={styles.barLabel}>{['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Top Products Table */}
                <section className={styles.tableSection}>
                    <div className={styles.sectionHeader}>
                        <h3>Top Performing Items</h3>
                        <button className={styles.textLink}>View All</button>
                    </div>
                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Sales</th>
                                    <th>Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topProducts.map((p, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <div className={styles.productCell}>
                                                <span className={styles.pName}>{p.name}</span>
                                                <span className={styles.pCat}>{p.category}</span>
                                            </div>
                                        </td>
                                        <td>{p.sales}</td>
                                        <td className={styles.revenueCell}>{p.revenue}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {/* Engagement Insights */}
            <div className={styles.insightsGrid}>
                <div className={styles.insightCard}>
                    <h3>Peak Viewing Hours</h3>
                    <p>Your auctions get 45% more engagement between <strong>7:00 PM - 9:00 PM</strong>.</p>
                </div>
                <div className={styles.insightCard}>
                    <h3>Best Category</h3>
                    <p><strong>Gadgets</strong> is your highest revenue generator this month.</p>
                </div>
                <div className={styles.insightCard}>
                    <h3>Tip!</h3>
                    <p>Adding a "Flat Bid" countdown increases final prices by <strong>12%</strong> on average.</p>
                </div>
            </div>
        </div>
    );
}
