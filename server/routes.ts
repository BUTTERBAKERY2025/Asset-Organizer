import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertBranchSchema, insertInventoryItemSchema, insertSavedFilterSchema, insertUserSchema, insertConstructionProjectSchema, insertContractorSchema, insertProjectWorkItemSchema, insertProjectBudgetAllocationSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated, requireRole } from "./auth";

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
  app.get("/api/users", isAuthenticated, requireRole(["admin"]), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", isAuthenticated, requireRole(["admin"]), async (req, res) => {
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

  app.patch("/api/users/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
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

  app.delete("/api/users/:id", isAuthenticated, requireRole(["admin"]), async (req: any, res) => {
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

  app.post("/api/branches", isAuthenticated, requireRole(["admin"]), async (req, res) => {
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
  app.get("/api/inventory", async (req, res) => {
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

  app.get("/api/inventory/needs-inspection", async (req, res) => {
    try {
      const items = await storage.getItemsNeedingInspection();
      res.json(items);
    } catch (error) {
      console.error("Error fetching items needing inspection:", error);
      res.status(500).json({ error: "Failed to fetch items needing inspection" });
    }
  });

  app.get("/api/inventory/:id", async (req, res) => {
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

  app.get("/api/inventory/:id/audit-logs", async (req, res) => {
    try {
      const logs = await storage.getAuditLogsForItem(req.params.id);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.post("/api/inventory", isAuthenticated, requireRole(["admin", "employee"]), async (req: any, res) => {
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

  app.patch("/api/inventory/:id", isAuthenticated, requireRole(["admin", "employee"]), async (req: any, res) => {
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

  app.delete("/api/inventory/:id", isAuthenticated, requireRole(["admin"]), async (req: any, res) => {
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
  app.post("/api/inventory/import", isAuthenticated, requireRole(["admin", "employee"]), async (req: any, res) => {
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
      
      res.json(results);
    } catch (error) {
      console.error("Error importing inventory:", error);
      res.status(500).json({ error: "Failed to import inventory" });
    }
  });

  // Low quantity alert endpoint
  app.get("/api/inventory/low-quantity", isAuthenticated, async (req, res) => {
    try {
      const items = await storage.getAllInventoryItems();
      const lowQuantityItems = items.filter(item => item.quantity <= 5);
      res.json(lowQuantityItems);
    } catch (error) {
      console.error("Error fetching low quantity items:", error);
      res.status(500).json({ error: "Failed to fetch low quantity items" });
    }
  });

  // Maintenance alerts endpoint
  app.get("/api/inventory/maintenance-needed", isAuthenticated, async (req, res) => {
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
  app.get("/api/construction/contractors", async (req, res) => {
    try {
      const contractors = await storage.getAllContractors();
      res.json(contractors);
    } catch (error) {
      console.error("Error fetching contractors:", error);
      res.status(500).json({ error: "Failed to fetch contractors" });
    }
  });

  app.get("/api/construction/contractors/:id", async (req, res) => {
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

  app.post("/api/construction/contractors", isAuthenticated, requireRole(["admin", "employee"]), async (req, res) => {
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

  app.patch("/api/construction/contractors/:id", isAuthenticated, requireRole(["admin", "employee"]), async (req, res) => {
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

  app.delete("/api/construction/contractors/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
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
  app.get("/api/construction/projects", async (req, res) => {
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

  app.get("/api/construction/projects/:id", async (req, res) => {
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

  app.post("/api/construction/projects", isAuthenticated, requireRole(["admin", "employee"]), async (req, res) => {
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

  app.patch("/api/construction/projects/:id", isAuthenticated, requireRole(["admin", "employee"]), async (req, res) => {
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

  app.delete("/api/construction/projects/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
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
  app.get("/api/construction/work-items", async (req, res) => {
    try {
      const items = await storage.getAllWorkItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching all work items:", error);
      res.status(500).json({ error: "Failed to fetch work items" });
    }
  });

  app.get("/api/construction/projects/:projectId/work-items", async (req, res) => {
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

  app.get("/api/construction/work-items/:id", async (req, res) => {
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

  app.post("/api/construction/work-items", isAuthenticated, requireRole(["admin", "employee"]), async (req, res) => {
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

  app.patch("/api/construction/work-items/:id", isAuthenticated, requireRole(["admin", "employee"]), async (req, res) => {
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

  app.delete("/api/construction/work-items/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
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
  app.get("/api/construction/projects/:projectId/budget-allocations", async (req, res) => {
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

  app.post("/api/construction/budget-allocations", isAuthenticated, requireRole(["admin", "employee"]), async (req, res) => {
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

  app.post("/api/construction/budget-allocations/upsert", isAuthenticated, requireRole(["admin", "employee"]), async (req, res) => {
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

  app.patch("/api/construction/budget-allocations/:id", isAuthenticated, requireRole(["admin", "employee"]), async (req, res) => {
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

  app.delete("/api/construction/budget-allocations/:id", isAuthenticated, requireRole(["admin"]), async (req, res) => {
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

  return httpServer;
}
