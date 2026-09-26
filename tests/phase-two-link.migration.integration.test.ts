import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const url = process.env.PHASE_TWO_TEST_DATABASE_URL;
const localOnly = url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname)
  && process.env.NODE_ENV !== "production";

describe.skipIf(!localOnly)("migration 044 on an isolated local development schema", () => {
  it("serializes competing direct and plan coverage; rollback, cancellation and identity guards", async () => {
    const admin = new Client({ connectionString: url! });
    const a = new Client({ connectionString: url! });
    const b = new Client({ connectionString: url! });
    const schema = `phase_two_${process.pid}_${Date.now()}`;
    await admin.connect(); await a.connect(); await b.connect();
    try {
      await admin.query(`CREATE SCHEMA "${schema}"`);
      for (const client of [admin, a, b]) await client.query(`SET search_path TO "${schema}"`);
      await admin.query(`
        CREATE TABLE users(id varchar PRIMARY KEY);
        CREATE TABLE products(id integer PRIMARY KEY, unit text, product_type text, is_active text, operations_enabled boolean);
        CREATE TABLE advanced_production_orders(id integer PRIMARY KEY, source_branch_id text, target_branch_id text,
          start_date text, end_date text, status text);
        CREATE TABLE production_order_items(id integer PRIMARY KEY, order_id integer REFERENCES advanced_production_orders(id),
          product_id integer, target_quantity integer, status text, scheduled_date text, execution_unit text);
        CREATE TABLE central_kitchen_orders(id integer PRIMARY KEY, central_kitchen_id text, request_branch_id text,
          needed_date date, inventory_mode text, status text);
        CREATE TABLE central_kitchen_order_items(id integer PRIMARY KEY, order_id integer REFERENCES central_kitchen_orders(id),
          product_id integer, warehouse_item_id integer, unit text, requested_quantity numeric,
          prepared_quantity numeric, substitute_quantity numeric, substitute_product_id integer,
          substitute_warehouse_item_id integer);
        CREATE TABLE daily_production_batches(id integer PRIMARY KEY, advanced_production_order_item_id integer,
          central_kitchen_order_item_id integer, branch_id text, product_id integer, unit text, quantity integer, status text);
        INSERT INTO users VALUES ('actor');
        INSERT INTO products VALUES (11, 'piece', 'finish', 'true', true);
        INSERT INTO advanced_production_orders VALUES
          (7, 'kitchen', 'branch', '2026-01-01', '2026-01-31', 'approved'),
          (8, 'kitchen', 'branch', '2026-01-01', '2026-01-31', 'approved');
        INSERT INTO production_order_items VALUES
          (9, 7, 11, 8, 'pending', NULL, NULL), (10, 8, 11, 8, 'pending', NULL, NULL);
        INSERT INTO central_kitchen_orders VALUES
          (30, 'kitchen', 'branch', '2026-02-01', 'real', 'approved');
        INSERT INTO central_kitchen_order_items VALUES
          (31, 30, 11, NULL, 'piece', 10, NULL, NULL, NULL, NULL),
          (32, 30, 11, NULL, 'piece', 10, NULL, NULL, NULL, NULL);
      `);
      await admin.query(readFileSync(new URL("../migrations/044_advanced_request_coverage.sql", import.meta.url), "utf8"));
      await a.query("BEGIN");
      await a.query("INSERT INTO advanced_production_request_links(plan_item_id,request_item_id,reason) VALUES (9,31,'approved demand')");
      await expect(a.query("UPDATE production_order_items SET execution_unit = 'kg' WHERE id = 9"))
        .rejects.toMatchObject({ code: "23514" });
      // The failed statement aborts A's transaction: repeat the link inside a fresh one.
      await a.query("ROLLBACK");
      await a.query("BEGIN");
      await a.query("INSERT INTO advanced_production_request_links(plan_item_id,request_item_id,reason) VALUES (9,31,'approved demand')");
      await a.query("SELECT set_config('app.advanced_execution_write', 'on', true)");
      await a.query("UPDATE production_order_items SET execution_unit = 'piece' WHERE id = 9");
      await expect(a.query("UPDATE production_order_items SET execution_unit = 'kg' WHERE id = 9"))
        .rejects.toMatchObject({ code: "23514" });
      await a.query("ROLLBACK");
      // Recreate the committed link for the two-writer serialization test.
      await a.query("BEGIN");
      await a.query("INSERT INTO advanced_production_request_links(plan_item_id,request_item_id,reason) VALUES (9,31,'approved demand')");
      // B must wait for A's demand-row lock, then see its committed allocation.
      const competing = b.query("INSERT INTO daily_production_batches(id,central_kitchen_order_item_id,quantity,status) VALUES (1,31,3,'in_progress')")
        .then(() => "committed", (error: any) => error.code);
      await new Promise(resolve => setTimeout(resolve, 80));
      await a.query("COMMIT");
      expect(await competing).toBe("23514");
      await b.query("BEGIN");
      await b.query("INSERT INTO daily_production_batches(id,central_kitchen_order_item_id,quantity,status) VALUES (4,32,3,'in_progress')");
      const competingPlan = a.query("INSERT INTO advanced_production_request_links(plan_item_id,request_item_id,reason) VALUES (10,32,'concurrent plan')")
        .then(() => "committed", (error: any) => error.code);
      await new Promise(resolve => setTimeout(resolve, 80));
      await b.query("COMMIT");
      expect(await competingPlan).toBe("23514");
      await admin.query("UPDATE daily_production_batches SET status = 'finished' WHERE id = 4");
      await expect(admin.query("INSERT INTO advanced_production_request_links(plan_item_id,request_item_id,reason) VALUES (10,32,'finished direct still counts')"))
        .rejects.toMatchObject({ code: "23514" });
      await expect(b.query("INSERT INTO advanced_production_request_links(plan_item_id,request_item_id,reason) VALUES (10,31,'other')"))
        .rejects.toMatchObject({ code: "23514" });
      await expect(admin.query("UPDATE central_kitchen_orders SET request_branch_id = NULL WHERE id = 30"))
        .rejects.toMatchObject({ code: "23514" });
      await expect(admin.query("UPDATE advanced_production_orders SET target_branch_id = NULL WHERE id = 7"))
        .rejects.toMatchObject({ code: "23514" });
      await admin.query("INSERT INTO daily_production_batches(id,advanced_production_order_item_id,advanced_request_item_id,quantity,status) VALUES (2,9,31,8,'in_progress')");
      await expect(admin.query("DELETE FROM advanced_production_request_links WHERE plan_item_id = 9"))
        .rejects.toMatchObject({ code: "23514" });
      await admin.query("UPDATE daily_production_batches SET status = 'cancelled' WHERE id = 2");
      await admin.query("DELETE FROM advanced_production_request_links WHERE plan_item_id = 9");
      await expect(admin.query("UPDATE daily_production_batches SET advanced_request_item_id = NULL WHERE id = 2"))
        .rejects.toMatchObject({ code: "23514" });
      await a.query("BEGIN");
      await a.query("INSERT INTO advanced_production_request_links(plan_item_id,request_item_id,reason) VALUES (10,31,'rolled back')");
      await a.query("ROLLBACK");
      await admin.query("INSERT INTO daily_production_batches(id,central_kitchen_order_item_id,quantity,status) VALUES (3,31,10,'in_progress')");
      expect((await admin.query("SELECT COUNT(*)::int AS count FROM advanced_production_request_links")).rows[0].count).toBe(0);
    } finally {
      for (const client of [a, b]) await client.end();
      await admin.query("SET search_path TO public");
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });
});