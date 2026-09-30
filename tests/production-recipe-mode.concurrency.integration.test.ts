import { describe, expect, it } from "vitest";
import pg from "pg";

describe("output-only activation/create serialization (disposable local schema)", () => {
  it("waits for committed toggles, ignores rolled-back toggles, and serializes disable behind creation", async () => {
    const url = process.env.DATABASE_URL;
    if (!url || new URL(url).hostname !== "helium" || process.env.USE_SUPABASE === "true"
      || process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1") {
      throw new Error("Only confirmed isolated local helium is allowed");
    }
    const schemaName = `recipe_mode_race_${process.pid}_${Date.now()}`;
    const pool = new pg.Pool({ connectionString: url, max: 3, allowExitOnIdle: true });
    const setup = await pool.connect();
    let first: pg.PoolClient | undefined;
    let second: pg.PoolClient | undefined;
    const quoted = `"${schemaName}"`;
    try {
      await setup.query(`CREATE SCHEMA ${quoted}`);
      await setup.query(`SET search_path TO ${quoted},pg_catalog`);
      // All committed fixture data is private to this schema; public tables are
      // never written. Clone the installed production trigger functions, not a
      // reimplementation of their locking or snapshot logic.
      await setup.query(`
        CREATE TABLE branches(id varchar PRIMARY KEY,is_central_kitchen boolean);
        CREATE TABLE users(id varchar PRIMARY KEY,role text);
        CREATE TABLE production_recipe_mode_events(id serial PRIMARY KEY,kitchen_id varchar,enabled boolean,reason text,actor_id varchar,created_at timestamptz DEFAULT now());
        CREATE TABLE daily_production_batches(id serial PRIMARY KEY,branch_id varchar,product_id integer,quantity integer,unit text,production_date text,recipe_backed boolean,recipe_exception_id integer,recipe_mode_activation_id integer);
        INSERT INTO branches VALUES ('race_kitchen_${schemaName}',true);
        INSERT INTO users VALUES ('admin','admin');
      `);
      for (const name of ["guard_production_recipe_mode_event", "stamp_production_recipe_mode"]) {
        const { rows } = await setup.query("SELECT pg_get_functiondef($1::regprocedure) AS definition", [`public.${name}()`]);
        await setup.query(String(rows[0].definition).replaceAll("public.", `${quoted}.`));
      }
      await setup.query(`
        CREATE TRIGGER events BEFORE INSERT OR UPDATE OR DELETE ON production_recipe_mode_events FOR EACH ROW EXECUTE FUNCTION guard_production_recipe_mode_event();
        CREATE TRIGGER batches BEFORE INSERT OR UPDATE ON daily_production_batches FOR EACH ROW EXECUTE FUNCTION stamp_production_recipe_mode();
      `);
      const kitchen = `race_kitchen_${schemaName}`;
      const toggle = "INSERT INTO production_recipe_mode_events(kitchen_id,enabled,reason,actor_id) VALUES ($1,$2,'synthetic race only','admin') RETURNING id";
      const create = "INSERT INTO daily_production_batches(branch_id,product_id,quantity,unit,production_date,recipe_backed) VALUES ($1,1,1,'piece','2026-09-30',false) RETURNING recipe_mode_activation_id,recipe_backed";
      await setup.query(toggle, [kitchen, false]);
      first = await pool.connect(); second = await pool.connect();
      await Promise.all([first.query(`SET search_path TO ${quoted},pg_catalog`), second.query(`SET search_path TO ${quoted},pg_catalog`)]);
      const secondPid = Number((await second.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
      const waitBlocked = async () => {
        for (let i = 0; i < 100; i++) {
          const result = await setup.query("SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND NOT granted", [secondPid]);
          if (result.rows.length) return;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        throw new Error("Competing operation did not block on the shared kitchen lock");
      };
      await first.query("BEGIN"); await second.query("BEGIN");
      const activation = (await first.query(toggle, [kitchen, true])).rows[0].id;
      const competingCreate = second.query(create, [kitchen]);
      await waitBlocked();
      await first.query("COMMIT"); // only disposable schema event commits
      expect((await competingCreate).rows[0]).toEqual({ recipe_mode_activation_id: activation, recipe_backed: false });
      await second.query("ROLLBACK");

      await first.query("BEGIN"); await second.query("BEGIN");
      expect((await first.query(create, [kitchen])).rows[0].recipe_mode_activation_id).toBe(activation);
      const disable = second.query(toggle, [kitchen, false]);
      await waitBlocked();
      await first.query("ROLLBACK"); // creation retains activation until its txn ends
      await disable;
      await second.query("COMMIT");

      await first.query("BEGIN"); await second.query("BEGIN");
      await first.query(toggle, [kitchen, true]);
      const afterRollback = second.query(create, [kitchen]);
      await waitBlocked();
      await first.query("ROLLBACK");
      expect((await afterRollback).rows[0]).toEqual({ recipe_mode_activation_id: null, recipe_backed: false });
      await second.query("ROLLBACK");
      expect(Number((await setup.query("SELECT count(*) AS count FROM daily_production_batches")).rows[0].count)).toBe(0);
    } finally {
      for (const connection of [first, second]) if (connection) { await connection.query("ROLLBACK").catch(() => {}); connection.release(); }
      await setup.query(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`);
      setup.release();
      await pool.end();
    }
  }, 30000);
});