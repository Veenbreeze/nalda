import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import * as settingsService from '../services/settings.service';
import { updateSettingsSchema } from '../validators/schemas';
import { recordAudit } from '../utils/audit';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.SETTINGS_VIEW),
  asyncHandler(async (_req, res) => {
    const settings = await settingsService.listSettings();
    res.json({ success: true, data: settings });
  }),
);

router.put(
  '/',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate(updateSettingsSchema),
  asyncHandler(async (req, res) => {
    const results = await settingsService.updateSettings(
      req.body.settings.map((s: { key: string; value: unknown; description?: string; isPublic?: boolean }) => ({
        key: s.key,
        value: s.value as never,
        description: s.description,
        isPublic: s.isPublic,
      })),
    );
    await recordAudit({
      adminId: req.admin!.id,
      action: 'SETTINGS_UPDATED',
      entityType: 'SystemSetting',
      description: `Updated ${results.length} setting(s)`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] ?? null,
    });
    res.json({ success: true, data: results });
  }),
);

export default router;
