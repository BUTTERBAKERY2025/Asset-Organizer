import { describe, expect, it } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";

describe("recipe exception one-use database boundary (isolated development schema)", () => {
  it("serializes two competing writers and leaves exactly one consumed batch", async () => {
    if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1" || !process.env.DATABASE_URL) {
      throw new Error("This database test requires a DEVELOPMENT DATABASE_URL");
    }
    const schema = `recipe_exception_test_${process.pid}_${Date.now()}`;
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, allowExitOnIdle: true });
    const client = await pool.connect();
    let first: pg.PoolClient | undefined;
    let second: pg.PoolClient | undefined;
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(`
        CREATE TABLE branches (id varchar PRIMARY KEY);
        CREATE TABLE users (id varchar PRIMARY KEY);
        CREATE TABLE products (id integer PRIMARY KEY);
        CREATE TABLE central_kitchen_orders (id integer PRIMARY KEY, central_kitchen_id varchar, status text, inventory_mode text);
        CREATE TABLE central_kitchen_order_items (id integer PRIMARY KEY, order_id integer, product_id integer, unit text);
        CREATE TABLE central_kitchen_batch_recipe_snapshots (batch_id integer PRIMARY KEY);
        CREATE TABLE daily_production_batches (
          id serial PRIMARY KEY, branch_id varchar, product_id integer, quantity integer,
          unit text, destination text, status text, production_date text,
          central_kitchen_order_item_id integer, recipe_backed boolean
        );
      `);
      await client.query(readFileSync("migrations/043_recipe_exceptions.sql", "utf8"));
      await client.query(`
        INSERT INTO branches VALUES ('kitchen');
        INSERT INTO users VALUES ('requester'), ('responsible');
        INSERT INTO products VALUES (10);
        INSERT INTO central_kitchen_orders VALUES (20, 'kitchen', 'approved', 'real');
        INSERT INTO central_kitchen_order_items VALUES (30, 20, 10, 'tray');
        INSERT INTO central_kitchen_recipe_exceptions
          (order_id,item_id,kitchen_id,product_id,unit,quantity,production_date,reason,
            requested_by,status,reviewed_by,reviewed_at,review_reason)
        VALUES (20,30,'kitchen',10,'tray',1,'2099-04-10','Need',
          'requester','approved','responsible',now(),'Approved');
      `);
      first = await pool.connect();
      second = await pool.connect();
      await Promise.all([first.query(`SET search_path TO "${schema}"`), second.query(`SET search_path TO "${schema}"`)]);
      await Promise.all([first.query("BEGIN"), second.query("BEGIN")]);
      const insert = `INSERT INTO daily_production_batches
        (branch_id,product_id,quantity,unit,destination,status,production_date,
          central_kitchen_order_item_id,recipe_backed,recipe_exception_id)
        VALUES ('kitchen',10,1,'tray','central_kitchen_order','in_progress','2099-04-10',30,false,1)`;
      await first.query(insert);
      // Second connection blocks on the exception row lock held by the first.
      const competing = second.query(insert).then(
        () => "unexpected_success",
        (error: { code?: string }) => error.code,
      );
      await new Promise(resolve => setTimeout(resolve, 50));
      await first.query("COMMIT");
      expect(await competing).toBe("23514");
      await second.query("ROLLBACK");
      const result = await client.query(`
        SELECT (SELECT count(*)::int FROM daily_production_batches) AS batches,
          (SELECT status FROM central_kitchen_recipe_exceptions WHERE id = 1) AS status
      `);
      expect(result.rows[0]).toMatchObject({ batches: 1, status: "consumed" });
    } finally {
      if (first) { await first.query("ROLLBACK").catch(() => {}); first.release(); }
      if (second) { await second.query("ROLLBACK").catch(() => {}); second.release(); }
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      client.release();
      await pool.end();
    }
  }, 30_000);
});