import { readFileSync } from "node:fs";
import { createContext, Script } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { assignmentUserId, assignmentCreateBody, assignmentUpdateBody, normalizeAssignmentScope, isValidAssignmentScopeAndTime } from "../server/user-assignment-validation";

// Execute original AST-selected handlers, never import/bootstrap the server.
// Authentication/middleware is covered by governance-route-isolated; these
// synthetic actors already have generic grants and exercise the authority gate.
const routesSource = ts.createSourceFile("server/routes.ts", readFileSync("server/routes.ts", "utf8"),
  ts.ScriptTarget.Latest, true);
const schemaSource = ts.createSourceFile("shared/schema.ts", readFileSync("shared/schema.ts", "utf8"),
  ts.ScriptTarget.Latest, true);

function declarations(source: ts.SourceFile, roots: string[]) {
  const available = new Map<string, ts.Node>();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) available.set(statement.name.text, statement);
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) available.set(declaration.name.text, statement);
    }
  }
  const selected = new Set<ts.Node>();
  function select(name: string) {
    const node = available.get(name);
    if (!node) throw new Error(`Missing declaration ${name}`);
    if (selected.has(node)) return;
    selected.add(node);
    function visit(child: ts.Node) {
      if (ts.isIdentifier(child) && available.has(child.text)) select(child.text);
      ts.forEachChild(child, visit);
    }
    visit(node);
  }
  roots.forEach(select);
  return source.statements.filter(node => selected.has(node)).map(node => node.getText(source)).join("\n");
}

function handler(method: string, path: string) {
  const matches: ts.ArrowFunction[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(routesSource) === "app" && node.expression.name.text === method
      && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === path) {
      const last = node.arguments[node.arguments.length - 1];
      if (!ts.isArrowFunction(last)) throw new Error("Expected original inline handler");
      matches.push(last);
    }
    ts.forEachChild(node, visit);
  }
  visit(routesSource);
  if (matches.length !== 1) throw new Error(`Expected one route: ${method} ${path}`);
  return matches[0].getText(routesSource);
}

const writers = [
  ["put", "/api/users/:id/permissions"],
  ["post", "/api/users/:id/permission-override"],
  ["delete", "/api/users/:id/permission-override/:permissionId"],
  ["post", "/api/rbac/roles"],
  ["patch", "/api/rbac/roles/:id"],
  ["post", "/api/rbac/roles/:roleId/permissions"],
  ["delete", "/api/rbac/roles/:roleId/permissions/:permissionId"],
  ["post", "/api/rbac/users/:userId/assignments"],
  ["patch", "/api/rbac/users/:userId/assignments/:assignmentId"],
  ["delete", "/api/rbac/users/:userId/assignments/:assignmentId"],
  ["post", "/api/rbac/users/:userId/overrides"],
  ["delete", "/api/rbac/users/:userId/overrides/:overrideId"],
  ["post", "/api/rbac/users/:userId/branches"],
  ["delete", "/api/rbac/users/:userId/branches/:branchId"],
  ["patch", "/api/rbac/users/:userId/branches/:branchId/default"],
  ["post", "/api/rbac/role-templates"],
  ["patch", "/api/rbac/role-templates/:id"],
  ["delete", "/api/rbac/role-templates/:id"],
  ["post", "/api/rbac/roles/:roleId/apply-template/:templateId"],
] as const;

function forbidden(name: string): never { throw new Error(`Unexpected I/O: ${name}`); }
function strict(name: string, values: Record<string, unknown> = {}) {
  return new Proxy(values, {
    get(target, key) {
      if (!(key in target)) return forbidden(`${name}.${String(key)}`);
      return target[String(key)];
    },
  });
}

async function request(method: string, path: string, options: {
  role?: string; body?: unknown; storage?: Record<string, unknown>;
} = {}) {
  const code = [
    declarations(routesSource, ["getCurrentUser"]),
    declarations(schemaSource, ["SYSTEM_MODULES", "MODULE_ACTIONS", "JOB_TITLES"]),
    `const selectedHandler = ${handler(method, path)};`,
  ].join("\n");
  const compiled = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    reportDiagnostics: true,
  });
  expect(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error)).toEqual([]);
  const io = strict("blocked");
  const invalidateAuthCache = vi.fn();
  const storage = strict("storage", options.storage);
  const context = createContext({
    storage, z, db: io, pool: io, process: io, invalidateAuthCache,
    assignmentUserId, assignmentCreateBody, assignmentUpdateBody, normalizeAssignmentScope, isValidAssignmentScopeAndTime,
    getCachedBranches: () => forbidden("getCachedBranches"),
    fetch: () => forbidden("fetch"), require: () => forbidden("require"),
    console: strict("console", { log: vi.fn(), error: () => forbidden("caught route error") }),
  }, { codeGeneration: { strings: false, wasm: false } });
  new Script(compiled.outputText.replace(/^export /gm, "").replace(/^export \{\};?$/gm, ""))
    .runInContext(context, { timeout: 1000 });
  const selected = new Script("selectedHandler").runInContext(context);
  const req = {
    currentUser: { id: "editor", role: options.role ?? "employee" },
    authPermissions: [{ module: "users", actions: ["create", "edit", "delete"] },
      { module: "rbac_management", actions: ["create", "edit", "delete"] }],
    params: { id: path === "/api/rbac/roles/:id" ? "9" : "other", userId: "other", roleId: "9", permissionId: "7",
      overrideId: "8", assignmentId: "41", branchId: "branch-b", templateId: "3" },
    body: options.body ?? {
      permissions: [{ module: "users", actions: ["delete"] }], roleId: 9,
      permissionId: 7, allow: true, branchId: "all_branches", scopeType: "global",
      name: "test-role", slug: "test-role",
    },
    ip: "isolated",
  };
  const res = {
    statusCode: 200, body: undefined as unknown, ended: false,
    status(status: number) { this.statusCode = status; return this; },
    json(body: unknown) { this.body = body; this.ended = true; return this; },
    send() { this.ended = true; return this; },
  };
  await selected(req, res);
  expect(res.ended).toBe(true);
  return { res, invalidateAuthCache };
}

describe("global authority writers fail closed before storage", () => {
  for (const [method, path] of writers) {
    it.each(["employee", "operations_manager", "branch_manager", "hr_manager", "business_owner"])(
      `${method} ${path}: generic-granted %s cannot delegate global authority`, async role => {
        const { res, invalidateAuthCache } = await request(method, path, { role });
        expect(res.statusCode).toBe(403);
        expect((res.body as any).error).toContain("مسار التفويض المعتمد");
        if (!path.includes("/assignments/:assignmentId")) {
          expect((res.body as any).error).toContain("/api/operations/employee-accounts/:employeeId/permissions");
        }
        expect(invalidateAuthCache).not.toHaveBeenCalled();
      },
    );
  }

  it("admin PUT selects direct permissions without manufacturing omission denies and retains cache invalidation", async () => {
    const grants = [{ module: "users", actions: ["delete"] }];
    const getInheritedPermissions = vi.fn(async () => [{ module: "settings", action: "view", permissionId: 901 }]);
    const updateUserPermissionsWithAudit = vi.fn(async () => grants);
    const { res, invalidateAuthCache } = await request("put", "/api/users/:id/permissions", {
      role: "admin", storage: { getInheritedPermissions, updateUserPermissionsWithAudit },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(grants);
    expect(updateUserPermissionsWithAudit).toHaveBeenCalledExactlyOnceWith(
      "other", grants, "editor", null, [],
    );
    expect(getInheritedPermissions).not.toHaveBeenCalled();
    expect(invalidateAuthCache).toHaveBeenCalledExactlyOnceWith("other");
  });

  it("admin role edit retains original storage operation", async () => {
    const updateRole = vi.fn(async () => ({ id: 9, name: "updated" }));
    const { res } = await request("patch", "/api/rbac/roles/:id", {
      role: "admin", body: { name: "updated" }, storage: { updateRole },
    });
    expect(res.statusCode).toBe(200);
    expect(updateRole).toHaveBeenCalledExactlyOnceWith(9, { name: "updated" });
  });
});

describe("generic account authority bypass protection", () => {
  it.each([
    { actorRole: "admin", accountRole: "admin" },
    { actorRole: "employee", accountRole: "viewer" },
    { actorRole: "employee", accountRole: "employee" },
  ])("authorized creation compatibility: $actorRole creates unscoped $accountRole", async ({ actorRole, accountRole }) => {
    const getUserByUsername = vi.fn(async () => undefined);
    const createUser = vi.fn(async data => ({ id: "created", ...data }));
    const { res } = await request("post", "/api/users", {
      role: actorRole, body: { username: "test-user", password: "Test12345", role: accountRole },
      storage: { getUserByUsername, createUser },
    });
    expect(res.statusCode).toBe(201);
    expect(createUser).toHaveBeenCalledOnce();
    expect((res.body as any).password).toBeUndefined();
  });

  it.each([
    { role: "admin" }, { role: "employee", jobTitle: "delivery" },
    { role: "viewer", branchId: "all_branches" }, { branchIds: ["branch-b"] },
  ])("creation cannot freely assign authority or branches: %j", async body => {
    const { res } = await request("post", "/api/users", {
      body: { username: "test-user", password: "Test12345", ...body },
    });
    expect(res.statusCode).toBe(403);
  });

  it.each([
    { role: "admin" }, { jobTitle: "delivery" }, { jobTitle: null },
    { branchId: "all_branches" }, { branchIds: ["branch-b"] },
    { password: "Test12345" }, { isActive: "active" },
  ])("security-bearing PATCH %j denies before any storage read", async body => {
    const { res } = await request("patch", "/api/users/:id", { body });
    expect(res.statusCode).toBe(403);
  });

  it.each(["admin", "business_owner"])("protected %s target blocks even ordinary profile edits", async role => {
    const getUser = vi.fn(async () => ({ id: "other", role }));
    const { res } = await request("patch", "/api/users/:id", {
      body: { firstName: "Updated" }, storage: { getUser },
    });
    expect(res.statusCode).toBe(403);
    expect(getUser).toHaveBeenCalledExactlyOnceWith("other");
  });

  it("ordinary employee name edit remains available without grants changing", async () => {
    const getUser = vi.fn(async () => ({ id: "other", role: "employee", isActive: "active" }));
    const updateUser = vi.fn(async (_id, changes) => ({ id: "other", role: "employee", ...changes }));
    const { res } = await request("patch", "/api/users/:id", {
      body: { firstName: "Updated", lastName: "Name" }, storage: { getUser, updateUser },
    });
    expect(res.statusCode).toBe(200);
    expect(updateUser).toHaveBeenCalledExactlyOnceWith("other", { firstName: "Updated", lastName: "Name" });
  });

  it("admin retains password editing with session invalidation", async () => {
    const getUser = vi.fn(async () => ({ id: "other", role: "admin", isActive: "active" }));
    const updateUser = vi.fn(async (_id, changes) => ({ id: "other", role: "admin", ...changes }));
    const invalidateAllUserSessions = vi.fn(async () => undefined);
    const { res } = await request("patch", "/api/users/:id", {
      role: "admin", body: { password: "Test12345" },
      storage: { getUser, updateUser, invalidateAllUserSessions },
    });
    expect(res.statusCode).toBe(200);
    expect(updateUser).toHaveBeenCalledExactlyOnceWith("other", { password: "Test12345" });
    expect(invalidateAllUserSessions).toHaveBeenCalledExactlyOnceWith("other");
    expect((res.body as any).password).toBeUndefined();
  });
});