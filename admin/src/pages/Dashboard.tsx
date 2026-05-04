import { useState, useEffect } from 'react';
import { Users, AlertCircle, Scale, TrendingUp, ShieldCheck } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface Stats {
  pendingVerifications: number;
  flaggedListings: number;
  openDisputes: number;
  suspendedUsers: number;
  totalUsers: number;
  pendingCancellations: number;
  potentialJoyReservers: number;
}

interface DayCount { name: string; registrations: number; }

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    pendingVerifications: 0,
    flaggedListings: 0,
    openDisputes: 0,
    suspendedUsers: 0,
    totalUsers: 0,
    pendingCancellations: 0,
    potentialJoyReservers: 0,
  });
  const [chartData, setChartData] = useState<DayCount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    const [
      { count: pendingVerifications },
      { count: flaggedListings },
      { count: openDisputes },
      { count: suspendedUsers },
      { count: totalUsers },
    ] = await Promise.all([
      supabase.from('User').select('*', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
      supabase.from('Products').select('*', { count: 'exact', head: true }).eq('status', 'under_review'),
      supabase.from('Disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('Violation_Records').select('*', { count: 'exact', head: true }).eq('standing', 'Suspended'),
      supabase.from('User').select('*', { count: 'exact', head: true }),
    ]);

    // Pending cancellations
    const { data: cancellationData } = await supabase
      .from('Order_Cancellations')
      .select('Violation_Events(Moderation_Cases(case_status))')
      .limit(500);

    const pendingCancellations = (cancellationData || []).filter(c => {
      const status = (c as any).Violation_Events?.Moderation_Cases?.case_status;
      return !status || status === 'pending' || status === 'under_review';
    }).length;

    // Potential Joy Reservers (> 25 stashed items)
    const { data: joyData } = await supabase
      .from('Cart_items')
      .select('user_id')
      .eq('is_stashed', true);

    const joyUserCounts: Record<string, number> = {};
    (joyData || []).forEach(item => {
      joyUserCounts[item.user_id] = (joyUserCounts[item.user_id] || 0) + 1;
    });
    const potentialJoyReservers = Object.values(joyUserCounts).filter(count => count > 25).length;

    setStats({
      pendingVerifications: pendingVerifications || 0,
      flaggedListings: flaggedListings || 0,
      openDisputes: openDisputes || 0,
      suspendedUsers: suspendedUsers || 0,
      totalUsers: totalUsers || 0,
      pendingCancellations,
      potentialJoyReservers,
    });
  };

  const fetchChartData = async () => {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('User')
      .select('create_at')
      .gte('create_at', since.toISOString());

    const counts: Record<number, number> = {};
    (data || []).forEach(u => {
      const day = new Date(u.create_at).getDay();
      counts[day] = (counts[day] || 0) + 1;
    });

    // Build last 7 days in order
    const result: DayCount[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayIdx = d.getDay();
      result.push({ name: DAY_LABELS[dayIdx], registrations: counts[dayIdx] || 0 });
    }
    setChartData(result);
  };

  useEffect(() => {
    Promise.all([fetchStats(), fetchChartData()]).finally(() => setLoading(false));

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'User' }, () => {
        fetchStats();
        fetchChartData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Products' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Disputes' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Violation_Records' }, fetchStats)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const statCards = [
    {
      icon: Users,
      iconBg: '#FEF2F2',
      iconColor: 'var(--accent-primary)',
      label: 'Total Users',
      value: stats.totalUsers,
      badge: 'All Time',
      badgeColor: 'var(--success)',
      delay: 0.1,
    },
    {
      icon: ShieldCheck,
      iconBg: '#FFF7ED',
      iconColor: 'var(--warning)',
      label: 'Pending Verifications',
      value: stats.pendingVerifications,
      badge: 'Action Required',
      badgeColor: 'var(--warning)',
      delay: 0.25,
    },
    {
      icon: AlertCircle,
      iconBg: '#FEF2F2',
      iconColor: 'var(--danger)',
      label: 'Flagged Listings',
      value: stats.flaggedListings,
      badge: 'Under Review',
      badgeColor: 'var(--danger)',
      delay: 0.35,
    },
    {
      icon: Scale,
      iconBg: '#F5F3FF',
      iconColor: 'var(--accent-secondary)',
      label: 'Open Disputes',
      value: stats.openDisputes,
      badge: 'Open',
      badgeColor: 'var(--accent-secondary)',
      delay: 0.45,
    },
  ];

  return (
    <div className="dashboard">
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Platform Overview</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Welcome back, Administrator.{' '}
          {loading ? 'Fetching latest data...' : "Here's what's happening today."}
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        {statCards.map(card => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: card.delay }}
            className="stat-card glass"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ background: card.iconBg, padding: '10px', borderRadius: '12px' }}>
                <card.icon color={card.iconColor} size={24} />
              </div>
              <span style={{ color: card.badgeColor, fontSize: '13px', fontWeight: 600 }}>{card.badge}</span>
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '12px', display: 'block' }}>{card.label}</span>
            <span style={{ fontSize: '28px', fontWeight: 800 }}>{card.value}</span>
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="glass" style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <div>
              <h3 style={{ fontSize: '20px' }}>New User Registrations</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Last 7 days</p>
            </div>
            <div className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              Live
            </div>
          </div>
          <div style={{ width: '100%', height: '300px', minHeight: '300px' }}>
            {chartData.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="registrations" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorReg)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '24px' }}>System Alerts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {stats.suspendedUsers > 0 && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users color="var(--danger)" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>{stats.suspendedUsers} Suspended Users</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Platform access restricted</p>
                </div>
                <div className="badge badge-danger">High</div>
              </div>
            )}
            {stats.flaggedListings > 0 && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertCircle color="var(--danger)" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>{stats.flaggedListings} Flagged Listings</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pending manual review</p>
                </div>
                <div className="badge badge-danger">High</div>
              </div>
            )}
            {stats.pendingVerifications > 0 && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck color="var(--warning)" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>{stats.pendingVerifications} Seller Verifications</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Identity review required</p>
                </div>
                <div className="badge badge-pending">Normal</div>
              </div>
            )}
            {stats.pendingCancellations > 0 && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <TrendingUp color="var(--accent-secondary)" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>{stats.pendingCancellations} Cancellation Reviews</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Awaiting moderation decision</p>
                </div>
                <div className="badge badge-pending">Normal</div>
              </div>
            )}
            {stats.potentialJoyReservers > 0 && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users color="#10b981" size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '14px', fontWeight: 500 }}>{stats.potentialJoyReservers} Joy Reservers</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Users with excessive stashed items</p>
                </div>
                <div className="badge badge-warning" style={{ background: '#fef3c7', color: '#92400e' }}>Medium</div>
              </div>
            )}
            {stats.flaggedListings === 0 && stats.pendingVerifications === 0 && stats.suspendedUsers === 0 && stats.pendingCancellations === 0 && stats.potentialJoyReservers === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                No alerts at this time.
              </p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
