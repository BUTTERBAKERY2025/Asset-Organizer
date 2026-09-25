import type { Express, Request } from "express";
import type { PoolClient } from "pg";
import { createHash } from "crypto";
import { z } from "zod";
import { pool } from "./db";
import { isAuthenticated, requirePermission, getAllowedBranchIds } from "./auth";
import { shippingAction, shippingCreate, shippingId, allocateReceivedLots } from "@shared/kitchen-warehouse-shipping";
import { assertDeliveryDispatchReady, cancelDeliveryAssignmentForSource, DeliveryDispatchConflict } from "./delivery-dispatch-guard";

class ShippingError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
const rows = async (c: PoolClient, query: string, params: unknown[] = []) => (await c.query(query, params)).rows;
const fingerprint = (input: any) => createHash("sha256")
  .update(JSON.stringify(Object.fromEntries(Object.entries(input).sort(([a],[b]) => a.localeCompare(b)))))
  .digest("hex");
const actor = (req: Request) => {
  if (!req.currentUser?.id) throw new ShippingError("Authentication required", 401);
  return req.currentUser.id;
};
const inScope = (req: Request, branch: string) => {
  const allowed = getAllowedBranchIds(req);
  return allowed === null || allowed.includes(branch);
};
const warehouseManager = (req: Request) =>
  ["admin", "operations_manager"].includes(req.currentUser?.role ?? "") && getAllowedBranchIds(req) === null;
const kitchenManager = (req: Request, branch: string) =>
  inScope(req, branch) && (warehouseManager(req) ||
    req.currentUser?.role === "production_development_manager");
const assertKitchen = async (c: PoolClient, branch: string) => {
  const found = await rows(c, "SELECT id FROM branches WHERE id=$1 AND is_central_kitchen=true", [branch]);
  if (!found.length) throw new ShippingError("Source must be a central kitchen", 400);
};
const assertWarehouse = async (c: PoolClient, id: number) => {
  if (!(await rows(c, "SELECT id FROM managed_warehouses WHERE id=$1 AND active=true", [id])).length)
    throw new ShippingError("Active managed warehouse required", 400);
};

export function registerKitchenWarehouseShippingRoutes(app: Express) {
  const run = async (req: Request, res: any, fn: (c: PoolClient) => Promise<unknown>) => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const result = await fn(c);
      await c.query("COMMIT");
      res.json(result);
    } catch (error: any) {
      await c.query("ROLLBACK");
      res.status(error instanceof z.ZodError ? 400 : error instanceof ShippingError || error instanceof DeliveryDispatchConflict ? error.status : 500)
        .json({ message: error instanceof z.ZodError ? error.issues.map(i => i.message).join("; ") :
          error instanceof ShippingError || error instanceof DeliveryDispatchConflict ? error.message : "Kitchen warehouse shipping failed" });
    } finally { c.release(); }
  };
  const kitchenView = [isAuthenticated, requirePermission("production", "view")] as const;
  const kitchenCreate = [isAuthenticated, requirePermission("production", "create")] as const;
  const kitchenEdit = [isAuthenticated, requirePermission("production", "edit")] as const;
  const warehouseView = [isAuthenticated, requirePermission("warehouse", "view")] as const;
  const warehouseEdit = [isAuthenticated, requirePermission("warehouse", "edit")] as const;

  app.get("/api/kitchen-warehouse-shipping/sources", ...kitchenView, (req,res) => run(req,res,async c => {
    const scope = getAllowedBranchIds(req);
    return rows(c, `SELECT f.id,f.branch_id,f.product_id,f.product_name,f.unit,f.production_date,
      f.quantity,f.reserved_quantity,f.quantity-f.reserved_quantity AS available
      FROM finished_goods_inventory f
      JOIN branches b ON b.id=f.branch_id AND b.is_central_kitchen=true
      JOIN products p ON p.id=f.product_id
      WHERE f.quantity-f.reserved_quantity>0
        AND (p.operations_enabled=true OR COALESCE(lower(btrim(p.is_active::text)),'') NOT IN ('false','inactive','0','f','no'))
        AND ($1::varchar[] IS NULL OR f.branch_id=ANY($1::varchar[]))
      ORDER BY f.production_date,f.id LIMIT 1000`, [scope]);
  }));
  app.get("/api/kitchen-warehouse-shipping/warehouses", ...kitchenView, (req,res) => run(req,res,async c => {
    if (!req.currentUser) throw new ShippingError("Authentication required",401);
    return rows(c,"SELECT id,name FROM managed_warehouses WHERE active=true ORDER BY name");
  }));
  app.get("/api/kitchen-warehouse-shipping", isAuthenticated, (req,res,next) =>
    (warehouseManager(req) ? requirePermission("warehouse","view") : requirePermission("production","view"))(req,res,next),
    (req,res) => run(req,res,async c =>
    rows(c,`SELECT s.*,w.name destination_name FROM kitchen_warehouse_shipments s
      JOIN managed_warehouses w ON w.id=s.destination_warehouse_id
      WHERE ($2::boolean OR $1::varchar[] IS NULL OR s.source_branch_id=ANY($1::varchar[]))
      ORDER BY s.id DESC LIMIT 500`,[getAllowedBranchIds(req),warehouseManager(req)])));
  app.get("/api/kitchen-warehouse-shipping/stock", ...warehouseView, (req,res) => run(req,res,async c => {
    if (!warehouseManager(req)) throw new ShippingError("Global warehouse manager required",403);
    return rows(c,`SELECT s.*,w.name warehouse_name,p.name product_name
      FROM managed_warehouse_product_stock s
      JOIN managed_warehouses w ON w.id=s.warehouse_id
      JOIN products p ON p.id=s.product_id ORDER BY w.name,p.name,s.production_date LIMIT 2000`);
  }));
  app.post("/api/kitchen-warehouse-shipping", ...kitchenCreate, (req,res) => run(req,res,async c => {
    const body = shippingCreate.parse(req.body);
    const user = actor(req);
    const hash = fingerprint({stockId:body.stockId,warehouseId:body.warehouseId,quantity:body.quantity,notes:body.notes ?? ""});
    // Serialize create-key retries even when the first attempt has not committed.
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))",[user,body.idempotencyKey]);
    const previous = (await rows(c,"SELECT * FROM kitchen_warehouse_shipments WHERE created_by=$1 AND create_key=$2",[user,body.idempotencyKey]))[0];
    if (previous) {
      if (!kitchenManager(req,previous.source_branch_id))
        throw new ShippingError("Kitchen source permission and branch scope required",403);
      if (previous.create_fingerprint !== hash) throw new ShippingError("Idempotency key reused with different request");
      return previous;
    }
    const stock = (await rows(c,`SELECT f.*,p.operations_enabled,p.is_active FROM finished_goods_inventory f
      JOIN products p ON p.id=f.product_id WHERE f.id=$1 FOR UPDATE OF f`,[body.stockId]))[0];
    if (!stock || !stock.product_id) throw new ShippingError("Canonical finished product lot required",400);
    if (!stock.operations_enabled && ["false","inactive","0","f","no"].includes(String(stock.is_active).trim().toLowerCase()))
      throw new ShippingError("Product is inactive",400);
    if (!kitchenManager(req,stock.branch_id)) throw new ShippingError("Kitchen source permission and branch scope required",403);
    await assertKitchen(c,stock.branch_id);
    await assertWarehouse(c,body.warehouseId);
    if (stock.quantity-stock.reserved_quantity < body.quantity) throw new ShippingError("Insufficient unreserved finished goods");
    const shipment = (await rows(c,`INSERT INTO kitchen_warehouse_shipments
      (source_branch_id,destination_warehouse_id,product_id,product_name,unit,quantity,notes,created_by,create_key,create_fingerprint)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [stock.branch_id,body.warehouseId,stock.product_id,stock.product_name,stock.unit,body.quantity,body.notes ?? null,user,body.idempotencyKey,hash]))[0];
    await c.query("UPDATE finished_goods_inventory SET reserved_quantity=reserved_quantity+$1,updated_at=now() WHERE id=$2",[body.quantity,stock.id]);
    await c.query(`INSERT INTO kitchen_warehouse_shipment_lots(shipment_id,stock_id,production_date,quantity)
      VALUES($1,$2,$3,$4)`,[shipment.id,stock.id,stock.production_date,body.quantity]);
    await c.query(`INSERT INTO kitchen_warehouse_shipment_events(shipment_id,action,actor_id,idempotency_key,payload)
      VALUES($1,'requested',$2,$3,$4)`,[shipment.id,user,body.idempotencyKey,JSON.stringify(body)]);
    return shipment;
  }));
  app.post("/api/kitchen-warehouse-shipping/:id/:action", isAuthenticated, (req,res) => {
    const operation = req.params.action;
    if (!["dispatch","receive","cancel"].includes(operation)) return res.status(404).json({message:"Unknown action"});
    const middleware = operation === "receive" ? warehouseEdit : kitchenEdit;
    return middleware[1](req,res,() => run(req,res,async c => {
      const id = shippingId.parse(req.params.id);
      const body = shippingAction.parse(req.body);
      const user = actor(req);
      const shipment = (await rows(c,"SELECT * FROM kitchen_warehouse_shipments WHERE id=$1 FOR UPDATE",[id]))[0];
      if (!shipment) throw new ShippingError("Shipment not found",404);
      if (operation === "receive") {
        if (!warehouseManager(req)) throw new ShippingError("Global warehouse manager required",403);
      } else if (!kitchenManager(req,shipment.source_branch_id)) throw new ShippingError("Kitchen source permission and branch scope required",403);
      const existing = (await rows(c,"SELECT * FROM kitchen_warehouse_shipment_events WHERE shipment_id=$1 AND idempotency_key=$2",[id,body.idempotencyKey]))[0];
      if (existing) {
        if (existing.action !== operation || fingerprint(existing.payload) !== fingerprint(body))
          throw new ShippingError("Idempotency key reused with different action");
        return shipment;
      }
      const from = operation === "receive" ? "dispatched" : "requested";
      if (shipment.status !== from) throw new ShippingError(`Shipment must be ${from} before ${operation}`);
      if (operation !== "receive" && body.receivedQuantity !== undefined)
        throw new ShippingError("Receipt quantity is only valid during receipt",400);
      if (operation === "receive" && body.receivedQuantity === undefined)
        throw new ShippingError("Actual received quantity required",400);
      if (operation === "receive" && body.receivedQuantity! > shipment.quantity)
        throw new ShippingError("Receipt exceeds dispatched quantity",400);
      const dispatchDriver = operation === "dispatch"
        ? await assertDeliveryDispatchReady(c, { sourceType: "kitchen_warehouse_shipment", sourceId: id })
        : null;
      if (operation === "cancel")
        await cancelDeliveryAssignmentForSource(c, { sourceType: "kitchen_warehouse_shipment", sourceId: id, actorId: user });
      if (operation === "dispatch") {
        const product = (await rows(c,`SELECT operations_enabled,is_active FROM products WHERE id=$1 FOR SHARE`,[shipment.product_id]))[0];
        if (!product || (!product.operations_enabled &&
          ["false","inactive","0","f","no"].includes(String(product.is_active).trim().toLowerCase())))
          throw new ShippingError("Product is inactive; cancel the reserved shipment instead",409);
        // Serialize balance snapshots for dispatches of different lots of the same product.
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1),$2)",
          [shipment.source_branch_id,shipment.product_id]);
      }
      const lots = await rows(c,`SELECT l.*,f.branch_id,f.product_id,f.unit FROM kitchen_warehouse_shipment_lots l
        JOIN finished_goods_inventory f ON f.id=l.stock_id WHERE l.shipment_id=$1 ORDER BY l.production_date,l.stock_id`,[id]);
      if (lots.reduce((sum,r)=>sum+r.quantity,0)!==shipment.quantity ||
          lots.some(r => r.branch_id!==shipment.source_branch_id || r.product_id!==shipment.product_id || r.unit!==shipment.unit))
        throw new ShippingError("Source lot provenance mismatch");
      if (operation === "cancel" || operation === "dispatch") {
        for (const lot of lots) {
          const updated = await c.query(operation === "cancel"
            ? `UPDATE finished_goods_inventory SET reserved_quantity=reserved_quantity-$1,updated_at=now()
               WHERE id=$2 AND reserved_quantity >= $1 RETURNING id`
            : `UPDATE finished_goods_inventory SET reserved_quantity=reserved_quantity-$1,quantity=quantity-$1,updated_at=now()
               WHERE id=$2 AND reserved_quantity >= $1 AND quantity >= $1 RETURNING id`,[lot.quantity,lot.stock_id]);
          if (!updated.rowCount) throw new ShippingError("Source lot reservation unavailable");
        }
        if (operation === "dispatch") {
          const reference = Number(shipment.id);
          if (!Number.isSafeInteger(reference) || reference > 2147483647)
            throw new ShippingError("Shipment audit reference exceeds inventory log range");
          const after = Number((await rows(c,`SELECT COALESCE(sum(quantity),0)::int AS balance
            FROM finished_goods_inventory WHERE branch_id=$1 AND product_id=$2`,
            [shipment.source_branch_id,shipment.product_id]))[0].balance);
          await c.query(`INSERT INTO production_inventory_logs
            (branch_id,product_id,product_name,movement_type,quantity,balance_before,balance_after,
             reference_type,reference_id,notes,created_by)
            VALUES($1,$2,$3,'transfer_out',$4,$5,$6,'kitchen_warehouse_shipment',$7,$8,$9)`,
            [shipment.source_branch_id,shipment.product_id,shipment.product_name,-shipment.quantity,
              after+shipment.quantity,after,reference,
              `شحن منتج للمستودع المستقل #${reference}`,user]);
        }
      }
      if (operation === "receive") {
        await assertWarehouse(c,shipment.destination_warehouse_id);
        for (const lot of allocateReceivedLots(lots,body.receivedQuantity!)) {
          if (!lot.credited) continue;
          await c.query(`INSERT INTO managed_warehouse_product_stock(warehouse_id,product_id,unit,production_date,quantity)
            VALUES($1,$2,$3,$4,$5)
            ON CONFLICT(warehouse_id,product_id,unit,production_date)
            DO UPDATE SET quantity=managed_warehouse_product_stock.quantity+EXCLUDED.quantity`,
            [shipment.destination_warehouse_id,shipment.product_id,shipment.unit,lot.production_date,lot.credited]);
        }
      }
      const status = operation === "dispatch" ? "dispatched" : operation === "receive" ? "received" : "cancelled";
      const result = (await rows(c,`UPDATE kitchen_warehouse_shipments SET status=$2,
        received_quantity=CASE WHEN $2='received' THEN $3 ELSE received_quantity END,
        carrier_name=CASE WHEN $2='dispatched' THEN $4 ELSE carrier_name END,
        vehicle_number=CASE WHEN $2='dispatched' THEN $5 ELSE vehicle_number END,
        dispatched_at=CASE WHEN $2='dispatched' THEN now() ELSE dispatched_at END,
         received_at=CASE WHEN $2='received' THEN now() ELSE received_at END,
         received_by=CASE WHEN $2='received' THEN $6 ELSE received_by END
         WHERE id=$1 RETURNING *`,[id,status,body.receivedQuantity ?? null,dispatchDriver?.driverName ?? null,dispatchDriver?.vehicleNumber ?? null,user]))[0];
      await c.query(`INSERT INTO kitchen_warehouse_shipment_events(shipment_id,action,actor_id,idempotency_key,payload)
        VALUES($1,$2,$3,$4,$5)`,[id,operation,user,body.idempotencyKey,JSON.stringify(body)]);
      return result;
    }));
  });
}