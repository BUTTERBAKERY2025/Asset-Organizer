// فريق التصوير والميديا — نقاط نهاية بنك الصور والهوية البصرية
import type { Express } from "express";
import { db } from "./db";
import { mediaAssets, brandColors, brandFonts, insertBrandColorSchema, insertBrandFontSchema } from "@shared/schema";
import { eq, and, desc, sql, inArray, ilike, or } from "drizzle-orm";
import { isAuthenticated, requirePermission } from "./auth";
import { z } from "zod";

const PM = "marketing" as const;

const ALLOWED_CATEGORIES = ["identity", "photos", "products", "templates", "archive"] as const;

function detectFileType(mime: string): string {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (
    mime === "application/pdf" ||
    mime.includes("photoshop") || mime.includes("illustrator") ||
    mime.includes("postscript") || mime.endsWith("indesign") ||
    mime === "application/octet-stream" // قد يكون psd/ai
  ) return "design";
  if (mime.startsWith("text/") || mime.includes("document") || mime.includes("sheet") || mime.includes("presentation")) return "document";
  return "other";
}

export function registerMediaTeamRoutes(app: Express) {
  // ===== الأصول (media_assets) =====

  // قائمة الأصول مع فلترة وبحث
  app.get("/api/media/assets", isAuthenticated, requirePermission(PM, "view"), async (req, res) => {
    try {
      const { category, q, fileType, platform, branchId, campaignId, limit = "200" } = req.query as any;
      const conditions: any[] = [];
      if (category && ALLOWED_CATEGORIES.includes(category)) conditions.push(eq(mediaAssets.category, category));
      if (fileType) conditions.push(eq(mediaAssets.fileType, String(fileType)));
      if (platform) conditions.push(eq(mediaAssets.platform, String(platform)));
      if (branchId) conditions.push(eq(mediaAssets.branchId, Number(branchId)));
      if (campaignId) conditions.push(eq(mediaAssets.campaignId, Number(campaignId)));
      if (q && String(q).trim()) {
        const term = `%${String(q).trim()}%`;
        conditions.push(or(
          ilike(mediaAssets.title, term),
          ilike(mediaAssets.description, term),
          ilike(mediaAssets.designer, term),
          sql`${mediaAssets.tags}::text ILIKE ${term}`,
        ));
      }
      const rows = await db.select().from(mediaAssets)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(mediaAssets.createdAt))
        .limit(Math.min(Number(limit) || 200, 500));
      res.json(rows);
    } catch (e: any) {
      console.error("[media] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // إحصائيات
  app.get("/api/media/stats", isAuthenticated, requirePermission(PM, "view"), async (_req, res) => {
    try {
      const rows = await db.execute<any>(sql`
        SELECT category, COUNT(*)::int AS count, COALESCE(SUM(file_size),0)::bigint AS total_size
        FROM media_assets GROUP BY category
      `).then((r: any) => r.rows ?? r);
      res.json(rows);
    } catch (e: any) {
      console.error("[media] stats error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // رفع أصل جديد (يدعم صور وفيديو وملفات تصميم حتى 200MB)
  app.post("/api/media/assets/upload", isAuthenticated, requirePermission(PM, "create"), async (req, res) => {
    try {
      const multer = (await import("multer")).default;
      const path = await import("path");
      const { uploadToSupabase, isSupabaseAvailable } = await import("./supabase-storage");
      if (!isSupabaseAvailable()) return res.status(503).json({ error: "خدمة التخزين (Supabase) غير متاحة. تحقق من SUPABASE_URL و SUPABASE_ANON_KEY." });

      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
      });

      upload.single("file")(req, res, async (err: any) => {
        if (err) {
          if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ error: "حجم الملف يتجاوز 200MB" });
          return res.status(400).json({ error: err.message || "فشل الرفع" });
        }
        const file = (req as any).file;
        if (!file) return res.status(400).json({ error: "لم يتم تحديد ملف" });

        const body = req.body || {};
        const category = String(body.category || "photos");
        if (!ALLOWED_CATEGORIES.includes(category as any)) return res.status(400).json({ error: "الفئة غير صحيحة" });

        try {
          // server-side whitelist بحسب الفئة
          const allowedByCategory: Record<string, RegExp[]> = {
            identity: [/^image\//, /^application\/pdf$/],
            photos: [/^image\//],
            products: [/^image\//, /^video\//],
            templates: [/^image\//, /^application\/pdf$/, /^application\/postscript$/, /^application\/illustrator$/, /^image\/vnd\.adobe\.photoshop$/, /^application\/octet-stream$/],
            archive: [/^image\//, /^video\//, /^application\/pdf$/],
          };
          const policies = allowedByCategory[category] || [/^image\//];
          if (!policies.some(re => re.test(file.mimetype))) {
            return res.status(400).json({ error: `نوع الملف "${file.mimetype}" غير مسموح لهذه الفئة` });
          }
          // منع الملفات الخطرة (HTML/SVG قد تحتوي سكربتات، ملفات تنفيذية)
          const FORBIDDEN_MIME = /^text\/html$|^image\/svg|^application\/(x-msdownload|x-sh|x-executable|javascript|x-shockwave-flash)/;
          if (FORBIDDEN_MIME.test(file.mimetype)) {
            return res.status(400).json({ error: "نوع الملف غير مدعوم لأسباب أمنية" });
          }

          const ext = (path.extname(file.originalname) || ".bin").toLowerCase().replace(".", "");
          const uniq = Date.now() + "-" + Math.round(Math.random() * 1e9);
          // ملاحظة: uploadToSupabase يولّد اسماً فريداً ويُعيده عبر storedPath — نستخدمه دائماً للقراءة لاحقاً
          const result = await uploadToSupabase(file.buffer, `media-${category}-${uniq}.${ext}`, file.mimetype);
          if (!result) throw new Error("upload failed");

          const tags = body.tags
            ? String(body.tags).split(",").map((t: string) => t.trim()).filter(Boolean)
            : [];
          const user: any = (req as any).user;

          const [created] = await db.insert(mediaAssets).values({
            category,
            title: String(body.title || file.originalname).slice(0, 200),
            description: body.description ? String(body.description).slice(0, 1000) : null,
            fileType: detectFileType(file.mimetype),
            mimeType: file.mimetype,
            fileName: file.originalname,
            storagePath: result.storedPath,
            fileSize: file.size,
            thumbnailPath: null,
            tags,
            branchId: body.branchId ? Number(body.branchId) : null,
            campaignId: body.campaignId ? Number(body.campaignId) : null,
            platform: body.platform || null,
            publishDate: body.publishDate || null,
            designer: body.designer || null,
            uploadedBy: user?.id ?? null,
          }).returning();
          res.status(201).json(created);
        } catch (uErr: any) {
          console.error("[media] upload error:", uErr);
          res.status(500).json({ error: "فشل رفع الملف: " + uErr.message });
        }
      });
    } catch (e: any) {
      console.error("[media] upload outer:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تعديل بيانات أصل
  app.patch("/api/media/assets/:id", isAuthenticated, requirePermission(PM, "edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "معرّف غير صالح" });
      const allowed = ["title", "description", "tags", "branchId", "campaignId", "platform", "publishDate", "designer", "category"];
      const patch: any = {};
      for (const k of allowed) {
        if (req.body[k] !== undefined) {
          if (k === "tags" && typeof req.body[k] === "string") {
            patch[k] = req.body[k].split(",").map((t: string) => t.trim()).filter(Boolean);
          } else patch[k] = req.body[k];
        }
      }
      const [updated] = await db.update(mediaAssets).set(patch).where(eq(mediaAssets.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "غير موجود" });
      res.json(updated);
    } catch (e: any) {
      console.error("[media] update error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // حذف أصل (من DB والتخزين)
  app.delete("/api/media/assets/:id", isAuthenticated, requirePermission(PM, "delete"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
      if (!row) return res.status(404).json({ error: "غير موجود" });
      try {
        const { deleteFromSupabase } = await import("./supabase-storage");
        await deleteFromSupabase(row.storagePath);
      } catch (e) {
        console.warn("[media] storage delete failed (ignored):", e);
      }
      await db.delete(mediaAssets).where(eq(mediaAssets.id, id));
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[media] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تنزيل أصل (يعيد توجيه إلى رابط التخزين)
  app.get("/api/media/assets/:id/download", isAuthenticated, requirePermission(PM, "view"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
      if (!row) return res.status(404).json({ error: "غير موجود" });
      const { downloadFromSupabase } = await import("./supabase-storage");
      const file = await downloadFromSupabase(row.storagePath);
      if (!file) return res.status(404).json({ error: "الملف غير موجود في التخزين" });
      const buffer = Buffer.from(await file.data.arrayBuffer());
      res.setHeader("Content-Type", row.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName)}`);
      res.send(buffer);
    } catch (e: any) {
      console.error("[media] download error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // عرض/معاينة (inline)
  app.get("/api/media/assets/:id/view", isAuthenticated, requirePermission(PM, "view"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
      if (!row) return res.status(404).json({ error: "غير موجود" });
      const { downloadFromSupabase } = await import("./supabase-storage");
      const file = await downloadFromSupabase(row.storagePath);
      if (!file) return res.status(404).json({ error: "الملف غير موجود" });
      const buffer = Buffer.from(await file.data.arrayBuffer());
      res.setHeader("Content-Type", row.mimeType);
      // منع تنفيذ المحتوى كصفحة في المتصفح
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(buffer);
    } catch (e: any) {
      console.error("[media] view error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ===== ألوان الهوية =====
  app.get("/api/media/brand/colors", isAuthenticated, requirePermission(PM, "view"), async (_req, res) => {
    try {
      const rows = await db.select().from(brandColors).orderBy(brandColors.sortOrder, brandColors.id);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/media/brand/colors", isAuthenticated, requirePermission(PM, "create"), async (req, res) => {
    try {
      const body = insertBrandColorSchema.parse(req.body);
      const [r] = await db.insert(brandColors).values(body).returning();
      res.status(201).json(r);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });
  app.patch("/api/media/brand/colors/:id", isAuthenticated, requirePermission(PM, "edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = insertBrandColorSchema.partial().parse(req.body);
      const [r] = await db.update(brandColors).set(body).where(eq(brandColors.id, id)).returning();
      if (!r) return res.status(404).json({ error: "غير موجود" });
      res.json(r);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });
  app.delete("/api/media/brand/colors/:id", isAuthenticated, requirePermission(PM, "delete"), async (req, res) => {
    try {
      await db.delete(brandColors).where(eq(brandColors.id, Number(req.params.id)));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== خطوط الهوية =====
  app.get("/api/media/brand/fonts", isAuthenticated, requirePermission(PM, "view"), async (_req, res) => {
    try {
      const rows = await db.select().from(brandFonts).orderBy(brandFonts.sortOrder, brandFonts.id);
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/media/brand/fonts", isAuthenticated, requirePermission(PM, "create"), async (req, res) => {
    try {
      const body = insertBrandFontSchema.parse(req.body);
      const [r] = await db.insert(brandFonts).values(body).returning();
      res.status(201).json(r);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });
  app.patch("/api/media/brand/fonts/:id", isAuthenticated, requirePermission(PM, "edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = insertBrandFontSchema.partial().parse(req.body);
      const [r] = await db.update(brandFonts).set(body).where(eq(brandFonts.id, id)).returning();
      if (!r) return res.status(404).json({ error: "غير موجود" });
      res.json(r);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      res.status(500).json({ error: e.message });
    }
  });
  app.delete("/api/media/brand/fonts/:id", isAuthenticated, requirePermission(PM, "delete"), async (req, res) => {
    try {
      await db.delete(brandFonts).where(eq(brandFonts.id, Number(req.params.id)));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  console.log("[media-team] routes registered");
}
