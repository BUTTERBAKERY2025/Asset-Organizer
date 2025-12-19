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
  cashierSignatures
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
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
}

export const storage = new DatabaseStorage();
