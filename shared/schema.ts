import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, serial, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique(),
  password: varchar("password"),
  phone: varchar("phone"),
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("viewer").notNull(), // admin, employee, viewer
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Branches table
export const branches = pgTable("branches", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBranchSchema = createInsertSchema(branches).omit({
  createdAt: true,
});

export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;

// Inventory items table
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull(),
  category: text("category").notNull(),
  price: real("price"),
  status: text("status"),
  lastCheck: text("last_check"),
  notes: text("notes"),
  serialNumber: text("serial_number"),
  imageUrl: text("image_url"),
  nextInspectionDate: text("next_inspection_date"),
  inspectionIntervalDays: integer("inspection_interval_days"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  createdAt: true,
  updatedAt: true,
});

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;

// Audit logs table for tracking changes (legacy - for inventory items)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  itemId: varchar("item_id").notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'create', 'update', 'delete'
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: text("changed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// System-wide audit log for all operations
export const systemAuditLogs = pgTable("system_audit_logs", {
  id: serial("id").primaryKey(),
  module: text("module").notNull(), // 'inventory', 'projects', 'contractors', 'transfers', 'users', 'contracts'
  entityId: text("entity_id").notNull(),
  entityName: text("entity_name"),
  action: text("action").notNull(), // 'create', 'update', 'delete', 'view', 'export', 'transfer', 'approve', 'reject'
  details: text("details"), // JSON string with change details
  userId: varchar("user_id").references(() => users.id),
  userName: text("user_name"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSystemAuditLogSchema = createInsertSchema(systemAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type SystemAuditLog = typeof systemAuditLogs.$inferSelect;
export type InsertSystemAuditLog = z.infer<typeof insertSystemAuditLogSchema>;

// Backups table
export const backups = pgTable("backups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'manual', 'auto', 'scheduled'
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'failed'
  fileSize: integer("file_size"),
  filePath: text("file_path"),
  tables: text("tables"), // JSON array of backed up tables
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertBackupSchema = createInsertSchema(backups).omit({
  id: true,
  createdAt: true,
});

export type Backup = typeof backups.$inferSelect;
export type InsertBackup = z.infer<typeof insertBackupSchema>;

// Saved filters table
export const savedFilters = pgTable("saved_filters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  filterConfig: text("filter_config").notNull(), // JSON string
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSavedFilterSchema = createInsertSchema(savedFilters).omit({
  id: true,
  createdAt: true,
});

export type SavedFilter = typeof savedFilters.$inferSelect;
export type InsertSavedFilter = z.infer<typeof insertSavedFilterSchema>;

// Construction Categories table
export const constructionCategories = pgTable("construction_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  icon: text("icon"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConstructionCategorySchema = createInsertSchema(constructionCategories).omit({
  id: true,
  createdAt: true,
});

export type ConstructionCategory = typeof constructionCategories.$inferSelect;
export type InsertConstructionCategory = z.infer<typeof insertConstructionCategorySchema>;

// Contractors table
export const contractors = pgTable("contractors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  specialization: text("specialization"),
  notes: text("notes"),
  rating: integer("rating"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertContractorSchema = createInsertSchema(contractors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Contractor = typeof contractors.$inferSelect;
export type InsertContractor = z.infer<typeof insertContractorSchema>;

// Construction Projects table
export const constructionProjects = pgTable("construction_projects", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").default("planned").notNull(), // planned, in_progress, completed, on_hold
  budget: real("budget"),
  actualCost: real("actual_cost"),
  startDate: text("start_date"),
  targetCompletionDate: text("target_completion_date"),
  actualCompletionDate: text("actual_completion_date"),
  progressPercent: integer("progress_percent").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConstructionProjectSchema = createInsertSchema(constructionProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ConstructionProject = typeof constructionProjects.$inferSelect;
export type InsertConstructionProject = z.infer<typeof insertConstructionProjectSchema>;

// Project Work Items table
export const projectWorkItems = pgTable("project_work_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => constructionProjects.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => constructionCategories.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").default("pending").notNull(), // pending, in_progress, completed
  costEstimate: real("cost_estimate"),
  actualCost: real("actual_cost"),
  contractorId: integer("contractor_id").references(() => contractors.id),
  scheduledStart: text("scheduled_start"),
  scheduledEnd: text("scheduled_end"),
  completedAt: text("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectWorkItemSchema = createInsertSchema(projectWorkItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProjectWorkItem = typeof projectWorkItems.$inferSelect;
export type InsertProjectWorkItem = z.infer<typeof insertProjectWorkItemSchema>;

// Project Budget Allocations table - for planning budget per category
export const projectBudgetAllocations = pgTable("project_budget_allocations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => constructionProjects.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => constructionCategories.id),
  plannedAmount: real("planned_amount").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectBudgetAllocationSchema = createInsertSchema(projectBudgetAllocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProjectBudgetAllocation = typeof projectBudgetAllocations.$inferSelect;
export type InsertProjectBudgetAllocation = z.infer<typeof insertProjectBudgetAllocationSchema>;

// Construction Contracts table - عقود الإنشاءات مع المقاولين
export const constructionContracts = pgTable("construction_contracts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => constructionProjects.id, { onDelete: "cascade" }),
  contractorId: integer("contractor_id").notNull().references(() => contractors.id),
  contractNumber: text("contract_number").unique(),
  title: text("title").notNull(),
  description: text("description"),
  contractType: text("contract_type").default("fixed_price").notNull(), // fixed_price, cost_plus, unit_price
  status: text("status").default("draft").notNull(), // draft, active, completed, cancelled, suspended
  totalAmount: real("total_amount").notNull().default(0),
  paidAmount: real("paid_amount").default(0),
  startDate: text("start_date"),
  endDate: text("end_date"),
  paymentTerms: text("payment_terms"), // شروط الدفع
  warrantyPeriod: text("warranty_period"), // فترة الضمان
  notes: text("notes"),
  attachmentUrl: text("attachment_url"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConstructionContractSchema = createInsertSchema(constructionContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ConstructionContract = typeof constructionContracts.$inferSelect;
export type InsertConstructionContract = z.infer<typeof insertConstructionContractSchema>;

// Contract Items table - بنود العقد
export const contractItems = pgTable("contract_items", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => constructionContracts.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(() => constructionCategories.id),
  description: text("description").notNull(),
  unit: text("unit").default("قطعة"),
  quantity: real("quantity").notNull().default(1),
  unitPrice: real("unit_price").notNull().default(0),
  totalPrice: real("total_price").notNull().default(0),
  completedQuantity: real("completed_quantity").default(0),
  status: text("status").default("pending").notNull(), // pending, in_progress, completed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertContractItemSchema = createInsertSchema(contractItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ContractItem = typeof contractItems.$inferSelect;
export type InsertContractItem = z.infer<typeof insertContractItemSchema>;

// Payment Requests table - طلبات الحوالات والمصروفات
export const paymentRequests = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => constructionProjects.id, { onDelete: "cascade" }),
  contractId: integer("contract_id").references(() => constructionContracts.id),
  requestNumber: text("request_number"),
  requestType: text("request_type").notNull(), // transfer (حوالة), expense (مصروف), advance (سلفة)
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  beneficiaryName: text("beneficiary_name"), // اسم المستفيد
  beneficiaryBank: text("beneficiary_bank"), // البنك
  beneficiaryIban: text("beneficiary_iban"), // رقم الحساب
  categoryId: integer("category_id").references(() => constructionCategories.id),
  status: text("status").default("pending").notNull(), // pending, approved, rejected, paid
  priority: text("priority").default("normal"), // urgent, high, normal, low
  requestDate: text("request_date"),
  dueDate: text("due_date"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  rejectionReason: text("rejection_reason"),
  attachmentUrl: text("attachment_url"),
  invoiceNumber: text("invoice_number"), // رقم الفاتورة
  notes: text("notes"),
  requestedBy: varchar("requested_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPaymentRequestSchema = createInsertSchema(paymentRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
  paidAt: true,
});

export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type InsertPaymentRequest = z.infer<typeof insertPaymentRequestSchema>;

// Contract Payments table - سجل دفعات العقود
export const contractPayments = pgTable("contract_payments", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => constructionContracts.id, { onDelete: "cascade" }),
  paymentRequestId: integer("payment_request_id").references(() => paymentRequests.id),
  amount: real("amount").notNull(),
  paymentDate: text("payment_date").notNull(),
  paymentMethod: text("payment_method"), // bank_transfer, cash, check
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContractPaymentSchema = createInsertSchema(contractPayments).omit({
  id: true,
  createdAt: true,
});

export type ContractPayment = typeof contractPayments.$inferSelect;
export type InsertContractPayment = z.infer<typeof insertContractPaymentSchema>;

// System Modules for permissions
export const SYSTEM_MODULES = [
  "dashboard",
  "inventory",
  "asset_transfers",
  "construction_projects",
  "construction_work_items",
  "contractors",
  "contracts",
  "budget_planning",
  "payment_requests",
  "users",
  "reports",
  "operations",
  "production",
  "shifts",
  "quality_control",
  "cashier_journal",
] as const;

export type SystemModule = typeof SYSTEM_MODULES[number];

// Actions for each module
export const MODULE_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
] as const;

export type ModuleAction = typeof MODULE_ACTIONS[number];

// User Permissions table - صلاحيات المستخدمين التفصيلية
export const userPermissions = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  module: text("module").notNull(), // e.g., 'inventory', 'construction_projects'
  actions: text("actions").array().notNull(), // e.g., ['view', 'create', 'edit', 'delete']
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserPermissionSchema = createInsertSchema(userPermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserPermission = typeof userPermissions.$inferSelect;
export type InsertUserPermission = z.infer<typeof insertUserPermissionSchema>;

// Module labels for UI display (Arabic)
export const MODULE_LABELS: Record<SystemModule, string> = {
  dashboard: "لوحة التحكم",
  inventory: "المخزون والأصول",
  asset_transfers: "تحويلات الأصول",
  construction_projects: "مشاريع الإنشاءات",
  construction_work_items: "بنود الأعمال",
  contractors: "المقاولين",
  contracts: "العقود",
  budget_planning: "تخطيط الميزانية",
  payment_requests: "طلبات الصرف",
  users: "إدارة المستخدمين",
  reports: "التقارير",
  operations: "التشغيل",
  production: "الإنتاج",
  shifts: "الورديات",
  quality_control: "مراقبة الجودة",
  cashier_journal: "يومية الكاشير",
};

// Action labels for UI display (Arabic)
export const ACTION_LABELS: Record<ModuleAction, string> = {
  view: "عرض",
  create: "إنشاء",
  edit: "تعديل",
  delete: "حذف",
  approve: "اعتماد",
  export: "تصدير",
};

// Module groups for UI organization
export const MODULE_GROUPS: { label: string; modules: SystemModule[] }[] = [
  { label: "الأساسية", modules: ["dashboard", "inventory", "asset_transfers", "reports"] },
  { label: "التشغيل", modules: ["operations", "production", "shifts", "quality_control", "cashier_journal"] },
  { label: "إدارة الإنشاءات", modules: ["construction_projects", "construction_work_items", "contractors"] },
  { label: "المالية والعقود", modules: ["contracts", "budget_planning", "payment_requests"] },
  { label: "إدارة النظام", modules: ["users"] },
];

// Role permission templates - قوالب الصلاحيات الافتراضية لكل دور
export const ROLE_PERMISSION_TEMPLATES: Record<string, { module: SystemModule; actions: ModuleAction[] }[]> = {
  // Admin gets full access (handled separately in middleware)
  admin: SYSTEM_MODULES.map(module => ({
    module,
    actions: [...MODULE_ACTIONS] as ModuleAction[],
  })),
  
  // Employee: Can view, create, edit most things, but no delete/approve for sensitive modules
  employee: [
    { module: "dashboard", actions: ["view", "export"] },
    { module: "inventory", actions: ["view", "create", "edit", "export"] },
    { module: "asset_transfers", actions: ["view", "create", "edit", "export"] },
    { module: "construction_projects", actions: ["view", "create", "edit", "export"] },
    { module: "construction_work_items", actions: ["view", "create", "edit", "export"] },
    { module: "contractors", actions: ["view", "create", "edit", "export"] },
    { module: "contracts", actions: ["view", "create", "edit", "export"] },
    { module: "budget_planning", actions: ["view", "create", "edit", "export"] },
    { module: "payment_requests", actions: ["view", "create", "edit", "export"] },
    { module: "reports", actions: ["view", "export"] },
  ],
  
  // Viewer: View-only access to all modules
  viewer: SYSTEM_MODULES.filter(m => m !== "users").map(module => ({
    module,
    actions: ["view"] as ModuleAction[],
  })),
};

// Permission Audit Logs - سجل تغييرات الصلاحيات
export const permissionAuditLogs = pgTable("permission_audit_logs", {
  id: serial("id").primaryKey(),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  changedByUserId: varchar("changed_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'grant', 'revoke', 'modify', 'apply_template'
  module: text("module"), // The module affected
  oldActions: text("old_actions").array(), // Previous actions
  newActions: text("new_actions").array(), // New actions
  templateApplied: text("template_applied"), // If a template was applied (e.g., 'admin', 'employee', 'viewer')
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPermissionAuditLogSchema = createInsertSchema(permissionAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type PermissionAuditLog = typeof permissionAuditLogs.$inferSelect;
export type InsertPermissionAuditLog = z.infer<typeof insertPermissionAuditLogSchema>;

// Asset Transfers table - تحويلات الأصول بين الفروع
export const assetTransfers = pgTable("asset_transfers", {
  id: serial("id").primaryKey(),
  transferNumber: text("transfer_number").unique().notNull(),
  itemId: varchar("item_id").notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  fromBranchId: varchar("from_branch_id").notNull().references(() => branches.id),
  toBranchId: varchar("to_branch_id").notNull().references(() => branches.id),
  status: text("status").default("pending").notNull(), // pending, approved, in_transit, completed, cancelled
  reason: text("reason"),
  notes: text("notes"),
  requestedBy: varchar("requested_by").references(() => users.id),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  receivedBy: varchar("received_by").references(() => users.id),
  receivedAt: timestamp("received_at"),
  receiverName: text("receiver_name"),
  receiverSignature: text("receiver_signature"), // Base64 signature
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAssetTransferSchema = createInsertSchema(assetTransfers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  requestedAt: true,
  approvedAt: true,
  receivedAt: true,
});

export type AssetTransfer = typeof assetTransfers.$inferSelect;
export type InsertAssetTransfer = z.infer<typeof insertAssetTransferSchema>;

// Asset Transfer Events table - أحداث التحويل
export const assetTransferEvents = pgTable("asset_transfer_events", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull().references(() => assetTransfers.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // created, approved, dispatched, received, cancelled
  actorId: varchar("actor_id").references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAssetTransferEventSchema = createInsertSchema(assetTransferEvents).omit({
  id: true,
  createdAt: true,
});

export type AssetTransferEvent = typeof assetTransferEvents.$inferSelect;
export type InsertAssetTransferEvent = z.infer<typeof insertAssetTransferEventSchema>;

// External System Integrations - التكاملات مع الأنظمة الخارجية
export const externalIntegrations = pgTable("external_integrations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., 'accounting', 'sms', 'whatsapp', 'erp'
  type: text("type").notNull(), // 'accounting', 'messaging', 'erp', 'import'
  config: jsonb("config"), // JSON configuration
  isActive: text("is_active").default("true"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertExternalIntegrationSchema = createInsertSchema(externalIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ExternalIntegration = typeof externalIntegrations.$inferSelect;
export type InsertExternalIntegration = z.infer<typeof insertExternalIntegrationSchema>;

// Notification Templates - قوالب الإشعارات
export const notificationTemplates = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  eventType: text("event_type").notNull(), // 'transfer_pending', 'transfer_approved', 'maintenance_due', etc.
  channel: text("channel").notNull(), // 'sms', 'whatsapp', 'email'
  template: text("template").notNull(), // Template with placeholders like {{itemName}}, {{branchName}}
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationTemplateSchema = createInsertSchema(notificationTemplates).omit({
  id: true,
  createdAt: true,
});

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = z.infer<typeof insertNotificationTemplateSchema>;

// Notification Queue - قائمة الإشعارات المنتظرة
export const notificationQueue = pgTable("notification_queue", {
  id: serial("id").primaryKey(),
  recipientPhone: text("recipient_phone").notNull(),
  recipientName: text("recipient_name"),
  channel: text("channel").notNull(), // 'sms', 'whatsapp'
  message: text("message").notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'sent', 'failed'
  errorMessage: text("error_message"),
  relatedModule: text("related_module"), // 'transfers', 'inventory', 'projects'
  relatedEntityId: text("related_entity_id"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationQueueSchema = createInsertSchema(notificationQueue).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export type NotificationQueueItem = typeof notificationQueue.$inferSelect;
export type InsertNotificationQueueItem = z.infer<typeof insertNotificationQueueSchema>;

// Data Import Jobs - وظائف استيراد البيانات
export const dataImportJobs = pgTable("data_import_jobs", {
  id: serial("id").primaryKey(),
  sourceSystem: text("source_system").notNull(), // 'excel', 'csv', 'api', 'erp'
  targetModule: text("target_module").notNull(), // 'inventory', 'projects', 'contractors'
  fileName: text("file_name"),
  status: text("status").default("pending").notNull(), // 'pending', 'processing', 'completed', 'failed'
  totalRecords: integer("total_records").default(0),
  processedRecords: integer("processed_records").default(0),
  failedRecords: integer("failed_records").default(0),
  errorLog: text("error_log"),
  importedBy: varchar("imported_by").references(() => users.id),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDataImportJobSchema = createInsertSchema(dataImportJobs).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export type DataImportJob = typeof dataImportJobs.$inferSelect;
export type InsertDataImportJob = z.infer<typeof insertDataImportJobSchema>;

// Accounting Exports - تصدير للمحاسبة
export const accountingExports = pgTable("accounting_exports", {
  id: serial("id").primaryKey(),
  exportType: text("export_type").notNull(), // 'inventory_valuation', 'asset_movements', 'project_costs'
  dateFrom: text("date_from"),
  dateTo: text("date_to"),
  branchId: varchar("branch_id").references(() => branches.id),
  data: jsonb("data"), // Exported data in JSON format
  status: text("status").default("pending").notNull(), // 'pending', 'completed', 'synced'
  syncedAt: timestamp("synced_at"),
  exportedBy: varchar("exported_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAccountingExportSchema = createInsertSchema(accountingExports).omit({
  id: true,
  createdAt: true,
  syncedAt: true,
});

export type AccountingExport = typeof accountingExports.$inferSelect;
export type InsertAccountingExport = z.infer<typeof insertAccountingExportSchema>;

// ============================================
// نظام التشغيل - Operations Module
// ============================================

// Products table - المنتجات (المخبوزات والمعجنات)
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  category: text("category").notNull(), // bread, pastry, cake, sandwich, etc.
  unit: text("unit").default("قطعة"), // قطعة، كيلو، صينية
  standardQuantity: integer("standard_quantity").default(1), // الكمية القياسية للوحدة
  preparationTime: integer("preparation_time"), // وقت التحضير بالدقائق
  bakingTime: integer("baking_time"), // وقت الخبز بالدقائق
  ingredients: text("ingredients"), // المكونات (JSON)
  isActive: text("is_active").default("true"),
  imageUrl: text("image_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// Shifts table - الورديات
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // الوردية الصباحية، المسائية، الليلية
  date: text("date").notNull(), // التاريخ
  startTime: text("start_time").notNull(), // وقت البدء
  endTime: text("end_time").notNull(), // وقت الانتهاء
  status: text("status").default("scheduled").notNull(), // scheduled, active, completed, cancelled
  supervisorName: text("supervisor_name"), // اسم المشرف
  employeeCount: integer("employee_count").default(0), // عدد الموظفين
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertShiftSchema = createInsertSchema(shifts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;

// Shift Employees table - موظفي الوردية
export const shiftEmployees = pgTable("shift_employees", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
  employeeName: text("employee_name").notNull(),
  role: text("role"), // خباز، معجناتي، كاشير، منظف، إلخ
  checkInTime: text("check_in_time"),
  checkOutTime: text("check_out_time"),
  status: text("status").default("expected").notNull(), // expected, present, absent, late
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertShiftEmployeeSchema = createInsertSchema(shiftEmployees).omit({
  id: true,
  createdAt: true,
});

export type ShiftEmployee = typeof shiftEmployees.$inferSelect;
export type InsertShiftEmployee = z.infer<typeof insertShiftEmployeeSchema>;

// Production Orders table - أوامر الإنتاج
export const productionOrders = pgTable("production_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").unique(),
  branchId: varchar("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  shiftId: integer("shift_id").references(() => shifts.id),
  productId: integer("product_id").notNull().references(() => products.id),
  targetQuantity: integer("target_quantity").notNull(), // الكمية المطلوبة
  producedQuantity: integer("produced_quantity").default(0), // الكمية المنتجة
  wastedQuantity: integer("wasted_quantity").default(0), // الكمية التالفة
  status: text("status").default("pending").notNull(), // pending, in_progress, completed, cancelled
  priority: text("priority").default("normal"), // urgent, high, normal, low
  scheduledDate: text("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  assignedTo: text("assigned_to"), // الخباز المسؤول
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductionOrderSchema = createInsertSchema(productionOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
});

export type ProductionOrder = typeof productionOrders.$inferSelect;
export type InsertProductionOrder = z.infer<typeof insertProductionOrderSchema>;

// Quality Checks table - فحوصات الجودة
export const qualityChecks = pgTable("quality_checks", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  shiftId: integer("shift_id").references(() => shifts.id),
  productionOrderId: integer("production_order_id").references(() => productionOrders.id),
  checkType: text("check_type").notNull(), // temperature, appearance, taste, weight, packaging, cleanliness
  checkDate: text("check_date").notNull(),
  checkTime: text("check_time"),
  result: text("result").notNull(), // passed, failed, needs_improvement
  score: integer("score"), // درجة الجودة (1-100)
  temperature: real("temperature"), // درجة الحرارة (للأفران والثلاجات)
  checkedBy: text("checked_by").notNull(), // اسم الفاحص
  details: text("details"), // تفاصيل الفحص (JSON)
  issues: text("issues"), // المشاكل المكتشفة
  correctiveAction: text("corrective_action"), // الإجراء التصحيحي
  attachmentUrl: text("attachment_url"), // صورة أو مستند
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQualityCheckSchema = createInsertSchema(qualityChecks).omit({
  id: true,
  createdAt: true,
});

export type QualityCheck = typeof qualityChecks.$inferSelect;
export type InsertQualityCheck = z.infer<typeof insertQualityCheckSchema>;

// Daily Operations Summary - ملخص العمليات اليومية
export const dailyOperationsSummary = pgTable("daily_operations_summary", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  totalOrders: integer("total_orders").default(0),
  completedOrders: integer("completed_orders").default(0),
  totalProduced: integer("total_produced").default(0),
  totalWasted: integer("total_wasted").default(0),
  wastePercentage: real("waste_percentage").default(0),
  qualityScore: real("quality_score"), // متوسط درجة الجودة
  shiftsCount: integer("shifts_count").default(0),
  employeesPresent: integer("employees_present").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDailyOperationsSummarySchema = createInsertSchema(dailyOperationsSummary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DailyOperationsSummary = typeof dailyOperationsSummary.$inferSelect;
export type InsertDailyOperationsSummary = z.infer<typeof insertDailyOperationsSummarySchema>;

// ==================== Cashier Sales Journal Module ====================

// Cashier Sales Journals table - يومية مبيعات الكاشير
export const cashierSalesJournals = pgTable("cashier_sales_journals", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id, { onDelete: "cascade" }),
  shiftId: integer("shift_id").references(() => shifts.id),
  cashierId: varchar("cashier_id").notNull().references(() => users.id),
  cashierName: text("cashier_name").notNull(),
  journalDate: text("journal_date").notNull(), // تاريخ اليومية
  shiftType: text("shift_type"), // صباحي، مسائي، ليلي
  shiftStartTime: text("shift_start_time"), // وقت بدء الشفت
  shiftEndTime: text("shift_end_time"), // وقت انتهاء الشفت
  
  // رصيد افتتاحي
  openingBalance: real("opening_balance").default(0).notNull(), // رصيد الافتتاح في الصندوق
  
  // إجمالي المبيعات
  totalSales: real("total_sales").default(0).notNull(), // إجمالي المبيعات
  cashTotal: real("cash_total").default(0).notNull(), // إجمالي النقد
  networkTotal: real("network_total").default(0).notNull(), // إجمالي الشبكة
  deliveryTotal: real("delivery_total").default(0).notNull(), // إجمالي التوصيل
  
  // مقارنة الصندوق
  expectedCash: real("expected_cash").default(0).notNull(), // النقد المتوقع
  actualCashDrawer: real("actual_cash_drawer").default(0).notNull(), // النقد الفعلي بالصندوق
  discrepancyAmount: real("discrepancy_amount").default(0).notNull(), // مبلغ الفرق
  discrepancyStatus: text("discrepancy_status").default("balanced").notNull(), // balanced, shortage, surplus
  
  // إحصائيات
  customerCount: integer("customer_count").default(0), // عدد العملاء
  transactionCount: integer("transaction_count").default(0), // عدد الفواتير
  averageTicket: real("average_ticket").default(0), // متوسط الفاتورة
  
  // الحالة والتوقيع
  status: text("status").default("draft").notNull(), // draft, submitted, approved, rejected
  submittedAt: timestamp("submitted_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCashierSalesJournalSchema = createInsertSchema(cashierSalesJournals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  approvedAt: true,
});

export type CashierSalesJournal = typeof cashierSalesJournals.$inferSelect;
export type InsertCashierSalesJournal = z.infer<typeof insertCashierSalesJournalSchema>;

// Payment Breakdown table - تفصيل المبيعات حسب وسيلة الدفع
export const cashierPaymentBreakdowns = pgTable("cashier_payment_breakdowns", {
  id: serial("id").primaryKey(),
  journalId: integer("journal_id").notNull().references(() => cashierSalesJournals.id, { onDelete: "cascade" }),
  paymentMethod: text("payment_method").notNull(), // cash, card, mada, stc_pay, apple_pay, visa, mastercard, delivery_app, other
  amount: real("amount").default(0).notNull(),
  transactionCount: integer("transaction_count").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCashierPaymentBreakdownSchema = createInsertSchema(cashierPaymentBreakdowns).omit({
  id: true,
  createdAt: true,
});

export type CashierPaymentBreakdown = typeof cashierPaymentBreakdowns.$inferSelect;
export type InsertCashierPaymentBreakdown = z.infer<typeof insertCashierPaymentBreakdownSchema>;

// Payment Methods labels
export const PAYMENT_METHODS = [
  "cash",
  "card", 
  "mada",
  "stc_pay",
  "apple_pay",
  "visa",
  "mastercard",
  "delivery_app",
  "hunger_station",
  "hungerstation",
  "toyou",
  "jahez",
  "marsool",
  "keeta",
  "the_chefs",
  "talabat",
  "other",
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number];

// Payment method categories for reporting
export const PAYMENT_CATEGORIES = {
  cash: ["cash"],
  cards: ["card", "mada", "stc_pay", "apple_pay", "visa", "mastercard"],
  apps: ["delivery_app", "hunger_station", "hungerstation", "toyou", "jahez", "marsool", "keeta", "the_chefs", "talabat"],
} as const;

export type PaymentCategory = keyof typeof PAYMENT_CATEGORIES;

export const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  cash: "نقدي",
  cards: "بطاقات وشبكة",
  apps: "تطبيقات التوصيل (آجل)",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "نقد",
  card: "بطاقة ائتمان",
  mada: "مدى",
  stc_pay: "STC Pay",
  apple_pay: "Apple Pay",
  visa: "فيزا",
  mastercard: "ماستركارد",
  delivery_app: "تطبيق توصيل",
  hunger_station: "هنقرستيشن",
  hungerstation: "هنقرستيشن",
  toyou: "تو يو",
  jahez: "جاهز",
  marsool: "مرسول",
  keeta: "كيتا",
  the_chefs: "ذا شيفز",
  talabat: "طلبات",
  other: "أخرى",
};

// Cashier Signatures table - التوقيعات الإلكترونية
export const cashierSignatures = pgTable("cashier_signatures", {
  id: serial("id").primaryKey(),
  journalId: integer("journal_id").notNull().references(() => cashierSalesJournals.id, { onDelete: "cascade" }),
  signatureType: text("signature_type").notNull(), // cashier, supervisor, manager
  signerName: text("signer_name").notNull(),
  signerId: varchar("signer_id").references(() => users.id),
  signatureData: text("signature_data").notNull(), // Base64 encoded signature image
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  notes: text("notes"),
});

export const insertCashierSignatureSchema = createInsertSchema(cashierSignatures).omit({
  id: true,
  signedAt: true,
});

export type CashierSignature = typeof cashierSignatures.$inferSelect;
export type InsertCashierSignature = z.infer<typeof insertCashierSignatureSchema>;

// Discrepancy status labels
export const DISCREPANCY_STATUS = ["balanced", "shortage", "surplus"] as const;
export type DiscrepancyStatus = typeof DISCREPANCY_STATUS[number];

export const DISCREPANCY_STATUS_LABELS: Record<DiscrepancyStatus, string> = {
  balanced: "متوازن",
  shortage: "عجز",
  surplus: "زيادة",
};

// Journal status labels
export const JOURNAL_STATUS = ["draft", "posted", "submitted", "approved", "rejected"] as const;
export type JournalStatus = typeof JOURNAL_STATUS[number];

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
  draft: "مسودة",
  posted: "مُرحَّل",
  submitted: "مقدم للمراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
};
