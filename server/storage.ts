import { 
  type Branch, 
  type InsertBranch,
  type InventoryItem,
  type InsertInventoryItem,
  type AuditLog,
  type InsertAuditLog,
  type SystemAuditLog,
  type InsertSystemAuditLog,
  type Backup,
  type InsertBackup,
  type SavedFilter,
  type InsertSavedFilter,
  type User,
  type UpsertUser,
  type InsertUser,
  type ConstructionCategory,
  type InsertConstructionCategory,
  type Contractor,
  type InsertContractor,
  type ConstructionProject,
  type InsertConstructionProject,
  type ProjectWorkItem,
  type InsertProjectWorkItem,
  type ProjectBudgetAllocation,
  type InsertProjectBudgetAllocation,
  type ConstructionContract,
  type InsertConstructionContract,
  type ContractItem,
  type InsertContractItem,
  type PaymentRequest,
  type InsertPaymentRequest,
  type ContractPayment,
  type InsertContractPayment,
  type UserPermission,
  type InsertUserPermission,
  type PermissionAuditLog,
  type InsertPermissionAuditLog,
  type AssetTransfer,
  type InsertAssetTransfer,
  type AssetTransferEvent,
  type InsertAssetTransferEvent,
  type ExternalIntegration,
  type InsertExternalIntegration,
  type NotificationTemplate,
  type InsertNotificationTemplate,
  type NotificationQueueItem,
  type InsertNotificationQueueItem,
  type DataImportJob,
  type InsertDataImportJob,
  type AccountingExport,
  type InsertAccountingExport,
  type Product,
  type InsertProduct,
  type Shift,
  type InsertShift,
  type ShiftEmployee,
  type InsertShiftEmployee,
  type ProductionOrder,
  type InsertProductionOrder,
  type QualityCheck,
  type InsertQualityCheck,
  type DailyOperationsSummary,
  type InsertDailyOperationsSummary,
  type CashierSalesJournal,
  type InsertCashierSalesJournal,
  type CashierPaymentBreakdown,
  type InsertCashierPaymentBreakdown,
  type CashierSignature,
  type InsertCashierSignature,
  type TargetWeightProfile,
  type InsertTargetWeightProfile,
  type BranchMonthlyTarget,
  type InsertBranchMonthlyTarget,
  type TargetDailyAllocation,
  type InsertTargetDailyAllocation,
  type TargetShiftAllocation,
  type InsertTargetShiftAllocation,
  type IncentiveTier,
  type InsertIncentiveTier,
  type IncentiveAward,
  type InsertIncentiveAward,
  type SeasonHoliday,
  type InsertSeasonHoliday,
  type CommissionRate,
  type BranchDailySales,
  type InsertBranchDailySales,
  type CashierShiftPerformance,
  type InsertCashierShiftPerformance,
  type InsertCommissionRate,
  type CommissionCalculation,
  type InsertCommissionCalculation,
  branches,
  inventoryItems,
  auditLogs,
  systemAuditLogs,
  backups,
  savedFilters,
  users,
  constructionCategories,
  contractors,
  constructionProjects,
  projectWorkItems,
  projectBudgetAllocations,
  constructionContracts,
  contractItems,
  paymentRequests,
  contractPayments,
  userPermissions,
  permissionAuditLogs,
  assetTransfers,
  assetTransferEvents,
  externalIntegrations,
  notificationTemplates,
  notificationQueue,
  dataImportJobs,
  accountingExports,
  products,
  shifts,
  shiftEmployees,
  productionOrders,
  qualityChecks,
  dailyOperationsSummary,
  cashierSalesJournals,
  cashierPaymentBreakdowns,
  cashierSignatures,
  journalAttachments,
  type JournalAttachment,
  type InsertJournalAttachment,
  JOB_ROLE_PERMISSION_TEMPLATES,
  targetWeightProfiles,
  branchMonthlyTargets,
  targetDailyAllocations,
  targetShiftAllocations,
  incentiveTiers,
  incentiveAwards,
  seasonsHolidays,
  commissionRates,
  commissionCalculations,
  branchDailySales,
  cashierShiftPerformance,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, or, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User | undefined>;
  verifyPassword(username: string, password: string): Promise<User | null>;
  
  // Branches
  getAllBranches(): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  
  // Inventory Items
  getAllInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItemsByBranch(branchId: string): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(item: InsertInventoryItem, userId?: string): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>, userId?: string): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string, userId?: string): Promise<boolean>;
  getItemsNeedingInspection(): Promise<InventoryItem[]>;
  
  // Audit Logs
  getAuditLogsForItem(itemId: string): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  
  // Saved Filters
  getAllSavedFilters(): Promise<SavedFilter[]>;
  getSavedFilter(id: number): Promise<SavedFilter | undefined>;
  createSavedFilter(filter: InsertSavedFilter): Promise<SavedFilter>;
  deleteSavedFilter(id: number): Promise<boolean>;

  // Construction Categories
  getAllConstructionCategories(): Promise<ConstructionCategory[]>;
  
  // Contractors
  getAllContractors(): Promise<Contractor[]>;
  getContractor(id: number): Promise<Contractor | undefined>;
  createContractor(contractor: InsertContractor): Promise<Contractor>;
  updateContractor(id: number, contractor: Partial<InsertContractor>): Promise<Contractor | undefined>;
  deleteContractor(id: number): Promise<boolean>;
  
  // Construction Projects
  getAllConstructionProjects(): Promise<ConstructionProject[]>;
  getConstructionProjectsByBranch(branchId: string): Promise<ConstructionProject[]>;
  getConstructionProject(id: number): Promise<ConstructionProject | undefined>;
  createConstructionProject(project: InsertConstructionProject): Promise<ConstructionProject>;
  updateConstructionProject(id: number, project: Partial<InsertConstructionProject>): Promise<ConstructionProject | undefined>;
  deleteConstructionProject(id: number): Promise<boolean>;
  
  // Project Work Items
  getAllWorkItems(): Promise<ProjectWorkItem[]>;
  getWorkItemsByProject(projectId: number): Promise<ProjectWorkItem[]>;
  getWorkItem(id: number): Promise<ProjectWorkItem | undefined>;
  createWorkItem(item: InsertProjectWorkItem): Promise<ProjectWorkItem>;
  updateWorkItem(id: number, item: Partial<InsertProjectWorkItem>): Promise<ProjectWorkItem | undefined>;
  deleteWorkItem(id: number): Promise<boolean>;
  
  // Project Budget Allocations
  getBudgetAllocationsByProject(projectId: number): Promise<ProjectBudgetAllocation[]>;
  getBudgetAllocation(id: number): Promise<ProjectBudgetAllocation | undefined>;
  createBudgetAllocation(allocation: InsertProjectBudgetAllocation): Promise<ProjectBudgetAllocation>;
  updateBudgetAllocation(id: number, allocation: Partial<InsertProjectBudgetAllocation>): Promise<ProjectBudgetAllocation | undefined>;
  deleteBudgetAllocation(id: number): Promise<boolean>;
  upsertBudgetAllocation(allocation: InsertProjectBudgetAllocation): Promise<ProjectBudgetAllocation>;
  getHistoricalCategoryAverages(): Promise<{ categoryId: number; categoryName: string; avgCost: number; projectCount: number; totalCost: number }[]>;
  
  // Construction Contracts
  getAllContracts(): Promise<ConstructionContract[]>;
  getContractsByProject(projectId: number): Promise<ConstructionContract[]>;
  getContract(id: number): Promise<ConstructionContract | undefined>;
  createContract(contract: InsertConstructionContract): Promise<ConstructionContract>;
  updateContract(id: number, contract: Partial<InsertConstructionContract>): Promise<ConstructionContract | undefined>;
  deleteContract(id: number): Promise<boolean>;
  
  // Contract Items
  getContractItems(contractId: number): Promise<ContractItem[]>;
  getContractItem(id: number): Promise<ContractItem | undefined>;
  createContractItem(item: InsertContractItem): Promise<ContractItem>;
  updateContractItem(id: number, item: Partial<InsertContractItem>): Promise<ContractItem | undefined>;
  deleteContractItem(id: number): Promise<boolean>;
  
  // Payment Requests
  getAllPaymentRequests(): Promise<PaymentRequest[]>;
  getPaymentRequestsByProject(projectId: number): Promise<PaymentRequest[]>;
  getPaymentRequestsByStatus(status: string): Promise<PaymentRequest[]>;
  getPaymentRequest(id: number): Promise<PaymentRequest | undefined>;
  createPaymentRequest(request: InsertPaymentRequest): Promise<PaymentRequest>;
  updatePaymentRequest(id: number, request: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined>;
  deletePaymentRequest(id: number): Promise<boolean>;
  approvePaymentRequest(id: number, approvedBy: string): Promise<PaymentRequest | undefined>;
  rejectPaymentRequest(id: number, reason: string): Promise<PaymentRequest | undefined>;
  markPaymentRequestAsPaid(id: number): Promise<PaymentRequest | undefined>;
  
  // Contract Payments
  getContractPayments(contractId: number): Promise<ContractPayment[]>;
  createContractPayment(payment: InsertContractPayment): Promise<ContractPayment>;
  
  // User Permissions
  getUserPermissions(userId: string): Promise<UserPermission[]>;
  setUserPermission(permission: InsertUserPermission): Promise<UserPermission>;
  deleteUserPermissions(userId: string): Promise<boolean>;
  hasPermission(userId: string, module: string, action: string): Promise<boolean>;
  
  // Permission Audit Logs
  createPermissionAuditLog(log: InsertPermissionAuditLog): Promise<PermissionAuditLog>;
  getPermissionAuditLogs(targetUserId?: string): Promise<PermissionAuditLog[]>;
  
  // Transactional permission update
  updateUserPermissionsWithAudit(
    userId: string,
    permissions: { module: string; actions: string[] }[],
    changedByUserId: string,
    templateApplied: string | null
  ): Promise<UserPermission[]>;
  
  // Apply job role permissions to user
  applyJobRolePermissions(
    userId: string,
    jobTitle: string,
    changedByUserId: string
  ): Promise<UserPermission[]>;
  
  // Asset Transfers
  getAllAssetTransfers(): Promise<AssetTransfer[]>;
  getAssetTransfer(id: number): Promise<AssetTransfer | undefined>;
  getAssetTransfersByItem(itemId: string): Promise<AssetTransfer[]>;
  createAssetTransfer(transfer: InsertAssetTransfer, userId: string): Promise<AssetTransfer>;
  approveAssetTransfer(id: number, userId: string): Promise<AssetTransfer | undefined>;
  confirmAssetTransfer(id: number, userId: string, receiverName: string, signature?: string): Promise<AssetTransfer | undefined>;
  cancelAssetTransfer(id: number, userId: string, reason?: string): Promise<AssetTransfer | undefined>;
  getAssetTransferEvents(transferId: number): Promise<AssetTransferEvent[]>;
  
  // System Audit Logs
  getAllSystemAuditLogs(limit?: number): Promise<SystemAuditLog[]>;
  getSystemAuditLogsByModule(module: string): Promise<SystemAuditLog[]>;
  getSystemAuditLogsByUser(userId: string): Promise<SystemAuditLog[]>;
  createSystemAuditLog(log: InsertSystemAuditLog): Promise<SystemAuditLog>;
  searchSystemAuditLogs(query: string): Promise<SystemAuditLog[]>;
  
  // Backups
  getAllBackups(): Promise<Backup[]>;
  getBackup(id: number): Promise<Backup | undefined>;
  createBackup(backup: InsertBackup): Promise<Backup>;
  updateBackup(id: number, backup: Partial<InsertBackup>): Promise<Backup | undefined>;
  deleteBackup(id: number): Promise<boolean>;
  
  // Global Search
  globalSearch(query: string): Promise<{
    inventory: InventoryItem[];
    projects: ConstructionProject[];
    contractors: Contractor[];
    transfers: AssetTransfer[];
    users: User[];
  }>;
  
  // Operations Module - Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  
  // Operations Module - Shifts
  getAllShifts(): Promise<Shift[]>;
  getShiftsByBranch(branchId: string): Promise<Shift[]>;
  getShiftsByDate(date: string): Promise<Shift[]>;
  getShift(id: number): Promise<Shift | undefined>;
  createShift(shift: InsertShift): Promise<Shift>;
  updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: number): Promise<boolean>;
  
  // Operations Module - Shift Employees
  getShiftEmployees(shiftId: number): Promise<ShiftEmployee[]>;
  createShiftEmployee(employee: InsertShiftEmployee): Promise<ShiftEmployee>;
  updateShiftEmployee(id: number, employee: Partial<InsertShiftEmployee>): Promise<ShiftEmployee | undefined>;
  deleteShiftEmployee(id: number): Promise<boolean>;
  
  // Operations Module - Production Orders
  getAllProductionOrders(): Promise<ProductionOrder[]>;
  getProductionOrdersByBranch(branchId: string): Promise<ProductionOrder[]>;
  getProductionOrdersByDate(date: string): Promise<ProductionOrder[]>;
  getProductionOrder(id: number): Promise<ProductionOrder | undefined>;
  createProductionOrder(order: InsertProductionOrder): Promise<ProductionOrder>;
  updateProductionOrder(id: number, order: Partial<InsertProductionOrder>): Promise<ProductionOrder | undefined>;
  deleteProductionOrder(id: number): Promise<boolean>;
  
  // Operations Module - Quality Checks
  getAllQualityChecks(): Promise<QualityCheck[]>;
  getQualityChecksByBranch(branchId: string): Promise<QualityCheck[]>;
  getQualityChecksByDate(date: string): Promise<QualityCheck[]>;
  getQualityCheck(id: number): Promise<QualityCheck | undefined>;
  createQualityCheck(check: InsertQualityCheck): Promise<QualityCheck>;
  
  // Operations Module - Daily Summary
  getDailyOperationsSummary(branchId: string, date: string): Promise<DailyOperationsSummary | undefined>;
  createOrUpdateDailyOperationsSummary(summary: InsertDailyOperationsSummary): Promise<DailyOperationsSummary>;
  
  // Targets & Incentives - Weight Profiles
  getAllTargetWeightProfiles(): Promise<TargetWeightProfile[]>;
  getTargetWeightProfile(id: number): Promise<TargetWeightProfile | undefined>;
  getDefaultTargetWeightProfile(): Promise<TargetWeightProfile | undefined>;
  createTargetWeightProfile(profile: InsertTargetWeightProfile): Promise<TargetWeightProfile>;
  updateTargetWeightProfile(id: number, profile: Partial<InsertTargetWeightProfile>): Promise<TargetWeightProfile | undefined>;
  deleteTargetWeightProfile(id: number): Promise<boolean>;
  
  // Targets & Incentives - Monthly Targets
  getAllBranchMonthlyTargets(): Promise<BranchMonthlyTarget[]>;
  getBranchMonthlyTargetsByBranch(branchId: string): Promise<BranchMonthlyTarget[]>;
  getBranchMonthlyTarget(id: number): Promise<BranchMonthlyTarget | undefined>;
  getBranchMonthlyTargetByMonth(branchId: string, yearMonth: string): Promise<BranchMonthlyTarget | undefined>;
  createBranchMonthlyTarget(target: InsertBranchMonthlyTarget): Promise<BranchMonthlyTarget>;
  updateBranchMonthlyTarget(id: number, target: Partial<InsertBranchMonthlyTarget>): Promise<BranchMonthlyTarget | undefined>;
  deleteBranchMonthlyTarget(id: number): Promise<boolean>;
  
  // Targets & Incentives - Daily Allocations
  getTargetDailyAllocationsByMonth(monthlyTargetId: number): Promise<TargetDailyAllocation[]>;
  getTargetDailyAllocation(id: number): Promise<TargetDailyAllocation | undefined>;
  createTargetDailyAllocation(allocation: InsertTargetDailyAllocation): Promise<TargetDailyAllocation>;
  updateTargetDailyAllocation(id: number, allocation: Partial<InsertTargetDailyAllocation>): Promise<TargetDailyAllocation | undefined>;
  deleteTargetDailyAllocation(id: number): Promise<boolean>;
  bulkCreateTargetDailyAllocations(allocations: InsertTargetDailyAllocation[]): Promise<TargetDailyAllocation[]>;
  
  // Targets & Incentives - Shift Allocations
  getTargetShiftAllocationsByDaily(dailyAllocationId: number): Promise<TargetShiftAllocation[]>;
  createTargetShiftAllocation(allocation: InsertTargetShiftAllocation): Promise<TargetShiftAllocation>;
  deleteTargetShiftAllocationsByDaily(dailyAllocationId: number): Promise<boolean>;
  
  // Targets & Incentives - Incentive Tiers
  getAllIncentiveTiers(): Promise<IncentiveTier[]>;
  getActiveIncentiveTiers(): Promise<IncentiveTier[]>;
  getIncentiveTier(id: number): Promise<IncentiveTier | undefined>;
  createIncentiveTier(tier: InsertIncentiveTier): Promise<IncentiveTier>;
  updateIncentiveTier(id: number, tier: Partial<InsertIncentiveTier>): Promise<IncentiveTier | undefined>;
  deleteIncentiveTier(id: number): Promise<boolean>;
  
  // Targets & Incentives - Incentive Awards
  getAllIncentiveAwards(): Promise<IncentiveAward[]>;
  getIncentiveAwardsByBranch(branchId: string): Promise<IncentiveAward[]>;
  getIncentiveAwardsByCashier(cashierId: string): Promise<IncentiveAward[]>;
  getIncentiveAward(id: number): Promise<IncentiveAward | undefined>;
  createIncentiveAward(award: InsertIncentiveAward): Promise<IncentiveAward>;
  updateIncentiveAward(id: number, award: Partial<InsertIncentiveAward>): Promise<IncentiveAward | undefined>;
  approveIncentiveAward(id: number, approvedBy: string): Promise<IncentiveAward | undefined>;
  markIncentiveAwardAsPaid(id: number): Promise<IncentiveAward | undefined>;
  
  // Targets Performance Calculation
  calculateBranchPerformance(branchId: string, yearMonth: string): Promise<{
    targetAmount: number;
    achievedAmount: number;
    achievementPercent: number;
    dailyPerformance: { date: string; target: number; achieved: number; percent: number }[];
  }>;
  
  getLeaderboard(yearMonth: string): Promise<{
    branches: { branchId: string; branchName: string; target: number; achieved: number; percent: number; rank: number }[];
    cashiers: { cashierId: string; cashierName: string; branchId: string; target: number; achieved: number; percent: number; rank: number }[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const hashedPassword = userData.password 
      ? await bcrypt.hash(userData.password, 10) 
      : null;
    
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        password: hashedPassword,
      })
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const updateData: any = { ...userData, updatedAt: new Date() };
    
    if (userData.password) {
      updateData.password = await bcrypt.hash(userData.password, 10);
    }
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUserRole(id: string, role: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async verifyPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user || !user.password) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : null;
  }

  // Branches
  async getAllBranches(): Promise<Branch[]> {
    return await db.select().from(branches);
  }

  async getBranch(id: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, id));
    return branch || undefined;
  }

  async createBranch(insertBranch: InsertBranch): Promise<Branch> {
    const [branch] = await db.insert(branches).values(insertBranch).returning();
    return branch;
  }

  // Inventory Items
  async getAllInventoryItems(): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems);
  }

  async getInventoryItemsByBranch(branchId: string): Promise<InventoryItem[]> {
    return await db.select().from(inventoryItems).where(eq(inventoryItems.branchId, branchId));
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item || undefined;
  }

  async createInventoryItem(item: InsertInventoryItem, userId?: string): Promise<InventoryItem> {
    const [newItem] = await db.insert(inventoryItems).values(item).returning();
    
    await this.createAuditLog({
      itemId: newItem.id,
      action: 'create',
      fieldName: null,
      oldValue: null,
      newValue: JSON.stringify(item),
      changedBy: userId || 'system'
    });
    
    await this.createSystemAuditLog({
      module: 'inventory',
      entityId: newItem.id,
      entityName: newItem.name,
      action: 'create',
      details: JSON.stringify({ category: newItem.category, branchId: newItem.branchId }),
      userId: userId || null,
      userName: null,
    });
    
    return newItem;
  }

  async updateInventoryItem(id: string, item: Partial<InsertInventoryItem>, userId?: string): Promise<InventoryItem | undefined> {
    const existingItem = await this.getInventoryItem(id);
    
    const [updatedItem] = await db
      .update(inventoryItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id))
      .returning();
    
    if (updatedItem && existingItem) {
      for (const [key, newValue] of Object.entries(item)) {
        const oldValue = existingItem[key as keyof InventoryItem];
        if (String(oldValue) !== String(newValue)) {
          await this.createAuditLog({
            itemId: id,
            action: 'update',
            fieldName: key,
            oldValue: oldValue != null ? String(oldValue) : null,
            newValue: newValue != null ? String(newValue) : null,
            changedBy: userId || 'system'
          });
        }
      }
    }
    
    return updatedItem || undefined;
  }

  async deleteInventoryItem(id: string, userId?: string): Promise<boolean> {
    const existingItem = await this.getInventoryItem(id);
    
    if (existingItem) {
      await this.createAuditLog({
        itemId: id,
        action: 'delete',
        fieldName: null,
        oldValue: JSON.stringify(existingItem),
        newValue: null,
        changedBy: userId || 'system'
      });
      
      await this.createSystemAuditLog({
        module: 'inventory',
        entityId: id,
        entityName: existingItem.name,
        action: 'delete',
        details: JSON.stringify({ category: existingItem.category }),
        userId: userId || null,
        userName: null,
      });
    }
    
    const result = await db.delete(inventoryItems).where(eq(inventoryItems.id, id)).returning();
    return result.length > 0;
  }

  async getItemsNeedingInspection(): Promise<InventoryItem[]> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    return await db
      .select()
      .from(inventoryItems)
      .where(lte(inventoryItems.nextInspectionDate, today));
  }

  // Audit Logs
  async getAuditLogsForItem(itemId: string): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.itemId, itemId))
      .orderBy(desc(auditLogs.createdAt));
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  // Saved Filters
  async getAllSavedFilters(): Promise<SavedFilter[]> {
    return await db.select().from(savedFilters).orderBy(desc(savedFilters.createdAt));
  }

  async getSavedFilter(id: number): Promise<SavedFilter | undefined> {
    const [filter] = await db.select().from(savedFilters).where(eq(savedFilters.id, id));
    return filter || undefined;
  }

  async createSavedFilter(filter: InsertSavedFilter): Promise<SavedFilter> {
    const [newFilter] = await db.insert(savedFilters).values(filter).returning();
    return newFilter;
  }

  async deleteSavedFilter(id: number): Promise<boolean> {
    const result = await db.delete(savedFilters).where(eq(savedFilters.id, id)).returning();
    return result.length > 0;
  }

  // Construction Categories
  async getAllConstructionCategories(): Promise<ConstructionCategory[]> {
    return await db.select().from(constructionCategories);
  }

  // Contractors
  async getAllContractors(): Promise<Contractor[]> {
    return await db.select().from(contractors).orderBy(desc(contractors.createdAt));
  }

  async getContractor(id: number): Promise<Contractor | undefined> {
    const [contractor] = await db.select().from(contractors).where(eq(contractors.id, id));
    return contractor || undefined;
  }

  async createContractor(contractor: InsertContractor): Promise<Contractor> {
    const [newContractor] = await db.insert(contractors).values(contractor).returning();
    return newContractor;
  }

  async updateContractor(id: number, contractor: Partial<InsertContractor>): Promise<Contractor | undefined> {
    const [updated] = await db
      .update(contractors)
      .set({ ...contractor, updatedAt: new Date() })
      .where(eq(contractors.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteContractor(id: number): Promise<boolean> {
    const result = await db.delete(contractors).where(eq(contractors.id, id)).returning();
    return result.length > 0;
  }

  // Construction Projects
  async getAllConstructionProjects(): Promise<ConstructionProject[]> {
    return await db.select().from(constructionProjects).orderBy(desc(constructionProjects.createdAt));
  }

  async getConstructionProjectsByBranch(branchId: string): Promise<ConstructionProject[]> {
    return await db
      .select()
      .from(constructionProjects)
      .where(eq(constructionProjects.branchId, branchId))
      .orderBy(desc(constructionProjects.createdAt));
  }

  async getConstructionProject(id: number): Promise<ConstructionProject | undefined> {
    const [project] = await db.select().from(constructionProjects).where(eq(constructionProjects.id, id));
    return project || undefined;
  }

  async createConstructionProject(project: InsertConstructionProject): Promise<ConstructionProject> {
    const [newProject] = await db.insert(constructionProjects).values(project).returning();
    return newProject;
  }

  async updateConstructionProject(id: number, project: Partial<InsertConstructionProject>): Promise<ConstructionProject | undefined> {
    const [updated] = await db
      .update(constructionProjects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(constructionProjects.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteConstructionProject(id: number): Promise<boolean> {
    const result = await db.delete(constructionProjects).where(eq(constructionProjects.id, id)).returning();
    return result.length > 0;
  }

  // Project Work Items
  async getAllWorkItems(): Promise<ProjectWorkItem[]> {
    return await db
      .select()
      .from(projectWorkItems)
      .orderBy(desc(projectWorkItems.createdAt));
  }

  async getWorkItemsByProject(projectId: number): Promise<ProjectWorkItem[]> {
    return await db
      .select()
      .from(projectWorkItems)
      .where(eq(projectWorkItems.projectId, projectId))
      .orderBy(desc(projectWorkItems.createdAt));
  }

  async getWorkItem(id: number): Promise<ProjectWorkItem | undefined> {
    const [item] = await db.select().from(projectWorkItems).where(eq(projectWorkItems.id, id));
    return item || undefined;
  }

  async createWorkItem(item: InsertProjectWorkItem): Promise<ProjectWorkItem> {
    const [newItem] = await db.insert(projectWorkItems).values(item).returning();
    return newItem;
  }

  async updateWorkItem(id: number, item: Partial<InsertProjectWorkItem>): Promise<ProjectWorkItem | undefined> {
    const [updated] = await db
      .update(projectWorkItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(projectWorkItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteWorkItem(id: number): Promise<boolean> {
    const result = await db.delete(projectWorkItems).where(eq(projectWorkItems.id, id)).returning();
    return result.length > 0;
  }

  // Project Budget Allocations
  async getBudgetAllocationsByProject(projectId: number): Promise<ProjectBudgetAllocation[]> {
    return await db
      .select()
      .from(projectBudgetAllocations)
      .where(eq(projectBudgetAllocations.projectId, projectId));
  }

  async getBudgetAllocation(id: number): Promise<ProjectBudgetAllocation | undefined> {
    const [allocation] = await db.select().from(projectBudgetAllocations).where(eq(projectBudgetAllocations.id, id));
    return allocation || undefined;
  }

  async createBudgetAllocation(allocation: InsertProjectBudgetAllocation): Promise<ProjectBudgetAllocation> {
    const [newAllocation] = await db.insert(projectBudgetAllocations).values(allocation).returning();
    return newAllocation;
  }

  async updateBudgetAllocation(id: number, allocation: Partial<InsertProjectBudgetAllocation>): Promise<ProjectBudgetAllocation | undefined> {
    const [updated] = await db
      .update(projectBudgetAllocations)
      .set({ ...allocation, updatedAt: new Date() })
      .where(eq(projectBudgetAllocations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBudgetAllocation(id: number): Promise<boolean> {
    const result = await db.delete(projectBudgetAllocations).where(eq(projectBudgetAllocations.id, id)).returning();
    return result.length > 0;
  }

  async upsertBudgetAllocation(allocation: InsertProjectBudgetAllocation): Promise<ProjectBudgetAllocation> {
    const existing = await db
      .select()
      .from(projectBudgetAllocations)
      .where(
        and(
          eq(projectBudgetAllocations.projectId, allocation.projectId),
          allocation.categoryId 
            ? eq(projectBudgetAllocations.categoryId, allocation.categoryId)
            : eq(projectBudgetAllocations.categoryId, 0)
        )
      );
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(projectBudgetAllocations)
        .set({ ...allocation, updatedAt: new Date() })
        .where(eq(projectBudgetAllocations.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [newAllocation] = await db.insert(projectBudgetAllocations).values(allocation).returning();
      return newAllocation;
    }
  }

  async getHistoricalCategoryAverages(): Promise<{ categoryId: number; categoryName: string; avgCost: number; projectCount: number; totalCost: number }[]> {
    const categories = await db.select().from(constructionCategories);
    const workItems = await db.select().from(projectWorkItems);
    
    const categoryStats: Record<number, { totalCost: number; projectIds: Set<number>; itemCount: number }> = {};
    
    for (const item of workItems) {
      if (!item.categoryId) continue;
      
      const cost = item.actualCost !== null && item.actualCost > 0 
        ? item.actualCost 
        : (item.costEstimate !== null && item.costEstimate > 0 ? item.costEstimate : 0);
      
      if (cost <= 0) continue;
      
      if (!categoryStats[item.categoryId]) {
        categoryStats[item.categoryId] = { totalCost: 0, projectIds: new Set(), itemCount: 0 };
      }
      
      categoryStats[item.categoryId].totalCost += cost;
      categoryStats[item.categoryId].projectIds.add(item.projectId);
      categoryStats[item.categoryId].itemCount++;
    }
    
    const result: { categoryId: number; categoryName: string; avgCost: number; projectCount: number; totalCost: number }[] = [];
    
    for (const category of categories) {
      const stats = categoryStats[category.id];
      if (stats && stats.itemCount > 0) {
        result.push({
          categoryId: category.id,
          categoryName: category.name,
          avgCost: stats.totalCost / stats.projectIds.size,
          projectCount: stats.projectIds.size,
          totalCost: stats.totalCost
        });
      } else {
        result.push({
          categoryId: category.id,
          categoryName: category.name,
          avgCost: 0,
          projectCount: 0,
          totalCost: 0
        });
      }
    }
    
    return result;
  }

  // Construction Contracts
  async getAllContracts(): Promise<ConstructionContract[]> {
    return await db.select().from(constructionContracts).orderBy(desc(constructionContracts.createdAt));
  }

  async getContractsByProject(projectId: number): Promise<ConstructionContract[]> {
    return await db
      .select()
      .from(constructionContracts)
      .where(eq(constructionContracts.projectId, projectId))
      .orderBy(desc(constructionContracts.createdAt));
  }

  async getContract(id: number): Promise<ConstructionContract | undefined> {
    const [contract] = await db.select().from(constructionContracts).where(eq(constructionContracts.id, id));
    return contract || undefined;
  }

  async createContract(contract: InsertConstructionContract): Promise<ConstructionContract> {
    const [newContract] = await db.insert(constructionContracts).values(contract).returning();
    return newContract;
  }

  async updateContract(id: number, contract: Partial<InsertConstructionContract>): Promise<ConstructionContract | undefined> {
    const [updated] = await db
      .update(constructionContracts)
      .set({ ...contract, updatedAt: new Date() })
      .where(eq(constructionContracts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteContract(id: number): Promise<boolean> {
    const result = await db.delete(constructionContracts).where(eq(constructionContracts.id, id)).returning();
    return result.length > 0;
  }

  // Contract Items
  async getContractItems(contractId: number): Promise<ContractItem[]> {
    return await db
      .select()
      .from(contractItems)
      .where(eq(contractItems.contractId, contractId));
  }

  async getContractItem(id: number): Promise<ContractItem | undefined> {
    const [item] = await db.select().from(contractItems).where(eq(contractItems.id, id));
    return item || undefined;
  }

  async createContractItem(item: InsertContractItem): Promise<ContractItem> {
    const [newItem] = await db.insert(contractItems).values(item).returning();
    return newItem;
  }

  async updateContractItem(id: number, item: Partial<InsertContractItem>): Promise<ContractItem | undefined> {
    const [updated] = await db
      .update(contractItems)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(contractItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteContractItem(id: number): Promise<boolean> {
    const result = await db.delete(contractItems).where(eq(contractItems.id, id)).returning();
    return result.length > 0;
  }

  // Payment Requests
  async getAllPaymentRequests(): Promise<PaymentRequest[]> {
    return await db.select().from(paymentRequests).orderBy(desc(paymentRequests.createdAt));
  }

  async getPaymentRequestsByProject(projectId: number): Promise<PaymentRequest[]> {
    return await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.projectId, projectId))
      .orderBy(desc(paymentRequests.createdAt));
  }

  async getPaymentRequestsByStatus(status: string): Promise<PaymentRequest[]> {
    return await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.status, status))
      .orderBy(desc(paymentRequests.createdAt));
  }

  async getPaymentRequest(id: number): Promise<PaymentRequest | undefined> {
    const [request] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, id));
    return request || undefined;
  }

  async createPaymentRequest(request: InsertPaymentRequest): Promise<PaymentRequest> {
    const [newRequest] = await db.insert(paymentRequests).values(request).returning();
    return newRequest;
  }

  async updatePaymentRequest(id: number, request: Partial<InsertPaymentRequest>): Promise<PaymentRequest | undefined> {
    const [updated] = await db
      .update(paymentRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(paymentRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePaymentRequest(id: number): Promise<boolean> {
    const result = await db.delete(paymentRequests).where(eq(paymentRequests.id, id)).returning();
    return result.length > 0;
  }

  async approvePaymentRequest(id: number, approvedBy: string): Promise<PaymentRequest | undefined> {
    const [updated] = await db
      .update(paymentRequests)
      .set({ 
        status: 'approved', 
        approvedBy, 
        approvedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(paymentRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async rejectPaymentRequest(id: number, reason: string): Promise<PaymentRequest | undefined> {
    const [updated] = await db
      .update(paymentRequests)
      .set({ 
        status: 'rejected', 
        rejectionReason: reason,
        updatedAt: new Date() 
      })
      .where(eq(paymentRequests.id, id))
      .returning();
    return updated || undefined;
  }

  async markPaymentRequestAsPaid(id: number): Promise<PaymentRequest | undefined> {
    const [updated] = await db
      .update(paymentRequests)
      .set({ 
        status: 'paid', 
        paidAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(paymentRequests.id, id))
      .returning();
    return updated || undefined;
  }

  // Contract Payments
  async getContractPayments(contractId: number): Promise<ContractPayment[]> {
    return await db
      .select()
      .from(contractPayments)
      .where(eq(contractPayments.contractId, contractId))
      .orderBy(desc(contractPayments.createdAt));
  }

  async createContractPayment(payment: InsertContractPayment): Promise<ContractPayment> {
    const [newPayment] = await db.insert(contractPayments).values(payment).returning();
    
    // Update contract paid amount
    const payments = await this.getContractPayments(payment.contractId);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    await this.updateContract(payment.contractId, { paidAmount: totalPaid });
    
    return newPayment;
  }

  // User Permissions
  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    return await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));
  }

  async setUserPermission(permission: InsertUserPermission): Promise<UserPermission> {
    // Check if permission for this user+module exists
    const [existing] = await db
      .select()
      .from(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, permission.userId),
          eq(userPermissions.module, permission.module)
        )
      );

    if (existing) {
      // Update existing permission
      const [updated] = await db
        .update(userPermissions)
        .set({ actions: permission.actions, updatedAt: new Date() })
        .where(eq(userPermissions.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new permission
      const [created] = await db
        .insert(userPermissions)
        .values(permission)
        .returning();
      return created;
    }
  }

  async deleteUserPermissions(userId: string): Promise<boolean> {
    const result = await db
      .delete(userPermissions)
      .where(eq(userPermissions.userId, userId))
      .returning();
    return result.length >= 0;
  }

  async hasPermission(userId: string, module: string, action: string): Promise<boolean> {
    // First check if user is admin (admins have all permissions)
    const user = await this.getUser(userId);
    if (user?.role === "admin") return true;

    // Check specific permission
    const [permission] = await db
      .select()
      .from(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, userId),
          eq(userPermissions.module, module)
        )
      );

    if (!permission) return false;
    return permission.actions.includes(action);
  }

  // Permission Audit Logs
  async createPermissionAuditLog(log: InsertPermissionAuditLog): Promise<PermissionAuditLog> {
    const [created] = await db
      .insert(permissionAuditLogs)
      .values(log)
      .returning();
    return created;
  }

  async getPermissionAuditLogs(targetUserId?: string): Promise<PermissionAuditLog[]> {
    if (targetUserId) {
      return db
        .select()
        .from(permissionAuditLogs)
        .where(eq(permissionAuditLogs.targetUserId, targetUserId))
        .orderBy(desc(permissionAuditLogs.createdAt));
    }
    return db
      .select()
      .from(permissionAuditLogs)
      .orderBy(desc(permissionAuditLogs.createdAt));
  }

  async updateUserPermissionsWithAudit(
    userId: string,
    permissions: { module: string; actions: string[] }[],
    changedByUserId: string,
    templateApplied: string | null
  ): Promise<UserPermission[]> {
    return await db.transaction(async (tx) => {
      // Get old permissions for audit logging
      const oldPermissions = await tx
        .select()
        .from(userPermissions)
        .where(eq(userPermissions.userId, userId));
      const oldPermissionsMap = new Map(oldPermissions.map(p => [p.module, p.actions]));

      // Delete existing permissions
      await tx
        .delete(userPermissions)
        .where(eq(userPermissions.userId, userId));

      // Add new permissions
      const savedPermissions: UserPermission[] = [];
      for (const perm of permissions) {
        if (!perm.module || !Array.isArray(perm.actions) || perm.actions.length === 0) {
          continue;
        }

        const [created] = await tx
          .insert(userPermissions)
          .values({
            userId,
            module: perm.module,
            actions: perm.actions,
          })
          .returning();
        savedPermissions.push(created);

        // Log permission change for this module
        const oldActions = oldPermissionsMap.get(perm.module) || [];
        if (JSON.stringify([...oldActions].sort()) !== JSON.stringify([...perm.actions].sort())) {
          await tx.insert(permissionAuditLogs).values({
            targetUserId: userId,
            changedByUserId,
            action: templateApplied ? 'apply_template' : (oldActions.length === 0 ? 'grant' : 'modify'),
            module: perm.module,
            oldActions: oldActions,
            newActions: perm.actions,
            templateApplied: templateApplied || null,
          });
        }
      }

      // Log revoked permissions (modules that were removed entirely)
      for (const oldPerm of oldPermissions) {
        const stillExists = savedPermissions.some(p => p.module === oldPerm.module);
        if (!stillExists) {
          await tx.insert(permissionAuditLogs).values({
            targetUserId: userId,
            changedByUserId,
            action: 'revoke',
            module: oldPerm.module,
            oldActions: oldPerm.actions,
            newActions: [],
            templateApplied: templateApplied || null,
          });
        }
      }

      return savedPermissions;
    });
  }

  async applyJobRolePermissions(
    userId: string,
    jobTitle: string,
    changedByUserId: string
  ): Promise<UserPermission[]> {
    // Validate actor ID for audit trail
    if (!changedByUserId) {
      throw new Error("Actor ID is required for permission changes");
    }
    
    // Get job role permission template
    const template = JOB_ROLE_PERMISSION_TEMPLATES[jobTitle as keyof typeof JOB_ROLE_PERMISSION_TEMPLATES];
    
    if (!template) {
      console.warn(`No permission template found for job title: ${jobTitle}, applying minimal access`);
      // If no template exists, apply minimal dashboard access
      return this.updateUserPermissionsWithAudit(
        userId,
        [{ module: "dashboard", actions: ["view"] }],
        changedByUserId,
        `job_role:${jobTitle}:fallback`
      );
    }

    // Convert template to the format expected by updateUserPermissionsWithAudit
    const permissions = template.map(perm => ({
      module: perm.module,
      actions: [...perm.actions] as string[],
    }));

    return this.updateUserPermissionsWithAudit(
      userId,
      permissions,
      changedByUserId,
      `job_role:${jobTitle}`
    );
  }

  // Asset Transfers
  async getAllAssetTransfers(): Promise<AssetTransfer[]> {
    return db.select().from(assetTransfers).orderBy(desc(assetTransfers.createdAt));
  }

  async getAssetTransfer(id: number): Promise<AssetTransfer | undefined> {
    const [transfer] = await db.select().from(assetTransfers).where(eq(assetTransfers.id, id));
    return transfer || undefined;
  }

  async getAssetTransfersByItem(itemId: string): Promise<AssetTransfer[]> {
    return db.select().from(assetTransfers)
      .where(eq(assetTransfers.itemId, itemId))
      .orderBy(desc(assetTransfers.createdAt));
  }

  async createAssetTransfer(transfer: InsertAssetTransfer, userId: string): Promise<AssetTransfer> {
    const transferNumber = `TRF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    const [created] = await db.insert(assetTransfers).values({
      ...transfer,
      transferNumber,
      requestedBy: userId,
      status: 'pending',
    }).returning();

    await db.insert(assetTransferEvents).values({
      transferId: created.id,
      eventType: 'created',
      actorId: userId,
      note: 'تم إنشاء طلب التحويل',
    });

    await this.createSystemAuditLog({
      module: 'transfers',
      entityId: String(created.id),
      entityName: created.transferNumber,
      action: 'create',
      details: JSON.stringify({ itemId: transfer.itemId, from: transfer.fromBranchId, to: transfer.toBranchId }),
      userId: userId,
      userName: null,
    });

    return created;
  }

  async approveAssetTransfer(id: number, userId: string): Promise<AssetTransfer | undefined> {
    const [updated] = await db.update(assetTransfers)
      .set({ 
        status: 'approved', 
        approvedBy: userId, 
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(assetTransfers.id, id))
      .returning();

    if (updated) {
      await db.insert(assetTransferEvents).values({
        transferId: id,
        eventType: 'approved',
        actorId: userId,
        note: 'تمت الموافقة على التحويل',
      });

      await this.createSystemAuditLog({
        module: 'transfers',
        entityId: String(id),
        entityName: updated.transferNumber,
        action: 'approve',
        details: 'تمت الموافقة على التحويل',
        userId: userId,
        userName: null,
      });
    }

    return updated || undefined;
  }

  async confirmAssetTransfer(id: number, userId: string, receiverName: string, signature?: string): Promise<AssetTransfer | undefined> {
    return await db.transaction(async (tx) => {
      const [transfer] = await tx.select().from(assetTransfers).where(eq(assetTransfers.id, id));
      if (!transfer) return undefined;

      // Update the transfer status
      const [updated] = await tx.update(assetTransfers)
        .set({ 
          status: 'completed', 
          receivedBy: userId,
          receivedAt: new Date(),
          receiverName,
          receiverSignature: signature || null,
          updatedAt: new Date()
        })
        .where(eq(assetTransfers.id, id))
        .returning();

      // Update the item's branch
      await tx.update(inventoryItems)
        .set({ 
          branchId: transfer.toBranchId,
          updatedAt: new Date()
        })
        .where(eq(inventoryItems.id, transfer.itemId));

      // Add audit log for the branch change
      await tx.insert(auditLogs).values({
        itemId: transfer.itemId,
        action: 'transfer',
        fieldName: 'branchId',
        oldValue: transfer.fromBranchId,
        newValue: transfer.toBranchId,
        changedBy: userId,
      });

      // Add transfer event
      await tx.insert(assetTransferEvents).values({
        transferId: id,
        eventType: 'received',
        actorId: userId,
        note: `تم تأكيد استلام الأصل بواسطة ${receiverName}`,
      });

      return updated;
    });
  }

  async cancelAssetTransfer(id: number, userId: string, reason?: string): Promise<AssetTransfer | undefined> {
    const [updated] = await db.update(assetTransfers)
      .set({ 
        status: 'cancelled',
        notes: reason || undefined,
        updatedAt: new Date()
      })
      .where(eq(assetTransfers.id, id))
      .returning();

    if (updated) {
      await db.insert(assetTransferEvents).values({
        transferId: id,
        eventType: 'cancelled',
        actorId: userId,
        note: reason || 'تم إلغاء التحويل',
      });
    }

    return updated || undefined;
  }

  async getAssetTransferEvents(transferId: number): Promise<AssetTransferEvent[]> {
    return db.select().from(assetTransferEvents)
      .where(eq(assetTransferEvents.transferId, transferId))
      .orderBy(desc(assetTransferEvents.createdAt));
  }

  // System Audit Logs
  async getAllSystemAuditLogs(limit: number = 500): Promise<SystemAuditLog[]> {
    return db.select().from(systemAuditLogs)
      .orderBy(desc(systemAuditLogs.createdAt))
      .limit(limit);
  }

  async getSystemAuditLogsByModule(module: string): Promise<SystemAuditLog[]> {
    return db.select().from(systemAuditLogs)
      .where(eq(systemAuditLogs.module, module))
      .orderBy(desc(systemAuditLogs.createdAt));
  }

  async getSystemAuditLogsByUser(userId: string): Promise<SystemAuditLog[]> {
    return db.select().from(systemAuditLogs)
      .where(eq(systemAuditLogs.userId, userId))
      .orderBy(desc(systemAuditLogs.createdAt));
  }

  async createSystemAuditLog(log: InsertSystemAuditLog): Promise<SystemAuditLog> {
    const [created] = await db.insert(systemAuditLogs).values(log).returning();
    return created;
  }

  async searchSystemAuditLogs(query: string): Promise<SystemAuditLog[]> {
    const allLogs = await db.select().from(systemAuditLogs)
      .orderBy(desc(systemAuditLogs.createdAt))
      .limit(1000);
    
    const lowerQuery = query.toLowerCase();
    return allLogs.filter(log => 
      log.entityName?.toLowerCase().includes(lowerQuery) ||
      log.details?.toLowerCase().includes(lowerQuery) ||
      log.userName?.toLowerCase().includes(lowerQuery) ||
      log.action.toLowerCase().includes(lowerQuery) ||
      log.module.toLowerCase().includes(lowerQuery)
    );
  }

  // Backups
  async getAllBackups(): Promise<Backup[]> {
    return db.select().from(backups).orderBy(desc(backups.createdAt));
  }

  async getBackup(id: number): Promise<Backup | undefined> {
    const [backup] = await db.select().from(backups).where(eq(backups.id, id));
    return backup || undefined;
  }

  async createBackup(backup: InsertBackup): Promise<Backup> {
    const [created] = await db.insert(backups).values(backup).returning();
    return created;
  }

  async updateBackup(id: number, backupData: Partial<InsertBackup>): Promise<Backup | undefined> {
    const [updated] = await db.update(backups)
      .set(backupData)
      .where(eq(backups.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBackup(id: number): Promise<boolean> {
    const result = await db.delete(backups).where(eq(backups.id, id)).returning();
    return result.length > 0;
  }

  // Global Search
  async globalSearch(query: string): Promise<{
    inventory: InventoryItem[];
    projects: ConstructionProject[];
    contractors: Contractor[];
    transfers: AssetTransfer[];
    users: User[];
  }> {
    const lowerQuery = query.toLowerCase();
    
    // Search inventory
    const allInventory = await db.select().from(inventoryItems);
    const inventory = allInventory.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.id.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery) ||
      item.serialNumber?.toLowerCase().includes(lowerQuery) ||
      item.notes?.toLowerCase().includes(lowerQuery)
    ).slice(0, 20);

    // Search projects
    const allProjects = await db.select().from(constructionProjects);
    const projects = allProjects.filter(project =>
      project.title.toLowerCase().includes(lowerQuery) ||
      project.description?.toLowerCase().includes(lowerQuery)
    ).slice(0, 20);

    // Search contractors
    const allContractors = await db.select().from(contractors);
    const contractorResults = allContractors.filter(contractor =>
      contractor.name.toLowerCase().includes(lowerQuery) ||
      contractor.email?.toLowerCase().includes(lowerQuery) ||
      contractor.phone?.toLowerCase().includes(lowerQuery) ||
      contractor.specialization?.toLowerCase().includes(lowerQuery)
    ).slice(0, 20);

    // Search transfers
    const allTransfers = await db.select().from(assetTransfers);
    const transfers = allTransfers.filter(transfer =>
      transfer.transferNumber.toLowerCase().includes(lowerQuery) ||
      transfer.notes?.toLowerCase().includes(lowerQuery)
    ).slice(0, 20);

    // Search users
    const allUsers = await db.select().from(users);
    const userResults = allUsers.filter(user =>
      user.username?.toLowerCase().includes(lowerQuery) ||
      user.firstName?.toLowerCase().includes(lowerQuery) ||
      user.lastName?.toLowerCase().includes(lowerQuery) ||
      user.email?.toLowerCase().includes(lowerQuery)
    ).slice(0, 20);

    return {
      inventory,
      projects,
      contractors: contractorResults,
      transfers,
      users: userResults,
    };
  }

  // External Integrations
  async getAllExternalIntegrations(): Promise<ExternalIntegration[]> {
    return db.select().from(externalIntegrations).orderBy(desc(externalIntegrations.createdAt));
  }

  async getExternalIntegration(id: number): Promise<ExternalIntegration | undefined> {
    const [integration] = await db.select().from(externalIntegrations).where(eq(externalIntegrations.id, id));
    return integration || undefined;
  }

  async createExternalIntegration(integration: InsertExternalIntegration): Promise<ExternalIntegration> {
    const [created] = await db.insert(externalIntegrations).values(integration).returning();
    return created;
  }

  async updateExternalIntegration(id: number, data: Partial<InsertExternalIntegration>): Promise<ExternalIntegration | undefined> {
    const [updated] = await db.update(externalIntegrations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(externalIntegrations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteExternalIntegration(id: number): Promise<boolean> {
    const result = await db.delete(externalIntegrations).where(eq(externalIntegrations.id, id)).returning();
    return result.length > 0;
  }

  // Notification Templates
  async getAllNotificationTemplates(): Promise<NotificationTemplate[]> {
    return db.select().from(notificationTemplates).orderBy(desc(notificationTemplates.createdAt));
  }

  async createNotificationTemplate(template: InsertNotificationTemplate): Promise<NotificationTemplate> {
    const [created] = await db.insert(notificationTemplates).values(template).returning();
    return created;
  }

  async updateNotificationTemplate(id: number, data: Partial<InsertNotificationTemplate>): Promise<NotificationTemplate | undefined> {
    const [updated] = await db.update(notificationTemplates)
      .set(data)
      .where(eq(notificationTemplates.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteNotificationTemplate(id: number): Promise<boolean> {
    const result = await db.delete(notificationTemplates).where(eq(notificationTemplates.id, id)).returning();
    return result.length > 0;
  }

  // Notification Queue
  async getAllNotifications(): Promise<NotificationQueueItem[]> {
    return db.select().from(notificationQueue).orderBy(desc(notificationQueue.createdAt));
  }

  async getPendingNotifications(): Promise<NotificationQueueItem[]> {
    return db.select().from(notificationQueue)
      .where(eq(notificationQueue.status, 'pending'))
      .orderBy(notificationQueue.createdAt);
  }

  async createNotification(notification: InsertNotificationQueueItem): Promise<NotificationQueueItem> {
    const [created] = await db.insert(notificationQueue).values(notification).returning();
    return created;
  }

  async updateNotificationStatus(id: number, status: string, errorMessage?: string): Promise<NotificationQueueItem | undefined> {
    const [updated] = await db.update(notificationQueue)
      .set({ 
        status, 
        errorMessage: errorMessage || null,
        sentAt: status === 'sent' ? new Date() : null
      })
      .where(eq(notificationQueue.id, id))
      .returning();
    return updated || undefined;
  }

  // Data Import Jobs
  async getAllDataImportJobs(): Promise<DataImportJob[]> {
    return db.select().from(dataImportJobs).orderBy(desc(dataImportJobs.createdAt));
  }

  async getDataImportJob(id: number): Promise<DataImportJob | undefined> {
    const [job] = await db.select().from(dataImportJobs).where(eq(dataImportJobs.id, id));
    return job || undefined;
  }

  async createDataImportJob(job: InsertDataImportJob): Promise<DataImportJob> {
    const [created] = await db.insert(dataImportJobs).values({
      ...job,
      startedAt: new Date()
    }).returning();
    return created;
  }

  async updateDataImportJob(id: number, data: Partial<DataImportJob>): Promise<DataImportJob | undefined> {
    const [updated] = await db.update(dataImportJobs)
      .set(data)
      .where(eq(dataImportJobs.id, id))
      .returning();
    return updated || undefined;
  }

  // Accounting Exports
  async getAllAccountingExports(): Promise<AccountingExport[]> {
    return db.select().from(accountingExports).orderBy(desc(accountingExports.createdAt));
  }

  async getAccountingExport(id: number): Promise<AccountingExport | undefined> {
    const [exp] = await db.select().from(accountingExports).where(eq(accountingExports.id, id));
    return exp || undefined;
  }

  async createAccountingExport(exportData: InsertAccountingExport): Promise<AccountingExport> {
    const [created] = await db.insert(accountingExports).values(exportData).returning();
    return created;
  }

  async updateAccountingExport(id: number, data: Partial<AccountingExport>): Promise<AccountingExport | undefined> {
    const [updated] = await db.update(accountingExports)
      .set(data)
      .where(eq(accountingExports.id, id))
      .returning();
    return updated || undefined;
  }

  // Generate accounting export data
  async generateInventoryValuation(branchId?: string): Promise<any> {
    let items: InventoryItem[];
    if (branchId) {
      items = await this.getInventoryItemsByBranch(branchId);
    } else {
      items = await this.getAllInventoryItems();
    }
    
    const VAT_RATE = 0.15;
    const totalValue = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    const vatAmount = totalValue * VAT_RATE;
    
    return {
      generatedAt: new Date().toISOString(),
      branchId: branchId || 'all',
      itemCount: items.length,
      totalValue,
      vatAmount,
      totalWithVat: totalValue + vatAmount,
      items: items.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.price,
        totalValue: (item.price || 0) * item.quantity,
        status: item.status
      }))
    };
  }

  async generateAssetMovementsReport(dateFrom?: string, dateTo?: string): Promise<any> {
    const transfers = await this.getAllAssetTransfers();
    
    let filtered = transfers;
    if (dateFrom) {
      filtered = filtered.filter(t => t.createdAt >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter(t => t.createdAt <= new Date(dateTo));
    }
    
    return {
      generatedAt: new Date().toISOString(),
      dateFrom,
      dateTo,
      totalTransfers: filtered.length,
      completed: filtered.filter(t => t.status === 'completed').length,
      pending: filtered.filter(t => t.status === 'pending').length,
      transfers: filtered.map(t => ({
        transferNumber: t.transferNumber,
        itemId: t.itemId,
        fromBranch: t.fromBranchId,
        toBranch: t.toBranchId,
        status: t.status,
        requestedAt: t.requestedAt,
        completedAt: t.receivedAt
      }))
    };
  }

  async generateProjectCostsReport(projectId?: number): Promise<any> {
    let projects: ConstructionProject[];
    if (projectId) {
      const project = await this.getConstructionProject(projectId);
      projects = project ? [project] : [];
    } else {
      projects = await this.getAllConstructionProjects();
    }
    
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (p.actualCost || 0), 0);
    
    return {
      generatedAt: new Date().toISOString(),
      projectId: projectId || 'all',
      projectCount: projects.length,
      totalBudget,
      totalSpent,
      remainingBudget: totalBudget - totalSpent,
      utilizationPercentage: totalBudget > 0 ? (totalSpent / totalBudget * 100).toFixed(2) : 0,
      projects: projects.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        budget: p.budget,
        spent: p.actualCost,
        progress: p.progressPercent
      }))
    };
  }

  // ============================================
  // Operations Module Implementation
  // ============================================

  // Products
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  // Shifts
  async getAllShifts(): Promise<Shift[]> {
    return await db.select().from(shifts).orderBy(desc(shifts.date), desc(shifts.createdAt));
  }

  async getShiftsByBranch(branchId: string): Promise<Shift[]> {
    return await db.select().from(shifts).where(eq(shifts.branchId, branchId)).orderBy(desc(shifts.date));
  }

  async getShiftsByDate(date: string): Promise<Shift[]> {
    return await db.select().from(shifts).where(eq(shifts.date, date)).orderBy(desc(shifts.createdAt));
  }

  async getShift(id: number): Promise<Shift | undefined> {
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, id));
    return shift || undefined;
  }

  async createShift(shift: InsertShift): Promise<Shift> {
    const [created] = await db.insert(shifts).values(shift).returning();
    return created;
  }

  async updateShift(id: number, shift: Partial<InsertShift>): Promise<Shift | undefined> {
    const [updated] = await db
      .update(shifts)
      .set({ ...shift, updatedAt: new Date() })
      .where(eq(shifts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteShift(id: number): Promise<boolean> {
    const result = await db.delete(shifts).where(eq(shifts.id, id)).returning();
    return result.length > 0;
  }

  // Shift Employees
  async getShiftEmployees(shiftId: number): Promise<ShiftEmployee[]> {
    return await db.select().from(shiftEmployees).where(eq(shiftEmployees.shiftId, shiftId));
  }

  async createShiftEmployee(employee: InsertShiftEmployee): Promise<ShiftEmployee> {
    const [created] = await db.insert(shiftEmployees).values(employee).returning();
    return created;
  }

  async updateShiftEmployee(id: number, employee: Partial<InsertShiftEmployee>): Promise<ShiftEmployee | undefined> {
    const [updated] = await db
      .update(shiftEmployees)
      .set(employee)
      .where(eq(shiftEmployees.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteShiftEmployee(id: number): Promise<boolean> {
    const result = await db.delete(shiftEmployees).where(eq(shiftEmployees.id, id)).returning();
    return result.length > 0;
  }

  // Production Orders
  async getAllProductionOrders(): Promise<ProductionOrder[]> {
    return await db.select().from(productionOrders).orderBy(desc(productionOrders.createdAt));
  }

  async getProductionOrdersByBranch(branchId: string): Promise<ProductionOrder[]> {
    return await db.select().from(productionOrders).where(eq(productionOrders.branchId, branchId)).orderBy(desc(productionOrders.createdAt));
  }

  async getProductionOrdersByDate(date: string): Promise<ProductionOrder[]> {
    return await db.select().from(productionOrders).where(eq(productionOrders.scheduledDate, date)).orderBy(desc(productionOrders.createdAt));
  }

  async getProductionOrder(id: number): Promise<ProductionOrder | undefined> {
    const [order] = await db.select().from(productionOrders).where(eq(productionOrders.id, id));
    return order || undefined;
  }

  async createProductionOrder(order: InsertProductionOrder): Promise<ProductionOrder> {
    const orderNumber = `PRD-${Date.now()}`;
    const [created] = await db.insert(productionOrders).values({ ...order, orderNumber }).returning();
    return created;
  }

  async updateProductionOrder(id: number, order: Partial<InsertProductionOrder>): Promise<ProductionOrder | undefined> {
    const [updated] = await db
      .update(productionOrders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(productionOrders.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductionOrder(id: number): Promise<boolean> {
    const result = await db.delete(productionOrders).where(eq(productionOrders.id, id)).returning();
    return result.length > 0;
  }

  // Quality Checks
  async getAllQualityChecks(): Promise<QualityCheck[]> {
    return await db.select().from(qualityChecks).orderBy(desc(qualityChecks.createdAt));
  }

  async getQualityChecksByBranch(branchId: string): Promise<QualityCheck[]> {
    return await db.select().from(qualityChecks).where(eq(qualityChecks.branchId, branchId)).orderBy(desc(qualityChecks.createdAt));
  }

  async getQualityChecksByDate(date: string): Promise<QualityCheck[]> {
    return await db.select().from(qualityChecks).where(eq(qualityChecks.checkDate, date)).orderBy(desc(qualityChecks.createdAt));
  }

  async getQualityCheck(id: number): Promise<QualityCheck | undefined> {
    const [check] = await db.select().from(qualityChecks).where(eq(qualityChecks.id, id));
    return check || undefined;
  }

  async createQualityCheck(check: InsertQualityCheck): Promise<QualityCheck> {
    const [created] = await db.insert(qualityChecks).values(check).returning();
    return created;
  }

  // Daily Operations Summary
  async getDailyOperationsSummary(branchId: string, date: string): Promise<DailyOperationsSummary | undefined> {
    const [summary] = await db
      .select()
      .from(dailyOperationsSummary)
      .where(and(eq(dailyOperationsSummary.branchId, branchId), eq(dailyOperationsSummary.date, date)));
    return summary || undefined;
  }

  async createOrUpdateDailyOperationsSummary(summary: InsertDailyOperationsSummary): Promise<DailyOperationsSummary> {
    const existing = await this.getDailyOperationsSummary(summary.branchId, summary.date);
    
    if (existing) {
      const [updated] = await db
        .update(dailyOperationsSummary)
        .set({ ...summary, updatedAt: new Date() })
        .where(eq(dailyOperationsSummary.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(dailyOperationsSummary).values(summary).returning();
      return created;
    }
  }

  // ==================== Cashier Sales Journal ====================
  
  async getAllCashierJournals(): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals).orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournalsByBranch(branchId: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(eq(cashierSalesJournals.branchId, branchId))
      .orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournalsByDate(date: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(eq(cashierSalesJournals.journalDate, date))
      .orderBy(desc(cashierSalesJournals.createdAt));
  }

  async getCashierJournalsByDateRange(startDate: string, endDate: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(and(
        gte(cashierSalesJournals.journalDate, startDate),
        lte(cashierSalesJournals.journalDate, endDate)
      ))
      .orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournalsByCashier(cashierId: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(eq(cashierSalesJournals.cashierId, cashierId))
      .orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournalsByStatus(status: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(eq(cashierSalesJournals.status, status))
      .orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournalsByDiscrepancyStatus(status: string): Promise<CashierSalesJournal[]> {
    return await db.select().from(cashierSalesJournals)
      .where(eq(cashierSalesJournals.discrepancyStatus, status))
      .orderBy(desc(cashierSalesJournals.journalDate));
  }

  async getCashierJournal(id: number): Promise<CashierSalesJournal | undefined> {
    const [journal] = await db.select().from(cashierSalesJournals).where(eq(cashierSalesJournals.id, id));
    return journal || undefined;
  }

  async createCashierJournal(journal: InsertCashierSalesJournal): Promise<CashierSalesJournal> {
    // Calculate discrepancy
    const expectedCash = journal.cashTotal || 0;
    const actualCash = journal.actualCashDrawer || 0;
    const discrepancy = actualCash - expectedCash;
    const discrepancyStatus = discrepancy === 0 ? 'balanced' : (discrepancy < 0 ? 'shortage' : 'surplus');
    
    // Calculate average ticket
    const customerCount = journal.customerCount || 0;
    const totalSales = journal.totalSales || 0;
    const averageTicket = customerCount > 0 ? totalSales / customerCount : 0;

    const [created] = await db.insert(cashierSalesJournals).values({
      ...journal,
      expectedCash,
      discrepancyAmount: Math.abs(discrepancy),
      discrepancyStatus,
      averageTicket,
    }).returning();
    return created;
  }

  async updateCashierJournal(id: number, journal: Partial<InsertCashierSalesJournal>): Promise<CashierSalesJournal | undefined> {
    // Recalculate discrepancy if relevant fields changed
    let updateData: any = { ...journal, updatedAt: new Date() };
    
    if (journal.cashTotal !== undefined || journal.actualCashDrawer !== undefined) {
      const existing = await this.getCashierJournal(id);
      if (existing) {
        const expectedCash = journal.cashTotal ?? existing.cashTotal;
        const actualCash = journal.actualCashDrawer ?? existing.actualCashDrawer;
        const discrepancy = actualCash - expectedCash;
        updateData.expectedCash = expectedCash;
        updateData.discrepancyAmount = Math.abs(discrepancy);
        updateData.discrepancyStatus = discrepancy === 0 ? 'balanced' : (discrepancy < 0 ? 'shortage' : 'surplus');
      }
    }

    // Recalculate average ticket
    if (journal.customerCount !== undefined || journal.totalSales !== undefined) {
      const existing = await this.getCashierJournal(id);
      if (existing) {
        const customerCount = journal.customerCount ?? existing.customerCount ?? 0;
        const totalSales = journal.totalSales ?? existing.totalSales;
        updateData.averageTicket = customerCount > 0 ? totalSales / customerCount : 0;
      }
    }

    const [updated] = await db.update(cashierSalesJournals)
      .set(updateData)
      .where(eq(cashierSalesJournals.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCashierJournal(id: number): Promise<boolean> {
    const result = await db.delete(cashierSalesJournals).where(eq(cashierSalesJournals.id, id));
    return true;
  }

  async submitCashierJournal(id: number): Promise<CashierSalesJournal | undefined> {
    const [updated] = await db.update(cashierSalesJournals)
      .set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() })
      .where(eq(cashierSalesJournals.id, id))
      .returning();
    return updated || undefined;
  }

  async postCashierJournal(id: number): Promise<CashierSalesJournal | undefined> {
    const [updated] = await db.update(cashierSalesJournals)
      .set({ status: 'posted', updatedAt: new Date() })
      .where(eq(cashierSalesJournals.id, id))
      .returning();
    return updated || undefined;
  }

  async approveCashierJournal(id: number, approvedBy: string): Promise<CashierSalesJournal | undefined> {
    const [updated] = await db.update(cashierSalesJournals)
      .set({ status: 'approved', approvedBy, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(cashierSalesJournals.id, id))
      .returning();
    return updated || undefined;
  }

  async rejectCashierJournal(id: number, notes?: string): Promise<CashierSalesJournal | undefined> {
    const [updated] = await db.update(cashierSalesJournals)
      .set({ status: 'rejected', notes, updatedAt: new Date() })
      .where(eq(cashierSalesJournals.id, id))
      .returning();
    return updated || undefined;
  }

  // Payment Breakdowns
  async getPaymentBreakdowns(journalId: number): Promise<CashierPaymentBreakdown[]> {
    return await db.select().from(cashierPaymentBreakdowns)
      .where(eq(cashierPaymentBreakdowns.journalId, journalId));
  }

  async createPaymentBreakdown(breakdown: InsertCashierPaymentBreakdown): Promise<CashierPaymentBreakdown> {
    const [created] = await db.insert(cashierPaymentBreakdowns).values(breakdown).returning();
    return created;
  }

  async createPaymentBreakdowns(breakdowns: InsertCashierPaymentBreakdown[]): Promise<CashierPaymentBreakdown[]> {
    if (breakdowns.length === 0) return [];
    const created = await db.insert(cashierPaymentBreakdowns).values(breakdowns).returning();
    return created;
  }

  async deletePaymentBreakdowns(journalId: number): Promise<boolean> {
    await db.delete(cashierPaymentBreakdowns).where(eq(cashierPaymentBreakdowns.journalId, journalId));
    return true;
  }

  // Cashier Signatures
  async getCashierSignatures(journalId: number): Promise<CashierSignature[]> {
    return await db.select().from(cashierSignatures)
      .where(eq(cashierSignatures.journalId, journalId));
  }

  async createCashierSignature(signature: InsertCashierSignature): Promise<CashierSignature> {
    const [created] = await db.insert(cashierSignatures).values(signature).returning();
    return created;
  }

  // Journal Attachments
  async getJournalAttachments(journalId: number): Promise<JournalAttachment[]> {
    return await db.select().from(journalAttachments)
      .where(eq(journalAttachments.journalId, journalId));
  }

  async createJournalAttachment(attachment: InsertJournalAttachment): Promise<JournalAttachment> {
    const [created] = await db.insert(journalAttachments).values(attachment).returning();
    return created;
  }

  async deleteJournalAttachment(id: number): Promise<boolean> {
    await db.delete(journalAttachments).where(eq(journalAttachments.id, id));
    return true;
  }

  async deleteJournalAttachments(journalId: number): Promise<boolean> {
    await db.delete(journalAttachments).where(eq(journalAttachments.journalId, journalId));
    return true;
  }

  // Cashier Journal Stats
  async getCashierJournalStats(branchId?: string): Promise<{
    totalJournals: number;
    totalSales: number;
    totalShortages: number;
    totalSurpluses: number;
    shortageAmount: number;
    surplusAmount: number;
    averageTicket: number;
  }> {
    let journals: CashierSalesJournal[];
    if (branchId) {
      journals = await this.getCashierJournalsByBranch(branchId);
    } else {
      journals = await this.getAllCashierJournals();
    }

    const totalJournals = journals.length;
    const totalSales = journals.reduce((sum, j) => sum + j.totalSales, 0);
    const shortageJournals = journals.filter(j => j.discrepancyStatus === 'shortage');
    const surplusJournals = journals.filter(j => j.discrepancyStatus === 'surplus');
    const totalShortages = shortageJournals.length;
    const totalSurpluses = surplusJournals.length;
    const shortageAmount = shortageJournals.reduce((sum, j) => sum + j.discrepancyAmount, 0);
    const surplusAmount = surplusJournals.reduce((sum, j) => sum + j.discrepancyAmount, 0);
    const avgTickets = journals.filter(j => j.averageTicket && j.averageTicket > 0);
    const averageTicket = avgTickets.length > 0 
      ? avgTickets.reduce((sum, j) => sum + (j.averageTicket || 0), 0) / avgTickets.length 
      : 0;

    return {
      totalJournals,
      totalSales,
      totalShortages,
      totalSurpluses,
      shortageAmount,
      surplusAmount,
      averageTicket,
    };
  }

  // Comprehensive Operations Reports
  async getOperationsReport(filters: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    salesReport: {
      totalSales: number;
      cashSales: number;
      networkSales: number;
      deliverySales: number;
      totalTransactions: number;
      averageTicket: number;
      totalShortages: number;
      shortageAmount: number;
      totalSurpluses: number;
      surplusAmount: number;
      journalsByStatus: { status: string; count: number }[];
      paymentMethodBreakdown: { method: string; amount: number; count: number }[];
      dailySales: { date: string; sales: number; transactions: number }[];
    };
    productionReport: {
      totalOrders: number;
      pendingOrders: number;
      inProgressOrders: number;
      completedOrders: number;
      cancelledOrders: number;
      totalQuantityProduced: number;
      qualityPassRate: number;
      qualityChecks: { status: string; count: number }[];
      ordersByProduct: { productName: string; quantity: number; orderCount: number }[];
      dailyProduction: { date: string; quantity: number; orders: number }[];
    };
    shiftsReport: {
      totalShifts: number;
      shiftsWithEmployees: number;
      totalEmployeeAssignments: number;
      shiftsByType: { type: string; count: number }[];
      employeesByRole: { role: string; count: number }[];
    };
    branchComparison: {
      branchId: string;
      branchName: string;
      totalSales: number;
      totalOrders: number;
      qualityPassRate: number;
      averageTicket: number;
    }[];
  }> {
    const { branchId, startDate, endDate } = filters;
    
    // Get all journals within date range
    let allJournals = await this.getAllCashierJournals();
    if (branchId) {
      allJournals = allJournals.filter(j => j.branchId === branchId);
    }
    if (startDate) {
      allJournals = allJournals.filter(j => j.journalDate >= startDate);
    }
    if (endDate) {
      allJournals = allJournals.filter(j => j.journalDate <= endDate);
    }

    // Sales Report calculations
    const totalSales = allJournals.reduce((sum, j) => sum + j.totalSales, 0);
    const cashSales = allJournals.reduce((sum, j) => sum + j.cashTotal, 0);
    const networkSales = allJournals.reduce((sum, j) => sum + (j.networkTotal || 0), 0);
    const deliverySales = allJournals.reduce((sum, j) => sum + (j.deliveryTotal || 0), 0);
    const totalTransactions = allJournals.reduce((sum, j) => sum + (j.transactionCount || 0), 0);
    const avgTickets = allJournals.filter(j => j.averageTicket && j.averageTicket > 0);
    const averageTicket = avgTickets.length > 0 
      ? avgTickets.reduce((sum, j) => sum + (j.averageTicket || 0), 0) / avgTickets.length 
      : totalTransactions > 0 ? totalSales / totalTransactions : 0;
    
    const shortageJournals = allJournals.filter(j => j.discrepancyStatus === 'shortage');
    const surplusJournals = allJournals.filter(j => j.discrepancyStatus === 'surplus');
    const totalShortages = shortageJournals.length;
    const shortageAmount = shortageJournals.reduce((sum, j) => sum + Math.abs(j.discrepancyAmount), 0);
    const totalSurpluses = surplusJournals.length;
    const surplusAmount = surplusJournals.reduce((sum, j) => sum + j.discrepancyAmount, 0);

    // Journals by status
    const statusCounts: Record<string, number> = {};
    allJournals.forEach(j => {
      statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
    });
    const journalsByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // Payment method breakdown (aggregate from all breakdowns)
    const paymentMethodTotals: Record<string, { amount: number; count: number }> = {};
    for (const journal of allJournals) {
      const breakdowns = await this.getPaymentBreakdowns(journal.id);
      for (const b of breakdowns) {
        if (!paymentMethodTotals[b.paymentMethod]) {
          paymentMethodTotals[b.paymentMethod] = { amount: 0, count: 0 };
        }
        paymentMethodTotals[b.paymentMethod].amount += b.amount;
        paymentMethodTotals[b.paymentMethod].count += b.transactionCount || 0;
      }
    }
    const paymentMethodBreakdown = Object.entries(paymentMethodTotals)
      .map(([method, data]) => ({ method, amount: data.amount, count: data.count }))
      .sort((a, b) => b.amount - a.amount);

    // Daily sales
    const dailySalesMap: Record<string, { sales: number; transactions: number }> = {};
    allJournals.forEach(j => {
      if (!dailySalesMap[j.journalDate]) {
        dailySalesMap[j.journalDate] = { sales: 0, transactions: 0 };
      }
      dailySalesMap[j.journalDate].sales += j.totalSales;
      dailySalesMap[j.journalDate].transactions += j.transactionCount || 0;
    });
    const dailySales = Object.entries(dailySalesMap)
      .map(([date, data]) => ({ date, sales: data.sales, transactions: data.transactions }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Production Report
    let allOrders = await this.getAllProductionOrders();
    if (branchId) {
      allOrders = allOrders.filter(o => o.branchId === branchId);
    }
    if (startDate) {
      allOrders = allOrders.filter(o => (o.scheduledDate || '') >= startDate);
    }
    if (endDate) {
      allOrders = allOrders.filter(o => (o.scheduledDate || '') <= endDate);
    }

    const totalOrders = allOrders.length;
    const pendingOrders = allOrders.filter(o => o.status === 'pending').length;
    const inProgressOrders = allOrders.filter(o => o.status === 'in_progress').length;
    const completedOrders = allOrders.filter(o => o.status === 'completed').length;
    const cancelledOrders = allOrders.filter(o => o.status === 'cancelled').length;
    const totalQuantityProduced = allOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + (o.producedQuantity || 0), 0);

    // Quality checks
    const allQualityChecks = await this.getAllQualityChecks();
    const relevantChecks = allQualityChecks.filter(qc => 
      allOrders.some(o => o.id === qc.productionOrderId)
    );
    const passedChecks = relevantChecks.filter(qc => qc.result === 'passed').length;
    const qualityPassRate = relevantChecks.length > 0 
      ? (passedChecks / relevantChecks.length) * 100 
      : 100;
    
    const qualityStatusCounts: Record<string, number> = {};
    relevantChecks.forEach(qc => {
      qualityStatusCounts[qc.result] = (qualityStatusCounts[qc.result] || 0) + 1;
    });
    const qualityChecks = Object.entries(qualityStatusCounts).map(([status, count]) => ({ status, count }));

    // Orders by product
    const products = await this.getAllProducts();
    const productOrderMap: Record<number, { productName: string; quantity: number; orderCount: number }> = {};
    for (const order of allOrders) {
      const product = products.find(p => p.id === order.productId);
      if (!productOrderMap[order.productId]) {
        productOrderMap[order.productId] = {
          productName: product?.name || `منتج ${order.productId}`,
          quantity: 0,
          orderCount: 0
        };
      }
      productOrderMap[order.productId].quantity += (order.producedQuantity || 0);
      productOrderMap[order.productId].orderCount += 1;
    }
    const ordersByProduct = Object.values(productOrderMap).sort((a, b) => b.quantity - a.quantity);

    // Daily production
    const dailyProductionMap: Record<string, { quantity: number; orders: number }> = {};
    allOrders.forEach(o => {
      const orderDate = o.scheduledDate || '';
      if (orderDate && !dailyProductionMap[orderDate]) {
        dailyProductionMap[orderDate] = { quantity: 0, orders: 0 };
      }
      if (orderDate) {
        dailyProductionMap[orderDate].quantity += (o.producedQuantity || 0);
        dailyProductionMap[orderDate].orders += 1;
      }
    });
    const dailyProduction = Object.entries(dailyProductionMap)
      .map(([date, data]) => ({ date, quantity: data.quantity, orders: data.orders }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Shifts Report
    let allShifts = await this.getAllShifts();
    if (branchId) {
      allShifts = allShifts.filter(s => s.branchId === branchId);
    }
    if (startDate) {
      allShifts = allShifts.filter(s => s.date >= startDate);
    }
    if (endDate) {
      allShifts = allShifts.filter(s => s.date <= endDate);
    }

    const totalShifts = allShifts.length;
    let totalEmployeeAssignments = 0;
    let shiftsWithEmployees = 0;
    const roleCounts: Record<string, number> = {};

    for (const shift of allShifts) {
      const employees = await this.getShiftEmployees(shift.id);
      if (employees.length > 0) {
        shiftsWithEmployees += 1;
      }
      totalEmployeeAssignments += employees.length;
      for (const emp of employees) {
        if (emp.role) {
          roleCounts[emp.role] = (roleCounts[emp.role] || 0) + 1;
        }
      }
    }

    const shiftTypeCounts: Record<string, number> = {};
    allShifts.forEach(s => {
      const shiftName = s.name || 'غير محدد';
      shiftTypeCounts[shiftName] = (shiftTypeCounts[shiftName] || 0) + 1;
    });
    const shiftsByType = Object.entries(shiftTypeCounts).map(([type, count]) => ({ type, count }));
    const employeesByRole = Object.entries(roleCounts).map(([role, count]) => ({ role, count }));

    // Branch Comparison
    const allBranches = await this.getAllBranches();
    const branchComparison = [];
    
    for (const branch of allBranches) {
      const branchJournals = allJournals.filter(j => j.branchId === branch.id);
      const branchOrders = allOrders.filter(o => o.branchId === branch.id);
      const branchSales = branchJournals.reduce((sum, j) => sum + j.totalSales, 0);
      const branchTransactions = branchJournals.reduce((sum, j) => sum + (j.transactionCount || 0), 0);
      
      const branchQualityChecks = allQualityChecks.filter(qc =>
        branchOrders.some(o => o.id === qc.productionOrderId)
      );
      const branchPassedChecks = branchQualityChecks.filter(qc => qc.result === 'passed').length;
      const branchQualityRate = branchQualityChecks.length > 0 
        ? (branchPassedChecks / branchQualityChecks.length) * 100 
        : 100;

      branchComparison.push({
        branchId: branch.id,
        branchName: branch.name,
        totalSales: branchSales,
        totalOrders: branchOrders.length,
        qualityPassRate: branchQualityRate,
        averageTicket: branchTransactions > 0 ? branchSales / branchTransactions : 0,
      });
    }

    return {
      salesReport: {
        totalSales,
        cashSales,
        networkSales,
        deliverySales,
        totalTransactions,
        averageTicket,
        totalShortages,
        shortageAmount,
        totalSurpluses,
        surplusAmount,
        journalsByStatus,
        paymentMethodBreakdown,
        dailySales,
      },
      productionReport: {
        totalOrders,
        pendingOrders,
        inProgressOrders,
        completedOrders,
        cancelledOrders,
        totalQuantityProduced,
        qualityPassRate,
        qualityChecks,
        ordersByProduct,
        dailyProduction,
      },
      shiftsReport: {
        totalShifts,
        shiftsWithEmployees,
        totalEmployeeAssignments,
        shiftsByType,
        employeesByRole,
      },
      branchComparison,
    };
  }

  // ==========================================
  // Targets & Incentives - Weight Profiles
  // ==========================================
  
  async getAllTargetWeightProfiles(): Promise<TargetWeightProfile[]> {
    return db.select().from(targetWeightProfiles).orderBy(desc(targetWeightProfiles.createdAt));
  }

  async getTargetWeightProfile(id: number): Promise<TargetWeightProfile | undefined> {
    const [profile] = await db.select().from(targetWeightProfiles).where(eq(targetWeightProfiles.id, id));
    return profile || undefined;
  }

  async getDefaultTargetWeightProfile(): Promise<TargetWeightProfile | undefined> {
    const [profile] = await db.select().from(targetWeightProfiles).where(eq(targetWeightProfiles.isDefault, true));
    return profile || undefined;
  }

  async createTargetWeightProfile(profile: InsertTargetWeightProfile): Promise<TargetWeightProfile> {
    const [created] = await db.insert(targetWeightProfiles).values(profile).returning();
    return created;
  }

  async updateTargetWeightProfile(id: number, profile: Partial<InsertTargetWeightProfile>): Promise<TargetWeightProfile | undefined> {
    const [updated] = await db.update(targetWeightProfiles)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(targetWeightProfiles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTargetWeightProfile(id: number): Promise<boolean> {
    const result = await db.delete(targetWeightProfiles).where(eq(targetWeightProfiles.id, id));
    return true;
  }

  // ==========================================
  // Targets & Incentives - Monthly Targets
  // ==========================================
  
  async getAllBranchMonthlyTargets(): Promise<BranchMonthlyTarget[]> {
    return db.select().from(branchMonthlyTargets).orderBy(desc(branchMonthlyTargets.yearMonth));
  }

  async getBranchMonthlyTargetsByBranch(branchId: string): Promise<BranchMonthlyTarget[]> {
    return db.select().from(branchMonthlyTargets)
      .where(eq(branchMonthlyTargets.branchId, branchId))
      .orderBy(desc(branchMonthlyTargets.yearMonth));
  }

  async getBranchMonthlyTarget(id: number): Promise<BranchMonthlyTarget | undefined> {
    const [target] = await db.select().from(branchMonthlyTargets).where(eq(branchMonthlyTargets.id, id));
    return target || undefined;
  }

  async getBranchMonthlyTargetByMonth(branchId: string, yearMonth: string): Promise<BranchMonthlyTarget | undefined> {
    const [target] = await db.select().from(branchMonthlyTargets)
      .where(and(eq(branchMonthlyTargets.branchId, branchId), eq(branchMonthlyTargets.yearMonth, yearMonth)));
    return target || undefined;
  }

  async createBranchMonthlyTarget(target: InsertBranchMonthlyTarget): Promise<BranchMonthlyTarget> {
    const [created] = await db.insert(branchMonthlyTargets).values(target).returning();
    return created;
  }

  async updateBranchMonthlyTarget(id: number, target: Partial<InsertBranchMonthlyTarget>): Promise<BranchMonthlyTarget | undefined> {
    const [updated] = await db.update(branchMonthlyTargets)
      .set({ ...target, updatedAt: new Date() })
      .where(eq(branchMonthlyTargets.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBranchMonthlyTarget(id: number): Promise<boolean> {
    await db.delete(branchMonthlyTargets).where(eq(branchMonthlyTargets.id, id));
    return true;
  }

  // ==========================================
  // Targets & Incentives - Daily Allocations
  // ==========================================
  
  async getTargetDailyAllocationsByMonth(monthlyTargetId: number): Promise<TargetDailyAllocation[]> {
    return db.select().from(targetDailyAllocations)
      .where(eq(targetDailyAllocations.monthlyTargetId, monthlyTargetId))
      .orderBy(targetDailyAllocations.targetDate);
  }

  async getTargetDailyAllocation(id: number): Promise<TargetDailyAllocation | undefined> {
    const [allocation] = await db.select().from(targetDailyAllocations).where(eq(targetDailyAllocations.id, id));
    return allocation || undefined;
  }

  async createTargetDailyAllocation(allocation: InsertTargetDailyAllocation): Promise<TargetDailyAllocation> {
    const [created] = await db.insert(targetDailyAllocations).values(allocation).returning();
    return created;
  }

  async updateTargetDailyAllocation(id: number, allocation: Partial<InsertTargetDailyAllocation>): Promise<TargetDailyAllocation | undefined> {
    const [updated] = await db.update(targetDailyAllocations)
      .set({ ...allocation, updatedAt: new Date() })
      .where(eq(targetDailyAllocations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTargetDailyAllocation(id: number): Promise<boolean> {
    await db.delete(targetDailyAllocations).where(eq(targetDailyAllocations.id, id));
    return true;
  }

  async bulkCreateTargetDailyAllocations(allocations: InsertTargetDailyAllocation[]): Promise<TargetDailyAllocation[]> {
    if (allocations.length === 0) return [];
    return db.insert(targetDailyAllocations).values(allocations).returning();
  }

  // ==========================================
  // Targets & Incentives - Shift Allocations
  // ==========================================
  
  async getTargetShiftAllocationsByDaily(dailyAllocationId: number): Promise<TargetShiftAllocation[]> {
    return db.select().from(targetShiftAllocations)
      .where(eq(targetShiftAllocations.dailyAllocationId, dailyAllocationId));
  }

  async createTargetShiftAllocation(allocation: InsertTargetShiftAllocation): Promise<TargetShiftAllocation> {
    const [created] = await db.insert(targetShiftAllocations).values(allocation).returning();
    return created;
  }

  async deleteTargetShiftAllocationsByDaily(dailyAllocationId: number): Promise<boolean> {
    await db.delete(targetShiftAllocations).where(eq(targetShiftAllocations.dailyAllocationId, dailyAllocationId));
    return true;
  }

  // ==========================================
  // Targets & Incentives - Incentive Tiers
  // ==========================================
  
  async getAllIncentiveTiers(): Promise<IncentiveTier[]> {
    return db.select().from(incentiveTiers).orderBy(incentiveTiers.sortOrder);
  }

  async getActiveIncentiveTiers(): Promise<IncentiveTier[]> {
    return db.select().from(incentiveTiers)
      .where(eq(incentiveTiers.isActive, true))
      .orderBy(incentiveTiers.sortOrder);
  }

  async getIncentiveTier(id: number): Promise<IncentiveTier | undefined> {
    const [tier] = await db.select().from(incentiveTiers).where(eq(incentiveTiers.id, id));
    return tier || undefined;
  }

  async createIncentiveTier(tier: InsertIncentiveTier): Promise<IncentiveTier> {
    const [created] = await db.insert(incentiveTiers).values(tier).returning();
    return created;
  }

  async updateIncentiveTier(id: number, tier: Partial<InsertIncentiveTier>): Promise<IncentiveTier | undefined> {
    const [updated] = await db.update(incentiveTiers)
      .set({ ...tier, updatedAt: new Date() })
      .where(eq(incentiveTiers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteIncentiveTier(id: number): Promise<boolean> {
    await db.delete(incentiveTiers).where(eq(incentiveTiers.id, id));
    return true;
  }

  // ==========================================
  // Targets & Incentives - Incentive Awards
  // ==========================================
  
  async getAllIncentiveAwards(): Promise<IncentiveAward[]> {
    return db.select().from(incentiveAwards).orderBy(desc(incentiveAwards.createdAt));
  }

  async getIncentiveAwardsByBranch(branchId: string): Promise<IncentiveAward[]> {
    return db.select().from(incentiveAwards)
      .where(eq(incentiveAwards.branchId, branchId))
      .orderBy(desc(incentiveAwards.createdAt));
  }

  async getIncentiveAwardsByCashier(cashierId: string): Promise<IncentiveAward[]> {
    return db.select().from(incentiveAwards)
      .where(eq(incentiveAwards.cashierId, cashierId))
      .orderBy(desc(incentiveAwards.createdAt));
  }

  async getIncentiveAward(id: number): Promise<IncentiveAward | undefined> {
    const [award] = await db.select().from(incentiveAwards).where(eq(incentiveAwards.id, id));
    return award || undefined;
  }

  async createIncentiveAward(award: InsertIncentiveAward): Promise<IncentiveAward> {
    const [created] = await db.insert(incentiveAwards).values(award).returning();
    return created;
  }

  async updateIncentiveAward(id: number, award: Partial<InsertIncentiveAward>): Promise<IncentiveAward | undefined> {
    const [updated] = await db.update(incentiveAwards)
      .set({ ...award, updatedAt: new Date() })
      .where(eq(incentiveAwards.id, id))
      .returning();
    return updated || undefined;
  }

  async approveIncentiveAward(id: number, approvedBy: string): Promise<IncentiveAward | undefined> {
    const [updated] = await db.update(incentiveAwards)
      .set({ status: 'approved', approvedBy, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(incentiveAwards.id, id))
      .returning();
    return updated || undefined;
  }

  async markIncentiveAwardAsPaid(id: number): Promise<IncentiveAward | undefined> {
    const [updated] = await db.update(incentiveAwards)
      .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
      .where(eq(incentiveAwards.id, id))
      .returning();
    return updated || undefined;
  }

  // ==========================================
  // Targets Performance Calculation
  // ==========================================
  
  async calculateBranchPerformance(branchId: string, yearMonth: string): Promise<{
    targetAmount: number;
    achievedAmount: number;
    achievementPercent: number;
    dailyPerformance: { date: string; target: number; achieved: number; percent: number }[];
  }> {
    const target = await this.getBranchMonthlyTargetByMonth(branchId, yearMonth);
    if (!target) {
      return { targetAmount: 0, achievedAmount: 0, achievementPercent: 0, dailyPerformance: [] };
    }

    const dailyAllocations = await this.getTargetDailyAllocationsByMonth(target.id);
    const journals = await this.getCashierJournalsByBranch(branchId);
    
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`;
    const monthJournals = journals.filter((j: CashierSalesJournal) => 
      j.journalDate >= startDate && j.journalDate <= endDate && j.status === 'approved'
    );

    const dailySalesMap: Record<string, number> = {};
    monthJournals.forEach((j: CashierSalesJournal) => {
      dailySalesMap[j.journalDate] = (dailySalesMap[j.journalDate] || 0) + j.totalSales;
    });

    const dailyPerformance = dailyAllocations.map(alloc => {
      const achieved = dailySalesMap[alloc.targetDate] || 0;
      const percent = alloc.dailyTarget > 0 ? (achieved / alloc.dailyTarget) * 100 : 0;
      return {
        date: alloc.targetDate,
        target: alloc.dailyTarget,
        achieved,
        percent
      };
    });

    const achievedAmount = monthJournals.reduce((sum: number, j: CashierSalesJournal) => sum + j.totalSales, 0);
    const achievementPercent = target.targetAmount > 0 ? (achievedAmount / target.targetAmount) * 100 : 0;

    return {
      targetAmount: target.targetAmount,
      achievedAmount,
      achievementPercent,
      dailyPerformance
    };
  }

  async getLeaderboard(yearMonth: string): Promise<{
    branches: { branchId: string; branchName: string; target: number; achieved: number; percent: number; rank: number }[];
    cashiers: { cashierId: string; cashierName: string; branchId: string; target: number; achieved: number; percent: number; rank: number }[];
  }> {
    const allBranches = await this.getAllBranches();
    const allTargets = await this.getAllBranchMonthlyTargets();
    const monthTargets = allTargets.filter(t => t.yearMonth === yearMonth);
    
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`;
    
    const branchPerformance: { branchId: string; branchName: string; target: number; achieved: number; percent: number; rank: number }[] = [];
    
    for (const branch of allBranches) {
      const branchTarget = monthTargets.find(t => t.branchId === branch.id);
      const journals = await this.getCashierJournalsByBranch(branch.id);
      const branchMonthJournals = journals.filter((j: CashierSalesJournal) => 
        j.journalDate >= startDate && j.journalDate <= endDate && j.status === 'approved'
      );
      
      const achieved = branchMonthJournals.reduce((sum: number, j: CashierSalesJournal) => sum + j.totalSales, 0);
      const target = branchTarget?.targetAmount || 0;
      const percent = target > 0 ? (achieved / target) * 100 : 0;
      
      branchPerformance.push({
        branchId: branch.id,
        branchName: branch.name,
        target,
        achieved,
        percent,
        rank: 0
      });
    }

    branchPerformance.sort((a, b) => b.percent - a.percent);
    branchPerformance.forEach((b, i) => b.rank = i + 1);

    const allJournals = await this.getAllCashierJournals();
    const monthJournals = allJournals.filter((j: CashierSalesJournal) => 
      j.journalDate >= startDate && j.journalDate <= endDate && j.status === 'approved'
    );

    const cashierSales: Record<string, { cashierName: string; branchId: string; total: number }> = {};
    monthJournals.forEach((j: CashierSalesJournal) => {
      if (!cashierSales[j.cashierId]) {
        cashierSales[j.cashierId] = { cashierName: j.cashierName, branchId: j.branchId, total: 0 };
      }
      cashierSales[j.cashierId].total += j.totalSales;
    });

    const cashierPerformance = Object.entries(cashierSales).map(([cashierId, data]) => {
      const branchTarget = monthTargets.find(t => t.branchId === data.branchId);
      const target = branchTarget?.targetAmount ? branchTarget.targetAmount / 30 : 0;
      const percent = target > 0 ? (data.total / target) * 100 : 0;
      return {
        cashierId,
        cashierName: data.cashierName,
        branchId: data.branchId,
        target,
        achieved: data.total,
        percent,
        rank: 0
      };
    });

    cashierPerformance.sort((a, b) => b.achieved - a.achieved);
    cashierPerformance.forEach((c, i) => c.rank = i + 1);

    return {
      branches: branchPerformance,
      cashiers: cashierPerformance.slice(0, 20)
    };
  }

  // ==========================================
  // Seasons & Holidays Management
  // ==========================================

  async getAllSeasonsHolidays(): Promise<SeasonHoliday[]> {
    return await db.select().from(seasonsHolidays).orderBy(seasonsHolidays.startDate);
  }

  async getActiveSeasonsHolidays(): Promise<SeasonHoliday[]> {
    return await db.select().from(seasonsHolidays)
      .where(eq(seasonsHolidays.isActive, true))
      .orderBy(seasonsHolidays.startDate);
  }

  async createSeasonHoliday(data: InsertSeasonHoliday): Promise<SeasonHoliday> {
    const [inserted] = await db.insert(seasonsHolidays).values(data).returning();
    return inserted;
  }

  async updateSeasonHoliday(id: number, data: Partial<InsertSeasonHoliday>): Promise<SeasonHoliday | undefined> {
    const [updated] = await db.update(seasonsHolidays)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(seasonsHolidays.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSeasonHoliday(id: number): Promise<void> {
    await db.delete(seasonsHolidays).where(eq(seasonsHolidays.id, id));
  }

  async getSeasonsHolidaysForDateRange(startDate: string, endDate: string): Promise<SeasonHoliday[]> {
    return await db.select().from(seasonsHolidays)
      .where(
        and(
          eq(seasonsHolidays.isActive, true),
          lte(seasonsHolidays.startDate, endDate),
          gte(seasonsHolidays.endDate, startDate)
        )
      );
  }

  // ==========================================
  // Commission Rates Management
  // ==========================================

  async getAllCommissionRates(): Promise<CommissionRate[]> {
    return await db.select().from(commissionRates).orderBy(commissionRates.name);
  }

  async getActiveCommissionRates(): Promise<CommissionRate[]> {
    return await db.select().from(commissionRates)
      .where(eq(commissionRates.isActive, true))
      .orderBy(commissionRates.minSalesAmount);
  }

  async createCommissionRate(data: InsertCommissionRate): Promise<CommissionRate> {
    const [inserted] = await db.insert(commissionRates).values(data).returning();
    return inserted;
  }

  async updateCommissionRate(id: number, data: Partial<InsertCommissionRate>): Promise<CommissionRate | undefined> {
    const [updated] = await db.update(commissionRates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(commissionRates.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCommissionRate(id: number): Promise<void> {
    await db.delete(commissionRates).where(eq(commissionRates.id, id));
  }

  // ==========================================
  // Commission Calculations
  // ==========================================

  async getAllCommissionCalculations(): Promise<CommissionCalculation[]> {
    return await db.select().from(commissionCalculations).orderBy(desc(commissionCalculations.createdAt));
  }

  async getCommissionCalculationsByBranch(branchId: string): Promise<CommissionCalculation[]> {
    return await db.select().from(commissionCalculations)
      .where(eq(commissionCalculations.branchId, branchId))
      .orderBy(desc(commissionCalculations.createdAt));
  }

  async getCommissionCalculationsByCashier(cashierId: string): Promise<CommissionCalculation[]> {
    return await db.select().from(commissionCalculations)
      .where(eq(commissionCalculations.cashierId, cashierId))
      .orderBy(desc(commissionCalculations.createdAt));
  }

  async createCommissionCalculation(data: InsertCommissionCalculation): Promise<CommissionCalculation> {
    const [inserted] = await db.insert(commissionCalculations).values(data).returning();
    return inserted;
  }

  async updateCommissionCalculation(id: number, data: Partial<InsertCommissionCalculation>): Promise<CommissionCalculation | undefined> {
    const [updated] = await db.update(commissionCalculations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(commissionCalculations.id, id))
      .returning();
    return updated || undefined;
  }

  async approveCommissionCalculation(id: number, approvedBy: string): Promise<CommissionCalculation | undefined> {
    const [updated] = await db.update(commissionCalculations)
      .set({ status: 'approved', approvedBy, approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(commissionCalculations.id, id))
      .returning();
    return updated || undefined;
  }

  async markCommissionAsPaid(id: number): Promise<CommissionCalculation | undefined> {
    const [updated] = await db.update(commissionCalculations)
      .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
      .where(eq(commissionCalculations.id, id))
      .returning();
    return updated || undefined;
  }

  // Calculate commission for a cashier for a period
  async calculateCashierCommission(cashierId: string, periodStart: string, periodEnd: string): Promise<{
    cashierId: string;
    totalSales: number;
    targetAmount: number;
    achievementPercent: number;
    applicableRate: CommissionRate | null;
    calculatedCommission: number;
    journalIds: number[];
  }> {
    const journals = await db.select().from(cashierSalesJournals)
      .where(
        and(
          eq(cashierSalesJournals.cashierId, cashierId),
          gte(cashierSalesJournals.journalDate, periodStart),
          lte(cashierSalesJournals.journalDate, periodEnd),
          inArray(cashierSalesJournals.status, ['posted', 'approved'])
        )
      );

    const totalSales = journals.reduce((sum, j) => sum + j.totalSales, 0);
    const journalIds = journals.map(j => j.id);

    // Get applicable commission rate
    const rates = await this.getActiveCommissionRates();
    const applicableRate = rates.find(r => {
      const minOk = totalSales >= (r.minSalesAmount || 0);
      const maxOk = !r.maxSalesAmount || totalSales <= r.maxSalesAmount;
      return minOk && maxOk;
    }) || null;

    let calculatedCommission = 0;
    if (applicableRate) {
      if (applicableRate.commissionType === 'fixed' && applicableRate.fixedAmount) {
        calculatedCommission = applicableRate.fixedAmount;
      } else if (applicableRate.commissionType === 'percentage' && applicableRate.percentageRate) {
        calculatedCommission = (totalSales * applicableRate.percentageRate) / 100;
      } else if (applicableRate.commissionType === 'tiered') {
        if (applicableRate.fixedAmount) calculatedCommission += applicableRate.fixedAmount;
        if (applicableRate.percentageRate) calculatedCommission += (totalSales * applicableRate.percentageRate) / 100;
      }
    }

    // Get target for achievement calculation
    const branchId = journals[0]?.branchId;
    let targetAmount = 0;
    let achievementPercent = 0;
    if (branchId) {
      const yearMonth = periodStart.substring(0, 7);
      const target = await this.getBranchMonthlyTargetByMonth(branchId, yearMonth);
      if (target) {
        targetAmount = target.targetAmount;
        achievementPercent = targetAmount > 0 ? (totalSales / targetAmount) * 100 : 0;
      }
    }

    return {
      cashierId,
      totalSales,
      targetAmount,
      achievementPercent,
      applicableRate,
      calculatedCommission,
      journalIds
    };
  }

  // Get daily sales progress for a branch with target comparison
  async getBranchDailySalesProgress(branchId: string, yearMonth: string): Promise<{
    branchId: string;
    branchName: string;
    yearMonth: string;
    targetAmount: number;
    achievedAmount: number;
    achievementPercent: number;
    remainingAmount: number;
    dailyTargetAverage: number;
    dailyProgress: {
      date: string;
      dayName: string;
      targetAmount: number;
      achievedAmount: number;
      achievementPercent: number;
      cumulativeTarget: number;
      cumulativeAchieved: number;
      cumulativePercent: number;
      variance: number;
      journalCount: number;
      journalIds: number[];
    }[];
  } | null> {
    const branch = await this.getBranch(branchId);
    if (!branch) return null;

    const branchTarget = await this.getBranchMonthlyTargetByMonth(branchId, yearMonth);
    if (!branchTarget) return null;

    const [year, month] = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyTargetAverage = branchTarget.targetAmount / daysInMonth;

    // Get daily allocations if exists
    const allocations = await this.getTargetDailyAllocationsByMonth(branchTarget.id);
    
    // Get all journals for the month
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;
    
    const journals = await db.select().from(cashierSalesJournals)
      .where(
        and(
          eq(cashierSalesJournals.branchId, branchId),
          gte(cashierSalesJournals.journalDate, startDate),
          lte(cashierSalesJournals.journalDate, endDate),
          inArray(cashierSalesJournals.status, ['posted', 'approved'])
        )
      );

    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dailyProgress: {
      date: string;
      dayName: string;
      targetAmount: number;
      achievedAmount: number;
      achievementPercent: number;
      cumulativeTarget: number;
      cumulativeAchieved: number;
      cumulativePercent: number;
      variance: number;
      journalCount: number;
      journalIds: number[];
    }[] = [];

    let cumulativeTarget = 0;
    let cumulativeAchieved = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const dayName = dayNames[dayOfWeek];
      
      // Get target for this day from allocations or use average
      const allocation = allocations.find((a: { targetDate: string }) => a.targetDate === dateStr);
      const dayTarget = allocation ? allocation.dailyTarget : dailyTargetAverage;
      
      // Get sales for this day
      const dayJournals = journals.filter(j => j.journalDate === dateStr);
      const dayAchieved = dayJournals.reduce((sum, j) => sum + j.totalSales, 0);
      const journalIds = dayJournals.map(j => j.id);
      
      cumulativeTarget += dayTarget;
      cumulativeAchieved += dayAchieved;
      
      dailyProgress.push({
        date: dateStr,
        dayName,
        targetAmount: dayTarget,
        achievedAmount: dayAchieved,
        achievementPercent: dayTarget > 0 ? (dayAchieved / dayTarget) * 100 : 0,
        cumulativeTarget,
        cumulativeAchieved,
        cumulativePercent: cumulativeTarget > 0 ? (cumulativeAchieved / cumulativeTarget) * 100 : 0,
        variance: dayAchieved - dayTarget,
        journalCount: dayJournals.length,
        journalIds
      });
    }

    const totalAchieved = journals.reduce((sum, j) => sum + j.totalSales, 0);
    const achievementPercent = branchTarget.targetAmount > 0 
      ? (totalAchieved / branchTarget.targetAmount) * 100 
      : 0;

    return {
      branchId,
      branchName: branch.name,
      yearMonth,
      targetAmount: branchTarget.targetAmount,
      achievedAmount: totalAchieved,
      achievementPercent,
      remainingAmount: Math.max(0, branchTarget.targetAmount - totalAchieved),
      dailyTargetAverage,
      dailyProgress
    };
  }

  // Get all branches sales progress summary
  async getAllBranchesSalesProgress(yearMonth: string): Promise<{
    branchId: string;
    branchName: string;
    targetAmount: number;
    achievedAmount: number;
    achievementPercent: number;
    remainingAmount: number;
    daysWithSales: number;
    averageDailySales: number;
    projectedTotal: number;
    projectedPercent: number;
    trend: 'up' | 'down' | 'stable';
  }[]> {
    const branches = await this.getAllBranches();
    const [year, month] = yearMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const currentDay = today.getMonth() + 1 === month && today.getFullYear() === year 
      ? today.getDate() 
      : (today > new Date(year, month - 1, 1) ? daysInMonth : 0);

    const results: {
      branchId: string;
      branchName: string;
      targetAmount: number;
      achievedAmount: number;
      achievementPercent: number;
      remainingAmount: number;
      daysWithSales: number;
      averageDailySales: number;
      projectedTotal: number;
      projectedPercent: number;
      trend: 'up' | 'down' | 'stable';
    }[] = [];

    for (const branch of branches) {
      const progress = await this.getBranchDailySalesProgress(branch.id, yearMonth);
      if (!progress) continue;

      const daysWithSales = progress.dailyProgress.filter(d => d.achievedAmount > 0).length;
      const averageDailySales = daysWithSales > 0 ? progress.achievedAmount / daysWithSales : 0;
      const projectedTotal = averageDailySales * daysInMonth;
      const projectedPercent = progress.targetAmount > 0 
        ? (projectedTotal / progress.targetAmount) * 100 
        : 0;

      // Calculate trend from last 7 days
      const recentDays = progress.dailyProgress.slice(-7).filter(d => d.achievedAmount > 0);
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (recentDays.length >= 2) {
        const firstHalf = recentDays.slice(0, Math.floor(recentDays.length / 2));
        const secondHalf = recentDays.slice(Math.floor(recentDays.length / 2));
        const firstAvg = firstHalf.reduce((s, d) => s + d.achievedAmount, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((s, d) => s + d.achievedAmount, 0) / secondHalf.length;
        if (secondAvg > firstAvg * 1.1) trend = 'up';
        else if (secondAvg < firstAvg * 0.9) trend = 'down';
      }

      results.push({
        branchId: branch.id,
        branchName: branch.name,
        targetAmount: progress.targetAmount,
        achievedAmount: progress.achievedAmount,
        achievementPercent: progress.achievementPercent,
        remainingAmount: progress.remainingAmount,
        daysWithSales,
        averageDailySales,
        projectedTotal,
        projectedPercent,
        trend
      });
    }

    return results.sort((a, b) => b.achievementPercent - a.achievementPercent);
  }

  // Get performance alerts for targets not being met
  async getTargetAlerts(yearMonth: string): Promise<{
    branchId: string;
    branchName: string;
    targetAmount: number;
    achievedAmount: number;
    achievementPercent: number;
    daysRemaining: number;
    projectedAchievement: number;
    alertLevel: 'critical' | 'warning' | 'on_track' | 'exceeding';
    message: string;
  }[]> {
    const allBranches = await this.getAllBranches();
    const allTargets = await this.getAllBranchMonthlyTargets();
    const monthTargets = allTargets.filter(t => t.yearMonth === yearMonth);
    
    const [year, month] = yearMonth.split('-').map(Number);
    const today = new Date();
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    let daysPassed: number;
    let daysRemaining: number;
    
    if (today < monthStart) {
      // Future month - no days passed yet
      daysPassed = 0;
      daysRemaining = daysInMonth;
    } else if (today > monthEnd) {
      // Past month - all days passed
      daysPassed = daysInMonth;
      daysRemaining = 0;
    } else {
      // Current month
      daysPassed = today.getDate();
      daysRemaining = daysInMonth - daysPassed;
    }

    const alerts: {
      branchId: string;
      branchName: string;
      targetAmount: number;
      achievedAmount: number;
      achievementPercent: number;
      daysRemaining: number;
      projectedAchievement: number;
      alertLevel: 'critical' | 'warning' | 'on_track' | 'exceeding';
      message: string;
    }[] = [];

    for (const branch of allBranches) {
      const branchTarget = monthTargets.find(t => t.branchId === branch.id);
      if (!branchTarget) continue;

      const performance = await this.calculateBranchPerformance(branch.id, yearMonth);
      const dailyAverage = daysPassed > 0 ? performance.achievedAmount / daysPassed : 0;
      const projectedTotal = dailyAverage * daysInMonth;
      const projectedAchievement = branchTarget.targetAmount > 0 
        ? (projectedTotal / branchTarget.targetAmount) * 100 
        : 0;

      let alertLevel: 'critical' | 'warning' | 'on_track' | 'exceeding';
      let message: string;

      if (performance.achievementPercent >= 100) {
        alertLevel = 'exceeding';
        message = `تم تحقيق الهدف! نسبة التحقيق ${performance.achievementPercent.toFixed(1)}%`;
      } else if (projectedAchievement >= 90) {
        alertLevel = 'on_track';
        message = `على المسار الصحيح. التوقع: ${projectedAchievement.toFixed(1)}%`;
      } else if (projectedAchievement >= 70) {
        alertLevel = 'warning';
        message = `تحذير: التوقع ${projectedAchievement.toFixed(1)}% - يحتاج تحسين`;
      } else {
        alertLevel = 'critical';
        message = `تنبيه خطير: التوقع ${projectedAchievement.toFixed(1)}% - يتطلب تدخل عاجل`;
      }

      alerts.push({
        branchId: branch.id,
        branchName: branch.name,
        targetAmount: branchTarget.targetAmount,
        achievedAmount: performance.achievedAmount,
        achievementPercent: performance.achievementPercent,
        daysRemaining,
        projectedAchievement,
        alertLevel,
        message
      });
    }

    return alerts.sort((a, b) => a.achievementPercent - b.achievementPercent);
  }

  // ==========================================
  // Sales Analytics Methods
  // ==========================================

  // Get targets vs actuals analysis for a date range
  async getTargetsVsActuals(branchId: string | null, fromDate: string, toDate: string, status?: string, discrepancyType?: string): Promise<{
    date: string;
    branchId: string;
    branchName: string;
    targetAmount: number;
    actualSales: number;
    variance: number;
    achievementPercent: number;
    shiftBreakdown: { morning: number; evening: number; night: number };
    status: 'exceeding' | 'on_track' | 'warning' | 'critical';
  }[]> {
    const branches = await this.getAllBranches();
    const targetBranches = branchId ? branches.filter(b => b.id === branchId) : branches;
    const results: any[] = [];

    // Build status filter
    const statusFilter = status ? [status] : ['posted', 'approved'];
    
    for (const branch of targetBranches) {
      // Build where conditions
      const whereConditions: any[] = [
        eq(cashierSalesJournals.branchId, branch.id),
        gte(cashierSalesJournals.journalDate, fromDate),
        lte(cashierSalesJournals.journalDate, toDate),
        inArray(cashierSalesJournals.status, statusFilter)
      ];

      // Add discrepancy filter
      if (discrepancyType === 'shortage') {
        whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'shortage'));
      } else if (discrepancyType === 'surplus') {
        whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'surplus'));
      } else if (discrepancyType === 'balanced') {
        whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'balanced'));
      }

      // Get journals for the date range
      const journals = await db.select()
        .from(cashierSalesJournals)
        .where(and(...whereConditions));

      // Group by date
      const salesMap = new Map<string, {
        totalSales: number;
        morning: number;
        evening: number;
        night: number;
      }>();

      for (const j of journals) {
        const existing = salesMap.get(j.journalDate) || { totalSales: 0, morning: 0, evening: 0, night: 0 };
        existing.totalSales += j.totalSales || 0;
        if (j.shiftType === 'morning') existing.morning += j.totalSales || 0;
        else if (j.shiftType === 'evening') existing.evening += j.totalSales || 0;
        else if (j.shiftType === 'night') existing.night += j.totalSales || 0;
        salesMap.set(j.journalDate, existing);
      }

      // Get target allocations for date range
      const yearMonth = fromDate.substring(0, 7);
      const target = await db.select()
        .from(branchMonthlyTargets)
        .where(
          and(
            eq(branchMonthlyTargets.branchId, branch.id),
            eq(branchMonthlyTargets.yearMonth, yearMonth)
          )
        );

      const allocations = target.length > 0 
        ? await db.select().from(targetDailyAllocations)
            .where(
              and(
                eq(targetDailyAllocations.monthlyTargetId, target[0].id),
                gte(targetDailyAllocations.targetDate, fromDate),
                lte(targetDailyAllocations.targetDate, toDate)
              )
            )
        : [];

      // Build a set of all dates (from both allocations and sales)
      const allDates = new Set<string>();
      allocations.forEach(a => allDates.add(a.targetDate));
      Array.from(salesMap.keys()).forEach(date => allDates.add(date));

      // Build results for each date (including days with targets but no sales)
      Array.from(allDates).forEach(date => {
        const sales = salesMap.get(date) || { totalSales: 0, morning: 0, evening: 0, night: 0 };
        const allocation = allocations.find(a => a.targetDate === date);
        const targetAmount = allocation?.dailyTarget || 0;
        const variance = sales.totalSales - targetAmount;
        const achievementPercent = targetAmount > 0 ? (sales.totalSales / targetAmount) * 100 : (sales.totalSales > 0 ? 100 : 0);
        let status: 'exceeding' | 'on_track' | 'warning' | 'critical';
        
        if (achievementPercent >= 100) status = 'exceeding';
        else if (achievementPercent >= 80) status = 'on_track';
        else if (achievementPercent >= 60) status = 'warning';
        else status = 'critical';

        results.push({
          date,
          branchId: branch.id,
          branchName: branch.name,
          targetAmount,
          actualSales: sales.totalSales,
          variance,
          achievementPercent,
          shiftBreakdown: { morning: sales.morning, evening: sales.evening, night: sales.night },
          status
        });
      });
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Get shift performance analysis
  async getShiftAnalytics(branchId: string | null, fromDate: string, toDate: string, status?: string, discrepancyType?: string): Promise<{
    shiftType: string;
    shiftLabel: string;
    totalSales: number;
    averageSales: number;
    transactionsCount: number;
    averageTicket: number;
    journalCount: number;
    percentage: number;
  }[]> {
    const statusFilter = status ? [status] : ['posted', 'approved'];
    const whereConditions: any[] = [
      gte(cashierSalesJournals.journalDate, fromDate),
      lte(cashierSalesJournals.journalDate, toDate),
      inArray(cashierSalesJournals.status, statusFilter)
    ];
    
    if (branchId) {
      whereConditions.push(eq(cashierSalesJournals.branchId, branchId));
    }

    if (discrepancyType === 'shortage') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'shortage'));
    } else if (discrepancyType === 'surplus') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'surplus'));
    } else if (discrepancyType === 'balanced') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'balanced'));
    }

    const journals = await db.select()
      .from(cashierSalesJournals)
      .where(and(...whereConditions));

    const shiftStats = new Map<string, {
      totalSales: number;
      transactionsCount: number;
      journalCount: number;
      totalTickets: number;
    }>();

    const shiftLabels: Record<string, string> = {
      morning: 'صباحي',
      evening: 'مسائي',
      night: 'ليلي'
    };

    for (const j of journals) {
      const shift = j.shiftType || 'unknown';
      const existing = shiftStats.get(shift) || { totalSales: 0, transactionsCount: 0, journalCount: 0, totalTickets: 0 };
      existing.totalSales += j.totalSales || 0;
      existing.transactionsCount += j.transactionCount || 0;
      existing.journalCount += 1;
      existing.totalTickets += j.averageTicket || 0;
      shiftStats.set(shift, existing);
    }

    const grandTotal = Array.from(shiftStats.values()).reduce((sum, s) => sum + s.totalSales, 0);

    return Array.from(shiftStats.entries()).map(([shiftType, stats]) => ({
      shiftType,
      shiftLabel: shiftLabels[shiftType] || shiftType,
      totalSales: stats.totalSales,
      averageSales: stats.journalCount > 0 ? stats.totalSales / stats.journalCount : 0,
      transactionsCount: stats.transactionsCount,
      averageTicket: stats.journalCount > 0 ? stats.totalTickets / stats.journalCount : 0,
      journalCount: stats.journalCount,
      percentage: grandTotal > 0 ? (stats.totalSales / grandTotal) * 100 : 0
    })).sort((a, b) => b.totalSales - a.totalSales);
  }

  // Get cashier leaderboard
  async getCashierLeaderboard(branchId: string | null, fromDate: string, toDate: string, status?: string, discrepancyType?: string): Promise<{
    cashierId: string;
    cashierName: string;
    branchId: string;
    branchName: string;
    totalSales: number;
    journalCount: number;
    transactionsCount: number;
    averageTicket: number;
    averageDailySales: number;
    rank: number;
    contribution: number;
    shiftDistribution: { morning: number; evening: number; night: number };
  }[]> {
    const statusFilter = status ? [status] : ['posted', 'approved'];
    const whereConditions: any[] = [
      gte(cashierSalesJournals.journalDate, fromDate),
      lte(cashierSalesJournals.journalDate, toDate),
      inArray(cashierSalesJournals.status, statusFilter)
    ];
    
    if (branchId) {
      whereConditions.push(eq(cashierSalesJournals.branchId, branchId));
    }

    if (discrepancyType === 'shortage') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'shortage'));
    } else if (discrepancyType === 'surplus') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'surplus'));
    } else if (discrepancyType === 'balanced') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'balanced'));
    }

    const journals = await db.select()
      .from(cashierSalesJournals)
      .where(and(...whereConditions));

    const branches = await this.getAllBranches();
    const branchMap = new Map(branches.map(b => [b.id, b.name]));

    const cashierStats = new Map<string, {
      cashierName: string;
      branchId: string;
      totalSales: number;
      journalCount: number;
      transactionsCount: number;
      totalTickets: number;
      morning: number;
      evening: number;
      night: number;
      uniqueDates: Set<string>;
    }>();

    for (const j of journals) {
      const key = j.cashierId;
      const existing = cashierStats.get(key) || {
        cashierName: j.cashierName,
        branchId: j.branchId,
        totalSales: 0,
        journalCount: 0,
        transactionsCount: 0,
        totalTickets: 0,
        morning: 0,
        evening: 0,
        night: 0,
        uniqueDates: new Set<string>()
      };
      
      existing.totalSales += j.totalSales || 0;
      existing.journalCount += 1;
      existing.transactionsCount += j.transactionCount || 0;
      existing.totalTickets += j.averageTicket || 0;
      existing.uniqueDates.add(j.journalDate);
      
      if (j.shiftType === 'morning') existing.morning += j.totalSales || 0;
      else if (j.shiftType === 'evening') existing.evening += j.totalSales || 0;
      else if (j.shiftType === 'night') existing.night += j.totalSales || 0;
      
      cashierStats.set(key, existing);
    }

    const grandTotal = Array.from(cashierStats.values()).reduce((sum, s) => sum + s.totalSales, 0);

    const results = Array.from(cashierStats.entries()).map(([cashierId, stats]) => ({
      cashierId,
      cashierName: stats.cashierName,
      branchId: stats.branchId,
      branchName: branchMap.get(stats.branchId) || stats.branchId,
      totalSales: stats.totalSales,
      journalCount: stats.journalCount,
      transactionsCount: stats.transactionsCount,
      averageTicket: stats.journalCount > 0 ? stats.totalTickets / stats.journalCount : 0,
      averageDailySales: stats.uniqueDates.size > 0 ? stats.totalSales / stats.uniqueDates.size : 0,
      rank: 0,
      contribution: grandTotal > 0 ? (stats.totalSales / grandTotal) * 100 : 0,
      shiftDistribution: { morning: stats.morning, evening: stats.evening, night: stats.night }
    })).sort((a, b) => b.totalSales - a.totalSales);

    // Assign ranks
    results.forEach((r, idx) => { r.rank = idx + 1; });

    return results;
  }

  // Get average ticket analysis
  async getAverageTicketAnalysis(branchId: string | null, groupBy: 'shift' | 'cashier' | 'date', fromDate: string, toDate: string, status?: string, discrepancyType?: string): Promise<{
    group: string;
    groupLabel: string;
    averageTicket: number;
    transactionsCount: number;
    totalSales: number;
    journalCount: number;
  }[]> {
    const statusFilter = status ? [status] : ['posted', 'approved'];
    const whereConditions: any[] = [
      gte(cashierSalesJournals.journalDate, fromDate),
      lte(cashierSalesJournals.journalDate, toDate),
      inArray(cashierSalesJournals.status, statusFilter)
    ];
    
    if (branchId) {
      whereConditions.push(eq(cashierSalesJournals.branchId, branchId));
    }

    if (discrepancyType === 'shortage') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'shortage'));
    } else if (discrepancyType === 'surplus') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'surplus'));
    } else if (discrepancyType === 'balanced') {
      whereConditions.push(eq(cashierSalesJournals.discrepancyStatus, 'balanced'));
    }

    const journals = await db.select()
      .from(cashierSalesJournals)
      .where(and(...whereConditions));

    const shiftLabels: Record<string, string> = {
      morning: 'صباحي',
      evening: 'مسائي',
      night: 'ليلي'
    };

    const stats = new Map<string, {
      groupLabel: string;
      totalSales: number;
      transactionsCount: number;
      journalCount: number;
    }>();

    for (const j of journals) {
      let groupKey: string;
      let groupLabel: string;
      
      if (groupBy === 'shift') {
        groupKey = j.shiftType || 'unknown';
        groupLabel = shiftLabels[groupKey] || groupKey;
      } else if (groupBy === 'cashier') {
        groupKey = j.cashierId;
        groupLabel = j.cashierName;
      } else {
        groupKey = j.journalDate;
        groupLabel = j.journalDate;
      }

      const existing = stats.get(groupKey) || { groupLabel, totalSales: 0, transactionsCount: 0, journalCount: 0 };
      existing.totalSales += j.totalSales || 0;
      existing.transactionsCount += j.transactionCount || 0;
      existing.journalCount += 1;
      stats.set(groupKey, existing);
    }

    return Array.from(stats.entries()).map(([group, s]) => ({
      group,
      groupLabel: s.groupLabel,
      averageTicket: s.transactionsCount > 0 ? s.totalSales / s.transactionsCount : 0,
      transactionsCount: s.transactionsCount,
      totalSales: s.totalSales,
      journalCount: s.journalCount
    })).sort((a, b) => b.averageTicket - a.averageTicket);
  }

  // Compute and store daily branch sales summary
  async computeBranchDailySales(branchId: string, salesDate: string): Promise<BranchDailySales> {
    // Get all posted/approved journals for this branch/date
    const journals = await db.select()
      .from(cashierSalesJournals)
      .where(
        and(
          eq(cashierSalesJournals.branchId, branchId),
          eq(cashierSalesJournals.journalDate, salesDate),
          inArray(cashierSalesJournals.status, ['posted', 'approved'])
        )
      );

    // Calculate aggregates
    let totalSales = 0;
    let transactionsCount = 0;
    let morningShiftSales = 0;
    let eveningShiftSales = 0;
    let nightShiftSales = 0;
    const cashierIds = new Set<string>();
    const journalIds: number[] = [];

    for (const j of journals) {
      totalSales += j.totalSales || 0;
      transactionsCount += j.transactionCount || 0;
      cashierIds.add(j.cashierId);
      journalIds.push(j.id);
      
      if (j.shiftType === 'morning') morningShiftSales += j.totalSales || 0;
      else if (j.shiftType === 'evening') eveningShiftSales += j.totalSales || 0;
      else if (j.shiftType === 'night') nightShiftSales += j.totalSales || 0;
    }

    const averageTicket = transactionsCount > 0 ? totalSales / transactionsCount : 0;

    // Get target for this date
    const yearMonth = salesDate.substring(0, 7);
    const targets = await db.select()
      .from(branchMonthlyTargets)
      .where(
        and(
          eq(branchMonthlyTargets.branchId, branchId),
          eq(branchMonthlyTargets.yearMonth, yearMonth)
        )
      );

    let targetAmount = 0;
    if (targets.length > 0) {
      const allocations = await db.select()
        .from(targetDailyAllocations)
        .where(
          and(
            eq(targetDailyAllocations.monthlyTargetId, targets[0].id),
            eq(targetDailyAllocations.targetDate, salesDate)
          )
        );
      if (allocations.length > 0) {
        targetAmount = allocations[0].dailyTarget;
      }
    }

    const achievementAmount = totalSales - targetAmount;
    const achievementPercent = targetAmount > 0 ? (totalSales / targetAmount) * 100 : 0;

    // Check if record exists
    const existing = await db.select()
      .from(branchDailySales)
      .where(
        and(
          eq(branchDailySales.branchId, branchId),
          eq(branchDailySales.salesDate, salesDate)
        )
      );

    const data = {
      branchId,
      salesDate,
      totalSales,
      transactionsCount,
      averageTicket,
      cashierCount: cashierIds.size,
      targetAmount,
      achievementAmount,
      achievementPercent,
      morningShiftSales,
      eveningShiftSales,
      nightShiftSales,
      journalIds
    };

    if (existing.length > 0) {
      const [updated] = await db.update(branchDailySales)
        .set({ ...data, computedAt: new Date(), updatedAt: new Date() })
        .where(eq(branchDailySales.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(branchDailySales)
        .values(data)
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
