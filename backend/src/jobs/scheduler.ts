import cron from 'node-cron';
import { env } from '../config/env';
import { createBackup, cleanupOldBackups } from '../services/backup.service';
import { runFollowUpAutomation } from '../services/automation.service';
import { prisma } from '../config/database';

let started = false;

export function startScheduler(): void {
  if (started || env.NODE_ENV === 'test') return;
  started = true;

  // Daily backup at 02:00 business time (Africa/Dar_es_Salaam)
  cron.schedule(
    '0 2 * * *',
    async () => {
      try {
        await createBackup('SCHEDULED', null);
        await cleanupOldBackups();
        console.log('[scheduler] Scheduled backup completed');
      } catch (err) {
        console.error('[scheduler] Scheduled backup failed', err);
      }
    },
    { timezone: env.BUSINESS_TIMEZONE },
  );

  // Daily follow-up task generation at 08:00
  cron.schedule(
    '0 8 * * *',
    async () => {
      try {
        const result = await runFollowUpAutomation(null);
        if (result) console.log(`[scheduler] Follow-up automation created ${result.created} task(s)`);
      } catch (err) {
        console.error('[scheduler] Follow-up automation failed', err);
      }
    },
    { timezone: env.BUSINESS_TIMEZONE },
  );

  // Housekeeping: expire stale admin sessions daily at 03:00
  cron.schedule(
    '0 3 * * *',
    async () => {
      try {
        const result = await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
        console.log(`[scheduler] Removed ${result.count} expired session(s)`);
      } catch (err) {
        console.error('[scheduler] Session cleanup failed', err);
      }
    },
    { timezone: env.BUSINESS_TIMEZONE },
  );

  console.log('[scheduler] Background jobs started');
}
