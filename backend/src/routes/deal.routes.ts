import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import * as dealService from '../services/deal.service';
import { createDealSchema, createPipelineSchema, moveDealSchema, updateDealSchema } from '../validators/schemas';

const router = Router();
router.use(authenticate);

router.get(
  '/pipelines',
  requirePermission(PERMISSIONS.DEAL_VIEW),
  asyncHandler(async (_req, res) => {
    const pipelines = await dealService.listPipelines();
    res.json({ success: true, data: pipelines });
  }),
);

router.post(
  '/pipelines',
  requirePermission(PERMISSIONS.DEAL_CREATE),
  validate(createPipelineSchema),
  asyncHandler(async (req, res) => {
    const pipeline = await dealService.createPipeline(req.body);
    res.status(201).json({ success: true, data: pipeline });
  }),
);

router.get(
  '/',
  requirePermission(PERMISSIONS.DEAL_VIEW),
  asyncHandler(async (req, res) => {
    const q = req.query as Record<string, string>;
    const deals = await dealService.listDeals({
      pipelineId: q.pipelineId,
      stageId: q.stageId,
      status: q.status as 'OPEN' | 'WON' | 'LOST' | undefined,
      customerId: q.customerId,
      search: q.search,
    });
    res.json({ success: true, data: deals });
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.DEAL_VIEW),
  asyncHandler(async (req, res) => {
    const deal = await dealService.getDeal(req.params.id);
    res.json({ success: true, data: deal });
  }),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.DEAL_CREATE),
  validate(createDealSchema),
  asyncHandler(async (req, res) => {
    const deal = await dealService.createDeal({ ...req.body, adminId: req.admin!.id });
    res.status(201).json({ success: true, data: deal });
  }),
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.DEAL_UPDATE),
  validate(updateDealSchema),
  asyncHandler(async (req, res) => {
    const deal = await dealService.updateDeal(req.params.id, req.body);
    res.json({ success: true, data: deal });
  }),
);

router.post(
  '/:id/move',
  requirePermission(PERMISSIONS.DEAL_UPDATE),
  validate(moveDealSchema),
  asyncHandler(async (req, res) => {
    const deal = await dealService.moveDealStage(req.params.id, req.body.stageId, req.admin!.id, req.body.note);
    res.json({ success: true, data: deal });
  }),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.DEAL_DELETE),
  asyncHandler(async (req, res) => {
    await dealService.deleteDeal(req.params.id);
    res.json({ success: true, data: { message: 'Deal deleted' } });
  }),
);

export default router;
