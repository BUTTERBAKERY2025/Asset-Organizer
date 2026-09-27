import { createServer } from "node:http";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const movement = vi.hoisted(() => ({ where: null as any }));

const storage = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserPermissions: vi.fn(),
  getUserByUsername: vi.fn(),
  getWarehouseItem: vi.fn(),
  getWarehouseItems: vi.fn(),
  createWarehouseItem: vi.fn(),
  updateWarehouseItem: vi.fn(),
  getBranchStock: vi.fn(),
  updateBranchStock: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  getUserBranchAccess: vi.fn(),
  removeUserBranchAccess: vi.fn(),
  deleteUserPermissions: vi.fn(),
  setUserPermission: vi.fn(),
  createPermissionAuditLog: vi.fn(),
  invalidateAllUserSessions: vi.fn(),
  getMaterialTransferWithItems: vi.fn(),
  updateMaterialTransferStatus: vi.fn(),
  deliverMaterialTransferWithStockUpdate: vi.fn(),
  createWarehouseNotification: vi.fn(async () => ({})),
  getMaterialTransfers: vi.fn(),
  getAllBranches: vi.fn(async () => []),
}));
vi.mock("../server/storage", () => ({ storage }));
vi.mock("../server/db", () => ({
  db: {
    select: () => ({ from: () => ({
      where: (predicate: any) => {
        movement.where = predicate;
        return { orderBy: async () => [] };
      },
    }) }),
  },
  pool: {},
}));
vi.mock("../server/auth", () => {
  const pass = () => (_req: any, _res: any, next: () => void) => next();
  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: pass(), requirePermission: pass, requireAnyPermission: pass,
    requireRole: pass, requireBranchAccess: pass,
    canAccessBranch: async (req: any, id: string) => req.currentUser.role === "admin" || req.currentUser.branchId === id,
    isUserAdmin: (req: any) => req.currentUser.role === "admin",
    getAllowedBranchIds: (req: any) => req.currentUser.role === "warehouse_keeper"
      ? ["main_warehouse"] : [req.currentUser.branchId],
    getActiveBranchFilter: () => null,
    getEffectiveBranchFilter: (req: any) => ({
      hasAccess: true, branchIds: req.currentUser.role === "warehouse_keeper"
        ? ["main_warehouse"] : [req.currentUser.branchId],
      singleBranchId: req.currentUser.role === "warehouse_keeper"
        ? "main_warehouse" : req.currentUser.branchId,
    }),
    getWarehouseKeeperEffectivePermissions: async (_id: string, direct: { module: string; actions: string[] }[]) =>
      direct.filter(({ module }) => module === "warehouse"),
    invalidateAuthCache: vi.fn(), hasCrossBranchHrReadAccess: () => false,
    HR_MANAGER_MODULES: new Set(), HR_SPECIALIST_PERMISSIONS: {}, FINANCIAL_MANAGER_PERMISSIONS: {},
    OPERATIONS_MANAGER_PERMISSIONS: {}, BRANCH_MANAGER_CENTRAL_KITCHEN_PERMISSIONS: {},
  };
});
const handlers = new Map<string, any[]>();
const app: any = { use: () => app };
for (const method of ["get", "post", "put", "patch", "delete", "options"])
  app[method] = (path: string, ...fn: any[]) => { handlers.set(`${method} ${path}`, fn); return app; };

const keeper = { id: "keeper", role: "warehouse_keeper", branchId: null, firstName: "Keeper" };
const admin = { id: "admin", role: "admin", branchId: "main_warehouse" };
const receiver = { id: "receiver", role: "employee", branchId: "receiver_branch", firstName: "Receiver" };
const other = { id: "other", role: "warehouse_keeper", branchId: null };
async function call(method: string, path: string, actor: any, body: any = {}, id = "1") {
  const fn = handlers.get(`${method} ${path}`)!.at(-1);
  const req = { currentUser: actor, params: { id, userId: id, branchId: id, itemId: "8" }, body, query: {}, method: method.toUpperCase() };
  const res: any = {
    statusCode: 200, body: null, headersSent: false,
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; this.headersSent = true; return this; },
  };
  await fn(req, res);
  return res;
}

describe("warehouse keeper main-warehouse material transfer boundaries (mocked storage)", () => {
  beforeAll(async () => {
    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), app);
  }, 90_000);
  beforeEach(() => {
    vi.clearAllMocks();
    storage.getUserByUsername.mockResolvedValue(undefined);
    storage.createUser.mockImplementation(async (data: any) => ({ id: "new-keeper", ...data }));
    storage.updateUser.mockImplementation(async (_id: string, data: any) => ({ id: "employee-1", ...data }));
    storage.getUserBranchAccess.mockResolvedValue([{ branchId: "old_branch" }]);
    storage.getWarehouseItem.mockResolvedValue({ id: 8, name: "Canonical", currentStock: 4, isActive: true });
    storage.getWarehouseItems.mockResolvedValue([{ id: 8, name: "Canonical", currentStock: 4, isActive: true }]);
    storage.getUser.mockResolvedValue({ ...keeper, username: "keeper" });
    storage.getUserPermissions.mockResolvedValue([
      { module: "warehouse", actions: ["view"] },
      { module: "users", actions: ["view", "edit"] },
    ]);
    storage.getMaterialTransferWithItems.mockResolvedValue({
      transfer: {
        id: 1, transferNumber: "MT-1", status: "pending", sourceBranchId: "main_warehouse",
        destinationBranchId: "receiver_branch",
      }, items: [{ itemId: 8, quantity: 2 }],
    });
    storage.updateMaterialTransferStatus.mockImplementation(async (_id: number, status: string) =>
      ({ id: 1, status, transferNumber: "MT-1", sourceBranchId: "main_warehouse", destinationBranchId: "receiver_branch" }));
  });

  it("approves destination-originated requests from the main warehouse, never unrelated source transfers", async () => {
    expect((await call("put", "/api/warehouse/material-transfers/:id/status", keeper, { status: "approved" })).statusCode).toBe(200);
    expect(storage.updateMaterialTransferStatus).toHaveBeenCalledWith(1, "approved", expect.objectContaining({ approvedBy: keeper.id }), keeper.id);
    storage.getMaterialTransferWithItems.mockResolvedValueOnce({
      transfer: { id: 2, status: "pending", sourceBranchId: "other_branch", destinationBranchId: "receiver_branch" },
      items: [],
    });
    expect((await call("put", "/api/warehouse/material-transfers/:id/status", other, { status: "approved" }, "2")).statusCode).toBe(403);
    storage.getMaterialTransferWithItems.mockResolvedValueOnce({
      transfer: { id: 2, status: "pending", sourceBranchId: "other_branch", destinationBranchId: "receiver_branch" },
      items: [],
    });
    expect((await call("get", "/api/warehouse/material-transfers/:id", keeper, {}, "2")).statusCode).toBe(403);
  });

  it("reserves receipt for the destination, even when the keeper owns the source", async () => {
    storage.getMaterialTransferWithItems.mockResolvedValue({
      transfer: { id: 1, status: "in_transit", sourceBranchId: "main_warehouse", destinationBranchId: "receiver_branch" },
      items: [],
    });
    expect((await call("put", "/api/warehouse/material-transfers/:id/status", keeper, { status: "delivered" })).statusCode).toBe(403);
    storage.deliverMaterialTransferWithStockUpdate.mockResolvedValue({
      id: 1, transferNumber: "MT-1", status: "delivered", sourceBranchId: "main_warehouse", destinationBranchId: "receiver_branch",
    });
    expect((await call("put", "/api/warehouse/material-transfers/:id/status", receiver, { status: "delivered" })).statusCode).toBe(200);
    expect(storage.deliverMaterialTransferWithStockUpdate).toHaveBeenCalledOnce();
  });

  it("shows only request-fresh effective permissions after revocation, never stale grants", async () => {
    const mine = await call("get", "/api/my-permissions", keeper);
    expect(mine.body).toEqual([{ module: "warehouse", actions: ["view"] }]);
    expect(storage.getUserPermissions).toHaveBeenCalledWith(keeper.id, { bypassCache: true });
    const detailed = await call("get", "/api/rbac/users/:id/effective-permissions-detailed", keeper, {}, keeper.id);
    expect(detailed.body.permissions).toEqual([{
      module: "warehouse", actions: [{ action: "view", sources: ["role_auto"] }],
    }]);
    const effective = await call("get", "/api/rbac/users/:userId/effective-permissions", keeper, {}, keeper.id);
    expect(effective.body.permissions).toEqual([{ module: "warehouse", action: "view", allowed: true }]);
    expect(effective.body.allowedBranches).toEqual(["main_warehouse"]);
  });

  it("persists validated job titles and replaces old branch grants on role change", async () => {
    const createPath = "/api/users";
    const newUser = {
      username: "keeper1", password: "SafePass123", role: "warehouse_keeper",
      jobTitle: "warehouse_keeper", branchIds: [],
    };
    expect((await call("post", createPath, admin, { ...newUser, jobTitle: "invalid" })).statusCode).toBe(400);
    expect((await call("post", createPath, admin, { ...newUser, branchId: "other_branch" })).statusCode).toBe(400);
    expect((await call("post", createPath, admin, { ...newUser, branchId: "main_warehouse" })).statusCode).toBe(201);
    expect(storage.createUser).toHaveBeenCalledWith(expect.objectContaining({
      role: "warehouse_keeper", branchId: null, jobTitle: "warehouse_keeper",
    }));
    storage.getUser.mockResolvedValue({ id: "employee-1", role: "employee", branchId: "old_branch" });
    const updated = await call("patch", "/api/users/:id", admin,
      { role: "warehouse_keeper", jobTitle: "warehouse_keeper", branchId: "main_warehouse" }, "employee-1");
    expect(updated.statusCode).toBe(200);
    expect(storage.updateUser).toHaveBeenCalledWith("employee-1",
      expect.objectContaining({ role: "warehouse_keeper", jobTitle: "warehouse_keeper", branchId: null }));
    expect(storage.removeUserBranchAccess).toHaveBeenCalledWith("employee-1", "old_branch");
  });

  it("exposes the canonical main-warehouse catalogue but never branch stock or invented ownership", async () => {
    expect((await call("get", "/api/warehouse/items/:id", keeper, {}, "8")).body)
      .toMatchObject({ id: 8, currentStock: 4 });
    expect((await call("get", "/api/warehouse/items", keeper)).body).toHaveLength(1);
    expect((await call("get", "/api/warehouse/branch-stock/:branchId", keeper, {}, "other_branch")).statusCode).toBe(403);
    expect((await call("put", "/api/warehouse/branch-stock/:branchId/:itemId", keeper,
      { quantity: 200 }, "other_branch")).statusCode).toBe(403);
    expect(storage.getBranchStock).not.toHaveBeenCalled();
    expect(storage.updateBranchStock).not.toHaveBeenCalled();
    expect((await call("post", "/api/warehouse/items", keeper,
      { name: "Spoof", category: "raw", branchId: "other_branch" })).statusCode).toBe(400);
    expect((await call("put", "/api/warehouse/items/:id", keeper,
      { currentStock: 100, sourceBranchId: "other_branch" }, "8")).statusCode).toBe(400);
    expect(storage.createWarehouseItem).not.toHaveBeenCalled();
    expect(storage.updateWarehouseItem).not.toHaveBeenCalled();
  });

  it("requires provenance for null-branch movements and never returns destination-scoped report totals", async () => {
    expect((await call("get", "/api/warehouse/movement-logs", keeper)).statusCode).toBe(200);
    const query = new PgDialect().sqlToQuery(movement.where).sql;
    expect(query).toContain("EXISTS");
    expect(query).toContain("mt.source_branch_id = 'main_warehouse'");
    expect(query).toContain("rm.source_warehouse_id IS NULL");
    expect(query).toContain("rm.destination_warehouse_id IS NULL");
    expect((await call("get", "/api/warehouse/monthly-report", keeper)).statusCode).toBe(403);
  });
});