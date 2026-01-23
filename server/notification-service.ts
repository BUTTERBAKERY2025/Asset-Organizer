import { db } from "./db";
import { notifications, users, branches } from "@shared/schema";
import { eq, and, or, isNull } from "drizzle-orm";

export type NotificationType = 
  | "material_request" 
  | "transfer" 
  | "production" 
  | "maintenance" 
  | "inventory" 
  | "cashier" 
  | "meeting" 
  | "task" 
  | "visitor" 
  | "system";

export type NotificationCategory = 
  | "operations" 
  | "warehouse" 
  | "production" 
  | "sales" 
  | "hr" 
  | "executive" 
  | "system";

export type NotificationPriority = "urgent" | "high" | "normal" | "low";

interface CreateNotificationParams {
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  priority?: NotificationPriority;
  userId?: string;
  branchId?: string;
  linkType?: string;
  linkId?: number;
  linkUrl?: string;
  createdBy?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const {
      type,
      category,
      title,
      message,
      priority = "normal",
      userId,
      branchId,
      linkType,
      linkId,
      linkUrl,
      createdBy,
    } = params;

    const [notification] = await db.insert(notifications)
      .values({
        type,
        category,
        title,
        message,
        priority,
        userId,
        branchId,
        linkType,
        linkId,
        linkUrl,
        createdBy,
        isRead: false,
        isDismissed: false,
      })
      .returning();

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}

export async function createBulkNotifications(params: CreateNotificationParams[]) {
  try {
    const notifications_data = params.map(p => ({
      type: p.type,
      category: p.category,
      title: p.title,
      message: p.message,
      priority: p.priority || "normal",
      userId: p.userId,
      branchId: p.branchId,
      linkType: p.linkType,
      linkId: p.linkId,
      linkUrl: p.linkUrl,
      createdBy: p.createdBy,
      isRead: false,
      isDismissed: false,
    }));

    const result = await db.insert(notifications)
      .values(notifications_data)
      .returning();

    return result;
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    return [];
  }
}

export async function notifyMaterialRequestCreated(
  requestId: number, 
  requestNumber: string, 
  branchName: string,
  createdBy: string
) {
  return createNotification({
    type: "material_request",
    category: "warehouse",
    title: "طلب مواد جديد",
    message: `تم إنشاء طلب مواد جديد رقم ${requestNumber} من فرع ${branchName}`,
    priority: "normal",
    linkType: "material_request",
    linkId: requestId,
    linkUrl: `/transfer-requests`,
    createdBy,
  });
}

export async function notifyMaterialRequestStatusChanged(
  requestId: number,
  requestNumber: string,
  newStatus: string,
  branchId: string,
  changedBy: string
) {
  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    approved: "تمت الموافقة",
    rejected: "مرفوض",
    forwarded_to_purchasing: "محول للمشتريات",
    fulfilled: "تم التنفيذ",
  };

  const statusLabel = statusLabels[newStatus] || newStatus;
  const priority: NotificationPriority = newStatus === "approved" ? "high" : "normal";

  return createNotification({
    type: "material_request",
    category: "warehouse",
    title: `تحديث طلب المواد ${requestNumber}`,
    message: `تم تحديث حالة الطلب إلى: ${statusLabel}`,
    priority,
    branchId,
    linkType: "material_request",
    linkId: requestId,
    linkUrl: `/transfer-requests`,
    createdBy: changedBy,
  });
}

export async function notifyTransferCreated(
  transferId: number,
  transferNumber: string,
  fromBranch: string,
  toBranch: string,
  createdBy: string
) {
  return createNotification({
    type: "transfer",
    category: "warehouse",
    title: "تحويل مواد جديد",
    message: `تم إنشاء تحويل ${transferNumber} من ${fromBranch} إلى ${toBranch}`,
    priority: "normal",
    linkType: "material_transfer",
    linkId: transferId,
    linkUrl: `/transfer-requests`,
    createdBy,
  });
}

export async function notifyTransferStatusChanged(
  transferId: number,
  transferNumber: string,
  newStatus: string,
  branchId: string,
  changedBy: string
) {
  const statusLabels: Record<string, string> = {
    pending: "قيد الانتظار",
    in_transit: "في الطريق",
    delivered: "تم التسليم",
    cancelled: "ملغي",
  };

  const statusLabel = statusLabels[newStatus] || newStatus;
  const priority: NotificationPriority = newStatus === "delivered" ? "normal" : "high";

  return createNotification({
    type: "transfer",
    category: "warehouse",
    title: `تحديث التحويل ${transferNumber}`,
    message: `تم تحديث حالة التحويل إلى: ${statusLabel}`,
    priority,
    branchId,
    linkType: "material_transfer",
    linkId: transferId,
    linkUrl: `/transfer-requests`,
    createdBy: changedBy,
  });
}

export async function notifyLowStock(
  itemId: number,
  itemName: string,
  currentQuantity: number,
  reorderPoint: number,
  branchId?: string
) {
  return createNotification({
    type: "inventory",
    category: "warehouse",
    title: "تنبيه مخزون منخفض",
    message: `الصنف "${itemName}" وصل إلى ${currentQuantity} (حد إعادة الطلب: ${reorderPoint})`,
    priority: "high",
    branchId,
    linkType: "warehouse_item",
    linkId: itemId,
    linkUrl: `/warehouse-inventory`,
  });
}

export async function notifyMaintenanceRequired(
  assetId: number,
  assetName: string,
  branchName: string
) {
  return createNotification({
    type: "maintenance",
    category: "operations",
    title: "صيانة مطلوبة",
    message: `الأصل "${assetName}" في فرع ${branchName} يحتاج صيانة`,
    priority: "high",
    linkType: "inventory_item",
    linkId: assetId,
    linkUrl: `/maintenance`,
  });
}

export async function notifyProductionCompleted(
  batchId: number,
  productName: string,
  quantity: number,
  branchId: string,
  branchName: string
) {
  return createNotification({
    type: "production",
    category: "production",
    title: "إنتاج مكتمل",
    message: `تم إنتاج ${quantity} من "${productName}" في فرع ${branchName}`,
    priority: "normal",
    branchId,
    linkType: "production_batch",
    linkId: batchId,
    linkUrl: `/finished-goods-inventory`,
  });
}

export async function notifyCashierJournalSubmitted(
  journalId: number,
  branchId: string,
  branchName: string,
  totalSales: number,
  date: string,
  submittedBy: string
) {
  return createNotification({
    type: "cashier",
    category: "sales",
    title: "يومية كاشير جديدة",
    message: `تم تقديم يومية ${branchName} بإجمالي ${totalSales.toLocaleString()} ر.س`,
    priority: "normal",
    branchId,
    linkType: "cashier_journal",
    linkId: journalId,
    linkUrl: `/cashier-journals`,
    createdBy: submittedBy,
  });
}

export async function notifyBranchShiftOpened(
  shiftId: number,
  branchId: string,
  branchName: string,
  shiftType: string,
  openedBy: string
) {
  const shiftLabels: Record<string, string> = {
    opening: "فتح الفرع",
    closing: "إغلاق الفرع",
  };

  return createNotification({
    type: "system",
    category: "operations",
    title: shiftLabels[shiftType] || shiftType,
    message: `تم ${shiftLabels[shiftType]} - ${branchName}`,
    priority: "low",
    branchId,
    linkType: "branch_shift",
    linkId: shiftId,
    linkUrl: `/branch-daily-closures`,
    createdBy: openedBy,
  });
}

export async function notifyMeetingReminder(
  meetingId: number,
  title: string,
  startTime: Date,
  userId: string
) {
  const timeStr = startTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  
  return createNotification({
    type: "meeting",
    category: "executive",
    title: "تذكير باجتماع",
    message: `اجتماع "${title}" يبدأ في ${timeStr}`,
    priority: "high",
    userId,
    linkType: "executive_meeting",
    linkId: meetingId,
    linkUrl: `/executive/meetings`,
  });
}

export async function notifyTaskDue(
  taskId: number,
  title: string,
  dueDate: Date,
  userId: string
) {
  const dateStr = dueDate.toLocaleDateString('en-GB');
  
  return createNotification({
    type: "task",
    category: "executive",
    title: "مهمة مستحقة",
    message: `المهمة "${title}" مستحقة في ${dateStr}`,
    priority: "high",
    userId,
    linkType: "executive_task",
    linkId: taskId,
    linkUrl: `/executive/tasks`,
  });
}

export async function notifyVisitorArrived(
  visitorId: number,
  visitorName: string,
  hostName: string,
  branchId?: string
) {
  return createNotification({
    type: "visitor",
    category: "executive",
    title: "وصول زائر",
    message: `الزائر "${visitorName}" وصل ويرغب بمقابلة ${hostName}`,
    priority: "normal",
    branchId,
    linkType: "visitor",
    linkId: visitorId,
    linkUrl: `/visitors`,
  });
}
