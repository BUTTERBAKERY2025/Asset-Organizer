import { beforeEach, describe, expect, it, vi } from "vitest";
import { branches, maintenanceTickets, centralKitchenOrders } from "../shared/schema";
import type { Request } from "express";
import type { CardDefinition } from "../server/branch-operations";

const state = vi.hoisted(() => ({
  branchRows: [] as { id: string; name: string }[],
  definitions: [] as CardDefinition[],
  permissions: [] as string[],
  queries: [] as string[],
  queueLoads: {} as Record<string, () => Promise<any[]>>,
}));
vi.mock("../server/auth", () => ({
  getAllowedBranchIds: () => null,
  isAuthenticated: () => {},
  requirePermission: () => () => {},
}));
vi.mock("../server/storage", () => ({
  storage: { hasPermission: vi.fn(async (_user: string, module: string, action: string) => {
    state.permissions.push(`${module}:${action}`);
    return module === "maintenance" && action === "view" || module === "central_kitchen_orders" && action === "view";
  }) },
}));
vi.mock("../server/db", () => ({
  pool: {},
  db: {
    select: () => ({
      from: (table: unknown) => {
        const name = table === branches ? "branches" : table === maintenanceTickets ? "maintenance" :
          table === centralKitchenOrders ? "kitchen" : "unexpected";
        state.queries.push(name);
        const result = () => name === "branches" ? Promise.resolve(state.branchRows) :
          state.queueLoads[name]?.() ?? Promise.resolve([]);
        const builder: any = {
          where: () => builder, orderBy: () => builder,
          limit: () => result(), then: (resolve: any, reject: any) => result().then(resolve, reject),
        };
        return builder;
      },
    }),
  },
}));
vi.mock("../server/branch-operations", async (original) => ({
  ...await original<typeof import("../server/branch-operations")>(),
  branchOperationsDefinitions: state.definitions,
}));

import { hasEffectiveViewPermission } from "../server/branch-operations";
import { mapOperationsBounded, projectOperationsCenter } from "../server/operations-center";
import { storage } from "../server/storage";

const request = () => ({ currentUser: { id: "viewer-1", role: "viewer" } }) as Request;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((r, fail) => { resolve = r; reject = fail; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.mocked(storage.hasPermission).mockClear();
  state.branchRows = [{ id: "b1", name: "Branch 1" }];
  state.definitions.length = 0;
  state.permissions = [];
  state.queries = [];
  state.queueLoads = {};
});

describe("operations center bounded projection", () => {
  it("does not read denied card or queue sources, even outside export mode", async () => {
    state.definitions.push({ id: "maintenance", module: "maintenance", title: "", group: "operations",
      href: "/", load: async () => { throw Error("denied loader invoked"); } });
    const { storage } = await import("../server/storage");
    vi.mocked(storage.hasPermission).mockImplementationOnce(async (_id, _module, _action) => {
      state.permissions.push("maintenance:view");
      return false;
    });
    const result = await projectOperationsCenter(request(), ["b1"], 0, false);
    expect(result.cards).toEqual([]);
    expect(result.queue).toEqual([]);
    expect(state.queries).toEqual(["branches"]);
    expect(result.modules).not.toContain("maintenance");
  });

  it("deduplicates in-flight permission checks for each request, never across requests", async () => {
    const { storage } = await import("../server/storage");
    const gate = deferred<boolean>();
    vi.mocked(storage.hasPermission).mockImplementationOnce(() => gate.promise);
    const req = request();
    const checks = Array.from({ length: 14 }, () => hasEffectiveViewPermission(req, "maintenance"));
    await Promise.resolve();
    expect(storage.hasPermission).toHaveBeenCalledTimes(1);
    gate.resolve(true);
    expect(await Promise.all(checks)).toEqual(Array(14).fill(true));
    expect(await hasEffectiveViewPermission(req, "maintenance")).toBe(true);
    expect(storage.hasPermission).toHaveBeenCalledTimes(1);
    await hasEffectiveViewPermission(request(), "maintenance");
    expect(storage.hasPermission).toHaveBeenCalledTimes(2);
  });

  it("bounds card fanout and preserves order when completions are reversed", async () => {
    const gates = Array.from({ length: 14 }, deferred<number>);
    let active = 0, peak = 0;
    const work = mapOperationsBounded(gates.map((_, i) => i), 6, async i => {
      peak = Math.max(peak, ++active);
      const value = await gates[i].promise;
      active--;
      return value;
    });
    await Promise.resolve();
    expect(peak).toBe(6);
    expect(gates.slice(6).every(g => g.resolve !== undefined)).toBe(true);
    for (let i = 13; i >= 0; i--) gates[i].resolve(i);
    expect(await work).toEqual(Array.from({ length: 14 }, (_, i) => i));
    expect(peak).toBe(6);
  });

  it("never starts more than six card loaders in a projection", async () => {
    const gates = Array.from({ length: 14 }, deferred<void>);
    let active = 0, peak = 0, started = 0;
    gates.forEach((gate, index) => state.definitions.push({
      id: "maintenance", module: "maintenance", title: String(index), group: "operations", href: "/",
      load: async () => {
        started++;
        peak = Math.max(peak, ++active);
        await gate.promise;
        active--;
        return { metrics: [], alerts: [] };
      },
    }));
    const projection = projectOperationsCenter(request(), ["b1"], 0);
    for (let i = 0; i < 10 && started < 6; i++)
      await new Promise(resolve => setImmediate(resolve));
    expect(started).toBe(6);
    expect(peak).toBe(6);
    gates.forEach(gate => gate.resolve());
    expect((await projection).cards.map(card => card.title)).toEqual(
      Array.from({ length: 14 }, (_, i) => String(i)));
    expect(peak).toBe(6);
  });

  it("starts independent queue sources without waiting for the first and reports failure", async () => {
    for (const module of ["maintenance", "central_kitchen_orders"]) state.definitions.push({
      id: "maintenance", module, title: "", group: "operations", href: "/",
      load: async () => ({ metrics: [], alerts: [] }),
    });
    const first = deferred<any[]>();
    const second = deferred<any[]>();
    const started: string[] = [];
    state.queueLoads = {
      maintenance: () => { started.push("maintenance"); return first.promise; },
      kitchen: () => { started.push("kitchen"); return second.promise; },
    };
    const projection = projectOperationsCenter(request(), ["b1"], 0);
    // Let the branch query and bounded grant checks settle.
    for (let i = 0; i < 10 && started.length < 2; i++)
      await new Promise(resolve => setImmediate(resolve));
    expect(state.permissions).toContain("maintenance:view");
    expect(state.permissions).toContain("central_kitchen_orders:view");
    expect(state.queries).toContain("maintenance");
    expect(state.queries).toContain("kitchen");
    expect(started).toEqual(["maintenance", "kitchen"]);
    second.resolve([]);
    first.reject(new Error("maintenance unavailable"));
    const result = await projection;
    expect(result.coverage.queue).toMatchObject({ maintenance: "unavailable", kitchen: "complete" });
  });

  it("14 branches × 14 cards make one shared view lookup, not 196 repeated lookups", async () => {
    state.branchRows = Array.from({ length: 14 }, (_, i) => ({ id: `b${i}`, name: `Branch ${i}` }));
    let loaded = 0;
    for (let i = 0; i < 14; i++) state.definitions.push({
      id: "maintenance", module: "maintenance", title: "", group: "operations", href: "/",
      load: async () => { loaded++; return { metrics: [], alerts: [] }; },
    });
    const result = await projectOperationsCenter(request(), "all", 0);
    expect(result.cards).toHaveLength(196);
    expect(loaded).toBe(196);
    expect(state.permissions.filter(key => key === "maintenance:view")).toHaveLength(1);
    expect(state.queries.filter(name => name === "maintenance")).toHaveLength(1);
  });
});