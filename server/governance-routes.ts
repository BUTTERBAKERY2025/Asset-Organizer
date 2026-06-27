import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, asc, sql, gte, lte, or, isNull } from "drizzle-orm";
import { isAuthenticated, requirePermission } from "./auth";
import { ObjectStorageService, ObjectNotFoundError } from "./replit_integrations/object_storage/objectStorage";
import {
  boardMembers,
  shareholders,
  shareholderDocuments,
  shareTransfers,
  governanceMeetings,
  meetingAttendance,
  meetingMinutes,
  boardResolutions,
  resolutionVotes,
  resolutionSignatures,
  assemblyResolutions,
  assemblyResolutionVotes,
  assemblyResolutionSignatures,
  insiderRegister,
  insiderBlackoutPeriods,
  insertAssemblyResolutionSchema,
  insertInsiderRegisterSchema,
  insertInsiderBlackoutPeriodSchema,
  votingTokens,
  capitalTransactions,
  dividendDistributions,
  shareholderDividends,
  disclosures,
  complianceRequirements,
  complianceHistory,
  systemAuditLogs,
  insertBoardMemberSchema,
  insertShareholderSchema,
  insertShareholderDocumentSchema,
  insertShareTransferSchema,
  insertGovernanceMeetingSchema,
  insertMeetingAttendanceSchema,
  insertMeetingMinutesSchema,
  insertBoardResolutionSchema,
  insertResolutionVoteSchema,
  insertResolutionSignatureSchema,
  insertVotingTokenSchema,
  insertCapitalTransactionSchema,
  insertDividendDistributionSchema,
  insertShareholderDividendSchema,
  insertDisclosureSchema,
  insertComplianceRequirementSchema,
  insertComplianceHistorySchema,
  meetingRsvps,
  auditCommittees,
  auditCommitteeMembers,
  auditCommitteeReports,
  prospectuses,
  prospectusSections,
  irEvents,
  irContacts,
  materialDisclosures,
  internalAuditPlans,
  internalAuditEngagements,
  internalAuditFindings,
  insertAuditCommitteeSchema,
  insertAuditCommitteeMemberSchema,
  insertAuditCommitteeReportSchema,
  insertProspectusSchema,
  insertProspectusSectionSchema,
  insertIrEventSchema,
  insertIrContactSchema,
  insertMaterialDisclosureSchema,
  insertInternalAuditPlanSchema,
  insertInternalAuditEngagementSchema,
  insertInternalAuditFindingSchema,
} from "@shared/schema";
import crypto from "crypto";
import { z } from "zod";
import { sendMeetingInvitations, isTwilioConfigured, generateWhatsAppLinks } from "./twilio-service";

const updateBoardMemberSchema = insertBoardMemberSchema.partial().omit({ createdBy: true });
const updateShareholderSchema = insertShareholderSchema.partial().omit({ createdBy: true });
const updateShareTransferSchema = insertShareTransferSchema.partial().omit({ createdBy: true, transferNumber: true });
const updateGovernanceMeetingSchema = insertGovernanceMeetingSchema.partial().omit({ createdBy: true, meetingNumber: true });
const updateMeetingAttendanceSchema = insertMeetingAttendanceSchema.partial();
const updateMeetingMinutesSchema = insertMeetingMinutesSchema.partial().omit({ createdBy: true, minutesNumber: true });
const updateBoardResolutionSchema = insertBoardResolutionSchema.partial().omit({ createdBy: true, resolutionNumber: true });
const updateAssemblyResolutionSchema = insertAssemblyResolutionSchema.partial().omit({ createdBy: true, resolutionNumber: true });
const updateInsiderRegisterSchema = insertInsiderRegisterSchema.partial().omit({ createdBy: true });
const updateInsiderBlackoutPeriodSchema = insertInsiderBlackoutPeriodSchema.partial().omit({ createdBy: true });

// =====================================================
// GOVERNANCE COMPLIANCE HELPERS (Saudi Companies Law M/132 + CMA Nomu)
// =====================================================
const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000; // tiny leap-year buffer
const BOARD_MEETING_NOTICE_DAYS = 7;
const ASSEMBLY_MEETING_NOTICE_DAYS = 21;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/** Validate a board member's term does not exceed 3 years (Companies Law). */
function validateBoardMemberTerm(appointmentDate: any, termEndDate: any): string | null {
  if (!appointmentDate || !termEndDate) return null;
  const a = new Date(appointmentDate);
  const e = new Date(termEndDate);
  if (isNaN(a.getTime()) || isNaN(e.getTime())) return null;
  if (e <= a) return "تاريخ نهاية العضوية يجب أن يكون بعد تاريخ التعيين";
  if (e.getTime() - a.getTime() > THREE_YEARS_MS) {
    return "مدة عضوية مجلس الإدارة لا يجوز أن تتجاوز 3 سنوات (نظام الشركات المادة 68)";
  }
  return null;
}

/** Compute independence ratio of active board (≥ ⅓ recommended per CMA). */
async function computeIndependenceRatio(): Promise<{ total: number; independent: number; ratio: number; meetsMinimum: boolean }> {
  const active = await db.select().from(boardMembers).where(eq(boardMembers.status, "active"));
  const total = active.length;
  const independent = active.filter((m: any) => m.memberType === "independent").length;
  const ratio = total > 0 ? independent / total : 0;
  return { total, independent, ratio, meetsMinimum: total === 0 || (ratio >= (1 / 3) && independent >= 2) };
}

/** Validate notice period for board vs assembly meetings. */
function validateMeetingNoticePeriod(meetingType: string, meetingDate: any): string | null {
  if (!meetingDate) return null;
  const md = new Date(meetingDate);
  if (isNaN(md.getTime())) return null;
  const days = daysBetween(new Date(), md);
  const isAssembly = meetingType === "ordinary_assembly" || meetingType === "extraordinary_assembly"
    || meetingType === "ordinary" || meetingType === "extraordinary";
  const required = isAssembly ? ASSEMBLY_MEETING_NOTICE_DAYS : BOARD_MEETING_NOTICE_DAYS;
  if (days < required) {
    return isAssembly
      ? `الجمعية العمومية تتطلب إشعاراً مسبقاً ≥ ${required} يوماً (متبقي ${days} يوماً). يمكن التجاوز فقط بإجماع المساهمين.`
      : `اجتماع مجلس الإدارة يتطلب إشعاراً مسبقاً ≥ ${required} أيام (متبقي ${days} يوماً).`;
  }
  return null;
}
const updateDisclosureSchema = insertDisclosureSchema.partial().omit({ createdBy: true, disclosureNumber: true });
const updateComplianceRequirementSchema = insertComplianceRequirementSchema.partial().omit({ createdBy: true, requirementCode: true });
const updateDividendDistributionSchema = insertDividendDistributionSchema.partial().omit({ createdBy: true, distributionNumber: true });
const updateCapitalTransactionSchema = insertCapitalTransactionSchema.partial().omit({ createdBy: true, transactionNumber: true });

function getCurrentUserId(req: Request): string {
  return (req as any).currentUser?.id || "system";
}

function computeHijriServer(gregorianDate: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'numeric', year: 'numeric'
    }).formatToParts(gregorianDate);
    const day = (parts.find(p => p.type === 'day')?.value || '1').padStart(2, '0');
    const month = (parts.find(p => p.type === 'month')?.value || '1').padStart(2, '0');
    const year = parts.find(p => p.type === 'year')?.value || '1447';
    return `${day}/${month}/${year}`;
  } catch {
    return null;
  }
}

function fixHijriInText(text: string): string {
  if (!text) return text;
  const gregorianMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})م/);
  if (gregorianMatch) {
    const gDay = parseInt(gregorianMatch[1]);
    const gMonth = parseInt(gregorianMatch[2]);
    const gYear = parseInt(gregorianMatch[3]);
    const gregorianDate = new Date(gYear, gMonth - 1, gDay);
    if (!isNaN(gregorianDate.getTime())) {
      const correctHijri = computeHijriServer(gregorianDate);
      if (correctHijri) {
        return text.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})هـ/g, correctHijri + 'هـ');
      }
    }
  }
  return text;
}

export function registerGovernanceRoutes(app: Express) {
  // =====================================================
  // Board Members - أعضاء مجلس الإدارة
  // =====================================================
  
  app.get("/api/governance/board-members", isAuthenticated, requirePermission("governance_board", "view"), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const position = req.query.position as string | undefined;
      
      let query = db.select().from(boardMembers);
      const conditions: any[] = [];
      
      if (status) conditions.push(eq(boardMembers.status, status));
      if (position) conditions.push(eq(boardMembers.position, position));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const members = await query.orderBy(desc(boardMembers.appointmentDate));
      res.json(members);
    } catch (error) {
      console.error("Error fetching board members:", error);
      res.status(500).json({ error: "فشل في جلب أعضاء المجلس" });
    }
  });

  app.get("/api/governance/board-members/:id", isAuthenticated, requirePermission("governance_board", "view"), async (req, res) => {
    try {
      const [member] = await db.select().from(boardMembers).where(eq(boardMembers.id, parseInt(req.params.id)));
      if (!member) {
        return res.status(404).json({ error: "عضو المجلس غير موجود" });
      }
      res.json(member);
    } catch (error) {
      console.error("Error fetching board member:", error);
      res.status(500).json({ error: "فشل في جلب بيانات عضو المجلس" });
    }
  });

  app.post("/api/governance/board-members", isAuthenticated, requirePermission("governance_board", "create"), async (req, res) => {
    try {
      const data = insertBoardMemberSchema.parse({
        ...req.body,
        createdBy: getCurrentUserId(req),
      });
      // COMPLIANCE: max 3-year term per Saudi Companies Law M/132.
      const termErr = validateBoardMemberTerm(data.appointmentDate, data.termEndDate);
      if (termErr) return res.status(400).json({ error: termErr });
      const [member] = await db.insert(boardMembers).values(data).returning();
      // COMPLIANCE WARNING: ≥ ⅓ independent directors (advisory, not blocking).
      const indep = await computeIndependenceRatio();
      res.status(201).json({ ...member, _governance: { independence: indep } });
    } catch (error) {
      console.error("Error creating board member:", error);
      res.status(500).json({ error: "فشل في إضافة عضو المجلس" });
    }
  });

  app.patch("/api/governance/board-members/:id", isAuthenticated, requirePermission("governance_board", "edit"), async (req, res) => {
    try {
      const validatedData = updateBoardMemberSchema.parse(req.body);
      // COMPLIANCE: re-validate term if either date is being changed.
      if (validatedData.appointmentDate !== undefined || validatedData.termEndDate !== undefined) {
        const [existing] = await db.select().from(boardMembers).where(eq(boardMembers.id, parseInt(req.params.id)));
        const appointmentDate = validatedData.appointmentDate ?? existing?.appointmentDate;
        const termEndDate = validatedData.termEndDate ?? existing?.termEndDate;
        const termErr = validateBoardMemberTerm(appointmentDate, termEndDate);
        if (termErr) return res.status(400).json({ error: termErr });
      }
      const [member] = await db.update(boardMembers)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(boardMembers.id, parseInt(req.params.id)))
        .returning();
      const indep = await computeIndependenceRatio();
      res.json({ ...member, _governance: { independence: indep } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating board member:", error);
      res.status(500).json({ error: "فشل في تحديث بيانات عضو المجلس" });
    }
  });

  // Read-only endpoint for the independence-ratio dashboard tile.
  app.get("/api/governance/board-members/_compliance/independence", isAuthenticated, requirePermission("governance_board", "view"), async (_req, res) => {
    try {
      const indep = await computeIndependenceRatio();
      res.json(indep);
    } catch (error) {
      console.error("Error computing independence ratio:", error);
      res.status(500).json({ error: "فشل في حساب نسبة الاستقلالية" });
    }
  });

  app.delete("/api/governance/board-members/:id", isAuthenticated, requirePermission("governance_board", "delete"), async (req, res) => {
    try {
      await db.delete(boardMembers).where(eq(boardMembers.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting board member:", error);
      res.status(500).json({ error: "فشل في حذف عضو المجلس" });
    }
  });

  // =====================================================
  // Shareholders - المساهمون
  // =====================================================
  
  app.get("/api/governance/shareholders", isAuthenticated, requirePermission("governance_shareholders", "view"), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;
      
      let query = db.select().from(shareholders);
      const conditions: any[] = [];
      
      if (status) conditions.push(eq(shareholders.status, status));
      if (type) conditions.push(eq(shareholders.shareholderType, type));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const result = await query.orderBy(desc(shareholders.sharePercentage));
      res.json(result);
    } catch (error) {
      console.error("Error fetching shareholders:", error);
      res.status(500).json({ error: "فشل في جلب المساهمين" });
    }
  });

  app.get("/api/governance/shareholders/:id", isAuthenticated, requirePermission("governance_shareholders", "view"), async (req, res) => {
    try {
      const [shareholder] = await db.select().from(shareholders).where(eq(shareholders.id, parseInt(req.params.id)));
      if (!shareholder) {
        return res.status(404).json({ error: "المساهم غير موجود" });
      }
      res.json(shareholder);
    } catch (error) {
      console.error("Error fetching shareholder:", error);
      res.status(500).json({ error: "فشل في جلب بيانات المساهم" });
    }
  });

  app.post("/api/governance/shareholders", isAuthenticated, requirePermission("governance_shareholders", "create"), async (req, res) => {
    try {
      const data = insertShareholderSchema.parse({
        ...req.body,
        createdBy: getCurrentUserId(req),
      });
      const [shareholder] = await db.insert(shareholders).values(data).returning();
      res.status(201).json(shareholder);
    } catch (error) {
      console.error("Error creating shareholder:", error);
      res.status(500).json({ error: "فشل في إضافة المساهم" });
    }
  });

  app.patch("/api/governance/shareholders/:id", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const validatedData = updateShareholderSchema.parse(req.body);
      const [shareholder] = await db.update(shareholders)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(shareholders.id, parseInt(req.params.id)))
        .returning();
      res.json(shareholder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating shareholder:", error);
      res.status(500).json({ error: "فشل في تحديث بيانات المساهم" });
    }
  });

  app.delete("/api/governance/shareholders/:id", isAuthenticated, requirePermission("governance_shareholders", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(shareholders).where(eq(shareholders.id, id)).returning();
      if (!deleted) {
        return res.status(404).json({ error: "المساهم غير موجود" });
      }
      res.json({ success: true, message: "تم حذف المساهم بنجاح" });
    } catch (error) {
      console.error("Error deleting shareholder:", error);
      res.status(500).json({ error: "فشل في حذف المساهم" });
    }
  });

  // =====================================================
  // Shareholder Documents - وثائق المساهمين
  // =====================================================

  app.get("/api/governance/shareholders/:shareholderId/documents", isAuthenticated, requirePermission("governance_shareholders", "view"), async (req, res) => {
    try {
      const shareholderId = parseInt(req.params.shareholderId);
      const result = await db.select().from(shareholderDocuments)
        .where(eq(shareholderDocuments.shareholderId, shareholderId))
        .orderBy(desc(shareholderDocuments.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching shareholder documents:", error);
      res.status(500).json({ error: "فشل في جلب وثائق المساهم" });
    }
  });

  app.post("/api/governance/shareholders/:shareholderId/documents", isAuthenticated, requirePermission("governance_shareholders", "edit"), async (req, res) => {
    try {
      const shareholderId = parseInt(req.params.shareholderId);
      const userId = (req as any).currentUser?.id;
      const validatedData = insertShareholderDocumentSchema.parse({
        ...req.body,
        shareholderId,
        uploadedBy: userId,
      });
      const [doc] = await db.insert(shareholderDocuments).values(validatedData).returning();
      res.json(doc);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating shareholder document:", error);
      res.status(500).json({ error: "فشل في إضافة الوثيقة" });
    }
  });

  app.delete("/api/governance/shareholders/:shareholderId/documents/:docId", isAuthenticated, requirePermission("governance_shareholders", "delete"), async (req, res) => {
    try {
      const docId = parseInt(req.params.docId);
      const [deleted] = await db.delete(shareholderDocuments).where(eq(shareholderDocuments.id, docId)).returning();
      if (!deleted) {
        return res.status(404).json({ error: "الوثيقة غير موجودة" });
      }
      res.json({ success: true, message: "تم حذف الوثيقة بنجاح" });
    } catch (error) {
      console.error("Error deleting shareholder document:", error);
      res.status(500).json({ error: "فشل في حذف الوثيقة" });
    }
  });

  // Secure document download with full authorization
  app.get("/api/governance/shareholders/:shareholderId/documents/:docId/download", isAuthenticated, requirePermission("governance_shareholders", "view"), async (req, res) => {
    try {
      const shareholderId = parseInt(req.params.shareholderId);
      const docId = parseInt(req.params.docId);
      
      // Verify document belongs to the specified shareholder
      const [doc] = await db.select().from(shareholderDocuments)
        .where(and(
          eq(shareholderDocuments.id, docId),
          eq(shareholderDocuments.shareholderId, shareholderId)
        ));
      
      if (!doc) {
        return res.status(404).json({ error: "الوثيقة غير موجودة" });
      }
      
      // Serve file directly instead of redirecting to public endpoint
      const objectStorageService = new ObjectStorageService();
      const objectPath = doc.fileUrl.replace('/api/protected-files', '');
      
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      
      // Set content disposition to force download with original filename
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalFileName)}"`);
      if (doc.mimeType) {
        res.setHeader('Content-Type', doc.mimeType);
      }
      
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error downloading shareholder document:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "الملف غير موجود في التخزين" });
      }
      res.status(500).json({ error: "فشل في تحميل الوثيقة" });
    }
  });

  // =====================================================
  // Share Transfers - تحويلات الأسهم
  // =====================================================
  
  app.get("/api/governance/share-transfers", isAuthenticated, requirePermission("governance_transfers", "view"), async (req, res) => {
    try {
      const result = await db.select().from(shareTransfers).orderBy(desc(shareTransfers.transferDate));
      res.json(result);
    } catch (error) {
      console.error("Error fetching share transfers:", error);
      res.status(500).json({ error: "فشل في جلب تحويلات الأسهم" });
    }
  });

  app.post("/api/governance/share-transfers", isAuthenticated, requirePermission("governance_transfers", "create"), async (req, res) => {
    try {
      const transferNumber = `ST-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const data = insertShareTransferSchema.parse({
        ...req.body,
        transferNumber,
        createdBy: getCurrentUserId(req),
      });
      const [transfer] = await db.insert(shareTransfers).values(data).returning();
      res.status(201).json(transfer);
    } catch (error) {
      console.error("Error creating share transfer:", error);
      res.status(500).json({ error: "فشل في إنشاء تحويل الأسهم" });
    }
  });

  app.patch("/api/governance/share-transfers/:id/approve", isAuthenticated, requirePermission("governance_transfers", "approve"), async (req, res) => {
    try {
      const [transfer] = await db.update(shareTransfers)
        .set({ 
          approvalStatus: "approved", 
          approvedBy: getCurrentUserId(req),
          approvedAt: new Date()
        })
        .where(eq(shareTransfers.id, parseInt(req.params.id)))
        .returning();
      res.json(transfer);
    } catch (error) {
      console.error("Error approving share transfer:", error);
      res.status(500).json({ error: "فشل في الموافقة على تحويل الأسهم" });
    }
  });

  // =====================================================
  // Governance Meetings - اجتماعات الحوكمة
  // =====================================================
  
  app.get("/api/governance/meetings", isAuthenticated, requirePermission("governance_meetings", "view"), async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const status = req.query.status as string | undefined;
      
      let query = db.select().from(governanceMeetings);
      const conditions: any[] = [];
      
      if (type) conditions.push(eq(governanceMeetings.meetingType, type));
      if (status) conditions.push(eq(governanceMeetings.status, status));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const result = await query.orderBy(desc(governanceMeetings.meetingDate));
      res.json(result);
    } catch (error) {
      console.error("Error fetching governance meetings:", error);
      res.status(500).json({ error: "فشل في جلب الاجتماعات" });
    }
  });

  app.get("/api/governance/meetings/:id", isAuthenticated, requirePermission("governance_meetings", "view"), async (req, res) => {
    try {
      const [meeting] = await db.select().from(governanceMeetings).where(eq(governanceMeetings.id, parseInt(req.params.id)));
      if (!meeting) {
        return res.status(404).json({ error: "الاجتماع غير موجود" });
      }
      res.json(meeting);
    } catch (error) {
      console.error("Error fetching meeting:", error);
      res.status(500).json({ error: "فشل في جلب بيانات الاجتماع" });
    }
  });

  app.post("/api/governance/meetings", isAuthenticated, requirePermission("governance_meetings", "create"), async (req, res) => {
    try {
      const { sendWhatsApp, sendEmail, sendSMS, invitationMessage, meetingLink, meetingPlatform, scheduledDate, quorumRequired, resolutions, resolutionTitle, resolutionContent, ...meetingData } = req.body;
      
      const meetingTypeMap: Record<string, string> = {
        'ordinary': 'ordinary_assembly',
        'extraordinary': 'extraordinary_assembly',
        'ordinary_assembly': 'ordinary_assembly',
        'extraordinary_assembly': 'extraordinary_assembly',
        'board': 'board',
        'committee': 'committee',
      };
      const resolvedMeetingType = meetingTypeMap[meetingData.meetingType] || meetingData.meetingType;

      const insertData: any = {
        ...meetingData,
        meetingType: resolvedMeetingType,
        meetingDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        quorumRequired: quorumRequired ? String(quorumRequired) : "50",
        notes: meetingLink ? `رابط الاجتماع (${meetingPlatform}): ${meetingLink}\n${meetingData.notes || ''}` : meetingData.notes,
        createdBy: getCurrentUserId(req),
      };

      // COMPLIANCE: notice-period check (7 days board / 21 days assembly).
      // `?force=1` lets ADMINS (only) record an emergency meeting after-the-fact.
      // Any forced creation is audit-logged below.
      const isAdmin = (req as any).currentUser?.role === "admin";
      const force = String(req.query.force ?? "") === "1" && isAdmin;
      const noticeErr = validateMeetingNoticePeriod(resolvedMeetingType, insertData.meetingDate);
      if (noticeErr && !force) {
        return res.status(400).json({
          error: noticeErr,
          code: "NOTICE_PERIOD_VIOLATION",
          canForce: isAdmin, // only tell admins they can override
        });
      }
      const forcedNoticeOverride = !!noticeErr && force;

      // 2-in-1: normalize the optional resolution(s). Accept an array
      // `resolutions: [{title, content}]` (new), or a single `resolutionTitle`/
      // `resolutionContent` pair (backward-compatible fallback).
      const rawResolutions: any[] = Array.isArray(resolutions)
        ? resolutions
        : (resolutionTitle || resolutionContent)
          ? [{ title: resolutionTitle, content: resolutionContent }]
          : [];

      // Each row must have both title and content (or be fully empty → skipped),
      // so a half-filled resolution never silently disappears.
      const cleanedResolutions: { title: string; content: string }[] = [];
      for (const raw of rawResolutions) {
        const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
        const content = typeof raw?.content === 'string' ? raw.content.trim() : '';
        if (!title && !content) continue;
        if (!title || !content) {
          return res.status(400).json({ error: "يجب إدخال عنوان القرار ونصّه معاً لكل قرار، أو ترك القرار فارغاً." });
        }
        cleanedResolutions.push({ title, content });
      }

      // Create the meeting (and, when provided, its linked resolutions) atomically.
      // If any resolution insert fails, the whole transaction rolls back so we never
      // end up with a meeting that is missing the resolutions the user asked for.
      // Sequential numbers (MTG-/RES-) are computed inside the transaction; on the rare
      // chance two concurrent creates pick the same number, the unique constraint trips
      // a 23505 and we simply retry with freshly recomputed numbers.
      let meeting: any;
      let createdResolutions: any[] = [];
      const resTypeMap: Record<string, string> = {
        ordinary_assembly: 'general_assembly',
        extraordinary_assembly: 'extraordinary_assembly',
      };
      const MAX_NUMBERING_ATTEMPTS = 5;
      for (let attempt = 1; ; attempt++) {
        try {
          createdResolutions = [];
          meeting = await db.transaction(async (tx) => {
            const year = new Date().getFullYear();
            const maxResult = await tx.select({ maxNum: sql<string>`MAX(meeting_number)` }).from(governanceMeetings);
            const lastNum = maxResult[0]?.maxNum ? parseInt(String(maxResult[0].maxNum).replace(/\D/g, '').slice(-4)) || 0 : 0;
            const meetingNumber = `MTG-${year}-${String(lastNum + 1).padStart(4, '0')}`;

            const [m] = await tx.insert(governanceMeetings).values({ ...insertData, meetingNumber }).returning();

            if (cleanedResolutions.length > 0) {
              const resYear = new Date().getFullYear();
              const maxResResult = await tx
                .select({ maxNum: sql<string>`MAX(resolution_number)` })
                .from(boardResolutions)
                .where(sql`resolution_number LIKE ${`RES-${resYear}-%`}`);
              let nextNum = maxResResult[0]?.maxNum
                ? parseInt(String(maxResResult[0].maxNum).split('-').pop() || '0', 10) || 0
                : 0;
              for (const r of cleanedResolutions) {
                nextNum += 1;
                const resolutionNumber = `RES-${resYear}-${String(nextNum).padStart(4, '0')}`;
                const [created] = await tx.insert(boardResolutions).values({
                  resolutionNumber,
                  meetingId: m.id,
                  resolutionType: resTypeMap[resolvedMeetingType] || 'general_assembly',
                  title: r.title,
                  description: r.content,
                  category: 'governance',
                  status: 'voting',
                  proposedBy: getCurrentUserId(req),
                  proposedAt: new Date(),
                  createdBy: getCurrentUserId(req),
                }).returning();
                createdResolutions.push(created);
              }
            }
            return m;
          });
          break;
        } catch (txErr: any) {
          if (txErr?.code === '23505' && attempt < MAX_NUMBERING_ATTEMPTS) {
            continue; // numbering collision under concurrency — retry with fresh numbers
          }
          throw txErr;
        }
      }

      // AUDIT: log any forced notice-period override so the secretariat can
      // explain it to the auditor later.
      if (forcedNoticeOverride) {
        try {
          await db.insert(systemAuditLogs).values({
            module: "governance_meetings",
            entityId: String(meeting.id),
            entityName: meeting.title,
            action: "force_create_short_notice",
            details: JSON.stringify({
              meetingId: meeting.id,
              meetingType: resolvedMeetingType,
              meetingDate: insertData.meetingDate,
              noticeViolation: noticeErr,
            }),
            userId: getCurrentUserId(req),
            userName: (req as any).currentUser?.username || "system",
            ipAddress: req.ip || req.socket.remoteAddress || "unknown",
          });
        } catch (auditErr) {
          console.error("Failed to audit forced notice override:", auditErr);
        }
      }

      let invitationResults = null;
      if (sendWhatsApp || sendSMS) {
        try {
          const shareholdersList = await db.select().from(shareholders).where(eq(shareholders.votingRights, true));
          
          if (shareholdersList.length > 0) {
            const meetingDateObj = new Date(scheduledDate || meetingData.meetingDate);
            const invitation = {
              meetingTitle: meetingData.title,
              meetingDate: meetingDateObj.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
              meetingTime: meetingDateObj.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
              location: meetingData.location || 'سيتم تحديده لاحقاً',
              meetingLink: meetingLink,
              agenda: meetingData.agenda,
              resolutionText: createdResolutions.length > 0
                ? createdResolutions
                    .map((r, i) => `${createdResolutions.length > 1 ? `(${i + 1}) ` : ''}${r.title}\n${r.description}`)
                    .join('\n\n')
                : undefined,
            };

            invitationResults = await sendMeetingInvitations(
              shareholdersList.map(s => ({ fullName: s.fullName, phone: s.phone || undefined, email: s.email || undefined })),
              invitation,
              { sendWhatsApp: !!sendWhatsApp, sendSMS: !!sendSMS }
            );

            await db.insert(systemAuditLogs).values({
              module: 'governance_meetings',
              entityId: String(meeting.id),
              entityName: meeting.title,
              action: 'send_invitations',
              details: JSON.stringify({ 
                meetingId: meeting.id, 
                channels: { whatsapp: sendWhatsApp, sms: sendSMS },
                results: invitationResults 
              }),
              userId: getCurrentUserId(req),
              userName: (req as any).currentUser?.username || 'system',
              ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
            });
          }
        } catch (inviteError) {
          console.error("Error sending invitations (meeting created successfully):", inviteError);
          invitationResults = { sent: 0, failed: 0, error: "فشل في إرسال الدعوات لكن تم إنشاء الاجتماع بنجاح" };
        }
      }

      res.status(201).json({ ...meeting, invitationResults, resolutions: createdResolutions });
    } catch (error) {
      console.error("Error creating meeting:", error);
      res.status(500).json({ error: "فشل في إنشاء الاجتماع" });
    }
  });

  app.post("/api/governance/meetings/:id/send-invitations", isAuthenticated, requirePermission("governance_meetings", "edit"), async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const { sendWhatsApp, sendSMS } = req.body;

      const [meeting] = await db.select().from(governanceMeetings).where(eq(governanceMeetings.id, meetingId));
      if (!meeting) {
        return res.status(404).json({ error: "الاجتماع غير موجود" });
      }

      const shareholdersList = await db.select().from(shareholders).where(eq(shareholders.votingRights, true));
      
      if (shareholdersList.length === 0) {
        return res.json({ sent: 0, failed: 0, results: [], message: "لا يوجد مساهمين لديهم حق التصويت" });
      }

      const shareholdersWithPhones = shareholdersList.filter(s => s.phone);
      const shareholdersWithoutPhones = shareholdersList.filter(s => !s.phone);

      const existingRsvps = await db.select().from(meetingRsvps).where(eq(meetingRsvps.meetingId, meetingId));
      const existingTokenMap = new Map(existingRsvps.map(r => [r.shareholderId, r]));
      const rsvpTokenMap = new Map<number, string>();

      for (const shareholder of shareholdersList) {
        if (existingTokenMap.has(shareholder.id)) {
          rsvpTokenMap.set(shareholder.id, existingTokenMap.get(shareholder.id)!.token);
        } else {
          const token = crypto.randomBytes(32).toString('hex');
          await db.insert(meetingRsvps).values({
            meetingId,
            shareholderId: shareholder.id,
            token,
            status: 'pending',
            shareholderName: shareholder.fullName,
            shareholderPhone: shareholder.phone || null,
          });
          rsvpTokenMap.set(shareholder.id, token);
        }
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      const meetingDateObj = new Date(meeting.meetingDate);
      const invitation = {
        meetingTitle: meeting.title,
        meetingDate: meetingDateObj.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        meetingTime: meetingDateObj.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        location: meeting.location || 'سيتم تحديده لاحقاً',
        meetingLink: meeting.virtualMeetingLink || undefined,
        agenda: meeting.agenda || undefined,
      };

      const invitationResults = await sendMeetingInvitations(
        shareholdersWithPhones.map(s => ({ fullName: s.fullName, phone: s.phone || undefined, email: s.email || undefined })),
        invitation,
        { sendWhatsApp: !!sendWhatsApp, sendSMS: !!sendSMS }
      );

      await db.insert(systemAuditLogs).values({
        module: 'governance_meetings',
        entityId: String(meetingId),
        entityName: meeting.title,
        action: 'resend_invitations',
        details: JSON.stringify({ 
          meetingId, 
          channels: { whatsapp: sendWhatsApp, sms: sendSMS },
          results: invitationResults,
          shareholdersWithoutPhones: shareholdersWithoutPhones.map(s => s.fullName),
        }),
        userId: getCurrentUserId(req),
        userName: (req as any).currentUser?.username || 'system',
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      });

      const whatsappLinks = shareholdersWithPhones.map(s => {
        const rsvpToken = rsvpTokenMap.get(s.id);
        const rsvpUrl = rsvpToken ? `${baseUrl}/rsvp/${rsvpToken}` : '';
        return {
          name: s.fullName,
          phone: s.phone!,
          rsvpUrl,
          whatsappLink: generateWhatsAppLinks(
            [{ fullName: s.fullName, phone: s.phone || undefined }],
            { ...invitation, meetingLink: rsvpUrl || invitation.meetingLink }
          )[0]?.whatsappLink || '',
        };
      });

      res.json({
        ...invitationResults,
        totalShareholders: shareholdersList.length,
        withPhones: shareholdersWithPhones.length,
        withoutPhones: shareholdersWithoutPhones.map(s => ({ name: s.fullName, id: s.id })),
        whatsappLinks,
      });
    } catch (error) {
      console.error("Error sending invitations:", error);
      res.status(500).json({ error: "فشل في إرسال الدعوات" });
    }
  });

  app.get("/api/governance/shareholders-phones", isAuthenticated, requirePermission("governance_shareholders", "view"), async (req, res) => {
    try {
      const shareholdersList = await db.select({
        id: shareholders.id,
        fullName: shareholders.fullName,
        phone: shareholders.phone,
        email: shareholders.email,
        votingRights: shareholders.votingRights,
        status: shareholders.status,
        sharePercentage: shareholders.sharePercentage,
      }).from(shareholders).where(eq(shareholders.status, 'active'));
      
      res.json({
        shareholders: shareholdersList,
        summary: {
          total: shareholdersList.length,
          withPhone: shareholdersList.filter(s => s.phone).length,
          withoutPhone: shareholdersList.filter(s => !s.phone).length,
          withVotingRights: shareholdersList.filter(s => s.votingRights).length,
        },
        twilioConfigured: isTwilioConfigured(),
      });
    } catch (error) {
      console.error("Error fetching shareholders phones:", error);
      res.status(500).json({ error: "فشل في جلب بيانات المساهمين" });
    }
  });

  app.patch("/api/governance/meetings/:id", isAuthenticated, requirePermission("governance_meetings", "edit"), async (req, res) => {
    try {
      // تحويل حقول التاريخ من نص ISO إلى كائن Date قبل التحقق
      // (مخطط drizzle-zod لأعمدة timestamp يتوقع Date وليس نصاً)
      const body: any = { ...req.body };
      for (const field of ["meetingDate", "postponedTo", "invitationSentAt", "reminderSentAt", "minutesApprovedAt"]) {
        if (typeof body[field] === "string" && body[field]) {
          const d = new Date(body[field]);
          if (!isNaN(d.getTime())) body[field] = d;
        }
      }
      const validatedData = updateGovernanceMeetingSchema.parse(body);
      const [meeting] = await db.update(governanceMeetings)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(governanceMeetings.id, parseInt(req.params.id)))
        .returning();
      res.json(meeting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating meeting:", error);
      res.status(500).json({ error: "فشل في تحديث الاجتماع" });
    }
  });

  app.delete("/api/governance/meetings/:id", isAuthenticated, requirePermission("governance_meetings", "delete"), async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const [meeting] = await db.select().from(governanceMeetings).where(eq(governanceMeetings.id, meetingId));
      if (!meeting) {
        return res.status(404).json({ error: "الاجتماع غير موجود" });
      }
      await db.delete(governanceMeetings).where(eq(governanceMeetings.id, meetingId));
      res.json({ success: true, message: "تم حذف الاجتماع بنجاح" });
    } catch (error) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ error: "فشل في حذف الاجتماع" });
    }
  });

  // =====================================================
  // Meeting Attendance - حضور الاجتماعات
  // =====================================================
  
  app.get("/api/governance/meetings/:meetingId/attendance", isAuthenticated, requirePermission("governance_meetings", "view"), async (req, res) => {
    try {
      const result = await db.select().from(meetingAttendance)
        .where(eq(meetingAttendance.meetingId, parseInt(req.params.meetingId)));
      res.json(result);
    } catch (error) {
      console.error("Error fetching attendance:", error);
      res.status(500).json({ error: "فشل في جلب سجل الحضور" });
    }
  });

  app.post("/api/governance/meetings/:meetingId/attendance", isAuthenticated, requirePermission("governance_meetings", "create"), async (req, res) => {
    try {
      const data = insertMeetingAttendanceSchema.parse({
        ...req.body,
        meetingId: parseInt(req.params.meetingId),
      });
      const [attendance] = await db.insert(meetingAttendance).values(data).returning();
      res.status(201).json(attendance);
    } catch (error) {
      console.error("Error creating attendance record:", error);
      res.status(500).json({ error: "فشل في تسجيل الحضور" });
    }
  });

  app.post("/api/governance/meetings/:meetingId/attendance/bulk", isAuthenticated, requirePermission("governance_meetings", "create"), async (req, res) => {
    try {
      const meetingId = parseInt(req.params.meetingId);
      const { attendees } = req.body;

      if (!Array.isArray(attendees) || attendees.length === 0) {
        return res.status(400).json({ error: "يجب توفير قائمة الحضور" });
      }

      await db.delete(meetingAttendance).where(eq(meetingAttendance.meetingId, meetingId));

      const records = attendees.map((a: any) => ({
        meetingId,
        attendeeType: "shareholder" as const,
        shareholderId: a.shareholderId,
        attendeeName: a.attendeeName,
        representedShares: a.representedShares || 0,
        attendanceStatus: a.present ? "present" : "absent",
        attendanceMethod: a.proxyName ? "proxy" : "in_person",
        proxyHolderName: a.proxyName || null,
        votingPower: a.votingPower || null,
        signatureUrl: a.signatureUrl || null,
        signedAt: a.signedAt ? new Date(a.signedAt) : null,
      }));

      const result = await db.insert(meetingAttendance).values(records).returning();
      res.status(201).json({ saved: result.length, records: result });
    } catch (error) {
      console.error("Error saving bulk attendance:", error);
      res.status(500).json({ error: "فشل في حفظ سجل الحضور" });
    }
  });

  app.patch("/api/governance/attendance/:id", isAuthenticated, requirePermission("governance_meetings", "edit"), async (req, res) => {
    try {
      const validatedData = updateMeetingAttendanceSchema.parse(req.body);
      const [attendance] = await db.update(meetingAttendance)
        .set(validatedData)
        .where(eq(meetingAttendance.id, parseInt(req.params.id)))
        .returning();
      res.json(attendance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating attendance:", error);
      res.status(500).json({ error: "فشل في تحديث سجل الحضور" });
    }
  });

  // =====================================================
  // Meeting Minutes - محاضر الاجتماعات
  // =====================================================
  
  app.get("/api/governance/minutes", isAuthenticated, requirePermission("governance_meetings", "view"), async (req, res) => {
    try {
      const result = await db.select().from(meetingMinutes).orderBy(desc(meetingMinutes.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching minutes:", error);
      res.status(500).json({ error: "فشل في جلب المحاضر" });
    }
  });

  app.get("/api/governance/meetings/:meetingId/minutes", isAuthenticated, requirePermission("governance_meetings", "view"), async (req, res) => {
    try {
      const [minutes] = await db.select().from(meetingMinutes)
        .where(eq(meetingMinutes.meetingId, parseInt(req.params.meetingId)));
      res.json(minutes || null);
    } catch (error) {
      console.error("Error fetching meeting minutes:", error);
      res.status(500).json({ error: "فشل في جلب محضر الاجتماع" });
    }
  });

  app.post("/api/governance/minutes", isAuthenticated, requirePermission("governance_meetings", "create"), async (req, res) => {
    try {
      const year = new Date().getFullYear();
      const maxMinResult = await db.select({ maxNum: sql<string>`MAX(minutes_number)` }).from(meetingMinutes);
      const lastMinNum = maxMinResult[0]?.maxNum ? parseInt(maxMinResult[0].maxNum.replace(/\D/g, '').slice(-4)) : 0;
      const minutesNumber = `MIN-${year}-${String(lastMinNum + 1).padStart(4, '0')}`;
      
      const data = insertMeetingMinutesSchema.parse({
        ...req.body,
        minutesNumber,
        createdBy: getCurrentUserId(req),
        preparedBy: getCurrentUserId(req),
        preparedAt: new Date(),
      });
      const [minutes] = await db.insert(meetingMinutes).values(data).returning();
      res.status(201).json(minutes);
    } catch (error) {
      console.error("Error creating minutes:", error);
      res.status(500).json({ error: "فشل في إنشاء المحضر" });
    }
  });

  app.patch("/api/governance/minutes/:id", isAuthenticated, requirePermission("governance_meetings", "edit"), async (req, res) => {
    try {
      const minutesId = parseInt(req.params.id);
      const validatedData = updateMeetingMinutesSchema.parse(req.body);

      // IMMUTABILITY: a locked minutes record MUST NOT be modified — the only
      // exception is an explicit admin "unlock" workflow (a separate endpoint,
      // not present yet). Even the lock flag itself cannot be cleared via PATCH.
      const [existing] = await db.select().from(meetingMinutes).where(eq(meetingMinutes.id, minutesId));
      if (!existing) return res.status(404).json({ error: "المحضر غير موجود" });
      if ((existing as any).isLocked) {
        return res.status(423).json({ error: "المحضر مقفل ولا يمكن تعديله بعد توقيعه/اعتماده", code: "MINUTES_LOCKED" });
      }
      // Strip any attempt to flip lock state via this endpoint.
      delete (validatedData as any).isLocked;
      delete (validatedData as any).lockedAt;
      delete (validatedData as any).lockedBy;

      const [minutes] = await db.update(meetingMinutes)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(meetingMinutes.id, minutesId))
        .returning();
      res.json(minutes);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating minutes:", error);
      res.status(500).json({ error: "فشل في تحديث المحضر" });
    }
  });

  // IMMUTABILITY: dedicated "lock" endpoint — admin/secretary stamps the minutes
  // as final. After this, PATCH/DELETE return 423.
  app.post("/api/governance/minutes/:id/lock", isAuthenticated, requirePermission("governance_meetings", "edit"), async (req, res) => {
    try {
      const minutesId = parseInt(req.params.id);
      const [existing] = await db.select().from(meetingMinutes).where(eq(meetingMinutes.id, minutesId));
      if (!existing) return res.status(404).json({ error: "المحضر غير موجود" });
      if ((existing as any).isLocked) return res.status(409).json({ error: "المحضر مقفل بالفعل" });
      const [locked] = await db.update(meetingMinutes)
        .set({ isLocked: true, lockedAt: new Date(), lockedBy: getCurrentUserId(req), updatedAt: new Date() } as any)
        .where(eq(meetingMinutes.id, minutesId))
        .returning();
      res.json(locked);
    } catch (error) {
      console.error("Error locking minutes:", error);
      res.status(500).json({ error: "فشل في قفل المحضر" });
    }
  });

  app.delete("/api/governance/minutes/:id", isAuthenticated, async (req, res) => {
    try {
      const currentUser = (req as any).currentUser;
      if (currentUser?.role !== "admin") {
        return res.status(403).json({ error: "صلاحية الحذف متاحة للمدير فقط" });
      }
      const minutesId = parseInt(req.params.id);
      const [existing] = await db.select().from(meetingMinutes).where(eq(meetingMinutes.id, minutesId));
      if (!existing) {
        return res.status(404).json({ error: "المحضر غير موجود" });
      }
      // IMMUTABILITY: locked minutes cannot be deleted (corporate-record retention).
      if ((existing as any).isLocked) {
        return res.status(423).json({ error: "المحضر مقفل ولا يمكن حذفه — السجلات الرسمية محفوظة بحكم النظام", code: "MINUTES_LOCKED" });
      }
      await db.delete(meetingMinutes).where(eq(meetingMinutes.id, minutesId));
      res.json({ message: "تم حذف المحضر بنجاح" });
    } catch (error) {
      console.error("Error deleting minutes:", error);
      res.status(500).json({ error: "فشل في حذف المحضر" });
    }
  });

  // =====================================================
  // Board Resolutions - قرارات مجلس الإدارة
  // =====================================================
  
  app.get("/api/governance/resolutions", isAuthenticated, requirePermission("governance_resolutions", "view"), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;
      
      let query = db.select().from(boardResolutions);
      const conditions: any[] = [];
      // Hide soft-deleted resolutions from the normal list (they live in the recycle bin).
      conditions.push(isNull(boardResolutions.deletedAt));
      
      if (status) conditions.push(eq(boardResolutions.status, status));
      if (type) conditions.push(eq(boardResolutions.resolutionType, type));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const result = await query.orderBy(desc(boardResolutions.proposedAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching resolutions:", error);
      res.status(500).json({ error: "فشل في جلب القرارات" });
    }
  });

  app.get("/api/governance/resolutions/:id", isAuthenticated, requirePermission("governance_resolutions", "view"), async (req, res) => {
    try {
      const [resolution] = await db.select().from(boardResolutions).where(eq(boardResolutions.id, parseInt(req.params.id)));
      if (!resolution || (resolution as any).deletedAt) {
        return res.status(404).json({ error: "القرار غير موجود" });
      }
      res.json(resolution);
    } catch (error) {
      console.error("Error fetching resolution:", error);
      res.status(500).json({ error: "فشل في جلب القرار" });
    }
  });

  app.post("/api/governance/resolutions", isAuthenticated, requirePermission("governance_resolutions", "create"), async (req, res) => {
    try {
      const year = new Date().getFullYear();
      // Compute next number scoped to this year only, to avoid collisions across years
      const maxResResult = await db
        .select({ maxNum: sql<string>`MAX(resolution_number)` })
        .from(boardResolutions)
        .where(sql`resolution_number LIKE ${`RES-${year}-%`}`);
      const lastResNum = maxResResult[0]?.maxNum
        ? parseInt(String(maxResResult[0].maxNum).split('-').pop() || '0', 10) || 0
        : 0;
      const resolutionNumber = `RES-${year}-${String(lastResNum + 1).padStart(4, '0')}`;

      const data = insertBoardResolutionSchema.parse({
        ...req.body,
        resolutionNumber,
        proposedBy: getCurrentUserId(req),
        proposedAt: new Date(),
        createdBy: getCurrentUserId(req),
      });
      const [resolution] = await db.insert(boardResolutions).values(data).returning();
      res.status(201).json(resolution);
    } catch (error: any) {
      console.error("Error creating resolution:", error);
      // Surface the real reason so the user can see it in the browser network tab
      const message =
        error?.code === '23505'
          ? `رقم القرار مستخدم بالفعل: ${error?.detail || error?.constraint || ''}`
          : error?.issues
            ? `بيانات غير صالحة: ${error.issues.map((i: any) => `${i.path?.join('.')}: ${i.message}`).join(' | ')}`
            : error?.message || 'فشل في إنشاء القرار';
      res.status(500).json({ error: message, code: error?.code, detail: error?.detail });
    }
  });

  app.patch("/api/governance/resolutions/:id", isAuthenticated, requirePermission("governance_resolutions", "edit"), async (req, res) => {
    try {
      const resolutionId = parseInt(req.params.id);
      const validatedData = updateBoardResolutionSchema.parse(req.body);

      // IMMUTABILITY: locked resolutions cannot be modified.
      const [existing] = await db.select().from(boardResolutions).where(eq(boardResolutions.id, resolutionId));
      if (!existing) return res.status(404).json({ error: "القرار غير موجود" });
      if ((existing as any).isLocked) {
        return res.status(423).json({ error: "القرار مقفل ولا يمكن تعديله بعد اعتماده/توقيعه", code: "RESOLUTION_LOCKED" });
      }
      delete (validatedData as any).isLocked;
      delete (validatedData as any).lockedAt;
      delete (validatedData as any).lockedBy;
      // SAFEGUARD: never allow soft-delete fields to be changed via the edit route.
      // Deletion/restore must go through the dedicated admin-only endpoints.
      delete (validatedData as any).deletedAt;
      delete (validatedData as any).deletedBy;
      delete (validatedData as any).deletionReason;

      const [resolution] = await db.update(boardResolutions)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(boardResolutions.id, resolutionId))
        .returning();
      res.json(resolution);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating resolution:", error);
      res.status(500).json({ error: "فشل في تحديث القرار" });
    }
  });

  // IMMUTABILITY: dedicated "lock" endpoint for board resolutions.
  app.post("/api/governance/resolutions/:id/lock", isAuthenticated, requirePermission("governance_resolutions", "edit"), async (req, res) => {
    try {
      const resolutionId = parseInt(req.params.id);
      const [existing] = await db.select().from(boardResolutions).where(eq(boardResolutions.id, resolutionId));
      if (!existing) return res.status(404).json({ error: "القرار غير موجود" });
      if ((existing as any).isLocked) return res.status(409).json({ error: "القرار مقفل بالفعل" });
      const [locked] = await db.update(boardResolutions)
        .set({ isLocked: true, lockedAt: new Date(), lockedBy: getCurrentUserId(req), updatedAt: new Date() } as any)
        .where(eq(boardResolutions.id, resolutionId))
        .returning();
      res.json(locked);
    } catch (error) {
      console.error("Error locking resolution:", error);
      res.status(500).json({ error: "فشل في قفل القرار" });
    }
  });

  // ADMIN-ONLY "unlock" endpoint — deliberately reopens a locked resolution so it
  // can be edited again. This is an explicit, audited escape hatch (clears the lock
  // flag and records who reopened it). Only an admin may perform it.
  app.post("/api/governance/resolutions/:id/unlock", isAuthenticated, requirePermission("governance_resolutions", "edit"), async (req, res) => {
    try {
      const user = (req as any).currentUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ error: "فقط المسؤول يمكنه فتح قفل القرار" });
      }
      const resolutionId = parseInt(req.params.id);
      const reason = (req.body?.reason || '').toString().trim();
      const [existing] = await db.select().from(boardResolutions).where(eq(boardResolutions.id, resolutionId));
      if (!existing) return res.status(404).json({ error: "القرار غير موجود" });
      if (!(existing as any).isLocked) return res.status(409).json({ error: "القرار غير مقفل" });
      const unlocked = await db.transaction(async (tx) => {
        const [row] = await tx.update(boardResolutions)
          .set({ isLocked: false, lockedAt: null, lockedBy: null, updatedAt: new Date() } as any)
          .where(eq(boardResolutions.id, resolutionId))
          .returning();
        // Audit trail: record who reopened a locked resolution and why (compliance).
        await tx.insert(systemAuditLogs).values({
          module: 'governance',
          entityId: String(resolutionId),
          entityName: (existing as any).resolutionNumber || (existing as any).title,
          action: 'update',
          details: JSON.stringify({
            type: 'unlock',
            resolutionNumber: (existing as any).resolutionNumber,
            title: (existing as any).title,
            reason: reason || null,
            previousLockedAt: (existing as any).lockedAt || null,
            previousLockedBy: (existing as any).lockedBy || null,
          }),
          userId: getCurrentUserId(req),
          userName: (req as any).currentUser?.username || 'system',
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        });
        return row;
      });
      res.json(unlocked);
    } catch (error) {
      console.error("Error unlocking resolution:", error);
      res.status(500).json({ error: "فشل في فتح قفل القرار" });
    }
  });

  app.delete("/api/governance/resolutions/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).currentUser;
      if (user?.role !== 'admin') {
        return res.status(403).json({ error: "فقط المسؤول يمكنه حذف القرارات" });
      }
      
      const resolutionId = parseInt(req.params.id);

      const reason = (req.body?.reason || '').toString().trim();

      // IMMUTABILITY: locked resolutions cannot be deleted.
      const [existing] = await db.select().from(boardResolutions).where(eq(boardResolutions.id, resolutionId));
      if (!existing) return res.status(404).json({ error: "القرار غير موجود" });
      if ((existing as any).deletedAt) {
        return res.status(409).json({ error: "القرار محذوف بالفعل وموجود في سلة المحذوفات" });
      }
      if ((existing as any).isLocked) {
        return res.status(423).json({ error: "القرار مقفل ولا يمكن حذفه — السجلات الرسمية محفوظة بحكم النظام", code: "RESOLUTION_LOCKED" });
      }

      // PROTECTION ("محكمة"): a resolution that has been voted on or signed can NEVER be
      // deleted — not even softly. It must be cancelled (change status) instead. This
      // guarantees voted/signed decisions are never lost, even by an admin mistake.
      const [{ votes = 0 } = {}] = await db
        .select({ votes: sql<number>`count(*)::int` })
        .from(resolutionVotes)
        .where(eq(resolutionVotes.resolutionId, resolutionId));
      const [{ signed = 0 } = {}] = await db
        .select({ signed: sql<number>`count(*)::int` })
        .from(resolutionSignatures)
        .where(and(eq(resolutionSignatures.resolutionId, resolutionId), eq(resolutionSignatures.status, 'signed')));
      const [{ casts = 0 } = {}] = await db
        .select({ casts: sql<number>`count(*)::int` })
        .from(votingTokens)
        .where(and(eq(votingTokens.resolutionId, resolutionId), sql`vote IS NOT NULL`));
      const protectedStatuses = ['voting', 'approved', 'rejected', 'implemented'];
      if (votes > 0 || signed > 0 || casts > 0 || protectedStatuses.includes(String((existing as any).status))) {
        return res.status(423).json({
          error: "لا يمكن حذف هذا القرار لأنه تم التصويت عليه أو توقيعه. لحمايته من الفقدان، غيّر حالته إلى \"ملغي\" بدلاً من الحذف.",
          code: "RESOLUTION_HAS_VOTES",
        });
      }

      // SOFT DELETE: move to recycle bin. Child rows (tokens/signatures/votes) are kept intact.
      // Wrapped in a transaction so the soft-delete and its audit record always commit together.
      const deleted = await db.transaction(async (tx) => {
        const [row] = await tx.update(boardResolutions)
          .set({
            deletedAt: new Date(),
            deletedBy: getCurrentUserId(req),
            deletionReason: reason || null,
            updatedAt: new Date(),
          } as any)
          .where(eq(boardResolutions.id, resolutionId))
          .returning();

        // Audit trail: every deletion is permanently recorded.
        await tx.insert(systemAuditLogs).values({
          module: 'governance',
          entityId: String(resolutionId),
          entityName: (existing as any).resolutionNumber || (existing as any).title,
          action: 'delete',
          details: JSON.stringify({ resolutionNumber: (existing as any).resolutionNumber, title: (existing as any).title, reason: reason || null, type: 'soft_delete' }),
          userId: getCurrentUserId(req),
          userName: (req as any).currentUser?.username || 'system',
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        });
        return row;
      });

      if (!deleted) {
        return res.status(404).json({ error: "القرار غير موجود" });
      }

      res.json({ success: true, message: "تم نقل القرار إلى سلة المحذوفات ويمكن استرجاعه" });
    } catch (error) {
      console.error("Error deleting resolution:", error);
      res.status(500).json({ error: "فشل في حذف القرار" });
    }
  });

  // Recycle bin: list soft-deleted board resolutions (admin only).
  app.get("/api/governance/resolutions-trash", isAuthenticated, requirePermission("governance_resolutions", "delete"), async (req, res) => {
    try {
      const rows = await db.select().from(boardResolutions)
        .where(sql`deleted_at IS NOT NULL`)
        .orderBy(desc(boardResolutions.deletedAt));
      res.json(rows);
    } catch (error) {
      console.error("Error fetching deleted resolutions:", error);
      res.status(500).json({ error: "فشل في جلب سلة المحذوفات" });
    }
  });

  // Restore a soft-deleted board resolution (admin only).
  app.post("/api/governance/resolutions/:id/restore", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).currentUser;
      if (user?.role !== 'admin') return res.status(403).json({ error: "فقط المسؤول يمكنه استرجاع القرارات" });
      const resolutionId = parseInt(req.params.id);
      const [existing] = await db.select().from(boardResolutions).where(eq(boardResolutions.id, resolutionId));
      if (!existing) return res.status(404).json({ error: "القرار غير موجود" });
      if (!(existing as any).deletedAt) return res.status(409).json({ error: "القرار غير محذوف" });

      const restored = await db.transaction(async (tx) => {
        const [row] = await tx.update(boardResolutions)
          .set({ deletedAt: null, deletedBy: null, deletionReason: null, updatedAt: new Date() } as any)
          .where(eq(boardResolutions.id, resolutionId))
          .returning();

        await tx.insert(systemAuditLogs).values({
          module: 'governance',
          entityId: String(resolutionId),
          entityName: (existing as any).resolutionNumber || (existing as any).title,
          action: 'restore',
          details: JSON.stringify({ resolutionNumber: (existing as any).resolutionNumber, title: (existing as any).title }),
          userId: getCurrentUserId(req),
          userName: (req as any).currentUser?.username || 'system',
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        });
        return row;
      });

      res.json({ success: true, message: "تم استرجاع القرار", resolution: restored });
    } catch (error) {
      console.error("Error restoring resolution:", error);
      res.status(500).json({ error: "فشل في استرجاع القرار" });
    }
  });

  // =====================================================
  // Assembly Resolutions - قرارات الجمعية العمومية (OGM + EGM)
  // Distinct from board resolutions; share-weighted voting + special quorums.
  // =====================================================
  app.get("/api/governance/assembly-resolutions", isAuthenticated, requirePermission("governance_resolutions", "view"), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const assemblyType = req.query.assemblyType as string | undefined;
      const conditions: any[] = [];
      conditions.push(isNull(assemblyResolutions.deletedAt));
      if (status) conditions.push(eq(assemblyResolutions.status, status));
      if (assemblyType) conditions.push(eq(assemblyResolutions.assemblyType, assemblyType));
      let q = db.select().from(assemblyResolutions) as any;
      if (conditions.length) q = q.where(and(...conditions));
      const rows = await q.orderBy(desc(assemblyResolutions.proposedAt));
      res.json(rows);
    } catch (error) {
      console.error("Error fetching assembly resolutions:", error);
      res.status(500).json({ error: "فشل في جلب قرارات الجمعية" });
    }
  });

  app.get("/api/governance/assembly-resolutions/:id", isAuthenticated, requirePermission("governance_resolutions", "view"), async (req, res) => {
    try {
      const [row] = await db.select().from(assemblyResolutions).where(eq(assemblyResolutions.id, parseInt(req.params.id)));
      if (!row || (row as any).deletedAt) return res.status(404).json({ error: "قرار الجمعية غير موجود" });
      res.json(row);
    } catch (error) {
      console.error("Error fetching assembly resolution:", error);
      res.status(500).json({ error: "فشل في جلب قرار الجمعية" });
    }
  });

  // Download the previously-signed original document (PDF) attached to a specific
  // assembly resolution. The attachment is stored in Supabase under
  // attachments[] with type === "signed_original". Only resolutions that actually
  // have such a document expose the download button on the client.
  app.get("/api/governance/assembly-resolutions/:id/signed-document", isAuthenticated, requirePermission("governance_resolutions", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [row] = await db.select().from(assemblyResolutions).where(eq(assemblyResolutions.id, id));
      if (!row || (row as any).deletedAt) return res.status(404).json({ error: "قرار الجمعية غير موجود" });
      const atts = Array.isArray((row as any).attachments) ? (row as any).attachments : [];
      const signed = atts.find((a: any) => a?.type === "signed_original" && a?.path);
      if (!signed) return res.status(404).json({ error: "لا يوجد مستند موقّع مرفق لهذا القرار" });
      // SECURITY: only allow our own controlled object-key convention (no slashes,
      // no traversal) so a tampered path can never exfiltrate an arbitrary file
      // from the shared documents bucket. Signed originals are uploaded as
      // `assembly_<...>.pdf` at the bucket root.
      const safePath = String(signed.path);
      if (!/^assembly_[A-Za-z0-9._-]+\.pdf$/.test(safePath)) {
        return res.status(400).json({ error: "مسار المستند غير صالح" });
      }
      const { downloadFromSupabase } = await import("./supabase-storage");
      const file = await downloadFromSupabase(signed.path);
      if (!file) return res.status(404).json({ error: "تعذّر العثور على الملف في التخزين" });
      const buffer = Buffer.from(await file.data.arrayBuffer());
      const fileName = signed.name || `resolution-${(row as any).resolutionNumber}.pdf`;
      res.setHeader("Content-Type", signed.mime || "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.send(buffer);
    } catch (e: any) {
      console.error("[governance] signed-document download error:", e);
      res.status(500).json({ error: e?.message || "فشل تحميل المستند الموقّع" });
    }
  });

  app.post("/api/governance/assembly-resolutions", isAuthenticated, requirePermission("governance_resolutions", "create"), async (req, res) => {
    try {
      const year = new Date().getFullYear();
      const at = (req.body.assemblyType === "extraordinary") ? "EGM" : "OGM";
      const maxRes = await db.select({ maxNum: sql<string>`MAX(resolution_number)` })
        .from(assemblyResolutions)
        .where(sql`resolution_number LIKE ${`AR-${year}-${at}-%`}`);
      const lastNum = maxRes[0]?.maxNum
        ? parseInt(String(maxRes[0].maxNum).split('-').pop() || '0', 10) || 0
        : 0;
      const resolutionNumber = `AR-${year}-${at}-${String(lastNum + 1).padStart(4, '0')}`;
      // Default required majority per Saudi law: EGM needs ⅔ for several types.
      const defaultMajority =
        req.body.assemblyType === "extraordinary"
          ? (["capital_change", "statute_amendment", "merger", "dissolution"].includes(req.body.resolutionType) ? "two_thirds" : "simple")
          : "simple";
      const data = insertAssemblyResolutionSchema.parse({
        ...req.body,
        resolutionNumber,
        majorityType: req.body.majorityType ?? defaultMajority,
        proposedBy: getCurrentUserId(req),
        proposedAt: new Date(),
        createdBy: getCurrentUserId(req),
      });
      const [row] = await db.insert(assemblyResolutions).values(data).returning();
      res.status(201).json(row);
    } catch (error: any) {
      console.error("Error creating assembly resolution:", error);
      const message = error?.code === '23505'
        ? `رقم القرار مستخدم بالفعل: ${error?.detail || ''}`
        : error?.issues
          ? `بيانات غير صالحة: ${error.issues.map((i: any) => `${i.path?.join('.')}: ${i.message}`).join(' | ')}`
          : error?.message || 'فشل في إنشاء قرار الجمعية';
      res.status(500).json({ error: message });
    }
  });

  app.patch("/api/governance/assembly-resolutions/:id", isAuthenticated, requirePermission("governance_resolutions", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validated = updateAssemblyResolutionSchema.parse(req.body);
      const [existing] = await db.select().from(assemblyResolutions).where(eq(assemblyResolutions.id, id));
      if (!existing) return res.status(404).json({ error: "قرار الجمعية غير موجود" });
      if ((existing as any).isLocked) {
        return res.status(423).json({ error: "قرار الجمعية مقفل ولا يمكن تعديله", code: "RESOLUTION_LOCKED" });
      }
      delete (validated as any).isLocked;
      delete (validated as any).lockedAt;
      delete (validated as any).lockedBy;
      // SAFEGUARD: never allow soft-delete fields to be changed via the edit route.
      delete (validated as any).deletedAt;
      delete (validated as any).deletedBy;
      delete (validated as any).deletionReason;
      // SECURITY: attachments reference Supabase storage paths consumed by the
      // signed-document download endpoint. Allowing them through the generic edit
      // route would let an editor point the download at ANY object in the shared
      // bucket. Attachments must only be managed by controlled upload flows.
      delete (validated as any).attachments;
      const [row] = await db.update(assemblyResolutions)
        .set({ ...validated, updatedAt: new Date() })
        .where(eq(assemblyResolutions.id, id))
        .returning();
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      console.error("Error updating assembly resolution:", error);
      res.status(500).json({ error: "فشل في تحديث قرار الجمعية" });
    }
  });

  app.post("/api/governance/assembly-resolutions/:id/lock", isAuthenticated, requirePermission("governance_resolutions", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(assemblyResolutions).where(eq(assemblyResolutions.id, id));
      if (!existing) return res.status(404).json({ error: "قرار الجمعية غير موجود" });
      if ((existing as any).isLocked) return res.status(409).json({ error: "قرار الجمعية مقفل بالفعل" });
      const [row] = await db.update(assemblyResolutions)
        .set({ isLocked: true, lockedAt: new Date(), lockedBy: getCurrentUserId(req), updatedAt: new Date() } as any)
        .where(eq(assemblyResolutions.id, id))
        .returning();
      res.json(row);
    } catch (error) {
      console.error("Error locking assembly resolution:", error);
      res.status(500).json({ error: "فشل في قفل قرار الجمعية" });
    }
  });

  app.delete("/api/governance/assembly-resolutions/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).currentUser;
      if (user?.role !== 'admin') return res.status(403).json({ error: "فقط المسؤول يمكنه حذف القرارات" });
      const id = parseInt(req.params.id);
      const reason = (req.body?.reason || '').toString().trim();
      const [existing] = await db.select().from(assemblyResolutions).where(eq(assemblyResolutions.id, id));
      if (!existing) return res.status(404).json({ error: "قرار الجمعية غير موجود" });
      if ((existing as any).deletedAt) {
        return res.status(409).json({ error: "القرار محذوف بالفعل وموجود في سلة المحذوفات" });
      }
      if ((existing as any).isLocked) {
        return res.status(423).json({ error: "قرار الجمعية مقفل ولا يمكن حذفه — السجلات الرسمية محفوظة بحكم النظام", code: "RESOLUTION_LOCKED" });
      }

      // PROTECTION ("محكمة"): voted/signed assembly resolutions can never be deleted.
      const [{ votes = 0 } = {}] = await db
        .select({ votes: sql<number>`count(*)::int` })
        .from(assemblyResolutionVotes)
        .where(eq(assemblyResolutionVotes.resolutionId, id));
      const [{ signed = 0 } = {}] = await db
        .select({ signed: sql<number>`count(*)::int` })
        .from(assemblyResolutionSignatures)
        .where(eq(assemblyResolutionSignatures.resolutionId, id));
      const protectedStatuses = ['voting', 'approved', 'rejected', 'implemented'];
      if (votes > 0 || signed > 0 || protectedStatuses.includes(String((existing as any).status))) {
        return res.status(423).json({
          error: "لا يمكن حذف هذا القرار لأنه تم التصويت عليه أو توقيعه. لحمايته من الفقدان، غيّر حالته إلى \"ملغي\" بدلاً من الحذف.",
          code: "RESOLUTION_HAS_VOTES",
        });
      }

      await db.transaction(async (tx) => {
        await tx.update(assemblyResolutions)
          .set({ deletedAt: new Date(), deletedBy: getCurrentUserId(req), deletionReason: reason || null, updatedAt: new Date() } as any)
          .where(eq(assemblyResolutions.id, id));

        await tx.insert(systemAuditLogs).values({
          module: 'governance',
          entityId: String(id),
          entityName: (existing as any).resolutionNumber || (existing as any).title,
          action: 'delete',
          details: JSON.stringify({ resolutionNumber: (existing as any).resolutionNumber, title: (existing as any).title, reason: reason || null, type: 'soft_delete', kind: 'assembly' }),
          userId: getCurrentUserId(req),
          userName: (req as any).currentUser?.username || 'system',
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        });
      });

      res.json({ success: true, message: "تم نقل القرار إلى سلة المحذوفات ويمكن استرجاعه" });
    } catch (error) {
      console.error("Error deleting assembly resolution:", error);
      res.status(500).json({ error: "فشل في حذف قرار الجمعية" });
    }
  });

  app.get("/api/governance/assembly-resolutions-trash", isAuthenticated, requirePermission("governance_resolutions", "delete"), async (req, res) => {
    try {
      const rows = await db.select().from(assemblyResolutions)
        .where(sql`deleted_at IS NOT NULL`)
        .orderBy(desc(assemblyResolutions.deletedAt));
      res.json(rows);
    } catch (error) {
      console.error("Error fetching deleted assembly resolutions:", error);
      res.status(500).json({ error: "فشل في جلب سلة المحذوفات" });
    }
  });

  app.post("/api/governance/assembly-resolutions/:id/restore", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).currentUser;
      if (user?.role !== 'admin') return res.status(403).json({ error: "فقط المسؤول يمكنه استرجاع القرارات" });
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(assemblyResolutions).where(eq(assemblyResolutions.id, id));
      if (!existing) return res.status(404).json({ error: "قرار الجمعية غير موجود" });
      if (!(existing as any).deletedAt) return res.status(409).json({ error: "القرار غير محذوف" });
      const restored = await db.transaction(async (tx) => {
        const [row] = await tx.update(assemblyResolutions)
          .set({ deletedAt: null, deletedBy: null, deletionReason: null, updatedAt: new Date() } as any)
          .where(eq(assemblyResolutions.id, id))
          .returning();
        await tx.insert(systemAuditLogs).values({
          module: 'governance',
          entityId: String(id),
          entityName: (existing as any).resolutionNumber || (existing as any).title,
          action: 'restore',
          details: JSON.stringify({ resolutionNumber: (existing as any).resolutionNumber, kind: 'assembly' }),
          userId: getCurrentUserId(req),
          userName: (req as any).currentUser?.username || 'system',
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        });
        return row;
      });
      res.json({ success: true, message: "تم استرجاع القرار", resolution: restored });
    } catch (error) {
      console.error("Error restoring assembly resolution:", error);
      res.status(500).json({ error: "فشل في استرجاع قرار الجمعية" });
    }
  });

  // =====================================================
  // Insider Register & Blackout Periods - سجل المطلعين وفترات الحظر
  // (CMA / Nomu listing requirement)
  // =====================================================
  app.get("/api/governance/insiders", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const conds: any[] = [];
      if (status) conds.push(eq(insiderRegister.status, status));
      let q = db.select().from(insiderRegister) as any;
      if (conds.length) q = q.where(and(...conds));
      res.json(await q.orderBy(desc(insiderRegister.startDate)));
    } catch (error) {
      console.error("Error fetching insiders:", error);
      res.status(500).json({ error: "فشل في جلب سجل المطلعين" });
    }
  });

  app.post("/api/governance/insiders", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const data = insertInsiderRegisterSchema.parse({ ...req.body, createdBy: getCurrentUserId(req) });
      const [row] = await db.insert(insiderRegister).values(data).returning();
      res.status(201).json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      console.error("Error creating insider:", error);
      res.status(500).json({ error: "فشل في إضافة المطّلع" });
    }
  });

  app.patch("/api/governance/insiders/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const validated = updateInsiderRegisterSchema.parse(req.body);
      const [row] = await db.update(insiderRegister)
        .set({ ...validated, updatedAt: new Date() })
        .where(eq(insiderRegister.id, parseInt(req.params.id)))
        .returning();
      if (!row) return res.status(404).json({ error: "السجل غير موجود" });
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      console.error("Error updating insider:", error);
      res.status(500).json({ error: "فشل في تحديث المطّلع" });
    }
  });

  app.delete("/api/governance/insiders/:id", isAuthenticated, requirePermission("governance_compliance", "delete"), async (req, res) => {
    try {
      await db.delete(insiderRegister).where(eq(insiderRegister.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting insider:", error);
      res.status(500).json({ error: "فشل في حذف المطّلع" });
    }
  });

  app.get("/api/governance/blackout-periods", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const conds: any[] = [];
      if (status) conds.push(eq(insiderBlackoutPeriods.status, status));
      let q = db.select().from(insiderBlackoutPeriods) as any;
      if (conds.length) q = q.where(and(...conds));
      res.json(await q.orderBy(desc(insiderBlackoutPeriods.startDate)));
    } catch (error) {
      console.error("Error fetching blackout periods:", error);
      res.status(500).json({ error: "فشل في جلب فترات الحظر" });
    }
  });

  app.post("/api/governance/blackout-periods", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const data = insertInsiderBlackoutPeriodSchema.parse({ ...req.body, createdBy: getCurrentUserId(req) });
      const [row] = await db.insert(insiderBlackoutPeriods).values(data).returning();
      res.status(201).json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      console.error("Error creating blackout period:", error);
      res.status(500).json({ error: "فشل في إضافة فترة الحظر" });
    }
  });

  app.patch("/api/governance/blackout-periods/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const validated = updateInsiderBlackoutPeriodSchema.parse(req.body);
      const [row] = await db.update(insiderBlackoutPeriods)
        .set({ ...validated, updatedAt: new Date() })
        .where(eq(insiderBlackoutPeriods.id, parseInt(req.params.id)))
        .returning();
      if (!row) return res.status(404).json({ error: "فترة الحظر غير موجودة" });
      res.json(row);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      console.error("Error updating blackout period:", error);
      res.status(500).json({ error: "فشل في تحديث فترة الحظر" });
    }
  });

  app.delete("/api/governance/blackout-periods/:id", isAuthenticated, requirePermission("governance_compliance", "delete"), async (req, res) => {
    try {
      await db.delete(insiderBlackoutPeriods).where(eq(insiderBlackoutPeriods.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting blackout period:", error);
      res.status(500).json({ error: "فشل في حذف فترة الحظر" });
    }
  });

  // =====================================================
  // Resolution Votes - التصويت على القرارات
  // =====================================================
  
  app.get("/api/governance/resolutions/:resolutionId/votes", isAuthenticated, requirePermission("governance_voting", "view"), async (req, res) => {
    try {
      const result = await db.select().from(resolutionVotes)
        .where(eq(resolutionVotes.resolutionId, parseInt(req.params.resolutionId)));
      res.json(result);
    } catch (error) {
      console.error("Error fetching votes:", error);
      res.status(500).json({ error: "فشل في جلب التصويتات" });
    }
  });

  app.post("/api/governance/resolutions/:resolutionId/votes", isAuthenticated, requirePermission("governance_voting", "create"), async (req, res) => {
    try {
      const resolutionId = parseInt(req.params.resolutionId);
      // IMMUTABILITY: no new votes can be cast on a locked resolution — the
      // tally is frozen at lock time.
      const [target] = await db.select().from(boardResolutions).where(eq(boardResolutions.id, resolutionId));
      if (!target) return res.status(404).json({ error: "القرار غير موجود" });
      if ((target as any).isLocked) {
        return res.status(423).json({ error: "القرار مقفل ولا يمكن التصويت عليه", code: "RESOLUTION_LOCKED" });
      }
      const data = insertResolutionVoteSchema.parse({
        ...req.body,
        resolutionId,
      });
      const [vote] = await db.insert(resolutionVotes).values(data).returning();
      
      // Update resolution vote counts
      const votes = await db.select().from(resolutionVotes).where(eq(resolutionVotes.resolutionId, resolutionId));
      const forVotes = votes.filter(v => v.vote === 'for').length;
      const againstVotes = votes.filter(v => v.vote === 'against').length;
      const abstainVotes = votes.filter(v => v.vote === 'abstain').length;
      
      await db.update(boardResolutions)
        .set({ forVotes, againstVotes, abstainVotes, totalVotes: votes.length })
        .where(eq(boardResolutions.id, resolutionId));
      
      res.status(201).json(vote);
    } catch (error) {
      console.error("Error creating vote:", error);
      res.status(500).json({ error: "فشل في تسجيل التصويت" });
    }
  });

  // =====================================================
  // Capital Transactions - معاملات رأس المال
  // =====================================================
  
  app.get("/api/governance/capital-transactions", isAuthenticated, requirePermission("governance_capital", "view"), async (req, res) => {
    try {
      const result = await db.select().from(capitalTransactions).orderBy(desc(capitalTransactions.effectiveDate));
      res.json(result);
    } catch (error) {
      console.error("Error fetching capital transactions:", error);
      res.status(500).json({ error: "فشل في جلب معاملات رأس المال" });
    }
  });

  app.post("/api/governance/capital-transactions", isAuthenticated, requirePermission("governance_capital", "create"), async (req, res) => {
    try {
      const year = new Date().getFullYear();
      const count = await db.select({ count: sql<number>`count(*)` }).from(capitalTransactions);
      const transactionNumber = `CAP-${year}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const data = insertCapitalTransactionSchema.parse({
        ...req.body,
        transactionNumber,
        createdBy: getCurrentUserId(req),
      });
      const [transaction] = await db.insert(capitalTransactions).values(data).returning();
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating capital transaction:", error);
      res.status(500).json({ error: "فشل في إنشاء معاملة رأس المال" });
    }
  });

  // =====================================================
  // Dividend Distributions - توزيعات الأرباح
  // =====================================================
  
  app.get("/api/governance/dividends", isAuthenticated, requirePermission("governance_dividends", "view"), async (req, res) => {
    try {
      const result = await db.select().from(dividendDistributions).orderBy(desc(dividendDistributions.paymentDate));
      res.json(result);
    } catch (error) {
      console.error("Error fetching dividends:", error);
      res.status(500).json({ error: "فشل في جلب توزيعات الأرباح" });
    }
  });

  app.post("/api/governance/dividends", isAuthenticated, requirePermission("governance_dividends", "create"), async (req, res) => {
    try {
      const year = new Date().getFullYear();
      const count = await db.select({ count: sql<number>`count(*)` }).from(dividendDistributions);
      const distributionNumber = `DIV-${year}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const data = insertDividendDistributionSchema.parse({
        ...req.body,
        distributionNumber,
        createdBy: getCurrentUserId(req),
      });
      const [distribution] = await db.insert(dividendDistributions).values(data).returning();
      res.status(201).json(distribution);
    } catch (error) {
      console.error("Error creating dividend distribution:", error);
      res.status(500).json({ error: "فشل في إنشاء توزيع الأرباح" });
    }
  });

  app.get("/api/governance/dividends/:distributionId/payments", isAuthenticated, requirePermission("governance_dividends", "view"), async (req, res) => {
    try {
      const result = await db.select().from(shareholderDividends)
        .where(eq(shareholderDividends.distributionId, parseInt(req.params.distributionId)));
      res.json(result);
    } catch (error) {
      console.error("Error fetching dividend payments:", error);
      res.status(500).json({ error: "فشل في جلب مدفوعات الأرباح" });
    }
  });

  // =====================================================
  // Disclosures - الإفصاحات
  // =====================================================
  
  app.get("/api/governance/disclosures", isAuthenticated, requirePermission("governance_disclosures", "view"), async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const status = req.query.status as string | undefined;
      
      let query = db.select().from(disclosures);
      const conditions: any[] = [];
      
      if (type) conditions.push(eq(disclosures.disclosureType, type));
      if (status) conditions.push(eq(disclosures.status, status));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const result = await query.orderBy(desc(disclosures.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching disclosures:", error);
      res.status(500).json({ error: "فشل في جلب الإفصاحات" });
    }
  });

  app.post("/api/governance/disclosures", isAuthenticated, requirePermission("governance_disclosures", "create"), async (req, res) => {
    try {
      const year = new Date().getFullYear();
      const count = await db.select({ count: sql<number>`count(*)` }).from(disclosures);
      const disclosureNumber = `DIS-${year}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const data = insertDisclosureSchema.parse({
        ...req.body,
        disclosureNumber,
        createdBy: getCurrentUserId(req),
      });
      const [disclosure] = await db.insert(disclosures).values(data).returning();
      res.status(201).json(disclosure);
    } catch (error) {
      console.error("Error creating disclosure:", error);
      res.status(500).json({ error: "فشل في إنشاء الإفصاح" });
    }
  });

  app.patch("/api/governance/disclosures/:id", isAuthenticated, requirePermission("governance_disclosures", "edit"), async (req, res) => {
    try {
      const validatedData = updateDisclosureSchema.parse(req.body);
      const [disclosure] = await db.update(disclosures)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(disclosures.id, parseInt(req.params.id)))
        .returning();
      res.json(disclosure);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating disclosure:", error);
      res.status(500).json({ error: "فشل في تحديث الإفصاح" });
    }
  });

  // =====================================================
  // Compliance Requirements - متطلبات الامتثال
  // =====================================================
  
  app.get("/api/governance/compliance", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const category = req.query.category as string | undefined;
      
      let query = db.select().from(complianceRequirements);
      const conditions: any[] = [];
      
      if (status) conditions.push(eq(complianceRequirements.currentStatus, status));
      if (category) conditions.push(eq(complianceRequirements.category, category));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const result = await query.orderBy(asc(complianceRequirements.nextDueDate));
      res.json(result);
    } catch (error) {
      console.error("Error fetching compliance requirements:", error);
      res.status(500).json({ error: "فشل في جلب متطلبات الامتثال" });
    }
  });

  app.get("/api/governance/compliance/:id", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const [requirement] = await db.select().from(complianceRequirements).where(eq(complianceRequirements.id, parseInt(req.params.id)));
      if (!requirement) {
        return res.status(404).json({ error: "المتطلب غير موجود" });
      }
      res.json(requirement);
    } catch (error) {
      console.error("Error fetching compliance requirement:", error);
      res.status(500).json({ error: "فشل في جلب المتطلب" });
    }
  });

  app.post("/api/governance/compliance", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const count = await db.select({ count: sql<number>`count(*)` }).from(complianceRequirements);
      const requirementCode = `COMP-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const data = insertComplianceRequirementSchema.parse({
        ...req.body,
        requirementCode,
        createdBy: getCurrentUserId(req),
      });
      const [requirement] = await db.insert(complianceRequirements).values(data).returning();
      res.status(201).json(requirement);
    } catch (error) {
      console.error("Error creating compliance requirement:", error);
      res.status(500).json({ error: "فشل في إنشاء المتطلب" });
    }
  });

  app.patch("/api/governance/compliance/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const validatedData = updateComplianceRequirementSchema.parse(req.body);
      const [requirement] = await db.update(complianceRequirements)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(complianceRequirements.id, parseInt(req.params.id)))
        .returning();
      res.json(requirement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating compliance requirement:", error);
      res.status(500).json({ error: "فشل في تحديث المتطلب" });
    }
  });

  app.get("/api/governance/compliance/:id/history", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const result = await db.select().from(complianceHistory)
        .where(eq(complianceHistory.requirementId, parseInt(req.params.id)))
        .orderBy(desc(complianceHistory.actionDate));
      res.json(result);
    } catch (error) {
      console.error("Error fetching compliance history:", error);
      res.status(500).json({ error: "فشل في جلب سجل الامتثال" });
    }
  });

  app.post("/api/governance/compliance/:id/history", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const data = insertComplianceHistorySchema.parse({
        ...req.body,
        requirementId: parseInt(req.params.id),
        performedBy: getCurrentUserId(req),
        actionDate: new Date(),
      });
      const [history] = await db.insert(complianceHistory).values(data).returning();
      res.status(201).json(history);
    } catch (error) {
      console.error("Error creating compliance history:", error);
      res.status(500).json({ error: "فشل في تسجيل الإجراء" });
    }
  });

  // =====================================================
  // Share Transfers - تحويلات الأسهم
  // =====================================================
  
  app.get("/api/governance/share-transfers", isAuthenticated, requirePermission("governance_transfers", "view"), async (req, res) => {
    try {
      const result = await db.select().from(shareTransfers).orderBy(desc(shareTransfers.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching share transfers:", error);
      res.status(500).json({ error: "فشل في جلب تحويلات الأسهم" });
    }
  });

  app.post("/api/governance/share-transfers", isAuthenticated, requirePermission("governance_transfers", "create"), async (req, res) => {
    try {
      const year = new Date().getFullYear();
      const count = await db.select({ count: sql<number>`count(*)` }).from(shareTransfers);
      const transferNumber = `TRF-${year}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const data = insertShareTransferSchema.parse({
        ...req.body,
        transferNumber,
        approvalStatus: 'pending',
        createdBy: getCurrentUserId(req),
      });
      const [transfer] = await db.insert(shareTransfers).values(data).returning();
      res.status(201).json(transfer);
    } catch (error) {
      console.error("Error creating share transfer:", error);
      res.status(500).json({ error: "فشل في إنشاء تحويل الأسهم" });
    }
  });

  app.patch("/api/governance/share-transfers/:id", isAuthenticated, requirePermission("governance_transfers", "edit"), async (req, res) => {
    try {
      const validatedData = updateShareTransferSchema.parse(req.body);
      const updateData: any = { ...validatedData };
      if (validatedData.approvalStatus === 'approved') {
        updateData.approvedBy = getCurrentUserId(req);
        updateData.approvedAt = new Date();
      }
      const [transfer] = await db.update(shareTransfers)
        .set(updateData)
        .where(eq(shareTransfers.id, parseInt(req.params.id)))
        .returning();
      res.json(transfer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating share transfer:", error);
      res.status(500).json({ error: "فشل في تحديث تحويل الأسهم" });
    }
  });

  // =====================================================
  // Disclosures - الإفصاحات
  // =====================================================
  
  app.get("/api/governance/disclosures", isAuthenticated, requirePermission("governance_disclosures", "view"), async (req, res) => {
    try {
      const result = await db.select().from(disclosures).orderBy(desc(disclosures.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching disclosures:", error);
      res.status(500).json({ error: "فشل في جلب الإفصاحات" });
    }
  });

  app.post("/api/governance/disclosures", isAuthenticated, requirePermission("governance_disclosures", "create"), async (req, res) => {
    try {
      const year = new Date().getFullYear();
      const count = await db.select({ count: sql<number>`count(*)` }).from(disclosures);
      const disclosureNumber = `DSC-${year}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const data = insertDisclosureSchema.parse({
        ...req.body,
        disclosureNumber,
        status: 'draft',
        createdBy: getCurrentUserId(req),
      });
      const [disclosure] = await db.insert(disclosures).values(data).returning();
      res.status(201).json(disclosure);
    } catch (error) {
      console.error("Error creating disclosure:", error);
      res.status(500).json({ error: "فشل في إنشاء الإفصاح" });
    }
  });

  app.patch("/api/governance/disclosures/:id", isAuthenticated, requirePermission("governance_disclosures", "edit"), async (req, res) => {
    try {
      const validatedData = updateDisclosureSchema.parse(req.body);
      const [disclosure] = await db.update(disclosures)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(disclosures.id, parseInt(req.params.id)))
        .returning();
      res.json(disclosure);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating disclosure:", error);
      res.status(500).json({ error: "فشل في تحديث الإفصاح" });
    }
  });

  // =====================================================
  // Dividends - توزيعات الأرباح
  // =====================================================
  
  app.get("/api/governance/dividends", isAuthenticated, requirePermission("governance_dividends", "view"), async (req, res) => {
    try {
      const result = await db.select().from(dividendDistributions).orderBy(desc(dividendDistributions.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching dividends:", error);
      res.status(500).json({ error: "فشل في جلب توزيعات الأرباح" });
    }
  });

  app.post("/api/governance/dividends", isAuthenticated, requirePermission("governance_dividends", "create"), async (req, res) => {
    try {
      const year = new Date().getFullYear();
      const count = await db.select({ count: sql<number>`count(*)` }).from(dividendDistributions);
      const distributionNumber = `DIV-${year}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const data = insertDividendDistributionSchema.parse({
        ...req.body,
        distributionNumber,
        status: 'announced',
        createdBy: getCurrentUserId(req),
      });
      const [distribution] = await db.insert(dividendDistributions).values(data).returning();
      res.status(201).json(distribution);
    } catch (error) {
      console.error("Error creating dividend distribution:", error);
      res.status(500).json({ error: "فشل في إنشاء توزيع الأرباح" });
    }
  });

  app.patch("/api/governance/dividends/:id", isAuthenticated, requirePermission("governance_dividends", "edit"), async (req, res) => {
    try {
      const validatedData = updateDividendDistributionSchema.parse(req.body);
      const [distribution] = await db.update(dividendDistributions)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(dividendDistributions.id, parseInt(req.params.id)))
        .returning();
      res.json(distribution);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating dividend distribution:", error);
      res.status(500).json({ error: "فشل في تحديث توزيع الأرباح" });
    }
  });

  // =====================================================
  // Capital Transactions - معاملات رأس المال
  // =====================================================
  
  app.get("/api/governance/capital", isAuthenticated, requirePermission("governance_capital", "view"), async (req, res) => {
    try {
      const result = await db.select().from(capitalTransactions).orderBy(desc(capitalTransactions.effectiveDate));
      res.json(result);
    } catch (error) {
      console.error("Error fetching capital transactions:", error);
      res.status(500).json({ error: "فشل في جلب معاملات رأس المال" });
    }
  });

  app.post("/api/governance/capital", isAuthenticated, requirePermission("governance_capital", "create"), async (req, res) => {
    try {
      const year = new Date().getFullYear();
      const count = await db.select({ count: sql<number>`count(*)` }).from(capitalTransactions);
      const transactionNumber = `CAP-${year}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const data = insertCapitalTransactionSchema.parse({
        ...req.body,
        transactionNumber,
        status: 'pending',
        createdBy: getCurrentUserId(req),
      });
      const [transaction] = await db.insert(capitalTransactions).values(data).returning();
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating capital transaction:", error);
      res.status(500).json({ error: "فشل في إنشاء معاملة رأس المال" });
    }
  });

  app.patch("/api/governance/capital/:id", isAuthenticated, requirePermission("governance_capital", "edit"), async (req, res) => {
    try {
      const validatedData = updateCapitalTransactionSchema.parse(req.body);
      const [transaction] = await db.update(capitalTransactions)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(capitalTransactions.id, parseInt(req.params.id)))
        .returning();
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating capital transaction:", error);
      res.status(500).json({ error: "فشل في تحديث معاملة رأس المال" });
    }
  });

  // =====================================================
  // Votes - الأصوات
  // =====================================================
  
  app.get("/api/governance/votes", isAuthenticated, requirePermission("governance_voting", "view"), async (req, res) => {
    try {
      const resolutionId = req.query.resolutionId ? parseInt(req.query.resolutionId as string) : undefined;
      let query = db.select().from(resolutionVotes);
      if (resolutionId) {
        query = query.where(eq(resolutionVotes.resolutionId, resolutionId)) as any;
      }
      const result = await query.orderBy(desc(resolutionVotes.votedAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching votes:", error);
      res.status(500).json({ error: "فشل في جلب الأصوات" });
    }
  });

  app.post("/api/governance/votes", isAuthenticated, requirePermission("governance_voting", "create"), async (req, res) => {
    try {
      const data = insertResolutionVoteSchema.parse({
        ...req.body,
        votedAt: new Date(),
      });
      // IMMUTABILITY: refuse votes on locked resolutions.
      const [target] = await db.select().from(boardResolutions).where(eq(boardResolutions.id, data.resolutionId));
      if (!target) return res.status(404).json({ error: "القرار غير موجود" });
      if ((target as any).isLocked) {
        return res.status(423).json({ error: "القرار مقفل ولا يمكن التصويت عليه", code: "RESOLUTION_LOCKED" });
      }
      const [vote] = await db.insert(resolutionVotes).values(data).returning();
      
      // Update resolution vote counts
      const resolutionId = data.resolutionId;
      const votes = await db.select().from(resolutionVotes).where(eq(resolutionVotes.resolutionId, resolutionId));
      const forVotes = votes.filter(v => v.vote === 'for').length;
      const againstVotes = votes.filter(v => v.vote === 'against').length;
      const abstainVotes = votes.filter(v => v.vote === 'abstain').length;
      
      await db.update(boardResolutions)
        .set({
          forVotes,
          againstVotes,
          abstainVotes,
          totalVotes: votes.length,
          updatedAt: new Date(),
        })
        .where(eq(boardResolutions.id, resolutionId));
      
      res.status(201).json(vote);
    } catch (error) {
      console.error("Error creating vote:", error);
      res.status(500).json({ error: "فشل في تسجيل التصويت" });
    }
  });

  // =====================================================
  // Dashboard Stats - إحصائيات اللوحة
  // =====================================================
  
  app.get("/api/governance/stats", isAuthenticated, requirePermission("governance", "view"), async (req, res) => {
    try {
      const [boardMembersCount] = await db.select({ count: sql<number>`count(*)` })
        .from(boardMembers).where(eq(boardMembers.status, 'active'));
      
      const [shareholdersCount] = await db.select({ count: sql<number>`count(*)` })
        .from(shareholders).where(eq(shareholders.status, 'active'));
      
      const currentYear = new Date().getFullYear();
      const [meetingsCount] = await db.select({ count: sql<number>`count(*)` })
        .from(governanceMeetings).where(eq(governanceMeetings.fiscalYear, String(currentYear)));
      
      const [pendingResolutions] = await db.select({ count: sql<number>`count(*)` })
        .from(boardResolutions).where(eq(boardResolutions.status, 'voting'));
      
      const [expiringCompliance] = await db.select({ count: sql<number>`count(*)` })
        .from(complianceRequirements).where(eq(complianceRequirements.currentStatus, 'expiring_soon'));
      
      const [totalShares] = await db.select({ sum: sql<number>`COALESCE(SUM(number_of_shares), 0)` })
        .from(shareholders).where(eq(shareholders.status, 'active'));
      
      res.json({
        boardMembersCount: boardMembersCount?.count || 0,
        shareholdersCount: shareholdersCount?.count || 0,
        meetingsThisYear: meetingsCount?.count || 0,
        pendingResolutions: pendingResolutions?.count || 0,
        expiringCompliance: expiringCompliance?.count || 0,
        totalShares: totalShares?.sum || 0,
      });
    } catch (error) {
      console.error("Error fetching governance stats:", error);
      res.status(500).json({ error: "فشل في جلب الإحصائيات" });
    }
  });

  // ============================================
  // Resolution Signatures - التوقيعات الإلكترونية
  // ============================================

  // Get signatures for a resolution (supports both board members and shareholders)
  // Sorted by board position priority: chairman → vice_chairman → secretary → member → others
  const POSITION_ORDER: Record<string, number> = {
    chairman: 1,
    vice_chairman: 2,
    secretary: 3,
    independent_member: 4,
    member: 5,
  };
  app.get("/api/governance/resolutions/:resolutionId/signatures", isAuthenticated, async (req, res) => {
    try {
      const resolutionId = parseInt(req.params.resolutionId);
      const sigs = await db
        .select()
        .from(resolutionSignatures)
        .where(eq(resolutionSignatures.resolutionId, resolutionId))
        .orderBy(desc(resolutionSignatures.createdAt));
      
      const enriched = [];
      for (const sig of sigs) {
        let memberName = sig.signerName || '';
        let memberPosition = '';
        let memberEmail = '';
        
        if (sig.boardMemberId) {
          const [member] = await db.select().from(boardMembers).where(eq(boardMembers.id, sig.boardMemberId)).limit(1);
          if (member) {
            memberName = member.fullName;
            memberPosition = member.position || '';
            memberEmail = member.email || '';
          }
        } else if (sig.shareholderId) {
          const [sh] = await db.select().from(shareholders).where(eq(shareholders.id, sig.shareholderId)).limit(1);
          if (sh) {
            memberName = sh.fullName;
            memberPosition = 'مساهم';
            memberEmail = sh.email || '';
          }
        }
        
        enriched.push({
          id: sig.id,
          resolutionId: sig.resolutionId,
          boardMemberId: sig.boardMemberId,
          shareholderId: sig.shareholderId,
          signerType: sig.signerType,
          signatureToken: sig.signatureToken,
          signatureData: sig.signatureData,
          signatureType: sig.signatureType,
          status: sig.status,
          signedAt: sig.signedAt,
          declinedAt: sig.declinedAt,
          declineReason: sig.declineReason,
          expiresAt: sig.expiresAt,
          createdAt: sig.createdAt,
          memberName,
          memberPosition,
          memberEmail,
        });
      }

      // Sort: chairman first, then vice_chairman, secretary, others; shareholders last
      enriched.sort((a, b) => {
        const aOrder = POSITION_ORDER[a.memberPosition] ?? 99;
        const bOrder = POSITION_ORDER[b.memberPosition] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.memberName || '').localeCompare(b.memberName || '', 'ar');
      });

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching signatures:", error);
      res.status(500).json({ error: "فشل في جلب التوقيعات" });
    }
  });

  // Create signature requests - for board members OR shareholders based on resolution type
  app.post("/api/governance/resolutions/:resolutionId/signatures/create-requests", isAuthenticated, requirePermission("governance", "edit"), async (req, res) => {
    try {
      const resolutionId = parseInt(req.params.resolutionId);
      const { expiresInDays = 7, scope } = req.body;
      
      const [resolution] = await db.select().from(boardResolutions).where(eq(boardResolutions.id, resolutionId)).limit(1);
      if (!resolution) {
        return res.status(404).json({ error: "القرار غير موجود" });
      }
      
      const isAssemblyResolution = resolution.resolutionType === 'general_assembly' || resolution.resolutionType === 'extraordinary_assembly';
      // قرار الجمعية دائماً رئيس المجلس وأمين السر فقط؛ ولقرار المجلس يمكن اختيار "chairman_secretary" أو "all"
      const useChairmanSecretary = isAssemblyResolution || scope === 'chairman_secretary';
      
      const existingSignatures = await db.select()
        .from(resolutionSignatures)
        .where(eq(resolutionSignatures.resolutionId, resolutionId));
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      const newSignatures: any[] = [];
      
      const activeMembers = await db.select().from(boardMembers).where(eq(boardMembers.status, "active"));

      let signers: typeof activeMembers;
      if (useChairmanSecretary) {
        // يوقّع عليه رئيس مجلس الإدارة وأمين السر فقط (واحد لكل منصب)
        const chairman = activeMembers.find(m => m.position === "chairman");
        const secretary = activeMembers.find(m => m.position === "secretary");
        signers = [chairman, secretary].filter((m): m is typeof activeMembers[number] => !!m);

        if (signers.length === 0) {
          return res.status(400).json({ error: "لا يوجد رئيس مجلس إدارة أو أمين سر نشط. الرجاء تحديد منصب \"رئيس مجلس الإدارة\" و\"أمين السر\" في صفحة أعضاء المجلس أولاً." });
        }
      } else {
        signers = activeMembers;
        if (signers.length === 0) {
          return res.status(400).json({ error: "لا يوجد أعضاء مجلس نشطين" });
        }
      }

      const existingMemberIds = new Set(existingSignatures.filter(s => s.boardMemberId).map(s => s.boardMemberId));

      for (const member of signers) {
        if (!existingMemberIds.has(member.id)) {
          const signatureToken = crypto.randomBytes(32).toString('hex');
          newSignatures.push({
            resolutionId,
            boardMemberId: member.id,
            signerName: member.fullName,
            signerType: "board_member",
            signatureToken,
            status: "pending" as const,
            expiresAt,
          });
        }
      }
      
      if (newSignatures.length > 0) {
        await db.insert(resolutionSignatures).values(newSignatures);
      }
      
      res.json({ 
        created: newSignatures.length, 
        total: existingSignatures.length + newSignatures.length,
        signerType: useChairmanSecretary ? "chairman_secretary" : "board_members",
      });
    } catch (error) {
      console.error("Error creating signature requests:", error);
      res.status(500).json({ error: "فشل في إنشاء طلبات التوقيع" });
    }
  });

  // Rate limiting for public signature endpoints
  const signatureRateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const SIGNATURE_RATE_LIMIT_WINDOW = 60000; // 1 minute
  const SIGNATURE_RATE_LIMIT_MAX = 10; // 10 requests per minute per IP (stricter for signatures)
  
  function checkSignatureRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = signatureRateLimitMap.get(ip);
    
    if (!record || now > record.resetTime) {
      signatureRateLimitMap.set(ip, { count: 1, resetTime: now + SIGNATURE_RATE_LIMIT_WINDOW });
      return true;
    }
    
    if (record.count >= SIGNATURE_RATE_LIMIT_MAX) {
      return false;
    }
    
    record.count++;
    return true;
  }
  
  // Cleanup expired rate limit entries every minute
  setInterval(() => {
    const now = Date.now();
    Array.from(signatureRateLimitMap.entries()).forEach(([ip, record]) => {
      if (now > record.resetTime) {
        signatureRateLimitMap.delete(ip);
      }
    });
  }, 60000);

  // Public endpoint - Get resolution for signing (no auth required)
  app.get("/api/public/sign/:token", async (req, res) => {
    try {
      // Rate limiting
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkSignatureRateLimit(clientIp)) {
        return res.status(429).json({ error: "تم تجاوز الحد الأقصى للطلبات. حاول لاحقاً." });
      }
      
      const { token } = req.params;
      
      // Validate token format
      if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({ error: "رابط غير صالح" });
      }
      
      const [signature] = await db
        .select({
          id: resolutionSignatures.id,
          status: resolutionSignatures.status,
          expiresAt: resolutionSignatures.expiresAt,
          signedAt: resolutionSignatures.signedAt,
          memberName: boardMembers.fullName,
          memberPosition: boardMembers.position,
          resolutionId: boardResolutions.id,
          resolutionNumber: boardResolutions.resolutionNumber,
          resolutionTitle: boardResolutions.title,
          resolutionDescription: boardResolutions.description,
          resolutionType: boardResolutions.resolutionType,
          resolutionStatus: boardResolutions.status,
          resolutionCreatedAt: boardResolutions.createdAt,
        })
        .from(resolutionSignatures)
        .innerJoin(boardMembers, eq(resolutionSignatures.boardMemberId, boardMembers.id))
        .innerJoin(boardResolutions, eq(resolutionSignatures.resolutionId, boardResolutions.id))
        .where(eq(resolutionSignatures.signatureToken, token));
      
      if (!signature) {
        return res.status(404).json({ error: "رابط التوقيع غير موجود" });
      }
      
      if (signature.status === "signed") {
        return res.status(400).json({ error: "تم التوقيع على هذا القرار مسبقاً", signedAt: signature.signedAt });
      }
      
      if (signature.expiresAt && new Date(signature.expiresAt) < new Date()) {
        return res.status(410).json({ error: "انتهت صلاحية رابط التوقيع" });
      }
      
      res.json(signature);
    } catch (error) {
      console.error("Error fetching signature:", error);
      res.status(500).json({ error: "فشل في جلب بيانات التوقيع" });
    }
  });

  // Public endpoint - Submit signature (no auth required)
  app.post("/api/public/sign/:token", async (req, res) => {
    try {
      // Rate limiting
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkSignatureRateLimit(clientIp)) {
        return res.status(429).json({ error: "تم تجاوز الحد الأقصى للطلبات. حاول لاحقاً." });
      }
      
      const { token } = req.params;
      const { signatureData, signatureType = "draw" } = req.body;
      
      // Validate token
      if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({ error: "رابط غير صالح" });
      }
      
      if (!signatureData) {
        return res.status(400).json({ error: "التوقيع مطلوب" });
      }
      
      // Validate signature data format and size (prevent oversized payloads)
      if (typeof signatureData !== 'string') {
        return res.status(400).json({ error: "صيغة التوقيع غير صالحة" });
      }
      
      // Max size ~500KB for signature data (base64 image)
      const MAX_SIGNATURE_SIZE = 500 * 1024;
      if (signatureData.length > MAX_SIGNATURE_SIZE) {
        return res.status(400).json({ error: "حجم التوقيع كبير جداً" });
      }
      
      // Validate base64 data URL format
      if (!signatureData.startsWith('data:image/')) {
        return res.status(400).json({ error: "صيغة صورة التوقيع غير صالحة" });
      }
      
      // Get signature record
      const [signature] = await db.select().from(resolutionSignatures)
        .where(eq(resolutionSignatures.signatureToken, token));
      
      if (!signature) {
        return res.status(404).json({ error: "رابط التوقيع غير موجود" });
      }
      
      if (signature.status === "signed") {
        return res.status(400).json({ error: "تم التوقيع مسبقاً" });
      }
      
      if (signature.expiresAt && new Date(signature.expiresAt) < new Date()) {
        return res.status(410).json({ error: "انتهت صلاحية رابط التوقيع" });
      }
      
      // Update signature
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('User-Agent');
      
      await db.update(resolutionSignatures)
        .set({
          signatureData,
          signatureType,
          status: "signed",
          signedAt: new Date(),
          ipAddress,
          userAgent,
          updatedAt: new Date(),
        })
        .where(eq(resolutionSignatures.id, signature.id));
      
      res.json({ success: true, message: "تم التوقيع بنجاح" });
    } catch (error) {
      console.error("Error submitting signature:", error);
      res.status(500).json({ error: "فشل في حفظ التوقيع" });
    }
  });

  // Public endpoint - Decline signature
  app.post("/api/public/sign/:token/decline", async (req, res) => {
    try {
      // Rate limiting
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkSignatureRateLimit(clientIp)) {
        return res.status(429).json({ error: "تم تجاوز الحد الأقصى للطلبات. حاول لاحقاً." });
      }
      
      const { token } = req.params;
      const { reason } = req.body;
      
      // Validate token format
      if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({ error: "رابط غير صالح" });
      }
      
      const [signature] = await db.select().from(resolutionSignatures)
        .where(eq(resolutionSignatures.signatureToken, token));
      
      if (!signature) {
        return res.status(404).json({ error: "رابط التوقيع غير موجود" });
      }
      
      if (signature.status !== "pending") {
        return res.status(400).json({ error: "لا يمكن رفض هذا التوقيع" });
      }
      
      await db.update(resolutionSignatures)
        .set({
          status: "declined",
          declinedAt: new Date(),
          declineReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(resolutionSignatures.id, signature.id));
      
      res.json({ success: true, message: "تم رفض التوقيع" });
    } catch (error) {
      console.error("Error declining signature:", error);
      res.status(500).json({ error: "فشل في رفض التوقيع" });
    }
  });

  // =============================================
  // Voting Tokens - روابط التصويت العام للمساهمين
  // =============================================

  // Rate limiting for public voting endpoints
  const votingRateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const VOTING_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
  const VOTING_RATE_LIMIT_MAX = 10;

  const checkVotingRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const record = votingRateLimitMap.get(ip);
    
    if (!record || record.resetTime < now) {
      votingRateLimitMap.set(ip, { count: 1, resetTime: now + VOTING_RATE_LIMIT_WINDOW });
      return true;
    }
    
    if (record.count >= VOTING_RATE_LIMIT_MAX) {
      return false;
    }
    
    record.count++;
    return true;
  };

  // Cleanup voting rate limit map
  setInterval(() => {
    const now = Date.now();
    Array.from(votingRateLimitMap.entries()).forEach(([ip, record]) => {
      if (record.resetTime < now) {
        votingRateLimitMap.delete(ip);
      }
    });
  }, 60000);

  // Get voting tokens for a resolution (supports both shareholders and board members)
  app.get("/api/governance/resolutions/:resolutionId/voting-tokens", isAuthenticated, async (req, res) => {
    try {
      const resolutionId = parseInt(req.params.resolutionId);
      const rows = await db
        .select({
          id: votingTokens.id,
          resolutionId: votingTokens.resolutionId,
          shareholderId: votingTokens.shareholderId,
          boardMemberId: votingTokens.boardMemberId,
          voterType: votingTokens.voterType,
          voteToken: votingTokens.voteToken,
          vote: votingTokens.vote,
          voteWeight: votingTokens.voteWeight,
          comments: votingTokens.comments,
          signatureData: votingTokens.signatureData,
          status: votingTokens.status,
          votedAt: votingTokens.votedAt,
          expiresAt: votingTokens.expiresAt,
          createdAt: votingTokens.createdAt,
          shareholderName: shareholders.fullName,
          shareholderEmail: shareholders.email,
          shareholderPhone: shareholders.phone,
          numberOfShares: shareholders.numberOfShares,
          boardMemberName: boardMembers.fullName,
          boardMemberEmail: boardMembers.email,
          boardMemberPhone: boardMembers.phone,
        })
        .from(votingTokens)
        .leftJoin(shareholders, eq(votingTokens.shareholderId, shareholders.id))
        .leftJoin(boardMembers, eq(votingTokens.boardMemberId, boardMembers.id))
        .where(eq(votingTokens.resolutionId, resolutionId))
        .orderBy(desc(votingTokens.createdAt));

      const tokens = rows.map(r => ({
        ...r,
        voterName: r.voterType === 'board_member' ? r.boardMemberName : r.shareholderName,
        voterEmail: r.voterType === 'board_member' ? r.boardMemberEmail : r.shareholderEmail,
        voterPhone: r.voterType === 'board_member' ? r.boardMemberPhone : r.shareholderPhone,
        // backward-compat aliases (frontend reads shareholderName/Email/Phone too)
        shareholderName: r.voterType === 'board_member' ? r.boardMemberName : r.shareholderName,
        shareholderEmail: r.voterType === 'board_member' ? r.boardMemberEmail : r.shareholderEmail,
        shareholderPhone: r.voterType === 'board_member' ? r.boardMemberPhone : r.shareholderPhone,
        numberOfShares: r.voterType === 'board_member' ? null : r.numberOfShares,
      }));

      res.json(tokens);
    } catch (error) {
      console.error("Error fetching voting tokens:", error);
      res.status(500).json({ error: "فشل في جلب روابط التصويت" });
    }
  });

  // Create voting token requests - for board members OR shareholders based on resolution type
  app.post("/api/governance/resolutions/:resolutionId/voting-tokens/create-requests", isAuthenticated, requirePermission("governance", "edit"), async (req, res) => {
    try {
      const resolutionId = parseInt(req.params.resolutionId);
      const { expiresInDays = 7 } = req.body;

      const [resolution] = await db.select().from(boardResolutions).where(eq(boardResolutions.id, resolutionId)).limit(1);
      if (!resolution) {
        return res.status(404).json({ error: "القرار غير موجود" });
      }

      const isAssemblyResolution = resolution.resolutionType === 'general_assembly' || resolution.resolutionType === 'extraordinary_assembly';

      const existingTokens = await db.select()
        .from(votingTokens)
        .where(eq(votingTokens.resolutionId, resolutionId));

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      let createdCount = 0;

      if (isAssemblyResolution) {
        const eligibleShareholders = await db.select()
          .from(shareholders)
          .where(eq(shareholders.votingRights, true));

        if (eligibleShareholders.length === 0) {
          return res.status(400).json({ error: "لا يوجد مساهمين لهم حق التصويت" });
        }

        const existingShareholderIds = new Set(
          existingTokens.filter(t => t.shareholderId).map(t => t.shareholderId)
        );

        for (const shareholder of eligibleShareholders) {
          if (!existingShareholderIds.has(shareholder.id)) {
            const voteToken = crypto.randomBytes(32).toString('hex');
            const inserted = await db.insert(votingTokens).values({
              resolutionId,
              shareholderId: shareholder.id,
              voterType: "shareholder",
              voteToken,
              voteWeight: shareholder.numberOfShares || 1,
              status: "pending",
              expiresAt,
            }).onConflictDoNothing().returning({ id: votingTokens.id });
            if (inserted.length > 0) createdCount++;
          }
        }
      } else {
        const activeMembers = await db.select()
          .from(boardMembers)
          .where(eq(boardMembers.status, "active"));

        if (activeMembers.length === 0) {
          return res.status(400).json({ error: "لا يوجد أعضاء مجلس إدارة نشطين" });
        }

        const existingMemberIds = new Set(
          existingTokens.filter(t => t.boardMemberId).map(t => t.boardMemberId)
        );

        for (const member of activeMembers) {
          if (!existingMemberIds.has(member.id)) {
            const voteToken = crypto.randomBytes(32).toString('hex');
            const inserted = await db.insert(votingTokens).values({
              resolutionId,
              boardMemberId: member.id,
              voterType: "board_member",
              voteToken,
              voteWeight: 1,
              status: "pending",
              expiresAt,
            }).onConflictDoNothing().returning({ id: votingTokens.id });
            if (inserted.length > 0) createdCount++;
          }
        }
      }

      // Return all tokens with voter info including vote data for printing
      const allRows = await db
        .select({
          id: votingTokens.id,
          voteToken: votingTokens.voteToken,
          shareholderId: votingTokens.shareholderId,
          boardMemberId: votingTokens.boardMemberId,
          voterType: votingTokens.voterType,
          shareholderName: shareholders.fullName,
          shareholderEmail: shareholders.email,
          shareholderPhone: shareholders.phone,
          numberOfShares: shareholders.numberOfShares,
          boardMemberName: boardMembers.fullName,
          boardMemberEmail: boardMembers.email,
          boardMemberPhone: boardMembers.phone,
          status: votingTokens.status,
          expiresAt: votingTokens.expiresAt,
          vote: votingTokens.vote,
          votedAt: votingTokens.votedAt,
          signatureData: votingTokens.signatureData,
          comments: votingTokens.comments,
        })
        .from(votingTokens)
        .leftJoin(shareholders, eq(votingTokens.shareholderId, shareholders.id))
        .leftJoin(boardMembers, eq(votingTokens.boardMemberId, boardMembers.id))
        .where(eq(votingTokens.resolutionId, resolutionId));

      const allTokens = allRows.map(r => ({
        ...r,
        voterName: r.voterType === 'board_member' ? r.boardMemberName : r.shareholderName,
        voterEmail: r.voterType === 'board_member' ? r.boardMemberEmail : r.shareholderEmail,
        voterPhone: r.voterType === 'board_member' ? r.boardMemberPhone : r.shareholderPhone,
        shareholderName: r.voterType === 'board_member' ? r.boardMemberName : r.shareholderName,
        shareholderEmail: r.voterType === 'board_member' ? r.boardMemberEmail : r.shareholderEmail,
        shareholderPhone: r.voterType === 'board_member' ? r.boardMemberPhone : r.shareholderPhone,
        numberOfShares: r.voterType === 'board_member' ? null : r.numberOfShares,
      }));

      res.json({
        message: `تم إنشاء ${createdCount} رابط تصويت جديد ${isAssemblyResolution ? 'للمساهمين' : 'لأعضاء مجلس الإدارة'}`,
        voterType: isAssemblyResolution ? 'shareholders' : 'board_members',
        tokens: allTokens,
      });
    } catch (error) {
      console.error("Error creating voting token requests:", error);
      res.status(500).json({ error: "فشل في إنشاء روابط التصويت" });
    }
  });

  // CORS for public voting endpoints
  app.options("/api/public/vote/:token", (req, res) => {
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    });
    res.sendStatus(204);
  });

  // Public endpoint - Get voting token info (no auth required)
  app.get("/api/public/vote/:token", async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkVotingRateLimit(clientIp)) {
        return res.status(429).json({ error: "تم تجاوز الحد الأقصى للطلبات. حاول لاحقاً." });
      }

      const { token } = req.params;

      // Validate token format
      if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({ error: "رابط غير صالح" });
      }

      const [rawRecord] = await db
        .select({
          id: votingTokens.id,
          resolutionId: votingTokens.resolutionId,
          shareholderId: votingTokens.shareholderId,
          boardMemberId: votingTokens.boardMemberId,
          voterType: votingTokens.voterType,
          voteWeight: votingTokens.voteWeight,
          status: votingTokens.status,
          vote: votingTokens.vote,
          votedAt: votingTokens.votedAt,
          expiresAt: votingTokens.expiresAt,
          shareholderName: shareholders.fullName,
          boardMemberName: boardMembers.fullName,
          resolutionNumber: boardResolutions.resolutionNumber,
          resolutionTitle: boardResolutions.title,
          resolutionDescription: boardResolutions.description,
          resolutionType: boardResolutions.resolutionType,
          requiredMajority: boardResolutions.requiredMajority,
          resolutionCreatedAt: boardResolutions.createdAt,
        })
        .from(votingTokens)
        .leftJoin(shareholders, eq(votingTokens.shareholderId, shareholders.id))
        .leftJoin(boardMembers, eq(votingTokens.boardMemberId, boardMembers.id))
        .innerJoin(boardResolutions, eq(votingTokens.resolutionId, boardResolutions.id))
        .where(eq(votingTokens.voteToken, token));

      const voteRecord = rawRecord ? {
        ...rawRecord,
        shareholderName: rawRecord.voterType === 'board_member' ? rawRecord.boardMemberName : rawRecord.shareholderName,
        voterName: rawRecord.voterType === 'board_member' ? rawRecord.boardMemberName : rawRecord.shareholderName,
      } : undefined;

      if (!voteRecord) {
        return res.status(404).json({ error: "رابط التصويت غير موجود" });
      }

      if (voteRecord.status === "voted") {
        return res.status(400).json({ error: "تم التصويت على هذا القرار مسبقاً", votedAt: voteRecord.votedAt });
      }

      if (voteRecord.expiresAt && new Date(voteRecord.expiresAt) < new Date()) {
        return res.status(410).json({ error: "انتهت صلاحية رابط التصويت" });
      }

      const fixedRecord = { ...voteRecord };
      if (fixedRecord.resolutionDescription) {
        fixedRecord.resolutionDescription = fixHijriInText(fixedRecord.resolutionDescription);
      }
      res.json(fixedRecord);
    } catch (error) {
      console.error("Error fetching vote record:", error);
      res.status(500).json({ error: "فشل في جلب بيانات التصويت" });
    }
  });

  // Public endpoint - Submit vote (no auth required)
  app.post("/api/public/vote/:token", async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      if (!checkVotingRateLimit(clientIp)) {
        return res.status(429).json({ error: "تم تجاوز الحد الأقصى للطلبات. حاول لاحقاً." });
      }

      const { token } = req.params;
      
      // Validate token format
      if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({ error: "رابط غير صالح" });
      }

      // Validate request body with Zod
      const votePayloadSchema = z.object({
        vote: z.enum(["for", "against", "abstain"]),
        comments: z.string().max(1000).optional(),
        signatureData: z.string().max(500 * 1024).optional(),
      });
      
      const parseResult = votePayloadSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "بيانات التصويت غير صالحة" });
      }
      
      const { vote, comments, signatureData } = parseResult.data;
      
      // Validate signature data format if provided
      if (signatureData && !signatureData.startsWith('data:image/')) {
        return res.status(400).json({ error: "صيغة التوقيع غير صالحة" });
      }

      // Get voting token record
      const [voteRecord] = await db.select().from(votingTokens)
        .where(eq(votingTokens.voteToken, token));

      if (!voteRecord) {
        return res.status(404).json({ error: "رابط التصويت غير موجود" });
      }

      if (voteRecord.status === "voted") {
        return res.status(400).json({ error: "تم التصويت مسبقاً" });
      }

      if (voteRecord.expiresAt && new Date(voteRecord.expiresAt) < new Date()) {
        return res.status(410).json({ error: "انتهت صلاحية رابط التصويت" });
      }

      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('User-Agent');
      const voteWeight = voteRecord.voteWeight || 1;

      // IMMUTABILITY: refuse public token votes on locked resolutions.
      const [targetRes] = await db.select().from(boardResolutions).where(eq(boardResolutions.id, voteRecord.resolutionId));
      if (!targetRes) return res.status(404).json({ error: "القرار غير موجود" });
      if ((targetRes as any).isLocked) {
        return res.status(423).json({ error: "القرار مقفل ولا يمكن التصويت عليه", code: "RESOLUTION_LOCKED" });
      }

      // Atomically claim the token: only update if still pending. Prevents double-voting under concurrency.
      const claimed = await db.update(votingTokens)
        .set({
          vote,
          comments: comments || null,
          signatureData: signatureData || null,
          status: "voted",
          votedAt: new Date(),
          ipAddress,
          userAgent,
          updatedAt: new Date(),
        })
        .where(and(eq(votingTokens.id, voteRecord.id), eq(votingTokens.status, "pending")))
        .returning({ id: votingTokens.id });

      if (claimed.length === 0) {
        return res.status(400).json({ error: "تم التصويت مسبقاً" });
      }

      // Update resolution vote counts
      const voteField = vote === "for" ? "forVotes" : vote === "against" ? "againstVotes" : "abstainVotes";
      await db.update(boardResolutions)
        .set({
          [voteField]: sql`COALESCE(${boardResolutions[voteField as keyof typeof boardResolutions]}, 0) + ${voteWeight}`,
        })
        .where(eq(boardResolutions.id, voteRecord.resolutionId));

      // Try to create audit trail record (non-blocking)
      try {
        const isBoardMember = voteRecord.voterType === 'board_member' && voteRecord.boardMemberId;
        let voterName: string;
        if (isBoardMember) {
          const [m] = await db.select({ fullName: boardMembers.fullName })
            .from(boardMembers)
            .where(eq(boardMembers.id, voteRecord.boardMemberId!));
          voterName = m?.fullName || "عضو مجلس إدارة (تصويت إلكتروني)";
        } else if (voteRecord.shareholderId) {
          const [s] = await db.select({ fullName: shareholders.fullName })
            .from(shareholders)
            .where(eq(shareholders.id, voteRecord.shareholderId));
          voterName = s?.fullName || "مساهم (تصويت إلكتروني)";
        } else {
          voterName = "تصويت إلكتروني";
        }

        // Ensure weightedVote fits numeric(18,4) - max 14 digits before decimal
        const safeWeightedVote = Math.min(voteWeight, 99999999999999).toFixed(4);

        await db.insert(resolutionVotes).values({
          resolutionId: voteRecord.resolutionId,
          voterType: isBoardMember ? "board_member" : "shareholder",
          shareholderId: isBoardMember ? null : voteRecord.shareholderId,
          boardMemberId: isBoardMember ? voteRecord.boardMemberId : null,
          voterName,
          vote,
          comments: comments || null,
          votingPower: "1.0000",
          weightedVote: safeWeightedVote,
          voteMethod: "electronic",
          ipAddress,
        });

        // Record in system audit log
        const voteLabel = vote === 'for' ? 'موافق' : vote === 'against' ? 'معارض' : 'ممتنع';
        await db.insert(systemAuditLogs).values({
          module: 'governance',
          entityId: voteRecord.resolutionId.toString(),
          entityName: 'vote',
          action: isBoardMember ? 'تصويت عضو مجلس' : 'تصويت مساهم',
          details: JSON.stringify({
            shareholderName: voterName,
            vote: voteLabel,
            votingPower: safeWeightedVote,
            comments: comments || null
          }),
          userName: voterName,
          ipAddress,
          userAgent: req.headers['user-agent'] || null,
        });
      } catch (auditError) {
        // Log audit error but don't fail the vote - voting token already updated
        console.error("Error creating audit trail (vote was recorded):", auditError);
      }

      res.json({ success: true, message: "تم تسجيل تصويتك بنجاح" });
    } catch (error) {
      console.error("Error submitting vote:", error);
      res.status(500).json({ error: "فشل في حفظ التصويت" });
    }
  });

  // Get voting audit log
  app.get("/api/governance/voting-audit-log", isAuthenticated, requirePermission("governance_voting", "view"), async (req, res) => {
    try {
      let auditLogs = await db
        .select({
          id: systemAuditLogs.id,
          action: systemAuditLogs.action,
          entityId: systemAuditLogs.entityId,
          entityName: systemAuditLogs.entityName,
          details: systemAuditLogs.details,
          userName: systemAuditLogs.userName,
          ipAddress: systemAuditLogs.ipAddress,
          createdAt: systemAuditLogs.createdAt,
        })
        .from(systemAuditLogs)
        .where(eq(systemAuditLogs.module, 'governance'))
        .orderBy(desc(systemAuditLogs.createdAt))
        .limit(100);

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.json(auditLogs);
    } catch (error) {
      console.error("Error fetching voting audit log:", error);
      res.status(500).json({ error: "فشل في جلب سجل التدقيق" });
    }
  });

  app.post("/api/governance/meetings/:id/generate-rsvp", isAuthenticated, requirePermission("governance_meetings", "edit"), async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const [meeting] = await db.select().from(governanceMeetings).where(eq(governanceMeetings.id, meetingId));
      if (!meeting) {
        return res.status(404).json({ error: "الاجتماع غير موجود" });
      }

      const shareholdersList = await db.select().from(shareholders).where(eq(shareholders.votingRights, true));
      const existingRsvps = await db.select().from(meetingRsvps).where(eq(meetingRsvps.meetingId, meetingId));
      const existingTokenMap = new Map(existingRsvps.map(r => [r.shareholderId, r]));

      const rsvpResults = [];
      for (const shareholder of shareholdersList) {
        if (existingTokenMap.has(shareholder.id)) {
          rsvpResults.push(existingTokenMap.get(shareholder.id)!);
          continue;
        }
        const token = crypto.randomBytes(32).toString('hex');
        const [rsvp] = await db.insert(meetingRsvps).values({
          meetingId,
          shareholderId: shareholder.id,
          token,
          status: 'pending',
          shareholderName: shareholder.fullName,
          shareholderPhone: shareholder.phone || null,
        }).returning();
        rsvpResults.push(rsvp);
      }

      res.json({ rsvps: rsvpResults, meetingTitle: meeting.title });
    } catch (error) {
      console.error("Error generating RSVP tokens:", error);
      res.status(500).json({ error: "فشل في إنشاء روابط تأكيد الحضور" });
    }
  });

  app.get("/api/governance/meetings/:id/rsvps", isAuthenticated, requirePermission("governance_meetings", "view"), async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      const rsvps = await db.select().from(meetingRsvps).where(eq(meetingRsvps.meetingId, meetingId)).orderBy(desc(meetingRsvps.confirmedAt));
      res.json(rsvps);
    } catch (error) {
      console.error("Error fetching RSVPs:", error);
      res.status(500).json({ error: "فشل في جلب تأكيدات الحضور" });
    }
  });

  app.get("/api/rsvp/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const [rsvp] = await db.select().from(meetingRsvps).where(eq(meetingRsvps.token, token));
      if (!rsvp) {
        return res.status(404).json({ error: "رابط غير صالح" });
      }

      const [meeting] = await db.select().from(governanceMeetings).where(eq(governanceMeetings.id, rsvp.meetingId));

      res.json({
        shareholderName: rsvp.shareholderName,
        meetingTitle: meeting?.title || '',
        meetingDate: meeting?.meetingDate || '',
        meetingLocation: meeting?.location || '',
        status: rsvp.status,
        confirmedAt: rsvp.confirmedAt,
        declinedAt: rsvp.declinedAt,
      });
    } catch (error) {
      console.error("Error fetching RSVP:", error);
      res.status(500).json({ error: "حدث خطأ" });
    }
  });

  app.post("/api/rsvp/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { action, note } = req.body;

      const [rsvp] = await db.select().from(meetingRsvps).where(eq(meetingRsvps.token, token));
      if (!rsvp) {
        return res.status(404).json({ error: "رابط غير صالح" });
      }

      if (action === 'confirm') {
        await db.update(meetingRsvps)
          .set({ status: 'confirmed', confirmedAt: new Date(), responseNote: note || null })
          .where(eq(meetingRsvps.token, token));

        const existingAttendance = await db.select().from(meetingAttendance)
          .where(and(
            eq(meetingAttendance.meetingId, rsvp.meetingId),
            eq(meetingAttendance.shareholderId, rsvp.shareholderId)
          ));

        if (existingAttendance.length === 0) {
          await db.insert(meetingAttendance).values({
            meetingId: rsvp.meetingId,
            attendeeType: 'shareholder',
            shareholderId: rsvp.shareholderId,
            attendeeName: rsvp.shareholderName,
            attendanceStatus: 'expected',
            attendanceMethod: 'in_person',
          });
        }

        res.json({ success: true, message: "تم تأكيد حضورك بنجاح" });
      } else if (action === 'decline') {
        await db.update(meetingRsvps)
          .set({ status: 'declined', declinedAt: new Date(), responseNote: note || null })
          .where(eq(meetingRsvps.token, token));
        res.json({ success: true, message: "تم تسجيل اعتذارك" });
      } else {
        res.status(400).json({ error: "إجراء غير صالح" });
      }
    } catch (error) {
      console.error("Error processing RSVP:", error);
      res.status(500).json({ error: "حدث خطأ أثناء معالجة الطلب" });
    }
  });

  // ==========================================================================
  // PHASE 3 — NOMU READINESS
  // ==========================================================================

  const getUid = (req: Request) => (req as any).currentUser?.id || null;

  // Phase 3 partial-update allowlist schemas (block mass-assignment of workflow fields)
  const updateAuditCommitteeSchema = insertAuditCommitteeSchema.partial().omit({ createdBy: true });
  const updateAuditCommitteeMemberSchema = insertAuditCommitteeMemberSchema.partial();
  const updateAuditCommitteeReportSchema = insertAuditCommitteeReportSchema.partial().omit({ createdBy: true, isLocked: true, lockedAt: true, lockedBy: true, approvedBy: true, approvedAt: true });
  const updateProspectusSchema = insertProspectusSchema.partial().omit({ createdBy: true, approvedBy: true, approvedAt: true, publishedAt: true });
  const updateProspectusSectionSchema = insertProspectusSectionSchema.partial().omit({ prospectusId: true });
  const updateIrEventSchema = insertIrEventSchema.partial().omit({ createdBy: true });
  const updateIrContactSchema = insertIrContactSchema.partial().omit({ createdBy: true });
  const updateMaterialDisclosureSchema = insertMaterialDisclosureSchema.partial().omit({ createdBy: true, disclosureNumber: true, isLocked: true, lockedAt: true, lockedBy: true, publishedToTadawul: true, tadawulReference: true, tadawulPublishedAt: true, approvedBy: true, approvedAt: true, reviewedBy: true, reviewedAt: true });
  const updateInternalAuditPlanSchema = insertInternalAuditPlanSchema.partial().omit({ createdBy: true, approvedBy: true, approvedAt: true });
  const updateInternalAuditEngagementSchema = insertInternalAuditEngagementSchema.partial().omit({ createdBy: true, reference: true, totalFindings: true, openFindings: true });
  const updateInternalAuditFindingSchema = insertInternalAuditFindingSchema.partial().omit({ createdBy: true, engagementId: true });

  // ---- Audit Committee ----
  app.get("/api/governance/audit-committees", isAuthenticated, requirePermission("governance_compliance", "view"), async (_req, res) => {
    try {
      const rows = await db.select().from(auditCommittees).orderBy(desc(auditCommittees.createdAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/governance/audit-committees", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const data = insertAuditCommitteeSchema.parse({ ...req.body, createdBy: getUid(req) });
      const [row] = await db.insert(auditCommittees).values(data).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/governance/audit-committees/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = updateAuditCommitteeSchema.parse(req.body);
      const [row] = await db.update(auditCommittees).set({ ...data, updatedAt: new Date() }).where(eq(auditCommittees.id, id)).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/governance/audit-committees/:id", isAuthenticated, requirePermission("governance_compliance", "delete"), async (req, res) => {
    try {
      await db.delete(auditCommittees).where(eq(auditCommittees.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/governance/audit-committee-members", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const committeeId = req.query.committeeId ? parseInt(req.query.committeeId as string) : null;
      const rows = committeeId
        ? await db.select().from(auditCommitteeMembers).where(eq(auditCommitteeMembers.committeeId, committeeId)).orderBy(asc(auditCommitteeMembers.appointmentDate))
        : await db.select().from(auditCommitteeMembers).orderBy(asc(auditCommitteeMembers.appointmentDate));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/governance/audit-committee-members", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const data = insertAuditCommitteeMemberSchema.parse(req.body);
      const [row] = await db.insert(auditCommitteeMembers).values(data).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/governance/audit-committee-members/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const data = updateAuditCommitteeMemberSchema.parse(req.body);
      const [row] = await db.update(auditCommitteeMembers).set({ ...data, updatedAt: new Date() }).where(eq(auditCommitteeMembers.id, parseInt(req.params.id))).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/governance/audit-committee-members/:id", isAuthenticated, requirePermission("governance_compliance", "delete"), async (req, res) => {
    try {
      await db.delete(auditCommitteeMembers).where(eq(auditCommitteeMembers.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/governance/audit-committee-reports", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const committeeId = req.query.committeeId ? parseInt(req.query.committeeId as string) : null;
      const rows = committeeId
        ? await db.select().from(auditCommitteeReports).where(eq(auditCommitteeReports.committeeId, committeeId)).orderBy(desc(auditCommitteeReports.createdAt))
        : await db.select().from(auditCommitteeReports).orderBy(desc(auditCommitteeReports.createdAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/governance/audit-committee-reports", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const data = insertAuditCommitteeReportSchema.parse({ ...req.body, createdBy: getUid(req) });
      const [row] = await db.insert(auditCommitteeReports).values(data).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/governance/audit-committee-reports/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(auditCommitteeReports).where(eq(auditCommitteeReports.id, id));
      if (!existing) return res.status(404).json({ error: "غير موجود" });
      if (existing.isLocked) return res.status(403).json({ error: "التقرير مقفل ولا يمكن تعديله" });
      const data = updateAuditCommitteeReportSchema.parse(req.body);
      const [row] = await db.update(auditCommitteeReports).set({ ...data, updatedAt: new Date() }).where(eq(auditCommitteeReports.id, id)).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.post("/api/governance/audit-committee-reports/:id/lock", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [row] = await db.update(auditCommitteeReports)
        .set({ isLocked: true, lockedAt: new Date(), lockedBy: getUid(req), updatedAt: new Date() })
        .where(eq(auditCommitteeReports.id, id)).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/governance/audit-committee-reports/:id", isAuthenticated, requirePermission("governance_compliance", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(auditCommitteeReports).where(eq(auditCommitteeReports.id, id));
      if (existing?.isLocked) return res.status(403).json({ error: "التقرير مقفل ولا يمكن حذفه" });
      await db.delete(auditCommitteeReports).where(eq(auditCommitteeReports.id, id));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ---- Prospectus ----
  const DEFAULT_PROSPECTUS_SECTIONS = [
    { key: "executive_summary", title: "الملخص التنفيذي" },
    { key: "company_overview", title: "نظرة عامة على الشركة" },
    { key: "business_description", title: "وصف الأعمال" },
    { key: "risk_factors", title: "عوامل المخاطر" },
    { key: "financial_statements", title: "القوائم المالية" },
    { key: "use_of_proceeds", title: "استخدام متحصلات الطرح" },
    { key: "management", title: "الإدارة وحوكمة الشركة" },
    { key: "major_shareholders", title: "كبار المساهمين" },
    { key: "dividend_policy", title: "سياسة توزيع الأرباح" },
    { key: "legal_matters", title: "الأمور القانونية والقضائية" },
    { key: "subscription_terms", title: "شروط وأحكام الطرح" },
    { key: "underwriting", title: "الالتزامات وتعهدات التغطية" },
    { key: "tax_considerations", title: "الاعتبارات الضريبية والزكوية" },
    { key: "additional_info", title: "معلومات إضافية" },
  ];

  app.get("/api/governance/prospectuses", isAuthenticated, requirePermission("governance_compliance", "view"), async (_req, res) => {
    try {
      const rows = await db.select().from(prospectuses).orderBy(desc(prospectuses.createdAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/governance/prospectuses", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const data = insertProspectusSchema.parse({ ...req.body, createdBy: getUid(req) });
      const [row] = await db.insert(prospectuses).values(data).returning();
      // Seed standard CMA sections
      await db.insert(prospectusSections).values(
        DEFAULT_PROSPECTUS_SECTIONS.map((s, i) => ({
          prospectusId: row.id,
          sectionKey: s.key,
          title: s.title,
          orderIndex: i,
          requiredByCma: true,
          status: "pending",
        }))
      );
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/governance/prospectuses/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const data = updateProspectusSchema.parse(req.body);
      const [row] = await db.update(prospectuses).set({ ...data, updatedAt: new Date() }).where(eq(prospectuses.id, parseInt(req.params.id))).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/governance/prospectuses/:id", isAuthenticated, requirePermission("governance_compliance", "delete"), async (req, res) => {
    try {
      await db.delete(prospectuses).where(eq(prospectuses.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/governance/prospectuses/:id/sections", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const rows = await db.select().from(prospectusSections)
        .where(eq(prospectusSections.prospectusId, parseInt(req.params.id)))
        .orderBy(asc(prospectusSections.orderIndex));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.patch("/api/governance/prospectus-sections/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const data = updateProspectusSectionSchema.parse(req.body);
      const [row] = await db.update(prospectusSections).set({ ...data, updatedAt: new Date() }).where(eq(prospectusSections.id, parseInt(req.params.id))).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ---- IR Events ----
  app.get("/api/governance/ir-events", isAuthenticated, requirePermission("governance_compliance", "view"), async (_req, res) => {
    try {
      const rows = await db.select().from(irEvents).orderBy(desc(irEvents.eventDate));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/governance/ir-events", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const data = insertIrEventSchema.parse({ ...req.body, createdBy: getUid(req) });
      const [row] = await db.insert(irEvents).values(data).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/governance/ir-events/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const data = updateIrEventSchema.parse(req.body);
      const [row] = await db.update(irEvents).set({ ...data, updatedAt: new Date() }).where(eq(irEvents.id, parseInt(req.params.id))).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/governance/ir-events/:id", isAuthenticated, requirePermission("governance_compliance", "delete"), async (req, res) => {
    try {
      await db.delete(irEvents).where(eq(irEvents.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ---- IR Contacts ----
  app.get("/api/governance/ir-contacts", isAuthenticated, requirePermission("governance_compliance", "view"), async (_req, res) => {
    try {
      const rows = await db.select().from(irContacts).orderBy(desc(irContacts.createdAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/governance/ir-contacts", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const data = insertIrContactSchema.parse({ ...req.body, createdBy: getUid(req) });
      const [row] = await db.insert(irContacts).values(data).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/governance/ir-contacts/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const data = updateIrContactSchema.parse(req.body);
      const [row] = await db.update(irContacts).set({ ...data, updatedAt: new Date() }).where(eq(irContacts.id, parseInt(req.params.id))).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/governance/ir-contacts/:id", isAuthenticated, requirePermission("governance_compliance", "delete"), async (req, res) => {
    try {
      await db.delete(irContacts).where(eq(irContacts.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ---- Material Disclosures ----
  app.get("/api/governance/material-disclosures", isAuthenticated, requirePermission("governance_disclosures", "view"), async (_req, res) => {
    try {
      const rows = await db.select().from(materialDisclosures).orderBy(desc(materialDisclosures.eventDate));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/governance/material-disclosures", isAuthenticated, requirePermission("governance_disclosures", "create"), async (req, res) => {
    try {
      // Auto-generate disclosure number if not provided
      let disclosureNumber = req.body.disclosureNumber;
      if (!disclosureNumber) {
        const year = new Date().getFullYear();
        const countRows = await db.select({ c: sql<number>`count(*)::int` }).from(materialDisclosures)
          .where(sql`extract(year from ${materialDisclosures.eventDate}) = ${year}`);
        const seq = (countRows[0]?.c || 0) + 1;
        disclosureNumber = `MD-${year}-${String(seq).padStart(4, "0")}`;
      }
      const data = insertMaterialDisclosureSchema.parse({ ...req.body, disclosureNumber, createdBy: getUid(req) });
      const [row] = await db.insert(materialDisclosures).values(data).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/governance/material-disclosures/:id", isAuthenticated, requirePermission("governance_disclosures", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(materialDisclosures).where(eq(materialDisclosures.id, id));
      if (!existing) return res.status(404).json({ error: "غير موجود" });
      if (existing.isLocked) return res.status(403).json({ error: "الإفصاح مقفل ولا يمكن تعديله" });
      const data = updateMaterialDisclosureSchema.parse(req.body);
      const [row] = await db.update(materialDisclosures).set({ ...data, updatedAt: new Date() }).where(eq(materialDisclosures.id, id)).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.post("/api/governance/material-disclosures/:id/lock", isAuthenticated, requirePermission("governance_disclosures", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [row] = await db.update(materialDisclosures)
        .set({ isLocked: true, lockedAt: new Date(), lockedBy: getUid(req), updatedAt: new Date() })
        .where(eq(materialDisclosures.id, id)).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.post("/api/governance/material-disclosures/:id/publish-tadawul", isAuthenticated, requirePermission("governance_disclosures", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(materialDisclosures).where(eq(materialDisclosures.id, id));
      if (!existing) return res.status(404).json({ error: "غير موجود" });
      if (existing.isLocked) return res.status(403).json({ error: "الإفصاح مقفل ولا يمكن نشره" });
      if (existing.publishedToTadawul) return res.status(409).json({ error: "الإفصاح منشور مسبقاً في تداول" });
      const tadawulReference = req.body.tadawulReference || `TDW-${Date.now()}`;
      const [row] = await db.update(materialDisclosures)
        .set({
          publishedToTadawul: true,
          tadawulReference,
          tadawulPublishedAt: new Date(),
          status: "published",
          updatedAt: new Date(),
        })
        .where(eq(materialDisclosures.id, id)).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/governance/material-disclosures/:id", isAuthenticated, requirePermission("governance_disclosures", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(materialDisclosures).where(eq(materialDisclosures.id, id));
      if (existing?.isLocked) return res.status(403).json({ error: "الإفصاح مقفل ولا يمكن حذفه" });
      await db.delete(materialDisclosures).where(eq(materialDisclosures.id, id));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ---- Internal Audit Plans ----
  app.get("/api/governance/audit-plans", isAuthenticated, requirePermission("governance_compliance", "view"), async (_req, res) => {
    try {
      const rows = await db.select().from(internalAuditPlans).orderBy(desc(internalAuditPlans.fiscalYear));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/governance/audit-plans", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const data = insertInternalAuditPlanSchema.parse({ ...req.body, createdBy: getUid(req) });
      const [row] = await db.insert(internalAuditPlans).values(data).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/governance/audit-plans/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const data = updateInternalAuditPlanSchema.parse(req.body);
      const [row] = await db.update(internalAuditPlans).set({ ...data, updatedAt: new Date() }).where(eq(internalAuditPlans.id, parseInt(req.params.id))).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/governance/audit-plans/:id", isAuthenticated, requirePermission("governance_compliance", "delete"), async (req, res) => {
    try {
      await db.delete(internalAuditPlans).where(eq(internalAuditPlans.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ---- Internal Audit Engagements ----
  app.get("/api/governance/audit-engagements", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const planId = req.query.planId ? parseInt(req.query.planId as string) : null;
      const rows = planId
        ? await db.select().from(internalAuditEngagements).where(eq(internalAuditEngagements.planId, planId)).orderBy(desc(internalAuditEngagements.createdAt))
        : await db.select().from(internalAuditEngagements).orderBy(desc(internalAuditEngagements.createdAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/governance/audit-engagements", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      let reference = req.body.reference;
      if (!reference) {
        const year = new Date().getFullYear();
        const countRows = await db.select({ c: sql<number>`count(*)::int` }).from(internalAuditEngagements);
        const seq = (countRows[0]?.c || 0) + 1;
        reference = `IA-${year}-${String(seq).padStart(4, "0")}`;
      }
      const data = insertInternalAuditEngagementSchema.parse({ ...req.body, reference, createdBy: getUid(req) });
      const [row] = await db.insert(internalAuditEngagements).values(data).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/governance/audit-engagements/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const data = updateInternalAuditEngagementSchema.parse(req.body);
      const [row] = await db.update(internalAuditEngagements).set({ ...data, updatedAt: new Date() }).where(eq(internalAuditEngagements.id, parseInt(req.params.id))).returning();
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/governance/audit-engagements/:id", isAuthenticated, requirePermission("governance_compliance", "delete"), async (req, res) => {
    try {
      await db.delete(internalAuditEngagements).where(eq(internalAuditEngagements.id, parseInt(req.params.id)));
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // ---- Internal Audit Findings ----
  app.get("/api/governance/audit-findings", isAuthenticated, requirePermission("governance_compliance", "view"), async (req, res) => {
    try {
      const engagementId = req.query.engagementId ? parseInt(req.query.engagementId as string) : null;
      const rows = engagementId
        ? await db.select().from(internalAuditFindings).where(eq(internalAuditFindings.engagementId, engagementId)).orderBy(desc(internalAuditFindings.createdAt))
        : await db.select().from(internalAuditFindings).orderBy(desc(internalAuditFindings.createdAt));
      res.json(rows);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/governance/audit-findings", isAuthenticated, requirePermission("governance_compliance", "create"), async (req, res) => {
    try {
      const data = insertInternalAuditFindingSchema.parse({ ...req.body, createdBy: getUid(req) });
      const [row] = await db.insert(internalAuditFindings).values(data).returning();
      // Recount findings on engagement
      const all = await db.select().from(internalAuditFindings).where(eq(internalAuditFindings.engagementId, data.engagementId));
      const open = all.filter(f => f.status === "open" || f.status === "in_progress" || f.status === "overdue").length;
      await db.update(internalAuditEngagements)
        .set({ totalFindings: all.length, openFindings: open, updatedAt: new Date() })
        .where(eq(internalAuditEngagements.id, data.engagementId));
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.patch("/api/governance/audit-findings/:id", isAuthenticated, requirePermission("governance_compliance", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = updateInternalAuditFindingSchema.parse(req.body);
      const updates: any = { ...data, updatedAt: new Date() };
      if (data.status === "resolved" && !data.resolvedAt) updates.resolvedAt = new Date();
      const [row] = await db.update(internalAuditFindings).set(updates).where(eq(internalAuditFindings.id, id)).returning();
      if (row?.engagementId) {
        const all = await db.select().from(internalAuditFindings).where(eq(internalAuditFindings.engagementId, row.engagementId));
        const open = all.filter(f => f.status === "open" || f.status === "in_progress" || f.status === "overdue").length;
        await db.update(internalAuditEngagements)
          .set({ totalFindings: all.length, openFindings: open, updatedAt: new Date() })
          .where(eq(internalAuditEngagements.id, row.engagementId));
      }
      res.json(row);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.delete("/api/governance/audit-findings/:id", isAuthenticated, requirePermission("governance_compliance", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [existing] = await db.select().from(internalAuditFindings).where(eq(internalAuditFindings.id, id));
      await db.delete(internalAuditFindings).where(eq(internalAuditFindings.id, id));
      if (existing?.engagementId) {
        const all = await db.select().from(internalAuditFindings).where(eq(internalAuditFindings.engagementId, existing.engagementId));
        const open = all.filter(f => f.status === "open" || f.status === "in_progress" || f.status === "overdue").length;
        await db.update(internalAuditEngagements)
          .set({ totalFindings: all.length, openFindings: open, updatedAt: new Date() })
          .where(eq(internalAuditEngagements.id, existing.engagementId));
      }
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Aggregate KPI for findings dashboard
  app.get("/api/governance/audit-findings/_kpi", isAuthenticated, requirePermission("governance_compliance", "view"), async (_req, res) => {
    try {
      const all = await db.select().from(internalAuditFindings);
      const total = all.length;
      const open = all.filter(f => f.status === "open").length;
      const inProgress = all.filter(f => f.status === "in_progress").length;
      const resolved = all.filter(f => f.status === "resolved").length;
      const critical = all.filter(f => f.severity === "critical").length;
      const high = all.filter(f => f.severity === "high").length;
      const overdue = all.filter(f => {
        if (!f.dueDate || f.status === "resolved" || f.status === "accepted_risk") return false;
        return new Date(f.dueDate) < new Date();
      }).length;
      res.json({ total, open, inProgress, resolved, critical, high, overdue });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
