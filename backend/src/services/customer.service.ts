import { CustomerSource, CustomerStatus, Gender, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/errors';
import { generateCustomerCode } from '../utils/codes';
import { normalizePhone } from '../utils/phone';
import { logActivity } from './activity.service';

export interface CustomerInput {
  fullName: string;
  phone: string;
  whatsappPhone?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  gender?: Gender;
  dateOfBirth?: string | Date | null;
  location?: string | null;
  physicalAddress?: string | null;
  source?: CustomerSource;
  status?: CustomerStatus;
  notes?: string | null;
  marketingConsent?: boolean;
  whatsappOptIn?: boolean;
  preferredChannel?: string | null;
  tagIds?: string[];
}

export interface CustomerListFilters {
  search?: string;
  status?: CustomerStatus;
  statusIn?: CustomerStatus[];
  source?: CustomerSource;
  location?: string;
  tagId?: string;
  marketingConsent?: boolean;
  whatsappOptIn?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
  lastPurchaseBefore?: Date;
  includeArchived?: boolean;
  orderBy?: 'createdAt' | 'fullName' | 'totalSpent' | 'lastPurchaseAt' | 'lastInteractionAt';
  orderDir?: 'asc' | 'desc';
  birthdayMonth?: number;
}

function buildWhere(filters: CustomerListFilters): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};
  if (filters.status) where.status = filters.status;
  else if (!filters.includeArchived) where.status = { not: 'ARCHIVED' };
  if (filters.statusIn?.length) where.status = { in: filters.statusIn };
  if (filters.source) where.source = filters.source;
  if (filters.location) where.location = { contains: filters.location, mode: 'insensitive' };
  if (filters.tagId) where.tags = { some: { tagId: filters.tagId } };
  if (filters.marketingConsent !== undefined) where.marketingConsent = filters.marketingConsent;
  if (filters.whatsappOptIn !== undefined) where.whatsappOptIn = filters.whatsappOptIn;
  if (filters.createdFrom || filters.createdTo) {
    where.createdAt = {
      ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
      ...(filters.createdTo ? { lte: filters.createdTo } : {}),
    };
  }
  if (filters.lastPurchaseBefore) where.lastPurchaseAt = { lt: filters.lastPurchaseBefore };
  if (filters.search) {
    const search = filters.search.trim();
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { whatsappPhone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
      { customerCode: { contains: search, mode: 'insensitive' } },
      { location: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
}

export async function listCustomers(params: {
  page: number;
  limit: number;
  skip: number;
  filters: CustomerListFilters;
}) {
  const where = buildWhere(params.filters);
  const orderBy: Prisma.CustomerOrderByWithRelationInput = {
    [params.filters.orderBy ?? 'createdAt']: params.filters.orderDir ?? 'desc',
  };

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy,
      skip: params.skip,
      take: params.limit,
      include: {
        tags: { include: { tag: true } },
        _count: { select: { orders: true, interests: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return { data, total };
}

export async function getCustomerById(id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      tags: { include: { tag: true } },
      addresses: true,
      interests: {
        include: {
          product: { select: { id: true, name: true, sku: true, imageUrl: true, sellingPrice: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      },
      orders: {
        orderBy: { orderDate: 'desc' },
        take: 50,
        include: { items: true, payments: true },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { admin: { select: { id: true, fullName: true } } },
      },
      notesList: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { admin: { select: { id: true, fullName: true } } },
      },
      conversations: {
        orderBy: { lastMessageAt: 'desc' },
      },
      _count: { select: { orders: true, interests: true, deals: true, conversations: true } },
    },
  });

  if (!customer) throw ApiError.notFound('Customer not found');

  const stats = await prisma.$queryRaw<
    { totalorders: bigint; totalspent: string; lastpurchase: Date | null }[]
  >`
    SELECT COUNT(*)::bigint AS totalorders,
           COALESCE(SUM("totalAmount"), 0)::text AS totalspent,
           MAX("orderDate") AS lastpurchase
    FROM orders
    WHERE "customerId" = ${id} AND "deletedAt" IS NULL AND status <> 'CANCELLED'
  `;

  const summary = stats[0]
    ? {
        totalOrders: Number(stats[0].totalorders),
        totalSpent: Number(stats[0].totalspent),
        lastPurchaseAt: stats[0].lastpurchase,
      }
    : { totalOrders: 0, totalSpent: 0, lastPurchaseAt: null };

  return { customer, summary };
}

export async function findDuplicates(phone: string, email?: string | null) {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  const or: Prisma.CustomerWhereInput[] = [
    { phone: normalized },
    { whatsappPhone: normalized },
    { alternatePhone: normalized },
  ];
  if (email) or.push({ email: { equals: email, mode: 'insensitive' } });
  return prisma.customer.findMany({
    where: { deletedAt: null, OR: or },
    select: { id: true, customerCode: true, fullName: true, phone: true, email: true, status: true },
    take: 10,
  });
}

export async function createCustomer(input: CustomerInput, adminId?: string | null) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw ApiError.validation('A valid phone number is required');
  const whatsappPhone = normalizePhone(input.whatsappPhone ?? input.phone) ?? phone;
  const alternatePhone = input.alternatePhone ? normalizePhone(input.alternatePhone) : null;

  const existing = await prisma.customer.findFirst({
    where: { deletedAt: null, OR: [{ phone }, { whatsappPhone }] },
    select: { id: true, fullName: true, customerCode: true },
  });
  if (existing) {
    throw ApiError.conflict(
      `A customer with this phone number already exists (${existing.customerCode} - ${existing.fullName})`,
      existing,
    );
  }

  const customer = await prisma.$transaction(async (tx) => {
    const customerCode = await generateCustomerCode(tx);
    return tx.customer.create({
      data: {
        customerCode,
        fullName: input.fullName.trim(),
        phone,
        whatsappPhone,
        alternatePhone,
        email: input.email?.trim().toLowerCase() || null,
        gender: input.gender ?? 'UNSPECIFIED',
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        location: input.location ?? null,
        physicalAddress: input.physicalAddress ?? null,
        source: input.source ?? 'MANUAL',
        status: input.status ?? 'ACTIVE',
        notes: input.notes ?? null,
        marketingConsent: input.marketingConsent ?? false,
        whatsappOptIn: input.whatsappOptIn ?? false,
        preferredChannel: input.preferredChannel ?? 'WHATSAPP',
        lastInteractionAt: new Date(),
        tags: input.tagIds?.length
          ? { create: input.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: { tags: { include: { tag: true } }, addresses: true },
    });
  });

  await logActivity({
    customerId: customer.id,
    adminId,
    type: 'CUSTOMER_REGISTERED',
    title: 'Customer registered',
    source: input.source ?? 'MANUAL',
    metadata: { customerCode: customer.customerCode },
  });

  return customer;
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>, adminId?: string | null) {
  const existing = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Customer not found');

  const data: Prisma.CustomerUpdateInput = {};

  if (input.fullName !== undefined) data.fullName = input.fullName.trim();
  if (input.phone !== undefined) {
    const phone = normalizePhone(input.phone);
    if (!phone) throw ApiError.validation('Invalid phone number');
    const clash = await prisma.customer.findFirst({
      where: { id: { not: id }, deletedAt: null, OR: [{ phone }, { whatsappPhone: phone }] },
    });
    if (clash) throw ApiError.conflict('Another customer already uses this phone number', { id: clash.id });
    data.phone = phone;
  }
  if (input.whatsappPhone !== undefined) {
    data.whatsappPhone = normalizePhone(input.whatsappPhone) ?? existing.phone;
  }
  if (input.alternatePhone !== undefined) data.alternatePhone = normalizePhone(input.alternatePhone);
  if (input.email !== undefined) data.email = input.email?.trim().toLowerCase() || null;
  if (input.gender !== undefined) data.gender = input.gender;
  if (input.dateOfBirth !== undefined) data.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  if (input.location !== undefined) data.location = input.location;
  if (input.physicalAddress !== undefined) data.physicalAddress = input.physicalAddress;
  if (input.source !== undefined) data.source = input.source;
  if (input.status !== undefined) data.status = input.status;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.marketingConsent !== undefined) data.marketingConsent = input.marketingConsent;
  if (input.whatsappOptIn !== undefined) data.whatsappOptIn = input.whatsappOptIn;
  if (input.preferredChannel !== undefined) data.preferredChannel = input.preferredChannel;

  if (input.tagIds !== undefined) {
    data.tags = {
      deleteMany: {},
      create: input.tagIds.map((tagId) => ({ tagId })),
    };
  }

  const updated = await prisma.customer.update({
    where: { id },
    data,
    include: { tags: { include: { tag: true } }, addresses: true },
  });

  await logActivity({
    customerId: id,
    adminId,
    type: 'STATUS_CHANGE',
    title: 'Customer details updated',
  });

  return updated;
}

export async function archiveCustomer(id: string, adminId?: string | null) {
  const existing = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Customer not found');
  const updated = await prisma.customer.update({ where: { id }, data: { status: 'ARCHIVED' } });
  await logActivity({
    customerId: id,
    adminId,
    type: 'STATUS_CHANGE',
    title: 'Customer archived',
  });
  return updated;
}

export async function restoreCustomer(id: string, adminId?: string | null) {
  const existing = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Customer not found');
  const updated = await prisma.customer.update({ where: { id }, data: { status: 'ACTIVE' } });
  await logActivity({
    customerId: id,
    adminId,
    type: 'STATUS_CHANGE',
    title: 'Customer restored',
  });
  return updated;
}

export async function softDeleteCustomer(id: string, adminId?: string | null) {
  const existing = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Customer not found');
  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'ARCHIVED' },
  });
  await logActivity({
    customerId: id,
    adminId,
    type: 'STATUS_CHANGE',
    title: 'Customer deleted',
  });
}

export async function mergeCustomers(primaryId: string, secondaryId: string, adminId?: string | null) {
  if (primaryId === secondaryId) throw ApiError.badRequest('Cannot merge a customer into itself');

  const [primary, secondary] = await Promise.all([
    prisma.customer.findFirst({ where: { id: primaryId, deletedAt: null } }),
    prisma.customer.findFirst({ where: { id: secondaryId, deletedAt: null } }),
  ]);
  if (!primary) throw ApiError.notFound('Primary customer not found');
  if (!secondary) throw ApiError.notFound('Secondary customer not found');
  if (primary.phone !== secondary.phone) {
    // allowed but warn nothing; merging distinct people is a deliberate admin action
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
    await tx.activity.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
    await tx.note.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
    await tx.productInterest.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
    await tx.deal.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
    await tx.whatsAppMessage.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });
    await tx.personalShoppingRequest.updateMany({
      where: { customerId: secondaryId },
      data: { customerId: primaryId },
    });
    await tx.cargoShipment.updateMany({ where: { customerId: secondaryId }, data: { customerId: primaryId } });

    // Merge tags
    const secondaryTags = await tx.customerTag.findMany({ where: { customerId: secondaryId } });
    for (const st of secondaryTags) {
      await tx.customerTag.upsert({
        where: { customerId_tagId: { customerId: primaryId, tagId: st.tagId } },
        create: { customerId: primaryId, tagId: st.tagId },
        update: {},
      });
    }

    // Merge campaign recipients (unique campaign+customer)
    const recipients = await tx.whatsAppCampaignRecipient.findMany({ where: { customerId: secondaryId } });
    for (const r of recipients) {
      const existing = await tx.whatsAppCampaignRecipient.findUnique({
        where: { campaignId_customerId: { campaignId: r.campaignId, customerId: primaryId } },
      });
      if (existing) {
        await tx.whatsAppCampaignRecipient.delete({ where: { id: r.id } });
      } else {
        await tx.whatsAppCampaignRecipient.update({ where: { id: r.id }, data: { customerId: primaryId } });
      }
    }

    // Merge conversations (unique customer+phone)
    const conversations = await tx.whatsAppConversation.findMany({ where: { customerId: secondaryId } });
    for (const conv of conversations) {
      const existing = await tx.whatsAppConversation.findUnique({
        where: { customerId_whatsappPhone: { customerId: primaryId, whatsappPhone: conv.whatsappPhone } },
      });
      if (existing) {
        await tx.whatsAppMessage.updateMany({
          where: { conversationId: conv.id },
          data: { conversationId: existing.id },
        });
        await tx.whatsAppConversation.delete({ where: { id: conv.id } });
      } else {
        await tx.whatsAppConversation.update({
          where: { id: conv.id },
          data: { customerId: primaryId },
        });
      }
    }

    await tx.customer.update({
      where: { id: primaryId },
      data: {
        totalSpent: { increment: secondary.totalSpent },
        totalOrders: { increment: secondary.totalOrders },
        marketingConsent: primary.marketingConsent || secondary.marketingConsent,
        whatsappOptIn: primary.whatsappOptIn || secondary.whatsappOptIn,
        notes: [primary.notes, secondary.notes ? `Merged from ${secondary.customerCode}: ${secondary.notes}` : null]
          .filter(Boolean)
          .join('\n\n') || null,
      },
    });

    await tx.customer.update({
      where: { id: secondaryId },
      data: {
        deletedAt: new Date(),
        status: 'ARCHIVED',
        notes: `${secondary.notes ?? ''}\n\nMERGED INTO ${primary.customerCode} on ${new Date().toISOString()}`.trim(),
      },
    });
  });

  await logActivity({
    customerId: primaryId,
    adminId,
    type: 'STATUS_CHANGE',
    title: 'Customer records merged',
    description: `Merged ${secondary.customerCode} into ${primary.customerCode}`,
    metadata: { secondaryId, secondaryCode: secondary.customerCode },
  });

  return getCustomerById(primaryId);
}

export async function addProductInterest(params: {
  customerId: string;
  productId?: string | null;
  categoryId?: string | null;
  productName?: string | null;
  interestLevel?: Prisma.ProductInterestCreateInput['interestLevel'];
  source?: Prisma.ProductInterestCreateInput['source'];
  note?: string | null;
  adminId?: string | null;
}) {
  const customer = await prisma.customer.findFirst({ where: { id: params.customerId, deletedAt: null } });
  if (!customer) throw ApiError.notFound('Customer not found');

  let productName = params.productName ?? null;
  if (params.productId) {
    const product = await prisma.product.findFirst({ where: { id: params.productId, deletedAt: null } });
    if (!product) throw ApiError.notFound('Product not found');
    productName = product.name;
  }

  const existing = await prisma.productInterest.findFirst({
    where: {
      customerId: params.customerId,
      ...(params.productId ? { productId: params.productId } : {}),
      ...(params.categoryId && !params.productId ? { categoryId: params.categoryId } : {}),
    },
  });

  let interest;
  if (existing) {
    interest = await prisma.productInterest.update({
      where: { id: existing.id },
      data: {
        inquiryCount: { increment: 1 },
        interestLevel: params.interestLevel ?? existing.interestLevel,
        lastInteractionAt: new Date(),
        note: params.note ?? existing.note,
        productName: productName ?? existing.productName,
      },
    });
  } else {
    interest = await prisma.productInterest.create({
      data: {
        customerId: params.customerId,
        productId: params.productId ?? null,
        categoryId: params.categoryId ?? null,
        productName,
        interestLevel: params.interestLevel ?? 'MEDIUM',
        source: params.source ?? 'MANUAL',
        note: params.note ?? null,
        lastInteractionAt: new Date(),
      },
    });
  }

  await logActivity({
    customerId: params.customerId,
    adminId: params.adminId,
    type: 'PRODUCT_INTEREST',
    title: 'Product interest recorded',
    description: productName ?? 'Category interest',
    metadata: { productId: params.productId, categoryId: params.categoryId, level: interest.interestLevel },
  });

  return interest;
}

export async function removeProductInterest(id: string) {
  const existing = await prisma.productInterest.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Product interest not found');
  await prisma.productInterest.delete({ where: { id } });
}

export async function getCustomerTimeline(customerId: string, limit = 100) {
  const [activities, messages] = await Promise.all([
    prisma.activity.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { admin: { select: { id: true, fullName: true } } },
    }),
    prisma.whatsAppMessage.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        direction: true,
        body: true,
        type: true,
        status: true,
        createdAt: true,
        fromPhone: true,
      },
    }),
  ]);

  const merged = [
    ...activities.map((a) => ({ kind: 'activity' as const, ...a })),
    ...messages.map((m) => ({ kind: 'message' as const, ...m })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return merged.slice(0, limit);
}

export async function getSegments() {
  const [bySource, byLocation, byStatus, byCategory] = await Promise.all([
    prisma.customer.groupBy({ by: ['source'], _count: { _all: true }, where: { deletedAt: null } }),
    prisma.customer.groupBy({ by: ['location'], _count: { _all: true }, where: { deletedAt: null } }),
    prisma.customer.groupBy({ by: ['status'], _count: { _all: true }, where: { deletedAt: null } }),
    prisma.productInterest.groupBy({ by: ['categoryId'], _count: { _all: true } }),
  ]);

  const categoryIds = byCategory.map((c) => c.categoryId).filter(Boolean) as string[];
  const categories = await prisma.productCategory.findMany({ where: { id: { in: categoryIds } } });

  return {
    bySource: bySource.map((r) => ({ source: r.source, count: r._count._all })),
    byLocation: byLocation.map((r) => ({ location: r.location ?? 'Unknown', count: r._count._all })),
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    byCategory: byCategory.map((r) => ({
      categoryId: r.categoryId,
      category: categories.find((c) => c.id === r.categoryId)?.name ?? 'Unknown',
      count: r._count._all,
    })),
  };
}
