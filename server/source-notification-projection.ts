import { eq } from "drizzle-orm";
import { materialTransfers, type SystemNotification } from "@shared/schema";
import { recognizedSourceNotice, type SourceNotice } from "@shared/operations-center-notifications";
import { db } from "./db";
import { sourceNoticeAccess } from "./source-notification-access";
import { filterAuthorizedWarehouseTransferNotificationUsers, type WarehouseTransferNotificationEvent } from "./warehouse-transfer-notifications";
import { centralKitchenNoticeContext, filterAuthorizedCentralKitchenNotificationUsers, type CentralKitchenNotificationEvent } from "./central-kitchen-notifications";
import { deliveryNoticeContext, deliveryNoticeDestination, deliveryNoticeIsCurrent, filterAuthorizedDeliveryNoticeUsers } from "./delivery-notifications";
import { getKitchenRouting } from "./central-kitchen-routing";

const history = (n: SystemNotification): SourceNotice => ({
  ...n, sourceState: "history", buttonAction: null, buttonText: null,
  content: `سُجّل هذا الحدث سابقًا: ${n.title}. تغيرت مرحلة السجل المرتبط؛ لا يمثل هذا الإشعار إجراءً مطلوبًا الآن.`,
});
function project(n: SourceNotice, branchId: string, action: string | null): SourceNotice {
  return { ...n, targetAllBranches: false, targetBranchIds: [branchId], accessBranchIds: [branchId],
    buttonAction: action, buttonText: action ? n.buttonText || "فتح المصدر" : null };
}

export function transferNoticeIsCurrent(event: WarehouseTransferNotificationEvent, transfer: { status: string; hasDiscrepancy?: boolean | null }) {
  if (event === "created") return transfer.status === "pending";
  if (event === "in_transit") return transfer.status === "in_transit";
  if (event === "delivered_discrepancy") return transfer.status === "delivered" && transfer.hasDiscrepancy === true;
  return true; // Other lifecycle messages describe completed facts, not work.
}

export function kitchenNoticeIsCurrent(event: CentralKitchenNotificationEvent, order: { status: string; discrepancyStatus?: string | null }) {
  if (event === "created" || event === "edited") return order.status === "requested";
  if (event === "overdue") return !["received", "cancelled"].includes(order.status);
  if (event === "dispatched") return order.status === "dispatched";
  if (event === "received_discrepancy") return order.status === "received" && order.discrepancyStatus === "open";
  return true;
}

/** Projection is recipient-specific and read-only. Keep dedupe/outbox/push IDs
 * unchanged. Arbitrary/manual multi-branch notices are never partially exposed. */
export async function projectSourceNotificationForRecipient(n: SystemNotification, userId: string): Promise<SourceNotice | null> {
  const kind = recognizedSourceNotice(n);
  if (!kind) return n;
  if (!n.targetUserIds?.includes(userId)) return null;
  const access = await sourceNoticeAccess(userId);
  if (!access) return null;
  if (kind === "transfer") {
    if (!(await filterAuthorizedWarehouseTransferNotificationUsers(db, n, [userId])).includes(userId)) return null;
    const id = Number(n.dedupeKey!.split(":")[1]);
    const event = n.dedupeKey!.split(":")[2] as WarehouseTransferNotificationEvent;
    const [transfer] = await db.select().from(materialTransfers).where(eq(materialTransfers.id, id));
    if (!transfer) return null;
    const sourceSide = ["created", "delivered", "delivered_discrepancy"].includes(event);
    const branch = event === "cancelled"
      ? access.branch(transfer.destinationBranchId) ? transfer.destinationBranchId : transfer.sourceBranchId
      : sourceSide ? transfer.sourceBranchId : transfer.destinationBranchId;
    if (!branch || !access.branch(branch)) return null;
    const current = transferNoticeIsCurrent(event, transfer);
    const row: SourceNotice = current ? { ...n, sourceState: "current" } : history(n);
    const module = access.user.role === "branch_manager" ? "branch_supply" : "warehouse";
    const href = current && await access.view(module)
      ? `/transfer-requests?branchId=${encodeURIComponent(branch)}&transferId=${transfer.id}` : null;
    return project(row, branch, href);
  }
  if (kind === "kitchen") {
    if (!(await filterAuthorizedCentralKitchenNotificationUsers(db, n, [userId])).includes(userId)) return null;
    const context = await centralKitchenNoticeContext(db, n);
    if (!context) return null;
    const { order, event } = context;
    const sourceSide = access.user.role === "production_development_manager"
      || ["created", "edited", "cancelled", "received", "received_discrepancy", "missing_responsible", "overdue"].includes(event);
    const branch = sourceSide ? order.centralKitchenId : order.requestBranchId;
    if (!access.branch(branch)) return null;
    const current = kitchenNoticeIsCurrent(event, order)
      && (event !== "missing_responsible" || !(await getKitchenRouting(db, order.centralKitchenId)).hasKitchenResponsible);
    const row: SourceNotice = current ? { ...n, sourceState: "current" } : history(n);
    return project(row, branch, current && await access.view("central_kitchen_orders")
      ? `/central-kitchen-orders?branchId=${encodeURIComponent(branch)}&orderId=${order.id}` : null);
  }
  if (!(await filterAuthorizedDeliveryNoticeUsers(n, [userId])).includes(userId)) return null;
  if (n.dedupeKey!.endsWith(":removed")) return { ...n, buttonAction: null, buttonText: null };
  const context = await deliveryNoticeContext(n);
  if (!context) return null;
  const { assignment, source, event } = context;
  const branch = event === "awaiting_receipt" ? source.destination ?? source.source : source.source;
  const ownDriver = access.user.role === "employee" && access.user.jobTitle === "delivery"
    && access.user.id === assignment.driver_id;
  if (branch && !ownDriver && !access.branch(branch)) return null;
  const current = deliveryNoticeIsCurrent(assignment, event);
  const row: SourceNotice = current ? { ...n, sourceState: "current" } : history(n);
  const destination = current ? await deliveryNoticeDestination(assignment, source, event, access) : null;
  // Managed warehouses are not fictitious branch grants. A currently assigned
  // driver can still open the exact task even when neither source side has a
  // branch ID; this must not turn into a global center-scope broadcast.
  return branch ? project(row, branch, destination?.href ?? null)
    : { ...row, targetAllBranches: false, targetBranchIds: [], accessBranchIds: [],
      buttonAction: destination?.href ?? null, buttonText: destination ? row.buttonText || "فتح المصدر" : null };
}