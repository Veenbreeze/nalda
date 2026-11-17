import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Bot, Pause, Play, Plus, Sparkles, Zap } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { ApiResponse, AutomationWorkflow } from '../types';
import { formatDate } from '../lib/utils';
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

const TRIGGERS = [
  { value: 'NEW_ARRIVAL', en: 'New arrival', sw: 'Bidhaa mpya' },
  { value: 'RESTOCK', en: 'Restock', sw: 'Kujaza hisa' },
  { value: 'FOLLOW_UP', en: 'Follow-up', sw: 'Ufuatiliaji' },
  { value: 'NEW_WHATSAPP_ORDER', en: 'New WhatsApp order', sw: 'Agizo jipya la WhatsApp' },
  { value: 'INTEREST_DETECTION', en: 'Interest detection', sw: 'Ugunduzi wa nia' },
];

export function AutomationsPage() {
  const { tr, enumLabel } = useLanguage();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', trigger: 'FOLLOW_UP', description: '', requireApproval: true });

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<(AutomationWorkflow & { _count?: { executions: number } })[]>>('/automation');
      return res.data.data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.patch(`/automation/${id}`, { status }),
    onSuccess: () => {
      toast.success(tr('Automation updated', 'Otomatiki imesasishwa'));
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const trigger = useMutation({
    mutationFn: async (id: string) => api.post(`/automation/${id}/trigger`),
    onSuccess: (res) => {
      toast.success(tr(`Workflow executed: ${JSON.stringify(res.data.data)}`, `Mtiririko wa kazi umetekelezwa: ${JSON.stringify(res.data.data)}`));
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const createWorkflow = useMutation({
    mutationFn: async () =>
      api.post('/automation', {
        name: form.name,
        trigger: form.trigger,
        description: form.description || undefined,
        requireApproval: form.requireApproval,
        status: 'ACTIVE',
      }),
    onSuccess: () => {
      toast.success(tr('Automation created', 'Otomatiki imeundwa'));
      setModalOpen(false);
      setForm({ name: '', trigger: 'FOLLOW_UP', description: '', requireApproval: true });
      void queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    createWorkflow.mutate();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tr('Automations', 'Otomatiki')}
        subtitle={tr(
          'Keep customers engaged automatically without ever sending spam or duplicate messages.',
          'Washirikishe wateja kiotomatiki bila kutuma barua taka au ujumbe unaorudiwa.',
        )}
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
            {tr('New automation', 'Otomatiki mpya')}
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Play className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-ink-400">{tr('Active', 'Hai')}</p>
              <p className="text-lg font-bold text-ink-900">{workflows.filter((w) => w.status === 'ACTIVE').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Pause className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-ink-400">{tr('Paused / Draft', 'Imesitishwa / Rasimu')}</p>
              <p className="text-lg font-bold text-ink-900">{workflows.filter((w) => w.status !== 'ACTIVE').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-50 text-gold-700">
              <Zap className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-ink-400">{tr('Total executions', 'Jumla ya utekelezaji')}</p>
              <p className="text-lg font-bold text-ink-900">
                {workflows.reduce((sum, w) => sum + (w._count?.executions ?? 0), 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <PageLoader label={tr('Loading automations…', 'Inapakia otomatiki…')} />
        </Card>
      ) : workflows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bot className="h-6 w-6" />}
            title={tr('No automations yet', 'Hakuna otomatiki bado')}
            description={tr(
              'Create follow-ups, restock alerts and new-arrival notifications.',
              'Unda ufuatiliaji, arifa za kujaza hisa na taarifa za bidhaa mpya.',
            )}
            action={<Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>{tr('New automation', 'Otomatiki mpya')}</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {workflows.map((w) => (
            <Card key={w.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-gold-400">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{w.name}</p>
                    <p className="text-[10px] text-ink-400">{enumLabel(w.trigger)}</p>
                  </div>
                </div>
                <Badge tone={w.status === 'ACTIVE' ? 'green' : w.status === 'PAUSED' ? 'amber' : 'gray'}>{enumLabel(w.status)}</Badge>
              </div>
              <p className="mt-2 min-h-[32px] flex-1 text-xs text-ink-500">{w.description || tr('No description provided.', 'Maelezo hayakutolewa.')}</p>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-400">
                {w.requireApproval && <Badge tone="gold">{tr('Approval required', 'Uidhinishaji unahitajika')}</Badge>}
                <span>{tr(`${w._count?.executions ?? 0} runs`, `${w._count?.executions ?? 0} mara za utekelezaji`)}</span>
                <span>·</span>
                <span>{formatDate(w.createdAt)}</span>
              </div>
              <div className="mt-3 flex justify-end gap-2 border-t border-ink-50 pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={w.status === 'ACTIVE' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  loading={toggle.isPending}
                  onClick={() => toggle.mutate({ id: w.id, status: w.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
                >
                  {w.status === 'ACTIVE' ? tr('Pause', 'Sitisha') : tr('Activate', 'Washa')}
                </Button>
                <Button size="sm" variant="gold-outline" leftIcon={<Zap className="h-3.5 w-3.5" />} loading={trigger.isPending} onClick={() => trigger.mutate(w.id)}>
                  {tr('Run now', 'Endesha sasa')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={tr('New automation', 'Otomatiki mpya')}
        subtitle={tr('Choose what should trigger the workflow.', 'Chagua kichocheo cha mtiririko wa kazi.')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button type="submit" form="automation-form" loading={createWorkflow.isPending}>
              {tr('Create automation', 'Unda otomatiki')}
            </Button>
          </>
        }
      >
        <form id="automation-form" onSubmit={onSubmit} className="space-y-3">
          <Input
            label={tr('Name', 'Jina')}
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={tr('e.g. 3-day follow-up after delivery', 'k.m. ufuatiliaji wa siku 3 baada ya kuwasilisha')}
          />
          <Select label={tr('Trigger', 'Kichocheo')} value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })}>
            {TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>
                {tr(t.en, t.sw)}
              </option>
            ))}
          </Select>
          <Textarea label={tr('Description', 'Maelezo')} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
            <input
              type="checkbox"
              checked={form.requireApproval}
              onChange={(e) => setForm({ ...form, requireApproval: e.target.checked })}
              className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
            />
            {tr('Require admin approval before messages are sent', 'Hitaji idhini ya msimamizi kabla ya kutuma ujumbe')}
          </label>
        </form>
      </Modal>
    </div>
  );
}
