export interface Role {
  id: string;
  name: string;
  slug: string;
  permissions: string[];
}

export interface Admin {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status: string;
  role: Role;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: Pagination;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export type CustomerSource =
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'REFERRAL'
  | 'WALK_IN'
  | 'IMPORT'
  | 'MANUAL'
  | 'OTHER';

export interface Customer {
  id: string;
  customerCode: string;
  fullName: string;
  phone: string;
  whatsappPhone?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  location?: string | null;
  physicalAddress?: string | null;
  source: CustomerSource;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'BLOCKED';
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED' | null;
  dateOfBirth?: string | null;
  notes?: string | null;
  preferredChannel?: string | null;
  totalSpent: string | number;
  totalOrders: number;
  lastPurchaseAt?: string | null;
  lastInteractionAt?: string | null;
  marketingConsent: boolean;
  whatsappOptIn: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: { id: string; tag: { id: string; name: string; color?: string | null } }[];
  interests?: ProductInterest[];
  _count?: { orders?: number };
}

export interface ProductInterest {
  id: string;
  productId: string;
  productName?: string;
  interestLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  source: string;
  inquiryCount: number;
  lastInteractionAt?: string | null;
  product?: { id: string; name: string; sellingPrice: string | number; imageUrl?: string | null };
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string | null;
  categoryId?: string | null;
  brand?: string | null;
  sellingPrice: string | number;
  costPrice?: string | number | null;
  stockQuantity: number;
  minStockLevel: number;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  isNewArrival: boolean;
  isFeatured: boolean;
  imageUrl?: string | null;
  purchaseCount: number;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string } | null;
  interests?: { id: string }[];
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number };
}

export interface OrderItem {
  id: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal: string | number;
  product?: Product | null;
}

export interface Payment {
  id: string;
  amount: string | number;
  method: string;
  reference?: string | null;
  paidAt: string;
  notes?: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customer?: Customer;
  source: string;
  status: 'NEW' | 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PROCESSING' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  subtotal: string | number;
  discount: string | number;
  totalAmount: string | number;
  amountPaid: string | number;
  currency: string;
  notes?: string | null;
  needsReview: boolean;
  orderDate: string;
  confirmedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  items?: OrderItem[];
  payments?: Payment[];
}

export interface PipelineStage {
  id: string;
  name: string;
  position: number;
  isWon: boolean;
  isLost: boolean;
  _count?: { deals: number };
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
}

export interface Deal {
  id: string;
  title: string;
  customerId: string;
  customer?: Customer;
  pipelineId: string;
  stageId: string;
  stage?: PipelineStage;
  value: string | number;
  currency: string;
  status: 'OPEN' | 'WON' | 'LOST';
  notes?: string | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  customerId?: string | null;
  customer?: { id: string; fullName: string; phone: string } | null;
  admin?: { id: string; fullName: string } | null;
  type: string;
  title: string;
  description?: string | null;
  source?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  taskStatus?: string | null;
  priority?: string | null;
  isTask: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  customerId: string;
  customer?: Customer;
  whatsappPhone: string;
  status: 'OPEN' | 'PENDING' | 'CLOSED' | 'ARCHIVED';
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount: number;
  messages?: Message[];
}

export interface Message {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  status: string;
  fromPhone?: string | null;
  toPhone?: string | null;
  body?: string | null;
  mediaUrl?: string | null;
  templateName?: string | null;
  createdAt: string;
  sentByAdmin?: { id: string; fullName: string } | null;
}

export interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  messageBody: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
  template?: { name: string; language: string } | null;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  trigger: string;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  description?: string | null;
  config?: Record<string, unknown>;
  requireApproval: boolean;
  createdAt: string;
  _count?: { executions: number };
}

export interface CargoShipment {
  id: string;
  cargoReference: string;
  customerId: string;
  customer?: Customer;
  shipmentType: string;
  status: string;
  description?: string | null;
  trackingNumber?: string | null;
  shipmentDate?: string | null;
  estimatedArrival?: string | null;
  actualArrival?: string | null;
  createdAt: string;
}

export interface ShoppingRequest {
  id: string;
  requestNumber: string;
  customerId: string;
  customer?: Customer;
  productName: string;
  productDescription?: string | null;
  estimatedPrice?: string | number | null;
  status: string;
  createdAt: string;
}

export interface DashboardData {
  stats: Record<string, number | string>;
  charts: {
    customerGrowth: { month: string; customers: number }[];
    monthlySales: { month: string; sales: string | number }[];
    orderTrends: { date: string; orders: number; sales: string | number }[];
    productPopularity: { productId: string; name: string; quantity: number }[];
    interestPopularity: { productId: string; name: string; interests: number }[];
    salesByCategory: { category: string; total: string | number }[];
    orderStatusDistribution: { status: string; count: number }[];
    customerSourceDistribution: { source: string; count: number }[];
    purchaseFrequency: { orders: number; customers: number }[];
  };
  lists: {
    lowStock: Product[];
    recentOrders: Order[];
    recentActivities: Activity[];
    recentConversations: Conversation[];
    topCustomers: Customer[];
    birthdays: Customer[];
    topProducts: { productId: string; name: string; quantity: number }[];
    mostInterested: { productId: string; name: string; interests: number }[];
  };
}

export interface BusinessSettingsItem {
  id?: string;
  key: string;
  value: unknown;
  description?: string | null;
  isPublic?: boolean;
}

export interface Backup {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: string;
  type: string;
  checksum?: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  admin?: { id: string; fullName: string; email: string } | null;
}
