#!/usr/bin/env node
// Owns ONLY a newly created /tmp cluster. Never attaches to or stops a live DB.
import { mkdtemp, writeFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import pg from "pg";

const safeEnv = { PATH: process.env.PATH || "/usr/bin:/bin", LANG: "C.UTF-8" };
const directory = await mkdtemp(path.join(tmpdir(), "isolated-test-cluster-"));
await chmod(directory, 0o700);
const dataDirectory = path.join(directory, "data");
let started = false;
const children = new Set();
let interrupted = false;
let cleanupPromise;
function tool(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { env: safeEnv, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    proc.stdout.on("data", chunk => { output += chunk; });
    // Deliberately don't forward raw tool diagnostics (may contain credentials).
    proc.stderr.resume();
    proc.once("error", () => reject(new Error("Local PostgreSQL executable unavailable")));
    proc.once("exit", code => code === 0 ? resolve(output) : reject(new Error("Local PostgreSQL tool failed")));
  });
}
async function unusedPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function cleanup() {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    for (const child of children) child.kill("SIGTERM");
    if (started) await tool("pg_ctl", ["-D", dataDirectory, "-m", "immediate", "-w", "stop"]);
    await rm(directory, { recursive: true, force: true });
    console.log("Owned ephemeral PostgreSQL cluster stopped and temporary files removed.");
  })();
  return cleanupPromise;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  interrupted = true;
  for (const child of children) child.kill(signal);
});
try {
  const action = process.argv[2] || "--check";
  if (!["--check", "--bootstrap", "--fixtures", "--serve", "--run", "--prepare", "--smoke"].includes(action))
    throw new Error("Unsupported ephemeral action");
  const port = await unusedPort();
  const appPort = await unusedPort();
  const database = `isolated_test_${randomBytes(12).toString("hex")}`;
  const password = randomBytes(32).toString("hex");
  const nonce = randomBytes(24).toString("hex");
  const adminPassword = randomBytes(32).toString("hex");
  const pwfile = path.join(directory, "init-password");
  await writeFile(pwfile, adminPassword, { mode: 0o600 });
  await tool("initdb", ["-D", dataDirectory, "-U", "isolated_cluster_owner",
    "--auth-local=reject", "--auth-host=scram-sha-256", "--pwfile", pwfile, "--no-locale"]);
  await rm(pwfile);
  if (interrupted) throw new Error("Interrupted");
  await tool("pg_ctl", ["-D", dataDirectory, "-l", path.join(directory, "postgres.log"),
    "-o", `-h 127.0.0.1 -p ${port} -k ''`, "-w", "start"]);
  started = true;
  const admin = new pg.Client({ host: "127.0.0.1", port, user: "isolated_cluster_owner",
    password: adminPassword, database: "postgres", connectionTimeoutMillis: 5000 });
  await admin.connect();
  try {
    // These mutations create only this tool's newly initialized cluster.
    // No configured target URL is consulted or connected here.
    await admin.query(`CREATE ROLE "${database}" LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
    await admin.query(`CREATE DATABASE "${database}" OWNER "${database}"`);
    await admin.query(`REVOKE CONNECT ON DATABASE postgres FROM PUBLIC`);
    await admin.query(`COMMENT ON DATABASE "${database}" IS 'isolated-test:disposable:${database}:${nonce}'`);
  } finally { await admin.end(); }
  const owner = new pg.Client({ host: "127.0.0.1", port, user: "isolated_cluster_owner",
    password: adminPassword, database, connectionTimeoutMillis: 5000 });
  await owner.connect();
  let systemIdentifier;
  try {
    systemIdentifier = String((await owner.query("SELECT system_identifier::text FROM pg_control_system()")).rows[0].system_identifier);
    await owner.query(`
      CREATE SCHEMA isolated_test_proof AUTHORIZATION isolated_cluster_owner;
      REVOKE ALL ON SCHEMA isolated_test_proof FROM PUBLIC;
      GRANT USAGE ON SCHEMA isolated_test_proof TO "${database}";
      CREATE FUNCTION isolated_test_proof.cluster_identity()
        RETURNS TABLE(data_directory text, system_identifier text)
        LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog
        AS $$ SELECT current_setting('data_directory'), system_identifier::text FROM pg_control_system() $$;
      REVOKE ALL ON FUNCTION isolated_test_proof.cluster_identity() FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION isolated_test_proof.cluster_identity() TO "${database}";
    `);
  } finally { await owner.end(); }
  const registryPath = path.join(directory, "registry.json");
  await writeFile(registryPath, JSON.stringify({
    version: 1, database, port, dataDirectory, systemIdentifier, nonce,
  }), { mode: 0o600 });
  const env = {
    ...safeEnv,
    ISOLATED_TEST_DATABASE_URL: `postgresql://${database}:${password}@127.0.0.1:${port}/${database}`,
    ISOLATED_TEST_REGISTRY: registryPath,
    ISOLATED_TEST_PORT: String(appPort),
  };
  async function launch(actionArgs) {
    if (interrupted) throw new Error("Interrupted");
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["scripts/isolated-test/launch.mjs", ...actionArgs],
        { env, stdio: "inherit" });
      children.add(child);
      child.once("error", reject);
      child.once("exit", code => { children.delete(child); resolve(code ?? 1); });
    });
  }
  if (action === "--prepare") {
    for (const step of ["--bootstrap", "--fixtures", "--check"]) {
      const code = await launch([step]);
      if (code) throw new Error("Isolated preparation failed");
    }
  } else if (action === "--serve" || action === "--smoke") {
    for (const step of ["--bootstrap", "--fixtures"]) {
      if (await launch([step])) throw new Error("Isolated preparation failed");
    }
    if (action === "--serve") process.exitCode = await launch(["--serve"]);
    else {
      const serving = launch(["--serve"]);
       process.exitCode = await launch(["--run", process.argv[3] || "tests/isolated-runtime-smoke.mjs"]);
      for (const child of children) child.kill("SIGTERM");
      await serving;
    }
  } else process.exitCode = await launch([action, ...process.argv.slice(3)]);
} catch {
  console.error("Ephemeral isolated test failed; no configured/live database was used.");
  process.exitCode = 1;
} finally {
  try { await cleanup(); }
  catch {
    console.error("Ephemeral cleanup failed; inspect the owned temporary cluster manually.");
    process.exitCode = 1;
  }
}