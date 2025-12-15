import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBranchSchema, insertInventoryItemSchema, insertSavedFilterSchema, insertUserSchema, insertConstructionProjectSchema, insertContractorSchema, insertProjectWorkItemSchema, insertProjectBudgetAllocationSchema, insertConstructionContractSchema, insertContractItemSchema, insertPaymentRequestSchema, insertContractPaymentSchema, insertUserPermissionSchema, SYSTEM_MODULES, MODULE_ACTIONS } from "@shared/schema";
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

  return httpServer;
}
