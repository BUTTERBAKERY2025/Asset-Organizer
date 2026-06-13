import type { Express } from "express";
import crypto from "node:crypto";
import { db } from "./db";
import { eq, and, desc, sql, inArray, gte, lte, lt } from "drizzle-orm";
import { isAuthenticated, requirePermission, getEffectiveBranchFilter, getCachedPermissionsForUser, hasCrossBranchHrReadAccess } from "./auth";
import {
  WARNING_TEMPLATES,
  WARNING_REASON_CATEGORIES,
  getWarningTemplate,
  getWarningReasonCategory,
  renderWarningBody,
  WARNING_LEGAL_NOTICE,
} from "@shared/warning-templates";
import {
  employeeDocuments,
  leaveRequests,
  leaveBalances,
  insertLeaveBalanceSchema,
  employeeWarnings,
  eosCalculations,
  salaryDeductions,
  branchEmployees,
  branches,
  users,
  jobOffers,
  employmentApplications,
  onboardingNotifications,
  attendanceRecords,
  financialPeriods,
  approvalWorkflows,
  approvalWorkflowSteps,
  insertEmployeeDocumentSchema,
  insertLeaveRequestSchema,
  insertEmployeeWarningSchema,
  insertEosCalculationSchema,
  insertSalaryDeductionSchema,
} from "@shared/schema";
import { z } from "zod";
import { notifyEmployeeOfDecision } from "./notify-helpers";
import { auditEvent } from "./audit-helpers";
import {
  computeLeaveDays,
  findOverlappingLeave,
  getLeaveBalanceSummary,
  suggestedEntitlement,
  syncAttendanceForLeave,
  reverseAttendanceForLeave,
  getApplicableLeaveChain,
  resolveReviewerJobTitle,
} from "./leave-helpers";

function getUserId(req: any): string | null {
  return (req as any).user?.id || (req as any).user?.claims?.sub || null;
}

function isAdmin(req: any): boolean {
  return (req as any).user?.role === "admin";
}

/**
 * HR is inherently a cross-branch function in this org. Users granted
 * `hr_management` permission are treated as cross-branch for HR routes
 * even when they have no explicit branch assignments — otherwise they
 * would see zero data on every HR page despite holding the permission.
 * Admin still bypasses everything via getEffectiveBranchFilter.
 */
// Delegates to the shared single-source-of-truth helper in ./auth to avoid drift.
function hasCrossBranchHrAccess(req: any): boolean {
  return hasCrossBranchHrReadAccess(req);
}

/**
 * Returns branch IDs the user can access, or null for all-access (admin
 * or cross-branch HR manager — READ-only elevation).
 *
 * IMPORTANT: elevation only applies to safe HTTP methods (GET/HEAD). Write
 * methods (POST/PATCH/PUT/DELETE) never elevate, so an HR manager without
 * explicit branch assignments cannot mutate records across branches —
 * `applyBranchScope` will return `sql\`false\`` and per-route
 * `branchIds.includes(...)` guards will fail closed for writes.
 */
function getBranchScope(req: any): { branchIds: string[] | null; hasAccess: boolean } {
  const f = getEffectiveBranchFilter(req);
  const isSafeMethod = req.method === "GET" || req.method === "HEAD";
  // Elevate cross-branch HR users (hr_manager role, or non-assigned hr_management
  // permission holders) to all-branches on reads — unconditionally, so even if an
  // hr_manager has a default branchId, they still see HR data org-wide.
  if (isSafeMethod && hasCrossBranchHrAccess(req)) {
    return { branchIds: null, hasAccess: true };
  }
  return { branchIds: f.branchIds, hasAccess: f.hasAccess };
}

function applyBranchScope<T extends { branchId: any }>(table: T, branchIds: string[] | null) {
  if (branchIds === null) return undefined;
  if (branchIds.length === 0) return sql`false`;
  return inArray((table as any).branchId, branchIds);
}

export function registerHrRoutes(app: Express) {
  // ========================================================================
  // 1) وثائق الموظفين  /api/hr/documents
  // ========================================================================
  app.get("/api/hr/documents", isAuthenticated, requirePermission("hr_documents"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : null;
      const docType = req.query.type as string | undefined;
      const status = req.query.status as string | undefined;

      const conds: any[] = [];
      const scopeCond = applyBranchScope(employeeDocuments, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (employeeId) conds.push(eq(employeeDocuments.branchEmployeeId, employeeId));
      if (docType) conds.push(eq(employeeDocuments.documentType, docType));
      if (status) conds.push(eq(employeeDocuments.status, status));

      const rows = await db
        .select({
          doc: employeeDocuments,
          employeeName: branchEmployees.employeeName,
          employeeJob: branchEmployees.jobTitle,
          branchName: branches.name,
        })
        .from(employeeDocuments)
        .leftJoin(branchEmployees, eq(employeeDocuments.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(employeeDocuments.branchId, branches.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(employeeDocuments.createdAt))
        .limit(1000);

      // Auto-update status based on expiry
      const today = new Date().toISOString().slice(0, 10);
      const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const enriched = rows.map((r) => {
        let computedStatus = r.doc.status;
        if (r.doc.expiryDate) {
          if (r.doc.expiryDate < today) computedStatus = "expired";
          else if (r.doc.expiryDate <= thirtyDaysOut) computedStatus = "expiring_soon";
        }
        return { ...r.doc, employeeName: r.employeeName, employeeJob: r.employeeJob, branchName: r.branchName, computedStatus };
      });

      res.json(enriched);
    } catch (e: any) {
      console.error("[hr/documents] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/documents", isAuthenticated, requirePermission("hr_documents"), async (req, res) => {
    try {
      const parsed = insertEmployeeDocumentSchema.parse(req.body);
      const { branchIds } = getBranchScope(req);
      // Validate employee belongs to accessible branch
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية لإدارة وثائق هذا الموظف" });
      }
      // SECURITY: branchId is server-authoritative — derived from the employee
      // record, never trusted from the client payload (prevents cross-branch injection).
      const { branchId: _ignoredBranchId, ...safeParsed } = parsed as any;
      const [created] = await db.insert(employeeDocuments).values({
        ...safeParsed,
        branchId: emp.branchId,
        createdBy: getUserId(req) || undefined,
      }).returning();
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/documents] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/hr/documents/:id", isAuthenticated, requirePermission("hr_documents"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, id));
      if (!existing) return res.status(404).json({ error: "الوثيقة غير موجودة" });
      if (branchIds !== null && (!existing.branchId || !branchIds.includes(existing.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      // SECURITY: strip branchId/branchEmployeeId from client payload — they
      // anchor the record's branch scope and must not be mutable via PATCH.
      const { branchId: _bId, branchEmployeeId: _eId, ...partial } =
        insertEmployeeDocumentSchema.partial().parse(req.body) as any;
      const [updated] = await db.update(employeeDocuments)
        .set({ ...partial, updatedAt: new Date() })
        .where(eq(employeeDocuments.id, id))
        .returning();
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/documents] update error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/documents/:id", isAuthenticated, requirePermission("hr_documents"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(employeeDocuments).where(eq(employeeDocuments.id, id));
      if (!existing) return res.status(404).json({ error: "الوثيقة غير موجودة" });
      if (branchIds !== null && (!existing.branchId || !branchIds.includes(existing.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      await db.delete(employeeDocuments).where(eq(employeeDocuments.id, id));
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/documents] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // إحصائيات الوثائق (للوحة HR)
  app.get("/api/hr/documents/stats", isAuthenticated, requirePermission("hr_documents"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const scopeCond = applyBranchScope(employeeDocuments, branchIds);
      const today = new Date().toISOString().slice(0, 10);
      const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const all = await db.select().from(employeeDocuments).where(scopeCond);
      const total = all.length;
      const expired = all.filter(d => d.expiryDate && d.expiryDate < today).length;
      const expiringSoon = all.filter(d => d.expiryDate && d.expiryDate >= today && d.expiryDate <= thirtyDaysOut).length;
      const byType: Record<string, number> = {};
      all.forEach(d => { byType[d.documentType] = (byType[d.documentType] || 0) + 1; });
      res.json({ total, expired, expiringSoon, byType });
    } catch (e: any) {
      console.error("[hr/documents/stats] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // 2) طلبات الإجازات  /api/hr/leaves
  // ========================================================================
  app.get("/api/hr/leaves", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : null;
      const status = req.query.status as string | undefined;
      const leaveType = req.query.type as string | undefined;
      const branchId = req.query.branchId as string | undefined;

      const conds: any[] = [];
      const scopeCond = applyBranchScope(leaveRequests, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (employeeId) conds.push(eq(leaveRequests.branchEmployeeId, employeeId));
      if (status) conds.push(eq(leaveRequests.status, status));
      if (leaveType) conds.push(eq(leaveRequests.leaveType, leaveType));
      if (branchId) conds.push(eq(leaveRequests.branchId, branchId));

      const rows = await db
        .select({
          leave: leaveRequests,
          employeeName: branchEmployees.employeeName,
          employeeJob: branchEmployees.jobTitle,
          branchName: branches.name,
          reviewerName: users.firstName,
        })
        .from(leaveRequests)
        .leftJoin(branchEmployees, eq(leaveRequests.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(leaveRequests.branchId, branches.id))
        .leftJoin(users, eq(leaveRequests.reviewedBy, users.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(leaveRequests.createdAt))
        .limit(1000);

      res.json(rows.map(r => ({
        ...r.leave,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
        reviewerName: r.reviewerName,
      })));
    } catch (e: any) {
      console.error("[hr/leaves] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/leaves", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const parsed = insertLeaveRequestSchema.parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      if (parsed.endDate < parsed.startDate) {
        return res.status(400).json({ error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" });
      }
      // منع التداخل مع إجازة أخرى (معلّقة أو معتمدة)
      const overlap = await findOverlappingLeave(parsed.branchEmployeeId, parsed.startDate, parsed.endDate);
      if (overlap) {
        return res.status(409).json({
          error: `يوجد طلب إجازة متداخل لنفس الموظف (${overlap.startDate} إلى ${overlap.endDate})`,
        });
      }
      // إعادة احتساب الأيام على الخادم (لا نثق بالعميل)
      const { totalDays, workingDays } = computeLeaveDays(parsed.startDate, parsed.endDate);
      // نظام الموافقات والاعتمادات: جلب سلسلة الفرع (أو الافتراضية). إن لم توجد سلسلة
      // نرجع للسلوك السابق (مستوى واحد أو ما يطلبه العميل، بحد أقصى 3).
      const chain = await getApplicableLeaveChain(emp.branchId);
      const requiredLevels = chain
        ? chain.length
        : Math.min(3, Math.max(1, Number((parsed as any).requiredLevels) || 1));
      const [created] = await db.insert(leaveRequests).values({
        ...parsed,
        totalDays,
        workingDays,
        status: "pending",
        currentLevel: 1,
        requiredLevels,
        approvalFlow: [],
        approvalChain: chain ?? null,
        cancelReason: null,
        cancelledBy: null,
        cancelledAt: null,
        branchId: emp.branchId,
        createdBy: getUserId(req) || undefined,
      }).returning();
      await auditEvent({
        req, module: "hr_leaves", entityId: created.id, action: "create",
        entityName: emp.employeeName, branchId: emp.branchId,
        description: `إنشاء طلب إجازة (${parsed.leaveType}) ${parsed.startDate}→${parsed.endDate}`,
        details: { totalDays, workingDays, leaveType: parsed.leaveType },
        targetId: emp.id,
      });
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leaves] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // الموافقة/الرفض
  app.post("/api/hr/leaves/:id/review", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const decision = z.object({
        decision: z.enum(["approved", "rejected"]),
        note: z.string().optional(),
        allowOverBalance: z.boolean().optional(), // تجاوز تحذير تخطّي الرصيد
      }).parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status !== "pending") {
        return res.status(400).json({ error: "تمت معالجة هذا الطلب مسبقاً" });
      }

      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      const userId = getUserId(req) || undefined;
      const user: any = (req as any).currentUser || (req as any).user || null;
      const approverName = user?.fullName || user?.firstName || user?.username || "—";
      const now = new Date();
      const year = parseInt(existing.startDate.slice(0, 4), 10);

      // نظام الموافقات والاعتمادات: التحقق من أن المعتمِد يطابق منصب المرحلة الحالية.
      // المدير العام (super_admin / admin) يتجاوز التسلسل لتفادي تعطّل الطلبات.
      const chain: any[] = Array.isArray(existing.approvalChain) ? (existing.approvalChain as any[]) : [];
      // تطبيق سلسلة الموافقات: يجب أن يطابق المسمى الوظيفي للمراجِع مرحلة الاعتماد الحالية
      // (للاعتماد والرفض معاً)، مع استثناء المدير العام/المدير.
      let stepTitle: string | null = null;
      if ((decision.decision === "approved" || decision.decision === "rejected") && chain.length > 0) {
        const expected = chain.find((c) => Number(c.level) === existing.currentLevel);
        if (expected?.jobTitle) {
          stepTitle = expected.stepName || expected.jobTitle;
          const role = (user?.role || "").toLowerCase();
          const isAdmin = role === "admin" || role === "super_admin";
          if (!isAdmin) {
            const reviewerJobTitle = await resolveReviewerJobTitle(userId);
            if (!reviewerJobTitle || reviewerJobTitle !== expected.jobTitle) {
              return res.status(403).json({
                error: `هذه المرحلة تتطلب اعتماد: ${stepTitle}`,
                requiredJobTitle: expected.jobTitle,
                level: existing.currentLevel,
              });
            }
          }
        }
      }

      // تحقق الرصيد عند الاعتماد (تحذير + إمكانية التجاوز)
      if (decision.decision === "approved" && !decision.allowOverBalance) {
        const bal = await getLeaveBalanceSummary(existing.branchEmployeeId, year, existing.leaveType, emp?.hireDate);
        const projected = bal.remainingDays - Number(existing.totalDays);
        if (projected < 0 && existing.leaveType !== "unpaid") {
          return res.status(409).json({
            error: "balance_exceeded",
            message: `الرصيد المتبقي (${bal.remainingDays} يوم) لا يكفي لهذه الإجازة (${existing.totalDays} يوم).`,
            balance: bal,
            requestedDays: Number(existing.totalDays),
          });
        }
      }

      // سلسلة الموافقات (تدرّج)
      const flow: any[] = Array.isArray(existing.approvalFlow) ? [...(existing.approvalFlow as any[])] : [];
      flow.push({
        level: existing.currentLevel,
        title: stepTitle || null,
        approverId: userId || null,
        approverName,
        decision: decision.decision,
        note: decision.note || null,
        at: now.toISOString(),
      });

      let finalStatus = decision.decision;
      let nextLevel = existing.currentLevel;
      // إذا اعتُمد ولكن تبقّت مستويات موافقة أعلى → ينتقل للمستوى التالي ويبقى معلّقاً
      if (decision.decision === "approved" && existing.currentLevel < existing.requiredLevels) {
        finalStatus = "pending";
        nextLevel = existing.currentLevel + 1;
      }

      const isFinal = finalStatus !== "pending";
      const [updated] = await db.update(leaveRequests).set({
        status: finalStatus,
        currentLevel: nextLevel,
        approvalFlow: flow as any,
        reviewedBy: isFinal ? userId : existing.reviewedBy,
        reviewedAt: isFinal ? now : existing.reviewedAt,
        reviewerNote: decision.note ?? existing.reviewerNote,
        updatedAt: now,
      }).where(eq(leaveRequests.id, id)).returning();

      // عند الاعتماد النهائي: مزامنة سجلات الحضور (إجازة) — غير متلف
      if (finalStatus === "approved") {
        try { await syncAttendanceForLeave(updated); } catch (err) { console.error("[hr/leaves] attendance sync failed:", err); }
      }

      await auditEvent({
        req, module: "hr_leaves", entityId: id,
        action: finalStatus === "pending" ? "approve_level" : finalStatus,
        entityName: emp?.employeeName, branchId: existing.branchId,
        description: `${decision.decision === "approved" ? "اعتماد" : "رفض"} طلب إجازة (مستوى ${existing.currentLevel}/${existing.requiredLevels})`,
        details: { decision: decision.decision, level: existing.currentLevel, finalStatus, note: decision.note },
        targetId: existing.branchEmployeeId,
      });

      // إشعار الموظف — non-blocking.
      if (emp && isFinal) {
        const verb = finalStatus === "approved" ? "اعتماد" : "رفض";
        const noteLine = decision.note ? `\nملاحظة: ${decision.note}` : "";
        await notifyEmployeeOfDecision({
          emp,
          title: `تم ${verb} طلب الإجازة`,
          message: `طلب إجازتك (${existing.startDate} إلى ${existing.endDate}) تم ${verb}ه.${noteLine}`,
          linkUrl: "/my-portal",
          relatedEntityId: id,
          channels: ["whatsapp", "sms"],
        });
      } else if (emp && decision.decision === "approved" && !isFinal) {
        // اعتماد مرحلي: ما زال الطلب بحاجة لمستويات أعلى — نُعلم الموظف بتقدّم طلبه.
        await notifyEmployeeOfDecision({
          emp,
          title: "تقدّم طلب إجازتك",
          message: `تم اعتماد المستوى ${existing.currentLevel} من ${existing.requiredLevels} لطلب إجازتك (${existing.startDate} إلى ${existing.endDate})، بانتظار الاعتماد التالي.`,
          linkUrl: "/my-portal",
          relatedEntityId: id,
          channels: ["whatsapp", "sms"],
        });
      }
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leaves] review error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // مسار الاعتماد المطبّق على فرع معيّن (لعرضه داخل نموذج الطلب). صلاحية الإجازات تكفي.
  app.get("/api/hr/leaves/applicable-chain", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const branchId = (req.query.branchId as string | undefined) || null;
      const { branchIds } = getBranchScope(req);
      if (branchId && branchIds !== null && !branchIds.includes(branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية على هذا الفرع" });
      }
      const chain = await getApplicableLeaveChain(branchId);
      res.json({ chain: chain ?? [] });
    } catch (e: any) {
      console.error("[hr/leaves/applicable-chain] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تفعيل مستويات الموافقة على الطلبات المعلّقة الحالية التي أُنشئت قبل إعداد السلاسل
  // (نسخة سلسلة الفرع كانت فارغة). يطبّق سلسلة فرع كل طلب ويعيد ضبط المستوى الحالي = 1.
  // يتخطّى الطلبات التي بدأ فيها اتخاذ قرار فعلي (approvalFlow فيه decision) أو لا سلسلة لفرعها.
  app.post("/api/hr/leaves/apply-chains", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const conds: any[] = [eq(leaveRequests.status, "pending")];
      const scope = applyBranchScope(leaveRequests, branchIds);
      if (scope !== undefined) conds.push(scope);
      const pending = await db.select().from(leaveRequests).where(and(...conds));

      const chainCache = new Map<string, any[] | null>();
      let updated = 0, skippedNoChain = 0, skippedInFlight = 0, alreadyOk = 0;
      const now = new Date();

      for (const lr of pending) {
        const hasChain = Array.isArray(lr.approvalChain) && (lr.approvalChain as any[]).length > 0;
        if (hasChain) { alreadyOk++; continue; }
        const flowHasDecision = Array.isArray(lr.approvalFlow)
          && (lr.approvalFlow as any[]).some((f) => f && f.decision);
        if (flowHasDecision) { skippedInFlight++; continue; }

        const key = lr.branchId || "__default__";
        if (!chainCache.has(key)) {
          chainCache.set(key, await getApplicableLeaveChain(lr.branchId));
        }
        const chain = chainCache.get(key);
        if (!chain || chain.length === 0) { skippedNoChain++; continue; }

        // تحديث مشروط ذرّي: لا نمسّ الطلب إلا إذا ظل معلّقاً وبلا سلسلة وبلا قرار فعلي
        // (يمنع سباق القراءة-ثم-الكتابة لو اعتمده مراجع بين الجلب والتحديث).
        const affected = await db.update(leaveRequests).set({
          approvalChain: chain as any,
          requiredLevels: chain.length,
          currentLevel: 1,
          updatedAt: now,
        }).where(and(
          eq(leaveRequests.id, lr.id),
          eq(leaveRequests.status, "pending"),
          sql`(${leaveRequests.approvalChain} IS NULL OR jsonb_array_length(${leaveRequests.approvalChain}) = 0)`,
          sql`NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(${leaveRequests.approvalFlow}, '[]'::jsonb)) AS e WHERE (e ->> 'decision') IS NOT NULL)`,
        )).returning({ id: leaveRequests.id });

        if (affected.length > 0) updated++; else skippedInFlight++;
      }

      await auditEvent({
        req, module: "hr_leaves", entityId: 0, action: "apply_chains",
        description: `تفعيل مستويات الموافقة على الطلبات المعلّقة (حُدّث ${updated})`,
        details: { updated, skippedNoChain, skippedInFlight, alreadyOk, total: pending.length },
      });

      res.json({ updated, skippedNoChain, skippedInFlight, alreadyOk, total: pending.length });
    } catch (e: any) {
      console.error("[hr/leaves/apply-chains] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تعديل تواريخ إجازة قائمة (للمسؤول). يُبقي دورة الاعتماد كما هي ويُسجّل التعديل
  // ويُشعر الموظف (داخل النظام + واتساب).
  app.patch("/api/hr/leaves/:id/dates", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const body = z.object({
        startDate: z.string().min(1),
        endDate: z.string().min(1),
        note: z.string().optional(),
      }).parse(req.body);
      if (body.endDate < body.startDate) {
        return res.status(400).json({ error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" });
      }
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status !== "pending" && existing.status !== "approved") {
        return res.status(400).json({ error: "لا يمكن تعديل تواريخ طلب مرفوض أو ملغى" });
      }
      if (existing.startDate === body.startDate && existing.endDate === body.endDate) {
        return res.status(400).json({ error: "لم تتغيّر التواريخ" });
      }
      // منع التداخل مع إجازة أخرى (باستثناء هذا الطلب)
      const overlap = await findOverlappingLeave(existing.branchEmployeeId, body.startDate, body.endDate, id);
      if (overlap) {
        return res.status(409).json({
          error: `يوجد طلب إجازة متداخل لنفس الموظف (${overlap.startDate} إلى ${overlap.endDate})`,
        });
      }
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      const userId = getUserId(req) || undefined;
      const user: any = (req as any).currentUser || (req as any).user || null;
      const editorName = user?.fullName || user?.firstName || user?.username || "—";
      const now = new Date();
      const { totalDays, workingDays } = computeLeaveDays(body.startDate, body.endDate);
      const oldStart = existing.startDate;
      const oldEnd = existing.endDate;

      // تسجيل التعديل ضمن مسار الاعتماد (إعادة استخدام approvalFlow — لا حاجة لعمود جديد)
      const flow: any[] = Array.isArray(existing.approvalFlow) ? [...(existing.approvalFlow as any[])] : [];
      flow.push({
        type: "date_edit",
        oldStart, oldEnd,
        newStart: body.startDate, newEnd: body.endDate,
        editorId: userId || null,
        editorName,
        note: body.note || null,
        at: now.toISOString(),
      });

      const [updated] = await db.update(leaveRequests).set({
        startDate: body.startDate,
        endDate: body.endDate,
        totalDays,
        workingDays,
        approvalFlow: flow as any,
        updatedAt: now,
      }).where(eq(leaveRequests.id, id)).returning();

      // إعادة مزامنة سجلات الحضور إذا كانت الإجازة معتمدة (حذف القديم التلقائي ثم إنشاء الجديد) — غير متلف
      if (updated.status === "approved") {
        try {
          await reverseAttendanceForLeave(id);
          await syncAttendanceForLeave(updated);
        } catch (err) { console.error("[hr/leaves/dates] attendance resync failed:", err); }
      }

      await auditEvent({
        req, module: "hr_leaves", entityId: id, action: "edit_dates",
        entityName: emp?.employeeName, branchId: existing.branchId,
        description: `تعديل تواريخ إجازة من (${oldStart}→${oldEnd}) إلى (${body.startDate}→${body.endDate})`,
        details: { oldStart, oldEnd, newStart: body.startDate, newEnd: body.endDate, totalDays, workingDays, note: body.note },
        targetId: existing.branchEmployeeId,
      });

      // إشعار الموظف بالتعديل — داخل النظام + واتساب (غير متلف)
      if (emp) {
        const noteLine = body.note ? `\nملاحظة: ${body.note}` : "";
        await notifyEmployeeOfDecision({
          emp,
          title: "تم تعديل تواريخ إجازتك",
          message: `تم تعديل تواريخ إجازتك من (${oldStart} إلى ${oldEnd}) إلى (${body.startDate} إلى ${body.endDate}).${noteLine}`,
          linkUrl: "/my-portal",
          relatedEntityId: id,
          channels: ["whatsapp", "sms"],
        });
      }
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leaves/dates] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ===== نظام الموافقات والاعتمادات (إعدادات سلاسل الموافقة) =====
  // محمي بصلاحية الإعدادات (إداري). حالياً نوع الطلب = leave فقط.

  // جلب سلسلة فرع معيّن (أو الافتراضية branchId فارغ) لنوع طلب
  app.get("/api/approval-workflows", isAuthenticated, requirePermission("settings"), async (req, res) => {
    try {
      const requestType = (req.query.requestType as string) || "leave";
      const branchId = (req.query.branchId as string) || null;
      const conds = [eq(approvalWorkflows.requestType, requestType)] as any[];
      conds.push(branchId ? eq(approvalWorkflows.branchId, branchId) : sql`${approvalWorkflows.branchId} IS NULL`);
      const [wf] = await db.select().from(approvalWorkflows).where(and(...conds)).limit(1);
      if (!wf) return res.json(null);
      const steps = await db.select().from(approvalWorkflowSteps)
        .where(eq(approvalWorkflowSteps.workflowId, wf.id))
        .orderBy(approvalWorkflowSteps.stepOrder);
      res.json({ ...wf, steps });
    } catch (e: any) {
      console.error("[approval-workflows] get error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // قائمة كل السلاسل (للعرض في صفحة الإعدادات)
  app.get("/api/approval-workflows/all", isAuthenticated, requirePermission("settings"), async (req, res) => {
    try {
      const requestType = (req.query.requestType as string) || "leave";
      const list = await db.select().from(approvalWorkflows)
        .where(eq(approvalWorkflows.requestType, requestType))
        .orderBy(approvalWorkflows.branchId);
      res.json(list);
    } catch (e: any) {
      console.error("[approval-workflows] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // حفظ/تحديث سلسلة فرع (upsert) مع استبدال المراحل بالكامل
  app.put("/api/approval-workflows", isAuthenticated, requirePermission("settings"), async (req, res) => {
    try {
      const schema = z.object({
        branchId: z.string().nullable().optional(),
        requestType: z.string().default("leave"),
        name: z.string().min(1, "الاسم مطلوب"),
        isActive: z.boolean().default(true),
        steps: z.array(z.object({
          jobTitle: z.string().min(1, "المسمى الوظيفي مطلوب"),
          stepName: z.string().optional(),
          isRequired: z.boolean().default(true),
        })).min(1, "يجب إضافة مرحلة واحدة على الأقل").max(3, "الحد الأقصى 3 مستويات"),
      });
      const body = schema.parse(req.body);
      const branchId = body.branchId || null;

      const result = await db.transaction(async (tx) => {
        const conds = [eq(approvalWorkflows.requestType, body.requestType)] as any[];
        conds.push(branchId ? eq(approvalWorkflows.branchId, branchId) : sql`${approvalWorkflows.branchId} IS NULL`);
        const [existing] = await tx.select().from(approvalWorkflows).where(and(...conds)).limit(1);

        let wf = existing;
        if (existing) {
          [wf] = await tx.update(approvalWorkflows).set({
            name: body.name, isActive: body.isActive, updatedAt: new Date(),
          }).where(eq(approvalWorkflows.id, existing.id)).returning();
          await tx.delete(approvalWorkflowSteps).where(eq(approvalWorkflowSteps.workflowId, existing.id));
        } else {
          [wf] = await tx.insert(approvalWorkflows).values({
            branchId, requestType: body.requestType, name: body.name, isActive: body.isActive,
            createdBy: getUserId(req) || undefined,
          }).returning();
        }
        const stepRows = body.steps.map((s, i) => ({
          workflowId: wf.id, stepOrder: i + 1, approverType: "job_role",
          jobTitle: s.jobTitle, stepName: s.stepName || `موافقة ${s.jobTitle}`,
          isRequired: s.isRequired,
        }));
        const steps = await tx.insert(approvalWorkflowSteps).values(stepRows).returning();
        return { ...wf, steps };
      });

      await auditEvent({
        req, module: "settings", entityId: result.id, action: "update",
        description: `حفظ سلسلة موافقات (${body.requestType}) ${branchId ? "للفرع" : "افتراضية"}`,
        branchId: branchId || undefined,
      });
      res.json(result);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[approval-workflows] save error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // حذف سلسلة
  app.delete("/api/approval-workflows/:id", isAuthenticated, requirePermission("settings"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await db.delete(approvalWorkflows).where(eq(approvalWorkflows.id, id));
      res.json({ success: true });
    } catch (e: any) {
      console.error("[approval-workflows] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // إلغاء/سحب إجازة معتمدة (يتطلب سبباً) + عكس سجلات الحضور
  app.post("/api/hr/leaves/:id/cancel", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const body = z.object({ reason: z.string().min(3, "يجب ذكر سبب الإلغاء") }).parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status !== "approved" && existing.status !== "pending") {
        return res.status(400).json({ error: "لا يمكن إلغاء هذا الطلب في حالته الحالية" });
      }
      const userId = getUserId(req) || undefined;
      const [updated] = await db.update(leaveRequests).set({
        status: "cancelled",
        cancelReason: body.reason,
        cancelledBy: userId,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(leaveRequests.id, id)).returning();

      // عكس سجلات الحضور التلقائية فقط
      let reversed = 0;
      try { reversed = await reverseAttendanceForLeave(id); } catch (err) { console.error("[hr/leaves] attendance reverse failed:", err); }

      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      await auditEvent({
        req, module: "hr_leaves", entityId: id, action: "cancel",
        entityName: emp?.employeeName, branchId: existing.branchId,
        description: `إلغاء إجازة معتمدة: ${body.reason}`,
        details: { reason: body.reason, reversedAttendance: reversed, prevStatus: existing.status },
        targetId: existing.branchEmployeeId,
      });
      if (emp) {
        await notifyEmployeeOfDecision({
          emp,
          title: "تم إلغاء طلب الإجازة",
          message: `تم إلغاء إجازتك (${existing.startDate} إلى ${existing.endDate}).\nالسبب: ${body.reason}`,
          linkUrl: "/my-portal",
          relatedEntityId: id,
        });
      }
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leaves] cancel error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/hr/leaves/:id", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status === "approved" && !isAdmin(req)) {
        return res.status(400).json({ error: "لا يمكن تعديل طلب معتمد" });
      }
      // SECURITY: strip branchId/branchEmployeeId from client payload — they
      // anchor the record's branch scope and must not be mutable via PATCH.
      const { branchId: _bId, branchEmployeeId: _eId, ...partial } =
        insertLeaveRequestSchema.partial().parse(req.body) as any;
      const [updated] = await db.update(leaveRequests)
        .set({ ...partial, updatedAt: new Date() })
        .where(eq(leaveRequests.id, id))
        .returning();
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leaves] update error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/leaves/:id", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      try { await reverseAttendanceForLeave(id); } catch (err) { console.error("[hr/leaves] attendance reverse failed:", err); }
      await db.delete(leaveRequests).where(eq(leaveRequests.id, id));
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      await auditEvent({
        req, module: "hr_leaves", entityId: id, action: "delete",
        entityName: emp?.employeeName, branchId: existing.branchId,
        description: `حذف طلب إجازة (${existing.startDate}→${existing.endDate})`,
        details: { leaveType: existing.leaveType, status: existing.status },
        targetId: existing.branchEmployeeId,
      });
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/leaves] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ------------------------------------------------------------------
  // أرصدة الإجازات  /api/hr/leave-balances
  // ------------------------------------------------------------------
  // قائمة الأرصدة المحسوبة لكل الموظفين ضمن النطاق لسنة معيّنة ونوع
  app.get("/api/hr/leave-balances", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
      const leaveType = (req.query.type as string) || "annual";
      const branchId = req.query.branchId as string | undefined;

      const conds: any[] = [eq(branchEmployees.status, "active")];
      const scopeCond = applyBranchScope(branchEmployees, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (branchId) conds.push(eq(branchEmployees.branchId, branchId));

      const emps = await db
        .select({
          id: branchEmployees.id,
          employeeName: branchEmployees.employeeName,
          jobTitle: branchEmployees.jobTitle,
          branchId: branchEmployees.branchId,
          branchName: branches.name,
          hireDate: branchEmployees.hireDate,
        })
        .from(branchEmployees)
        .leftJoin(branches, eq(branchEmployees.branchId, branches.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(branchEmployees.employeeName)
        .limit(2000);

      const results = [];
      for (const e of emps) {
        const bal = await getLeaveBalanceSummary(e.id, year, leaveType, e.hireDate);
        results.push({
          ...bal,
          employeeName: e.employeeName,
          jobTitle: e.jobTitle,
          branchId: e.branchId,
          branchName: e.branchName,
          hireDate: e.hireDate,
          suggestedEntitlement: suggestedEntitlement(e.hireDate),
        });
      }
      res.json(results);
    } catch (e: any) {
      console.error("[hr/leave-balances] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // رصيد موظف واحد (لعرض البطاقة عند الإنشاء/الطباعة)
  app.get("/api/hr/leave-balances/:employeeId", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId, 10);
      const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
      const leaveType = (req.query.type as string) || "annual";
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, employeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const bal = await getLeaveBalanceSummary(employeeId, year, leaveType, emp.hireDate);
      res.json({ ...bal, suggestedEntitlement: suggestedEntitlement(emp.hireDate) });
    } catch (e: any) {
      console.error("[hr/leave-balances/:id] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // إنشاء/تحديث رصيد (تعيين المستحق/المرحّل/التعديل اليدوي)
  app.post("/api/hr/leave-balances", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const parsed = insertLeaveBalanceSchema.parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const [existing] = await db.select().from(leaveBalances).where(and(
        eq(leaveBalances.branchEmployeeId, parsed.branchEmployeeId),
        eq(leaveBalances.year, parsed.year),
        eq(leaveBalances.leaveType, parsed.leaveType || "annual"),
      ));
      let saved;
      if (existing) {
        [saved] = await db.update(leaveBalances).set({
          entitledDays: parsed.entitledDays,
          carriedOverDays: parsed.carriedOverDays,
          adjustmentDays: parsed.adjustmentDays,
          note: parsed.note,
          updatedAt: new Date(),
        }).where(eq(leaveBalances.id, existing.id)).returning();
      } else {
        [saved] = await db.insert(leaveBalances).values({
          ...parsed,
          branchId: emp.branchId,
          createdBy: getUserId(req) || undefined,
        }).returning();
      }
      await auditEvent({
        req, module: "hr_leaves", entityId: saved.id, action: existing ? "update_balance" : "create_balance",
        entityName: emp.employeeName, branchId: emp.branchId,
        description: `${existing ? "تحديث" : "تعيين"} رصيد إجازة ${parsed.year} (${parsed.leaveType || "annual"})`,
        details: { entitled: parsed.entitledDays, carried: parsed.carriedOverDays, adjustment: parsed.adjustmentDays },
        targetId: parsed.branchEmployeeId,
      });
      res.json(saved);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leave-balances] save error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/hr/leaves/stats", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const scopeCond = applyBranchScope(leaveRequests, branchIds);
      const all = await db.select().from(leaveRequests).where(scopeCond);
      const total = all.length;
      const pending = all.filter(l => l.status === "pending").length;
      const approved = all.filter(l => l.status === "approved").length;
      const rejected = all.filter(l => l.status === "rejected").length;
      const today = new Date().toISOString().slice(0, 10);
      const onLeaveToday = all.filter(l => l.status === "approved" && l.startDate <= today && l.endDate >= today).length;
      const byType: Record<string, number> = {};
      all.forEach(l => { byType[l.leaveType] = (byType[l.leaveType] || 0) + 1; });
      res.json({ total, pending, approved, rejected, onLeaveToday, byType });
    } catch (e: any) {
      console.error("[hr/leaves/stats] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // 3) الإنذارات والمخالفات  /api/hr/warnings
  // ========================================================================
  app.get("/api/hr/warnings", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : null;
      const status = req.query.status as string | undefined;
      const level = req.query.level as string | undefined;
      const branchId = req.query.branchId as string | undefined;

      const conds: any[] = [];
      const scopeCond = applyBranchScope(employeeWarnings, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (employeeId) conds.push(eq(employeeWarnings.branchEmployeeId, employeeId));
      if (status) conds.push(eq(employeeWarnings.status, status));
      if (level) conds.push(eq(employeeWarnings.level, level));
      if (branchId) conds.push(eq(employeeWarnings.branchId, branchId));

      const rows = await db
        .select({
          warning: employeeWarnings,
          employeeName: branchEmployees.employeeName,
          employeeJob: branchEmployees.jobTitle,
          branchName: branches.name,
          issuerName: users.firstName,
        })
        .from(employeeWarnings)
        .leftJoin(branchEmployees, eq(employeeWarnings.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(employeeWarnings.branchId, branches.id))
        .leftJoin(users, eq(employeeWarnings.issuedBy, users.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(employeeWarnings.issuedDate))
        .limit(1000);

      res.json(rows.map(r => ({
        ...r.warning,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
        issuerName: r.issuerName,
      })));
    } catch (e: any) {
      console.error("[hr/warnings] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/warnings", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const parsed = insertEmployeeWarningSchema.parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const safeBranchId = emp.branchId;
      // Generate a random URL-safe token used for the public WhatsApp signing link.
      const publicToken = crypto.randomBytes(24).toString("base64url");
      const [created] = await db.insert(employeeWarnings).values({
        ...parsed,
        branchId: safeBranchId,
        issuedBy: parsed.issuedBy || getUserId(req) || undefined,
        publicToken,
      } as any).returning();

      // إذا فيه deductionAmount → ينشئ خصم في salary_deductions تلقائياً (شهر إصدار الإنذار)
      if (parsed.deductionAmount && parsed.deductionAmount > 0) {
        const month = parsed.issuedDate.slice(0, 7);
        await db.insert(salaryDeductions).values({
          branchEmployeeId: parsed.branchEmployeeId,
          branchId: safeBranchId,
          month,
          type: "penalty",
          amount: parsed.deductionAmount,
          description: `جزاء على إنذار: ${parsed.reason}`,
          createdBy: getUserId(req) || undefined,
        });
      }

      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/warnings] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/hr/warnings/:id", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(employeeWarnings).where(eq(employeeWarnings.id, id));
      if (!existing) return res.status(404).json({ error: "الإنذار غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      // SECURITY: strip branchId/branchEmployeeId from client payload — they
      // anchor the record's branch scope and must not be mutable via PATCH.
      const { branchId: _bId, branchEmployeeId: _eId, ...partial } =
        insertEmployeeWarningSchema.partial().parse(req.body) as any;
      const [updated] = await db.update(employeeWarnings)
        .set({ ...partial, updatedAt: new Date() })
        .where(eq(employeeWarnings.id, id))
        .returning();
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/warnings] update error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/warnings/:id/acknowledge", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const sig = z.object({ signature: z.string().optional() }).parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(employeeWarnings).where(eq(employeeWarnings.id, id));
      if (!existing) return res.status(404).json({ error: "الإنذار غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      const [updated] = await db.update(employeeWarnings).set({
        acknowledgedAt: new Date(),
        acknowledgedSignature: sig.signature,
        updatedAt: new Date(),
      }).where(eq(employeeWarnings.id, id)).returning();
      res.json(updated);
    } catch (e: any) {
      console.error("[hr/warnings] acknowledge error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/warnings/:id", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(employeeWarnings).where(eq(employeeWarnings.id, id));
      if (!existing) return res.status(404).json({ error: "الإنذار غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      await db.delete(employeeWarnings).where(eq(employeeWarnings.id, id));
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/warnings] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Templates & reason categories (static catalog, served from server
  //      to keep one source of truth and avoid bundling for non-HR users) ----
  app.get("/api/hr/warnings/templates", isAuthenticated, requirePermission("hr_warnings"), (_req, res) => {
    res.json({ templates: WARNING_TEMPLATES, reasons: WARNING_REASON_CATEGORIES });
  });

  // ---- Regenerate the public signing token (e.g. if the old link leaked) ----
  app.post("/api/hr/warnings/:id/regenerate-token", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(employeeWarnings).where(eq(employeeWarnings.id, id));
      if (!existing) return res.status(404).json({ error: "الإنذار غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      const publicToken = crypto.randomBytes(24).toString("base64url");
      const [updated] = await db.update(employeeWarnings)
        .set({ publicToken, signedAt: null, signatureData: null, signedIp: null, signedUserAgent: null, updatedAt: new Date() } as any)
        .where(eq(employeeWarnings.id, id))
        .returning();
      res.json(updated);
    } catch (e: any) {
      console.error("[hr/warnings/regenerate-token] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Per-employee disciplinary record (account statement) ----
  app.get("/api/hr/employees/:branchEmployeeId/disciplinary-record",
    isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const branchEmployeeId = parseInt(req.params.branchEmployeeId, 10);
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && !branchIds.includes(emp.branchId || "")) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const rows = await db.select()
        .from(employeeWarnings)
        .where(eq(employeeWarnings.branchEmployeeId, branchEmployeeId))
        .orderBy(desc(employeeWarnings.issuedDate));
      const totalWarnings = rows.length;
      const activeWarnings = rows.filter(r => r.status === "active").length;
      const signedWarnings = rows.filter(r => r.signedAt).length;
      const totalDeductions = rows.reduce((s, r) => s + (r.deductionAmount || 0), 0);
      const byLevel: Record<string, number> = {};
      rows.forEach(r => { byLevel[r.level] = (byLevel[r.level] || 0) + 1; });
      res.json({
        employee: {
          id: emp.id, employeeName: emp.employeeName, jobTitle: emp.jobTitle,
          branchId: emp.branchId, nationalId: (emp as any).nationalId,
        },
        summary: { totalWarnings, activeWarnings, signedWarnings, totalDeductions, byLevel },
        warnings: rows,
      });
    } catch (e: any) {
      console.error("[hr/warnings/disciplinary-record] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ====================================================================
  // PUBLIC endpoints (NO auth) — accessed via WhatsApp link by employee
  // ====================================================================
  app.get("/api/public/warning/:token", async (req, res) => {
    try {
      const token = String(req.params.token || "").slice(0, 128);
      if (!token) return res.status(404).json({ error: "رابط غير صالح" });
      const [w] = await db.select().from(employeeWarnings).where(eq(employeeWarnings.publicToken, token));
      if (!w) return res.status(404).json({ error: "الإنذار غير موجود أو الرابط منتهي" });
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, w.branchEmployeeId));
      const [br] = w.branchId ? await db.select().from(branches).where(eq(branches.id, w.branchId)) : [null];
      const template = getWarningTemplate(w.templateId);
      const reason = getWarningReasonCategory(w.reasonCategory);
      const renderedBody = template
        ? renderWarningBody(template.body, { name: emp?.employeeName, date: w.issuedDate })
        : null;
      res.json({
        warning: {
          id: w.id, level: w.level, reason: w.reason, description: w.description,
          issuedDate: w.issuedDate, deductionAmount: w.deductionAmount,
          templateId: w.templateId, reasonCategory: w.reasonCategory,
          attachments: w.attachments || [],
          signedAt: w.signedAt, signatureData: w.signatureData,
          status: w.status,
        },
        employee: emp ? {
          id: emp.id, employeeName: emp.employeeName, jobTitle: emp.jobTitle,
          nationalId: (emp as any).nationalId,
        } : null,
        branch: br ? { id: br.id, name: br.name, nameAr: (br as any).nameAr } : null,
        template: template ? { id: template.id, label: template.label, body: renderedBody } : null,
        reasonCategoryLabel: reason?.label || null,
        legalNotice: WARNING_LEGAL_NOTICE,
      });
    } catch (e: any) {
      console.error("[public/warning/get] error:", e);
      res.status(500).json({ error: "تعذّر تحميل الإنذار" });
    }
  });

  app.post("/api/public/warning/:token/sign", async (req, res) => {
    try {
      const token = String(req.params.token || "").slice(0, 128);
      if (!token) return res.status(404).json({ error: "رابط غير صالح" });
      const body = z.object({
        signatureData: z.string().min(50, "التوقيع مطلوب").max(500_000, "التوقيع كبير جدًا"),
      }).parse(req.body);
      // Audit metadata. We rely on Express `trust proxy` (set to 1 in
      // server/index.ts) so req.ip returns the real client IP from the first
      // proxy hop (Render's edge) rather than a spoofed x-forwarded-for value
      // sent by the client directly.
      const ip = String(req.ip || req.socket.remoteAddress || "").slice(0, 64);
      const ua = String(req.headers["user-agent"] || "").slice(0, 256);
      // Atomic single-sign guarantee: the WHERE clause also requires
      // signed_at IS NULL, so two concurrent signing requests for the same
      // token can never both succeed — only the first conditional update
      // matches, the second returns zero rows and we respond 409.
      const updated = await db.update(employeeWarnings).set({
        signedAt: new Date(),
        signatureData: body.signatureData,
        signedIp: ip || null,
        signedUserAgent: ua || null,
        acknowledgedAt: new Date(), // mirror for back-compat
        updatedAt: new Date(),
      } as any).where(
        and(
          eq(employeeWarnings.publicToken, token),
          sql`${employeeWarnings.signedAt} IS NULL`,
        ),
      ).returning();
      if (updated.length === 0) {
        // Either the token doesn't exist, or the warning is already signed.
        const [existing] = await db.select({ id: employeeWarnings.id, signedAt: employeeWarnings.signedAt })
          .from(employeeWarnings)
          .where(eq(employeeWarnings.publicToken, token));
        if (!existing) return res.status(404).json({ error: "الإنذار غير موجود" });
        return res.status(409).json({ error: "تم التوقيع على هذا الإنذار مسبقًا" });
      }
      res.json({ success: true, signedAt: updated[0].signedAt });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[public/warning/sign] error:", e);
      res.status(500).json({ error: "تعذّر حفظ التوقيع" });
    }
  });

  app.get("/api/hr/warnings/stats", isAuthenticated, requirePermission("hr_warnings"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const scopeCond = applyBranchScope(employeeWarnings, branchIds);
      const all = await db.select().from(employeeWarnings).where(scopeCond);
      const total = all.length;
      const active = all.filter(w => w.status === "active").length;
      const byLevel: Record<string, number> = {};
      all.forEach(w => { byLevel[w.level] = (byLevel[w.level] || 0) + 1; });
      const totalDeductions = all.reduce((s, w) => s + (w.deductionAmount || 0), 0);
      res.json({ total, active, byLevel, totalDeductions });
    } catch (e: any) {
      console.error("[hr/warnings/stats] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // 4) السلف والقروض  /api/hr/advances  (يستخدم salary_deductions)
  // ========================================================================
  app.get("/api/hr/advances", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : null;
      const month = req.query.month as string | undefined;
      const type = req.query.type as string | undefined;

      const conds: any[] = [
        inArray(salaryDeductions.type, ["advance", "loan_installment"]),
      ];
      const scopeCond = applyBranchScope(salaryDeductions, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (employeeId) conds.push(eq(salaryDeductions.branchEmployeeId, employeeId));
      if (month) conds.push(eq(salaryDeductions.month, month));
      if (type) conds.push(eq(salaryDeductions.type, type));

      const rows = await db
        .select({
          d: salaryDeductions,
          employeeName: branchEmployees.employeeName,
          employeeJob: branchEmployees.jobTitle,
          branchName: branches.name,
        })
        .from(salaryDeductions)
        .leftJoin(branchEmployees, eq(salaryDeductions.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(salaryDeductions.branchId, branches.id))
        .where(and(...conds))
        .orderBy(desc(salaryDeductions.createdAt))
        .limit(1000);

      res.json(rows.map(r => ({
        ...r.d,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
      })));
    } catch (e: any) {
      console.error("[hr/advances] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/advances", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const parsed = insertSalaryDeductionSchema.parse(req.body);
      if (!["advance", "loan_installment"].includes(parsed.type)) {
        return res.status(400).json({ error: "النوع يجب أن يكون: سلفة أو قسط قرض" });
      }
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const [created] = await db.insert(salaryDeductions).values({
        ...parsed,
        branchId: emp.branchId,
        createdBy: getUserId(req) || undefined,
      }).returning();
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/advances] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/advances/:id", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(salaryDeductions).where(eq(salaryDeductions.id, id));
      if (!existing) return res.status(404).json({ error: "السلفة غير موجودة" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      await db.delete(salaryDeductions).where(eq(salaryDeductions.id, id));
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/advances] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/hr/advances/stats", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const scopeCond = applyBranchScope(salaryDeductions, branchIds);
      const conds: any[] = [inArray(salaryDeductions.type, ["advance", "loan_installment"])];
      if (scopeCond !== undefined) conds.push(scopeCond);
      const all = await db.select().from(salaryDeductions).where(and(...conds));
      const total = all.length;
      const totalAmount = all.reduce((s, d) => s + (d.amount || 0), 0);
      const thisMonth = new Date().toISOString().slice(0, 7);
      const thisMonthAmount = all.filter(d => d.month === thisMonth).reduce((s, d) => s + (d.amount || 0), 0);
      res.json({ total, totalAmount, thisMonthAmount });
    } catch (e: any) {
      console.error("[hr/advances/stats] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // 5) نهاية الخدمة (EOS)  /api/hr/eos
  // ========================================================================

  // محسب EOS (يحسب فقط بدون حفظ — للمعاينة)
  app.post("/api/hr/eos/calculate", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const schema = z.object({
        branchEmployeeId: z.number(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        terminationType: z.enum(["resignation", "termination", "end_of_contract", "retirement", "death"]),
        basicSalary: z.number().optional(),
        totalSalary: z.number().optional(),
        vacationBalance: z.number().optional(),
        otherDues: z.number().optional(),
        totalDeductions: z.number().optional(),
      });
      const input = schema.parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, input.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }

      const startDate = (emp as any).hireDate;
      if (!startDate) return res.status(400).json({ error: "تاريخ التعيين غير محدد للموظف" });
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(input.endDate).getTime();
      const years = Math.max(0, (endMs - startMs) / (365.25 * 24 * 60 * 60 * 1000));

      const basic = input.basicSalary ?? (emp as any).salary ?? 0;
      const total = input.totalSalary ?? (emp as any).totalSalary ?? (emp as any).salary ?? basic;

      // نظام العمل السعودي:
      // - الفصل/نهاية عقد/تقاعد/وفاة: نصف شهر لكل سنة من الـ5 الأولى، شهر كامل لكل سنة بعدها (بناءً على الراتب الكامل)
      // - الاستقالة: 1/3 إذا 2-5 سنوات، 2/3 إذا 5-10 سنوات، كامل إذا 10+ سنوات؛ لا شيء إذا أقل من سنتين
      let eosAmount = 0;
      const firstFive = Math.min(5, years);
      const afterFive = Math.max(0, years - 5);
      const fullEos = (basic * 0.5 * firstFive) + (basic * 1 * afterFive);

      if (input.terminationType === "resignation") {
        if (years < 2) eosAmount = 0;
        else if (years < 5) eosAmount = fullEos / 3;
        else if (years < 10) eosAmount = (fullEos * 2) / 3;
        else eosAmount = fullEos;
      } else {
        eosAmount = fullEos;
      }

      const dailyRate = total / 30;
      const vacationAmount = (input.vacationBalance || 0) * dailyRate;
      const netAmount = eosAmount + vacationAmount + (input.otherDues || 0) - (input.totalDeductions || 0);

      res.json({
        startDate,
        totalServiceYears: parseFloat(years.toFixed(3)),
        basicSalary: basic,
        totalSalary: total,
        eosAmount: parseFloat(eosAmount.toFixed(2)),
        vacationBalance: input.vacationBalance || 0,
        vacationAmount: parseFloat(vacationAmount.toFixed(2)),
        otherDues: input.otherDues || 0,
        totalDeductions: input.totalDeductions || 0,
        netAmount: parseFloat(netAmount.toFixed(2)),
      });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/eos/calculate] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/hr/eos", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const status = req.query.status as string | undefined;
      const conds: any[] = [];
      const scopeCond = applyBranchScope(eosCalculations, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (status) conds.push(eq(eosCalculations.status, status));

      const rows = await db
        .select({
          eos: eosCalculations,
          employeeName: branchEmployees.employeeName,
          employeeJob: branchEmployees.jobTitle,
          branchName: branches.name,
        })
        .from(eosCalculations)
        .leftJoin(branchEmployees, eq(eosCalculations.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(eosCalculations.branchId, branches.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(eosCalculations.createdAt))
        .limit(500);

      res.json(rows.map(r => ({
        ...r.eos,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
      })));
    } catch (e: any) {
      console.error("[hr/eos] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/eos", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const parsed = insertEosCalculationSchema.parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const [created] = await db.insert(eosCalculations).values({
        ...parsed,
        branchId: emp.branchId,
        createdBy: getUserId(req) || undefined,
      }).returning();
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/eos] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/eos/:id/approve", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(eosCalculations).where(eq(eosCalculations.id, id));
      if (!existing) return res.status(404).json({ error: "غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      const [updated] = await db.update(eosCalculations).set({
        status: "approved",
        approvedBy: getUserId(req) || undefined,
        approvedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(eosCalculations.id, id)).returning();
      res.json(updated);
    } catch (e: any) {
      console.error("[hr/eos] approve error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/eos/:id/pay", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(eosCalculations).where(eq(eosCalculations.id, id));
      if (!existing) return res.status(404).json({ error: "غير موجود" });
      if (existing.status !== "approved") return res.status(400).json({ error: "يجب اعتماد المستحقات أولاً" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      const [updated] = await db.update(eosCalculations).set({
        status: "paid",
        paidAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(eosCalculations.id, id)).returning();
      res.json(updated);
    } catch (e: any) {
      console.error("[hr/eos] pay error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/eos/:id", isAuthenticated, requirePermission("hr_eos"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(eosCalculations).where(eq(eosCalculations.id, id));
      if (!existing) return res.status(404).json({ error: "غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status === "paid" && !isAdmin(req)) {
        return res.status(400).json({ error: "لا يمكن حذف مستحقات تم دفعها" });
      }
      await db.delete(eosCalculations).where(eq(eosCalculations.id, id));
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/eos] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ========================================================================
  // HR HUB BUNDLE  /api/hr/hub-bundle
  // Consolidates all HR Hub KPIs into a single parallel query to replace
  // the 11+ separate network round-trips the page used to make on mount.
  // Each section is independently try/catch'd so one failure doesn't kill
  // the whole response. Scoped by user's effective branch filter.
  // ========================================================================
  app.get("/api/hr/hub-bundle", isAuthenticated, requirePermission("hr_management"), async (req, res) => {
    try {
      const queryBranchId = (req.query.branchId as string | undefined) || undefined;
      const filter = getEffectiveBranchFilter(req, queryBranchId);
      let branchIds = filter.branchIds; // null = all, [] = none
      let hasAccess = filter.hasAccess;
      let scopedBranchId = filter.singleBranchId || queryBranchId || null;
      // Cross-branch HR users (hr_manager role, or hr_management:view holders)
      // see HR data org-wide on this read endpoint — same rule as getBranchScope().
      if (hasCrossBranchHrAccess(req)) {
        if (queryBranchId && queryBranchId !== "all") {
          // Honor explicit branch filter requested from UI
          branchIds = [queryBranchId];
          scopedBranchId = queryBranchId;
        } else {
          branchIds = null;
          scopedBranchId = null;
        }
        hasAccess = true;
      }
      if (!hasAccess) {
        return res.status(403).json({ error: "ليس لديك صلاحية الوصول" });
      }
      // All date math is anchored to Saudi Arabia (Asia/Riyadh, UTC+3, no DST).
      // toISOString() returns UTC dates which, between 21:00 UTC and midnight,
      // are already "tomorrow" in Riyadh — and conversely between 00:00 and
      // 03:00 Riyadh local time, UTC is still "yesterday". Without this shift,
      // attendance for early-morning bakers would be queried against the wrong
      // date and the day boundary on month-over-month comparisons would skew.
      const SAUDI_OFFSET_MS = 3 * 60 * 60 * 1000;
      const riyadhNow = new Date(Date.now() + SAUDI_OFFSET_MS);
      const today = riyadhNow.toISOString().slice(0, 10);
      const thirtyOut = new Date(riyadhNow.getTime() + 30 * 86400000).toISOString().slice(0, 10);
      const thisMonth = today.slice(0, 7);
      // Use Riyadh-local Y/M to derive previous month; getUTC* on the shifted
      // date gives us the Riyadh calendar fields directly.
      const riyadhYear = riyadhNow.getUTCFullYear();
      const riyadhMonth0 = riyadhNow.getUTCMonth(); // 0-based
      const prevMonthDate = new Date(Date.UTC(riyadhYear, riyadhMonth0 - 1, 1));
      const prevMonth = prevMonthDate.toISOString().slice(0, 7);
      const prevMonthNum = prevMonthDate.getUTCMonth() + 1;
      const prevMonthYear = prevMonthDate.getUTCFullYear();
      // Last 7 days range (Riyadh-local)
      const sevenDaysAgo = new Date(riyadhNow.getTime() - 6 * 86400000).toISOString().slice(0, 10);
      // Current/previous month boundaries — compute the true last day of the
      // previous month (handles 28/29/30/31) instead of always using "-31".
      const thisMonthStart = `${thisMonth}-01`;
      const prevMonthStart = `${prevMonth}-01`;
      const prevMonthEnd = new Date(Date.UTC(riyadhYear, riyadhMonth0, 0)).toISOString().slice(0, 10);

      const empCond = applyBranchScope(branchEmployees, branchIds);
      const docCond = applyBranchScope(employeeDocuments, branchIds);
      const leaveCond = applyBranchScope(leaveRequests, branchIds);
      const warnCond = applyBranchScope(employeeWarnings, branchIds);
      const advCond = applyBranchScope(salaryDeductions, branchIds);
      const eosCond = applyBranchScope(eosCalculations, branchIds);
      const offerCond = applyBranchScope(jobOffers, branchIds);
      // employmentApplications uses targetBranchId (not branchId) — custom scope
      const appCond = branchIds === null
        ? undefined
        : (branchIds.length === 0 ? sql`false` : inArray(employmentApplications.targetBranchId, branchIds));
      // branches list scoped to user's accessible branches (admins see all)
      const branchListCond = branchIds === null
        ? undefined
        : (branchIds.length === 0 ? sql`false` : inArray(branches.id, branchIds));
      // attendance scoped by date + branch
      const attDateCond = eq(attendanceRecords.attendanceDate, today);
      const attCond = scopedBranchId
        ? and(attDateCond, eq(attendanceRecords.branchId, scopedBranchId))
        : (branchIds === null
            ? attDateCond
            : (branchIds.length === 0 ? sql`false` : and(attDateCond, inArray(attendanceRecords.branchId, branchIds))));

      // PERF: per-section timeout (12s) so a single slow query never blocks the
      // whole bundle. Fallback is returned + logged instead of failing the response.
      const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
        try {
          return await Promise.race([
            p,
            new Promise<T>((_, rej) => setTimeout(() => rej(new Error("section_timeout_12s")), 12000)),
          ]);
        } catch (e: any) {
          console.error("[hub-bundle section]", e?.message);
          return fallback;
        }
      };

      const [
        employees, branchesList, docs, leaves, warns, advs, eosRows,
        attRows, applications, offers, acceptedOffers,
      ] = await Promise.all([
        safe(db.select().from(branchEmployees).where(empCond), [] as any[]),
        safe(db.select().from(branches).where(branchListCond), [] as any[]),
        safe(db.select().from(employeeDocuments).where(docCond), [] as any[]),
        safe(db.select().from(leaveRequests).where(leaveCond), [] as any[]),
        safe(db.select().from(employeeWarnings).where(warnCond), [] as any[]),
        safe(db.select().from(salaryDeductions).where(
          advCond ? and(advCond, inArray(salaryDeductions.type, ["advance", "loan_installment"]))
                  : inArray(salaryDeductions.type, ["advance", "loan_installment"]),
        ), [] as any[]),
        safe(db.select().from(eosCalculations).where(eosCond), [] as any[]),
        safe(db.select().from(attendanceRecords).where(attCond), [] as any[]),
        safe(db.select({ id: employmentApplications.id, status: employmentApplications.status }).from(employmentApplications).where(appCond), [] as any[]),
        safe(db.select({ id: jobOffers.id, status: jobOffers.status }).from(jobOffers).where(offerCond), [] as any[]),
        safe(db.select({ id: jobOffers.id }).from(jobOffers).where(offerCond ? and(offerCond, eq(jobOffers.status, "accepted")) : eq(jobOffers.status, "accepted")), [] as any[]),
      ]);

      // ── Comparisons & chart aggregations (parallel, additive — failures don't break the page) ──
      const attLast7Cond = and(
        gte(attendanceRecords.attendanceDate, sevenDaysAgo),
        lte(attendanceRecords.attendanceDate, today),
        scopedBranchId
          ? eq(attendanceRecords.branchId, scopedBranchId)
          : (branchIds === null ? sql`true` : (branchIds.length === 0 ? sql`false` : inArray(attendanceRecords.branchId, branchIds))),
      );
      const prevMonthAttCond = and(
        gte(attendanceRecords.attendanceDate, prevMonthStart),
        lte(attendanceRecords.attendanceDate, prevMonthEnd),
        scopedBranchId
          ? eq(attendanceRecords.branchId, scopedBranchId)
          : (branchIds === null ? sql`true` : (branchIds.length === 0 ? sql`false` : inArray(attendanceRecords.branchId, branchIds))),
      );
      const thisMonthAttCond = and(
        gte(attendanceRecords.attendanceDate, thisMonthStart),
        lte(attendanceRecords.attendanceDate, today),
        scopedBranchId
          ? eq(attendanceRecords.branchId, scopedBranchId)
          : (branchIds === null ? sql`true` : (branchIds.length === 0 ? sql`false` : inArray(attendanceRecords.branchId, branchIds))),
      );

      const [
        weeklyAttRows,
        prevMonthAttAgg,
        thisMonthAttAgg,
        thisMonthHiresAgg,
        prevMonthHiresAgg,
        thisMonthAppsAgg,
        prevMonthAppsAgg,
        prevMonthAdvAgg,
        appsByStatusRows,
        thisMonthDeductionsByEmp,
        thisMonthAbsenceDaysByEmp,
      ] = await Promise.all([
        // Weekly attendance grouped by date + status
        safe(
          db.select({
            d: attendanceRecords.attendanceDate,
            status: attendanceRecords.status,
            c: sql<number>`count(*)::int`,
          }).from(attendanceRecords).where(attLast7Cond)
            .groupBy(attendanceRecords.attendanceDate, attendanceRecords.status),
          [] as any[],
        ),
        // Prev-month attendance rate (present vs total)
        safe(
          db.select({
            total: sql<number>`count(*)::int`,
            present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')::int`,
          }).from(attendanceRecords).where(prevMonthAttCond),
          [{ total: 0, present: 0 }] as any[],
        ),
        // This-month attendance rate (month-to-date) — for fairer comparison
        safe(
          db.select({
            total: sql<number>`count(*)::int`,
            present: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'present')::int`,
          }).from(attendanceRecords).where(thisMonthAttCond),
          [{ total: 0, present: 0 }] as any[],
        ),
        // Hires created this month
        safe(
          db.select({ c: sql<number>`count(*)::int` }).from(branchEmployees)
            .where(and(empCond ?? sql`true`, gte(branchEmployees.createdAt, new Date(thisMonthStart)))),
          [{ c: 0 }] as any[],
        ),
        // Hires created prev month (half-open: [prevMonthStart, thisMonthStart) )
        safe(
          db.select({ c: sql<number>`count(*)::int` }).from(branchEmployees)
            .where(and(
              empCond ?? sql`true`,
              gte(branchEmployees.createdAt, new Date(prevMonthStart)),
              lt(branchEmployees.createdAt, new Date(thisMonthStart)),
            )),
          [{ c: 0 }] as any[],
        ),
        // Employment applications this month
        safe(
          db.select({ c: sql<number>`count(*)::int` }).from(employmentApplications)
            .where(and(appCond ?? sql`true`, gte(employmentApplications.createdAt, new Date(thisMonthStart)))),
          [{ c: 0 }] as any[],
        ),
        // Employment applications prev month (half-open: [prevMonthStart, thisMonthStart) )
        safe(
          db.select({ c: sql<number>`count(*)::int` }).from(employmentApplications)
            .where(and(
              appCond ?? sql`true`,
              gte(employmentApplications.createdAt, new Date(prevMonthStart)),
              lt(employmentApplications.createdAt, new Date(thisMonthStart)),
            )),
          [{ c: 0 }] as any[],
        ),
        // Prev-month advances total
        safe(
          db.select({ amt: sql<number>`coalesce(sum(${salaryDeductions.amount}),0)::numeric` })
            .from(salaryDeductions)
            .where(and(
              advCond ?? sql`true`,
              inArray(salaryDeductions.type, ["advance", "loan_installment"]),
              eq(salaryDeductions.month, prevMonth),
            )),
          [{ amt: 0 }] as any[],
        ),
        // Hiring funnel: applications grouped by status (current month)
        safe(
          db.select({
            status: employmentApplications.status,
            c: sql<number>`count(*)::int`,
          }).from(employmentApplications)
            .where(and(appCond ?? sql`true`, gte(employmentApplications.createdAt, new Date(thisMonthStart))))
            .groupBy(employmentApplications.status),
          [] as any[],
        ),
        // Current-month salary deductions of ALL types, summed per employee.
        // Used to deduct from the gross monthly salary invoice for active staff.
        safe(
          db.select({
            empId: salaryDeductions.branchEmployeeId,
            amt: sql<number>`coalesce(sum(${salaryDeductions.amount}),0)::numeric`,
          }).from(salaryDeductions)
            .where(and(
              advCond ?? sql`true`,
              eq(salaryDeductions.month, thisMonth),
            ))
            .groupBy(salaryDeductions.branchEmployeeId),
          [] as any[],
        ),
        // Current-month absent days per employee (status='absent') — used to
        // compute automatic absence deduction = absent_days × (gross / 30).
        safe(
          db.select({
            empId: attendanceRecords.branchEmployeeId,
            absentDays: sql<number>`count(*)::int`,
          }).from(attendanceRecords)
            .where(and(thisMonthAttCond, eq(attendanceRecords.status, "absent")))
            .groupBy(attendanceRecords.branchEmployeeId),
          [] as any[],
        ),
      ]);
      void prevMonthNum; void prevMonthYear;

      // Employees aggregates
      const totalEmployees = employees.length;
      const activeEmployeesList = employees.filter((e: any) => (e.status || "active") === "active");
      const activeEmployees = activeEmployeesList.length;
      const inactiveEmployees = totalEmployees - activeEmployees;
      const onLeaveCount = employees.filter((e: any) => e.status === "on_leave").length;
      const nationalitiesCount = new Set(employees.map((e: any) => e.nationality).filter(Boolean)).size;

      // ── Monthly Salary Invoice (active employees only, net after deductions) ──
      // gross = basic + housing + transport + food + other allowances
      // manualDeductions = sum of salary_deductions rows for current month
      //   (advance / loan_installment / deduction / penalty / other)
      // absenceDeduction = Σ (absent_days × gross_monthly / 30) for each active emp
      // net = max(0, gross − manualDeductions − absenceDeduction)
      const grossByEmp = new Map<number, number>();
      let salaryGross = 0;
      for (const e of activeEmployeesList) {
        const g = (Number(e.basicSalary ?? e.salary) || 0)
          + (Number(e.housingAllowance) || 0)
          + (Number(e.transportAllowance) || 0)
          + (Number(e.foodAllowance) || 0)
          + (Number(e.otherAllowances) || 0);
        grossByEmp.set(e.id, g);
        salaryGross += g;
      }
      const activeIdSet = new Set<number>(activeEmployeesList.map((e: any) => e.id));
      let salaryManualDeductions = 0;
      for (const r of thisMonthDeductionsByEmp as any[]) {
        if (r.empId != null && activeIdSet.has(Number(r.empId))) {
          salaryManualDeductions += Number(r.amt) || 0;
        }
      }
      let salaryAbsenceDeduction = 0;
      for (const r of thisMonthAbsenceDaysByEmp as any[]) {
        const eid = r.empId != null ? Number(r.empId) : null;
        if (eid != null && activeIdSet.has(eid)) {
          const gross = grossByEmp.get(eid) || 0;
          const days = Number(r.absentDays) || 0;
          salaryAbsenceDeduction += (gross / 30) * days;
        }
      }
      const salaryNet = Math.max(0, salaryGross - salaryManualDeductions - salaryAbsenceDeduction);
      // Backward-compat: `totalSalaries` now reflects the NET payable invoice
      // for active employees after all deductions (was: gross of all employees).
      const totalSalaries = Math.round(salaryNet);
      const salaryInvoice = {
        activeEmployees,
        gross: Math.round(salaryGross),
        manualDeductions: Math.round(salaryManualDeductions),
        absenceDeduction: Math.round(salaryAbsenceDeduction),
        net: Math.round(salaryNet),
      };
      // Distribution charts: count ACTIVE employees only so they match the
      // "Active Employees" tile, salary calculations, and the per-branch donut.
      // Non-active rows (inactive/terminated/suspended/on_leave) are excluded.
      const byNationalityMap: Record<string, number> = {};
      const byJobTitleMap: Record<string, number> = {};
      activeEmployeesList.forEach((e: any) => {
        if (e.nationality) byNationalityMap[e.nationality] = (byNationalityMap[e.nationality] || 0) + 1;
        if (e.jobTitle) byJobTitleMap[e.jobTitle] = (byJobTitleMap[e.jobTitle] || 0) + 1;
      });

      // Documents stats
      const docStats = {
        total: docs.length,
        expired: docs.filter((d: any) => d.expiryDate && d.expiryDate < today).length,
        expiringSoon: docs.filter((d: any) => d.expiryDate && d.expiryDate >= today && d.expiryDate <= thirtyOut).length,
        expiredIqama: docs.filter((d: any) => d.documentType === "iqama" && d.expiryDate && d.expiryDate < today).length,
        expiredHealth: docs.filter((d: any) => d.documentType === "health_certificate" && d.expiryDate && d.expiryDate < today).length,
      };

      // Leaves stats
      const leaveStats = {
        total: leaves.length,
        pending: leaves.filter((l: any) => l.status === "pending").length,
        approved: leaves.filter((l: any) => l.status === "approved").length,
        onLeaveToday: leaves.filter((l: any) => l.status === "approved" && l.startDate <= today && l.endDate >= today).length,
      };

      // Warnings stats
      const warningStats = {
        total: warns.length,
        active: warns.filter((w: any) => w.status === "active").length,
      };

      // Advances stats
      const advanceStats = {
        total: advs.length,
        totalAmount: advs.reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0),
        thisMonthAmount: advs.filter((d: any) => d.month === thisMonth).reduce((s: number, d: any) => s + (Number(d.amount) || 0), 0),
      };

      // Onboarding stats (accepted offers + their notification status)
      let onboardingStats: any = { total: acceptedOffers.length, pending: 0, sent: 0, signed: 0, confirmed: 0, converted: 0 };
      if (acceptedOffers.length > 0) {
        const offerIds = acceptedOffers.map((o: any) => o.id);
        const grouped = await safe(
          db.select({ status: onboardingNotifications.status, c: sql<number>`count(*)::int` })
            .from(onboardingNotifications)
            .where(inArray(onboardingNotifications.jobOfferId, offerIds))
            .groupBy(onboardingNotifications.status),
          [] as any[],
        );
        let withNotif = 0;
        for (const g of grouped) {
          onboardingStats[g.status] = Number(g.c);
          withNotif += Number(g.c);
        }
        onboardingStats.pending = Math.max(0, acceptedOffers.length - withNotif) + (onboardingStats.pending || 0);
      }

      // Attendance today (already filtered)
      // `total` = attendance rows recorded today (any status)
      // `expectedToday` = active employees in scope (the realistic denominator
      //   for "كم حضر اليوم من أصل المتوقع"). Using `total` alone is
      //   misleading when many employees simply have no row yet today.
      // `attendanceRate` uses the larger of (expectedToday, total) so the
      //   percentage reflects coverage against the active workforce, not
      //   just the partial set that has any record.
      const attTotal = attRows.length;
      const attPresent = attRows.filter((r: any) => r.status === "present").length;
      const attLate = attRows.filter((r: any) => r.status === "late").length;
      const attAbsent = attRows.filter((r: any) => r.status === "absent").length;
      const attExpected = Math.max(activeEmployees, attTotal);
      const attendanceToday = {
        date: today,
        total: attTotal,
        expectedToday: attExpected,
        present: attPresent,
        late: attLate,
        absent: attAbsent,
        attendanceRate: attExpected > 0
          ? Math.round(((attPresent + attLate) / attExpected) * 100)
          : 0,
      };

      // EOS list (lightweight — count + draft count)
      const eosStats = {
        total: eosRows.length,
        draft: eosRows.filter((e: any) => e.status === "draft").length,
        pending: eosRows.filter((e: any) => e.status === "pending").length,
      };

      // Monthly Salary Closing — current month status across scoped branches.
      // Riyadh-anchored so the period doesn't roll back to last month during
      // the 00:00–02:59 Riyadh window on the 1st of each month.
      const curMonth = riyadhMonth0 + 1;
      const curYear = riyadhYear;
      const periodMonthCond = and(eq(financialPeriods.month, curMonth), eq(financialPeriods.year, curYear));
      const periodCond = branchIds === null
        ? periodMonthCond
        : (branchIds.length === 0 ? sql`false` : and(periodMonthCond, inArray(financialPeriods.branchId, branchIds)));
      const periods = await safe(
        db.select({
          id: financialPeriods.id,
          branchId: financialPeriods.branchId,
          status: financialPeriods.status,
          updatedAt: financialPeriods.updatedAt,
        }).from(financialPeriods).where(periodCond),
        [] as any[],
      );
      const totalScopedBranches = branchIds === null ? branchesList.length : branchIds.length;
      const openCount = periods.filter((p: any) => p.status === "draft" || p.status === "open").length;
      const closedCount = periods.filter((p: any) => p.status === "closed").length;
      const lockedCount = periods.filter((p: any) => p.status === "locked").length;
      const notStartedCount = Math.max(0, totalScopedBranches - periods.length);
      const lastUpdated = periods.reduce((acc: Date | null, p: any) => {
        const t = p.updatedAt ? new Date(p.updatedAt) : null;
        return !acc || (t && t > acc) ? t : acc;
      }, null as Date | null);
      // Monthly salary bill = GROSS sum from ACTIVE employees only (to match
      // the employeesCount displayed alongside it) — includes the full
      // allowance stack: basic + housing + transport + food + other.
      const totalMonthlySalaries = activeEmployeesList.reduce((s: number, e: any) =>
        s + (Number(e.basicSalary ?? e.salary) || 0) + (Number(e.housingAllowance) || 0)
          + (Number(e.transportAllowance) || 0) + (Number(e.foodAllowance) || 0)
          + (Number(e.otherAllowances) || 0), 0);
      const salaryClosing = {
        month: curMonth,
        year: curYear,
        totalBranches: totalScopedBranches,
        openCount,
        closedCount,
        lockedCount,
        notStartedCount,
        lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
        totalMonthlySalaries,
        employeesCount: employees.filter((e: any) => (e.status || "active") === "active").length,
        progressPercent: totalScopedBranches > 0
          ? Math.round(((closedCount + lockedCount) / totalScopedBranches) * 100)
          : 0,
      };

      // Branches list — minimal payload
      const branchesList2 = branchesList.map((b: any) => ({ id: b.id, name: b.name, nameAr: b.nameAr || null }));

      // Employees minimal payload (drop heavy/sensitive fields)
      const employeesLight = employees.map((e: any) => ({
        id: e.id,
        employeeName: e.employeeName,
        employeeNameEn: e.employeeNameEn,
        phoneNumber: e.phoneNumber,
        status: e.status,
        branchId: e.branchId,
        jobTitle: e.jobTitle,
        nationality: e.nationality,
      }));

      // ── Build comparisons (current vs prev period) ──
      // Both rates use the SAME formula: present/total of *recorded* rows so
      // the delta is apples-to-apples. (The today-only tile uses a different
      // denominator — expectedToday — which is fine for a snapshot but would
      // distort month-over-month trends when the workforce size shifts.)
      const prevAttTotal = Number((prevMonthAttAgg[0] as any)?.total || 0);
      const prevAttPresent = Number((prevMonthAttAgg[0] as any)?.present || 0);
      const prevAttRate = prevAttTotal > 0 ? Math.round((prevAttPresent / prevAttTotal) * 100) : 0;
      const curAttTotal = Number((thisMonthAttAgg[0] as any)?.total || 0);
      const curAttPresent = Number((thisMonthAttAgg[0] as any)?.present || 0);
      const curAttRate = curAttTotal > 0 ? Math.round((curAttPresent / curAttTotal) * 100) : 0;
      const hiresThisMonth = Number((thisMonthHiresAgg[0] as any)?.c || 0);
      const hiresPrevMonth = Number((prevMonthHiresAgg[0] as any)?.c || 0);
      const appsThisMonth = Number((thisMonthAppsAgg[0] as any)?.c || 0);
      const appsPrevMonth = Number((prevMonthAppsAgg[0] as any)?.c || 0);
      const prevAdvancesAmount = Number((prevMonthAdvAgg[0] as any)?.amt || 0);

      const pctDelta = (cur: number, prev: number): number | null => {
        if (prev === 0) return cur > 0 ? 100 : null;
        return Math.round(((cur - prev) / prev) * 100);
      };

      const comparisons = {
        period: { current: thisMonth, previous: prevMonth },
        attendanceRate: {
          current: curAttRate,
          previous: prevAttRate,
          delta: curAttRate - prevAttRate,
          target: 90,
        },
        hires: {
          current: hiresThisMonth,
          previous: hiresPrevMonth,
          delta: hiresThisMonth - hiresPrevMonth,
          deltaPct: pctDelta(hiresThisMonth, hiresPrevMonth),
        },
        applications: {
          current: appsThisMonth,
          previous: appsPrevMonth,
          delta: appsThisMonth - appsPrevMonth,
          deltaPct: pctDelta(appsThisMonth, appsPrevMonth),
        },
        advances: {
          currentAmount: advanceStats.thisMonthAmount,
          previousAmount: prevAdvancesAmount,
          delta: advanceStats.thisMonthAmount - prevAdvancesAmount,
          deltaPct: pctDelta(advanceStats.thisMonthAmount, prevAdvancesAmount),
        },
      };

      // ── Build chart series ──
      // Weekly attendance: build last 7 days array with present/late/absent counts
      const weeklyAttendance: { date: string; present: number; late: number; absent: number; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        // Riyadh-anchored so labels match the queried day buckets.
        const d = new Date(riyadhNow.getTime() - i * 86400000).toISOString().slice(0, 10);
        const dayRows = weeklyAttRows.filter((r: any) => r.d === d);
        const present = dayRows.filter((r: any) => r.status === "present").reduce((s, r: any) => s + Number(r.c), 0);
        const late = dayRows.filter((r: any) => r.status === "late").reduce((s, r: any) => s + Number(r.c), 0);
        const absent = dayRows.filter((r: any) => r.status === "absent").reduce((s, r: any) => s + Number(r.c), 0);
        weeklyAttendance.push({ date: d, present, late, absent, total: present + late + absent });
      }

      // Cost breakdown: sum of salary components for ACTIVE employees ONLY
      // (consistent with the salary invoice tile). Including inactive/terminated
      // employees previously inflated the monthly cost picture.
      const basicTotal = activeEmployeesList.reduce((s: number, e: any) => s + (Number(e.basicSalary ?? e.salary) || 0), 0);
      const housingTotal = activeEmployeesList.reduce((s: number, e: any) => s + (Number(e.housingAllowance) || 0), 0);
      const transportTotal = activeEmployeesList.reduce((s: number, e: any) => s + (Number(e.transportAllowance) || 0), 0);
      const foodTotal = activeEmployeesList.reduce((s: number, e: any) => s + (Number(e.foodAllowance) || 0), 0);
      const otherTotal = activeEmployeesList.reduce((s: number, e: any) => s + (Number(e.otherAllowances) || 0), 0);
      const costBreakdown = [
        { name: "الراتب الأساسي", value: Math.round(basicTotal) },
        { name: "بدل السكن", value: Math.round(housingTotal) },
        { name: "بدل النقل", value: Math.round(transportTotal) },
        { name: "بدل الطعام", value: Math.round(foodTotal) },
        { name: "بدلات أخرى", value: Math.round(otherTotal) },
        { name: "سلف وأقساط (شهر حالي)", value: Math.round(advanceStats.thisMonthAmount) },
        { name: "خصم غياب (شهر حالي)", value: Math.round(salaryAbsenceDeduction) },
      ].filter((c) => c.value > 0);

      // Hiring funnel: applications by status this month + offers (sent/accepted) + onboarding
      // Real status taxonomy from employmentApplications: invited/submitted/under_review/shortlisted/interviewed/hired/rejected
      const appsStatusMap: Record<string, number> = {};
      appsByStatusRows.forEach((r: any) => { appsStatusMap[(r.status || "invited").toLowerCase()] = Number(r.c); });
      const totalAppsThisMonth = Object.values(appsStatusMap).reduce((s, n) => s + n, 0);
      const offersSent = offers.filter((o: any) => ["sent", "pending"].includes(o.status)).length;
      const offersAccepted = offers.filter((o: any) => o.status === "accepted").length;
      // Forecast: expected hires next month = avg(this+prev) ; conversion rate from apps to hires
      const conversionRate = appsPrevMonth > 0 ? Math.round((hiresPrevMonth / appsPrevMonth) * 100) : null;
      const forecastNextMonth = Math.round((hiresThisMonth + hiresPrevMonth) / 2);
      // Map real statuses (with legacy aliases) onto funnel stages
      const stageInvited     = (appsStatusMap["invited"] || 0) + (appsStatusMap["new"] || 0) + (appsStatusMap["pending"] || 0);
      const stageSubmitted   = (appsStatusMap["submitted"] || 0);
      const stageUnderReview = (appsStatusMap["under_review"] || 0) + (appsStatusMap["review"] || 0) + (appsStatusMap["shortlisted"] || 0);
      const stageInterviewed = (appsStatusMap["interviewed"] || 0) + (appsStatusMap["interview"] || 0);
      const hiringFunnel = {
        steps: [
          { name: "مدعوّون", value: stageInvited },
          { name: "طلبات مُقدَّمة", value: stageSubmitted },
          { name: "قيد المراجعة", value: stageUnderReview },
          { name: "تمت المقابلة", value: stageInterviewed },
          { name: "عروض مُرسلة", value: offersSent },
          { name: "عروض مقبولة", value: offersAccepted },
          { name: "مباشرة عمل", value: onboardingStats.total || 0 },
        ],
        totals: {
          applicationsThisMonth: totalAppsThisMonth,
          hiresThisMonth,
          hiresPrevMonth,
          conversionRate,
          forecastNextMonth,
        },
      };

      const charts = {
        weeklyAttendance,
        costBreakdown,
        hiringFunnel,
      };

      res.json({
        generatedAt: new Date().toISOString(),
        branchFilter: scopedBranchId || "all",
        employees: employeesLight,
        branches: branchesList2,
        applications,
        jobOffers: offers,
        stats: {
          totalEmployees,
          activeEmployees,
          inactiveEmployees,
          onLeaveCount,
          nationalitiesCount,
          totalSalaries,
          salaryInvoice,
          byNationality: Object.entries(byNationalityMap).map(([nationality, count]) => ({ nationality, count })).sort((a, b) => b.count - a.count),
          byJobTitle: Object.entries(byJobTitleMap).map(([jobTitle, count]) => ({ jobTitle, count })).sort((a, b) => b.count - a.count),
        },
        docStats,
        leaveStats,
        warningStats,
        advanceStats,
        onboardingStats,
        attendanceToday,
        eosStats,
        salaryClosing,
        comparisons,
        charts,
      });
    } catch (e: any) {
      console.error("[hr/hub-bundle] error:", e);
      res.status(500).json({ error: e.message || "فشل في تحميل بيانات لوحة الموارد البشرية" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/hr/ai-insights — رؤى مولّدة بالذكاء الاصطناعي (OpenAI gpt-5)
  // يستقبل لقطة (snapshot) من بيانات الـ hub ويُعيد قائمة رؤى بالعربية
  // Blueprint reference: javascript_openai
  // ──────────────────────────────────────────────────────────────────────────
  // Strict snapshot schema — bounds size + shape, prevents token-cost abuse
  const aiSnapshotSchema = z.object({
    totals: z.object({
      totalEmployees: z.number().int().nonnegative().max(100000),
      activeEmployees: z.number().int().nonnegative().max(100000),
      inactiveEmployees: z.number().int().nonnegative().max(100000),
      totalSalaries: z.number().nonnegative().max(1e12),
      avgSalary: z.number().nonnegative().max(1e9),
    }),
    recruitment: z.object({
      pendingApplications: z.number().int().nonnegative().max(100000),
      pendingOffers: z.number().int().nonnegative().max(100000),
    }),
    documents: z.object({
      expired: z.number().int().nonnegative().max(100000),
      expiredIqama: z.number().int().nonnegative().max(100000),
      expiredHealth: z.number().int().nonnegative().max(100000),
      expiringSoon: z.number().int().nonnegative().max(100000),
    }),
    warnings: z.object({ active: z.number().int().nonnegative().max(100000) }),
    advances: z.object({ total: z.number().int().nonnegative().max(100000) }),
    leaves: z.object({ pending: z.number().int().nonnegative().max(100000) }),
    attendanceToday: z.object({
      attendanceRate: z.number().min(0).max(100),
      present: z.number().int().nonnegative().max(100000),
      absent: z.number().int().nonnegative().max(100000),
      late: z.number().int().nonnegative().max(100000),
      total: z.number().int().nonnegative().max(100000),
    }).nullable(),
    branches: z.array(z.object({
      name: z.string().max(100),
      employees: z.number().int().nonnegative().max(100000),
    })).max(20),
    comparisons: z.any().optional().nullable(),
    branchFilter: z.string().max(100).optional(),
    generatedAt: z.string().max(40).optional(),
  });

  // Allowed action hrefs returned by the AI (defense-in-depth against prompt-injected links)
  const ALLOWED_AI_HREFS = new Set([
    "/hr/applications", "/hr/job-offers", "/branch-employees", "/attendance-dashboard",
    "/hr/employee-documents", "/hr/warnings", "/employee-reports", "/organizational-structure",
    "/hr/leaves", "/hr/advances", "/hr/eos",
    "/hr/employee-documents?type=iqama&status=expired",
    "/hr/employee-documents?type=health_certificate&status=expired",
  ]);

  app.post("/api/hr/ai-insights", isAuthenticated, requirePermission("hr_management"), async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "AI_NOT_CONFIGURED",
          message: "ميزة المساعد الذكي غير مفعّلة — يلزم ضبط مفتاح OpenAI.",
        });
      }

      // Hard payload limit (≤ 30KB JSON) before Zod, to short-circuit huge bodies
      const rawBodyLen = JSON.stringify(req.body || {}).length;
      if (rawBodyLen > 30_000) {
        return res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "حجم البيانات كبير جداً" });
      }

      const parsedSnap = aiSnapshotSchema.safeParse(req.body?.snapshot);
      if (!parsedSnap.success) {
        return res.status(400).json({
          error: "INVALID_SNAPSHOT",
          message: "snapshot غير صالح",
          details: parsedSnap.error.issues.slice(0, 3),
        });
      }
      const snapshot = parsedSnap.data;

      const OpenAI = (await import("openai")).default;
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const openai = new OpenAI({ apiKey });

      const allowedIcons = [
        "AlertTriangle", "Briefcase", "UserCheck", "TrendingDown", "TrendingUp",
        "Clock", "ShieldAlert", "Wallet", "Building", "Lightbulb",
        "Users", "Calendar", "FileWarning", "Award", "Target",
      ];

      const systemPrompt = `أنت مستشار ذكي لإدارة الموارد البشرية في شركة "Butter Bakery" (مخبوزات) في المملكة العربية السعودية.
ستحلّل لقطة بيانات HR وتُولّد رؤى عملية مختصرة بالعربية الفصحى للإدارة.

الإخراج إلزامياً JSON بالشكل:
{
  "insights": [
    {
      "id": "kebab-case-id-قصير",
      "iconName": "<أحد القيم: ${allowedIcons.join(", ")}>",
      "tone": "warning" | "info" | "success",
      "title": "عنوان قصير (≤ 70 حرف) يتضمن الأرقام إن أمكن",
      "detail": "شرح مختصر (≤ 180 حرف) يفسّر السبب أو التأثير ويقترح إجراءً واضحاً",
      "action": { "label": "نص الزر", "href": "/path" }
    }
  ]
}

قواعد صارمة:
- 3 إلى 5 رؤى فقط، مرتّبة حسب الأولوية (الأخطر أولاً).
- "tone": warning للمخاطر/التأخّر، info للحياد/المتابعة، success للإنجازات.
- استخدم الأرقام الفعلية من اللقطة وقارن بالشهر السابق إن وُجد.
- لا تخترع أرقاماً غير موجودة في اللقطة.
- روابط الإجراءات يجب أن تكون من القائمة المسموحة:
  /hr/applications, /hr/job-offers, /branch-employees, /attendance-dashboard,
  /hr/employee-documents, /hr/warnings, /employee-reports, /organizational-structure,
  /hr/leaves, /hr/advances, /hr/eos
- اعتبر السياق السعودي: الإقامات والشهادات الصحية وامتثال البلدية أولوية قصوى.
- اللهجة: مهنية مباشرة، لا حشو، لا اعتذار، لا إيموجي.`;

      const userPrompt = `لقطة بيانات HR الحالية:\n${JSON.stringify(snapshot, null, 2)}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return res.status(502).json({ error: "AI_PARSE_FAILED", message: "تعذّر تحليل ردّ المساعد الذكي." });
      }

      const insights = Array.isArray(parsed?.insights) ? parsed.insights : [];
      const cleaned = insights
        .filter((x: any) => x && typeof x.title === "string" && typeof x.detail === "string")
        .slice(0, 5)
        .map((x: any, i: number) => ({
          id: typeof x.id === "string" && x.id.trim() ? x.id : `ai-${i + 1}`,
          iconName: allowedIcons.includes(x.iconName) ? x.iconName : "Lightbulb",
          tone: ["warning", "info", "success"].includes(x.tone) ? x.tone : "info",
          title: String(x.title).slice(0, 140),
          detail: String(x.detail).slice(0, 300),
          action:
            x.action && typeof x.action?.label === "string" && typeof x.action?.href === "string"
              && ALLOWED_AI_HREFS.has(x.action.href)
              ? { label: x.action.label.slice(0, 60), href: x.action.href }
              : undefined,
        }));

      res.json({
        insights: cleaned,
        generatedAt: new Date().toISOString(),
        model: "gpt-5",
      });
    } catch (e: any) {
      console.error("[hr/ai-insights] error:", e);
      const msg = e?.message || "فشل توليد الرؤى بالذكاء الاصطناعي";
      const status = e?.status === 401 || e?.status === 403 ? 503 : 500;
      res.status(status).json({ error: "AI_FAILED", message: msg });
    }
  });
}
