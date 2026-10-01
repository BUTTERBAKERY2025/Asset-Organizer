import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { makeOperationsQueueItem, type OperationsSupplyRecord, type OperationsSupplyResponse } from "../shared/operations-center";
import {
  filterSupplyRecords, supplyCoverageText, supplyPageFacts, supplyPriorityLabel, supplyRecordKey,
  supplyRequestParams, supplyScopeMatches, supplySelectionIntent, supplySourceHref, supplyStageLabel,
} from "../client/src/components/operations-center/supply-workspace-model";
import {
  OperationsSupplyWorkspace, SupplyCounters, SupplyRecordDetail, SupplySummaries,
} from "../client/src/components/operations-center/supply-workspace";

const branches = [{ id: "a", name: "فرع الشرق" }, { id: "b", name: "المطبخ المركزي" }];
const asOf = "2026-10-01T10:00:00Z";
const kitchen: OperationsSupplyRecord = {
  ...makeOperationsQueueItem("kitchen_order", 7, "approved", "a", "central_kitchen_orders", "طلب خبز", "approved",
    "/central-kitchen-orders?branchId=a", "المطبخ المورد", "2026-10-01T09:00:00Z"),
  domain: "kitchen", branchIds: ["a", "b"], stage: "approved", responsibleRole: "المطبخ المورد",
  nextStep: { label: "تجهيز الطلب", href: "/central-kitchen-orders?branchId=a&orderId=7" },
  inventoryMode: "shadow", deadlineLabel: "موعد الاحتياج", priority: null,
};
const transfer: OperationsSupplyRecord = {
  ...makeOperationsQueueItem("transfer", 7, "in_transit", "a", "transfer_requests", "تحويل دقيق", "in_transit",
    "/transfer-requests?branchId=a", "الفرع المستلم", null, "me"),
  domain: "transfers", branchIds: ["a"], stage: "in_transit", responsibleRole: "الفرع المستلم",
  nextStep: { label: "تأكيد الاستلام", href: "/transfer-requests?branchId=a&transferId=7" },
  inventoryMode: "real", deadlineLabel: null, priority: "urgent", priorityReason: "urgent",
  decision: { awaitingActor: true, actorId: "me", reason: "صلاحية الاستلام في المصدر", label: "تأكيد الاستلام",
    href: "/transfer-requests?branchId=a&transferId=7", capability: "approve",
    permission: { module: "transfer_requests", action: "edit" } },
};
const reverse: OperationsSupplyRecord = {
  ...makeOperationsQueueItem("reverse_movement", 21, "received", "b", "warehouse", "مرتجع مستلم", "received",
    "/reverse-logistics?branchId=b"),
  domain: "reverse", branchIds: ["b"], stage: "received", responsibleRole: null,
  nextStep: { label: "فحص المرتجع قبل إتاحة الصالح", href: "/reverse-logistics?branchId=b&movementId=21" },
  inventoryMode: "unknown", deadlineLabel: null, priority: null,
};
const delivery: OperationsSupplyRecord = {
  ...makeOperationsQueueItem("delivery_assignment", 35, "assigned", "a", "delivery_tasks", "توصيل طلب", "assigned",
    "/delivery-management?branchId=a", "السائق", asOf, "driver"),
  domain: "delivery", branchIds: ["a"], stage: "assigned", responsibleRole: "السائق",
  nextStep: { label: "توثيق التسليم في مسار التوصيل", href: "/delivery-management?branchId=a&deliveryId=35" },
  inventoryMode: "unknown", deadlineLabel: "موعد التوصيل", priority: null,
};
const records = [kitchen, transfer, reverse, delivery];
const request = { branchIds: ["a", "b"], source: "all" as const, offset: 0, limit: 30 };
const response: OperationsSupplyResponse = {
  generatedAt: asOf, businessDate: "2026-10-01", scope: { ...request, requested: ["a", "b"] }, branches,
  records,
  summaries: [
    { source: "kitchen", label: "طلبات المطبخ", value: 4, coverage: "complete", definition: "طلبات نشطة في المصدر" },
    { source: "transfers", label: "التحويلات", value: 0, coverage: "complete", definition: "تحويلات نشطة" },
    { source: "reverse", label: "المرتجعات", value: null, coverage: "unavailable", definition: "مرتجعات تحتاج متابعة" },
  ],
  coverage: { total: null, nextOffset: 30, sources: {
    kitchen: { state: "complete", reason: null }, transfers: { state: "complete", reason: null },
    reverse: { state: "unavailable", reason: "تعذر تحميل المرتجعات" }, delivery: { state: "complete", reason: null },
  } },
};

describe("production domain request and scoped snapshots", () => {
  it("uses its own explicit domain query and never all/omitted branch scope", () => {
    expect(supplyRequestParams(request).toString()).toBe("branchIds=a%2Cb&source=all&offset=0&limit=30");
    expect(supplyRequestParams({ ...request, branchIds: ["b", "a", "a"], source: "reverse", offset: 120 }).get("branchIds")).toBe("a,b");
    for (const invalid of [
      { ...request, branchIds: [] }, { ...request, branchIds: ["all"] },
      { ...request, offset: -1 }, { ...request, offset: 0.5 }, { ...request, limit: 101 },
      { ...request, branchIds: ["a,b"] },
    ]) expect(() => supplyRequestParams(invalid)).toThrow();
  });
  it("rejects another source, offset, actor-side branch or a stale wider branch snapshot", () => {
    expect(supplyScopeMatches(response, request)).toBe(true);
    expect(supplyScopeMatches(response, { ...request, source: "reverse" })).toBe(false);
    expect(supplyScopeMatches(response, { ...request, offset: 30 })).toBe(false);
    expect(supplyScopeMatches(response, { ...request, branchIds: ["a"] })).toBe(false);
    expect(supplyScopeMatches({ ...response, records: [{ ...kitchen, branchId: "forbidden" }] }, request)).toBe(false);
    expect(supplyScopeMatches({ ...response, records: [{ ...kitchen, branchIds: ["a", "forbidden"] }] }, request)).toBe(false);
  });
});

describe("page filters and factual qualified counters", () => {
  it("filters loaded cases by translated stage, exact source number, branch and responsible role", () => {
    expect(filterSupplyRecords(records, { stage: "approved", search: "خبز" }, branches)).toEqual([kitchen]);
    expect(filterSupplyRecords(records, { stage: "all", search: "المطبخ المورد" }, branches)).toEqual([kitchen]);
    expect(filterSupplyRecords(records, { stage: "all", search: "فرع الشرق" }, branches)).toEqual([kitchen, transfer, delivery]);
    expect(filterSupplyRecords(records, { stage: "all", search: "21" }, branches)).toEqual([reverse]);
    expect(filterSupplyRecords(records, { stage: "received", search: "معتمد" }, branches)).toEqual([]);
    expect(filterSupplyRecords(records, { stage: "all", search: "  " }, branches)).toEqual(records);
    expect(records).toHaveLength(4);
  });
  it("deduplicates canonical source identity across endpoints/stages without merging different source types", () => {
    const nextStage = { ...kitchen, id: "kitchen_order:7:prepared:b", step: "prepared", branchId: "b" };
    expect(supplyRecordKey(nextStage)).toBe(supplyRecordKey(kitchen));
    expect(supplyRecordKey(transfer)).not.toBe(supplyRecordKey(kitchen));
    expect(supplyPageFacts([...records, nextStage], "me", asOf)).toEqual({
      count: 4, awaitingActor: 1, urgent: 1, overdue: 1,
    });
  });
  it("does not infer personal decision, emergency or deadlines from a stage or assigned user", () => {
    const assignedOnly = { ...transfer, decision: undefined, priority: null, priorityReason: undefined };
    const malformed = { ...reverse, dueAt: "not-a-date" };
    expect(supplyPageFacts([assignedOnly, malformed, delivery], "me", asOf)).toEqual({
      count: 3, awaitingActor: 0, urgent: 0, overdue: 0,
    });
    expect(supplyPageFacts(records, "another-user", asOf).awaitingActor).toBe(0);
    expect(supplyPageFacts(records, undefined, asOf).awaitingActor).toBe(0);
    expect(supplyPageFacts(records, "me", "invalid").overdue).toBe(0);
    expect(supplyPageFacts([{ ...delivery, status: "receipt_approved", dueAt: "2026-01-01T00:00:00Z" }], "me", asOf).overdue).toBe(0);
    expect(supplyPriorityLabel(kitchen)).toContain("غير مسجلة");
    expect(supplyPriorityLabel(transfer)).toBe("عاجلة");
  });
  it("does not present failed coverage or unknown urgency as confirmed zero", () => {
    const missing = renderToStaticMarkup(React.createElement(SupplyCounters, { records: [], actorId: "me", data: response, filtered: false }));
    expect(missing).toContain("غير متاح");
    expect(missing).not.toContain("<dd>0</dd>");
    const unknown = renderToStaticMarkup(React.createElement(SupplyCounters, {
      records: [{ ...kitchen, priorityCoverage: "unavailable" }], actorId: "me", data: response, filtered: false,
    }));
    expect(unknown).toContain("لا يُستنتج منها عدم وجود حالات عاجلة");
    expect(supplyPriorityLabel({ ...kitchen, priorityCoverage: "unavailable" })).toContain("غير متاحة");
  });
  it("labels partial results, null totals and loaded/filtered page counts instead of mixing source summary metrics", () => {
    expect(supplyCoverageText(response)).toContain("تغطية غير مكتملة");
    const html = renderToStaticMarkup(React.createElement(SupplyCounters, { records: [kitchen], actorId: "me", data: response, filtered: true }));
    expect(html).toContain("للنتائج المرشحة");
    expect(html).toContain("قد تتداخل ولا تُجمع");
    expect(html).toContain("تجاوزت موعدها المسجل");
    expect(html).not.toContain(">4<");
    const kitchenOnly: OperationsSupplyResponse = {
      ...response, scope: { ...response.scope, source: "kitchen" }, records: [kitchen],
      coverage: { ...response.coverage, total: 4 },
    };
    expect(supplyCoverageText(kitchenOnly)).toContain("سجلات قابلة للعرض");
    expect(supplyCoverageText(kitchenOnly)).not.toContain("تغطية غير مكتملة");
  });
  it("translates known workflow stages and does not expose unrecognized English codes as Arabic UI", () => {
    expect(supplyStageLabel("prepared")).toBe("جاهز للإرسال");
    expect(supplyStageLabel("received")).toBe("مستلم");
    expect(supplyStageLabel("inspected")).toBe("تم الفحص");
    expect(supplyStageLabel("awaiting_receipt")).toBe("بانتظار تأكيد الاستلام");
    expect(supplyStageLabel("new_internal_stage")).not.toContain("new_internal_stage");
  });
});

describe("canonical source action and source authority", () => {
  const origin = "https://bakery.example";
  it("keeps each persisted source parameter and production return context before existing go validation", () => {
    for (const record of records) {
      const link = supplySourceHref(record, "me", origin);
      expect(link.href).not.toBeNull();
      const url = new URL(link.href!, origin);
      expect(url.searchParams.get("centerWorkspace")).toBe("production");
      expect(url.searchParams.get("branchId")).toBe(record.branchId);
      expect(url.searchParams.get("centerSupplyRecord")).toBe(supplyRecordKey(record));
      expect(url.searchParams.get("centerSupplyBranchId")).toBe(record.branchId);
    }
    expect(supplySourceHref(delivery, "me", origin).href).toContain("/delivery-management?");
    expect(supplySourceHref(transfer, "me", origin)).toMatchObject({ decision: true, label: "تأكيد الاستلام في المصدر" });
    expect(supplySourceHref(transfer, "other", origin)).toMatchObject({ decision: false, label: "فتح السجل للمتابعة في المصدر" });
  });
  it("fails closed for conflicting record/branch, duplicate identity parameters, external and standalone driver destinations", () => {
    for (const href of [
      "https://attacker.invalid/central-kitchen-orders?orderId=7",
      "/central-kitchen-orders?orderId=8", "/central-kitchen-orders?orderId=7&orderId=8",
      "/central-kitchen-orders?orderId=7&branchId=b", "/transfer-requests?orderId=7",
    ]) expect(supplySourceHref({ ...kitchen, href }, "me", origin).href).toBeNull();
    expect(supplySourceHref({ ...delivery, href: "/driver-deliveries?deliveryId=35" }, "me", origin).href).toBeNull();
    expect(supplySourceHref({ ...kitchen, sourceId: "0" }, "me", origin).href).toBeNull();
    expect(supplySourceHref({ ...transfer, decision: { ...transfer.decision!, href: "/transfer-requests?transferId=8" } }, "me", origin).href).toBeNull();
  });
  it("supports authorized delivery CTAs inside their related canonical source without losing the assignment identity", () => {
    const related: OperationsSupplyRecord = {
      ...delivery, relatedSource: { sourceType: "kitchen", sourceId: "7" },
      href: "/central-kitchen-orders?branchId=a&orderId=7&deliveryId=35",
    };
    expect(supplySourceHref(related, "me", origin).href).toContain("orderId=7&deliveryId=35");
    expect(supplySourceHref({ ...related, href: "/central-kitchen-orders?orderId=7&deliveryId=36" }, "me", origin).href).toBeNull();
    expect(supplySourceHref({ ...related, href: "/central-kitchen-orders?orderId=8&deliveryId=35" }, "me", origin).href).toBeNull();
    expect(supplySourceHref({ ...related, href: "/central-kitchen-orders?orderId=7" }, "me", origin).href).toBeNull();
    expect(supplySourceHref({ ...related, href: "/driver-deliveries?orderId=7&deliveryId=35" }, "me", origin).href).toBeNull();
  });
  it("accepts only authorized canonical production return intent and never uses a workflow stage as identity", () => {
    expect(supplySelectionIntent("?workspace=production&supplyRecord=kitchen_order:7&supplyBranchId=a", ["a", "b"]))
      .toEqual({ source: "kitchen", branchId: "a", record: "kitchen_order:7", offset: 0, valid: true });
    expect(supplySelectionIntent("?workspace=production&supplyRecord=delivery_assignment:35&supplyBranchId=a", ["a"]))
      .toEqual({ source: "delivery", branchId: "a", record: "delivery_assignment:35", offset: 0, valid: true });
    for (const search of [
      "?workspace=production&supplyRecord=kitchen_order:7:approved&supplyBranchId=a",
      "?workspace=production&supplyRecord=kitchen_order:0&supplyBranchId=a",
      "?workspace=production&supplyRecord=kitchen_order:7&supplyBranchId=forbidden",
      "?workspace=analysis&supplyRecord=kitchen_order:7&supplyBranchId=a",
      "?workspace=production&supplyRecord=maintenance:7&supplyBranchId=a",
      "?workspace=production&supplyRecord=kitchen_order:7&supplyRecord=transfer:8&supplyBranchId=a",
    ]) expect(supplySelectionIntent(search, ["a"]).record).toBeNull();
    expect(supplySourceHref({ ...transfer, capabilityCoverage: "unavailable" }, "me", origin).decision).toBe(false);
  });
  it("renders actual source identity, unknown deadline/priority and inventory caveats without an inline write action", () => {
    const html = renderToStaticMarkup(React.createElement(SupplyRecordDetail, {
      record: reverse, branches, actorId: "me", open: vi.fn(), refreshing: false,
    }));
    expect(html).toContain("#21");
    expect(html).toContain("فحص المرتجع قبل إتاحة الصالح");
    expect(html).toContain("غير مسجل؛ لا نفترض موعدًا");
    expect(html).toContain("غير مسجلة في المصدر");
    expect(html).toContain("غير معروف من المصدر");
    expect(html).toContain("فتح السجل للمتابعة في المصدر");
    expect(html).toContain("المسار المختص وحده");
    expect(html).not.toContain("اعتماد وإكمال");
    const shadow = renderToStaticMarkup(React.createElement(SupplyRecordDetail, {
      record: kitchen, branches, actorId: "me", open: vi.fn(), refreshing: true,
    }));
    expect(shadow).toContain("ليس إثبات رصيد فعلي");
    expect(shadow).toContain('disabled=""');
  });
});

describe("production workspace presentation and responsive bounds", () => {
  it("loads the original later page and filter population after source Return instead of narrowing to the clicked branch", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const pageData = { ...response, scope: { ...response.scope, offset: 120 } };
    client.setQueryData(["/api/operations-center/supply", "me", "a,b", "all", 120, 30], pageData);
    vi.stubGlobal("window", { location: {
      search: "?branchIds=a,b&workspace=production&supplyRecord=transfer:7&supplyBranchId=a&supplySource=all&supplyFilterBranchId=&supplyOffset=120",
      origin: "https://bakery.example",
    } });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
        React.createElement(OperationsSupplyWorkspace, { branches, actorId: "me", open: vi.fn() })));
      expect(html).toContain("صفحة 5");
      expect(html).toContain("تحويل دقيق");
      expect(html).toContain('value="all" selected=""');
      expect(html).toContain('data-detail="true"');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore(); vi.unstubAllGlobals(); client.clear();
    }
  });
  it("blocks malformed or revoked page-return intent without exposing a cached all-branch list", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["/api/operations-center/supply", "me", "a,b", "all", 0, 30], response);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      for (const search of [
        "?workspace=production&supplyRecord=transfer:7&supplyBranchId=a&supplySource=all&supplyFilterBranchId=&supplyOffset=-30",
        "?workspace=production&supplyRecord=transfer:7&supplyBranchId=revoked&supplySource=all&supplyFilterBranchId=&supplyOffset=120",
        "?workspace=production&supplyRecord=transfer:7&supplyBranchId=a&supplySource=all&supplyFilterBranchId=&supplyOffset=120&supplyOffset=120",
      ]) {
        vi.stubGlobal("window", { location: { search, origin: "https://bakery.example" } });
        const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
          React.createElement(OperationsSupplyWorkspace, { branches, actorId: "me", open: vi.fn() })));
        expect(html).toContain("لم يُوسّع النطاق");
        expect(html).not.toContain("تحويل دقيق");
        expect(html).not.toContain("طلب خبز");
        expect(fetchSpy).not.toHaveBeenCalled();
      }
    } finally {
      fetchSpy.mockRestore(); vi.unstubAllGlobals(); client.clear();
    }
  });
  it("collapses source summaries outside cases and distinguishes accessible zero from unavailable null", () => {
    const html = renderToStaticMarkup(React.createElement(SupplySummaries, { data: response }));
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("منفصلة عن حالات المتابعة");
    expect(html).toContain(">0</b>");
    expect(html).toContain("غير متاح");
    expect(html).toContain("ليس صفرًا");
    expect(html).not.toContain(">4 حالات<");
  });
  it("renders the dedicated server page and all source filters including zero sources without a network or source write", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["/api/operations-center/supply", "me", "a,b", "all", 0, 30], response);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(OperationsSupplyWorkspace, { branches, actorId: "me", open: vi.fn(), canOpenPurchasing: true })));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(html).toContain('data-testid="operations-supply-workspace"');
    expect(html).toContain('value="transfers"');
    expect(html).toContain('value="reverse"');
    expect(html).toContain('value="delivery"');
    expect(html).toContain("المرحلة · في الصفحة");
    expect(html).toContain("بحث · في الصفحة");
    expect(html).toContain("قبل ترقيم الصفحات");
    expect(html).toContain("التالي:");
    expect(html).toContain("#7");
    expect(html).toContain("العودة للحالات والمرشحات");
    expect(html).toContain('aria-label="صفحات حالات التوريد والنقل"');
    expect(html).toContain("اختصار ثانوي · المشتريات");
    expect(html).toContain("ليس حالة متابعة");
    expect(html).not.toContain("مشتريات #");
    client.clear();
  });
  it("hides cached source data after an authorization/refetch error rather than silently displaying a successful old snapshot", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const key = ["/api/operations-center/supply", "me", "a,b", "all", 0, 30];
    client.setQueryData(key, response);
    client.getQueryCache().find({ queryKey: key, exact: true })!.setState({
      status: "error", error: new Error("تغيرت صلاحية المصدر"), fetchStatus: "idle",
    });
    const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(OperationsSupplyWorkspace, { branches, actorId: "me", open: vi.fn() })));
    expect(html).toContain("تغيرت صلاحية المصدر");
    expect(html).toContain("أخفيت التفاصيل والإجراء السابق");
    expect(html).toContain("إعادة المحاولة");
    expect(html).not.toContain("طلب خبز");
    expect(html).not.toContain("تحويل دقيق");
    expect(html).not.toContain("ملخصات المصادر ·");
    client.clear();
  });
  it("keeps this domain isolated from global queue pagination and source mutations", () => {
    const source = readFileSync("client/src/components/operations-center/supply-workspace.tsx", "utf8");
    const board = readFileSync("client/src/components/operations-center/decision-board.tsx", "utf8");
    expect(board).toContain('view === "production" ? <OperationsSupplyWorkspace');
    expect(source).not.toContain("data.queue");
    expect(source).not.toContain("onOffset");
    expect(source).not.toContain("useMutation");
    expect(source).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)/);
    expect(source).toContain('queryKey: ["/api/operations-center/supply", actorId');
    expect(source).toContain("السجل المحدد لم يعد ضمن نتائج هذه الصفحة");
    expect(source).toContain("هذا ليس تأكيدًا لإكماله");
    expect(source).toContain("query.isError");
    expect(source).toContain("refetchInterval: false");
  });
  it("bounds desktop list/detail columns and all mobile content to min-width zero with a real list back path", () => {
    const css = readFileSync("client/src/components/operations-center/decision-board.css", "utf8");
    expect(css).toContain(".oc-supply-workspace {min-width:0;max-width:100%;grid-template-columns:minmax(0,43%) minmax(0,1fr)}");
    expect(css).toContain(".oc-supply-record {min-width:0;max-width:100%;overflow-wrap:anywhere;box-sizing:border-box}");
    expect(css).toContain(".oc-supply-workspace .oc-workspace-detail {overflow-x:hidden}");
    expect(css).toContain("@media(max-width:767px){.oc-supply-workspace");
    expect(css).toContain(".oc-supply-filters{grid-template-columns:minmax(0,1fr)}");
    expect(css).toContain('[data-detail="true"] .oc-workspace-list');
    expect(css).toContain('[data-detail="false"] .oc-workspace-detail');
    expect(css).toContain("white-space:normal;text-align:right");
  });
});