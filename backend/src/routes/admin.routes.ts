import { Request, Router } from 'express';
import { asyncHandler } from '../utils/http';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { PERMISSIONS } from '../config/permissions';
import * as adminService from '../services/admin.service';
import {
  createAdminSchema,
  resetAdminPasswordSchema,
  roleSchema,
  updateAdminSchema,
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
  '/admins',
  requirePermission(PERMISSIONS.ADMIN_VIEW),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await adminService.listAdmins() });
  }),
);

router.get(
  '/admins/:id',
  requirePermission(PERMISSIONS.ADMIN_VIEW),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await adminService.getAdmin(req.params.id) });
  }),
);

router.post(
  '/admins',
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  validate(createAdminSchema),
  asyncHandler(async (req, res) => {
    const admin = await adminService.createAdmin(req.body);
    await audit(req, 'ADMIN_CREATED', 'Admin', admin.id, admin.email);
    res.status(201).json({ success: true, data: admin });
  }),
);

router.patch(
  '/admins/:id',
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  validate(updateAdminSchema),
  asyncHandler(async (req, res) => {
    const admin = await adminService.updateAdmin(req.params.id, req.body);
    await audit(req, 'ADMIN_UPDATED', 'Admin', admin.id);
    res.json({ success: true, data: admin });
  }),
);

router.post(
  '/admins/:id/reset-password',
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  validate(resetAdminPasswordSchema),
  asyncHandler(async (req, res) => {
    await adminService.resetAdminPassword(req.params.id, req.body.newPassword);
    await audit(req, 'ADMIN_PASSWORD_RESET', 'Admin', req.params.id);
    res.json({ success: true, data: { message: 'Password reset. The administrator must log in again.' } });
  }),
);

router.delete(
  '/admins/:id',
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  asyncHandler(async (req, res) => {
    await adminService.deleteAdmin(req.params.id, req.admin!.id);
    await audit(req, 'ADMIN_DELETED', 'Admin', req.params.id);
    res.json({ success: true, data: { message: 'Administrator deleted' } });
  }),
);

// ---------------- Roles & permissions ----------------

router.get(
  '/roles',
  requirePermission(PERMISSIONS.ADMIN_VIEW),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await adminService.listRoles() });
  }),
);

router.get(
  '/permissions',
  requirePermission(PERMISSIONS.ADMIN_VIEW),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await adminService.listPermissions() });
  }),
);

router.post(
  '/roles',
  requirePermission(PERMISSIONS.ADMIN_MANAGE_ROLES),
  validate(roleSchema),
  asyncHandler(async (req, res) => {
    const role = await adminService.createRole(req.body);
    await audit(req, 'ROLE_CREATED', 'Role', role.id, role.name);
    res.status(201).json({ success: true, data: role });
  }),
);

router.patch(
  '/roles/:id',
  requirePermission(PERMISSIONS.ADMIN_MANAGE_ROLES),
  validate(roleSchema.partial()),
  asyncHandler(async (req, res) => {
    const role = await adminService.updateRole(req.params.id, req.body);
    await audit(req, 'ROLE_UPDATED', 'Role', role.id);
    res.json({ success: true, data: role });
  }),
);

router.delete(
  '/roles/:id',
  requirePermission(PERMISSIONS.ADMIN_MANAGE_ROLES),
  asyncHandler(async (req, res) => {
    await adminService.deleteRole(req.params.id);
    await audit(req, 'ROLE_DELETED', 'Role', req.params.id);
    res.json({ success: true, data: { message: 'Role deleted' } });
  }),
);

export default router;
