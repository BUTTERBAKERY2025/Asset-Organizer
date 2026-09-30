import { createServer } from "node:http";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HQ_BRANCH_ID, isHeadquartersEmployee } from "../shared/employee-organization";

const mocks = vi.hoisted(() => ({
  users: [] as any[],
  access: vi.fn(async (_req: any, branch: string) => branch === "branch-a"),
  storage: {
    getAllUsers: vi.fn(),
    getUser: vi.fn(),
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    applyJobRolePermissions: vi.fn(),
  },
}));

vi.mock("../server/storage", () => ({ storage: mocks.storage }));
vi.mock("../server/db", () => ({
  db: {},
  pool: { query: vi.fn(async () => ({ rows: [{ files: true, fields: true, nullable_driver: true, file_binding: true, constraint_ready: true }] })) },
}));
vi.mock("../server/auth", () => {
  const pass = () => (_req: any, _res: any, next: () => void) => next();
  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated: pass(),
    requirePermission: (module: string, action: string) => (req: any, res: any, next: () => void) =>
      req.permissions?.includes(`${module}:${action}`) ? next() : res.status(403).json({ error: "permission denied" }),
    requireAnyPermission: pass,
    requireRole: pass,
    requireBranchAccess: pass(),
    canAccessBranch: mocks.access,
    isUserAdmin: (req: any) => req.currentUser?.role === "admin",
    getAllowedBranchIds: () => ["branch-a"],
    getActiveBranchFilter: () => "branch-a",
    getEffectiveBranchFilter: (req: any, requested?: string) => {
      const ids = req.currentUser?.role === "admin" ? null : ["branch-a"];
      if (requested && requested !== "all" && ids && !ids.includes(requested)) {
        return { hasAccess: false, branchIds: [] };
      }
      return { hasAccess: true, branchIds: requested && requested !== "all" ? [requested] : ids };
    },
    invalidateAuthCache: vi.fn(),
    hasCrossBranchHrReadAccess: () => false,
    HR_MANAGER_MODULES: new Set(),
    HR_SPECIALIST_PERMISSIONS: {},
    FINANCIAL_MANAGER_PERMISSIONS: {},
    OPERATIONS_MANAGER_PERMISSIONS: {},
    BRANCH_MANAGER_INTRINSIC_PERMISSIONS: {},
  };
});

const routes = new Map<string, any[]>();
function captureApp() {
  const app: any = {};
  for (const method of ["get", "post", "put", "patch", "delete", "options"]) {
    app[method] = (path: string, ...handlers: any[]) => {
      routes.set(`${method} ${path}`, handlers);
      return app;
    };
  }
  app.use = () => app;
  return app;
}

async function call(method: string, path: string, options: {
  role?: string; permissions?: string[]; hqAccess?: boolean;
  body?: any; id?: string; query?: any;
} = {}) {
  const handlers = routes.get(`${method} ${path}`);
  if (!handlers) throw new Error(`Missing route ${method} ${path}`);
  const req: any = {
    currentUser: { id: "actor", role: options.role || "employee", branchId: "branch-a" },
    permissions: options.permissions || [],
    body: options.body || {},
    params: { id: options.id || "branch" },
    query: options.query || {},
  };
  mocks.access.mockImplementation(async (_req, branch) =>
    branch === "branch-a" || (branch === HQ_BRANCH_ID && !!options.hqAccess));
  const response: any = {
    code: 200, body: undefined,
    status(code: number) { this.code = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  for (const handler of handlers) {
    let next = false;
    await handler(req, response, () => { next = true; });
    if (!next) break;
  }
  return response;
}

describe("HQ employee directory and operations isolation", () => {
  beforeAll(async () => {
    const { registerRoutes } = await import("../server/routes");
    await registerRoutes(createServer(), captureApp());
  }, 180_000);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.users = [
      { id: "hq", username: "hq-user", password: "secret", clerkId: "secret-id", firstName: "Head",
        lastName: "Office", branchId: HQ_BRANCH_ID, role: "employee", isActive: "active",
        jobTitle: "Accountant", phone: null, email: "hq@example.org", token: "private" },
      { id: "branch", username: "shop", password: "secret", branchId: "branch-a",
        role: "employee", isActive: "active", jobTitle: "Cashier" },
      { id: "unassigned", username: "loose", branchId: null, role: "employee",
        isActive: "active", jobTitle: null },
    ];
    mocks.storage.getAllUsers.mockImplementation(async () => mocks.users);
    mocks.storage.getUser.mockImplementation(async id => mocks.users.find(u => u.id === id));
  });

  it("classifies the actual HQ branch, excluding it from operations even for admins", async () => {
    expect(isHeadquartersEmployee(mocks.users[0])).toBe(true);
    const response = await call("get", "/api/operations-employees", {
      role: "admin", permissions: ["operations:view"],
    });
    expect(response.code).toBe(200);
    expect(response.body.map((u: any) => u.id)).toEqual(["branch", "unassigned"]);
    expect(mocks.storage.applyJobRolePermissions).not.toHaveBeenCalled();
  });

  it("requires both users:view and explicit HQ branch authority; returns allowlisted HQ fields only", async () => {
    const path = "/api/administration-employees";
    expect((await call("get", path, { hqAccess: true })).code).toBe(403);
    expect((await call("get", path, { permissions: ["users:view"] })).code).toBe(403);
    expect(mocks.storage.getAllUsers).not.toHaveBeenCalled();
    const allowed = await call("get", path, { permissions: ["users:view"], hqAccess: true });
    expect(allowed.code).toBe(200);
    expect(allowed.body).toEqual([{
      id: "hq", username: "hq-user", firstName: "Head", lastName: "Office",
      branchId: HQ_BRANCH_ID, jobTitle: "Accountant", isActive: "active",
      phone: null, email: "hq@example.org", role: "employee", departmentName: "غير محدد الإدارة",
    }]);
    expect((await call("get", path, { role: "admin", permissions: ["users:view"] })).code).toBe(200);
    expect(mocks.storage.applyJobRolePermissions).not.toHaveBeenCalled();
  });

  it("rejects HQ destination and existing HQ mutations without any writes", async () => {
    expect((await call("post", "/api/operations-employees", {
      role: "admin", permissions: ["operations:create"], body: { branchId: HQ_BRANCH_ID },
    })).code).toBe(403);
    for (const [method, path, options] of [
      ["patch", "/api/operations-employees/:id", { id: "hq", body: { firstName: "changed" }, permissions: ["operations:edit"] }],
      ["patch", "/api/operations-employees/:id", { id: "branch", body: { branchId: HQ_BRANCH_ID }, permissions: ["operations:edit"] }],
      ["delete", "/api/operations-employees/:id", { id: "hq", permissions: ["operations:delete"] }],
      ["post", "/api/operations-employees/:id/reapply-permissions", { id: "hq", permissions: ["operations:edit"] }],
    ] as const) {
      expect((await call(method, path, { ...options, role: "admin" })).code).toBe(403);
    }
    expect(mocks.storage.createUser).not.toHaveBeenCalled();
    expect(mocks.storage.updateUser).not.toHaveBeenCalled();
    expect(mocks.storage.deleteUser).not.toHaveBeenCalled();
    expect(mocks.storage.applyJobRolePermissions).not.toHaveBeenCalled();
  });

  it("denies nonadmins without target branch authority, including null-branch accounts and reapply", async () => {
    mocks.users[1].branchId = "branch-b";
    for (const [method, path, permission] of [
      ["patch", "/api/operations-employees/:id", "operations:edit"],
      ["delete", "/api/operations-employees/:id", "operations:delete"],
      ["post", "/api/operations-employees/:id/reapply-permissions", "operations:edit"],
    ]) {
      for (const id of ["unassigned", "hq", "branch"]) {
        expect((await call(method, path, { id, permissions: [permission] })).code).toBe(403);
      }
    }
    expect(mocks.storage.applyJobRolePermissions).not.toHaveBeenCalled();
  });

  it("rejects attempts to clear a scoped employee's branch without editing the account", async () => {
    for (const branchId of [null, "", "   "]) {
      const response = await call("patch", "/api/operations-employees/:id", {
        id: "branch", permissions: ["operations:edit"], body: { branchId },
      });
      expect(response.code).toBe(403);
    }
    expect(mocks.storage.updateUser).not.toHaveBeenCalled();
  });
});