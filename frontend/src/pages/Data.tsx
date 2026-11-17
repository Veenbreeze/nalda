import { ChangeEvent, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, Download, FileSpreadsheet, Upload, UploadCloud, XCircle } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import type { ApiResponse, Paginated } from '../types';
import { downloadBlob, formatDate, formatNumber } from '../lib/utils';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  PageLoader,
  Pagination,
  Select,
  StatusBadge,
} from '../components/ui';
import { useLanguage } from '../i18n/LanguageContext';

interface PreviewData {
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

interface ImportResult {
  jobId: string;
  status: string;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  errors: { rowNumber: number; message: string }[];
}

interface ImportJob {
  id: string;
  fileName: string;
  status: string;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  createdAt: string;
  admin?: { fullName: string } | null;
}

const MAPPING_FIELDS: { key: string; en: string; sw: string; required?: boolean }[] = [
  { key: 'fullName', en: 'Full name', sw: 'Jina kamili', required: true },
  { key: 'phone', en: 'Phone', sw: 'Simu', required: true },
  { key: 'whatsappPhone', en: 'WhatsApp phone', sw: 'Simu ya WhatsApp' },
  { key: 'alternatePhone', en: 'Alternate phone', sw: 'Simu mbadala' },
  { key: 'email', en: 'Email', sw: 'Barua pepe' },
  { key: 'gender', en: 'Gender', sw: 'Jinsia' },
  { key: 'dateOfBirth', en: 'Date of birth', sw: 'Tarehe ya kuzaliwa' },
  { key: 'location', en: 'Location', sw: 'Eneo' },
  { key: 'physicalAddress', en: 'Physical address', sw: 'Anwani ya mahali' },
  { key: 'source', en: 'Source', sw: 'Chanzo' },
  { key: 'notes', en: 'Notes', sw: 'Kumbukumbu' },
  { key: 'marketingConsent', en: 'Marketing consent', sw: 'Ridha ya masoko' },
];

export function DataPage() {
  const { tr } = useLanguage();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateStrategy, setDuplicateStrategy] = useState('SKIP');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState('');

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['import-jobs', page],
    queryFn: async () => {
      const res = await api.get<ApiResponse<ImportJob[]> & Paginated<ImportJob>>('/imports', { params: { page, limit: 10 } });
      return res.data;
    },
  });

  const previewFile = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData();
      fd.append('file', f);
      const res = await api.post<ApiResponse<PreviewData>>('/imports/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return res.data.data;
    },
    onSuccess: (data) => {
      setPreview(data);
      setResult(null);
      const next: Record<string, string> = {};
      MAPPING_FIELDS.forEach((f) => {
        const match = data.headers.find((h) => h.toLowerCase().replace(/[^a-z]/g, '') === f.key.toLowerCase().replace(/[^a-z]/g, ''));
        if (match) next[f.key] = match;
      });
      setMapping(next);
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const runImport = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file selected');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mapping', JSON.stringify(mapping));
      fd.append('duplicateStrategy', duplicateStrategy);
      const res = await api.post<ApiResponse<ImportResult>>('/imports', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      return res.data.data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(
        tr(
          `Import finished: ${data.successCount}/${data.totalRecords} succeeded`,
          `Uingizaji umekamilika: ${data.successCount}/${data.totalRecords} zimefanikiwa`,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  });

  const downloadFile = async (path: string, filename: string, key: string) => {
    setExporting(key);
    try {
      const res = await api.get(path, { params: { format: 'CSV' }, responseType: 'blob' });
      downloadBlob(res.data as Blob, filename);
      toast.success(tr('Download started', 'Upakuaji umeanza'));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setExporting('');
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(null);
    setResult(null);
    setMapping({});
    if (f) previewFile.mutate(f);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={tr('Data import & export', 'Uingizaji na utoaji wa data')}
        subtitle={tr(
          'Migrate existing customer lists safely and export your data whenever you need it.',
          'Hamisha orodha zilizopo za wateja kwa usalama na toa data yako wakati wowote unapohitaji.',
        )}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader
              title={tr('Import customers', 'Ingiza wateja')}
              subtitle={tr('Upload Excel or CSV, map columns, then import.', 'Pakia Excel au CSV, unganisha safu, kisha ingiza.')}
            />
            <div className="px-4 pb-4">
              <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-cream/50 px-6 py-10 text-center transition hover:border-gold-400 hover:bg-gold-50/40"
              >
                <UploadCloud className="h-8 w-8 text-gold-500" />
                <span className="text-sm font-semibold text-ink-800">{file ? file.name : tr('Choose an Excel or CSV file', 'Chagua faili ya Excel au CSV')}</span>
                <span className="text-[11px] text-ink-400">
                  {tr('First row should contain column headers. Maximum 10MB.', 'Safu ya kwanza iwe na vichwa vya safu. Kiwango cha juu 10MB.')}
                </span>
              </button>

              {previewFile.isPending && <PageLoader label={tr('Reading file…', 'Inasoma faili…')} />}

              {preview && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink-800">{tr('Map columns', 'Unganisha safu')}</p>
                    <Badge tone="gold">
                      {tr(`${formatNumber(preview.totalRows)} rows detected`, `${formatNumber(preview.totalRows)} safu zimegunduliwa`)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {MAPPING_FIELDS.map((field) => (
                      <div key={field.key}>
                        <label className="mb-1 block text-[11px] font-semibold text-ink-600">
                          {tr(field.en, field.sw)}
                          {field.required && <span className="text-red-500"> *</span>}
                        </label>
                        <select
                          value={mapping[field.key] ?? ''}
                          onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                          className="input-base"
                        >
                          <option value="">{tr('Not mapped', 'Haijunganishwa')}</option>
                          {preview.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Select
                      label={tr('Duplicate phone numbers', 'Nambari za simu zinazorudia')}
                      value={duplicateStrategy}
                      onChange={(e) => setDuplicateStrategy(e.target.value)}
                      className="sm:w-56"
                    >
                      <option value="SKIP">{tr('Skip duplicates', 'Ruka zinazorudia')}</option>
                      <option value="UPDATE">{tr('Update existing', 'Sasisha zilizopo')}</option>
                    </Select>
                    <Button
                      className="sm:ml-auto"
                      leftIcon={<Upload className="h-4 w-4" />}
                      loading={runImport.isPending}
                      disabled={!mapping.fullName || !mapping.phone}
                      onClick={() => runImport.mutate()}
                    >
                      {tr(`Import ${formatNumber(preview.totalRows)} customers`, `Ingiza wateja ${formatNumber(preview.totalRows)}`)}
                    </Button>
                  </div>
                  {(!mapping.fullName || !mapping.phone) && (
                    <p className="text-[11px] text-amber-700">
                      {tr('Map both full name and phone before importing.', 'Unganisha jina kamili na simu kabla ya kuingiza.')}
                    </p>
                  )}
                </div>
              )}

              {result && (
                <div className="mt-4 rounded-xl border border-ink-100 p-4">
                  <div className="flex items-center gap-2">
                    {result.failedCount === 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-500" />
                    )}
                    <p className="text-xs font-semibold text-ink-900">{tr('Import completed', 'Uingizaji umekamilika')}</p>
                    <StatusBadge status={result.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-ink-50 px-3 py-2">
                      <p className="text-[9px] uppercase text-ink-400">{tr('Total', 'Jumla')}</p>
                      <p className="text-sm font-bold">{formatNumber(result.totalRecords)}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 px-3 py-2">
                      <p className="text-[9px] uppercase text-emerald-600">{tr('Imported', 'Zimeingizwa')}</p>
                      <p className="text-sm font-bold text-emerald-700">{formatNumber(result.successCount)}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 px-3 py-2">
                      <p className="text-[9px] uppercase text-amber-600">{tr('Duplicates', 'Zinazorudia')}</p>
                      <p className="text-sm font-bold text-amber-700">{formatNumber(result.duplicateCount)}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 px-3 py-2">
                      <p className="text-[9px] uppercase text-red-600">{tr('Failed', 'Zimeshindwa')}</p>
                      <p className="text-sm font-bold text-red-700">{formatNumber(result.failedCount)}</p>
                    </div>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-red-50/60 p-2 text-[11px] text-red-700">
                      {result.errors.slice(0, 20).map((e, i) => (
                        <p key={i}>
                          {tr(`Row ${e.rowNumber}:`, `Safu ${e.rowNumber}:`)} {e.message}
                        </p>
                      ))}
                    </div>
                  )}
                  {result.failedCount > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      leftIcon={<Download className="h-3.5 w-3.5" />}
                      onClick={() => downloadFile(`/imports/${result.jobId}/errors`, `import-errors-${result.jobId}.csv`, 'errors')}
                      loading={exporting === 'errors'}
                    >
                      {tr('Download error report', 'Pakua ripoti ya makosa')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={tr('Import history', 'Historia ya uingizaji')}
              subtitle={tr('Recent uploads and their results.', 'Upakiaji wa hivi karibuni na matokeo yake.')}
            />
            {jobsLoading ? (
              <PageLoader />
            ) : (jobs?.data ?? []).length === 0 ? (
              <EmptyState
                icon={<Upload className="h-6 w-6" />}
                title={tr('No imports yet', 'Bado hakuna uingizaji')}
                description={tr('Your customer imports will appear here.', 'Uingizaji wa wateja wako utaonekana hapa.')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>{tr('File', 'Faili')}</th>
                      <th>{tr('Status', 'Hali')}</th>
                      <th>{tr('Rows', 'Safu')}</th>
                      <th>{tr('Success', 'Imefanikiwa')}</th>
                      <th>{tr('Failed', 'Imeshindwa')}</th>
                      <th>{tr('Date', 'Tarehe')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs?.data.map((j) => (
                      <tr key={j.id}>
                        <td>
                          <p className="text-xs font-medium text-ink-800">{j.fileName}</p>
                          <p className="text-[10px] text-ink-400">{j.admin?.fullName ?? tr('System', 'Mfumo')}</p>
                        </td>
                        <td>
                          <StatusBadge status={j.status} />
                        </td>
                        <td className="text-xs">{formatNumber(j.totalRecords)}</td>
                        <td className="text-xs font-semibold text-emerald-600">{formatNumber(j.successCount)}</td>
                        <td className="text-xs font-semibold text-red-600">{formatNumber(j.failedCount)}</td>
                        <td className="text-[11px] text-ink-400">{formatDate(j.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {jobs?.pagination && jobs.pagination.totalPages > 1 && (
              <Pagination page={jobs.pagination.page} totalPages={jobs.pagination.totalPages} total={jobs.pagination.total} onChange={setPage} />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={tr('Export data', 'Toa data')}
              subtitle={tr('Download spreadsheets any time.', 'Pakua lahajedwali wakati wowote.')}
            />
            <div className="space-y-2 px-4 pb-4">
              <ExportRow
                title={tr('Customers', 'Wateja')}
                description={tr('Full customer database with consent flags.', 'Hifadhidata kamili ya wateja pamoja na alama za ridhaa.')}
                loading={exporting === 'customers'}
                onClick={() => downloadFile('/exports/customers', 'nalda-customers.xlsx', 'customers')}
              />
              <ExportRow
                title={tr('Orders', 'Maagizo')}
                description={tr('All orders with customer and item details.', 'Maagizo yote pamoja na maelezo ya mteja na bidhaa.')}
                loading={exporting === 'orders'}
                onClick={() => downloadFile('/exports/orders', 'nalda-orders.xlsx', 'orders')}
              />
              <ExportRow
                title={tr('Products', 'Bidhaa')}
                description={tr('Catalogue, pricing and stock levels.', 'Katalogi, bei na viwango vya hisa.')}
                loading={exporting === 'products'}
                onClick={() => downloadFile('/exports/products', 'nalda-products.xlsx', 'products')}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title={tr('Import tips', 'Vidokezo vya uingizaji')} />
            <ul className="space-y-2 px-4 pb-4 text-[11px] leading-relaxed text-ink-500">
              <li>{tr('Keep phone numbers in one column, ideally starting with +255.', 'Weka nambari za simu katika safu moja, ikiwezekana zikianza na +255.')}</li>
              <li>{tr('Date of birth accepts YYYY-MM-DD and common spreadsheet formats.', 'Tarehe ya kuzaliwa inakubali YYYY-MM-DD na miundo ya kawaida ya lahajedwali.')}</li>
              <li>{tr('Marketing consent accepts yes/no, true/false, 1/0.', 'Ridha ya masoko inakubali ndiyo/hapana, true/false, 1/0.')}</li>
              <li>{tr('Duplicates are matched by normalised phone number.', 'Zinazorudia hulinganishwa kwa nambari ya simu iliyosawazishwa.')}</li>
              <li>{tr('Large files are processed in batches — do not close the tab.', 'Faili kubwa huchakatwa kwa makundi — usifunge kichupo.')}</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ExportRow({ title, description, onClick, loading }: { title: string; description: string; onClick: () => void; loading: boolean }) {
  const { tr } = useLanguage();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-ink-800">{title}</p>
        <p className="truncate text-[10px] text-ink-400">{description}</p>
      </div>
      <Button size="sm" variant="secondary" loading={loading} leftIcon={<FileSpreadsheet className="h-3.5 w-3.5" />} onClick={onClick}>
        {tr('Export', 'Toa')}
      </Button>
    </div>
  );
}
