import { prisma } from '../config/database';

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthRange(months: number) {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

export async function getDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    totalCustomers,
    newCustomersThisMonth,
    activeCustomers,
    archivedCustomers,
    totalProducts,
    totalOrders,
    pendingOrders,
    confirmedOrders,
    completedOrders,
    cancelledOrders,
    newArrivals,
    unreadConversations,
    pendingTasks,
    overdueTasks,
  ] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.customer.count({ where: { deletedAt: null, createdAt: { gte: startOfMonth } } }),
    prisma.customer.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    prisma.customer.count({ where: { status: 'ARCHIVED' } }),
    prisma.product.count({ where: { deletedAt: null, status: { not: 'ARCHIVED' } } }),
    prisma.order.count({ where: { deletedAt: null } }),
    prisma.order.count({ where: { deletedAt: null, status: { in: ['NEW', 'PENDING_CONFIRMATION'] } } }),
    prisma.order.count({ where: { deletedAt: null, status: 'CONFIRMED' } }),
    prisma.order.count({ where: { deletedAt: null, status: 'DELIVERED' } }),
    prisma.order.count({ where: { deletedAt: null, status: 'CANCELLED' } }),
    prisma.product.count({ where: { deletedAt: null, isNewArrival: true } }),
    prisma.whatsAppConversation.count({ where: { unreadCount: { gt: 0 } } }),
    prisma.activity.count({ where: { isTask: true, taskStatus: { in: ['PENDING', 'IN_PROGRESS'] } } }),
    prisma.activity.count({
      where: { isTask: true, dueAt: { lt: now }, taskStatus: { in: ['PENDING', 'IN_PROGRESS'] } },
    }),
  ]);

  const salesAgg = await prisma.order.aggregate({
    where: { deletedAt: null, status: { not: 'CANCELLED' } },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });
  const monthSalesAgg = await prisma.order.aggregate({
    where: { deletedAt: null, status: { not: 'CANCELLED' }, orderDate: { gte: startOfMonth } },
    _sum: { totalAmount: true },
  });

  const [lowStock, recentOrders, recentActivities, recentConversations, topCustomers] = await Promise.all([
    prisma.$queryRaw<Array<{ id: string; name: string; sku: string; stockQuantity: number; minStockLevel: number }>>`
      SELECT id, name, sku, "stockQuantity", "minStockLevel"
      FROM products
      WHERE "deletedAt" IS NULL AND status <> 'ARCHIVED' AND "stockQuantity" <= "minStockLevel"
      ORDER BY "stockQuantity" ASC LIMIT 10
    `,
    prisma.order.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { customer: { select: { id: true, fullName: true, customerCode: true } }, items: true },
    }),
    prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        customer: { select: { id: true, fullName: true } },
        admin: { select: { id: true, fullName: true } },
      },
    }),
    prisma.whatsAppConversation.findMany({
      orderBy: { lastMessageAt: 'desc' },
      take: 8,
      include: { customer: { select: { id: true, fullName: true, customerCode: true, phone: true } } },
    }),
    prisma.customer.findMany({
      where: { deletedAt: null },
      orderBy: { totalSpent: 'desc' },
      take: 5,
      select: { id: true, fullName: true, customerCode: true, totalSpent: true, totalOrders: true },
    }),
  ]);

  // Birthdays this month
  const birthdayCustomers = await prisma.$queryRaw<
    Array<{ id: string; fullName: string; dateOfBirth: Date; phone: string }>
  >`
    SELECT id, "fullName", "dateOfBirth", phone FROM customers
    WHERE "deletedAt" IS NULL AND "dateOfBirth" IS NOT NULL
      AND EXTRACT(MONTH FROM "dateOfBirth") = ${now.getMonth() + 1}
    ORDER BY EXTRACT(DAY FROM "dateOfBirth") ASC LIMIT 20
  `;

  const inactiveCustomers = await prisma.customer.count({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      OR: [{ lastPurchaseAt: { lt: sixtyDaysAgo } }, { lastPurchaseAt: null }],
    },
  });

  const topProducts = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
    where: {
      productId: { not: null },
      order: { status: { not: 'CANCELLED' }, deletedAt: null },
    },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 6,
  });
  const topProductIds = topProducts.map((p) => p.productId!).filter(Boolean);
  const topProductDetails = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, name: true, imageUrl: true },
  });

  const mostInterested = await prisma.productInterest.groupBy({
    by: ['productId'],
    _count: { _all: true },
    where: { productId: { not: null } },
    orderBy: { _count: { productId: 'desc' } },
    take: 6,
  });
  const interestedIds = mostInterested.map((p) => p.productId!).filter(Boolean);
  const interestedDetails = await prisma.product.findMany({
    where: { id: { in: interestedIds } },
    select: { id: true, name: true, imageUrl: true },
  });

  // Chart data
  const customerGrowthRaw = await prisma.$queryRaw<Array<{ bucket: Date; count: bigint }>>`
    SELECT date_trunc('month', "createdAt") AS bucket, COUNT(*)::bigint AS count
    FROM customers WHERE "deletedAt" IS NULL AND "createdAt" >= ${twelveMonthsAgo}
    GROUP BY bucket ORDER BY bucket ASC
  `;
  const monthlySalesRaw = await prisma.$queryRaw<Array<{ bucket: Date; total: string }>>`
    SELECT date_trunc('month', "orderDate") AS bucket, COALESCE(SUM("totalAmount"),0)::text AS total
    FROM orders
    WHERE "deletedAt" IS NULL AND status <> 'CANCELLED' AND "orderDate" >= ${twelveMonthsAgo}
    GROUP BY bucket ORDER BY bucket ASC
  `;
  const orderTrendRaw = await prisma.$queryRaw<Array<{ bucket: Date; count: bigint; total: string }>>`
    SELECT date_trunc('day', "orderDate") AS bucket, COUNT(*)::bigint AS count, COALESCE(SUM("totalAmount"),0)::text AS total
    FROM orders
    WHERE "deletedAt" IS NULL AND status <> 'CANCELLED' AND "orderDate" >= ${thirtyDaysAgo}
    GROUP BY bucket ORDER BY bucket ASC
  `;
  const salesByCategoryRaw = await prisma.$queryRaw<Array<{ category: string; total: string }>>`
    SELECT COALESCE(pc.name, 'Uncategorised') AS category, COALESCE(SUM(oi."lineTotal"),0)::text AS total
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    LEFT JOIN products p ON p.id = oi."productId"
    LEFT JOIN product_categories pc ON pc.id = p."categoryId"
    WHERE o."deletedAt" IS NULL AND o.status <> 'CANCELLED'
    GROUP BY category ORDER BY SUM(oi."lineTotal") DESC
  `;
  const statusDistribution = await prisma.order.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: { deletedAt: null },
  });
  const sourceDistribution = await prisma.customer.groupBy({
    by: ['source'],
    _count: { _all: true },
    where: { deletedAt: null },
  });

  const months = buildMonthRange(12);
  const customerGrowth = months.map((m) => {
    const row = customerGrowthRaw.find((r) => monthKey(new Date(r.bucket)) === m);
    return { month: m, customers: row ? Number(row.count) : 0 };
  });
  const monthlySales = months.map((m) => {
    const row = monthlySalesRaw.find((r) => monthKey(new Date(r.bucket)) === m);
    return { month: m, sales: row ? Number(row.total) : 0 };
  });
  const orderTrends = orderTrendRaw.map((r) => ({
    date: new Date(r.bucket).toISOString().slice(0, 10),
    orders: Number(r.count),
    sales: Number(r.total),
  }));

  const productPopularity = topProducts.map((p) => {
    const detail = topProductDetails.find((d) => d.id === p.productId);
    return { productId: p.productId, name: detail?.name ?? 'Unknown', quantity: p._sum.quantity ?? 0 };
  });
  const interestPopularity = mostInterested.map((p) => {
    const detail = interestedDetails.find((d) => d.id === p.productId);
    return { productId: p.productId, name: detail?.name ?? 'Unknown', interests: p._count._all };
  });

  const purchaseFrequencyRaw = await prisma.$queryRaw<Array<{ orders: bigint; customers: bigint }>>`
    SELECT order_count AS orders, COUNT(*)::bigint AS customers FROM (
      SELECT "customerId", COUNT(*) AS order_count
      FROM orders WHERE "deletedAt" IS NULL AND status <> 'CANCELLED'
      GROUP BY "customerId"
    ) t GROUP BY order_count ORDER BY order_count ASC
  `;

  return {
    stats: {
      totalCustomers,
      newCustomersThisMonth,
      activeCustomers,
      archivedCustomers,
      inactiveCustomers,
      totalProducts,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      completedOrders,
      cancelledOrders,
      newArrivals,
      totalSales: Number(salesAgg._sum.totalAmount ?? 0),
      monthlySales: Number(monthSalesAgg._sum.totalAmount ?? 0),
      totalPaidOrders: salesAgg._count._all,
      unreadConversations,
      pendingTasks,
      overdueTasks,
      today: startOfToday.toISOString(),
    },
    charts: {
      customerGrowth,
      monthlySales,
      orderTrends,
      productPopularity,
      interestPopularity,
      salesByCategory: salesByCategoryRaw.map((r) => ({ category: r.category, total: Number(r.total) })),
      orderStatusDistribution: statusDistribution.map((r) => ({ status: r.status, count: r._count._all })),
      customerSourceDistribution: sourceDistribution.map((r) => ({ source: r.source, count: r._count._all })),
      purchaseFrequency: purchaseFrequencyRaw.map((r) => ({
        orders: Number(r.orders),
        customers: Number(r.customers),
      })),
    },
    lists: {
      lowStock,
      recentOrders,
      recentActivities,
      recentConversations,
      topCustomers,
      birthdays: birthdayCustomers,
      topProducts: productPopularity,
      mostInterested: interestPopularity,
    },
  };
}

export async function getReports(from: Date, to: Date) {
  const range = { gte: from, lte: to };

  const [salesAgg, ordersCount, cancelled, newCustomers, totalCustomers, avgAgg] = await Promise.all([
    prisma.order.aggregate({
      where: { deletedAt: null, status: { not: 'CANCELLED' }, orderDate: range },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({ where: { deletedAt: null, status: { not: 'CANCELLED' }, orderDate: range } }),
    prisma.order.count({ where: { deletedAt: null, status: 'CANCELLED', orderDate: range } }),
    prisma.customer.count({ where: { deletedAt: null, createdAt: range } }),
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.order.aggregate({
      where: { deletedAt: null, status: { not: 'CANCELLED' }, orderDate: range },
      _avg: { totalAmount: true },
    }),
  ]);

  const byLocation = await prisma.customer.groupBy({
    by: ['location'],
    _count: { _all: true },
    where: { deletedAt: null },
    orderBy: { _count: { location: 'desc' } },
    take: 20,
  });

  const bySource = await prisma.customer.groupBy({
    by: ['source'],
    _count: { _all: true },
    where: { deletedAt: null },
  });

  const topCustomers = await prisma.customer.findMany({
    where: { deletedAt: null },
    orderBy: { totalSpent: 'desc' },
    take: 20,
    select: { id: true, fullName: true, customerCode: true, totalSpent: true, totalOrders: true, location: true },
  });

  const topProductsRaw = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true, lineTotal: true },
    where: { order: { deletedAt: null, status: { not: 'CANCELLED' }, orderDate: range }, productId: { not: null } },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 20,
  });
  const productIds = topProductsRaw.map((p) => p.productId!).filter(Boolean);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } });
  const topProducts = topProductsRaw.map((p) => ({
    productId: p.productId,
    name: products.find((x) => x.id === p.productId)?.name ?? 'Unknown',
    quantity: p._sum.quantity ?? 0,
    revenue: Number(p._sum.lineTotal ?? 0),
  }));

  const salesByCategoryRaw = await prisma.$queryRaw<Array<{ category: string; total: string; quantity: bigint }>>`
    SELECT COALESCE(pc.name, 'Uncategorised') AS category,
           COALESCE(SUM(oi."lineTotal"),0)::text AS total,
           COALESCE(SUM(oi.quantity),0)::bigint AS quantity
    FROM order_items oi
    JOIN orders o ON o.id = oi."orderId"
    LEFT JOIN products p ON p.id = oi."productId"
    LEFT JOIN product_categories pc ON pc.id = p."categoryId"
    WHERE o."deletedAt" IS NULL AND o.status <> 'CANCELLED' AND o."orderDate" BETWEEN ${from} AND ${to}
    GROUP BY category ORDER BY SUM(oi."lineTotal") DESC
  `;

  const salesByDayRaw = await prisma.$queryRaw<Array<{ bucket: Date; total: string; count: bigint }>>`
    SELECT date_trunc('day', "orderDate") AS bucket,
           COALESCE(SUM("totalAmount"),0)::text AS total,
           COUNT(*)::bigint AS count
    FROM orders
    WHERE "deletedAt" IS NULL AND status <> 'CANCELLED' AND "orderDate" BETWEEN ${from} AND ${to}
    GROUP BY bucket ORDER BY bucket ASC
  `;

  const whatsappStats = await prisma.whatsAppMessage.groupBy({
    by: ['direction'],
    _count: { _all: true },
    where: { createdAt: range },
  });
  const whatsappDelivery = await prisma.whatsAppMessage.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: { direction: 'OUTBOUND', createdAt: range },
  });

  const lowStock = await prisma.$queryRaw<Array<{ id: string; name: string; stockQuantity: number; minStockLevel: number }>>`
    SELECT id, name, "stockQuantity", "minStockLevel" FROM products
    WHERE "deletedAt" IS NULL AND status <> 'ARCHIVED' AND "stockQuantity" <= "minStockLevel"
    ORDER BY "stockQuantity" ASC
  `;

  const mostRequested = await prisma.productInterest.groupBy({
    by: ['productId'],
    _count: { _all: true },
    where: { productId: { not: null } },
    orderBy: { _count: { productId: 'desc' } },
    take: 20,
  });
  const requestedIds = mostRequested.map((r) => r.productId!).filter(Boolean);
  const requestedProducts = await prisma.product.findMany({
    where: { id: { in: requestedIds } },
    select: { id: true, name: true },
  });

  return {
    range: { from, to },
    sales: {
      totalSales: Number(salesAgg._sum.totalAmount ?? 0),
      totalOrders: ordersCount,
      cancelledOrders: cancelled,
      averageOrderValue: Number(avgAgg._avg.totalAmount ?? 0),
      byDay: salesByDayRaw.map((r) => ({
        date: new Date(r.bucket).toISOString().slice(0, 10),
        total: Number(r.total),
        orders: Number(r.count),
      })),
      byCategory: salesByCategoryRaw.map((r) => ({
        category: r.category,
        total: Number(r.total),
        quantity: Number(r.quantity),
      })),
      topProducts,
    },
    customers: {
      totalCustomers,
      newCustomers,
      byLocation: byLocation.map((r) => ({ location: r.location ?? 'Unknown', count: r._count._all })),
      bySource: bySource.map((r) => ({ source: r.source, count: r._count._all })),
      topCustomers,
    },
    products: {
      lowStock,
      mostRequested: mostRequested.map((r) => ({
        productId: r.productId,
        name: requestedProducts.find((p) => p.id === r.productId)?.name ?? 'Unknown',
        interests: r._count._all,
      })),
    },
    whatsapp: {
      received: whatsappStats.find((s) => s.direction === 'INBOUND')?._count._all ?? 0,
      sent: whatsappStats.find((s) => s.direction === 'OUTBOUND')?._count._all ?? 0,
      byStatus: whatsappDelivery.map((s) => ({ status: s.status, count: s._count._all })),
    },
  };
}
