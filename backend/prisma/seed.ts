import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ALL_PERMISSIONS, ROLE_DEFINITIONS } from '../src/config/permissions';

const prisma = new PrismaClient();

const BUSINESS_SETTINGS: { key: string; value: string | boolean; description: string }[] = [
  { key: 'businessName', value: 'NALDA USA Products', description: 'Business display name' },
  {
    key: 'businessType',
    value: 'Cosmetics, Beauty Products, Skincare, Body Care, Perfumes, Baby Essentials & Imported Products',
    description: 'Business category',
  },
  { key: 'address', value: '4 Bima Road, Mikocheni B, Dar es Salaam, Tanzania', description: 'Business address' },
  { key: 'location', value: 'Mikocheni B, Dar es Salaam, Tanzania', description: 'Business location' },
  { key: 'phone', value: '+255747163059', description: 'Main phone / WhatsApp' },
  { key: 'whatsapp', value: '+255747163059', description: 'WhatsApp number' },
  { key: 'internationalPhone', value: '+12027439424', description: 'International contact number' },
  { key: 'instagram', value: 'https://www.instagram.com/nalda_usa_products/', description: 'Instagram profile' },
  { key: 'babyEssentials', value: 'NALDA USA Baby Essentials', description: 'Baby essentials brand line' },
  { key: 'currency', value: 'TZS', description: 'Default business currency' },
  { key: 'personalShoppingOffered', value: true, description: 'Whether personal shopping is offered' },
  { key: 'cargoShippingOffered', value: true, description: 'Whether cargo shipping is offered' },
  { key: 'timezone', value: 'Africa/Dar_es_Salaam', description: 'Business timezone' },
];

const CATEGORIES = [
  'Skincare',
  'Body Care',
  'Perfumes',
  'Baby Essentials',
  'Beauty Products',
  'Hair Care',
  'Personal Care',
  'Imported Products',
  'Other',
];

const AUTOMATIONS = [
  {
    name: 'New Arrival Notification',
    trigger: 'NEW_ARRIVAL' as const,
    description: 'Prepare personalized WhatsApp campaigns for consenting customers interested in a newly arrived product.',
    config: {
      messageTemplate:
        'Habari {name}! Tunapenda kukujulisha kuwa {product} imewasili tena NALDA USA Products. Kwa kuwa uliwahi kuonyesha interest na bidhaa hii, tumekukumbuka. Karibu Mikocheni!',
    },
  },
  {
    name: 'Product Restock Notification',
    trigger: 'RESTOCK' as const,
    description: 'Notify customers waiting for a product when it becomes available again.',
    config: {
      messageTemplate:
        'Habari {name}! {product} imerudi tena kwenye stock ya NALDA USA Products. Karibu tukuhudumie!',
    },
  },
  {
    name: 'Customer Follow-up',
    trigger: 'FOLLOW_UP' as const,
    description: 'Create follow-up tasks for customers with no recent purchase but active product interest.',
    config: { daysSinceLastPurchase: 30 },
  },
  {
    name: 'New WhatsApp Order',
    trigger: 'NEW_WHATSAPP_ORDER' as const,
    description: 'Detect order intent in incoming WhatsApp messages and create a draft order for review.',
    config: {},
  },
  {
    name: 'Customer Interest Detection',
    trigger: 'INTEREST_DETECTION' as const,
    description: 'Detect products mentioned in WhatsApp conversations and update customer interests.',
    config: {},
  },
];

const DEMO_PRODUCTS: {
  name: string;
  category: string;
  brand: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  newArrival?: boolean;
  featured?: boolean;
  description: string;
}[] = [
  { name: 'Olay Body Lotion 400ml', category: 'Body Care', brand: 'Olay', price: 38000, cost: 26000, stock: 42, minStock: 10, featured: true, description: 'Deep moisturising body lotion imported from the USA.' },
  { name: 'AmLactin Daily Healing 12% 400g', category: 'Body Care', brand: 'AmLactin', price: 62000, cost: 45000, stock: 18, minStock: 8, newArrival: true, featured: true, description: 'Lactic acid body lotion for extremely dry skin.' },
  { name: 'CeraVe Moisturising Cream 454g', category: 'Skincare', brand: 'CeraVe', price: 75000, cost: 55000, stock: 22, minStock: 8, featured: true, description: 'Ceramide-rich moisturising cream for face and body.' },
  { name: 'The Ordinary Niacinamide 10% + Zinc 1%', category: 'Skincare', brand: 'The Ordinary', price: 48000, cost: 33000, stock: 35, minStock: 10, description: 'Blemish and pore serum.' },
  { name: 'Neutrogena Hydro Boost Gel', category: 'Skincare', brand: 'Neutrogena', price: 52000, cost: 37000, stock: 4, minStock: 10, description: 'Hyaluronic acid water gel moisturiser.' },
  { name: 'Aveeno Baby Daily Moisture Lotion', category: 'Baby Essentials', brand: 'Aveeno', price: 34000, cost: 23000, stock: 27, minStock: 10, newArrival: true, description: 'Gentle baby lotion with natural oat extract.' },
  { name: 'Johnson\'s Baby Shampoo 500ml', category: 'Baby Essentials', brand: "Johnson's", price: 22000, cost: 14000, stock: 60, minStock: 15, description: 'No more tears baby shampoo.' },
  { name: 'Dove Beauty Bar Pack of 6', category: 'Personal Care', brand: 'Dove', price: 28000, cost: 18000, stock: 48, minStock: 12, description: 'Moisturising beauty bars.' },
  { name: 'Nivea Body Milk 400ml', category: 'Body Care', brand: 'Nivea', price: 26000, cost: 17000, stock: 52, minStock: 15, description: 'Caring body milk with almond oil.' },
  { name: 'Victoria\'s Secret Bombshell Perfume 50ml', category: 'Perfumes', brand: "Victoria's Secret", price: 185000, cost: 140000, stock: 7, minStock: 5, featured: true, description: 'Iconic floral fragrance.' },
  { name: 'Dior Sauvage Eau de Parfum 100ml', category: 'Perfumes', brand: 'Dior', price: 320000, cost: 260000, stock: 3, minStock: 5, newArrival: true, description: 'Premium men\'s fragrance.' },
  { name: 'Maybelline Fit Me Foundation', category: 'Beauty Products', brand: 'Maybelline', price: 45000, cost: 30000, stock: 30, minStock: 10, description: 'Matte + poreless liquid foundation.' },
  { name: 'Shea Moisture Curl Enhancing Smoothie', category: 'Hair Care', brand: 'Shea Moisture', price: 58000, cost: 41000, stock: 15, minStock: 6, description: 'Curl defining hair smoothie.' },
  { name: 'Palmer\'s Cocoa Butter Formula 400ml', category: 'Body Care', brand: "Palmer's", price: 32000, cost: 21000, stock: 38, minStock: 10, description: 'Cocoa butter body lotion for stretch marks.' },
];

const DEMO_CUSTOMERS = [
  { fullName: 'Amina Mohamed', phone: '0747163059', location: 'Mikocheni', source: 'WHATSAPP' as const, gender: 'FEMALE' as const, consent: true },
  { fullName: 'Fatuma Ally', phone: '0712345678', location: 'Kinondoni', source: 'INSTAGRAM' as const, gender: 'FEMALE' as const, consent: true },
  { fullName: 'Grace Mwakyusa', phone: '0765432109', location: 'Mbezi Beach', source: 'REFERRAL' as const, gender: 'FEMALE' as const, consent: true },
  { fullName: 'Neema Joseph', phone: '0754112233', location: 'Sinza', source: 'WHATSAPP' as const, gender: 'FEMALE' as const, consent: true },
  { fullName: 'Aisha Salum', phone: '0688223344', location: 'Mikocheni B', source: 'WALK_IN' as const, gender: 'FEMALE' as const, consent: true },
  { fullName: 'Rehema Mushi', phone: '0782334455', location: 'Mbagala', source: 'FACEBOOK' as const, gender: 'FEMALE' as const, consent: false },
  { fullName: 'Joyce Mwakalinga', phone: '0713556677', location: 'Masaki', source: 'WHATSAPP' as const, gender: 'FEMALE' as const, consent: true },
  { fullName: 'Hassan Said', phone: '0745667788', location: 'Kariakoo', source: 'MANUAL' as const, gender: 'MALE' as const, consent: true },
  { fullName: 'Zainab Rajab', phone: '0779889900', location: 'Tandale', source: 'WHATSAPP' as const, gender: 'FEMALE' as const, consent: true },
  { fullName: 'Mercy Kimaro', phone: '0691112233', location: 'Mikocheni', source: 'IMPORT' as const, gender: 'FEMALE' as const, consent: true },
];

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function nextSeq(key: string): Promise<number> {
  const rec = await prisma.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return rec.value;
}

async function seedAccessControl() {
  for (const p of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      create: { key: p.key, label: p.label, category: p.category, description: p.description },
      update: { label: p.label, category: p.category, description: p.description },
    });
  }

  const roles = [];
  for (const def of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { slug: def.slug },
      create: {
        name: def.name,
        slug: def.slug,
        description: def.description,
        permissions: def.permissions,
        isSystem: def.isSystem,
      },
      update: {
        name: def.name,
        description: def.description,
        permissions: def.permissions,
        isSystem: def.isSystem,
      },
    });
    roles.push(role);
  }

  const superRole = roles.find((r) => r.slug === 'super_admin')!;
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@naldausa.co.tz').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const fullName = process.env.SEED_ADMIN_NAME || 'NALDA Super Admin';

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.admin.create({
      data: { email, passwordHash, fullName, roleId: superRole.id, status: 'ACTIVE' },
    });
    console.log(`[seed] Created super admin: ${email}`);
  } else {
    console.log(`[seed] Super admin already exists: ${email}`);
  }

  return { superRole, email };
}

async function seedSettings() {
  for (const s of BUSINESS_SETTINGS) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      create: { key: s.key, value: s.value as Prisma.InputJsonValue, description: s.description, isPublic: true },
      update: { description: s.description, isPublic: true },
    });
  }
}

async function seedCategories() {
  const map = new Map<string, string>();
  for (const name of CATEGORIES) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const cat = await prisma.productCategory.upsert({
      where: { name },
      create: { name, slug },
      update: {},
    });
    map.set(name, cat.id);
  }
  return map;
}

async function seedPipeline() {
  let pipeline = await prisma.pipeline.findFirst({ where: { isDefault: true }, include: { stages: true } });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        name: 'Sales Pipeline',
        isDefault: true,
        stages: {
          create: [
            { name: 'New Inquiry', position: 0 },
            { name: 'Interested', position: 1 },
            { name: 'Follow-up Required', position: 2 },
            { name: 'Order Received', position: 3 },
            { name: 'Order Confirmed', position: 4 },
            { name: 'Processing', position: 5 },
            { name: 'Completed', position: 6, isWon: true },
            { name: 'Lost / Cancelled', position: 7, isLost: true },
          ],
        },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
  }
  return pipeline;
}

async function seedAutomations() {
  for (const a of AUTOMATIONS) {
    const existing = await prisma.automationWorkflow.findFirst({ where: { trigger: a.trigger } });
    if (existing) continue;
    await prisma.automationWorkflow.create({
      data: {
        name: a.name,
        trigger: a.trigger,
        status: 'ACTIVE',
        description: a.description,
        config: a.config as Prisma.InputJsonValue,
        requireApproval: true,
      },
    });
  }
}

async function seedDemo() {
  if (process.env.NODE_ENV === 'production') {
    console.log('[seed] Skipping demo data in production');
    return;
  }

  const productCount = await prisma.product.count();
  if (productCount > 0) {
    console.log('[seed] Demo data already present, skipping');
    return;
  }

  const categories = await seedCategories();
  const categoryList = Array.from(categories.keys());

  // Tags
  const tagNames = ['VIP', 'Wholesale', 'Skincare Lover', 'Baby Essentials'];
  const tags = [];
  for (const name of tagNames) {
    tags.push(await prisma.tag.upsert({ where: { name }, create: { name }, update: {} }));
  }

  // Products
  const products = [];
  for (const p of DEMO_PRODUCTS) {
    const sku = `${p.name.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const product = await prisma.product.create({
      data: {
        name: p.name,
        sku,
        description: p.description,
        categoryId: categories.get(p.category) ?? categories.get('Other'),
        brand: p.brand,
        sellingPrice: new Prisma.Decimal(p.price),
        costPrice: new Prisma.Decimal(p.cost),
        stockQuantity: p.stock,
        minStockLevel: p.minStock,
        status: 'ACTIVE',
        source: 'USA_IMPORT',
        isNewArrival: p.newArrival ?? false,
        isFeatured: p.featured ?? false,
        purchaseCount: Math.floor(Math.random() * 30),
      },
    });
    products.push(product);
  }

  // Customers
  const customers = [];
  let custIndex = 0;
  for (const c of DEMO_CUSTOMERS) {
    const n = await nextSeq('customer');
    const customer = await prisma.customer.create({
      data: {
        customerCode: `NALDA-C-${String(n).padStart(5, '0')}`,
        fullName: c.fullName,
        phone: `+255${c.phone.replace(/^0/, '')}`,
        whatsappPhone: `+255${c.phone.replace(/^0/, '')}`,
        location: c.location,
        source: c.source,
        gender: c.gender,
        marketingConsent: c.consent,
        whatsappOptIn: c.consent,
        status: 'ACTIVE',
        createdAt: daysAgo(120 - custIndex * 9),
        lastInteractionAt: daysAgo(custIndex * 2),
        tags: { create: [{ tagId: tags[custIndex % tags.length].id }] },
      },
    });
    customers.push(customer);

    // Interests
    const interestCount = 2 + (custIndex % 3);
    for (let i = 0; i < interestCount; i++) {
      const product = products[(custIndex + i * 3) % products.length];
      await prisma.productInterest.create({
        data: {
          customerId: customer.id,
          productId: product.id,
          categoryId: product.categoryId,
          productName: product.name,
          interestLevel: i === 0 ? 'HIGH' : i === 1 ? 'MEDIUM' : 'LOW',
          source: c.source === 'WHATSAPP' ? 'WHATSAPP' : 'MANUAL',
          inquiryCount: 1 + ((custIndex + i) % 4),
          lastInteractionAt: daysAgo(custIndex + i),
        },
      });
    }
    custIndex++;
  }

  // Orders
  const statuses: { status: 'DELIVERED' | 'CONFIRMED' | 'NEW' | 'PROCESSING'; payment: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' }[] = [
    { status: 'DELIVERED', payment: 'PAID' },
    { status: 'DELIVERED', payment: 'PAID' },
    { status: 'CONFIRMED', payment: 'PARTIALLY_PAID' },
    { status: 'NEW', payment: 'UNPAID' },
    { status: 'PROCESSING', payment: 'PARTIALLY_PAID' },
  ];

  let orderCounter = 0;
  for (let ci = 0; ci < customers.length; ci++) {
    const orderCount = 1 + (ci % 3);
    for (let o = 0; o < orderCount; o++) {
      const state = statuses[(ci + o) % statuses.length];
      const itemCount = 1 + ((ci + o) % 3);
      const items = [];
      let subtotal = new Prisma.Decimal(0);
      for (let i = 0; i < itemCount; i++) {
        const product = products[(ci + o + i * 2) % products.length];
        const quantity = 1 + ((i + o) % 2);
        const lineTotal = product.sellingPrice.mul(quantity);
        subtotal = subtotal.add(lineTotal);
        items.push({ product, quantity, lineTotal });
      }
      const orderDate = daysAgo(15 + ci * 3 + o * 7);
      const paid = state.payment === 'PAID' ? subtotal : state.payment === 'PARTIALLY_PAID' ? subtotal.div(2) : new Prisma.Decimal(0);
      const ym = `${orderDate.getFullYear()}${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      const seq = await nextSeq(`order-${ym}`);
      orderCounter++;
      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-${ym}-${String(seq).padStart(4, '0')}`,
          customerId: customers[ci].id,
          source: ci % 2 === 0 ? 'WHATSAPP' : 'MANUAL',
          status: state.status,
          paymentStatus: state.payment,
          subtotal,
          totalAmount: subtotal,
          amountPaid: paid,
          orderDate,
          confirmedAt: state.status !== 'NEW' ? orderDate : null,
          deliveredAt: state.status === 'DELIVERED' ? daysAgo(Math.max(0, 15 + ci * 3 + o * 7 - 2)) : null,
          items: {
            create: items.map((it) => ({
              productId: it.product.id,
              productName: it.product.name,
              quantity: it.quantity,
              unitPrice: it.product.sellingPrice,
              lineTotal: it.lineTotal,
            })),
          },
          ...(paid.gt(0)
            ? {
                payments: {
                  create: {
                    amount: paid,
                    method: ci % 2 === 0 ? 'MOBILE_MONEY' : 'CASH',
                    paidAt: orderDate,
                  },
                },
              }
            : {}),
        },
      });

      await prisma.activity.create({
        data: {
          customerId: customers[ci].id,
          type: 'ORDER_RECEIVED',
          title: `Order ${order.orderNumber} created`,
          source: order.source,
          createdAt: orderDate,
          metadata: { orderId: order.id, total: subtotal.toString() },
        },
      });
      if (state.status === 'DELIVERED') {
        await prisma.activity.create({
          data: {
            customerId: customers[ci].id,
            type: 'PURCHASE',
            title: `Order ${order.orderNumber} delivered`,
            source: order.source,
            createdAt: daysAgo(Math.max(0, 15 + ci * 3 + o * 7 - 2)),
            metadata: { orderId: order.id },
          },
        });
      }
    }
  }

  // Recalculate customer stats
  for (const c of customers) {
    const agg = await prisma.order.aggregate({
      where: { customerId: c.id, status: { not: 'CANCELLED' }, deletedAt: null },
      _sum: { totalAmount: true },
      _count: { _all: true },
      _max: { orderDate: true },
    });
    await prisma.customer.update({
      where: { id: c.id },
      data: {
        totalSpent: agg._sum.totalAmount ?? new Prisma.Decimal(0),
        totalOrders: agg._count._all,
        lastPurchaseAt: agg._max.orderDate,
      },
    });
  }

  // Pipeline deals
  const pipeline = await prisma.pipeline.findFirst({ where: { isDefault: true }, include: { stages: { orderBy: { position: 'asc' } } } });
  if (pipeline) {
    for (let i = 0; i < 8; i++) {
      const customer = customers[i % customers.length];
      const stage = pipeline.stages[i % (pipeline.stages.length - 1)];
      const value = 50000 + i * 35000;
      const deal = await prisma.deal.create({
        data: {
          title: `${customer.fullName} - ${products[i % products.length].name}`,
          customerId: customer.id,
          pipelineId: pipeline.id,
          stageId: stage.id,
          value,
          notes: 'Demo opportunity generated by seed script',
          history: { create: { toStageId: stage.id, note: 'Deal created' } },
        },
      });
      await prisma.activity.create({
        data: {
          customerId: customer.id,
          type: 'OTHER',
          title: `Deal created: ${deal.title}`,
          source: 'PIPELINE',
        },
      });
    }
  }

  // WhatsApp conversations & messages
  for (const customer of customers.slice(0, 6)) {
    const conv = await prisma.whatsAppConversation.create({
      data: {
        customerId: customer.id,
        whatsappPhone: customer.whatsappPhone || customer.phone,
        status: 'OPEN',
        lastMessageAt: daysAgo(1),
        lastMessagePreview: 'Habari NALDA, naomba Olay Lotion mbili na AmLactin moja.',
        unreadCount: 1,
      },
    });
    await prisma.whatsAppMessage.create({
      data: {
        conversationId: conv.id,
        customerId: customer.id,
        waMessageId: `demo-in-${conv.id}`,
        direction: 'INBOUND',
        type: 'TEXT',
        status: 'RECEIVED',
        fromPhone: customer.whatsappPhone || customer.phone,
        body: 'Habari NALDA, naomba Olay Lotion mbili na AmLactin moja.',
        isProcessed: true,
        createdAt: daysAgo(1),
      },
    });
    await prisma.whatsAppMessage.create({
      data: {
        conversationId: conv.id,
        customerId: customer.id,
        waMessageId: `demo-out-${conv.id}`,
        direction: 'OUTBOUND',
        type: 'TEXT',
        status: 'DELIVERED',
        fromPhone: customer.phone,
        toPhone: customer.whatsappPhone || customer.phone,
        body: 'Asante kwa kuwasiliana na NALDA USA Products! Tumeshika oda yako na tutakujulisha jumla ya bei hivi punde.',
        isProcessed: true,
        createdAt: daysAgo(1),
      },
    });
  }

  // Activities for timeline richness
  for (const customer of customers) {
    await prisma.activity.create({
      data: {
        customerId: customer.id,
        type: 'CUSTOMER_REGISTERED',
        title: 'Customer registered',
        source: customer.source,
        createdAt: customer.createdAt,
      },
    });
  }

  // Templates
  await prisma.whatsAppTemplate.upsert({
    where: { name_language: { name: 'new_arrival_notification', language: 'sw' } },
    create: {
      name: 'new_arrival_notification',
      language: 'sw',
      category: 'MARKETING',
      body: 'Habari {{1}}! {{2}} imewasili NALDA USA Products. Karibu Mikocheni!',
      variables: ['name', 'product'],
      status: 'APPROVED',
    },
    update: {},
  });

  // Cargo & personal shopping demos
  for (let i = 0; i < 3; i++) {
    const customer = customers[i];
    const cargoRef = `CARGO-${String(await nextSeq('cargo')).padStart(5, '0')}`;
    await prisma.cargoShipment.create({
      data: {
        cargoReference: cargoRef,
        customerId: customer.id,
        shipmentType: 'SEA_FREIGHT',
        description: `Personal shopping cargo shipment for ${customer.fullName}`,
        shipmentDate: daysAgo(20),
        estimatedArrival: daysAgo(-15),
        status: i === 0 ? 'IN_TRANSIT' : i === 1 ? 'ARRIVED' : 'REQUESTED',
      },
    });
    const requestRef = `PSR-${String(await nextSeq('shopping')).padStart(5, '0')}`;
    await prisma.personalShoppingRequest.create({
      data: {
        requestNumber: requestRef,
        customerId: customer.id,
        productName: 'Imported baby stroller',
        productDescription: 'Customer requested sourcing an imported baby stroller from the USA.',
        estimatedPrice: 450000,
        status: i === 0 ? 'SOURCING' : 'REQUESTED',
      },
    });
  }

  console.log(`[seed] Demo data created: ${customers.length} customers, ${products.length} products, ${orderCounter} orders`);
}

async function main() {
  console.log('[seed] Starting database seed...');
  const { email } = await seedAccessControl();
  await seedSettings();
  await seedCategories();
  await seedPipeline();
  await seedAutomations();
  await seedDemo();

  console.log('[seed] Completed.');
  console.log(`[seed] Login with: ${email} / ${process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!'}`);
}

main()
  .catch((err) => {
    console.error('[seed] Failed', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
