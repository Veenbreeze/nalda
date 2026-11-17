import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Package, Plus, Search, ShoppingBag } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { ApiResponse, CargoShipment, Customer, Paginated, ShoppingRequest } from '../types';
import { formatDate } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';
import {
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
  Tabs,
  Textarea,
} from '../components/ui';

const CARGO_STATUSES = ['REQUESTED', 'IN_TRANSIT', 'AT_PORT', 'CUSTOMS', 'ARRIVED', 'DELIVERED', 'CANCELLED'];
const SHOPPING_STATUSES = ['REQUESTED', 'SOURCING', 'QUOTED', 'APPROVED', 'PURCHASED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export function CargoPage() {
  const { tr, enumLabel } = useLanguage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('cargo');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [cargoOpen, setCargoOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [cargoForm, setCargoForm] = useState({
    customerId: '',
    shipmentType: 'SEA_FREIGHT',
    description: '',
    estimatedArrival: '',
    weightKg: '',
    cost: '',
  });
  const [shoppingForm, setShoppingForm] = useState({ customerId: '', productName: '', productDescription: '', estimatedPrice: '' });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-lookup'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Customer[]> & Paginated<Customer>>('/customers', { params: { limit: 100 } });
      return res.data.data;
    },
  });

  const cargoQuery = useQuery({
    queryKey: ['cargo', { page, search }],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CargoShipment[]> & Paginated<CargoShipment>>('/cargo', {
        params: { page, limit: 20, search: search || undefined },
      });
      return res.data;
    },
    enabled: tab === 'cargo',
  });

  const shoppingQuery = useQuery({
    queryKey: ['personal-shopping', { page, search }],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ShoppingRequest[]> & Paginated<ShoppingRequest>>('/personal-shopping', {
        params: { page, limit: 20, search: search || undefined },
      });
      return res.data;
    },
    enabled: tab === 'shopping',
  });

  const createCargo = useMutation({
    mutationFn: async () =>
      api.post('/cargo', {
        customerId: cargoForm.customerId,
        shipmentType: cargoForm.shipmentType,
        description: cargoForm.description || undefined,
        estimatedArrival: cargoForm.estimatedArrival || undefined,
        weightKg: cargoForm.weightKg ? Number(cargoForm.weightKg) : undefined,
        cost: cargoForm.cost ? Number(cargoForm.cost) : undefined,
      }),
    onSuccess: () => {
      toast.success(tr('Cargo shipment created', 'Usafirishaji wa mzigo umeundwa'));
      setCargoOpen(false);
      setCargoForm({ customerId: '', shipmentType: 'SEA_FREIGHT', description: '', estimatedArrival: '', weightKg: '', cost: '' });
      void queryClient.invalidateQueries({ queryKey: ['cargo'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const updateCargo = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.patch(`/cargo/${id}`, { status }),
    onSuccess: () => {
      toast.success(tr('Shipment updated', 'Usafirishaji umesasishwa'));
      void queryClient.invalidateQueries({ queryKey: ['cargo'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const createShopping = useMutation({
    mutationFn: async () =>
      api.post('/personal-shopping', {
        customerId: shoppingForm.customerId,
        productName: shoppingForm.productName,
        productDescription: shoppingForm.productDescription || undefined,
        estimatedPrice: shoppingForm.estimatedPrice ? Number(shoppingForm.estimatedPrice) : undefined,
      }),
    onSuccess: () => {
      toast.success(tr('Personal shopping request created', 'Ombi la ununuzi wa kibinafsi limeundwa'));
      setShoppingOpen(false);
      setShoppingForm({ customerId: '', productName: '', productDescription: '', estimatedPrice: '' });
      void queryClient.invalidateQueries({ queryKey: ['personal-shopping'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const updateShopping = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.patch(`/personal-shopping/${id}`, { status }),
    onSuccess: () => {
      toast.success(tr('Request updated', 'Ombi limesasishwa'));
      void queryClient.invalidateQueries({ queryKey: ['personal-shopping'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const goCargo = (e: FormEvent) => {
    e.preventDefault();
    createCargo.mutate();
  };
  const goShopping = (e: FormEvent) => {
    e.preventDefault();
    createShopping.mutate();
  };

  const active = tab === 'cargo' ? cargoQuery : shoppingQuery;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tr('Cargo & personal shopping', 'Mzigo na ununuzi wa kibinafsi')}
        subtitle={tr(
          'Track imported shipments and source special requests for loyal customers.',
          'Fuatilia usafirishaji unaoagizwa na utafute maombi maalum kwa wateja waaminifu.',
        )}
        actions={
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => (tab === 'cargo' ? setCargoOpen(true) : setShoppingOpen(true))}
          >
            {tab === 'cargo' ? tr('New shipment', 'Usafirishaji mpya') : tr('New request', 'Ombi jipya')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[
            { value: 'cargo', label: tr('Cargo shipments', 'Usafirishaji wa mzigo') },
            { value: 'shopping', label: tr('Personal shopping', 'Ununuzi wa kibinafsi') },
          ]}
          value={tab}
          onChange={(id) => {
            setTab(id);
            setPage(1);
          }}
        />
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr('Search…', 'Tafuta…')} className="input-base pl-9" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {active.isLoading ? (
          <PageLoader label={tr('Loading…', 'Inapakia…')} />
        ) : tab === 'cargo' ? (
          (cargoQuery.data?.data ?? []).length === 0 ? (
            <EmptyState icon={<Package className="h-6 w-6" />} title={tr('No shipments yet', 'Hakuna usafirishaji bado')} description={tr('Create a cargo shipment to start tracking imported goods.', 'Unda usafirishaji wa mzigo ili kuanza kufuatilia bidhaa zinazoagizwa.')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>{tr('Reference', 'Rejeleo')}</th>
                    <th>{tr('Customer', 'Mteja')}</th>
                    <th>{tr('Type', 'Aina')}</th>
                    <th>{tr('ETA', 'Makadirio ya kuwasili')}</th>
                    <th>{tr('Status', 'Hali')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cargoQuery.data?.data.map((c) => (
                    <tr key={c.id}>
                      <td className="font-semibold text-ink-900">{c.cargoReference}</td>
                      <td>
                        <p className="text-xs font-medium text-ink-800">{c.customer?.fullName ?? '—'}</p>
                        <p className="text-[10px] text-ink-400">{c.customer?.phone}</p>
                      </td>
                      <td className="text-xs">{enumLabel(c.shipmentType)}</td>
                      <td className="text-xs">{c.estimatedArrival ? formatDate(c.estimatedArrival) : '—'}</td>
                      <td>
                        <select
                          value={c.status}
                          onChange={(e) => updateCargo.mutate({ id: c.id, status: e.target.value })}
                          className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-[11px] font-medium"
                        >
                          {CARGO_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {enumLabel(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (shoppingQuery.data?.data ?? []).length === 0 ? (
          <EmptyState icon={<ShoppingBag className="h-6 w-6" />} title={tr('No requests yet', 'Hakuna maombi bado')} description={tr('Create a personal shopping request for a customer.', 'Unda ombi la ununuzi wa kibinafsi kwa mteja.')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{tr('Request', 'Ombi')}</th>
                  <th>{tr('Customer', 'Mteja')}</th>
                  <th>{tr('Product', 'Bidhaa')}</th>
                  <th>{tr('Est. price', 'Bei ya kadirio')}</th>
                  <th>{tr('Status', 'Hali')}</th>
                </tr>
              </thead>
              <tbody>
                {shoppingQuery.data?.data.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold text-ink-900">{s.requestNumber}</td>
                    <td>
                      <p className="text-xs font-medium text-ink-800">{s.customer?.fullName ?? '—'}</p>
                      <p className="text-[10px] text-ink-400">{s.customer?.phone}</p>
                    </td>
                    <td className="max-w-[220px] truncate text-xs">{s.productName}</td>
                    <td className="text-xs">{s.estimatedPrice ? `TZS ${Number(s.estimatedPrice).toLocaleString()}` : '—'}</td>
                    <td>
                      <select
                        value={s.status}
                        onChange={(e) => updateShopping.mutate({ id: s.id, status: e.target.value })}
                        className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-[11px] font-medium"
                      >
                        {SHOPPING_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {enumLabel(st)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {active.data?.pagination && active.data.pagination.totalPages > 1 && (
          <Pagination
            page={active.data.pagination.page}
            totalPages={active.data.pagination.totalPages}
            total={active.data.pagination.total}
            onChange={setPage}
          />
        )}
      </Card>

      <Modal
        open={cargoOpen}
        onClose={() => setCargoOpen(false)}
        title={tr('New cargo shipment', 'Usafirishaji mpya wa mzigo')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCargoOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button type="submit" form="cargo-form" loading={createCargo.isPending}>
              {tr('Create shipment', 'Unda usafirishaji')}
            </Button>
          </>
        }
      >
        <form id="cargo-form" onSubmit={goCargo} className="space-y-3">
          <Select label={tr('Customer', 'Mteja')} required value={cargoForm.customerId} onChange={(e) => setCargoForm({ ...cargoForm, customerId: e.target.value })}>
            <option value="">{tr('Select a customer', 'Chagua mteja')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} — {c.phone}
              </option>
            ))}
          </Select>
          <Select label={tr('Shipment type', 'Aina ya usafirishaji')} value={cargoForm.shipmentType} onChange={(e) => setCargoForm({ ...cargoForm, shipmentType: e.target.value })}>
            <option value="SEA_FREIGHT">{enumLabel('SEA_FREIGHT')}</option>
            <option value="AIR_FREIGHT">{enumLabel('AIR_FREIGHT')}</option>
            <option value="COURIER">{enumLabel('COURIER')}</option>
            <option value="OTHER">{enumLabel('OTHER')}</option>
          </Select>
          <Textarea label={tr('Description', 'Maelezo')} rows={2} value={cargoForm.description} onChange={(e) => setCargoForm({ ...cargoForm, description: e.target.value })} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label={tr('Estimated arrival', 'Makadirio ya kuwasili')} type="date" value={cargoForm.estimatedArrival} onChange={(e) => setCargoForm({ ...cargoForm, estimatedArrival: e.target.value })} />
            <Input label={tr('Weight (kg)', 'Uzito (kg)')} type="number" step="0.1" value={cargoForm.weightKg} onChange={(e) => setCargoForm({ ...cargoForm, weightKg: e.target.value })} />
            <Input label={tr('Cost (TZS)', 'Gharama (TZS)')} type="number" value={cargoForm.cost} onChange={(e) => setCargoForm({ ...cargoForm, cost: e.target.value })} />
          </div>
        </form>
      </Modal>

      <Modal
        open={shoppingOpen}
        onClose={() => setShoppingOpen(false)}
        title={tr('New personal shopping request', 'Ombi jipya la ununuzi wa kibinafsi')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShoppingOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button type="submit" form="shopping-form" loading={createShopping.isPending}>
              {tr('Create request', 'Unda ombi')}
            </Button>
          </>
        }
      >
        <form id="shopping-form" onSubmit={goShopping} className="space-y-3">
          <Select label={tr('Customer', 'Mteja')} required value={shoppingForm.customerId} onChange={(e) => setShoppingForm({ ...shoppingForm, customerId: e.target.value })}>
            <option value="">{tr('Select a customer', 'Chagua mteja')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} — {c.phone}
              </option>
            ))}
          </Select>
          <Input label={tr('Product name', 'Jina la bidhaa')} required value={shoppingForm.productName} onChange={(e) => setShoppingForm({ ...shoppingForm, productName: e.target.value })} placeholder="e.g. AmLactin 12% cream 567g" />
          <Textarea label={tr('Description', 'Maelezo')} rows={3} value={shoppingForm.productDescription} onChange={(e) => setShoppingForm({ ...shoppingForm, productDescription: e.target.value })} />
          <Input label={tr('Estimated price (TZS)', 'Bei ya kadirio (TZS)')} type="number" value={shoppingForm.estimatedPrice} onChange={(e) => setShoppingForm({ ...shoppingForm, estimatedPrice: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
