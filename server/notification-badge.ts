import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "./db";
import { notifications, users } from "@shared/schema";
import { storage } from "./storage";

// Count each visible unread row once. The personal and system stores are
// disjoint; the portal's merged view must not be added to the main bell again.
export async function getUnreadBadgeCount(userId: string, branchId: string): Promise<number> {
  const [account] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, "active"))).limit(1);
  if (!account) return 0;
  const now = new Date();
  const [system, reads, personal] = await Promise.all([
    storage.getActiveNotificationsForUser(userId, branchId),
    storage.getNotificationReadsByUser(userId),
    db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
      eq(notifications.isDismissed, false),
      or(isNull(notifications.scheduledFor), lte(notifications.scheduledFor, now)),
      or(isNull(notifications.expiresAt), gt(notifications.expiresAt, now)),
    )),
  ]);
  const readIds = new Set(reads.map(row => row.notificationId));
  return system.filter(row => !readIds.has(row.id)).length + (personal[0]?.count ?? 0);
}