export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',

  // Customers
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  CUSTOMER_DELETE: 'customer.delete',
  CUSTOMER_ARCHIVE: 'customer.archive',
  CUSTOMER_MERGE: 'customer.merge',
  CUSTOMER_IMPORT: 'customer.import',
  CUSTOMER_EXPORT: 'customer.export',
  CUSTOMER_VIEW_PII: 'customer.view_pii',

  // Products
  PRODUCT_VIEW: 'product.view',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',
  PRODUCT_VIEW_COST: 'product.view_cost',

  // Orders
  ORDER_VIEW: 'order.view',
  ORDER_CREATE: 'order.create',
  ORDER_UPDATE: 'order.update',
  ORDER_DELETE: 'order.delete',
  ORDER_RECORD_PAYMENT: 'order.record_payment',

  // Pipeline
  DEAL_VIEW: 'deal.view',
  DEAL_CREATE: 'deal.create',
  DEAL_UPDATE: 'deal.update',
  DEAL_DELETE: 'deal.delete',

  // Activities
  ACTIVITY_VIEW: 'activity.view',
  ACTIVITY_CREATE: 'activity.create',
  ACTIVITY_UPDATE: 'activity.update',
  ACTIVITY_DELETE: 'activity.delete',

  // WhatsApp
  WHATSAPP_VIEW: 'whatsapp.view',
  WHATSAPP_SEND: 'whatsapp.send',
  WHATSAPP_CAMPAIGN: 'whatsapp.campaign',
  WHATSAPP_CONFIGURE: 'whatsapp.configure',

  // Automation
  AUTOMATION_VIEW: 'automation.view',
  AUTOMATION_MANAGE: 'automation.manage',

  // Reports
  REPORT_VIEW: 'report.view',
  REPORT_EXPORT: 'report.export',

  // Admin & settings
  ADMIN_VIEW: 'admin.view',
  ADMIN_MANAGE: 'admin.manage',
  ADMIN_MANAGE_ROLES: 'admin.manage_roles',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view',

  // Backup
  BACKUP_VIEW: 'backup.view',
  BACKUP_CREATE: 'backup.create',
  BACKUP_RESTORE: 'backup.restore',

  // Cargo & personal shopping
  CARGO_VIEW: 'cargo.view',
  CARGO_MANAGE: 'cargo.manage',
  SHOPPING_VIEW: 'shopping.view',
  SHOPPING_MANAGE: 'shopping.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: { key: string; label: string; category: string; description?: string }[] = [
  { key: PERMISSIONS.DASHBOARD_VIEW, label: 'View dashboard', category: 'Dashboard' },

  { key: PERMISSIONS.CUSTOMER_VIEW, label: 'View customers', category: 'Customers' },
  { key: PERMISSIONS.CUSTOMER_CREATE, label: 'Create customers', category: 'Customers' },
  { key: PERMISSIONS.CUSTOMER_UPDATE, label: 'Update customers', category: 'Customers' },
  { key: PERMISSIONS.CUSTOMER_DELETE, label: 'Delete customers', category: 'Customers' },
  { key: PERMISSIONS.CUSTOMER_ARCHIVE, label: 'Archive customers', category: 'Customers' },
  { key: PERMISSIONS.CUSTOMER_MERGE, label: 'Merge customers', category: 'Customers' },
  { key: PERMISSIONS.CUSTOMER_IMPORT, label: 'Import customers', category: 'Customers' },
  { key: PERMISSIONS.CUSTOMER_EXPORT, label: 'Export customers', category: 'Customers' },
  { key: PERMISSIONS.CUSTOMER_VIEW_PII, label: 'View customer PII', category: 'Customers' },

  { key: PERMISSIONS.PRODUCT_VIEW, label: 'View products', category: 'Products' },
  { key: PERMISSIONS.PRODUCT_CREATE, label: 'Create products', category: 'Products' },
  { key: PERMISSIONS.PRODUCT_UPDATE, label: 'Update products', category: 'Products' },
  { key: PERMISSIONS.PRODUCT_DELETE, label: 'Delete products', category: 'Products' },
  { key: PERMISSIONS.PRODUCT_VIEW_COST, label: 'View product cost', category: 'Products' },

  { key: PERMISSIONS.ORDER_VIEW, label: 'View orders', category: 'Orders' },
  { key: PERMISSIONS.ORDER_CREATE, label: 'Create orders', category: 'Orders' },
  { key: PERMISSIONS.ORDER_UPDATE, label: 'Update orders', category: 'Orders' },
  { key: PERMISSIONS.ORDER_DELETE, label: 'Delete orders', category: 'Orders' },
  { key: PERMISSIONS.ORDER_RECORD_PAYMENT, label: 'Record payments', category: 'Orders' },

  { key: PERMISSIONS.DEAL_VIEW, label: 'View pipeline', category: 'Pipeline' },
  { key: PERMISSIONS.DEAL_CREATE, label: 'Create deals', category: 'Pipeline' },
  { key: PERMISSIONS.DEAL_UPDATE, label: 'Update deals', category: 'Pipeline' },
  { key: PERMISSIONS.DEAL_DELETE, label: 'Delete deals', category: 'Pipeline' },

  { key: PERMISSIONS.ACTIVITY_VIEW, label: 'View activities', category: 'Activities' },
  { key: PERMISSIONS.ACTIVITY_CREATE, label: 'Create activities', category: 'Activities' },
  { key: PERMISSIONS.ACTIVITY_UPDATE, label: 'Update activities', category: 'Activities' },
  { key: PERMISSIONS.ACTIVITY_DELETE, label: 'Delete activities', category: 'Activities' },

  { key: PERMISSIONS.WHATSAPP_VIEW, label: 'View WhatsApp inbox', category: 'WhatsApp' },
  { key: PERMISSIONS.WHATSAPP_SEND, label: 'Send WhatsApp messages', category: 'WhatsApp' },
  { key: PERMISSIONS.WHATSAPP_CAMPAIGN, label: 'Manage WhatsApp campaigns', category: 'WhatsApp' },
  { key: PERMISSIONS.WHATSAPP_CONFIGURE, label: 'Configure WhatsApp', category: 'WhatsApp' },

  { key: PERMISSIONS.AUTOMATION_VIEW, label: 'View automations', category: 'Automation' },
  { key: PERMISSIONS.AUTOMATION_MANAGE, label: 'Manage automations', category: 'Automation' },

  { key: PERMISSIONS.REPORT_VIEW, label: 'View reports', category: 'Reports' },
  { key: PERMISSIONS.REPORT_EXPORT, label: 'Export reports', category: 'Reports' },

  { key: PERMISSIONS.ADMIN_VIEW, label: 'View administrators', category: 'Administration' },
  { key: PERMISSIONS.ADMIN_MANAGE, label: 'Manage administrators', category: 'Administration' },
  { key: PERMISSIONS.ADMIN_MANAGE_ROLES, label: 'Manage roles', category: 'Administration' },
  { key: PERMISSIONS.SETTINGS_VIEW, label: 'View settings', category: 'Administration' },
  { key: PERMISSIONS.SETTINGS_MANAGE, label: 'Manage settings', category: 'Administration' },
  { key: PERMISSIONS.AUDIT_VIEW, label: 'View audit log', category: 'Administration' },

  { key: PERMISSIONS.BACKUP_VIEW, label: 'View backups', category: 'Backup' },
  { key: PERMISSIONS.BACKUP_CREATE, label: 'Create backups', category: 'Backup' },
  { key: PERMISSIONS.BACKUP_RESTORE, label: 'Restore backups', category: 'Backup' },

  { key: PERMISSIONS.CARGO_VIEW, label: 'View cargo shipments', category: 'Cargo' },
  { key: PERMISSIONS.CARGO_MANAGE, label: 'Manage cargo shipments', category: 'Cargo' },
  { key: PERMISSIONS.SHOPPING_VIEW, label: 'View personal shopping', category: 'Cargo' },
  { key: PERMISSIONS.SHOPPING_MANAGE, label: 'Manage personal shopping', category: 'Cargo' },
];

export const ROLE_DEFINITIONS = [
  {
    name: 'Super Admin',
    slug: 'super_admin',
    description: 'Full unrestricted access to all CRM functionality.',
    permissions: ['*'],
    isSystem: true,
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'Manages customers, orders, products, campaigns and reports.',
    permissions: ALL_PERMISSIONS.filter((p) => !p.key.startsWith('backup.restore') && p.key !== PERMISSIONS.ADMIN_MANAGE_ROLES).map(
      (p) => p.key,
    ),
    isSystem: true,
  },
  {
    name: 'Staff',
    slug: 'staff',
    description: 'Day-to-day customer, order and inbox operations.',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.ORDER_VIEW,
      PERMISSIONS.ORDER_CREATE,
      PERMISSIONS.ORDER_UPDATE,
      PERMISSIONS.DEAL_VIEW,
      PERMISSIONS.ACTIVITY_VIEW,
      PERMISSIONS.ACTIVITY_CREATE,
      PERMISSIONS.ACTIVITY_UPDATE,
      PERMISSIONS.WHATSAPP_VIEW,
      PERMISSIONS.WHATSAPP_SEND,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.CARGO_VIEW,
      PERMISSIONS.SHOPPING_VIEW,
    ],
    isSystem: true,
  },
];
