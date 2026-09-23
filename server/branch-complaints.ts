import type { Express, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { and, count, desc, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import {
  branchComplaintAttachments,
  branchComplaintEvents,
  branchComplaints,
  systemAuditLogs,
  userBranchAccess,
  users,
} from "@shared/schema";
import {
  branchComplaintCreateSchema,
  getBranchComplaintTransition,
  branchComplaintListQuerySchema,
  branchComplaintPatchSchema,
  branchComplaintTransitionSchema,
} from "@shared/branch-complaints";
import { db } from "./db";
import {
  BRANCH_MANAGER_INTRINSIC_PERMISSIONS,
  OPERATIONS_MANAGER_PERMISSIONS,
  canAccessBranch,
  isAuthenticated,
} from "./auth";
import { storage } from "./storage";
import { complaintAttachmentStorage } from "./branch-complaint-attachment-storage";

const MODULE = "branch_complaints";
const PAGE_SIZE = 25;
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
}).single("file");

const idFrom = (raw: string) => {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

function validationError(res: Response, error: any) {
  return res.status(400).json({ message: "بيانات الطلب غير صالحة", issues: error.issues });
}

function intrinsicActions(role: string): string[] {
  if (role === "admin") return ["view", "create", "edit", "approve"];
  if (role === "operations_manager") return OPERATIONS_MANAGER_PERMISSIONS[MODULE] || [];
  if (role === "branch_manager") return BRANCH_MANAGER_INTRINSIC_PERMISSIONS[MODULE] || [];
  return [];
}

const requireFreshComplaintPermission = (action: "view" | "create" | "edit" | "approve"): RequestHandler =>
  async (req, res, next) => {
    const sessionUserId = req.session.userId;
    if (!sessionUserId) return res.status(401).json({ message: "غير مصرح" });
    const [freshUser] = await db.select().from(users).where(and(
      eq(users.id, sessionUserId), eq(users.isActive, "active"),
    )).limit(1);
    if (!freshUser) return res.status(403).json({ message: "الحساب غير نشط" });
    const allowed = intrinsicActions(freshUser.role).includes(action)
      || await storage.hasPermission(freshUser.id, MODULE, action);
    if (!allowed) return res.status(403).json({ message: `غير مسموح - صلاحية ${action} مطلوبة` });
    req.currentUser = freshUser;
    // Force canAccessBranch to consume a fresh branch grant set, not auth cache.
    (req as any).userBranchAccess = await db.select().from(userBranchAccess)
      .where(eq(userBranchAccess.userId, freshUser.id));
    next();
  };

const requireFreshTransitionPermission: RequestHandler = (req, res, next) =>
  requireFreshComplaintPermission(
    req.body?.action === "close" || req.body?.action === "reopen" ? "approve" : "edit",
  )(req, res, next);

function sniffAttachment(buffer: Buffer): { mimeType: string; extension: string } | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return { mimeType: "application/pdf", extension: "pdf" };
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mimeType: "image/png", extension: "png" };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mimeType: "image/webp", extension: "webp" };
  }
  return null;
}

async function accessibleComplaint(req: Request, id: number) {
  const [complaint] = await db.select().from(branchComplaints).where(eq(branchComplaints.id, id)).limit(1);
  if (!complaint || !(await canAccessBranch(req, complaint.branchId))) return null;
  return complaint;
}

async function isEligibleOwner(userId: string, branchId: string): Promise<boolean> {
  const [user] = await db.select({ id: users.id, role: users.role, branchId: users.branchId })
    .from(users).where(and(eq(users.id, userId), eq(users.isActive, "active"))).limit(1);
  if (!user) return false;
  const intrinsic = user.role === "admin"
    || (user.role === "operations_manager" && OPERATIONS_MANAGER_PERMISSIONS[MODULE]?.includes("edit"))
    || (user.role === "branch_manager" && BRANCH_MANAGER_INTRINSIC_PERMISSIONS[MODULE]?.includes("edit"));
  if (!intrinsic && !(await storage.hasPermission(userId, MODULE, "edit"))) return false;
  if (user.role === "admin") return true;
  const branchGrants = await db.select({ branchId: userBranchAccess.branchId }).from(userBranchAccess)
    .where(eq(userBranchAccess.userId, userId));
  if (user.role === "operations_manager") {
    return branchGrants.length === 0 || branchGrants.some((grant) => grant.branchId === branchId);
  }
  if (user.branchId === branchId) return true;
  return branchGrants.some((grant) => grant.branchId === branchId);
}

async function ensureOwner(ownerUserId: string | null | undefined, branchId: string) {
  return !ownerUserId || isEligibleOwner(ownerUserId, branchId);
}

function auditValues(user: any, complaint: any, action: string, details: unknown) {
  return {
    module: MODULE,
    entityId: String(complaint.id),
    entityName: complaint.subject,
    action,
    details: JSON.stringify(details),
    userId: user.id,
    userName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username,
    branchId: complaint.branchId,
  };
}

function attachmentForClient<T extends { storagePath: string }>(attachment: T) {
  const { storagePath: _privateStoragePath, ...safeAttachment } = attachment;
  return safeAttachment;
}

export function registerBranchComplaintRoutes(app: Express): void {
  app.get("/api/branch-complaints/summary", isAuthenticated, requireFreshComplaintPermission("view"), async (req, res, next) => {
    try {
      const branchId = typeof req.query.branchId === "string" ? req.query.branchId.trim() : "";
      if (!branchId) return res.status(400).json({ message: "branchId مطلوب" });
      if (!(await canAccessBranch(req, branchId))) return res.status(403).json({ message: "غير مسموح بالوصول إلى الفرع" });
      const now = new Date();
      const [open, overdue] = await Promise.all([
        db.select({ value: count() }).from(branchComplaints).where(and(
          eq(branchComplaints.branchId, branchId), inArray(branchComplaints.status, ["open", "in_progress", "resolved"]),
        )),
        db.select({ value: count() }).from(branchComplaints).where(and(
          eq(branchComplaints.branchId, branchId), ne(branchComplaints.status, "closed"),
          lt(branchComplaints.responseDue, now), isNull(branchComplaints.firstRespondedAt),
        )),
      ]);
      res.json({ branchId, open: Number(open[0]?.value || 0), overdue: Number(overdue[0]?.value || 0) });
    } catch (error) { next(error); }
  });

  app.get("/api/branch-complaints/assignees", isAuthenticated, requireFreshComplaintPermission("view"), async (req, res, next) => {
    try {
      const branchId = typeof req.query.branchId === "string" ? req.query.branchId.trim() : "";
      if (!branchId) return res.status(400).json({ message: "branchId مطلوب" });
      if (!(await canAccessBranch(req, branchId))) return res.status(403).json({ message: "غير مسموح بالوصول إلى الفرع" });
      const candidates = await db.select({
        id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username,
      }).from(users).where(eq(users.isActive, "active")).orderBy(users.firstName, users.lastName);
      const eligible = (await Promise.all(candidates.map(async (candidate) =>
        (await isEligibleOwner(candidate.id, branchId)) ? candidate : null))).filter(Boolean);
      res.json(eligible);
    } catch (error) { next(error); }
  });

  app.get("/api/branch-complaints", isAuthenticated, requireFreshComplaintPermission("view"), async (req, res, next) => {
    try {
      const parsed = branchComplaintListQuerySchema.safeParse(req.query);
      if (!parsed.success) return validationError(res, parsed.error);
      const { branchId, page, status, priority, owner } = parsed.data;
      if (!(await canAccessBranch(req, branchId))) return res.status(403).json({ message: "غير مسموح بالوصول إلى الفرع" });
      const filters = [eq(branchComplaints.branchId, branchId)];
      if (status) filters.push(eq(branchComplaints.status, status));
      if (priority) filters.push(eq(branchComplaints.priority, priority));
      if (owner) filters.push(eq(branchComplaints.ownerUserId, owner));
      const where = and(...filters);
      const [items, total] = await Promise.all([
        db.select().from(branchComplaints).where(where).orderBy(desc(branchComplaints.updatedAt))
          .limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
        db.select({ value: count() }).from(branchComplaints).where(where),
      ]);
      const ownerIds = Array.from(new Set(items.map((item) => item.ownerUserId).filter((value): value is string => !!value)));
      const owners = ownerIds.length ? await db.select({
        id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username,
      }).from(users).where(inArray(users.id, ownerIds)) : [];
      const ownerNames = new Map(owners.map((owner) => [
        owner.id,
        [owner.firstName, owner.lastName].filter(Boolean).join(" ") || owner.username || "مستخدم",
      ]));
      res.json({
        items: items.map((item) => ({
          ...item, ownerName: item.ownerUserId ? ownerNames.get(item.ownerUserId) || null : null,
        })),
        page, pageSize: PAGE_SIZE, total: Number(total[0]?.value || 0),
      });
    } catch (error) { next(error); }
  });

  app.get("/api/branch-complaints/:id", isAuthenticated, requireFreshComplaintPermission("view"), async (req, res, next) => {
    try {
      const id = idFrom(req.params.id);
      if (!id) return res.status(400).json({ message: "معرف الشكوى غير صالح" });
      const complaint = await accessibleComplaint(req, id);
      if (!complaint) return res.status(404).json({ message: "الشكوى غير موجودة أو غير مسموحة" });
      const [events, attachments] = await Promise.all([
        db.select().from(branchComplaintEvents).where(eq(branchComplaintEvents.complaintId, id))
          .orderBy(branchComplaintEvents.createdAt),
        db.select().from(branchComplaintAttachments).where(and(
          eq(branchComplaintAttachments.complaintId, id), isNull(branchComplaintAttachments.archivedAt),
        )).orderBy(branchComplaintAttachments.createdAt),
      ]);
      const referencedUserIds = Array.from(new Set([
        complaint.ownerUserId,
        ...events.map((event) => event.actorUserId),
        ...attachments.map((attachment) => attachment.uploadedBy),
      ].filter((value): value is string => !!value)));
      const people = referencedUserIds.length
        ? await db.select({
          id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username,
        }).from(users).where(inArray(users.id, referencedUserIds))
        : [];
      const names = new Map(people.map((person) => [
        person.id,
        [person.firstName, person.lastName].filter(Boolean).join(" ") || person.username || "مستخدم",
      ]));
      res.json({
        ...complaint,
        ownerName: complaint.ownerUserId ? names.get(complaint.ownerUserId) || null : null,
        events: events.map((event) => ({ ...event, actorName: names.get(event.actorUserId) || null })),
        attachments: attachments.map((attachment) => ({
          ...attachmentForClient(attachment), uploaderName: names.get(attachment.uploadedBy) || null,
        })),
      });
    } catch (error) { next(error); }
  });

  app.post("/api/branch-complaints", isAuthenticated, requireFreshComplaintPermission("view"), requireFreshComplaintPermission("create"), async (req, res, next) => {
    try {
      const parsed = branchComplaintCreateSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed.error);
      const input = parsed.data;
      if (!(await canAccessBranch(req, input.branchId))) return res.status(403).json({ message: "غير مسموح بالوصول إلى الفرع" });
      if (!(await ensureOwner(input.ownerUserId, input.branchId))) return res.status(400).json({ message: "المسؤول غير مؤهل لهذه الشكوى أو لا يملك وصول الفرع" });
      const user = req.currentUser!;
      const created = await db.transaction(async (tx) => {
        const [complaint] = await tx.insert(branchComplaints).values({
          ...input, ownerUserId: input.ownerUserId || null, responseDue: input.responseDue || null,
          createdBy: user.id, updatedBy: user.id,
        }).returning();
        await tx.insert(branchComplaintEvents).values({
          complaintId: complaint.id, actorUserId: user.id, eventType: "created",
          changes: { subject: complaint.subject, category: complaint.category, priority: complaint.priority, ownerUserId: complaint.ownerUserId },
        });
        await tx.insert(systemAuditLogs).values(auditValues(user, complaint, "create", { version: complaint.version }));
        return complaint;
      });
      res.status(201).json(created);
    } catch (error) { next(error); }
  });

  app.patch("/api/branch-complaints/:id", isAuthenticated, requireFreshComplaintPermission("view"), requireFreshComplaintPermission("edit"), async (req, res, next) => {
    try {
      const id = idFrom(req.params.id);
      if (!id) return res.status(400).json({ message: "معرف الشكوى غير صالح" });
      const parsed = branchComplaintPatchSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed.error);
      const current = await accessibleComplaint(req, id);
      if (!current) return res.status(404).json({ message: "الشكوى غير موجودة أو غير مسموحة" });
      if (!(await ensureOwner(parsed.data.ownerUserId, current.branchId))) return res.status(400).json({ message: "المسؤول غير مؤهل لهذه الشكوى أو لا يملك وصول الفرع" });
      const { version, ...changes } = parsed.data;
      const user = req.currentUser!;
      const updated = await db.transaction(async (tx) => {
        const [complaint] = await tx.update(branchComplaints).set({
          ...changes, updatedBy: user.id, updatedAt: new Date(), version: version + 1,
        }).where(and(eq(branchComplaints.id, id), eq(branchComplaints.version, version))).returning();
        if (!complaint) return null;
        await tx.insert(branchComplaintEvents).values({ complaintId: id, actorUserId: user.id, eventType: "edited", changes });
        await tx.insert(systemAuditLogs).values(auditValues(user, complaint, "update", { version, changes }));
        return complaint;
      });
      if (!updated) return res.status(409).json({ message: "تم تعديل الشكوى من مستخدم آخر؛ حدّث الصفحة" });
      res.json(updated);
    } catch (error) { next(error); }
  });

  app.post("/api/branch-complaints/:id/transition", isAuthenticated, requireFreshComplaintPermission("view"), requireFreshTransitionPermission, async (req, res, next) => {
    try {
      const id = idFrom(req.params.id);
      if (!id) return res.status(400).json({ message: "معرف الشكوى غير صالح" });
      const parsed = branchComplaintTransitionSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed.error);
      const current = await accessibleComplaint(req, id);
      if (!current) return res.status(404).json({ message: "الشكوى غير موجودة أو غير مسموحة" });
      const nextStatus = getBranchComplaintTransition(current.status as any, parsed.data.action);
      if (!nextStatus) return res.status(409).json({ message: "انتقال الحالة غير مسموح" });
      const user = req.currentUser!;
      const now = new Date();
      const updated = await db.transaction(async (tx) => {
        const [complaint] = await tx.update(branchComplaints).set({
          status: nextStatus,
          resolution: parsed.data.action === "resolve" ? parsed.data.resolution! : current.resolution,
          firstRespondedAt: parsed.data.action === "start" && !current.firstRespondedAt ? now : current.firstRespondedAt,
          updatedBy: user.id, updatedAt: now, version: parsed.data.version + 1,
        }).where(and(
          eq(branchComplaints.id, id), eq(branchComplaints.version, parsed.data.version),
          eq(branchComplaints.status, current.status),
        )).returning();
        if (!complaint) return null;
        await tx.insert(branchComplaintEvents).values({
          complaintId: id, actorUserId: user.id, eventType: parsed.data.action,
          fromStatus: current.status, toStatus: nextStatus, reason: parsed.data.reason || null,
          changes: parsed.data.resolution ? { resolution: parsed.data.resolution } : null,
        });
        await tx.insert(systemAuditLogs).values(auditValues(user, complaint, parsed.data.action, {
          from: current.status, to: nextStatus, reason: parsed.data.reason, version: parsed.data.version,
        }));
        return complaint;
      });
      if (!updated) return res.status(409).json({ message: "تعارض في النسخة؛ حدّث الصفحة" });
      res.json(updated);
    } catch (error) { next(error); }
  });

  app.post("/api/branch-complaints/:id/attachments", isAuthenticated, requireFreshComplaintPermission("view"), requireFreshComplaintPermission("edit"), (req, res, next) => {
    attachmentUpload(req, res, async (uploadError) => {
      try {
        if (uploadError) return res.status(400).json({ message: uploadError.message });
        const id = idFrom(req.params.id);
        if (!id) return res.status(400).json({ message: "معرف الشكوى غير صالح" });
        const complaint = await accessibleComplaint(req, id);
        if (!complaint) return res.status(404).json({ message: "الشكوى غير موجودة أو غير مسموحة" });
        if (complaint.status === "closed") return res.status(409).json({ message: "لا يمكن إرفاق ملف بشكوى مغلقة" });
        if (!req.file) return res.status(400).json({ message: "الملف مطلوب" });
        const sniffed = sniffAttachment(req.file.buffer);
        if (!sniffed) return res.status(400).json({ message: "محتوى الملف غير مسموح؛ المسموح PDF أو PNG أو JPEG أو WebP" });
        if (!(await complaintAttachmentStorage.isReady())) {
          return res.status(503).json({ message: "مخزن المرفقات الخاص غير متاح" });
        }
        const uploaded = await complaintAttachmentStorage.upload(
          req.file.buffer, sniffed.extension, sniffed.mimeType,
        );
        const user = req.currentUser!;
        let attachment;
        try {
          attachment = await db.transaction(async (tx) => {
            const [row] = await tx.insert(branchComplaintAttachments).values({
              complaintId: id, originalName: req.file!.originalname, storagePath: uploaded.storagePath,
              mimeType: sniffed.mimeType, sizeBytes: req.file!.size, uploadedBy: user.id,
            }).returning();
            await tx.insert(branchComplaintEvents).values({
              complaintId: id, actorUserId: user.id, eventType: "attachment_added",
              changes: { attachmentId: row.id, name: row.originalName, mimeType: row.mimeType, sizeBytes: row.sizeBytes },
            });
            await tx.insert(systemAuditLogs).values(auditValues(user, complaint, "attachment_added", { attachmentId: row.id }));
            return row;
          });
        } catch (dbError) {
          try {
            await complaintAttachmentStorage.delete(uploaded.storagePath);
          } catch (cleanupError) {
            console.error("Complaint attachment DB transaction and object cleanup failed", {
              complaintId: id, storagePath: uploaded.storagePath, dbError, cleanupError,
            });
            return res.status(500).json({
              message: "فشل حفظ بيانات المرفق وفشل تنظيف الملف المخزن",
              cleanupFailed: true,
            });
          }
          throw dbError;
        }
        res.status(201).json(attachmentForClient(attachment));
      } catch (error) { next(error); }
    });
  });

  app.get("/api/branch-complaints/:id/attachments/:attachmentId", isAuthenticated, requireFreshComplaintPermission("view"), async (req, res, next) => {
    try {
      const id = idFrom(req.params.id);
      const attachmentId = idFrom(req.params.attachmentId);
      if (!id || !attachmentId) return res.status(400).json({ message: "المعرف غير صالح" });
      if (!(await accessibleComplaint(req, id))) return res.status(404).json({ message: "الشكوى غير موجودة أو غير مسموحة" });
      const [attachment] = await db.select().from(branchComplaintAttachments).where(and(
        eq(branchComplaintAttachments.id, attachmentId), eq(branchComplaintAttachments.complaintId, id),
        isNull(branchComplaintAttachments.archivedAt),
      )).limit(1);
      if (!attachment) return res.status(404).json({ message: "المرفق غير موجود" });
        const downloaded = await complaintAttachmentStorage.download(attachment.storagePath);
      res.setHeader("Content-Type", attachment.mimeType);
        res.setHeader("Content-Length", String(downloaded.data.length));
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`);
        res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox");
        res.send(downloaded.data);
    } catch (error) { next(error); }
  });

  app.delete("/api/branch-complaints/:id/attachments/:attachmentId", isAuthenticated, requireFreshComplaintPermission("view"), requireFreshComplaintPermission("edit"), async (req, res, next) => {
    try {
      const id = idFrom(req.params.id);
      const attachmentId = idFrom(req.params.attachmentId);
      if (!id || !attachmentId) return res.status(400).json({ message: "المعرف غير صالح" });
      const complaint = await accessibleComplaint(req, id);
      if (!complaint) return res.status(404).json({ message: "الشكوى غير موجودة أو غير مسموحة" });
      if (complaint.status === "closed") return res.status(409).json({ message: "لا يمكن تعديل مرفقات شكوى مغلقة" });
      const user = req.currentUser!;
      const archived = await db.transaction(async (tx) => {
        const [row] = await tx.update(branchComplaintAttachments).set({ archivedAt: new Date(), archivedBy: user.id })
          .where(and(eq(branchComplaintAttachments.id, attachmentId), eq(branchComplaintAttachments.complaintId, id),
            isNull(branchComplaintAttachments.archivedAt))).returning();
        if (!row) return null;
        await tx.insert(branchComplaintEvents).values({
          complaintId: id, actorUserId: user.id, eventType: "attachment_archived",
          changes: { attachmentId: row.id, name: row.originalName, objectRetained: true },
        });
        await tx.insert(systemAuditLogs).values(auditValues(user, complaint, "attachment_archived", { attachmentId, objectRetained: true }));
        return row;
      });
      if (!archived) return res.status(404).json({ message: "المرفق غير موجود" });
      res.json({ archived: true, objectRetained: true });
    } catch (error) { next(error); }
  });
}