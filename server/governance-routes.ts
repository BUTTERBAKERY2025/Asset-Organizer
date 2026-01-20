import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, asc, sql, gte, lte, or, isNull } from "drizzle-orm";
import { isAuthenticated } from "./auth";
import {
  boardMembers,
  shareholders,
  shareTransfers,
  governanceMeetings,
  meetingAttendance,
  meetingMinutes,
  boardResolutions,
  resolutionVotes,
  capitalTransactions,
  dividendDistributions,
  shareholderDividends,
  disclosures,
  complianceRequirements,
  complianceHistory,
  insertBoardMemberSchema,
  insertShareholderSchema,
  insertShareTransferSchema,
  insertGovernanceMeetingSchema,
  insertMeetingAttendanceSchema,
  insertMeetingMinutesSchema,
  insertBoardResolutionSchema,
  insertResolutionVoteSchema,
  insertCapitalTransactionSchema,
  insertDividendDistributionSchema,
  insertShareholderDividendSchema,
  insertDisclosureSchema,
  insertComplianceRequirementSchema,
  insertComplianceHistorySchema,
} from "@shared/schema";

function getCurrentUserId(req: Request): string {
  return (req as any).currentUser?.id || "system";
}

export function registerGovernanceRoutes(app: Express) {
  // =====================================================
  // Board Members - أعضاء مجلس الإدارة
  // =====================================================
  
  app.get("/api/governance/board-members", isAuthenticated, async (req, res) => {
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

  app.get("/api/governance/board-members/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/governance/board-members", isAuthenticated, async (req, res) => {
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

  app.patch("/api/governance/board-members/:id", isAuthenticated, async (req, res) => {
    try {
      const [member] = await db.update(boardMembers)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(boardMembers.id, parseInt(req.params.id)))
        .returning();
      res.json(member);
    } catch (error) {
      console.error("Error updating board member:", error);
      res.status(500).json({ error: "فشل في تحديث بيانات عضو المجلس" });
    }
  });

  app.delete("/api/governance/board-members/:id", isAuthenticated, async (req, res) => {
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
  
  app.get("/api/governance/shareholders", isAuthenticated, async (req, res) => {
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

  app.get("/api/governance/shareholders/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/governance/shareholders", isAuthenticated, async (req, res) => {
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

  app.patch("/api/governance/shareholders/:id", isAuthenticated, async (req, res) => {
    try {
      const [shareholder] = await db.update(shareholders)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(shareholders.id, parseInt(req.params.id)))
        .returning();
      res.json(shareholder);
    } catch (error) {
      console.error("Error updating shareholder:", error);
      res.status(500).json({ error: "فشل في تحديث بيانات المساهم" });
    }
  });

  // =====================================================
  // Share Transfers - تحويلات الأسهم
  // =====================================================
  
  app.get("/api/governance/share-transfers", isAuthenticated, async (req, res) => {
    try {
      const result = await db.select().from(shareTransfers).orderBy(desc(shareTransfers.transferDate));
      res.json(result);
    } catch (error) {
      console.error("Error fetching share transfers:", error);
      res.status(500).json({ error: "فشل في جلب تحويلات الأسهم" });
    }
  });

  app.post("/api/governance/share-transfers", isAuthenticated, async (req, res) => {
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

  app.patch("/api/governance/share-transfers/:id/approve", isAuthenticated, async (req, res) => {
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
  
  app.get("/api/governance/meetings", isAuthenticated, async (req, res) => {
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

  app.get("/api/governance/meetings/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/governance/meetings", isAuthenticated, async (req, res) => {
    try {
      const year = new Date().getFullYear();
      const count = await db.select({ count: sql<number>`count(*)` }).from(governanceMeetings);
      const meetingNumber = `MTG-${year}-${String((count[0]?.count || 0) + 1).padStart(4, '0')}`;
      
      const data = insertGovernanceMeetingSchema.parse({
        ...req.body,
        meetingNumber,
        createdBy: getCurrentUserId(req),
      });
      const [meeting] = await db.insert(governanceMeetings).values(data).returning();
      res.status(201).json(meeting);
    } catch (error) {
      console.error("Error creating meeting:", error);
      res.status(500).json({ error: "فشل في إنشاء الاجتماع" });
    }
  });

  app.patch("/api/governance/meetings/:id", isAuthenticated, async (req, res) => {
    try {
      const [meeting] = await db.update(governanceMeetings)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(governanceMeetings.id, parseInt(req.params.id)))
        .returning();
      res.json(meeting);
    } catch (error) {
      console.error("Error updating meeting:", error);
      res.status(500).json({ error: "فشل في تحديث الاجتماع" });
    }
  });

  // =====================================================
  // Meeting Attendance - حضور الاجتماعات
  // =====================================================
  
  app.get("/api/governance/meetings/:meetingId/attendance", isAuthenticated, async (req, res) => {
    try {
      const result = await db.select().from(meetingAttendance)
        .where(eq(meetingAttendance.meetingId, parseInt(req.params.meetingId)));
      res.json(result);
    } catch (error) {
      console.error("Error fetching attendance:", error);
      res.status(500).json({ error: "فشل في جلب سجل الحضور" });
    }
  });

  app.post("/api/governance/meetings/:meetingId/attendance", isAuthenticated, async (req, res) => {
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

  app.patch("/api/governance/attendance/:id", isAuthenticated, async (req, res) => {
    try {
      const [attendance] = await db.update(meetingAttendance)
        .set(req.body)
        .where(eq(meetingAttendance.id, parseInt(req.params.id)))
        .returning();
      res.json(attendance);
    } catch (error) {
      console.error("Error updating attendance:", error);
      res.status(500).json({ error: "فشل في تحديث سجل الحضور" });
    }
  });

  // =====================================================
  // Meeting Minutes - محاضر الاجتماعات
  // =====================================================
  
  app.get("/api/governance/minutes", isAuthenticated, async (req, res) => {
    try {
      const result = await db.select().from(meetingMinutes).orderBy(desc(meetingMinutes.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching minutes:", error);
      res.status(500).json({ error: "فشل في جلب المحاضر" });
    }
  });

  app.get("/api/governance/meetings/:meetingId/minutes", isAuthenticated, async (req, res) => {
    try {
      const [minutes] = await db.select().from(meetingMinutes)
        .where(eq(meetingMinutes.meetingId, parseInt(req.params.meetingId)));
      res.json(minutes || null);
    } catch (error) {
      console.error("Error fetching meeting minutes:", error);
      res.status(500).json({ error: "فشل في جلب محضر الاجتماع" });
    }
  });

  app.post("/api/governance/minutes", isAuthenticated, async (req, res) => {
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

  app.patch("/api/governance/minutes/:id", isAuthenticated, async (req, res) => {
    try {
      const [minutes] = await db.update(meetingMinutes)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(meetingMinutes.id, parseInt(req.params.id)))
        .returning();
      res.json(minutes);
    } catch (error) {
      console.error("Error updating minutes:", error);
      res.status(500).json({ error: "فشل في تحديث المحضر" });
    }
  });

  // =====================================================
  // Board Resolutions - قرارات مجلس الإدارة
  // =====================================================
  
  app.get("/api/governance/resolutions", isAuthenticated, async (req, res) => {
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

  app.get("/api/governance/resolutions/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/governance/resolutions", isAuthenticated, async (req, res) => {
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

  app.patch("/api/governance/resolutions/:id", isAuthenticated, async (req, res) => {
    try {
      const [resolution] = await db.update(boardResolutions)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(boardResolutions.id, parseInt(req.params.id)))
        .returning();
      res.json(resolution);
    } catch (error) {
      console.error("Error updating resolution:", error);
      res.status(500).json({ error: "فشل في تحديث القرار" });
    }
  });

  // =====================================================
  // Resolution Votes - التصويت على القرارات
  // =====================================================
  
  app.get("/api/governance/resolutions/:resolutionId/votes", isAuthenticated, async (req, res) => {
    try {
      const result = await db.select().from(resolutionVotes)
        .where(eq(resolutionVotes.resolutionId, parseInt(req.params.resolutionId)));
      res.json(result);
    } catch (error) {
      console.error("Error fetching votes:", error);
      res.status(500).json({ error: "فشل في جلب التصويتات" });
    }
  });

  app.post("/api/governance/resolutions/:resolutionId/votes", isAuthenticated, async (req, res) => {
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
  
  app.get("/api/governance/capital-transactions", isAuthenticated, async (req, res) => {
    try {
      const result = await db.select().from(capitalTransactions).orderBy(desc(capitalTransactions.effectiveDate));
      res.json(result);
    } catch (error) {
      console.error("Error fetching capital transactions:", error);
      res.status(500).json({ error: "فشل في جلب معاملات رأس المال" });
    }
  });

  app.post("/api/governance/capital-transactions", isAuthenticated, async (req, res) => {
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
  
  app.get("/api/governance/dividends", isAuthenticated, async (req, res) => {
    try {
      const result = await db.select().from(dividendDistributions).orderBy(desc(dividendDistributions.paymentDate));
      res.json(result);
    } catch (error) {
      console.error("Error fetching dividends:", error);
      res.status(500).json({ error: "فشل في جلب توزيعات الأرباح" });
    }
  });

  app.post("/api/governance/dividends", isAuthenticated, async (req, res) => {
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

  app.get("/api/governance/dividends/:distributionId/payments", isAuthenticated, async (req, res) => {
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
  
  app.get("/api/governance/disclosures", isAuthenticated, async (req, res) => {
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

  app.post("/api/governance/disclosures", isAuthenticated, async (req, res) => {
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

  app.patch("/api/governance/disclosures/:id", isAuthenticated, async (req, res) => {
    try {
      const [disclosure] = await db.update(disclosures)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(disclosures.id, parseInt(req.params.id)))
        .returning();
      res.json(disclosure);
    } catch (error) {
      console.error("Error updating disclosure:", error);
      res.status(500).json({ error: "فشل في تحديث الإفصاح" });
    }
  });

  // =====================================================
  // Compliance Requirements - متطلبات الامتثال
  // =====================================================
  
  app.get("/api/governance/compliance", isAuthenticated, async (req, res) => {
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

  app.get("/api/governance/compliance/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/governance/compliance", isAuthenticated, async (req, res) => {
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

  app.patch("/api/governance/compliance/:id", isAuthenticated, async (req, res) => {
    try {
      const [requirement] = await db.update(complianceRequirements)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(complianceRequirements.id, parseInt(req.params.id)))
        .returning();
      res.json(requirement);
    } catch (error) {
      console.error("Error updating compliance requirement:", error);
      res.status(500).json({ error: "فشل في تحديث المتطلب" });
    }
  });

  app.get("/api/governance/compliance/:id/history", isAuthenticated, async (req, res) => {
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

  app.post("/api/governance/compliance/:id/history", isAuthenticated, async (req, res) => {
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
  // Dashboard Stats - إحصائيات اللوحة
  // =====================================================
  
  app.get("/api/governance/stats", isAuthenticated, async (req, res) => {
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
}
