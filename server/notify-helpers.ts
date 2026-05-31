import { db } from "./db";
import { notifications } from "@shared/schema";
import { storage } from "./storage";

type EmpLike = {
  id: number;
  branchId: string;
  employeeName: string;
  linkedUserId: string | null;
  phoneNumber: string | null;
};

/**
 * Notify an employee about a decision on their portal request (leave/advance).
 * Sends an in-app notification to their linked portal account (if any) AND
 * queues a WhatsApp message to their phone (if any). Never throws — a
 * notification failure must not block the HR decision itself.
 *
 * NOTE: we insert into the `notifications` table directly (not via
 * storage.createSystemNotification — that name is overloaded in storage.ts and
 * the effective implementation targets the unrelated `system_notifications`
 * table). The portal read endpoints (/api/my/notifications) read `notifications`.
 */
export async function notifyEmployeeOfDecision(opts: {
  emp: EmpLike;
  title: string;
  message: string;
  linkUrl?: string;
  relatedEntityId?: string | number;
}): Promise<void> {
  const { emp, title, message, linkUrl, relatedEntityId } = opts;
  // 1) In-app notification (only if the employee has a portal account)
  if (emp.linkedUserId) {
    try {
      await db.insert(notifications).values({
        branchId: emp.branchId,
        userId: emp.linkedUserId,
        title,
        message,
        type: "info",
        category: "system",
        priority: "normal",
        linkUrl: linkUrl || "/my-portal",
      });
    } catch (e: any) {
      console.error("[notifyEmployeeOfDecision] in-app failed:", e?.message);
    }
  }
  // 2) WhatsApp via the notification queue (scheduler delivers it)
  if (emp.phoneNumber) {
    try {
      await storage.createNotification({
        recipientPhone: emp.phoneNumber,
        recipientName: emp.employeeName,
        channel: "whatsapp",
        message: `${title}\n${message}`,
        relatedModule: "system_notification",
        relatedEntityId: relatedEntityId != null ? String(relatedEntityId) : undefined,
      } as any);
    } catch (e: any) {
      console.error("[notifyEmployeeOfDecision] whatsapp queue failed:", e?.message);
    }
  }
}

/**
 * Notify HR / branch managers that an employee submitted a new portal request.
 * Creates a branch-level in-app notification (userId = null) in the
 * `notifications` table, visible to users who manage that branch. Never throws.
 */
export async function notifyHrOfRequest(
  emp: EmpLike,
  opts: { title: string; message: string; linkUrl?: string; relatedEntityId?: string | number },
): Promise<void> {
  try {
    await db.insert(notifications).values({
      branchId: emp.branchId,
      userId: null,
      title: opts.title,
      message: opts.message,
      type: "info",
      category: "system",
      priority: "normal",
      linkUrl: opts.linkUrl || "/hr-hub",
    });
  } catch (e: any) {
    console.error("[notifyHrOfRequest] in-app failed:", e?.message);
  }
}
