import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import pg from "pg";

// Deliberately opt-in to a separate disposable database. Never run DDL against
// the app's configured database (even though this test rolls back).
const testUrl = process.env.TEST_DATABASE_URL;
const dedicated = !!testUrl
  && testUrl !== process.env.DATABASE_URL
  && testUrl !== process.env.SUPABASE_DATABASE_URL;

describe("personal notification SQL trigger (dedicated test database)", () => {
  it.skipIf(!dedicated)("captures direct inserts in the same transaction, excludes broadcast and historical inserts, and rolls back", async () => {
    const client = new pg.Client({
      connectionString: testUrl,
      ssl: testUrl!.includes("supabase") ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = '20s'");
      await client.query(readFileSync("migrations/038_personal_notification_push.sql", "utf8"));
      // Set a deterministic activation boundary within this rolled-back tx.
      await client.query("UPDATE personal_push_activation SET activated_at = now() - interval '1 hour' WHERE key = 'personal_notifications_v1'");
      const { rows: users } = await client.query<{ id: string }>("SELECT id FROM users LIMIT 1");
      expect(users.length, "Dedicated test database needs an existing user").toBeGreaterThan(0);
      const userId = users[0].id;
      const personal = await client.query<{ id: number }>(
        "INSERT INTO notifications (user_id, title, message) VALUES ($1, 'push test', 'private') RETURNING id",
        [userId],
      );
      const branchOnly = await client.query<{ id: number }>(
        "INSERT INTO notifications (user_id, title, message) VALUES (NULL, 'broadcast test', 'private') RETURNING id",
      );
      const historical = await client.query<{ id: number }>(
        "INSERT INTO notifications (user_id, title, message, created_at) VALUES ($1, 'old test', 'private', now() - interval '1 day') RETURNING id",
        [userId],
      );
      const ids = [personal.rows[0].id, branchOnly.rows[0].id, historical.rows[0].id];
      const outbox = await client.query<{ notification_id: number; user_id: string }>(
        "SELECT notification_id, user_id FROM personal_notification_push_outbox WHERE notification_id = ANY($1::integer[])",
        [ids],
      );
      expect(outbox.rows).toEqual([{ notification_id: personal.rows[0].id, user_id: userId }]);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
});