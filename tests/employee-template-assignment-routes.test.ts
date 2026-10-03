import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { additionFingerprint } from "../server/employee-account-additions-policy";
import { normalizePermissionDecisionSnapshot, checkPermissionDecision, hasPermissionDecisionDeny } from "../server/permission-decision";

const runtime = vi.hoisted(() => ({ transaction: null as any, invalidate: vi.fn(), failSessions: false }));
vi.mock("../server/db", () => ({ db: { transaction: (...args: any[]) => runtime.transaction(...args) } }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  invalidateAuthCache: runtime.invalidate,
  intrinsicPermissionGranted: (user: any, _snapshot: any, module: string, action: string) =>
    user.role === "employee" && user.jobTitle === "delivery" && module === "delivery_tasks" && ["view", "edit"].includes(action),
  contextualActionAllowed: (req: any, snapshot: any, module: string, action: string, context: any) =>
    !(req.currentUser.role === "viewer" && action !== "view")
    && !hasPermissionDecisionDeny(snapshot, module, action, context)
    && (checkPermissionDecision(snapshot, module, action, context)
      || (req.currentUser.role === "employee" && req.currentUser.jobTitle === "delivery"
        && module === "delivery_tasks" && ["view", "edit"].includes(action))),
}));
vi.mock("../server/storage", () => ({
  storage: { invalidateAllUserSessions: vi.fn(async () => {
    if (runtime.failSessions) throw new Error("Synthetic invalidation failure");
  }), getPermissionDecisionSnapshot: async (userId: string, executor: any) => {
    expect(executor).toBeTruthy();
    return normalizePermissionDecisionSnapshot({
      userId, sourceMode: state.source, direct: state.permissions, roles: [],
      overrides: state.extraRows.map((row: any) => {
        const permission = state.catalog.find((p: any) => p.id === row.permissionId);
        return { ...permission, permissionId: row.permissionId, allow: row.allow,
          branchId: row.branchId, departmentId: row.departmentId, startDate: row.startsAt, expiresAt: row.expiresAt };
      }),
    });
  } },
}));
vi.mock("bcrypt", () => ({ default: { hash: vi.fn(async () => "$2b$synthetic_test_hash") } }));
import { registerEmployeeAccountDelegation } from "../server/employee-account-delegation";

const routes: any[] = [];
const app: any = { use: vi.fn() };
for (const method of ["get", "post", "put", "patch", "delete"])
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
      if (sql.includes("to_regclass('public.employee_account_additions')")) return { rows: [{ ready: data.additionsReady }] };
      if (sql.includes("to_regclass")) return { rows: [{ ready: data.ready }] };
      if (sql.includes("SELECT m.override_id")) {
        const rows = data.additionMetadata.flatMap((meta: any) => {
          const row = data.extraRows.find((o: any) => o.id === meta.id);
          const permission = row && data.catalog.find((p: any) => p.id === row.permissionId);
          if (!row || !permission || !params.includes(row.userId)) return [];
          return [{ ...meta, overrideUserId: row.userId, permissionId: row.permissionId,
            module: permission.module, action: permission.action, allow: row.allow,
            branchId: row.branchId, departmentId: row.departmentId, startsAt: row.startsAt,
            endsAt: row.expiresAt, reason: row.reason, grantedBy: row.grantedBy,
            overrideCreatedAt: row.createdAt, overrideUpdatedAt: row.updatedAt }];
        });
        return { rows };
      }
      if (sql.includes("INSERT INTO public.employee_account_additions")) {
        const meta = { id: params[0], employeeId: params[1], userId: params[2], employeeBranchId: params[3],
          revision: params[4], snapshot: JSON.parse(params[5]), createdBy: params[6],
          createdAt: params[7], updatedAt: params[8] };
        data.additionMetadata = data.additionMetadata.filter((m: any) => m.id !== meta.id).concat(meta);
      }
      if (sql.includes("DELETE FROM public.employee_account_additions")) {
        data.additionMetadata = data.additionMetadata.filter((m: any) => m.id !== params[0]);
      }
      if (sql.includes("SELECT id FROM public.job_permission_template_drafts")) return { rows: [{ id: 1 }] };
      if (sql.includes("ORDER BY v.version DESC")) return { rows: [{ version: data.version, content: data.content, approved: data.approved }] };
      if (sql.includes("DELETE FROM public.employee_job_template_assignments")) {
        data.assignment = null; return { rows: [] };
      }
      if (sql.includes("SELECT b.user_id")) {
        const user = data.users.find((u: any) => u.id === data.assignment?.userId);
        return { rows: data.assignment && user && data.source === "direct"
          ? [{ userId: user.id, employeeId: data.employee.id, branchId: data.assignment.branchId,
            role: user.role, jobTitle: user.jobTitle, content: data.assignmentContent ?? data.content }]
          : [] };
      }
      if (sql.includes("FROM public.employee_job_template_assignments")) return { rows: data.assignment ? [data.assignment] : [] };
      if (sql.includes("INSERT INTO public.employee_job_template_assignments")) {
        data.assignmentContent = structuredClone(data.content);
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
        for: () => builder, limit: () => builder, orderBy: () => builder,
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
            : name === "user_permission_overrides" ? [
              ...(data.overrides ? [{ id: 1 }] : []), ...data.extraRows.map((row: any) => ({ id: row.id })),
            ]
            : name === "permissions" ? data.catalog.filter((p: any) => p.module === id && p.action === params[1]) : [];
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
          } else if (name === "permissions") {
            const row = { id: 100 + data.catalog.length, ...values };
            data.catalog.push(row); return [row];
          } else if (name === "user_permission_overrides") {
            const row = { id: 1000 + data.extraRows.length, createdAt: new Date(), ...values };
            data.extraRows.push(row); return [row];
          }
          return [];
        }).then(resolve, reject),
      };
      return builder;
    },
    delete: (table: any) => ({ where: async (predicate: any) => {
      if (getTableName(table) === "user_permissions") data.permissions = [];
      if (getTableName(table) === "user_permission_overrides") {
        const params = dialect.sqlToQuery(predicate).params;
        data.extraRows = data.extraRows.filter((row: any) => !(row.id === params[0] && row.userId === params[1]));
      }
    } }),
    update: (table: any) => ({ set: (values: any) => ({ where: (predicate: any) => {
      const run = () => {
        if (getTableName(table) === "branch_employees") { Object.assign(data.employee, values); return []; }
        const params = dialect.sqlToQuery(predicate).params;
        const row = data.extraRows.find((o: any) => o.id === params[0] && o.userId === params[1]);
        if (row) Object.assign(row, values);
        return row ? [row] : [];
      };
      return { returning: async () => run(), then: (resolve: any, reject: any) => Promise.resolve().then(run).then(resolve, reject) };
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
    additionsReady: true, additionMetadata: [], extraRows: [], catalog: [],
    version: 1, approved: true, source: "direct", assignment: null, audit: [],
    content: { key: "synthetic", name: "Synthetic", description: "", reviewNotes: "",
      assignmentAuthority: "delegated_operations", scopeType: "branch", permissions: perms },
    employee: { id: 1, employeeName: "Synthetic", branchId: "A", linkedUserId: "worker", status: "active", jobTitle: null },
    users: [{ id: "ops", role: "operations_manager", branchId: "A", isActive: "active", jobTitle: null, updatedAt: null },
      { id: "worker", username: "synthetic", role: "employee", branchId: "A", isActive: "active", jobTitle: null, updatedAt: null },
      { id: "admin", role: "admin", branchId: null, isActive: "active", jobTitle: null, updatedAt: null }],
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
    expect((await invoke("post", "template-assignment", input)).body.code).toBe("TEMPLATE_BASE_DRIFT");
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
  it("does not let obsolete named selections withhold authorized branch employees", async () => {
    const input = await observed();
    state.selected = false;
    expect((await invoke("post", "template-assignment", input)).statusCode).toBe(200);
  });
  it.each(["branch", "inactive", "disabled"])("revalidates %s under transaction lock", async change => {
    const input = await observed();
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
    expect(result.body.code).toBe(bound ? "TEMPLATE_BASE_DRIFT" : "REDUCTION_ONLY");
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

async function invokeAddition(method: string, body: any = {}, id?: number, actor = "admin") {
  const req: any = { session: { userId: actor }, query: {},
    params: { employeeId: "1", ...(id === undefined ? {} : { id: String(id) }) }, body };
  const res: any = { statusCode: 200, setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; } };
  const path = `/api/admin/employee-account-additions/:employeeId${id === undefined ? "" : "/:id"}`;
  const handlers = routes.find(r => r.method === method && r.path === path).handlers;
  let index = 0;
  const next = async () => { if (handlers[index]) await handlers[index++](req, res, next); };
  await next();
  return res;
}
const additionBody = { module: "cashier_journal", action: "create", allow: true,
  scopeType: "global", branchId: null, startsAt: null, endsAt: null, reason: "Explicit independent global addition" };
async function createAddition(body = additionBody) {
  const result = await invokeAddition("post", body);
  expect(result.statusCode).toBe(201);
  return result.body.addition;
}
describe("admin addition CRUD and protected-base integration (actual route/mock IO)", () => {
  it.each(["get", "post", "patch", "delete"])("requires actual admin for %s additions", async method => {
    const row = await createAddition();
    const body = method === "delete" ? { reason: "Removal", expectedRevision: row.revision }
      : method === "patch" ? { ...additionBody, expectedRevision: row.revision } : additionBody;
    const result = await invokeAddition(method, body, ["patch", "delete"].includes(method) ? row.id : undefined, "ops");
    expect(result.statusCode).toBe(403); expect(result.body.code).toBe("DELEGATION_FORBIDDEN");
  });
  it("creates only override+provenance and leaves direct base/source/employee/account intact", async () => {
    const original = { permissions: structuredClone(state.permissions), source: state.source,
      employee: structuredClone(state.employee), users: structuredClone(state.users) };
    const addition = await createAddition();
    expect(addition.integrity).toBe("managed");
    expect(addition.scopeType).toBe("global");
    expect(state.permissions).toEqual(original.permissions);
    expect(state.source).toBe(original.source);
    expect(state.employee).toEqual(original.employee);
    expect(state.users).toEqual(original.users);
    expect((await invokeAddition("get")).body.additions).toEqual([addition]);
    expect(state.audit.at(-1).action).toBe("addition_create");
  });
  it("exposes safe managed additions READ ONLY in manager snapshot, separate from base", async () => {
    const addition = await createAddition();
    const preview = await invoke("get", "template-assignment");
    expect(preview.statusCode).toBe(200);
    expect(preview.body.currentPermissions).toEqual([{ module: "cashier_journal", actions: ["view"] }]);
    expect(preview.body.additions).toEqual([addition]);
    expect(preview.body.additions[0]).not.toHaveProperty("snapshot");
    expect(preview.body.additions[0]).not.toHaveProperty("password");
  });
  it("preserves independent extras/denies/time bounds during explicit base replacement", async () => {
    await createAddition({ ...additionBody, allow: false, startsAt: "2026-10-01T00:00:00Z", endsAt: "2099-01-01T00:00:00Z" });
    const input = await observed();
    state.content = { ...state.content, scopeType: "self", permissions: [] };
    const extras = structuredClone(state.extraRows);
    const metadata = structuredClone(state.additionMetadata);
    expect((await invoke("post", "template-assignment", input)).statusCode).toBe(200);
    expect(state.permissions).toEqual([]);
    expect(state.extraRows).toEqual(extras); expect(state.additionMetadata).toEqual(metadata);
  });
  it("does not move effective extra grants into the ops-owned direct base", async () => {
    await createAddition();
    const result = await invoke("put", "permissions", { permissions: perms });
    expect(result.statusCode).toBe(403); expect(result.body.code).toBe("REDUCTION_ONLY");
  });
  it("invalidates template confirmation on independent addition creation/update/deletion", async () => {
    const beforeCreate = await observed();
    const added = await createAddition();
    expect((await invoke("post", "template-assignment", beforeCreate)).body.code).toBe("ASSIGNMENT_REVISION_CONFLICT");
    const beforeUpdate = await observed();
    const updated = await invokeAddition("patch", { ...additionBody, allow: false,
      startsAt: "2099-01-01T00:00:00Z", expectedRevision: added.revision }, added.id);
    expect(updated.statusCode).toBe(200);
    expect((await invoke("post", "template-assignment", beforeUpdate)).body.code).toBe("ASSIGNMENT_REVISION_CONFLICT");
    const beforeDelete = await observed();
    expect((await invokeAddition("delete", { reason: "Explicit removal",
      expectedRevision: updated.body.addition.revision }, added.id)).statusCode).toBe(200);
    expect((await invoke("post", "template-assignment", beforeDelete)).body.code).toBe("ASSIGNMENT_REVISION_CONFLICT");
  });
  it("deletes only owned managed override and preserves independent legacy overrides", async () => {
    const added = await createAddition(); state.overrides = true;
    expect((await invokeAddition("delete", { reason: "Remove managed addition", expectedRevision: added.revision }, added.id)).statusCode).toBe(200);
    expect(state.overrides).toBe(true); expect(state.extraRows).toEqual([]); expect(state.additionMetadata).toEqual([]);
    expect(state.permissions).toEqual([{ module: "cashier_journal", actions: ["view"] }]);
    expect((await invokeAddition("delete", { reason: "Cannot adopt legacy", expectedRevision: added.revision }, 1)).statusCode).toBe(404);
  });
  it.each(["employee", "user", "link"])("rejects CRUD ownership mismatch in %s", async mismatch => {
    const added = await createAddition();
    if (mismatch === "employee") state.additionMetadata[0].employeeId = 2;
    if (mismatch === "user") state.additionMetadata[0].userId = "other";
    if (mismatch === "link") {
      state.users.push({ ...state.users[1], id: "other" }); state.employee.linkedUserId = "other";
    }
    const before = structuredClone(state);
    expect((await invokeAddition("delete", { reason: "Removal", expectedRevision: added.revision }, added.id)).body.code).toBe("ADDITION_NOT_FOUND");
    expect(state).toEqual(before);
  });
  it("detects stale managed revision on PATCH and DELETE", async () => {
    const added = await createAddition();
    const update = await invokeAddition("patch", { ...additionBody, allow: false, expectedRevision: added.revision }, added.id);
    expect(update.statusCode).toBe(200);
    const before = structuredClone(state);
    expect((await invokeAddition("patch", { ...additionBody, expectedRevision: added.revision }, added.id)).body.code).toBe("ADDITION_REVISION_CONFLICT");
    expect((await invokeAddition("delete", { reason: "Removal", expectedRevision: added.revision }, added.id)).body.code).toBe("ADDITION_REVISION_CONFLICT");
    expect(state).toEqual(before);
  });
  it.each([true, false])("keeps privileged managed extras protected (allow=%s) without restricting admin CRUD", async allow => {
    const added = await createAddition({ ...additionBody, module: "users", action: "view", allow });
    expect((await invoke("get", "template-assignment")).statusCode).toBe(403);
    expect((await invokeAddition("get")).body.additions[0].id).toBe(added.id);
    expect((await invokeAddition("delete", { reason: "Remove privileged extra", expectedRevision: added.revision }, added.id)).statusCode).toBe(200);
  });
  it("keeps modified formerly-managed rows protected until explicit admin repair", async () => {
    const added = await createAddition();
    state.extraRows[0].allow = false;
    expect((await invoke("get", "template-assignment")).statusCode).toBe(403);
    expect((await invokeAddition("get")).body.additions[0].integrity).toBe("changed");
    expect((await invokeAddition("patch", { ...additionBody, expectedRevision: added.revision }, added.id)).statusCode).toBe(200);
    expect((await invoke("get", "template-assignment")).statusCode).toBe(200);
  });
  it("metadata unavailable cannot classify extras as safe; no-extra ops accounts stay manageable", async () => {
    const addition = await createAddition(); state.additionsReady = false;
    expect((await invoke("get", "template-assignment")).statusCode).toBe(403);
    expect((await invokeAddition("get")).body.code).toBe("migration_required");
    state.extraRows = []; state.additionMetadata = [];
    expect((await invoke("get", "template-assignment")).statusCode).toBe(200);
    expect(addition.id).toBeTruthy();
  });
  it.each(["create", "update", "delete"])("rolls back %s addition on audit failure", async mode => {
    const row = mode === "create" ? null : await createAddition();
    const before = structuredClone(state); failAudit = true;
    const body = mode === "delete" ? { reason: "Removal", expectedRevision: row.revision }
      : mode === "update" ? { ...additionBody, allow: false, expectedRevision: row.revision } : additionBody;
    expect((await invokeAddition(mode === "create" ? "post" : mode === "update" ? "patch" : "delete",
      body, row?.id)).statusCode).toBe(500);
    expect(state).toEqual(before);
  });
  it("rolls back all addition/catalog/provenance writes on session invalidation failure", async () => {
    const before = structuredClone(state); runtime.failSessions = true;
    expect((await invokeAddition("post", additionBody)).statusCode).toBe(500);
    expect(state).toEqual(before);
  });
  it("rejects branch-scoped operational additions but allows only proved HR scopes on employee branch", async () => {
    expect((await invokeAddition("post", { ...additionBody, scopeType: "branch", branchId: "A" })).body.code).toBe("UNSUPPORTED_ADDITION_SCOPE");
    expect((await invokeAddition("post", { ...additionBody, module: "hr_documents", action: "view",
      scopeType: "branch", branchId: "B" })).body.code).toBe("BRANCH_FORBIDDEN");
    await createAddition({ ...additionBody, module: "hr_documents", action: "view", scopeType: "branch", branchId: "A" });
    expect((await invoke("get", "template-assignment")).statusCode).toBe(403);
  });
});
async function invokePilot(method = "get", body: any = {}, actor = "admin") {
  const req: any = { session: { userId: actor }, query: { templateId: "1", version: "1" },
    params: { employeeId: "1" }, body };
  const res: any = { statusCode: 200, setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; } };
  const handlers = routes.find(r => r.method === method && r.path === "/api/admin/employee-template-pilot/:employeeId").handlers;
  let index = 0;
  const next = async () => { if (handlers[index]) await handlers[index++](req, res, next); };
  await next(); return res;
}
async function pilotConfirmation() {
  const preview = await invokePilot();
  expect(preview.statusCode).toBe(200);
  return { templateId: 1, version: 1, branchId: "A", reason: "Explicit bounded pilot",
    expectedComparisonRevision: preview.body.expectedComparisonRevision, acknowledgeChanges: true };
}
describe("phase6 actual admin comparison/application routes with strict offline IO", () => {
  it("compares the full cashier journal template without mutating accounts, then applies only on confirmation", async () => {
    state.content.permissions = [{ module: "cashier_journal", actions: ["view", "create", "edit", "submit", "sign", "print", "export", "view_list", "view_details", "view_signatures"] }];
    const original = structuredClone(state);
    const preview = await invokePilot();
    expect(preview.statusCode).toBe(200);
    expect(preview.body.canApply).toBe(true);
    expect(preview.body.comparisonStatus).toBe("known");
    expect(preview.body.blockedReasons).toEqual([]);
    expect(preview.body.differences.additions).toEqual([{ module: "cashier_journal", actions: ["create", "edit", "export", "print", "sign", "submit", "view_details", "view_list", "view_signatures"] }]);
    expect(state).toEqual(original);
    expect(runtime.invalidate).not.toHaveBeenCalled();
    const applied = await invokePilot("post", {
      templateId: 1, version: 1, branchId: "A", reason: "Offline submit compatibility test",
      expectedComparisonRevision: preview.body.expectedComparisonRevision, acknowledgeChanges: true,
    });
    expect(applied.statusCode).toBe(200);
    expect(state.permissions).toEqual([{ module: "cashier_journal", actions: ["create", "edit", "export", "print", "sign", "submit", "view", "view_details", "view_list", "view_signatures"] }]);
  });
  it("reports the explicit compatibility blocker for submit without create and never changes the account", async () => {
    state.content.permissions = [{ module: "cashier_journal", actions: ["view", "submit"] }];
    const original = structuredClone(state);
    const preview = await invokePilot();
    expect(preview.body.canApply).toBe(false);
    expect(preview.body.blockedReasons.some((reason: any) => reason.code === "JOURNAL_SUBMIT_REQUIRES_CREATE")).toBe(true);
    expect(state).toEqual(original);
  });
  it("compares readonly actual before/after, with contextual source evidence", async () => {
    const original = structuredClone(state);
    const preview = await invokePilot();
    expect(preview.statusCode).toBe(200);
    expect(preview.body.canApply).toBe(true);
    expect(preview.body.scope.branchId).toBe("A");
    expect(preview.body.differences.additions).toEqual([{ module: "cashier_journal", actions: ["create"] }]);
    expect(state).toEqual(original);
    expect(runtime.invalidate).not.toHaveBeenCalled();
  });
  it.each(["get", "post"])("requires actual admin for %s pilot", async method => {
    const body = await pilotConfirmation();
    expect((await invokePilot(method, body, "ops")).statusCode).toBe(403);
  });
  it("shares phase4 base/assignment transaction and writes distinct reviewed evidence", async () => {
    const body = await pilotConfirmation();
    const applied = await invokePilot("post", body);
    expect(applied.statusCode).toBe(200);
    expect(state.permissions).toEqual([{ module: "cashier_journal", actions: ["create", "view"] }]);
    expect(state.audit.map((row: any) => row.action)).toEqual(["permissions_update", "template_assignment_update", "pilot_apply"]);
    const evidence = JSON.parse(state.audit.at(-1).details);
    expect(evidence.before.sources).toHaveLength(1);
    expect(evidence.after.effectivePermissions).toEqual([{ module: "cashier_journal", actions: ["create", "view"] }]);
    expect(evidence.reason).toBe(body.reason);
    expect(lockStatements.some(s => s.includes("user_permission_source_modes"))).toBe(true);
  });
  it("preserves independent deny/extras in both prediction and actual application", async () => {
    await createAddition({ ...additionBody, action: "view", allow: false });
    const body = await pilotConfirmation();
    const extra = structuredClone(state.extraRows), metadata = structuredClone(state.additionMetadata);
    const result = await invokePilot("post", body);
    expect(result.statusCode).toBe(200);
    expect(result.body.comparison.before.effectivePermissions).toEqual([]);
    expect(result.body.comparison.after.effectivePermissions).toEqual([{ module: "cashier_journal", actions: ["create"] }]);
    expect(result.body.comparison.differences.retainedDenies).toHaveLength(1);
    expect(state.extraRows).toEqual(extra); expect(state.additionMetadata).toEqual(metadata);
  });
  it("keeps delivery intrinsic authority separate from an explicitly empty stored base", async () => {
    state.permissions = [];
    state.users[1].jobTitle = "delivery";
    const preview = await invokePilot();
    expect(preview.body.currentBase).toEqual([]);
    expect(preview.body.before.effectivePermissions).toEqual([{ module: "delivery_tasks", actions: ["edit", "view"] }]);
    expect(preview.body.before.sources.filter((s: any) => s.source === "intrinsic")).toHaveLength(2);
    expect(preview.body.blockedReasons.some((b: any) => b.code === "INTRINSIC_AUTHORITY")).toBe(true);
    expect(preview.body.after).toBeNull();
  });
  it.each(["roles", "overrides", "privilege", "branch", "job", "inactive", "unlinked"])(
    "reports exact blocked/unknown comparison for %s and never applies", async kind => {
      if (kind === "roles") state.roles = true;
      if (kind === "overrides") state.overrides = true;
      if (kind === "privilege") state.users[1].role = "admin";
      if (kind === "branch") state.users[1].branchId = "B";
      if (kind === "job") state.users[1].jobTitle = "delivery";
      if (kind === "inactive") state.users[1].isActive = "inactive";
      if (kind === "unlinked") state.employee.linkedUserId = null;
      const original = structuredClone(state);
      const preview = await invokePilot();
      expect(preview.statusCode).toBe(200);
      expect(preview.body.canApply).toBe(false);
      expect(preview.body.comparisonStatus).toBe("unknown");
      expect(preview.body.after).toBeNull(); expect(preview.body.differences).toBeNull();
      expect(preview.body.blockedReasons.length).toBeGreaterThan(0);
      expect((await invokePilot("post", { templateId: 1, version: 1, branchId: "A", reason: "Cannot bypass",
        acknowledgeChanges: true, expectedComparisonRevision: preview.body.expectedComparisonRevision })).body.code).toBe("PILOT_BLOCKED");
      expect(state).toEqual(original);
    });
  it.each(["permissions", "policy", "template", "account", "extras"])("rejects changed %s confirmation atomically", async kind => {
    const body = await pilotConfirmation();
    if (kind === "permissions") state.permissions = [];
    if (kind === "policy") state.enabled = false;
    if (kind === "template") state.version = 2;
    if (kind === "account") state.employee.jobTitle = "worker";
    if (kind === "extras") await createAddition();
    const before = structuredClone(state);
    expect((await invokePilot("post", body)).body.code).toBe("COMPARISON_REVISION_CONFLICT");
    expect(state).toEqual(before);
  });
  it("rolls back permissions, binding, extras and audits when pilot audit/session fails", async () => {
    const body = await pilotConfirmation(), before = structuredClone(state);
    failAudit = true;
    expect((await invokePilot("post", body)).statusCode).toBe(500);
    expect(state).toEqual(before);
    failAudit = false; runtime.failSessions = true;
    expect((await invokePilot("post", body)).statusCode).toBe(500);
    expect(state).toEqual(before);
  });
  it("requires an explicit acknowledgment and rejects automatic bulk/hidden-role input", async () => {
    const body = await pilotConfirmation();
    for (const fields of [{ acknowledgeChanges: false }, { employeeIds: [1,2] }, { role: "admin" }])
      expect((await invokePilot("post", { ...body, ...fields })).statusCode).toBe(400);
  });
});