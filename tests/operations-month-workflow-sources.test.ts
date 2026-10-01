import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { PgDialect } from "drizzle-orm/pg-core";
import { cashierSalesJournals, pnlMonthlyInputs } from "../shared/schema";
import { monthCalendar, monthMetric, monthlyEvidence } from "../shared/operations-month-workflow";

const fixture = vi.hoisted(() => ({
  allowed: ["a", "b"] as string[] | null,
  branches: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "hq", name: "HQ" }, { id: "main_warehouse", name: "Warehouse" }],
  grants: new Set<string>(),
  journals: [] as { branchId: string; date: string; status: string; totalSales: number | null; netSales?: number }[],
  daily: {} as Record<string, any[]>,
  reviews: {} as Record<string, any>,
  closures: {} as Record<string, any>,
  lines: {} as Record<string, any[]>,
  payments: {} as Record<string, any[]>,
  inputs: {} as Record<string, any[]>,
  failed: new Set<string>(), permissionFailures: new Set<string>(),
  query: vi.fn(), connect: vi.fn(), release: vi.fn(), rent: vi.fn(), recurring: vi.fn(),
  queries: [] as { sql: string; params: unknown[] }[],
  activeSales: 0, maxSales: 0, afterCommitFailure: false,
}));
vi.mock("../server/auth", () => ({
  // Emulate auth's request-fresh branch snapshot, not a session/board selection.
  isAuthenticated: (req: any, _res: any, next: any) => { req.allowed = fixture.allowed?.slice() ?? null; next(); },
  getAllowedBranchIds: (req: any) => req.allowed,
  requirePermission: (module: string, action: string) => (_req: any, res: any, next: any) => {
    if (fixture.permissionFailures.has(`${module}:${action}`)) return res.status(503).json({ message: "private SQL permission diagnostic" });
    return fixture.grants.has(`${module}:${action}`) ? next() : res.status(403).json({ message: "denied" });
  },
}));
vi.mock("../server/storage", () => ({ storage: {
  getRentEvidenceForPeriod: fixture.rent,
  getRecurringExpensesForPeriod: fixture.recurring,
} }));
// Keep the real loadOperationsRegisteredSales and its real Drizzle predicates.
// Only the DB transport is replaced; inspect the compiled source/range/scope SQL.
vi.mock("../server/db", () => ({
  pool: { query: fixture.query, connect: fixture.connect },
  db: { select: (selection?: Record<string, unknown>) => ({
    from: (table: unknown) => {
      let condition: any;
      const result = async () => {
        const query = new PgDialect().sqlToQuery(condition);
        if (table === pnlMonthlyInputs) return fixture.inputs[String(query.params[0])] || [];
        if (table !== cashierSalesJournals) throw new Error("Unexpected source");
        const fields = Object.entries(selection!).map(([key, value]) => {
          const expression = value && typeof (value as any).getSQL === "function" ? (value as any).getSQL() : value;
          return `${key}:${new PgDialect().sqlToQuery(expression as any).sql}`;
        });
        fixture.queries.push({ sql: `${fields.join(",")} WHERE ${query.sql}`, params: query.params });
        fixture.activeSales++;
        fixture.maxSales = Math.max(fixture.maxSales, fixture.activeSales);
        try {
          await Promise.resolve();
          const branch = String(query.params[0]);
          if (fixture.failed.has(`sales:${branch}`)) throw Object.assign(new Error("SELECT private SQL password diagnostic"), { code: "XX000" });
          const dates = query.params.filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
          const rows = fixture.journals.filter(row => query.params.includes(row.branchId) &&
            query.params.includes(row.status) && row.date <= dates[0] && (!dates[1] || row.date >= dates[1]));
          if (!("sales" in selection!)) return [...new Set(rows.map(row => row.branchId))].map(branchId => ({
            branchId, date: rows.filter(row => row.branchId === branchId).map(row => row.date).sort().at(-1),
          }));
          const groups = new Map<string, { branchId: string; date: string; sales: number | null; recordedCount: number }>();
          for (const row of rows) {
            const key = `${row.branchId}:${row.date}`;
            const aggregate = groups.get(key) ?? { branchId: row.branchId, date: row.date, sales: null, recordedCount: 0 };
            // SQL sum ignores nulls, but an all-null aggregate stays null.
            if (row.totalSales !== null) aggregate.sales = (aggregate.sales ?? 0) + row.totalSales;
            aggregate.recordedCount++;
            groups.set(key, aggregate);
          }
          return [...groups.values()];
        } finally { fixture.activeSales--; }
      };
      const builder: any = { where: (value: any) => { condition = value; return builder; },
        groupBy: () => builder, then: (resolve: any, reject: any) => result().then(resolve, reject) };
      return builder;
    },
  }) },
}));
import { registerOperationsMonthWorkflow } from "../server/operations-month-workflow";

const handlers: Record<string, any[]> = {};
registerOperationsMonthWorkflow({
  get: (path: string, ...callbacks: any[]) => { handlers[`GET ${path}`] = callbacks; },
  post: (path: string, ...callbacks: any[]) => { handlers[`POST ${path}`] = callbacks; },
} as any);

async function request(data: Record<string, unknown> = {}, action = "") {
  const method = action ? "POST" : "GET";
  const req: any = { method, query: data, body: data, currentUser: { id: "actor", role: "viewer" } };
  const res: any = { statusCode: 200, data: undefined, headers: {} as Record<string, string>,
    status(code: number) { res.statusCode = code; return res; },
    json(value: unknown) { res.data = value; return res; },
    setHeader(key: string, value: string) { res.headers[key] = value; return res; } };
  let error: any;
  const callbacks = handlers[`${method} /api/operations-center/month-workflow${action ? `/${action}` : ""}`];
  const run = async (index: number): Promise<void> => {
    if (!callbacks[index]) return;
    let continuation: Promise<void> | undefined;
    await callbacks[index](req, res, (failure?: any) => {
      if (failure) error = failure; else continuation = run(index + 1);
    });
    await continuation;
  };
  await run(0);
  return { ...res, error };
}
const get = (branchId = "a", month = "2026-09", extra = {}) => request({ branchId, month, ...extra });
const post = (action: string, extra = {}) => request({ branchId: "a", month: "2026-09", revision: 0, note: "review verified", ...extra }, action);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T22:15:00Z")); // October 1 in Saudi Arabia.
  vi.spyOn(console, "error").mockImplementation(() => {});
  fixture.allowed = ["a", "b"];
  fixture.branches = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "hq", name: "HQ" }, { id: "main_warehouse", name: "Warehouse" }];
  fixture.grants = new Set(["operations:view", "operations:edit", "daily_closures:view", "sales_analytics:view"]);
  fixture.journals = [];
  fixture.daily = {}; fixture.reviews = {}; fixture.closures = {}; fixture.lines = {};
  fixture.payments = {}; fixture.inputs = {}; fixture.failed.clear(); fixture.permissionFailures.clear();
  fixture.queries = []; fixture.activeSales = 0; fixture.maxSales = 0; fixture.afterCommitFailure = false;
  fixture.rent.mockReset().mockResolvedValue({ found: false, amount: 0 });
  fixture.recurring.mockReset().mockResolvedValue([]);
  fixture.release.mockReset();
  fixture.query.mockReset().mockImplementation(async (sql: string, params: any[] = []) => {
    const branch = params[0];
    if (sql.includes("FROM branches")) {
      if (fixture.failed.has("scope")) throw new Error("private SQL scope diagnostic");
      const rows = sql.startsWith("SELECT id FROM") ? fixture.branches.filter(row => row.id === branch) :
        fixture.branches.filter(row => !["hq", "main_warehouse"].includes(row.id) && (branch === null || branch.includes(row.id)));
      return { rows, rowCount: rows.length };
    }
    if (sql.includes("FROM pnl_recurring_expenses") && fixture.failed.has("recurring")) throw Object.assign(new Error("private missing table"), { code: "42P01" });
    if (sql.includes("FROM branch_daily_closures")) {
      if (fixture.failed.has(`daily:${branch}`)) throw new Error("SELECT private daily diagnostic");
      return { rows: fixture.daily[branch] || [] };
    }
    if (sql.includes("SELECT * FROM operations_month_reviews")) {
      if (fixture.failed.has(`review:${branch}`)) throw new Error("SELECT private review diagnostic");
      return { rows: fixture.reviews[branch] ? [structuredClone(fixture.reviews[branch])] : [] };
    }
    if (sql.includes("FROM salary_closures")) {
      if (fixture.failed.has(`payroll:${branch}`)) throw new Error("SELECT private payroll diagnostic");
      return { rows: fixture.closures[branch] ? [fixture.closures[branch]] : [] };
    }
    if (sql.includes("FROM salary_closure_lines")) return { rows: fixture.lines[branch] || [] };
    if (sql.includes("FROM salary_payments")) return { rows: fixture.payments[branch] || [] };
    if (sql.startsWith("INSERT INTO operations_month_reviews")) fixture.reviews[branch] ||= {
      status: "open", revision: 0, declarations: [], history: [],
    };
    if (sql.startsWith("UPDATE operations_month_reviews")) {
      const review = fixture.reviews[branch];
      review.status = params[2]; review.revision++;
      review.declarations = JSON.parse(params[3]); review.history.push(...JSON.parse(params[4]));
      if (params[5]) { review.fingerprint = params[6]; review.snapshot = JSON.parse(params[7]); }
    }
    if (sql === "COMMIT" && fixture.afterCommitFailure) fixture.failed.add("review:a");
    return { rows: [], rowCount: 1 };
  });
  fixture.connect.mockReset().mockResolvedValue({ query: fixture.query, release: fixture.release });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("mounted monthly endpoint uses the authoritative journal source", () => {
  it("loads posted/approved gross total_sales with no closures, exact leap-year month and latest history", async () => {
    fixture.journals = [
      { branchId: "a", date: "2024-02-01", status: "posted", totalSales: 100, netSales: 70 },
      { branchId: "a", date: "2024-02-29", status: "approved", totalSales: 50, netSales: 10 },
      { branchId: "a", date: "2024-02-29", status: "submitted", totalSales: 999 },
      { branchId: "a", date: "2024-02-29", status: "draft", totalSales: 888 },
      { branchId: "a", date: "2024-03-01", status: "posted", totalSales: 777 },
      { branchId: "b", date: "2024-02-29", status: "posted", totalSales: 666 },
    ];
    const response = await get("a", "2024-02");
    expect(response.error).toBeUndefined();
    expect(response.data.sales).toMatchObject({ available: true, state: "recorded", confirmed: 150,
      recordedCount: 2, recordedBranchDays: 2, lastRecordedDate: "2024-02-29", closedDays: null,
      source: "cashier_sales_journals.total_sales", isNet: false });
    expect(fixture.queries[0].params).toEqual(["a", "posted", "approved", "2024-02-29", "2024-02-01"]);
    expect(fixture.queries[0].sql).toContain('sum("cashier_sales_journals"."total_sales"::double precision)');
    expect(fixture.queries[0].sql).not.toMatch(/net_sales|closures|returns/);
    expect(response.data.sales.sourceHref).toBe("/sales-analytics?branchId=a&fromDate=2024-02-01&toDate=2024-02-29&month=2024-02");
    expect(response.data.sales.daily).toHaveLength(29);
    expect(response.data.sales.daily[0]).toMatchObject({ date: "2024-02-01", value: 100, recordedCount: 1 });
    expect(response.data.sales.daily[1]).toMatchObject({ date: "2024-02-02", value: null, recordedCount: 0 });
    expect(response.data.sales.daily[28]).toMatchObject({ date: "2024-02-29", value: 50, recordedCount: 1 });
    expect(response.headers["Cache-Control"]).toBe("no-store");
  });
  it("does not double count coexisting closed daily snapshots", async () => {
    fixture.journals = [{ branchId: "a", date: "2026-09-30", status: "approved", totalSales: 50 }];
    fixture.daily.a = [{ id: 1, date: "2026-09-30", status: "closed", sales: 9000 }];
    expect((await get()).data.sales.confirmed).toBe(50);
  });
  it("distinguishes recorded zero, absent month history and invalid all-null monetary evidence", async () => {
    fixture.journals = [{ branchId: "a", date: "2026-08-10", status: "posted", totalSales: 100 }];
    expect((await get()).data.sales).toMatchObject({ state: "no_records", confirmed: null, recordedCount: 0,
      lastRecordedDate: "2026-08-10" });
    fixture.journals.push({ branchId: "a", date: "2026-09-30", status: "posted", totalSales: 0 });
    expect((await get()).data.sales).toMatchObject({ state: "recorded", confirmed: 0, recordedCount: 1 });
    fixture.journals[1].totalSales = null;
    expect((await get()).data.sales).toMatchObject({ state: "unavailable", confirmed: null, recordedCount: null });
  });
  it.each(["daily", "review"])("a failed %s source does not hide registered sales", async source => {
    fixture.journals = [{ branchId: "a", date: "2026-09-30", status: "posted", totalSales: 25 }];
    fixture.failed.add(`${source}:a`);
    const { data } = await get();
    expect(data.sales).toMatchObject({ available: true, state: "recorded", confirmed: 25 });
    expect(data.sourceFailures).toEqual([source]);
    expect(data.closing.canClose).toBe(false);
    expect(JSON.stringify(data)).not.toContain("private");
  });
  it("journal failure does not hide operational evidence, payroll or expense sources", async () => {
    fixture.grants.add("salary_closing:view"); fixture.grants.add("pnl:view"); fixture.grants.add("pnl_dashboard:view");
    fixture.failed.add("sales:a");
    const { data } = await get();
    expect(data.sourceFailures).toEqual(["sales"]);
    expect(data.sourceFailureDetails).toContainEqual(expect.objectContaining({ source: "sales", state: "unavailable", kind: "query_failed" }));
    expect(data.closing.dailyEvidenceAvailable).toBe(true);
    expect(data.closing.reviewEvidenceAvailable).toBe(true);
    expect(data.payroll.available).toBe(true);
    expect(data.expenses.available).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/private|SELECT|password/);
  });
  it("sales permission denial is distinct from a query failure and reads no journals", async () => {
    fixture.grants.delete("sales_analytics:view");
    const { data } = await get();
    expect(data.sales).toMatchObject({ available: false, state: "forbidden", confirmed: null });
    expect(data.sourceStates.sales).toBe("forbidden");
    expect(data.sourceFailures).toEqual([]);
    expect(data.sourceFailureDetails).toContainEqual(expect.objectContaining({ source: "sales", kind: "forbidden" }));
    expect(fixture.queries).toEqual([]);
  });
  it("a source permission lookup error is unavailable, not forbidden, and does not break independent sources", async () => {
    fixture.permissionFailures.add("sales_analytics:view");
    const { data } = await get();
    expect(data.sales).toMatchObject({ available: false, state: "unavailable", confirmed: null });
    expect(data.sourceStates.sales).toBe("unavailable");
    expect(data.sourceFailures).toEqual(["sales"]);
    expect(data.sourceFailureDetails).toContainEqual(expect.objectContaining({ source: "sales", kind: "query_failed" }));
    expect(data.closing.reviewEvidenceAvailable).toBe(true);
    expect(fixture.queries).toEqual([]);
    expect(JSON.stringify(data)).not.toMatch(/private|SQL/);
  });
  it("sales-only access never reads daily closures or review evidence", async () => {
    fixture.grants.delete("daily_closures:view");
    await get();
    expect(fixture.query.mock.calls.map(call => call[0]).join(" ")).not.toMatch(/branch_daily_closures|operations_month_reviews/);
  });
});

describe("server-resolved all-branch read-only projection", () => {
  it("ignores the board subset, excludes HQ/warehouse and includes every fresh authorized branch", async () => {
    fixture.allowed = ["a", "b", "hq", "main_warehouse", "no-longer-exists"];
    const { data } = await get("all", "2026-09", { branchIds: "a" });
    expect(data.scope).toEqual({ branchIds: ["a", "b"], branchCount: 2 });
    expect(data.branches.map((row: any) => row.branchName)).toEqual(["A", "B"]);
    expect(data).toMatchObject({ mode: "all", readOnly: true, branchId: "all" });
    expect(data).not.toHaveProperty("revision");
    expect(data).not.toHaveProperty("closing");
    for (const row of data.branches) {
      expect(row.workflow.closing).toMatchObject({ canClose: false, canReopen: false, canDeclare: false, revision: null });
      expect(row.workflow.payroll.canManage).toBe(false);
      expect(row.workflow.expenses.canManage).toBe(false);
    }
    expect(fixture.connect).not.toHaveBeenCalled();
    expect(fixture.query.mock.calls.some(call => /\b(INSERT|UPDATE|DELETE|LOCK)\b/.test(call[0]))).toBe(false);
  });
  it("returns one branch as all-mode rather than enabling aggregate mutations", async () => {
    fixture.allowed = ["a"];
    expect((await get("all")).data).toMatchObject({ mode: "all", scope: { branchCount: 1 }, readOnly: true });
  });
  it("covers the unrestricted administrator scope without silently imposing a branch cap", async () => {
    fixture.allowed = null;
    fixture.branches = Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, name: `B${i}` }));
    const response = await get("all");
    expect(response.error).toBeUndefined();
    expect(response.data.branches).toHaveLength(40);
    expect(fixture.queries).toHaveLength(80);
    expect(fixture.maxSales).toBeLessThanOrEqual(6); // <=3 branches, two journal queries each
  });
  it("denies zero grants and filters revoked branches on the very next request", async () => {
    expect((await get("all")).data.scope.branchIds).toEqual(["a", "b"]);
    fixture.allowed = ["b"];
    fixture.queries = [];
    expect((await get("all")).data.scope.branchIds).toEqual(["b"]);
    expect(fixture.queries.every(row => row.params[0] === "b")).toBe(true);
    fixture.allowed = [];
    fixture.query.mockClear();
    expect((await get("all")).error.status).toBe(403);
    expect(fixture.query).not.toHaveBeenCalled();
  });
  it("denies scope with no existing operational branch and separates lookup failure from denial", async () => {
    fixture.allowed = ["hq", "main_warehouse", "deleted"];
    expect((await get("all")).error.status).toBe(403);
    fixture.allowed = ["a"]; fixture.failed.add("scope");
    const response = await get("all");
    expect(response.error.status).toBe(503);
    expect(response.error.message).not.toContain("private");
  });
  it.each(["close", "reopen", "declare", "remove-declaration"])("denies POST all/%s before any write", async action => {
    fixture.query.mockClear();
    const response = await post(action, { branchId: "all", date: "2026-09-01" });
    expect(response.error.status).toBe(400);
    expect(fixture.query).not.toHaveBeenCalled();
    expect(fixture.connect).not.toHaveBeenCalled();
  });
  it("retains a partial sales subtotal and unknown branch metrics, never zero-fill", async () => {
    fixture.journals = [{ branchId: "a", date: "2026-09-30", status: "approved", totalSales: 0 }];
    fixture.failed.add("sales:b");
    const { data } = await get("all");
    expect(data.totals.sales).toMatchObject({ confirmed: 0, recordedCount: 1,
      coverage: { state: "partial", completeCount: 1, unavailableCount: 1, unknownCount: 1 } });
    expect(data.totals.metrics.sales.confirmed).toEqual({ value: 0, knownCount: 1, unknownCount: 1, state: "partial" });
    expect(data.branches[1].workflow.sales).toMatchObject({ state: "unavailable", confirmed: null });
    expect(data.branches[0].workflow.sales.daily[29]).toMatchObject({ date: "2026-09-30", value: 0, recordedCount: 1 });
    expect(data.branches[0].workflow.sales.daily[0]).toMatchObject({ date: "2026-09-01", value: null, recordedCount: 0 });
    expect(data.branches[1].workflow.sales.daily.every((day: any) => day.value === null && day.recordedCount === null)).toBe(true);
    expect(data.totals.closing.coverage.completeCount).toBe(2);
  });
  it("all financial sections stay unknown when all branch values are unknown", async () => {
    fixture.grants.add("salary_closing:view"); fixture.grants.add("pnl:view"); fixture.grants.add("pnl_dashboard:view");
    const { data } = await get("all");
    expect(data.totals.sales.confirmed).toBeNull();
    expect(data.totals.expenses.recorded).toBeNull();
    expect(data.totals.expenses.paid).toBeNull();
    expect(data.totals.payroll.due).toBeNull();
    expect(data.totals.metrics.payroll.due).toMatchObject({ knownCount: 0, unknownCount: 2 });
    expect(data.totals.payroll.coverage).toMatchObject({ partialCount: 2, unknownCount: 2 });
    expect(data.totals.sales.coverage).toMatchObject({ partialCount: 2, completeCount: 0 });
  });
  it("source grant revocation immediately removes data and marks forbidden coverage, not an empty total", async () => {
    fixture.journals = [{ branchId: "a", date: "2026-09-30", status: "posted", totalSales: 50 }];
    expect((await get("all")).data.totals.sales.confirmed).toBe(50);
    fixture.grants.delete("sales_analytics:view");
    fixture.queries = [];
    const { data } = await get("all");
    expect(data.totals.sales).toMatchObject({ confirmed: null, recordedCount: null,
      coverage: { state: "unavailable", forbiddenCount: 2, unknownCount: 2 } });
    expect(data.totals.metrics.sales.confirmed.knownCount).toBe(0);
    expect(fixture.queries).toEqual([]);
  });
});

describe("financial evidence and operational lifecycle remain distinct", () => {
  it("never offsets payroll deficits/excess per employee or across branches", async () => {
    fixture.grants.add("salary_closing:view");
    fixture.closures = { a: { id: "a", status: "closed", total_net: 200 }, b: { id: "b", status: "closed", total_net: 100 } };
    fixture.lines = { a: [{ employeeId: 1, name: "A", due: 100 }, { employeeId: 2, name: "B", due: 100 }],
      b: [{ employeeId: 1, name: "Other branch same ID", due: 100 }] };
    fixture.payments = {
      a: [{ id: 1, employeeId: 1, amount: 200, paidAt: "2026-09-30", method: "cash" }],
      b: [{ id: 2, employeeId: 1, amount: 200, paidAt: "2026-09-30", method: "cash" }],
    };
    const { data } = await get("all");
    expect(data.totals.payroll).toMatchObject({ due: 300, paid: 400, remaining: 100, overpaid: 200 });
    expect(data.branches[0].workflow.payroll.employees[1].remaining).toBe(100);
  });
  it("flags a closed payroll header/line mismatch instead of certifying settlement", async () => {
    fixture.grants.add("salary_closing:view");
    fixture.closures.a = { id: "a", status: "closed", total_net: 200 };
    fixture.lines.a = [{ employeeId: 1, name: "A", due: 100 }];
    fixture.payments.a = [{ id: 1, employeeId: 1, amount: 100, paidAt: "2026-09-30", method: "cash" }];
    const { data } = await get();
    expect(data.payroll).toMatchObject({ status: "closed", snapshotMismatch: true, snapshotHeaderDue: 200,
      snapshotLinesDue: 100, settlementStatus: "unreconciled", paid: null, remaining: null, overpaid: null, recordedPaid: 100 });
    expect(data.payroll.reason).toContain("لا يطابق");
  });
  it("unknown payments and unmatched employees remain unproven, not settled", async () => {
    fixture.grants.add("salary_closing:view");
    fixture.closures.a = { id: "a", status: "closed", total_net: 100 };
    fixture.lines.a = [{ employeeId: 1, name: "A", due: 100 }];
    fixture.payments.a = [{ id: 1, employeeId: 1, amount: null, paidAt: "2026-09-30", method: "cash" }];
    expect((await get()).data.payroll).toMatchObject({ settlementStatus: "unknown_amount", paid: null, remaining: null });
    fixture.payments.a = [{ id: 1, employeeId: 2, amount: 100, paidAt: "2026-09-30", method: "cash" }];
    expect((await get()).data.payroll).toMatchObject({ settlementStatus: "unreconciled", paid: null, remaining: null });
  });
  it.each(["salary_closures", "salary_closure_lines", "salary_payments"])(
    "a %s query failure leaves other files live and the all-mode payroll subtotal explicitly partial",
    async table => {
      fixture.grants.add("salary_closing:view"); fixture.grants.add("pnl:view"); fixture.grants.add("pnl_dashboard:view");
      fixture.closures = { a: { id: "a", status: "closed", total_net: 100 }, b: { id: "b", status: "closed", total_net: 100 } };
      fixture.lines = { a: [{ employeeId: 1, name: "A", due: 100 }], b: [{ employeeId: 1, name: "B", due: 100 }] };
      fixture.journals = [
        { branchId: "a", date: "2026-09-30", status: "posted", totalSales: 50 },
        { branchId: "b", date: "2026-09-30", status: "posted", totalSales: 60 },
      ];
      const previous = fixture.query.getMockImplementation()!;
      fixture.query.mockImplementation(async (sql: string, params: any[] = []) => {
        if (sql.includes(`FROM ${table} `) && params[0] === "b")
          throw Object.assign(new Error("private financial SQL diagnostics"), { code: "42P01" });
        return previous(sql, params);
      });
      const { data } = await get("all");
      expect(data.totals.payroll).toMatchObject({ due: 100, remaining: 100,
        coverage: { state: "partial", completeCount: 1, unavailableCount: 1, unknownCount: 1 } });
      expect(data.totals.metrics.payroll.due).toMatchObject({ knownCount: 1, unknownCount: 1, state: "partial" });
      expect(data.branches[1].workflow.payroll).toMatchObject({ available: false, due: null, paid: null, remaining: null });
      expect(data.totals.sales.confirmed).toBe(110);
      expect(data.branches[1].workflow.closing.dailyEvidenceAvailable).toBe(true);
      expect(data.branches[1].workflow.expenses.available).toBe(true);
      expect(JSON.stringify(data)).not.toMatch(/private|diagnostic/);
    },
  );
  it("missing recurring table explicitly fails before storage's silent [] fallback", async () => {
    fixture.grants.add("pnl:view"); fixture.grants.add("pnl_dashboard:view");
    fixture.rent.mockResolvedValue({ found: true, amount: 0 });
    expect((await get()).data.expenses).toMatchObject({ available: true, recorded: 0, paid: null });
    fixture.recurring.mockClear();
    fixture.failed.add("recurring");
    const { data } = await get();
    expect(data.expenses).toMatchObject({ available: false, recorded: null, paid: null });
    expect(data.sourceFailureDetails).toContainEqual(expect.objectContaining({ source: "expenses", kind: "schema_not_ready" }));
    expect(fixture.recurring).not.toHaveBeenCalled();
    expect(data.sales.available).toBe(true);
    expect(data.closing.dailyEvidenceAvailable).toBe(true);
  });
  it("only elapsed Saudi dates are missing while the current month still cannot close", async () => {
    const { data } = await get("a", "2026-10");
    expect(data.closing).toMatchObject({ ended: false, canClose: false, missingDates: ["2026-10-01"] });
    expect(data.closing.blockers.join(" ")).not.toContain("2026-10-02");
    expect((await post("close", { month: "2026-10" })).error.status).toBe(409);
    expect((await get("a", "2026-11")).data.closing.missingDates).toEqual([]);
    expect(monthlyEvidence("2026-10", [], [], "2026-10-01").missingDates).toEqual(["2026-10-01"]);
  });
  it("operational close retains its atomic locked snapshot and live sales do not become approved financial totals", async () => {
    fixture.daily.a = monthCalendar("2026-09").map((date, i) => ({ id: i + 1, date, status: "closed", sales: 100, updated: "2026-10-01" }));
    fixture.journals = [{ branchId: "a", date: "2026-09-30", status: "approved", totalSales: 50 }];
    const response = await post("close");
    expect(response.error).toBeUndefined();
    expect(response.data.command).toMatchObject({ committed: true, revision: 1, changed: true });
    expect(response.data.workflow.sales.confirmed).toBe(50);
    expect(response.data.workflow.provenance).toEqual({ financialMetrics: "live_source_metrics",
      review: "operational_daily_review_snapshot", financialApproval: false });
    expect(response.data.workflow.closing.snapshotRecords).toHaveLength(30);
    const sqls = fixture.query.mock.calls.map(call => call[0]);
    expect(sqls).toContain("BEGIN");
    expect(sqls).toContain("LOCK TABLE branch_daily_closures IN SHARE MODE");
    expect(sqls.some(sql => sql.includes("pg_advisory_xact_lock"))).toBe(true);
    expect(sqls.indexOf("COMMIT")).toBeGreaterThan(sqls.findIndex(sql => sql.startsWith("UPDATE operations_month_reviews")));
    expect(fixture.release).toHaveBeenCalledOnce();
    fixture.query.mockClear();
    expect((await post("close")).data.command).toMatchObject({ committed: true, changed: false, revision: 1 });
    expect(fixture.query.mock.calls.some(call => call[0].startsWith("UPDATE"))).toBe(false);
    fixture.journals[0].totalSales = 75;
    const refreshed = (await get()).data;
    expect(refreshed.closing.drifted).toBe(false);
    expect(refreshed.sales.confirmed).toBe(75);
  });
  it("stale revisions and daily drift retain the original rollback/reopen guards", async () => {
    fixture.daily.a = monthCalendar("2026-09").map((date, i) => ({ id: i + 1, date, status: "closed", sales: 100 }));
    fixture.reviews.a = { status: "open", revision: 2, declarations: [], history: [] };
    expect((await post("close")).error.status).toBe(409);
    expect(fixture.query.mock.calls.some(call => call[0] === "ROLLBACK")).toBe(true);
    const fingerprint = createHash("sha256").update(JSON.stringify({ rows: fixture.daily.a, declarations: [] })).digest("hex");
    fixture.reviews.a = { status: "closed", revision: 2, fingerprint, declarations: [], history: [] };
    fixture.daily.a[0].sales++;
    expect((await get()).data.closing).toMatchObject({ drifted: true, canClose: false, canReopen: true });
    expect((await post("close", { revision: 2 })).error.status).toBe(409);
    expect((await post("reopen", { revision: 2 })).data.command).toMatchObject({ revision: 3, changed: true });
    expect((await post("reopen", { revision: 2 })).data.command).toMatchObject({ revision: 3, changed: false });
  });
  it("declarations keep their conflict checks and retry idempotency", async () => {
    fixture.daily.a = monthCalendar("2026-09").slice(1).map((date, i) => ({ id: i + 1, date, status: "closed", sales: 100 }));
    expect((await post("declare", { date: "2026-09-02" })).error.status).toBe(409);
    expect((await post("declare", { date: "2026-09-01" })).data.command).toMatchObject({ changed: true, revision: 1 });
    expect((await post("declare", { date: "2026-09-01" })).data.command).toMatchObject({ changed: false, revision: 1 });
    expect((await post("remove-declaration", { date: "2026-09-01", revision: 1 })).data.command).toMatchObject({ changed: true, revision: 2 });
    expect((await post("remove-declaration", { date: "2026-09-01", revision: 1 })).data.command).toMatchObject({ changed: false, revision: 2 });
  });
  it("postcommit source failure preserves the saved command, never invites duplicate writes", async () => {
    fixture.daily.a = monthCalendar("2026-09").map((date, i) => ({ id: i + 1, date, status: "closed", sales: 100 }));
    fixture.afterCommitFailure = true;
    const response = await post("close");
    expect(response.error).toBeUndefined();
    expect(response.data).toMatchObject({ command: { committed: true, changed: true, revision: 1 }, refresh: "partial" });
    expect(response.data.message).toContain("الإجراء محفوظ");
    expect(fixture.query.mock.calls.some(call => call[0] === "ROLLBACK")).toBe(false);
  });
  it("nullable summary helper never replaces all unknown values with zero", () => {
    expect(monthMetric([null, undefined])).toEqual({ value: null, knownCount: 0, unknownCount: 2, state: "unavailable" });
    expect(monthMetric([0, null])).toEqual({ value: 0, knownCount: 1, unknownCount: 1, state: "partial" });
  });
});