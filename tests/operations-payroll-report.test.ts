import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { transpileModule, ScriptTarget, ModuleKind } from "typescript";
import { canAccessBranch, getAllowedBranchIds, requirePermission } from "../server/auth";
import { operationsHrManagerOnly, operationsPayrollCsv } from "../server/operations-hr-routes";
import { computeSalaryClosing } from "../server/salary-closing-calc";
import { payrollAttendanceEvidence, payrollReadError, readPayrollSource } from "../server/operations-payroll-report";
import { storage as authStorage } from "../server/storage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Execute the actual isolated read routes, without importing/startup of the
// application's other ~40,000 lines or touching a database.
function fixture() {
  const routes = readFileSync("server/routes.ts", "utf8");
  const source = routes.slice(
    routes.indexOf("  const fetchSalaryClosingRaw ="),
    routes.indexOf("  // اللقطة المحفوظة (إن وُجدت) لفرع/شهر"),
  );
  const employee = {
    id: 18, branchId: "a", employeeNumber: "MED-18", employeeName: "أحمد علي",
    linkedUserId: "a5336a64-127b-4709-804b-834c97b70cb7", status: "active",
    jobTitle: "خباز", department: null, salary: 3000, housingAllowance: 500,
    transportAllowance: 200, foodAllowance: 100, otherAllowances: 50,
    socialInsuranceDeduction: 125, nationality: "سعودي", bankName: "البنك", bankAccountNumber: "SA0001",
  };
  const attendance = {
    id: 1, branchId: "a", branchEmployeeId: 18, attendanceDate: "2026-06-01",
    status: "late", actualCheckIn: "08:10:00", actualCheckOut: "16:20:00",
    workingHours: 8.16, lateMinutes: 10,
  };
  const mockStorage: any = {
    getSalaryClosureByBranchAndMonth: vi.fn(async () => null),
    getSalaryClosureLines: vi.fn(async () => []),
    getBranchEmployeesByBranch: vi.fn(async () => [employee]),
    getBranchEmployee: vi.fn(async () => employee),
    getAllAttendanceRecords: vi.fn(async () => [attendance]),
    getEmployeeSchedulesByBranchAndDateRange: vi.fn(async () => [
      { id: 1, branchId: "a", employeeId: "branch_emp_18", scheduleDate: "2026-06-01", startTime: "08:00", endTime: "16:00", isOff: false },
      { id: 2, branchId: "a", branchEmployeeId: 18, scheduleDate: "2026-06-02", isOff: true },
    ]),
    getFinalizedTimesheetEntriesByBranchAndDateRange: vi.fn(async () => []),
    getSalaryDeductionsByBranchAndMonth: vi.fn(async () => [{ branchEmployeeId: 18, type: "advance", amount: 100, description: "سلفة" }]),
    getAttendanceAdjustmentsByBranchAndMonth: vi.fn(async () => []),
    getSalaryPaymentsByBranchAndMonth: vi.fn(async () => []),
  };
  const leaveRequests = { branchId: "branch", status: "status", startDate: "start", endDate: "end" };
  const reviews = { branchId: "branch", month: "month", reviewedBy: "by", reviewedAt: "at", note: "note" };
  const dbValues = new Map<any, any[]>([[leaveRequests, []], [reviews, []]]);
  const db: any = {
    select: vi.fn(() => {
      let table: any;
      const query = {
        from(value: any) { table = value; return query; },
        innerJoin() { return query; },
        where: vi.fn(async () => dbValues.get(table) ?? []),
      };
      return query;
    }),
    insert: vi.fn(() => { throw new Error("Read route attempted a write"); }),
  };
  const registered = new Map<string, Function[]>();
  const app = {
    get: (path: string, ...handlers: Function[]) => registered.set(path, handlers),
    post: (path: string, ...handlers: Function[]) => registered.set(`POST ${path}`, handlers),
  };
  const isAuthenticated = (req: any, res: any, next: Function) => req.authenticated !== false
    ? next() : res.status(401).json({ error: "unauthenticated" });
  const context = {
    app, storage: mockStorage, db, leaveRequests, operationsPayrollReviews: reviews,
    users: { firstName: "firstName", lastName: "lastName", username: "username", id: "id" },
    readPayrollSource, payrollReadError, payrollAttendanceEvidence, operationsHrManagerOnly,
    operationsPayrollCsv, computeSalaryClosing: vi.fn(computeSalaryClosing),
    canAccessBranch, getAllowedBranchIds,
    requirePermission: (module: string, action: string) => Object.assign(requirePermission(module, action), { module, action }),
    isAuthenticated, HQ_BRANCH_ID: "main_warehouse",
    eq: () => null, and: () => null, lte: () => null, gte: () => null, sql: () => "",
  };
  const compiled = transpileModule(source + "\nreturn { buildBranchPreview, fetchSalaryClosingRaw };", {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext },
  }).outputText;
  const helpers = new Function(...Object.keys(context), compiled)(...Object.values(context));
  vi.spyOn(authStorage, "getUserBranchAccess").mockResolvedValue([{ branchId: "a" }] as any);

  const invoke = async (path: string, query: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}) => {
    const req: any = {
      method: "GET", query: { branchId: "a", month: "2026-06", ...query },
      currentUser: { id: "ops-1", role: "operations_manager", branchId: "a" },
      authPermissions: [{ module: "operations_hr", actions: ["view"] }, { module: "salary_closing", actions: ["view"] }],
      ...overrides,
    };
    const res: any = {
      statusCode: 200, body: undefined, headers: {} as Record<string, string>,
      status(value: number) { this.statusCode = value; return this; },
      json(value: any) { this.body = value; return this; },
      set(name: string, value: string) { this.headers[name] = value; return this; },
      type() { return this; },
      attachment() { return this; },
      send(value: any) { this.body = value; return this; },
    };
    for (const handler of registered.get(path) ?? []) {
      let next = false;
      await handler(req, res, () => { next = true; });
      if (!next) break;
    }
    return res;
  };
  return { invoke, registered, isAuthenticated, mockStorage, employee, attendance, helpers, context, db, dbValues, leaveRequests };
}

describe("operations payroll authoritative report and read routes", () => {
  it("returns exactly the same complete live financial/attendance calculation as HR", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-07-15T10:00:00Z"));
    const f = fixture();
    const ops = await f.invoke("/api/operations-hr/payroll");
    const hr = await f.invoke("/api/salary-closing/preview", {}, { currentUser: { id: "hr", role: "admin" } });
    expect(ops.statusCode).toBe(200);
    expect(ops.body.lines).toEqual(hr.body.lines);
    expect(ops.body.totals).toEqual(hr.body.totals);
    expect(ops.body.lines[0]).toMatchObject({
      branchEmployeeId: 18, department: null, baseSalary: 3000, housingAllowance: 500,
      allowances: 850, grossSalary: 3850, socialInsurance: 125, manualDeductionsTotal: 100,
      presentDays: 1, offDays: 1, unpaidDays: 28, lateDays: 1, totalHours: 8.2,
      dataSource: "schedule_attendance",
    });
    expect(ops.body.lines[0].absentDatesMissing).toHaveLength(28);
    expect(ops.body.enrichmentFailures).toEqual([]);
    expect(ops.headers["Cache-Control"]).toBe("no-store");
    expect(f.db.insert).not.toHaveBeenCalled();
  });

  it.each([
    ["employees", "getBranchEmployeesByBranch"],
    ["attendance", "getAllAttendanceRecords"],
    ["schedules", "getEmployeeSchedulesByBranchAndDateRange"],
    ["signedTimesheets", "getFinalizedTimesheetEntriesByBranchAndDateRange"],
    ["deductions", "getSalaryDeductionsByBranchAndMonth"],
    ["attendanceAdjustments", "getAttendanceAdjustmentsByBranchAndMonth"],
  ])("fails the complete live report and export when %s fails, without leaking SQL/secrets", async (source, method) => {
    const f = fixture();
    vi.spyOn(console, "error").mockImplementation(() => {});
    f.mockStorage[method].mockRejectedValue(new Error("postgres password=secret SELECT * FROM private"));
    for (const route of ["/api/operations-hr/payroll", "/api/operations-hr/payroll/export", "/api/salary-closing/preview"]) {
      const res = await f.invoke(route, {}, route.startsWith("/api/salary") ? { currentUser: { id: "admin", role: "admin" } } : {});
      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({ code: "PAYROLL_SOURCE_UNAVAILABLE", source });
      expect(JSON.stringify(res.body)).not.toMatch(/secret|postgres|SELECT/);
      expect(res.body.lines).toBeUndefined();
    }
    expect(f.context.computeSalaryClosing).not.toHaveBeenCalled();
    expect(f.db.insert).not.toHaveBeenCalled();
  });

  it("does not silently discard failed approved leave reads", async () => {
    const f = fixture();
    vi.spyOn(console, "error").mockImplementation(() => {});
    f.context.db.select.mockImplementation(() => {
      const query = {
        from(table: any) { return table === f.leaveRequests ? { where: async () => { throw new Error("private database error"); } } : query; },
        where: async () => [],
      };
      return query;
    });
    const res = await f.invoke("/api/operations-hr/payroll");
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: "PAYROLL_SOURCE_UNAVAILABLE", source: "leaveRequests" });
    expect(f.context.computeSalaryClosing).not.toHaveBeenCalled();
  });

  it("preserves saved salary/header values with explicit failed current enrichment and no live recompute", async () => {
    const f = fixture();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const saved = { id: 91, branchEmployeeId: 18, employeeName: "اسم اللقطة", employeeStatus: "terminated", netSalary: 1723.45, grossSalary: 2600.6, presentDays: 17, sickLeaveDeduction: 40.2 };
    f.mockStorage.getSalaryClosureByBranchAndMonth.mockResolvedValue({ id: 6, status: "closed", totalNet: 1723.45, totalGross: 2600.6, warnings: [{ code: "saved_warning" }] });
    f.mockStorage.getSalaryClosureLines.mockResolvedValue([saved]);
    f.mockStorage.getBranchEmployeesByBranch.mockRejectedValue(new Error("sensitive enrichment failure"));
    f.mockStorage.getAllAttendanceRecords.mockRejectedValue(new Error("live unavailable"));
    const res = await f.invoke("/api/operations-hr/payroll");
    expect(res.statusCode).toBe(200);
    expect(res.body.isLocked).toBe(true);
    expect(res.body.lines[0]).toMatchObject(saved);
    expect(res.body.totals.totalNet).toBe(1723.45);
    expect(res.body.warnings).toEqual([{ code: "saved_warning" }]);
    expect(res.body.enrichmentFailures).toEqual([{ source: "employees", message: expect.any(String) }]);
    expect(f.context.computeSalaryClosing).not.toHaveBeenCalled();
    expect(f.mockStorage.getAllAttendanceRecords).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain("sensitive");
    const exported = await f.invoke("/api/operations-hr/payroll/export");
    expect(exported.statusCode).toBe(200);
    expect(exported.headers["X-Payroll-Enrichment-Failures"]).toBe("employees");
    expect(exported.body).toContain('"2600.6","1723.45"');
  });

  it("fails when saved snapshot lines cannot be read, rather than recomputing a closed month", async () => {
    const f = fixture();
    vi.spyOn(console, "error").mockImplementation(() => {});
    f.mockStorage.getSalaryClosureByBranchAndMonth.mockResolvedValue({ id: 6, status: "closed", totalNet: 900 });
    f.mockStorage.getSalaryClosureLines.mockRejectedValue(new Error("private snapshot failure"));
    const res = await f.invoke("/api/operations-hr/payroll");
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: "PAYROLL_SOURCE_UNAVAILABLE", source: "snapshotLines" });
    expect(f.context.computeSalaryClosing).not.toHaveBeenCalled();
    expect(f.mockStorage.getAllAttendanceRecords).not.toHaveBeenCalled();
  });

  it("uses signed timesheets, approved leave, manual attendance adjustment and inactive work in the same HR calculation", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-07-15T10:00:00Z"));
    const f = fixture();
    f.mockStorage.getBranchEmployeesByBranch.mockResolvedValue([
      f.employee, { ...f.employee, id: 19, employeeName: "موظف منتهي", status: "terminated", linkedUserId: null },
      { ...f.employee, id: 20, employeeName: "غير نشط بدون عمل", status: "inactive", linkedUserId: null },
    ]);
    f.mockStorage.getAllAttendanceRecords.mockResolvedValue([
      f.attendance, { ...f.attendance, id: 2, branchEmployeeId: 19, status: "present" },
    ]);
    f.mockStorage.getFinalizedTimesheetEntriesByBranchAndDateRange.mockResolvedValue([{
      report: { id: 3, branchEmployeeId: 18, branchId: "a", status: "finalized" },
      entries: [
        { date: "2026-06-01", status: "present", actualHours: 7.5, scheduledHours: 8 },
        { date: "2026-06-02", status: "day_off", isOff: true },
      ],
    }]);
    f.mockStorage.getAttendanceAdjustmentsByBranchAndMonth.mockResolvedValue([
      { branchEmployeeId: 18, adjustedPresentDays: 2, reason: "تصحيح معتمد", createdByName: "الموارد" },
    ]);
    f.dbValues.set(f.leaveRequests, [
      { branchId: "a", branchEmployeeId: 18, status: "approved", leaveType: "sick", startDate: "2026-06-03", endDate: "2026-06-03", sickTierBreakdown: { usedBefore: 30, year: 2026 } },
      { branchId: "a", branchEmployeeId: 18, status: "approved", leaveType: "unpaid", startDate: "2026-06-04", endDate: "2026-06-04" },
    ]);
    const res = await f.invoke("/api/operations-hr/payroll");
    const hr = await f.invoke("/api/salary-closing/preview", {}, { currentUser: { id: "hr", role: "admin" } });
    expect(res.body.lines).toEqual(hr.body.lines);
    expect(res.body.lines.map((line: any) => line.branchEmployeeId)).toEqual([18, 19]);
    expect(res.body.lines[0]).toMatchObject({
      dataSource: "signed_timesheet", totalHours: 7.5, originalPresentDays: 1, presentDays: 2,
      attendanceAdjustmentReason: "تصحيح معتمد", paidLeaveDays: 1, unpaidLeaveDays: 1,
      sickThreeQuarterDays: 1, sickLeaveDeduction: 32.08,
    });
    expect(res.body.lines[1].employeeStatus).toBe("terminated");
  });

  it("keeps both existing gates and authentication on every added GET, without adding mutations", async () => {
    const f = fixture();
    const paths = ["/api/operations-hr/payroll/attendance", "/api/operations-hr/payroll/payments"];
    for (const path of paths) {
      expect(f.registered.get(path)?.[0]).toBe(f.isAuthenticated);
      expect(f.registered.get(path)?.[1]).toBe(operationsHrManagerOnly);
      expect((f.registered.get(path)?.[2] as any).module).toBe("operations_hr");
      expect((f.registered.get(path)?.[2] as any).action).toBe("view");
      expect((f.registered.get(path)?.[3] as any).module).toBe("operations_payroll");
      expect((f.registered.get(path)?.[3] as any).action).toBe("view");
      expect(f.registered.get(`POST ${path}`)).toBeUndefined();
      expect((await f.invoke(path, { branchEmployeeId: "18" }, { authenticated: false })).statusCode).toBe(401);
      expect((await f.invoke(path, { branchEmployeeId: "18" }, { currentUser: { role: "hr_manager" } })).statusCode).toBe(403);
      expect((await f.invoke(path, { branchEmployeeId: "18", branchId: "other" })).statusCode).toBe(403);
      expect((await f.invoke(path, { branchEmployeeId: "18", branchId: "main_warehouse" })).statusCode).toBe(403);
      expect((await f.invoke(path, { branchEmployeeId: "18", month: "2026-13" })).statusCode).toBe(400);
    }
    expect(f.mockStorage.getAllAttendanceRecords).not.toHaveBeenCalled();
    expect(f.mockStorage.getSalaryPaymentsByBranchAndMonth).not.toHaveBeenCalled();
    vi.mocked(authStorage.getUserBranchAccess).mockResolvedValue([]);
    expect((await f.invoke(paths[1])).statusCode).toBe(403);
  });

  it("validates employee input and prevents cross-branch attendance IDOR before reading evidence", async () => {
    const f = fixture();
    for (const id of ["18bad", "0", "-1", "9007199254740993", ["18"]]) {
      expect((await f.invoke("/api/operations-hr/payroll/attendance", { branchEmployeeId: id })).statusCode).toBe(400);
    }
    f.mockStorage.getBranchEmployee.mockResolvedValue({ ...f.employee, branchId: "outside" });
    expect((await f.invoke("/api/operations-hr/payroll/attendance", { branchEmployeeId: "18" })).statusCode).toBe(403);
    expect(f.mockStorage.getAllAttendanceRecords).not.toHaveBeenCalled();
  });

  it("permits historical snapshot employee membership after transfer, not closure-line id or reopened membership", async () => {
    const f = fixture();
    f.mockStorage.getBranchEmployee.mockResolvedValue({ ...f.employee, branchId: "outside" });
    f.mockStorage.getSalaryClosureByBranchAndMonth.mockResolvedValue({ id: 6, status: "closed" });
    f.mockStorage.getSalaryClosureLines.mockResolvedValue([{ id: 91, branchEmployeeId: 18, employeeName: "اسم اللقطة" }]);
    const res = await f.invoke("/api/operations-hr/payroll/attendance", { branchEmployeeId: "18" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ isLocked: true, employeeName: "اسم اللقطة", branchEmployeeId: 18, evidenceSource: "live_records" });
    expect(res.body.attendance[0]).toMatchObject({ checkInTime: "08:10:00", checkOutTime: "16:20:00", workingHours: 8.16, status: "late" });
    expect(res.body.schedules).toHaveLength(2);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    f.mockStorage.getBranchEmployee.mockResolvedValue({ id: 91, branchId: "outside" });
    expect((await f.invoke("/api/operations-hr/payroll/attendance", { branchEmployeeId: "91" })).statusCode).toBe(403);
    f.mockStorage.getBranchEmployee.mockResolvedValue({ ...f.employee, branchId: "outside" });
    f.mockStorage.getSalaryClosureByBranchAndMonth.mockResolvedValue({ id: 6, status: "reopened" });
    expect((await f.invoke("/api/operations-hr/payroll/attendance", { branchEmployeeId: "18" })).statusCode).toBe(403);
  });

  it("can read a deleted historical employee using locked membership, but detail source failure is explicit", async () => {
    const f = fixture();
    f.mockStorage.getBranchEmployee.mockResolvedValue(undefined);
    f.mockStorage.getBranchEmployeesByBranch.mockResolvedValue([]);
    f.mockStorage.getSalaryClosureByBranchAndMonth.mockResolvedValue({ id: 6, status: "closed" });
    f.mockStorage.getSalaryClosureLines.mockResolvedValue([{ id: 91, branchEmployeeId: 18, employeeName: "محفوظ" }]);
    const res = await f.invoke("/api/operations-hr/payroll/attendance", { branchEmployeeId: "18" });
    expect(res.statusCode).toBe(200);
    expect(res.body.attendance).toHaveLength(1);
    vi.spyOn(console, "error").mockImplementation(() => {});
    f.mockStorage.getEmployeeSchedulesByBranchAndDateRange.mockRejectedValue(new Error("private schedule failure"));
    const failed = await f.invoke("/api/operations-hr/payroll/attendance", { branchEmployeeId: "18" });
    expect(failed.statusCode).toBe(500);
    expect(failed.body).toMatchObject({ code: "PAYROLL_SOURCE_UNAVAILABLE", source: "schedules" });
    expect(failed.body.attendance).toBeUndefined();
    expect(JSON.stringify(failed.body)).not.toContain("private");
  });

  it("reads recorded payments by their own branch/month with null preserved and no employee/current-branch joins", async () => {
    const f = fixture();
    const payment = { id: 7, branchId: "a", branchEmployeeId: 18, month: "2026-06", paymentMethod: "cash", amount: null, note: "سجل قديم", paidAt: "2026-07-01" };
    f.mockStorage.getSalaryPaymentsByBranchAndMonth.mockResolvedValue([
      payment, { ...payment, branchId: "other" }, { ...payment, month: "2026-05" },
    ]);
    const res = await f.invoke("/api/operations-hr/payroll/payments");
    expect(res.body).toEqual({ branchId: "a", month: "2026-06", source: "recorded_payments", payments: [{
      id: 7, branchId: "a", branchEmployeeId: 18, month: "2026-06", paymentMethod: "cash",
      amount: null, notes: "سجل قديم", paidAt: "2026-07-01",
    }] });
    expect(f.mockStorage.getBranchEmployee).not.toHaveBeenCalled();
    expect(f.db.insert).not.toHaveBeenCalled();
    expect(res.headers["Cache-Control"]).toBe("no-store");
    vi.spyOn(console, "error").mockImplementation(() => {});
    f.mockStorage.getSalaryPaymentsByBranchAndMonth.mockRejectedValue(new Error("private"));
    const failure = await f.invoke("/api/operations-hr/payroll/payments");
    expect(failure.statusCode).toBe(500);
    expect(failure.body).toMatchObject({ code: "PAYROLL_SOURCE_UNAVAILABLE", source: "payments" });
  });
});

describe("scoped attendance evidence identity and export", () => {
  it("matches all three strong attendance identities and unique Arabic imported names without outside/month leakage", () => {
    const employee = { id: 18, employeeName: "أحمد علي", employeeNumber: "MED-18", linkedUserId: "uuid-18" };
    const row = { branchId: "a", status: "present", workingHours: null, actualCheckIn: null, actualCheckOut: null };
    const detail = payrollAttendanceEvidence({
      branchId: "a", month: "2026-06", employee, candidates: [employee], isLocked: false,
      attendance: [
        { ...row, id: 1, branchEmployeeId: 18, attendanceDate: "2026-06-01" },
        { ...row, id: 2, employeeId: "branch_emp_18", attendanceDate: "2026-06-02" },
        { ...row, id: 3, employeeId: "uuid-18", attendanceDate: "2026-06-03" },
        { ...row, id: 4, employeeName: "احمدعلي", attendanceDate: "2026-06-04" },
        { ...row, id: 5, employeeNumber: "MED-18", attendanceDate: "2026-06-05" },
        { ...row, id: 6, branchEmployeeId: 18, attendanceDate: "2026-05-05" },
        { ...row, id: 100, branchEmployeeId: 18, attendanceDate: "2026-06-01", branchId: "outside" },
        { ...row, id: 20, branchEmployeeId: 18, attendanceDate: "2026-06-02", actualCheckIn: "08:00" },
        { ...row, id: 21, employeeName: "أحمد علي", branchEmployeeId: 99, attendanceDate: "2026-06-06" },
        { ...row, id: 22, employeeName: "أحمد علي", employeeId: "branch_emp_99", attendanceDate: "2026-06-06" },
      ],
      schedules: [], signedTimesheets: [],
    });
    expect(detail.attendance.map(row => row.id)).toEqual([1, 20, 3, 4, 5]);
    expect(detail.attendance[0]).toMatchObject({ checkInTime: null, checkOutTime: null, workingHours: null });
  });

  it("does not guess attendance for ambiguous names or expose signatures/device details", () => {
    const employee = { id: 18, employeeName: "أحمد علي" };
    const detail = payrollAttendanceEvidence({
      branchId: "a", month: "2026-06", employee, candidates: [employee, { id: 19, employeeName: "احمدعلي" }], isLocked: false,
      attendance: [
        { id: 1, branchId: "a", employeeName: "احمدعلي", attendanceDate: "2026-06-01" },
        { id: 2, branchId: "a", branchEmployeeId: 18, attendanceDate: "2026-06-02", status: "present", checkInSignature: "private", deviceInfo: "private" },
      ], schedules: [], signedTimesheets: [{
        report: { id: 9, branchId: "a", branchEmployeeId: 18, status: "finalized" },
        entries: [
          { date: "2026-06-02", status: "present", actualHours: 8, actualStartTime: "08:00", actualEndTime: "16:00", checkInSignature: "private" },
          { date: "2026-05-02", status: "present", actualHours: 8 },
        ],
      }],
    });
    expect(detail.attendance.map(row => row.id)).toEqual([2]);
    expect(detail.signedTimesheets[0].entries).toEqual([expect.objectContaining({ date: "2026-06-02", checkInTime: "08:00", checkOutTime: "16:00", actualHours: 8 })]);
    expect(JSON.stringify(detail)).not.toContain("private");
  });

  it("exports the full HR fields with quoted formula-safe strings and canonical employee ids", () => {
    const csv = operationsPayrollCsv([{
      id: 91, branchEmployeeId: 18, employeeName: '=SUM(1,2)"\n',
      jobTitle: "@danger", bankAccountNumber: "\t=evil", presentDays: 17,
      sickLeaveDeduction: 33.5, manualDeductions: [{ type: "advance", amount: 25, description: "=evil" }],
      dataSource: "signed_timesheet", grossSalary: 3000, netSalary: -1.25,
      absentDatesMissing: ["2026-06-08"], attendanceAdjustmentReason: "+danger",
    }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"خصم المرضية"');
    expect(csv).toContain('"تواريخ الأيام غير المسجلة"');
    expect(csv).toContain('"سبب تعديل الحضور"');
    expect(csv).toContain('"ساعات العمل"');
    expect(csv).toContain('"التأمينات"');
    expect(csv).toContain('"18"');
    expect(csv).not.toContain('"91"');
    expect(csv).toContain('"\'=SUM(1,2)""\n"');
    expect(csv).toContain('"\'@danger"');
    expect(csv).toContain('"\'\t=evil"');
    expect(csv).toContain('"3000","-1.25"');
    expect(csv).toContain("signed_timesheet");
  });
});