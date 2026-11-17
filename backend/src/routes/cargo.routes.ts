import { Request, Router } from 'express';
import { asyncHandler, paginated, parsePagination } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import * as cargoService from '../services/cargo.service';
import {
  createCargoSchema,
  createShoppingSchema,
  updateCargoSchema,
  updateShoppingSchema,
} from '../validators/schemas';
import { recordAudit } from '../utils/audit';

const router = Router();
router.use(authenticate);

function audit(req: Request, action: string, entityType: string, entityId?: string) {
  return recordAudit({
    adminId: req.admin?.id,
    action,
    entityType,
    entityId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  });
}

router.get(
  '/cargo',
  requirePermission(PERMISSIONS.CARGO_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const result = await cargoService.listCargo({
      page,
      limit,
      skip,
      status: q.status as Parameters<typeof cargoService.listCargo>[0]['status'],
      search: q.search,
    });
    res.json({ success: true, ...paginated(result.data, result.total, page, limit) });
  }),
);

router.post(
  '/cargo',
  requirePermission(PERMISSIONS.CARGO_MANAGE),
  validate(createCargoSchema),
  asyncHandler(async (req, res) => {
    const cargo = await cargoService.createCargo(req.body);
    await audit(req, 'CARGO_CREATED', 'CargoShipment', cargo.id);
    res.status(201).json({ success: true, data: cargo });
  }),
);

router.patch(
  '/cargo/:id',
  requirePermission(PERMISSIONS.CARGO_MANAGE),
  validate(updateCargoSchema),
  asyncHandler(async (req, res) => {
    const cargo = await cargoService.updateCargo(req.params.id, req.body);
    await audit(req, 'CARGO_UPDATED', 'CargoShipment', cargo.id);
    res.json({ success: true, data: cargo });
  }),
);

router.delete(
  '/cargo/:id',
  requirePermission(PERMISSIONS.CARGO_MANAGE),
  asyncHandler(async (req, res) => {
    await cargoService.deleteCargo(req.params.id);
    await audit(req, 'CARGO_DELETED', 'CargoShipment', req.params.id);
    res.json({ success: true, data: { message: 'Cargo shipment deleted' } });
  }),
);

router.get(
  '/personal-shopping',
  requirePermission(PERMISSIONS.SHOPPING_VIEW),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
    const q = req.query as Record<string, string>;
    const result = await cargoService.listShopping({
      page,
      limit,
      skip,
      status: q.status as Parameters<typeof cargoService.listShopping>[0]['status'],
      search: q.search,
    });
    res.json({ success: true, ...paginated(result.data, result.total, page, limit) });
  }),
);

router.post(
  '/personal-shopping',
  requirePermission(PERMISSIONS.SHOPPING_MANAGE),
  validate(createShoppingSchema),
  asyncHandler(async (req, res) => {
    const request = await cargoService.createShopping(req.body);
    await audit(req, 'SHOPPING_REQUEST_CREATED', 'PersonalShoppingRequest', request.id);
    res.status(201).json({ success: true, data: request });
  }),
);

router.patch(
  '/personal-shopping/:id',
  requirePermission(PERMISSIONS.SHOPPING_MANAGE),
  validate(updateShoppingSchema),
  asyncHandler(async (req, res) => {
    const request = await cargoService.updateShopping(req.params.id, req.body);
    await audit(req, 'SHOPPING_REQUEST_UPDATED', 'PersonalShoppingRequest', request.id);
    res.json({ success: true, data: request });
  }),
);

router.delete(
  '/personal-shopping/:id',
  requirePermission(PERMISSIONS.SHOPPING_MANAGE),
  asyncHandler(async (req, res) => {
    await cargoService.deleteShopping(req.params.id);
    await audit(req, 'SHOPPING_REQUEST_DELETED', 'PersonalShoppingRequest', req.params.id);
    res.json({ success: true, data: { message: 'Personal shopping request deleted' } });
  }),
);

export default router;
