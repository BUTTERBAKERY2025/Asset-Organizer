/** Read-only evidence DTOs; payroll amounts continue to use HR's authoritative report. */
export interface OperationsPayrollEnrichmentFailure {
  source: string;
  message: string;
}

export interface OperationsPayrollAttendanceDetail {
  branchId: string;
  month: string;
  branchEmployeeId: number;
  employeeName: string;
  isLocked: boolean;
  /** Evidence records are current reads, not immutable salary snapshot evidence. */
  evidenceSource: "live_records";
  attendance: Array<{
    id: number;
    attendanceDate: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    workingHours: number | null;
    status: string;
    isLate: boolean;
    lateMinutes: number | null;
    earlyLeaveMinutes: number | null;
    overtimeMinutes: number | null;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    notes: string | null;
  }>;
  schedules: Array<{
    id: number;
    scheduleDate: string;
    startTime: string | null;
    endTime: string | null;
    breakDuration: number | null;
    isOff: boolean;
    shiftType: string | null;
    status: string;
    notes: string | null;
  }>;
  signedTimesheets: Array<{
    id: number;
    status: string;
    entries: Array<{
      date: string;
      status: string;
      isOff: boolean;
      scheduledHours: number | null;
      actualHours: number | null;
      checkInTime: string | null;
      checkOutTime: string | null;
      notes: string | null;
    }>;
  }>;
}

export interface OperationsPayrollPayments {
  branchId: string;
  month: string;
  source: "recorded_payments";
  payments: Array<{
    id: number;
    branchEmployeeId: number;
    branchId: string;
    month: string;
    paymentMethod: string;
    paidAt: string;
    /** A legacy null amount is not evidence of full settlement. */
    amount: number | null;
    notes: string | null;
  }>;
}