import { describe, expect, it } from "vitest";
import { getFinishReadiness } from "../client/src/components/central-kitchen/finish-readiness";
import type { CentralKitchenMaterialRequirementsContract } from "../shared/central-kitchen-batch-materials";

const recipeData = (shortageQuantity = "0.000000"): CentralKitchenMaterialRequirementsContract => ({
  kitchenId: "kitchen",
  productId: 7,
  batchQuantity: "1.000000",
  recipeBacked: true,
  recipe: {
    recipeId: 10,
    recipeVersion: 2,
    source: "approved_recipe",
    outputQuantity: "4.000000",
    outputUnit: "tray",
  },
  requirements: [{
    warehouseItemId: 11,
    materialName: "Flour",
    unit: "kg",
    recipeQuantity: "2.000000",
    requiredQuantity: "0.500000",
    currentQuantity: shortageQuantity === "0.000000" ? "0.500000" : "0.499999",
    reservedQuantity: "0.000000",
    availableQuantity: shortageQuantity === "0.000000" ? "0.500000" : "0.499999",
    shortageQuantity,
  }],
  materialConsumptionStatus: "pending",
});

describe("central kitchen finish readiness", () => {
  it("does not permit finishing while requirements are loading", () => {
    expect(getFinishReadiness({
      isLoading: true,
      isFetching: true,
      isError: false,
    })).toMatchObject({ kind: "loading", canFinish: false });
  });

  it("keeps a requirements fetch error blocked", () => {
    expect(getFinishReadiness({
      isLoading: false,
      isError: true,
      error: new Error("Failed to fetch"),
    })).toMatchObject({ kind: "error", canFinish: false });
  });

  it("blocks even a six-decimal shortage without floating-point rounding", () => {
    expect(getFinishReadiness({
      data: recipeData("0.000001"),
      isLoading: false,
      isError: false,
    })).toMatchObject({ kind: "shortage", canFinish: false });
  });

  it("allows a historical non-recipe batch without inventing material consumption", () => {
    expect(getFinishReadiness({
      data: {
        kitchenId: "kitchen",
        productId: 7,
        batchQuantity: "1.000000",
        recipeBacked: false,
        recipe: null,
        requirements: [],
        materialConsumptionStatus: "not_applicable",
      },
      isLoading: false,
      isError: false,
    })).toMatchObject({ kind: "legacy", canFinish: true });
  });

  it("blocks a recipe batch whose materials were already consumed", () => {
    expect(getFinishReadiness({
      data: { ...recipeData(), materialConsumptionStatus: "consumed" },
      isLoading: false,
      isError: false,
    })).toMatchObject({ kind: "already_consumed", canFinish: false });
  });
});
