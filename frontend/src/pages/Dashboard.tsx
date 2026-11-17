import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  MessageCircle,
  Package,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import type { DashboardData, ApiResponse } from '../types';
import { formatCurrency, formatDate, formatNumber, timeAgo } from '../lib/utils';
import { Avatar, Card, CardHeader, EmptyState, PageLoader, StatusBadge } from '../components/ui';
import { useLanguage } from '../i18n/LanguageContext';

const PIE_COLORS = ['#C9A227', '#252B34', '#7A8492', '#EADCA0', '#3A424D', '#D3B44A', '#A9B0BA'];

type KpiAccent = 'gold' | 'blue' | 'amber' | 'green';

const kpiAccents: Record<KpiAccent, { icon: string; bar: string; glow: string }> = {
  gold: { icon: 'bg-gold-100 text-gold-700 ring-gold-500/20', bar: 'from-gold-300 to-gold-600', glow: 'bg-gold-400/25' },
  blue: { icon: 'bg-sky-100 text-sky-700 ring-sky-500/20', bar: 'from-sky-300 to-sky-600', glow: 'bg-sky-400/25' },
  amber: { icon: 'bg-amber-100 text-amber-700 ring-amber-500/20', bar: 'from-amber-300 to-amber-600', glow: 'bg-amber-400/25' },
  green: { icon: 'bg-emerald-100 text-emerald-700 ring-emerald-500/20', bar: 'from-emerald-300 to-emerald-600', glow: 'bg-emerald-400/25' },
};

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #E9EBEE',
  fontSize: 12,
  boxShadow: '0 12px 32px rgba(11,14,18,0.10)',
};

function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = 'gold',
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accent?: KpiAccent;
}) {
  const tone = kpiAccents[accent];
  return (
    <Card className="group relative overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-card">
      <span className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${tone.bar}`} />
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full ${tone.glow} opacity-60 blur-2xl`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
          <p className="mt-2 truncate font-display text-[26px] font-semibold leading-none text-ink-900">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${tone.icon}`}>{icon}</span>
      </div>
      <p className="relative mt-3 text-xs text-ink-400">{hint}</p>
    </Card>
  );
}

function HeroStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15 backdrop-blur">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gold-100/80">{label}</p>
      <p className={`mt-1 truncate font-display text-lg font-semibold sm:text-xl ${highlight ? 'text-gold-200' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const { t, language, enumLabel } = useLanguage();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<DashboardData>>('/dashboard');
      return res.data.data;
    },
  });

  if (isLoading) return <PageLoader label={t('dashboard.loading')} />;
  if (!data)
    return <EmptyState title={t('dashboard.unavailable')} description={t('dashboard.unavailableDesc')} />;

  const stats = data.stats;
  const monthlySales = data.charts.monthlySales.map((d) => ({ ...d, sales: Number(d.sales) }));
  const customerGrowth = data.charts.customerGrowth;
  const statusData = data.charts.orderStatusDistribution;
  const totalOrdersInStatus = statusData.reduce((sum, s) => sum + s.count, 0);
  const interestMax = Math.max(...data.charts.interestPopularity.map((x) => x.interests), 1);

  const today = new Date().toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="animate-fade-in space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gold-700 via-gold-800 to-ink-900 px-5 py-6 text-white shadow-card ring-1 ring-inset ring-gold-400/20 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-gold-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-60 w-60 rounded-full bg-gold-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-100 ring-1 ring-inset ring-white/20">
                <Sparkles className="h-3.5 w-3.5" /> {t('dashboard.workspace')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900/20 px-3 py-1 text-[10px] font-medium text-gold-100/90 ring-1 ring-inset ring-white/15">
                <CalendarDays className="h-3.5 w-3.5 text-gold-200" /> {today}
              </span>
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight sm:text-[32px]">{t('dashboard.greeting')}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-gold-100/80">{t('dashboard.subtitle')}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:min-w-[360px]">
            <HeroStat label={t('dashboard.monthlySales')} value={formatCurrency(Number(stats.monthlySales))} highlight />
            <HeroStat label={t('dashboard.newCustomers')} value={formatNumber(Number(stats.newCustomersThisMonth))} />
            <HeroStat label={t('dashboard.unreadChats')} value={formatNumber(Number(stats.unreadConversations))} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label={t('dashboard.totalCustomers')}
          value={formatNumber(Number(stats.totalCustomers))}
          hint={t('dashboard.hintNewThisMonth', { count: formatNumber(Number(stats.newCustomersThisMonth)) })}
          icon={<Users className="h-5 w-5" />}
          accent="blue"
        />
        <KpiCard
          label={t('dashboard.totalSales')}
          value={formatCurrency(Number(stats.totalSales))}
          hint={t('dashboard.hintOrdersRecorded', { count: formatNumber(Number(stats.totalOrders)) })}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="gold"
        />
        <KpiCard
          label={t('dashboard.ordersToAction')}
          value={formatNumber(Number(stats.pendingOrders))}
          hint={t('dashboard.hintConfirmed', { count: formatNumber(Number(stats.confirmedOrders)) })}
          icon={<ClipboardList className="h-5 w-5" />}
          accent="amber"
        />
        <KpiCard
          label={t('dashboard.unreadWhatsApp')}
          value={formatNumber(Number(stats.unreadConversations))}
          hint={t('dashboard.hintActiveProducts', { count: formatNumber(Number(stats.totalProducts)) })}
          icon={<MessageCircle className="h-5 w-5" />}
          accent="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t('dashboard.salesMomentum')}
            subtitle={t('dashboard.salesMomentumSubtitle')}
            action={
              <Link to="/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700 hover:text-gold-800">
                {t('dashboard.reports')} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="h-72 px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlySales} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A227" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#C9A227" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9EBEE" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#7A8492' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#7A8492' }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip formatter={(value: number) => [formatCurrency(value), t('dashboard.sales')]} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="sales" stroke="#C9A227" strokeWidth={3} fill="url(#salesFill)" activeDot={{ r: 5, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.orderStatus')} subtitle={t('dashboard.currentDistribution')} />
          <div className="relative h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="count" nameKey="status" innerRadius={54} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                  {statusData.map((entry, index) => (
                    <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [value, enumLabel(String(name))]}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-display text-2xl font-semibold leading-none text-ink-900">{formatNumber(totalOrdersInStatus)}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-ink-400">{t('dashboard.orders')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-5 pb-5">
            {statusData.map((s, i) => (
              <div key={s.status} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 truncate text-ink-500">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="truncate">{enumLabel(s.status)}</span>
                </span>
                <span className="font-semibold text-ink-800">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title={t('dashboard.customerGrowth')} subtitle={t('dashboard.customerGrowthSubtitle')} />
          <div className="h-56 px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerGrowth} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D3B44A" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#866719" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9EBEE" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#7A8492' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#7A8492' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number) => [value, t('dashboard.newCustomers')]}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'rgba(201,162,39,0.08)' }}
                />
                <Bar dataKey="customers" fill="url(#growthFill)" radius={[6, 6, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.topCustomers')} subtitle={t('dashboard.byLifetimeValue')} />
          <div className="divide-y divide-ink-50">
            {data.lists.topCustomers.slice(0, 5).map((c) => (
              <Link key={c.id} to={`/customers/${c.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-gold-50/50">
                <Avatar name={c.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink-800">{c.fullName}</p>
                  <p className="text-[10px] text-ink-400">{c.customerCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-ink-900">{formatCurrency(c.totalSpent)}</p>
                  <p className="text-[10px] text-ink-400">{t('dashboard.countOrders', { count: c.totalOrders })}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t('dashboard.lowStock')}
            subtitle={t('dashboard.lowStockSubtitle')}
            action={
              <Link to="/products?lowStock=true" className="text-xs font-semibold text-gold-700 hover:text-gold-800">
                {t('dashboard.viewAll')}
              </Link>
            }
          />
          {data.lists.lowStock.length === 0 ? (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title={t('dashboard.allProductsHealthy')}
              description={t('dashboard.allProductsHealthyDesc')}
            />
          ) : (
            <div className="divide-y divide-ink-50">
              {data.lists.lowStock.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink-800">{p.name}</p>
                    <p className="text-[10px] text-ink-400">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-amber-600">{t('dashboard.left', { count: p.stockQuantity })}</p>
                    <p className="text-[10px] text-ink-400">{t('dashboard.min', { count: p.minStockLevel })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={t('dashboard.recentOrders')}
            subtitle={t('dashboard.recentOrdersSubtitle')}
            action={
              <Link to="/orders" className="text-xs font-semibold text-gold-700 hover:text-gold-800">
                {t('dashboard.allOrders')}
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{t('dashboard.order')}</th>
                  <th>{t('dashboard.customer')}</th>
                  <th>{t('dashboard.status')}</th>
                  <th className="text-right">{t('dashboard.total')}</th>
                </tr>
              </thead>
              <tbody>
                {data.lists.recentOrders.slice(0, 6).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link to={`/orders/${o.id}`} className="font-semibold text-ink-900 hover:text-gold-700">
                        {o.orderNumber}
                      </Link>
                      <p className="text-[10px] text-ink-400">{formatDate(o.orderDate)}</p>
                    </td>
                    <td className="text-xs">{o.customer?.fullName ?? '—'}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="text-right text-xs font-semibold">{formatCurrency(o.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={t('dashboard.recentConversations')}
            subtitle={t('dashboard.recentConversationsSubtitle')}
            action={
              <Link to="/inbox" className="text-xs font-semibold text-gold-700 hover:text-gold-800">
                {t('dashboard.openInbox')}
              </Link>
            }
          />
          <div className="divide-y divide-ink-50">
            {data.lists.recentConversations.map((c) => (
              <Link key={c.id} to="/inbox" className="flex items-start gap-3 px-5 py-3 transition hover:bg-gold-50/50">
                <Avatar name={c.customer?.fullName} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-ink-800">{c.customer?.fullName ?? c.whatsappPhone}</p>
                    <span className="shrink-0 text-[10px] text-ink-400">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-400">{c.lastMessagePreview || t('dashboard.noMessages')}</p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-500 px-1.5 text-[10px] font-bold text-ink-900">
                    {c.unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={t('dashboard.mostRequested')} subtitle={t('dashboard.mostRequestedSubtitle')} />
          <div className="space-y-3.5 px-5 py-4">
            {data.charts.interestPopularity.slice(0, 6).map((p, i) => (
              <div key={p.productId}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="truncate pr-3 font-medium text-ink-700">{p.name}</span>
                  <span className="shrink-0 font-semibold text-ink-900">{p.interests}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600"
                    style={{ width: `${Math.max(8, (p.interests / interestMax) * 100)}%`, opacity: 1 - i * 0.08 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-ink-900 p-5 text-white">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-500/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-gold-400">
              <Activity className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-wider">{t('dashboard.businessPulse')}</p>
            </div>
            <p className="mt-1.5 text-xs text-ink-400">{t('dashboard.businessPulseSubtitle')}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-inset ring-white/10">
                <p className="text-[10px] uppercase tracking-wider text-ink-400">{t('dashboard.pendingTasks')}</p>
                <p className="mt-1 text-lg font-semibold text-white">{Number(stats.pendingTasks ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-inset ring-white/10">
                <p className="text-[10px] uppercase tracking-wider text-ink-400">{t('dashboard.overdue')}</p>
                <p className="mt-1 text-lg font-semibold text-red-400">{Number(stats.overdueTasks ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-inset ring-white/10">
                <p className="text-[10px] uppercase tracking-wider text-ink-400">{t('dashboard.lowStock')}</p>
                <p className="mt-1 text-lg font-semibold text-amber-300">{data.lists.lowStock.length}</p>
              </div>
              <div className="rounded-xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-inset ring-white/10">
                <p className="text-[10px] uppercase tracking-wider text-ink-400">{t('dashboard.birthdays')}</p>
                <p className="mt-1 text-lg font-semibold text-gold-300">{data.lists.birthdays.length}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/10">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-400">{t('dashboard.monthlySales')}</p>
                <p className="font-display text-base font-semibold text-gold-300">{formatCurrency(Number(stats.monthlySales))}</p>
              </div>
              <Link to="/reports" className="inline-flex items-center gap-1 text-[11px] font-semibold text-gold-400 hover:text-gold-300">
                {t('dashboard.view')} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
