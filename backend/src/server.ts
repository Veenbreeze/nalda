import { createApp } from './app';
import { connectDatabase, disconnectDatabase, prisma } from './config/database';
import { env } from './config/env';
import { startScheduler } from './jobs/scheduler';

async function main(): Promise<void> {
  await connectDatabase();
  console.log('[db] Connected to PostgreSQL');

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`[server] NALDA CRM API listening on http://localhost:${env.PORT}${env.API_PREFIX}`);
    console.log(`[server] Environment: ${env.NODE_ENV}`);
  });

  startScheduler();

  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDatabase();
      await prisma.$disconnect().catch(() => undefined);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => console.error('[server] Unhandled rejection', reason));
  process.on('uncaughtException', (err) => {
    console.error('[server] Uncaught exception', err);
  });
}

main().catch((err) => {
  console.error('[server] Failed to start', err);
  process.exit(1);
});
