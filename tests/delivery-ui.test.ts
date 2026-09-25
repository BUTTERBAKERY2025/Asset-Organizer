import { describe, expect, it } from "vitest";
import { deliveryTiming } from "../client/src/components/delivery/delivery-ui";
import type { Delivery } from "../client/src/pages/driver-deliveries";

const scheduled = Date.parse("2026-01-01T10:00:00Z");
const task = (status: Delivery["status"], scheduledAt: string | null = new Date(scheduled).toISOString()) =>
  ({ status, scheduledAt } as Delivery);

describe("delivery deadline indicators", () => {
  it("shows overdue at the deadline and escalation at exactly sixty minutes", () => {
    expect(deliveryTiming(task("assigned"), scheduled - 1)).toBe("on_time");
    expect(deliveryTiming(task("assigned"), scheduled)).toBe("overdue");
    expect(deliveryTiming(task("awaiting_receipt"), scheduled + 60 * 60_000 - 1)).toBe("overdue");
    expect(deliveryTiming(task("awaiting_receipt"), scheduled + 60 * 60_000)).toBe("escalated");
  });

  it("hides deadline warnings after receipt approval, completion and cancellation", () => {
    for (const status of ["receipt_approved", "completed", "cancelled"] as const)
      expect(deliveryTiming(task(status), scheduled + 90 * 60_000)).toBe("on_time");
    expect(deliveryTiming(task("in_transit", null), scheduled + 90 * 60_000)).toBe("on_time");
  });
});