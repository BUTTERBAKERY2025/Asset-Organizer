import type { Express, Request, RequestHandler } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import { createHash } from "crypto";
import { pool } from "./db";
import { isAuthenticated, requirePermission, getAllowedBranchIds } from "./auth";
import { reverseCanonical, reverseInspectionAllowed, reverseQuantityAllowed, reverseReceiptAllowed, reverseWriteoffAllowed, reverseReleaseLots } from "@shared/reverse-logistics";

// Main warehouse is represented by null ONLY inside this module. It is never a
// second balance: warehouse_items.current_stock is its authoritative balance.
const id = z.coerce.number().int().positive();
const quantity = z.number().finite().positive().max(1000000).refine(v =>
  Math.abs(v * 1000000 - Math.round(v * 1000000)) < 0.00001);
const createKey = z.string().min(8).max(128).regex(/^[\w.:-]+$/);
const create = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("material_return"), originalTransferItemId: id, quantity, notes: z.string().max(2000).optional(), idempotencyKey: createKey }).strict(),
  z.object({ kind: z.literal("product_return"), originalOrderItemId: id, component: z.enum(["original", "substitute"]), quantity, notes: z.string().max(2000).optional(), idempotencyKey: createKey }).strict(),
  z.object({ kind: z.literal("warehouse_transfer"), itemId: id, sourceWarehouseId: id.nullable(), destinationWarehouseId: id.nullable(), quantity, notes: z.string().max(2000).optional(), idempotencyKey: createKey }).strict(),
]);
const action = z.object({
  idempotencyKey: z.string().min(8).max(128).regex(/^[\w.:-]+$/),
  receivedQuantity: z.number().finite().min(0).max(1000000).optional(),
  usableQuantity: z.number().finite().min(0).max(1000000).optional(),
  damagedQuantity: z.number().finite().min(0).max(1000000).optional(),
  carrierName: z.string().trim().min(1).max(200).optional(),
  vehicleNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
}).strict();
const micros = (v: unknown): bigint => BigInt(Math.round(Number(v) * 1000000));
const exact = (v: unknown, integer: boolean): boolean =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && (integer ? Number.isInteger(v) : Math.abs(v * 1000000 - Math.round(v * 1000000)) < 0.00001);
const num = (v: bigint) => Number(v) / 1000000;
class Reject extends Error { constructor(message: string, public status = 409) { super(message); } }
const rows = async (c: PoolClient, text: string, values: unknown[] = []) => (await c.query(text, values)).rows;
const scope = (req: Request, branch: string) => {
  const allowed = getAllowedBranchIds(req);
  return allowed === null || allowed.includes(branch);
};
const actor = (req: Request) => {
  if (!req.currentUser?.id) throw new Reject("Authentication required", 401);
  return req.currentUser.id;
};
const permit = (req: Request, row: any, mode: "source" | "destination") => {
  const branch = mode === "source" ? row.source_branch_id : row.destination_branch_id;
  // Warehouses aren't branch IDs; warehouse module permission is independently
  // enforced by route middleware and only warehouse managers can operate them.
  if (branch && !scope(req, branch)) throw new Reject("Branch access denied", 403);
};
async function provenance(c: PoolClient, row: any) {
  if (row.kind === "material_return") {
    const original = (await rows(c, `SELECT t.status,t.source_type,t.source_branch_id,t.destination_branch_id,i.item_id,i.unit,i.received_quantity,w.is_active
      FROM material_transfer_items i JOIN material_transfers t ON t.id=i.transfer_id
      JOIN warehouse_items w ON w.id=i.item_id WHERE i.id=$1 FOR UPDATE OF i`,
      [row.original_transfer_item_id]))[0];
    if (!original || original.status !== "delivered" || original.destination_branch_id !== row.source_branch_id ||
        !(original.source_type === "warehouse" || original.source_branch_id === "main_warehouse") ||
        !original.is_active || original.item_id !== row.item_id || original.unit !== row.unit || original.received_quantity == null)
      throw new Reject("Confirmed delivered material receipt required");
    return micros(original.received_quantity);
  }
  if (row.kind === "product_return") {
    const original = (await rows(c, `SELECT o.status,o.inventory_mode,o.request_branch_id,o.central_kitchen_id,
      i.product_id,i.substitute_product_id,i.unit,i.substitute_unit,i.received_quantity,i.substitute_quantity,
      (p.operations_enabled OR COALESCE(lower(btrim(p.is_active::text)),'') NOT IN ('false','inactive','0','f','no')) product_active,
      (sp.operations_enabled OR COALESCE(lower(btrim(sp.is_active::text)),'') NOT IN ('false','inactive','0','f','no')) substitute_active,
      d.receipt_attribution_basis,d.original_good_received_quantity,d.total_good_received_quantity
      FROM central_kitchen_order_items i JOIN central_kitchen_orders o ON o.id=i.order_id
      LEFT JOIN products p ON p.id=i.product_id
      LEFT JOIN products sp ON sp.id=i.substitute_product_id
      LEFT JOIN central_kitchen_demand_commitments d ON d.original_order_item_id=i.id
      WHERE i.id=$1 FOR UPDATE OF i`, [row.original_order_item_id]))[0];
    if (!original || original.status !== "received" || original.inventory_mode !== "real" ||
        original.request_branch_id !== row.source_branch_id || original.central_kitchen_id !== row.destination_branch_id ||
        !(row.component === "original" ? original.product_active : original.substitute_active) ||
        (row.component === "original" ? original.product_id : original.substitute_product_id) !== row.product_id ||
        (row.component === "original" ? original.unit : original.substitute_unit) !== row.unit)
      throw new Reject("Confirmed REAL kitchen receipt and product identity required");
    // The legacy receipt distributed a combined quantity original-first. Never
    // infer the identity of a substitute from that distribution.
    if (original.substitute_product_id && original.receipt_attribution_basis !== "branch_confirmed")
      throw new Reject("Confirm original/substitute receipt attribution before returning");
    if (!original.substitute_product_id && original.received_quantity == null)
      throw new Reject("Unknown original receipt");
    return original.substitute_product_id
      ? micros(row.component === "original" ? original.original_good_received_quantity : num(micros(original.total_good_received_quantity) - micros(original.original_good_received_quantity)))
      : micros(original.received_quantity);
  }
  return null;
}
async function reserve(c: PoolClient, row: any) {
  const q = row.quantity;
  if (row.kind === "product_return") {
    if (!Number.isInteger(Number(q))) throw new Reject("Product quantity must be whole pieces",400);
    let left = Number(q);
    const stocks = await rows(c,`SELECT id,quantity-reserved_quantity available FROM finished_goods_inventory
      WHERE branch_id=$1 AND product_id=$2 AND unit=$3 ORDER BY production_date,id FOR UPDATE`,
      [row.source_branch_id,row.product_id,row.unit]);
    for (const stock of stocks) {
      const take = Math.min(left,Number(stock.available));
      if (take > 0) {
        await c.query("UPDATE finished_goods_inventory SET reserved_quantity=reserved_quantity+$1 WHERE id=$2",[take,stock.id]);
        await c.query("INSERT INTO reverse_product_reservations(movement_id,stock_id,quantity) VALUES($1,$2,$3)",[row.id,stock.id,take]);
        left -= take;
      }
      if (!left) break;
    }
    if (left) throw new Reject("Insufficient unreserved finished goods");
  } else if (row.source_branch_id) {
    const r = await c.query(`UPDATE branch_stock SET reserved_quantity=reserved_quantity+$1,last_updated=now()
      WHERE branch_id=$2 AND item_id=$3 AND current_quantity-reserved_quantity >= $1 RETURNING id`,[q,row.source_branch_id,row.item_id]);
    if (!r.rowCount) throw new Reject("Insufficient unreserved branch stock");
  } else if (row.source_warehouse_id) {
    const r = await c.query(`UPDATE managed_warehouse_stock SET reserved_quantity=reserved_quantity+$1
      WHERE warehouse_id=$2 AND item_id=$3 AND quantity-reserved_quantity >= $1 RETURNING item_id`,[q,row.source_warehouse_id,row.item_id]);
    if (!r.rowCount) throw new Reject("Insufficient warehouse stock");
  } else {
    const r = await c.query(`UPDATE warehouse_items SET reverse_reserved_quantity=reverse_reserved_quantity+$1
      WHERE id=$2 AND current_stock-reverse_reserved_quantity >= $1 RETURNING id`,[q,row.item_id]);
    if (!r.rowCount) throw new Reject("Insufficient main warehouse stock");
  }
}
async function release(c: PoolClient, row: any) {
  if (row.kind === "product_return") {
    const reservations = await rows(c,"SELECT * FROM reverse_product_reservations WHERE movement_id=$1 ORDER BY stock_id",[row.id]);
    for (const r of reservations) await c.query("UPDATE finished_goods_inventory SET reserved_quantity=reserved_quantity-$1 WHERE id=$2",[r.quantity,r.stock_id]);
    await c.query("DELETE FROM reverse_product_reservations WHERE movement_id=$1",[row.id]);
  } else if (row.source_branch_id)
    await c.query("UPDATE branch_stock SET reserved_quantity=reserved_quantity-$1 WHERE branch_id=$2 AND item_id=$3",[row.quantity,row.source_branch_id,row.item_id]);
  else if (row.source_warehouse_id)
    await c.query("UPDATE managed_warehouse_stock SET reserved_quantity=reserved_quantity-$1 WHERE warehouse_id=$2 AND item_id=$3",[row.quantity,row.source_warehouse_id,row.item_id]);
  else await c.query("UPDATE warehouse_items SET reverse_reserved_quantity=reverse_reserved_quantity-$1 WHERE id=$2",[row.quantity,row.item_id]);
}
async function debit(c: PoolClient, row: any) {
  const q = row.quantity;
  if (row.kind === "product_return") {
    const stocks = await rows(c,"SELECT * FROM reverse_product_reservations WHERE movement_id=$1 ORDER BY stock_id",[row.id]);
    if (stocks.reduce((s,r)=>s+Number(r.quantity),0)!==Number(q)) throw new Reject("Missing finished goods reservation");
    for (const stock of stocks)
      await c.query("UPDATE finished_goods_inventory SET quantity=quantity-$1,reserved_quantity=reserved_quantity-$1,updated_at=now() WHERE id=$2",[stock.quantity,stock.stock_id]);
    // Keep source lot references until inspection so credited goods retain
    // their real production dates instead of becoming falsely fresh.
  } else if (row.source_branch_id) {
    const r = await c.query(`UPDATE branch_stock SET current_quantity=current_quantity-$1,reserved_quantity=reserved_quantity-$1,last_updated=now()
      WHERE branch_id=$2 AND item_id=$3 AND reserved_quantity >= $1 RETURNING id`, [q,row.source_branch_id,row.item_id]);
    if (!r.rowCount) throw new Reject("Insufficient unreserved branch stock");
  } else if (row.source_warehouse_id) {
    const r = await c.query(`UPDATE managed_warehouse_stock SET quantity=quantity-$1,reserved_quantity=reserved_quantity-$1
      WHERE warehouse_id=$2 AND item_id=$3 AND reserved_quantity >= $1 RETURNING item_id`, [q,row.source_warehouse_id,row.item_id]);
    if (!r.rowCount) throw new Reject("Insufficient warehouse stock");
  } else {
    const r = await c.query(`UPDATE warehouse_items SET current_stock=current_stock-$1,reverse_reserved_quantity=reverse_reserved_quantity-$1,updated_at=now()
      WHERE id=$2 AND reverse_reserved_quantity >= $1 RETURNING id`, [q,row.item_id]);
    if (!r.rowCount) throw new Reject("Insufficient main warehouse stock");
  }
}
async function credit(c: PoolClient, row: any, q: number) {
  if (q <= 0) return;
  if (row.kind === "product_return") {
    const lots = await rows(c,`SELECT r.quantity, f.production_date FROM reverse_product_reservations r
      JOIN finished_goods_inventory f ON f.id=r.stock_id
      WHERE r.movement_id=$1 ORDER BY f.production_date,r.stock_id`,[row.id]);
    let credits: ReturnType<typeof reverseReleaseLots>;
    try {
      credits = reverseReleaseLots(lots.map(lot => ({ quantity: Number(lot.quantity), productionDate:lot.production_date })),q);
    } catch {
      throw new Reject("Original production lot attribution is unavailable");
    }
    for (const lot of credits) {
      await c.query(`INSERT INTO finished_goods_inventory
      (branch_id,product_id,product_name,product_name_normalized,quantity,reserved_quantity,unit,production_date)
      VALUES ($1,$2,$3,lower(btrim($3)), $4,0,$5,$6)
      ON CONFLICT (branch_id,product_id,production_date,unit) WHERE product_id IS NOT NULL
      DO UPDATE SET quantity=finished_goods_inventory.quantity+EXCLUDED.quantity,updated_at=now()`,
      [row.destination_branch_id,row.product_id,row.item_name,lot.quantity,row.unit,lot.productionDate]);
    }
  } else if (row.destination_warehouse_id) {
    await c.query(`INSERT INTO managed_warehouse_stock(warehouse_id,item_id,quantity) VALUES($1,$2,$3)
      ON CONFLICT(warehouse_id,item_id) DO UPDATE SET quantity=managed_warehouse_stock.quantity+EXCLUDED.quantity`,
      [row.destination_warehouse_id,row.item_id,q]);
  } else {
    await c.query("UPDATE warehouse_items SET current_stock=COALESCE(current_stock,0)+$1,updated_at=now() WHERE id=$2", [q,row.item_id]);
  }
}
async function recordStock(c: PoolClient, row: any, q: number, side: "source" | "destination", actorId: string) {
  if (!q) return;
  const outgoing = side === "source", signed = outgoing ? -q : q;
  const branch = outgoing ? row.source_branch_id : row.destination_branch_id;
  const warehouse = outgoing ? row.source_warehouse_id : row.destination_warehouse_id;
  const type = outgoing ? "transfer_out" : "transfer_in";
  const referenceId = Number(row.id);
  if (!Number.isSafeInteger(referenceId) || referenceId > 2147483647) throw new Reject("Movement audit reference exceeds canonical log range");
  if (row.kind === "product_return") {
    const balance = (await rows(c,`SELECT COALESCE(sum(quantity),0)::int balance FROM finished_goods_inventory
      WHERE branch_id=$1 AND product_id=$2`,[branch,row.product_id]))[0].balance;
    await c.query(`INSERT INTO production_inventory_logs
      (branch_id,product_id,product_name,movement_type,quantity,balance_before,balance_after,reference_type,reference_id,notes,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,'reverse_movement',$8,$9,$10)`,
      [branch,row.product_id,row.item_name,type,signed,Number(balance)-signed,Number(balance),referenceId,
       `حركة إرجاع #${referenceId}: ${outgoing ? "خروج" : "صالح بعد الفحص"}`,actorId]);
    return;
  }
  let balance: number;
  if (branch) balance = Number((await rows(c,"SELECT current_quantity balance FROM branch_stock WHERE branch_id=$1 AND item_id=$2",[branch,row.item_id]))[0]?.balance ?? 0);
  else if (warehouse) balance = Number((await rows(c,"SELECT quantity balance FROM managed_warehouse_stock WHERE warehouse_id=$1 AND item_id=$2",[warehouse,row.item_id]))[0]?.balance ?? 0);
  else balance = Number((await rows(c,"SELECT current_stock balance FROM warehouse_items WHERE id=$1",[row.item_id]))[0]?.balance ?? 0);
  if (warehouse) {
    await c.query(`INSERT INTO managed_warehouse_movement_logs
      (warehouse_id,item_id,movement_id,movement_type,quantity,balance_before,balance_after,actor_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [warehouse,row.item_id,referenceId,type,signed,balance-signed,balance,actorId]);
  } else {
    await c.query(`INSERT INTO warehouse_movement_logs
      (item_id,branch_id,movement_type,quantity,balance_before,balance_after,reference_type,reference_id,notes,created_by)
      VALUES($1,$2,$3,$4,$5,$6,'reverse_movement',$7,$8,$9)`,
      [row.item_id,branch,type,q,balance-signed,balance,referenceId,
       `حركة إرجاع/نقل #${referenceId}: ${outgoing ? "خروج" : "صالح بعد الفحص"}`,actorId]);
  }
}

export function registerReverseLogisticsRoutes(app: Express) {
  const permission = (mode: "view" | "edit"): RequestHandler => (req,res,next) => {
    // Branch managers may manage their own returns without gaining access to
    // the warehouse module's unrelated stock editing endpoints.
    const module = req.currentUser?.role === "branch_manager" ? "central_kitchen_orders" : "warehouse";
    return requirePermission(module,mode)(req,res,next);
  };
  const warehouseView = [isAuthenticated,permission("view")] as const;
  const warehouseEdit = [isAuthenticated,permission("edit")] as const;
  const globalWarehouse = (req: Request) => ["admin","operations_manager"].includes(req.currentUser?.role ?? "") &&
    getAllowedBranchIds(req) === null;
  // Match the existing material-transfer main-warehouse authority. Inspection
  // is not write-off approval: the warehouse custodian can inspect, but cannot
  // acquire operations-manager disposal authority through this predicate.
  const mainWarehouseReceiver = (req: Request) => globalWarehouse(req) ||
    req.currentUser?.role === "production_development_manager" ||
    (req.currentUser?.branchId === "main_warehouse" && scope(req, "main_warehouse"));
  const run = async (req: Request, res: any, fn: (c: PoolClient) => Promise<any>) => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const result = await fn(c);
      await c.query("COMMIT");
      res.json(result);
    } catch (e: any) {
      await c.query("ROLLBACK");
      res.status(e instanceof z.ZodError ? 400 : e instanceof Reject ? e.status : 500)
        .json({ message: e instanceof z.ZodError ? e.issues.map(i => i.message).join("; ") : e instanceof Reject ? e.message : "Reverse logistics failed" });
    } finally { c.release(); }
  };
  app.get("/api/reverse-logistics/warehouses", ...warehouseView, async (req,res) => run(req,res,async c => {
    if (!globalWarehouse(req)) throw new Reject("Global warehouse manager required",403);
    return rows(c,"SELECT id,name,active FROM managed_warehouses ORDER BY id");
  }));
  app.get("/api/reverse-logistics/sources", ...warehouseView, async (req,res) => run(req,res,async c => {
    const allowed = getAllowedBranchIds(req);
    const materials = await rows(c,`SELECT i.id,t.transfer_number reference,t.destination_branch_id source_branch_id,
      i.item_name name,i.unit,i.received_quantity quantity
      FROM material_transfer_items i JOIN material_transfers t ON t.id=i.transfer_id
      JOIN warehouse_items w ON w.id=i.item_id AND w.is_active=true
      WHERE t.status='delivered' AND i.received_quantity IS NOT NULL AND i.received_quantity>0
        AND (t.source_type='warehouse' OR t.source_branch_id='main_warehouse')
        AND ($1::varchar[] IS NULL OR t.destination_branch_id=ANY($1::varchar[]))
      ORDER BY i.id DESC LIMIT 250`,[allowed]);
    const products = await rows(c,`SELECT i.id,o.order_number reference,o.request_branch_id source_branch_id,
      i.product_name name,i.unit,i.received_quantity quantity,
      i.substitute_product_id,i.substitute_product_name,i.substitute_unit,
      d.receipt_attribution_basis,d.original_good_received_quantity,d.total_good_received_quantity
      FROM central_kitchen_order_items i JOIN central_kitchen_orders o ON o.id=i.order_id
      JOIN products p ON p.id=i.product_id
        AND (p.operations_enabled=true OR COALESCE(lower(btrim(p.is_active::text)),'') NOT IN ('false','inactive','0','f','no'))
      LEFT JOIN central_kitchen_demand_commitments d ON d.original_order_item_id=i.id
      WHERE o.status='received' AND o.inventory_mode='real' AND i.product_id IS NOT NULL
        AND ($1::varchar[] IS NULL OR o.request_branch_id=ANY($1::varchar[]))
      ORDER BY i.id DESC LIMIT 250`,[allowed]);
    return {materials,products};
  }));
  app.get("/api/reverse-logistics/items", ...warehouseView, async (req,res) => run(req,res,async c => {
    if (!globalWarehouse(req)) throw new Reject("Global warehouse manager required",403);
    return rows(c,"SELECT id,name,unit,current_stock FROM warehouse_items WHERE is_active=true ORDER BY name LIMIT 1000");
  }));
  app.get("/api/reverse-logistics/stock", ...warehouseView, async (req,res) => run(req,res,async c => {
    if (!globalWarehouse(req)) throw new Reject("Global warehouse manager required",403);
    return rows(c,`SELECT s.warehouse_id,w.name warehouse_name,s.item_id,i.name item_name,i.unit,
      s.quantity,s.reserved_quantity FROM managed_warehouse_stock s
      JOIN managed_warehouses w ON w.id=s.warehouse_id JOIN warehouse_items i ON i.id=s.item_id
      ORDER BY w.name,i.name LIMIT 2000`);
  }));
  app.post("/api/reverse-logistics/warehouses", ...warehouseEdit, async (req,res) => run(req,res,async c => {
    if (!globalWarehouse(req)) throw new Reject("Global warehouse manager required",403);
    const name = z.string().trim().min(2).max(150).parse(req.body.name);
    return (await rows(c,"INSERT INTO managed_warehouses(name) VALUES($1) RETURNING *",[name]))[0];
  }));
  app.get("/api/reverse-logistics", ...warehouseView, async (req,res) => run(req,res,async c => {
    const allowed = getAllowedBranchIds(req);
    return rows(c,`SELECT m.*,m.shipped_quantity-m.received_quantity AS shortage_quantity,
      m.received_quantity-m.usable_quantity-m.written_off_quantity AS quarantine_quantity
      FROM reverse_movements m WHERE ($1::varchar[] IS NULL OR
      source_branch_id=ANY($1::varchar[]) OR destination_branch_id=ANY($1::varchar[])
      OR ($3::boolean AND m.kind='material_return'))
      AND ($2::boolean = true OR m.kind <> 'warehouse_transfer')
      ORDER BY m.id DESC LIMIT 250`,[allowed,globalWarehouse(req),mainWarehouseReceiver(req)]);
  }));
  app.get("/api/reverse-logistics/:id", ...warehouseView, async (req,res) => run(req,res,async c => {
    const row = (await rows(c,"SELECT * FROM reverse_movements WHERE id=$1",[id.parse(req.params.id)]))[0];
    if (!row) throw new Reject("Not found",404);
    if (row.kind === "warehouse_transfer" && !globalWarehouse(req)) throw new Reject("Global warehouse manager required",403);
    if (row.source_branch_id && !scope(req,row.source_branch_id) && !scope(req,row.destination_branch_id) &&
        !(row.kind === "material_return" && mainWarehouseReceiver(req))) throw new Reject("Branch access denied",403);
    return { ...row, events: await rows(c,"SELECT * FROM reverse_movement_events WHERE movement_id=$1 ORDER BY id",[row.id]) };
  }));
  app.post("/api/reverse-logistics", ...warehouseEdit, async (req,res) => run(req,res,async c => {
    const input = create.parse(req.body), userId = actor(req);
    const { idempotencyKey, ...businessInput } = input;
    const fingerprint = createHash("sha256").update(reverseCanonical(businessInput)).digest("hex");
    const previous = (await rows(c,"SELECT * FROM reverse_movements WHERE created_by=$1 AND create_key=$2",[userId,idempotencyKey]))[0];
    if (previous) {
      if (previous.create_fingerprint !== fingerprint) throw new Reject("Creation key reused with different payload");
      if (previous.kind === "warehouse_transfer" && !globalWarehouse(req)) throw new Reject("Global warehouse manager required",403);
      if (previous.source_branch_id) permit(req,previous,"source");
      return previous;
    }
    let origin: any, data: any;
    if (input.kind === "material_return") {
      origin = (await rows(c,`SELECT t.destination_branch_id source, i.item_id,i.item_name,i.unit
        FROM material_transfer_items i JOIN material_transfers t ON t.id=i.transfer_id
        JOIN warehouse_items w ON w.id=i.item_id AND w.is_active=true
        WHERE i.id=$1`,[input.originalTransferItemId]))[0];
      if (!origin) throw new Reject("Original transfer line not found",404);
      data = { source: origin.source,item: origin.item_id,name:origin.item_name,unit:origin.unit,originalTransfer:input.originalTransferItemId };
    } else if (input.kind === "product_return") {
      origin = (await rows(c,`SELECT o.request_branch_id source,o.central_kitchen_id destination,
        CASE WHEN $2='original' THEN i.product_id ELSE i.substitute_product_id END item,
        CASE WHEN $2='original' THEN i.product_name ELSE i.substitute_product_name END name,
        CASE WHEN $2='original' THEN i.unit ELSE i.substitute_unit END unit
        FROM central_kitchen_order_items i JOIN central_kitchen_orders o ON o.id=i.order_id
        JOIN products p ON p.id=CASE WHEN $2='original' THEN i.product_id ELSE i.substitute_product_id END
          AND (p.operations_enabled=true OR COALESCE(lower(btrim(p.is_active::text)),'') NOT IN ('false','inactive','0','f','no'))
        WHERE i.id=$1`,
        [input.originalOrderItemId,input.component]))[0];
      if (!origin?.item) throw new Reject("Original product identity not found",404);
      data = { source:origin.source,destination:origin.destination,product:origin.item,name:origin.name,unit:origin.unit,originalOrder:input.originalOrderItemId,component:input.component };
    } else {
      if (!globalWarehouse(req)) throw new Reject("Global warehouse manager required",403);
      if (input.sourceWarehouseId === input.destinationWarehouseId) throw new Reject("Choose distinct real warehouses and/or main warehouse",400);
      const active = await rows(c,"SELECT id FROM managed_warehouses WHERE active AND id=ANY($1::bigint[])",[[input.sourceWarehouseId,input.destinationWarehouseId].filter(Boolean)]);
      if (active.length !== [input.sourceWarehouseId,input.destinationWarehouseId].filter(Boolean).length) throw new Reject("Inactive or unknown warehouse",400);
      origin = (await rows(c,"SELECT id,name,unit FROM warehouse_items WHERE id=$1 AND is_active=true",[input.itemId]))[0];
      if (!origin) throw new Reject("Active material required",400);
      data = { sourceWarehouse:input.sourceWarehouseId,destinationWarehouse:input.destinationWarehouseId,item:origin.id,name:origin.name,unit:origin.unit };
    }
    if (data.source) permit(req,{source_branch_id:data.source},"source");
    const r = await rows(c,`INSERT INTO reverse_movements
      (kind,source_branch_id,destination_branch_id,source_warehouse_id,destination_warehouse_id,
       original_transfer_item_id,original_order_item_id,component,item_id,product_id,item_name,unit,quantity,notes,created_by,create_key,create_fingerprint)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT(created_by,create_key) DO NOTHING RETURNING *`,
      [input.kind,data.source??null,data.destination??null,data.sourceWarehouse??null,data.destinationWarehouse??null,
       data.originalTransfer??null,data.originalOrder??null,data.component??null,data.item??null,data.product??null,data.name,data.unit,input.quantity,input.notes??null,userId,idempotencyKey,fingerprint]);
    if (r.length) return r[0];
    const raced = (await rows(c,"SELECT * FROM reverse_movements WHERE created_by=$1 AND create_key=$2",[userId,idempotencyKey]))[0];
    if (!raced || raced.create_fingerprint !== fingerprint) throw new Reject("Creation key reused with different payload");
    return raced;
  }));
  app.post("/api/reverse-logistics/:id/:action", ...warehouseEdit, async (req,res) => run(req,res,async c => {
    const movementId = id.parse(req.params.id), op = z.enum(["request","cancel","dispatch","receive","inspect","writeoff"]).parse(req.params.action);
    const body = action.parse(req.body), userId = actor(req);
    // Lock the parent provenance row first for competing returns; for other
    // actions the movement lock serializes all transitions and retries.
    const head = (await rows(c,"SELECT * FROM reverse_movements WHERE id=$1",[movementId]))[0];
    if (!head) throw new Reject("Not found",404);
    if (op === "request" && head.original_transfer_item_id)
      await c.query("SELECT id FROM material_transfer_items WHERE id=$1 FOR UPDATE",[head.original_transfer_item_id]);
    if (op === "request" && head.original_order_item_id)
      await c.query("SELECT id FROM central_kitchen_order_items WHERE id=$1 FOR UPDATE",[head.original_order_item_id]);
    const row = (await rows(c,"SELECT * FROM reverse_movements WHERE id=$1 FOR UPDATE",[movementId]))[0];
    if (row.kind === "warehouse_transfer" && !globalWarehouse(req)) throw new Reject("Global warehouse manager required",403);
    if (row.kind === "material_return" && ["receive","inspect","writeoff"].includes(op) && !mainWarehouseReceiver(req))
      throw new Reject("Global warehouse manager required to receive material into main stock",403);
    permit(req,row,["receive","inspect","writeoff"].includes(op) ? "destination" : "source");
    if (op === "writeoff" && !["admin","operations_manager"].includes(req.currentUser?.role ?? ""))
      throw new Reject("Operations manager approval required",403);
    const prior = (await rows(c,"SELECT action,payload FROM reverse_movement_events WHERE movement_id=$1 AND idempotency_key=$2",[movementId,body.idempotencyKey]))[0];
    if (prior) {
      if (prior.action !== op || reverseCanonical(prior.payload) !== reverseCanonical(body)) throw new Reject("Idempotency key already used with different request");
      return row;
    }
    const permitted: Record<string,string> = { request:"draft",cancel:"requested",dispatch:"requested",receive:"dispatched",inspect:"received",writeoff:"inspected" };
    if (row.status !== permitted[op]) throw new Reject(`Cannot ${op} a ${row.status} movement`);
    const product = row.kind === "product_return";
    if (op === "request") {
      const max = await provenance(c,row);
      if (max !== null) {
        const used = (await rows(c,`SELECT COALESCE(sum(quantity),0) q FROM reverse_movements WHERE
          id<>$1 AND kind=$2 AND status NOT IN ('draft','cancelled') AND
          CASE WHEN $2='product_return' THEN original_order_item_id=$3 AND component=$4
               ELSE original_transfer_item_id=$5 END`,
          [row.id,row.kind,row.original_order_item_id,row.component,row.original_transfer_item_id]))[0];
        if (!reverseQuantityAllowed(micros(row.quantity),max,micros(used.q))) throw new Reject("Return exceeds confirmed received quantity less prior returns");
      }
      await reserve(c,row);
    }
    if (op === "cancel") await release(c,row);
    if (op === "dispatch") {
      if (!body.carrierName) throw new Reject("Carrier name required",400);
      await debit(c,row);
      await recordStock(c,row,Number(row.quantity),"source",userId);
    }
    if (op === "receive") {
      if (!exact(body.receivedQuantity,product) || !reverseReceiptAllowed(micros(body.receivedQuantity),micros(row.shipped_quantity)))
        throw new Reject("Received quantity must be nonnegative, exact, and no greater than shipped",400);
    }
    if (op === "inspect") {
      if (!exact(body.usableQuantity,product) || !exact(body.damagedQuantity,product) ||
          !reverseInspectionAllowed(micros(body.usableQuantity),micros(body.damagedQuantity),micros(row.received_quantity)))
        throw new Reject("Inspection must account for all received units as usable or damaged",400);
      await credit(c,row,body.usableQuantity!);
      await recordStock(c,row,body.usableQuantity!,"destination",userId);
    }
    if (op === "writeoff") {
      if (!body.notes || !exact(body.damagedQuantity,product) || micros(body.damagedQuantity) <= BigInt(0) ||
          !reverseWriteoffAllowed(micros(body.damagedQuantity),micros(row.damaged_quantity),micros(row.written_off_quantity)))
        throw new Reject("Write-off requires reason and available damaged quarantine quantity",400);
    }
    const next = {request:"requested",cancel:"cancelled",dispatch:"dispatched",receive:"received",inspect:"inspected",writeoff:"inspected"}[op];
    const result = (await rows(c,`UPDATE reverse_movements SET status=$2,updated_at=now(),
      shipped_quantity=CASE WHEN $3='dispatch' THEN quantity ELSE shipped_quantity END,
      received_quantity=CASE WHEN $3='receive' THEN $4 ELSE received_quantity END,
      usable_quantity=CASE WHEN $3='inspect' THEN $5 ELSE usable_quantity END,
      damaged_quantity=CASE WHEN $3='inspect' THEN $6 ELSE damaged_quantity END,
      written_off_quantity=CASE WHEN $3='writeoff' THEN written_off_quantity+$6 ELSE written_off_quantity END,
      carrier_name=CASE WHEN $3='dispatch' THEN $7 ELSE carrier_name END,
      vehicle_number=CASE WHEN $3='dispatch' THEN $8 ELSE vehicle_number END
      WHERE id=$1 RETURNING *`,[movementId,next,op,body.receivedQuantity??0,body.usableQuantity??0,body.damagedQuantity??0,body.carrierName??null,body.vehicleNumber??null]))[0];
    await c.query("INSERT INTO reverse_movement_events(movement_id,action,actor_id,idempotency_key,payload) VALUES($1,$2,$3,$4,$5)",
      [movementId,op,userId,body.idempotencyKey,JSON.stringify(body)]);
    return result;
  }));
}