import { describe, expect, it } from "vitest";
import {
  centralKitchenRecipeBackedBatchCreateSchema,
  scaleRecipeRequirementExact,
} from "../shared/central-kitchen-batch-materials";

describe("central kitchen batch material quantities", () => {
  it("scales recipe requirements using exact six-decimal arithmetic", () => {
    expect(scaleRecipeRequirementExact("1.250000", "12.000000", "3.000000"))
      .toBe("0.312500");
    expect(scaleRecipeRequirementExact("0.000001", "1.000000", "1.000000"))
      .toBe("0.000001");
  });

  it("rejects a scaled requirement that cannot be represented at six decimals", () => {
    expect(() => scaleRecipeRequirementExact("0.000001", "3.000000", "1.000000"))
      .toThrow("cannot be represented");
  });

  it("requires the actual browser idempotency key for recipe-backed creation", () => {
    expect(centralKitchenRecipeBackedBatchCreateSchema.safeParse({
      quantity: 2,
      productionDate: "2026-04-01",
      recipeBacked: true,
      idempotencyKey: "batch-material-12345678",
    }).success).toBe(true);
    expect(centralKitchenRecipeBackedBatchCreateSchema.safeParse({
      quantity: 2,
      productionDate: "2026-04-01",
      recipeBacked: true,
    }).success).toBe(false);
  });
});