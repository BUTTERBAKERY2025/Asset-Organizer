import type { Express, Request, Response } from "express";
import type { PoolClient } from "pg";
import { inflateSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import multer from "multer";
import { z } from "zod";
import { pool } from "./db";
import { enqueueDeliveryNotice, type DeliveryNoticeEvent } from "./delivery-notifications";
import { deliverySourceFingerprint } from "./delivery-dispatch-guard";
import { isAuthenticated, requirePermission, getAllowedBranchIds, canAccessBranch } from "./auth";
import { deliveryTransitionAllowed, receiptMatchesSource, type DeliveryDTO, type DeliverySource, type DeliverySourceType, type DeliveryStatus } from "@shared/delivery";
import { canAccessDeliveryWorkspace } from "@shared/delivery-workspace-access";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import { newPrivateAttachmentPath, PrivateAttachmentUnavailableError } from "./private-supabase-storage";
const objects = new ObjectStorageService();
const uploadEvidence = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: 10 * 1024 * 1024 } }).single("file");

type Assignment = {
  id: string; source_type: DeliverySourceType; source_id: number; driver_id: string | null;
  driver_name: string | null; vehicle_number: string | null; scheduled_at: Date | null; status: DeliveryStatus;
  transport_mode: "internal" | "external"; carrier: "road" | "naqel" | "other" | null;
  carrier_name: string | null; waybill: string | null; tracking_url: string | null; package_count: number | null;
  exception_reason: string | null; exception_resolution: string | null; exception_resolved_at: Date | null;
  receiver_name: string | null; notes: string | null; signature_data: string | null; proof_at: Date | null;
  receipt_approved_by: string | null; receipt_approved_at: Date | null; started_at: Date | null;
  completed_at: Date | null; failed_at: Date | null; failure_reason: string | null;
  cancelled_at: Date | null; cancellation_reason: string | null;
  handover_recorded_at: Date | null; handover_acknowledged_at: Date | null;
  handover_driver_id: string | null; handover_vehicle_number: string | null;
  handover_items: DeliverySource["items"] | null; handover_fingerprint: string | null; handover_revision: number;
  created_at: Date; updated_at: Date;
};
type SourceRow = DeliverySource & { receivedBy: string | null };
const idSchema = z.coerce.number().int().positive();
export const deliveryAssignmentCreateSchema = z.object({
  sourceType: z.enum(["kitchen", "material_transfer", "finished_goods_transfer", "kitchen_warehouse_shipment", "reverse_movement"]), sourceId: z.number().int().positive(),
  transportMode: z.enum(["internal", "external"]).optional(),
  driverId: z.string().min(1).optional(), vehicleNumber: z.string().trim().min(1).max(80).optional(),
  carrier: z.enum(["road", "naqel", "other"]).optional(), carrierName: z.string().trim().min(2).max(160).optional(),
  waybill: z.string().trim().min(1).max(160).optional(), trackingUrl: z.string().url().max(1000).optional(),
  packageCount: z.number().int().positive().max(100000).optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
}).strict();
const resolutionSchema = z.object({ resolution: z.string().trim().min(3).max(2000) }).strict();
export function validateTransport(p: z.infer<typeof deliveryAssignmentCreateSchema>) {
  if (p.transportMode === "external") {
    if (p.driverId || p.vehicleNumber || !p.carrier || !p.waybill || !p.packageCount
      || (p.carrier === "other" && !p.carrierName) || (p.carrier !== "other" && p.carrierName))
      throw new DeliveryError("External carrier fields invalid", 400);
    if (p.trackingUrl && new URL(p.trackingUrl).protocol !== "https:")
      throw new DeliveryError("Tracking URL must use HTTPS", 400);
  } else if (!p.driverId || !p.vehicleNumber || p.carrier || p.carrierName || p.waybill || p.trackingUrl || p.packageCount)
    throw new DeliveryError("Internal driver fields invalid", 400);
}
export function validateCarrierEvidence(file: { buffer: Buffer; mimetype: string }, kind: "shipment_photo" | "carrier_receipt") {
  const data = file.buffer;
  if (!data.length || data.length > 10 * 1024 * 1024)
    throw new DeliveryError("Evidence file must be nonempty and no larger than 10MB", 400);
  const detected = data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? ["image/png","png"]
    : data[0] === 255 && data[1] === 216 && data[2] === 255 ? ["image/jpeg","jpg"]
    : data.subarray(0,4).toString() === "RIFF" && data.subarray(8,12).toString() === "WEBP" ? ["image/webp","webp"]
    : data.subarray(0,5).toString() === "%PDF-" ? ["application/pdf","pdf"] : null;
  if (!detected || (kind === "shipment_photo" && detected[0] === "application/pdf")
    || file.mimetype !== detected[0]
    || (detected[0] === "image/jpeg" && (data[data.length-2] !== 255 || data[data.length-1] !== 217))
    || (detected[0] === "image/png" && !data.subarray(-12).equals(Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130])))
    || (detected[0] === "image/webp" && data.readUInt32LE(4) + 8 !== data.length)
    || (detected[0] === "application/pdf" && !data.subarray(-1024).toString("latin1").includes("%%EOF")))
    throw new DeliveryError("Unsupported file MIME/content", 400);
  return { mimeType: detected[0], extension: detected[1] };
}
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
// The manager records the actual quantities physically handed to the driver.
// Omitted lines on kitchen orders mean zero, never an implicit full dispatch.
const handoverSchema = z.object({
  items: z.array(z.object({ id: z.number().int().positive(), quantity: z.number().finite().nonnegative() }).strict()).min(1),
}).strict();
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
  if (req.currentUser?.role === "warehouse_keeper") {
    return (getAllowedBranchIds(req)?.includes("main_warehouse") ?? false)
      && source.sourceType === "material_transfer" && source.sourceBranchId === "main_warehouse";
  }
  const allowed = getAllowedBranchIds(req);
  if (source.sourceType === "reverse_movement" && source.sourceBranchId === null) {
    if (source.sourceWarehouseId != null) return warehouseReceiver(req);
    return mainWarehouseAuthority(req);
  }
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
    : type === "material_transfer" || type === "reverse_movement" || type === "kitchen_warehouse_shipment" ? "warehouse" : "production";
const sourceTable = (type: DeliverySourceType) => ({
  kitchen: "central_kitchen_orders", material_transfer: "material_transfers",
   finished_goods_transfer: "finished_goods_transfers", kitchen_warehouse_shipment: "kitchen_warehouse_shipments",
   reverse_movement: "reverse_movements",
})[type];
const sourceDispatched = (s: SourceRow) =>
   s.sourceType === "reverse_movement" ? ["dispatched","received","inspected"].includes(s.sourceStatus)
   :
  s.sourceType === "kitchen" ? s.sourceStatus === "dispatched"
    : s.sourceType === "material_transfer" || s.sourceType === "finished_goods_transfer"
      ? ["in_transit", "dispatched"].includes(s.sourceStatus)
      : s.sourceStatus === "dispatched";
const sourceAssignable = (s: SourceRow) => sourceDispatched(s) || ({
  kitchen: ["prepared"], material_transfer: ["approved"],
  finished_goods_transfer: ["pending"], kitchen_warehouse_shipment: ["requested"],
  reverse_movement: ["requested"],
} satisfies Record<DeliverySourceType, string[]>)[s.sourceType].includes(s.sourceStatus);
const sourceHandoverReady = (s: SourceRow) => sourceDispatched(s) || ({
  kitchen: ["prepared"], material_transfer: ["approved"],
  finished_goods_transfer: ["pending"], kitchen_warehouse_shipment: ["requested"],
  reverse_movement: ["requested"],
} satisfies Record<DeliverySourceType, string[]>)[s.sourceType].includes(s.sourceStatus);
const acknowledged = (row: Assignment) => !!row.handover_acknowledged_at
  && row.handover_driver_id === row.driver_id && row.handover_vehicle_number === row.vehicle_number;
const warehouseReceiver = (req: Request) =>
  ["admin", "operations_manager"].includes(req.currentUser?.role ?? "") && getAllowedBranchIds(req) === null;
const mainWarehouseAuthority = (req: Request) => warehouseReceiver(req)
  || req.currentUser?.role === "production_development_manager"
  || (req.currentUser?.role === "warehouse_keeper" && (getAllowedBranchIds(req)?.includes("main_warehouse") ?? false))
  || (req.currentUser?.branchId === "main_warehouse" && (getAllowedBranchIds(req)?.includes("main_warehouse") ?? false));
const receiverScope = async (req: Request, s: SourceRow) =>
  req.currentUser?.role === "warehouse_keeper" ? false :
  s.sourceType === "reverse_movement" && s.destinationBranchId === null
    ? s.destinationWarehouseId != null ? warehouseReceiver(req) : mainWarehouseAuthority(req)
    : s.destinationWarehouseId != null ? warehouseReceiver(req) : s.destinationBranchId !== null && await canAccessBranch(req, s.destinationBranchId);
const isDriver = (req: Request, row: Assignment) => req.currentUser?.role !== "warehouse_keeper"
  && req.currentUser?.id === row.driver_id && req.currentUser?.jobTitle === "delivery" && req.currentUser?.isActive === "active";
export function carrierClosureReady(
  receipt: { sourceType: DeliverySourceType; sourceStatus: string; receivedBy: string | null },
  assignment: { receiptApprovedBy: string | null; exceptionReason: string | null; handoverRecordedAt: Date | null },
  evidenceKinds: string[],
) {
  return !!assignment.handoverRecordedAt && !assignment.exceptionReason && !!assignment.receiptApprovedBy
    && ["shipment_photo", "carrier_receipt"].every(kind => evidenceKinds.includes(kind))
    && receiptMatchesSource(receipt.sourceType, receipt.sourceStatus, receipt.receivedBy, assignment.receiptApprovedBy);
}
export function carrierExceptionAllowed(
  status: DeliveryStatus, sourceAvailable: boolean, exceptionReason: string | null,
): boolean {
  return sourceAvailable && !exceptionReason
    && ["assigned", "in_transit", "awaiting_receipt", "receipt_approved"].includes(status);
}
async function driverExists(client: PoolClient, id: string, req: Request) {
  const allowed = req.currentUser?.role === "warehouse_keeper" ? null : getAllowedBranchIds(req);
  const result = await client.query(`SELECT id FROM users WHERE id = $1 AND job_title = 'delivery'
    AND is_active = 'active' AND ($2::text[] IS NULL OR branch_id=ANY($2::text[]))`, [id, allowed]);
  if (!result.rowCount) throw new DeliveryError("Selected driver is not an active delivery account", 400);
}
async function source(client: PoolClient, type: DeliverySourceType, id: number): Promise<SourceRow | null> {
  const kitchen = type === "kitchen";
  const q = type === "reverse_movement"
    ? `SELECT m.id,m.status,('#' || m.id::text || ' · ' || m.item_name) label,
         m.source_branch_id source_id,m.destination_branch_id destination_id,m.source_warehouse_id,
         m.destination_warehouse_id,
         (SELECT e.actor_id FROM reverse_movement_events e WHERE e.movement_id=m.id AND e.action='receive'
           ORDER BY e.id DESC LIMIT 1) received_by,
         COALESCE(sb.name,sw.name,'المستودع الرئيسي') source_name,
         COALESCE(db.name,dw.name,'المستودع الرئيسي') destination_name,
         jsonb_build_array(jsonb_build_object('id',m.id,'name',m.item_name,
           'quantity', CASE WHEN m.status IN ('dispatched','received','inspected') THEN m.shipped_quantity ELSE m.quantity END,
           'unit',m.unit)) items
       FROM reverse_movements m
       LEFT JOIN branches sb ON sb.id=m.source_branch_id
       LEFT JOIN branches db ON db.id=m.destination_branch_id
       LEFT JOIN managed_warehouses sw ON sw.id=m.source_warehouse_id
       LEFT JOIN managed_warehouses dw ON dw.id=m.destination_warehouse_id WHERE m.id=$1`
    : type === "kitchen_warehouse_shipment"
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
          COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'name',
            CASE WHEN COALESCE(i.substitute_quantity,0)>0
              THEN i.product_name || ' (' || COALESCE(i.prepared_quantity,0)::text || ' ' || i.unit || ') + '
                || COALESCE(i.substitute_product_name,'بديل') || ' (' || i.substitute_quantity::text || ' '
                || COALESCE(i.substitute_unit,i.unit) || ')' ELSE i.product_name END,
            'quantity', CASE WHEN o.status IN ('dispatched','received') THEN COALESCE(i.dispatched_quantity,0)
              ELSE COALESCE(i.prepared_quantity,0)+COALESCE(i.substitute_quantity,0) END, 'unit', i.unit,
            'originalQuantity',COALESCE(i.prepared_quantity,0),
            'substituteQuantity',COALESCE(i.substitute_quantity,0),
            'substituteProductId',i.substitute_product_id,
            'substituteWarehouseItemId',i.substitute_warehouse_item_id,
            'substituteName',i.substitute_product_name,'substituteUnit',i.substitute_unit) ORDER BY i.id)
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
     sourceWarehouseId: r.source_warehouse_id == null ? null : Number(r.source_warehouse_id),
    destinationBranchName: r.destination_name, receivedBy: r.received_by,
     items: r.items.map((item: any) => ({ ...item, quantity: Number(item.quantity),
       ...(type === "kitchen" ? { originalQuantity: Number(item.originalQuantity),
         substituteQuantity: Number(item.substituteQuantity) } : {}) })),
  };
}
const assignmentQuery = `SELECT a.*, CASE WHEN u.id IS NOT NULL THEN concat_ws(' ', u.first_name, u.last_name) END AS driver_name
  FROM delivery_assignments a LEFT JOIN users u ON u.id=a.driver_id`;
// Source dispatch is distinct from delivery_assignments.started_at (the latter
// records when follow-up began). The reverse movement logs dispatch as an event.
// Source timestamp-without-time-zone columns are written as UTC by the source
// handlers; normalize explicitly rather than inheriting the DB session timezone.
const reportDispatchSql = `CASE a.source_type
  WHEN 'kitchen' THEN k.dispatched_at AT TIME ZONE 'UTC'
  WHEN 'material_transfer' THEN mt.departure_time AT TIME ZONE 'UTC'
  WHEN 'finished_goods_transfer' THEN fg.dispatched_at AT TIME ZONE 'UTC'
  WHEN 'kitchen_warehouse_shipment' THEN ks.dispatched_at
  WHEN 'reverse_movement' THEN re.created_at END`;
// Lightweight projection for reports: no proof, item aggregates or attachments. Scope is
// evaluated before pagination (including the keeper's main-warehouse-only exception).
const reportQuery = `SELECT a.id,a.source_type,a.source_id,a.status,a.transport_mode,a.carrier,a.carrier_name,
  a.waybill,a.driver_id,a.vehicle_number,a.receiver_name,a.created_at,a.completed_at,
  ${reportDispatchSql} dispatched_at,
  concat_ws(' ',u.first_name,u.last_name) driver_name,
  CASE a.source_type WHEN 'kitchen' THEN k.central_kitchen_id
    WHEN 'material_transfer' THEN mt.source_branch_id
    WHEN 'finished_goods_transfer' THEN fg.source_branch_id
    WHEN 'kitchen_warehouse_shipment' THEN ks.source_branch_id
    WHEN 'reverse_movement' THEN rm.source_branch_id END source_branch_id,
  CASE a.source_type WHEN 'kitchen' THEN k.request_branch_id
    WHEN 'material_transfer' THEN mt.destination_branch_id
    WHEN 'finished_goods_transfer' THEN fg.destination_branch_id
    WHEN 'reverse_movement' THEN rm.destination_branch_id END destination_branch_id,
  rm.source_warehouse_id, COALESCE(ks.destination_warehouse_id,rm.destination_warehouse_id) destination_warehouse_id,
  COALESCE(k.order_number,mt.transfer_number,
    CASE WHEN fg.id IS NOT NULL THEN '#' || fg.id::text || ' · ' || fg.product_name END,
    CASE WHEN ks.id IS NOT NULL THEN '#' || ks.id::text || ' · ' || ks.product_name END,
    CASE WHEN rm.id IS NOT NULL THEN '#' || rm.id::text || ' · ' || rm.item_name END) source_label,
  COALESCE(k.status,mt.status,fg.status,ks.status,rm.status) source_status
  FROM delivery_assignments a LEFT JOIN users u ON u.id=a.driver_id
  LEFT JOIN central_kitchen_orders k ON a.source_type='kitchen' AND k.id=a.source_id
  LEFT JOIN material_transfers mt ON a.source_type='material_transfer' AND mt.id=a.source_id
  LEFT JOIN finished_goods_transfers fg ON a.source_type='finished_goods_transfer' AND fg.id=a.source_id
    AND fg.destination_type='branch' AND fg.transport_policy='branch_receipt'
  LEFT JOIN kitchen_warehouse_shipments ks ON a.source_type='kitchen_warehouse_shipment' AND ks.id=a.source_id
  LEFT JOIN reverse_movements rm ON a.source_type='reverse_movement' AND rm.id=a.source_id
  LEFT JOIN LATERAL (SELECT e.created_at FROM reverse_movement_events e
    WHERE e.movement_id=rm.id AND e.action='dispatch' ORDER BY e.id DESC LIMIT 1) re ON true`;
const reportFilters = z.object({
  from: z.string().date().optional(), to: z.string().date().optional(),
  dateType: z.enum(["created", "dispatched", "completed"]).default("created"),
  carrier: z.enum(["all", "internal", "road", "naqel", "other"]).default("all"),
  carrierName: z.string().trim().min(1).max(160).optional(),
  sourceBranchId: z.string().min(1).max(100).optional(),
  destinationBranchId: z.string().min(1).max(100).optional(),
  status: z.enum(["assigned", "in_transit", "awaiting_receipt", "receipt_approved", "completed", "failed", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).strict().superRefine((v, ctx) => {
  if (v.from && v.to && v.from > v.to) ctx.addIssue({ code: "custom", message: "from must precede to" });
  if (v.carrierName && v.carrier !== "other") ctx.addIssue({ code: "custom", message: "carrierName requires other" });
});
export function reportDateBounds(day: string) {
  // YYYY-MM-DD in Asia/Riyadh (UTC+03, no DST); upper bound is next local midnight.
  const start = new Date(`${day}T00:00:00+03:00`);
  return { start, end: new Date(start.getTime() + 86400000) };
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  // Quoting alone does not neutralize formulas when spreadsheets open CSV.
  return `"${(/^[\s\x00-\x1f]*[=+\-@]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
}
const csvLine = (values: unknown[]) => values.map(csvCell).join(",") + "\r\n";
const reportTimestamp = (date: Date | null) => date
  ? new Date(date.getTime() + 3 * 3600000).toISOString().replace("Z", "+03:00") : "";
const reportStatusLabels: Record<DeliveryStatus, string> = {
  assigned: "مسندة", in_transit: "في الطريق", awaiting_receipt: "بانتظار الإيصال",
  receipt_approved: "إيصال معتمد", completed: "مكتملة", failed: "متعذرة", cancelled: "ملغاة",
};
const reportSourceLabels: Record<DeliverySourceType, string> = {
  kitchen: "طلب المطبخ المركزي", material_transfer: "نقل مواد",
  finished_goods_transfer: "نقل منتجات جاهزة", kitchen_warehouse_shipment: "شحنة مطبخ إلى مستودع",
  reverse_movement: "إرجاع أو نقل بين المستودعات",
};
type ReportRow = Assignment & {
  source_branch_id: string | null; destination_branch_id: string | null;
  source_warehouse_id: number | null; destination_warehouse_id: number | null;
  source_label: string | null; source_status: string | null; dispatched_at: Date | null;
};
async function reportAccess(req: Request, res: Response, exporting: boolean) {
  if (!canAccessDeliveryWorkspace(req.currentUser) || req.currentUser?.jobTitle === "delivery"
    || getAllowedBranchIds(req)?.length === 0
    || !(await permitted(req, res, "delivery_tasks", "view"))
    || !(await permitted(req, res, "warehouse", "view")
      || await permitted(req, res, "central_kitchen_orders", "view")
      || await permitted(req, res, "production", "view"))
    || (exporting && !(await permitted(req, res, "delivery_tasks", "export"))))
    throw new DeliveryError("Permission denied", 403);
}
async function scanReport(req: Request, res: Response, client: PoolClient,
  filters: z.infer<typeof reportFilters>, onRows: (rows: ReportRow[]) => Promise<void>) {
  const dateColumn = { created: "a.created_at", dispatched: reportDispatchSql, completed: "a.completed_at" }[filters.dateType];
  const from = filters.from ? reportDateBounds(filters.from).start : null;
  const to = filters.to ? reportDateBounds(filters.to).end : null;
  const permissions = new Map<string, boolean>();
  let cursor = 0;
  for (;;) {
    if (res.destroyed) throw new Error("Report request disconnected");
    const rows = (await client.query(`${reportQuery} WHERE a.id > $1
      AND ($2::timestamptz IS NULL OR ${dateColumn} >= $2)
      AND ($3::timestamptz IS NULL OR ${dateColumn} < $3)
      AND ($4::text IS NULL OR a.status=$4)
      AND ($5::text = 'all' OR ($5 = 'internal' AND a.transport_mode='internal')
        OR ($5 <> 'internal' AND a.transport_mode='external' AND a.carrier=$5))
      AND ($6::text IS NULL OR a.carrier_name=$6)
      ORDER BY a.id LIMIT 250`,
      [cursor, from, to, filters.status || null, filters.carrier, filters.carrierName || null])).rows as ReportRow[];
    if (!rows.length) break;
    cursor = Number(rows[rows.length - 1].id);
    const scoped: ReportRow[] = [];
    for (const row of rows) {
      if (!row.source_label) continue;
      const src = {
        sourceType: row.source_type, sourceBranchId: row.source_branch_id,
        destinationBranchId: row.destination_branch_id, sourceWarehouseId: row.source_warehouse_id,
        destinationWarehouseId: row.destination_warehouse_id,
      } as SourceRow;
      if ((filters.sourceBranchId && src.sourceBranchId !== filters.sourceBranchId)
        || (filters.destinationBranchId && src.destinationBranchId !== filters.destinationBranchId)
        || !managerScope(req, src, "view")) continue;
      const module = sourceModule(row.source_type);
      if (!permissions.has(module)) permissions.set(module, await permitted(req, res, module, "view"));
      if (permissions.get(module)) scoped.push(row);
    }
    await onRows(scoped);
    if (rows.length < 250) break;
  }
}
async function assignment(client: PoolClient, id: number, lock = false): Promise<Assignment | null> {
  const { rows } = await client.query(`${assignmentQuery} WHERE a.id=$1${lock ? " FOR UPDATE OF a" : ""}`, [id]);
  return rows[0] || null;
}
async function dto(req: Request, res: Response, client: PoolClient, row: Assignment, src?: SourceRow): Promise<DeliveryDTO> {
  const s = src || await source(client, row.source_type, row.source_id);
  if (!s) throw new DeliveryError("Linked source no longer exists", 409);
  const driver = isDriver(req, row) && await permitted(req, res, "delivery_tasks", "view");
  const manager = !driver && managerScope(req, s, "view") && await permitted(req, res, sourceModule(s.sourceType), "view")
    && await permitted(req, res, "delivery_tasks", "view");
  // Receipt rights are destination-specific and must grant a write action.
  const destination = await receiverScope(req, s);
  const receiver = !driver && destination && await permitted(req, res, s.destinationWarehouseId != null ? "warehouse" : sourceModule(s.sourceType), "edit")
    && await permitted(req, res, "delivery_tasks", "approve");
  if (!driver && !manager && !receiver) throw new DeliveryError("Delivery is outside your scope", 403);
  const driverWrite = driver && await permitted(req, res, "delivery_tasks", "edit");
  const managerWrite = manager && await permitted(req, res, "delivery_tasks", "edit")
    && await permitted(req, res, sourceModule(s.sourceType), "edit");
  const eligibleReceipt = receiptMatchesSource(s.sourceType, s.sourceStatus, s.receivedBy, requireUser(req).id);
  const iso = (v: Date | null) => v ? new Date(v).toISOString() : null;
  const external = row.transport_mode === "external";
  const files = external ? (await client.query(
    "SELECT id,kind,mime_type,original_name FROM delivery_carrier_attachments WHERE assignment_id=$1 ORDER BY id", [row.id])).rows : [];
  const evidenceReady = ["shipment_photo", "carrier_receipt"].every(kind => files.some(f => f.kind === kind));
  return {
    ...s, id: Number(row.id), transportMode: row.transport_mode, driverId: row.driver_id,
    driverName: row.driver_name?.trim() || row.driver_id,
    vehicleNumber: row.vehicle_number, scheduledAt: iso(row.scheduled_at), status: row.status,
    carrier: row.carrier, carrierName: row.carrier_name, waybill: row.waybill, trackingUrl: row.tracking_url,
    packageCount: row.package_count, exceptionReason: row.exception_reason, exceptionResolvedAt: iso(row.exception_resolved_at),
    attachments: files.map(f => ({ id: Number(f.id), kind: f.kind, mimeType: f.mime_type,
      originalName: f.original_name, downloadUrl: `/api/deliveries/${row.id}/attachments/${f.id}` })),
     receiverName: row.receiver_name, notes: row.notes,
     proofPresent: !(driver && row.status === "cancelled") && !!row.signature_data,
    proofAt: iso(row.proof_at), receiptApprovedBy: row.receipt_approved_by, receiptApprovedAt: iso(row.receipt_approved_at),
    startedAt: iso(row.started_at), completedAt: iso(row.completed_at), failedAt: iso(row.failed_at),
    failureReason: row.failure_reason, cancellationReason: row.cancellation_reason, createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    handoverRecordedAt: iso(row.handover_recorded_at), handoverAcknowledgedAt: iso(row.handover_acknowledged_at),
    handoverItems: row.handover_items,
    handoverInvalidated: row.handover_revision > 0 && !row.handover_recorded_at,
    capabilities: {
      canRecordHandover: managerWrite && row.status === "assigned" && sourceHandoverReady(s) && !eligibleSourceReceipt(s) && (!external || evidenceReady),
      canUploadEvidence: external && managerWrite && row.status === "assigned" && !row.handover_recorded_at
        && sourceHandoverReady(s) && !eligibleSourceReceipt(s),
      canDispatchSource: external && s.sourceType === "material_transfer" && managerWrite
        && row.status === "assigned" && !!row.handover_recorded_at && evidenceReady && s.sourceStatus === "approved",
      canAcknowledgeHandover: !external && driverWrite && row.status === "assigned" && !!row.handover_recorded_at
        && !row.handover_acknowledged_at && row.handover_driver_id === row.driver_id
        && row.handover_vehicle_number === row.vehicle_number
        && row.handover_fingerprint === deliverySourceFingerprint(s.items),
      canStart: (external ? managerWrite && !!row.handover_recorded_at && evidenceReady
        : driverWrite && (acknowledged(row) || ((sourceDispatched(s) || eligibleSourceReceipt(s))
        && !row.handover_recorded_at && row.handover_revision === 0))
        ) && (sourceDispatched(s) || eligibleSourceReceipt(s)) && deliveryTransitionAllowed(row.status, "start"),
       canSubmitProof: !external && driverWrite && (sourceDispatched(s) || eligibleSourceReceipt(s)) && deliveryTransitionAllowed(row.status, "proof"),
       canApproveReceipt: receiver && eligibleReceipt && (external ? evidenceReady : !!row.signature_data && !!row.proof_at)
         && deliveryTransitionAllowed(row.status, "approve-receipt"),
       canComplete: (external ? managerWrite && carrierClosureReady(s,
         { receiptApprovedBy: row.receipt_approved_by, exceptionReason: row.exception_reason, handoverRecordedAt: row.handover_recorded_at },
         files.map(f => f.kind)) : driverWrite && !!row.signature_data && !!row.proof_at && !!row.receipt_approved_by
           && receiptMatchesSource(s.sourceType, s.sourceStatus, s.receivedBy, row.receipt_approved_by))
        && deliveryTransitionAllowed(row.status, "complete"),
       canFail: external
         ? (managerWrite || receiver) && carrierExceptionAllowed(row.status,
           sourceDispatched(s) || eligibleSourceReceipt(s), row.exception_reason)
         : (driverWrite || managerWrite) && sourceDispatched(s) && deliveryTransitionAllowed(row.status, "fail"),
       canReassign: !external && managerWrite && sourceAssignable(s) && !eligibleSourceReceipt(s) && deliveryTransitionAllowed(row.status, "reassign"),
      canCancel: managerWrite && !eligibleSourceReceipt(s) && deliveryTransitionAllowed(row.status, "cancel"),
      canResolveException: external && managerWrite && !!row.exception_reason && !row.exception_resolved_at,
    },
  };
}
function eligibleSourceReceipt(s: SourceRow) {
  return s.sourceStatus === (s.sourceType === "material_transfer" ? "delivered" : s.sourceType === "reverse_movement" ? "received" : "received")
    || (s.sourceType === "reverse_movement" && s.sourceStatus === "inspected");
}
function error(res: Response, e: unknown) {
  if (res.headersSent) return;
  if (e instanceof PrivateAttachmentUnavailableError)
    return res.status(503).json({ error: "مخزن المرفقات الخاص غير متاح حالياً" });
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
   if (["create", "reassign", "proof", "approve-receipt", "fail", "cancel",
     "carrier-dispatched", "carrier-exception"].includes(action))
    await enqueueDeliveryNotice(client, id, Number(inserted.rows[0].id),
       ({ create: "assigned", reassign: "reassigned", proof: "awaiting_receipt",
         "carrier-dispatched": "awaiting_receipt", "carrier-exception": "failed",
         "approve-receipt": "receipt_approved", fail: "failed", cancel: "cancelled" } as Record<string, DeliveryNoticeEvent>)[action]);
}

export async function registerDeliverySchemaGate(app: Express) {
  const schema = await pool.query(`SELECT
    to_regclass('delivery_carrier_attachments') IS NOT NULL AS files,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema=current_schema()
      AND table_name='delivery_assignments' AND column_name IN
      ('transport_mode','carrier','carrier_name','waybill','tracking_url','package_count',
       'exception_reason','exception_resolution','exception_resolved_at')
    )=9 AS fields,
    (SELECT count(*)::int FROM information_schema.columns WHERE table_schema=current_schema()
      AND table_name='delivery_assignments' AND column_name IN ('driver_id','vehicle_number')
      AND is_nullable='YES')=2 AS nullable_driver,
    EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('delivery_carrier_attachments')
      AND contype='f' AND confrelid=to_regclass('delivery_assignments')) AS file_binding,
    EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('delivery_assignments')
      AND conname='delivery_transport_fields_check' AND convalidated) AS constraint_ready`);
  if (!schema.rows[0]?.files || !schema.rows[0]?.fields || !schema.rows[0]?.nullable_driver
    || !schema.rows[0]?.file_binding || !schema.rows[0]?.constraint_ready)
    app.use("/api/deliveries", (_req, res) =>
      res.status(503).json({ error: "Delivery schema unavailable: apply migrations/delivery_external_carriers.sql" }));
}

export function registerDeliveryRoutes(app: Express) {
  app.get("/api/deliveries/sources", isAuthenticated, async (req, res) => {
    try {
      if (!canAccessDeliveryWorkspace(req.currentUser)) throw new DeliveryError("Delivery workspace access denied", 403);
      const sources = await withClient(async client => {
        const list: DeliverySource[] = [];
         for (const type of ["kitchen", "material_transfer", "finished_goods_transfer", "kitchen_warehouse_shipment", "reverse_movement"] as const) {
          if (!(await permitted(req, res, "delivery_tasks", "create"))) throw new DeliveryError("Permission denied", 403);
          if (!(await permitted(req, res, sourceModule(type), "edit"))) continue;
          const table = sourceTable(type);
           const statuses = ({
             kitchen: ["prepared","dispatched"], material_transfer: ["approved","in_transit"],
             finished_goods_transfer: ["pending","in_transit"], kitchen_warehouse_shipment: ["requested","dispatched"],
             reverse_movement: ["requested","dispatched"],
           } as const)[type];
           const ids = await client.query(`SELECT s.id FROM ${table} s WHERE s.status=ANY($1::text[])
             ${type === "finished_goods_transfer" ? "AND s.transport_policy='branch_receipt' AND s.destination_type='branch'" : ""}
             AND NOT EXISTS
            (SELECT 1 FROM delivery_assignments a WHERE a.source_type=$2 AND a.source_id=s.id)
            ORDER BY s.id DESC LIMIT 200`,
              [statuses, type]);
          for (const item of ids.rows) {
            const s = await source(client, type, item.id);
            if (s && sourceAssignable(s) && managerScope(req, s, "create")) {
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
      if (!canAccessDeliveryWorkspace(req.currentUser)) throw new DeliveryError("Delivery workspace access denied", 403);
      // The same picker serves new assignments and edits to existing tasks.
      // Reassignment needs edit rights, not permission to create a new task.
      if (!(await permitted(req, res, "delivery_tasks", "create"))
        && !(await permitted(req, res, "delivery_tasks", "edit")))
        throw new DeliveryError("Permission denied", 403);
      const allowed = req.currentUser?.role === "warehouse_keeper" ? null : getAllowedBranchIds(req);
      const drivers = await pool.query(`SELECT id, concat_ws(' ',first_name,last_name) name, job_title "jobTitle"
        FROM users WHERE job_title='delivery' AND is_active='active'
        AND ($1::text[] IS NULL OR branch_id=ANY($1::text[])) ORDER BY first_name,last_name`, [allowed]);
      res.json({ drivers: drivers.rows });
    } catch (e) { error(res, e); }
  });

  app.get("/api/deliveries/capabilities", isAuthenticated, async (req, res) => {
    try {
      if (!canAccessDeliveryWorkspace(req.currentUser)) throw new DeliveryError("Delivery workspace access denied", 403);
      const create = await permitted(req, res, "delivery_tasks", "create");
      const branchScope = getAllowedBranchIds(req);
      const hasBranch = branchScope === null || branchScope.length > 0;
      const canAssign = hasBranch && create && (await permitted(req, res, "warehouse", "edit")
        || await permitted(req, res, "central_kitchen_orders", "edit")
        || await permitted(req, res, "production", "edit"));
      const canReport = hasBranch && req.currentUser?.jobTitle !== "delivery"
        && await permitted(req, res, "delivery_tasks", "view")
        && (await permitted(req, res, "warehouse", "view") || await permitted(req, res, "central_kitchen_orders", "view")
          || await permitted(req, res, "production", "view"));
      const canExport = canReport && await permitted(req, res, "delivery_tasks", "export");
      res.json({ canAssign, canReport, canExport });
    } catch (e) { error(res, e); }
  });

  async function list(req: Request, res: Response, reports = false) {
    try {
      if (reports) {
        await reportAccess(req, res, false);
        const filters = reportFilters.parse(req.query);
        const result = await withClient(async client => {
          const summary: Record<string, number> = { total: 0, assigned: 0, in_transit: 0, awaiting_receipt: 0, receipt_approved: 0, completed: 0, failed: 0, cancelled: 0 };
          const ids: number[] = [];
          const dispatchTimes = new Map<number, string | null>();
          const start = (filters.page - 1) * filters.pageSize;
          await scanReport(req, res, client, filters, async rows => {
            for (const row of rows) {
              if (summary.total >= start && ids.length < filters.pageSize) {
                ids.push(Number(row.id));
                dispatchTimes.set(Number(row.id), row.dispatched_at?.toISOString() ?? null);
              }
              summary.total++;
              summary[row.status]++;
            }
          });
          const deliveries: (DeliveryDTO & { reportDispatchedAt: string | null })[] = [];
          if (ids.length) {
            const selected = (await client.query(`${assignmentQuery} WHERE a.id=ANY($1::bigint[])`, [ids])).rows as Assignment[];
            const byId = new Map(selected.map(row => [Number(row.id), row]));
            for (const id of ids) {
              const row = byId.get(id);
              if (!row) continue;
              const src = await source(client, row.source_type, row.source_id);
              if (src) deliveries.push({ ...await dto(req, res, client, row, src),
                reportDispatchedAt: dispatchTimes.get(id) ?? null });
            }
          }
          return { deliveries, summary, page: filters.page, pageSize: filters.pageSize };
        });
        return res.json(result);
      }
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
           if (reports ? !managerScope(req, s, "view")
               || !(await permitted(req, res, sourceModule(s.sourceType), "view"))
             : !isDriver(req, row) && !(managerScope(req, s, "view") || await receiverScope(req, s))) continue;
          try { result.push(await dto(req, res, client, row, s)); }
          catch (e) { if (!(e instanceof DeliveryError) || e.status !== 403) throw e; }
        }
        return result;
      });
      if (res.headersSent) return;
      return res.json({ deliveries });
    } catch (e) { error(res, e); }
  }
   app.get("/api/deliveries/reports", isAuthenticated, (req, res) => list(req, res, true));
   app.get("/api/deliveries/reports/export", isAuthenticated, async (req, res) => {
     try {
       await reportAccess(req, res, true);
       const filters = reportFilters.parse(req.query);
       await withClient(async client => {
         res.setHeader("Content-Type", "text/csv; charset=utf-8");
         res.setHeader("Content-Disposition", 'attachment; filename="delivery-report.csv"');
         res.setHeader("Cache-Control", "private, no-store");
         const write = async (text: string) => {
           if (res.destroyed) throw new Error("Export disconnected");
           if (!res.write(text)) await new Promise<void>((resolve, reject) => {
             const drained = () => { res.off("close", closed); resolve(); };
             const closed = () => { res.off("drain", drained); reject(new Error("Export disconnected")); };
             res.once("drain", drained); res.once("close", closed);
           });
         };
         await write("\uFEFF" + csvLine(["المصدر", "النوع", "شركة الشحن", "رقم البوليصة", "السائق الداخلي", "المركبة",
           "المستلم", "الحالة", "الإنشاء (السعودية +03:00)", "الإرسال الفعلي من المصدر (السعودية +03:00)", "الإكمال (السعودية +03:00)"]));
         await scanReport(req, res, client, filters, async rows => {
           for (const row of rows) await write(csvLine([
             row.source_label, reportSourceLabels[row.source_type],
             row.transport_mode === "external" ? row.carrier === "other" ? row.carrier_name
               : row.carrier === "road" ? "رود للوجيستك" : "ناقل" : "",
             row.waybill, row.transport_mode === "internal" ? row.driver_name : "", row.vehicle_number,
             row.receiver_name, reportStatusLabels[row.status],
             reportTimestamp(row.created_at), reportTimestamp(row.dispatched_at), reportTimestamp(row.completed_at),
           ]));
         });
       });
       res.end();
     } catch (e) { if (res.headersSent) res.destroy(e as Error); else error(res, e); }
   });
   app.get("/api/deliveries", isAuthenticated, (req, res) => list(req, res));
  app.get("/api/deliveries/:id/proof", isAuthenticated, async (req, res) => {
    try {
      const id = idSchema.parse(req.params.id);
       const result = await withClient(async client => {
        const row = await assignment(client, id);
        if (!row) throw new DeliveryError("Delivery not found", 404);
        await dto(req, res, client, row);
         // Historical proof is retained for audit, not for a driver whose task
         // was cancelled or reassigned. Source managers/receivers keep their
         // scoped audit access.
         if (row.status === "cancelled" && isDriver(req, row))
           throw new DeliveryError("Proof is no longer available to the driver", 403);
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
      if (!canAccessDeliveryWorkspace(req.currentUser)) throw new DeliveryError("Delivery workspace access denied", 403);
      const payload = deliveryAssignmentCreateSchema.parse(req.body);
      validateTransport(payload);
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
           if (!sourceAssignable(s) || eligibleSourceReceipt(s)) throw new DeliveryError("Source is not eligible for assignment", 409);
          if (payload.transportMode !== "external") await driverExists(client, payload.driverId!, req);
          const inserted = await client.query(`INSERT INTO delivery_assignments
            (source_type,source_id,driver_id,vehicle_number,scheduled_at,created_by,
              transport_mode,carrier,carrier_name,waybill,tracking_url,package_count)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
            [payload.sourceType, payload.sourceId, payload.driverId || null, payload.vehicleNumber || null,
             payload.scheduledAt || null, requireUser(req).id, payload.transportMode || "internal",
             payload.carrier || null, payload.carrierName || null, payload.waybill || null,
             payload.trackingUrl || null, payload.packageCount || null]);
          const id = Number(inserted.rows[0].id);
           await event(client, id, requireUser(req).id, payload.transportMode === "external" ? "create-carrier" : "create", null, "assigned",
             { transportMode: payload.transportMode || "internal", driverId: payload.driverId, vehicleNumber: payload.vehicleNumber,
               carrier: payload.carrier, waybill: payload.waybill, packageCount: payload.packageCount });
           // Build the response before committing: a failed source/assignment
           // read must not report a 500 after the assignment was persisted.
           const delivery = await dto(req, res, client, (await assignment(client, id))!, s);
           await client.query("COMMIT");
           return delivery;
        } catch (e) { await client.query("ROLLBACK"); throw e; }
      });
       if (!res.headersSent) res.status(201).json(result);
    } catch (e) { error(res, e); }
  });

  app.post("/api/deliveries/:id/attachments", isAuthenticated, (req, res) => {
    uploadEvidence(req, res, async uploadError => {
      try {
        if (uploadError) throw new DeliveryError("Evidence file exceeds 10MB or upload is invalid", 400);
        const id = idSchema.parse(req.params.id);
        const kind = z.enum(["shipment_photo", "carrier_receipt"]).parse(req.body?.kind);
        const file = req.file;
        if (!file?.buffer.length) throw new DeliveryError("File is required", 400);
        const data = file.buffer;
        const detected = validateCarrierEvidence(file,kind);
        const result = await withClient(async client => {
          await client.query("BEGIN");
          let path: string | null = null;
          try {
            const head = await assignment(client, id);
            if (!head) throw new DeliveryError("Delivery not found", 404);
            await client.query(`SELECT id FROM ${sourceTable(head.source_type)} WHERE id=$1 FOR UPDATE`, [head.source_id]);
            const row = (await assignment(client,id,true))!;
            const s = await source(client,row.source_type,row.source_id);
            if (!s || row.transport_mode !== "external" || row.status !== "assigned" || row.handover_recorded_at
              || !sourceHandoverReady(s) || eligibleSourceReceipt(s)
              || !managerScope(req,s,"edit") || !(await permitted(req,res,"delivery_tasks","edit"))
              || !(await permitted(req,res,sourceModule(s.sourceType),"edit")))
              throw new DeliveryError("Carrier evidence upload is outside your source scope or state", 403);
            if (!(await objects.isPrivateObjectStorageReady()))
              throw new PrivateAttachmentUnavailableError();
            path = newPrivateAttachmentPath("delivery-carriers", `${id}/${randomUUID()}.${detected.extension}`);
            try { await objects.uploadPrivateObject(path,data,detected.mimeType); }
            catch (storageError) {
              throw new PrivateAttachmentUnavailableError("Private attachment upload failed", { cause: storageError });
            }
            const { rows } = await client.query(`INSERT INTO delivery_carrier_attachments
              (assignment_id,kind,storage_path,original_name,mime_type,uploaded_by)
              VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [id,kind,path,file.originalname.slice(0,200),detected.mimeType,requireUser(req).id]);
            await client.query("COMMIT");
            return { id:Number(rows[0].id),kind,mimeType:detected.mimeType,originalName:file.originalname.slice(0,200),
              downloadUrl:`/api/deliveries/${id}/attachments/${rows[0].id}` };
          } catch (e) {
            try { await client.query("ROLLBACK"); } catch { /* Preserve original error. */ }
            if (path) {
              try { await objects.deletePrivateObject(path); }
              catch { console.error("Delivery attachment cleanup failed"); }
            }
            throw e;
          }
        });
        if (!res.headersSent) res.status(201).json(result);
      } catch (e) { error(res,e); }
    });
  });
  app.get("/api/deliveries/:id/attachments/:attachmentId", isAuthenticated, async (req,res) => {
    try {
      const id = idSchema.parse(req.params.id), attachmentId = idSchema.parse(req.params.attachmentId);
      const file = await withClient(async client => {
        const row = await assignment(client,id);
        if (!row) throw new DeliveryError("Delivery not found",404);
        await dto(req,res,client,row);
        const { rows } = await client.query(`SELECT storage_path,mime_type,original_name
          FROM delivery_carrier_attachments WHERE assignment_id=$1 AND id=$2`,[id,attachmentId]);
        if (!rows.length) throw new DeliveryError("Attachment not found",404);
        return rows[0];
      });
      if (res.headersSent) return;
       let downloaded;
       try { downloaded = await objects.downloadPrivateObject(file.storage_path); }
       catch (storageError) {
         throw new PrivateAttachmentUnavailableError("Private attachment download failed", { cause: storageError });
       }
      res.setHeader("Content-Type",file.mime_type);
      res.setHeader("Content-Disposition",`attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
      res.setHeader("Cache-Control","private, no-store");
      res.setHeader("X-Content-Type-Options","nosniff");
      res.setHeader("Content-Security-Policy","sandbox");
      res.send(downloaded.data);
    } catch(e) { error(res,e); }
  });

   for (const action of ["handover", "acknowledge-handover", "start", "proof", "approve-receipt", "complete", "fail", "reassign", "cancel", "resolve-exception"] as const) {
    app.post(`/api/deliveries/:id/${action}`, isAuthenticated, async (req, res) => {
      try {
        const id = idSchema.parse(req.params.id);
         const payload = action === "handover" ? handoverSchema.parse(req.body)
           : action === "proof" ? proofSchema.parse(req.body)
           : action === "fail" ? failSchema.parse(req.body)
           : action === "cancel" ? cancelSchema.parse(req.body)
           : action === "resolve-exception" ? resolutionSchema.parse(req.body)
          : action === "reassign" ? reassignmentSchema.parse(req.body) : null;
        await withClient(async client => {
          await client.query("BEGIN");
          try {
             // All writers acquire the source lock BEFORE the assignment lock.
             // A nonlocking lookup is safe because source identity is immutable.
             const head = await assignment(client, id);
             if (!head) throw new DeliveryError("Delivery not found", 404);
             await client.query(`SELECT id FROM ${sourceTable(head.source_type)} WHERE id=$1 FOR UPDATE`, [head.source_id]);
             const row = await assignment(client, id, true);
            if (!row) throw new DeliveryError("Delivery not found", 404);
            const s = await source(client, row.source_type, row.source_id);
            if (!s) throw new DeliveryError("Linked source not found", 409);
             const driver = isDriver(req, row)
               && await permitted(req, res, "delivery_tasks", "view")
               && await permitted(req, res, "delivery_tasks", "edit");
            const external = row.transport_mode === "external";
            const sourceManager = managerScope(req, s, "edit");
              const manager = (external || action === "handover" || action === "fail" || action === "reassign" || action === "cancel") && sourceManager
              && await permitted(req, res, "delivery_tasks", "edit")
               && await permitted(req, res, sourceModule(s.sourceType), "edit")
               && await permitted(req, res, "delivery_tasks", "view")
               && await permitted(req, res, sourceModule(s.sourceType), "view");
             const receiver = (action === "approve-receipt" || external && action === "fail") && await receiverScope(req, s)
              && await permitted(req, res, "delivery_tasks", "approve")
               && await permitted(req, res, s.destinationWarehouseId != null ? "warehouse" : sourceModule(s.sourceType), "edit");
            if (res.headersSent) throw new DeliveryError("Permission denied", 403);
             if (external && ["acknowledge-handover","proof","reassign"].includes(action))
               throw new DeliveryError("External shipment has no driver acknowledgement or driver proof",403);
             if (action === "approve-receipt" ? !receiver
                : action === "handover" || action === "reassign" || action === "cancel" ? !manager
              : action === "fail" ? !driver && !manager && !receiver
              : external ? !manager : !driver) throw new DeliveryError("Permission denied", 403);
             if (action === "handover" || action === "acknowledge-handover") {
               if (row.status !== "assigned" || eligibleSourceReceipt(s)) throw new DeliveryError("Handover cannot be changed in this state", 409);
               if (action === "handover") {
                 if (!sourceHandoverReady(s)) throw new DeliveryError("Source is not ready for handover", 409);
                 if (external) {
                   const evidence = (await client.query("SELECT kind FROM delivery_carrier_attachments WHERE assignment_id=$1",[id])).rows;
                   if (!["shipment_photo","carrier_receipt"].every(kind => evidence.some(e => e.kind === kind)))
                     throw new DeliveryError("Shipment photo and carrier receipt required",409);
                 }
                 const lines = (payload as z.infer<typeof handoverSchema>).items;
                 if (lines.length !== s.items.length || new Set(lines.map(i => i.id)).size !== s.items.length)
                   throw new DeliveryError("Handover must include every source line exactly once", 400);
                 const byId = new Map(lines.map(i => [i.id, i.quantity]));
                 const items = s.items.map(i => ({ ...i, quantity: byId.get(i.id)! }));
                 if (items.some((i, index) => i.quantity === undefined || i.quantity > s.items[index].quantity
                   || (s.sourceType !== "kitchen" && i.quantity !== s.items[index].quantity))
                   || !items.some(i => i.quantity > 0))
                   throw new DeliveryError("Handover quantity exceeds prepared source quantity", 400);
                 await client.query(`UPDATE delivery_assignments SET handover_recorded_at=now(),
                   handover_acknowledged_at=NULL,handover_driver_id=driver_id,handover_vehicle_number=vehicle_number,
                   handover_items=$2::jsonb,handover_fingerprint=$3,handover_revision=handover_revision+1,
                   updated_at=now() WHERE id=$1`, [id, JSON.stringify(items), deliverySourceFingerprint(s.items)]);
                 await event(client, id, requireUser(req).id, action, row.status, row.status,
                   { items, driverId: row.driver_id, vehicleNumber: row.vehicle_number, revision: row.handover_revision + 1 });
               } else {
                 if (!row.handover_recorded_at || row.handover_acknowledged_at || row.handover_driver_id !== row.driver_id
                   || row.handover_vehicle_number !== row.vehicle_number || row.handover_fingerprint !== deliverySourceFingerprint(s.items))
                   throw new DeliveryError("Handover changed; manager must record it again", 409);
                 await client.query("UPDATE delivery_assignments SET handover_acknowledged_at=now(),updated_at=now() WHERE id=$1", [id]);
                 await event(client,id,requireUser(req).id,action,row.status,row.status,
                   { revision: row.handover_revision, driverId: row.driver_id, vehicleNumber: row.vehicle_number });
               }
               await client.query("COMMIT");
               return;
             }
             if (action === "resolve-exception") {
               if (!external || !row.exception_reason || row.exception_resolved_at || eligibleSourceReceipt(s) && row.status === "completed")
                 throw new DeliveryError("No open carrier exception to resolve",409);
               const resolution = (payload as z.infer<typeof resolutionSchema>).resolution;
               await client.query(`UPDATE delivery_assignments SET exception_resolution=$2,exception_resolved_at=now(),
                 exception_reason=NULL,updated_at=now() WHERE id=$1`,[id,resolution]);
               await event(client,id,requireUser(req).id,action,row.status,row.status,
                 { reason:row.exception_reason,resolution,stockShipmentUnchanged:true });
               await client.query("COMMIT");
               return;
             }
             if (external && action === "fail"
               ? !carrierExceptionAllowed(row.status, sourceDispatched(s) || eligibleSourceReceipt(s), row.exception_reason)
               : !deliveryTransitionAllowed(row.status, action))
               throw new DeliveryError("Invalid delivery state transition or unresolved carrier exception", 409);
             if (["reassign", "cancel"].includes(action) || !external && action === "fail") {
               if (eligibleSourceReceipt(s))
               throw new DeliveryError("Source receipt already recorded; delivery cannot be reset or cancelled", 409);
             }
             if (action === "fail" && !external && !sourceDispatched(s))
               throw new DeliveryError("Source is no longer dispatched; cannot fail delivery", 409);
             if (action === "reassign" && !sourceAssignable(s))
               throw new DeliveryError("Source is no longer dispatched; cannot restart delivery", 409);
              if (action === "start" && !(sourceDispatched(s) || eligibleSourceReceipt(s)))
               throw new DeliveryError("Source is no longer awaiting receipt", 409);
              if (action === "start" && !acknowledged(row)
                && !external && (row.handover_recorded_at || row.handover_revision > 0))
                throw new DeliveryError("Current driver must acknowledge the recorded handover", 409);
              if (action === "start" && external && !row.handover_recorded_at)
                throw new DeliveryError("Carrier handover is missing or changed",409);
              if (action === "proof" && !sourceDispatched(s) && !eligibleSourceReceipt(s))
                throw new DeliveryError("Source is no longer awaiting receipt", 409);
            if (action === "proof") validateSignature((payload as z.infer<typeof proofSchema>).signatureData);
            if (action === "approve-receipt" || action === "complete") {
              if (!external && (!row.signature_data || !row.proof_at)) throw new DeliveryError("Signature proof required", 409);
              if (external) {
                const evidence = (await client.query("SELECT kind FROM delivery_carrier_attachments WHERE assignment_id=$1",[id])).rows;
                if (!row.handover_recorded_at || !["shipment_photo","carrier_receipt"].every(kind => evidence.some(e => e.kind === kind)))
                  throw new DeliveryError("Documented carrier handover required",409);
                if (action === "complete" && !carrierClosureReady(s,
                  { receiptApprovedBy: row.receipt_approved_by, exceptionReason: row.exception_reason, handoverRecordedAt: row.handover_recorded_at },
                  evidence.map(e => e.kind)))
                  throw new DeliveryError("Authenticated source receipt and resolved exception required before closing",409);
              }
              if (!eligibleSourceReceipt(s)) throw new DeliveryError("Complete receipt in the source module first", 409);
              if (action === "approve-receipt" && !receiptMatchesSource(s.sourceType, s.sourceStatus, s.receivedBy, requireUser(req).id))
                throw new DeliveryError("Only the authenticated source receipt actor can approve", 403);
              if (action === "complete" && (!row.receipt_approved_by
                || !receiptMatchesSource(s.sourceType, s.sourceStatus, s.receivedBy, row.receipt_approved_by)))
                throw new DeliveryError("Receiver approval must match the current source receipt actor", 409);
            }
             if (action === "reassign") {
               if ((payload as z.infer<typeof reassignmentSchema>).driverId === row.driver_id)
                 throw new DeliveryError("Reassignment requires a different driver; record a new handover to update the vehicle", 400);
               await driverExists(client, (payload as z.infer<typeof reassignmentSchema>).driverId, req);
             }
            const next: DeliveryStatus = external && action === "fail" ? row.status
              : external && action === "start" ? "awaiting_receipt" : ({
              start: "in_transit", proof: "awaiting_receipt", "approve-receipt": "receipt_approved",
               complete: "completed", fail: "failed", reassign: "assigned", cancel: "cancelled",
            } as Record<string, DeliveryStatus>)[action];
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
            if (action === "fail") {
              set("failure_reason", (payload as z.infer<typeof failSchema>).reason);
              if (external) { set("exception_reason", (payload as z.infer<typeof failSchema>).reason); updates += ", exception_resolved_at=NULL,exception_resolution=NULL"; }
              updates += ", failed_at=now()";
            }
             if (action === "cancel") { set("cancellation_reason", (payload as z.infer<typeof cancelSchema>).reason); updates += ", cancelled_at=now()"; }
            if (action === "reassign") {
              const p = payload as z.infer<typeof reassignmentSchema>;
              set("driver_id", p.driverId); set("vehicle_number", p.vehicleNumber);
                updates += ", signature_data=NULL, receiver_name=NULL, notes=NULL, proof_at=NULL, receipt_approved_by=NULL, receipt_approved_at=NULL, started_at=NULL, failed_at=NULL, failure_reason=NULL, cancelled_at=NULL, cancellation_reason=NULL, handover_recorded_at=NULL, handover_acknowledged_at=NULL, handover_driver_id=NULL, handover_vehicle_number=NULL, handover_items=NULL, handover_fingerprint=NULL, handover_revision=handover_revision+1";
            }
            await client.query(`UPDATE delivery_assignments SET ${updates} WHERE id=$1`, values);
            await event(client, id, requireUser(req).id,
              external && action === "fail" ? "carrier-exception"
              : external && action === "start" ? "carrier-dispatched" : action, row.status, next, action === "reassign"
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