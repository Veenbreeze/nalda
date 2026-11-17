import { Router } from 'express';
import { ActivityType, TaskStatus } from '@prisma/client';
import { asyncHandler, paginated, parsePagination } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import * as activityService from '../services/activity.service';
import { createActivitySchema, updateActivitySchema } from '../validators/schemas';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.ACTIVITY_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const result = await activityService.listActivities({
      page,
      limit,
      skip,
      customerId: q.customerId,
      type: q.type as ActivityType | undefined,
      isTask: q.isTask === undefined ? undefined : q.isTask === 'true',
      assignedToId: q.assignedToId,
      status: q.taskStatus as TaskStatus | undefined,
      overdue: q.overdue === 'true',
      search: q.search,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
    });
    res.json({ success: true, ...paginated(result.data, result.total, page, limit) });
  }),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.ACTIVITY_CREATE),
  validate(createActivitySchema),
  asyncHandler(async (req, res) => {
    const activity = await activityService.logActivity({
      ...req.body,
      adminId: req.admin!.id,
      assignedToId: req.body.assignedToId ?? null,
    });
    res.status(201).json({ success: true, data: activity });
  }),
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ACTIVITY_UPDATE),
  validate(updateActivitySchema),
  asyncHandler(async (req, res) => {
    const activity = await activityService.updateActivity(req.params.id, req.body);
    res.json({ success: true, data: activity });
  }),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.ACTIVITY_DELETE),
  asyncHandler(async (req, res) => {
    await activityService.deleteActivity(req.params.id);
    res.json({ success: true, data: { message: 'Activity deleted' } });
  }),
);

export default router;
