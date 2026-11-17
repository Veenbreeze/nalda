import { Request, Router } from 'express';
import { asyncHandler, paginated, parsePagination } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import * as customerService from '../services/customer.service';
import { createNoteSchema, createCustomerSchema, updateCustomerSchema, createInterestSchema } from '../validators/schemas';
import { recordAudit } from '../utils/audit';
import { prisma } from '../config/database';
import { ApiError } from '../utils/errors';

const router = Router();
router.use(authenticate);

function audit(req: Request, action: string, entityType: string, entityId?: string, description?: string) {
  return recordAudit({
    adminId: req.admin?.id,
    action,
    entityType,
    entityId,
    description,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  });
}

router.get(
  '/',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const filters: customerService.CustomerListFilters = {
      search: q.search,
      status: q.status as customerService.CustomerListFilters['status'],
      source: q.source as customerService.CustomerListFilters['source'],
      location: q.location,
      tagId: q.tagId,
      includeArchived: q.includeArchived === 'true',
      orderBy: q.orderBy as customerService.CustomerListFilters['orderBy'],
      orderDir: q.orderDir as 'asc' | 'desc' | undefined,
      marketingConsent: q.marketingConsent === undefined ? undefined : q.marketingConsent === 'true',
      whatsappOptIn: q.whatsappOptIn === undefined ? undefined : q.whatsappOptIn === 'true',
      createdFrom: q.from ? new Date(q.from) : undefined,
      createdTo: q.to ? new Date(q.to) : undefined,
      lastPurchaseBefore: q.lastPurchaseBefore ? new Date(q.lastPurchaseBefore) : undefined,
    };
    const result = await customerService.listCustomers({ page, limit, skip, filters });
    res.json({ success: true, ...paginated(result.data, result.total, page, limit) });
  }),
);

router.get(
  '/segments',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  asyncHandler(async (_req, res) => {
    const segments = await customerService.getSegments();
    res.json({ success: true, data: segments });
  }),
);

router.get(
  '/duplicates',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  asyncHandler(async (req, res) => {
    const phone = String(req.query.phone ?? '');
    if (!phone) throw ApiError.badRequest('phone query parameter is required');
    const duplicates = await customerService.findDuplicates(phone, req.query.email ? String(req.query.email) : undefined);
    res.json({ success: true, data: duplicates });
  }),
);

router.get(
  '/tags',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  asyncHandler(async (_req, res) => {
    const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: tags });
  }),
);

router.post(
  '/tags',
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw ApiError.badRequest('Tag name is required');
    const tag = await prisma.tag.upsert({
      where: { name },
      create: { name, color: req.body?.color ?? '#C9A227' },
      update: {},
    });
    res.status(201).json({ success: true, data: tag });
  }),
);

router.post(
  '/merge',
  requirePermission(PERMISSIONS.CUSTOMER_MERGE),
  asyncHandler(async (req, res) => {
    const { primaryId, secondaryId } = req.body ?? {};
    if (!primaryId || !secondaryId) throw ApiError.badRequest('primaryId and secondaryId are required');
    const result = await customerService.mergeCustomers(primaryId, secondaryId, req.admin!.id);
    await audit(req, 'CUSTOMER_MERGED', 'Customer', primaryId, `Merged ${secondaryId} into ${primaryId}`);
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  asyncHandler(async (req, res) => {
    const result = await customerService.getCustomerById(req.params.id);
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/:id/timeline',
  requirePermission(PERMISSIONS.CUSTOMER_VIEW),
  asyncHandler(async (req, res) => {
    const limit = Math.min(300, Number(req.query.limit) || 100);
    const timeline = await customerService.getCustomerTimeline(req.params.id, limit);
    res.json({ success: true, data: timeline });
  }),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.CUSTOMER_CREATE),
  validate(createCustomerSchema),
  asyncHandler(async (req, res) => {
    const customer = await customerService.createCustomer(req.body, req.admin!.id);
    await audit(req, 'CUSTOMER_CREATED', 'Customer', customer.id, `Created ${customer.customerCode}`);
    res.status(201).json({ success: true, data: customer });
  }),
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate(updateCustomerSchema),
  asyncHandler(async (req, res) => {
    const customer = await customerService.updateCustomer(req.params.id, req.body, req.admin!.id);
    await audit(req, 'CUSTOMER_UPDATED', 'Customer', customer.id);
    res.json({ success: true, data: customer });
  }),
);

router.post(
  '/:id/archive',
  requirePermission(PERMISSIONS.CUSTOMER_ARCHIVE),
  asyncHandler(async (req, res) => {
    const customer = await customerService.archiveCustomer(req.params.id, req.admin!.id);
    await audit(req, 'CUSTOMER_ARCHIVED', 'Customer', req.params.id);
    res.json({ success: true, data: customer });
  }),
);

router.post(
  '/:id/restore',
  requirePermission(PERMISSIONS.CUSTOMER_ARCHIVE),
  asyncHandler(async (req, res) => {
    const customer = await customerService.restoreCustomer(req.params.id, req.admin!.id);
    await audit(req, 'CUSTOMER_RESTORED', 'Customer', req.params.id);
    res.json({ success: true, data: customer });
  }),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMER_DELETE),
  asyncHandler(async (req, res) => {
    await customerService.softDeleteCustomer(req.params.id, req.admin!.id);
    await audit(req, 'CUSTOMER_DELETED', 'Customer', req.params.id);
    res.json({ success: true, data: { message: 'Customer deleted' } });
  }),
);

router.post(
  '/:id/interests',
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate(createInterestSchema),
  asyncHandler(async (req, res) => {
    const interest = await customerService.addProductInterest({
      customerId: req.params.id,
      ...req.body,
      adminId: req.admin!.id,
    });
    await audit(req, 'CUSTOMER_INTEREST_ADDED', 'Customer', req.params.id);
    res.status(201).json({ success: true, data: interest });
  }),
);

router.delete(
  '/interests/:interestId',
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  asyncHandler(async (req, res) => {
    await customerService.removeProductInterest(req.params.interestId);
    res.json({ success: true, data: { message: 'Interest removed' } });
  }),
);

router.post(
  '/:id/notes',
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  validate(createNoteSchema),
  asyncHandler(async (req, res) => {
    const note = await prisma.note.create({
      data: { customerId: req.params.id, adminId: req.admin!.id, body: req.body.body },
      include: { admin: { select: { id: true, fullName: true } } },
    });
    await prisma.activity.create({
      data: {
        customerId: req.params.id,
        adminId: req.admin!.id,
        type: 'NOTE',
        title: 'Note added',
        description: req.body.body.slice(0, 200),
      },
    });
    await audit(req, 'CUSTOMER_NOTE_ADDED', 'Customer', req.params.id);
    res.status(201).json({ success: true, data: note });
  }),
);

router.delete(
  '/notes/:noteId',
  requirePermission(PERMISSIONS.CUSTOMER_UPDATE),
  asyncHandler(async (req, res) => {
    await prisma.note.delete({ where: { id: req.params.noteId } });
    res.json({ success: true, data: { message: 'Note deleted' } });
  }),
);

export default router;
