import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database';

type TxClient = Prisma.TransactionClient | PrismaClient;

export async function nextSequence(key: string, client: TxClient = prisma): Promise<number> {
  const record = await client.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return record.value;
}

function pad(num: number, size = 5): string {
  return String(num).padStart(size, '0');
}

export async function generateCustomerCode(client: TxClient = prisma): Promise<string> {
  const n = await nextSequence('customer', client);
  return `NALDA-C-${pad(n)}`;
}

export async function generateOrderNumber(client: TxClient = prisma): Promise<string> {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const n = await nextSequence(`order-${ym}`, client);
  return `ORD-${ym}-${pad(n, 4)}`;
}

export async function generateCargoReference(client: TxClient = prisma): Promise<string> {
  const n = await nextSequence('cargo', client);
  return `CARGO-${pad(n, 5)}`;
}

export async function generateShoppingReference(client: TxClient = prisma): Promise<string> {
  const n = await nextSequence('shopping', client);
  return `PSR-${pad(n, 5)}`;
}

export function generateSku(name: string, client?: TxClient): string {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 16);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base || 'PROD'}-${rand}`;
}
