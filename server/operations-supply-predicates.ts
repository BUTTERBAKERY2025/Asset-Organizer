import type { OperationsSupplySource } from "@shared/operations-supply";

export type SupplyActor = {
  id: string; role: string; branchId?: string | null;
  allowed: string[] | null;
};
export type SupplyGrants = {
  kitchenView: boolean; kitchenEdit: boolean; kitchenApprove: boolean;
  transferView: boolean; transferEdit: boolean; warehouseView: boolean; warehouseEdit: boolean;
  productionView: boolean; productionEdit: boolean; deliveryView: boolean; deliveryEdit: boolean; deliveryApprove: boolean;
  returnKinds: string[];
};
export type SupplySql = { from: string; where: string; select: string; order: string; values: unknown[] };

export const kitchenSupplyActiveSql = `(k.status IN ('requested','approved','prepared','dispatched')
  OR (k.status='received' AND k.discrepancy_status='open'))`;
export const reverseSupplyActiveSql = `(r.status IN ('draft','requested','dispatched','received')
  OR (r.status='inspected' AND r.damaged_quantity > r.written_off_quantity))`;
const globalWarehouse = (actor: SupplyActor) => ["admin", "operations_manager"].includes(actor.role) && actor.allowed === null;
export const supplyMainWarehouseAuthority = (actor: SupplyActor) => globalWarehouse(actor)
  || actor.role === "production_development_manager"
  || (actor.branchId === "main_warehouse" && actor.allowed?.includes("main_warehouse") === true);
export const supplyTransferSourceAuthority = (actor: SupplyActor, branch: string | null) =>
  actor.role === "admin" || actor.role !== "branch_manager" && !!branch
    && (actor.role === "warehouse_keeper" ? branch === "main_warehouse" && actor.allowed?.includes(branch) === true
      : branch === "main_warehouse" ? supplyMainWarehouseAuthority(actor) : actor.allowed === null || actor.allowed.includes(branch));
export const supplyDestinationAuthority = (actor: SupplyActor, branch: string | null) =>
  actor.role === "admin" || actor.role !== "warehouse_keeper" && !!branch
    && (actor.allowed === null || actor.allowed.includes(branch))
    && (actor.role !== "branch_manager" || branch !== "main_warehouse");

/**
 * Predicates mirror source routes: central kitchen canAccessCentralKitchenOrder;
 * material transfer branchSupplyTransferAllowed / keeper source scope;
 * reverse branchGrant + source scope + globalWarehouse/mainWarehouseReceiver;
 * delivery dto managerScope/receiverScope + actual action gates.
 * Parameters always carry the explicit selected scope separately from actor grants.
 */
export function operationsSupplySql(source: OperationsSupplySource, selected: string[], actor: SupplyActor, grants: SupplyGrants): SupplySql {
  const values: unknown[] = [selected, actor.allowed];
  const selectedSide = (s: string, d: string) => `(${s}=ANY($1::varchar[]) OR ${d}=ANY($1::varchar[]))`;
  const allowedSide = (b: string) => `($2::varchar[] IS NULL OR ${b}=ANY($2::varchar[]))`;
  if (source === "kitchen") {
    return {
      values, from: "central_kitchen_orders k LEFT JOIN central_kitchen_runtime kr ON kr.kitchen_id=k.central_kitchen_id", order: "k.id DESC",
      select: `k.id::text,k.status,k.central_kitchen_id AS source_branch_id,k.request_branch_id AS destination_branch_id,
        k.inventory_mode,k.needed_date::text,k.needed_time,k.discrepancy_status,kr.mode AS runtime_mode`,
      where: `${kitchenSupplyActiveSql} AND ${grants.kitchenView ? "true" : "false"} AND ${
        actor.role === "branch_manager"
          ? `k.request_branch_id=ANY($1::varchar[]) AND k.request_branch_id=ANY($2::varchar[])`
          : `${selectedSide("k.central_kitchen_id", "k.request_branch_id")} AND (${allowedSide("k.central_kitchen_id")} OR ${allowedSide("k.request_branch_id")})`}`,
    };
  }
  if (source === "transfers") {
    const visibility = actor.role === "branch_manager"
      ? `t.source_branch_id='main_warehouse' AND t.destination_branch_id<>'main_warehouse'
        AND t.destination_branch_id=ANY($1::varchar[]) AND t.destination_branch_id=ANY($2::varchar[])`
      : actor.role === "warehouse_keeper"
        ? `t.source_branch_id='main_warehouse' AND 'main_warehouse'=ANY($1::varchar[]) AND 'main_warehouse'=ANY($2::varchar[])`
        : `${selectedSide("t.source_branch_id", "t.destination_branch_id")} AND (${allowedSide("t.source_branch_id")} OR ${allowedSide("t.destination_branch_id")})`;
    return { values, from: "material_transfers t", order: "t.id DESC",
      select: "t.id::text,t.status,t.source_branch_id,t.destination_branch_id",
      where: `t.status IN ('pending','approved','in_transit') AND ${grants.transferView ? "true" : "false"} AND (${visibility})` };
  }
  if (source === "reverse") {
    values.push(grants.returnKinds);
    // Warehouse-to-warehouse movements have no branch endpoints. Only the
    // explicitly selected main_warehouse DESK, never an inferred movement
    // branch, can include them, and only for the source's global managers.
    const warehouseDesk = globalWarehouse(actor) && selected.includes("main_warehouse");
    const warehouseMovement = warehouseDesk ? "r.kind='warehouse_transfer'" : "false";
    // Null destination is main warehouse only for material_return, never every warehouse null.
    const destination = `CASE WHEN r.kind='material_return' AND r.destination_branch_id IS NULL
      AND r.destination_warehouse_id IS NULL THEN 'main_warehouse' ELSE r.destination_branch_id END`;
    const visibility = actor.role === "branch_manager"
      ? "r.source_branch_id=ANY($1::varchar[]) AND r.source_branch_id=ANY($2::varchar[])"
      : `(${selectedSide("r.source_branch_id", destination)} AND (${allowedSide("r.source_branch_id")}
        OR ${allowedSide("r.destination_branch_id")} OR ${supplyMainWarehouseAuthority(actor) ? "r.kind='material_return'" : "false"}))`;
    const scopedVisibility = actor.role === "branch_manager" ? visibility : `(${visibility} OR ${warehouseMovement})`;
    return { values, from: "reverse_movements r", order: "r.id DESC",
      select: `r.id::text,r.status,r.kind,r.source_branch_id,r.destination_branch_id,
        r.source_warehouse_id,r.destination_warehouse_id,r.damaged_quantity,r.written_off_quantity`,
      where: `${reverseSupplyActiveSql} AND r.kind=ANY($3::text[]) AND (${scopedVisibility})
        AND (${globalWarehouse(actor) ? "true" : "r.kind<>'warehouse_transfer'"})` };
  }
  const from = `(SELECT a.id,a.status,a.source_type,a.source_id,a.driver_id,a.scheduled_at,a.transport_mode,
      a.handover_recorded_at,a.receipt_approved_by,a.exception_reason,
      a.proof_at IS NOT NULL AND a.signature_data IS NOT NULL AS proof_present,
      (SELECT count(DISTINCT ca.kind)=2 FROM delivery_carrier_attachments ca
        WHERE ca.assignment_id=a.id AND ca.kind IN ('shipment_photo','carrier_receipt')) AS evidence_ready,
      CASE a.source_type WHEN 'kitchen' THEN k.central_kitchen_id WHEN 'material_transfer' THEN t.source_branch_id
        WHEN 'reverse_movement' THEN r.source_branch_id WHEN 'finished_goods_transfer' THEN f.source_branch_id
        WHEN 'kitchen_warehouse_shipment' THEN s.source_branch_id END AS source_branch_id,
      CASE a.source_type WHEN 'kitchen' THEN k.request_branch_id WHEN 'material_transfer' THEN t.destination_branch_id
        WHEN 'reverse_movement' THEN r.destination_branch_id WHEN 'finished_goods_transfer' THEN f.destination_branch_id END AS destination_branch_id,
      r.source_warehouse_id,r.kind,COALESCE(s.destination_warehouse_id,r.destination_warehouse_id) AS destination_warehouse_id,
      COALESCE(k.status,t.status,r.status,f.status,s.status) AS source_status,
      COALESCE(k.received_by,t.received_by,f.received_by,s.received_by,
        (SELECT e.actor_id FROM reverse_movement_events e WHERE e.movement_id=r.id AND e.action='receive' ORDER BY e.id DESC LIMIT 1)) AS received_by,
      k.inventory_mode
    FROM delivery_assignments a
    LEFT JOIN central_kitchen_orders k ON a.source_type='kitchen' AND k.id=a.source_id
    LEFT JOIN material_transfers t ON a.source_type='material_transfer' AND t.id=a.source_id
    LEFT JOIN reverse_movements r ON a.source_type='reverse_movement' AND r.id=a.source_id
    LEFT JOIN finished_goods_transfers f ON a.source_type='finished_goods_transfer' AND f.id=a.source_id
      AND f.destination_type='branch' AND f.transport_policy='branch_receipt'
    LEFT JOIN kitchen_warehouse_shipments s ON a.source_type='kitchen_warehouse_shipment' AND s.id=a.source_id
    WHERE a.status IN ('assigned','in_transit','awaiting_receipt','receipt_approved','failed')) d`;
  const moduleView = `(CASE d.source_type WHEN 'kitchen' THEN ${grants.kitchenView}
    WHEN 'material_transfer' THEN ${grants.transferView} WHEN 'reverse_movement' THEN ${actor.role === "branch_manager" ? grants.transferView : grants.warehouseView}
    WHEN 'finished_goods_transfer' THEN ${grants.productionView} WHEN 'kitchen_warehouse_shipment' THEN ${grants.warehouseView} ELSE false END)`;
  const moduleEdit = `(CASE d.source_type WHEN 'kitchen' THEN ${grants.kitchenEdit}
    WHEN 'material_transfer' THEN ${grants.transferEdit} WHEN 'reverse_movement' THEN ${actor.role === "branch_manager" ? grants.transferEdit : grants.warehouseEdit}
    WHEN 'finished_goods_transfer' THEN ${grants.productionEdit} WHEN 'kitchen_warehouse_shipment' THEN ${grants.warehouseEdit} ELSE false END)`;
  const main = supplyMainWarehouseAuthority(actor) || actor.role === "warehouse_keeper" && actor.allowed?.includes("main_warehouse") === true;
  let manager = actor.role === "branch_manager"
    ? `((d.destination_warehouse_id IS NULL AND d.destination_branch_id=ANY($2::varchar[]))
      OR (d.source_type='reverse_movement' AND d.source_branch_id=ANY($2::varchar[])
        AND (d.destination_warehouse_id IS NOT NULL OR d.destination_branch_id='main_warehouse')))`
    : actor.role === "warehouse_keeper"
      ? `d.source_type='material_transfer' AND d.source_branch_id='main_warehouse' AND ${main}`
      : `CASE
          WHEN d.source_type='reverse_movement' AND d.source_branch_id IS NULL
            THEN CASE WHEN d.source_warehouse_id IS NOT NULL THEN ${globalWarehouse(actor)} ELSE ${main} END
          WHEN d.source_branch_id IS NULL THEN false
          WHEN d.source_type='kitchen_warehouse_shipment' AND ${!["admin", "operations_manager", "production_development_manager"].includes(actor.role)} THEN false
          WHEN d.source_type='material_transfer' AND d.source_branch_id='main_warehouse' THEN ${supplyMainWarehouseAuthority(actor)}
          ELSE ${allowedSide("d.source_branch_id")} END`;
  manager = `((${manager}) AND ${moduleView} AND ${grants.deliveryView})`;
  const receiver = actor.role === "warehouse_keeper" ? "false"
    : actor.role === "branch_manager"
      ? `d.destination_warehouse_id IS NULL AND d.destination_branch_id=ANY($2::varchar[])`
      : `CASE WHEN d.destination_warehouse_id IS NOT NULL THEN ${globalWarehouse(actor)}
          WHEN d.source_type='reverse_movement' AND d.destination_branch_id IS NULL THEN ${main}
          WHEN d.destination_branch_id IS NULL THEN false ELSE ${allowedSide("d.destination_branch_id")} END`;
  const receipt = `((${receiver}) AND ${moduleEdit} AND ${grants.deliveryApprove})`;
  return { values, from, order: "d.id DESC",
    select: `d.id::text,d.status,d.source_type,d.source_id::text,d.source_branch_id,d.destination_branch_id,
      d.source_warehouse_id,d.destination_warehouse_id,d.kind,d.driver_id,d.scheduled_at,d.inventory_mode,
      d.source_status,d.received_by,d.proof_present,d.evidence_ready,d.transport_mode,
      d.handover_recorded_at,d.receipt_approved_by,d.exception_reason,
      ${receipt} AS can_receive,
      ((${manager}) AND ${grants.deliveryEdit} AND ${moduleEdit} AND ${actor.role !== "branch_manager"}) AS can_manage`,
    where: `d.source_status IS NOT NULL AND (${selectedSide("d.source_branch_id", "d.destination_branch_id")}
      OR (d.source_type='reverse_movement' AND d.kind='warehouse_transfer'
        AND ${globalWarehouse(actor) && selected.includes("main_warehouse")}))
      AND (${manager} OR ${receipt})` };
}