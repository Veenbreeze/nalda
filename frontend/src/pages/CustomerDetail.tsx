import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Calendar,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  StickyNote,
} from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { Activity, ApiResponse, Customer, Message, Order, Product, ProductInterest } from '../types';
import { formatCurrency, formatDate, timeAgo } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Avatar,
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
  Tabs,
  Textarea,
} from '../components/ui';

interface CustomerDetail {
  customer: Customer & {
    orders: Order[];
    activities: Activity[];
    notesList: { id: string; body: string; createdAt: string; admin?: { fullName: string } | null }[];
    conversations: { id: string; whatsappPhone: string; lastMessagePreview?: string | null; lastMessageAt?: string | null }[];
  };
  summary: { totalOrders: number; totalSpent: number; lastPurchaseAt?: string | null };
}

interface TimelineItem extends Partial<Activity> {
  kind: 'activity' | 'message';
  direction?: string;
  body?: string | null;
}

const CUSTOMER_SOURCES = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'REFERRAL', 'WALK_IN', 'IMPORT', 'MANUAL', 'OTHER'];

interface EditCustomerForm {
  fullName: string;
  phone: string;
  whatsappPhone: string;
  alternatePhone: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  location: string;
  physicalAddress: string;
  source: string;
  status: string;
  notes: string;
  marketingConsent: boolean;
  whatsappOptIn: boolean;
}

const emptyEditForm: EditCustomerForm = {
  fullName: '',
  phone: '',
  whatsappPhone: '',
  alternatePhone: '',
  email: '',
  gender: 'UNSPECIFIED',
  dateOfBirth: '',
  location: '',
  physicalAddress: '',
  source: 'WHATSAPP',
  status: 'ACTIVE',
  notes: '',
  marketingConsent: true,
  whatsappOptIn: true,
};

export function CustomerDetailPage() {
  const { tr, enumLabel } = useLanguage();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [note, setNote] = useState('');
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [interestOpen, setInterestOpen] = useState(false);
  const [interestForm, setInterestForm] = useState({ productId: '', interestLevel: 'HIGH', source: 'MANUAL' });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditCustomerForm>(emptyEditForm);

  const { data, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CustomerDetail>>(`/customers/${id}`);
      return res.data.data;
    },
    enabled: Boolean(id),
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ['customer-timeline', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<TimelineItem[]>>(`/customers/${id}/timeline`);
      return res.data.data;
    },
    enabled: Boolean(id),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', 'all-for-interest'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product[]>>('/products', { params: { limit: 200, status: 'ACTIVE' } });
      return res.data.data;
    },
    enabled: interestOpen,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['customer', id] });
    void queryClient.invalidateQueries({ queryKey: ['customer-timeline', id] });
  };

  const addNote = useMutation({
    mutationFn: async () => api.post(`/customers/${id}/notes`, { body: note }),
    onSuccess: () => {
      toast.success(tr('Note added', 'Kumbuka limeongezwa'));
      setNote('');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const sendMessage = useMutation({
    mutationFn: async () => api.post('/whatsapp/send', { customerId: id, body: message }),
    onSuccess: () => {
      toast.success(tr('WhatsApp message queued', 'Ujumbe wa WhatsApp umejipanga'));
      setMessage('');
      setMessageOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const addInterest = useMutation({
    mutationFn: async () =>
      api.post(`/customers/${id}/interests`, {
        productId: interestForm.productId,
        interestLevel: interestForm.interestLevel,
        source: interestForm.source,
      }),
    onSuccess: () => {
      toast.success(tr('Product interest recorded', 'Nia ya bidhaa imerekodiwa'));
      setInterestOpen(false);
      setInterestForm({ productId: '', interestLevel: 'HIGH', source: 'MANUAL' });
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const updateCustomer = useMutation({
    mutationFn: async () =>
      api.patch(`/customers/${id}`, {
        fullName: editForm.fullName.trim(),
        phone: editForm.phone.trim(),
        whatsappPhone: editForm.whatsappPhone.trim() || null,
        alternatePhone: editForm.alternatePhone.trim() || null,
        email: editForm.email.trim() || null,
        gender: editForm.gender,
        dateOfBirth: editForm.dateOfBirth || null,
        location: editForm.location.trim() || null,
        physicalAddress: editForm.physicalAddress.trim() || null,
        source: editForm.source,
        status: editForm.status,
        notes: editForm.notes.trim() || null,
        marketingConsent: editForm.marketingConsent,
        whatsappOptIn: editForm.whatsappOptIn,
      }),
    onSuccess: () => {
      toast.success(tr('Customer details updated', 'Maelezo ya mteja yamesasishwa'));
      setEditOpen(false);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const stats = useMemo(() => {
    if (!data) return null;
    return {
      spent: data.summary.totalSpent,
      orders: data.summary.totalOrders,
      interests: data.customer.interests?.length ?? 0,
      last: data.summary.lastPurchaseAt,
    };
  }, [data]);

  if (isLoading) return <PageLoader label={tr('Loading customer profile…', 'Inapakia wasifu wa mteja…')} />;
  if (!data) return <EmptyState title={tr('Customer not found', 'Mteja hakupatikana')} description={tr('This customer may have been deleted.', 'Huenda mteja huyu amefutwa.')} />;

  const c = data.customer;

  const openEdit = () => {
    setEditForm({
      fullName: c.fullName,
      phone: c.phone,
      whatsappPhone: c.whatsappPhone ?? '',
      alternatePhone: c.alternatePhone ?? '',
      email: c.email ?? '',
      gender: c.gender ?? 'UNSPECIFIED',
      dateOfBirth: c.dateOfBirth ? String(c.dateOfBirth).slice(0, 10) : '',
      location: c.location ?? '',
      physicalAddress: c.physicalAddress ?? '',
      source: c.source,
      status: c.status,
      notes: c.notes ?? '',
      marketingConsent: c.marketingConsent,
      whatsappOptIn: c.whatsappOptIn,
    });
    setEditOpen(true);
  };

  return (
    <div className="animate-fade-in">
      <Link to="/customers" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" /> {tr('Back to customers', 'Rudi kwa wateja')}
      </Link>

      <Card className="mb-4 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-ink-900 via-ink-800 to-ink-700" />
        <div className="px-5 pb-5">
          <div className="-mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar name={c.fullName} size="lg" className="h-16 w-16 border-4 border-white text-xl shadow-card" />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-semibold text-ink-900">{c.fullName}</h1>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-0.5 text-xs text-ink-400">
                  {c.customerCode} · {tr('Joined', 'Alijiunga')} {formatDate(c.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" leftIcon={<Pencil className="h-4 w-4" />} onClick={openEdit}>
                {tr('Edit details', 'Hariri maelezo')}
              </Button>
              <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setInterestOpen(true)}>
                {tr('Add interest', 'Ongeza nia')}
              </Button>
              <Button leftIcon={<MessageCircle className="h-4 w-4" />} onClick={() => setMessageOpen(true)}>
                WhatsApp
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [tr('Lifetime spend', 'Matumizi ya jumla'), formatCurrency(stats?.spent ?? 0)],
              [tr('Orders', 'Maagizo'), String(stats?.orders ?? 0)],
              [tr('Product interests', 'Nia za bidhaa'), String(stats?.interests ?? 0)],
              [tr('Last purchase', 'Ununuzi wa mwisho'), formatDate(stats?.last)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-ink-50/70 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
                <p className="mt-1 text-sm font-semibold text-ink-900">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Tabs
        className="mb-4 w-full sm:w-auto"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: tr('Overview', 'Muhtasari') },
          { value: 'orders', label: tr('Orders', 'Maagizo'), count: c.orders.length },
          { value: 'interests', label: tr('Interests', 'Nia'), count: c.interests?.length ?? 0 },
          { value: 'timeline', label: tr('Timeline', 'Mfuatano'), count: timeline.length },
          { value: 'notes', label: tr('Notes', 'Maelezo'), count: c.notesList.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader title={tr('Contact details', 'Maelezo ya mawasiliano')} />
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gold-600" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-ink-400">{tr('Phone', 'Simu')}</p>
                  <p className="font-medium text-ink-800">{c.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MessageCircle className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-ink-400">WhatsApp</p>
                  <p className="font-medium text-ink-800">{c.whatsappPhone || c.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-ink-400" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-ink-400">{tr('Email', 'Barua pepe')}</p>
                  <p className="font-medium text-ink-800">{c.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-ink-400" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-ink-400">{tr('Location', 'Mahali')}</p>
                  <p className="font-medium text-ink-800">{c.location || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-ink-400" />
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-ink-400">{tr('Last interaction', 'Mawasiliano ya mwisho')}</p>
                  <p className="font-medium text-ink-800">{formatDate(c.lastInteractionAt, true)}</p>
                </div>
              </div>
            </div>
            <div className="border-t border-ink-100 px-5 py-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-400">{tr('Tags', 'Lebo')}</p>
              <div className="flex flex-wrap gap-1.5">
                {(c.tags ?? []).length === 0 && <span className="text-xs text-ink-400">{tr('No tags yet', 'Hakuna lebo bado')}</span>}
                {(c.tags ?? []).map((t) => (
                  <Badge key={t.id} tone="gold">
                    {t.tag.name}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="border-t border-ink-100 px-5 py-4 text-xs text-ink-500">
              <div className="flex items-center justify-between py-1">
                <span>{tr('Marketing consent', 'Ridhaa ya masoko')}</span>
                <Badge tone={c.marketingConsent ? 'green' : 'gray'}>{c.marketingConsent ? tr('Yes', 'Ndiyo') : tr('No', 'Hapana')}</Badge>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>{tr('WhatsApp opt-in', 'Kukubali WhatsApp')}</span>
                <Badge tone={c.whatsappOptIn ? 'green' : 'gray'}>{c.whatsappOptIn ? tr('Yes', 'Ndiyo') : tr('No', 'Hapana')}</Badge>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>{tr('Source', 'Chanzo')}</span>
                <span className="font-medium text-ink-700">{enumLabel(c.source)}</span>
              </div>
            </div>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader title={tr('Recent activity', 'Shughuli za hivi karibuni')} subtitle={tr('Latest touchpoints across the relationship', 'Mikutano ya hivi karibuni katika mahusiano')} />
              {c.activities.length === 0 ? (
                <EmptyState title={tr('No activity yet', 'Hakuna shughuli bado')} description={tr('Interactions will appear here as they happen.', 'Mwingiliano utaonekana hapa unapotokea.')} />
              ) : (
                <div className="divide-y divide-ink-50">
                  {c.activities.slice(0, 6).map((a) => (
                    <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gold-50 text-gold-600">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-ink-800">{a.title}</p>
                        {a.description && <p className="mt-0.5 text-[11px] text-ink-400">{a.description}</p>}
                        <p className="mt-1 text-[10px] text-ink-400">{timeAgo(a.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title={tr('Add a note', 'Ongeza kumbuka')} subtitle={tr('Internal notes are visible to the NALDA team only', 'Maelezo ya ndani yanaonekana kwa timu ya NALDA pekee')} />
              <form
                className="px-5 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) addNote.mutate();
                }}
              >
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr('Write something useful about this customer…', 'Andika jambo muhimu kuhusu mteja huyu…')} />
                <div className="mt-3 flex justify-end">
                  <Button type="submit" size="sm" loading={addNote.isPending} leftIcon={<StickyNote className="h-4 w-4" />}>
                    {tr('Save note', 'Hifadhi kumbuka')}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <Card className="overflow-hidden">
          {c.orders.length === 0 ? (
            <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title={tr('No orders yet', 'Hakuna maagizo bado')} description={tr('WhatsApp orders and manual orders will appear here.', 'Maagizo ya WhatsApp na maagizo ya mkono yataonekana hapa.')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>{tr('Order', 'Agizo')}</th>
                    <th>{tr('Date', 'Tarehe')}</th>
                    <th>{tr('Items', 'Vitu')}</th>
                    <th>{tr('Status', 'Hali')}</th>
                    <th>{tr('Payment', 'Malipo')}</th>
                    <th className="text-right">{tr('Total', 'Jumla')}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link to={`/orders/${o.id}`} className="font-semibold text-ink-900 hover:text-gold-700">
                          {o.orderNumber}
                        </Link>
                      </td>
                      <td className="text-xs text-ink-500">{formatDate(o.orderDate)}</td>
                      <td className="text-xs">{o.items?.length ?? 0}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>
                        <StatusBadge status={o.paymentStatus} />
                      </td>
                      <td className="text-right text-xs font-semibold">{formatCurrency(o.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'interests' && (
        <Card>
          <CardHeader
            title={tr('Product interests', 'Nia za bidhaa')}
            subtitle={tr('Signals used for campaigns, restock alerts and follow-ups', 'Ishara zinazotumika kwa kampeni, arifa za kujaza hisa na ufuatiliaji')}
            action={<Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setInterestOpen(true)}>{tr('Add', 'Ongeza')}</Button>}
          />
          {(!c.interests || c.interests.length === 0) ? (
            <EmptyState icon={<Sparkles className="h-6 w-6" />} title={tr('No product interests', 'Hakuna nia za bidhaa')} description={tr('Add interests manually or let the WhatsApp automation detect them.', 'Ongeza nia kwa mkono au acha automatisheni ya WhatsApp izigundue.')} />
          ) : (
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {c.interests.map((i: ProductInterest) => (
                <div key={i.id} className="rounded-xl border border-ink-100 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-900">{i.product?.name ?? i.productName}</p>
                    <Badge tone={i.interestLevel === 'HIGH' ? 'red' : i.interestLevel === 'MEDIUM' ? 'amber' : 'gray'}>{enumLabel(i.interestLevel)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-400">{formatCurrency(i.product?.sellingPrice ?? 0)}</p>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-ink-400">
                    <span>{tr(`${i.inquiryCount} ${i.inquiryCount === 1 ? 'inquiry' : 'inquiries'}`, `${i.inquiryCount} maswali`)}</span>
                    <span>{timeAgo(i.lastInteractionAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'timeline' && (
        <Card>
          <CardHeader title={tr('Customer timeline', 'Mfuatano wa mteja')} subtitle={tr('Activities and WhatsApp messages merged chronologically', 'Shughuli na jumbe za WhatsApp zimeunganishwa kwa mpangilio wa wakati')} />
          {timeline.length === 0 ? (
            <EmptyState title={tr('Timeline is empty', 'Mfuatano hauna kitu')} description={tr('Notes, orders, messages and tasks will appear here.', 'Maelezo, maagizo, jumbe na kazi zitaonekana hapa.')} />
          ) : (
            <div className="space-y-0 px-5 py-4">
              {timeline.map((item, index) => (
                <div key={`${item.kind}-${item.id}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                        item.kind === 'message' ? 'bg-emerald-50 text-emerald-600' : 'bg-gold-50 text-gold-600'
                      }`}
                    >
                      {item.kind === 'message' ? <MessageCircle className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                    </span>
                    {index < timeline.length - 1 && <span className="my-1 w-px flex-1 bg-ink-100" />}
                  </div>
                  <div className="flex-1 pb-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-ink-800">
                        {item.kind === 'message' ? (item.direction === 'INBOUND' ? tr('Customer message', 'Ujumbe wa mteja') : tr('Message sent', 'Ujumbe umetumwa')) : item.title}
                      </p>
                      <span className="text-[10px] text-ink-400">{formatDate(item.createdAt, true)}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {item.kind === 'message' ? item.body || `[${item.type ? enumLabel(item.type) : tr('message', 'ujumbe')}]` : item.description || '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'notes' && (
        <Card>
          <CardHeader title={tr('Internal notes', 'Maelezo ya ndani')} subtitle={tr(`${c.notesList.length} note(s)`, `${c.notesList.length} maelezo`)} />
          <div className="divide-y divide-ink-50">
            {c.notesList.length === 0 && <EmptyState title={tr('No notes', 'Hakuna maelezo')} description={tr('Add the first internal note from the overview tab.', 'Ongeza kumbuka la kwanza la ndani kutoka kichupo cha muhtasari.')} />}
            {c.notesList.map((n) => (
              <div key={n.id} className="px-5 py-4">
                <p className="text-sm text-ink-700">{n.body}</p>
                <p className="mt-2 text-[10px] text-ink-400">
                  {n.admin?.fullName ?? tr('System', 'Mfumo')} · {formatDate(n.createdAt, true)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        title={`WhatsApp ${c.fullName}`}
        subtitle={tr(`Sending to ${c.whatsappPhone || c.phone}. Requires an approved WhatsApp session.`, `Inatuma kwa ${c.whatsappPhone || c.phone}. Inahitaji kipindi cha WhatsApp kilichoidhinishwa.`)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMessageOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button
              loading={sendMessage.isPending}
              leftIcon={<Send className="h-4 w-4" />}
              onClick={() => message.trim() && sendMessage.mutate()}
            >
              {tr('Send message', 'Tuma ujumbe')}
            </Button>
          </>
        }
      >
        <Textarea
          label={tr('Message', 'Ujumbe')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={tr('Hello! Thank you for contacting NALDA USA Products…', 'Habari! Asante kwa kuwasiliana na NALDA USA Products…')}
          rows={5}
        />
      </Modal>

      <Modal
        open={interestOpen}
        onClose={() => setInterestOpen(false)}
        title={tr('Add product interest', 'Ongeza nia ya bidhaa')}
        subtitle={tr('Record what this customer is interested in.', 'Rekodi kile mteja huyu anachovutiwa nacho.')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setInterestOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button
              loading={addInterest.isPending}
              disabled={!interestForm.productId}
              onClick={() => addInterest.mutate()}
            >
              {tr('Save interest', 'Hifadhi nia')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label={tr('Product', 'Bidhaa')}
            value={interestForm.productId}
            onChange={(e) => setInterestForm({ ...interestForm, productId: e.target.value })}
          >
            <option value="">{tr('Select a product', 'Chagua bidhaa')}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select
            label={tr('Interest level', 'Kiwango cha nia')}
            value={interestForm.interestLevel}
            onChange={(e) => setInterestForm({ ...interestForm, interestLevel: e.target.value })}
          >
            <option value="HIGH">{enumLabel('HIGH')}</option>
            <option value="MEDIUM">{enumLabel('MEDIUM')}</option>
            <option value="LOW">{enumLabel('LOW')}</option>
          </Select>
          <Select
            label={tr('Source', 'Chanzo')}
            value={interestForm.source}
            onChange={(e) => setInterestForm({ ...interestForm, source: e.target.value })}
          >
            <option value="MANUAL">{enumLabel('MANUAL')}</option>
            <option value="WHATSAPP">{enumLabel('WHATSAPP')}</option>
            <option value="ORDER">{enumLabel('ORDER')}</option>
            <option value="ADMIN_RECOMMENDATION">{enumLabel('ADMIN_RECOMMENDATION')}</option>
            <option value="IMPORT">{enumLabel('IMPORT')}</option>
          </Select>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={tr('Edit customer', 'Hariri mteja')}
        subtitle={tr('Update contact details, status and communication preferences.', 'Sasisha maelezo ya mawasiliano, hali na mapendeleo ya mawasiliano.')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button
              loading={updateCustomer.isPending}
              disabled={!editForm.fullName.trim() || !editForm.phone.trim()}
              onClick={() => updateCustomer.mutate()}
            >
              {tr('Save changes', 'Hifadhi mabadiliko')}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={tr('Full name', 'Jina kamili')}
            required
            value={editForm.fullName}
            onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
          />
          <Input
            label={tr('Phone number', 'Namba ya simu')}
            required
            value={editForm.phone}
            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            hint={tr('Local or international format.', 'Muundo wa ndani au wa kimataifa.')}
          />
          <Input
            label={tr('WhatsApp number', 'Namba ya WhatsApp')}
            value={editForm.whatsappPhone}
            onChange={(e) => setEditForm({ ...editForm, whatsappPhone: e.target.value })}
            placeholder={tr('Defaults to phone number', 'Chaguo-msingi ni namba ya simu')}
          />
          <Input
            label={tr('Alternate phone', 'Simu mbadala')}
            value={editForm.alternatePhone}
            onChange={(e) => setEditForm({ ...editForm, alternatePhone: e.target.value })}
          />
          <Input
            label={tr('Email', 'Barua pepe')}
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
          <Input
            label={tr('Date of birth', 'Tarehe ya kuzaliwa')}
            type="date"
            value={editForm.dateOfBirth}
            onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
          />
          <Select label={tr('Gender', 'Jinsia')} value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
            <option value="FEMALE">{tr('Female', 'Mwanamke')}</option>
            <option value="MALE">{tr('Male', 'Mwanaume')}</option>
            <option value="OTHER">{tr('Other', 'Nyingine')}</option>
            <option value="UNSPECIFIED">{tr('Prefer not to say', 'Pendelea kutojitaja')}</option>
          </Select>
          <Select label={tr('Source', 'Chanzo')} value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}>
            {CUSTOMER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {enumLabel(s)}
              </option>
            ))}
          </Select>
          <Select label={tr('Status', 'Hali')} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
            <option value="ACTIVE">{enumLabel('ACTIVE')}</option>
            <option value="INACTIVE">{enumLabel('INACTIVE')}</option>
            <option value="ARCHIVED">{enumLabel('ARCHIVED')}</option>
            <option value="BLOCKED">{enumLabel('BLOCKED')}</option>
          </Select>
          <Input
            label={tr('Location', 'Mahali')}
            value={editForm.location}
            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
            placeholder="Mikocheni, Dar es Salaam"
          />
          <Input
            label={tr('Physical address', 'Anwani ya mahali')}
            wrapperClassName="sm:col-span-2"
            value={editForm.physicalAddress}
            onChange={(e) => setEditForm({ ...editForm, physicalAddress: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-4 pb-1 sm:col-span-2">
            <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
              <input
                type="checkbox"
                checked={editForm.marketingConsent}
                onChange={(e) => setEditForm({ ...editForm, marketingConsent: e.target.checked })}
                className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
              />
              {tr('Marketing consent', 'Ridhaa ya masoko')}
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
              <input
                type="checkbox"
                checked={editForm.whatsappOptIn}
                onChange={(e) => setEditForm({ ...editForm, whatsappOptIn: e.target.checked })}
                className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
              />
              {tr('WhatsApp opt-in', 'Kukubali WhatsApp')}
            </label>
          </div>
          <Textarea
            label={tr('Notes', 'Maelezo')}
            wrapperClassName="sm:col-span-2"
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            placeholder={tr('Preferences, delivery notes, referral details…', 'Mapendeleo, maelezo ya usafirishaji, maelezo ya rufaa…')}
          />
        </div>
      </Modal>
    </div>
  );
}
