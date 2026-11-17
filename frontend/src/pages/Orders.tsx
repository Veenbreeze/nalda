import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ClipboardList, Plus, Search, Trash2 } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { ApiResponse, Customer, Order, Paginated, Product } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  Pagination,
  Select,
  StatusBadge,
  Textarea,
} from '../components/ui';

const ORDER_STATUSES = ['NEW', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PROCESSING', 'READY_FOR_COLLECTION', 'DISPATCHED', 'DELIVERED', 'CANCELLED'];

export function OrdersPage() {
  const { tr, enumLabel } = useLanguage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [source, setSource] = useState('WHATSAPP');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: string }[]>([{ productId: '', quantity: '1' }]);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { page, search, status, paymentStatus }],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Order[]> & Paginated<Order>>('/orders', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          status: status || undefined,
          paymentStatus: paymentStatus || undefined,
        },
      });
      return res.data;
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', 'all-for-order'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Customer[]>>('/customers', { params: { limit: 200, status: 'ACTIVE' } });
      return res.data.data;
    },
    enabled: modalOpen,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', 'all-for-order'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product[]>>('/products', { params: { limit: 200, status: 'ACTIVE' } });
      return res.data.data;
    },
    enabled: modalOpen,
  });

  const createOrder = useMutation({
    mutationFn: async () => {
      const payloadItems = items
        .filter((i) => i.productId && Number(i.quantity) > 0)
        .map((i) => {
          const product = products.find((p) => p.id === i.productId);
          return {
            productId: i.productId,
            productName: product?.name,
            quantity: Number(i.quantity),
            unitPrice: product ? Number(product.sellingPrice) : undefined,
          };
        });
      return api.post('/orders', {
        customerId,
        source,
        items: payloadItems,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      toast.success(tr('Order created', 'Agizo limeundwa'));
      setModalOpen(false);
      setCustomerId('');
      setItems([{ productId: '', quantity: '1' }]);
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const estimatedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      return sum + (product ? Number(product.sellingPrice) * Number(item.quantity || 0) : 0);
    }, 0);
  }, [items, products]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      toast.error(tr('Select a customer', 'Chagua mteja'));
      return;
    }
    if (!items.some((i) => i.productId)) {
      toast.error(tr('Add at least one product', 'Ongeza angalau bidhaa moja'));
      return;
    }
    createOrder.mutate();
  };

  const orders = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tr('Orders', 'Maagizo')}
        subtitle={tr(
          'Track WhatsApp drafts, confirmations, payments and deliveries.',
          'Fuatilia rasimu za WhatsApp, uthibitisho, malipo na uwasilishaji.',
        )}
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
            {tr('New order', 'Agizo jipya')}
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={tr('Search by order number or customer…', 'Tafuta kwa namba ya agizo au mteja…')}
              className="input-base pl-9"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="sm:w-52"
          >
            <option value="">{tr('All statuses', 'Hali zote')}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {enumLabel(s)}
              </option>
            ))}
          </Select>
          <Select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
            className="sm:w-44"
          >
            <option value="">{tr('All payments', 'Malipo yote')}</option>
            <option value="UNPAID">{enumLabel('UNPAID')}</option>
            <option value="PARTIALLY_PAID">{enumLabel('PARTIALLY_PAID')}</option>
            <option value="PAID">{enumLabel('PAID')}</option>
            <option value="REFUNDED">{enumLabel('REFUNDED')}</option>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <PageLoader label={tr('Loading orders…', 'Inapakia maagizo…')} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title={tr('No orders found', 'Hakuna maagizo yaliyopatikana')}
            description={tr(
              'Orders from WhatsApp and manual entry will appear here.',
              'Maagizo kutoka WhatsApp na yaliyoingizwa kwa mkono yataonekana hapa.',
            )}
            action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>{tr('New order', 'Agizo jipya')}</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>{tr('Order', 'Agizo')}</th>
                    <th>{tr('Customer', 'Mteja')}</th>
                    <th>{tr('Source', 'Chanzo')}</th>
                    <th>{tr('Status', 'Hali')}</th>
                    <th>{tr('Payment', 'Malipo')}</th>
                    <th className="text-right">{tr('Total', 'Jumla')}</th>
                    <th>{tr('Date', 'Tarehe')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`} className="font-semibold text-ink-900 hover:text-gold-700">
                          {o.orderNumber}
                        </Link>
                        {o.needsReview && (
                          <span className="ml-2">
                            <Badge tone="amber">{tr('Review', 'Kagua')}</Badge>
                          </span>
                        )}
                      </td>
                      <td>
                        <p className="text-xs font-medium text-ink-800">{o.customer?.fullName ?? '—'}</p>
                        <p className="text-[10px] text-ink-400">{o.customer?.phone}</p>
                      </td>
                      <td>
                        <Badge tone="gray">{enumLabel(o.source)}</Badge>
                      </td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>
                        <StatusBadge status={o.paymentStatus} />
                      </td>
                      <td className="text-right">
                        <p className="text-xs font-semibold text-ink-900">{formatCurrency(o.totalAmount)}</p>
                        <p className="text-[10px] text-ink-400">{tr(`${o.items?.length ?? 0} item(s)`, `${o.items?.length ?? 0} bidhaa`)}</p>
                      </td>
                      <td className="text-xs text-ink-500">{formatDate(o.orderDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination && (
              <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} onChange={setPage} />
            )}
          </>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tr('New order', 'Agizo jipya')}
        subtitle={tr(
          'Create an order manually or prepare one captured outside WhatsApp.',
          'Unda agizo kwa mkono au andaa agizo lililorekodiwa nje ya WhatsApp.',
        )}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button type="submit" form="order-form" loading={createOrder.isPending}>
              {tr('Create order', 'Unda agizo')}
            </Button>
          </>
        }
      >
        <form id="order-form" onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label={tr('Customer', 'Mteja')}
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">{tr('Select customer', 'Chagua mteja')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} · {c.phone}
                </option>
              ))}
            </Select>
            <Select label={tr('Source', 'Chanzo')} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="WHATSAPP">{enumLabel('WHATSAPP')}</option>
              <option value="MANUAL">{enumLabel('MANUAL')}</option>
              <option value="INSTAGRAM">{enumLabel('INSTAGRAM')}</option>
              <option value="PHONE">{enumLabel('PHONE')}</option>
              <option value="WALK_IN">{enumLabel('WALK_IN')}</option>
              <option value="REFERRAL">{enumLabel('REFERRAL')}</option>
            </Select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="label mb-0">{tr('Order items', 'Bidhaa za agizo')}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setItems([...items, { productId: '', quantity: '1' }])}
              >
                {tr('Add item', 'Ongeza bidhaa')}
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => {
                const product = products.find((p) => p.id === item.productId);
                return (
                  <div key={index} className="flex flex-col gap-2 rounded-xl border border-ink-100 p-3 sm:flex-row sm:items-center">
                    <Select
                      value={item.productId}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = { ...next[index], productId: e.target.value };
                        setItems(next);
                      }}
                      className="flex-1"
                    >
                      <option value="">{tr('Select product', 'Chagua bidhaa')}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {formatCurrency(p.sellingPrice)}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = { ...next[index], quantity: e.target.value };
                        setItems(next);
                      }}
                      className="sm:w-24"
                      placeholder={tr('Qty', 'Idadi')}
                    />
                    <div className="flex items-center justify-between gap-2 sm:w-40">
                      <span className="text-xs font-semibold text-ink-700">
                        {formatCurrency(product ? Number(product.sellingPrice) * Number(item.quantity || 0) : 0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, i) => i !== index))}
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={tr('Remove item', 'Ondoa bidhaa')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-50 px-4 py-2.5">
              <span className="text-xs font-semibold text-ink-500">{tr('Estimated total', 'Jumla inayokadiriwa')}</span>
              <span className="font-display text-lg font-semibold text-ink-900">{formatCurrency(estimatedTotal)}</span>
            </div>
          </div>

          <Textarea
            label={tr('Notes', 'Maelezo')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr(
              'Delivery instructions, discount agreement, follow-up notes…',
              'Maelekezo ya uwasilishaji, makubaliano ya punguzo, maelezo ya ufuatiliaji…',
            )}
          />
        </form>
      </Modal>
    </div>
  );
}
