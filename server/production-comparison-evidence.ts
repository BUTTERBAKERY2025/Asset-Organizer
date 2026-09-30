import { and, eq, gte, inArray, isNull, lte, notLike, or } from "drizzle-orm";
import { db } from "./db";
import { dailyProductionBatches, dailySalesData, dailyComparisons, branches } from "@shared/schema";
import { canonicalPieceUnit, comparisonSalesFingerprint, SALES_EVIDENCE_PREFIX } from "./comparison-sales-parser";

export function comparisonDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function comparisonRange(start: unknown, end: unknown): start is string {
  return comparisonDate(start) && comparisonDate(end) && start <= end;
}

// null means the administrator's explicitly authorized "all branches" scope.
// Even for that scope every source and destination query is constrained to actual branch IDs.
export async function comparisonBranchIds(branchIds: string[] | null): Promise<string[]> {
  if (branchIds !== null) return branchIds;
  const rows = await db.select({ id: branches.id }).from(branches);
  return rows.map(row => row.id);
}

export async function comparisonEvidence(branchIds: string[], startDate: string, endDate: string) {
  if (branchIds.length === 0) return { finishedBatches: 0, canonicalBatches: 0, nonCanonicalBatches: 0, salesRows: 0, legacyRows: 0 };
  const [batches, sales, legacy] = await Promise.all([
    db.select({ productId: dailyProductionBatches.productId, unit: dailyProductionBatches.unit })
      .from(dailyProductionBatches).where(and(
        inArray(dailyProductionBatches.branchId, branchIds),
        gte(dailyProductionBatches.productionDate, startDate),
        lte(dailyProductionBatches.productionDate, endDate),
        eq(dailyProductionBatches.status, "finished"),
      )),
    db.select({ id: dailySalesData.id }).from(dailySalesData).where(and(
      inArray(dailySalesData.branchId, branchIds),
      gte(dailySalesData.salesDate, startDate),
      lte(dailySalesData.salesDate, endDate),
    )),
    db.select({ id: dailyComparisons.id }).from(dailyComparisons).where(and(
      inArray(dailyComparisons.branchId, branchIds),
      gte(dailyComparisons.comparisonDate, startDate),
      lte(dailyComparisons.comparisonDate, endDate),
      or(isNull(dailyComparisons.statusReason),
        notLike(dailyComparisons.statusReason, `${COMPARISON_REASON_PREFIX}%`)),
    )),
  ]);
  const canonicalBatches = batches.filter(b => b.productId !== null && !!b.unit?.trim()).length;
  return {
    finishedBatches: batches.length,
    canonicalBatches,
    nonCanonicalBatches: batches.length - canonicalBatches,
    salesRows: sales.length,
    legacyRows: legacy.length,
  };
}

export const COMPARISON_UNAVAILABLE = "لا توجد صفوف إنتاج ومبيعات متقابلة بدليل معرف المنتج والوحدة والتاريخ والفرع. الواردات التاريخية بلا دليل ربط معتمد غير قابلة للمقارنة؛ غياب المصدر ليس صفراً، والفارق ليس هدراً فعلياً. لم تُعدّل بيانات المخزون أو السجلات التاريخية.";

export const COMPARISON_VERSION = "canonical-comparison-v2";
export const COMPARISON_REASON_PREFIX = `{"type":"${COMPARISON_VERSION}"`;

type FrozenSale = { salesDate: string; productName: string; productCategory: string | null;
  quantitySold: number; salesValue: number; productId: number; unit: "piece"; catalogUnit: string;
  sourceProductName: string; sourceProductId: number | null; sourceSku: string | null; sourceUnit: string | null };
export function readUploadMapping(errorMessage: string | null): FrozenSale[] | null {
  if (!errorMessage?.startsWith(SALES_EVIDENCE_PREFIX)) return null;
  try {
    const metadata = JSON.parse(errorMessage.slice(SALES_EVIDENCE_PREFIX.length));
    if (!/^[0-9a-f]{64}$/.test(metadata.fingerprint) ||
        !Array.isArray(metadata.rows) || !metadata.rows.length) return null;
    for (const row of metadata.rows as FrozenSale[]) {
      if (!comparisonDate(row.salesDate) || !row.productName ||
          !Number.isSafeInteger(row.quantitySold) || row.quantitySold < 0 ||
          typeof row.salesValue !== "number" || !Number.isFinite(row.salesValue) ||
          !Number.isSafeInteger(row.productId) || row.productId < 1 ||
          typeof row.sourceProductName !== "string" ||
          (row.sourceProductId !== null && (!Number.isSafeInteger(row.sourceProductId) || row.sourceProductId < 1)) ||
          (row.sourceSku !== null && (typeof row.sourceSku !== "string" || !row.sourceSku.trim())) ||
          (row.sourceUnit !== null && (typeof row.sourceUnit !== "string" || !canonicalPieceUnit(row.sourceUnit))) ||
          row.unit !== "piece" || !canonicalPieceUnit(row.catalogUnit)) return null;
    }
    const fingerprint = comparisonSalesFingerprint(metadata.rows.map((row: FrozenSale) => ({
      salesDate: row.salesDate, productName: row.sourceProductName, productCategory: row.productCategory,
      quantitySold: row.quantitySold, salesValue: row.salesValue,
      sourceProductId: row.sourceProductId, sourceSku: row.sourceSku, sourceUnit: row.sourceUnit,
      sourceLine: 0,
    })));
    if (fingerprint !== metadata.fingerprint) return null;
    return metadata.rows;
  } catch {
    return null;
  }
}

type BatchEvidence = {
  id: number; branchId: string; productionDate: string | null; productId: number | null;
  unit: string | null; quantity: number; productName: string; productCategory: string | null;
};
type SaleEvidence = {
  id: number; branchId: string; salesDate: string; productName: string; productCategory: string | null;
  uploadId: number | null; quantitySold: number | null; salesValue: number | null;
};
type UploadEvidence = { id: number; branchId: string; errorMessage: string | null; status: string | null };
type CatalogEvidence = { id: number; unit: string | null; name: string; sku: string | null; category: string };

export function buildCanonicalComparisons(
  batches: BatchEvidence[], sales: SaleEvidence[], uploads: UploadEvidence[], catalog: CatalogEvidence[],
  startDate?: string, endDate?: string,
) {
  const uploadById = new Map(uploads.filter(u => u.status === "completed").map(u => [u.id, u]));
  const catalogById = new Map(catalog.map(p => [p.id, p]));
  const validFrozenRow = (row: FrozenSale) => {
    const product = catalogById.get(row.productId);
    if (!product || !canonicalPieceUnit(product.unit) ||
        !canonicalPieceUnit(row.catalogUnit) ||
        (row.sourceProductName && row.sourceProductName !== product.name) ||
        (row.sourceProductId !== null && row.sourceProductId !== product.id) ||
        (row.sourceSku !== null && row.sourceSku !== product.sku)) return false;
    const matches = catalog.filter(p => row.sourceProductId !== null ? p.id === row.sourceProductId :
      row.sourceSku !== null ? p.sku === row.sourceSku : p.name === row.sourceProductName);
    return matches.length === 1 && matches[0].id === row.productId;
  };
  const frozenByUpload = new Map<number, Map<string, FrozenSale[]>>();
  const saleKey = (s: Pick<FrozenSale, "salesDate" | "productName" | "productCategory" | "quantitySold" | "salesValue">) =>
    JSON.stringify([s.salesDate, s.productName, s.productCategory, s.quantitySold, Math.fround(s.salesValue)]);
  // Reject the whole upload if persisted rows differ from the frozen multiset.
  for (const upload of uploads) {
    const frozen = readUploadMapping(upload.errorMessage);
    if (!frozen || upload.status !== "completed" || !frozen.every(validFrozenRow)) continue;
    const persisted = sales.filter(s => s.uploadId === upload.id && s.branchId === upload.branchId);
    // For partial date-range runs, the caller must supply all rows of each upload.
    if (persisted.length !== frozen.length) continue;
    const expected = new Map<string, FrozenSale[]>();
    for (const row of frozen) {
      const k = saleKey(row);
      expected.set(k, [...(expected.get(k) ?? []), row]);
    }
    if (persisted.some(s => !expected.get(saleKey({ ...s, quantitySold: s.quantitySold!, salesValue: s.salesValue! }))?.shift())) continue;
    frozenByUpload.set(upload.id, new Map(frozen.map(row => [saleKey(row), frozen.filter(r => saleKey(r) === saleKey(row))])));
  }
  const produced = new Map<string, { quantity: number; batchIds: number[]; product: CatalogEvidence }>();
  const sold = new Map<string, { quantity: number; value: number; saleIds: number[]; uploadIds: number[]; source: "explicit" }>();
  const coverage = { finishedBatches: batches.length, salesRows: sales.length,
    canonicalBatches: 0, unmappedSales: 0, unmatchedProduction: 0, unmatchedSales: 0, comparable: 0 };
  const key = (branch: string, date: string, id: number, unit: string) => JSON.stringify([branch, date, id, unit]);
  for (const b of batches) {
    const product = b.productId === null ? undefined : catalogById.get(b.productId);
    if (!product || !comparisonDate(b.productionDate) || !canonicalPieceUnit(b.unit) || !canonicalPieceUnit(product.unit) ||
        !Number.isSafeInteger(b.quantity) || b.quantity < 0) continue;
    coverage.canonicalBatches++;
    const k = key(b.branchId, b.productionDate, product.id, "piece");
    const item = produced.get(k) ?? { quantity: 0, batchIds: [], product };
    item.quantity += b.quantity;
    item.batchIds.push(b.id);
    produced.set(k, item);
  }
  for (const s of sales) {
    if (startDate && s.salesDate < startDate || endDate && s.salesDate > endDate) continue;
    const upload = s.uploadId === null ? undefined : uploadById.get(s.uploadId);
    const mapping = upload?.branchId === s.branchId ? frozenByUpload.get(upload.id)?.get(saleKey({
      ...s, quantitySold: s.quantitySold!, salesValue: s.salesValue!,
    }))?.shift() : null;
    const product = mapping ? catalogById.get(mapping.productId) : undefined;
    if (!mapping || !product || !canonicalPieceUnit(product.unit) ||
        !Number.isSafeInteger(s.quantitySold) || (s.quantitySold ?? -1) < 0 ||
        typeof s.salesValue !== "number" || !Number.isFinite(s.salesValue)) {
      coverage.unmappedSales++;
      continue;
    }
    const k = key(s.branchId, s.salesDate, product.id, mapping.unit);
    const item = sold.get(k) ?? { quantity: 0, value: 0, saleIds: [], uploadIds: [], source: "explicit" as const };
    item.quantity += s.quantitySold!;
    item.value += s.salesValue;
    item.saleIds.push(s.id);
    item.uploadIds.push(upload!.id);
    sold.set(k, item);
  }
  const rows: Array<Record<string, unknown>> = [];
  for (const [k, production] of produced) {
    const sale = sold.get(k);
    if (!sale) { coverage.unmatchedProduction++; continue; }
    const [branchId, comparisonDate] = JSON.parse(k) as [string, string, number, string];
    const difference = production.quantity - sale.quantity;
    rows.push({
      branchId, comparisonDate, productName: production.product.name,
      productCategory: production.product.category,
      producedQuantity: production.quantity, soldQuantity: sale.quantity,
      difference, differencePercent: production.quantity > 0 ? difference / production.quantity * 100 : null,
      productionValue: null, salesValue: sale.value, valueDifference: null, wasteValue: null,
      status: difference === 0 ? "normal" : "variance",
      statusReason: JSON.stringify({ type: COMPARISON_VERSION, productId: production.product.id,
        unit: "piece", mappingSource: sale.source,
        batchIds: production.batchIds, saleIds: sale.saleIds, uploadIds: [...new Set(sale.uploadIds)] }),
    });
  }
  coverage.unmatchedSales = [...sold.keys()].filter(k => !produced.has(k)).length;
  coverage.comparable = rows.length;
  return { rows, coverage };
}