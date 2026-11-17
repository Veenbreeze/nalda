import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import * as automationService from '../services/automation.service';
import { createAutomationSchema, updateAutomationSchema } from '../validators/schemas';

const router = Router();
router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.AUTOMATION_VIEW),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await automationService.listWorkflows() });
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.AUTOMATION_VIEW),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await automationService.getWorkflow(req.params.id) });
  }),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.AUTOMATION_MANAGE),
  validate(createAutomationSchema),
  asyncHandler(async (req, res) => {
    const workflow = await automationService.createWorkflow(req.body);
    res.status(201).json({ success: true, data: workflow });
  }),
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.AUTOMATION_MANAGE),
  validate(updateAutomationSchema),
  asyncHandler(async (req, res) => {
    const workflow = await automationService.updateWorkflow(req.params.id, req.body);
    res.json({ success: true, data: workflow });
  }),
);

router.post(
  '/:id/trigger',
  requirePermission(PERMISSIONS.AUTOMATION_MANAGE),
  asyncHandler(async (req, res) => {
    const result = await automationService.triggerWorkflow(req.params.id, req.admin!.id);
    res.json({ success: true, data: result });
  }),
);

export default router;
