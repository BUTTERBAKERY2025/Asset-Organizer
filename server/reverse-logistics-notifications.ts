import type { PoolClient } from "pg";
import type { Request, Response } from "express";
import type { SystemNotification } from "@shared/schema";
import type { SourceNotice } from "@shared/operations-center-notifications";
import { pool } from "./db";
import { sourceNoticeAccess, type SourceNoticeAccess } from "./source-notification-access";
import { dispatchAfterCommitSafely } from "./central-kitchen-notifications";

export type ReverseNoticeEvent = "request" | "cancel" | "dispatch" | "receive" | "inspect" | "writeoff";
type Movement = {
  id: string | number; kind: string; status: string; source_branch_id: string | null;
  destination_branch_id: string | null; destination_warehouse_id: number | null;
  damaged_quantity: string | number; written_off_quantity: string | number;
};
const copies: Record<ReverseNoticeEvent, { title: string; content: string }> = {
  request: { title: "طلب إرجاع أو نقل مستودعات", content: "قُدم طلب جديد؛ راجع التجهيز والإرسال في المصدر حسب صلاحياتك." },
  cancel: { title: "إلغاء حركة إرجاع أو نقل", content: "أُلغيت الحركة قبل الإرسال؛ الإشعار لا يمثل حركة مخزون جديدة." },
  dispatch: { title: "أُرسل المرتجع أو نقل المستودعات", content: "سُجل الإرسال؛ راجع الوصول والاستلام لدى الوجهة." },
  receive: { title: "حركة مستلمة تنتظر الفحص", content: "سُجل الاستلام؛ يلزم فحص المستلم وتصنيف الصالح والتالف قبل إتاحة الصالح." },
  inspect: { title: "نتيجة فحص المرتجع أو النقل", content: "سُجل الفحص؛ راجع نتيجة التصنيف وأي تلف متبقٍ يحتاج قرار الشطب المخوّل." },
  writeoff: { title: "اعتماد شطب تلف الحركة", content: "سُجل شطب كمية تالفة؛ لا يثبت ذلك تعويض أي كمية ناقصة أو استكمالها." },
};
const validEvent = (event: string): event is ReverseNoticeEvent => Object.hasOwn(copies, event);
const destination = (row: Movement) => row.destination_branch_id
  ?? (row.kind === "material_return" && row.destination_warehouse_id == null ? "main_warehouse" : null);

/** The returned branch is a scoped desk, never a persisted warehouse endpoint. */
export function reverseNoticeBranches(row: Movement, event: ReverseNoticeEvent, access: SourceNoticeAccess): string[] {
  const globalWarehouse = ["admin", "operations_manager"].includes(access.user.role) && access.allowed === null;
  if (row.kind === "warehouse_transfer") return globalWarehouse ? ["main_warehouse"] : [];
  const source = row.source_branch_id;
  const dest = destination(row);
  const side = event === "request" ? [source]
    : ["dispatch", "receive"].includes(event) ? [dest] : [dest, source];
  return Array.from(new Set(side.filter((id): id is string => !!id && access.branch(id))));
}

/** Mirrors the reverse source's edit and custody guards using fresh permissions. */
async function canEdit(access: SourceNoticeAccess, module: string): Promise<boolean> {
  const { rowCount } = await pool.query(`SELECT 1 FROM user_permission_overrides o
    JOIN permissions p ON p.id=o.permission_id WHERE o.user_id=$1 AND p.module=$2
    AND p.action='edit' AND o.allow=false AND (o.expires_at IS NULL OR o.expires_at>now())`,
  [access.user.id, module]);
  if (rowCount) return false;
  const { requirePermission } = await import("./auth");
  const req = { currentUser: access.user, userBranchAccess: (access.allowed ?? []).map(branchId => ({ branchId })),
    method: "POST", headers: {}, originalUrl: "/api/reverse-notification-recipient" } as unknown as Request;
  return new Promise((resolve, reject) => {
    const res = { status: () => res, json: () => resolve(false) } as unknown as Response;
    Promise.resolve(requirePermission(module, "edit")(req, res, err => err ? reject(err) : resolve(true))).catch(reject);
  });
}

async function recipient(row: Movement, event: ReverseNoticeEvent, userId: string) {
  const access = await sourceNoticeAccess(userId);
  if (!access) return null;
  const branches = reverseNoticeBranches(row, event, access);
  if (!branches.length) return null;
  const module = access.user.role === "branch_manager"
    ? row.kind === "material_return" ? "branch_supply" : "central_kitchen_orders" : "warehouse";
  if (access.user.role === "branch_manager"
    && (row.kind === "warehouse_transfer" || !access.branch(row.source_branch_id))) return null;
  if (!(await access.view(module))) return null;
  // A damaged-inspection alert is a disposal decision, not a role-wide broadcast.
  if (event === "inspect" && Number(row.damaged_quantity) > Number(row.written_off_quantity)
    && access.user.role === "operations_manager") {
    const global = access.allowed === null;
    const dest = destination(row);
    const custody = row.kind === "warehouse_transfer" ? global
      : row.kind === "material_return" ? global || access.user.branchId === "main_warehouse" && access.branch("main_warehouse")
      : !dest || access.branch(dest);
    if (!custody || !(await canEdit(access, "warehouse"))) return null;
  }
  return { access, branch: branches[0], module };
}

export async function insertReverseMovementNotification(
  tx: PoolClient, row: Movement, eventId: number | string, event: ReverseNoticeEvent, actorId: string,
): Promise<number[]> {
  const branches = [row.source_branch_id, destination(row), row.kind === "warehouse_transfer" ? "main_warehouse" : null]
    .filter((branch): branch is string => !!branch);
  const { rows: people } = await tx.query(`SELECT u.id FROM users u WHERE u.is_active='active'
    AND (u.role IN ('admin','production_development_manager')
      OR u.branch_id=ANY($1::varchar[]) OR EXISTS (SELECT 1 FROM user_branch_access ba
        WHERE ba.user_id=u.id AND ba.branch_id=ANY($1::varchar[])))`, [branches]);
  const notificationIds: number[] = [];
  for (const person of people) {
    const authorized = await recipient(row, event, person.id);
    if (!authorized) continue;
    const { branch, module } = authorized;
    const copy = copies[event];
    const damage = event === "inspect" && Number(row.damaged_quantity) > Number(row.written_off_quantity);
    const inserted = await tx.query(`INSERT INTO system_notifications
      (title,content,message_type,display_style,priority,target_all_branches,target_branch_ids,target_user_ids,
       button_text,button_action,show_once,auto_generated,auto_source,access_module,access_branch_ids,dedupe_key,created_by)
      VALUES ($1,$2,'reverse_movement','banner',$3,false,$4,$5,'فتح الحركة',$6,true,true,
        'reverse_movement',$7,$4,$8,$9) ON CONFLICT(dedupe_key) DO NOTHING RETURNING id`,
    [copy.title, copy.content, damage ? 4 : 3, [branch], [person.id],
      `/reverse-logistics?branchId=${encodeURIComponent(branch)}&movementId=${row.id}`, module,
      `reverse-event:${eventId}:${event}:${person.id}`, actorId]);
    if (inserted.rows[0]?.id) notificationIds.push(inserted.rows[0].id);
  }
  return notificationIds;
}

export function dispatchReverseNotificationsAfterCommit(ids: number[]): void {
  if (!ids.length) return;
  dispatchAfterCommitSafely(async () => {
    const { db } = await import("./db");
    const { systemNotifications } = await import("@shared/schema");
    const { inArray } = await import("drizzle-orm");
    const notifications = await db.select().from(systemNotifications).where(inArray(systemNotifications.id, ids));
    const { sendPushForSystemNotification } = await import("./push-service");
    for (const notification of notifications) await sendPushForSystemNotification(notification);
  }, error => console.error("[reverse-notification] post-commit push failed:", error));
}

export async function reverseNoticeContext(n: Partial<SystemNotification>) {
  const match = n.dedupeKey?.match(/^reverse-event:([1-9]\d*):(request|cancel|dispatch|receive|inspect|writeoff):(.+)$/);
  if (!n.autoGenerated || n.autoSource !== "reverse_movement" || !match || !validEvent(match[2])) return null;
  const { rows } = await pool.query(`SELECT m.*,e.action AS event_action FROM reverse_movement_events e
    JOIN reverse_movements m ON m.id=e.movement_id WHERE e.id=$1`, [match[1]]);
  const movement = rows[0] as Movement & { event_action: string } | undefined;
  const linked = n.buttonAction?.match(/[?&]movementId=(\d+)(?:&|$)/)?.[1];
  if (!movement || movement.event_action !== match[2] || linked && Number(linked) !== Number(movement.id)) return null;
  return { movement, event: match[2] as ReverseNoticeEvent, recipientId: match[3] };
}

/** READ/PUSH must invoke this, not authorize a historical targetUserIds snapshot. */
export async function filterAuthorizedReverseNotificationUsers(n: Partial<SystemNotification>, candidates: string[]): Promise<string[]> {
  const context = await reverseNoticeContext(n);
  if (!context) return [];
  const results = await Promise.all(candidates.map(async id => n.targetUserIds?.includes(id)
    && context.recipientId === id && await recipient(context.movement, context.event, id) ? id : null));
  return results.filter((id): id is string => !!id);
}

export async function projectReverseSourceNotificationForRecipient(n: SystemNotification, userId: string): Promise<SourceNotice | null> {
  const context = await reverseNoticeContext(n);
  if (!context || context.recipientId !== userId || !n.targetUserIds?.includes(userId)) return null;
  const authorized = await recipient(context.movement, context.event, userId);
  if (!authorized) return null;
  const { movement: row, event } = context;
  const current = event === "request" ? row.status === "requested"
    : event === "dispatch" ? row.status === "dispatched"
    : event === "receive" ? row.status === "received"
    : event === "inspect" ? row.status === "inspected" && Number(row.damaged_quantity) > Number(row.written_off_quantity)
    : true;
  return { ...n, targetAllBranches: false, targetBranchIds: [authorized.branch], accessBranchIds: [authorized.branch],
    sourceState: current ? "current" : "history",
    buttonAction: current ? `/reverse-logistics?branchId=${encodeURIComponent(authorized.branch)}&movementId=${row.id}` : null,
    buttonText: current ? "فتح الحركة" : null,
    ...(!current ? { content: `حدث سابق: ${n.title}. تغيرت مرحلة الحركة؛ لا يثبت الإشعار وجود إجراء مطلوب الآن.` } : {}) };
}