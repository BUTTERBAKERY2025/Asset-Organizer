import { describe, expect, it } from "vitest";
import { activeReplacementCommitment, availableDemandAllocation, calculateDemandRemaining, cappedCompensationReceipt, demandDecimal, demandMicros, validateReceiptAttribution } from "../shared/central-kitchen-demand";
import { centralKitchenRequestChangeBlock } from "../server/central-kitchen-orders";
import { centralKitchenDemandActionSchema } from "../server/central-kitchen-demand-routes";

describe("central kitchen unmet demand accounting", () => {
  it("preserves exact six-decimal quantities", () => {
    expect(demandDecimal(demandMicros("0.123456"))).toBe("0.123456");
    expect(() => demandMicros("0.1234567")).toThrow();
  });

  it("does not inflate source demand with compensation orders", () => {
    expect(calculateDemandRemaining({
      requested: "10.5",
      originalGoodReceived: "4.25",
      acceptedSubstitute: "1.25",
      compensationGoodReceived: "2.5",
      waived: "0",
    })).toBe("2.5");
  });

  it("keeps administrative waiver distinct while preventing negative remaining", () => {
    expect(calculateDemandRemaining({
      requested: "1",
      originalGoodReceived: "0.4",
      acceptedSubstitute: "0",
      compensationGoodReceived: "0",
      waived: "0.6",
    })).toBe("0");
  });

  it("credits a linked replacement only up to its allocation and actual receipt", () => {
    expect(cappedCompensationReceipt("2.5", "9")).toBe("2.5");
    expect(cappedCompensationReceipt("2.5", "1.25")).toBe("1.25");
  });

  it("releases cancelled allocations and leaves a partial received residual replannable", () => {
    expect(activeReplacementCommitment({ allocated: "4", actuallyReceived: "0", status: "cancelled" })).toBe("0");
    expect(activeReplacementCommitment({ allocated: "4", actuallyReceived: "1.5", status: "received" })).toBe("1.5");
    expect(activeReplacementCommitment({ allocated: "4", actuallyReceived: "0", status: "dispatched" })).toBe("4");
  });

  it("requires explicit receipt components to equal combined good receipt", () => {
    expect(validateReceiptAttribution({ totalGoodReceived: "7", requested: "10", preparedSubstitute: "3", originalGood: "5", substituteGood: "2" })).toBe(true);
    expect(validateReceiptAttribution({ totalGoodReceived: "7", requested: "10", preparedSubstitute: "3", originalGood: "4", substituteGood: "2" })).toBe(false);
    expect(validateReceiptAttribution({ totalGoodReceived: "7", requested: "10", preparedSubstitute: "1", originalGood: "5", substituteGood: "2" })).toBe(false);
  });

  it("rejects over-allocation mathematically without cross-item leakage", () => {
    expect(availableDemandAllocation({ requested: "8.5", originalGoodReceived: "3", activeAllocated: "2.25" })).toBe("3.25");
    expect(availableDemandAllocation({ requested: "2", originalGoodReceived: "2", activeAllocated: "0" })).toBe("0");
    expect(availableDemandAllocation({ requested: "9", originalGoodReceived: "1", activeAllocated: "9" })).toBe("0");
  });

  it("relies on the existing lifecycle gate that forbids cancelling a received order", () => {
    expect(centralKitchenRequestChangeBlock("received", false, false)).toContain("الإلغاء قبل");
    expect(centralKitchenRequestChangeBlock("approved", false, false)).toBeNull();
  });

  it("requires explicit branch acknowledgement and a documented reason for consent decisions", () => {
    const base = { quantity: "1", reason: "سبب موثق", idempotencyKey: "12345678" };
    expect(centralKitchenDemandActionSchema.safeParse({ ...base, type: "waive" }).success).toBe(false);
    expect(centralKitchenDemandActionSchema.safeParse({ ...base, type: "waive", acknowledged: true }).success).toBe(true);
    expect(centralKitchenDemandActionSchema.safeParse({ ...base, type: "accept_substitute", acknowledged: true, reason: "لا" }).success).toBe(false);
  });
});