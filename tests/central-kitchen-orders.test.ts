import { describe, expect, it } from "vitest";
import {
  canTransitionCentralKitchenOrder,
  centralKitchenIdempotencyKeySchema,
  centralKitchenPreparationSchema,
  centralKitchenDispatchSchema,
  centralKitchenReceiveSchema,
  createCentralKitchenOrderSchema,
  createCentralKitchenPayloadFingerprint,
  createCentralKitchenTransitionFingerprint,
  validateCentralKitchenPreparation,
  validateCentralKitchenDispatch,
  validateCentralKitchenReceipt,
  buildCentralKitchenShadowAllocations,
  calculateCentralKitchenPilotMetrics,
  centralKitchenSaudiWindow,
  isMatchingCentralKitchenReplay,
} from "../server/central-kitchen-orders";
import { parseCentralKitchenCatalogV2 } from "../shared/central-kitchen-catalog";

describe("central kitchen workflow rules", () => {
  it("accepts only the explicit v2 catalog identity contract", () => {
    expect(parseCentralKitchenCatalogV2({
      schemaVersion: 2,
      items: [
        { id: 7, source: "product", name: "Bread", unit: "tray" },
        { id: 7, source: "warehouse", name: "Flour", unit: "kg", sku: "WH-7" },
      ],
    }).items).toHaveLength(2);
    for (const invalid of [
      { schemaVersion: 1, items: [] },
      { schemaVersion: 2, items: [{ id: 7, name: "Bread", unit: "tray" }] },
      { schemaVersion: 2, items: [{ id: 0, source: "product", name: "Bread", unit: "tray" }] },
      { schemaVersion: 2, items: [{ id: "7", source: "product", name: "Bread", unit: "tray" }] },
      { schemaVersion: 2, items: [{ id: 7, source: "legacy", name: "Bread", unit: "tray" }] },
    ]) {
      expect(() => parseCentralKitchenCatalogV2(invalid)).toThrow("أعد تحميل الصفحة");
    }
  });

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

  it("accepts product, warehouse, and explicit legacy/manual identities but never mixed identities", () => {
    const base = {
      requestBranchId: "branch-a",
      centralKitchenId: "kitchen",
    };
    expect(createCentralKitchenOrderSchema.safeParse({
      ...base,
      items: [{ productId: 7, productName: "Bread", requestedQuantity: 2, unit: "tray" }],
    }).success).toBe(true);
    expect(createCentralKitchenOrderSchema.safeParse({
      ...base,
      items: [{ warehouseItemId: 7, productName: "Flour", requestedQuantity: 2, unit: "kg" }],
    }).success).toBe(true);
    expect(createCentralKitchenOrderSchema.safeParse({
      ...base,
      items: [{ productName: "Manual line", requestedQuantity: 2, unit: "tray" }],
    }).success).toBe(true);
    expect(createCentralKitchenOrderSchema.safeParse({
      ...base,
      items: [{ productId: 7, warehouseItemId: 7, productName: "Collision", requestedQuantity: 2, unit: "tray" }],
    }).success).toBe(false);
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
    // This is the pre-catalog-linkage canonical hash: absent new keys must not
    // invalidate idempotent retries of orders created before migration 028.
    expect(createCentralKitchenPayloadFingerprint(base))
      .toBe("ef0e8612894e9f82df08391f6f92070884ebc47196f5fb09b067ca3b18bcd63b");
  });

  it("keeps colliding numeric IDs distinct in new catalog fingerprints", () => {
    const common = {
      requestBranchId: "branch-a",
      centralKitchenId: "kitchen",
      items: [{ productName: "Catalog item", requestedQuantity: 2, unit: "tray" }],
    };
    const product = createCentralKitchenOrderSchema.parse({
      ...common,
      items: [{ ...common.items[0], productId: 42 }],
    });
    const warehouse = createCentralKitchenOrderSchema.parse({
      ...common,
      items: [{ ...common.items[0], warehouseItemId: 42 }],
    });
    expect(createCentralKitchenPayloadFingerprint(product))
      .not.toBe(createCentralKitchenPayloadFingerprint(warehouse));
  });

  it("requires complete, non-excessive preparation details", () => {
    const prepared = centralKitchenPreparationSchema.parse({
      idempotencyKey: "prepare-123",
      items: [
        {
          itemId: 1,
          preparedQuantity: 6,
          substituteQuantity: 2,
          substituteProductName: "Alternative bread",
          substituteUnit: "tray",
          shortageReason: "out_of_stock",
        },
      ],
    });
    expect(validateCentralKitchenPreparation(
      [{ id: 1, requestedQuantity: 10, unit: "tray" }],
      prepared.items,
    )).toBeNull();
    expect(validateCentralKitchenPreparation(
      [{ id: 1, requestedQuantity: 7, unit: "tray" }],
      prepared.items,
    )).toContain("تتجاوز");
    expect(validateCentralKitchenPreparation(
      [{ id: 1, requestedQuantity: 10, unit: "tray" }, { id: 2, requestedQuantity: 1, unit: "tray" }],
      prepared.items,
    )).toContain("جميع");
  });

  it("requires substitute identity when a substitute quantity is prepared", () => {
    expect(centralKitchenPreparationSchema.safeParse({
      items: [{ itemId: 1, preparedQuantity: 0, substituteQuantity: 2 }],
    }).success).toBe(false);
    expect(centralKitchenPreparationSchema.safeParse({
      items: [{
        itemId: 1,
        preparedQuantity: 0,
        substituteQuantity: 2,
        substituteProductId: 5,
        substituteWarehouseItemId: 5,
        substituteProductName: "Mixed identity",
        substituteUnit: "tray",
      }],
    }).success).toBe(false);
  });

  it("accounts a warehouse substitute in the original order unit", () => {
    const prepared = centralKitchenPreparationSchema.parse({
      items: [{
        itemId: 1,
        preparedQuantity: 0,
        substituteQuantity: 2,
        substituteWarehouseItemId: 8,
        substituteProductName: "Warehouse substitute",
        substituteUnit: "tray",
      }],
    });
    expect(validateCentralKitchenPreparation(
      [{ id: 1, requestedQuantity: 2, unit: "tray" }],
      prepared.items,
    )).toBeNull();
    expect(validateCentralKitchenPreparation(
      [{ id: 1, requestedQuantity: 2, unit: "piece" }],
      prepared.items,
    )).toContain("نفس وحدة");
  });

  it("binds transition replay to logical payload, not key location or item order", () => {
    const first = centralKitchenPreparationSchema.parse({
      idempotencyKey: "prepare-key-1",
      items: [
        { itemId: 2, preparedQuantity: 3, substituteQuantity: 0 },
        { itemId: 1, preparedQuantity: 4, substituteQuantity: 0 },
      ],
    });
    const retry = centralKitchenPreparationSchema.parse({
      idempotencyKey: "prepare-key-2",
      notes: null,
      items: [...first.items].reverse(),
    });
    expect(createCentralKitchenTransitionFingerprint("prepared", first))
      .toBe(createCentralKitchenTransitionFingerprint("prepared", retry));
    expect(createCentralKitchenTransitionFingerprint("prepared", first))
      .not.toBe(createCentralKitchenTransitionFingerprint("dispatched", retry));
  });

  it("includes warehouse substitute identity in new preparation fingerprints", () => {
    const productSubstitute = centralKitchenPreparationSchema.parse({
      items: [{
        itemId: 1, preparedQuantity: 0, substituteQuantity: 2,
        substituteProductId: 9, substituteProductName: "Alternative", substituteUnit: "tray",
      }],
    });
    const warehouseSubstitute = centralKitchenPreparationSchema.parse({
      items: [{
        itemId: 1, preparedQuantity: 0, substituteQuantity: 2,
        substituteWarehouseItemId: 9, substituteProductName: "Alternative", substituteUnit: "tray",
      }],
    });
    expect(createCentralKitchenTransitionFingerprint("prepared", productSubstitute))
      .not.toBe(createCentralKitchenTransitionFingerprint("prepared", warehouseSubstitute));
  });

  it("prevents dispatching more than was prepared", () => {
    const payload = centralKitchenDispatchSchema.parse({
      driverName: "Driver",
      vehicleNumber: "ABC-123",
      items: [{ itemId: 1, dispatchedQuantity: 9 }],
    });
    expect(validateCentralKitchenDispatch(
      [{ id: 1, preparedQuantity: 6, substituteQuantity: 2 }],
      payload.items,
    )).toContain("تتجاوز");
  });

  it("derives receipt discrepancies and requires notes", () => {
    const complete = centralKitchenReceiveSchema.parse({
      items: [{ itemId: 1, receivedQuantity: 8, damagedQuantity: 0 }],
    });
    expect(validateCentralKitchenReceipt(
      [{ id: 1, dispatchedQuantity: 8 }],
      complete.items,
    )).toEqual({ error: null, hasDiscrepancy: false });
    const damagedWithoutNote = centralKitchenReceiveSchema.parse({
      items: [{ itemId: 1, receivedQuantity: 7, damagedQuantity: 1 }],
    });
    expect(validateCentralKitchenReceipt(
      [{ id: 1, dispatchedQuantity: 8 }],
      damagedWithoutNote.items,
    ).error).toContain("ملاحظة");
  });

  it("projects original and substitute quantities without touching balances", () => {
    const item = {
      productId: null, warehouseItemId: 10, productName: "Original", unit: "tray",
      preparedQuantity: 6, substituteQuantity: 2,
      substituteProductId: 11, substituteWarehouseItemId: null,
      substituteProductName: "Substitute", substituteUnit: "tray",
      dispatchedQuantity: 8, receivedQuantity: 7,
    };
    expect(buildCentralKitchenShadowAllocations("projected_kitchen_out", item))
      .toEqual([
        {
          component: "original", productId: null, warehouseItemId: 10,
          productName: "Original", unit: "tray", quantity: 6,
        },
        {
          component: "substitute", productId: 11, warehouseItemId: null,
          productName: "Substitute", unit: "tray", quantity: 2,
        },
      ]);
    expect(buildCentralKitchenShadowAllocations("projected_branch_in", item).map(row => row.quantity))
      .toEqual([6, 1]);
  });

  it("calculates pilot fulfillment, discrepancies, overdue orders, and stage time", () => {
    const metrics = calculateCentralKitchenPilotMetrics([
      {
        id: 1, status: "received", neededDate: "2026-09-08", discrepancyStatus: "resolved",
        createdAt: "2026-09-08T08:00:00Z", approvedAt: "2026-09-08T09:00:00Z",
        preparedAt: "2026-09-08T11:00:00Z", dispatchedAt: "2026-09-08T12:00:00Z",
        receivedAt: "2026-09-08T13:00:00Z",
      },
      {
        id: 2, status: "approved", neededDate: "2026-09-01", discrepancyStatus: "none",
        createdAt: "2026-09-01T08:00:00Z", approvedAt: "2026-09-01T09:00:00Z",
        preparedAt: null, dispatchedAt: null, receivedAt: null,
      },
    ], [
      { orderId: 1, dispatchedQuantity: 10, receivedQuantity: 8, damagedQuantity: 1, missingQuantity: 1 },
    ], [
      { direction: "projected_kitchen_out", quantity: 10, unit: "tray" },
      { direction: "projected_branch_in", quantity: 8, unit: "tray" },
    ], "2026-09-09");
    expect(metrics.fulfillmentRate).toBe(80);
    expect(metrics.discrepancyRate).toBe(100);
    expect(metrics.overdueOrders).toBe(1);
    expect(metrics.averageStageHours.approval).toBe(1);
    expect(metrics.shadowLedger.entryCount).toBe(2);
    expect(metrics.shadowLedger.byUnit).toEqual([
      { direction: "projected_kitchen_out", unit: "tray", quantity: 10 },
      { direction: "projected_branch_in", unit: "tray", quantity: 8 },
    ]);
  });

  it("uses complete Saudi calendar days and excludes future rows", () => {
    const window = centralKitchenSaudiWindow(7, new Date("2026-09-09T20:00:00Z"));
    expect(window.start.toISOString()).toBe("2026-09-02T21:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-09-09T21:00:00.000Z");
  });
});