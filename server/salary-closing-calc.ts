// =====================================================
// Salary Closing Calculation — الاحتساب المركزي لإغلاق الرواتب (على الخادم)
// =====================================================
// هذا الملف هو "مصدر الحقيقة" لحساب الرواتب الشهرية. كان الاحتساب سابقاً يتم
// في متصفح المستخدم؛ نقلناه للخادم لضمان الأمان والاتساق وصعوبة التلاعب.
// منطق الأولوية: التايم شيت الموقّع > جدول + بصمة > بصمة فقط.

export interface SalaryClosingRaw {
  branchId: string;
  month: string; // YYYY-MM
  employees: any[];
  attendance: any[];
  schedules: any[];
  signedTimesheets: Array<{ report: any; entries: any[] }>;
  deductions: any[];
}

export interface SalaryClosingLine {
  id: number | null;
  branchEmployeeId: number | null;
  employeeNumber: string | null;
  employeeName: string;
  jobTitle: string;
  nationality: string;
  bankName: string;
  bankAccountNumber: string;
  presentDays: number;
  absentDays: number;
  offDays: number;
  scheduledWorkDays: number;
  scheduledHours: number;
  lateDays: number;
  totalHours: number;
  baseSalary: number;
  allowances: number;
  grossSalary: number;
  dailyRate: number;
  absenceDeduction: number;
  socialInsurance: number;
  manualDeductions: Array<{ type: string; amount: number; description?: string | null }>;
  manualDeductionsTotal: number;
  netSalary: number;
  dataSource: "signed_timesheet" | "schedule_attendance" | "attendance_only";
  noWorkAtAll: boolean;
  presentDates: string[];
  absentDates: string[];
  absentDatesExplicit: string[];
  absentDatesMissing: string[];
  offDates: string[];
}

export interface SalaryClosingWarning {
  branchEmployeeId: number | null;
  employeeName: string;
  code: "no_work_at_all" | "missing_bank";
  message: string;
}

export interface SalaryClosingTotals {
  employeeCount: number;
  totalBase: number;
  totalAllowances: number;
  totalGross: number;
  totalAbsenceDeduction: number;
  totalSocialInsurance: number;
  totalManualDeductions: number;
  totalNet: number;
}

export interface SalaryClosingResult {
  lines: SalaryClosingLine[];
  totals: SalaryClosingTotals;
  unlinked: any[];
  unlinkedSummary: { totalRecords: number; presentRecords: number; totalHours: number };
  warnings: SalaryClosingWarning[];
}

// النسبة والوعاء وفق التأمينات الاجتماعية السعودية:
// حصة الموظف 9.75% من (الراتب الأساسي + بدل السكن) بحد أقصى للأجر الخاضع 45,000 ريال.
const GOSI_EMPLOYEE_RATE = 0.0975;
const GOSI_WAGE_CAP = 45000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function todayRiyadh(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

export function computeSalaryClosing(raw: SalaryClosingRaw): SalaryClosingResult {
  const { branchId, month } = raw;
  const monthStart = `${month}-01`;
  const [yearNum, monthNum] = month.split("-").map(Number);
  const lastDay = new Date(yearNum, monthNum, 0).getDate();
  const monthEnd = `${month}-${String(lastDay).padStart(2, "0")}`;

  const branchEmployees = (raw.employees || []).filter(
    (emp) => emp.branchId === branchId && emp.status === "active"
  );

  const monthAttendance = (raw.attendance || []).filter(
    (rec) =>
      rec.branchId === branchId &&
      rec.attendanceDate >= monthStart &&
      rec.attendanceDate <= monthEnd
  );

  const monthSchedules = (raw.schedules || []).filter(
    (s: any) =>
      s.branchId === branchId &&
      s.scheduleDate >= monthStart &&
      s.scheduleDate <= monthEnd
  );

  const signedReports = (raw.signedTimesheets || []).filter(
    (r: any) => r.report && r.report.branchId === branchId && r.report.status === "finalized"
  );

  const deductions = raw.deductions || [];

  // ===== Lookup maps for matching =====
  const employeeLookup = new Map<string, number>();
  const normalizeName = (s: any) =>
    String(s || "")
      .replace(/[\u064B-\u0652\u0670]/g, "") // إزالة التشكيل
      .replace(/\u0640/g, "") // إزالة التطويل ـ
      .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627") // أ إ آ ٱ -> ا
      .replace(/\u0629/g, "\u0647") // ة -> ه
      .replace(/\u0649/g, "\u064A") // ى -> ي
      .replace(/\u0624/g, "\u0648") // ؤ -> و
      .replace(/\u0626/g, "\u064A") // ئ -> ي
      .replace(/\s+/g, "") // إزالة كل المسافات (عبد الله = عبدالله)
      .toLowerCase();
  // اسم مُوحَّد -> قائمة معرّفات الموظفين (للكشف عن التطابقات المتعددة الغامضة)
  const nameLookup = new Map<string, number[]>();
  branchEmployees.forEach((emp) => {
    employeeLookup.set(`bid:${emp.id}`, emp.id);
    employeeLookup.set(`bid:${String(emp.id)}`, emp.id);
    employeeLookup.set(`eid:${emp.id.toString()}`, emp.id);
    employeeLookup.set(`eid:branch_emp_${emp.id}`, emp.id);
    if (emp.employeeNumber) {
      employeeLookup.set(`enum:${emp.employeeNumber}`, emp.id);
      employeeLookup.set(`enum:${String(emp.employeeNumber).trim()}`, emp.id);
    }
    if (emp.linkedUserId) {
      employeeLookup.set(`eid:${emp.linkedUserId}`, emp.id);
    }
    if (emp.employeeName) {
      const nk = normalizeName(emp.employeeName);
      if (nk) {
        const arr = nameLookup.get(nk);
        if (arr) {
          if (!arr.includes(emp.id)) arr.push(emp.id);
        } else {
          nameLookup.set(nk, [emp.id]);
        }
      }
    }
  });

  // مطابقة بالاسم فقط عند وجود موظف واحد مطابق (تجنّب الإسناد الخاطئ عند تشابه الأسماء)
  const matchByName = (name: any): number | null => {
    const k = normalizeName(name);
    if (!k) return null;
    const arr = nameLookup.get(k);
    return arr && arr.length === 1 ? arr[0] : null;
  };

  const matchEmployee = (rec: any): number | null => {
    if (rec.branchEmployeeId !== null && rec.branchEmployeeId !== undefined) {
      const k = `bid:${rec.branchEmployeeId}`;
      if (employeeLookup.has(k)) return employeeLookup.get(k)!;
    }
    if (rec.employeeId) {
      const k = `eid:${rec.employeeId}`;
      if (employeeLookup.has(k)) return employeeLookup.get(k)!;
    }
    const employeeNumber = rec.employeeNumber;
    if (employeeNumber) {
      const k = `enum:${String(employeeNumber).trim()}`;
      if (employeeLookup.has(k)) return employeeLookup.get(k)!;
    }
    if (rec.employeeName) {
      const id = matchByName(rec.employeeName);
      if (id !== null) return id;
    }
    return null;
  };

  const matchScheduleEmployee = (s: any): number | null => {
    if (s.branchEmployeeId !== null && s.branchEmployeeId !== undefined) {
      const k = `bid:${s.branchEmployeeId}`;
      if (employeeLookup.has(k)) return employeeLookup.get(k)!;
    }
    if (s.employeeId) {
      const k = `eid:${s.employeeId}`;
      if (employeeLookup.has(k)) return employeeLookup.get(k)!;
    }
    if (s.employeeName) {
      const id = matchByName(s.employeeName);
      if (id !== null) return id;
    }
    return null;
  };

  // Index signed (finalized) timesheet reports → employee id, keep most recent
  const signedByEmpId = new Map<number, { report: any; entries: any[] }>();
  signedReports.forEach((r: any) => {
    const rep = r.report;
    let empId: number | null = null;
    if (rep.branchEmployeeId !== null && rep.branchEmployeeId !== undefined) {
      const k = `bid:${rep.branchEmployeeId}`;
      if (employeeLookup.has(k)) empId = employeeLookup.get(k)!;
    }
    if (empId === null && rep.employeeId) {
      const k = `eid:${rep.employeeId}`;
      if (employeeLookup.has(k)) empId = employeeLookup.get(k)!;
    }
    if (empId === null) return;
    const existing = signedByEmpId.get(empId);
    if (!existing) {
      signedByEmpId.set(empId, r);
    } else {
      const ts = rep.managerSignedAt || rep.updatedAt || rep.createdAt || "";
      const tsExisting =
        existing.report.managerSignedAt || existing.report.updatedAt || existing.report.createdAt || "";
      if (ts > tsExisting) signedByEmpId.set(empId, r);
    }
  });

  const scheduledHoursOf = (s: any): number => {
    if (!s.startTime || !s.endTime || s.isOff) return 0;
    const [sh, sm] = String(s.startTime).split(":").map(Number);
    const [eh, em] = String(s.endTime).split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60; // overnight shift
    const breakMin = Number(s.breakDuration) || 0;
    mins = Math.max(0, mins - breakMin);
    return mins / 60;
  };

  // ===== Unlinked attendance =====
  const unlinkedList: any[] = [];
  monthAttendance.forEach((rec) => {
    if (matchEmployee(rec) === null) unlinkedList.push(rec);
  });
  const unlinkedSummary = {
    totalRecords: unlinkedList.length,
    presentRecords: unlinkedList.filter((r) => r.status === "present" || r.status === "late").length,
    totalHours: unlinkedList.reduce((sum, r) => sum + (Number(r.workingHours) || 0), 0),
  };

  const todayLocal = todayRiyadh();
  const warnings: SalaryClosingWarning[] = [];

  const lines: SalaryClosingLine[] = branchEmployees.map((emp) => {
    const empSchedules = monthSchedules.filter((s: any) => matchScheduleEmployee(s) === emp.id);
    const empAttendance = monthAttendance.filter((a) => matchEmployee(a) === emp.id);
    const attendanceByDate = new Map<string, any>();
    empAttendance.forEach((a) => attendanceByDate.set(a.attendanceDate, a));

    const lateDays = empAttendance.filter((a) => a.status === "late").length;

    const presentDates: string[] = [];
    const absentDatesExplicit: string[] = [];
    const absentDatesMissing: string[] = [];
    const offDates: string[] = [];

    let presentDays = 0;
    let absentDays = 0;
    let offDays = 0;
    let scheduledWorkDays = 0;
    let scheduledHoursTotal = 0;
    let totalHours = 0;
    let dataSource: "signed_timesheet" | "schedule_attendance" | "attendance_only" = "attendance_only";

    const signed = signedByEmpId.get(emp.id);

    if (signed && signed.entries.length > 0) {
      dataSource = "signed_timesheet";
      const entries = signed.entries.filter((e: any) => e.date >= monthStart && e.date <= monthEnd);
      entries.forEach((e: any) => {
        if (e.isOff || e.status === "day_off") {
          offDays++;
          offDates.push(e.date);
          return;
        }
        scheduledWorkDays++;
        scheduledHoursTotal += Number(e.scheduledHours) || 0;
        if (e.status === "present" || e.status === "late") {
          presentDays++;
          presentDates.push(e.date);
          totalHours += Number(e.actualHours) || Number(e.scheduledHours) || 0;
        } else if (e.status === "absent") {
          absentDays++;
          absentDatesExplicit.push(e.date);
        }
      });
    } else if (empSchedules.length > 0) {
      dataSource = "schedule_attendance";
      offDays = empSchedules.filter((s: any) => s.isOff === true).length;
      scheduledWorkDays = empSchedules.filter((s: any) => s.isOff !== true).length;
      scheduledHoursTotal = empSchedules.reduce((sum: number, s: any) => sum + scheduledHoursOf(s), 0);
      empSchedules.forEach((s: any) => {
        if (s.isOff) offDates.push(s.scheduleDate);
      });

      empSchedules.forEach((s: any) => {
        if (s.isOff) return;
        const att = attendanceByDate.get(s.scheduleDate);
        if (att && (att.status === "present" || att.status === "late")) {
          presentDays++;
          totalHours += Number(att.workingHours) || scheduledHoursOf(s);
          presentDates.push(s.scheduleDate);
        } else if (att && att.status === "absent") {
          absentDays++;
          absentDatesExplicit.push(s.scheduleDate);
        } else if (!att) {
          if (s.scheduleDate <= todayLocal) {
            absentDays++;
            absentDatesMissing.push(s.scheduleDate);
          }
        }
      });

      empAttendance.forEach((a) => {
        const isScheduled = empSchedules.some((s: any) => s.scheduleDate === a.attendanceDate);
        if (!isScheduled && (a.status === "present" || a.status === "late")) {
          presentDays++;
          totalHours += Number(a.workingHours) || 0;
          presentDates.push(a.attendanceDate);
        }
      });
    } else {
      dataSource = "attendance_only";
      presentDays = empAttendance.filter((a) => a.status === "present" || a.status === "late").length;
      absentDays = empAttendance.filter((a) => a.status === "absent").length;
      totalHours = empAttendance.reduce((sum, a) => sum + (Number(a.workingHours) || 0), 0);
      empAttendance.forEach((a) => {
        if (a.status === "present" || a.status === "late") presentDates.push(a.attendanceDate);
        else if (a.status === "absent") absentDatesExplicit.push(a.attendanceDate);
      });
    }

    presentDates.sort();
    absentDatesExplicit.sort();
    absentDatesMissing.sort();
    offDates.sort();

    const baseSalary = emp.salary || 0;
    const housingAllowance = emp.housingAllowance || 0;
    const allowances =
      housingAllowance +
      (emp.transportAllowance || 0) +
      (emp.foodAllowance || 0) +
      (emp.otherAllowances || 0);
    const grossSalary = baseSalary + allowances;

    // التأمينات الاجتماعية (تصحيح الوعاء): الأساسي + السكن، بحد أقصى 45,000
    const storedInsurance = emp.socialInsuranceDeduction || 0;
    const gosiWage = Math.min(baseSalary + housingAllowance, GOSI_WAGE_CAP);
    const socialInsurance =
      emp.nationality === "سعودي"
        ? storedInsurance > 0
          ? storedInsurance
          : Math.round(gosiWage * GOSI_EMPLOYEE_RATE)
        : 0;

    const dailyRate = grossSalary / 30;

    // إذا الموظف ما داوم ولا يوم في الشهر → غياب الشهر كامل (راتب = 0) مع تحذير
    const noWorkAtAll =
      presentDays === 0 && scheduledWorkDays === 0 && offDays === 0 && empAttendance.length === 0;
    const effectiveAbsentDays = noWorkAtAll ? 30 : absentDays;
    const absenceDeduction = noWorkAtAll
      ? round2(grossSalary - socialInsurance)
      : round2(absentDays * dailyRate);

    const empDeductions = deductions.filter((d) => d.branchEmployeeId === emp.id);
    const manualDeductionsTotal = round2(empDeductions.reduce((sum, d) => sum + (d.amount || 0), 0));

    const netBeforeManual = noWorkAtAll
      ? 0
      : round2(grossSalary - socialInsurance - absenceDeduction);
    const netSalary = Math.max(0, round2(netBeforeManual - manualDeductionsTotal));

    if (noWorkAtAll) {
      warnings.push({
        branchEmployeeId: emp.id,
        employeeName: emp.employeeName,
        code: "no_work_at_all",
        message: `الموظف "${emp.employeeName}" بدون أي بيانات حضور/جدول/تايم شيت لهذا الشهر — سيُحتسب الشهر كاملاً غياباً (الراتب = 0). تأكد من رفع بياناته قبل الإغلاق.`,
      });
    }
    if (!emp.bankName && !emp.bankAccountNumber) {
      warnings.push({
        branchEmployeeId: emp.id,
        employeeName: emp.employeeName,
        code: "missing_bank",
        message: `الموظف "${emp.employeeName}" ليس له حساب بنكي مسجّل — لن يظهر في ملف التحويل البنكي.`,
      });
    }

    return {
      id: emp.id,
      branchEmployeeId: emp.id,
      employeeNumber: emp.employeeNumber ?? null,
      employeeName: emp.employeeName,
      jobTitle: emp.jobTitle,
      nationality: emp.nationality,
      bankName: emp.bankName || "",
      bankAccountNumber: emp.bankAccountNumber || "",
      presentDays,
      absentDays: effectiveAbsentDays,
      offDays,
      scheduledWorkDays,
      scheduledHours: Math.round(scheduledHoursTotal * 10) / 10,
      lateDays,
      totalHours: Math.round(totalHours * 10) / 10,
      baseSalary,
      allowances,
      grossSalary,
      dailyRate: round2(dailyRate),
      absenceDeduction,
      socialInsurance,
      manualDeductions: empDeductions.map((d) => ({
        type: d.type,
        amount: d.amount,
        description: d.description ?? null,
      })),
      manualDeductionsTotal,
      netSalary,
      dataSource,
      noWorkAtAll,
      presentDates,
      absentDates: [...absentDatesExplicit, ...absentDatesMissing].sort(),
      absentDatesExplicit: [...absentDatesExplicit].sort(),
      absentDatesMissing: [...absentDatesMissing].sort(),
      offDates,
    };
  });

  const totals: SalaryClosingTotals = {
    employeeCount: lines.length,
    totalBase: round2(lines.reduce((s, e) => s + e.baseSalary, 0)),
    totalAllowances: round2(lines.reduce((s, e) => s + e.allowances, 0)),
    totalGross: round2(lines.reduce((s, e) => s + e.grossSalary, 0)),
    totalAbsenceDeduction: round2(lines.reduce((s, e) => s + e.absenceDeduction, 0)),
    totalSocialInsurance: round2(lines.reduce((s, e) => s + e.socialInsurance, 0)),
    totalManualDeductions: round2(lines.reduce((s, e) => s + e.manualDeductionsTotal, 0)),
    totalNet: round2(lines.reduce((s, e) => s + e.netSalary, 0)),
  };

  return { lines, totals, unlinked: unlinkedList, unlinkedSummary, warnings };
}
