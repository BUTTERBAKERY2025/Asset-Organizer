import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { Request } from "express";
import { branches, branchDailyClosures, cashierSalesJournals } from "../shared/schema";
import { makeOperationsQueueItem } from "../shared/operations-center";
import {
  buildOperationsObservations, operationsDateRange, operationsMonthPeriod, operationsPerformancePeriod,
  parseOperationsPerformanceDays, projectRegisteredSales, registeredSalesHref,
} from "../shared/operations-performance";

const state = vi.hoisted(() => ({
  allowed: ["a", "b"] as string[],
  grants: new Set<string>(),
  rows: [] as { branchId: string; date: string; status: string; totalSales: number; netSales?: number }[],
  failed: false,
  queries: [] as { table: string; sql: string; params: unknown[]; selection: string[] }[],
  poolQuery: vi.fn(),
}));
vi.mock("../server/auth", () => ({
  getAllowedBranchIds: () => state.allowed,
  isAuthenticated: () => {},
  requirePermission: () => () => {},
  HR_SPECIALIST_PERMISSIONS: {},
}));
vi.mock("../server/storage", () => ({ storage: {} }));
vi.mock("../server/branch-operations", () => ({
  branchOperationsDefinitions: [],
  loadAuthorizedBranchOperationsCard: vi.fn(),
  hasEffectiveViewPermission: async (_req: unknown, module: string, action = "view") => state.grants.has(`${module}:${action}`),
}));
// Any accidental provider call is a test failure; these tests never inspect/set keys.
vi.mock("openai", () => ({ default: class { constructor() { throw new Error("External AI must not be called by this test"); } } }));
vi.mock("../server/db", () => ({
  pool: { query: state.poolQuery },
  db: { select: (selection: Record<string, unknown>) => ({
    from: (table: unknown) => {
      let condition: any;
      const name = table === branches ? "branches" : table === cashierSalesJournals ? "journals" :
        table === branchDailyClosures ? "closures" : "unexpected";
      const result = async () => {
        const query = new PgDialect().sqlToQuery(condition);
        const fields = Object.entries(selection).map(([key, value]) => {
          const expression = value && typeof (value as any).getSQL === "function" ? (value as any).getSQL() : value;
          return `${key}:${new PgDialect().sqlToQuery(expression as any).sql}`;
        });
        state.queries.push({ table: name, sql: `${fields.join(", ")} WHERE ${query.sql}`, params: query.params, selection: Object.keys(selection) });
        if (name === "branches") return state.allowed.filter(id => query.params.includes(id)).map(id => ({ id, name: `Branch ${id}` }));
        if (name === "closures") throw new Error("Closure sales must not be read");
        if (name !== "journals") throw new Error(`Unexpected table ${name}`);
        if (state.failed) throw new Error("private SQL diagnostic must not escape");
        const dates = query.params.filter(value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) as string[];
        const filtered = state.rows.filter(row => query.params.includes(row.branchId) && query.params.includes(row.status)
          && row.date <= dates[0] && (!dates[1] || row.date >= dates[1]));
        if (!("sales" in selection)) return [...new Set(filtered.map(row => row.branchId))].map(branchId => ({
          branchId, date: filtered.filter(row => row.branchId === branchId).map(row => row.date).sort().at(-1),
        }));
        const groups = new Map<string, { branchId: string; date: string; sales: number; recordedCount: number }>();
        for (const row of filtered) {
          const key = `${row.branchId}:${row.date}`;
          const aggregate = groups.get(key) ?? { branchId: row.branchId, date: row.date, sales: 0, recordedCount: 0 };
          aggregate.sales += row.totalSales;
          aggregate.recordedCount++;
          groups.set(key, aggregate);
        }
        return [...groups.values()];
      };
      const builder: any = {
        where: (value: any) => { condition = value; return builder; }, groupBy: () => builder,
        orderBy: () => builder, limit: () => builder,
        then: (resolve: any, reject: any) => result().then(resolve, reject),
      };
      return builder;
    },
  }) },
}));

import { projectOperationsCenter, registerOperationsCenterRoutes } from "../server/operations-center";
import { canonicalOperationsInsights, operationsEvidenceRevision, operationsInsightRecords } from "../server/operations-performance";

const handlers = new Map<string, (...args: any[]) => Promise<any>>();
registerOperationsCenterRoutes({
  get: (path: string, ...callbacks: any[]) => handlers.set(`GET ${path}`, callbacks.at(-1)),
  post: (path: string, ...callbacks: any[]) => handlers.set(`POST ${path}`, callbacks.at(-1)),
} as any);
const request = (query: Record<string, unknown> = {}) => ({ query, currentUser: { id: "me", role: "viewer" } }) as unknown as Request;
let actor = 0;
async function invoke(path: string, query = {}, body = {}, userId = `actor-${++actor}`) {
  const res: any = { statusCode: 200, data: undefined, headers: {} as Record<string, string>,
    set(key: string, value: string) { res.headers[key] = value; return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(data: unknown) { res.data = data; return res; },
  };
  await handlers.get(path)!({ ...request(query), body, currentUser: { id: userId, role: "viewer" } }, res, (error: unknown) => { throw error; });
  return res;
}

beforeEach(() => {
  vi.useFakeTimers();
  // UTC Sep 30 is already October 1 in Riyadh.
  vi.setSystemTime(new Date("2026-09-30T22:15:00Z"));
  state.allowed = ["a", "b"];
  state.grants = new Set(["sales_analytics:view"]);
  state.rows = [];
  state.failed = false;
  state.queries = [];
  state.poolQuery.mockReset().mockImplementation(async (sql: string, params: unknown[]) => {
    // The supply source now validates authorized branches through pool.query,
    // even when all its source permissions are forbidden. Model the real
    // branch lookup without replacing supply coverage or insights logic.
    if (sql === "SELECT id,name FROM branches WHERE id=ANY($1::varchar[]) ORDER BY id") {
      const requested = params[0] as string[];
      return { rows: state.allowed.filter(id => requested.includes(id)).map(id => ({ id, name: `Branch ${id}` })) };
    }
    throw new Error("Unexpected supply SQL query without a corresponding source grant");
  });
});
afterEach(() => vi.useRealTimers());

describe("authoritative registered sales contract", () => {
  it("uses journal total_sales posted/approved only, never closure/net/return-adjusted sources", async () => {
    state.rows = [
      { branchId: "a", date: "2026-09-30", status: "posted", totalSales: 100, netSales: 70 },
      { branchId: "a", date: "2026-09-30", status: "approved", totalSales: 50, netSales: 30 },
      { branchId: "b", date: "2026-10-01", status: "approved", totalSales: 25, netSales: 20 },
      { branchId: "a", date: "2026-09-30", status: "submitted", totalSales: 1000 },
      { branchId: "a", date: "2026-09-30", status: "draft", totalSales: 2000 },
      { branchId: "a", date: "2026-10-02", status: "approved", totalSales: 3000 },
      { branchId: "hidden", date: "2026-09-30", status: "posted", totalSales: 5000 },
    ];
    const data = await projectOperationsCenter(request(), ["a", "b"], 0);
    expect(data.businessDate).toBe("2026-10-01");
    expect(data.analytics!.period).toEqual({ from: "2026-09-25", to: "2026-10-01", days: 7, timeZone: "Asia/Riyadh", kind: "rolling_inclusive" });
    expect(data.analytics!.sales).toMatchObject({ total: 175, state: "recorded", recordedCount: 3, recordedBranchDays: 2, lastRecordedDate: "2026-10-01" });
    expect(data.analytics!.sales.daily.find(day => day.date === "2026-09-30")).toMatchObject({ value: 150, recordedBranches: 1, recordedCount: 2 });
    expect(data.analytics!.sales.daily[0].value).toBeNull();
    expect(data.analytics!.sales.hrefs[0].href).toBe("/sales-analytics?branchId=a&fromDate=2026-09-25&toDate=2026-10-01");
    expect(state.queries.map(query => query.table)).toEqual(["branches", "journals", "journals"]);
    const aggregate = state.queries.find(query => query.selection.includes("sales"))!;
    expect(aggregate.sql).toContain('sum("cashier_sales_journals"."total_sales"::double precision)');
    expect(aggregate.params).toEqual(["a", "b", "posted", "approved", "2026-10-01", "2026-09-25"]);
    expect(aggregate.sql).not.toMatch(/closure|net_sales|return/);
    expect(JSON.stringify(data.analytics)).not.toMatch(/cashierId|journalId|cashier-journals/);
  });

  it("distinguishes old authorized history, no history, recorded zero, failed and forbidden", async () => {
    state.rows = [{ branchId: "a", date: "2026-08-15", status: "approved", totalSales: 42 }];
    const empty = (await projectOperationsCenter(request(), ["a", "b"], 0)).analytics!.sales;
    expect(empty).toMatchObject({ state: "no_records", total: null, recordedCount: 0, recordedBranchDays: 0, lastRecordedDate: "2026-08-15" });
    expect(empty.byBranch[1].lastRecordedDate).toBeNull();
    state.rows.push({ branchId: "a", date: "2026-09-30", status: "posted", totalSales: 0 });
    const zero = (await projectOperationsCenter(request(), ["a"], 0)).analytics!.sales;
    expect(zero).toMatchObject({ state: "recorded", total: 0, recordedCount: 1, recordedBranchDays: 1 });
    expect(zero.daily.find(day => day.date === "2026-09-30")!.value).toBe(0);
    state.failed = true;
    const failed = (await projectOperationsCenter(request(), ["a"], 0)).analytics!.sales;
    expect(failed).toMatchObject({ state: "unavailable", total: null, recordedCount: null, recordedBranchDays: null, lastRecordedDate: null });
    expect(failed.daily[0].recordedCount).toBeNull();
    state.grants.clear();
    state.queries = [];
    const forbidden = (await projectOperationsCenter(request(), ["a"], 0)).analytics!.sales;
    expect(forbidden).toMatchObject({ state: "forbidden", total: null, hrefs: [], recordedCount: null });
    expect(state.queries.map(query => query.table)).toEqual(["branches"]);
  });

  it("requires source export independently and does not leak details from aggregate permission", async () => {
    state.rows = [{ branchId: "a", date: "2026-10-01", status: "approved", totalSales: 99 }];
    const denied = await projectOperationsCenter(request(), ["a"], 0, true);
    expect(denied.analytics!.sales.state).toBe("forbidden");
    expect(state.queries.map(query => query.table)).toEqual(["branches"]);
    state.grants.add("sales_analytics:export");
    const allowed = await projectOperationsCenter(request(), ["a"], 0, true);
    expect(allowed.analytics!.sales.total).toBe(99);
    expect(allowed.queue).toEqual([]);
    expect(allowed.modules).not.toContain("cashier_journal");
    expect(operationsInsightRecords(allowed)).toEqual([expect.objectContaining({
      sourceType: "sales_trend", sourceId: "2026-09-25/2026-10-01", href: allowed.analytics!.sales.hrefs[0].href,
    })]);
    await expect(projectOperationsCenter(request(), ["hidden"], 0)).rejects.toMatchObject({ status: 403 });
  });

  it("validates range before reads, changes sales only, and handles month boundaries", async () => {
    for (const invalid of [0, 14, "07", "", null, ["7"], {}, "30.0"]) expect(() => parseOperationsPerformanceDays(invalid)).toThrow();
    expect(parseOperationsPerformanceDays(undefined)).toBe(7);
    expect(parseOperationsPerformanceDays("30")).toBe(30);
    const invalid = await invoke("GET /api/operations-center", { branchIds: "a", performanceDays: "14" });
    expect(invalid.statusCode).toBe(400);
    expect(state.queries).toEqual([]);
    const seven = await projectOperationsCenter(request({ performanceDays: "7" }), ["a"], 0);
    const thirty = await projectOperationsCenter(request({ performanceDays: "30" }), ["a"], 0);
    expect(thirty.analytics!.period).toMatchObject({ from: "2026-09-02", to: "2026-10-01", days: 30 });
    expect(thirty.analytics!.sales.daily).toHaveLength(30);
    expect(thirty.daily).toEqual(seven.daily);
    expect(thirty.weekly).toEqual(seven.weekly);
    expect(thirty.queue).toEqual(seven.queue);
    expect(thirty.analytics!.followups).toMatchObject({ period: "current", coverage: "unavailable", scan: { sourceLimit: 100, truncated: false } });
    expect(operationsPerformancePeriod(new Date("2027-01-01T00:00:00Z"), 7).from).toBe("2026-12-26");
    expect(operationsMonthPeriod("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(operationsMonthPeriod("2026-02").to).toBe("2026-02-28");
  });

  it("monthly sales uses the same source/rule and exact real-month drilldown", async () => {
    state.rows = [
      { branchId: "a", date: "2026-02-28", status: "posted", totalSales: 60, netSales: 20 },
      { branchId: "a", date: "2026-03-01", status: "approved", totalSales: 90 },
    ];
    const monthly = await invoke("GET /api/operations-center/monthly", { branchIds: "a", month: "2026-02" });
    expect(monthly.data.sections).toEqual([expect.objectContaining({ id: "sales", value: 60,
      href: "/sales-analytics?branchId=a&fromDate=2026-02-01&toDate=2026-02-28" })]);
    expect(state.queries.map(query => query.table)).toEqual(["branches", "journals", "journals"]);
  });
});

describe("deterministic observations and safe AI evidence", () => {
  it("selects largest loaded branch backlog and actual actor decisions, retains off-page canonical refs", async () => {
    const data = await projectOperationsCenter(request(), ["a", "b"], 0);
    const item = (id: number, branchId: string) => makeOperationsQueueItem("branch_complaint", id, "resolved", branchId,
      "branch_complaints", "شكوى تحتاج قرارًا", "resolved", `/branch-complaints?branchId=${branchId}`);
    const first = item(1, "a"), offPage = item(2, "b"), other = item(3, "b");
    offPage.decision = { awaitingActor: true, actorId: "me", reason: "مرحلة حقيقية", label: "مراجعة",
      href: offPage.href, capability: "approve", permission: { module: "branch_complaints", action: "approve" } };
    other.ownerId = "me"; // Assignment alone is not a decision.
    const observations = buildOperationsObservations(data.branches, [first, offPage, other], data.analytics!.sales, data.analytics!.period, "me");
    expect(observations[0]).toMatchObject({ branchId: "b", title: "أكبر رصيد متابعة في القراءة الحالية" });
    const decisions = observations.filter(row => row.title === "قرار متاح لك الآن");
    expect(decisions).toHaveLength(1);
    expect(decisions[0].sourceRefs.map(ref => ref.sourceId)).toEqual(["2"]);
    data.queue = [first]; // b record is deliberately outside this visible page.
    data.analytics!.observations = observations;
    const records = operationsInsightRecords(data);
    const index = records.findIndex(row => row.sourceId === "2");
    expect(index).toBeGreaterThan(0);
    const result = canonicalOperationsInsights({ insights: [
      { index, title: "مراجعة 999", explanation: "راجع المصدر", href: "/forged", branchId: "hidden" },
      { index, title: "تكرار", explanation: "تكرار" },
      { index: 9999, title: "مخترع", explanation: "غير مدعوم" },
    ] }, records);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sourceId: "2", branchId: "b", href: "/branch-complaints?branchId=b&complaintId=2" });
    expect(result[0].sourceRefs).toEqual([expect.objectContaining({ sourceId: "2" })]);
    expect(result[0].title).not.toContain("999");
    expect(records[index].awaitingDecision).toBe(true);
  });

  it("compares recorded zero/positive days for each branch without treating missing days as zero", () => {
    const period = operationsPerformancePeriod(new Date(), 7);
    const dates = operationsDateRange(period.from, period.to);
    const sales = projectRegisteredSales(["a", "b"], dates, [
      { branchId: "a", date: dates[1], sales: 0, recordedCount: 1 },
      { branchId: "a", date: dates[5], sales: 15, recordedCount: 1 },
      { branchId: "b", date: dates[2], sales: 10, recordedCount: 1 },
    ], "available", []);
    const observations = buildOperationsObservations([{ id: "a", name: "A" }, { id: "b", name: "B" }], [], sales, period, "me");
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ branchId: "a", source: "cashier_sales_journals.total_sales",
      href: registeredSalesHref("a", period.from, period.to) });
    expect(observations[0].explanation).toContain(`${dates[1]}: 0`);
    expect(observations[0].explanation).toContain(dates[5]);
  });

  it("revision is refresh-stable but changes with period, evidence or current record status", async () => {
    const first = await projectOperationsCenter(request(), ["a"], 0);
    const second = await projectOperationsCenter(request(), ["a"], 0);
    expect(first.analytics!.evidenceRevision).toBe(second.analytics!.evidenceRevision);
    expect((await projectOperationsCenter(request({ performanceDays: "30" }), ["a"], 0)).analytics!.evidenceRevision).not.toBe(first.analytics!.evidenceRevision);
    state.rows.push({ branchId: "a", date: "2026-10-01", status: "posted", totalSales: 0 });
    expect((await projectOperationsCenter(request(), ["a"], 0)).analytics!.evidenceRevision).not.toBe(first.analytics!.evidenceRevision);
    const item = makeOperationsQueueItem("maintenance", 8, "open", "a", "maintenance", "صيانة", "open", "/maintenance?branchId=a");
    const before = operationsEvidenceRevision({ ...first, queue: [item] }, first.analytics!);
    expect(operationsEvidenceRevision({ ...first, queue: [{ ...item, status: "in_progress" }] }, first.analytics!)).not.toBe(before);
  });

  it("returns typed no-evidence, cooldown, unavailable and forbidden without provider calls", async () => {
    const empty = await invoke("POST /api/operations-center/insights", {}, { branchIds: ["a"], performanceDays: 30 }, "same-actor");
    expect(empty.statusCode).toBe(200);
    expect(empty.data).toMatchObject({ kind: "ai", status: "no_evidence", insights: [],
      period: { days: 30, from: "2026-09-02", to: "2026-10-01" }, scope: { branchIds: ["a"] } });
    expect(empty.data.evidenceRevision).toBeTruthy();
    expect(state.poolQuery).toHaveBeenCalledWith(
      "SELECT id,name FROM branches WHERE id=ANY($1::varchar[]) ORDER BY id", [["a"]]);
    const cooldown = await invoke("POST /api/operations-center/insights", {}, { branchIds: ["a"], performanceDays: 30 }, "same-actor");
    expect(cooldown.statusCode).toBe(429);
    expect(cooldown.data).toMatchObject({ kind: "ai", status: "cooldown", retryAfterSeconds: 60, insights: [] });
    expect(cooldown.headers["Retry-After"]).toBe("60");
    state.failed = true;
    const failed = await invoke("POST /api/operations-center/insights", {}, { branchIds: ["a"], performanceDays: 7 });
    expect(failed.statusCode).toBe(503);
    expect(failed.data.status).toBe("unavailable");
    expect(JSON.stringify(failed.data)).not.toContain("private SQL diagnostic");
    state.queries = [];
    const forbidden = await invoke("POST /api/operations-center/insights", {}, { branchIds: ["hidden"], performanceDays: 7 });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.data.status).toBe("forbidden");
    expect(state.queries).toEqual([]);
    state.grants.clear();
    const noSourcePermission = await invoke("POST /api/operations-center/insights", {}, { branchIds: ["a"], performanceDays: 7 });
    expect(noSourcePermission.statusCode).toBe(403);
    expect(noSourcePermission.data.status).toBe("forbidden");
    expect(state.queries.map(query => query.table)).toEqual(["branches"]);
    state.queries = [];
    const invalid = await invoke("POST /api/operations-center/insights", {}, { branchIds: ["a"], performanceDays: 14 });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.data.status).toBe("error");
  });

  it("rejects invalid model prose/actions without leaking forged identities or URLs", () => {
    const record = {
      sourceType: "sales_trend", sourceId: "2026-09-25/2026-10-01", branchId: "a",
      href: "/sales-analytics?branchId=a&fromDate=2026-09-25&toDate=2026-10-01",
      status: "recorded_partial", dueAt: null,
      evidence: { label: "مبيعات مسجلة", source: "cashier_sales_journals.total_sales", period: "2026-09-25/2026-10-01", value: 0, unit: "SAR" },
    };
    expect(canonicalOperationsInsights({ insights: [{ index: 0, title: "999", explanation: "88" }] }, [record])).toEqual([]);
    const output = canonicalOperationsInsights({ insights: [{ index: 0, title: "<script>متابعة</script>",
      explanation: "راجع https://forged.example/999 المصدر", branchId: "hidden", sourceId: "999", href: "/forged" }] }, [record]);
    expect(output[0]).toMatchObject({ branchId: "a", sourceId: record.sourceId, href: record.href, evidence: { value: 0 } });
    expect(output[0].explanation).not.toContain("forged");
    expect(output[0].title).not.toContain("<");
  });
});