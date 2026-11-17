import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/errors';

export function hasPermission(permissions: string[], required: string): boolean {
  if (permissions.includes('*')) return true;
  return permissions.includes(required);
}

export function requirePermission(...required: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.admin) throw ApiError.unauthorized();
      const missing = required.filter((perm) => !hasPermission(req.admin!.permissions, perm));
      if (missing.length > 0) {
        throw ApiError.forbidden(`Missing required permission: ${missing.join(', ')}`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(...roleSlugs: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.admin) throw ApiError.unauthorized();
      const allowed = req.admin.roleSlug === 'super_admin' || roleSlugs.includes(req.admin.roleSlug);
      if (!allowed) throw ApiError.forbidden();
      next();
    } catch (err) {
      next(err);
    }
  };
}
