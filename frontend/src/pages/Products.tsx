import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Boxes, Edit3, PackagePlus, Plus, Search, Sparkles } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { ApiResponse, Paginated, Product, ProductCategory } from '../types';
import { formatCurrency, formatNumber } from '../lib/utils';
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
  Textarea,
} from '../components/ui';

const emptyProduct = {
  name: '',
  sku: '',
  brand: '',
  categoryId: '',
  description: '',
  sellingPrice: '',
  costPrice: '',
  stockQuantity: '0',
  minStockLevel: '5',
  isNewArrival: false,
  isFeatured: false,
};

export function ProductsPage() {
  const { tr } = useLanguage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [arrivalsOnly, setArrivalsOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [delta, setDelta] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ProductCategory[]>>('/products/categories');
      return res.data.data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', { page, search, categoryId, lowStock, arrivalsOnly }],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product[]> & Paginated<Product>>('/products', {
        params: {
          page,
          limit: 24,
          search: search || undefined,
          categoryId: categoryId || undefined,
          lowStock: lowStock || undefined,
          isNewArrival: arrivalsOnly || undefined,
        },
      });
      return res.data;
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['products'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['product-categories'] });
  };

  const saveProduct = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        sku: form.sku || undefined,
        brand: form.brand || undefined,
        categoryId: form.categoryId || null,
        description: form.description || undefined,
        sellingPrice: Number(form.sellingPrice),
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        stockQuantity: Number(form.stockQuantity || 0),
        minStockLevel: Number(form.minStockLevel || 0),
        isNewArrival: form.isNewArrival,
        isFeatured: form.isFeatured,
      };
      if (editing) return api.patch(`/products/${editing.id}`, payload);
      return api.post('/products', payload);
    },
    onSuccess: () => {
      toast.success(editing ? tr('Product updated', 'Bidhaa imesasishwa') : tr('Product created', 'Bidhaa imeundwa'));
      setModalOpen(false);
      setEditing(null);
      setForm(emptyProduct);
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const adjustStock = useMutation({
    mutationFn: async () => {
      if (!stockProduct) return;
      return api.post(`/products/${stockProduct.id}/adjust-stock`, { delta: Number(delta) });
    },
    onSuccess: () => {
      toast.success(tr('Stock adjusted', 'Hisa zimerekebishwa'));
      setStockProduct(null);
      setDelta('');
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyProduct);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      brand: p.brand ?? '',
      categoryId: p.categoryId ?? '',
      description: p.description ?? '',
      sellingPrice: String(p.sellingPrice),
      costPrice: p.costPrice != null ? String(p.costPrice) : '',
      stockQuantity: String(p.stockQuantity),
      minStockLevel: String(p.minStockLevel),
      isNewArrival: p.isNewArrival,
      isFeatured: p.isFeatured,
    });
    setModalOpen(true);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    saveProduct.mutate();
  };

  const products = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tr('Products', 'Bidhaa')}
        subtitle={tr(
          'Manage imported beauty, skincare, perfume, baby and personal-care inventory.',
          'Simamia hisa za bidhaa zinazoagizwa za urembo, utunzaji wa ngozi, manukato, watoto na utunzaji wa kibinafsi.',
        )}
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            {tr('New product', 'Bidhaa mpya')}
          </Button>
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={tr('Search products by name, brand or SKU…', 'Tafuta bidhaa kwa jina, chapa au SKU…')}
              className="input-base pl-9"
            />
          </div>
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="xl:w-48"
          >
            <option value="">{tr('All categories', 'Kategoria zote')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button
              variant={lowStock ? 'primary' : 'secondary'}
              size="md"
              onClick={() => {
                setLowStock((v) => !v);
                setPage(1);
              }}
            >
              {tr('Low stock', 'Hisa chini')}
            </Button>
            <Button
              variant={arrivalsOnly ? 'primary' : 'secondary'}
              size="md"
              leftIcon={<Sparkles className="h-4 w-4" />}
              onClick={() => {
                setArrivalsOnly((v) => !v);
                setPage(1);
              }}
            >
              {tr('New arrivals', 'Bidhaa zilizoingia mpya')}
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <PageLoader label={tr('Loading products…', 'Inapakia bidhaa…')} />
      ) : products.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Boxes className="h-6 w-6" />}
            title={tr('No products found', 'Hakuna bidhaa zilizopatikana')}
            description={tr('Add your first product or adjust the filters.', 'Ongeza bidhaa yako ya kwanza au rekebisha vichujio.')}
            action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>{tr('New product', 'Bidhaa mpya')}</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {products.map((p) => {
              const isLow = p.stockQuantity <= p.minStockLevel;
              return (
                <Card key={p.id} className="group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-card">
                  <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-ink-50 to-gold-50">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <Boxes className="h-10 w-10 text-gold-500/60" />
                    )}
                    <div className="absolute left-3 top-3 flex gap-1.5">
                      {p.isNewArrival && <Badge tone="gold">{tr('New arrival', 'Bidhaa mpya')}</Badge>}
                      {p.isFeatured && <Badge tone="ink">{tr('Featured', 'Maalum')}</Badge>}
                    </div>
                    <button
                      onClick={() => openEdit(p)}
                      className="absolute right-3 top-3 rounded-lg bg-white/90 p-1.5 text-ink-500 opacity-0 shadow-sm transition hover:text-ink-900 group-hover:opacity-100"
                      aria-label={tr('Edit product', 'Hariri bidhaa')}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gold-600">
                      {p.category?.name ?? tr('Uncategorised', 'Bila kategoria')} {p.brand ? `· ${p.brand}` : ''}
                    </p>
                    <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-ink-900">{p.name}</p>
                    <div className="mt-2 flex items-end justify-between">
                      <div>
                        <p className="text-sm font-bold text-ink-900">{formatCurrency(p.sellingPrice)}</p>
                        {p.costPrice != null && (
                          <p className="text-[10px] text-ink-400">{tr(`Cost ${formatCurrency(p.costPrice)}`, `Gharama ${formatCurrency(p.costPrice)}`)}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${isLow ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {tr(`${formatNumber(p.stockQuantity)} in stock`, `${formatNumber(p.stockQuantity)} zipo hisa`)}
                        </p>
                        <p className="text-[10px] text-ink-400">{tr(`min ${p.minStockLevel}`, `chini ${p.minStockLevel}`)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-ink-50 pt-3">
                      <span className="text-[10px] text-ink-400">{p.sku}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<PackagePlus className="h-3.5 w-3.5" />}
                        onClick={() => {
                          setStockProduct(p);
                          setDelta('');
                        }}
                      >
                        {tr('Stock', 'Hisa')}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {pagination && (
            <Card className="mt-4">
              <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} onChange={setPage} />
            </Card>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? tr('Edit product', 'Hariri bidhaa') : tr('New product', 'Bidhaa mpya')}
        subtitle={
          editing
            ? tr(`Updating ${editing.name}`, `Inasasisha ${editing.name}`)
            : tr('Add an imported or local product to your catalogue.', 'Ongeza bidhaa inayoagizwa au ya ndani kwenye orodha yako.')
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button type="submit" form="product-form" loading={saveProduct.isPending}>
              {editing ? tr('Save changes', 'Hifadhi mabadiliko') : tr('Create product', 'Unda bidhaa')}
            </Button>
          </>
        }
      >
        <form id="product-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={tr('Product name', 'Jina la bidhaa')}
            required
            wrapperClassName="sm:col-span-2"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. CeraVe Moisturising Cream 454g"
          />
          <Input label={tr('Brand', 'Chapa')} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="CeraVe" />
          <Select label={tr('Category', 'Kategoria')} value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">{tr('Uncategorised', 'Bila kategoria')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input
            label={tr('Selling price (TZS)', 'Bei ya kuuza (TZS)')}
            type="number"
            required
            value={form.sellingPrice}
            onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
            placeholder="75000"
          />
          <Input
            label={tr('Cost price (TZS)', 'Bei ya gharama (TZS)')}
            type="number"
            value={form.costPrice}
            onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
            placeholder={tr('Optional', 'Si lazima')}
          />
          <Input
            label={tr('Stock quantity', 'Idadi ya hisa')}
            type="number"
            value={form.stockQuantity}
            onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
          />
          <Input
            label={tr('Minimum stock level', 'Kiwango cha chini cha hisa')}
            type="number"
            value={form.minStockLevel}
            onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })}
          />
          <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder={tr('Auto-generated if blank', 'Itatengenezwa kiotomatiki ikiwa wazi')} />
          <div className="flex items-end gap-4 pb-2">
            <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
              <input
                type="checkbox"
                checked={form.isNewArrival}
                onChange={(e) => setForm({ ...form, isNewArrival: e.target.checked })}
                className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
              />
              {tr('New arrival', 'Bidhaa mpya')}
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
              />
              {tr('Featured', 'Maalum')}
            </label>
          </div>
          <Textarea
            label={tr('Description', 'Maelezo')}
            wrapperClassName="sm:col-span-2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={tr('Product details, benefits, sourcing notes…', 'Maelezo ya bidhaa, faida, maelezo ya maandalizi…')}
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(stockProduct)}
        onClose={() => setStockProduct(null)}
        title={tr('Adjust stock', 'Rekebisha hisa')}
        subtitle={
          stockProduct
            ? tr(
                `${stockProduct.name} · currently ${stockProduct.stockQuantity} units`,
                `${stockProduct.name} · kwa sasa vitengo ${stockProduct.stockQuantity}`,
              )
            : ''
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStockProduct(null)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button loading={adjustStock.isPending} disabled={!delta} onClick={() => adjustStock.mutate()}>
              {tr('Apply adjustment', 'Tumia marekebisho')}
            </Button>
          </>
        }
      >
        <Input
          label={tr('Adjustment (+ receive / − remove)', 'Marekebisho (+ pokea / − ondoa)')}
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder={tr('e.g. 12 or -3', 'mf. 12 au -3')}
          hint={tr('Use a negative number to reduce stock (damages, corrections).', 'Tumia nambari hasi kupunguza hisa (uharibifu, marekebisho).')}
        />
        {stockProduct && delta && (
          <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600">
            {tr('New stock level:', 'Kiwango kipya cha hisa:')} <span className="font-bold text-ink-900">{stockProduct.stockQuantity + Number(delta || 0)}</span>
          </p>
        )}
      </Modal>
    </div>
  );
}
