import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { normalizePhone } from '../utils/phone';
import { ApiError } from '../utils/errors';
import { generateCustomerCode } from '../utils/codes';
import { logActivity } from './activity.service';

export interface ColumnMapping {
  fullName?: string;
  phone?: string;
  whatsappPhone?: string;
  alternatePhone?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  location?: string;
  physicalAddress?: string;
  source?: string;
  notes?: string;
  marketingConsent?: string;
}

type SheetRow = Record<string, unknown>;

function readSheet(buffer: Buffer): SheetRow[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch {
    throw ApiError.badRequest('Unable to read file. Upload a valid .xlsx, .xls or .csv file.');
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw ApiError.badRequest('The uploaded file has no worksheets');
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '', raw: false });
  return rows;
}

function sheetHeaders(rows: SheetRow[]): string[] {
  const headers = new Set<string>();
  for (const row of rows.slice(0, 5)) {
    Object.keys(row).forEach((k) => headers.add(k));
  }
  return Array.from(headers);
}

function truthy(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'ndiyo', 'ndio'].includes(s);
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

function mapRow(row: SheetRow, mapping: ColumnMapping) {
  const get = (key?: string) => (key ? row[key] : undefined);
  return {
    fullName: String(get(mapping.fullName) ?? '').trim(),
    phoneRaw: String(get(mapping.phone) ?? '').trim(),
    whatsappRaw: mapping.whatsappPhone ? String(get(mapping.whatsappPhone) ?? '').trim() : '',
    alternateRaw: mapping.alternatePhone ? String(get(mapping.alternatePhone) ?? '').trim() : '',
    email: mapping.email ? String(get(mapping.email) ?? '').trim() : '',
    genderRaw: mapping.gender ? String(get(mapping.gender) ?? '').trim().toUpperCase() : '',
    dateOfBirth: parseDate(get(mapping.dateOfBirth)),
    location: mapping.location ? String(get(mapping.location) ?? '').trim() : '',
    physicalAddress: mapping.physicalAddress ? String(get(mapping.physicalAddress) ?? '').trim() : '',
    sourceRaw: mapping.source ? String(get(mapping.source) ?? '').trim().toUpperCase() : '',
    notes: mapping.notes ? String(get(mapping.notes) ?? '').trim() : '',
    marketingConsent: mapping.marketingConsent ? truthy(get(mapping.marketingConsent)) : false,
  };
}

export async function previewImport(buffer: Buffer) {
  const rows = readSheet(buffer);
  if (!rows.length) throw ApiError.badRequest('The uploaded file contains no data rows');
  return {
    headers: sheetHeaders(rows),
    rows: rows.slice(0, 25),
    totalRows: rows.length,
  };
}

export interface ImportOptions {
  mapping: ColumnMapping;
  duplicateStrategy?: 'SKIP' | 'UPDATE';
  fileName: string;
  fileType: string;
  adminId?: string | null;
}

export async function executeImport(buffer: Buffer, options: ImportOptions) {
  const rows = readSheet(buffer);
  if (!rows.length) throw ApiError.badRequest('The uploaded file contains no data rows');
  if (!options.mapping.fullName) throw ApiError.validation('Map the full name column before importing');
  if (!options.mapping.phone) throw ApiError.validation('Map the phone number column before importing');

  const job = await prisma.importJob.create({
    data: {
      fileName: options.fileName,
      fileType: options.fileType,
      status: 'PROCESSING',
      adminId: options.adminId ?? null,
      totalRecords: rows.length,
      columnMapping: options.mapping as unknown as Prisma.InputJsonValue,
      duplicateStrategy: options.duplicateStrategy ?? 'SKIP',
    },
  });

  let successCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  const errors: { rowNumber: number; message: string; rawData: SheetRow }[] = [];

  // Process in small batches to keep memory and DB pressure predictable.
  const BATCH_SIZE = 100;
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    for (let i = 0; i < batch.length; i++) {
      const rowNumber = start + i + 2; // +2 for header and 1-index
      const row = batch[i];
      const mapped = mapRow(row, options.mapping);

      if (!mapped.fullName) {
        failedCount++;
        errors.push({ rowNumber, message: 'Full name is required', rawData: row });
        continue;
      }
      const phone = normalizePhone(mapped.phoneRaw);
      if (!phone) {
        failedCount++;
        errors.push({ rowNumber, message: `Invalid phone number: "${mapped.phoneRaw}"`, rawData: row });
        continue;
      }

      try {
        const existing = await prisma.customer.findFirst({
          where: { deletedAt: null, OR: [{ phone }, { whatsappPhone: phone }] },
        });

        if (existing) {
          duplicateCount++;
          if ((options.duplicateStrategy ?? 'SKIP') === 'UPDATE') {
            const updateData: Prisma.CustomerUpdateInput = {
              fullName: mapped.fullName,
              ...(mapped.whatsappRaw ? { whatsappPhone: normalizePhone(mapped.whatsappRaw) } : {}),
              ...(mapped.alternateRaw ? { alternatePhone: normalizePhone(mapped.alternateRaw) } : {}),
              ...(mapped.email ? { email: mapped.email.toLowerCase() } : {}),
              ...(mapped.location ? { location: mapped.location } : {}),
              ...(mapped.physicalAddress ? { physicalAddress: mapped.physicalAddress } : {}),
              ...(mapped.notes ? { notes: mapped.notes } : {}),
            };
            await prisma.customer.update({ where: { id: existing.id }, data: updateData });
            successCount++;
          }
          continue;
        }

        const gender = ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'].includes(mapped.genderRaw)
          ? (mapped.genderRaw as Prisma.CustomerCreateInput['gender'])
          : 'UNSPECIFIED';

        const source = [
          'MANUAL',
          'IMPORT',
          'WHATSAPP',
          'INSTAGRAM',
          'FACEBOOK',
          'WALK_IN',
          'REFERRAL',
          'OTHER',
        ].includes(mapped.sourceRaw)
          ? (mapped.sourceRaw as Prisma.CustomerCreateInput['source'])
          : 'IMPORT';

        const customerCode = await prisma.$transaction(async (tx) => {
          const code = await generateCustomerCode(tx);
          const created = await tx.customer.create({
            data: {
              customerCode: code,
              fullName: mapped.fullName,
              phone,
              whatsappPhone: normalizePhone(mapped.whatsappRaw) ?? phone,
              alternatePhone: mapped.alternateRaw ? normalizePhone(mapped.alternateRaw) : null,
              email: mapped.email ? mapped.email.toLowerCase() : null,
              gender,
              dateOfBirth: mapped.dateOfBirth,
              location: mapped.location || null,
              physicalAddress: mapped.physicalAddress || null,
              source,
              notes: mapped.notes || null,
              marketingConsent: mapped.marketingConsent,
              whatsappOptIn: mapped.marketingConsent,
            },
          });
          return created;
        });

        await logActivity({
          customerId: customerCode.id,
          adminId: options.adminId,
          type: 'IMPORT',
          title: 'Customer imported from spreadsheet',
          source: 'IMPORT',
          metadata: { importJobId: job.id, fileName: options.fileName },
        });

        successCount++;
      } catch (err) {
        failedCount++;
        errors.push({
          rowNumber,
          message: err instanceof Error ? err.message : 'Unknown import error',
          rawData: row,
        });
      }
    }
  }

  const status = failedCount === 0 ? 'COMPLETED' : successCount > 0 ? 'PARTIAL' : 'FAILED';

  let errorReportPath: string | null = null;
  if (errors.length) {
    const dir = path.resolve(process.cwd(), 'tmp', 'imports');
    await fs.mkdir(dir, { recursive: true });
    const csvEscape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['Row,Error,Raw Data'];
    for (const e of errors) {
      lines.push(`${e.rowNumber},${csvEscape(e.message)},${csvEscape(JSON.stringify(e.rawData))}`);
    }
    errorReportPath = path.join(dir, `import-errors-${job.id}.csv`);
    await fs.writeFile(errorReportPath, lines.join('\n'), 'utf-8');
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status,
      successCount,
      failedCount,
      duplicateCount,
      completedAt: new Date(),
      errorReportPath,
      errorsLog: errors.slice(0, 200) as unknown as Prisma.InputJsonValue,
    },
  });

  if (errors.length) {
    await prisma.importRowError.createMany({
      data: errors.slice(0, 1000).map((e) => ({
        importJobId: job.id,
        rowNumber: e.rowNumber,
        rawData: e.rawData as unknown as Prisma.InputJsonValue,
        errorMessage: e.message,
      })),
    });
  }

  return {
    jobId: job.id,
    status,
    totalRecords: rows.length,
    successCount,
    failedCount,
    duplicateCount,
    errors: errors.slice(0, 100),
    errorReportPath,
  };
}

export async function listImportJobs(page: number, limit: number, skip: number) {
  const [data, total] = await Promise.all([
    prisma.importJob.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { admin: { select: { id: true, fullName: true } } },
    }),
    prisma.importJob.count(),
  ]);
  return { data, total };
}

export async function getImportJob(id: string) {
  const job = await prisma.importJob.findUnique({
    where: { id },
    include: {
      admin: { select: { id: true, fullName: true } },
      errors: { orderBy: { rowNumber: 'asc' }, take: 500 },
    },
  });
  if (!job) throw ApiError.notFound('Import job not found');
  return job;
}

export async function getImportErrorReport(jobId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) throw ApiError.notFound('Import job not found');
  if (!job.errorReportPath) throw ApiError.notFound('No error report available for this import');
  const buffer = await fs.readFile(job.errorReportPath);
  return { buffer, fileName: `import-errors-${job.id}.csv` };
}

// ------------------------------------------------------------
// Export
// ------------------------------------------------------------

const CUSTOMER_EXPORT_FIELDS: Record<string, (c: Record<string, unknown>) => unknown> = {
  customerCode: (c) => c.customerCode,
  fullName: (c) => c.fullName,
  phone: (c) => c.phone,
  whatsappPhone: (c) => c.whatsappPhone,
  email: (c) => c.email,
  gender: (c) => c.gender,
  dateOfBirth: (c) => (c.dateOfBirth ? new Date(c.dateOfBirth as string).toISOString().slice(0, 10) : ''),
  location: (c) => c.location,
  physicalAddress: (c) => c.physicalAddress,
  source: (c) => c.source,
  status: (c) => c.status,
  totalSpent: (c) => Number(c.totalSpent ?? 0),
  totalOrders: (c) => c.totalOrders,
  lastPurchaseAt: (c) => c.lastPurchaseAt,
  marketingConsent: (c) => c.marketingConsent,
  whatsappOptIn: (c) => c.whatsappOptIn,
  notes: (c) => c.notes,
  createdAt: (c) => c.createdAt,
};

export async function exportCustomers(params: {
  format: 'XLSX' | 'CSV';
  fields?: string[];
  customerIds?: string[];
  filters?: Prisma.CustomerWhereInput;
  adminId?: string | null;
}) {
  const fields = (params.fields?.length ? params.fields : Object.keys(CUSTOMER_EXPORT_FIELDS)).filter(
    (f) => CUSTOMER_EXPORT_FIELDS[f],
  );
  if (!fields.length) throw ApiError.validation('Select at least one valid export field');

  const where: Prisma.CustomerWhereInput = { deletedAt: null, ...(params.filters ?? {}) };
  if (params.customerIds?.length) where.id = { in: params.customerIds };

  const customers = await prisma.customer.findMany({
    where,
    include: { tags: { include: { tag: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20000,
  });

  const rows = customers.map((c) => {
    const record = c as unknown as Record<string, unknown>;
    const row: Record<string, unknown> = {};
    for (const f of fields) row[f] = CUSTOMER_EXPORT_FIELDS[f](record);
    if (fields.includes('tags')) row.tags = c.tags.map((t) => t.tag.name).join(', ');
    return row;
  });

  const job = await prisma.exportJob.create({
    data: {
      type: 'CUSTOMERS',
      format: params.format,
      status: 'PROCESSING',
      adminId: params.adminId ?? null,
      filters: { customerIds: params.customerIds, fields } as Prisma.InputJsonValue,
      fields,
      recordCount: rows.length,
    },
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Customers');

  const fileName = `nalda-customers-${new Date().toISOString().slice(0, 10)}.${params.format.toLowerCase()}`;
  const buffer =
    params.format === 'CSV'
      ? Buffer.from(XLSX.utils.sheet_to_csv(ws), 'utf-8')
      : (XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);

  await prisma.exportJob.update({
    where: { id: job.id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  return {
    buffer,
    fileName,
    contentType:
      params.format === 'CSV'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export async function exportTable(params: {
  type: 'ORDERS' | 'PRODUCTS';
  format: 'XLSX' | 'CSV';
  adminId?: string | null;
}) {
  let rows: Record<string, unknown>[] = [];
  if (params.type === 'ORDERS') {
    const orders = await prisma.order.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { fullName: true, phone: true, customerCode: true } }, items: true },
      orderBy: { orderDate: 'desc' },
      take: 20000,
    });
    rows = orders.map((o) => ({
      orderNumber: o.orderNumber,
      customerCode: o.customer.customerCode,
      customerName: o.customer.fullName,
      phone: o.customer.phone,
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalAmount: Number(o.totalAmount),
      amountPaid: Number(o.amountPaid),
      items: o.items.map((i) => `${i.productName} x${i.quantity}`).join('; '),
      orderDate: o.orderDate,
    }));
  } else {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: 20000,
    });
    rows = products.map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category?.name ?? '',
      brand: p.brand ?? '',
      sellingPrice: Number(p.sellingPrice),
      stockQuantity: p.stockQuantity,
      minStockLevel: p.minStockLevel,
      status: p.status,
      isNewArrival: p.isNewArrival,
      purchaseCount: p.purchaseCount,
    }));
  }

  const job = await prisma.exportJob.create({
    data: {
      type: params.type,
      format: params.format,
      status: 'PROCESSING',
      adminId: params.adminId ?? null,
      recordCount: rows.length,
    },
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, params.type);

  const fileName = `nalda-${params.type.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${params.format.toLowerCase()}`;
  const buffer =
    params.format === 'CSV'
      ? Buffer.from(XLSX.utils.sheet_to_csv(ws), 'utf-8')
      : (XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer);

  await prisma.exportJob.update({
    where: { id: job.id },
    data: { status: 'COMPLETED', completedAt: new Date() },
  });

  return {
    buffer,
    fileName,
    contentType:
      params.format === 'CSV'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

export async function listExportJobs(page: number, limit: number, skip: number) {
  const [data, total] = await Promise.all([
    prisma.exportJob.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { admin: { select: { id: true, fullName: true } } },
    }),
    prisma.exportJob.count(),
  ]);
  return { data, total };
}
