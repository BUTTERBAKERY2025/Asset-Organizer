import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ grants: ["a"] as string[], lookups: 0 }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAllowedBranchIds: () => state.grants,
}));
vi.mock("../server/db", () => ({
  db: { select: () => { state.lookups++; return { from: () => ({ where: () => Promise.resolve([{ id: "a" }]) }) }; } },
  pool: {},
}));
vi.mock("../server/storage", () => ({ storage: {} }));

import { registerOperationsCenterRoutes } from "../server/operations-center";

const handlers: Record<string, (...args: any[]) => Promise<any>> = {};
registerOperationsCenterRoutes({
  get: (path: string, ...functions: any[]) => { handlers[`GET ${path}`] = functions.at(-1); },
  post: (path: string, ...functions: any[]) => { handlers[`POST ${path}`] = functions.at(-1); },
} as any);

async function request(method: "GET" | "POST", query: object = {}, body: object = {}) {
  const res: any = {
    statusCode: 200, data: undefined,
    set: () => res,
    status(code: number) { res.statusCode = code; return res; },
    json(value: unknown) { res.data = value; return res; },
  };
  await handlers[`${method} /api/operations-center/${method === "GET" ? "monthly" : "insights"}`](
    { query, body, currentUser: { id: "operator" } }, res, (error: unknown) => { throw error; },
  );
  return res;
}

describe("monthly and AI scope before financial reads or model calls", () => {
  it("rejects malformed months and implicit all-branch reads", async () => {
    state.lookups = 0;
    expect((await request("GET", { month: "2026-13", branchIds: "a" })).statusCode).toBe(400);
    expect((await request("GET", { month: "2026-09", branchIds: "all" })).statusCode).toBe(400);
    expect((await request("GET", { month: "2026-09", branchIds: "a,a" })).statusCode).toBe(400);
    expect(state.lookups).toBe(0);
  });
  it("denies a second branch even when the manager can see one", async () => {
    state.lookups = 0;
    expect((await request("GET", { month: "2026-09", branchIds: "a,b" })).statusCode).toBe(403);
    expect(state.lookups).toBe(0);
  });
  it("does not call the model for forged or omitted branch scope", async () => {
    state.lookups = 0;
    expect((await request("POST", {}, { branchIds: [] })).statusCode).toBe(400);
    expect((await request("POST", {}, { branchIds: ["all"] })).statusCode).toBe(400);
    expect(state.lookups).toBe(0);
  });
});