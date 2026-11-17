import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClipboardList, Coins, Download, FileSpreadsheet, TrendingUp, UserPlus, XCircle } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { ApiResponse } from '../types';
import { downloadBlob, formatCurrency, formatDate, formatNumber } from '../lib/utils';
import { Button, Card, CardHeader, EmptyState, Input, PageHeader, PageLoader, StatCard } from '../components/ui';
import { useLanguage } from '../i18n/LanguageContext';

interface ReportData {
  range: { from: string; to: string };
  sales: {
    totalSales: number;
    totalOrders: number;
    cancelledOrders: number;
    averageOrderValue: number;
    byDay: { date: string; total: number; orders: number }[];
    byCategory: { category: string; total: number; quantity: number }[];
    topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
  };
  customers: {
    totalCustomers: number;
    newCustomers: number;
    byLocation: { location: string; count: number }[];
    bySource: { source: string; count: number }[];
    topCustomers: { id: string; fullName: string; customerCode: string; totalSpent: string | number; totalOrders: number; location?: string | null }[];
  };
  products: {
    lowStock: { id: string; name: string; stockQuantity: number; minStockLevel: number }[];
    mostRequested: { productId: string; name: string; interests: number }[];
  };
  whatsapp: { received: number; sent: number; byStatus: { status: string; count: number }[] };
}

const COLORS = ['#C9A227', '#1A1A1A', '#7C6A2E', '#C9B458', '#3F3F3F', '#E3CD7A', '#8C8C8C'];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const { tr, enumLabel } = useLanguage();
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 11, 1);
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [exporting, setExporting] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', from, to],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ReportData>>('/reports', { params: { from, to } });
      return res.data.data;
    },
  });

  const exportData = async (path: string, filename: string, key: string) => {
    setExporting(key);
    try {
      const res = await api.get(path, { params: { format: 'XLSX' }, responseType: 'blob' });
      downloadBlob(res.data as Blob, filename);
      toast.success(tr('Export downloaded', 'Utoaji umepakuliwa'));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tr('Reports & analytics', 'Ripoti na uchambuzi')}
        subtitle={tr(
          'Understand performance by period, category, customer and channel.',
          'Elewa utendaji kwa kipindi, kategoria, mteja na njia.',
        )}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              leftIcon={<Download className="h-4 w-4" />}
              loading={exporting === 'orders'}
              onClick={() => exportData('/exports/orders', 'nalda-orders.xlsx', 'orders')}
            >
              {tr('Orders', 'Maagizo')}
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Download className="h-4 w-4" />}
              loading={exporting === 'products'}
              onClick={() => exportData('/exports/products', 'nalda-products.xlsx', 'products')}
            >
              {tr('Products', 'Bidhaa')}
            </Button>
            <Button
              leftIcon={<FileSpreadsheet className="h-4 w-4" />}
              loading={exporting === 'customers'}
              onClick={() => exportData('/exports/customers', 'nalda-customers.xlsx', 'customers')}
            >
              {tr('Export customers', 'Toa wateja')}
            </Button>
          </div>
        }
      />

      <Card className="mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <Input
          label={tr('From', 'Kutoka')}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="sm:w-48"
        />
        <Input
          label={tr('To', 'Mpaka')}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="sm:w-48"
        />
        <p className="pb-2.5 text-xs text-ink-400">
          {formatDate(from)} — {formatDate(to)}
        </p>
      </Card>

      {isLoading || !data ? (
        <Card>
          <PageLoader label={tr('Building report…', 'Inatengeneza ripoti…')} />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label={tr('Revenue', 'Mapato')} value={formatCurrency(data.sales.totalSales)} icon={<TrendingUp className="h-4 w-4" />} />
            <StatCard label={tr('Orders', 'Maagizo')} value={formatNumber(data.sales.totalOrders)} icon={<ClipboardList className="h-4 w-4" />} />
            <StatCard label={tr('Avg. order value', 'Wastani wa thamani ya agizo')} value={formatCurrency(data.sales.averageOrderValue)} icon={<Coins className="h-4 w-4" />} />
            <StatCard label={tr('New customers', 'Wateja wapya')} value={formatNumber(data.customers.newCustomers)} icon={<UserPlus className="h-4 w-4" />} />
            <StatCard label={tr('Cancelled orders', 'Maagizo yaliyoghairiwa')} value={formatNumber(data.sales.cancelledOrders)} icon={<XCircle className="h-4 w-4" />} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title={tr('Sales over time', 'Mauzo kwa muda')}
                subtitle={tr('Revenue per day in the selected range.', 'Mapato kwa siku katika kipindi kilichochaguliwa.')}
              />
              <div className="h-72 px-3 pb-4">
                {data.sales.byDay.length === 0 ? (
                  <EmptyState title={tr('No sales in this period', 'Hakuna mauzo katika kipindi hiki')} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.sales.byDay} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EFEAE0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8C8C8C' }} tickFormatter={(v) => String(v).slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: '#8C8C8C' }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                      <Line type="monotone" dataKey="total" stroke="#C9A227" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title={tr('Category mix', 'Mchanganyiko wa kategoria')}
                subtitle={tr('Revenue share by category.', 'Sehemu ya mapato kwa kategoria.')}
              />
              <div className="h-72 px-3 pb-4">
                {data.sales.byCategory.length === 0 ? (
                  <EmptyState title={tr('No category sales', 'Hakuna mauzo ya kategoria')} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.sales.byCategory} dataKey="total" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={2}>
                        {data.sales.byCategory.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title={tr('Top products', 'Bidhaa zinazoongoza')}
                subtitle={tr('Best sellers in the selected period.', 'Bidhaa zinazouzwa zaidi katika kipindi kilichochaguliwa.')}
              />
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>{tr('Product', 'Bidhaa')}</th>
                      <th>{tr('Units', 'Idadi')}</th>
                      <th>{tr('Revenue', 'Mapato')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sales.topProducts.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center text-xs text-ink-400">
                          {tr('No product sales yet.', 'Bado hakuna mauzo ya bidhaa.')}
                        </td>
                      </tr>
                    )}
                    {data.sales.topProducts.map((p) => (
                      <tr key={p.productId}>
                        <td className="text-xs font-medium text-ink-800">{p.name}</td>
                        <td className="text-xs">{formatNumber(p.quantity)}</td>
                        <td className="text-xs font-semibold">{formatCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHeader
                title={tr('Top customers', 'Wateja wanaoongoza')}
                subtitle={tr('Lifetime value leaders.', 'Wanaoongoza kwa thamani ya muda wote.')}
              />
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>{tr('Customer', 'Mteja')}</th>
                      <th>{tr('Orders', 'Maagizo')}</th>
                      <th>{tr('Spent', 'Alitumia')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers.topCustomers.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <p className="text-xs font-medium text-ink-800">{c.fullName}</p>
                          <p className="text-[10px] text-ink-400">{c.customerCode}</p>
                        </td>
                        <td className="text-xs">{formatNumber(c.totalOrders)}</td>
                        <td className="text-xs font-semibold">{formatCurrency(Number(c.totalSpent))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title={tr('Customers by location', 'Wateja kwa eneo')} />
              <div className="h-64 px-3 pb-4">
                {data.customers.byLocation.length === 0 ? (
                  <EmptyState title={tr('No location data', 'Hakuna data ya eneo')} />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.customers.byLocation.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EFEAE0" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#8C8C8C' }} />
                      <YAxis type="category" dataKey="location" width={90} tick={{ fontSize: 10, fill: '#8C8C8C' }} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                      <Bar dataKey="count" fill="#C9A227" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title={tr('Most requested', 'Zinazoombwa zaidi')}
                subtitle={tr('Interest signals to guide stocking.', 'Vipimo vya nia kuelekeza uhifadhi wa bidhaa.')}
              />
              <div className="divide-y divide-ink-50">
                {data.products.mostRequested.length === 0 && (
                  <p className="px-4 py-4 text-xs text-ink-400">{tr('No interest data yet.', 'Bado hakuna data ya nia.')}</p>
                )}
                {data.products.mostRequested.slice(0, 8).map((p) => (
                  <div key={p.productId} className="flex items-center justify-between px-4 py-2.5">
                    <p className="truncate text-xs text-ink-700">{p.name}</p>
                    <span className="text-[11px] font-semibold text-gold-700">{p.interests}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                title={tr('WhatsApp activity', 'Shughuli za WhatsApp')}
                subtitle={tr('Messages in the selected period.', 'Ujumbe katika kipindi kilichochaguliwa.')}
              />
              <div className="space-y-3 px-4 py-4">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5">
                  <span className="text-xs text-emerald-800">{tr('Received', 'Zilizopokelewa')}</span>
                  <span className="text-sm font-bold text-emerald-700">{formatNumber(data.whatsapp.received)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gold-50 px-3 py-2.5">
                  <span className="text-xs text-gold-800">{tr('Sent', 'Zilizotumwa')}</span>
                  <span className="text-sm font-bold text-gold-700">{formatNumber(data.whatsapp.sent)}</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {data.whatsapp.byStatus.map((s) => (
                    <div key={s.status} className="flex items-center justify-between text-[11px]">
                      <span className="text-ink-500">{enumLabel(s.status)}</span>
                      <span className="font-semibold text-ink-800">{formatNumber(s.count)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
