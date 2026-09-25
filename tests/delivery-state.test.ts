import { describe, expect, it } from "vitest";
import { activeDeliveryStatuses, deliveryTransitionAllowed, receiptMatchesSource } from "../shared/delivery";

describe("delivery orchestration never substitutes for source receipt", () => {
  it("does not allow a driver to finish before receiver approval", () => {
    expect(deliveryTransitionAllowed("assigned", "complete")).toBe(false);
    expect(deliveryTransitionAllowed("in_transit", "complete")).toBe(false);
    expect(deliveryTransitionAllowed("awaiting_receipt", "complete")).toBe(false);
    expect(deliveryTransitionAllowed("receipt_approved", "complete")).toBe(true);
    expect(deliveryTransitionAllowed("completed", "proof")).toBe(false);
    expect(deliveryTransitionAllowed("failed", "reassign")).toBe(true);
  });

  it("requires actual source receipt attributed to the logged-in approver", () => {
    expect(receiptMatchesSource("kitchen", "dispatched", "receiver", "receiver")).toBe(false);
    expect(receiptMatchesSource("kitchen", "received", "receiver", "other")).toBe(false);
    expect(receiptMatchesSource("kitchen", "received", null, "receiver")).toBe(false);
    expect(receiptMatchesSource("kitchen", "received", "receiver", "receiver")).toBe(true);
    expect(receiptMatchesSource("material_transfer", "in_transit", "receiver", "receiver")).toBe(false);
    expect(receiptMatchesSource("material_transfer", "delivered", "receiver", "receiver")).toBe(true);
  });

  it("preserves the single-active-source assignment invariant", () => {
    expect([...activeDeliveryStatuses]).toEqual(["assigned", "in_transit", "awaiting_receipt", "receipt_approved"]);
    expect(activeDeliveryStatuses.includes("completed" as any)).toBe(false);
  });

  it("does not treat driver proof or a cancelled task as a source receipt", () => {
    for (const type of ["finished_goods_transfer", "kitchen_warehouse_shipment"] as const) {
      expect(receiptMatchesSource(type, "in_transit", "recipient", "recipient")).toBe(false);
      expect(receiptMatchesSource(type, "received", null, "recipient")).toBe(false);
      expect(receiptMatchesSource(type, "received", "other", "recipient")).toBe(false);
      expect(receiptMatchesSource(type, "received", "recipient", "recipient")).toBe(true);
    }
    expect(deliveryTransitionAllowed("cancelled", "start")).toBe(false);
    expect(deliveryTransitionAllowed("cancelled", "complete")).toBe(false);
    expect(deliveryTransitionAllowed("cancelled", "reassign")).toBe(true);
    expect(deliveryTransitionAllowed("receipt_approved", "cancel")).toBe(false);
    expect(deliveryTransitionAllowed("completed", "cancel")).toBe(false);
  });
});