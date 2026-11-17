import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { asyncHandler, paginated, parsePagination } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../config/permissions';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const where: Prisma.AuditLogWhereInput = {};
    if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
    if (q.entityType) where.entityType = q.entityType;
    if (q.adminId) where.adminId = q.adminId;
    if (q.search) {
      where.OR = [
        { description: { contains: q.search, mode: 'insensitive' } },
        { action: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { admin: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ success: true, ...paginated(data, total, page, limit) });
  }),
);

export default router;
