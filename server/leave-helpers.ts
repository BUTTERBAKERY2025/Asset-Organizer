import { db } from "./db";
import { leaveRequests, leaveBalances, leaveSettlements, branchEmployees, attendanceRecords, publicHolidays } from "@shared/schema";
import { and, eq, ne, inArray, lte, gte, sql } from "drizzle-orm";

// ============================================================
// مساعدات نظام الإجازات (المراحل 1-3)
// ============================================================

/** عدد الأيام التقويمية بين تاريخين (شامل الطرفين). */
export function isoDaysInclusive(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000);
  return diff < 0 ? 0 : diff + 1;
}

/**
 * يحسب الأيام التقويمية وأيام العمل (باستثناء الجمعة كراحة أسبوعية افتراضية)
 * على الخادم — لا نثق بالعدد المرسل من العميل.
 */
export function computeLeaveDays(start: string, end: string): { totalDays: number; workingDays: number } {
  const total = isoDaysInclusive(start, end);
  if (total <= 0) return { totalDays: 0, workingDays: 0 };
  let working = 0;
  const d = new Date(start + "T00:00:00Z");
  for (let i = 0; i < total && i < 400; i++) {
    if (d.getUTCDay() !== 5) working++; // 5 = الجمعة
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return { totalDays: total, workingDays: working };
}

/** يجلب أيام العطلات الرسمية المفعّلة المتقاطعة مع فترة معيّنة كمجموعة تواريخ YYYY-MM-DD. */
export async function getHolidayDatesInRange(start: string, end: string): Promise<Set<string>> {
  const rows = await db
    .select({ startDate: publicHolidays.startDate, endDate: publicHolidays.endDate })
    .from(publicHolidays)
    .where(and(
      eq(publicHolidays.isActive, true),
      lte(publicHolidays.startDate, end),
      gte(publicHolidays.endDate, start),
    ));
  const set = new Set<string>();
  for (const h of rows) {
    const from = h.startDate > start ? h.startDate : start;
    const to = h.endDate < end ? h.endDate : end;
    const n = isoDaysInclusive(from, to);
    const d = new Date(from + "T00:00:00Z");
    for (let i = 0; i < n && i < 400; i++) {
      set.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return set;
}

/**
 * مثل computeLeaveDays لكن تستثني أيضاً العطلات الرسمية المفعّلة من أيام العمل.
 * العطلة التي تصادف جمعة لا تُحسب مرتين.
 */
export async function computeLeaveDaysWithHolidays(
  start: string,
  end: string,
): Promise<{ totalDays: number; workingDays: number; holidayDays: number }> {
  const total = isoDaysInclusive(start, end);
  if (total <= 0) return { totalDays: 0, workingDays: 0, holidayDays: 0 };
  const holidays = await getHolidayDatesInRange(start, end);
  let working = 0, holidayCount = 0;
  const d = new Date(start + "T00:00:00Z");
  for (let i = 0; i < total && i < 400; i++) {
    const iso = d.toISOString().slice(0, 10);
    const isFriday = d.getUTCDay() === 5;
    const isHoliday = holidays.has(iso);
    if (!isFriday && !isHoliday) working++;
    if (isHoliday && !isFriday) holidayCount++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return { totalDays: total, workingDays: working, holidayDays: holidayCount };
}

// ============================================================
// الإجازة المرضية بمراحل المادة 117 من نظام العمل السعودي:
// 30 يوماً بأجر كامل، ثم 60 يوماً بثلاثة أرباع الأجر، ثم 30 يوماً بدون أجر
// (خلال السنة الواحدة — نعتمد السنة الميلادية بما يتسق مع أرصدة النظام).
// ============================================================
export interface SickTierBreakdown {
  year: number;
  usedBefore: number; // أيام مرضية معتمدة سابقاً في نفس السنة
  fullPayDays: number; // ضمن أول 30 يوماً (أجر كامل)
  threeQuarterPayDays: number; // ضمن 31-90 (ثلاثة أرباع الأجر)
  unpaidDays: number; // ما بعد 90 يوماً (بدون أجر)
}

/**
 * يوزّع أيام إجازة مرضية مطلوبة على مراحل الأجر حسب الرصيد المرضي
 * المستهلك (المعتمد) سابقاً في نفس السنة. يُستثنى الطلب الحالي إن مُرّر excludeId.
 */
export async function getSickTierBreakdown(
  branchEmployeeId: number,
  startDate: string,
  endDate: string,
  excludeId?: number,
): Promise<SickTierBreakdown> {
  const year = Number(startDate.slice(0, 4));
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const conds = [
    eq(leaveRequests.branchEmployeeId, branchEmployeeId),
    eq(leaveRequests.leaveType, "sick"),
    eq(leaveRequests.status, "approved"),
    lte(leaveRequests.startDate, yearEnd),
    gte(leaveRequests.endDate, yearStart),
  ];
  if (excludeId) conds.push(ne(leaveRequests.id, excludeId));
  const prior = await db
    .select({ startDate: leaveRequests.startDate, endDate: leaveRequests.endDate })
    .from(leaveRequests)
    .where(and(...conds));
  // نحسب فقط الأيام الواقعة داخل السنة نفسها (الإجازات العابرة للسنة تُقسّم)
  let usedBefore = 0;
  for (const p of prior) {
    const from = p.startDate > yearStart ? p.startDate : yearStart;
    const to = p.endDate < yearEnd ? p.endDate : yearEnd;
    usedBefore += isoDaysInclusive(from, to);
  }
  const clippedStart = startDate > yearStart ? startDate : yearStart;
  const clippedEnd = endDate < yearEnd ? endDate : yearEnd;
  const requested = isoDaysInclusive(clippedStart, clippedEnd);

  const allocate = (used: number, req: number) => {
    const seg = (cap: number, floor: number) =>
      Math.max(0, Math.min(used + req, cap) - Math.max(used, floor));
    const full = seg(30, 0);
    const threeQuarter = seg(90, 30);
    const unpaid = req - full - threeQuarter;
    return { full, threeQuarter, unpaid: Math.max(0, unpaid) };
  };
  const a = allocate(usedBefore, requested);
  return {
    year,
    usedBefore,
    fullPayDays: a.full,
    threeQuarterPayDays: a.threeQuarter,
    unpaidDays: a.unpaid,
  };
}

/** يبحث عن أي إجازة (معلّقة أو معتمدة) متداخلة زمنياً لنفس الموظف. */
export async function findOverlappingLeave(
  branchEmployeeId: number,
  startDate: string,
  endDate: string,
  excludeId?: number,
) {
  const conds: any[] = [
    eq(leaveRequests.branchEmployeeId, branchEmployeeId),
    inArray(leaveRequests.status, ["pending", "approved"]),
    lte(leaveRequests.startDate, endDate),
    gte(leaveRequests.endDate, startDate),
  ];
  if (excludeId != null) conds.push(ne(leaveRequests.id, excludeId));
  const rows = await db.select().from(leaveRequests).where(and(...conds)).limit(1);
  return rows[0] || null;
}

/**
 * الاستحقاق المقترح حسب الأقدمية (نظام العمل السعودي: 21 يوم، 30 بعد 5 سنوات).
 * عند تمرير السنة: يُحتسب الاستحقاق نسبياً (pro-rata) في سنة التعيين حسب الشهور
 * المتبقية من تاريخ التعيين حتى نهاية السنة، مقرّباً لأقرب نصف يوم.
 */
export function suggestedEntitlement(hireDate?: string | null, year?: number): number {
  if (!hireDate) return 21;
  const h = new Date(hireDate + "T00:00:00Z");
  if (isNaN(h.getTime())) return 21;

  // نقطة القياس للأقدمية: نهاية السنة المطلوبة، أو الآن إذا لم تُمرَّر سنة
  const refTime = year ? Date.UTC(year, 11, 31) : Date.now();
  const years = (refTime - h.getTime()) / (365.25 * 86400000);
  const annual = years >= 5 ? 30 : 21;

  if (!year) return annual;

  const hireYear = h.getUTCFullYear();
  if (hireYear > year) return 0; // تعيين بعد السنة المطلوبة — لا استحقاق
  if (hireYear < year) return annual; // سنة كاملة

  // سنة التعيين: نسبة الأيام المتبقية من السنة (من تاريخ التعيين حتى 31 ديسمبر)
  const yearStart = Date.UTC(year, 0, 1);
  const yearEndExclusive = Date.UTC(year + 1, 0, 1);
  const totalDays = (yearEndExclusive - yearStart) / 86400000;
  const remainingDays = Math.max(0, (yearEndExclusive - h.getTime()) / 86400000);
  const prorated = annual * (remainingDays / totalDays);
  return Math.round(prorated * 2) / 2; // تقريب لأقرب نصف يوم
}

export interface LeaveBalanceSummary {
  branchEmployeeId: number;
  year: number;
  leaveType: string;
  entitledDays: number;
  carriedOverDays: number;
  adjustmentDays: number;
  settledDays: number;
  usedDays: number;
  remainingDays: number;
  note: string | null;
  hasRow: boolean;
}

/**
 * يحسب رصيد الإجازة لموظف/سنة/نوع: المستحق + المرحّل + التعديل − المستخدم.
 * "المستخدم" يُحسب ديناميكياً من الإجازات المعتمدة (بالأيام التقويمية) ضمن السنة.
 */
export async function getLeaveBalanceSummary(
  branchEmployeeId: number,
  year: number,
  leaveType = "annual",
  hireDate?: string | null,
): Promise<LeaveBalanceSummary> {
  // الإجازة بدون راتب لا ترتبط بأي رصيد — لا استحقاق ولا خصم.
  if (leaveType === "unpaid") {
    return {
      branchEmployeeId,
      year,
      leaveType,
      entitledDays: 0,
      carriedOverDays: 0,
      adjustmentDays: 0,
      settledDays: 0,
      usedDays: 0,
      remainingDays: 0,
      note: null,
      hasRow: false,
    };
  }

  const [row] = await db
    .select()
    .from(leaveBalances)
    .where(and(
      eq(leaveBalances.branchEmployeeId, branchEmployeeId),
      eq(leaveBalances.year, year),
      eq(leaveBalances.leaveType, leaveType),
    ));

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  // الإجازات المعتمدة المتداخلة مع السنة المطلوبة (تشمل الإجازات العابرة بين سنتين)
  const approvedLeaves = await db
    .select({ startDate: leaveRequests.startDate, endDate: leaveRequests.endDate })
    .from(leaveRequests)
    .where(and(
      eq(leaveRequests.branchEmployeeId, branchEmployeeId),
      eq(leaveRequests.leaveType, leaveType),
      eq(leaveRequests.status, "approved"),
      lte(leaveRequests.startDate, yearEnd),
      gte(leaveRequests.endDate, yearStart),
    ));

  // نحتسب فقط الأيام التقويمية الواقعة داخل السنة المطلوبة (تقسيم الإجازات العابرة بين سنتين)
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  let usedDays = 0;
  for (const lr of approvedLeaves) {
    const segStart = lr.startDate > yearStart ? lr.startDate : yearStart;
    const segEnd = lr.endDate < yearEnd ? lr.endDate : yearEnd;
    const days = Math.round((new Date(segEnd).getTime() - new Date(segStart).getTime()) / MS_PER_DAY) + 1;
    if (days > 0) usedDays += days;
  }
  const entitledDays = row ? Number(row.entitledDays) : suggestedEntitlement(hireDate, year);
  const carriedOverDays = row ? Number(row.carriedOverDays) : 0;
  const adjustmentDays = row ? Number(row.adjustmentDays) : 0;
  const settledDays = row ? Number((row as any).settledDays ?? 0) : 0;
  const remainingDays = entitledDays + carriedOverDays + adjustmentDays - usedDays - settledDays;

  return {
    branchEmployeeId,
    year,
    leaveType,
    entitledDays,
    carriedOverDays,
    adjustmentDays,
    settledDays,
    usedDays,
    remainingDays,
    note: row?.note ?? null,
    hasRow: !!row,
  };
}

export interface AccruedLeaveBalance {
  branchEmployeeId: number;
  configured: boolean; // هل أُدخلت بيانات الاستحقاق (أيام العقد + نقطة البداية)؟
  annualDays: number; // أيام الإجازة السنوية حسب العقد
  annualDaysSource: "contract" | "suggested"; // من العقد أم مقترح حسب الأقدمية
  openingBalance: number; // الرصيد المرحل عند نقطة البداية
  accrualStart: string | null; // نقطة بداية الاحتساب (تاريخ الرصيد المرحل أو تاريخ التعيين)
  elapsedDays: number; // الأيام المنقضية منذ نقطة البداية حتى اليوم
  accruedToDate: number; // المستحق التراكمي حتى اليوم = المرحل + (المنقضي × السنوي ÷ 365)
  usedToDate: number; // أيام إجازات سنوية معتمدة منقضية بعد نقطة البداية
  upcomingDays: number; // أيام إجازات سنوية معتمدة قادمة (محجوزة من الرصيد)
  settledDays: number; // أيام مصفّاة نقداً بعد نقطة البداية
  remainingDays: number; // المتبقي = المستحق − المستخدم − القادم − المصفّى
}

/**
 * الرصيد التراكمي للإجازة السنوية "حتى تاريخه" (النظام التعاقدي):
 * يبدأ الاحتساب من تاريخ الرصيد المرحل (إن وُجد) وإلا من تاريخ التعيين،
 * ويستحق الموظف يومياً (أيام العقد ÷ 365)، وتُخصم الإجازات السنوية المعتمدة
 * والأيام المصفّاة نقداً الواقعة بعد نقطة البداية.
 */
export interface AccrualEmpInput {
  id: number;
  hireDate?: string | null;
  annualLeaveDays?: number | null;
  leaveOpeningBalance?: number | null;
  leaveOpeningBalanceDate?: string | null;
}

/** حساب صافٍ (بدون استعلامات) — يُستخدم للقوائم الجماعية لتفادي N+1. */
export function computeAccruedLeaveBalance(
  emp: AccrualEmpInput,
  approvedAnnualLeaves: { startDate: string; endDate: string }[],
  activeAnnualSettlements: { settledDays: number | null; settlementDate: string }[],
  todayISO?: string,
): AccruedLeaveBalance {
  const today = todayISO || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  const contractDays = emp.annualLeaveDays != null && Number(emp.annualLeaveDays) > 0 ? Number(emp.annualLeaveDays) : null;
  const annualDays = contractDays ?? suggestedEntitlement(emp.hireDate);
  const openingDate = emp.leaveOpeningBalanceDate && /^\d{4}-\d{2}-\d{2}$/.test(emp.leaveOpeningBalanceDate)
    ? emp.leaveOpeningBalanceDate : null;
  const accrualStart = openingDate || (emp.hireDate && /^\d{4}-\d{2}-\d{2}$/.test(emp.hireDate) ? emp.hireDate : null);
  const openingBalance = openingDate ? Number(emp.leaveOpeningBalance || 0) : 0;
  const configured = contractDays != null && accrualStart != null;

  if (!accrualStart) {
    return {
      branchEmployeeId: emp.id, configured: false, annualDays,
      annualDaysSource: contractDays != null ? "contract" : "suggested",
      openingBalance: 0, accrualStart: null, elapsedDays: 0, accruedToDate: 0,
      usedToDate: 0, upcomingDays: 0, settledDays: 0, remainingDays: 0,
    };
  }

  const MS = 86400000;
  const elapsedDays = Math.max(0, Math.round((new Date(today + "T00:00:00Z").getTime() - new Date(accrualStart + "T00:00:00Z").getTime()) / MS));
  const accruedToDate = Math.round((openingBalance + elapsedDays * (annualDays / 365)) * 100) / 100;

  // نحتسب فقط الأيام الواقعة "بعد" نقطة البداية (الرصيد المرحل يغطي ما قبلها)
  const dayAfterStart = new Date(new Date(accrualStart + "T00:00:00Z").getTime() + MS).toISOString().slice(0, 10);
  let usedToDate = 0;
  let upcomingDays = 0;
  for (const lr of approvedAnnualLeaves) {
    if (lr.endDate < accrualStart) continue;
    const segStart = lr.startDate > dayAfterStart ? lr.startDate : dayAfterStart;
    if (segStart > lr.endDate) continue;
    // الجزء المنقضي (حتى اليوم) والجزء القادم
    const pastEnd = lr.endDate < today ? lr.endDate : today;
    if (segStart <= pastEnd) usedToDate += isoDaysInclusive(segStart, pastEnd);
    const futStart = segStart > today ? segStart : new Date(new Date(today + "T00:00:00Z").getTime() + MS).toISOString().slice(0, 10);
    if (futStart <= lr.endDate) upcomingDays += isoDaysInclusive(futStart, lr.endDate);
  }

  // الأيام المصفّاة نقداً بعد نقطة البداية
  const settledDays = activeAnnualSettlements
    .filter((s) => s.settlementDate > accrualStart)
    .reduce((s, r) => s + Number(r.settledDays || 0), 0);

  const remainingDays = Math.round((accruedToDate - usedToDate - upcomingDays - settledDays) * 100) / 100;

  return {
    branchEmployeeId: emp.id, configured, annualDays,
    annualDaysSource: contractDays != null ? "contract" : "suggested",
    openingBalance, accrualStart, elapsedDays, accruedToDate,
    usedToDate, upcomingDays, settledDays, remainingDays,
  };
}

/** نسخة لموظف واحد (تجلب بياناته بنفسها) — للاستخدام في فحص الاعتماد ونحوه. */
export async function getAccruedLeaveBalance(emp: AccrualEmpInput, todayISO?: string): Promise<AccruedLeaveBalance> {
  const [approved, settlements] = await Promise.all([
    db.select({ startDate: leaveRequests.startDate, endDate: leaveRequests.endDate })
      .from(leaveRequests)
      .where(and(
        eq(leaveRequests.branchEmployeeId, emp.id),
        eq(leaveRequests.leaveType, "annual"),
        eq(leaveRequests.status, "approved"),
      )),
    db.select({ settledDays: leaveSettlements.settledDays, settlementDate: leaveSettlements.settlementDate })
      .from(leaveSettlements)
      .where(and(
        eq(leaveSettlements.branchEmployeeId, emp.id),
        eq(leaveSettlements.leaveType, "annual"),
        eq(leaveSettlements.status, "active"),
      )),
  ]);
  return computeAccruedLeaveBalance(emp, approved, settlements, todayISO);
}

const leaveMarker = (id: number) => `__leave:${id}`;

/** المعرّف المستخدم في سجلات الحضور بما يطابق صيغ القراءة في البوابة. */
function attendanceEmployeeId(emp: { id: number; linkedUserId?: string | null }): string {
  return emp.linkedUserId || `branch_emp_${emp.id}`;
}

/**
 * يُنشئ سجلات حضور بحالة "إجازة" لأيام الإجازة المعتمدة دون المساس بأي سجل
 * حضور قائم (لا يُلغي حضوراً فعلياً). غير متلف.
 */
export async function syncAttendanceForLeave(leave: {
  id: number;
  branchEmployeeId: number;
  branchId: string;
  startDate: string;
  endDate: string;
}): Promise<number> {
  const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, leave.branchEmployeeId));
  if (!emp) return 0;
  const total = isoDaysInclusive(leave.startDate, leave.endDate);
  if (total <= 0) return 0;

  const empIdStr = attendanceEmployeeId(emp);
  const dates: string[] = [];
  const d = new Date(leave.startDate + "T00:00:00Z");
  for (let i = 0; i < total && i < 400; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }

  // السجلات القائمة لتلك الأيام (بأي من صيغ المعرّف الثلاث)
  const existing = await db
    .select({ attendanceDate: attendanceRecords.attendanceDate })
    .from(attendanceRecords)
    .where(and(
      inArray(attendanceRecords.attendanceDate, dates),
      sql`(${attendanceRecords.branchEmployeeId} = ${emp.id} OR ${attendanceRecords.employeeId} = ${empIdStr})`,
    ));
  const taken = new Set(existing.map((r) => r.attendanceDate));

  const toInsert = dates
    .filter((dt) => !taken.has(dt))
    .map((dt) => ({
      employeeId: empIdStr,
      employeeName: emp.employeeName,
      branchId: leave.branchId,
      branchEmployeeId: emp.id,
      attendanceDate: dt,
      status: "on_leave",
      notes: leaveMarker(leave.id),
    }));

  if (toInsert.length === 0) return 0;
  await db.insert(attendanceRecords).values(toInsert as any);
  return toInsert.length;
}

/** يحذف فقط سجلات الحضور التلقائية ("إجازة") المرتبطة بهذه الإجازة. */
export async function reverseAttendanceForLeave(leaveId: number): Promise<number> {
  const deleted = await db
    .delete(attendanceRecords)
    .where(and(
      eq(attendanceRecords.status, "on_leave"),
      eq(attendanceRecords.notes, leaveMarker(leaveId)),
    ))
    .returning({ id: attendanceRecords.id });
  return deleted.length;
}

// ============================================================
// الغياب التلقائي للمتأخرين عن العودة من الإجازة
// ============================================================

const overdueMarker = (id: number) => `__leave_overdue:${id}`;

/** يضيف يوماً واحداً لتاريخ YYYY-MM-DD. */
export function addDaysIso(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** فرق الأيام بين تاريخين (b - a) بالأيام التقويمية. */
export function isoDiffDays(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
}

/**
 * يسجّل غياباً تلقائياً لأيام التأخير عن العودة من الإجازة:
 * من اليوم التالي لنهاية الإجازة وحتى `untilDate` (شامل).
 * لا يمسّ أي سجل حضور قائم (idempotent وغير متلف). بحد أقصى 180 يوماً.
 */
export async function markOverdueAbsences(leave: {
  id: number;
  branchEmployeeId: number;
  branchId: string;
  endDate: string;
}, untilDate: string): Promise<number> {
  const firstAbsent = addDaysIso(leave.endDate, 1);
  if (untilDate < firstAbsent) return 0;
  const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, leave.branchEmployeeId));
  if (!emp) return 0;

  const total = Math.min(isoDaysInclusive(firstAbsent, untilDate), 180);
  const empIdStr = attendanceEmployeeId(emp);
  const dates: string[] = [];
  for (let i = 0; i < total; i++) dates.push(addDaysIso(firstAbsent, i));

  const existing = await db
    .select({ attendanceDate: attendanceRecords.attendanceDate })
    .from(attendanceRecords)
    .where(and(
      inArray(attendanceRecords.attendanceDate, dates),
      sql`(${attendanceRecords.branchEmployeeId} = ${emp.id} OR ${attendanceRecords.employeeId} = ${empIdStr})`,
    ));
  const taken = new Set(existing.map((r) => r.attendanceDate));

  const toInsert = dates
    .filter((dt) => !taken.has(dt))
    .map((dt) => ({
      employeeId: empIdStr,
      employeeName: emp.employeeName,
      branchId: leave.branchId,
      branchEmployeeId: emp.id,
      attendanceDate: dt,
      status: "absent",
      notes: overdueMarker(leave.id),
    }));

  if (toInsert.length === 0) return 0;
  await db.insert(attendanceRecords).values(toInsert as any);
  return toInsert.length;
}

/**
 * يحذف سجلات الغياب التلقائية (المرتبطة بالتأخير عن العودة) اعتباراً من تاريخ معيّن.
 * تُستخدم عند تسجيل المباشرة: أيام ما بعد المباشرة لا تُعتبر غياباً.
 */
export async function clearOverdueAbsencesFrom(leaveId: number, fromDate: string): Promise<number> {
  const deleted = await db
    .delete(attendanceRecords)
    .where(and(
      eq(attendanceRecords.status, "absent"),
      eq(attendanceRecords.notes, overdueMarker(leaveId)),
      gte(attendanceRecords.attendanceDate, fromDate),
    ))
    .returning({ id: attendanceRecords.id });
  return deleted.length;
}

// ============================================================
// نظام الموافقات والاعتمادات — حلّ سلسلة الموافقة المطبّقة للإجازات
// ============================================================
import { approvalWorkflows, approvalWorkflowSteps, users } from "@shared/schema";
import { isNull } from "drizzle-orm";

export interface ResolvedApprovalStep {
  level: number;
  jobTitle: string;
  stepName: string;
}

/**
 * يجلب سلسلة الموافقات المطبّقة على إجازات فرع معيّن:
 * أولاً السلسلة الخاصة بالفرع (مفعّلة)، وإلا السلسلة الافتراضية (branchId = null).
 * يُرجع المراحل مرتبة (بحد أقصى 3 مستويات) أو null إذا لا توجد سلسلة.
 */
export async function getApplicableLeaveChain(
  branchId: string | null | undefined,
): Promise<ResolvedApprovalStep[] | null> {
  let wf: any = null;
  if (branchId) {
    [wf] = await db
      .select()
      .from(approvalWorkflows)
      .where(
        and(
          eq(approvalWorkflows.requestType, "leave"),
          eq(approvalWorkflows.isActive, true),
          eq(approvalWorkflows.branchId, branchId),
        ),
      )
      .limit(1);
  }
  if (!wf) {
    [wf] = await db
      .select()
      .from(approvalWorkflows)
      .where(
        and(
          eq(approvalWorkflows.requestType, "leave"),
          eq(approvalWorkflows.isActive, true),
          isNull(approvalWorkflows.branchId),
        ),
      )
      .limit(1);
  }
  if (!wf) return null;
  const steps = await db
    .select()
    .from(approvalWorkflowSteps)
    .where(eq(approvalWorkflowSteps.workflowId, wf.id))
    .orderBy(approvalWorkflowSteps.stepOrder);
  const usable = steps.filter((s: any) => s.jobTitle).slice(0, 3); // الحد الأقصى 3 مستويات
  if (usable.length === 0) return null;
  return usable.map((s: any, i: number) => ({
    level: i + 1,
    jobTitle: s.jobTitle as string,
    stepName: (s.stepName as string) || `موافقة ${s.jobTitle}`,
  }));
}

/**
 * يحلّ المسمى الوظيفي للمستخدم المعتمِد: من users.jobTitle أولاً،
 * وإلا من ملف الموظف المرتبط (branch_employees.job_title عبر linked_user_id).
 */
/**
 * تطبيع المسمى الوظيفي للمقارنة: إزالة الفراغات الزائدة والتطويل وأداة التعريف
 * "ال" من بداية كل كلمة، حتى لا يفشل الاعتماد بسبب فرق إملائي بسيط
 * ("مدير فرع" مقابل "مدير الفرع").
 */
export function normalizeJobTitle(title?: string | null): string {
  return (title || "")
    .replace(/\u0640/g, "") // تطويل ـ
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^ال/, ""))
    .join(" ");
}

/**
 * الأدوار النظامية المكافئة لمسمى مرحلة الاعتماد: صاحب الدور يعتمد مرحلته حتى
 * لو كان مسماه الوظيفي غير مضبوط حرفياً (المشكلة الشائعة عند الإعداد).
 */
const ROLE_STEP_EQUIV: Record<string, string[]> = {
  branch_manager: ["مدير الفرع", "مدير فرع"],
  operations_manager: ["مدير التشغيل", "مدير تشغيل"],
  hr_manager: ["مدير شؤون الموظفين", "مدير الموارد البشرية"],
};

/** هل يحق للمراجِع اعتماد هذه المرحلة؟ (مطابقة مسمى مطبّعة أو دور نظامي مكافئ) */
export function reviewerMatchesStep(opts: {
  reviewerJobTitle?: string | null;
  reviewerRole?: string | null;
  expectedJobTitle: string;
}): boolean {
  const expected = normalizeJobTitle(opts.expectedJobTitle);
  if (!expected) return true;
  if (normalizeJobTitle(opts.reviewerJobTitle) === expected) return true;
  const equiv = ROLE_STEP_EQUIV[(opts.reviewerRole || "").toLowerCase()] || [];
  return equiv.some((t) => normalizeJobTitle(t) === expected);
}

export async function resolveReviewerJobTitle(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (u?.jobTitle) return u.jobTitle;
  const [be] = await db
    .select()
    .from(branchEmployees)
    .where(eq(branchEmployees.linkedUserId, userId))
    .limit(1);
  return be?.jobTitle || null;
}

// ============================================================
// ترحيل أرصدة الإجازات السنوية (يدوي من الواجهة أو تلقائي من المجدول)
// ============================================================

export interface LeaveCarryoverResult {
  fromYear: number;
  toYear: number;
  leaveType: string;
  carried: number;
  skippedZero: number;
  skippedAccrual: number;
  unchanged: number;
  capped: number;
  details: { employeeName: string; amount: number }[];
}

/**
 * ينفّذ ترحيل أرصدة سنة سابقة إلى السنة التالية (المتبقي > 0 → مرحّل).
 * آمن لإعادة التشغيل: يعيد كتابة "المرحّل" بالقيمة المحسوبة نفسها دون مضاعفة.
 * - maxDays: سقف اختياري لأيام الترحيل لكل موظف (سياسة الشركة).
 * - branchIds: نطاق الفروع المسموح (null = كل الفروع).
 */
export async function runLeaveCarryover(opts: {
  fromYear: number;
  leaveType?: string;
  branchId?: string;
  branchIds?: string[] | null;
  maxDays?: number | null;
  userId?: string;
}): Promise<LeaveCarryoverResult> {
  const leaveType = opts.leaveType || "annual";
  const { fromYear } = opts;
  const toYear = fromYear + 1;
  const maxDays = opts.maxDays != null && opts.maxDays > 0 ? opts.maxDays : null;

  const conds: any[] = [eq(branchEmployees.status, "active")];
  if (opts.branchIds != null) conds.push(inArray(branchEmployees.branchId, opts.branchIds.length ? opts.branchIds : ["__none__"]));
  if (opts.branchId) conds.push(eq(branchEmployees.branchId, opts.branchId));
  const emps = await db
    .select({ id: branchEmployees.id, employeeName: branchEmployees.employeeName, branchId: branchEmployees.branchId, hireDate: branchEmployees.hireDate, annualLeaveDays: branchEmployees.annualLeaveDays })
    .from(branchEmployees)
    .where(and(...conds));

  // إزالة أي وسم ترحيل سابق من الملاحظة حتى لا تتضخم مع تكرار التشغيل
  const stripCarryTag = (note: string | null) =>
    (note || "").split(" | ").filter(s => s && !s.startsWith("ترحيل تلقائي من ")).join(" | ");

  // المرحلة 1: حساب المبالغ (قراءات فقط)
  const plans: { emp: typeof emps[number]; amount: number }[] = [];
  let skippedZero = 0, capped = 0, skippedAccrual = 0;
  for (const emp of emps) {
    // موظف عليه أيام إجازة سنوية بالعقد → رصيده المعتمد يُحسب بالنظام التلقائي
    // (الرصيد الافتتاحي اليدوي في ملفه)، فلا نرحّل له أرقاماً قد تخالف الصحيح
    if (leaveType === "annual" && emp.annualLeaveDays != null && Number(emp.annualLeaveDays) > 0) {
      skippedAccrual++;
      continue;
    }
    const prev = await getLeaveBalanceSummary(emp.id, fromYear, leaveType, emp.hireDate);
    let amount = Math.max(0, prev.remainingDays);
    if (amount <= 0) { skippedZero++; continue; }
    if (maxDays != null && amount > maxDays) { amount = maxDays; capped++; }
    plans.push({ emp, amount });
  }

  // المرحلة 2: كل الكتابات داخل معاملة واحدة — إما تكتمل جميعها أو لا شيء
  let carried = 0, unchanged = 0;
  const details: { employeeName: string; amount: number }[] = [];
  await db.transaction(async (tx) => {
    for (const { emp, amount } of plans) {
      const [existing] = await tx.select().from(leaveBalances).where(and(
        eq(leaveBalances.branchEmployeeId, emp.id),
        eq(leaveBalances.year, toYear),
        eq(leaveBalances.leaveType, leaveType),
      ));
      if (existing) {
        if (Number(existing.carriedOverDays) === amount) { unchanged++; continue; }
        const baseNote = stripCarryTag(existing.note);
        await tx.update(leaveBalances).set({
          carriedOverDays: amount,
          branchId: emp.branchId,
          note: `${baseNote ? baseNote + " | " : ""}ترحيل تلقائي من ${fromYear}: ${amount} يوم`,
          updatedAt: new Date(),
        }).where(eq(leaveBalances.id, existing.id));
      } else {
        await tx.insert(leaveBalances).values({
          branchEmployeeId: emp.id,
          branchId: emp.branchId,
          year: toYear,
          leaveType,
          entitledDays: suggestedEntitlement(emp.hireDate, toYear),
          carriedOverDays: amount,
          adjustmentDays: 0,
          note: `ترحيل تلقائي من ${fromYear}: ${amount} يوم`,
          createdBy: opts.userId,
        });
      }
      carried++;
      if (details.length < 200) details.push({ employeeName: emp.employeeName, amount });
    }
  });

  return { fromYear, toYear, leaveType, carried, skippedZero, skippedAccrual, unchanged, capped, details };
}
