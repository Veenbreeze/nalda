import { z } from 'zod';

const phone = z.string().min(6, 'Phone number is too short').max(30);
const optionalDate = z.union([z.string(), z.date()]).optional().nullable();
const queryBool = z.preprocess(
  (v) => (v === undefined || v === '' ? undefined : v === true || v === 'true' || v === '1'),
  z.boolean().optional(),
);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({}).passthrough();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const requestResetSchema = z.object({ email: z.string().email() });
export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8),
});

// ---------------- Customer ----------------

const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED']);
const customerStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'BLOCKED']);
const customerSourceEnum = z.enum([
  'MANUAL',
  'IMPORT',
  'WHATSAPP',
  'INSTAGRAM',
  'FACEBOOK',
  'WALK_IN',
  'REFERRAL',
  'OTHER',
]);

export const createCustomerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(200),
  phone,
  whatsappPhone: phone.optional().nullable(),
  alternatePhone: phone.optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  gender: genderEnum.optional(),
  dateOfBirth: optionalDate,
  location: z.string().max(200).optional().nullable(),
  physicalAddress: z.string().max(500).optional().nullable(),
  source: customerSourceEnum.optional(),
  status: customerStatusEnum.optional(),
  notes: z.string().max(5000).optional().nullable(),
  marketingConsent: z.boolean().optional(),
  whatsappOptIn: z.boolean().optional(),
  preferredChannel: z.string().max(50).optional().nullable(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerImportSchema = z.object({
  mapping: z.record(z.string()),
  duplicateStrategy: z.enum(['SKIP', 'UPDATE']).optional().default('SKIP'),
});

// ---------------- Product ----------------

const productStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED', 'OUT_OF_STOCK']);
const productSourceEnum = z.enum(['USA_IMPORT', 'LOCAL', 'OTHER']);

export const createProductSchema = z.object({
  name: z.string().min(1).max(250),
  sku: z.string().max(80).optional(),
  description: z.string().max(5000).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  images: z.array(z.string()).optional(),
  sellingPrice: z.coerce.number().nonnegative(),
  costPrice: z.coerce.number().nonnegative().optional().nullable(),
  stockQuantity: z.coerce.number().int().nonnegative().optional(),
  minStockLevel: z.coerce.number().int().nonnegative().optional(),
  status: productStatusEnum.optional(),
  source: productSourceEnum.optional(),
  isNewArrival: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
});
export const updateCategorySchema = createCategorySchema.partial();

export const adjustStockSchema = z.object({ delta: z.coerce.number().int() });

// ---------------- Order ----------------

const orderStatusEnum = z.enum([
  'NEW',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'PROCESSING',
  'READY_FOR_COLLECTION',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
]);
const paymentStatusEnum = z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED']);
const orderSourceEnum = z.enum(['WHATSAPP', 'MANUAL', 'INSTAGRAM', 'PHONE', 'WALK_IN', 'REFERRAL', 'OTHER']);
const paymentMethodEnum = z.enum(['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD', 'OTHER']);

const orderItemSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  productName: z.string().max(250).optional(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative().optional(),
});

export const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  source: orderSourceEnum.optional(),
  status: orderStatusEnum.optional(),
  items: z.array(orderItemSchema).min(1),
  discount: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(5000).optional().nullable(),
  needsReview: z.boolean().optional(),
  orderDate: optionalDate,
});

export const updateOrderSchema = createOrderSchema.partial().omit({ customerId: true });
export const updateOrderStatusSchema = z.object({ status: orderStatusEnum });
export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  method: paymentMethodEnum.optional(),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  paidAt: optionalDate,
});

// ---------------- Deal ----------------

export const createDealSchema = z.object({
  title: z.string().min(1).max(250),
  customerId: z.string().uuid(),
  pipelineId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  value: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(5000).optional().nullable(),
  expectedCloseAt: optionalDate,
  items: z
    .array(
      z.object({
        productId: z.string().uuid().optional().nullable(),
        name: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        unitPrice: z.coerce.number().nonnegative(),
      }),
    )
    .optional(),
});
export const updateDealSchema = z.object({
  title: z.string().min(1).max(250).optional(),
  value: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(5000).optional().nullable(),
  expectedCloseAt: optionalDate,
  status: z.enum(['OPEN', 'WON', 'LOST']).optional(),
});
export const moveDealSchema = z.object({ stageId: z.string().uuid(), note: z.string().max(1000).optional() });
export const createPipelineSchema = z.object({ name: z.string().min(1), stages: z.array(z.string().min(1)).min(1), isDefault: z.boolean().optional() });

// ---------------- Activity ----------------

const activityTypeEnum = z.enum([
  'CUSTOMER_REGISTERED',
  'IMPORT',
  'WHATSAPP_INBOUND',
  'WHATSAPP_OUTBOUND',
  'PRODUCT_INQUIRY',
  'PRODUCT_INTEREST',
  'ORDER_RECEIVED',
  'ORDER_CONFIRMED',
  'PURCHASE',
  'PAYMENT',
  'NOTE',
  'CAMPAIGN',
  'FOLLOW_UP',
  'CALL',
  'VISIT',
  'TASK',
  'STATUS_CHANGE',
  'OTHER',
]);

export const createActivitySchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  type: activityTypeEnum,
  title: z.string().min(1).max(250),
  description: z.string().max(5000).optional().nullable(),
  source: z.string().max(80).optional().nullable(),
  dueAt: optionalDate,
  isTask: z.boolean().optional(),
  taskStatus: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().uuid().optional().nullable(),
});
export const updateActivitySchema = createActivitySchema.partial();

// ---------------- Notes ----------------

export const createNoteSchema = z.object({ body: z.string().min(1).max(10000) });

// ---------------- Interests ----------------

export const createInterestSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  productName: z.string().max(250).optional().nullable(),
  interestLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'PURCHASED', 'NO_LONGER_INTERESTED']).optional(),
  source: z.enum(['MANUAL', 'WHATSAPP', 'ORDER', 'ADMIN_RECOMMENDATION', 'IMPORT']).optional(),
  note: z.string().max(2000).optional().nullable(),
});

// ---------------- WhatsApp ----------------

export const sendWhatsAppSchema = z.object({ body: z.string().min(1).max(4096) });
export const conversationStatusSchema = z.object({ status: z.enum(['OPEN', 'PENDING', 'CLOSED', 'ARCHIVED']) });

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().max(50).optional(),
  messageBody: z.string().min(1).max(4096),
  templateId: z.string().uuid().optional().nullable(),
  audience: z.object({
    productId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    customerIds: z.array(z.string().uuid()).optional(),
    location: z.string().optional(),
    allOptedIn: z.boolean().optional(),
  }),
  scheduledAt: optionalDate,
  sendNow: z.boolean().optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  language: z.string().max(10).optional(),
  category: z.string().max(40).optional(),
  body: z.string().min(1).max(4096),
  variables: z.array(z.string()).optional(),
  metaTemplateId: z.string().max(120).optional().nullable(),
  status: z.string().max(40).optional(),
});

// ---------------- Automation ----------------

export const createAutomationSchema = z.object({
  name: z.string().min(1).max(200),
  trigger: z.enum(['NEW_ARRIVAL', 'RESTOCK', 'FOLLOW_UP', 'NEW_WHATSAPP_ORDER', 'INTEREST_DETECTION']),
  status: z.enum(['ACTIVE', 'PAUSED', 'DRAFT']).optional(),
  description: z.string().max(1000).optional().nullable(),
  config: z.record(z.unknown()).optional(),
  requireApproval: z.boolean().optional(),
});
export const updateAutomationSchema = createAutomationSchema.partial().omit({ trigger: true });

// ---------------- Admin / roles ----------------

export const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(200),
  phone: z.string().max(30).optional().nullable(),
  roleId: z.string().uuid(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});
export const updateAdminSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional().nullable(),
  roleId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});
export const resetAdminPasswordSchema = z.object({ newPassword: z.string().min(8) });
export const roleSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(z.string()),
});

// ---------------- Cargo / shopping ----------------

export const createCargoSchema = z.object({
  customerId: z.string().uuid(),
  shipmentType: z.enum(['SEA_FREIGHT', 'AIR_FREIGHT', 'COURIER', 'OTHER']).optional(),
  description: z.string().max(2000).optional().nullable(),
  shipmentDate: optionalDate,
  estimatedArrival: optionalDate,
  notes: z.string().max(2000).optional().nullable(),
  orderId: z.string().uuid().optional().nullable(),
  weightKg: z.coerce.number().nonnegative().optional().nullable(),
  cost: z.coerce.number().nonnegative().optional().nullable(),
});
export const updateCargoSchema = createCargoSchema.partial().omit({ customerId: true }).extend({
  actualArrival: optionalDate,
  status: z.enum(['REQUESTED', 'IN_TRANSIT', 'AT_PORT', 'CUSTOMS', 'ARRIVED', 'DELIVERED', 'CANCELLED']).optional(),
});

export const createShoppingSchema = z.object({
  customerId: z.string().uuid(),
  productName: z.string().min(1).max(250),
  productDescription: z.string().max(2000).optional().nullable(),
  referenceImageUrl: z.string().url().optional().nullable().or(z.literal('')),
  estimatedPrice: z.coerce.number().nonnegative().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export const updateShoppingSchema = createShoppingSchema.partial().omit({ customerId: true }).extend({
  status: z
    .enum(['REQUESTED', 'SOURCING', 'QUOTED', 'APPROVED', 'PURCHASED', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
    .optional(),
});

// ---------------- Settings ----------------

export const updateSettingsSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1),
      value: z.unknown(),
      description: z.string().optional(),
      isPublic: z.boolean().optional(),
    }),
  ),
});

// ---------------- Query ----------------

export const listQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    source: z.string().optional(),
    location: z.string().optional(),
    tagId: z.string().optional(),
    categoryId: z.string().optional(),
    isNewArrival: queryBool,
    isFeatured: queryBool,
    lowStock: queryBool,
    includeArchived: queryBool,
    paymentStatus: z.string().optional(),
    needsReview: queryBool,
    customerId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    orderBy: z.string().optional(),
    orderDir: z.enum(['asc', 'desc']).optional(),
    unreadOnly: queryBool,
  })
  .passthrough();
