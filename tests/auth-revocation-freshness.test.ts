import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  user: { id: "worker-a", role: "employee", isActive: "active", branchId: null } as any,
  branches: [{ branchId: "branch-a" }] as any[],
  permissions: [{ module: "reports", actions: ["view"] }] as any[],
  getUser: vi.fn(),
  getUserBranchAccess: vi.fn(),
  getUserPermissions: vi.fn(),
}));
vi.mock("../server/storage", () => ({
  storage: {
    getUser: store.getUser,
    getUserBranchAccess: store.getUserBranchAccess,
    getUserPermissions: store.getUserPermissions,
    updateSessionActivity: vi.fn(async () => {}),
  },
}));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(),
  verifyOtpForUser: vi.fn(), logShareholderActivity: vi.fn(),
}));

import {
  getCachedPermissionsForUser, hasCrossBranchHrReadAccess, invalidateAuthCache,
  isAuthenticated, requireAnyPermission, requirePermission, requireProductWritePermission,
} from "../server/auth";

async function request(handler: any, req: any) {
  const next = vi.fn();
  const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
  await handler(req, res, next);
  return { next, res };
}
function authRequest() {
  return {
    session: { userId: "worker-a", destroy: vi.fn((cb) => cb()) },
    headers: {}, sessionID: undefined, method: "GET",
  } as any;
}

describe("authorization reads authoritative state on every request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.user = { id: "worker-a", role: "employee", isActive: "active", branchId: null };
    store.branches = [{ branchId: "branch-a" }];
    store.permissions = [{ module: "reports", actions: ["view"] }];
    store.getUser.mockImplementation(async () => ({ ...store.user }));
    store.getUserBranchAccess.mockImplementation(async () => [...store.branches]);
    store.getUserPermissions.mockImplementation(async () => [...store.permissions]);
  });

  it("rejects a deactivated user on the next request even without local invalidation", async () => {
    const first = authRequest();
    expect((await request(isAuthenticated, first)).next).toHaveBeenCalledOnce();
    expect(first.currentUser.role).toBe("employee");
    store.user = { ...store.user, role: "admin", isActive: "inactive" };
    const second = authRequest();
    expect((await request(isAuthenticated, second)).res.status).toHaveBeenCalledWith(403);
    expect(second.currentUser).toBeUndefined();
    expect(store.getUser).toHaveBeenCalledTimes(2);
  });

  it("removes revoked grants and branch access while honoring a fresh role change", async () => {
    const first = authRequest();
    await request(isAuthenticated, first);
    expect((await request(requirePermission("reports", "view"), first)).next).toHaveBeenCalledOnce();
    store.permissions = [];
    store.branches = [];
    const second = authRequest();
    await request(isAuthenticated, second);
    expect(second.userBranchAccess).toEqual([]);
    expect((await request(requirePermission("reports", "view"), second)).res.status).toHaveBeenCalledWith(403);
    expect((await request(requireAnyPermission("reports", ["view"]), second)).res.status).toHaveBeenCalledWith(403);
    expect(getCachedPermissionsForUser("worker-a")).toBeNull();
    invalidateAuthCache("worker-a"); // not needed for correctness on another worker
    store.user = { ...store.user, role: "viewer" };
    const third = authRequest();
    await request(isAuthenticated, third);
    expect(third.currentUser.role).toBe("viewer");
    expect(store.getUser).toHaveBeenCalledTimes(3);
    expect(store.getUserPermissions).toHaveBeenCalledTimes(3);
  });

  it("does not reuse a prior request's HR or product grant", async () => {
    store.permissions = [
      { module: "hr_management", actions: ["view"] },
      { module: "products", actions: ["edit"] },
    ];
    const first = authRequest();
    await request(isAuthenticated, first);
    expect(hasCrossBranchHrReadAccess(first)).toBe(true);
    expect((await request(requireProductWritePermission("edit"), first)).next).toHaveBeenCalledOnce();
    store.permissions = [];
    const second = authRequest();
    await request(isAuthenticated, second);
    expect(hasCrossBranchHrReadAccess(second)).toBe(false);
    expect((await request(requireProductWritePermission("edit"), second)).res.status).toHaveBeenCalledWith(403);
  });

  it("bypasses the storage worker-local cache for fresh explicit grants", async () => {
    const stale = [{ module: "reports", actions: ["view"] }];
    store.getUserPermissions.mockImplementation(async (_userId, options) =>
      options?.bypassCache ? [...store.permissions] : stale);
    const first = authRequest();
    await request(isAuthenticated, first);
    expect((await request(requirePermission("reports", "view"), first)).next).toHaveBeenCalledOnce();
    store.permissions = [];
    const second = authRequest();
    await request(isAuthenticated, second);
    expect((await request(requirePermission("reports", "view"), second)).res.status).toHaveBeenCalledWith(403);
    expect(store.getUserPermissions).toHaveBeenCalledWith("worker-a", { bypassCache: true });
  });

  it("keeps the routes permission helpers fresh without changing route bodies", () => {
    const source = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
    const cashierHelper = source.slice(source.indexOf("async function canUserViewAllCashiers("),
      source.indexOf("import {", source.indexOf("async function canUserViewAllCashiers(")));
    expect(cashierHelper).toContain("storage.getUserPermissions(user.id, { bypassCache: true })");
    const routeHelper = source.slice(source.indexOf("const getCachedPermissions = async"),
      source.indexOf("const responseCache", source.indexOf("const getCachedPermissions = async")));
    expect(routeHelper).toContain("storage.getUserPermissions(userId, { bypassCache: true })");
    expect(source).toContain("await getCachedPermissions(currentUser.id)");
    expect(source).toContain("app.get(\"/api/my-permissions\"");
    expect(getCachedPermissionsForUser("worker-a")).toBeNull();
  });
});