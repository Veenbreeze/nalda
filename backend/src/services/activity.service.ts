import { ActivityType, Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/errors';

export interface CreateActivityInput {
  customerId?: string | null;
  adminId?: string | null;
  assignedToId?: string | null;
  type: ActivityType;
  title: string;
  description?: string | null;
  source?: string | null;
  metadata?: Prisma.InputJsonValue;
  dueAt?: Date | null;
  isTask?: boolean;
  taskStatus?: TaskStatus;
  priority?: TaskPriority;
}

/**
 * Records a timeline activity. Must never break the primary business operation.
 */
export async function logActivity(input: CreateActivityInput) {
  try {
    return await prisma.activity.create({
      data: {
        customerId: input.customerId ?? null,
        adminId: input.adminId ?? null,
        assignedToId: input.assignedToId ?? null,
        type: input.type,
        title: input.title,
        description: input.description ?? null,
        source: input.source ?? null,
        metadata: input.metadata,
        dueAt: input.dueAt ?? null,
        isTask: input.isTask ?? false,
        taskStatus: input.taskStatus ?? (input.isTask ? 'PENDING' : null),
        priority: input.priority ?? 'MEDIUM',
        completedAt: input.taskStatus === 'COMPLETED' ? new Date() : null,
      },
    });
  } catch (err) {
    console.error('Failed to log activity', err);
    return null;
  }
}

export async function listActivities(params: {
  page: number;
  limit: number;
  skip: number;
  customerId?: string;
  type?: ActivityType;
  isTask?: boolean;
  assignedToId?: string;
  status?: TaskStatus;
  overdue?: boolean;
  search?: string;
  from?: Date;
  to?: Date;
}) {
  const where: Prisma.ActivityWhereInput = {};
  if (params.customerId) where.customerId = params.customerId;
  if (params.type) where.type = params.type;
  if (params.isTask !== undefined) where.isTask = params.isTask;
  if (params.assignedToId) where.assignedToId = params.assignedToId;
  if (params.status) where.taskStatus = params.status;
  if (params.overdue) {
    where.isTask = true;
    where.dueAt = { lt: new Date() };
    where.taskStatus = { in: ['PENDING', 'IN_PROGRESS'] };
  }
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }

  const [data, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.limit,
      include: {
        customer: { select: { id: true, fullName: true, customerCode: true, phone: true } },
        admin: { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    }),
    prisma.activity.count({ where }),
  ]);

  return { data, total };
}

export async function updateActivity(id: string, data: Prisma.ActivityUpdateInput) {
  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Activity not found');
  if (data.taskStatus === 'COMPLETED' && !existing.completedAt) {
    (data as Prisma.ActivityUpdateInput).completedAt = new Date();
  }
  return prisma.activity.update({ where: { id }, data });
}

export async function deleteActivity(id: string) {
  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Activity not found');
  await prisma.activity.delete({ where: { id } });
}
