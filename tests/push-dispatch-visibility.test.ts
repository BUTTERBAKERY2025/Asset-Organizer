import { describe, expect, it } from "vitest";
import { isPushVisibleNow } from "../server/push-service";

describe("push dispatch visibility parity", () => {
  const noon = new Date("2026-09-24T09:00:00.000Z"); // 12:00 in Riyadh

  it("does not dispatch before start or after end", () => {
    expect(isPushVisibleNow({
      startDate: new Date("2026-09-24T09:01:00.000Z"),
      endDate: null,
      displayTimeStart: null,
      displayTimeEnd: null,
    } as any, noon)).toBe(false);
    expect(isPushVisibleNow({
      startDate: null,
      endDate: new Date("2026-09-24T08:59:00.000Z"),
      displayTimeStart: null,
      displayTimeEnd: null,
    } as any, noon)).toBe(false);
  });

  it("uses the same inclusive daily display window as the bell", () => {
    expect(isPushVisibleNow({
      startDate: null,
      endDate: null,
      displayTimeStart: "12:00",
      displayTimeEnd: "12:00",
    } as any, noon)).toBe(true);
    expect(isPushVisibleNow({
      startDate: null,
      endDate: null,
      displayTimeStart: "12:01",
      displayTimeEnd: null,
    } as any, noon)).toBe(false);
  });

  it("evaluates display windows in Saudi time even when the instant is UTC", () => {
    const utcNinePm = new Date("2026-09-24T21:30:00.000Z"); // 00:30 next day in Riyadh
    expect(isPushVisibleNow({
      startDate: null,
      endDate: null,
      displayTimeStart: "00:00",
      displayTimeEnd: "00:59",
    } as any, utcNinePm)).toBe(true);
    expect(isPushVisibleNow({
      startDate: null,
      endDate: null,
      displayTimeStart: "21:00",
      displayTimeEnd: "21:59",
    } as any, utcNinePm)).toBe(false);
  });
});