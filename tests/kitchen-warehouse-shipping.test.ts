import { describe, expect, it } from "vitest";
import { shippingCreate, shippingAction, allocateReceivedLots } from "../shared/kitchen-warehouse-shipping";

describe("kitchen to managed warehouse shipment contracts", () => {
  it("rejects fractional product pieces and bad receipt quantities", () => {
    expect(shippingCreate.safeParse({stockId:1,warehouseId:2,quantity:0.5,idempotencyKey:"test-key-123"}).success).toBe(false);
    expect(shippingAction.safeParse({receivedQuantity:1.5,idempotencyKey:"test-key-123"}).success).toBe(false);
  });
  it("attributes partial receipt to real original production lots only", () => {
    expect(allocateReceivedLots([
      {productionDate:"2024-01-01",quantity:2},
      {productionDate:"2024-01-02",quantity:3},
    ],4)).toEqual([
      {productionDate:"2024-01-01",quantity:2,credited:2},
      {productionDate:"2024-01-02",quantity:3,credited:2},
    ]);
    expect(() => allocateReceivedLots([{quantity:2}],3)).toThrow();
  });
});