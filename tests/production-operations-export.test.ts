import { describe, expect, it } from "vitest";
import type { ProductionOperationsReport } from "@shared/production-operations-report";
import {
  buildProductionReportCsv,
  buildProductionReportPrintHtml,
  buildProductionReportTables,
  buildProductionReportWorkbook,
  compactPreparationEvidenceReferences,
  getPreparationSourceReadout,
  parsePreparationEvidenceReferences,
  productionReportCsvCell,
  productionReportQuantity6,
  type ProductionOperationsExportRows,
} from "../client/src/lib/production-operations-export";

const report = {
  summary: {
    production: {
      finishedBatchCount: 4,
      inProgressBatchCount: 2,
      finishedQuantityByUnit: [{ unit: "kg", quantity: 9.123456 }],
      inProgressQuantityByUnit: [{ unit: "kg", quantity: 1.234567 }],
    },
    advancedPlans: {
      orderCount: 8,
      itemCount: 9,
      plannedQuantityByCatalogUnit: [{ unit: "kg", quantity: 20.123456 }],
      comparisonStatus: "unavailable_without_explicit_batch_link",
    },
    centralKitchen: {
      orderCount: 10,
      activeOrderCount: 7,
      inactiveOrderCount: 3,
      byInventoryMode: [
        {
          inventoryMode: "real",
          orderCount: 6,
          activeOrderCount: 5,
          inactiveOrderCount: 1,
          requestedQuantityByUnit: [{ unit: "kg", quantity: 4.123456 }],
          preparedQuantityByUnit: [{ unit: "kg", quantity: 3.123456 }],
          dispatchedQuantityByUnit: [{ unit: "kg", quantity: 2.123456 }],
          goodReceivedQuantityByUnit: [{ unit: "kg", quantity: 1.123456 }],
          damagedQuantityByUnit: [{ unit: "kg", quantity: 0.123456 }],
          missingQuantityByUnit: [{ unit: "kg", quantity: 0.223456 }],
        },
        {
          inventoryMode: "shadow",
          orderCount: 3,
          activeOrderCount: 2,
          inactiveOrderCount: 1,
          requestedQuantityByUnit: [],
          preparedQuantityByUnit: [],
          dispatchedQuantityByUnit: [],
          goodReceivedQuantityByUnit: [],
          damagedQuantityByUnit: [],
          missingQuantityByUnit: [],
        },
        {
          inventoryMode: "unknown",
          orderCount: 1,
          activeOrderCount: 0,
          inactiveOrderCount: 1,
          requestedQuantityByUnit: [],
          preparedQuantityByUnit: [],
          dispatchedQuantityByUnit: [],
          goodReceivedQuantityByUnit: [],
          damagedQuantityByUnit: [],
          missingQuantityByUnit: [],
        },
      ],
      orderCountsByInventoryModeAndStatus: [{ inventoryMode: "real", status: "approved", orderCount: 6 }],
      combinedQuantitiesDeprecated: true,
      requestedQuantityByUnit: [],
      preparedQuantityByUnit: [],
      dispatchedQuantityByUnit: [],
      goodReceivedQuantityByUnit: [],
      damagedQuantityByUnit: [],
      missingQuantityByUnit: [],
    },
    materials: {
      movementCount: 3,
      consumedQuantityByUnit: [{ unit: "kg", quantity: 6.123456 }],
    },
    approvedWaste: {
      reportCount: 1,
      quantityByCatalogUnit: [{ unit: "kg", quantity: 0.123456 }],
    },
  },
  productionRows: [
    {
      productId: 4,
      productName: "\t=1+1",
      unit: "kg",
      branchIds: ["branch-1"],
      finishedBatchCount: 1,
      finishedQuantity: 0.123456,
      inProgressBatchCount: 1,
      inProgressQuantity: 0,
      batchIds: [101],
      recipeSourceRecipeIds: [77],
    },
  ],
  plannedRows: [
    {
      productId: 4,
      productName: "خطة",
      catalogUnit: "kg",
      sourceBranchIds: ["branch-1"],
      targetBranchIds: ["branch-2"],
      plannedQuantity: 9.123456,
      advancedOrderIds: [501],
      advancedOrderItemIds: [502],
      comparisonStatus: "unavailable_without_explicit_batch_link",
    },
  ],
  requestRows: [
    {
      kitchenId: "kitchen-1",
      requestBranchIds: ["branch-2"],
      inventoryMode: "shadow",
      status: "approved",
      itemKind: "product",
      itemId: 4,
      itemName: "صنف",
      unit: "kg",
      requestedQuantity: 1.123456,
      preparedQuantity: 0.923456,
      dispatchedQuantity: 0.823456,
      goodReceivedQuantity: 0.723456,
      damagedQuantity: 0.023456,
      missingQuantity: 0.123456,
      linkedFinishedQuantity: 0.523456,
      linkedInProgressQuantity: 0.423456,
      linkedBatchIds: [101],
      linkedProductionComparisonStatus: "available_explicit_batch_order_item_fk",
      orderIds: [901],
      orderItemIds: [902],
    },
  ],
  materialRows: [
    {
      warehouseItemId: 8,
      materialName: "دقيق",
      unit: "kg",
      consumedQuantity: 2.123456,
      movementIds: [801],
      batchIds: [101],
    },
  ],
  wasteRows: [
    {
      productId: 4,
      productName: "هالك",
      catalogUnit: "kg",
      approvedQuantity: 0.123456,
      wasteReportIds: [701],
      wasteItemIds: [702],
    },
  ],
  coverage: {
    finishedBatchCount: 4,
    recipeBacked: 3,
    nonRecipe: 1,
    recipeStatusUnknown: 0,
    linked: 2,
    unlinked: 1,
    materialPostingMissing: 0,
    materialPostingUnknown: 0,
    outputPostingProven: 4,
    outputPostingMissing: 0,
    outputPostingUnknown: 0,
    recipeSnapshotMissing: null,
  },
  metadata: {
    generatedAt: "2025-01-02T03:04:05.000Z",
    readConsistency: "repeatable_read_read_only_transaction",
    branchScope: {
      requestedBranchId: "branch-1",
      effectiveBranchIds: ["branch-1"],
      allConvention: "branchId=all",
    },
    dateWindow: {
      startDate: "2025-01-01",
      endDate: "2025-01-02",
      daysInclusive: 2,
      timezone: "Asia/Riyadh",
      bases: [{ source: "batches", dateBasis: "production_date", label: "الإنتاج" }],
    },
    sources: [{ source: "daily_production_batches", status: "available", label: "دفعات الإنتاج" }],
    linkage: {
      centralKitchenOrderItemToBatch: {
        status: "available_explicit_batch_order_item_fk",
        dateBasis: "request needed_date cohort; linked batches are not filtered by production_date",
      },
      advancedPlanToBatch: { status: "unavailable_without_explicit_batch_link" },
    },
    costing: { status: "not_available", message: "غير متاحة" },
    rowLimit: { applied: false, totalRows: 7 },
    warnings: ["تنبيه اختباري"],
  },
} as ProductionOperationsReport;

const filteredRows: ProductionOperationsExportRows = {
  production: report.productionRows,
  planned: report.plannedRows,
  requests: report.requestRows,
  materials: report.materialRows,
  waste: report.wasteRows,
};

const filters = {
  startDate: "2025-01-01",
  endDate: "2025-01-02",
  branchLabel: "فرع <اختبار>",
  search: "صنف",
};

describe("production operations exports", () => {
  it("covers every contract field and keeps explicit linkage fields", () => {
    const tables = buildProductionReportTables(report, filteredRows, filters);
    expect(Object.keys(tables.sections)).toEqual(["production", "planned", "requests", "materials", "waste"]);
    expect(tables.sections.production.headers).toEqual([
      "productId", "productName", "unit", "branchIds", "finishedBatchCount",
      "finishedQuantity", "inProgressBatchCount", "inProgressQuantity", "batchIds", "recipeSourceRecipeIds",
    ]);
    expect(tables.sections.planned.headers).toEqual([
      "productId", "productName", "catalogUnit", "sourceBranchIds", "targetBranchIds",
      "plannedQuantity", "advancedOrderIds", "advancedOrderItemIds", "comparisonStatus",
    ]);
    expect(tables.sections.requests.headers).toContain("inventoryMode");
    expect(tables.sections.requests.headers).toContain("status");
    expect(tables.sections.requests.headers).toContain("linkedBatchIds");
    expect(tables.sections.requests.headers).toContain("orderIds");
    expect(tables.sections.requests.headers).toContain("orderItemIds");
    expect(tables.sections.requests.headers).toContain("nextStep");
    expect(tables.sections.requests.headers).toContain("nextStepOwner");
    expect(tables.sections.requests.headers).toContain("preparedFromStock");
    expect(tables.sections.requests.headers).toContain("preparedFromProduction");
    expect(tables.sections.requests.headers).toContain("productionFulfillmentEvidence");
    expect(tables.sections.requests.rows[0].sourceRelativeUrl).toBe("/central-kitchen-orders?orderId=901");
    expect(tables.sections.requests.rows[0].linkedBatchIds).toEqual([101]);
    expect(tables.sections.requests.rows[0].nextStep).toBe("الإنتاج ثم التجهيز");
    expect(tables.sections.requests.rows[0].nextStepOwner).toBe("المطبخ");
    expect(tables.sections.planned.rows[0].comparisonStatus).toBe("unavailable_without_explicit_batch_link");
  });

  it("keeps filtered rows separate from global summaries and does not infer ratios", () => {
    const tables = buildProductionReportTables(report, { ...filteredRows, planned: [] }, filters);
    expect(tables.sections.planned.rows).toHaveLength(0);
    expect(tables.metadata.filteredRowCounts.planned).toBe(0);
    expect(tables.metadata.globalSummary.advancedPlans.orderCount).toBe(8);
    expect(tables.metadata.summaryScope).toBe("global_unfiltered_report");
    expect(JSON.stringify(tables)).not.toContain("actualRatio");
    expect(tables.metadata.sources[0].source).toBe("daily_production_batches");
    expect(tables.metadata.dateBases[0].dateBasis).toBe("production_date");
    expect(tables.metadata.warnings).toEqual(["تنبيه اختباري"]);
  });

  it("protects formula-like values and preserves six-decimal quantities", () => {
    expect(productionReportCsvCell("\u0000=1+1")).toBe(`"'\u0000=1+1"`);
    const csv = buildProductionReportCsv(buildProductionReportTables(report, filteredRows, filters));
    expect(csv).toContain("\"الإنتاج المنفذ\"");
    expect(csv).toContain("\"كمية مكتملة\"");
    expect(csv).toContain("\"بيانات التقرير\"");
    expect(csv).toContain(`"'	=1+1"`);
    expect(csv).toContain("\"0.123456\"");
    expect(csv).toContain("\"0.000000\"");
    expect(productionReportQuantity6(0.123456)).toBe("0.123456");
  });

  it("escapes HTML without allowing branch, row, or warning markup", () => {
    const html = buildProductionReportPrintHtml(report, filteredRows, filters);
    expect(html).toContain("فرع &lt;اختبار&gt;");
    expect(html).toContain("&lt;"); // branch label is escaped in title/filter metadata
    expect(html).not.toContain("<اختبار>");
    expect(html).toContain("display: table-header-group");
    expect(html).toContain("@page");
    expect(html).toContain("رابط المصدر");
    expect(html).toContain("الخطوة التالية");
    expect(html).toContain("الفترة الزمنية والمنطقة");
    expect(html).not.toContain("globalSummary_unfiltered");
  });

  it("keeps hostile dynamic titles out of the print style node", () => {
    const hostileFilters = {
      ...filters,
      branchLabel: "فرع\\\n\";}url(https://attacker.invalid/x)",
    };
    const html = buildProductionReportPrintHtml(report, filteredRows, hostileFilters);
    const styleNode = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";
    expect(styleNode).not.toContain("attacker.invalid");
    expect(styleNode).not.toContain("url(");
    expect(styleNode).not.toContain("فرع");
    expect(html).toContain("attacker.invalid");
  });

  it("creates real XLSX sheets with numeric six-decimal quantity cells", async () => {
    const workbook = await buildProductionReportWorkbook(report, {
      ...filteredRows,
      planned: [],
      requests: [],
    }, filters);
    expect(workbook.SheetNames).toEqual(["الإنتاج المنفذ", "الخطة المسجلة", "طلبات المطبخ", "استهلاك المواد", "الهالك المعتمد", "بيانات التقرير"]);
    expect(workbook.Sheets["الإنتاج المنفذ"]?.["F2"]).toMatchObject({ t: "n", v: 0.123456, z: "0.000000" });
    expect(workbook.Sheets["الخطة المسجلة"]?.["A1"]?.v).toBe("معرف المنتج");
    expect(workbook.Sheets["الخطة المسجلة"]?.["!ref"]).toBe("A1:I1");
    expect(workbook.Sheets["بيانات التقرير"]?.["A1"]?.v).toBe("البيان");
    expect(workbook.Sheets["بيانات التقرير"]?.["A5"]?.v).toBe("الفلاتر المختارة — البحث");
  });

  it("keeps recorded zero typed, marks partial and unknown sources without partial sums, and mirrors source columns in every format", async () => {
    const sourceRows = {
      ...filteredRows,
      requests: [
        {
          ...report.requestRows[0],
          preparedFromStock: 0,
          preparedFromProduction: 0.923456,
          preparationSourceStatus: "recorded",
          productionFulfillmentEvidence: {
            items: [{
              itemId: 902,
              evidence: { version: 1, batches: [{ batchId: 101, quantity: "0.923456", checksum: "<img src=x>" }] },
            }],
          },
        },
        {
          ...report.requestRows[0],
          itemId: 5,
          preparedFromStock: 2,
          preparedFromProduction: null,
          preparationSourceStatus: "partial",
          productionFulfillmentEvidence: null,
        },
        {
          ...report.requestRows[0],
          itemId: 6,
        },
      ] as unknown as ProductionOperationsExportRows["requests"],
    };
    const tables = buildProductionReportTables(report, sourceRows, filters);
    const requestSection = tables.sections.requests;
    expect(requestSection.rows).toHaveLength(3);
    const csv = buildProductionReportCsv(tables);
    const print = buildProductionReportPrintHtml(report, sourceRows, filters);
    expect(csv).toContain("\"مصدر التجهيز: من المخزون\"");
    expect(csv).toContain("\"0.000000\"");
    expect(csv).toContain("\"مسجل جزئياً — لا يمثل كامل الكمية\"");
    expect(csv).toContain("\"غير مسجل\"");
    expect(csv).toContain("بند 902 · دفعة 101 (0.923456)");
    expect(csv).not.toContain("<img src=x>");
    expect(print).toContain("مصدر التجهيز: من المخزون");
    expect(print).toContain("مسجل جزئياً — لا يمثل كامل الكمية");
    expect(print).toContain("غير مسجل");
    expect(print).not.toContain("<img src=x>");

    const workbook = await buildProductionReportWorkbook(report, sourceRows, filters);
    const sheet = workbook.Sheets["طلبات المطبخ"];
    expect(sheet?.["K2"]).toMatchObject({ t: "n", v: 0, z: "0.000000" });
    expect(sheet?.["L2"]).toMatchObject({ t: "n", v: 0.923456, z: "0.000000" });
    expect(sheet?.["K3"]?.v).toBe("مسجل جزئياً — لا يمثل كامل الكمية");
    expect(sheet?.["K4"]?.v).toBe("غير مسجل");
    expect(sheet?.["M2"]?.v).toBe("بند 902 · دفعة 101 (0.923456)");
  });

  it("accepts only positive numeric item, batch, and proof-quantity references", () => {
    const malicious = {
      items: [
        { itemId: "902", evidence: { batches: [{ batchId: 1, quantity: 1 }] } },
        { itemId: 902, evidence: { batches: [{ batchId: 0, quantity: 1 }, { batchId: 101, quantity: 0 }, { batchId: 102, quantity: 2, label: "=cmd()" }] } },
      ],
    };
    expect(parsePreparationEvidenceReferences(malicious)).toEqual([{ itemId: 902, batchId: 102, quantity: 2 }]);
    expect(compactPreparationEvidenceReferences(malicious)).toBe("بند 902 · دفعة 102 (2.000000)");
    expect(getPreparationSourceReadout({ preparedFromStock: 1, preparationSourceStatus: "partial" })).toMatchObject({
      status: "partial", preparedFromStock: null, preparedFromProduction: null,
    });
    expect(getPreparationSourceReadout({ preparedQuantity: 10, linkedBatchIds: [9] })).toMatchObject({
      status: "unknown", preparedFromStock: null, preparedFromProduction: null,
    });
  });

  it("renders canonical persisted string quantities for direct item and grouped report evidence in UI/export formatters", async () => {
    const persistedItemProof = {
      version: 1,
      batches: [{ batchId: 101, quantity: "3.000000", checksum: "untrusted-checksum" }],
    };
    const persistedGroupProof = {
      items: [{ itemId: 902, evidence: persistedItemProof }],
    };
    expect(compactPreparationEvidenceReferences(persistedItemProof)).toBe("دفعة 101 (3.000000)");
    expect(compactPreparationEvidenceReferences(persistedGroupProof)).toBe("بند 902 · دفعة 101 (3.000000)");
    expect(parsePreparationEvidenceReferences({
      batches: [
        { batchId: 101, quantity: "3.000000" },
        { batchId: 102, quantity: "03.000000" },
        { batchId: 103, quantity: "3.0000001" },
        { batchId: 104, quantity: " 3.000000" },
        { batchId: 105, quantity: "+3" },
        { batchId: 106, quantity: "3e0" },
        { batchId: Number.MAX_SAFE_INTEGER + 1, quantity: "3" },
      ],
    })).toEqual([{ itemId: null, batchId: 101, quantity: 3 }]);

    const sourceRows = {
      ...filteredRows,
      requests: [{
        ...report.requestRows[0],
        preparedFromStock: 0,
        preparedFromProduction: 3,
        preparationSourceStatus: "recorded",
        productionFulfillmentEvidence: persistedGroupProof,
      }] as unknown as ProductionOperationsExportRows["requests"],
    };
    const tables = buildProductionReportTables(report, sourceRows, filters);
    const csv = buildProductionReportCsv(tables);
    const print = buildProductionReportPrintHtml(report, sourceRows, filters);
    const workbook = await buildProductionReportWorkbook(report, sourceRows, filters);
    expect(csv).toContain("بند 902 · دفعة 101 (3.000000)");
    expect(print).toContain("بند 902 · دفعة 101 (3.000000)");
    expect(workbook.Sheets["طلبات المطبخ"]?.["M2"]?.v).toBe("بند 902 · دفعة 101 (3.000000)");
  });
});