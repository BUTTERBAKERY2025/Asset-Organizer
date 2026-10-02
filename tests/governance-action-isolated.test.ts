/**
 * Characterization probes, NOT passing security acceptance tests.
 * KNOWN GAP assertions deliberately describe current unsafe behavior.
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
}));
vi.mock("../server/storage", () => ({
  storage: new Proxy({}, { get: () => io.unexpected }),
}));
vi.mock("../server/db", () => ({
  db: new Proxy({}, { get: () => io.unexpected }),
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
  requirePermission, getEffectiveBranchFilter, hasCrossBranchHrReadAccess,
  HR_SPECIALIST_PERMISSIONS, FINANCIAL_MANAGER_PERMISSIONS,
} from "../server/auth";
import { employeeDocuments, branchEmployees } from "../shared/schema";

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
  return {
    method, currentUser: { id: "synthetic-actor", role, branchId: "test-branch-a" },
    authPermissions: [{ module, actions }],
    userBranchAccess: [{ branchId: "test-branch-a", accessLevel: "full" }],
    session: {}, params: { id: "71" }, query: {}, body: {},
    headers: {}, originalUrl: "/isolated-probe",
  };
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

describe("isolated action inference — characterization, not security certification", () => {
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
  ] as const) {
    it.each([
      ["POST", "create"], ["PUT", "edit"], ["PATCH", "edit"], ["DELETE", "delete"],
    ])(`KNOWN GAP: ${role} passes %s without action but rejects explicit %s`, async (method, action) => {
      expect(intrinsic.employee_reports).toContain("view");
      expect(intrinsic.employee_reports).not.toContain(action);
      const req = request(role, method);
      expect(await gate(req, "employee_reports")).toEqual({ passed: true, status: 200 });
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
  return compile(`function(${node.parameters.map(p => p.getText(hrSource)).join(",")}) ${node.body.getText(hrSource)}`, deps);
}
const resolveScope = extractFunction("resolveHrBranchScope", {});
const realScope = extractFunction("getBranchScope", {
  getEffectiveBranchFilter, resolveHrBranchScope: resolveScope,
  hasCrossBranchHrAccess: hasCrossBranchHrReadAccess,
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
              where: async (condition: any) => {
                expect(condition).toEqual({ column: employeeDocuments.id, value: 71 });
                return document ? [{ document, currentBranchId: documentBranch }] : [];
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
  const permission = compile(registration.arguments[2].getText(hrSource), { requirePermission });
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
  it("KNOWN GAP: HR specialist without delete removes an in-scope synthetic document", async () => {
    expect(HR_SPECIALIST_PERMISSIONS.hr_documents).not.toContain("delete");
    const fixture = documentDeleteFixture();
    const res = await fixture.run(request("hr_specialist", "DELETE", "hr_documents"));
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ success: true });
    expect(fixture.document).toBeUndefined();
    expect(fixture.writes).toEqual([71]);
  });
  it("CONTROL: the same specialist cannot remove a document in another branch", async () => {
    const fixture = documentDeleteFixture("test-branch-b");
    const res = await fixture.run(request("hr_specialist", "DELETE", "hr_documents"));
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