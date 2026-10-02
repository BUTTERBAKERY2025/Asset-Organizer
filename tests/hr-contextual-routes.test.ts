import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as any[],
  select: vi.fn(),
  metadata: vi.fn(),
}));
vi.mock("../server/db", () => ({ db: { select: state.select }, pool: {} }));
vi.mock("../server/storage", () => ({ storage: {} }));
vi.mock("../server/auth", () => ({
  isAuthenticated: vi.fn(),
  requirePermission: (module: string, action: string, resolver: any) => ({ module, action, resolver }),
  getEffectiveBranchFilter: () => ({ branchIds: ["A"], hasAccess: true }),
  getCachedPermissionsForUser: vi.fn(),
  hasCrossBranchHrReadAccess: () => true,
  hasPermissionScopeConstraint: () => true,
}));
vi.mock("../server/employee-documents-read", () => ({ readEmployeeDocumentMetadata: state.metadata }));

import { registerHrRoutes } from "../server/hr-routes";
import { branchEmployees, branches, employeeEvaluations } from "../shared/schema";

const routes: { method: string; path: string; guard: any; handler: any }[] = [];
const app: any = Object.fromEntries(["get", "post", "patch", "put", "delete"].map(method => [
  method, (path: string, _auth: any, guard: any, handler: any) => routes.push({ method, path, guard, handler }),
]));
registerHrRoutes(app);
const route = (method: string, path: string) => routes.find(row => row.method === method && row.path === path)!;
const chain: any = {};
for (const name of ["from", "where", "innerJoin", "leftJoin", "orderBy", "limit"]) chain[name] = vi.fn(() => chain);
chain.then = (resolve: any) => Promise.resolve(state.rows).then(resolve);

describe("bounded HR route-owned permission contexts (no database connection)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.rows = [];
    state.select.mockReturnValue(chain);
    state.metadata.mockResolvedValue({ stats: { total: 2 } });
  });

  it.each([
    ["get", "/api/hr/documents/stats", "hr_documents", "view"],
    ["get", "/api/hr/evaluations", "hr_evaluations", "view"],
    ["post", "/api/hr/evaluations", "hr_evaluations", "create"],
    ["patch", "/api/hr/evaluations/:id", "hr_evaluations", "edit"],
    ["post", "/api/hr/evaluations/:id/approve", "hr_evaluations", "approve"],
    ["delete", "/api/hr/evaluations/:id", "hr_evaluations", "delete"],
  ])("wires %s %s to an explicit action and resolver", (method, path, module, action) => {
    expect(route(method, path).guard).toMatchObject({ module, action, resolver: expect.any(Function) });
  });

  it.each(["/api/hr/documents/stats", "/api/hr/evaluations"])(
    "%s takes collection candidates from stored branches, not query", async path => {
      state.rows = [{ id: "A" }, { id: "B" }];
      const context = await route("get", path).guard.resolver({ query: { branchId: "claimed" } });
      expect(context).toEqual({ kind: "collection", branchIds: ["A", "B"] });
      expect(chain.from).toHaveBeenCalledWith(branches);
    },
  );

  it.each([
    ["patch", "/api/hr/evaluations/:id"],
    ["post", "/api/hr/evaluations/:id/approve"],
    ["delete", "/api/hr/evaluations/:id"],
  ])("%s evaluation resolves historical branch, not employee or payload", async (method, path) => {
    state.rows = [{ branchId: "B" }];
    expect(await route(method, path).guard.resolver({
      params: { id: "42" }, query: { branchId: "A" }, body: { branchId: "A", branchEmployeeId: 123 },
    })).toEqual({ kind: "resource", branchId: "B" });
    expect(chain.from).toHaveBeenCalledWith(employeeEvaluations);
  });

  it("creation resolves employee branch and never takes claimed branch as authority", async () => {
    state.rows = [{ branchId: "B" }];
    expect(await route("post", "/api/hr/evaluations").guard.resolver({
      body: { branchEmployeeId: 123, branchId: "A" }, query: { branchId: "A" },
    })).toEqual({ kind: "resource", branchId: "B" });
    expect(chain.from).toHaveBeenCalledWith(branchEmployees);
  });

  it.each(["0", "-1", "42junk", "NaN", "9007199254740992"])(
    "invalid evaluation id %s cannot resolve to a claimed branch", async id => {
      const result = await route("patch", "/api/hr/evaluations/:id").guard.resolver({
        params: { id }, body: { branchId: "A" },
      });
      expect(result).toEqual({ kind: "resource", branchId: "__unresolved_hr_evaluation__" });
      expect(state.select).not.toHaveBeenCalled();
    },
  );

  it("missing evaluation remains unresolved rather than globally scoped", async () => {
    expect(await route("delete", "/api/hr/evaluations/:id").guard.resolver({
      params: { id: "42" }, query: { branchId: "A" },
    })).toEqual({ kind: "resource", branchId: "__unresolved_hr_evaluation__" });
  });

  it("stats passes actual authorized branches despite legacy cross-branch HR read elevation", async () => {
    const res: any = { json: vi.fn(), status: vi.fn(() => res) };
    await route("get", "/api/hr/documents/stats").handler({ method: "GET", query: {} }, res);
    expect(state.metadata).toHaveBeenCalledWith({
      branchIds: ["A"], activeOnly: true, includeArchived: false, pageSize: 1,
    });
    expect(res.json).toHaveBeenCalledWith({ total: 2 });
  });
});