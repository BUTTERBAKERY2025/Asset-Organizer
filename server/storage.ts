import { 
  type Branch, 
  type InsertBranch,
  type InventoryItem,
  type InsertInventoryItem,
  type AuditLog,
  type InsertAuditLog,
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
  branches,
  inventoryItems,
  auditLogs,
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
  assetTransferEvents
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
}

export const storage = new DatabaseStorage();
