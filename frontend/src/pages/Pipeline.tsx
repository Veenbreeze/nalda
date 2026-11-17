import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GripVertical, Plus, Target } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { ApiResponse, Customer, Deal, Pipeline } from '../types';
import { formatCurrency } from '../lib/utils';
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
  Select,
  Textarea,
} from '../components/ui';

export function PipelinePage() {
  const { tr } = useLanguage();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: '', customerId: '', value: '', notes: '', stageId: '' });

  const { data: pipelines = [], isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Pipeline[]>>('/deals/pipelines');
      return res.data.data;
    },
  });

  const pipeline = pipelines[0];

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals', pipeline?.id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Deal[]>>('/deals', { params: { pipelineId: pipeline?.id } });
      return res.data.data;
    },
    enabled: Boolean(pipeline?.id),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', 'all-for-deal'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Customer[]>>('/customers', { params: { limit: 200, status: 'ACTIVE' } });
      return res.data.data;
    },
    enabled: modalOpen,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['deals'] });
    void queryClient.invalidateQueries({ queryKey: ['pipelines'] });
  };

  const createDeal = useMutation({
    mutationFn: async () =>
      api.post('/deals', {
        title: form.title,
        customerId: form.customerId,
        pipelineId: pipeline?.id,
        stageId: form.stageId || pipeline?.stages[0]?.id,
        value: form.value ? Number(form.value) : undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast.success(tr('Deal created', 'Mkataba umeundwa'));
      setModalOpen(false);
      setForm({ title: '', customerId: '', value: '', notes: '', stageId: '' });
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const moveDeal = useMutation({
    mutationFn: async ({ dealId, stageId }: { dealId: string; stageId: string }) => api.post(`/deals/${dealId}/move`, { stageId }),
    onSuccess: () => {
      toast.success(tr('Deal moved', 'Mkataba umehamishwa'));
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const grouped = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const stage of pipeline?.stages ?? []) map[stage.id] = [];
    for (const deal of deals) {
      if (!map[deal.stageId]) map[deal.stageId] = [];
      map[deal.stageId].push(deal);
    }
    return map;
  }, [deals, pipeline]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createDeal.mutate();
  };

  if (loadingPipelines) return <PageLoader label={tr('Loading pipeline…', 'Inapakia mkondo wa mauzo…')} />;
  if (!pipeline)
    return (
      <EmptyState
        title={tr('No pipeline configured', 'Hakuna mkondo wa mauzo uliosanidiwa')}
        description={tr(
          'Create a pipeline in the backend seed to start tracking deals.',
          'Unda mkondo wa mauzo kwenye mbegu ya backend ili kuanza kufuatilia mikataba.',
        )}
      />
    );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tr('Sales pipeline', 'Mkondo wa Mauzo')}
        subtitle={tr(
          'Follow every opportunity from inquiry to completed order.',
          'Fuatilia kila fursa kuanzia swali hadi agizo lililokamilika.',
        )}
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
            {tr('New deal', 'Mkataba mpya')}
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2 text-xs text-ink-400">
        <Target className="h-4 w-4 text-gold-600" />
        <span className="font-semibold text-ink-700">{pipeline.name}</span>
        <span>
          · {tr(`${deals.length} open opportunities`, `${deals.length} fursa wazi`)}
        </span>
      </div>

      {isLoading ? (
        <PageLoader label={tr('Loading deals…', 'Inapakia mikataba…')} />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {pipeline.stages.map((stage) => {
            const stageDeals = grouped[stage.id] ?? [];
            const total = stageDeals.reduce((sum, d) => sum + Number(d.value), 0);
            return (
              <div key={stage.id} className="flex w-72 shrink-0 flex-col rounded-2xl bg-ink-100/50">
                <div className="flex items-center justify-between px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${stage.isWon ? 'bg-emerald-500' : stage.isLost ? 'bg-red-500' : 'bg-gold-500'}`} />
                    <p className="text-xs font-semibold text-ink-800">{stage.name}</p>
                    <Badge tone="gray">{stageDeals.length}</Badge>
                  </div>
                  <span className="text-[10px] font-medium text-ink-400">{formatCurrency(total)}</span>
                </div>
                <div className="flex-1 space-y-2 px-2 pb-3">
                  {stageDeals.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-ink-200 px-3 py-6 text-center text-[11px] text-ink-400">
                      {tr('No deals in this stage', 'Hakuna mikataba katika hatua hii')}
                    </div>
                  ) : (
                    stageDeals.map((deal) => (
                      <Card key={deal.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-xs font-semibold text-ink-900">{deal.title}</p>
                          <GripVertical className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                        </div>
                        <p className="mt-1 text-[10px] text-ink-400">{deal.customer?.fullName ?? '—'}</p>
                        <p className="mt-2 text-sm font-bold text-gold-700">{formatCurrency(deal.value)}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <Link to={`/customers/${deal.customerId}`} className="text-[10px] font-semibold text-ink-500 hover:text-gold-700">
                            {tr('View customer', 'Tazama mteja')}
                          </Link>
                          <select
                            value={deal.stageId}
                            onChange={(e) => moveDeal.mutate({ dealId: deal.id, stageId: e.target.value })}
                            className="max-w-[110px] rounded-md border border-ink-200 bg-white px-1.5 py-1 text-[10px] text-ink-600 outline-none focus:border-gold-500"
                          >
                            {pipeline.stages.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tr('New deal', 'Mkataba mpya')}
        subtitle={tr(
          'Capture an opportunity and track it through the pipeline.',
          'Rekodi fursa na uifuatilie kupitia mkondo wa mauzo.',
        )}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button type="submit" form="deal-form" loading={createDeal.isPending}>
              {tr('Create deal', 'Unda mkataba')}
            </Button>
          </>
        }
      >
        <form id="deal-form" onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={tr('Deal title', 'Jina la mkataba')}
            required
            wrapperClassName="sm:col-span-2"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={tr('e.g. Amina — full skincare bundle', 'k.m. Amina — kifurushi kamili cha bidhaa za ngozi')}
          />
          <Select label={tr('Customer', 'Mteja')} required value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">{tr('Select customer', 'Chagua mteja')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} · {c.phone}
              </option>
            ))}
          </Select>
          <Select label={tr('Stage', 'Hatua')} value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })}>
            {pipeline.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input
            label={tr('Value (TZS)', 'Thamani (TZS)')}
            type="number"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            placeholder="150000"
          />
          <Textarea
            label={tr('Notes', 'Maelezo')}
            wrapperClassName="sm:col-span-2"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={tr(
              'What does the customer want? What is the next step?',
              'Mteja anahitaji nini? Hatua inayofuata ni ipi?',
            )}
          />
        </form>
      </Modal>
    </div>
  );
}
