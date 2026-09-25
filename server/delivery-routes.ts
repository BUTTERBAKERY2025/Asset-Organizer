import type { Express, Request, Response } from "express";
import type { PoolClient } from "pg";
import { inflateSync } from "node:zlib";
import { z } from "zod";
import { pool } from "./db";
import { enqueueDeliveryNotice, type DeliveryNoticeEvent } from "./delivery-notifications";
import { isAuthenticated, requirePermission, getAllowedBranchIds, canAccessBranch } from "./auth";
import { deliveryTransitionAllowed, receiptMatchesSource, type DeliveryDTO, type DeliverySource, type DeliverySourceType, type DeliveryStatus } from "@shared/delivery";

type Assignment = {
  id: string; source_type: DeliverySourceType; source_id: number; driver_id: string;
  driver_name: string; vehicle_number: string; scheduled_at: Date | null; status: DeliveryStatus;
  receiver_name: string | null; notes: string | null; signature_data: string | null; proof_at: Date | null;
  receipt_approved_by: string | null; receipt_approved_at: Date | null; started_at: Date | null;
  completed_at: Date | null; failed_at: Date | null; failure_reason: string | null;
  cancelled_at: Date | null; cancellation_reason: string | null;
  created_at: Date; updated_at: Date;
};
type SourceRow = DeliverySource & { receivedBy: string | null };
const idSchema = z.coerce.number().int().positive();
const createSchema = z.object({
  sourceType: z.enum(["kitchen", "material_transfer", "finished_goods_transfer", "kitchen_warehouse_shipment"]), sourceId: z.number().int().positive(),
  driverId: z.string().min(1), vehicleNumber: z.string().trim().min(1).max(80),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
}).strict();
const proofSchema = z.object({
  signatureData: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/).max(400_000).min(120),
  receiverName: z.string().trim().min(2).max(160), notes: z.string().trim().max(2000).optional(),
}).strict();
function validateSignature(dataUrl: string) {
  const bytes = Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
  const invalid = () => { throw new DeliveryError("A valid drawn PNG signature is required", 400); };
  if (bytes.length < 100 || bytes.length > 300_000
    || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) invalid();
  // Parsing chunks (rather than searching for the words IDAT/IEND) rejects
  // arbitrary base64 masquerading as a PNG, truncated files and bad CRCs.
  let offset = 8;
  let width = 0, height = 0, channels = 0, seenImage = false, ended = false;
  const compressed: Buffer[] = [];
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset);
    if (size > bytes.length - offset - 12) invalid();
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    let crc = 0xffffffff;
    for (let i = offset + 4; i < offset + 8 + size; i++) {
      crc ^= bytes[i];
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    if (((crc ^ 0xffffffff) >>> 0) !== bytes.readUInt32BE(offset + 8 + size)) invalid();
    if (offset === 8) {
      if (type !== "IHDR" || size !== 13) invalid();
      width = bytes.readUInt32BE(offset + 8); height = bytes.readUInt32BE(offset + 12);
      const depth = bytes[offset + 16], color = bytes[offset + 17];
      channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[color];
      if (width < 100 || width > 4096 || height < 40 || height > 4096
        || depth !== 8 || !channels || bytes[offset + 18] !== 0
        || bytes[offset + 19] !== 0 || bytes[offset + 20] !== 0) invalid();
    } else if (type === "IDAT") {
      seenImage = true;
      compressed.push(bytes.subarray(offset + 8, offset + 8 + size));
    } else if (type === "IEND") {
      if (size !== 0 || !seenImage || offset + 12 !== bytes.length) invalid();
      ended = true;
      break;
    } else if (!/^[a-zA-Z]{4}$/.test(type) || type[0] === type[0].toUpperCase()) invalid();
    offset += size + 12;
  }
  if (!ended) invalid();
  const expected = height * (1 + width * channels);
  // Do not inflate a compression bomb into process memory.
  if (expected > 8_000_000) invalid();
  try {
    const pixels = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected + 1 });
    if (pixels.length !== expected) invalid();
    for (let row = 0; row < height; row++) if (pixels[row * (1 + width * channels)] > 4) invalid();
  } catch { invalid(); }
}
const reassignmentSchema = z.object({ driverId: z.string().min(1), vehicleNumber: z.string().trim().min(1).max(80) }).strict();
const failSchema = z.object({ reason: z.string().trim().min(3).max(2000) }).strict();
const cancelSchema = failSchema;

class DeliveryError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
function requireUser(req: Request) {
  if (!req.currentUser) throw new DeliveryError("Authentication required", 401);
  return req.currentUser;
}
function managerScope(req: Request, source: SourceRow, action: "view" | "create" | "edit") {
  const allowed = getAllowedBranchIds(req);
  if (source.sourceBranchId === null) return false;
  if (source.sourceType === "kitchen_warehouse_shipment"
    && !["admin", "operations_manager", "production_development_manager"].includes(req.currentUser?.role ?? ""))
    return false;
  if (source.sourceType === "material_transfer" && source.sourceBranchId === "main_warehouse") {
    return req.currentUser?.role === "admin" || req.currentUser?.role === "production_development_manager"
      || (req.currentUser?.branchId === "main_warehouse" && allowed !== null && allowed.includes("main_warehouse"));
  }
  return allowed === null || (source.sourceBranchId !== null && allowed.includes(source.sourceBranchId));
}
// Always run the actual middleware: permissions include role templates and revocations,
// neither of which are faithfully represented by querying the raw permission table.
function permitted(req: Request, _res: Response, module: string, action: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const response = { status: (_status: number) => response, json: (_body: unknown) => resolve(false) } as unknown as Response;
    Promise.resolve(requirePermission(module, action)(req, response, (err?: any) => err ? reject(err) : resolve(true))).catch(reject);
  });
}
const sourceModule = (type: DeliverySourceType) =>
  type === "kitchen" ? "central_kitchen_orders"
    : type === "material_transfer" ? "warehouse" : "production";
const sourceTable = (type: DeliverySourceType) => ({
  kitchen: "central_kitchen_orders", material_transfer: "material_transfers",
  finished_goods_transfer: "finished_goods_transfers", kitchen_warehouse_shipment: "kitchen_warehouse_shipments",
})[type];
const sourceDispatched = (s: SourceRow) =>
  s.sourceType === "kitchen" ? s.sourceStatus === "dispatched"
    : s.sourceType === "material_transfer" || s.sourceType === "finished_goods_transfer"
      ? ["in_transit", "dispatched"].includes(s.sourceStatus)
      : s.sourceStatus === "dispatched";
const warehouseReceiver = (req: Request) =>
  ["admin", "operations_manager"].includes(req.currentUser?.role ?? "") && getAllowedBranchIds(req) === null;
const receiverScope = async (req: Request, s: SourceRow) =>
  s.destinationWarehouseId != null ? warehouseReceiver(req) : s.destinationBranchId !== null && await canAccessBranch(req, s.destinationBranchId);
const isDriver = (req: Request, row: Assignment) => req.currentUser?.id === row.driver_id && req.currentUser?.jobTitle === "delivery" && req.currentUser?.isActive === "active";
async function driverExists(client: PoolClient, id: string, req: Request) {
  const allowed = getAllowedBranchIds(req);
  const result = await client.query(`SELECT id FROM users WHERE id = $1 AND job_title = 'delivery'
    AND is_active = 'active' AND ($2::text[] IS NULL OR branch_id=ANY($2::text[]))`, [id, allowed]);
  if (!result.rowCount) throw new DeliveryError("Selected driver is not an active delivery account", 400);
}
async function source(client: PoolClient, type: DeliverySourceType, id: number): Promise<SourceRow | null> {
  const kitchen = type === "kitchen";
  const q = type === "kitchen_warehouse_shipment"
    ? `SELECT s.id,s.status,('#' || s.id::text || ' · ' || s.product_name) label,
         s.source_branch_id source_id, NULL::varchar destination_id, s.destination_warehouse_id,
         s.received_by, b.name source_name,w.name destination_name,
         jsonb_build_array(jsonb_build_object('id',s.id,'name',s.product_name,'quantity',s.quantity,'unit',s.unit)) items
       FROM kitchen_warehouse_shipments s JOIN branches b ON b.id=s.source_branch_id
       JOIN managed_warehouses w ON w.id=s.destination_warehouse_id WHERE s.id=$1`
    : type === "finished_goods_transfer"
    ? `SELECT t.id,t.status,('#' || t.id::text || ' · ' || t.product_name) label,
         t.source_branch_id source_id,t.destination_branch_id destination_id,NULL::bigint destination_warehouse_id,
         t.received_by,sb.name source_name,db.name destination_name,
         jsonb_build_array(jsonb_build_object('id',t.id,'name',t.product_name,'quantity',t.quantity,'unit',t.unit)) items
       FROM finished_goods_transfers t JOIN branches sb ON sb.id=t.source_branch_id
       JOIN branches db ON db.id=t.destination_branch_id
       WHERE t.id=$1 AND t.destination_type='branch' AND t.transport_policy='branch_receipt'`
    : kitchen
    ? `SELECT o.id, o.status, o.order_number label, o.central_kitchen_id source_id, o.request_branch_id destination_id,
         o.received_by, sb.name source_name, db.name destination_name,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.product_name,
           'quantity', COALESCE(i.dispatched_quantity,0), 'unit', i.unit) ORDER BY i.id)
           FROM central_kitchen_order_items i WHERE i.order_id=o.id), '[]'::jsonb) items
       FROM central_kitchen_orders o JOIN branches sb ON sb.id=o.central_kitchen_id
       JOIN branches db ON db.id=o.request_branch_id WHERE o.id=$1`
    : `SELECT t.id, t.status, t.transfer_number label, t.source_branch_id source_id, t.destination_branch_id destination_id,
         t.received_by, COALESCE(sb.name, 'المستودع الرئيسي') source_name, db.name destination_name,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name', i.item_name,
           'quantity', i.quantity, 'unit', i.unit) ORDER BY i.id)
           FROM material_transfer_items i WHERE i.transfer_id=t.id), '[]'::jsonb) items
       FROM material_transfers t LEFT JOIN branches sb ON sb.id=t.source_branch_id
       JOIN branches db ON db.id=t.destination_branch_id WHERE t.id=$1`;
  const { rows } = await client.query(q, [id]);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    sourceType: type, sourceId: Number(id), sourceStatus: r.status, sourceLabel: r.label,
    sourceBranchId: r.source_id, sourceBranchName: r.source_name, destinationBranchId: r.destination_id,
    destinationWarehouseId: r.destination_warehouse_id == null ? null : Number(r.destination_warehouse_id),
    destinationBranchName: r.destination_name, receivedBy: r.received_by,
    items: r.items.map((item: any) => ({ ...item, quantity: Number(item.quantity) })),
  };
}
const assignmentQuery = `SELECT a.*, concat_ws(' ', u.first_name, u.last_name) AS driver_name
  FROM delivery_assignments a JOIN users u ON u.id=a.driver_id`;
async function assignment(client: PoolClient, id: number, lock = false): Promise<Assignment | null> {
  const { rows } = await client.query(`${assignmentQuery} WHERE a.id=$1${lock ? " FOR UPDATE OF a" : ""}`, [id]);
  return rows[0] || null;
}
async function dto(req: Request, res: Response, client: PoolClient, row: Assignment, src?: SourceRow): Promise<DeliveryDTO> {
  const s = src || await source(client, row.source_type, row.source_id);
  if (!s) throw new DeliveryError("Linked source no longer exists", 409);
  const driver = isDriver(req, row);
  const manager = !driver && managerScope(req, s, "view") && await permitted(req, res, sourceModule(s.sourceType), "view")
    && await permitted(req, res, "delivery_tasks", "view");
  // Receipt rights are destination-specific and must grant a write action.
  const destination = await receiverScope(req, s);
  const receiver = !driver && destination && await permitted(req, res, s.destinationWarehouseId != null ? "warehouse" : sourceModule(s.sourceType), "edit")
    && await permitted(req, res, "delivery_tasks", "approve");
  if (!driver && !manager && !receiver) throw new DeliveryError("Delivery is outside your scope", 403);
  const managerWrite = manager && await permitted(req, res, "delivery_tasks", "edit")
    && await permitted(req, res, sourceModule(s.sourceType), "edit");
  const eligibleReceipt = receiptMatchesSource(s.sourceType, s.sourceStatus, s.receivedBy, requireUser(req).id);
  const iso = (v: Date | null) => v ? new Date(v).toISOString() : null;
  return {
    ...s, id: Number(row.id), driverId: row.driver_id, driverName: row.driver_name?.trim() || row.driver_id,
    vehicleNumber: row.vehicle_number, scheduledAt: iso(row.scheduled_at), status: row.status,
    receiverName: row.receiver_name, notes: row.notes, proofPresent: !!row.signature_data,
    proofAt: iso(row.proof_at), receiptApprovedBy: row.receipt_approved_by, receiptApprovedAt: iso(row.receipt_approved_at),
    startedAt: iso(row.started_at), completedAt: iso(row.completed_at), failedAt: iso(row.failed_at),
    failureReason: row.failure_reason, cancellationReason: row.cancellation_reason, createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    capabilities: {
      canStart: driver && deliveryTransitionAllowed(row.status, "start"),
      canSubmitProof: driver && deliveryTransitionAllowed(row.status, "proof"),
      canApproveReceipt: receiver && eligibleReceipt && !!row.signature_data && deliveryTransitionAllowed(row.status, "approve-receipt"),
      canComplete: driver && !!row.signature_data && !!row.receipt_approved_by
        && receiptMatchesSource(s.sourceType, s.sourceStatus, s.receivedBy, row.receipt_approved_by)
        && deliveryTransitionAllowed(row.status, "complete"),
      canFail: (driver || managerWrite) && sourceDispatched(s) && deliveryTransitionAllowed(row.status, "fail"),
      canReassign: managerWrite && sourceDispatched(s) && deliveryTransitionAllowed(row.status, "reassign"),
      canCancel: managerWrite && !eligibleSourceReceipt(s) && deliveryTransitionAllowed(row.status, "cancel"),
    },
  };
}
function eligibleSourceReceipt(s: SourceRow) {
  return s.sourceStatus === (s.sourceType === "material_transfer" ? "delivered" : "received");
}
function error(res: Response, e: unknown) {
  if (res.headersSent) return;
  if (e instanceof DeliveryError) return res.status(e.status).json({ error: e.message });
  if (e instanceof z.ZodError) return res.status(400).json({ error: "Invalid delivery payload", details: e.flatten() });
  if ((e as any)?.code === "23505") return res.status(409).json({ error: "This source already has an active assignment" });
  console.error("Delivery API error", e);
  return res.status(500).json({ error: "Delivery operation failed" });
}
async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { return await fn(client); } finally { client.release(); }
}
async function event(client: PoolClient, id: number, actor: string, action: string, oldStatus: string | null, status: string, detail: object = {}) {
  const inserted = await client.query(`INSERT INTO delivery_assignment_events (assignment_id, actor_id, action, from_status, to_status, detail)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [id, actor, action, oldStatus, status, JSON.stringify(detail)]);
  if (["proof", "approve-receipt", "fail", "cancel"].includes(action))
    await enqueueDeliveryNotice(client, id, Number(inserted.rows[0].id),
      ({ proof: "awaiting_receipt", "approve-receipt": "receipt_approved", fail: "failed", cancel: "cancelled" } as Record<string, DeliveryNoticeEvent>)[action]);
}

export function registerDeliveryRoutes(app: Express) {
  app.get("/api/deliveries/sources", isAuthenticated, async (req, res) => {
    try {
      const sources = await withClient(async client => {
        const list: DeliverySource[] = [];
        for (const type of ["kitchen", "material_transfer", "finished_goods_transfer", "kitchen_warehouse_shipment"] as const) {
          if (!(await permitted(req, res, "delivery_tasks", "create"))) throw new DeliveryError("Permission denied", 403);
          if (!(await permitted(req, res, sourceModule(type), "edit"))) continue;
          const table = sourceTable(type);
          const ids = await client.query(`SELECT s.id FROM ${table} s WHERE s.status=$1
             ${type === "finished_goods_transfer" ? "AND s.transport_policy='branch_receipt' AND s.destination_type='branch'" : ""}
             AND NOT EXISTS
            (SELECT 1 FROM delivery_assignments a WHERE a.source_type=$2 AND a.source_id=s.id)
            ORDER BY s.id DESC LIMIT 200`,
             [type === "kitchen" || type === "kitchen_warehouse_shipment" ? "dispatched" : "in_transit", type]);
          for (const item of ids.rows) {
            const s = await source(client, type, item.id);
            if (s && managerScope(req, s, "create")) {
              const { receivedBy: _private, ...publicSource } = s;
              list.push(publicSource);
            }
          }
        }
        return list;
      });
      if (!res.headersSent) res.json({ sources });
    } catch (e) { error(res, e); }
  });

  app.get("/api/deliveries/drivers", isAuthenticated, async (req, res) => {
    try {
      if (!(await permitted(req, res, "delivery_tasks", "create"))) throw new DeliveryError("Permission denied", 403);
      const allowed = getAllowedBranchIds(req);
      const drivers = await pool.query(`SELECT id, concat_ws(' ',first_name,last_name) name, job_title "jobTitle"
        FROM users WHERE job_title='delivery' AND is_active='active'
        AND ($1::text[] IS NULL OR branch_id=ANY($1::text[])) ORDER BY first_name,last_name`, [allowed]);
      res.json({ drivers: drivers.rows });
    } catch (e) { error(res, e); }
  });

  app.get("/api/deliveries/capabilities", isAuthenticated, async (req, res) => {
    try {
      const create = await permitted(req, res, "delivery_tasks", "create");
      const branchScope = getAllowedBranchIds(req);
      const hasBranch = branchScope === null || branchScope.length > 0;
      const canAssign = hasBranch && create && (await permitted(req, res, "warehouse", "edit")
        || await permitted(req, res, "central_kitchen_orders", "edit"));
      const canExport = hasBranch && await permitted(req, res, "delivery_tasks", "export")
        && (await permitted(req, res, "warehouse", "view") || await permitted(req, res, "central_kitchen_orders", "view"));
      res.json({ canAssign, canExport });
    } catch (e) { error(res, e); }
  });

  async function list(req: Request, res: Response, reports = false) {
    try {
      const from = req.query.from ? z.string().date().parse(req.query.from) : null;
      const to = req.query.to ? z.string().date().parse(req.query.to) : null;
      const sourceBranchId = req.query.sourceBranchId ? z.string().min(1).max(100).parse(req.query.sourceBranchId) : null;
      const destinationBranchId = req.query.destinationBranchId ? z.string().min(1).max(100).parse(req.query.destinationBranchId) : null;
      const status = req.query.status ? z.enum(["assigned", "in_transit", "awaiting_receipt", "receipt_approved", "completed", "failed", "cancelled"]).parse(req.query.status) : null;
      if (from && to && from > to) throw new DeliveryError("from must precede to", 400);
      const deliveries = await withClient(async client => {
        const { rows } = await client.query(`${assignmentQuery} WHERE ($1::date IS NULL OR a.created_at >= $1::date)
           AND ($2::date IS NULL OR a.created_at < $2::date + interval '1 day')
           AND ($3::text IS NULL OR a.status=$3)
           ORDER BY a.created_at DESC LIMIT 500`, [from, to, status]);
        const result: DeliveryDTO[] = [];
        for (const row of rows as Assignment[]) {
          const s = await source(client, row.source_type, row.source_id);
          if (!s) continue;
          if (sourceBranchId && s.sourceBranchId !== sourceBranchId) continue;
          if (destinationBranchId && s.destinationBranchId !== destinationBranchId) continue;
          if (!isDriver(req, row) && !(managerScope(req, s, "view") || await receiverScope(req, s))) continue;
          try { result.push(await dto(req, res, client, row, s)); }
          catch (e) { if (!(e instanceof DeliveryError) || e.status !== 403) throw e; }
        }
        return result;
      });
      if (res.headersSent) return;
      if (!reports) return res.json({ deliveries });
       const summary: Record<string, number> = { total: deliveries.length, assigned: 0, in_transit: 0, awaiting_receipt: 0, receipt_approved: 0, completed: 0, failed: 0, cancelled: 0 };
      deliveries.forEach(row => summary[row.status]++);
      res.json({ deliveries, summary });
    } catch (e) { error(res, e); }
  }
  app.get("/api/deliveries/reports", isAuthenticated, (req, res) => void list(req, res, true));
  app.get("/api/deliveries", isAuthenticated, (req, res) => void list(req, res));
  app.get("/api/deliveries/:id/proof", isAuthenticated, async (req, res) => {
    try {
      const id = idSchema.parse(req.params.id);
      const result = await withClient(async client => {
        const row = await assignment(client, id);
        if (!row) throw new DeliveryError("Delivery not found", 404);
        await dto(req, res, client, row);
        return {
          signatureData: row.signature_data, receiverName: row.receiver_name,
          proofAt: row.proof_at ? new Date(row.proof_at).toISOString() : null,
          receiptApprovedBy: row.receipt_approved_by,
          receiptApprovedAt: row.receipt_approved_at ? new Date(row.receipt_approved_at).toISOString() : null,
        };
      });
      res.setHeader("Cache-Control", "private, no-store");
      res.json(result);
    } catch (e) { error(res, e); }
  });
  app.get("/api/deliveries/:id", isAuthenticated, async (req, res) => {
    try {
      const id = idSchema.parse(req.params.id);
      const result = await withClient(async client => {
        const row = await assignment(client, id);
        if (!row) throw new DeliveryError("Delivery not found", 404);
        return dto(req, res, client, row);
      });
      if (!res.headersSent) res.json(result);
    } catch (e) { error(res, e); }
  });

  app.post("/api/deliveries", isAuthenticated, async (req, res) => {
    try {
      const payload = createSchema.parse(req.body);
      if (!(await permitted(req, res, "delivery_tasks", "create"))
        || !(await permitted(req, res, sourceModule(payload.sourceType), "edit"))) throw new DeliveryError("Permission denied", 403);
      const result = await withClient(async client => {
        await client.query("BEGIN");
        try {
          // Lock source to serialize with source status transitions and concurrent assignment.
           const table = sourceTable(payload.sourceType);
          const locked = await client.query(`SELECT id FROM ${table} WHERE id=$1 FOR UPDATE`, [payload.sourceId]);
          if (!locked.rowCount) throw new DeliveryError("Source not found", 404);
          const s = await source(client, payload.sourceType, payload.sourceId);
          if (!s || !managerScope(req, s, "create")) throw new DeliveryError("Source is outside your scope", 403);
           if (!sourceDispatched(s)) throw new DeliveryError("Source must already be dispatched", 409);
          await driverExists(client, payload.driverId, req);
          const inserted = await client.query(`INSERT INTO delivery_assignments
            (source_type,source_id,driver_id,vehicle_number,scheduled_at,created_by)
            VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [payload.sourceType, payload.sourceId, payload.driverId, payload.vehicleNumber, payload.scheduledAt || null, requireUser(req).id]);
          const id = Number(inserted.rows[0].id);
          await event(client, id, requireUser(req).id, "create", null, "assigned");
          await client.query("COMMIT");
          return id;
        } catch (e) { await client.query("ROLLBACK"); throw e; }
      });
      const delivery = await withClient(async client => dto(req, res, client, (await assignment(client, result))!));
      if (!res.headersSent) res.status(201).json(delivery);
    } catch (e) { error(res, e); }
  });

  for (const action of ["start", "proof", "approve-receipt", "complete", "fail", "reassign", "cancel"] as const) {
    app.post(`/api/deliveries/:id/${action}`, isAuthenticated, async (req, res) => {
      try {
        const id = idSchema.parse(req.params.id);
        const payload = action === "proof" ? proofSchema.parse(req.body)
           : action === "fail" ? failSchema.parse(req.body)
           : action === "cancel" ? cancelSchema.parse(req.body)
          : action === "reassign" ? reassignmentSchema.parse(req.body) : null;
        await withClient(async client => {
          await client.query("BEGIN");
          try {
            const row = await assignment(client, id, true);
            if (!row) throw new DeliveryError("Delivery not found", 404);
             await client.query(`SELECT id FROM ${sourceTable(row.source_type)} WHERE id=$1 FOR UPDATE`, [row.source_id]);
            const s = await source(client, row.source_type, row.source_id);
            if (!s) throw new DeliveryError("Linked source not found", 409);
            const driver = isDriver(req, row);
            const sourceManager = managerScope(req, s, "edit");
             const manager = (action === "fail" || action === "reassign" || action === "cancel") && sourceManager
              && await permitted(req, res, "delivery_tasks", "edit")
              && await permitted(req, res, sourceModule(s.sourceType), "edit");
             const receiver = action === "approve-receipt" && await receiverScope(req, s)
              && await permitted(req, res, "delivery_tasks", "approve")
               && await permitted(req, res, s.destinationWarehouseId != null ? "warehouse" : sourceModule(s.sourceType), "edit");
            if (res.headersSent) throw new DeliveryError("Permission denied", 403);
            if (action === "approve-receipt" ? !receiver
               : action === "reassign" || action === "cancel" ? !manager
              : action === "fail" ? !driver && !manager
              : !driver) throw new DeliveryError("Permission denied", 403);
            if (!deliveryTransitionAllowed(row.status, action)) throw new DeliveryError("Invalid delivery state transition", 409);
             if (["fail", "reassign", "cancel"].includes(action) && eligibleSourceReceipt(s))
               throw new DeliveryError("Source receipt already recorded; delivery cannot be reset or cancelled", 409);
             if (["fail", "reassign"].includes(action) && !sourceDispatched(s))
               throw new DeliveryError("Source is no longer dispatched; cannot restart delivery", 409);
             if (["start", "proof"].includes(action) && !sourceDispatched(s))
               throw new DeliveryError("Source is no longer awaiting receipt", 409);
            if (action === "proof") validateSignature((payload as z.infer<typeof proofSchema>).signatureData);
            if (action === "approve-receipt" || action === "complete") {
              if (!row.signature_data || !row.proof_at) throw new DeliveryError("Signature proof required", 409);
              if (!eligibleSourceReceipt(s)) throw new DeliveryError("Complete receipt in the source module first", 409);
              if (action === "approve-receipt" && !receiptMatchesSource(s.sourceType, s.sourceStatus, s.receivedBy, requireUser(req).id))
                throw new DeliveryError("Only the authenticated source receipt actor can approve", 403);
              if (action === "complete" && (!row.receipt_approved_by
                || !receiptMatchesSource(s.sourceType, s.sourceStatus, s.receivedBy, row.receipt_approved_by)))
                throw new DeliveryError("Receiver approval must match the current source receipt actor", 409);
            }
            if (action === "reassign") await driverExists(client, (payload as z.infer<typeof reassignmentSchema>).driverId, req);
            const next: DeliveryStatus = ({
              start: "in_transit", proof: "awaiting_receipt", "approve-receipt": "receipt_approved",
               complete: "completed", fail: "failed", reassign: "assigned", cancel: "cancelled",
            } as const)[action];
            const values: any[] = [id, next];
            let updates = "status=$2, updated_at=now()";
            const set = (column: string, value: unknown) => { values.push(value); updates += `, ${column}=$${values.length}`; };
            if (action === "start") updates += ", started_at=now()";
            if (action === "proof") {
              const p = payload as z.infer<typeof proofSchema>;
              set("signature_data", p.signatureData); set("receiver_name", p.receiverName); set("notes", p.notes || null);
              updates += ", proof_at=now(), receipt_approved_by=NULL, receipt_approved_at=NULL";
            }
            if (action === "approve-receipt") { set("receipt_approved_by", requireUser(req).id); updates += ", receipt_approved_at=now()"; }
            if (action === "complete") updates += ", completed_at=now()";
            if (action === "fail") { set("failure_reason", (payload as z.infer<typeof failSchema>).reason); updates += ", failed_at=now()"; }
             if (action === "cancel") { set("cancellation_reason", (payload as z.infer<typeof cancelSchema>).reason); updates += ", cancelled_at=now()"; }
            if (action === "reassign") {
              const p = payload as z.infer<typeof reassignmentSchema>;
              set("driver_id", p.driverId); set("vehicle_number", p.vehicleNumber);
               updates += ", signature_data=NULL, receiver_name=NULL, notes=NULL, proof_at=NULL, receipt_approved_by=NULL, receipt_approved_at=NULL, started_at=NULL, failed_at=NULL, failure_reason=NULL, cancelled_at=NULL, cancellation_reason=NULL";
            }
            await client.query(`UPDATE delivery_assignments SET ${updates} WHERE id=$1`, values);
            await event(client, id, requireUser(req).id, action, row.status, next, action === "reassign"
               ? { previousDriverId: row.driver_id, previousVehicleNumber: row.vehicle_number,
                   previousProofAt: row.proof_at, previousReceiverName: row.receiver_name,
                   previousCancellationReason: row.cancellation_reason, previousFailureReason: row.failure_reason,
                   newDriverId: (payload as z.infer<typeof reassignmentSchema>).driverId }
               : action === "fail" || action === "cancel" ? { reason: (payload as z.infer<typeof failSchema>).reason, stockShipmentUnchanged: true } : {});
            await client.query("COMMIT");
          } catch (e) { await client.query("ROLLBACK"); throw e; }
        });
        if (res.headersSent) return;
        const result = await withClient(async client => dto(req, res, client, (await assignment(client, id))!));
        if (!res.headersSent) res.json(result);
      } catch (e) { error(res, e); }
    });
  }
}