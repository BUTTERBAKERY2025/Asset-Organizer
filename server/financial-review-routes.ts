import type { Express } from "express";
import { db } from "./db";
import { eq, and, desc, asc, sql, inArray, gt, gte } from "drizzle-orm";
import { isAuthenticated, requirePermission } from "./auth";
import {
  financialReviewCycles,
  financialDocuments,
  financialDocSigners,
} from "@shared/schema";
import crypto from "crypto";
import { z } from "zod";
import { uploadToSupabase, downloadFromSupabase, deleteFromSupabase } from "./supabase-storage";

// Simple per-IP rate limit for the public signing endpoints
const rlMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const rec = rlMap.get(ip);
  if (!rec || now > rec.resetAt) {
    rlMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  rec.count++;
  return rec.count <= 15;
}

const TOKEN_RE = /^[a-f0-9]{64}$/;

export function registerFinancialReviewRoutes(app: Express) {
  // ===== Cycles =====
  app.get("/api/governance/financial-cycles", isAuthenticated, requirePermission("governance_compliance", "view"), async (_req, res) => {
    try {
      const cycles = await db.select().from(financialReviewCycles).orderBy(desc(financialReviewCycles.id));
      const counts = await db.select({
        cycleId: financialDocuments.cycleId,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) FILTER (WHERE ${financialDocuments.status} = 'completed')::int`,
      }).from(financialDocuments).groupBy(financialDocuments.cycleId);
      const byId = new Map(counts.map(c => [c.cycleId, c]));
      res.json(cycles.map(c => ({ ...c, docsTotal: byId.get(c.id)?.total || 0, docsCompleted: byId.get(c.id)?.completed || 0 })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/governance/financial-cycles", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req: any, res) => {
    try {
      const schema = z.object({
        title: z.string().min(3).max(300),
        periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        notes: z.string().max(2000).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات الدورة غير صالحة" });
      if (parsed.data.periodEnd < parsed.data.periodStart) return res.status(400).json({ error: "نهاية الفترة قبل بدايتها" });
      const [cycle] = await db.insert(financialReviewCycles).values({
        ...parsed.data,
        createdBy: req.user?.username || req.user?.id || null,
      }).returning();
      res.json(cycle);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.patch("/api/governance/financial-cycles/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const schema = z.object({
        title: z.string().min(3).max(300).optional(),
        status: z.enum(["active", "closed"]).optional(),
        notes: z.string().max(2000).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات غير صالحة" });
      const [updated] = await db.update(financialReviewCycles)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(financialReviewCycles.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "الدورة غير موجودة" });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/governance/financial-cycles/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const docs = await db.select().from(financialDocuments).where(eq(financialDocuments.cycleId, id));
      for (const d of docs) {
        try { await deleteFromSupabase(d.storagePath); } catch {}
      }
      const [deleted] = await db.delete(financialReviewCycles).where(eq(financialReviewCycles.id, id)).returning();
      if (!deleted) return res.status(404).json({ error: "الدورة غير موجودة" });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== Documents =====
  app.get("/api/governance/financial-cycles/:id/documents", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const cycleId = parseInt(req.params.id);
      const docs = await db.select().from(financialDocuments)
        .where(eq(financialDocuments.cycleId, cycleId))
        .orderBy(desc(financialDocuments.id));
      const docIds = docs.map(d => d.id);
      let signers: any[] = [];
      if (docIds.length) {
        signers = await db.select().from(financialDocSigners)
          .where(inArray(financialDocSigners.documentId, docIds))
          .orderBy(asc(financialDocSigners.signOrder));
      }
      res.json(docs.map(d => ({ ...d, signers: signers.filter(s => s.documentId === d.id) })));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/governance/financial-cycles/:id/documents", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req: any, res) => {
    try {
      const cycleId = parseInt(req.params.id);
      const [cycle] = await db.select().from(financialReviewCycles).where(eq(financialReviewCycles.id, cycleId));
      if (!cycle) return res.status(404).json({ error: "الدورة غير موجودة" });
      if (cycle.status === "closed") return res.status(400).json({ error: "الدورة مغلقة — لا يمكن إضافة مستندات" });

      const multer = (await import("multer")).default;
      const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 25 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          if (file.mimetype === "application/pdf") cb(null, true);
          else cb(new Error("يُقبل ملف PDF فقط"));
        },
      }).single("file");

      upload(req, res, async (err: any) => {
        if (err) return res.status(400).json({ error: err.message || "فشل رفع الملف" });
        try {
          if (!req.file) return res.status(400).json({ error: "لم يتم إرفاق ملف PDF" });
          // Basic PDF magic-bytes check
          if (!req.file.buffer.subarray(0, 5).toString("latin1").startsWith("%PDF-")) {
            return res.status(400).json({ error: "الملف ليس PDF صالحاً" });
          }
          const title = String(req.body.title || "").trim();
          if (title.length < 2 || title.length > 300) return res.status(400).json({ error: "عنوان المستند مطلوب" });
          const category = req.body.category ? String(req.body.category).slice(0, 100) : null;

          let signersInput: Array<{ name: string; position: string }> = [];
          try { signersInput = JSON.parse(req.body.signers || "[]"); } catch {}
          if (!Array.isArray(signersInput) || signersInput.length === 0) {
            return res.status(400).json({ error: "حدد موقّعاً واحداً على الأقل" });
          }
          if (signersInput.length > 10) return res.status(400).json({ error: "عدد الموقّعين كبير جداً" });
          for (const s of signersInput) {
            if (!s?.name || String(s.name).trim().length < 2 || !s?.position) {
              return res.status(400).json({ error: "بيانات الموقّعين غير مكتملة" });
            }
          }

          // multer يفك اسم الملف بترميز latin1 — نعيد فك أسماء الملفات العربية إلى UTF-8
          let originalName = req.file.originalname || "document.pdf";
          try {
            const decoded = Buffer.from(originalName, "latin1").toString("utf8");
            if (!decoded.includes("\uFFFD")) originalName = decoded;
          } catch {}

          // مفتاح التخزين في Supabase يجب أن يكون ASCII فقط (الحروف العربية مرفوضة
          // في أسماء الكائنات) — الاسم العربي الجميل يبقى في قاعدة البيانات للعرض
          const storageName = `financial_doc_${Date.now()}.pdf`;
          const uploaded = await uploadToSupabase(req.file.buffer, storageName, "application/pdf");
          if (!uploaded) return res.status(500).json({ error: "فشل رفع الملف إلى التخزين" });

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 14);

          const [doc] = await db.insert(financialDocuments).values({
            cycleId,
            title,
            category,
            fileName: originalName,
            storagePath: uploaded.path,
            fileSize: req.file.size,
            uploadedBy: req.user?.username || req.user?.id || null,
          }).returning();

          const signerRows = [];
          for (let i = 0; i < signersInput.length; i++) {
            const [row] = await db.insert(financialDocSigners).values({
              documentId: doc.id,
              signerName: String(signersInput[i].name).trim().slice(0, 150),
              signerPosition: String(signersInput[i].position).trim().slice(0, 100),
              signOrder: i + 1,
              signToken: crypto.randomBytes(32).toString("hex"),
              expiresAt,
            }).returning();
            signerRows.push(row);
          }

          res.json({ ...doc, signers: signerRows });
        } catch (e: any) {
          console.error("financial doc upload error:", e);
          res.status(500).json({ error: "فشل حفظ المستند" });
        }
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.delete("/api/governance/financial-documents/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [doc] = await db.select().from(financialDocuments).where(eq(financialDocuments.id, id));
      if (!doc) return res.status(404).json({ error: "المستند غير موجود" });
      try { await deleteFromSupabase(doc.storagePath); } catch {}
      await db.delete(financialDocuments).where(eq(financialDocuments.id, id));
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: stream the original PDF
  app.get("/api/governance/financial-documents/:id/file", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [doc] = await db.select().from(financialDocuments).where(eq(financialDocuments.id, id));
      if (!doc) return res.status(404).json({ error: "المستند غير موجود" });
      const file = await downloadFromSupabase(doc.storagePath);
      if (!file) return res.status(404).json({ error: "تعذر جلب الملف من التخزين" });
      const buf = Buffer.from(await file.data.arrayBuffer());
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
      res.send(buf);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Admin: regenerate/reopen a signer link (e.g. lost/blank signature)
  app.post("/api/governance/financial-documents/:id/signers/:signerId/reopen", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const signerId = parseInt(req.params.signerId);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      // SEQUENCE INTEGRITY: reopening a signer must also reset every LATER signer,
      // otherwise downstream approvals made before this re-approval would survive
      // and the document could flip back to "completed" with an invalid sequence.
      const updated = await db.transaction(async (tx) => {
        const [target] = await tx.select().from(financialDocSigners)
          .where(and(eq(financialDocSigners.id, signerId), eq(financialDocSigners.documentId, documentId)))
          .for("update");
        if (!target) return null;

        const downstream = await tx.select().from(financialDocSigners)
          .where(and(eq(financialDocSigners.documentId, documentId), gt(financialDocSigners.signOrder, target.signOrder)));
        for (const d of downstream) {
          await tx.update(financialDocSigners)
            .set({ signToken: crypto.randomBytes(32).toString("hex"), status: "pending", signatureData: null, signedAt: null, declineReason: null, expiresAt, updatedAt: new Date() })
            .where(eq(financialDocSigners.id, d.id));
        }

        const [row] = await tx.update(financialDocSigners)
          .set({ signToken: crypto.randomBytes(32).toString("hex"), status: "pending", signatureData: null, signedAt: null, declineReason: null, expiresAt, updatedAt: new Date() })
          .where(eq(financialDocSigners.id, target.id))
          .returning();

        await tx.update(financialDocuments).set({ status: "pending_signatures", updatedAt: new Date() }).where(eq(financialDocuments.id, documentId));
        return row;
      });
      if (!updated) return res.status(404).json({ error: "الموقّع غير موجود" });
      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ===== Public signing (sequential) =====
  async function loadByToken(token: string) {
    if (!TOKEN_RE.test(token)) return null;
    const [signer] = await db.select().from(financialDocSigners).where(eq(financialDocSigners.signToken, token));
    if (!signer) return null;
    const [doc] = await db.select().from(financialDocuments).where(eq(financialDocuments.id, signer.documentId));
    if (!doc) return null;
    const [cycle] = await db.select().from(financialReviewCycles).where(eq(financialReviewCycles.id, doc.cycleId));
    const all = await db.select().from(financialDocSigners)
      .where(eq(financialDocSigners.documentId, doc.id))
      .orderBy(asc(financialDocSigners.signOrder));
    return { signer, doc, cycle, all };
  }

  function turnState(signer: any, all: any[]) {
    // Sequential: it's my turn if every signer with a lower order has signed
    const blockers = all.filter(s => s.signOrder < signer.signOrder && s.status !== "signed");
    return { isMyTurn: blockers.length === 0, waitingFor: blockers.map(b => ({ name: b.signerName, position: b.signerPosition })) };
  }

  app.get("/api/public/fin-sign/:token", async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    try {
      const ip = req.ip || "unknown";
      if (!checkRateLimit(ip)) return res.status(429).json({ error: "تم تجاوز الحد الأقصى للطلبات" });
      const data = await loadByToken(req.params.token);
      if (!data) return res.status(404).json({ error: "رابط التوقيع غير موجود" });
      const { signer, doc, cycle, all } = data;
      if (signer.expiresAt && new Date(signer.expiresAt) < new Date()) return res.status(410).json({ error: "انتهت صلاحية رابط التوقيع" });
      const turn = turnState(signer, all);
      res.json({
        signerName: signer.signerName,
        signerPosition: signer.signerPosition,
        status: signer.status,
        signedAt: signer.signedAt,
        documentTitle: doc.title,
        documentCategory: doc.category,
        fileName: doc.fileName,
        cycleTitle: cycle?.title,
        periodStart: cycle?.periodStart,
        periodEnd: cycle?.periodEnd,
        isMyTurn: turn.isMyTurn,
        waitingFor: turn.waitingFor,
        signers: all.map(s => ({ name: s.signerName, position: s.signerPosition, status: s.status, signOrder: s.signOrder })),
      });
    } catch (e: any) { res.status(500).json({ error: "فشل في جلب البيانات" }); }
  });

  app.get("/api/public/fin-sign/:token/file", async (req, res) => {
    try {
      const ip = req.ip || "unknown";
      if (!checkRateLimit(ip)) return res.status(429).json({ error: "تم تجاوز الحد الأقصى للطلبات" });
      const data = await loadByToken(req.params.token);
      if (!data) return res.status(404).json({ error: "رابط غير موجود" });
      // Expired pending links must not keep exposing the financial PDF
      if (data.signer.status === "pending" && data.signer.expiresAt && new Date(data.signer.expiresAt) < new Date()) {
        return res.status(410).json({ error: "انتهت صلاحية الرابط" });
      }
      const file = await downloadFromSupabase(data.doc.storagePath);
      if (!file) return res.status(404).json({ error: "تعذر جلب الملف" });
      const buf = Buffer.from(await file.data.arrayBuffer());
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(data.doc.fileName)}`);
      res.send(buf);
    } catch (e: any) { res.status(500).json({ error: "فشل في جلب الملف" }); }
  });

  app.post("/api/public/fin-sign/:token", async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    try {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(ip)) return res.status(429).json({ error: "تم تجاوز الحد الأقصى للطلبات" });
      const token = req.params.token;
      if (!TOKEN_RE.test(token)) return res.status(400).json({ error: "رابط غير صالح" });

      const schema = z.object({ signatureData: z.string().max(500 * 1024) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "بيانات التوقيع غير صالحة" });
      const { signatureData } = parsed.data;
      if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(signatureData)) {
        return res.status(400).json({ error: "صيغة التوقيع غير صالحة" });
      }

      const result = await db.transaction(async (tx) => {
        const [signer] = await tx.select().from(financialDocSigners)
          .where(eq(financialDocSigners.signToken, token)).for("update");
        if (!signer) return { code: 404, error: "رابط التوقيع غير موجود" };
        if (signer.status === "signed") return { code: 400, error: "تم التوقيع مسبقاً" };
        if (signer.expiresAt && new Date(signer.expiresAt) < new Date()) return { code: 410, error: "انتهت صلاحية الرابط" };

        const all = await tx.select().from(financialDocSigners)
          .where(eq(financialDocSigners.documentId, signer.documentId))
          .orderBy(asc(financialDocSigners.signOrder));
        const blockers = all.filter(s => s.signOrder < signer.signOrder && s.status !== "signed");
        if (blockers.length > 0) {
          return { code: 409, error: "لم يحن دورك بعد — بانتظار توقيع: " + blockers.map(b => b.signerName).join("، ") };
        }

        await tx.update(financialDocSigners).set({
          status: "signed",
          signatureData,
          signedAt: new Date(),
          ipAddress: ip,
          userAgent: req.get("User-Agent") || null,
          updatedAt: new Date(),
        }).where(eq(financialDocSigners.id, signer.id));

        const remaining = all.filter(s => s.id !== signer.id && s.status !== "signed").length;
        if (remaining === 0) {
          await tx.update(financialDocuments).set({ status: "completed", updatedAt: new Date() })
            .where(eq(financialDocuments.id, signer.documentId));
        }
        return { code: 200, completed: remaining === 0 };
      });

      if (result.code !== 200) return res.status(result.code).json({ error: result.error });
      res.json({ success: true, completed: (result as any).completed });
    } catch (e: any) {
      console.error("fin-sign error:", e);
      res.status(500).json({ error: "فشل في حفظ التوقيع" });
    }
  });

  app.post("/api/public/fin-sign/:token/decline", async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    try {
      const ip = req.ip || "unknown";
      if (!checkRateLimit(ip)) return res.status(429).json({ error: "تم تجاوز الحد الأقصى للطلبات" });
      const token = req.params.token;
      if (!TOKEN_RE.test(token)) return res.status(400).json({ error: "رابط غير صالح" });
      const reason = typeof req.body?.reason === "string" ? req.body.reason.slice(0, 1000) : null;
      const result = await db.transaction(async (tx) => {
        const [signer] = await tx.select().from(financialDocSigners)
          .where(eq(financialDocSigners.signToken, token)).for("update");
        if (!signer) return { code: 404, error: "رابط غير موجود" };
        if (signer.status !== "pending") return { code: 400, error: "تم التعامل مع هذا الرابط مسبقاً" };
        if (signer.expiresAt && new Date(signer.expiresAt) < new Date()) return { code: 410, error: "انتهت صلاحية الرابط" };
        // SEQUENCE: only the current-turn signer may decline
        const all = await tx.select().from(financialDocSigners)
          .where(eq(financialDocSigners.documentId, signer.documentId))
          .orderBy(asc(financialDocSigners.signOrder));
        const blockers = all.filter(s => s.signOrder < signer.signOrder && s.status !== "signed");
        if (blockers.length > 0) return { code: 409, error: "لم يحن دورك بعد" };
        await tx.update(financialDocSigners).set({ status: "declined", declineReason: reason, updatedAt: new Date() })
          .where(and(eq(financialDocSigners.id, signer.id), eq(financialDocSigners.status, "pending")));
        await tx.update(financialDocuments).set({ status: "declined", updatedAt: new Date() })
          .where(eq(financialDocuments.id, signer.documentId));
        return { code: 200 };
      });
      if (result.code !== 200) return res.status(result.code).json({ error: result.error });
      res.json({ success: true });
    } catch (e: any) { res.status(500).json({ error: "فشل في تسجيل الاعتذار" }); }
  });
}
