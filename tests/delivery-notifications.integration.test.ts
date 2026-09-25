import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import {
  enqueueDeliveryNotice, filterAuthorizedDeliveryNoticeUsers,
  queueOverdueDeliveryNotices, sweepDeliveryNotices,
} from "../server/delivery-notifications";

const prefix = `notice-${randomUUID()}`;
let connection: pg.Pool;
let taskId: number;
let eventId: number;
let driver: string;
let newDriver: string;
let manager: string;
let receiver: string;
let source: string;
let destination: string;
let transferId: number;
const noticeScope = (row: any) => ({
  dedupeKey: row.dedupe_key, targetUserIds: row.target_user_ids,
});

describe("delivery notice outbox (local PostgreSQL only)", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || "postgres://invalid/");
    if (process.env.USE_SUPABASE === "true" || url.hostname !== "helium" || url.pathname !== "/heliumdb")
      throw Error("Delivery notice integration test requires local heliumdb; remote writes refused");
    connection = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await connection.query("SELECT current_database() name");
    if (rows[0].name !== "heliumdb") throw Error("Unexpected database; remote writes refused");
    await connection.query(readFileSync("migrations/delivery_notification_outbox.sql", "utf8"));
    await connection.query(readFileSync("migrations/delivery_assignment_notices.sql", "utf8"));
    source = `${prefix}-source`; destination = `${prefix}-destination`;
    driver = `${prefix}-driver`; newDriver = `${prefix}-new-driver`;
    manager = `${prefix}-manager`; receiver = `${prefix}-receiver`;
    await connection.query("INSERT INTO branches (id,name) VALUES ($1,$3),($2,$4)",
      [source, destination, source, destination]);
    await connection.query(`INSERT INTO users (id,first_name,role,branch_id,job_title,is_active)
      VALUES ($1,$4,'employee',$3,'delivery','active'),
      ($2,$5,'employee',$3,'manager','active')`, [driver, manager, source, driver, manager]);
    await connection.query(`INSERT INTO users (id,first_name,role,branch_id,job_title,is_active)
      VALUES ($1,$1,'employee',$2,'delivery','active')`, [newDriver, source]);
    await connection.query(`INSERT INTO user_permissions (user_id,module,actions)
      VALUES ($1,'warehouse',ARRAY['view','edit']::text[])`, [manager]);
    await connection.query(`INSERT INTO users (id,first_name,role,branch_id,job_title,is_active)
      VALUES ($1,$2,'employee',$3,'manager','active')`, [receiver, receiver, destination]);
    await connection.query(`INSERT INTO user_permissions (user_id,module,actions)
      VALUES ($1,'warehouse',ARRAY['view','edit']::text[])`, [receiver]);
    const transfer = await connection.query(`INSERT INTO material_transfers
      (transfer_number,source_type,source_branch_id,destination_branch_id,transfer_date,status,created_by)
      VALUES ($1,'branch',$2,$3,current_date::text,'in_transit',$4) RETURNING id`,
      [prefix, source, destination, manager]);
    transferId = transfer.rows[0].id;
    const a = await connection.query(`INSERT INTO delivery_assignments
      (source_type,source_id,driver_id,vehicle_number,scheduled_at,created_by)
      VALUES ('material_transfer',$1,$2,'test',now()-interval '70 minutes',$3) RETURNING id`,
      [transferId, driver, manager]);
    taskId = Number(a.rows[0].id);
    const e = await connection.query(`INSERT INTO delivery_assignment_events
      (assignment_id,actor_id,action,to_status) VALUES ($1,$2,'fail','failed') RETURNING id`, [taskId, driver]);
    eventId = Number(e.rows[0].id);
  });

  afterAll(async () => {
    if (!connection) return;
    try {
      await connection.query(`DELETE FROM system_notifications
        WHERE dedupe_key IN (SELECT 'delivery:' || id || ':' || $2 || ':removed'
          FROM delivery_notification_outbox WHERE assignment_id=$1)
          OR (auto_source='delivery_task' AND button_action=$3)`,
        [taskId, driver, `/driver-deliveries?deliveryId=${taskId}`]);
      await connection.query("DELETE FROM delivery_notification_outbox WHERE assignment_id=$1", [taskId]);
      await connection.query("DELETE FROM delivery_assignment_events WHERE assignment_id=$1", [taskId]);
      await connection.query("DELETE FROM delivery_assignments WHERE id=$1", [taskId]);
      await connection.query("DELETE FROM material_transfers WHERE id=$1", [transferId]);
      await connection.query("DELETE FROM users WHERE id=ANY($1::varchar[])", [[driver, newDriver, manager, receiver]]);
      await connection.query("DELETE FROM branches WHERE id=ANY($1::varchar[])", [[source, destination]]);
    } finally { await connection.end(); }
  });

  it("enqueues transactionally; rollback discards event notice", async () => {
    const c = await connection.connect();
    try {
      await c.query("BEGIN");
      await enqueueDeliveryNotice(c, taskId, eventId, "failed");
      await c.query("ROLLBACK");
      const { rows } = await connection.query(`SELECT count(*)::int count FROM delivery_notification_outbox
        WHERE assignment_id=$1 AND event_type='failed'`, [taskId]);
      expect(rows[0].count).toBe(0);
    } finally { c.release(); }
  });

  it("publishes assignments only to the current driver, revokes stale access and dedupes retries", async () => {
    const first = await connection.query(`INSERT INTO delivery_assignment_events
      (assignment_id,actor_id,action,to_status,detail)
      VALUES ($1,$2,'create','assigned',$3::jsonb) RETURNING id`,
      [taskId, manager, JSON.stringify({ driverId: driver })]);
    const c = await connection.connect();
    try {
      await c.query("BEGIN");
      await enqueueDeliveryNotice(c, taskId, first.rows[0].id, "assigned");
      await enqueueDeliveryNotice(c, taskId, first.rows[0].id, "assigned");
      await c.query("COMMIT");
    } finally { c.release(); }
    await sweepDeliveryNotices();
    const firstNotice = await connection.query(`SELECT n.* FROM system_notifications n
      JOIN delivery_notification_outbox o ON n.dedupe_key='delivery:'||o.id||':'||$2
      WHERE o.event_id=$1 AND o.event_type='assigned'`, [first.rows[0].id, driver]);
    expect(firstNotice.rows).toHaveLength(1);
    expect(firstNotice.rows[0].button_action).toBe(`/driver-deliveries?deliveryId=${taskId}`);
    expect(firstNotice.rows[0].content).toContain("الموعد");
    expect(await filterAuthorizedDeliveryNoticeUsers(noticeScope(firstNotice.rows[0]), [driver, newDriver])).toEqual([driver]);

    const c2 = await connection.connect();
    let secondEvent: number;
    try {
      await c2.query("BEGIN");
      await c2.query(`UPDATE delivery_assignments SET driver_id=$2,scheduled_at=now()+interval '2 hours'
        WHERE id=$1`, [taskId, newDriver]);
      const e = await c2.query(`INSERT INTO delivery_assignment_events
        (assignment_id,actor_id,action,from_status,to_status,detail)
        VALUES ($1,$2,'reassign','assigned','assigned',$3::jsonb) RETURNING id`,
        [taskId, manager, JSON.stringify({ previousDriverId: driver, driverId: newDriver })]);
      secondEvent = e.rows[0].id;
      await enqueueDeliveryNotice(c2, taskId, secondEvent, "reassigned");
      await enqueueDeliveryNotice(c2, taskId, secondEvent, "reassigned");
      await c2.query("COMMIT");
    } finally { c2.release(); }
    expect(await filterAuthorizedDeliveryNoticeUsers(noticeScope(firstNotice.rows[0]), [driver, newDriver])).toEqual([]);
    await sweepDeliveryNotices();
    const notices = await connection.query(`SELECT n.* FROM system_notifications n
      JOIN delivery_notification_outbox o ON n.dedupe_key LIKE 'delivery:'||o.id||':%'
      WHERE o.event_id=$1`, [secondEvent!]);
    const replacement = notices.rows.find(n => n.target_user_ids.includes(newDriver));
    const removed = notices.rows.find(n => n.target_user_ids.includes(driver));
    expect(notices.rows).toHaveLength(2);
    expect(replacement.button_action).toBe(`/driver-deliveries?deliveryId=${taskId}`);
    expect(removed.button_action).toBeNull();
    expect(removed.content).not.toContain(String(taskId));
    expect(removed.content).not.toContain(prefix);
    expect(await filterAuthorizedDeliveryNoticeUsers(noticeScope(removed), [driver, newDriver])).toEqual([driver]);
    expect(await filterAuthorizedDeliveryNoticeUsers(noticeScope(replacement), [driver, newDriver])).toEqual([newDriver]);
    await connection.query("UPDATE users SET is_active='inactive' WHERE id=$1", [newDriver]);
    expect(await filterAuthorizedDeliveryNoticeUsers(noticeScope(replacement), [newDriver])).toEqual([]);
    await connection.query("UPDATE users SET is_active='active' WHERE id=$1", [newDriver]);
    await connection.query(`UPDATE delivery_assignments SET scheduled_at=now()+interval '3 hours'
      WHERE id=$1`, [taskId]);
    await sweepDeliveryNotices();
    const scheduled = await connection.query(`SELECT count(*)::int count FROM delivery_notification_outbox
      WHERE assignment_id=$1 AND event_type='reassigned'`, [taskId]);
    expect(scheduled.rows[0].count).toBe(1);
    await connection.query(`UPDATE delivery_notification_outbox SET published_at=NULL,available_at=now()
      WHERE event_id=$1`, [secondEvent!]);
    await sweepDeliveryNotices();
    const duplicate = await connection.query(`SELECT count(*)::int count FROM system_notifications n
      JOIN delivery_notification_outbox o ON n.dedupe_key LIKE 'delivery:'||o.id||':%'
      WHERE o.event_id=$1`, [secondEvent!]);
    expect(duplicate.rows[0].count).toBe(2);

    // Future reassignment suppresses a still-pending previous driver's task link.
    const third = await connection.query(`INSERT INTO delivery_assignment_events
      (assignment_id,actor_id,action,to_status,detail)
      VALUES ($1,$2,'create','assigned',$3::jsonb) RETURNING id`,
      [taskId, manager, JSON.stringify({ driverId: newDriver })]);
    const c3 = await connection.connect();
    try {
      await c3.query("BEGIN");
      await enqueueDeliveryNotice(c3, taskId, third.rows[0].id, "assigned");
      await c3.query("COMMIT");
    } finally { c3.release(); }
    await connection.query("UPDATE delivery_assignments SET driver_id=$2 WHERE id=$1", [taskId, driver]);
    await sweepDeliveryNotices();
    const stale = await connection.query(`SELECT count(*)::int count FROM system_notifications n
      JOIN delivery_notification_outbox o ON n.dedupe_key='delivery:'||o.id||':'||$2
      WHERE o.event_id=$1`, [third.rows[0].id, newDriver]);
    expect(stale.rows[0].count).toBe(0);
    await connection.query(`UPDATE delivery_assignments
      SET scheduled_at=now()-interval '70 minutes' WHERE id=$1`, [taskId]);
  });

  it("dedupes transition and deadline revisions under concurrent sweeps", async () => {
    const c = await connection.connect();
    try {
      await c.query("BEGIN");
      await enqueueDeliveryNotice(c, taskId, eventId, "failed");
      await enqueueDeliveryNotice(c, taskId, eventId, "failed");
      await c.query("COMMIT");
    } finally { c.release(); }
    await Promise.all([queueOverdueDeliveryNotices(), queueOverdueDeliveryNotices()]);
    const { rows } = await connection.query(`SELECT event_type,count(*)::int count
      FROM delivery_notification_outbox WHERE assignment_id=$1 GROUP BY event_type`, [taskId]);
    expect(Object.fromEntries(rows.map(r => [r.event_type, r.count])))
      .toMatchObject({ failed: 1, overdue: 1, escalated: 1 });
  });

  it("routes proof to destination editors, not source or unrelated branches", async () => {
    const e = await connection.query(`INSERT INTO delivery_assignment_events
      (assignment_id,actor_id,action,from_status,to_status)
      VALUES ($1,$2,'proof','in_transit','awaiting_receipt') RETURNING id`, [taskId, driver]);
    const c = await connection.connect();
    try {
      await c.query("BEGIN");
      await enqueueDeliveryNotice(c, taskId, e.rows[0].id, "awaiting_receipt");
      await c.query("COMMIT");
    } finally { c.release(); }
    await sweepDeliveryNotices();
    const { rows } = await connection.query(`SELECT n.target_user_ids,n.dedupe_key FROM system_notifications n
      WHERE n.auto_source='delivery_task' AND n.button_action=$1
        AND n.title='استلام يحتاج إلى إجراء'`, [`/driver-deliveries?deliveryId=${taskId}`]);
    expect(rows.some(r => r.target_user_ids[0] === receiver)).toBe(true);
    expect(rows.flatMap(r => r.target_user_ids)).not.toContain(manager);
    expect(rows.flatMap(r => r.target_user_ids)).not.toContain(driver);
    const receiverNotice = rows.find(r => r.target_user_ids[0] === receiver);
    expect(await filterAuthorizedDeliveryNoticeUsers({
      dedupeKey: receiverNotice.dedupe_key, targetUserIds: receiverNotice.target_user_ids,
    } as any, [manager, driver, receiver])).toEqual([receiver]);
  });

  it("publishes only authorized users, retries idempotently and hides revoked access", async () => {
    await Promise.all([sweepDeliveryNotices(), sweepDeliveryNotices()]);
    const { rows } = await connection.query(`SELECT n.* FROM system_notifications n
      WHERE n.auto_source='delivery_task' AND $1=ANY(n.target_user_ids)`, [manager]);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(r => !r.content.includes(prefix) && r.target_user_ids.length === 1)).toBe(true);
    expect((await filterAuthorizedDeliveryNoticeUsers({
      dedupeKey: rows[0].dedupe_key, targetUserIds: rows[0].target_user_ids,
    } as any, [manager, driver]))).toEqual([manager]);
    await connection.query("UPDATE users SET is_active='inactive' WHERE id=$1", [manager]);
    expect(await filterAuthorizedDeliveryNoticeUsers({
      dedupeKey: rows[0].dedupe_key, targetUserIds: rows[0].target_user_ids,
    } as any, [manager])).toEqual([]);
    await sweepDeliveryNotices();
    const { rows: again } = await connection.query(`SELECT count(*)::int count FROM system_notifications
      WHERE auto_source='delivery_task' AND $1=ANY(target_user_ids)`, [manager]);
    expect(again[0].count).toBe(rows.length);
  });

  it("retries a transient source lookup failure without losing the committed state", async () => {
    const e = await connection.query(`INSERT INTO delivery_assignment_events
      (assignment_id,actor_id,action,from_status,to_status)
      VALUES ($1,$2,'approve-receipt','awaiting_receipt','receipt_approved') RETURNING id`,
      [taskId, receiver]);
    const c = await connection.connect();
    try {
      await c.query("BEGIN");
      await enqueueDeliveryNotice(c, taskId, e.rows[0].id, "receipt_approved");
      await c.query("COMMIT");
    } finally { c.release(); }
    await connection.query("UPDATE delivery_assignments SET source_id=-1 WHERE id=$1", [taskId]);
    try {
      await sweepDeliveryNotices();
      const { rows } = await connection.query(`SELECT published_at,last_error,attempts
        FROM delivery_notification_outbox WHERE assignment_id=$1 AND event_type='receipt_approved'`, [taskId]);
      expect(rows[0].published_at).toBeNull();
      expect(rows[0].last_error).toContain("missing");
      expect(rows[0].attempts).toBe(1);
    } finally {
      await connection.query("UPDATE delivery_assignments SET source_id=$2 WHERE id=$1", [taskId, transferId]);
    }
    await connection.query(`UPDATE delivery_notification_outbox SET available_at=now()
      WHERE assignment_id=$1 AND event_type='receipt_approved'`, [taskId]);
    await sweepDeliveryNotices();
    const { rows } = await connection.query(`SELECT published_at,attempts
      FROM delivery_notification_outbox WHERE assignment_id=$1 AND event_type='receipt_approved'`, [taskId]);
    expect(rows[0].published_at).not.toBeNull();
    expect(rows[0].attempts).toBe(2);
  });

  it("stops overdue and escalation after cancellation", async () => {
    await connection.query("UPDATE delivery_assignments SET status='cancelled' WHERE id=$1", [taskId]);
    await connection.query(`DELETE FROM delivery_notification_outbox
      WHERE assignment_id=$1 AND event_type IN ('overdue','escalated')`, [taskId]);
    await queueOverdueDeliveryNotices();
    const { rows } = await connection.query(`SELECT count(*)::int count FROM delivery_notification_outbox
      WHERE assignment_id=$1 AND event_type IN ('overdue','escalated')`, [taskId]);
    expect(rows[0].count).toBe(0);
  });
});