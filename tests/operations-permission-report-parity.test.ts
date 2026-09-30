import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

vi.mock("../server/storage", () => ({ storage: { getUserPermissions: vi.fn() } }));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(),
  verifyOtpForUser: vi.fn(), logShareholderActivity: vi.fn(),
}));

import {
  filterRoleDeniedPermissions, isRoleModuleDenied, OPERATIONS_MANAGER_DENIED_MODULES,
  OPERATIONS_MANAGER_PERMISSIONS, requireAnyPermission, requirePermission,
} from "../server/auth";
import { ROLE_PERMISSION_TEMPLATES } from "../shared/schema";

// Execute the registered response handlers, not a duplicate merge implementation.
// The large route module is parsed rather than booted, avoiding unrelated services.
const source = ts.createSourceFile("routes.ts", readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
function handlerFor(path: string, dependencies: Record<string, unknown>) {
  let handler: ts.ArrowFunction | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(source) === "app"
      && node.expression.name.text === "get"
      && node.arguments[0] && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === path) {
      const candidate = node.arguments[node.arguments.length - 1];
      if (ts.isArrowFunction(candidate)) handler = candidate;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!handler) throw new Error(`Missing registered route: ${path}`);
  const text = handler.getText(source).replace('await import("./auth")', "authHelpers");
  const compiled = ts.transpileModule(`const handler = ${text};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${compiled}\nreturn handler;`)(...Object.values(dependencies));
}

function operationsEffectiveHelper(dependencies: Record<string, unknown>) {
  let initializer: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "operationsManagerEffectivePermissions") {
      initializer = node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!initializer) throw new Error("Missing operations effective-permissions helper");
  const compiled = ts.transpileModule(`const helper = ${initializer.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${compiled}\nreturn helper;`)(...Object.values(dependencies));
}

const paths = [
  "/api/my-permissions",
  "/api/rbac/users/:id/effective-permissions-detailed",
  "/api/rbac/users/:userId/effective-permissions",
  "/api/rbac/my-permissions",
];
const grants = [
  ...OPERATIONS_MANAGER_DENIED_MODULES.map(module => ({ module, actions: ["view", "edit"] })),
  { module: "operations_hr", actions: ["view"] },
  { module: "operations_payroll", actions: ["view", "edit"] },
  { module: "pnl", actions: ["view"] },
  { module: "attendance", actions: ["view"] },
];

async function responseFor(path: string, role: string, directGrants = grants,
  explicitBranches = ["permitted-branch"], reportedBranches = ["permitted-branch"]) {
  const user = { id: "target", role, username: "target" };
  const flat = directGrants.flatMap(p => p.actions.map(action => ({ module: p.module, action, allowed: true })));
  const metadata = { allowedBranches: reportedBranches, allowedDepartments: [], primaryRole: null };
  const deps = {
    getCurrentUser: () => user,
    storage: {
      getUser: async () => user,
      getUserPermissions: async () => directGrants,
      getUserBranchAccess: async () => explicitBranches.map(branchId => ({ branchId })),
      getUserEffectivePermissions: async () => ({ ...metadata, permissions: flat }),
    },
    getCachedPermissions: async () => directGrants,
    authHelpers: { getCachedPermissionsForUser: () => null },
    filterRoleDeniedPermissions,
    OPERATIONS_MANAGER_PERMISSIONS,
    SYSTEM_MODULES: grants.map(p => p.module),
    MODULE_ACTIONS: ["view", "edit"],
    HR_MANAGER_MODULES: [],
    HR_SPECIALIST_PERMISSIONS: {},
    FINANCIAL_MANAGER_PERMISSIONS: {},
    HQ_BRANCH_ID: "main_warehouse",
  };
  const routeDependencies = {
    ...deps, operationsManagerEffectivePermissions: operationsEffectiveHelper(deps),
  };
  const response: any = { json: vi.fn(), status: vi.fn(() => response) };
  await handlerFor(path, routeDependencies)({ params: { id: "target", userId: "target" } }, response);
  expect(response.status).not.toHaveBeenCalled();
  return response.json.mock.calls[0][0];
}

describe("operations-manager permission reports match the hard endpoint deny", () => {
  it("uses the admin role template as the exact source of scoped HR intrinsic grants", () => {
    for (const [module, actions] of Object.entries({
      operations_hr: ["view"],
      operations_payroll: ["view", "export", "approve"],
      operations_joining: ["view", "create", "approve"],
      operations_employee_transfer: ["view", "create"],
    })) {
      expect(ROLE_PERMISSION_TEMPLATES.operations_manager.find(p => p.module === module)?.actions).toEqual(actions);
      expect(OPERATIONS_MANAGER_PERMISSIONS[module]).toEqual(actions);
    }
    for (const module of OPERATIONS_MANAGER_DENIED_MODULES) {
      expect(OPERATIONS_MANAGER_PERMISSIONS[module]).toBeUndefined();
    }
  });

  it.each(paths)("advertises all approved scoped HR defaults in %s without needing stored grants", async path => {
    const response = await responseFor(path, "operations_manager", []);
    const permissions = Array.isArray(response) ? response : response.permissions;
    for (const module of ["operations_payroll", "operations_joining", "operations_employee_transfer"]) {
      const rows = permissions.filter((p: any) => p.module === module);
      const actions = rows.flatMap((p: any) => p.actions
        ? p.actions.map((a: any) => typeof a === "string" ? a : a.action)
        : [p.action]);
      for (const action of OPERATIONS_MANAGER_PERMISSIONS[module]) expect(actions).toContain(action);
    }
  });

  it.each(["/api/rbac/users/:userId/effective-permissions", "/api/rbac/my-permissions"])(
    "rejects historical global/default branch fallback in %s", async path => {
      const response = await responseFor(path, "operations_manager", [], [], ["all-company", "main_warehouse"]);
      expect(response.allowedBranches).toEqual([]);
      expect(response.permissions.some((p: any) =>
        p.module === "operations_payroll" && p.action === "approve" && p.allowed === true)).toBe(true);
    },
  );

  it.each(["/api/rbac/users/:userId/effective-permissions", "/api/rbac/my-permissions"])(
    "uses only current explicit unique non-HQ branch grants in %s", async path => {
      const response = await responseFor(path, "operations_manager", [],
        ["permitted-branch", "permitted-branch", "main_warehouse"], ["all-company"]);
      expect(response.allowedBranches).toEqual(["permitted-branch"]);
      expect(response.allowedDepartments).toEqual([]);
    },
  );

  it.each(["/api/rbac/users/:userId/effective-permissions", "/api/rbac/my-permissions"])(
    "does not alter another role's RBAC branch scope in %s", async path => {
      const response = await responseFor(path, "employee", [],
        ["permitted-branch"], ["assigned-global-branch", "main_warehouse"]);
      expect(response.allowedBranches).toEqual(["assigned-global-branch", "main_warehouse"]);
      expect(response.permissions).toEqual([]);
    },
  );

  it.each(paths)("strips stale legacy grants from %s after merging", async path => {
    const response = await responseFor(path, "operations_manager");
    const permissions = Array.isArray(response) ? response : response.permissions;
    const modules = permissions.map((p: any) => p.module);
    for (const module of OPERATIONS_MANAGER_DENIED_MODULES) expect(modules).not.toContain(module);
    expect(modules).toContain("operations_hr");
    expect(modules).toContain("operations_payroll");
    expect(modules).toContain("pnl");
    if (path.includes("effective-permissions-detailed")) {
      expect(modules).toContain("pnl_dashboard");
      expect(modules).toContain("attendance_check");
      expect(permissions.find((p: any) => p.module === "pnl").actions[0].sources).toContain("direct");
    }
    if (path === "/api/rbac/my-permissions" || path.endsWith("/effective-permissions")) {
      expect(response.allowedBranches).toEqual(["permitted-branch"]);
    }
  });

  it.each(paths)("preserves non-operations grants in %s", async path => {
    const response = await responseFor(path, "employee");
    const permissions = Array.isArray(response) ? response : response.permissions;
    for (const module of OPERATIONS_MANAGER_DENIED_MODULES) {
      expect(permissions.some((p: any) => p.module === module)).toBe(true);
    }
  });

  it.each(OPERATIONS_MANAGER_DENIED_MODULES)("still denies %s at the actual endpoint middleware", async module => {
    const res: any = { status: vi.fn(() => res), json: vi.fn() };
    const next = vi.fn();
    await requirePermission(module, "view")({
      currentUser: { id: "target", role: "operations_manager" },
      authPermissions: grants,
    } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(isRoleModuleDenied("operations_manager", module)).toBe(true);
  });

  it.each(OPERATIONS_MANAGER_DENIED_MODULES)("denies any-action access to %s despite stale direct grants", async module => {
    const res: any = { status: vi.fn(() => res), json: vi.fn() };
    const next = vi.fn();
    await requireAnyPermission(module, ["view", "edit"])({
      currentUser: { id: "target", role: "operations_manager" },
      authPermissions: grants,
    } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects forbidden any-action access before reading permission grants", async () => {
    const res: any = { status: vi.fn(() => res), json: vi.fn() };
    const next = vi.fn();
    const req = {
      currentUser: { id: "target", role: "operations_manager" },
      get authPermissions() { throw new Error("Permission lookup must not run"); },
    };
    await requireAnyPermission("salary_closing", ["edit"])(req as any, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it.each(["operations_hr", "operations_payroll"])("retains allowed any-action semantics for %s", async module => {
    const intrinsic = OPERATIONS_MANAGER_PERMISSIONS[module];
    const allowedAction = intrinsic?.[0] ?? "view";
    const res: any = { status: vi.fn(() => res), json: vi.fn() };
    const next = vi.fn();
    await requireAnyPermission(module, ["ungranted_action", allowedAction])({
      currentUser: { id: "target", role: "operations_manager" },
      authPermissions: intrinsic ? [] : [{ module, actions: [allowedAction] }],
    } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("preserves other roles' direct grants on legacy modules", async () => {
    const res: any = { status: vi.fn(() => res), json: vi.fn() };
    const next = vi.fn();
    await requireAnyPermission("salary_closing", ["delete", "edit"])({
      currentUser: { id: "target", role: "employee" },
      authPermissions: [{ module: "salary_closing", actions: ["edit"] }],
    } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("still requires a matching direct action for non-template operations modules", async () => {
    for (const [actions, permitted] of [[["edit", "view"], true], [["edit", "delete"], false]] as const) {
      const res: any = { status: vi.fn(() => res), json: vi.fn() };
      const next = vi.fn();
      await requireAnyPermission("custom_ops_report", [...actions])({
        currentUser: { id: "target", role: "operations_manager" },
        authPermissions: [{ module: "custom_ops_report", actions: ["view"] }],
      } as any, res, next);
      if (permitted) expect(next).toHaveBeenCalledOnce();
      else { expect(next).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(403); }
    }
  });

  it("preserves record metadata and does not mutate stored grants", () => {
    const rows = [
      { module: "salary_closing", allowed: true, action: "edit" },
      { module: "operations_hr", allowed: false, action: "edit" },
    ];
    expect(filterRoleDeniedPermissions("operations_manager", rows)).toEqual([rows[1]]);
    expect(rows).toHaveLength(2);
    expect(filterRoleDeniedPermissions("admin", rows)).toEqual(rows);
  });
});