import { describe, expect, it } from "vitest";
import {
  canTransitionCentralKitchenOrder,
  centralKitchenIdempotencyKeySchema,
  createCentralKitchenOrderSchema,
  createCentralKitchenPayloadFingerprint,
  isMatchingCentralKitchenReplay,
} from "../server/central-kitchen-orders";

describe("central kitchen workflow rules", () => {
  it("permits only the strict forward transition table", () => {
    expect(canTransitionCentralKitchenOrder("requested", "approved")).toBe(true);
    expect(canTransitionCentralKitchenOrder("approved", "prepared")).toBe(true);
    expect(canTransitionCentralKitchenOrder("prepared", "dispatched")).toBe(true);
    expect(canTransitionCentralKitchenOrder("dispatched", "received")).toBe(true);
    expect(canTransitionCentralKitchenOrder("approved", "received")).toBe(false);
    expect(canTransitionCentralKitchenOrder("received", "dispatched")).toBe(false);
  });

  it("rejects weak idempotency keys and invalid order payloads", () => {
    expect(centralKitchenIdempotencyKeySchema.safeParse("short").success).toBe(false);
    expect(createCentralKitchenOrderSchema.safeParse({
      requestBranchId: "A",
      centralKitchenId: "A",
      neededDate: "2025-02-29",
      neededTime: "25:00",
      items: [{ productName: "Bread", requestedQuantity: 0, unit: "piece" }],
    }).success).toBe(false);
  });

  it("accepts the external request contract with real date/time values", () => {
    expect(createCentralKitchenOrderSchema.safeParse({
      requestBranchId: "branch-a",
      centralKitchenId: "kitchen",
      neededDate: "2028-02-29",
      neededTime: "09:30",
      idempotencyKey: "request-123",
      items: [{ productName: "Bread", requestedQuantity: 2, unit: "tray" }],
    }).success).toBe(true);
  });

  it("binds idempotent replays to the same transition operation", () => {
    const event = { eventType: "approved", toStatus: "approved" };
    expect(isMatchingCentralKitchenReplay(event, "approved", "approved")).toBe(true);
    expect(isMatchingCentralKitchenReplay(event, "prepared", "prepared")).toBe(false);
  });

  it("binds create idempotency to the complete logical payload", () => {
    const base = createCentralKitchenOrderSchema.parse({
      requestBranchId: "branch-a",
      centralKitchenId: "kitchen",
      neededDate: "2028-02-29",
      neededTime: "09:30",
      items: [{ productName: "Bread", requestedQuantity: 2, unit: "tray" }],
    });
    expect(createCentralKitchenPayloadFingerprint(base))
      .toBe(createCentralKitchenPayloadFingerprint({ ...base }));
    expect(createCentralKitchenPayloadFingerprint(base))
      .not.toBe(createCentralKitchenPayloadFingerprint({ ...base, requestBranchId: "branch-b" }));
  });
});