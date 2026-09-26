import { describe, expect, it } from "vitest";
import type { RecipeException } from "@shared/recipe-exceptions";
import { exceptionDecisionPayload, exceptionRequestPayload, linkedBatchPayload, matchingApprovedException, normalizeException, type ExceptionBinding } from "../client/src/components/central-kitchen/recipe-exception-flow";

const binding: ExceptionBinding = { orderId: 21, itemId: 41, kitchenId: "kitchen-1", productId: 12, unit: "قطعة", quantity: 7, productionDate: "2026-09-26" };
const approved: RecipeException = {
  id: 88, ...binding, reason: "تعذر إعداد الوصفة", requestedBy: "requester", requestedAt: "2026-09-26T08:00:00Z",
  status: "approved", reviewedBy: "reviewer", reviewedAt: "2026-09-26T08:30:00Z", reviewReason: "ضرورة تشغيلية",
  consumedBatchId: null, consumedAt: null,
};

describe("request-linked recipe exception flow", () => {
  it("sends only the exact request and decision contract fields", () => {
    expect(exceptionRequestPayload(binding, "  حاجة عاجلة ")).toEqual({ quantity: 7, productionDate: binding.productionDate, reason: "حاجة عاجلة" });
    expect(exceptionDecisionPayload("  مناسب ")).toEqual({ reason: "مناسب" });
    expect(() => exceptionRequestPayload({ ...binding, productionDate: "2026-02-31" }, "سبب")).toThrow();
    expect(() => exceptionDecisionPayload("   ")).toThrow();
  });
  it("normalizes backend rows before evaluating approval and one-use status", () => {
    const normalized = normalizeException({
      id: 88, order_id: 21, item_id: 41, kitchen_id: "kitchen-1", product_id: 12,
      unit: "قطعة", quantity: "7", production_date: "2026-09-26", reason: "حاجة",
      requested_by: "requester", requested_at: "2026-09-26T08:00:00Z",
      status: "approved", reviewed_by: "reviewer", reviewed_at: "2026-09-26T08:30:00Z",
      review_reason: "ضرورة", consumed_batch_id: null, consumed_at: null,
    });
    expect(matchingApprovedException([normalized], binding)?.id).toBe(88);
    expect(matchingApprovedException([{ ...normalized, reviewedBy: null }], binding)).toBeUndefined();
  });
  it("creates a normal recipe-backed batch without an exception ID", () => {
    expect(linkedBatchPayload(binding, true, [], "intent-1")).toEqual({
      quantity: 7, productionDate: binding.productionDate, recipeBacked: true, idempotencyKey: "intent-1",
    });
  });
  it("preserves explicit nulls in the camelCase API response and enables its exact approval", () => {
    const response = JSON.parse(JSON.stringify({ exceptions: [approved], canApprove: true }));
    const normalized = normalizeException(response.exceptions[0]);
    expect(normalized.consumedBatchId).toBeNull();
    expect(normalized.consumedAt).toBeNull();
    expect(normalizeException(normalized as unknown as Record<string, unknown>)).toEqual(normalized);
    expect(matchingApprovedException([normalized], binding)?.id).toBe(88);
    expect(linkedBatchPayload(binding, false, [normalized], "api-intent")).toMatchObject({
      recipeBacked: false, recipeExceptionId: 88,
    });
  });
  it("does not fall back from explicit camelCase nulls or assume a missing consumption field is unused", () => {
    const normalized = normalizeException({
      ...approved, consumed_batch_id: 999, reviewedBy: null, reviewed_by: "stale-reviewer",
    });
    expect(normalized.consumedBatchId).toBeNull();
    expect(normalized.reviewedBy).toBeNull();
    expect(matchingApprovedException([normalized], binding)).toBeUndefined();
    const { consumedBatchId, ...incomplete } = approved;
    expect(matchingApprovedException([normalizeException(incomplete)], binding)).toBeUndefined();
    const used = normalizeException({ ...approved, consumedBatchId: 999 });
    expect(matchingApprovedException([used], binding)).toBeUndefined();
  });
  it("uses only an exact approved, unconsumed exception, bound to the request item and unit", () => {
    expect(linkedBatchPayload(binding, false, [approved], "intent-2")).toEqual({
      quantity: 7, productionDate: binding.productionDate, recipeBacked: false, recipeExceptionId: 88, idempotencyKey: "intent-2",
    });
    for (const key of ["orderId", "itemId", "kitchenId", "productId", "unit", "quantity", "productionDate"] as const) {
      const other = { ...binding, [key]: key === "unit" || key === "kitchenId" || key === "productionDate" ? "different" : 999 };
      expect(matchingApprovedException([approved], other)).toBeUndefined();
      expect(() => linkedBatchPayload(other, false, [approved], "intent-2")).toThrow("لا يوجد استثناء معتمد");
    }
  });
  it("blocks pending, rejected and already consumed exceptions (never silently bypasses approval)", () => {
    for (const state of ["pending", "rejected", "consumed"] as const) {
      expect(() => linkedBatchPayload(binding, false, [{ ...approved, status: state }], "intent-3")).toThrow("لا يوجد استثناء معتمد");
    }
    expect(() => linkedBatchPayload(binding, false, [{ ...approved, consumedBatchId: 123 }], "intent-3")).toThrow("لا يوجد استثناء معتمد");
    expect(() => linkedBatchPayload(binding, false, [], "intent-3")).toThrow("لا يوجد استثناء معتمد");
  });
  it("rejects invalid quantities before any payload is sent", () => {
    expect(() => linkedBatchPayload({ ...binding, quantity: 0 }, false, [approved], "key")).toThrow();
    expect(() => linkedBatchPayload({ ...binding, quantity: 1.5 }, true, [], "key")).toThrow();
  });
});