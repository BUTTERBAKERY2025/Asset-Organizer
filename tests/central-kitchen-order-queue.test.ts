import { describe, expect, it } from "vitest";
import {
  isOrderOverdue,
  matchesOrderQueueStage,
  matchesSaudiNeededDate,
  queueOrderNeedsAttention,
  saudiDateValue,
} from "../client/src/components/central-kitchen/order-queue";

describe("central kitchen queue semantics", () => {
  const now = new Date("2026-04-01T21:30:00.000Z"); // 2026-04-02 00:30 in Riyadh

  it("uses the Asia/Riyadh calendar day instead of the browser or UTC day", () => {
    expect(saudiDateValue(now)).toBe("2026-04-02");
    expect(matchesSaudiNeededDate({ status: "requested", neededDate: "2026-04-02" }, "today", now)).toBe(true);
    expect(matchesSaudiNeededDate({ status: "requested", neededDate: "2026-04-01" }, "past", now)).toBe(true);
    expect(matchesSaudiNeededDate({ status: "requested", neededDate: "2026-04-03" }, "future", now)).toBe(true);
  });

  it("interprets needed date and time at Saudi UTC+03:00", () => {
    const order = { status: "approved", neededDate: "2026-04-02", neededTime: "00:15" };
    expect(isOrderOverdue(order, new Date("2026-04-01T21:14:59.000Z"))).toBe(false);
    expect(isOrderOverdue(order, new Date("2026-04-01T21:15:01.000Z"))).toBe(true);
  });

  it("does not treat late submission metadata as overdue fulfillment", () => {
    const order = {
      status: "requested",
      neededDate: "2026-04-03",
      neededTime: "07:00",
      orderingSchedule: { isLate: true },
    };
    expect(queueOrderNeedsAttention(order, now)).toBe(false);
    expect(matchesOrderQueueStage(order, "requested", now)).toBe(true);
  });

  it("keeps only overdue active orders and open received discrepancies in attention", () => {
    expect(queueOrderNeedsAttention({ status: "prepared", neededDate: "2026-04-01", neededTime: "12:00" }, now)).toBe(true);
    expect(queueOrderNeedsAttention({ status: "received", discrepancyStatus: "open" }, now)).toBe(true);
    expect(queueOrderNeedsAttention({ status: "received", discrepancyStatus: "resolved", neededDate: "2026-03-01" }, now)).toBe(false);
    expect(queueOrderNeedsAttention({ status: "cancelled", neededDate: "2026-03-01" }, now)).toBe(false);
  });

  it("archives complete, cancelled, and unknown records safely", () => {
    expect(matchesOrderQueueStage({ status: "received", discrepancyStatus: "resolved" }, "archive", now)).toBe(true);
    expect(matchesOrderQueueStage({ status: "cancelled" }, "archive", now)).toBe(true);
    expect(matchesOrderQueueStage({ status: "legacy_import" }, "archive", now)).toBe(true);
    expect(matchesOrderQueueStage({ status: "received", discrepancyStatus: "open" }, "archive", now)).toBe(false);
  });
});