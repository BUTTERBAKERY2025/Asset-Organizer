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
  branches,
  inventoryItems,
  auditLogs,
  savedFilters,
  users
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
}

export const storage = new DatabaseStorage();
