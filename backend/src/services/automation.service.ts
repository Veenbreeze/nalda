import { AutomationTrigger, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logActivity } from './activity.service';

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

const DEFAULT_NEW_ARRIVAL_MESSAGE =
  'Habari {name}! Tunapenda kukujulisha kuwa {product} imewasili tena NALDA USA Products. Kwa kuwa uliwahi kuonyesha interest na bidhaa hii, tumekukumbuka. Karibu Mikocheni!';

async function findInterestedCustomers(productId: string, categoryId: string | null) {
  const interests = await prisma.productInterest.findMany({
    where: {
      OR: [
        { productId },
        ...(categoryId ? [{ categoryId }] : []),
      ],
      customer: { deletedAt: null, status: 'ACTIVE' },
    },
    include: {
      customer: {
        select: {
          id: true,
          fullName: true,
          whatsappPhone: true,
          phone: true,
          marketingConsent: true,
          whatsappOptIn: true,
        },
      },
    },
  });

  const map = new Map<string, (typeof interests)[number]['customer']>();
  for (const i of interests) map.set(i.customer.id, i.customer);
  return Array.from(map.values());
}

async function recordExecution(input: {
  workflowId: string;
  trigger: AutomationTrigger;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PARTIAL';
  summary: string;
  entityType?: string;
  entityId?: string;
  logs?: Prisma.InputJsonValue;
  errorMessage?: string;
  adminId?: string | null;
}) {
  try {
    await prisma.automationExecution.create({
      data: {
        workflowId: input.workflowId,
        trigger: input.trigger,
        status: input.status,
        summary: input.summary,
        entityType: input.entityType,
        entityId: input.entityId,
        logs: input.logs,
        errorMessage: input.errorMessage,
        adminId: input.adminId ?? null,
      },
    });
    await prisma.automationWorkflow.update({
      where: { id: input.workflowId },
      data: { lastRunAt: new Date() },
    });
  } catch (err) {
    console.error('Failed to record automation execution', err);
  }
}

export async function runAutomationForProduct(
  productId: string,
  trigger: 'NEW_ARRIVAL' | 'RESTOCK',
  adminId?: string | null,
) {
  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!product) return null;

  const workflow = await prisma.automationWorkflow.findFirst({
    where: { trigger: trigger as AutomationTrigger, status: 'ACTIVE' },
  });
  if (!workflow) return null;

  const eligible = await findInterestedCustomers(productId, product.categoryId);
  const consenting = eligible.filter((c) => c.marketingConsent && c.whatsappOptIn);

  if (consenting.length === 0) {
    await recordExecution({
      workflowId: workflow.id,
      trigger: trigger as AutomationTrigger,
      status: 'SKIPPED',
      summary: `No consenting customers interested in ${product.name}`,
      entityType: 'Product',
      entityId: product.id,
      adminId,
    });
    return null;
  }

  const config = (workflow.config as Record<string, unknown> | null) ?? {};
  const template = (config.messageTemplate as string) || DEFAULT_NEW_ARRIVAL_MESSAGE;

  const campaign = await prisma.whatsAppCampaign.create({
    data: {
      name: `${trigger === 'RESTOCK' ? 'Restock' : 'New arrival'} - ${product.name} - ${new Date().toLocaleDateString('en-GB')}`,
      type: trigger,
      status: 'DRAFT',
      messageBody: template,
      createdById: adminId ?? null,
      totalRecipients: consenting.length,
      targetFilter: { productId: product.id, categoryId: product.categoryId, trigger },
      recipients: {
        create: consenting.map((c) => ({
          customerId: c.id,
          phone: c.whatsappPhone || c.phone,
          personalizedBody: renderTemplate(template, { name: c.fullName.split(' ')[0], product: product.name }),
        })),
      },
    },
    include: { recipients: true },
  });

  await recordExecution({
    workflowId: workflow.id,
    trigger: trigger as AutomationTrigger,
    status: 'SUCCESS',
    summary: `Prepared campaign "${campaign.name}" for ${consenting.length} consenting customer(s)`,
    entityType: 'Product',
    entityId: product.id,
    logs: { campaignId: campaign.id, recipients: consenting.length },
    adminId,
  });

  return campaign;
}

/**
 * Follow-up automation: creates tasks for customers who have not purchased
 * within the configured number of days and have an open (non-purchased) interest.
 * Tasks are created for administrators; nothing is sent automatically.
 */
export async function runFollowUpAutomation(adminId?: string | null) {
  const workflow = await prisma.automationWorkflow.findFirst({
    where: { trigger: 'FOLLOW_UP', status: 'ACTIVE' },
  });
  if (!workflow) return null;

  const config = (workflow.config as Record<string, unknown> | null) ?? {};
  const days = Number(config.daysSinceLastPurchase ?? 30);

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const customers = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      OR: [{ lastPurchaseAt: { lt: cutoff } }, { lastPurchaseAt: null }],
      interests: { some: { interestLevel: { in: ['MEDIUM', 'HIGH'] } } },
    },
    take: 100,
    select: { id: true, fullName: true },
  });

  let created = 0;
  for (const customer of customers) {
    const existing = await prisma.activity.findFirst({
      where: {
        customerId: customer.id,
        isTask: true,
        type: 'FOLLOW_UP',
        taskStatus: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });
    if (existing) continue;
    await prisma.activity.create({
      data: {
        customerId: customer.id,
        adminId: adminId ?? null,
        type: 'FOLLOW_UP',
        title: `Follow-up with ${customer.fullName}`,
        description: `Customer has not purchased in the last ${days} days but has an active product interest.`,
        isTask: true,
        taskStatus: 'PENDING',
        priority: 'MEDIUM',
        dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    });
    created++;
  }

  await recordExecution({
    workflowId: workflow.id,
    trigger: 'FOLLOW_UP',
    status: 'SUCCESS',
    summary: `Created ${created} follow-up task(s)`,
    logs: { created, days },
    adminId,
  });

  return { created };
}

export async function logInlineAutomation(
  trigger: 'NEW_WHATSAPP_ORDER' | 'INTEREST_DETECTION',
  entityId: string,
  summary: string,
  adminId?: string | null,
) {
  const workflow = await prisma.automationWorkflow.findFirst({
    where: { trigger: trigger as AutomationTrigger, status: 'ACTIVE' },
  });
  if (!workflow) return;
  await recordExecution({
    workflowId: workflow.id,
    trigger: trigger as AutomationTrigger,
    status: 'SUCCESS',
    summary,
    entityType: trigger === 'NEW_WHATSAPP_ORDER' ? 'Order' : 'Customer',
    entityId,
    adminId,
  });
  await logActivity({
    type: 'TASK',
    title: `Automation: ${summary}`,
    source: 'AUTOMATION',
  });
}

export async function listWorkflows() {
  return prisma.automationWorkflow.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { executions: true } } },
  });
}

export async function getWorkflow(id: string) {
  const workflow = await prisma.automationWorkflow.findUnique({
    where: { id },
    include: {
      executions: { orderBy: { createdAt: 'desc' }, take: 50, include: { admin: { select: { fullName: true } } } },
    },
  });
  if (!workflow) return null;
  return workflow;
}

export async function createWorkflow(input: {
  name: string;
  trigger: AutomationTrigger;
  status?: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  description?: string | null;
  config?: Prisma.InputJsonValue;
  requireApproval?: boolean;
}) {
  return prisma.automationWorkflow.create({ data: input });
}

export async function updateWorkflow(
  id: string,
  input: {
    name?: string;
    status?: 'ACTIVE' | 'PAUSED' | 'DRAFT';
    description?: string | null;
    config?: Prisma.InputJsonValue;
    requireApproval?: boolean;
  },
) {
  return prisma.automationWorkflow.update({ where: { id }, data: input });
}

export async function triggerWorkflow(id: string, adminId?: string | null) {
  const workflow = await prisma.automationWorkflow.findUnique({ where: { id } });
  if (!workflow) return null;
  if (workflow.trigger === 'FOLLOW_UP') {
    return runFollowUpAutomation(adminId);
  }
  throw new Error('This workflow is triggered automatically by its matching business event.');
}
