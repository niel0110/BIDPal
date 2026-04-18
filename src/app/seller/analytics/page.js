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
import BackButton from '@/components/BackButton';
import styles from './page.module.css';

export default function Analytics() {
    const kpis = [
        { label: 'Total Revenue', value: '₱ 0', change: '0%', isPositive: true, icon: <DollarSign size={18} />, color: 'purple' },
        { label: 'Items Sold', value: '0', change: '0%', isPositive: true, icon: <ShoppingBag size={18} />, color: 'blue' },
        { label: 'Avg. Bid Increase', value: '0%', change: '0%', isPositive: true, icon: <TrendingUp size={18} />, color: 'red' },
        { label: 'New Followers', value: '0', change: '0%', isPositive: true, icon: <Users size={18} />, color: 'orange' },
    ];

    const topProducts = [];

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.titleGroup}>
                    <BackButton label="Back" />
                    <h1>Merchant Insights</h1>
                    <p>Track your business growth and performance insights.</p>
                </div>
                <div className={styles.timeFilter}>
                    <Calendar size={18} />
                    <span>Last 30 Days</span>
                </div>
            </header>

            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                {kpis.map((kpi, idx) => (
                    <div key={idx} className={styles.kpiCard} style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '0.75rem', gap: '0.4rem', borderRadius: '12px' }}>
                        <div className={`${styles.iconBox} ${styles[kpi.color]}`} style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}>
                            {kpi.icon}
                        </div>
                        <div className={styles.kpiInfo}>
                            <span className={styles.kpiLabel} style={{ fontSize: '0.62rem' }}>{kpi.label}</span>
                            <h2 className={styles.kpiValue} style={{ fontSize: '1.1rem', margin: '0.1rem 0' }}>{kpi.value}</h2>
                            <div className={`${styles.kpiChange} ${kpi.isPositive ? styles.positive : styles.negative}`} style={{ fontSize: '0.6rem' }}>
                                {kpi.isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                                <span>{kpi.change}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.mainGrid} style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
                {/* Sales Chart Mockup */}
                <section className={styles.chartSection} style={{ padding: '0.9rem', borderRadius: 14 }}>
                    <div className={styles.sectionHeader} style={{ marginBottom: '0.6rem' }}>
                        <h3 style={{ fontSize: '0.9rem' }}>Revenue Overview</h3>
                        <button className={styles.iconBtn}><MoreVertical size={18} /></button>
                    </div>
                    <div className={styles.chartContainer} style={{ height: 130 }}>
                        <div className={styles.barChart} style={{ height: 100 }}>
                            {[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map((_, i) => (
                                <div key={i} className={styles.barWrapper}>
                                    <div className={styles.bar} style={{ height: `10%` }}>
                                        <div className={styles.barTooltip}>₱ 0</div>
                                    </div>
                                    <span className={styles.barLabel}>{['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Top Products Table */}
                <section className={styles.tableSection} style={{ padding: '0.9rem', borderRadius: 14 }}>
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
                                {topProducts.length > 0 ? topProducts.map((p, idx) => (
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
                                )) : (
                                    <tr>
                                        <td colSpan="3" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                                            No data available for the selected period.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {/* Engagement Insights */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                <div className={styles.insightCard} style={{ padding: '0.75rem 0.9rem', borderRadius: 12 }}>
                    <h3 style={{ fontSize: '0.82rem', margin: '0 0 0.2rem 0' }}>Peak Viewing Hours</h3>
                    <p style={{ fontSize: '0.75rem', margin: 0, lineHeight: 1.4 }}>Your auctions get 45% more engagement between <strong>7:00 PM - 9:00 PM</strong>.</p>
                </div>
                <div className={styles.insightCard} style={{ padding: '0.75rem 0.9rem', borderRadius: 12 }}>
                    <h3 style={{ fontSize: '0.82rem', margin: '0 0 0.2rem 0' }}>Best Category</h3>
                    <p style={{ fontSize: '0.75rem', margin: 0, lineHeight: 1.4 }}><strong>Gadgets</strong> is your highest revenue generator this month.</p>
                </div>
                <div className={styles.insightCard} style={{ padding: '0.75rem 0.9rem', borderRadius: 12 }}>
                    <h3 style={{ fontSize: '0.82rem', margin: '0 0 0.2rem 0' }}>Tip!</h3>
                    <p style={{ fontSize: '0.75rem', margin: 0, lineHeight: 1.4 }}>Adding a "Flat Bid" countdown increases final prices by <strong>12%</strong> on average.</p>
                </div>
            </div>
        </div>
    );
}
