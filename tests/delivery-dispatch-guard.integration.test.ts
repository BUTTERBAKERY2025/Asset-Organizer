import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertDeliveryDispatchReady, deliverySourceFingerprint, DeliveryDispatchConflict, type DispatchSourceType } from "../server/delivery-dispatch-guard";

// Real PostgreSQL transactions, with temporary tables so no production or
// persistent fixture row can be touched. Refuse remote databases explicitly.
describe("source dispatch handover guard (local PostgreSQL)", () => {
  let client: pg.PoolClient;
  let connection: pg.Pool;
  const driver = `dispatch-driver-${randomUUID()}`;
  const cases: Array<{ type: DispatchSourceType; table: string; name: string }> = [
    { type: "kitchen", table: "central_kitchen_order_items", name: "product_name" },
    { type: "material_transfer", table: "material_transfer_items", name: "item_name" },
    { type: "material_transfer", table: "material_transfer_items", name: "item_name" }, // both warehouse and branch transport
    { type: "finished_goods_transfer", table: "finished_goods_transfers", name: "product_name" },
    { type: "kitchen_warehouse_shipment", table: "kitchen_warehouse_shipments", name: "product_name" },
    { type: "reverse_movement", table: "reverse_movements", name: "item_name" },
  ];
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || "postgres://invalid/");
    if (process.env.USE_SUPABASE === "true" || url.hostname !== "helium" || url.pathname !== "/heliumdb")
      throw Error("Dispatch integration test requires local heliumdb; remote writes refused");
    connection = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    client = await connection.connect();
    if ((await client.query("SELECT current_database() AS db")).rows[0].db !== "heliumdb")
      throw Error("Unexpected database; remote writes refused");
    await client.query(`CREATE TEMP TABLE users (id text PRIMARY KEY, first_name text, last_name text,
      is_active text, job_title text)`);
    await client.query(`CREATE TEMP TABLE delivery_assignments (id integer PRIMARY KEY,
      source_type text, source_id integer, driver_id text, vehicle_number text, status text,
      handover_recorded_at timestamptz, handover_acknowledged_at timestamptz,
      handover_driver_id text, handover_vehicle_number text, handover_fingerprint text,
      handover_revision integer, handover_items jsonb)`);
    await client.query(`CREATE TEMP TABLE central_kitchen_order_items (id integer, order_id integer,
      product_name text, unit text, prepared_quantity numeric, substitute_quantity numeric,
      substitute_product_id integer, substitute_warehouse_item_id integer,
      substitute_product_name text, substitute_unit text)`);
    await client.query(`CREATE TEMP TABLE material_transfer_items (id integer, transfer_id integer,
      item_name text, unit text, quantity numeric)`);
    for (const table of ["finished_goods_transfers", "kitchen_warehouse_shipments"])
      await client.query(`CREATE TEMP TABLE ${table} (id integer, product_name text, unit text, quantity numeric)`);
    await client.query(`CREATE TEMP TABLE reverse_movements (id integer, item_name text, unit text, quantity numeric)`);
    await client.query(`CREATE TEMP TABLE source_stock (source_type text, source_id integer, balance integer)`);
    await client.query("INSERT INTO users VALUES ($1,'Driver','Test','active','delivery')", [driver]);
  });
  afterAll(async () => { client?.release(); await connection?.end(); });

  it.each(cases.map((entry, index) => ({ ...entry, id: index + 1 })))("denies unassigned $type before debit, then accepts exactly one acknowledged handover", async ({ type, table, name, id }) => {
    const lineId = id + 100;
    const label = `Source ${id}`, unit = "قطعة", quantity = 4;
    if (type === "kitchen") await client.query(
      "INSERT INTO central_kitchen_order_items (id,order_id,product_name,unit,prepared_quantity,substitute_quantity) VALUES ($1,$2,$3,$4,5,0)", [lineId,id,label,unit]);
    else if (type === "material_transfer") await client.query(
      "INSERT INTO material_transfer_items VALUES ($1,$2,$3,$4,$5)", [lineId,id,label,unit,quantity]);
    else await client.query(`INSERT INTO ${table} (id,${name},unit,quantity) VALUES ($1,$2,$3,$4)`,
      [id,label,unit,quantity]);
    const itemId = type === "material_transfer" || type === "kitchen" ? lineId : id;
    const source = { sourceType: type, sourceId: id,
      ...(type === "kitchen" ? { items: [{ id: itemId, quantity, unit }] } : {}) };
    await client.query("INSERT INTO source_stock VALUES ($1,$2,8)", [type,id]);
    await client.query("BEGIN");
    try {
      await client.query("SELECT balance FROM source_stock WHERE source_type=$1 AND source_id=$2 FOR UPDATE", [type,id]);
      await expect(assertDeliveryDispatchReady(client, source)).rejects.toBeInstanceOf(DeliveryDispatchConflict);
      expect((await client.query("SELECT balance FROM source_stock WHERE source_type=$1 AND source_id=$2", [type,id])).rows[0].balance).toBe(8);
      const fingerprint = deliverySourceFingerprint([{
        id: itemId, name: label, quantity: type === "kitchen" ? 5 : quantity, unit,
        ...(type === "kitchen" ? {
          originalQuantity: 5, substituteQuantity: 0,
          substituteProductId: null, substituteWarehouseItemId: null,
          substituteName: null, substituteUnit: null,
        } : {}),
      }]);
      await client.query(`INSERT INTO delivery_assignments
        (id,source_type,source_id,driver_id,vehicle_number,status,handover_fingerprint,handover_revision,handover_items)
        VALUES ($1,$2,$3,$4,'TEST-1','assigned',$5,1,$6::jsonb)`,
      [id,type,id,driver,fingerprint,JSON.stringify([{id:itemId,name:label,quantity,unit}])]);
      await expect(assertDeliveryDispatchReady(client, source)).rejects.toBeInstanceOf(DeliveryDispatchConflict);
      await client.query(`UPDATE delivery_assignments SET handover_recorded_at=now()-interval '1 minute',
        handover_acknowledged_at=now(),handover_driver_id=$2,handover_vehicle_number='TEST-1' WHERE id=$1`, [id,driver]);
      const ready = await assertDeliveryDispatchReady(client, source);
      expect(ready.driverId).toBe(driver);
      expect(ready.vehicleNumber).toBe("TEST-1");
      if (type === "kitchen") {
        // Drizzle's `query` is an object, not node-pg's query function.
        const drizzleDb = drizzle(client);
        expect(typeof drizzleDb.query).toBe("object");
        expect((await assertDeliveryDispatchReady(drizzleDb, source)).driverId).toBe(driver);
      }
      await client.query("UPDATE source_stock SET balance=balance-$3 WHERE source_type=$1 AND source_id=$2",
        [type,id,quantity]);
      expect((await client.query("SELECT balance FROM source_stock WHERE source_type=$1 AND source_id=$2", [type,id])).rows[0].balance).toBe(4);
      if (type === "kitchen") await expect(assertDeliveryDispatchReady(client,
        { sourceType: type, sourceId: id, items: [{id:itemId,quantity:3,unit}] })).rejects.toBeInstanceOf(DeliveryDispatchConflict);
      if (type === "kitchen") {
        // Equal total quantity must not conceal a changed original/substitute split.
        await client.query(`UPDATE central_kitchen_order_items SET prepared_quantity=4,
          substitute_quantity=1, substitute_product_id=99,
          substitute_product_name='Different substitute',substitute_unit=$2 WHERE id=$1`, [itemId,unit]);
        await expect(assertDeliveryDispatchReady(client, source)).rejects.toBeInstanceOf(DeliveryDispatchConflict);
      }
    } finally { await client.query("ROLLBACK"); }
  });
});