import { describe, expect, it } from "vitest";
import {
  centralKitchenRecipeActionSchema,
  centralKitchenRecipePayloadSchema,
  centralKitchenRecipeRevisionGuardSchema,
  createCentralKitchenRecipeSchema,
  updateCentralKitchenRecipeSchema,
} from "../shared/central-kitchen-recipes";
import { createCentralKitchenRecipePayloadFingerprint } from "../server/central-kitchen-recipes";

const payload = {
  kitchenId: "central-kitchen-a",
  productId: 101,
  outputQuantity: 12,
  outputUnit: "tray",
  notes: "Browser payload, including every optional field",
  ingredients: [
    { warehouseItemId: 201, quantity: 2.5, unit: "kg" },
    { warehouseItemId: 202, quantity: "4.25", unit: "piece" },
  ],
} as const;

describe("central kitchen recipe contract", () => {
  it("accepts the complete browser create payload and normalizes decimal strings", () => {
    const parsed = createCentralKitchenRecipeSchema.parse({
      ...payload,
      idempotencyKey: "recipe-create-12345678",
    });

    expect(parsed).toMatchObject({
      ...payload,
      ingredients: [
        payload.ingredients[0],
        { ...payload.ingredients[1], quantity: 4.25 },
      ],
    });
    expect(parsed.ingredients[1].quantity).toBe(4.25);
  });

  it("rejects zero/negative quantities and malformed decimal values", () => {
    for (const quantity of [0, -1, "0", "-1", "1.1234567", "1e2", "not-a-number"]) {
      expect(
        centralKitchenRecipePayloadSchema.safeParse({
          ...payload,
          ingredients: [{ ...payload.ingredients[0], quantity }],
        }).success,
      ).toBe(false);
    }

    expect(
      centralKitchenRecipePayloadSchema.safeParse({
        ...payload,
        outputQuantity: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate material identities and unknown browser fields", () => {
    expect(
      centralKitchenRecipePayloadSchema.safeParse({
        ...payload,
        ingredients: [
          payload.ingredients[0],
          { ...payload.ingredients[1], warehouseItemId: payload.ingredients[0].warehouseItemId },
        ],
      }).success,
    ).toBe(false);
    expect(
      centralKitchenRecipePayloadSchema.safeParse({
        ...payload,
        unexpected: true,
      }).success,
    ).toBe(false);
  });

  it("requires both revision fields for edits and state-changing actions", () => {
    expect(
      updateCentralKitchenRecipeSchema.safeParse({
        ...payload,
        version: 1,
        updateToken: "revision-token-123456",
      }).success,
    ).toBe(true);
    expect(
      updateCentralKitchenRecipeSchema.safeParse({
        ...payload,
        version: 1,
      }).success,
    ).toBe(false);
    expect(
      centralKitchenRecipeActionSchema.safeParse({
        version: 1,
        updateToken: "revision-token-123456",
      }).success,
    ).toBe(true);
    expect(
      centralKitchenRecipeRevisionGuardSchema.safeParse({
        version: 0,
        updateToken: "revision-token-123456",
      }).success,
    ).toBe(false);
  });

  it("fingerprints the logical recipe independent of ingredient order", () => {
    const first = createCentralKitchenRecipePayloadFingerprint(payload);
    const reordered = createCentralKitchenRecipePayloadFingerprint({
      ...payload,
      ingredients: [...payload.ingredients].reverse(),
    });
    expect(first).toBe(reordered);
    expect(first).not.toBe(
      createCentralKitchenRecipePayloadFingerprint({
        ...payload,
        outputQuantity: 13,
      }),
    );
  });
});