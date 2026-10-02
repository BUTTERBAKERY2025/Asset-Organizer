import pg from "pg";
import targetGuard from "./target.cjs";

const target = targetGuard.validateTarget(process.env);
const client = new pg.Client({ connectionString: target.url, connectionTimeoutMillis: 5000, ssl: false });
try {
  await client.connect();
  await targetGuard.proveDatabase(client, target);
  console.log("Isolated database read-only ownership, role, socket and disposable marker proof passed.");
} catch (error) {
  console.error(`Isolated database proof failed [${targetGuard.safeReason(error)}]. No bootstrap or fixture mutation was attempted.`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}