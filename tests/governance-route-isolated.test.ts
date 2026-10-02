import { readFileSync } from "node:fs";
import { createContext, Script } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Characterization, NOT security acceptance: KNOWN GAP cases pass when reproduced.
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
  // Storage contract doubles only, not authorization or route logic. Assignment
  // update/delete by ID and unrestricted partial fields match inspected storage.ts.
  // Atomic permission persistence is simulated, not a test of SQL/audit durability.
  const storage = strictObject("storage", {
    updateUserAssignment: vi.fn(async (id: number, changes: Record<string, unknown>) => {
      const row = assignments.get(id);
      if (!row) return undefined;
      const changed = { ...row, ...changes };
      assignments.set(id, changed);
      return changed;
    }),
    deleteUserAssignment: vi.fn(async (id: number) => assignments.delete(id)),
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
      overrides.set(id, structuredClone(changes));
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
    app: strictObject("app", { patch: capture("patch"), delete: capture("delete"), put: capture("put") }),
    storage, db: blocked, pool: blocked, process: blocked,
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
    const path = method === "put" ? permissionPath : assignmentPath;
    const req = {
      currentUser: options.user ?? { ...actor },
      authPermissions: options.grants ?? structuredClone(initialGrant),
      authBranchIds: ["branch-a"],
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
    expect(preAuthenticated).toHaveBeenCalledOnce();
    return res;
  }
  return { request, assignments, permissions, accounts, inherited, overrides, audits, storage };
}

describe("isolated registered RBAC assignment routes (pre-authenticated fixtures)", () => {
  for (const method of ["patch", "delete"]) {
    it(`${method}: legitimate other-user ownership succeeds with users:edit`, async () => {
      const f = fixture();
      const res = await f.request(method);
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

    it.each(["editor", "third"])(`${method}: KNOWN GAP mismatched other-user URL mutates assignment owned by %s`, async owner => {
      const f = fixture(owner);
      const res = await f.request(method, { pathUser: "other" });
      expect(res.statusCode).toBe(method === "patch" ? 200 : 204);
      if (method === "patch") {
        expect(f.assignments.get(41)?.userId).toBe(owner);
        expect(f.assignments.get(41)?.roleId).toBe(9);
        expect(res.body).toEqual(f.assignments.get(41));
        expect(f.storage.updateUserAssignment).toHaveBeenCalledExactlyOnceWith(41, { roleId: 9 });
      } else {
        expect(f.assignments.has(41)).toBe(false);
        expect(f.storage.deleteUserAssignment).toHaveBeenCalledExactlyOnceWith(41);
      }
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

  it.each(["editor", "third"])("PATCH: KNOWN GAP body userId reassigns matched other-user assignment to %s", async userId => {
    const f = fixture();
    const res = await f.request("patch", { body: { userId, roleId: 9 } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: 41, userId, roleId: 9, branchId: "branch-a", isActive: true });
    expect(f.assignments.get(41)).toEqual(res.body);
    expect(f.storage.updateUserAssignment).toHaveBeenCalledExactlyOnceWith(41, { userId, roleId: 9 });
  });

  it("PATCH: tampered body cannot bypass own-URL non-admin denial", async () => {
    const f = fixture("editor");
    const res = await f.request("patch", { pathUser: "editor", body: { userId: "other", roleId: 9 } });
    expect(res.statusCode).toBe(403);
    expect(f.assignments.get(41)?.userId).toBe("editor");
    expect(f.storage.updateUserAssignment).not.toHaveBeenCalled();
  });

  it("DELETE: body userId is ignored; matched other-user deletion uses only assignment ID", async () => {
    const f = fixture();
    const res = await f.request("delete", { body: { userId: "editor" } });
    expect(res.statusCode).toBe(204);
    expect(f.assignments.has(41)).toBe(false);
    expect(f.storage.deleteUserAssignment).toHaveBeenCalledExactlyOnceWith(41);
  });

  it("PATCH: absent assignment returns 404 without creating a row", async () => {
    const f = fixture();
    const res = await f.request("patch", { assignmentId: "999" });
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "التعيين غير موجود" });
    expect(f.assignments.has(999)).toBe(false);
    expect(f.assignments.get(41)?.roleId).toBe(5);
  });

  it("DELETE: absent assignment still returns 204 (storage contract characterization)", async () => {
    const f = fixture();
    const res = await f.request("delete", { assignmentId: "999" });
    expect(res.statusCode).toBe(204);
    expect(f.assignments.get(41)?.roleId).toBe(5);
  });
});

describe("isolated PUT user permissions: generic users:edit is not a delegation ceiling", () => {
  it.each([
    ["ordinary other account", "employee", "branch-a"],
    ["admin account", "admin", "branch-a"],
    ["business owner account", "business_owner", "branch-a"],
    ["shareholder account", "shareholder", "branch-a"],
    ["out-of-branch employee", "employee", "branch-b"],
    ["out-of-branch admin", "admin", "branch-b"],
  ])("KNOWN GAP users:edit-only employee grants unheld privileged actions to %s", async (_label, role, branch) => {
    const f = fixture("other", role, branch);
    const before = structuredClone(f.accounts);
    const res = await f.request("put");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(privileged);
    expect(f.permissions.get("other")).toEqual(privileged);
    expect(f.permissions.has("editor")).toBe(false);
    expect(f.accounts).toEqual(before);
    expect(f.storage.getInheritedPermissions).toHaveBeenCalledExactlyOnceWith("other");
    expect(f.storage.updateUserPermissionsWithAudit).toHaveBeenCalledExactlyOnceWith(
      "other", privileged, "editor", null, [{ permissionId: 901, deny: true }],
    );
    expect(f.overrides.get("other")).toEqual([{ permissionId: 901, deny: true }]);
    expect(f.audits).toEqual([["other", privileged, "editor", null, [{ permissionId: 901, deny: true }]]]);
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

  it("legitimate lower-privilege grant persists and keeps requested inherited permission", async () => {
    const f = fixture();
    const grants = [{ module: "settings", actions: ["view"] }];
    const res = await f.request("put", { body: { permissions: grants, templateApplied: "fixture-template" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(grants);
    expect(f.permissions.get("other")).toEqual(grants);
    expect(f.audits).toEqual([["other", grants, "editor", "fixture-template", [{ permissionId: 901, deny: false }]]]);
  });

  it("non-array permission input is rejected without persistence", async () => {
    const f = fixture();
    const res = await f.request("put", { body: { permissions: { module: "users" } } });
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Invalid permissions format" });
    expect(f.storage.getInheritedPermissions).not.toHaveBeenCalled();
    expect(f.audits).toEqual([]);
  });

  it("module/action vocabulary validation filters invalid entries, not delegation authority", async () => {
    const f = fixture();
    const res = await f.request("put", { body: { permissions: [
      { module: "not_a_real_module", actions: ["edit"] },
      { module: "users", actions: ["not_a_real_action", "delete"] },
      { module: "settings", actions: "edit" },
    ] } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ module: "users", actions: ["delete"] }]);
    expect(f.permissions.get("other")).toEqual(res.body);
  });
});