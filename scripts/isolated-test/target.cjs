"use strict";

// Deliberately no remote allowlist: a branch name alone cannot prove isolation.
const LOOPBACK = new Set(["127.0.0.1", "::1", "[::1]"]);
const fs = require("node:fs");
const path = require("node:path");
function fail(message, code = "ISOLATED_TARGET_REFUSED") {
  const error = new Error(`Isolated test refused: ${message}`);
  error.code = code;
  throw error;
}
function safeReason(error) {
  const code = error && error.code;
  return typeof code === "string" && /^[A-Z0-9_]{3,60}$/.test(code)
    ? code : "ISOLATED_UNCLASSIFIED_FAILURE";
}
function validateTarget(env) {
  const value = env.ISOLATED_TEST_DATABASE_URL;
  if (!value) fail("ISOLATED_TEST_DATABASE_URL is required; live URLs are never a fallback");
  let url;
  try { url = new URL(value); } catch { fail("invalid dedicated database URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) fail("PostgreSQL is required");
  if (!LOOPBACK.has(url.hostname)) fail("only literal loopback PostgreSQL is supported; remote independence is unproven");
  if (url.search || url.hash) fail("database URL options are prohibited");
  let database, username;
  try {
    database = decodeURIComponent(url.pathname.slice(1));
    username = decodeURIComponent(url.username);
  } catch { fail("invalid database identity"); }
  if (!/^isolated_test_[a-z0-9]{16,40}$/.test(database)) fail("disposable database naming proof is missing");
  if (username !== database) fail("a dedicated database-named role is required");
  if (!url.password) fail("dedicated role credentials are required");
  const port = Number(url.port || 5432);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) fail("invalid database port");
  const appPort = Number(env.ISOLATED_TEST_PORT || 5109);
  if (!Number.isInteger(appPort) || appPort < 1024 || appPort > 65535 || appPort === port)
    fail("invalid or overlapping test port");
  for (const key of ["DATABASE_URL", "SUPABASE_DATABASE_URL"]) {
    if (!env[key]) continue;
    let inherited;
    try { inherited = new URL(env[key]); } catch { fail("cannot compare inherited database identity"); }
    if (!(key === "DATABASE_URL" && env.ISOLATED_TEST_MODE === "1" && env[key] === value)
      && decodeURIComponent(inherited.pathname.slice(1)) === database)
      fail("dedicated database name overlaps an inherited target");
  }
  const registryPath = env.ISOLATED_TEST_REGISTRY;
  if (!registryPath) fail("owned ephemeral cluster registry is required");
  let registry;
  try {
    const stat = fs.lstatSync(registryPath);
    const parent = fs.lstatSync(path.dirname(registryPath));
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)
      || stat.uid !== process.getuid() || !parent.isDirectory()
      || parent.isSymbolicLink() || (parent.mode & 0o077) || parent.uid !== process.getuid())
      fail("registry permissions or owner are unsafe");
    registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    if (registry.version !== 1 || registry.database !== database || registry.port !== port
      || !/^\d{10,25}$/.test(registry.systemIdentifier)
      || !/^[a-f0-9]{48}$/.test(registry.nonce)
      || registry.dataDirectory !== fs.realpathSync(path.join(path.dirname(registryPath), "data"))
      || !/^isolated-test-cluster-/.test(path.basename(path.dirname(registryPath))))
      fail("registry does not prove an owned disposable cluster");
  } catch { fail("owned ephemeral cluster registry is invalid"); }
  return Object.freeze({
    url: value, database, username, host: url.hostname.replace(/^\[|\]$/g, ""),
    port, appPort, registry,
    marker: `isolated-test:disposable:${database}:${registry.nonce}`,
  });
}

// First connection is read-only. No schema, marker, fixture or application writes
// may precede this check. A marker must be installed by the local DB operator.
async function proveDatabase(client, target) {
  await client.query("BEGIN READ ONLY");
  try {
    const result = await client.query(`
      SELECT current_database() AS database, current_user AS username,
        host(inet_server_addr()) AS address, inet_server_port() AS port,
        shobj_description(d.oid, 'pg_database') AS marker,
        pg_get_userbyid(d.datdba) AS owner,
        r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls,
        EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid) AS inherited_roles
      FROM pg_database d JOIN pg_roles r ON r.rolname = current_user
      WHERE d.datname = current_database()
    `);
    const row = result.rows[0];
    for (const [code, valid] of [
      ["PROOF_ROW", !!row],
      ["PROOF_DATABASE", row?.database === target.database],
      ["PROOF_USERNAME", row?.username === target.username],
      ["PROOF_OWNER", row?.owner === target.username],
      ["PROOF_MARKER", row?.marker === target.marker],
      ["PROOF_ADDRESS", row?.address === target.host],
      ["PROOF_PORT", Number(row?.port) === target.port],
      ["PROOF_ROLE", row && !(row.rolsuper || row.rolcreatedb || row.rolcreaterole || row.rolreplication || row.rolbypassrls || row.inherited_roles)],
    ]) if (!valid) fail("read-only database ownership/marker/role/socket proof failed", code);
    const identity = await client.query("SELECT * FROM isolated_test_proof.cluster_identity()");
    if (identity.rows.length !== 1
      || identity.rows[0].data_directory !== target.registry.dataDirectory
      || String(identity.rows[0].system_identifier) !== target.registry.systemIdentifier)
      fail("server cluster identity does not match the owned local registry", "PROOF_CLUSTER_IDENTITY");
  } finally {
    await client.query("ROLLBACK");
  }
}

function assertRuntime(env = process.env) {
  const target = validateTarget(env);
  if (env.ISOLATED_TEST_MODE !== "1" || env.ISOLATED_TEST_PROVEN !== target.marker
    || !globalThis[Symbol.for("isolated-test.network-guard")])
    fail("use the guarded launcher; runtime proof and network preload are required");
  if (env.DATABASE_URL !== target.url || env.SUPABASE_DATABASE_URL || env.USE_SUPABASE)
    fail("runtime database selection is not exclusive");
  return target;
}

module.exports = { validateTarget, proveDatabase, assertRuntime, safeReason };