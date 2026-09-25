import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({pool: null as any}));
vi.mock("../server/db", () => ({ pool: new Proxy({}, {get(_t,k) {
  const value = state.pool?.[k];
  return typeof value === "function" ? value.bind(state.pool) : value;
}}) }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (req: any,res: any,next: () => void) => req.currentUser ? next() : res.status(401).json({message:"Unauthenticated"}),
  requirePermission: (module: string,permission: string) => (req: any,res: any,next: () => void) =>
    req.currentUser.permissions[module]?.includes(permission) ? next() : res.status(403).json({message:"Forbidden"}),
  getAllowedBranchIds: (req: any) => ["admin","production_development_manager"].includes(req.currentUser.role)
    ? null : req.currentUser.allowedBranches,
}));
import { registerKitchenWarehouseShippingRoutes } from "../server/kitchen-warehouse-shipping-routes";
import { deliverySourceFingerprint } from "../server/delivery-dispatch-guard";

const prefix = `ship-int-${randomUUID()}`;
const routes = new Map<string,any[]>();
const app: any = {
  get(path: string,...handlers: any[]) { routes.set(`GET ${path}`,handlers); },
  post(path: string,...handlers: any[]) { routes.set(`POST ${path}`,handlers); },
};
let pool: pg.Pool, branch: string, warehouse: number, product: number, stock: number;
let manager: any, receiver: any, outsider: any, driver: any;
const q = (sql: string,args: unknown[] = []) => pool.query(sql,args);
async function call(method: string,path: string,user: any,body: any = {},params: any = {}) {
  const handlers = routes.get(`${method} ${path}`);
  if (!handlers) throw Error(`Missing route ${path}`);
  const req: any = {currentUser:user,body,params,query:{},userBranchAccess:[]};
  const res: any = {statusCode:200,body:null,status(code: number) {this.statusCode=code; return this;},
    json(value: any) {this.body=value; return this;}};
  let index=0;
  const next = async (): Promise<void> => { const handler=handlers[index++]; if (handler) await handler(req,res,next); };
  await next();
  return res;
}
const key = () => randomUUID();
const balance = async () => (await q("SELECT quantity,reserved_quantity FROM finished_goods_inventory WHERE id=$1",[stock])).rows[0];
async function acknowledgeHandover(shipmentId: number, quantity: number) {
  const item = { id: shipmentId, name: prefix, quantity, unit: "piece" };
  const result = await q(`INSERT INTO delivery_assignments
    (source_type,source_id,driver_id,vehicle_number,created_by,status,
      handover_items,handover_fingerprint,handover_recorded_at,handover_acknowledged_at,
      handover_driver_id,handover_vehicle_number,handover_revision)
    VALUES ('kitchen_warehouse_shipment',$1,$2,'VH-1',$3,'assigned',
      $4::jsonb,$5,now()-interval '1 minute',now(),$2,'VH-1',1) RETURNING id`,
    [shipmentId,driver.id,manager.id,JSON.stringify([item]),deliverySourceFingerprint([item])]);
  const assignmentId = result.rows[0].id;
  await q(`INSERT INTO delivery_assignment_events(assignment_id,actor_id,action,from_status,to_status,detail)
    VALUES ($1,$2,'handover','assigned','assigned',$4::jsonb),
      ($1,$3,'acknowledge-handover','assigned','assigned',$4::jsonb)`,
    [assignmentId,manager.id,driver.id,JSON.stringify({ items:[item], revision:1, driverId:driver.id, vehicleNumber:"VH-1" })]);
}

describe("kitchen warehouse shipping against local PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || "postgres://invalid/invalid");
    if (process.env.USE_SUPABASE === "true" || url.hostname !== "helium" || url.pathname !== "/heliumdb")
      throw Error("Refusing kitchen shipping integration test outside local heliumdb");
    pool = new pg.Pool({connectionString:process.env.DATABASE_URL,max:4});
    state.pool=pool;
    expect((await q("SELECT current_database() db")).rows[0].db).toBe("heliumdb");
    // Additive migration, ONLY on explicitly verified local heliumdb.
    await q(await readFile("migrations/kitchen_warehouse_product_shipping.sql","utf8"));
    branch=`${prefix}-kitchen`;
    manager={id:`${prefix}-manager`,role:"production_development_manager",
      permissions:{production:["view","create","edit"]},allowedBranches:[]};
    receiver={id:`${prefix}-receiver`,role:"admin",
      permissions:{production:["view","create","edit"],warehouse:["view","edit"]},allowedBranches:[]};
    outsider={id:`${prefix}-outsider`,role:"branch_manager",permissions:{production:["view","create","edit"]},allowedBranches:[]};
    driver={id:`${prefix}-driver`,role:"employee",permissions:{},allowedBranches:[]};
    try {
      await q("INSERT INTO branches(id,name,is_central_kitchen) VALUES($1,$2,true)",[branch,branch]);
      for (const user of [manager,receiver,outsider,driver])
        await q("INSERT INTO users(id,first_name,role,branch_id,is_active,job_title) VALUES($1,$1,$2,$3,'active',$4)",
          [user.id,user.role,branch,user === driver ? "delivery" : null]);
      warehouse=(await q("INSERT INTO managed_warehouses(name) VALUES($1) RETURNING id",[prefix])).rows[0].id;
      product=(await q("INSERT INTO products(name,category,unit,operations_enabled,is_active) VALUES($1,'finish','piece',true,'false') RETURNING id",[prefix])).rows[0].id;
      stock=(await q(`INSERT INTO finished_goods_inventory
        (branch_id,product_id,product_name,product_name_normalized,quantity,unit,production_date)
        VALUES($1,$2,$3,lower($3),10,'piece','2024-04-03') RETURNING id`,[branch,product,prefix])).rows[0].id;
      registerKitchenWarehouseShippingRoutes(app);
    } catch (error) { await cleanup(); throw error; }
  });
  async function cleanup() {
    if (!pool || !state.pool) return;
    try {
      await q("DELETE FROM production_inventory_logs WHERE reference_type='kitchen_warehouse_shipment' AND branch_id=$1 AND product_id=$2",[branch,product]);
      await q(`DELETE FROM delivery_assignment_events WHERE assignment_id IN
        (SELECT id FROM delivery_assignments WHERE source_type='kitchen_warehouse_shipment'
          AND source_id IN (SELECT id FROM kitchen_warehouse_shipments WHERE created_by LIKE $1))`,[`${prefix}%`]);
      await q(`DELETE FROM delivery_assignments WHERE source_type='kitchen_warehouse_shipment'
        AND source_id IN (SELECT id FROM kitchen_warehouse_shipments WHERE created_by LIKE $1)`,[`${prefix}%`]);
      await q("DELETE FROM kitchen_warehouse_shipment_events WHERE shipment_id IN (SELECT id FROM kitchen_warehouse_shipments WHERE created_by LIKE $1)",[`${prefix}%`]);
      await q("DELETE FROM kitchen_warehouse_shipment_lots WHERE shipment_id IN (SELECT id FROM kitchen_warehouse_shipments WHERE created_by LIKE $1)",[`${prefix}%`]);
      await q("DELETE FROM kitchen_warehouse_shipments WHERE created_by LIKE $1",[`${prefix}%`]);
      await q("DELETE FROM managed_warehouse_product_stock WHERE warehouse_id=$1",[warehouse]);
      await q("DELETE FROM finished_goods_inventory WHERE id=$1",[stock]);
      await q("DELETE FROM products WHERE id=$1",[product]);
      await q("DELETE FROM managed_warehouses WHERE id=$1",[warehouse]);
      await q("DELETE FROM users WHERE id LIKE $1",[`${prefix}%`]);
      await q("DELETE FROM branches WHERE id=$1",[branch]);
    } finally { await pool.end(); state.pool=null; }
  }
  afterAll(cleanup);
  it("rejects fractional quantities and unauthorized source, reserves once on retry and releases cancellation", async () => {
    const request={stockId:stock,warehouseId:warehouse,quantity:4,idempotencyKey:key()};
    expect((await call("POST","/api/kitchen-warehouse-shipping",manager,{...request,quantity:0.5})).statusCode).toBe(400);
    expect((await call("POST","/api/kitchen-warehouse-shipping",outsider,request)).statusCode).toBe(403);
    const first=await call("POST","/api/kitchen-warehouse-shipping",manager,request);
    expect(first.statusCode).toBe(200);
    const repeat=await call("POST","/api/kitchen-warehouse-shipping",manager,request);
    expect(repeat.body.id).toBe(first.body.id);
    const revoked = {...manager,role:"branch_manager",allowedBranches:[]};
    expect((await call("POST","/api/kitchen-warehouse-shipping",revoked,request)).statusCode).toBe(403);
    expect((await balance()).reserved_quantity).toBe(4);
    const action={idempotencyKey:key()};
    expect((await call("POST","/api/kitchen-warehouse-shipping/:id/:action",manager,action,{id:first.body.id,action:"cancel"})).statusCode).toBe(200);
    expect((await balance()).reserved_quantity).toBe(0);
    expect((await balance()).quantity).toBe(10);
  });
  it("serializes competing reservations without overdrawing the source", async () => {
    const [a,b]=await Promise.all([key(),key()].map(idempotencyKey =>
      call("POST","/api/kitchen-warehouse-shipping",manager,{stockId:stock,warehouseId:warehouse,quantity:7,idempotencyKey})));
    expect([a.statusCode,b.statusCode].sort()).toEqual([200,409]);
    expect((await balance()).reserved_quantity).toBe(7);
    const winner=a.statusCode===200 ? a : b;
    expect((await call("POST","/api/kitchen-warehouse-shipping/:id/:action",manager,
      {idempotencyKey:key()},{id:winner.body.id,action:"cancel"})).statusCode).toBe(200);
    expect((await balance()).reserved_quantity).toBe(0);
  });
  it("blocks dispatch after product deactivation but permits release of its reservation", async () => {
    const created=await call("POST","/api/kitchen-warehouse-shipping",manager,
      {stockId:stock,warehouseId:warehouse,quantity:2,idempotencyKey:key()});
    expect(created.statusCode).toBe(200);
    await acknowledgeHandover(created.body.id,2);
    await q("UPDATE products SET operations_enabled=false,is_active='false' WHERE id=$1",[product]);
    try {
      const route="/api/kitchen-warehouse-shipping/:id/:action";
      expect((await call("POST",route,manager,{idempotencyKey:key(),carrierName:"Carrier"},
        {id:created.body.id,action:"dispatch"})).statusCode).toBe(409);
      expect((await call("POST",route,manager,{idempotencyKey:key()},
        {id:created.body.id,action:"cancel"})).statusCode).toBe(200);
      expect(await balance()).toMatchObject({quantity:10,reserved_quantity:0});
    } finally {
      await q("UPDATE products SET operations_enabled=true WHERE id=$1",[product]);
    }
  });
  it("dispatches real source lot and credits only actual partial receipt once, exposing shortage", async () => {
    const created=await call("POST","/api/kitchen-warehouse-shipping",manager,
      {stockId:stock,warehouseId:warehouse,quantity:6,idempotencyKey:key()});
    expect(created.statusCode).toBe(200);
    const id=created.body.id;
    const route="/api/kitchen-warehouse-shipping/:id/:action";
    const dispatch={idempotencyKey:key(),carrierName:"Actual carrier",vehicleNumber:"VH-1"};
    const unassigned=await call("POST",route,manager,dispatch,{id,action:"dispatch"});
    expect(unassigned.statusCode).toBe(409);
    expect(unassigned.body.message).toMatch(/إسناد سائق/);
    expect(await balance()).toMatchObject({quantity:10,reserved_quantity:6});
    await acknowledgeHandover(id,6);
    expect((await call("POST",route,manager,dispatch,{id,action:"dispatch"})).statusCode).toBe(200);
    expect((await call("POST",route,manager,dispatch,{id,action:"dispatch"})).statusCode).toBe(200);
    expect((await q("SELECT carrier_name,vehicle_number FROM kitchen_warehouse_shipments WHERE id=$1",[id])).rows[0])
      .toEqual({carrier_name:driver.id,vehicle_number:"VH-1"});
    expect(await balance()).toMatchObject({quantity:4,reserved_quantity:0});
    expect((await q(`SELECT movement_type,quantity,balance_before,balance_after,reference_id
      FROM production_inventory_logs WHERE reference_type='kitchen_warehouse_shipment'
        AND branch_id=$1 AND product_id=$2`,[branch,product])).rows)
      .toEqual([{movement_type:"transfer_out",quantity:-6,balance_before:10,balance_after:4,reference_id:Number(id)}]);
    expect((await call("POST",route,manager,{idempotencyKey:key(),receivedQuantity:4},{id,action:"receive"})).statusCode).toBe(403);
    const receipt={idempotencyKey:key(),receivedQuantity:4};
    expect((await call("POST",route,receiver,receipt,{id,action:"receive"})).statusCode).toBe(200);
    expect((await call("POST",route,receiver,receipt,{id,action:"receive"})).statusCode).toBe(200);
    expect((await q("SELECT production_date,quantity FROM managed_warehouse_product_stock WHERE warehouse_id=$1 AND product_id=$2",[warehouse,product])).rows)
      .toEqual([{production_date:"2024-04-03",quantity:4}]);
    expect((await q("SELECT quantity-received_quantity shortage,received_by FROM kitchen_warehouse_shipments WHERE id=$1",[id])).rows[0])
      .toMatchObject({shortage:2,received_by:receiver.id});
    expect((await q("SELECT count(*)::int total FROM managed_warehouse_stock WHERE warehouse_id=$1",[warehouse])).rows[0].total).toBe(0);
  });
});