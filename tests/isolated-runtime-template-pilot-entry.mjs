import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import guard from "../scripts/isolated-test/target.cjs";
import { runTemplatePilotSmoke } from "./isolated-runtime-template-pilot.mjs";
const target = guard.assertRuntime();
const origin = `http://127.0.0.1:${target.appPort}`;
const file = path.join(path.dirname(process.env.ISOLATED_TEST_REGISTRY), "credentials.json");
assert.equal((await stat(file)).mode & 0o077, 0);
const { accounts } = JSON.parse(await readFile(file, "utf8"));
const client = new pg.Client({ connectionString: target.url, ssl: false, connectionTimeoutMillis: 5000 });
let count = 0;
const check = (value, code) => { assert.ok(value, code); count++; };
async function request(route, { method = "GET", cookie, body } = {}) {
  const response = await fetch(origin + route, {
    method, headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let json; try { json = JSON.parse(text); } catch {}
  return { status: response.status, cookie: response.headers.get("set-cookie")?.split(";")[0], json };
}
async function loginCredentials(account) {
  const response = await request("/api/auth/login", { method: "POST", body: { username: account.username, password: account.password } });
  check(response.status === 200 && response.cookie, "TP_LOGIN"); return response.cookie;
}
try {
  await client.connect();
  await guard.proveDatabase(client, target);
  let ready = false;
  for (let i=0;i<120;i++) {
    try { if ((await request("/api/health")).status === 200) { ready=true; break; } } catch {}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  check(ready,"TP_SERVER_READY");
  const login = id => loginCredentials(accounts.find(a=>a.id===id));
  await runTemplatePilotSmoke({ client, request, admin: await login("isolated-fixture-admin"),
    manager: await login("isolated-fixture-manager"), employee: await login("isolated-fixture-employee"),
    credentials: accounts.find(a=>a.id==="isolated-fixture-employee"), loginCredentials, check });
  console.log(`Isolated template pilot HTTP passed: ${count} assertions.`);
} catch(error) {
  console.error(`Isolated template pilot HTTP failed [${guard.safeReason(error)}]: ${/^TP_/.test(error.message) ? error.message : "guarded runtime failure"}`);
  process.exitCode=1;
} finally { await client.end().catch(()=>{}); }