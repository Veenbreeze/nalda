import { Router } from 'express';
import { env } from '../config/env';
import { asyncHandler } from '../utils/http';
import { webhookRateLimiter } from '../middleware/rateLimit';
import * as whatsappService from '../services/whatsapp.service';

const router = Router();

// Meta webhook verification handshake
router.get('/whatsapp', (req, res) => {
  if (!env.WHATSAPP_WEBHOOK_ENABLED) {
    return res.status(503).json({ success: false, error: { code: 'WEBHOOK_DISABLED', message: 'Webhook disabled' } });
  }
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  const verified = whatsappService.verifyWebhookChallenge(mode, token, challenge);
  if (verified === null) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Verification failed' } });
  }
  return res.status(200).send(verified);
});

// Incoming messages / delivery statuses
router.post(
  '/whatsapp',
  webhookRateLimiter,
  asyncHandler(async (req, res) => {
    if (!env.WHATSAPP_WEBHOOK_ENABLED) {
      return res.status(200).json({ success: true, data: { processed: 0, skipped: 0, disabled: true } });
    }

    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
    if (env.WHATSAPP_APP_SECRET && !whatsappService.verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' },
      });
    }

    // Always acknowledge quickly with 200 so Meta does not aggressively retry,
    // while still processing synchronously to keep local/dev behaviour simple.
    const result = await whatsappService.processWebhook(req.body);
    return res.status(200).json({ success: true, data: result });
  }),
);

export default router;
