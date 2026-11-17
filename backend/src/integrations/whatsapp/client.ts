import axios, { AxiosInstance } from 'axios';
import { env, whatsappConfigured } from '../../config/env';
import { toWhatsAppNumber } from '../../utils/phone';

/**
 * Official Meta WhatsApp Business Cloud API client.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * When credentials are not configured the client operates in DRY-RUN mode:
 * messages are not sent, but a simulated provider id is returned so that the
 * CRM workflow (inbox, campaigns, delivery records) remains testable locally.
 * DRY-RUN must never be relied upon in production.
 */

export interface SendResult {
  messageId: string;
  dryRun: boolean;
}

export interface TemplateComponentParameter {
  type: 'text';
  text: string;
}

function client(): AxiosInstance {
  return axios.create({
    baseURL: `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`,
    timeout: 20_000,
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
}

function assertConfigured(): void {
  if (!whatsappConfigured) {
    throw new Error(
      'WhatsApp Cloud API is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.',
    );
  }
}

export async function sendTextMessage(to: string, body: string): Promise<SendResult> {
  if (!whatsappConfigured) {
    console.warn(`[whatsapp:dry-run] text to ${to}: ${body.slice(0, 80)}`);
    return { messageId: `dry-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, dryRun: true };
  }
  assertConfigured();
  const res = await client().post(`/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWhatsAppNumber(to),
    type: 'text',
    text: { preview_url: false, body },
  });
  const messageId = res.data?.messages?.[0]?.id;
  if (!messageId) throw new Error('WhatsApp API did not return a message id');
  return { messageId, dryRun: false };
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  language: string,
  bodyParameters: string[] = [],
): Promise<SendResult> {
  if (!whatsappConfigured) {
    console.warn(`[whatsapp:dry-run] template ${templateName} to ${to}`);
    return { messageId: `dry-run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, dryRun: true };
  }
  assertConfigured();
  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toWhatsAppNumber(to),
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      ...(bodyParameters.length
        ? {
            components: [
              {
                type: 'body',
                parameters: bodyParameters.map((text) => ({ type: 'text', text })),
              },
            ],
          }
        : {}),
    },
  };
  const res = await client().post(`/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, payload);
  const messageId = res.data?.messages?.[0]?.id;
  if (!messageId) throw new Error('WhatsApp API did not return a message id');
  return { messageId, dryRun: false };
}

export async function markMessageRead(messageId: string): Promise<void> {
  if (!whatsappConfigured) return;
  try {
    await client().post(`/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  } catch (err) {
    console.error('Failed to mark WhatsApp message as read', err);
  }
}

export async function getMediaUrl(mediaId: string): Promise<{ url: string; mimeType?: string } | null> {
  if (!whatsappConfigured) return null;
  try {
    const res = await client().get(`/${mediaId}`);
    return { url: res.data?.url, mimeType: res.data?.mime_type };
  } catch (err) {
    console.error('Failed to retrieve WhatsApp media metadata', err);
    return null;
  }
}

export function isWhatsAppConfigured(): boolean {
  return whatsappConfigured;
}
