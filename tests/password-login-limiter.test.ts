import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { createPasswordLoginRateLimiter } from "../server/password-login-limiter";

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  })));
});

async function client() {
  const app = express();
  app.use(createPasswordLoginRateLimiter());
  app.post("/login", (req, res) => res.sendStatus(req.query.fail === "1" ? 401 : 200));
  const server = await new Promise<Server>(resolve => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  servers.push(server);
  const port = (server.address() as { port: number }).port;
  return async (fail = false) => {
    const result = await fetch(`http://127.0.0.1:${port}/login${fail ? "?fail=1" : ""}`, { method: "POST" });
    await result.text();
    return result;
  };
}

describe("password login throttling for shared branch networks", () => {
  it("allows more than five successful employees on the same IP", async () => {
    const login = await client();
    for (let i = 0; i < 12; i++) expect((await login()).status).toBe(200);
  });
  it("still blocks after five failures from the same IP", async () => {
    const login = await client();
    for (let i = 0; i < 5; i++) expect((await login(true)).status).toBe(401);
    const blocked = await login(true);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });
  it("does not erase earlier failures when a successful login occurs", async () => {
    const login = await client();
    for (let i = 0; i < 4; i++) expect((await login(true)).status).toBe(401);
    for (let i = 0; i < 6; i++) expect((await login()).status).toBe(200);
    expect((await login(true)).status).toBe(401);
    expect((await login()).status).toBe(429);
  });
});