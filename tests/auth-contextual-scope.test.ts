import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  user: { id: "worker", role: "employee", isActive: "active", branchId: "A" } as any,
  branches: [{ branchId: "A" }] as any[],
  snapshot: undefined as any,
  getUser: vi.fn(),
  getUserBranchAccess: vi.fn(),
  getPermissionDecisionSnapshot: vi.fn(),
}));
vi.mock("../server/storage", () => ({ storage: {
  getUser: store.getUser,
  getUserBranchAccess: store.getUserBranchAccess,
  getPermissionDecisionSnapshot: store.getPermissionDecisionSnapshot,
  updateSessionActivity: vi.fn(async () => {}),
} }));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(),
  verifyOtpForUser: vi.fn(), logShareholderActivity: vi.fn(),
}));

import {
  canAccessBranch, getAllowedBranchIds, getEffectiveBranchFilter, getMandatoryBranchFilter,
  getPermissionScopeConstraint, hasCrossBranchHrReadAccess, hasPermissionScopeConstraint,
  getNavigationPermissionProjection, projectNavigationPermissions,
  isAuthenticated, requireAnyPermission, requirePermission, requireProductWritePermission,
} from "../server/auth";
import {
  normalizePermissionDecisionSnapshot, type PermissionDecisionInput,
} from "../server/permission-decision";

const now = Date.parse("2026-10-02T12:00:00Z");
function role(module: string, action: string, branchId: string | null, changes: object = {}) {
  return {
    module, action, permissionId: 1, scopeType: "branch", branchId, departmentId: null,
    startDate: new Date(now - 1), endDate: null, isActive: true, ...changes,
  };
}
function override(module: string, action: string, branchId: string | null, changes: object = {}) {
  return { module, action, permissionId: 1, allow: false, branchId, departmentId: null, expiresAt: null, ...changes };
}
function snapshot(changes: Partial<PermissionDecisionInput> = {}) {
  const input: PermissionDecisionInput = {
    userId: "worker", sourceMode: null, direct: [], roles: [], overrides: [], ...changes,
  };
  // Includes empty custom rows; normalization must preserve these in production.
  return { ...normalizePermissionDecisionSnapshot(input, now), directPermissions: input.direct };
}
function req(changes: object = {}) {
  return {
    currentUser: { ...store.user }, userBranchAccess: [...store.branches],
    authPermissionDecisionSnapshot: store.snapshot,
    session: {}, method: "GET", body: {}, query: {}, headers: {}, ...changes,
  } as any;
}
async function invoke(handler: any, request: any) {
  const next = vi.fn();
  const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
  await handler(request, res, next);
  return { next, res };
}
const persisted = (branchId: string) => async () => ({ kind: "resource" as const, branchId });
const collection = async () => ({ kind: "collection" as const, branchIds: ["A", "B", "C"] });

describe("request-scoped authority uses source/action/scope/time tuples", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.user = { id: "worker", role: "employee", isActive: "active", branchId: "A" };
    store.branches = [{ branchId: "A" }];
    store.snapshot = snapshot();
    store.getUser.mockImplementation(async () => ({ ...store.user }));
    store.getUserBranchAccess.mockImplementation(async () => [...store.branches]);
    store.getPermissionDecisionSnapshot.mockImplementation(async () => store.snapshot);
  });

  it("does not cross-multiply branch-view with branch-edit from another assignment", async () => {
    store.snapshot = snapshot({ roles: [role("reports", "view", "A"), role("reports", "edit", "B")] });
    expect((await invoke(requirePermission("reports", "edit", persisted("A")), req())).res.status).toHaveBeenCalledWith(403);
    const request = req({ method: "PATCH" });
    expect((await invoke(requirePermission("reports", "edit", persisted("B")), request)).next).toHaveBeenCalledOnce();
    expect(await canAccessBranch(request, "A")).toBe(false);
    expect(await canAccessBranch(request, "B")).toBe(true);
    expect(getAllowedBranchIds(request)).toEqual(["B"]);
  });

  it("fails closed for unadopted ID/write routes even with a supplied allowed branch", async () => {
    store.snapshot = snapshot({ roles: [role("reports", "edit", "A")] });
    const request = req({ method: "PATCH", params: { id: "record-in-B" }, body: { branchId: "A" }, query: { branchId: "A" } });
    expect((await invoke(requirePermission("reports", "edit"), request)).res.status).toHaveBeenCalledWith(403);
    expect((await invoke(requireAnyPermission("reports", ["view", "edit"]), request)).res.status).toHaveBeenCalledWith(403);
  });

  it("allows only module/action-specific collection branches and ignores a claimed query filter", async () => {
    store.snapshot = snapshot({ roles: [
      role("reports", "view", "A"), role("reports", "edit", "B"), role("inventory", "view", "C"),
    ] });
    const request = req({ query: { branchId: "B" } });
    expect((await invoke(requirePermission("reports", "view", collection), request)).next).toHaveBeenCalledOnce();
    expect(getAllowedBranchIds(request)).toEqual(["A"]);
    expect(getEffectiveBranchFilter(request, "B")).toEqual({ branchIds: [], singleBranchId: null, hasAccess: false });
    expect(getEffectiveBranchFilter(request)).toEqual({ branchIds: ["A"], singleBranchId: "A", hasAccess: true });
    expect(await canAccessBranch(request, "B")).toBe(false);
    expect(getPermissionScopeConstraint(request)?.module).toBe("reports");
  });

  it("enforces start inclusive and end/expires exclusive at exact boundaries", async () => {
    store.snapshot = snapshot({ roles: [
      role("future", "view", "A", { startDate: new Date(now + 1) }),
      role("started", "view", "A", { startDate: new Date(now) }),
      role("ended", "view", "A", { endDate: new Date(now) }),
    ], overrides: [override("expired", "view", "A", { allow: true, expiresAt: new Date(now) })] });
    for (const module of ["future", "ended", "expired"]) {
      expect((await invoke(requirePermission(module, "view", persisted("A")), req())).res.status).toHaveBeenCalledWith(403);
    }
    expect((await invoke(requirePermission("started", "view", persisted("A")), req())).next).toHaveBeenCalledOnce();
  });

  it("scoped deny precedes direct and intrinsic grants only in relevant resource scope", async () => {
    store.user.role = "hr_manager";
    store.branches = [{ branchId: "A" }, { branchId: "B" }];
    store.snapshot = snapshot({ direct: [{ module: "hr_documents", actions: ["view", "delete"] }],
      overrides: [override("hr_documents", "delete", "A")] });
    expect((await invoke(requirePermission("hr_documents", "delete", persisted("A")), req({ method: "DELETE" }))).res.status).toHaveBeenCalledWith(403);
    expect((await invoke(requirePermission("hr_documents", "delete", persisted("B")), req({ method: "DELETE" }))).next).toHaveBeenCalledOnce();
    expect((await invoke(requirePermission("hr_documents", "delete"), req({ method: "DELETE", body: { branchId: "B" } }))).res.status).toHaveBeenCalledWith(403);
    expect((await invoke(requireAnyPermission("hr_documents", ["delete", "view"], persisted("A")), req())).next).toHaveBeenCalledOnce();
  });

  it("cannot widen a narrowed HR collection through the legacy HR shortcut", async () => {
    store.user.role = "hr_manager";
    store.snapshot = snapshot({ overrides: [override("hr_documents", "view", "B")] });
    const request = req();
    expect((await invoke(requirePermission("hr_documents", "view", collection), request)).next).toHaveBeenCalledOnce();
    expect(hasPermissionScopeConstraint(request)).toBe(true);
    expect(hasCrossBranchHrReadAccess(request)).toBe(false);
    expect(getAllowedBranchIds(request)).toEqual(["A", "C"]);
    expect(getMandatoryBranchFilter(request)).toBe("__no_authorized_branch__");
  });

  it("never promotes department-scoped collections without verified department context", async () => {
    store.snapshot = snapshot({ roles: [role("reports", "view", "A", { scopeType: "department", branchId: null, departmentId: 7 })] });
    expect((await invoke(requirePermission("reports", "view", collection), req())).res.status).toHaveBeenCalledWith(403);
    expect((await invoke(requirePermission("reports", "view", async () => ({
      kind: "resource", branchId: "B", departmentId: 7,
    })), req())).next).toHaveBeenCalledOnce();
  });

  it("preserves unscoped direct/intrinsic authority and G03 action restrictions", async () => {
    store.snapshot = snapshot({ direct: [{ module: "reports", actions: ["view"] }] });
    expect((await invoke(requirePermission("reports"), req())).next).toHaveBeenCalledOnce();
    store.user.role = "hr_specialist";
    expect((await invoke(requirePermission("hr_documents"), req({ method: "DELETE" }))).res.status).toHaveBeenCalledWith(403);
    expect((await invoke(requirePermission("hr_documents", "edit"), req({ method: "PATCH" }))).next).toHaveBeenCalledOnce();
    store.user.role = "viewer";
    expect((await invoke(requireAnyPermission("reports", ["view", "delete"]), req())).next).toHaveBeenCalledOnce();
    expect((await invoke(requirePermission("reports", "delete"), req())).res.status).toHaveBeenCalledWith(403);
  });

  it("preserves branch-manager custom module selection including explicit empty revocation", async () => {
    store.user.role = "branch_manager";
    store.snapshot = snapshot({ direct: [{ module: "central_kitchen_orders", actions: [] }],
      roles: [role("central_kitchen_orders", "view", "A")] });
    expect((await invoke(requirePermission("central_kitchen_orders", "view"), req())).res.status).toHaveBeenCalledWith(403);
    expect((await invoke(requirePermission("branch_supply", "view"), req())).next).toHaveBeenCalledOnce();
    store.user.role = "warehouse_keeper";
    expect((await invoke(requirePermission("warehouse", "view"), req())).res.status).toHaveBeenCalledWith(403);
  });

  it("does not silently regrant branch-manager custom actions when raw direct rows are missing", async () => {
    store.user.role = "branch_manager";
    store.snapshot = normalizePermissionDecisionSnapshot({
      userId: "worker", sourceMode: null, direct: [{ module: "central_kitchen_orders", actions: [] }],
      roles: [], overrides: [],
    }, now);
    // Simulates a malformed/old storage snapshot independently of normalization.
    delete store.snapshot.directPermissions;
    expect((await invoke(requirePermission("central_kitchen_orders", "view"), req())).res.status).toHaveBeenCalledWith(503);
  });

  it("admin bypasses snapshot failures, context resolution and scoped/global denies", async () => {
    store.user.role = "admin";
    store.getPermissionDecisionSnapshot.mockRejectedValue(new Error("missing migration"));
    const resolver = vi.fn(async () => { throw new Error("must never resolve"); });
    const request = req({ authPermissionDecisionSnapshot: undefined });
    expect((await invoke(requirePermission("hr_documents", "delete", resolver), request)).next).toHaveBeenCalledOnce();
    expect((await invoke(requireAnyPermission("hr_documents", ["delete"], resolver), request)).next).toHaveBeenCalledOnce();
    expect((await invoke(isAuthenticated, { session: { userId: "worker" }, headers: {}, method: "GET", path: "/" })).next).toHaveBeenCalledOnce();
    expect(store.getPermissionDecisionSnapshot).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
  });

  it("reloads decisions on the next authenticated request, reusing only the current request", async () => {
    store.snapshot = snapshot({ roles: [role("reports", "view", "A")] });
    const fresh = () => ({ session: { userId: "worker" }, headers: {}, method: "GET", path: "/" } as any);
    const first = fresh();
    await invoke(isAuthenticated, first);
    expect((await invoke(requirePermission("reports", "view", persisted("A")), first)).next).toHaveBeenCalledOnce();
    store.snapshot = snapshot();
    const second = fresh();
    await invoke(isAuthenticated, second);
    expect((await invoke(requirePermission("reports", "view", persisted("A")), second)).res.status).toHaveBeenCalledWith(403);
    expect(store.getPermissionDecisionSnapshot).toHaveBeenCalledTimes(2);
  });

  it("fails explicitly closed when the source metadata table is unavailable", async () => {
    store.getPermissionDecisionSnapshot.mockRejectedValue(new Error("migration 050 required"));
    expect((await invoke(requirePermission("reports", "view"), req({ authPermissionDecisionSnapshot: undefined }))).res.status).toHaveBeenCalledWith(503);
    expect((await invoke(isAuthenticated, { session: { userId: "worker" }, headers: {}, method: "GET" })).res.status).toHaveBeenCalledWith(503);
  });

  it("does not restore a revoked intrinsic product write through operations fallback", async () => {
    store.user.role = "production_development_manager";
    store.snapshot = snapshot({ direct: [{ module: "operations", actions: ["edit"] }],
      overrides: [override("products", "edit", null)] });
    expect((await invoke(requireProductWritePermission("edit"), req({ method: "PATCH" }))).res.status).toHaveBeenCalledWith(403);
  });

  it("preserves production-manager explicit actions without weakening unknown-method inference", async () => {
    store.user.role = "production_development_manager";
    expect((await invoke(requirePermission("products", "edit"), req({ method: "UNKNOWN" }))).next).toHaveBeenCalledOnce();
    expect((await invoke(requirePermission("products"), req({ method: "UNKNOWN" }))).res.status).toHaveBeenCalledWith(403);
  });

  it("intersects successive guard scopes instead of leaking a previous module grant", async () => {
    store.snapshot = snapshot({ roles: [
      role("reports", "view", "A"), role("inventory", "view", "B"),
    ] });
    const request = req();
    await invoke(requirePermission("reports", "view", collection), request);
    await invoke(requirePermission("inventory", "view", collection), request);
    expect(getAllowedBranchIds(request)).toEqual([]);
    expect(getEffectiveBranchFilter(request).hasAccess).toBe(false);
  });

  it("projects A-view and B-delete for navigation without authorizing an unknown data route", async () => {
    store.snapshot = snapshot({ roles: [role("reports", "view", "A"), role("reports", "delete", "B")] });
    const request = req();
    const projection = await getNavigationPermissionProjection(request, ["A", "B"]);
    expect(projection.find(row => row.module === "reports")?.actions).toEqual(["view", "delete"]);
    expect(getPermissionScopeConstraint(request)).toBeUndefined();
    expect(request.permissionResourceContext).toBeUndefined();
    expect((await invoke(requirePermission("reports", "delete"), request)).res.status).toHaveBeenCalledWith(403);
    expect((await invoke(requirePermission("reports", "delete", persisted("A")), request)).res.status).toHaveBeenCalledWith(403);
  });

  it("navigation deny in A does not suppress valid B or bypass a global deny", () => {
    store.snapshot = snapshot({ roles: [role("reports", "view", "A"), role("reports", "view", "B")],
      overrides: [override("reports", "view", "A")] });
    expect(projectNavigationPermissions(store.snapshot, req(), ["A", "B"])).toContainEqual({ module: "reports", actions: ["view"] });
    expect(projectNavigationPermissions(store.snapshot, req(), ["A"])).toEqual([]);
    store.snapshot = snapshot({ roles: [role("reports", "view", "B")],
      overrides: [override("reports", "view", null)] });
    expect(projectNavigationPermissions(store.snapshot, req(), ["A", "B"])).toEqual([]);
  });

  it("navigation reflects expiry on the next snapshot and can advertise department capability only", async () => {
    store.snapshot = snapshot({ roles: [
      role("reports", "view", null, { scopeType: "department", departmentId: 7, endDate: new Date(now + 1) }),
    ] });
    const first = req({ authPermissionDecisionSnapshot: undefined });
    expect(await getNavigationPermissionProjection(first, ["A"])).toContainEqual({ module: "reports", actions: ["view"] });
    expect(getPermissionScopeConstraint(first)).toBeUndefined();
    expect((await invoke(requirePermission("reports", "view", collection), first)).res.status).toHaveBeenCalledWith(403);
    store.snapshot = { ...store.snapshot, capturedAt: now + 1 };
    expect(await getNavigationPermissionProjection(req({ authPermissionDecisionSnapshot: undefined }), ["A"])).toEqual([]);
    expect(store.getPermissionDecisionSnapshot).toHaveBeenCalledTimes(2);
  });

  it("navigation retains hard role ceilings and does not change an existing scope constraint", () => {
    store.snapshot = snapshot({ direct: [{ module: "reports", actions: ["delete"] }] });
    const request = req({ currentUser: { ...store.user, role: "attendance_clerk" },
      permissionScopeConstraint: { module: "attendance_check", actions: ["view"], kind: "resource", branchIds: ["A"] } });
    const originalConstraint = request.permissionScopeConstraint;
    expect(projectNavigationPermissions(store.snapshot, request, ["A", "B"]))
      .toEqual([{ module: "attendance_check", actions: ["view", "create", "edit"] }]);
    expect(request.permissionScopeConstraint).toBe(originalConstraint);
    const seed = [{ module: "shareholders", actions: ["view"] }];
    expect(projectNavigationPermissions(store.snapshot, req({ currentUser: { ...store.user, role: "shareholder" } }), ["A", "B"], seed)).toEqual(seed);
    expect(projectNavigationPermissions(store.snapshot, req({ currentUser: { ...store.user, role: "admin" } }), ["A"], seed)).toEqual(seed);
    const keeper = projectNavigationPermissions(store.snapshot, req({ currentUser: { ...store.user, role: "warehouse_keeper" } }), ["A", "B"]);
    expect(keeper.some(row => row.module === "reports")).toBe(false);
  });
});