import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../config/permissions';
import { getDashboardStats, getReports } from '../services/dashboard.service';
import { getBusinessInfo } from '../services/settings.service';

const router = Router();

// Public business info (used by the login screen / login branding)
router.get(
  '/public/business-info',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await getBusinessInfo() });
  }),
);

router.use(authenticate);

router.get(
  '/dashboard',
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  asyncHandler(async (_req, res) => {
    const stats = await getDashboardStats();
    res.json({ success: true, data: stats });
  }),
);

router.get(
  '/reports',
  requirePermission(PERMISSIONS.REPORT_VIEW),
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string>;
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getFullYear(), to.getMonth() - 11, 1);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new Error('Invalid date range');
    }
    const reports = await getReports(from, to);
    res.json({ success: true, data: reports });
  }),
);

export default router;
