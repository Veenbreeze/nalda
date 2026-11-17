import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/errors';
import { sendTextMessage, sendTemplateMessage } from '../integrations/whatsapp/client';
import { logActivity } from './activity.service';

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

export interface AudienceFilter {
  productId?: string;
  categoryId?: string;
  customerIds?: string[];
  location?: string;
  allOptedIn?: boolean;
}

export async function previewAudience(filter: AudienceFilter) {
  const where: Prisma.CustomerWhereInput = {
    deletedAt: null,
    status: 'ACTIVE',
    marketingConsent: true,
    whatsappOptIn: true,
  };

  if (filter.customerIds?.length) where.id = { in: filter.customerIds };
  if (filter.location) where.location = { contains: filter.location, mode: 'insensitive' };

  if (filter.productId || filter.categoryId) {
    where.interests = {
      some: {
        ...(filter.productId ? { productId: filter.productId } : {}),
        ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      },
    };
  }

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      phone: true,
      whatsappPhone: true,
      location: true,
      marketingConsent: true,
      whatsappOptIn: true,
    },
    orderBy: { fullName: 'asc' },
    take: 1000,
  });

  return customers;
}

export async function listCampaigns(params: { page: number; limit: number; skip: number; status?: string }) {
  const where: Prisma.WhatsAppCampaignWhereInput = {};
  if (params.status) where.status = params.status as Prisma.WhatsAppCampaignWhereInput['status'];
  const [data, total] = await Promise.all([
    prisma.whatsAppCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.limit,
      include: {
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { recipients: true } },
      },
    }),
    prisma.whatsAppCampaign.count({ where }),
  ]);
  return { data, total };
}

export async function getCampaign(id: string) {
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, fullName: true } },
      recipients: {
        include: { customer: { select: { id: true, fullName: true, customerCode: true } } },
        take: 500,
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!campaign) throw ApiError.notFound('Campaign not found');
  return campaign;
}

export async function createCampaign(input: {
  name: string;
  type?: string;
  messageBody: string;
  templateId?: string | null;
  audience: AudienceFilter;
  createdById?: string | null;
  scheduledAt?: string | Date | null;
  sendNow?: boolean;
}) {
  const audience = await previewAudience(input.audience);
  if (audience.length === 0) {
    throw ApiError.badRequest('No consenting customers match this audience');
  }

  const campaign = await prisma.whatsAppCampaign.create({
    data: {
      name: input.name,
      type: input.type ?? 'CUSTOM',
      status: input.sendNow ? 'SCHEDULED' : 'DRAFT',
      templateId: input.templateId ?? null,
      messageBody: input.messageBody,
      targetFilter: input.audience as unknown as Prisma.InputJsonValue,
      totalRecipients: audience.length,
      createdById: input.createdById ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      recipients: {
        create: audience.map((c) => ({
          customerId: c.id,
          phone: c.whatsappPhone || c.phone,
          personalizedBody: render(input.messageBody, { name: c.fullName.split(' ')[0], full_name: c.fullName }),
        })),
      },
    },
    include: { recipients: true },
  });

  if (input.sendNow) {
    await sendCampaign(campaign.id, input.createdById ?? null);
    return getCampaign(campaign.id);
  }

  return campaign;
}

export async function sendCampaign(campaignId: string, adminId?: string | null) {
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id: campaignId },
    include: { template: true, recipients: { include: { customer: true } } },
  });
  if (!campaign) throw ApiError.notFound('Campaign not found');
  if (campaign.status === 'SENDING') throw ApiError.conflict('Campaign is already being sent');
  if (campaign.status === 'SENT') throw ApiError.badRequest('Campaign has already been sent');

  await prisma.whatsAppCampaign.update({ where: { id: campaignId }, data: { status: 'SENDING' } });

  let sent = 0;
  let failed = 0;

  for (const recipient of campaign.recipients) {
    if (recipient.status !== 'PENDING') continue;

    const customer = recipient.customer;
    if (!customer.marketingConsent || !customer.whatsappOptIn) {
      await prisma.whatsAppCampaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'SKIPPED', errorMessage: 'Customer has not consented to marketing messages' },
      });
      continue;
    }

    const body = recipient.personalizedBody || campaign.messageBody;

    try {
      const result = campaign.templateId && campaign.template
        ? await sendTemplateMessage(
            recipient.phone,
            campaign.template.name,
            campaign.template.language,
            campaign.template.variables.length ? [body] : [],
          )
        : await sendTextMessage(recipient.phone, body);

      await prisma.whatsAppCampaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'SENT',
          waMessageId: result.dryRun ? null : result.messageId,
          sentAt: new Date(),
        },
      });

      // Mirror into the conversation/inbox
      let conversation = await prisma.whatsAppConversation.findUnique({
        where: { customerId_whatsappPhone: { customerId: customer.id, whatsappPhone: recipient.phone } },
      });
      if (!conversation) {
        conversation = await prisma.whatsAppConversation.create({
          data: {
            customerId: customer.id,
            whatsappPhone: recipient.phone,
            lastMessageAt: new Date(),
            lastMessagePreview: body.slice(0, 120),
          },
        });
      } else {
        await prisma.whatsAppConversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 120) },
        });
      }

      await prisma.whatsAppMessage.create({
        data: {
          conversationId: conversation.id,
          customerId: customer.id,
          waMessageId: result.dryRun ? null : result.messageId,
          direction: 'OUTBOUND',
          type: 'TEXT',
          status: 'SENT',
          fromPhone: customer.phone,
          toPhone: recipient.phone,
          body,
          sentByAdminId: adminId ?? null,
          metadata: { campaignId, dryRun: result.dryRun },
          isProcessed: true,
        },
      });

      await logActivity({
        customerId: customer.id,
        adminId,
        type: 'CAMPAIGN',
        title: `Campaign message sent: ${campaign.name}`,
        description: body.slice(0, 200),
        source: 'WHATSAPP_CAMPAIGN',
        metadata: { campaignId, recipientId: recipient.id, dryRun: result.dryRun },
      });

      sent++;
    } catch (err) {
      failed++;
      await prisma.whatsAppCampaignRecipient.update({
        where: { id: recipient.id },
        data: { status: 'FAILED', errorMessage: err instanceof Error ? err.message : 'Send failed' },
      });
    }
  }

  await prisma.whatsAppCampaign.update({
    where: { id: campaignId },
    data: {
      status: failed > 0 && sent === 0 ? 'FAILED' : 'SENT',
      sentCount: sent,
      failedCount: failed,
      sentAt: new Date(),
    },
  });

  return getCampaign(campaignId);
}

export async function cancelCampaign(campaignId: string) {
  const campaign = await prisma.whatsAppCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw ApiError.notFound('Campaign not found');
  if (campaign.status === 'SENT') throw ApiError.badRequest('Cannot cancel a sent campaign');
  return prisma.whatsAppCampaign.update({ where: { id: campaignId }, data: { status: 'CANCELLED' } });
}

export async function listTemplates() {
  return prisma.whatsAppTemplate.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createTemplate(input: {
  name: string;
  language?: string;
  category?: string;
  body: string;
  variables?: string[];
  metaTemplateId?: string | null;
  status?: string;
}) {
  const existing = await prisma.whatsAppTemplate.findUnique({
    where: { name_language: { name: input.name, language: input.language ?? 'sw' } },
  });
  if (existing) throw ApiError.conflict('A template with this name and language already exists');
  return prisma.whatsAppTemplate.create({
    data: {
      name: input.name,
      language: input.language ?? 'sw',
      category: input.category ?? 'MARKETING',
      body: input.body,
      variables: input.variables ?? [],
      metaTemplateId: input.metaTemplateId ?? null,
      status: input.status ?? 'APPROVED',
    },
  });
}
