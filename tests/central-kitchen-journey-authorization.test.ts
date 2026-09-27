import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../server/db", () => ({
  db: { select: mocks.select },
  pool: { query: mocks.query },
}));
vi.mock("../server/auth", () => ({
  isAuthenticated: (req: any, res: any, next: () => void) =>
    req.currentUser ? next() : res.status(401).json({ error: "unauthenticated" }),
  requirePermission: (module: string, action: string) => (req: any, res: any, next: () => void) =>
    req.grants?.includes(`${module}:${action}`)
      ? next() : res.status(403).json({ error: "permission denied" }),
  getAllowedBranchIds: (req: any) => req.branches,
  canAccessBranch: async (req: any, branch: string) =>
    req.branches === null || req.branches.includes(branch),
}));

import { registerCentralKitchenJourneyRoute } from "../server/central-kitchen-journey";

const order = {
  id: 42, status: "approved", inventoryMode: "real",
  requestBranchId: "destination", centralKitchenId: "kitchen", discrepancyStatus: "none",
  items: [{ productId: 7, substituteProductId: 8, dispatchedQuantity: null, receivedQuantity: null }],
  linkedBatches: [{ id: 101, status: "planned" }],
};

function setup() {
  let handlers: any[] = [];
  const detail = vi.fn(async () => order);
  const access = vi.fn(async (req: any, value: typeof order) =>
    req.branches === null || req.branches.includes(value.requestBranchId) || req.branches.includes(value.centralKitchenId));
  registerCentralKitchenJourneyRoute({
    get: (_path: string, ...callbacks: any[]) => { handlers = callbacks; },
  } as any, detail, access);
  async function request(branches: string[] | null, grants: string[], jobTitle = "viewer") {
    const req = { params: { id: "42" }, branches, grants, currentUser: { jobTitle } };
    const res: any = {
      statusCode: 200, headers: {} as Record<string, string>, body: undefined,
      setHeader(name: string, value: string) { this.headers[name] = value; },
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };
    for (const handler of handlers) {
      let next = false;
      await handler(req, res, () => { next = true; });
      if (!next) break;
    }
    return res;
  }
  return { request, detail, access };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockResolvedValue({ rows: [{ id: 300, status: "assigned" }] });
  mocks.select.mockImplementation(() => ({
    from: () => ({ where: async () => [{ id: 900 }] }),
  }));
});

describe("kitchen order journey embedded authorization", () => {
  it("keeps the base detail behind order-view and either order branch, with action-specific scope", () => {
    // Contract check for the base route, whose registration belongs to routes.ts.
    // The executable journey cases below cover the embedded permission checks.
    const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
    const base = routes.slice(routes.indexOf('app.get(\n    "/api/central-kitchen-orders/:id",'),
      routes.indexOf('app.post(\n    "/api/central-kitchen-orders",'));
    expect(base).toContain('requirePermission("central_kitchen_orders", "view")');
    expect(base.indexOf("canAccessCentralKitchenOrder(req, detail")).toBeLessThan(base.indexOf("const allowedActions"));
    expect(base).toContain('action === "receive" ? detail.requestBranchId : detail.centralKitchenId');
    expect(base).toContain("kitchenActionAllowed(db, actorId, detail, action)");
    expect(base).toContain("canAccessBranch(req, detail.requestBranchId)");
    expect(base).toContain('return res.json({ ...detail, allowedActions })');

    const detail = routes.slice(routes.indexOf("const getCentralKitchenOrderDetail ="),
      routes.indexOf("const canAccessCentralKitchenOrder ="));
    expect(detail).toContain("eq(centralKitchenOrderItems.orderId, orderId)");
    expect(detail).toContain("eq(centralKitchenOrderEvents.orderId, orderId)");
    expect(detail).toContain("eq(centralKitchenInventoryAllocations.orderId, orderId)");
    expect(detail).toContain("eq(centralKitchenShadowInventoryEntries.orderId, orderId)");
    expect(detail).toContain("eq(centralKitchenOrders.id, orderId)");
    expect(detail).toContain("eq(centralKitchenOrderItems.orderId, orderId)");
  });

  it("allows basic order view without disclosing production, delivery, stock or bar", async () => {
    const { request } = setup();
    const result = await request(["destination"], ["central_kitchen_orders:view"]);
    expect(result.statusCode).toBe(200);
    expect(result.body.orderId).toBe(42);
    expect(result.body.sectionState).toEqual({
      production: "restricted", delivery: "restricted", inventory: "restricted", bar: "restricted",
    });
    expect(result.body.delivery).toBeNull();
    expect(result.body.sharedBranchContext).toBeUndefined();
    expect(result.body.stages.find((stage: any) => stage.key === "production").summary).not.toContain("توجد دفعات");
    expect(JSON.stringify(result.body)).not.toMatch(/900|300|101/);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("scopes production to the kitchen, while stock and bar require requester-branch production access", async () => {
    const { request } = setup();
    const grants = ["central_kitchen_orders:view", "production:view"];
    const kitchen = await request(["kitchen"], grants);
    expect(kitchen.body.sectionState).toEqual({
      production: "available", delivery: "restricted", inventory: "restricted", bar: "restricted",
    });
    expect(kitchen.body.sharedBranchContext).toBeUndefined();
    expect(mocks.select).not.toHaveBeenCalled();

    const requester = await request(["destination"], grants);
    expect(requester.body.sectionState).toEqual({
      production: "restricted", delivery: "restricted", inventory: "available", bar: "available",
    });
    expect(requester.body.sharedBranchContext).toEqual({ lotIds: [900], handoffIds: [900] });
    expect(mocks.select).toHaveBeenCalledTimes(2);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("does not give delivery status with only delivery permission, or to delivery-role users", async () => {
    const { request } = setup();
    const grants = ["central_kitchen_orders:view", "delivery_tasks:view"];
    expect((await request(["kitchen"], grants)).body.sectionState.delivery).toBe("available");
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect((await request(["destination"], grants)).body.sectionState.delivery).toBe("restricted");
    expect((await request(["kitchen"], grants, "delivery")).body.sectionState.delivery).toBe("restricted");
    expect(mocks.query).toHaveBeenCalledTimes(1);
    const receiver = await request(["destination"],
      ["central_kitchen_orders:view", "central_kitchen_orders:edit", "delivery_tasks:approve"]);
    expect(receiver.body.delivery).toEqual({ id: 300, status: "assigned" });
  });

  it("denies an unrelated branch before any downstream reads", async () => {
    const { request, access } = setup();
    const result = await request(["other"], [
      "central_kitchen_orders:view", "production:view", "delivery_tasks:view",
    ]);
    expect(result.statusCode).toBe(403);
    expect(result.headers["Cache-Control"]).toContain("no-store");
    expect(access).toHaveBeenCalledOnce();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("does not reuse a prior grant after revocation and marks the denial no-store", async () => {
    const { request, detail } = setup();
    expect((await request(["kitchen"], ["central_kitchen_orders:view"])).statusCode).toBe(200);
    const denied = await request(["kitchen"], []);
    expect(denied.statusCode).toBe(403);
    expect(denied.headers["Cache-Control"]).toBe("private, no-store");
    expect(detail).toHaveBeenCalledTimes(1);
  });

  it("reports optional query failures as errors without failing basic order visibility", async () => {
    const { request } = setup();
    mocks.query.mockRejectedValue(new Error("delivery unavailable"));
    mocks.select.mockImplementationOnce(() => ({ from: () => ({ where: async () => { throw new Error("lots unavailable"); } }) }))
      .mockImplementationOnce(() => ({ from: () => ({ where: async () => { throw new Error("bar unavailable"); } }) }));
    const result = await request(["kitchen", "destination"], [
      "central_kitchen_orders:view", "production:view", "delivery_tasks:view",
    ]);
    expect(result.statusCode).toBe(200);
    expect(result.body.sectionState).toEqual({
      production: "available", delivery: "error", inventory: "error", bar: "error",
    });
    expect(result.body.delivery).toBeNull();
    expect(result.body.sharedBranchContext).toBeUndefined();
    expect(result.body.warnings.join(" ")).toMatch(/تعذر تحميل/);
  });
});