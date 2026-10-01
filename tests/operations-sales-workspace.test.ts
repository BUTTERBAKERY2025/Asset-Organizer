import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { OperationsSalesRecord, OperationsSalesResponse } from "../shared/operations-sales";
import { makeOperationsQueueItem } from "../shared/operations-center";
import { attachCenterContext, navigateCenterSourceWithHistory, operationsCenterReturnHref, salesReturnIntent,
  salesSourceReturnIntent, withSalesPageReturn } from "../client/src/lib/operations-center-navigation";
import { filterSalesRecords, salesHasDecision, salesNavigationMatches, salesRequestParams, salesScopeMatches,
  salesSourceHref, salesStageLabel } from "../client/src/components/operations-center/sales-workspace-model";
import { OperationsSalesWorkspace, SalesRecordDetail, salesQueryKey } from "../client/src/components/operations-center/sales-workspace";
import { dailyClosureHref } from "../client/src/lib/daily-closure-navigation";

const origin = "https://bakery.example";
const branches = [{ id: "a", name: "فرع الشرق" }, { id: "b", name: "فرع الغرب" }];
const closure: OperationsSalesRecord = {
  ...makeOperationsQueueItem("daily_closure", 120, "closure_review", "a", "daily_closures", "إغلاق يومي مفتوح", "open",
    "/branch-daily-closures/120?branchId=a"),
  domain: "closures", businessDate: "2026-09-27", creator: { id: "maker", name: "منشئ الإغلاق" },
  facts: { totalSales: 1200, cashDiscrepancy: -15, bankDiscrepancy: 0, journalsCount: 2 },
  nextStep: { label: "مراجعة الإغلاق في المصدر", href: "/branch-daily-closures/120?branchId=a" },
};
const journal: OperationsSalesRecord = { ...closure, id: "cashier_journal:41", canonicalId: "cashier_journal:41",
  sourceType: "cashier_journal", sourceId: "41", module: "cashier_journal", domain: "journals",
  status: "submitted", step: "journal_review", href: "/cashier-journals/41?branchId=a",
  nextStep: { label: "مراجعة اليومية المقدمة", href: "/cashier-journals/41?branchId=a" },
};
const decision = { actorId: "reviewer", awaitingActor: true as const, label: "مراجعة واعتماد الإغلاق", reason: "صلاحية المصدر وفصل الواجبات",
  href: closure.nextStep.href, capability: "approve" as const, permission: { module: "daily_closures", action: "approve" } };
const request = { branchIds: ["a", "b"], branchId: "", source: "all" as const, offset: 120, limit: 30 };
const response: OperationsSalesResponse = {
  generatedAt: "2026-10-01T09:00:00Z", businessDate: "2026-10-01",
  scope: { ...request, requested: ["a", "b"] }, branches, records: [closure, journal], summaries: [],
  coverage: { total: 242, nextOffset: 150, sources: {
    journals: { state: "complete", reason: null }, closures: { state: "complete", reason: null },
  } },
};

describe("sales source facts, independent page and safe selection", () => {
  it("requests pages beyond the old 100-record sample without mixing the center queue", () => {
    expect(salesRequestParams(request).toString()).toContain("offset=120");
    expect(salesScopeMatches(response, request)).toBe(true);
    expect(salesScopeMatches({ ...response, scope: { ...response.scope, offset: 0 } }, request)).toBe(false);
    expect(salesScopeMatches({ ...response, records: [{ ...closure, branchId: "outside" }] }, request)).toBe(false);
    expect(() => salesRequestParams({ ...request, branchIds: ["all"] })).toThrow();
  });
  it("filters date/creator within the page and drops hidden selection from the visible set", () => {
    expect(filterSalesRecords(response.records, "2026-09-27", "all", branches)).toHaveLength(2);
    expect(filterSalesRecords(response.records, "منشئ الإغلاق", "closure_review", branches)).toEqual([closure]);
    expect(filterSalesRecords(response.records, "no match", "all", branches)).toEqual([]);
    expect(salesStageLabel("open")).toBe("إغلاق مفتوح");
    expect(salesStageLabel("journal_rejected")).toContain("مسار التصحيح");
  });
  it("uses only explicit current actor decision and rejects stale case/permission changes", () => {
    expect(salesHasDecision(closure, "reviewer")).toBe(false);
    const item = { ...closure, decision };
    expect(salesHasDecision(item, "reviewer")).toBe(true);
    expect(salesHasDecision(item, "maker")).toBe(false);
    expect(salesNavigationMatches(item, item, "reviewer")).toBe(true);
    expect(salesNavigationMatches(closure, item, "reviewer")).toBe(false);
    expect(salesNavigationMatches({ ...item, status: "closed" }, item, "reviewer")).toBe(false);
    expect(salesNavigationMatches({ ...item, branchId: "b" }, item, "reviewer")).toBe(false);
  });
  it("requires exact same-origin record URL and one matching branch", () => {
    expect(salesSourceHref(closure, "reviewer", origin)).toBe(closure.nextStep.href);
    for (const href of ["/branch-daily-closures/121?branchId=a", "/branch-daily-closing?closureId=120&branchId=a",
      closure.nextStep.href + "&branchId=b", closure.nextStep.href + "&closureId=120", "https://other.example/branch-daily-closures/120?branchId=a"]) {
      expect(salesSourceHref({ ...closure, nextStep: { ...closure.nextStep, href } }, "reviewer", origin)).toBeNull();
    }
  });
  it("renders actual date, creator and discrepancies without invented owner/deadline", () => {
    const html = renderToStaticMarkup(React.createElement(SalesRecordDetail, { record: closure, actorId: "reviewer", refreshing: false, onOpen: vi.fn() }));
    for (const value of ["2026-09-27", "منشئ الإغلاق", "-15", "اليوميات المشمولة", "إغلاق مفتوح"]) expect(html).toContain(value);
    for (const value of ["الإسناد الفردي", "الجهة المسؤولة", "غير معروف", "open", "بانتظار قرارك وفق"]) expect(html).not.toContain(value);
    const approved = renderToStaticMarkup(React.createElement(SalesRecordDetail, { record: { ...closure, decision }, actorId: "reviewer", refreshing: true, onOpen: vi.fn() }));
    expect(approved).toContain("بانتظار قرارك وفق");
    expect(approved).toContain('disabled=""');
  });
});

describe("sales source Return and browser Back", () => {
  const source = () => {
    const url = new URL(withSalesPageReturn(closure.nextStep.href, closure, request, origin), origin);
    attachCenterContext(url, "a", ["a", "b"], 30);
    return url;
  };
  it("preserves all-branch/source scope, a later page and exact record without forcing record branch", () => {
    const url = source();
    const returnHref = operationsCenterReturnHref(url.search, ["a", "b"], url.pathname);
    const intent = salesReturnIntent(new URL(returnHref, origin).search, ["a", "b"]);
    expect(intent).toEqual({ source: "all", branchId: "", offset: 120, record: "daily_closure:120", valid: true });
    const navigate = vi.fn();
    navigateCenterSourceWithHistory(url, ["a", "b"], navigate);
    expect(navigate.mock.calls[0]).toEqual([returnHref, { replace: true }]);
    expect(navigate.mock.calls[1][0]).toBe(url.pathname + url.search);
    expect(salesSourceReturnIntent(url.search, ["b"], url.pathname)).toBeNull();
  });
  it("rejects malformed, duplicated or contradictory return intent rather than broadening", () => {
    const valid = new URL(operationsCenterReturnHref(source().search, ["a", "b"], source().pathname), origin);
    for (const [key, value] of [["salesOffset", "-1"], ["salesOffset", "31"], ["salesSource", "journals"],
      ["salesFilterBranchId", "b"], ["salesRecord", "daily_closure:0"]] as const) {
      const params = new URLSearchParams(valid.search); params.set(key, value);
      expect(salesReturnIntent(`?${params}`, ["a", "b"]).valid).toBe(false);
    }
    const duplicate = new URLSearchParams(valid.search); duplicate.append("salesOffset", "120");
    expect(salesReturnIntent(`?${duplicate}`, ["a", "b"]).valid).toBe(false);
    const url = source(); url.pathname = "/branch-daily-closures/999";
    expect(salesSourceReturnIntent(url.search, ["a", "b"], url.pathname)).toBeNull();
    expect(salesReturnIntent(valid.search, ["b"]).valid).toBe(false);
  });
  it("keeps return selection on the fixed source list after approval but rejects a different detail ID", () => {
    const url = source(); url.pathname = "/branch-daily-closures";
    const intent = salesReturnIntent(new URL(operationsCenterReturnHref(url.search, ["a", "b"], url.pathname), origin).search, ["a", "b"]);
    expect(intent.record).toBe("daily_closure:120");
    expect(intent.offset).toBe(120);
    url.searchParams.set("closureId", "121");
    expect(salesSourceReturnIntent(url.search, ["a", "b"], url.pathname)).toBeNull();
  });
  it("restores the original closure through the legitimate correction/create hop only", () => {
    const detail = source();
    const correction = new URL(`${dailyClosureHref("create", detail.search, "a", "2026-09-27", "2026-09")}&correction=1`, origin);
    expect(correction.searchParams.get("centerSalesFilterBranchId")).toBe("");
    expect(salesSourceReturnIntent(correction.search, ["a", "b"], correction.pathname)?.selection.record).toBe("daily_closure:120");
    const returned = new URL(operationsCenterReturnHref(correction.search, ["a", "b"], correction.pathname), origin);
    expect(salesReturnIntent(returned.search, ["a", "b"])).toEqual({ source: "all", branchId: "", offset: 120, record: "daily_closure:120", valid: true });
    correction.searchParams.delete("correction");
    expect(salesSourceReturnIntent(correction.search, ["a", "b"], correction.pathname)).toBeNull();
    correction.searchParams.set("correction", "1"); correction.searchParams.set("branchId", "b");
    expect(salesSourceReturnIntent(correction.search, ["a", "b"], correction.pathname)).toBeNull();
  });
  it("renders dedicated cache only and never shows stale details after a page mismatch", () => {
    const client = new QueryClient();
    const firstRequest = { ...request, offset: 0 };
    client.setQueryData(salesQueryKey(firstRequest, "reviewer"), { ...response, scope: { ...response.scope, offset: 120 } });
    const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(OperationsSalesWorkspace, { branches, actorId: "reviewer", open: vi.fn() })));
    expect(html).not.toContain("منشئ الإغلاق");
    const page = readFileSync("client/src/pages/operations-center.tsx", "utf8");
    expect(page).toContain('fetch("/api/branches", { credentials: "include", cache: "no-store" })');
    expect(page).toContain("salesNavigationMatches(current, clicked");
    expect(readFileSync("client/src/components/operations-center/decision-board.tsx", "utf8")).toContain("<OperationsSalesWorkspace");
  });
});