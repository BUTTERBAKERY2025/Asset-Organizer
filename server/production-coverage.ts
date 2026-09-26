import { sql } from "drizzle-orm";
import type { WorkplanSqlExecutor } from "./central-kitchen-workplan";
import type { ProductionCoverageMetadata, ProductionItemCoverage } from "@shared/production-coverage";

const LIMIT = 10000;
type Raw = Record<string, unknown>;
type Entry = {
  id: number; orderId: number; date: string; mode: unknown; status: unknown;
  productId: number | null; warehouseId: number | null; unit: string;
  substituteProductId?: number | null; substituteWarehouseId?: number | null; substituteUnit?: string | null;
  substitute: boolean; requested: unknown; prepared: unknown;
  progress: bigint; reason: string | null;
};
const row = (value: unknown): Raw => value as Raw;
const integer = (value: unknown): number | null => value !== null && value !== undefined
  && Number.isSafeInteger(Number(value)) ? Number(value) : null;
/** No floating-point arithmetic in the allocation simulation. */
export function micros(value: unknown): bigint | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value);
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
}
const amount = (value: bigint) => Number(value) / 1000000;
const identity = (kind: string, id: number, unit: string) => `${kind}:${id}:${unit}`;
const unknown = (reason: string): ProductionItemCoverage => ({
  status: "unknown", reason, persistedReserved: null, proposedFreeStock: null,
  prospectiveInProgress: null, remainingProductionNeed: null, inProgressGuaranteed: false,
});
const notApplicable = (reason: string): ProductionItemCoverage => ({ ...unknown(reason), status: "not_applicable" });
type Source = { key: string; quantity: unknown; reserved: unknown; kind: string; catalogId: number | null; unit: string; kitchen: string };
type Allocation = { itemId: number; orderId: number; key: string; quantity: unknown; dispatched?: unknown; released?: unknown; kind: string; catalogId: number | null; unit: string; kitchen: string; component: string; status: string; itemIdentityValid?: boolean };

/** Exported pure calculation permits checking conservation without a database. */
export function simulateProductionCoverage(
  entries: Entry[], sources: Source[], allocations: Allocation[], complete = true,
): Map<number, ProductionItemCoverage> {
  const result = new Map<number, ProductionItemCoverage>();
  if (!complete) {
    for (const entry of entries) result.set(entry.id, unknown("candidate_pool_truncated"));
    return result;
  }
  const pools = new Map<string, { free: bigint; reason: string | null }>();
  const reservedByItem = new Map<number, bigint>();
  const sourcesByKey = new Map<string, Source>();
  for (const source of sources) {
    const key = source.key;
    const current = micros(source.quantity), reserved = micros(source.reserved);
    const bad = current === null || reserved === null || reserved > current
      || source.catalogId === null || !source.unit || !source.kitchen;
    if (sourcesByKey.has(key)) pools.set(identity(source.kind, source.catalogId ?? -1, source.unit), { free: 0n, reason: "duplicate_source" });
    sourcesByKey.set(key, source);
    const poolKey = identity(source.kind, source.catalogId ?? -1, source.unit);
    const pool = pools.get(poolKey) ?? { free: 0n, reason: null };
    if (bad) pool.reason = "invalid_source_balance_or_identity";
    else pool.free += current - reserved;
    pools.set(poolKey, pool);
  }
  const allocationSum = new Map<string, bigint>();
  for (const a of allocations) {
    const source = sourcesByKey.get(a.key);
    const key = identity(source?.kind ?? a.kind, source?.catalogId ?? a.catalogId ?? -1, source?.unit ?? a.unit);
    const pool = pools.get(key) ?? { free: 0n, reason: "missing_allocation_source" };
    const quantity = micros(a.quantity), dispatched = micros(a.dispatched ?? "0"), released = micros(a.released ?? "0");
    const remaining = quantity !== null && dispatched !== null && released !== null
      ? quantity - dispatched - released : null;
    const validStatus = remaining !== null && (
      a.status === "reserved" && remaining === quantity && dispatched === 0n && released === 0n
      || a.status === "dispatched" && remaining === 0n && dispatched! > 0n
      || a.status === "released" && remaining === 0n && dispatched === 0n && released! > 0n
    );
    if (!source || quantity === null || quantity === 0n || remaining === null || remaining < 0n || !validStatus
      || source.kind !== a.kind || source.catalogId !== a.catalogId
      || source.unit !== a.unit || source.kitchen !== a.kitchen
      || a.itemIdentityValid === false
      || a.component !== "original" && a.component !== "substitute") pool.reason = "inconsistent_allocation_identity_or_quantity";
    else {
      allocationSum.set(a.key, (allocationSum.get(a.key) ?? 0n) + remaining);
      if (a.component === "original") reservedByItem.set(a.itemId, (reservedByItem.get(a.itemId) ?? 0n) + remaining);
    }
    pools.set(key, pool);
  }
  for (const source of sources) {
    const pool = pools.get(identity(source.kind, source.catalogId ?? -1, source.unit))!;
    const recorded = micros(source.reserved);
    if (recorded === null || (allocationSum.get(source.key) ?? 0n) !== recorded)
      pool.reason = "source_reservation_ledger_mismatch";
  }
  // Any uncertain approved REAL demand can compete with all matching pools.
  // No lower-priority request can safely claim that pool's free balance.
  for (const entry of entries) {
    if (entry.mode !== "real" || entry.status !== "approved" && entry.status !== "prepared") continue;
    const requested = micros(entry.requested), prepared = entry.prepared === null ? 0n : micros(entry.prepared);
    const own = reservedByItem.get(entry.id) ?? 0n;
    const uncertain = entry.status === "prepared"
      ? requested === null || prepared === null || prepared > requested
        || own !== prepared || entry.reason !== null
      : entry.substitute || (entry.productId === null) === (entry.warehouseId === null)
        || !entry.unit || requested === null || requested === 0n || prepared === null || prepared > 0n
        || entry.reason !== null || own > (requested ?? 0n);
    if (!uncertain) continue;
    const identities = [
      ...(entry.productId === null ? [] : [{ kind: "product", id: entry.productId, unit: entry.unit }]),
      ...(entry.warehouseId === null ? [] : [{ kind: "warehouse", id: entry.warehouseId, unit: entry.unit }]),
      ...(entry.substituteProductId == null ? [] : [{ kind: "product", id: entry.substituteProductId, unit: entry.substituteUnit }]),
      ...(entry.substituteWarehouseId == null ? [] : [{ kind: "warehouse", id: entry.substituteWarehouseId, unit: entry.substituteUnit }]),
    ];
    for (const [key, pool] of pools) {
      if (!identities.length || identities.some(({ kind, id, unit }) =>
        key.startsWith(`${kind}:${id}:`) && (!unit || key === identity(kind, id, unit))))
        pool.reason ??= "uncertain_competing_request";
    }
  }
  for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.orderId - b.orderId || a.id - b.id)) {
    if (entry.mode !== "real") {
      result.set(entry.id, entry.mode === "shadow" ? notApplicable("shadow_inventory_mode") : unknown("legacy_inventory_mode_unknown"));
      continue;
    }
    if (entry.status === "prepared") {
      const requested = micros(entry.requested), prepared = micros(entry.prepared);
      const own = reservedByItem.get(entry.id) ?? 0n;
      const key = identity(entry.productId !== null ? "product" : "warehouse", (entry.productId ?? entry.warehouseId ?? -1), entry.unit);
      const pool = pools.get(key);
      if ((entry.productId === null) === (entry.warehouseId === null) || !entry.unit
        || requested === null || prepared === null || prepared > requested || own !== prepared
        || entry.reason || !pool || pool.reason && pool.reason !== "uncertain_competing_request") {
        result.set(entry.id, unknown(pool?.reason ?? entry.reason ?? "prepared_reservation_unverified"));
      } else result.set(entry.id, { ...notApplicable("request_already_prepared"), persistedReserved: amount(own) });
      continue;
    }
    if (entry.status !== "approved") {
      result.set(entry.id, notApplicable("request_not_open_approved"));
      continue;
    }
    if (entry.substitute || (entry.productId === null) === (entry.warehouseId === null) || !entry.unit) {
      result.set(entry.id, unknown("ambiguous_original_or_substitute_identity"));
      continue;
    }
    const requested = micros(entry.requested), prepared = entry.prepared === null ? 0n : micros(entry.prepared);
    if (requested === null || requested === 0n || prepared === null || prepared > requested || entry.reason) {
      result.set(entry.id, unknown(entry.reason ?? "invalid_request_or_linked_batch_quantity"));
      continue;
    }
    const key = identity(entry.productId !== null ? "product" : "warehouse", (entry.productId ?? entry.warehouseId)!, entry.unit);
    const pool = pools.get(key);
    if (!pool || pool.reason) {
      result.set(entry.id, unknown(pool?.reason ?? "stock_source_unavailable"));
      continue;
    }
    const own = reservedByItem.get(entry.id) ?? 0n;
    if (prepared !== 0n || own > requested) {
      result.set(entry.id, unknown("reservation_exceeds_outstanding_demand"));
      continue;
    }
    const outstanding = requested - own;
    const proposed = outstanding < pool.free ? outstanding : pool.free;
    pool.free -= proposed;
    const afterStock = outstanding - proposed;
    const progress = entry.progress < afterStock ? entry.progress : afterStock;
    result.set(entry.id, {
      status: "calculated", reason: null, persistedReserved: amount(own),
      proposedFreeStock: amount(proposed), prospectiveInProgress: amount(progress),
      remainingProductionNeed: amount(afterStock - progress), inProgressGuaranteed: false,
    });
  }
  return result;
}

export async function getProductionCoverage(tx: WorkplanSqlExecutor, kitchenId: string): Promise<{
  items: Map<number, ProductionItemCoverage>; metadata: ProductionCoverageMetadata;
}> {
  // No date filter: hidden future requests compete for exactly the same stock.
  const requests = await tx.execute(sql`
    SELECT o.id AS order_id, o.needed_date, o.inventory_mode, o.status, i.id AS item_id,
      i.product_id, i.warehouse_item_id, i.unit, i.requested_quantity::text, i.prepared_quantity::text,
      i.substitute_quantity::text, i.substitute_product_id, i.substitute_warehouse_item_id, i.substitute_unit,
      i.dispatched_quantity::text, i.received_quantity::text,
      EXISTS (SELECT 1 FROM central_kitchen_demand_actions da
        WHERE da.replacement_order_item_id = i.id) AS replacement_item
    FROM central_kitchen_orders o JOIN central_kitchen_order_items i ON i.order_id = o.id
    WHERE o.central_kitchen_id = ${kitchenId} AND o.status IN ('approved', 'prepared')
    ORDER BY o.needed_date, o.id, i.id LIMIT ${LIMIT + 1}
  `);
  const complete = requests.rows.length <= LIMIT;
  const batches = await tx.execute(sql`
    SELECT b.central_kitchen_order_item_id AS item_id, b.branch_id, b.product_id, b.unit,
      b.quantity::text, b.status, i.product_id AS requested_product_id, i.unit AS requested_unit
    FROM daily_production_batches b
    JOIN central_kitchen_order_items i ON i.id = b.central_kitchen_order_item_id
    JOIN central_kitchen_orders o ON o.id = i.order_id
    WHERE o.central_kitchen_id = ${kitchenId} AND o.status = 'approved'
      AND b.status = 'in_progress'
  `);
  const progress = new Map<number, { quantity: bigint; reason: string | null }>();
  for (const raw of batches.rows) {
    const b = row(raw), id = integer(b.item_id);
    if (id === null) continue;
    const previous = progress.get(id) ?? { quantity: 0n, reason: null };
    const quantity = micros(b.quantity);
    if (quantity === null || quantity === 0n || b.branch_id !== kitchenId
      || b.product_id !== b.requested_product_id || b.unit !== b.requested_unit)
      previous.reason = "in_progress_identity_or_quantity_mismatch";
    else previous.quantity += quantity;
    progress.set(id, previous);
  }
  const stock = await tx.execute(sql`
    SELECT 'product:' || id AS key, 'product' AS kind, product_id AS catalog_id, unit,
      branch_id AS kitchen, quantity::text AS quantity, reserved_quantity::text AS reserved
    FROM finished_goods_inventory WHERE branch_id = ${kitchenId}
    UNION ALL
    SELECT 'warehouse:' || bs.id, 'warehouse', bs.item_id, wi.unit, bs.branch_id,
      bs.current_quantity::text, bs.reserved_quantity::text
    FROM branch_stock bs JOIN warehouse_items wi ON wi.id = bs.item_id WHERE bs.branch_id = ${kitchenId}
  `);
  // All allocations, including orders outside the visible cohort and closed orders,
  // must reconcile against the source's persisted reserved balance.
  const ledger = await tx.execute(sql`
    SELECT a.order_item_id, a.order_id, a.kind, a.catalog_id, a.unit, a.component, a.status,
      a.reserved_quantity::text AS quantity, a.dispatched_quantity::text AS dispatched,
      a.released_quantity::text AS released, o.central_kitchen_id AS kitchen,
      (i.id IS NOT NULL AND i.order_id = a.order_id
        AND CASE WHEN a.component = 'original'
          THEN (CASE WHEN a.kind = 'product' THEN i.product_id ELSE i.warehouse_item_id END) = a.catalog_id
            AND i.unit = a.unit
          ELSE (CASE WHEN a.kind = 'product' THEN i.substitute_product_id ELSE i.substitute_warehouse_item_id END) = a.catalog_id
            AND i.substitute_unit = a.unit END) AS item_identity_valid,
      CASE WHEN a.kind = 'product' THEN 'product:' || a.source_finished_goods_id
        ELSE 'warehouse:' || a.source_branch_stock_id END AS key
    FROM central_kitchen_inventory_allocations a
    JOIN central_kitchen_orders o ON o.id = a.order_id
    LEFT JOIN central_kitchen_order_items i ON i.id = a.order_item_id
    WHERE o.central_kitchen_id = ${kitchenId}
      OR (a.kind = 'product' AND a.source_finished_goods_id IN
      (SELECT id FROM finished_goods_inventory WHERE branch_id = ${kitchenId}))
      OR (a.kind = 'warehouse' AND a.source_branch_stock_id IN
      (SELECT id FROM branch_stock WHERE branch_id = ${kitchenId}))
  `);
  const entries: Entry[] = requests.rows.slice(0, LIMIT).map(raw => {
    const r = row(raw), id = integer(r.item_id)!;
    const linked = progress.get(id);
    return {
      id, orderId: integer(r.order_id)!, date: String(r.needed_date ?? ""),
      mode: r.inventory_mode, status: r.status, productId: integer(r.product_id),
      warehouseId: integer(r.warehouse_item_id), unit: String(r.unit ?? ""),
      substituteProductId: integer(r.substitute_product_id),
      substituteWarehouseId: integer(r.substitute_warehouse_item_id),
      substituteUnit: typeof r.substitute_unit === "string" ? r.substitute_unit : null,
      substitute: r.replacement_item === true || r.substitute_quantity !== null || r.substitute_product_id !== null
        || r.substitute_warehouse_item_id !== null || r.dispatched_quantity !== null || r.received_quantity !== null,
      requested: r.requested_quantity, prepared: r.prepared_quantity,
      progress: linked?.quantity ?? 0n, reason: linked?.reason ?? null,
    };
  });
  const sources: Source[] = stock.rows.map(raw => {
    const r = row(raw);
    return { key: String(r.key), kind: String(r.kind), catalogId: integer(r.catalog_id),
      unit: String(r.unit ?? ""), kitchen: String(r.kitchen ?? ""), quantity: r.quantity, reserved: r.reserved };
  });
  // An absent stock row is a verified zero only if the catalog identity/unit
  // exists. Otherwise absence cannot establish a numeric production need.
  const catalog = await tx.execute(sql`
    SELECT 'product' AS kind, id, unit FROM products WHERE product_type = 'finish'
    UNION ALL SELECT 'warehouse', id, unit FROM warehouse_items
  `);
  const catalogKeys = new Set(catalog.rows.map(raw => {
    const r = row(raw);
    return identity(String(r.kind), integer(r.id) ?? -1, String(r.unit ?? ""));
  }));
  for (const entry of entries) {
    if ((entry.productId === null) === (entry.warehouseId === null)) continue;
    const kind = entry.productId !== null ? "product" : "warehouse";
    const catalogId = (entry.productId ?? entry.warehouseId)!;
    const key = identity(kind, catalogId, entry.unit);
    if (!catalogKeys.has(key)) entry.reason = entry.reason ?? "catalog_identity_or_unit_unverified";
    if (catalogKeys.has(key) && !sources.some(s => identity(s.kind, s.catalogId ?? -1, s.unit) === key))
      sources.push({ key: `empty:${key}`, kind, catalogId, unit: entry.unit, kitchen: kitchenId,
        quantity: "0", reserved: "0" });
  }
  const allocations: Allocation[] = ledger.rows.map(raw => {
    const r = row(raw);
    return { key: String(r.key), itemId: integer(r.order_item_id) ?? -1, orderId: integer(r.order_id) ?? -1,
      kind: String(r.kind), catalogId: integer(r.catalog_id), unit: String(r.unit ?? ""),
      kitchen: String(r.kitchen ?? ""), component: String(r.component), status: String(r.status),
      itemIdentityValid: r.item_identity_valid === true, quantity: r.quantity,
      dispatched: r.dispatched, released: r.released };
  });
  const items = simulateProductionCoverage(entries, sources, allocations, complete);
  return { items,
    metadata: { status: complete && [...items.values()].every(item => item.status !== "unknown") ? "calculated" : "unknown",
      scope: "all_open_eligible_requests_current_state",
      complete, candidateLimit: LIMIT, candidateCount: requests.rows.length,
      note: "Approved REAL requests compete; prepared REAL reservations are evidence only, never a new free-stock demand. Unknown rows make coverage partial. Finished output is already stock; in-progress is prospective. Receipt shortfalls belong to the demand ledger." } };
}