import { readFileSync } from "node:fs";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({ branches: ["branch-a"] as string[] }));
vi.mock("../server/storage", () => ({
  storage: { getUserBranchAccess: vi.fn(async () => access.branches.map(branchId => ({ branchId }))) },
}));
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(),
  verifyOtpForUser: vi.fn(), logShareholderActivity: vi.fn(),
}));

import { canAccessBranch, requirePermission } from "../server/auth";
import { operationsPayrollCsv } from "../server/operations-hr-routes";
import { payrollReadError, readPayrollSource } from "../server/operations-payroll-report";
import { buildOperationsPayrollExport } from "../server/operations-payroll-export";
import { operationsPayrollFullCsv } from "../shared/operations-payroll-export";

// Run the actual scope function and registered route handlers without booting
// unrelated services in routes.ts. Persistence is mocked; grants and scope are not.
const source = ts.createSourceFile("routes.ts", readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
function expressionFor(name: string) {
  let expression: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) expression = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!expression) throw new Error(`Missing declaration ${name}`);
  return expression.getText(source);
}
function routeFor(path: string) {
  let route: ts.CallExpression | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(source) === "app"
      && node.arguments[0] && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === path) route = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!route) throw new Error(`Missing route ${path}`);
  return route;
}
function evaluate(expression: string, dependencies: Record<string, unknown>) {
  const compiled = ts.transpileModule(`const handler = ${expression};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${compiled}\nreturn handler;`)(...Object.values(dependencies));
}

const scope = evaluate(expressionFor("operationsPayrollScope"), {
  HQ_BRANCH_ID: "main_warehouse",
  canAccessBranch,
  isValidMonth: (month: unknown) => typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month),
});
const report = {
  lines: [{ branchEmployeeId: 18, employeeName: "Scoped employee", netSalary: 1000 }],
  totals: { totalNet: 1000, employeeCount: 1 }, isLocked: true, enrichmentFailures: [], warnings: [],
  unlinkedSummary: { totalRecords: 0, presentRecords: 0, totalHours: 0 },
};
const preview = vi.fn(async () => report);
const saved: Record<string, unknown>[] = [];
const db = {
  select: () => ({ from: () => ({ where: async () => [] }) }),
  insert: () => ({
    values: (value: Record<string, unknown>) => ({
      onConflictDoUpdate: () => ({
        returning: async () => { saved.push(value); return [value]; },
      }),
    }),
  }),
};
const dependencies = {
  operationsPayrollScope: scope,
  buildBranchPreview: preview,
  db,
  operationsPayrollReviews: { branchId: "branchId", month: "month", reviewedBy: "reviewedBy" },
  eq: (...args: unknown[]) => args,
  and: (...args: unknown[]) => args,
  operationsPayrollCsv,
  payrollReadError,
  readPayrollSource,
  buildOperationsPayrollExport, operationsPayrollFullCsv,
  storage: { getBranch: async () => ({ id: "branch-a", name: "الفرع" }), getSalaryPaymentsByBranchAndMonth: async () => [] },
};
const cases = [
  { path: "/api/operations-hr/payroll", action: "view", method: "GET" },
  { path: "/api/operations-hr/payroll/export", action: "export", method: "GET" },
  { path: "/api/operations-hr/payroll/review", action: "approve", method: "POST" },
];
async function invoke(test: typeof cases[number], branchId = "branch-a", role = "operations_manager") {
  const req: any = {
    currentUser: { id: "ops-actor", role, branchId: "ungranted-default" },
    authPermissions: [], userBranchAccess: access.branches.map(branchId => ({ branchId })),
    method: test.method, query: test.method === "GET" ? { branchId, month: "2026-09" } : {},
    body: test.method === "POST" ? { branchId, month: "2026-09", note: "Reviewed by operations" } : {},
  };
  const res: any = {
    status: vi.fn(() => res), json: vi.fn(() => res), set: vi.fn(() => res),
    type: vi.fn(() => res), attachment: vi.fn(() => res), send: vi.fn(() => res),
  };
  const route = routeFor(test.path);
  const registration = route.getText(source);
  expect(registration).toContain('requirePermission("operations_hr", "view")');
  expect(registration).toContain(`requirePermission("operations_payroll", "${test.action}")`);
  for (const [module, action] of [["operations_hr", "view"], ["operations_payroll", "view"], ["operations_payroll", test.action]]) {
    let allowed = false;
    await requirePermission(module, action)(req, res, () => { allowed = true; });
    if (!allowed) return res;
  }
  await evaluate(route.arguments[route.arguments.length - 1].getText(source), dependencies)(req, res);
  return res;
}

describe("intrinsic operations payroll grants remain branch-scoped and advisory", () => {
  beforeEach(() => { access.branches = ["branch-a"]; preview.mockClear(); saved.length = 0; });

  it.each(cases)("permits $action without manually stored permission rows", async test => {
    const res = await invoke(test);
    expect(res.status).not.toHaveBeenCalled();
    if (test.action === "approve") {
      expect(saved).toEqual([{ branchId: "branch-a", month: "2026-09", reviewedBy: "ops-actor", note: "Reviewed by operations" }]);
      // Review only writes its own advisory row, not a salary closure or payment.
      expect(preview).not.toHaveBeenCalled();
    } else {
      expect(preview).toHaveBeenCalledWith("branch-a", "2026-09");
      expect(saved).toEqual([]);
      expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
    }
  });

  it.each(cases)("denies $action outside branch grants before reading or writing payroll", async test => {
    const res = await invoke(test, "branch-b");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(preview).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it.each(cases)("denies $action with zero branch grants despite intrinsic capability", async test => {
    access.branches = [];
    const res = await invoke(test);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(preview).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it.each(cases)("denies $action for HQ even when an obsolete branch grant names it", async test => {
    access.branches = ["main_warehouse"];
    const res = await invoke(test, "main_warehouse");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(preview).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it.each(cases)("rejects aggregate branch scope for $action", async test => {
    const res = await invoke(test, "all");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(preview).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it("monthly payroll capability uses current role defaults despite empty or stale direct grants", async () => {
    const monthlySource = ts.createSourceFile("operations-month-workflow.ts",
      readFileSync("server/operations-month-workflow.ts", "utf8"), ts.ScriptTarget.Latest, true);
    let declaration: ts.FunctionDeclaration | undefined;
    function visit(node: ts.Node) {
      if (ts.isFunctionDeclaration(node) && node.name?.text === "hasEffectiveViewPermission") declaration = node;
      ts.forEachChild(node, visit);
    }
    visit(monthlySource);
    if (!declaration) throw new Error("Missing actual monthly capability checker");
    const checker = evaluate(declaration.getText(monthlySource), { requirePermission });
    for (const authPermissions of [[], [{ module: "operations_payroll", actions: [] }]]) {
      const req = { currentUser: { id: "ops-actor", role: "operations_manager" }, authPermissions };
      expect(await checker(req, "operations_hr")).toBe(true);
      expect(await checker(req, "operations_payroll")).toBe(true);
      expect(await checker(req, "salary_closing")).toBe(false);
    }
  });
});