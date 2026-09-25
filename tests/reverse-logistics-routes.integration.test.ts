import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pool: null as any }));
vi.mock("../server/db", () => ({
  pool: new Proxy({}, { get(_target, key) {
    const value = state.pool?.[key];
    return typeof value === "function" ? value.bind(state.pool) : value;
  } }),
}));
// Authentication is injected; all route handlers and every SQL statement are real.
vi.mock("../server/auth", () => ({
  isAuthenticated: (req: any, res: any, next: () => void) =>
    req.currentUser ? next() : res.status(401).json({ message: "Unauthenticated" }),
  requirePermission: (module: string, action: string) => (req: any, res: any, next: () => void) =>
    req.currentUser?.role === "admin" || req.currentUser?.permissions?.[module]?.includes(action)
      ? next() : res.status(403).json({ message: "Permission denied" }),
  getAllowedBranchIds: (req: any) =>
    req.currentUser?.role === "admin" ? null : req.currentUser?.allowedBranches ?? [],
}));
import { registerReverseLogisticsRoutes } from "../server/reverse-logistics-routes";
import { deliverySourceFingerprint } from "../server/delivery-dispatch-guard";

type Actor = { id: string; role: string; branchId?: string; allowedBranches: string[]; permissions: Record<string, string[]> };
const prefix = `reverse-int-${randomUUID()}`;
const routes = new Map<string, any[]>();
const app: any = {
  get(path: string, ...handlers: any[]) { routes.set(`GET ${path}`, handlers); },
  post(path: string, ...handlers: any[]) { routes.set(`POST ${path}`, handlers); },
};
let pool: pg.Pool;
let branch: string, other: string, kitchen: string;
let admin: Actor, receiver: Actor, outsider: Actor;
let driver: Actor;
let item: number, transferItem: number, product: number, substitute: number, orderItem: number, ambiguousItem: number;
let wh1: string, wh2: string;
let seq = 0;
const key = () => `${prefix}-${++seq}`;
const q = (sql: string, args: unknown[] = []) => pool.query(sql, args);
const number = (x: unknown) => Number(x);

async function invoke(method: "GET" | "POST", path: string, user: Actor, body: any = {}, params: any = {}) {
  const handlers = routes.get(`${method} ${path}`);
  if (!handlers) throw Error(`Route missing: ${method} ${path}`);
  const req: any = { currentUser: user, userBranchAccess: user.allowedBranches.map(branchId => ({ branchId })),
    body, params, query: {}, headers: {}, method };
  const res: any = {
    statusCode: 200, body: undefined,
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; },
  };
  let index = 0;
  const next = async (): Promise<void> => {
    const handler = handlers[index++];
    if (handler) await handler(req, res, next);
  };
  await next();
  return { status: res.statusCode, body: res.body };
}
const create = (user: Actor, body: any) => invoke("POST", "/api/reverse-logistics", user, body);
const act = (id: string, action: string, user: Actor, body: any = {}) =>
  invoke("POST", "/api/reverse-logistics/:id/:action", user, { idempotencyKey: key(), ...body }, { id, action });
const material = (quantity: number, idempotencyKey = key()) =>
  ({ kind: "material_return", originalTransferItemId: transferItem, quantity, idempotencyKey });
const move = (sourceWarehouseId: string | null, destinationWarehouseId: string | null, quantity: number) =>
  ({ kind: "warehouse_transfer", itemId: item, sourceWarehouseId, destinationWarehouseId, quantity, idempotencyKey: key() });
const stock = async (sql: string, args: unknown[]) => number((await q(sql, args)).rows[0]?.quantity);
const ok = (response: Awaited<ReturnType<typeof invoke>>) => {
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body;
};
async function acknowledgeHandover(movementId: string) {
  const { rows } = await q(`SELECT id,item_name AS name,quantity,unit FROM reverse_movements
    WHERE id=$1 AND status='requested'`, [movementId]);
  expect(rows).toHaveLength(1);
  const item = rows[0];
  const items = [{ id: Number(item.id), quantity: Number(item.quantity), unit: item.unit }];
  const fingerprint = deliverySourceFingerprint([item]);
  const vehicle = `${prefix}-vehicle`;
  const assigned = await q(`INSERT INTO delivery_assignments
    (source_type,source_id,driver_id,vehicle_number,status,handover_recorded_at,
     handover_acknowledged_at,handover_driver_id,handover_vehicle_number,
     handover_items,handover_fingerprint,handover_revision,created_by)
    VALUES ('reverse_movement',$1,$2,$3,'assigned',now()-interval '1 second',
      now(),$2,$3,$4::jsonb,$5,1,$6) RETURNING id`,
    [movementId,driver.id,vehicle,JSON.stringify(items),fingerprint,admin.id]);
  expect(assigned.rows).toHaveLength(1);
}

describe("reverse logistics routes against local PostgreSQL", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || "postgres://invalid/invalid");
    if (process.env.USE_SUPABASE === "true" || url.hostname !== "helium" || url.pathname !== "/heliumdb")
      throw Error("Refusing reverse logistics integration test outside local heliumdb");
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
    state.pool = { connect: async () => {
      const client = await pool.connect();
      return { query: async (...args: any[]) => {
        try { return await (client.query as any)(...args); }
        catch (error) { throw error; }
      }, release: () => client.release() };
    } };
    expect((await q("SELECT current_database() db")).rows[0].db).toBe("heliumdb");
    branch = `${prefix}-branch`; other = `${prefix}-other`; kitchen = `${prefix}-kitchen`;
    admin = { id: `${prefix}-admin`, role: "admin", allowedBranches: [], permissions: {} };
    receiver = { id: `${prefix}-receiver`, role: "branch_manager", allowedBranches: [branch],
      permissions: { central_kitchen_orders: ["view", "edit"] } };
    outsider = { id: `${prefix}-outsider`, role: "branch_manager", allowedBranches: [other],
      permissions: { central_kitchen_orders: ["view", "edit"] } };
    driver = { id: `${prefix}-driver`, role: "employee", allowedBranches: [branch], permissions: {} };
    try {
      for (const id of [branch, other, kitchen])
        await q("INSERT INTO branches(id,name,is_central_kitchen) VALUES($1,$2,$3)", [id,id,id === kitchen]);
      for (const actor of [admin, receiver, outsider])
        await q("INSERT INTO users(id,first_name,role,branch_id,is_active) VALUES($1,$2,$3,$4,'active')",
          [actor.id,actor.id,actor.role,actor === admin ? kitchen : actor.allowedBranches[0]]);
      await q(`INSERT INTO users(id,first_name,role,branch_id,job_title,is_active)
        VALUES($1,$1,'employee',$2,'delivery','active')`, [driver.id,branch]);
      item = (await q("INSERT INTO warehouse_items(name,category,unit,current_stock,is_active) VALUES($1,'raw','kg',30,true) RETURNING id", [prefix])).rows[0].id;
      await q("INSERT INTO branch_stock(branch_id,item_id,current_quantity) VALUES($1,$2,20)", [branch, item]);
      const transfer = (await q(`INSERT INTO material_transfers
        (transfer_number,source_type,destination_branch_id,transfer_date,status,created_by)
        VALUES($1,'warehouse',$2,current_date::text,'delivered',$3) RETURNING id`,
        [prefix,branch,admin.id])).rows[0].id;
      transferItem = (await q(`INSERT INTO material_transfer_items
        (transfer_id,item_id,item_name,category,unit,quantity,received_quantity)
        VALUES($1,$2,$3,'raw','kg',10,10) RETURNING id`, [transfer,item,prefix])).rows[0].id;
      product = (await q("INSERT INTO products(name,category,unit,operations_enabled) VALUES($1,'finish','piece',true) RETURNING id", [prefix])).rows[0].id;
      substitute = (await q("INSERT INTO products(name,category,unit,operations_enabled) VALUES($1,'finish','piece',true) RETURNING id", [`${prefix}-sub`])).rows[0].id;
      const order = (await q(`INSERT INTO central_kitchen_orders
        (order_number,request_branch_id,central_kitchen_id,order_date,status,inventory_mode,idempotency_key,payload_fingerprint,created_by)
        VALUES($1,$2,$3,current_date,'received','real',$4,$5,$6) RETURNING id`,
        [prefix,branch,kitchen,key(),"a".repeat(64),admin.id])).rows[0].id;
      orderItem = (await q(`INSERT INTO central_kitchen_order_items
        (order_id,product_id,product_name,requested_quantity,unit,received_quantity)
        VALUES($1,$2,$3,8,'piece',8) RETURNING id`, [order,product,prefix])).rows[0].id;
      ambiguousItem = (await q(`INSERT INTO central_kitchen_order_items
        (order_id,product_id,product_name,requested_quantity,unit,prepared_quantity,substitute_quantity,substitute_product_id,substitute_product_name,substitute_unit,dispatched_quantity,received_quantity)
        VALUES($1,$2,$3,8,'piece',5,3,$4,$5,'piece',8,8) RETURNING id`,
        [order,product,prefix,substitute,`${prefix}-sub`])).rows[0].id;
      await q(`INSERT INTO finished_goods_inventory
        (branch_id,product_id,product_name,product_name_normalized,quantity,unit,production_date)
        VALUES($1,$2,$3,lower($3),10,'piece','2025-01-01')`,[branch,product,prefix]);
      registerReverseLogisticsRoutes(app);
      wh1 = ok(await invoke("POST","/api/reverse-logistics/warehouses",admin,{name:`${prefix}-A`})).id;
      wh2 = ok(await invoke("POST","/api/reverse-logistics/warehouses",admin,{name:`${prefix}-B`})).id;
    } catch (error) {
      await cleanup();
      throw error;
    }
  });
  async function cleanup() {
    if (!pool || state.pool === null) return;
    // Only prefix-owned rows; no production connection and no persisted fixtures.
    try {
      await q("DELETE FROM production_inventory_logs WHERE reference_type='reverse_movement' AND reference_id IN (SELECT id FROM reverse_movements WHERE created_by LIKE $1)",[`${prefix}%`]);
      await q("DELETE FROM warehouse_movement_logs WHERE reference_type='reverse_movement' AND reference_id IN (SELECT id FROM reverse_movements WHERE created_by LIKE $1)",[`${prefix}%`]);
      await q("DELETE FROM managed_warehouse_movement_logs WHERE movement_id IN (SELECT id FROM reverse_movements WHERE created_by LIKE $1)",[`${prefix}%`]);
      await q("DELETE FROM reverse_product_reservations WHERE movement_id IN (SELECT id FROM reverse_movements WHERE created_by LIKE $1)",[`${prefix}%`]);
      await q(`DELETE FROM system_notifications WHERE dedupe_key IN
        (SELECT 'delivery:' || o.id || ':' || u.id FROM delivery_notification_outbox o
         JOIN delivery_assignments a ON a.id=o.assignment_id
         JOIN users u ON u.id=a.driver_id
         WHERE a.source_type='reverse_movement' AND a.created_by LIKE $1)`,[`${prefix}%`]);
      await q(`DELETE FROM delivery_notification_outbox WHERE assignment_id IN
        (SELECT id FROM delivery_assignments WHERE source_type='reverse_movement' AND created_by LIKE $1)`,[`${prefix}%`]);
      await q(`DELETE FROM delivery_assignment_events WHERE assignment_id IN
        (SELECT id FROM delivery_assignments WHERE source_type='reverse_movement' AND created_by LIKE $1)`,[`${prefix}%`]);
      await q(`DELETE FROM delivery_assignments
        WHERE source_type='reverse_movement' AND created_by LIKE $1`,[`${prefix}%`]);
      await q("DELETE FROM reverse_movement_events WHERE movement_id IN (SELECT id FROM reverse_movements WHERE created_by LIKE $1)",[`${prefix}%`]);
      await q("DELETE FROM reverse_movements WHERE created_by LIKE $1",[`${prefix}%`]);
      await q("DELETE FROM managed_warehouse_stock WHERE warehouse_id IN (SELECT id FROM managed_warehouses WHERE name LIKE $1)",[`${prefix}%`]);
      await q("DELETE FROM managed_warehouses WHERE name LIKE $1",[`${prefix}%`]);
      await q("DELETE FROM finished_goods_inventory WHERE branch_id IN ($1,$2) AND product_id IN ($3,$4)",[branch,kitchen,product,substitute]);
      await q("DELETE FROM central_kitchen_order_items WHERE order_id IN (SELECT id FROM central_kitchen_orders WHERE order_number=$1)",[prefix]);
      await q("DELETE FROM central_kitchen_orders WHERE order_number=$1",[prefix]);
      await q("DELETE FROM products WHERE id IN ($1,$2)",[product,substitute]);
      await q("DELETE FROM material_transfer_items WHERE transfer_id IN (SELECT id FROM material_transfers WHERE transfer_number=$1)",[prefix]);
      await q("DELETE FROM material_transfers WHERE transfer_number=$1",[prefix]);
      await q("DELETE FROM branch_stock WHERE branch_id=$1 AND item_id=$2",[branch,item]);
      await q("DELETE FROM warehouse_items WHERE id=$1",[item]);
      await q("DELETE FROM users WHERE id LIKE $1",[`${prefix}%`]);
      await q("DELETE FROM branches WHERE id IN ($1,$2,$3)",[branch,other,kitchen]);
    } finally { await pool.end(); state.pool = null; }
  }
  afterAll(cleanup);

  it("lists only scoped receipt sources and restricts global warehouse catalog", async () => {
    const own = ok(await invoke("GET","/api/reverse-logistics/sources",receiver));
    expect(own.materials).toEqual(expect.arrayContaining([expect.objectContaining({ id:transferItem })]));
    expect(own.products).toEqual(expect.arrayContaining([expect.objectContaining({ id:orderItem })]));
    const foreign = ok(await invoke("GET","/api/reverse-logistics/sources",outsider));
    expect(foreign.materials.some((x: any) => x.id === transferItem)).toBe(false);
    expect((await invoke("GET","/api/reverse-logistics/stock",receiver)).status).toBe(403);
    expect(ok(await invoke("GET","/api/reverse-logistics/warehouses",admin)).map((x: any) => x.id)).toContain(wh1);
  });

  it("reserves, dispatches, receives shortage, inspects partial usable and writes off damaged without financial posting", async () => {
    const created = ok(await create(receiver,material(6)));
    expect(created.status).toBe("draft");
    expect(ok(await act(created.id,"request",receiver)).status).toBe("requested");
    expect(await stock("SELECT reserved_quantity quantity FROM branch_stock WHERE branch_id=$1 AND item_id=$2",[branch,item])).toBe(6);
    await acknowledgeHandover(created.id);
    expect(ok(await act(created.id,"dispatch",receiver,{carrierName:"Courier"})).status).toBe("dispatched");
    expect(await stock("SELECT current_quantity quantity FROM branch_stock WHERE branch_id=$1 AND item_id=$2",[branch,item])).toBe(14);
    expect((await act(created.id,"receive",receiver,{receivedQuantity:5})).status).toBe(403);
    expect(ok(await act(created.id,"receive",admin,{receivedQuantity:5})).status).toBe("received");
    expect((await act(created.id,"inspect",admin,{usableQuantity:4,damagedQuantity:0})).status).toBe(400);
    expect(ok(await act(created.id,"inspect",admin,{usableQuantity:3,damagedQuantity:2})).status).toBe("inspected");
    expect(await stock("SELECT current_stock quantity FROM warehouse_items WHERE id=$1",[item])).toBe(33);
    expect((await act(created.id,"writeoff",admin,{damagedQuantity:3,notes:"damaged"})).status).toBe(400);
    expect(ok(await act(created.id,"writeoff",admin,{damagedQuantity:2,notes:"damaged"})).written_off_quantity).toBe("2.000000");
    const detail = ok(await invoke("GET","/api/reverse-logistics/:id",admin,{}, {id:created.id}));
    expect(detail.events.map((e: any) => e.action)).toEqual(["request","dispatch","receive","inspect","writeoff"]);
    expect(detail.usable_quantity).toBe("3.000000");
    expect(detail.received_quantity).toBe("5.000000");
    expect(detail.written_off_quantity).toBe("2.000000");
    expect((await q("SELECT count(*)::int n FROM warehouse_movement_logs WHERE reference_type='reverse_movement' AND reference_id=$1",[created.id])).rows[0].n).toBe(2);
    expect((await q("SELECT unit_price FROM warehouse_items WHERE id=$1",[item])).rows[0].unit_price).toBeNull();
    expect((await q("SELECT count(*)::int n FROM accounting_journal_entries WHERE created_by LIKE $1 OR reference_type='reverse_movement' AND reference_id=$2",[`${prefix}%`,String(created.id)])).rows[0].n).toBe(0);
  });

  it("lets a main-warehouse custodian receive and inspect, but never write off or replay approval", async () => {
    const custodian: Actor = { ...admin, role: "branch_manager", branchId: "main_warehouse",
      allowedBranches: ["main_warehouse"], permissions: { central_kitchen_orders: ["view", "edit"] } };
    const movement = ok(await create(receiver,material(1)));
    ok(await act(movement.id,"request",receiver));
    await acknowledgeHandover(movement.id);
    ok(await act(movement.id,"dispatch",receiver,{carrierName:"Courier"}));
    expect(ok(await invoke("GET","/api/reverse-logistics",custodian)).map((x: any) => x.id)).toContain(movement.id);
    expect(ok(await invoke("GET","/api/reverse-logistics/:id",custodian,{}, {id:movement.id})).id).toBe(movement.id);
    expect((await invoke("GET","/api/reverse-logistics/:id",outsider,{}, {id:movement.id})).status).toBe(403);
    expect((await act(movement.id,"receive",outsider,{receivedQuantity:1})).status).toBe(403);
    ok(await act(movement.id,"receive",custodian,{receivedQuantity:1}));
    ok(await act(movement.id,"inspect",custodian,{usableQuantity:0,damagedQuantity:1}));
    const approvalKey = key();
    ok(await act(movement.id,"writeoff",admin,{idempotencyKey:approvalKey,damagedQuantity:1,notes:"Unusable"}));
    expect((await act(movement.id,"writeoff",custodian,{idempotencyKey:approvalKey,damagedQuantity:1,notes:"Unusable"})).status).toBe(403);
    expect((await act(movement.id,"writeoff",custodian,{damagedQuantity:1,notes:"Unusable"})).status).toBe(403);
    expect((await q("SELECT count(*)::int n FROM reverse_movement_events WHERE movement_id=$1 AND action='writeoff'",[movement.id])).rows[0].n).toBe(1);
  });

  it("rejects foreign branch creation and access, duplicate create payload conflicts", async () => {
    expect((await create(outsider,material(1))).status).toBe(403);
    const input = material(1);
    const first = ok(await create(receiver,input));
    expect(ok(await create(receiver,input)).id).toBe(first.id);
    expect((await create(receiver,{...input,quantity:2})).status).toBe(409);
    expect((await invoke("GET","/api/reverse-logistics/:id",outsider,{}, {id:first.id})).status).toBe(403);
  });

  it("retries identical action once but rejects changed payload or action with reused key", async () => {
    const movement = ok(await create(receiver,material(1)));
    const idempotencyKey = key();
    expect(ok(await act(movement.id,"request",receiver,{idempotencyKey})).status).toBe("requested");
    expect(ok(await act(movement.id,"request",receiver,{idempotencyKey})).status).toBe("requested");
    expect((await act(movement.id,"request",receiver,{idempotencyKey,notes:"changed"})).status).toBe(409);
    expect((await act(movement.id,"dispatch",receiver,{idempotencyKey,carrierName:"Courier"})).status).toBe(409);
    expect((await q("SELECT count(*)::int n FROM reverse_movement_events WHERE movement_id=$1",[movement.id])).rows[0].n).toBe(1);
    expect(ok(await act(movement.id,"cancel",receiver)).status).toBe("cancelled");
  });

  it("serializes competing requests against original received cap", async () => {
    const a = ok(await create(receiver,material(3)));
    const b = ok(await create(receiver,material(3)));
    const results = await Promise.all([act(a.id,"request",receiver),act(b.id,"request",receiver)]);
    expect(results.map(r => r.status).sort()).toEqual([200,409]);
    expect(await stock("SELECT reserved_quantity quantity FROM branch_stock WHERE branch_id=$1 AND item_id=$2",[branch,item])).toBe(3);
    const winner = results[0].status === 200 ? a : b;
    ok(await act(winner.id,"cancel",receiver));
  });

  it("moves main to managed then managed to managed using authoritative balances and audit logs", async () => {
    const run = async (source: string | null,destination: string | null,quantity: number) => {
      const m = ok(await create(admin,move(source,destination,quantity)));
      ok(await act(m.id,"request",admin));
      await acknowledgeHandover(m.id);
      ok(await act(m.id,"dispatch",admin,{carrierName:"Courier"}));
      ok(await act(m.id,"receive",admin,{receivedQuantity:quantity}));
      ok(await act(m.id,"inspect",admin,{usableQuantity:quantity,damagedQuantity:0}));
      return m.id;
    };
    const first = await run(null,wh1,4);
    expect(await stock("SELECT current_stock quantity FROM warehouse_items WHERE id=$1",[item])).toBe(29);
    expect(await stock("SELECT quantity FROM managed_warehouse_stock WHERE warehouse_id=$1 AND item_id=$2",[wh1,item])).toBe(4);
    const second = await run(wh1,wh2,3);
    expect(await stock("SELECT quantity FROM managed_warehouse_stock WHERE warehouse_id=$1 AND item_id=$2",[wh1,item])).toBe(1);
    expect(await stock("SELECT quantity FROM managed_warehouse_stock WHERE warehouse_id=$1 AND item_id=$2",[wh2,item])).toBe(3);
    expect((await q("SELECT count(*)::int n FROM managed_warehouse_movement_logs WHERE movement_id IN ($1,$2)",[first,second])).rows[0].n).toBe(3);
    expect((await create(receiver,move(null,wh1,1))).status).toBe(403);
  });

  it("returns real original product to its kitchen with original lot dates, blocks ambiguous substitute", async () => {
    const ambiguous = ok(await create(receiver,{kind:"product_return",originalOrderItemId:ambiguousItem,component:"substitute",quantity:1,idempotencyKey:key()}));
    expect((await act(ambiguous.id,"request",receiver)).status).toBe(409);
    const movement = ok(await create(receiver,{kind:"product_return",originalOrderItemId:orderItem,component:"original",quantity:3,idempotencyKey:key()}));
    ok(await act(movement.id,"request",receiver));
    expect(await stock("SELECT reserved_quantity quantity FROM finished_goods_inventory WHERE branch_id=$1 AND product_id=$2",[branch,product])).toBe(3);
    await acknowledgeHandover(movement.id);
    ok(await act(movement.id,"dispatch",receiver,{carrierName:"Courier"}));
    ok(await act(movement.id,"receive",admin,{receivedQuantity:2}));
    ok(await act(movement.id,"inspect",admin,{usableQuantity:1,damagedQuantity:1}));
    expect(await stock("SELECT quantity FROM finished_goods_inventory WHERE branch_id=$1 AND product_id=$2",[branch,product])).toBe(7);
    expect(await stock("SELECT quantity FROM finished_goods_inventory WHERE branch_id=$1 AND product_id=$2 AND production_date='2025-01-01'",[kitchen,product])).toBe(1);
    expect((await q("SELECT count(*)::int n FROM production_inventory_logs WHERE reference_type='reverse_movement' AND reference_id=$1",[movement.id])).rows[0].n).toBe(2);
    expect((await q("SELECT base_price FROM products WHERE id=$1",[product])).rows[0].base_price).toBeNull();
  });
});