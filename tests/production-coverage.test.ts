import { describe, expect, it } from "vitest";
import { micros, simulateProductionCoverage } from "../server/production-coverage";

const source = (quantity = "10", reserved = "0", unit = "piece") => ({
  key: "product:1", kind: "product", catalogId: 7, unit, kitchen: "k", quantity, reserved,
});
const demand = (id: number, requested = "8", date = "2026-01-01") => ({
  id, orderId: id, date, mode: "real", status: "approved",
  productId: 7, warehouseId: null, unit: "piece", substitute: false,
  requested, prepared: null, progress: 0n, reason: null,
});
const reservation = (itemId: number, quantity: string, component = "original") => ({
  itemId, orderId: itemId, key: "product:1", kind: "product", catalogId: 7,
  unit: "piece", kitchen: "k", component, status: "reserved", quantity,
});

describe("read-only unified production coverage simulation", () => {
  it("does not hide a ledger mismatch behind competing-demand uncertainty for a prepared reservation", () => {
    const result = simulateProductionCoverage([
      { ...demand(1), status: "prepared", prepared: "2" },
      { ...demand(2), substitute: true },
    ], [source("10", "3")], [reservation(1, "2")]);
    expect(result.get(1)?.status).toBe("unknown");
    expect(result.get(1)?.persistedReserved).toBeNull();
  });
  it("allocates one free balance in stable date/order/item order, including invisible future orders", () => {
    const entries = [demand(2), demand(1, "8", "2025-12-31"), demand(3, "4", "2027-01-01")];
    const calculate = () => simulateProductionCoverage(entries, [source()], []);
    expect(calculate().get(1)?.proposedFreeStock).toBe(8);
    expect(calculate().get(2)?.proposedFreeStock).toBe(2);
    expect(calculate().get(3)?.proposedFreeStock).toBe(0);
    expect(calculate()).toEqual(calculate());
    expect(source().quantity).toBe("10");
  });
  it("reconciles reservations from outside the visible cohort and never counts them as free", () => {
    const result = simulateProductionCoverage([demand(1)], [source("10", "4")], [reservation(99, "4")]);
    expect(result.get(1)?.proposedFreeStock).toBe(6);
    expect(result.get(1)?.remainingProductionNeed).toBe(2);
  });
  it("counts own reservation separately from free and caps linked unfinished work as prospective", () => {
    const result = simulateProductionCoverage([{ ...demand(1), progress: micros("6")! }],
      [source("5", "2")], [reservation(1, "2")]);
    expect(result.get(1)).toMatchObject({
      persistedReserved: 2, proposedFreeStock: 3, prospectiveInProgress: 3,
      remainingProductionNeed: 0, inProgressGuaranteed: false,
    });
  });
  it("does not add completed batches to the already posted stock pool", () => {
    expect(simulateProductionCoverage([demand(1)], [source("3")], []).get(1)?.remainingProductionNeed).toBe(5);
    expect(simulateProductionCoverage([demand(1)], [source("0")], []).get(1)?.remainingProductionNeed).toBe(8);
  });
  it("returns unknown rather than partial results for truncated or inconsistent sources", () => {
    expect(simulateProductionCoverage([demand(1)], [source()], [], false).get(1)?.reason).toBe("candidate_pool_truncated");
    expect(simulateProductionCoverage([demand(1)], [source("10", "2")], []).get(1)?.status).toBe("unknown");
    expect(simulateProductionCoverage([demand(1)], [source("bad")], []).get(1)?.status).toBe("unknown");
    expect(simulateProductionCoverage([demand(1)], [source("10", "2")],
      [{ ...reservation(1, "2"), unit: "other" }]).get(1)?.status).toBe("unknown");
    expect(simulateProductionCoverage([{ ...demand(1), requested: "broken" }, demand(2)],
      [source()], []).get(2)?.status).toBe("unknown");
  });
  it("keeps shadow, legacy, substitute, receipt and unit ambiguity out of calculated demand", () => {
    const entries = [
      { ...demand(1), mode: "shadow" },
      { ...demand(2), mode: null },
      { ...demand(3), substitute: true },
      { ...demand(4), status: "received" },
      { ...demand(5), unit: "kg" },
    ];
    const result = simulateProductionCoverage(entries, [source()], []);
    expect(result.get(1)?.status).toBe("not_applicable");
    expect(result.get(2)?.status).toBe("unknown");
    expect(result.get(3)?.status).toBe("unknown");
    expect(result.get(4)?.status).toBe("not_applicable");
    expect(result.get(5)?.status).toBe("unknown");
    expect(micros("0.000001")).toBe(1n);
    expect(micros("1.0000001")).toBeNull();
  });
  it("attributes prepared reservations as evidence without claiming free stock or subtracting them twice", () => {
    const prepared = { ...demand(1), status: "prepared", prepared: "4" };
    const result = simulateProductionCoverage([prepared, demand(2)], [source("10", "4")], [reservation(1, "4")]);
    expect(result.get(1)).toMatchObject({
      status: "not_applicable", reason: "request_already_prepared", persistedReserved: 4,
      proposedFreeStock: null, remainingProductionNeed: null,
    });
    expect(result.get(2)).toMatchObject({ status: "calculated", proposedFreeStock: 6, remainingProductionNeed: 2 });
    const anomalous = simulateProductionCoverage([{ ...demand(1), prepared: "4" }, demand(2)],
      [source("10", "4")], [reservation(1, "4")]);
    expect(anomalous.get(2)?.status).toBe("unknown");
  });
  it("reconciles every allocation residual and rejects incoherent partial release", () => {
    const settled = { ...reservation(99, "5"), dispatched: "3", released: "2", status: "dispatched" };
    expect(simulateProductionCoverage([demand(1)], [source()], [settled]).get(1)?.status).toBe("calculated");
    const partial = { ...reservation(99, "5"), dispatched: "0", released: "2", status: "reserved" };
    expect(simulateProductionCoverage([demand(1)], [source("10", "3")], [partial]).get(1)?.status).toBe("unknown");
  });
  it("poisons identifiable pools for earlier uncertain substitutes, replacements, and missing units", () => {
    const variants = [
      { ...demand(1), substitute: true },
      { ...demand(1), productId: 7, warehouseId: 3 },
      { ...demand(1), unit: "" },
      { ...demand(1), substitute: true, substituteProductId: 7, productId: 8 },
    ];
    for (const earlier of variants) {
      const result = simulateProductionCoverage([earlier, demand(2)], [source()], []);
      expect(result.get(2)?.status).toBe("unknown");
      expect(result.get(2)?.proposedFreeStock).toBeNull();
    }
  });
});