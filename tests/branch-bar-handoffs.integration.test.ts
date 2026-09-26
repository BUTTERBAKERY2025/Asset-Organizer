import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import bcrypt from "bcrypt";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Real app HTTP + real local PostgreSQL. Requires the already-running dev app;
// no mocked session, endpoint, stock, or user authorization.
describe("same-branch kitchen -> bar handoff (local app + heliumdb)", () => {
  const origin = "http://127.0.0.1:5000";
  const prefix = `bar-${randomUUID()}`;
  const branch = `${prefix}-branch`, foreign = `${prefix}-foreign`;
  let pool: pg.Pool;
  let productId: number, inventoryId: number;
  let transferId: number;
  const users = [randomUUID(), randomUUID(), randomUUID()];
  const credentials = users.map((_, index) => ({
    username: `${prefix}-${index}`, password: randomUUID() + randomUUID(),
  }));
  const cookies: string[] = [];
  const q = (statement: string, params: unknown[] = []) => pool.query(statement, params);
  const api = async (actor: number, method: string, path: string, body?: unknown) => {
    const response = await fetch(origin + path, {
      method, headers: {
        Origin: origin, "Content-Type": "application/json", Cookie: cookies[actor],
      }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || "postgres://invalid/invalid");
    if (process.env.USE_SUPABASE === "true" || url.hostname !== "helium" || url.pathname !== "/heliumdb")
      throw new Error("Refusing internal bar test outside local heliumdb");
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    if ((await q("SELECT current_database() db")).rows[0].db !== "heliumdb") throw new Error("Unexpected database");
    await q(await readFile("migrations/042_internal_branch_bar_handoffs.sql", "utf8"));
    await q("INSERT INTO branches(id,name) VALUES($1,$3),($2,$4)", [branch, foreign, branch, foreign]);
    for (let i = 0; i < users.length; i++) {
      const location = i === 2 ? foreign : branch;
      await q(`INSERT INTO users(id,username,password,first_name,role,branch_id,is_active)
        VALUES($1,$2,$3,'Test','branch_manager',$4,'active')`,
        [users[i], credentials[i].username, await bcrypt.hash(credentials[i].password, 10), location]);
      await q("INSERT INTO user_branch_access(user_id,branch_id,is_default) VALUES($1,$2,true)", [users[i],location]);
      await q("INSERT INTO user_permissions(user_id,module,actions) VALUES($1,'production',ARRAY['view','create','edit']::text[])", [users[i]]);
    }
    productId = (await q("INSERT INTO products(name,category,unit,operations_enabled,is_active) VALUES($1,'finish','piece',true,'true') RETURNING id", [prefix])).rows[0].id;
    inventoryId = (await q(`INSERT INTO finished_goods_inventory(branch_id,product_id,product_name,product_name_normalized,quantity,unit,production_date)
      VALUES($1,$2,$3,lower($3),20,'piece','2023-02-14') RETURNING id`, [branch, productId, prefix])).rows[0].id;
    for (const c of credentials) {
      const response = await fetch(origin + "/api/auth/login", {
        method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      expect(response.status).toBe(200);
      const cookie = response.headers.get("set-cookie")?.split(";")[0];
      expect(cookie).toBeTruthy();
      cookies.push(cookie!);
    }
  });
  afterAll(async () => {
    if (!pool) return;
    try {
      await q("DELETE FROM sessions WHERE sess->>'userId'=ANY($1::text[])", [users]);
      await q(`DELETE FROM display_bar_receipts WHERE production_batch IN
        (SELECT 'FG-'||id FROM finished_goods_transfers WHERE inventory_id=$1)`, [inventoryId]);
      await q(`DELETE FROM branch_bar_handoff_events WHERE transfer_id IN
        (SELECT id FROM finished_goods_transfers WHERE inventory_id=$1)`, [inventoryId]);
      await q("DELETE FROM branch_bar_stock WHERE branch_id=$1 AND product_id=$2", [branch, productId]);
      await q("DELETE FROM production_inventory_logs WHERE branch_id=$1 AND product_id=$2", [branch, productId]);
      await q("DELETE FROM finished_goods_transfers WHERE inventory_id=$1", [inventoryId]);
      await q("DELETE FROM finished_goods_inventory WHERE id=$1", [inventoryId]);
      await q("DELETE FROM products WHERE id=$1", [productId]);
      await q("DELETE FROM user_permissions WHERE user_id=ANY($1::varchar[])", [users]);
      await q("DELETE FROM user_branch_access WHERE user_id=ANY($1::varchar[])", [users]);
      await q("DELETE FROM system_audit_logs WHERE user_id=ANY($1::varchar[])", [users]);
      await q("DELETE FROM users WHERE id=ANY($1::varchar[])", [users]);
      await q("DELETE FROM branches WHERE id=ANY($1::varchar[])", [[branch,foreign]]);
    } finally { await pool.end(); }
  });
  it("reserves, rejects foreign/self receipts, dispatches once, receives usable only, preserves shortage and idempotency", async () => {
    const requestKey = randomUUID();
    const payload = { inventoryId, quantity: 7, notes: "Shift handover", idempotencyKey: requestKey };
    const first = await api(0,"POST","/api/branch-bar-handoffs",payload);
    expect(first.status).toBe(201);
    transferId = first.body.id;
    expect((await api(0,"POST","/api/branch-bar-handoffs",payload)).body.id).toBe(transferId);
    expect((await q("SELECT quantity,reserved_quantity FROM finished_goods_inventory WHERE id=$1",[inventoryId])).rows[0])
      .toMatchObject({ quantity: 20, reserved_quantity: 7 });
    const dispatchPath = `/api/branch-bar-handoffs/${transferId}/dispatch`;
    const dispatchBody = { idempotencyKey: randomUUID() };
    expect((await api(2,"POST",dispatchPath,dispatchBody)).status).toBe(403);
    expect((await api(0,"POST",dispatchPath,dispatchBody)).status).toBe(200);
    expect((await api(0,"POST",dispatchPath,dispatchBody)).status).toBe(200);
    expect((await api(1,"POST",dispatchPath,dispatchBody)).status).toBe(403);
    expect((await q("SELECT quantity,reserved_quantity FROM finished_goods_inventory WHERE id=$1",[inventoryId])).rows[0])
      .toMatchObject({ quantity: 13, reserved_quantity: 0 });
    const receivePath = `/api/branch-bar-handoffs/${transferId}/receive`;
    const receiveBody = { idempotencyKey: randomUUID(), usableQuantity: 5, damagedQuantity: 1, notes: "One item missing" };
    expect((await api(0,"POST",receivePath,receiveBody)).status).toBe(403);
    expect((await api(2,"POST",receivePath,receiveBody)).status).toBe(403);
    expect((await api(1,"POST",receivePath,receiveBody)).status).toBe(200);
    expect((await api(1,"POST",receivePath,receiveBody)).status).toBe(200);
    expect((await api(0,"POST",receivePath,receiveBody)).status).toBe(403);
    expect((await api(1,"POST",receivePath,{ ...receiveBody, idempotencyKey:randomUUID() })).status).toBe(409);
    expect((await q("SELECT quantity,quarantine_quantity FROM branch_bar_stock WHERE branch_id=$1 AND product_id=$2",[branch,productId])).rows[0])
      .toMatchObject({ quantity: 5, quarantine_quantity: 1 });
    expect((await q("SELECT usable_quantity,damaged_quantity,shortage_quantity,settlement_status FROM finished_goods_transfers WHERE id=$1",[transferId])).rows[0])
      .toMatchObject({ usable_quantity: 5, damaged_quantity: 1, shortage_quantity: 1, settlement_status: "open" });
    expect((await q("SELECT count(*)::integer count FROM display_bar_receipts WHERE production_batch=$1",[`FG-${transferId}`])).rows[0].count).toBe(1);
  });
  it("serializes concurrent reservations, cancellation returns only the reserved quantity; legacy instant bar path is closed", async () => {
    const [one,two] = await Promise.all([randomUUID(),randomUUID()].map(idempotencyKey =>
      api(0,"POST","/api/branch-bar-handoffs",{inventoryId,quantity:8,idempotencyKey})));
    expect([one.status,two.status].sort()).toEqual([201,409]);
    const pending = one.status === 201 ? one.body : two.body;
    expect((await q("SELECT quantity,reserved_quantity FROM finished_goods_inventory WHERE id=$1",[inventoryId])).rows[0])
      .toMatchObject({ quantity: 13, reserved_quantity: 8 });
    const cancel = { idempotencyKey:randomUUID() };
    expect((await api(0,"POST",`/api/branch-bar-handoffs/${pending.id}/cancel`,cancel)).status).toBe(200);
    expect((await api(0,"POST",`/api/branch-bar-handoffs/${pending.id}/cancel`,cancel)).status).toBe(200);
    expect((await q("SELECT quantity,reserved_quantity FROM finished_goods_inventory WHERE id=$1",[inventoryId])).rows[0])
      .toMatchObject({ quantity: 13, reserved_quantity: 0 });
    expect((await api(0,"POST",`/api/finished-goods-inventory/${inventoryId}/transfer`,{quantity:1,destinationType:"display_bar"})).status).toBe(409);
    const next = await api(0,"POST","/api/branch-bar-handoffs",{ inventoryId,quantity:1,idempotencyKey:randomUUID() });
    expect(next.status).toBe(201);
    expect((await api(1,"POST",`/api/branch-bar-handoffs/${next.body.id}/dispatch`,{idempotencyKey:randomUUID()})).status).toBe(200);
    expect((await api(1,"POST",`/api/branch-bar-handoffs/${next.body.id}/receive`,{idempotencyKey:randomUUID(),usableQuantity:1,damagedQuantity:0})).status).toBe(403);
    expect((await api(0,"POST",`/api/branch-bar-handoffs/${next.body.id}/receive`,{idempotencyKey:randomUUID(),usableQuantity:1,damagedQuantity:0})).status).toBe(403);
  });
});