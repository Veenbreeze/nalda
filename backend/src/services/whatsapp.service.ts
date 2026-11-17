import crypto from 'crypto';
import { ConversationStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env, whatsappConfigured } from '../config/env';
import { normalizePhone } from '../utils/phone';
import { ApiError } from '../utils/errors';
import { logActivity } from './activity.service';
import { sendTextMessage, markMessageRead, SendResult } from '../integrations/whatsapp/client';
import { recordAudit } from '../utils/audit';

// ------------------------------------------------------------
// Webhook payload types (subset of Meta's documented shape)
// ------------------------------------------------------------

interface WaProfile {
  name?: string;
}
interface WaContact {
  profile?: WaProfile;
  wa_id: string;
}
interface WaMedia {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
}
interface WaMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: WaMedia;
  document?: WaMedia;
  audio?: WaMedia;
  video?: WaMedia;
  button?: { text?: string };
  interactive?: {
    button_reply?: { title?: string };
    list_reply?: { title?: string };
  };
}
interface WaStatus {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
  errors?: { code?: number; title?: string; message?: string }[];
}
interface WaValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: WaContact[];
  messages?: WaMessage[];
  statuses?: WaStatus[];
}
interface WaChange {
  field: string;
  value: WaValue;
}
interface WaEntry {
  id: string;
  changes: WaChange[];
}
export interface WaWebhookPayload {
  object: string;
  entry: WaEntry[];
}

// ------------------------------------------------------------
// Verification
// ------------------------------------------------------------

export function verifyWebhookChallenge(mode?: string, token?: string, challenge?: string): string | null {
  if (mode === 'subscribe' && token && token === env.WHATSAPP_VERIFY_TOKEN) {
    return challenge ?? '';
  }
  return null;
}

export function verifyWebhookSignature(rawBody: Buffer | string | undefined, signature?: string): boolean {
  if (!whatsappConfigured || !env.WHATSAPP_APP_SECRET) return true; // verification disabled only when not configured
  if (!rawBody || !signature) return false;
  const expected = crypto
    .createHmac('sha256', env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  const provided = signature.replace(/^sha256=/, '');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}

// ------------------------------------------------------------
// Customer identification
// ------------------------------------------------------------

async function resolveCustomer(phone: string, profileName?: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) throw ApiError.badRequest('Invalid WhatsApp phone number');

  let customer = await prisma.customer.findFirst({
    where: { deletedAt: null, OR: [{ phone: normalized }, { whatsappPhone: normalized }] },
  });
  if (customer) {
    if (!customer.whatsappPhone) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { whatsappPhone: normalized },
      });
    }
    return customer;
  }

  const { generateCustomerCode } = await import('../utils/codes');
  customer = await prisma.$transaction(async (tx) => {
    const customerCode = await generateCustomerCode(tx);
    return tx.customer.create({
      data: {
        customerCode,
        fullName: profileName?.trim() || `WhatsApp ${normalized}`,
        phone: normalized,
        whatsappPhone: normalized,
        source: 'WHATSAPP',
        status: 'ACTIVE',
        whatsappOptIn: false,
        marketingConsent: false,
        lastInteractionAt: new Date(),
      },
    });
  });

  await logActivity({
    customerId: customer.id,
    type: 'CUSTOMER_REGISTERED',
    title: 'Customer auto-created from WhatsApp',
    source: 'WHATSAPP',
    metadata: { phone: normalized },
  });

  return customer;
}

function mapMessageType(type: string): Prisma.WhatsAppMessageCreateInput['type'] {
  switch (type) {
    case 'text':
      return 'TEXT';
    case 'image':
      return 'IMAGE';
    case 'document':
      return 'DOCUMENT';
    case 'audio':
      return 'AUDIO';
    case 'video':
      return 'VIDEO';
    case 'template':
      return 'TEMPLATE';
    default:
      return 'UNKNOWN';
  }
}

function extractBody(message: WaMessage): string | null {
  if (message.text?.body) return message.text.body;
  if (message.image?.caption) return message.image.caption;
  if (message.document?.caption) return message.document.caption;
  if (message.button?.text) return message.button.text;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  return null;
}

// ------------------------------------------------------------
// Incoming message handling
// ------------------------------------------------------------

export async function handleIncomingMessage(
  message: WaMessage,
  contact?: WaContact,
): Promise<{ created: boolean; customerId?: string; messageId?: string }> {
  const phone = normalizePhone(message.from);
  if (!phone) return { created: false };

  const customer = await resolveCustomer(phone, contact?.profile?.name);
  const type = mapMessageType(message.type);
  const body = extractBody(message);
  const mediaId = message.image?.id || message.document?.id || message.audio?.id || message.video?.id;
  const mediaMime =
    message.image?.mime_type || message.document?.mime_type || message.audio?.mime_type || message.video?.mime_type;
  const preview = (body || `[${message.type}]`).slice(0, 120);

  let conversation = await prisma.whatsAppConversation.findUnique({
    where: { customerId_whatsappPhone: { customerId: customer.id, whatsappPhone: phone } },
  });
  if (!conversation) {
    conversation = await prisma.whatsAppConversation.create({
      data: {
        customerId: customer.id,
        whatsappPhone: phone,
        status: 'OPEN',
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
        unreadCount: 0,
      },
    });
  }

  // Idempotent insert: retries from Meta must not create duplicate messages.
  const existing = await prisma.whatsAppMessage.findUnique({ where: { waMessageId: message.id } });
  if (existing) {
    return { created: false, customerId: customer.id, messageId: existing.id };
  }

  let saved;
  try {
    saved = await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        customerId: customer.id,
        waMessageId: message.id,
        direction: 'INBOUND',
        type,
        status: 'RECEIVED',
        fromPhone: phone,
        body,
        mediaMimeType: mediaMime ?? null,
        metadata: {
          mediaId: mediaId ?? null,
          caption: message.image?.caption ?? message.document?.caption ?? null,
          timestamp: message.timestamp,
          profileName: contact?.profile?.name ?? null,
          rawType: message.type,
        },
        isProcessed: false,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Webhook retry race: message already stored by another worker
      return { created: false, customerId: customer.id };
    }
    throw err;
  }

  await prisma.$transaction([
    prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: preview,
        unreadCount: { increment: 1 },
        status: 'OPEN',
      },
    }),
    prisma.customer.update({
      where: { id: customer.id },
      data: { lastInteractionAt: new Date() },
    }),
  ]);

  await logActivity({
    customerId: customer.id,
    type: 'WHATSAPP_INBOUND',
    title: 'WhatsApp message received',
    description: preview,
    source: 'WHATSAPP',
    metadata: { messageId: saved.id, waMessageId: message.id, type },
  });

  // Best effort read receipt
  markMessageRead(message.id).catch(() => undefined);

  // Post-processing: interest detection + draft order (never blocks message storage)
  try {
    const { processIncomingForOrdersAndInterests } = await import('./whatsapp-order.service');
    await processIncomingForOrdersAndInterests({
      messageId: saved.id,
      waMessageId: message.id,
      customerId: customer.id,
      body,
    });
    await prisma.whatsAppMessage.update({
      where: { id: saved.id },
      data: { isProcessed: true },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed';
    console.error('WhatsApp message post-processing failed', err);
    await prisma.whatsAppMessage
      .update({ where: { id: saved.id }, data: { processingError: message } })
      .catch(() => undefined);
  }

  return { created: true, customerId: customer.id, messageId: saved.id };
}

// ------------------------------------------------------------
// Delivery status handling
// ------------------------------------------------------------

export async function handleStatusUpdate(status: WaStatus): Promise<void> {
  const map: Record<string, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
    sent: 'SENT',
    delivered: 'DELIVERED',
    read: 'READ',
    failed: 'FAILED',
  };
  const newStatus = map[status.status];
  if (!newStatus) return;

  const errorMessage = status.errors?.length
    ? status.errors.map((e) => e.message || e.title || `Error ${e.code}`).join('; ')
    : null;

  await prisma.whatsAppMessage
    .updateMany({
      where: { waMessageId: status.id },
      data: { status: newStatus, errorMessage },
    })
    .catch((err) => console.error('Failed to update WhatsApp status', err));

  await prisma.whatsAppCampaignRecipient
    .updateMany({
      where: { waMessageId: status.id },
      data: { status: newStatus === 'FAILED' ? 'FAILED' : newStatus, errorMessage },
    })
    .catch(() => undefined);
}

// ------------------------------------------------------------
// Webhook processing
// ------------------------------------------------------------

export async function processWebhook(payload: WaWebhookPayload): Promise<{ processed: number; skipped: number }> {
  if (!payload || payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
    return { processed: 0, skipped: 0 };
  }

  let processed = 0;
  let skipped = 0;

  for (const entry of payload.entry) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const value = change.value;
      const contactByWaId = new Map((value.contacts ?? []).map((c) => [c.wa_id, c]));

      for (const message of value.messages ?? []) {
        try {
          const contact = contactByWaId.get(message.from);
          const result = await handleIncomingMessage(message, contact);
          if (result.created) processed++;
          else skipped++;
        } catch (err) {
          console.error('Failed to process incoming WhatsApp message', err);
          skipped++;
        }
      }

      for (const status of value.statuses ?? []) {
        try {
          await handleStatusUpdate(status);
        } catch (err) {
          console.error('Failed to process WhatsApp status', err);
        }
      }
    }
  }

  return { processed, skipped };
}

// ------------------------------------------------------------
// Outgoing messages
// ------------------------------------------------------------

export async function sendMessageToCustomer(
  customerId: string,
  body: string,
  adminId?: string | null,
): Promise<{ messageId: string; dryRun: boolean }> {
  if (!body.trim()) throw ApiError.validation('Message body cannot be empty');

  const customer = await prisma.customer.findFirst({ where: { id: customerId, deletedAt: null } });
  if (!customer) throw ApiError.notFound('Customer not found');
  const target = customer.whatsappPhone || customer.phone;
  if (!target) throw ApiError.badRequest('Customer has no WhatsApp phone number');

  let result: SendResult;
  let failure: string | null = null;
  try {
    result = await sendTextMessage(target, body.trim());
  } catch (err) {
    failure = err instanceof Error ? err.message : 'Failed to send WhatsApp message';
    result = { messageId: `failed-${crypto.randomUUID()}`, dryRun: !whatsappConfigured };
  }

  let conversation = await prisma.whatsAppConversation.findUnique({
    where: { customerId_whatsappPhone: { customerId, whatsappPhone: target } },
  });
  if (!conversation) {
    conversation = await prisma.whatsAppConversation.create({
      data: {
        customerId,
        whatsappPhone: target,
        status: 'OPEN',
        lastMessageAt: new Date(),
        lastMessagePreview: body.slice(0, 120),
      },
    });
  }

  const saved = await prisma.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      customerId,
      waMessageId: result.dryRun ? null : result.messageId,
      direction: 'OUTBOUND',
      type: 'TEXT',
      status: failure ? 'FAILED' : 'SENT',
      fromPhone: customer.phone,
      toPhone: target,
      body: body.trim(),
      errorMessage: failure,
      sentByAdminId: adminId ?? null,
      metadata: { dryRun: result.dryRun },
      isProcessed: true,
    },
  });

  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 120) },
  });

  await logActivity({
    customerId,
    adminId,
    type: 'WHATSAPP_OUTBOUND',
    title: failure ? 'WhatsApp message failed' : 'WhatsApp message sent',
    description: body.slice(0, 200),
    source: 'WHATSAPP',
    metadata: { messageId: saved.id, dryRun: result.dryRun, error: failure },
  });

  if (failure) {
    throw ApiError.serviceUnavailable(`WhatsApp send failed: ${failure}`);
  }

  return { messageId: saved.id, dryRun: result.dryRun };
}

export async function getInbox(params: {
  page: number;
  limit: number;
  skip: number;
  search?: string;
  status?: string;
  unreadOnly?: boolean;
}) {
  const where: Prisma.WhatsAppConversationWhereInput = {};
  if (params.status) where.status = params.status as ConversationStatus;
  if (params.unreadOnly) where.unreadCount = { gt: 0 };
  if (params.search) {
    where.OR = [
      { customer: { fullName: { contains: params.search, mode: 'insensitive' } } },
      { customer: { phone: { contains: params.search } } },
      { lastMessagePreview: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.whatsAppConversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      skip: params.skip,
      take: params.limit,
      include: {
        customer: { select: { id: true, fullName: true, customerCode: true, phone: true, status: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.whatsAppConversation.count({ where }),
  ]);

  return { data, total };
}

export async function getConversation(conversationId: string) {
  const conversation = await prisma.whatsAppConversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: {
        select: { id: true, fullName: true, customerCode: true, phone: true, whatsappPhone: true, status: true },
      },
      messages: { orderBy: { createdAt: 'asc' }, take: 500 },
    },
  });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  return conversation;
}

export async function markConversationRead(conversationId: string) {
  return prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });
}

export async function setConversationStatus(conversationId: string, status: 'OPEN' | 'PENDING' | 'CLOSED' | 'ARCHIVED') {
  return prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { status } });
}

export async function sendFromConversation(conversationId: string, body: string, adminId?: string | null) {
  const conversation = await prisma.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  return sendMessageToCustomer(conversation.customerId, body, adminId);
}

export async function logWebhookEvent(description: string, metadata?: Prisma.InputJsonValue) {
  await recordAudit({ action: 'WHATSAPP_WEBHOOK', description, metadata });
}
