import { db } from "./db";
import { and, eq, lte, lt, gte, sql, desc } from "drizzle-orm";
import { notificationQueue, reportSchedules, reportRuns, systemNotifications, notificationAutomations, branchEmployees, leaveRequests, notifications, employeeWarnings, employeeDocuments, WARNING_LEVEL_LABELS } from "@shared/schema";
import { sendWhatsAppMessage, sendSMS, isTwilioConfigured } from "./twilio-service";
import { markOverdueAbsences, addDaysIso, runLeaveCarryover } from "./leave-helpers";
import { storage } from "./storage";
import { isNull } from "drizzle-orm";
import { generateReport, type ReportType } from "./report-generator";
import { z } from "zod";

const TICK_MS = 60_000;
const MAX_RETRIES = 3;
const QUEUE_BATCH = 10;
let lastAnniversaryRunDate: string | null = null; // YYYY-MM-DD

let started = false;
let tickRunning = false;

const recipientSchema = z.object({
  phone: z.string().min(6).max(20),
  name: z.string().optional(),
  channels: z.array(z.enum(["whatsapp", "sms"])).optional(),
});
const recipientsSchema = z.array(recipientSchema).min(1).max(50);
export { recipientsSchema };

export function computeNextRun(dayOfMonth: number, hour: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setSeconds(0, 0);
  const target = new Date(d.getFullYear(), d.getMonth(), Math.min(dayOfMonth, lastDay(d.getFullYear(), d.getMonth())), hour, 0, 0);
  if (target.getTime() <= from.getTime()) {
    const nextMonth = d.getMonth() + 1;
    const y = d.getFullYear() + Math.floor(nextMonth / 12);
    const m = nextMonth % 12;
    target.setFullYear(y, m, Math.min(dayOfMonth, lastDay(y, m)));
    target.setHours(hour, 0, 0, 0);
  }
  return target;
}

function lastDay(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function previousPeriodMonth(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function processQueue() {
  if (!isTwilioConfigured()) return;
  const result: any = await db.execute(sql`SELECT * FROM notification_queue WHERE status = 'pending' AND retry_count < ${MAX_RETRIES} ORDER BY created_at LIMIT ${QUEUE_BATCH}`);
  const rows = (result.rows || result) as any[];
  const items = rows.map((r: any) => ({
    id: r.id,
    recipientPhone: r.recipient_phone,
    recipientName: r.recipient_name,
    channel: r.channel,
    message: r.message,
    mediaUrl: r.media_url,
    status: r.status,
    retryCount: r.retry_count,
  }));

  for (const item of items) {
    try {
      let result: { success: boolean; error?: string; messageId?: string };
      if (item.channel === "whatsapp") {
        result = await sendWhatsAppMessage(item.recipientPhone, item.message, item.mediaUrl);
      } else if (item.channel === "sms") {
        result = await sendSMS(item.recipientPhone, item.message);
      } else {
        result = { success: false, error: `Unknown channel: ${item.channel}` };
      }

      if (result.success) {
        await db.update(notificationQueue).set({
          status: "sent",
          sentAt: new Date(),
          lastAttemptAt: new Date(),
          errorMessage: null,
        }).where(eq(notificationQueue.id, item.id));
      } else {
        const newRetry = (item.retryCount || 0) + 1;
        const finalStatus = newRetry >= MAX_RETRIES ? "failed" : "pending";
        await db.update(notificationQueue).set({
          status: finalStatus,
          retryCount: newRetry,
          lastAttemptAt: new Date(),
          errorMessage: result.error || "Send failed",
        }).where(eq(notificationQueue.id, item.id));
      }
    } catch (err: any) {
      console.error(`[scheduler] queue item ${item.id} error:`, err.message);
      const newRetry = (item.retryCount || 0) + 1;
      await db.update(notificationQueue).set({
        status: newRetry >= MAX_RETRIES ? "failed" : "pending",
        retryCount: newRetry,
        lastAttemptAt: new Date(),
        errorMessage: err.message,
      }).where(eq(notificationQueue.id, item.id));
    }
  }
}

export async function executeSchedule(schedule: typeof reportSchedules.$inferSelect, triggeredBy?: string | null): Promise<number> {
  const period = previousPeriodMonth();
  const parsedRecipients = recipientsSchema.safeParse(schedule.recipients);
  if (!parsedRecipients.success) {
    throw new Error(`recipients غير صالح للجدول ${schedule.id}: ${parsedRecipients.error.message}`);
  }
  const recipients = parsedRecipients.data;
  const [run] = await db.insert(reportRuns).values({
    scheduleId: schedule.id,
    periodMonth: period,
    status: "pending",
    recipientsCount: recipients.length,
    sentCount: 0,
    failedCount: 0,
    triggeredBy: triggeredBy || null,
  }).returning();

  try {
    const report = await generateReport(schedule.reportType as ReportType, period, schedule.branchId);
    let queued = 0;
    for (const r of recipients) {
      const channels = r.channels && r.channels.length > 0 ? r.channels : ["whatsapp"];
      for (const ch of channels) {
        await db.insert(notificationQueue).values({
          recipientPhone: r.phone,
          recipientName: r.name || null,
          channel: ch,
          message: report.body,
          status: "pending",
          relatedModule: "monthly_report",
          relatedEntityId: String(run.id),
        });
        queued++;
      }
    }
    await db.update(reportRuns).set({
      status: "sent",
      summary: report.summary,
      messageBody: report.body,
      sentCount: queued,
    }).where(eq(reportRuns.id, run.id));

    const nextRun = computeNextRun(schedule.dayOfMonth, schedule.hour);
    await db.update(reportSchedules).set({
      lastRunAt: new Date(),
      nextRunAt: nextRun,
      updatedAt: new Date(),
    }).where(eq(reportSchedules.id, schedule.id));
    return run.id;
  } catch (err: any) {
    console.error(`[scheduler] schedule ${schedule.id} failed:`, err.message);
    await db.update(reportRuns).set({
      status: "failed",
      errorMessage: err.message,
    }).where(eq(reportRuns.id, run.id));
    throw err;
  }
}

async function processSchedules() {
  const now = new Date();
  const due = await db.select().from(reportSchedules)
    .where(and(
      eq(reportSchedules.isActive, true),
      sql`(${reportSchedules.nextRunAt} IS NULL OR ${reportSchedules.nextRunAt} <= ${now.toISOString()})`,
    ));

  for (const s of due) {
    if (!s.nextRunAt) {
      const nextRun = computeNextRun(s.dayOfMonth, s.hour);
      await db.update(reportSchedules).set({ nextRunAt: nextRun, updatedAt: new Date() }).where(eq(reportSchedules.id, s.id));
      continue;
    }
    try {
      await executeSchedule(s);
    } catch (err: any) {
      console.error(`[scheduler] failed to execute schedule ${s.id}:`, err.message);
    }
  }
}

/**
 * Phase 3: Detect today's work anniversaries and auto-create a greeting notification per
 * employee. Idempotent via notification_automations(automationType, branchEmployeeId, year)
 * unique index. Runs at most once per UTC day.
 */
export async function processAnniversaryGreetings(force = false): Promise<{ created: number; skipped: number }> {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (!force && lastAnniversaryRunDate === todayKey) {
    return { created: 0, skipped: 0 };
  }
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const year = now.getFullYear();

  // hireDate is stored as TEXT (YYYY-MM-DD). Guard against malformed dates with a regex
  // before casting to ::date so a single bad row can't crash the whole query.
  const rows: any = await db.execute(sql`
    SELECT id, employee_name AS full_name, branch_id, hire_date
    FROM branch_employees
    WHERE status = 'active'
      AND hire_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
      AND TO_CHAR(hire_date::date, 'MM-DD') = ${`${month}-${day}`}
      AND hire_date::date < CURRENT_DATE
  `);
  const employees = (rows.rows || rows) as Array<{ id: number; full_name: string; branch_id: string; hire_date: string }>;

  let created = 0;
  let skipped = 0;
  for (const emp of employees) {
    try {
      const hireYear = new Date(emp.hire_date).getFullYear();
      const years = year - hireYear;
      if (years < 1) { skipped++; continue; }

      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 7);

      // Atomic: dedupe + notification + link in a single transaction.
      // If notification insert fails, dedupe row is rolled back so the employee
      // can be retried on the next run (no permanent skip).
      const result = await db.transaction(async (tx) => {
        const dedupe: any = await tx.execute(sql`
          INSERT INTO notification_automations (automation_type, branch_employee_id, year)
          VALUES ('work_anniversary', ${emp.id}, ${year})
          ON CONFLICT (automation_type, branch_employee_id, year) DO NOTHING
          RETURNING id
        `);
        const inserted = (dedupe.rows || dedupe) as any[];
        if (!inserted || inserted.length === 0) return null;

        const [notification] = await tx.insert(systemNotifications).values({
          title: `ذكرى التحاق ${emp.full_name} بفريق Butter Bakery 🏆`,
          content: `نتقدّم بأحرّ التهاني للزميل/ـة ${emp.full_name} بمناسبة مرور ${years} ${years === 1 ? "سنة" : years === 2 ? "سنتين" : years <= 10 ? "سنوات" : "سنة"} على انضمامه/ـا لأسرة Butter Bakery.\nنشكر تفانيكم وإخلاصكم، ونتطلع لمزيد من النجاحات معاً 🌟\n\nمع خالص الشكر،\nإدارة Butter Bakery`,
          messageType: "celebration",
          displayStyle: "modal",
          priority: 3,
          isActive: true,
          targetAllBranches: false,
          targetBranchIds: [emp.branch_id],
          emoji: "🏆",
          effectType: "confetti",
          animationType: "bounce",
          backgroundColor: "#fff5d6",
          textColor: "#4a3500",
          accentColor: "#d4a017",
          soundEnabled: true,
          soundType: "chime",
          endDate,
          autoGenerated: true,
          autoSource: "work_anniversary",
        }).returning();

        await tx.execute(sql`
          UPDATE notification_automations
          SET notification_id = ${notification.id}
          WHERE automation_type = 'work_anniversary'
            AND branch_employee_id = ${emp.id}
            AND year = ${year}
        `);
        return notification;
      });

      if (result) created++; else skipped++;
    } catch (err: any) {
      console.error(`[scheduler] anniversary error for employee ${emp.id}:`, err.message);
      skipped++;
    }
  }

  lastAnniversaryRunDate = todayKey;
  if (created > 0) console.log(`[scheduler] work-anniversary: created ${created}, skipped ${skipped}`);
  return { created, skipped };
}

/**
 * تذكير العودة من الإجازة: للإجازات المعتمدة التي تنتهي اليوم (بتوقيت الرياض)
 * نرسل للموظف تذكيراً بأن العودة للعمل غداً (واتساب + SMS + إشعار داخلي).
 * آمنة للتكرار: تفحص طابور الإشعارات (relatedModule) قبل الإرسال، وتعمل مرة يومياً.
 */
let lastReturnReminderDate: string | null = null; // YYYY-MM-DD (Riyadh)
export async function processReturnReminders(force = false): Promise<{ queued: number; skipped: number }> {
  const todayRiyadh = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  if (!force && lastReturnReminderDate === todayRiyadh) return { queued: 0, skipped: 0 };

  const endingToday = await db
    .select({
      id: leaveRequests.id,
      branchEmployeeId: leaveRequests.branchEmployeeId,
      branchId: leaveRequests.branchId,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
    })
    .from(leaveRequests)
    .where(and(eq(leaveRequests.status, "approved"), eq(leaveRequests.endDate, todayRiyadh)));

  let queued = 0, skipped = 0;
  for (const leave of endingToday) {
    try {
      // منع التكرار: هل سبق إرسال تذكير لهذه الإجازة؟
      const [already] = await db
        .select({ id: notificationQueue.id })
        .from(notificationQueue)
        .where(and(
          eq(notificationQueue.relatedModule, "leave_return_reminder"),
          eq(notificationQueue.relatedEntityId, String(leave.id)),
        ))
        .limit(1);
      if (already) { skipped++; continue; }

      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, leave.branchEmployeeId));
      if (!emp) { skipped++; continue; }

      const title = "تذكير بانتهاء الإجازة";
      const message = `عزيزنا ${emp.employeeName}،\nتنتهي إجازتك اليوم (${leave.endDate})، ونتطلع لعودتك للعمل غداً بإذن الله.\nنتمنى أن تكون قضيت وقتاً طيباً 🌟\nإدارة Butter Bakery`;

      // إشعار داخلي في بوابة الموظف (إن كان له حساب)
      if (emp.linkedUserId) {
        try {
          await db.insert(notifications).values({
            branchId: emp.branchId,
            userId: emp.linkedUserId,
            title,
            message: `تنتهي إجازتك اليوم (${leave.endDate}) — العودة للعمل غداً.`,
            type: "info",
            category: "system",
            priority: "normal",
            linkUrl: "/my-portal",
          });
        } catch (e: any) { console.error("[scheduler] return-reminder in-app failed:", e.message); }
      }

      // إشعار داخلي لإدارة الفرع (بدون userId → يظهر لمستخدمي الفرع) بعودة الموظف غداً
      if (emp.branchId) {
        try {
          await db.insert(notifications).values({
            branchId: emp.branchId,
            userId: null,
            title: "عودة موظف من إجازة",
            message: `ينتهي آخر يوم من إجازة ${emp.employeeName} اليوم (${leave.endDate}) — يُتوقع مباشرته للعمل غداً. لا تنسَ تسجيل المباشرة عند عودته.`,
            type: "info",
            category: "hr",
            priority: "normal",
            linkUrl: "/hr/leaves",
          });
        } catch (e: any) { console.error("[scheduler] return-reminder branch notify failed:", e.message); }
      }

      // واتساب + SMS عبر الطابور (صف لكل قناة) — الفهرس الفريد الجزئي يمنع التكرار حتى مع التزامن
      if (emp.phoneNumber) {
        for (const channel of ["whatsapp", "sms"] as const) {
          await db.insert(notificationQueue).values({
            recipientPhone: emp.phoneNumber,
            recipientName: emp.employeeName,
            channel,
            message,
            relatedModule: "leave_return_reminder",
            relatedEntityId: String(leave.id),
          }).onConflictDoNothing();
        }
        queued++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      console.error(`[scheduler] return-reminder error for leave ${leave.id}:`, err.message);
      skipped++;
    }
  }

  lastReturnReminderDate = todayRiyadh;
  if (queued > 0) console.log(`[scheduler] return-reminders: queued ${queued}, skipped ${skipped}`);
  return { queued, skipped };
}

/**
 * الغياب التلقائي للمتأخرين عن العودة من الإجازة:
 * للإجازات المعتمدة التي انتهت ولم تُسجَّل لها مباشرة العمل بعد،
 * نسجّل غياباً لكل يوم بعد نهاية الإجازة حتى الأمس (بتوقيت الرياض).
 * تعمل مرة يومياً بعد 6 صباحاً، آمنة للتكرار (لا تلمس السجلات القائمة).
 */
let lastOverdueAbsenceDate: string | null = null; // YYYY-MM-DD (Riyadh)
export async function processOverdueLeaveAbsences(force = false): Promise<{ marked: number; leaves: number }> {
  const todayRiyadh = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  if (!force && lastOverdueAbsenceDate === todayRiyadh) return { marked: 0, leaves: 0 };

  // نغطي حتى 180 يوماً للخلف فقط (حد أقصى معقول)
  const minEndDate = addDaysIso(todayRiyadh, -180);
  const yesterday = addDaysIso(todayRiyadh, -1);
  const overdue = await db
    .select({
      id: leaveRequests.id,
      branchEmployeeId: leaveRequests.branchEmployeeId,
      branchId: leaveRequests.branchId,
      endDate: leaveRequests.endDate,
    })
    .from(leaveRequests)
    .where(and(
      eq(leaveRequests.status, "approved"),
      lt(leaveRequests.endDate, todayRiyadh),
      gte(leaveRequests.endDate, minEndDate),
      isNull(leaveRequests.actualReturnDate),
    ));

  let marked = 0, leaves = 0;
  for (const leave of overdue) {
    try {
      // الغياب يُسجَّل حتى الأمس — يوم اليوم قد يباشر فيه الموظف
      const n = await markOverdueAbsences(leave, yesterday);
      if (n > 0) { marked += n; leaves++; }
    } catch (err: any) {
      console.error(`[scheduler] overdue-absence error for leave ${leave.id}:`, err.message);
    }
  }

  lastOverdueAbsenceDate = todayRiyadh;
  if (marked > 0) console.log(`[scheduler] overdue-absences: marked ${marked} days across ${leaves} leaves`);
  return { marked, leaves };
}

/**
 * الترحيل السنوي التلقائي لأرصدة الإجازات: يعمل في يناير (بتوقيت الرياض) مرة واحدة
 * لكل سنة، ويرحّل أرصدة السنة الماضية إلى السنة الجديدة لجميع الفروع.
 * الحماية من التكرار: مفتاح إعداد auto_leave_carryover_<toYear> يُسجَّل بعد النجاح.
 * السقف الاختياري يُقرأ من إعداد leave_carryover_max_days (يُحفظ من واجهة الترحيل اليدوي).
 */
let lastCarryoverCheckDate: string | null = null; // YYYY-MM-DD (Riyadh)
export async function processAnnualLeaveCarryover(force = false): Promise<{ ran: boolean; carried?: number }> {
  const todayRiyadh = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  if (!force && lastCarryoverCheckDate === todayRiyadh) return { ran: false };
  lastCarryoverCheckDate = todayRiyadh;

  const [yearStr, monthStr] = todayRiyadh.split("-");
  const toYear = Number(yearStr);
  if (!force && monthStr !== "01") return { ran: false }; // يناير فقط

  const doneKey = `auto_leave_carryover_${toYear}`;
  const done = await storage.getPortalSetting(doneKey);
  if (done === "done") return { ran: false };

  let maxDays: number | null = null;
  try {
    const capStr = await storage.getPortalSetting("leave_carryover_max_days");
    const cap = Number(capStr);
    if (capStr !== "" && Number.isFinite(cap) && cap > 0) maxDays = cap;
  } catch {}

  const result = await runLeaveCarryover({
    fromYear: toYear - 1,
    leaveType: "annual",
    branchIds: null, // كل الفروع
    maxDays,
  });
  await storage.setPortalSetting(doneKey, "done");
  console.log(`[scheduler] annual leave carryover ${toYear - 1}→${toYear}: carried ${result.carried}, capped ${result.capped}, unchanged ${result.unchanged}`);
  return { ran: true, carried: result.carried };
}

/**
 * تذكير تلقائي بالإنذارات غير الموقَّعة:
 * الإنذار الساري غير الموقَّع الذي مضى على إصداره (أو آخر تذكير له) 3 أيام
 * يُرسَل لصاحبه تذكير واتساب برابط التوقيع — بحد أقصى تذكيرين لكل إنذار،
 * مع إشعار تجميعي لإدارة الموارد البشرية. تعمل مرة يومياً بعد 9 صباحاً بتوقيت الرياض.
 */
const WARNING_REMINDER_MAX = 2;
const WARNING_REMINDER_GAP_DAYS = 3;
let lastWarningReminderDate: string | null = null;

function normalizePhoneIntl(raw: string): string {
  let p = (raw || "").replace(/\D/g, "");
  if (!p) return "";
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("966")) return p;
  if (p.startsWith("05") && p.length === 10) return "966" + p.slice(1);
  if (p.startsWith("5") && p.length === 9) return "966" + p;
  if (p.startsWith("0")) return "966" + p.slice(1);
  return p;
}

export async function processWarningSignatureReminders(force = false): Promise<{ queued: number; skipped: number }> {
  const todayRiyadh = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  if (!force && lastWarningReminderDate === todayRiyadh) return { queued: 0, skipped: 0 };

  const threshold = new Date(Date.now() - WARNING_REMINDER_GAP_DAYS * 86400000);
  const rows = await db
    .select({
      id: employeeWarnings.id,
      level: employeeWarnings.level,
      reason: employeeWarnings.reason,
      publicToken: employeeWarnings.publicToken,
      reminderCount: employeeWarnings.reminderCount,
      branchId: employeeWarnings.branchId,
      employeeName: branchEmployees.employeeName,
      phoneNumber: branchEmployees.phoneNumber,
    })
    .from(employeeWarnings)
    .innerJoin(branchEmployees, eq(employeeWarnings.branchEmployeeId, branchEmployees.id))
    .where(and(
      eq(employeeWarnings.status, "active"),
      isNull(employeeWarnings.signedAt),
      sql`${employeeWarnings.publicToken} IS NOT NULL`,
      lt(employeeWarnings.reminderCount, WARNING_REMINDER_MAX),
      lte(employeeWarnings.createdAt, threshold),
      sql`(${employeeWarnings.lastReminderAt} IS NULL OR ${employeeWarnings.lastReminderAt} <= ${threshold})`,
    ));

  let queued = 0, skipped = 0;
  const baseUrl = process.env.APP_PUBLIC_URL || "https://thebutterbakery.com";
  const remindedByBranch = new Map<string, string[]>();

  for (const w of rows) {
    try {
      const phone = normalizePhoneIntl(w.phoneNumber || "");
      if (!phone) { skipped++; continue; }
      const link = `${baseUrl}/warning/${w.publicToken}`;
      const message = `تذكير من شركة الزبد الأفضل التجارية:\n\nعزيزنا ${w.employeeName}،\nلديكم ${WARNING_LEVEL_LABELS[w.level] || "إنذار"} بشأن: ${w.reason}\nلم يتم توقيعه حتى الآن. يرجى فتح الرابط أدناه للاطلاع والتوقيع إلكترونيًا:\n${link}\n\nإدارة الموارد البشرية`;
      // فهرس فريد جزئي (uq_notification_queue_warning_reminder) يمنع تكرار نفس التذكير
      // حتى مع إعادة تشغيل السيرفر — ولا نستهلك محاولة التذكير إلا إذا أُدرج صف فعلاً.
      const inserted = await db.insert(notificationQueue).values({
        recipientPhone: phone,
        recipientName: w.employeeName,
        channel: "whatsapp",
        message,
        relatedModule: "warning_signature_reminder",
        relatedEntityId: `${w.id}:${(w.reminderCount || 0) + 1}`,
      }).onConflictDoNothing().returning({ id: notificationQueue.id });
      if (inserted.length === 0) { skipped++; continue; }
      await db.update(employeeWarnings)
        .set({ reminderCount: (w.reminderCount || 0) + 1, lastReminderAt: new Date(), updatedAt: new Date() })
        .where(eq(employeeWarnings.id, w.id));
      const arr = remindedByBranch.get(w.branchId) || [];
      arr.push(w.employeeName || "");
      remindedByBranch.set(w.branchId, arr);
      queued++;
    } catch (err: any) {
      console.error(`[scheduler] warning-reminder error for warning ${w.id}:`, err.message);
      skipped++;
    }
  }

  // إشعار تجميعي لإدارة الموارد البشرية عبر جرس الإشعارات (لكل فرع فيه متأخرون)
  for (const [branchId, names] of Array.from(remindedByBranch.entries())) {
    try {
      await db.insert(systemNotifications).values({
        title: "⏰ إنذارات بانتظار التوقيع — تم إرسال تذكير",
        content: `تم اليوم إرسال تذكير واتساب للموظفين التالين لعدم توقيعهم إنذاراتهم خلال ${WARNING_REMINDER_GAP_DAYS} أيام:\n• ${names.join("\n• ")}\n\nيمكن متابعة الحالة من صفحة الإنذارات والمخالفات.`,
        messageType: "announcement",
        displayStyle: "toast",
        priority: 3,
        isActive: true,
        targetAllBranches: false,
        targetBranchIds: [branchId],
        targetRoleIds: ["hr_manager", "admin"],
        autoGenerated: true,
        autoSource: "warning_signature_reminder",
      } as any);
    } catch (e: any) { console.error("[scheduler] warning-reminder HR notify failed:", e.message); }
  }

  lastWarningReminderDate = todayRiyadh;
  if (queued > 0) console.log(`[scheduler] warning-reminders: queued ${queued}, skipped ${skipped}`);
  return { queued, skipped };
}

// ============================================================================
// تنبيهات انتهاء وثائق الموظفين (إقامات/شهادات صحية/عقود/رخص...) — مرة يومياً.
// ينشئ إشعار جرس تجميعياً لكل فرع لمسؤولي HR والأدمن، ويحدّث حالة الوثائق
// (expiring_soon/expired). الحماية من التكرار عبر بوابة تاريخ بالذاكرة + فحص
// إشعار اليوم نفسه في قاعدة البيانات (يصمد أمام إعادة تشغيل السيرفر).
// ============================================================================
const DOC_EXPIRY_WINDOW_DAYS = 30;
const DOC_TYPE_LABELS: Record<string, string> = {
  id_card: "هوية", residence: "إقامة", passport: "جواز سفر", driving_license: "رخصة قيادة",
  health_certificate: "شهادة صحية", work_permit: "رخصة عمل", contract: "عقد عمل", other: "وثيقة",
};
let lastDocExpiryAlertDate: string | null = null;

export async function processDocumentExpiryAlerts(force = false): Promise<{ notified: number }> {
  const todayRiyadh = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
  if (!force && lastDocExpiryAlertDate === todayRiyadh) return { notified: 0 };

  const soonIso = addDaysIso(todayRiyadh, DOC_EXPIRY_WINDOW_DAYS);

  // حدّث حالات الوثائق أولاً حتى تتطابق الصفحات مع التنبيهات
  await db.update(employeeDocuments)
    .set({ status: "expired", updatedAt: new Date() })
    .where(and(
      sql`${employeeDocuments.status} IN ('active','expiring_soon')`,
      sql`${employeeDocuments.expiryDate} IS NOT NULL AND ${employeeDocuments.expiryDate} < ${todayRiyadh}`,
    ));
  await db.update(employeeDocuments)
    .set({ status: "expiring_soon", updatedAt: new Date() })
    .where(and(
      eq(employeeDocuments.status, "active"),
      sql`${employeeDocuments.expiryDate} IS NOT NULL AND ${employeeDocuments.expiryDate} >= ${todayRiyadh} AND ${employeeDocuments.expiryDate} <= ${soonIso}`,
    ));

  // وثائق الموظفين النشطين المنتهية أو التي ستنتهي خلال النافذة (سجلات الوثائق)
  const docRows = await db
    .select({
      docType: employeeDocuments.documentType,
      expiryDate: employeeDocuments.expiryDate,
      branchId: branchEmployees.branchId,
      employeeName: branchEmployees.employeeName,
    })
    .from(employeeDocuments)
    .innerJoin(branchEmployees, eq(employeeDocuments.branchEmployeeId, branchEmployees.id))
    .where(and(
      eq(branchEmployees.status, "active"),
      sql`${employeeDocuments.status} IN ('expired','expiring_soon')`,
      sql`${employeeDocuments.expiryDate} IS NOT NULL AND ${employeeDocuments.expiryDate} <= ${soonIso}`,
    ));

  // حقول الإقامة/الشهادة الصحية على ملف الموظف مباشرة (قد لا يكون لها سجل وثيقة)
  const empRows = await db
    .select({
      branchId: branchEmployees.branchId,
      employeeName: branchEmployees.employeeName,
      iqamaExpiry: branchEmployees.iqamaExpiry,
      healthCertificateExpiry: branchEmployees.healthCertificateExpiry,
    })
    .from(branchEmployees)
    .where(and(
      eq(branchEmployees.status, "active"),
      sql`(
        (${branchEmployees.iqamaExpiry} IS NOT NULL AND ${branchEmployees.iqamaExpiry} <> '' AND ${branchEmployees.iqamaExpiry} <= ${soonIso})
        OR (${branchEmployees.healthCertificateExpiry} IS NOT NULL AND ${branchEmployees.healthCertificateExpiry} <> '' AND ${branchEmployees.healthCertificateExpiry} <= ${soonIso})
      )`,
    ));

  // اجمع البنود لكل فرع مع إزالة التكرار (وثيقة مسجلة + حقل الملف لنفس الموظف)
  type Item = { name: string; label: string; expiry: string };
  const byBranch = new Map<string, Map<string, Item>>();
  const push = (branchId: string | null, name: string | null, label: string, expiry: string | null) => {
    if (!branchId || !name || !expiry) return;
    const m = byBranch.get(branchId) || new Map<string, Item>();
    const key = `${name}|${label}`;
    const ex = m.get(key);
    if (!ex || expiry < ex.expiry) m.set(key, { name, label, expiry });
    byBranch.set(branchId, m);
  };
  for (const d of docRows) push(d.branchId, d.employeeName, DOC_TYPE_LABELS[d.docType] || "وثيقة", d.expiryDate);
  for (const e of empRows) {
    if (e.iqamaExpiry && e.iqamaExpiry <= soonIso) push(e.branchId, e.employeeName, "إقامة", e.iqamaExpiry);
    if (e.healthCertificateExpiry && e.healthCertificateExpiry <= soonIso) push(e.branchId, e.employeeName, "شهادة صحية", e.healthCertificateExpiry);
  }

  let notified = 0;
  for (const [branchId, items] of Array.from(byBranch.entries())) {
    try {
      // منع التكرار عبر إعادة التشغيل: هل أُرسل إشعار اليوم لهذا الفرع؟
      const [already] = await db.select({ id: systemNotifications.id }).from(systemNotifications)
        .where(and(
          eq(systemNotifications.autoSource, "document_expiry_alert"),
          sql`${systemNotifications.createdAt} >= ${todayRiyadh + "T00:00:00+03:00"}`,
          sql`${systemNotifications.targetBranchIds} @> ARRAY[${branchId}]::text[]`,
        )).limit(1);
      if (already) continue;

      const sorted = Array.from(items.values()).sort((a, b) => a.expiry.localeCompare(b.expiry));
      const expired = sorted.filter(i => i.expiry < todayRiyadh);
      const expiring = sorted.filter(i => i.expiry >= todayRiyadh);
      const fmtLine = (i: Item) => `• ${i.name} — ${i.label} (${i.expiry < todayRiyadh ? "منتهية منذ" : "تنتهي في"} ${i.expiry})`;
      const parts: string[] = [];
      if (expired.length) parts.push(`⛔ وثائق منتهية (${expired.length}):\n${expired.slice(0, 15).map(fmtLine).join("\n")}${expired.length > 15 ? `\n… و${expired.length - 15} أخرى` : ""}`);
      if (expiring.length) parts.push(`⚠️ ستنتهي خلال ${DOC_EXPIRY_WINDOW_DAYS} يوماً (${expiring.length}):\n${expiring.slice(0, 15).map(fmtLine).join("\n")}${expiring.length > 15 ? `\n… و${expiring.length - 15} أخرى` : ""}`);

      await db.insert(systemNotifications).values({
        title: `📄 متابعة وثائق الموظفين — ${expired.length + expiring.length} وثيقة تحتاج إجراء`,
        content: `${parts.join("\n\n")}\n\nيمكن المتابعة والتجديد من صفحة وثائق الموظفين.`,
        messageType: "announcement",
        displayStyle: "toast",
        priority: expired.length > 0 ? 4 : 3,
        isActive: true,
        targetAllBranches: false,
        targetBranchIds: [branchId],
        targetRoleIds: ["hr_manager", "admin"],
        autoGenerated: true,
        autoSource: "document_expiry_alert",
      } as any);
      notified++;
    } catch (e: any) {
      console.error(`[scheduler] doc-expiry alert failed for branch ${branchId}:`, e.message);
    }
  }

  lastDocExpiryAlertDate = todayRiyadh;
  if (notified > 0) console.log(`[scheduler] document-expiry alerts: notified ${notified} branches`);
  return { notified };
}

async function tick() {
  if (tickRunning) {
    console.log("[scheduler] tick skipped - previous tick still running");
    return;
  }
  tickRunning = true;
  try {
    try { await processQueue(); } catch (e: any) { console.error("[scheduler] processQueue error:", e.message); }
    try { await processSchedules(); } catch (e: any) { console.error("[scheduler] processSchedules error:", e.message); }
    // Anniversary check runs only after 6am local server time, max once per day.
    try {
      const h = new Date().getHours();
      if (h >= 6) await processAnniversaryGreetings(false);
    } catch (e: any) { console.error("[scheduler] processAnniversaryGreetings error:", e.message); }
    // تذكير العودة من الإجازة — بعد 6 صباحاً بتوقيت الرياض، مرة يومياً.
    try {
      const hRiyadh = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", hour12: false }));
      if (hRiyadh >= 6) await processReturnReminders(false);
    } catch (e: any) { console.error("[scheduler] processReturnReminders error:", e.message); }
    // الغياب التلقائي للمتأخرين عن العودة — بعد 6 صباحاً بتوقيت الرياض، مرة يومياً.
    try {
      const hRiyadh = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", hour12: false }));
      if (hRiyadh >= 6) await processOverdueLeaveAbsences(false);
    } catch (e: any) { console.error("[scheduler] processOverdueLeaveAbsences error:", e.message); }
    // الترحيل السنوي التلقائي لأرصدة الإجازات — يناير، بعد 6 صباحاً بتوقيت الرياض.
    try {
      const hRiyadh = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", hour12: false }));
      if (hRiyadh >= 6) await processAnnualLeaveCarryover(false);
    } catch (e: any) { console.error("[scheduler] processAnnualLeaveCarryover error:", e.message); }
    // تذكير الإنذارات غير الموقَّعة — بعد 9 صباحاً بتوقيت الرياض، مرة يومياً.
    try {
      const hRiyadh = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", hour12: false }));
      if (hRiyadh >= 9) await processWarningSignatureReminders(false);
    } catch (e: any) { console.error("[scheduler] processWarningSignatureReminders error:", e.message); }
    // تنبيهات انتهاء الوثائق (إقامات/شهادات/عقود) — بعد 9 صباحاً بتوقيت الرياض، مرة يومياً.
    try {
      const hRiyadh = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Riyadh", hour: "2-digit", hour12: false }));
      if (hRiyadh >= 9) await processDocumentExpiryAlerts(false);
    } catch (e: any) { console.error("[scheduler] processDocumentExpiryAlerts error:", e.message); }
  } finally {
    tickRunning = false;
  }
}

export function startScheduler() {
  if (started) return;
  started = true;
  console.log(`[scheduler] starting (tick=${TICK_MS}ms, twilio=${isTwilioConfigured() ? "configured" : "disabled"})`);
  setTimeout(tick, 5000);
  setInterval(tick, TICK_MS);
}
