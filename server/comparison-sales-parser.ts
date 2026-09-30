import { createHash } from "node:crypto";

export class SalesFileValidationError extends Error {}

export type ComparisonSalesRow = {
  salesDate: string;
  productName: string;
  productCategory: string | null;
  quantitySold: number;
  salesValue: number;
  sourceProductId: number | null;
  sourceSku: string | null;
  sourceUnit: string | null;
  sourceLine: number;
};

const keys = {
  date: ["Date", "التاريخ", "تاريخ", "Business Date", "تاريخ العمل", "Order Date", "تاريخ الطلب", "Created Date", "تاريخ الإنشاء", "Day", "اليوم"],
  product: ["Product Name", "اسم المنتج", "product", "المنتج", "Product", "Item Name", "اسم الصنف", "Item", "الصنف", "Name", "الاسم", "SKU Name", "اسم المنتج (SKU)"],
  quantity: ["Quantity", "الكمية", "qty", "كمية", "Qty", "Count", "العدد", "Sold Quantity", "الكمية المباعة", "Total Quantity", "إجمالي الكمية"],
  value: ["Sales Value", "قيمة المبيعات", "value", "القيمة", "Total", "الإجمالي", "Amount", "المبلغ", "Net Sales", "صافي المبيعات", "Gross Sales", "إجمالي المبيعات", "Revenue", "الإيراد", "Sales"],
  category: ["Category", "الفئة", "Product Category", "فئة المنتج", "Menu Category", "فئة القائمة"],
  id: ["Product ID", "product_id", "productId", "معرف المنتج", "رقم المنتج"],
  sku: ["SKU", "Product Code", "product_code", "رمز المنتج", "كود المنتج"],
  unit: ["Unit", "unit", "Unit Name", "وحدة", "الوحدة", "وحدة القياس"],
};

function find(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    const key = Object.keys(row).find(k => k.trim().toLowerCase() === alias.toLowerCase());
    if (key && row[key] !== null && row[key] !== undefined && row[key] !== "") return row[key];
  }
  return undefined;
}

export function validSalesDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseDay(value: unknown): string | null {
  if (validSalesDay(value)) return value;
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 2958465) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
    return validSalesDay(date) ? date : null;
  }
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const n = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseComparisonSalesRows(raw: unknown[], defaultDate: unknown): ComparisonSalesRow[] {
  if (!raw.length) throw new SalesFileValidationError("الملف فارغ أو بتنسيق غير صحيح");
  if (defaultDate !== undefined && defaultDate !== "" && !validSalesDay(defaultDate)) {
    throw new SalesFileValidationError("تاريخ الملف الافتراضي غير صالح");
  }
  const rows: ComparisonSalesRow[] = [];
  const errors: string[] = [];
  for (const [index, input] of raw.entries()) {
    const row = input as Record<string, unknown>;
    const line = index + 2;
    const product = find(row, keys.product);
    const date = parseDay(find(row, keys.date) ?? defaultDate);
    const quantity = numberValue(find(row, keys.quantity));
    const valueRaw = find(row, keys.value);
    const value = valueRaw === undefined ? 0 : numberValue(valueRaw);
    const productName = typeof product === "string" ? product.trim() : "";
    const category = find(row, keys.category);
    const idValue = find(row, keys.id);
    const skuValue = find(row, keys.sku);
    const unitValue = find(row, keys.unit);
    const sourceProductId = idValue === undefined ? null : Number(idValue);
    const sourceSku = skuValue === undefined ? null : String(skuValue).trim();
    const sourceUnit = unitValue === undefined ? null : String(unitValue).trim();
    if (!productName && sourceProductId === null && !sourceSku) errors.push(`صف ${line}: اسم المنتج أو معرفه مطلوب`);
    if (sourceProductId !== null && (!Number.isSafeInteger(sourceProductId) || sourceProductId < 1)) errors.push(`صف ${line}: معرف المنتج غير صالح`);
    if (skuValue !== undefined && !sourceSku) errors.push(`صف ${line}: رمز المنتج غير صالح`);
    if (unitValue !== undefined && !sourceUnit) errors.push(`صف ${line}: وحدة المنتج غير صالحة`);
    if (!date) errors.push(`صف ${line}: التاريخ غير صالح`);
    // Daily comparison records are stored in integer product units; refusing fractions
    // prevents losing them by coercion or rounding until a unit mapping exists.
    if (quantity === null || !Number.isSafeInteger(quantity) || quantity > 2147483647) errors.push(`صف ${line}: الكمية يجب أن تكون عدداً صحيحاً غير سالب (بالقطعة)`);
    if (value === null || value > 3.402823e38) errors.push(`صف ${line}: قيمة المبيعات غير صالحة`);
    if (errors.length > 8) break;
    if ((productName || sourceProductId !== null || sourceSku) && date && quantity !== null && Number.isSafeInteger(quantity) && quantity <= 2147483647 && value !== null && value <= 3.402823e38) {
      rows.push({ salesDate: date, productName, productCategory: category == null ? null : String(category).trim() || null, quantitySold: quantity, salesValue: value, sourceProductId, sourceSku, sourceUnit, sourceLine: line });
    }
  }
  if (errors.length) throw new SalesFileValidationError(`${errors.slice(0, 5).join("؛ ")}${errors.length > 5 ? "؛ توجد أخطاء أخرى" : ""}`);
  return rows;
}

// A multiset, not a set: repeated identical lines remain distinct source rows.
export function comparisonSalesFingerprint(rows: ComparisonSalesRow[]): string {
  const canonical = rows.map(row => JSON.stringify([
    row.salesDate, row.productName, row.productCategory, row.quantitySold, row.salesValue,
    row.sourceProductId, row.sourceSku, row.sourceUnit,
  ])).sort();
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

type CatalogProduct = { id: number; name: string; sku: string | null; unit: string | null };
export type ResolvedSalesRow = ComparisonSalesRow & { productId: number; unit: "piece"; catalogUnit: string; sourceProductName?: string };

const pieceUnits = new Set(["قطعة", "قطعه", "حبة", "حبه", "piece", "pieces", "pc", "pcs"]);
export function canonicalPieceUnit(unit: string | null | undefined): "piece" | null {
  return unit && pieceUnits.has(unit.trim().toLowerCase()) ? "piece" : null;
}

export function resolveComparisonSalesRows(rows: ComparisonSalesRow[], products: CatalogProduct[]): ResolvedSalesRow[] {
  const resolved: ResolvedSalesRow[] = [];
  const errors: string[] = [];
  for (const row of rows) {
    const matches = products.filter(product =>
      row.sourceProductId !== null ? product.id === row.sourceProductId :
        row.sourceSku !== null ? product.sku === row.sourceSku : product.name === row.productName);
    if (matches.length !== 1) {
      errors.push(`صف ${row.sourceLine}: ${matches.length ? "مطابقة المنتج غير فريدة" : "المنتج غير موجود في الكتالوج"}`);
      continue;
    }
    const product = matches[0];
    if (row.sourceSku !== null && product.sku !== row.sourceSku) errors.push(`صف ${row.sourceLine}: رمز المنتج لا يطابق معرفه`);
    if (row.productName && row.productName !== product.name) errors.push(`صف ${row.sourceLine}: الاسم لا يطابق المنتج المحدد`);
    if (!canonicalPieceUnit(product.unit) || (row.sourceUnit !== null && !canonicalPieceUnit(row.sourceUnit))) {
      errors.push(`صف ${row.sourceLine}: وحدة المنتج غير مدعومة؛ يجب أن تكون قطعة`);
    }
    if (errors.length > 8) break;
    if (product.sku === row.sourceSku || row.sourceSku === null) {
      if ((!row.productName || row.productName === product.name) && canonicalPieceUnit(product.unit) &&
          (row.sourceUnit === null || canonicalPieceUnit(row.sourceUnit))) {
        resolved.push({ ...row, sourceProductName: row.productName, productName: product.name,
          productId: product.id, unit: "piece", catalogUnit: product.unit! });
      }
    }
  }
  if (errors.length) throw new SalesFileValidationError(`${errors.slice(0, 5).join("؛ ")}${errors.length > 5 ? "؛ توجد أخطاء أخرى" : ""}`);
  return resolved;
}

export const SALES_EVIDENCE_PREFIX = "sales-evidence:v1:";
export function comparisonSalesMetadata(fingerprint: string, rows: ResolvedSalesRow[]): string {
  // A row-level multiset allows verification against persisted daily_sales_data,
  // including identical duplicate rows, without relying on today's catalogue names.
  const evidenceRows = rows.map(row => ({
    salesDate: row.salesDate, productName: row.productName, productCategory: row.productCategory,
    quantitySold: row.quantitySold, salesValue: row.salesValue,
    sourceProductName: row.sourceProductName ?? row.productName,
    sourceProductId: row.sourceProductId, sourceSku: row.sourceSku, sourceUnit: row.sourceUnit,
    productId: row.productId, unit: row.unit, catalogUnit: row.catalogUnit,
  }));
  evidenceRows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return SALES_EVIDENCE_PREFIX + JSON.stringify({ fingerprint, rows: evidenceRows });
}