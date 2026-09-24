import { describe, expect, it, vi } from "vitest";
import { isPushVisibleNow } from "../server/push-service";
import { isWithinRiyadhDailyWindow } from "../shared/riyadh-time";

// Visibility tests do not query the database.
vi.mock("../server/db", () => ({ db: {} }));

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

  const saudiInstant = (day: string, time: string) =>
    new Date(new Date(`${day}T${time}:00.000Z`).getTime() - 3 * 60 * 60_000);

  it.each([
    ["daytime start", "09:00", "17:00", "09:00", true],
    ["daytime end", "09:00", "17:00", "17:00", true],
    ["before daytime", "09:00", "17:00", "08:59", false],
    ["after daytime", "09:00", "17:00", "17:01", false],
    ["overnight start", "22:00", "02:00", "22:00", true],
    ["overnight late", "22:00", "02:00", "23:59", true],
    ["overnight next day", "22:00", "02:00", "00:00", true],
    ["overnight end", "22:00", "02:00", "02:00", true],
    ["before overnight start", "22:00", "02:00", "21:59", false],
    ["after overnight end", "22:00", "02:00", "02:01", false],
    ["open start allowed", null, "02:00", "01:00", true],
    ["open start ended", null, "02:00", "22:00", false],
    ["open end allowed", "22:00", null, "23:00", true],
    ["open end not begun", "22:00", null, "01:00", false],
    ["fully open", null, null, "12:00", true],
    ["bad hour", "24:00", null, "12:00", false],
    ["bad minute", null, "02:60", "01:00", false],
    ["non-padded bound", "2:00", "04:00", "03:00", false],
    ["empty bound", "", null, "12:00", false],
  ] as const)("matches the bell for %s", (_label, start, end, time, expected) => {
    const now = saudiInstant("2026-09-24", time);
    expect(isWithinRiyadhDailyWindow(start, end, now)).toBe(expected);
    expect(isPushVisibleNow({
      startDate: null,
      endDate: null,
      displayTimeStart: start,
      displayTimeEnd: end,
    } as any, now)).toBe(expected);
  });

  it("honors absolute start and expiry even inside an overnight window", () => {
    const now = saudiInstant("2026-09-25", "01:00");
    const window = { displayTimeStart: "22:00", displayTimeEnd: "02:00" };
    expect(isPushVisibleNow({ ...window, startDate: now, endDate: now } as any, now)).toBe(true);
    expect(isPushVisibleNow({
      ...window, startDate: new Date(now.getTime() + 1), endDate: null,
    } as any, now)).toBe(false);
    expect(isPushVisibleNow({
      ...window, startDate: null, endDate: new Date(now.getTime() - 1),
    } as any, now)).toBe(false);
  });
});