import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Download, Plus, Search, Users } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { ApiResponse, Customer, Paginated } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Avatar,
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

const SOURCES = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'REFERRAL', 'WALK_IN', 'IMPORT', 'MANUAL', 'OTHER'];

const emptyForm = {
  fullName: '',
  phone: '',
  whatsappPhone: '',
  email: '',
  location: '',
  source: 'WHATSAPP',
  gender: 'FEMALE',
  notes: '',
  marketingConsent: true,
  whatsappOptIn: true,
};

export function CustomersPage() {
  const { tr, enumLabel } = useLanguage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { page, search, status, source }],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Customer[]> & Paginated<Customer>>('/customers', {
        params: { page, limit: 20, search: search || undefined, status: status || undefined, source: source || undefined },
      });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof emptyForm) => {
      const res = await api.post<ApiResponse<Customer>>('/customers', {
        fullName: payload.fullName,
        phone: payload.phone,
        whatsappPhone: payload.whatsappPhone || undefined,
        email: payload.email || undefined,
        location: payload.location || undefined,
        source: payload.source,
        gender: payload.gender,
        notes: payload.notes || undefined,
        marketingConsent: payload.marketingConsent,
        whatsappOptIn: payload.whatsappOptIn,
      });
      return res.data.data;
    },
    onSuccess: (customer) => {
      toast.success(tr(`Customer ${customer.customerCode} created`, `Mteja ${customer.customerCode} ameundwa`));
      setModalOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const customers = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tr('Customers', 'Wateja')}
        subtitle={tr('Every relationship, purchase and product interest in one place.', 'Mahusiano, ununuzi na nia ya bidhaa zote mahali pamoja.')}
        actions={
          <>
            <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => (window.location.href = '/data')}>
              {tr('Export', 'Hamisha')}
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
              {tr('New customer', 'Mteja mpya')}
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={tr('Search by name, phone, code or email…', 'Tafuta kwa jina, simu, msimbo au barua pepe…')}
              className="input-base pl-9"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="sm:w-40"
          >
            <option value="">{tr('All statuses', 'Hali zote')}</option>
            <option value="ACTIVE">{enumLabel('ACTIVE')}</option>
            <option value="INACTIVE">{enumLabel('INACTIVE')}</option>
            <option value="ARCHIVED">{enumLabel('ARCHIVED')}</option>
          </Select>
          <Select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
            className="sm:w-44"
          >
            <option value="">{tr('All sources', 'Vyanzo vyote')}</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {enumLabel(s)}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <PageLoader label={tr('Loading customers…', 'Inapakia wateja…')} />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={tr('No customers found', 'Hakuna wateja waliopatikana')}
            description={tr('Try adjusting the filters or add your first customer.', 'Jaribu kubadilisha vichujio au ongeza mteja wako wa kwanza.')}
            action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>{tr('New customer', 'Mteja mpya')}</Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>{tr('Customer', 'Mteja')}</th>
                    <th>{tr('Contact', 'Mawasiliano')}</th>
                    <th>{tr('Source', 'Chanzo')}</th>
                    <th>{tr('Tags', 'Lebo')}</th>
                    <th className="text-right">{tr('Spent', 'Matumizi')}</th>
                    <th>{tr('Last purchase', 'Ununuzi wa mwisho')}</th>
                    <th>{tr('Status', 'Hali')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/customers/${c.id}`} className="flex items-center gap-3">
                          <Avatar name={c.fullName} size="sm" />
                          <div>
                            <p className="font-semibold text-ink-900 hover:text-gold-700">{c.fullName}</p>
                            <p className="text-[10px] text-ink-400">{c.customerCode}</p>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <p className="text-xs text-ink-700">{c.phone}</p>
                        <p className="text-[10px] text-ink-400">{c.location || c.email || '—'}</p>
                      </td>
                      <td>
                        <Badge tone="gray">{enumLabel(c.source)}</Badge>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {(c.tags ?? []).slice(0, 2).map((t) => (
                            <Badge key={t.id} tone="gold">
                              {t.tag.name}
                            </Badge>
                          ))}
                          {(c.tags?.length ?? 0) > 2 && <Badge tone="gray">+{(c.tags?.length ?? 0) - 2}</Badge>}
                        </div>
                      </td>
                      <td className="text-right">
                        <p className="text-xs font-semibold text-ink-900">{formatCurrency(c.totalSpent)}</p>
                        <p className="text-[10px] text-ink-400">{tr(`${c.totalOrders} orders`, `${c.totalOrders} maagizo`)}</p>
                      </td>
                      <td className="text-xs text-ink-500">{formatDate(c.lastPurchaseAt)}</td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
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
        title={tr('New customer', 'Mteja mpya')}
        subtitle={tr('Capture the details you need to serve them well.', 'Rekodi maelezo unayohitaji ili kuwahudumia vyema.')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button type="submit" form="customer-form" loading={createMutation.isPending}>
              {tr('Create customer', 'Unda mteja')}
            </Button>
          </>
        }
      >
        <form id="customer-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={tr('Full name', 'Jina kamili')}
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder={tr('e.g. Amina Mohamed', 'k.m. Amina Mohamed')}
          />
          <Input
            label={tr('Phone number', 'Namba ya simu')}
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="0747 163 059"
            hint={tr('Local or international format. Defaults to +255.', 'Muundo wa ndani au wa kimataifa. Chaguo-msingi ni +255.')}
          />
          <Input
            label={tr('WhatsApp number', 'Namba ya WhatsApp')}
            value={form.whatsappPhone}
            onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
            placeholder={tr('Same as phone if blank', 'Sawa na simu ikiwa tupu')}
          />
          <Input
            label={tr('Email', 'Barua pepe')}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="optional@email.com"
          />
          <Input
            label={tr('Location', 'Mahali')}
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Mikocheni, Dar es Salaam"
          />
          <Select label={tr('Source', 'Chanzo')} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {enumLabel(s)}
              </option>
            ))}
          </Select>
          <Select label={tr('Gender', 'Jinsia')} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="FEMALE">{tr('Female', 'Mwanamke')}</option>
            <option value="MALE">{tr('Male', 'Mwanaume')}</option>
            <option value="OTHER">{tr('Other', 'Nyingine')}</option>
            <option value="UNSPECIFIED">{tr('Prefer not to say', 'Pendelea kutojitaja')}</option>
          </Select>
          <div className="flex items-end gap-4 pb-2">
            <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
              <input
                type="checkbox"
                checked={form.marketingConsent}
                onChange={(e) => setForm({ ...form, marketingConsent: e.target.checked })}
                className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
              />
              {tr('Marketing consent', 'Ridhaa ya masoko')}
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
              <input
                type="checkbox"
                checked={form.whatsappOptIn}
                onChange={(e) => setForm({ ...form, whatsappOptIn: e.target.checked })}
                className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
              />
              {tr('WhatsApp opt-in', 'Kukubali WhatsApp')}
            </label>
          </div>
          <Textarea
            label={tr('Notes', 'Maelezo')}
            wrapperClassName="sm:col-span-2"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={tr('Preferences, delivery notes, referral details…', 'Mapendeleo, maelezo ya usafirishaji, maelezo ya rufaa…')}
          />
        </form>
      </Modal>
    </div>
  );
}
