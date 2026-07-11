import { db } from "./db";
import { leaveRequests, leaveBalances, branchEmployees, attendanceRecords, publicHolidays } from "@shared/schema";
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

/** الاستحقاق المقترح حسب الأقدمية (نظام العمل السعودي: 21 يوم، 30 بعد 5 سنوات). */
export function suggestedEntitlement(hireDate?: string | null): number {
  if (!hireDate) return 21;
  const h = new Date(hireDate + "T00:00:00Z");
  if (isNaN(h.getTime())) return 21;
  const years = (Date.now() - h.getTime()) / (365.25 * 86400000);
  return years >= 5 ? 30 : 21;
}

export interface LeaveBalanceSummary {
  branchEmployeeId: number;
  year: number;
  leaveType: string;
  entitledDays: number;
  carriedOverDays: number;
  adjustmentDays: number;
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
  const entitledDays = row ? Number(row.entitledDays) : suggestedEntitlement(hireDate);
  const carriedOverDays = row ? Number(row.carriedOverDays) : 0;
  const adjustmentDays = row ? Number(row.adjustmentDays) : 0;
  const remainingDays = entitledDays + carriedOverDays + adjustmentDays - usedDays;

  return {
    branchEmployeeId,
    year,
    leaveType,
    entitledDays,
    carriedOverDays,
    adjustmentDays,
    usedDays,
    remainingDays,
    note: row?.note ?? null,
    hasRow: !!row,
  };
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
