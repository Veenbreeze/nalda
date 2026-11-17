import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Building2,
  DatabaseBackup,
  Download,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Lock,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import { useAuth } from '../store/AuthContext';
import type { Admin, ApiResponse, AuditLog, Backup, BusinessSettingsItem, Paginated, Role } from '../types';
import { downloadBlob, formatBytes, formatDate, formatNumber } from '../lib/utils';
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
  PageHeader,
  PageLoader,
  Pagination,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
} from '../components/ui';

const TABS = [
  { value: 'business', en: 'Business profile', sw: 'Wasifu wa biashara' },
  { value: 'team', en: 'Team & roles', sw: 'Timu na majukumu' },
  { value: 'security', en: 'Security', sw: 'Usalama' },
  { value: 'backups', en: 'Backups', sw: 'Nakala rudufu' },
  { value: 'audit', en: 'Audit log', sw: 'Kumbukumbu za ukaguzi' },
];

const BUSINESS_FIELDS: { key: string; en: string; sw: string; type?: 'text' | 'textarea' | 'boolean' }[] = [
  { key: 'businessName', en: 'Business name', sw: 'Jina la biashara' },
  { key: 'businessType', en: 'Business type', sw: 'Aina ya biashara', type: 'textarea' },
  { key: 'address', en: 'Address', sw: 'Anwani', type: 'textarea' },
  { key: 'location', en: 'Location', sw: 'Eneo' },
  { key: 'phone', en: 'Phone', sw: 'Simu' },
  { key: 'whatsapp', en: 'WhatsApp', sw: 'WhatsApp' },
  { key: 'internationalPhone', en: 'International phone', sw: 'Simu ya kimataifa' },
  { key: 'instagram', en: 'Instagram URL', sw: 'URL ya Instagram' },
  { key: 'babyEssentials', en: 'Baby essentials brand', sw: 'Chapa ya mahitaji ya mtoto' },
  { key: 'currency', en: 'Currency', sw: 'Sarafu' },
  { key: 'timezone', en: 'Timezone', sw: 'Saa za eneo' },
  { key: 'personalShoppingOffered', en: 'Personal shopping offered', sw: 'Ununuzi wa kibinafsi unatolewa', type: 'boolean' },
  { key: 'cargoShippingOffered', en: 'Cargo shipping offered', sw: 'Usafirishaji wa mizigo unatolewa', type: 'boolean' },
];

export function SettingsPage() {
  const { tr } = useLanguage();
  const [tab, setTab] = useState('business');
  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tr('Settings', 'Mipangilio')}
        subtitle={tr('Manage your business profile, team access, backups and audit history.', 'Simamia wasifu wa biashara yako, ufikiaji wa timu, nakala rudufu na historia ya ukaguzi.')}
      />
      <div className="mb-4">
        <Tabs tabs={TABS.map(({ value, en, sw }) => ({ value, label: tr(en, sw) }))} value={tab} onChange={setTab} />
      </div>
      {tab === 'business' && <BusinessTab />}
      {tab === 'team' && <TeamTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'backups' && <BackupsTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

function BusinessTab() {
  const { tr } = useLanguage();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [bools, setBools] = useState<Record<string, boolean>>({});

  const { data = [], isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<BusinessSettingsItem[]>>('/settings');
      return res.data.data;
    },
  });

  useEffect(() => {
    if (!data.length) return;
    const nextValues: Record<string, string> = {};
    const nextBools: Record<string, boolean> = {};
    data.forEach((s) => {
      if (typeof s.value === 'boolean') nextBools[s.key] = s.value;
      else nextValues[s.key] = s.value == null ? '' : String(s.value);
    });
    setValues(nextValues);
    setBools(nextBools);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const settings = BUSINESS_FIELDS.filter((f) => f.type === 'boolean' ? f.key in bools : f.key in values).map((f) => ({
        key: f.key,
        value: f.type === 'boolean' ? bools[f.key] : values[f.key],
      }));
      return api.put('/settings', { settings });
    },
    onSuccess: () => {
      toast.success(tr('Business settings saved', 'Mipangilio ya biashara imehifadhiwa'));
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      void queryClient.invalidateQueries({ queryKey: ['business-info'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  if (isLoading) {
    return (
      <Card>
        <PageLoader label={tr('Loading settings…', 'Inapakia mipangilio…')} />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={tr('Business profile', 'Wasifu wa biashara')}
        subtitle={tr('Shown on the login screen and used in messages.', 'Huonekana kwenye skrini ya kuingia na hutumika katika ujumbe.')}
      />
      <form
        className="grid grid-cols-1 gap-3 px-4 pb-4 sm:grid-cols-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        {BUSINESS_FIELDS.map((field) => {
          if (field.type === 'boolean') {
            return (
              <label key={field.key} className="flex items-center gap-2 self-end rounded-xl border border-ink-100 px-3.5 py-2.5 text-xs font-medium text-ink-700">
                <input
                  type="checkbox"
                  checked={bools[field.key] ?? false}
                  onChange={(e) => setBools({ ...bools, [field.key]: e.target.checked })}
                  className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
                />
                {tr(field.en, field.sw)}
              </label>
            );
          }
          if (field.type === 'textarea') {
            return (
              <div key={field.key} className="sm:col-span-2">
                <Textarea
                  label={tr(field.en, field.sw)}
                  rows={2}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                />
              </div>
            );
          }
          return (
            <Input
              key={field.key}
              label={tr(field.en, field.sw)}
              value={values[field.key] ?? ''}
              onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
            />
          );
        })}
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" loading={save.isPending}>
            {tr('Save changes', 'Hifadhi mabadiliko')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function TeamTab() {
  const { tr, enumLabel } = useLanguage();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<Admin | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', roleId: '' });

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Admin[]>>('/admins');
      return res.data.data;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<(Role & { _count?: { admins: number } })[]>>('/roles');
      return res.data.data;
    },
  });

  const createAdmin = useMutation({
    mutationFn: async () =>
      api.post('/admins', {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        roleId: form.roleId,
      }),
    onSuccess: () => {
      toast.success(tr('Administrator created', 'Msimamizi ameundwa'));
      setCreateOpen(false);
      setForm({ fullName: '', email: '', phone: '', password: '', roleId: '' });
      void queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.patch(`/admins/${id}`, { status }),
    onSuccess: () => {
      toast.success(tr('Administrator updated', 'Msimamizi amesasishwa'));
      void queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const resetPassword = useMutation({
    mutationFn: async () => api.post(`/admins/${resetFor?.id}/reset-password`, { newPassword }),
    onSuccess: () => {
      toast.success(tr('Password reset — admin must log in again', 'Nenosiri limewekwa upya — msimamizi lazima aingie tena'));
      setResetFor(null);
      setNewPassword('');
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2">
        <Card>
          <CardHeader
            title={tr('Administrators', 'Wasimamizi')}
            subtitle={tr('People who can access the CRM.', 'Watu wanaoweza kufikia CRM.')}
            action={
              <Button size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreateOpen(true)}>
                {tr('Add administrator', 'Ongeza msimamizi')}
              </Button>
            }
          />
          {isLoading ? (
            <PageLoader />
          ) : admins.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title={tr('No administrators', 'Hakuna wasimamizi')} />
          ) : (
            <div className="divide-y divide-ink-50">
              {admins.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={a.fullName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink-900">{a.fullName}</p>
                      <Badge tone={a.role?.slug === 'super_admin' ? 'gold' : 'gray'}>{a.role?.name ?? tr('No role', 'Hakuna jukumu')}</Badge>
                    </div>
                    <p className="text-[11px] text-ink-400">
                      {a.email}
                      {a.phone ? ` · ${a.phone}` : ''}
                    </p>
                    <p className="text-[10px] text-ink-300">
                      {tr('Last login:', 'Kuingia mara ya mwisho:')} {a.lastLoginAt ? formatDate(a.lastLoginAt, true) : tr('Never', 'Kamwe')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={a.status} onChange={(e) => updateStatus.mutate({ id: a.id, status: e.target.value })} className="w-28 text-xs">
                      <option value="ACTIVE">{enumLabel('ACTIVE')}</option>
                      <option value="INACTIVE">{enumLabel('INACTIVE')}</option>
                      <option value="SUSPENDED">{enumLabel('SUSPENDED')}</option>
                    </Select>
                    <Button size="sm" variant="ghost" leftIcon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => setResetFor(a)}>
                      {tr('Reset', 'Weka upya')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title={tr('Roles', 'Majukumu')} subtitle={tr('Permission bundles.', 'Makundi ya ruhusa.')} />
        <div className="divide-y divide-ink-50">
          {roles.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-ink-800">{r.name}</p>
                <Badge tone="gray">
                  {tr(`${r._count?.admins ?? 0} member(s)`, `${r._count?.admins ?? 0} wanachama`)}
                </Badge>
              </div>
              <p className="mt-0.5 text-[10px] text-ink-400">
                {r.permissions.includes('*')
                  ? tr('Full access to everything', 'Ufikiaji kamili wa kila kitu')
                  : tr(`${r.permissions.length} permissions`, `${r.permissions.length} ruhusa`)}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tr('Add administrator', 'Ongeza msimamizi')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button type="submit" form="admin-form" loading={createAdmin.isPending}>
              {tr('Create administrator', 'Unda msimamizi')}
            </Button>
          </>
        }
      >
        <form
          id="admin-form"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createAdmin.mutate();
          }}
        >
          <Input label={tr('Full name', 'Jina kamili')} required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label={tr('Email', 'Barua pepe')} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label={tr('Phone', 'Simu')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select label={tr('Role', 'Jukumu')} required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
            <option value="">{tr('Select a role', 'Chagua jukumu')}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Input label={tr('Temporary password', 'Nenosiri la muda')} type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} hint={tr('At least 8 characters. Share securely.', 'Angalau herufi 8. Shiriki kwa usalama.')} />
        </form>
      </Modal>

      <Modal
        open={Boolean(resetFor)}
        onClose={() => setResetFor(null)}
        title={tr('Reset password', 'Weka upya nenosiri')}
        subtitle={resetFor ? `${resetFor.fullName} · ${resetFor.email}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetFor(null)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button loading={resetPassword.isPending} onClick={() => resetPassword.mutate()} disabled={newPassword.length < 8}>
              {tr('Reset password', 'Weka upya nenosiri')}
            </Button>
          </>
        }
      >
        <Input label={tr('New password', 'Nenosiri jipya')} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} hint={tr('Minimum 8 characters. All sessions will be revoked.', 'Angalau herufi 8. Vikao vyote vitakatishwa.')} />
      </Modal>
    </div>
  );
}

function SecurityTab() {
  const { tr } = useLanguage();
  const navigate = useNavigate();
  const { admin, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  const changePassword = useMutation({
    mutationFn: async () => api.post('/auth/change-password', { currentPassword, newPassword }),
    onSuccess: async () => {
      toast.success(tr('Password changed. Please sign in again.', 'Nenosiri limebadilishwa. Tafadhali ingia tena.'));
      await logout();
      navigate('/login', { replace: true });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const passwordType = showPasswords ? 'text' : 'password';

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader
          title={tr('Change your password', 'Badilisha nenosiri lako')}
          subtitle={tr('Update the password you use to sign in to the CRM.', 'Sasisha nenosiri unalotumia kuingia kwenye CRM.')}
        />
        <form
          className="space-y-3 px-5 py-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (canSubmit) changePassword.mutate();
          }}
        >
          <div className="flex items-start gap-2.5 rounded-xl border border-gold-200 bg-gold-50/70 p-3 text-[11px] text-gold-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
            <p>{tr('For your security, changing your password signs out every active session, including this one.', 'Kwa usalama wako, kubadilisha nenosiri lako kutatoa kwenye vikao vyote vinavyotumika, ikiwemo hiki.')}</p>
          </div>
          <Input
            label={tr('Current password', 'Nenosiri la sasa')}
            type={passwordType}
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label={tr('New password', 'Nenosiri jipya')}
              type={passwordType}
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              hint={tr('At least 8 characters.', 'Angalau herufi 8.')}
            />
            <Input
              label={tr('Confirm new password', 'Thibitisha nenosiri jipya')}
              type={passwordType}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={mismatch ? tr('Passwords do not match', 'Manenosiri hayafanani') : undefined}
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="h-4 w-4 rounded border-ink-300 text-gold-600 focus:ring-gold-500"
            />
            {tr('Show passwords', 'Onyesha manenosiri')}
          </label>
          <div className="flex justify-end">
            <Button type="submit" loading={changePassword.isPending} disabled={!canSubmit} leftIcon={<Lock className="h-4 w-4" />}>
              {tr('Update password', 'Sasisha nenosiri')}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={tr('Your account', 'Akaunti yako')} subtitle={tr('Currently signed in', 'Umeingia kwa sasa')} />
        <div className="flex items-center gap-3 px-5 py-4">
          <Avatar name={admin?.fullName} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">{admin?.fullName}</p>
            <p className="truncate text-[11px] text-ink-400">{admin?.email}</p>
            <div className="mt-1">
              <Badge tone="gold">{admin?.role?.name ?? tr('No role', 'Hakuna jukumu')}</Badge>
            </div>
          </div>
        </div>
        <div className="border-t border-ink-100 px-5 py-4">
          <div className="flex items-start gap-2.5 text-xs text-ink-500">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            <p>
              {tr('To reset another administrator\'s password, open the', 'Kuweka upya nenosiri la msimamizi mwingine, fungua kichupo cha')}{' '}
              <span className="font-semibold text-ink-700">{tr('Team & roles', 'Timu na majukumu')}</span>{' '}
              {tr('tab and choose', 'na uchague')}{' '}
              <span className="font-semibold text-ink-700">{tr('Reset', 'Weka upya')}</span>{' '}
              {tr('on their row.', 'kwenye mstari wake.')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function BackupsTab() {
  const { tr, enumLabel } = useLanguage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [restoreFor, setRestoreFor] = useState<Backup | null>(null);
  const [working, setWorking] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['backups', page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Backup[]> & Paginated<Backup>>('/backups', { params: { page, limit: 10 } });
      return res.data;
    },
  });

  const createBackup = useMutation({
    mutationFn: async () => api.post('/backups'),
    onSuccess: () => {
      toast.success(tr('Backup created', 'Nakala rudufu imeundwa'));
      void queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const verify = useMutation({
    mutationFn: async (id: string) => api.post(`/backups/${id}/verify`),
    onSuccess: (res) => {
      const v = res.data.data as { valid: boolean };
      if (v.valid) toast.success(tr('Backup verified successfully', 'Nakala rudufu imethibitishwa kwa mafanikio'));
      else toast.error(tr('Backup integrity check failed', 'Ukaguzi wa uadilifu wa nakala rudufu umeshindwa'));
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const restore = useMutation({
    mutationFn: async (id: string) => api.post(`/backups/${id}/restore`),
    onSuccess: () => {
      toast.success(tr('Database restored. A safety backup was created first.', 'Hifadhidata imerejeshwa. Nakala rudufu ya usalama iliundwa kwanza.'));
      setRestoreFor(null);
      void queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/backups/${id}`),
    onSuccess: () => {
      toast.success(tr('Backup deleted', 'Nakala rudufu imefutwa'));
      void queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const download = async (b: Backup) => {
    setWorking(b.id);
    try {
      const res = await api.get(`/backups/${b.id}/download`, { responseType: 'blob' });
      downloadBlob(res.data as Blob, b.fileName);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setWorking('');
    }
  };

  const backups = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <Card>
        <CardHeader
          title={tr('Database backups', 'Nakala rudufu za hifadhidata')}
          subtitle={tr('Snapshot of business data. Restores always create a safety backup first.', 'Picha ya data ya biashara. Urejeshaji huunda nakala rudufu ya usalama kwanza kila wakati.')}
          action={
            <Button size="sm" leftIcon={<DatabaseBackup className="h-3.5 w-3.5" />} loading={createBackup.isPending} onClick={() => createBackup.mutate()}>
              {tr('Create backup', 'Unda nakala rudufu')}
            </Button>
          }
        />
        {isLoading ? (
          <PageLoader />
        ) : backups.length === 0 ? (
          <EmptyState
            icon={<DatabaseBackup className="h-6 w-6" />}
            title={tr('No backups yet', 'Hakuna nakala rudufu bado')}
            description={tr('Create your first backup to protect business data.', 'Unda nakala rudufu yako ya kwanza kulinda data ya biashara.')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>{tr('File', 'Mfaili')}</th>
                  <th>{tr('Type', 'Aina')}</th>
                  <th>{tr('Size', 'Ukubwa')}</th>
                  <th>{tr('Status', 'Hali')}</th>
                  <th>{tr('Created', 'Imefunguliwa')}</th>
                  <th className="text-right">{tr('Actions', 'Vitendo')}</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td className="max-w-[220px] truncate text-xs font-medium text-ink-800">{b.fileName}</td>
                    <td>
                      <Badge tone={b.type === 'MANUAL' ? 'gold' : 'gray'}>{enumLabel(b.type)}</Badge>
                    </td>
                    <td className="text-xs">{formatBytes(b.sizeBytes)}</td>
                    <td>
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="text-[11px] text-ink-400">{formatDate(b.createdAt, true)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" loading={working === b.id} onClick={() => download(b)} leftIcon={<Download className="h-3.5 w-3.5" />}>
                          {tr('Download', 'Pakua')}
                        </Button>
                        <Button size="sm" variant="ghost" loading={verify.isPending} onClick={() => verify.mutate(b.id)} leftIcon={<ShieldCheck className="h-3.5 w-3.5" />}>
                          {tr('Verify', 'Thibitisha')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRestoreFor(b)} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>
                          {tr('Restore', 'Rejesha')}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove.mutate(b.id)} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
                          {tr('Delete', 'Futa')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination && pagination.totalPages > 1 && (
          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} onChange={setPage} />
        )}
      </Card>

      <Modal
        open={Boolean(restoreFor)}
        onClose={() => setRestoreFor(null)}
        title={tr('Restore database', 'Rejesha hifadhidata')}
        subtitle={tr('This replaces current business data with the backup.', 'Hii itabadilisha data ya biashara ya sasa na nakala rudufu.')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestoreFor(null)}>
              {tr('Cancel', 'Ghairi')}
            </Button>
            <Button variant="danger" loading={restore.isPending} onClick={() => restoreFor && restore.mutate(restoreFor.id)}>
              {tr('Restore now', 'Rejesha sasa')}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-xs text-ink-600">
          <p>
            {tr('Restoring', 'Kurejesha')} <span className="font-semibold">{restoreFor?.fileName}</span>{' '}
            {tr(
              'will replace customers, products, orders, deals, conversations and related business data.',
              'kutabadilisha wateja, bidhaa, maagizo, mikataba, mazungumzo na data nyingine ya biashara inayohusiana.',
            )}
          </p>
          <p className="rounded-lg bg-amber-50 p-3 text-amber-800">
            {tr(
              'A safety backup of the current database is created automatically before restoring. Administrators, roles and audit logs are never overwritten.',
              'Nakala rudufu ya usalama ya hifadhidata ya sasa huundwa kiotomatiki kabla ya kurejesha. Wasimamizi, majukumu na kumbukumbu za ukaguzi hazifutwi kamwe.',
            )}
          </p>
        </div>
      </Modal>
    </>
  );
}

function AuditTab() {
  const { tr, enumLabel } = useLanguage();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { page, search }],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AuditLog[]> & Paginated<AuditLog>>('/audit-logs', {
        params: { page, limit: 20, search: search || undefined },
      });
      return res.data;
    },
  });

  const logs = data?.data ?? [];

  return (
    <Card>
      <CardHeader
        title={tr('Audit log', 'Kumbukumbu za ukaguzi')}
        subtitle={tr('Every sensitive action is recorded.', 'Kila tendo nyeti hurekodiwa.')}
        action={
          <div className="w-full sm:w-64">
            <Input placeholder={tr('Search actions…', 'Tafuta vitendo…')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      />
      {isLoading ? (
        <PageLoader />
      ) : logs.length === 0 ? (
        <EmptyState icon={<History className="h-6 w-6" />} title={tr('No audit entries', 'Hakuna maingizo ya ukaguzi')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>{tr('Action', 'Tendo')}</th>
                <th>{tr('Entity', 'Huluki')}</th>
                <th>{tr('Administrator', 'Msimamizi')}</th>
                <th>{tr('Details', 'Maelezo')}</th>
                <th>{tr('IP', 'IP')}</th>
                <th>{tr('When', 'Lini')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>
                    <p className="text-[11px] font-semibold text-ink-800">{enumLabel(l.action)}</p>
                  </td>
                  <td className="text-[11px] text-ink-500">{enumLabel(l.entityType)}</td>
                  <td className="text-[11px] text-ink-600">{l.admin?.fullName ?? tr('System', 'Mfumo')}</td>
                  <td className="max-w-[240px] truncate text-[11px] text-ink-400">{l.description ?? '—'}</td>
                  <td className="text-[10px] text-ink-400">{l.ipAddress ?? '—'}</td>
                  <td className="text-[10px] text-ink-400">{formatDate(l.createdAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} total={data.pagination.total} onChange={setPage} />
      )}
      <p className="px-4 py-3 text-[10px] text-ink-300">
        {tr('Showing', 'Inaonyesha')} {formatNumber(logs.length)} {tr('of', 'kati ya')} {formatNumber(data?.pagination?.total ?? 0)}{' '}
        {tr('recorded actions.', 'vitendo vilivyorekodiwa.')}
      </p>
    </Card>
  );
}
