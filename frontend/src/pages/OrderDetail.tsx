import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CreditCard, MessageCircle, Package, Receipt } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { ApiResponse, Order } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  PageLoader,
  Select,
  StatusBadge,
  Textarea,
} from '../components/ui';

const NEXT_STATUSES = ['NEW', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'READY_FOR_COLLECTION', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];

export function OrderDetailPage() {
  const { tr, enumLabel } = useLanguage();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payment, setPayment] = useState({ amount: '', method: 'MOBILE_MONEY', reference: '', notes: '' });
  const [status, setStatus] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Order>>(`/orders/${id}`);
      return res.data.data;
    },
    enabled: Boolean(id),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['order', id] });
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const updateStatus = useMutation({
    mutationFn: async (nextStatus: string) => api.patch(`/orders/${id}/status`, { status: nextStatus }),
    onSuccess: () => {
      toast.success(tr('Order status updated', 'Hali ya agizo imesasishwa'));
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const recordPayment = useMutation({
    mutationFn: async () =>
      api.post(`/orders/${id}/payments`, {
        amount: Number(payment.amount),
        method: payment.method,
        reference: payment.reference || undefined,
        notes: payment.notes || undefined,
      }),
    onSuccess: () => {
      toast.success(tr('Payment recorded', 'Malipo yamerekodiwa'));
      setPaymentOpen(false);
      setPayment({ amount: '', method: 'MOBILE_MONEY', reference: '', notes: '' });
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (isLoading) return <PageLoader label={tr('Loading order…', 'Inapakia agizo…')} />;
  if (!order) return <EmptyState title={tr('Order not found', 'Agizo halikupatikana')} description={tr('This order may have been deleted.', 'Huenda agizo hili limefutwa.')} />;

  const balance = Number(order.totalAmount) - Number(order.amountPaid);

  return (
    <div className="animate-fade-in">
      <Link to="/orders" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" /> {tr('Back to orders', 'Rudi kwenye maagizo')}
      </Link>

      <Card className="mb-4 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-ink-900">{order.orderNumber}</h1>
              <StatusBadge status={order.status} />
              <StatusBadge status={order.paymentStatus} />
              {order.needsReview && <Badge tone="amber">{tr('Needs review', 'Inahitaji kukaguliwa')}</Badge>}
            </div>
            <p className="mt-1 text-xs text-ink-400">
              {tr('Created', 'Imeundwa')} {formatDate(order.createdAt, true)} · {tr('Source', 'Chanzo')} {enumLabel(order.source)}
            </p>
            <Link to={`/customers/${order.customerId}`} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 transition hover:bg-gold-50">
              <div>
                <p className="text-xs font-semibold text-ink-900">{order.customer?.fullName}</p>
                <p className="text-[10px] text-ink-400">
                  {order.customer?.customerCode} · {order.customer?.phone}
                </p>
              </div>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              value={status || order.status}
              onChange={(e) => {
                setStatus(e.target.value);
                const next = e.target.value;
                if (next !== order.status) updateStatus.mutate(next);
              }}
              className="w-56"
            >
              {NEXT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {enumLabel(s)}
                </option>
              ))}
            </Select>
            <Button variant="secondary" leftIcon={<MessageCircle className="h-4 w-4" />} onClick={() => (window.location.href = '/inbox')}>
              {tr('Inbox', 'Kikasha')}
            </Button>
            <Button leftIcon={<CreditCard className="h-4 w-4" />} onClick={() => setPaymentOpen(true)}>
              {tr('Record payment', 'Rekodi malipo')}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader
              title={tr('Order items', 'Bidhaa za agizo')}
              subtitle={tr(`${order.items?.length ?? 0} line item(s)`, `${order.items?.length ?? 0} bidhaa`)}
            />
            {!order.items || order.items.length === 0 ? (
              <EmptyState icon={<Package className="h-6 w-6" />} title={tr('No items', 'Hakuna bidhaa')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>{tr('Product', 'Bidhaa')}</th>
                      <th className="text-right">{tr('Unit price', 'Bei ya kitengo')}</th>
                      <th className="text-center">{tr('Qty', 'Idadi')}</th>
                      <th className="text-right">{tr('Line total', 'Jumla ya mstari')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <p className="text-sm font-medium text-ink-800">{item.productName}</p>
                          {item.product?.sku && <p className="text-[10px] text-ink-400">{item.product.sku}</p>}
                        </td>
                        <td className="text-right text-xs">{formatCurrency(item.unitPrice)}</td>
                        <td className="text-center text-xs font-semibold">{item.quantity}</td>
                        <td className="text-right text-xs font-semibold text-ink-900">{formatCurrency(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title={tr('Payment history', 'Historia ya malipo')}
              subtitle={tr('All payments received against this order', 'Malipo yote yaliyopokelewa kwa agizo hili')}
            />
            {!order.payments || order.payments.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title={tr('No payments recorded', 'Hakuna malipo yaliyorekodiwa')}
                description={tr('Record a payment when the customer pays.', 'Rekodi malipo wakati mteja anapolipa.')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>{tr('Date', 'Tarehe')}</th>
                      <th>{tr('Method', 'Njia')}</th>
                      <th>{tr('Reference', 'Kumbukumbu')}</th>
                      <th className="text-right">{tr('Amount', 'Kiasi')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="text-xs text-ink-500">{formatDate(p.paidAt, true)}</td>
                        <td>
                          <Badge tone="gray">{enumLabel(p.method)}</Badge>
                        </td>
                        <td className="text-xs text-ink-500">{p.reference || '—'}</td>
                        <td className="text-right text-xs font-semibold text-emerald-600">{formatCurrency(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {order.notes && (
            <Card className="p-5">
              <p className="label">{tr('Order notes', 'Maelezo ya agizo')}</p>
              <p className="text-sm text-ink-600">{order.notes}</p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{tr('Payment summary', 'Muhtasari wa malipo')}</p>
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-500">{tr('Subtotal', 'Jumla ndogo')}</span>
                <span className="font-medium text-ink-800">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">{tr('Discount', 'Punguzo')}</span>
                <span className="font-medium text-ink-800">− {formatCurrency(order.discount)}</span>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-2.5">
                <span className="font-semibold text-ink-900">{tr('Total', 'Jumla')}</span>
                <span className="font-display text-lg font-semibold text-ink-900">{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">{tr('Paid', 'Imelipwa')}</span>
                <span className="font-medium text-emerald-600">{formatCurrency(order.amountPaid)}</span>
              </div>
              <div className="flex justify-between rounded-xl bg-ink-50 px-3 py-2">
                <span className="text-xs font-semibold text-ink-600">{tr('Balance', 'Salio')}</span>
                <span className={`text-sm font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(balance)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{tr('Timeline', 'Mtiririko wa matukio')}</p>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <p className="text-ink-400">{tr('Order created', 'Agizo limeundwa')}</p>
                <p className="font-medium text-ink-800">{formatDate(order.createdAt, true)}</p>
              </div>
              {order.confirmedAt && (
                <div>
                  <p className="text-ink-400">{tr('Confirmed', 'Imethibitishwa')}</p>
                  <p className="font-medium text-ink-800">{formatDate(order.confirmedAt, true)}</p>
                </div>
              )}
              {order.deliveredAt && (
                <div>
                  <p className="text-ink-400">{tr('Delivered', 'Imewasilishwa')}</p>
                  <p className="font-medium text-ink-800">{formatDate(order.deliveredAt, true)}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title={tr('Record payment', 'Rekodi malipo')}
        subtitle={tr(`Outstanding balance ${formatCurrency(balance)}`, `Salio linalodaiwa ${formatCurrency(balance)}`)}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button loading={recordPayment.isPending} disabled={!payment.amount} onClick={() => recordPayment.mutate()}>
              {tr('Record payment', 'Rekodi malipo')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label={tr('Amount (TZS)', 'Kiasi (TZS)')}
            type="number"
            value={payment.amount}
            onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
            placeholder={String(Math.max(0, balance))}
          />
          <Select label={tr('Method', 'Njia')} value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
            <option value="MOBILE_MONEY">{enumLabel('MOBILE_MONEY')}</option>
            <option value="CASH">{enumLabel('CASH')}</option>
            <option value="BANK_TRANSFER">{enumLabel('BANK_TRANSFER')}</option>
            <option value="CARD">{enumLabel('CARD')}</option>
            <option value="OTHER">{enumLabel('OTHER')}</option>
          </Select>
          <Input
            label={tr('Reference', 'Kumbukumbu')}
            value={payment.reference}
            onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
            placeholder={tr('Transaction reference (optional)', 'Kumbukumbu ya muamala (si lazima)')}
          />
          <Textarea label={tr('Notes', 'Maelezo')} value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
