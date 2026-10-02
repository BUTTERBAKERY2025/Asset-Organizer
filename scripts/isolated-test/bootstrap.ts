import pg from "pg";
import { createRequire } from "node:module";
import { buildBaseline } from "./baseline";

const require = createRequire(import.meta.url);
const guard = require("./target.cjs");
const target = guard.assertRuntime();
const client = new pg.Client({ connectionString: target.url, connectionTimeoutMillis: 5000, ssl: false });
let stage = "proof";
try {
  await client.connect();
  await guard.proveDatabase(client, target);
  stage = "offline-generation";
  const baseline = await buildBaseline();
  // Reprove the same actual connection immediately before any mutation.
  await guard.proveDatabase(client, target);
  stage = "schema-ddl";
  await client.query(baseline.sql);
  console.log("Isolated empty-schema baseline installed and release assertions passed.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Isolated baseline bootstrap failed [${guard.safeReason(error)}]; no live target was used.`);
  if (stage === "offline-generation" || stage === "schema-ddl" && /^[0-9A-Z]{5}$/.test(guard.safeReason(error))) {
    const diagnostic = error as { message?: string; detail?: string };
    // Only offline/schema DDL diagnostics; never connection/auth errors or SQL.
    console.error(`Baseline ${stage}: ${diagnostic.message || "unknown"}${diagnostic.detail ? ` (${diagnostic.detail})` : ""}`);
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}