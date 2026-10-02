"use strict";
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const { validateTarget } = require("./target.cjs");

function buildEnvironment(inherited, root) {
  const target = validateTarget(inherited);
  // Never spread process.env. In particular no NODE_OPTIONS, proxy, cloud,
  // Clerk, Supabase, mail, SMS, payment, storage, production or PG* secrets.
  const env = {
    PATH: inherited.PATH || "/usr/bin:/bin",
    LANG: "C.UTF-8",
    TZ: "Asia/Riyadh",
    NODE_ENV: "test",
    ISOLATED_TEST_MODE: "1",
    ISOLATED_TEST_DATABASE_URL: target.url,
    ISOLATED_TEST_REGISTRY: inherited.ISOLATED_TEST_REGISTRY,
    ISOLATED_TEST_PORT: String(target.appPort),
    PORT: String(target.appPort),
    SESSION_SECRET: randomBytes(48).toString("hex"),
    NODE_OPTIONS: `--require=${path.join(root, "scripts/isolated-test/network-preload.cjs")}`,
  };
  return { env, target };
}
module.exports = { buildEnvironment };