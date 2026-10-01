import { readFileSync } from "node:fs";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { attachCenterContext, operationsCenterReturnHref, performanceDaysIntent, withMonthlyReturn } from "../client/src/lib/operations-center-navigation";
import { resolveSalesAnalyticsBranch, salesAnalyticsMonthPeriod, salesAnalyticsPeriodIntent, salesAnalyticsRequestParams, salesAnalyticsSelection } from "../client/src/lib/sales-analytics-navigation";

const defaultMonth = "2026-09";
const origin = "https://bakery.test";

describe("sales analytics exact receiving period", () => {
  it.each([
    ["2026-08-28", "2026-09-03"],
    ["2025-12-28", "2026-01-03"],
    ["2024-02-29", "2024-03-06"],
    ["2026-09-03", "2026-09-03"],
  ])("preserves inclusive %s through %s, even across months/years", (fromDate, toDate) => {
    const period = salesAnalyticsPeriodIntent(`?month=2026-09&fromDate=${fromDate}&toDate=${toDate}`, defaultMonth);
    expect(period).toEqual({ fromDate, toDate, month: toDate.slice(0, 7), exact: true, error: null });
    const params = salesAnalyticsRequestParams(period, "one");
    expect(Object.fromEntries(params)).toEqual({ fromDate, toDate, branchId: "one" });
  });

  it.each([
    "?fromDate=2026-09-01",
    "?toDate=2026-09-07",
    "?fromDate=&toDate=",
    "?fromDate=2026-02-29&toDate=2026-03-07",
    "?fromDate=2026-04-31&toDate=2026-05-07",
    "?fromDate=2026-13-01&toDate=2026-13-07",
    "?fromDate=2026-09-08&toDate=2026-09-07",
    "?fromDate=2026-9-01&toDate=2026-09-07",
    "?fromDate=2026-09-01T00:00:00Z&toDate=2026-09-07",
    "?fromDate=2026-09-01&fromDate=2026-09-02&toDate=2026-09-07",
    "?fromDate=2026-09-01&toDate=2026-09-07&toDate=2026-09-08",
  ])("rejects malformed range %s rather than using the whole month", search => {
    const period = salesAnalyticsPeriodIntent(search, defaultMonth);
    expect(period.error).toBeTruthy();
    expect(period.fromDate).toBe("");
    expect(period.toDate).toBe("");
    expect(() => salesAnalyticsRequestParams(period, "one")).toThrow("Invalid analytics period");
  });

  it("keeps standalone/monthly links monthly, with real leap/month endings", () => {
    expect(salesAnalyticsPeriodIntent("?month=2024-02", defaultMonth)).toMatchObject({ fromDate: "2024-02-01", toDate: "2024-02-29", exact: false });
    expect(salesAnalyticsPeriodIntent("?month=2026-02", defaultMonth).toDate).toBe("2026-02-28");
    expect(salesAnalyticsPeriodIntent("", defaultMonth).toDate).toBe("2026-09-30");
    expect(salesAnalyticsMonthPeriod("2026-12").toDate).toBe("2026-12-31");
  });

  it("intentional month selection replaces the range, while query-only navigation restores actual URL dates and branch", () => {
    const search = "?branchId=one&fromDate=2026-08-28&toDate=2026-09-03";
    const initial = salesAnalyticsSelection(search, null, defaultMonth);
    const edited = { ...initial, period: salesAnalyticsMonthPeriod("2026-10"), branchOverride: "two" };
    expect(salesAnalyticsSelection(search, edited, defaultMonth)).toBe(edited);
    expect(salesAnalyticsRequestParams(edited.period, edited.branchOverride).get("toDate")).toBe("2026-10-31");
    const next = salesAnalyticsSelection("?branchId=two&fromDate=2026-09-04&toDate=2026-09-10", edited, defaultMonth);
    expect(next.branchOverride).toBeNull();
    expect(next.period).toMatchObject({ fromDate: "2026-09-04", toDate: "2026-09-10", exact: true });
    const back = salesAnalyticsSelection(search, next, defaultMonth);
    expect(back).toEqual(initial);
  });

  it.each(["missing", "all", "", "one&branchId=two"])("does not substitute any branch/all for explicit denied scope %s", branch => {
    const scope = resolveSalesAnalyticsBranch(`?branchId=${branch}`, ["one", "two"], "one", true);
    expect(scope).toEqual({ branchId: "", denied: true });
    expect(() => salesAnalyticsRequestParams(salesAnalyticsMonthPeriod(defaultMonth), scope.branchId)).toThrow("authorized");
  });

  it("checks current allowed branches again after a revoke and permits only intentional authorized choices", () => {
    expect(resolveSalesAnalyticsBranch("?branchId=one", ["one", "two"], null, true)).toEqual({ branchId: "one", denied: false });
    expect(resolveSalesAnalyticsBranch("?branchId=one", ["two"], "two", true)).toEqual({ branchId: "", denied: true });
    expect(resolveSalesAnalyticsBranch("?branchId=denied", ["two"], "two", false, "two")).toEqual({ branchId: "two", denied: false });
    expect(resolveSalesAnalyticsBranch("", [], null, true)).toEqual({ branchId: "", denied: false });
    expect(resolveSalesAnalyticsBranch("", ["one", "two"], null, true)).toEqual({ branchId: "all", denied: false });
  });

  it("manual refetch and query navigation use actual date parameters and never previous-key placeholder data", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, placeholderData: previous => previous } } });
    const requests: string[] = [];
    const options = (search: string) => {
      const period = salesAnalyticsPeriodIntent(search, defaultMonth);
      const branch = resolveSalesAnalyticsBranch(search, ["one", "two"], null, true);
      return {
        queryKey: ["/api/analytics/shifts", branch.branchId, period.fromDate, period.toDate],
        placeholderData: undefined,
        enabled: !branch.denied && !period.error,
        staleTime: 0,
        queryFn: async () => {
          const request = salesAnalyticsRequestParams(period, branch.branchId, "approved", "shortage", "shift").toString();
          requests.push(request);
          return [request];
        },
      };
    };
    const observer = new QueryObserver(client, options("?branchId=one&fromDate=2026-08-28&toDate=2026-09-03"));
    const unsubscribe = observer.subscribe(() => {});
    try {
      await observer.refetch();
      await observer.refetch();
      expect(new URLSearchParams(requests.at(-1)).get("fromDate")).toBe("2026-08-28");
      observer.setOptions(options("?branchId=two&fromDate=2026-09-04&toDate=2026-09-10"));
      expect(observer.getCurrentResult().data).toBeUndefined();
      await observer.refetch();
      expect(Object.fromEntries(new URLSearchParams(requests.at(-1)))).toEqual({
        branchId: "two", fromDate: "2026-09-04", toDate: "2026-09-10", status: "approved", discrepancyType: "shortage", groupBy: "shift",
      });
      const beforeDenied = requests.length;
      observer.setOptions(options("?branchId=denied&fromDate=2026-09-04&toDate=2026-09-10"));
      await Promise.resolve();
      expect(requests.length).toBe(beforeDenied);
    } finally {
      unsubscribe();
      observer.destroy();
      client.clear();
    }
  });

  it("wires every analytics query to the validated range/scope with guarded manual and timed refresh", () => {
    const text = readFileSync("client/src/pages/sales-analytics.tsx", "utf8");
    const source = ts.createSourceFile("sales-analytics.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const queries: ts.CallExpression[] = [];
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "useQuery") queries.push(node);
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(queries).toHaveLength(5);
    for (const query of queries) {
      const config = query.arguments[0].getText(source);
      expect(config).toContain("selectedBranch");
      expect(config).toContain("fromDate, toDate");
      expect(config).toContain("enabled: analyticsEnabled");
      expect(config).toContain("placeholderData: undefined");
      expect(config).toContain("requestParams(");
      expect(config).toContain("{ signal }");
    }
    expect(text).toContain("const search = useSearch()");
    expect(text).toContain("if (!analyticsEnabled) return");
    expect(text).toContain("autoRefresh && analyticsEnabled");
    expect(text).toContain('data-testid="analytics-selected-period"');
    expect(text).toContain("selectMonth(`${selectedYear}-${month}`)");
    expect(text).toContain("operationsCenterReturnHref(search, allowedIds)");
    expect((source as ts.SourceFile & { parseDiagnostics: unknown[] }).parseDiagnostics).toHaveLength(0);
  });
});

describe("operations performance return context", () => {
  it.each([7, 30] as const)("roundtrips %i days, exact source dates and authorized branch scope", days => {
    const url = new URL("/sales-analytics?branchId=one&fromDate=2026-08-28&toDate=2026-09-03", origin);
    url.searchParams.set("centerWorkspace", "analysis");
    attachCenterContext(url, "one", ["one", "two"], days);
    expect(url.searchParams.get("from")).toBe("operations-center");
    expect(url.searchParams.get("fromDate")).toBe("2026-08-28");
    expect(url.searchParams.get("toDate")).toBe("2026-09-03");
    const back = new URL(operationsCenterReturnHref(url.search, ["one", "two"]), origin);
    expect(Object.fromEntries(back.searchParams)).toEqual({ branchIds: "one,two", performanceDays: String(days), workspace: "analysis" });
  });

  it("preserves monthly context alongside the period selection without widening revoked scope", () => {
    const url = new URL(withMonthlyReturn("/sales-analytics?branchId=one&fromDate=2026-09-01&toDate=2026-09-30", "one", defaultMonth, "sales", origin), origin);
    attachCenterContext(url, "one", ["one", "two"], 30);
    const back = new URL(operationsCenterReturnHref(url.search, ["one", "two"]), origin);
    expect(Object.fromEntries(back.searchParams)).toEqual({
      branchIds: "one,two", performanceDays: "30", workspace: "monthly", month: defaultMonth, monthBranchId: "one", monthFile: "sales",
    });
    expect(operationsCenterReturnHref(url.search, ["two"])).toBe("/operations-center?branchIds=two&performanceDays=30");
  });

  it.each(["", "0", "8", "31", "30.0", "030", "7&centerPerformanceDays=30"])("ignores invalid/ambiguous performance days %s", value => {
    expect(performanceDaysIntent(`?centerPerformanceDays=${value}`, "centerPerformanceDays")).toBeNull();
    expect(operationsCenterReturnHref(`?centerPerformanceDays=${value}&centerBranchIds=one`, ["one"])).toBe("/operations-center?branchIds=one");
  });

  it("validates standalone center period intent as a bounded 7/30 choice", () => {
    expect(performanceDaysIntent("?performanceDays=7")).toBe(7);
    expect(performanceDaysIntent("?performanceDays=30")).toBe(30);
    expect(performanceDaysIntent("?performanceDays=300")).toBeNull();
    expect(performanceDaysIntent("?performanceDays=7&performanceDays=30")).toBeNull();
  });
});