import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { storage } from "../server/storage";
import { deliverySourceFingerprint } from "../server/delivery-dispatch-guard";

const prefix = `fg-receipt-${randomUUID()}`;
let pool: pg.Pool;
let sourceId: string;
let destinationId: string;
let productId: number;
let inventoryId: number;
let actorId: string;
let driverId: string;
const query = (statement: string, values: unknown[] = []) => pool.query(statement, values);

describe("finished goods branch receipt (local helium PostgreSQL only)", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || "postgres://invalid/invalid");
    if (process.env.USE_SUPABASE === "true" || url.hostname !== "helium" || url.pathname !== "/heliumdb") {
      throw new Error("Refusing finished goods integration test outside local heliumdb");
    }
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    expect((await query("SELECT current_database() db")).rows[0].db).toBe("heliumdb");
    await query(await readFile("migrations/finished_goods_branch_receipt_policy.sql", "utf8"));
    sourceId = `${prefix}-source`;
    destinationId = `${prefix}-destination`;
    actorId = `${prefix}-actor`;
    driverId = `${prefix}-driver`;
    await query("INSERT INTO branches(id,name) VALUES($1,$3),($2,$4)", [sourceId, destinationId, sourceId, destinationId]);
    await query("INSERT INTO users(id,first_name,role,branch_id,is_active) VALUES($1,$3,'admin',$2,'active')", [actorId, sourceId, actorId]);
    await query(`INSERT INTO users(id,first_name,role,branch_id,job_title,is_active)
      VALUES($1,$2,'employee',$3,'delivery','active')`, [driverId,driverId,sourceId]);
    productId = (await query("INSERT INTO products(name,category,unit,operations_enabled,is_active) VALUES($1,'finish','piece',true,'true') RETURNING id", [prefix])).rows[0].id;
    inventoryId = (await query(`INSERT INTO finished_goods_inventory(branch_id,product_id,product_name,product_name_normalized,quantity,unit,production_date)
      VALUES($1,$2,$3,lower($3),10,'piece','2023-02-14') RETURNING id`, [sourceId, productId, prefix])).rows[0].id;
  });
  afterAll(async () => {
    if (!pool) return;
    try {
      await query(`DELETE FROM delivery_notification_outbox WHERE assignment_id IN
        (SELECT id FROM delivery_assignments WHERE source_type='finished_goods_transfer'
          AND source_id IN (SELECT id FROM finished_goods_transfers WHERE inventory_id=$1))`,[inventoryId]);
      await query(`DELETE FROM delivery_assignment_events WHERE assignment_id IN
        (SELECT id FROM delivery_assignments WHERE source_type='finished_goods_transfer'
          AND source_id IN (SELECT id FROM finished_goods_transfers WHERE inventory_id=$1))`,[inventoryId]);
      await query(`DELETE FROM delivery_assignments WHERE source_type='finished_goods_transfer'
        AND source_id IN (SELECT id FROM finished_goods_transfers WHERE inventory_id=$1)`,[inventoryId]);
      await query("DELETE FROM production_inventory_logs WHERE product_id=$1 AND branch_id IN ($2,$3)", [productId, sourceId, destinationId]);
      await query("DELETE FROM finished_goods_transfers WHERE inventory_id=$1", [inventoryId]);
      await query("DELETE FROM finished_goods_inventory WHERE product_id=$1", [productId]);
      await query("DELETE FROM products WHERE id=$1", [productId]);
      await query("DELETE FROM users WHERE id=$1", [actorId]);
      await query("DELETE FROM users WHERE id=$1", [driverId]);
      await query("DELETE FROM branches WHERE id IN ($1,$2)", [sourceId, destinationId]);
    } finally { await pool.end(); }
  });
  const balance = async () => (await query("SELECT quantity,reserved_quantity FROM finished_goods_inventory WHERE id=$1", [inventoryId])).rows[0];
  async function acknowledgeShipment(transferId: number, quantity: number) {
    const items = [{ id: transferId, name: prefix, quantity, unit: "piece" }];
    const assignment = await query(`INSERT INTO delivery_assignments
      (source_type,source_id,driver_id,vehicle_number,status,created_by,
       handover_recorded_at,handover_acknowledged_at,handover_driver_id,handover_vehicle_number,
       handover_items,handover_fingerprint,handover_revision)
      VALUES('finished_goods_transfer',$1,$2,$3,'assigned',$4,
        now()-interval '1 minute',now(),$2,$3,$5::jsonb,$6,1) RETURNING id`,
      [transferId,driverId,"TEST-VEHICLE",actorId,JSON.stringify(items),deliverySourceFingerprint(items)]);
    for (const action of ["create","handover","acknowledge-handover"]) {
      await query(`INSERT INTO delivery_assignment_events(assignment_id,actor_id,action,from_status,to_status,detail)
        VALUES($1,$2,$3,$4,'assigned',$5::jsonb)`, [
        assignment.rows[0].id, action === "acknowledge-handover" ? driverId : actorId,action,
        action === "create" ? null : "assigned",JSON.stringify({ items, driverId,vehicleNumber:"TEST-VEHICLE" }),
      ]);
    }
  }

  it("reserves atomically, debits only on dispatch, credits only actual receipt to original date", async () => {
    const [one, two] = await Promise.allSettled([
      storage.createFinishedGoodsBranchShipment(inventoryId, 7, destinationId, "", actorId),
      storage.createFinishedGoodsBranchShipment(inventoryId, 7, destinationId, "", actorId),
    ]);
    expect([one.status, two.status].sort()).toEqual(["fulfilled", "rejected"]);
    const created = (one.status === "fulfilled" ? one.value : two.status === "fulfilled" ? two.value : null)!;
    expect(created).toMatchObject({ status: "pending", transportPolicy: "branch_receipt", productionDate: "2023-02-14" });
    expect(await balance()).toMatchObject({ quantity: 10, reserved_quantity: 7 });
    await expect(storage.transitionFinishedGoodsBranchShipment(created.id, "receive", actorId, "", 6)).rejects.toThrow();
    await acknowledgeShipment(created.id, 7);
    const dispatch = await storage.transitionFinishedGoodsBranchShipment(created.id, "dispatch", actorId);
    expect(dispatch.status).toBe("in_transit");
    expect(await balance()).toMatchObject({ quantity: 3, reserved_quantity: 0 });
    await expect(storage.transitionFinishedGoodsBranchShipment(created.id, "dispatch", actorId)).rejects.toThrow();
    await expect(storage.transitionFinishedGoodsBranchShipment(created.id, "cancel", actorId)).rejects.toThrow();
    expect((await query("SELECT count(*)::int AS total FROM finished_goods_inventory WHERE branch_id=$1", [destinationId])).rows[0].total).toBe(0);
    const receipt = await storage.transitionFinishedGoodsBranchShipment(created.id, "receive", actorId, "", 6);
    expect(receipt).toMatchObject({ status: "received", receivedQuantity: 6, receivedBy: actorId });
    await expect(storage.transitionFinishedGoodsBranchShipment(created.id, "receive", actorId, "", 6)).rejects.toThrow();
    expect((await query("SELECT product_id,production_date,unit,quantity FROM finished_goods_inventory WHERE branch_id=$1", [destinationId])).rows[0])
      .toMatchObject({ product_id: productId, production_date: "2023-02-14", unit: "piece", quantity: 6 });
    expect(await balance()).toMatchObject({ quantity: 3, reserved_quantity: 0 });
  });

  it("leaves historical completed rows and their balances untouched", async () => {
    const before = await balance();
    const legacy = (await query(`INSERT INTO finished_goods_transfers
      (inventory_id,source_branch_id,destination_type,destination_branch_id,product_id,product_name,quantity,unit,transfer_date,status)
      VALUES($1,$2,'branch',$3,$4,$5,1,'piece','2020-01-01','completed') RETURNING id`, [inventoryId, sourceId, destinationId, productId, prefix])).rows[0];
    await expect(storage.transitionFinishedGoodsBranchShipment(legacy.id, "receive", actorId, "", 1)).rejects.toThrow();
    expect(await balance()).toEqual(before);
  });

  it("cancels only an undispatched reservation without debiting or crediting either branch", async () => {
    const before = await balance();
    const created = await storage.createFinishedGoodsBranchShipment(inventoryId, 2, destinationId, "", actorId);
    expect(await balance()).toMatchObject({ quantity: before.quantity, reserved_quantity: 2 });
    expect((await storage.transitionFinishedGoodsBranchShipment(created.id, "cancel", actorId)).status).toBe("cancelled");
    await expect(storage.transitionFinishedGoodsBranchShipment(created.id, "cancel", actorId)).rejects.toThrow();
    await expect(storage.transitionFinishedGoodsBranchShipment(created.id, "dispatch", actorId)).rejects.toThrow();
    expect(await balance()).toEqual(before);
  });
});