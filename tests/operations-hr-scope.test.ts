import { describe, expect, it } from "vitest";
import { hasCrossBranchHrReadAccess, getAllowedBranchIds, getEffectiveBranchFilter, requirePermission } from "../server/auth";
import { operationsHrBranches, operationsHrManagerOnly, operationsPayrollCsv, registerOperationsHrRoutes, transferWithinOperationsScope } from "../server/operations-hr-routes";
import { apiCacheMiddleware } from "../server/api-cache";
import { shouldPersist } from "../client/src/lib/persistentCache";

const manager = (grants: string[]) => ({
  currentUser: { id: "manager-1", role: "operations_manager", branchId: "main_warehouse" },
  userBranchAccess: grants.map(branchId => ({ branchId })),
  authPermissions: [{ module: "hr_management", actions: ["view", "edit"] }],
});

describe("operations manager HR boundary", () => {
  it("grants scoped payroll, joining and transfer capabilities intrinsically while blocking legacy broad HR grants", async () => {
    const req: any = {
      ...manager(["branch-a"]), method: "GET",
      authPermissions: [
        { module: "hr_management", actions: ["view", "edit"] },
        { module: "salary_closing", actions: ["view", "edit"] },
      ],
    };
    const responses: number[] = [];
    const res: any = {
      status(code: number) { responses.push(code); return this; },
      json() { return this; },
    };
    let calls = 0;
    const next = () => { calls++; };
    await requirePermission("hr_management", "view")(req, res, next);
    await requirePermission("salary_closing", "edit")(req, res, next);
    await requirePermission("hr_onboarding", "edit")(req, res, next);
    expect(responses).toEqual([403, 403, 403]);
    await requirePermission("operations_payroll", "view")(req, res, next);
    expect(calls).toBe(1);
    await requirePermission("operations_payroll", "approve")(req, res, next);
    await requirePermission("operations_payroll", "export")(req, res, next);
    await requirePermission("operations_joining", "create")(req, res, next);
    await requirePermission("operations_joining", "approve")(req, res, next);
    await requirePermission("operations_employee_transfer", "create")(req, res, next);
    expect(calls).toBe(6);
    expect(responses).toEqual([403, 403, 403]);
  });

  it("never elevates manual HR permission to cross-branch visibility", () => {
    const req = manager(["branch-a"]);
    expect(hasCrossBranchHrReadAccess(req)).toBe(false);
    expect(getEffectiveBranchFilter(req).branchIds).toEqual(["branch-a"]);
    expect(getEffectiveBranchFilter(req, "branch-b").hasAccess).toBe(false);
  });

  it("fails closed with no explicit grants, even if the account default is HQ", () => {
    const req = manager([]);
    expect(getAllowedBranchIds(req)).toEqual([]);
    expect(operationsHrBranches(req)).toEqual([]);
    expect(getEffectiveBranchFilter(req).hasAccess).toBe(false);
  });

  it("always excludes HQ from list, report and transfer scope", () => {
    const req = manager(["branch-a", "branch-b", "main_warehouse"]);
    expect(getAllowedBranchIds(req)).toEqual(["branch-a", "branch-b"]);
    expect(operationsHrBranches(req)).toEqual(["branch-a", "branch-b"]);
    expect(getEffectiveBranchFilter(req, "main_warehouse").hasAccess).toBe(false);
    expect(transferWithinOperationsScope("branch-a", "branch-b", operationsHrBranches(req))).toBe(true);
    expect(transferWithinOperationsScope("branch-a", "main_warehouse", operationsHrBranches(req))).toBe(false);
    expect(transferWithinOperationsScope("main_warehouse", "branch-a", operationsHrBranches(req))).toBe(false);
    expect(transferWithinOperationsScope("branch-a", "branch-c", operationsHrBranches(req))).toBe(false);
    expect(transferWithinOperationsScope("branch-a", "branch-a", operationsHrBranches(req))).toBe(false);
  });

  it("blocks non-managers before any operation capability and requires the HR entry permission on every surface route", () => {
    const routes: { path: string; method: string; handlers: Function[] }[] = [];
    const app: any = {
      get: (path: string, ...handlers: Function[]) => routes.push({ path, method: "GET", handlers }),
      post: (path: string, ...handlers: Function[]) => routes.push({ path, method: "POST", handlers }),
    };
    registerOperationsHrRoutes(app);
    expect(routes.map(r => r.path)).toEqual([
      "/api/operations-hr/branches", "/api/operations-hr/employees",
      "/api/operations-hr/transfers", "/api/operations-hr/transfers",
    ]);
    for (const route of routes) {
      expect(route.handlers[1]).toBe(operationsHrManagerOnly);
      expect(route.handlers.length).toBeGreaterThanOrEqual(4);
    }
    const denied: number[] = [];
    const res: any = { status(code: number) { denied.push(code); return this; }, json() { return this; } };
    let allowed = 0;
    operationsHrManagerOnly({ currentUser: { role: "hr_manager" } }, res, () => { allowed++; });
    operationsHrManagerOnly({ currentUser: { role: "operations_manager" } }, res, () => { allowed++; });
    expect(denied).toEqual([403]);
    expect(allowed).toBe(1);
  });

  it("exports the real payroll amounts in UTF-8 CSV without spreadsheet formula execution", () => {
    const csv = operationsPayrollCsv([
      { branchEmployeeId: 18, employeeName: '=SUM(1,2)"\r\n', grossSalary: 2100.75, netSalary: -120 },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=SUM(1,2)""\r\n"');
    expect(csv).toContain('"2100.75","-120"');
    expect(csv).not.toContain('"0","0"');
  });

  it("does not server-cache or locally persist sensitive operations HR reports", () => {
    const headers: Record<string, string> = {};
    const req: any = { method: "GET", path: "/api/operations-hr/payroll", session: { userId: "manager-1" } };
    const res: any = { set(name: string, value: string) { headers[name] = value; return this; } };
    let nextCalls = 0;
    apiCacheMiddleware(req, res, () => { nextCalls++; });
    expect(headers["Cache-Control"]).toBe("no-store");
    expect(nextCalls).toBe(1);
    expect(shouldPersist("/api/operations-hr/payroll?branchId=branch-a")).toBe(false);
  });

  it("rejects a transfer without an explicit source branch before touching the database", async () => {
    const routes: { path: string; method: string; handlers: Function[] }[] = [];
    const app: any = {
      get: (path: string, ...handlers: Function[]) => routes.push({ path, method: "GET", handlers }),
      post: (path: string, ...handlers: Function[]) => routes.push({ path, method: "POST", handlers }),
    };
    registerOperationsHrRoutes(app);
    const transfer = routes.find(r => r.path.endsWith("/transfers") && r.method === "POST");
    expect(transfer).toBeDefined();
    let status = 0;
    const res: any = {
      status(code: number) { status = code; return this; },
      json() { return this; },
    };
    await transfer!.handlers.at(-1)!({ body: { employeeId: 1, destinationBranchId: "branch-b", reason: "move" } }, res);
    expect(status).toBe(400);
  });
});