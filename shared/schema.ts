import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  timestamp,
  serial,
  index,
  jsonb,
  boolean,
  doublePrecision,
} from "drizzle-orm/pg-core";
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
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: varchar("username").unique(),
  password: varchar("password"),
  phone: varchar("phone"),
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("viewer").notNull(), // admin, employee, viewer
  branchId: varchar("branch_id").references(() => branches.id),
  jobTitle: varchar("job_title"),
  isActive: text("is_active").default("active"), // active, inactive
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
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
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

export const insertInventoryItemSchema = createInsertSchema(
  inventoryItems,
).omit({
  createdAt: true,
  updatedAt: true,
});

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;

// Audit logs table for tracking changes (legacy - for inventory items)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  itemId: varchar("item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
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

export const insertSystemAuditLogSchema = createInsertSchema(
  systemAuditLogs,
).omit({
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

export const insertConstructionCategorySchema = createInsertSchema(
  constructionCategories,
).omit({
  id: true,
  createdAt: true,
});

export type ConstructionCategory = typeof constructionCategories.$inferSelect;
export type InsertConstructionCategory = z.infer<
  typeof insertConstructionCategorySchema
>;

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
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
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

export const insertConstructionProjectSchema = createInsertSchema(
  constructionProjects,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ConstructionProject = typeof constructionProjects.$inferSelect;
export type InsertConstructionProject = z.infer<
  typeof insertConstructionProjectSchema
>;

// Project Work Items table
export const projectWorkItems = pgTable("project_work_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => constructionProjects.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(
    () => constructionCategories.id,
  ),
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

export const insertProjectWorkItemSchema = createInsertSchema(
  projectWorkItems,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProjectWorkItem = typeof projectWorkItems.$inferSelect;
export type InsertProjectWorkItem = z.infer<typeof insertProjectWorkItemSchema>;

// Project Budget Allocations table - for planning budget per category
export const projectBudgetAllocations = pgTable("project_budget_allocations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => constructionProjects.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(
    () => constructionCategories.id,
  ),
  plannedAmount: real("planned_amount").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProjectBudgetAllocationSchema = createInsertSchema(
  projectBudgetAllocations,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProjectBudgetAllocation =
  typeof projectBudgetAllocations.$inferSelect;
export type InsertProjectBudgetAllocation = z.infer<
  typeof insertProjectBudgetAllocationSchema
>;

// Construction Contracts table - عقود الإنشاءات مع المقاولين
export const constructionContracts = pgTable("construction_contracts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => constructionProjects.id, { onDelete: "cascade" }),
  contractorId: integer("contractor_id")
    .notNull()
    .references(() => contractors.id),
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

export const insertConstructionContractSchema = createInsertSchema(
  constructionContracts,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ConstructionContract = typeof constructionContracts.$inferSelect;
export type InsertConstructionContract = z.infer<
  typeof insertConstructionContractSchema
>;

// Contract Items table - بنود العقد
export const contractItems = pgTable("contract_items", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id")
    .notNull()
    .references(() => constructionContracts.id, { onDelete: "cascade" }),
  categoryId: integer("category_id").references(
    () => constructionCategories.id,
  ),
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
  projectId: integer("project_id")
    .notNull()
    .references(() => constructionProjects.id, { onDelete: "cascade" }),
  contractId: integer("contract_id").references(() => constructionContracts.id),
  requestNumber: text("request_number"),
  requestType: text("request_type").notNull(), // transfer (حوالة), expense (مصروف), advance (سلفة)
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  beneficiaryName: text("beneficiary_name"), // اسم المستفيد
  beneficiaryBank: text("beneficiary_bank"), // البنك
  beneficiaryIban: text("beneficiary_iban"), // رقم الحساب
  categoryId: integer("category_id").references(
    () => constructionCategories.id,
  ),
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

export const insertPaymentRequestSchema = createInsertSchema(
  paymentRequests,
).omit({
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
  contractId: integer("contract_id")
    .notNull()
    .references(() => constructionContracts.id, { onDelete: "cascade" }),
  paymentRequestId: integer("payment_request_id").references(
    () => paymentRequests.id,
  ),
  amount: real("amount").notNull(),
  paymentDate: text("payment_date").notNull(),
  paymentMethod: text("payment_method"), // bank_transfer, cash, check
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContractPaymentSchema = createInsertSchema(
  contractPayments,
).omit({
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

export type SystemModule = (typeof SYSTEM_MODULES)[number];

// Actions for each module
export const MODULE_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
] as const;

export type ModuleAction = (typeof MODULE_ACTIONS)[number];

// User Permissions table - صلاحيات المستخدمين التفصيلية
export const userPermissions = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  module: text("module").notNull(), // e.g., 'inventory', 'construction_projects'
  actions: text("actions").array().notNull(), // e.g., ['view', 'create', 'edit', 'delete']
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserPermissionSchema = createInsertSchema(
  userPermissions,
).omit({
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
  {
    label: "الأساسية",
    modules: ["dashboard", "inventory", "asset_transfers", "reports"],
  },
  {
    label: "التشغيل",
    modules: [
      "operations",
      "production",
      "shifts",
      "quality_control",
      "cashier_journal",
    ],
  },
  {
    label: "إدارة الإنشاءات",
    modules: [
      "construction_projects",
      "construction_work_items",
      "contractors",
    ],
  },
  {
    label: "المالية والعقود",
    modules: ["contracts", "budget_planning", "payment_requests"],
  },
  { label: "إدارة النظام", modules: ["users"] },
];

// Role permission templates - قوالب الصلاحيات الافتراضية لكل دور
export const ROLE_PERMISSION_TEMPLATES: Record<
  string,
  { module: SystemModule; actions: ModuleAction[] }[]
> = {
  // Admin gets full access (handled separately in middleware)
  admin: SYSTEM_MODULES.map((module) => ({
    module,
    actions: [...MODULE_ACTIONS] as ModuleAction[],
  })),

  // Employee: Can view, create, edit most things, but no delete/approve for sensitive modules
  employee: [
    { module: "dashboard", actions: ["view", "export"] },
    { module: "inventory", actions: ["view", "create", "edit", "export"] },
    {
      module: "asset_transfers",
      actions: ["view", "create", "edit", "export"],
    },
    {
      module: "construction_projects",
      actions: ["view", "create", "edit", "export"],
    },
    {
      module: "construction_work_items",
      actions: ["view", "create", "edit", "export"],
    },
    { module: "contractors", actions: ["view", "create", "edit", "export"] },
    { module: "contracts", actions: ["view", "create", "edit", "export"] },
    {
      module: "budget_planning",
      actions: ["view", "create", "edit", "export"],
    },
    {
      module: "payment_requests",
      actions: ["view", "create", "edit", "export"],
    },
    { module: "reports", actions: ["view", "export"] },
  ],

  // Viewer: View-only access to all modules
  viewer: SYSTEM_MODULES.filter((m) => m !== "users").map((module) => ({
    module,
    actions: ["view"] as ModuleAction[],
  })),
};

// Job Titles - الوظائف
export const JOB_TITLES = [
  "cashier",
  "baker",
  "supervisor",
  "branch_manager",
  "production_manager",
  "quality_inspector",
  "delivery",
  "cleaner",
  "maintenance",
  "other",
] as const;

export type JobTitle = (typeof JOB_TITLES)[number];

// Job Title Labels - مسميات الوظائف بالعربية
export const JOB_TITLE_LABELS: Record<JobTitle, string> = {
  cashier: "كاشير",
  baker: "خباز",
  supervisor: "مشرف",
  branch_manager: "مدير فرع",
  production_manager: "مدير إنتاج",
  quality_inspector: "مفتش جودة",
  delivery: "توصيل",
  cleaner: "نظافة",
  maintenance: "صيانة",
  other: "أخرى",
};

// Job Role Permission Templates - قوالب صلاحيات الوظائف
export const JOB_ROLE_PERMISSION_TEMPLATES: Record<
  JobTitle,
  { module: SystemModule; actions: ModuleAction[] }[]
> = {
  // كاشير - يومية الكاشير فقط
  cashier: [
    { module: "dashboard", actions: ["view"] },
    { module: "cashier_journal", actions: ["view", "create", "edit"] },
  ],

  // خباز - الإنتاج ومراقبة الجودة
  baker: [
    { module: "dashboard", actions: ["view"] },
    { module: "production", actions: ["view", "create", "edit"] },
    { module: "quality_control", actions: ["view"] },
  ],

  // مشرف - نظرة عامة على التشغيل مع عرض الأقسام الأساسية
  supervisor: [
    { module: "dashboard", actions: ["view", "export"] },
    { module: "operations", actions: ["view", "create", "edit"] },
    { module: "production", actions: ["view"] },
    { module: "shifts", actions: ["view", "create", "edit"] },
    { module: "quality_control", actions: ["view"] },
    { module: "cashier_journal", actions: ["view", "approve"] },
    { module: "inventory", actions: ["view"] },
  ],

  // مدير فرع - صلاحيات واسعة على فرعه
  branch_manager: [
    { module: "dashboard", actions: ["view", "export"] },
    { module: "operations", actions: ["view", "create", "edit", "delete"] },
    { module: "production", actions: ["view", "create", "edit"] },
    { module: "shifts", actions: ["view", "create", "edit", "delete"] },
    { module: "quality_control", actions: ["view", "create", "edit"] },
    {
      module: "cashier_journal",
      actions: ["view", "create", "edit", "approve"],
    },
    { module: "inventory", actions: ["view", "create", "edit"] },
    { module: "asset_transfers", actions: ["view", "create", "edit"] },
    { module: "reports", actions: ["view", "export"] },
  ],

  // مدير إنتاج - الإنتاج والورديات ومراقبة الجودة
  production_manager: [
    { module: "dashboard", actions: ["view", "export"] },
    { module: "production", actions: ["view", "create", "edit", "delete"] },
    { module: "shifts", actions: ["view", "create", "edit", "delete"] },
    {
      module: "quality_control",
      actions: ["view", "create", "edit", "delete"],
    },
    { module: "operations", actions: ["view"] },
    { module: "inventory", actions: ["view"] },
  ],

  // مفتش جودة - مراقبة الجودة والإنتاج
  quality_inspector: [
    { module: "dashboard", actions: ["view"] },
    { module: "quality_control", actions: ["view", "create", "edit"] },
    { module: "production", actions: ["view"] },
  ],

  // توصيل - عرض يومية الكاشير
  delivery: [
    { module: "dashboard", actions: ["view"] },
    { module: "cashier_journal", actions: ["view"] },
  ],

  // نظافة - عرض محدود
  cleaner: [
    { module: "dashboard", actions: ["view"] },
    { module: "operations", actions: ["view"] },
  ],

  // صيانة - المخزون وتحويلات الأصول
  maintenance: [
    { module: "dashboard", actions: ["view"] },
    { module: "inventory", actions: ["view", "edit"] },
    { module: "asset_transfers", actions: ["view", "create"] },
  ],

  // أخرى - عرض لوحة التحكم فقط
  other: [{ module: "dashboard", actions: ["view"] }],
};

// Job Role Permissions table - جدول صلاحيات الوظائف (للتخصيص)
export const jobRolePermissions = pgTable("job_role_permissions", {
  id: serial("id").primaryKey(),
  jobTitle: text("job_title").notNull(), // cashier, baker, supervisor, etc.
  module: text("module").notNull(),
  actions: text("actions").array().notNull(),
  isDefault: boolean("is_default").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertJobRolePermissionSchema = createInsertSchema(
  jobRolePermissions,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type JobRolePermission = typeof jobRolePermissions.$inferSelect;
export type InsertJobRolePermission = z.infer<
  typeof insertJobRolePermissionSchema
>;

// Permission Audit Logs - سجل تغييرات الصلاحيات
export const permissionAuditLogs = pgTable("permission_audit_logs", {
  id: serial("id").primaryKey(),
  targetUserId: varchar("target_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  changedByUserId: varchar("changed_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'grant', 'revoke', 'modify', 'apply_template'
  module: text("module"), // The module affected
  oldActions: text("old_actions").array(), // Previous actions
  newActions: text("new_actions").array(), // New actions
  templateApplied: text("template_applied"), // If a template was applied (e.g., 'admin', 'employee', 'viewer')
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPermissionAuditLogSchema = createInsertSchema(
  permissionAuditLogs,
).omit({
  id: true,
  createdAt: true,
});

export type PermissionAuditLog = typeof permissionAuditLogs.$inferSelect;
export type InsertPermissionAuditLog = z.infer<
  typeof insertPermissionAuditLogSchema
>;

// Asset Transfers table - تحويلات الأصول بين الفروع
export const assetTransfers = pgTable("asset_transfers", {
  id: serial("id").primaryKey(),
  transferNumber: text("transfer_number").unique().notNull(),
  itemId: varchar("item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  fromBranchId: varchar("from_branch_id")
    .notNull()
    .references(() => branches.id),
  toBranchId: varchar("to_branch_id")
    .notNull()
    .references(() => branches.id),
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

export const insertAssetTransferSchema = createInsertSchema(
  assetTransfers,
).omit({
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
  transferId: integer("transfer_id")
    .notNull()
    .references(() => assetTransfers.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // created, approved, dispatched, received, cancelled
  actorId: varchar("actor_id").references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAssetTransferEventSchema = createInsertSchema(
  assetTransferEvents,
).omit({
  id: true,
  createdAt: true,
});

export type AssetTransferEvent = typeof assetTransferEvents.$inferSelect;
export type InsertAssetTransferEvent = z.infer<
  typeof insertAssetTransferEventSchema
>;

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

export const insertExternalIntegrationSchema = createInsertSchema(
  externalIntegrations,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ExternalIntegration = typeof externalIntegrations.$inferSelect;
export type InsertExternalIntegration = z.infer<
  typeof insertExternalIntegrationSchema
>;

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

export const insertNotificationTemplateSchema = createInsertSchema(
  notificationTemplates,
).omit({
  id: true,
  createdAt: true,
});

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = z.infer<
  typeof insertNotificationTemplateSchema
>;

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

export const insertNotificationQueueSchema = createInsertSchema(
  notificationQueue,
).omit({
  id: true,
  createdAt: true,
  sentAt: true,
});

export type NotificationQueueItem = typeof notificationQueue.$inferSelect;
export type InsertNotificationQueueItem = z.infer<
  typeof insertNotificationQueueSchema
>;

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

export const insertDataImportJobSchema = createInsertSchema(
  dataImportJobs,
).omit({
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

export const insertAccountingExportSchema = createInsertSchema(
  accountingExports,
).omit({
  id: true,
  createdAt: true,
  syncedAt: true,
});

export type AccountingExport = typeof accountingExports.$inferSelect;
export type InsertAccountingExport = z.infer<
  typeof insertAccountingExportSchema
>;

// ============================================
// نظام التشغيل - Operations Module
// ============================================

// Products table - المنتجات (المخبوزات والمعجنات)
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku"), // رمز المنتج
  category: text("category").notNull(), // bread, pastry, cake, sandwich, etc.
  unit: text("unit").default("قطعة"), // قطعة، كيلو، صينية
  basePrice: doublePrecision("base_price"), // السعر شامل الضريبة
  priceExclVat: doublePrecision("price_excl_vat"), // السعر بدون ضريبة
  vatAmount: doublePrecision("vat_amount"), // قيمة الضريبة
  vatRate: doublePrecision("vat_rate").default(0.15), // نسبة الضريبة
  isActive: text("is_active").default("true"),
  description: text("description"), // وصف المنتج
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
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
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
  shiftId: integer("shift_id")
    .notNull()
    .references(() => shifts.id, { onDelete: "cascade" }),
  employeeName: text("employee_name").notNull(),
  role: text("role"), // خباز، معجناتي، كاشير، منظف، إلخ
  checkInTime: text("check_in_time"),
  checkOutTime: text("check_out_time"),
  status: text("status").default("expected").notNull(), // expected, present, absent, late
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertShiftEmployeeSchema = createInsertSchema(
  shiftEmployees,
).omit({
  id: true,
  createdAt: true,
});

export type ShiftEmployee = typeof shiftEmployees.$inferSelect;
export type InsertShiftEmployee = z.infer<typeof insertShiftEmployeeSchema>;

// Production Orders table - أوامر الإنتاج
export const productionOrders = pgTable("production_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").unique(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  shiftId: integer("shift_id").references(() => shifts.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
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

export const insertProductionOrderSchema = createInsertSchema(
  productionOrders,
).omit({
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
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  shiftId: integer("shift_id").references(() => shifts.id),
  productionOrderId: integer("production_order_id").references(
    () => productionOrders.id,
  ),
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
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
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

export const insertDailyOperationsSummarySchema = createInsertSchema(
  dailyOperationsSummary,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DailyOperationsSummary = typeof dailyOperationsSummary.$inferSelect;
export type InsertDailyOperationsSummary = z.infer<
  typeof insertDailyOperationsSummarySchema
>;

// ==================== Cashier Sales Journal Module ====================

// Cashier Sales Journals table - يومية مبيعات الكاشير
export const cashierSalesJournals = pgTable("cashier_sales_journals", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  shiftId: integer("shift_id").references(() => shifts.id),
  cashierId: varchar("cashier_id")
    .notNull()
    .references(() => users.id),
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

export const insertCashierSalesJournalSchema = createInsertSchema(
  cashierSalesJournals,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  approvedAt: true,
});

export type CashierSalesJournal = typeof cashierSalesJournals.$inferSelect;
export type InsertCashierSalesJournal = z.infer<
  typeof insertCashierSalesJournalSchema
>;

// Payment Breakdown table - تفصيل المبيعات حسب وسيلة الدفع
export const cashierPaymentBreakdowns = pgTable("cashier_payment_breakdowns", {
  id: serial("id").primaryKey(),
  journalId: integer("journal_id")
    .notNull()
    .references(() => cashierSalesJournals.id, { onDelete: "cascade" }),
  paymentMethod: text("payment_method").notNull(), // cash, card, mada, stc_pay, apple_pay, visa, mastercard, delivery_app, other
  amount: real("amount").default(0).notNull(),
  transactionCount: integer("transaction_count").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCashierPaymentBreakdownSchema = createInsertSchema(
  cashierPaymentBreakdowns,
).omit({
  id: true,
  createdAt: true,
});

export type CashierPaymentBreakdown =
  typeof cashierPaymentBreakdowns.$inferSelect;
export type InsertCashierPaymentBreakdown = z.infer<
  typeof insertCashierPaymentBreakdownSchema
>;

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

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Payment method categories for reporting
export const PAYMENT_CATEGORIES = {
  cash: ["cash"],
  cards: ["card", "mada", "stc_pay", "apple_pay", "visa", "mastercard"],
  apps: [
    "delivery_app",
    "hunger_station",
    "hungerstation",
    "toyou",
    "jahez",
    "marsool",
    "keeta",
    "the_chefs",
    "talabat",
  ],
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
  journalId: integer("journal_id")
    .notNull()
    .references(() => cashierSalesJournals.id, { onDelete: "cascade" }),
  signatureType: text("signature_type").notNull(), // cashier, supervisor, manager
  signerName: text("signer_name").notNull(),
  signerId: varchar("signer_id").references(() => users.id),
  signatureData: text("signature_data").notNull(), // Base64 encoded signature image
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  notes: text("notes"),
});

export const insertCashierSignatureSchema = createInsertSchema(
  cashierSignatures,
).omit({
  id: true,
  signedAt: true,
});

export type CashierSignature = typeof cashierSignatures.$inferSelect;
export type InsertCashierSignature = z.infer<
  typeof insertCashierSignatureSchema
>;

// Journal Attachments - for storing photos (Foodics report, network device report, etc.)
export const ATTACHMENT_TYPES = [
  "foodics_report",
  "network_report",
  "other",
] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];

export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  foodics_report: "تقرير فوديكس",
  network_report: "تقرير جهاز الشبكة",
  other: "أخرى",
};

export const journalAttachments = pgTable("journal_attachments", {
  id: serial("id").primaryKey(),
  journalId: integer("journal_id")
    .notNull()
    .references(() => cashierSalesJournals.id, { onDelete: "cascade" }),
  attachmentType: text("attachment_type").notNull(), // foodics_report, network_report, other
  fileName: text("file_name").notNull(),
  fileData: text("file_data").notNull(), // Base64 encoded image
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"),
  notes: text("notes"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const insertJournalAttachmentSchema = createInsertSchema(
  journalAttachments,
).omit({
  id: true,
  uploadedAt: true,
});

export type JournalAttachment = typeof journalAttachments.$inferSelect;
export type InsertJournalAttachment = z.infer<
  typeof insertJournalAttachmentSchema
>;

// Discrepancy status labels
export const DISCREPANCY_STATUS = ["balanced", "shortage", "surplus"] as const;
export type DiscrepancyStatus = (typeof DISCREPANCY_STATUS)[number];

export const DISCREPANCY_STATUS_LABELS: Record<DiscrepancyStatus, string> = {
  balanced: "متوازن",
  shortage: "عجز",
  surplus: "زيادة",
};

// Journal status labels
export const JOURNAL_STATUS = [
  "draft",
  "posted",
  "submitted",
  "approved",
  "rejected",
] as const;
export type JournalStatus = (typeof JOURNAL_STATUS)[number];

export const JOURNAL_STATUS_LABELS: Record<JournalStatus, string> = {
  draft: "مسودة",
  posted: "مُرحَّل",
  submitted: "مقدم للمراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
};

// ==========================================
// نظام الأهداف والحوافز - Targets & Incentives System
// ==========================================

// Target Weight Profiles - ملفات توزيع الأوزان للأيام والمواسم
export const targetWeightProfiles = pgTable("target_weight_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true).notNull(),
  // Weekly weights (percentage multipliers)
  sundayWeight: real("sunday_weight").default(100).notNull(),
  mondayWeight: real("monday_weight").default(100).notNull(),
  tuesdayWeight: real("tuesday_weight").default(100).notNull(),
  wednesdayWeight: real("wednesday_weight").default(100).notNull(),
  thursdayWeight: real("thursday_weight").default(130).notNull(), // Higher for weekends
  fridayWeight: real("friday_weight").default(130).notNull(),
  saturdayWeight: real("saturday_weight").default(100).notNull(),
  // Seasonal adjustments (JSON array of {startDate, endDate, multiplier, name})
  seasonalAdjustments: jsonb("seasonal_adjustments"),
  // Holiday overrides (JSON array of {date, multiplier, name})
  holidayOverrides: jsonb("holiday_overrides"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTargetWeightProfileSchema = createInsertSchema(
  targetWeightProfiles,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TargetWeightProfile = typeof targetWeightProfiles.$inferSelect;
export type InsertTargetWeightProfile = z.infer<
  typeof insertTargetWeightProfileSchema
>;

// Branch Monthly Targets - الأهداف الشهرية للفروع
export const branchMonthlyTargets = pgTable("branch_monthly_targets", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  yearMonth: text("year_month").notNull(), // Format: "2025-01"
  targetAmount: real("target_amount").notNull(), // Total monthly target in SAR
  profileId: integer("profile_id").references(() => targetWeightProfiles.id),
  status: text("status").default("draft").notNull(), // draft, active, locked, archived
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBranchMonthlyTargetSchema = createInsertSchema(
  branchMonthlyTargets,
).omit({
  id: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type BranchMonthlyTarget = typeof branchMonthlyTargets.$inferSelect;
export type InsertBranchMonthlyTarget = z.infer<
  typeof insertBranchMonthlyTargetSchema
>;

// Target Daily Allocations - توزيع الهدف على الأيام
export const targetDailyAllocations = pgTable("target_daily_allocations", {
  id: serial("id").primaryKey(),
  monthlyTargetId: integer("monthly_target_id")
    .notNull()
    .references(() => branchMonthlyTargets.id, { onDelete: "cascade" }),
  targetDate: text("target_date").notNull(), // Format: "2025-01-15"
  weightPercent: real("weight_percent").notNull(), // Percentage weight for this day
  dailyTarget: real("daily_target").notNull(), // Calculated daily target amount
  isHoliday: boolean("is_holiday").default(false),
  isManualOverride: boolean("is_manual_override").default(false),
  overrideReason: text("override_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTargetDailyAllocationSchema = createInsertSchema(
  targetDailyAllocations,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TargetDailyAllocation = typeof targetDailyAllocations.$inferSelect;
export type InsertTargetDailyAllocation = z.infer<
  typeof insertTargetDailyAllocationSchema
>;

// Target Shift Allocations - توزيع الهدف على الورديات
export const targetShiftAllocations = pgTable("target_shift_allocations", {
  id: serial("id").primaryKey(),
  dailyAllocationId: integer("daily_allocation_id")
    .notNull()
    .references(() => targetDailyAllocations.id, { onDelete: "cascade" }),
  shiftType: text("shift_type").notNull(), // morning, evening, night
  shiftTarget: real("shift_target").notNull(), // Target amount for this shift
  shiftWeightPercent: real("shift_weight_percent").notNull(), // Percentage of daily target
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTargetShiftAllocationSchema = createInsertSchema(
  targetShiftAllocations,
).omit({
  id: true,
  createdAt: true,
});

export type TargetShiftAllocation = typeof targetShiftAllocations.$inferSelect;
export type InsertTargetShiftAllocation = z.infer<
  typeof insertTargetShiftAllocationSchema
>;

// Incentive Tiers - مستويات الحوافز
export const incentiveTiers = pgTable("incentive_tiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  minAchievementPercent: real("min_achievement_percent").notNull(), // e.g., 80%
  maxAchievementPercent: real("max_achievement_percent"), // e.g., 99.99%
  rewardType: text("reward_type").notNull(), // fixed, percentage, both
  fixedAmount: real("fixed_amount"), // Fixed bonus amount
  percentageRate: real("percentage_rate"), // Percentage of excess sales
  isActive: boolean("is_active").default(true).notNull(),
  applicableTo: text("applicable_to").default("all").notNull(), // all, cashier, branch
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIncentiveTierSchema = createInsertSchema(
  incentiveTiers,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type IncentiveTier = typeof incentiveTiers.$inferSelect;
export type InsertIncentiveTier = z.infer<typeof insertIncentiveTierSchema>;

// Incentive Awards - سجل المكافآت والحوافز الممنوحة
export const incentiveAwards = pgTable("incentive_awards", {
  id: serial("id").primaryKey(),
  awardType: text("award_type").notNull(), // daily, monthly, special
  branchId: varchar("branch_id").references(() => branches.id),
  cashierId: varchar("cashier_id").references(() => users.id),
  periodStart: text("period_start").notNull(), // Start date of achievement period
  periodEnd: text("period_end").notNull(), // End date of achievement period
  targetAmount: real("target_amount").notNull(),
  achievedAmount: real("achieved_amount").notNull(),
  achievementPercent: real("achievement_percent").notNull(),
  tierId: integer("tier_id").references(() => incentiveTiers.id),
  calculatedReward: real("calculated_reward").notNull(),
  adjustedReward: real("adjusted_reward"), // Manual adjustment if needed
  finalReward: real("final_reward").notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, paid, cancelled
  notes: text("notes"),
  journalIds: jsonb("journal_ids"), // Array of related cashier journal IDs
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertIncentiveAwardSchema = createInsertSchema(
  incentiveAwards,
).omit({
  id: true,
  approvedAt: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
});

export type IncentiveAward = typeof incentiveAwards.$inferSelect;
export type InsertIncentiveAward = z.infer<typeof insertIncentiveAwardSchema>;

// Seasons and Holidays - المواسم والإجازات
export const seasonsHolidays = pgTable("seasons_holidays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // اسم الموسم أو الإجازة
  type: text("type").notNull(), // islamic, international, national, season, custom
  category: text("category"), // eid, national_day, mothers_day, valentines, ramadan, etc.
  startDate: text("start_date").notNull(), // Format: "2025-01-15"
  endDate: text("end_date").notNull(),
  color: text("color").default("#f59e0b"), // Badge color hex code
  icon: text("icon"), // Icon name from lucide
  weightMultiplier: real("weight_multiplier").default(1.0).notNull(), // 1.5 for 150% target
  applicableBranches: jsonb("applicable_branches"), // Array of branch IDs or null for all
  description: text("description"),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"), // yearly, monthly, etc.
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSeasonHolidaySchema = createInsertSchema(
  seasonsHolidays,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SeasonHoliday = typeof seasonsHolidays.$inferSelect;
export type InsertSeasonHoliday = z.infer<typeof insertSeasonHolidaySchema>;

// Commission Rates - معدلات العمولات
export const commissionRates = pgTable("commission_rates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // اسم نظام العمولة
  description: text("description"),
  minSalesAmount: real("min_sales_amount").default(0), // الحد الأدنى للمبيعات
  maxSalesAmount: real("max_sales_amount"), // الحد الأقصى للمبيعات (null = unlimited)
  commissionType: text("commission_type").notNull(), // fixed, percentage, tiered
  fixedAmount: real("fixed_amount"), // مبلغ ثابت
  percentageRate: real("percentage_rate"), // نسبة من المبيعات
  applicableTo: text("applicable_to").default("cashier").notNull(), // cashier, branch, all
  applicableBranches: jsonb("applicable_branches"), // Array of branch IDs or null for all
  isActive: boolean("is_active").default(true).notNull(),
  validFrom: text("valid_from"),
  validTo: text("valid_to"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCommissionRateSchema = createInsertSchema(
  commissionRates,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CommissionRate = typeof commissionRates.$inferSelect;
export type InsertCommissionRate = z.infer<typeof insertCommissionRateSchema>;

// Commission Calculations - حسابات العمولات
export const commissionCalculations = pgTable("commission_calculations", {
  id: serial("id").primaryKey(),
  cashierId: varchar("cashier_id").references(() => users.id),
  branchId: varchar("branch_id").references(() => branches.id),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  totalSales: real("total_sales").notNull(),
  targetAmount: real("target_amount"),
  achievementPercent: real("achievement_percent"),
  rateId: integer("rate_id").references(() => commissionRates.id),
  calculatedCommission: real("calculated_commission").notNull(),
  adjustedCommission: real("adjusted_commission"),
  finalCommission: real("final_commission").notNull(),
  status: text("status").default("pending").notNull(), // pending, approved, paid
  journalIds: jsonb("journal_ids"),
  notes: text("notes"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCommissionCalculationSchema = createInsertSchema(
  commissionCalculations,
).omit({
  id: true,
  approvedAt: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
});

export type CommissionCalculation = typeof commissionCalculations.$inferSelect;
export type InsertCommissionCalculation = z.infer<
  typeof insertCommissionCalculationSchema
>;

// Target Status Labels
export const TARGET_STATUS = ["draft", "active", "locked", "archived"] as const;
export type TargetStatus = (typeof TARGET_STATUS)[number];

export const TARGET_STATUS_LABELS: Record<TargetStatus, string> = {
  draft: "مسودة",
  active: "نشط",
  locked: "مُقفل",
  archived: "مؤرشف",
};

// Reward Types Labels
export const REWARD_TYPES = ["fixed", "percentage", "both"] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  fixed: "مبلغ ثابت",
  percentage: "نسبة مئوية",
  both: "ثابت + نسبة",
};

// Award Status Labels
export const AWARD_STATUS = [
  "pending",
  "approved",
  "paid",
  "cancelled",
] as const;
export type AwardStatus = (typeof AWARD_STATUS)[number];

export const AWARD_STATUS_LABELS: Record<AwardStatus, string> = {
  pending: "قيد الانتظار",
  approved: "معتمد",
  paid: "مدفوع",
  cancelled: "ملغى",
};

// ==========================================
// Sales Analytics Tables - جداول التحليلات
// ==========================================

// Daily Sales Summary per Branch - ملخص المبيعات اليومية
export const branchDailySales = pgTable("branch_daily_sales", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  salesDate: text("sales_date").notNull(), // YYYY-MM-DD
  totalSales: real("total_sales").default(0).notNull(),
  transactionsCount: integer("transactions_count").default(0),
  averageTicket: real("average_ticket").default(0),
  cashierCount: integer("cashier_count").default(0),
  // Target comparison
  targetAmount: real("target_amount").default(0),
  achievementAmount: real("achievement_amount").default(0), // Difference from target
  achievementPercent: real("achievement_percent").default(0),
  // Shift breakdown
  morningShiftSales: real("morning_shift_sales").default(0),
  eveningShiftSales: real("evening_shift_sales").default(0),
  nightShiftSales: real("night_shift_sales").default(0),
  // Metadata
  journalIds: jsonb("journal_ids"), // Array of related journal IDs
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBranchDailySalesSchema = createInsertSchema(
  branchDailySales,
).omit({
  id: true,
  computedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type BranchDailySales = typeof branchDailySales.$inferSelect;
export type InsertBranchDailySales = z.infer<
  typeof insertBranchDailySalesSchema
>;

// Cashier Shift Performance - أداء الكاشير في الشفت
export const cashierShiftPerformance = pgTable("cashier_shift_performance", {
  id: serial("id").primaryKey(),
  journalId: integer("journal_id").references(() => cashierSalesJournals.id),
  cashierId: varchar("cashier_id")
    .notNull()
    .references(() => users.id),
  cashierName: text("cashier_name").notNull(),
  shiftId: integer("shift_id").references(() => shifts.id),
  shiftType: text("shift_type").notNull(), // morning, evening, night
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  performanceDate: text("performance_date").notNull(), // YYYY-MM-DD
  // Sales metrics
  salesAmount: real("sales_amount").default(0).notNull(),
  transactionsCount: integer("transactions_count").default(0),
  averageTicket: real("average_ticket").default(0),
  customerCount: integer("customer_count").default(0),
  // Target metrics
  targetShare: real("target_share").default(0), // Expected share of daily target
  achievementPercent: real("achievement_percent").default(0),
  // Cash handling
  discrepancyAmount: real("discrepancy_amount").default(0),
  discrepancyStatus: text("discrepancy_status").default("balanced"),
  // Rankings (computed)
  branchRank: integer("branch_rank"), // Rank among cashiers in same branch/day
  shiftRank: integer("shift_rank"), // Rank among cashiers in same shift
  // Metadata
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCashierShiftPerformanceSchema = createInsertSchema(
  cashierShiftPerformance,
).omit({
  id: true,
  computedAt: true,
  createdAt: true,
});

export type CashierShiftPerformance =
  typeof cashierShiftPerformance.$inferSelect;
export type InsertCashierShiftPerformance = z.infer<
  typeof insertCashierShiftPerformanceSchema
>;

// Shift Type Labels
export const SHIFT_TYPES = ["morning", "evening", "night"] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  morning: "صباحي",
  evening: "مسائي",
  night: "ليلي",
};

// Display Bar Receipts - استلام الإنتاج لبار العرض
export const displayBarReceipts = pgTable("display_bar_receipts", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  receiptDate: text("receipt_date").notNull(), // YYYY-MM-DD
  receiptTime: text("receipt_time").notNull(), // HH:MM
  shiftId: integer("shift_id").references(() => shifts.id),
  quantity: integer("quantity").notNull(),
  receivedBy: varchar("received_by").references(() => users.id),
  productionBatch: text("production_batch"), // رقم دفعة الإنتاج
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDisplayBarReceiptSchema = createInsertSchema(
  displayBarReceipts,
).omit({
  id: true,
  createdAt: true,
});

export type DisplayBarReceipt = typeof displayBarReceipts.$inferSelect;
export type InsertDisplayBarReceipt = z.infer<
  typeof insertDisplayBarReceiptSchema
>;

// Display Bar Daily Summary - ملخص بار العرض اليومي
export const displayBarDailySummary = pgTable("display_bar_daily_summary", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  summaryDate: text("summary_date").notNull(), // YYYY-MM-DD
  openingQuantity: integer("opening_quantity").default(0).notNull(), // الكمية الافتتاحية
  receivedQuantity: integer("received_quantity").default(0).notNull(), // الكمية المستلمة
  soldQuantity: integer("sold_quantity").default(0).notNull(), // الكمية المباعة
  wastedQuantity: integer("wasted_quantity").default(0).notNull(), // الكمية التالفة
  closingQuantity: integer("closing_quantity").default(0).notNull(), // الكمية الختامية
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDisplayBarDailySummarySchema = createInsertSchema(
  displayBarDailySummary,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DisplayBarDailySummary = typeof displayBarDailySummary.$inferSelect;
export type InsertDisplayBarDailySummary = z.infer<
  typeof insertDisplayBarDailySummarySchema
>;

// Waste Reports - تقارير الهالك
export const wasteReports = pgTable("waste_reports", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  reportDate: text("report_date").notNull(), // YYYY-MM-DD
  shiftId: integer("shift_id").references(() => shifts.id),
  shiftName: text("shift_name"), // morning, evening, night - اسم الوردية
  reportedBy: varchar("reported_by").references(() => users.id),
  reporterName: text("reporter_name"),
  totalItems: integer("total_items").default(0).notNull(),
  totalValue: real("total_value").default(0),
  status: text("status").default("draft").notNull(), // draft, submitted, approved, rejected
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWasteReportSchema = createInsertSchema(wasteReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WasteReport = typeof wasteReports.$inferSelect;
export type InsertWasteReport = z.infer<typeof insertWasteReportSchema>;

// Waste Items - تفاصيل الهالك
export const wasteItems = pgTable("waste_items", {
  id: serial("id").primaryKey(),
  wasteReportId: integer("waste_report_id")
    .notNull()
    .references(() => wasteReports.id, { onDelete: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").default(0),
  totalValue: real("total_value").default(0),
  wasteReason: text("waste_reason").notNull(), // expired, damaged, quality_issue, other
  reasonDetails: text("reason_details"),
  imageUrl: text("image_url"), // صورة المنتج التالف
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWasteItemSchema = createInsertSchema(wasteItems).omit({
  id: true,
  createdAt: true,
});

export type WasteItem = typeof wasteItems.$inferSelect;
export type InsertWasteItem = z.infer<typeof insertWasteItemSchema>;

// Waste Reasons Labels
export const WASTE_REASONS = [
  "expired",
  "damaged",
  "quality_issue",
  "overproduction",
  "other",
] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

export const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  expired: "منتهي الصلاحية",
  damaged: "تالف",
  quality_issue: "مشكلة جودة",
  overproduction: "إنتاج زائد",
  other: "أخرى",
};

// Product Categories for Display Bar
export const DISPLAY_BAR_CATEGORIES = [
  "bakery",
  "dessert",
  "breakfast",
  "sandwich",
] as const;
export type DisplayBarCategory = (typeof DISPLAY_BAR_CATEGORIES)[number];

export const DISPLAY_BAR_CATEGORY_LABELS: Record<DisplayBarCategory, string> = {
  bakery: "مخبوزات",
  dessert: "حلويات",
  breakfast: "فطور",
  sandwich: "ساندويتش",
};

// ==================== Advanced Production Orders Module ====================

// Production Order Types
export const PRODUCTION_ORDER_TYPES = ["daily", "weekly", "long_term"] as const;
export type ProductionOrderType = (typeof PRODUCTION_ORDER_TYPES)[number];

export const PRODUCTION_ORDER_TYPE_LABELS: Record<ProductionOrderType, string> =
  {
    daily: "يومي (فرش)",
    weekly: "أسبوعي",
    long_term: "طويل الأمد",
  };

// Production Order Priorities
export const PRODUCTION_PRIORITIES = [
  "urgent",
  "high",
  "normal",
  "low",
] as const;
export type ProductionPriority = (typeof PRODUCTION_PRIORITIES)[number];

export const PRODUCTION_PRIORITY_LABELS: Record<ProductionPriority, string> = {
  urgent: "عاجل جداً",
  high: "عالي",
  normal: "عادي",
  low: "منخفض",
};

// Production Order Statuses
export const PRODUCTION_ORDER_STATUSES = [
  "draft",
  "pending",
  "approved",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type ProductionOrderStatus = (typeof PRODUCTION_ORDER_STATUSES)[number];

export const PRODUCTION_ORDER_STATUS_LABELS: Record<
  ProductionOrderStatus,
  string
> = {
  draft: "مسودة",
  pending: "قيد الانتظار",
  approved: "معتمد",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
};

// Advanced Production Orders - أوامر الإنتاج المتقدمة
export const advancedProductionOrders = pgTable("advanced_production_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").unique().notNull(),
  orderType: text("order_type").default("daily").notNull(), // daily, weekly, long_term
  sourceBranchId: varchar("source_branch_id")
    .notNull()
    .references(() => branches.id), // الفرع المُرسِل
  targetBranchId: varchar("target_branch_id")
    .notNull()
    .references(() => branches.id), // الفرع المُستهدف
  targetDepartment: text("target_department"), // القسم المستهدف (مخبز، بسترى، ساندويتش، إلخ)
  title: text("title").notNull(), // عنوان الأمر
  description: text("description"),
  status: text("status").default("draft").notNull(),
  priority: text("priority").default("normal").notNull(),
  startDate: text("start_date").notNull(), // تاريخ البداية
  endDate: text("end_date").notNull(), // تاريخ النهاية (نفس تاريخ البداية للأوامر اليومية)
  targetSalesValue: real("target_sales_value"), // قيمة المبيعات المستهدفة (للذكاء الاصطناعي)
  estimatedCost: real("estimated_cost").default(0),
  actualCost: real("actual_cost").default(0),
  totalItems: integer("total_items").default(0),
  completedItems: integer("completed_items").default(0),
  completionPercent: real("completion_percent").default(0),
  isAiGenerated: boolean("is_ai_generated").default(false),
  aiPlanId: integer("ai_plan_id"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAdvancedProductionOrderSchema = createInsertSchema(
  advancedProductionOrders,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});

export type AdvancedProductionOrder =
  typeof advancedProductionOrders.$inferSelect;
export type InsertAdvancedProductionOrder = z.infer<
  typeof insertAdvancedProductionOrderSchema
>;

// Production Order Items - عناصر أمر الإنتاج
export const productionOrderItems = pgTable("production_order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => advancedProductionOrders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  productCategory: text("product_category"),
  targetQuantity: integer("target_quantity").notNull(),
  producedQuantity: integer("produced_quantity").default(0),
  wastedQuantity: integer("wasted_quantity").default(0),
  unitPrice: real("unit_price").default(0), // سعر الوحدة
  totalValue: real("total_value").default(0), // القيمة الإجمالية
  scheduledDate: text("scheduled_date"), // تاريخ الإنتاج المجدول
  scheduledShift: text("scheduled_shift"), // الوردية المجدولة (morning, evening, night)
  status: text("status").default("pending").notNull(), // pending, in_progress, completed, cancelled
  assignedTo: text("assigned_to"), // الموظف المسؤول
  priority: integer("priority").default(0), // ترتيب الأولوية
  salesVelocity: real("sales_velocity"), // سرعة البيع (للذكاء الاصطناعي)
  notes: text("notes"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductionOrderItemSchema = createInsertSchema(
  productionOrderItems,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  startedAt: true,
  completedAt: true,
});

export type ProductionOrderItem = typeof productionOrderItems.$inferSelect;
export type InsertProductionOrderItem = z.infer<
  typeof insertProductionOrderItemSchema
>;

// Production Order Schedule - جدولة أوامر الإنتاج (للأوامر طويلة الأمد)
export const productionOrderSchedules = pgTable("production_order_schedules", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => advancedProductionOrders.id, { onDelete: "cascade" }),
  scheduledDate: text("scheduled_date").notNull(),
  dayOfWeek: text("day_of_week"), // saturday, sunday, monday, etc.
  shift: text("shift"), // morning, evening, night
  targetQuantity: integer("target_quantity").default(0),
  completedQuantity: integer("completed_quantity").default(0),
  status: text("status").default("pending").notNull(),
  assignedDepartment: text("assigned_department"),
  assignedEmployees: text("assigned_employees"), // JSON array of employee names
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductionOrderScheduleSchema = createInsertSchema(
  productionOrderSchedules,
).omit({
  id: true,
  createdAt: true,
});

export type ProductionOrderSchedule =
  typeof productionOrderSchedules.$inferSelect;
export type InsertProductionOrderSchedule = z.infer<
  typeof insertProductionOrderScheduleSchema
>;

// Production AI Plans - خطط الذكاء الاصطناعي
export const productionAiPlans = pgTable("production_ai_plans", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  planName: text("plan_name").notNull(),
  targetSalesValue: real("target_sales_value").notNull(), // قيمة المبيعات المستهدفة
  planDate: text("plan_date").notNull(),
  datasetId: integer("dataset_id"), // مرجع لمجموعة البيانات المستخدمة
  algorithmVersion: text("algorithm_version").default("v1.0"),
  confidenceScore: real("confidence_score").default(0), // نسبة الثقة 0-100
  recommendedProducts: jsonb("recommended_products"), // JSON array of product recommendations
  totalEstimatedValue: real("total_estimated_value").default(0),
  totalEstimatedCost: real("total_estimated_cost").default(0),
  profitMargin: real("profit_margin").default(0),
  status: text("status").default("generated").notNull(), // generated, reviewed, approved, applied, rejected
  appliedToOrderId: integer("applied_to_order_id"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductionAiPlanSchema = createInsertSchema(
  productionAiPlans,
).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});

export type ProductionAiPlan = typeof productionAiPlans.$inferSelect;
export type InsertProductionAiPlan = z.infer<
  typeof insertProductionAiPlanSchema
>;

// Sales Data Uploads - رفع بيانات المبيعات
export const salesDataUploads = pgTable("sales_data_uploads", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").default("excel"), // excel, csv
  fileSize: integer("file_size"),
  periodStart: text("period_start"), // بداية فترة البيانات
  periodEnd: text("period_end"), // نهاية فترة البيانات
  totalRecords: integer("total_records").default(0),
  totalSalesValue: real("total_sales_value").default(0),
  uniqueProducts: integer("unique_products").default(0),
  parsedData: jsonb("parsed_data"), // البيانات المحللة
  productVelocity: jsonb("product_velocity"), // سرعة بيع المنتجات
  status: text("status").default("pending").notNull(), // pending, processing, completed, failed
  errorMessage: text("error_message"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSalesDataUploadSchema = createInsertSchema(
  salesDataUploads,
).omit({
  id: true,
  createdAt: true,
});

export type SalesDataUpload = typeof salesDataUploads.$inferSelect;
export type InsertSalesDataUpload = z.infer<typeof insertSalesDataUploadSchema>;

// Product Sales Analytics - تحليلات مبيعات المنتجات (من البيانات المرفوعة)
export const productSalesAnalytics = pgTable("product_sales_analytics", {
  id: serial("id").primaryKey(),
  uploadId: integer("upload_id")
    .notNull()
    .references(() => salesDataUploads.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  productCategory: text("product_category"),
  totalQuantitySold: integer("total_quantity_sold").default(0),
  totalRevenue: real("total_revenue").default(0),
  averageDailySales: real("average_daily_sales").default(0),
  salesVelocity: real("sales_velocity").default(0), // سرعة البيع (نسبة)
  profitMargin: real("profit_margin").default(0),
  peakHours: text("peak_hours"), // ساعات الذروة (JSON)
  weekdayPattern: text("weekday_pattern"), // نمط أيام الأسبوع (JSON)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductSalesAnalyticsSchema = createInsertSchema(
  productSalesAnalytics,
).omit({
  id: true,
  createdAt: true,
});

export type ProductSalesAnalytics = typeof productSalesAnalytics.$inferSelect;
export type InsertProductSalesAnalytics = z.infer<
  typeof insertProductSalesAnalyticsSchema
>;

// Daily Production Batches - دفعات الإنتاج الفعلي اليومي
export const dailyProductionBatches = pgTable("daily_production_batches", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  productCategory: text("product_category"),
  quantity: integer("quantity").notNull(),
  unit: text("unit").default("قطعة"),
  destination: text("destination").notNull(), // display_bar, kitchen_trolley, freezer, refrigerator
  shiftId: integer("shift_id").references(() => shifts.id),
  productionOrderId: integer("production_order_id"),
  producedAt: timestamp("produced_at").defaultNow().notNull(),
  recordedBy: varchar("recorded_by").references(() => users.id),
  recorderName: text("recorder_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDailyProductionBatchSchema = createInsertSchema(
  dailyProductionBatches,
).omit({
  id: true,
  createdAt: true,
});

export type DailyProductionBatch = typeof dailyProductionBatches.$inferSelect;
export type InsertDailyProductionBatch = z.infer<
  typeof insertDailyProductionBatchSchema
>;

// ==================== نظام الصلاحيات والمستخدمين الشامل ====================

// Departments - الأقسام (مثل: الإنتاج، المخزون، الكاشير، الصيانة، المشاريع)
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // اسم القسم بالعربي
  code: varchar("code", { length: 50 }).unique().notNull(), // كود فريد: production, inventory, cashier, maintenance, projects
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

// Roles - الأدوار (مثل: مدير عام، مدير فرع، مشرف قسم، موظف)
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // اسم الدور بالعربي
  slug: varchar("slug", { length: 50 }).unique().notNull(), // super_admin, branch_manager, dept_head, employee, viewer
  hierarchyLevel: integer("hierarchy_level").notNull().default(0), // 0 = أعلى مستوى
  description: text("description"),
  isSystemDefault: boolean("is_system_default").default(false).notNull(), // أدوار النظام الأساسية
  inheritsFromRoleId: integer("inherits_from_role_id"), // يرث صلاحيات من دور آخر
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;

// Permissions - الصلاحيات (تعريف كل صلاحية ممكنة في النظام)
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  module: varchar("module", { length: 100 }).notNull(), // inventory, production, cashier, assets, projects, etc.
  action: varchar("action", { length: 50 }).notNull(), // view, create, edit, delete, export, approve
  name: text("name").notNull(), // اسم الصلاحية بالعربي
  description: text("description"),
  isDefault: boolean("is_default").default(false).notNull(), // صلاحيات افتراضية
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

// Role Permissions - صلاحيات كل دور
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id")
    .notNull()
    .references(() => permissions.id, { onDelete: "cascade" }),
  scope: jsonb("scope"), // للتوسع المستقبلي: {"branches": ["all"], "departments": ["all"]}
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;

// User Assignments - تعيينات المستخدمين (ربط المستخدم بدور وفرع وقسم)
export const userAssignments = pgTable("user_assignments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  roleId: integer("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  branchId: varchar("branch_id").references(() => branches.id, { onDelete: "set null" }), // null = جميع الفروع
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }), // null = جميع الأقسام
  scopeType: varchar("scope_type", { length: 20 }).notNull().default("branch"), // global, branch, department
  isPrimary: boolean("is_primary").default(true).notNull(), // التعيين الأساسي للمستخدم
  isActive: boolean("is_active").default(true).notNull(),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date"), // للتعيينات المؤقتة
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserAssignmentSchema = createInsertSchema(userAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserAssignment = typeof userAssignments.$inferSelect;
export type InsertUserAssignment = z.infer<typeof insertUserAssignmentSchema>;

// User Permission Overrides - تجاوزات صلاحيات المستخدم (منح أو منع صلاحية خاصة)
export const userPermissionOverrides = pgTable("user_permission_overrides", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id")
    .notNull()
    .references(() => permissions.id, { onDelete: "cascade" }),
  allow: boolean("allow").notNull(), // true = منح، false = منع
  branchId: varchar("branch_id").references(() => branches.id, { onDelete: "set null" }), // صلاحية لفرع معين فقط
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }),
  reason: text("reason"), // سبب التجاوز
  grantedBy: varchar("granted_by").references(() => users.id),
  expiresAt: timestamp("expires_at"), // صلاحية مؤقتة
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserPermissionOverrideSchema = createInsertSchema(userPermissionOverrides).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
export type InsertUserPermissionOverride = z.infer<typeof insertUserPermissionOverrideSchema>;

// User Branch Access - وصول المستخدم للفروع (للمستخدمين متعددي الفروع)
export const userBranchAccess = pgTable("user_branch_access", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  accessLevel: varchar("access_level", { length: 20 }).notNull().default("full"), // full, view_only, limited
  isDefault: boolean("is_default").default(false).notNull(), // الفرع الافتراضي
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserBranchAccessSchema = createInsertSchema(userBranchAccess).omit({
  id: true,
  createdAt: true,
});

export type UserBranchAccess = typeof userBranchAccess.$inferSelect;
export type InsertUserBranchAccess = z.infer<typeof insertUserBranchAccessSchema>;

// ==========================================
// نظام أهداف الشفت والكاشير - Shift & Cashier Targets
// ==========================================

// Cashier Shift Targets - أهداف الكاشير داخل الشفت
export const cashierShiftTargets = pgTable("cashier_shift_targets", {
  id: serial("id").primaryKey(),
  shiftAllocationId: integer("shift_allocation_id")
    .references(() => targetShiftAllocations.id, { onDelete: "cascade" }),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  cashierId: varchar("cashier_id")
    .notNull()
    .references(() => users.id),
  targetDate: text("target_date").notNull(), // YYYY-MM-DD
  shiftType: text("shift_type").notNull(), // morning, evening, night
  cashierRole: text("cashier_role").default("main").notNull(), // main, assistant
  targetAmount: real("target_amount").notNull(), // هدف المبيعات
  targetTicketValue: real("target_ticket_value"), // هدف متوسط الفاتورة
  targetTransactions: integer("target_transactions"), // عدد المعاملات المستهدف
  shiftStartTime: text("shift_start_time"), // وقت بدء الشفت HH:MM
  shiftEndTime: text("shift_end_time"), // وقت انتهاء الشفت HH:MM
  shiftDurationHours: real("shift_duration_hours"), // مدة الشفت بالساعات
  // Alert thresholds
  alertThresholdPercent: real("alert_threshold_percent").default(80), // تنبيه عند الوصول لهذه النسبة
  belowTrackThreshold: real("below_track_threshold").default(70), // تحذير التأخر عن المسار
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCashierShiftTargetSchema = createInsertSchema(cashierShiftTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CashierShiftTarget = typeof cashierShiftTargets.$inferSelect;
export type InsertCashierShiftTarget = z.infer<typeof insertCashierShiftTargetSchema>;

// Average Ticket Targets - أهداف متوسط الفاتورة
export const averageTicketTargets = pgTable("average_ticket_targets", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .references(() => branches.id),
  cashierId: varchar("cashier_id")
    .references(() => users.id),
  shiftType: text("shift_type"), // morning, evening, night, or null for all
  targetType: text("target_type").notNull(), // branch, cashier, shift
  targetValue: real("target_value").notNull(), // القيمة المستهدفة لمتوسط الفاتورة
  minAcceptable: real("min_acceptable"), // الحد الأدنى المقبول
  bonusThreshold: real("bonus_threshold"), // عتبة المكافأة
  bonusPerRiyal: real("bonus_per_riyal"), // مكافأة لكل ريال فوق الهدف
  validFrom: text("valid_from").notNull(), // تاريخ البدء
  validTo: text("valid_to"), // تاريخ الانتهاء
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAverageTicketTargetSchema = createInsertSchema(averageTicketTargets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AverageTicketTarget = typeof averageTicketTargets.$inferSelect;
export type InsertAverageTicketTarget = z.infer<typeof insertAverageTicketTargetSchema>;

// Performance Alerts - تنبيهات الأداء الفورية
export const performanceAlerts = pgTable("performance_alerts", {
  id: serial("id").primaryKey(),
  alertType: text("alert_type").notNull(), // shift_behind, shift_ahead, cashier_behind, cashier_ahead, ticket_low
  severity: text("severity").notNull(), // info, warning, critical, success
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  cashierId: varchar("cashier_id")
    .references(() => users.id),
  shiftType: text("shift_type"), // morning, evening, night
  alertDate: text("alert_date").notNull(), // YYYY-MM-DD
  alertTime: text("alert_time").notNull(), // HH:MM:SS
  targetAmount: real("target_amount"),
  currentAmount: real("current_amount"),
  achievementPercent: real("achievement_percent"),
  message: text("message").notNull(),
  messageAr: text("message_ar"), // الرسالة بالعربية
  isRead: boolean("is_read").default(false).notNull(),
  isAcknowledged: boolean("is_acknowledged").default(false).notNull(),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  metadata: jsonb("metadata"), // بيانات إضافية
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPerformanceAlertSchema = createInsertSchema(performanceAlerts).omit({
  id: true,
  acknowledgedAt: true,
  createdAt: true,
});

export type PerformanceAlert = typeof performanceAlerts.$inferSelect;
export type InsertPerformanceAlert = z.infer<typeof insertPerformanceAlertSchema>;

// Real-time Shift Performance Tracking - تتبع أداء الشفت المباشر
export const shiftPerformanceTracking = pgTable("shift_performance_tracking", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  trackingDate: text("tracking_date").notNull(), // YYYY-MM-DD
  shiftType: text("shift_type").notNull(), // morning, evening, night
  shiftStartTime: text("shift_start_time").notNull(), // HH:MM
  shiftEndTime: text("shift_end_time"), // HH:MM (null if ongoing)
  // Target metrics
  shiftTargetAmount: real("shift_target_amount").notNull(),
  expectedAtCurrentTime: real("expected_at_current_time").default(0), // المتوقع حتى الآن
  // Actual metrics
  currentSalesAmount: real("current_sales_amount").default(0).notNull(),
  currentTransactions: integer("current_transactions").default(0),
  currentAverageTicket: real("current_average_ticket").default(0),
  currentCashierCount: integer("current_cashier_count").default(0),
  // Performance indicators
  achievementPercent: real("achievement_percent").default(0),
  progressStatus: text("progress_status").default("on_track"), // on_track, behind, ahead, critical
  estimatedEndAmount: real("estimated_end_amount").default(0), // التقدير للنهاية
  // Cashier breakdown
  topCashierId: varchar("top_cashier_id").references(() => users.id),
  topCashierSales: real("top_cashier_sales").default(0),
  lowestCashierId: varchar("lowest_cashier_id").references(() => users.id),
  lowestCashierSales: real("lowest_cashier_sales").default(0),
  // Timestamps
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertShiftPerformanceTrackingSchema = createInsertSchema(shiftPerformanceTracking).omit({
  id: true,
  lastUpdatedAt: true,
  createdAt: true,
});

export type ShiftPerformanceTracking = typeof shiftPerformanceTracking.$inferSelect;
export type InsertShiftPerformanceTracking = z.infer<typeof insertShiftPerformanceTrackingSchema>;

// Performance Alert Types
export const PERFORMANCE_ALERT_TYPES = [
  "shift_behind",
  "shift_ahead", 
  "cashier_behind",
  "cashier_ahead",
  "ticket_low",
  "ticket_high",
  "target_achieved",
  "target_exceeded",
] as const;
export type PerformanceAlertType = (typeof PERFORMANCE_ALERT_TYPES)[number];

export const PERFORMANCE_ALERT_LABELS: Record<PerformanceAlertType, string> = {
  shift_behind: "الشفت متأخر عن الهدف",
  shift_ahead: "الشفت متقدم على الهدف",
  cashier_behind: "الكاشير متأخر",
  cashier_ahead: "الكاشير متقدم",
  ticket_low: "متوسط الفاتورة منخفض",
  ticket_high: "متوسط الفاتورة مرتفع",
  target_achieved: "تم تحقيق الهدف",
  target_exceeded: "تم تجاوز الهدف",
};

// Progress Status Types
export const PROGRESS_STATUS = ["on_track", "behind", "ahead", "critical"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUS)[number];

export const PROGRESS_STATUS_LABELS: Record<ProgressStatus, string> = {
  on_track: "في المسار",
  behind: "متأخر",
  ahead: "متقدم",
  critical: "حرج",
};

// Cashier Role Types
export const CASHIER_ROLES = ["main", "assistant", "trainee"] as const;
export type CashierRole = (typeof CASHIER_ROLES)[number];

export const CASHIER_ROLE_LABELS: Record<CashierRole, string> = {
  main: "كاشير رئيسي",
  assistant: "كاشير مساعد",
  trainee: "متدرب",
};
