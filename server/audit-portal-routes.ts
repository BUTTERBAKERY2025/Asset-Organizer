// بوابة المراجعة المالية — Audit Portal
// فريق الإدارة المالية (admin / financial_manager) يدير الفترات والملفات والمتطلبات،
// ومكتب المراجعة الخارجي (external_auditor) يدخل بواجهة خاصة: يشاهد ويحمّل الملفات،
// يضيف طلبات، يعتمد أو يرفض البنود، ويعلّق — ولا يصل لأي جزء آخر من النظام.
import type { Express, RequestHandler } from "express";
import { db } from "./db";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { isAuthenticated } from "./auth";
import { storage } from "./storage";
import {
  auditPeriods,
  auditRequirements,
  auditFiles,
  auditComments,
  auditActivityLog,
  users,
} from "@shared/schema";
import { uploadToSupabase, downloadFromSupabase, deleteFromSupabase } from "./supabase-storage";

type Ctx = { id: string; name: string; role: string; isAuditor: boolean; isTeam: boolean };

async function getCtx(req: any): Promise<Ctx | null> {
  const userId = req.session?.userId;
  if (!userId) return null;
  const [u] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u || u.isActive !== "active") return null;
  const isTeam = u.role === "admin" || u.role === "financial_manager";
  const isAuditor = u.role === "external_auditor";
  const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return { id: u.id, name: fullName || u.username || "مستخدم", role: u.role, isAuditor, isTeam };
}

// فريق الإدارة المالية فقط (إدارة كاملة)
const requireTeam: RequestHandler = async (req: any, res, next) => {
  const ctx = await getCtx(req);
  if (!ctx || !ctx.isTeam) return res.status(403).json({ error: "هذه البوابة متاحة لفريق الإدارة المالية فقط" });
  req.auditCtx = ctx;
  next();
};

// الفريق أو المراجع الخارجي (اطلاع وتفاعل)
const requireTeamOrAuditor: RequestHandler = async (req: any, res, next) => {
  const ctx = await getCtx(req);
  if (!ctx || (!ctx.isTeam && !ctx.isAuditor)) return res.status(403).json({ error: "غير مصرح بالدخول لبوابة المراجعة" });
  req.auditCtx = ctx;
  next();
};

async function logActivity(periodId: number | null, ctx: Ctx, action: string, details?: string) {
  try {
    await db.insert(auditActivityLog).values({ periodId, userName: ctx.name, isAuditor: ctx.isAuditor, action, details: details?.slice(0, 500) });
  } catch {}
}

const FILE_CATEGORIES = new Set([
  "financial_statements", "trial_balance", "banks", "expenses", "revenues", "taxes", "contracts", "payroll", "inventory", "other",
]);

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword",
  "image/png", "image/jpeg",
  "application/zip", "application/x-zip-compressed",
]);
const ALLOWED_EXT = /\.(pdf|xlsx|xls|csv|docx|doc|png|jpg|jpeg|zip)$/i;

// فحص التوقيع الثنائي (magic bytes) — لا نثق بامتداد الملف أو نوع MIME المرسل من المتصفح
function sniffBuffer(buf: Buffer): string | null {
  if (buf.length < 8) return null;
  const head = buf.subarray(0, 8);
  if (head.subarray(0, 5).toString("latin1").startsWith("%PDF-")) return "application/pdf";
  if (head[0] === 0x50 && head[1] === 0x4b) return "application/zip"; // zip/xlsx/docx
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return "image/png";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return "application/vnd.ms-excel"; // xls/doc قديم
  return null; // csv وملفات نصية
}
function extAllowsSniff(ext: string, sniffed: string | null, buf: Buffer): boolean {
  const e = ext.toLowerCase();
  if (e === ".pdf") return sniffed === "application/pdf";
  if ([".xlsx", ".docx", ".zip"].includes(e)) return sniffed === "application/zip";
  if ([".xls", ".doc"].includes(e)) return sniffed === "application/vnd.ms-excel" || sniffed === "application/zip";
  if (e === ".png") return sniffed === "image/png";
  if ([".jpg", ".jpeg"].includes(e)) return sniffed === "image/jpeg";
  if (e === ".csv") {
    // نص فقط: نرفض أي محتوى ثنائي معروف ونرفض بايتات NUL
    if (sniffed) return false;
    return !buf.subarray(0, 4096).includes(0);
  }
  return false;
}

// قفل شامل لحساب المراجع الخارجي: يُمنع من كل واجهات النظام عدا بوابة المراجعة وجلسة الدخول
// (يُسجَّل قبل بقية المسارات في routes.ts — الحماية على مستوى السيرفر وليس الواجهة فقط)
const roleCache = new Map<string, { role: string; ts: number }>();
export const auditorApiLockdown: RequestHandler = async (req: any, res, next) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return next();
    let cached = roleCache.get(userId);
    if (!cached || Date.now() - cached.ts > 60_000) {
      const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
      cached = { role: u?.role || "", ts: Date.now() };
      roleCache.set(userId, cached);
    }
    if (cached.role !== "external_auditor") return next();
    const p = req.path;
    const allowed = p.startsWith("/api/audit/") || p.startsWith("/api/auth/") || p === "/api/my-permissions";
    if (!allowed && p.startsWith("/api")) {
      return res.status(403).json({ error: "حساب المراجع الخارجي مقصور على بوابة المراجعة المالية فقط" });
    }
    next();
  } catch { next(); }
};

export function registerAuditPortalRoutes(app: Express) {
  // سياق البوابة: من أنا (فريق أم مراجع خارجي)
  app.get("/api/audit/portal-context", isAuthenticated, async (req: any, res) => {
    const ctx = await getCtx(req);
    if (!ctx || (!ctx.isTeam && !ctx.isAuditor)) return res.status(403).json({ error: "غير مصرح" });
    res.json({ name: ctx.name, role: ctx.isAuditor ? "auditor" : "team" });
  });

  // ===== الفترات المالية =====
  app.get("/api/audit/periods", isAuthenticated, requireTeamOrAuditor, async (_req, res) => {
    try {
      const rows = await db.select().from(auditPeriods).orderBy(desc(auditPeriods.id));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/audit/periods", isAuthenticated, requireTeam, async (req: any, res) => {
    try {
      const { title, periodType, fiscalYear, periodStart, periodEnd, notes } = req.body || {};
      if (!title || String(title).trim().length < 3) return res.status(400).json({ error: "عنوان الفترة مطلوب" });
      const year = parseInt(fiscalYear);
      if (!year || year < 2000 || year > 2100) return res.status(400).json({ error: "السنة المالية غير صحيحة" });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart || "") || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd || "")) {
        return res.status(400).json({ error: "تواريخ الفترة مطلوبة" });
      }
      if (periodEnd < periodStart) return res.status(400).json({ error: "نهاية الفترة قبل بدايتها" });
      const pType = ["annual", "semi_annual", "quarterly"].includes(periodType) ? periodType : "semi_annual";
      const [row] = await db.insert(auditPeriods).values({
        title: String(title).trim().slice(0, 200),
        periodType: pType,
        fiscalYear: year,
        periodStart, periodEnd,
        notes: notes ? String(notes).slice(0, 1000) : null,
        createdBy: req.auditCtx.name,
      }).returning();
      await logActivity(row.id, req.auditCtx, "create_period", row.title);
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/audit/periods/:id", isAuthenticated, requireTeam, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const allowed: any = {};
      if (req.body.title) allowed.title = String(req.body.title).trim().slice(0, 200);
      if (req.body.status && ["active", "under_review", "approved", "closed"].includes(req.body.status)) allowed.status = req.body.status;
      if (req.body.notes !== undefined) allowed.notes = req.body.notes ? String(req.body.notes).slice(0, 1000) : null;
      allowed.updatedAt = new Date();
      const [row] = await db.update(auditPeriods).set(allowed).where(eq(auditPeriods.id, id)).returning();
      if (!row) return res.status(404).json({ error: "الفترة غير موجودة" });
      await logActivity(id, req.auditCtx, "update_period", JSON.stringify(Object.keys(allowed)));
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/audit/periods/:id", isAuthenticated, requireTeam, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const files = await db.select().from(auditFiles).where(eq(auditFiles.periodId, id));
      for (const f of files) { try { await deleteFromSupabase(f.storagePath); } catch {} }
      const [row] = await db.delete(auditPeriods).where(eq(auditPeriods.id, id)).returning();
      if (!row) return res.status(404).json({ error: "الفترة غير موجودة" });
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== نظرة شاملة للفترة: ملفات + متطلبات + تعليقات + نسبة الإنجاز =====
  app.get("/api/audit/periods/:id/overview", isAuthenticated, requireTeamOrAuditor, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [period] = await db.select().from(auditPeriods).where(eq(auditPeriods.id, id));
      if (!period) return res.status(404).json({ error: "الفترة غير موجودة" });
      const [files, reqs] = await Promise.all([
        db.select().from(auditFiles).where(eq(auditFiles.periodId, id)).orderBy(desc(auditFiles.id)),
        db.select().from(auditRequirements).where(eq(auditRequirements.periodId, id)).orderBy(desc(auditRequirements.id)),
      ]);
      const reqIds = reqs.map(r => r.id);
      const comments = reqIds.length
        ? await db.select().from(auditComments).where(inArray(auditComments.requirementId, reqIds)).orderBy(asc(auditComments.id))
        : [];
      const total = reqs.length;
      const approved = reqs.filter(r => r.status === "approved").length;
      const uploaded = reqs.filter(r => r.status === "uploaded").length;
      res.json({
        period, files, requirements: reqs, comments,
        stats: { total, approved, uploaded, progress: total ? Math.round((approved / total) * 100) : 0 },
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== رفع ملف (الفريق فقط) =====
  app.post("/api/audit/periods/:id/files", isAuthenticated, requireTeam, async (req: any, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const [period] = await db.select().from(auditPeriods).where(eq(auditPeriods.id, periodId));
      if (!period) return res.status(404).json({ error: "الفترة غير موجودة" });
      if (period.status === "closed") return res.status(400).json({ error: "الفترة مغلقة" });

      const multer = (await import("multer")).default;
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 50 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          if (ALLOWED_MIME.has(file.mimetype) || ALLOWED_EXT.test(file.originalname || "")) cb(null, true);
          else cb(new Error("نوع الملف غير مدعوم — المسموح: PDF, Excel, Word, CSV, صور, ZIP"));
        },
      }).fields([{ name: "file", maxCount: 1 }, { name: "files", maxCount: 20 }]);

      upload(req, res, async (err: any) => {
        if (err) return res.status(400).json({ error: err.message || "فشل رفع الملف" });
        try {
          const incoming: Express.Multer.File[] = [
            ...(((req.files as any)?.file as Express.Multer.File[]) || []),
            ...(((req.files as any)?.files as Express.Multer.File[]) || []),
          ];
          if (!incoming.length) return res.status(400).json({ error: "لم يتم إرفاق ملف" });
          if (incoming.length > 20) return res.status(400).json({ error: "الحد الأقصى 20 ملفاً في الدفعة الواحدة" });
          const category = FILE_CATEGORIES.has(req.body.category) ? req.body.category : "other";
          let requirementId: number | null = null;
          if (req.body.requirementId) {
            const rid = parseInt(req.body.requirementId);
            const [r] = await db.select().from(auditRequirements)
              .where(and(eq(auditRequirements.id, rid), eq(auditRequirements.periodId, periodId)));
            if (!r) return res.status(400).json({ error: "المتطلب غير موجود في هذه الفترة" });
            if (r.status === "approved") return res.status(400).json({ error: "البند معتمد من المراجع — أعده للتعديل أولاً قبل إرفاق ملفات جديدة" });
            if (r.status === "not_applicable") return res.status(400).json({ error: "البند «غير منطبق» — غيّر حالته أولاً قبل رفع ملف عليه" });
            requirementId = rid;
          }
          const baseTitle = String(req.body.title || "").trim();
          if (incoming.length === 1 && baseTitle && (baseTitle.length < 2 || baseTitle.length > 300)) {
            return res.status(400).json({ error: "عنوان الملف غير صالح" });
          }

          const uploadedRows: any[] = [];
          const failed: { fileName: string; error: string }[] = [];
          let seq = 0;
          for (const f of incoming) {
            seq++;
            let originalName = f.originalname || "file";
            try {
              const decoded = Buffer.from(originalName, "latin1").toString("utf8");
              if (!decoded.includes("\uFFFD")) originalName = decoded;
            } catch {}
            const extMatch = originalName.match(ALLOWED_EXT);
            if (!extMatch) { failed.push({ fileName: originalName, error: "امتداد الملف غير مدعوم" }); continue; }
            const ext = extMatch[0].toLowerCase();
            const sniffed = sniffBuffer(f.buffer);
            if (!extAllowsSniff(ext, sniffed, f.buffer)) {
              failed.push({ fileName: originalName, error: "محتوى الملف لا يطابق امتداده" }); continue;
            }
            const storageName = `audit_${periodId}_${Date.now()}_${seq}${ext}`;
            const uploadedFile = await uploadToSupabase(f.buffer, storageName, f.mimetype || "application/octet-stream");
            if (!uploadedFile) { failed.push({ fileName: originalName, error: "فشل الرفع إلى التخزين" }); continue; }
            // عنوان الملف: المُرسل (لملف واحد) أو اسم الملف بدون الامتداد
            const title = (incoming.length === 1 && baseTitle) ? baseTitle : originalName.replace(ALLOWED_EXT, "").slice(0, 300) || originalName;
            const [row] = await db.insert(auditFiles).values({
              periodId, requirementId, category, title,
              fileName: originalName,
              storagePath: uploadedFile.path,
              fileSize: f.size,
              mimeType: f.mimetype,
              uploadedByName: req.auditCtx.name,
            }).returning();
            uploadedRows.push(row);
          }

          if (!uploadedRows.length) {
            return res.status(400).json({ error: failed.map((x) => `${x.fileName}: ${x.error}`).join(" • ") || "فشل رفع الملفات" });
          }
          // ربط بمتطلب → حالته تصبح «مرفوع»
          if (requirementId) {
            await db.update(auditRequirements)
              .set({ status: "uploaded", updatedAt: new Date() })
              .where(and(eq(auditRequirements.id, requirementId), inArray(auditRequirements.status, ["requested", "in_progress", "ready", "waiting_sample", "rejected"])));
          }
          await logActivity(periodId, req.auditCtx, "upload", uploadedRows.length === 1
            ? `${uploadedRows[0].title} (${uploadedRows[0].fileName})`
            : `رفع ${uploadedRows.length} ملفات دفعة واحدة`);
          res.json({ uploaded: uploadedRows, failed, ok: true });
        } catch (e: any) { res.status(500).json({ error: e.message }); }
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== تحميل ملف (الفريق + المراجع) مع تسجيل التحميل =====
  app.get("/api/audit/files/:id/download", isAuthenticated, requireTeamOrAuditor, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [f] = await db.select().from(auditFiles).where(eq(auditFiles.id, id));
      if (!f) return res.status(404).json({ error: "الملف غير موجود" });
      const data = await downloadFromSupabase(f.storagePath);
      if (!data) return res.status(404).json({ error: "تعذر جلب الملف من التخزين" });
      await logActivity(f.periodId, req.auditCtx, "download", f.title);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Type", f.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(f.fileName)}`);
      res.send(Buffer.from(await data.arrayBuffer()));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== معاينة ملف داخل المتصفح (PDF وصور فقط — inline بدون تنزيل) =====
  const PREVIEWABLE_MIME = new Set([
    "application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif",
  ]);
  app.get("/api/audit/files/:id/preview", isAuthenticated, requireTeamOrAuditor, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [f] = await db.select().from(auditFiles).where(eq(auditFiles.id, id));
      if (!f) return res.status(404).json({ error: "الملف غير موجود" });
      const mime = f.mimeType || "application/octet-stream";
      if (!PREVIEWABLE_MIME.has(mime)) return res.status(415).json({ error: "هذا النوع لا يدعم المعاينة — حمّل الملف لعرضه" });
      const data = await downloadFromSupabase(f.storagePath);
      if (!data) return res.status(404).json({ error: "تعذر جلب الملف من التخزين" });
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(f.fileName)}`);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(Buffer.from(await data.arrayBuffer()));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/audit/files/:id", isAuthenticated, requireTeam, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [f] = await db.select().from(auditFiles).where(eq(auditFiles.id, id));
      if (!f) return res.status(404).json({ error: "الملف غير موجود" });
      const [fPeriod] = await db.select().from(auditPeriods).where(eq(auditPeriods.id, f.periodId));
      if (fPeriod?.status === "closed") return res.status(400).json({ error: "الفترة مغلقة — لا يمكن حذف ملفاتها" });
      if (f.requirementId) {
        const [fr] = await db.select({ status: auditRequirements.status }).from(auditRequirements).where(eq(auditRequirements.id, f.requirementId));
        if (fr?.status === "approved") return res.status(400).json({ error: "الملف مرتبط ببند معتمد من المراجع — لا يمكن حذفه" });
      }
      try { await deleteFromSupabase(f.storagePath); } catch {}
      await db.delete(auditFiles).where(eq(auditFiles.id, id));
      await logActivity(f.periodId, req.auditCtx, "delete_file", f.title);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== المتطلبات =====
  app.post("/api/audit/periods/:id/requirements", isAuthenticated, requireTeamOrAuditor, async (req: any, res) => {
    try {
      const periodId = parseInt(req.params.id);
      const [period] = await db.select().from(auditPeriods).where(eq(auditPeriods.id, periodId));
      if (!period) return res.status(404).json({ error: "الفترة غير موجودة" });
      if (period.status === "closed") return res.status(400).json({ error: "الفترة مغلقة" });
      const title = String(req.body.title || "").trim();
      if (title.length < 3 || title.length > 300) return res.status(400).json({ error: "عنوان المتطلب مطلوب" });
      const ctx: Ctx = req.auditCtx;
      const [row] = await db.insert(auditRequirements).values({
        periodId,
        title,
        description: req.body.description ? String(req.body.description).slice(0, 2000) : null,
        category: FILE_CATEGORIES.has(req.body.category) ? req.body.category : null,
        section: req.body.section ? String(req.body.section).slice(0, 150) : null,
        titleEn: req.body.titleEn ? String(req.body.titleEn).slice(0, 300) : null,
        assigneeName: req.body.assigneeName ? String(req.body.assigneeName).slice(0, 100) : null,
        source: ctx.isAuditor ? "auditor" : "internal",
        priority: ["high", "normal", "low"].includes(req.body.priority) ? req.body.priority : "normal",
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(req.body.dueDate || "") ? req.body.dueDate : null,
        createdByName: ctx.name,
      }).returning();
      await logActivity(periodId, ctx, "request", title);
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/audit/requirements/:id", isAuthenticated, requireTeamOrAuditor, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const ctx: Ctx = req.auditCtx;
      const [r] = await db.select().from(auditRequirements).where(eq(auditRequirements.id, id));
      if (!r) return res.status(404).json({ error: "المتطلب غير موجود" });
      const [period] = await db.select().from(auditPeriods).where(eq(auditPeriods.id, r.periodId));
      if (!period || period.status === "closed") return res.status(400).json({ error: "الفترة مغلقة — لا يمكن التعديل" });
      const patch: any = {};
      const status = req.body.status !== undefined ? String(req.body.status || "") : null;
      if (status !== null) {
        // مصفوفة الانتقالات: المراجع يعتمد/يرجع فقط ما هو «مرفوع»، والفريق لا يغيّر بنداً معتمداً
        const allowedByRole = ctx.isAuditor
          ? ["approved", "rejected"]
          : ["requested", "in_progress", "ready", "waiting_sample", "not_applicable"]; // «مرفوع» تتم فقط عبر رفع ملف فعلي
        if (!allowedByRole.includes(status)) return res.status(403).json({ error: "لا تملك تغيير الحالة إلى هذه القيمة" });
        if (ctx.isAuditor && r.status !== "uploaded") return res.status(400).json({ error: "لا يمكن اعتماد/إرجاع بند غير مرفوع" });
        if (!ctx.isAuditor && r.status === "approved") return res.status(400).json({ error: "البند معتمد من المراجع — لا يمكن تغيير حالته" });
        if (!ctx.isAuditor && r.status === "uploaded") return res.status(400).json({ error: "البند مرفوع وبانتظار المراجع — لا يمكن إرجاع حالته يدوياً" });
        patch.status = status;
      }
      // الفريق فقط يعدّل المسؤول عن التجهيز
      if (!ctx.isAuditor && req.body.assigneeName !== undefined) {
        patch.assigneeName = req.body.assigneeName ? String(req.body.assigneeName).slice(0, 100) : null;
      }
      if (!Object.keys(patch).length) return res.status(400).json({ error: "لا يوجد تعديل" });
      const [row] = await db.update(auditRequirements)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(auditRequirements.id, id)).returning();
      await logActivity(r.periodId, ctx, patch.status === "approved" ? "approve" : patch.status === "rejected" ? "reject" : "update_requirement", r.title);
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/audit/requirements/:id", isAuthenticated, requireTeam, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [rExisting] = await db.select().from(auditRequirements).where(eq(auditRequirements.id, id));
      if (!rExisting) return res.status(404).json({ error: "المتطلب غير موجود" });
      if (rExisting.status === "approved") return res.status(400).json({ error: "البند معتمد من المراجع — لا يمكن حذفه" });
      const [rPeriod] = await db.select().from(auditPeriods).where(eq(auditPeriods.id, rExisting.periodId));
      if (rPeriod?.status === "closed") return res.status(400).json({ error: "الفترة مغلقة — لا يمكن حذف متطلباتها" });
      const [r] = await db.delete(auditRequirements).where(eq(auditRequirements.id, id)).returning();
      if (!r) return res.status(404).json({ error: "المتطلب غير موجود" });
      await logActivity(r.periodId, req.auditCtx, "delete_requirement", r.title);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== التعليقات =====
  app.post("/api/audit/requirements/:id/comments", isAuthenticated, requireTeamOrAuditor, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [r] = await db.select().from(auditRequirements).where(eq(auditRequirements.id, id));
      if (!r) return res.status(404).json({ error: "المتطلب غير موجود" });
      const [cPeriod] = await db.select().from(auditPeriods).where(eq(auditPeriods.id, r.periodId));
      if (cPeriod?.status === "closed") return res.status(400).json({ error: "الفترة مغلقة — لا يمكن إضافة تعليقات" });
      const content = String(req.body.content || "").trim();
      if (!content || content.length > 2000) return res.status(400).json({ error: "نص التعليق مطلوب (بحد أقصى 2000 حرف)" });
      const ctx: Ctx = req.auditCtx;
      const [row] = await db.insert(auditComments).values({
        requirementId: id, authorName: ctx.name, isAuditor: ctx.isAuditor, content,
      }).returning();
      await logActivity(r.periodId, ctx, "comment", r.title);
      res.json(row);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== سجل النشاط (الفريق فقط) =====
  app.get("/api/audit/periods/:id/activity", isAuthenticated, requireTeam, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const rows = await db.select().from(auditActivityLog)
        .where(eq(auditActivityLog.periodId, id))
        .orderBy(desc(auditActivityLog.id)).limit(200);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== حسابات مكتب المراجعة (admin فقط) =====
  const requireAdminOnly: RequestHandler = async (req: any, res, next) => {
    const ctx = await getCtx(req);
    if (!ctx || ctx.role !== "admin") return res.status(403).json({ error: "إدارة حسابات المراجعين متاحة للمدير العام فقط" });
    req.auditCtx = ctx;
    next();
  };

  app.get("/api/audit/auditor-accounts", isAuthenticated, requireAdminOnly, async (_req, res) => {
    try {
      const rows = await db.select({ id: users.id, username: users.username, name: users.firstName, isActive: users.isActive, createdAt: users.createdAt })
        .from(users).where(eq(users.role, "external_auditor")).orderBy(desc(users.createdAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/audit/auditor-accounts", isAuthenticated, requireAdminOnly, async (req: any, res) => {
    try {
      const username = String(req.body.username || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const name = String(req.body.name || "").trim();
      if (!/^[a-z0-9_.-]{4,50}$/.test(username)) return res.status(400).json({ error: "اسم المستخدم: 4-50 حرفاً إنجليزياً/أرقام فقط" });
      if (password.length < 8) return res.status(400).json({ error: "كلمة المرور 8 أحرف على الأقل" });
      if (name.length < 3) return res.status(400).json({ error: "اسم مكتب المراجعة مطلوب" });
      const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (exists) return res.status(400).json({ error: "اسم المستخدم مستخدم مسبقاً" });
      const user = await storage.createUser({
        username, password, firstName: name,
        role: "external_auditor",
        isActive: "active",
      } as any);
      await logActivity(null, req.auditCtx, "create_auditor_account", username);
      res.json({ id: user.id, username: user.username, name: user.firstName });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/audit/auditor-accounts/:id", isAuthenticated, requireAdminOnly, async (req: any, res) => {
    try {
      const id = req.params.id;
      const [u] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, id)).limit(1);
      if (!u || u.role !== "external_auditor") return res.status(404).json({ error: "حساب المراجع غير موجود" });
      const patch: any = {};
      if (req.body.isActive === "active" || req.body.isActive === "inactive") patch.isActive = req.body.isActive;
      if (req.body.password) {
        if (String(req.body.password).length < 8) return res.status(400).json({ error: "كلمة المرور 8 أحرف على الأقل" });
        patch.password = String(req.body.password);
      }
      if (!Object.keys(patch).length) return res.status(400).json({ error: "لا يوجد تعديل" });
      await storage.updateUser(id, patch);
      await logActivity(null, req.auditCtx, "update_auditor_account", id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
