import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { normalizePermissionDecisionSnapshot } from "../server/permission-decision";
const state = vi.hoisted(() => ({ invalidate: vi.fn() }));
vi.mock("../server/auth", () => ({ isAuthenticated: (_q: any, _s: any, n: any) => n(), invalidateAuthCache: vi.fn() }));
vi.mock("../server/storage", () => ({ storage: {
  getPermissionDecisionSnapshot: async () => ({ userId: "target", sourceMode: "direct", resolvedSourceMode: "direct",
    capturedAt: Date.now(), directPermissions: [{ module: "cashier_journal", actions: ["view", "create"] }],
    tuples: [{ module: "cashier_journal", action: "view", scopeType: "global", branchId: null, departmentId: null,
      startDate: null, endDate: null, expiresAt: null, isActive: true, deny: false, source: "direct" }] }),
  invalidateAllUserSessions: state.invalidate,
} }));
import { registerBranchTemplateRoutes } from "../server/branch-template-routes";

describe("branch template API boundaries", () => {
  let handlers: any, grants: string[], role: string, ready: boolean, enabled: boolean, writes: string[];
  const dialect = new PgDialect();
  beforeEach(() => {
    handlers = {}; grants = ["a"]; role = "employee"; ready = true; enabled = true; writes = [];
    state.invalidate.mockReset();
    const tx = { execute: async (query: any) => {
      const { sql } = dialect.sqlToQuery(query);
      if (sql.includes("to_regclass")) return { rows: [{ ready }] };
      if (sql.includes("SELECT e.id")) return { rows: [{ id: 1, employee_name: "Fixture", branch_id: "a",
        status: "active", linked_user_id: "target", role, is_active: "inactive", job_title: null }] };
      if (sql.includes("count(*)")) return { rows: [{ count: 1 }] };
      if (sql.includes('revision::text')) return { rows: [] };
      if (sql.includes("SELECT v.template_id")) return { rows: [{ templateId: 1, version: 1, content: {
        key: "fixture", name: "Fixture", description: "", reviewNotes: "", scopeType: "branch",
        assignmentAuthority: "delegated_operations", permissions: [{ module: "cashier_journal", actions: ["view"] }],
      } }] };
      writes.push(sql); return { rows: [] };
    } };
    const endpoint = (fn: any) => async (req: any, res: any) => {
      try { await fn(req, res); } catch (e: any) { res.status(e.status ?? 500).json({ code: e.code, message: e.message }); }
    };
    registerBranchTemplateRoutes({
      get: (path: string, _auth: any, h: any) => { handlers.get = h; },
      post: (path: string, _auth: any, h: any) => { handlers.post = h; },
    }, { db: { transaction: (fn: any) => fn(tx) }, endpoint, lockDelegationState: async () => {},
      actorState: async () => ({ actor: { id: "manager", role: "operations_manager" }, grants }),
      policy: async () => ({ enabled, permissions: [] }),
    });
  });
  async function invoke(method: string, body = {}) {
    let status = 200, data: any;
    const res: any = { status: (s: number) => { status = s; return res; }, set: () => res, json: (d: any) => { data = d; } };
    await handlers[method]({ session: { userId: "manager" }, params: { employeeId: "1" }, body }, res);
    return { status, data };
  }
  it("previews branch-only authority without whole-account eligibility and preserves frozen state", async () => {
    const result = await invoke("get");
    expect(result.status).toBe(200);
    expect(result.data.branchId).toBe("a");
    expect(result.data.isActive).toBe("inactive");
    expect(result.data.templates).toHaveLength(1);
    expect(writes).toEqual([]);
  });
  it("writes only branch assignment/audit and revokes sessions; never replaces account-wide grants", async () => {
    const first = await invoke("get");
    const result = await invoke("post", { templateId: 1, version: 1, branchId: "a", reason: "Review",
      expectedAssignmentRevision: first.data.expectedAssignmentRevision });
    expect(result.status).toBe(200);
    expect(writes.filter(q => q.includes("INSERT"))).toHaveLength(2);
    expect(writes.join("\n")).not.toMatch(/DELETE|UPDATE users|UPDATE user_permissions/);
    expect(state.invalidate).toHaveBeenCalledWith("target", expect.anything());
  });
  it("rechecks branch withdrawal during apply", async () => {
    const first = await invoke("get"); grants = ["b"];
    const result = await invoke("post", { templateId: 1, version: 1, branchId: "a", reason: "Review",
      expectedAssignmentRevision: first.data.expectedAssignmentRevision });
    expect(result.status).toBe(403);
    expect(writes.some(q => q.includes("INSERT"))).toBe(false);
  });
  it("rejects foreign branch, stale review, protected roles, disabled policy and missing migration", async () => {
    const first = await invoke("get");
    const body = { templateId: 1, version: 1, branchId: "b", reason: "Review", expectedAssignmentRevision: first.data.expectedAssignmentRevision };
    expect((await invoke("post", body)).status).toBe(403);
    expect((await invoke("post", { ...body, branchId: "a", expectedAssignmentRevision: "0".repeat(64) })).status).toBe(409);
    role = "admin"; expect((await invoke("get")).status).toBe(403);
    role = "employee"; enabled = false; expect((await invoke("get")).status).toBe(403);
    enabled = true; ready = false; expect((await invoke("get")).status).toBe(503);
  });
});