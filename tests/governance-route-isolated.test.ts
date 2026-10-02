import { readFileSync } from "node:fs";
import { createContext, Script } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { assignmentUserId, assignmentCreateBody, assignmentUpdateBody, normalizeAssignmentScope, isValidAssignmentScopeAndTime } from "../server/user-assignment-validation";
import { checkPermissionDecision, normalizePermissionDecisionSnapshot, type PermissionSourceMode } from "../server/permission-decision";

// Regression tests: formerly unsafe assignment and permission writes must now
// fail without mutation, while authorized admin controls remain functional.
// No server module is imported. Execute original AST-selected declarations and
// complete registrations in a restricted VM: no app bootstrap, env, timers, SQL,
// Clerk, session verification, or network. isAuthenticated is explicitly bypassed
// ONLY for synthetic pre-authenticated fixtures. Real requirePermission runs next.
// Correction to the requested provenance: getCurrentUser lives in routes.ts,
// not auth.ts. Its actual declaration is executed unchanged too.
const sources = Object.fromEntries(
  ["server/routes.ts", "server/auth.ts", "shared/schema.ts"].map(path => [
    path, ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true),
  ]),
);

function declarations(path: string, roots: string[]) {
  const source = sources[path];
  const available = new Map<string, ts.Node>();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      available.set(statement.name.text, statement);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) available.set(declaration.name.text, statement);
      }
    }
  }
  const selected = new Set<ts.Node>();
  function select(name: string) {
    const node = available.get(name);
    if (!node) throw new Error(`Missing real declaration: ${path}:${name}`);
    if (selected.has(node)) return;
    selected.add(node);
    function visit(child: ts.Node) {
      if (ts.isIdentifier(child) && available.has(child.text)) select(child.text);
      ts.forEachChild(child, visit);
    }
    visit(node);
  }
  roots.forEach(select);
  // Keep original declaration order (including the real role helper dependencies).
  return source.statements.filter(node => selected.has(node)).map(node => node.getText(source)).join("\n");
}

const assignmentPath = "/api/rbac/users/:userId/assignments/:assignmentId";
const assignmentCreatePath = "/api/rbac/users/:userId/assignments";
const permissionPath = "/api/users/:id/permissions";
function registration(method: string, path: string) {
  const source = sources["server/routes.ts"];
  const matches: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(source) === "app"
      && node.expression.name.text === method
      && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === path) matches.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (matches.length !== 1) throw new Error(`Expected exactly one registration: ${method} ${path}`);
  // Fail if registration adds/reorders middleware: do not silently skip new checks.
  const args = matches[0].arguments;
  expect(args).toHaveLength(4);
  expect(args[1].getText(source)).toBe("isAuthenticated");
  expect(args[2].getText(source)).toBe('requirePermission("users", "edit")');
  expect(ts.isArrowFunction(args[3])).toBe(true);
  return `${matches[0].getText(source)};`;
}

const realCode = [
  declarations("shared/schema.ts", [
    "SYSTEM_MODULES", "MODULE_ACTIONS", "ROLE_PERMISSION_TEMPLATES", "JOB_ROLE_PERMISSION_TEMPLATES",
  ]),
  declarations("server/auth.ts", ["requirePermission", "invalidateAuthCache"]),
  declarations("server/routes.ts", ["getCurrentUser"]),
  registration("post", assignmentCreatePath),
  registration("patch", assignmentPath),
  registration("delete", assignmentPath),
  registration("put", permissionPath),
].join("\n");
const compiled = ts.transpileModule(realCode, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  reportDiagnostics: true,
});
if (compiled.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) {
  throw new Error("Isolated real route declarations did not transpile");
}
const script = new Script(compiled.outputText.replace(/^export /gm, "").replace(/^export \{\};?$/gm, ""));

function forbidden(name: string): never {
  throw new Error(`Unexpected isolated-test dependency: ${name}`);
}
function strictObject<T extends object>(name: string, object: T): T {
  return new Proxy(object, {
    get(target, property, receiver) {
      if (!(property in target)) return forbidden(`${name}.${String(property)}`);
      return Reflect.get(target, property, receiver);
    },
  });
}

type Grant = { module: string; actions: string[] };
const actor = { id: "editor", role: "employee", username: "editor", branchId: "branch-a" };
const initialGrant: Grant[] = [{ module: "users", actions: ["edit"] }];
const privileged: Grant[] = [
  { module: "users", actions: ["create", "edit", "delete"] },
  { module: "settings", actions: ["edit", "delete"] },
  { module: "salary_closing", actions: ["approve", "export"] },
];

function fixture(owner = "other", targetRole = "employee", targetBranch = "branch-a") {
  const assignments = new Map<number, Record<string, unknown>>([
    [41, { id: 41, userId: owner, roleId: 5, branchId: "branch-a", isActive: true }],
  ]);
  const accounts = new Map([
    ["editor", { ...actor }],
    ["other", { id: "other", role: targetRole, branchId: targetBranch }],
    ["third", { id: "third", role: "employee", branchId: "branch-b" }],
  ]);
  const permissions = new Map<string, Grant[]>([["other", [{ module: "users", actions: ["view"] }]]]);
  const inherited = [{ module: "settings", action: "view", permissionId: 901 }];
  const audits: unknown[][] = [];
  const overrides = new Map<string, { permissionId: number; deny: boolean }[]>();
  const sourceModes = new Map<string, PermissionSourceMode>();
  // Pure decisions over the storage contract double, not an assertion about SQL
  // transactions. Distinguish explicitly saved [] from automatic inheritance.
  function permissionSnapshot(userId: string) {
    return normalizePermissionDecisionSnapshot({
      userId, sourceMode: sourceModes.get(userId) ?? null,
      direct: permissions.get(userId) ?? [],
      roles: inherited.map(row => ({
        ...row, scopeType: "global", branchId: null, departmentId: null,
        startDate: null, endDate: null, isActive: true,
      })),
      overrides: (overrides.get(userId) ?? []).map(change => {
        const row = inherited.find(row => row.permissionId === change.permissionId);
        if (!row) return forbidden(`unknown override permission ${change.permissionId}`);
        return { ...row, allow: !change.deny, branchId: null, departmentId: null, expiresAt: null };
      }),
    });
  }
   // Storage contract doubles only, not authorization or route logic. Assignment
   // mutations match on ID AND expected owner; extracted storage is tested separately.
  // Atomic permission persistence is simulated, not a test of SQL/audit durability.
  const storage = strictObject("storage", {
    // Explicit legacy-fixture capability absence (the real resolver is tested separately).
    getPermissionDecisionSnapshot: undefined,
    getUserAssignments: vi.fn(async (userId: string) =>
      [...assignments.values()].filter(row => row.userId === userId)),
    createUserAssignment: vi.fn(async (values: Record<string, unknown>) => {
      const created = { id: 42, ...values };
      assignments.set(42, created);
      return created;
    }),
    updateUserAssignment: vi.fn(async (id: number, userId: string, changes: Record<string, unknown>) => {
      const row = assignments.get(id);
      if (!row || row.userId !== userId) return undefined;
      const changed = { ...row, ...changes };
      assignments.set(id, changed);
      return changed;
    }),
    deleteUserAssignment: vi.fn(async (id: number, userId: string) =>
      assignments.get(id)?.userId === userId && assignments.delete(id)),
    getInheritedPermissions: vi.fn(async (id: string) => {
      if (!accounts.has(id)) return forbidden(`unknown target ${id}`);
      return structuredClone(inherited);
    }),
    updateUserPermissionsWithAudit: vi.fn(async (
      id: string, grants: Grant[], changedBy: string, template: unknown,
      changes: { permissionId: number; deny: boolean }[],
    ) => {
      if (!accounts.has(id)) return forbidden(`unknown target ${id}`);
      permissions.set(id, structuredClone(grants));
      sourceModes.set(id, "direct");
      // Apply only explicitly supplied override changes. Empty changes must
      // neither create omission denies nor erase an independent deny.
      if (changes.length) {
        const existing = new Map((overrides.get(id) ?? []).map(row => [row.permissionId, row]));
        for (const change of changes) existing.set(change.permissionId, structuredClone(change));
        overrides.set(id, [...existing.values()]);
      }
      audits.push([id, structuredClone(grants), changedBy, template, structuredClone(changes)]);
      return structuredClone(grants);
    }),
  });
  type Handler = (req: any, res: any, next: (error?: unknown) => void) => unknown;
  const registered = new Map<string, Handler[]>();
  const capture = (method: string) => (path: string, ...handlers: Handler[]) => {
    registered.set(`${method} ${path}`, handlers);
  };
  const preAuthenticated = vi.fn((req: any, _res: any, next: () => void) => {
    if (!req.currentUser) return forbidden("fixture missing pre-authenticated currentUser");
    next();
  });
  const blocked = strictObject("I/O", {});
  const context = createContext({
    app: strictObject("app", { post: capture("post"), patch: capture("patch"), delete: capture("delete"), put: capture("put") }),
    storage, z, db: blocked, pool: blocked, process: blocked,
    assignmentUserId, assignmentCreateBody, assignmentUpdateBody, normalizeAssignmentScope, isValidAssignmentScopeAndTime,
    getCachedBranches: () => forbidden("getCachedBranches"),
    fetch: () => forbidden("fetch"), require: () => forbidden("require"),
    setTimeout: () => forbidden("setTimeout"), setInterval: () => forbidden("setInterval"),
    console: strictObject("console", {
      log: vi.fn(),
      error: (...args: unknown[]) => forbidden(`caught error: ${args.map(String).join(" ")}`),
    }),
    isAuthenticated: preAuthenticated,
  }, { codeGeneration: { strings: false, wasm: false } });
  script.runInContext(context, { timeout: 1000 });

  async function request(method: string, options: {
    user?: typeof actor; grants?: Grant[]; pathUser?: string; assignmentId?: string; body?: unknown;
  } = {}) {
    const authenticationCalls = preAuthenticated.mock.calls.length;
    const path = method === "put" ? permissionPath : method === "post" ? assignmentCreatePath : assignmentPath;
    const req = {
      currentUser: options.user ?? { ...actor },
      authPermissions: options.grants ?? structuredClone(initialGrant),
      authBranchIds: ["branch-a"],
      // Synthetic already-loaded denial snapshot, like the grants above; never query SQL.
      operationsPermissionDenials: new Set<string>(),
      method: method.toUpperCase(), originalUrl: path, headers: {}, ip: "fixture",
      params: { id: options.pathUser ?? "other", userId: options.pathUser ?? "other",
        assignmentId: options.assignmentId ?? "41" },
      body: options.body ?? (method === "put" ? { permissions: structuredClone(privileged) } : { roleId: 9 }),
    };
    const res = {
      statusCode: 200, body: undefined as unknown, ended: false,
      status: vi.fn((status: number) => { res.statusCode = status; return res; }),
      json: vi.fn((body: unknown) => { res.body = body; res.ended = true; return res; }),
      send: vi.fn(() => { res.ended = true; return res; }),
    };
    const handlers = registered.get(`${method} ${path}`);
    if (!handlers) throw new Error(`Missing captured handlers: ${method}`);
    for (const handler of handlers) {
      let continued = false;
      await handler(req, res, error => {
        if (error) throw error;
        if (continued) throw new Error("Middleware continued twice");
        continued = true;
      });
      if (!continued) break;
      if (res.ended) throw new Error("Middleware continued after response");
    }
    expect(res.ended).toBe(true);
    expect(preAuthenticated).toHaveBeenCalledTimes(authenticationCalls + 1);
    return res;
  }
  return { request, assignments, permissions, accounts, inherited, overrides, sourceModes, permissionSnapshot, audits, storage };
}

describe("isolated registered RBAC assignment routes (pre-authenticated fixtures)", () => {
  const admin = { ...actor, role: "admin" };
  for (const method of ["patch", "delete"]) {
    it(`${method}: legitimate admin other-user ownership succeeds without explicit grants`, async () => {
      const f = fixture();
      const res = await f.request(method, { user: admin, grants: [] });
      expect(res.statusCode).toBe(method === "patch" ? 200 : 204);
      if (method === "patch") expect(f.assignments.get(41)).toEqual({
        id: 41, userId: "other", roleId: 9, branchId: "branch-a", isActive: true,
      });
      else expect(f.assignments.size).toBe(0);
    });

    it(`${method}: own URL correctly denies non-admin and leaves storage untouched`, async () => {
      const f = fixture("editor");
      const before = structuredClone(f.assignments.get(41));
      const res = await f.request(method, { pathUser: "editor" });
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: method === "patch"
        ? "لا يمكنك تعديل تعييناتك الخاصة" : "لا يمكنك حذف تعييناتك الخاصة" });
      expect(f.assignments.get(41)).toEqual(before);
      expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
      expect(f.storage.deleteUserAssignment).not.toHaveBeenCalled();
    });

    it(`${method}: admin may legitimately mutate own assignment without explicit grants`, async () => {
      const f = fixture("editor");
      const res = await f.request(method, {
        pathUser: "editor", user: { ...actor, role: "admin" }, grants: [],
      });
      expect(res.statusCode).toBe(method === "patch" ? 200 : 204);
      expect(f.assignments.get(41)?.roleId).toBe(method === "patch" ? 9 : undefined);
    });

    it.each(["editor", "third"])(`${method}: mismatched admin URL cannot mutate assignment owned by %s`, async owner => {
      const f = fixture(owner);
      const before = structuredClone(f.assignments.get(41));
      const res = await f.request(method, { pathUser: "other", user: admin, grants: [] });
      expect(res.statusCode).toBe(404);
      expect(res.body).toEqual({ error: "التعيين غير موجود" });
      expect(f.assignments.get(41)).toEqual(before);
      if (method === "patch") {
        expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
        expect(f.storage.getUserAssignments).toHaveBeenCalledExactlyOnceWith("other");
      } else {
        expect(f.storage.deleteUserAssignment).toHaveBeenCalledExactlyOnceWith(41, "other");
      }
    });

    it(`${method}: users:edit alone cannot administer other-user assignments`, async () => {
      const f = fixture();
      const before = structuredClone(f.assignments.get(41));
      const res = await f.request(method);
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: "إدارة الصلاحيات العامة لمسؤول النظام فقط؛ استخدم مسار التفويض المعتمد" });
      expect(f.assignments.get(41)).toEqual(before);
      expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
      expect(f.storage.deleteUserAssignment).not.toHaveBeenCalled();
    });

    it.each(["", "0", "-1", "1.5", "41junk", " 41", "+41", "041", "4e1", "2147483648", "9007199254740993"])(
      `${method}: invalid assignment ID %j is rejected before storage`, async assignmentId => {
        const f = fixture();
        const before = structuredClone(f.assignments.get(41));
        const res = await f.request(method, { assignmentId, user: admin });
        expect(res.statusCode).toBe(400);
        expect(f.assignments.get(41)).toEqual(before);
        expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
        expect(f.storage.deleteUserAssignment).not.toHaveBeenCalled();
      },
    );

    it.each(["", " ", " other "])(`${method}: invalid URL owner %j is rejected`, async pathUser => {
      const f = fixture();
      const res = await f.request(method, { pathUser, user: admin });
      expect(res.statusCode).toBe(400);
      expect(f.assignments.get(41)?.roleId).toBe(5);
      expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
      expect(f.storage.deleteUserAssignment).not.toHaveBeenCalled();
    });

    it.each([
      { label: "no grants", grants: [] as Grant[] },
      { label: "view only", grants: [{ module: "users", actions: ["view"] }] },
    ])(
      `${method}: missing users:edit denies before mismatched storage mutation ($label)`, async ({ grants }) => {
        const f = fixture("editor");
        const before = structuredClone(f.assignments.get(41));
        const res = await f.request(method, { grants });
        expect(res.statusCode).toBe(403);
        expect(f.assignments.get(41)).toEqual(before);
        expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
        expect(f.storage.deleteUserAssignment).not.toHaveBeenCalled();
      },
    );
  }

  it.each(["editor", "third", "other"])("PATCH: admin body userId %s is rejected without reassignment", async userId => {
    const f = fixture();
    const before = structuredClone(f.assignments.get(41));
    const res = await f.request("patch", { body: { userId, roleId: 9 }, user: admin });
    expect(res.statusCode).toBe(400);
    expect(f.assignments.get(41)).toEqual(before);
    expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
  });

  it.each([
    { id: 42, roleId: 9 }, { createdAt: "2026-01-01", roleId: 9 },
    { updatedAt: "2026-01-01", roleId: 9 }, { unexpected: true }, {},
    { roleId: "9" }, { roleId: 0 }, { roleId: 2147483648 }, { roleId: 1.5 },
    { departmentId: -1 }, { branchId: "" }, { scopeType: "unknown" },
    { isPrimary: "true" }, { isActive: null }, { startDate: "invalid" },
    { endDate: 123 }, [], "invalid",
  ])("PATCH: invalid or non-whitelisted body %j never reaches storage", async body => {
    const f = fixture();
    const before = structuredClone(f.assignments.get(41));
    const res = await f.request("patch", { body, user: admin });
    expect(res.statusCode).toBe(400);
    expect(f.assignments.get(41)).toEqual(before);
    expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
  });

  it("PATCH: admin can update all mutable fields with dates normalized for storage", async () => {
    const f = fixture();
    const body = { roleId: 9, branchId: null, departmentId: 3, scopeType: "department",
      isPrimary: false, isActive: false, startDate: "2026-10-01T00:00:00Z", endDate: null };
    const res = await f.request("patch", { body, user: admin });
    expect(res.statusCode).toBe(200);
    expect(f.storage.updateUserAssignment).toHaveBeenCalledExactlyOnceWith(
      41, "other", { ...body, startDate: new Date(body.startDate) },
    );
    expect(f.assignments.get(41)?.userId).toBe("other");
  });

  it("PATCH: tampered body cannot bypass own-URL non-admin denial", async () => {
    const f = fixture("editor");
    const res = await f.request("patch", { pathUser: "editor", body: { userId: "other", roleId: 9 } });
    expect(res.statusCode).toBe(403);
    expect(f.assignments.get(41)?.userId).toBe("editor");
    expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
  });

  it("DELETE: body userId is ignored; admin deletion uses assignment ID and URL owner", async () => {
    const f = fixture();
    const res = await f.request("delete", { body: { userId: "editor" }, user: admin });
    expect(res.statusCode).toBe(204);
    expect(f.assignments.has(41)).toBe(false);
    expect(f.storage.deleteUserAssignment).toHaveBeenCalledExactlyOnceWith(41, "other");
  });

  it("PATCH: absent assignment returns 404 without creating a row", async () => {
    const f = fixture();
    const res = await f.request("patch", { assignmentId: "999", user: admin });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "التعيين غير موجود" });
    expect(f.assignments.has(999)).toBe(false);
    expect(f.assignments.get(41)?.roleId).toBe(5);
  });

  it("DELETE: absent assignment returns 404 without mutation", async () => {
    const f = fixture();
    const res = await f.request("delete", { assignmentId: "999", user: admin });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "التعيين غير موجود" });
    expect(f.assignments.get(41)?.roleId).toBe(5);
  });
});

describe("assignment scope and interval stay on the assignment (real registered handlers)", () => {
  const admin = { ...actor, role: "admin" };

  it.each([
    { scopeType: "global" },
    { scopeType: "branch" },
    {},
  ])("POST all_branches never reads branches or mutates permanent branch grants: %j", async scope => {
    const f = fixture();
    // db is a throwing strict proxy, so even a delete/insert attempt fails this test.
    const body = { roleId: 9, branchId: "all_branches", ...scope,
      startDate: "2026-01-01T00:00:00Z", endDate: "2026-01-02T00:00:00Z" };
    const res = await f.request("post", { user: admin, grants: [], body });
    expect(res.statusCode).toBe(201);
    expect(f.storage.createUserAssignment).toHaveBeenCalledExactlyOnceWith({
      userId: "other", roleId: 9, branchId: null, departmentId: null,
      scopeType: scope.scopeType ?? "global", isPrimary: true, isActive: true,
      startDate: new Date(body.startDate), endDate: new Date(body.endDate),
    });
    expect(f.assignments.get(41)?.branchId).toBe("branch-a");
  });

  it("POST allows already expired assignments without materializing access", async () => {
    const f = fixture();
    const res = await f.request("post", { user: admin, grants: [], body: {
      roleId: 9, branchId: "all_branches", endDate: "2000-01-01",
    } });
    expect(res.statusCode).toBe(201);
    expect(f.assignments.get(42)).toMatchObject({
      branchId: null, scopeType: "global", endDate: new Date("2000-01-01"), startDate: null,
    });
  });

  it.each([
    { branchId: "branch-a", scopeType: "branch" },
    { branchId: null, scopeType: "branch" },
    { branchId: null, departmentId: 3, scopeType: "department" },
    { branchId: null, scopeType: "global" },
  ])("POST authorized admin scope %j remains available", async scope => {
    const f = fixture();
    const res = await f.request("post", { user: admin, grants: [], body: { roleId: 9, ...scope } });
    expect(res.statusCode).toBe(201);
    expect(f.assignments.get(42)).toMatchObject({ userId: "other", roleId: 9, ...scope });
  });

  it.each(["employee", "operations_manager", "branch_manager", "hr_manager", "business_owner"])(
    "POST denies generic users:edit %s without reading or writing storage", async role => {
      const f = fixture();
      const res = await f.request("post", { user: { ...actor, role }, body: { roleId: 9, branchId: "all_branches" } });
      expect(res.statusCode).toBe(403);
      expect(f.storage.createUserAssignment).not.toHaveBeenCalled();
      expect(f.storage.getUserAssignments).not.toHaveBeenCalled();
    },
  );

  it.each([
    { userId: "third", roleId: 9 }, { id: 42, roleId: 9 }, { roleId: "9" },
    { roleId: 0 }, { roleId: 1.5 }, { roleId: 2147483648 }, {},
    { roleId: 9, branchId: " branch-a" }, { roleId: 9, departmentId: "3" },
    { roleId: 9, isActive: false }, { roleId: 9, isPrimary: "true" },
    { roleId: 9, scopeType: "unknown" },
  ])("POST strict body rejects %j before any persistence", async body => {
    const f = fixture();
    const res = await f.request("post", { user: admin, body });
    expect(res.statusCode).toBe(400);
    expect(f.storage.createUserAssignment).not.toHaveBeenCalled();
  });

  for (const method of ["post", "patch"]) {
    it.each(["", " ", " other "])(`${method}: invalid URL user %j cannot persist`, async pathUser => {
      const f = fixture();
      const res = await f.request(method, { user: admin, pathUser });
      expect(res.statusCode).toBe(400);
      expect(f.storage.createUserAssignment).not.toHaveBeenCalled();
      expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
    });

    it.each([
      "not-a-date", "", "2026-02-30", "2026-02-30T00:00:00Z", "2025-02-29",
      "2026-13-01", "2026-01-01T24:00:00Z", "01/02/2026", "2026-01-01T00:00:00",
      123,
    ])(`${method}: invalid date %j cannot persist`, async date => {
      for (const field of ["startDate", "endDate"]) {
        const f = fixture();
        const res = await f.request(method, { user: admin, body: { roleId: 9, [field]: date } });
        expect(res.statusCode).toBe(400);
        expect(f.storage.createUserAssignment).not.toHaveBeenCalled();
        expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
      }
    });

    it.each([
      { scopeType: "global", branchId: "branch-a" },
      { scopeType: "global", departmentId: 3 },
      { scopeType: "branch", branchId: "branch-a", departmentId: 3 },
      { scopeType: "department", branchId: null, departmentId: null },
      { scopeType: "department", branchId: "branch-a", departmentId: 3 },
      { scopeType: "department", branchId: "all_branches", departmentId: 3 },
      { startDate: "2026-02-01", endDate: "2026-01-01" },
      { startDate: "2026-01-01", endDate: "2026-01-01" },
    ])(`${method}: incompatible scope or interval %j is rejected`, async values => {
      const f = fixture();
      const res = await f.request(method, { user: admin, body: { roleId: 9, ...values } });
      expect(res.statusCode).toBe(400);
      expect(f.storage.createUserAssignment).not.toHaveBeenCalled();
      expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
    });
  }

  it.each([
    { startDate: "2026-03-01" }, { endDate: "2025-12-01" }, { endDate: "2026-01-01" },
  ])("PATCH validates the interval merged with the stored row: %j", async body => {
    const f = fixture();
    Object.assign(f.assignments.get(41)!, {
      startDate: new Date("2026-01-01"), endDate: new Date("2026-02-01"),
    });
    const before = structuredClone(f.assignments.get(41));
    const res = await f.request("patch", { user: admin, body });
    expect(res.statusCode).toBe(400);
    expect(f.assignments.get(41)).toEqual(before);
    expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
  });

  it("PATCH rejects changing only scope to global when stored branch is specific", async () => {
    const f = fixture();
    const res = await f.request("patch", { user: admin, body: { scopeType: "global" } });
    expect(res.statusCode).toBe(400);
    expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
  });

  it("PATCH allows a valid partial interval update using explicit timezone dates", async () => {
    const f = fixture();
    Object.assign(f.assignments.get(41)!, {
      startDate: new Date("2026-01-01"), endDate: new Date("2026-02-01"),
    });
    const res = await f.request("patch", { user: admin, body: { startDate: "2026-01-02T03:00:00+03:00" } });
    expect(res.statusCode).toBe(200);
    expect(f.storage.updateUserAssignment).toHaveBeenCalledExactlyOnceWith(
      41, "other", { startDate: new Date("2026-01-02T00:00:00Z") },
    );
  });

  it("PATCH can explicitly clear an interval boundary", async () => {
    const f = fixture();
    Object.assign(f.assignments.get(41)!, {
      startDate: new Date("2026-01-01"), endDate: new Date("2026-02-01"),
    });
    const res = await f.request("patch", { user: admin, body: { startDate: null } });
    expect(res.statusCode).toBe(200);
    expect(f.assignments.get(41)?.startDate).toBeNull();
  });

  it("PATCH preserves historical branch=null all-branches semantics, without changing scope", async () => {
    const f = fixture();
    Object.assign(f.assignments.get(41)!, { branchId: null, scopeType: "branch" });
    const res = await f.request("patch", { user: admin, grants: [], body: { endDate: "2026-01-01" } });
    expect(res.statusCode).toBe(200);
    expect(f.assignments.get(41)).toMatchObject({ branchId: null, scopeType: "branch" });
    expect(f.storage.updateUserAssignment).toHaveBeenCalledExactlyOnceWith(
      41, "other", { endDate: new Date("2026-01-01") },
    );
  });

  it("PATCH can normalize all_branches and preserve an explicit expiry", async () => {
    const f = fixture();
    const res = await f.request("patch", { user: admin, grants: [], body: {
      branchId: "all_branches", endDate: "2000-01-01",
    } });
    expect(res.statusCode).toBe(200);
    expect(f.storage.updateUserAssignment).toHaveBeenCalledExactlyOnceWith(41, "other", {
      branchId: null, scopeType: "global", endDate: new Date("2000-01-01"),
    });
  });

  it("PATCH still binds the write to URL owner after the validation read", async () => {
    const f = fixture();
    f.storage.updateUserAssignment.mockImplementationOnce(async (id, _owner, _changes) => {
      // Simulate ownership changing between read and atomic storage update.
      f.assignments.get(id)!.userId = "third";
      return undefined;
    });
    const res = await f.request("patch", { user: admin });
    expect(res.statusCode).toBe(404);
    expect(f.assignments.get(41)?.roleId).toBe(5);
    expect(f.storage.updateUserAssignment).toHaveBeenCalledExactlyOnceWith(41, "other", { roleId: 9 });
  });
});

describe("isolated PUT user permissions: generic users:edit is not a delegation ceiling", () => {
  const admin = { ...actor, role: "admin" };
  it.each([
    ["ordinary other account", "employee", "branch-a"],
    ["admin account", "admin", "branch-a"],
    ["business owner account", "business_owner", "branch-a"],
    ["shareholder account", "shareholder", "branch-a"],
    ["out-of-branch employee", "employee", "branch-b"],
    ["out-of-branch admin", "admin", "branch-b"],
  ])("users:edit-only employee cannot grant unheld privileged actions to %s", async (_label, role, branch) => {
    const f = fixture("other", role, branch);
    const before = structuredClone(f.accounts);
    const beforePermissions = structuredClone(f.permissions);
    const res = await f.request("put");
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "إدارة الصلاحيات العامة لمسؤول النظام فقط؛ استخدم مسار التفويض المعتمد /api/operations/employee-accounts/:employeeId/permissions" });
    expect(f.permissions).toEqual(beforePermissions);
    expect(f.permissions.has("editor")).toBe(false);
    expect(f.accounts).toEqual(before);
    expect(f.storage.getInheritedPermissions).not.toHaveBeenCalled();
    expect(f.storage.updateUserPermissionsWithAudit).not.toHaveBeenCalled();
    expect(f.overrides.size).toBe(0);
    expect(f.audits).toEqual([]);
  });

  it.each([
    { label: "no grants", grants: [] as Grant[] },
    { label: "view only", grants: [{ module: "users", actions: ["view"] }] },
  ])(
    "no users:edit denies privileged grants without persistence ($label)", async ({ grants }) => {
      const f = fixture();
      const before = structuredClone(f.permissions);
      const res = await f.request("put", { grants });
      expect(res.statusCode).toBe(403);
      expect(f.permissions).toEqual(before);
      expect(f.audits).toEqual([]);
      expect(f.storage.getInheritedPermissions).not.toHaveBeenCalled();
      expect(f.storage.updateUserPermissionsWithAudit).not.toHaveBeenCalled();
    },
  );

  it("viewer role denies writes even with synthetic users:edit", async () => {
    const f = fixture();
    const res = await f.request("put", { user: { ...actor, role: "viewer" } });
    expect(res.statusCode).toBe(403);
    expect(f.audits).toEqual([]);
    expect(f.storage.getInheritedPermissions).not.toHaveBeenCalled();
  });

  it("non-admin self permission modification is denied", async () => {
    const f = fixture();
    const res = await f.request("put", { pathUser: "editor" });
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "لا يمكنك تعديل صلاحياتك الخاصة" });
    expect(f.permissions.has("editor")).toBe(false);
    expect(f.storage.updateUserPermissionsWithAudit).not.toHaveBeenCalled();
  });

  it("admin self permission modification is an authorized control", async () => {
    const f = fixture();
    const res = await f.request("put", { pathUser: "editor", user: { ...actor, role: "admin" }, grants: [] });
    expect(res.statusCode).toBe(200);
    expect(f.permissions.get("editor")).toEqual(privileged);
    expect(f.audits).toHaveLength(1);
  });

  it("legitimate lower-privilege grant persists as direct without synthesizing inherited override changes", async () => {
    const f = fixture();
    const grants = [{ module: "settings", actions: ["view"] }];
    const res = await f.request("put", { user: admin, grants: [], body: { permissions: grants, templateApplied: "fixture-template" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(grants);
    expect(f.permissions.get("other")).toEqual(grants);
    expect(f.audits).toEqual([["other", grants, "editor", "fixture-template", []]]);
    expect(f.sourceModes.get("other")).toBe("direct");
    expect(f.overrides.size).toBe(0);
    expect(f.storage.getInheritedPermissions).not.toHaveBeenCalled();
    expect(checkPermissionDecision(f.permissionSnapshot("other"), "settings", "view")).toBe(true);
  });

  it("explicit empty direct replacement prevents inherited resurrection without manufacturing permanent denies", async () => {
    const f = fixture();
    f.permissions.delete("other");
    expect(f.permissionSnapshot("other").resolvedSourceMode).toBe("inherit");
    expect(checkPermissionDecision(f.permissionSnapshot("other"), "settings", "view")).toBe(true);
    const res = await f.request("put", { user: admin, grants: [], body: { permissions: [] } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
    expect(f.permissions.get("other")).toEqual([]);
    expect(f.sourceModes.get("other")).toBe("direct");
    expect(f.permissionSnapshot("other").resolvedSourceMode).toBe("direct");
    expect(checkPermissionDecision(f.permissionSnapshot("other"), "settings", "view")).toBe(false);
    expect(f.overrides.size).toBe(0);
    expect(f.audits).toEqual([["other", [], "editor", null, []]]);
    expect(f.storage.getInheritedPermissions).not.toHaveBeenCalled();
  });

  it("independent deny persists through empty replacement and restoring the denied direct checkbox", async () => {
    const f = fixture();
    const deny = [{ permissionId: 901, deny: true }];
    f.overrides.set("other", structuredClone(deny));
    const empty = await f.request("put", { user: admin, grants: [], body: { permissions: [] } });
    expect(empty.statusCode).toBe(200);
    expect(f.overrides.get("other")).toEqual(deny);
    expect(f.sourceModes.get("other")).toBe("direct");
    expect(checkPermissionDecision(f.permissionSnapshot("other"), "settings", "view")).toBe(false);
    const restored = [{ module: "settings", actions: ["view"] }, { module: "users", actions: ["view"] }];
    const restore = await f.request("put", { user: admin, grants: [], body: { permissions: restored } });
    expect(restore.statusCode).toBe(200);
    expect(f.permissions.get("other")).toEqual(restored);
    expect(f.overrides.get("other")).toEqual(deny);
    expect(f.sourceModes.get("other")).toBe("direct");
    expect(checkPermissionDecision(f.permissionSnapshot("other"), "settings", "view")).toBe(false);
    expect(checkPermissionDecision(f.permissionSnapshot("other"), "users", "view")).toBe(true);
    expect(f.audits).toEqual([
      ["other", [], "editor", null, []], ["other", restored, "editor", null, []],
    ]);
    expect(f.storage.getInheritedPermissions).not.toHaveBeenCalled();
  });

  it("non-array permission input is rejected without persistence", async () => {
    const f = fixture();
    const res = await f.request("put", { user: admin, body: { permissions: { module: "users" } } });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Invalid permissions format" });
    expect(f.storage.getInheritedPermissions).not.toHaveBeenCalled();
    expect(f.audits).toEqual([]);
  });

  it("module/action vocabulary validation filters invalid entries, not delegation authority", async () => {
    const f = fixture();
    const res = await f.request("put", { user: admin, body: { permissions: [
      { module: "not_a_real_module", actions: ["edit"] },
      { module: "users", actions: ["not_a_real_action", "delete"] },
      { module: "settings", actions: "edit" },
    ] } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ module: "users", actions: ["delete"] }]);
    expect(f.permissions.get("other")).toEqual(res.body);
  });
});