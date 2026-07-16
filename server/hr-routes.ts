import type { Express } from "express";
import crypto from "node:crypto";
import { db } from "./db";
import { eq, and, ne, desc, sql, inArray, gte, lte, lt } from "drizzle-orm";
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
  cashierSalesJournals,
  leaveRequests,
  leaveBalances,
  leaveSettlements,
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
  chartOfAccounts,
  accountingJournalEntries,
  journalEntryLines,
  approvalWorkflows,
  approvalWorkflowSteps,
  publicHolidays,
  insertPublicHolidaySchema,
  leavePlanEntries,
  insertLeavePlanEntrySchema,
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
  computeLeaveDaysWithHolidays,
  getSickTierBreakdown,
  findOverlappingLeave,
  getLeaveBalanceSummary,
  getAccruedLeaveBalance,
  computeAccruedLeaveBalance,
  suggestedEntitlement,
  syncAttendanceForLeave,
  reverseAttendanceForLeave,
  getApplicableLeaveChain,
  resolveReviewerJobTitle, reviewerMatchesStep,
  markOverdueAbsences,
  clearOverdueAbsencesFrom,
  addDaysIso,
  isoDiffDays,
  runLeaveCarryover,
} from "./leave-helpers";
import { storage } from "./storage";

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
          settlementId: leaveSettlements.id,
          settlementAmount: leaveSettlements.finalAmount,
          settlementDays: leaveSettlements.settledDays,
        })
        .from(leaveRequests)
        .leftJoin(branchEmployees, eq(leaveRequests.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(leaveRequests.branchId, branches.id))
        .leftJoin(users, eq(leaveRequests.reviewedBy, users.id))
        .leftJoin(leaveSettlements, and(
          eq(leaveSettlements.leaveRequestId, leaveRequests.id),
          eq(leaveSettlements.status, "active"),
        ))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(leaveRequests.createdAt))
        .limit(1000);

      res.json(rows.map(r => ({
        ...r.leave,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
        reviewerName: r.reviewerName,
        settlementId: r.settlementId,
        settlementAmount: r.settlementAmount,
        settlementDays: r.settlementDays,
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
      // لا يجوز تسجيل إجازة لموظف منتهي الخدمة أو غير نشط
      if (emp.status === "terminated" || emp.status === "inactive") {
        return res.status(400).json({ error: "لا يمكن تسجيل إجازة لموظف غير نشط أو منتهي الخدمة" });
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
      // إعادة احتساب الأيام على الخادم (لا نثق بالعميل) — مع استثناء العطلات الرسمية
      const { totalDays, workingDays } = await computeLeaveDaysWithHolidays(parsed.startDate, parsed.endDate);
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
  app.post("/api/hr/leaves/:id/review", isAuthenticated, requirePermission("hr_leaves", "approve"), async (req, res) => {
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
            if (!reviewerMatchesStep({ reviewerJobTitle, reviewerRole: user?.role, expectedJobTitle: expected.jobTitle })) {
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
      if (decision.decision === "approved" && !decision.allowOverBalance && existing.leaveType !== "unpaid") {
        // للإجازة السنوية مع نظام الاستحقاق التعاقدي: التحقق من الرصيد المستحق حتى تاريخه
        const useAccrual = existing.leaveType === "annual" && emp && (emp as any).annualLeaveDays != null;
        if (useAccrual) {
          const acc = await getAccruedLeaveBalance(emp as any);
          if (acc.remainingDays - Number(existing.totalDays) < 0) {
            return res.status(409).json({
              error: "balance_exceeded",
              message: `الرصيد المستحق حتى تاريخه (${acc.remainingDays} يوم) لا يكفي لهذه الإجازة (${existing.totalDays} يوم).`,
              accrual: acc,
              requestedDays: Number(existing.totalDays),
            });
          }
        } else {
          const bal = await getLeaveBalanceSummary(existing.branchEmployeeId, year, existing.leaveType, emp?.hireDate);
          const projected = bal.remainingDays - Number(existing.totalDays);
          if (projected < 0) {
            return res.status(409).json({
              error: "balance_exceeded",
              message: `الرصيد المتبقي (${bal.remainingDays} يوم) لا يكفي لهذه الإجازة (${existing.totalDays} يوم).`,
              balance: bal,
              requestedDays: Number(existing.totalDays),
            });
          }
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

      let finalStatus: "approved" | "rejected" | "pending" = decision.decision;
      let nextLevel = existing.currentLevel;
      // إذا اعتُمد ولكن تبقّت مستويات موافقة أعلى → ينتقل للمستوى التالي ويبقى معلّقاً
      if (decision.decision === "approved" && existing.currentLevel < existing.requiredLevels) {
        finalStatus = "pending";
        nextLevel = existing.currentLevel + 1;
      }

      const isFinal = finalStatus !== "pending";
      // عند الاعتماد النهائي لإجازة مرضية: حفظ تفصيل مراحل الأجر (المادة 117)
      let sickTiers: any = undefined;
      if (finalStatus === "approved" && existing.leaveType === "sick") {
        try {
          sickTiers = await getSickTierBreakdown(existing.branchEmployeeId, existing.startDate, existing.endDate, existing.id);
        } catch (err) { console.error("[hr/leaves] sick tier compute failed:", err); }
      }
      const [updated] = await db.update(leaveRequests).set({
        status: finalStatus,
        currentLevel: nextLevel,
        approvalFlow: flow as any,
        reviewedBy: isFinal ? userId : existing.reviewedBy,
        reviewedAt: isFinal ? now : existing.reviewedAt,
        reviewerNote: decision.note ?? existing.reviewerNote,
        ...(sickTiers ? { sickTierBreakdown: sickTiers as any } : {}),
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
  app.post("/api/hr/leaves/apply-chains", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
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
  app.patch("/api/hr/leaves/:id/dates", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
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
      const { totalDays, workingDays } = await computeLeaveDaysWithHolidays(body.startDate, body.endDate);
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

  app.patch("/api/hr/leaves/:id", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
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

  app.delete("/api/hr/leaves/:id", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      // الحذف النهائي لطلب إجازة مقصور على الأدمن (طلب صاحب النظام).
      const requester: any = (req as any).currentUser;
      if (requester?.role !== "admin" && requester?.role !== "super_admin") {
        return res.status(403).json({ error: "حذف طلبات الإجازة متاح للأدمن فقط" });
      }
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
  // دورة الخروج والعودة + تصفية الرصيد
  // ------------------------------------------------------------------

  // تأكيد مباشرة الخروج (بداية الإجازة فعلياً)
  app.post("/api/hr/leaves/:id/confirm-exit", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const body = z.object({
        actualExitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح"),
        note: z.string().optional(),
      }).parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status !== "approved") {
        return res.status(400).json({ error: "لا يمكن تأكيد الخروج إلا لإجازة معتمدة" });
      }
      if (existing.exitConfirmedAt) {
        return res.status(400).json({ error: "تم تأكيد الخروج مسبقاً لهذه الإجازة" });
      }
      const userId = getUserId(req) || undefined;
      const [updated] = await db.update(leaveRequests).set({
        actualExitDate: body.actualExitDate,
        exitConfirmedBy: userId,
        exitConfirmedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(leaveRequests.id, id)).returning();

      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      await auditEvent({
        req, module: "hr_leaves", entityId: id, action: "confirm_exit",
        entityName: emp?.employeeName, branchId: existing.branchId,
        description: `تأكيد مباشرة الخروج للإجازة (${existing.startDate}→${existing.endDate}) — الخروج الفعلي: ${body.actualExitDate}`,
        details: { actualExitDate: body.actualExitDate, note: body.note },
        targetId: existing.branchEmployeeId,
      });
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leaves] confirm-exit error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تسجيل مباشرة العمل (العودة من الإجازة) — مع حساب أيام التأخير وتسجيلها غياباً
  app.post("/api/hr/leaves/:id/confirm-return", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const body = z.object({
        actualReturnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح"),
        note: z.string().optional(),
      }).parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status !== "approved") {
        return res.status(400).json({ error: "لا يمكن تسجيل المباشرة إلا لإجازة معتمدة" });
      }
      if (existing.returnConfirmedAt) {
        return res.status(400).json({ error: "تم تسجيل المباشرة مسبقاً لهذه الإجازة" });
      }
      if (body.actualReturnDate < existing.startDate) {
        return res.status(400).json({ error: "تاريخ المباشرة قبل بداية الإجازة" });
      }

      // موعد العودة المتوقع = اليوم التالي لنهاية الإجازة
      const expectedReturn = addDaysIso(existing.endDate, 1);
      const lateDays = Math.max(0, isoDiffDays(expectedReturn, body.actualReturnDate));
      const returnStatus = lateDays > 0 ? "late" : (body.actualReturnDate < expectedReturn ? "early" : "on_time");

      // أيام التأخير (من اليوم التالي للنهاية حتى ما قبل المباشرة) تُسجَّل غياباً
      // تُنفَّذ تعديلات الحضور أولاً: إن فشلت، لا تُسجَّل المباشرة ويبقى المجدول يتابع الإجازة
      let absencesAdded = 0;
      let absencesCleared = 0;
      if (lateDays > 0) {
        absencesAdded = await markOverdueAbsences(existing, addDaysIso(body.actualReturnDate, -1));
      }
      // إزالة أي غياب تلقائي سجّله المجدول من يوم المباشرة فصاعداً
      absencesCleared = await clearOverdueAbsencesFrom(id, body.actualReturnDate);

      const userId = getUserId(req) || undefined;
      const [updated] = await db.update(leaveRequests).set({
        actualReturnDate: body.actualReturnDate,
        returnConfirmedBy: userId,
        returnConfirmedAt: new Date(),
        returnStatus,
        lateDays,
        updatedAt: new Date(),
      }).where(eq(leaveRequests.id, id)).returning();

      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      await auditEvent({
        req, module: "hr_leaves", entityId: id, action: "confirm_return",
        entityName: emp?.employeeName, branchId: existing.branchId,
        description: `تسجيل مباشرة العمل — العودة الفعلية: ${body.actualReturnDate}${lateDays > 0 ? ` (تأخير ${lateDays} يوم)` : ""}`,
        details: { actualReturnDate: body.actualReturnDate, expectedReturn, lateDays, returnStatus, absencesAdded, absencesCleared, note: body.note },
        targetId: existing.branchEmployeeId,
      });
      res.json({ ...updated, expectedReturn, absencesAdded, absencesCleared });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leaves] confirm-return error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تغطية الفرع خلال فترة الطلب: كم موظفاً آخر في نفس الفرع لديه إجازة معتمدة متداخلة؟
  app.get("/api/hr/leaves/:id/coverage", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }

      // الموظفون النشطون في الفرع
      const activeEmps = await db
        .select({ id: branchEmployees.id, employeeName: branchEmployees.employeeName })
        .from(branchEmployees)
        .where(and(eq(branchEmployees.branchId, existing.branchId), eq(branchEmployees.status, "active")));
      const totalActive = activeEmps.length;
      const nameById = new Map(activeEmps.map(e => [e.id, e.employeeName]));

      // إجازات معتمدة متداخلة مع فترة الطلب لموظفين آخرين في نفس الفرع
      const overlapping = await db
        .select({
          id: leaveRequests.id,
          branchEmployeeId: leaveRequests.branchEmployeeId,
          leaveType: leaveRequests.leaveType,
          startDate: leaveRequests.startDate,
          endDate: leaveRequests.endDate,
        })
        .from(leaveRequests)
        .where(and(
          eq(leaveRequests.branchId, existing.branchId),
          eq(leaveRequests.status, "approved"),
          ne(leaveRequests.branchEmployeeId, existing.branchEmployeeId),
          lte(leaveRequests.startDate, existing.endDate),
          gte(leaveRequests.endDate, existing.startDate),
        ));

      const onLeave = overlapping
        .filter(l => nameById.has(l.branchEmployeeId))
        .map(l => ({
          employeeName: nameById.get(l.branchEmployeeId),
          leaveType: l.leaveType,
          startDate: l.startDate,
          endDate: l.endDate,
        }));
      const onLeaveCount = new Set(overlapping.map(l => l.branchEmployeeId)).size;
      // نسبة الغياب المتوقعة لو اعتُمد هذا الطلب (الموظف الحالي + المتداخلون)
      const absentIfApproved = onLeaveCount + 1;
      const absencePercent = totalActive > 0 ? Math.round((absentIfApproved / totalActive) * 100) : 0;

      res.json({
        branchId: existing.branchId,
        totalActive,
        onLeaveCount,
        absentIfApproved,
        absencePercent,
        overlapping: onLeave.slice(0, 20),
      });
    } catch (e: any) {
      console.error("[hr/leaves/:id/coverage] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // إنشاء قيد مخصص الإجازات (التزام أرصدة الإجازات السنوية) — قيد محاسبي مسودة
  app.post("/api/hr/leaves/provision-journal", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
      const currentYear = parseInt(today.slice(0, 4), 10);
      const year = Number(req.body?.year) || currentYear;
      if (!Number.isInteger(year) || year < 2020 || year > currentYear + 1) {
        return res.status(400).json({ error: "سنة غير صالحة" });
      }
      const refId = `leave-provision-${year}-${branchIds === null ? "all" : branchIds.slice().sort().join(",")}`;
      const replace = !!req.body?.replace;

      // التأكد من وجود حسابي المخصص في شجرة الحسابات
      await db.insert(chartOfAccounts).values([
        { accountCode: "2310", accountName: "مخصص الإجازات المستحقة", accountType: "liability", parentCode: "2300", level: 2, isActive: "true", description: "التزام أرصدة الإجازات السنوية غير المستخدمة" },
        { accountCode: "5210", accountName: "مصروف مخصص الإجازات", accountType: "expense", parentCode: "5200", level: 2, isActive: "true", description: "مصروف تكوين مخصص الإجازات السنوية" },
      ]).onConflictDoNothing({ target: chartOfAccounts.accountCode });

      // حساب الالتزام (نفس منطق لوحة الإحصائيات): المتبقي من الرصيد السنوي × (الراتب ÷ 30)
      const empScope = branchIds === null ? undefined : inArray(branchEmployees.branchId, branchIds);
      const activeEmps = await db
        .select({ id: branchEmployees.id, totalSalary: branchEmployees.totalSalary, hireDate: branchEmployees.hireDate })
        .from(branchEmployees)
        .where(empScope !== undefined ? and(eq(branchEmployees.status, "active"), empScope) : eq(branchEmployees.status, "active"));
      const activeIds = activeEmps.map(e => e.id);
      const balRows = activeIds.length > 0 ? await db.select().from(leaveBalances)
        .where(and(eq(leaveBalances.year, year), eq(leaveBalances.leaveType, "annual"), inArray(leaveBalances.branchEmployeeId, activeIds))) : [];
      const balByEmp = new Map(balRows.map(b => [b.branchEmployeeId, b]));
      const approvedAnnual = activeIds.length > 0 ? await db.select().from(leaveRequests)
        .where(and(
          eq(leaveRequests.status, "approved"),
          eq(leaveRequests.leaveType, "annual"),
          inArray(leaveRequests.branchEmployeeId, activeIds),
          lte(leaveRequests.startDate, `${year}-12-31`),
          gte(leaveRequests.endDate, `${year}-01-01`),
        )) : [];
      const usedByEmp = new Map<number, number>();
      for (const l of approvedAnnual) {
        const segStart = l.startDate > `${year}-01-01` ? l.startDate : `${year}-01-01`;
        const segEnd = l.endDate < `${year}-12-31` ? l.endDate : `${year}-12-31`;
        if (segStart > segEnd) continue;
        const days = isoDiffDays(segStart, segEnd) + 1;
        usedByEmp.set(l.branchEmployeeId, (usedByEmp.get(l.branchEmployeeId) || 0) + days);
      }
      let liabilityDays = 0;
      let liabilityAmount = 0;
      let liabilityEmployees = 0;
      for (const e of activeEmps) {
        const b: any = balByEmp.get(e.id);
        const entitled = b ? Number(b.entitledDays) : suggestedEntitlement(e.hireDate, year);
        const remaining = entitled
          + (b ? Number(b.carriedOverDays) : 0)
          + (b ? Number(b.adjustmentDays) : 0)
          - (b ? Number(b.settledDays ?? 0) : 0)
          - (usedByEmp.get(e.id) || 0);
        if (remaining > 0) {
          liabilityDays += remaining;
          liabilityAmount += remaining * (Number(e.totalSalary || 0) / 30);
          liabilityEmployees++;
        }
      }
      liabilityAmount = Math.round(liabilityAmount * 100) / 100;
      if (liabilityAmount <= 0) {
        return res.status(400).json({ error: "لا يوجد التزام إجازات موجب لإنشاء قيد" });
      }

      const amountStr = liabilityAmount.toFixed(2);
      const desc = `قيد مخصص الإجازات السنوية ${year} — ${liabilityEmployees} موظف / ${Math.round(liabilityDays)} يوم`;

      // معاملة واحدة + قفل استشاري يمنع التكرار حتى مع طلبات متزامنة
      const txResult = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${refId}))`);

        const [existing] = await tx.select().from(accountingJournalEntries)
          .where(and(eq(accountingJournalEntries.referenceType, "leave_provision"), eq(accountingJournalEntries.referenceId, refId)));
        if (existing && !replace) {
          return { conflict: existing } as const;
        }

        // ترقيم القيد داخل نفس المعاملة (نفس صيغة generateNextEntryNumber)
        const [{ cnt }] = await tx.select({ cnt: sql<number>`count(*)::int` }).from(accountingJournalEntries);
        const now = new Date();
        const entryNumber = `JE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(cnt + 1).padStart(5, "0")}`;

        // عند الاستبدال: نُعلّم القيد القديم كمستبدَل (بتغيير مرجعه) قبل إنشاء الجديد
        if (existing) {
          await tx.update(accountingJournalEntries)
            .set({ referenceId: `${refId}-superseded-${existing.id}` })
            .where(eq(accountingJournalEntries.id, existing.id));
        }

        const [created] = await tx.insert(accountingJournalEntries).values({
          entryNumber,
          entryDate: today,
          entryType: "provision",
          description: desc,
          branchId: branchIds !== null && branchIds.length === 1 ? branchIds[0] : null,
          referenceType: "leave_provision",
          referenceId: refId,
          totalDebit: amountStr,
          totalCredit: amountStr,
          vatAmount: "0",
          status: "draft",
          reconciliationStatus: "pending",
        }).returning();
        await tx.insert(journalEntryLines).values([
          { journalEntryId: created.id, lineNumber: 1, accountCode: "5210", accountName: "مصروف مخصص الإجازات", description: desc, debitAmount: amountStr, creditAmount: "0" },
          { journalEntryId: created.id, lineNumber: 2, accountCode: "2310", accountName: "مخصص الإجازات المستحقة", description: desc, debitAmount: "0", creditAmount: amountStr },
        ]);
        return { created, replaced: !!existing } as const;
      });

      if ("conflict" in txResult) {
        return res.status(409).json({
          error: `يوجد قيد مخصص إجازات لسنة ${year} مسبقاً (${txResult.conflict.entryNumber}). أعد المحاولة مع خيار الاستبدال لإنشاء قيد جديد.`,
          existingEntryNumber: txResult.conflict.entryNumber,
        });
      }

      await auditEvent({
        req,
        module: "hr_leaves",
        entityId: txResult.created.id,
        action: "create",
        entityName: txResult.created.entryNumber,
        description: `إنشاء قيد مخصص الإجازات السنوية ${year}`,
        details: { year, entryNumber: txResult.created.entryNumber, liabilityAmount, liabilityDays, liabilityEmployees, replaced: txResult.replaced },
      });

      res.json({ entry: txResult.created, year, liabilityAmount, liabilityDays: Math.round(liabilityDays), liabilityEmployees, replaced: txResult.replaced });
    } catch (e: any) {
      console.error("[hr/leaves/provision-journal] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // معاينة تصفية الرصيد (قبل التنفيذ)
  app.get("/api/hr/leaves/:id/settlement-preview", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.leaveType !== "annual") {
        return res.status(400).json({ error: "التصفية متاحة للإجازة السنوية فقط" });
      }
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });

      const year = parseInt(existing.startDate.slice(0, 4), 10);
      const bal = await getLeaveBalanceSummary(existing.branchEmployeeId, year, "annual", emp.hireDate);
      const grossSalary = Number(emp.totalSalary || emp.salary || 0);
      const divisor = bal.entitledDays >= 30 ? 30 : 21;
      const dailyRate = divisor > 0 ? grossSalary / divisor : 0;
      const suggestedDays = Math.max(0, bal.remainingDays);
      const [activeSettlement] = await db.select().from(leaveSettlements)
        .where(and(eq(leaveSettlements.leaveRequestId, id), eq(leaveSettlements.status, "active")));

      res.json({
        leaveRequestId: id,
        employeeName: emp.employeeName,
        year,
        balance: bal,
        grossSalary,
        divisor,
        dailyRate: Math.round(dailyRate * 100) / 100,
        suggestedDays,
        calculatedAmount: Math.round(dailyRate * suggestedDays * 100) / 100,
        alreadySettled: !!activeSettlement,
        settlement: activeSettlement || null,
      });
    } catch (e: any) {
      console.error("[hr/leaves] settlement-preview error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تنفيذ تصفية الرصيد (سند صرف بدل إجازة) — يخصم الأيام من الرصيد
  app.post("/api/hr/leaves/:id/settlement", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const body = z.object({
        days: z.number().positive("عدد الأيام يجب أن يكون موجباً").max(365),
        manualAmount: z.number().min(0).optional(), // مبلغ يدوي (اختياري)
        settlementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        note: z.string().optional(),
      }).parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
      if (!existing) return res.status(404).json({ error: "الطلب غير موجود" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status !== "approved") {
        return res.status(400).json({ error: "التصفية متاحة لإجازة معتمدة فقط" });
      }
      if (existing.leaveType !== "annual") {
        return res.status(400).json({ error: "التصفية متاحة للإجازة السنوية فقط" });
      }
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });

      const year = parseInt(existing.startDate.slice(0, 4), 10);
      const bal = await getLeaveBalanceSummary(existing.branchEmployeeId, year, "annual", emp.hireDate);
      if (body.days > bal.remainingDays) {
        return res.status(400).json({
          error: `عدد الأيام المطلوب تصفيتها (${body.days}) أكبر من الرصيد المتبقي (${bal.remainingDays})`,
          balance: bal,
        });
      }

      const grossSalary = Number(emp.totalSalary || emp.salary || 0);
      if (grossSalary <= 0) {
        return res.status(400).json({ error: "لا يوجد راتب مسجّل للموظف — لا يمكن حساب مبلغ التصفية" });
      }
      const divisor = bal.entitledDays >= 30 ? 30 : 21;
      const dailyRate = grossSalary / divisor;
      const calculatedAmount = Math.round(dailyRate * body.days * 100) / 100;
      const finalAmount = body.manualAmount !== undefined ? body.manualAmount : calculatedAmount;
      const settlementDate = body.settlementDate || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
      const userId = getUserId(req) || undefined;

      const settlement = await db.transaction(async (tx) => {
        const [ins] = await tx.insert(leaveSettlements).values({
          leaveRequestId: id,
          branchEmployeeId: existing.branchEmployeeId,
          branchId: existing.branchId,
          year,
          leaveType: "annual",
          settledDays: body.days,
          divisor,
          grossSalary,
          dailyRate: Math.round(dailyRate * 100) / 100,
          calculatedAmount,
          finalAmount,
          isManualAmount: body.manualAmount !== undefined,
          settlementDate,
          note: body.note || null,
          createdBy: userId,
        }).returning();

        // خصم الأيام من الرصيد (upsert على مفتاح الموظف/السنة/النوع)
        const [balRow] = await tx.select().from(leaveBalances).where(and(
          eq(leaveBalances.branchEmployeeId, existing.branchEmployeeId),
          eq(leaveBalances.year, year),
          eq(leaveBalances.leaveType, "annual"),
        ));
        if (balRow) {
          await tx.update(leaveBalances).set({
            settledDays: sql`${leaveBalances.settledDays} + ${body.days}`,
            updatedAt: new Date(),
          }).where(eq(leaveBalances.id, balRow.id));
        } else {
          await tx.insert(leaveBalances).values({
            branchEmployeeId: existing.branchEmployeeId,
            branchId: existing.branchId,
            year,
            leaveType: "annual",
            entitledDays: bal.entitledDays,
            carriedOverDays: bal.carriedOverDays,
            adjustmentDays: bal.adjustmentDays,
            settledDays: body.days,
            createdBy: userId,
          } as any);
        }
        return ins;
      });

      await auditEvent({
        req, module: "hr_leaves", entityId: id, action: "settlement",
        entityName: emp.employeeName, branchId: existing.branchId,
        description: `تصفية رصيد إجازة: ${body.days} يوم × ${Math.round(dailyRate * 100) / 100} = ${finalAmount} ريال${body.manualAmount !== undefined ? " (مبلغ يدوي)" : ""}`,
        details: { settlementId: settlement.id, days: body.days, divisor, grossSalary, dailyRate, calculatedAmount, finalAmount, isManual: body.manualAmount !== undefined },
        targetId: existing.branchEmployeeId,
      });
      res.json(settlement);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      const errText = `${e?.message || ""} ${e?.cause?.message || ""} ${e?.cause?.constraint || ""}`;
      if (errText.includes("uq_leave_settlements_request_active")) {
        return res.status(409).json({ error: "توجد تصفية نشطة مسبقاً لهذه الإجازة" });
      }
      console.error("[hr/leaves] settlement error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // إلغاء تصفية (يعيد الأيام للرصيد)
  app.post("/api/hr/leave-settlements/:id/cancel", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const body = z.object({ reason: z.string().min(3, "يجب ذكر سبب الإلغاء") }).parse(req.body);
      const { branchIds } = getBranchScope(req);
      const [existing] = await db.select().from(leaveSettlements).where(eq(leaveSettlements.id, id));
      if (!existing) return res.status(404).json({ error: "التصفية غير موجودة" });
      if (branchIds !== null && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية" });
      }
      if (existing.status !== "active") {
        return res.status(400).json({ error: "هذه التصفية ملغاة مسبقاً" });
      }
      const userId = getUserId(req) || undefined;
      const updated = await db.transaction(async (tx) => {
        const [upd] = await tx.update(leaveSettlements).set({
          status: "cancelled",
          cancelledBy: userId,
          cancelledAt: new Date(),
          cancelReason: body.reason,
        }).where(and(eq(leaveSettlements.id, id), eq(leaveSettlements.status, "active"))).returning();
        if (!upd) throw new Error("التصفية ملغاة مسبقاً");
        await tx.update(leaveBalances).set({
          settledDays: sql`GREATEST(${leaveBalances.settledDays} - ${existing.settledDays}, 0)`,
          updatedAt: new Date(),
        }).where(and(
          eq(leaveBalances.branchEmployeeId, existing.branchEmployeeId),
          eq(leaveBalances.year, existing.year),
          eq(leaveBalances.leaveType, existing.leaveType),
        ));
        return upd;
      });

      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, existing.branchEmployeeId));
      await auditEvent({
        req, module: "hr_leaves", entityId: existing.leaveRequestId, action: "settlement_cancel",
        entityName: emp?.employeeName, branchId: existing.branchId,
        description: `إلغاء تصفية رصيد إجازة (${existing.settledDays} يوم / ${existing.finalAmount} ريال): ${body.reason}`,
        details: { settlementId: id, reason: body.reason, restoredDays: existing.settledDays },
        targetId: existing.branchEmployeeId,
      });
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leave-settlements] cancel error:", e);
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
      if (leaveType === "unpaid") {
        return res.status(400).json({ error: "الإجازة بدون راتب لا ترتبط برصيد إجازات" });
      }
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

      // تحميل جماعي بدل استعلامين لكل موظف (كان بطيئاً جداً مع كثرة الموظفين)
      const empIds = emps.map((e) => e.id);
      if (empIds.length === 0) return res.json([]);

      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      const [balRows, approvedRows] = await Promise.all([
        db.select().from(leaveBalances).where(and(
          inArray(leaveBalances.branchEmployeeId, empIds),
          eq(leaveBalances.year, year),
          eq(leaveBalances.leaveType, leaveType),
        )),
        db.select({
          branchEmployeeId: leaveRequests.branchEmployeeId,
          startDate: leaveRequests.startDate,
          endDate: leaveRequests.endDate,
        }).from(leaveRequests).where(and(
          inArray(leaveRequests.branchEmployeeId, empIds),
          eq(leaveRequests.leaveType, leaveType),
          eq(leaveRequests.status, "approved"),
          lte(leaveRequests.startDate, yearEnd),
          gte(leaveRequests.endDate, yearStart),
        )),
      ]);

      const balByEmp = new Map(balRows.map((r) => [r.branchEmployeeId, r]));
      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      const usedByEmp = new Map<number, number>();
      for (const lr of approvedRows) {
        // نحتسب فقط الأيام الواقعة داخل السنة (تقسيم الإجازات العابرة بين سنتين)
        const segStart = lr.startDate > yearStart ? lr.startDate : yearStart;
        const segEnd = lr.endDate < yearEnd ? lr.endDate : yearEnd;
        const days = Math.round((new Date(segEnd).getTime() - new Date(segStart).getTime()) / MS_PER_DAY) + 1;
        if (days > 0) usedByEmp.set(lr.branchEmployeeId, (usedByEmp.get(lr.branchEmployeeId) || 0) + days);
      }

      const results = emps.map((e) => {
        const row = balByEmp.get(e.id);
        const usedDays = usedByEmp.get(e.id) || 0;
        const entitledDays = row ? Number(row.entitledDays) : suggestedEntitlement(e.hireDate, year);
        const carriedOverDays = row ? Number(row.carriedOverDays) : 0;
        const adjustmentDays = row ? Number(row.adjustmentDays) : 0;
        const settledDays = row ? Number((row as any).settledDays ?? 0) : 0;
        return {
          branchEmployeeId: e.id,
          year,
          leaveType,
          entitledDays,
          carriedOverDays,
          adjustmentDays,
          settledDays,
          usedDays,
          remainingDays: entitledDays + carriedOverDays + adjustmentDays - usedDays - settledDays,
          note: row?.note ?? null,
          hasRow: !!row,
          employeeName: e.employeeName,
          jobTitle: e.jobTitle,
          branchId: e.branchId,
          branchName: e.branchName,
          hireDate: e.hireDate,
          suggestedEntitlement: suggestedEntitlement(e.hireDate, year),
        };
      });
      res.json(results);
    } catch (e: any) {
      console.error("[hr/leave-balances] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ===== الرصيد التراكمي "حتى تاريخه" (النظام التعاقدي) =====
  // قائمة أرصدة الإجازة السنوية المستحقة حتى اليوم لكل الموظفين النشطين (ضمن نطاق الفروع)
  app.get("/api/hr/leave-accrual", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      if (branchIds !== null && branchIds.length === 0) return res.json([]);
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
          annualLeaveDays: branchEmployees.annualLeaveDays,
          leaveOpeningBalance: branchEmployees.leaveOpeningBalance,
          leaveOpeningBalanceDate: branchEmployees.leaveOpeningBalanceDate,
        })
        .from(branchEmployees)
        .leftJoin(branches, eq(branchEmployees.branchId, branches.id))
        .where(and(...conds))
        .orderBy(branchEmployees.employeeName)
        .limit(2000);

      const empIds = emps.map((e) => e.id);
      if (empIds.length === 0) return res.json([]);

      // تحميل جماعي (استعلامان فقط) بدل استعلامين لكل موظف
      const [approvedRows, settlementRows] = await Promise.all([
        db.select({
          branchEmployeeId: leaveRequests.branchEmployeeId,
          startDate: leaveRequests.startDate,
          endDate: leaveRequests.endDate,
        }).from(leaveRequests).where(and(
          inArray(leaveRequests.branchEmployeeId, empIds),
          eq(leaveRequests.leaveType, "annual"),
          eq(leaveRequests.status, "approved"),
        )),
        db.select({
          branchEmployeeId: leaveSettlements.branchEmployeeId,
          settledDays: leaveSettlements.settledDays,
          settlementDate: leaveSettlements.settlementDate,
        }).from(leaveSettlements).where(and(
          inArray(leaveSettlements.branchEmployeeId, empIds),
          eq(leaveSettlements.leaveType, "annual"),
          eq(leaveSettlements.status, "active"),
        )),
      ]);
      const leavesByEmp = new Map<number, { startDate: string; endDate: string }[]>();
      for (const r of approvedRows) {
        const arr = leavesByEmp.get(r.branchEmployeeId) || [];
        arr.push({ startDate: r.startDate, endDate: r.endDate });
        leavesByEmp.set(r.branchEmployeeId, arr);
      }
      const settlementsByEmp = new Map<number, { settledDays: number | null; settlementDate: string }[]>();
      for (const r of settlementRows) {
        const arr = settlementsByEmp.get(r.branchEmployeeId) || [];
        arr.push({ settledDays: r.settledDays, settlementDate: r.settlementDate });
        settlementsByEmp.set(r.branchEmployeeId, arr);
      }

      const results = emps.map((e) => {
        const acc = computeAccruedLeaveBalance(e, leavesByEmp.get(e.id) || [], settlementsByEmp.get(e.id) || []);
        return {
          ...acc,
          employeeName: e.employeeName,
          jobTitle: e.jobTitle,
          branchId: e.branchId,
          branchName: e.branchName,
          hireDate: e.hireDate,
          // القيم الخام المخزّنة (للتعديل في النموذج)
          rawAnnualLeaveDays: e.annualLeaveDays,
          rawOpeningBalance: e.leaveOpeningBalance,
          rawOpeningBalanceDate: e.leaveOpeningBalanceDate,
        };
      });
      res.json(results);
    } catch (e: any) {
      console.error("[hr/leave-accrual] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تحديث بيانات الاستحقاق التعاقدي لموظف: أيام العقد + الرصيد المرحل وتاريخه
  app.patch("/api/hr/leave-accrual/:employeeId", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId, 10);
      if (!Number.isFinite(employeeId)) return res.status(400).json({ error: "معرّف غير صحيح" });

      const schema = z.object({
        annualLeaveDays: z.number().min(0).max(90).nullable(),
        leaveOpeningBalance: z.number().min(-365).max(365).nullable(),
        leaveOpeningBalanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح").nullable(),
      }).refine(
        (v) => (v.leaveOpeningBalance == null) === (v.leaveOpeningBalanceDate == null),
        { message: "الرصيد المرحل وتاريخه يجب إدخالهما معاً أو تركهما فارغين معاً" },
      );
      const body = schema.parse({
        annualLeaveDays: req.body.annualLeaveDays === "" || req.body.annualLeaveDays == null ? null : Number(req.body.annualLeaveDays),
        leaveOpeningBalance: req.body.leaveOpeningBalance === "" || req.body.leaveOpeningBalance == null ? null : Number(req.body.leaveOpeningBalance),
        leaveOpeningBalanceDate: req.body.leaveOpeningBalanceDate || null,
      });

      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, employeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      const f = getEffectiveBranchFilter(req);
      if (f.branchIds !== null && !f.branchIds.includes(emp.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية على هذا الفرع" });
      }

      await db.update(branchEmployees).set({
        annualLeaveDays: body.annualLeaveDays,
        leaveOpeningBalance: body.leaveOpeningBalance,
        leaveOpeningBalanceDate: body.leaveOpeningBalanceDate,
      } as any).where(eq(branchEmployees.id, employeeId));

      const acc = await getAccruedLeaveBalance({ ...emp, ...body } as any);
      res.json({ success: true, accrual: acc });
    } catch (e: any) {
      if (e?.issues) return res.status(400).json({ error: e.issues[0]?.message || "بيانات غير صحيحة" });
      console.error("[hr/leave-accrual] update error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // رصيد موظف واحد (لعرض البطاقة عند الإنشاء/الطباعة)
  app.get("/api/hr/leave-balances/:employeeId", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const employeeId = parseInt(req.params.employeeId, 10);
      const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
      const leaveType = (req.query.type as string) || "annual";
      if (leaveType === "unpaid") {
        return res.status(400).json({ error: "الإجازة بدون راتب لا ترتبط برصيد إجازات" });
      }
      const { branchIds } = getBranchScope(req);
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, employeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const bal = await getLeaveBalanceSummary(employeeId, year, leaveType, emp.hireDate);
      res.json({ ...bal, suggestedEntitlement: suggestedEntitlement(emp.hireDate, year) });
    } catch (e: any) {
      console.error("[hr/leave-balances/:id] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // إنشاء/تحديث رصيد (تعيين المستحق/المرحّل/التعديل اليدوي)
  app.post("/api/hr/leave-balances", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      // branchId لا يُطلب من العميل — الخادم يشتقه من سجل الموظف (مصدر الحقيقة)
      const parsed = insertLeaveBalanceSchema.omit({ branchId: true }).parse(req.body);
      if ((parsed.leaveType || "annual") === "unpaid") {
        return res.status(400).json({ error: "الإجازة بدون راتب لا ترتبط برصيد إجازات" });
      }
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
          branchId: emp.branchId, // مزامنة الفرع مع سجل الموظف الحالي (حالات النقل)
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

  // ترحيل أرصدة سنة سابقة إلى السنة التالية (المتبقي > 0 → مرحّل)
  // آمنة لإعادة التشغيل: تعيد كتابة "المرحّل" بالقيمة المحسوبة نفسها دون مضاعفة.
  app.post("/api/hr/leave-balances/carryover", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      const schema = z.object({
        fromYear: z.number().int().min(2020).max(2100),
        leaveType: z.string().default("annual"),
        branchId: z.string().optional(),
        maxDays: z.number().min(0).max(365).nullish(),
      });
      const { fromYear, leaveType, branchId, maxDays } = schema.parse(req.body);
      if (leaveType === "unpaid") {
        return res.status(400).json({ error: "الإجازة بدون راتب لا ترتبط برصيد إجازات" });
      }
      const { branchIds } = getBranchScope(req);
      if (branchId && branchIds !== null && !branchIds.includes(branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية على هذا الفرع" });
      }

      // حفظ سقف الترحيل كسياسة افتراضية للتشغيل التلقائي السنوي
      if (maxDays !== undefined) {
        try { await storage.setPortalSetting("leave_carryover_max_days", maxDays == null ? "" : String(maxDays)); } catch {}
      }

      const result = await runLeaveCarryover({
        fromYear, leaveType, branchId, branchIds,
        maxDays: maxDays ?? null,
        userId: getUserId(req) || undefined,
      });
      await auditEvent({
        req, module: "hr_leaves", entityId: 0, action: "carryover_balances",
        entityName: `ترحيل أرصدة ${fromYear} → ${result.toYear}`, branchId: branchId || null,
        description: `ترحيل أرصدة (${leaveType}) من ${fromYear} إلى ${result.toYear}: ${result.carried} موظف${result.capped ? ` (سقف ${maxDays} يوم على ${result.capped})` : ""}`,
        details: { fromYear, toYear: result.toYear, leaveType, carried: result.carried, skippedZero: result.skippedZero, unchanged: result.unchanged, capped: result.capped, maxDays: maxDays ?? null },
      });
      res.json(result);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leave-balances/carryover] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ==================== العطلات الرسمية ====================
  app.get("/api/hr/public-holidays", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const year = String(req.query.year || "").trim();
      const conds: any[] = [];
      if (/^\d{4}$/.test(year)) {
        conds.push(lte(publicHolidays.startDate, `${year}-12-31`));
        conds.push(gte(publicHolidays.endDate, `${year}-01-01`));
      }
      const rows = await db.select().from(publicHolidays)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(publicHolidays.startDate));
      res.json(rows);
    } catch (e: any) {
      console.error("[hr/public-holidays] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/public-holidays", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      const parsed = insertPublicHolidaySchema.parse(req.body);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.endDate)) {
        return res.status(400).json({ error: "صيغة التاريخ غير صحيحة (YYYY-MM-DD)" });
      }
      if (parsed.endDate < parsed.startDate) {
        return res.status(400).json({ error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" });
      }
      const [created] = await db.insert(publicHolidays).values({
        ...parsed,
        createdBy: getUserId(req) || undefined,
      }).returning();
      await auditEvent({
        req, module: "hr_leaves", entityId: created.id, action: "create_holiday",
        entityName: created.name,
        description: `إضافة عطلة رسمية: ${created.name} (${created.startDate}→${created.endDate})`,
      });
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/public-holidays] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/hr/public-holidays/:id", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const parsed = insertPublicHolidaySchema.partial().parse(req.body);
      if ((parsed.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate)) ||
          (parsed.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(parsed.endDate))) {
        return res.status(400).json({ error: "صيغة التاريخ غير صحيحة (YYYY-MM-DD)" });
      }
      const [existing] = await db.select().from(publicHolidays).where(eq(publicHolidays.id, id));
      if (!existing) return res.status(404).json({ error: "العطلة غير موجودة" });
      const start = parsed.startDate ?? existing.startDate;
      const end = parsed.endDate ?? existing.endDate;
      if (end < start) return res.status(400).json({ error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" });
      const [updated] = await db.update(publicHolidays).set(parsed).where(eq(publicHolidays.id, id)).returning();
      await auditEvent({
        req, module: "hr_leaves", entityId: id, action: "update_holiday",
        entityName: updated.name,
        description: `تعديل عطلة رسمية: ${updated.name}`,
        details: parsed,
      });
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/public-holidays] update error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/public-holidays/:id", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [deleted] = await db.delete(publicHolidays).where(eq(publicHolidays.id, id)).returning();
      if (!deleted) return res.status(404).json({ error: "العطلة غير موجودة" });
      await auditEvent({
        req, module: "hr_leaves", entityId: id, action: "delete_holiday",
        entityName: deleted.name,
        description: `حذف عطلة رسمية: ${deleted.name}`,
      });
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/public-holidays] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ===== خطة الإجازات السنوية =====
  app.get("/api/hr/leave-plan", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const year = Number(req.query.year) || new Date().getFullYear();
      const branchId = req.query.branchId as string | undefined;

      const conds: any[] = [eq(leavePlanEntries.year, year)];
      const scopeCond = applyBranchScope(leavePlanEntries, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (branchId) conds.push(eq(leavePlanEntries.branchId, branchId));

      const rows = await db
        .select({
          entry: leavePlanEntries,
          employeeName: branchEmployees.employeeName,
          jobTitle: branchEmployees.jobTitle,
          branchName: branches.name,
        })
        .from(leavePlanEntries)
        .leftJoin(branchEmployees, eq(leavePlanEntries.branchEmployeeId, branchEmployees.id))
        .leftJoin(branches, eq(leavePlanEntries.branchId, branches.id))
        .where(and(...conds))
        .orderBy(leavePlanEntries.plannedStartDate);

      res.json(rows.map(r => ({
        ...r.entry,
        employeeName: r.employeeName,
        jobTitle: r.jobTitle,
        branchName: r.branchName,
      })));
    } catch (e: any) {
      console.error("[hr/leave-plan] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/hr/leave-plan", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      const parsed = insertLeavePlanEntrySchema.parse(req.body);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.plannedStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.plannedEndDate)) {
        return res.status(400).json({ error: "صيغة التاريخ غير صحيحة (YYYY-MM-DD)" });
      }
      if (parsed.plannedEndDate < parsed.plannedStartDate) {
        return res.status(400).json({ error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" });
      }
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, parsed.branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      const { branchIds } = getBranchScope(req);
      if (branchIds && !branchIds.includes(emp.branchId)) {
        return res.status(403).json({ error: "لا تملك صلاحية على فرع هذا الموظف" });
      }
      const year = Number(parsed.plannedStartDate.slice(0, 4));
      const days = Math.round(
        (new Date(parsed.plannedEndDate).getTime() - new Date(parsed.plannedStartDate).getTime()) / 86400000
      ) + 1;
      const [created] = await db.insert(leavePlanEntries).values({
        ...parsed,
        branchId: emp.branchId,
        year,
        days,
        createdBy: getUserId(req) || undefined,
      }).returning();
      await auditEvent({
        req, module: "hr_leaves", entityId: created.id, action: "create_plan_entry",
        entityName: emp.employeeName, branchId: emp.branchId,
        description: `إضافة إجازة مخططة: ${emp.employeeName} (${created.plannedStartDate}→${created.plannedEndDate})`,
        targetId: emp.id,
      });
      res.status(201).json(created);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leave-plan] create error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/hr/leave-plan/:id", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const body = z.object({
        plannedStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        plannedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        note: z.string().nullable().optional(),
        status: z.enum(["planned", "converted", "cancelled"]).optional(),
      }).parse(req.body);
      const [existing] = await db.select().from(leavePlanEntries).where(eq(leavePlanEntries.id, id));
      if (!existing) return res.status(404).json({ error: "السجل غير موجود" });
      const { branchIds } = getBranchScope(req);
      if (branchIds && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
      }
      const start = body.plannedStartDate ?? existing.plannedStartDate;
      const end = body.plannedEndDate ?? existing.plannedEndDate;
      if (end < start) return res.status(400).json({ error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" });
      if (body.status === "converted" && !existing.leaveRequestId) {
        return res.status(400).json({ error: "لا يمكن وضع الحالة 'تحوّلت لطلب' يدوياً — تُحدَّث تلقائياً عند ربطها بطلب إجازة" });
      }
      const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
      const [updated] = await db.update(leavePlanEntries).set({
        ...body,
        plannedStartDate: start,
        plannedEndDate: end,
        year: Number(start.slice(0, 4)),
        days,
        updatedAt: new Date(),
      }).where(eq(leavePlanEntries.id, id)).returning();
      await auditEvent({
        req, module: "hr_leaves", entityId: id, action: "update_plan_entry",
        branchId: existing.branchId,
        description: `تعديل إجازة مخططة (${start}→${end})`,
        details: body,
        targetId: existing.branchEmployeeId,
      });
      res.json(updated);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/leave-plan] update error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/hr/leave-plan/:id", isAuthenticated, requirePermission("hr_leaves", "edit"), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(leavePlanEntries).where(eq(leavePlanEntries.id, id));
      if (!existing) return res.status(404).json({ error: "السجل غير موجود" });
      const { branchIds } = getBranchScope(req);
      if (branchIds && !branchIds.includes(existing.branchId)) {
        return res.status(403).json({ error: "لا تملك صلاحية على هذا الفرع" });
      }
      await db.delete(leavePlanEntries).where(eq(leavePlanEntries.id, id));
      await auditEvent({
        req, module: "hr_leaves", entityId: id, action: "delete_plan_entry",
        branchId: existing.branchId,
        description: `حذف إجازة مخططة (${existing.plannedStartDate}→${existing.plannedEndDate})`,
        targetId: existing.branchEmployeeId,
      });
      res.json({ success: true });
    } catch (e: any) {
      console.error("[hr/leave-plan] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // معاينة تفصيل مراحل الإجازة المرضية (المادة 117) قبل الإنشاء/الاعتماد
  app.get("/api/hr/leaves/sick-tier-preview", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const branchEmployeeId = Number(req.query.branchEmployeeId);
      const startDate = String(req.query.startDate || "");
      const endDate = String(req.query.endDate || "");
      if (!branchEmployeeId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) {
        return res.status(400).json({ error: "معاملات غير صحيحة" });
      }
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      const { branchIds } = getBranchScope(req);
      if (branchIds !== null && !branchIds.includes(emp.branchId)) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const breakdown = await getSickTierBreakdown(branchEmployeeId, startDate, endDate);
      res.json(breakdown);
    } catch (e: any) {
      console.error("[hr/leaves/sick-tier-preview] error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // كشف حساب إجازات موظف: بياناته + أرصدته لكل نوع + سجل الحركات خلال السنة
  app.get("/api/hr/leaves/employee-statement", isAuthenticated, requirePermission("hr_leaves"), async (req, res) => {
    try {
      const branchEmployeeId = Number(req.query.branchEmployeeId);
      const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
      if (!branchEmployeeId || !Number.isFinite(year) || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "معاملات غير صحيحة" });
      }
      const [emp] = await db.select().from(branchEmployees).where(eq(branchEmployees.id, branchEmployeeId));
      if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
      const { branchIds } = getBranchScope(req);
      if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
        return res.status(403).json({ error: "ليس لديك صلاحية على فرع الموظف" });
      }
      const [branch] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, emp.branchId));

      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      // كل طلبات الإجازة المتداخلة مع السنة (كل الأنواع والحالات) مرتبة زمنياً
      const movements = await db.select().from(leaveRequests)
        .where(and(
          eq(leaveRequests.branchEmployeeId, branchEmployeeId),
          lte(leaveRequests.startDate, yearEnd),
          gte(leaveRequests.endDate, yearStart),
        ))
        .orderBy(leaveRequests.startDate, leaveRequests.id);

      // أيام كل حركة الواقعة داخل السنة (لتقسيم الإجازات العابرة بين سنتين)
      const MS = 86400000;
      const withDaysInYear = movements.map((m) => {
        const segStart = m.startDate > yearStart ? m.startDate : yearStart;
        const segEnd = m.endDate < yearEnd ? m.endDate : yearEnd;
        const daysInYear = Math.max(0, Math.round((new Date(segEnd).getTime() - new Date(segStart).getTime()) / MS) + 1);
        return { ...m, daysInYear };
      });

      // الأرصدة: الأنواع التي لها رصيد مسجل أو استخدام فعلي + السنوية والمرضية دائماً
      const typesInUse = new Set<string>(["annual", "sick"]);
      for (const m of movements) if (m.leaveType !== "unpaid") typesInUse.add(m.leaveType);
      const balances: any[] = [];
      for (const t of Array.from(typesInUse)) {
        balances.push(await getLeaveBalanceSummary(branchEmployeeId, year, t, emp.hireDate));
      }

      // تصفيات الرصيد النشطة ضمن السنة (تظهر كحركات في كشف الحساب)
      const settlements = await db.select().from(leaveSettlements)
        .where(and(
          eq(leaveSettlements.branchEmployeeId, branchEmployeeId),
          eq(leaveSettlements.year, year),
          eq(leaveSettlements.status, "active"),
        ))
        .orderBy(leaveSettlements.settlementDate, leaveSettlements.id);

      res.json({
        employee: {
          id: emp.id,
          employeeNumber: emp.employeeNumber,
          employeeName: emp.employeeName,
          jobTitle: emp.jobTitle,
          department: emp.department,
          branchId: emp.branchId,
          branchName: branch?.name || emp.branchId,
          hireDate: emp.hireDate,
          status: emp.status,
        },
        year,
        balances,
        movements: withDaysInYear,
        settlements,
      });
    } catch (e: any) {
      console.error("[hr/leaves/employee-statement] error:", e);
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
      // اليوم بتوقيت السعودية (وليس UTC) حتى لا تختل تصنيفات "الآن/سيغادر/سيعود" في ساعات حدود اليوم
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
      const plusDays = (dateStr: string, n: number) => {
        const d = new Date(`${dateStr}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + n);
        return d.toISOString().slice(0, 10);
      };
      const weekAhead = plusDays(today, 7);
      const approvedList = all.filter(l => l.status === "approved");
      const onLeaveNowRaw = approvedList.filter(l => l.startDate <= today && l.endDate >= today);
      const departingSoonRaw = approvedList.filter(l => l.startDate > today && l.startDate <= weekAhead);
      const returningSoonRaw = onLeaveNowRaw.filter(l => l.endDate <= weekAhead);
      const onLeaveToday = onLeaveNowRaw.length;
      // أسماء الموظفين للحركات (الجدول لا يخزّن الاسم)
      const movementIds = Array.from(new Set(
        [...onLeaveNowRaw, ...departingSoonRaw].map(l => l.branchEmployeeId)
      ));
      const nameById = new Map<number, { name: string; job: string | null }>();
      if (movementIds.length > 0) {
        const emps = await db
          .select({ id: branchEmployees.id, employeeName: branchEmployees.employeeName, jobTitle: branchEmployees.jobTitle })
          .from(branchEmployees)
          .where(inArray(branchEmployees.id, movementIds));
        emps.forEach(e => nameById.set(e.id, { name: e.employeeName, job: e.jobTitle }));
      }
      const toMovement = (l: any) => ({
        id: l.id,
        branchEmployeeId: l.branchEmployeeId,
        employeeName: nameById.get(l.branchEmployeeId)?.name || "-",
        jobTitle: nameById.get(l.branchEmployeeId)?.job || "",
        leaveType: l.leaveType,
        startDate: l.startDate,
        endDate: l.endDate,
        returnDate: plusDays(l.endDate, 1), // أول يوم عمل متوقع بعد الإجازة
      });
      const sortByStart = (a: any, b: any) => a.startDate.localeCompare(b.startDate);
      const sortByEnd = (a: any, b: any) => a.endDate.localeCompare(b.endDate);
      const byType: Record<string, number> = {};
      all.forEach(l => { byType[l.leaveType] = (byType[l.leaveType] || 0) + 1; });

      // ===== المتأخرون عن العودة (انتهت إجازتهم ولم يباشروا) =====
      const diffDays = (a: string, b: string) =>
        Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
      const overdueRaw = approvedList.filter(l => l.endDate < today && !l.actualReturnDate);
      const overdueIds = Array.from(new Set(overdueRaw.map(l => l.branchEmployeeId)));
      if (overdueIds.length > 0) {
        const missing = overdueIds.filter(id => !nameById.has(id));
        if (missing.length > 0) {
          const emps2 = await db
            .select({ id: branchEmployees.id, employeeName: branchEmployees.employeeName, jobTitle: branchEmployees.jobTitle })
            .from(branchEmployees)
            .where(inArray(branchEmployees.id, missing));
          emps2.forEach(e => nameById.set(e.id, { name: e.employeeName, job: e.jobTitle }));
        }
      }
      const overdueReturns = overdueRaw
        .map(l => {
          const expected = plusDays(l.endDate, 1);
          return { ...toMovement(l), expectedReturn: expected, lateDaysSoFar: Math.max(0, diffDays(expected, today)) };
        })
        .filter(o => o.lateDaysSoFar > 0)
        .sort((a, b) => b.lateDaysSoFar - a.lateDaysSoFar);

      // ===== التوزيع الشهري لأيام الإجازات المعتمدة (السنة الحالية) =====
      const year = Number(today.slice(0, 4));
      const byMonthDays: number[] = Array(12).fill(0);
      for (const l of approvedList) {
        const segStart = l.startDate > `${year}-01-01` ? l.startDate : `${year}-01-01`;
        const segEnd = l.endDate < `${year}-12-31` ? l.endDate : `${year}-12-31`;
        if (segStart > segEnd) continue;
        const d = new Date(segStart + "T00:00:00Z");
        const end = new Date(segEnd + "T00:00:00Z");
        while (d <= end) {
          byMonthDays[d.getUTCMonth()]++;
          d.setUTCDate(d.getUTCDate() + 1);
        }
      }

      // ===== المؤشرات المالية =====
      // 1) تصفيات الأرصدة المدفوعة هذه السنة (النشطة فقط)
      const empScope = applyBranchScope(branchEmployees, branchIds);
      const settleConds: any[] = [eq(leaveSettlements.status, "active"), eq(leaveSettlements.year, year)];
      const settleScope = applyBranchScope(leaveSettlements, branchIds);
      if (settleScope !== undefined) settleConds.push(settleScope);
      const settleRows = await db
        .select({ amount: leaveSettlements.finalAmount, days: leaveSettlements.settledDays })
        .from(leaveSettlements)
        .where(and(...settleConds));
      const settlementsYtd = settleRows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const settlementsYtdDays = settleRows.reduce((s, r) => s + Number(r.days || 0), 0);

      // 2) الالتزام المالي لأرصدة الإجازات السنوية المتبقية (بدل الإجازة = الراتب الإجمالي/30 × الأيام المتبقية)
      const activeEmps = await db
        .select({
          id: branchEmployees.id,
          totalSalary: branchEmployees.totalSalary,
          hireDate: branchEmployees.hireDate,
        })
        .from(branchEmployees)
        .where(empScope !== undefined ? and(eq(branchEmployees.status, "active"), empScope) : eq(branchEmployees.status, "active"));
      const activeIds = activeEmps.map(e => e.id);
      const balRows = activeIds.length > 0 ? await db
        .select()
        .from(leaveBalances)
        .where(and(
          eq(leaveBalances.year, year),
          eq(leaveBalances.leaveType, "annual"),
          inArray(leaveBalances.branchEmployeeId, activeIds),
        )) : [];
      const balByEmp = new Map(balRows.map(b => [b.branchEmployeeId, b]));
      // الأيام السنوية المستخدمة لكل موظف (من الطلبات المعتمدة المتداخلة مع السنة — ضمن النطاق المحمّل)
      const usedByEmp = new Map<number, number>();
      for (const l of approvedList) {
        if (l.leaveType !== "annual") continue;
        const segStart = l.startDate > `${year}-01-01` ? l.startDate : `${year}-01-01`;
        const segEnd = l.endDate < `${year}-12-31` ? l.endDate : `${year}-12-31`;
        if (segStart > segEnd) continue;
        const days = diffDays(segStart, segEnd) + 1;
        usedByEmp.set(l.branchEmployeeId, (usedByEmp.get(l.branchEmployeeId) || 0) + days);
      }
      let liabilityDays = 0;
      let liabilityAmount = 0;
      let liabilityEmployees = 0;
      for (const e of activeEmps) {
        const b: any = balByEmp.get(e.id);
        const entitled = b ? Number(b.entitledDays) : suggestedEntitlement(e.hireDate, year);
        const remaining = entitled
          + (b ? Number(b.carriedOverDays) : 0)
          + (b ? Number(b.adjustmentDays) : 0)
          - (b ? Number(b.settledDays ?? 0) : 0)
          - (usedByEmp.get(e.id) || 0);
        if (remaining > 0) {
          liabilityDays += remaining;
          liabilityAmount += remaining * (Number(e.totalSalary || 0) / 30);
          liabilityEmployees++;
        }
      }

      // 3) المباشرات المتأخرة المسجّلة هذه السنة
      const lateReturnsYtd = all.filter(l => l.returnStatus === "late" && (l.actualReturnDate || "").startsWith(String(year)));
      const lateDaysYtd = lateReturnsYtd.reduce((s, l) => s + Number(l.lateDays || 0), 0);

      res.json({
        total, pending, approved, rejected, onLeaveToday, byType,
        onLeaveNow: onLeaveNowRaw.sort(sortByEnd).map(toMovement),
        departingSoon: departingSoonRaw.sort(sortByStart).map(toMovement),
        returningSoon: returningSoonRaw.sort(sortByEnd).map(toMovement),
        overdueReturns,
        byMonthDays,
        year,
        financial: {
          settlementsYtd: Math.round(settlementsYtd * 100) / 100,
          settlementsYtdDays,
          settlementsCount: settleRows.length,
          liabilityDays,
          liabilityAmount: Math.round(liabilityAmount * 100) / 100,
          liabilityEmployees,
          lateReturnsCount: lateReturnsYtd.length,
          lateDaysYtd,
        },
      });
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
        inArray(salaryDeductions.type, ["advance", "loan_installment", "sales_deficit"]),
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

      // ربط خصومات العجز البيعي باليوميات المصدر (لعرض رابط "عرض اليوميات")
      const deficitIds = rows.filter(r => r.d.type === "sales_deficit").map(r => r.d.id);
      const journalInfo = new Map<number, { count: number; month: string }>();
      if (deficitIds.length > 0) {
        const js = await db
          .select({ dedId: cashierSalesJournals.deficitDeductionId, journalDate: cashierSalesJournals.journalDate })
          .from(cashierSalesJournals)
          .where(inArray(cashierSalesJournals.deficitDeductionId, deficitIds));
        for (const j of js) {
          if (j.dedId == null) continue;
          const cur = journalInfo.get(j.dedId) || { count: 0, month: "" };
          cur.count += 1;
          const m = (j.journalDate || "").slice(0, 7);
          if (m && (!cur.month || m < cur.month)) cur.month = m;
          journalInfo.set(j.dedId, cur);
        }
      }

      res.json(rows.map(r => ({
        ...r.d,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
        sourceJournals: journalInfo.get(r.d.id) || null,
      })));
    } catch (e: any) {
      console.error("[hr/advances] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // تقرير شامل بدون حد الصفوف — للاستخدام في كشف الحساب والتقرير الشهري وتصدير الإدارة المالية
  app.get("/api/hr/advances/report", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const employeeId = req.query.employeeId ? parseInt(req.query.employeeId as string, 10) : null;
      const month = req.query.month as string | undefined;

      const conds: any[] = [
        inArray(salaryDeductions.type, ["advance", "loan_installment", "sales_deficit"]),
      ];
      const scopeCond = applyBranchScope(salaryDeductions, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);
      if (employeeId) conds.push(eq(salaryDeductions.branchEmployeeId, employeeId));
      if (month) conds.push(eq(salaryDeductions.month, month));

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
        .orderBy(salaryDeductions.month, salaryDeductions.branchEmployeeId);

      res.json(rows.map(r => ({
        ...r.d,
        employeeName: r.employeeName,
        employeeJob: r.employeeJob,
        branchName: r.branchName,
      })));
    } catch (e: any) {
      console.error("[hr/advances/report] error:", e);
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
      let deletedCount = 1;
      await db.transaction(async (tx) => {
        if (existing.type === "sales_deficit") {
          // حذف عجز بيعي = عكس الترحيل بالكامل (كل الأقساط الشقيقة معاً + فك ارتباط اليوميات)
          // حتى لا يبقى قسط معلّق بينما تعود اليومية قابلة للترحيل (ازدواج خصم)
          const baseDesc = (existing.description || "").replace(/ — قسط \d+\/\d+$/, "");
          const siblings = await tx.select().from(salaryDeductions).where(and(
            eq(salaryDeductions.branchEmployeeId, existing.branchEmployeeId),
            eq(salaryDeductions.type, "sales_deficit"),
          ));
          const groupIds = siblings
            .filter((s) => (s.description || "").replace(/ — قسط \d+\/\d+$/, "") === baseDesc)
            .map((s) => s.id);
          const ids = groupIds.length > 0 ? groupIds : [id];
          await tx
            .update(cashierSalesJournals)
            .set({ deficitDeductionId: null, deficitPostedBy: null, deficitPostedAt: null, updatedAt: new Date() })
            .where(inArray(cashierSalesJournals.deficitDeductionId, ids));
          await tx.delete(salaryDeductions).where(inArray(salaryDeductions.id, ids));
          deletedCount = ids.length;
        } else {
          await tx.delete(salaryDeductions).where(eq(salaryDeductions.id, id));
        }
      });
      res.json({ success: true, deleted: deletedCount });
    } catch (e: any) {
      console.error("[hr/advances] delete error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // سداد مبكر: حذف أقساط قادمة (شهرها بعد الشهر الحالي) دفعة واحدة بعد سداد الموظف نقداً
  app.post("/api/hr/advances/early-settle", isAuthenticated, requirePermission("hr_advances", "delete"), async (req, res) => {
    try {
      const body = z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) }).parse(req.body);
      const { branchIds } = getBranchScope(req);
      const currentMonth = new Date().toISOString().slice(0, 7);

      const rows = await db.select().from(salaryDeductions).where(inArray(salaryDeductions.id, body.ids));
      if (rows.length !== body.ids.length) return res.status(400).json({ error: "بعض البنود غير موجودة" });
      for (const r of rows) {
        if (branchIds !== null && !branchIds.includes(r.branchId)) {
          return res.status(403).json({ error: "ليس لديك صلاحية على فرع بعض البنود" });
        }
        if (!["advance", "loan_installment"].includes(r.type)) {
          return res.status(400).json({ error: "السداد المبكر متاح لأقساط السلف والقروض فقط (وليس العجوزات)" });
        }
        if (r.month <= currentMonth) {
          return res.status(400).json({ error: `القسط ${r.month} مستحق بالفعل — السداد المبكر للأقساط القادمة فقط` });
        }
      }
      await db.delete(salaryDeductions).where(inArray(salaryDeductions.id, body.ids));
      res.json({ success: true, deleted: rows.length });
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة" });
      console.error("[hr/advances] early-settle error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/hr/advances/stats", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const scopeCond = applyBranchScope(salaryDeductions, branchIds);
      const conds: any[] = [inArray(salaryDeductions.type, ["advance", "loan_installment", "sales_deficit"])];
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
  // 4-ب) العجوزات البيعية للكاشير  /api/hr/cashier-deficits
  // كشف شهري بعجوزات يوميات المبيعات + ترحيلها إلى السلف والقروض (خصم راتب)
  // ========================================================================

  // مبلغ العجز في يومية: العجز النقدي (بعد استبعاد أخطاء الإدخال) + العجز البنكي
  // ملاحظة: discrepancyAmount يُخزَّن كقيمة مطلقة والحالة (shortage/surplus) تحدد الاتجاه.
  function journalDeficitAmount(j: any): number {
    let total = 0;
    if (j.discrepancyStatus === "shortage") {
      let cash = Math.abs((j.netDiscrepancy || 0) !== 0 ? j.netDiscrepancy : (j.discrepancyAmount || 0));
      // استبعاد مبلغ خطأ الإدخال إن وُجد (لا يُحمَّل على الكاشير)
      if (j.isInputError && (j.netDiscrepancy || 0) === 0) {
        cash = Math.max(0, cash - Math.abs(j.inputErrorAmount || 0));
      }
      total += cash;
    }
    if (j.bankDiscrepancyStatus === "shortage") {
      total += Math.abs(j.bankDiscrepancyTotal || 0);
    }
    return Math.round(total * 100) / 100;
  }

  app.get("/api/hr/cashier-deficits", isAuthenticated, requirePermission("hr_advances"), async (req, res) => {
    try {
      const { branchIds } = getBranchScope(req);
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "صيغة الشهر غير صحيحة" });

      const conds: any[] = [
        gte(cashierSalesJournals.journalDate, `${month}-01`),
        lte(cashierSalesJournals.journalDate, `${month}-31`),
        eq(cashierSalesJournals.status, "approved"),
        sql`(${cashierSalesJournals.discrepancyStatus} = 'shortage' OR ${cashierSalesJournals.bankDiscrepancyStatus} = 'shortage')`,
      ];
      const scopeCond = applyBranchScope(cashierSalesJournals, branchIds);
      if (scopeCond !== undefined) conds.push(scopeCond);

      const rows = await db
        .select({
          j: cashierSalesJournals,
          branchName: branches.name,
        })
        .from(cashierSalesJournals)
        .leftJoin(branches, eq(cashierSalesJournals.branchId, branches.id))
        .where(and(...conds))
        .orderBy(desc(cashierSalesJournals.journalDate))
        .limit(2000);

      // ربط الكاشير (user) بملف الموظف عبر linked_user_id
      const cashierIds = Array.from(new Set(rows.map((r) => r.j.cashierId)));
      const links = cashierIds.length
        ? await db.select({
            id: branchEmployees.id,
            linkedUserId: branchEmployees.linkedUserId,
            employeeName: branchEmployees.employeeName,
            branchId: branchEmployees.branchId,
            isActive: branchEmployees.isActive,
          }).from(branchEmployees).where(inArray(branchEmployees.linkedUserId, cashierIds))
        : [];
      const empByUser = new Map<string, any>();
      for (const l of links) {
        // نفضّل الملف النشط إن وُجد أكثر من ملف مرتبط بنفس المستخدم
        const prev = empByUser.get(l.linkedUserId!);
        if (!prev || (l.isActive && !prev.isActive)) empByUser.set(l.linkedUserId!, l);
      }

      // تجميع لكل كاشير
      const byCashier = new Map<string, any>();
      for (const r of rows) {
        const j = r.j;
        const amount = journalDeficitAmount(j);
        if (amount <= 0) continue;
        const key = j.cashierId;
        if (!byCashier.has(key)) {
          const emp = empByUser.get(key);
          byCashier.set(key, {
            cashierId: key,
            cashierName: j.cashierName,
            branchEmployeeId: emp?.id ?? null,
            employeeName: emp?.employeeName ?? null,
            linked: !!emp,
            journals: [],
            totalDeficit: 0,
            unpostedDeficit: 0,
            unpostedCount: 0,
          });
        }
        const g = byCashier.get(key);
        const posted = j.deficitDeductionId != null;
        g.journals.push({
          id: j.id,
          journalDate: j.journalDate,
          branchName: r.branchName,
          shiftType: j.shiftType,
          cashShortage: journalDeficitAmount({ ...j, bankDiscrepancyStatus: null }),
          bankShortage: j.bankDiscrepancyStatus === "shortage" ? Math.abs(j.bankDiscrepancyTotal || 0) : 0,
          amount,
          posted,
          deficitDeductionId: j.deficitDeductionId,
          deficitPostedAt: j.deficitPostedAt,
        });
        g.totalDeficit = Math.round((g.totalDeficit + amount) * 100) / 100;
        if (!posted) {
          g.unpostedDeficit = Math.round((g.unpostedDeficit + amount) * 100) / 100;
          g.unpostedCount += 1;
        }
      }

      res.json({ month, cashiers: Array.from(byCashier.values()) });
    } catch (e: any) {
      console.error("[hr/cashier-deficits] list error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ترحيل عجوزات شهر لكاشير معيّن → خصم راتب واحد (بند: عجز يوميات مبيعات)
  app.post("/api/hr/cashier-deficits/post", isAuthenticated, requirePermission("hr_advances", "edit"), async (req, res) => {
    try {
      const body = z.object({
        cashierId: z.string().min(1),
        month: z.string().regex(/^\d{4}-\d{2}$/),
        deductionMonth: z.string().regex(/^\d{4}-\d{2}$/),
        journalIds: z.array(z.number().int().positive()).min(1),
        // تقسيط العجز على عدة شهور (اختياري — الافتراضي شهر واحد)
        installments: z.number().int().min(1).max(6).optional(),
      }).parse(req.body);

      const { branchIds } = getBranchScope(req);
      const userId = getUserId(req) || undefined;

      // ملفات الموظف المرتبطة بحساب الكاشير (قد تتعدد بين الفروع)
      const empLinks = await db.select().from(branchEmployees)
        .where(eq(branchEmployees.linkedUserId, body.cashierId));
      if (empLinks.length === 0) {
        return res.status(400).json({ error: "حساب الكاشير غير مرتبط بملف موظف — اربط الحساب من صفحة الموظفين أولاً" });
      }

      const result = await db.transaction(async (tx) => {
        // قفل اليوميات المطلوبة والتحقق منها
        const journals = await tx.select().from(cashierSalesJournals)
          .where(and(
            inArray(cashierSalesJournals.id, body.journalIds),
            eq(cashierSalesJournals.cashierId, body.cashierId),
            eq(cashierSalesJournals.status, "approved"),
            sql`${cashierSalesJournals.deficitDeductionId} IS NULL`,
            gte(cashierSalesJournals.journalDate, `${body.month}-01`),
            lte(cashierSalesJournals.journalDate, `${body.month}-31`),
          ))
          .for("update");

        if (journals.length === 0) return { error: "لا توجد يوميات صالحة للترحيل (قد تكون رُحّلت مسبقاً)" };
        if (journals.length !== body.journalIds.length) {
          return { error: "بعض اليوميات المحددة غير صالحة للترحيل (مرحّلة مسبقاً أو غير معتمدة)" };
        }
        if (branchIds !== null && journals.some((j) => !branchIds.includes(j.branchId))) {
          return { error: "ليس لديك صلاحية على فرع بعض اليوميات" };
        }

        // اختيار ملف الموظف بحسب فرع اليوميات نفسها (ثم النشط كاحتياط)
        const journalBranchIds = new Set(journals.map((j) => j.branchId));
        const emp =
          empLinks.find((e) => e.isActive && e.branchId && journalBranchIds.has(e.branchId)) ||
          empLinks.find((e) => e.branchId && journalBranchIds.has(e.branchId)) ||
          empLinks.find((e) => e.isActive) ||
          empLinks[0];
        if (branchIds !== null && (!emp.branchId || !branchIds.includes(emp.branchId))) {
          return { error: "ليس لديك صلاحية على فرع هذا الموظف" };
        }

        const total = Math.round(journals.reduce((s, j) => s + journalDeficitAmount(j), 0) * 100) / 100;
        if (total <= 0) return { error: "لا يوجد عجز في اليوميات المحددة" };

        const dates = journals.map((j) => j.journalDate).sort();
        const baseDesc = `عجز يوميات مبيعات شهر ${body.month} (${journals.length} يومية: ${dates[0]} → ${dates[dates.length - 1]})`;

        // تقسيم المبلغ على الأقساط (القسط الأخير يمتص فرق التقريب)
        const n = body.installments ?? 1;
        const per = Math.round((total / n) * 100) / 100;
        const nextMonth = (m: string, add: number) => {
          const [y, mo] = m.split("-").map(Number);
          const d = new Date(y, mo - 1 + add, 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        };
        const rows = Array.from({ length: n }, (_, i) => ({
          branchEmployeeId: emp.id,
          branchId: emp.branchId!,
          month: nextMonth(body.deductionMonth, i),
          type: "sales_deficit" as const,
          amount: i === n - 1 ? Math.round((total - per * (n - 1)) * 100) / 100 : per,
          description: n > 1 ? `${baseDesc} — قسط ${i + 1}/${n}` : baseDesc,
          createdBy: userId,
        }));
        const inserted = await tx.insert(salaryDeductions).values(rows).returning();
        const deduction = inserted[0];

        const now = new Date();
        await tx.update(cashierSalesJournals)
          .set({ deficitDeductionId: deduction.id, deficitPostedBy: userId, deficitPostedAt: now, updatedAt: now })
          .where(inArray(cashierSalesJournals.id, journals.map((j) => j.id)));

        return { deduction, journalCount: journals.length, total, installments: n, employeeName: emp.employeeName, cashierUserId: emp.linkedUserId, empBranchId: emp.branchId };
      });

      if ("error" in result) return res.status(400).json({ error: result.error });

      // إشعار الموظف في بوابته (جرس الإشعارات) — لا يوقف الترحيل إن فشل
      try {
        if (result.cashierUserId) {
          const n = result.installments || 1;
          const amountTxt = Number(result.total).toLocaleString("ar-SA-u-nu-latn");
          await storage.createSystemNotification({
            title: "خصم عجز يوميات مبيعات",
            content:
              `تم ترحيل عجز يوميات المبيعات لشهر ${body.month} بمبلغ إجمالي ${amountTxt} ر.س (${result.journalCount} يومية)` +
              (n > 1
                ? `، مقسّطاً على ${n} شهور بدءاً من ${body.deductionMonth}.`
                : ` وسيُخصم من راتب شهر ${body.deductionMonth}.`) +
              " لمراجعة التفاصيل تواصل مع إدارة الموارد البشرية.",
            messageType: "announcement",
            displayStyle: "banner",
            priority: 2,
            isActive: true,
            targetAllBranches: false,
            targetBranchIds: result.empBranchId ? [result.empBranchId] : [],
            targetUserIds: [result.cashierUserId],
            createdBy: userId,
          } as any);
        }
      } catch (notifyErr) {
        console.error("[hr/cashier-deficits] notify error (non-blocking):", notifyErr);
      }

      res.status(201).json(result);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صحيحة", details: e.errors });
      console.error("[hr/cashier-deficits] post error:", e);
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
        terminationType: z.enum(["resignation", "termination", "termination_article_80", "resignation_marriage_childbirth", "force_majeure", "end_of_contract", "retirement", "death"]),
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

      // نظام العمل السعودي (المواد 84-87):
      // - المادة 84: أجر نصف شهر عن كل سنة من السنوات الخمس الأولى، وأجر شهر عن كل
      //   سنة تليها، على أساس الأجر الأخير (الأجر الفعلي الشامل)، وتُحتسب كسور السنة نسبياً.
      // - المادة 85 (استقالة): 1/3 إذا 2-5 سنوات، 2/3 إذا 5-10 سنوات، كاملة إذا 10+؛ لا شيء أقل من سنتين.
      // - المادة 87: مكافأة كاملة عند ترك العمل لقوة قاهرة، أو استقالة العاملة خلال
      //   6 أشهر من الزواج أو 3 أشهر من الوضع.
      // - المادة 80: الفصل لأحد أسبابها يُسقط المكافأة.
      const wageBase = total; // الأجر الأخير الشامل (المادة 84)
      const firstFive = Math.min(5, years);
      const afterFive = Math.max(0, years - 5);
      const firstFiveAmount = wageBase * 0.5 * firstFive;
      const afterFiveAmount = wageBase * 1 * afterFive;
      const fullEos = firstFiveAmount + afterFiveAmount;

      let eosAmount = 0;
      let eosFraction = 1;
      let appliedRule = "";
      if (input.terminationType === "resignation") {
        if (years < 2) { eosFraction = 0; appliedRule = "المادة 85: خدمة أقل من سنتين — لا تستحق مكافأة"; }
        else if (years < 5) { eosFraction = 1 / 3; appliedRule = "المادة 85: استقالة بين سنتين وخمس سنوات — ثلث المكافأة"; }
        else if (years < 10) { eosFraction = 2 / 3; appliedRule = "المادة 85: استقالة بين خمس وعشر سنوات — ثلثا المكافأة"; }
        else { eosFraction = 1; appliedRule = "المادة 85: استقالة بعد عشر سنوات — المكافأة كاملة"; }
      } else if (input.terminationType === "termination_article_80") {
        eosFraction = 0; appliedRule = "المادة 80: فصل لأحد الأسباب المنصوصة — لا تستحق مكافأة";
      } else if (input.terminationType === "resignation_marriage_childbirth" || input.terminationType === "force_majeure") {
        eosFraction = 1; appliedRule = "المادة 87: تستحق المكافأة كاملة";
      } else {
        eosFraction = 1; appliedRule = "المادة 84: إنهاء العقد من صاحب العمل / انتهاء المدة / تقاعد / وفاة — المكافأة كاملة";
      }
      eosAmount = fullEos * eosFraction;

      // تعبئة رصيد الإجازات تلقائياً من نظام الإجازات إذا لم يُدخل يدوياً (المادة 111: بدل الإجازة المستحقة)
      let vacationBalance = input.vacationBalance;
      let vacationAutoFilled = false;
      if (vacationBalance == null) {
        try {
          const endYear = parseInt(input.endDate.slice(0, 4), 10);
          const bal = await getLeaveBalanceSummary(emp.id, endYear, "annual", (emp as any).hireDate);
          vacationBalance = Math.max(0, Number(bal.remainingDays) || 0);
          vacationAutoFilled = true;
        } catch (balErr) {
          console.error("[hr/eos/calculate] leave balance auto-fill failed:", balErr);
          vacationBalance = 0;
        }
      }

      const dailyRate = total / 30;
      const vacationAmount = (vacationBalance || 0) * dailyRate;
      const netAmount = eosAmount + vacationAmount + (input.otherDues || 0) - (input.totalDeductions || 0);

      res.json({
        startDate,
        totalServiceYears: parseFloat(years.toFixed(3)),
        basicSalary: basic,
        totalSalary: total,
        eosAmount: parseFloat(eosAmount.toFixed(2)),
        fullEosAmount: parseFloat(fullEos.toFixed(2)),
        firstFiveYears: parseFloat(firstFive.toFixed(3)),
        afterFiveYears: parseFloat(afterFive.toFixed(3)),
        firstFiveAmount: parseFloat(firstFiveAmount.toFixed(2)),
        afterFiveAmount: parseFloat(afterFiveAmount.toFixed(2)),
        eosFraction,
        appliedRule,
        dailyRate: parseFloat(dailyRate.toFixed(2)),
        vacationBalance: vacationBalance || 0,
        vacationAutoFilled,
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
