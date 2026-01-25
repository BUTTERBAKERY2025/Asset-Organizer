import type { Express } from "express";
import { db } from "./db";
import { eq, desc, and, gte, lte, or, sql } from "drizzle-orm";
import { isAuthenticated, requirePermission } from "./auth";
import {
  beneficiaryOrganizations,
  socialInitiatives,
  communityDiscounts,
  discountUsageLogs,
  insertBeneficiaryOrganizationSchema,
  insertSocialInitiativeSchema,
  insertCommunityDiscountSchema,
  insertDiscountUsageLogSchema,
} from "@shared/schema";
import { z } from "zod";

export function registerSocialResponsibilityRoutes(app: Express) {
  // =====================================================
  // Beneficiary Organizations - الجهات المستفيدة
  // =====================================================

  app.get("/api/social-responsibility/organizations", isAuthenticated, requirePermission("social_responsibility", "view"), async (req, res) => {
    try {
      const { type, status, partnership } = req.query;
      
      let query = db.select().from(beneficiaryOrganizations);
      const conditions: any[] = [];
      
      if (type) conditions.push(eq(beneficiaryOrganizations.organizationType, type as string));
      if (status) conditions.push(eq(beneficiaryOrganizations.status, status as string));
      if (partnership) conditions.push(eq(beneficiaryOrganizations.partnershipType, partnership as string));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const result = await query.orderBy(desc(beneficiaryOrganizations.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ error: "فشل في جلب الجهات المستفيدة" });
    }
  });

  app.get("/api/social-responsibility/organizations/:id", isAuthenticated, requirePermission("social_responsibility", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [org] = await db.select().from(beneficiaryOrganizations).where(eq(beneficiaryOrganizations.id, id));
      if (!org) {
        return res.status(404).json({ error: "الجهة غير موجودة" });
      }
      res.json(org);
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ error: "فشل في جلب بيانات الجهة" });
    }
  });

  app.post("/api/social-responsibility/organizations", isAuthenticated, requirePermission("social_responsibility", "create"), async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const validatedData = insertBeneficiaryOrganizationSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      const [org] = await db.insert(beneficiaryOrganizations).values(validatedData).returning();
      res.json(org);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating organization:", error);
      res.status(500).json({ error: "فشل في إنشاء الجهة" });
    }
  });

  app.put("/api/social-responsibility/organizations/:id", isAuthenticated, requirePermission("social_responsibility", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertBeneficiaryOrganizationSchema.partial().parse(req.body);
      const [updated] = await db.update(beneficiaryOrganizations)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(beneficiaryOrganizations.id, id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "الجهة غير موجودة" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating organization:", error);
      res.status(500).json({ error: "فشل في تحديث الجهة" });
    }
  });

  app.delete("/api/social-responsibility/organizations/:id", isAuthenticated, requirePermission("social_responsibility", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(beneficiaryOrganizations).where(eq(beneficiaryOrganizations.id, id)).returning();
      if (!deleted) {
        return res.status(404).json({ error: "الجهة غير موجودة" });
      }
      res.json({ success: true, message: "تم حذف الجهة بنجاح" });
    } catch (error) {
      console.error("Error deleting organization:", error);
      res.status(500).json({ error: "فشل في حذف الجهة" });
    }
  });

  // =====================================================
  // Social Initiatives - المبادرات الاجتماعية
  // =====================================================

  app.get("/api/social-responsibility/initiatives", isAuthenticated, requirePermission("social_responsibility", "view"), async (req, res) => {
    try {
      const { type, status, organizationId } = req.query;
      
      let query = db.select().from(socialInitiatives);
      const conditions: any[] = [];
      
      if (type) conditions.push(eq(socialInitiatives.initiativeType, type as string));
      if (status) conditions.push(eq(socialInitiatives.status, status as string));
      if (organizationId) conditions.push(eq(socialInitiatives.beneficiaryOrganizationId, parseInt(organizationId as string)));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const result = await query.orderBy(desc(socialInitiatives.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching initiatives:", error);
      res.status(500).json({ error: "فشل في جلب المبادرات" });
    }
  });

  app.get("/api/social-responsibility/initiatives/:id", isAuthenticated, requirePermission("social_responsibility", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [initiative] = await db.select().from(socialInitiatives).where(eq(socialInitiatives.id, id));
      if (!initiative) {
        return res.status(404).json({ error: "المبادرة غير موجودة" });
      }
      res.json(initiative);
    } catch (error) {
      console.error("Error fetching initiative:", error);
      res.status(500).json({ error: "فشل في جلب بيانات المبادرة" });
    }
  });

  app.post("/api/social-responsibility/initiatives", isAuthenticated, requirePermission("social_responsibility", "create"), async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const validatedData = insertSocialInitiativeSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      const [initiative] = await db.insert(socialInitiatives).values(validatedData).returning();
      res.json(initiative);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating initiative:", error);
      res.status(500).json({ error: "فشل في إنشاء المبادرة" });
    }
  });

  app.put("/api/social-responsibility/initiatives/:id", isAuthenticated, requirePermission("social_responsibility", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertSocialInitiativeSchema.partial().parse(req.body);
      const [updated] = await db.update(socialInitiatives)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(socialInitiatives.id, id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "المبادرة غير موجودة" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating initiative:", error);
      res.status(500).json({ error: "فشل في تحديث المبادرة" });
    }
  });

  app.delete("/api/social-responsibility/initiatives/:id", isAuthenticated, requirePermission("social_responsibility", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(socialInitiatives).where(eq(socialInitiatives.id, id)).returning();
      if (!deleted) {
        return res.status(404).json({ error: "المبادرة غير موجودة" });
      }
      res.json({ success: true, message: "تم حذف المبادرة بنجاح" });
    } catch (error) {
      console.error("Error deleting initiative:", error);
      res.status(500).json({ error: "فشل في حذف المبادرة" });
    }
  });

  // =====================================================
  // Community Discounts - الخصومات المجتمعية
  // =====================================================

  // Public endpoint - get discount by code (for QR scan)
  app.get("/api/social-responsibility/discounts/code/:code", async (req, res) => {
    try {
      const code = req.params.code;
      const [discount] = await db.select().from(communityDiscounts).where(eq(communityDiscounts.code, code));
      
      if (!discount) {
        return res.status(404).json({ error: "الخصم غير موجود" });
      }
      
      // Check if discount is expired
      const today = new Date().toISOString().split('T')[0];
      if (discount.validTo && discount.validTo < today) {
        return res.status(410).json({ error: "الخصم منتهي الصلاحية", discount });
      }
      
      res.json(discount);
    } catch (error) {
      console.error("Error fetching discount by code:", error);
      res.status(500).json({ error: "فشل في جلب الخصم" });
    }
  });

  app.get("/api/social-responsibility/discounts", isAuthenticated, requirePermission("social_responsibility", "view"), async (req, res) => {
    try {
      const { status, organizationId, initiativeId } = req.query;
      
      let query = db.select().from(communityDiscounts);
      const conditions: any[] = [];
      
      if (status) conditions.push(eq(communityDiscounts.status, status as string));
      if (organizationId) conditions.push(eq(communityDiscounts.beneficiaryOrganizationId, parseInt(organizationId as string)));
      if (initiativeId) conditions.push(eq(communityDiscounts.initiativeId, parseInt(initiativeId as string)));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const result = await query.orderBy(desc(communityDiscounts.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Error fetching discounts:", error);
      res.status(500).json({ error: "فشل في جلب الخصومات" });
    }
  });

  app.get("/api/social-responsibility/discounts/:id", isAuthenticated, requirePermission("social_responsibility", "view"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [discount] = await db.select().from(communityDiscounts).where(eq(communityDiscounts.id, id));
      if (!discount) {
        return res.status(404).json({ error: "الخصم غير موجود" });
      }
      res.json(discount);
    } catch (error) {
      console.error("Error fetching discount:", error);
      res.status(500).json({ error: "فشل في جلب بيانات الخصم" });
    }
  });

  app.post("/api/social-responsibility/discounts", isAuthenticated, requirePermission("social_responsibility", "create"), async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const validatedData = insertCommunityDiscountSchema.parse({
        ...req.body,
        createdBy: userId,
      });
      const [discount] = await db.insert(communityDiscounts).values(validatedData).returning();
      res.json(discount);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error creating discount:", error);
      res.status(500).json({ error: "فشل في إنشاء الخصم" });
    }
  });

  app.put("/api/social-responsibility/discounts/:id", isAuthenticated, requirePermission("social_responsibility", "edit"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCommunityDiscountSchema.partial().parse(req.body);
      const [updated] = await db.update(communityDiscounts)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(communityDiscounts.id, id))
        .returning();
      if (!updated) {
        return res.status(404).json({ error: "الخصم غير موجود" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error updating discount:", error);
      res.status(500).json({ error: "فشل في تحديث الخصم" });
    }
  });

  app.delete("/api/social-responsibility/discounts/:id", isAuthenticated, requirePermission("social_responsibility", "delete"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [deleted] = await db.delete(communityDiscounts).where(eq(communityDiscounts.id, id)).returning();
      if (!deleted) {
        return res.status(404).json({ error: "الخصم غير موجود" });
      }
      res.json({ success: true, message: "تم حذف الخصم بنجاح" });
    } catch (error) {
      console.error("Error deleting discount:", error);
      res.status(500).json({ error: "فشل في حذف الخصم" });
    }
  });

  // Validate and use discount code
  app.post("/api/social-responsibility/discounts/validate", isAuthenticated, async (req, res) => {
    try {
      const { code, orderAmount, branchId } = req.body;
      
      const [discount] = await db.select().from(communityDiscounts)
        .where(and(
          eq(communityDiscounts.code, code),
          eq(communityDiscounts.status, "active")
        ));
      
      if (!discount) {
        return res.status(404).json({ valid: false, error: "رمز الخصم غير صالح" });
      }
      
      const today = new Date().toISOString().split('T')[0];
      if (discount.validFrom > today || discount.validTo < today) {
        return res.status(400).json({ valid: false, error: "رمز الخصم منتهي الصلاحية" });
      }
      
      if (discount.usageLimit && discount.usageCount && discount.usageCount >= discount.usageLimit) {
        return res.status(400).json({ valid: false, error: "تم استنفاد عدد مرات الاستخدام" });
      }
      
      if (discount.minimumOrder && orderAmount < parseFloat(discount.minimumOrder)) {
        return res.status(400).json({ valid: false, error: `الحد الأدنى للطلب ${discount.minimumOrder} ر.س` });
      }
      
      let discountAmount = 0;
      if (discount.discountType === "percentage") {
        discountAmount = (orderAmount * parseFloat(discount.discountValue)) / 100;
        if (discount.maximumDiscount && discountAmount > parseFloat(discount.maximumDiscount)) {
          discountAmount = parseFloat(discount.maximumDiscount);
        }
      } else {
        discountAmount = parseFloat(discount.discountValue);
      }
      
      res.json({
        valid: true,
        discount: {
          id: discount.id,
          code: discount.code,
          name: discount.name,
          discountType: discount.discountType,
          discountValue: discount.discountValue,
          discountAmount,
          finalAmount: orderAmount - discountAmount,
        },
      });
    } catch (error) {
      console.error("Error validating discount:", error);
      res.status(500).json({ error: "فشل في التحقق من رمز الخصم" });
    }
  });

  // Log discount usage
  app.post("/api/social-responsibility/discounts/:id/use", isAuthenticated, async (req, res) => {
    try {
      const discountId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      
      const validatedData = insertDiscountUsageLogSchema.parse({
        ...req.body,
        discountId,
        usedBy: userId,
      });
      
      // Insert usage log
      const [log] = await db.insert(discountUsageLogs).values(validatedData).returning();
      
      // Update usage count
      await db.update(communityDiscounts)
        .set({ usageCount: sql`${communityDiscounts.usageCount} + 1` })
        .where(eq(communityDiscounts.id, discountId));
      
      res.json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "بيانات غير صالحة", details: error.errors });
      }
      console.error("Error logging discount usage:", error);
      res.status(500).json({ error: "فشل في تسجيل استخدام الخصم" });
    }
  });

  // Get discount usage logs
  app.get("/api/social-responsibility/discounts/:id/usage", isAuthenticated, requirePermission("social_responsibility", "view"), async (req, res) => {
    try {
      const discountId = parseInt(req.params.id);
      const logs = await db.select().from(discountUsageLogs)
        .where(eq(discountUsageLogs.discountId, discountId))
        .orderBy(desc(discountUsageLogs.usedAt));
      res.json(logs);
    } catch (error) {
      console.error("Error fetching usage logs:", error);
      res.status(500).json({ error: "فشل في جلب سجل الاستخدام" });
    }
  });

  // Dashboard stats
  app.get("/api/social-responsibility/stats", isAuthenticated, requirePermission("social_responsibility", "view"), async (req, res) => {
    try {
      const [orgsCount] = await db.select({ count: sql<number>`count(*)` }).from(beneficiaryOrganizations);
      const [activeOrgsCount] = await db.select({ count: sql<number>`count(*)` }).from(beneficiaryOrganizations).where(eq(beneficiaryOrganizations.status, "active"));
      const [initiativesCount] = await db.select({ count: sql<number>`count(*)` }).from(socialInitiatives);
      const [activeInitiativesCount] = await db.select({ count: sql<number>`count(*)` }).from(socialInitiatives).where(eq(socialInitiatives.status, "active"));
      const [discountsCount] = await db.select({ count: sql<number>`count(*)` }).from(communityDiscounts);
      const [activeDiscountsCount] = await db.select({ count: sql<number>`count(*)` }).from(communityDiscounts).where(eq(communityDiscounts.status, "active"));
      const [totalUsage] = await db.select({ total: sql<number>`COALESCE(SUM(usage_count), 0)` }).from(communityDiscounts);
      
      res.json({
        organizations: { total: orgsCount.count, active: activeOrgsCount.count },
        initiatives: { total: initiativesCount.count, active: activeInitiativesCount.count },
        discounts: { total: discountsCount.count, active: activeDiscountsCount.count },
        totalDiscountUsage: totalUsage.total || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "فشل في جلب الإحصائيات" });
    }
  });
}
