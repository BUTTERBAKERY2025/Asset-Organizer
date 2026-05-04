import { db } from "./db";
import { and, eq, lte, lt, sql, desc } from "drizzle-orm";
import { notificationQueue, reportSchedules, reportRuns } from "@shared/schema";
import { sendWhatsAppMessage, sendSMS, isTwilioConfigured } from "./twilio-service";
import { generateReport, type ReportType } from "./report-generator";
import { z } from "zod";

const TICK_MS = 60_000;
const MAX_RETRIES = 3;
const QUEUE_BATCH = 10;

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
    status: r.status,
    retryCount: r.retry_count,
  }));

  for (const item of items) {
    try {
      let result: { success: boolean; error?: string; messageId?: string };
      if (item.channel === "whatsapp") {
        result = await sendWhatsAppMessage(item.recipientPhone, item.message);
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

async function tick() {
  if (tickRunning) {
    console.log("[scheduler] tick skipped - previous tick still running");
    return;
  }
  tickRunning = true;
  try {
    try { await processQueue(); } catch (e: any) { console.error("[scheduler] processQueue error:", e.message); }
    try { await processSchedules(); } catch (e: any) { console.error("[scheduler] processSchedules error:", e.message); }
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
