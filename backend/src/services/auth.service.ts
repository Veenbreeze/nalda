import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { env, smtpConfigured } from '../config/env';
import { ApiError } from '../utils/errors';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { recordAudit } from '../utils/audit';
import { sendMail } from '../integrations/email';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function refreshExpiryDate(): Date {
  // Parse values like "7d" / "12h" / "30m"
  const value = env.JWT_REFRESH_EXPIRES_IN;
  const match = value.match(/^(\d+)([smhd])$/);
  const now = Date.now();
  if (!match) return new Date(now + 7 * 24 * 60 * 60 * 1000);
  const n = Number(match[1]);
  const unit = match[2];
  const ms =
    unit === 's' ? n * 1000 : unit === 'm' ? n * 60_000 : unit === 'h' ? n * 3_600_000 : n * 86_400_000;
  return new Date(now + ms);
}

export interface SessionMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

async function createSessionAndTokens(adminId: string, meta: SessionMeta) {
  const expiresAt = refreshExpiryDate();
  const session = await prisma.adminSession.create({
    data: {
      adminId,
      tokenHash: crypto.randomUUID(), // temporary placeholder, replaced below
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });

  const refreshToken = signRefreshToken({ sub: adminId, sid: session.id });
  await prisma.adminSession.update({
    where: { id: session.id },
    data: { tokenHash: hashToken(refreshToken) },
  });

  return { refreshToken, session };
}

export async function login(email: string, password: string, meta: SessionMeta) {
  const admin = await prisma.admin.findFirst({
    where: { email: email.toLowerCase().trim(), deletedAt: null },
    include: { role: true },
  });

  if (!admin) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (admin.status !== 'ACTIVE') {
    throw ApiError.forbidden('This account is not active. Contact a super administrator.');
  }
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    throw ApiError.tooMany('Account temporarily locked due to repeated failed logins. Try again later.');
  }

  const passwordOk = await bcrypt.compare(password, admin.passwordHash);

  if (!passwordOk) {
    const attempts = admin.failedLoginAttempts + 1;
    await prisma.admin.update({
      where: { id: admin.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    await recordAudit({
      adminId: admin.id,
      action: 'AUTH_LOGIN_FAILED',
      entityType: 'Admin',
      entityId: admin.id,
      description: 'Failed login attempt',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    throw ApiError.unauthorized('Invalid email or password');
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const { refreshToken } = await createSessionAndTokens(admin.id, meta);
  const accessToken = signAccessToken({
    sub: admin.id,
    email: admin.email,
    roleSlug: admin.role.slug,
  });

  await recordAudit({
    adminId: admin.id,
    action: 'AUTH_LOGIN',
    entityType: 'Admin',
    entityId: admin.id,
    description: 'Administrator logged in',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    accessToken,
    refreshToken,
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      phone: admin.phone,
      avatarUrl: admin.avatarUrl,
      status: admin.status,
      role: { id: admin.role.id, name: admin.role.name, slug: admin.role.slug, permissions: admin.role.permissions },
    },
  };
}

export async function refresh(refreshToken: string | undefined, meta: SessionMeta) {
  if (!refreshToken) throw ApiError.unauthorized('Missing refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const session = await prisma.adminSession.findUnique({ where: { id: payload.sid } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session expired, please log in again');
  }
  if (session.tokenHash !== hashToken(refreshToken)) {
    // Possible token reuse - revoke session
    await prisma.adminSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    throw ApiError.unauthorized('Session invalid, please log in again');
  }

  const admin = await prisma.admin.findFirst({
    where: { id: payload.sub, deletedAt: null },
    include: { role: true },
  });
  if (!admin || admin.status !== 'ACTIVE') throw ApiError.unauthorized('Administrator not available');

  // Rotate session
  await prisma.adminSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  const { refreshToken: newRefresh } = await createSessionAndTokens(admin.id, meta);
  const accessToken = signAccessToken({ sub: admin.id, email: admin.email, roleSlug: admin.role.slug });

  return {
    accessToken,
    refreshToken: newRefresh,
    admin: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      phone: admin.phone,
      avatarUrl: admin.avatarUrl,
      status: admin.status,
      role: { id: admin.role.id, name: admin.role.name, slug: admin.role.slug, permissions: admin.role.permissions },
    },
  };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.adminSession.updateMany({
      where: { id: payload.sid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // ignore invalid tokens on logout
  }
}

export async function getProfile(adminId: string) {
  const admin = await prisma.admin.findFirst({
    where: { id: adminId, deletedAt: null },
    include: { role: true },
  });
  if (!admin) throw ApiError.notFound('Administrator not found');
  return {
    id: admin.id,
    email: admin.email,
    fullName: admin.fullName,
    phone: admin.phone,
    avatarUrl: admin.avatarUrl,
    status: admin.status,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
    role: { id: admin.role.id, name: admin.role.name, slug: admin.role.slug, permissions: admin.role.permissions },
  };
}

export async function changePassword(adminId: string, currentPassword: string, newPassword: string, meta: SessionMeta) {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) throw ApiError.notFound('Administrator not found');

  const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!ok) throw ApiError.badRequest('Current password is incorrect');

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.admin.update({ where: { id: adminId }, data: { passwordHash } });

  // Revoke all other sessions
  await prisma.adminSession.updateMany({
    where: { adminId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await recordAudit({
    adminId,
    action: 'AUTH_PASSWORD_CHANGED',
    entityType: 'Admin',
    entityId: adminId,
    description: 'Administrator changed their password',
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export async function requestPasswordReset(email: string, meta: SessionMeta) {
  const admin = await prisma.admin.findFirst({ where: { email: email.toLowerCase().trim(), deletedAt: null } });
  // Always return success to avoid account enumeration
  if (!admin) return { sent: true };

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + env.PASSWORD_RESET_TOKEN_EXPIRES_MIN * 60_000);

  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordResetToken: hashToken(token), passwordResetExpires: expires },
  });

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;

  if (smtpConfigured) {
    await sendMail({
      to: admin.email,
      subject: 'NALDA CRM - Password reset',
      html: `<p>Hello ${admin.fullName},</p><p>You requested a password reset. This link expires in ${env.PASSWORD_RESET_TOKEN_EXPIRES_MIN} minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`,
    }).catch((err) => console.error('Failed to send password reset email', err));
  }

  await recordAudit({
    adminId: admin.id,
    action: 'AUTH_PASSWORD_RESET_REQUESTED',
    entityType: 'Admin',
    entityId: admin.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    sent: true,
    // Only expose token outside production for local development / testing
    ...(env.NODE_ENV !== 'production' ? { resetToken: token, resetUrl } : {}),
  };
}

export async function resetPassword(token: string, newPassword: string, meta: SessionMeta) {
  const tokenHash = hashToken(token);
  const admin = await prisma.admin.findFirst({
    where: { passwordResetToken: tokenHash, passwordResetExpires: { gt: new Date() }, deletedAt: null },
  });
  if (!admin) throw ApiError.badRequest('Invalid or expired password reset token');

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
  });
  await prisma.adminSession.updateMany({ where: { adminId: admin.id }, data: { revokedAt: new Date() } });

  await recordAudit({
    adminId: admin.id,
    action: 'AUTH_PASSWORD_RESET',
    entityType: 'Admin',
    entityId: admin.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}
