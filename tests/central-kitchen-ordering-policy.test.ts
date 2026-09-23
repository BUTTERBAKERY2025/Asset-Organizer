import { describe, expect, it } from "vitest";
import {
  getOrderSchedule,
  getOrderingPolicy,
  validateOrderingPolicyConfig,
} from "../shared/central-kitchen-ordering-policy";

describe("central kitchen daily ordering policy", () => {
  it("uses the Saudi calendar when calculating tomorrow across UTC and year boundaries", () => {
    expect(getOrderingPolicy(new Date("2026-12-31T20:59:59.000Z"))?.defaultNeededDate)
      .toBe("2027-01-01");
    expect(getOrderingPolicy(new Date("2026-12-31T21:00:00.000Z"))?.defaultNeededDate)
      .toBe("2027-01-02");
  });

  it("allows a submission exactly at 17:00 Riyadh and marks only later submissions late", () => {
    const base = { neededDate: "2027-01-02", neededTime: "07:00" };
    expect(getOrderSchedule({ ...base, createdAt: "2027-01-01T14:00:00.000Z" })).toEqual({
      isLate: false,
      cutoffAt: "2027-01-01T14:00:00.000Z",
      reviewAt: "2027-01-01T16:00:00.000Z",
      deliveryAt: "2027-01-02T04:00:00.000Z",
    });
    expect(getOrderSchedule({ ...base, createdAt: "2027-01-01T14:00:00.001Z" })?.isLate).toBe(true);
  });

  it("returns null metadata for malformed stored values instead of throwing", () => {
    expect(getOrderSchedule({
      neededDate: "2027-02-30",
      neededTime: "07:00",
      createdAt: "2027-01-01T00:00:00Z",
    })).toBeNull();
    expect(getOrderSchedule({
      neededDate: "2027-02-28",
      neededTime: "99:00",
      createdAt: "2027-01-01T00:00:00Z",
    })).toBeNull();
    expect(getOrderSchedule({
      neededDate: "2027-02-28",
      neededTime: "07:00",
      createdAt: "not-a-date",
    })).toBeNull();
  });

  it("keeps replay metadata stable and defaults a missing delivery time", () => {
    const order = {
      neededDate: "2028-02-29",
      createdAt: "2028-02-28T10:00:00.000Z",
    };
    expect(getOrderSchedule(order, new Date("2030-01-01T00:00:00Z")))
      .toEqual(getOrderSchedule(order, new Date("2040-01-01T00:00:00Z")));
    expect(getOrderSchedule(order)?.deliveryAt).toBe("2028-02-29T04:00:00.000Z");
  });

  it("re-evaluates original submission lateness against an edited needed date", () => {
    const createdAt = "2027-01-02T15:00:00.000Z";
    expect(getOrderSchedule({ neededDate: "2027-01-03", createdAt })?.isLate).toBe(true);
    expect(getOrderSchedule({ neededDate: "2027-01-04", createdAt })?.isLate).toBe(false);
  });

  it("uses an optional persisted configuration without changing legacy defaults", () => {
    const config = {
      requestDeadline: "16:30",
      reviewTime: "18:15",
      defaultNeededTime: "08:45",
    };
    const order = { neededDate: "2027-01-02", createdAt: "2027-01-01T13:30:00.001Z" };
    expect(getOrderingPolicy(new Date("2027-01-01T00:00:00Z"), config)).toMatchObject(config);
    expect(getOrderSchedule(order, config)).toEqual({
      isLate: true,
      cutoffAt: "2027-01-01T13:30:00.000Z",
      reviewAt: "2027-01-01T15:15:00.000Z",
      deliveryAt: "2027-01-02T05:45:00.000Z",
    });
    expect(getOrderSchedule({ ...order, neededTime: "09:20" }, config)?.deliveryAt)
      .toBe("2027-01-02T06:20:00.000Z");
  });

  it("accepts only exact HH:mm policy objects with cutoff no later than review", () => {
    expect(validateOrderingPolicyConfig({
      requestDeadline: "17:00", reviewTime: "17:00", defaultNeededTime: "07:00",
    })).not.toBeNull();
    expect(validateOrderingPolicyConfig({
      requestDeadline: "17:01", reviewTime: "17:00", defaultNeededTime: "07:00",
    })).toBeNull();
    expect(validateOrderingPolicyConfig({
      requestDeadline: "7:00", reviewTime: "19:00", defaultNeededTime: "07:00",
    })).toBeNull();
    expect(validateOrderingPolicyConfig({
      requestDeadline: "17:00", reviewTime: "19:00", defaultNeededTime: "07:00", extra: true,
    })).toBeNull();
  });
});