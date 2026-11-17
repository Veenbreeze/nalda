import { Router } from 'express';
import { asyncHandler, paginated, parsePagination } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import * as whatsappService from '../services/whatsapp.service';
import * as campaignService from '../services/campaign.service';
import { isWhatsAppConfigured } from '../integrations/whatsapp/client';
import {
  conversationStatusSchema,
  createCampaignSchema,
  createTemplateSchema,
  sendWhatsAppSchema,
} from '../validators/schemas';

const router = Router();
router.use(authenticate);

router.get(
  '/config-status',
  requirePermission(PERMISSIONS.WHATSAPP_VIEW),
  asyncHandler(async (_req, res) => {
    res.json({
      success: true,
      data: {
        configured: isWhatsAppConfigured(),
        mode: isWhatsAppConfigured() ? 'live' : 'dry-run',
      },
    });
  }),
);

router.get(
  '/inbox',
  requirePermission(PERMISSIONS.WHATSAPP_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const result = await whatsappService.getInbox({
      page,
      limit,
      skip,
      search: q.search,
      status: q.status,
      unreadOnly: q.unreadOnly === 'true',
    });
    res.json({ success: true, ...paginated(result.data, result.total, page, limit) });
  }),
);

router.get(
  '/conversations/:id',
  requirePermission(PERMISSIONS.WHATSAPP_VIEW),
  asyncHandler(async (req, res) => {
    const conversation = await whatsappService.getConversation(req.params.id);
    res.json({ success: true, data: conversation });
  }),
);

router.post(
  '/conversations/:id/read',
  requirePermission(PERMISSIONS.WHATSAPP_VIEW),
  asyncHandler(async (req, res) => {
    const conversation = await whatsappService.markConversationRead(req.params.id);
    res.json({ success: true, data: conversation });
  }),
);

router.patch(
  '/conversations/:id/status',
  requirePermission(PERMISSIONS.WHATSAPP_VIEW),
  validate(conversationStatusSchema),
  asyncHandler(async (req, res) => {
    const conversation = await whatsappService.setConversationStatus(req.params.id, req.body.status);
    res.json({ success: true, data: conversation });
  }),
);

router.post(
  '/conversations/:id/messages',
  requirePermission(PERMISSIONS.WHATSAPP_SEND),
  validate(sendWhatsAppSchema),
  asyncHandler(async (req, res) => {
    const result = await whatsappService.sendFromConversation(req.params.id, req.body.body, req.admin!.id);
    res.status(201).json({ success: true, data: result });
  }),
);

router.post(
  '/send',
  requirePermission(PERMISSIONS.WHATSAPP_SEND),
  asyncHandler(async (req, res) => {
    const { customerId, body } = req.body ?? {};
    if (!customerId || !body) throw new Error('customerId and body are required');
    const result = await whatsappService.sendMessageToCustomer(customerId, body, req.admin!.id);
    res.status(201).json({ success: true, data: result });
  }),
);

// ---------------- Campaigns ----------------

router.get(
  '/campaigns',
  requirePermission(PERMISSIONS.WHATSAPP_CAMPAIGN),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const result = await campaignService.listCampaigns({
      page,
      limit,
      skip,
      status: (req.query as Record<string, string>).status,
    });
    res.json({ success: true, ...paginated(result.data, result.total, page, limit) });
  }),
);

router.post(
  '/campaigns/preview-audience',
  requirePermission(PERMISSIONS.WHATSAPP_CAMPAIGN),
  asyncHandler(async (req, res) => {
    const audience = await campaignService.previewAudience(req.body ?? {});
    res.json({ success: true, data: audience });
  }),
);

router.post(
  '/campaigns',
  requirePermission(PERMISSIONS.WHATSAPP_CAMPAIGN),
  validate(createCampaignSchema),
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.createCampaign({
      ...req.body,
      createdById: req.admin!.id,
    });
    res.status(201).json({ success: true, data: campaign });
  }),
);

router.get(
  '/campaigns/:id',
  requirePermission(PERMISSIONS.WHATSAPP_CAMPAIGN),
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.getCampaign(req.params.id);
    res.json({ success: true, data: campaign });
  }),
);

router.post(
  '/campaigns/:id/send',
  requirePermission(PERMISSIONS.WHATSAPP_CAMPAIGN),
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.sendCampaign(req.params.id, req.admin!.id);
    res.json({ success: true, data: campaign });
  }),
);

router.post(
  '/campaigns/:id/cancel',
  requirePermission(PERMISSIONS.WHATSAPP_CAMPAIGN),
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.cancelCampaign(req.params.id);
    res.json({ success: true, data: campaign });
  }),
);

// ---------------- Templates ----------------

router.get(
  '/templates',
  requirePermission(PERMISSIONS.WHATSAPP_VIEW),
  asyncHandler(async (_req, res) => {
    const templates = await campaignService.listTemplates();
    res.json({ success: true, data: templates });
  }),
);

router.post(
  '/templates',
  requirePermission(PERMISSIONS.WHATSAPP_CAMPAIGN),
  validate(createTemplateSchema),
  asyncHandler(async (req, res) => {
    const template = await campaignService.createTemplate(req.body);
    res.status(201).json({ success: true, data: template });
  }),
);

export default router;
