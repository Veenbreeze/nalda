import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Megaphone, Plus, Send, Users, XCircle } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { ApiResponse, Campaign, Paginated, ProductCategory } from '../types';
import { formatDate, formatNumber } from '../lib/utils';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  PageLoader,
  Pagination,
  StatusBadge,
  Textarea,
} from '../components/ui';

export function CampaignsPage() {
  const { tr, enumLabel } = useLanguage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', messageBody: '', allOptedIn: true, location: '', categoryId: '', sendNow: false });
  const [preview, setPreview] = useState<{ count: number; sample?: { fullName: string; phone: string }[] } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Campaign[]> & Paginated<Campaign>>('/whatsapp/campaigns', { params: { page, limit: 12 } });
      return res.data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ProductCategory[]>>('/products/categories');
      return res.data.data;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['whatsapp-templates'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ id: string; name: string; language: string; category: string; status: string }[]>>('/whatsapp/templates');
      return res.data.data;
    },
  });

  const buildAudience = () => ({
    allOptedIn: form.allOptedIn || undefined,
    location: form.location || undefined,
    categoryId: form.categoryId || undefined,
  });

  const previewAudience = useMutation({
    mutationFn: async () => {
      const res = await api.post('/whatsapp/campaigns/preview-audience', buildAudience());
      return res.data.data as { count: number; sample?: { fullName: string; phone: string }[] };
    },
    onSuccess: (result) => setPreview(result),
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const createCampaign = useMutation({
    mutationFn: async () =>
      api.post('/whatsapp/campaigns', {
        name: form.name,
        messageBody: form.messageBody,
        audience: buildAudience(),
        sendNow: form.sendNow,
      }),
    onSuccess: () => {
      toast.success(
        form.sendNow
          ? tr('Campaign created and sending', 'Kampeni imeundwa na inatuma')
          : tr('Campaign saved as draft', 'Kampeni imehifadhiwa kama rasimu'),
      );
      setModalOpen(false);
      setForm({ name: '', messageBody: '', allOptedIn: true, location: '', categoryId: '', sendNow: false });
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const sendCampaign = useMutation({
    mutationFn: async (id: string) => api.post(`/whatsapp/campaigns/${id}/send`),
    onSuccess: () => {
      toast.success(tr('Campaign sending started', 'Utumaji wa kampeni umeanza'));
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const cancelCampaign = useMutation({
    mutationFn: async (id: string) => api.post(`/whatsapp/campaigns/${id}/cancel`),
    onSuccess: () => {
      toast.success(tr('Campaign cancelled', 'Kampeni imeghairiwa'));
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createCampaign.mutate();
  };

  const campaigns = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tr('WhatsApp campaigns', 'Kampeni za WhatsApp')}
        subtitle={tr(
          'Reach consenting customers with new arrivals, restocks and curated offers.',
          'Wafikie wateja waliokubali kupokea bidhaa mpya, hisa mpya na ofa zilizochaguliwa.',
        )}
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
            {tr('New campaign', 'Kampeni mpya')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="xl:col-span-3">
          {isLoading ? (
            <Card>
              <PageLoader label={tr('Loading campaigns…', 'Inapakia kampeni…')} />
            </Card>
          ) : campaigns.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Megaphone className="h-6 w-6" />}
                title={tr('No campaigns yet', 'Hakuna kampeni bado')}
                description={tr(
                  'Create a campaign to notify customers about new arrivals or restocks.',
                  'Unda kampeni ili kuwajulisha wateja kuhusu bidhaa mpya au hisa mpya.',
                )}
                action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>{tr('New campaign', 'Kampeni mpya')}</Button>}
              />
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {campaigns.map((c) => (
                  <Card key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900">{c.name}</p>
                        <p className="mt-0.5 text-[10px] text-ink-400">
                          {enumLabel(c.type)} · {formatDate(c.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-ink-500">{c.messageBody}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-ink-50 px-3 py-2 text-center">
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-ink-400">{tr('Audience', 'Wapokeaji')}</p>
                        <p className="text-xs font-bold text-ink-900">{formatNumber(c.totalRecipients)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-ink-400">{tr('Sent', 'Imetumwa')}</p>
                        <p className="text-xs font-bold text-emerald-600">{formatNumber(c.sentCount)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wide text-ink-400">{tr('Failed', 'Imeshindwa')}</p>
                        <p className="text-xs font-bold text-red-600">{formatNumber(c.failedCount)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<XCircle className="h-3.5 w-3.5" />}
                            loading={cancelCampaign.isPending}
                            onClick={() => cancelCampaign.mutate(c.id)}
                          >
                            {tr('Cancel', 'Ghairi')}
                          </Button>
                          <Button
                            size="sm"
                            leftIcon={<Send className="h-3.5 w-3.5" />}
                            loading={sendCampaign.isPending}
                            onClick={() => sendCampaign.mutate(c.id)}
                          >
                            {tr('Send now', 'Tuma sasa')}
                          </Button>
                        </>
                      )}
                      {c.status === 'SENT' && <Badge tone="green">{tr('Delivered to audience', 'Imewasilishwa kwa wapokeaji')}</Badge>}
                    </div>
                  </Card>
                ))}
              </div>
              {pagination && (
                <Card className="mt-4">
                  <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} onChange={setPage} />
                </Card>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title={tr('Audience health', 'Afya ya wapokeaji')} subtitle={tr('Consent-first messaging', 'Ujumbe kwa msingi wa ridhaa')} />
            <div className="space-y-3 px-4 py-4 text-xs">
              <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 p-3 text-emerald-800">
                <Users className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{tr(
                  'Only customers with marketing consent and WhatsApp opt-in receive campaigns.',
                  'Ni wateja walio na ridhaa ya masoko na waliojitolea kupokea WhatsApp pekee wanaopokea kampeni.',
                )}</p>
              </div>
              <p className="text-ink-400">
                {tr(
                  'Use product interests to target new-arrival campaigns with much higher relevance and fewer opt-outs.',
                  'Tumia nia za bidhaa kulenga kampeni za bidhaa mpya kwa umuhimu mkubwa zaidi na wanaojiondoa wachache.',
                )}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title={tr('Templates', 'Violezo')} subtitle={tr('Approved message formats', 'Miundo ya ujumbe iliyoidhinishwa')} />
            <div className="divide-y divide-ink-50">
              {templates.length === 0 && <p className="px-4 py-4 text-xs text-ink-400">{tr('No templates yet.', 'Hakuna violezo bado.')}</p>}
              {templates.map((t) => (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-ink-800">{t.name}</p>
                    <Badge tone={t.status === 'APPROVED' ? 'green' : 'amber'}>{enumLabel(t.status)}</Badge>
                  </div>
                  <p className="mt-0.5 text-[10px] text-ink-400">
                    {t.language.toUpperCase()} · {enumLabel(t.category)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tr('New campaign', 'Kampeni mpya')}
        subtitle={tr('Compose a message and choose a consenting audience.', 'Andika ujumbe na uchague wapokeaji walioidhinisha.')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button type="submit" form="campaign-form" loading={createCampaign.isPending}>
              {form.sendNow ? tr('Create & send', 'Unda na utume') : tr('Save draft', 'Hifadhi rasimu')}
            </Button>
          </>
        }
      >
        <form id="campaign-form" onSubmit={onSubmit} className="space-y-3">
          <Input
            label={tr('Campaign name', 'Jina la kampeni')}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={tr('e.g. AmLactin restock skincare lovers', 'k.m. AmLactin imejaa hisa wapenda bidhaa za ngozi')}
          />
          <Textarea
            label={tr('Message', 'Ujumbe')}
            required
            rows={5}
            value={form.messageBody}
            onChange={(e) => setForm({ ...form, messageBody: e.target.value })}
            placeholder={tr(
              'Hello {name}! We have received {product} again at NALDA USA Products…',
              'Habari {name}! Tumepokea {product} tena NALDA USA Products…',
            )}
            hint={tr(
              'Use {name} and {first_name} for personalisation. WhatsApp template rules may apply.',
              'Tumia {name} na {first_name} kubinafsisha. Sheria za violezo vya WhatsApp zinaweza kutumika.',
            )}
          />

          <div className="rounded-xl border border-ink-100 p-3.5">
            <p className="label">{tr('Audience', 'Wapokeaji')}</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
                <input
                  type="checkbox"
                  checked={form.allOptedIn}
                  onChange={(e) => {
                    setForm({ ...form, allOptedIn: e.target.checked });
                    setPreview(null);
                  }}
                  className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
                />
                {tr('All customers who consented to marketing', 'Wateja wote walioidhinisha masoko')}
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  placeholder={tr('Filter by location (optional)', 'Chuja kwa eneo (si lazima)')}
                  value={form.location}
                  onChange={(e) => {
                    setForm({ ...form, location: e.target.value });
                    setPreview(null);
                  }}
                />
                <select
                  value={form.categoryId}
                  onChange={(e) => {
                    setForm({ ...form, categoryId: e.target.value });
                    setPreview(null);
                  }}
                  className="input-base"
                >
                  <option value="">{tr('Customers interested in any category', 'Wateja wanaopendezwa na kategoria yoyote')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {tr(`Interested in ${c.name}`, `Wana nia ya ${c.name}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button type="button" variant="gold-outline" size="sm" loading={previewAudience.isPending} onClick={() => previewAudience.mutate()}>
                  {tr('Preview audience', 'Tazama wapokeaji')}
                </Button>
                {preview && <Badge tone="gold">{tr(`${formatNumber(preview.count)} recipient(s)`, `${formatNumber(preview.count)} wapokeaji`)}</Badge>}
              </div>
              {preview && preview.sample && preview.sample.length > 0 && (
                <p className="text-[10px] text-ink-400">
                  {tr(`Sample: ${preview.sample.slice(0, 4).map((s) => s.fullName).join(', ')}`, `Sampuli: ${preview.sample.slice(0, 4).map((s) => s.fullName).join(', ')}`)}
                </p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
            <input
              type="checkbox"
              checked={form.sendNow}
              onChange={(e) => setForm({ ...form, sendNow: e.target.checked })}
              className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
            />
            {tr('Send immediately after creating (otherwise save as draft)', 'Tuma mara baada ya kuunda (vinginevyo hifadhi kama rasimu)')}
          </label>
        </form>
      </Modal>
    </div>
  );
}
