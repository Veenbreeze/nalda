import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { ApiError } from '../utils/errors';

// Tables are listed in dependency order: parents first (used for inserts),
// reversed for deletes.
const BACKUP_TABLES = [
  'productCategory',
  'tag',
  'product',
  'customer',
  'customerAddress',
  'customerTag',
  'productInterest',
  'pipeline',
  'pipelineStage',
  'order',
  'orderItem',
  'payment',
  'deal',
  'dealItem',
  'dealStageHistory',
  'activity',
  'note',
  'whatsAppConversation',
  'whatsAppMessage',
  'whatsAppTemplate',
  'whatsAppCampaign',
  'whatsAppCampaignRecipient',
  'cargoShipment',
  'personalShoppingRequest',
  'automationWorkflow',
  'automationExecution',
  'systemSetting',
  'sequence',
] as const;

const ADMIN_REF_FIELDS: Record<string, string[]> = {
  activity: ['adminId', 'assignedToId'],
  note: ['adminId'],
  whatsAppCampaign: ['createdById'],
  whatsAppMessage: ['sentByAdminId'],
  automationExecution: ['adminId'],
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

type Db = Record<string, { findMany: (args?: unknown) => Promise<unknown[]>; createMany: (args: unknown) => Promise<unknown>; deleteMany: (args?: unknown) => Promise<unknown>; count: () => Promise<number> }>;

const db = prisma as unknown as Db;

function reviveDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveDates);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = reviveDates(v);
    return out;
  }
  if (typeof value === 'string' && ISO_DATE.test(value)) return new Date(value);
  return value;
}

function backupDir(): string {
  return path.resolve(process.cwd(), env.BACKUP_DIR);
}

export interface BackupPayload {
  app: string;
  version: number;
  createdAt: string;
  tables: Record<string, unknown[]>;
}

export async function createBackup(type: 'MANUAL' | 'SCHEDULED' | 'SAFETY' = 'MANUAL', adminId?: string | null) {
  const dir = backupDir();
  await fs.mkdir(dir, { recursive: true });

  const record = await prisma.backupRecord.create({
    data: {
      fileName: 'pending',
      filePath: 'pending',
      type,
      status: 'PENDING',
      adminId: adminId ?? null,
    },
  });

  try {
    const tables: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    for (const table of BACKUP_TABLES) {
      const rows = await db[table].findMany();
      tables[table] = rows;
      counts[table] = rows.length;
    }

    const payload: BackupPayload = {
      app: 'nalda-usa-crm',
      version: 1,
      createdAt: new Date().toISOString(),
      tables,
    };

    const serialized = JSON.stringify(payload, null, 2);
    const checksum = crypto.createHash('sha256').update(serialized).digest('hex');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `nalda-backup-${type.toLowerCase()}-${timestamp}.json`;
    const filePath = path.join(dir, fileName);

    await fs.writeFile(filePath, serialized, 'utf-8');
    const stat = await fs.stat(filePath);

    return prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        fileName,
        filePath,
        fileSize: stat.size,
        status: 'COMPLETED',
        checksum,
        metadata: { counts, app: payload.app, version: payload.version },
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.backupRecord.update({
      where: { id: record.id },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Backup failed',
        completedAt: new Date(),
      },
    });
    throw err;
  }
}

export async function listBackups(page: number, limit: number, skip: number) {
  const [data, total] = await Promise.all([
    prisma.backupRecord.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { admin: { select: { id: true, fullName: true } } },
    }),
    prisma.backupRecord.count(),
  ]);
  return { data, total };
}

export async function getBackup(id: string) {
  const backup = await prisma.backupRecord.findUnique({ where: { id } });
  if (!backup) throw ApiError.notFound('Backup not found');
  return backup;
}

export async function getBackupFile(id: string) {
  const backup = await getBackup(id);
  if (backup.status === 'FAILED' || !backup.filePath || backup.filePath === 'pending') {
    throw ApiError.badRequest('Backup file is not available');
  }
  const buffer = await fs.readFile(backup.filePath);
  return { buffer, fileName: backup.fileName, backup };
}

async function readBackupFile(filePath: string): Promise<{ payload: BackupPayload; checksum: string }> {
  const content = await fs.readFile(filePath, 'utf-8');
  const checksum = crypto.createHash('sha256').update(content).digest('hex');
  let payload: BackupPayload;
  try {
    payload = JSON.parse(content) as BackupPayload;
  } catch {
    throw ApiError.badRequest('Backup file is not valid JSON');
  }
  return { payload, checksum };
}

export async function verifyBackup(id: string) {
  const backup = await getBackup(id);
  if (!backup.filePath || backup.filePath === 'pending') throw ApiError.badRequest('Backup file is not available');
  const { payload, checksum } = await readBackupFile(backup.filePath);

  const valid =
    payload.app === 'nalda-usa-crm' &&
    payload.version === 1 &&
    payload.tables &&
    typeof payload.tables === 'object' &&
    (!backup.checksum || checksum === backup.checksum);

  const tableCounts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    tableCounts[table] = Array.isArray(payload.tables?.[table]) ? payload.tables[table].length : 0;
  }

  await prisma.backupRecord.update({
    where: { id },
    data: { status: valid ? 'VERIFIED' : backup.status },
  });

  return { valid, checksum, tableCounts };
}

export async function deleteBackup(id: string) {
  const backup = await getBackup(id);
  if (backup.filePath && backup.filePath !== 'pending') {
    await fs.unlink(backup.filePath).catch(() => undefined);
  }
  await prisma.backupRecord.delete({ where: { id } });
}

export async function restoreBackup(backupId: string, adminId?: string | null) {
  const backup = await getBackup(backupId);
  if (!backup.filePath || backup.filePath === 'pending') throw ApiError.badRequest('Backup file is not available');

  const { payload, checksum } = await readBackupFile(backup.filePath);
  if (payload.app !== 'nalda-usa-crm' || payload.version !== 1 || !payload.tables) {
    throw ApiError.badRequest('Invalid or unsupported backup file');
  }
  if (backup.checksum && checksum !== backup.checksum) {
    throw ApiError.badRequest('Backup checksum verification failed. The file may be corrupted.');
  }

  // Safety backup before destructive restore
  const safety = await createBackup('SAFETY', adminId);

  // Existing admin ids keep attribution where possible
  const admins = await prisma.admin.findMany({ select: { id: true } });
  const adminIds = new Set(admins.map((a) => a.id));

  const sanitize = (table: string, rows: unknown[]): Record<string, unknown>[] => {
    const fields = ADMIN_REF_FIELDS[table] ?? [];
    return rows.map((row) => {
      const r = reviveDates(row) as Record<string, unknown>;
      for (const f of fields) {
        if (r[f] && !adminIds.has(String(r[f]))) r[f] = null;
      }
      return r;
    });
  };

  await prisma.$transaction(
    async (tx) => {
      const tdb = tx as unknown as Db;
      // Delete children first
      for (const table of [...BACKUP_TABLES].reverse()) {
        await tdb[table].deleteMany({});
      }
      // Insert parents first
      for (const table of BACKUP_TABLES) {
        const rows = Array.isArray(payload.tables[table]) ? payload.tables[table] : [];
        if (!rows.length) continue;
        const data = sanitize(table, rows);
        // Chunk inserts to keep statements reasonable
        for (let i = 0; i < data.length; i += 500) {
          await tdb[table].createMany({ data: data.slice(i, i + 500) });
        }
      }
    },
    { timeout: 180_000 },
  );

  await prisma.backupRecord.update({ where: { id: backupId }, data: { status: 'VERIFIED' } });

  return { restored: true, safetyBackupId: safety.id, checksum };
}

export async function cleanupOldBackups(): Promise<number> {
  const cutoff = new Date(Date.now() - env.BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const old = await prisma.backupRecord.findMany({
    where: { createdAt: { lt: cutoff }, type: { not: 'MANUAL' } },
  });
  let removed = 0;
  for (const b of old) {
    if (b.filePath && b.filePath !== 'pending') await fs.unlink(b.filePath).catch(() => undefined);
    await prisma.backupRecord.delete({ where: { id: b.id } }).catch(() => undefined);
    removed++;
  }
  return removed;
}
