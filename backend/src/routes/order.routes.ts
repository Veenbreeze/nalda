import { Request, Router } from 'express';
import { asyncHandler, paginated, parsePagination } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import * as orderService from '../services/order.service';
import {
  createOrderSchema,
  recordPaymentSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
} from '../validators/schemas';
import { recordAudit } from '../utils/audit';

const router = Router();
router.use(authenticate);

function audit(req: Request, action: string, entityId?: string, description?: string) {
  return recordAudit({
    adminId: req.admin?.id,
    action,
    entityType: 'Order',
    entityId,
    description,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  });
}

router.get(
  '/',
  requirePermission(PERMISSIONS.ORDER_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const result = await orderService.listOrders({
      page,
      limit,
      skip,
      filters: {
        search: q.search,
        status: q.status as orderService.OrderFilters['status'],
        paymentStatus: q.paymentStatus as orderService.OrderFilters['paymentStatus'],
        source: q.source as orderService.OrderFilters['source'],
        customerId: q.customerId,
        needsReview: q.needsReview === undefined ? undefined : q.needsReview === 'true',
        from: q.from ? new Date(q.from) : undefined,
        to: q.to ? new Date(q.to) : undefined,
        orderBy: q.orderBy as orderService.OrderFilters['orderBy'],
        orderDir: q.orderDir as 'asc' | 'desc' | undefined,
      },
    });
    res.json({ success: true, ...paginated(result.data, result.total, page, limit) });
  }),
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.ORDER_VIEW),
  asyncHandler(async (req, res) => {
    const order = await orderService.getOrderById(req.params.id);
    res.json({ success: true, data: order });
  }),
);

router.post(
  '/',
  requirePermission(PERMISSIONS.ORDER_CREATE),
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await orderService.createOrder(req.body, req.admin!.id);
    await audit(req, 'ORDER_CREATED', order.id, order.orderNumber);
    res.status(201).json({ success: true, data: order });
  }),
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate(updateOrderSchema),
  asyncHandler(async (req, res) => {
    const order = await orderService.updateOrder(req.params.id, req.body, req.admin!.id);
    await audit(req, 'ORDER_UPDATED', order.id);
    res.json({ success: true, data: order });
  }),
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.ORDER_UPDATE),
  validate(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    const order = await orderService.updateOrderStatus(req.params.id, req.body.status, req.admin!.id);
    await audit(req, 'ORDER_STATUS_UPDATED', order.id, req.body.status);
    res.json({ success: true, data: order });
  }),
);

router.post(
  '/:id/payments',
  requirePermission(PERMISSIONS.ORDER_RECORD_PAYMENT),
  validate(recordPaymentSchema),
  asyncHandler(async (req, res) => {
    const payment = await orderService.recordPayment(req.params.id, req.body, req.admin!.id);
    await audit(req, 'ORDER_PAYMENT_RECORDED', req.params.id, `Amount ${req.body.amount}`);
    res.status(201).json({ success: true, data: payment });
  }),
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.ORDER_DELETE),
  asyncHandler(async (req, res) => {
    await orderService.deleteOrder(req.params.id);
    await audit(req, 'ORDER_DELETED', req.params.id);
    res.json({ success: true, data: { message: 'Order deleted' } });
  }),
);

export default router;
