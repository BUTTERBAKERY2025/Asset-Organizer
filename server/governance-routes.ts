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
} from "@shared/schema";
import crypto from "crypto";
import { z } from "zod";
import { sendMeetingInvitations, isTwilioConfigured } from "./twilio-service";

const updateBoardMemberSchema = insertBoardMemberSchema.partial().omit({ createdBy: true });
const updateShareholderSchema = insertShareholderSchema.partial().omit({ createdBy: true });
const updateShareTransferSchema = insertShareTransferSchema.partial().omit({ createdBy: true, transferNumber: true });
const updateGovernanceMeetingSchema = insertGovernanceMeetingSchema.partial().omit({ createdBy: true, meetingNumber: true });
const updateMeetingAttendanceSchema = insertMeetingAttendanceSchema.partial();
const updateMeetingMinutesSchema = insertMeetingMinutesSchema.partial().omit({ createdBy: true, minutesNumber: true });
const updateBoardResolutionSchema = insertBoardResolutionSchema.partial().omit({ createdBy: true, resolutionNumber: true });
const updateDisclosureSchema = insertDisclosureSchema.partial().omit({ createdBy: true, disclosureNumber: true });
const updateComplianceRequirementSchema = insertComplianceRequirementSchema.partial().omit({ createdBy: true, requirementCode: true });
const updateDividendDistributionSchema = insertDividendDistributionSchema.partial().omit({ createdBy: true, distributionNumber: true });
const updateCapitalTransactionSchema = insertCapitalTransactionSchema.partial().omit({ createdBy: true, transactionNumber: true });

function getCurrentUserId(req: Request): string {
  return (req as any).currentUser?.id || "system";
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
      const [member] = await db.insert(boardMembers).values(data).returning();
      res.status(201).json(member);
    } catch (error) {
      console.error("Error creating board member:", error);
      res.status(500).json({ error: "فشل في إضافة عضو المجلس" });
    }
  });

  app.patch("/api/governance/board-members/:id", isAuthenticated, requirePermission("governance_board", "edit"), async (req, res) => {
    try {
      const validatedData = updateBoardMemberSchema.parse(req.body);
      const [member] = await db.update(boardMembers)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(boardMembers.id, parseInt(req.params.id)))
        .returning();
      res.json(member);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating board member:", error);
      res.status(500).json({ error: "فشل في تحديث بيانات عضو المجلس" });
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
      const userId = (req as any).user?.id;
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
      const year = new Date().getFullYear();
      const count = await db.select({ count: sql<number>`count(*)` }).from(governanceMeetings);
      const meetingNumber = `MTG-${year}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const { sendWhatsApp, sendEmail, sendSMS, invitationMessage, meetingLink, meetingPlatform, scheduledDate, quorumRequired, ...meetingData } = req.body;
      
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
        meetingNumber,
        meetingDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        quorumRequired: quorumRequired ? String(quorumRequired) : "50",
        notes: meetingLink ? `رابط الاجتماع (${meetingPlatform}): ${meetingLink}\n${meetingData.notes || ''}` : meetingData.notes,
        createdBy: getCurrentUserId(req),
      };

      const [meeting] = await db.insert(governanceMeetings).values(insertData).returning();

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

      res.status(201).json({ ...meeting, invitationResults });
    } catch (error) {
      console.error("Error creating meeting:", error);
      res.status(500).json({ error: "فشل في إنشاء الاجتماع" });
    }
  });

  app.patch("/api/governance/meetings/:id", isAuthenticated, requirePermission("governance_meetings", "edit"), async (req, res) => {
    try {
      const validatedData = updateGovernanceMeetingSchema.parse(req.body);
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
      const count = await db.select({ count: sql<number>`count(*)` }).from(meetingMinutes);
      const minutesNumber = `MIN-${year}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
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
      const validatedData = updateMeetingMinutesSchema.parse(req.body);
      const [minutes] = await db.update(meetingMinutes)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(meetingMinutes.id, parseInt(req.params.id)))
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

  // =====================================================
  // Board Resolutions - قرارات مجلس الإدارة
  // =====================================================
  
  app.get("/api/governance/resolutions", isAuthenticated, requirePermission("governance_resolutions", "view"), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const type = req.query.type as string | undefined;
      
      let query = db.select().from(boardResolutions);
      const conditions: any[] = [];
      
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
      if (!resolution) {
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
      const count = await db.select({ count: sql<number>`count(*)` }).from(boardResolutions);
      const resolutionNumber = `RES-${year}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const data = insertBoardResolutionSchema.parse({
        ...req.body,
        resolutionNumber,
        proposedBy: getCurrentUserId(req),
        proposedAt: new Date(),
        createdBy: getCurrentUserId(req),
      });
      const [resolution] = await db.insert(boardResolutions).values(data).returning();
      res.status(201).json(resolution);
    } catch (error) {
      console.error("Error creating resolution:", error);
      res.status(500).json({ error: "فشل في إنشاء القرار" });
    }
  });

  app.patch("/api/governance/resolutions/:id", isAuthenticated, requirePermission("governance_resolutions", "edit"), async (req, res) => {
    try {
      const validatedData = updateBoardResolutionSchema.parse(req.body);
      const [resolution] = await db.update(boardResolutions)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(boardResolutions.id, parseInt(req.params.id)))
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

  app.delete("/api/governance/resolutions/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (user?.role !== 'admin') {
        return res.status(403).json({ error: "فقط المسؤول يمكنه حذف القرارات" });
      }
      
      const resolutionId = parseInt(req.params.id);
      
      await db.delete(resolutionSignatures).where(eq(resolutionSignatures.resolutionId, resolutionId));
      await db.delete(resolutionVotes).where(eq(resolutionVotes.resolutionId, resolutionId));
      
      const [deleted] = await db.delete(boardResolutions)
        .where(eq(boardResolutions.id, resolutionId))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ error: "القرار غير موجود" });
      }
      
      res.json({ success: true, message: "تم حذف القرار بنجاح" });
    } catch (error) {
      console.error("Error deleting resolution:", error);
      res.status(500).json({ error: "فشل في حذف القرار" });
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

  // Get signatures for a resolution
  app.get("/api/governance/resolutions/:resolutionId/signatures", isAuthenticated, async (req, res) => {
    try {
      const resolutionId = parseInt(req.params.resolutionId);
      const signatures = await db
        .select({
          id: resolutionSignatures.id,
          resolutionId: resolutionSignatures.resolutionId,
          boardMemberId: resolutionSignatures.boardMemberId,
          signatureToken: resolutionSignatures.signatureToken,
          signatureData: resolutionSignatures.signatureData,
          signatureType: resolutionSignatures.signatureType,
          status: resolutionSignatures.status,
          signedAt: resolutionSignatures.signedAt,
          declinedAt: resolutionSignatures.declinedAt,
          declineReason: resolutionSignatures.declineReason,
          expiresAt: resolutionSignatures.expiresAt,
          createdAt: resolutionSignatures.createdAt,
          memberName: boardMembers.fullName,
          memberPosition: boardMembers.position,
          memberEmail: boardMembers.email,
        })
        .from(resolutionSignatures)
        .innerJoin(boardMembers, eq(resolutionSignatures.boardMemberId, boardMembers.id))
        .where(eq(resolutionSignatures.resolutionId, resolutionId))
        .orderBy(desc(resolutionSignatures.createdAt));
      
      res.json(signatures);
    } catch (error) {
      console.error("Error fetching signatures:", error);
      res.status(500).json({ error: "فشل في جلب التوقيعات" });
    }
  });

  // Create signature requests for all active board members
  app.post("/api/governance/resolutions/:resolutionId/signatures/create-requests", isAuthenticated, requirePermission("governance", "edit"), async (req, res) => {
    try {
      const resolutionId = parseInt(req.params.resolutionId);
      const { expiresInDays = 7 } = req.body;
      
      // Get active board members
      const members = await db.select().from(boardMembers).where(eq(boardMembers.status, "active"));
      
      if (members.length === 0) {
        return res.status(400).json({ error: "لا يوجد أعضاء مجلس نشطين" });
      }
      
      // Check for existing pending signatures
      const existingSignatures = await db.select()
        .from(resolutionSignatures)
        .where(eq(resolutionSignatures.resolutionId, resolutionId));
      
      const existingMemberIds = new Set(existingSignatures.map(s => s.boardMemberId));
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      
      const newSignatures = [];
      for (const member of members) {
        if (!existingMemberIds.has(member.id)) {
          const signatureToken = crypto.randomBytes(32).toString('hex');
          newSignatures.push({
            resolutionId,
            boardMemberId: member.id,
            signatureToken,
            status: "pending" as const,
            expiresAt,
          });
        }
      }
      
      if (newSignatures.length > 0) {
        await db.insert(resolutionSignatures).values(newSignatures);
      }
      
      // Return all signatures with member info
      const allSignatures = await db
        .select({
          id: resolutionSignatures.id,
          signatureToken: resolutionSignatures.signatureToken,
          status: resolutionSignatures.status,
          memberName: boardMembers.fullName,
          memberEmail: boardMembers.email,
        })
        .from(resolutionSignatures)
        .innerJoin(boardMembers, eq(resolutionSignatures.boardMemberId, boardMembers.id))
        .where(eq(resolutionSignatures.resolutionId, resolutionId));
      
      res.json({ 
        created: newSignatures.length, 
        total: allSignatures.length,
        signatures: allSignatures 
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

  // Get voting tokens for a resolution
  app.get("/api/governance/resolutions/:resolutionId/voting-tokens", isAuthenticated, async (req, res) => {
    try {
      const resolutionId = parseInt(req.params.resolutionId);
      const tokens = await db
        .select({
          id: votingTokens.id,
          resolutionId: votingTokens.resolutionId,
          shareholderId: votingTokens.shareholderId,
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
          numberOfShares: shareholders.numberOfShares,
        })
        .from(votingTokens)
        .innerJoin(shareholders, eq(votingTokens.shareholderId, shareholders.id))
        .where(eq(votingTokens.resolutionId, resolutionId))
        .orderBy(desc(votingTokens.createdAt));
      
      res.json(tokens);
    } catch (error) {
      console.error("Error fetching voting tokens:", error);
      res.status(500).json({ error: "فشل في جلب روابط التصويت" });
    }
  });

  // Create voting token requests for all shareholders with voting rights
  app.post("/api/governance/resolutions/:resolutionId/voting-tokens/create-requests", isAuthenticated, requirePermission("governance", "edit"), async (req, res) => {
    try {
      const resolutionId = parseInt(req.params.resolutionId);
      const { expiresInDays = 7 } = req.body;

      // Get all shareholders with voting rights
      const eligibleShareholders = await db.select()
        .from(shareholders)
        .where(eq(shareholders.votingRights, true));

      if (eligibleShareholders.length === 0) {
        return res.status(400).json({ error: "لا يوجد مساهمين لهم حق التصويت" });
      }

      // Check for existing tokens (any status)
      const existingTokens = await db.select()
        .from(votingTokens)
        .where(eq(votingTokens.resolutionId, resolutionId));

      const existingShareholderIds = new Set(existingTokens.map(t => t.shareholderId));
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Create tokens for shareholders that don't have pending tokens
      for (const shareholder of eligibleShareholders) {
        if (!existingShareholderIds.has(shareholder.id)) {
          const voteToken = crypto.randomBytes(32).toString('hex');
          await db.insert(votingTokens).values({
            resolutionId,
            shareholderId: shareholder.id,
            voteToken,
            voteWeight: shareholder.numberOfShares || 1,
            status: "pending",
            expiresAt,
          }).onConflictDoNothing();
        }
      }

      // Return all tokens with shareholder info including vote data for printing
      const allTokens = await db
        .select({
          id: votingTokens.id,
          voteToken: votingTokens.voteToken,
          shareholderId: votingTokens.shareholderId,
          shareholderName: shareholders.fullName,
          shareholderEmail: shareholders.email,
          shareholderPhone: shareholders.phone,
          numberOfShares: shareholders.numberOfShares,
          status: votingTokens.status,
          expiresAt: votingTokens.expiresAt,
          vote: votingTokens.vote,
          votedAt: votingTokens.votedAt,
          signatureData: votingTokens.signatureData,
          comments: votingTokens.comments,
        })
        .from(votingTokens)
        .innerJoin(shareholders, eq(votingTokens.shareholderId, shareholders.id))
        .where(eq(votingTokens.resolutionId, resolutionId));

      res.json({
        message: `تم إنشاء ${eligibleShareholders.length - existingShareholderIds.size} رابط تصويت جديد`,
        tokens: allTokens
      });
    } catch (error) {
      console.error("Error creating voting token requests:", error);
      res.status(500).json({ error: "فشل في إنشاء روابط التصويت" });
    }
  });

  // Public endpoint - Get voting token info (no auth required)
  app.get("/api/public/vote/:token", async (req, res) => {
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

      const [voteRecord] = await db
        .select({
          id: votingTokens.id,
          resolutionId: votingTokens.resolutionId,
          shareholderId: votingTokens.shareholderId,
          voteWeight: votingTokens.voteWeight,
          status: votingTokens.status,
          vote: votingTokens.vote,
          votedAt: votingTokens.votedAt,
          expiresAt: votingTokens.expiresAt,
          shareholderName: shareholders.fullName,
          resolutionNumber: boardResolutions.resolutionNumber,
          resolutionTitle: boardResolutions.title,
          resolutionDescription: boardResolutions.description,
          resolutionType: boardResolutions.resolutionType,
          requiredMajority: boardResolutions.requiredMajority,
          resolutionCreatedAt: boardResolutions.createdAt,
        })
        .from(votingTokens)
        .innerJoin(shareholders, eq(votingTokens.shareholderId, shareholders.id))
        .innerJoin(boardResolutions, eq(votingTokens.resolutionId, boardResolutions.id))
        .where(eq(votingTokens.voteToken, token));

      if (!voteRecord) {
        return res.status(404).json({ error: "رابط التصويت غير موجود" });
      }

      if (voteRecord.status === "voted") {
        return res.status(400).json({ error: "تم التصويت على هذا القرار مسبقاً", votedAt: voteRecord.votedAt });
      }

      if (voteRecord.expiresAt && new Date(voteRecord.expiresAt) < new Date()) {
        return res.status(410).json({ error: "انتهت صلاحية رابط التصويت" });
      }

      res.json(voteRecord);
    } catch (error) {
      console.error("Error fetching vote record:", error);
      res.status(500).json({ error: "فشل في جلب بيانات التصويت" });
    }
  });

  // Public endpoint - Submit vote (no auth required)
  app.post("/api/public/vote/:token", async (req, res) => {
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

      // Update voting token
      await db.update(votingTokens)
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
        .where(eq(votingTokens.id, voteRecord.id));

      // Update resolution vote counts
      const voteField = vote === "for" ? "forVotes" : vote === "against" ? "againstVotes" : "abstainVotes";
      await db.update(boardResolutions)
        .set({
          [voteField]: sql`COALESCE(${boardResolutions[voteField as keyof typeof boardResolutions]}, 0) + ${voteWeight}`,
        })
        .where(eq(boardResolutions.id, voteRecord.resolutionId));

      // Try to create audit trail record (non-blocking)
      try {
        const [shareholderRecord] = await db.select({ fullName: shareholders.fullName })
          .from(shareholders)
          .where(eq(shareholders.id, voteRecord.shareholderId));
        const voterName = shareholderRecord?.fullName || "مساهم (تصويت إلكتروني)";

        // Ensure weightedVote fits numeric(18,4) - max 14 digits before decimal
        const safeWeightedVote = Math.min(voteWeight, 99999999999999).toFixed(4);

        await db.insert(resolutionVotes).values({
          resolutionId: voteRecord.resolutionId,
          voterType: "shareholder",
          shareholderId: voteRecord.shareholderId,
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
          action: 'تصويت مساهم',
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
  app.get("/api/governance/voting-audit-log", isAuthenticated, async (req, res) => {
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
}
