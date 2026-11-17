import { Request, Router } from 'express';
import { Prisma } from '@prisma/client';
import { asyncHandler, paginated, parsePagination } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { uploadSpreadsheet } from '../middleware/upload';
import { PERMISSIONS } from '../config/permissions';
import * as importExport from '../services/import-export.service';
import { ApiError } from '../utils/errors';
import { recordAudit } from '../utils/audit';

const router = Router();
router.use(authenticate);

function audit(req: Request, action: string, description?: string) {
  return recordAudit({
    adminId: req.admin?.id,
    action,
    entityType: 'DataExchange',
    description,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  });
}

router.post(
  '/imports/preview',
  requirePermission(PERMISSIONS.CUSTOMER_IMPORT),
  uploadSpreadsheet.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file uploaded');
    const preview = await importExport.previewImport(req.file.buffer);
    res.json({ success: true, data: preview });
  }),
);

router.post(
  '/imports',
  requirePermission(PERMISSIONS.CUSTOMER_IMPORT),
  uploadSpreadsheet.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest('No file uploaded');
    let mapping = req.body.mapping;
    if (typeof mapping === 'string') {
      try {
        mapping = JSON.parse(mapping);
      } catch {
        throw ApiError.badRequest('Invalid column mapping');
      }
    }
    if (!mapping || typeof mapping !== 'object') throw ApiError.badRequest('Column mapping is required');

    const result = await importExport.executeImport(req.file.buffer, {
      mapping,
      duplicateStrategy: req.body.duplicateStrategy,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      adminId: req.admin!.id,
    });

    await audit(req, 'CUSTOMERS_IMPORTED', `${result.successCount}/${result.totalRecords} imported from ${req.file.originalname}`);
    res.status(201).json({ success: true, data: result });
  }),
);

router.get(
  '/imports',
  requirePermission(PERMISSIONS.CUSTOMER_IMPORT),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const result = await importExport.listImportJobs(page, limit, skip);
    res.json({ success: true, ...paginated(result.data, result.total, page, limit) });
  }),
);

router.get(
  '/imports/:id',
  requirePermission(PERMISSIONS.CUSTOMER_IMPORT),
  asyncHandler(async (req, res) => {
    const job = await importExport.getImportJob(req.params.id);
    res.json({ success: true, data: job });
  }),
);

router.get(
  '/imports/:id/errors',
  requirePermission(PERMISSIONS.CUSTOMER_IMPORT),
  asyncHandler(async (req, res) => {
    const report = await importExport.getImportErrorReport(req.params.id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    res.send(report.buffer);
  }),
);

router.get(
  '/exports/customers',
  requirePermission(PERMISSIONS.CUSTOMER_EXPORT),
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string>;
    const format = (q.format ?? 'XLSX').toUpperCase() === 'CSV' ? 'CSV' : 'XLSX';
    const fields = q.fields ? q.fields.split(',').map((f) => f.trim()).filter(Boolean) : undefined;
    const customerIds = q.customerIds ? q.customerIds.split(',').filter(Boolean) : undefined;

    const where: Prisma.CustomerWhereInput = { deletedAt: null };
    if (q.status) where.status = q.status as Prisma.CustomerWhereInput['status'];
    if (q.source) where.source = q.source as Prisma.CustomerWhereInput['source'];
    if (q.location) where.location = { contains: q.location, mode: 'insensitive' };
    if (q.search) {
      where.OR = [
        { fullName: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search } },
        { customerCode: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }

    const file = await importExport.exportCustomers({
      format,
      fields,
      customerIds,
      filters: where,
      adminId: req.admin!.id,
    });
    await audit(req, 'CUSTOMERS_EXPORTED', `${format} export`);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.buffer);
  }),
);

router.get(
  '/exports/orders',
  requirePermission(PERMISSIONS.REPORT_EXPORT),
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string>;
    const format = (q.format ?? 'XLSX').toUpperCase() === 'CSV' ? 'CSV' : 'XLSX';
    const file = await importExport.exportTable({ type: 'ORDERS', format, adminId: req.admin!.id });
    await audit(req, 'ORDERS_EXPORTED', `${format} export`);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.buffer);
  }),
);

router.get(
  '/exports/products',
  requirePermission(PERMISSIONS.REPORT_EXPORT),
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string>;
    const format = (q.format ?? 'XLSX').toUpperCase() === 'CSV' ? 'CSV' : 'XLSX';
    const file = await importExport.exportTable({ type: 'PRODUCTS', format, adminId: req.admin!.id });
    await audit(req, 'PRODUCTS_EXPORTED', `${format} export`);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.buffer);
  }),
);

router.get(
  '/exports',
  requirePermission(PERMISSIONS.CUSTOMER_EXPORT),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const result = await importExport.listExportJobs(page, limit, skip);
    res.json({ success: true, ...paginated(result.data, result.total, page, limit) });
  }),
);

export default router;
