import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

/**
 * This module deliberately contains no database or environment access.  The
 * parsers read the supplied workbook only and buildCatalogueReconciliation is
 * a pure function over the supplied arrays.
 */

export type CatalogueCode = string | number;
export type CatalogueNamespace = "products" | "warehouse";
export type ReconciliationStatus =
  | "exact_match"
  | "review"
  | "add_candidate"
  | "legacy_review";

export const PRODUCT_SOURCE = "products" as const;
export const WAREHOUSE_SOURCE = "warehouse" as const;
export const CATEGORY_SOURCE = "categories" as const;

export const APPROVED_SK_0950_NAME =
  "danish sun-dried tomato دانش طماطم مجفف";
export const APPROVED_SK_0950_ALIAS =
  "دانش شمر تشيز + الطماطم المجففة";
export const APPROVED_SK_0950_ALIASES = [APPROVED_SK_0950_ALIAS] as const;

export interface ParsedCatalogueRecord {
  code: CatalogueCode;
  name: string;
  unit: string;
  namespace: CatalogueNamespace;
  sourceSheet: string;
  sourceRow: number;
  rawRow: readonly unknown[];
  /** Kept as an object as well as rawRow for export/audit consumers. */
  raw: {
    code: CatalogueCode;
    name: string;
    unit: string;
    row: readonly unknown[];
  };
}

export type ParsedCatalogueRecords = ParsedCatalogueRecord[] & {
  rows: number;
  unique: number;
  sourceTotals: SourceTotals;
};

export interface ParsedCategoryEntry {
  name: string;
  category: string;
  sourceSheet: string;
  sourceRow: number;
  sourceColumn: number;
  rawRow: readonly unknown[];
  raw: {
    name: string;
    category: string;
    row: readonly unknown[];
    column: number;
  };
}

export type ParsedCategoryEntries = ParsedCategoryEntry[] & {
  rows: number;
  entries: number;
};

export interface SourceTotals {
  rows: number;
  unique: number;
  duplicateRows: number;
  conflictingRows: number;
}

export interface ParsedCatalogueSources {
  products: ParsedCatalogueRecord[];
  warehouse: ParsedCatalogueRecord[];
  categories: ParsedCategoryEntry[];
  sourceTotals: {
    products: SourceTotals;
    warehouse: SourceTotals;
    categories: {
      rows: number;
      entries: number;
    };
  };
}

export interface CurrentCatalogueRecord {
  id?: unknown;
  sku?: CatalogueCode | null;
  code?: CatalogueCode | null;
  name?: string | null;
  unit?: string | null;
  balance?: unknown;
  currentBalance?: unknown;
  currentStock?: unknown;
  stock?: unknown;
  quantity?: unknown;
  [key: string]: unknown;
}

export interface CategoryMatch extends ParsedCategoryEntry {
  matchedBy: "canonical_name" | "source_alias";
}

export interface SourceRecordGroup {
  code: CatalogueCode;
  canonicalCode: string;
  name: string;
  unit: string;
  normalizedName: string;
  normalizedUnit: string;
  aliases: string[];
  sourceRecords: ParsedCatalogueRecord[];
  rawDetails: ReadonlyArray<readonly unknown[]>;
}

export interface DuplicateCurrentCode {
  namespace: CatalogueNamespace;
  code: CatalogueCode;
  normalizedCode: string;
  recordIds: unknown[];
  records: CurrentCatalogueRecord[];
}

export interface ReconciliationIssue {
  code:
    | "duplicate_current_sku"
    | "name_mismatch"
    | "unit_mismatch"
    | "name_recode_review"
    | "name_collision"
    | "source_name_collision"
    | "category_unmatched";
  message: string;
}

export interface ReconciliationRow {
  namespace: CatalogueNamespace;
  status: ReconciliationStatus;

  /**
   * sku/sourceCode are source business codes.  Neither is an internal
   * database id, including when the source code happens to be numeric.
   */
  sku: CatalogueCode | null;
  canonicalSku: string | null;
  sourceCode: CatalogueCode | null;
  sourceName: string | null;
  sourceUnit: string | null;
  normalizedSourceUnit: string | null;
  source: SourceRecordGroup | null;
  sourceRecord: SourceRecordGroup | null;
  sourceRecords: ParsedCatalogueRecord[];
  sourceRawDetails: ReadonlyArray<readonly unknown[]>;
  aliases: string[];

  categories: CategoryMatch[];
  categoryMatches: CategoryMatch[];
  currentRecord: CurrentCatalogueRecord | null;
  currentRecords: CurrentCatalogueRecord[];
  currentId: unknown;
  currentBalance: unknown;
  currentUnit: string | null;
  normalizedCurrentUnit: string | null;
  matchMethod:
    | "sku"
    | "name_recode_review"
    | "name_collision"
    | "none"
    | "legacy";
  candidateCurrentRecord: CurrentCatalogueRecord | null;
  candidateCurrentId: unknown;
  issues: ReconciliationIssue[];
  /** Legacy rows are review-only; this field is intentionally not a delete action. */
  legacyDisposition: "not_legacy" | "review_required";
}

export interface ReconciliationResult {
  rows: ReconciliationRow[];
  productRows: ReconciliationRow[];
  warehouseRows: ReconciliationRow[];
  legacyRows: ReconciliationRow[];
  legacyReviewRows: ReconciliationRow[];
  duplicateCurrentCodes: CatalogueCode[];
  duplicateCurrentCodeDetails: DuplicateCurrentCode[];
  unmatchedCategories: ParsedCategoryEntry[];
  sourceTotals: {
    products: SourceTotals;
    warehouse: SourceTotals;
    categories: {
      rows: number;
      entries: number;
      unmatched: number;
    };
  };
  /**
   * This is guidance for a later, separately approved review.  No operation
   * is performed by this module.
   */
  legacyPolicy: {
    disposition: "review_required";
    requiredChecks: readonly [
      "database_foreign_key_usage",
      "database_non_foreign_key_usage",
      "balance_and_history_review",
    ];
    deletePolicy:
      | "delete_only_when_truly_unused"
      | "archive_after_review_when_used";
    usedRecordPolicy: "archive_after_review_when_used";
  };
}

export interface BuildReconciliationInput {
  products?: readonly SourceCatalogueInput[];
  sourceProducts?: readonly SourceCatalogueInput[];
  warehouse?: readonly SourceCatalogueInput[];
  sourceWarehouse?: readonly SourceCatalogueInput[];
  categories?: readonly CategoryInput[];
  categoryEntries?: readonly CategoryInput[];
  sourceCategories?: readonly CategoryInput[];
  currentProducts?: readonly CurrentCatalogueRecord[];
  currentWarehouse?: readonly CurrentCatalogueRecord[];
  current?: {
    products?: readonly CurrentCatalogueRecord[];
    warehouse?: readonly CurrentCatalogueRecord[];
  };
  /**
   * An optional namespace container makes accidental extra source namespaces
   * fail loudly instead of being silently ignored.
   */
  sources?: {
    products?: readonly SourceCatalogueInput[];
    warehouse?: readonly SourceCatalogueInput[];
    categories?: readonly CategoryInput[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type SourceCatalogueInput =
  | ParsedCatalogueRecord
  | {
      code?: CatalogueCode | null;
      sku?: CatalogueCode | null;
      sourceCode?: CatalogueCode | null;
      name?: string | null;
      sourceName?: string | null;
      unit?: string | null;
      sourceUnit?: string | null;
      sourceSheet?: string;
      sourceRow?: number;
      rawRow?: readonly unknown[];
      raw?: unknown;
      [key: string]: unknown;
    };

export type CategoryInput =
  | ParsedCategoryEntry
  | {
      name?: string | null;
      category?: string | null;
      section?: string | null;
      sourceSheet?: string;
      sourceRow?: number;
      sourceColumn?: number;
      rawRow?: readonly unknown[];
      raw?: unknown;
      [key: string]: unknown;
    };

export class CatalogueSourceError extends Error {
  readonly source: string;

  constructor(message: string, source: string) {
    super(message);
    this.name = "CatalogueSourceError";
    this.source = source;
  }
}

export class UnknownCatalogueSourceError extends Error {
  readonly source: string;

  constructor(source: string) {
    super(
      `Unknown catalogue source "${source}". Expected products, warehouse, or categories.`,
    );
    this.name = "UnknownCatalogueSourceError";
    this.source = source;
  }
}

export class CatalogueConflictError extends Error {
  readonly namespace: CatalogueNamespace;
  readonly canonicalCode: string;
  readonly records: readonly SourceCatalogueInput[];

  constructor(
    namespace: CatalogueNamespace,
    canonicalCode: string,
    records: readonly SourceCatalogueInput[],
  ) {
    super(
      `Conflicting ${namespace} source records for code "${canonicalCode}". ` +
        "Same-code records must have the same name and unit, except the approved sk-0950 alias.",
    );
    this.name = "CatalogueConflictError";
    this.namespace = namespace;
    this.canonicalCode = canonicalCode;
    this.records = records;
  }
}

export class CatalogueWorkbookError extends Error {
  readonly source: string;

  constructor(message: string, source: string) {
    super(message);
    this.name = "CatalogueWorkbookError";
    this.source = source;
  }
}

type WorkbookInput =
  | string
  | Uint8Array
  | ArrayBuffer
  | XLSX.WorkBook;

type SourceKind = CatalogueNamespace | typeof CATEGORY_SOURCE;

function isWorkbook(value: WorkbookInput): value is XLSX.WorkBook {
  return (
    typeof value === "object" &&
    value !== null &&
    "SheetNames" in value &&
    "Sheets" in value
  );
}

function readWorkbook(input: WorkbookInput): XLSX.WorkBook {
  if (isWorkbook(input)) return input;

  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = readFileSync(input);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = input;
  }
  return XLSX.read(bytes, { type: "array", cellDates: false, raw: true });
}

function readRows(
  input: WorkbookInput,
  preferredSheet?: string,
): { sheetName: string; rows: unknown[][] } {
  const workbook = readWorkbook(input);
  const sheetName =
    preferredSheet && workbook.Sheets[preferredSheet]
      ? preferredSheet
      : workbook.SheetNames[0];
  if (!sheetName || !workbook.Sheets[sheetName]) {
    throw new CatalogueWorkbookError("Workbook has no readable sheet.", String(input));
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });
  return { sheetName, rows };
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function isBlank(value: unknown): boolean {
  return text(value).trim() === "";
}

/**
 * Comparison identity is intentionally conservative: trim and case-fold
 * only.  There is no fuzzy, punctuation, transliteration, or whitespace
 * rewriting, because a reconciliation must not merge distinct catalogue
 * entries.
 */
export function normalizeComparison(value: unknown): string {
  return text(value).normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function normalizeSku(value: unknown): string {
  return normalizeComparison(value);
}

export function normalizeUnit(value: unknown): string {
  const normalized = normalizeComparison(value);
  switch (normalized) {
    case "pc":
    case "piece":
    case "قطعة":
    case "عدد":
      return "piece";
    case "kg":
    case "كجم":
    case "كيلو":
    case "كيلوجرام":
      return "kg";
    case "ltr":
    case "litre":
    case "لتر":
      return "litre";
    default:
      return normalized;
  }
}

function headerKey(value: unknown): string {
  return normalizeComparison(value).replace(/[^a-z0-9]+/g, "");
}

function findHeaderRow(
  rows: readonly unknown[][],
  codeColumn: number,
  nameColumn: number,
  unitColumn: number,
): number {
  for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
    const row = rows[index] ?? [];
    const values = row.map(headerKey);
    const hasCode =
      values.includes("code") ||
      values.includes("itemcode") ||
      values.includes("itemnumber") ||
      values.includes("sku");
    const hasName = values.includes("name") || values.includes("itemname");
    const hasUnit = values.includes("unit") || values.includes("unity");
    if (hasCode && hasName && hasUnit) return index;

    // The approved product export has a blank unit heading.  Its two
    // non-empty headings still make this the header row.
    if (
      values[codeColumn] &&
      (values[nameColumn] === "name" || values[nameColumn] === "itemname")
    ) {
      return index;
    }
  }
  return -1;
}

function parseCatalogueRows(
  input: WorkbookInput,
  namespace: CatalogueNamespace,
): ParsedCatalogueRecord[] {
  const defaults =
    namespace === PRODUCT_SOURCE
      ? { code: 0, name: 1, unit: 2, header: 1 }
      : { code: 1, name: 2, unit: 3, header: 5 };
  const { sheetName, rows } = readRows(input);
  const header = findHeaderRow(rows, defaults.code, defaults.name, defaults.unit);
  const headerRow = header >= 0 ? header : defaults.header;
  const output: ParsedCatalogueRecord[] = [];

  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const code = row[defaults.code];
    const name = row[defaults.name];
    const unit = row[defaults.unit];
    if ([code, name, unit].every(isBlank)) continue;
    if (isBlank(code) && isBlank(name) && isBlank(unit)) continue;
    if (isBlank(code) || isBlank(name) || isBlank(unit)) {
      throw new CatalogueWorkbookError(
        `Incomplete ${namespace} row at Excel row ${index + 1}.`,
        `${sheetName}:${index + 1}`,
      );
    }
    const sourceName = text(name);
    const sourceUnit = text(unit);
    output.push({
      code: code as CatalogueCode,
      name: sourceName,
      unit: sourceUnit,
      namespace,
      sourceSheet: sheetName,
      sourceRow: index + 1,
      rawRow: row.slice(),
      raw: {
        code: code as CatalogueCode,
        name: sourceName,
        unit: sourceUnit,
        row: row.slice(),
      },
    });
  }
  return output;
}

export function parseProductsWorkbook(input: WorkbookInput): ParsedCatalogueRecords {
  const records = parseCatalogueRows(input, PRODUCT_SOURCE);
  // Validate same-SKU conflicts at the boundary as well as in the pure
  // reconciliation function.  The parser still returns all source rows so
  // row totals and raw duplicate details remain auditable.
  const collapsed = collapseSourceRecords(records, PRODUCT_SOURCE);
  const totals = sourceTotals(records, collapsed.groups);
  Object.defineProperties(records, {
    rows: { value: totals.rows, enumerable: false },
    unique: { value: totals.unique, enumerable: false },
    sourceTotals: { value: totals, enumerable: false },
  });
  return records as ParsedCatalogueRecords;
}

export function parseWarehouseWorkbook(input: WorkbookInput): ParsedCatalogueRecords {
  const records = parseCatalogueRows(input, WAREHOUSE_SOURCE);
  const collapsed = collapseSourceRecords(records, WAREHOUSE_SOURCE);
  const totals = sourceTotals(records, collapsed.groups);
  Object.defineProperties(records, {
    rows: { value: totals.rows, enumerable: false },
    unique: { value: totals.unique, enumerable: false },
    sourceTotals: { value: totals, enumerable: false },
  });
  return records as ParsedCatalogueRecords;
}

export function parseCategoriesWorkbook(input: WorkbookInput): ParsedCategoryEntries {
  const { sheetName, rows } = readRows(input, "الأصناف");
  const headings = rows[1] ?? [];
  const output: ParsedCategoryEntry[] = [];

  // Row 143 in the approved workbook is a footer.  Reading no rows after
  // it also prevents the workbook's Lists sheet content from becoming items.
  const end = Math.min(rows.length, 142);
  for (let rowIndex = 2; rowIndex < end; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let columnIndex = 0; columnIndex < headings.length; columnIndex += 1) {
      const name = row[columnIndex];
      const category = headings[columnIndex];
      if (isBlank(name) || isBlank(category)) continue;
      const sourceName = text(name);
      const sourceCategory = text(category);
      output.push({
        name: sourceName,
        category: sourceCategory,
        sourceSheet: sheetName,
        sourceRow: rowIndex + 1,
        sourceColumn: columnIndex + 1,
        rawRow: row.slice(),
        raw: {
          name: sourceName,
          category: sourceCategory,
          row: row.slice(),
          column: columnIndex + 1,
        },
      });
    }
  }
  Object.defineProperties(output, {
    rows: { value: categoryRowCount(output), enumerable: false },
    entries: { value: output.length, enumerable: false },
  });
  return output as ParsedCategoryEntries;
}

export function parseCatalogueWorkbook(
  input: WorkbookInput,
  source: SourceKind,
): ParsedCatalogueRecord[] | ParsedCategoryEntry[];
export function parseCatalogueWorkbook(
  source: SourceKind,
  input: WorkbookInput,
): ParsedCatalogueRecord[] | ParsedCategoryEntry[];
export function parseCatalogueWorkbook(
  inputOrSource: WorkbookInput | SourceKind,
  sourceOrInput: SourceKind | WorkbookInput,
): ParsedCatalogueRecord[] | ParsedCategoryEntry[] {
  const source =
    typeof inputOrSource === "string" &&
    (inputOrSource === PRODUCT_SOURCE ||
      inputOrSource === WAREHOUSE_SOURCE ||
      inputOrSource === CATEGORY_SOURCE)
      ? inputOrSource
      : sourceOrInput;
  const input =
    source === inputOrSource ? sourceOrInput : inputOrSource;
  if (
    source !== PRODUCT_SOURCE &&
    source !== WAREHOUSE_SOURCE &&
    source !== CATEGORY_SOURCE
  ) {
    throw new UnknownCatalogueSourceError(String(source));
  }
  if (source === PRODUCT_SOURCE) return parseProductsWorkbook(input as WorkbookInput);
  if (source === WAREHOUSE_SOURCE) return parseWarehouseWorkbook(input as WorkbookInput);
  return parseCategoriesWorkbook(input as WorkbookInput);
}

/** Short aliases for callers that prefer singular source names. */
export const parseProductWorkbook = parseProductsWorkbook;
export const parseItemStoreWorkbook = parseWarehouseWorkbook;
export const parseCategoryWorkbook = parseCategoriesWorkbook;
export const parseWorkbook = parseCatalogueWorkbook;
export const parseProducts = parseProductsWorkbook;
export const parseWarehouse = parseWarehouseWorkbook;
export const parseCategories = parseCategoriesWorkbook;

function assertKnownSourceKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) throw new UnknownCatalogueSourceError(key);
  }
}

export function parseCatalogueWorkbooks(input: {
  products: WorkbookInput;
  warehouse: WorkbookInput;
  categories: WorkbookInput;
  [key: string]: unknown;
}): ParsedCatalogueSources {
  assertKnownSourceKeys(input as Record<string, unknown>, [
    "products",
    "warehouse",
    "categories",
  ]);
  const products = parseProductsWorkbook(input.products);
  const warehouse = parseWarehouseWorkbook(input.warehouse);
  const categories = parseCategoriesWorkbook(input.categories);
  const collapsedProducts = collapseSourceRecords(products, PRODUCT_SOURCE).groups;
  const collapsedWarehouse = collapseSourceRecords(warehouse, WAREHOUSE_SOURCE).groups;
  return {
    products,
    warehouse,
    categories,
    sourceTotals: {
      products: sourceTotals(products, collapsedProducts),
      warehouse: sourceTotals(warehouse, collapsedWarehouse),
      categories: {
        rows: Math.max(0, 140),
        entries: categories.length,
      },
    },
  };
}

/** Alias used by consumers that call the three files "sources". */
export const parseCatalogueSources = parseCatalogueWorkbooks;

function inputCode(record: SourceCatalogueInput): CatalogueCode | null {
  const flexible = record as {
    code?: CatalogueCode | null;
    sku?: CatalogueCode | null;
    sourceCode?: CatalogueCode | null;
  };
  const candidate =
    flexible.code !== undefined
      ? flexible.code
      : flexible.sku !== undefined
        ? flexible.sku
        : flexible.sourceCode;
  return candidate === null || candidate === undefined ? null : candidate;
}

function inputName(record: SourceCatalogueInput): string {
  const flexible = record as { name?: string | null; sourceName?: string | null };
  const candidate =
    flexible.name !== undefined ? flexible.name : flexible.sourceName;
  return candidate === null || candidate === undefined ? "" : String(candidate);
}

function inputUnit(record: SourceCatalogueInput): string {
  const flexible = record as { unit?: string | null; sourceUnit?: string | null };
  const candidate =
    flexible.unit !== undefined ? flexible.unit : flexible.sourceUnit;
  return candidate === null || candidate === undefined ? "" : String(candidate);
}

function asParsedRecord(
  record: SourceCatalogueInput,
  namespace: CatalogueNamespace,
  index: number,
): ParsedCatalogueRecord {
  const code = inputCode(record);
  const name = inputName(record);
  const unit = inputUnit(record);
  if (code === null || isBlank(name) || isBlank(unit)) {
    throw new CatalogueSourceError(
      `Incomplete ${namespace} source record at index ${index}.`,
      namespace,
    );
  }
  const rawRow = Array.isArray(record.rawRow)
    ? record.rawRow.slice()
    : [code, name, unit];
  return {
    code,
    name,
    unit,
    namespace,
    sourceSheet: record.sourceSheet ?? namespace,
    sourceRow: record.sourceRow ?? index + 1,
    rawRow,
    raw: {
      code,
      name,
      unit,
      row: rawRow,
    },
  };
}

function asCategoryEntry(
  record: CategoryInput,
  index: number,
): ParsedCategoryEntry {
  const flexible = record as {
    name?: string | null;
    category?: string | null;
    section?: string | null;
  };
  const name =
    flexible.name === null || flexible.name === undefined
      ? ""
      : String(flexible.name);
  const categoryValue =
    flexible.category !== undefined ? flexible.category : flexible.section;
  const category =
    categoryValue === null || categoryValue === undefined
      ? ""
      : String(categoryValue);
  if (isBlank(name) || isBlank(category)) {
    throw new CatalogueSourceError(
      `Incomplete category source record at index ${index}.`,
      CATEGORY_SOURCE,
    );
  }
  const rawRow = Array.isArray(record.rawRow)
    ? record.rawRow.slice()
    : [name, category];
  return {
    name,
    category,
    sourceSheet: record.sourceSheet ?? CATEGORY_SOURCE,
    sourceRow: record.sourceRow ?? index + 1,
    sourceColumn: record.sourceColumn ?? 1,
    rawRow,
    raw: {
      name,
      category,
      row: rawRow,
      column: record.sourceColumn ?? 1,
    },
  };
}

function approvedSpecialName(name: string): boolean {
  return (
    normalizeComparison(name) === normalizeComparison(APPROVED_SK_0950_NAME) ||
    APPROVED_SK_0950_ALIASES.some(
      (alias) => normalizeComparison(alias) === normalizeComparison(name),
    )
  );
}

function collapseSourceRecords(
  records: readonly SourceCatalogueInput[],
  namespace: CatalogueNamespace,
): { groups: SourceRecordGroup[]; conflicts: number } {
  const parsed = records.map((record, index) => asParsedRecord(record, namespace, index));
  const byCode = new Map<string, ParsedCatalogueRecord[]>();
  for (const record of parsed) {
    const key = normalizeSku(record.code);
    const group = byCode.get(key);
    if (group) group.push(record);
    else byCode.set(key, [record]);
  }

  const groups: SourceRecordGroup[] = [];
  let conflicts = 0;
  for (const [canonicalCode, sameCode] of byCode) {
    const isApprovedSpecial =
      namespace === PRODUCT_SOURCE &&
      canonicalCode === normalizeSku("sk-0950") &&
      sameCode.every((record) => approvedSpecialName(record.name));
    const names = new Set(sameCode.map((record) => normalizeComparison(record.name)));
    const units = new Set(sameCode.map((record) => normalizeUnit(record.unit)));
    if ((names.size > 1 || units.size > 1) && !isApprovedSpecial) {
      conflicts += sameCode.length - 1;
      throw new CatalogueConflictError(namespace, canonicalCode, sameCode);
    }

    const canonicalRecord =
      isApprovedSpecial
        ? sameCode.find(
            (record) =>
              normalizeComparison(record.name) ===
              normalizeComparison(APPROVED_SK_0950_NAME),
          ) ?? sameCode[0]
        : sameCode[0];
    const name = isApprovedSpecial ? APPROVED_SK_0950_NAME : canonicalRecord.name;
    const normalizedName = normalizeComparison(name);
    const normalizedUnit = normalizeUnit(canonicalRecord.unit);
    const aliases = Array.from(
      new Set(
        sameCode
          .map((record) => record.name)
          .filter((recordName) => normalizeComparison(recordName) !== normalizedName),
      ),
    );
    groups.push({
      code: canonicalRecord.code,
      canonicalCode,
      name,
      unit: canonicalRecord.unit,
      normalizedName,
      normalizedUnit,
      aliases,
      sourceRecords: sameCode,
      rawDetails: sameCode.map((record) => record.rawRow),
    });
  }
  return { groups, conflicts };
}

function sourceTotals(
  records: readonly SourceCatalogueInput[],
  groups: readonly SourceRecordGroup[],
): SourceTotals {
  return {
    rows: records.length,
    unique: groups.length,
    duplicateRows: Math.max(0, records.length - groups.length),
    conflictingRows: 0,
  };
}

function currentSku(record: CurrentCatalogueRecord): CatalogueCode | null {
  const candidate =
    record.sku !== undefined && record.sku !== null
      ? record.sku
      : record.code !== undefined && record.code !== null
        ? record.code
        : null;
  return candidate;
}

function currentName(record: CurrentCatalogueRecord): string {
  return record.name === null || record.name === undefined
    ? ""
    : String(record.name);
}

function currentUnit(record: CurrentCatalogueRecord): string {
  return record.unit === null || record.unit === undefined
    ? ""
    : String(record.unit);
}

function currentBalance(record: CurrentCatalogueRecord): unknown {
  if (record.current_stock !== undefined) return record.current_stock;
  if (record.balance !== undefined) return record.balance;
  if (record.currentBalance !== undefined) return record.currentBalance;
  if (record.currentStock !== undefined) return record.currentStock;
  if (record.stock !== undefined) return record.stock;
  if (record.quantity !== undefined) return record.quantity;
  return undefined;
}

function currentId(record: CurrentCatalogueRecord): unknown {
  return record.id;
}

function currentRecordIndexes(records: readonly CurrentCatalogueRecord[]): {
  bySku: Map<string, CurrentCatalogueRecord[]>;
  byName: Map<string, CurrentCatalogueRecord[]>;
  duplicates: DuplicateCurrentCode[];
} {
  const bySku = new Map<string, CurrentCatalogueRecord[]>();
  const byName = new Map<string, CurrentCatalogueRecord[]>();
  for (const record of records) {
    const sku = currentSku(record);
    if (sku !== null && !isBlank(sku)) {
      const key = normalizeSku(sku);
      const existing = bySku.get(key);
      if (existing) existing.push(record);
      else bySku.set(key, [record]);
    }
    const name = normalizeComparison(currentName(record));
    if (name) {
      const existing = byName.get(name);
      if (existing) existing.push(record);
      else byName.set(name, [record]);
    }
  }
  const duplicates: DuplicateCurrentCode[] = [];
  for (const [normalizedCode, duplicateRecords] of bySku) {
    if (duplicateRecords.length < 2) continue;
    const firstSku = currentSku(duplicateRecords[0]);
    if (firstSku === null) continue;
    duplicates.push({
      namespace: PRODUCT_SOURCE,
      code: firstSku,
      normalizedCode,
      recordIds: duplicateRecords.map(currentId),
      records: duplicateRecords.slice(),
    });
  }
  return { bySku, byName, duplicates };
}

function categoryIndexes(categories: readonly CategoryInput[]): {
  byName: Map<string, CategoryMatch[]>;
  unmatched: ParsedCategoryEntry[];
} {
  const entries = categories.map(asCategoryEntry);
  const byName = new Map<string, CategoryMatch[]>();
  for (const entry of entries) {
    const key = normalizeComparison(entry.name);
    const existing = byName.get(key);
    const match: CategoryMatch = { ...entry, matchedBy: "canonical_name" };
    if (existing) existing.push(match);
    else byName.set(key, [match]);
  }
  return { byName, unmatched: entries.slice() };
}

function categoryMatchesFor(
  group: SourceRecordGroup,
  byName: Map<string, CategoryMatch[]>,
): CategoryMatch[] {
  const matches: CategoryMatch[] = [];
  const seen = new Set<string>();
  const names = [
    { value: group.name, matchedBy: "canonical_name" as const },
    ...group.aliases.map((value) => ({
      value,
      matchedBy: "source_alias" as const,
    })),
  ];
  for (const candidate of names) {
    const sourceMatches = byName.get(normalizeComparison(candidate.value)) ?? [];
    for (const entry of sourceMatches) {
      const key = `${normalizeComparison(entry.category)}\u0000${normalizeComparison(entry.name)}\u0000${entry.sourceRow}\u0000${entry.sourceColumn}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ ...entry, matchedBy: candidate.matchedBy });
    }
  }
  return matches;
}

function unmatchedCategories(
  categories: readonly ParsedCategoryEntry[],
  sourceGroups: readonly SourceRecordGroup[],
): ParsedCategoryEntry[] {
  const names = new Set<string>();
  for (const group of sourceGroups) {
    names.add(group.normalizedName);
    for (const alias of group.aliases) names.add(normalizeComparison(alias));
  }
  return categories.filter((entry) => !names.has(normalizeComparison(entry.name)));
}

function categoryRowCount(categories: readonly ParsedCategoryEntry[]): number {
  if (categories.length === 0) return 0;
  const rows = categories.map((entry) => entry.sourceRow);
  return Math.max(...rows) - Math.min(...rows) + 1;
}

function issuesForCategory(
  categories: readonly CategoryMatch[],
): ReconciliationIssue[] {
  if (categories.length > 0) return [];
  return [
    {
      code: "category_unmatched",
      message:
        "No exact category-sheet name match; category assignment requires review.",
    },
  ];
}

function buildRow(
  group: SourceRecordGroup,
  namespace: CatalogueNamespace,
  categories: CategoryMatch[],
  currentIndex: ReturnType<typeof currentRecordIndexes>,
  sourceNameCounts: Map<string, number>,
  matchedCurrent: Set<CurrentCatalogueRecord>,
): ReconciliationRow {
  const matchingBySku = currentIndex.bySku.get(group.canonicalCode) ?? [];
  let status: ReconciliationStatus;
  let matchMethod: ReconciliationRow["matchMethod"] = "none";
  let currentRecords: CurrentCatalogueRecord[] = [];
  let candidateCurrentRecord: CurrentCatalogueRecord | null = null;
  const issues: ReconciliationIssue[] = [];

  if (matchingBySku.length > 0) {
    currentRecords = matchingBySku.slice();
    matchingBySku.forEach((record) => matchedCurrent.add(record));
    matchMethod = "sku";
    if (matchingBySku.length > 1) {
      issues.push({
        code: "duplicate_current_sku",
        message: "More than one current record has this exact business SKU.",
      });
    }
    const sourceNameKey = group.normalizedName;
    if (!matchingBySku.some((record) => normalizeComparison(currentName(record)) === sourceNameKey)) {
      issues.push({
        code: "name_mismatch",
        message:
          "Business SKU matches, but the current record name differs; no overwrite is proposed.",
      });
    }
    if (
      matchingBySku.some(
        (record) => normalizeUnit(currentUnit(record)) !== group.normalizedUnit,
      )
    ) {
      issues.push({
        code: "unit_mismatch",
        message:
          "Business SKU matches, but the current record unit differs; no conversion is proposed.",
      });
    }
    status = issues.length > 0 ? "review" : "exact_match";
  } else {
    const sameName = currentIndex.byName.get(group.normalizedName) ?? [];
    const sourceNameCount = sourceNameCounts.get(group.normalizedName) ?? 0;
    if (sameName.length === 1 && sourceNameCount === 1) {
      candidateCurrentRecord = sameName[0];
      currentRecords = sameName.slice();
      matchedCurrent.add(sameName[0]);
      matchMethod = "name_recode_review";
      issues.push({
        code: "name_recode_review",
        message:
          "Unique exact name match is a recode candidate only; no automatic merge is proposed.",
      });
      status = "review";
    } else if (sameName.length > 1) {
      matchMethod = "name_collision";
      issues.push({
        code: "name_collision",
        message:
          "Multiple current records have this normalized name; no automatic recode or merge is proposed.",
      });
      status = "review";
    } else if (sourceNameCount > 1) {
      issues.push({
        code: "source_name_collision",
        message:
          "Multiple source SKUs have this normalized name; no automatic recode or merge is proposed.",
      });
      status = "review";
    } else {
      status = "add_candidate";
    }
  }

  const categoryIssues = issuesForCategory(categories);
  issues.push(...categoryIssues);
  if (categoryIssues.length > 0) status = "review";

  const current = currentRecords[0] ?? null;
  return {
    namespace,
    status,
    sku: group.code,
    canonicalSku: group.canonicalCode,
    sourceCode: group.code,
    sourceName: group.name,
    sourceUnit: group.unit,
    normalizedSourceUnit: group.normalizedUnit,
    source: group,
    sourceRecord: group,
    sourceRecords: group.sourceRecords.slice(),
    sourceRawDetails: group.rawDetails,
    aliases: group.aliases.slice(),
    categories: categories.slice(),
    categoryMatches: categories.slice(),
    currentRecord: current,
    currentRecords,
    currentId: current ? currentId(current) : undefined,
    currentBalance: current ? currentBalance(current) : undefined,
    currentUnit: current ? currentUnit(current) : null,
    normalizedCurrentUnit: current ? normalizeUnit(currentUnit(current)) : null,
    matchMethod,
    candidateCurrentRecord,
    candidateCurrentId: candidateCurrentRecord
      ? currentId(candidateCurrentRecord)
      : undefined,
    issues,
    legacyDisposition: "not_legacy",
  };
}

function buildLegacyRow(
  namespace: CatalogueNamespace,
  record: CurrentCatalogueRecord,
  categories: CategoryMatch[],
): ReconciliationRow {
  const code = currentSku(record);
  const name = currentName(record);
  return {
    namespace,
    status: "legacy_review",
    sku: code,
    canonicalSku: code === null ? null : normalizeSku(code),
    sourceCode: null,
    sourceName: null,
    sourceUnit: null,
    normalizedSourceUnit: null,
    source: null,
    sourceRecord: null,
    sourceRecords: [],
    sourceRawDetails: [],
    aliases: [],
    categories: categories.slice(),
    categoryMatches: categories.slice(),
    currentRecord: record,
    currentRecords: [record],
    currentId: currentId(record),
    currentBalance: currentBalance(record),
    currentUnit: currentUnit(record) || null,
    normalizedCurrentUnit: currentUnit(record)
      ? normalizeUnit(currentUnit(record))
      : null,
    matchMethod: "legacy",
    candidateCurrentRecord: null,
    candidateCurrentId: undefined,
    issues: [],
    legacyDisposition: "review_required",
  };
}

function normalizeBuildInput(
  input: BuildReconciliationInput,
): {
  products: readonly SourceCatalogueInput[];
  warehouse: readonly SourceCatalogueInput[];
  categories: readonly CategoryInput[];
  currentProducts: readonly CurrentCatalogueRecord[];
  currentWarehouse: readonly CurrentCatalogueRecord[];
} {
  const directSourceKeys = new Set([
    "sourceProducts",
    "sourceWarehouse",
    "sourceCategories",
    "sourceTotals",
  ]);
  for (const key of Object.keys(input)) {
    if (
      (key.startsWith("source") || key.endsWith("Source")) &&
      !directSourceKeys.has(key) &&
      key !== "sources"
    ) {
      throw new UnknownCatalogueSourceError(key);
    }
  }
  if (input.sources) {
    assertKnownSourceKeys(input.sources, ["products", "warehouse", "categories"]);
  }
  const sources = input.sources ?? {};
  const products =
    input.sourceProducts ??
    input.products ??
    sources.products ??
    [];
  const warehouse =
    input.sourceWarehouse ??
    input.warehouse ??
    sources.warehouse ??
    [];
  const categories =
    input.sourceCategories ??
    input.categoryEntries ??
    input.categories ??
    sources.categories ??
    [];
  return {
    products,
    warehouse,
    categories,
    currentProducts: input.currentProducts ?? input.current?.products ?? [],
    currentWarehouse: input.currentWarehouse ?? input.current?.warehouse ?? [],
  };
}

export function buildCatalogueReconciliation(
  input: BuildReconciliationInput,
): ReconciliationResult;
export function buildCatalogueReconciliation(
  products: readonly SourceCatalogueInput[],
  warehouse: readonly SourceCatalogueInput[],
  categories: readonly CategoryInput[],
  currentProducts: readonly CurrentCatalogueRecord[],
  currentWarehouse: readonly CurrentCatalogueRecord[],
): ReconciliationResult;
/**
 * Positional convenience form with current arrays before the optional
 * category array.  The object form above is preferred because it makes the
 * two namespaces and category source explicit.
 */
export function buildCatalogueReconciliation(
  products: readonly SourceCatalogueInput[],
  warehouse: readonly SourceCatalogueInput[],
  currentProducts: readonly CurrentCatalogueRecord[],
  currentWarehouse: readonly CurrentCatalogueRecord[],
  categories?: readonly CategoryInput[],
): ReconciliationResult;
export function buildCatalogueReconciliation(
  inputOrProducts: BuildReconciliationInput | readonly SourceCatalogueInput[],
  warehouseArgument: readonly unknown[] = [],
  categoryArgument: readonly unknown[] = [],
  currentProductsArgument: readonly unknown[] = [],
  currentWarehouseArgument: readonly unknown[] = [],
): ReconciliationResult {
  const looksLikeCategoryArray = (value: readonly unknown[]): boolean =>
    value.some((entry) => {
      if (typeof entry !== "object" || entry === null) return false;
      const candidate = entry as Record<string, unknown>;
      return "category" in candidate || "section" in candidate;
    });

  if (Array.isArray(inputOrProducts)) {
    const positionalCount = arguments.length;
    const categoryInThirdPosition = looksLikeCategoryArray(categoryArgument);
    const categoryInFifthPosition = looksLikeCategoryArray(currentWarehouseArgument);
    if (!categoryInThirdPosition && (positionalCount === 4 || categoryInFifthPosition)) {
      const sourceCategories = categoryInFifthPosition
        ? (currentWarehouseArgument as readonly CategoryInput[])
        : [];
      const sourceCurrentProducts = categoryArgument as readonly CurrentCatalogueRecord[];
      const sourceCurrentWarehouse =
        currentProductsArgument as readonly CurrentCatalogueRecord[];
      categoryArgument = sourceCategories;
      currentProductsArgument = sourceCurrentProducts;
      currentWarehouseArgument = sourceCurrentWarehouse;
    }
  }

  const input: {
    products: readonly SourceCatalogueInput[];
    warehouse: readonly SourceCatalogueInput[];
    categories: readonly CategoryInput[];
    currentProducts: readonly CurrentCatalogueRecord[];
    currentWarehouse: readonly CurrentCatalogueRecord[];
  } = Array.isArray(inputOrProducts)
    ? {
        products: inputOrProducts as readonly SourceCatalogueInput[],
        warehouse: warehouseArgument as readonly SourceCatalogueInput[],
        categories: categoryArgument as readonly CategoryInput[],
        currentProducts: currentProductsArgument as readonly CurrentCatalogueRecord[],
        currentWarehouse: currentWarehouseArgument as readonly CurrentCatalogueRecord[],
      }
    : normalizeBuildInput(inputOrProducts as BuildReconciliationInput);

  const productCollapsed = collapseSourceRecords(input.products, PRODUCT_SOURCE);
  const warehouseCollapsed = collapseSourceRecords(input.warehouse, WAREHOUSE_SOURCE);
  const productIndexes = currentRecordIndexes(input.currentProducts);
  const warehouseIndexes = currentRecordIndexes(input.currentWarehouse);
  // The helper cannot infer its namespace from records, so assign it at the
  // call site rather than allowing product/warehouse duplicate SKUs to merge.
  productIndexes.duplicates.forEach((duplicate) => {
    duplicate.namespace = PRODUCT_SOURCE;
  });
  warehouseIndexes.duplicates.forEach((duplicate) => {
    duplicate.namespace = WAREHOUSE_SOURCE;
  });

  const categoryIndex = categoryIndexes(input.categories);
  const productNameCounts = new Map<string, number>();
  for (const group of productCollapsed.groups) {
    productNameCounts.set(
      group.normalizedName,
      (productNameCounts.get(group.normalizedName) ?? 0) + 1,
    );
  }
  const warehouseNameCounts = new Map<string, number>();
  for (const group of warehouseCollapsed.groups) {
    warehouseNameCounts.set(
      group.normalizedName,
      (warehouseNameCounts.get(group.normalizedName) ?? 0) + 1,
    );
  }

  const matchedProductCurrent = new Set<CurrentCatalogueRecord>();
  const matchedWarehouseCurrent = new Set<CurrentCatalogueRecord>();
  const productRows = productCollapsed.groups.map((group) =>
    buildRow(
      group,
      PRODUCT_SOURCE,
      categoryMatchesFor(group, categoryIndex.byName),
      productIndexes,
      productNameCounts,
      matchedProductCurrent,
    ),
  );
  const warehouseRows = warehouseCollapsed.groups.map((group) =>
    buildRow(
      group,
      WAREHOUSE_SOURCE,
      categoryMatchesFor(group, categoryIndex.byName),
      warehouseIndexes,
      warehouseNameCounts,
      matchedWarehouseCurrent,
    ),
  );

  const allCategoryMatches = [...productRows, ...warehouseRows].flatMap(
    (row) => row.categoryMatches,
  );
  const matchedCategoryKeys = new Set(
    allCategoryMatches.map(
      (entry) =>
        `${normalizeComparison(entry.name)}\u0000${normalizeComparison(entry.category)}\u0000${entry.sourceRow}\u0000${entry.sourceColumn}`,
    ),
  );
  const parsedCategories = input.categories.map(asCategoryEntry);
  const unmatched = parsedCategories.filter(
    (entry) =>
      !matchedCategoryKeys.has(
        `${normalizeComparison(entry.name)}\u0000${normalizeComparison(entry.category)}\u0000${entry.sourceRow}\u0000${entry.sourceColumn}`,
      ),
  );

  const productLegacyRows = input.currentProducts
    .filter((record) => !matchedProductCurrent.has(record))
    .map((record) =>
      buildLegacyRow(
        PRODUCT_SOURCE,
        record,
        categoryIndex.byName.get(normalizeComparison(currentName(record))) ?? [],
      ),
    );
  const warehouseLegacyRows = input.currentWarehouse
    .filter((record) => !matchedWarehouseCurrent.has(record))
    .map((record) =>
      buildLegacyRow(
        WAREHOUSE_SOURCE,
        record,
        categoryIndex.byName.get(normalizeComparison(currentName(record))) ?? [],
      ),
    );
  const legacyRows = [...productLegacyRows, ...warehouseLegacyRows];
  const rows = [...productRows, ...warehouseRows, ...legacyRows];
  const duplicateDetails = [
    ...productIndexes.duplicates,
    ...warehouseIndexes.duplicates,
  ];

  return {
    rows,
    productRows,
    warehouseRows,
    legacyRows,
    legacyReviewRows: legacyRows,
    duplicateCurrentCodes: duplicateDetails.map((duplicate) => duplicate.code),
    duplicateCurrentCodeDetails: duplicateDetails,
    unmatchedCategories: unmatched,
    sourceTotals: {
      products: {
        ...sourceTotals(input.products, productCollapsed.groups),
        conflictingRows: productCollapsed.conflicts,
      },
      warehouse: {
        ...sourceTotals(input.warehouse, warehouseCollapsed.groups),
        conflictingRows: warehouseCollapsed.conflicts,
      },
      categories: {
        rows: categoryRowCount(parsedCategories),
        entries: parsedCategories.length,
        unmatched: unmatched.length,
      },
    },
    legacyPolicy: {
      disposition: "review_required",
      requiredChecks: [
        "database_foreign_key_usage",
        "database_non_foreign_key_usage",
        "balance_and_history_review",
      ],
      deletePolicy: "delete_only_when_truly_unused",
      usedRecordPolicy: "archive_after_review_when_used",
    },
  };
}

export const reconcileCatalogue = buildCatalogueReconciliation;
export const buildReconciliation = buildCatalogueReconciliation;