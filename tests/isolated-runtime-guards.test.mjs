import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer as tcpServer } from "node:net";
import { createServer as httpServer } from "node:http";
import targetGuard from "../scripts/isolated-test/target.cjs";
import environment from "../scripts/isolated-test/environment.cjs";
import { transform } from "esbuild";

const root = process.cwd();
const directory = mkdtempSync(path.join(tmpdir(), "isolated-test-cluster-"));
mkdirSync(path.join(directory, "data"), { mode: 0o700 });
const database = "isolated_test_0123456789abcdef";
const registryPath = path.join(directory, "registry.json");
const registry = {
  version: 1, database, port: 55439, dataDirectory: path.join(directory, "data"),
  systemIdentifier: "1234567890123456789", nonce: "a".repeat(48),
};
function registryWrite(value = registry) {
  writeFileSync(registryPath, JSON.stringify(value), { mode: 0o600 });
}
registryWrite();
const sourceEnv = {
  PATH: process.env.PATH,
  ISOLATED_TEST_DATABASE_URL: `postgresql://${database}:synthetic-test-only@127.0.0.1:55439/${database}`,
  ISOLATED_TEST_REGISTRY: registryPath,
  ISOLATED_TEST_PORT: "5109",
};
function run(code, overrides = {}) {
  const { env } = environment.buildEnvironment(sourceEnv, root);
  return spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: root, env: { ...env, ...overrides }, encoding: "utf8", timeout: 10000,
  });
}
test.after(() => rmSync(directory, { recursive: true, force: true }));
test("transpiled CJS production runtime imports without test scripts or database access", async () => {
  const productionDirectory = mkdtempSync(path.join(tmpdir(), "isolated-prod-import-"));
  try {
    const output = await transform(readFileSync("server/isolated-test-runtime.ts", "utf8"), { loader: "ts", format: "cjs" });
    writeFileSync(path.join(productionDirectory, "runtime.cjs"), output.code);
    const result = spawnSync(process.execPath, ["-e", `
      const assert = require('node:assert/strict');
      const Module = require('node:module');
      const load = Module._load;
      Module._load = function(name, ...args) {
        assert.ok(!name.includes('scripts/isolated-test'), 'production loaded test guard');
        return load.call(this, name, ...args);
      };
      const runtime = require('./runtime.cjs');
      assert.equal(runtime.isolatedTestMode, false);
      assert.equal(runtime.isolatedTestTarget, undefined);
    `], { cwd: productionDirectory, env: { PATH: process.env.PATH, NODE_ENV: "production" }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  } finally { rmSync(productionDirectory, { recursive: true, force: true }); }
});

test("dedicated target fails closed, and subprocess failures do not expose URL credentials", () => {
  const cases = [
    { ISOLATED_TEST_DATABASE_URL: "" },
    { ISOLATED_TEST_DATABASE_URL: sourceEnv.ISOLATED_TEST_DATABASE_URL.replace("127.0.0.1", "example.com") },
    { ISOLATED_TEST_DATABASE_URL: sourceEnv.ISOLATED_TEST_DATABASE_URL.replace(database, "postgres") },
    { ISOLATED_TEST_DATABASE_URL: sourceEnv.ISOLATED_TEST_DATABASE_URL + "?host=example.com" },
    { ISOLATED_TEST_REGISTRY: "/missing/registry.json" },
    { DATABASE_URL: sourceEnv.ISOLATED_TEST_DATABASE_URL },
  ];
  for (const override of cases) assert.throws(() => targetGuard.validateTarget({ ...sourceEnv, ...override }));
  const failure = run("console.log('should not run')", { ISOLATED_TEST_DATABASE_URL: "" });
  assert.notEqual(failure.status, 0);
  assert.doesNotMatch(failure.stderr, /synthetic-test-only/);
  assert.doesNotMatch(failure.stdout, /should not run/);
});

test("environment allowlist removes inherited provider, proxy, PG, auth and Node injection", () => {
  const { env } = environment.buildEnvironment({
    ...sourceEnv,
    DATABASE_URL: "postgresql://live:secret@production.example/live",
    SUPABASE_DATABASE_URL: "postgresql://live:secret@production.example/live",
    OPENAI_API_KEY: "secret", CLERK_SECRET_KEY: "secret", SUPABASE_SERVICE_ROLE_KEY: "secret",
    SMTP_PASSWORD: "secret", TWILIO_AUTH_TOKEN: "secret", AWS_SECRET_ACCESS_KEY: "secret",
    PGHOST: "production.example", HTTPS_PROXY: "https://production.example",
    NODE_OPTIONS: "--import=malicious.mjs", SESSION_SECRET: "inherited",
  }, root);
  for (const key of ["DATABASE_URL", "SUPABASE_DATABASE_URL", "OPENAI_API_KEY", "CLERK_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "SMTP_PASSWORD", "TWILIO_AUTH_TOKEN", "AWS_SECRET_ACCESS_KEY",
    "PGHOST", "HTTPS_PROXY"]) assert.equal(env[key], undefined);
  assert.notEqual(env.SESSION_SECRET, "inherited");
  assert.doesNotMatch(env.NODE_OPTIONS, /malicious/);
});

test("actual subprocess net/tls/dns/http/fetch/UDP/HTTP2/subprocess egress is blocked", () => {
  const result = run(`
    import assert from 'node:assert/strict';
    import net from 'node:net';
    import tls from 'node:tls';
    import dns from 'node:dns';
    import http from 'node:http';
    import https from 'node:https';
    import http2 from 'node:http2';
    import dgram from 'node:dgram';
    import { spawn } from 'node:child_process';
    import { Worker } from 'node:worker_threads';
    const blocked = /ISOLATED_NETWORK_BLOCKED/;
    for (const attempt of [
      () => net.connect(443, 'example.com'),
      () => new net.Socket().connect({ host: '8.8.8.8', port: 443 }),
      () => net.connect({ host: '127.0.0.1', port: 5432 }),
      () => net.connect({ path: '/tmp/pg.sock' }),
      () => tls.connect(443, 'example.com'),
      () => dns.lookup('example.com', () => {}),
      () => dns.resolve4('example.com', () => {}),
      () => dns.promises.lookup('example.com'),
      () => new dns.Resolver().resolve4('example.com', () => {}),
      () => http.get('http://example.com'),
      () => https.request('https://example.com'),
      () => http.get('http://127.0.0.1:5432'),
      () => http.get('http://127.0.0.1:5109', { hostname: 'example.com' }),
      () => http2.connect('https://example.com'),
      () => dgram.createSocket('udp4'),
      () => spawn('curl', ['https://example.com']),
      () => new Worker('fetch("https://example.com")', { eval: true, execArgv: [] }),
      () => net.createServer().listen({ port: 5109, host: '0.0.0.0' }),
    ]) assert.throws(attempt, blocked);
    await assert.rejects(fetch('https://example.com'), blocked);
    await assert.rejects(fetch('http://127.0.0.1:5432'), blocked);
    let periodicEffect = false;
    const timer = setInterval(() => { periodicEffect = true; }, 1);
    await new Promise(resolve => setTimeout(resolve, 15));
    clearInterval(timer);
    assert.equal(periodicEffect, false);
    console.log('egress guards passed');
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /egress guards passed/);
});

test("runtime flag alone never authorizes startup", () => {
  const result = run(`
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    require('./scripts/isolated-test/target.cjs').assertRuntime();
  `);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /runtime proof/);
});
test("guarded child can bind its exact loopback app port without external DNS", async () => {
  const reserved = tcpServer();
  await new Promise(resolve => reserved.listen(0, "127.0.0.1", resolve));
  const appPort = reserved.address().port;
  await new Promise(resolve => reserved.close(resolve));
  const result = run(`
    import assert from 'node:assert/strict';
    import http from 'node:http';
    import dns from 'node:dns';
    assert.equal((await dns.promises.lookup('127.0.0.1')).address, '127.0.0.1');
    const server = http.createServer((_req, res) => res.end('guarded listener'));
    await new Promise((resolve, reject) => {
      server.on('error', reject);
      server.listen({ host: '127.0.0.1', port: ${appPort} }, resolve);
    });
    assert.equal(await (await fetch('http://127.0.0.1:${appPort}')).text(), 'guarded listener');
    await new Promise(resolve => server.close(resolve));
  `, { ISOLATED_TEST_PORT: String(appPort) });
  assert.equal(result.status, 0, result.stderr);
});

test("database proof uses a read-only transaction, checks real identity, rejects mismatches before writes", async () => {
  const target = targetGuard.validateTarget(sourceEnv);
  const good = {
    database, username: database, owner: database, marker: target.marker,
    address: "127.0.0.1", port: 55439, inherited_roles: false,
  };
  for (const changes of [{}, { marker: "wrong" }, { rolsuper: true }, { database: "live" }, { inherited_roles: true }]) {
    const queries = [];
    const fakeClient = {
      async query(sql) {
        queries.push(sql);
        if (sql.includes("FROM pg_database")) return { rows: [{ ...good, ...changes }] };
        if (sql.includes("cluster_identity")) return { rows: [{ data_directory: registry.dataDirectory, system_identifier: registry.systemIdentifier }] };
        return { rows: [] };
      },
    };
    if (Object.keys(changes).length) await assert.rejects(targetGuard.proveDatabase(fakeClient, target));
    else await targetGuard.proveDatabase(fakeClient, target);
    assert.equal(queries[0], "BEGIN READ ONLY");
    assert.equal(queries.at(-1), "ROLLBACK");
    assert.ok(queries.every(sql => !/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/.test(sql)));
  }
});

test("actual child sockets can reach only the registered DB port and loopback test HTTP port", async () => {
  const dbServer = tcpServer(socket => { socket.end("synthetic socket proof"); });
  const webServer = httpServer((_req, res) => res.end("local test"));
  await new Promise(resolve => dbServer.listen(0, "127.0.0.1", resolve));
  await new Promise(resolve => webServer.listen(0, "127.0.0.1", resolve));
  const dbPort = dbServer.address().port;
  const appPort = webServer.address().port;
  registryWrite({ ...registry, port: dbPort });
  try {
    const { env } = environment.buildEnvironment({
      ...sourceEnv, ISOLATED_TEST_DATABASE_URL: sourceEnv.ISOLATED_TEST_DATABASE_URL.replace(":55439/", `:${dbPort}/`),
      ISOLATED_TEST_PORT: String(appPort),
    }, root);
    const result = await new Promise(resolve => {
      const child = spawn(process.execPath, ["--input-type=module", "-e", `
        import net from 'node:net';
        import assert from 'node:assert/strict';
        await new Promise((resolve, reject) => {
          const socket = net.connect({ host: '127.0.0.1', port: ${dbPort} });
          socket.on('error', reject);
          socket.on('data', () => {});
          socket.on('end', resolve);
        });
        assert.equal(await (await fetch('http://127.0.0.1:${appPort}')).text(), 'local test');
      `], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      child.stderr.on("data", chunk => { stderr += chunk; });
      child.on("exit", code => resolve({ code, stderr }));
    });
    assert.equal(result.code, 0, result.stderr);
  } finally {
    registryWrite();
    await Promise.all([new Promise(resolve => dbServer.close(resolve)), new Promise(resolve => webServer.close(resolve))]);
  }
});