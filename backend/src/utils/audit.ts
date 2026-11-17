import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export interface AuditContext {
  adminId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditEntry extends AuditContext {
  action: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: entry.adminId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        description: entry.description,
        metadata: entry.metadata,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    // Audit logging must never break the main request flow
    console.error('Failed to record audit log', err);
  }
}
