import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parseOperationsSalesQuery, salesPagePlan } from "../shared/operations-sales";
import { operationsSalesSql, type SalesActor, type SalesGrants } from "../server/operations-sales-predicates";

const query = vi.hoisted(() => vi.fn());
const effectivePermissions = vi.hoisted(() => vi.fn());
const authority = vi.hoisted(() => vi.fn(async (req: any, module: string, action: string) =>
  req.grants?.includes(`${module}:${action}`) === true));
vi.mock("../server/db", () => ({ pool: { query } }));
vi.mock("../server/auth", () => ({ getAllowedBranchIds: (req: any) => req.allowed }));
vi.mock("../server/storage", () => ({ storage: { getUserPermissions: effectivePermissions } }));
vi.mock("../server/branch-operations", () => ({ hasAuthoritativePermission: authority }));
import { projectOperationsSales, projectSalesRecord, salesCanViewAllCashiers, salesGrants, type SalesRow } from "../server/operations-sales";

const actor: SalesActor = { id: "operator", role: "operations_manager" };
const grants: SalesGrants = {
  journalsView: true, journalsApprove: true, closuresView: true, closuresApprove: true, allCashiers: true,
};
const row: SalesRow = {
  id: 7, branch_id: "a", status: "submitted", business_date: "2026-01-01",
  created_by: "creator", creator_name: "منشئ السجل", cashier_id: "cashier", cashier_name: "الكاشير",
  total_sales: "123.50", cash_discrepancy: "-5", bank_discrepancy: 0, journals_count: 2,
};
const req = (extra: Record<string, unknown> = {}) => ({
  currentUser: actor, allowed: ["a", "b"],
  grants: ["cashier_journal:view", "cashier_journal:approve", "daily_closures:view", "daily_closures:approve"],
  ...extra,
}) as any;
function database(counts: Partial<Record<"journals" | "closures", string>> = { journals: "2", closures: "3" }) {
  query.mockImplementation(async (text: string, values: unknown[]) => {
    if (text.includes("FROM branches")) return { rows: (values[0] as string[]).map(id => ({ id, name: `Branch ${id}` })) };
    const journal = text.includes("cashier_sales_journals");
    if (text.includes("count(*)")) return { rows: [{ total: (journal ? counts.journals : counts.closures) ?? "0" }] };
    return { rows: [{ ...row, status: journal ? "submitted" : "open", cashier_id: journal ? "cashier" : undefined }] };
  });
}

describe("sales independent scope and full source paging", () => {
  beforeEach(() => {
    query.mockReset(); effectivePermissions.mockReset(); authority.mockClear();
    effectivePermissions.mockResolvedValue([{ module: "cashier_journal", actions: ["view", "approve"] }]);
    database();
  });
  it.each([{}, { branchIds: "all" }, { branchIds: ["a"] }, { branchIds: "a,a" }, { branchIds: "a," },
    { branchIds: Array.from({ length: 31 }, (_, i) => `b${i}`).join(",") },
    { branchIds: "a", source: "sales" }, { branchIds: "a", source: ["closures"] },
    { branchIds: "a", offset: "-1" }, { branchIds: "a", offset: "1.2" }, { branchIds: "a", offset: ["1"] },
    { branchIds: "a", offset: "9007199254740992" }, { branchIds: "a", limit: "101" },
    { branchIds: "a", limit: "0" }, { branchIds: "a", limit: "1.1" }])("rejects malformed queries %j", input => {
    expect(() => parseOperationsSalesQuery(input)).toThrow();
  });
  it("supports offsets beyond the generic source cap and crosses source boundaries exactly", () => {
    expect(parseOperationsSalesQuery({ branchIds: "a,b", source: "closures", offset: "900", limit: "30" }))
      .toEqual({ branchIds: ["a", "b"], source: "closures", offset: 900, limit: 30 });
    expect(salesPagePlan([{ source: "journals", count: 102 }, { source: "closures", count: 202 }], 100, 30))
      .toEqual([{ source: "journals", offset: 100, limit: 2 }, { source: "closures", offset: 0, limit: 28 }]);
    expect(salesPagePlan([{ source: "journals", count: 102 }, { source: "closures", count: 202 }], 290, 30))
      .toEqual([{ source: "closures", offset: 188, limit: 14 }]);
  });
  it("refuses revoked, absent and nonexistent branch scopes without widening", async () => {
    await expect(projectOperationsSales(req({ allowed: [] }), ["a"], "all")).rejects.toMatchObject({ status: 403 });
    await expect(projectOperationsSales(req(), ["c"], "all")).rejects.toMatchObject({ status: 403 });
    await expect(projectOperationsSales(req(), [], "all")).rejects.toMatchObject({ status: 400 });
    query.mockResolvedValueOnce({ rows: [] });
    await expect(projectOperationsSales(req(), ["a"], "all")).rejects.toMatchObject({ status: 403 });
  });
  it("counts complete selected sources before paging without LIMIT on the count", async () => {
    const result = await projectOperationsSales(req(), ["a"], "all", 1, 3);
    const counts = query.mock.calls.filter(([text]) => text.includes("count(*)"));
    expect(counts).toHaveLength(2);
    expect(counts.every(([text]) => !text.includes("LIMIT"))).toBe(true);
    const pages = query.mock.calls.filter(([text]) => text.includes("ORDER BY r."));
    expect(pages.map(([, values]) => values.slice(-2))).toEqual([[1, 1], [2, 0]]);
    expect(result.coverage).toMatchObject({ total: 5, nextOffset: 4 });
    expect(result.records.map(record => record.domain)).toEqual(["journals", "closures"]);
  });
  it("does not load unrelated financial sources when selecting one source", async () => {
    const result = await projectOperationsSales(req(), ["a"], "closures", 120, 30);
    expect(query.mock.calls.some(([text]) => text.includes("cashier_sales_journals"))).toBe(false);
    expect(query.mock.calls.filter(([text]) => text.includes("count(*)"))).toHaveLength(1);
    expect(result.coverage.sources.journals).toEqual({ state: "unavailable", reason: "Source not selected; count not requested" });
  });
  it("fetches the full older SQL page beyond 100 records without a newest-record scan", async () => {
    database({ closures: "204" });
    const result = await projectOperationsSales(req(), ["a"], "closures", 120, 30);
    const pages = query.mock.calls.filter(([text]) => text.includes("ORDER BY r."));
    expect(pages).toHaveLength(1);
    expect(pages[0][1].slice(-2)).toEqual([30, 120]);
    expect(result.coverage).toMatchObject({ total: 204, nextOffset: 150 });
  });
  it("keeps a cashier without an effective all-cashier grant within their own records", async () => {
    effectivePermissions.mockResolvedValue([]);
    query.mockImplementation(async (text: string) => {
      if (text.includes("FROM branches")) return { rows: [{ id: "a", name: "A" }] };
      if (text.includes("count(*)")) return { rows: [{ total: "1" }] };
      return { rows: [{ ...row, cashier_id: actor.id }] };
    });
    const result = await projectOperationsSales(req({ grants: ["cashier_journal:view"] }), ["a"], "journals");
    expect(result.records).toHaveLength(1);
    expect(result.records[0].decision).toBeUndefined();
    const sourceQueries = query.mock.calls.filter(([text]) => text.includes("cashier_sales_journals"));
    expect(sourceQueries.every(([text, values]) => text.includes("r.cashier_id=$3") && values[2] === actor.id)).toBe(true);
  });
  it("uses Saudi date including midnight boundary for identical count/page predicates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T21:01:00Z"));
    try {
      const result = await projectOperationsSales(req(), ["a"], "all");
      expect(result.businessDate).toBe("2026-01-02");
      expect(query.mock.calls.filter(([text]) => !text.includes("FROM branches"))
        .every(([, values]) => values[1] === "2026-01-02")).toBe(true);
    } finally { vi.useRealTimers(); }
  });
  it("reports denied or unavailable counts as unknown rather than zero", async () => {
    const denied = await projectOperationsSales(req({ grants: [] }), ["a"], "all");
    expect(denied.records).toEqual([]);
    expect(denied.coverage.total).toBeNull();
    expect(denied.summaries.every(summary => summary.value === null && summary.coverage === "forbidden")).toBe(true);
    query.mockImplementation(async (text: string) => {
      if (text.includes("FROM branches")) return { rows: [{ id: "a", name: "A" }] };
      throw new Error("Source unavailable");
    });
    const failure = await projectOperationsSales(req(), ["a"], "all");
    expect(failure.coverage.total).toBeNull();
    expect(failure.summaries.every(summary => summary.value === null && summary.coverage === "unavailable")).toBe(true);
  });
  it("drops invalid page records without leaking cross-branch or other-cashier data", async () => {
    query.mockImplementation(async (text: string) => {
      if (text.includes("FROM branches")) return { rows: [{ id: "a", name: "A" }] };
      if (text.includes("count(*)")) return { rows: [{ total: "1" }] };
      return { rows: [{ ...row, branch_id: "b", cashier_id: "other" }] };
    });
    const result = await projectOperationsSales(req(), ["a"], "journals");
    expect(result.records).toEqual([]);
    expect(result.coverage.sources.journals.state).toBe("unavailable");
    expect(result.summaries[0].value).toBeNull();
    expect(result.coverage.total).toBeNull();
  });
  it("marks page failure unknown after a successful count", async () => {
    query.mockImplementation(async (text: string) => {
      if (text.includes("FROM branches")) return { rows: [{ id: "a", name: "A" }] };
      if (text.includes("count(*)")) return { rows: [{ total: "1" }] };
      throw new Error("Page failure");
    });
    const result = await projectOperationsSales(req(), ["a"], "closures");
    expect(result.coverage).toMatchObject({ total: null, nextOffset: null });
    expect(result.records).toEqual([]);
  });
  it("shows a genuinely empty authorized source as zero", async () => {
    database({ journals: "0", closures: "0" });
    const result = await projectOperationsSales(req(), ["a"], "all");
    expect(result.coverage.total).toBe(0);
    expect(result.summaries.every(summary => summary.value === 0 && summary.coverage === "complete")).toBe(true);
    expect(result.records).toEqual([]);
  });
});

describe("sales source authority and source facts", () => {
  beforeEach(() => { effectivePermissions.mockReset(); authority.mockClear(); });
  it("uses fresh effective cashier visibility and authoritative module actions", async () => {
    effectivePermissions.mockResolvedValue([{ module: "cashier_performance", actions: ["approve"] }]);
    expect(await salesCanViewAllCashiers(req({ grants: ["cashier_performance:approve"] }))).toBe(true);
    expect(effectivePermissions).toHaveBeenCalledWith("operator", { bypassCache: true });
    expect(await salesCanViewAllCashiers(req({ grants: [] }))).toBe(false);
    effectivePermissions.mockResolvedValue([]);
    expect(await salesCanViewAllCashiers(req())).toBe(false);
    expect(await salesCanViewAllCashiers(req({ currentUser: { id: "admin", role: "admin" } }))).toBe(true);
    expect(await salesGrants(req({ grants: ["daily_closures:view"] }))).toMatchObject({
      closuresView: true, closuresApprove: false, journalsView: false, journalsApprove: false,
    });
  });
  it("counts only active recorded sources, matching own-cashier visibility and not inventing missing-day work", () => {
    const journal = operationsSalesSql("journals", ["a"], "2026-01-01", actor, { ...grants, allCashiers: false });
    expect(journal.where).toContain("r.cashier_id=$3");
    expect(journal.where).toContain("r.status IN ('draft','submitted','rejected')");
    expect(journal.values).toEqual([["a"], "2026-01-01", "operator"]);
    const closure = operationsSalesSql("closures", ["a"], "2026-01-01", actor, grants);
    expect(closure.where).toContain("r.status='open'");
    expect(closure.where).toContain("r.closure_date <= $2");
    expect(closure.from).not.toContain("generate_series");
    for (const sql of [journal, closure]) expect(sql.select).not.toMatch(/\*|notes|signature|phone|email|bank_account/);
  });
  it("projects exact canonical links and truthful date/creator/financial snapshot scalars", () => {
    const item = projectSalesRecord("closures", { ...row, status: "open" }, actor, grants);
    expect(item.href).toBe("/branch-daily-closures/7?branchId=a");
    expect(item.businessDate).toBe(row.business_date);
    expect(item.creator).toEqual({ id: "creator", name: "منشئ السجل" });
    expect(item.facts).toEqual({ totalSales: 123.5, cashDiscrepancy: -5, bankDiscrepancy: 0, journalsCount: 2 });
    expect(item.dueAt).toBeNull();
    expect(item.ownerId).toBeNull();
    expect(item.owner).toBe("");
    expect(projectSalesRecord("journals", row, actor, grants).href).toBe("/cashier-journals/7?branchId=a");
  });
  it("requires current approve+view and separation of duties for closure decisions, with source admin exception", () => {
    const own = { ...row, status: "open", created_by: actor.id };
    expect(projectSalesRecord("closures", own, actor, grants).decision).toBeUndefined();
    expect(projectSalesRecord("closures", own, { ...actor, role: "admin" }, grants).decision?.permission.action).toBe("approve");
    expect(projectSalesRecord("closures", { ...own, created_by: "other" }, actor, grants).decision?.awaitingActor).toBe(true);
    expect(projectSalesRecord("closures", { ...own, created_by: "other" }, actor, { ...grants, closuresApprove: false }).decision).toBeUndefined();
    expect(projectSalesRecord("closures", { ...own, created_by: "other" }, actor, { ...grants, closuresView: false }).decision).toBeUndefined();
  });
  it("only submitted journals advertise an approval; creation/assignment never grants it", () => {
    for (const status of ["draft", "rejected"]) expect(projectSalesRecord("journals", { ...row, status }, actor, grants).decision).toBeUndefined();
    expect(projectSalesRecord("journals", row, actor, grants).decision?.permission).toEqual({ module: "cashier_journal", action: "approve" });
    expect(projectSalesRecord("journals", row, actor, { ...grants, journalsApprove: false }).decision).toBeUndefined();
    expect(projectSalesRecord("journals", { ...row, status: "rejected" }, actor, grants).nextStep.label).not.toContain("إعادة تقديم");
  });
  it("does not invent missing money, identity, assignments, deadlines or sensitive blobs", () => {
    const injected = { ...row, total_sales: null, cash_discrepancy: "NaN", bank_discrepancy: undefined,
      created_by: null, creator_name: null, notes: "SECRET", signature_data: "SECRET", email: "SECRET" };
    const item = projectSalesRecord("journals", injected, actor, grants);
    expect(item.facts.totalSales).toBeNull();
    expect(item.facts.cashDiscrepancy).toBeNull();
    expect(item.facts.bankDiscrepancy).toBeNull();
    expect(item.creator).toEqual({ id: null, name: null });
    expect(JSON.stringify(item)).not.toContain("SECRET");
  });
  it("rejects stale/completed stages rather than promising obsolete decisions", () => {
    expect(() => projectSalesRecord("closures", { ...row, status: "closed" }, actor, grants)).toThrow();
    expect(() => projectSalesRecord("journals", { ...row, status: "approved" }, actor, grants)).toThrow();
  });
  it("registers only a scoped no-store read endpoint, leaving financial commands in their sources", () => {
    const file = readFileSync("server/operations-center.ts", "utf8");
    expect(file).toContain('app.get("/api/operations-center/sales", ...auth');
    expect(file).not.toMatch(/app\.(post|patch|put|delete)\("\/api\/operations-center\/sales/);
    expect(file).toContain('res.set("Cache-Control", "no-store")');
  });
});