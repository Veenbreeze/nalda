import { Prisma, ProductSource, ProductStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/errors';
import { generateSku } from '../utils/codes';

export interface ProductInput {
  name: string;
  sku?: string;
  description?: string | null;
  categoryId?: string | null;
  brand?: string | null;
  imageUrl?: string | null;
  images?: string[];
  sellingPrice: number | string;
  costPrice?: number | string | null;
  stockQuantity?: number;
  minStockLevel?: number;
  status?: ProductStatus;
  source?: ProductSource;
  isNewArrival?: boolean;
  isFeatured?: boolean;
}

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  status?: ProductStatus;
  isNewArrival?: boolean;
  isFeatured?: boolean;
  lowStock?: boolean;
  includeArchived?: boolean;
  orderBy?: 'createdAt' | 'name' | 'sellingPrice' | 'stockQuantity' | 'purchaseCount';
  orderDir?: 'asc' | 'desc';
}

function buildWhere(filters: ProductFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.status) where.status = filters.status;
  else if (!filters.includeArchived) where.status = { not: 'ARCHIVED' };
  if (filters.isNewArrival !== undefined) where.isNewArrival = filters.isNewArrival;
  if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { sku: { contains: filters.search, mode: 'insensitive' } },
      { brand: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  return where;
}

export async function listProducts(params: { page: number; limit: number; skip: number; filters: ProductFilters }) {
  const where = buildWhere(params.filters);
  if (params.filters.lowStock) {
    const low = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM products
      WHERE "deletedAt" IS NULL AND status <> 'ARCHIVED' AND "stockQuantity" <= "minStockLevel"
    `;
    where.id = { in: low.map((r) => r.id) };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput = {
    [params.filters.orderBy ?? 'createdAt']: params.filters.orderDir ?? 'desc',
  };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: params.skip,
      take: params.limit,
      include: { category: true },
    }),
    prisma.product.count({ where }),
  ]);

  return { data, total };
}

export async function getLowStockProducts() {
  // Prisma cannot compare two columns directly in a simple where; use raw query.
  return prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, name, sku, "stockQuantity", "minStockLevel", "imageUrl"
    FROM products
    WHERE "deletedAt" IS NULL
      AND status <> 'ARCHIVED'
      AND "stockQuantity" <= "minStockLevel"
    ORDER BY "stockQuantity" ASC
    LIMIT 100
  `;
}

export async function getProductById(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: true,
      interests: {
        include: { customer: { select: { id: true, fullName: true, customerCode: true, phone: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      },
      _count: { select: { interests: true, orderItems: true } },
    },
  });
  if (!product) throw ApiError.notFound('Product not found');

  const sold = await prisma.orderItem.aggregate({
    where: { productId: id, order: { status: { notIn: ['CANCELLED'] }, deletedAt: null } },
    _sum: { quantity: true, lineTotal: true },
  });

  return {
    product,
    sales: {
      quantitySold: sold._sum.quantity ?? 0,
      revenue: Number(sold._sum.lineTotal ?? 0),
    },
  };
}

export async function createProduct(input: ProductInput, adminId?: string | null) {
  const sku = input.sku?.trim() || generateSku(input.name);
  const existing = await prisma.product.findUnique({ where: { sku } });
  if (existing) throw ApiError.conflict('A product with this SKU already exists');

  if (input.categoryId) {
    const category = await prisma.productCategory.findFirst({
      where: { id: input.categoryId, deletedAt: null },
    });
    if (!category) throw ApiError.notFound('Product category not found');
  }

  return prisma.product.create({
    data: {
      name: input.name.trim(),
      sku,
      description: input.description ?? null,
      categoryId: input.categoryId ?? null,
      brand: input.brand ?? null,
      imageUrl: input.imageUrl ?? null,
      images: input.images ?? [],
      sellingPrice: new Prisma.Decimal(input.sellingPrice),
      costPrice: input.costPrice !== undefined && input.costPrice !== null ? new Prisma.Decimal(input.costPrice) : null,
      stockQuantity: input.stockQuantity ?? 0,
      minStockLevel: input.minStockLevel ?? 5,
      status: input.status ?? 'ACTIVE',
      source: input.source ?? 'USA_IMPORT',
      isNewArrival: input.isNewArrival ?? false,
      isFeatured: input.isFeatured ?? false,
    },
    include: { category: true },
  });
}

export async function updateProduct(id: string, input: Partial<ProductInput>, adminId?: string | null) {
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Product not found');

  const data: Prisma.ProductUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.sku !== undefined && input.sku.trim() !== existing.sku) {
    const clash = await prisma.product.findUnique({ where: { sku: input.sku.trim() } });
    if (clash) throw ApiError.conflict('A product with this SKU already exists');
    data.sku = input.sku.trim();
  }
  if (input.description !== undefined) data.description = input.description;
  if (input.categoryId !== undefined) {
    data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
    if (input.categoryId) {
      const category = await prisma.productCategory.findUnique({ where: { id: input.categoryId } });
      if (!category) throw ApiError.notFound('Product category not found');
    }
  }
  if (input.brand !== undefined) data.brand = input.brand;
  if (input.imageUrl !== undefined) data.imageUrl = input.imageUrl;
  if (input.images !== undefined) data.images = input.images;
  if (input.sellingPrice !== undefined) data.sellingPrice = new Prisma.Decimal(input.sellingPrice);
  if (input.costPrice !== undefined)
    data.costPrice = input.costPrice === null ? null : new Prisma.Decimal(input.costPrice);
  if (input.stockQuantity !== undefined) data.stockQuantity = input.stockQuantity;
  if (input.minStockLevel !== undefined) data.minStockLevel = input.minStockLevel;
  if (input.status !== undefined) data.status = input.status;
  if (input.source !== undefined) data.source = input.source;
  if (input.isNewArrival !== undefined) data.isNewArrival = input.isNewArrival;
  if (input.isFeatured !== undefined) data.isFeatured = input.isFeatured;

  const wasOutOfStock = existing.stockQuantity <= 0;
  const updated = await prisma.product.update({ where: { id }, data, include: { category: true } });

  const becameAvailable = wasOutOfStock && updated.stockQuantity > 0;
  if (becameAvailable || (input.isNewArrival === true && !existing.isNewArrival)) {
    const { runAutomationForProduct } = await import('./automation.service');
    runAutomationForProduct(updated.id, becameAvailable ? 'RESTOCK' : 'NEW_ARRIVAL', adminId).catch((err) =>
      console.error('Automation trigger failed', err),
    );
  }

  return updated;
}

export async function archiveProduct(id: string) {
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Product not found');
  return prisma.product.update({ where: { id }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
}

export async function adjustStock(id: string, delta: number) {
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Product not found');
  const newQty = existing.stockQuantity + delta;
  if (newQty < 0) throw ApiError.badRequest('Stock cannot go below zero');
  return prisma.product.update({
    where: { id },
    data: { stockQuantity: newQty, status: newQty > 0 ? 'ACTIVE' : 'OUT_OF_STOCK' },
    include: { category: true },
  });
}

// ---------------- Categories ----------------

export async function listCategories() {
  const categories = await prisma.productCategory.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  });
  return categories;
}

export async function createCategory(input: { name: string; description?: string | null }) {
  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const existing = await prisma.productCategory.findFirst({
    where: { OR: [{ name: input.name.trim() }, { slug }] },
  });
  if (existing) throw ApiError.conflict('A category with this name already exists');
  return prisma.productCategory.create({
    data: { name: input.name.trim(), slug, description: input.description ?? null },
  });
}

export async function updateCategory(id: string, input: { name?: string; description?: string | null }) {
  const existing = await prisma.productCategory.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Category not found');
  const data: Prisma.ProductCategoryUpdateInput = {};
  if (input.name !== undefined) {
    data.name = input.name.trim();
    data.slug = input.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  if (input.description !== undefined) data.description = input.description;
  return prisma.productCategory.update({ where: { id }, data });
}

export async function deleteCategory(id: string) {
  const existing = await prisma.productCategory.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw ApiError.notFound('Category not found');
  const count = await prisma.product.count({ where: { categoryId: id, deletedAt: null } });
  if (count > 0) throw ApiError.badRequest('Cannot delete a category that still has products');
  return prisma.productCategory.update({ where: { id }, data: { deletedAt: new Date() } });
}
