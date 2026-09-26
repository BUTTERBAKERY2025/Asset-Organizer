import { describe, expect, it } from "vitest";
import { validateFinishedProductionTarget } from "../server/finished-production-target";

describe("new finished production targets", () => {
  const carton = { productType: "finish", unit: "علبة", isActive: "false", operationsEnabled: true };
  it("accepts integer counts of the catalog unit even when sale-inactive", () => {
    expect(validateFinishedProductionTarget(carton, 3, "علبة")).toBeNull();
  });
  it("rejects fractional, missing, and unsafe quantities", () => {
    for (const quantity of [0, 0.5, "2.5", undefined, null, Number.MAX_SAFE_INTEGER + 1]) {
      expect(validateFinishedProductionTarget(carton, quantity, "علبة")).not.toBeNull();
    }
  });
  it("does not accept raw identity, guessed units, or an operationally disabled product", () => {
    expect(validateFinishedProductionTarget({ ...carton, productType: "inventory" }, 1, "علبة")).not.toBeNull();
    expect(validateFinishedProductionTarget(carton, 1, "قطعة")).not.toBeNull();
    expect(validateFinishedProductionTarget({ ...carton, unit: null }, 1)).not.toBeNull();
    expect(validateFinishedProductionTarget({ ...carton, operationsEnabled: false }, 1, "علبة")).not.toBeNull();
  });
});