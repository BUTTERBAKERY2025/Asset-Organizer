import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const runtime = vi.hoisted(() => ({ transaction: null as any, invalidate: vi.fn(), failSessions: false }));
vi.mock("../server/db", () => ({ db: { transaction: (...args: any[]) => runtime.transaction(...args) } }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  invalidateAuthCache: runtime.invalidate,
}));
vi.mock("../server/storage", () => ({
  storage: { invalidateAllUserSessions: vi.fn(async () => {
    if (runtime.failSessions) throw new Error("Synthetic invalidation failure");
  }) },
}));
vi.mock("bcrypt", () => ({ default: { hash: vi.fn(async () => "$2b$synthetic_test_hash") } }));
import { registerEmployeeAccountDelegation } from "../server/employee-account-delegation";

const routes: any[] = [];
const app: any = { use: vi.fn() };
for (const method of ["get", "post", "put", "patch"])
  app[method] = (path: string, ...handlers: any[]) => routes.push({ method, path, handlers });
registerEmployeeAccountDelegation(app);
const dialect = new PgDialect();
const perms = [{ module: "cashier_journal", actions: ["view", "create"] }];
let state: any;
let failAudit = false;
let lockStatements: string[] = [];
const base = "/api/operations/employee-accounts";

function txFor(data: any) {
  return {
    execute: async (query: any) => {
      const { sql, params } = dialect.sqlToQuery(query);
      if (sql.includes("LOCK TABLE")) lockStatements.push(sql);
      if (sql.includes("to_regclass")) return { rows: [{ ready: data.ready }] };
      if (sql.includes("SELECT id FROM public.job_permission_template_drafts")) return { rows: [{ id: 1 }] };
      if (sql.includes("ORDER BY v.version DESC")) return { rows: [{ version: data.version, content: data.content, approved: data.approved }] };
      if (sql.includes("DELETE FROM public.employee_job_template_assignments")) {
        data.assignment = null; return { rows: [] };
      }
      if (sql.includes("FROM public.employee_job_template_assignments")) return { rows: data.assignment ? [data.assignment] : [] };
      if (sql.includes("INSERT INTO public.employee_job_template_assignments")) {
        data.assignment = { templateId: params[2], version: params[3], branchId: params[4],
          revision: params[5], assignedAt: params[6], assignedBy: params[7], reason: params[8], userId: params[1] };
      }
      return { rows: [] };
    },
    select: () => {
      let name: string;
      let predicate: any;
      const builder: any = {
        from: (table: any) => { name = getTableName(table); return builder; },
        where: (value: any) => { predicate = value; return builder; },
        for: () => builder, limit: () => builder,
        then: (resolve: any, reject: any) => {
          const params = predicate ? dialect.sqlToQuery(predicate).params : [];
          const id = params[0];
          const rows = name === "users" ? data.users.filter((u: any) => u.id === id || u.username === id)
            : name === "branch_employees" ? [data.employee]
            : name === "branches" ? [{ name: "Synthetic branch" }]
            : name === "user_branch_access" ? [{ branchId: "A", accessLevel: data.access }]
            : name === "portal_settings" ? [{ value: JSON.stringify(String(id).includes(".manager.")
              ? { revision: "selection", selections: data.selected ? [{
                employeeId: 1, branchId: "A", linkedUserId: data.employee.linkedUserId,
              }] : [] } : { enabled: data.enabled, permissions: perms }) }]
            : name === "user_permissions" ? data.permissions
            : name === "user_permission_source_modes" ? data.source ? [{ mode: data.source }] : []
            : name === "user_assignments" ? data.roles ? [{ id: 1 }] : []
            : name === "user_permission_overrides" ? data.overrides ? [{ id: 1 }] : [] : [];
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return builder;
    },
    insert: (table: any) => {
      const name = getTableName(table);
      let values: any;
      const builder: any = {
        values: (v: any) => { values = v; return builder; },
        onConflictDoUpdate: () => builder,
        returning: () => builder,
        then: (resolve: any, reject: any) => Promise.resolve().then(() => {
          if (name === "system_audit_logs") {
            if (failAudit) throw new Error("Synthetic audit failure");
            data.audit.push(values);
          } else if (name === "user_permissions") data.permissions = values.map((p: any) => ({ module: p.module, actions: p.actions }));
          else if (name === "user_permission_source_modes") data.source = values.sourceMode;
          else if (name === "users") {
            const account = { ...values, id: "generated", updatedAt: null };
            data.users.push(account); return [account];
          }
          return [];
        }).then(resolve, reject),
      };
      return builder;
    },
    delete: (table: any) => ({ where: async () => {
      if (getTableName(table) === "user_permissions") data.permissions = [];
    } }),
    update: (table: any) => ({ set: (values: any) => ({ where: async () => {
      if (getTableName(table) === "branch_employees") Object.assign(data.employee, values);
    } }) }),
  };
}
async function invoke(method: string, suffix: string, body: any = {}, actor = "ops") {
  const req: any = { session: { userId: actor }, query: {}, params: { employeeId: "1" }, body };
  const res: any = { statusCode: 200, setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; } };
  const path = `${base}/:employeeId${suffix ? `/${suffix}` : ""}`;
  const handlers = routes.find(r => r.method === method && r.path === path).handlers;
  let index = 0;
  const next = async () => { if (handlers[index]) await handlers[index++](req, res, next); };
  await next();
  return res;
}
async function observed() {
  const response = await invoke("get", "template-assignment");
  expect(response.statusCode).toBe(200);
  return { templateId: 1, version: 1, branchId: "A", reason: "Reviewed",
    expectedAssignmentRevision: response.body.expectedAssignmentRevision };
}

beforeEach(() => {
  runtime.failSessions = false; runtime.invalidate.mockClear(); failAudit = false; lockStatements = [];
  state = { ready: true, enabled: true, selected: true, access: "full", roles: false, overrides: false,
    version: 1, approved: true, source: "direct", assignment: null, audit: [],
    content: { key: "synthetic", name: "Synthetic", description: "", reviewNotes: "",
      assignmentAuthority: "delegated_operations", scopeType: "branch", permissions: perms },
    employee: { id: 1, employeeName: "Synthetic", branchId: "A", linkedUserId: "worker", status: "active", jobTitle: null },
    users: [{ id: "ops", role: "operations_manager", branchId: "A", isActive: "active", jobTitle: null, updatedAt: null },
      { id: "worker", username: "synthetic", role: "employee", branchId: "A", isActive: "active", jobTitle: null, updatedAt: null }],
    permissions: [{ module: "cashier_journal", actions: ["view"] }],
  };
  runtime.transaction = async (work: any) => {
    const next = structuredClone(state);
    const result = await work(txFor(next));
    state = next; return result;
  };
});
describe("template assignment authoritative transaction (mocked IO)", () => {
  it.each(["full", "limited"])("preserves existing %s branch eligibility", async access => {
    state.access = access;
    const response = await invoke("post", "template-assignment", await observed());
    expect(response.statusCode).toBe(200);
    expect(response.body.assignment).toMatchObject({ templateId: 1, version: 1, branchId: "A" });
    expect(state.source).toBe("direct");
    expect(state.permissions[0].actions).toEqual(["create", "view"]);
    expect(state.audit.some((a: any) => a.action === "template_assignment_update")).toBe(true);
    expect(lockStatements.some(s => s.includes("user_permission_source_modes"))).toBe(true);
    expect(runtime.invalidate).toHaveBeenCalledWith("worker");
  });
  it("creates only a safe employee linked to persisted branch with one-show credentials", async () => {
    state.employee.linkedUserId = null; state.permissions = [];
    const response = await invoke("post", "template-account", await observed());
    expect(response.statusCode).toBe(201);
    expect(response.body.credentials.password).toHaveLength(12);
    expect(state.users.find((u: any) => u.id === "generated")).toMatchObject({
      role: "employee", branchId: "A", jobTitle: null, password: "$2b$synthetic_test_hash",
    });
    expect(state.employee.linkedUserId).toBe("generated");
    expect((await invoke("get", "template-assignment")).body.credentials).toBeUndefined();
  });
  it("rejects permission changes since preview even without metadata revision change", async () => {
    const input = await observed();
    state.permissions = [];
    const response = await invoke("post", "template-assignment", input);
    expect(response.statusCode).toBe(409);
    expect(response.body.code).toBe("ASSIGNMENT_REVISION_CONFLICT");
    expect(state.assignment).toBeNull();
  });
  it("rejects source-mode changes since preview", async () => {
    const input = await observed(); state.source = "inherit";
    const result = await invoke("post", "template-assignment", input);
    expect(result.statusCode).toBe(409);
    expect(result.body.code).toBe("ASSIGNMENT_REVISION_CONFLICT");
  });
  it("rejects stale assignment metadata even if permissions are unchanged", async () => {
    const input = await observed();
    expect((await invoke("post", "template-assignment", input)).statusCode).toBe(200);
    state.permissions = [{ module: "cashier_journal", actions: ["view"] }];
    expect((await invoke("post", "template-assignment", input)).body.code).toBe("ASSIGNMENT_REVISION_CONFLICT");
  });
  it("supports reviewed empty self assignments without restoring inheritance", async () => {
    const input = await observed();
    state.content = { ...state.content, scopeType: "self", permissions: [] };
    const result = await invoke("post", "template-assignment", input);
    expect(result.statusCode).toBe(200);
    expect(state.permissions).toEqual([]);
    expect(state.source).toBe("direct");
  });
  it("never changes a persisted employee branch to the submitted branch", async () => {
    const input = await observed();
    const before = structuredClone(state);
    const result = await invoke("post", "template-assignment", { ...input, branchId: "B" });
    expect(result.statusCode).toBe(403);
    expect(state).toEqual(before);
  });
  it("blocks creating a second account for a linked employee", async () => {
    const input = await observed();
    const before = structuredClone(state);
    expect((await invoke("post", "template-account", input)).statusCode).toBe(409);
    expect(state).toEqual(before);
  });
  it("requires creation endpoint for an unlinked employee", async () => {
    state.employee.linkedUserId = null; state.permissions = [];
    const input = await observed();
    expect((await invoke("post", "template-assignment", input)).body.code).toBe("ACCOUNT_NOT_LINKED");
  });
  it("rolls back generated account, link, permissions and metadata if creation audit fails", async () => {
    state.employee.linkedUserId = null; state.permissions = [];
    const input = await observed();
    const before = structuredClone(state); failAudit = true;
    const result = await invoke("post", "template-account", input);
    expect(result.statusCode).toBe(500);
    expect(result.body.credentials).toBeUndefined();
    expect(state).toEqual(before);
  });
  it("keeps privileged linked accounts protected", async () => {
    const input = await observed(); state.users[1].role = "admin";
    const before = structuredClone(state);
    expect((await invoke("post", "template-assignment", input)).body.code).toBe("PROTECTED_ACCOUNT");
    expect(state).toEqual(before);
  });
  it.each(["roles", "overrides"])("preserves independent %s rather than deleting them", async key => {
    const input = await observed(); state[key] = true;
    const before = structuredClone(state);
    expect((await invoke("post", "template-assignment", input)).statusCode).toBe(403);
    expect(state).toEqual(before);
  });
  it.each(["audit", "sessions"])("rolls back all writes on %s failure", async failure => {
    const input = await observed();
    if (failure === "audit") failAudit = true; else runtime.failSessions = true;
    const before = structuredClone(state);
    expect((await invoke("post", "template-assignment", input)).statusCode).toBe(500);
    expect(state).toEqual(before);
    expect(runtime.invalidate).not.toHaveBeenCalled();
  });
  it.each(["selection", "branch", "inactive", "disabled"])("revalidates %s under transaction lock", async change => {
    const input = await observed();
    if (change === "selection") state.selected = false;
    if (change === "branch") state.employee.branchId = "B";
    if (change === "inactive") state.employee.status = "inactive";
    if (change === "disabled") state.enabled = false;
    const before = structuredClone(state);
    expect((await invoke("post", "template-assignment", input)).statusCode).toBe(403);
    expect(state).toEqual(before);
  });
  it.each(["version", "approval"])("rejects latest %s changes after preview", async change => {
    const input = await observed();
    if (change === "version") state.version = 2; else state.approved = false;
    expect((await invoke("post", "template-assignment", input)).statusCode).toBe(409);
    expect(state.assignment).toBeNull();
  });
  it("returns explicit migration readiness failure", async () => {
    state.ready = false;
    const result = await invoke("get", "template-assignment");
    expect(result.statusCode).toBe(503);
    expect(result.body.code).toBe("migration_required");
  });
});

describe("legacy ops paths cannot bypass approved-template grants", () => {
  async function bind() {
    expect((await invoke("post", "template-assignment", await observed())).statusCode).toBe(200);
  }
  it.each([true, false])("blocks raw creation for ops regardless of enabled policy (%s)", async enabled => {
    state.employee.linkedUserId = null; state.permissions = []; state.enabled = enabled;
    const before = structuredClone(state);
    const result = await invoke("post", "", { permissions: perms });
    expect(result.statusCode).toBe(403);
    expect(result.body.code).toBe("APPROVED_TEMPLATE_REQUIRED");
    expect(state).toEqual(before);
  });
  it.each([true, false])("blocks raw additions to %s bound accounts even under enabled policy", async bound => {
    if (bound) await bind();
    state.permissions = [{ module: "cashier_journal", actions: ["view"] }];
    const before = structuredClone(state);
    const result = await invoke("put", "permissions", { permissions: perms });
    expect(result.statusCode).toBe(403);
    expect(result.body.code).toBe("REDUCTION_ONLY");
    expect(state).toEqual(before);
  });
  it.each([true, false])("allows real subset reduction with enabled policy %s and detaches bound metadata", async enabled => {
    await bind();
    const binding = structuredClone(state.assignment); state.enabled = enabled;
    const result = await invoke("put", "permissions", { permissions: [{ module: "cashier_journal", actions: ["view"] }] });
    expect(result.statusCode).toBe(200);
    expect(state.assignment).toBeNull();
    expect(state.permissions).toEqual([{ module: "cashier_journal", actions: ["view"] }]);
    const details = JSON.parse(state.audit.at(-1).details);
    expect(details.reason).toBe("خفض صلاحيات عبر مسار الصيانة القديم");
    expect(details.removedTemplateBinding).toMatchObject({ revision: binding.revision, templateId: 1, version: 1 });
  });
  it("does not detach a binding on a permission-set equality maintenance write", async () => {
    await bind();
    const binding = structuredClone(state.assignment);
    expect((await invoke("put", "permissions", { permissions: perms })).statusCode).toBe(200);
    expect(state.assignment).toEqual(binding);
  });
  it("does not resurrect dormant direct rows when source mode is inherit", async () => {
    state.source = "inherit"; state.permissions = structuredClone(perms);
    const before = structuredClone(state);
    expect((await invoke("put", "permissions", { permissions: perms })).body.code).toBe("REDUCTION_ONLY");
    expect(state).toEqual(before);
    expect((await invoke("put", "permissions", { permissions: [] })).statusCode).toBe(200);
    expect(state.source).toBe("direct"); expect(state.permissions).toEqual([]);
  });
  it("retains intrinsic delivery actions when direct rows are dormant", async () => {
    state.users[1].jobTitle = "delivery"; state.source = "inherit"; state.permissions = [];
    // Policy vocabulary in this mock is cashier only; empty reductions still
    // reach the intrinsic safeguard rather than silently removing driver access.
    const result = await invoke("put", "permissions", { permissions: [] });
    expect(result.statusCode).toBe(403); expect(result.body.code).toBe("INTRINSIC_AUTHORITY");
  });
  it("does not treat viewer's unusable edit/create rows as an effective base grant", async () => {
    state.users[1].role = "viewer"; state.permissions = structuredClone(perms);
    const result = await invoke("put", "permissions", { permissions: perms });
    expect(result.statusCode).toBe(403); expect(result.body.code).toBe("REDUCTION_ONLY");
  });
  it("keeps pre-053 safety reductions available without silently converting accounts", async () => {
    state.ready = false; state.permissions = structuredClone(perms);
    expect((await invoke("put", "permissions", { permissions: [] })).statusCode).toBe(200);
    expect(state.assignment).toBeNull();
  });
  it.each(["audit", "sessions"])("rolls back binding detachment with %s failure", async failure => {
    await bind();
    const before = structuredClone(state);
    if (failure === "audit") failAudit = true; else runtime.failSessions = true;
    const result = await invoke("put", "permissions", { permissions: [] });
    expect(result.statusCode).toBe(500); expect(state).toEqual(before);
  });
  it("preserves admin raw-create authority without requiring any template", async () => {
    state.users[0].role = "admin"; state.employee.linkedUserId = null; state.permissions = [];
    expect((await invoke("post", "", { permissions: perms })).statusCode).toBe(201);
    expect(state.assignment).toBeNull();
  });
  it("preserves admin raw permission grants and existing metadata behavior", async () => {
    await bind(); const binding = structuredClone(state.assignment);
    state.users[0].role = "admin"; state.permissions = [{ module: "cashier_journal", actions: ["view"] }];
    expect((await invoke("put", "permissions", { permissions: perms })).statusCode).toBe(200);
    expect(state.assignment).toEqual(binding);
    expect(JSON.parse(state.audit.at(-1).details)).not.toHaveProperty("removedTemplateBinding");
  });
});