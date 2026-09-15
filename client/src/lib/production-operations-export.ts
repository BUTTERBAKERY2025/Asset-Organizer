import type {
  ProductionOperationsMaterialRow,
  ProductionOperationsPlannedRow,
  ProductionOperationsProductionRow,
  ProductionOperationsReport,
  ProductionOperationsRequestRow,
  ProductionOperationsWasteRow,
} from "@shared/production-operations-report";
import { getCentralKitchenNextStep } from "@shared/central-kitchen-next-step";

/**
 * The screen already applies its search filter. Export receives those same
 * collections and deliberately does not apply a second filter.
 */
export type ProductionOperationsExportRows = {
  production: ProductionOperationsProductionRow[];
  planned: ProductionOperationsPlannedRow[];
  requests: ProductionOperationsRequestRow[];
  materials: ProductionOperationsMaterialRow[];
  waste: ProductionOperationsWasteRow[];
};

export type ProductionOperationsExportFilters = {
  startDate: string;
  endDate: string;
  branchLabel: string;
  search?: string;
};

// Keep the concise names available to a UI worker that imports the module.
export type ProductionReportFilteredRows = ProductionOperationsExportRows;
export type ProductionReportFilters = ProductionOperationsExportFilters;

export type ProductionReportExportCell =
  | string
  | number
  | null
  | readonly (string | number)[];

export type ProductionReportExportRow = Readonly<Record<string, ProductionReportExportCell>>;

export type ProductionReportExportSection = {
  name: string;
  headers: readonly string[];
  rows: readonly ProductionReportExportRow[];
  /** Quantity fields receive 0.000000 formatting in CSV and Excel. */
  quantityFields: readonly string[];
};

export type ProductionReportTable = ProductionReportExportSection;

export type PreparationSourceStatus = "recorded" | "partial" | "unknown";
export type PreparationEvidenceReference = {
  itemId: number | null;
  batchId: number;
  quantity: number;
};
export type PreparationSourceReadout = {
  status: PreparationSourceStatus;
  preparedFromStock: number | null;
  preparedFromProduction: number | null;
  evidenceReferences: PreparationEvidenceReference[];
};

export const PREPARATION_SOURCE_UNKNOWN_TEXT = "غير مسجل";
export const PREPARATION_SOURCE_PARTIAL_TEXT = "مسجل جزئياً — لا يمثل كامل الكمية";

function finiteNonnegativeQuantity(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function positiveId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * JSONB proof quantities can retain PostgreSQL NUMERIC as a canonical decimal
 * string. Parse only that persisted representation, never arbitrary strings
 * that Number() would accept (whitespace, signs, exponent/formula text).
 */
function positiveProofQuantity(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) return null;
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}

/**
 * Reads the persisted proof shape only. Labels, checksums, and arbitrary JSON
 * fields are intentionally not rendered or exported: they are not references.
 */
function proofBatchReferences(value: unknown, itemId: number | null): PreparationEvidenceReference[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const batches = (value as Record<string, unknown>).batches;
  if (!Array.isArray(batches)) return [];
  return batches.flatMap((batch) => {
    if (!batch || typeof batch !== "object" || Array.isArray(batch)) return [];
    const row = batch as Record<string, unknown>;
    const batchId = positiveId(row.batchId);
    const quantity = positiveProofQuantity(row.quantity);
    return batchId !== null && quantity !== null ? [{ itemId, batchId, quantity }] : [];
  });
}

/** Safely parses either an item's proof or the report's grouped item proofs. */
export function parsePreparationEvidenceReferences(value: unknown): PreparationEvidenceReference[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items)) {
    return record.items.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const item = entry as Record<string, unknown>;
      const itemId = positiveId(item.itemId);
      return itemId === null ? [] : proofBatchReferences(item.evidence, itemId);
    });
  }
  return proofBatchReferences(record, null);
}

export function compactPreparationEvidenceReferences(value: unknown): string {
  const references = parsePreparationEvidenceReferences(value);
  if (!references.length) return "—";
  return references.map((reference) => `${reference.itemId === null ? "" : `بند ${reference.itemId} · `}دفعة ${reference.batchId} (${productionReportQuantity6(reference.quantity)})`).join("؛ ");
}

/**
 * Does not derive a source from a linked batch, completion, dispatch, or
 * prepared total. Old payloads without the persisted source fields remain
 * explicitly unknown.
 */
export function getPreparationSourceReadout(value: unknown): PreparationSourceReadout {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const explicitStatus = row.preparationSourceStatus;
  const stock = finiteNonnegativeQuantity(row.preparedFromStock);
  const production = finiteNonnegativeQuantity(row.preparedFromProduction);
  const status: PreparationSourceStatus = explicitStatus === "partial"
    ? "partial"
    : explicitStatus === "recorded" && stock !== null && production !== null
      ? "recorded"
      : "unknown";
  return {
    status,
    preparedFromStock: status === "recorded" ? stock : null,
    preparedFromProduction: status === "recorded" ? production : null,
    evidenceReferences: parsePreparationEvidenceReferences(row.productionFulfillmentEvidence),
  };
}

export function preparationSourceQuantityText(value: unknown, source: PreparationSourceReadout): string {
  if (source.status === "partial") return PREPARATION_SOURCE_PARTIAL_TEXT;
  if (source.status !== "recorded" || typeof value !== "number" || !Number.isFinite(value)) {
    return PREPARATION_SOURCE_UNKNOWN_TEXT;
  }
  return productionReportQuantity6(value);
}

export type ProductionReportExportMetadata = {
  selectedFilters: ProductionOperationsExportFilters;
  /**
   * A pure builder cannot read the wall clock. Download functions replace this
   * source report timestamp with the actual export instant before writing.
   */
  exportTimestamp: string;
  generatedAt: string;
  summaryScope: "global_unfiltered_report";
  globalSummary: ProductionOperationsReport["summary"];
  globalCoverage: ProductionOperationsReport["coverage"];
  filteredRowCounts: Record<keyof ProductionOperationsExportRows, number>;
  dateWindow: ProductionOperationsReport["metadata"]["dateWindow"];
  dateBases: ProductionOperationsReport["metadata"]["dateWindow"]["bases"];
  sources: ProductionOperationsReport["metadata"]["sources"];
  linkage: ProductionOperationsReport["metadata"]["linkage"];
  costing: ProductionOperationsReport["metadata"]["costing"];
  rowLimit: ProductionOperationsReport["metadata"]["rowLimit"];
  warnings: string[];
  reportMetadata: ProductionOperationsReport["metadata"];
};

export type ProductionReportTables = {
  sections: {
    production: ProductionReportExportSection;
    planned: ProductionReportExportSection;
    requests: ProductionReportExportSection;
    materials: ProductionReportExportSection;
    waste: ProductionReportExportSection;
  };
  metadata: ProductionReportExportMetadata;
};

const SECTION_NAMES = ["production", "planned", "requests", "materials", "waste"] as const;
type ExportSectionName = (typeof SECTION_NAMES)[number];

const SECTION_LABELS: Record<ExportSectionName, string> = {
  production: "الإنتاج المنفذ",
  planned: "الخطة المسجلة",
  requests: "طلبات المطبخ المركزي",
  materials: "استهلاك المواد",
  waste: "الهالك المعتمد",
};

const SHEET_LABELS: Record<ExportSectionName | "metadata", string> = {
  production: "الإنتاج المنفذ",
  planned: "الخطة المسجلة",
  requests: "طلبات المطبخ",
  materials: "استهلاك المواد",
  waste: "الهالك المعتمد",
  metadata: "بيانات التقرير",
};

const FIELD_LABELS: Record<string, string> = {
  productId: "معرف المنتج",
  productName: "المنتج",
  unit: "الوحدة",
  branchIds: "معرفات الفروع",
  finishedBatchCount: "دفعات مكتملة",
  finishedQuantity: "كمية مكتملة",
  inProgressBatchCount: "دفعات قيد التنفيذ",
  inProgressQuantity: "كمية قيد التنفيذ",
  batchIds: "معرفات الدفعات",
  recipeSourceRecipeIds: "معرفات الوصفات المصدرية",
  catalogUnit: "وحدة الكتالوج الحالية",
  sourceBranchIds: "معرفات فروع المصدر",
  targetBranchIds: "معرفات الفروع المستهدفة",
  plannedQuantity: "الكمية المخططة",
  advancedOrderIds: "معرفات الأوامر المتقدمة",
  advancedOrderItemIds: "معرفات بنود الأوامر",
  comparisonStatus: "حالة المقارنة",
  kitchenId: "معرف المطبخ",
  requestBranchIds: "معرفات فروع الطلب",
  inventoryMode: "وضع المخزون",
  status: "الحالة",
  itemKind: "نوع الصنف",
  itemId: "معرف الصنف",
  itemName: "الصنف",
  requestedQuantity: "الكمية المطلوبة",
  preparedQuantity: "الكمية المجهزة",
  preparedFromStock: "مصدر التجهيز: من المخزون",
  preparedFromProduction: "مصدر التجهيز: من إنتاج مرتبط",
  productionFulfillmentEvidence: "مراجع دليل الإنتاج المرتبط",
  dispatchedQuantity: "الكمية المرسلة",
  goodReceivedQuantity: "الكمية المستلمة سليماً",
  damagedQuantity: "الكمية التالفة",
  missingQuantity: "الكمية المفقودة",
  linkedFinishedQuantity: "إنتاج منتهٍ مرتبط",
  linkedInProgressQuantity: "إنتاج قيد التنفيذ مرتبط",
  linkedBatchIds: "معرفات الدفعات المرتبطة (FK صريح)",
  linkedProductionComparisonStatus: "حالة مقارنة الإنتاج المرتبط عبر FK",
  orderIds: "معرفات الطلبات الصريحة",
  orderItemIds: "معرفات بنود الطلبات الصريحة",
  sourceRelativeUrl: "رابط المصدر الفعلي",
  nextStep: "الخطوة التالية",
  nextStepOwner: "مسؤول الخطوة التالية",
  warehouseItemId: "معرف صنف المستودع",
  materialName: "المادة",
  consumedQuantity: "الكمية المصروفة",
  movementIds: "معرفات حركات الصرف",
  approvedQuantity: "الكمية المعتمدة",
  wasteReportIds: "معرفات تقارير الهالك",
  wasteItemIds: "معرفات بنود الهالك",
};

const SECTION_DEFINITIONS = {
  production: {
    name: "production",
    headers: [
      "productId",
      "productName",
      "unit",
      "branchIds",
      "finishedBatchCount",
      "finishedQuantity",
      "inProgressBatchCount",
      "inProgressQuantity",
      "batchIds",
      "recipeSourceRecipeIds",
    ],
    quantityFields: ["finishedQuantity", "inProgressQuantity"],
  },
  planned: {
    name: "planned",
    headers: [
      "productId",
      "productName",
      "catalogUnit",
      "sourceBranchIds",
      "targetBranchIds",
      "plannedQuantity",
      "advancedOrderIds",
      "advancedOrderItemIds",
      "comparisonStatus",
    ],
    quantityFields: ["plannedQuantity"],
  },
  requests: {
    name: "requests",
    headers: [
      "kitchenId",
      "requestBranchIds",
      "inventoryMode",
      "status",
      "itemKind",
      "itemId",
      "itemName",
      "unit",
      "requestedQuantity",
      "preparedQuantity",
      "preparedFromStock",
      "preparedFromProduction",
      "productionFulfillmentEvidence",
      "dispatchedQuantity",
      "goodReceivedQuantity",
      "damagedQuantity",
      "missingQuantity",
      "linkedFinishedQuantity",
      "linkedInProgressQuantity",
      "linkedBatchIds",
      "linkedProductionComparisonStatus",
      "orderIds",
      "orderItemIds",
      "sourceRelativeUrl",
      "nextStep",
      "nextStepOwner",
    ],
    quantityFields: [
      "requestedQuantity",
      "preparedQuantity",
      "preparedFromStock",
      "preparedFromProduction",
      "dispatchedQuantity",
      "goodReceivedQuantity",
      "damagedQuantity",
      "missingQuantity",
      "linkedFinishedQuantity",
      "linkedInProgressQuantity",
    ],
  },
  materials: {
    name: "materials",
    headers: ["warehouseItemId", "materialName", "unit", "consumedQuantity", "movementIds", "batchIds"],
    quantityFields: ["consumedQuantity"],
  },
  waste: {
    name: "waste",
    headers: ["productId", "productName", "catalogUnit", "approvedQuantity", "wasteReportIds", "wasteItemIds"],
    quantityFields: ["approvedQuantity"],
  },
} as const;

function cloneExportRow<T extends object>(row: T): ProductionReportExportRow {
  // Keep exact array-valued FK fields rather than flattening them into labels.
  return { ...row } as unknown as ProductionReportExportRow;
}

function makeSection<T extends object>(
  definition: (typeof SECTION_DEFINITIONS)[ExportSectionName],
  rows: T[],
): ProductionReportExportSection {
  return {
    name: definition.name,
    headers: definition.headers,
    rows: rows.map(cloneExportRow),
    quantityFields: definition.quantityFields,
  };
}

function requestSourceRelativeUrl(row: ProductionOperationsRequestRow): string {
  return row.orderIds
    .map((orderId) => `/central-kitchen-orders?orderId=${encodeURIComponent(String(orderId))}`)
    .join("\n");
}

/**
 * Pure export model builder. Global summary and coverage are copied to
 * metadata as global/unfiltered values; only section rows use filteredRows.
 *
 * No planned/actual ratio is inferred. The planned comparisonStatus and the
 * request inventoryMode/status/linkage fields are exported verbatim.
 */
export function buildProductionReportTables(
  report: ProductionOperationsReport,
  filteredRows: ProductionOperationsExportRows,
  filters: ProductionOperationsExportFilters,
): ProductionReportTables {
  const selectedFilters: ProductionOperationsExportFilters = {
    startDate: filters.startDate,
    endDate: filters.endDate,
    branchLabel: filters.branchLabel,
    ...(filters.search ? { search: filters.search } : {}),
  };
  const requestRows = filteredRows.requests.map((row) => {
    const step = getCentralKitchenNextStep({
      status: row.status,
      inventoryMode: row.inventoryMode,
      damagedQuantity: row.damagedQuantity,
      missingQuantity: row.missingQuantity,
    });
    return { ...row, sourceRelativeUrl: requestSourceRelativeUrl(row), nextStep: step.label, nextStepOwner: step.owner };
  });

  return {
    sections: {
      production: makeSection(SECTION_DEFINITIONS.production, filteredRows.production),
      planned: makeSection(SECTION_DEFINITIONS.planned, filteredRows.planned),
      requests: makeSection(SECTION_DEFINITIONS.requests, requestRows),
      materials: makeSection(SECTION_DEFINITIONS.materials, filteredRows.materials),
      waste: makeSection(SECTION_DEFINITIONS.waste, filteredRows.waste),
    },
    metadata: {
      selectedFilters,
      // The actual download helpers replace this with new Date().toISOString().
      exportTimestamp: report.metadata.generatedAt,
      generatedAt: report.metadata.generatedAt,
      summaryScope: "global_unfiltered_report",
      globalSummary: report.summary,
      globalCoverage: report.coverage,
      filteredRowCounts: {
        production: filteredRows.production.length,
        planned: filteredRows.planned.length,
        requests: filteredRows.requests.length,
        materials: filteredRows.materials.length,
        waste: filteredRows.waste.length,
      },
      dateWindow: report.metadata.dateWindow,
      dateBases: report.metadata.dateWindow.bases,
      sources: report.metadata.sources,
      linkage: report.metadata.linkage,
      costing: report.metadata.costing,
      rowLimit: report.metadata.rowLimit,
      warnings: [...report.metadata.warnings],
      reportMetadata: report.metadata,
    },
  };
}

function tablesAtExportTime(
  tables: ProductionReportTables,
  exportTimestamp = new Date().toISOString(),
): ProductionReportTables {
  return { ...tables, metadata: { ...tables.metadata, exportTimestamp } };
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

/**
 * Spreadsheet formula protection checks the first non-whitespace/control
 * character, including hidden prefixes such as tab, NUL, and BOM.
 */
export function safeProductionReportText(value: string): string {
  return /^[\s\u0000-\u001f\u007f-\u009f\uFEFF]*[=+\-@]/u.test(value) ? `'${value}` : value;
}

export function productionReportCsvCell(value: unknown): string {
  const safe = safeProductionReportText(cellText(value));
  return `"${safe.replace(/"/g, "\"\"")}"`;
}

/** Six decimal places is the NUMERIC(18,6) precision used by the report. */
export function productionReportQuantity6(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : value.toFixed(6);
}

// Compatibility aliases for workers that used the names from the first draft.
export const csvCell = productionReportCsvCell;
export const formatQuantity6 = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "غير متاح"
    : new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 6 }).format(value);

const MODE_LABELS: Record<string, string> = { real: "فعلي", shadow: "ظلّي", unknown: "غير معروف" };
const STATUS_LABELS: Record<string, string> = {
  requested: "مطلوب",
  approved: "معتمد",
  prepared: "مجهز",
  dispatched: "مرسل",
  received: "مستلم",
  cancelled: "ملغى",
  canceled: "ملغى",
  rejected: "مرفوض",
};

function displayFieldValue(header: string, value: ProductionReportExportCell, row?: ProductionReportExportRow): string {
  const source = row ? getPreparationSourceReadout(row) : null;
  if (source && (header === "preparedFromStock" || header === "preparedFromProduction")) {
    return preparationSourceQuantityText(value, source);
  }
  if (header === "productionFulfillmentEvidence") return compactPreparationEvidenceReferences(value);
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.length ? value.join("، ") : "—";
  if (header === "inventoryMode") return MODE_LABELS[String(value)] || String(value);
  if (header === "status") return STATUS_LABELS[String(value).toLowerCase()] || String(value);
  if (header === "itemKind") return value === "product" ? "منتج" : value === "warehouse_item" ? "صنف مستودع" : String(value);
  if (header === "comparisonStatus") {
    return value === "unavailable_without_explicit_batch_link"
      ? "غير متاحة دون رابط دفعة صريح"
      : String(value);
  }
  if (header === "linkedProductionComparisonStatus") {
    return value === "available_explicit_batch_order_item_fk"
      ? "متاحة عبر رابط FK صريح للدفعة وبند الطلب"
      : value === "not_applicable_warehouse_item"
        ? "لا تنطبق على صنف مستودع"
        : String(value);
  }
  return String(value);
}

function csvValue(header: string, value: ProductionReportExportCell, quantity: boolean, row: ProductionReportExportRow): string {
  const source = getPreparationSourceReadout(row);
  if (header === "preparedFromStock" || header === "preparedFromProduction") {
    return preparationSourceQuantityText(value, source);
  }
  if (header === "productionFulfillmentEvidence") return compactPreparationEvidenceReferences(value);
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return quantity ? productionReportQuantity6(value) : String(value);
  return displayFieldValue(header, value, row);
}

function quantitiesLine(values: Array<{ unit: string; quantity: number }>): string {
  return values.length
    ? values.map((value) => `${value.unit}: ${productionReportQuantity6(value.quantity)}`).join("، ")
    : "لا توجد كمية";
}

function globalSummaryRows(metadata: ProductionReportExportMetadata): string[][] {
  const summary = metadata.globalSummary;
  const kitchenModes = summary.centralKitchen.byInventoryMode.length
    ? summary.centralKitchen.byInventoryMode
        .map((mode) => `${MODE_LABELS[mode.inventoryMode] || mode.inventoryMode}: ${mode.orderCount} طلب`)
        .join("، ")
    : "لا توجد أوضاع";
  return [
    [
      "ملخص الإنتاج العام غير المفلتر",
      `دفعات مكتملة: ${summary.production.finishedBatchCount}؛ قيد التنفيذ: ${summary.production.inProgressBatchCount}؛ مكتمل حسب الوحدة: ${quantitiesLine(summary.production.finishedQuantityByUnit)}؛ قيد التنفيذ حسب الوحدة: ${quantitiesLine(summary.production.inProgressQuantityByUnit)}`,
    ],
    [
      "ملخص الخطط العام غير المفلتر",
      `أوامر: ${summary.advancedPlans.orderCount}؛ بنود: ${summary.advancedPlans.itemCount}؛ الكمية المخططة حسب وحدة الكتالوج: ${quantitiesLine(summary.advancedPlans.plannedQuantityByCatalogUnit)}؛ حالة المقارنة: غير متاحة دون رابط دفعة صريح`,
    ],
    [
      "ملخص طلبات المطبخ العام غير المفلتر",
      `طلبات: ${summary.centralKitchen.orderCount}؛ نشطة: ${summary.centralKitchen.activeOrderCount}؛ غير نشطة: ${summary.centralKitchen.inactiveOrderCount}؛ حسب الوضع: ${kitchenModes}`,
    ],
    [
      "ملخص المواد العام غير المفلتر",
      `حركات صرف: ${summary.materials.movementCount}؛ الكمية حسب الوحدة: ${quantitiesLine(summary.materials.consumedQuantityByUnit)}`,
    ],
    [
      "ملخص الهالك العام غير المفلتر",
      `تقارير: ${summary.approvedWaste.reportCount}؛ الكمية حسب وحدة الكتالوج: ${quantitiesLine(summary.approvedWaste.quantityByCatalogUnit)}`,
    ],
  ];
}

function metadataCsvRows(metadata: ProductionReportExportMetadata): string[][] {
  const filters = metadata.selectedFilters;
  const filteredCounts = Object.entries(metadata.filteredRowCounts)
    .map(([key, count]) => `${SECTION_LABELS[key as ExportSectionName]}: ${count}`)
    .join("، ");
  const dateBases = metadata.dateBases.length
    ? metadata.dateBases.map((basis) => `${basis.label}: ${basis.source} — ${basis.dateBasis}`).join("؛ ")
    : "لا توجد أسس تاريخ مسجلة";
  const sources = metadata.sources.length
    ? metadata.sources.map((source) => `${source.label}: ${source.source} — ${source.status === "available" ? "متاح" : "غير متاح"}`).join("؛ ")
    : "لا توجد مصادر مسجلة";
  const warnings = metadata.warnings.length ? metadata.warnings : ["لا توجد تحذيرات"];
  return [
    ["الفلاتر المختارة — الفرع", filters.branchLabel],
    ["الفلاتر المختارة — من تاريخ", filters.startDate],
    ["الفلاتر المختارة — إلى تاريخ", filters.endDate],
    ["الفلاتر المختارة — البحث", filters.search || "بدون تصفية بحث"],
    ["وقت التصدير", metadata.exportTimestamp],
    ["وقت توليد التقرير", metadata.generatedAt],
    ["نطاق الملخص", "عام وغير مفلتر؛ الصفوف أدناه بعد تطبيق بحث الشاشة"],
    ["عدد الصفوف المصدرة بعد البحث", filteredCounts],
    ["الفترة الزمنية والمنطقة", `${metadata.dateWindow.startDate} إلى ${metadata.dateWindow.endDate}؛ ${metadata.dateWindow.daysInclusive} يوماً؛ ${metadata.dateWindow.timezone}`],
    ...globalSummaryRows(metadata),
    ["تغطية الربط العامة غير المفلترة", `دفعات: ${metadata.globalCoverage.finishedBatchCount}؛ مرتبطة: ${metadata.globalCoverage.linked}؛ غير مرتبطة: ${metadata.globalCoverage.unlinked}؛ وصفات: ${metadata.globalCoverage.recipeBacked}؛ غير وصفية: ${metadata.globalCoverage.nonRecipe}`],
    ["أساس التاريخ", dateBases],
    ["مصادر التقرير", sources],
    ["حالة ربط الطلب بالدفعة", `${metadata.linkage.centralKitchenOrderItemToBatch.status} — ${metadata.linkage.centralKitchenOrderItemToBatch.dateBasis}`],
    ["حالة ربط الخطة بالدفعة", metadata.linkage.advancedPlanToBatch.status],
    ["التكلفة", metadata.costing.message],
    ["حد الصفوف", metadata.rowLimit.applied ? `مطبق؛ الإجمالي ${metadata.rowLimit.totalRows}` : `غير مطبق؛ الإجمالي ${metadata.rowLimit.totalRows}`],
    ...warnings.map((warning, index) => [`تحذير ${index + 1}`, warning]),
    ["اتساق القراءة", metadata.reportMetadata.readConsistency],
    ["نطاق الفروع", metadata.reportMetadata.branchScope.requestedBranchId],
  ];
}

/**
 * Pure CSV serialization. Numeric quantity fields are formatted as six
 * decimals here; identifiers and other counts remain non-quantity values.
 */
export function buildProductionReportCsv(tables: ProductionReportTables): string {
  const lines: string[] = [];
  for (const name of SECTION_NAMES) {
    const current = tables.sections[name];
    lines.push(productionReportCsvCell(SECTION_LABELS[name]));
    lines.push(current.headers.map((header) => productionReportCsvCell(FIELD_LABELS[header] || header)).join(","));
    for (const row of current.rows) {
      lines.push(
        current.headers
          .map((header) => productionReportCsvCell(csvValue(header, row[header], current.quantityFields.includes(header), row)))
          .join(","),
      );
    }
    lines.push("");
  }
  lines.push(productionReportCsvCell(SHEET_LABELS.metadata));
  lines.push([productionReportCsvCell("البيان"), productionReportCsvCell("القيمة")].join(","));
  for (const [key, value] of metadataCsvRows(tables.metadata)) {
    lines.push([productionReportCsvCell(key), productionReportCsvCell(value)].join(","));
  }
  return `\uFEFF${lines.join("\r\n")}`;
}

function safeFilePart(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "_") || "all-branches";
}

function exportFileBase(filters: ProductionOperationsExportFilters): string {
  return `تقرير_عمليات_الإنتاج_${safeFilePart(filters.branchLabel)}_${filters.startDate}_${filters.endDate}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("لا يمكن تنزيل تقرير التشغيل خارج المتصفح");
  }
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(blob);
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body?.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadProductionReportCsv(
  report: ProductionOperationsReport,
  filteredRows: ProductionOperationsExportRows,
  filters: ProductionOperationsExportFilters,
): void {
  const tables = tablesAtExportTime(buildProductionReportTables(report, filteredRows, filters));
  downloadBlob(
    new Blob([buildProductionReportCsv(tables)], { type: "text/csv;charset=utf-8;" }),
    `${exportFileBase(filters)}.csv`,
  );
}

function excelCell(header: string, value: ProductionReportExportCell, row: ProductionReportExportRow): string | number | null {
  const source = getPreparationSourceReadout(row);
  if (header === "preparedFromStock" || header === "preparedFromProduction") {
    if (source.status !== "recorded") return source.status === "partial" ? PREPARATION_SOURCE_PARTIAL_TEXT : PREPARATION_SOURCE_UNKNOWN_TEXT;
    return typeof value === "number" && Number.isFinite(value) ? value : PREPARATION_SOURCE_UNKNOWN_TEXT;
  }
  if (header === "productionFulfillmentEvidence") return safeProductionReportText(compactPreparationEvidenceReferences(value));
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return safeProductionReportText(displayFieldValue(header, value, row));
}

type XlsxModule = typeof import("xlsx");

function worksheetForTable(XLSX: XlsxModule, table: ProductionReportExportSection) {
  const aoa: Array<Array<string | number | null>> = [
    table.headers.map((header) => FIELD_LABELS[header] || header),
    ...table.rows.map((row) => table.headers.map((header) => excelCell(header, row[header], row))),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet["!cols"] = table.headers.map((header) => ({
    wch: Math.min(Math.max((FIELD_LABELS[header] || header).length + 2, 14), 32),
  }));

  const quantityFields = new Set(table.quantityFields);
  table.rows.forEach((row, rowIndex) => {
    table.headers.forEach((header, columnIndex) => {
      if (!quantityFields.has(header) || typeof row[header] !== "number") return;
      const address = XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex });
      // Keep the underlying value numeric and only control its display format.
      if (worksheet[address]) worksheet[address].z = "0.000000";
    });
  });
  return worksheet;
}

function metadataWorksheet(XLSX: XlsxModule, metadata: ProductionReportExportMetadata) {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["البيان", "القيمة"],
    ...metadataCsvRows(metadata),
  ]);
  worksheet["!cols"] = [{ wch: 30 }, { wch: 100 }];
  return worksheet;
}

/**
 * Builds the same real SheetJS workbook used by the download helper without
 * writing it. This is useful for callers that need to inspect a workbook
 * before saving it and keeps workbook tests independent of a browser DOM.
 */
export async function buildProductionReportWorkbook(
  report: ProductionOperationsReport,
  filteredRows: ProductionOperationsExportRows,
  filters: ProductionOperationsExportFilters,
): Promise<import("xlsx").WorkBook> {
  const XLSX = await import("xlsx");
  const tables = tablesAtExportTime(buildProductionReportTables(report, filteredRows, filters));
  const workbook = XLSX.utils.book_new();
  for (const name of SECTION_NAMES) {
    XLSX.utils.book_append_sheet(workbook, worksheetForTable(XLSX, tables.sections[name]), SHEET_LABELS[name]);
  }
  XLSX.utils.book_append_sheet(workbook, metadataWorksheet(XLSX, tables.metadata), SHEET_LABELS.metadata);
  return workbook;
}

export async function downloadProductionReportExcel(
  report: ProductionOperationsReport,
  filteredRows: ProductionOperationsExportRows,
  filters: ProductionOperationsExportFilters,
): Promise<void> {
  try {
    // Follow the existing project pattern: xlsx is already a dependency and
    // is loaded only when the user requests an Excel export.
    const XLSX = await import("xlsx");
    const workbook = await buildProductionReportWorkbook(report, filteredRows, filters);
    XLSX.writeFile(workbook, `${exportFileBase(filters)}.xlsx`);
  } catch (error) {
    // Do not silently fall back to a fake .xls/HTML download. UI callers can
    // show this explicit message to the user.
    const cause = error instanceof Error ? ` ${error.message}` : "";
    throw new Error(`تعذر تنزيل تقرير التشغيل بصيغة Excel.${cause}`);
  }
}

export function escapeProductionReportHtml(value: unknown): string {
  return cellText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tableHtml(table: ProductionReportExportSection): string {
  const headers = table.headers.map((header) => `<th scope="col">${escapeProductionReportHtml(FIELD_LABELS[header] || header)}</th>`).join("");
  const body = table.rows
    .map((row) => {
      const cells = table.headers
        .map((header) => `<td>${escapeProductionReportHtml(
          typeof row[header] === "number" && table.quantityFields.includes(header)
            ? productionReportQuantity6(row[header] as number)
            : displayFieldValue(header, row[header], row),
        )}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<section class="report-section"><h2>${escapeProductionReportHtml(SECTION_LABELS[table.name as ExportSectionName] || table.name)}</h2><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></section>`;
}

function reportPrintTitle(filters: ProductionOperationsExportFilters): string {
  return `تقرير عمليات الإنتاج — ${filters.branchLabel} — ${filters.startDate} إلى ${filters.endDate}`;
}

/**
 * Pure escaped print markup, useful for previews/tests. printProductionReport
 * does not inject this string into a popup; it constructs the popup using DOM
 * nodes and textContent.
 */
export function buildProductionReportPrintHtml(
  report: ProductionOperationsReport,
  filteredRows: ProductionOperationsExportRows,
  filters: ProductionOperationsExportFilters,
): string {
  const tables = buildProductionReportTables(report, filteredRows, filters);
  const title = reportPrintTitle(filters);
  const filterSummary = `الفرع: ${tables.metadata.selectedFilters.branchLabel}؛ من: ${tables.metadata.selectedFilters.startDate}؛ إلى: ${tables.metadata.selectedFilters.endDate}؛ البحث: ${tables.metadata.selectedFilters.search || "بدون تصفية بحث"}`;
  const metadataRows = metadataCsvRows(tables.metadata)
    .map(([key, value]) => `<tr><th scope="row">${escapeProductionReportHtml(key)}</th><td>${escapeProductionReportHtml(value)}</td></tr>`)
    .join("");
  const sections = SECTION_NAMES.map((name) => tableHtml(tables.sections[name])).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeProductionReportHtml(title)}</title><style>
@page { size: A4 landscape; margin: 15mm 10mm 18mm; @top-center { content: "تقرير عمليات الإنتاج"; } @bottom-center { content: "صفحة " counter(page) " من " counter(pages); } }
* { box-sizing: border-box; } body { direction: rtl; font-family: Tahoma, Arial, sans-serif; color: #172033; margin: 0; font-size: 10px; }
h1 { font-size: 20px; margin: 0 0 5px; } h2 { font-size: 14px; margin: 18px 0 6px; }
.filters { border: 1px solid #cbd5e1; padding: 7px; margin: 0 0 10px; }
table { width: 100%; border-collapse: collapse; margin: 0 0 8px; page-break-inside: auto; } thead { display: table-header-group; }
tr { page-break-inside: avoid; page-break-after: auto; } th, td { border: 1px solid #cbd5e1; padding: 4px 5px; text-align: right; vertical-align: top; overflow-wrap: anywhere; } th { background: #eef2ff; font-weight: 700; }
</style></head><body><h1>${escapeProductionReportHtml(title)}</h1><div class="filters"><strong>الفلاتر المختارة:</strong> ${escapeProductionReportHtml(filterSummary)}<br><strong>نطاق الملخص:</strong> ${escapeProductionReportHtml(tables.metadata.summaryScope === "global_unfiltered_report" ? "الملخص عام وغير مفلتر" : tables.metadata.summaryScope)}</div>${sections}<section class="report-section"><h2>${escapeProductionReportHtml(SHEET_LABELS.metadata)}</h2><table><thead><tr><th scope="col">البيان</th><th scope="col">القيمة</th></tr></thead><tbody>${metadataRows}</tbody></table></section></body></html>`;
}

export function printProductionReport(
  report: ProductionOperationsReport,
  filteredRows: ProductionOperationsExportRows,
  filters: ProductionOperationsExportFilters,
): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("لا يمكن طباعة تقرير التشغيل خارج المتصفح");
  }
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=800");
  if (!printWindow) {
    throw new Error("تعذر فتح نافذة الطباعة؛ يرجى السماح بالنوافذ المنبثقة");
  }

  const tables = buildProductionReportTables(report, filteredRows, filters);
  const title = reportPrintTitle(filters);
  const filterSummary = `الفرع: ${tables.metadata.selectedFilters.branchLabel}؛ من: ${tables.metadata.selectedFilters.startDate}؛ إلى: ${tables.metadata.selectedFilters.endDate}؛ البحث: ${tables.metadata.selectedFilters.search || "بدون تصفية بحث"}`;
  const popupDocument = printWindow.document;
  popupDocument.title = title;
  popupDocument.documentElement.setAttribute("dir", "rtl");
  popupDocument.documentElement.setAttribute("lang", "ar");

  const head = popupDocument.createElement("head");
  const charset = popupDocument.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  head.appendChild(charset);
  const titleElement = popupDocument.createElement("title");
  titleElement.textContent = title;
  head.appendChild(titleElement);
  const style = popupDocument.createElement("style");
  style.textContent = `
@page { size: A4 landscape; margin: 15mm 10mm 18mm; @top-center { content: "تقرير عمليات الإنتاج"; } @bottom-center { content: "صفحة " counter(page) " من " counter(pages); } }
body { direction: rtl; font-family: Tahoma, Arial, sans-serif; color: #172033; margin: 0; font-size: 10px; }
h1 { font-size: 20px; margin: 0 0 5px; } h2 { font-size: 14px; margin: 18px 0 6px; } .filters { border: 1px solid #cbd5e1; padding: 7px; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; page-break-inside: auto; } thead { display: table-header-group; } tr { page-break-inside: avoid; page-break-after: auto; }
th, td { border: 1px solid #cbd5e1; padding: 4px 5px; text-align: right; vertical-align: top; overflow-wrap: anywhere; } th { background: #eef2ff; }
`;
  head.appendChild(style);

  const body = popupDocument.createElement("body");
  const heading = popupDocument.createElement("h1");
  heading.textContent = title;
  body.appendChild(heading);
  const filterBox = popupDocument.createElement("div");
  filterBox.className = "filters";
  filterBox.textContent = `الفلاتر المختارة: ${filterSummary} — نطاق الملخص: ${tables.metadata.summaryScope === "global_unfiltered_report" ? "الملخص عام وغير مفلتر" : tables.metadata.summaryScope}`;
  body.appendChild(filterBox);

  for (const name of SECTION_NAMES) {
    const current = tables.sections[name];
    const sectionElement = popupDocument.createElement("section");
    const sectionHeading = popupDocument.createElement("h2");
    sectionHeading.textContent = SECTION_LABELS[name];
    sectionElement.appendChild(sectionHeading);
    const tableElement = popupDocument.createElement("table");
    const thead = popupDocument.createElement("thead");
    const headerRow = popupDocument.createElement("tr");
    for (const header of current.headers) {
      const cell = popupDocument.createElement("th");
      cell.scope = "col";
      cell.textContent = FIELD_LABELS[header] || header;
      headerRow.appendChild(cell);
    }
    thead.appendChild(headerRow);
    tableElement.appendChild(thead);
    const tbody = popupDocument.createElement("tbody");
    for (const row of current.rows) {
      const bodyRow = popupDocument.createElement("tr");
      for (const header of current.headers) {
        const cell = popupDocument.createElement("td");
        cell.textContent = typeof row[header] === "number" && current.quantityFields.includes(header)
          ? productionReportQuantity6(row[header] as number)
          : (row[header] === null || row[header] === undefined
            ? (header === "preparedFromStock" || header === "preparedFromProduction"
              ? preparationSourceQuantityText(row[header], getPreparationSourceReadout(row))
              : "—")
            : displayFieldValue(header, row[header], row));
        bodyRow.appendChild(cell);
      }
      tbody.appendChild(bodyRow);
    }
    tableElement.appendChild(tbody);
    sectionElement.appendChild(tableElement);
    body.appendChild(sectionElement);
  }

  const metadataSection = popupDocument.createElement("section");
  const metadataHeading = popupDocument.createElement("h2");
  metadataHeading.textContent = SHEET_LABELS.metadata;
  metadataSection.appendChild(metadataHeading);
  const metadataTable = popupDocument.createElement("table");
  const metadataHead = popupDocument.createElement("thead");
  const metadataHeaderRow = popupDocument.createElement("tr");
  for (const value of ["البيان", "القيمة"]) {
    const cell = popupDocument.createElement("th");
    cell.textContent = value;
    metadataHeaderRow.appendChild(cell);
  }
  metadataHead.appendChild(metadataHeaderRow);
  metadataTable.appendChild(metadataHead);
  const metadataBody = popupDocument.createElement("tbody");
  for (const [key, value] of metadataCsvRows(tables.metadata)) {
    const row = popupDocument.createElement("tr");
    const keyCell = popupDocument.createElement("th");
    keyCell.scope = "row";
    keyCell.textContent = key;
    const valueCell = popupDocument.createElement("td");
    valueCell.textContent = value;
    row.append(keyCell, valueCell);
    metadataBody.appendChild(row);
  }
  metadataTable.appendChild(metadataBody);
  metadataSection.appendChild(metadataTable);
  body.appendChild(metadataSection);

  // No document.write, innerHTML, URL blob, or fake PDF download.
  popupDocument.replaceChildren(head, body);
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 150);
}