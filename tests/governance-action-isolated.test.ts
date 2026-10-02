/**
 * Isolated G03 security regressions, not live security certification.
 * Only the permission middleware and AST-extracted HR route execute.
 * Authentication/session establishment is outside this synthetic request harness.
 * No server bootstrap, real storage, database, network or production accounts.
 */
import { readFileSync } from "node:fs";
import ts from "typescript";
import { Socket } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({
  unexpected: vi.fn((): never => { throw new Error("Unexpected external I/O in isolated governance probe"); }),
  auditWrite: vi.fn(async () => undefined),
}));
vi.mock("../server/storage", () => ({
  storage: new Proxy({}, { get: () => io.unexpected }),
}));
vi.mock("../server/db", () => ({
  db: new Proxy({}, { get: (_target, key) => key === "insert"
    ? (table: unknown) => {
      expect(table).toBe(systemAuditLogs);
      return { values: io.auditWrite };
    } : io.unexpected }),
  pool: new Proxy({}, { get: () => io.unexpected }),
}));
vi.mock("../server/security", () => ({
  isLoginBlocked: io.unexpected, trackLoginAttempt: io.unexpected,
}));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: io.unexpected, issueOtpForUser: io.unexpected,
  verifyOtpForUser: io.unexpected, logShareholderActivity: io.unexpected,
}));

import {
  requirePermission, requireAnyPermission, getEffectiveBranchFilter, hasCrossBranchHrReadAccess,
  HR_MANAGER_MODULES, HR_SPECIALIST_PERMISSIONS, FINANCIAL_MANAGER_PERMISSIONS,
  OPERATIONS_MANAGER_PERMISSIONS,
  hasPermissionScopeConstraint,
} from "../server/auth";
import { employeeDocuments, branchEmployees, systemAuditLogs, MODULE_ACTIONS, ROLE_PERMISSION_TEMPLATES } from "../shared/schema";
import { normalizePermissionDecisionSnapshot } from "../server/permission-decision";

let blockSockets: ReturnType<typeof vi.spyOn>;
beforeAll(() => {
  blockSockets = vi.spyOn(Socket.prototype, "connect").mockImplementation(io.unexpected);
  vi.stubGlobal("fetch", io.unexpected);
});
afterAll(() => {
  expect(io.unexpected).not.toHaveBeenCalled();
  blockSockets.mockRestore();
  vi.unstubAllGlobals();
});

function request(role: string, method: string, module = "employee_reports", actions = ["view"]) {
  const req = {
    method, currentUser: { id: "synthetic-actor", role, branchId: "test-branch-a" },
    authPermissions: [{ module, actions }],
    userBranchAccess: [{ branchId: "test-branch-a", accessLevel: "full" }],
    operationsPermissionDenials: new Set<string>(),
    session: {}, params: { id: "71" }, query: {}, body: {},
    headers: {}, originalUrl: "/isolated-probe",
  };
  // Exercise the authoritative snapshot path, not the legacy authPermissions
  // fallback. Re-normalize this synthetic loaded data so subsequent explicit
  // denials added by a test are reflected without any storage/database lookup.
  return Object.defineProperty(req, "authPermissionDecisionSnapshot", {
    get: () => ({
      ...normalizePermissionDecisionSnapshot({
        userId: req.currentUser.id,
        sourceMode: null,
        direct: req.authPermissions,
        roles: [],
        overrides: [...req.operationsPermissionDenials].map((key, index) => {
          const [deniedModule, action] = key.split(":");
          return {
            module: deniedModule, action, permissionId: index + 1, allow: false,
            branchId: null, departmentId: null, expiresAt: null,
          };
        }),
      }),
      // Preserve actual raw module selections, including explicit empty arrays.
      directPermissions: req.authPermissions,
    }),
    enumerable: true,
  });
}
function response() {
  const res: any = { statusCode: 200, payload: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (payload: unknown) => { res.payload = payload; return res; };
  return res;
}
async function gate(req: any, module: string, action?: string) {
  const res = response();
  const next = vi.fn();
  await requirePermission(module, action)(req, res, next);
  return { passed: next.mock.calls.length === 1, status: res.statusCode };
}
async function anyGate(req: any, module: string, actions: string[]) {
  const res = response();
  const next = vi.fn();
  await requireAnyPermission(module, actions)(req, res, next);
  return { passed: next.mock.calls.length === 1, status: res.statusCode };
}

describe("isolated action inference — G03 security regressions", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "CONTROL: ordinary view-only employee is denied %s with omitted action", async method => {
      expect(await gate(request("employee", method), "employee_reports"))
        .toEqual({ passed: false, status: 403 });
    },
  );
  it("CONTROL: ordinary view-only employee can GET", async () => {
    expect(await gate(request("employee", "GET"), "employee_reports"))
      .toEqual({ passed: true, status: 200 });
  });
  for (const [role, intrinsic] of [
    ["hr_specialist", HR_SPECIALIST_PERMISSIONS],
    ["financial_manager", FINANCIAL_MANAGER_PERMISSIONS],
    ["operations_manager", OPERATIONS_MANAGER_PERMISSIONS],
  ] as const) {
    it.each([
      ["POST", "create"], ["PUT", "edit"], ["PATCH", "edit"], ["DELETE", "delete"],
    ])(`${role} rejects %s both without action and with explicit %s`, async (method, action) => {
      expect(intrinsic.employee_reports).toContain("view");
      expect(intrinsic.employee_reports).not.toContain(action);
      const req = request(role, method);
      expect(await gate(req, "employee_reports")).toEqual({ passed: false, status: 403 });
      expect(await gate(req, "employee_reports", action)).toEqual({ passed: false, status: 403 });
    });
  }
  it("CONTROL: current admin bypass remains intact, including explicit delete", async () => {
    const req = request("admin", "DELETE", "employee_reports", []);
    expect(await gate(req, "employee_reports", "delete")).toEqual({ passed: true, status: 200 });
  });
  it("CONTROL: no authenticated identity returns 401", async () => {
    const req = { ...request("employee", "GET"), currentUser: undefined };
    expect(await gate(req, "employee_reports")).toEqual({ passed: false, status: 401 });
  });
});

describe("role/action matrix with mocked I/O only", () => {
  const methods = [
    ["GET", "view"], ["HEAD", "view"], ["OPTIONS", "view"], ["POST", "create"],
    ["PUT", "edit"], ["PATCH", "edit"], ["DELETE", "delete"], ["UNKNOWN", "edit"],
  ] as const;

  // Financial and operations maps are template-backed; neither HR role has a
  // shared template. Specialist uses its narrower map; manager responses expose
  // all MODULE_ACTIONS on HR_MANAGER_MODULES, which must remain legitimate.
  for (const role of ["financial_manager", "operations_manager"] as const) {
    for (const { module, actions } of ROLE_PERMISSION_TEMPLATES[role]) {
      it.each(methods)(`${role}/${module} %s matches template action %s`, async (method, action) => {
        const req = request(role, method, module, []);
        const expected = actions.includes(action as any)
          ? { passed: true, status: 200 } : { passed: false, status: 403 };
        expect(await gate(req, module)).toEqual(expected);
        expect(await gate(req, module, action)).toEqual(expected);
        expect(await anyGate(req, module, [action])).toEqual(expected);
      });
    }
  }
  for (const [module, actions] of Object.entries(HR_SPECIALIST_PERMISSIONS)) {
    it.each(methods)(`hr_specialist/${module} %s matches local action %s`, async (method, action) => {
      const req = request("hr_specialist", method, module, []);
      const expected = actions.includes(action)
        ? { passed: true, status: 200 } : { passed: false, status: 403 };
      expect(await gate(req, module)).toEqual(expected);
      expect(await gate(req, module, action)).toEqual(expected);
      expect(await anyGate(req, module, [action])).toEqual(expected);
    });
  }
  it("HR manager keeps finite legitimate HR breadth and rejects unknown actions", async () => {
    expect(ROLE_PERMISSION_TEMPLATES.hr_manager).toBeUndefined();
    expect(ROLE_PERMISSION_TEMPLATES.hr_specialist).toBeUndefined();
    for (const module of HR_MANAGER_MODULES) {
      for (const [method] of methods) {
        expect(await gate(request("hr_manager", method, module, []), module))
          .toEqual({ passed: true, status: 200 });
      }
      for (const action of MODULE_ACTIONS) {
        const req = request("hr_manager", "POST", module, []);
        expect(await gate(req, module, action)).toEqual({ passed: true, status: 200 });
        expect(await anyGate(req, module, [action])).toEqual({ passed: true, status: 200 });
      }
      const req = request("hr_manager", "POST", module, []);
      expect(await gate(req, module, "unknown-action")).toEqual({ passed: false, status: 403 });
      expect(await anyGate(req, module, ["unknown-action"])).toEqual({ passed: false, status: 403 });
    }
    expect(await gate(request("hr_manager", "GET", "inventory", []), "inventory"))
      .toEqual({ passed: false, status: 403 });
  });
  it.each(["GET", "HEAD", "OPTIONS"])("viewer and attendance clerk retain legitimate %s reads", async method => {
    expect(await gate(request("viewer", method), "employee_reports")).toEqual({ passed: true, status: 200 });
    expect(await gate(request("attendance_clerk", method, "attendance_check", []), "attendance_check"))
      .toEqual({ passed: true, status: 200 });
  });
  it.each(["POST", "PUT", "PATCH", "DELETE", "UNKNOWN"])("viewer remains read-only for %s despite broad grants", async method => {
    expect(await gate(request("viewer", method, "employee_reports", [...MODULE_ACTIONS]), "employee_reports"))
      .toEqual({ passed: false, status: 403 });
  });
  it("clerk remains confined to attendance_check and cannot delete", async () => {
    for (const method of ["POST", "PUT", "PATCH"]) {
      expect(await gate(request("attendance_clerk", method, "attendance_check", []), "attendance_check"))
        .toEqual({ passed: true, status: 200 });
    }
    expect(await gate(request("attendance_clerk", "DELETE", "attendance_check", [...MODULE_ACTIONS]), "attendance_check"))
      .toEqual({ passed: false, status: 403 });
    expect(await gate(request("attendance_clerk", "GET", "hr_documents", [...MODULE_ACTIONS]), "hr_documents"))
      .toEqual({ passed: false, status: 403 });
    expect(await anyGate(request("attendance_clerk", "GET", "hr_documents", [...MODULE_ACTIONS]), "hr_documents", ["view"]))
      .toEqual({ passed: false, status: 403 });
  });
  it("operations hard denies and explicit action denials still beat broad grants", async () => {
    for (const module of ["hr_management", "salary_closing", "hr_onboarding", "hr_job_offers", "employee_transfers"]) {
      const req = request("operations_manager", "GET", module, [...MODULE_ACTIONS]);
      expect(await gate(req, module)).toEqual({ passed: false, status: 403 });
      expect(await anyGate(req, module, ["view", "edit"])).toEqual({ passed: false, status: 403 });
    }
    const req = request("operations_manager", "PATCH", "operations", [...MODULE_ACTIONS]);
    req.operationsPermissionDenials.add("operations:edit");
    expect(await gate(req, "operations")).toEqual({ passed: false, status: 403 });
    expect(await gate(req, "operations", "edit")).toEqual({ passed: false, status: 403 });
    expect(await anyGate(req, "operations", ["edit"])).toEqual({ passed: false, status: 403 });
    expect(await anyGate(req, "operations", ["edit", "view"])).toEqual({ passed: true, status: 200 });
  });
  it("intrinsic maps remain grants, not new caps on individually authorized extras", async () => {
    for (const role of ["hr_specialist", "financial_manager", "operations_manager"]) {
      const req = request(role, "DELETE", "employee_reports", ["delete"]);
      expect(await gate(req, "employee_reports")).toEqual({ passed: true, status: 200 });
    }
  });
  it("explicit view still supports semantic read POSTs and admin retains full bypass", async () => {
    for (const role of ["employee", "hr_specialist", "financial_manager", "operations_manager", "viewer"]) {
      expect(await gate(request(role, "POST"), "employee_reports", "view"))
        .toEqual({ passed: true, status: 200 });
    }
    const req = request("admin", "DELETE", "salary_closing", []);
    req.operationsPermissionDenials.add("salary_closing:delete");
    expect(await gate(req, "salary_closing")).toEqual({ passed: true, status: 200 });
    expect(await gate(req, "salary_closing", "unknown-action")).toEqual({ passed: true, status: 200 });
    expect(await anyGate(req, "salary_closing", [])).toEqual({ passed: true, status: 200 });
  });
});

const hrSource = ts.createSourceFile(
  "server/hr-routes.ts", readFileSync("server/hr-routes.ts", "utf8"), ts.ScriptTarget.Latest, true,
);
function compile(expression: string, dependencies: Record<string, unknown>) {
  const compiled = ts.transpileModule(`const probe = ${expression};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${compiled}\nreturn probe;`)(...Object.values(dependencies));
}
function extractFunction(name: string, deps: Record<string, unknown>) {
  const node = hrSource.statements.find(
    (n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === name,
  );
  if (!node?.body) throw new Error(`Missing real HR helper ${name}`);
  const asyncPrefix = node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword) ? "async " : "";
  return compile(`${asyncPrefix}function(${node.parameters.map(p => p.getText(hrSource)).join(",")}) ${node.body.getText(hrSource)}`, deps);
}
const resolveScope = extractFunction("resolveHrBranchScope", {});
const realScope = extractFunction("getBranchScope", {
  getEffectiveBranchFilter, resolveHrBranchScope: resolveScope,
  hasCrossBranchHrAccess: hasCrossBranchHrReadAccess,
  hasPermissionScopeConstraint,
});

function documentDeleteFixture(documentBranch = "test-branch-a") {
  let document: any = { id: 71, branchEmployeeId: 17, name: "Synthetic document only" };
  const writes: number[] = [];
  const db = {
    select: () => ({
      from: (table: unknown) => {
        expect(table).toBe(employeeDocuments);
        return {
          innerJoin: (joined: unknown) => {
            expect(joined).toBe(branchEmployees);
            return {
              where: (condition: any) => {
                expect(condition).toEqual({ column: employeeDocuments.id, value: 71 });
                const rows = document ? [{ document, currentBranchId: documentBranch }] : [];
                // Handler awaits where(); trusted context resolver uses limit().
                return {
                  then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
                    Promise.resolve(rows).then(resolve, reject),
                  limit: async (count: number) => {
                    expect(count).toBe(1);
                    return document ? [{ branchId: documentBranch }] : [];
                  },
                };
              },
            };
          },
        };
      },
    }),
    delete: (table: unknown) => {
      expect(table).toBe(employeeDocuments);
      return { where: async (condition: any) => {
        expect(condition).toEqual({ column: employeeDocuments.id, value: 71 });
        writes.push(71);
        document = undefined;
      } };
    },
  };
  let registration: ts.CallExpression | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(hrSource) === "app"
      && node.expression.name.text === "delete"
      && ts.isStringLiteral(node.arguments[0])
      && node.arguments[0].text === "/api/hr/documents/:id") registration = node;
    ts.forEachChild(node, visit);
  }
  visit(hrSource);
  if (!registration) throw new Error("Missing real document DELETE registration");
  expect(registration.arguments).toHaveLength(4);
  expect(registration.arguments[1].getText(hrSource)).toBe("isAuthenticated");
  // Only session authentication is pre-satisfied; real registered permission guard is retained.
  const hrDocumentResourceContext = extractFunction("hrDocumentResourceContext", {
    db, employeeDocuments, branchEmployees,
    eq: (column: unknown, value: unknown) => ({ column, value }),
  });
  const permission = compile(registration.arguments[2].getText(hrSource), {
    requirePermission, hrDocumentResourceContext,
  });
  const handler = compile(registration.arguments[3].getText(hrSource), {
    db, employeeDocuments, branchEmployees, getBranchScope: realScope,
    eq: (column: unknown, value: unknown) => ({ column, value }),
  });
  return {
    writes,
    get document() { return document; },
    async run(req: any) {
      const res = response();
      const next = vi.fn();
      await permission(req, res, next);
      if (next.mock.calls.length) await handler(req, res);
      return res;
    },
  };
}

describe("real document DELETE handler with real permission and branch helpers, in-memory data only", () => {
  it("HR specialist without delete cannot remove an in-scope synthetic document", async () => {
    expect(HR_SPECIALIST_PERMISSIONS.hr_documents).not.toContain("delete");
    const fixture = documentDeleteFixture();
    const res = await fixture.run(request("hr_specialist", "DELETE", "hr_documents"));
    expect(res.statusCode).toBe(403);
    expect(fixture.document).toEqual({ id: 71, branchEmployeeId: 17, name: "Synthetic document only" });
    expect(fixture.writes).toEqual([]);
  });
  it("CONTROL: explicit delete does not permit an ordinary user to remove another branch's document", async () => {
    const fixture = documentDeleteFixture("test-branch-b");
    const res = await fixture.run(request("employee", "DELETE", "hr_documents", ["delete"]));
    expect(res.statusCode).toBe(403);
    expect(fixture.document?.id).toBe(71);
    expect(fixture.writes).toEqual([]);
  });
  it("CONTROL: ordinary view-only user cannot remove the same document", async () => {
    const fixture = documentDeleteFixture();
    const res = await fixture.run(request("employee", "DELETE", "hr_documents"));
    expect(res.statusCode).toBe(403);
    expect(fixture.document?.id).toBe(71);
    expect(fixture.writes).toEqual([]);
  });
  it("CONTROL: an explicit delete grant permits legitimate in-scope deletion", async () => {
    const fixture = documentDeleteFixture();
    const res = await fixture.run(request("employee", "DELETE", "hr_documents", ["delete"]));
    expect(res.statusCode).toBe(200);
    expect(fixture.writes).toEqual([71]);
  });
  it("CONTROL: admin retains current cross-branch deletion behavior", async () => {
    const fixture = documentDeleteFixture("test-branch-b");
    const res = await fixture.run(request("admin", "DELETE", "hr_documents", []));
    expect(res.statusCode).toBe(200);
    expect(fixture.writes).toEqual([71]);
  });
});