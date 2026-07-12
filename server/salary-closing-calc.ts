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
  leaveRequests?: any[];
  attendanceAdjustments?: any[];
}

export interface SalaryClosingLine {
  id: number | null;
  branchEmployeeId: number | null;
  employeeNumber: string | null;
  employeeName: string;
  jobTitle: string;
  department: string | null;
  employeeStatus: string; // active | inactive | terminated | on_leave — حالة الموظف وقت الاحتساب
  nationality: string;
  iqamaNumber: string | null;
  bankName: string;
  bankAccountNumber: string;
  presentDays: number;
  originalPresentDays: number | null;
  attendanceAdjustmentReason: string | null;
  attendanceAdjustmentBy: string | null;
  absentDays: number;
  offDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  unpaidDays: number;
  leaveBreakdown: Array<{ type: string; days: number; paid: boolean }>;
  /** أيام الإجازة المرضية المدفوعة بـ 75% ضمن الشهر (المادة 117) */
  sickThreeQuarterDays: number;
  /** أيام الإجازة المرضية بدون أجر ضمن الشهر (المادة 117) */
  sickUnpaidDays: number;
  /** خصم الإجازة المرضية = 25% × أيام الـ75% × قيمة اليوم (أيام "بدون أجر" تدخل ضمن خصم الغياب) */
  sickLeaveDeduction: number;
  scheduledWorkDays: number;
  scheduledHours: number;
  lateDays: number;
  totalHours: number;
  baseSalary: number;
  housingAllowance: number;
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
  totalSickLeaveDeduction: number;
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// إضافة عدد من الأيام لتاريخ بصيغة YYYY-MM-DD (بتوقيت UTC لتجنّب انزياح المنطقة الزمنية)
function addDaysISO(iso: string, n: number): string {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// أنواع الإجازات المدفوعة (تُحتسب ضمن أيام الصرف). الوحيدة غير المدفوعة هي "بدون راتب".
function isPaidLeaveType(t: string): boolean {
  return t !== "unpaid";
}

// عدد الأيام بين تاريخين ISO (بدون احتساب اليومين معاً — فرق بسيط)
function diffDaysISO(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
}

/**
 * نسبة أجر يوم الإجازة المرضية حسب المادة 117 من نظام العمل السعودي:
 * أول 30 يوماً (تراكمياً في السنة) بأجر كامل، ثم 60 يوماً بـ 75%، ثم بدون أجر.
 * نعتمد على sickTierBreakdown المحفوظ عند اعتماد الطلب (usedBefore + year).
 * إن لم يوجد التفصيل (طلبات قديمة) نُبقي السلوك السابق: أجر كامل.
 */
function sickDayPayFraction(lr: any, date: string): number {
  const b = lr?.sickTierBreakdown;
  if (!b || typeof b.usedBefore !== "number" || !b.year) return 1;
  // اليوم خارج سنة التفصيل (إجازة عابرة للسنة): تبدأ عدّادات السنة الجديدة من الصفر
  const dayYear = Number(date.slice(0, 4));
  let cumIndex: number;
  if (dayYear === Number(b.year)) {
    const yearStart = `${b.year}-01-01`;
    const leaveStartInYear = lr.startDate > yearStart ? lr.startDate : yearStart;
    cumIndex = Number(b.usedBefore) + diffDaysISO(leaveStartInYear, date);
  } else if (dayYear > Number(b.year)) {
    // سنة جديدة: العدّاد يبدأ من أول يوم في السنة الجديدة ضمن هذه الإجازة
    cumIndex = diffDaysISO(`${dayYear}-01-01`, date < lr.startDate ? lr.startDate : date);
    cumIndex = Math.max(0, Math.min(cumIndex, diffDaysISO(`${dayYear}-01-01`, date)));
  } else {
    return 1;
  }
  if (cumIndex < 30) return 1;
  if (cumIndex < 90) return 0.75;
  return 0;
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

  // جميع موظفي الفرع بكل الحالات — سنحدد لاحقاً من يدخل التقرير:
  // النشطون دائماً + أي موظف غير نشط له دوام فعلي (حضور/تايم شيت/إجازة معتمدة) خلال الشهر
  const allBranchEmployees = (raw.employees || []).filter(
    (emp) => emp.branchId === branchId
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

  // تعديلات أيام الحضور اليدوية (مفهرسة حسب معرّف الموظف)
  const adjustmentByEmp = new Map<number, any>();
  (raw.attendanceAdjustments || []).forEach((a: any) => {
    if (a && a.branchEmployeeId !== null && a.branchEmployeeId !== undefined) {
      adjustmentByEmp.set(Number(a.branchEmployeeId), a);
    }
  });

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
  allBranchEmployees.forEach((emp) => {
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

  // من يدخل التقرير: النشطون دائماً + غير النشطين الذين لهم دوام فعلي خلال الشهر
  // (سجلات حضور، أو تايم شيت موقّع، أو إجازة معتمدة متقاطعة مع الشهر)
  const empIdsWithWork = new Set<number>();
  monthAttendance.forEach((rec) => {
    const id = matchEmployee(rec);
    if (id !== null) empIdsWithWork.add(id);
  });
  signedByEmpId.forEach((r, empId) => {
    if ((r.entries || []).length > 0) empIdsWithWork.add(empId);
  });
  (raw.leaveRequests || []).forEach((lr: any) => {
    if (!lr || lr.status !== "approved" || lr.branchEmployeeId === null || lr.branchEmployeeId === undefined) return;
    // تحقق دفاعي: الفرع نفسه + تقاطع فعلي مع الشهر (البيانات القادمة مفلترة مسبقاً لكن نعيد التحقق)
    if (lr.branchId && lr.branchId !== branchId) return;
    if (lr.startDate && lr.endDate && (String(lr.startDate) > monthEnd || String(lr.endDate) < `${month}-01`)) return;
    empIdsWithWork.add(Number(lr.branchEmployeeId));
  });
  const branchEmployees = allBranchEmployees.filter(
    (emp) => emp.status === "active" || empIdsWithWork.has(emp.id)
  );

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

    // ===== إعادة التصنيف اليومي على مستوى الشهر بالكامل =====
    // القاعدة (المعتمدة من المستخدم): يُصرف للموظف مقابل أيام الحضور + الراحات
    // الأسبوعية + الإجازات المدفوعة فقط. أي يوم آخر في الشهر (غياب/بدون تسجيل/
    // إجازة بدون راتب) يُخصم بقيمة اليوم. نأخذ بعين الاعتبار الأيام حتى تاريخ اليوم
    // فقط (لا نخصم أياماً مستقبلية ضمن الشهر الجاري).
    const presentSet = new Set(presentDates);
    const offSet = new Set(offDates);
    const absentExplicitSet = new Set(absentDatesExplicit);

    // خريطة الإجازات المصرّح بها (المعتمدة) لكل يوم ضمن الشهر
    const empLeaves = (raw.leaveRequests || []).filter(
      (lr: any) => lr.branchEmployeeId === emp.id && lr.status === "approved"
    );
    const leaveByDate = new Map<string, any>();
    empLeaves.forEach((lr: any) => {
      let d = lr.startDate < monthStart ? monthStart : lr.startDate;
      const end = lr.endDate > monthEnd ? monthEnd : lr.endDate;
      let guard = 0;
      while (d <= end && guard < 400) {
        if (!leaveByDate.has(d)) leaveByDate.set(d, lr);
        d = addDaysISO(d, 1);
        guard++;
      }
    });

    // آخر يوم يُحتسب: نهاية الشهر إن كان قد انقضى، وإلا تاريخ اليوم
    const consideredEnd = monthEnd <= todayLocal ? monthEnd : todayLocal;

    let presentDaysCalc = 0;
    let weeklyRestDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let unpaidDays = 0;
    let sickThreeQuarterDays = 0;
    let sickUnpaidDays = 0;
    const leaveCounts = new Map<string, number>();
    const unpaidNonLeaveDates: string[] = [];

    if (consideredEnd >= monthStart) {
      let d = monthStart;
      let guard = 0;
      while (d <= consideredEnd && guard < 400) {
        if (presentSet.has(d)) {
          presentDaysCalc++;
        } else {
          const lrDay = leaveByDate.get(d);
          const lt = lrDay?.leaveType as string | undefined;
          if (lrDay && lt) {
            leaveCounts.set(lt, (leaveCounts.get(lt) || 0) + 1);
            if (lt === "sick") {
              // المادة 117: كامل / 75% / بدون أجر حسب الرصيد التراكمي في السنة
              const f = sickDayPayFraction(lrDay, d);
              if (f === 0) {
                sickUnpaidDays++;
                unpaidLeaveDays++;
                unpaidDays++;
              } else {
                paidLeaveDays++;
                if (f === 0.75) sickThreeQuarterDays++;
              }
            } else if (isPaidLeaveType(lt)) {
              paidLeaveDays++;
            } else {
              unpaidLeaveDays++;
              unpaidDays++;
            }
          } else if (offSet.has(d)) {
            weeklyRestDays++;
          } else {
            // غياب صريح أو يوم غير مُسجّل (لا حضور ولا راحة ولا إجازة) → يُخصم
            unpaidDays++;
            unpaidNonLeaveDates.push(d);
          }
        }
        d = addDaysISO(d, 1);
        guard++;
      }
    }

    const leaveBreakdown = Array.from(leaveCounts.entries())
      .map(([type, days]) => ({ type, days, paid: isPaidLeaveType(type) }))
      .sort((a, b) => b.days - a.days);

    // فصل الأيام المخصومة (غير الإجازات) إلى: غياب صريح مُسجّل + أيام ناقصة/غير مجدولة
    const absentDatesExplicitFinal = unpaidNonLeaveDates.filter((d) => absentExplicitSet.has(d)).sort();
    const absentDatesMissingFinal = unpaidNonLeaveDates.filter((d) => !absentExplicitSet.has(d)).sort();

    // ===== تطبيق تعديل أيام الحضور اليدوي (إن وُجد) =====
    // الأدمن/مدير الموارد البشرية يحدّد إجمالي أيام حضور جديد. الفرق (delta) يُحوّل
    // أياماً من "مخصومة" إلى "مدفوعة" (أو العكس)، فيتغيّر خصم الغياب والصافي تلقائياً.
    let effectivePresentDays = presentDaysCalc;
    let effectiveUnpaidDays = unpaidDays;
    let absentDaysDisplayCalc = unpaidNonLeaveDates.length;
    let originalPresentDays: number | null = null;
    let attendanceAdjustmentReason: string | null = null;
    let attendanceAdjustmentBy: string | null = null;

    const adj = adjustmentByEmp.get(emp.id);
    if (adj && adj.adjustedPresentDays !== null && adj.adjustedPresentDays !== undefined) {
      originalPresentDays = presentDaysCalc;
      effectivePresentDays = Number(adj.adjustedPresentDays);
      attendanceAdjustmentReason = adj.reason ?? null;
      attendanceAdjustmentBy = adj.createdByName ?? null;
      const delta = effectivePresentDays - presentDaysCalc;
      // عند الزيادة: نحوّل أياماً مخصومة إلى مدفوعة (لا تقل عن صفر)
      // عند النقصان: نزيد الأيام المخصومة
      effectiveUnpaidDays = Math.max(0, unpaidDays - delta);
      absentDaysDisplayCalc = Math.max(0, absentDaysDisplayCalc - delta);
    }

    const baseSalary = emp.salary || 0;
    const housingAllowance = emp.housingAllowance || 0;
    const allowances =
      housingAllowance +
      (emp.transportAllowance || 0) +
      (emp.foodAllowance || 0) +
      (emp.otherAllowances || 0);
    const grossSalary = baseSalary + allowances;

    // التأمينات الاجتماعية: تُؤخذ حصراً من بيانات الموظف (حقل خصم التأمينات الاجتماعية).
    // لا يتم احتسابها تلقائياً — إن لم تُسجَّل قيمة في ملف الموظف فلا يوجد خصم تأمينات،
    // حتى لو كان الموظف سعودياً. هذا يضمن تطابق الكشف مع بيانات كل موظف بدقة.
    const socialInsurance = round2(emp.socialInsuranceDeduction || 0);

    const dailyRate = grossSalary / 30;

    // الخصم = (أيام غير مدفوعة) × قيمة اليوم. الأيام غير المدفوعة تشمل: الغياب،
    // الأيام غير المسجّلة (لم يحضرها ولم تكن راحة ولا إجازة مدفوعة)، والإجازات بدون راتب،
    // وأيام الإجازة المرضية التي تجاوزت 90 يوماً (بدون أجر حسب المادة 117).
    // نستخدم القيمة بعد تطبيق تعديل أيام الحضور اليدوي (إن وُجد).
    const absenceDeduction = round2(effectiveUnpaidDays * dailyRate);

    // خصم الإجازة المرضية (المادة 117): أيام الشريحة الثانية تُدفع 75% → يُخصم 25% من قيمة اليوم
    const sickLeaveDeduction = round2(sickThreeQuarterDays * 0.25 * dailyRate);

    // غياب صريح/أيام مخصومة (لأغراض العرض فقط — لا يشمل أيام الإجازات)
    const absentDaysDisplay = absentDaysDisplayCalc;

    // إذا الموظف ما عنده أي بيانات لهذا الشهر → ننبّه (سيُحتسب الشهر كاملاً غياباً)
    const noWorkAtAll =
      empAttendance.length === 0 &&
      empSchedules.length === 0 &&
      (!signed || signed.entries.length === 0) &&
      empLeaves.length === 0;

    const empDeductions = deductions.filter((d) => d.branchEmployeeId === emp.id);
    const manualDeductionsTotal = round2(empDeductions.reduce((sum, d) => sum + (d.amount || 0), 0));

    const netBeforeManual = round2(grossSalary - socialInsurance - absenceDeduction - sickLeaveDeduction);
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
      department: emp.department ?? null,
      employeeStatus: emp.status || "active",
      nationality: emp.nationality,
      iqamaNumber: emp.iqamaNumber ?? null,
      bankName: emp.bankName || "",
      bankAccountNumber: emp.bankAccountNumber || "",
      presentDays: effectivePresentDays,
      originalPresentDays,
      attendanceAdjustmentReason,
      attendanceAdjustmentBy,
      absentDays: absentDaysDisplay,
      offDays: weeklyRestDays,
      paidLeaveDays,
      unpaidLeaveDays,
      unpaidDays: effectiveUnpaidDays,
      leaveBreakdown,
      sickThreeQuarterDays,
      sickUnpaidDays,
      sickLeaveDeduction,
      scheduledWorkDays,
      scheduledHours: Math.round(scheduledHoursTotal * 10) / 10,
      lateDays,
      totalHours: Math.round(totalHours * 10) / 10,
      baseSalary,
      housingAllowance: round2(housingAllowance),
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
      absentDates: [...absentDatesExplicitFinal, ...absentDatesMissingFinal].sort(),
      absentDatesExplicit: absentDatesExplicitFinal,
      absentDatesMissing: absentDatesMissingFinal,
      offDates,
    };
  });

  const totals: SalaryClosingTotals = {
    employeeCount: lines.length,
    totalBase: round2(lines.reduce((s, e) => s + e.baseSalary, 0)),
    totalAllowances: round2(lines.reduce((s, e) => s + e.allowances, 0)),
    totalGross: round2(lines.reduce((s, e) => s + e.grossSalary, 0)),
    totalAbsenceDeduction: round2(lines.reduce((s, e) => s + e.absenceDeduction, 0)),
    totalSickLeaveDeduction: round2(lines.reduce((s, e) => s + e.sickLeaveDeduction, 0)),
    totalSocialInsurance: round2(lines.reduce((s, e) => s + e.socialInsurance, 0)),
    totalManualDeductions: round2(lines.reduce((s, e) => s + e.manualDeductionsTotal, 0)),
    totalNet: round2(lines.reduce((s, e) => s + e.netSalary, 0)),
  };

  return { lines, totals, unlinked: unlinkedList, unlinkedSummary, warnings };
}
