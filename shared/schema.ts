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

// Audit logs table for tracking changes
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
