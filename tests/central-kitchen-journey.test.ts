import { describe, expect, it, vi } from "vitest";

vi.mock("../server/db", () => ({
  db: { select: vi.fn() },
  pool: { query: vi.fn() },
}));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  requirePermission: (_module: string, _action: string) => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAllowedBranchIds: () => [],
  canAccessBranch: async () => false,
}));

import { composeKitchenOrderJourney, registerCentralKitchenJourneyRoute } from "../server/central-kitchen-journey";
import { pool } from "../server/db";

const order = {
  id: 42, status: "dispatched", inventoryMode: "real", requestBranchId: "destination",
  centralKitchenId: "kitchen", discrepancyStatus: "none",
  linkedBatches: [], items: [{ productId: 7, dispatchedQuantity: 5, receivedQuantity: null }],
};

describe("read-only kitchen order journey", () => {
  it("does not invent production, stock, handoff completion or quantity counters", () => {
    const dto = composeKitchenOrderJourney(order, { production: "available", delivery: "absent", inventory: "available", bar: "available" },
      null, { lotIds: [12], handoffIds: [20] });
    expect(dto.delivery).toBeNull();
    expect(dto.stages.find(stage => stage.key === "bar")?.status).toBe("unknown");
    expect(dto.stages.find(stage => stage.key === "inventory")?.status).toBe("unknown");
    expect(dto.warnings.join(" ")).toContain("لا يمكن نسبتهما لهذا الطلب");
    expect(JSON.stringify(dto)).not.toMatch(/availableQuantity|completedQuantity|stockBalance/);
  });

  it("preserves cancellation, partial receipt and shadow as non-stock", () => {
    const dto = composeKitchenOrderJourney({
      ...order, status: "cancelled", inventoryMode: "shadow", discrepancyStatus: "open",
      items: [{ productId: 7, dispatchedQuantity: 5, receivedQuantity: 2 }],
    }, { production: "restricted", delivery: "restricted", inventory: "absent", bar: "absent" }, null, { lotIds: [], handoffIds: [] });
    expect(dto.stages.every(stage => stage.status === "blocked" || stage.status === "unknown")).toBe(true);
    expect(dto.warnings.join(" ")).toMatch(/جزئي/);
    expect(dto.warnings.join(" ")).toMatch(/الظل/);
    expect(dto.sectionState.delivery).toBe("restricted");
    expect(dto.sections.delivery).toBe(false);
  });

  it("distinguishes a failed query from no record", () => {
    const dto = composeKitchenOrderJourney(order, { production: "available", delivery: "error", inventory: "absent", bar: "restricted" },
      null, { lotIds: [], handoffIds: [] });
    expect(dto.sectionState).toEqual({ production: "available", delivery: "error", inventory: "absent", bar: "restricted" });
    expect(dto.sharedBranchContext).toBeUndefined();
  });

  it("shows authorized empty workspaces, completed receipt and explicit substitute identities", () => {
    const dto = composeKitchenOrderJourney({
      ...order, status: "received", linkedBatches: undefined,
      items: [{ productId: 7, substituteProductId: 8, dispatchedQuantity: 5, receivedQuantity: 5 }],
    }, { production: "restricted", delivery: "absent", inventory: "absent", bar: "absent" },
    null, { lotIds: [], handoffIds: [] });
    expect(dto.sections).toEqual({ production: false, delivery: true, inventory: true, bar: true });
    expect(dto.stages.find(stage => stage.key === "receipt")?.status).toBe("complete");
    expect(dto.inventoryProductIds).toEqual([7, 8]);
    expect(dto.stages.find(stage => stage.key === "production")?.summary).toMatch(/محجوبة/);
    expect(composeKitchenOrderJourney({ ...order, status: "requested" },
      { production: "available", delivery: "absent", inventory: "absent", bar: "absent" },
      null, { lotIds: [], handoffIds: [] }).stages[0].status).toBe("current");
  });

  it("validates ID, reuses detail visibility and sends no-store headers before downstream reads", async () => {
    const handlers: Array<(req: any, res: any) => Promise<unknown>> = [];
    const app = { get: (_path: string, ...callbacks: any[]) => handlers.push(callbacks.at(-1)) };
    const detail = vi.fn(async () => order);
    const access = vi.fn(async () => false);
    registerCentralKitchenJourneyRoute(app as any, detail, access);
    const reply = () => {
      const res: any = { code: 200, headers: {}, status(code: number) { this.code = code; return this; },
        setHeader(name: string, value: string) { this.headers[name] = value; },
        json(value: unknown) { this.body = value; return this; } };
      return res;
    };
    const invalid = reply();
    await handlers[0]({ params: { id: "42abc" } }, invalid);
    expect(invalid.code).toBe(400);
    expect(detail).not.toHaveBeenCalled();
    const denied = reply();
    await handlers[0]({ params: { id: "42" } }, denied);
    expect(denied.code).toBe(403);
    expect(access).toHaveBeenCalledWith({ params: { id: "42" } }, order);
    expect(denied.headers["Cache-Control"]).toContain("no-store");
  });

  it("does not disclose delivery assignments to an order viewer with a delivery job title", async () => {
    const handlers: any[] = [];
    registerCentralKitchenJourneyRoute({ get: (_path: string, ...callbacks: any[]) => handlers.push(callbacks.at(-1)) } as any,
      async () => order, async () => true);
    const res: any = { setHeader: vi.fn(), json(value: unknown) { this.body = value; return this; } };
    vi.mocked(pool.query).mockClear();
    await handlers[0]({ params: { id: "42" }, currentUser: { jobTitle: "delivery" } }, res);
    expect(res.body.sectionState.delivery).toBe("restricted");
    expect(res.body.delivery).toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });
});