import { DealStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/errors';
import { logActivity } from './activity.service';

export async function listPipelines() {
  return prisma.pipeline.findMany({
    orderBy: { createdAt: 'asc' },
    include: { stages: { orderBy: { position: 'asc' } }, _count: { select: { deals: true } } },
  });
}

export async function getDefaultPipeline() {
  return prisma.pipeline.findFirst({
    where: { isDefault: true },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
}

export async function createPipeline(input: { name: string; stages: string[]; isDefault?: boolean }) {
  if (!input.stages.length) throw ApiError.validation('A pipeline requires at least one stage');
  if (input.isDefault) {
    await prisma.pipeline.updateMany({ data: { isDefault: false } });
  }
  return prisma.pipeline.create({
    data: {
      name: input.name,
      isDefault: input.isDefault ?? false,
      stages: {
        create: input.stages.map((name, position) => ({
          name,
          position,
          isWon: /won|completed|delivered/i.test(name),
          isLost: /lost|cancel/i.test(name),
        })),
      },
    },
    include: { stages: { orderBy: { position: 'asc' } } },
  });
}

export async function listDeals(params: {
  pipelineId?: string;
  stageId?: string;
  status?: DealStatus;
  customerId?: string;
  search?: string;
}) {
  const where: Prisma.DealWhereInput = { deletedAt: null };
  if (params.pipelineId) where.pipelineId = params.pipelineId;
  if (params.stageId) where.stageId = params.stageId;
  if (params.status) where.status = params.status;
  if (params.customerId) where.customerId = params.customerId;
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { customer: { fullName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  return prisma.deal.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      customer: { select: { id: true, fullName: true, customerCode: true, phone: true } },
      stage: true,
      items: true,
      order: { select: { id: true, orderNumber: true, totalAmount: true } },
    },
    take: 500,
  });
}

export async function getDeal(id: string) {
  const deal = await prisma.deal.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: { select: { id: true, fullName: true, customerCode: true, phone: true } },
      pipeline: { include: { stages: { orderBy: { position: 'asc' } } } },
      stage: true,
      items: true,
      order: true,
      history: { orderBy: { createdAt: 'desc' }, take: 100 },
    },
  });
  if (!deal) throw ApiError.notFound('Deal not found');
  return deal;
}

export async function createDeal(input: {
  title: string;
  customerId: string;
  pipelineId?: string;
  stageId?: string;
  value?: number | string;
  notes?: string | null;
  expectedCloseAt?: string | Date | null;
  items?: { productId?: string | null; name: string; quantity: number; unitPrice: number | string }[];
  adminId?: string | null;
}) {
  const pipeline = input.pipelineId
    ? await prisma.pipeline.findUnique({ where: { id: input.pipelineId }, include: { stages: { orderBy: { position: 'asc' } } } })
    : await getDefaultPipeline();
  if (!pipeline) throw ApiError.notFound('No pipeline configured');
  const stage = input.stageId
    ? pipeline.stages.find((s) => s.id === input.stageId)
    : pipeline.stages[0];
  if (!stage) throw ApiError.notFound('Pipeline stage not found');

  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
  if (!customer) throw ApiError.notFound('Customer not found');

  const value = input.value !== undefined ? Number(input.value) : input.items?.reduce((acc, i) => acc + Number(i.unitPrice) * i.quantity, 0) ?? 0;

  const deal = await prisma.deal.create({
    data: {
      title: input.title,
      customerId: input.customerId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      value,
      notes: input.notes ?? null,
      expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : null,
      items: input.items?.length
        ? { create: input.items.map((i) => ({ productId: i.productId ?? null, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })) }
        : undefined,
      history: { create: { toStageId: stage.id, changedBy: input.adminId ?? null, note: 'Deal created' } },
    },
    include: { customer: { select: { id: true, fullName: true } }, stage: true, items: true },
  });

  await logActivity({
    customerId: input.customerId,
    adminId: input.adminId,
    type: 'OTHER',
    title: `Deal created: ${deal.title}`,
    description: `Stage: ${stage.name}`,
    metadata: { dealId: deal.id, value },
  });

  return deal;
}

export async function moveDealStage(dealId: string, stageId: string, adminId?: string | null, note?: string) {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) throw ApiError.notFound('Deal not found');
  const stage = await prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId: deal.pipelineId } });
  if (!stage) throw ApiError.notFound('Stage does not belong to this pipeline');

  const updated = await prisma.$transaction(async (tx) => {
    await tx.dealStageHistory.create({
      data: { dealId, fromStageId: deal.stageId, toStageId: stageId, changedBy: adminId ?? null, note: note ?? null },
    });
    return tx.deal.update({
      where: { id: dealId },
      data: {
        stageId,
        stageChangedAt: new Date(),
        status: stage.isWon ? 'WON' : stage.isLost ? 'LOST' : 'OPEN',
      },
      include: { customer: { select: { id: true, fullName: true } }, stage: true },
    });
  });

  await logActivity({
    customerId: deal.customerId,
    adminId,
    type: 'STATUS_CHANGE',
    title: `Deal moved to ${stage.name}`,
    metadata: { dealId, stageId },
  });

  return updated;
}

export async function updateDeal(
  dealId: string,
  input: { title?: string; value?: number | string; notes?: string | null; expectedCloseAt?: string | Date | null; status?: DealStatus },
) {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) throw ApiError.notFound('Deal not found');
  return prisma.deal.update({
    where: { id: dealId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.expectedCloseAt !== undefined
        ? { expectedCloseAt: input.expectedCloseAt ? new Date(input.expectedCloseAt) : null }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
}

export async function deleteDeal(dealId: string) {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, deletedAt: null } });
  if (!deal) throw ApiError.notFound('Deal not found');
  await prisma.deal.update({ where: { id: dealId }, data: { deletedAt: new Date() } });
}
