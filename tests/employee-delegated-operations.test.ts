import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind } from "typescript";

const mocks = vi.hoisted(() => ({
  select: vi.fn(), transaction: vi.fn(), update: vi.fn(), audit: vi.fn(),
  employee: vi.fn(), linked: vi.fn(),
}));
vi.mock("../server/db", () => ({ db: { select: mocks.select, transaction: mocks.transaction }, pool: {} }));
vi.mock("../server/storage", () => ({
  storage: { getBranchEmployee: mocks.employee, getBranchEmployeeByLinkedUserId: mocks.linked,
    getUserPermissions: vi.fn(async () => []) },
}));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(), verifyOtpForUser: vi.fn(), logShareholderActivity: vi.fn(),
}));
import { delegatedBranchAllowed, operationalAttendance, operationalRoster, registerBranchStockDesk, workforcePermission } from "../server/branch-delegated-operations";
import { requirePermission } from "../server/auth";
import { EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS } from "../shared/employee-account-delegation";
import { DEFAULT_POLICY, targetMayManage, validatePermissions } from "../server/employee-account-delegation-policy";
import { updateCatalogueBranchStock } from "../server/catalogue-branch-stock";
import { kitchenActionAllowed, resolveKitchenRouting } from "../server/central-kitchen-routing";

const employee = { id: 12, employeeName: "موظف الفرع", linkedUserId: "linked-12", branchId: "branch-a", status: "active" };
const query = (rows: any[]) => {
  const chain: any = { from: () => chain, where: () => chain, innerJoin: () => chain, leftJoin: () => chain,
    for: async () => rows, then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) };
  return chain;
};
const request = (actions = ["view", "create", "edit"]) => ({
  currentUser: { id: "clerk", role: "employee", branchId: "branch-a" },
  authPermissions: [{ module: "branch_workforce", actions }],
  userBranchAccess: [{ branchId: "branch-a" }, { branchId: "branch-b" }],
  method: "GET", path: "/api/shift-management/bundle",
  query: { branchId: "branch-a", startDate: "2026-07-01", endDate: "2026-07-01" },
  body: {}, headers: {},
});
const response = () => {
  const res: any = { locals: {}, statusCode: 200,
    status: vi.fn((status: number) => { res.statusCode = status; return res; }),
    json: vi.fn(() => res), set: vi.fn(() => res) };
  return res;
};
async function runWorkforce(req: any, module: "shifts" | "attendance_check" = "shifts", action: "view" | "create" | "edit" = "view") {
  const res = response(), next = vi.fn();
  await workforcePermission(module, action)(req, res, next);
  return { res, next };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.employee.mockResolvedValue(employee);
  mocks.linked.mockResolvedValue(employee);
  mocks.select.mockImplementation(() => query([]));
});

describe("employee delegation expansion ceiling and scope", () => {
  it("adds only requester/receipt, branch stock and branch workforce grants, without activating policy", () => {
    expect(DEFAULT_POLICY).toEqual({ enabled: false, permissions: [] });
    for (const module of ["branch_supply", "central_kitchen_orders", "branch_stock", "branch_workforce"])
      expect(EMPLOYEE_ACCOUNT_SAFE_PERMISSIONS.some(p => p.module === module)).toBe(true);
    for (const module of ["production", "inventory", "warehouse", "shifts", "attendance", "attendance_check", "branch_employees", "operations", "salary_closing", "users"])
      expect(() => validatePermissions([{ module, actions: ["view"] }])).toThrow();
    expect(() => validatePermissions([{ module: "central_kitchen_orders", actions: ["approve"] }])).toThrow();
    expect(() => validatePermissions([{ module: "branch_stock", actions: ["export"] }])).toThrow();
  });
  it("does not turn expanded safe choices into administrator-approved choices", () => {
    expect(() => validatePermissions([{ module: "branch_stock", actions: ["view"] }], [])).toThrow();
    expect(() => targetMayManage("ops", { id: "employee", role: "employee", branchId: "branch-a" },
      "branch-a", ["branch-a", "branch-b"], 0, 0, [], DEFAULT_POLICY)).toThrow();
  });
  it("does not accept all branches, another assigned branch, revoked primary access or HQ", () => {
    expect(delegatedBranchAllowed({ branchId: "branch-a" }, ["branch-a"], "branch-a")).toBe(true);
    for (const [primary, grants, selected] of [
      ["branch-a", ["branch-a", "branch-b"], "branch-b"],
      ["branch-a", ["branch-b"], "branch-a"],
      ["main_warehouse", ["main_warehouse"], "main_warehouse"],
      ["branch-a", null, "branch-a"],
    ] as const) expect(delegatedBranchAllowed({ branchId: primary }, grants as any, selected)).toBe(false);
  });
  it("does not alias the dedicated module into global attendance, scheduling, inventory or personnel APIs", async () => {
    const req: any = request();
    req.authPermissions.push({ module: "branch_stock", actions: ["view", "edit"] });
    for (const module of ["inventory", "warehouse", "shifts", "attendance", "attendance_check", "branch_employees", "production"]) {
      const res = response(), next = vi.fn();
      await requirePermission(module, "view")(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    }
  });
});

describe("limited workforce uses original workflows with projected operational data", () => {
  it("permits only bounded primary-branch reads and marks the response for projection", async () => {
    const good = await runWorkforce(request());
    expect(good.next).toHaveBeenCalledOnce();
    expect(good.res.locals.branchWorkforce).toBe(true);
    for (const queryOverrides of [{ branchId: "branch-b" }, { endDate: "2027-01-01" }, { startDate: "" }]) {
      const req = request(); Object.assign(req.query, queryOverrides);
      expect((await runWorkforce(req)).next).not.toHaveBeenCalled();
    }
  });
  it("rejects revoked grants, view-only writes and viewer writes", async () => {
    const req: any = request(["view"]);
    req.method = "POST"; req.path = "/api/attendance/check-in-employee";
    req.body = { branchId: "branch-a", employeeId: "linked-12" };
    expect((await runWorkforce(req, "attendance_check", "create")).res.statusCode).toBe(403);
    req.authPermissions[0].actions = ["create"]; req.currentUser.role = "viewer";
    expect((await runWorkforce(req, "attendance_check", "create")).res.statusCode).toBe(403);
  });
  it("verifies canonical employee linkage before clocking and blocks another employee's schedule", async () => {
    const req: any = request(); req.method = "POST"; req.path = "/api/attendance/check-in-employee";
    req.body = { branchId: "branch-a", employeeId: "linked-12", scheduleId: 3 };
    mocks.select.mockReturnValue(query([{ id: 3, branchEmployeeId: 22, branchId: "branch-a" }]));
    expect((await runWorkforce(req, "attendance_check", "create")).res.statusCode).toBe(403);
    mocks.select.mockReturnValue(query([{ id: 3, branchEmployeeId: 12, branchId: "branch-a", startTime: "08:00", endTime: "16:00" }]));
    req.body.scheduledStartTime = "23:59";
    expect((await runWorkforce(req, "attendance_check", "create")).next).toHaveBeenCalledOnce();
    expect(req.body.scheduledStartTime).toBe("08:00");
    mocks.linked.mockResolvedValue({ ...employee, branchId: "branch-b" });
    expect((await runWorkforce(req, "attendance_check", "create")).res.statusCode).toBe(403);
  });
  it("separates schedule creation from editing, requires canonical identity and forbids force overwrites", async () => {
    const req: any = request(["edit"]); req.method = "POST"; req.path = "/api/employee-schedules/bulk";
    req.body = { schedules: [{ branchId: "branch-a", employeeId: "linked-12", branchEmployeeId: 12, scheduleDate: "2026-07-01" }] };
    expect((await runWorkforce(req, "shifts", "create")).res.statusCode).toBe(403);
    mocks.select.mockReturnValue(query([{ id: 1 }]));
    expect((await runWorkforce(req, "shifts", "create")).next).toHaveBeenCalledOnce();
    req.body.force = true;
    expect((await runWorkforce(req, "shifts", "create")).res.statusCode).toBe(400);
    delete req.body.force; req.body.schedules[0].employeeId = "someone-else";
    expect((await runWorkforce(req, "shifts", "create")).res.statusCode).toBe(400);
  });
  it("projects away salaries, identity documents, signatures, geolocation and biometric data", () => {
    const sensitive = { ...employee, salary: 999, nationalId: "secret", passportNumber: "secret", signature: "secret", biometricVerified: true };
    expect(operationalRoster(sensitive)).not.toHaveProperty("salary");
    expect(operationalRoster(sensitive)).not.toHaveProperty("nationalId");
    expect(operationalAttendance(sensitive)).not.toHaveProperty("signature");
    expect(operationalAttendance(sensitive)).not.toHaveProperty("biometricVerified");
  });
});

describe("branch counts reuse authoritative transactional stock and audit", () => {
  const transaction = (stock: any, updates = [{ id: 4, currentQuantity: 3 }]) => {
    const select = vi.fn().mockReturnValueOnce(query([{ id: 7, isActive: true }])).mockReturnValueOnce(query(stock ? [stock] : []));
    const returning = vi.fn(async () => updates);
    const update = { set: vi.fn(() => ({ where: vi.fn(() => ({ returning })) })) };
    const tx: any = { select, update: vi.fn(() => update), insert: vi.fn(() => ({ values: mocks.audit })) };
    return { database: { transaction: async (fn: any) => fn(tx) } as any, tx };
  };
  it("rejects stale or nonexistent counts without updating or creating a row", async () => {
    for (const stock of [{ id: 4, currentQuantity: 9, reservedQuantity: 1 }, null]) {
      const { database, tx } = transaction(stock);
      await expect(updateCatalogueBranchStock(database, "branch-a", 7, 3, undefined, "clerk", { expectedQuantity: 8 })).rejects.toThrow("STALE_COUNT");
      expect(tx.update).not.toHaveBeenCalled(); expect(tx.insert).not.toHaveBeenCalled();
    }
  });
  it("preserves reservation invariants and audits the successful physical count", async () => {
    const { database } = transaction({ id: 4, currentQuantity: 8, reservedQuantity: 1, dailyConsumption: 2 });
    await updateCatalogueBranchStock(database, "branch-a", 7, 3, undefined, "clerk", { expectedQuantity: 8 });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "branch_stock_count", module: "branch_stock", branchId: "branch-a", userId: "clerk",
      details: JSON.stringify({ branchId: "branch-a", itemId: 7, before: 8, after: 3 }),
    }));
    const blocked = transaction({ id: 4, currentQuantity: 8, reservedQuantity: 5 }, []);
    await expect(updateCatalogueBranchStock(blocked.database, "branch-a", 7, 3, undefined, "clerk", { expectedQuantity: 8 })).rejects.toThrow("المحجوزة");
  });
  it("stock route validates strict input and denies another assigned branch before storage", async () => {
    const routes: Record<string, any[]> = {};
    registerBranchStockDesk({ get: (path: string, ...handlers: any[]) => { routes[path] = handlers; }, post: (path: string, ...handlers: any[]) => { routes[path] = handlers; } } as any);
    const handler = routes["/api/branch-stock-desk/count"].at(-1);
    const req: any = request(); req.body = { branchId: "branch-b", itemId: 7, quantity: 1, expectedQuantity: 2 };
    const res = response(); await handler(req, res);
    expect(res.statusCode).toBe(403); expect(mocks.transaction).not.toHaveBeenCalled();
    req.body.branchId = "branch-a"; req.body.dailyConsumption = 999;
    await handler(req, res); expect(res.statusCode).toBe(400);
  });
});

describe("registered pages consume limited capabilities, not global module aliases", () => {
  it("routes employee material requests through destination-only branch supply, not warehouse", async () => {
    const source = readFileSync("server/routes.ts", "utf8");
    const start = source.indexOf('  const mainWarehouseBranchId = "main_warehouse";');
    const end = source.indexOf("  const keeperWarehouseScope", start);
    const compiled = transpileModule(source.slice(start, end), { compilerOptions: { module: ModuleKind.None } }).outputText;
    const helpers = new Function("getAllowedBranchIds", "canAccessBranch", "requirePermission",
      `${compiled}; return {isBranchSupplyManager,branchSupplyDestination,transferPermission};`)(
      (req: any) => req.userBranchAccess.map((g: any) => g.branchId), async () => true,
      (module: string) => (_req: any, _res: any, next: any) => { next(module); },
    );
    const req: any = request(); req.authPermissions = [{ module: "branch_supply", actions: ["view", "create", "edit"] }];
    expect(helpers.isBranchSupplyManager(req)).toBe(true);
    expect(await helpers.branchSupplyDestination(req, "branch-a")).toBe(true);
    expect(await helpers.branchSupplyDestination(req, "branch-b")).toBe(false);
    expect(await helpers.branchSupplyDestination(req, "main_warehouse")).toBe(false);
    const next = vi.fn(); helpers.transferPermission("edit")(req, response(), next);
    expect(next).toHaveBeenCalledWith("branch_supply");
  });
  it("never assigns delegated employees as kitchen operators or auto-receivers, but preserves a manual authorized receiver", async () => {
    const person = { id: "clerk", role: "employee", branchId: "branch-a", actions: ["view", "edit"], _hasCustomPermissions: true };
    const manual = resolveKitchenRouting("branch-a", { receiverUserId: "clerk" }, [person]);
    expect(manual.receiverUserId).toBe("clerk");
    expect(manual.receiverAssignmentSource).toBe("manual");
    expect(resolveKitchenRouting("branch-a", null, [person]).receiverUserId).toBeNull();
    const select = vi.fn()
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([person]))
      .mockReturnValueOnce(query([{ userId: "clerk", branchId: "branch-a" }]))
      .mockReturnValueOnce(query([{ userId: "clerk", module: "central_kitchen_orders", actions: ["view", "edit"] }]))
      .mockReturnValueOnce(query([])).mockReturnValueOnce(query([]));
    await expect(kitchenActionAllowed({ select, insert: vi.fn() }, "clerk",
      { requestBranchId: "branch-a", centralKitchenId: "kitchen" }, "prepare")).resolves.toBe(false);
  });
  it("registers and navigates both real desks and preserves independent source-side permissions", () => {
    const app = readFileSync("client/src/App.tsx", "utf8");
    const layout = readFileSync("client/src/components/layout.tsx", "utf8");
    const workforce = readFileSync("client/src/pages/branch-workforce.tsx", "utf8");
    const routes = readFileSync("server/routes.ts", "utf8");
    for (const [path, module] of [["branch-stock-desk", "branch_stock"], ["branch-workforce", "branch_workforce"]]) {
      expect(app).toContain(`path="/${path}"`);
      expect(app).toContain(`module="${module}"`);
      expect(layout).toContain(`href: "/${path}"`);
    }
    expect(workforce).toContain("/api/employee-schedules/bulk");
    expect(workforce).toContain("SignaturePad");
    expect(workforce).toContain("getCurrentPosition");
    expect(routes).toContain('workforcePermission("attendance_check", "create")');
    expect(routes).toContain('requirePermission("inventory", "view")');
    expect(readFileSync("server/delivery-routes.ts", "utf8")).toContain('["employee", "viewer"].includes(req.currentUser?.role ?? "")');
  });
});