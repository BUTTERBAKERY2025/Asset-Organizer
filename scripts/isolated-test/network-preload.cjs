"use strict";
const { validateTarget } = require("./target.cjs");
const target = validateTarget(process.env);
if (process.env.ISOLATED_TEST_MODE !== "1") throw new Error("Isolated network guard requires test mode");
const net = require("node:net");
const tls = require("node:tls");
const dns = require("node:dns");
const http = require("node:http");
const https = require("node:https");
const { syncBuiltinESMExports } = require("node:module");
const deny = () => {
  const error = new Error("ISOLATED_NETWORK_BLOCKED: destination or operation not permitted");
  error.code = "ISOLATED_NETWORK_BLOCKED";
  throw error;
};
const loopback = host => host === "127.0.0.1" || host === "::1" || host === "[::1]";
function socketOptions(args) {
  const first = args[0];
  if (first && typeof first === "object") {
    // Node internally passes a normalized [options, callback] tuple.
    if (Array.isArray(first)) return socketOptions(first);
    return first;
  }
  if (typeof first === "number") return { port: first, host: typeof args[1] === "string" ? args[1] : "localhost" };
  return {};
}
function checkSocket(options) {
  if (options.path || options.fd != null || options.socket) deny();
  const host = options.host || options.hostname || "localhost";
  const port = Number(options.port);
  if (!((host === target.host && port === target.port)
    || (loopback(host) && port === target.appPort))) deny();
}
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  checkSocket(socketOptions(args));
  return originalConnect.apply(this, args);
};
const tlsConnect = tls.connect;
tls.connect = function (...args) {
  checkSocket(socketOptions(args));
  return tlsConnect.apply(this, args);
};
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  const options = socketOptions(args);
  if (!loopback(options.host) || Number(options.port) !== target.appPort
    || options.path || options.fd != null) deny();
  return listen.apply(this, args);
};
// Node's listen path still calls lookup for literal addresses. Permit only
// literal loopback lookup (no name resolution) and deny every other resolver.
const originalLookup = dns.lookup;
const originalPromiseLookup = dns.promises.lookup;
for (const owner of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
  for (const name of Object.getOwnPropertyNames(owner)) {
    if (/^(lookup|resolve|reverse|setServers)/.test(name) && typeof owner[name] === "function") owner[name] = deny;
  }
}
dns.lookup = function (hostname, ...args) {
  if (!loopback(hostname)) deny();
  return originalLookup.call(dns, hostname, ...args);
};
dns.promises.lookup = function (hostname, ...args) {
  if (!loopback(hostname)) deny();
  return originalPromiseLookup.call(dns.promises, hostname, ...args);
};
function checkHttp(args, secure) {
  const first = args[0];
  let options = {};
  if (typeof first === "string" || first instanceof URL) {
    let url;
    try { url = new URL(first); } catch { deny(); }
    options = { host: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80) };
    if (url.username || url.password || !["http:", "https:"].includes(url.protocol)) deny();
    if (args[1] && typeof args[1] === "object") Object.assign(options, args[1]);
  } else if (first && typeof first === "object") options = { ...first };
  const host = options.hostname || options.host || "localhost";
  if (!loopback(host) || Number(options.port || (secure ? 443 : 80)) !== target.appPort
    || options.socketPath || options.createConnection || options.agent === undefined && options.socket) deny();
}
for (const [owner, secure] of [[http, false], [https, true]]) {
  for (const name of ["request", "get"]) {
    const original = owner[name];
    owner[name] = function (...args) {
      checkHttp(args, secure);
      return original.apply(this, args);
    };
  }
}
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  try { checkHttp([typeof input === "object" && input.url ? input.url : input], false); }
  catch (error) { return Promise.reject(error); }
  return originalFetch(input, init);
};
// UDP, HTTP/2 and subprocesses would sidestep the TCP wrappers.
require("node:dgram").createSocket = deny;
const http2 = require("node:http2");
http2.connect = deny;
http2.createServer = deny;
http2.createSecureServer = deny;
const childProcess = require("node:child_process");
for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"])
  childProcess[name] = deny;
// A worker with custom execArgv could omit this preload entirely.
require("node:worker_threads").Worker = class {
  constructor() { deny(); }
};
// Some route modules register reminder sweeps on import, before index.ts can
// gate scheduler startup. In isolated mode no periodic background callback may
// send mail, sweep queues, or mutate fixtures while a test is in progress.
const timers = require("node:timers");
const originalSetInterval = timers.setInterval;
const inertInterval = () => {
  const timer = originalSetInterval(() => {}, 2147483647);
  timer.unref();
  return timer;
};
timers.setInterval = inertInterval;
globalThis.setInterval = inertInterval;
syncBuiltinESMExports();
Object.defineProperty(globalThis, Symbol.for("isolated-test.network-guard"), { value: true });