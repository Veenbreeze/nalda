import bcrypt from 'bcryptjs';
import { AdminStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { ApiError } from '../utils/errors';
import { ALL_PERMISSIONS } from '../config/permissions';

export async function listAdmins() {
  return prisma.admin.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      avatarUrl: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      role: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function getAdmin(id: string) {
  const admin = await prisma.admin.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      avatarUrl: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      role: { select: { id: true, name: true, slug: true, permissions: true } },
    },
  });
  if (!admin) throw ApiError.notFound('Administrator not found');
  return admin;
}

export async function createAdmin(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  roleId: string;
  status?: AdminStatus;
}) {
  const email = input.email.toLowerCase().trim();
  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('An administrator with this email already exists');

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw ApiError.notFound('Role not found');

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  return prisma.admin.create({
    data: {
      email,
      passwordHash,
      fullName: input.fullName.trim(),
      phone: input.phone ?? null,
      roleId: input.roleId,
      status: input.status ?? 'ACTIVE',
    },
    select: { id: true, email: true, fullName: true, status: true, role: { select: { id: true, name: true } } },
  });
}

export async function updateAdmin(
  id: string,
  input: { fullName?: string; phone?: string | null; roleId?: string; status?: AdminStatus; email?: string },
) {
  const admin = await prisma.admin.findFirst({ where: { id, deletedAt: null } });
  if (!admin) throw ApiError.notFound('Administrator not found');

  const data: Prisma.AdminUpdateInput = {};
  if (input.fullName !== undefined) data.fullName = input.fullName.trim();
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.status !== undefined) data.status = input.status;
  if (input.email !== undefined && input.email.toLowerCase() !== admin.email) {
    const clash = await prisma.admin.findUnique({ where: { email: input.email.toLowerCase() } });
    if (clash) throw ApiError.conflict('Email is already in use');
    data.email = input.email.toLowerCase().trim();
  }
  if (input.roleId !== undefined) {
    const role = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) throw ApiError.notFound('Role not found');
    data.role = { connect: { id: input.roleId } };
    // Password/access change: revoke existing sessions on role change
    await prisma.adminSession.updateMany({ where: { adminId: id }, data: { revokedAt: new Date() } });
  }

  return prisma.admin.update({
    where: { id },
    data,
    select: { id: true, email: true, fullName: true, phone: true, status: true, role: { select: { id: true, name: true } } },
  });
}

export async function resetAdminPassword(id: string, newPassword: string) {
  const admin = await prisma.admin.findFirst({ where: { id, deletedAt: null } });
  if (!admin) throw ApiError.notFound('Administrator not found');
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.admin.update({
    where: { id },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  });
  await prisma.adminSession.updateMany({ where: { adminId: id }, data: { revokedAt: new Date() } });
}

export async function deleteAdmin(id: string, currentAdminId: string) {
  if (id === currentAdminId) throw ApiError.badRequest('You cannot delete your own account');
  const admin = await prisma.admin.findFirst({ where: { id, deletedAt: null } });
  if (!admin) throw ApiError.notFound('Administrator not found');
  await prisma.admin.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'INACTIVE' },
  });
  await prisma.adminSession.updateMany({ where: { adminId: id }, data: { revokedAt: new Date() } });
}

// ---------------- Roles & permissions ----------------

export async function listRoles() {
  return prisma.role.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { admins: true } } },
  });
}

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ category: 'asc' }, { label: 'asc' }] });
}

export async function createRole(input: { name: string; description?: string | null; permissions: string[] }) {
  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const existing = await prisma.role.findFirst({ where: { OR: [{ name: input.name.trim() }, { slug }] } });
  if (existing) throw ApiError.conflict('A role with this name already exists');
  return prisma.role.create({
    data: { name: input.name.trim(), slug, description: input.description ?? null, permissions: input.permissions },
  });
}

export async function updateRole(
  id: string,
  input: { name?: string; description?: string | null; permissions?: string[] },
) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw ApiError.notFound('Role not found');
  if (role.slug === 'super_admin' && input.permissions && !input.permissions.includes('*')) {
    throw ApiError.badRequest('The Super Admin role must retain full access');
  }
  return prisma.role.update({
    where: { id },
    data: {
      ...(input.name !== undefined && !role.isSystem ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
    },
  });
}

export async function deleteRole(id: string) {
  const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { admins: true } } } });
  if (!role) throw ApiError.notFound('Role not found');
  if (role.isSystem) throw ApiError.badRequest('System roles cannot be deleted');
  if (role._count.admins > 0) throw ApiError.badRequest('Cannot delete a role that is assigned to administrators');
  await prisma.role.delete({ where: { id } });
}

export async function syncPermissionCatalog() {
  let created = 0;
  for (const p of ALL_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({ where: { key: p.key } });
    if (!existing) {
      await prisma.permission.create({ data: { key: p.key, label: p.label, category: p.category, description: p.description } });
      created++;
    }
  }
  return { created, total: ALL_PERMISSIONS.length };
}
