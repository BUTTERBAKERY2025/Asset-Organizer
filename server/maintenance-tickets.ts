import type { Express, Request, RequestHandler } from "express";
import multer from "multer";
import { and, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import {
  inventoryItems, maintenanceTickets as tickets, maintenanceTicketEvents as events,
  maintenanceTicketAttachments as attachments, systemAuditLogs, users, userBranchAccess,
} from "@shared/schema";
import {
  maintenanceTicketCreateSchema, maintenanceTicketPatchSchema, maintenanceTicketTransitionSchema,
  maintenanceTicketListQuerySchema, getMaintenanceTicketTransition, maintenanceTicketActionPermission,
} from "@shared/maintenance-tickets";
import { db } from "./db";
import { storage } from "./storage";
import { isAuthenticated, canAccessBranch, BRANCH_MANAGER_INTRINSIC_PERMISSIONS, OPERATIONS_MANAGER_PERMISSIONS } from "./auth";
import { maintenanceTicketAttachmentStorage as photos } from "./maintenance-ticket-attachment-storage";

const MODULE = "maintenance";
const ACTIVE = ["open", "assigned", "in_progress"];
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: 10 * 1024 * 1024 } }).single("file");
class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(status: number, message: string): never { throw new HttpError(status, message); }
const handler = (work: RequestHandler): RequestHandler => async (req, res, next) => {
  try { await work(req, res, next); } catch (error) {
    if (error instanceof HttpError) res.status(error.status).json({ message: error.message });
    else next(error);
  }
};
function idFrom(raw: unknown) {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) fail(400, "المعرف أو النسخة غير صالحة");
  return id;
}
async function hasAction(user: typeof users.$inferSelect, action: string) {
  if (user.role === "admin") return true;
  // Match requirePermission's hard role boundaries before intrinsic or stored
  // grants. Old/over-broad permission rows must never elevate restricted roles.
  if (user.role === "attendance_clerk") return false;
  if (user.role === "viewer" && action !== "view") return false;
  const intrinsic = user.role === "operations_manager" ? OPERATIONS_MANAGER_PERMISSIONS[MODULE]
    : user.role === "branch_manager" ? BRANCH_MANAGER_INTRINSIC_PERMISSIONS[MODULE] : [];
  if (intrinsic?.includes(action)) return true;
  // Use the standard effective resolver, but bypass both auth and storage
  // caches: all direct rows OR active role assignments, then active overrides.
  const grants = await storage.getUserPermissions(user.id, { bypassCache: true });
  return grants.some(grant => grant.module === MODULE && grant.actions.includes(action));
}
const permission = (action: string | ((req: Request) => string)): RequestHandler => handler(async (req, res, next) => {
  if (!req.session.userId) fail(401, "غير مصرح");
  const [user] = await db.select().from(users).where(and(eq(users.id, req.session.userId!), eq(users.isActive, "active"))).limit(1);
  if (!user) fail(403, "الحساب غير نشط");
  const required = typeof action === "function" ? action(req) : action;
  if (!(await hasAction(user, "view")) || (required !== "view" && !(await hasAction(user, required))))
    fail(403, `صلاحية ${required} مطلوبة`);
  req.currentUser = user;
  (req as any).userBranchAccess = await db.select().from(userBranchAccess).where(eq(userBranchAccess.userId, user.id));
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
async function branch(req: Request, branchId: string) {
  if (!(await canAccessBranch(req, branchId))) fail(403, "غير مسموح بالوصول إلى الفرع");
}
async function accessible(req: Request, id: number) {
  const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  if (!ticket || !(await canAccessBranch(req, ticket.branchId))) fail(404, "البلاغ غير موجود أو غير مسموح");
  return ticket;
}
async function eligible(userId: string, branchId: string) {
  const [user] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.isActive, "active"))).limit(1);
  if (!user || !(await hasAction(user, "view")) || !(await hasAction(user, "edit"))) return false;
  const grants = await db.select().from(userBranchAccess).where(eq(userBranchAccess.userId, user.id));
  return canAccessBranch({ currentUser: user, userBranchAccess: grants }, branchId);
}
async function validateReferences(input: { assetId?: string | null; assigneeUserId?: string | null }, branchId: string) {
  if (input.assetId) {
    const [asset] = await db.select({ id: inventoryItems.id }).from(inventoryItems).where(and(
      eq(inventoryItems.id, input.assetId), eq(inventoryItems.branchId, branchId),
    )).limit(1);
    if (!asset) fail(400, "الأصل غير موجود في الفرع المحدد");
  }
  if (input.assigneeUserId && !(await eligible(input.assigneeUserId, branchId)))
    fail(400, "المسؤول غير مؤهل أو لا يملك وصول الفرع");
}
async function record(tx: any, req: Request, ticket: typeof tickets.$inferSelect, eventType: string, changes: unknown, fromStatus?: string, reason?: string) {
  await tx.insert(events).values({
    ticketId: ticket.id, actorUserId: req.currentUser!.id, eventType, changes,
    fromStatus: fromStatus || null, toStatus: ticket.status, reason: reason || null,
  });
  await tx.insert(systemAuditLogs).values({
    module: MODULE, entityId: String(ticket.id), entityName: `بلاغ صيانة #${ticket.id}`, action: eventType,
    branchId: ticket.branchId, userId: req.currentUser!.id, userName: req.currentUser!.username,
    details: JSON.stringify({ version: ticket.version, changes, fromStatus, toStatus: ticket.status, reason }),
  });
}
function safePhoto(row: typeof attachments.$inferSelect) {
  const { storagePath: _privatePath, ...safe } = row;
  return safe;
}
export function sniffMaintenancePhoto(buffer: Buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    return { mimeType: "image/png", extension: "png" };
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return { mimeType: "image/jpeg", extension: "jpg" };
  if (buffer.length >= 12 && buffer.subarray(0,4).toString() === "RIFF" && buffer.subarray(8,12).toString() === "WEBP")
    return { mimeType: "image/webp", extension: "webp" };
  return null;
}
export function registerMaintenanceTicketRoutes(app: Express) {
  const root = "/api/maintenance-tickets";
  app.get(`${root}/options`, isAuthenticated, permission("view"), handler(async (req, res) => {
    const branchId = String(req.query.branchId || "").trim();
    if (!branchId) fail(400, "branchId مطلوب");
    await branch(req, branchId);
    const assets = await db.select({ id: inventoryItems.id, name: inventoryItems.name, serialNumber: inventoryItems.serialNumber })
      .from(inventoryItems).where(eq(inventoryItems.branchId, branchId)).orderBy(inventoryItems.name);
    const candidates = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username })
      .from(users).where(eq(users.isActive, "active"));
    const assignees = (await Promise.all(candidates.map(async user => (await eligible(user.id, branchId)) ? user : null))).filter(Boolean);
    res.json({ assets, assignees });
  }));
  app.get(`${root}/summary`, isAuthenticated, permission("view"), handler(async (req, res) => {
    const branchId = String(req.query.branchId || "").trim();
    if (!branchId) fail(400, "branchId مطلوب");
    await branch(req, branchId);
    const active = and(eq(tickets.branchId, branchId), inArray(tickets.status, ACTIVE));
    const [open, overdue] = await Promise.all([
      db.select({ value: count() }).from(tickets).where(active),
      db.select({ value: count() }).from(tickets).where(and(active, lt(tickets.dueAt, new Date()))),
    ]);
    res.json({ branchId, open: Number(open[0]?.value || 0), overdue: Number(overdue[0]?.value || 0) });
  }));
  app.get(root, isAuthenticated, permission("view"), handler(async (req, res) => {
    const parsed = maintenanceTicketListQuerySchema.safeParse(req.query);
    if (!parsed.success) fail(400, "فلاتر غير صالحة");
    const { branchId, page, status, priority, assignee, overdue } = parsed.data;
    await branch(req, branchId);
    const filters = [eq(tickets.branchId, branchId)];
    if (status === "active") filters.push(inArray(tickets.status, ACTIVE));
    else if (status) filters.push(eq(tickets.status, status));
    if (priority) filters.push(eq(tickets.priority, priority));
    if (assignee) filters.push(eq(tickets.assigneeUserId, assignee));
    if (overdue === "true") filters.push(inArray(tickets.status, ACTIVE), lt(tickets.dueAt, new Date()));
    const [items, total] = await Promise.all([
      db.select().from(tickets).where(and(...filters)).orderBy(desc(tickets.updatedAt)).limit(25).offset((page - 1) * 25),
      db.select({ value: count() }).from(tickets).where(and(...filters)),
    ]);
    res.json({ items, total: Number(total[0]?.value || 0), page, pageSize: 25 });
  }));
  app.get(`${root}/:id`, isAuthenticated, permission("view"), handler(async (req, res) => {
    const ticket = await accessible(req, idFrom(req.params.id));
    const [history, files] = await Promise.all([
      db.select().from(events).where(eq(events.ticketId, ticket.id)).orderBy(events.createdAt, events.id),
      db.select().from(attachments).where(and(eq(attachments.ticketId, ticket.id), isNull(attachments.archivedAt))).orderBy(attachments.createdAt),
    ]);
    res.json({ ...ticket, events: history, attachments: files.map(safePhoto) });
  }));
  app.post(root, isAuthenticated, permission("create"), handler(async (req, res) => {
    const parsed = maintenanceTicketCreateSchema.safeParse(req.body);
    if (!parsed.success) fail(400, "بيانات البلاغ غير صالحة");
    const input = parsed.data;
    await branch(req, input.branchId);
    await validateReferences(input, input.branchId);
    const created = await db.transaction(async tx => {
      const [ticket] = await tx.insert(tickets).values({
        ...input, createdBy: req.currentUser!.id, updatedBy: req.currentUser!.id,
      }).returning();
      await record(tx, req, ticket, "created", input);
      return ticket;
    });
    res.status(201).json(created);
  }));
  app.patch(`${root}/:id`, isAuthenticated, permission("edit"), handler(async (req, res) => {
    const parsed = maintenanceTicketPatchSchema.safeParse(req.body);
    if (!parsed.success) fail(400, "بيانات التعديل غير صالحة");
    const current = await accessible(req, idFrom(req.params.id));
    if (current.status === "closed") fail(409, "أعد فتح البلاغ قبل تعديله");
    const { version, ...changes } = parsed.data;
    if (changes.assigneeUserId === null && ["assigned", "in_progress"].includes(current.status))
      fail(400, "لا يمكن إزالة المسؤول أثناء المعالجة");
    await validateReferences(changes, current.branchId);
    const updated = await db.transaction(async tx => {
      const [ticket] = await tx.update(tickets).set({
        ...changes, version: version + 1, updatedAt: new Date(), updatedBy: req.currentUser!.id,
      }).where(and(eq(tickets.id, current.id), eq(tickets.version, version), eq(tickets.status, current.status))).returning();
      if (!ticket) fail(409, "تعارض النسخة؛ حدّث الصفحة");
      await record(tx, req, ticket, "edited", changes);
      return ticket;
    });
    res.json(updated);
  }));
  app.post(`${root}/:id/transition`, isAuthenticated,
    permission(req => maintenanceTicketActionPermission(req.body?.action)), handler(async (req, res) => {
      const parsed = maintenanceTicketTransitionSchema.safeParse(req.body);
      if (!parsed.success) fail(400, "بيانات الإجراء أو السبب غير صالحة");
      const input = parsed.data;
      const current = await accessible(req, idFrom(req.params.id));
      const status = getMaintenanceTicketTransition(current.status as any, input.action);
      if (!status) fail(409, "انتقال الحالة غير مسموح");
      const assigneeUserId = input.action === "assign" ? input.assigneeUserId! : current.assigneeUserId;
      if (input.action === "assign" || input.action === "start") {
        if (!assigneeUserId) fail(400, "المسؤول مطلوب");
        await validateReferences({ assigneeUserId }, current.branchId);
      }
      const updated = await db.transaction(async tx => {
        const [ticket] = await tx.update(tickets).set({
          status, assigneeUserId: input.action === "reopen" ? null : assigneeUserId,
          closedAt: status === "closed" ? new Date() : null,
          version: input.version + 1, updatedAt: new Date(), updatedBy: req.currentUser!.id,
        }).where(and(eq(tickets.id, current.id), eq(tickets.version, input.version), eq(tickets.status, current.status))).returning();
        if (!ticket) fail(409, "تعارض النسخة؛ حدّث الصفحة");
        await record(tx, req, ticket, input.action, input, current.status, input.reason);
        return ticket;
      });
      res.json(updated);
    }));
  app.post(`${root}/:id/attachments`, isAuthenticated, permission("edit"), (req, res, next) => {
    upload(req, res, error => {
      if (error) { res.status(400).json({ message: error.message }); return; }
      void handler(async (req, res) => {
        const current = await accessible(req, idFrom(req.params.id));
        const version = idFrom(req.body.version);
        if (current.status === "closed") fail(409, "لا يمكن تعديل صور بلاغ مغلق");
        if (!req.file) fail(400, "الصورة مطلوبة");
        const sniffed = sniffMaintenancePhoto(req.file!.buffer);
        if (!sniffed) fail(400, "المسموح صور PNG أو JPEG أو WebP فقط");
        if (!(await photos.isReady())) fail(503, "مخزن الصور الخاص غير متاح");
        const uploaded = await photos.upload(req.file!.buffer, sniffed!.extension, sniffed!.mimeType);
        try {
          const attachment = await db.transaction(async tx => {
            const [ticket] = await tx.update(tickets).set({
              version: version + 1, updatedAt: new Date(), updatedBy: req.currentUser!.id,
            }).where(and(eq(tickets.id, current.id), eq(tickets.version, version), eq(tickets.status, current.status))).returning();
            if (!ticket) fail(409, "تعارض النسخة؛ حدّث الصفحة");
            const [photo] = await tx.insert(attachments).values({
              ticketId: ticket.id, storagePath: uploaded.storagePath, originalName: req.file!.originalname,
              mimeType: sniffed!.mimeType, sizeBytes: req.file!.size, uploadedBy: req.currentUser!.id,
            }).returning();
            await record(tx, req, ticket, "attachment_added", { attachmentId: photo.id });
            return photo;
          });
          res.status(201).json(safePhoto(attachment));
        } catch (error) {
          try { await photos.delete(uploaded.storagePath); }
          catch { fail(500, "فشل حفظ المرفق وتنظيف الملف الخاص"); }
          throw error;
        }
      })(req, res, next);
    });
  });
  app.get(`${root}/:id/attachments/:attachmentId`, isAuthenticated, permission("view"), handler(async (req, res) => {
    const ticket = await accessible(req, idFrom(req.params.id));
    const [photo] = await db.select().from(attachments).where(and(
      eq(attachments.id, idFrom(req.params.attachmentId)), eq(attachments.ticketId, ticket.id), isNull(attachments.archivedAt),
    )).limit(1);
    if (!photo) fail(404, "الصورة غير موجودة");
    const file = await photos.download(photo.storagePath);
    res.setHeader("Content-Type", photo.mimeType);
    res.setHeader("Content-Length", String(file.data.length));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(photo.originalName)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox");
    res.send(file.data);
  }));
  app.delete(`${root}/:id/attachments/:attachmentId`, isAuthenticated, permission("edit"), handler(async (req, res) => {
    const current = await accessible(req, idFrom(req.params.id));
    const version = idFrom(req.body.version);
    const attachmentId = idFrom(req.params.attachmentId);
    if (current.status === "closed") fail(409, "لا يمكن تعديل صور بلاغ مغلق");
    await db.transaction(async tx => {
      const [ticket] = await tx.update(tickets).set({
        version: version + 1, updatedAt: new Date(), updatedBy: req.currentUser!.id,
      }).where(and(eq(tickets.id, current.id), eq(tickets.version, version), eq(tickets.status, current.status))).returning();
      if (!ticket) fail(409, "تعارض النسخة؛ حدّث الصفحة");
      const [photo] = await tx.update(attachments).set({ archivedAt: new Date(), archivedBy: req.currentUser!.id }).where(and(
        eq(attachments.id, attachmentId), eq(attachments.ticketId, ticket.id), isNull(attachments.archivedAt),
      )).returning();
      if (!photo) fail(404, "الصورة غير موجودة");
      await record(tx, req, ticket, "attachment_archived", { attachmentId, objectRetained: true });
    });
    res.json({ archived: true, objectRetained: true, version: version + 1 });
  }));
}