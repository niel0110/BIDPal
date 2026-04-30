import { useEffect, useMemo, useState } from 'react';
import { Search, TrendingUp, ReceiptText, WalletCards, Percent, PackagePlus, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface RevenueRow {
  id: string;
  order_id: string | null;
  seller_id: string | null;
  total_amount: number;
  commission_rate: number;
  commission_amount: number;
  earning_type: string;
  created_at: string | null;
  source: 'Platform_Earnings' | 'Orders';
}

interface SubscriptionRow {
  subscription_id: string;
  seller_id: string;
  plan: string;
  monthly_fee: number;
  status: string;
  started_at: string;
}

interface ValueAddedRow {
  value_added_earning_id: string;
  seller_id: string | null;
  order_id: string | null;
  service_type: string;
  amount: number;
  created_at: string;
}

const currency = (amount: number) =>
  `PHP ${Number(amount || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

const rate = (value: number) => `${(Number(value || 0) * 100).toFixed(1)}%`;

const RevenueManagement = () => {
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [services, setServices] = useState<ValueAddedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchRevenue = async () => {
    setLoading(true);

    const { data: platformData } = await supabase
      .from('Platform_Earnings')
      .select('earning_id, order_id, seller_id, total_amount, commission_rate, commission_amount, earning_type, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (platformData && platformData.length > 0) {
      setRows(platformData.map((item: any) => ({
        id: item.earning_id || item.order_id,
        order_id: item.order_id,
        seller_id: item.seller_id,
        total_amount: Number(item.total_amount || 0),
        commission_rate: Number(item.commission_rate || 0),
        commission_amount: Number(item.commission_amount || 0),
        earning_type: item.earning_type || 'transaction_commission',
        created_at: item.created_at || null,
        source: 'Platform_Earnings',
      })));
    } else {
      const { data: orderData } = await supabase
        .from('Orders')
        .select('order_id, seller_id, total_amount, commission_rate, commission_amount, placed_at, status')
        .in('status', ['processing', 'shipped', 'completed'])
        .order('placed_at', { ascending: false })
        .limit(1000);

      setRows((orderData || []).map((item: any) => ({
        id: item.order_id,
        order_id: item.order_id,
        seller_id: item.seller_id,
        total_amount: Number(item.total_amount || 0),
        commission_rate: Number(item.commission_rate || 0),
        commission_amount: Number(item.commission_amount || 0),
        earning_type: 'transaction_commission',
        created_at: item.placed_at || null,
        source: 'Orders',
      })));
    }

    const [{ data: subscriptionData }, { data: serviceData }] = await Promise.all([
      supabase
        .from('Seller_Subscriptions')
        .select('subscription_id, seller_id, plan, monthly_fee, status, started_at')
        .order('started_at', { ascending: false })
        .limit(500),
      supabase
        .from('Value_Added_Earnings')
        .select('value_added_earning_id, seller_id, order_id, service_type, amount, created_at')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    setSubscriptions(subscriptionData || []);
    setServices(serviceData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRevenue();
  }, []);

  const filteredRows = rows.filter(row => {
    const haystack = `${row.order_id || ''} ${row.seller_id || ''} ${row.earning_type}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || row.earning_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const summary = useMemo(() => {
    const commissionRevenue = filteredRows.reduce((sum, row) => sum + row.commission_amount, 0);
    const grossVolume = filteredRows.reduce((sum, row) => sum + row.total_amount, 0);
    const subscriptionRevenue = subscriptions
      .filter(row => row.status === 'active')
      .reduce((sum, row) => sum + Number(row.monthly_fee || 0), 0);
    const serviceRevenue = services.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return {
      commissionRevenue,
      grossVolume,
      subscriptionRevenue,
      serviceRevenue,
      averageRate: grossVolume > 0 ? commissionRevenue / grossVolume : 0,
    };
  }, [filteredRows, subscriptions, services]);

  const earningTypes = ['all', ...Array.from(new Set(rows.map(row => row.earning_type)))];

  const statCards = [
    { label: 'Commission Revenue', value: currency(summary.commissionRevenue), icon: TrendingUp, color: 'var(--success)' },
    { label: 'Gross Volume', value: currency(summary.grossVolume), icon: ReceiptText, color: 'var(--accent-primary)' },
    { label: 'Average Rate', value: rate(summary.averageRate), icon: Percent, color: 'var(--warning)' },
    { label: 'Other Revenue', value: currency(summary.subscriptionRevenue + summary.serviceRevenue), icon: PackagePlus, color: 'var(--accent-secondary)' },
  ];

  return (
    <div>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Revenue Management</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage BIDPal commissions, seller plans, and value-added revenue.</p>
        </div>
        <button onClick={fetchRevenue} className="btn btn-outline" disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '18px', marginBottom: '24px' }}>
        {statCards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="glass"
            style={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color }}>
                <card.icon size={21} />
              </div>
              <span className="badge badge-outline">{filteredRows.length} rows</span>
            </div>
            <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>{card.label}</span>
            <strong style={{ display: 'block', fontSize: '24px', marginTop: '6px' }}>{card.value}</strong>
          </motion.div>
        ))}
      </div>

      <section className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '4px' }}>Commission Rules</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Current BMC rules used by new orders.</p>
          </div>
          <div className="badge badge-success">5% floor</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          {[
            ['Under PHP 5,000', '10%'],
            ['PHP 5,000 - 9,999', '9%'],
            ['PHP 10,000 - 19,999', '8%'],
            ['PHP 20,000 - 49,999', '7%'],
            ['PHP 50,000 and up', '6%'],
            ['High-volume sellers', 'Up to 2% discount'],
          ].map(([label, value]) => (
            <div key={label} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: '#F8FAFC' }}>
              <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700 }}>{label}</span>
              <strong style={{ display: 'block', fontSize: '22px', marginTop: '6px' }}>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="glass" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '4px' }}>Revenue Records</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              {rows[0]?.source === 'Orders' ? 'Showing fallback order commission data until Platform_Earnings has records.' : 'Showing Platform_Earnings records.'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 14px', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', background: 'white' }}>
              <Search size={16} color="var(--text-secondary)" />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder="Search order or seller..."
                style={{ border: 0, outline: 0, width: '190px', fontFamily: 'inherit' }}
              />
            </div>
            <select
              value={typeFilter}
              onChange={event => setTypeFilter(event.target.value)}
              style={{ padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border)', fontFamily: 'inherit', color: 'var(--text-primary)' }}
            >
              {earningTypes.map(type => (
                <option key={type} value={type}>{type === 'all' ? 'All revenue types' : type}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading revenue records...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Seller</th>
                  <th>Type</th>
                  <th>GMV</th>
                  <th>Rate</th>
                  <th>Commission</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600 }}>{row.order_id || '-'}</td>
                    <td>{row.seller_id || '-'}</td>
                    <td><span className="badge badge-outline">{row.earning_type}</span></td>
                    <td>{currency(row.total_amount)}</td>
                    <td>{rate(row.commission_rate)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{currency(row.commission_amount)}</td>
                    <td>{row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
                      No revenue records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', marginTop: '24px' }}>
        <div className="glass" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WalletCards size={18} /> Seller Subscriptions
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>PHP 199 growth and PHP 499 pro plans.</p>
          <strong style={{ fontSize: '24px' }}>{currency(summary.subscriptionRevenue)}</strong>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px' }}>{subscriptions.length} subscription records</p>
        </div>
        <div className="glass" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PackagePlus size={18} /> Value-Added Services
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>Featured listings, shipping labels, insurance, and training.</p>
          <strong style={{ fontSize: '24px' }}>{currency(summary.serviceRevenue)}</strong>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px' }}>{services.length} service records</p>
        </div>
      </section>
    </div>
  );
};

export default RevenueManagement;
