import type { Express } from "express";
import { createServer, type Server } from "http";
import memoize from "memoizee";
import { storage } from "./storage";
import { 
  generateSalaryClosingPdf, type SalaryClosingPdfData,
  generateBranchComparisonPdf, type BranchComparisonPdfData,
  generateJobComparisonPdf, type JobComparisonPdfData,
  generateSalariesTablePdf, type SalaryTablePdfData,
  generateKPIsPdf, type KPIsPdfData,
  generateHealthCertificatesPdf, type HealthCertificatePdfData,
  generateComparisonsPdf, type ComparisonsPdfData,
  generateMarketingReportPdf, type MarketingReportPdfData,
  generateProductionReportPdf, type ProductionReportPdfData,
  generateProductionOrderPdf, type ProductionOrderPdfData
} from "./pdf-generator";
import { insertBranchSchema, insertInventoryItemSchema, insertSavedFilterSchema, insertUserSchema, insertConstructionProjectSchema, insertContractorSchema, insertProjectWorkItemSchema, insertProjectBudgetAllocationSchema, insertConstructionContractSchema, insertContractItemSchema, insertPaymentRequestSchema, insertContractPaymentSchema, insertUserPermissionSchema, insertProductSchema, insertShiftSchema, insertShiftEmployeeSchema, insertProductionOrderSchema, insertQualityCheckSchema, insertTargetWeightProfileSchema, insertBranchMonthlyTargetSchema, insertIncentiveTierSchema, insertIncentiveAwardSchema, SYSTEM_MODULES, MODULE_ACTIONS, JOB_ROLE_PERMISSION_TEMPLATES, JOB_TITLE_LABELS, MODULE_LABELS, ACTION_LABELS, JOB_TITLES, insertDisplayBarReceiptSchema, insertDisplayBarDailySummarySchema, insertWasteReportSchema, insertWasteItemSchema, insertMarketingCampaignSchema, insertCampaignBudgetAllocationSchema, insertCampaignGoalSchema, insertCampaignExpenseSchema, insertMarketingCalendarEventSchema, insertMarketingInfluencerSchema, insertInfluencerCampaignLinkSchema, insertInfluencerContactSchema, insertInfluencerPaymentSchema, insertMarketingTaskSchema, insertMarketingTaskActivitySchema, insertMarketingPerformanceReportSchema, insertMarketingAssetSchema, insertMarketingTeamMemberSchema, insertMarketingAlertSchema, insertScheduleTemplateSchema, insertSchedulePeriodSchema, insertEmployeeScheduleSchema, insertAttendanceRecordSchema, insertTimeEntrySchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated, requirePermission, requireAnyPermission, getActiveBranchFilter, requireBranchAccess, canAccessBranch } from "./auth";

// Normalize date to YYYY-MM-DD format
function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    // Parse the date and extract just the date part
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// Normalize inventory item data before storage
function normalizeInventoryData<T extends { nextInspectionDate?: string | null }>(data: T): T {
  if (data.nextInspectionDate !== undefined) {
    return {
      ...data,
      nextInspectionDate: normalizeDate(data.nextInspectionDate)
    };
  }
  return data;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Cached data fetchers
  const getCachedBranches = memoize(async () => {
    return await storage.getAllBranches();
  }, { promise: true, maxAge: 60000 }); // Cache for 1 minute

  const getCachedUsers = memoize(async () => {
    const users = await storage.getAllUsers();
    return users.map(({ password, ...user }) => user);
  }, { promise: true, maxAge: 30000 }); // Cache for 30 seconds

  // Add more caching for common data if needed
  const getCachedPermissions = memoize(async (userId: string) => {
    return await storage.getUserPermissions(userId);
  }, { promise: true, maxAge: 10000, length: 1 }); // Cache per-user permissions for 10s

  // Admin routes for user management
  app.get("/api/users", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const safeUsers = await getCachedUsers();
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAuthenticated, requirePermission("users", "create"), async (req, res) => {
    try {
      const { username, password, firstName, lastName, role } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "اسم المستخدم مسجل مسبقاً" });
      }
      
      const user = await storage.createUser({
        username,
        password,
        firstName,
        lastName,
        role: role || "viewer",
      });
      
      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const { firstName, lastName, role, password, branchId } = req.body;
      const updateData: any = {};
      
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (role !== undefined) {
        if (!["admin", "employee", "viewer"].includes(role)) {
          return res.status(400).json({ error: "Invalid role" });
        }
        updateData.role = role;
      }
      if (password) updateData.password = password;
      if (branchId !== undefined) updateData.branchId = branchId || null;
      
      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, requirePermission("users", "delete"), async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      if (currentUser.id === req.params.id) {
        return res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص" });
      }
      
      const success = await storage.deleteUser(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // User Permissions
  app.get("/api/users/:id/permissions", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const permissions = await storage.getUserPermissions(req.params.id);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.put("/api/users/:id/permissions", isAuthenticated, requirePermission("users", "edit"), async (req: any, res) => {
    try {
      const { permissions, templateApplied } = req.body;
      const currentUser = req.currentUser;
      
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: "Invalid permissions format" });
      }
      
      // Validate and filter permissions
      const validatedPermissions = permissions
        .filter((perm: any) => 
          perm.module && 
          Array.isArray(perm.actions) && 
          SYSTEM_MODULES.includes(perm.module)
        )
        .map((perm: any) => ({
          module: perm.module,
          actions: perm.actions.filter((a: string) => 
            MODULE_ACTIONS.includes(a as any)
          ),
        }))
        .filter((perm: any) => perm.actions.length > 0);
      
      // Use transactional update for atomicity
      const savedPermissions = await storage.updateUserPermissionsWithAudit(
        req.params.id,
        validatedPermissions,
        currentUser.id,
        templateApplied || null
      );
      
      res.json(savedPermissions);
    } catch (error) {
      console.error("Error updating user permissions:", error);
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

  // Permission Audit Logs
  app.get("/api/permission-audit-logs", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const logs = await storage.getPermissionAuditLogs(userId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching permission audit logs:", error);
      res.status(500).json({ error: "Failed to fetch permission audit logs" });
    }
  });

  app.get("/api/my-permissions", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      if (!currentUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Admins have all permissions
      if (currentUser.role === "admin") {
        const allPermissions = SYSTEM_MODULES.map(module => ({
          module,
          actions: [...MODULE_ACTIONS],
        }));
        return res.json(allPermissions);
      }
      
      const permissions = await storage.getUserPermissions(currentUser.id);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching my permissions:", error);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  // Branches
  app.get("/api/branches", async (req, res) => {
    try {
      const branches = await getCachedBranches();
      res.json(branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  app.get("/api/branches/:id", async (req, res) => {
    try {
      const branch = await storage.getBranch(req.params.id);
      if (!branch) {
        return res.status(404).json({ error: "Branch not found" });
      }
      res.json(branch);
    } catch (error) {
      console.error("Error fetching branch:", error);
      res.status(500).json({ error: "Failed to fetch branch" });
    }
  });

  app.post("/api/branches", isAuthenticated, requirePermission("inventory", "create"), async (req, res) => {
    try {
      const validatedData = insertBranchSchema.parse(req.body);
      const branch = await storage.createBranch(validatedData);
      res.status(201).json(branch);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating branch:", error);
      res.status(500).json({ error: "Failed to create branch" });
    }
  });

  // Inventory Items
  app.get("/api/inventory", isAuthenticated, requirePermission("inventory", "view"), async (req: any, res) => {
    try {
      // Get branch filter - prioritize query param, then use active branch from session
      const queryBranchId = req.query.branchId as string | undefined;
      const activeBranch = getActiveBranchFilter(req);
      const branchId = queryBranchId || activeBranch;
      
      // For non-admin users, always filter by their active branch
      const user = req.currentUser;
      if (user?.role !== "admin" && !branchId) {
        return res.json([]); // No branch = no data for regular users
      }
      
      // If branch specified, verify access
      if (branchId && user?.role !== "admin") {
        const hasAccess = await canAccessBranch(req, branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية للوصول لهذا الفرع" });
        }
      }
      
      const items = branchId 
        ? await storage.getInventoryItemsByBranch(branchId)
        : await storage.getAllInventoryItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
      res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  });

  app.get("/api/inventory/needs-inspection", isAuthenticated, requirePermission("inventory", "view"), async (req: any, res) => {
    try {
      const branchId = getActiveBranchFilter(req);
      const user = req.currentUser;
      
      let items = await storage.getItemsNeedingInspection();
      
      // Filter by branch for non-admin users
      if (user?.role !== "admin" && branchId) {
        items = items.filter(item => item.branchId === branchId);
      } else if (user?.role !== "admin" && !branchId) {
        return res.json([]);
      }
      
      res.json(items);
    } catch (error) {
      console.error("Error fetching items needing inspection:", error);
      res.status(500).json({ error: "Failed to fetch items needing inspection" });
    }
  });

  app.get("/api/inventory/low-quantity", isAuthenticated, requirePermission("inventory", "view"), async (req: any, res) => {
    try {
      const branchId = getActiveBranchFilter(req);
      const user = req.currentUser;
      
      let items = branchId 
        ? await storage.getInventoryItemsByBranch(branchId)
        : await storage.getAllInventoryItems();
      
      // For non-admin users without branch, return empty
      if (user?.role !== "admin" && !branchId) {
        return res.json([]);
      }
      
      const lowQuantityItems = items.filter(item => item.quantity <= 5);
      res.json(lowQuantityItems);
    } catch (error) {
      console.error("Error fetching low quantity items:", error);
      res.status(500).json({ error: "Failed to fetch low quantity items" });
    }
  });

  app.get("/api/inventory/maintenance-needed", isAuthenticated, requirePermission("inventory", "view"), async (req: any, res) => {
    try {
      const branchId = getActiveBranchFilter(req);
      const user = req.currentUser;
      
      let items = branchId 
        ? await storage.getInventoryItemsByBranch(branchId)
        : await storage.getAllInventoryItems();
      
      // For non-admin users without branch, return empty
      if (user?.role !== "admin" && !branchId) {
        return res.json([]);
      }
      
      const maintenanceItems = items.filter(item => 
        item.status === 'maintenance' || item.status === 'damaged'
      );
      res.json(maintenanceItems);
    } catch (error) {
      console.error("Error fetching maintenance items:", error);
      res.status(500).json({ error: "Failed to fetch maintenance items" });
    }
  });

  app.get("/api/inventory/:id", isAuthenticated, requirePermission("inventory", "view"), async (req: any, res) => {
    try {
      const item = await storage.getInventoryItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      // Verify branch access for non-admin users
      const user = req.currentUser;
      if (user?.role !== "admin" && item.branchId) {
        const hasAccess = await canAccessBranch(req, item.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية للوصول لهذا العنصر" });
        }
      }
      
      res.json(item);
    } catch (error) {
      console.error("Error fetching inventory item:", error);
      res.status(500).json({ error: "Failed to fetch inventory item" });
    }
  });

  app.get("/api/inventory/:id/audit-logs", isAuthenticated, requirePermission("inventory", "view"), async (req, res) => {
    try {
      const logs = await storage.getAuditLogsForItem(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.post("/api/inventory", isAuthenticated, requirePermission("inventory", "create"), requireBranchAccess, async (req: any, res) => {
    try {
      const validatedData = insertInventoryItemSchema.parse(req.body);
      const normalizedData = normalizeInventoryData(validatedData);
      
      // Verify user has access to the target branch
      const user = req.currentUser;
      if (user?.role !== "admin" && normalizedData.branchId) {
        const hasAccess = await canAccessBranch(req, normalizedData.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لإضافة عناصر لهذا الفرع" });
        }
      }
      
      const userId = req.currentUser.id;
      const item = await storage.createInventoryItem(normalizedData, userId);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating inventory item:", error);
      res.status(500).json({ error: "Failed to create inventory item" });
    }
  });

  app.patch("/api/inventory/:id", isAuthenticated, requirePermission("inventory", "edit"), async (req: any, res) => {
    try {
      // First check if user can access the existing item's branch
      const existingItem = await storage.getInventoryItem(req.params.id);
      if (!existingItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const user = req.currentUser;
      if (user?.role !== "admin" && existingItem.branchId) {
        const hasAccess = await canAccessBranch(req, existingItem.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لتعديل عناصر هذا الفرع" });
        }
      }
      
      const partialData = insertInventoryItemSchema.partial().parse(req.body);
      
      // If changing branch, verify access to new branch too
      if (partialData.branchId && partialData.branchId !== existingItem.branchId && user?.role !== "admin") {
        const hasNewBranchAccess = await canAccessBranch(req, partialData.branchId);
        if (!hasNewBranchAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لنقل العنصر لهذا الفرع" });
        }
      }
      
      const normalizedData = normalizeInventoryData(partialData);
      const userId = req.currentUser.id;
      const item = await storage.updateInventoryItem(req.params.id, normalizedData, userId);
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating inventory item:", error);
      res.status(500).json({ error: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/:id", isAuthenticated, requirePermission("inventory", "delete"), async (req: any, res) => {
    try {
      // Check if user can access the item's branch
      const existingItem = await storage.getInventoryItem(req.params.id);
      if (!existingItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const user = req.currentUser;
      if (user?.role !== "admin" && existingItem.branchId) {
        const hasAccess = await canAccessBranch(req, existingItem.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لحذف عناصر هذا الفرع" });
        }
      }
      
      const userId = req.currentUser.id;
      const success = await storage.deleteInventoryItem(req.params.id, userId);
      if (!success) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      res.status(500).json({ error: "Failed to delete inventory item" });
    }
  });

  // Saved Filters
  app.get("/api/filters", async (req, res) => {
    try {
      const filters = await storage.getAllSavedFilters();
      res.json(filters);
    } catch (error) {
      console.error("Error fetching saved filters:", error);
      res.status(500).json({ error: "Failed to fetch saved filters" });
    }
  });

  app.post("/api/filters", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertSavedFilterSchema.parse(req.body);
      const filter = await storage.createSavedFilter(validatedData);
      res.status(201).json(filter);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating saved filter:", error);
      res.status(500).json({ error: "Failed to create saved filter" });
    }
  });

  app.delete("/api/filters/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid filter ID" });
      }
      const success = await storage.deleteSavedFilter(id);
      if (!success) {
        return res.status(404).json({ error: "Filter not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting saved filter:", error);
      res.status(500).json({ error: "Failed to delete saved filter" });
    }
  });

  // Excel Import Route
  app.post("/api/inventory/import", isAuthenticated, requirePermission("inventory", "create"), async (req: any, res) => {
    try {
      const { items, branchId } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }
      
      if (!branchId) {
        return res.status(400).json({ error: "Branch ID is required" });
      }
      
      const userId = req.currentUser.id;
      const results = { success: 0, failed: 0, errors: [] as string[] };
      
      for (const item of items) {
        try {
          const itemData = {
            name: item.name || '',
            category: item.category || 'other',
            quantity: parseInt(item.quantity) || 1,
            unit: item.unit || 'قطعة',
            price: parseFloat(item.price) || 0,
            status: item.status || 'good',
            branchId: branchId,
            notes: item.notes || '',
          };
          
          const validatedData = insertInventoryItemSchema.parse(itemData);
          await storage.createInventoryItem(validatedData, userId);
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Row ${results.success + results.failed}: ${err.message || 'Unknown error'}`);
        }
      }
      
      res.json({ imported: results.success, failed: results.failed, errors: results.errors });
    } catch (error) {
      console.error("Error importing inventory:", error);
      res.status(500).json({ error: "Failed to import inventory" });
    }
  });

  // ===== Asset Transfers Routes =====

  // Get all asset transfers
  app.get("/api/asset-transfers", isAuthenticated, requirePermission("asset_transfers", "view"), async (req, res) => {
    try {
      const transfers = await storage.getAllAssetTransfers();
      res.json(transfers);
    } catch (error) {
      console.error("Error fetching asset transfers:", error);
      res.status(500).json({ error: "Failed to fetch asset transfers" });
    }
  });

  // Get transfers by item
  app.get("/api/asset-transfers/by-item/:itemId", isAuthenticated, requirePermission("asset_transfers", "view"), async (req, res) => {
    try {
      const transfers = await storage.getAssetTransfersByItem(req.params.itemId);
      res.json(transfers);
    } catch (error) {
      console.error("Error fetching item transfers:", error);
      res.status(500).json({ error: "Failed to fetch item transfers" });
    }
  });

  // Get single transfer
  app.get("/api/asset-transfers/:id", isAuthenticated, requirePermission("asset_transfers", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid transfer ID" });
      }
      const transfer = await storage.getAssetTransfer(id);
      if (!transfer) {
        return res.status(404).json({ error: "Transfer not found" });
      }
      res.json(transfer);
    } catch (error) {
      console.error("Error fetching transfer:", error);
      res.status(500).json({ error: "Failed to fetch transfer" });
    }
  });

  // Get transfer events
  app.get("/api/asset-transfers/:id/events", isAuthenticated, requirePermission("asset_transfers", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid transfer ID" });
      }
      const events = await storage.getAssetTransferEvents(id);
      res.json(events);
    } catch (error) {
      console.error("Error fetching transfer events:", error);
      res.status(500).json({ error: "Failed to fetch transfer events" });
    }
  });

  // Create new transfer
  app.post("/api/asset-transfers", isAuthenticated, requirePermission("asset_transfers", "create"), async (req, res) => {
    try {
      const { itemId, quantity, fromBranchId, toBranchId, reason, notes } = req.body;
      
      if (!itemId || !fromBranchId || !toBranchId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      if (fromBranchId === toBranchId) {
        return res.status(400).json({ error: "Cannot transfer to the same branch" });
      }
      
      const userId = req.currentUser!.id;
      const transfer = await storage.createAssetTransfer({
        itemId,
        quantity: quantity || 1,
        fromBranchId,
        toBranchId,
        reason,
        notes,
        transferNumber: '', // Will be generated by storage
      }, userId);
      
      res.status(201).json(transfer);
    } catch (error) {
      console.error("Error creating transfer:", error);
      res.status(500).json({ error: "Failed to create transfer" });
    }
  });

  // Approve transfer
  app.post("/api/asset-transfers/:id/approve", isAuthenticated, requirePermission("asset_transfers", "approve"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid transfer ID" });
      }
      
      const userId = req.currentUser!.id;
      const transfer = await storage.approveAssetTransfer(id, userId);
      
      if (!transfer) {
        return res.status(404).json({ error: "Transfer not found" });
      }
      
      res.json(transfer);
    } catch (error) {
      console.error("Error approving transfer:", error);
      res.status(500).json({ error: "Failed to approve transfer" });
    }
  });

  // Confirm receipt
  app.post("/api/asset-transfers/:id/confirm", isAuthenticated, requirePermission("asset_transfers", "approve"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid transfer ID" });
      }
      
      const { receiverName, signature } = req.body;
      
      if (!receiverName) {
        return res.status(400).json({ error: "Receiver name is required" });
      }
      
      const userId = req.currentUser!.id;
      const transfer = await storage.confirmAssetTransfer(id, userId, receiverName, signature);
      
      if (!transfer) {
        return res.status(404).json({ error: "Transfer not found" });
      }
      
      res.json(transfer);
    } catch (error) {
      console.error("Error confirming transfer:", error);
      res.status(500).json({ error: "Failed to confirm transfer" });
    }
  });

  // Cancel transfer
  app.post("/api/asset-transfers/:id/cancel", isAuthenticated, requirePermission("asset_transfers", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid transfer ID" });
      }
      
      const { reason } = req.body;
      const userId = req.currentUser!.id;
      const transfer = await storage.cancelAssetTransfer(id, userId, reason);
      
      if (!transfer) {
        return res.status(404).json({ error: "Transfer not found" });
      }
      
      res.json(transfer);
    } catch (error) {
      console.error("Error cancelling transfer:", error);
      res.status(500).json({ error: "Failed to cancel transfer" });
    }
  });

  // ===== Construction Project Management Routes =====

  // Construction Categories
  app.get("/api/construction/categories", async (req, res) => {
    try {
      const categories = await storage.getAllConstructionCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching construction categories:", error);
      res.status(500).json({ error: "Failed to fetch construction categories" });
    }
  });

  // Contractors
  app.get("/api/construction/contractors", isAuthenticated, requirePermission("contractors", "view"), async (req, res) => {
    try {
      const contractors = await storage.getAllContractors();
      res.json(contractors);
    } catch (error) {
      console.error("Error fetching contractors:", error);
      res.status(500).json({ error: "Failed to fetch contractors" });
    }
  });

  app.get("/api/construction/contractors/:id", isAuthenticated, requirePermission("contractors", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid contractor ID" });
      }
      const contractor = await storage.getContractor(id);
      if (!contractor) {
        return res.status(404).json({ error: "Contractor not found" });
      }
      res.json(contractor);
    } catch (error) {
      console.error("Error fetching contractor:", error);
      res.status(500).json({ error: "Failed to fetch contractor" });
    }
  });

  app.post("/api/construction/contractors", isAuthenticated, requirePermission("contractors", "create"), async (req, res) => {
    try {
      const validatedData = insertContractorSchema.parse(req.body);
      const contractor = await storage.createContractor(validatedData);
      res.status(201).json(contractor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating contractor:", error);
      res.status(500).json({ error: "Failed to create contractor" });
    }
  });

  app.patch("/api/construction/contractors/:id", isAuthenticated, requirePermission("contractors", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid contractor ID" });
      }
      const partialData = insertContractorSchema.partial().parse(req.body);
      const contractor = await storage.updateContractor(id, partialData);
      if (!contractor) {
        return res.status(404).json({ error: "Contractor not found" });
      }
      res.json(contractor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating contractor:", error);
      res.status(500).json({ error: "Failed to update contractor" });
    }
  });

  app.delete("/api/construction/contractors/:id", isAuthenticated, requirePermission("contractors", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid contractor ID" });
      }
      const success = await storage.deleteContractor(id);
      if (!success) {
        return res.status(404).json({ error: "Contractor not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contractor:", error);
      res.status(500).json({ error: "Failed to delete contractor" });
    }
  });

  // Construction Projects
  app.get("/api/construction/projects", isAuthenticated, requirePermission("construction_projects", "view"), async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const projects = branchId 
        ? await storage.getConstructionProjectsByBranch(branchId)
        : await storage.getAllConstructionProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching construction projects:", error);
      res.status(500).json({ error: "Failed to fetch construction projects" });
    }
  });

  app.get("/api/construction/projects/:id", isAuthenticated, requirePermission("construction_projects", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid project ID" });
      }
      const project = await storage.getConstructionProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/construction/projects", isAuthenticated, requirePermission("construction_projects", "create"), async (req, res) => {
    try {
      const validatedData = insertConstructionProjectSchema.parse(req.body);
      const project = await storage.createConstructionProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/construction/projects/:id", isAuthenticated, requirePermission("construction_projects", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid project ID" });
      }
      const partialData = insertConstructionProjectSchema.partial().parse(req.body);
      const project = await storage.updateConstructionProject(id, partialData);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating project:", error);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/construction/projects/:id", isAuthenticated, requirePermission("construction_projects", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid project ID" });
      }
      const success = await storage.deleteConstructionProject(id);
      if (!success) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Project Work Items
  app.get("/api/construction/work-items", isAuthenticated, requirePermission("construction_work_items", "view"), async (req, res) => {
    try {
      const items = await storage.getAllWorkItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching all work items:", error);
      res.status(500).json({ error: "Failed to fetch work items" });
    }
  });

  app.get("/api/construction/projects/:projectId/work-items", isAuthenticated, requirePermission("construction_work_items", "view"), async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Invalid project ID" });
      }
      const items = await storage.getWorkItemsByProject(projectId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching work items:", error);
      res.status(500).json({ error: "Failed to fetch work items" });
    }
  });

  app.get("/api/construction/work-items/:id", isAuthenticated, requirePermission("construction_work_items", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid work item ID" });
      }
      const item = await storage.getWorkItem(id);
      if (!item) {
        return res.status(404).json({ error: "Work item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching work item:", error);
      res.status(500).json({ error: "Failed to fetch work item" });
    }
  });

  app.post("/api/construction/work-items", isAuthenticated, requirePermission("construction_work_items", "create"), async (req, res) => {
    try {
      const validatedData = insertProjectWorkItemSchema.parse(req.body);
      const item = await storage.createWorkItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating work item:", error);
      res.status(500).json({ error: "Failed to create work item" });
    }
  });

  app.patch("/api/construction/work-items/:id", isAuthenticated, requirePermission("construction_work_items", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid work item ID" });
      }
      const partialData = insertProjectWorkItemSchema.partial().parse(req.body);
      const item = await storage.updateWorkItem(id, partialData);
      if (!item) {
        return res.status(404).json({ error: "Work item not found" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating work item:", error);
      res.status(500).json({ error: "Failed to update work item" });
    }
  });

  app.delete("/api/construction/work-items/:id", isAuthenticated, requirePermission("construction_work_items", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid work item ID" });
      }
      const success = await storage.deleteWorkItem(id);
      if (!success) {
        return res.status(404).json({ error: "Work item not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting work item:", error);
      res.status(500).json({ error: "Failed to delete work item" });
    }
  });

  // Budget Allocations
  app.get("/api/construction/projects/:projectId/budget-allocations", isAuthenticated, requirePermission("budget_planning", "view"), async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Invalid project ID" });
      }
      const allocations = await storage.getBudgetAllocationsByProject(projectId);
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching budget allocations:", error);
      res.status(500).json({ error: "Failed to fetch budget allocations" });
    }
  });

  app.post("/api/construction/budget-allocations", isAuthenticated, requirePermission("budget_planning", "create"), async (req, res) => {
    try {
      const validatedData = insertProjectBudgetAllocationSchema.parse(req.body);
      const allocation = await storage.createBudgetAllocation(validatedData);
      res.status(201).json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating budget allocation:", error);
      res.status(500).json({ error: "Failed to create budget allocation" });
    }
  });

  app.post("/api/construction/budget-allocations/upsert", isAuthenticated, requireAnyPermission("budget_planning", ["create", "edit"]), async (req, res) => {
    try {
      const validatedData = insertProjectBudgetAllocationSchema.parse(req.body);
      const allocation = await storage.upsertBudgetAllocation(validatedData);
      res.json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error upserting budget allocation:", error);
      res.status(500).json({ error: "Failed to upsert budget allocation" });
    }
  });

  app.get("/api/construction/budget-estimates/historical", isAuthenticated, requirePermission("budget_planning", "view"), async (req, res) => {
    try {
      const averages = await storage.getHistoricalCategoryAverages();
      res.json(averages);
    } catch (error) {
      console.error("Error fetching historical averages:", error);
      res.status(500).json({ error: "Failed to fetch historical averages" });
    }
  });

  app.post("/api/construction/budget-estimates/generate", isAuthenticated, requirePermission("budget_planning", "create"), async (req, res) => {
    try {
      const { totalBudget } = req.body;
      if (!totalBudget || totalBudget <= 0) {
        return res.status(400).json({ error: "Total budget is required and must be greater than 0" });
      }

      const averages = await storage.getHistoricalCategoryAverages();
      const categoriesWithData = averages.filter(a => a.avgCost > 0);
      
      if (categoriesWithData.length === 0) {
        const allCategories = averages;
        const equalShare = totalBudget / Math.max(allCategories.length, 1);
        const estimates = allCategories.map(cat => ({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          estimatedAmount: Math.round(equalShare),
          percentOfTotal: 100 / allCategories.length,
          basedOnProjects: 0,
          confidence: "low"
        }));
        return res.json({ estimates, totalBudget, hasHistoricalData: false });
      }

      const totalAvgCost = categoriesWithData.reduce((sum, c) => sum + c.avgCost, 0);
      
      const estimates = averages.map(cat => {
        let estimatedAmount = 0;
        let percentOfTotal = 0;
        let confidence = "low";

        if (cat.avgCost > 0) {
          percentOfTotal = (cat.avgCost / totalAvgCost) * 100;
          estimatedAmount = Math.round((percentOfTotal / 100) * totalBudget);
          confidence = cat.projectCount >= 3 ? "high" : cat.projectCount >= 1 ? "medium" : "low";
        }

        return {
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          estimatedAmount,
          percentOfTotal: Math.round(percentOfTotal * 10) / 10,
          basedOnProjects: cat.projectCount,
          avgHistoricalCost: Math.round(cat.avgCost),
          confidence
        };
      });

      res.json({ estimates, totalBudget, hasHistoricalData: true });
    } catch (error) {
      console.error("Error generating budget estimates:", error);
      res.status(500).json({ error: "Failed to generate budget estimates" });
    }
  });

  app.patch("/api/construction/budget-allocations/:id", isAuthenticated, requirePermission("budget_planning", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid allocation ID" });
      }
      const partialData = insertProjectBudgetAllocationSchema.partial().parse(req.body);
      const allocation = await storage.updateBudgetAllocation(id, partialData);
      if (!allocation) {
        return res.status(404).json({ error: "Budget allocation not found" });
      }
      res.json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating budget allocation:", error);
      res.status(500).json({ error: "Failed to update budget allocation" });
    }
  });

  app.delete("/api/construction/budget-allocations/:id", isAuthenticated, requirePermission("budget_planning", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid allocation ID" });
      }
      const success = await storage.deleteBudgetAllocation(id);
      if (!success) {
        return res.status(404).json({ error: "Budget allocation not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting budget allocation:", error);
      res.status(500).json({ error: "Failed to delete budget allocation" });
    }
  });

  // ===== Construction Contracts Routes =====
  
  app.get("/api/construction/contracts", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;
      const contracts = projectId 
        ? await storage.getContractsByProject(parseInt(projectId, 10))
        : await storage.getAllContracts();
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ error: "Failed to fetch contracts" });
    }
  });

  app.get("/api/construction/contracts/:id", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid contract ID" });
      }
      const contract = await storage.getContract(id);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ error: "Failed to fetch contract" });
    }
  });

  app.post("/api/construction/contracts", isAuthenticated, requirePermission("contracts", "create"), async (req: any, res) => {
    try {
      const validatedData = insertConstructionContractSchema.parse({
        ...req.body,
        createdBy: req.currentUser?.id
      });
      const contract = await storage.createContract(validatedData);
      res.status(201).json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating contract:", error);
      res.status(500).json({ error: "Failed to create contract" });
    }
  });

  app.patch("/api/construction/contracts/:id", isAuthenticated, requirePermission("contracts", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid contract ID" });
      }
      const partialData = insertConstructionContractSchema.partial().parse(req.body);
      const contract = await storage.updateContract(id, partialData);
      if (!contract) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating contract:", error);
      res.status(500).json({ error: "Failed to update contract" });
    }
  });

  app.delete("/api/construction/contracts/:id", isAuthenticated, requirePermission("contracts", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid contract ID" });
      }
      const success = await storage.deleteContract(id);
      if (!success) {
        return res.status(404).json({ error: "Contract not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contract:", error);
      res.status(500).json({ error: "Failed to delete contract" });
    }
  });

  // Contract Items
  app.get("/api/construction/contracts/:contractId/items", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const contractId = parseInt(req.params.contractId, 10);
      if (isNaN(contractId)) {
        return res.status(400).json({ error: "Invalid contract ID" });
      }
      const items = await storage.getContractItems(contractId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching contract items:", error);
      res.status(500).json({ error: "Failed to fetch contract items" });
    }
  });

  app.post("/api/construction/contract-items", isAuthenticated, requirePermission("contracts", "create"), async (req, res) => {
    try {
      const validatedData = insertContractItemSchema.parse(req.body);
      const item = await storage.createContractItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating contract item:", error);
      res.status(500).json({ error: "Failed to create contract item" });
    }
  });

  app.patch("/api/construction/contract-items/:id", isAuthenticated, requirePermission("contracts", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid contract item ID" });
      }
      const partialData = insertContractItemSchema.partial().parse(req.body);
      const item = await storage.updateContractItem(id, partialData);
      if (!item) {
        return res.status(404).json({ error: "Contract item not found" });
      }
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating contract item:", error);
      res.status(500).json({ error: "Failed to update contract item" });
    }
  });

  app.delete("/api/construction/contract-items/:id", isAuthenticated, requirePermission("contracts", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid contract item ID" });
      }
      const success = await storage.deleteContractItem(id);
      if (!success) {
        return res.status(404).json({ error: "Contract item not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contract item:", error);
      res.status(500).json({ error: "Failed to delete contract item" });
    }
  });

  // Contract Payments
  app.get("/api/construction/contracts/:contractId/payments", isAuthenticated, requirePermission("contracts", "view"), async (req, res) => {
    try {
      const contractId = parseInt(req.params.contractId, 10);
      if (isNaN(contractId)) {
        return res.status(400).json({ error: "Invalid contract ID" });
      }
      const payments = await storage.getContractPayments(contractId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching contract payments:", error);
      res.status(500).json({ error: "Failed to fetch contract payments" });
    }
  });

  app.post("/api/construction/contract-payments", isAuthenticated, requirePermission("contracts", "create"), async (req: any, res) => {
    try {
      const validatedData = insertContractPaymentSchema.parse({
        ...req.body,
        createdBy: req.currentUser?.id
      });
      const payment = await storage.createContractPayment(validatedData);
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating contract payment:", error);
      res.status(500).json({ error: "Failed to create contract payment" });
    }
  });

  // ===== Payment Requests Routes =====
  
  app.get("/api/payment-requests", isAuthenticated, requirePermission("payment_requests", "view"), async (req, res) => {
    try {
      const { projectId, status } = req.query;
      let requests;
      if (projectId) {
        requests = await storage.getPaymentRequestsByProject(parseInt(projectId as string, 10));
      } else if (status) {
        requests = await storage.getPaymentRequestsByStatus(status as string);
      } else {
        requests = await storage.getAllPaymentRequests();
      }
      res.json(requests);
    } catch (error) {
      console.error("Error fetching payment requests:", error);
      res.status(500).json({ error: "Failed to fetch payment requests" });
    }
  });

  app.get("/api/payment-requests/:id", isAuthenticated, requirePermission("payment_requests", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }
      const request = await storage.getPaymentRequest(id);
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error fetching payment request:", error);
      res.status(500).json({ error: "Failed to fetch payment request" });
    }
  });

  app.post("/api/payment-requests", isAuthenticated, requirePermission("payment_requests", "create"), async (req: any, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const validatedData = insertPaymentRequestSchema.parse({
        ...req.body,
        requestedBy: req.currentUser?.id,
        requestDate: req.body.requestDate || today
      });
      const request = await storage.createPaymentRequest(validatedData);
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating payment request:", error);
      res.status(500).json({ error: "Failed to create payment request" });
    }
  });

  app.patch("/api/payment-requests/:id", isAuthenticated, requirePermission("payment_requests", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }
      const partialData = insertPaymentRequestSchema.partial().parse(req.body);
      const request = await storage.updatePaymentRequest(id, partialData);
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      res.json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating payment request:", error);
      res.status(500).json({ error: "Failed to update payment request" });
    }
  });

  app.post("/api/payment-requests/:id/approve", isAuthenticated, requirePermission("payment_requests", "approve"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }
      const request = await storage.approvePaymentRequest(id, req.currentUser?.id);
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error approving payment request:", error);
      res.status(500).json({ error: "Failed to approve payment request" });
    }
  });

  app.post("/api/payment-requests/:id/reject", isAuthenticated, requirePermission("payment_requests", "approve"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ error: "Rejection reason is required" });
      }
      const request = await storage.rejectPaymentRequest(id, reason);
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error rejecting payment request:", error);
      res.status(500).json({ error: "Failed to reject payment request" });
    }
  });

  app.post("/api/payment-requests/:id/mark-paid", isAuthenticated, requirePermission("payment_requests", "approve"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }
      const request = await storage.markPaymentRequestAsPaid(id);
      if (!request) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error marking payment request as paid:", error);
      res.status(500).json({ error: "Failed to mark payment request as paid" });
    }
  });

  app.delete("/api/payment-requests/:id", isAuthenticated, requirePermission("payment_requests", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid request ID" });
      }
      const success = await storage.deletePaymentRequest(id);
      if (!success) {
        return res.status(404).json({ error: "Payment request not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payment request:", error);
      res.status(500).json({ error: "Failed to delete payment request" });
    }
  });

  // System Audit Logs
  app.get("/api/system-audit-logs", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 500;
      const logs = await storage.getAllSystemAuditLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching system audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/system-audit-logs/module/:module", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const logs = await storage.getSystemAuditLogsByModule(req.params.module);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs by module:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/system-audit-logs/search", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      const logs = await storage.searchSystemAuditLogs(query);
      res.json(logs);
    } catch (error) {
      console.error("Error searching audit logs:", error);
      res.status(500).json({ error: "Failed to search audit logs" });
    }
  });

  // Backups
  app.get("/api/backups", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const backups = await storage.getAllBackups();
      res.json(backups);
    } catch (error) {
      console.error("Error fetching backups:", error);
      res.status(500).json({ error: "Failed to fetch backups" });
    }
  });

  app.post("/api/backups", isAuthenticated, requirePermission("users", "edit"), async (req: any, res) => {
    try {
      const { name, type } = req.body;
      const backup = await storage.createBackup({
        name: name || `نسخة احتياطية - ${new Date().toLocaleDateString('ar-SA')}`,
        type: type || 'manual',
        status: 'completed',
        createdBy: req.currentUser?.id,
        tables: JSON.stringify(['inventory_items', 'branches', 'construction_projects', 'contractors', 'asset_transfers']),
        completedAt: new Date(),
      });
      res.status(201).json(backup);
    } catch (error) {
      console.error("Error creating backup:", error);
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  app.delete("/api/backups/:id", isAuthenticated, requirePermission("users", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid backup ID" });
      }
      const success = await storage.deleteBackup(id);
      if (!success) {
        return res.status(404).json({ error: "Backup not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting backup:", error);
      res.status(500).json({ error: "Failed to delete backup" });
    }
  });

  // Global Search
  app.get("/api/search", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.status(400).json({ error: "Search query must be at least 2 characters" });
      }
      const results = await storage.globalSearch(query);
      res.json(results);
    } catch (error) {
      console.error("Error performing global search:", error);
      res.status(500).json({ error: "Failed to perform search" });
    }
  });

  // External Integrations
  app.get("/api/integrations", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const integrations = await storage.getAllExternalIntegrations();
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ error: "Failed to fetch integrations" });
    }
  });

  app.post("/api/integrations", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const integration = await storage.createExternalIntegration(req.body);
      res.status(201).json(integration);
    } catch (error) {
      console.error("Error creating integration:", error);
      res.status(500).json({ error: "Failed to create integration" });
    }
  });

  app.patch("/api/integrations/:id", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const integration = await storage.updateExternalIntegration(id, req.body);
      if (!integration) {
        return res.status(404).json({ error: "Integration not found" });
      }
      res.json(integration);
    } catch (error) {
      console.error("Error updating integration:", error);
      res.status(500).json({ error: "Failed to update integration" });
    }
  });

  app.delete("/api/integrations/:id", isAuthenticated, requirePermission("users", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const success = await storage.deleteExternalIntegration(id);
      if (!success) {
        return res.status(404).json({ error: "Integration not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ error: "Failed to delete integration" });
    }
  });

  // Notification Templates
  app.get("/api/notification-templates", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const templates = await storage.getAllNotificationTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching notification templates:", error);
      res.status(500).json({ error: "Failed to fetch notification templates" });
    }
  });

  app.post("/api/notification-templates", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const template = await storage.createNotificationTemplate(req.body);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating notification template:", error);
      res.status(500).json({ error: "Failed to create notification template" });
    }
  });

  app.patch("/api/notification-templates/:id", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const template = await storage.updateNotificationTemplate(id, req.body);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error updating notification template:", error);
      res.status(500).json({ error: "Failed to update notification template" });
    }
  });

  app.delete("/api/notification-templates/:id", isAuthenticated, requirePermission("users", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const success = await storage.deleteNotificationTemplate(id);
      if (!success) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting notification template:", error);
      res.status(500).json({ error: "Failed to delete notification template" });
    }
  });

  // Notification Queue
  app.get("/api/notifications", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const notifications = await storage.getAllNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications/send", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const { recipientPhone, recipientName, channel, message, relatedModule, relatedEntityId } = req.body;
      
      // Create notification in queue
      const notification = await storage.createNotification({
        recipientPhone,
        recipientName,
        channel,
        message,
        status: 'pending',
        relatedModule,
        relatedEntityId,
      });

      // Check for Twilio credentials
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

      if (twilioSid && twilioToken && twilioPhone && channel === 'sms') {
        // TODO: Implement actual Twilio SMS sending when credentials are available
        // For now, mark as pending - requires Twilio setup
        await storage.updateNotificationStatus(notification.id, 'pending', 'Twilio غير مكوّن - الرسالة في قائمة الانتظار');
      } else {
        await storage.updateNotificationStatus(notification.id, 'pending', 'في انتظار إعداد خدمة الإرسال');
      }

      res.status(201).json(notification);
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Data Import Jobs
  app.get("/api/import-jobs", isAuthenticated, requirePermission("inventory", "view"), async (req, res) => {
    try {
      const jobs = await storage.getAllDataImportJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching import jobs:", error);
      res.status(500).json({ error: "Failed to fetch import jobs" });
    }
  });

  app.post("/api/import-jobs", isAuthenticated, requirePermission("inventory", "edit"), async (req: any, res) => {
    try {
      const { sourceSystem, targetModule, fileName, totalRecords } = req.body;
      const job = await storage.createDataImportJob({
        sourceSystem,
        targetModule,
        fileName,
        status: 'pending',
        totalRecords: totalRecords || 0,
        processedRecords: 0,
        failedRecords: 0,
        importedBy: req.user?.id || null,
      });
      res.status(201).json(job);
    } catch (error) {
      console.error("Error creating import job:", error);
      res.status(500).json({ error: "Failed to create import job" });
    }
  });

  // Accounting Exports
  app.get("/api/accounting-exports", isAuthenticated, requirePermission("inventory", "view"), async (req, res) => {
    try {
      const exports = await storage.getAllAccountingExports();
      res.json(exports);
    } catch (error) {
      console.error("Error fetching accounting exports:", error);
      res.status(500).json({ error: "Failed to fetch accounting exports" });
    }
  });

  app.post("/api/accounting-exports/inventory-valuation", isAuthenticated, requirePermission("inventory", "view"), async (req: any, res) => {
    try {
      const { branchId } = req.body;
      const data = await storage.generateInventoryValuation(branchId);
      
      const exportRecord = await storage.createAccountingExport({
        exportType: 'inventory_valuation',
        branchId: branchId || null,
        data,
        status: 'completed',
        exportedBy: req.user?.id || null,
      });
      
      res.json({ export: exportRecord, data });
    } catch (error) {
      console.error("Error generating inventory valuation:", error);
      res.status(500).json({ error: "Failed to generate inventory valuation" });
    }
  });

  app.post("/api/accounting-exports/asset-movements", isAuthenticated, requirePermission("transfers", "view"), async (req: any, res) => {
    try {
      const { dateFrom, dateTo } = req.body;
      const data = await storage.generateAssetMovementsReport(dateFrom, dateTo);
      
      const exportRecord = await storage.createAccountingExport({
        exportType: 'asset_movements',
        dateFrom,
        dateTo,
        data,
        status: 'completed',
        exportedBy: req.user?.id || null,
      });
      
      res.json({ export: exportRecord, data });
    } catch (error) {
      console.error("Error generating asset movements report:", error);
      res.status(500).json({ error: "Failed to generate asset movements report" });
    }
  });

  app.post("/api/accounting-exports/project-costs", isAuthenticated, requirePermission("projects", "view"), async (req: any, res) => {
    try {
      const { projectId } = req.body;
      const data = await storage.generateProjectCostsReport(projectId);
      
      const exportRecord = await storage.createAccountingExport({
        exportType: 'project_costs',
        data,
        status: 'completed',
        exportedBy: req.user?.id || null,
      });
      
      res.json({ export: exportRecord, data });
    } catch (error) {
      console.error("Error generating project costs report:", error);
      res.status(500).json({ error: "Failed to generate project costs report" });
    }
  });

  app.patch("/api/accounting-exports/:id/sync", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const exportRecord = await storage.updateAccountingExport(id, {
        status: 'synced',
        syncedAt: new Date(),
      });
      if (!exportRecord) {
        return res.status(404).json({ error: "Export not found" });
      }
      res.json(exportRecord);
    } catch (error) {
      console.error("Error syncing accounting export:", error);
      res.status(500).json({ error: "Failed to sync accounting export" });
    }
  });

  // ============================================
  // نظام التشغيل - Operations Module Routes
  // ============================================

  // Products Routes
  app.get("/api/products", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", isAuthenticated, requirePermission("operations", "create"), async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const product = await storage.updateProduct(id, req.body);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, requirePermission("operations", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const deleted = await storage.deleteProduct(id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Shifts Routes
  app.get("/api/shifts", isAuthenticated, requirePermission("shifts", "view"), async (req, res) => {
    try {
      const { branchId, date } = req.query;
      let shifts;
      if (branchId) {
        shifts = await storage.getShiftsByBranch(branchId as string);
      } else if (date) {
        shifts = await storage.getShiftsByDate(date as string);
      } else {
        shifts = await storage.getAllShifts();
      }
      res.json(shifts);
    } catch (error) {
      console.error("Error fetching shifts:", error);
      res.status(500).json({ error: "Failed to fetch shifts" });
    }
  });

  app.get("/api/shifts/:id", isAuthenticated, requirePermission("shifts", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const shift = await storage.getShift(id);
      if (!shift) {
        return res.status(404).json({ error: "Shift not found" });
      }
      res.json(shift);
    } catch (error) {
      console.error("Error fetching shift:", error);
      res.status(500).json({ error: "Failed to fetch shift" });
    }
  });

  app.post("/api/shifts", isAuthenticated, requirePermission("shifts", "create"), async (req: any, res) => {
    try {
      const validatedData = insertShiftSchema.parse({
        ...req.body,
        createdBy: req.user?.id,
      });
      const shift = await storage.createShift(validatedData);
      res.status(201).json(shift);
    } catch (error) {
      console.error("Error creating shift:", error);
      res.status(500).json({ error: "Failed to create shift" });
    }
  });

  app.patch("/api/shifts/:id", isAuthenticated, requirePermission("shifts", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const shift = await storage.updateShift(id, req.body);
      if (!shift) {
        return res.status(404).json({ error: "Shift not found" });
      }
      res.json(shift);
    } catch (error) {
      console.error("Error updating shift:", error);
      res.status(500).json({ error: "Failed to update shift" });
    }
  });

  app.delete("/api/shifts/:id", isAuthenticated, requirePermission("shifts", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const deleted = await storage.deleteShift(id);
      if (!deleted) {
        return res.status(404).json({ error: "Shift not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting shift:", error);
      res.status(500).json({ error: "Failed to delete shift" });
    }
  });

  // Shift Employees Routes
  app.get("/api/shifts/:shiftId/employees", isAuthenticated, requirePermission("shifts", "view"), async (req, res) => {
    try {
      const shiftId = parseInt(req.params.shiftId, 10);
      const employees = await storage.getShiftEmployees(shiftId);
      res.json(employees);
    } catch (error) {
      console.error("Error fetching shift employees:", error);
      res.status(500).json({ error: "Failed to fetch shift employees" });
    }
  });

  app.post("/api/shifts/:shiftId/employees", isAuthenticated, requirePermission("shifts", "create"), async (req, res) => {
    try {
      const shiftId = parseInt(req.params.shiftId, 10);
      const validatedData = insertShiftEmployeeSchema.parse({
        ...req.body,
        shiftId,
      });
      const employee = await storage.createShiftEmployee(validatedData);
      res.status(201).json(employee);
    } catch (error) {
      console.error("Error adding shift employee:", error);
      res.status(500).json({ error: "Failed to add shift employee" });
    }
  });

  app.patch("/api/shift-employees/:id", isAuthenticated, requirePermission("shifts", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const employee = await storage.updateShiftEmployee(id, req.body);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Error updating shift employee:", error);
      res.status(500).json({ error: "Failed to update shift employee" });
    }
  });

  app.delete("/api/shift-employees/:id", isAuthenticated, requirePermission("shifts", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const deleted = await storage.deleteShiftEmployee(id);
      if (!deleted) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting shift employee:", error);
      res.status(500).json({ error: "Failed to delete shift employee" });
    }
  });

  // Production Orders Routes
  app.get("/api/production-orders", isAuthenticated, requirePermission("production", "view"), async (req: any, res) => {
    try {
      const { branchId, date } = req.query;
      const activeBranch = getActiveBranchFilter(req);
      const user = req.currentUser;
      
      // Determine branch to filter by
      const filterBranchId = branchId as string || activeBranch;
      
      // For non-admin users, must have a branch filter
      if (user?.role !== "admin" && !filterBranchId) {
        return res.json([]);
      }
      
      // Verify branch access for non-admin users
      if (user?.role !== "admin" && filterBranchId) {
        const hasAccess = await canAccessBranch(req, filterBranchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية للوصول لهذا الفرع" });
        }
      }
      
      let orders;
      if (filterBranchId) {
        orders = await storage.getProductionOrdersByBranch(filterBranchId);
        if (date) {
          orders = orders.filter((o: any) => o.productionDate === date);
        }
      } else if (date) {
        orders = await storage.getProductionOrdersByDate(date as string);
      } else {
        orders = await storage.getAllProductionOrders();
      }
      res.json(orders);
    } catch (error) {
      console.error("Error fetching production orders:", error);
      res.status(500).json({ error: "Failed to fetch production orders" });
    }
  });

  app.get("/api/production-orders/:id", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const order = await storage.getProductionOrder(id);
      if (!order) {
        return res.status(404).json({ error: "Production order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error fetching production order:", error);
      res.status(500).json({ error: "Failed to fetch production order" });
    }
  });

  app.post("/api/production-orders", isAuthenticated, requirePermission("production", "create"), requireBranchAccess, async (req: any, res) => {
    try {
      // Verify user has access to the target branch
      const user = req.currentUser;
      if (user?.role !== "admin" && req.body.branchId) {
        const hasAccess = await canAccessBranch(req, req.body.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لإنشاء أمر إنتاج لهذا الفرع" });
        }
      }
      
      const validatedData = insertProductionOrderSchema.parse({
        ...req.body,
        createdBy: req.user?.id,
      });
      const order = await storage.createProductionOrder(validatedData);
      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating production order:", error);
      res.status(500).json({ error: "Failed to create production order" });
    }
  });

  app.patch("/api/production-orders/:id", isAuthenticated, requirePermission("production", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const order = await storage.updateProductionOrder(id, req.body);
      if (!order) {
        return res.status(404).json({ error: "Production order not found" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error updating production order:", error);
      res.status(500).json({ error: "Failed to update production order" });
    }
  });

  app.delete("/api/production-orders/:id", isAuthenticated, requirePermission("production", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const deleted = await storage.deleteProductionOrder(id);
      if (!deleted) {
        return res.status(404).json({ error: "Production order not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting production order:", error);
      res.status(500).json({ error: "Failed to delete production order" });
    }
  });

  // Quality Checks Routes
  app.get("/api/quality-checks", isAuthenticated, requirePermission("quality_control", "view"), async (req, res) => {
    try {
      const { branchId, date } = req.query;
      let checks;
      if (branchId) {
        checks = await storage.getQualityChecksByBranch(branchId as string);
      } else if (date) {
        checks = await storage.getQualityChecksByDate(date as string);
      } else {
        checks = await storage.getAllQualityChecks();
      }
      res.json(checks);
    } catch (error) {
      console.error("Error fetching quality checks:", error);
      res.status(500).json({ error: "Failed to fetch quality checks" });
    }
  });

  app.get("/api/quality-checks/:id", isAuthenticated, requirePermission("quality_control", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const check = await storage.getQualityCheck(id);
      if (!check) {
        return res.status(404).json({ error: "Quality check not found" });
      }
      res.json(check);
    } catch (error) {
      console.error("Error fetching quality check:", error);
      res.status(500).json({ error: "Failed to fetch quality check" });
    }
  });

  app.post("/api/quality-checks", isAuthenticated, requirePermission("quality_control", "create"), async (req, res) => {
    try {
      const validatedData = insertQualityCheckSchema.parse(req.body);
      const check = await storage.createQualityCheck(validatedData);
      res.status(201).json(check);
    } catch (error) {
      console.error("Error creating quality check:", error);
      res.status(500).json({ error: "Failed to create quality check" });
    }
  });

  // Operations Dashboard Stats
  app.get("/api/operations/stats", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [products, shifts, orders, qualityChecks] = await Promise.all([
        storage.getAllProducts(),
        storage.getShiftsByDate(today),
        storage.getProductionOrdersByDate(today),
        storage.getQualityChecksByDate(today),
      ]);

      const totalProduced = orders.reduce((sum, o) => sum + (o.producedQuantity || 0), 0);
      const totalWasted = orders.reduce((sum, o) => sum + (o.wastedQuantity || 0), 0);
      const completedOrders = orders.filter(o => o.status === 'completed').length;
      const passedChecks = qualityChecks.filter(c => c.result === 'passed').length;

      res.json({
        productsCount: products.filter(p => p.isActive === 'true').length,
        todayShifts: shifts.length,
        todayOrders: orders.length,
        completedOrders,
        totalProduced,
        totalWasted,
        wastePercentage: totalProduced > 0 ? ((totalWasted / totalProduced) * 100).toFixed(1) : 0,
        qualityChecks: qualityChecks.length,
        qualityPassRate: qualityChecks.length > 0 ? ((passedChecks / qualityChecks.length) * 100).toFixed(1) : 100,
      });
    } catch (error) {
      console.error("Error fetching operations stats:", error);
      res.status(500).json({ error: "Failed to fetch operations stats" });
    }
  });

  // ==================== Operations Employees Routes ====================
  
  // Get all operations employees (users with branchId or jobTitle)
  app.get("/api/operations-employees", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const employees = users
        .filter(u => u.role === "employee" || u.branchId || u.jobTitle)
        .map(({ password, ...user }) => user);
      res.json(employees);
    } catch (error) {
      console.error("Error fetching operations employees:", error);
      res.status(500).json({ error: "Failed to fetch operations employees" });
    }
  });

  // Create operations employee
  app.post("/api/operations-employees", isAuthenticated, requirePermission("operations", "create"), async (req, res) => {
    try {
      const { username, password, firstName, lastName, phone, email, branchId, jobTitle, role } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      }
      
      if (!branchId) {
        return res.status(400).json({ error: "يرجى اختيار الفرع" });
      }
      
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "اسم المستخدم مسجل مسبقاً" });
      }
      
      const user = await storage.createUser({
        username,
        password,
        firstName,
        lastName,
        phone,
        email,
        branchId,
        jobTitle,
        role: role || "employee",
        isActive: "active",
      });
      
      // Apply job role permissions automatically based on job title
      if (jobTitle && req.currentUser && JOB_TITLES.includes(jobTitle as typeof JOB_TITLES[number])) {
        await storage.applyJobRolePermissions(user.id, jobTitle, req.currentUser.id);
      }
      
      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Error creating operations employee:", error);
      res.status(500).json({ error: "Failed to create operations employee" });
    }
  });

  // Update operations employee
  app.patch("/api/operations-employees/:id", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      const { firstName, lastName, phone, email, branchId, jobTitle, isActive, password } = req.body;
      const updateData: any = {};
      
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (branchId !== undefined) updateData.branchId = branchId;
      if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (password) updateData.password = password;
      
      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      // Apply job role permissions automatically if job title changed
      if (jobTitle !== undefined && req.currentUser && JOB_TITLES.includes(jobTitle as typeof JOB_TITLES[number])) {
        await storage.applyJobRolePermissions(req.params.id, jobTitle, req.currentUser.id);
      }
      
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating operations employee:", error);
      res.status(500).json({ error: "Failed to update operations employee" });
    }
  });

  // Delete operations employee
  app.delete("/api/operations-employees/:id", isAuthenticated, requirePermission("operations", "delete"), async (req, res) => {
    try {
      const success = await storage.deleteUser(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting operations employee:", error);
      res.status(500).json({ error: "Failed to delete operations employee" });
    }
  });

  // ==================== Job Role Permissions Routes ====================

  // Get job role permission templates
  app.get("/api/job-role-permissions", isAuthenticated, async (req, res) => {
    try {
      // Format templates for frontend display
      const templates = Object.entries(JOB_ROLE_PERMISSION_TEMPLATES).map(([jobTitle, permissions]) => ({
        jobTitle,
        jobTitleLabel: JOB_TITLE_LABELS[jobTitle as keyof typeof JOB_TITLE_LABELS] || jobTitle,
        permissions: permissions.map(p => ({
          module: p.module,
          moduleLabel: MODULE_LABELS[p.module as keyof typeof MODULE_LABELS] || p.module,
          actions: p.actions,
          actionLabels: p.actions.map(a => ACTION_LABELS[a as keyof typeof ACTION_LABELS] || a),
        })),
      }));
      
      res.json(templates);
    } catch (error) {
      console.error("Error fetching job role permissions:", error);
      res.status(500).json({ error: "Failed to fetch job role permissions" });
    }
  });

  // Reapply job role permissions to a specific employee
  app.post("/api/operations-employees/:id/reapply-permissions", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      if (!req.currentUser) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const employee = await storage.getUser(req.params.id);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      if (!employee.jobTitle) {
        return res.status(400).json({ error: "الموظف ليس لديه وظيفة محددة" });
      }
      
      // Verify job title has a template
      if (!JOB_TITLES.includes(employee.jobTitle as typeof JOB_TITLES[number])) {
        return res.status(400).json({ error: "الوظيفة غير معرفة في النظام" });
      }
      
      await storage.applyJobRolePermissions(req.params.id, employee.jobTitle, req.currentUser.id);
      
      res.json({ success: true, message: "تم تطبيق صلاحيات الوظيفة بنجاح" });
    } catch (error) {
      console.error("Error reapplying job role permissions:", error);
      res.status(500).json({ error: "Failed to reapply job role permissions" });
    }
  });

  // ==================== Cashier Sales Journal Routes ====================

  // Get all cashier journals with filters (supports combined filters)
  app.get("/api/cashier-journals", isAuthenticated, requirePermission("cashier_journal", "view"), async (req: any, res) => {
    try {
      const { branchId, date, startDate, endDate, cashierId, status, discrepancyStatus } = req.query;
      
      // Get branch filter from session for non-admin users
      const activeBranch = getActiveBranchFilter(req);
      const user = req.currentUser;
      
      // Get all journals first, then apply filters
      let journals = await storage.getAllCashierJournals();
      
      // Strict branch and user filtering
      if (user?.role !== "admin") {
        if (!activeBranch) {
          return res.json([]); // No branch = no data
        }
        
        // Get user permissions to see if they are a supervisor/manager
        const permissions = await storage.getUserPermissions(user.id);
        const journalPerms = permissions.find(p => p.module === 'cashier_journal');
        const isManager = journalPerms?.actions.includes('approve');
        
        if (isManager) {
          // Manager sees all journals in their branch
          journals = journals.filter(j => j.branchId === activeBranch);
        } else {
          // Cashier sees only their own journals in their branch
          // Coerce to strings for reliable comparison (handles numeric vs string IDs)
          const userId = String(user.id);
          journals = journals.filter(j => 
            j.branchId === activeBranch && String(j.cashierId) === userId
          );
        }
      } else if (branchId) {
        // Admin can filter by specific branch if provided
        journals = journals.filter(j => j.branchId === branchId);
      }
      
      // Apply remaining filters
      if (date) {
        journals = journals.filter(j => j.journalDate === date);
      }
      if (startDate) {
        journals = journals.filter(j => j.journalDate >= (startDate as string));
      }
      if (endDate) {
        journals = journals.filter(j => j.journalDate <= (endDate as string));
      }
      if (cashierId) {
        journals = journals.filter(j => j.cashierId === cashierId);
      }
      if (status) {
        journals = journals.filter(j => j.status === status);
      }
      if (discrepancyStatus) {
        journals = journals.filter(j => j.discrepancyStatus === discrepancyStatus);
      }
      
      res.json(journals);
    } catch (error) {
      console.error("Error fetching cashier journals:", error);
      res.status(500).json({ error: "Failed to fetch cashier journals" });
    }
  });

  // Get single cashier journal with payment breakdowns and signatures
  app.get("/api/cashier-journals/:id", isAuthenticated, requirePermission("cashier_journal", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const journal = await storage.getCashierJournal(id);
      if (!journal) {
        return res.status(404).json({ error: "Cashier journal not found" });
      }
      
      // Get related payment breakdowns and signatures
      const [paymentBreakdowns, signatures] = await Promise.all([
        storage.getPaymentBreakdowns(id),
        storage.getCashierSignatures(id),
      ]);
      
      res.json({ ...journal, paymentBreakdowns, signatures });
    } catch (error) {
      console.error("Error fetching cashier journal:", error);
      res.status(500).json({ error: "Failed to fetch cashier journal" });
    }
  });

  // Create new cashier journal
  app.post("/api/cashier-journals", isAuthenticated, requirePermission("cashier_journal", "create"), requireBranchAccess, async (req: any, res) => {
    try {
      const { paymentBreakdowns, signatureData, signerName, ...journalData } = req.body;
      
      // Verify user has access to the target branch
      const user = req.currentUser;
      if (user?.role !== "admin" && journalData.branchId) {
        const hasAccess = await canAccessBranch(req, journalData.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لإنشاء يومية لهذا الفرع" });
        }
      }
      
      // Server-side validation: payment breakdown totals must match total sales
      if (paymentBreakdowns && Array.isArray(paymentBreakdowns) && paymentBreakdowns.length > 0) {
        const breakdownTotal = paymentBreakdowns.reduce((sum: number, b: any) => sum + (parseFloat(b.amount) || 0), 0);
        const totalSales = parseFloat(journalData.totalSales) || 0;
        const tolerance = 0.01;
        if (Math.abs(breakdownTotal - totalSales) > tolerance) {
          return res.status(400).json({ 
            error: "مجموع التفصيل لا يطابق إجمالي المبيعات",
            details: { breakdownTotal, totalSales, difference: Math.abs(breakdownTotal - totalSales) }
          });
        }
        
        // Calculate networkTotal and deliveryTotal from payment breakdowns
        const cardMethods = ['card', 'mada', 'stc_pay', 'apple_pay', 'visa', 'mastercard'];
        const deliveryMethods = ['delivery_app', 'hunger_station', 'hungerstation', 'toyou', 'jahez', 'marsool', 'keeta', 'the_chefs', 'talabat'];
        
        journalData.networkTotal = paymentBreakdowns
          .filter((b: any) => cardMethods.includes(b.paymentMethod))
          .reduce((sum: number, b: any) => sum + (parseFloat(b.amount) || 0), 0);
        
        journalData.deliveryTotal = paymentBreakdowns
          .filter((b: any) => deliveryMethods.includes(b.paymentMethod))
          .reduce((sum: number, b: any) => sum + (parseFloat(b.amount) || 0), 0);
      }
      
      // Calculate average ticket from transaction count (with explicit zero guard)
      const transactionCount = parseInt(journalData.transactionCount) || 0;
      const totalSalesAmount = parseFloat(journalData.totalSales) || 0;
      journalData.averageTicket = transactionCount > 0 ? totalSalesAmount / transactionCount : 0;
      
      // Add creator info
      journalData.createdBy = req.currentUser?.id;
      
      // Create the journal
      const journal = await storage.createCashierJournal(journalData);
      
      // Create payment breakdowns if provided
      if (paymentBreakdowns && Array.isArray(paymentBreakdowns) && paymentBreakdowns.length > 0) {
        const breakdownsWithJournalId = paymentBreakdowns.map((b: any) => ({
          ...b,
          journalId: journal.id,
        }));
        await storage.createPaymentBreakdowns(breakdownsWithJournalId);
      }
      
      // Save cashier signature if provided
      if (signatureData && signerName) {
        await storage.createCashierSignature({
          journalId: journal.id,
          signatureType: 'cashier',
          signerName: signerName,
          signatureData: signatureData,
          signerId: req.currentUser?.id,
        });
      }
      
      // Get the complete journal with breakdowns and signatures
      const [createdBreakdowns, signatures] = await Promise.all([
        storage.getPaymentBreakdowns(journal.id),
        storage.getCashierSignatures(journal.id),
      ]);
      
      res.status(201).json({ ...journal, paymentBreakdowns: createdBreakdowns, signatures });
    } catch (error) {
      console.error("Error creating cashier journal:", error);
      res.status(500).json({ error: "Failed to create cashier journal" });
    }
  });

  // Update cashier journal
  app.patch("/api/cashier-journals/:id", isAuthenticated, requirePermission("cashier_journal", "edit"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { paymentBreakdowns, signatureData, signerName, ...journalData } = req.body;
      
      // Check if journal is already submitted/approved/posted
      const existing = await storage.getCashierJournal(id);
      if (!existing) {
        return res.status(404).json({ error: "Cashier journal not found" });
      }
      if (existing.status !== 'draft') {
        return res.status(400).json({ error: "Cannot edit posted, submitted or approved journal" });
      }
      
      // Server-side validation: totals must match
      if (paymentBreakdowns && Array.isArray(paymentBreakdowns) && journalData.totalSales !== undefined) {
        const breakdownTotal = paymentBreakdowns.reduce((sum: number, b: any) => sum + (parseFloat(b.amount) || 0), 0);
        const diff = Math.abs(journalData.totalSales - breakdownTotal);
        if (diff > 0.01) {
          return res.status(400).json({ error: "Payment breakdown total must match total sales" });
        }
        
        // Calculate networkTotal and deliveryTotal from payment breakdowns
        const cardMethods = ['card', 'mada', 'stc_pay', 'apple_pay', 'visa', 'mastercard'];
        const deliveryMethods = ['delivery_app', 'hunger_station', 'hungerstation', 'toyou', 'jahez', 'marsool', 'keeta', 'the_chefs', 'talabat'];
        
        journalData.networkTotal = paymentBreakdowns
          .filter((b: any) => cardMethods.includes(b.paymentMethod))
          .reduce((sum: number, b: any) => sum + (parseFloat(b.amount) || 0), 0);
        
        journalData.deliveryTotal = paymentBreakdowns
          .filter((b: any) => deliveryMethods.includes(b.paymentMethod))
          .reduce((sum: number, b: any) => sum + (parseFloat(b.amount) || 0), 0);
      }
      
      // Calculate average ticket from transaction count
      // Recalculate only when values are provided, otherwise preserve existing
      const hasTransactionCount = journalData.transactionCount !== undefined;
      const hasTotalSales = journalData.totalSales !== undefined;
      
      if (hasTransactionCount || hasTotalSales) {
        // Use provided values or fall back to existing values
        const transactionCount = hasTransactionCount 
          ? (parseInt(journalData.transactionCount) || 0)
          : (existing.transactionCount || 0);
        const totalSalesAmount = hasTotalSales 
          ? (parseFloat(journalData.totalSales) || 0)
          : (existing.totalSales || 0);
        journalData.averageTicket = transactionCount > 0 ? totalSalesAmount / transactionCount : 0;
      }
      // If neither is provided, journalData.averageTicket remains undefined
      // and will not overwrite the existing value in the database
      
      const journal = await storage.updateCashierJournal(id, journalData);
      
      // Update payment breakdowns if provided
      if (paymentBreakdowns && Array.isArray(paymentBreakdowns)) {
        await storage.deletePaymentBreakdowns(id);
        if (paymentBreakdowns.length > 0) {
          const breakdownsWithJournalId = paymentBreakdowns.map((b: any) => ({
            ...b,
            journalId: id,
          }));
          await storage.createPaymentBreakdowns(breakdownsWithJournalId);
        }
      }
      
      // Update/create cashier signature if provided
      if (signatureData && signerName) {
        // Check if cashier signature already exists
        const existingSigs = await storage.getCashierSignatures(id);
        const existingCashierSig = existingSigs.find(s => s.signatureType === 'cashier');
        if (!existingCashierSig) {
          await storage.createCashierSignature({
            journalId: id,
            signatureType: 'cashier',
            signerName: signerName,
            signatureData: signatureData,
            signerId: req.currentUser?.id,
          });
        }
      }
      
      const [updatedBreakdowns, signatures] = await Promise.all([
        storage.getPaymentBreakdowns(id),
        storage.getCashierSignatures(id),
      ]);
      res.json({ ...journal, paymentBreakdowns: updatedBreakdowns, signatures });
    } catch (error) {
      console.error("Error updating cashier journal:", error);
      res.status(500).json({ error: "Failed to update cashier journal" });
    }
  });

  // Delete cashier journal
  app.delete("/api/cashier-journals/:id", isAuthenticated, requirePermission("cashier_journal", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const existing = await storage.getCashierJournal(id);
      if (!existing) {
        return res.status(404).json({ error: "Cashier journal not found" });
      }
      if (existing.status === 'approved') {
        return res.status(400).json({ error: "Cannot delete approved journal" });
      }
      
      await storage.deleteCashierJournal(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting cashier journal:", error);
      res.status(500).json({ error: "Failed to delete cashier journal" });
    }
  });

  // Submit cashier journal with signature
  app.post("/api/cashier-journals/:id/submit", isAuthenticated, requirePermission("cashier_journal", "create"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { signatureData, signerName } = req.body;
      
      const existing = await storage.getCashierJournal(id);
      if (!existing) {
        return res.status(404).json({ error: "Cashier journal not found" });
      }
      if (existing.status !== 'draft') {
        return res.status(400).json({ error: "Journal already submitted" });
      }
      
      // Create signature if provided
      if (signatureData) {
        await storage.createCashierSignature({
          journalId: id,
          signatureType: 'cashier',
          signerName: signerName || existing.cashierName,
          signerId: req.currentUser?.id,
          signatureData,
          ipAddress: req.ip,
        });
      }
      
      // Submit the journal
      const journal = await storage.submitCashierJournal(id);
      const signatures = await storage.getCashierSignatures(id);
      
      res.json({ ...journal, signatures });
    } catch (error) {
      console.error("Error submitting cashier journal:", error);
      res.status(500).json({ error: "Failed to submit cashier journal" });
    }
  });

  // Post cashier journal (finalize - no more edits allowed)
  app.post("/api/cashier-journals/:id/post", isAuthenticated, requirePermission("cashier_journal", "create"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { signatureData, signerName } = req.body;
      
      const existing = await storage.getCashierJournal(id);
      if (!existing) {
        return res.status(404).json({ error: "Cashier journal not found" });
      }
      if (existing.status !== 'draft') {
        return res.status(400).json({ error: "Journal already posted or submitted" });
      }
      
      // Server-side validation: fetch payment breakdowns and verify totals match
      const breakdowns = await storage.getPaymentBreakdowns(id);
      if (breakdowns && breakdowns.length > 0) {
        const breakdownTotal = breakdowns.reduce((sum: number, b: any) => sum + (parseFloat(b.amount) || 0), 0);
        const totalSales = parseFloat(String(existing.totalSales)) || 0;
        const tolerance = 0.01;
        if (Math.abs(breakdownTotal - totalSales) > tolerance) {
          return res.status(400).json({ 
            error: "لا يمكن الترحيل: مجموع التفصيل لا يطابق إجمالي المبيعات",
            details: { breakdownTotal, totalSales, difference: Math.abs(breakdownTotal - totalSales) }
          });
        }
      }
      
      // Create signature if provided
      if (signatureData) {
        await storage.createCashierSignature({
          journalId: id,
          signatureType: 'cashier',
          signerName: signerName || existing.cashierName,
          signerId: req.currentUser?.id,
          signatureData,
          ipAddress: req.ip,
        });
      }
      
      // Post the journal (change status to 'posted')
      const journal = await storage.postCashierJournal(id);
      const signatures = await storage.getCashierSignatures(id);
      
      res.json({ ...journal, signatures });
    } catch (error) {
      console.error("Error posting cashier journal:", error);
      res.status(500).json({ error: "Failed to post cashier journal" });
    }
  });

  // Approve cashier journal
  app.post("/api/cashier-journals/:id/approve", isAuthenticated, requirePermission("cashier_journal", "approve"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { signatureData, signerName } = req.body;
      
      const existing = await storage.getCashierJournal(id);
      if (!existing) {
        return res.status(404).json({ error: "Cashier journal not found" });
      }
      if (existing.status !== 'submitted') {
        return res.status(400).json({ error: "Can only approve submitted journals" });
      }
      
      // Create supervisor signature if provided
      if (signatureData) {
        await storage.createCashierSignature({
          journalId: id,
          signatureType: 'supervisor',
          signerName: signerName || 'مشرف',
          signerId: req.currentUser?.id,
          signatureData,
          ipAddress: req.ip,
        });
      }
      
      const journal = await storage.approveCashierJournal(id, req.currentUser?.id);
      res.json(journal);
    } catch (error) {
      console.error("Error approving cashier journal:", error);
      res.status(500).json({ error: "Failed to approve cashier journal" });
    }
  });

  // Reject cashier journal
  app.post("/api/cashier-journals/:id/reject", isAuthenticated, requirePermission("cashier_journal", "approve"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { notes } = req.body;
      
      const existing = await storage.getCashierJournal(id);
      if (!existing) {
        return res.status(404).json({ error: "Cashier journal not found" });
      }
      if (existing.status !== 'submitted') {
        return res.status(400).json({ error: "Can only reject submitted journals" });
      }
      
      const journal = await storage.rejectCashierJournal(id, notes);
      res.json(journal);
    } catch (error) {
      console.error("Error rejecting cashier journal:", error);
      res.status(500).json({ error: "Failed to reject cashier journal" });
    }
  });

  // Get cashier journal stats
  app.get("/api/cashier-journals/stats/summary", isAuthenticated, requirePermission("cashier_journal", "view"), async (req: any, res) => {
    try {
      const { branchId } = req.query;
      const user = req.currentUser;
      const activeBranch = getActiveBranchFilter(req);
      
      // Get all journals first
      let journals = await storage.getAllCashierJournals();
      
      // Apply same filtering as the main journals endpoint
      if (user?.role !== "admin") {
        if (!activeBranch) {
          return res.json({
            totalJournals: 0,
            totalSales: 0,
            totalShortages: 0,
            totalSurpluses: 0,
            shortageAmount: 0,
            surplusAmount: 0,
            averageTicket: 0,
          });
        }
        
        const permissions = await storage.getUserPermissions(user.id);
        const journalPerms = permissions.find((p: any) => p.module === 'cashier_journal');
        const isManager = journalPerms?.actions.includes('approve');
        
        if (isManager) {
          journals = journals.filter(j => j.branchId === activeBranch);
        } else {
          // Cashier sees only their own journals
          // Coerce to strings for reliable comparison (handles numeric vs string IDs)
          const userId = String(user.id);
          journals = journals.filter(j => 
            j.branchId === activeBranch && String(j.cashierId) === userId
          );
        }
      } else if (branchId) {
        journals = journals.filter(j => j.branchId === branchId);
      }
      
      // Calculate stats from filtered journals
      const totalJournals = journals.length;
      const totalSales = journals.reduce((sum, j) => sum + (j.totalSales || 0), 0);
      const shortages = journals.filter(j => j.discrepancyStatus === 'shortage');
      const surpluses = journals.filter(j => j.discrepancyStatus === 'surplus');
      const shortageAmount = shortages.reduce((sum, j) => sum + Math.abs(j.discrepancyAmount || 0), 0);
      const surplusAmount = surpluses.reduce((sum, j) => sum + (j.discrepancyAmount || 0), 0);
      const totalCustomers = journals.reduce((sum, j) => sum + (j.customerCount || 0), 0);
      const averageTicket = totalCustomers > 0 ? totalSales / totalCustomers : 0;
      
      res.json({
        totalJournals,
        totalSales,
        totalShortages: shortages.length,
        totalSurpluses: surpluses.length,
        shortageAmount,
        surplusAmount,
        averageTicket,
      });
    } catch (error) {
      console.error("Error fetching cashier journal stats:", error);
      res.status(500).json({ error: "Failed to fetch cashier journal stats" });
    }
  });

  // Journal Attachments - Get attachments for a journal
  app.get("/api/cashier-journals/:id/attachments", isAuthenticated, requirePermission("cashier_journal", "view"), async (req, res) => {
    try {
      const journalId = parseInt(req.params.id, 10);
      const attachments = await storage.getJournalAttachments(journalId);
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching journal attachments:", error);
      res.status(500).json({ error: "Failed to fetch journal attachments" });
    }
  });

  // Journal Attachments - Upload attachment
  app.post("/api/cashier-journals/:id/attachments", isAuthenticated, requirePermission("cashier_journal", "create"), async (req: any, res) => {
    try {
      const journalId = parseInt(req.params.id, 10);
      const { attachmentType, fileName, fileData, mimeType, fileSize, notes } = req.body;
      
      // Check if journal exists
      const journal = await storage.getCashierJournal(journalId);
      if (!journal) {
        return res.status(404).json({ error: "Cashier journal not found" });
      }
      
      // Allow attachments on draft journals only
      if (journal.status !== 'draft') {
        return res.status(400).json({ error: "لا يمكن إضافة مرفقات على يومية مرحّلة أو معتمدة" });
      }
      
      const attachment = await storage.createJournalAttachment({
        journalId,
        attachmentType,
        fileName,
        fileData,
        mimeType,
        fileSize,
        notes,
        uploadedBy: req.currentUser?.id,
      });
      
      res.status(201).json(attachment);
    } catch (error) {
      console.error("Error uploading journal attachment:", error);
      res.status(500).json({ error: "Failed to upload journal attachment" });
    }
  });

  // Journal Attachments - Delete attachment
  app.delete("/api/cashier-journals/:journalId/attachments/:attachmentId", isAuthenticated, requirePermission("cashier_journal", "edit"), async (req, res) => {
    try {
      const journalId = parseInt(req.params.journalId, 10);
      const attachmentId = parseInt(req.params.attachmentId, 10);
      
      // Check if journal exists and is draft
      const journal = await storage.getCashierJournal(journalId);
      if (!journal) {
        return res.status(404).json({ error: "Cashier journal not found" });
      }
      if (journal.status !== 'draft') {
        return res.status(400).json({ error: "لا يمكن حذف مرفقات من يومية مرحّلة أو معتمدة" });
      }
      
      await storage.deleteJournalAttachment(attachmentId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting journal attachment:", error);
      res.status(500).json({ error: "Failed to delete journal attachment" });
    }
  });

  // Comprehensive Operations Reports Dashboard
  app.get("/api/operations/reports", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { branchId, startDate, endDate } = req.query;
      const report = await storage.getOperationsReport({
        branchId: branchId as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });
      res.json(report);
    } catch (error) {
      console.error("Error fetching operations reports:", error);
      res.status(500).json({ error: "Failed to fetch operations reports" });
    }
  });

  // Branch Overview Report - Asset Readiness, Inventory, Maintenance
  app.get("/api/reports/branch-overview", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { branchId } = req.query;
      const branches = await storage.getAllBranches();
      const allItems = branchId 
        ? await storage.getInventoryItemsByBranch(branchId as string)
        : await storage.getAllInventoryItems();
      
      const branchOverviews = [];
      const branchList = branchId 
        ? branches.filter(b => b.id === branchId)
        : branches;

      for (const branch of branchList) {
        const branchItems = allItems.filter(item => item.branchId === branch.id);
        
        const goodItems = branchItems.filter(i => i.status === 'good').length;
        const maintenanceItems = branchItems.filter(i => i.status === 'maintenance').length;
        const damagedItems = branchItems.filter(i => i.status === 'damaged').length;
        const missingItems = branchItems.filter(i => i.status === 'missing').length;
        const totalItems = branchItems.length;
        
        const assetReadinessPercent = totalItems > 0 ? (goodItems / totalItems) * 100 : 100;
        
        const now = new Date();
        const overdueInspection = branchItems.filter(i => {
          if (!i.nextInspectionDate) return false;
          return new Date(i.nextInspectionDate) < now;
        }).length;
        
        const upcomingInspection = branchItems.filter(i => {
          if (!i.nextInspectionDate) return false;
          const inspDate = new Date(i.nextInspectionDate);
          const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          return inspDate >= now && inspDate <= weekFromNow;
        }).length;
        
        const lowQuantityItems = branchItems.filter(i => i.quantity <= 5).length;
        const totalQuantity = branchItems.reduce((sum, i) => sum + i.quantity, 0);
        const totalValue = branchItems.reduce((sum, i) => sum + ((i.price || 0) * i.quantity), 0);
        
        const categoryBreakdown: Record<string, { count: number; value: number }> = {};
        for (const item of branchItems) {
          const cat = item.category || 'غير مصنف';
          if (!categoryBreakdown[cat]) {
            categoryBreakdown[cat] = { count: 0, value: 0 };
          }
          categoryBreakdown[cat].count += item.quantity;
          categoryBreakdown[cat].value += (item.price || 0) * item.quantity;
        }

        branchOverviews.push({
          branchId: branch.id,
          branchName: branch.name,
          assetReadiness: {
            total: totalItems,
            good: goodItems,
            maintenance: maintenanceItems,
            damaged: damagedItems,
            missing: missingItems,
            readinessPercent: assetReadinessPercent,
          },
          inventory: {
            totalItems,
            totalQuantity,
            totalValue,
            lowQuantityItems,
            categoryBreakdown: Object.entries(categoryBreakdown).map(([category, data]) => ({
              category,
              count: data.count,
              value: data.value,
            })),
          },
          maintenance: {
            itemsNeedingMaintenance: maintenanceItems + damagedItems,
            overdueInspection,
            upcomingInspection,
          },
          operationalStatus: assetReadinessPercent >= 90 ? 'excellent' : assetReadinessPercent >= 75 ? 'good' : assetReadinessPercent >= 50 ? 'needs_attention' : 'critical',
        });
      }

      const summary = {
        totalBranches: branchOverviews.length,
        totalAssets: branchOverviews.reduce((sum, b) => sum + b.assetReadiness.total, 0),
        totalGoodAssets: branchOverviews.reduce((sum, b) => sum + b.assetReadiness.good, 0),
        totalMaintenanceNeeded: branchOverviews.reduce((sum, b) => sum + b.maintenance.itemsNeedingMaintenance, 0),
        totalOverdueInspection: branchOverviews.reduce((sum, b) => sum + b.maintenance.overdueInspection, 0),
        totalInventoryValue: branchOverviews.reduce((sum, b) => sum + b.inventory.totalValue, 0),
        overallReadinessPercent: branchOverviews.length > 0 
          ? branchOverviews.reduce((sum, b) => sum + b.assetReadiness.readinessPercent, 0) / branchOverviews.length 
          : 100,
        branchesExcellent: branchOverviews.filter(b => b.operationalStatus === 'excellent').length,
        branchesGood: branchOverviews.filter(b => b.operationalStatus === 'good').length,
        branchesNeedAttention: branchOverviews.filter(b => b.operationalStatus === 'needs_attention').length,
        branchesCritical: branchOverviews.filter(b => b.operationalStatus === 'critical').length,
      };

      res.json({ summary, branches: branchOverviews });
    } catch (error) {
      console.error("Error fetching branch overview report:", error);
      res.status(500).json({ error: "Failed to fetch branch overview report" });
    }
  });

  // Executive Summary Report - Comprehensive data for PDF/Excel export
  app.get("/api/reports/executive-summary", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const branches = await storage.getAllBranches();
      
      const operationsReport = await storage.getOperationsReport({
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });
      
      const allItems = await storage.getAllInventoryItems();
      const allJournals = await storage.getAllCashierJournals();
      
      let filteredJournals = allJournals;
      if (startDate) {
        filteredJournals = filteredJournals.filter(j => j.journalDate >= (startDate as string));
      }
      if (endDate) {
        filteredJournals = filteredJournals.filter(j => j.journalDate <= (endDate as string));
      }

      const goodItems = allItems.filter(i => i.status === 'good').length;
      const maintenanceItems = allItems.filter(i => i.status === 'maintenance' || i.status === 'damaged').length;
      const totalInventoryValue = allItems.reduce((sum, i) => sum + ((i.price || 0) * i.quantity), 0);
      const assetReadinessPercent = allItems.length > 0 ? (goodItems / allItems.length) * 100 : 100;

      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const targetsProgress = await storage.getAllBranchesSalesProgress(currentYearMonth);
      const totalTarget = targetsProgress.reduce((sum, b) => sum + (b.targetAmount || 0), 0);
      const totalAchieved = targetsProgress.reduce((sum, b) => sum + (b.achievedAmount || 0), 0);
      const targetAchievementPercent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

      const executiveSummary = {
        reportDate: new Date().toISOString(),
        period: { startDate: startDate || 'N/A', endDate: endDate || 'N/A' },
        
        salesOverview: {
          totalSales: operationsReport.salesReport.totalSales,
          cashSales: operationsReport.salesReport.cashSales,
          networkSales: operationsReport.salesReport.networkSales,
          deliverySales: operationsReport.salesReport.deliverySales,
          totalTransactions: operationsReport.salesReport.totalTransactions,
          averageTicket: operationsReport.salesReport.averageTicket,
          discrepancies: {
            shortages: operationsReport.salesReport.totalShortages,
            shortageAmount: operationsReport.salesReport.shortageAmount,
            surpluses: operationsReport.salesReport.totalSurpluses,
            surplusAmount: operationsReport.salesReport.surplusAmount,
          },
        },

        productionOverview: {
          totalOrders: operationsReport.productionReport.totalOrders,
          completedOrders: operationsReport.productionReport.completedOrders,
          pendingOrders: operationsReport.productionReport.pendingOrders,
          inProgressOrders: operationsReport.productionReport.inProgressOrders,
          totalQuantityProduced: operationsReport.productionReport.totalQuantityProduced,
          qualityPassRate: operationsReport.productionReport.qualityPassRate,
        },

        assetsOverview: {
          totalAssets: allItems.length,
          goodAssets: goodItems,
          maintenanceNeeded: maintenanceItems,
          assetReadinessPercent,
          totalInventoryValue,
        },

        targetsOverview: {
          totalTarget,
          totalAchieved,
          achievementPercent: targetAchievementPercent,
          branchesAboveTarget: targetsProgress.filter(b => b.achievementPercent >= 100).length,
          branchesBelowTarget: targetsProgress.filter(b => b.achievementPercent < 80).length,
        },

        branchPerformance: operationsReport.branchComparison.map(b => ({
          branchId: b.branchId,
          branchName: b.branchName,
          totalSales: b.totalSales,
          totalOrders: b.totalOrders,
          qualityPassRate: b.qualityPassRate,
          averageTicket: b.averageTicket,
        })),

        shiftsOverview: {
          totalShifts: operationsReport.shiftsReport.totalShifts,
          totalEmployeeAssignments: operationsReport.shiftsReport.totalEmployeeAssignments,
        },

        keyMetrics: {
          totalBranches: branches.length,
          activeCashiers: new Set(filteredJournals.map(j => j.cashierId)).size,
          averageDailySales: operationsReport.salesReport.dailySales.length > 0 
            ? operationsReport.salesReport.totalSales / operationsReport.salesReport.dailySales.length 
            : 0,
        },
      };

      res.json(executiveSummary);
    } catch (error) {
      console.error("Error fetching executive summary:", error);
      res.status(500).json({ error: "Failed to fetch executive summary" });
    }
  });

  // ==========================================
  // Targets & Incentives API Routes
  // ==========================================

  // Target Weight Profiles
  app.get("/api/targets/profiles", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const profiles = await storage.getAllTargetWeightProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching target weight profiles:", error);
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  app.get("/api/targets/profiles/default", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const profile = await storage.getDefaultTargetWeightProfile();
      res.json(profile || null);
    } catch (error) {
      console.error("Error fetching default profile:", error);
      res.status(500).json({ error: "Failed to fetch default profile" });
    }
  });

  app.get("/api/targets/profiles/:id", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const profile = await storage.getTargetWeightProfile(id);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post("/api/targets/profiles", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const parseResult = insertTargetWeightProfileSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: parseResult.error.flatten() });
      }
      
      const profile = await storage.createTargetWeightProfile({
        ...parseResult.data,
        createdBy: req.currentUser?.id
      });
      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating profile:", error);
      res.status(500).json({ error: "Failed to create profile" });
    }
  });

  app.patch("/api/targets/profiles/:id", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      
      const parseResult = insertTargetWeightProfileSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: parseResult.error.flatten() });
      }
      
      const profile = await storage.updateTargetWeightProfile(id, parseResult.data);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.delete("/api/targets/profiles/:id", isAuthenticated, requirePermission("operations", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await storage.deleteTargetWeightProfile(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting profile:", error);
      res.status(500).json({ error: "Failed to delete profile" });
    }
  });

  // Branch Monthly Targets
  app.get("/api/targets/monthly", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { branchId, yearMonth } = req.query;
      let targets = await storage.getAllBranchMonthlyTargets();
      
      if (branchId) {
        targets = targets.filter(t => t.branchId === branchId);
      }
      if (yearMonth) {
        targets = targets.filter(t => t.yearMonth === yearMonth);
      }
      
      res.json(targets);
    } catch (error) {
      console.error("Error fetching monthly targets:", error);
      res.status(500).json({ error: "Failed to fetch targets" });
    }
  });

  app.get("/api/targets/monthly/:id", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const target = await storage.getBranchMonthlyTarget(id);
      if (!target) {
        return res.status(404).json({ error: "Target not found" });
      }
      res.json(target);
    } catch (error) {
      console.error("Error fetching target:", error);
      res.status(500).json({ error: "Failed to fetch target" });
    }
  });

  app.post("/api/targets/monthly", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const { branchId, yearMonth, targetAmount, profileId, notes } = req.body;
      
      // Validate required fields
      if (!branchId || typeof branchId !== 'string') {
        return res.status(400).json({ error: "الفرع مطلوب" });
      }
      if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
        return res.status(400).json({ error: "الشهر مطلوب بصيغة YYYY-MM" });
      }
      
      // Parse and validate targetAmount
      const parsedTargetAmount = typeof targetAmount === 'string' ? parseFloat(targetAmount) : targetAmount;
      if (typeof parsedTargetAmount !== 'number' || isNaN(parsedTargetAmount) || parsedTargetAmount <= 0) {
        return res.status(400).json({ error: "الهدف الشهري يجب أن يكون رقماً موجباً" });
      }
      
      // Validate profileId if provided
      let validProfileId: number | null = null;
      if (profileId !== undefined && profileId !== null && profileId !== '') {
        validProfileId = typeof profileId === 'string' ? parseInt(profileId, 10) : profileId;
        if (isNaN(validProfileId)) {
          return res.status(400).json({ error: "معرف ملف التوزيع غير صالح" });
        }
      }
      
      // Check if target already exists for this branch/month
      const existing = await storage.getBranchMonthlyTargetByMonth(branchId, yearMonth);
      if (existing) {
        return res.status(400).json({ error: "يوجد هدف مسجل لهذا الفرع في هذا الشهر" });
      }
      
      const target = await storage.createBranchMonthlyTarget({
        branchId,
        yearMonth,
        targetAmount: parsedTargetAmount,
        profileId: validProfileId,
        notes: notes || null,
        createdBy: req.currentUser?.id,
        status: 'draft'
      });
      
      res.status(201).json(target);
    } catch (error) {
      console.error("Error creating monthly target:", error);
      res.status(500).json({ error: "Failed to create target" });
    }
  });

  app.patch("/api/targets/monthly/:id", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const target = await storage.updateBranchMonthlyTarget(id, req.body);
      if (!target) {
        return res.status(404).json({ error: "Target not found" });
      }
      res.json(target);
    } catch (error) {
      console.error("Error updating target:", error);
      res.status(500).json({ error: "Failed to update target" });
    }
  });

  app.delete("/api/targets/monthly/:id", isAuthenticated, requirePermission("operations", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await storage.deleteBranchMonthlyTarget(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting target:", error);
      res.status(500).json({ error: "Failed to delete target" });
    }
  });

  // Generate daily allocations for a monthly target
  app.post("/api/targets/monthly/:id/generate-allocations", isAuthenticated, requirePermission("operations", "edit"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const target = await storage.getBranchMonthlyTarget(id);
      
      if (!target) {
        return res.status(404).json({ error: "Target not found" });
      }
      
      // Get weight profile
      let profile = target.profileId 
        ? await storage.getTargetWeightProfile(target.profileId)
        : await storage.getDefaultTargetWeightProfile();
      
      if (!profile) {
        return res.status(400).json({ error: "No weight profile found" });
      }
      
      // Parse year-month to get days
      const [year, month] = target.yearMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      // Calculate weights for each day with smart distribution
      // Weekend boost (Thu=4, Fri=5, Sat=6): 1.3x multiplier - higher sales
      // End of month boost (days 27-31): 1.2x multiplier - salary period
      // Combined boost: 1.56x (1.3 * 1.2)
      const WEEKEND_MULTIPLIER = 1.3;
      const END_OF_MONTH_MULTIPLIER = 1.2;
      
      const dayWeights: number[] = [];
      const weekdayWeights = [
        profile.sundayWeight,
        profile.mondayWeight,
        profile.tuesdayWeight,
        profile.wednesdayWeight,
        profile.thursdayWeight,
        profile.fridayWeight,
        profile.saturdayWeight
      ];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();
        let weight = weekdayWeights[dayOfWeek];
        
        // Apply weekend boost (Thursday, Friday, Saturday)
        const isWeekend = dayOfWeek === 4 || dayOfWeek === 5 || dayOfWeek === 6;
        if (isWeekend) {
          weight *= WEEKEND_MULTIPLIER;
        }
        
        // Apply end of month boost (days 27-31)
        const isEndOfMonth = day >= 27;
        if (isEndOfMonth) {
          weight *= END_OF_MONTH_MULTIPLIER;
        }
        
        dayWeights.push(weight);
      }
      
      // Normalize weights to sum to 100
      const totalWeight = dayWeights.reduce((sum, w) => sum + w, 0);
      const normalizedWeights = dayWeights.map(w => (w / totalWeight) * 100);
      
      // Create allocations with rounding that preserves exact total
      const allocations = [];
      let allocatedTotal = 0;
      const provisionalTargets = normalizedWeights.map(w => (target.targetAmount * w) / 100);
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = day.toString().padStart(2, '0');
        const targetDate = `${target.yearMonth}-${dayStr}`;
        const weightPercent = normalizedWeights[day - 1];
        
        // Round to nearest integer, but track for adjustment
        let dailyTarget = Math.round(provisionalTargets[day - 1]);
        
        // For last day, adjust to ensure exact total
        if (day === daysInMonth) {
          dailyTarget = target.targetAmount - allocatedTotal;
        } else {
          allocatedTotal += dailyTarget;
        }
        
        allocations.push({
          monthlyTargetId: id,
          targetDate,
          weightPercent,
          dailyTarget,
          isHoliday: false,
          isManualOverride: false
        });
      }
      
      // Delete existing allocations and create new ones
      const existingAllocations = await storage.getTargetDailyAllocationsByMonth(id);
      for (const alloc of existingAllocations) {
        await storage.deleteTargetDailyAllocation(alloc.id);
      }
      
      const created = await storage.bulkCreateTargetDailyAllocations(allocations);
      
      // Activate the target
      await storage.updateBranchMonthlyTarget(id, { status: 'active' });
      
      res.json({ allocations: created, message: "تم توزيع الهدف على أيام الشهر بنجاح" });
    } catch (error) {
      console.error("Error generating allocations:", error);
      res.status(500).json({ error: "Failed to generate allocations" });
    }
  });

  // Get daily allocations for a monthly target
  app.get("/api/targets/monthly/:id/allocations", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const allocations = await storage.getTargetDailyAllocationsByMonth(id);
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching allocations:", error);
      res.status(500).json({ error: "Failed to fetch allocations" });
    }
  });

  // Update a daily allocation (manual override)
  app.patch("/api/targets/allocations/:id", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { dailyTarget, isHoliday, overrideReason } = req.body;
      
      const allocation = await storage.updateTargetDailyAllocation(id, {
        dailyTarget,
        isHoliday,
        isManualOverride: true,
        overrideReason
      });
      
      if (!allocation) {
        return res.status(404).json({ error: "Allocation not found" });
      }
      res.json(allocation);
    } catch (error) {
      console.error("Error updating allocation:", error);
      res.status(500).json({ error: "Failed to update allocation" });
    }
  });

  // Incentive Tiers
  app.get("/api/incentives/tiers", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const tiers = await storage.getAllIncentiveTiers();
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching incentive tiers:", error);
      res.status(500).json({ error: "Failed to fetch tiers" });
    }
  });

  app.get("/api/incentives/tiers/active", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const tiers = await storage.getActiveIncentiveTiers();
      res.json(tiers);
    } catch (error) {
      console.error("Error fetching active tiers:", error);
      res.status(500).json({ error: "Failed to fetch active tiers" });
    }
  });

  app.post("/api/incentives/tiers", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const { name, description, minAchievementPercent, maxAchievementPercent, rewardType, fixedAmount, percentageRate, applicableTo, sortOrder, isActive } = req.body;
      
      // Validate required fields
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "اسم المستوى مطلوب" });
      }
      
      // Parse and validate minAchievementPercent
      const parsedMin = typeof minAchievementPercent === 'string' ? parseFloat(minAchievementPercent) : minAchievementPercent;
      if (typeof parsedMin !== 'number' || isNaN(parsedMin) || parsedMin < 0) {
        return res.status(400).json({ error: "الحد الأدنى للتحقيق يجب أن يكون رقماً موجباً" });
      }
      
      // Parse and validate maxAchievementPercent if provided
      let parsedMax: number | null = null;
      if (maxAchievementPercent !== undefined && maxAchievementPercent !== null && maxAchievementPercent !== '') {
        parsedMax = typeof maxAchievementPercent === 'string' ? parseFloat(maxAchievementPercent) : maxAchievementPercent;
        if (isNaN(parsedMax) || parsedMax <= parsedMin) {
          return res.status(400).json({ error: "الحد الأقصى يجب أن يكون أكبر من الحد الأدنى" });
        }
      }
      
      if (!['fixed', 'percentage', 'both'].includes(rewardType)) {
        return res.status(400).json({ error: "نوع المكافأة غير صالح" });
      }
      
      // Parse and validate fixedAmount
      let parsedFixedAmount: number | null = null;
      if (rewardType === 'fixed' || rewardType === 'both') {
        parsedFixedAmount = typeof fixedAmount === 'string' ? parseFloat(fixedAmount) : fixedAmount;
        if (typeof parsedFixedAmount !== 'number' || isNaN(parsedFixedAmount) || parsedFixedAmount <= 0) {
          return res.status(400).json({ error: "المبلغ الثابت مطلوب ويجب أن يكون موجباً" });
        }
      }
      
      // Parse and validate percentageRate
      let parsedPercentageRate: number | null = null;
      if (rewardType === 'percentage' || rewardType === 'both') {
        parsedPercentageRate = typeof percentageRate === 'string' ? parseFloat(percentageRate) : percentageRate;
        if (typeof parsedPercentageRate !== 'number' || isNaN(parsedPercentageRate) || parsedPercentageRate <= 0) {
          return res.status(400).json({ error: "نسبة المكافأة مطلوبة ويجب أن تكون موجبة" });
        }
      }
      
      const tier = await storage.createIncentiveTier({
        name: name.trim(),
        description: description || null,
        minAchievementPercent: parsedMin,
        maxAchievementPercent: parsedMax,
        rewardType,
        fixedAmount: parsedFixedAmount,
        percentageRate: parsedPercentageRate,
        applicableTo: applicableTo || 'all',
        sortOrder: typeof sortOrder === 'number' && !isNaN(sortOrder) ? sortOrder : 0,
        isActive: isActive !== false,
        createdBy: req.currentUser?.id
      });
      res.status(201).json(tier);
    } catch (error) {
      console.error("Error creating tier:", error);
      res.status(500).json({ error: "Failed to create tier" });
    }
  });

  app.patch("/api/incentives/tiers/:id", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const tier = await storage.updateIncentiveTier(id, req.body);
      if (!tier) {
        return res.status(404).json({ error: "Tier not found" });
      }
      res.json(tier);
    } catch (error) {
      console.error("Error updating tier:", error);
      res.status(500).json({ error: "Failed to update tier" });
    }
  });

  app.delete("/api/incentives/tiers/:id", isAuthenticated, requirePermission("operations", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await storage.deleteIncentiveTier(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tier:", error);
      res.status(500).json({ error: "Failed to delete tier" });
    }
  });

  // Incentive Awards
  app.get("/api/incentives/awards", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { branchId, cashierId, status } = req.query;
      let awards = await storage.getAllIncentiveAwards();
      
      if (branchId) {
        awards = awards.filter(a => a.branchId === branchId);
      }
      if (cashierId) {
        awards = awards.filter(a => a.cashierId === cashierId);
      }
      if (status) {
        awards = awards.filter(a => a.status === status);
      }
      
      res.json(awards);
    } catch (error) {
      console.error("Error fetching awards:", error);
      res.status(500).json({ error: "Failed to fetch awards" });
    }
  });

  app.post("/api/incentives/awards", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const { awardType, branchId, cashierId, periodStart, periodEnd, targetAmount, achievedAmount, achievementPercent, tierId, calculatedReward, finalReward, notes } = req.body;
      
      // Validate required fields
      if (!awardType || !['monthly', 'quarterly', 'annual', 'special'].includes(awardType)) {
        return res.status(400).json({ error: "نوع الجائزة غير صالح" });
      }
      if (!branchId || typeof branchId !== 'string') {
        return res.status(400).json({ error: "الفرع مطلوب" });
      }
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ error: "فترة الحافز مطلوبة" });
      }
      
      // Parse and validate numeric fields
      const parsedTargetAmount = typeof targetAmount === 'string' ? parseFloat(targetAmount) : targetAmount;
      if (typeof parsedTargetAmount !== 'number' || isNaN(parsedTargetAmount) || parsedTargetAmount < 0) {
        return res.status(400).json({ error: "الهدف يجب أن يكون رقماً صالحاً" });
      }
      
      const parsedAchievedAmount = typeof achievedAmount === 'string' ? parseFloat(achievedAmount) : achievedAmount;
      if (typeof parsedAchievedAmount !== 'number' || isNaN(parsedAchievedAmount) || parsedAchievedAmount < 0) {
        return res.status(400).json({ error: "المحقق يجب أن يكون رقماً صالحاً" });
      }
      
      const parsedAchievementPercent = typeof achievementPercent === 'string' ? parseFloat(achievementPercent) : achievementPercent;
      if (typeof parsedAchievementPercent !== 'number' || isNaN(parsedAchievementPercent) || parsedAchievementPercent < 0) {
        return res.status(400).json({ error: "نسبة التحقيق يجب أن تكون رقماً صالحاً" });
      }
      
      const parsedCalculatedReward = typeof calculatedReward === 'string' ? parseFloat(calculatedReward) : calculatedReward;
      if (typeof parsedCalculatedReward !== 'number' || isNaN(parsedCalculatedReward) || parsedCalculatedReward < 0) {
        return res.status(400).json({ error: "الحافز المحسوب يجب أن يكون رقماً صالحاً" });
      }
      
      const parsedFinalReward = finalReward !== undefined 
        ? (typeof finalReward === 'string' ? parseFloat(finalReward) : finalReward)
        : parsedCalculatedReward;
      if (typeof parsedFinalReward !== 'number' || isNaN(parsedFinalReward) || parsedFinalReward < 0) {
        return res.status(400).json({ error: "الحافز النهائي يجب أن يكون رقماً صالحاً" });
      }
      
      // Parse tierId if provided
      let parsedTierId: number | null = null;
      if (tierId !== undefined && tierId !== null && tierId !== '') {
        parsedTierId = typeof tierId === 'string' ? parseInt(tierId, 10) : tierId;
        if (isNaN(parsedTierId)) {
          return res.status(400).json({ error: "معرف مستوى الحافز غير صالح" });
        }
      }
      
      const award = await storage.createIncentiveAward({
        awardType,
        branchId,
        cashierId: cashierId || null,
        periodStart,
        periodEnd,
        targetAmount: parsedTargetAmount,
        achievedAmount: parsedAchievedAmount,
        achievementPercent: parsedAchievementPercent,
        tierId: parsedTierId,
        calculatedReward: parsedCalculatedReward,
        finalReward: parsedFinalReward,
        notes: notes || null,
        status: 'pending',
        createdBy: req.currentUser?.id
      });
      res.status(201).json(award);
    } catch (error) {
      console.error("Error creating award:", error);
      res.status(500).json({ error: "Failed to create award" });
    }
  });

  app.patch("/api/incentives/awards/:id", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const award = await storage.updateIncentiveAward(id, req.body);
      if (!award) {
        return res.status(404).json({ error: "Award not found" });
      }
      res.json(award);
    } catch (error) {
      console.error("Error updating award:", error);
      res.status(500).json({ error: "Failed to update award" });
    }
  });

  app.post("/api/incentives/awards/:id/approve", isAuthenticated, requirePermission("operations", "approve"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const award = await storage.approveIncentiveAward(id, req.currentUser?.id);
      if (!award) {
        return res.status(404).json({ error: "Award not found" });
      }
      res.json(award);
    } catch (error) {
      console.error("Error approving award:", error);
      res.status(500).json({ error: "Failed to approve award" });
    }
  });

  app.post("/api/incentives/awards/:id/pay", isAuthenticated, requirePermission("operations", "approve"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const award = await storage.markIncentiveAwardAsPaid(id);
      if (!award) {
        return res.status(404).json({ error: "Award not found" });
      }
      res.json(award);
    } catch (error) {
      console.error("Error marking award as paid:", error);
      res.status(500).json({ error: "Failed to mark award as paid" });
    }
  });

  // Branch Daily Sales Progress
  app.get("/api/targets/progress/:branchId", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { branchId } = req.params;
      const { yearMonth } = req.query;
      
      if (!yearMonth) {
        return res.status(400).json({ error: "yearMonth is required" });
      }
      
      const progress = await storage.getBranchDailySalesProgress(branchId, yearMonth as string);
      if (!progress) {
        return res.status(404).json({ error: "لا توجد بيانات أهداف لهذا الفرع" });
      }
      res.json(progress);
    } catch (error) {
      console.error("Error fetching branch progress:", error);
      res.status(500).json({ error: "Failed to fetch branch progress" });
    }
  });

  // All Branches Sales Progress Summary
  app.get("/api/targets/progress-summary", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { yearMonth } = req.query;
      
      if (!yearMonth) {
        return res.status(400).json({ error: "yearMonth is required" });
      }
      
      const summary = await storage.getAllBranchesSalesProgress(yearMonth as string);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching progress summary:", error);
      res.status(500).json({ error: "Failed to fetch progress summary" });
    }
  });

  // Performance & Leaderboard
  app.get("/api/targets/performance/:branchId", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { branchId } = req.params;
      const { yearMonth } = req.query;
      
      if (!yearMonth) {
        return res.status(400).json({ error: "yearMonth is required" });
      }
      
      const performance = await storage.calculateBranchPerformance(branchId, yearMonth as string);
      res.json(performance);
    } catch (error) {
      console.error("Error calculating performance:", error);
      res.status(500).json({ error: "Failed to calculate performance" });
    }
  });

  app.get("/api/targets/leaderboard", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { yearMonth } = req.query;
      
      if (!yearMonth) {
        return res.status(400).json({ error: "yearMonth is required" });
      }
      
      const leaderboard = await storage.getLeaderboard(yearMonth as string);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Calculate incentives for a period
  app.post("/api/incentives/calculate", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const { yearMonth, branchId } = req.body;
      
      if (!yearMonth) {
        return res.status(400).json({ error: "yearMonth is required" });
      }
      
      const tiers = await storage.getActiveIncentiveTiers();
      const branches = branchId 
        ? [await storage.getBranch(branchId)].filter(Boolean) as any[]
        : await storage.getAllBranches();
      
      const calculatedAwards = [];
      
      for (const branch of branches) {
        const performance = await storage.calculateBranchPerformance(branch.id, yearMonth);
        
        if (performance.targetAmount === 0) continue;
        
        // Find applicable tier
        const achievementPercent = performance.achievementPercent;
        const applicableTier = tiers
          .filter(t => achievementPercent >= t.minAchievementPercent)
          .filter(t => !t.maxAchievementPercent || achievementPercent < t.maxAchievementPercent)
          .sort((a, b) => b.minAchievementPercent - a.minAchievementPercent)[0];
        
        if (applicableTier) {
          let calculatedReward = 0;
          const excessAmount = performance.achievedAmount - performance.targetAmount;
          
          if (applicableTier.rewardType === 'fixed' && applicableTier.fixedAmount) {
            calculatedReward = applicableTier.fixedAmount;
          } else if (applicableTier.rewardType === 'percentage' && applicableTier.percentageRate && excessAmount > 0) {
            calculatedReward = (excessAmount * applicableTier.percentageRate) / 100;
          } else if (applicableTier.rewardType === 'both') {
            calculatedReward = (applicableTier.fixedAmount || 0);
            if (applicableTier.percentageRate && excessAmount > 0) {
              calculatedReward += (excessAmount * applicableTier.percentageRate) / 100;
            }
          }
          
          calculatedAwards.push({
            branchId: branch.id,
            branchName: branch.name,
            targetAmount: performance.targetAmount,
            achievedAmount: performance.achievedAmount,
            achievementPercent,
            tierName: applicableTier.name,
            tierId: applicableTier.id,
            calculatedReward,
            status: 'preview'
          });
        }
      }
      
      res.json(calculatedAwards);
    } catch (error) {
      console.error("Error calculating incentives:", error);
      res.status(500).json({ error: "Failed to calculate incentives" });
    }
  });

  // ==========================================
  // Seasons & Holidays Routes
  // ==========================================

  app.get("/api/seasons-holidays", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const seasons = await storage.getAllSeasonsHolidays();
      res.json(seasons);
    } catch (error) {
      console.error("Error fetching seasons/holidays:", error);
      res.status(500).json({ error: "Failed to fetch seasons/holidays" });
    }
  });

  app.get("/api/seasons-holidays/active", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const seasons = await storage.getActiveSeasonsHolidays();
      res.json(seasons);
    } catch (error) {
      console.error("Error fetching active seasons/holidays:", error);
      res.status(500).json({ error: "Failed to fetch active seasons/holidays" });
    }
  });

  // Get holidays by month (for target allocation display)
  app.get("/api/seasons-holidays/by-month", isAuthenticated, async (req, res) => {
    try {
      const { yearMonth } = req.query;
      if (!yearMonth || typeof yearMonth !== 'string') {
        return res.status(400).json({ error: "yearMonth parameter required (format: YYYY-MM)" });
      }
      
      // Calculate start and end of month
      const [year, month] = yearMonth.split('-').map(Number);
      const startDate = `${yearMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${yearMonth}-${lastDay.toString().padStart(2, '0')}`;
      
      const holidays = await storage.getSeasonsHolidaysForDateRange(startDate, endDate);
      res.json(holidays);
    } catch (error) {
      console.error("Error fetching holidays by month:", error);
      res.status(500).json({ error: "Failed to fetch holidays" });
    }
  });

  app.post("/api/seasons-holidays", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const { name, type, category, startDate, endDate, color, icon, weightMultiplier, applicableBranches, description, isRecurring, recurringPattern } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "اسم الموسم/الإجازة مطلوب" });
      }
      if (!type || !['season', 'holiday', 'event', 'islamic', 'international', 'national', 'custom'].includes(type)) {
        return res.status(400).json({ error: "نوع غير صالح" });
      }
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "تاريخ البداية والنهاية مطلوبان" });
      }
      
      const parsedMultiplier = typeof weightMultiplier === 'string' ? parseFloat(weightMultiplier) : weightMultiplier;
      if (parsedMultiplier !== undefined && (isNaN(parsedMultiplier) || parsedMultiplier <= 0)) {
        return res.status(400).json({ error: "معامل الوزن يجب أن يكون رقماً موجباً" });
      }
      
      const season = await storage.createSeasonHoliday({
        name,
        type,
        category: category || null,
        startDate,
        endDate,
        color: color || '#f59e0b',
        icon: icon || null,
        weightMultiplier: parsedMultiplier || 1.0,
        applicableBranches: applicableBranches || null,
        description: description || null,
        isRecurring: isRecurring || false,
        recurringPattern: recurringPattern || null,
        isActive: true,
        createdBy: req.currentUser?.id
      });
      res.status(201).json(season);
    } catch (error) {
      console.error("Error creating season/holiday:", error);
      res.status(500).json({ error: "Failed to create season/holiday" });
    }
  });

  // Seed default holidays for Saudi Arabia (national + international)
  app.post("/api/seasons-holidays/seed-defaults", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const { year } = req.body;
      const targetYear = year || new Date().getFullYear();
      
      const defaultHolidays = [
        // Saudi National Days
        { name: "اليوم الوطني السعودي", type: "national", category: "national_day", startDate: `${targetYear}-09-23`, endDate: `${targetYear}-09-23`, color: "#16a34a", icon: "flag", weightMultiplier: 1.5, description: "اليوم الوطني للمملكة العربية السعودية" },
        { name: "يوم التأسيس", type: "national", category: "founding_day", startDate: `${targetYear}-02-22`, endDate: `${targetYear}-02-22`, color: "#16a34a", icon: "crown", weightMultiplier: 1.3, description: "يوم تأسيس الدولة السعودية الأولى" },
        
        // International Events
        { name: "رأس السنة الميلادية", type: "international", category: "new_year", startDate: `${targetYear}-01-01`, endDate: `${targetYear}-01-01`, color: "#8b5cf6", icon: "party-popper", weightMultiplier: 1.2, description: "السنة الميلادية الجديدة" },
        { name: "عيد الحب", type: "international", category: "valentines", startDate: `${targetYear}-02-14`, endDate: `${targetYear}-02-14`, color: "#ec4899", icon: "heart", weightMultiplier: 1.3, description: "عيد الحب العالمي" },
        { name: "عيد الأم", type: "international", category: "mothers_day", startDate: `${targetYear}-03-21`, endDate: `${targetYear}-03-21`, color: "#f472b6", icon: "flower", weightMultiplier: 1.3, description: "عيد الأم" },
        { name: "اليوم العالمي للقهوة", type: "international", category: "coffee_day", startDate: `${targetYear}-10-01`, endDate: `${targetYear}-10-01`, color: "#92400e", icon: "coffee", weightMultiplier: 1.2, description: "يوم القهوة العالمي" },
        
        // Islamic Holidays (approximate dates for 2025 - these should be updated yearly)
        { name: "عيد الفطر المبارك", type: "islamic", category: "eid_fitr", startDate: `${targetYear}-03-30`, endDate: `${targetYear}-04-02`, color: "#0ea5e9", icon: "moon", weightMultiplier: 1.8, description: "عيد الفطر - أول شوال" },
        { name: "عيد الأضحى المبارك", type: "islamic", category: "eid_adha", startDate: `${targetYear}-06-06`, endDate: `${targetYear}-06-10`, color: "#0ea5e9", icon: "moon", weightMultiplier: 1.8, description: "عيد الأضحى - 10 ذو الحجة" },
        
        // Seasons
        { name: "موسم رمضان", type: "season", category: "ramadan", startDate: `${targetYear}-03-01`, endDate: `${targetYear}-03-29`, color: "#14b8a6", icon: "moon", weightMultiplier: 1.5, description: "شهر رمضان المبارك" },
        { name: "موسم الصيف", type: "season", category: "summer", startDate: `${targetYear}-06-21`, endDate: `${targetYear}-09-22`, color: "#f97316", icon: "sun", weightMultiplier: 1.0, description: "فصل الصيف" },
      ];
      
      const created = [];
      for (const holiday of defaultHolidays) {
        // Check if already exists
        const existing = await storage.getSeasonsHolidaysForDateRange(holiday.startDate, holiday.endDate);
        const exists = existing.some(h => h.name === holiday.name);
        if (!exists) {
          const newHoliday = await storage.createSeasonHoliday({
            ...holiday,
            applicableBranches: null,
            isRecurring: true,
            recurringPattern: 'yearly',
            isActive: true,
            createdBy: req.currentUser?.id
          });
          created.push(newHoliday);
        }
      }
      
      res.json({ message: `تم إضافة ${created.length} مناسبة جديدة`, created });
    } catch (error) {
      console.error("Error seeding holidays:", error);
      res.status(500).json({ error: "Failed to seed holidays" });
    }
  });

  app.patch("/api/seasons-holidays/:id", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const season = await storage.updateSeasonHoliday(id, req.body);
      if (!season) {
        return res.status(404).json({ error: "الموسم/الإجازة غير موجود" });
      }
      res.json(season);
    } catch (error) {
      console.error("Error updating season/holiday:", error);
      res.status(500).json({ error: "Failed to update season/holiday" });
    }
  });

  app.delete("/api/seasons-holidays/:id", isAuthenticated, requirePermission("operations", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      await storage.deleteSeasonHoliday(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting season/holiday:", error);
      res.status(500).json({ error: "Failed to delete season/holiday" });
    }
  });

  // ==========================================
  // Commission Rates Routes
  // ==========================================

  app.get("/api/commission-rates", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const rates = await storage.getAllCommissionRates();
      res.json(rates);
    } catch (error) {
      console.error("Error fetching commission rates:", error);
      res.status(500).json({ error: "Failed to fetch commission rates" });
    }
  });

  app.get("/api/commission-rates/active", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const rates = await storage.getActiveCommissionRates();
      res.json(rates);
    } catch (error) {
      console.error("Error fetching active commission rates:", error);
      res.status(500).json({ error: "Failed to fetch active commission rates" });
    }
  });

  app.post("/api/commission-rates", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const { name, description, minSalesAmount, maxSalesAmount, commissionType, fixedAmount, percentageRate, applicableTo, applicableBranches, validFrom, validTo } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "اسم نظام العمولة مطلوب" });
      }
      if (!commissionType || !['fixed', 'percentage', 'tiered'].includes(commissionType)) {
        return res.status(400).json({ error: "نوع العمولة غير صالح" });
      }
      
      const rate = await storage.createCommissionRate({
        name,
        description: description || null,
        minSalesAmount: typeof minSalesAmount === 'string' ? parseFloat(minSalesAmount) : (minSalesAmount || 0),
        maxSalesAmount: maxSalesAmount ? (typeof maxSalesAmount === 'string' ? parseFloat(maxSalesAmount) : maxSalesAmount) : null,
        commissionType,
        fixedAmount: fixedAmount ? (typeof fixedAmount === 'string' ? parseFloat(fixedAmount) : fixedAmount) : null,
        percentageRate: percentageRate ? (typeof percentageRate === 'string' ? parseFloat(percentageRate) : percentageRate) : null,
        applicableTo: applicableTo || 'cashier',
        applicableBranches: applicableBranches || null,
        isActive: true,
        validFrom: validFrom || null,
        validTo: validTo || null,
        createdBy: req.currentUser?.id
      });
      res.status(201).json(rate);
    } catch (error) {
      console.error("Error creating commission rate:", error);
      res.status(500).json({ error: "Failed to create commission rate" });
    }
  });

  app.patch("/api/commission-rates/:id", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const rate = await storage.updateCommissionRate(id, req.body);
      if (!rate) {
        return res.status(404).json({ error: "نظام العمولة غير موجود" });
      }
      res.json(rate);
    } catch (error) {
      console.error("Error updating commission rate:", error);
      res.status(500).json({ error: "Failed to update commission rate" });
    }
  });

  app.delete("/api/commission-rates/:id", isAuthenticated, requirePermission("operations", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      await storage.deleteCommissionRate(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting commission rate:", error);
      res.status(500).json({ error: "Failed to delete commission rate" });
    }
  });

  // ==========================================
  // Commission Calculations Routes
  // ==========================================

  app.get("/api/commissions", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { branchId, cashierId, status } = req.query;
      let commissions = await storage.getAllCommissionCalculations();
      
      if (branchId) {
        commissions = commissions.filter(c => c.branchId === branchId);
      }
      if (cashierId) {
        commissions = commissions.filter(c => c.cashierId === cashierId);
      }
      if (status) {
        commissions = commissions.filter(c => c.status === status);
      }
      
      res.json(commissions);
    } catch (error) {
      console.error("Error fetching commissions:", error);
      res.status(500).json({ error: "Failed to fetch commissions" });
    }
  });

  app.post("/api/commissions/calculate", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const { cashierId, periodStart, periodEnd } = req.body;
      
      if (!cashierId || !periodStart || !periodEnd) {
        return res.status(400).json({ error: "الكاشير وفترة الحساب مطلوبة" });
      }
      
      const result = await storage.calculateCashierCommission(cashierId, periodStart, periodEnd);
      res.json(result);
    } catch (error) {
      console.error("Error calculating commission:", error);
      res.status(500).json({ error: "Failed to calculate commission" });
    }
  });

  app.post("/api/commissions", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const { cashierId, branchId, periodStart, periodEnd, totalSales, targetAmount, achievementPercent, rateId, calculatedCommission, finalCommission, journalIds, notes } = req.body;
      
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ error: "فترة الحساب مطلوبة" });
      }
      
      const parsedTotalSales = typeof totalSales === 'string' ? parseFloat(totalSales) : totalSales;
      const parsedCalculated = typeof calculatedCommission === 'string' ? parseFloat(calculatedCommission) : calculatedCommission;
      const parsedFinal = typeof finalCommission === 'string' ? parseFloat(finalCommission) : (finalCommission || parsedCalculated);
      
      if (isNaN(parsedTotalSales) || isNaN(parsedCalculated) || isNaN(parsedFinal)) {
        return res.status(400).json({ error: "قيم المبيعات والعمولة غير صالحة" });
      }
      
      const commission = await storage.createCommissionCalculation({
        cashierId: cashierId || null,
        branchId: branchId || null,
        periodStart,
        periodEnd,
        totalSales: parsedTotalSales,
        targetAmount: targetAmount ? (typeof targetAmount === 'string' ? parseFloat(targetAmount) : targetAmount) : null,
        achievementPercent: achievementPercent ? (typeof achievementPercent === 'string' ? parseFloat(achievementPercent) : achievementPercent) : null,
        rateId: rateId ? parseInt(rateId, 10) : null,
        calculatedCommission: parsedCalculated,
        finalCommission: parsedFinal,
        status: 'pending',
        journalIds: journalIds || null,
        notes: notes || null,
        createdBy: req.currentUser?.id
      });
      res.status(201).json(commission);
    } catch (error) {
      console.error("Error creating commission:", error);
      res.status(500).json({ error: "Failed to create commission" });
    }
  });

  app.patch("/api/commissions/:id/approve", isAuthenticated, requirePermission("operations", "edit"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const commission = await storage.approveCommissionCalculation(id, req.currentUser?.id);
      if (!commission) {
        return res.status(404).json({ error: "العمولة غير موجودة" });
      }
      res.json(commission);
    } catch (error) {
      console.error("Error approving commission:", error);
      res.status(500).json({ error: "Failed to approve commission" });
    }
  });

  app.patch("/api/commissions/:id/pay", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const commission = await storage.markCommissionAsPaid(id);
      if (!commission) {
        return res.status(404).json({ error: "العمولة غير موجودة" });
      }
      res.json(commission);
    } catch (error) {
      console.error("Error marking commission as paid:", error);
      res.status(500).json({ error: "Failed to mark commission as paid" });
    }
  });

  // ==========================================
  // Target Alerts Routes
  // ==========================================

  app.get("/api/targets/alerts", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { yearMonth } = req.query;
      
      if (!yearMonth) {
        return res.status(400).json({ error: "yearMonth is required" });
      }
      
      const alerts = await storage.getTargetAlerts(yearMonth as string);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching target alerts:", error);
      res.status(500).json({ error: "Failed to fetch target alerts" });
    }
  });

  // ==========================================
  // Sales Analytics Routes - تحليلات المبيعات
  // ==========================================

  // Targets vs Actuals - مقارنة الأهداف بالفعليات
  app.get("/api/analytics/targets-vs-actuals", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { branchId, fromDate, toDate, status, discrepancyType } = req.query;
      
      if (!fromDate || !toDate) {
        return res.status(400).json({ error: "fromDate and toDate are required" });
      }
      
      const data = await storage.getTargetsVsActuals(
        branchId as string | null,
        fromDate as string,
        toDate as string,
        status as string | undefined,
        discrepancyType as string | undefined
      );
      res.json(data);
    } catch (error) {
      console.error("Error fetching targets vs actuals:", error);
      res.status(500).json({ error: "Failed to fetch targets vs actuals" });
    }
  });

  // Shift Analytics - تحليلات الورديات
  app.get("/api/analytics/shifts", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { branchId, fromDate, toDate, status, discrepancyType } = req.query;
      
      if (!fromDate || !toDate) {
        return res.status(400).json({ error: "fromDate and toDate are required" });
      }
      
      const data = await storage.getShiftAnalytics(
        branchId as string | null,
        fromDate as string,
        toDate as string,
        status as string | undefined,
        discrepancyType as string | undefined
      );
      res.json(data);
    } catch (error) {
      console.error("Error fetching shift analytics:", error);
      res.status(500).json({ error: "Failed to fetch shift analytics" });
    }
  });

  // Cashier Leaderboard - ترتيب الكاشيرين
  app.get("/api/analytics/cashier-leaderboard", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { branchId, fromDate, toDate, status, discrepancyType } = req.query;
      
      if (!fromDate || !toDate) {
        return res.status(400).json({ error: "fromDate and toDate are required" });
      }
      
      const data = await storage.getCashierLeaderboard(
        branchId as string | null,
        fromDate as string,
        toDate as string,
        status as string | undefined,
        discrepancyType as string | undefined
      );
      
      // Get incentive tiers to enrich the leaderboard
      const incentiveTiers = await storage.getActiveIncentiveTiers();
      
      // Get monthly targets for the period to calculate achievement
      const yearMonth = (fromDate as string).substring(0, 7);
      
      // Enrich each cashier with their incentive tier
      const enrichedData = await Promise.all(data.map(async (cashier) => {
        // Get branch target for calculating achievement
        const branchTarget = await storage.getBranchMonthlyTargetByMonth(cashier.branchId, yearMonth);
        const targetAmount = branchTarget?.targetAmount || 0;
        const achievementPercent = targetAmount > 0 ? (cashier.totalSales / targetAmount) * 100 : 0;
        
        // Find applicable incentive tier
        const applicableTier = incentiveTiers.find(tier => {
          const minOk = achievementPercent >= (tier.minAchievementPercent || 0);
          const maxOk = !tier.maxAchievementPercent || achievementPercent <= tier.maxAchievementPercent;
          return minOk && maxOk && (tier.applicableTo === 'all' || tier.applicableTo === 'cashier');
        });
        
        // Calculate potential reward
        let calculatedReward = 0;
        if (applicableTier) {
          if (applicableTier.rewardType === 'fixed' && applicableTier.fixedAmount) {
            calculatedReward = applicableTier.fixedAmount;
          } else if (applicableTier.rewardType === 'percentage' && applicableTier.percentageRate) {
            const excessSales = cashier.totalSales - targetAmount;
            calculatedReward = excessSales > 0 ? (excessSales * applicableTier.percentageRate) / 100 : 0;
          } else if (applicableTier.rewardType === 'both') {
            if (applicableTier.fixedAmount) calculatedReward += applicableTier.fixedAmount;
            if (applicableTier.percentageRate) {
              const excessSales = cashier.totalSales - targetAmount;
              if (excessSales > 0) calculatedReward += (excessSales * applicableTier.percentageRate) / 100;
            }
          }
        }
        
        return {
          ...cashier,
          targetAmount,
          achievementPercent,
          incentiveTier: applicableTier ? {
            id: applicableTier.id,
            name: applicableTier.name,
            minPercent: applicableTier.minAchievementPercent,
            maxPercent: applicableTier.maxAchievementPercent
          } : null,
          calculatedReward
        };
      }));
      
      res.json(enrichedData);
    } catch (error) {
      console.error("Error fetching cashier leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch cashier leaderboard" });
    }
  });

  // Branch Competition - منافسة الفروع
  app.get("/api/analytics/branch-competition", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { fromDate, toDate, status, discrepancyType } = req.query;
      
      if (!fromDate || !toDate) {
        return res.status(400).json({ error: "fromDate and toDate are required" });
      }
      
      const yearMonth = (fromDate as string).substring(0, 7);
      const branches = await storage.getAllBranches();
      const incentiveTiers = await storage.getActiveIncentiveTiers();
      
      const branchStats = await Promise.all(branches.map(async (branch) => {
        // Get branch target
        const branchTarget = await storage.getBranchMonthlyTargetByMonth(branch.id, yearMonth);
        const targetAmount = branchTarget?.targetAmount || 0;
        
        // Get cashier leaderboard for this branch to sum sales
        const cashiers = await storage.getCashierLeaderboard(
          branch.id, 
          fromDate as string, 
          toDate as string,
          status as string | undefined,
          discrepancyType as string | undefined
        );
        const totalSales = cashiers.reduce((sum, c) => sum + c.totalSales, 0);
        const cashierCount = cashiers.length;
        const totalTransactions = cashiers.reduce((sum, c) => sum + c.transactionsCount, 0);
        
        const achievementPercent = targetAmount > 0 ? (totalSales / targetAmount) * 100 : 0;
        const variance = totalSales - targetAmount;
        
        // Find applicable incentive tier for branch
        const applicableTier = incentiveTiers.find(tier => {
          const minOk = achievementPercent >= (tier.minAchievementPercent || 0);
          const maxOk = !tier.maxAchievementPercent || achievementPercent <= tier.maxAchievementPercent;
          return minOk && maxOk && (tier.applicableTo === 'all' || tier.applicableTo === 'branch');
        });
        
        // Calculate potential reward
        let calculatedReward = 0;
        if (applicableTier) {
          if (applicableTier.rewardType === 'fixed' && applicableTier.fixedAmount) {
            calculatedReward = applicableTier.fixedAmount;
          } else if (applicableTier.rewardType === 'percentage' && applicableTier.percentageRate) {
            const excessSales = totalSales - targetAmount;
            calculatedReward = excessSales > 0 ? (excessSales * applicableTier.percentageRate) / 100 : 0;
          } else if (applicableTier.rewardType === 'both') {
            if (applicableTier.fixedAmount) calculatedReward += applicableTier.fixedAmount;
            if (applicableTier.percentageRate) {
              const excessSales = totalSales - targetAmount;
              if (excessSales > 0) calculatedReward += (excessSales * applicableTier.percentageRate) / 100;
            }
          }
        }
        
        return {
          branchId: branch.id,
          branchName: branch.name,
          targetAmount,
          totalSales,
          achievementPercent,
          variance,
          cashierCount,
          totalTransactions,
          averageTicket: totalTransactions > 0 ? totalSales / totalTransactions : 0,
          incentiveTier: applicableTier ? {
            id: applicableTier.id,
            name: applicableTier.name,
            minPercent: applicableTier.minAchievementPercent,
            maxPercent: applicableTier.maxAchievementPercent
          } : null,
          calculatedReward,
          rank: 0
        };
      }));
      
      // Sort by achievement percent and assign ranks
      branchStats.sort((a, b) => b.achievementPercent - a.achievementPercent);
      branchStats.forEach((branch, idx) => { branch.rank = idx + 1; });
      
      res.json(branchStats);
    } catch (error) {
      console.error("Error fetching branch competition:", error);
      res.status(500).json({ error: "Failed to fetch branch competition" });
    }
  });

  // Average Ticket Analysis - تحليل متوسط الفاتورة
  app.get("/api/analytics/average-ticket", isAuthenticated, requirePermission("operations", "view"), async (req, res) => {
    try {
      const { branchId, groupBy, fromDate, toDate, status, discrepancyType } = req.query;
      
      if (!fromDate || !toDate) {
        return res.status(400).json({ error: "fromDate and toDate are required" });
      }
      
      const validGroupBy = ['shift', 'cashier', 'date'].includes(groupBy as string) ? groupBy as 'shift' | 'cashier' | 'date' : 'shift';
      
      const data = await storage.getAverageTicketAnalysis(
        branchId as string | null,
        validGroupBy,
        fromDate as string,
        toDate as string,
        status as string | undefined,
        discrepancyType as string | undefined
      );
      res.json(data);
    } catch (error) {
      console.error("Error fetching average ticket analysis:", error);
      res.status(500).json({ error: "Failed to fetch average ticket analysis" });
    }
  });

  // Compute/Update Branch Daily Sales Summary
  app.post("/api/analytics/compute-daily-sales", isAuthenticated, requirePermission("operations", "edit"), async (req, res) => {
    try {
      const { branchId, salesDate } = req.body;
      
      if (!branchId || !salesDate) {
        return res.status(400).json({ error: "branchId and salesDate are required" });
      }
      
      const summary = await storage.computeBranchDailySales(branchId, salesDate);
      res.json(summary);
    } catch (error) {
      console.error("Error computing daily sales:", error);
      res.status(500).json({ error: "Failed to compute daily sales" });
    }
  });

  // ===== Display Bar Routes =====

  // Get Display Bar Receipts
  app.get("/api/display-bar/receipts", isAuthenticated, requirePermission("operations", "view"), async (req: any, res) => {
    try {
      const queryBranchId = req.query.branchId as string | undefined;
      const date = req.query.date as string | undefined;
      
      // Apply branch filter for non-admin users
      const activeBranch = getActiveBranchFilter(req);
      const user = req.currentUser;
      
      let branchId = queryBranchId;
      if (user?.role !== "admin") {
        if (!activeBranch) return res.json([]);
        branchId = activeBranch;
      }
      
      const receipts = await storage.getDisplayBarReceipts(branchId, date);
      res.json(receipts);
    } catch (error) {
      console.error("Error fetching display bar receipts:", error);
      res.status(500).json({ error: "Failed to fetch display bar receipts" });
    }
  });

  // Create Display Bar Receipt
  app.post("/api/display-bar/receipts", isAuthenticated, requirePermission("operations", "create"), requireBranchAccess, async (req: any, res) => {
    try {
      // Verify branch access
      const user = req.currentUser;
      if (user?.role !== "admin" && req.body.branchId) {
        const hasAccess = await canAccessBranch(req, req.body.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لهذا الفرع" });
        }
      }
      
      const validatedData = insertDisplayBarReceiptSchema.parse(req.body);
      const receipt = await storage.createDisplayBarReceipt(validatedData);
      res.status(201).json(receipt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating display bar receipt:", error);
      res.status(500).json({ error: "Failed to create display bar receipt" });
    }
  });

  // Get Display Bar Daily Summary
  app.get("/api/display-bar/summary", isAuthenticated, requirePermission("operations", "view"), async (req: any, res) => {
    try {
      const queryBranchId = req.query.branchId as string | undefined;
      const date = req.query.date as string | undefined;
      
      // Apply branch filter for non-admin users
      const activeBranch = getActiveBranchFilter(req);
      const user = req.currentUser;
      
      let branchId = queryBranchId;
      if (user?.role !== "admin") {
        if (!activeBranch) return res.json([]);
        branchId = activeBranch;
      }
      
      const summaries = await storage.getDisplayBarDailySummary(branchId, date);
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching display bar summary:", error);
      res.status(500).json({ error: "Failed to fetch display bar summary" });
    }
  });

  // Update Display Bar Daily Summary
  app.patch("/api/display-bar/summary/:id", isAuthenticated, requirePermission("operations", "edit"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid summary ID" });
      }
      
      // Get existing summary to check branch access
      const existingSummaries = await storage.getDisplayBarDailySummary(undefined, undefined);
      const existingSummary = existingSummaries.find((s: any) => s.id === id);
      if (!existingSummary) {
        return res.status(404).json({ error: "Summary not found" });
      }
      
      const user = req.currentUser;
      if (user?.role !== "admin" && existingSummary.branchId) {
        const hasAccess = await canAccessBranch(req, existingSummary.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لتعديل بيانات هذا الفرع" });
        }
      }
      
      const partialData = insertDisplayBarDailySummarySchema.partial().parse(req.body);
      
      // Prevent branchId changes for non-admin users
      if (user?.role !== "admin" && partialData.branchId && partialData.branchId !== existingSummary.branchId) {
        return res.status(403).json({ error: "لا يمكن تغيير الفرع" });
      }
      
      const summary = await storage.updateDisplayBarDailySummary(id, partialData);
      res.json(summary);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating display bar summary:", error);
      res.status(500).json({ error: "Failed to update display bar summary" });
    }
  });

  // ===== Waste Reports Routes =====

  // Get Waste Analytics - waste vs sales comparison (must be before /:id route)
  app.get("/api/waste-reports/analytics", isAuthenticated, requirePermission("operations", "view"), async (req: any, res) => {
    try {
      const queryBranchId = req.query.branchId as string | undefined;
      const date = req.query.date as string || new Date().toISOString().split('T')[0];
      
      // Apply branch filter for non-admin users
      const activeBranch = getActiveBranchFilter(req);
      const user = req.currentUser;
      
      let branchId = queryBranchId;
      if (user?.role !== "admin") {
        if (!activeBranch) return res.json({ error: "يجب تحديد الفرع" });
        branchId = activeBranch;
      }
      
      // Get current month date range
      const currentMonth = date.substring(0, 7);
      const monthStart = `${currentMonth}-01`;
      const monthEnd = `${currentMonth}-31`;
      
      // Get daily waste reports
      const dailyWasteReports = await storage.getWasteReports(branchId, date, date);
      const dailyWasteValue = dailyWasteReports.reduce((sum, r) => sum + (r.totalValue || 0), 0);
      const dailyWasteItems = dailyWasteReports.reduce((sum, r) => sum + (r.totalItems || 0), 0);
      
      // Get monthly waste reports
      const monthlyWasteReports = await storage.getWasteReports(branchId, monthStart, monthEnd);
      const monthlyWasteValue = monthlyWasteReports.reduce((sum, r) => sum + (r.totalValue || 0), 0);
      const monthlyWasteItems = monthlyWasteReports.reduce((sum, r) => sum + (r.totalItems || 0), 0);
      
      // Get daily sales from cashier journals
      const allJournals = await storage.getAllCashierJournals();
      const dailyJournals = allJournals.filter(j => 
        j.journalDate === date && (!branchId || j.branchId === branchId)
      );
      const dailySales = dailyJournals.reduce((sum, j) => sum + (j.totalSales || 0), 0);
      
      // Get monthly sales
      const monthlyJournals = allJournals.filter(j => 
        j.journalDate >= monthStart && j.journalDate <= monthEnd && 
        (!branchId || j.branchId === branchId)
      );
      const monthlySales = monthlyJournals.reduce((sum, j) => sum + (j.totalSales || 0), 0);
      
      // Calculate waste percentages
      const dailyWastePercent = dailySales > 0 ? (dailyWasteValue / dailySales) * 100 : 0;
      const monthlyWastePercent = monthlySales > 0 ? (monthlyWasteValue / monthlySales) * 100 : 0;
      
      // Get waste by reason
      const wasteByReason: Record<string, { count: number; value: number }> = {};
      for (const report of dailyWasteReports) {
        const items = await storage.getWasteItems(report.id);
        for (const item of items) {
          const reason = item.wasteReason || 'other';
          if (!wasteByReason[reason]) {
            wasteByReason[reason] = { count: 0, value: 0 };
          }
          wasteByReason[reason].count += item.quantity || 0;
          wasteByReason[reason].value += item.totalValue || 0;
        }
      }
      
      res.json({
        date,
        branchId: branchId || 'all',
        daily: {
          wasteValue: dailyWasteValue,
          wasteItems: dailyWasteItems,
          sales: dailySales,
          wastePercent: Math.round(dailyWastePercent * 100) / 100,
          reportsCount: dailyWasteReports.length,
        },
        monthly: {
          wasteValue: monthlyWasteValue,
          wasteItems: monthlyWasteItems,
          sales: monthlySales,
          wastePercent: Math.round(monthlyWastePercent * 100) / 100,
          reportsCount: monthlyWasteReports.length,
        },
        wasteByReason,
      });
    } catch (error) {
      console.error("Error fetching waste analytics:", error);
      res.status(500).json({ error: "فشل في جلب إحصائيات الهالك" });
    }
  });

  // Get Waste Stats - today's summary by branch (must be before /:id route)
  app.get("/api/waste-reports/stats", isAuthenticated, requirePermission("operations", "view"), async (req: any, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const queryBranchId = req.query.branchId as string | undefined;
      
      // Apply branch filter for non-admin users
      const activeBranch = getActiveBranchFilter(req);
      const user = req.currentUser;
      
      let branchId = queryBranchId;
      if (user?.role !== "admin") {
        if (!activeBranch) return res.json([]);
        branchId = activeBranch;
      }
      
      const reports = await storage.getWasteReports(branchId, today, today);
      
      const branchStats = new Map<string, { totalItems: number; totalValue: number; reportCount: number }>();
      
      for (const report of reports) {
        const existing = branchStats.get(report.branchId) || { totalItems: 0, totalValue: 0, reportCount: 0 };
        branchStats.set(report.branchId, {
          totalItems: existing.totalItems + (report.totalItems || 0),
          totalValue: existing.totalValue + (report.totalValue || 0),
          reportCount: existing.reportCount + 1,
        });
      }
      
      const stats = Array.from(branchStats.entries()).map(([branchId, data]) => ({
        branchId,
        date: today,
        ...data,
      }));
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching waste stats:", error);
      res.status(500).json({ error: "Failed to fetch waste stats" });
    }
  });

  // Get All Waste Reports
  app.get("/api/waste-reports", isAuthenticated, requirePermission("operations", "view"), async (req: any, res) => {
    try {
      const queryBranchId = req.query.branchId as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      
      // Get branch filter from session for non-admin users
      const activeBranch = getActiveBranchFilter(req);
      const user = req.currentUser;
      
      // For non-admin users, filter by their active branch
      let branchId = queryBranchId;
      if (user?.role !== "admin") {
        if (!activeBranch) {
          return res.json([]); // No branch = no data
        }
        branchId = activeBranch;
      }
      
      const reports = await storage.getWasteReports(branchId, dateFrom, dateTo);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching waste reports:", error);
      res.status(500).json({ error: "Failed to fetch waste reports" });
    }
  });

  // Get Single Waste Report
  app.get("/api/waste-reports/:id", isAuthenticated, requirePermission("operations", "view"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid report ID" });
      }
      const report = await storage.getWasteReport(id);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      // Verify branch access for non-admin users
      const user = req.currentUser;
      if (user?.role !== "admin" && report.branchId) {
        const hasAccess = await canAccessBranch(req, report.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية للوصول لهذا التقرير" });
        }
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching waste report:", error);
      res.status(500).json({ error: "Failed to fetch waste report" });
    }
  });

  // Create Waste Report
  app.post("/api/waste-reports", isAuthenticated, requirePermission("operations", "create"), requireBranchAccess, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      
      // Verify user has access to the target branch
      if (currentUser?.role !== "admin" && req.body.branchId) {
        const hasAccess = await canAccessBranch(req, req.body.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لإنشاء تقرير هدر لهذا الفرع" });
        }
      }
      
      const validatedData = insertWasteReportSchema.parse({
        ...req.body,
        reportedBy: currentUser?.id,
        reporterName: currentUser ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() : null,
      });
      const report = await storage.createWasteReport(validatedData);
      res.status(201).json(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating waste report:", error);
      res.status(500).json({ error: "Failed to create waste report" });
    }
  });

  // Update Waste Report
  app.patch("/api/waste-reports/:id", isAuthenticated, requirePermission("operations", "edit"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid report ID" });
      }
      
      // Check existing report's branch access
      const existingReport = await storage.getWasteReport(id);
      if (!existingReport) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      const user = req.currentUser;
      if (user?.role !== "admin" && existingReport.branchId) {
        const hasAccess = await canAccessBranch(req, existingReport.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لتعديل تقارير هذا الفرع" });
        }
      }
      
      const partialData = insertWasteReportSchema.partial().parse(req.body);
      
      if (req.body.status === 'approved') {
        (partialData as any).approvedBy = user?.id;
        (partialData as any).approvedAt = new Date();
      }
      
      const report = await storage.updateWasteReport(id, partialData);
      res.json(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating waste report:", error);
      res.status(500).json({ error: "Failed to update waste report" });
    }
  });

  // Delete Waste Report
  app.delete("/api/waste-reports/:id", isAuthenticated, requirePermission("operations", "delete"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid report ID" });
      }
      
      // Check existing report's branch access
      const existingReport = await storage.getWasteReport(id);
      if (!existingReport) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      const user = req.currentUser;
      if (user?.role !== "admin" && existingReport.branchId) {
        const hasAccess = await canAccessBranch(req, existingReport.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لحذف تقارير هذا الفرع" });
        }
      }
      
      const success = await storage.deleteWasteReport(id);
      if (!success) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting waste report:", error);
      res.status(500).json({ error: "Failed to delete waste report" });
    }
  });

  // ===== Waste Items Routes =====

  // Get Waste Items for a Report
  app.get("/api/waste-reports/:reportId/items", isAuthenticated, requirePermission("operations", "view"), async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.reportId, 10);
      if (isNaN(reportId)) {
        return res.status(400).json({ error: "Invalid report ID" });
      }
      
      // Verify branch access for the parent report
      const report = await storage.getWasteReport(reportId);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      const user = req.currentUser;
      if (user?.role !== "admin" && report.branchId) {
        const hasAccess = await canAccessBranch(req, report.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية للوصول لهذا التقرير" });
        }
      }
      
      const items = await storage.getWasteItems(reportId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching waste items:", error);
      res.status(500).json({ error: "Failed to fetch waste items" });
    }
  });

  // Create Waste Item
  app.post("/api/waste-reports/:reportId/items", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.reportId, 10);
      if (isNaN(reportId)) {
        return res.status(400).json({ error: "Invalid report ID" });
      }
      
      const report = await storage.getWasteReport(reportId);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      
      // Verify branch access for the parent report
      const user = req.currentUser;
      if (user?.role !== "admin" && report.branchId) {
        const hasAccess = await canAccessBranch(req, report.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لإضافة عناصر لتقارير هذا الفرع" });
        }
      }
      
      const validatedData = insertWasteItemSchema.parse({
        ...req.body,
        wasteReportId: reportId,
      });
      const item = await storage.createWasteItem(validatedData);
      
      const allItems = await storage.getWasteItems(reportId);
      const totalItems = allItems.reduce((sum, i) => sum + i.quantity, 0);
      const totalValue = allItems.reduce((sum, i) => sum + (i.totalValue || 0), 0);
      await storage.updateWasteReport(reportId, { totalItems, totalValue });
      
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating waste item:", error);
      res.status(500).json({ error: "Failed to create waste item" });
    }
  });

  // Update Waste Item
  app.patch("/api/waste-items/:id", isAuthenticated, requirePermission("operations", "edit"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      
      // First get the existing item to check branch access BEFORE updating
      const existingItem = await storage.getWasteItemById(id);
      if (!existingItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      // Check branch access via parent report BEFORE updating
      const report = await storage.getWasteReport(existingItem.wasteReportId);
      const user = req.currentUser;
      if (user?.role !== "admin" && report?.branchId) {
        const hasAccess = await canAccessBranch(req, report.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لتعديل عناصر هذا الفرع" });
        }
      }
      
      // Now proceed with the update
      const partialData = insertWasteItemSchema.partial().parse(req.body);
      
      // Prevent wasteReportId changes for non-admin users (would bypass branch access)
      if (user?.role !== "admin" && partialData.wasteReportId && partialData.wasteReportId !== existingItem.wasteReportId) {
        return res.status(403).json({ error: "لا يمكن نقل العنصر لتقرير آخر" });
      }
      
      const item = await storage.updateWasteItem(id, partialData);
      
      const allItems = await storage.getWasteItems(existingItem.wasteReportId);
      const totalItems = allItems.reduce((sum, i) => sum + i.quantity, 0);
      const totalValue = allItems.reduce((sum, i) => sum + (i.totalValue || 0), 0);
      await storage.updateWasteReport(existingItem.wasteReportId, { totalItems, totalValue });
      
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error updating waste item:", error);
      res.status(500).json({ error: "Failed to update waste item" });
    }
  });

  // Delete Waste Item
  app.delete("/api/waste-items/:id", isAuthenticated, requirePermission("operations", "delete"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      
      // Get the item directly using getWasteItemById
      const targetItem = await storage.getWasteItemById(id);
      if (!targetItem) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      // Get parent report to check branch access
      const parentReport = await storage.getWasteReport(targetItem.wasteReportId);
      if (!parentReport) {
        return res.status(404).json({ error: "Parent report not found" });
      }
      
      // Check branch access via parent report BEFORE deleting
      const user = req.currentUser;
      if (user?.role !== "admin" && parentReport.branchId) {
        const hasAccess = await canAccessBranch(req, parentReport.branchId);
        if (!hasAccess) {
          return res.status(403).json({ error: "ليس لديك صلاحية لحذف عناصر هذا الفرع" });
        }
      }
      
      const success = await storage.deleteWasteItem(id);
      if (!success) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const remainingItems = await storage.getWasteItems(targetItem.wasteReportId);
      const totalItems = remainingItems.reduce((sum, i) => sum + i.quantity, 0);
      const totalValue = remainingItems.reduce((sum, i) => sum + (i.totalValue || 0), 0);
      await storage.updateWasteReport(targetItem.wasteReportId, { totalItems, totalValue });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting waste item:", error);
      res.status(500).json({ error: "Failed to delete waste item" });
    }
  });

  // ==================== Advanced Production Orders ====================
  
  // Get all advanced production orders
  app.get("/api/advanced-production-orders", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const { branchId, status, orderType } = req.query;
      console.log("Fetching advanced production orders with filters:", { branchId, status, orderType });
      let orders = await storage.getAllAdvancedProductionOrders();
      console.log("Found orders in DB:", orders.length);
      
      if (branchId && typeof branchId === 'string') {
        orders = orders.filter(o => o.sourceBranchId === branchId || o.targetBranchId === branchId);
        console.log("After branchId filter:", orders.length);
      }
      if (status && typeof status === 'string') {
        orders = orders.filter(o => o.status === status);
        console.log("After status filter:", orders.length);
      }
      if (orderType && typeof orderType === 'string') {
        orders = orders.filter(o => o.orderType === orderType);
        console.log("After orderType filter:", orders.length);
      }
      
      console.log("Returning orders:", orders.length);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching production orders:", error);
      res.status(500).json({ error: "Failed to fetch production orders" });
    }
  });

  // Get production order stats
  app.get("/api/advanced-production-orders/stats", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const stats = await storage.getAdvancedProductionOrderStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching production order stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Get single production order with items
  app.get("/api/advanced-production-orders/:id", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid order ID" });
      }
      
      const result = await storage.getAdvancedProductionOrderWithItems(id);
      if (!result) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      const schedules = await storage.getProductionOrderSchedules(id);
      res.json({ ...result, schedules });
    } catch (error) {
      console.error("Error fetching production order:", error);
      res.status(500).json({ error: "Failed to fetch production order" });
    }
  });

  // Create production order
  app.post("/api/advanced-production-orders", isAuthenticated, requirePermission("production", "create"), async (req, res) => {
    try {
      const { items, schedules, ...orderData } = req.body;
      
      // Generate order number
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      orderData.orderNumber = `PO-${timestamp}-${random}`;
      orderData.createdBy = (req as any).user?.id;
      
      const order = await storage.createAdvancedProductionOrder(orderData);
      
      // Create items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        const itemsWithOrderId = items.map((item: any) => ({
          ...item,
          orderId: order.id
        }));
        await storage.bulkCreateProductionOrderItems(itemsWithOrderId);
        
        // Update order totals
        await storage.updateAdvancedProductionOrder(order.id, {
          totalItems: items.length,
          estimatedCost: items.reduce((sum: number, i: any) => sum + (i.totalValue || 0), 0)
        });
      }
      
      // Create schedules if provided
      if (schedules && Array.isArray(schedules) && schedules.length > 0) {
        const schedulesWithOrderId = schedules.map((s: any) => ({
          ...s,
          orderId: order.id
        }));
        await storage.bulkCreateProductionOrderSchedules(schedulesWithOrderId);
      }
      
      const result = await storage.getAdvancedProductionOrderWithItems(order.id);
      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error creating production order:", error);
      console.error("Error details:", error?.message, error?.code, error?.detail);
      
      // Return detailed error message
      let errorMessage = "فشل في إنشاء أمر الإنتاج";
      if (error?.code === '23503') {
        errorMessage = "خطأ: المنتج أو الفرع غير موجود في قاعدة البيانات - " + (error?.detail || '');
      } else if (error?.code === '23505') {
        errorMessage = "خطأ: رقم الأمر مكرر";
      } else if (error?.message) {
        errorMessage = "خطأ: " + error.message;
      }
      
      res.status(500).json({ error: errorMessage, details: error?.message, code: error?.code });
    }
  });

  // Update production order
  app.patch("/api/advanced-production-orders/:id", isAuthenticated, requirePermission("production", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid order ID" });
      }
      
      const { items, ...updateData } = req.body;
      
      // Handle approval
      if (updateData.status === 'approved') {
        updateData.approvedBy = (req as any).user?.id;
        updateData.approvedAt = new Date();
      }
      
      const order = await storage.updateAdvancedProductionOrder(id, updateData);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      const result = await storage.getAdvancedProductionOrderWithItems(id);
      res.json(result);
    } catch (error) {
      console.error("Error updating production order:", error);
      res.status(500).json({ error: "Failed to update production order" });
    }
  });

  // Delete production order
  app.delete("/api/advanced-production-orders/:id", isAuthenticated, requirePermission("production", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid order ID" });
      }
      
      const success = await storage.deleteAdvancedProductionOrder(id);
      if (!success) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting production order:", error);
      res.status(500).json({ error: "Failed to delete production order" });
    }
  });

  // ==================== Production Order Items ====================
  
  // Add item to order
  app.post("/api/advanced-production-orders/:orderId/items", isAuthenticated, requirePermission("production", "edit"), async (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId, 10);
      if (isNaN(orderId)) {
        return res.status(400).json({ error: "Invalid order ID" });
      }
      
      const item = await storage.createProductionOrderItem({
        ...req.body,
        orderId
      });
      
      // Update order totals
      const allItems = await storage.getProductionOrderItems(orderId);
      await storage.updateAdvancedProductionOrder(orderId, {
        totalItems: allItems.length,
        estimatedCost: allItems.reduce((sum, i) => sum + (i.totalValue || 0), 0)
      });
      
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding order item:", error);
      res.status(500).json({ error: "Failed to add item" });
    }
  });

  // Update order item
  app.patch("/api/production-order-items/:id", isAuthenticated, requirePermission("production", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      
      const item = await storage.updateProductionOrderItem(id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      // Update order completion percentage
      const allItems = await storage.getProductionOrderItems(item.orderId);
      const completedItems = allItems.filter(i => i.status === 'completed').length;
      const completionPercent = allItems.length > 0 ? (completedItems / allItems.length) * 100 : 0;
      
      await storage.updateAdvancedProductionOrder(item.orderId, {
        completedItems,
        completionPercent,
        actualCost: allItems.reduce((sum, i) => sum + ((i.producedQuantity || 0) * (i.unitPrice || 0)), 0)
      });
      
      res.json(item);
    } catch (error) {
      console.error("Error updating order item:", error);
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  // Delete order item
  app.delete("/api/production-order-items/:id", isAuthenticated, requirePermission("production", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      
      const success = await storage.deleteProductionOrderItem(id);
      if (!success) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting order item:", error);
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  // ==================== AI Production Plans ====================
  
  // Get all AI plans
  app.get("/api/production-ai-plans", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const plans = await storage.getAllProductionAiPlans();
      // Format response for frontend compatibility
      const formattedPlans = plans.map(plan => ({
        id: plan.id,
        branchId: plan.branchId,
        planDate: plan.planDate,
        targetSales: plan.targetSalesValue,
        confidenceScore: plan.confidenceScore,
        totalEstimatedValue: plan.totalEstimatedValue,
        estimatedCost: plan.totalEstimatedCost,
        profitMargin: plan.profitMargin,
        status: plan.status,
        products: plan.recommendedProducts || [],
        salesDataFileId: plan.datasetId,
        appliedOrderId: plan.appliedToOrderId,
        createdAt: plan.createdAt
      }));
      res.json(formattedPlans);
    } catch (error) {
      console.error("Error fetching AI plans:", error);
      res.status(500).json({ error: "Failed to fetch AI plans" });
    }
  });

  // Delete AI production plan
  app.delete("/api/production-ai-plans/:id", isAuthenticated, requirePermission("production", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }
      
      const success = await storage.deleteProductionAiPlan(id);
      if (!success) {
        return res.status(404).json({ error: "Plan not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting AI plan:", error);
      res.status(500).json({ error: "Failed to delete AI plan" });
    }
  });

  // Generate AI production plan
  app.post("/api/production-ai-plans/generate", isAuthenticated, requirePermission("production", "create"), async (req, res) => {
    try {
      const { branchId, targetSalesValue, planDate, uploadId } = req.body;
      
      if (!branchId || !targetSalesValue || !planDate) {
        return res.status(400).json({ error: "Missing required fields: branchId, targetSalesValue, planDate" });
      }
      
      // Get products and their sales analytics if available
      const products = await storage.getAllProducts();
      let productAnalytics: any[] = [];
      let salesDataUpload = null;
      let uploadFileName = null;
      let uploadAnalyticsSummary: any = null;
      
      if (uploadId) {
        productAnalytics = await storage.getProductSalesAnalytics(parseInt(uploadId, 10));
        salesDataUpload = await storage.getSalesDataUpload(parseInt(uploadId, 10));
        uploadFileName = salesDataUpload?.fileName || null;
        
        // Log analytics found from file
        console.log(`AI Planner: Found ${productAnalytics.length} products from uploaded file "${uploadFileName}"`);
        
        if (productAnalytics.length > 0) {
          const totalRev = productAnalytics.reduce((sum, a) => sum + (a.totalRevenue || 0), 0);
          const totalQty = productAnalytics.reduce((sum, a) => sum + (a.totalQuantitySold || 0), 0);
          console.log(`AI Planner: File contains total revenue: ${totalRev.toFixed(2)} SAR, total quantity: ${totalQty}`);
          
          uploadAnalyticsSummary = {
            fileName: uploadFileName,
            productsCount: productAnalytics.length,
            totalRevenue: totalRev,
            totalQuantity: totalQty,
            topProducts: productAnalytics
              .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
              .slice(0, 5)
              .map(p => ({ name: p.productName, category: p.productCategory || 'عام', revenue: p.totalRevenue, quantity: p.totalQuantitySold }))
          };
        }
      }
      
      const activeProducts = products.filter(p => p.isActive);
      
      // SMART AI ALGORITHM - Revenue-Based Analysis
      // If we have sales analytics with revenue data, use revenue shares to distribute production
      // This ensures the production plan matches actual historical sales patterns
      
      let recommendedProducts: any[] = [];
      let confidenceScore = 0.5;
      let analysisMethod = 'default';
      
      if (productAnalytics.length > 0) {
        // Calculate total revenue from uploaded data
        const totalRevenue = productAnalytics.reduce((sum, a) => sum + (a.totalRevenue || 0), 0);
        const totalQuantity = productAnalytics.reduce((sum, a) => sum + (a.totalQuantitySold || 0), 0);
        
        // Data quality check: count how many products have complete data
        const productsWithRevenue = productAnalytics.filter(a => (a.totalRevenue || 0) > 0).length;
        const productsWithQuantity = productAnalytics.filter(a => (a.totalQuantitySold || 0) > 0).length;
        const revenueCompleteness = productsWithRevenue / Math.max(productAnalytics.length, 1);
        
        // Only use revenue-based if at least 50% of products have revenue data
        if (totalRevenue > 0 && revenueCompleteness >= 0.5) {
          // REVENUE-BASED ALLOCATION: Use actual sales ratios from the file
          analysisMethod = 'revenue_based';
          
          // Sort analytics by revenue (best sellers first)
          const sortedAnalytics = [...productAnalytics]
            .filter(a => a.totalRevenue > 0 || a.totalQuantitySold > 0)
            .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
          
          recommendedProducts = sortedAnalytics.slice(0, 40).map(analytics => {
            // Calculate this product's share of total revenue
            const revenueShare = (analytics.totalRevenue || 0) / totalRevenue;
            
            // Allocate target sales based on this revenue share
            const allocatedSalesValue = targetSalesValue * revenueShare;
            
            // Find matching product for pricing
            const product = activeProducts.find(p => 
              p.id === analytics.productId || 
              p.name?.toLowerCase() === analytics.productName?.toLowerCase()
            );
            
            // Calculate unit price from historical data or product catalog
            let unitPrice = 0;
            if (analytics.totalQuantitySold > 0 && analytics.totalRevenue > 0) {
              // Use actual average price from sales data
              unitPrice = analytics.totalRevenue / analytics.totalQuantitySold;
            } else if (product) {
              unitPrice = product.basePrice || product.price || 15;
            } else {
              unitPrice = 15; // Default fallback
            }
            
            // Calculate quantity needed to reach allocated value
            const quantity = Math.max(1, Math.round(allocatedSalesValue / unitPrice));
            const totalPrice = quantity * unitPrice;
            const costRatio = 0.4; // Assume 40% production cost
            const estimatedCost = totalPrice * costRatio;
            
            return {
              productId: analytics.productId || product?.id || null,
              productName: analytics.productName,
              category: analytics.productCategory || product?.category || 'عام',
              quantity,
              unitPrice: Math.round(unitPrice * 100) / 100,
              totalPrice: Math.round(totalPrice * 100) / 100,
              estimatedCost: Math.round(estimatedCost * 100) / 100,
              salesVelocity: analytics.totalQuantitySold || 0,
              revenueShare: Math.round(revenueShare * 10000) / 100, // As percentage
              historicalRevenue: analytics.totalRevenue || 0,
              priority: revenueShare > 0.05 ? 'high' : revenueShare > 0.02 ? 'medium' : 'normal'
            };
          }).filter(p => p.quantity > 0 && p.totalPrice > 0);
          
          // High confidence when using actual revenue data
          const matchedProducts = recommendedProducts.filter(p => p.productId !== null).length;
          confidenceScore = Math.min(0.95, 0.75 + (matchedProducts / Math.max(recommendedProducts.length, 1)) * 0.2);
          
        } else if (totalQuantity > 0) {
          // QUANTITY-BASED ALLOCATION: Use quantity ratios when no revenue data
          analysisMethod = 'quantity_based';
          
          const sortedAnalytics = [...productAnalytics]
            .filter(a => a.totalQuantitySold > 0)
            .sort((a, b) => (b.totalQuantitySold || 0) - (a.totalQuantitySold || 0));
          
          recommendedProducts = sortedAnalytics.slice(0, 40).map(analytics => {
            const quantityShare = (analytics.totalQuantitySold || 0) / totalQuantity;
            const product = activeProducts.find(p => 
              p.id === analytics.productId || 
              p.name?.toLowerCase() === analytics.productName?.toLowerCase()
            );
            
            const unitPrice = product?.basePrice || product?.price || 15;
            const allocatedValue = targetSalesValue * quantityShare;
            const quantity = Math.max(1, Math.round(allocatedValue / unitPrice));
            const totalPrice = quantity * unitPrice;
            const estimatedCost = totalPrice * 0.4;
            
            return {
              productId: analytics.productId || product?.id || null,
              productName: analytics.productName,
              category: analytics.productCategory || product?.category || 'عام',
              quantity,
              unitPrice: Math.round(unitPrice * 100) / 100,
              totalPrice: Math.round(totalPrice * 100) / 100,
              estimatedCost: Math.round(estimatedCost * 100) / 100,
              salesVelocity: analytics.totalQuantitySold || 0,
              quantityShare: Math.round(quantityShare * 10000) / 100,
              priority: quantityShare > 0.05 ? 'high' : quantityShare > 0.02 ? 'medium' : 'normal'
            };
          }).filter(p => p.quantity > 0 && p.totalPrice > 0);
          
          confidenceScore = Math.min(0.85, 0.65 + (recommendedProducts.length / 40) * 0.2);
        }
      }
      
      // FALLBACK: Equal distribution across active products (no sales data)
      if (recommendedProducts.length === 0) {
        if (activeProducts.length === 0) {
          return res.status(400).json({ error: "لا توجد منتجات نشطة في النظام. يرجى إضافة منتجات أولاً." });
        }
        
        analysisMethod = 'equal_distribution';
        const equalShare = 1 / activeProducts.length;
        
        recommendedProducts = activeProducts.slice(0, 30).map(product => {
          const unitPrice = product.basePrice || product.price || 15;
          const allocatedValue = targetSalesValue * equalShare;
          const quantity = Math.max(1, Math.round(allocatedValue / unitPrice));
          const totalPrice = quantity * unitPrice;
          const estimatedCost = totalPrice * 0.4;
          
          return {
            productId: product.id,
            productName: product.name,
            category: product.category || 'عام',
            quantity,
            unitPrice,
            totalPrice,
            estimatedCost,
            salesVelocity: 0,
            priority: 'normal'
          };
        }).filter(p => p.quantity > 0);
        
        confidenceScore = 0.45; // Low confidence without sales data
      }
      
      // Sort by total price (highest value products first)
      recommendedProducts.sort((a, b) => b.totalPrice - a.totalPrice);
      
      // NORMALIZATION: Adjust quantities to match target sales value more closely
      const rawTotalValue = recommendedProducts.reduce((sum, p) => sum + p.totalPrice, 0);
      if (rawTotalValue > 0 && Math.abs(rawTotalValue - targetSalesValue) > targetSalesValue * 0.05) {
        // If we're more than 5% off target, normalize quantities
        const scaleFactor = targetSalesValue / rawTotalValue;
        recommendedProducts = recommendedProducts.map(p => {
          const adjustedQuantity = Math.max(1, Math.round(p.quantity * scaleFactor));
          const adjustedTotalPrice = adjustedQuantity * p.unitPrice;
          const adjustedCost = adjustedTotalPrice * 0.4;
          return {
            ...p,
            quantity: adjustedQuantity,
            totalPrice: Math.round(adjustedTotalPrice * 100) / 100,
            estimatedCost: Math.round(adjustedCost * 100) / 100
          };
        }).filter(p => p.quantity > 0);
      }
      
      const totalEstimatedValue = recommendedProducts.reduce((sum, p) => sum + p.totalPrice, 0);
      const totalEstimatedCost = recommendedProducts.reduce((sum, p) => sum + p.estimatedCost, 0);
      const profitMargin = totalEstimatedValue > 0 
        ? ((totalEstimatedValue - totalEstimatedCost) / totalEstimatedValue) * 100 
        : 0;
      
      // Calculate accuracy: how close are we to the target
      const targetAccuracy = Math.round((1 - Math.abs(totalEstimatedValue - targetSalesValue) / targetSalesValue) * 100);
      
      const plan = await storage.createProductionAiPlan({
        branchId,
        planName: `خطة إنتاج ${planDate}`,
        targetSalesValue,
        planDate,
        datasetId: uploadId ? parseInt(uploadId, 10) : null,
        algorithmVersion: 'v2.0-smart',
        confidenceScore,
        recommendedProducts,
        totalEstimatedValue,
        totalEstimatedCost,
        profitMargin,
        status: 'generated',
        createdBy: (req as any).user?.id
      });
      
      // Analysis method descriptions in Arabic
      const analysisMethodLabels: Record<string, string> = {
        'revenue_based': 'تحليل مبني على الإيرادات الفعلية من الملف',
        'quantity_based': 'تحليل مبني على كميات المبيعات من الملف',
        'equal_distribution': 'توزيع متساوي (لا يوجد ملف مبيعات)',
        'default': 'تحليل افتراضي'
      };
      
      // Format response for frontend compatibility
      const response = {
        id: plan.id,
        branchId: plan.branchId,
        planDate: plan.planDate,
        targetSales: plan.targetSalesValue,
        confidenceScore: plan.confidenceScore,
        totalEstimatedValue: plan.totalEstimatedValue,
        estimatedCost: plan.totalEstimatedCost,
        profitMargin: plan.profitMargin,
        status: plan.status,
        products: recommendedProducts,
        salesDataFileId: plan.datasetId,
        analysisMethod,
        analysisMethodLabel: analysisMethodLabels[analysisMethod] || analysisMethod,
        targetAccuracy: Math.min(100, Math.max(0, targetAccuracy)),
        uploadAnalytics: uploadAnalyticsSummary,
        createdAt: plan.createdAt
      };
      
      console.log(`AI Planner: Generated plan with ${recommendedProducts.length} products, target accuracy: ${targetAccuracy}%`);
      
      res.status(201).json(response);
    } catch (error) {
      console.error("Error generating AI plan:", error);
      res.status(500).json({ error: "Failed to generate AI plan" });
    }
  });

  // Apply AI plan to create production order
  app.post("/api/production-ai-plans/:id/apply", isAuthenticated, requirePermission("production", "create"), async (req, res) => {
    try {
      const planId = parseInt(req.params.id, 10);
      if (isNaN(planId)) {
        return res.status(400).json({ error: "Invalid plan ID" });
      }
      
      const plan = await storage.getProductionAiPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      
      // Create production order from plan
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      
      const order = await storage.createAdvancedProductionOrder({
        orderNumber: `PO-AI-${timestamp}-${random}`,
        orderType: 'daily',
        sourceBranchId: plan.branchId,
        targetBranchId: plan.branchId,
        title: plan.planName,
        description: `تم إنشاؤه بواسطة الذكاء الاصطناعي - مستوى الثقة: ${(plan.confidenceScore! * 100).toFixed(0)}%`,
        status: 'pending',
        priority: 'normal',
        startDate: plan.planDate,
        endDate: plan.planDate,
        targetSalesValue: plan.targetSalesValue,
        estimatedCost: plan.totalEstimatedCost,
        isAiGenerated: true,
        aiPlanId: planId,
        createdBy: (req as any).user?.id
      });
      
      // Create order items from recommended products
      const recommendedProducts = plan.recommendedProducts as any[];
      if (recommendedProducts && recommendedProducts.length > 0) {
        const items = recommendedProducts.map((p: any) => ({
          orderId: order.id,
          productId: p.productId,
          productName: p.productName,
          productCategory: p.category,
          targetQuantity: p.quantity,
          unitPrice: p.unitPrice || (p.totalPrice ? p.totalPrice / p.quantity : p.estimatedValue / p.quantity),
          totalValue: p.totalPrice || p.estimatedValue,
          salesVelocity: p.salesVelocity,
          priority: p.priority === 'high' ? 1 : 0,
          status: 'pending'
        }));
        
        await storage.bulkCreateProductionOrderItems(items);
        await storage.updateAdvancedProductionOrder(order.id, { totalItems: items.length });
      }
      
      // Update plan status
      await storage.updateProductionAiPlan(planId, {
        status: 'applied',
        appliedToOrderId: order.id,
        reviewedBy: (req as any).user?.id
      });
      
      const result = await storage.getAdvancedProductionOrderWithItems(order.id);
      res.status(201).json(result);
    } catch (error) {
      console.error("Error applying AI plan:", error);
      res.status(500).json({ error: "Failed to apply AI plan" });
    }
  });

  // ==================== Sales Data Uploads ====================
  
  // Get all uploads
  app.get("/api/sales-data-uploads", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const uploads = await storage.getAllSalesDataUploads();
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching uploads:", error);
      res.status(500).json({ error: "Failed to fetch uploads" });
    }
  });

  // Upload sales data file
  app.post("/api/sales-data-uploads", isAuthenticated, requirePermission("production", "create"), async (req, res) => {
    try {
      const { branchId, fileName, fileData, periodStart, periodEnd } = req.body;
      
      // Create upload record
      const upload = await storage.createSalesDataUpload({
        branchId,
        fileName,
        fileType: 'excel',
        periodStart,
        periodEnd,
        status: 'processing',
        uploadedBy: (req as any).user?.id
      });
      
      // Parse and analyze the data
      try {
        const parsedData = JSON.parse(fileData || '[]');
        const productVelocity: Record<string, number> = {};
        const productRevenue: Record<string, number> = {};
        let totalSales = 0;
        const uniqueProducts = new Set<string>();
        
        // Helper function to find a value from multiple possible column names
        const findValue = (row: any, possibleKeys: string[]): any => {
          for (const key of possibleKeys) {
            // Check exact match first
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
              return row[key];
            }
            // Check case-insensitive match
            const lowerKey = key.toLowerCase();
            for (const rowKey of Object.keys(row)) {
              if (rowKey.toLowerCase() === lowerKey && row[rowKey] !== undefined && row[rowKey] !== null && row[rowKey] !== '') {
                return row[rowKey];
              }
            }
          }
          return null;
        };

        // Extended column name variations for different sources (Foodics, POS systems, etc.)
        const productColumns = [
          'product', 'productName', 'product_name', 'Product', 'ProductName', 'Product Name',
          'منتج', 'اسم المنتج', 'المنتج', 'الصنف', 'اسم الصنف', 'item', 'Item', 'item_name',
          'name', 'Name', 'الاسم', 'sku', 'SKU', 'sku_name', 'SKU Name', 'الفروع'
        ];
        
        const quantityColumns = [
          'quantity', 'qty', 'Quantity', 'Qty', 'QTY', 'count', 'Count',
          'كمية', 'الكمية', 'عدد', 'العدد', 'sold_quantity', 'Sold Quantity',
          'units', 'Units', 'الوحدات', 'sold', 'Sold', 'المباع'
        ];
        
        const revenueColumns = [
          'revenue', 'Revenue', 'total', 'Total', 'amount', 'Amount',
          'إيرادات', 'الإيرادات', 'المبيعات', 'إجمالي', 'الإجمالي', 'المبلغ',
          'sales', 'Sales', 'price', 'Price', 'السعر', 'total_sales', 'Total Sales',
          'net_sales', 'Net Sales', 'صافي المبيعات', 'gross_sales', 'Gross Sales'
        ];

        // Log column names for debugging
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          console.log('Excel columns found:', Object.keys(parsedData[0]));
          console.log('First row values:', parsedData[0]);
        }
        
        // Detect if first row contains header labels (common in Foodics exports)
        // If first row values contain words like "Product", "Quantity", "Sales", create a column mapping
        let columnMapping: Record<string, string> = {};
        let dataStartIndex = 0;
        
        if (Array.isArray(parsedData) && parsedData.length > 1) {
          const firstRow = parsedData[0];
          const firstRowValues = Object.values(firstRow).map(v => String(v).toLowerCase().trim());
          
          // Check if first row looks like header labels
          const hasProductHeader = firstRowValues.some(v => 
            v === 'product' || v === 'المنتج' || v === 'منتج' || v === 'item' || v === 'الصنف'
          );
          const hasQuantityHeader = firstRowValues.some(v => 
            v === 'quantity' || v === 'الكمية' || v === 'كمية' || v === 'qty'
          );
          const hasSalesHeader = firstRowValues.some(v => 
            v === 'sales' || v === 'المبيعات' || v === 'revenue' || v === 'total' || v === 'الإيرادات'
          );
          
          if (hasProductHeader || hasQuantityHeader || hasSalesHeader) {
            console.log('Detected header row in first data row, creating column mapping...');
            dataStartIndex = 1; // Skip first row as it's headers
            
            // Create mapping from Excel column keys to semantic names
            for (const [key, value] of Object.entries(firstRow)) {
              const valLower = String(value).toLowerCase().trim();
              if (valLower === 'product' || valLower === 'المنتج' || valLower === 'منتج' || valLower === 'item') {
                columnMapping['product'] = key;
              } else if (valLower === 'quantity' || valLower === 'الكمية' || valLower === 'كمية' || valLower === 'qty') {
                columnMapping['quantity'] = key;
              } else if (valLower === 'sales' || valLower === 'المبيعات' || valLower === 'revenue' || valLower === 'total') {
                columnMapping['revenue'] = key;
              }
            }
            console.log('Column mapping:', columnMapping);
          }
        }
        
        // Process data rows (skipping header if detected)
        const dataRows = Array.isArray(parsedData) ? parsedData.slice(dataStartIndex) : [];
        
        dataRows.forEach((row: any) => {
          let productName: any;
          let quantity: number;
          let revenue: number;
          
          if (Object.keys(columnMapping).length > 0) {
            // Use column mapping if we detected a header row
            productName = columnMapping['product'] ? row[columnMapping['product']] : null;
            quantity = parseInt(row[columnMapping['quantity']] || 0, 10);
            revenue = parseFloat(row[columnMapping['revenue']] || 0);
          } else {
            // Fall back to standard column name detection
            productName = findValue(row, productColumns);
            quantity = parseInt(findValue(row, quantityColumns) || 0, 10);
            revenue = parseFloat(findValue(row, revenueColumns) || 0);
          }
          
          if (productName && typeof productName === 'string' && productName.trim()) {
            const cleanName = productName.trim();
            uniqueProducts.add(cleanName);
            productVelocity[cleanName] = (productVelocity[cleanName] || 0) + (isNaN(quantity) ? 1 : quantity);
            productRevenue[cleanName] = (productRevenue[cleanName] || 0) + (isNaN(revenue) ? 0 : revenue);
            totalSales += isNaN(revenue) ? 0 : revenue;
          }
        });
        
        // Calculate days in period for average calculations
        const startDate = new Date(periodStart);
        const endDate = new Date(periodEnd);
        const daysInPeriod = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        
        await storage.updateSalesDataUpload(upload.id, {
          status: 'completed',
          totalRecords: dataRows.length,
          totalSalesValue: totalSales,
          uniqueProducts: uniqueProducts.size,
          parsedData: dataRows,
          productVelocity
        });
        
        // Create analytics records with more detailed data
        const products = await storage.getAllProducts();
        const analyticsRecords = Object.entries(productVelocity).map(([name, velocity]) => {
          const product = products.find(p => p.name === name);
          const revenue = productRevenue[name] || 0;
          return {
            uploadId: upload.id,
            productId: product?.id || null,
            productName: name,
            productCategory: product?.category || null,
            totalQuantitySold: velocity,
            totalRevenue: revenue,
            averageDailySales: Math.round((velocity / daysInPeriod) * 100) / 100,
            salesVelocity: velocity
          };
        });
        
        if (analyticsRecords.length > 0) {
          await storage.bulkCreateProductSalesAnalytics(analyticsRecords);
          console.log(`Created ${analyticsRecords.length} analytics records for upload ${upload.id}`);
        } else {
          console.log('No analytics records created - check if Excel columns match expected names');
          console.log('Expected product columns:', productColumns.slice(0, 5).join(', '), '...');
        }
        
      } catch (parseError) {
        console.error('Error parsing file data:', parseError);
        await storage.updateSalesDataUpload(upload.id, {
          status: 'failed',
          errorMessage: 'فشل في تحليل بيانات الملف - تأكد من تنسيق الأعمدة'
        });
      }
      
      const updatedUpload = await storage.getSalesDataUpload(upload.id);
      res.status(201).json(updatedUpload);
    } catch (error: any) {
      console.error("Error uploading sales data:", error);
      console.error("Error details:", error?.message, error?.code, error?.detail);
      
      let errorMessage = "فشل في رفع بيانات المبيعات";
      if (error?.code === '23503') {
        errorMessage = "خطأ: الفرع غير موجود في قاعدة البيانات - " + (error?.detail || '');
      } else if (error?.message) {
        errorMessage = "خطأ: " + error.message;
      }
      
      res.status(500).json({ error: errorMessage, details: error?.message, code: error?.code });
    }
  });

  // Get upload analytics
  app.get("/api/sales-data-uploads/:id/analytics", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid upload ID" });
      }
      
      const analytics = await storage.getProductSalesAnalytics(id);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Generate production forecast from sales data
  app.post("/api/sales-data-uploads/:id/generate-forecast", isAuthenticated, requirePermission("production", "create"), async (req, res) => {
    try {
      const uploadId = parseInt(req.params.id, 10);
      if (isNaN(uploadId)) {
        return res.status(400).json({ error: "Invalid upload ID" });
      }
      
      const { branchId, targetSales, planDate, planPeriod, notes } = req.body;
      
      if (!branchId || !targetSales || !planDate) {
        return res.status(400).json({ error: "الفرع والمبيعات المستهدفة والتاريخ مطلوبة" });
      }
      
      // Get the upload and analytics
      const upload = await storage.getSalesDataUpload(uploadId);
      if (!upload) {
        return res.status(404).json({ error: "لم يتم العثور على بيانات المبيعات" });
      }
      
      if (upload.status !== 'completed') {
        return res.status(400).json({ error: "بيانات المبيعات لم تكتمل معالجتها بعد" });
      }
      
      const analytics = await storage.getProductSalesAnalytics(uploadId);
      if (!analytics || analytics.length === 0) {
        return res.status(400).json({ error: "لا توجد بيانات تحليل للمنتجات - تأكد من رفع ملف يحتوي على بيانات صحيحة" });
      }
      
      // Calculate total historical quantity and revenue with guards against zero
      const totalHistoricalQuantity = analytics.reduce((sum, a) => sum + (a.totalQuantitySold || 0), 0);
      const totalHistoricalRevenue = analytics.reduce((sum, a) => sum + (a.totalRevenue || 0), 0);
      
      // Guard against zero totals
      if (totalHistoricalQuantity === 0 && totalHistoricalRevenue === 0) {
        return res.status(400).json({ error: "لا توجد بيانات مبيعات كافية لتوليد التوقعات - تأكد من أن الملف يحتوي على كميات أو إيرادات" });
      }
      
      // Calculate product ratios and forecast quantities
      const targetSalesNum = parseFloat(targetSales);
      if (isNaN(targetSalesNum) || targetSalesNum <= 0) {
        return res.status(400).json({ error: "قيمة المبيعات المستهدفة غير صالحة" });
      }
      
      const forecastItems = analytics.map(product => {
        // Calculate ratio based on revenue if available, otherwise quantity
        // Safe division with guards against zero
        let ratio = 0;
        if (totalHistoricalRevenue > 0) {
          ratio = (product.totalRevenue || 0) / totalHistoricalRevenue;
        } else if (totalHistoricalQuantity > 0) {
          ratio = (product.totalQuantitySold || 0) / totalHistoricalQuantity;
        }
        
        // Guard against NaN
        if (isNaN(ratio)) ratio = 0;
        
        // Calculate forecasted sales amount for this product
        const forecastedSalesAmount = targetSalesNum * ratio;
        
        // Get average price per unit from historical data
        const avgPricePerUnit = product.totalQuantitySold > 0 && product.totalRevenue 
          ? product.totalRevenue / product.totalQuantitySold 
          : 0;
        
        // Calculate forecasted quantity with fallback
        let forecastedQuantity = 0;
        if (avgPricePerUnit > 0 && forecastedSalesAmount > 0) {
          forecastedQuantity = Math.ceil(forecastedSalesAmount / avgPricePerUnit);
        } else if (product.averageDailySales && product.averageDailySales > 0) {
          forecastedQuantity = Math.ceil(product.averageDailySales);
        } else if (ratio > 0) {
          // Fallback: use ratio-based quantity distribution
          forecastedQuantity = Math.max(1, Math.ceil(ratio * 100));
        }
        
        return {
          productId: product.productId,
          productName: product.productName,
          productCategory: product.productCategory,
          historicalQuantity: product.totalQuantitySold || 0,
          historicalRevenue: product.totalRevenue || 0,
          salesRatio: Math.round(ratio * 10000) / 100, // percentage with 2 decimals
          forecastedQuantity: Math.max(1, forecastedQuantity),
          forecastedSalesAmount: Math.round(forecastedSalesAmount * 100) / 100
        };
      }).filter(item => item.forecastedQuantity > 0 && item.salesRatio > 0);
      
      // Fail fast if no items could be forecasted
      if (forecastItems.length === 0) {
        return res.status(400).json({ 
          error: "لا يمكن توليد توقعات الإنتاج - لم يتم العثور على منتجات بنسب مبيعات صالحة. تأكد من أن بيانات المبيعات تحتوي على كميات أو إيرادات للمنتجات." 
        });
      }
      
      // Get all products for matching
      const products = await storage.getAllProducts();
      
      // Prepare order data
      const orderNumber = `FCST-${Date.now().toString(36).toUpperCase()}`;
      const orderData = {
        orderNumber,
        sourceBranchId: branchId,
        targetBranchId: branchId,
        title: `توقعات إنتاج ${planDate}`,
        createdBy: (req as any).user?.id || null,
        orderType: 'daily' as const,
        startDate: planDate,
        endDate: planDate,
        priority: 'normal' as const,
        status: 'draft' as const,
        targetSalesValue: targetSalesNum,
        notes: `${notes || ''}\n\nتوقعات مبنية على بيانات المبيعات السابقة\nملف المصدر: ${upload.fileName}\nالمبيعات المستهدفة: ${targetSalesNum.toLocaleString('ar-SA')} ريال`,
        totalItems: forecastItems.length,
        completedItems: 0
      };
      
      // Prepare items (without orderId - will be added in transaction)
      // Products can have null productId if no matching product exists in the database
      const orderItems = forecastItems.map((item, index) => {
        const product = products.find(p => p.id === item.productId || p.name === item.productName);
        // استخدام السعر من جدول المنتجات (basePrice) أو السعر المحسوب من بيانات المبيعات
        const unitPrice = product?.basePrice || (item.historicalRevenue > 0 && item.historicalQuantity > 0 
          ? item.historicalRevenue / item.historicalQuantity 
          : 0);
        return {
          productId: product?.id || null,
          productName: item.productName,
          productCategory: item.productCategory || null,
          targetQuantity: item.forecastedQuantity,
          producedQuantity: 0,
          wastedQuantity: 0,
          unitPrice: Math.round(unitPrice * 100) / 100,
          totalValue: Math.round(unitPrice * item.forecastedQuantity * 100) / 100,
          status: 'pending' as const,
          priority: index + 1,
          notes: `نسبة المبيعات: ${item.salesRatio}%`
        };
      });
      
      // Create order and items in a single transaction
      let txResult;
      try {
        console.log("Creating production order with items:", { 
          orderData, 
          itemCount: orderItems.length,
          firstItem: orderItems[0]
        });
        txResult = await storage.createAdvancedProductionOrderWithItems(orderData, orderItems);
        console.log("Transaction result:", txResult);
      } catch (txError: any) {
        console.error("Error creating production order with items:", txError);
        console.error("Error stack:", txError?.stack);
        console.error("Error message:", txError?.message);
        return res.status(500).json({ error: "فشل في إنشاء أمر الإنتاج وعناصره", details: txError?.message });
      }
      
      // Verify transaction result
      if (!txResult || !txResult.order || !txResult.items || txResult.items.length === 0) {
        return res.status(500).json({ error: "فشل في إنشاء أمر الإنتاج بشكل كامل" });
      }
      
      // Fetch canonical result with proper sorting and hydration
      const result = await storage.getAdvancedProductionOrderWithItems(txResult.order.id);
      if (!result) {
        return res.status(500).json({ error: "تم إنشاء الأمر لكن فشل في استرجاعه" });
      }
      
      res.status(201).json({
        success: true,
        message: 'تم إنشاء توقعات الإنتاج وأمر الإنتاج بنجاح',
        forecast: {
          uploadId,
          branchId,
          targetSales: targetSalesNum,
          planDate,
          totalProducts: forecastItems.length,
          totalForecastedQuantity: forecastItems.reduce((sum, i) => sum + i.forecastedQuantity, 0),
          items: forecastItems
        },
        productionOrder: result
      });
    } catch (error) {
      console.error("Error generating forecast:", error);
      res.status(500).json({ error: "فشل في توليد توقعات الإنتاج" });
    }
  });

  // ==================== Daily Production Batches ====================
  
  // Get all batches with optional filters
  app.get("/api/daily-production/batches", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const { branchId, date, destination } = req.query;
      const batches = await storage.getAllDailyProductionBatches({
        branchId: branchId as string,
        date: date as string,
        destination: destination as string,
      });
      res.json(batches);
    } catch (error) {
      console.error("Error fetching daily production batches:", error);
      res.status(500).json({ error: "فشل في جلب دفعات الإنتاج اليومي" });
    }
  });

  // Get single batch
  app.get("/api/daily-production/batches/:id", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const batch = await storage.getDailyProductionBatch(id);
      if (!batch) {
        return res.status(404).json({ error: "دفعة الإنتاج غير موجودة" });
      }
      res.json(batch);
    } catch (error) {
      console.error("Error fetching batch:", error);
      res.status(500).json({ error: "فشل في جلب دفعة الإنتاج" });
    }
  });

  // Create new batch
  app.post("/api/daily-production/batches", isAuthenticated, requirePermission("production", "create"), async (req, res) => {
    try {
      const user = (req as any).user;
      const { branchId, productId, productName, productCategory, quantity, unit, destination, notes, producedAt } = req.body;
      
      // Validate required fields
      if (!branchId || typeof branchId !== 'string') {
        return res.status(400).json({ error: "الفرع مطلوب" });
      }
      if (!productName || typeof productName !== 'string') {
        return res.status(400).json({ error: "اسم المنتج مطلوب" });
      }
      if (quantity === undefined || quantity === null || isNaN(Number(quantity)) || Number(quantity) <= 0) {
        return res.status(400).json({ error: "الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر" });
      }
      if (!destination || typeof destination !== 'string') {
        return res.status(400).json({ error: "الوجهة مطلوبة" });
      }
      
      // Validate destination value
      const validDestinations = ['display_bar', 'kitchen_trolley', 'freezer', 'refrigerator'];
      if (!validDestinations.includes(destination)) {
        return res.status(400).json({ error: "الوجهة غير صالحة" });
      }
      
      const batchData = {
        branchId,
        productId: productId ? Number(productId) : null,
        productName: productName.trim(),
        productCategory: productCategory || null,
        quantity: Number(quantity),
        unit: unit || 'قطعة',
        destination,
        notes: notes || null,
        recordedBy: user?.id || null,
        recorderName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.username || null,
        producedAt: producedAt ? new Date(producedAt) : new Date(),
      };
      
      const batch = await storage.createDailyProductionBatch(batchData);
      res.status(201).json(batch);
    } catch (error) {
      console.error("Error creating batch:", error);
      res.status(500).json({ error: "فشل في إنشاء دفعة الإنتاج" });
    }
  });

  // Update batch
  app.patch("/api/daily-production/batches/:id", isAuthenticated, requirePermission("production", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      
      // Validate allowed update fields
      const allowedFields = ['productName', 'productCategory', 'quantity', 'unit', 'destination', 'notes'];
      const updateData: any = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          if (field === 'quantity') {
            const qty = Number(req.body[field]);
            if (isNaN(qty) || qty <= 0) {
              return res.status(400).json({ error: "الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر" });
            }
            updateData[field] = qty;
          } else if (field === 'destination') {
            const validDestinations = ['display_bar', 'kitchen_trolley', 'freezer', 'refrigerator'];
            if (!validDestinations.includes(req.body[field])) {
              return res.status(400).json({ error: "الوجهة غير صالحة" });
            }
            updateData[field] = req.body[field];
          } else {
            updateData[field] = req.body[field];
          }
        }
      }
      
      const updated = await storage.updateDailyProductionBatch(id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "دفعة الإنتاج غير موجودة" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating batch:", error);
      res.status(500).json({ error: "فشل في تحديث دفعة الإنتاج" });
    }
  });

  // Delete batch
  app.delete("/api/daily-production/batches/:id", isAuthenticated, requirePermission("production", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      
      // Check if batch exists first
      const existing = await storage.getDailyProductionBatch(id);
      if (!existing) {
        return res.status(404).json({ error: "دفعة الإنتاج غير موجودة" });
      }
      
      await storage.deleteDailyProductionBatch(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting batch:", error);
      res.status(500).json({ error: "فشل في حذف دفعة الإنتاج" });
    }
  });

  // Get daily stats
  app.get("/api/daily-production/stats", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const { branchId, date } = req.query;
      if (!branchId || !date) {
        return res.status(400).json({ error: "الفرع والتاريخ مطلوبان" });
      }
      const stats = await storage.getDailyProductionStats(branchId as string, date as string);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching daily production stats:", error);
      res.status(500).json({ error: "فشل في جلب إحصائيات الإنتاج اليومي" });
    }
  });

  // Production Hub - unified endpoint for dashboard (supports branchId=all)
  app.get("/api/production/hub", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const { branchId, date } = req.query;
      if (!branchId || !date) {
        return res.status(400).json({ error: "الفرع والتاريخ مطلوبان" });
      }
      
      const dateStr = date as string;
      const prevDate = new Date(dateStr);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];
      
      interface AggStats {
        totalBatches: number;
        totalQuantity: number;
        byDestination: Record<string, number>;
        byCategory: Record<string, number>;
        byHour: Record<string, number>;
      }
      
      // Create fresh objects per request to avoid reference reuse
      const createEmptyStats = (): AggStats => ({ 
        totalBatches: 0, 
        totalQuantity: 0, 
        byDestination: {}, 
        byCategory: {}, 
        byHour: {} 
      });
      
      let todayStats: AggStats = createEmptyStats();
      let yesterdayStats: AggStats = createEmptyStats();
      let activeOrders = 0;
      
      if (branchId === "all") {
        // Aggregate across all branches
        const allBranches = await storage.getAllBranches();
        const allOrders = await storage.getAllAdvancedProductionOrders();
        activeOrders = allOrders.filter(o => 
          o.status === 'pending' || o.status === 'approved' || o.status === 'in_progress'
        ).length;
        
        for (const branch of allBranches) {
          const branchToday = await storage.getDailyProductionStats(branch.id, dateStr);
          todayStats.totalBatches += branchToday.totalBatches;
          todayStats.totalQuantity += branchToday.totalQuantity;
          for (const [k, v] of Object.entries(branchToday.byDestination || {})) {
            todayStats.byDestination[k] = (todayStats.byDestination[k] || 0) + v;
          }
          for (const [k, v] of Object.entries(branchToday.byCategory || {})) {
            todayStats.byCategory[k] = (todayStats.byCategory[k] || 0) + v;
          }
          
          const branchYesterday = await storage.getDailyProductionStats(branch.id, prevDateStr);
          yesterdayStats.totalBatches += branchYesterday.totalBatches;
          yesterdayStats.totalQuantity += branchYesterday.totalQuantity;
        }
      } else {
        // Single branch
        todayStats = await storage.getDailyProductionStats(branchId as string, dateStr);
        yesterdayStats = await storage.getDailyProductionStats(branchId as string, prevDateStr);
        const branchOrders = await storage.getAdvancedProductionOrdersByBranch(branchId as string);
        activeOrders = branchOrders.filter(o => 
          o.status === 'pending' || o.status === 'approved' || o.status === 'in_progress'
        ).length;
      }
      
      // Get target vs actual from production orders scheduled for this date
      // Uses bulk query to avoid O(N) round trips
      const targetData = await storage.getProductionTargetsByDate(branchId as string, dateStr);
      const { totalTarget, totalProduced } = targetData;
      const completionRate = totalTarget > 0 ? Math.round((totalProduced / totalTarget) * 100) : (totalProduced > 0 ? 100 : 0);
      const gap = totalTarget - totalProduced;
      
      // Calculate deltas
      const qtyDelta = todayStats.totalQuantity - (yesterdayStats?.totalQuantity || 0);
      const batchDelta = todayStats.totalBatches - (yesterdayStats?.totalBatches || 0);
      
      res.json({
        today: todayStats,
        yesterday: yesterdayStats,
        deltas: {
          quantity: qtyDelta,
          batches: batchDelta,
          quantityPercent: yesterdayStats?.totalQuantity ? Math.round((qtyDelta / yesterdayStats.totalQuantity) * 100) : 0,
          batchesPercent: yesterdayStats?.totalBatches ? Math.round((batchDelta / yesterdayStats.totalBatches) * 100) : 0,
        },
        target: {
          totalTarget,
          totalProduced,
          gap,
          completionRate,
        },
        activeOrders,
        date: dateStr,
        branchId: branchId,
      });
    } catch (error) {
      console.error("Error fetching production hub:", error);
      res.status(500).json({ error: "فشل في جلب بيانات مركز الإنتاج" });
    }
  });

  // Production Reports API - comprehensive reports with date range
  app.get("/api/production/reports", async (req, res) => {
    try {
      const branchId = (req.query.branchId as string) || 'all';
      const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
      const endDate = (req.query.endDate as string) || new Date().toISOString().split('T')[0];
      
      // Get production stats for the date range
      const prodStats = await storage.getDailyProductionStats(branchId, startDate);
      const targetData = await storage.getProductionTargetsByDate(branchId, startDate);
      
      // Get waste reports with date filtering
      const allWasteReports = await storage.getWasteReports();
      const wasteReports = allWasteReports.filter(w => {
        const reportDate = w.reportDate || '';
        const matchesBranch = branchId === 'all' || w.branchId === branchId;
        const matchesDate = reportDate >= startDate && reportDate <= endDate;
        return matchesBranch && matchesDate;
      });
      
      // Get quality checks
      const allQualityChecks = await storage.getAllQualityChecks();
      const qualityChecks = allQualityChecks.filter(q => {
        const checkDate = q.checkDate || (q.createdAt ? new Date(q.createdAt).toISOString().split('T')[0] : '');
        return checkDate >= startDate && checkDate <= endDate;
      });
      
      // Get products for performance analysis
      const products = await storage.getAllProducts();
      
      // Get branches for comparison
      const branches = await storage.getAllBranches();
      
      // Get cashier journals for sales comparison
      const allJournals = await storage.getCashierJournalsByDateRange(startDate, endDate);
      const journalsInRange = branchId === 'all' 
        ? allJournals 
        : allJournals.filter(j => j.branchId === branchId);
      const totalSales = journalsInRange.reduce((sum: number, j) => sum + (parseFloat(j.totalSales?.toString() || '0') || 0), 0);
      
      // Calculate waste analysis with product breakdown
      const wasteByReason: Record<string, number> = {};
      const wasteByProduct: Record<string, { quantity: number; value: number }> = {};
      let totalWastedQuantity = 0;
      let totalWastedValue = 0;
      
      for (const report of wasteReports) {
        const items = await storage.getWasteItems(report.id);
        for (const item of items) {
          const qty = item.quantity || 0;
          const value = item.totalValue || (qty * (item.unitPrice || 0));
          totalWastedQuantity += qty;
          totalWastedValue += value;
          
          const reason = item.wasteReason || 'غير محدد';
          wasteByReason[reason] = (wasteByReason[reason] || 0) + qty;
          
          // Get product name from products table
          let productName = 'غير محدد';
          if (item.productId) {
            const product = await storage.getProduct(item.productId);
            if (product) {
              productName = product.name;
            }
          }
          if (!wasteByProduct[productName]) {
            wasteByProduct[productName] = { quantity: 0, value: 0 };
          }
          wasteByProduct[productName].quantity += qty;
          wasteByProduct[productName].value += value;
        }
      }
      
      // Calculate waste percentage of sales
      const wastePercentage = totalSales > 0 ? (totalWastedValue / totalSales) * 100 : 0;
      
      // Calculate quality stats
      const passed = qualityChecks.filter(q => q.result === 'passed').length;
      const failed = qualityChecks.filter(q => q.result === 'failed').length;
      const passRate = qualityChecks.length > 0 ? (passed / qualityChecks.length) * 100 : 100;
      
      // Build real product performance from production batches
      const allProductionBatches = await storage.getAllDailyProductionBatches(
        branchId === 'all' ? {} : { branchId }
      );
      const entriesInRange = allProductionBatches.filter(e => {
        const entryDate = e.producedAt ? new Date(e.producedAt).toISOString().split('T')[0] : '';
        return entryDate >= startDate && entryDate <= endDate;
      });
      
      const productQuantities: Record<string, number> = {};
      for (const entry of entriesInRange) {
        const productName = entry.productName || 'غير محدد';
        productQuantities[productName] = (productQuantities[productName] || 0) + (entry.quantity || 0);
      }
      
      const totalProductionQty = Object.values(productQuantities).reduce((a, b) => a + b, 0);
      const productPerformance = Object.entries(productQuantities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name, qty]) => ({
          productName: name,
          quantity: qty,
          percentage: totalProductionQty > 0 ? (qty / totalProductionQty) * 100 : 0,
          trend: 0,
        }));
      
      // Build branch comparison
      const branchComparison = await Promise.all(branches.map(async (b) => {
        const bStats = await storage.getDailyProductionStats(b.id, startDate);
        const bTarget = await storage.getProductionTargetsByDate(b.id, startDate);
        return {
          branchName: b.name,
          production: bStats.totalQuantity,
          target: bTarget.totalTarget,
          efficiency: bTarget.totalTarget > 0 ? (bStats.totalQuantity / bTarget.totalTarget) * 100 : 0,
        };
      }));
      
      // Get shift-based production data
      const shiftData: Record<string, { production: number; entries: number }> = {
        'الوردية الصباحية': { production: 0, entries: 0 },
        'الوردية المسائية': { production: 0, entries: 0 },
        'الوردية الليلية': { production: 0, entries: 0 },
      };
      
      // Get shift names from the shift table for each entry
      for (const entry of entriesInRange) {
        let shiftName = 'الوردية الصباحية'; // default
        if (entry.shiftId) {
          const shift = await storage.getShift(entry.shiftId);
          if (shift) {
            shiftName = shift.name;
          }
        }
        if (shiftData[shiftName]) {
          shiftData[shiftName].production += entry.quantity || 0;
          shiftData[shiftName].entries += 1;
        }
      }
      
      const totalShiftProduction = Object.values(shiftData).reduce((a, b) => a + b.production, 0);
      const shiftPerformance = Object.entries(shiftData).map(([shift, data]) => ({
        shift,
        production: data.production,
        target: Math.floor(targetData.totalTarget / 3),
        efficiency: targetData.totalTarget > 0 ? (data.production / (targetData.totalTarget / 3)) * 100 : 0,
      }));
      
      // Build daily trends for the date range
      const dailyTrends: Array<{ date: string; production: number; target: number; sales: number; waste: number }> = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayStats = await storage.getDailyProductionStats(branchId, dateStr);
        const dayTarget = await storage.getProductionTargetsByDate(branchId, dateStr);
        
        const daySales = journalsInRange
          .filter(j => j.journalDate === dateStr)
          .reduce((sum, j) => sum + (parseFloat(j.totalSales?.toString() || '0') || 0), 0);
        
        const dayWaste = wasteReports
          .filter(w => w.reportDate === dateStr)
          .reduce((sum, w) => sum + (parseFloat(w.totalValue?.toString() || '0') || 0), 0);
        
        dailyTrends.push({
          date: dateStr,
          production: dayStats.totalQuantity,
          target: dayTarget.totalTarget,
          sales: daySales,
          waste: dayWaste,
        });
      }
      
      // Build top wasted products list
      const topWastedProducts = Object.entries(wasteByProduct)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 10)
        .map(([name, data]) => ({
          name,
          quantity: data.quantity,
          value: data.value,
        }));
      
      // Build raw production entries list for table display
      const rawProductionEntries = await Promise.all(
        entriesInRange.slice(0, 500).map(async (entry) => {
          let branchName = 'غير محدد';
          if (entry.branchId) {
            const branch = branches.find(b => b.id === entry.branchId);
            if (branch) branchName = branch.name;
          }
          let shiftName = 'غير محدد';
          if (entry.shiftId) {
            const shift = await storage.getShift(entry.shiftId);
            if (shift) shiftName = shift.name;
          }
          return {
            id: entry.id,
            productName: entry.productName || 'غير محدد',
            quantity: entry.quantity || 0,
            branchName,
            shiftName,
            destination: entry.destination || 'غير محدد',
            producedAt: entry.producedAt ? new Date(entry.producedAt).toISOString() : '',
            notes: entry.notes || '',
          };
        })
      );
      
      res.json({
        dailySummary: {
          totalBatches: prodStats.totalBatches,
          totalQuantity: prodStats.totalQuantity,
          avgBatchSize: prodStats.totalBatches > 0 ? prodStats.totalQuantity / prodStats.totalBatches : 0,
          byDestination: prodStats.byDestination,
          byCategory: prodStats.byCategory,
          byHour: prodStats.byHour,
        },
        targetComparison: {
          target: targetData.totalTarget,
          actual: targetData.totalProduced,
          completionRate: targetData.totalTarget > 0 ? (targetData.totalProduced / targetData.totalTarget) * 100 : 0,
          gap: targetData.totalProduced - targetData.totalTarget,
          status: targetData.totalProduced >= targetData.totalTarget ? 'تحقق الهدف' : 'لم يتحقق',
        },
        salesData: {
          totalSales,
          journalCount: journalsInRange.length,
        },
        rawProductionEntries,
        wasteAnalysis: {
          totalReports: wasteReports.length,
          totalQuantity: totalWastedQuantity,
          totalValue: totalWastedValue,
          wastePercentage,
          byReason: wasteByReason,
          byProduct: topWastedProducts,
        },
        qualityControl: {
          totalChecks: qualityChecks.length,
          passed,
          failed,
          passRate,
          issues: qualityChecks.filter(q => q.result === 'failed').slice(0, 5).map(q => ({
            product: 'منتج',
            issue: q.notes || 'مشكلة جودة',
            date: q.checkDate || '',
          })),
        },
        shiftPerformance,
        productPerformance,
        branchComparison,
        trends: {
          daily: dailyTrends,
          weekly: [],
        },
        filters: { branchId, startDate, endDate },
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching production reports:", error);
      res.status(500).json({ error: "فشل في جلب تقارير الإنتاج" });
    }
  });

  // Unified Command Center API - aggregates all KPIs in one call
  app.get("/api/command-center", isAuthenticated, async (req, res) => {
    try {
      const branchId = (req.query.branchId as string) || 'all';
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      
      const data = await storage.getCommandCenterData(branchId, date);
      res.json({
        ...data,
        branchId,
        date,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching command center data:", error);
      res.status(500).json({ error: "فشل في جلب بيانات مركز القيادة" });
    }
  });

  // ==================== RBAC System API ====================

  // Departments
  app.get("/api/rbac/departments", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const departments = await storage.getAllDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ error: "فشل في جلب الأقسام" });
    }
  });

  app.post("/api/rbac/departments", isAuthenticated, requirePermission("users", "create"), async (req, res) => {
    try {
      const { name, code, description, isActive } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: "الاسم والرمز مطلوبان" });
      }
      const department = await storage.createDepartment({ name, code, description, isActive: isActive ?? true });
      res.status(201).json(department);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(500).json({ error: "فشل في إنشاء القسم" });
    }
  });

  app.patch("/api/rbac/departments/:id", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const department = await storage.updateDepartment(id, req.body);
      if (!department) {
        return res.status(404).json({ error: "القسم غير موجود" });
      }
      res.json(department);
    } catch (error) {
      console.error("Error updating department:", error);
      res.status(500).json({ error: "فشل في تحديث القسم" });
    }
  });

  // Roles
  app.get("/api/rbac/roles", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const roles = await storage.getAllRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: "فشل في جلب الأدوار" });
    }
  });

  app.get("/api/rbac/roles/:id", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const role = await storage.getRole(id);
      if (!role) {
        return res.status(404).json({ error: "الدور غير موجود" });
      }
      const rolePermissions = await storage.getRolePermissions(id);
      res.json({ ...role, permissions: rolePermissions });
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ error: "فشل في جلب الدور" });
    }
  });

  app.post("/api/rbac/roles", isAuthenticated, requirePermission("users", "create"), async (req, res) => {
    try {
      const { name, slug, description, hierarchyLevel, inheritsFromRoleId, isSystemDefault } = req.body;
      if (!name || !slug) {
        return res.status(400).json({ error: "الاسم والمعرف مطلوبان" });
      }
      const role = await storage.createRole({ 
        name, 
        slug, 
        description, 
        hierarchyLevel: hierarchyLevel ?? 5, 
        inheritsFromRoleId,
        isSystemDefault: isSystemDefault ?? false 
      });
      res.status(201).json(role);
    } catch (error) {
      console.error("Error creating role:", error);
      res.status(500).json({ error: "فشل في إنشاء الدور" });
    }
  });

  app.patch("/api/rbac/roles/:id", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const role = await storage.updateRole(id, req.body);
      if (!role) {
        return res.status(404).json({ error: "الدور غير موجود" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ error: "فشل في تحديث الدور" });
    }
  });

  // Role Permissions
  app.post("/api/rbac/roles/:roleId/permissions", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const roleId = parseInt(req.params.roleId);
      const { permissionId, scope } = req.body;
      if (!permissionId) {
        return res.status(400).json({ error: "معرف الصلاحية مطلوب" });
      }
      const rp = await storage.addRolePermission({ roleId, permissionId, scope: scope || 'all' });
      res.status(201).json(rp);
    } catch (error) {
      console.error("Error adding role permission:", error);
      res.status(500).json({ error: "فشل في إضافة الصلاحية للدور" });
    }
  });

  app.delete("/api/rbac/roles/:roleId/permissions/:permissionId", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const roleId = parseInt(req.params.roleId);
      const permissionId = parseInt(req.params.permissionId);
      await storage.removeRolePermission(roleId, permissionId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing role permission:", error);
      res.status(500).json({ error: "فشل في إزالة الصلاحية من الدور" });
    }
  });

  // Permissions
  app.get("/api/rbac/permissions", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const permissions = await storage.getAllPermissions();
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ error: "فشل في جلب الصلاحيات" });
    }
  });

  app.get("/api/rbac/permissions/by-module/:module", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const permissions = await storage.getPermissionsByModule(req.params.module);
      res.json(permissions);
    } catch (error) {
      console.error("Error fetching permissions by module:", error);
      res.status(500).json({ error: "فشل في جلب صلاحيات الوحدة" });
    }
  });

  // User Assignments
  app.get("/api/rbac/users/:userId/assignments", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const targetUserId = req.params.userId;
      
      // Users can view their own assignments, or need users:view permission for others
      if (currentUser.id !== targetUserId) {
        const hasPermission = currentUser.role === 'admin' || await storage.userHasPermission(currentUser.id, 'users', 'view');
        if (!hasPermission) {
          return res.status(403).json({ error: "غير مصرح لك بعرض هذه البيانات" });
        }
      }
      
      const assignments = await storage.getUserAssignments(targetUserId);
      res.json(assignments);
    } catch (error) {
      console.error("Error fetching user assignments:", error);
      res.status(500).json({ error: "فشل في جلب تعيينات المستخدم" });
    }
  });

  app.post("/api/rbac/users/:userId/assignments", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const userId = req.params.userId;
      const { roleId, branchId, departmentId, scopeType, isPrimary, startDate, endDate } = req.body;
      
      if (!roleId) {
        return res.status(400).json({ error: "معرف الدور مطلوب" });
      }
      
      const assignment = await storage.createUserAssignment({
        userId,
        roleId,
        branchId,
        departmentId,
        scopeType: scopeType || 'branch',
        isPrimary: isPrimary ?? true,
        isActive: true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      });
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating user assignment:", error);
      res.status(500).json({ error: "فشل في إنشاء تعيين المستخدم" });
    }
  });

  app.patch("/api/rbac/users/:userId/assignments/:assignmentId", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      const assignment = await storage.updateUserAssignment(assignmentId, req.body);
      if (!assignment) {
        return res.status(404).json({ error: "التعيين غير موجود" });
      }
      res.json(assignment);
    } catch (error) {
      console.error("Error updating user assignment:", error);
      res.status(500).json({ error: "فشل في تحديث تعيين المستخدم" });
    }
  });

  app.delete("/api/rbac/users/:userId/assignments/:assignmentId", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.assignmentId);
      await storage.deleteUserAssignment(assignmentId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user assignment:", error);
      res.status(500).json({ error: "فشل في حذف تعيين المستخدم" });
    }
  });

  // User Permission Overrides
  app.get("/api/rbac/users/:userId/overrides", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const targetUserId = req.params.userId;
      
      // Users can view their own overrides, or need users:view permission for others
      if (currentUser.id !== targetUserId) {
        const hasPermission = currentUser.role === 'admin' || await storage.userHasPermission(currentUser.id, 'users', 'view');
        if (!hasPermission) {
          return res.status(403).json({ error: "غير مصرح لك بعرض هذه البيانات" });
        }
      }
      
      const overrides = await storage.getUserPermissionOverrides(targetUserId);
      res.json(overrides);
    } catch (error) {
      console.error("Error fetching user permission overrides:", error);
      res.status(500).json({ error: "فشل في جلب استثناءات الصلاحيات" });
    }
  });

  app.post("/api/rbac/users/:userId/overrides", isAuthenticated, requirePermission("users", "edit"), async (req: any, res) => {
    try {
      const userId = req.params.userId;
      const { permissionId, allow, reason, expiresAt } = req.body;
      const grantedBy = req.currentUser.id;
      
      if (permissionId === undefined || allow === undefined) {
        return res.status(400).json({ error: "معرف الصلاحية وحالة السماح مطلوبان" });
      }
      
      const override = await storage.createUserPermissionOverride({
        userId,
        permissionId,
        allow,
        reason,
        grantedBy,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      
      res.status(201).json(override);
    } catch (error) {
      console.error("Error creating user permission override:", error);
      res.status(500).json({ error: "فشل في إنشاء استثناء الصلاحية" });
    }
  });

  app.delete("/api/rbac/users/:userId/overrides/:overrideId", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const overrideId = parseInt(req.params.overrideId);
      await storage.deleteUserPermissionOverride(overrideId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user permission override:", error);
      res.status(500).json({ error: "فشل في حذف استثناء الصلاحية" });
    }
  });

  // User Branch Access
  app.get("/api/rbac/users/:userId/branches", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const targetUserId = req.params.userId;
      
      // Users can view their own branch access, or need users:view permission for others
      if (currentUser.id !== targetUserId) {
        const hasPermission = currentUser.role === 'admin' || await storage.userHasPermission(currentUser.id, 'users', 'view');
        if (!hasPermission) {
          return res.status(403).json({ error: "غير مصرح لك بعرض هذه البيانات" });
        }
      }
      
      const branchAccess = await storage.getUserBranchAccess(targetUserId);
      res.json(branchAccess);
    } catch (error) {
      console.error("Error fetching user branch access:", error);
      res.status(500).json({ error: "فشل في جلب صلاحيات الفروع" });
    }
  });

  app.post("/api/rbac/users/:userId/branches", isAuthenticated, requirePermission("users", "edit"), async (req: any, res) => {
    try {
      const userId = req.params.userId;
      const { branchId, isDefault, accessLevel } = req.body;
      
      if (!branchId) {
        return res.status(400).json({ error: "معرف الفرع مطلوب" });
      }
      
      const access = await storage.addUserBranchAccess({
        userId,
        branchId,
        isDefault: isDefault ?? false,
        accessLevel: accessLevel || 'full',
      });
      
      res.status(201).json(access);
    } catch (error) {
      console.error("Error adding user branch access:", error);
      res.status(500).json({ error: "فشل في إضافة صلاحية الفرع" });
    }
  });

  app.delete("/api/rbac/users/:userId/branches/:branchId", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const userId = req.params.userId;
      const branchId = req.params.branchId;
      await storage.removeUserBranchAccess(userId, branchId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing user branch access:", error);
      res.status(500).json({ error: "فشل في إزالة صلاحية الفرع" });
    }
  });

  app.patch("/api/rbac/users/:userId/branches/:branchId/default", isAuthenticated, requirePermission("users", "edit"), async (req, res) => {
    try {
      const userId = req.params.userId;
      const branchId = req.params.branchId;
      await storage.setUserDefaultBranch(userId, branchId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error setting default branch:", error);
      res.status(500).json({ error: "فشل في تعيين الفرع الافتراضي" });
    }
  });

  // User Effective Permissions
  app.get("/api/rbac/users/:userId/effective-permissions", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const targetUserId = req.params.userId;
      
      // Users can view their own effective permissions, or need users:view permission for others
      if (currentUser.id !== targetUserId) {
        const hasPermission = currentUser.role === 'admin' || await storage.userHasPermission(currentUser.id, 'users', 'view');
        if (!hasPermission) {
          return res.status(403).json({ error: "غير مصرح لك بعرض هذه البيانات" });
        }
      }
      
      const effectivePermissions = await storage.getUserEffectivePermissions(targetUserId);
      res.json(effectivePermissions);
    } catch (error) {
      console.error("Error fetching user effective permissions:", error);
      res.status(500).json({ error: "فشل في جلب الصلاحيات الفعلية" });
    }
  });

  // Current User Permissions (for frontend)
  app.get("/api/rbac/my-permissions", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const effectivePermissions = await storage.getUserEffectivePermissions(currentUser.id);
      res.json(effectivePermissions);
    } catch (error) {
      console.error("Error fetching current user permissions:", error);
      res.status(500).json({ error: "فشل في جلب صلاحياتك" });
    }
  });

  // Check Permission (utility endpoint)
  app.get("/api/rbac/check-permission", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const module = req.query.module as string;
      const action = req.query.action as string;
      const branchId = req.query.branchId as string | undefined;
      
      if (!module || !action) {
        return res.status(400).json({ error: "الوحدة والإجراء مطلوبان" });
      }
      
      const hasPermission = await storage.userHasPermission(currentUser.id, module, action, branchId);
      res.json({ hasPermission, module, action, branchId });
    } catch (error) {
      console.error("Error checking permission:", error);
      res.status(500).json({ error: "فشل في التحقق من الصلاحية" });
    }
  });

  // ==========================================
  // Security Settings API - إعدادات الأمان
  // ==========================================

  // Get user security settings
  app.get("/api/security/users/:userId/settings", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const { userId } = req.params;
      
      // Only admins or the user themselves can view security settings
      if (currentUser.id !== userId && currentUser.role !== "admin") {
        return res.status(403).json({ error: "غير مصرح لك بعرض هذه الإعدادات" });
      }
      
      const settings = await storage.getUserSecuritySettings(userId);
      res.json(settings || { userId, twoFactorEnabled: false });
    } catch (error) {
      console.error("Error fetching user security settings:", error);
      res.status(500).json({ error: "فشل في جلب إعدادات الأمان" });
    }
  });

  // Update user security settings
  app.patch("/api/security/users/:userId/settings", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const { userId } = req.params;
      
      // Only admins or the user themselves can update security settings
      if (currentUser.id !== userId && currentUser.role !== "admin") {
        return res.status(403).json({ error: "غير مصرح لك بتعديل هذه الإعدادات" });
      }
      
      // Validate using Zod schema with strict type checking
      const securitySettingsUpdateSchema = z.object({
        twoFactorEnabled: z.boolean().optional(),
        ipWhitelist: z.array(z.string()).nullable().optional(),
        ipRestrictionEnabled: z.boolean().optional(),
        sessionTimeout: z.number().min(5).max(1440).optional(), // 5 mins to 24 hours
        maxConcurrentSessions: z.number().min(1).max(10).optional(),
        passwordExpiryDays: z.number().min(0).max(365).optional(),
        forcePasswordChange: z.boolean().optional(),
      });
      
      const parseResult = securitySettingsUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: parseResult.error.issues });
      }
      
      const settings = await storage.upsertUserSecuritySettings(userId, parseResult.data);
      
      // Audit log for security settings update
      await storage.createSystemAuditLog({
        module: 'security',
        action: 'update_security_settings',
        userId: currentUser.id,
        targetId: userId,
        description: `تحديث إعدادات الأمان للمستخدم`,
        details: JSON.stringify({ updatedFields: Object.keys(parseResult.data) }),
        ipAddress: req.ip,
      });
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating user security settings:", error);
      res.status(500).json({ error: "فشل في تحديث إعدادات الأمان" });
    }
  });

  // Check if user is locked (requires authentication, admin only or self-check)
  app.get("/api/security/users/:userId/locked", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const { userId } = req.params;
      
      // Only admins or the user themselves can check lock status
      if (currentUser.id !== userId && currentUser.role !== "admin") {
        return res.status(403).json({ error: "غير مصرح لك بالاطلاع على هذه المعلومات" });
      }
      
      const isLocked = await storage.isUserLocked(userId);
      res.json({ isLocked });
    } catch (error) {
      console.error("Error checking if user is locked:", error);
      res.status(500).json({ error: "فشل في التحقق من حالة القفل" });
    }
  });

  // ==========================================
  // User Sessions API - جلسات المستخدمين
  // ==========================================

  // Get current user's active sessions
  app.get("/api/security/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const sessions = await storage.getUserSessions(currentUser.id);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching user sessions:", error);
      res.status(500).json({ error: "فشل في جلب الجلسات" });
    }
  });

  // Get specific user's sessions (admin only)
  app.get("/api/security/users/:userId/sessions", isAuthenticated, requirePermission("users", "view"), async (req: any, res) => {
    try {
      const { userId } = req.params;
      const sessions = await storage.getUserSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching user sessions:", error);
      res.status(500).json({ error: "فشل في جلب الجلسات" });
    }
  });

  // Invalidate a session (user can only invalidate their own sessions, admins can invalidate any)
  app.delete("/api/security/sessions/:sessionId", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const { sessionId } = req.params;
      
      // Get all user sessions to verify ownership
      const userSessions = await storage.getUserSessions(currentUser.id);
      const isOwner = userSessions.some(s => s.sessionId === sessionId);
      
      // Only the session owner or an admin can invalidate the session
      if (!isOwner && currentUser.role !== "admin") {
        return res.status(403).json({ error: "غير مصرح لك بإنهاء هذه الجلسة" });
      }
      
      await storage.invalidateSession(sessionId);
      
      // Audit log for session invalidation
      await storage.createSystemAuditLog({
        module: 'security',
        action: 'invalidate_session',
        userId: currentUser.id,
        targetId: sessionId,
        description: `إنهاء جلسة`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error invalidating session:", error);
      res.status(500).json({ error: "فشل في إنهاء الجلسة" });
    }
  });

  // Invalidate all user sessions (logout everywhere)
  app.delete("/api/security/users/:userId/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const { userId } = req.params;
      
      // Only admins or the user themselves can invalidate all sessions
      if (currentUser.id !== userId && currentUser.role !== "admin") {
        return res.status(403).json({ error: "غير مصرح لك بإنهاء هذه الجلسات" });
      }
      
      await storage.invalidateAllUserSessions(userId);
      
      // Audit log for invalidating all sessions
      await storage.createSystemAuditLog({
        module: 'security',
        action: 'invalidate_all_sessions',
        userId: currentUser.id,
        targetId: userId,
        description: `إنهاء جميع جلسات المستخدم`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error invalidating all user sessions:", error);
      res.status(500).json({ error: "فشل في إنهاء الجلسات" });
    }
  });

  // ==========================================
  // Security Alerts API - تنبيهات الأمان
  // ==========================================

  // Get all security alerts
  app.get("/api/security/alerts", isAuthenticated, requirePermission("rbac_management", "view"), async (req: any, res) => {
    try {
      const { userId, violationType, isResolved } = req.query;
      const filters: any = {};
      if (userId) filters.userId = userId;
      if (violationType) filters.violationType = violationType;
      if (isResolved !== undefined) filters.isResolved = isResolved === 'true';
      
      const alerts = await storage.getAllSecurityAlerts(filters);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching security alerts:", error);
      res.status(500).json({ error: "فشل في جلب التنبيهات" });
    }
  });

  // Get unresolved alert count
  app.get("/api/security/alerts/unresolved-count", isAuthenticated, requirePermission("rbac_management", "view"), async (req, res) => {
    try {
      const count = await storage.getUnresolvedAlertCount();
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unresolved alert count:", error);
      res.status(500).json({ error: "فشل في جلب عدد التنبيهات" });
    }
  });

  // Resolve a security alert
  app.patch("/api/security/alerts/:id/resolve", isAuthenticated, requirePermission("rbac_management", "edit"), async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const id = parseInt(req.params.id);
      const { notes } = req.body;
      
      const alert = await storage.resolveSecurityAlert(id, currentUser.id, notes);
      if (!alert) {
        return res.status(404).json({ error: "التنبيه غير موجود" });
      }
      
      // Audit log for resolving security alert
      await storage.createSystemAuditLog({
        module: 'security',
        action: 'resolve_security_alert',
        userId: currentUser.id,
        targetId: String(id),
        description: `حل تنبيه أمان`,
        details: notes ? JSON.stringify({ notes }) : undefined,
        ipAddress: req.ip,
      });
      
      res.json(alert);
    } catch (error) {
      console.error("Error resolving security alert:", error);
      res.status(500).json({ error: "فشل في حل التنبيه" });
    }
  });

  // ==========================================
  // Permission Check Logs API - سجل فحص الصلاحيات
  // ==========================================

  // Get permission check logs
  app.get("/api/security/permission-logs", isAuthenticated, requirePermission("rbac_management", "view"), async (req: any, res) => {
    try {
      const { userId, module, allowed, limit } = req.query;
      const filters: any = {};
      if (userId) filters.userId = userId;
      if (module) filters.module = module;
      if (allowed !== undefined) filters.allowed = allowed === 'true';
      if (limit) filters.limit = parseInt(limit);
      
      const logs = await storage.getPermissionCheckLogs(filters);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching permission check logs:", error);
      res.status(500).json({ error: "فشل في جلب سجل الصلاحيات" });
    }
  });

  // Get denied permissions summary for a user
  app.get("/api/security/users/:userId/denied-permissions", isAuthenticated, requirePermission("rbac_management", "view"), async (req, res) => {
    try {
      const { userId } = req.params;
      const summary = await storage.getDeniedPermissionsSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching denied permissions summary:", error);
      res.status(500).json({ error: "فشل في جلب ملخص الصلاحيات المرفوضة" });
    }
  });

  // ==========================================
  // Role Templates API - قوالب الأدوار
  // ==========================================

  // Get all role templates
  app.get("/api/rbac/role-templates", isAuthenticated, requirePermission("rbac_management", "view"), async (req, res) => {
    try {
      const templates = await storage.getAllRoleTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching role templates:", error);
      res.status(500).json({ error: "فشل في جلب قوالب الأدوار" });
    }
  });

  // Get role template by ID
  app.get("/api/rbac/role-templates/:id", isAuthenticated, requirePermission("rbac_management", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getRoleTemplate(id);
      if (!template) {
        return res.status(404).json({ error: "القالب غير موجود" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching role template:", error);
      res.status(500).json({ error: "فشل في جلب القالب" });
    }
  });

  // Create role template
  app.post("/api/rbac/role-templates", isAuthenticated, requirePermission("rbac_management", "create"), async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      
      // Validate using Zod schema
      const roleTemplateCreateSchema = z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/),
        description: z.string().max(500).nullable().optional(),
        permissions: z.array(z.object({
          module: z.string(),
          actions: z.array(z.string())
        })),
        departmentId: z.number().nullable().optional(),
      });
      
      const parseResult = roleTemplateCreateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: parseResult.error.issues });
      }
      
      const templateData = { 
        ...parseResult.data, 
        createdBy: currentUser.id 
      };
      const template = await storage.createRoleTemplate(templateData);
      
      // Audit log for creating role template
      await storage.createSystemAuditLog({
        module: 'rbac_management',
        action: 'create_role_template',
        userId: currentUser.id,
        targetId: String(template.id),
        description: `إنشاء قالب دور: ${template.name}`,
        ipAddress: req.ip,
      });
      
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating role template:", error);
      res.status(500).json({ error: "فشل في إنشاء القالب" });
    }
  });

  // Update role template
  app.patch("/api/rbac/role-templates/:id", isAuthenticated, requirePermission("rbac_management", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Validate using Zod schema
      const roleTemplateUpdateSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/).optional(),
        description: z.string().max(500).nullable().optional(),
        permissions: z.array(z.object({
          module: z.string(),
          actions: z.array(z.string())
        })).optional(),
        departmentId: z.number().nullable().optional(),
      });
      
      const parseResult = roleTemplateUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: parseResult.error.issues });
      }
      
      const template = await storage.updateRoleTemplate(id, parseResult.data);
      if (!template) {
        return res.status(404).json({ error: "القالب غير موجود" });
      }
      
      // Audit log for updating role template
      await storage.createSystemAuditLog({
        module: 'rbac_management',
        action: 'update_role_template',
        userId: (req as any).currentUser.id,
        targetId: String(id),
        description: `تحديث قالب دور: ${template.name}`,
        details: JSON.stringify({ updatedFields: Object.keys(parseResult.data) }),
        ipAddress: req.ip,
      });
      
      res.json(template);
    } catch (error) {
      console.error("Error updating role template:", error);
      res.status(500).json({ error: "فشل في تحديث القالب" });
    }
  });

  // Delete role template
  app.delete("/api/rbac/role-templates/:id", isAuthenticated, requirePermission("rbac_management", "delete"), async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const id = parseInt(req.params.id);
      
      // Get template before deletion for audit
      const template = await storage.getRoleTemplate(id);
      
      await storage.deleteRoleTemplate(id);
      
      // Audit log for deleting role template
      await storage.createSystemAuditLog({
        module: 'rbac_management',
        action: 'delete_role_template',
        userId: currentUser.id,
        targetId: String(id),
        description: `حذف قالب دور${template ? ': ' + template.name : ''}`,
        ipAddress: req.ip,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting role template:", error);
      res.status(500).json({ error: "فشل في حذف القالب" });
    }
  });

  // Apply role template to a role
  app.post("/api/rbac/roles/:roleId/apply-template/:templateId", isAuthenticated, requirePermission("rbac_management", "edit"), async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const roleId = parseInt(req.params.roleId);
      const templateId = parseInt(req.params.templateId);
      
      await storage.applyRoleTemplate(roleId, templateId);
      
      // Audit log for applying role template
      await storage.createSystemAuditLog({
        module: 'rbac_management',
        action: 'apply_role_template',
        userId: currentUser.id,
        targetId: String(roleId),
        description: `تطبيق قالب رقم ${templateId} على الدور رقم ${roleId}`,
        details: JSON.stringify({ templateId }),
        ipAddress: req.ip,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error applying role template:", error);
      res.status(500).json({ error: "فشل في تطبيق القالب" });
    }
  });

  // ==========================================
  // Cashier Shift Targets API - أهداف الكاشير للشفت
  // ==========================================

  app.get("/api/cashier-shift-targets", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId, date, shiftType } = req.query;
      const filters: any = {};
      if (branchId) filters.branchId = branchId;
      if (date) filters.date = date;
      if (shiftType) filters.shiftType = shiftType;
      
      console.log("[cashier-shift-targets] Request filters:", filters);
      
      let targets = await storage.getAllCashierShiftTargets(filters);
      console.log("[cashier-shift-targets] Storage returned:", targets.length, "targets");
      
      const user = req.currentUser;
      const activeBranch = getActiveBranchFilter(req);
      console.log("[cashier-shift-targets] User:", user?.id, "Role:", user?.role, "ActiveBranch:", activeBranch);

      // Enforce branch and user filtering
      if (user?.role !== "admin") {
        if (!activeBranch) {
          console.log("[cashier-shift-targets] No active branch, returning []");
          return res.json([]);
        }
        
        // Filter by branch
        targets = targets.filter(t => t.branchId === activeBranch);
        console.log("[cashier-shift-targets] After branch filter:", targets.length, "targets");
        
        // Check if user is a manager (can view all in branch)
        const permissions = await storage.getUserPermissions(user.id);
        const salesPerms = permissions.find(p => p.module === 'sales' || p.module === 'cashier_journal');
        const isManager = salesPerms?.actions.includes('approve') || salesPerms?.actions.includes('create');
        
        if (!isManager) {
          // Cashier only sees their own targets
          console.log("[cashier-shift-targets] Filtering by cashier ID:", user.id);
          targets = targets.filter(t => t.cashierId === user.id);
          console.log("[cashier-shift-targets] After cashier filter:", targets.length, "targets");
        }
      }

      console.log("[cashier-shift-targets] Final result:", targets.length, "targets");
      res.json(targets);
    } catch (error) {
      console.error("Error fetching cashier shift targets:", error);
      res.status(500).json({ error: "فشل في جلب أهداف الكاشير" });
    }
  });

  app.get("/api/cashier-shift-targets/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const target = await storage.getCashierShiftTarget(id);
      if (!target) {
        return res.status(404).json({ error: "الهدف غير موجود" });
      }
      res.json(target);
    } catch (error) {
      console.error("Error fetching cashier shift target:", error);
      res.status(500).json({ error: "فشل في جلب الهدف" });
    }
  });

  app.get("/api/cashier-shift-targets/branch/:branchId/date/:date", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId, date } = req.params;
      const targets = await storage.getCashierShiftTargetsByBranch(branchId, date);
      res.json(targets);
    } catch (error) {
      console.error("Error fetching branch cashier targets:", error);
      res.status(500).json({ error: "فشل في جلب أهداف الفرع" });
    }
  });

  app.get("/api/cashier-shift-targets/cashier/:cashierId", isAuthenticated, async (req, res) => {
    try {
      const { cashierId } = req.params;
      const { startDate, endDate } = req.query;
      const targets = await storage.getCashierShiftTargetsByCashier(
        cashierId, 
        startDate as string | undefined, 
        endDate as string | undefined
      );
      res.json(targets);
    } catch (error) {
      console.error("Error fetching cashier targets:", error);
      res.status(500).json({ error: "فشل في جلب أهداف الكاشير" });
    }
  });

  app.post("/api/cashier-shift-targets", isAuthenticated, requirePermission("sales", "create"), async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const targetData = { ...req.body, createdBy: currentUser.id };
      const target = await storage.createCashierShiftTarget(targetData);
      res.status(201).json(target);
    } catch (error) {
      console.error("Error creating cashier shift target:", error);
      res.status(500).json({ error: "فشل في إنشاء هدف الكاشير" });
    }
  });

  app.post("/api/cashier-shift-targets/bulk", isAuthenticated, requirePermission("sales", "create"), async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const targets = req.body.targets?.map((t: any) => ({ ...t, createdBy: currentUser.id })) || [];
      const created = await storage.bulkCreateCashierShiftTargets(targets);
      res.status(201).json(created);
    } catch (error) {
      console.error("Error bulk creating cashier shift targets:", error);
      res.status(500).json({ error: "فشل في إنشاء الأهداف" });
    }
  });

  app.patch("/api/cashier-shift-targets/:id", isAuthenticated, requirePermission("sales", "edit"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getCashierShiftTarget(id);
      if (!existing) {
        return res.status(404).json({ error: "الهدف غير موجود" });
      }

      const currentUser = req.currentUser;
      if (currentUser.role !== 'admin' && req.body.branchId && req.body.branchId !== existing.branchId) {
        return res.status(403).json({ error: "لا يمكنك تغيير الفرع" });
      }

      const updated = await storage.updateCashierShiftTarget(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating cashier shift target:", error);
      res.status(500).json({ error: "فشل في تحديث الهدف" });
    }
  });

  app.delete("/api/cashier-shift-targets/:id", isAuthenticated, requirePermission("sales", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCashierShiftTarget(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting cashier shift target:", error);
      res.status(500).json({ error: "فشل في حذف الهدف" });
    }
  });

  // ==========================================
  // Average Ticket Targets API - أهداف متوسط الفاتورة
  // ==========================================

  app.get("/api/average-ticket-targets", isAuthenticated, async (req, res) => {
    try {
      const { branchId, isActive } = req.query;
      const filters: any = {};
      if (branchId) filters.branchId = branchId;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      
      const targets = await storage.getAllAverageTicketTargets(filters);
      res.json(targets);
    } catch (error) {
      console.error("Error fetching average ticket targets:", error);
      res.status(500).json({ error: "فشل في جلب أهداف متوسط الفاتورة" });
    }
  });

  app.get("/api/average-ticket-targets/active", isAuthenticated, async (req, res) => {
    try {
      const { branchId, cashierId } = req.query;
      const targets = await storage.getActiveAverageTicketTargets(
        branchId as string | undefined,
        cashierId as string | undefined
      );
      res.json(targets);
    } catch (error) {
      console.error("Error fetching active average ticket targets:", error);
      res.status(500).json({ error: "فشل في جلب الأهداف النشطة" });
    }
  });

  app.get("/api/average-ticket-targets/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const target = await storage.getAverageTicketTarget(id);
      if (!target) {
        return res.status(404).json({ error: "الهدف غير موجود" });
      }
      res.json(target);
    } catch (error) {
      console.error("Error fetching average ticket target:", error);
      res.status(500).json({ error: "فشل في جلب الهدف" });
    }
  });

  app.post("/api/average-ticket-targets", isAuthenticated, requirePermission("sales", "create"), async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const targetData = { ...req.body, createdBy: currentUser.id };
      const target = await storage.createAverageTicketTarget(targetData);
      res.status(201).json(target);
    } catch (error) {
      console.error("Error creating average ticket target:", error);
      res.status(500).json({ error: "فشل في إنشاء هدف متوسط الفاتورة" });
    }
  });

  app.patch("/api/average-ticket-targets/:id", isAuthenticated, requirePermission("sales", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateAverageTicketTarget(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "الهدف غير موجود" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating average ticket target:", error);
      res.status(500).json({ error: "فشل في تحديث الهدف" });
    }
  });

  app.delete("/api/average-ticket-targets/:id", isAuthenticated, requirePermission("sales", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAverageTicketTarget(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting average ticket target:", error);
      res.status(500).json({ error: "فشل في حذف الهدف" });
    }
  });

  // ==========================================
  // Performance Alerts API - تنبيهات الأداء
  // ==========================================

  app.get("/api/performance-alerts", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId, date, isRead } = req.query;
      const filters: any = {};
      if (branchId) filters.branchId = branchId;
      if (date) filters.date = date;
      if (isRead !== undefined) filters.isRead = isRead === 'true';
      
      let alerts = await storage.getAllPerformanceAlerts(filters);
      const user = req.currentUser;
      const activeBranch = getActiveBranchFilter(req);

      if (user?.role !== "admin") {
        if (!activeBranch) return res.json([]);
        alerts = alerts.filter(a => a.branchId === activeBranch);
      }

      res.json(alerts);
    } catch (error) {
      console.error("Error fetching performance alerts:", error);
      res.status(500).json({ error: "فشل في جلب التنبيهات" });
    }
  });

  app.get("/api/performance-alerts/unread/:branchId", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId } = req.params;
      const alerts = await storage.getUnreadAlerts(branchId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching unread alerts:", error);
      res.status(500).json({ error: "فشل في جلب التنبيهات غير المقروءة" });
    }
  });

  app.get("/api/performance-alerts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const alert = await storage.getPerformanceAlert(id);
      if (!alert) {
        return res.status(404).json({ error: "التنبيه غير موجود" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Error fetching performance alert:", error);
      res.status(500).json({ error: "فشل في جلب التنبيه" });
    }
  });

  app.post("/api/performance-alerts", isAuthenticated, async (req: any, res) => {
    try {
      const alert = await storage.createPerformanceAlert(req.body);
      res.status(201).json(alert);
    } catch (error) {
      console.error("Error creating performance alert:", error);
      res.status(500).json({ error: "فشل في إنشاء التنبيه" });
    }
  });

  app.patch("/api/performance-alerts/:id/read", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.markAlertAsRead(id);
      if (!updated) {
        return res.status(404).json({ error: "التنبيه غير موجود" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error marking alert as read:", error);
      res.status(500).json({ error: "فشل في تحديث التنبيه" });
    }
  });

  app.patch("/api/performance-alerts/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.currentUser;
      const updated = await storage.acknowledgeAlert(id, currentUser.id);
      if (!updated) {
        return res.status(404).json({ error: "التنبيه غير موجود" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      res.status(500).json({ error: "فشل في تأكيد التنبيه" });
    }
  });

  app.post("/api/performance-alerts/bulk-read", isAuthenticated, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ error: "قائمة المعرفات مطلوبة" });
      }
      await storage.bulkMarkAlertsAsRead(ids);
      res.json({ success: true });
    } catch (error) {
      console.error("Error bulk marking alerts as read:", error);
      res.status(500).json({ error: "فشل في تحديث التنبيهات" });
    }
  });

  // ==========================================
  // Shift Performance Tracking API - تتبع أداء الشفت
  // ==========================================

  app.get("/api/shift-performance-tracking", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId, date } = req.query;
      const filters: any = {};
      if (branchId) filters.branchId = branchId;
      if (date) filters.date = date;
      
      let tracking = await storage.getAllShiftPerformanceTracking(filters);
      const user = req.currentUser;
      const activeBranch = getActiveBranchFilter(req);

      if (user?.role !== "admin") {
        if (!activeBranch) return res.json([]);
        tracking = tracking.filter(t => t.branchId === activeBranch);
      }

      res.json(tracking);
    } catch (error) {
      console.error("Error fetching shift performance tracking:", error);
      res.status(500).json({ error: "فشل في جلب تتبع الأداء" });
    }
  });

  app.get("/api/shift-performance-tracking/active/:branchId/:date/:shiftType", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId, date, shiftType } = req.params;
      const tracking = await storage.getActiveShiftPerformance(branchId, date, shiftType);
      if (!tracking) {
        return res.status(404).json({ error: "لا يوجد تتبع للشفت" });
      }
      res.json(tracking);
    } catch (error) {
      console.error("Error fetching active shift performance:", error);
      res.status(500).json({ error: "فشل في جلب تتبع الشفت" });
    }
  });

  app.get("/api/shift-performance-tracking/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tracking = await storage.getShiftPerformanceTracking(id);
      if (!tracking) {
        return res.status(404).json({ error: "التتبع غير موجود" });
      }
      res.json(tracking);
    } catch (error) {
      console.error("Error fetching shift performance tracking:", error);
      res.status(500).json({ error: "فشل في جلب التتبع" });
    }
  });

  app.post("/api/shift-performance-tracking", isAuthenticated, async (req: any, res) => {
    try {
      const tracking = await storage.createShiftPerformanceTracking(req.body);
      res.status(201).json(tracking);
    } catch (error) {
      console.error("Error creating shift performance tracking:", error);
      res.status(500).json({ error: "فشل في إنشاء التتبع" });
    }
  });

  app.patch("/api/shift-performance-tracking/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateShiftPerformanceTracking(id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "التتبع غير موجود" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating shift performance tracking:", error);
      res.status(500).json({ error: "فشل في تحديث التتبع" });
    }
  });

  app.put("/api/shift-performance-tracking/upsert", isAuthenticated, async (req: any, res) => {
    try {
      const tracking = await storage.upsertShiftPerformanceTracking(req.body);
      res.json(tracking);
    } catch (error) {
      console.error("Error upserting shift performance tracking:", error);
      res.status(500).json({ error: "فشل في تحديث/إنشاء التتبع" });
    }
  });

  // ==========================================
  // Marketing API Routes - إدارة التسويق
  // ==========================================

  // Marketing Campaigns - الحملات التسويقية
  app.get("/api/marketing/campaigns", isAuthenticated, async (req: any, res) => {
    try {
      const { status, season, objective } = req.query;
      const filters: { status?: string; season?: string; objective?: string } = {};
      if (status) filters.status = status as string;
      if (season) filters.season = season as string;
      if (objective) filters.objective = objective as string;
      
      const campaigns = await storage.getAllMarketingCampaigns(filters);
      res.json(campaigns);
    } catch (error) {
      console.error("Error fetching marketing campaigns:", error);
      res.status(500).json({ error: "فشل في جلب الحملات التسويقية" });
    }
  });

  app.get("/api/marketing/campaigns/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const campaign = await storage.getMarketingCampaign(id);
      if (!campaign) {
        return res.status(404).json({ error: "الحملة غير موجودة" });
      }
      res.json(campaign);
    } catch (error) {
      console.error("Error fetching marketing campaign:", error);
      res.status(500).json({ error: "فشل في جلب الحملة" });
    }
  });

  app.post("/api/marketing/campaigns", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMarketingCampaignSchema.parse(req.body);
      const campaign = await storage.createMarketingCampaign(validatedData);
      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating marketing campaign:", error);
      res.status(500).json({ error: "فشل في إنشاء الحملة" });
    }
  });

  app.patch("/api/marketing/campaigns/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const partialData = insertMarketingCampaignSchema.partial().parse(req.body);
      const campaign = await storage.updateMarketingCampaign(id, partialData);
      if (!campaign) {
        return res.status(404).json({ error: "الحملة غير موجودة" });
      }
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating marketing campaign:", error);
      res.status(500).json({ error: "فشل في تحديث الحملة" });
    }
  });

  app.delete("/api/marketing/campaigns/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteMarketingCampaign(id);
      if (!success) {
        return res.status(404).json({ error: "الحملة غير موجودة" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting marketing campaign:", error);
      res.status(500).json({ error: "فشل في حذف الحملة" });
    }
  });

  // Campaign Budget Allocations - تخصيصات ميزانية الحملة
  app.get("/api/marketing/campaigns/:campaignId/budget-allocations", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const allocations = await storage.getCampaignBudgetAllocations(campaignId);
      res.json(allocations);
    } catch (error) {
      console.error("Error fetching budget allocations:", error);
      res.status(500).json({ error: "فشل في جلب تخصيصات الميزانية" });
    }
  });

  app.post("/api/marketing/campaigns/:campaignId/budget-allocations", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const validatedData = insertCampaignBudgetAllocationSchema.parse({ ...req.body, campaignId });
      const allocation = await storage.createCampaignBudgetAllocation(validatedData);
      res.status(201).json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating budget allocation:", error);
      res.status(500).json({ error: "فشل في إنشاء تخصيص الميزانية" });
    }
  });

  app.patch("/api/marketing/budget-allocations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const partialData = insertCampaignBudgetAllocationSchema.partial().parse(req.body);
      const allocation = await storage.updateCampaignBudgetAllocation(id, partialData);
      if (!allocation) {
        return res.status(404).json({ error: "التخصيص غير موجود" });
      }
      res.json(allocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating budget allocation:", error);
      res.status(500).json({ error: "فشل في تحديث تخصيص الميزانية" });
    }
  });

  app.delete("/api/marketing/budget-allocations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteCampaignBudgetAllocation(id);
      if (!success) {
        return res.status(404).json({ error: "التخصيص غير موجود" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting budget allocation:", error);
      res.status(500).json({ error: "فشل في حذف تخصيص الميزانية" });
    }
  });

  // Campaign Goals - أهداف الحملة
  app.get("/api/marketing/campaigns/:campaignId/goals", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const goals = await storage.getCampaignGoals(campaignId);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching campaign goals:", error);
      res.status(500).json({ error: "فشل في جلب أهداف الحملة" });
    }
  });

  app.post("/api/marketing/campaigns/:campaignId/goals", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const validatedData = insertCampaignGoalSchema.parse({ ...req.body, campaignId });
      const goal = await storage.createCampaignGoal(validatedData);
      res.status(201).json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating campaign goal:", error);
      res.status(500).json({ error: "فشل في إنشاء هدف الحملة" });
    }
  });

  app.patch("/api/marketing/goals/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const partialData = insertCampaignGoalSchema.partial().parse(req.body);
      const goal = await storage.updateCampaignGoal(id, partialData);
      if (!goal) {
        return res.status(404).json({ error: "الهدف غير موجود" });
      }
      res.json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating campaign goal:", error);
      res.status(500).json({ error: "فشل في تحديث هدف الحملة" });
    }
  });

  app.delete("/api/marketing/goals/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteCampaignGoal(id);
      if (!success) {
        return res.status(404).json({ error: "الهدف غير موجود" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting campaign goal:", error);
      res.status(500).json({ error: "فشل في حذف هدف الحملة" });
    }
  });

  // Campaign Expenses - مصروفات الحملات
  app.get("/api/marketing/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const { campaignId, category, status, startDate, endDate } = req.query;
      const expenses = await storage.getAllCampaignExpenses({
        campaignId: campaignId ? parseInt(campaignId) : undefined,
        category: category as string,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching all campaign expenses:", error);
      res.status(500).json({ error: "فشل في جلب المصروفات" });
    }
  });

  app.get("/api/marketing/campaigns/:campaignId/expenses", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const expenses = await storage.getCampaignExpenses(campaignId);
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching campaign expenses:", error);
      res.status(500).json({ error: "فشل في جلب مصروفات الحملة" });
    }
  });

  app.get("/api/marketing/campaigns/:campaignId/expenses/total", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const total = await storage.getCampaignTotalExpenses(campaignId);
      res.json({ campaignId, total });
    } catch (error) {
      console.error("Error fetching campaign total expenses:", error);
      res.status(500).json({ error: "فشل في جلب إجمالي المصروفات" });
    }
  });

  app.get("/api/marketing/campaigns/:campaignId/expenses/by-category", isAuthenticated, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const byCategory = await storage.getExpensesByCategory(campaignId);
      res.json(byCategory);
    } catch (error) {
      console.error("Error fetching expenses by category:", error);
      res.status(500).json({ error: "فشل في جلب المصروفات حسب الفئة" });
    }
  });

  app.post("/api/marketing/campaigns/:campaignId/expenses", isAuthenticated, async (req: any, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId);
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const currentUser = req.currentUser;
      const validatedData = insertCampaignExpenseSchema.parse({ 
        ...req.body, 
        campaignId,
        createdBy: currentUser?.id
      });
      const expense = await storage.createCampaignExpense(validatedData);
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating campaign expense:", error);
      res.status(500).json({ error: "فشل في إنشاء المصروف" });
    }
  });

  app.patch("/api/marketing/expenses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const currentUser = req.currentUser;
      const partialData = insertCampaignExpenseSchema.partial().parse(req.body);
      
      // If status is being changed to approved, set approvedBy and approvedAt
      if (partialData.status === 'approved') {
        (partialData as any).approvedBy = currentUser?.id;
        (partialData as any).approvedAt = new Date();
      }
      
      const expense = await storage.updateCampaignExpense(id, partialData);
      if (!expense) {
        return res.status(404).json({ error: "المصروف غير موجود" });
      }
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating campaign expense:", error);
      res.status(500).json({ error: "فشل في تحديث المصروف" });
    }
  });

  app.delete("/api/marketing/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteCampaignExpense(id);
      if (!success) {
        return res.status(404).json({ error: "المصروف غير موجود" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting campaign expense:", error);
      res.status(500).json({ error: "فشل في حذف المصروف" });
    }
  });

  // Marketing Calendar Events - تقويم التسويق
  app.get("/api/marketing/calendar-events", isAuthenticated, async (req: any, res) => {
    try {
      const { campaignId, startDate, endDate } = req.query;
      const filters: { campaignId?: number; startDate?: string; endDate?: string } = {};
      if (campaignId) filters.campaignId = parseInt(campaignId as string);
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;
      
      const events = await storage.getAllMarketingCalendarEvents(filters);
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ error: "فشل في جلب أحداث التقويم" });
    }
  });

  app.post("/api/marketing/calendar-events", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMarketingCalendarEventSchema.parse(req.body);
      const event = await storage.createMarketingCalendarEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating calendar event:", error);
      res.status(500).json({ error: "فشل في إنشاء الحدث" });
    }
  });

  app.patch("/api/marketing/calendar-events/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const partialData = insertMarketingCalendarEventSchema.partial().parse(req.body);
      const event = await storage.updateMarketingCalendarEvent(id, partialData);
      if (!event) {
        return res.status(404).json({ error: "الحدث غير موجود" });
      }
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating calendar event:", error);
      res.status(500).json({ error: "فشل في تحديث الحدث" });
    }
  });

  app.delete("/api/marketing/calendar-events/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteMarketingCalendarEvent(id);
      if (!success) {
        return res.status(404).json({ error: "الحدث غير موجود" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      res.status(500).json({ error: "فشل في حذف الحدث" });
    }
  });

  // Marketing Influencers - المؤثرين
  app.get("/api/marketing/influencers", isAuthenticated, async (req: any, res) => {
    try {
      const { specialty, isActive } = req.query;
      const filters: { specialty?: string; isActive?: boolean } = {};
      if (specialty) filters.specialty = specialty as string;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      
      const influencers = await storage.getAllMarketingInfluencers(filters);
      res.json(influencers);
    } catch (error) {
      console.error("Error fetching influencers:", error);
      res.status(500).json({ error: "فشل في جلب المؤثرين" });
    }
  });

  // Export Influencers to Excel - MUST be before /:id route
  app.get("/api/marketing/influencers/export/excel", isAuthenticated, async (req: any, res) => {
    try {
      const influencers = await storage.getAllMarketingInfluencers({});
      
      const XLSX = await import("xlsx");
      const worksheetData = influencers.map((inf) => ({
        "الاسم": inf.name,
        "الاسم العربي": inf.nameAr || "",
        "رقم الهاتف": inf.phone || "",
        "البريد": inf.email || "",
        "رابط الحساب": inf.accountUrl || "",
        "رابط التغطية": inf.coverageUrl || "",
        "التخصص": inf.specialty,
        "المنصات": (inf.platforms || []).join(", "),
        "عدد المتابعين": inf.followerCount || 0,
        "المتابعين (نص)": inf.followerCountText || "",
        "تقييم المشاهدات": inf.viewRating || "",
        "معدل التفاعل %": inf.engagementRate || "",
        "المنطقة": inf.region || "",
        "المدينة": inf.city || "",
        "البنك": inf.bankName || "",
        "رقم الحساب البنكي": inf.bankAccountNumber || "",
        "صاحب الحساب": inf.bankAccountHolder || "",
        "الحالة": inf.isActive ? "نشط" : "غير نشط",
        "ملاحظات": inf.notes || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "المؤثرين");
      
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=influencers-${new Date().toISOString().split('T')[0]}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error("Error exporting influencers to Excel:", error);
      res.status(500).json({ error: "فشل في تصدير البيانات" });
    }
  });

  // Export Influencers to PDF - MUST be before /:id route
  app.get("/api/marketing/influencers/export/pdf", isAuthenticated, async (req: any, res) => {
    try {
      const influencers = await storage.getAllMarketingInfluencers({});
      const { generatePdfFromHtml } = await import("./pdf-generator");
      const { getLogoDataUrl } = await import("./pdf-assets");
      const logoBase64 = getLogoDataUrl();
      
      const totalInfluencers = influencers.length;
      const activeInfluencers = influencers.filter(i => i.isActive).length;
      const totalFollowers = influencers.reduce((sum, i) => sum + (i.followerCount || 0), 0);
      const avgFollowers = totalInfluencers > 0 ? Math.round(totalFollowers / totalInfluencers) : 0;
      const withBankInfo = influencers.filter(i => i.bankAccountNumber && i.bankName).length;

      const formatNumber = (num: number) => new Intl.NumberFormat("en-US").format(num);

      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Cairo', sans-serif; padding: 20px; direction: rtl; font-size: 10px; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #D4AF37; padding-bottom: 15px; }
            .logo { width: 120px; height: auto; }
            .title { font-size: 18px; font-weight: bold; color: #333; }
            .subtitle { font-size: 12px; color: #666; }
            .summary { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
            .summary-card { background: #f8f9fa; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #ddd; }
            .summary-value { font-size: 16px; font-weight: bold; color: #D4AF37; }
            .summary-label { font-size: 9px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { background: #D4AF37; color: white; padding: 8px 4px; font-size: 9px; text-align: right; }
            td { padding: 6px 4px; border-bottom: 1px solid #eee; font-size: 8px; text-align: right; }
            tr:nth-child(even) { background: #f9f9f9; }
            .status-active { color: #22c55e; font-weight: bold; }
            .status-inactive { color: #ef4444; }
            .bank-complete { color: #22c55e; }
            .bank-incomplete { color: #f59e0b; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">تقرير المؤثرين والبلوجرز</div>
              <div class="subtitle">تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</div>
            </div>
            <img src="${logoBase64}" class="logo" alt="Butter Logo">
          </div>

          <div class="summary">
            <div class="summary-card">
              <div class="summary-value">${formatNumber(totalInfluencers)}</div>
              <div class="summary-label">إجمالي المؤثرين</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${formatNumber(activeInfluencers)}</div>
              <div class="summary-label">المؤثرين النشطين</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${formatNumber(totalFollowers)}</div>
              <div class="summary-label">إجمالي المتابعين</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${formatNumber(avgFollowers)}</div>
              <div class="summary-label">متوسط المتابعين</div>
            </div>
            <div class="summary-card">
              <div class="summary-value">${formatNumber(withBankInfo)}</div>
              <div class="summary-label">معلومات بنكية مكتملة</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>المنصة</th>
                <th>المتابعين</th>
                <th>التقييم</th>
                <th>المنطقة</th>
                <th>البنك</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${influencers.map((inf, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${inf.name}</td>
                  <td style="direction: ltr; text-align: left;">${inf.phone || '-'}</td>
                  <td>${(inf.platforms || []).join(', ') || '-'}</td>
                  <td>${inf.followerCountText || formatNumber(inf.followerCount || 0)}</td>
                  <td>${inf.viewRating || '-'}</td>
                  <td>${inf.region || '-'}</td>
                  <td class="${inf.bankAccountNumber && inf.bankName ? 'bank-complete' : 'bank-incomplete'}">${inf.bankAccountNumber && inf.bankName ? '✓' : '✗'}</td>
                  <td class="${inf.isActive ? 'status-active' : 'status-inactive'}">${inf.isActive ? 'نشط' : 'غير نشط'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const pdfBuffer = await generatePdfFromHtml(htmlContent, { landscape: true });
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=influencers-report-${new Date().toISOString().split('T')[0]}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error exporting influencers to PDF:", error);
      res.status(500).json({ error: "فشل في تصدير التقرير" });
    }
  });

  app.get("/api/marketing/influencers/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const influencer = await storage.getMarketingInfluencer(id);
      if (!influencer) {
        return res.status(404).json({ error: "المؤثر غير موجود" });
      }
      res.json(influencer);
    } catch (error) {
      console.error("Error fetching influencer:", error);
      res.status(500).json({ error: "فشل في جلب المؤثر" });
    }
  });

  app.post("/api/marketing/influencers", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMarketingInfluencerSchema.parse(req.body);
      const influencer = await storage.createMarketingInfluencer(validatedData);
      res.status(201).json(influencer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating influencer:", error);
      res.status(500).json({ error: "فشل في إنشاء المؤثر" });
    }
  });

  app.patch("/api/marketing/influencers/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const partialData = insertMarketingInfluencerSchema.partial().parse(req.body);
      const influencer = await storage.updateMarketingInfluencer(id, partialData);
      if (!influencer) {
        return res.status(404).json({ error: "المؤثر غير موجود" });
      }
      res.json(influencer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating influencer:", error);
      res.status(500).json({ error: "فشل في تحديث المؤثر" });
    }
  });

  app.delete("/api/marketing/influencers/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteMarketingInfluencer(id);
      if (!success) {
        return res.status(404).json({ error: "المؤثر غير موجود" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting influencer:", error);
      res.status(500).json({ error: "فشل في حذف المؤثر" });
    }
  });

  // Influencer Campaign Links - روابط المؤثرين بالحملات
  app.get("/api/marketing/influencer-links", isAuthenticated, async (req: any, res) => {
    try {
      const { campaignId, influencerId } = req.query;
      const filters: { campaignId?: number; influencerId?: number } = {};
      if (campaignId) filters.campaignId = parseInt(campaignId as string);
      if (influencerId) filters.influencerId = parseInt(influencerId as string);
      
      const links = await storage.getInfluencerCampaignLinks(filters);
      res.json(links);
    } catch (error) {
      console.error("Error fetching influencer links:", error);
      res.status(500).json({ error: "فشل في جلب روابط المؤثرين" });
    }
  });

  app.post("/api/marketing/influencer-links", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertInfluencerCampaignLinkSchema.parse(req.body);
      const link = await storage.createInfluencerCampaignLink(validatedData);
      res.status(201).json(link);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating influencer link:", error);
      res.status(500).json({ error: "فشل في إنشاء رابط المؤثر" });
    }
  });

  app.patch("/api/marketing/influencer-links/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const partialData = insertInfluencerCampaignLinkSchema.partial().parse(req.body);
      const link = await storage.updateInfluencerCampaignLink(id, partialData);
      if (!link) {
        return res.status(404).json({ error: "الرابط غير موجود" });
      }
      res.json(link);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating influencer link:", error);
      res.status(500).json({ error: "فشل في تحديث رابط المؤثر" });
    }
  });

  app.delete("/api/marketing/influencer-links/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteInfluencerCampaignLink(id);
      if (!success) {
        return res.status(404).json({ error: "الرابط غير موجود" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting influencer link:", error);
      res.status(500).json({ error: "فشل في حذف رابط المؤثر" });
    }
  });

  // Influencer Contacts - جهات اتصال المؤثرين
  app.get("/api/marketing/influencers/:influencerId/contacts", isAuthenticated, async (req, res) => {
    try {
      const influencerId = parseInt(req.params.influencerId);
      if (isNaN(influencerId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const contacts = await storage.getInfluencerContacts(influencerId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching influencer contacts:", error);
      res.status(500).json({ error: "فشل في جلب جهات الاتصال" });
    }
  });

  app.post("/api/marketing/influencer-contacts", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertInfluencerContactSchema.parse(req.body);
      const contact = await storage.createInfluencerContact(validatedData);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating influencer contact:", error);
      res.status(500).json({ error: "فشل في إنشاء جهة الاتصال" });
    }
  });

  app.delete("/api/marketing/influencer-contacts/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteInfluencerContact(id);
      if (!success) {
        return res.status(404).json({ error: "جهة الاتصال غير موجودة" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting influencer contact:", error);
      res.status(500).json({ error: "فشل في حذف جهة الاتصال" });
    }
  });

  // Influencer Payments - كشف حساب المؤثرين
  app.get("/api/marketing/influencer-payments", isAuthenticated, async (req: any, res) => {
    try {
      const { influencerId, campaignId, status, startDate, endDate } = req.query;
      const filters: any = {};
      if (influencerId) filters.influencerId = parseInt(influencerId);
      if (campaignId) filters.campaignId = parseInt(campaignId);
      if (status) filters.status = status;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      const payments = await storage.getAllInfluencerPayments(filters);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching influencer payments:", error);
      res.status(500).json({ error: "فشل في جلب المدفوعات" });
    }
  });

  app.get("/api/marketing/influencers/:influencerId/payments", isAuthenticated, async (req, res) => {
    try {
      const influencerId = parseInt(req.params.influencerId);
      if (isNaN(influencerId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const payments = await storage.getInfluencerPayments(influencerId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching influencer payments:", error);
      res.status(500).json({ error: "فشل في جلب المدفوعات" });
    }
  });

  app.get("/api/marketing/influencers/:influencerId/total-payments", isAuthenticated, async (req, res) => {
    try {
      const influencerId = parseInt(req.params.influencerId);
      if (isNaN(influencerId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const total = await storage.getInfluencerTotalPayments(influencerId);
      res.json({ influencerId, total });
    } catch (error) {
      console.error("Error fetching influencer total payments:", error);
      res.status(500).json({ error: "فشل في جلب إجمالي المدفوعات" });
    }
  });

  app.get("/api/marketing/influencers/:influencerId/expenses", isAuthenticated, async (req, res) => {
    try {
      const influencerId = parseInt(req.params.influencerId);
      if (isNaN(influencerId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const expenses = await storage.getExpensesByInfluencerId(influencerId);
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching influencer expenses:", error);
      res.status(500).json({ error: "فشل في جلب مصروفات المؤثر" });
    }
  });

  app.get("/api/marketing/influencers/:influencerId/total-expenses", isAuthenticated, async (req, res) => {
    try {
      const influencerId = parseInt(req.params.influencerId);
      if (isNaN(influencerId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const total = await storage.getTotalExpensesByInfluencerId(influencerId);
      res.json({ influencerId, total });
    } catch (error) {
      console.error("Error fetching influencer total expenses:", error);
      res.status(500).json({ error: "فشل في جلب إجمالي مصروفات المؤثر" });
    }
  });

  app.get("/api/marketing/influencer-payments/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const payment = await storage.getInfluencerPayment(id);
      if (!payment) {
        return res.status(404).json({ error: "المدفوعة غير موجودة" });
      }
      res.json(payment);
    } catch (error) {
      console.error("Error fetching influencer payment:", error);
      res.status(500).json({ error: "فشل في جلب المدفوعة" });
    }
  });

  app.post("/api/marketing/influencer-payments", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const data = { ...req.body, createdBy: currentUser?.id };
      const validatedData = insertInfluencerPaymentSchema.parse(data);
      const payment = await storage.createInfluencerPayment(validatedData);
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating influencer payment:", error);
      res.status(500).json({ error: "فشل في إنشاء المدفوعة" });
    }
  });

  app.patch("/api/marketing/influencer-payments/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const payment = await storage.updateInfluencerPayment(id, req.body);
      if (!payment) {
        return res.status(404).json({ error: "المدفوعة غير موجودة" });
      }
      res.json(payment);
    } catch (error) {
      console.error("Error updating influencer payment:", error);
      res.status(500).json({ error: "فشل في تحديث المدفوعة" });
    }
  });

  app.delete("/api/marketing/influencer-payments/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteInfluencerPayment(id);
      if (!success) {
        return res.status(404).json({ error: "المدفوعة غير موجودة" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting influencer payment:", error);
      res.status(500).json({ error: "فشل في حذف المدفوعة" });
    }
  });

  // Marketing Tasks - مهام التسويق
  app.get("/api/marketing/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const { campaignId, assignedTo, status } = req.query;
      const filters: { campaignId?: number; assignedTo?: string; status?: string } = {};
      if (campaignId) filters.campaignId = parseInt(campaignId as string);
      if (assignedTo) filters.assignedTo = assignedTo as string;
      if (status) filters.status = status as string;
      
      const tasks = await storage.getAllMarketingTasks(filters);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching marketing tasks:", error);
      res.status(500).json({ error: "فشل في جلب المهام" });
    }
  });

  app.get("/api/marketing/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const task = await storage.getMarketingTask(id);
      if (!task) {
        return res.status(404).json({ error: "المهمة غير موجودة" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching marketing task:", error);
      res.status(500).json({ error: "فشل في جلب المهمة" });
    }
  });

  app.post("/api/marketing/tasks", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMarketingTaskSchema.parse(req.body);
      const task = await storage.createMarketingTask(validatedData);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating marketing task:", error);
      res.status(500).json({ error: "فشل في إنشاء المهمة" });
    }
  });

  app.patch("/api/marketing/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const partialData = insertMarketingTaskSchema.partial().parse(req.body);
      const task = await storage.updateMarketingTask(id, partialData);
      if (!task) {
        return res.status(404).json({ error: "المهمة غير موجودة" });
      }
      res.json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating marketing task:", error);
      res.status(500).json({ error: "فشل في تحديث المهمة" });
    }
  });

  app.delete("/api/marketing/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteMarketingTask(id);
      if (!success) {
        return res.status(404).json({ error: "المهمة غير موجودة" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting marketing task:", error);
      res.status(500).json({ error: "فشل في حذف المهمة" });
    }
  });

  // Marketing Task Activities - نشاطات مهام التسويق
  app.get("/api/marketing/tasks/:taskId/activities", isAuthenticated, async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const activities = await storage.getMarketingTaskActivities(taskId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching task activities:", error);
      res.status(500).json({ error: "فشل في جلب نشاطات المهمة" });
    }
  });

  app.post("/api/marketing/task-activities", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMarketingTaskActivitySchema.parse(req.body);
      const activity = await storage.createMarketingTaskActivity(validatedData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating task activity:", error);
      res.status(500).json({ error: "فشل في إنشاء نشاط المهمة" });
    }
  });

  // Marketing Performance Reports - تقارير أداء التسويق
  app.get("/api/marketing/reports", isAuthenticated, async (req: any, res) => {
    try {
      const { reportType, campaignId } = req.query;
      const filters: { reportType?: string; campaignId?: number } = {};
      if (reportType) filters.reportType = reportType as string;
      if (campaignId) filters.campaignId = parseInt(campaignId as string);
      
      const reports = await storage.getAllMarketingPerformanceReports(filters);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching performance reports:", error);
      res.status(500).json({ error: "فشل في جلب تقارير الأداء" });
    }
  });

  app.get("/api/marketing/reports/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const report = await storage.getMarketingPerformanceReport(id);
      if (!report) {
        return res.status(404).json({ error: "التقرير غير موجود" });
      }
      res.json(report);
    } catch (error) {
      console.error("Error fetching performance report:", error);
      res.status(500).json({ error: "فشل في جلب التقرير" });
    }
  });

  app.post("/api/marketing/reports", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMarketingPerformanceReportSchema.parse(req.body);
      const report = await storage.createMarketingPerformanceReport(validatedData);
      res.status(201).json(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating performance report:", error);
      res.status(500).json({ error: "فشل في إنشاء التقرير" });
    }
  });

  // Marketing Assets - أصول التسويق
  app.get("/api/marketing/assets", isAuthenticated, async (req: any, res) => {
    try {
      const { campaignId, assetType } = req.query;
      const filters: { campaignId?: number; assetType?: string } = {};
      if (campaignId) filters.campaignId = parseInt(campaignId as string);
      if (assetType) filters.assetType = assetType as string;
      
      const assets = await storage.getAllMarketingAssets(filters);
      res.json(assets);
    } catch (error) {
      console.error("Error fetching marketing assets:", error);
      res.status(500).json({ error: "فشل في جلب الأصول التسويقية" });
    }
  });

  app.post("/api/marketing/assets", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMarketingAssetSchema.parse(req.body);
      const asset = await storage.createMarketingAsset(validatedData);
      res.status(201).json(asset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating marketing asset:", error);
      res.status(500).json({ error: "فشل في إنشاء الأصل التسويقي" });
    }
  });

  app.patch("/api/marketing/assets/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const partialData = insertMarketingAssetSchema.partial().parse(req.body);
      const asset = await storage.updateMarketingAsset(id, partialData);
      if (!asset) {
        return res.status(404).json({ error: "الأصل غير موجود" });
      }
      res.json(asset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating marketing asset:", error);
      res.status(500).json({ error: "فشل في تحديث الأصل التسويقي" });
    }
  });

  app.delete("/api/marketing/assets/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteMarketingAsset(id);
      if (!success) {
        return res.status(404).json({ error: "الأصل غير موجود" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting marketing asset:", error);
      res.status(500).json({ error: "فشل في حذف الأصل التسويقي" });
    }
  });

  // Marketing Team Members - فريق التسويق
  app.get("/api/marketing/team", isAuthenticated, async (req: any, res) => {
    try {
      const { isActive } = req.query;
      const filters: { isActive?: boolean } = {};
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      
      const members = await storage.getAllMarketingTeamMembers(filters);
      res.json(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ error: "فشل في جلب أعضاء الفريق" });
    }
  });

  app.post("/api/marketing/team", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMarketingTeamMemberSchema.parse(req.body);
      const member = await storage.createMarketingTeamMember(validatedData);
      res.status(201).json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating team member:", error);
      res.status(500).json({ error: "فشل في إضافة عضو الفريق" });
    }
  });

  app.patch("/api/marketing/team/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const partialData = insertMarketingTeamMemberSchema.partial().parse(req.body);
      const member = await storage.updateMarketingTeamMember(id, partialData);
      if (!member) {
        return res.status(404).json({ error: "العضو غير موجود" });
      }
      res.json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating team member:", error);
      res.status(500).json({ error: "فشل في تحديث عضو الفريق" });
    }
  });

  app.delete("/api/marketing/team/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const success = await storage.deleteMarketingTeamMember(id);
      if (!success) {
        return res.status(404).json({ error: "العضو غير موجود" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting team member:", error);
      res.status(500).json({ error: "فشل في حذف عضو الفريق" });
    }
  });

  // Marketing Alerts - تنبيهات التسويق
  app.get("/api/marketing/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const { targetUserId, isRead } = req.query;
      const filters: { targetUserId?: string; isRead?: boolean } = {};
      if (targetUserId) filters.targetUserId = targetUserId as string;
      if (isRead !== undefined) filters.isRead = isRead === 'true';
      
      const alerts = await storage.getAllMarketingAlerts(filters);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching marketing alerts:", error);
      res.status(500).json({ error: "فشل في جلب التنبيهات" });
    }
  });

  app.post("/api/marketing/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertMarketingAlertSchema.parse(req.body);
      const alert = await storage.createMarketingAlert(validatedData);
      res.status(201).json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating marketing alert:", error);
      res.status(500).json({ error: "فشل في إنشاء التنبيه" });
    }
  });

  app.patch("/api/marketing/alerts/:id/read", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const alert = await storage.markMarketingAlertAsRead(id);
      if (!alert) {
        return res.status(404).json({ error: "التنبيه غير موجود" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Error marking alert as read:", error);
      res.status(500).json({ error: "فشل في تحديث التنبيه" });
    }
  });

  app.patch("/api/marketing/alerts/:id/acknowledge", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "معرف غير صالح" });
      }
      const currentUser = req.currentUser;
      const alert = await storage.acknowledgeMarketingAlert(id, currentUser.id);
      if (!alert) {
        return res.status(404).json({ error: "التنبيه غير موجود" });
      }
      res.json(alert);
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      res.status(500).json({ error: "فشل في تأكيد التنبيه" });
    }
  });

  // Marketing Statistics API endpoint
  app.get("/api/marketing/statistics", isAuthenticated, async (req: any, res) => {
    try {
      const campaigns = await storage.getAllMarketingCampaigns({});
      const influencers = await storage.getAllMarketingInfluencers({});
      const tasks = await storage.getAllMarketingTasks({});
      const team = await storage.getAllMarketingTeamMembers({});
      const calendarEvents = await storage.getAllMarketingCalendarEvents({});
      const assets = await storage.getAllMarketingAssets({});
      const alerts = await storage.getAllMarketingAlerts({});

      // Calculate campaign statistics
      const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
      const totalBudget = campaigns.reduce((sum, c) => sum + Number(c.totalBudget || 0), 0);
      const spentBudget = campaigns.reduce((sum, c) => sum + Number(c.spentBudget || 0), 0);
      const budgetUtilization = totalBudget > 0 ? Math.round((spentBudget / totalBudget) * 100) : 0;

      // Calculate influencer statistics
      const activeInfluencers = influencers.filter(i => i.isActive).length;
      const totalFollowers = influencers.reduce((sum, i) => sum + Number(i.followerCount || 0), 0);

      // Calculate task statistics
      const pendingTasks = tasks.filter(t => t.status === 'pending').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const taskCompletionRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

      // Calculate team statistics
      const activeTeamMembers = team.filter(m => m.isActive).length;

      // Calculate upcoming events (next 30 days)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      thirtyDaysFromNow.setHours(23, 59, 59, 999);
      const upcomingEvents = calendarEvents.filter(e => {
        const eventDate = new Date(e.startDate);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today && eventDate <= thirtyDaysFromNow;
      }).length;

      // Unread alerts
      const unreadAlerts = alerts.filter(a => !a.isRead).length;

      res.json({
        campaigns: {
          total: campaigns.length,
          active: activeCampaigns,
          totalBudget,
          spentBudget,
          budgetUtilization
        },
        influencers: {
          total: influencers.length,
          active: activeInfluencers,
          totalFollowers
        },
        tasks: {
          total: tasks.length,
          pending: pendingTasks,
          inProgress: inProgressTasks,
          completed: completedTasks,
          completionRate: taskCompletionRate
        },
        team: {
          total: team.length,
          active: activeTeamMembers
        },
        calendar: {
          total: calendarEvents.length,
          upcoming: upcomingEvents
        },
        assets: {
          total: assets.length
        },
        alerts: {
          total: alerts.length,
          unread: unreadAlerts
        }
      });
    } catch (error) {
      console.error("Error fetching marketing statistics:", error);
      res.status(500).json({ error: "فشل في جلب الإحصائيات" });
    }
  });

  // ==========================================
  // نظام إدارة الورديات والحضور - Shift Management & Attendance APIs
  // ==========================================

  // Branch Shift Profiles - إعدادات أوقات الورديات حسب الفرع
  app.get("/api/shift-profiles/:branchId", isAuthenticated, async (req, res) => {
    try {
      const { branchId } = req.params;
      const profiles = await storage.getBranchShiftProfiles(branchId);
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching shift profiles:", error);
      res.status(500).json({ error: "فشل في جلب إعدادات الورديات" });
    }
  });

  app.get("/api/shift-profiles/:branchId/:shiftCode", isAuthenticated, async (req, res) => {
    try {
      const { branchId, shiftCode } = req.params;
      const profile = await storage.getBranchShiftProfileByCode(branchId, shiftCode);
      if (!profile) return res.status(404).json({ error: "إعدادات الوردية غير موجودة" });
      res.json(profile);
    } catch (error) {
      console.error("Error fetching shift profile:", error);
      res.status(500).json({ error: "فشل في جلب إعدادات الوردية" });
    }
  });

  app.post("/api/shift-profiles", isAuthenticated, async (req, res) => {
    try {
      const { branchId, shiftCode, displayName, startTime, endTime, breakMinutes, graceMinutesBefore, graceMinutesAfter, sortOrder } = req.body;
      if (!branchId || !shiftCode || !displayName || !startTime || !endTime) {
        return res.status(400).json({ error: "البيانات المطلوبة غير مكتملة" });
      }
      const profile = await storage.createBranchShiftProfile({
        branchId,
        shiftCode,
        displayName,
        startTime,
        endTime,
        breakMinutes: breakMinutes ?? 60,
        graceMinutesBefore: graceMinutesBefore ?? 15,
        graceMinutesAfter: graceMinutesAfter ?? 15,
        sortOrder: sortOrder ?? 0,
        isActive: true
      });
      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating shift profile:", error);
      res.status(500).json({ error: "فشل في إنشاء إعدادات الوردية" });
    }
  });

  app.put("/api/shift-profiles/:branchId", isAuthenticated, async (req, res) => {
    try {
      const { branchId } = req.params;
      const { profiles } = req.body;
      if (!Array.isArray(profiles)) {
        return res.status(400).json({ error: "البيانات غير صالحة" });
      }
      const updated = await storage.upsertBranchShiftProfiles(branchId, profiles);
      res.json(updated);
    } catch (error) {
      console.error("Error updating shift profiles:", error);
      res.status(500).json({ error: "فشل في تحديث إعدادات الورديات" });
    }
  });

  app.patch("/api/shift-profiles/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const profile = await storage.updateBranchShiftProfile(id, req.body);
      if (!profile) return res.status(404).json({ error: "إعدادات الوردية غير موجودة" });
      res.json(profile);
    } catch (error) {
      console.error("Error updating shift profile:", error);
      res.status(500).json({ error: "فشل في تحديث إعدادات الوردية" });
    }
  });

  app.delete("/api/shift-profiles/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      await storage.deleteBranchShiftProfile(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting shift profile:", error);
      res.status(500).json({ error: "فشل في حذف إعدادات الوردية" });
    }
  });

  // Schedule Templates - قوالب الجداول
  app.get("/api/schedule-templates", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId } = req.query;
      const templates = await storage.getAllScheduleTemplates(branchId as string);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching schedule templates:", error);
      res.status(500).json({ error: "فشل في جلب قوالب الجداول" });
    }
  });

  app.get("/api/schedule-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const template = await storage.getScheduleTemplate(id);
      if (!template) return res.status(404).json({ error: "القالب غير موجود" });
      res.json(template);
    } catch (error) {
      console.error("Error fetching schedule template:", error);
      res.status(500).json({ error: "فشل في جلب القالب" });
    }
  });

  app.post("/api/schedule-templates", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const validatedData = insertScheduleTemplateSchema.parse({
        ...req.body,
        createdBy: currentUser?.id
      });
      const template = await storage.createScheduleTemplate(validatedData);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating schedule template:", error);
      res.status(500).json({ error: "فشل في إنشاء القالب" });
    }
  });

  app.patch("/api/schedule-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const partialData = insertScheduleTemplateSchema.partial().parse(req.body);
      const template = await storage.updateScheduleTemplate(id, partialData);
      if (!template) return res.status(404).json({ error: "القالب غير موجود" });
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating schedule template:", error);
      res.status(500).json({ error: "فشل في تحديث القالب" });
    }
  });

  app.delete("/api/schedule-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      await storage.deleteScheduleTemplate(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting schedule template:", error);
      res.status(500).json({ error: "فشل في حذف القالب" });
    }
  });

  // Schedule Periods - فترات الجدول
  app.get("/api/schedule-periods", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId } = req.query;
      const periods = await storage.getAllSchedulePeriods(branchId as string);
      res.json(periods);
    } catch (error) {
      console.error("Error fetching schedule periods:", error);
      res.status(500).json({ error: "فشل في جلب فترات الجدول" });
    }
  });

  app.get("/api/schedule-periods/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const period = await storage.getSchedulePeriod(id);
      if (!period) return res.status(404).json({ error: "الفترة غير موجودة" });
      res.json(period);
    } catch (error) {
      console.error("Error fetching schedule period:", error);
      res.status(500).json({ error: "فشل في جلب الفترة" });
    }
  });

  app.post("/api/schedule-periods", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const validatedData = insertSchedulePeriodSchema.parse({
        ...req.body,
        createdBy: currentUser?.id
      });
      const period = await storage.createSchedulePeriod(validatedData);
      res.status(201).json(period);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating schedule period:", error);
      res.status(500).json({ error: "فشل في إنشاء الفترة" });
    }
  });

  app.patch("/api/schedule-periods/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const partialData = insertSchedulePeriodSchema.partial().parse(req.body);
      const period = await storage.updateSchedulePeriod(id, partialData);
      if (!period) return res.status(404).json({ error: "الفترة غير موجودة" });
      res.json(period);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating schedule period:", error);
      res.status(500).json({ error: "فشل في تحديث الفترة" });
    }
  });

  app.post("/api/schedule-periods/:id/publish", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const currentUser = req.currentUser;
      const period = await storage.publishSchedulePeriod(id, currentUser?.id);
      if (!period) return res.status(404).json({ error: "الفترة غير موجودة" });
      res.json(period);
    } catch (error) {
      console.error("Error publishing schedule period:", error);
      res.status(500).json({ error: "فشل في نشر الفترة" });
    }
  });

  app.delete("/api/schedule-periods/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      await storage.deleteSchedulePeriod(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting schedule period:", error);
      res.status(500).json({ error: "فشل في حذف الفترة" });
    }
  });

  // Employee Schedules - جداول الموظفين
  app.get("/api/employee-schedules", isAuthenticated, async (req: any, res) => {
    try {
      const { periodId, employeeId, date, branchId, startDate, endDate } = req.query;
      
      if (periodId) {
        const schedules = await storage.getEmployeeSchedulesByPeriod(parseInt(periodId as string));
        return res.json(schedules);
      }
      if (employeeId) {
        const schedules = await storage.getEmployeeSchedulesByEmployee(
          employeeId as string,
          startDate as string,
          endDate as string
        );
        return res.json(schedules);
      }
      if (branchId && startDate && endDate) {
        const schedules = await storage.getEmployeeSchedulesByBranchAndDateRange(
          branchId as string,
          startDate as string,
          endDate as string
        );
        return res.json(schedules);
      }
      if (date) {
        const schedules = await storage.getEmployeeSchedulesByDate(date as string, branchId as string);
        return res.json(schedules);
      }
      
      res.json([]);
    } catch (error) {
      console.error("Error fetching employee schedules:", error);
      res.status(500).json({ error: "فشل في جلب جداول الموظفين" });
    }
  });

  app.post("/api/employee-schedules", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertEmployeeScheduleSchema.parse(req.body);
      const schedule = await storage.createEmployeeSchedule(validatedData);
      res.status(201).json(schedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating employee schedule:", error);
      res.status(500).json({ error: "فشل في إنشاء الجدول" });
    }
  });

  app.post("/api/employee-schedules/bulk", isAuthenticated, async (req, res) => {
    try {
      const { schedules } = req.body;
      if (!Array.isArray(schedules)) {
        return res.status(400).json({ error: "يجب أن تكون البيانات مصفوفة" });
      }
      
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const validatedSchedules = schedules.map(s => {
        const date = new Date(s.scheduleDate);
        const dayOfWeek = s.dayOfWeek || dayNames[date.getDay()];
        return {
          ...s,
          dayOfWeek,
          employeeName: s.employeeName || "Unknown",
        };
      });
      
      const created = await storage.createBulkEmployeeSchedules(validatedSchedules);
      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating bulk employee schedules:", error);
      res.status(500).json({ error: "فشل في إنشاء الجداول" });
    }
  });

  app.patch("/api/employee-schedules/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const partialData = insertEmployeeScheduleSchema.partial().parse(req.body);
      const schedule = await storage.updateEmployeeSchedule(id, partialData);
      if (!schedule) return res.status(404).json({ error: "الجدول غير موجود" });
      res.json(schedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating employee schedule:", error);
      res.status(500).json({ error: "فشل في تحديث الجدول" });
    }
  });

  app.delete("/api/employee-schedules/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      await storage.deleteEmployeeSchedule(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting employee schedule:", error);
      res.status(500).json({ error: "فشل في حذف الجدول" });
    }
  });

  // Attendance Records - سجلات الحضور
  app.get("/api/attendance", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId, employeeId, startDate, endDate, status } = req.query;
      const filters: any = {};
      if (branchId) filters.branchId = branchId;
      if (employeeId) filters.employeeId = employeeId;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (status) filters.status = status;
      
      const records = await storage.getAllAttendanceRecords(filters);
      res.json(records);
    } catch (error) {
      console.error("Error fetching attendance records:", error);
      res.status(500).json({ error: "فشل في جلب سجلات الحضور" });
    }
  });

  app.get("/api/attendance/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const record = await storage.getAttendanceRecord(id);
      if (!record) return res.status(404).json({ error: "السجل غير موجود" });
      res.json(record);
    } catch (error) {
      console.error("Error fetching attendance record:", error);
      res.status(500).json({ error: "فشل في جلب السجل" });
    }
  });

  app.post("/api/attendance", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertAttendanceRecordSchema.parse(req.body);
      const record = await storage.createAttendanceRecord(validatedData);
      res.status(201).json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating attendance record:", error);
      res.status(500).json({ error: "فشل في إنشاء السجل" });
    }
  });

  app.patch("/api/attendance/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const partialData = insertAttendanceRecordSchema.partial().parse(req.body);
      const record = await storage.updateAttendanceRecord(id, partialData);
      if (!record) return res.status(404).json({ error: "السجل غير موجود" });
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating attendance record:", error);
      res.status(500).json({ error: "فشل في تحديث السجل" });
    }
  });

  // Check-in / Check-out with signature
  app.post("/api/attendance/check-in", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId, signature, deviceInfo } = req.body;
      const currentUser = req.currentUser;
      
      if (!branchId) {
        return res.status(400).json({ error: "الفرع مطلوب" });
      }

      const effectiveBranchId = currentUser?.branchId || branchId;
      
      if (currentUser?.role !== "admin") {
        if (!currentUser?.branchId) {
          return res.status(403).json({ error: "لم يتم تحديد فرع لحسابك. يرجى التواصل مع الإدارة" });
        }
        if (currentUser.branchId !== branchId) {
          return res.status(403).json({ error: "لا يمكنك تسجيل الحضور في فرع آخر" });
        }
      }

      if (signature && signature.length > 500000) {
        return res.status(400).json({ error: "حجم التوقيع كبير جداً" });
      }

      const today = new Date().toISOString().split('T')[0];
      const existingRecord = await storage.getAttendanceByEmployeeAndDate(currentUser?.id, today);
      if (existingRecord && !existingRecord.actualCheckOut) {
        return res.status(400).json({ error: "لقد سجلت حضورك مسبقاً اليوم" });
      }
      
      const record = await storage.checkIn(currentUser?.id, effectiveBranchId, signature, deviceInfo);
      res.status(201).json(record);
    } catch (error) {
      console.error("Error checking in:", error);
      res.status(500).json({ error: "فشل في تسجيل الحضور" });
    }
  });

  app.post("/api/attendance/check-out", isAuthenticated, async (req: any, res) => {
    try {
      const { signature } = req.body;
      const currentUser = req.currentUser;

      if (signature && signature.length > 500000) {
        return res.status(400).json({ error: "حجم التوقيع كبير جداً" });
      }
      
      const record = await storage.checkOut(currentUser?.id, signature);
      if (!record) {
        return res.status(404).json({ error: "لم يتم تسجيل الحضور اليوم" });
      }
      res.json(record);
    } catch (error) {
      console.error("Error checking out:", error);
      res.status(500).json({ error: "فشل في تسجيل الانصراف" });
    }
  });

  // Get scheduled employees for attendance (branch manager tool)
  app.get("/api/scheduled-employees-for-attendance", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId, shiftType, date } = req.query;
      
      if (!branchId || !shiftType || !date) {
        return res.status(400).json({ error: "الفرع والوردية والتاريخ مطلوبين" });
      }

      // Get employees scheduled for this branch, shift, and date
      const scheduledEmployees = await storage.getScheduledEmployeesForAttendance(branchId, shiftType, date);
      res.json(scheduledEmployees);
    } catch (error) {
      console.error("Error fetching scheduled employees:", error);
      res.status(500).json({ error: "فشل في جلب الموظفين المجدولين" });
    }
  });

  // Check-in employee by manager
  app.post("/api/attendance/check-in-employee", isAuthenticated, async (req: any, res) => {
    try {
      const { employeeId, branchId, signature, scheduleId, scheduledStartTime, scheduledEndTime, employeeName } = req.body;
      
      if (!employeeId || !branchId) {
        return res.status(400).json({ error: "معرف الموظف والفرع مطلوبين" });
      }

      if (signature && signature.length > 500000) {
        return res.status(400).json({ error: "حجم التوقيع كبير جداً" });
      }

      const today = new Date().toISOString().split('T')[0];
      const existingRecord = await storage.getAttendanceByEmployeeAndDate(employeeId, today);
      if (existingRecord && existingRecord.actualCheckIn) {
        return res.status(400).json({ error: "تم تسجيل حضور هذا الموظف مسبقاً اليوم" });
      }
      
      const record = await storage.checkInEmployee(employeeId, branchId, signature, scheduleId, scheduledStartTime, scheduledEndTime, employeeName);
      res.status(201).json(record);
    } catch (error) {
      console.error("Error checking in employee:", error);
      res.status(500).json({ error: "فشل في تسجيل الحضور" });
    }
  });

  // Check-out employee by manager
  app.post("/api/attendance/check-out-employee", isAuthenticated, async (req: any, res) => {
    try {
      const { employeeId, scheduleId, signature } = req.body;
      
      if (!employeeId) {
        return res.status(400).json({ error: "معرف الموظف مطلوب" });
      }

      if (signature && signature.length > 500000) {
        return res.status(400).json({ error: "حجم التوقيع كبير جداً" });
      }
      
      const record = await storage.checkOutEmployee(employeeId, signature, scheduleId);
      if (!record) {
        return res.status(404).json({ error: "لم يتم تسجيل حضور هذا الموظف اليوم" });
      }
      res.json(record);
    } catch (error) {
      console.error("Error checking out employee:", error);
      res.status(500).json({ error: "فشل في تسجيل الانصراف" });
    }
  });

  app.post("/api/attendance/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      const currentUser = req.currentUser;
      const record = await storage.approveAttendance(id, currentUser?.id);
      if (!record) return res.status(404).json({ error: "السجل غير موجود" });
      res.json(record);
    } catch (error) {
      console.error("Error approving attendance:", error);
      res.status(500).json({ error: "فشل في اعتماد السجل" });
    }
  });

  app.get("/api/attendance/my-today", isAuthenticated, async (req: any, res) => {
    try {
      const currentUser = req.currentUser;
      const today = new Date().toISOString().split('T')[0];
      const records = await storage.getAllAttendanceRecords({
        employeeId: currentUser?.id,
        startDate: today,
        endDate: today
      });
      res.json(records[0] || null);
    } catch (error) {
      console.error("Error fetching my today attendance:", error);
      res.status(500).json({ error: "فشل في جلب سجل الحضور" });
    }
  });

  // Time Entries - التوقيعات
  app.get("/api/time-entries/:attendanceId", isAuthenticated, async (req, res) => {
    try {
      const attendanceId = parseInt(req.params.attendanceId);
      if (isNaN(attendanceId)) return res.status(400).json({ error: "معرف غير صالح" });
      const entries = await storage.getTimeEntriesByAttendance(attendanceId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching time entries:", error);
      res.status(500).json({ error: "فشل في جلب التوقيعات" });
    }
  });

  app.post("/api/time-entries", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertTimeEntrySchema.parse(req.body);
      const entry = await storage.createTimeEntry(validatedData);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating time entry:", error);
      res.status(500).json({ error: "فشل في إنشاء التوقيع" });
    }
  });

  // Attendance Summary - ملخص الحضور
  app.get("/api/attendance-summary", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId, month } = req.query;
      const filters: any = {};
      if (branchId) filters.branchId = branchId;
      if (month) filters.month = month;
      
      const summaries = await storage.getAllAttendanceSummaries(filters);
      res.json(summaries);
    } catch (error) {
      console.error("Error fetching attendance summaries:", error);
      res.status(500).json({ error: "فشل في جلب ملخصات الحضور" });
    }
  });

  app.get("/api/attendance-summary/:employeeId/:month", isAuthenticated, async (req, res) => {
    try {
      const { employeeId, month } = req.params;
      const summary = await storage.getAttendanceSummary(employeeId, month);
      if (!summary) {
        return res.status(404).json({ error: "الملخص غير موجود" });
      }
      res.json(summary);
    } catch (error) {
      console.error("Error fetching attendance summary:", error);
      res.status(500).json({ error: "فشل في جلب الملخص" });
    }
  });

  app.post("/api/attendance-summary/calculate/:employeeId/:month", isAuthenticated, async (req, res) => {
    try {
      const { employeeId, month } = req.params;
      const summary = await storage.calculateAndUpdateMonthlySummary(employeeId, month);
      res.json(summary);
    } catch (error) {
      console.error("Error calculating attendance summary:", error);
      res.status(500).json({ error: "فشل في حساب الملخص" });
    }
  });

  // Attendance Statistics
  app.get("/api/attendance/stats/today", isAuthenticated, async (req: any, res) => {
    try {
      const { branchId } = req.query;
      const today = new Date().toISOString().split('T')[0];
      
      const records = await storage.getAllAttendanceRecords({ 
        branchId: branchId as string, 
        startDate: today, 
        endDate: today 
      });
      
      const present = records.filter(r => r.status === 'present').length;
      const late = records.filter(r => r.status === 'late').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const earlyLeave = records.filter(r => r.status === 'early_leave').length;
      const onLeave = records.filter(r => r.status === 'on_leave').length;
      
      res.json({
        date: today,
        total: records.length,
        present,
        late,
        absent,
        earlyLeave,
        onLeave,
        attendanceRate: records.length > 0 ? Math.round((present / records.length) * 100) : 0
      });
    } catch (error) {
      console.error("Error fetching today's attendance stats:", error);
      res.status(500).json({ error: "فشل في جلب إحصائيات اليوم" });
    }
  });

  // ==================== Attendance Dashboard Stats - إحصائيات لوحة الحضور ====================
  
  app.get("/api/attendance-dashboard-stats", isAuthenticated, async (req: any, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get total branch employees (active only)
      const branchEmployees = await storage.getAllBranchEmployees();
      const activeEmployees = branchEmployees.filter(e => e.status === 'active');
      const totalEmployees = activeEmployees.length;
      
      // Get today's attendance
      const todayRecords = await storage.getAllAttendanceRecords({ startDate: today, endDate: today });
      const presentToday = todayRecords.filter(r => r.status === 'present' || r.status === 'late').length;
      const lateToday = todayRecords.filter(r => r.status === 'late').length;
      
      // Calculate absent as total employees minus those who checked in
      const absentToday = Math.max(0, totalEmployees - presentToday);
      
      // Get templates count
      const templates = await storage.getScheduleTemplates();
      const templatesCount = templates.length;
      
      // Get periods count
      const periods = await storage.getSchedulePeriods({});
      const periodsCount = periods.length;
      
      // Get schedules count (this month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      
      const schedules = await storage.getEmployeeSchedules({
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: endOfMonth.toISOString().split('T')[0]
      });
      const schedulesCount = schedules.length;
      
      // Get reports count
      const reports = await storage.getTimesheetReports({});
      const reportsCount = reports.length;
      
      // Calculate attendance rate based on total employees
      const attendanceRate = totalEmployees > 0 
        ? Math.round((presentToday / totalEmployees) * 100) 
        : 0;
      
      res.json({
        todayAttendance: todayRecords.length,
        presentToday,
        lateToday,
        absentToday,
        templatesCount,
        periodsCount,
        schedulesCount,
        reportsCount,
        totalEmployees,
        attendanceRate
      });
    } catch (error) {
      console.error("Error fetching attendance dashboard stats:", error);
      res.status(500).json({ error: "فشل في جلب إحصائيات لوحة الحضور" });
    }
  });

  // ==================== Timesheet Reports - تقارير التايم شيت ====================
  
  // Get all timesheet reports with filters
  app.get("/api/timesheet-reports", isAuthenticated, async (req: any, res) => {
    try {
      const { employeeId, branchId, status } = req.query;
      const filters: { employeeId?: string; branchId?: string; status?: string } = {};
      if (employeeId) filters.employeeId = employeeId as string;
      if (branchId) filters.branchId = branchId as string;
      if (status) filters.status = status as string;
      
      const reports = await storage.getTimesheetReports(filters);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching timesheet reports:", error);
      res.status(500).json({ error: "فشل في جلب تقارير التايم شيت" });
    }
  });

  // Get single timesheet report by ID
  app.get("/api/timesheet-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const report = await storage.getTimesheetReport(id);
      if (!report) return res.status(404).json({ error: "التقرير غير موجود" });
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching timesheet report:", error);
      res.status(500).json({ error: "فشل في جلب التقرير" });
    }
  });

  // Get timesheet report entries
  app.get("/api/timesheet-reports/:id/entries", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const entries = await storage.getTimesheetReportEntries(id);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching timesheet entries:", error);
      res.status(500).json({ error: "فشل في جلب سجلات التقرير" });
    }
  });

  // Generate timesheet report for an employee
  app.post("/api/timesheet-reports/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { employeeId, branchId, startDate, endDate } = req.body;
      
      if (!employeeId || !branchId || !startDate || !endDate) {
        return res.status(400).json({ error: "جميع الحقول مطلوبة: employeeId, branchId, startDate, endDate" });
      }

      // Check if report already exists
      const existing = await storage.getTimesheetReportByEmployeeAndDates(employeeId, startDate, endDate);
      if (existing) {
        return res.status(400).json({ error: "يوجد تقرير مسبق لهذه الفترة", existingReportId: existing.id });
      }

      // Get employee info - handle both regular users and branch employees
      let employeeName = "";
      if (employeeId.startsWith("branch_emp_")) {
        const branchEmployeeId = parseInt(employeeId.replace("branch_emp_", ""));
        const branchEmployee = await storage.getBranchEmployee(branchEmployeeId);
        if (!branchEmployee) {
          return res.status(404).json({ error: "موظف الفرع غير موجود" });
        }
        employeeName = branchEmployee.employeeName;
      } else {
        const user = await storage.getUser(employeeId);
        if (!user) {
          return res.status(404).json({ error: "الموظف غير موجود" });
        }
        employeeName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
      }

      // Get schedules and attendance for the date range
      const schedules = await storage.getEmployeeSchedulesByBranchAndDateRange(branchId, startDate, endDate);
      const employeeSchedules = schedules.filter(s => s.employeeId === employeeId);
      
      const attendance = await storage.getAllAttendanceRecords({
        employeeId,
        branchId,
        startDate,
        endDate
      });

      // Calculate totals
      let totalScheduledDays = 0;
      let totalPresentDays = 0;
      let totalAbsentDays = 0;
      let totalLateDays = 0;
      let totalScheduledHours = 0;
      let totalActualHours = 0;
      let totalOvertimeMinutes = 0;
      let totalLateMinutes = 0;

      // Create report first
      const report = await storage.createTimesheetReport({
        employeeId,
        branchId,
        startDate,
        endDate,
        generatedBy: req.currentUser?.id,
        status: "pending_employee_signature",
        totalScheduledDays: 0,
        totalPresentDays: 0,
        totalAbsentDays: 0,
        totalLateDays: 0,
        totalScheduledHours: 0,
        totalActualHours: 0,
        totalOvertimeMinutes: 0,
        totalLateMinutes: 0,
      });

      // Generate daily entries
      const entries: any[] = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayOfWeek = dayNames[d.getDay()];
        
        const schedule = employeeSchedules.find(s => s.scheduleDate === dateStr);
        const attendanceRecord = attendance.find(a => a.attendanceDate === dateStr);
        
        const isOff = schedule?.isOff || dayOfWeek === 'fri';
        const scheduledStartTime = schedule?.startTime || "08:00"; // Default start time
        const scheduledEndTime = schedule?.endTime || "16:00"; // Default end time
        const actualStartTime = attendanceRecord?.actualCheckIn || null;
        const actualEndTime = attendanceRecord?.actualCheckOut || null;
        
        // Calculate hours (default 8 hours work day)
        let scheduledHours = 8;
        if (schedule?.startTime && schedule?.endTime && !isOff) {
          const startParts = schedule.startTime.split(':').map(Number);
          const endParts = schedule.endTime.split(':').map(Number);
          scheduledHours = (endParts[0] + endParts[1]/60) - (startParts[0] + startParts[1]/60);
        }
        
        let actualHours = attendanceRecord?.workingHours || 0;
        let overtimeMinutes = attendanceRecord?.overtimeMinutes || 0;
        let lateMinutes = attendanceRecord?.lateMinutes || 0;
        
        // Determine status
        let status = "pending";
        if (isOff) {
          status = "day_off";
        } else if (attendanceRecord) {
          if (attendanceRecord.status === "present") status = "present";
          else if (attendanceRecord.status === "late") status = "late";
          else if (attendanceRecord.status === "absent") status = "absent";
          else status = attendanceRecord.status || "pending";
        } else if (!isOff) {
          // Count as work day without attendance record
          status = "absent";
        }

        // Update totals - count all non-off days as scheduled work days
        if (!isOff) {
          totalScheduledDays++;
          totalScheduledHours += scheduledHours;
          
          if (status === "present" || status === "late") {
            totalPresentDays++;
            totalActualHours += actualHours;
            totalOvertimeMinutes += overtimeMinutes;
          }
          if (status === "late") {
            totalLateDays++;
            totalLateMinutes += lateMinutes;
          }
          if (status === "absent") {
            totalAbsentDays++;
          }
        }

        entries.push({
          reportId: report.id,
          date: dateStr,
          dayOfWeek,
          scheduledStartTime,
          scheduledEndTime,
          actualStartTime,
          actualEndTime,
          isOff,
          status,
          scheduledHours,
          actualHours,
          overtimeMinutes,
          lateMinutes,
          checkInSignature: attendanceRecord?.checkInSignature || null,
          checkOutSignature: attendanceRecord?.checkOutSignature || null,
        });
      }

      // Save entries
      await storage.createBulkTimesheetReportEntries(entries);

      // Update report with totals
      const updatedReport = await storage.updateTimesheetReport(report.id, {
        totalScheduledDays,
        totalPresentDays,
        totalAbsentDays,
        totalLateDays,
        totalScheduledHours: Math.round(totalScheduledHours * 100) / 100,
        totalActualHours: Math.round(totalActualHours * 100) / 100,
        totalOvertimeMinutes,
        totalLateMinutes,
      });

      res.status(201).json({ report: updatedReport, entriesCount: entries.length });
    } catch (error) {
      console.error("Error generating timesheet report:", error);
      res.status(500).json({ error: "فشل في إنشاء التقرير" });
    }
  });

  // Sign timesheet report (employee or manager)
  app.post("/api/timesheet-reports/:id/sign", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const { signatureType, signature, acknowledgment } = req.body;
      
      if (!signatureType || !signature) {
        return res.status(400).json({ error: "نوع التوقيع والتوقيع مطلوبان" });
      }
      
      if (signatureType !== 'employee' && signatureType !== 'manager') {
        return res.status(400).json({ error: "نوع التوقيع غير صالح" });
      }
      
      const signerId = req.currentUser?.id;
      if (!signerId) {
        return res.status(401).json({ error: "المستخدم غير موجود" });
      }

      // Validate signature size (max 500KB base64)
      if (signature.length > 500000) {
        return res.status(400).json({ error: "حجم التوقيع كبير جداً" });
      }
      
      const report = await storage.signTimesheetReport(id, signatureType, signature, signerId, acknowledgment);
      if (!report) {
        return res.status(404).json({ error: "التقرير غير موجود" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error signing timesheet report:", error);
      res.status(500).json({ error: "فشل في توقيع التقرير" });
    }
  });

  // Delete timesheet report
  app.delete("/api/timesheet-reports/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const report = await storage.getTimesheetReport(id);
      if (!report) {
        return res.status(404).json({ error: "التقرير غير موجود" });
      }
      
      if (report.status === 'finalized') {
        return res.status(400).json({ error: "لا يمكن حذف تقرير مكتمل" });
      }
      
      await storage.deleteTimesheetReport(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting timesheet report:", error);
      res.status(500).json({ error: "فشل في حذف التقرير" });
    }
  });

  // =====================================================
  // Branch Employees API - موظفي الفروع
  // =====================================================
  
  // Get all branch employees or filter by branch
  app.get("/api/branch-employees", isAuthenticated, async (req, res) => {
    try {
      const { branchId } = req.query;
      let employees;
      if (branchId && typeof branchId === 'string') {
        employees = await storage.getBranchEmployeesByBranch(branchId);
      } else {
        employees = await storage.getAllBranchEmployees();
      }
      // Debug: log employees without employee numbers
      const missingNumbers = employees.filter(e => !e.employeeNumber);
      if (missingNumbers.length > 0) {
        console.log("DEBUG: Employees missing employeeNumber:", missingNumbers.map(e => ({ id: e.id, name: e.employeeName, empNum: e.employeeNumber })));
      }
      res.json(employees);
    } catch (error) {
      console.error("Error fetching branch employees:", error);
      res.status(500).json({ error: "فشل في جلب بيانات الموظفين" });
    }
  });

  // Get branch employees statistics
  app.get("/api/branch-employees/stats", isAuthenticated, async (req, res) => {
    try {
      const { branchId } = req.query;
      const stats = await storage.getBranchEmployeeStats(branchId as string | undefined);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching branch employee stats:", error);
      res.status(500).json({ error: "فشل في جلب إحصائيات الموظفين" });
    }
  });

  // Get single branch employee
  app.get("/api/branch-employees/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const employee = await storage.getBranchEmployee(id);
      if (!employee) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Error fetching branch employee:", error);
      res.status(500).json({ error: "فشل في جلب بيانات الموظف" });
    }
  });

  // Create branch employee
  app.post("/api/branch-employees", isAuthenticated, async (req, res) => {
    try {
      const { insertBranchEmployeeSchema } = await import("@shared/schema");
      const parsed = insertBranchEmployeeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "بيانات الموظف غير صحيحة", details: parsed.error.errors });
      }
      const employee = await storage.createBranchEmployee(parsed.data);
      res.status(201).json(employee);
    } catch (error) {
      console.error("Error creating branch employee:", error);
      res.status(500).json({ error: "فشل في إضافة الموظف" });
    }
  });

  // Update branch employee
  app.put("/api/branch-employees/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const { insertBranchEmployeeSchema } = await import("@shared/schema");
      const parsed = insertBranchEmployeeSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "بيانات الموظف غير صحيحة", details: parsed.error.errors });
      }
      
      const employee = await storage.updateBranchEmployee(id, parsed.data);
      if (!employee) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Error updating branch employee:", error);
      res.status(500).json({ error: "فشل في تحديث بيانات الموظف" });
    }
  });

  // Delete branch employee - مدير النظام فقط
  app.delete("/api/branch-employees/:id", isAuthenticated, async (req: any, res) => {
    try {
      // التحقق من صلاحية مدير النظام فقط
      const userRole = req.currentUser?.role || req.user?.role;
      if (userRole !== "admin") {
        return res.status(403).json({ error: "غير مصرح - يمكن لمدير النظام فقط حذف الموظفين" });
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const success = await storage.deleteBranchEmployee(id);
      if (!success) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting branch employee:", error);
      res.status(500).json({ error: "فشل في حذف الموظف" });
    }
  });

  // Link branch employee to user account
  app.put("/api/branch-employees/:id/link-user", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "معرف المستخدم مطلوب" });
      
      const employee = await storage.linkBranchEmployeeToUser(id, userId);
      if (!employee) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Error linking branch employee to user:", error);
      res.status(500).json({ error: "فشل في ربط الموظف بالمستخدم" });
    }
  });

  // Get attendance records for branch employee
  app.get("/api/branch-employees/:id/attendance", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const attendance = await storage.getAttendanceByBranchEmployeeId(id);
      res.json(attendance);
    } catch (error) {
      console.error("Error getting branch employee attendance:", error);
      res.status(500).json({ error: "فشل في جلب سجلات الحضور" });
    }
  });

  // Get timesheet reports for branch employee
  app.get("/api/branch-employees/:id/timesheets", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const timesheets = await storage.getTimesheetsByBranchEmployeeId(id);
      res.json(timesheets);
    } catch (error) {
      console.error("Error getting branch employee timesheets:", error);
      res.status(500).json({ error: "فشل في جلب تقارير الدوام" });
    }
  });

  // Get schedules for branch employee
  app.get("/api/branch-employees/:id/schedules", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const schedules = await storage.getSchedulesByBranchEmployeeId(id);
      res.json(schedules);
    } catch (error) {
      console.error("Error getting branch employee schedules:", error);
      res.status(500).json({ error: "فشل في جلب جداول الدوام" });
    }
  });

  // Get branch employee by linked user ID
  app.get("/api/branch-employees/by-user/:userId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.params.userId;
      const employee = await storage.getBranchEmployeeByLinkedUserId(userId);
      if (!employee) {
        return res.status(404).json({ error: "لا يوجد موظف فرع مرتبط بهذا المستخدم" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Error getting branch employee by user:", error);
      res.status(500).json({ error: "فشل في جلب بيانات الموظف" });
    }
  });

  // ==================== Org Job Roles - الهيكل الوظيفي ====================
  
  app.get("/api/org-job-roles", isAuthenticated, async (req, res) => {
    try {
      const roles = await storage.getAllOrgJobRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error getting org job roles:", error);
      res.status(500).json({ error: "فشل في جلب الهيكل الوظيفي" });
    }
  });

  app.get("/api/org-job-roles/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const role = await storage.getOrgJobRole(id);
      if (!role) {
        return res.status(404).json({ error: "الوظيفة غير موجودة" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error getting org job role:", error);
      res.status(500).json({ error: "فشل في جلب بيانات الوظيفة" });
    }
  });

  app.post("/api/org-job-roles", isAuthenticated, async (req, res) => {
    try {
      const role = await storage.createOrgJobRole(req.body);
      res.status(201).json(role);
    } catch (error) {
      console.error("Error creating org job role:", error);
      res.status(500).json({ error: "فشل في إنشاء الوظيفة" });
    }
  });

  app.put("/api/org-job-roles/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const role = await storage.updateOrgJobRole(id, req.body);
      if (!role) {
        return res.status(404).json({ error: "الوظيفة غير موجودة" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error updating org job role:", error);
      res.status(500).json({ error: "فشل في تحديث الوظيفة" });
    }
  });

  app.delete("/api/org-job-roles/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const deleted = await storage.deleteOrgJobRole(id);
      if (!deleted) {
        return res.status(404).json({ error: "الوظيفة غير موجودة" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting org job role:", error);
      res.status(500).json({ error: "فشل في حذف الوظيفة" });
    }
  });

  // ==================== Employee Settings - إعدادات بيانات الموظفين ====================
  
  // Get all employee settings
  app.get("/api/employee-settings", isAuthenticated, async (req, res) => {
    try {
      const { category } = req.query;
      if (category && typeof category === 'string') {
        const settings = await storage.getEmployeeSettingsByCategory(category);
        return res.json(settings);
      }
      const settings = await storage.getAllEmployeeSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error getting employee settings:", error);
      res.status(500).json({ error: "فشل في جلب إعدادات الموظفين" });
    }
  });

  // Get single employee setting
  app.get("/api/employee-settings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const setting = await storage.getEmployeeSetting(id);
      if (!setting) {
        return res.status(404).json({ error: "الإعداد غير موجود" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error getting employee setting:", error);
      res.status(500).json({ error: "فشل في جلب الإعداد" });
    }
  });

  // Create employee setting
  app.post("/api/employee-settings", isAuthenticated, async (req, res) => {
    try {
      const setting = await storage.createEmployeeSetting(req.body);
      res.status(201).json(setting);
    } catch (error) {
      console.error("Error creating employee setting:", error);
      res.status(500).json({ error: "فشل في إنشاء الإعداد" });
    }
  });

  // Update employee setting
  app.put("/api/employee-settings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const setting = await storage.updateEmployeeSetting(id, req.body);
      if (!setting) {
        return res.status(404).json({ error: "الإعداد غير موجود" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error updating employee setting:", error);
      res.status(500).json({ error: "فشل في تحديث الإعداد" });
    }
  });

  // Delete employee setting (soft delete)
  app.delete("/api/employee-settings/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const deleted = await storage.deleteEmployeeSetting(id);
      if (!deleted) {
        return res.status(404).json({ error: "الإعداد غير موجود" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting employee setting:", error);
      res.status(500).json({ error: "فشل في حذف الإعداد" });
    }
  });

  // ==================== EMPLOYEE TRANSFERS API ====================

  // Get all transfer requests - requires hr_management view permission
  app.get("/api/employee-transfers", isAuthenticated, requirePermission("hr_management", "view"), async (req, res) => {
    try {
      const { status, branchId, employeeId } = req.query;
      const filters: any = {};
      if (status) filters.status = status as string;
      if (branchId) filters.branchId = branchId as string;
      if (employeeId) filters.employeeId = parseInt(employeeId as string);
      
      const transfers = await storage.getAllTransferRequests(filters);
      res.json(transfers);
    } catch (error) {
      console.error("Error getting transfer requests:", error);
      res.status(500).json({ error: "فشل في جلب طلبات النقل" });
    }
  });

  // Get single transfer request
  app.get("/api/employee-transfers/:id", isAuthenticated, requirePermission("hr_management", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const transfer = await storage.getTransferRequest(id);
      if (!transfer) {
        return res.status(404).json({ error: "طلب النقل غير موجود" });
      }
      res.json(transfer);
    } catch (error) {
      console.error("Error getting transfer request:", error);
      res.status(500).json({ error: "فشل في جلب طلب النقل" });
    }
  });

  // Create transfer request - requires hr_management create permission
  app.post("/api/employee-transfers", isAuthenticated, requirePermission("hr_management", "create"), async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) return res.status(401).json({ error: "غير مصرح" });
      
      // Validate required fields
      const { employeeId, sourceBranchId, destinationBranchId, effectiveDate, reason } = req.body;
      if (!employeeId || !sourceBranchId || !destinationBranchId || !effectiveDate || !reason) {
        return res.status(400).json({ error: "جميع الحقول المطلوبة يجب أن تكون موجودة" });
      }
      
      // Validate source and destination are different
      if (sourceBranchId === destinationBranchId) {
        return res.status(400).json({ error: "الفرع المصدر والوجهة يجب أن يكونا مختلفين" });
      }
      
      const transferData = {
        employeeId,
        sourceBranchId,
        destinationBranchId,
        effectiveDate,
        reason,
        notes: req.body.notes || null,
        requestedBy: userId,
        status: "pending",
        currentApproverRole: "source_manager"
      };
      
      const transfer = await storage.createTransferRequest(transferData);
      
      // Create approval steps
      await storage.createTransferApprovalStep({
        transferId: transfer.id,
        stepOrder: 1,
        approverRole: "source_manager",
        status: "pending"
      });
      await storage.createTransferApprovalStep({
        transferId: transfer.id,
        stepOrder: 2,
        approverRole: "destination_manager",
        status: "pending"
      });
      await storage.createTransferApprovalStep({
        transferId: transfer.id,
        stepOrder: 3,
        approverRole: "hr_admin",
        status: "pending"
      });
      
      // Log history
      await storage.createTransferHistoryEntry({
        transferId: transfer.id,
        eventType: "created",
        performedBy: userId,
        details: { message: "تم إنشاء طلب النقل" }
      });
      
      res.status(201).json(transfer);
    } catch (error) {
      console.error("Error creating transfer request:", error);
      res.status(500).json({ error: "فشل في إنشاء طلب النقل" });
    }
  });

  // Update transfer request - requires hr_management edit permission
  app.put("/api/employee-transfers/:id", isAuthenticated, requirePermission("hr_management", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const transfer = await storage.updateTransferRequest(id, req.body);
      if (!transfer) {
        return res.status(404).json({ error: "طلب النقل غير موجود" });
      }
      res.json(transfer);
    } catch (error) {
      console.error("Error updating transfer request:", error);
      res.status(500).json({ error: "فشل في تحديث طلب النقل" });
    }
  });

  // Approve transfer request - requires hr_management edit permission
  app.post("/api/employee-transfers/:id/approve", isAuthenticated, requirePermission("hr_management", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const userId = (req as any).user?.id;
      const { approverRole, notes } = req.body;
      
      const transfer = await storage.getTransferRequest(id);
      if (!transfer) {
        return res.status(404).json({ error: "طلب النقل غير موجود" });
      }
      
      // Update approval step
      const steps = await storage.getTransferApprovalSteps(id);
      const currentStep = steps.find(s => s.approverRole === approverRole && s.status === "pending");
      if (currentStep) {
        await storage.updateTransferApprovalStep(currentStep.id, {
          status: "approved",
          approverId: userId,
          notes
        });
      }
      
      // Determine next status
      let newStatus = transfer.status;
      let nextApprover: string | null = transfer.currentApproverRole;
      
      if (approverRole === "source_manager") {
        newStatus = "source_approved";
        nextApprover = "destination_manager";
      } else if (approverRole === "destination_manager") {
        newStatus = "dest_approved";
        nextApprover = "hr_admin";
      } else if (approverRole === "hr_admin") {
        newStatus = "hr_approved";
        nextApprover = null;
      }
      
      const updated = await storage.updateTransferRequest(id, {
        status: newStatus,
        currentApproverRole: nextApprover
      });
      
      // Log history
      await storage.createTransferHistoryEntry({
        transferId: id,
        eventType: "approved",
        performedBy: userId,
        details: { approverRole, notes, newStatus }
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error approving transfer request:", error);
      res.status(500).json({ error: "فشل في الموافقة على طلب النقل" });
    }
  });

  // Reject transfer request - requires hr_management edit permission
  app.post("/api/employee-transfers/:id/reject", isAuthenticated, requirePermission("hr_management", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const userId = (req as any).user?.id;
      const { approverRole, rejectionReason } = req.body;
      
      const transfer = await storage.getTransferRequest(id);
      if (!transfer) {
        return res.status(404).json({ error: "طلب النقل غير موجود" });
      }
      
      // Update approval step
      const steps = await storage.getTransferApprovalSteps(id);
      const currentStep = steps.find(s => s.approverRole === approverRole && s.status === "pending");
      if (currentStep) {
        await storage.updateTransferApprovalStep(currentStep.id, {
          status: "rejected",
          approverId: userId,
          notes: rejectionReason
        });
      }
      
      const updated = await storage.updateTransferRequest(id, {
        status: "rejected",
        rejectionReason
      });
      
      // Log history
      await storage.createTransferHistoryEntry({
        transferId: id,
        eventType: "rejected",
        performedBy: userId,
        details: { approverRole, rejectionReason }
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting transfer request:", error);
      res.status(500).json({ error: "فشل في رفض طلب النقل" });
    }
  });

  // Complete transfer (execute the transfer) - requires hr_management edit permission
  app.post("/api/employee-transfers/:id/complete", isAuthenticated, requirePermission("hr_management", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const userId = (req as any).user?.id;
      
      const transfer = await storage.getTransferRequest(id);
      if (!transfer) {
        return res.status(404).json({ error: "طلب النقل غير موجود" });
      }
      
      if (transfer.status !== "hr_approved") {
        return res.status(400).json({ error: "طلب النقل غير معتمد بالكامل" });
      }
      
      // Update employee's branch
      await storage.updateBranchEmployee(transfer.employeeId, {
        branchId: transfer.destinationBranchId
      });
      
      // Mark transfer as completed
      const updated = await storage.updateTransferRequest(id, {
        status: "completed"
      });
      
      // Log history
      await storage.createTransferHistoryEntry({
        transferId: id,
        eventType: "completed",
        performedBy: userId,
        details: { 
          message: "تم تنفيذ النقل",
          fromBranch: transfer.sourceBranchId,
          toBranch: transfer.destinationBranchId
        }
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error completing transfer:", error);
      res.status(500).json({ error: "فشل في إتمام النقل" });
    }
  });

  // Cancel transfer request - requires hr_management edit permission
  app.post("/api/employee-transfers/:id/cancel", isAuthenticated, requirePermission("hr_management", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const userId = (req as any).user?.id;
      const { reason } = req.body;
      
      const updated = await storage.updateTransferRequest(id, {
        status: "cancelled",
        rejectionReason: reason
      });
      
      if (!updated) {
        return res.status(404).json({ error: "طلب النقل غير موجود" });
      }
      
      // Log history
      await storage.createTransferHistoryEntry({
        transferId: id,
        eventType: "cancelled",
        performedBy: userId,
        details: { reason }
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling transfer:", error);
      res.status(500).json({ error: "فشل في إلغاء طلب النقل" });
    }
  });

  // Get transfer approval steps - requires hr_management view permission
  app.get("/api/employee-transfers/:id/steps", isAuthenticated, requirePermission("hr_management", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const steps = await storage.getTransferApprovalSteps(id);
      res.json(steps);
    } catch (error) {
      console.error("Error getting transfer approval steps:", error);
      res.status(500).json({ error: "فشل في جلب خطوات الموافقة" });
    }
  });

  // Get transfer history - requires hr_management view permission
  app.get("/api/employee-transfers/:id/history", isAuthenticated, requirePermission("hr_management", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const history = await storage.getTransferHistory(id);
      res.json(history);
    } catch (error) {
      console.error("Error getting transfer history:", error);
      res.status(500).json({ error: "فشل في جلب سجل النقل" });
    }
  });

  // Get transfers for employee - requires hr_management view permission
  app.get("/api/employees/:employeeId/transfers", isAuthenticated, requirePermission("hr_management", "view"), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId);
      if (isNaN(employeeId)) return res.status(400).json({ error: "معرف غير صالح" });
      
      const transfers = await storage.getTransfersByEmployee(employeeId);
      res.json(transfers);
    } catch (error) {
      console.error("Error getting employee transfers:", error);
      res.status(500).json({ error: "فشل في جلب سجل نقل الموظف" });
    }
  });

  // Get pending transfers for branch - requires hr_management view permission
  app.get("/api/branches/:branchId/pending-transfers", isAuthenticated, requirePermission("hr_management", "view"), async (req, res) => {
    try {
      const branchId = req.params.branchId;
      const transfers = await storage.getPendingTransfersForBranch(branchId);
      res.json(transfers);
    } catch (error) {
      console.error("Error getting pending transfers for branch:", error);
      res.status(500).json({ error: "فشل في جلب طلبات النقل المعلقة" });
    }
  });

  // PDF Generation endpoint for salary closing report
  app.post("/api/pdf/salary-closing", isAuthenticated, async (req, res) => {
    try {
      const data: SalaryClosingPdfData = req.body;
      
      if (!data.branchName || !data.month || !data.employees || !Array.isArray(data.employees)) {
        return res.status(400).json({ error: "بيانات غير صالحة" });
      }

      const pdfBuffer = await generateSalaryClosingPdf(data);
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=salary_closing_${data.month}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating salary closing PDF:", error);
      res.status(500).json({ error: "فشل في إنشاء ملف PDF" });
    }
  });

  // PDF Generation endpoint for branch comparison report
  app.post("/api/pdf/branch-comparison", isAuthenticated, async (req, res) => {
    try {
      const data: BranchComparisonPdfData = req.body;
      if (!data.month || !data.branches || !Array.isArray(data.branches)) {
        return res.status(400).json({ error: "بيانات غير صالحة" });
      }
      const pdfBuffer = await generateBranchComparisonPdf(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=branch_comparison_${data.month}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating branch comparison PDF:", error);
      res.status(500).json({ error: "فشل في إنشاء ملف PDF" });
    }
  });

  // PDF Generation endpoint for job comparison report
  app.post("/api/pdf/job-comparison", isAuthenticated, async (req, res) => {
    try {
      const data: JobComparisonPdfData = req.body;
      if (!data.month || !data.jobs || !Array.isArray(data.jobs)) {
        return res.status(400).json({ error: "بيانات غير صالحة" });
      }
      const pdfBuffer = await generateJobComparisonPdf(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=job_comparison_${data.month}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating job comparison PDF:", error);
      res.status(500).json({ error: "فشل في إنشاء ملف PDF" });
    }
  });

  // PDF Generation endpoint for salaries table report
  app.post("/api/pdf/salaries-table", isAuthenticated, async (req, res) => {
    try {
      const data: SalaryTablePdfData = req.body;
      if (!data.month || !data.employees || !Array.isArray(data.employees)) {
        return res.status(400).json({ error: "بيانات غير صالحة" });
      }
      const pdfBuffer = await generateSalariesTablePdf(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=salaries_table_${data.month}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating salaries table PDF:", error);
      res.status(500).json({ error: "فشل في إنشاء ملف PDF" });
    }
  });

  // PDF Generation endpoint for KPIs report
  app.post("/api/pdf/kpis", isAuthenticated, async (req, res) => {
    try {
      const data: KPIsPdfData = req.body;
      if (!data.month) {
        return res.status(400).json({ error: "بيانات غير صالحة" });
      }
      const pdfBuffer = await generateKPIsPdf(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=kpis_${data.month}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating KPIs PDF:", error);
      res.status(500).json({ error: "فشل في إنشاء ملف PDF" });
    }
  });

  // PDF Generation endpoint for health certificates report
  app.post("/api/pdf/health-certificates", isAuthenticated, async (req, res) => {
    try {
      const data: HealthCertificatePdfData = req.body;
      if (!data.month || !data.employees || !Array.isArray(data.employees)) {
        return res.status(400).json({ error: "بيانات غير صالحة" });
      }
      const pdfBuffer = await generateHealthCertificatesPdf(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=health_certificates_${data.month}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating health certificates PDF:", error);
      res.status(500).json({ error: "فشل في إنشاء ملف PDF" });
    }
  });

  // PDF Generation endpoint for comparisons report
  app.post("/api/pdf/comparisons", isAuthenticated, async (req, res) => {
    try {
      const data: ComparisonsPdfData = req.body;
      if (!data.month) {
        return res.status(400).json({ error: "بيانات غير صالحة" });
      }
      const pdfBuffer = await generateComparisonsPdf(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=comparisons_${data.month}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating comparisons PDF:", error);
      res.status(500).json({ error: "فشل في إنشاء ملف PDF" });
    }
  });

  // PDF Generation endpoint for marketing report
  app.post("/api/pdf/marketing-report", isAuthenticated, async (req, res) => {
    try {
      const data: MarketingReportPdfData = req.body;
      const pdfBuffer = await generateMarketingReportPdf(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=marketing_report_${data.date}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating marketing report PDF:", error);
      res.status(500).json({ error: "فشل في إنشاء ملف PDF" });
    }
  });

  // PDF Generation endpoint for production report
  app.post("/api/pdf/production-report", isAuthenticated, async (req, res) => {
    try {
      const data: ProductionReportPdfData = req.body;
      const pdfBuffer = await generateProductionReportPdf(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=production_report_${data.startDate}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating production report PDF:", error);
      res.status(500).json({ error: "فشل في إنشاء ملف PDF" });
    }
  });

  // PDF Generation endpoint for production order
  app.post("/api/pdf/production-order", isAuthenticated, async (req, res) => {
    try {
      const data: ProductionOrderPdfData = req.body;
      const pdfBuffer = await generateProductionOrderPdf(data);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=production_order_${data.orderNumber}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating production order PDF:", error);
      res.status(500).json({ error: "فشل في إنشاء ملف PDF" });
    }
  });

  // ==================== P&L (Profit & Loss) Dashboard Routes ====================

  // Get all financial periods with optional filters
  app.get("/api/financials/periods", isAuthenticated, async (req, res) => {
    try {
      const { branchId, year, month } = req.query;
      const filters: { branchId?: string; year?: number; month?: number } = {};
      if (branchId) filters.branchId = branchId as string;
      if (year) filters.year = parseInt(year as string);
      if (month) filters.month = parseInt(month as string);
      const periods = await storage.getAllFinancialPeriods(filters);
      res.json(periods);
    } catch (error) {
      console.error("Error fetching financial periods:", error);
      res.status(500).json({ error: "فشل في جلب الفترات المالية" });
    }
  });

  // Get a single financial period
  app.get("/api/financials/periods/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const period = await storage.getFinancialPeriod(id);
      if (!period) {
        return res.status(404).json({ error: "الفترة المالية غير موجودة" });
      }
      res.json(period);
    } catch (error) {
      console.error("Error fetching financial period:", error);
      res.status(500).json({ error: "فشل في جلب الفترة المالية" });
    }
  });

  // Get complete P&L data for a period
  app.get("/api/financials/periods/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = await storage.getCompletePnLData(id);
      if (!data.period) {
        return res.status(404).json({ error: "الفترة المالية غير موجودة" });
      }
      res.json(data);
    } catch (error) {
      console.error("Error fetching complete P&L data:", error);
      res.status(500).json({ error: "فشل في جلب بيانات الأرباح والخسائر" });
    }
  });

  // Create a new financial period
  app.post("/api/financials/periods", isAuthenticated, async (req, res) => {
    try {
      const { branchId, month, year, targetRevenue, targetGrossMargin, targetNetMargin, notes } = req.body;
      
      // Check if period already exists
      const existing = await storage.getFinancialPeriodByBranchAndDate(branchId, year, month);
      if (existing) {
        return res.status(400).json({ error: "الفترة المالية موجودة بالفعل لهذا الفرع" });
      }

      const period = await storage.createFinancialPeriod({
        branchId,
        month,
        year,
        periodType: "monthly",
        targetRevenue: targetRevenue || 0,
        targetGrossMargin: targetGrossMargin || 0,
        targetNetMargin: targetNetMargin || 0,
        notes,
        status: "draft",
        createdBy: (req as any).user?.id,
      });
      res.status(201).json(period);
    } catch (error) {
      console.error("Error creating financial period:", error);
      res.status(500).json({ error: "فشل في إنشاء الفترة المالية" });
    }
  });

  // Update a financial period
  app.put("/api/financials/periods/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const period = await storage.updateFinancialPeriod(id, req.body);
      if (!period) {
        return res.status(404).json({ error: "الفترة المالية غير موجودة" });
      }
      res.json(period);
    } catch (error) {
      console.error("Error updating financial period:", error);
      res.status(500).json({ error: "فشل في تحديث الفترة المالية" });
    }
  });

  // Delete a financial period
  app.delete("/api/financials/periods/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteFinancialPeriod(id);
      if (!deleted) {
        return res.status(404).json({ error: "الفترة المالية غير موجودة" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting financial period:", error);
      res.status(500).json({ error: "فشل في حذف الفترة المالية" });
    }
  });

  // Bulk update sales data for a period
  app.post("/api/financials/periods/:id/sales", isAuthenticated, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const { salesData } = req.body;
      
      // Delete existing sales and insert new ones
      await storage.deleteFinancialSalesByPeriod(periodId);
      const sales = await storage.bulkCreateFinancialSales(
        salesData.map((s: any) => ({ ...s, periodId }))
      );
      res.json(sales);
    } catch (error) {
      console.error("Error updating sales data:", error);
      res.status(500).json({ error: "فشل في تحديث بيانات المبيعات" });
    }
  });

  // Bulk update COGS data for a period
  app.post("/api/financials/periods/:id/cogs", isAuthenticated, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const { cogsData } = req.body;
      
      await storage.deleteFinancialCOGSByPeriod(periodId);
      const cogs = await storage.bulkCreateFinancialCOGS(
        cogsData.map((c: any) => ({ ...c, periodId }))
      );
      res.json(cogs);
    } catch (error) {
      console.error("Error updating COGS data:", error);
      res.status(500).json({ error: "فشل في تحديث بيانات التكاليف" });
    }
  });

  // Bulk update operating expenses for a period
  app.post("/api/financials/periods/:id/operating-expenses", isAuthenticated, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const { expensesData } = req.body;
      
      await storage.deleteFinancialOperatingExpensesByPeriod(periodId);
      const expenses = await storage.bulkCreateFinancialOperatingExpenses(
        expensesData.map((e: any) => ({ ...e, periodId }))
      );
      res.json(expenses);
    } catch (error) {
      console.error("Error updating operating expenses:", error);
      res.status(500).json({ error: "فشل في تحديث المصروفات التشغيلية" });
    }
  });

  // Bulk update fixed costs for a period
  app.post("/api/financials/periods/:id/fixed-costs", isAuthenticated, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const { costsData } = req.body;
      
      await storage.deleteFinancialFixedCostsByPeriod(periodId);
      const costs = await storage.bulkCreateFinancialFixedCosts(
        costsData.map((c: any) => ({ ...c, periodId }))
      );
      res.json(costs);
    } catch (error) {
      console.error("Error updating fixed costs:", error);
      res.status(500).json({ error: "فشل في تحديث التكاليف الثابتة" });
    }
  });

  // Calculate and save metrics for a period
  app.post("/api/financials/periods/:id/calculate-metrics", isAuthenticated, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const data = await storage.getCompletePnLData(periodId);
      
      if (!data.period) {
        return res.status(404).json({ error: "الفترة المالية غير موجودة" });
      }

      // Calculate totals
      const totalRevenue = data.sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const totalCOGS = data.cogs.reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalWaste = data.cogs.reduce((sum, c) => sum + (c.wasteAmount || 0), 0);
      const totalOperatingExpenses = data.operatingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalFixedCosts = data.fixedCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalInvoices = data.sales.reduce((sum, s) => sum + (s.invoiceCount || 0), 0);

      // Calculate profits and margins
      const grossProfit = totalRevenue - totalCOGS;
      const netProfit = grossProfit - totalOperatingExpenses - totalFixedCosts;
      const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // Calculate ratios
      const salaryExpense = data.operatingExpenses.find(e => e.expenseType === "salaries")?.amount || 0;
      const rentCost = data.fixedCosts.find(c => c.costType === "rent")?.amount || 0;
      const salaryToSalesPct = totalRevenue > 0 ? (salaryExpense / totalRevenue) * 100 : 0;
      const rentToRevenuePct = totalRevenue > 0 ? (rentCost / totalRevenue) * 100 : 0;
      const wastePct = totalCOGS > 0 ? (totalWaste / totalCOGS) * 100 : 0;

      // Calculate break-even (simplified: Fixed Costs / Gross Margin %)
      const breakEvenSales = grossMarginPct > 0 ? (totalFixedCosts + totalOperatingExpenses) / (grossMarginPct / 100) : 0;

      // Average invoice value
      const avgInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

      // Calculate new KPIs
      // Operating Profit = Gross Profit - Operating Expenses
      const operatingProfit = grossProfit - totalOperatingExpenses;
      const operatingMarginPct = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0;

      // EBITDA = Operating Profit + Depreciation + Amortization
      // In bakery context: EBITDA ≈ Operating Profit + Rent + Depreciation
      const depreciation = data.fixedCosts.find(c => c.costType === "depreciation")?.amount || 0;
      const ebitda = operatingProfit + rentCost + depreciation;
      const ebitdaMarginPct = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;

      // Contribution Margin = Revenue - Variable Costs (COGS is main variable cost)
      const contributionMargin = totalRevenue - totalCOGS;
      const contributionMarginPct = totalRevenue > 0 ? (contributionMargin / totalRevenue) * 100 : 0;

      // Labor Productivity - get employee count from branch employees
      let employeeCount = 0;
      try {
        const employees = await storage.getBranchEmployeesByBranch(data.period.branchId);
        employeeCount = employees.filter(e => e.status === "active").length;
      } catch (e) {
        console.log("Could not get employee count:", e);
      }
      const revenuePerEmployee = employeeCount > 0 ? totalRevenue / employeeCount : 0;
      const laborProductivity = employeeCount > 0 && salaryExpense > 0 
        ? (grossProfit / salaryExpense) * 100 
        : 0;

      // Determine rating
      let rating = "average";
      const ratingReasons: string[] = [];
      const recommendations: string[] = [];

      if (netMarginPct >= 15) {
        rating = "excellent";
        ratingReasons.push("هامش ربح صافي ممتاز (أعلى من 15%)");
      } else if (netMarginPct >= 8) {
        rating = "good";
        ratingReasons.push("هامش ربح صافي جيد (8-15%)");
      } else if (netMarginPct >= 3) {
        rating = "average";
        ratingReasons.push("هامش ربح صافي متوسط (3-8%)");
        recommendations.push("راجع تكاليف التشغيل لتحسين الربحية");
      } else {
        rating = "poor";
        ratingReasons.push("هامش ربح صافي ضعيف (أقل من 3%)");
        recommendations.push("يجب مراجعة هيكل التكاليف بشكل عاجل");
      }

      // Additional rating factors
      if (salaryToSalesPct > 35) {
        ratingReasons.push("نسبة الرواتب للمبيعات مرتفعة");
        recommendations.push("دراسة إمكانية تحسين إنتاجية الموظفين");
      }
      if (wastePct > 5) {
        ratingReasons.push("نسبة الهدر مرتفعة");
        recommendations.push("تطبيق نظام مراقبة المخزون وتقليل الهدر");
      }
      if (rentToRevenuePct > 15) {
        ratingReasons.push("نسبة الإيجار للإيرادات مرتفعة");
        recommendations.push("مراجعة جدوى موقع الفرع");
      }

      // Save metrics
      const metrics = await storage.upsertFinancialMetrics(periodId, {
        periodId,
        totalRevenue,
        totalCOGS,
        totalOperatingExpenses,
        totalFixedCosts,
        grossProfit,
        netProfit,
        grossMarginPct,
        netMarginPct,
        breakEvenSales,
        salaryToSalesPct,
        rentToRevenuePct,
        wastePct,
        invoiceCount: totalInvoices,
        avgInvoiceValue,
        ebitda,
        ebitdaMarginPct,
        contributionMargin,
        contributionMarginPct,
        laborProductivity,
        revenuePerEmployee,
        employeeCount,
        operatingProfit,
        operatingMarginPct,
        rating,
        ratingReasons,
        recommendations,
      });

      res.json(metrics);
    } catch (error) {
      console.error("Error calculating metrics:", error);
      res.status(500).json({ error: "فشل في حساب المؤشرات" });
    }
  });

  // Import all P&L data from Excel file and calculate metrics
  app.post("/api/financials/periods/:id/import-excel", isAuthenticated, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const { sales, cogs, operatingExpenses, fixedCosts } = req.body;
      
      // Verify period exists
      const period = await storage.getFinancialPeriod(periodId);
      if (!period) {
        return res.status(404).json({ error: "الفترة المالية غير موجودة" });
      }

      // Validate that at least some data was parsed
      const totalItems = (sales?.length || 0) + (cogs?.length || 0) + 
                        (operatingExpenses?.length || 0) + (fixedCosts?.length || 0);
      if (totalItems === 0) {
        return res.status(400).json({ error: "لم يتم العثور على بيانات صالحة في الملف" });
      }

      // Clear existing data
      await storage.deleteFinancialSalesByPeriod(periodId);
      await storage.deleteFinancialCOGSByPeriod(periodId);
      await storage.deleteFinancialOperatingExpensesByPeriod(periodId);
      await storage.deleteFinancialFixedCostsByPeriod(periodId);

      // Import sales
      if (sales && sales.length > 0) {
        await storage.bulkCreateFinancialSales(
          sales.map((s: any) => ({ ...s, periodId }))
        );
      }

      // Import COGS
      if (cogs && cogs.length > 0) {
        await storage.bulkCreateFinancialCOGS(
          cogs.map((c: any) => ({ ...c, periodId }))
        );
      }

      // Import Operating Expenses
      if (operatingExpenses && operatingExpenses.length > 0) {
        await storage.bulkCreateFinancialOperatingExpenses(
          operatingExpenses.map((e: any) => ({ ...e, periodId }))
        );
      }

      // Import Fixed Costs
      if (fixedCosts && fixedCosts.length > 0) {
        await storage.bulkCreateFinancialFixedCosts(
          fixedCosts.map((c: any) => ({ ...c, periodId }))
        );
      }

      // Now calculate metrics automatically
      const data = await storage.getCompletePnLData(periodId);
      
      if (!data.period) {
        return res.status(404).json({ error: "الفترة المالية غير موجودة" });
      }
      
      // Calculate totals
      const totalRevenue = data.sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const totalCOGS = data.cogs.reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalWaste = data.cogs.reduce((sum, c) => sum + (c.wasteAmount || 0), 0);
      const totalOperatingExpenses = data.operatingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const totalFixedCosts = data.fixedCosts.reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalInvoices = data.sales.reduce((sum, s) => sum + (s.invoiceCount || 0), 0);

      // Calculate profits and margins
      const grossProfit = totalRevenue - totalCOGS;
      const netProfit = grossProfit - totalOperatingExpenses - totalFixedCosts;
      const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // Calculate ratios
      const salaryExpense = data.operatingExpenses.find(e => e.expenseType === "salaries")?.amount || 0;
      const rentCost = data.fixedCosts.find(c => c.costType === "rent")?.amount || 0;
      const salaryToSalesPct = totalRevenue > 0 ? (salaryExpense / totalRevenue) * 100 : 0;
      const rentToRevenuePct = totalRevenue > 0 ? (rentCost / totalRevenue) * 100 : 0;
      const wastePct = totalCOGS > 0 ? (totalWaste / totalCOGS) * 100 : 0;

      // Calculate break-even
      const breakEvenSales = grossMarginPct > 0 ? (totalFixedCosts + totalOperatingExpenses) / (grossMarginPct / 100) : 0;
      const avgInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

      // Calculate new KPIs
      const operatingProfit = grossProfit - totalOperatingExpenses;
      const operatingMarginPct = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0;
      const depreciation = data.fixedCosts.find(c => c.costType === "depreciation")?.amount || 0;
      const ebitda = operatingProfit + rentCost + depreciation;
      const ebitdaMarginPct = totalRevenue > 0 ? (ebitda / totalRevenue) * 100 : 0;
      const contributionMargin = totalRevenue - totalCOGS;
      const contributionMarginPct = totalRevenue > 0 ? (contributionMargin / totalRevenue) * 100 : 0;

      let employeeCount = 0;
      try {
        const employees = await storage.getBranchEmployeesByBranch(data.period.branchId);
        employeeCount = employees.filter(e => e.status === "active").length;
      } catch (e) {
        console.log("Could not get employee count:", e);
      }
      const revenuePerEmployee = employeeCount > 0 ? totalRevenue / employeeCount : 0;
      const laborProductivity = employeeCount > 0 && salaryExpense > 0 
        ? (grossProfit / salaryExpense) * 100 
        : 0;

      // Determine rating
      let rating = "average";
      const ratingReasons: string[] = [];
      const recommendations: string[] = [];

      if (netMarginPct >= 15) {
        rating = "excellent";
        ratingReasons.push("هامش ربح صافي ممتاز (أعلى من 15%)");
      } else if (netMarginPct >= 8) {
        rating = "good";
        ratingReasons.push("هامش ربح صافي جيد (8-15%)");
      } else if (netMarginPct >= 3) {
        rating = "average";
        ratingReasons.push("هامش ربح صافي متوسط (3-8%)");
        recommendations.push("راجع تكاليف التشغيل لتحسين الربحية");
      } else {
        rating = "poor";
        ratingReasons.push("هامش ربح صافي ضعيف (أقل من 3%)");
        recommendations.push("يجب مراجعة هيكل التكاليف بشكل عاجل");
      }

      if (salaryToSalesPct > 35) {
        ratingReasons.push("نسبة الرواتب للمبيعات مرتفعة");
        recommendations.push("دراسة إمكانية تحسين إنتاجية الموظفين");
      }
      if (wastePct > 5) {
        ratingReasons.push("نسبة الهدر مرتفعة");
        recommendations.push("تطبيق نظام مراقبة المخزون وتقليل الهدر");
      }
      if (rentToRevenuePct > 15) {
        ratingReasons.push("نسبة الإيجار للإيرادات مرتفعة");
        recommendations.push("مراجعة جدوى موقع الفرع");
      }

      // Save metrics
      const metrics = await storage.upsertFinancialMetrics(periodId, {
        periodId,
        totalRevenue,
        totalCOGS,
        totalOperatingExpenses,
        totalFixedCosts,
        grossProfit,
        netProfit,
        grossMarginPct,
        netMarginPct,
        breakEvenSales,
        salaryToSalesPct,
        rentToRevenuePct,
        wastePct,
        invoiceCount: totalInvoices,
        avgInvoiceValue,
        ebitda,
        ebitdaMarginPct,
        contributionMargin,
        contributionMarginPct,
        laborProductivity,
        revenuePerEmployee,
        employeeCount,
        operatingProfit,
        operatingMarginPct,
        rating,
        ratingReasons,
        recommendations,
      });

      res.json({ 
        success: true, 
        metrics,
        imported: {
          sales: sales?.length || 0,
          cogs: cogs?.length || 0,
          operatingExpenses: operatingExpenses?.length || 0,
          fixedCosts: fixedCosts?.length || 0,
        }
      });
    } catch (error) {
      console.error("Error importing Excel data:", error);
      res.status(500).json({ error: "فشل في استيراد البيانات من الملف" });
    }
  });

  // Get branch ranking
  app.get("/api/financials/ranking", isAuthenticated, async (req, res) => {
    try {
      const { year, month, metric } = req.query;
      const yearNum = parseInt(year as string) || new Date().getFullYear();
      const monthNum = parseInt(month as string) || new Date().getMonth() + 1;
      const metricType = (metric as 'profit' | 'revenue' | 'margin') || 'profit';
      
      const ranking = await storage.getBranchRanking(yearNum, monthNum, metricType);
      
      // Enrich with branch names
      const branches = await storage.getAllBranches();
      const branchMap = new Map(branches.map(b => [b.id, b.name]));
      
      const enrichedRanking = ranking.map((r, index) => ({
        ...r,
        branchName: branchMap.get(r.branchId) || r.branchId,
        rank: index + 1,
      }));
      
      res.json(enrichedRanking);
    } catch (error) {
      console.error("Error fetching branch ranking:", error);
      res.status(500).json({ error: "فشل في جلب ترتيب الفروع" });
    }
  });

  // Get or create period for branch/date combination
  app.post("/api/financials/periods/get-or-create", isAuthenticated, async (req, res) => {
    try {
      const { branchId, year, month } = req.body;
      
      let period = await storage.getFinancialPeriodByBranchAndDate(branchId, year, month);
      
      if (!period) {
        period = await storage.createFinancialPeriod({
          branchId,
          month,
          year,
          periodType: "monthly",
          targetRevenue: 0,
          targetGrossMargin: 0,
          targetNetMargin: 0,
          status: "draft",
          createdBy: (req as any).user?.id,
        });
      }
      
      res.json(period);
    } catch (error) {
      console.error("Error getting or creating period:", error);
      res.status(500).json({ error: "فشل في جلب أو إنشاء الفترة المالية" });
    }
  });

  // Auto-import sales data from cashier journals for a period
  app.post("/api/financials/periods/:id/import-sales", isAuthenticated, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const period = await storage.getFinancialPeriod(periodId);
      
      if (!period) {
        return res.status(404).json({ error: "الفترة المالية غير موجودة" });
      }

      // Get all cashier journals for this branch and month
      const startDate = `${period.year}-${String(period.month).padStart(2, '0')}-01`;
      const endDate = `${period.year}-${String(period.month).padStart(2, '0')}-31`;
      
      const journals = await storage.getCashierSalesJournals({
        branchId: period.branchId,
        startDate,
        endDate,
        status: "approved",
      });

      // Aggregate sales by channel
      let totalCash = 0;
      let totalCard = 0;
      let totalDelivery = 0;
      let totalInvoices = 0;

      for (const journal of journals) {
        totalCash += journal.cashTotal || 0;
        totalCard += journal.networkTotal || 0;
        totalDelivery += journal.deliveryTotal || 0;
        totalInvoices += journal.transactionCount || 0;
      }

      // Create sales entries
      const salesData = [
        { periodId, channel: "cash", totalAmount: totalCash, invoiceCount: Math.round(totalInvoices * 0.4), notes: "مستورد من سجل المبيعات" },
        { periodId, channel: "card", totalAmount: totalCard, invoiceCount: Math.round(totalInvoices * 0.35), notes: "مستورد من سجل المبيعات" },
        { periodId, channel: "delivery_apps", totalAmount: totalDelivery, invoiceCount: Math.round(totalInvoices * 0.25), notes: "مستورد من سجل المبيعات" },
      ].filter(s => s.totalAmount > 0);

      // Delete existing and insert new
      await storage.deleteFinancialSalesByPeriod(periodId);
      const sales = await storage.bulkCreateFinancialSales(salesData);

      res.json({
        success: true,
        imported: {
          journalsCount: journals.length,
          totalRevenue: totalCash + totalCard + totalDelivery,
          salesEntries: sales.length,
        },
        sales,
      });
    } catch (error) {
      console.error("Error importing sales data:", error);
      res.status(500).json({ error: "فشل في استيراد بيانات المبيعات" });
    }
  });

  // Get aggregated cashier data for a period (preview before import)
  app.get("/api/financials/periods/:id/cashier-summary", isAuthenticated, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const period = await storage.getFinancialPeriod(periodId);
      
      if (!period) {
        return res.status(404).json({ error: "الفترة المالية غير موجودة" });
      }

      const startDate = `${period.year}-${String(period.month).padStart(2, '0')}-01`;
      const endDate = `${period.year}-${String(period.month).padStart(2, '0')}-31`;
      
      const journals = await storage.getCashierSalesJournals({
        branchId: period.branchId,
        startDate,
        endDate,
      });

      // Daily breakdown
      const dailyData: Record<string, { cash: number; card: number; delivery: number; total: number; invoices: number }> = {};
      
      for (const journal of journals) {
        const date = journal.journalDate;
        if (!dailyData[date]) {
          dailyData[date] = { cash: 0, card: 0, delivery: 0, total: 0, invoices: 0 };
        }
        dailyData[date].cash += journal.cashTotal || 0;
        dailyData[date].card += journal.networkTotal || 0;
        dailyData[date].delivery += journal.deliveryTotal || 0;
        dailyData[date].total += journal.totalSales || 0;
        dailyData[date].invoices += journal.transactionCount || 0;
      }

      // Summary
      const summary = {
        totalCash: journals.reduce((sum, j) => sum + (j.cashTotal || 0), 0),
        totalCard: journals.reduce((sum, j) => sum + (j.networkTotal || 0), 0),
        totalDelivery: journals.reduce((sum, j) => sum + (j.deliveryTotal || 0), 0),
        totalSales: journals.reduce((sum, j) => sum + (j.totalSales || 0), 0),
        totalInvoices: journals.reduce((sum, j) => sum + (j.transactionCount || 0), 0),
        journalsCount: journals.length,
        daysWithData: Object.keys(dailyData).length,
      };

      res.json({
        summary,
        dailyBreakdown: Object.entries(dailyData)
          .map(([date, data]) => ({ date, ...data }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      });
    } catch (error) {
      console.error("Error fetching cashier summary:", error);
      res.status(500).json({ error: "فشل في جلب ملخص المبيعات" });
    }
  });

  // Get salary data from branch employees for a period
  app.get("/api/financials/periods/:id/salary-summary", isAuthenticated, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const period = await storage.getFinancialPeriod(periodId);
      
      if (!period) {
        return res.status(404).json({ error: "الفترة المالية غير موجودة" });
      }

      const employees = await storage.getBranchEmployeesByBranch(period.branchId);
      
      const totalBaseSalary = employees.reduce((sum: number, e: any) => sum + (e.basicSalary || 0), 0);
      const totalAllowances = employees.reduce((sum: number, e: any) => 
        sum + (e.housingAllowance || 0) + (e.transportAllowance || 0) + (e.otherAllowances || 0), 0);
      const totalSalaries = totalBaseSalary + totalAllowances;

      res.json({
        employeesCount: employees.length,
        totalBaseSalary,
        totalAllowances,
        totalSalaries,
        breakdown: employees.map((e: any) => ({
          id: e.id,
          name: e.employeeName,
          department: e.department,
          baseSalary: e.basicSalary || 0,
          allowances: (e.housingAllowance || 0) + (e.transportAllowance || 0) + (e.otherAllowances || 0),
          total: (e.basicSalary || 0) + (e.housingAllowance || 0) + (e.transportAllowance || 0) + (e.otherAllowances || 0),
        })),
      });
    } catch (error) {
      console.error("Error fetching salary summary:", error);
      res.status(500).json({ error: "فشل في جلب ملخص الرواتب" });
    }
  });

  // Compare current period with previous periods
  app.get("/api/financials/periods/:id/comparison", isAuthenticated, async (req, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const currentData = await storage.getCompletePnLData(periodId);
      
      if (!currentData.period) {
        return res.status(404).json({ error: "الفترة المالية غير موجودة" });
      }

      // Get previous month
      let prevMonth = currentData.period.month - 1;
      let prevYear = currentData.period.year;
      if (prevMonth < 1) {
        prevMonth = 12;
        prevYear -= 1;
      }

      const prevPeriod = await storage.getFinancialPeriodByBranchAndDate(
        currentData.period.branchId, prevYear, prevMonth
      );
      
      let previousData = null;
      if (prevPeriod) {
        const prevComplete = await storage.getCompletePnLData(prevPeriod.id);
        if (prevComplete.metrics) {
          previousData = prevComplete.metrics;
        }
      }

      // Get same month last year
      const lastYearPeriod = await storage.getFinancialPeriodByBranchAndDate(
        currentData.period.branchId, currentData.period.year - 1, currentData.period.month
      );
      
      let lastYearData = null;
      if (lastYearPeriod) {
        const lyComplete = await storage.getCompletePnLData(lastYearPeriod.id);
        if (lyComplete.metrics) {
          lastYearData = lyComplete.metrics;
        }
      }

      const current = currentData.metrics;
      
      const comparison = {
        current: current ? {
          revenue: current.totalRevenue,
          grossProfit: current.grossProfit,
          netProfit: current.netProfit,
          grossMargin: current.grossMarginPct,
          netMargin: current.netMarginPct,
        } : null,
        previousMonth: previousData ? {
          revenue: previousData.totalRevenue,
          grossProfit: previousData.grossProfit,
          netProfit: previousData.netProfit,
          grossMargin: previousData.grossMarginPct,
          netMargin: previousData.netMarginPct,
          revenueChange: current && previousData.totalRevenue ? (((current.totalRevenue || 0) - (previousData.totalRevenue || 0)) / (previousData.totalRevenue || 1) * 100) : 0,
          profitChange: current && previousData.netProfit ? (((current.netProfit || 0) - (previousData.netProfit || 0)) / Math.abs(previousData.netProfit || 1) * 100) : 0,
        } : null,
        lastYear: lastYearData ? {
          revenue: lastYearData.totalRevenue,
          grossProfit: lastYearData.grossProfit,
          netProfit: lastYearData.netProfit,
          grossMargin: lastYearData.grossMarginPct,
          netMargin: lastYearData.netMarginPct,
          revenueChange: current && lastYearData.totalRevenue ? (((current.totalRevenue || 0) - (lastYearData.totalRevenue || 0)) / (lastYearData.totalRevenue || 1) * 100) : 0,
          profitChange: current && lastYearData.netProfit ? (((current.netProfit || 0) - (lastYearData.netProfit || 0)) / Math.abs(lastYearData.netProfit || 1) * 100) : 0,
        } : null,
      };

      res.json(comparison);
    } catch (error) {
      console.error("Error fetching period comparison:", error);
      res.status(500).json({ error: "فشل في جلب المقارنة" });
    }
  });

  return httpServer;
}
