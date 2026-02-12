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
  uniqueIndex,
  unique,
  jsonb,
  boolean,
  doublePrecision,
  date,
  numeric,
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
  role: varchar("role").default("viewer").notNull(), // admin, employee, viewer, attendance_clerk
  branchId: varchar("branch_id").references(() => branches.id),
  jobTitle: varchar("job_title"),
  isActive: text("is_active").default("active"), // active, inactive
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_branch_id").on(table.branchId),
  index("idx_users_role").on(table.role),
]);

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
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  locationRadius: integer("location_radius").default(200),
  address: text("address"),
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
}, (table) => [
  index("idx_inventory_branch").on(table.branchId),
  index("idx_inventory_category").on(table.category),
  index("idx_inventory_status").on(table.status),
]);

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
}, (table) => [
  index("idx_audit_logs_item_id").on(table.itemId),
  index("idx_audit_logs_created_at").on(table.createdAt),
]);

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
  targetId: text("target_id"), // Target entity ID for security/RBAC actions
  description: text("description"), // Human-readable description of the action
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_system_audit_logs_module").on(table.module),
  index("idx_system_audit_logs_entity_id").on(table.entityId),
  index("idx_system_audit_logs_created_at").on(table.createdAt),
]);

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
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'failed', 'in_progress', 'restoring'
  fileSize: integer("file_size"),
  filePath: text("file_path"),
  tables: text("tables"), // JSON array of backed up table names
  tableCount: integer("table_count"),
  rowCount: integer("row_count"),
  backupData: text("backup_data"), // JSON string of actual backup data
  errorMessage: text("error_message"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  restoredAt: timestamp("restored_at"),
  restoredBy: varchar("restored_by"),
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
}, (table) => [
  index("idx_projects_branch").on(table.branchId),
  index("idx_projects_status").on(table.status),
]);

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
}, (table) => [
  index("idx_work_items_project").on(table.projectId),
  index("idx_work_items_status").on(table.status),
]);

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

// System Modules for permissions - جميع وحدات النظام
export const SYSTEM_MODULES = [
  // الأساسية
  "dashboard",
  "platform_home",
  "settings",
  
  // المخزون والأصول
  "inventory",
  "asset_transfers",
  "inspections",
  "maintenance",
  
  // الإنتاج والتشغيل
  "production",
  "daily_production",
  "advanced_production",
  "quality_control",
  "quality", // اسم مختصر للتوافق
  "products",
  "operations",
  "ai_production_planner",
  
  // الورديات والحضور
  "shifts",
  "attendance",
  "attendance_check", // صفحة تسجيل الحضور والانصراف فقط
  "biometric_settings", // إعدادات البصمة والتحقق البيومتري
  "timesheet",
  "branch_closure",
  
  // الموظفين والموارد البشرية
  "users",
  "branch_employees",
  "branches",
  "organizational_structure",
  "employee_reports",
  "employee_transfers",
  "hr_management",
  
  // المالية
  "cashier_journal",
  "cashier_performance",
  "cashier", // اسم مختصر للتوافق
  "daily_closures", // الإغلاقات اليومية للفروع - وحدة مستقلة عن يومية الكاشير
  "pnl_dashboard",
  "incentives",
  "sales_analytics",
  "sales_uploads",
  
  // الحوافز الذكية
  "smart_incentives_settings",
  "smart_incentives_challenges",
  "smart_incentives_commissions",
  "smart_incentives_bonus",
  "smart_incentives_wallet",
  "smart_incentives_statements",
  
  // الأهداف والأداء
  "targets",
  "targets_planning",
  "waste_tracking",
  "waste", // اسم مختصر للتوافق
  
  // مشاريع الإنشاء
  "construction_projects",
  "construction_work_items",
  "construction_reports",
  "construction", // اسم مختصر للتوافق
  "contractors",
  "contracts",
  "budget_planning",
  "payment_requests",
  
  // التسويق
  "marketing",
  "marketing_campaigns",
  "marketing_influencers",
  "marketing_tasks",
  "marketing_goals",
  "marketing_calendar",
  "marketing_alerts",
  "marketing_assets",
  "marketing_expenses",
  "marketing_reports",
  "marketing_team",
  "social_responsibility",
  
  // إدارة النظام
  "rbac_management",
  "audit_logs",
  "backups",
  "integrations",
  "reports",
  
  // المخازن والتحويلات
  "warehouse",
  "material_requests",
  "transfer_requests",
  "warehouse_inventory",
  
  // السكرتارية التنفيذية
  "executive_dashboard",
  "executive_meetings",
  "executive_tasks",
  "executive_correspondence",
  "executive_documents",
  "executive_visitors",
  "executive_travel",
  "executive_reports",
  "executive_notifications",
  "executive_calendar",
  
  // إدارة الوثائق
  "documents",
  
  // الحوكمة المؤسسية
  "governance",
  "governance_board",
  "governance_shareholders",
  "governance_meetings",
  "governance_resolutions",
  "governance_compliance",
  "governance_transfers",
  "governance_disclosures",
  "governance_dividends",
  "governance_capital",
  "governance_voting",
] as const;

export type SystemModule = (typeof SYSTEM_MODULES)[number];

// Actions for each module
export const MODULE_ACTIONS = [
  "view",
  "view_list",
  "view_details",
  "create",
  "edit",
  "delete",
  "submit",
  "approve",
  "reject",
  "reopen",
  "export",
  "print",
  "sign",
  "view_signatures",
  "manage_attachments",
  "notify",
  "change_status",
  "assign_reviewer",
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
}, (table) => [
  index("idx_user_permissions_user_id").on(table.userId),
  index("idx_user_permissions_module").on(table.module),
  index("idx_user_permissions_user_module").on(table.userId, table.module),
]);

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
  // الأساسية
  dashboard: "لوحة التحكم",
  platform_home: "الصفحة الرئيسية",
  settings: "الإعدادات",
  
  // المخزون والأصول
  inventory: "المخزون والأصول",
  asset_transfers: "تحويلات الأصول",
  inspections: "التفتيش والجرد",
  maintenance: "الصيانة",
  
  // الإنتاج والتشغيل
  production: "الإنتاج",
  daily_production: "الإنتاج اليومي",
  advanced_production: "أوامر الإنتاج المتقدمة",
  quality_control: "مراقبة الجودة",
  quality: "الجودة",
  products: "المنتجات",
  operations: "التشغيل",
  ai_production_planner: "مخطط الإنتاج الذكي",
  
  // الورديات والحضور
  shifts: "الورديات",
  attendance: "الحضور والانصراف",
  attendance_check: "تسجيل الحضور والانصراف",
  biometric_settings: "إعدادات البصمة",
  timesheet: "كشوف الدوام",
  branch_closure: "فتح وإغلاق الفروع",
  
  // الموظفين والموارد البشرية
  users: "إدارة المستخدمين",
  branch_employees: "موظفي الفروع",
  branches: "الفروع",
  organizational_structure: "الهيكل التنظيمي",
  employee_reports: "تقارير الموظفين",
  employee_transfers: "تحويلات الموظفين",
  hr_management: "إدارة الموارد البشرية",
  
  // المالية
  cashier: "الكاشير",
  cashier_journal: "يومية الكاشير",
  cashier_performance: "أداء الكاشير",
  daily_closures: "الإغلاقات اليومية للفروع",
  pnl_dashboard: "لوحة الأرباح والخسائر",
  incentives: "الحوافز",
  sales_analytics: "تحليلات المبيعات",
  sales_uploads: "رفع بيانات المبيعات",
  smart_incentives_settings: "إعدادات النقاط والحوافز",
  smart_incentives_challenges: "التحديات اليومية",
  smart_incentives_commissions: "عمولات المنتجات",
  smart_incentives_bonus: "مكافأة إنجاز الفرع",
  smart_incentives_wallet: "محفظة النقاط",
  smart_incentives_statements: "كشوفات حساب الحوافز",
  
  // الأهداف والأداء
  targets: "الأهداف",
  targets_planning: "تخطيط الأهداف",
  waste_tracking: "تتبع الهدر",
  waste: "الهدر",
  
  // مشاريع الإنشاء
  construction: "الإنشاءات",
  construction_projects: "مشاريع الإنشاءات",
  construction_work_items: "بنود الأعمال",
  construction_reports: "تقارير المشاريع",
  contractors: "المقاولين",
  contracts: "العقود",
  budget_planning: "تخطيط الميزانية",
  payment_requests: "طلبات الصرف",
  
  // التسويق
  marketing: "التسويق",
  marketing_campaigns: "الحملات التسويقية",
  marketing_influencers: "المؤثرين",
  marketing_tasks: "مهام التسويق",
  marketing_goals: "أهداف التسويق",
  marketing_calendar: "تقويم التسويق",
  marketing_alerts: "تنبيهات التسويق",
  marketing_assets: "أصول التسويق",
  marketing_expenses: "مصروفات التسويق",
  marketing_reports: "تقارير التسويق",
  marketing_team: "فريق التسويق",
  social_responsibility: "المسؤولية الاجتماعية",
  
  // إدارة النظام
  rbac_management: "إدارة الصلاحيات",
  audit_logs: "سجلات التدقيق",
  backups: "النسخ الاحتياطية",
  integrations: "التكاملات",
  reports: "التقارير",
  
  // المخازن والتحويلات
  warehouse: "المخازن",
  material_requests: "طلبات المواد",
  transfer_requests: "طلبات التحويل",
  warehouse_inventory: "مخزون المستودع",
  
  // السكرتارية التنفيذية
  executive_dashboard: "لوحة السكرتارية التنفيذية",
  executive_meetings: "الاجتماعات",
  executive_tasks: "المهام التنفيذية",
  executive_correspondence: "المراسلات",
  executive_documents: "الوثائق والأرشفة",
  executive_visitors: "سجل الزوار",
  executive_travel: "إدارة السفر",
  executive_reports: "تقارير السكرتارية",
  executive_notifications: "التنبيهات",
  executive_calendar: "التقويم التنفيذي",
  
  // إدارة الوثائق
  documents: "إدارة الوثائق",
  
  // الحوكمة المؤسسية
  governance: "الحوكمة المؤسسية",
  governance_board: "مجلس الإدارة",
  governance_shareholders: "المساهمين",
  governance_meetings: "اجتماعات الحوكمة",
  governance_resolutions: "القرارات",
  governance_compliance: "الامتثال",
  governance_transfers: "تحويلات الأسهم",
  governance_disclosures: "الإفصاحات",
  governance_dividends: "توزيعات الأرباح",
  governance_capital: "رأس المال",
  governance_voting: "التصويت",
};

// Action labels for UI display (Arabic)
export const ACTION_LABELS: Record<ModuleAction, string> = {
  view: "عرض",
  view_list: "عرض القائمة",
  view_details: "عرض التفاصيل",
  create: "إنشاء",
  edit: "تعديل",
  delete: "حذف",
  submit: "إرسال",
  approve: "اعتماد",
  reject: "رفض",
  reopen: "إعادة فتح",
  export: "تصدير",
  print: "طباعة",
  sign: "توقيع",
  view_signatures: "عرض التوقيعات",
  manage_attachments: "إدارة المرفقات",
  notify: "إشعارات",
  change_status: "تغيير الحالة",
  assign_reviewer: "تعيين مراجع",
};

// Module groups for UI organization
export const MODULE_GROUPS: { label: string; modules: SystemModule[] }[] = [
  {
    label: "الأساسية",
    modules: ["dashboard", "platform_home", "settings"],
  },
  {
    label: "المخزون والأصول",
    modules: ["inventory", "asset_transfers", "inspections", "maintenance"],
  },
  {
    label: "الإنتاج والتشغيل",
    modules: [
      "production",
      "daily_production",
      "advanced_production",
      "quality_control",
      "products",
      "operations",
      "ai_production_planner",
    ],
  },
  {
    label: "الورديات والحضور",
    modules: ["shifts", "attendance", "attendance_check", "biometric_settings", "timesheet", "branch_closure"],
  },
  {
    label: "الموظفين والموارد البشرية",
    modules: [
      "users",
      "branch_employees",
      "branches",
      "organizational_structure",
      "employee_reports",
      "employee_transfers",
      "hr_management",
    ],
  },
  {
    label: "المالية والكاشير",
    modules: [
      "cashier_journal",
      "cashier_performance",
      "daily_closures",
      "pnl_dashboard",
      "incentives",
      "sales_analytics",
      "sales_uploads",
    ],
  },
  {
    label: "الحوافز الذكية",
    modules: [
      "smart_incentives_settings",
      "smart_incentives_challenges",
      "smart_incentives_commissions",
      "smart_incentives_bonus",
      "smart_incentives_wallet",
      "smart_incentives_statements",
    ],
  },
  {
    label: "الأهداف والأداء",
    modules: ["targets", "targets_planning", "waste_tracking"],
  },
  {
    label: "مشاريع الإنشاء",
    modules: [
      "construction_projects",
      "construction_work_items",
      "construction_reports",
      "contractors",
      "contracts",
      "budget_planning",
      "payment_requests",
    ],
  },
  {
    label: "التسويق",
    modules: [
      "marketing",
      "marketing_campaigns",
      "marketing_influencers",
      "marketing_tasks",
      "marketing_goals",
      "marketing_calendar",
      "marketing_alerts",
      "marketing_assets",
      "marketing_expenses",
      "marketing_reports",
      "marketing_team",
      "social_responsibility",
    ],
  },
  {
    label: "إدارة النظام",
    modules: ["rbac_management", "audit_logs", "backups", "integrations", "reports"],
  },
  {
    label: "المخازن والتحويلات",
    modules: ["warehouse", "material_requests", "transfer_requests", "warehouse_inventory"],
  },
  {
    label: "السكرتارية التنفيذية",
    modules: [
      "executive_dashboard",
      "executive_meetings",
      "executive_tasks",
      "executive_correspondence",
      "executive_documents",
      "executive_visitors",
      "executive_travel",
      "executive_reports",
      "executive_notifications",
      "executive_calendar",
    ],
  },
  {
    label: "إدارة الوثائق",
    modules: ["documents"],
  },
  {
    label: "الحوكمة المؤسسية",
    modules: [
      "governance",
      "governance_board",
      "governance_shareholders",
      "governance_meetings",
      "governance_resolutions",
      "governance_compliance",
      "governance_transfers",
      "governance_disclosures",
      "governance_dividends",
      "governance_capital",
      "governance_voting",
    ],
  },
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
    { module: "smart_incentives_wallet", actions: ["view"] },
    { module: "smart_incentives_statements", actions: ["view"] },
  ],

  // Financial Accountant: View reports, cashier, sales, closures, operations
  financial_accountant: [
    { module: "dashboard", actions: ["view"] },
    { module: "cashier", actions: ["view", "export", "print"] },
    { module: "cashier_journal", actions: ["view", "export", "print"] },
    { module: "branch_closure", actions: ["view"] },
    { module: "reports", actions: ["view", "export", "print", "advanced"] },
    { module: "production", actions: ["view", "export", "print"] },
    { module: "operations", actions: ["view"] },
    { module: "inventory", actions: ["view", "export", "print"] },
    { module: "waste", actions: ["view"] },
    { module: "quality", actions: ["view"] },
    { module: "shifts", actions: ["view"] },
    { module: "branches", actions: ["view"] },
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
  "executive_secretary",
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
  executive_secretary: "سكرتير تنفيذي",
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
    { module: "daily_closures", actions: ["view", "create", "approve"] },
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
    {
      module: "daily_closures",
      actions: ["view", "create", "edit", "approve", "export"],
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

  // سكرتير تنفيذي - صلاحيات السكرتارية التنفيذية الكاملة
  executive_secretary: [
    { module: "dashboard", actions: ["view"] },
    { module: "executive_dashboard", actions: ["view", "export"] },
    { module: "executive_meetings", actions: ["view", "create", "edit", "delete", "export", "print"] },
    { module: "executive_tasks", actions: ["view", "create", "edit", "delete", "change_status"] },
    { module: "executive_correspondence", actions: ["view", "create", "edit", "delete", "export", "print"] },
    { module: "executive_documents", actions: ["view", "create", "edit", "delete", "manage_attachments", "export"] },
    { module: "executive_visitors", actions: ["view", "create", "edit", "delete", "export", "print"] },
    { module: "executive_travel", actions: ["view", "create", "edit", "submit", "approve", "reject", "export"] },
    { module: "executive_reports", actions: ["view", "export", "print"] },
    { module: "executive_notifications", actions: ["view", "create", "edit", "delete", "notify"] },
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
}, (table) => [
  index("idx_asset_transfer_events_transfer_id").on(table.transferId),
]);

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
}, (table) => [
  index("idx_notification_queue_status").on(table.status),
  index("idx_notification_queue_created_at").on(table.createdAt),
  index("idx_notification_queue_status_created_at").on(table.status, table.createdAt),
]);

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
  nameEn: text("name_en"), // الاسم بالإنجليزية
  sku: text("sku"), // رمز المنتج
  category: text("category").notNull(), // bread, pastry, cake, sandwich, etc.
  productType: text("product_type").default("finish"), // نوع الصنف: finish (نهائي) أو inventory (مخزني)
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
}, (table) => [
  index("idx_shifts_branch_id").on(table.branchId),
  index("idx_shifts_date").on(table.date),
  index("idx_shifts_branch_date").on(table.branchId, table.date),
]);

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
}, (table) => [
  index("idx_shift_employees_shift_id").on(table.shiftId),
  index("idx_shift_employees_status").on(table.status),
]);

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
}, (table) => [
  index("idx_production_orders_branch_id").on(table.branchId),
  index("idx_production_orders_status").on(table.status),
  index("idx_production_orders_scheduled_date").on(table.scheduledDate),
  index("idx_production_orders_branch_status").on(table.branchId, table.status),
]);

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

  // مقارنة الصندوق النقدي
  expectedCash: real("expected_cash").default(0).notNull(), // النقد المتوقع
  actualCashDrawer: real("actual_cash_drawer").default(0).notNull(), // النقد الفعلي بالصندوق
  discrepancyAmount: real("discrepancy_amount").default(0).notNull(), // مبلغ الفرق النقدي
  discrepancyStatus: text("discrepancy_status").default("balanced").notNull(), // balanced, shortage, surplus

  // Bank Reconciliation columns - مطابقة البنك
  totalBankPosAmount: real("total_bank_pos_amount").default(0), // إجمالي المدفوعات البنكية من الكاشير
  totalBankTerminalAmount: real("total_bank_terminal_amount").default(0), // إجمالي المدفوعات البنكية من التيرمنال
  bankDiscrepancyTotal: real("bank_discrepancy_total").default(0), // إجمالي الفرق البنكي
  bankDiscrepancyStatus: text("bank_discrepancy_status").default("balanced"), // حالة المطابقة البنكية
  isInputError: boolean("is_input_error").default(false), // هل الفرق بسبب خطأ إدخال
  inputErrorAmount: real("input_error_amount").default(0), // مبلغ خطأ الإدخال
  netDiscrepancy: real("net_discrepancy").default(0), // صافي الفرق

  // المرتجعات - Returns
  returnAmount: real("return_amount").default(0), // مبلغ المرتجع
  returnPaymentMethod: text("return_payment_method"), // طريقة الدفع المرتجعة (cash, mada, visa, etc)
  returnReason: text("return_reason"), // سبب المرتجع
  returnReference: text("return_reference"), // رقم الفاتورة المرتجعة
  hasReturn: boolean("has_return").default(false), // هل يوجد مرتجع

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
}, (table) => [
  index("idx_journals_branch_date").on(table.branchId, table.journalDate),
  index("idx_journals_cashier").on(table.cashierId),
  index("idx_journals_status").on(table.status),
]);

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
  amount: real("amount").default(0).notNull(), // المبلغ من نظام الكاشير (POS)
  
  // Bank Reconciliation columns - مطابقة البنك
  posAmount: real("pos_amount").default(0), // المبلغ من نظام نقاط البيع (POS)
  terminalAmount: real("terminal_amount").default(0), // المبلغ من جهاز الصراف البنكي (Terminal)
  bankDiscrepancy: real("bank_discrepancy").default(0), // الفرق بين POS والتيرمنال
  bankDiscrepancyType: text("bank_discrepancy_type").default("balanced"), // نوع الفرق: balanced, shortage, surplus
  terminalTransactionCount: integer("terminal_transaction_count").default(0), // عدد العمليات من جهاز البنك
  
  transactionCount: integer("transaction_count").default(0), // عدد العمليات من الكاشير
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

// Bank payment methods that require terminal reconciliation - طرق الدفع البنكية التي تتطلب مطابقة التيرمنال
export const BANK_PAYMENT_METHODS = [
  "card",
  "mada", 
  "stc_pay",
  "apple_pay",
  "visa",
  "mastercard",
] as const;

export type BankPaymentMethod = (typeof BANK_PAYMENT_METHODS)[number];

// Helper to check if a payment method requires bank reconciliation
export const requiresBankReconciliation = (method: string): boolean => {
  return BANK_PAYMENT_METHODS.includes(method as BankPaymentMethod);
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

// ==================== Branch Daily Closures Module ====================

// Branch Daily Closures table - الإغلاق اليومي للفرع (اليومية المجمعة)
export const branchDailyClosures = pgTable("branch_daily_closures", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  closureDate: text("closure_date").notNull(), // تاريخ الإغلاق

  // إجمالي المبيعات المجمعة
  totalSales: real("total_sales").default(0).notNull(),
  cashTotal: real("cash_total").default(0).notNull(),
  networkTotal: real("network_total").default(0).notNull(),
  deliveryTotal: real("delivery_total").default(0).notNull(),

  // إجمالي الصندوق النقدي
  totalOpeningBalance: real("total_opening_balance").default(0).notNull(),
  totalExpectedCash: real("total_expected_cash").default(0).notNull(),
  totalActualCash: real("total_actual_cash").default(0).notNull(),
  totalCashDiscrepancy: real("total_cash_discrepancy").default(0).notNull(),
  cashDiscrepancyStatus: text("cash_discrepancy_status").default("balanced").notNull(),

  // مطابقة البنك المجمعة
  totalBankPosAmount: real("total_bank_pos_amount").default(0),
  totalBankTerminalAmount: real("total_bank_terminal_amount").default(0),
  totalBankDiscrepancy: real("total_bank_discrepancy").default(0),
  bankDiscrepancyStatus: text("bank_discrepancy_status").default("balanced"),

  // إحصائيات مجمعة
  totalCustomerCount: integer("total_customer_count").default(0),
  totalTransactionCount: integer("total_transaction_count").default(0),
  averageTicket: real("average_ticket").default(0),
  journalsCount: integer("journals_count").default(0).notNull(), // عدد اليوميات المجمعة

  // الحالة
  status: text("status").default("open").notNull(), // open, closed
  closedBy: varchar("closed_by").references(() => users.id),
  closedAt: timestamp("closed_at"),

  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_daily_closure_branch_date").on(table.branchId, table.closureDate),
  index("idx_daily_closure_status").on(table.status),
]);

export const insertBranchDailyClosureSchema = createInsertSchema(
  branchDailyClosures,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
});

export type BranchDailyClosure = typeof branchDailyClosures.$inferSelect;
export type InsertBranchDailyClosure = z.infer<typeof insertBranchDailyClosureSchema>;

// Branch Daily Closure Payments - تفاصيل الدفع المجمعة
export const branchDailyClosurePayments = pgTable("branch_daily_closure_payments", {
  id: serial("id").primaryKey(),
  closureId: integer("closure_id")
    .notNull()
    .references(() => branchDailyClosures.id, { onDelete: "cascade" }),
  paymentMethod: text("payment_method").notNull(),
  totalAmount: real("total_amount").default(0).notNull(),
  totalPosAmount: real("total_pos_amount").default(0),
  totalTerminalAmount: real("total_terminal_amount").default(0),
  totalBankDiscrepancy: real("total_bank_discrepancy").default(0),
  bankDiscrepancyType: text("bank_discrepancy_type").default("balanced"),
  totalTransactionCount: integer("total_transaction_count").default(0),
  totalTerminalTransactionCount: integer("total_terminal_transaction_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBranchDailyClosurePaymentSchema = createInsertSchema(
  branchDailyClosurePayments,
).omit({
  id: true,
  createdAt: true,
});

export type BranchDailyClosurePayment = typeof branchDailyClosurePayments.$inferSelect;
export type InsertBranchDailyClosurePayment = z.infer<typeof insertBranchDailyClosurePaymentSchema>;

// Branch Daily Closure Journals - ربط اليومية المجمعة باليوميات الفردية
export const branchDailyClosureJournals = pgTable("branch_daily_closure_journals", {
  id: serial("id").primaryKey(),
  closureId: integer("closure_id")
    .notNull()
    .references(() => branchDailyClosures.id, { onDelete: "cascade" }),
  journalId: integer("journal_id")
    .notNull()
    .references(() => cashierSalesJournals.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_closure_journal_closure").on(table.closureId),
  uniqueIndex("idx_closure_journal_unique").on(table.journalId),
]);

export const insertBranchDailyClosureJournalSchema = createInsertSchema(
  branchDailyClosureJournals,
).omit({
  id: true,
  createdAt: true,
});

export type BranchDailyClosureJournal = typeof branchDailyClosureJournals.$inferSelect;
export type InsertBranchDailyClosureJournal = z.infer<typeof insertBranchDailyClosureJournalSchema>;

// Closure status labels
export const CLOSURE_STATUS = ["open", "closed"] as const;
export type ClosureStatus = (typeof CLOSURE_STATUS)[number];

export const CLOSURE_STATUS_LABELS: Record<ClosureStatus, string> = {
  open: "مفتوح",
  closed: "مُغلق",
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

// ==========================================
// نظام النقاط والعمولات الذكي - Smart Points & Commissions
// ==========================================

// إعدادات النقاط العامة - Point Settings
export const pointSettings = pgTable("point_settings", {
  id: serial("id").primaryKey(),
  pointValue: real("point_value").notNull().default(0.5),
  maxDailyPoints: integer("max_daily_points"),
  maxMonthlyPoints: integer("max_monthly_points"),
  seasonalMultiplier: real("seasonal_multiplier").default(1),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPointSettingsSchema = createInsertSchema(pointSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PointSettings = typeof pointSettings.$inferSelect;
export type InsertPointSettings = z.infer<typeof insertPointSettingsSchema>;

// تحديات الكاشير اليومية - Cashier Daily Challenges
export const cashierDailyChallenges = pgTable("cashier_daily_challenges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  challengeType: text("challenge_type").notNull(), // avg_ticket, customer_count, shift_sales
  branchId: varchar("branch_id").references(() => branches.id),
  cashierId: varchar("cashier_id").references(() => users.id),
  targetValue: real("target_value").notNull(),
  basePoints: integer("base_points").notNull(),
  bonusPointsPerUnit: real("bonus_points_per_unit").default(0),
  unitLabel: text("unit_label"),
  shiftType: text("shift_type"),
  isActive: boolean("is_active").default(true).notNull(),
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCashierDailyChallengeSchema = createInsertSchema(cashierDailyChallenges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CashierDailyChallenge = typeof cashierDailyChallenges.$inferSelect;
export type InsertCashierDailyChallenge = z.infer<typeof insertCashierDailyChallengeSchema>;

// عمولة الأصناف المستهدفة - Product Commission
export const productCommissions = pgTable("product_commissions", {
  id: serial("id").primaryKey(),
  productName: text("product_name").notNull(),
  productCategory: text("product_category"),
  commissionType: text("commission_type").notNull(), // weekly_product, monthly_product, new_product
  branchId: varchar("branch_id").references(() => branches.id),
  cashierId: varchar("cashier_id").references(() => users.id),
  targetQuantity: integer("target_quantity").notNull(),
  pointsOnTarget: integer("points_on_target").notNull(),
  bonusPointsPerExtra: real("bonus_points_per_extra").default(0),
  shiftType: text("shift_type"),
  isActive: boolean("is_active").default(true).notNull(),
  validFrom: text("valid_from").notNull(),
  validTo: text("valid_to"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductCommissionSchema = createInsertSchema(productCommissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ProductCommission = typeof productCommissions.$inferSelect;
export type InsertProductCommission = z.infer<typeof insertProductCommissionSchema>;

// عمولة إنجاز الفرع الجماعية - Branch Achievement Bonus Settings
export const branchAchievementBonus = pgTable("branch_achievement_bonus", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  yearMonth: text("year_month").notNull(),
  bonusPool: real("bonus_pool").notNull(),
  targetAmount: real("target_amount").notNull(),
  distributionMethod: text("distribution_method").default("contribution_ratio").notNull(),
  bonusTiers: text("bonus_tiers"),
  calculationStatus: text("calculation_status").default("pending"),
  actualSales: real("actual_sales"),
  achievementPercent: real("achievement_percent"),
  matchedTierAmount: real("matched_tier_amount"),
  calculationDetails: text("calculation_details"),
  calculatedAt: timestamp("calculated_at"),
  calculatedBy: varchar("calculated_by").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBranchAchievementBonusSchema = createInsertSchema(branchAchievementBonus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BranchAchievementBonus = typeof branchAchievementBonus.$inferSelect;
export type InsertBranchAchievementBonus = z.infer<typeof insertBranchAchievementBonusSchema>;

// رصيد نقاط الكاشير - Cashier Points Ledger
export const cashierPointsLedger = pgTable("cashier_points_ledger", {
  id: serial("id").primaryKey(),
  cashierId: varchar("cashier_id").notNull().references(() => users.id),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  transactionDate: text("transaction_date").notNull(),
  shiftType: text("shift_type"),
  pointsType: text("points_type").notNull(), // challenge_avg_ticket, challenge_customers, challenge_sales, product_commission, branch_bonus
  sourceId: integer("source_id"),
  sourceName: text("source_name"),
  pointsEarned: integer("points_earned").notNull(),
  pointValue: real("point_value").notNull(),
  amountEarned: real("amount_earned").notNull(),
  status: text("status").default("earned").notNull(), // earned, approved, paid, cancelled
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_points_cashier_date").on(table.cashierId, table.transactionDate),
  index("idx_points_branch_date").on(table.branchId, table.transactionDate),
  index("idx_points_status").on(table.status),
]);

export const insertCashierPointsLedgerSchema = createInsertSchema(cashierPointsLedger).omit({
  id: true,
  approvedAt: true,
  createdAt: true,
});
export type CashierPointsLedger = typeof cashierPointsLedger.$inferSelect;
export type InsertCashierPointsLedger = z.infer<typeof insertCashierPointsLedgerSchema>;

// سجل مبيعات الأصناف المستهدفة لكل كاشير - Product Sales Tracking
export const cashierProductSales = pgTable("cashier_product_sales", {
  id: serial("id").primaryKey(),
  cashierId: varchar("cashier_id").notNull().references(() => users.id),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  commissionId: integer("commission_id").notNull().references(() => productCommissions.id),
  salesDate: text("sales_date").notNull(),
  shiftType: text("shift_type"),
  quantitySold: integer("quantity_sold").notNull().default(0),
  targetQuantity: integer("target_quantity").notNull(),
  isTargetMet: boolean("is_target_met").default(false),
  pointsAwarded: integer("points_awarded").default(0),
  recordedBy: varchar("recorded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_product_sales_cashier").on(table.cashierId, table.salesDate),
]);

export const insertCashierProductSalesSchema = createInsertSchema(cashierProductSales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CashierProductSales = typeof cashierProductSales.$inferSelect;
export type InsertCashierProductSales = z.infer<typeof insertCashierProductSalesSchema>;

// كشف حساب حوافز الكاشير - Cashier Incentive Statements
export const cashierIncentiveStatements = pgTable("cashier_incentive_statements", {
  id: serial("id").primaryKey(),
  statementNumber: text("statement_number").notNull(),
  cashierId: varchar("cashier_id").notNull().references(() => users.id),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  periodFrom: text("period_from").notNull(),
  periodTo: text("period_to").notNull(),
  totalPoints: integer("total_points").default(0).notNull(),
  totalAmount: real("total_amount").default(0).notNull(),
  dailyChallengePoints: integer("daily_challenge_points").default(0),
  productCommissionPoints: integer("product_commission_points").default(0),
  branchBonusPoints: integer("branch_bonus_points").default(0),
  manualAdjustmentPoints: integer("manual_adjustment_points").default(0),
  entriesCount: integer("entries_count").default(0),
  status: text("status").default("draft").notNull(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  paidBy: varchar("paid_by").references(() => users.id),
  paidAt: timestamp("paid_at"),
  statementData: text("statement_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_incentive_stmt_cashier").on(table.cashierId),
  index("idx_incentive_stmt_branch").on(table.branchId),
  index("idx_incentive_stmt_status").on(table.status),
]);

export const insertCashierIncentiveStatementSchema = createInsertSchema(cashierIncentiveStatements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CashierIncentiveStatement = typeof cashierIncentiveStatements.$inferSelect;
export type InsertCashierIncentiveStatement = z.infer<typeof insertCashierIncentiveStatementSchema>;

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
}, (table) => [
  index("idx_display_bar_receipts_branch_id").on(table.branchId),
  index("idx_display_bar_receipts_receipt_date").on(table.receiptDate),
  index("idx_display_bar_receipts_branch_date").on(table.branchId, table.receiptDate),
]);

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
}, (table) => [
  index("idx_display_bar_daily_summary_branch_id").on(table.branchId),
  index("idx_display_bar_daily_summary_date").on(table.summaryDate),
  index("idx_display_bar_daily_summary_branch_date").on(table.branchId, table.summaryDate),
]);

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
}, (table) => [
  index("idx_waste_reports_branch_id").on(table.branchId),
  index("idx_waste_reports_report_date").on(table.reportDate),
  index("idx_waste_reports_status").on(table.status),
  index("idx_waste_reports_branch_date").on(table.branchId, table.reportDate),
]);

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
  sourceSalesValue: real("source_sales_value"), // قيمة المبيعات من الملف المصدر
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
  originalQuantity: integer("original_quantity"), // الكمية الأصلية من الملف المصدر
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
  productionDate: text("production_date"), // تاريخ الإنتاج بتوقيت المستخدم YYYY-MM-DD
  recordedBy: varchar("recorded_by").references(() => users.id),
  recorderName: text("recorder_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Production status and chef tracking - حالة الإنتاج ومتابعة الشيف
  status: text("status").default("finished"), // finished = مكتمل, in_progress = قيد التحضير
  chefId: varchar("chef_id").references(() => users.id),
  chefName: text("chef_name"), // اسم الشيف المنتج
  sourceBatchId: integer("source_batch_id"), // ربط بالدفعة السابقة للترحيل
  finishedAt: timestamp("finished_at"), // تاريخ اكتمال الإنتاج
  finishedById: varchar("finished_by_id").references(() => users.id), // من قام بإكمال الدفعة
  finishedByName: text("finished_by_name"), // اسم من قام بالإكمال
}, (table) => [
  index("idx_daily_production_batches_branch_id").on(table.branchId),
  index("idx_daily_production_batches_production_date").on(table.productionDate),
  index("idx_daily_production_batches_branch_date").on(table.branchId, table.productionDate),
]);

export const insertDailyProductionBatchSchema = createInsertSchema(
  dailyProductionBatches,
).omit({
  id: true,
  createdAt: true,
  finishedAt: true,
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
}, (table) => [
  index("idx_user_assignments_user_id").on(table.userId),
  index("idx_user_assignments_role_id").on(table.roleId),
]);

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

// ==================== نظام الأمان المتقدم ====================

// User Security Settings - إعدادات أمان المستخدم
export const userSecuritySettings = pgTable("user_security_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
  twoFactorSecret: text("two_factor_secret"), // Secret for TOTP
  twoFactorBackupCodes: text("two_factor_backup_codes").array(), // Backup codes
  ipWhitelist: text("ip_whitelist").array(), // قائمة IP المسموحة
  ipRestrictionEnabled: boolean("ip_restriction_enabled").default(false).notNull(),
  sessionTimeout: integer("session_timeout").default(480), // مهلة الجلسة بالدقائق (8 ساعات افتراضي)
  maxConcurrentSessions: integer("max_concurrent_sessions").default(3), // الحد الأقصى للجلسات المتزامنة
  passwordChangedAt: timestamp("password_changed_at"),
  passwordExpiryDays: integer("password_expiry_days").default(90), // صلاحية كلمة المرور
  forcePasswordChange: boolean("force_password_change").default(false).notNull(),
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"), // قفل الحساب حتى
  lastLoginAt: timestamp("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  lastLoginDevice: text("last_login_device"),
  trustedDevices: jsonb("trusted_devices").$type<{ deviceId: string; name: string; addedAt: string }[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSecuritySettingsSchema = createInsertSchema(userSecuritySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserSecuritySettings = typeof userSecuritySettings.$inferSelect;
export type InsertUserSecuritySettings = z.infer<typeof insertUserSecuritySettingsSchema>;

// User Sessions - جلسات المستخدمين النشطة
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).unique().notNull(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deviceInfo: jsonb("device_info").$type<{ browser: string; os: string; device: string }>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true).notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_user_sessions_user_id").on(table.userId),
  sessionIdIdx: index("idx_user_sessions_session_id").on(table.sessionId),
}));

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

// Security Violation Alerts - تنبيهات الانتهاكات الأمنية
export const securityViolationAlerts = pgTable("security_violation_alerts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  violationType: varchar("violation_type", { length: 50 }).notNull(), // unauthorized_access, failed_login, ip_blocked, session_hijack, permission_denied
  severity: varchar("severity", { length: 20 }).notNull().default("warning"), // info, warning, critical
  module: varchar("module", { length: 100 }), // الوحدة المستهدفة
  action: varchar("action", { length: 50 }), // الإجراء المحاول
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: jsonb("details").$type<Record<string, any>>(), // تفاصيل إضافية
  isResolved: boolean("is_resolved").default(false).notNull(),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_security_violations_user_id").on(table.userId),
  typeIdx: index("idx_security_violations_type").on(table.violationType),
  createdAtIdx: index("idx_security_violations_created_at").on(table.createdAt),
}));

export const insertSecurityViolationAlertSchema = createInsertSchema(securityViolationAlerts).omit({
  id: true,
  createdAt: true,
});

export type SecurityViolationAlert = typeof securityViolationAlerts.$inferSelect;
export type InsertSecurityViolationAlert = z.infer<typeof insertSecurityViolationAlertSchema>;

// Permission Check Logs - سجل فحص الصلاحيات (لتتبع كل عملية تحقق)
export const permissionCheckLogs = pgTable("permission_check_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  module: varchar("module", { length: 100 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  resourceId: text("resource_id"), // معرف المورد المستهدف (مثل: projectId, inventoryId)
  branchId: varchar("branch_id").references(() => branches.id, { onDelete: "set null" }),
  allowed: boolean("allowed").notNull(), // هل تم السماح؟
  denialReason: text("denial_reason"), // سبب الرفض إن وجد
  ipAddress: text("ip_address"),
  requestPath: text("request_path"), // مسار الطلب
  requestMethod: varchar("request_method", { length: 10 }), // GET, POST, PUT, DELETE
  responseTime: integer("response_time"), // وقت الاستجابة بالميلي ثانية
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_perm_check_logs_user_id").on(table.userId),
  moduleIdx: index("idx_perm_check_logs_module").on(table.module),
  createdAtIdx: index("idx_perm_check_logs_created_at").on(table.createdAt),
}));

export const insertPermissionCheckLogSchema = createInsertSchema(permissionCheckLogs).omit({
  id: true,
  createdAt: true,
});

export type PermissionCheckLog = typeof permissionCheckLogs.$inferSelect;
export type InsertPermissionCheckLog = z.infer<typeof insertPermissionCheckLogSchema>;

// Role Templates - قوالب الأدوار الجاهزة
export const roleTemplates = pgTable("role_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 50 }).unique().notNull(),
  description: text("description"),
  permissions: jsonb("permissions").$type<{ module: string; actions: string[] }[]>().notNull(),
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }),
  isSystemDefault: boolean("is_system_default").default(false).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRoleTemplateSchema = createInsertSchema(roleTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type RoleTemplate = typeof roleTemplates.$inferSelect;
export type InsertRoleTemplate = z.infer<typeof insertRoleTemplateSchema>;

// ==========================================
// نظام أهداف الشفت والكاشير - Shift & Cashier Targets
// ==========================================

// Cashier Shift Targets - أهداف الكاشير داخل الشفت
export const cashierShiftTargets = pgTable("cashier_shift_targets", {
  id: serial("id").primaryKey(),
  cashierId: varchar("cashier_id")
    .notNull()
    .references(() => users.id),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  shiftType: varchar("shift_type").notNull(), // morning, evening
  cashierRole: varchar("cashier_role").default("main").notNull(), // main, assistant, trainee
  
  // Period settings - إعدادات الفترة
  periodType: varchar("period_type").default("daily").notNull(), // daily, weekly, monthly
  startDate: date("start_date").notNull(), // تاريخ بداية الفترة
  endDate: date("end_date").notNull(), // تاريخ نهاية الفترة
  
  // Total targets for the period - إجمالي الأهداف للفترة
  totalTargetAmount: numeric("total_target_amount").notNull(), // إجمالي هدف المبيعات للفترة
  totalTargetTransactions: integer("total_target_transactions"), // إجمالي الحركات المستهدفة للفترة
  
  // Daily distributed targets (auto-calculated) - الأهداف اليومية الموزعة
  targetAmount: numeric("target_amount").notNull(), // هدف المبيعات اليومي الموزع
  targetTransactions: integer("target_transactions"), // عدد المعاملات اليومي المستهدف
  targetTicketValue: numeric("target_ticket_value"), // هدف متوسط الفاتورة (محسوب تلقائياً)
  
  // Legacy field for backward compatibility
  targetDate: date("target_date").notNull(), // YYYY-MM-DD (same as startDate for daily)
  
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCashierShiftTargetSchema = createInsertSchema(cashierShiftTargets).omit({
  id: true,
  createdAt: true,
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
  cashierId: varchar("cashier_id")
    .references(() => users.id),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  shiftType: varchar("shift_type"), // morning, evening
  alertType: varchar("alert_type").notNull(), // shift_behind, shift_ahead, cashier_behind, cashier_ahead, ticket_low
  alertLevel: varchar("alert_level").notNull(), // info, warning, critical, success
  message: text("message").notNull(),
  currentValue: numeric("current_value"),
  targetValue: numeric("target_value"),
  percentage: numeric("percentage"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPerformanceAlertSchema = createInsertSchema(performanceAlerts).omit({
  id: true,
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
  shiftType: varchar("shift_type").notNull(), // morning, evening
  trackingDate: date("tracking_date").notNull(), // YYYY-MM-DD
  // Actual metrics
  totalSales: numeric("total_sales").default("0"),
  totalTransactions: integer("total_transactions").default(0),
  averageTicket: numeric("average_ticket").default("0"),
  // Target metrics
  targetSales: numeric("target_sales").default("0"),
  targetTransactions: integer("target_transactions").default(0),
  // Performance indicators
  achievementPercentage: numeric("achievement_percentage").default("0"),
  status: varchar("status").default("in_progress"), // in_progress, completed
  // Timestamps
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertShiftPerformanceTrackingSchema = createInsertSchema(shiftPerformanceTracking).omit({
  id: true,
  updatedAt: true,
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

// ============================================
// إدارة التسويق - Marketing Management
// ============================================

// Campaign Status Types
export const CAMPAIGN_STATUSES = ["draft", "planned", "active", "paused", "completed", "cancelled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "مسودة",
  planned: "مخطط",
  active: "نشط",
  paused: "متوقف",
  completed: "مكتمل",
  cancelled: "ملغي",
};

// Campaign Objective Types
export const CAMPAIGN_OBJECTIVES = ["brand_awareness", "engagement", "sales_increase", "new_product", "seasonal", "event", "loyalty"] as const;
export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const CAMPAIGN_OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  brand_awareness: "رفع الوعي بالعلامة التجارية",
  engagement: "زيادة التفاعل",
  sales_increase: "زيادة المبيعات",
  new_product: "إطلاق منتج جديد",
  seasonal: "حملة موسمية",
  event: "حدث أو مناسبة",
  loyalty: "برنامج ولاء",
};

// Season Types for Campaigns
export const CAMPAIGN_SEASONS = ["summer", "winter", "spring", "autumn", "ramadan", "eid", "national_day", "other"] as const;
export type CampaignSeason = (typeof CAMPAIGN_SEASONS)[number];

export const CAMPAIGN_SEASON_LABELS: Record<CampaignSeason, string> = {
  summer: "موسم الصيف",
  winter: "موسم الشتاء",
  spring: "موسم الربيع",
  autumn: "موسم الخريف",
  ramadan: "شهر رمضان",
  eid: "عيد الفطر/الأضحى",
  national_day: "اليوم الوطني",
  other: "أخرى",
};

// Marketing Campaigns - الحملات التسويقية
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  objective: text("objective").notNull(), // from CAMPAIGN_OBJECTIVES
  season: text("season"), // from CAMPAIGN_SEASONS
  status: text("status").default("draft").notNull(), // from CAMPAIGN_STATUSES
  totalBudget: real("total_budget").default(0).notNull(),
  spentBudget: real("spent_budget").default(0).notNull(),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD
  targetAudience: text("target_audience"),
  channels: text("channels").array(), // social, print, influencer, email, etc.
  kpis: jsonb("kpis"), // Key Performance Indicators
  ownerId: varchar("owner_id").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_marketing_campaigns_status").on(table.status),
]);

export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;

// Campaign Budget Allocations - توزيع ميزانية الحملة على الفروع
export const campaignBudgetAllocations = pgTable("campaign_budget_allocations", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  allocatedBudget: real("allocated_budget").notNull(),
  spentAmount: real("spent_amount").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCampaignBudgetAllocationSchema = createInsertSchema(campaignBudgetAllocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CampaignBudgetAllocation = typeof campaignBudgetAllocations.$inferSelect;
export type InsertCampaignBudgetAllocation = z.infer<typeof insertCampaignBudgetAllocationSchema>;

// Campaign Goals - أهداف الحملة
export const campaignGoals = pgTable("campaign_goals", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  goalType: text("goal_type").notNull(), // sales_target, engagement_rate, impressions, reach, conversions
  targetValue: real("target_value").notNull(),
  currentValue: real("current_value").default(0).notNull(),
  unit: text("unit"), // SAR, %, count
  description: text("description"),
  deadline: text("deadline"), // YYYY-MM-DD
  isAchieved: boolean("is_achieved").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCampaignGoalSchema = createInsertSchema(campaignGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CampaignGoal = typeof campaignGoals.$inferSelect;
export type InsertCampaignGoal = z.infer<typeof insertCampaignGoalSchema>;

// Campaign Expense Categories - فئات المصروفات
export const CAMPAIGN_EXPENSE_CATEGORIES = [
  "influencer", // مؤثرين
  "advertising", // إعلانات
  "content_production", // إنتاج محتوى
  "design", // تصميم
  "printing", // طباعة
  "events", // فعاليات
  "gifts", // هدايا
  "travel", // سفر
  "equipment", // معدات
  "software", // برمجيات
  "other", // أخرى
] as const;

export const CAMPAIGN_EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  influencer: "مؤثرين",
  advertising: "إعلانات",
  content_production: "إنتاج محتوى",
  design: "تصميم",
  printing: "طباعة",
  events: "فعاليات",
  gifts: "هدايا",
  travel: "سفر",
  equipment: "معدات",
  software: "برمجيات",
  other: "أخرى",
};

// Campaign Expenses - مصروفات الحملات
export const campaignExpenses = pgTable("campaign_expenses", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id")
    .references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  branchId: integer("branch_id").references(() => branches.id, { onDelete: "set null" }),
  branchName: text("branch_name"), // اسم الفرع للعرض
  influencerId: integer("influencer_id").references(() => marketingInfluencers.id, { onDelete: "set null" }),
  category: text("category").notNull(), // from CAMPAIGN_EXPENSE_CATEGORIES
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").default("SAR").notNull(),
  expenseDate: text("expense_date").notNull(), // YYYY-MM-DD
  expenseMonth: text("expense_month"), // YYYY-MM for filtering
  paymentMethod: text("payment_method"), // bank_transfer, cash, check, credit_card
  referenceNumber: text("reference_number"),
  invoiceNumber: text("invoice_number"),
  vendor: text("vendor"), // المورد أو الجهة المستفيدة
  attachmentUrl: text("attachment_url"),
  status: text("status").default("pending").notNull(), // pending, approved, paid, rejected
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCampaignExpenseSchema = createInsertSchema(campaignExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CampaignExpense = typeof campaignExpenses.$inferSelect;
export type InsertCampaignExpense = z.infer<typeof insertCampaignExpenseSchema>;

export const CAMPAIGN_EXPENSE_STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  approved: "معتمد",
  paid: "مدفوع",
  rejected: "مرفوض",
};

export const CAMPAIGN_PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  cash: "نقدي",
  check: "شيك",
  credit_card: "بطاقة ائتمان",
};

// Marketing Calendar Events - تقويم التسويق
export const marketingCalendarEvents = pgTable("marketing_calendar_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull(), // campaign_start, campaign_end, content_deadline, meeting, reminder, milestone
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id, { onDelete: "set null" }),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date"), // YYYY-MM-DD (optional for single-day events)
  startTime: text("start_time"), // HH:MM
  endTime: text("end_time"), // HH:MM
  isAllDay: boolean("is_all_day").default(false).notNull(),
  color: text("color"), // hex color for calendar display
  assignedTo: varchar("assigned_to").references(() => users.id),
  reminderMinutes: integer("reminder_minutes"), // minutes before event
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurringPattern: text("recurring_pattern"), // daily, weekly, monthly
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMarketingCalendarEventSchema = createInsertSchema(marketingCalendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MarketingCalendarEvent = typeof marketingCalendarEvents.$inferSelect;
export type InsertMarketingCalendarEvent = z.infer<typeof insertMarketingCalendarEventSchema>;

// Influencer Platform Types
export const INFLUENCER_PLATFORMS = ["instagram", "tiktok", "twitter", "youtube", "snapchat", "facebook", "other"] as const;
export type InfluencerPlatform = (typeof INFLUENCER_PLATFORMS)[number];

export const INFLUENCER_PLATFORM_LABELS: Record<InfluencerPlatform, string> = {
  instagram: "انستغرام",
  tiktok: "تيك توك",
  twitter: "تويتر/إكس",
  youtube: "يوتيوب",
  snapchat: "سناب شات",
  facebook: "فيسبوك",
  other: "أخرى",
};

// Influencer Content Types
export const INFLUENCER_CONTENT_TYPES = ["photo", "video", "story", "reel", "live", "blog", "podcast", "review"] as const;
export type InfluencerContentType = (typeof INFLUENCER_CONTENT_TYPES)[number];

export const INFLUENCER_CONTENT_TYPE_LABELS: Record<InfluencerContentType, string> = {
  photo: "صور",
  video: "فيديو",
  story: "ستوري",
  reel: "ريلز",
  live: "بث مباشر",
  blog: "مدونة",
  podcast: "بودكاست",
  review: "مراجعة",
};

// Influencer Specialty Types
export const INFLUENCER_SPECIALTIES = ["food", "lifestyle", "family", "beauty", "fashion", "fitness", "travel", "entertainment", "tech", "general"] as const;
export type InfluencerSpecialty = (typeof INFLUENCER_SPECIALTIES)[number];

export const INFLUENCER_SPECIALTY_LABELS: Record<InfluencerSpecialty, string> = {
  food: "طعام ومطاعم",
  lifestyle: "نمط حياة",
  family: "عائلة وأطفال",
  beauty: "جمال ومكياج",
  fashion: "موضة وأزياء",
  fitness: "لياقة ورياضة",
  travel: "سفر ورحلات",
  entertainment: "ترفيه",
  tech: "تقنية",
  general: "عام",
};

// Marketing Influencers - المؤثرين والبلوجرز
export const marketingInfluencers = pgTable("marketing_influencers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  email: text("email"),
  phone: text("phone"),
  profileImageUrl: text("profile_image_url"),
  accountUrl: text("account_url"), // رابط الحساب
  coverageUrl: text("coverage_url"), // رابط التغطية
  specialty: text("specialty").notNull(), // from INFLUENCER_SPECIALTIES
  platforms: text("platforms").array(), // from INFLUENCER_PLATFORMS
  contentTypes: text("content_types").array(), // from INFLUENCER_CONTENT_TYPES
  followerCount: integer("follower_count").default(0),
  followerCountText: text("follower_count_text"), // النص الأصلي للمتابعين مثل 133k
  engagementRate: real("engagement_rate"), // percentage
  viewRating: integer("view_rating"), // تقييم المشاهدات (1-100)
  avgViews: integer("avg_views").default(0),
  pricePerPost: real("price_per_post"),
  pricePerStory: real("price_per_story"),
  pricePerVideo: real("price_per_video"),
  city: text("city"),
  region: text("region"),
  // Bank Information - معلومات بنكية
  bankAccountNumber: text("bank_account_number"),
  bankAccountHolder: text("bank_account_holder"),
  bankName: text("bank_name"),
  socialHandles: jsonb("social_handles"), // { instagram: "@handle", tiktok: "@handle", ... }
  bestCollaborationTimes: text("best_collaboration_times"), // description of best times
  notes: text("notes"),
  rating: real("rating"), // 1-5 rating based on past collaborations
  totalCollaborations: integer("total_collaborations").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  aiInsights: jsonb("ai_insights"), // AI-generated insights about performance
  lastContactDate: text("last_contact_date"), // YYYY-MM-DD
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_marketing_influencers_is_active").on(table.isActive),
]);

export const insertMarketingInfluencerSchema = createInsertSchema(marketingInfluencers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MarketingInfluencer = typeof marketingInfluencers.$inferSelect;
export type InsertMarketingInfluencer = z.infer<typeof insertMarketingInfluencerSchema>;

// Influencer Campaign Links - ربط المؤثرين بالحملات
export const influencerCampaignLinks = pgTable("influencer_campaign_links", {
  id: serial("id").primaryKey(),
  influencerId: integer("influencer_id")
    .notNull()
    .references(() => marketingInfluencers.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id")
    .notNull()
    .references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  status: text("status").default("pending").notNull(), // pending, contacted, confirmed, in_progress, completed, cancelled
  contractAmount: real("contract_amount"),
  deliverables: jsonb("deliverables"), // array of expected deliverables
  deliverablesDone: jsonb("deliverables_done"), // array of completed deliverables
  startDate: text("start_date"), // YYYY-MM-DD
  endDate: text("end_date"), // YYYY-MM-DD
  performanceScore: real("performance_score"), // 1-100 score after campaign
  salesImpact: real("sales_impact"), // estimated sales impact in SAR
  engagementGenerated: integer("engagement_generated"),
  impressionsGenerated: integer("impressions_generated"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInfluencerCampaignLinkSchema = createInsertSchema(influencerCampaignLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InfluencerCampaignLink = typeof influencerCampaignLinks.$inferSelect;
export type InsertInfluencerCampaignLink = z.infer<typeof insertInfluencerCampaignLinkSchema>;

// Influencer Contacts Log - سجل التواصل مع المؤثرين
export const influencerContacts = pgTable("influencer_contacts", {
  id: serial("id").primaryKey(),
  influencerId: integer("influencer_id")
    .notNull()
    .references(() => marketingInfluencers.id, { onDelete: "cascade" }),
  contactType: text("contact_type").notNull(), // call, email, whatsapp, meeting, social_dm
  contactDate: text("contact_date").notNull(), // YYYY-MM-DD
  contactTime: text("contact_time"), // HH:MM
  subject: text("subject"),
  notes: text("notes"),
  outcome: text("outcome"), // positive, negative, neutral, follow_up_needed
  nextFollowUp: text("next_follow_up"), // YYYY-MM-DD
  contactedBy: varchar("contacted_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInfluencerContactSchema = createInsertSchema(influencerContacts).omit({
  id: true,
  createdAt: true,
});

export type InfluencerContact = typeof influencerContacts.$inferSelect;
export type InsertInfluencerContact = z.infer<typeof insertInfluencerContactSchema>;

// Influencer Payments/Ledger - كشف حساب المؤثرين
export const influencerPayments = pgTable("influencer_payments", {
  id: serial("id").primaryKey(),
  influencerId: integer("influencer_id")
    .notNull()
    .references(() => marketingInfluencers.id, { onDelete: "cascade" }),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id, { onDelete: "set null" }),
  paymentType: text("payment_type").notNull(), // advance, milestone, final, bonus, refund
  amount: real("amount").notNull(),
  currency: text("currency").default("SAR").notNull(),
  paymentDate: text("payment_date").notNull(), // YYYY-MM-DD
  paymentMethod: text("payment_method"), // bank_transfer, cash, check, online
  referenceNumber: text("reference_number"), // رقم الحوالة أو الشيك
  description: text("description"),
  status: text("status").default("completed").notNull(), // pending, completed, cancelled, refunded
  invoiceNumber: text("invoice_number"),
  attachmentUrl: text("attachment_url"), // رابط الفاتورة أو الإيصال
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInfluencerPaymentSchema = createInsertSchema(influencerPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InfluencerPayment = typeof influencerPayments.$inferSelect;
export type InsertInfluencerPayment = z.infer<typeof insertInfluencerPaymentSchema>;

// Influencer Payment Type Labels
export const INFLUENCER_PAYMENT_TYPE_LABELS: Record<string, string> = {
  advance: "دفعة مقدمة",
  milestone: "دفعة مرحلية",
  final: "دفعة نهائية",
  bonus: "مكافأة",
  refund: "استرداد",
};

// Influencer Payment Method Labels
export const INFLUENCER_PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  cash: "نقدي",
  check: "شيك",
  online: "دفع إلكتروني",
};

// Influencer Payment Status Labels
export const INFLUENCER_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  completed: "مكتمل",
  cancelled: "ملغي",
  refunded: "مسترد",
};

// Marketing Tasks - مهام فريق التسويق
export const marketingTasks = pgTable("marketing_tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id, { onDelete: "set null" }),
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedBy: varchar("assigned_by").references(() => users.id),
  priority: text("priority").default("medium").notNull(), // low, medium, high, urgent
  status: text("status").default("pending").notNull(), // pending, in_progress, completed, cancelled, blocked
  dueDate: text("due_date"), // YYYY-MM-DD
  completedAt: timestamp("completed_at"),
  estimatedHours: real("estimated_hours"),
  actualHours: real("actual_hours"),
  category: text("category"), // content, design, coordination, analysis, other
  attachments: jsonb("attachments"), // array of attachment URLs
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMarketingTaskSchema = createInsertSchema(marketingTasks).omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type MarketingTask = typeof marketingTasks.$inferSelect;
export type InsertMarketingTask = z.infer<typeof insertMarketingTaskSchema>;

// Marketing Task Activities - نشاط المهام
export const marketingTaskActivities = pgTable("marketing_task_activities", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => marketingTasks.id, { onDelete: "cascade" }),
  activityType: text("activity_type").notNull(), // comment, status_change, assignment, attachment, update
  description: text("description"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMarketingTaskActivitySchema = createInsertSchema(marketingTaskActivities).omit({
  id: true,
  createdAt: true,
});

export type MarketingTaskActivity = typeof marketingTaskActivities.$inferSelect;
export type InsertMarketingTaskActivity = z.infer<typeof insertMarketingTaskActivitySchema>;

// Marketing Performance Reports - تقارير أداء التسويق
export const marketingPerformanceReports = pgTable("marketing_performance_reports", {
  id: serial("id").primaryKey(),
  reportType: text("report_type").notNull(), // campaign, influencer, monthly, quarterly, yearly
  periodStart: text("period_start").notNull(), // YYYY-MM-DD
  periodEnd: text("period_end").notNull(), // YYYY-MM-DD
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id, { onDelete: "set null" }),
  branchId: varchar("branch_id").references(() => branches.id),
  // Metrics
  totalSpend: real("total_spend").default(0),
  totalReach: integer("total_reach").default(0),
  totalImpressions: integer("total_impressions").default(0),
  totalEngagement: integer("total_engagement").default(0),
  engagementRate: real("engagement_rate").default(0),
  estimatedSalesImpact: real("estimated_sales_impact").default(0),
  actualSalesImpact: real("actual_sales_impact").default(0),
  roi: real("roi").default(0), // Return on Investment percentage
  costPerEngagement: real("cost_per_engagement").default(0),
  costPerImpression: real("cost_per_impression").default(0),
  // Comparison with previous period
  previousPeriodSales: real("previous_period_sales"),
  salesGrowth: real("sales_growth"), // percentage
  // Additional data
  topPerformingContent: jsonb("top_performing_content"),
  topInfluencers: jsonb("top_influencers"),
  recommendations: jsonb("recommendations"), // AI-generated recommendations
  generatedBy: varchar("generated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMarketingPerformanceReportSchema = createInsertSchema(marketingPerformanceReports).omit({
  id: true,
  createdAt: true,
});

export type MarketingPerformanceReport = typeof marketingPerformanceReports.$inferSelect;
export type InsertMarketingPerformanceReport = z.infer<typeof insertMarketingPerformanceReportSchema>;

// Marketing Assets - الأصول التسويقية (صور، فيديوهات، تصاميم)
export const marketingAssets = pgTable("marketing_assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  assetType: text("asset_type").notNull(), // image, video, document, design, template
  fileUrl: text("file_url"),
  thumbnailUrl: text("thumbnail_url"),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id, { onDelete: "set null" }),
  branchId: varchar("branch_id").references(() => branches.id, { onDelete: "set null" }),
  category: text("category"), // social, print, email, website
  location: text("location"), // مكان التواجد (المخزن، الواجهة، المكتب)
  quantity: integer("quantity").default(1), // الكمية
  description: text("description"), // الوصف
  tags: text("tags").array(),
  fileSize: integer("file_size"), // in bytes
  dimensions: text("dimensions"), // e.g., "1080x1080"
  duration: integer("duration"), // for videos, in seconds
  usageCount: integer("usage_count").default(0),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMarketingAssetSchema = createInsertSchema(marketingAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MarketingAsset = typeof marketingAssets.$inferSelect;
export type InsertMarketingAsset = z.infer<typeof insertMarketingAssetSchema>;

// Marketing Team Members - أعضاء فريق التسويق
export const marketingTeamMembers = pgTable("marketing_team_members", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id")
    .references(() => users.id),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  role: text("role").notNull(), // manager, coordinator, designer, content_creator, analyst
  specialization: text("specialization"), // social_media, influencer_relations, content, analytics
  isTeamLead: boolean("is_team_lead").default(false).notNull(),
  assignedBranches: text("assigned_branches").array(), // branch IDs this member focuses on
  weeklyHoursCapacity: real("weekly_hours_capacity").default(40),
  currentWorkload: real("current_workload").default(0), // calculated from active tasks
  joinDate: text("join_date"), // YYYY-MM-DD
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMarketingTeamMemberSchema = createInsertSchema(marketingTeamMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MarketingTeamMember = typeof marketingTeamMembers.$inferSelect;
export type InsertMarketingTeamMember = z.infer<typeof insertMarketingTeamMemberSchema>;

// Marketing Alerts - تنبيهات التسويق
export const marketingAlerts = pgTable("marketing_alerts", {
  id: serial("id").primaryKey(),
  alertType: text("alert_type").notNull(), // campaign_start, campaign_end, budget_warning, task_overdue, influencer_deadline
  severity: text("severity").notNull(), // info, warning, critical
  title: text("title").notNull(),
  message: text("message").notNull(),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id, { onDelete: "cascade" }),
  taskId: integer("task_id").references(() => marketingTasks.id, { onDelete: "cascade" }),
  targetUserId: varchar("target_user_id").references(() => users.id),
  isRead: boolean("is_read").default(false).notNull(),
  isAcknowledged: boolean("is_acknowledged").default(false).notNull(),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMarketingAlertSchema = createInsertSchema(marketingAlerts).omit({
  id: true,
  acknowledgedAt: true,
  sentAt: true,
  createdAt: true,
});

export type MarketingAlert = typeof marketingAlerts.$inferSelect;
export type InsertMarketingAlert = z.infer<typeof insertMarketingAlertSchema>;

// ==========================================
// نظام إدارة الورديات المتقدم - Advanced Shift Management System
// ==========================================

// Branch Shift Profiles - إعدادات أوقات الورديات حسب الفرع
export const branchShiftProfiles = pgTable("branch_shift_profiles", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  shiftCode: text("shift_code").notNull(), // morning, evening, night, custom
  displayName: text("display_name").notNull(), // الوردية الصباحية، المسائية، الليلية
  startTime: text("start_time").notNull(), // HH:MM format (e.g., "08:00")
  endTime: text("end_time").notNull(), // HH:MM format (e.g., "16:00")
  breakMinutes: integer("break_minutes").default(60), // فترة الاستراحة بالدقائق
  graceMinutesBefore: integer("grace_minutes_before").default(15), // فترة السماح قبل الوقت
  graceMinutesAfter: integer("grace_minutes_after").default(15), // فترة السماح بعد الوقت
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0), // ترتيب العرض
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_branch_shift_profiles_branch").on(table.branchId),
  index("idx_branch_shift_profiles_code").on(table.branchId, table.shiftCode),
]);

export const insertBranchShiftProfileSchema = createInsertSchema(branchShiftProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BranchShiftProfile = typeof branchShiftProfiles.$inferSelect;
export type InsertBranchShiftProfile = z.infer<typeof insertBranchShiftProfileSchema>;

// Schedule Templates - قوالب جداول الورديات
export const scheduleTemplates = pgTable("schedule_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  branchId: varchar("branch_id").references(() => branches.id),
  isDefault: boolean("is_default").default(false),
  weeklyPattern: jsonb("weekly_pattern"), // JSON: {sat: {start, end, isOff}, sun: {...}, ...}
  createdBy: varchar("created_by").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertScheduleTemplateSchema = createInsertSchema(scheduleTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ScheduleTemplate = typeof scheduleTemplates.$inferSelect;
export type InsertScheduleTemplate = z.infer<typeof insertScheduleTemplateSchema>;

// Schedule Periods - فترات الجدول (أسبوعي/شهري)
export const schedulePeriods = pgTable("schedule_periods", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  periodType: text("period_type").notNull(), // weekly, monthly
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD
  status: text("status").default("draft").notNull(), // draft, published, archived
  templateId: integer("template_id").references(() => scheduleTemplates.id),
  requiredStaffPerDay: jsonb("required_staff_per_day"), // {sat: 5, sun: 3, ...}
  notes: text("notes"),
  publishedBy: varchar("published_by").references(() => users.id),
  publishedAt: timestamp("published_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_schedule_periods_branch").on(table.branchId),
  index("idx_schedule_periods_dates").on(table.startDate, table.endDate),
]);

export const insertSchedulePeriodSchema = createInsertSchema(schedulePeriods).omit({
  id: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type SchedulePeriod = typeof schedulePeriods.$inferSelect;
export type InsertSchedulePeriod = z.infer<typeof insertSchedulePeriodSchema>;

// Employee Schedules - جداول الموظفين اليومية
export const employeeSchedules = pgTable("employee_schedules", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id").references(() => schedulePeriods.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull(), // معرف الموظف (قد يكون userId أو branch_emp_XX)
  employeeName: text("employee_name").notNull(),
  branchId: varchar("branch_id").references(() => branches.id), // الفرع
  branchEmployeeId: integer("branch_employee_id"), // ربط مع موظف الفرع (اختياري)
  scheduleDate: text("schedule_date").notNull(), // YYYY-MM-DD
  dayOfWeek: text("day_of_week").notNull(), // sat, sun, mon, tue, wed, thu, fri
  shiftType: text("shift_type"), // morning, evening, night
  startTime: text("start_time"), // HH:MM
  endTime: text("end_time"), // HH:MM
  isOff: boolean("is_off").default(false).notNull(), // يوم إجازة
  breakDuration: integer("break_duration").default(60), // بالدقائق
  status: text("status").default("scheduled").notNull(), // scheduled, completed, cancelled
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_employee_schedules_period").on(table.periodId),
  index("idx_employee_schedules_employee").on(table.employeeId),
  index("idx_employee_schedules_date").on(table.scheduleDate),
  index("idx_employee_schedules_branch").on(table.branchId),
  index("idx_employee_schedules_branch_employee").on(table.branchEmployeeId),
]);

export const insertEmployeeScheduleSchema = createInsertSchema(employeeSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EmployeeSchedule = typeof employeeSchedules.$inferSelect;
export type InsertEmployeeSchedule = z.infer<typeof insertEmployeeScheduleSchema>;

// Weekly Schedule Locks - قفل جدول الدوام الأسبوعي
export const weeklyScheduleLocks = pgTable("weekly_schedule_locks", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  weekStartDate: text("week_start_date").notNull(),
  lockedAt: timestamp("locked_at").defaultNow().notNull(),
  lockedBy: varchar("locked_by").references(() => users.id),
  lockedByName: text("locked_by_name"),
  shiftProfile: text("shift_profile"),
  notes: text("notes"),
}, (table) => [
  index("idx_weekly_locks_branch").on(table.branchId),
  index("idx_weekly_locks_week").on(table.weekStartDate),
  uniqueIndex("idx_weekly_locks_unique").on(table.branchId, table.weekStartDate),
]);

export const insertWeeklyScheduleLockSchema = createInsertSchema(weeklyScheduleLocks).omit({
  id: true,
  lockedAt: true,
});

export type WeeklyScheduleLock = typeof weeklyScheduleLocks.$inferSelect;
export type InsertWeeklyScheduleLock = z.infer<typeof insertWeeklyScheduleLockSchema>;

// Schedule Change Audit Trail - سجل تتبع تعديلات الجدول
export const scheduleChangeAudit = pgTable("schedule_change_audit", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  weekStartDate: text("week_start_date").notNull(),
  employeeId: varchar("employee_id"),
  employeeName: text("employee_name"),
  changeType: text("change_type").notNull(),
  scheduleDate: text("schedule_date"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  changedBy: varchar("changed_by").references(() => users.id),
  changedByName: text("changed_by_name"),
  changeReason: text("change_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_schedule_audit_branch").on(table.branchId),
  index("idx_schedule_audit_week").on(table.weekStartDate),
  index("idx_schedule_audit_employee").on(table.employeeId),
  index("idx_schedule_audit_date").on(table.createdAt),
]);

export const insertScheduleChangeAuditSchema = createInsertSchema(scheduleChangeAudit).omit({
  id: true,
  createdAt: true,
});

export type ScheduleChangeAudit = typeof scheduleChangeAudit.$inferSelect;
export type InsertScheduleChangeAudit = z.infer<typeof insertScheduleChangeAuditSchema>;

// Attendance Records - سجلات الحضور والانصراف
export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id").notNull(), // بدون foreign key لدعم موظفي الفروع بدون حسابات
  employeeName: text("employee_name").notNull(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  branchEmployeeId: integer("branch_employee_id"), // ربط مع موظف الفرع (اختياري)
  scheduleId: integer("schedule_id"),
  attendanceDate: text("attendance_date").notNull(), // YYYY-MM-DD
  scheduledStartTime: text("scheduled_start_time"), // الوقت المجدول للحضور
  scheduledEndTime: text("scheduled_end_time"), // الوقت المجدول للانصراف
  actualCheckIn: text("actual_check_in"), // وقت الحضور الفعلي HH:MM:SS
  actualCheckOut: text("actual_check_out"), // وقت الانصراف الفعلي
  checkInSignature: text("check_in_signature"), // base64 encoded signature
  checkOutSignature: text("check_out_signature"), // base64 encoded signature
  status: text("status").default("pending").notNull(), // pending, present, absent, late, early_leave, on_leave
  lateMinutes: integer("late_minutes").default(0), // دقائق التأخير
  earlyLeaveMinutes: integer("early_leave_minutes").default(0), // دقائق الخروج المبكر
  overtimeMinutes: integer("overtime_minutes").default(0), // دقائق العمل الإضافي
  workingHours: real("working_hours").default(0), // ساعات العمل الفعلية
  biometricVerified: boolean("biometric_verified").default(false),
  biometricCheckIn: boolean("biometric_check_in").default(false),
  biometricCheckOut: boolean("biometric_check_out").default(false),
  deviceInfo: text("device_info"), // معلومات الجهاز (iPad, etc.)
  locationInfo: text("location_info"), // معلومات الموقع
  notes: text("notes"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_attendance_employee").on(table.employeeId),
  index("idx_attendance_branch").on(table.branchId),
  index("idx_attendance_date").on(table.attendanceDate),
  index("idx_attendance_status").on(table.status),
  index("idx_attendance_branch_employee").on(table.branchEmployeeId),
]);

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({
  id: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;

// Time Entries - إدخالات الوقت (التوقيعات)
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  attendanceId: integer("attendance_id").references(() => attendanceRecords.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull(), // بدون foreign key لدعم موظفي الفروع بدون حسابات
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  entryType: text("entry_type").notNull(), // check_in, check_out, break_start, break_end
  entryTime: timestamp("entry_time").defaultNow().notNull(),
  signature: text("signature"), // base64 encoded signature image
  signatureType: text("signature_type"), // digital, biometric
  deviceId: text("device_id"), // iPad ID or device identifier
  ipAddress: text("ip_address"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  isVerified: boolean("is_verified").default(false),
  verifiedBy: varchar("verified_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_time_entries_attendance").on(table.attendanceId),
  index("idx_time_entries_employee").on(table.employeeId),
  index("idx_time_entries_branch").on(table.branchId),
]);

export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({
  id: true,
  createdAt: true,
});

export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;

// Attendance Summary - ملخص الحضور الشهري
export const attendanceSummary = pgTable("attendance_summary", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id").notNull(), // بدون foreign key لدعم موظفي الفروع بدون حسابات
  employeeName: text("employee_name").notNull(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  periodMonth: text("period_month").notNull(), // YYYY-MM
  totalScheduledDays: integer("total_scheduled_days").default(0),
  totalPresentDays: integer("total_present_days").default(0),
  totalAbsentDays: integer("total_absent_days").default(0),
  totalLateDays: integer("total_late_days").default(0),
  totalEarlyLeaveDays: integer("total_early_leave_days").default(0),
  totalLeaveDays: integer("total_leave_days").default(0),
  totalWorkingHours: real("total_working_hours").default(0),
  totalOvertimeHours: real("total_overtime_hours").default(0),
  totalLateMinutes: integer("total_late_minutes").default(0),
  totalEarlyLeaveMinutes: integer("total_early_leave_minutes").default(0),
  attendanceRate: real("attendance_rate").default(0), // نسبة الحضور %
  punctualityRate: real("punctuality_rate").default(0), // نسبة الالتزام بالوقت %
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_attendance_summary_employee").on(table.employeeId),
  index("idx_attendance_summary_branch").on(table.branchId),
  index("idx_attendance_summary_month").on(table.periodMonth),
]);

export const insertAttendanceSummarySchema = createInsertSchema(attendanceSummary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AttendanceSummary = typeof attendanceSummary.$inferSelect;
export type InsertAttendanceSummary = z.infer<typeof insertAttendanceSummarySchema>;

// Attendance Status Labels
export const ATTENDANCE_STATUS = ["pending", "present", "absent", "late", "early_leave", "on_leave"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  pending: "في انتظار",
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  early_leave: "خروج مبكر",
  on_leave: "في إجازة",
};

export const ATTENDANCE_STATUS_ICONS: Record<AttendanceStatus, string> = {
  pending: "🔘",
  present: "✅",
  absent: "❌",
  late: "🟡",
  early_leave: "🔵",
  on_leave: "🟠",
};

// Days of Week (Arabic)
export const DAYS_OF_WEEK = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DAYS_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  sat: "السبت",
  sun: "الأحد",
  mon: "الاثنين",
  tue: "الثلاثاء",
  wed: "الأربعاء",
  thu: "الخميس",
  fri: "الجمعة",
};

// Timesheet Reports - تقارير الدوام الشهرية
export const timesheetReports = pgTable("timesheet_reports", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id").notNull(), // بدون foreign key لدعم موظفي الفروع بدون حسابات
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  branchEmployeeId: integer("branch_employee_id"), // ربط مع موظف الفرع (اختياري)
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD
  generatedBy: varchar("generated_by").references(() => users.id),
  status: text("status").default("pending").notNull(), // pending, pending_employee_signature, pending_manager_signature, finalized
  totalScheduledDays: integer("total_scheduled_days").default(0),
  totalPresentDays: integer("total_present_days").default(0),
  totalAbsentDays: integer("total_absent_days").default(0),
  totalLateDays: integer("total_late_days").default(0),
  totalScheduledHours: real("total_scheduled_hours").default(0),
  totalActualHours: real("total_actual_hours").default(0),
  totalOvertimeMinutes: integer("total_overtime_minutes").default(0),
  totalLateMinutes: integer("total_late_minutes").default(0),
  employeeSignature: text("employee_signature"), // base64 encoded signature
  employeeSignedAt: timestamp("employee_signed_at"),
  employeeAcknowledgment: text("employee_acknowledgment"),
  managerSignature: text("manager_signature"), // base64 encoded signature
  managerId: varchar("manager_id").references(() => users.id),
  managerSignedAt: timestamp("manager_signed_at"),
  managerAcknowledgment: text("manager_acknowledgment"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_timesheet_reports_employee").on(table.employeeId),
  index("idx_timesheet_reports_branch").on(table.branchId),
  index("idx_timesheet_reports_status").on(table.status),
  index("idx_timesheet_reports_dates").on(table.startDate, table.endDate),
  index("idx_timesheet_reports_branch_employee").on(table.branchEmployeeId),
]);

export const insertTimesheetReportSchema = createInsertSchema(timesheetReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TimesheetReport = typeof timesheetReports.$inferSelect;
export type InsertTimesheetReport = z.infer<typeof insertTimesheetReportSchema>;

// Timesheet Report Entries - سجلات التقرير اليومية
export const timesheetReportEntries = pgTable("timesheet_report_entries", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull().references(() => timesheetReports.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  dayOfWeek: text("day_of_week").notNull(), // sat, sun, mon, etc.
  scheduledStartTime: text("scheduled_start_time"), // HH:MM
  scheduledEndTime: text("scheduled_end_time"), // HH:MM
  actualStartTime: text("actual_start_time"), // HH:MM
  actualEndTime: text("actual_end_time"), // HH:MM
  isOff: boolean("is_off").default(false),
  status: text("status").default("pending"), // pending, present, absent, late, day_off
  scheduledHours: real("scheduled_hours").default(0),
  actualHours: real("actual_hours").default(0),
  overtimeMinutes: integer("overtime_minutes").default(0),
  lateMinutes: integer("late_minutes").default(0),
  notes: text("notes"),
  checkInSignature: text("check_in_signature"), // base64 signature from daily attendance
  checkOutSignature: text("check_out_signature"), // base64 signature from daily attendance
}, (table) => [
  index("idx_timesheet_entries_report").on(table.reportId),
  index("idx_timesheet_entries_date").on(table.date),
]);

export const insertTimesheetReportEntrySchema = createInsertSchema(timesheetReportEntries).omit({
  id: true,
});

export type TimesheetReportEntry = typeof timesheetReportEntries.$inferSelect;
export type InsertTimesheetReportEntry = z.infer<typeof insertTimesheetReportEntrySchema>;

// Timesheet Status Labels
export const TIMESHEET_STATUS = ["pending", "pending_employee_signature", "pending_manager_signature", "finalized"] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUS)[number];

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  pending: "قيد الإنشاء",
  pending_employee_signature: "بانتظار توقيع الموظف",
  pending_manager_signature: "بانتظار توقيع المدير",
  finalized: "مكتمل",
};

// =====================================================
// Branch Employees - موظفي الفروع مع بيانات الرواتب
// =====================================================
export const branchEmployees = pgTable("branch_employees", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  linkedUserId: varchar("linked_user_id").references(() => users.id), // ربط بحساب المستخدم (للدخول للنظام)
  defaultScheduleTemplateId: integer("default_schedule_template_id").references(() => scheduleTemplates.id), // قالب الجدولة الافتراضي
  employeeNumber: text("employee_number"), // رقم الموظف الوظيفي MED-00001
  employeeName: text("employee_name").notNull(),
  employeeNameEn: text("employee_name_en"), // الاسم بالإنجليزية
  jobTitle: text("job_title").notNull(), // الوظيفة
  department: text("department"), // القسم (مطبخ، صالة، إلخ)
  nationality: text("nationality").notNull(), // الجنسية
  salary: real("salary").notNull(), // الراتب الأساسي
  housingAllowance: real("housing_allowance").default(0), // بدل السكن
  transportAllowance: real("transport_allowance").default(0), // بدل المواصلات
  foodAllowance: real("food_allowance").default(0), // بدل الطعام
  otherAllowances: real("other_allowances").default(0), // بدلات أخرى
  socialInsuranceDeduction: real("social_insurance_deduction").default(0), // خصم التأمينات الاجتماعية للسعوديين
  totalSalary: real("total_salary"), // إجمالي الراتب
  hireDate: text("hire_date"), // تاريخ التعيين
  healthCertificate: text("health_certificate").default("none"), // شهادة صحية: none, valid, expired
  healthCertificateExpiry: text("health_certificate_expiry"), // تاريخ انتهاء الشهادة الصحية
  iqamaNumber: text("iqama_number"), // رقم الإقامة
  iqamaExpiry: text("iqama_expiry"), // تاريخ انتهاء الإقامة
  passportNumber: text("passport_number"), // رقم الجواز
  passportExpiry: text("passport_expiry"), // تاريخ انتهاء الجواز
  phoneNumber: text("phone_number"), // رقم الجوال
  emergencyContact: text("emergency_contact"), // رقم الطوارئ
  bankName: text("bank_name"), // اسم البنك
  bankAccountNumber: text("bank_account_number"), // رقم الحساب البنكي
  status: text("status").default("active").notNull(), // active, inactive, terminated, on_leave
  contractType: text("contract_type").default("full_time"), // full_time, part_time, contract
  workPermitNumber: text("work_permit_number"), // رقم رخصة العمل
  notes: text("notes"), // ملاحظات
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_branch_employees_branch").on(table.branchId),
  index("idx_branch_employees_nationality").on(table.nationality),
  index("idx_branch_employees_status").on(table.status),
  index("idx_branch_employees_job").on(table.jobTitle),
  index("idx_branch_employees_linked_user").on(table.linkedUserId),
]);

export const insertBranchEmployeeSchema = createInsertSchema(branchEmployees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BranchEmployee = typeof branchEmployees.$inferSelect;
export type InsertBranchEmployee = z.infer<typeof insertBranchEmployeeSchema>;

// Branch Job Titles - وظائف موظفي الفروع
export const BRANCH_JOB_TITLES = [
  "كاشير",
  "مشرف",
  "مدير صالة",
  "معبأ طلبات",
  "بيكري",
  "بستري",
  "ساندويتشات",
  "بيتزا",
  "باريستا",
  "واتر",
  "عامل",
  "أمين مستودع",
  "سائق",
  "حارس أمن",
] as const;

// Nationalities - الجنسيات
export const NATIONALITIES = [
  "سعودي",
  "مصري",
  "سوري",
  "نيبالي",
  "بنجلاديشي",
  "فلبيني",
  "بورمي",
  "هندي",
  "باكستاني",
  "يمني",
  "سوداني",
  "إندونيسي",
  "إثيوبي",
  "أخرى",
] as const;

// Health Certificate Status
export const HEALTH_CERT_STATUS = ["none", "valid", "expired", "pending"] as const;
export type HealthCertStatus = (typeof HEALTH_CERT_STATUS)[number];

export const HEALTH_CERT_LABELS: Record<HealthCertStatus, string> = {
  none: "لا يوجد",
  valid: "سارية",
  expired: "منتهية",
  pending: "قيد التجديد",
};

// Employee Status
export const EMPLOYEE_STATUS = ["active", "inactive", "terminated", "on_leave"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUS)[number];

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: "نشط",
  inactive: "غير نشط",
  terminated: "منتهي",
  on_leave: "إجازة",
};

// Organizational Job Roles - الهيكل الوظيفي
export const orgJobRoles = pgTable("org_job_roles", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  parentId: integer("parent_id"),
  level: integer("level").notNull().default(1),
  orderIndex: integer("order_index").notNull().default(0),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  summaryAr: text("summary_ar"),
  summaryEn: text("summary_en"),
  responsibilitiesAr: jsonb("responsibilities_ar").$type<string[]>().default([]),
  responsibilitiesEn: jsonb("responsibilities_en").$type<string[]>().default([]),
  qualificationsAr: jsonb("qualifications_ar").$type<string[]>().default([]),
  qualificationsEn: jsonb("qualifications_en").$type<string[]>().default([]),
  icon: text("icon").default("user"),
  color: text("color").default("bg-amber-500"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_org_job_roles_parent").on(table.parentId),
  index("idx_org_job_roles_level").on(table.level),
  index("idx_org_job_roles_active").on(table.isActive),
]);

export const insertOrgJobRoleSchema = createInsertSchema(orgJobRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type OrgJobRole = typeof orgJobRoles.$inferSelect;
export type InsertOrgJobRole = z.infer<typeof insertOrgJobRoleSchema>;

// Employee Settings - إعدادات بيانات الموظفين (القوائم المنسدلة)
export const employeeSettings = pgTable("employee_settings", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // nationality, job_title, status, health_cert, contract_type, department, bank
  value: text("value").notNull(), // القيمة الفعلية
  labelAr: text("label_ar").notNull(), // التسمية بالعربي
  labelEn: text("label_en"), // التسمية بالإنجليزي (اختياري)
  color: text("color"), // لون البادج (اختياري)
  icon: text("icon"), // أيقونة (اختياري)
  orderIndex: integer("order_index").default(0).notNull(), // ترتيب العرض
  isActive: boolean("is_active").default(true).notNull(), // نشط/غير نشط
  isDefault: boolean("is_default").default(false).notNull(), // القيمة الافتراضية
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_employee_settings_category").on(table.category),
  index("idx_employee_settings_active").on(table.isActive),
]);

export const insertEmployeeSettingSchema = createInsertSchema(employeeSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EmployeeSetting = typeof employeeSettings.$inferSelect;
export type InsertEmployeeSetting = z.infer<typeof insertEmployeeSettingSchema>;

// Employee Setting Categories - فئات الإعدادات
export const EMPLOYEE_SETTING_CATEGORIES = [
  { value: "nationality", labelAr: "الجنسيات", labelEn: "Nationalities" },
  { value: "job_title", labelAr: "الوظائف", labelEn: "Job Titles" },
  { value: "department", labelAr: "الأقسام", labelEn: "Departments" },
  { value: "contract_type", labelAr: "أنواع العقود", labelEn: "Contract Types" },
  { value: "bank", labelAr: "البنوك", labelEn: "Banks" },
] as const;

// Employee Transfer Status
export const TRANSFER_STATUS = [
  "pending",
  "source_approved",
  "dest_approved", 
  "hr_approved",
  "completed",
  "rejected",
  "cancelled"
] as const;

export type TransferStatus = typeof TRANSFER_STATUS[number];

// Employee Transfer Requests - طلبات نقل الموظفين
export const employeeTransferRequests = pgTable("employee_transfer_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => branchEmployees.id),
  sourceBranchId: varchar("source_branch_id").notNull().references(() => branches.id),
  destinationBranchId: varchar("destination_branch_id").notNull().references(() => branches.id),
  requestedBy: varchar("requested_by").notNull().references(() => users.id),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  effectiveDate: text("effective_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status").default("pending").notNull(),
  currentApproverRole: text("current_approver_role").default("source_manager"),
  rejectionReason: text("rejection_reason"),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_transfer_employee").on(table.employeeId),
  index("idx_transfer_source").on(table.sourceBranchId),
  index("idx_transfer_dest").on(table.destinationBranchId),
  index("idx_transfer_status").on(table.status),
  index("idx_transfer_requested_by").on(table.requestedBy),
]);

export const insertEmployeeTransferRequestSchema = createInsertSchema(employeeTransferRequests).omit({
  id: true,
  requestedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type EmployeeTransferRequest = typeof employeeTransferRequests.$inferSelect;
export type InsertEmployeeTransferRequest = z.infer<typeof insertEmployeeTransferRequestSchema>;

// Transfer Approval Steps - خطوات الموافقة على النقل
export const transferApprovalSteps = pgTable("transfer_approval_steps", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull().references(() => employeeTransferRequests.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull(),
  approverRole: text("approver_role").notNull(),
  approverId: varchar("approver_id").references(() => users.id),
  status: text("status").default("pending").notNull(),
  actionTakenAt: timestamp("action_taken_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_approval_transfer").on(table.transferId),
  index("idx_approval_approver").on(table.approverId),
  index("idx_approval_status").on(table.status),
]);

export const insertTransferApprovalStepSchema = createInsertSchema(transferApprovalSteps).omit({
  id: true,
  actionTakenAt: true,
  createdAt: true,
});

export type TransferApprovalStep = typeof transferApprovalSteps.$inferSelect;
export type InsertTransferApprovalStep = z.infer<typeof insertTransferApprovalStepSchema>;

// Transfer History/Audit Log - سجل تاريخ النقل
export const transferHistory = pgTable("transfer_history", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id").notNull().references(() => employeeTransferRequests.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  performedBy: varchar("performed_by").references(() => users.id),
  details: jsonb("details"),
  eventTimestamp: timestamp("event_timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_history_transfer").on(table.transferId),
  index("idx_history_event").on(table.eventType),
]);

// ==================== P&L (Profit & Loss) Dashboard Tables ====================

// Financial Periods - الفترات المالية
export const financialPeriods = pgTable("financial_periods", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  periodType: text("period_type").notNull().default("monthly"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  targetRevenue: real("target_revenue").default(0),
  targetGrossMargin: real("target_gross_margin").default(0),
  targetNetMargin: real("target_net_margin").default(0),
  status: text("status").default("draft"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_financial_periods_branch").on(table.branchId),
  index("idx_financial_periods_date").on(table.year, table.month),
]);

export const insertFinancialPeriodSchema = createInsertSchema(financialPeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FinancialPeriod = typeof financialPeriods.$inferSelect;
export type InsertFinancialPeriod = z.infer<typeof insertFinancialPeriodSchema>;

// Sales Channels Enum
export const SALES_CHANNELS = ["cash", "card", "delivery_apps", "online", "other"] as const;
export type SalesChannel = typeof SALES_CHANNELS[number];

// Financial Sales - المبيعات المالية
export const financialSales = pgTable("financial_sales", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id").notNull().references(() => financialPeriods.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  category: text("category"),
  shift: text("shift"),
  totalAmount: real("total_amount").notNull().default(0),
  invoiceCount: integer("invoice_count").default(0),
  avgInvoiceValue: real("avg_invoice_value").default(0),
  date: text("date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_financial_sales_period").on(table.periodId),
  index("idx_financial_sales_channel").on(table.channel),
]);

export const insertFinancialSalesSchema = createInsertSchema(financialSales).omit({
  id: true,
  createdAt: true,
});

export type FinancialSales = typeof financialSales.$inferSelect;
export type InsertFinancialSales = z.infer<typeof insertFinancialSalesSchema>;

// COGS Item Types Enum
export const COGS_ITEM_TYPES = ["raw_materials", "production", "packaging", "waste", "delivery", "other"] as const;
export type COGSItemType = typeof COGS_ITEM_TYPES[number];

// Financial COGS (Cost of Goods Sold) - تكلفة البضائع المباعة
export const financialCOGS = pgTable("financial_cogs", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id").notNull().references(() => financialPeriods.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(),
  amount: real("amount").notNull().default(0),
  wasteAmount: real("waste_amount").default(0),
  wastePct: real("waste_pct").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_financial_cogs_period").on(table.periodId),
  index("idx_financial_cogs_type").on(table.itemType),
]);

export const insertFinancialCOGSSchema = createInsertSchema(financialCOGS).omit({
  id: true,
  createdAt: true,
});

export type FinancialCOGS = typeof financialCOGS.$inferSelect;
export type InsertFinancialCOGS = z.infer<typeof insertFinancialCOGSSchema>;

// Operating Expense Types Enum
export const OPERATING_EXPENSE_TYPES = [
  "salaries", "insurance", "electricity", "water", "internet", 
  "cleaning", "maintenance", "marketing", "supplies", "other"
] as const;
export type OperatingExpenseType = typeof OPERATING_EXPENSE_TYPES[number];

// Financial Operating Expenses - المصروفات التشغيلية
export const financialOperatingExpenses = pgTable("financial_operating_expenses", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id").notNull().references(() => financialPeriods.id, { onDelete: "cascade" }),
  expenseType: text("expense_type").notNull(),
  amount: real("amount").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_financial_opex_period").on(table.periodId),
  index("idx_financial_opex_type").on(table.expenseType),
]);

export const insertFinancialOperatingExpenseSchema = createInsertSchema(financialOperatingExpenses).omit({
  id: true,
  createdAt: true,
});

export type FinancialOperatingExpense = typeof financialOperatingExpenses.$inferSelect;
export type InsertFinancialOperatingExpense = z.infer<typeof insertFinancialOperatingExpenseSchema>;

// Fixed Cost Types Enum
export const FIXED_COST_TYPES = [
  "rent", "licenses", "taxes", "zakat", "subscriptions", "insurance", "other"
] as const;
export type FixedCostType = typeof FIXED_COST_TYPES[number];

// Financial Fixed Costs - التكاليف الثابتة
export const financialFixedCosts = pgTable("financial_fixed_costs", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id").notNull().references(() => financialPeriods.id, { onDelete: "cascade" }),
  costType: text("cost_type").notNull(),
  amount: real("amount").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_financial_fixed_period").on(table.periodId),
  index("idx_financial_fixed_type").on(table.costType),
]);

export const insertFinancialFixedCostSchema = createInsertSchema(financialFixedCosts).omit({
  id: true,
  createdAt: true,
});

export type FinancialFixedCost = typeof financialFixedCosts.$inferSelect;
export type InsertFinancialFixedCost = z.infer<typeof insertFinancialFixedCostSchema>;

// Branch Performance Rating
export const PERFORMANCE_RATINGS = ["excellent", "good", "average", "poor"] as const;
export type PerformanceRating = typeof PERFORMANCE_RATINGS[number];

// Financial Metrics Cache - تخزين المؤشرات المالية
export const financialMetrics = pgTable("financial_metrics", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id").notNull().references(() => financialPeriods.id, { onDelete: "cascade" }),
  totalRevenue: real("total_revenue").default(0),
  totalCOGS: real("total_cogs").default(0),
  totalOperatingExpenses: real("total_operating_expenses").default(0),
  totalFixedCosts: real("total_fixed_costs").default(0),
  grossProfit: real("gross_profit").default(0),
  netProfit: real("net_profit").default(0),
  grossMarginPct: real("gross_margin_pct").default(0),
  netMarginPct: real("net_margin_pct").default(0),
  breakEvenSales: real("break_even_sales").default(0),
  salaryToSalesPct: real("salary_to_sales_pct").default(0),
  rentToRevenuePct: real("rent_to_revenue_pct").default(0),
  wastePct: real("waste_pct").default(0),
  invoiceCount: integer("invoice_count").default(0),
  avgInvoiceValue: real("avg_invoice_value").default(0),
  ebitda: real("ebitda").default(0),
  ebitdaMarginPct: real("ebitda_margin_pct").default(0),
  contributionMargin: real("contribution_margin").default(0),
  contributionMarginPct: real("contribution_margin_pct").default(0),
  laborProductivity: real("labor_productivity").default(0),
  revenuePerEmployee: real("revenue_per_employee").default(0),
  employeeCount: integer("employee_count").default(0),
  operatingProfit: real("operating_profit").default(0),
  operatingMarginPct: real("operating_margin_pct").default(0),
  rating: text("rating").default("average"),
  ratingReasons: jsonb("rating_reasons"),
  recommendations: jsonb("recommendations"),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_financial_metrics_period").on(table.periodId),
  index("idx_financial_metrics_rating").on(table.rating),
]);

export const insertFinancialMetricsSchema = createInsertSchema(financialMetrics).omit({
  id: true,
  calculatedAt: true,
});

export type FinancialMetrics = typeof financialMetrics.$inferSelect;
export type InsertFinancialMetrics = z.infer<typeof insertFinancialMetricsSchema>;

// P&L Arabic Labels
export const PNL_LABELS = {
  channels: {
    cash: "نقدي",
    card: "شبكة",
    delivery_apps: "تطبيقات التوصيل",
    online: "أونلاين",
    other: "أخرى",
  },
  cogs: {
    raw_materials: "المواد الخام",
    production: "الإنتاج",
    packaging: "التعبئة والتغليف",
    waste: "الهدر والفاقد",
    delivery: "النقل والتوصيل",
    other: "أخرى",
  },
  opex: {
    salaries: "الرواتب",
    insurance: "التأمينات",
    electricity: "الكهرباء",
    water: "المياه",
    internet: "الإنترنت والاتصالات",
    cleaning: "مواد النظافة",
    maintenance: "الصيانة",
    marketing: "التسويق",
    supplies: "المستلزمات",
    other: "مصروفات أخرى",
  },
  fixed: {
    rent: "الإيجار",
    licenses: "رسوم التراخيص",
    taxes: "الضرائب",
    zakat: "الزكاة",
    subscriptions: "الاشتراكات الشهرية",
    insurance: "التأمين",
    other: "أخرى",
  },
  ratings: {
    excellent: { label: "ممتاز", color: "#22c55e", icon: "🟢" },
    good: { label: "جيد", color: "#eab308", icon: "🟡" },
    average: { label: "متوسط", color: "#f97316", icon: "🟠" },
    poor: { label: "ضعيف", color: "#ef4444", icon: "🔴" },
  },
} as const;

// ==================== Enhanced P&L System - إعدادات الأرباح والخسائر المحسنة ====================

// Branch Fixed Settings for P&L - إعدادات ثابتة لكل فرع
export const pnlBranchSettings = pgTable("pnl_branch_settings", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  monthlyRent: real("monthly_rent").default(0), // الإيجار الشهري الثابت
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pnl_branch_settings_branch").on(table.branchId),
]);

export const insertPnlBranchSettingsSchema = createInsertSchema(pnlBranchSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PnlBranchSettings = typeof pnlBranchSettings.$inferSelect;
export type InsertPnlBranchSettings = z.infer<typeof insertPnlBranchSettingsSchema>;

// Monthly variable inputs for P&L - الإدخالات الشهرية المتغيرة
export const pnlMonthlyInputs = pgTable("pnl_monthly_inputs", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  // المرافق والخدمات
  electricityCost: real("electricity_cost").default(0), // تكلفة الكهرباء
  waterCost: real("water_cost").default(0), // تكلفة المياه
  utilitiesOther: real("utilities_other").default(0), // مصاريف خدمات أخرى
  // تكلفة البضاعة المباعة
  cogsCost: real("cogs_cost").default(0), // تكلفة البضاعة المباعة
  cogsNotes: text("cogs_notes"),
  // تكاليف أخرى متنوعة
  maintenanceCost: real("maintenance_cost").default(0), // صيانة
  marketingCost: real("marketing_cost").default(0), // تسويق
  suppliesCost: real("supplies_cost").default(0), // مستلزمات
  otherCosts: real("other_costs").default(0), // تكاليف أخرى
  otherCostsDetails: text("other_costs_details"), // تفاصيل التكاليف الأخرى (JSON)
  // ملاحظات وتتبع
  notes: text("notes"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pnl_monthly_inputs_branch").on(table.branchId),
  index("idx_pnl_monthly_inputs_period").on(table.year, table.month),
  index("idx_pnl_monthly_inputs_branch_period").on(table.branchId, table.year, table.month),
]);

export const insertPnlMonthlyInputsSchema = createInsertSchema(pnlMonthlyInputs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PnlMonthlyInputs = typeof pnlMonthlyInputs.$inferSelect;
export type InsertPnlMonthlyInputs = z.infer<typeof insertPnlMonthlyInputsSchema>;

// ==================== Production vs Sales Comparison System ====================

// Daily Sales Data for Comparison - بيانات المبيعات اليومية للمقارنة
export const dailySalesData = pgTable("daily_sales_data", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  salesDate: date("sales_date").notNull(),
  productName: text("product_name").notNull(),
  productCategory: text("product_category"),
  quantitySold: integer("quantity_sold").default(0),
  salesValue: real("sales_value").default(0),
  unitPrice: real("unit_price"),
  uploadId: integer("upload_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_daily_sales_branch").on(table.branchId),
  index("idx_daily_sales_date").on(table.salesDate),
  index("idx_daily_sales_product").on(table.productName),
  index("idx_daily_sales_upload").on(table.uploadId),
]);

export const insertDailySalesDataSchema = createInsertSchema(dailySalesData).omit({
  id: true,
  createdAt: true,
});

export type DailySalesData = typeof dailySalesData.$inferSelect;
export type InsertDailySalesData = z.infer<typeof insertDailySalesDataSchema>;

// Production vs Sales Comparison Uploads - ملفات رفع المقارنات
export const comparisonUploads = pgTable("comparison_uploads", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").default("excel"),
  dataType: text("data_type").notNull(), // 'sales' or 'production'
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  totalRecords: integer("total_records").default(0),
  totalValue: real("total_value").default(0),
  uniqueProducts: integer("unique_products").default(0),
  status: text("status").default("pending"), // pending, processing, completed, failed
  errorMessage: text("error_message"),
  uploadedBy: varchar("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_comparison_uploads_branch").on(table.branchId),
  index("idx_comparison_uploads_type").on(table.dataType),
  index("idx_comparison_uploads_status").on(table.status),
]);

export const insertComparisonUploadSchema = createInsertSchema(comparisonUploads).omit({
  id: true,
  createdAt: true,
});

export type ComparisonUpload = typeof comparisonUploads.$inferSelect;
export type InsertComparisonUpload = z.infer<typeof insertComparisonUploadSchema>;

// Daily Production vs Sales Comparison - مقارنة الإنتاج والمبيعات اليومية
export const dailyComparisons = pgTable("daily_comparisons", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  comparisonDate: date("comparison_date").notNull(),
  productName: text("product_name").notNull(),
  productCategory: text("product_category"),
  producedQuantity: integer("produced_quantity").default(0),
  soldQuantity: integer("sold_quantity").default(0),
  difference: integer("difference").default(0), // produced - sold
  differencePercent: real("difference_percent").default(0),
  productionValue: real("production_value").default(0),
  salesValue: real("sales_value").default(0),
  valueDifference: real("value_difference").default(0),
  wasteValue: real("waste_value").default(0), // قيمة الهدر المالية
  isStorable: boolean("is_storable").default(false),
  storageNotes: text("storage_notes"),
  status: text("status").default("normal"), // normal, waste, shortage, stored
  statusChangedBy: varchar("status_changed_by"), // من قام بتغيير الحالة
  statusChangedAt: timestamp("status_changed_at"), // متى تم تغيير الحالة
  statusReason: text("status_reason"), // سبب تغيير الحالة
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_daily_comparisons_branch").on(table.branchId),
  index("idx_daily_comparisons_date").on(table.comparisonDate),
  index("idx_daily_comparisons_product").on(table.productName),
  index("idx_daily_comparisons_category").on(table.productCategory),
  index("idx_daily_comparisons_status").on(table.status),
]);

export const insertDailyComparisonSchema = createInsertSchema(dailyComparisons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DailyComparison = typeof dailyComparisons.$inferSelect;
export type InsertDailyComparison = z.infer<typeof insertDailyComparisonSchema>;

// Comparison Summary - ملخص المقارنات
export const comparisonSummaries = pgTable("comparison_summaries", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  periodType: text("period_type").notNull(), // daily, weekly, monthly
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  totalProduced: integer("total_produced").default(0),
  totalSold: integer("total_sold").default(0),
  totalWaste: integer("total_waste").default(0),
  totalShortage: integer("total_shortage").default(0),
  productionValue: real("production_value").default(0),
  salesValue: real("sales_value").default(0),
  wasteValue: real("waste_value").default(0),
  wastePercent: real("waste_percent").default(0),
  shortagePercent: real("shortage_percent").default(0),
  efficiencyScore: real("efficiency_score").default(0),
  topWasteProducts: jsonb("top_waste_products"),
  topShortageProducts: jsonb("top_shortage_products"),
  categoryBreakdown: jsonb("category_breakdown"),
  recommendations: jsonb("recommendations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_comparison_summaries_branch").on(table.branchId),
  index("idx_comparison_summaries_period").on(table.periodType),
  index("idx_comparison_summaries_dates").on(table.periodStart, table.periodEnd),
]);

export const insertComparisonSummarySchema = createInsertSchema(comparisonSummaries).omit({
  id: true,
  createdAt: true,
});

export type ComparisonSummary = typeof comparisonSummaries.$inferSelect;
export type InsertComparisonSummary = z.infer<typeof insertComparisonSummarySchema>;

// Product Storage Settings - إعدادات تخزين المنتجات
export const productStorageSettings = pgTable("product_storage_settings", {
  id: serial("id").primaryKey(),
  productName: text("product_name").notNull().unique(),
  productCategory: text("product_category"),
  suggestedCategory: text("suggested_category"), // الفئة المقترحة تلقائياً
  confidenceScore: integer("confidence_score").default(0), // نسبة الثقة في الاقتراح
  isVerified: boolean("is_verified").default(false), // هل تم التحقق من الفئة
  verifiedBy: varchar("verified_by"), // من قام بالتحقق
  verifiedAt: timestamp("verified_at"), // متى تم التحقق
  isStorable: boolean("is_storable").default(false),
  maxStorageDays: integer("max_storage_days").default(0),
  storageType: text("storage_type"), // freezer, refrigerator, room_temp
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by"),
}, (table) => [
  index("idx_product_storage_name").on(table.productName),
  index("idx_product_storage_category").on(table.productCategory),
  index("idx_product_storage_verified").on(table.isVerified),
]);

export const insertProductStorageSettingSchema = createInsertSchema(productStorageSettings).omit({
  id: true,
  createdAt: true,
});

export type ProductStorageSetting = typeof productStorageSettings.$inferSelect;
export type InsertProductStorageSetting = z.infer<typeof insertProductStorageSettingSchema>;

// Comparison Categories Labels
export const COMPARISON_CATEGORIES = ["إفطار", "مخبوزات", "حلويات", "بيتزا", "باريستا", "تجمعات", "أخرى"] as const;
export type ComparisonCategory = typeof COMPARISON_CATEGORIES[number];

// Categories that are made-to-order (no waste possible) - excluded from waste calculations
// باريستا (Drinks) and بيتزا (Pizza) are made when customer orders, so no excess production
export const MADE_TO_ORDER_CATEGORIES = ["باريستا", "بيتزا"] as const;
export type MadeToOrderCategory = typeof MADE_TO_ORDER_CATEGORIES[number];

// Helper function to check if a category is made-to-order
export function isMadeToOrderCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return (MADE_TO_ORDER_CATEGORIES as readonly string[]).includes(category);
}

// Keyword-based category rules for auto-classification
// Each rule maps keywords (Arabic/English) to a category
export const CATEGORY_KEYWORD_RULES: Record<string, string[]> = {
  "باريستا": [
    // Coffee drinks
    "coffee", "كوفي", "قهوة", "لاتيه", "latte", "كابتشينو", "cappuccino",
    "اسبريسو", "espresso", "موكا", "mocha", "امريكانو", "americano",
    "فلات وايت", "flat white", "ماكياتو", "macchiato", "v60", "في 60",
    "cold brew", "كولد برو", "ice coffee", "ايس كوفي",
    // Other drinks
    "هوت شوكليت", "hot chocolate", "شوكولاته ساخنة", "ماتشا", "matcha",
    "شاي", "tea", "عصير", "juice", "سموذي", "smoothie", "ميلك شيك", "milkshake",
    "فرابي", "frappe", "spanish latte", "سبانش لاتيه",
    // Barista keywords
    "barista", "باريستا"
  ],
  "بيتزا": [
    "pizza", "بيتزا", "بيتسا", "مارغريتا", "margherita", "ببروني", "pepperoni"
  ],
  "إفطار": [
    "breakfast", "إفطار", "فطور", "eggs", "بيض", "benedict", "بينيديكت",
    "أومليت", "omelette", "فول", "شكشوكة", "shakshuka", "توست فرنسي", "french toast",
    "بانكيك", "pancake", "وافل", "waffle", "croissant egg", "كرواسون بيض",
    "bruschetta egg", "بروسكيتا بيض", "ساندويتش صباحي"
  ],
  "مخبوزات": [
    "croissant", "كرواسون", "دانش", "danish", "بريوش", "brioche",
    "باجيت", "baguette", "خبز", "bread", "سندويتش", "sandwich", "ساندوتش",
    "بان", "bun", "رول", "roll", "فوكاتشا", "focaccia", "سيجنتشر",
    "signature", "حلومي", "halloumi", "تونا", "tuna", "تركي", "turkey",
    "سمون", "salmon", "افوكادو", "avocado"
  ],
  "حلويات": [
    "cake", "كيك", "تشيز كيك", "cheesecake", "تارت", "tart", "براوني", "brownie",
    "كوكي", "cookie", "مافن", "muffin", "تيراميسو", "tiramisu", "بودنج", "pudding",
    "كريم بروليه", "creme brulee", "ماتيلدا", "matilda", "كراميل", "caramel",
    "نوتيلا", "nutella", "شوكولاته", "chocolate", "فانيلا", "vanilla",
    "توت", "berry", "raspberry", "فراولة", "strawberry", "مانجو", "mango",
    "لوز", "almond", "بيكان", "pecan", "سان سابستيان", "san sebastian",
    "honey cake", "كيك العسل", "كريمة", "cream"
  ],
  "تجمعات": [
    "catering", "كاترينج", "تجمعات", "حفلات", "party", "بوفيه", "buffet",
    "مناسبات", "events", "اجتماعات", "meetings"
  ]
};

// Function to suggest category based on product name keywords
export function suggestCategoryFromProductName(productName: string): { category: string | null; confidence: number } {
  const normalizedName = productName.toLowerCase();
  
  let bestMatch: { category: string; matchCount: number } | null = null;
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORD_RULES)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (normalizedName.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    if (matchCount > 0 && (!bestMatch || matchCount > bestMatch.matchCount)) {
      bestMatch = { category, matchCount };
    }
  }
  
  if (bestMatch) {
    // Calculate confidence based on match count
    const confidence = Math.min(bestMatch.matchCount * 30, 100);
    return { category: bestMatch.category, confidence };
  }
  
  return { category: null, confidence: 0 };
}

export const COMPARISON_STATUS = {
  normal: { label: "طبيعي", color: "green" },
  waste: { label: "هدر", color: "red" },
  shortage: { label: "نقص", color: "orange" },
  stored: { label: "مخزن", color: "blue" },
  made_to_order: { label: "حسب الطلب", color: "purple" },
} as const;

// Comparison Status History - سجل تغييرات حالة المقارنة
export const comparisonStatusHistory = pgTable("comparison_status_history", {
  id: serial("id").primaryKey(),
  comparisonId: integer("comparison_id").notNull().references(() => dailyComparisons.id),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  reason: text("reason"),
  changedBy: varchar("changed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_status_history_comparison").on(table.comparisonId),
  index("idx_status_history_date").on(table.createdAt),
]);

export const insertComparisonStatusHistorySchema = createInsertSchema(comparisonStatusHistory).omit({
  id: true,
  createdAt: true,
});

export type ComparisonStatusHistory = typeof comparisonStatusHistory.$inferSelect;
export type InsertComparisonStatusHistory = z.infer<typeof insertComparisonStatusHistorySchema>;

// Product Prices - أسعار المنتجات
export const productPrices = pgTable("product_prices", {
  id: serial("id").primaryKey(),
  productName: text("product_name").notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  price: real("price").notNull(),
  costPrice: real("cost_price"), // سعر التكلفة
  currency: varchar("currency", { length: 3 }).default("SAR"),
  effectiveDate: date("effective_date").defaultNow().notNull(),
  source: text("source"), // manual, foodics, import
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by"),
}, (table) => [
  index("idx_product_prices_name").on(table.productName),
  index("idx_product_prices_branch").on(table.branchId),
  index("idx_product_prices_date").on(table.effectiveDate),
]);

export const insertProductPriceSchema = createInsertSchema(productPrices).omit({
  id: true,
  createdAt: true,
});

export type ProductPrice = typeof productPrices.$inferSelect;
export type InsertProductPrice = z.infer<typeof insertProductPriceSchema>;

// Waste Risk Rules - قواعد مخاطر الهدر
export const wasteRiskRules = pgTable("waste_risk_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  branchId: varchar("branch_id").references(() => branches.id), // null = all branches
  category: text("category"), // null = all categories
  productName: text("product_name"), // null = all products
  thresholdType: text("threshold_type").notNull(), // quantity, value, percent
  thresholdValue: real("threshold_value").notNull(),
  periodDays: integer("period_days").default(1), // 1 = daily, 7 = weekly, etc
  severity: text("severity").default("medium"), // low, medium, high, critical
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_waste_rules_branch").on(table.branchId),
  index("idx_waste_rules_category").on(table.category),
  index("idx_waste_rules_active").on(table.isActive),
]);

export const insertWasteRiskRuleSchema = createInsertSchema(wasteRiskRules).omit({
  id: true,
  createdAt: true,
});

export type WasteRiskRule = typeof wasteRiskRules.$inferSelect;
export type InsertWasteRiskRule = z.infer<typeof insertWasteRiskRuleSchema>;

// Waste Risk Alerts - تنبيهات مخاطر الهدر
export const wasteRiskAlerts = pgTable("waste_risk_alerts", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull().references(() => wasteRiskRules.id),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  alertDate: date("alert_date").notNull(),
  productName: text("product_name"),
  category: text("category"),
  currentValue: real("current_value").notNull(),
  thresholdValue: real("threshold_value").notNull(),
  severity: text("severity").default("medium"),
  status: text("status").default("open"), // open, acknowledged, resolved
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_waste_alerts_rule").on(table.ruleId),
  index("idx_waste_alerts_branch").on(table.branchId),
  index("idx_waste_alerts_date").on(table.alertDate),
  index("idx_waste_alerts_status").on(table.status),
  index("idx_waste_alerts_severity").on(table.severity),
]);

export const insertWasteRiskAlertSchema = createInsertSchema(wasteRiskAlerts).omit({
  id: true,
  createdAt: true,
});

export type WasteRiskAlert = typeof wasteRiskAlerts.$inferSelect;
export type InsertWasteRiskAlert = z.infer<typeof insertWasteRiskAlertSchema>;

// Risk severity levels
export const RISK_SEVERITY = {
  low: { label: "منخفض", color: "blue", icon: "info" },
  medium: { label: "متوسط", color: "yellow", icon: "alert-triangle" },
  high: { label: "عالي", color: "orange", icon: "alert-circle" },
  critical: { label: "حرج", color: "red", icon: "x-circle" },
} as const;

// Alert status
export const ALERT_STATUS = {
  open: { label: "مفتوح", color: "red" },
  acknowledged: { label: "تم الاطلاع", color: "yellow" },
  resolved: { label: "تم الحل", color: "green" },
} as const;

// ==========================================
// نظام إدارة السوشيال ميديا - Social Media Management System
// ==========================================

// Social Accounts - حسابات السوشيال ميديا المرتبطة
export const socialAccounts = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(), // instagram, facebook, twitter, tiktok, snapchat, youtube
  accountId: text("account_id"), // Platform-specific account ID
  accountName: text("account_name").notNull(),
  accountHandle: text("account_handle"), // @username
  profileUrl: text("profile_url"), // رابط الملف الشخصي
  pageId: text("page_id"), // For Facebook pages
  profileImageUrl: text("profile_image_url"),
  followersCount: integer("followers_count").default(0),
  followingCount: integer("following_count").default(0),
  postsCount: integer("posts_count").default(0),
  accessToken: text("access_token"), // Encrypted
  refreshToken: text("refresh_token"), // Encrypted
  tokenExpiresAt: timestamp("token_expires_at"),
  branchId: varchar("branch_id").references(() => branches.id),
  isConnected: boolean("is_connected").default(false).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  connectionError: text("connection_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_social_accounts_platform").on(table.platform),
  index("idx_social_accounts_branch").on(table.branchId),
]);

export const insertSocialAccountSchema = createInsertSchema(socialAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SocialAccount = typeof socialAccounts.$inferSelect;
export type InsertSocialAccount = z.infer<typeof insertSocialAccountSchema>;

// Social Posts - المنشورات
export const socialPosts = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  title: text("title"),
  content: text("content").notNull(),
  contentAr: text("content_ar"), // Arabic version
  mediaUrls: text("media_urls").array(), // Array of image/video URLs
  mediaTypes: text("media_types").array(), // image, video, carousel
  hashtags: text("hashtags").array(),
  status: text("status").default("draft").notNull(), // draft, scheduled, published, failed
  platforms: text("platforms").array().notNull(), // Target platforms
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  failedReason: text("failed_reason"),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id),
  calendarEventId: integer("calendar_event_id").references(() => marketingCalendarEvents.id),
  influencerId: integer("influencer_id").references(() => marketingInfluencers.id),
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  postType: text("post_type").default("regular"), // regular, story, reel, carousel
  linkUrl: text("link_url"),
  callToAction: text("call_to_action"),
  targetAudience: text("target_audience"),
  isPromoted: boolean("is_promoted").default(false),
  promotionBudget: real("promotion_budget"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_social_posts_status").on(table.status),
  index("idx_social_posts_scheduled").on(table.scheduledAt),
  index("idx_social_posts_campaign").on(table.campaignId),
]);

export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;

// Social Post Metrics - إحصائيات المنشورات
export const socialPostMetrics = pgTable("social_post_metrics", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  platformPostId: text("platform_post_id"), // Post ID on the platform
  impressions: integer("impressions").default(0),
  reach: integer("reach").default(0),
  engagements: integer("engagements").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  saves: integer("saves").default(0),
  clicks: integer("clicks").default(0),
  videoViews: integer("video_views").default(0),
  engagementRate: real("engagement_rate").default(0),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
}, (table) => [
  index("idx_social_metrics_post").on(table.postId),
  index("idx_social_metrics_platform").on(table.platform),
]);

export const insertSocialPostMetricSchema = createInsertSchema(socialPostMetrics).omit({
  id: true,
  fetchedAt: true,
});

export type SocialPostMetric = typeof socialPostMetrics.$inferSelect;
export type InsertSocialPostMetric = z.infer<typeof insertSocialPostMetricSchema>;

// Social Content Templates - قوالب المحتوى
export const socialContentTemplates = pgTable("social_content_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // product_launch, promotion, holiday, engagement, announcement
  content: text("content").notNull(),
  contentAr: text("content_ar"),
  defaultHashtags: text("default_hashtags").array(),
  defaultMediaType: text("default_media_type"), // image, video, carousel
  placeholderFields: text("placeholder_fields").array(), // e.g., ["product_name", "price", "discount"]
  suitablePlatforms: text("suitable_platforms").array(),
  usageCount: integer("usage_count").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_content_templates_category").on(table.category),
]);

export const insertSocialContentTemplateSchema = createInsertSchema(socialContentTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SocialContentTemplate = typeof socialContentTemplates.$inferSelect;
export type InsertSocialContentTemplate = z.infer<typeof insertSocialContentTemplateSchema>;

// Social Schedule Slots - أوقات النشر المفضلة
export const socialScheduleSlots = pgTable("social_schedule_slots", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  timeSlot: text("time_slot").notNull(), // HH:MM format
  priority: integer("priority").default(1), // 1 = primary, 2 = secondary
  engagementScore: real("engagement_score").default(0), // Historical performance
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_schedule_slots_platform").on(table.platform),
  index("idx_schedule_slots_day").on(table.dayOfWeek),
]);

export const insertSocialScheduleSlotSchema = createInsertSchema(socialScheduleSlots).omit({
  id: true,
  createdAt: true,
});

export type SocialScheduleSlot = typeof socialScheduleSlots.$inferSelect;
export type InsertSocialScheduleSlot = z.infer<typeof insertSocialScheduleSlotSchema>;

// Social Platform Constants
export const SOCIAL_PLATFORMS = {
  instagram: { label: "انستقرام", icon: "instagram", color: "bg-gradient-to-r from-purple-500 to-pink-500" },
  facebook: { label: "فيسبوك", icon: "facebook", color: "bg-blue-600" },
  twitter: { label: "تويتر/X", icon: "twitter", color: "bg-black" },
  tiktok: { label: "تيك توك", icon: "music", color: "bg-black" },
  snapchat: { label: "سناب شات", icon: "ghost", color: "bg-yellow-400" },
  youtube: { label: "يوتيوب", icon: "youtube", color: "bg-red-600" },
} as const;

export const POST_STATUS = {
  draft: { label: "مسودة", color: "gray" },
  scheduled: { label: "مجدول", color: "blue" },
  published: { label: "منشور", color: "green" },
  failed: { label: "فشل", color: "red" },
} as const;

export const CONTENT_CATEGORIES = {
  product_launch: { label: "إطلاق منتج", icon: "rocket" },
  promotion: { label: "عرض ترويجي", icon: "tag" },
  holiday: { label: "مناسبة", icon: "calendar" },
  engagement: { label: "تفاعل", icon: "heart" },
  announcement: { label: "إعلان", icon: "megaphone" },
  behind_scenes: { label: "كواليس", icon: "camera" },
  user_content: { label: "محتوى المستخدمين", icon: "users" },
} as const;

// Influencer Contracts - عقود المؤثرين والبلوجر
export const influencerContracts = pgTable("influencer_contracts", {
  id: serial("id").primaryKey(),
  contractNumber: text("contract_number").notNull(), // رقم العقد
  influencerId: integer("influencer_id").references(() => marketingInfluencers.id, { onDelete: "set null" }),
  
  // معلومات المؤثر (نسخة لحفظها في العقد حتى لو تغيرت بيانات المؤثر)
  influencerName: text("influencer_name").notNull(),
  influencerPhone: text("influencer_phone"),
  influencerEmail: text("influencer_email"),
  nationalId: text("national_id"), // رقم الهوية
  
  // معلومات الحساب البنكي
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountHolder: text("bank_account_holder"),
  iban: text("iban"),
  
  // تفاصيل الحملة/التغطية
  campaignName: text("campaign_name").notNull(), // اسم الحملة أو التغطية
  campaignDescription: text("campaign_description"), // وصف التغطية
  branchId: varchar("branch_id").references(() => branches.id), // الفرع المستهدف
  branchName: text("branch_name"), // اسم الفرع (نسخة)
  coverageLocation: text("coverage_location"), // مكان التغطية
  coverageDate: text("coverage_date"), // تاريخ التغطية YYYY-MM-DD
  coverageTime: text("coverage_time"), // وقت التغطية
  
  // الشروط المالية
  contractAmount: real("contract_amount").notNull(), // مبلغ العقد
  currency: text("currency").default("SAR"), // العملة
  paymentTerms: text("payment_terms"), // شروط الدفع
  
  // الالتزامات
  deliverables: text("deliverables").array(), // المخرجات المتوقعة (قصة، منشور، ريلز، إلخ)
  contentRequirements: text("content_requirements"), // متطلبات المحتوى
  exclusivityClause: boolean("exclusivity_clause").default(false), // شرط الحصرية
  
  // التواريخ
  contractStartDate: text("contract_start_date").notNull(), // تاريخ بداية العقد
  contractEndDate: text("contract_end_date"), // تاريخ نهاية العقد
  
  // التوقيعات
  influencerSignature: text("influencer_signature"), // توقيع المؤثر (base64 أو URL)
  influencerSignedAt: timestamp("influencer_signed_at"),
  companySignature: text("company_signature"), // توقيع الشركة
  companySignedAt: timestamp("company_signed_at"),
  companySignedBy: varchar("company_signed_by").references(() => users.id),
  
  // حالة العقد
  status: text("status").default("draft").notNull(), // draft, pending_signature, signed, completed, cancelled
  
  // اعتماد الإدارة المالية
  financeApproved: boolean("finance_approved").default(false),
  financeApprovedBy: varchar("finance_approved_by").references(() => users.id),
  financeApprovedAt: timestamp("finance_approved_at"),
  financeNotes: text("finance_notes"),
  
  // حالة الدفع
  paymentStatus: text("payment_status").default("pending"), // pending, approved, paid
  paymentDate: text("payment_date"),
  paymentReference: text("payment_reference"), // رقم مرجع التحويل
  
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_influencer_contracts_influencer").on(table.influencerId),
  index("idx_influencer_contracts_status").on(table.status),
  index("idx_influencer_contracts_branch").on(table.branchId),
  index("idx_influencer_contracts_payment").on(table.paymentStatus),
]);

export const insertInfluencerContractSchema = createInsertSchema(influencerContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InfluencerContract = typeof influencerContracts.$inferSelect;
export type InsertInfluencerContract = z.infer<typeof insertInfluencerContractSchema>;

// Contract Status Constants
export const CONTRACT_STATUS = {
  draft: { label: "مسودة", labelEn: "Draft", color: "gray" },
  pending_signature: { label: "بانتظار التوقيع", labelEn: "Pending Signature", color: "yellow" },
  signed: { label: "موقع", labelEn: "Signed", color: "green" },
  completed: { label: "مكتمل", labelEn: "Completed", color: "blue" },
  cancelled: { label: "ملغي", labelEn: "Cancelled", color: "red" },
} as const;

export const PAYMENT_STATUS = {
  pending: { label: "بانتظار الاعتماد", labelEn: "Pending", color: "gray" },
  approved: { label: "معتمد للصرف", labelEn: "Approved", color: "yellow" },
  paid: { label: "تم الدفع", labelEn: "Paid", color: "green" },
} as const;

export const DELIVERABLE_TYPES = [
  { value: "instagram_story", label: "ستوري انستقرام" },
  { value: "instagram_post", label: "منشور انستقرام" },
  { value: "instagram_reel", label: "ريلز انستقرام" },
  { value: "tiktok_video", label: "فيديو تيك توك" },
  { value: "snapchat_story", label: "ستوري سناب شات" },
  { value: "youtube_video", label: "فيديو يوتيوب" },
  { value: "twitter_post", label: "تغريدة" },
  { value: "live_coverage", label: "تغطية مباشرة" },
  { value: "blog_post", label: "مقالة مدونة" },
] as const;

// ==================== مخزون الإنتاج النهائي ====================

// Finished Goods Inventory - مخزون الإنتاج النهائي
// يحتوي على الكميات المنتجة التي يمكن تحويلها للفروع أو بار العرض
// 
// Unique constraint: (branch_id, product_name_normalized, production_date)
// product_name_normalized stores the lowercased, trimmed product name for consistent matching
// This allows atomic UPSERT operations without functional indexes
export const finishedGoodsInventory = pgTable("finished_goods_inventory", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  productNameNormalized: text("product_name_normalized").notNull(), // normalized: lower(trim(product_name))
  productCategory: text("product_category"),
  quantity: integer("quantity").notNull().default(0), // الكمية المتاحة
  unit: text("unit").default("قطعة"),
  productionDate: text("production_date").notNull(), // تاريخ الإنتاج YYYY-MM-DD
  lastBatchId: integer("last_batch_id").references(() => dailyProductionBatches.id), // آخر دفعة إنتاج
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_finished_goods_branch").on(table.branchId),
  index("idx_finished_goods_product").on(table.productId),
  index("idx_finished_goods_date").on(table.productionDate),
  index("idx_finished_goods_category").on(table.productCategory),
  index("idx_finished_goods_product_name").on(table.productName),
  // Standard unique index for atomic UPSERT - uses normalized product name
  uniqueIndex("finished_goods_unique_idx").on(table.branchId, table.productNameNormalized, table.productionDate),
]);

export const insertFinishedGoodsInventorySchema = createInsertSchema(finishedGoodsInventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FinishedGoodsInventory = typeof finishedGoodsInventory.$inferSelect;
export type InsertFinishedGoodsInventory = z.infer<typeof insertFinishedGoodsInventorySchema>;

// Finished Goods Transfer Types - أنواع التحويلات
export const TRANSFER_DESTINATION_TYPES = {
  branch: { label: "فرع آخر", labelEn: "Another Branch" },
  display_bar: { label: "بار العرض", labelEn: "Display Bar" },
  kitchen_trolley: { label: "عربة المطبخ", labelEn: "Kitchen Trolley" },
  freezer: { label: "الفريزر", labelEn: "Freezer" },
  refrigerator: { label: "الثلاجة", labelEn: "Refrigerator" },
} as const;

// Finished Goods Transfers - تحويلات المخزون النهائي
export const finishedGoodsTransfers = pgTable("finished_goods_transfers", {
  id: serial("id").primaryKey(),
  inventoryId: integer("inventory_id")
    .notNull()
    .references(() => finishedGoodsInventory.id),
  sourceBranchId: varchar("source_branch_id")
    .notNull()
    .references(() => branches.id),
  destinationType: text("destination_type").notNull(), // branch, display_bar, kitchen_trolley, freezer, refrigerator
  destinationBranchId: varchar("destination_branch_id")
    .references(() => branches.id), // فقط إذا كان التحويل لفرع آخر
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  productCategory: text("product_category"),
  quantity: integer("quantity").notNull(),
  unit: text("unit").default("قطعة"),
  transferDate: text("transfer_date").notNull(), // تاريخ التحويل YYYY-MM-DD
  notes: text("notes"),
  status: text("status").default("completed").notNull(), // pending, completed, cancelled
  createdBy: varchar("created_by").references(() => users.id),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fg_transfers_source").on(table.sourceBranchId),
  index("idx_fg_transfers_dest").on(table.destinationBranchId),
  index("idx_fg_transfers_type").on(table.destinationType),
  index("idx_fg_transfers_date").on(table.transferDate),
  index("idx_fg_transfers_status").on(table.status),
]);

export const insertFinishedGoodsTransferSchema = createInsertSchema(finishedGoodsTransfers).omit({
  id: true,
  createdAt: true,
});

export type FinishedGoodsTransfer = typeof finishedGoodsTransfers.$inferSelect;
export type InsertFinishedGoodsTransfer = z.infer<typeof insertFinishedGoodsTransferSchema>;

// Production Inventory Movement Log - سجل حركة مخزون الإنتاج
export const productionInventoryLogs = pgTable("production_inventory_logs", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  productId: integer("product_id").references(() => products.id),
  productName: text("product_name").notNull(),
  movementType: text("movement_type").notNull(), // production_in, transfer_out, adjustment
  quantity: integer("quantity").notNull(), // موجب للإضافة، سالب للخصم
  balanceBefore: integer("balance_before").default(0),
  balanceAfter: integer("balance_after").default(0),
  referenceType: text("reference_type"), // batch, transfer, adjustment
  referenceId: integer("reference_id"), // معرف المرجع
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_prod_inv_logs_branch").on(table.branchId),
  index("idx_prod_inv_logs_product").on(table.productId),
  index("idx_prod_inv_logs_type").on(table.movementType),
]);

export const insertProductionInventoryLogSchema = createInsertSchema(productionInventoryLogs).omit({
  id: true,
  createdAt: true,
});

export type ProductionInventoryLog = typeof productionInventoryLogs.$inferSelect;
export type InsertProductionInventoryLog = z.infer<typeof insertProductionInventoryLogSchema>;

// ==================== نظام المخازن والتحويلات ====================

// Material Categories - فئات المواد
export const MATERIAL_CATEGORIES = {
  raw: { label: "مواد خام", labelEn: "Raw Materials", color: "blue" },
  consumable: { label: "مواد استهلاكية", labelEn: "Consumables", color: "green" },
  packaging: { label: "مواد تغليف", labelEn: "Packaging", color: "amber" },
  primary: { label: "مواد أولية", labelEn: "Primary Materials", color: "purple" },
} as const;

// Request Types - أنواع الطلبات
export const REQUEST_TYPES = {
  daily: { label: "يومي", labelEn: "Daily", color: "blue" },
  weekly: { label: "أسبوعي", labelEn: "Weekly", color: "green" },
  urgent: { label: "طارئ", labelEn: "Urgent", color: "red" },
} as const;

// Request Reasons - أسباب الطلب
export const REQUEST_REASONS = {
  depleted: { label: "نفاد المخزون", labelEn: "Stock Depleted", color: "red" },
  production_expansion: { label: "توسع الإنتاج", labelEn: "Production Expansion", color: "blue" },
  seasonal: { label: "موسم", labelEn: "Seasonal", color: "amber" },
  urgent: { label: "طارئ", labelEn: "Urgent", color: "red" },
  buffer_stock: { label: "مخزون احتياطي", labelEn: "Buffer Stock", color: "green" },
} as const;

// Material Request Status - حالات طلب المواد
export const MATERIAL_REQUEST_STATUS = {
  draft: { label: "مسودة", labelEn: "Draft", color: "gray" },
  pending: { label: "قيد المراجعة", labelEn: "Pending Review", color: "yellow" },
  approved: { label: "معتمد", labelEn: "Approved", color: "green" },
  partially_fulfilled: { label: "منفذ جزئياً", labelEn: "Partially Fulfilled", color: "blue" },
  fulfilled: { label: "منفذ بالكامل", labelEn: "Fulfilled", color: "emerald" },
  rejected: { label: "مرفوض", labelEn: "Rejected", color: "red" },
  forwarded_to_purchasing: { label: "محول للمشتريات", labelEn: "Forwarded to Purchasing", color: "purple" },
  cancelled: { label: "ملغي", labelEn: "Cancelled", color: "gray" },
} as const;

// Warehouse Items - أصناف المستودع
export const warehouseItems = pgTable("warehouse_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  category: text("category").notNull(), // raw, consumable, packaging, primary
  unit: text("unit").notNull().default("كجم"), // كجم، لتر، قطعة، علبة، كرتون
  sku: text("sku"), // رمز الصنف
  barcode: text("barcode"),
  minStockLevel: integer("min_stock_level").default(0), // الحد الأدنى للتنبيه
  maxStockLevel: integer("max_stock_level"), // الحد الأقصى
  reorderPoint: integer("reorder_point"), // نقطة إعادة الطلب
  currentStock: integer("current_stock").default(0), // المخزون الحالي في المستودع الرئيسي
  unitPrice: text("unit_price"), // سعر الوحدة
  supplierId: integer("supplier_id"), // المورد الرئيسي
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_warehouse_items_category").on(table.category),
  index("idx_warehouse_items_sku").on(table.sku),
  index("idx_warehouse_items_active").on(table.isActive),
]);

export const insertWarehouseItemSchema = createInsertSchema(warehouseItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WarehouseItem = typeof warehouseItems.$inferSelect;
export type InsertWarehouseItem = z.infer<typeof insertWarehouseItemSchema>;

// Branch Stock - مخزون الفروع
export const branchStock = pgTable("branch_stock", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  itemId: integer("item_id")
    .notNull()
    .references(() => warehouseItems.id),
  currentQuantity: integer("current_quantity").default(0),
  dailyConsumption: integer("daily_consumption").default(0), // معدل الاستهلاك اليومي
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_branch_stock_branch").on(table.branchId),
  index("idx_branch_stock_item").on(table.itemId),
  uniqueIndex("branch_stock_unique").on(table.branchId, table.itemId),
]);

export const insertBranchStockSchema = createInsertSchema(branchStock).omit({
  id: true,
  lastUpdated: true,
});

export type BranchStock = typeof branchStock.$inferSelect;
export type InsertBranchStock = z.infer<typeof insertBranchStockSchema>;

// Material Transfers - تحويلات المواد
export const materialTransfers = pgTable("material_transfers", {
  id: serial("id").primaryKey(),
  transferNumber: text("transfer_number").notNull(), // رقم التحويل التلقائي
  requestId: integer("request_id"), // للتوافقية مع البيانات القديمة
  sourceType: text("source_type").notNull().default("warehouse"), // warehouse, branch
  sourceBranchId: varchar("source_branch_id")
    .references(() => branches.id),
  destinationBranchId: varchar("destination_branch_id")
    .notNull()
    .references(() => branches.id),
  transferDate: text("transfer_date").notNull(), // تاريخ التحويل
  deliveryDate: text("delivery_date"), // تاريخ التسليم الفعلي
  status: text("status").notNull().default("pending"), // pending, approved, rejected, in_transit, delivered, cancelled
  // حقول الموافقة
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedByName: text("rejected_by_name"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  // حقول الإرسال والتسليم
  driverName: text("driver_name"),
  vehicleNumber: text("vehicle_number"),
  departureTime: timestamp("departure_time"),
  arrivalTime: timestamp("arrival_time"),
  receivedBy: varchar("received_by").references(() => users.id),
  receivedByName: text("received_by_name"),
  receiverSignature: text("receiver_signature"), // توقيع المستلم الإلكتروني
  deliveryNotes: text("delivery_notes"), // ملاحظات التسليم
  hasDiscrepancy: boolean("has_discrepancy").default(false), // هل يوجد فرق في الكميات
  hasQuantityModifications: boolean("has_quantity_modifications").default(false), // هل تم تعديل الكميات من مسؤول المستودع
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_material_transfers_source").on(table.sourceBranchId),
  index("idx_material_transfers_dest").on(table.destinationBranchId),
  index("idx_material_transfers_status").on(table.status),
  index("idx_material_transfers_date").on(table.transferDate),
  index("idx_material_transfers_request").on(table.requestId),
  uniqueIndex("material_transfers_number_unique").on(table.transferNumber),
]);

export const insertMaterialTransferSchema = createInsertSchema(materialTransfers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MaterialTransfer = typeof materialTransfers.$inferSelect;
export type InsertMaterialTransfer = z.infer<typeof insertMaterialTransferSchema>;

// Material Transfer Items - بنود التحويل
export const materialTransferItems = pgTable("material_transfer_items", {
  id: serial("id").primaryKey(),
  transferId: integer("transfer_id")
    .notNull()
    .references(() => materialTransfers.id, { onDelete: "cascade" }),
  itemId: integer("item_id")
    .notNull()
    .references(() => warehouseItems.id),
  itemName: text("item_name").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(),
  quantity: integer("quantity").notNull(), // الكمية المعتمدة للإرسال
  originalQuantity: integer("original_quantity"), // الكمية المطلوبة الأصلية
  availableQuantity: integer("available_quantity"), // الكمية المتوفرة وقت الإنشاء
  receivedQuantity: integer("received_quantity"), // الكمية المستلمة فعلياً
  discrepancy: integer("discrepancy"), // الفرق (مستلم - مرسل)
  discrepancyNotes: text("discrepancy_notes"), // ملاحظات الفرق (تالف، ناقص، إلخ)
  isModified: boolean("is_modified").default(false), // هل تم تعديل الكمية من مسؤول المستودع؟
  modifiedBy: text("modified_by"), // معرف المعدِّل
  modifiedByName: text("modified_by_name"), // اسم المعدِّل
  modifiedAt: timestamp("modified_at"), // تاريخ التعديل
  modificationNotes: text("modification_notes"), // سبب التعديل (مثل: الكمية غير متوفرة)
  notes: text("notes"),
}, (table) => [
  index("idx_material_transfer_items_transfer").on(table.transferId),
  index("idx_material_transfer_items_item").on(table.itemId),
]);

export const insertMaterialTransferItemSchema = createInsertSchema(materialTransferItems).omit({
  id: true,
});

export type MaterialTransferItem = typeof materialTransferItems.$inferSelect;
export type InsertMaterialTransferItem = z.infer<typeof insertMaterialTransferItemSchema>;

// Warehouse Movement Log - سجل حركة المستودع
export const warehouseMovementLogs = pgTable("warehouse_movement_logs", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => warehouseItems.id),
  branchId: varchar("branch_id")
    .references(() => branches.id),
  movementType: text("movement_type").notNull(), // in, out, adjustment, transfer_in, transfer_out
  quantity: integer("quantity").notNull(),
  balanceBefore: integer("balance_before").default(0),
  balanceAfter: integer("balance_after").default(0),
  referenceType: text("reference_type"), // request, transfer, purchase, adjustment
  referenceId: integer("reference_id"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_warehouse_logs_item").on(table.itemId),
  index("idx_warehouse_logs_branch").on(table.branchId),
  index("idx_warehouse_logs_type").on(table.movementType),
  index("idx_warehouse_logs_date").on(table.createdAt),
]);

export const insertWarehouseMovementLogSchema = createInsertSchema(warehouseMovementLogs).omit({
  id: true,
  createdAt: true,
});

export type WarehouseMovementLog = typeof warehouseMovementLogs.$inferSelect;
export type InsertWarehouseMovementLog = z.infer<typeof insertWarehouseMovementLogSchema>;

// Purchasing Requests - طلبات المشتريات
export const purchasingRequests = pgTable("purchasing_requests", {
  id: serial("id").primaryKey(),
  requestNumber: text("request_number").notNull(),
  sourceMaterialRequestId: integer("source_material_request_id"), // للتوافقية مع البيانات القديمة
  branchId: varchar("branch_id")
    .notNull()
    .references(() => branches.id),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, ordered, received, cancelled
  priority: text("priority").default("normal"), // normal, urgent, critical
  totalEstimatedCost: numeric("total_estimated_cost", { precision: 12, scale: 2 }).default("0"),
  approvedBudget: numeric("approved_budget", { precision: 12, scale: 2 }),
  vendorId: integer("vendor_id"),
  vendorName: text("vendor_name"),
  expectedDeliveryDate: text("expected_delivery_date"),
  actualDeliveryDate: text("actual_delivery_date"),
  notes: text("notes"),
  requestedBy: varchar("requested_by").references(() => users.id),
  requestedByName: text("requested_by_name"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_purchasing_requests_branch").on(table.branchId),
  index("idx_purchasing_requests_status").on(table.status),
  uniqueIndex("purchasing_requests_number_unique").on(table.requestNumber),
]);

export const insertPurchasingRequestSchema = createInsertSchema(purchasingRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PurchasingRequest = typeof purchasingRequests.$inferSelect;
export type InsertPurchasingRequest = z.infer<typeof insertPurchasingRequestSchema>;

// Purchasing Request Items - بنود طلب المشتريات
export const purchasingRequestItems = pgTable("purchasing_request_items", {
  id: serial("id").primaryKey(),
  purchasingRequestId: integer("purchasing_request_id")
    .notNull()
    .references(() => purchasingRequests.id, { onDelete: "cascade" }),
  itemId: integer("item_id").references(() => warehouseItems.id),
  itemName: text("item_name").notNull(),
  category: text("category"),
  unit: text("unit"),
  requestedQuantity: integer("requested_quantity").notNull().default(0),
  approvedQuantity: integer("approved_quantity").default(0),
  orderedQuantity: integer("ordered_quantity").default(0),
  receivedQuantity: integer("received_quantity").default(0),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }),
  notes: text("notes"),
});

export const insertPurchasingRequestItemSchema = createInsertSchema(purchasingRequestItems).omit({
  id: true,
});

export type PurchasingRequestItem = typeof purchasingRequestItems.$inferSelect;
export type InsertPurchasingRequestItem = z.infer<typeof insertPurchasingRequestItemSchema>;

// Warehouse Notifications - إشعارات المخازن
export const warehouseNotifications = pgTable("warehouse_notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // request_created, request_approved, request_rejected, transfer_started, transfer_delivered, low_stock
  title: text("title").notNull(),
  titleEn: text("title_en"),
  body: text("body").notNull(),
  bodyEn: text("body_en"),
  branchId: varchar("branch_id").references(() => branches.id),
  targetBranchId: varchar("target_branch_id").references(() => branches.id), // for transfers
  userId: varchar("user_id").references(() => users.id), // specific user target (null = all branch users)
  entityType: text("entity_type"), // material_request, transfer, warehouse_item
  entityId: integer("entity_id"),
  priority: text("priority").default("normal"), // low, normal, high, urgent
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  readBy: varchar("read_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_warehouse_notif_branch").on(table.branchId),
  index("idx_warehouse_notif_user").on(table.userId),
  index("idx_warehouse_notif_read").on(table.isRead),
  index("idx_warehouse_notif_date").on(table.createdAt),
  index("idx_warehouse_notif_entity").on(table.entityType, table.entityId),
]);

export const insertWarehouseNotificationSchema = createInsertSchema(warehouseNotifications).omit({
  id: true,
  createdAt: true,
});

export type WarehouseNotification = typeof warehouseNotifications.$inferSelect;
export type InsertWarehouseNotification = z.infer<typeof insertWarehouseNotificationSchema>;

// ==========================================
// Executive Secretariat Module - السكرتارية التنفيذية
// ==========================================

// Meeting Status Constants
export const MEETING_STATUS = ["scheduled", "in_progress", "completed", "cancelled", "postponed"] as const;
export type MeetingStatus = typeof MEETING_STATUS[number];

// Task Status Constants
export const EXEC_TASK_STATUS = ["pending", "in_progress", "completed", "cancelled", "on_hold"] as const;
export type ExecTaskStatus = typeof EXEC_TASK_STATUS[number];

// Task Priority Constants
export const EXEC_TASK_PRIORITY = ["low", "medium", "high", "urgent"] as const;
export type ExecTaskPriority = typeof EXEC_TASK_PRIORITY[number];

// Correspondence Type Constants
export const CORRESPONDENCE_TYPE = ["incoming", "outgoing"] as const;
export type CorrespondenceType = typeof CORRESPONDENCE_TYPE[number];

// Correspondence Status Constants
export const CORRESPONDENCE_STATUS = ["draft", "sent", "received", "archived", "pending_review"] as const;
export type CorrespondenceStatus = typeof CORRESPONDENCE_STATUS[number];

// Executive Meetings - الاجتماعات التنفيذية
export const execMeetings = pgTable("exec_meetings", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").references(() => branches.id),
  title: text("title").notNull(),
  titleEn: text("title_en"),
  agenda: text("agenda"),
  agendaEn: text("agenda_en"),
  meetingType: text("meeting_type").default("regular"), // regular, urgent, board, department, external
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at"),
  location: text("location"),
  locationEn: text("location_en"),
  isVirtual: boolean("is_virtual").default(false),
  virtualMeetingLink: text("virtual_meeting_link"),
  organizerId: varchar("organizer_id").references(() => users.id),
  organizerName: text("organizer_name"),
  status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, cancelled, postponed
  notes: text("notes"),
  minutes: text("minutes"), // محضر الاجتماع
  decisions: text("decisions"), // القرارات
  reminderSent: boolean("reminder_sent").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_exec_meetings_branch").on(table.branchId),
  index("idx_exec_meetings_organizer").on(table.organizerId),
  index("idx_exec_meetings_status").on(table.status),
  index("idx_exec_meetings_start").on(table.startAt),
]);

export const insertExecMeetingSchema = createInsertSchema(execMeetings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ExecMeeting = typeof execMeetings.$inferSelect;
export type InsertExecMeeting = z.infer<typeof insertExecMeetingSchema>;

// Meeting Attendees - حضور الاجتماعات
export const execMeetingAttendees = pgTable("exec_meeting_attendees", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id")
    .notNull()
    .references(() => execMeetings.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  attendeeName: text("attendee_name").notNull(),
  attendeeEmail: text("attendee_email"),
  attendeePhone: text("attendee_phone"),
  role: text("role").default("attendee"), // organizer, attendee, presenter, guest
  isExternal: boolean("is_external").default(false),
  externalOrganization: text("external_organization"),
  attendanceStatus: text("attendance_status").default("invited"), // invited, confirmed, declined, attended, absent
  attendedAt: timestamp("attended_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_exec_attendees_meeting").on(table.meetingId),
  index("idx_exec_attendees_user").on(table.userId),
]);

export const insertExecMeetingAttendeeSchema = createInsertSchema(execMeetingAttendees).omit({
  id: true,
  createdAt: true,
});

export type ExecMeetingAttendee = typeof execMeetingAttendees.$inferSelect;
export type InsertExecMeetingAttendee = z.infer<typeof insertExecMeetingAttendeeSchema>;

// Executive Tasks - المهام التنفيذية
export const execTasks = pgTable("exec_tasks", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").references(() => branches.id),
  title: text("title").notNull(),
  titleEn: text("title_en"),
  description: text("description"),
  descriptionEn: text("description_en"),
  taskType: text("task_type").default("general"), // general, meeting_followup, correspondence_followup, urgent
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedToName: text("assigned_to_name"),
  createdBy: varchar("created_by").references(() => users.id),
  createdByName: text("created_by_name"),
  relatedType: text("related_type"), // meeting, correspondence, document
  relatedId: integer("related_id"),
  dueDate: timestamp("due_date"),
  startDate: timestamp("start_date"),
  completedAt: timestamp("completed_at"),
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, cancelled, on_hold
  progress: integer("progress").default(0), // 0-100
  notes: text("notes"),
  reminderSent: boolean("reminder_sent").default(false),
  reminderDate: timestamp("reminder_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_exec_tasks_branch").on(table.branchId),
  index("idx_exec_tasks_assigned").on(table.assignedTo),
  index("idx_exec_tasks_created_by").on(table.createdBy),
  index("idx_exec_tasks_status").on(table.status),
  index("idx_exec_tasks_priority").on(table.priority),
  index("idx_exec_tasks_due_date").on(table.dueDate),
]);

export const insertExecTaskSchema = createInsertSchema(execTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ExecTask = typeof execTasks.$inferSelect;
export type InsertExecTask = z.infer<typeof insertExecTaskSchema>;

// Executive Correspondence - المراسلات التنفيذية
export const execCorrespondence = pgTable("exec_correspondence", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").references(() => branches.id),
  refNumber: text("ref_number").notNull(), // رقم المرجع
  type: text("type").notNull().default("incoming"), // incoming, outgoing
  subject: text("subject").notNull(),
  subjectEn: text("subject_en"),
  body: text("body"),
  bodyEn: text("body_en"),
  senderName: text("sender_name"),
  senderOrganization: text("sender_organization"),
  senderEmail: text("sender_email"),
  senderPhone: text("sender_phone"),
  receiverName: text("receiver_name"),
  receiverOrganization: text("receiver_organization"),
  receiverEmail: text("receiver_email"),
  receiverPhone: text("receiver_phone"),
  category: text("category").default("general"), // general, contract, inquiry, complaint, official, financial
  priority: text("priority").default("normal"), // low, normal, high, urgent
  status: text("status").notNull().default("received"), // draft, sent, received, archived, pending_review
  receivedAt: timestamp("received_at"),
  sentAt: timestamp("sent_at"),
  responseDeadline: timestamp("response_deadline"),
  respondedAt: timestamp("responded_at"),
  responseRefNumber: text("response_ref_number"),
  attachments: jsonb("attachments").default([]), // [{name, url, type, size}]
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  assignedToName: text("assigned_to_name"),
  isConfidential: boolean("is_confidential").default(false),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_exec_corr_branch").on(table.branchId),
  index("idx_exec_corr_type").on(table.type),
  index("idx_exec_corr_status").on(table.status),
  index("idx_exec_corr_category").on(table.category),
  index("idx_exec_corr_owner").on(table.ownerId),
  index("idx_exec_corr_assigned").on(table.assignedTo),
  index("idx_exec_corr_received").on(table.receivedAt),
  uniqueIndex("exec_correspondence_ref_unique").on(table.refNumber),
]);

export const insertExecCorrespondenceSchema = createInsertSchema(execCorrespondence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ExecCorrespondence = typeof execCorrespondence.$inferSelect;
export type InsertExecCorrespondence = z.infer<typeof insertExecCorrespondenceSchema>;

// Task Comments - تعليقات المهام
export const execTaskComments = pgTable("exec_task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => execTasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  userName: text("user_name"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_exec_task_comments_task").on(table.taskId),
]);

export const insertExecTaskCommentSchema = createInsertSchema(execTaskComments).omit({
  id: true,
  createdAt: true,
});

export type ExecTaskComment = typeof execTaskComments.$inferSelect;
export type InsertExecTaskComment = z.infer<typeof insertExecTaskCommentSchema>;

// Executive Notifications - تنبيهات السكرتارية
export const execNotifications = pgTable("exec_notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  branchId: varchar("branch_id").references(() => branches.id),
  type: text("type").notNull(), // meeting_reminder, task_due, task_assigned, correspondence_received, correspondence_deadline
  title: text("title").notNull(),
  titleEn: text("title_en"),
  body: text("body"),
  bodyEn: text("body_en"),
  entityType: text("entity_type"), // meeting, task, correspondence
  entityId: integer("entity_id"),
  priority: text("priority").default("normal"), // low, normal, high, urgent
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  scheduledAt: timestamp("scheduled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_exec_notif_user").on(table.userId),
  index("idx_exec_notif_branch").on(table.branchId),
  index("idx_exec_notif_read").on(table.isRead),
  index("idx_exec_notif_entity").on(table.entityType, table.entityId),
]);

export const insertExecNotificationSchema = createInsertSchema(execNotifications).omit({
  id: true,
  createdAt: true,
});

export type ExecNotification = typeof execNotifications.$inferSelect;
export type InsertExecNotification = z.infer<typeof insertExecNotificationSchema>;

// ==========================================
// Document Management Module - إدارة الوثائق والأرشفة
// ==========================================

// Document Status Constants
export const DOCUMENT_STATUS = ["draft", "active", "archived", "deleted"] as const;
export type DocumentStatus = typeof DOCUMENT_STATUS[number];

// Document Access Level Constants
export const DOCUMENT_ACCESS_LEVEL = ["private", "internal", "public", "confidential"] as const;
export type DocumentAccessLevel = typeof DOCUMENT_ACCESS_LEVEL[number];

// Document Categories - تصنيفات الوثائق
export const documentCategories = pgTable("document_categories", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").references(() => branches.id),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  color: text("color").default("#6B7280"),
  icon: text("icon").default("folder"),
  parentId: integer("parent_id"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_doc_categories_branch").on(table.branchId),
  index("idx_doc_categories_parent").on(table.parentId),
]);

export const insertDocumentCategorySchema = createInsertSchema(documentCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DocumentCategory = typeof documentCategories.$inferSelect;
export type InsertDocumentCategory = z.infer<typeof insertDocumentCategorySchema>;

// Document Folders - مجلدات الوثائق
export const documentFolders = pgTable("document_folders", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").references(() => branches.id),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  parentId: integer("parent_id"),
  path: text("path").notNull().default("/"), // المسار الكامل للمجلد
  categoryId: integer("category_id").references(() => documentCategories.id),
  accessLevel: text("access_level").default("internal"), // private, internal, public, confidential
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name"),
  color: text("color"),
  icon: text("icon"),
  isLocked: boolean("is_locked").default(false),
  sortOrder: integer("sort_order").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_doc_folders_branch").on(table.branchId),
  index("idx_doc_folders_parent").on(table.parentId),
  index("idx_doc_folders_category").on(table.categoryId),
  index("idx_doc_folders_owner").on(table.ownerId),
  index("idx_doc_folders_path").on(table.path),
]);

export const insertDocumentFolderSchema = createInsertSchema(documentFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DocumentFolder = typeof documentFolders.$inferSelect;
export type InsertDocumentFolder = z.infer<typeof insertDocumentFolderSchema>;

// Documents - الوثائق
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").references(() => branches.id),
  folderId: integer("folder_id").references(() => documentFolders.id),
  categoryId: integer("category_id").references(() => documentCategories.id),
  title: text("title").notNull(),
  titleEn: text("title_en"),
  description: text("description"),
  descriptionEn: text("description_en"),
  documentNumber: text("document_number"), // رقم الوثيقة
  documentDate: timestamp("document_date"), // تاريخ الوثيقة
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // pdf, docx, xlsx, etc.
  fileSize: integer("file_size").notNull(), // بالبايت
  filePath: text("file_path").notNull(), // مسار التخزين
  mimeType: text("mime_type"),
  checksum: text("checksum"), // للتحقق من سلامة الملف
  currentVersion: integer("current_version").default(1),
  accessLevel: text("access_level").default("internal"), // private, internal, public, confidential
  status: text("status").notNull().default("active"), // draft, active, archived, deleted
  tags: text("tags").array(), // الكلمات المفتاحية
  metadata: jsonb("metadata").default({}), // بيانات إضافية
  expiryDate: timestamp("expiry_date"), // تاریخ انتهاء الصلاحية
  retentionPeriod: integer("retention_period"), // فترة الاحتفاظ بالأيام
  isTemplate: boolean("is_template").default(false),
  templateFor: text("template_for"), // نوع القالب
  relatedType: text("related_type"), // meeting, task, correspondence, contract
  relatedId: integer("related_id"),
  ownerId: varchar("owner_id").references(() => users.id),
  ownerName: text("owner_name"),
  lastAccessedAt: timestamp("last_accessed_at"),
  lastAccessedBy: varchar("last_accessed_by").references(() => users.id),
  downloadCount: integer("download_count").default(0),
  viewCount: integer("view_count").default(0),
  isLocked: boolean("is_locked").default(false),
  lockedBy: varchar("locked_by").references(() => users.id),
  lockedAt: timestamp("locked_at"),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by").references(() => users.id),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_documents_branch").on(table.branchId),
  index("idx_documents_folder").on(table.folderId),
  index("idx_documents_category").on(table.categoryId),
  index("idx_documents_owner").on(table.ownerId),
  index("idx_documents_status").on(table.status),
  index("idx_documents_access").on(table.accessLevel),
  index("idx_documents_type").on(table.fileType),
  index("idx_documents_related").on(table.relatedType, table.relatedId),
  index("idx_documents_date").on(table.documentDate),
]);

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// Document Versions - إصدارات الوثائق
export const documentVersions = pgTable("document_versions", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type"),
  checksum: text("checksum"),
  changeNotes: text("change_notes"), // ملاحظات التغيير
  changedBy: varchar("changed_by").references(() => users.id),
  changedByName: text("changed_by_name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_doc_versions_document").on(table.documentId),
  index("idx_doc_versions_number").on(table.documentId, table.versionNumber),
]);

export const insertDocumentVersionSchema = createInsertSchema(documentVersions).omit({
  id: true,
  createdAt: true,
});

export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;

// Document Shares - مشاركة الوثائق
export const documentShares = pgTable("document_shares", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => documentFolders.id, { onDelete: "cascade" }),
  sharedWithUserId: varchar("shared_with_user_id").references(() => users.id),
  sharedWithUserName: text("shared_with_user_name"),
  sharedWithBranchId: varchar("shared_with_branch_id").references(() => branches.id),
  shareType: text("share_type").default("user"), // user, branch, department, public
  permission: text("permission").default("view"), // view, download, edit, full
  expiresAt: timestamp("expires_at"), // تاریخ انتهاء المشاركة
  shareLink: text("share_link"), // رابط المشاركة العام
  sharePassword: text("share_password"), // كلمة مرور للرابط
  accessCount: integer("access_count").default(0),
  maxAccessCount: integer("max_access_count"), // الحد الأقصى للوصول
  isActive: boolean("is_active").default(true),
  sharedBy: varchar("shared_by").references(() => users.id),
  sharedByName: text("shared_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_doc_shares_document").on(table.documentId),
  index("idx_doc_shares_folder").on(table.folderId),
  index("idx_doc_shares_user").on(table.sharedWithUserId),
  index("idx_doc_shares_branch").on(table.sharedWithBranchId),
  index("idx_doc_shares_link").on(table.shareLink),
]);

export const insertDocumentShareSchema = createInsertSchema(documentShares).omit({
  id: true,
  createdAt: true,
});

export type DocumentShare = typeof documentShares.$inferSelect;
export type InsertDocumentShare = z.infer<typeof insertDocumentShareSchema>;

// Document Access Logs - سجل الوصول للوثائق
export const documentAccessLogs = pgTable("document_access_logs", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  userName: text("user_name"),
  action: text("action").notNull(), // view, download, print, edit, share, delete, restore
  actionDetails: text("action_details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  versionNumber: integer("version_number"),
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
}, (table) => [
  index("idx_doc_access_document").on(table.documentId),
  index("idx_doc_access_user").on(table.userId),
  index("idx_doc_access_action").on(table.action),
  index("idx_doc_access_date").on(table.accessedAt),
]);

export const insertDocumentAccessLogSchema = createInsertSchema(documentAccessLogs).omit({
  id: true,
  accessedAt: true,
});

export type DocumentAccessLog = typeof documentAccessLogs.$inferSelect;
export type InsertDocumentAccessLog = z.infer<typeof insertDocumentAccessLogSchema>;

// =====================================================
// سجل الزوار - Visitor Management
// =====================================================

// Visitors - الزوار
export const visitors = pgTable("visitors", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").references(() => branches.id),
  // بيانات الزائر
  fullName: text("full_name").notNull(),
  nationalId: text("national_id"), // رقم الهوية
  phone: text("phone"),
  email: text("email"),
  company: text("company"), // الجهة/الشركة
  nationality: text("nationality"),
  idType: text("id_type").default("national_id"), // national_id, passport, iqama
  photoUrl: text("photo_url"), // صورة الزائر
  // معلومات إضافية
  notes: text("notes"),
  isBlacklisted: boolean("is_blacklisted").default(false), // قائمة سوداء
  blacklistReason: text("blacklist_reason"),
  visitCount: integer("visit_count").default(0), // عدد الزيارات
  lastVisitAt: timestamp("last_visit_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_visitors_branch").on(table.branchId),
  index("idx_visitors_national_id").on(table.nationalId),
  index("idx_visitors_phone").on(table.phone),
  index("idx_visitors_company").on(table.company),
]);

export const insertVisitorSchema = createInsertSchema(visitors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Visitor = typeof visitors.$inferSelect;
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;

// Visitor Logs - سجل الزيارات
export const visitorLogs = pgTable("visitor_logs", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").references(() => branches.id),
  visitorId: integer("visitor_id").references(() => visitors.id),
  // بيانات الزيارة
  visitNumber: text("visit_number"), // رقم الزيارة VIS-YYYYMM-XXXX
  visitDate: timestamp("visit_date").defaultNow().notNull(),
  visitPurpose: text("visit_purpose").notNull(), // غرض الزيارة
  visitType: text("visit_type").default("business"), // business, personal, delivery, interview, meeting, other
  // المضيف
  hostId: varchar("host_id").references(() => users.id),
  hostName: text("host_name"),
  hostDepartment: text("host_department"),
  // أوقات الدخول والخروج
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  expectedDuration: integer("expected_duration"), // المدة المتوقعة بالدقائق
  actualDuration: integer("actual_duration"), // المدة الفعلية بالدقائق
  // حالة الزيارة
  status: text("status").default("checked_in"), // pending, checked_in, checked_out, cancelled, no_show
  // بطاقة الزائر
  badgeNumber: text("badge_number"),
  badgeIssued: boolean("badge_issued").default(false),
  badgeReturned: boolean("badge_returned").default(false),
  // معلومات إضافية
  vehiclePlate: text("vehicle_plate"), // لوحة السيارة
  itemsCarried: text("items_carried"), // الأغراض المحمولة
  accessAreas: text("access_areas").array(), // المناطق المسموح بها
  escortRequired: boolean("escort_required").default(false), // يتطلب مرافق
  escortName: text("escort_name"),
  // ملاحظات وتوقيعات
  notes: text("notes"),
  visitorSignature: text("visitor_signature"),
  hostSignature: text("host_signature"),
  securityNotes: text("security_notes"),
  // المسجل
  registeredBy: varchar("registered_by").references(() => users.id),
  registeredByName: text("registered_by_name"),
  checkedOutBy: varchar("checked_out_by").references(() => users.id),
  checkedOutByName: text("checked_out_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_visitor_logs_branch").on(table.branchId),
  index("idx_visitor_logs_visitor").on(table.visitorId),
  index("idx_visitor_logs_host").on(table.hostId),
  index("idx_visitor_logs_date").on(table.visitDate),
  index("idx_visitor_logs_status").on(table.status),
  index("idx_visitor_logs_number").on(table.visitNumber),
]);

export const insertVisitorLogSchema = createInsertSchema(visitorLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VisitorLog = typeof visitorLogs.$inferSelect;
export type InsertVisitorLog = z.infer<typeof insertVisitorLogSchema>;

// =====================================================
// إدارة السفر والحجوزات - Travel Management
// =====================================================

// Travel Requests - طلبات السفر
export const travelRequests = pgTable("travel_requests", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").references(() => branches.id),
  // رقم الطلب
  requestNumber: text("request_number"), // TR-YYYYMM-XXXX
  // مقدم الطلب
  requesterId: varchar("requester_id").references(() => users.id),
  requesterName: text("requester_name"),
  requesterDepartment: text("requester_department"),
  requesterJobTitle: text("requester_job_title"),
  // تفاصيل الرحلة
  tripTitle: text("trip_title").notNull(), // عنوان الرحلة
  tripPurpose: text("trip_purpose").notNull(), // الغرض من السفر
  tripType: text("trip_type").default("business"), // business, training, conference, client_visit, other
  // الوجهات والتواريخ
  departureCity: text("departure_city").notNull(),
  destinationCity: text("destination_city").notNull(),
  destinationCountry: text("destination_country"),
  departureDate: timestamp("departure_date").notNull(),
  returnDate: timestamp("return_date").notNull(),
  tripDuration: integer("trip_duration"), // عدد الأيام
  // احتياجات السفر
  needsFlight: boolean("needs_flight").default(true),
  needsHotel: boolean("needs_hotel").default(true),
  needsTransportation: boolean("needs_transportation").default(false),
  needsVisa: boolean("needs_visa").default(false),
  // الميزانية التقديرية
  estimatedFlightCost: numeric("estimated_flight_cost", { precision: 12, scale: 2 }),
  estimatedHotelCost: numeric("estimated_hotel_cost", { precision: 12, scale: 2 }),
  estimatedTransportCost: numeric("estimated_transport_cost", { precision: 12, scale: 2 }),
  estimatedMealsCost: numeric("estimated_meals_cost", { precision: 12, scale: 2 }),
  estimatedOtherCost: numeric("estimated_other_cost", { precision: 12, scale: 2 }),
  totalEstimatedCost: numeric("total_estimated_cost", { precision: 12, scale: 2 }),
  currency: text("currency").default("SAR"),
  // حالة الطلب
  status: text("status").default("draft"), // draft, pending, approved, rejected, cancelled, completed
  // الموافقات
  managerApproval: text("manager_approval").default("pending"), // pending, approved, rejected
  managerApprovalDate: timestamp("manager_approval_date"),
  managerApprovalBy: varchar("manager_approval_by").references(() => users.id),
  managerApprovalNotes: text("manager_approval_notes"),
  financeApproval: text("finance_approval").default("pending"),
  financeApprovalDate: timestamp("finance_approval_date"),
  financeApprovalBy: varchar("finance_approval_by").references(() => users.id),
  financeApprovalNotes: text("finance_approval_notes"),
  // التنفيذ
  actualFlightCost: numeric("actual_flight_cost", { precision: 12, scale: 2 }),
  actualHotelCost: numeric("actual_hotel_cost", { precision: 12, scale: 2 }),
  actualTransportCost: numeric("actual_transport_cost", { precision: 12, scale: 2 }),
  actualMealsCost: numeric("actual_meals_cost", { precision: 12, scale: 2 }),
  actualOtherCost: numeric("actual_other_cost", { precision: 12, scale: 2 }),
  totalActualCost: numeric("total_actual_cost", { precision: 12, scale: 2 }),
  // تفاصيل الحجوزات
  flightDetails: jsonb("flight_details"), // تفاصيل حجز الطيران
  hotelDetails: jsonb("hotel_details"), // تفاصيل حجز الفندق
  transportDetails: jsonb("transport_details"), // تفاصيل النقل
  // ملفات مرفقة
  attachments: jsonb("attachments"), // قائمة الملفات المرفقة
  // ملاحظات
  notes: text("notes"),
  tripReport: text("trip_report"), // تقرير بعد الرحلة
  tripReportDate: timestamp("trip_report_date"),
  // المعلومات الإدارية
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_travel_requests_branch").on(table.branchId),
  index("idx_travel_requests_requester").on(table.requesterId),
  index("idx_travel_requests_status").on(table.status),
  index("idx_travel_requests_dates").on(table.departureDate, table.returnDate),
  index("idx_travel_requests_number").on(table.requestNumber),
]);

export const insertTravelRequestSchema = createInsertSchema(travelRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TravelRequest = typeof travelRequests.$inferSelect;
export type InsertTravelRequest = z.infer<typeof insertTravelRequestSchema>;

// Travel Expenses - مصروفات السفر
export const travelExpenses = pgTable("travel_expenses", {
  id: serial("id").primaryKey(),
  travelRequestId: integer("travel_request_id")
    .notNull()
    .references(() => travelRequests.id, { onDelete: "cascade" }),
  // تفاصيل المصروف
  expenseType: text("expense_type").notNull(), // flight, hotel, transport, meals, visa, other
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("SAR"),
  expenseDate: timestamp("expense_date").notNull(),
  // الإيصال
  receiptNumber: text("receipt_number"),
  receiptUrl: text("receipt_url"),
  vendor: text("vendor"), // المورد/الجهة
  // الموافقة
  status: text("status").default("pending"), // pending, approved, rejected
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  // ملاحظات
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_travel_expenses_request").on(table.travelRequestId),
  index("idx_travel_expenses_type").on(table.expenseType),
  index("idx_travel_expenses_status").on(table.status),
]);

export const insertTravelExpenseSchema = createInsertSchema(travelExpenses).omit({
  id: true,
  createdAt: true,
});

export type TravelExpense = typeof travelExpenses.$inferSelect;
export type InsertTravelExpense = z.infer<typeof insertTravelExpenseSchema>;

// =====================================================
// نظام التنبيهات - Notifications System
// =====================================================

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").references(() => branches.id),
  // المستلم
  userId: varchar("user_id").references(() => users.id), // null = إشعار عام
  // محتوى التنبيه
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").default("info"), // info, warning, error, success, reminder
  category: text("category"), // meeting, task, correspondence, visitor, travel, system
  priority: text("priority").default("normal"), // low, normal, high, urgent
  // الرابط المرتبط
  linkType: text("link_type"), // meeting, task, correspondence, visitor, travel_request
  linkId: integer("link_id"),
  linkUrl: text("link_url"),
  // الحالة
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  isDismissed: boolean("is_dismissed").default(false),
  dismissedAt: timestamp("dismissed_at"),
  // التوقيت
  scheduledFor: timestamp("scheduled_for"), // للتذكيرات المجدولة
  expiresAt: timestamp("expires_at"), // تاريخ انتهاء الصلاحية
  // المرسل
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_notifications_user").on(table.userId),
  index("idx_notifications_branch").on(table.branchId),
  index("idx_notifications_type").on(table.type),
  index("idx_notifications_category").on(table.category),
  index("idx_notifications_read").on(table.isRead),
  index("idx_notifications_scheduled").on(table.scheduledFor),
]);

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// =====================================================
// نظام الحوكمة ومجلس الإدارة - Corporate Governance System
// =====================================================

// أعضاء مجلس الإدارة - Board Members
export const boardMembers = pgTable("board_members", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  nationalId: text("national_id"),
  email: text("email"),
  phone: text("phone"),
  position: text("position").notNull(), // chairman, vice_chairman, member, secretary, independent_member
  memberType: text("member_type").default("executive"), // executive, non_executive, independent
  nationality: text("nationality"),
  dateOfBirth: date("date_of_birth"),
  qualifications: text("qualifications"),
  experience: text("experience"),
  currentEmployer: text("current_employer"),
  otherBoardMemberships: text("other_board_memberships"),
  appointmentDate: date("appointment_date").notNull(),
  termEndDate: date("term_end_date"),
  termNumber: integer("term_number").default(1),
  status: text("status").default("active"), // active, resigned, expired, suspended
  resignationDate: date("resignation_date"),
  resignationReason: text("resignation_reason"),
  photoUrl: text("photo_url"),
  signatureUrl: text("signature_url"),
  committees: text("committees").array(), // لجان المجلس
  votingPower: numeric("voting_power", { precision: 8, scale: 4 }).default("1.0000"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_board_members_status").on(table.status),
  index("idx_board_members_position").on(table.position),
  index("idx_board_members_type").on(table.memberType),
]);

export const insertBoardMemberSchema = createInsertSchema(boardMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BoardMember = typeof boardMembers.$inferSelect;
export type InsertBoardMember = z.infer<typeof insertBoardMemberSchema>;

// المساهمون - Shareholders
export const shareholders = pgTable("shareholders", {
  id: serial("id").primaryKey(),
  shareholderType: text("shareholder_type").notNull(), // individual, company, government, institution
  fullName: text("full_name").notNull(),
  nationalId: text("national_id"),
  commercialRegister: text("commercial_register"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  nationality: text("nationality"),
  numberOfShares: integer("number_of_shares").notNull(),
  sharePercentage: numeric("share_percentage", { precision: 8, scale: 4 }).notNull(),
  shareClass: text("share_class").default("common"), // common, preferred, founders
  acquisitionDate: date("acquisition_date").notNull(),
  acquisitionPrice: numeric("acquisition_price", { precision: 12, scale: 2 }),
  certificateNumber: text("certificate_number"),
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  iban: text("iban"),
  isBoardMember: boolean("is_board_member").default(false),
  boardMemberId: integer("board_member_id").references(() => boardMembers.id),
  votingRights: boolean("voting_rights").default(true),
  dividendRights: boolean("dividend_rights").default(true),
  status: text("status").default("active"), // active, frozen, transferred
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_shareholders_type").on(table.shareholderType),
  index("idx_shareholders_status").on(table.status),
  index("idx_shareholders_percentage").on(table.sharePercentage),
]);

export const insertShareholderSchema = createInsertSchema(shareholders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Shareholder = typeof shareholders.$inferSelect;
export type InsertShareholder = z.infer<typeof insertShareholderSchema>;

// وثائق المساهمين - Shareholder Documents
export const shareholderDocuments = pgTable("shareholder_documents", {
  id: serial("id").primaryKey(),
  shareholderId: integer("shareholder_id").notNull().references(() => shareholders.id, { onDelete: 'cascade' }),
  documentType: text("document_type").notNull(), // national_id, share_certificate, commercial_register, contract, bank_statement, other
  documentName: text("document_name").notNull(),
  originalFileName: text("original_file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_shareholder_docs_shareholder").on(table.shareholderId),
  index("idx_shareholder_docs_type").on(table.documentType),
]);

export const insertShareholderDocumentSchema = createInsertSchema(shareholderDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ShareholderDocument = typeof shareholderDocuments.$inferSelect;
export type InsertShareholderDocument = z.infer<typeof insertShareholderDocumentSchema>;

// تحويلات الأسهم - Share Transfers
export const shareTransfers = pgTable("share_transfers", {
  id: serial("id").primaryKey(),
  transferNumber: text("transfer_number").notNull().unique(),
  fromShareholderId: integer("from_shareholder_id").notNull().references(() => shareholders.id),
  toShareholderId: integer("to_shareholder_id").notNull().references(() => shareholders.id),
  numberOfShares: integer("number_of_shares").notNull(),
  pricePerShare: numeric("price_per_share", { precision: 12, scale: 2 }).notNull(),
  totalValue: numeric("total_value", { precision: 15, scale: 2 }).notNull(),
  transferDate: date("transfer_date").notNull(),
  transferType: text("transfer_type").notNull(), // sale, gift, inheritance, split
  approvalStatus: text("approval_status").default("pending"), // pending, approved, rejected, cancelled
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  boardResolutionId: integer("board_resolution_id"),
  certificateOldNumber: text("certificate_old_number"),
  certificateNewNumber: text("certificate_new_number"),
  attachmentUrl: text("attachment_url"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_share_transfers_from").on(table.fromShareholderId),
  index("idx_share_transfers_to").on(table.toShareholderId),
  index("idx_share_transfers_status").on(table.approvalStatus),
  index("idx_share_transfers_date").on(table.transferDate),
]);

export const insertShareTransferSchema = createInsertSchema(shareTransfers).omit({
  id: true,
  createdAt: true,
});

export type ShareTransfer = typeof shareTransfers.$inferSelect;
export type InsertShareTransfer = z.infer<typeof insertShareTransferSchema>;

// اجتماعات مجلس الإدارة والجمعية العمومية - Board & Assembly Meetings
export const governanceMeetings = pgTable("governance_meetings", {
  id: serial("id").primaryKey(),
  meetingNumber: text("meeting_number").notNull().unique(),
  meetingType: text("meeting_type").notNull(), // board, ordinary_assembly, extraordinary_assembly, committee
  title: text("title").notNull(),
  description: text("description"),
  meetingDate: timestamp("meeting_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  location: text("location"),
  locationType: text("location_type").default("in_person"), // in_person, virtual, hybrid
  virtualMeetingLink: text("virtual_meeting_link"),
  agenda: text("agenda"),
  agendaItems: jsonb("agenda_items"), // [{order: 1, title: "", description: "", presenter: "", duration: 15}]
  quorumRequired: numeric("quorum_required", { precision: 5, scale: 2 }).default("50.00"),
  quorumAchieved: boolean("quorum_achieved"),
  attendanceCount: integer("attendance_count").default(0),
  totalEligibleVotes: integer("total_eligible_votes"),
  status: text("status").default("scheduled"), // scheduled, in_progress, completed, cancelled, postponed
  postponedTo: timestamp("postponed_to"),
  cancellationReason: text("cancellation_reason"),
  invitationSentAt: timestamp("invitation_sent_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  minutesStatus: text("minutes_status").default("pending"), // pending, draft, approved, signed
  minutesApprovedAt: timestamp("minutes_approved_at"),
  minutesApprovedBy: varchar("minutes_approved_by").references(() => users.id),
  fiscalYear: text("fiscal_year"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_governance_meetings_type").on(table.meetingType),
  index("idx_governance_meetings_status").on(table.status),
  index("idx_governance_meetings_date").on(table.meetingDate),
  index("idx_governance_meetings_fiscal_year").on(table.fiscalYear),
]);

export const insertGovernanceMeetingSchema = createInsertSchema(governanceMeetings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type GovernanceMeeting = typeof governanceMeetings.$inferSelect;
export type InsertGovernanceMeeting = z.infer<typeof insertGovernanceMeetingSchema>;

// سجل حضور الاجتماعات - Meeting Attendance
export const meetingAttendance = pgTable("meeting_attendance", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => governanceMeetings.id, { onDelete: "cascade" }),
  attendeeType: text("attendee_type").notNull(), // board_member, shareholder, proxy, observer, secretary
  boardMemberId: integer("board_member_id").references(() => boardMembers.id),
  shareholderId: integer("shareholder_id").references(() => shareholders.id),
  attendeeName: text("attendee_name").notNull(),
  attendeeRole: text("attendee_role"),
  representedShares: integer("represented_shares"),
  votingPower: numeric("voting_power", { precision: 8, scale: 4 }),
  attendanceStatus: text("attendance_status").default("expected"), // expected, present, absent, excused, late, left_early
  arrivalTime: timestamp("arrival_time"),
  departureTime: timestamp("departure_time"),
  attendanceMethod: text("attendance_method").default("in_person"), // in_person, virtual, proxy
  proxyHolderName: text("proxy_holder_name"),
  proxyDocumentUrl: text("proxy_document_url"),
  signatureUrl: text("signature_url"),
  signedAt: timestamp("signed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_meeting_attendance_meeting").on(table.meetingId),
  index("idx_meeting_attendance_board_member").on(table.boardMemberId),
  index("idx_meeting_attendance_shareholder").on(table.shareholderId),
  index("idx_meeting_attendance_status").on(table.attendanceStatus),
]);

export const insertMeetingAttendanceSchema = createInsertSchema(meetingAttendance).omit({
  id: true,
  createdAt: true,
});

export type MeetingAttendance = typeof meetingAttendance.$inferSelect;
export type InsertMeetingAttendance = z.infer<typeof insertMeetingAttendanceSchema>;

// محاضر الاجتماعات - Meeting Minutes
export const meetingMinutes = pgTable("meeting_minutes", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => governanceMeetings.id, { onDelete: "cascade" }),
  minutesNumber: text("minutes_number").notNull().unique(),
  content: text("content").notNull(),
  summary: text("summary"),
  attendanceList: jsonb("attendance_list"), // [{name, role, status}]
  discussionPoints: jsonb("discussion_points"), // [{topic, discussion, conclusion}]
  decisions: jsonb("decisions"), // [{number, description, responsible, deadline}]
  votingResults: jsonb("voting_results"), // [{item, forVotes, againstVotes, abstain, result}]
  nextMeetingDate: timestamp("next_meeting_date"),
  attachments: jsonb("attachments"), // [{name, url, type}]
  status: text("status").default("draft"), // draft, pending_review, pending_signature, signed, archived
  preparedBy: varchar("prepared_by").references(() => users.id),
  preparedAt: timestamp("prepared_at"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  signedBy: jsonb("signed_by"), // [{userId, name, role, signatureUrl, signedAt}]
  archivedAt: timestamp("archived_at"),
  archiveReference: text("archive_reference"),
  pdfUrl: text("pdf_url"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_meeting_minutes_meeting").on(table.meetingId),
  index("idx_meeting_minutes_status").on(table.status),
  index("idx_meeting_minutes_number").on(table.minutesNumber),
]);

export const insertMeetingMinutesSchema = createInsertSchema(meetingMinutes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MeetingMinutes = typeof meetingMinutes.$inferSelect;
export type InsertMeetingMinutes = z.infer<typeof insertMeetingMinutesSchema>;

// قرارات مجلس الإدارة - Board Resolutions
export const boardResolutions = pgTable("board_resolutions", {
  id: serial("id").primaryKey(),
  resolutionNumber: text("resolution_number").notNull().unique(),
  meetingId: integer("meeting_id").references(() => governanceMeetings.id),
  resolutionType: text("resolution_type").notNull(), // regular, circular, emergency, administrative, financial
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category"), // financial, operational, strategic, hr, legal, governance
  priority: text("priority").default("normal"), // low, normal, high, urgent
  proposedBy: varchar("proposed_by").references(() => users.id),
  proposedAt: timestamp("proposed_at").notNull(),
  votingRequired: boolean("voting_required").default(true),
  votingDeadline: timestamp("voting_deadline"),
  forVotes: integer("for_votes").default(0),
  againstVotes: integer("against_votes").default(0),
  abstainVotes: integer("abstain_votes").default(0),
  totalVotes: integer("total_votes").default(0),
  requiredMajority: numeric("required_majority", { precision: 5, scale: 2 }).default("50.00"),
  status: text("status").default("draft"), // draft, proposed, voting, approved, rejected, implemented, cancelled
  approvedAt: timestamp("approved_at"),
  implementationDeadline: date("implementation_deadline"),
  implementationStatus: text("implementation_status").default("pending"), // pending, in_progress, completed, overdue
  implementedAt: timestamp("implemented_at"),
  responsiblePerson: varchar("responsible_person").references(() => users.id),
  financialImpact: numeric("financial_impact", { precision: 15, scale: 2 }),
  attachments: jsonb("attachments"),
  relatedResolutions: integer("related_resolutions").array(),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_board_resolutions_meeting").on(table.meetingId),
  index("idx_board_resolutions_type").on(table.resolutionType),
  index("idx_board_resolutions_status").on(table.status),
  index("idx_board_resolutions_category").on(table.category),
  index("idx_board_resolutions_implementation").on(table.implementationStatus),
]);

export const insertBoardResolutionSchema = createInsertSchema(boardResolutions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BoardResolution = typeof boardResolutions.$inferSelect;
export type InsertBoardResolution = z.infer<typeof insertBoardResolutionSchema>;

// التصويت على القرارات - Resolution Votes
export const resolutionVotes = pgTable("resolution_votes", {
  id: serial("id").primaryKey(),
  resolutionId: integer("resolution_id").notNull().references(() => boardResolutions.id, { onDelete: "cascade" }),
  voterType: text("voter_type").notNull(), // board_member, shareholder
  boardMemberId: integer("board_member_id").references(() => boardMembers.id),
  shareholderId: integer("shareholder_id").references(() => shareholders.id),
  voterName: text("voter_name").notNull(),
  vote: text("vote").notNull(), // for, against, abstain
  votingPower: numeric("voting_power", { precision: 18, scale: 4 }).default("1.00"),
  weightedVote: numeric("weighted_vote", { precision: 18, scale: 4 }),
  votedAt: timestamp("voted_at").defaultNow().notNull(),
  voteMethod: text("vote_method").default("in_meeting"), // in_meeting, electronic, written
  ipAddress: text("ip_address"),
  deviceInfo: text("device_info"),
  signatureUrl: text("signature_url"),
  comments: text("comments"),
  isValid: boolean("is_valid").default(true),
  invalidationReason: text("invalidation_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_resolution_votes_resolution").on(table.resolutionId),
  index("idx_resolution_votes_board_member").on(table.boardMemberId),
  index("idx_resolution_votes_shareholder").on(table.shareholderId),
  index("idx_resolution_votes_vote").on(table.vote),
]);

export const insertResolutionVoteSchema = createInsertSchema(resolutionVotes).omit({
  id: true,
  createdAt: true,
});

export type ResolutionVote = typeof resolutionVotes.$inferSelect;
export type InsertResolutionVote = z.infer<typeof insertResolutionVoteSchema>;

// التوقيعات الإلكترونية على القرارات - Resolution Electronic Signatures
export const resolutionSignatures = pgTable("resolution_signatures", {
  id: serial("id").primaryKey(),
  resolutionId: integer("resolution_id").notNull().references(() => boardResolutions.id, { onDelete: "cascade" }),
  boardMemberId: integer("board_member_id").references(() => boardMembers.id, { onDelete: "cascade" }),
  shareholderId: integer("shareholder_id").references(() => shareholders.id, { onDelete: "cascade" }),
  signerName: text("signer_name"),
  signerType: text("signer_type").default("board_member"), // board_member, shareholder
  signatureToken: text("signature_token").notNull().unique(),
  signatureData: text("signature_data"),
  signatureType: text("signature_type").default("draw"), // draw, type, upload
  status: text("status").default("pending").notNull(), // pending, signed, declined, expired
  signedAt: timestamp("signed_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  reminderCount: integer("reminder_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_resolution_signatures_resolution").on(table.resolutionId),
  index("idx_resolution_signatures_member").on(table.boardMemberId),
  index("idx_resolution_signatures_shareholder").on(table.shareholderId),
  index("idx_resolution_signatures_token").on(table.signatureToken),
  index("idx_resolution_signatures_status").on(table.status),
]);

export const insertResolutionSignatureSchema = createInsertSchema(resolutionSignatures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ResolutionSignature = typeof resolutionSignatures.$inferSelect;
export type InsertResolutionSignature = z.infer<typeof insertResolutionSignatureSchema>;

// Voting Tokens - روابط التصويت العام للمساهمين
export const votingTokens = pgTable("voting_tokens", {
  id: serial("id").primaryKey(),
  resolutionId: integer("resolution_id").notNull().references(() => boardResolutions.id, { onDelete: "cascade" }),
  shareholderId: integer("shareholder_id").notNull().references(() => shareholders.id, { onDelete: "cascade" }),
  voteToken: text("vote_token").notNull().unique(),
  vote: text("vote"), // for, against, abstain
  voteWeight: integer("vote_weight").default(1), // وزن التصويت (عدد الأسهم)
  comments: text("comments"),
  signatureData: text("signature_data"), // توقيع المساهم (base64 encoded)
  status: text("status").default("pending").notNull(), // pending, voted, expired
  votedAt: timestamp("voted_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  reminderCount: integer("reminder_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_voting_tokens_resolution").on(table.resolutionId),
  index("idx_voting_tokens_shareholder").on(table.shareholderId),
  index("idx_voting_tokens_token").on(table.voteToken),
  index("idx_voting_tokens_status").on(table.status),
  unique("idx_voting_tokens_unique").on(table.resolutionId, table.shareholderId),
]);

export const insertVotingTokenSchema = createInsertSchema(votingTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VotingToken = typeof votingTokens.$inferSelect;
export type InsertVotingToken = z.infer<typeof insertVotingTokenSchema>;

// رأس المال والأسهم - Capital & Shares Management
export const capitalTransactions = pgTable("capital_transactions", {
  id: serial("id").primaryKey(),
  transactionNumber: text("transaction_number").notNull().unique(),
  transactionType: text("transaction_type").notNull(), // increase, decrease, split, merge, bonus_issue
  description: text("description").notNull(),
  previousCapital: numeric("previous_capital", { precision: 15, scale: 2 }).notNull(),
  newCapital: numeric("new_capital", { precision: 15, scale: 2 }).notNull(),
  changeAmount: numeric("change_amount", { precision: 15, scale: 2 }).notNull(),
  previousShares: integer("previous_shares").notNull(),
  newShares: integer("new_shares").notNull(),
  shareChange: integer("share_change").notNull(),
  pricePerShare: numeric("price_per_share", { precision: 12, scale: 2 }),
  effectiveDate: date("effective_date").notNull(),
  boardResolutionId: integer("board_resolution_id").references(() => boardResolutions.id),
  assemblyApprovalRequired: boolean("assembly_approval_required").default(true),
  assemblyMeetingId: integer("assembly_meeting_id").references(() => governanceMeetings.id),
  regulatoryApprovalDate: date("regulatory_approval_date"),
  regulatoryApprovalNumber: text("regulatory_approval_number"),
  registrationDate: date("registration_date"),
  status: text("status").default("pending"), // pending, approved, registered, completed, cancelled
  attachments: jsonb("attachments"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_capital_transactions_type").on(table.transactionType),
  index("idx_capital_transactions_status").on(table.status),
  index("idx_capital_transactions_date").on(table.effectiveDate),
]);

export const insertCapitalTransactionSchema = createInsertSchema(capitalTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CapitalTransaction = typeof capitalTransactions.$inferSelect;
export type InsertCapitalTransaction = z.infer<typeof insertCapitalTransactionSchema>;

// توزيعات الأرباح - Dividend Distributions
export const dividendDistributions = pgTable("dividend_distributions", {
  id: serial("id").primaryKey(),
  distributionNumber: text("distribution_number").notNull().unique(),
  fiscalYear: text("fiscal_year").notNull(),
  distributionType: text("distribution_type").notNull(), // cash, stock, mixed
  description: text("description"),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
  amountPerShare: numeric("amount_per_share", { precision: 12, scale: 4 }).notNull(),
  eligibleShares: integer("eligible_shares").notNull(),
  recordDate: date("record_date").notNull(),
  paymentDate: date("payment_date").notNull(),
  boardResolutionId: integer("board_resolution_id").references(() => boardResolutions.id),
  assemblyMeetingId: integer("assembly_meeting_id").references(() => governanceMeetings.id),
  status: text("status").default("announced"), // announced, record_closed, in_payment, completed
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).default("0"),
  withholdingTaxRate: numeric("withholding_tax_rate", { precision: 5, scale: 2 }).default("0"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_dividend_distributions_year").on(table.fiscalYear),
  index("idx_dividend_distributions_status").on(table.status),
  index("idx_dividend_distributions_payment_date").on(table.paymentDate),
]);

export const insertDividendDistributionSchema = createInsertSchema(dividendDistributions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DividendDistribution = typeof dividendDistributions.$inferSelect;
export type InsertDividendDistribution = z.infer<typeof insertDividendDistributionSchema>;

// مدفوعات الأرباح للمساهمين - Shareholder Dividend Payments
export const shareholderDividends = pgTable("shareholder_dividends", {
  id: serial("id").primaryKey(),
  distributionId: integer("distribution_id").notNull().references(() => dividendDistributions.id, { onDelete: "cascade" }),
  shareholderId: integer("shareholder_id").notNull().references(() => shareholders.id),
  sharesHeld: integer("shares_held").notNull(),
  grossAmount: numeric("gross_amount", { precision: 12, scale: 2 }).notNull(),
  withholdingTax: numeric("withholding_tax", { precision: 12, scale: 2 }).default("0"),
  netAmount: numeric("net_amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").default("bank_transfer"), // bank_transfer, cheque, cash
  paymentReference: text("payment_reference"),
  paymentDate: date("payment_date"),
  status: text("status").default("pending"), // pending, processing, paid, failed, returned
  failureReason: text("failure_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_shareholder_dividends_distribution").on(table.distributionId),
  index("idx_shareholder_dividends_shareholder").on(table.shareholderId),
  index("idx_shareholder_dividends_status").on(table.status),
]);

export const insertShareholderDividendSchema = createInsertSchema(shareholderDividends).omit({
  id: true,
  createdAt: true,
});

export type ShareholderDividend = typeof shareholderDividends.$inferSelect;
export type InsertShareholderDividend = z.infer<typeof insertShareholderDividendSchema>;

// الإفصاحات والتقارير النظامية - Disclosures & Regulatory Reports
export const disclosures = pgTable("disclosures", {
  id: serial("id").primaryKey(),
  disclosureNumber: text("disclosure_number").notNull().unique(),
  disclosureType: text("disclosure_type").notNull(), // annual_report, quarterly_report, material_event, ownership_change, related_party
  title: text("title").notNull(),
  description: text("description"),
  fiscalYear: text("fiscal_year"),
  fiscalQuarter: text("fiscal_quarter"),
  reportingPeriodStart: date("reporting_period_start"),
  reportingPeriodEnd: date("reporting_period_end"),
  dueDate: date("due_date"),
  submissionDate: timestamp("submission_date"),
  publishDate: timestamp("publish_date"),
  regulatoryBody: text("regulatory_body"), // ministry_of_commerce, capital_market_authority, stock_exchange
  referenceNumber: text("reference_number"),
  category: text("category"), // financial, operational, governance, legal
  priority: text("priority").default("normal"), // low, normal, high, urgent
  status: text("status").default("draft"), // draft, pending_review, pending_approval, submitted, published, rejected
  content: text("content"),
  attachments: jsonb("attachments"),
  financialStatements: jsonb("financial_statements"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  isConfidential: boolean("is_confidential").default(false),
  publishUrl: text("publish_url"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_disclosures_type").on(table.disclosureType),
  index("idx_disclosures_status").on(table.status),
  index("idx_disclosures_fiscal_year").on(table.fiscalYear),
  index("idx_disclosures_due_date").on(table.dueDate),
  index("idx_disclosures_category").on(table.category),
]);

export const insertDisclosureSchema = createInsertSchema(disclosures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Disclosure = typeof disclosures.$inferSelect;
export type InsertDisclosure = z.infer<typeof insertDisclosureSchema>;

// الامتثال والمتطلبات النظامية - Compliance Requirements
export const complianceRequirements = pgTable("compliance_requirements", {
  id: serial("id").primaryKey(),
  requirementCode: text("requirement_code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // license, registration, permit, certification, report, filing
  regulatoryBody: text("regulatory_body").notNull(),
  applicableLaw: text("applicable_law"),
  frequency: text("frequency").notNull(), // one_time, annual, semi_annual, quarterly, monthly, as_needed
  isRecurring: boolean("is_recurring").default(true),
  currentStatus: text("current_status").default("pending"), // pending, valid, expiring_soon, expired, under_renewal
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  lastRenewalDate: date("last_renewal_date"),
  nextDueDate: date("next_due_date"),
  reminderDays: integer("reminder_days").default(30),
  documentNumber: text("document_number"),
  documentUrl: text("document_url"),
  cost: numeric("cost", { precision: 12, scale: 2 }),
  responsiblePerson: varchar("responsible_person").references(() => users.id),
  priority: text("priority").default("normal"), // low, normal, high, critical
  penaltyForNonCompliance: text("penalty_for_non_compliance"),
  notes: text("notes"),
  attachments: jsonb("attachments"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_compliance_requirements_category").on(table.category),
  index("idx_compliance_requirements_status").on(table.currentStatus),
  index("idx_compliance_requirements_due_date").on(table.nextDueDate),
  index("idx_compliance_requirements_frequency").on(table.frequency),
]);

export const insertComplianceRequirementSchema = createInsertSchema(complianceRequirements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ComplianceRequirement = typeof complianceRequirements.$inferSelect;
export type InsertComplianceRequirement = z.infer<typeof insertComplianceRequirementSchema>;

// سجل الامتثال والتجديدات - Compliance History
export const complianceHistory = pgTable("compliance_history", {
  id: serial("id").primaryKey(),
  requirementId: integer("requirement_id").notNull().references(() => complianceRequirements.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // renewal, submission, approval, expiry, penalty, update
  actionDate: timestamp("action_date").notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  documentNumber: text("document_number"),
  documentUrl: text("document_url"),
  validFrom: date("valid_from"),
  validUntil: date("valid_until"),
  cost: numeric("cost", { precision: 12, scale: 2 }),
  penaltyAmount: numeric("penalty_amount", { precision: 12, scale: 2 }),
  notes: text("notes"),
  performedBy: varchar("performed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_compliance_history_requirement").on(table.requirementId),
  index("idx_compliance_history_action").on(table.action),
  index("idx_compliance_history_date").on(table.actionDate),
]);

export const insertComplianceHistorySchema = createInsertSchema(complianceHistory).omit({
  id: true,
  createdAt: true,
});

export type ComplianceHistory = typeof complianceHistory.$inferSelect;
export type InsertComplianceHistory = z.infer<typeof insertComplianceHistorySchema>;

// =====================================================
// جداول إضافية للحوكمة المتقدمة
// =====================================================

// لجان مجلس الإدارة - Board Committees
export const boardCommittees = pgTable("board_committees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  description: text("description"),
  committeeType: text("committee_type").notNull(), // audit, remuneration, nomination, risk, executive, investment
  chairmanId: integer("chairman_id").references(() => boardMembers.id),
  secretaryId: integer("secretary_id").references(() => boardMembers.id),
  formationDate: date("formation_date").notNull(),
  termEndDate: date("term_end_date"),
  mandateDocument: text("mandate_document"),
  meetingFrequency: text("meeting_frequency").default("quarterly"), // monthly, quarterly, semi_annually, annually, as_needed
  quorumRequired: integer("quorum_required").default(2),
  status: text("status").default("active"), // active, inactive, dissolved
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_board_committees_type").on(table.committeeType),
  index("idx_board_committees_status").on(table.status),
]);

export const insertBoardCommitteeSchema = createInsertSchema(boardCommittees).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BoardCommittee = typeof boardCommittees.$inferSelect;
export type InsertBoardCommittee = z.infer<typeof insertBoardCommitteeSchema>;

// عضوية اللجان - Committee Memberships
export const committeeMemberships = pgTable("committee_memberships", {
  id: serial("id").primaryKey(),
  committeeId: integer("committee_id").notNull().references(() => boardCommittees.id, { onDelete: "cascade" }),
  boardMemberId: integer("board_member_id").notNull().references(() => boardMembers.id, { onDelete: "cascade" }),
  role: text("role").default("member"), // chairman, vice_chairman, member, secretary
  appointmentDate: date("appointment_date").notNull(),
  endDate: date("end_date"),
  status: text("status").default("active"), // active, ended, suspended
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_committee_memberships_committee").on(table.committeeId),
  index("idx_committee_memberships_member").on(table.boardMemberId),
  index("idx_committee_memberships_status").on(table.status),
]);

export const insertCommitteeMembershipSchema = createInsertSchema(committeeMemberships).omit({
  id: true,
  createdAt: true,
});

export type CommitteeMembership = typeof committeeMemberships.$inferSelect;
export type InsertCommitteeMembership = z.infer<typeof insertCommitteeMembershipSchema>;

// سجل المصالح والإفصاحات الشخصية - Interest Declarations
export const interestDeclarations = pgTable("interest_declarations", {
  id: serial("id").primaryKey(),
  declarationNumber: text("declaration_number").notNull().unique(),
  boardMemberId: integer("board_member_id").notNull().references(() => boardMembers.id, { onDelete: "cascade" }),
  declarationType: text("declaration_type").notNull(), // annual, transaction, related_party, conflict, update
  declarationDate: date("declaration_date").notNull(),
  fiscalYear: text("fiscal_year"),
  relatedPartyName: text("related_party_name"),
  relationshipType: text("relationship_type"), // family, business, financial, ownership
  description: text("description").notNull(),
  transactionType: text("transaction_type"), // purchase, sale, contract, employment
  transactionValue: numeric("transaction_value", { precision: 15, scale: 2 }),
  actionTaken: text("action_taken"), // recused, disclosed, abstained, approved
  boardDecision: text("board_decision"),
  status: text("status").default("pending"), // pending, reviewed, acknowledged, requires_action
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  attachments: jsonb("attachments"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_interest_declarations_member").on(table.boardMemberId),
  index("idx_interest_declarations_type").on(table.declarationType),
  index("idx_interest_declarations_status").on(table.status),
  index("idx_interest_declarations_year").on(table.fiscalYear),
]);

export const insertInterestDeclarationSchema = createInsertSchema(interestDeclarations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InterestDeclaration = typeof interestDeclarations.$inferSelect;
export type InsertInterestDeclaration = z.infer<typeof insertInterestDeclarationSchema>;

// شهادات التدريب والتأهيل - Training Certificates
export const boardMemberTraining = pgTable("board_member_training", {
  id: serial("id").primaryKey(),
  boardMemberId: integer("board_member_id").notNull().references(() => boardMembers.id, { onDelete: "cascade" }),
  trainingType: text("training_type").notNull(), // governance, financial, legal, compliance, leadership, industry
  title: text("title").notNull(),
  provider: text("provider"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  duration: integer("duration"), // hours
  certificateNumber: text("certificate_number"),
  certificateUrl: text("certificate_url"),
  expiryDate: date("expiry_date"),
  status: text("status").default("completed"), // registered, in_progress, completed, expired
  score: numeric("score", { precision: 5, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_board_member_training_member").on(table.boardMemberId),
  index("idx_board_member_training_type").on(table.trainingType),
  index("idx_board_member_training_status").on(table.status),
]);

export const insertBoardMemberTrainingSchema = createInsertSchema(boardMemberTraining).omit({
  id: true,
  createdAt: true,
});

export type BoardMemberTraining = typeof boardMemberTraining.$inferSelect;
export type InsertBoardMemberTraining = z.infer<typeof insertBoardMemberTrainingSchema>;

// التصويت بالوكالة - Proxy Voting
export const proxyVotes = pgTable("proxy_votes", {
  id: serial("id").primaryKey(),
  proxyNumber: text("proxy_number").notNull().unique(),
  meetingId: integer("meeting_id").notNull().references(() => governanceMeetings.id, { onDelete: "cascade" }),
  principalShareholderId: integer("principal_shareholder_id").notNull().references(() => shareholders.id),
  proxyHolderShareholderId: integer("proxy_holder_shareholder_id").references(() => shareholders.id),
  proxyHolderName: text("proxy_holder_name").notNull(),
  proxyHolderNationalId: text("proxy_holder_national_id"),
  sharesRepresented: integer("shares_represented").notNull(),
  votingPower: numeric("voting_power", { precision: 8, scale: 4 }).notNull(),
  proxyType: text("proxy_type").notNull(), // general, specific, limited
  votingInstructions: jsonb("voting_instructions"), // [{resolutionId, vote}]
  documentUrl: text("document_url"),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  status: text("status").default("pending"), // pending, verified, active, used, expired, revoked
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  usedAt: timestamp("used_at"),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_proxy_votes_meeting").on(table.meetingId),
  index("idx_proxy_votes_principal").on(table.principalShareholderId),
  index("idx_proxy_votes_holder").on(table.proxyHolderShareholderId),
  index("idx_proxy_votes_status").on(table.status),
]);

export const insertProxyVoteSchema = createInsertSchema(proxyVotes).omit({
  id: true,
  createdAt: true,
});

export type ProxyVote = typeof proxyVotes.$inferSelect;
export type InsertProxyVote = z.infer<typeof insertProxyVoteSchema>;

// سجل تدقيق التصويت - Voting Audit Log
export const votingAuditLog = pgTable("voting_audit_log", {
  id: serial("id").primaryKey(),
  resolutionId: integer("resolution_id").references(() => boardResolutions.id, { onDelete: "cascade" }),
  meetingId: integer("meeting_id").references(() => governanceMeetings.id),
  action: text("action").notNull(), // vote_cast, vote_changed, vote_cancelled, proxy_used, quorum_calculated, results_published
  actorType: text("actor_type").notNull(), // board_member, shareholder, proxy_holder, system, admin
  actorId: varchar("actor_id"),
  actorName: text("actor_name"),
  voteId: integer("vote_id").references(() => resolutionVotes.id),
  proxyId: integer("proxy_id").references(() => proxyVotes.id),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  votingPower: numeric("voting_power", { precision: 8, scale: 4 }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceFingerprint: text("device_fingerprint"),
  sessionId: text("session_id"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isValid: boolean("is_valid").default(true),
  validationNotes: text("validation_notes"),
}, (table) => [
  index("idx_voting_audit_resolution").on(table.resolutionId),
  index("idx_voting_audit_meeting").on(table.meetingId),
  index("idx_voting_audit_action").on(table.action),
  index("idx_voting_audit_actor").on(table.actorId),
  index("idx_voting_audit_timestamp").on(table.timestamp),
]);

export const insertVotingAuditLogSchema = createInsertSchema(votingAuditLog).omit({
  id: true,
});

export type VotingAuditLog = typeof votingAuditLog.$inferSelect;
export type InsertVotingAuditLog = z.infer<typeof insertVotingAuditLogSchema>;

// حساب النصاب - Quorum Calculations
export const quorumCalculations = pgTable("quorum_calculations", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => governanceMeetings.id, { onDelete: "cascade" }),
  calculationType: text("calculation_type").notNull(), // opening, closing, per_resolution
  resolutionId: integer("resolution_id").references(() => boardResolutions.id),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  totalEligibleShares: integer("total_eligible_shares").notNull(),
  totalEligibleVotes: integer("total_eligible_votes").notNull(),
  presentShares: integer("present_shares").notNull(),
  presentVotes: integer("present_votes").notNull(),
  proxyShares: integer("proxy_shares").default(0),
  proxyVotes: integer("proxy_votes").default(0),
  totalRepresentedShares: integer("total_represented_shares").notNull(),
  totalRepresentedVotes: integer("total_represented_votes").notNull(),
  percentageRepresented: numeric("percentage_represented", { precision: 8, scale: 4 }).notNull(),
  requiredQuorum: numeric("required_quorum", { precision: 5, scale: 2 }).notNull(),
  quorumMet: boolean("quorum_met").notNull(),
  notes: text("notes"),
  calculatedBy: varchar("calculated_by").references(() => users.id),
}, (table) => [
  index("idx_quorum_calculations_meeting").on(table.meetingId),
  index("idx_quorum_calculations_resolution").on(table.resolutionId),
  index("idx_quorum_calculations_type").on(table.calculationType),
]);

export const insertQuorumCalculationSchema = createInsertSchema(quorumCalculations).omit({
  id: true,
});

export type QuorumCalculation = typeof quorumCalculations.$inferSelect;
export type InsertQuorumCalculation = z.infer<typeof insertQuorumCalculationSchema>;

// ==================== نظام فتح وإغلاق الفروع ====================

// قوالب قوائم التحقق - Checklist Templates
export const checklistTemplates = pgTable("checklist_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  type: text("type").notNull(), // opening, closing
  category: text("category").notNull(), // cleanliness, equipment, products, inventory, cashier, employees, security, waste
  description: text("description"),
  icon: text("icon"),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  requiresPhoto: boolean("requires_photo").default(false),
  requiresNote: boolean("requires_note").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_checklist_templates_type").on(table.type),
  index("idx_checklist_templates_category").on(table.category),
]);

export const insertChecklistTemplateSchema = createInsertSchema(checklistTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type InsertChecklistTemplate = z.infer<typeof insertChecklistTemplateSchema>;

// بنود قوائم التحقق - Checklist Items
export const checklistItems = pgTable("checklist_items", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => checklistTemplates.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  titleEn: text("title_en"),
  description: text("description"),
  displayOrder: integer("display_order").default(0),
  requiresPhoto: boolean("requires_photo").default(false),
  requiresNote: boolean("requires_note").default(false),
  isCritical: boolean("is_critical").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_checklist_items_template").on(table.templateId),
]);

export const insertChecklistItemSchema = createInsertSchema(checklistItems).omit({
  id: true,
  createdAt: true,
});

export type ChecklistItem = typeof checklistItems.$inferSelect;
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;

// سجل الشفتات - Branch Shifts
export const branchShifts = pgTable("branch_shifts", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  shiftType: text("shift_type").notNull(), // morning, evening, night
  shiftDate: date("shift_date").notNull(),
  status: text("status").default("in_progress"), // in_progress, completed, pending_review
  supervisorId: varchar("supervisor_id").references(() => users.id),
  supervisorName: text("supervisor_name"),
  employeeCount: integer("employee_count"),
  openingTime: timestamp("opening_time"),
  closingTime: timestamp("closing_time"),
  totalSales: numeric("total_sales", { precision: 12, scale: 2 }),
  cashSales: numeric("cash_sales", { precision: 12, scale: 2 }),
  cardSales: numeric("card_sales", { precision: 12, scale: 2 }),
  transactionCount: integer("transaction_count"),
  cashVariance: numeric("cash_variance", { precision: 10, scale: 2 }),
  wasteAmount: numeric("waste_amount", { precision: 10, scale: 2 }),
  supervisorNotes: text("supervisor_notes"),
  customerFeedback: text("customer_feedback"),
  teamPerformance: text("team_performance"),
  improvements: text("improvements"),
  issues: text("issues"),
  openingCompleted: boolean("opening_completed").default(false),
  closingCompleted: boolean("closing_completed").default(false),
  openingCompletedAt: timestamp("opening_completed_at"),
  closingCompletedAt: timestamp("closing_completed_at"),
  // حقول الموقع الجغرافي GPS
  openingGpsLatitude: numeric("opening_gps_latitude", { precision: 10, scale: 7 }),
  openingGpsLongitude: numeric("opening_gps_longitude", { precision: 10, scale: 7 }),
  closingGpsLatitude: numeric("closing_gps_latitude", { precision: 10, scale: 7 }),
  closingGpsLongitude: numeric("closing_gps_longitude", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_branch_shifts_branch").on(table.branchId),
  index("idx_branch_shifts_date").on(table.shiftDate),
  index("idx_branch_shifts_status").on(table.status),
  index("idx_branch_shifts_supervisor").on(table.supervisorId),
]);

export const insertBranchShiftSchema = createInsertSchema(branchShifts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BranchShift = typeof branchShifts.$inferSelect;
export type InsertBranchShift = z.infer<typeof insertBranchShiftSchema>;

// تنفيذ قوائم التحقق - Shift Checklist Responses
export const shiftChecklistResponses = pgTable("shift_checklist_responses", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").notNull().references(() => branchShifts.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => checklistItems.id),
  checklistType: text("checklist_type").notNull(), // opening, closing
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by").references(() => users.id),
  completedByName: text("completed_by_name"),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  status: text("status").default("pending"), // pending, passed, failed, needs_attention
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_shift_checklist_shift").on(table.shiftId),
  index("idx_shift_checklist_item").on(table.itemId),
  index("idx_shift_checklist_type").on(table.checklistType),
]);

export const insertShiftChecklistResponseSchema = createInsertSchema(shiftChecklistResponses).omit({
  id: true,
  createdAt: true,
});

export type ShiftChecklistResponse = typeof shiftChecklistResponses.$inferSelect;
export type InsertShiftChecklistResponse = z.infer<typeof insertShiftChecklistResponseSchema>;

// صور الشفت - Shift Photos
export const shiftPhotos = pgTable("shift_photos", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").notNull().references(() => branchShifts.id, { onDelete: "cascade" }),
  checklistResponseId: integer("checklist_response_id").references(() => shiftChecklistResponses.id, { onDelete: "cascade" }),
  photoType: text("photo_type").notNull(), // checklist, general, issue, team
  category: text("category"), // cleanliness, equipment, products, etc.
  photoUrl: text("photo_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  caption: text("caption"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedByName: text("uploaded_by_name"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (table) => [
  index("idx_shift_photos_shift").on(table.shiftId),
  index("idx_shift_photos_response").on(table.checklistResponseId),
  index("idx_shift_photos_type").on(table.photoType),
]);

export const insertShiftPhotoSchema = createInsertSchema(shiftPhotos).omit({
  id: true,
  uploadedAt: true,
});

export type ShiftPhoto = typeof shiftPhotos.$inferSelect;
export type InsertShiftPhoto = z.infer<typeof insertShiftPhotoSchema>;

// التوقيعات الإلكترونية - Shift Signatures
export const shiftSignatures = pgTable("shift_signatures", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").notNull().references(() => branchShifts.id, { onDelete: "cascade" }),
  signatureType: text("signature_type").notNull(), // opening_supervisor, closing_supervisor, cashier, manager
  signatureData: text("signature_data").notNull(), // base64 or URL
  signedBy: varchar("signed_by").references(() => users.id),
  signerName: text("signer_name").notNull(),
  signerRole: text("signer_role"),
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
}, (table) => [
  index("idx_shift_signatures_shift").on(table.shiftId),
  index("idx_shift_signatures_type").on(table.signatureType),
]);

export const insertShiftSignatureSchema = createInsertSchema(shiftSignatures).omit({
  id: true,
  signedAt: true,
});

export type ShiftSignature = typeof shiftSignatures.$inferSelect;
export type InsertShiftSignature = z.infer<typeof insertShiftSignatureSchema>;

// سجل الهدر اليومي - Daily Waste Log
export const dailyWasteLog = pgTable("daily_waste_log", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").notNull().references(() => branchShifts.id, { onDelete: "cascade" }),
  productName: text("product_name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").default("piece"),
  reason: text("reason").notNull(), // expired, damaged, overproduction, quality, other
  estimatedCost: numeric("estimated_cost", { precision: 10, scale: 2 }),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  recordedBy: varchar("recorded_by").references(() => users.id),
  recordedByName: text("recorded_by_name"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
}, (table) => [
  index("idx_daily_waste_shift").on(table.shiftId),
  index("idx_daily_waste_reason").on(table.reason),
]);

export const insertDailyWasteLogSchema = createInsertSchema(dailyWasteLog).omit({
  id: true,
  recordedAt: true,
});

export type DailyWasteLog = typeof dailyWasteLog.$inferSelect;
export type InsertDailyWasteLog = z.infer<typeof insertDailyWasteLogSchema>;

// سجل تدقيق الشفتات - Shift Audit Log
export const shiftAuditLog = pgTable("shift_audit_log", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").notNull().references(() => branchShifts.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // create, update, complete_opening, complete_closing, add_photo, add_signature
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  performedBy: varchar("performed_by").references(() => users.id),
  performedByName: text("performed_by_name"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  gpsLatitude: numeric("gps_latitude", { precision: 10, scale: 7 }),
  gpsLongitude: numeric("gps_longitude", { precision: 10, scale: 7 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_shift_audit_shift").on(table.shiftId),
  index("idx_shift_audit_action").on(table.action),
  index("idx_shift_audit_date").on(table.createdAt),
]);

export const insertShiftAuditLogSchema = createInsertSchema(shiftAuditLog).omit({
  id: true,
  createdAt: true,
});

export type ShiftAuditLog = typeof shiftAuditLog.$inferSelect;
export type InsertShiftAuditLog = z.infer<typeof insertShiftAuditLogSchema>;

// بنود قوائم التحقق المخصصة للفروع - Branch Custom Checklist Items
export const branchCustomChecklistItems = pgTable("branch_custom_checklist_items", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  templateId: integer("template_id").notNull().references(() => checklistTemplates.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  titleEn: text("title_en"),
  description: text("description"),
  displayOrder: integer("display_order").default(100),
  requiresPhoto: boolean("requires_photo").default(false),
  requiresNote: boolean("requires_note").default(false),
  isCritical: boolean("is_critical").default(false),
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_branch_custom_items_branch").on(table.branchId),
  index("idx_branch_custom_items_template").on(table.templateId),
]);

export const insertBranchCustomChecklistItemSchema = createInsertSchema(branchCustomChecklistItems).omit({
  id: true,
  createdAt: true,
});

export type BranchCustomChecklistItem = typeof branchCustomChecklistItems.$inferSelect;
export type InsertBranchCustomChecklistItem = z.infer<typeof insertBranchCustomChecklistItemSchema>;

// تذكيرات الشفتات - Shift Reminders
export const shiftReminders = pgTable("shift_reminders", {
  id: serial("id").primaryKey(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  reminderType: text("reminder_type").notNull(), // opening_not_started, opening_incomplete, closing_not_started, closing_incomplete
  shiftDate: date("shift_date").notNull(),
  shiftType: text("shift_type").notNull(),
  reminderTime: timestamp("reminder_time").notNull(),
  isSent: boolean("is_sent").default(false),
  sentAt: timestamp("sent_at"),
  notificationChannels: text("notification_channels").array().default(["system"]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_shift_reminders_branch").on(table.branchId),
  index("idx_shift_reminders_date").on(table.shiftDate),
  index("idx_shift_reminders_sent").on(table.isSent),
]);

export const insertShiftReminderSchema = createInsertSchema(shiftReminders).omit({
  id: true,
  createdAt: true,
});

export type ShiftReminder = typeof shiftReminders.$inferSelect;
export type InsertShiftReminder = z.infer<typeof insertShiftReminderSchema>;

// =====================================================
// Social Responsibility - المسؤولية الاجتماعية
// =====================================================

// الجهات المستفيدة - Beneficiary Organizations
export const beneficiaryOrganizations = pgTable("beneficiary_organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  organizationType: text("organization_type").notNull(), // government, charity, ngo, club, educational, healthcare, other
  category: text("category"), // social, environmental, health, education, sports, cultural
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  registrationNumber: text("registration_number"),
  taxNumber: text("tax_number"),
  website: text("website"),
  logoUrl: text("logo_url"),
  description: text("description"),
  partnershipType: text("partnership_type"), // discount, donation, sponsorship, collaboration
  discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }),
  status: text("status").default("active"), // active, inactive, suspended
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_beneficiary_org_type").on(table.organizationType),
  index("idx_beneficiary_org_status").on(table.status),
  index("idx_beneficiary_org_partnership").on(table.partnershipType),
]);

export const insertBeneficiaryOrganizationSchema = createInsertSchema(beneficiaryOrganizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BeneficiaryOrganization = typeof beneficiaryOrganizations.$inferSelect;
export type InsertBeneficiaryOrganization = z.infer<typeof insertBeneficiaryOrganizationSchema>;

// المبادرات الاجتماعية - Social Initiatives
export const socialInitiatives = pgTable("social_initiatives", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  titleEn: text("title_en"),
  initiativeType: text("initiative_type").notNull(), // campaign, event, donation, sponsorship, awareness, volunteering
  category: text("category"), // social, environmental, health, education, sports, cultural
  description: text("description"),
  objectives: text("objectives"),
  targetAudience: text("target_audience"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  budget: numeric("budget", { precision: 12, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 12, scale: 2 }),
  beneficiaryOrganizationId: integer("beneficiary_organization_id").references(() => beneficiaryOrganizations.id),
  partnersNames: text("partners_names"),
  channels: text("channels").array(), // social_media, website, print, tv, radio, outdoor
  status: text("status").default("planned"), // planned, active, completed, cancelled
  impactMetrics: text("impact_metrics"),
  beneficiariesCount: integer("beneficiaries_count"),
  mediaLinks: text("media_links").array(),
  attachments: text("attachments").array(),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_social_init_type").on(table.initiativeType),
  index("idx_social_init_status").on(table.status),
  index("idx_social_init_dates").on(table.startDate, table.endDate),
  index("idx_social_init_beneficiary").on(table.beneficiaryOrganizationId),
]);

export const insertSocialInitiativeSchema = createInsertSchema(socialInitiatives).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SocialInitiative = typeof socialInitiatives.$inferSelect;
export type InsertSocialInitiative = z.infer<typeof insertSocialInitiativeSchema>;

// رموز الخصم المجتمعية - Community Discount Codes
export const communityDiscounts = pgTable("community_discounts", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  discountType: text("discount_type").notNull(), // percentage, fixed_amount
  discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull(),
  minimumOrder: numeric("minimum_order", { precision: 10, scale: 2 }),
  maximumDiscount: numeric("maximum_discount", { precision: 10, scale: 2 }),
  beneficiaryOrganizationId: integer("beneficiary_organization_id").references(() => beneficiaryOrganizations.id),
  initiativeId: integer("initiative_id").references(() => socialInitiatives.id),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to").notNull(),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").default(0),
  usageLimitPerUser: integer("usage_limit_per_user"),
  applicableBranches: text("applicable_branches").array(),
  applicableProducts: text("applicable_products").array(),
  status: text("status").default("active"), // active, inactive, expired
  terms: text("terms"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_community_discount_code").on(table.code),
  index("idx_community_discount_status").on(table.status),
  index("idx_community_discount_validity").on(table.validFrom, table.validTo),
  index("idx_community_discount_org").on(table.beneficiaryOrganizationId),
]);

export const insertCommunityDiscountSchema = createInsertSchema(communityDiscounts).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export type CommunityDiscount = typeof communityDiscounts.$inferSelect;
export type InsertCommunityDiscount = z.infer<typeof insertCommunityDiscountSchema>;

// سجل استخدام الخصومات - Discount Usage Log
export const discountUsageLogs = pgTable("discount_usage_logs", {
  id: serial("id").primaryKey(),
  discountId: integer("discount_id").notNull().references(() => communityDiscounts.id, { onDelete: "cascade" }),
  branchId: varchar("branch_id").references(() => branches.id),
  orderId: text("order_id"),
  orderAmount: numeric("order_amount", { precision: 12, scale: 2 }),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  usedBy: varchar("used_by").references(() => users.id),
  usedAt: timestamp("used_at").defaultNow().notNull(),
  notes: text("notes"),
}, (table) => [
  index("idx_discount_usage_discount").on(table.discountId),
  index("idx_discount_usage_branch").on(table.branchId),
  index("idx_discount_usage_date").on(table.usedAt),
]);

export const insertDiscountUsageLogSchema = createInsertSchema(discountUsageLogs).omit({
  id: true,
  usedAt: true,
});

export type DiscountUsageLog = typeof discountUsageLogs.$inferSelect;
export type InsertDiscountUsageLog = z.infer<typeof insertDiscountUsageLogSchema>;

export const meetingRsvps = pgTable("meeting_rsvps", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => governanceMeetings.id, { onDelete: "cascade" }),
  shareholderId: integer("shareholder_id").notNull().references(() => shareholders.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  status: text("status").default("pending"),
  confirmedAt: timestamp("confirmed_at"),
  declinedAt: timestamp("declined_at"),
  responseNote: text("response_note"),
  shareholderName: text("shareholder_name").notNull(),
  shareholderPhone: text("shareholder_phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_meeting_rsvps_meeting").on(table.meetingId),
  index("idx_meeting_rsvps_shareholder").on(table.shareholderId),
  index("idx_meeting_rsvps_token").on(table.token),
]);

export const insertMeetingRsvpSchema = createInsertSchema(meetingRsvps).omit({
  id: true,
  createdAt: true,
});

export type MeetingRsvp = typeof meetingRsvps.$inferSelect;
export type InsertMeetingRsvp = z.infer<typeof insertMeetingRsvpSchema>;

// WebAuthn Biometric Credentials - بيانات البصمة البيومترية
export const biometricCredentials = pgTable("biometric_credentials", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id").notNull(),
  employeeName: text("employee_name").notNull(),
  branchId: varchar("branch_id").notNull().references(() => branches.id),
  credentialId: text("credential_id").notNull(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").default(0).notNull(),
  deviceInfo: text("device_info"),
  deviceType: text("device_type"), // mobile_android, mobile_ios, tablet, desktop
  deviceModel: text("device_model"), // Samsung Galaxy S24, iPhone 15, etc.
  registrationMethod: text("registration_method").default("fingerprint"), // fingerprint, face, pin
  verificationPin: text("verification_pin"), // hashed 4-6 digit PIN for cross-device verification
  registeredBy: varchar("registered_by").references(() => users.id),
  registeredByName: text("registered_by_name"),
  isActive: boolean("is_active").default(true).notNull(),
  deactivatedAt: timestamp("deactivated_at"),
  deactivatedBy: varchar("deactivated_by"),
  deactivationReason: text("deactivation_reason"),
  lastUsedAt: timestamp("last_used_at"),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_biometric_employee").on(table.employeeId),
  index("idx_biometric_branch").on(table.branchId),
  index("idx_biometric_credential").on(table.credentialId),
]);

export const insertBiometricCredentialSchema = createInsertSchema(biometricCredentials).omit({
  id: true,
  lastUsedAt: true,
  usageCount: true,
  deactivatedAt: true,
  deactivatedBy: true,
  deactivationReason: true,
  createdAt: true,
});

export type BiometricCredential = typeof biometricCredentials.$inferSelect;
export type InsertBiometricCredential = z.infer<typeof insertBiometricCredentialSchema>;
