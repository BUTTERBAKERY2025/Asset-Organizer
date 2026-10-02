import pg from "pg";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const guard = require("../scripts/isolated-test/target.cjs");
const target = guard.assertRuntime();
const client = new pg.Client({ connectionString: target.url, connectionTimeoutMillis: 5000, ssl: false });
const credentialsPath = path.join(path.dirname(process.env.ISOLATED_TEST_REGISTRY!), "credentials.json");
const temporaryPath = `${credentialsPath}.pending`;
try {
  await client.connect();
  await guard.proveDatabase(client, target);
  const accounts = [
    { id: "isolated-fixture-admin", username: "isolated_admin", role: "admin", branchId: "isolated-fixture-a" },
    { id: "isolated-fixture-employee", username: "isolated_employee", role: "employee", branchId: "isolated-fixture-a" },
    { id: "isolated-fixture-viewer", username: "isolated_viewer", role: "viewer", branchId: "isolated-fixture-b" },
    { id: "isolated-fixture-editor", username: "isolated_editor", role: "employee", branchId: "isolated-fixture-a" },
    { id: "isolated-fixture-manager", username: "isolated_manager", role: "operations_manager", branchId: "isolated-fixture-a" },
  ].map(account => ({ ...account, password: randomBytes(24).toString("base64url") }));
  await client.query("BEGIN");
  try {
    await client.query(`
      INSERT INTO branches(id, name) VALUES
        ('isolated-fixture-a', 'Synthetic Test Branch A'),
        ('isolated-fixture-b', 'Synthetic Test Branch B')
      ON CONFLICT (id) DO NOTHING
    `);
    for (const account of accounts) {
      await client.query(`
        INSERT INTO users(id, username, password, first_name, last_name, role, branch_id, is_active)
        VALUES ($1, $2, $3, 'Synthetic', 'Test Account', $4, $5, 'active')
        ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password
      `, [account.id, account.username, await bcrypt.hash(account.password, 12), account.role, account.branchId]);
    }
    await client.query(`
      INSERT INTO branch_employees(id, branch_id, linked_user_id, employee_name, job_title, nationality, salary, status)
      VALUES (900001, 'isolated-fixture-a', 'isolated-fixture-employee', 'Synthetic Linked Employee', 'cashier', 'Synthetic', 1000, 'active'),
        (900002, 'isolated-fixture-a', NULL, 'Synthetic Unlinked Employee', 'cashier', 'Synthetic', 1000, 'active'),
        (900003, 'isolated-fixture-b', 'isolated-fixture-viewer', 'Synthetic Out Of Scope Employee', 'cashier', 'Synthetic', 1000, 'active')
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO user_branch_access(user_id, branch_id, access_level, is_default)
      VALUES ('isolated-fixture-manager', 'isolated-fixture-a', 'full', true);
      INSERT INTO user_permissions(user_id, module, actions)
      VALUES ('isolated-fixture-editor', 'users', ARRAY['view','edit']),
        ('isolated-fixture-editor', 'hr_documents', ARRAY['view']);
      INSERT INTO roles(id, name, slug) VALUES (900001, 'Synthetic Smoke Role', 'isolated_smoke_role')
      ON CONFLICT (id) DO NOTHING;
    `);
    await writeFile(temporaryPath, JSON.stringify({ accounts }), { mode: 0o600, flag: "wx" });
    await client.query("COMMIT");
    await rename(temporaryPath, credentialsPath);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  console.log("Synthetic branch/account fixtures ready; credentials are confined to the private cluster registry directory.");
} catch (error) {
  console.error(`Synthetic fixtures failed [${guard.safeReason(error)}]; no credentials or database details are logged.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}