import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { monthlyEvidence, monthCalendar, payrollBalance } from "../shared/operations-month-workflow";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), connect: vi.fn(), release: vi.fn(),
  grants: new Set(["operations:view", "operations:edit", "daily_closures:view"]),
}));
vi.mock("../server/db", () => ({
  pool: { query: mocks.query, connect: mocks.connect }, db: {},
}));
vi.mock("../server/storage", () => ({ storage: {} }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  getAllowedBranchIds: (req: any) => req.allowed,
  requirePermission: (module: string, action: string) => async (_req: any, res: any, next: any) =>
    mocks.grants.has(`${module}:${action}`) ? next() : res.status(403).json({ error: "denied" }),
}));
import { registerOperationsMonthWorkflow } from "../server/operations-month-workflow";

const handlers: Record<string, any[]> = {};
registerOperationsMonthWorkflow({
  get: (path: string, ...args: any[]) => { handlers[`GET ${path}`] = args; },
  post: (path: string, ...args: any[]) => { handlers[`POST ${path}`] = args; },
} as any);

async function call(action = "", data: any = {}) {
  const method = action ? "POST" : "GET";
  const path = `/api/operations-center/month-workflow${action ? `/${action}` : ""}`;
  const req: any = { method, query: data, body: data, allowed: ["b1"],
    currentUser: { id: "actor", role: "viewer-test" } };
  let result: any;
  let failure: any;
  let status = 200;
  const res: any = { setHeader: vi.fn(), status: (value: number) => { status = value; return res; },
    json: (value: any) => { result = value; return res; } };
  const list = handlers[`${method} ${path}`];
  async function run(index: number): Promise<void> {
    if (!list[index]) return;
    let nextPromise: Promise<void> | undefined;
    await list[index](req, res, (e?: any) => {
      if (e) failure = e;
      else nextPromise = run(index + 1);
    });
    await nextPromise;
  }
  await run(0);
  return { result, status, failure };
}

describe("monthly evidence and real payment totals", () => {
  it("validates months and leap year calendar", () => {
    expect(monthCalendar("2024-02")).toHaveLength(29);
    expect(() => monthCalendar("2024-13")).toThrow();
    expect(() => monthCalendar("all")).toThrow();
  });
  it("sums actual monetary amounts, never payment counts", () => {
    expect(payrollBalance([{ employeeId: 1, due: 1000 }, { employeeId: 2, due: 800 }],
      [{ employeeId: 1, amount: 900 }, { employeeId: 2, amount: 400 }]))
      .toMatchObject({ due: 1800, paid: 1300, remaining: 500, overpaid: 0, unknownPaymentAmounts: 0, unreconciledPaymentCount: 0 });
  });
  it("a nullable legacy payment does not invent a paid salary", () => {
    expect(payrollBalance([{ employeeId: 1, due: 1000 }], [{ employeeId: 1, amount: null }]))
      .toMatchObject({ due: 1000, paid: null, remaining: null, overpaid: null, unknownPaymentAmounts: 1 });
  });
  it("retains real zero payments and cents without floating point drift", () => {
    expect(payrollBalance([{ employeeId: 1, due: 0.3 }], [{ employeeId: 1, amount: 0.1 }, { employeeId: 1, amount: 0.2 }]).remaining).toBe(0);
    expect(payrollBalance([{ employeeId: 1, due: 100 }], [{ employeeId: 1, amount: 0 }]).paid).toBe(0);
  });
  it("does not hide overpayment", () => {
    expect(payrollBalance([{ employeeId: 1, due: 100 }], [{ employeeId: 1, amount: 120 }]))
      .toMatchObject({ remaining: 0, overpaid: 20, paid: 120 });
  });
  it("unmatched snapshot employee payments cannot be counted toward settlement", () => {
    expect(payrollBalance([{ employeeId: 1, due: 100 }], [{ employeeId: 2, amount: 100 }]))
      .toMatchObject({ paid: null, recordedPaid: 100, remaining: null, overpaid: null,
        unreconciledPaymentCount: 1, unreconciledPaymentAmount: 100 });
  });
  it("missing snapshot cannot infer balances from recorded payments", () => {
    expect(payrollBalance([], [{ employeeId: 2, amount: 100 }]))
      .toMatchObject({ paid: null, recordedPaid: 100, remaining: null, overpaid: null,
        unreconciledPaymentCount: 1 });
  });
  it("missing dates are unverified, open records block, declarations conflict", () => {
    const checks = monthlyEvidence("2025-02",
      [{ date: "2025-02-01", status: "closed" }, { date: "2025-02-02", status: "open" }],
      [{ date: "2025-02-03" }, { date: "2025-02-02" }]);
    expect(checks.missingDates).toHaveLength(25);
    expect(checks.openRecords).toHaveLength(1);
    expect(checks.conflictingDates).toEqual(["2025-02-02"]);
  });
});

describe("monthly review endpoint authorization and transaction guards", () => {
  let state: any;
  let records: any[];
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.grants = new Set(["operations:view", "operations:edit", "daily_closures:view"]);
    state = { status: "open", revision: 0, declarations: [], history: [] };
    records = monthCalendar("2025-02").map((date, i) => ({ id: i + 1, date, status: "closed", sales: 100, updated: "2025-03-01" }));
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("SELECT id FROM branches")) return { rowCount: 1, rows: [{ id: "b1" }] };
      if (sql.includes("FROM branch_daily_closures")) return { rows: records };
      if (sql.includes("SELECT * FROM operations_month_reviews")) return { rows: [state] };
      return { rows: [], rowCount: 1 };
    });
    mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release });
  });
  it("denies missing operations view before touching storage", async () => {
    mocks.grants.delete("operations:view");
    expect((await call("", { branchId: "b1", month: "2025-02" })).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("denies a branch outside explicit grants", async () => {
    expect((await call("", { branchId: "b2", month: "2025-02" })).failure.status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("denies write privilege without operations edit", async () => {
    mocks.grants.delete("operations:edit");
    expect((await call("close", { branchId: "b1", month: "2025-02", revision: 0, note: "reviewed" })).status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("requires actual daily source permission", async () => {
    mocks.grants.delete("daily_closures:view");
    expect((await call("close", { branchId: "b1", month: "2025-02", revision: 0, note: "reviewed" })).failure.status).toBe(403);
  });
  it("returns no financial data without corresponding grants", async () => {
    const { result } = await call("", { branchId: "b1", month: "2025-02" });
    expect(result.payroll.available).toBe(false);
    expect(result.payroll.payments).toEqual([]);
    expect(result.expenses.available).toBe(false);
    expect(result.closing.canClose).toBe(true);
  });
  it("takes a transaction-scoped lock and commits snapshot and audit together", async () => {
    await call("close", { branchId: "b1", month: "2025-02", revision: 0, note: "reviewed" });
    const sqls = mocks.query.mock.calls.map(call => call[0] as string);
    expect(sqls.some(sql => sql.includes("pg_advisory_xact_lock"))).toBe(true);
    expect(sqls).toContain("SET LOCAL lock_timeout = '3s'");
    expect(sqls).toContain("LOCK TABLE branch_daily_closures IN SHARE MODE");
    expect(sqls.indexOf("LOCK TABLE branch_daily_closures IN SHARE MODE"))
      .toBeLessThan(sqls.findIndex(sql => sql.includes("FROM branch_daily_closures")));
    expect(sqls.some(sql => sql.includes("snapshot=CASE"))).toBe(true);
    expect(sqls).toContain("COMMIT");
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it("stale concurrent revision cannot replace the latest state", async () => {
    state.revision = 2;
    const { failure } = await call("close", { branchId: "b1", month: "2025-02", revision: 0, note: "reviewed" });
    expect(failure.status).toBe(409);
    expect(mocks.query.mock.calls.some(call => call[0] === "ROLLBACK")).toBe(true);
    expect(mocks.query.mock.calls.some(call => call[0].startsWith("UPDATE"))).toBe(false);
  });
  it("busy daily source lock rolls back with a retryable conflict, never a saved close", async () => {
    const prior = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (sql: string, ...args: any[]) => {
      if (sql.startsWith("LOCK TABLE")) throw Object.assign(new Error("lock timeout"), { code: "55P03" });
      return prior(sql, ...args);
    });
    const response = await call("close", { branchId: "b1", month: "2025-02", revision: 0, note: "reviewed" });
    expect(response.failure.status).toBe(409);
    expect(mocks.query.mock.calls.some(call => call[0] === "ROLLBACK")).toBe(true);
    expect(mocks.query.mock.calls.some(call => call[0].startsWith("UPDATE"))).toBe(false);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it("blocks open daily records and missing evidence", async () => {
    records[0].status = "open";
    records.pop();
    const { failure } = await call("close", { branchId: "b1", month: "2025-02", revision: 0, note: "reviewed" });
    expect(failure.status).toBe(409);
  });
  it("rejects false nonoperating declaration over a real record", async () => {
    expect((await call("declare", { branchId: "b1", month: "2025-02", revision: 0, note: "closed shop", date: "2025-02-01" })).failure.status).toBe(409);
  });
  it("detects closed snapshot drift and requires reopen instead of close", async () => {
    state.status = "closed"; state.fingerprint = "old-evidence";
    const get = await call("", { branchId: "b1", month: "2025-02" });
    expect(get.result.closing.drifted).toBe(true);
    expect(get.result.closing.canClose).toBe(false);
    expect(get.result.closing.canReopen).toBe(true);
    expect((await call("close", { branchId: "b1", month: "2025-02", revision: 0, note: "reviewed" })).failure.status).toBe(409);
  });
  it("repeated reopened operation does not append duplicate history", async () => {
    state.status = "reopened"; state.revision = 4;
    expect((await call("reopen", { branchId: "b1", month: "2025-02", revision: 0, note: "retry reopen" })).failure).toBeUndefined();
    expect(mocks.query.mock.calls.some(call => call[0].startsWith("UPDATE"))).toBe(false);
  });
  it("repeated close with unchanged evidence does not duplicate history", async () => {
    state.status = "closed"; state.revision = 1;
    state.fingerprint = createHash("sha256").update(JSON.stringify({ rows: records, declarations: [] })).digest("hex");
    const response = await call("close", { branchId: "b1", month: "2025-02", revision: 0, note: "retry closing" });
    expect(response.failure).toBeUndefined();
    expect(mocks.query.mock.calls.some(call => call[0].startsWith("UPDATE"))).toBe(false);
    expect(response.result.closing.drifted).toBe(false);
  });
  it("repeated same-day declaration is harmless after a lost response", async () => {
    records.shift();
    state.revision = 1;
    state.declarations = [{ date: "2025-02-01", note: "shop not operating", actor: "actor", at: "2025-03-01" }];
    const response = await call("declare", { branchId: "b1", month: "2025-02", revision: 0,
      date: "2025-02-01", note: "shop not operating" });
    expect(response.failure).toBeUndefined();
    expect(mocks.query.mock.calls.some(call => call[0].startsWith("UPDATE"))).toBe(false);
  });
  it("refuses current or future month and blank note", async () => {
    expect((await call("close", { branchId: "b1", month: "2099-01", revision: 0, note: "reviewed" })).failure.status).toBe(409);
    expect((await call("close", { branchId: "b1", month: "2025-02", revision: 0, note: "" })).failure.status).toBe(400);
  });
  it("financial reconciliation uses saved snapshot membership, not employee's current branch", async () => {
    mocks.grants.add("salary_closing:view"); mocks.grants.add("employee_reports:view");
    const prior = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (sql: string, ...args: any[]) => {
      if (sql.includes("FROM salary_closures")) return { rows: [{ id: 8, status: "closed", total_net: 100 }] };
      if (sql.includes("FROM salary_closure_lines")) return { rows: [{ employeeId: 1, name: "Saved snapshot employee", due: 100 }] };
      if (sql.includes("FROM salary_payments")) return { rows: [
        { id: 1, employeeId: 1, amount: 120, method: "cash", paidAt: new Date(), actor: "HR", note: null },
      ] };
      return prior(sql, ...args);
    });
    const response = await call("", { branchId: "b1", month: "2025-02" });
    expect(response.result.payroll).toMatchObject({ paid: 120, remaining: 0, overpaid: 20, settlementStatus: "overpaid" });
    expect(response.result.payroll.payments[0].reconciled).toBe(true);
    expect(mocks.query.mock.calls.some(call => call[0].includes("branch_employees"))).toBe(false);
  });
  it("unmatched payments surface reconciliation state and no invented employee name", async () => {
    mocks.grants.add("salary_closing:view"); mocks.grants.add("employee_reports:view");
    const prior = mocks.query.getMockImplementation()!;
    mocks.query.mockImplementation(async (sql: string, ...args: any[]) => {
      if (sql.includes("FROM salary_closures")) return { rows: [{ id: 8, status: "closed", total_net: 100 }] };
      if (sql.includes("FROM salary_closure_lines")) return { rows: [{ employeeId: 1, name: "Snapshot employee", due: 100 }] };
      if (sql.includes("FROM salary_payments")) return { rows: [
        { id: 1, employeeId: 99, amount: 100, method: "cash", paidAt: new Date(), actor: "HR", note: null },
      ] };
      return prior(sql, ...args);
    });
    const response = await call("", { branchId: "b1", month: "2025-02" });
    expect(response.result.payroll).toMatchObject({ paid: null, remaining: null, overpaid: null, recordedPaid: 100,
      settlementStatus: "unreconciled", unreconciledPaymentCount: 1 });
    expect(response.result.payroll.payments[0].reconciled).toBe(false);
    expect(response.result.payroll.employees.some((employee: any) => employee.employeeId === 99)).toBe(false);
  });
});