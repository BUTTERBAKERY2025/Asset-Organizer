import { describe, expect, it } from "vitest";
import {
  buildFulfillmentFields,
  getInitialMixedFulfillment,
  getPrepareFulfillmentMode,
  getSavedPreparationSource,
  parseProductionFulfillmentReadiness,
  validateMixedFulfillmentQuantities,
} from "../client/src/components/central-kitchen/prepare-fulfillment-model";

describe("central-kitchen mixed preparation UI model", () => {
  it("classifies only real catalog products as mixed", () => {
    const product = { productId: 7, warehouseItemId: null };
    expect(getPrepareFulfillmentMode(product, "real")).toBe("mixed");
    expect(getPrepareFulfillmentMode(product, "shadow")).toBe("legacy");
    expect(getPrepareFulfillmentMode(product, "unknown")).toBe("legacy");
    expect(getPrepareFulfillmentMode({ productId: null, warehouseItemId: 7 }, "real")).toBe("legacy");
    expect(getPrepareFulfillmentMode({ productId: null, warehouseItemId: null }, "real")).toBe("legacy");
  });

  it("starts old preparedQuantity edits stock-first without treating saved null fields as proof", () => {
    expect(getInitialMixedFulfillment({
      productId: 7,
      requestedQuantity: 10,
      preparedQuantity: 6,
      preparedFromStock: null,
      preparedFromProduction: null,
    })).toEqual({ stock: "6", production: "0" });
    expect(getInitialMixedFulfillment({
      productId: 7,
      requestedQuantity: 10,
      preparedQuantity: 10,
      preparedFromStock: 4,
      preparedFromProduction: 6,
    })).toEqual({ stock: "4", production: "6" });
    expect(getInitialMixedFulfillment({
      productId: 7,
      requestedQuantity: 10,
      preparedQuantity: null,
      preparedFromStock: null,
      preparedFromProduction: null,
    })).toEqual({ stock: "10", production: "0" });
    expect(getSavedPreparationSource({
      productId: 7,
      requestedQuantity: 10,
      preparedQuantity: 6,
      preparedFromStock: null,
      preparedFromProduction: null,
    }).kind).toBe("unrecorded");
  });

  it("allows a mixed stock/production total up to requested quantity", () => {
    const result = validateMixedFulfillmentQuantities({
      requestedQuantity: 10,
      stockQuantity: "6",
      productionQuantity: "4",
      readiness: { status: "ready", eligibleQuantity: 5 },
    });
    expect(result.error).toBeNull();
    expect(result.totalPrepared).toBe(10);
    expect(buildFulfillmentFields("mixed", result.stockQuantity, result.productionQuantity))
      .toEqual({ preparedFromStock: 6, preparedFromProduction: 4 });
    expect(buildFulfillmentFields("legacy", 10, 0)).toEqual({});
  });

  it("rejects source totals above the request and production above verified eligibility", () => {
    expect(validateMixedFulfillmentQuantities({
      requestedQuantity: 10,
      stockQuantity: "6",
      productionQuantity: "5",
      readiness: { status: "ready", eligibleQuantity: 5 },
    }).error).toContain("يتجاوز");
    expect(validateMixedFulfillmentQuantities({
      requestedQuantity: 10,
      stockQuantity: "5",
      productionQuantity: "5",
      readiness: { status: "ready", eligibleQuantity: 4 },
    }).error).toContain("المؤهلة");
  });

  it("matches finished-product reservations by rejecting fractional source quantities", () => {
    expect(validateMixedFulfillmentQuantities({
      requestedQuantity: 10,
      stockQuantity: "5.5",
      productionQuantity: "0.5",
      readiness: { status: "ready", eligibleQuantity: 2 },
    }).error).toContain("صحيحة");
  });

  it("never treats loading or error readiness as eligible zero", () => {
    expect(validateMixedFulfillmentQuantities({
      requestedQuantity: 10,
      stockQuantity: "8",
      productionQuantity: "2",
      readiness: { status: "loading" },
    }).error).toContain("انتظر");
    expect(validateMixedFulfillmentQuantities({
      requestedQuantity: 10,
      stockQuantity: "8",
      productionQuantity: "2",
      readiness: { status: "error" },
    }).error).toContain("دليل");
    expect(validateMixedFulfillmentQuantities({
      requestedQuantity: 10,
      stockQuantity: "10",
      productionQuantity: "0",
      readiness: { status: "error" },
    }).error).toBeNull();
  });

  it("requires an explicit valid readiness response and preserves explicit proof labels", () => {
    expect(() => parseProductionFulfillmentReadiness({ eligibleQuantity: 3 })).toThrow();
    expect(() => parseProductionFulfillmentReadiness({
      eligibleQuantity: 3,
      batches: [{ batchId: 0, quantity: 3 }],
    })).toThrow();
    expect(parseProductionFulfillmentReadiness({
      eligibleQuantity: 3,
      batches: [{ batchId: 12, quantity: 3 }],
    }).batches).toEqual([{ batchId: 12, quantity: 3 }]);
    expect(getSavedPreparationSource({
      requestedQuantity: 10,
      preparedFromStock: 7,
      preparedFromProduction: 3,
      productionFulfillmentEvidence: {
        frozenProofBatchIds: [12],
        frozenProofBatchLabels: ["دفعة مكتملة"],
        orderId: 999999,
      },
    })).toMatchObject({
      kind: "split",
      proofBatchIds: ["12"],
      proofLabels: ["دفعة مكتملة"],
    });
  });
});