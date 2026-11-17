import { Request, Router } from 'express';
import { asyncHandler, paginated, parsePagination } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../config/permissions';
import * as backupService from '../services/backup.service';
import { recordAudit } from '../utils/audit';

const router = Router();
router.use(authenticate);

function audit(req: Request, action: string, entityId?: string, description?: string) {
  return recordAudit({
    adminId: req.admin?.id,
    action,
    entityType: 'Backup',
    entityId,
    description,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  });
}

router.get(
  '/',
  requirePermission(PERMISSIONS.BACKUP_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const result = await backupService.listBackups(page, limit, skip);
    res.json({ success: true, ...paginated(result.data, result.total, page, limit) });
  }),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.BACKUP_CREATE),
  asyncHandler(async (req, res) => {
    const backup = await backupService.createBackup('MANUAL', req.admin!.id);
    await audit(req, 'BACKUP_CREATED', backup.id, backup.fileName);
    res.status(201).json({ success: true, data: backup });
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.BACKUP_VIEW),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await backupService.getBackup(req.params.id) });
  }),
);

router.post(
  '/:id/verify',
  requirePermission(PERMISSIONS.BACKUP_VIEW),
  asyncHandler(async (req, res) => {
    const result = await backupService.verifyBackup(req.params.id);
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/:id/download',
  requirePermission(PERMISSIONS.BACKUP_VIEW),
  asyncHandler(async (req, res) => {
    const file = await backupService.getBackupFile(req.params.id);
    await audit(req, 'BACKUP_DOWNLOADED', req.params.id, file.fileName);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.buffer);
  }),
);

router.post(
  '/:id/restore',
  requirePermission(PERMISSIONS.BACKUP_RESTORE),
  asyncHandler(async (req, res) => {
    const result = await backupService.restoreBackup(req.params.id, req.admin!.id);
    await audit(req, 'BACKUP_RESTORED', req.params.id, 'Database restored from backup');
    res.json({ success: true, data: result });
  }),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.BACKUP_CREATE),
  asyncHandler(async (req, res) => {
    await backupService.deleteBackup(req.params.id);
    await audit(req, 'BACKUP_DELETED', req.params.id);
    res.json({ success: true, data: { message: 'Backup deleted' } });
  }),
);

export default router;
