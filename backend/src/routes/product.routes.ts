import { Request, Router } from 'express';
import { asyncHandler, paginated, parsePagination } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { uploadImage } from '../middleware/upload';
import { uploadBuffer } from '../integrations/cloudinary';
import { PERMISSIONS } from '../config/permissions';
import * as productService from '../services/product.service';
import {
  adjustStockSchema,
  createCategorySchema,
  createProductSchema,
  updateCategorySchema,
  updateProductSchema,
} from '../validators/schemas';
import { recordAudit } from '../utils/audit';

const router = Router();
router.use(authenticate);

function audit(req: Request, action: string, entityType: string, entityId?: string, description?: string) {
  return recordAudit({
    adminId: req.admin?.id,
    action,
    entityType,
    entityId,
    description,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  });
}

router.get(
  '/',
  requirePermission(PERMISSIONS.PRODUCT_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const result = await productService.listProducts({
      page,
      limit,
      skip,
      filters: {
        search: q.search,
        categoryId: q.categoryId,
        status: q.status as productService.ProductFilters['status'],
        isNewArrival: q.isNewArrival === undefined ? undefined : q.isNewArrival === 'true',
        isFeatured: q.isFeatured === undefined ? undefined : q.isFeatured === 'true',
        lowStock: q.lowStock === 'true',
        includeArchived: q.includeArchived === 'true',
        orderBy: q.orderBy as productService.ProductFilters['orderBy'],
        orderDir: q.orderDir as 'asc' | 'desc' | undefined,
      },
    });
    const data = result.data.map((p) => ({
      ...p,
      costPrice: req.admin!.permissions.includes('*') || req.admin!.permissions.includes(PERMISSIONS.PRODUCT_VIEW_COST) ? p.costPrice : undefined,
    }));
    res.json({ success: true, ...paginated(data, result.total, page, limit) });
  }),
);

router.get(
  '/low-stock',
  requirePermission(PERMISSIONS.PRODUCT_VIEW),
  asyncHandler(async (_req, res) => {
    const products = await productService.getLowStockProducts();
    res.json({ success: true, data: products });
  }),
);

// Categories
router.get(
  '/categories',
  requirePermission(PERMISSIONS.PRODUCT_VIEW),
  asyncHandler(async (_req, res) => {
    const categories = await productService.listCategories();
    res.json({ success: true, data: categories });
  }),
);

router.post(
  '/categories',
  requirePermission(PERMISSIONS.PRODUCT_CREATE),
  validate(createCategorySchema),
  asyncHandler(async (req, res) => {
    const category = await productService.createCategory(req.body);
    await audit(req, 'CATEGORY_CREATED', 'ProductCategory', category.id, category.name);
    res.status(201).json({ success: true, data: category });
  }),
);

router.patch(
  '/categories/:id',
  requirePermission(PERMISSIONS.PRODUCT_UPDATE),
  validate(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const category = await productService.updateCategory(req.params.id, req.body);
    await audit(req, 'CATEGORY_UPDATED', 'ProductCategory', category.id);
    res.json({ success: true, data: category });
  }),
);

router.delete(
  '/categories/:id',
  requirePermission(PERMISSIONS.PRODUCT_DELETE),
  asyncHandler(async (req, res) => {
    await productService.deleteCategory(req.params.id);
    await audit(req, 'CATEGORY_DELETED', 'ProductCategory', req.params.id);
    res.json({ success: true, data: { message: 'Category deleted' } });
  }),
);

router.post(
  '/upload-image',
  requirePermission(PERMISSIONS.PRODUCT_CREATE),
  uploadImage.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new Error('No image uploaded');
    const result = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.status(201).json({ success: true, data: result });
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCT_VIEW),
  asyncHandler(async (req, res) => {
    const result = await productService.getProductById(req.params.id);
    const canViewCost =
      req.admin!.permissions.includes('*') || req.admin!.permissions.includes(PERMISSIONS.PRODUCT_VIEW_COST);
    res.json({
      success: true,
      data: {
        ...result,
        product: { ...result.product, costPrice: canViewCost ? result.product.costPrice : undefined },
      },
    });
  }),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.PRODUCT_CREATE),
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    const product = await productService.createProduct(req.body, req.admin!.id);
    await audit(req, 'PRODUCT_CREATED', 'Product', product.id, product.name);
    res.status(201).json({ success: true, data: product });
  }),
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCT_UPDATE),
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const product = await productService.updateProduct(req.params.id, req.body, req.admin!.id);
    await audit(req, 'PRODUCT_UPDATED', 'Product', product.id);
    res.json({ success: true, data: product });
  }),
);

router.post(
  '/:id/adjust-stock',
  requirePermission(PERMISSIONS.PRODUCT_UPDATE),
  validate(adjustStockSchema),
  asyncHandler(async (req, res) => {
    const product = await productService.adjustStock(req.params.id, req.body.delta);
    await audit(req, 'PRODUCT_STOCK_ADJUSTED', 'Product', product.id, `Delta ${req.body.delta}`);
    res.json({ success: true, data: product });
  }),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.PRODUCT_DELETE),
  asyncHandler(async (req, res) => {
    await productService.archiveProduct(req.params.id);
    await audit(req, 'PRODUCT_ARCHIVED', 'Product', req.params.id);
    res.json({ success: true, data: { message: 'Product archived' } });
  }),
);

export default router;
