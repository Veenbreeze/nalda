import { prisma } from '../config/database';
import { smtpConfigured } from '../config/env';
import { sendMail } from '../integrations/email';
import { createOrder } from './order.service';
import { addProductInterest } from './customer.service';

const NUMBER_WORDS: Record<string, number> = {
  moja: 1,
  mmoja: 1,
  mbili: 2,
  tatu: 3,
  nne: 4,
  tano: 5,
  sita: 6,
  saba: 7,
  nane: 8,
  tisa: 9,
  kumi: 10,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const ORDER_KEYWORDS = [
  'naomba',
  'nataka',
  'niletee',
  'nitumie',
  'nunue',
  'nunua',
  'oda',
  'order',
  'buy',
  'purchase',
  'i want',
  'i need',
  'send me',
  'please send',
  'bei',
  'price',
  'unauza',
  'unazo',
  'stock',
  'available',
  'ipo',
  'zipo',
];

interface MatchedProduct {
  productId: string;
  productName: string;
  quantity: number;
  index: number;
}

function tokenizeName(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
}

function parseQuantityFrom(text: string): number {
  const digitMatch = text.match(/\b(\d{1,3})\b/);
  if (digitMatch) {
    const n = parseInt(digitMatch[1], 10);
    if (n > 0 && n <= 999) return n;
  }
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const w of words) {
    if (NUMBER_WORDS[w]) return NUMBER_WORDS[w];
  }
  return 1;
}

async function matchProductsInMessage(body: string): Promise<MatchedProduct[]> {
  const lower = body.toLowerCase();
  const products = await prisma.product.findMany({
    where: { deletedAt: null, status: { in: ['ACTIVE', 'OUT_OF_STOCK'] } },
    select: { id: true, name: true, sku: true },
  });

  const matches: MatchedProduct[] = [];
  const usedProductIds = new Set<string>();

  for (const product of products) {
    const name = product.name.toLowerCase();
    const tokens = tokenizeName(product.name);
    if (tokens.length === 0) continue;

    const tokenHits = tokens.filter((t) => lower.includes(t));
    const requiredHits = Math.min(2, tokens.length);
    const matched = lower.includes(name) || tokenHits.length >= requiredHits;
    if (!matched || usedProductIds.has(product.id)) continue;

    const anchor = tokens.find((t) => lower.includes(t));
    const idx = anchor ? lower.indexOf(anchor) : lower.indexOf(name);
    const windowStart = Math.max(0, idx);
    const windowEnd = Math.min(lower.length, idx + name.length + 40);
    const quantity = parseQuantityFrom(lower.slice(windowStart, windowEnd));

    matches.push({ productId: product.id, productName: product.name, quantity, index: idx });
    usedProductIds.add(product.id);
  }

  return matches.sort((a, b) => a.index - b.index);
}

function looksLikeOrderIntent(body: string): boolean {
  const lower = body.toLowerCase();
  return ORDER_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function processIncomingForOrdersAndInterests(params: {
  messageId: string;
  waMessageId: string;
  customerId: string;
  body: string | null;
}): Promise<{ interests: number; orderId?: string }> {
  if (!params.body || !params.body.trim()) return { interests: 0 };
  const body = params.body.trim();

  const matches = await matchProductsInMessage(body);

  // Record interests / inquiries for every matched product
  for (const m of matches) {
    await addProductInterest({
      customerId: params.customerId,
      productId: m.productId,
      source: 'WHATSAPP',
      interestLevel: 'MEDIUM',
      note: body.slice(0, 300),
    });
  }

  const orderIntent = looksLikeOrderIntent(body);
  if (!orderIntent || matches.length === 0) {
    return { interests: matches.length };
  }

  // Never create duplicate draft orders for the same webhook message
  const existingOrder = await prisma.order.findFirst({ where: { whatsappMessageRef: params.waMessageId } });
  if (existingOrder) {
    return { interests: matches.length, orderId: existingOrder.id };
  }

  const order = await createOrder(
    {
      customerId: params.customerId,
      source: 'WHATSAPP',
      status: 'NEW',
      needsReview: true,
      notes: `Draft order extracted automatically from WhatsApp.\n\nOriginal message:\n${body}`,
      whatsappMessageRef: params.waMessageId,
      items: matches.map((m) => ({ productId: m.productId, quantity: m.quantity })),
    },
    null,
  );

  // Notify administrators (best effort)
  if (smtpConfigured) {
    const admins = await prisma.admin.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { email: true },
    });
    if (admins.length) {
      sendMail({
        to: admins.map((a) => a.email),
        subject: `New WhatsApp draft order ${order.orderNumber}`,
        html: `<p>A new draft order was detected from WhatsApp and needs review.</p>
               <p><strong>Order:</strong> ${order.orderNumber}</p>
               <p><strong>Estimated total:</strong> TZS ${order.totalAmount.toString()}</p>
               <p><strong>Message:</strong> ${body.replace(/[<>]/g, '')}</p>`,
      }).catch((err) => console.error('Failed to email draft order notification', err));
    }
  }

  return { interests: matches.length, orderId: order.id };
}
