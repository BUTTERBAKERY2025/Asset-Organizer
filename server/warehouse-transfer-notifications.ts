import { and, eq } from "drizzle-orm";
import {
  materialTransfers,
  systemNotifications,
  userBranchAccess,
  userPermissions,
  users,
  ROLE_PERMISSION_TEMPLATES,
  type MaterialTransfer,
  type SystemNotification,
} from "@shared/schema";

export type WarehouseTransferNotificationEvent =
  | "created"
  | "approved"
  | "rejected"
  | "modified"
  | "in_transit"
  | "delivered"
  | "delivered_discrepancy"
  | "cancelled";

type Executor = {
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
};
type AuthorizedPerson = {
  id: string;
  role: string;
  primaryBranchId: string | null;
  actions: string[] | null;
  branchIds: string[];
};

const MAIN_WAREHOUSE = "main_warehouse";
function intrinsicWarehouseActions(role: string): readonly string[] {
  // These are the only role templates requirePermission applies intrinsically.
  // Other templates (notably viewer) are provisioning defaults and still
  // require a persisted user_permissions row at request time.
  if (!["production_development_manager", "operations_manager", "branch_manager"].includes(role)) {
    return [];
  }
  return ROLE_PERMISSION_TEMPLATES[role]
    ?.find((entry: { module: string }) => entry.module === "warehouse")?.actions || [];
}

const EVENT_COPY: Record<WarehouseTransferNotificationEvent, { title: string; content: string; priority: number }> = {
  created: { title: "طلب تحويل مواد جديد", content: "وصل طلب تحويل جديد ويحتاج إلى مراجعة المصدر.", priority: 3 },
  approved: { title: "تم اعتماد تحويل المواد", content: "اعتمد المصدر طلب التحويل.", priority: 2 },
  rejected: { title: "تم رفض تحويل المواد", content: "رفض المصدر طلب التحويل.", priority: 3 },
  modified: { title: "تم تعديل كميات التحويل", content: "عدّل المصدر كميات مواد التحويل.", priority: 3 },
  in_transit: { title: "تحويل مواد في الطريق", content: "أرسل المصدر التحويل إلى الفرع المستلم.", priority: 3 },
  delivered: { title: "تم استلام تحويل المواد", content: "أكد الفرع المستلم وصول التحويل كاملاً.", priority: 2 },
  delivered_discrepancy: { title: "تم استلام التحويل مع فروقات", content: "سجل الفرع المستلم فروقات في كميات التحويل وتحتاج إلى مراجعة المصدر.", priority: 4 },
  cancelled: { title: "تم إلغاء تحويل المواد", content: "ألغي طلب التحويل قبل الإرسال.", priority: 3 },
};

export function hasWarehouseAction(role: string, actions: string[] | null, action: "view" | "edit"): boolean {
  if (role === "attendance_clerk") return false;
  if (role === "viewer" && action !== "view") return false;
  return role === "admin"
    // Keep exact parity with requirePermission("warehouse", action), which
    // auto-grants every action present in these authoritative role templates.
    || intrinsicWarehouseActions(role).includes(action)
    || !!actions?.includes(action);
}

function hasBranchAuthority(
  person: { role: string; primaryBranchId: string | null; branchIds: string[] },
  branchId: string,
  sourceSide: boolean,
): boolean {
  if (person.role === "admin" || person.role === "production_development_manager") return true;
  if (sourceSide && branchId === MAIN_WAREHOUSE && person.primaryBranchId !== MAIN_WAREHOUSE) return false;
  if (person.role === "financial_manager") return true;
  if (person.role === "operations_manager" && person.branchIds.length === 0) return true;
  return person.branchIds.length > 0
    ? person.branchIds.includes(branchId)
    : person.primaryBranchId === branchId;
}

async function authorizedPeople(executor: Executor, action: "view" | "edit"): Promise<AuthorizedPerson[]> {
  const rows = await executor.select({
    id: users.id,
    role: users.role,
    primaryBranchId: users.branchId,
    actions: userPermissions.actions,
  }).from(users).leftJoin(userPermissions, and(
    eq(userPermissions.userId, users.id),
    eq(userPermissions.module, "warehouse"),
  )).where(eq(users.isActive, "active"));
  const accessRows = await executor.select({
    userId: userBranchAccess.userId,
    branchId: userBranchAccess.branchId,
  }).from(userBranchAccess);
  const branchIds = new Map<string, string[]>();
  for (const row of accessRows) {
    branchIds.set(row.userId, [...(branchIds.get(row.userId) || []), row.branchId]);
  }
  return rows.filter((row: any) => hasWarehouseAction(
    row.role,
    Array.isArray(row.actions) ? row.actions : null,
    action,
  )).map((row: any): AuthorizedPerson => ({ ...row, branchIds: branchIds.get(row.id) || [] }));
}

export async function routedWarehouseTransferRecipients(
  executor: Executor,
  transfer: Pick<MaterialTransfer, "sourceBranchId" | "destinationBranchId" | "createdBy">,
  event: WarehouseTransferNotificationEvent,
): Promise<string[]> {
  const sourceId = transfer.sourceBranchId;
  const destinationId = transfer.destinationBranchId;
  if (!sourceId || !destinationId) return [];
  const sourceAction = event === "created" || event === "delivered_discrepancy";
  const destinationAction = event === "in_transit";
  const people = await authorizedPeople(executor, sourceAction || destinationAction ? "edit" : "view");

  let recipients: AuthorizedPerson[];
  if (["created", "delivered", "delivered_discrepancy"].includes(event)) {
    recipients = people.filter((person: AuthorizedPerson) => hasBranchAuthority(person, sourceId, true));
  } else if (["approved", "rejected", "modified", "in_transit"].includes(event)) {
    recipients = people.filter((person: AuthorizedPerson) => hasBranchAuthority(person, destinationId, false));
  } else {
    recipients = people.filter((person: AuthorizedPerson) =>
      hasBranchAuthority(person, sourceId, true) || hasBranchAuthority(person, destinationId, false));
  }
  return Array.from(new Set(recipients.map(person => person.id)));
}

export function buildWarehouseTransferNotificationPayload(input: {
  transfer: Pick<MaterialTransfer, "id" | "sourceBranchId" | "destinationBranchId">;
  event: WarehouseTransferNotificationEvent;
  actorId: string;
  recipientIds: string[];
  eventKey?: string;
}) {
  const { transfer, event } = input;
  const copy = EVENT_COPY[event];
  const relevantBranchId = ["created", "delivered", "delivered_discrepancy"].includes(event)
    ? transfer.sourceBranchId!
    : transfer.destinationBranchId!;
  return {
    ...copy,
    messageType: "warehouse_material_transfer",
    displayStyle: "banner",
    targetAllBranches: false,
    targetBranchIds: [relevantBranchId],
    targetUserIds: input.recipientIds,
    buttonText: "فتح التحويل",
    buttonAction: `/transfer-requests?branchId=${encodeURIComponent(relevantBranchId)}&transferId=${transfer.id}`,
    soundEnabled: true,
    showOnce: true,
    autoGenerated: true,
    autoSource: "warehouse_material_transfer",
    accessModule: "warehouse",
    accessBranchIds: [transfer.sourceBranchId!, transfer.destinationBranchId!],
    dedupeKey: `warehouse-transfer:${transfer.id}:${event}:${input.eventKey || event}`,
    createdBy: input.actorId,
  } as const;
}

export async function filterAuthorizedWarehouseTransferNotificationUsers(
  executor: Executor,
  notification: Pick<SystemNotification, "accessModule" | "targetUserIds" | "buttonAction" | "dedupeKey"> & Partial<SystemNotification>,
  candidateUserIds: string[],
): Promise<string[]> {
  if (notification.accessModule !== "warehouse") return candidateUserIds;
  const transferId = Number(notification.buttonAction?.match(/transferId=(\d+)/)?.[1]);
  const event = notification.dedupeKey?.split(":")[2] as WarehouseTransferNotificationEvent;
  if (!transferId || !EVENT_COPY[event]) return [];
  const [transfer] = await executor.select().from(materialTransfers).where(eq(materialTransfers.id, transferId));
  if (!transfer) return [];
  const current = await routedWarehouseTransferRecipients(executor, transfer, event);
  return candidateUserIds.filter(id => current.includes(id));
}

export async function insertWarehouseTransferNotification(
  executor: Executor,
  transfer: MaterialTransfer,
  event: WarehouseTransferNotificationEvent,
  actorId: string,
  eventKey?: string,
): Promise<number | null> {
  const recipientIds = await routedWarehouseTransferRecipients(executor, transfer, event);
  if (!recipientIds.length) return null;
  const [created] = await executor.insert(systemNotifications).values(
    buildWarehouseTransferNotificationPayload({ transfer, event, actorId, recipientIds, eventKey }),
  ).onConflictDoNothing({ target: systemNotifications.dedupeKey }).returning({ id: systemNotifications.id });
  return created?.id || null;
}

export async function notifyWarehouseTransferAfterCommit(
  transfer: MaterialTransfer,
  event: WarehouseTransferNotificationEvent,
  actorId: string,
  eventKey?: string,
): Promise<void> {
  try {
    const { db } = await import("./db");
    const notificationId = await insertWarehouseTransferNotification(db, transfer, event, actorId, eventKey);
    if (!notificationId) return;
    const [notification] = await db.select().from(systemNotifications)
      .where(eq(systemNotifications.id, notificationId)).limit(1);
    if (!notification) return;
    const { sendPushForSystemNotification } = await import("./push-service");
    void sendPushForSystemNotification(notification);
  } catch (error: any) {
    console.error("[warehouse-transfer-notification] post-commit notification failed:", error?.message || error);
  }
}