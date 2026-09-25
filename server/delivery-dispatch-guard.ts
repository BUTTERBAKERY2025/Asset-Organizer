import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import type { DeliverySource } from "@shared/delivery";

/** One canonical source-availability fingerprint for both handover and stock dispatch. */
export function deliverySourceFingerprint(items: DeliverySource["items"]): string {
  return createHash("sha256").update(JSON.stringify(items.map(i => [
    Number(i.id), i.name, Number(i.quantity), i.unit,
    i.originalQuantity == null ? null : Number(i.originalQuantity),
    i.substituteQuantity == null ? null : Number(i.substituteQuantity),
    i.substituteProductId ?? null, i.substituteWarehouseItemId ?? null,
    i.substituteName ?? null, i.substituteUnit ?? null,
  ]))).digest("hex");
}

export type DispatchSourceType =
  | "kitchen" | "material_transfer" | "finished_goods_transfer"
  | "kitchen_warehouse_shipment" | "reverse_movement";
export type DispatchItem = { id: number; quantity: number; unit: string };
type DrizzleExecutor = { execute: (statement: SQL) => Promise<unknown> };
type DispatchTx = PoolClient | DrizzleExecutor;

/** The caller must lock the source header before calling this guard. */
export class DeliveryDispatchConflict extends Error {
  readonly status = 409;
  readonly statusCode = 409;
  constructor(message: string) { super(message); }
}

async function rows(tx: DispatchTx, statement: SQL, pgText: string, args: unknown[]) {
  // Drizzle transactions expose a relational `query` object; only node-pg
  // PoolClient.query is callable. Never use property presence as this check.
  if (typeof (tx as PoolClient).query === "function")
    return (await (tx as PoolClient).query(pgText, args)).rows;
  const result = await (tx as DrizzleExecutor).execute(statement);
  return Array.isArray(result) ? result : (result as { rows: any[] }).rows;
}

function normalize(items: DispatchItem[]) {
  return items.map(item => ({
    id: Number(item.id), quantity: Number(item.quantity), unit: String(item.unit),
  })).sort((a, b) => a.id - b.id);
}

/**
 * Require an active driver and a signed-off physical handover, frozen for
 * precisely this source's contents. For kitchen orders, pass the *actual*
 * dispatch quantities; prepared quantities can be greater than those sent.
 * This routine must run inside the same stock-posting transaction, after the
 * source header lock and before any stock debit.
 */
export async function assertDeliveryDispatchReady(
  tx: DispatchTx,
  source: { sourceType: DispatchSourceType; sourceId: number; items?: DispatchItem[] },
): Promise<{ driverId: string; driverName: string; vehicleNumber: string }> {
  const { sourceType, sourceId } = source;
  const [assignment] = await rows(tx,
    sql`SELECT a.*, concat_ws(' ',u.first_name,u.last_name) AS driver_name,
      u.is_active AS driver_active,u.job_title AS driver_job
      FROM delivery_assignments a JOIN users u ON u.id=a.driver_id
      WHERE a.source_type=${sourceType} AND a.source_id=${sourceId} FOR UPDATE OF a`,
    `SELECT a.*, concat_ws(' ',u.first_name,u.last_name) AS driver_name,
      u.is_active AS driver_active,u.job_title AS driver_job
      FROM delivery_assignments a JOIN users u ON u.id=a.driver_id
      WHERE a.source_type=$1 AND a.source_id=$2 FOR UPDATE OF a`, [sourceType, sourceId]);
  const missing = () => { throw new DeliveryDispatchConflict("يجب إسناد سائق نشط وتوثيق التسليم له ثم تأكيد السائق قبل إرسال الشحنة. افتح صفحة مهام التوصيل."); };
  if (!assignment || assignment.status !== "assigned" || assignment.driver_active !== "active"
    || assignment.driver_job !== "delivery") missing();
  if (!assignment.handover_recorded_at || !assignment.handover_acknowledged_at
    || assignment.handover_acknowledged_at < assignment.handover_recorded_at
    || assignment.handover_driver_id !== assignment.driver_id
    || assignment.handover_vehicle_number !== assignment.vehicle_number
    || !assignment.handover_fingerprint || !Array.isArray(assignment.handover_items)
    || assignment.handover_revision < 1) missing();

  let actual: DispatchItem[];
  let sourceRows: Array<DispatchItem & { name: string }>;
  if (sourceType === "kitchen") {
    if (!source.items) throw new DeliveryDispatchConflict("بنود الإرسال الفعلية مطلوبة لمطابقة محضر التسليم");
    const sourceItems = await rows(tx,
      sql`SELECT id, CASE WHEN COALESCE(substitute_quantity,0)>0
          THEN product_name || ' (' || COALESCE(prepared_quantity,0)::text || ' ' || unit || ') + '
            || COALESCE(substitute_product_name,'بديل') || ' (' || substitute_quantity::text || ' '
            || COALESCE(substitute_unit,unit) || ')' ELSE product_name END AS name,
        COALESCE(prepared_quantity,0)+COALESCE(substitute_quantity,0) AS quantity, unit,
        COALESCE(prepared_quantity,0) AS "originalQuantity",
        COALESCE(substitute_quantity,0) AS "substituteQuantity",
        substitute_product_id AS "substituteProductId",
        substitute_warehouse_item_id AS "substituteWarehouseItemId",
        substitute_product_name AS "substituteName",
        substitute_unit AS "substituteUnit"
        FROM central_kitchen_order_items WHERE order_id=${sourceId} ORDER BY id`,
      `SELECT id, CASE WHEN COALESCE(substitute_quantity,0)>0
          THEN product_name || ' (' || COALESCE(prepared_quantity,0)::text || ' ' || unit || ') + '
            || COALESCE(substitute_product_name,'بديل') || ' (' || substitute_quantity::text || ' '
            || COALESCE(substitute_unit,unit) || ')' ELSE product_name END AS name,
        COALESCE(prepared_quantity,0)+COALESCE(substitute_quantity,0) AS quantity, unit,
        COALESCE(prepared_quantity,0) AS "originalQuantity",
        COALESCE(substitute_quantity,0) AS "substituteQuantity",
        substitute_product_id AS "substituteProductId",
        substitute_warehouse_item_id AS "substituteWarehouseItemId",
        substitute_product_name AS "substituteName",
        substitute_unit AS "substituteUnit"
        FROM central_kitchen_order_items WHERE order_id=$1 ORDER BY id`, [sourceId]);
    sourceRows = sourceItems;
    const units = new Map(sourceItems.map((item: any) => [Number(item.id), item.unit]));
    if (source.items.length !== sourceItems.length || source.items.some(item => !units.has(Number(item.id))))
      throw new DeliveryDispatchConflict("تغيرت بنود الطلب بعد توثيق التسليم؛ أعد توثيقها وتأكيد السائق");
    actual = source.items.map(item => ({ ...item, unit: String(units.get(Number(item.id))) }));
  } else {
    const queries: Record<Exclude<DispatchSourceType, "kitchen">, [SQL, string]> = {
      material_transfer: [sql`SELECT id, item_name AS name, quantity, unit FROM material_transfer_items WHERE transfer_id=${sourceId} ORDER BY id`,
        "SELECT id, item_name AS name, quantity, unit FROM material_transfer_items WHERE transfer_id=$1 ORDER BY id"],
      finished_goods_transfer: [sql`SELECT id, product_name AS name, quantity, unit FROM finished_goods_transfers WHERE id=${sourceId}`,
        "SELECT id, product_name AS name, quantity, unit FROM finished_goods_transfers WHERE id=$1"],
      kitchen_warehouse_shipment: [sql`SELECT id, product_name AS name, quantity, unit FROM kitchen_warehouse_shipments WHERE id=${sourceId}`,
        "SELECT id, product_name AS name, quantity, unit FROM kitchen_warehouse_shipments WHERE id=$1"],
      reverse_movement: [sql`SELECT id, item_name AS name, quantity, unit FROM reverse_movements WHERE id=${sourceId}`,
        "SELECT id, item_name AS name, quantity, unit FROM reverse_movements WHERE id=$1"],
    };
    const [statement, text] = queries[sourceType];
    sourceRows = await rows(tx, statement, text, [sourceId]) as Array<DispatchItem & { name: string }>;
    actual = sourceRows;
  }
  // This fingerprint freezes source availability independently from the
  // physical quantity handed over (which may be partial for kitchen orders).
  const currentFingerprint = deliverySourceFingerprint(sourceRows);
  if (currentFingerprint !== assignment.handover_fingerprint)
    throw new DeliveryDispatchConflict("تغير مصدر الشحنة بعد توثيق التسليم؛ أعد المحضر ثم تأكيد السائق");
  const frozen = normalize(assignment.handover_items);
  const current = normalize(actual);
  if (!current.length || new Set(current.map(item => item.id)).size !== current.length
    || JSON.stringify(current) !== JSON.stringify(frozen))
    throw new DeliveryDispatchConflict("بنود الشحنة أو كمياتها أو وحداتها لا تطابق محضر التسليم المؤكد؛ أعد توثيق المحضر وتأكيد السائق");
  return { driverId: assignment.driver_id, driverName: assignment.driver_name,
    vehicleNumber: assignment.vehicle_number };
}

/** Source cancellation and its delivery task are committed or rolled back together. */
export async function cancelDeliveryAssignmentForSource(
  tx: DispatchTx, source: { sourceType: DispatchSourceType; sourceId: number; actorId: string },
) {
  const { sourceType, sourceId, actorId } = source;
  const [assignment] = await rows(tx,
    sql`SELECT id,status FROM delivery_assignments WHERE source_type=${sourceType} AND source_id=${sourceId} FOR UPDATE`,
    "SELECT id,status FROM delivery_assignments WHERE source_type=$1 AND source_id=$2 FOR UPDATE", [sourceType, sourceId]);
  if (!assignment || assignment.status === "cancelled") return;
  if (!["assigned", "failed"].includes(assignment.status))
    throw new DeliveryDispatchConflict("لا يمكن إلغاء المصدر بعد انطلاق مهمة السائق");
  const reason = "أُلغي المصدر قبل المغادرة";
  await rows(tx,
    sql`UPDATE delivery_assignments SET status='cancelled',cancelled_at=now(),
      cancellation_reason=${reason},updated_at=now() WHERE id=${assignment.id}`,
    `UPDATE delivery_assignments SET status='cancelled',cancelled_at=now(),
      cancellation_reason=$2,updated_at=now() WHERE id=$1`, [assignment.id, reason]);
  await rows(tx,
    sql`INSERT INTO delivery_assignment_events(assignment_id,actor_id,action,from_status,to_status,detail)
      VALUES (${assignment.id},${actorId},'cancel',${assignment.status},'cancelled',${JSON.stringify({ reason, sourceCancelled: true })}::jsonb)`,
    `INSERT INTO delivery_assignment_events(assignment_id,actor_id,action,from_status,to_status,detail)
      VALUES ($1,$2,'cancel',$3,'cancelled',$4::jsonb)`,
    [assignment.id, actorId, assignment.status, JSON.stringify({ reason, sourceCancelled: true })]);
}