import { describe, expect, it } from "vitest";
import { summarizeBranchAttendance, type DeskSchedule, type DeskAttendance } from "../server/branch-attendance-summary";

const day = "2026-08-03";
const schedule = (id: number, canonicalId: number | null, startTime = "09:00"): DeskSchedule =>
  ({ id, canonicalId, branchId: "a", scheduleDate: day, startTime, isOff: false, status: "scheduled" });
const record = (id: number, canonicalId: number | null): DeskAttendance =>
  ({ id, canonicalId, branchId: "a", attendanceDate: day, actualCheckIn: "09:00", actualCheckOut: null, status: "present" });
const summarize = (s: DeskSchedule[], a: DeskAttendance[] = [], leave: number[] = []) =>
  summarizeBranchAttendance("a", day, new Date(`${day}T07:00:00Z`), s, a, leave);

describe("branch desk attendance evidence", () => {
  it("deduplicates canonical identities and preserves an open check-in", () => {
    const result = summarize([schedule(1, 10), schedule(2, 10)], [
      record(1, 10), { ...record(2, 10), actualCheckOut: "10:00" },
    ]);
    expect(result).toMatchObject({ scheduled: 1, scheduledArrived: 1, arrived: 1, open: 1, awaiting: 0 });
  });
  it("filters branch and Saudi business day before identity dedupe", () => {
    expect(summarize([schedule(1, 10)], [
      record(1, 10), { ...record(99, 10), branchId: "other", actualCheckIn: null, status: "absent" },
      { ...record(100, 10), attendanceDate: "2026-08-02" },
    ])).toMatchObject({ arrived: 1, scheduledArrived: 1 });
  });
  it("does not assert absence before the shift, on leave, off or cancelled", () => {
    const result = summarize([
      schedule(1, 1, "23:00"), schedule(2, 2, "08:00"), { ...schedule(3, 3), isOff: true },
      { ...schedule(4, 4), status: "cancelled" }, schedule(5, 5, "08:30"), schedule(6, 6, "09:30"),
    ], [], [2]);
    expect(result).toMatchObject({ scheduled: 3, awaiting: 2, future: 1, oldestDue: `${day}T05:30:00.000Z` });
    expect(result).not.toHaveProperty("absent");
  });
  it("exposes unresolved identity and invalid time coverage instead of an absence", () => {
    expect(summarize([schedule(1, null), schedule(2, 2, "bad")], [record(3, null)]))
      .toMatchObject({ unresolved: 2, unknownTime: 1, awaiting: 0, arrived: 0 });
  });
  it("does not fabricate schedules from recorded attendance", () => {
    expect(summarize([], [record(1, 1)])).toMatchObject({ arrived: 1, scheduled: 0, awaiting: 0 });
  });
});