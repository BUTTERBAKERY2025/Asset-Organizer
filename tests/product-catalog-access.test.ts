import { createServer } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Permission = { module: string; actions: string[] };

const permissionStorage = vi.hoisted(() => new Map<string, Permission[]>());
const productStorage = vi.hoisted(() => ({
  getAllProducts: vi.fn(async () => [{ id: 1, name: "Catalog item" }]),
  getProduct: vi.fn(async (id: number) => ({ id, name: "Catalog item" })),
  createProduct: vi.fn(async (data: unknown) => ({ id: 2, ...(data as object) })),
  updateProduct: vi.fn(async (id: number, data: unknown) => ({ id, ...(data as object) })),
  deleteProduct: vi.fn(async () => true),
}));

vi.mock("../server/auth", () => {
  const isAllowed = (req: any, module: string, action: string) => {
    if (req.currentUser?.role === "admin") return true;
    return (permissionStorage.get(req.currentUser?.id) || []).some(
      (permission) => permission.module === module && permission.actions.includes(action),
    );
  };
  const requirePermission = (module: string, action?: string) =>
    async (req: any, res: any, next: () => void) => {
      if (!req.currentUser) return res.status(401).json({ message: "غير مصرح" });
      const effectiveAction = action || (
        req.method === "GET" ? "view" :
          req.method === "POST" ? "create" :
            req.method === "DELETE" ? "delete" : "edit"
      );
      if (!isAllowed(req, module, effectiveAction)) {
        return res.status(403).json({ message: "غير مسموح" });
      }
      next();
    };
  const middleware = () => (_req: any, _res: any, next: () => void) => next();
  const isAuthenticated = (req: any, res: any, next: () => void) =>
    req.currentUser ? next() : res.status(401).json({ message: "غير مصرح" });

  return {
    setupAuth: vi.fn(async () => undefined),
    isAuthenticated,
    requirePermission,
    requireAnyPermission: middleware,
    requireRole: middleware,
    requireBranchAccess: middleware,
    canAccessBranch: vi.fn(async () => true),
    isUserAdmin: vi.fn((req: any) => req.currentUser?.role === "admin"),
    getAllowedBranchIds: vi.fn(async () => null),
    getActiveBranchFilter: vi.fn(() => null),
    getEffectiveBranchFilter: vi.fn(() => ({ hasAccess: true, singleBranchId: null, branchIds: null })),
    invalidateAuthCache: vi.fn(),
    getCachedPermissionsForUser: vi.fn(() => null),
    parseUserAgent: vi.fn(() => ({ browser: "test", os: "test", device: "test" })),
    hasCrossBranchHrReadAccess: vi.fn(() => false),
    HR_MANAGER_MODULES: new Set(),
    HR_SPECIALIST_PERMISSIONS: {},
    FINANCIAL_MANAGER_PERMISSIONS: {},
    OPERATIONS_MANAGER_PERMISSIONS: {},
    BRANCH_MANAGER_CENTRAL_KITCHEN_PERMISSIONS: {},
  };
});

vi.mock("../server/storage", () => ({ storage: productStorage }));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));

type Registration = {
  method: string;
  path: string;
  handlers: Array<(req: any, res: any, next: (error?: unknown) => void) => unknown>;
};

type TestResponse = {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
};

const registrations: Registration[] = [];
let registerRoutes: typeof import("../server/routes").registerRoutes;

function captureApp() {
  const app: any = {};
  for (const method of ["get", "post", "put", "patch", "delete", "options"]) {
    app[method] = (path: string, ...handlers: Registration["handlers"]) => {
      registrations.push({ method, path, handlers });
      return app;
    };
  }
  app.use = () => app;
  return app;
}

function findRoute(method: string, path: string): Registration {
  const registration = registrations.find((entry) => entry.method === method && entry.path === path);
  if (!registration) throw new Error(`Route was not registered: ${method.toUpperCase()} ${path}`);
  return registration;
}

async function invoke(
  method: string,
  path: string,
  options: { user?: any; params?: Record<string, string>; body?: Record<string, unknown> } = {},
): Promise<TestResponse> {
  const route = findRoute(method, path);
  const response: TestResponse = { statusCode: 200, body: undefined, headers: {} };
  const req: any = {
    method: method.toUpperCase(),
    path,
    originalUrl: path,
    currentUser: options.user,
    params: options.params || {},
    query: {},
    body: options.body || {},
    headers: {},
    session: options.user ? { userId: options.user.id } : {},
    get(name: string) {
      return this.headers[name.toLowerCase()];
    },
  };
  const res: any = {
    status(code: number) {
      response.statusCode = code;
      return res;
    },
    set(name: string, value: string) {
      response.headers[name.toLowerCase()] = value;
      return res;
    },
    setHeader(name: string, value: string) {
      response.headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name: string) {
      return response.headers[name.toLowerCase()];
    },
    json(body: unknown) {
      response.body = body;
      return res;
    },
    send(body: unknown) {
      response.body = body;
      return res;
    },
    end() {
      return res;
    },
    on() {
      return res;
    },
  };

  let index = 0;
  const run = async (error?: unknown): Promise<void> => {
    if (error) throw error;
    const handler = route.handlers[index++];
    if (!handler) return;

    let delegated = false;
    await new Promise<void>((resolve, reject) => {
      const next = (nextError?: unknown) => {
        delegated = true;
        void run(nextError).then(resolve, reject);
      };
      Promise.resolve(handler(req, res, next)).then(() => {
        if (!delegated) resolve();
      }, reject);
    });
  };

  await run();
  return response;
}

function user(id: string) {
  return { id, role: "staff" };
}

function grant(id: string, module: string, actions: string[]) {
  permissionStorage.set(id, [{ module, actions }]);
}

beforeAll(async () => {
  ({ registerRoutes } = await import("../server/routes"));
  await registerRoutes(createServer(), captureApp());
});

beforeEach(() => {
  permissionStorage.clear();
  vi.clearAllMocks();
});

afterAll(() => {
  registrations.length = 0;
});

describe("product catalog access", () => {
  it.each(["operations", "products", "production", "daily_production", "advanced_production"])(
    "allows %s:view to list and inspect products",
    async (module) => {
      const currentUser = user(`view-${module}`);
      grant(currentUser.id, module, ["view"]);

      const list = await invoke("get", "/api/products", { user: currentUser });
      const detail = await invoke("get", "/api/products/:id", {
        user: currentUser,
        params: { id: "1" },
      });

      expect(list.statusCode).toBe(200);
      expect(detail.statusCode).toBe(200);
      expect(list.headers["cache-control"]).toBe("private, no-store");
      expect(detail.headers["cache-control"]).toBe("private, no-store");
    },
  );

  it("does not treat a create-only grant as catalog read access", async () => {
    const currentUser = user("create-only");
    grant(currentUser.id, "products", ["create"]);

    const response = await invoke("get", "/api/products", { user: currentUser });

    expect(response.statusCode).toBe(403);
    expect(productStorage.getAllProducts).not.toHaveBeenCalled();
  });

  it("denies a user without catalog permission and unauthenticated requests", async () => {
    const denied = await invoke("get", "/api/products", { user: user("no-permission") });
    const unauthenticated = await invoke("get", "/api/products");

    expect(denied.statusCode).toBe(403);
    expect(unauthenticated.statusCode).toBe(401);
  });

  it.each(["post", "patch", "delete"])(
    "keeps %s denied for production-only users",
    async (method) => {
      const currentUser = user(`production-write-${method}`);
      grant(currentUser.id, "production", ["view"]);

      const response = await invoke(method, method === "post" ? "/api/products" : "/api/products/:id", {
        user: currentUser,
        params: { id: "1" },
        body: { name: "No write", category: "bread", unit: "piece" },
      });

      expect(response.statusCode).toBe(403);
    },
  );

  it("keeps the legacy operations write guards working", async () => {
    const currentUser = user("operations-legacy");
    grant(currentUser.id, "operations", ["create", "edit", "delete"]);

    const created = await invoke("post", "/api/products", {
      user: currentUser,
      body: { name: "Created", category: "bread", unit: "piece" },
    });
    const updated = await invoke("patch", "/api/products/:id", {
      user: currentUser,
      params: { id: "1" },
      body: { name: "Updated" },
    });
    const deleted = await invoke("delete", "/api/products/:id", {
      user: currentUser,
      params: { id: "1" },
    });

    expect(created.statusCode).toBe(201);
    expect(updated.statusCode).toBe(200);
    expect(deleted.statusCode).toBe(200);
  });
});

describe("catalog cache boundary", () => {
  it("passes product reads through the cache middleware and does not replay revoked content", async () => {
    const { apiCacheMiddleware } = await import("../server/api-cache");
    let cacheNextCalls = 0;
    apiCacheMiddleware(
      {
        method: "GET",
        path: "/api/products",
        query: {},
        headers: {},
        session: { userId: "cache-user" },
      } as any,
      {} as any,
      () => {
        cacheNextCalls += 1;
      },
    );
    expect(cacheNextCalls).toBe(1);

    const currentUser = user("revoked-catalog");
    grant(currentUser.id, "products", ["view"]);
    const beforeRevocation = await invoke("get", "/api/products", { user: currentUser });
    permissionStorage.clear();
    const afterRevocation = await invoke("get", "/api/products", { user: currentUser });

    expect(beforeRevocation.statusCode).toBe(200);
    expect(afterRevocation.statusCode).toBe(403);
    expect(afterRevocation.body).not.toEqual(beforeRevocation.body);
  });
});