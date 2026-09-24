// Daily desk counts are evidence of attendance, never payroll absence decisions.
export interface DeskSchedule {
  id: number; branchId: string | null; scheduleDate: string; canonicalId: number | null;
  startTime: string | null; isOff: boolean; status: string;
}
export interface DeskAttendance {
  id: number; branchId: string; attendanceDate: string; canonicalId: number | null;
  actualCheckIn: string | null; actualCheckOut: string | null; status: string;
}

export function summarizeBranchAttendance(
  branchId: string, day: string, now: Date, schedules: DeskSchedule[], records: DeskAttendance[],
  leaveIds: number[] = [],
) {
  const roster = new Map<number, DeskSchedule>();
  const attendance = new Map<number, DeskAttendance>();
  let unresolved = 0;
  for (const row of schedules.filter(r => r.branchId === branchId && r.scheduleDate === day)) {
    if (row.canonicalId == null) { unresolved++; continue; }
    const previous = roster.get(row.canonicalId);
    if (!previous || row.id > previous.id) roster.set(row.canonicalId, row);
  }
  for (const row of records.filter(r => r.branchId === branchId && r.attendanceDate === day)) {
    if (row.canonicalId == null) { unresolved++; continue; }
    const previous = attendance.get(row.canonicalId);
    // Preserve the open check-in just as the checkout resolver does.
    const open = !!row.actualCheckIn && !row.actualCheckOut;
    const previousOpen = !!previous?.actualCheckIn && !previous?.actualCheckOut;
    if (!previous || (open && !previousOpen) || (open === previousOpen && row.id > previous.id)) {
      attendance.set(row.canonicalId, row);
    }
  }
  const arrived = (row?: DeskAttendance) => !!row && (!!row.actualCheckIn || ["present", "late", "early_leave"].includes(row.status));
  const leaves = new Set(leaveIds);
  let scheduled = 0, scheduledArrived = 0, awaiting = 0, future = 0, unknownTime = 0;
  let oldestDue: string | undefined;
  for (const [id, row] of roster) {
    if (row.isOff || row.status === "cancelled" || leaves.has(id)) continue;
    scheduled++;
    if (arrived(attendance.get(id))) { scheduledArrived++; continue; }
    if (!row.startTime || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(row.startTime)) { unknownTime++; continue; }
    const due = new Date(`${day}T${row.startTime.length === 5 ? `${row.startTime}:00` : row.startTime}+03:00`);
    if (due.getTime() > now.getTime()) { future++; continue; }
    awaiting++;
    const iso = due.toISOString();
    if (!oldestDue || iso < oldestDue) oldestDue = iso;
  }
  return {
    scheduled, scheduledArrived, awaiting, future, unknownTime, unresolved, oldestDue,
    recorded: attendance.size,
    arrived: [...attendance.values()].filter(arrived).length,
    open: [...attendance.values()].filter(r => r.actualCheckIn && !r.actualCheckOut).length,
  };
}