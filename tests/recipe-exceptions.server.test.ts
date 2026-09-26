import { describe, expect, it, vi } from "vitest";
import { centralKitchenLinkedBatchSchema } from "../server/central-kitchen-orders";
import { recipeExceptionDecisionSchema, recipeExceptionRequestSchema } from "../shared/recipe-exceptions";
import { getManualProductionReservedField } from "../shared/manual-production-entry";

vi.mock("../server/db", () => ({ db: {} }));
vi.mock("../server/storage", () => ({ storage: {} }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  canAccessBranch: async () => true,
}));

import { assertApprovedRecipeException, RecipeExceptionError, serializeRecipeException } from "../server/recipe-exceptions";

const binding = {
  exceptionId: 5, orderId: 9, itemId: 10, kitchenId: "central",
  productId: 12, unit: "قطعة", quantity: 3, productionDate: "2026-09-26",
};
const approved = {
  id: 5, order_id: 9, item_id: 10, kitchen_id: "central", product_id: 12,
  unit: "قطعة", quantity: 3, production_date: "2026-09-26",
  status: "approved", reviewed_by: "production-responsible",
};
const txWith = (row: object | null) => ({ execute: vi.fn().mockResolvedValue({ rows: row ? [row] : [] }) });

describe("recipe exception backend contract", () => {
  it("requires explicit recipe mode and a single exception only for nonrecipe batches", () => {
    const core = { quantity: 3, productionDate: binding.productionDate, idempotencyKey: "intent-12345678" };
    expect(centralKitchenLinkedBatchSchema.safeParse(core).success).toBe(false);
    expect(centralKitchenLinkedBatchSchema.safeParse({ ...core, recipeBacked: false }).success).toBe(false);
    expect(centralKitchenLinkedBatchSchema.safeParse({ ...core, recipeBacked: true, recipeExceptionId: 5 }).success).toBe(false);
    expect(centralKitchenLinkedBatchSchema.safeParse({ ...core, recipeBacked: true }).success).toBe(true);
    expect(centralKitchenLinkedBatchSchema.safeParse({ ...core, recipeBacked: false, recipeExceptionId: 5 }).success).toBe(true);
    expect(getManualProductionReservedField({ recipeExceptionId: 5 })).toBe("recipeExceptionId");
    expect(getManualProductionReservedField({ recipe_exception_id: 5 })).toBe("recipe_exception_id");
  });
  it("validates reason and real calendar date on request and decision", () => {
    expect(recipeExceptionRequestSchema.safeParse({ quantity: 3, productionDate: "2026-02-30", reason: "urgent" }).success).toBe(false);
    expect(recipeExceptionRequestSchema.safeParse({ quantity: 3, productionDate: binding.productionDate, reason: " " }).success).toBe(false);
    expect(recipeExceptionDecisionSchema.safeParse({ reason: " " }).success).toBe(false);
  });
  it("locks approval and rejects missing, pending, rejected or already consumed states", async () => {
    for (const row of [null, { ...approved, status: "pending" }, { ...approved, status: "rejected" }, { ...approved, status: "consumed" }, { ...approved, reviewed_by: null }]) {
      await expect(assertApprovedRecipeException(txWith(row), binding)).rejects.toBeInstanceOf(RecipeExceptionError);
    }
    const tx = txWith(approved);
    await expect(assertApprovedRecipeException(tx, binding)).resolves.toBeUndefined();
    expect(tx.execute).toHaveBeenCalledTimes(1);
  });
  it("binds approval to the precise order, item, kitchen, product, unit, quantity and date", async () => {
    const keys = ["order_id", "item_id", "kitchen_id", "product_id", "unit", "quantity", "production_date"] as const;
    for (const key of keys) {
      await expect(assertApprovedRecipeException(txWith({ ...approved, [key]: "different" }), binding))
        .rejects.toBeInstanceOf(RecipeExceptionError);
    }
  });
  it("returns the shared camelCase response contract rather than raw SQL rows", () => {
    expect(serializeRecipeException({
      ...approved, reason: "Need", requested_by: "requester",
      requested_at: new Date("2026-09-26T10:00:00Z"),
      reviewed_at: new Date("2026-09-26T11:00:00Z"),
      review_reason: "Approved", consumed_batch_id: null, consumed_at: null,
    })).toMatchObject({
      orderId: 9, itemId: 10, productId: 12, requestedBy: "requester",
      reviewedBy: "production-responsible", requestedAt: "2026-09-26T10:00:00.000Z",
      consumedBatchId: null,
    });
  });
});