import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/database';
import { ApiError } from '../utils/errors';
import { verifyAccessToken } from '../utils/jwt';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or invalid authorization header');
    }
    const token = header.slice(7).trim();
    if (!token) throw ApiError.unauthorized();

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid or expired access token');
    }

    const admin = await prisma.admin.findFirst({
      where: { id: payload.sub, deletedAt: null },
      include: { role: true },
    });

    if (!admin) throw ApiError.unauthorized('Administrator account not found');
    if (admin.status !== 'ACTIVE') throw ApiError.forbidden('Administrator account is not active');

    req.admin = {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      roleId: admin.roleId,
      roleSlug: admin.role.slug,
      roleName: admin.role.name,
      permissions: admin.role.permissions,
    };

    next();
  } catch (err) {
    next(err);
  }
}
