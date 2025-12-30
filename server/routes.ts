import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBranchSchema, insertInventoryItemSchema, insertSavedFilterSchema, insertUserSchema, insertConstructionProjectSchema, insertContractorSchema, insertProjectWorkItemSchema, insertProjectBudgetAllocationSchema, insertConstructionContractSchema, insertContractItemSchema, insertPaymentRequestSchema, insertContractPaymentSchema, insertUserPermissionSchema, insertProductSchema, insertShiftSchema, insertShiftEmployeeSchema, insertProductionOrderSchema, insertQualityCheckSchema, insertTargetWeightProfileSchema, insertBranchMonthlyTargetSchema, insertIncentiveTierSchema, insertIncentiveAwardSchema, SYSTEM_MODULES, MODULE_ACTIONS, JOB_ROLE_PERMISSION_TEMPLATES, JOB_TITLE_LABELS, MODULE_LABELS, ACTION_LABELS, JOB_TITLES } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated, requirePermission, requireAnyPermission } from "./auth";

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

  // Admin routes for user management
  app.get("/api/users", isAuthenticated, requirePermission("users", "view"), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(({ password, ...user }) => user);
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
      const { firstName, lastName, role, password } = req.body;
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
      const branches = await storage.getAllBranches();
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
  app.get("/api/inventory", isAuthenticated, requirePermission("inventory", "view"), async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const items = branchId 
        ? await storage.getInventoryItemsByBranch(branchId)
        : await storage.getAllInventoryItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
      res.status(500).json({ error: "Failed to fetch inventory items" });
    }
  });

  app.get("/api/inventory/needs-inspection", isAuthenticated, requirePermission("inventory", "view"), async (req, res) => {
    try {
      const items = await storage.getItemsNeedingInspection();
      res.json(items);
    } catch (error) {
      console.error("Error fetching items needing inspection:", error);
      res.status(500).json({ error: "Failed to fetch items needing inspection" });
    }
  });

  app.get("/api/inventory/low-quantity", isAuthenticated, requirePermission("inventory", "view"), async (req, res) => {
    try {
      const items = await storage.getAllInventoryItems();
      const lowQuantityItems = items.filter(item => item.quantity <= 5);
      res.json(lowQuantityItems);
    } catch (error) {
      console.error("Error fetching low quantity items:", error);
      res.status(500).json({ error: "Failed to fetch low quantity items" });
    }
  });

  app.get("/api/inventory/maintenance-needed", isAuthenticated, requirePermission("inventory", "view"), async (req, res) => {
    try {
      const items = await storage.getAllInventoryItems();
      const maintenanceItems = items.filter(item => 
        item.status === 'maintenance' || item.status === 'damaged'
      );
      res.json(maintenanceItems);
    } catch (error) {
      console.error("Error fetching maintenance items:", error);
      res.status(500).json({ error: "Failed to fetch maintenance items" });
    }
  });

  app.get("/api/inventory/:id", isAuthenticated, requirePermission("inventory", "view"), async (req, res) => {
    try {
      const item = await storage.getInventoryItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
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

  app.post("/api/inventory", isAuthenticated, requirePermission("inventory", "create"), async (req: any, res) => {
    try {
      const validatedData = insertInventoryItemSchema.parse(req.body);
      const normalizedData = normalizeInventoryData(validatedData);
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
      const partialData = insertInventoryItemSchema.partial().parse(req.body);
      const normalizedData = normalizeInventoryData(partialData);
      const userId = req.currentUser.id;
      const item = await storage.updateInventoryItem(req.params.id, normalizedData, userId);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
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
  app.get("/api/production-orders", isAuthenticated, requirePermission("production", "view"), async (req, res) => {
    try {
      const { branchId, date } = req.query;
      let orders;
      if (branchId) {
        orders = await storage.getProductionOrdersByBranch(branchId as string);
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

  app.post("/api/production-orders", isAuthenticated, requirePermission("production", "create"), async (req: any, res) => {
    try {
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
  app.get("/api/cashier-journals", isAuthenticated, requirePermission("cashier_journal", "view"), async (req, res) => {
    try {
      const { branchId, date, startDate, endDate, cashierId, status, discrepancyStatus } = req.query;
      
      // Get all journals first, then apply filters
      let journals = await storage.getAllCashierJournals();
      
      // Apply filters in combination
      if (branchId) {
        journals = journals.filter(j => j.branchId === branchId);
      }
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
  app.post("/api/cashier-journals", isAuthenticated, requirePermission("cashier_journal", "create"), async (req: any, res) => {
    try {
      const { paymentBreakdowns, signatureData, signerName, ...journalData } = req.body;
      
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
      }
      
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
      }
      
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
  app.get("/api/cashier-journals/stats/summary", isAuthenticated, requirePermission("cashier_journal", "view"), async (req, res) => {
    try {
      const { branchId } = req.query;
      const stats = await storage.getCashierJournalStats(branchId as string | undefined);
      res.json(stats);
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
      
      // Calculate weights for each day
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
        dayWeights.push(weekdayWeights[dayOfWeek]);
      }
      
      // Normalize weights to sum to 100
      const totalWeight = dayWeights.reduce((sum, w) => sum + w, 0);
      const normalizedWeights = dayWeights.map(w => (w / totalWeight) * 100);
      
      // Create allocations
      const allocations = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = day.toString().padStart(2, '0');
        const targetDate = `${target.yearMonth}-${dayStr}`;
        const weightPercent = normalizedWeights[day - 1];
        const dailyTarget = (target.targetAmount * weightPercent) / 100;
        
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

  app.post("/api/seasons-holidays", isAuthenticated, requirePermission("operations", "create"), async (req: any, res) => {
    try {
      const { name, type, startDate, endDate, weightMultiplier, applicableBranches, description, isRecurring, recurringPattern } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "اسم الموسم/الإجازة مطلوب" });
      }
      if (!type || !['season', 'holiday', 'event'].includes(type)) {
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
        startDate,
        endDate,
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

  return httpServer;
}
