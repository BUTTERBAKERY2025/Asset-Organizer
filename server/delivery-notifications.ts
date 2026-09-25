import type { PoolClient } from "pg";
import { db, pool } from "./db";
import { routingPeople, routingPersonEligible } from "./central-kitchen-routing";
import { routedWarehouseTransferRecipients } from "./warehouse-transfer-notifications";
import type { SystemNotification } from "@shared/schema";

export type DeliveryNoticeEvent = "failed" | "cancelled" | "awaiting_receipt" | "receipt_approved" | "assigned" | "reassigned";
type NoticeType = DeliveryNoticeEvent | "overdue" | "escalated";
export const DELIVERY_ESCALATION_MINUTES = 60;

// Called ONLY after the state/event insert, while the caller's transaction is open.
// Do not publish (or send push) here: a provider outage cannot roll back a receipt.
export async function enqueueDeliveryNotice(
  tx: PoolClient, taskId: number, eventId: number, eventType: DeliveryNoticeEvent,
): Promise<void> {
  let revision = `event:${eventId}`;
  if (eventType === "assigned" || eventType === "reassigned") {
    const { rows } = await tx.query(`SELECT e.detail,e.action,a.driver_id FROM delivery_assignment_events e
      JOIN delivery_assignments a ON a.id=e.assignment_id
      WHERE e.id=$1 AND e.assignment_id=$2`, [eventId, taskId]);
    const event = rows[0];
    const newDriverId = event?.detail?.driverId ?? event?.detail?.newDriverId;
    if (!event || !newDriverId || newDriverId !== event.driver_id
      || (eventType === "reassigned" && (!event.detail?.previousDriverId
        || event.detail.previousDriverId === newDriverId)))
      throw new Error(`Delivery ${eventType} event ${eventId} has no valid driver transition`);
    revision = `event:${eventId}:driver:${newDriverId}`;
  }
  await tx.query(
    `INSERT INTO delivery_notification_outbox (assignment_id,event_id,event_type,revision)
     VALUES ($1,$2,$3,$4) ON CONFLICT (assignment_id,event_type,revision) DO NOTHING`,
    [taskId, eventId, eventType, revision],
  );
}

type Assignment = {
  id: string; source_type: string; source_id: number; driver_id: string;
  scheduled_at: Date | null; status: string; created_by: string;
};
type NoticeJob = {
  id: string; assignment_id: string; event_type: NoticeType; revision: string;
  event_id: string | null; detail: { driverId?: string; newDriverId?: string; previousDriverId?: string } | null;
};
const assignmentEvent = (kind: NoticeType) => kind === "assigned" || kind === "reassigned";
const driverFromEvent = (job: NoticeJob) => job.detail?.driverId ?? job.detail?.newDriverId;
const driverMatches = (a: Assignment, job: NoticeJob) =>
  a.status === "assigned" && !!driverFromEvent(job)
  && a.driver_id === driverFromEvent(job)
  && job.revision === `event:${job.event_id}:driver:${a.driver_id}`;

async function activeDriver(id: string): Promise<boolean> {
  const { rowCount } = await pool.query(`SELECT 1 FROM users WHERE id=$1 AND is_active='active'
    AND job_title='delivery'`, [id]);
  return !!rowCount;
}
type Source = { source: string | null; destination: string | null; warehouseId?: number };

async function sourceFor(a: Assignment): Promise<Source | null> {
  const queries: Record<string, string> = {
    kitchen: `SELECT central_kitchen_id source,request_branch_id destination FROM central_kitchen_orders WHERE id=$1`,
    material_transfer: `SELECT coalesce(source_branch_id,'main_warehouse') source,
      destination_branch_id destination FROM material_transfers WHERE id=$1`,
    finished_goods_transfer: `SELECT source_branch_id source,destination_branch_id destination
      FROM finished_goods_transfers WHERE id=$1 AND destination_type='branch'`,
    kitchen_warehouse_shipment: `SELECT source_branch_id source,NULL::text destination,destination_warehouse_id "warehouseId"
      FROM kitchen_warehouse_shipments WHERE id=$1`,
  };
  const query = queries[a.source_type];
  if (!query) throw new Error(`Unsupported delivery source: ${a.source_type}`);
  return (await pool.query(query, [a.source_id])).rows[0] || null;
}

async function kitchenRecipients(branchId: string, action: "edit" | "view"): Promise<string[]> {
  const people = await routingPeople(db, branchId);
  return people.filter((p: any) => p.branchId === branchId
    && p.role !== "production_development_manager"
    && routingPersonEligible(p, action)).map((p: any) => p.id);
}

async function warehouseRecipients(source: Source, side: "source" | "destination"): Promise<string[]> {
  if (!source.source || !source.destination) return [];
  // Reuse warehouse's live role/permission/branch resolver; "created" routes to
  // source editors, "in_transit" routes to destination editors.
  return routedWarehouseTransferRecipients(db, {
    sourceBranchId: source.source, destinationBranchId: source.destination, createdBy: "",
  }, side === "source" ? "created" : "in_transit");
}

async function warehouseManagers(): Promise<string[]> {
  // Managed warehouses are NOT branch IDs. Never target all branch managers here.
  // Only the globally authorized warehouse operations roles have custody.
  const { rows } = await pool.query(`SELECT u.id FROM users u
    WHERE u.is_active='active' AND
      (u.role='admin' OR (u.role='operations_manager'
        AND NOT EXISTS (SELECT 1 FROM user_branch_access ba WHERE ba.user_id=u.id)))
      AND NOT EXISTS (SELECT 1 FROM user_permission_overrides o
        JOIN permissions p ON p.id=o.permission_id
        WHERE o.user_id=u.id AND p.module='warehouse' AND p.action='edit'
          AND o.allow=false AND (o.expires_at IS NULL OR o.expires_at>now()))`);
  return rows.map(r => r.id);
}

async function recipients(a: Assignment, s: Source, kind: NoticeType): Promise<string[]> {
  const ids: string[] = [];
  if (assignmentEvent(kind)) return await activeDriver(a.driver_id) ? [a.driver_id] : [];
  if (kind === "cancelled") {
    const { rows } = await pool.query(`SELECT id FROM users WHERE id=$1 AND is_active='active'
      AND job_title='delivery'`, [a.driver_id]);
    ids.push(...rows.map(r => r.id));
  }
  if (a.source_type === "kitchen") {
    if (kind === "awaiting_receipt" && s.destination)
      ids.push(...await kitchenRecipients(s.destination, "edit"));
    else if (kind !== "cancelled" && s.source) {
      const people = await routingPeople(db, s.source);
      ids.push(...people.filter((p: any) =>
        p.role === "production_development_manager" && routingPersonEligible(p, "view"))
        .map((p: any) => p.id));
    }
  } else if (a.source_type === "kitchen_warehouse_shipment") {
    if (kind !== "cancelled") ids.push(...await warehouseManagers());
  } else if (a.source_type === "material_transfer" || a.source_type === "finished_goods_transfer") {
    if (kind !== "cancelled") ids.push(...await warehouseRecipients(s,
      kind === "awaiting_receipt" ? "destination" : "source"));
  }
  return Array.from(new Set(ids));
}

// Bell, history and push all revalidate current permissions and custody. Never
// infer authorization merely from the user ID stored in an old notification.
export async function filterAuthorizedDeliveryNoticeUsers(
  notification: Pick<SystemNotification, "dedupeKey" | "targetUserIds">,
  candidates: string[],
): Promise<string[]> {
  const id = Number(notification.dedupeKey?.match(/^delivery:(\d+):/)?.[1]);
  if (!Number.isSafeInteger(id) || id <= 0) return [];
  const { rows } = await pool.query(`SELECT o.event_type,o.event_id,o.revision,e.detail,a.*
    FROM delivery_notification_outbox o
    JOIN delivery_assignments a ON a.id=o.assignment_id
    LEFT JOIN delivery_assignment_events e ON e.id=o.event_id WHERE o.id=$1`, [id]);
  const a = rows[0] as (Assignment & NoticeJob) | undefined;
  if (!a) return [];
  const removed = notification.dedupeKey?.endsWith(":removed");
  // A removed-driver notice contains no assignment link, schedule, source or
  // current driver information. Historical membership is verified from the
  // server-authored event; never from target_user_ids alone.
  if (removed && (a.event_type !== "reassigned" || !a.detail?.previousDriverId
    || a.detail.previousDriverId === driverFromEvent(a))) return [];
  if (!removed && assignmentEvent(a.event_type) && !driverMatches(a, a)) return [];
  const source = removed || assignmentEvent(a.event_type) ? null : await sourceFor(a);
  if (!removed && !assignmentEvent(a.event_type) && !source) return [];
  const current = removed ? await activeDriver(a.detail!.previousDriverId!) ? [a.detail!.previousDriverId!] : []
    : assignmentEvent(a.event_type) ? await activeDriver(a.driver_id) ? [a.driver_id] : []
    : await recipients(a, source!, a.event_type);
  const { rows: active } = await pool.query(`SELECT id FROM users WHERE id=ANY($1::varchar[])
    AND is_active='active'`, [candidates]);
  const permitted = new Set(active.map(r => r.id));
  return candidates.filter(id => notification.targetUserIds?.includes(id)
    && permitted.has(id) && current.includes(id));
}

const copy: Record<NoticeType, { title: string; content: string }> = {
  assigned: { title: "مهمة توصيل مسندة إليك", content: "أُسندت إليك مهمة توصيل جديدة. راجع موعدها وتفاصيلها في مهام التوصيل." },
  reassigned: { title: "مهمة توصيل مسندة إليك", content: "أُعيد إسناد مهمة توصيل إليك. راجع موعدها وتفاصيلها في مهام التوصيل." },
  failed: { title: "تعذر تسليم مهمة", content: "تعذر التسليم؛ راجع مهمة التوصيل واتخذ الإجراء المناسب." },
  cancelled: { title: "أُلغيت مهمة توصيل", content: "أُلغيت مهمة التوصيل المسندة إليك." },
  awaiting_receipt: { title: "استلام يحتاج إلى إجراء", content: "قدم السائق إثبات التسليم. تحقق من استلام المخزون في المصدر ثم اعتمد الإيصال." },
  receipt_approved: { title: "تم اعتماد إيصال التوصيل", content: "اعتُمد الإيصال؛ راجع حالة مهمة التوصيل." },
  overdue: { title: "مهمة توصيل متأخرة", content: "تجاوزت مهمة التوصيل موعدها المحدد ولم تُغلق بعد." },
  escalated: { title: "تصعيد مهمة توصيل متأخرة", content: "مرّت ساعة على موعد التوصيل دون إغلاق المهمة؛ يرجى المتابعة." },
};

// Idempotence includes the deadline and driver: moving a date/reassigning the
// driver permits one notice for the new revision, not one notice every tick.
export async function queueOverdueDeliveryNotices(): Promise<number> {
  const { rowCount } = await pool.query(`
    INSERT INTO delivery_notification_outbox (assignment_id,event_type,revision)
    SELECT a.id,k.kind,
      concat('deadline:',extract(epoch from a.scheduled_at)::bigint,':',a.driver_id)
    FROM delivery_assignments a
    CROSS JOIN LATERAL (VALUES ('overdue', interval '0 minutes'),('escalated', interval '60 minutes')) AS k(kind, delay)
    WHERE a.scheduled_at IS NOT NULL AND a.scheduled_at + k.delay <= now()
      AND a.status NOT IN ('completed','cancelled','receipt_approved')
      AND a.created_at >= now() - interval '30 days'
    ON CONFLICT (assignment_id,event_type,revision) DO NOTHING`);
  return rowCount || 0;
}

async function claim(): Promise<NoticeJob | null> {
  const { rows } = await pool.query(`
    UPDATE delivery_notification_outbox SET claimed_until=now()+interval '2 minutes',attempts=attempts+1
    WHERE id=(SELECT id FROM delivery_notification_outbox
      WHERE published_at IS NULL AND available_at<=now()
        AND (claimed_until IS NULL OR claimed_until<now())
      ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id,assignment_id,event_type,revision,event_id`);
  if (!rows[0]) return null;
  const job = rows[0] as NoticeJob;
  if (assignmentEvent(job.event_type)) {
    const event = await pool.query(`SELECT detail FROM delivery_assignment_events WHERE id=$1 AND assignment_id=$2`,
      [job.event_id, job.assignment_id]);
    job.detail = event.rows[0]?.detail ?? null;
  }
  return job;
}

async function publish(job: NonNullable<Awaited<ReturnType<typeof claim>>>): Promise<void> {
  const { rows } = await pool.query(`SELECT * FROM delivery_assignments WHERE id=$1`, [job.assignment_id]);
  const a = rows[0] as Assignment | undefined;
  if (!a) throw new Error(`Delivery assignment ${job.assignment_id} missing`);
  const staleAssignment = assignmentEvent(job.event_type) && !driverMatches(a, job);
  const deadline = job.event_type === "overdue" || job.event_type === "escalated";
  if (deadline && (["completed", "cancelled", "receipt_approved"].includes(a.status)
    || !a.scheduled_at || a.scheduled_at.getTime() + (job.event_type === "escalated" ? 60 * 60_000 : 0) > Date.now()
    || job.revision !== `deadline:${Math.floor(a.scheduled_at.getTime() / 1000)}:${a.driver_id}`)) {
    await pool.query(`UPDATE delivery_notification_outbox SET published_at=now(),claimed_until=NULL WHERE id=$1`, [job.id]);
    return;
  }
  // Stale new-driver work must not reach the former driver. The old driver can
  // still receive a context-free removal notice based on the immutable event.
  const previousDriver = job.event_type === "reassigned" && job.detail?.previousDriverId !== driverFromEvent(job)
    && job.detail?.previousDriverId && await activeDriver(job.detail.previousDriverId)
    ? job.detail.previousDriverId : null;
  const s = staleAssignment ? null : await sourceFor(a);
  if (!staleAssignment && !s) throw new Error(`Delivery source ${a.source_type}/${a.source_id} missing`);
  const targets = staleAssignment ? [] : await recipients(a, s!, job.event_type);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    for (const id of targets) {
      const branch = job.event_type === "awaiting_receipt" ? s!.destination : s!.source;
      await c.query(`INSERT INTO system_notifications
        (title,content,message_type,display_style,priority,target_all_branches,target_branch_ids,
         target_user_ids,button_text,button_action,show_once,auto_generated,auto_source,access_module,access_branch_ids,
         dedupe_key,created_by)
        VALUES ($1,$2,'delivery_task','banner',3,false,$3,$4,'فتح مهمة التوصيل',$5,true,true,
          'delivery_task','delivery_tasks',$3,$6,$7)
        ON CONFLICT (dedupe_key) DO NOTHING`, [
         copy[job.event_type].title,
         assignmentEvent(job.event_type) && a.scheduled_at
           ? `${copy[job.event_type].content} الموعد: ${a.scheduled_at.toISOString()}.`
           : copy[job.event_type].content,
        branch ? [branch] : [], [id],
        `/driver-deliveries?deliveryId=${encodeURIComponent(a.id)}`,
        `delivery:${job.id}:${id}`, a.created_by,
      ]);
    }
    if (previousDriver) {
      await c.query(`INSERT INTO system_notifications
        (title,content,message_type,display_style,priority,target_all_branches,target_branch_ids,
         target_user_ids,show_once,auto_generated,auto_source,access_module,access_branch_ids,
         dedupe_key,created_by)
        VALUES ('أزيل إسناد مهمة توصيل','لم تعد إحدى مهام التوصيل مسندة إليك.','delivery_task',
          'banner',3,false,ARRAY[]::text[],$1,true,true,'delivery_task','delivery_tasks',
          ARRAY[]::text[],$2,$3)
        ON CONFLICT (dedupe_key) DO NOTHING`,
      [[previousDriver], `delivery:${job.id}:${previousDriver}:removed`, a.created_by]);
    }
    await c.query(`UPDATE delivery_notification_outbox SET published_at=now(),claimed_until=NULL
      WHERE id=$1`, [job.id]);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally { c.release(); }
}

export async function sweepDeliveryNotices(): Promise<void> {
  await queueOverdueDeliveryNotices();
  for (let i = 0; i < 25; i++) {
    const job = await claim();
    if (!job) break;
    try {
      await publish(job);
    } catch (error) {
      await pool.query(`UPDATE delivery_notification_outbox
        SET last_error=$2,claimed_until=NULL,
          available_at=now()+least(interval '1 hour',interval '1 minute' * power(2,least(attempts,6)))
        WHERE id=$1`, [job.id, String(error).slice(0, 500)]);
      console.error("[delivery-notifications] notice retry scheduled:", error);
    }
  }
}