import { describe, expect, it } from "vitest";
import {
  getManualProductionReservedField,
  hasIndependentEntryAcknowledgement,
  isOperationallyLinkedProductionBatch,
  MANUAL_PRODUCTION_RESERVED_FIELDS,
} from "../shared/manual-production-entry";

describe("manual daily-production entry boundary", () => {
  it("rejects every reserved operational field by exact own-property presence", () => {
    for (const field of MANUAL_PRODUCTION_RESERVED_FIELDS) {
      expect(getManualProductionReservedField({ [field]: false })).toBe(field);
      expect(getManualProductionReservedField({ [field]: null })).toBe(field);
    }
  });

  it("does not treat inherited fields as supplied request fields", () => {
    const prototype = { recipeBacked: true };
    const body = Object.create(prototype) as Record<string, unknown>;
    expect(getManualProductionReservedField(body)).toBeUndefined();
  });

  it("requires literal true for the ephemeral independent-entry acknowledgement", () => {
    expect(hasIndependentEntryAcknowledgement({ independentEntryAcknowledged: true })).toBe(true);
    expect(hasIndependentEntryAcknowledgement({ independentEntryAcknowledged: false })).toBe(false);
    expect(hasIndependentEntryAcknowledgement({ independentEntryAcknowledged: "true" })).toBe(false);
    expect(hasIndependentEntryAcknowledgement({ independent_entry_acknowledged: true })).toBe(false);
    expect(hasIndependentEntryAcknowledgement(null)).toBe(false);
  });

  it("protects linked, recipe-backed, and legacy operationally linked batches", () => {
    expect(isOperationallyLinkedProductionBatch({ recipeBacked: true })).toBe(true);
    expect(isOperationallyLinkedProductionBatch({ centralKitchenOrderItemId: 0 })).toBe(true);
    expect(isOperationallyLinkedProductionBatch({ centralKitchenIdempotencyKey: "" })).toBe(true);
    expect(isOperationallyLinkedProductionBatch({ centralKitchenPayloadFingerprint: "" })).toBe(true);
    expect(isOperationallyLinkedProductionBatch({ productionOrderId: 0 })).toBe(true);
    expect(isOperationallyLinkedProductionBatch({ recipeBacked: false })).toBe(false);
    expect(isOperationallyLinkedProductionBatch({ centralKitchenOrderItemId: null })).toBe(false);
  });
});