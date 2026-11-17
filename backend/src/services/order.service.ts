import { OrderSource, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/errors';
import { generateOrderNumber } from '../utils/codes';
import { logActivity } from './activity.service';

export interface OrderItemInput {
  productId?: string | null;
  productName?: string;
  quantity: number;
  unitPrice?: number | string;
}

export interface CreateOrderInput {
  customerId: string;
  source?: OrderSource;
  status?: OrderStatus;
  items: OrderItemInput[];
  discount?: number | string;
  notes?: string | null;
  whatsappMessageRef?: string | null;
  needsReview?: boolean;
  orderDate?: string | Date;
}

export interface OrderFilters {
  search?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  source?: OrderSource;
  customerId?: string;
  from?: Date;
  to?: Date;
  needsReview?: boolean;
  orderBy?: 'orderDate' | 'totalAmount' | 'createdAt';
  orderDir?: 'asc' | 'desc';
}

async function buildItems(items: OrderItemInput[]) {
  if (!items.length) throw ApiError.validation('An order must contain at least one item');
  const resolved: { productId: string | null; productName: string; quantity: number; unitPrice: Prisma.Decimal; lineTotal: Prisma.Decimal }[] = [];

  for (const item of items) {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    let productName = item.productName?.trim() || '';
    let unitPrice = item.unitPrice !== undefined ? new Prisma.Decimal(item.unitPrice) : undefined;
    let productId: string | null = null;

    if (item.productId) {
      const product = await prisma.product.findFirst({ where: { id: item.productId, deletedAt: null } });
      if (!product) throw ApiError.notFound(`Product not found: ${item.productId}`);
      productId = product.id;
      productName = product.name;
      if (!unitPrice) unitPrice = product.sellingPrice;
    }

    if (!productName) throw ApiError.validation('Each order item requires a product or product name');
    if (!unitPrice) throw ApiError.validation(`A unit price is required for ${productName}`);

    resolved.push({
      productId,
      productName,
      quantity,
      unitPrice,
      lineTotal: unitPrice.mul(quantity),
    });
  }

  return resolved;
}

export async function listOrders(params: { page: number; limit: number; skip: number; filters: OrderFilters }) {
  const where: Prisma.OrderWhereInput = { deletedAt: null };
  const f = params.filters;
  if (f.status) where.status = f.status;
  if (f.paymentStatus) where.paymentStatus = f.paymentStatus;
  if (f.source) where.source = f.source;
  if (f.customerId) where.customerId = f.customerId;
  if (f.needsReview !== undefined) where.needsReview = f.needsReview;
  if (f.from || f.to) {
    where.orderDate = {
      ...(f.from ? { gte: f.from } : {}),
      ...(f.to ? { lte: f.to } : {}),
    };
  }
  if (f.search) {
    where.OR = [
      { orderNumber: { contains: f.search, mode: 'insensitive' } },
      { customer: { fullName: { contains: f.search, mode: 'insensitive' } } },
      { customer: { phone: { contains: f.search } } },
    ];
  }

  const orderBy: Prisma.OrderOrderByWithRelationInput = {
    [f.orderBy ?? 'orderDate']: f.orderDir ?? 'desc',
  };

  const [data, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy,
      skip: params.skip,
      take: params.limit,
      include: {
        customer: { select: { id: true, fullName: true, customerCode: true, phone: true } },
        items: true,
        _count: { select: { items: true, payments: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return { data, total };
}

export async function getOrderById(id: string) {
  const order = await prisma.order.findFirst({
    where: { id, deletedAt: null },
    include: {
      customer: {
        select: { id: true, fullName: true, customerCode: true, phone: true, whatsappPhone: true, location: true },
      },
      items: { include: { product: { select: { id: true, sku: true, imageUrl: true } } } },
      payments: { orderBy: { paidAt: 'desc' } },
    },
  });
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

export async function recalcCustomerStats(customerId: string) {
  const agg = await prisma.order.aggregate({
    where: { customerId, deletedAt: null, status: { not: 'CANCELLED' } },
    _sum: { totalAmount: true },
    _count: { _all: true },
    _max: { orderDate: true },
  });
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      totalSpent: agg._sum.totalAmount ?? new Prisma.Decimal(0),
      totalOrders: agg._count._all,
      lastPurchaseAt: agg._max.orderDate ?? null,
    },
  });
}

export async function createOrder(input: CreateOrderInput, adminId?: string | null) {
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
  if (!customer) throw ApiError.notFound('Customer not found');

  const items = await buildItems(input.items);
  const subtotal = items.reduce((acc, i) => acc.add(i.lineTotal), new Prisma.Decimal(0));
  const discount = new Prisma.Decimal(input.discount ?? 0);
  const total = subtotal.sub(discount);

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx);
    return tx.order.create({
      data: {
        orderNumber,
        customerId: input.customerId,
        source: input.source ?? 'MANUAL',
        status: input.status ?? 'NEW',
        subtotal,
        discount,
        totalAmount: total,
        notes: input.notes ?? null,
        whatsappMessageRef: input.whatsappMessageRef ?? null,
        needsReview: input.needsReview ?? false,
        orderDate: input.orderDate ? new Date(input.orderDate) : new Date(),
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
          })),
        },
      },
      include: { items: true, customer: { select: { id: true, fullName: true, phone: true } } },
    });
  });

  await logActivity({
    customerId: input.customerId,
    adminId,
    type: 'ORDER_RECEIVED',
    title: `Order ${order.orderNumber} created`,
    description: `${items.length} item(s) - TZS ${total.toFixed(2)}`,
    source: input.source ?? 'MANUAL',
    metadata: { orderId: order.id, orderNumber: order.orderNumber, total: total.toString() },
  });

  return order;
}

export async function updateOrder(id: string, input: Partial<CreateOrderInput>, adminId?: string | null) {
  const existing = await prisma.order.findFirst({ where: { id, deletedAt: null }, include: { items: true } });
  if (!existing) throw ApiError.notFound('Order not found');
  if (existing.status === 'DELIVERED' || existing.status === 'CANCELLED') {
    throw ApiError.badRequest('Delivered or cancelled orders cannot be edited');
  }

  let itemsData: Awaited<ReturnType<typeof buildItems>> | undefined;
  let subtotal: Prisma.Decimal | undefined;
  let discount: Prisma.Decimal | undefined;
  let total: Prisma.Decimal | undefined;

  if (input.items) {
    itemsData = await buildItems(input.items);
    subtotal = itemsData.reduce((acc, i) => acc.add(i.lineTotal), new Prisma.Decimal(0));
    discount = new Prisma.Decimal(input.discount ?? existing.discount);
    total = subtotal.sub(discount);
  } else if (input.discount !== undefined) {
    discount = new Prisma.Decimal(input.discount);
    subtotal = existing.subtotal;
    total = subtotal.sub(discount);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (itemsData) {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.orderItem.createMany({
        data: itemsData.map((i) => ({
          orderId: id,
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
      });
    }
    return tx.order.update({
      where: { id },
      data: {
        source: input.source ?? existing.source,
        status: input.status ?? existing.status,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        needsReview: input.needsReview ?? existing.needsReview,
        ...(subtotal !== undefined ? { subtotal } : {}),
        ...(discount !== undefined ? { discount } : {}),
        ...(total !== undefined ? { totalAmount: total } : {}),
      },
      include: { items: true, payments: true },
    });
  });

  if (input.status && input.status !== existing.status) {
    await applyStatusTransition(id, existing.status, input.status, adminId);
  }

  if (total !== undefined) {
    const paid = updated.payments.reduce((acc, p) => acc.add(p.amount), new Prisma.Decimal(0));
    const paymentStatus = computePaymentStatus(updated.amountPaid, updated.totalAmount);
    await prisma.order.update({ where: { id }, data: { amountPaid: paid, paymentStatus } });
  }

  await recalcCustomerStats(existing.customerId);
  return getOrderById(id);
}

async function applyStatusTransition(
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  adminId?: string | null,
) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;

  const preConfirmed = ['NEW', 'PENDING_CONFIRMATION'];
  const postConfirmed = ['CONFIRMED', 'PROCESSING', 'READY_FOR_COLLECTION', 'DISPATCHED', 'DELIVERED'];

  if (to === 'CONFIRMED' && preConfirmed.includes(from)) {
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { decrement: item.quantity },
              purchaseCount: { increment: item.quantity },
            },
          });
        }
      }
      await tx.order.update({ where: { id: orderId }, data: { confirmedAt: new Date() } });
    });
    await logActivity({
      customerId: order.customerId,
      adminId,
      type: 'ORDER_CONFIRMED',
      title: `Order ${order.orderNumber} confirmed`,
      metadata: { orderId, orderNumber: order.orderNumber },
    });
  }

  if (to === 'DELIVERED') {
    await prisma.order.update({ where: { id: orderId }, data: { deliveredAt: new Date() } });
    await logActivity({
      customerId: order.customerId,
      adminId,
      type: 'PURCHASE',
      title: `Order ${order.orderNumber} delivered`,
      metadata: { orderId, orderNumber: order.orderNumber, total: order.totalAmount.toString() },
    });
  }

  if (to === 'CANCELLED' && postConfirmed.includes(from)) {
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { increment: item.quantity },
              purchaseCount: { decrement: item.quantity },
            },
          });
        }
      }
    });
    await logActivity({
      customerId: order.customerId,
      adminId,
      type: 'STATUS_CHANGE',
      title: `Order ${order.orderNumber} cancelled`,
      metadata: { orderId, orderNumber: order.orderNumber },
    });
  }

  await recalcCustomerStats(order.customerId);
}

function computePaymentStatus(amountPaid: Prisma.Decimal | number, total: Prisma.Decimal | number): PaymentStatus {
  const paid = new Prisma.Decimal(amountPaid);
  const amount = new Prisma.Decimal(total);
  if (paid.lte(0)) return 'UNPAID';
  if (paid.gte(amount)) return 'PAID';
  return 'PARTIALLY_PAID';
}

export async function updateOrderStatus(id: string, status: OrderStatus, adminId?: string | null) {
  const existing = await prisma.order.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Order not found');
  if (existing.status === status) return getOrderById(id);
  await prisma.order.update({ where: { id }, data: { status } });
  await applyStatusTransition(id, existing.status, status, adminId);
  await recalcCustomerStats(existing.customerId);
  return getOrderById(id);
}

export async function recordPayment(
  orderId: string,
  input: { amount: number | string; method?: PaymentMethod; reference?: string | null; notes?: string | null; paidAt?: string | Date },
  adminId?: string | null,
) {
  const order = await prisma.order.findFirst({ where: { id: orderId, deletedAt: null } });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.status === 'CANCELLED') throw ApiError.badRequest('Cannot record a payment for a cancelled order');

  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(0)) throw ApiError.validation('Payment amount must be greater than zero');

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        orderId,
        amount,
        method: input.method ?? 'CASH',
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
        recordedBy: adminId ?? null,
      },
    });
    const amountPaid = order.amountPaid.add(amount);
    await tx.order.update({
      where: { id: orderId },
      data: { amountPaid, paymentStatus: computePaymentStatus(amountPaid, order.totalAmount) },
    });
    return p;
  });

  await logActivity({
    customerId: order.customerId,
    adminId,
    type: 'PAYMENT',
    title: `Payment recorded for ${order.orderNumber}`,
    description: `TZS ${amount.toFixed(2)} via ${input.method ?? 'CASH'}`,
    metadata: { orderId, paymentId: payment.id, amount: amount.toString() },
  });

  await recalcCustomerStats(order.customerId);
  return payment;
}

export async function deleteOrder(id: string) {
  const existing = await prisma.order.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Order not found');
  await prisma.order.update({ where: { id }, data: { deletedAt: new Date() } });
  await recalcCustomerStats(existing.customerId);
}
