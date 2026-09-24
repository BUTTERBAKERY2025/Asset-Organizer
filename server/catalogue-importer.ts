import { createHash, randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type { Express, Request } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { isAuthenticated, isUserAdmin } from "./auth";
import {
  buildCatalogueReconciliation,
  normalizeSku,
  normalizeUnit,
  parseCategoriesWorkbook,
  parseProductsWorkbook,
  parseWarehouseWorkbook,
  type CatalogueNamespace,
  type ReconciliationResult,
  type ReconciliationRow,
} from "../scripts/catalog-reconciliation";

const SOURCE_FILES = {
  products: "items_by_cod_1789494218526.xlsx",
  warehouse: "item_store_1789494218529.xlsx",
  categories: "items_by_category_1789494218529.xlsx",
} as const;
const REVIEW_ACKNOWLEDGEMENT = "CATALOGUE_REVIEWED";
const LEGACY_ACKNOWLEDGEMENT = "LEGACY_RECORD_REVIEWED";

type Executor = any;
type Namespace = CatalogueNamespace;
export type CatalogueImportAction =
  | "keep"
  | "adopt_code"
  | "add"
  | "deactivate"
  | "hard_delete"
  | "defer";

export type CatalogueImportOperation = {
  namespace: Namespace;
  action: CatalogueImportAction;
  sourceCode?: string;
  currentId?: number;
  name?: string;
  unit?: string;
  category?: string;
  approvedAliasSections?: string[];
  price?: number;
  availabilityDisposition?: "active_priced" | "inactive_pending_price";
  adoptSourceName?: boolean;
  usageSections: string[];
  reason?: string;
};

export type StagedCataloguePlan = {
  id: string;
  targetId: string;
  targetIdentity: string;
  sourceChecksum: string;
  snapshotChecksum: string;
  planChecksum: string;
  reviewRequiredCount: number;
  operations: CatalogueImportOperation[];
  rollbackPlan: {
    reversibleMetadataOperations: number;
    irreversibleHardDeletes: number;
    notes: string[];
  };
};

export class CatalogueImportError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "CatalogueImportError";
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(value: unknown): string {
  return createHash("sha256").update(
    typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalJson(value),
  ).digest("hex");
}

function catalogueSnapshotChecksum(
  products: Array<Record<string, unknown>>,
  warehouse: Array<Record<string, unknown>>,
): string {
  // Backups contain additional columns and can return rows in a different
  // physical order. Bind only the catalogue identity fields used by review.
  const normalizedProducts = products.map(({ id, sku, name, unit, is_active }) => ({
    id, sku, name, unit, is_active,
  })).sort((a, b) => Number(a.id) - Number(b.id));
  const normalizedWarehouse = warehouse.map(({ id, sku, name, unit, current_stock, is_active }) => ({
    id, sku, name, unit, current_stock, is_active,
  })).sort((a, b) => Number(a.id) - Number(b.id));
  return checksum({ products: normalizedProducts, warehouse: normalizedWarehouse });
}

export function catalogueTargetIdentityFromRow(row: Record<string, unknown> | undefined): string {
  if (!row?.database_name || !row?.database_oid) {
    throw new CatalogueImportError(503, "تعذر اشتقاق هوية قاعدة بيانات الكتالوج");
  }
  const operatorTargetMarker = process.env.CATALOGUE_IMPORT_TARGET_ID;
  if (!operatorTargetMarker) {
    throw new CatalogueImportError(503, "يلزم معرّف نشر مستقل CATALOGUE_IMPORT_TARGET_ID لإنشاء بصمة كتالوج آمنة");
  }
  return checksum({
    operatorTargetMarker,
    database: row.database_name,
    databaseOid: row.database_oid,
    serverAddress: row.server_address,
    serverPort: row.server_port,
  });
}

export async function getCatalogueTargetIdentity(executor: Executor = db): Promise<string> {
  const result = await executor.execute(sql`
    SELECT current_database() AS database_name,
           (SELECT oid::text FROM pg_database WHERE datname = current_database()) AS database_oid,
           COALESCE(inet_server_addr()::text, 'local') AS server_address,
           COALESCE(inet_server_port()::text, 'local') AS server_port
  `);
  return catalogueTargetIdentityFromRow(result.rows[0] as Record<string, unknown> | undefined);
}

export function createCatalogueBackupManifest(
  targetIdentity: string,
  products: Array<Record<string, unknown>>,
  warehouse: Array<Record<string, unknown>>,
): { targetIdentity: string; snapshotChecksum: string; manifestChecksum: string } {
  const snapshotChecksum = catalogueSnapshotChecksum(products, warehouse);
  return {
    targetIdentity,
    snapshotChecksum,
    manifestChecksum: checksum({ targetIdentity, snapshotChecksum }),
  };
}

function sourceDirectory(): string {
  const packaged = path.resolve(process.cwd(), "dist", "catalogue-source");
  if (existsSync(packaged)) return packaged;
  if (process.env.NODE_ENV !== "production") {
    return path.resolve(process.cwd(), "attached_assets");
  }
  throw new CatalogueImportError(
    503,
    "مصادر الكتالوج المدققة غير مضمّنة في هذا الإصدار؛ لا يمكن تنفيذ الاستيراد بأمان",
  );
}

function loadSources() {
  const directory = sourceDirectory();
  const read = (name: string) => {
    const file = path.join(directory, name);
    if (!existsSync(file)) throw new CatalogueImportError(503, `ملف مصدر الكتالوج مفقود: ${name}`);
    return readFileSync(file);
  };
  const productBytes = read(SOURCE_FILES.products);
  const warehouseBytes = read(SOURCE_FILES.warehouse);
  const categoryBytes = read(SOURCE_FILES.categories);
  return {
    products: parseProductsWorkbook(productBytes),
    warehouse: parseWarehouseWorkbook(warehouseBytes),
    categories: parseCategoriesWorkbook(categoryBytes),
    sourceChecksum: checksum(Buffer.concat([productBytes, warehouseBytes, categoryBytes])),
  };
}

function sourceCode(row: ReconciliationRow): string {
  if (row.sourceCode === null || row.sourceCode === undefined) {
    throw new CatalogueImportError(400, "صف المصدر لا يملك كود عمل صالح");
  }
  return String(row.sourceCode);
}

function canonicalSections(row: ReconciliationRow): string[] {
  // A source alias is evidence for a reviewer, never authorization to map an
  // item or attach usage metadata.
  return Array.from(new Set(
    row.categoryMatches
      .filter((match) => match.matchedBy === "canonical_name")
      .map((match) => match.category.trim())
      .filter(Boolean),
  )).sort();
}

function usageSectionsForApproval(
  row: ReconciliationRow,
  approvedAliasSections: string[] | undefined,
): string[] {
  const allowedAliases = new Set(
    row.categoryMatches
      .filter((match) => match.matchedBy === "source_alias")
      .map((match) => match.category.trim())
      .filter(Boolean),
  );
  for (const section of approvedAliasSections ?? []) {
    if (!allowedAliases.has(section)) {
      throw new CatalogueImportError(400, "قسم الاسم البديل غير موجود ضمن مطابقات المصدر القابلة للمراجعة");
    }
  }
  return Array.from(new Set([
    ...canonicalSections(row),
    ...(approvedAliasSections ?? []),
  ])).sort();
}

const approvalSchema = z.object({
  namespace: z.enum(["products", "warehouse"]),
  sourceCode: z.union([z.string().min(1), z.number()]).optional(),
  currentId: z.number().int().positive().optional(),
  action: z.enum(["adopt_code", "add", "deactivate", "hard_delete", "defer"]),
  category: z.string().trim().min(1).max(200).optional(),
  approvedAliasSections: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  price: z.number().finite().positive().max(1_000_000).optional(),
  availabilityDisposition: z.enum(["active_priced", "inactive_pending_price"]).optional(),
  reason: z.string().trim().min(3).max(1000).optional(),
  identityAcknowledgement: z.literal("MANUAL_IDENTITY_CONFIRMED").optional(),
  adoptSourceName: z.boolean().optional(),
  reviewAcknowledgement: z.string().optional(),
}).strict();
export type CatalogueImportApproval = z.infer<typeof approvalSchema>;

function findSourceRow(
  result: ReconciliationResult,
  namespace: Namespace,
  code: string | number | undefined,
): ReconciliationRow {
  if (code === undefined) throw new CatalogueImportError(400, "يلزم كود المصدر لهذه الموافقة");
  const row = (namespace === "products" ? result.productRows : result.warehouseRows)
    .find((candidate) => candidate.canonicalSku === normalizeSku(code));
  if (!row) throw new CatalogueImportError(400, "كود المصدر غير موجود في الخطة المدققة");
  return row;
}

function findLegacyRow(
  result: ReconciliationResult,
  namespace: Namespace,
  currentId: number | undefined,
): ReconciliationRow {
  const row = result.legacyRows.find((candidate) =>
    candidate.namespace === namespace && Number(candidate.currentId) === currentId);
  if (!row) throw new CatalogueImportError(400, "السجل ليس عنصراً قديماً قابلاً للمراجعة");
  return row;
}

function findManuallyConfirmedCurrentRow(
  result: ReconciliationResult,
  source: ReconciliationRow,
  namespace: Namespace,
  currentId: number | undefined,
): ReconciliationRow {
  // A unique exact-name candidate is still only a candidate. It may be used
  // when the reviewer explicitly confirms it, but is never selected here
  // unless the submitted internal ID exactly names it.
  if (
    Number(source.candidateCurrentId) === currentId
    || source.currentRecords.some((record) => Number((record as any).id) === currentId)
  ) return source;
  return findLegacyRow(result, namespace, currentId);
}

/**
 * Pure conservative planner. It accepts only reviewer supplied identifiers;
 * aliases and name similarities remain in the review output and cannot result
 * in an action here.
 */
export function createStagedCataloguePlan(input: {
  reconciliation: ReconciliationResult;
  targetId: string;
  targetIdentity: string;
  sourceChecksum: string;
  snapshotChecksum: string;
  approvals: CatalogueImportApproval[];
}): Omit<StagedCataloguePlan, "id"> {
  const usedApprovals = new Set<string>();
  const operations: CatalogueImportOperation[] = [];

  for (const row of [...input.reconciliation.productRows, ...input.reconciliation.warehouseRows]) {
    if (row.status !== "exact_match") continue;
    operations.push({
      namespace: row.namespace,
      action: "keep",
      sourceCode: sourceCode(row),
      currentId: Number(row.currentId),
      usageSections: canonicalSections(row),
    });
  }

  for (const approval of input.approvals) {
    const approvalKey = `${approval.namespace}:${approval.action}:${approval.sourceCode ?? ""}:${approval.currentId ?? ""}`;
    if (usedApprovals.has(approvalKey)) throw new CatalogueImportError(400, "موافقة مكررة في الخطة");
    usedApprovals.add(approvalKey);
    if (
      approval.approvedAliasSections?.length
      && approval.action !== "adopt_code"
      && approval.action !== "add"
    ) {
      throw new CatalogueImportError(400, "أقسام الاسم البديل متاحة فقط لإضافة مصدر أو إعادة ترميزه");
    }

    if (approval.action === "adopt_code") {
      const row = findSourceRow(input.reconciliation, approval.namespace, approval.sourceCode);
      const selectedCurrent = findManuallyConfirmedCurrentRow(
        input.reconciliation,
        row,
        approval.namespace,
        approval.currentId,
      );
      if (
        row.status === "exact_match"
        || approval.identityAcknowledgement !== "MANUAL_IDENTITY_CONFIRMED"
        || !approval.reason
        || normalizeUnit(row.sourceUnit) !== normalizeUnit(selectedCurrent.currentUnit)
      ) {
        throw new CatalogueImportError(400, "إعادة الترميز تتطلب تأكيد هوية يدوي ومبرر ووحدة متطابقة");
      }
      operations.push({
        namespace: approval.namespace,
        action: "adopt_code",
        sourceCode: sourceCode(row),
        currentId: approval.currentId,
        ...(approval.adoptSourceName ? { name: row.sourceName ?? undefined, adoptSourceName: true } : {}),
        usageSections: usageSectionsForApproval(row, approval.approvedAliasSections),
        reason: approval.reason,
      });
      continue;
    }

    if (approval.action === "add") {
      const row = findSourceRow(input.reconciliation, approval.namespace, approval.sourceCode);
      const pricedAndActive = approval.price !== undefined
        && approval.availabilityDisposition === "active_priced";
      const explicitlyUnavailable = approval.price === undefined
        && approval.availabilityDisposition === "inactive_pending_price";
      if (row.status !== "add_candidate" || !approval.category || (!pricedAndActive && !explicitlyUnavailable)) {
        throw new CatalogueImportError(400, "إضافة الصنف تتطلب صفاً غير ملتبس وفئة أساسية يحددها المراجع");
      }
      operations.push({
        namespace: approval.namespace,
        action: "add",
        sourceCode: sourceCode(row),
        name: row.sourceName ?? undefined,
        unit: row.sourceUnit ?? undefined,
        category: approval.category,
        ...(approval.price === undefined ? {} : { price: approval.price }),
        availabilityDisposition: approval.availabilityDisposition,
        usageSections: usageSectionsForApproval(row, approval.approvedAliasSections),
      });
      continue;
    }

    if (approval.action === "defer" && approval.sourceCode !== undefined) {
      const row = findSourceRow(input.reconciliation, approval.namespace, approval.sourceCode);
      if (row.status === "exact_match" || !approval.reason) {
        throw new CatalogueImportError(400, "يمكن تأجيل صف مصدر غير محسوم فقط مع مبرر");
      }
      operations.push({
        namespace: row.namespace,
        action: "defer",
        sourceCode: sourceCode(row),
        usageSections: [],
        reason: approval.reason,
      });
      continue;
    }

    const legacy = findLegacyRow(input.reconciliation, approval.namespace, approval.currentId);
    if (
      approval.reviewAcknowledgement !== LEGACY_ACKNOWLEDGEMENT
      || !approval.reason
    ) {
      throw new CatalogueImportError(400, "يلزم إقرار ومبرر مراجعة السجل القديم");
    }
    operations.push({
      namespace: legacy.namespace,
      action: approval.action,
      currentId: Number(legacy.currentId),
      usageSections: [],
      reason: approval.reason,
    });
  }

  const distinct = new Set(operations.map((op) =>
    `${op.namespace}:${op.action}:${op.sourceCode ?? ""}:${op.currentId ?? ""}`));
  if (distinct.size !== operations.length) {
    throw new CatalogueImportError(400, "تتضمن الخطة عمليتين على السجل نفسه");
  }
  const targetIds = new Set<string>();
  for (const operation of operations) {
    if (!operation.currentId) continue;
    const key = `${operation.namespace}:${operation.currentId}`;
    if (targetIds.has(key)) {
      throw new CatalogueImportError(400, "تتضمن الخطة أكثر من إجراء على معرّف داخلي واحد");
    }
    targetIds.add(key);
  }
  const coveredRows = new Set(operations.filter((op) => op.sourceCode && op.action !== "defer").map((op) =>
    `${op.namespace}:${normalizeSku(op.sourceCode)}`));
  const reviewRequiredCount = [...input.reconciliation.productRows, ...input.reconciliation.warehouseRows]
    .filter((row) => row.status !== "exact_match")
    .filter((row) => !coveredRows.has(`${row.namespace}:${row.canonicalSku}`)).length
    + input.reconciliation.legacyRows.filter((row) =>
      !operations.some((op) => op.namespace === row.namespace && op.currentId === Number(row.currentId))).length;
  const ordered = operations.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  const planChecksum = checksum({
    targetId: input.targetId,
    targetIdentity: input.targetIdentity,
    sourceChecksum: input.sourceChecksum,
    snapshotChecksum: input.snapshotChecksum,
    operations: ordered,
  });
  return {
    targetId: input.targetId,
    targetIdentity: input.targetIdentity,
    sourceChecksum: input.sourceChecksum,
    snapshotChecksum: input.snapshotChecksum,
    planChecksum,
    reviewRequiredCount,
    operations: ordered,
    rollbackPlan: {
      reversibleMetadataOperations: ordered.filter((op) =>
        op.action === "adopt_code" || op.action === "deactivate").length,
      irreversibleHardDeletes: ordered.filter((op) => op.action === "hard_delete").length,
      notes: [
        "Existing IDs, prices, balances, stock and history are never moved or rewritten.",
        "Hard deletion is refused unless apply-time reference, stock and open-operation proof succeeds.",
        "Added usage sections are additive; removing a membership requires a separate reviewed operation.",
      ],
    },
  };
}

async function currentCatalogue(executor: Executor = db) {
  const [productResult, warehouseResult] = await Promise.all([
    executor.execute(sql`SELECT id, sku, name, unit, is_active FROM products ORDER BY id`),
    executor.execute(sql`SELECT id, sku, name, unit, current_stock, is_active FROM warehouse_items ORDER BY id`),
  ]);
  const products = productResult.rows as Array<Record<string, unknown>>;
  const warehouse = warehouseResult.rows as Array<Record<string, unknown>>;
  return { products, warehouse, snapshotChecksum: catalogueSnapshotChecksum(products, warehouse) };
}

async function reviewCatalogue(executor: Executor = db) {
  const sources = loadSources();
  const current = await currentCatalogue(executor);
  const reconciliation = buildCatalogueReconciliation({
    products: sources.products,
    warehouse: sources.warehouse,
    categories: sources.categories,
    currentProducts: current.products,
    currentWarehouse: current.warehouse,
  });
  return { ...sources, ...current, reconciliation };
}

function configuredTarget(targetId: string): void {
  const configured = process.env.CATALOGUE_IMPORT_TARGET_ID;
  if (!configured || configured !== targetId) {
    throw new CatalogueImportError(409, "لم يتم تأكيد هدف الاستيراد المستقل أو لا يطابق الهدف المعتمد");
  }
}

function requireAdmin(req: Request): void {
  if (!isUserAdmin(req)) throw new CatalogueImportError(403, "هذه عملية كتالوج إدارية فقط");
}

function planResponse(row: any): StagedCataloguePlan & { status: string; appliedSummary?: unknown } {
  const payload = typeof row.staged_payload === "string" ? JSON.parse(row.staged_payload) : row.staged_payload;
  return {
    id: row.id,
    ...payload,
    status: row.status,
    ...(row.applied_summary ? { appliedSummary: row.applied_summary } : {}),
  };
}

function quotedIdentifier(value: string): string {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

// The current shared schema has exactly one semantic catalogue link without an
// FK. All other current links are discovered from pg_constraint and checked
// only when they actually target products/warehouse_items.
const NON_FK_REFERENCE_REGISTRY: Record<Namespace, Array<{ table: string; column: string }>> = {
  products: [
    { table: "pos_refund_items", column: "product_id" },
  ],
  warehouse: [],
};

// Generic integer item_id does not always identify a warehouse item. These
// current schema tables own assembly/checklist records; dynamic FK discovery
// also ignores them because their referenced relation is not warehouse_items.
const EXPLICITLY_UNRELATED_GENERIC_ITEM_IDS = new Set([
  "assembly_resolution_votes.item_id",
  "assembly_revote_grants.item_id",
  "shift_checklist_responses.item_id",
]);

export const catalogueDeletionReferencePolicy = {
  semanticReferences: NON_FK_REFERENCE_REGISTRY,
  explicitlyUnrelatedGenericItemIds: Array.from(EXPLICITLY_UNRELATED_GENERIC_ITEM_IDS).sort(),
} as const;

async function lockAndCountTypedReference(
  tx: Executor,
  table: string,
  column: string,
  id: number,
): Promise<{ exists: boolean; count: number; hasStatus: boolean }> {
  // The registry is semantic, but deployments differ. Confirm the column is a
  // numeric identifier before comparing it; never compare a catalogue ID with
  // arbitrary text columns such as audit_logs.item_id.
  const columnInfo = await tx.execute(sql`
    SELECT 1,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table} AND column_name = 'status'
      ) AS has_status
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
      AND data_type IN ('smallint', 'integer', 'bigint', 'numeric', 'decimal')
  `);
  if (!columnInfo.rows[0]) return { exists: false, count: 0, hasStatus: false };
  await tx.execute(sql.raw(
    `LOCK TABLE ${quotedIdentifier("public")}.${quotedIdentifier(table)} IN SHARE ROW EXCLUSIVE MODE`,
  ));
  const count = await tx.execute(sql.raw(
    `SELECT count(*)::int AS count FROM ${quotedIdentifier("public")}.${quotedIdentifier(table)}
     WHERE ${quotedIdentifier(column)} = ${id}`,
  ));
  return {
    exists: true,
    count: Number(count.rows[0]?.count ?? 0),
    hasStatus: Boolean(columnInfo.rows[0]?.has_status),
  };
}

async function isForeignKeyToDifferentTarget(
  tx: Executor,
  table: string,
  column: string,
  targetTable: string,
): Promise<boolean> {
  const result = await tx.execute(sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey::smallint[])
      WHERE con.contype = 'f'
        AND ns.nspname = 'public'
        AND rel.relname = ${table}
        AND att.attname = ${column}
        AND con.confrelid <> ${targetTable}::regclass
    ) AS unrelated_fk
  `);
  return Boolean(result.rows[0]?.unrelated_fk);
}

export async function proveUnusedForHardDelete(
  tx: Executor,
  namespace: Namespace,
  id: number,
): Promise<{ proven: boolean; blockers: string[] }> {
  const table = namespace === "products" ? "products" : "warehouse_items";
  const blockers: string[] = [];
  try {
    const locked = await tx.execute(sql.raw(
      `SELECT id FROM ${quotedIdentifier(table)} WHERE id = ${id} FOR UPDATE`,
    ));
    if (!locked.rows[0]) return { proven: false, blockers: ["record_missing_or_changed"] };

    const foreignKeys = await tx.execute(sql`
      SELECT ns.nspname AS schema_name, rel.relname AS table_name, att.attname AS column_name,
             cardinality(con.conkey::smallint[]) AS key_count
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f' AND con.confrelid = ${table}::regclass
    `);
    const lockedReferences = new Map<string, {
      schema: string; table: string; column: string; hasStatus: boolean;
    }>();
    for (const reference of foreignKeys.rows as any[]) {
      if (Number(reference.key_count) !== 1) {
        return { proven: false, blockers: ["composite_foreign_key_cannot_be_safely_proven"] };
      }
      await tx.execute(sql.raw(
        `LOCK TABLE ${quotedIdentifier(reference.schema_name)}.${quotedIdentifier(reference.table_name)}
         IN SHARE ROW EXCLUSIVE MODE`,
      ));
      const count = await tx.execute(sql.raw(
        `SELECT count(*)::int AS count FROM ${quotedIdentifier(reference.schema_name)}.${quotedIdentifier(reference.table_name)}
         WHERE ${quotedIdentifier(reference.column_name)} = ${id}`,
      ));
      if (Number(count.rows[0]?.count ?? 0) > 0) blockers.push(`fk:${reference.table_name}.${reference.column_name}`);
      const status = await tx.execute(sql`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ${reference.schema_name} AND table_name = ${reference.table_name}
          AND column_name = 'status'
      `);
      lockedReferences.set(
        `${reference.schema_name}.${reference.table_name}.${reference.column_name}`,
        {
          schema: reference.schema_name,
          table: reference.table_name,
          column: reference.column_name,
          hasStatus: Boolean(status.rows[0]),
        },
      );
    }

    // Non-FK references are deliberately opt-in and typed. This protects
    // legacy history tables without treating unrelated columns named item_id
    // as numeric catalogue references.
    for (const reference of NON_FK_REFERENCE_REGISTRY[namespace]) {
      const checked = await lockAndCountTypedReference(tx, reference.table, reference.column, id);
      if (!checked.exists) continue;
      if (checked.count > 0) blockers.push(`reference:${reference.table}.${reference.column}`);
      lockedReferences.set(
        `public.${reference.table}.${reference.column}`,
        { schema: "public", table: reference.table, column: reference.column, hasStatus: checked.hasStatus },
      );
    }

    const semanticColumnNames = namespace === "products"
      ? ["product_id", "substitute_product_id"]
      : ["warehouse_item_id", "substitute_warehouse_item_id", "item_id"];
    const discoveredSemanticColumns = await tx.execute(sql`
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name IN (${sql.join(semanticColumnNames.map((name) => sql`${name}`), sql`, `)})
        AND data_type IN ('smallint', 'integer', 'bigint', 'numeric', 'decimal')
    `);
    for (const reference of discoveredSemanticColumns.rows as any[]) {
      const key = `${reference.table_schema}.${reference.table_name}.${reference.column_name}`;
      if (
        namespace === "warehouse"
        && EXPLICITLY_UNRELATED_GENERIC_ITEM_IDS.has(`${reference.table_name}.${reference.column_name}`)
        && await isForeignKeyToDifferentTarget(tx, reference.table_name, reference.column_name, table)
      ) {
        continue;
      }
      if (!lockedReferences.has(key)) {
        // A newly introduced semantic identifier column has no reviewed
        // lifecycle rule. Refuse deletion rather than silently missing it.
        blockers.push(`unregistered_semantic_reference:${reference.table_name}.${reference.column_name}`);
      }
    }

    if (namespace === "warehouse") {
      const stock = await tx.execute(sql.raw(
        `SELECT count(*)::int AS count FROM branch_stock
         WHERE item_id = ${id} AND (COALESCE(current_quantity, 0) <> 0 OR COALESCE(reserved_quantity, 0) <> 0)`,
      ));
      if (Number(stock.rows[0]?.count ?? 0) > 0) blockers.push("branch_stock_balance");
      const balance = await tx.execute(sql.raw(
        `SELECT current_stock FROM warehouse_items WHERE id = ${id}`,
      ));
      if (Number(balance.rows[0]?.current_stock ?? 0) !== 0) blockers.push("warehouse_balance");
    }

    for (const reference of Array.from(lockedReferences.values())) {
      if (!reference.hasStatus) continue;
      const open = await tx.execute(sql.raw(
        `SELECT count(*)::int AS count FROM ${quotedIdentifier(reference.schema)}.${quotedIdentifier(reference.table)}
         WHERE ${quotedIdentifier(reference.column)} = ${id}
           AND lower(COALESCE(status::text, '')) NOT IN ('completed', 'cancelled', 'canceled', 'closed', 'rejected', 'void', 'archived')`,
      ));
      if (Number(open.rows[0]?.count ?? 0) > 0) blockers.push(`open_operation:${reference.table}`);
    }
    return { proven: blockers.length === 0, blockers };
  } catch {
    return { proven: false, blockers: ["usage_proof_unavailable"] };
  }
}

async function addUsageSections(
  tx: Executor,
  planId: string,
  namespace: Namespace,
  targetId: number,
  sections: string[],
): Promise<Array<{ section: string; membershipAdded: boolean; sourcePlanId: string }>> {
  const changes: Array<{ section: string; membershipAdded: boolean; sourcePlanId: string }> = [];
  for (const name of sections) {
    const inserted = await tx.execute(sql`
      INSERT INTO catalogue_usage_sections (name) VALUES (${name})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `);
    const sectionId = Number(inserted.rows[0]?.id);
    if (!sectionId) throw new CatalogueImportError(500, "تعذر حفظ قسم استخدام الصنف");
    if (namespace === "products") {
      const membership = await tx.execute(sql`
        INSERT INTO product_usage_sections (product_id, usage_section_id, source_plan_id)
        VALUES (${targetId}, ${sectionId}, ${planId}::uuid)
        ON CONFLICT (product_id, usage_section_id) DO NOTHING
        RETURNING product_id
      `);
      changes.push({ section: name, membershipAdded: membership.rowCount === 1, sourcePlanId: planId });
    } else {
      const membership = await tx.execute(sql`
        INSERT INTO warehouse_item_usage_sections (warehouse_item_id, usage_section_id, source_plan_id)
        VALUES (${targetId}, ${sectionId}, ${planId}::uuid)
        ON CONFLICT (warehouse_item_id, usage_section_id) DO NOTHING
        RETURNING warehouse_item_id
      `);
      changes.push({ section: name, membershipAdded: membership.rowCount === 1, sourcePlanId: planId });
    }
  }
  return changes;
}

export async function applyCatalogueImportOperation(
  tx: Executor,
  planId: string,
  operation: CatalogueImportOperation,
): Promise<Record<string, unknown>> {
  const table = operation.namespace === "products" ? "products" : "warehouse_items";
  let id = operation.currentId;
  let before: Record<string, unknown> | undefined;
  if (id && operation.action !== "keep" && operation.action !== "defer") {
    const found = await tx.execute(sql`
      SELECT sku, name, is_active FROM ${sql.identifier(table)} WHERE id = ${id} FOR UPDATE
    `);
    before = found.rows[0] as Record<string, unknown> | undefined;
    if (!before) throw new CatalogueImportError(409, "السجل المستهدف تغير أو لم يعد موجوداً");
  }
  if (operation.action === "keep") {
    if (!id) throw new CatalogueImportError(409, "معرّف المطابقة الدقيقة غير صالح");
  } else if (operation.action === "adopt_code") {
    if (!id || !operation.sourceCode) throw new CatalogueImportError(409, "بيانات إعادة الترميز غير صالحة");
    const duplicate = await tx.execute(sql`
      SELECT id FROM ${sql.identifier(table)}
      WHERE sku = ${operation.sourceCode} AND id <> ${id}
      FOR UPDATE
    `);
    if (duplicate.rows[0]) throw new CatalogueImportError(409, "كود المصدر مستخدم بالفعل في سجل داخلي آخر");
    const sourceNameUpdate = operation.adoptSourceName && operation.name
      ? sql`, name = ${operation.name}`
      : sql``;
    const updated = await tx.execute(sql`
      UPDATE ${sql.identifier(table)}
      SET sku = ${operation.sourceCode}${sourceNameUpdate}, updated_at = now()
      WHERE id = ${id}
    `);
    if (updated.rowCount !== 1) throw new CatalogueImportError(409, "تعذر تحديث سجل إعادة الترميز مرة واحدة");
  } else if (operation.action === "add") {
    if (!operation.sourceCode || !operation.name || !operation.unit || !operation.category) {
      throw new CatalogueImportError(409, "بيانات إضافة الصنف غير مكتملة");
    }
    const available = operation.availabilityDisposition === "active_priced";
    const duplicate = await tx.execute(sql`
      SELECT id FROM ${sql.identifier(table)} WHERE sku = ${operation.sourceCode} FOR UPDATE
    `);
    if (duplicate.rows[0]) throw new CatalogueImportError(409, "كود المصدر مستخدم بالفعل في سجل داخلي آخر");
    if (operation.namespace === "products") {
      const inserted = await tx.execute(sql`
        INSERT INTO products (sku, name, unit, category, base_price, is_active)
        VALUES (${operation.sourceCode}, ${operation.name}, ${operation.unit}, ${operation.category},
                ${operation.price ?? null}, ${available ? "true" : "false"})
        RETURNING id
      `);
      id = Number(inserted.rows[0]?.id);
    } else {
      const inserted = await tx.execute(sql`
        INSERT INTO warehouse_items (sku, name, unit, category, unit_price, is_active)
        VALUES (${operation.sourceCode}, ${operation.name}, ${operation.unit}, ${operation.category},
                ${operation.price === undefined ? null : String(operation.price)}, ${available})
        RETURNING id
      `);
      id = Number(inserted.rows[0]?.id);
    }
    if (!id) throw new CatalogueImportError(500, "تعذر إنشاء الصنف");
  } else if (operation.action === "deactivate") {
    if (!id) throw new CatalogueImportError(409, "معرّف السجل القديم غير صالح");
    const inactive = operation.namespace === "products" ? "false" : false;
    const updated = await tx.execute(sql`
      UPDATE ${sql.identifier(table)}
      SET is_active = ${inactive}, updated_at = now()
      WHERE id = ${id}
    `);
    if (updated.rowCount !== 1) throw new CatalogueImportError(409, "تعذر تعطيل سجل قديم مرة واحدة");
  } else if (operation.action === "hard_delete") {
    if (!id) throw new CatalogueImportError(409, "معرّف السجل القديم غير صالح");
    const proof = await proveUnusedForHardDelete(tx, operation.namespace, id);
    if (!proof.proven) {
      throw new CatalogueImportError(409, `تعذر إثبات أن السجل غير مستخدم: ${proof.blockers.join(", ")}`);
    }
    const deleted = await tx.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE id = ${id}`);
    if (deleted.rowCount !== 1) throw new CatalogueImportError(409, "تعذر حذف سجل قديم مرة واحدة");
    return { ...operation, currentId: id, deleted: true, before };
  } else if (operation.action === "defer") {
    return { ...operation, deferred: true };
  }
  const usageSectionChanges = await addUsageSections(tx, planId, operation.namespace, id!, operation.usageSections);
  const inverse = operation.action === "add"
    ? {
      action: "deactivate",
      currentId: id,
      reason: "Safe inverse for imported addition; do not hard-delete without a separate usage proof.",
    }
    : before && (operation.action === "adopt_code" || operation.action === "deactivate")
      ? { action: "restore_metadata", currentId: id, values: before }
      : undefined;
  return {
    ...operation,
    currentId: id,
    ...(before ? { before } : {}),
    usageSectionChanges,
    ...(inverse ? { inverse } : {}),
  };
}

const stageSchema = z.object({
  targetId: z.string().trim().min(1).max(200),
  sourceChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  snapshotChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  reviewAcknowledgement: z.literal(REVIEW_ACKNOWLEDGEMENT),
  approvals: z.array(approvalSchema).max(1000),
}).strict();
const applySchema = z.object({
  targetId: z.string().trim().min(1).max(200),
  backupId: z.number().int().positive(),
  applyConfirmation: z.string().min(1).max(200),
}).strict();

export function registerCatalogueImporterRoutes(app: Express): void {
  app.get("/api/admin/catalogue-import/review", isAuthenticated, async (req, res) => {
    try {
      requireAdmin(req);
      const review = await reviewCatalogue();
      res.set("Cache-Control", "no-store");
      res.json({
        targetId: process.env.CATALOGUE_IMPORT_TARGET_ID ?? null,
        sourceChecksum: review.sourceChecksum,
        snapshotChecksum: review.snapshotChecksum,
        reconciliation: review.reconciliation,
        contract: "/reports/catalog-api-contract.md",
      });
    } catch (error) {
      const known = error as CatalogueImportError;
      res.status(known.status || 500).json({ error: known.message || "تعذر إنشاء مراجعة الكتالوج" });
    }
  });

  app.post("/api/admin/catalogue-import/stage", isAuthenticated, async (req, res) => {
    try {
      requireAdmin(req);
      const input = stageSchema.parse(req.body);
      configuredTarget(input.targetId);
      const review = await reviewCatalogue();
      if (
        input.sourceChecksum !== review.sourceChecksum
        || input.snapshotChecksum !== review.snapshotChecksum
      ) {
        throw new CatalogueImportError(409, "بيانات مراجعة العميل قديمة؛ أعد تحميل المراجعة قبل تجهيز الخطة");
      }
      const targetIdentity = await getCatalogueTargetIdentity();
      const planned = createStagedCataloguePlan({
        reconciliation: review.reconciliation,
        targetId: input.targetId,
        targetIdentity,
        sourceChecksum: review.sourceChecksum,
        snapshotChecksum: review.snapshotChecksum,
        approvals: input.approvals,
      });
      const plan = { id: randomUUID(), ...planned };
      const actorId = req.currentUser!.id;
      await db.execute(sql`
        INSERT INTO catalogue_import_plans (
          id, target_id, target_identity, source_checksum, snapshot_checksum, plan_checksum,
          review_acknowledgement, requested_by, reviewed_by, staged_payload
        ) VALUES (
          ${plan.id}::uuid, ${plan.targetId}, ${plan.targetIdentity}, ${plan.sourceChecksum}, ${plan.snapshotChecksum},
          ${plan.planChecksum}, ${REVIEW_ACKNOWLEDGEMENT}, ${actorId}, ${actorId},
          ${JSON.stringify(planned)}::jsonb
        )
      `);
      res.status(201).json({ ...plan, status: "staged" });
    } catch (error) {
      const known = error as CatalogueImportError;
      res.status(known.status || 400).json({ error: known.message || "خطة الاستيراد غير صالحة" });
    }
  });

  app.get("/api/admin/catalogue-import/plans/:planId", isAuthenticated, async (req, res) => {
    try {
      requireAdmin(req);
      const result = await db.execute(sql`
        SELECT id::text, status, staged_payload, applied_summary
        FROM catalogue_import_plans WHERE id = ${req.params.planId}::uuid
      `);
      if (!result.rows[0]) throw new CatalogueImportError(404, "خطة الاستيراد غير موجودة");
      res.set("Cache-Control", "no-store");
      res.json(planResponse(result.rows[0]));
    } catch (error) {
      const known = error as CatalogueImportError;
      res.status(known.status || 400).json({ error: known.message || "تعذر قراءة خطة الاستيراد" });
    }
  });

  app.post("/api/admin/catalogue-import/plans/:planId/apply", isAuthenticated, async (req, res) => {
    try {
      requireAdmin(req);
      const input = applySchema.parse(req.body);
      const idempotencyKey = req.header("Idempotency-Key");
      if (!idempotencyKey || !/^[A-Za-z0-9._:-]{16,128}$/.test(idempotencyKey)) {
        throw new CatalogueImportError(400, "يلزم رأس Idempotency-Key صالح بطول 16 إلى 128");
      }
      configuredTarget(input.targetId);
      const planId = req.params.planId;
      if (input.applyConfirmation !== `APPLY_CATALOGUE_${planId}`) {
        throw new CatalogueImportError(400, "تأكيد التطبيق غير مطابق للخطة");
      }
      const actorId = req.currentUser!.id;
      const requestHash = checksum({ targetId: input.targetId, backupId: input.backupId, planId });
      const response = await db.transaction(async (tx: Executor) => {
        // This is deliberately catalogue-wide rather than plan-specific: two
        // different approved plans must not validate the same snapshot then
        // mutate it independently.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(74074, 0)`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(74074, hashtext(${planId}))`);
        const found = await tx.execute(sql`
          SELECT p.*, b.status AS backup_status, b.created_at AS backup_created_at,
                 bm.target_identity AS backup_target_identity,
                 bm.snapshot_checksum AS backup_snapshot_checksum,
                 bm.manifest_checksum AS backup_manifest_checksum
          FROM catalogue_import_plans p
          LEFT JOIN backups b ON b.id = ${input.backupId}
          LEFT JOIN catalogue_backup_manifests bm ON bm.backup_id = b.id
          WHERE p.id = ${planId}::uuid FOR UPDATE OF p
        `);
        const row = found.rows[0] as any;
        if (!row) throw new CatalogueImportError(404, "خطة الاستيراد غير موجودة");
        if (row.idempotency_key) {
          if (row.idempotency_actor_id !== actorId || row.idempotency_key !== idempotencyKey || row.request_hash !== requestHash) {
            throw new CatalogueImportError(409, "مفتاح التكرار مرتبط بطلب استيراد مختلف");
          }
          if (row.status === "applied") return { ...planResponse(row), replayed: true };
        }
        if (row.status !== "staged") throw new CatalogueImportError(409, "الخطة ليست جاهزة للتطبيق");
        if (row.target_id !== input.targetId || row.review_acknowledgement !== REVIEW_ACKNOWLEDGEMENT) {
          throw new CatalogueImportError(409, "بوابة الهدف أو المراجعة لم تتحقق");
        }
        if (row.backup_status !== "completed" || !row.backup_created_at || new Date(row.backup_created_at) < new Date(row.created_at)) {
          throw new CatalogueImportError(409, "يلزم نسخة احتياطية مكتملة ومأخوذة بعد تجهيز الخطة");
        }
        if (
          row.backup_target_identity !== row.target_identity
          || row.backup_snapshot_checksum !== row.snapshot_checksum
          || row.backup_manifest_checksum !== checksum({
            targetIdentity: row.backup_target_identity,
            snapshotChecksum: row.backup_snapshot_checksum,
          })
        ) {
          throw new CatalogueImportError(409, "النسخة الاحتياطية لا تثبت تغطية هدف وخلاصة الكتالوج لهذه الخطة");
        }
        const sources = loadSources();
        if (sources.sourceChecksum !== row.source_checksum) {
          throw new CatalogueImportError(409, "مصدر الكتالوج تغير بعد المراجعة؛ أعد تجهيز الخطة");
        }
        // Prevent both updates and inserts while validating and applying.
        // Row locks alone do not block a new SKU insertion after the snapshot.
        await tx.execute(sql`LOCK TABLE products, warehouse_items IN SHARE ROW EXCLUSIVE MODE`);
        const current = await currentCatalogue(tx);
        if (current.snapshotChecksum !== row.snapshot_checksum) {
          throw new CatalogueImportError(409, "كتالوج الهدف تغير بعد المراجعة؛ أعد تجهيز الخطة");
        }
        const payload = typeof row.staged_payload === "string" ? JSON.parse(row.staged_payload) : row.staged_payload;
        const recomputedPlanChecksum = checksum({
          targetId: payload.targetId,
          targetIdentity: payload.targetIdentity,
          sourceChecksum: payload.sourceChecksum,
          snapshotChecksum: payload.snapshotChecksum,
          operations: payload.operations,
        });
        if (
          row.target_identity !== payload.targetIdentity
          || row.plan_checksum !== payload.planChecksum
          || row.plan_checksum !== recomputedPlanChecksum
        ) {
          throw new CatalogueImportError(409, "بيانات الخطة المخزنة لم تعد تطابق بصمة الخطة المعتمدة");
        }
        if ((await getCatalogueTargetIdentity(tx)) !== row.target_identity) {
          throw new CatalogueImportError(409, "هوية قاعدة بيانات هدف الاستيراد تغيرت");
        }
        if (payload.reviewRequiredCount > 0) {
          throw new CatalogueImportError(409, "توجد صفوف لم تعتمد أو تؤجل صراحةً في مراجعة الخطة");
        }
        const operations = payload.operations as CatalogueImportOperation[];
        const executed: Record<string, unknown>[] = [];
        for (const operation of operations) executed.push(await applyCatalogueImportOperation(tx, planId, operation));
        const summary = {
          appliedAt: new Date().toISOString(),
          actorId,
          backupId: input.backupId,
          operations: executed,
          counts: Object.fromEntries(["keep", "adopt_code", "add", "deactivate", "hard_delete", "defer"]
            .map((action) => [action, operations.filter((op) => op.action === action).length])),
          rollbackPlan: payload.rollbackPlan,
        };
        await tx.execute(sql`
          UPDATE catalogue_import_plans
          SET status = 'applied', backup_id = ${input.backupId}, idempotency_actor_id = ${actorId},
              idempotency_key = ${idempotencyKey}, request_hash = ${requestHash},
              applied_summary = ${JSON.stringify(summary)}::jsonb, applied_at = now(), updated_at = now()
          WHERE id = ${planId}::uuid
        `);
        // Keep an immutable system-audit trail inside the same transaction as
        // the catalogue metadata. The full rollback guidance is retained on
        // the staged plan/summary; no operational history is altered.
        await tx.execute(sql`
          INSERT INTO system_audit_logs (
            module, entity_id, entity_name, action, details, user_id, description
          ) VALUES (
            'catalogue_import', ${planId}, 'authoritative_catalogue', 'apply',
            ${JSON.stringify(summary)}::text, ${actorId},
            'Applied reviewed authoritative catalogue plan'
          )
        `);
        return { ...payload, id: planId, status: "applied", summary, replayed: false };
      });
      res.json(response);
    } catch (error) {
      const known = error as CatalogueImportError;
      res.status(known.status || 400).json({ error: known.message || "تعذر تطبيق خطة الكتالوج" });
    }
  });
}