import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, sql, gte, lte, or, count } from "drizzle-orm";
import { isAuthenticated, requirePermission, getAllowedBranchIds } from "./auth";
import { storage } from "./storage";
import {
  users,
  userBranchAccess,
  userPermissions,
  systemAuditLogs,
  branches,
  userSecuritySettings,
} from "@shared/schema";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";

interface SecurityAlert {
  id: number;
  alertType: string;
  severity: string;
  userId?: string;
  userName?: string;
  module?: string;
  action?: string;
  attemptedResource?: string;
  branchId?: string;
  ipAddress?: string;
  details?: string;
  isResolved: boolean;
  createdAt: Date;
}

// In-memory security alerts (will be persisted in audit logs with special action type)
const securityAlertsCache: SecurityAlert[] = [];
let alertIdCounter = 1;

export function createSecurityAlert(alert: Omit<SecurityAlert, 'id' | 'createdAt' | 'isResolved'>): SecurityAlert {
  const newAlert: SecurityAlert = {
    ...alert,
    id: alertIdCounter++,
    isResolved: false,
    createdAt: new Date(),
  };
  securityAlertsCache.push(newAlert);
  
  // Also log to audit logs
  db.insert(systemAuditLogs).values({
    module: 'security',
    entityId: String(newAlert.id),
    entityName: `تنبيه أمني: ${alert.alertType}`,
    action: 'security_alert',
    details: JSON.stringify(alert),
    userId: alert.userId || null,
    userName: alert.userName || 'غير معروف',
    ipAddress: alert.ipAddress || null,
    description: `محاولة ${alert.action || 'غير محددة'} على ${alert.module || 'غير محدد'}`,
  }).catch(err => console.error('Failed to log security alert:', err));
  
  return newAlert;
}

export function registerSecurityRoutes(app: Express) {
  // =====================================================
  // تقرير صلاحيات المستخدم التفصيلي
  // =====================================================
  
  app.get("/api/security/user-permissions-report", isAuthenticated, requirePermission("rbac_management", "view"), async (req, res) => {
    try {
      const { userId } = req.query;
      
      // Get all users or specific user
      let usersQuery = db.select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        branchId: users.branchId,
        isActive: users.isActive,
        jobTitle: users.jobTitle,
        createdAt: users.createdAt,
      }).from(users);
      
      if (userId && typeof userId === 'string') {
        usersQuery = usersQuery.where(eq(users.id, userId)) as any;
      }
      
      const usersList = await usersQuery.orderBy(users.username);
      
      // Get permissions and branch access for each user
      const report = await Promise.all(usersList.map(async (user) => {
        // Get permissions
        const permissions = await db.select().from(userPermissions)
          .where(eq(userPermissions.userId, user.id));
        
        // Get branch access
        const branchAccessList = await db.select({
          branchId: userBranchAccess.branchId,
          branchName: branches.name,
          isDefault: userBranchAccess.isDefault,
          accessLevel: userBranchAccess.accessLevel,
        })
          .from(userBranchAccess)
          .leftJoin(branches, eq(branches.id, userBranchAccess.branchId))
          .where(eq(userBranchAccess.userId, user.id));
        
        // Get default branch info
        let defaultBranch = null;
        if (user.branchId) {
          const [branch] = await db.select().from(branches).where(eq(branches.id, user.branchId));
          defaultBranch = branch;
        }
        
        // Format permissions by module
        const permissionsByModule: Record<string, string[]> = {};
        permissions.forEach(p => {
          const actions = Array.isArray(p.actions) 
            ? p.actions 
            : (typeof p.actions === 'string' 
              ? (p.actions as string).replace(/[{}]/g, '').split(',').map((a: string) => a.trim())
              : []);
          permissionsByModule[p.module] = actions;
        });
        
        return {
          user: {
            id: user.id,
            username: user.username,
            fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
            email: user.email,
            role: user.role,
            jobTitle: user.jobTitle,
            isActive: user.isActive,
            createdAt: user.createdAt,
          },
          defaultBranch: defaultBranch ? {
            id: defaultBranch.id,
            name: defaultBranch.name,
          } : null,
          branchAccess: branchAccessList.map(b => ({
            branchId: b.branchId,
            branchName: b.branchName,
            isDefault: b.isDefault,
            accessLevel: b.accessLevel,
          })),
          permissions: permissionsByModule,
          permissionsCount: permissions.length,
          modulesWithAccess: Object.keys(permissionsByModule),
          hasFullAccess: user.role === 'admin',
          hasMultiBranchAccess: branchAccessList.length > 1,
        };
      }));
      
      // Summary stats
      const summary = {
        totalUsers: report.length,
        activeUsers: report.filter(r => r.user.isActive === 'active').length,
        adminUsers: report.filter(r => r.hasFullAccess).length,
        multiBranchUsers: report.filter(r => r.hasMultiBranchAccess).length,
        usersWithNoPermissions: report.filter(r => r.permissionsCount === 0 && !r.hasFullAccess).length,
      };
      
      res.json({ summary, users: report });
    } catch (error) {
      console.error("Error generating permissions report:", error);
      res.status(500).json({ error: "فشل في إنشاء تقرير الصلاحيات" });
    }
  });

  // =====================================================
  // تنبيهات المحاولات غير المصرح بها
  // =====================================================
  
  app.get("/api/security/alerts", isAuthenticated, requirePermission("rbac_management", "view"), async (req, res) => {
    try {
      const { startDate, endDate, severity, alertType, isResolved } = req.query;
      
      // Get alerts from audit logs with security_alert action
      let conditions: any[] = [eq(systemAuditLogs.action, 'security_alert')];
      
      if (startDate && typeof startDate === 'string') {
        conditions.push(gte(systemAuditLogs.createdAt, new Date(startDate)));
      }
      if (endDate && typeof endDate === 'string') {
        conditions.push(lte(systemAuditLogs.createdAt, new Date(endDate)));
      }
      
      const alerts = await db.select()
        .from(systemAuditLogs)
        .where(and(...conditions))
        .orderBy(desc(systemAuditLogs.createdAt))
        .limit(100);
      
      // Parse and format alerts
      const formattedAlerts = alerts.map(log => {
        let details: any = {};
        try {
          details = log.details ? JSON.parse(log.details) : {};
        } catch {}
        
        return {
          id: log.id,
          alertType: details.alertType || 'unknown',
          severity: details.severity || 'medium',
          userId: log.userId,
          userName: log.userName,
          module: details.module || log.module,
          action: details.action,
          attemptedResource: details.attemptedResource,
          branchId: details.branchId,
          ipAddress: log.ipAddress,
          details: log.description,
          isResolved: details.isResolved || false,
          createdAt: log.createdAt,
        };
      });
      
      // Also include in-memory alerts
      const combinedAlerts = [...formattedAlerts, ...securityAlertsCache]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 100);
      
      // Summary
      const summary = {
        total: combinedAlerts.length,
        unresolved: combinedAlerts.filter(a => !a.isResolved).length,
        bySeverity: {
          critical: combinedAlerts.filter(a => a.severity === 'critical').length,
          high: combinedAlerts.filter(a => a.severity === 'high').length,
          medium: combinedAlerts.filter(a => a.severity === 'medium').length,
          low: combinedAlerts.filter(a => a.severity === 'low').length,
        },
        byType: combinedAlerts.reduce((acc, a) => {
          acc[a.alertType] = (acc[a.alertType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };
      
      res.json({ summary, alerts: combinedAlerts });
    } catch (error) {
      console.error("Error fetching security alerts:", error);
      res.status(500).json({ error: "فشل في جلب التنبيهات الأمنية" });
    }
  });

  // =====================================================
  // سجل التدقيق المُعزز
  // =====================================================
  
  app.get("/api/security/audit-log", isAuthenticated, requirePermission("audit_logs", "view"), async (req, res) => {
    try {
      const { 
        startDate, endDate, module, action, userId, 
        page = '1', limit = '50',
        includeDetails = 'true'
      } = req.query;
      
      const pageNum = parseInt(page as string) || 1;
      const limitNum = Math.min(parseInt(limit as string) || 50, 100);
      const offset = (pageNum - 1) * limitNum;
      
      let conditions: any[] = [];
      
      if (startDate && typeof startDate === 'string') {
        conditions.push(gte(systemAuditLogs.createdAt, new Date(startDate)));
      }
      if (endDate && typeof endDate === 'string') {
        conditions.push(lte(systemAuditLogs.createdAt, new Date(endDate)));
      }
      if (module && typeof module === 'string' && module !== 'all') {
        conditions.push(eq(systemAuditLogs.module, module));
      }
      if (action && typeof action === 'string' && action !== 'all') {
        conditions.push(eq(systemAuditLogs.action, action));
      }
      if (userId && typeof userId === 'string') {
        conditions.push(eq(systemAuditLogs.userId, userId));
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      // Get total count
      const [countResult] = await db.select({ count: count() })
        .from(systemAuditLogs)
        .where(whereClause);
      
      // Get logs
      const logs = await db.select()
        .from(systemAuditLogs)
        .where(whereClause)
        .orderBy(desc(systemAuditLogs.createdAt))
        .limit(limitNum)
        .offset(offset);
      
      // Format logs
      const formattedLogs = logs.map(log => {
        let parsedDetails: any = null;
        if (includeDetails === 'true' && log.details) {
          try {
            parsedDetails = JSON.parse(log.details);
          } catch {}
        }
        
        return {
          id: log.id,
          module: log.module,
          moduleLabel: getModuleLabel(log.module),
          entityId: log.entityId,
          entityName: log.entityName,
          action: log.action,
          actionLabel: getActionLabel(log.action),
          description: log.description,
          userId: log.userId,
          userName: log.userName,
          targetId: log.targetId,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          createdAt: log.createdAt,
          details: parsedDetails,
        };
      });
      
      // Get unique modules and actions for filters
      const [modulesResult] = await db.select({ 
        modules: sql<string[]>`array_agg(DISTINCT ${systemAuditLogs.module})` 
      }).from(systemAuditLogs);
      
      const [actionsResult] = await db.select({ 
        actions: sql<string[]>`array_agg(DISTINCT ${systemAuditLogs.action})` 
      }).from(systemAuditLogs);
      
      res.json({
        logs: formattedLogs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: countResult?.count || 0,
          totalPages: Math.ceil((countResult?.count || 0) / limitNum),
        },
        filters: {
          modules: (modulesResult?.modules || []).filter(Boolean),
          actions: (actionsResult?.actions || []).filter(Boolean),
        },
      });
    } catch (error) {
      console.error("Error fetching audit log:", error);
      res.status(500).json({ error: "فشل في جلب سجل التدقيق" });
    }
  });

  // =====================================================
  // إحصائيات الأمان
  // =====================================================
  
  app.get("/api/security/stats", isAuthenticated, requirePermission("rbac_management", "view"), async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      // Total audit logs
      const [totalLogs] = await db.select({ count: count() }).from(systemAuditLogs);
      
      // Logs today
      const [todayLogs] = await db.select({ count: count() })
        .from(systemAuditLogs)
        .where(gte(systemAuditLogs.createdAt, today));
      
      // Security alerts (action = 'security_alert')
      const [securityAlerts] = await db.select({ count: count() })
        .from(systemAuditLogs)
        .where(eq(systemAuditLogs.action, 'security_alert'));
      
      // Failed login attempts
      const [failedLogins] = await db.select({ count: count() })
        .from(systemAuditLogs)
        .where(and(
          eq(systemAuditLogs.module, 'users'),
          eq(systemAuditLogs.action, 'login_failed')
        ));
      
      // Permission denied
      const [permissionDenied] = await db.select({ count: count() })
        .from(systemAuditLogs)
        .where(eq(systemAuditLogs.action, 'permission_denied'));
      
      // Most active users (last 7 days)
      const activeUsers = await db.select({
        userId: systemAuditLogs.userId,
        userName: systemAuditLogs.userName,
        actionsCount: count(),
      })
        .from(systemAuditLogs)
        .where(gte(systemAuditLogs.createdAt, weekAgo))
        .groupBy(systemAuditLogs.userId, systemAuditLogs.userName)
        .orderBy(desc(count()))
        .limit(10);
      
      // Actions by module (last 7 days)
      const actionsByModule = await db.select({
        module: systemAuditLogs.module,
        count: count(),
      })
        .from(systemAuditLogs)
        .where(gte(systemAuditLogs.createdAt, weekAgo))
        .groupBy(systemAuditLogs.module)
        .orderBy(desc(count()))
        .limit(10);
      
      res.json({
        overview: {
          totalLogs: totalLogs?.count || 0,
          todayLogs: todayLogs?.count || 0,
          securityAlerts: securityAlerts?.count || 0,
          failedLogins: failedLogins?.count || 0,
          permissionDenied: permissionDenied?.count || 0,
          pendingAlerts: securityAlertsCache.filter(a => !a.isResolved).length,
        },
        activeUsers: activeUsers.map(u => ({
          userId: u.userId,
          userName: u.userName || 'غير معروف',
          actionsCount: u.actionsCount,
        })),
        actionsByModule: actionsByModule.map(m => ({
          module: m.module,
          moduleLabel: getModuleLabel(m.module),
          count: m.count,
        })),
      });
    } catch (error) {
      console.error("Error fetching security stats:", error);
      res.status(500).json({ error: "فشل في جلب إحصائيات الأمان" });
    }
  });

  // =====================================================
  // صلاحيات المستخدم الحالي
  // =====================================================
  
  app.get("/api/security/my-full-permissions", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).currentUser;
      if (!user) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      // Get user's permissions
      const permissions = await storage.getUserPermissions(user.id);
      
      // Get branch access
      const branchAccessList = await storage.getUserBranchAccess(user.id);
      
      // Get all branches for reference
      const allBranches = await db.select().from(branches);
      
      // Format permissions
      const formattedPermissions: Record<string, { actions: string[], label: string }> = {};
      permissions.forEach((p: any) => {
        const actions = Array.isArray(p.actions) 
          ? p.actions 
          : (typeof p.actions === 'string' 
            ? (p.actions as string).replace(/[{}]/g, '').split(',').map((a: string) => a.trim())
            : []);
        formattedPermissions[p.module] = {
          actions,
          label: getModuleLabel(p.module),
        };
      });
      
      res.json({
        user: {
          id: user.id,
          username: user.username,
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
          role: user.role,
          isAdmin: user.role === 'admin',
        },
        permissions: formattedPermissions,
        branchAccess: branchAccessList.map((b: any) => {
          const branch = allBranches.find(br => br.id === b.branchId);
          return {
            branchId: b.branchId,
            branchName: branch?.name || 'غير معروف',
            isDefault: b.isDefault,
          };
        }),
        hasAllBranchesAccess: user.role === 'admin' || branchAccessList.length === 0,
        canAccessModules: Object.keys(formattedPermissions),
      });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ error: "فشل في جلب صلاحياتك" });
    }
  });

  // =====================================================
  // Two-Factor Authentication (2FA) APIs
  // =====================================================

  // Setup 2FA - Generate secret and QR code
  app.post("/api/security/2fa/setup", isAuthenticated, async (req, res) => {
    try {
      const user = req.currentUser!;
      
      // Check if 2FA is already enabled
      const existingSettings = await db.select()
        .from(userSecuritySettings)
        .where(eq(userSecuritySettings.userId, user.id))
        .limit(1);
      
      if (existingSettings.length > 0 && existingSettings[0].twoFactorEnabled) {
        return res.status(400).json({ error: "المصادقة الثنائية مفعّلة مسبقاً" });
      }
      
      // Generate a new secret
      const secret = generateSecret();
      
      // Create the OTP auth URL
      const otpAuthUrl = generateURI({
        secret,
        label: user.email || user.username || "user",
        issuer: "باتر - Butter Bakery",
        algorithm: "sha1",
        digits: 6,
        period: 30,
      });
      
      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
      
      // Store the secret temporarily (not enabled yet until verified)
      await db.insert(userSecuritySettings)
        .values({
          userId: user.id,
          twoFactorSecret: secret,
          twoFactorEnabled: false,
        })
        .onConflictDoUpdate({
          target: userSecuritySettings.userId,
          set: {
            twoFactorSecret: secret,
            updatedAt: new Date(),
          },
        });
      
      res.json({
        secret,
        qrCode: qrCodeDataUrl,
        otpAuthUrl,
      });
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      res.status(500).json({ error: "فشل في إعداد المصادقة الثنائية" });
    }
  });

  // Verify 2FA token and enable
  app.post("/api/security/2fa/verify", isAuthenticated, async (req, res) => {
    try {
      const user = req.currentUser!;
      const { token } = req.body;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "يرجى إدخال رمز التحقق" });
      }
      
      // Get user's 2FA secret
      const settings = await db.select()
        .from(userSecuritySettings)
        .where(eq(userSecuritySettings.userId, user.id))
        .limit(1);
      
      if (settings.length === 0 || !settings[0].twoFactorSecret) {
        return res.status(400).json({ error: "يرجى إعداد المصادقة الثنائية أولاً" });
      }
      
      const secret = settings[0].twoFactorSecret;
      
      // Verify the token
      const isValid = await verify({ token, secret });
      
      if (!isValid) {
        return res.status(400).json({ error: "رمز التحقق غير صحيح" });
      }
      
      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );
      
      // Enable 2FA and store backup codes
      await db.update(userSecuritySettings)
        .set({
          twoFactorEnabled: true,
          twoFactorBackupCodes: backupCodes,
          updatedAt: new Date(),
        })
        .where(eq(userSecuritySettings.userId, user.id));
      
      // Audit log
      await db.insert(systemAuditLogs).values({
        module: 'security',
        entityId: user.id,
        entityName: user.username,
        action: '2fa_enabled',
        userId: user.id,
        userName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.username,
        description: 'تم تفعيل المصادقة الثنائية',
        ipAddress: req.ip,
      });
      
      res.json({
        success: true,
        backupCodes,
        message: "تم تفعيل المصادقة الثنائية بنجاح",
      });
    } catch (error) {
      console.error("Error verifying 2FA:", error);
      res.status(500).json({ error: "فشل في التحقق من المصادقة الثنائية" });
    }
  });

  // Disable 2FA
  app.post("/api/security/2fa/disable", isAuthenticated, async (req, res) => {
    try {
      const user = req.currentUser!;
      const { token, password } = req.body;
      
      // Get user's 2FA settings
      const settings = await db.select()
        .from(userSecuritySettings)
        .where(eq(userSecuritySettings.userId, user.id))
        .limit(1);
      
      if (settings.length === 0 || !settings[0].twoFactorEnabled) {
        return res.status(400).json({ error: "المصادقة الثنائية غير مفعّلة" });
      }
      
      // Verify the token
      const secret = settings[0].twoFactorSecret!;
      const isValid = await verify({ token, secret });
      
      // Also check backup codes
      const backupCodes = settings[0].twoFactorBackupCodes || [];
      const isBackupCode = backupCodes.includes(token?.toUpperCase());
      
      if (!isValid && !isBackupCode) {
        return res.status(400).json({ error: "رمز التحقق غير صحيح" });
      }
      
      // If backup code was used, remove it from the list
      if (isBackupCode) {
        const updatedCodes = backupCodes.filter(code => code !== token?.toUpperCase());
        await db.update(userSecuritySettings)
          .set({
            twoFactorBackupCodes: updatedCodes,
          })
          .where(eq(userSecuritySettings.userId, user.id));
      }
      
      // Disable 2FA
      await db.update(userSecuritySettings)
        .set({
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
          updatedAt: new Date(),
        })
        .where(eq(userSecuritySettings.userId, user.id));
      
      // Audit log
      await db.insert(systemAuditLogs).values({
        module: 'security',
        entityId: user.id,
        entityName: user.username,
        action: '2fa_disabled',
        userId: user.id,
        userName: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}` 
          : user.username,
        description: 'تم إيقاف المصادقة الثنائية',
        ipAddress: req.ip,
      });
      
      res.json({
        success: true,
        message: "تم إيقاف المصادقة الثنائية بنجاح",
      });
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      res.status(500).json({ error: "فشل في إيقاف المصادقة الثنائية" });
    }
  });

  // Get 2FA status
  app.get("/api/security/2fa/status", isAuthenticated, async (req, res) => {
    try {
      const user = req.currentUser!;
      
      const settings = await db.select({
        twoFactorEnabled: userSecuritySettings.twoFactorEnabled,
        hasBackupCodes: sql<boolean>`${userSecuritySettings.twoFactorBackupCodes} IS NOT NULL AND array_length(${userSecuritySettings.twoFactorBackupCodes}, 1) > 0`,
      })
        .from(userSecuritySettings)
        .where(eq(userSecuritySettings.userId, user.id))
        .limit(1);
      
      if (settings.length === 0) {
        return res.json({
          enabled: false,
          hasBackupCodes: false,
          backupCodesCount: 0,
        });
      }
      
      const backupCodes = await db.select({
        codes: userSecuritySettings.twoFactorBackupCodes,
      })
        .from(userSecuritySettings)
        .where(eq(userSecuritySettings.userId, user.id))
        .limit(1);
      
      res.json({
        enabled: settings[0].twoFactorEnabled,
        hasBackupCodes: settings[0].hasBackupCodes,
        backupCodesCount: backupCodes[0]?.codes?.length || 0,
      });
    } catch (error) {
      console.error("Error getting 2FA status:", error);
      res.status(500).json({ error: "فشل في جلب حالة المصادقة الثنائية" });
    }
  });

  // Regenerate backup codes
  app.post("/api/security/2fa/regenerate-backup-codes", isAuthenticated, async (req, res) => {
    try {
      const user = req.currentUser!;
      const { token } = req.body;
      
      // Get user's 2FA settings
      const settings = await db.select()
        .from(userSecuritySettings)
        .where(eq(userSecuritySettings.userId, user.id))
        .limit(1);
      
      if (settings.length === 0 || !settings[0].twoFactorEnabled) {
        return res.status(400).json({ error: "المصادقة الثنائية غير مفعّلة" });
      }
      
      // Verify the token
      const secret = settings[0].twoFactorSecret!;
      const isValid = await verify({ token, secret });
      
      if (!isValid) {
        return res.status(400).json({ error: "رمز التحقق غير صحيح" });
      }
      
      // Generate new backup codes
      const backupCodes = Array.from({ length: 10 }, () => 
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );
      
      await db.update(userSecuritySettings)
        .set({
          twoFactorBackupCodes: backupCodes,
          updatedAt: new Date(),
        })
        .where(eq(userSecuritySettings.userId, user.id));
      
      res.json({
        success: true,
        backupCodes,
        message: "تم إعادة توليد أكواد الاسترداد بنجاح",
      });
    } catch (error) {
      console.error("Error regenerating backup codes:", error);
      res.status(500).json({ error: "فشل في إعادة توليد أكواد الاسترداد" });
    }
  });

  // =====================================================
  // Security Activity Log API
  // =====================================================
  
  app.get("/api/security/activity-log", isAuthenticated, async (req, res) => {
    try {
      const user = req.currentUser!;
      const { limit = "50", offset = "0" } = req.query;
      
      const limitNum = Math.min(parseInt(limit as string) || 50, 100);
      const offsetNum = parseInt(offset as string) || 0;
      
      // Get security-related audit logs for this user
      const logs = await db.select({
        id: systemAuditLogs.id,
        module: systemAuditLogs.module,
        action: systemAuditLogs.action,
        description: systemAuditLogs.description,
        details: systemAuditLogs.details,
        ipAddress: systemAuditLogs.ipAddress,
        createdAt: systemAuditLogs.createdAt,
      })
        .from(systemAuditLogs)
        .where(
          and(
            eq(systemAuditLogs.userId, user.id),
            or(
              eq(systemAuditLogs.module, 'security'),
              eq(systemAuditLogs.module, 'auth'),
              eq(systemAuditLogs.action, 'login'),
              eq(systemAuditLogs.action, 'logout'),
              eq(systemAuditLogs.action, 'login_failed'),
              eq(systemAuditLogs.action, 'permission_denied'),
            )
          )
        )
        .orderBy(desc(systemAuditLogs.createdAt))
        .limit(limitNum)
        .offset(offsetNum);
      
      // Get total count
      const countResult = await db.select({ count: count() })
        .from(systemAuditLogs)
        .where(
          and(
            eq(systemAuditLogs.userId, user.id),
            or(
              eq(systemAuditLogs.module, 'security'),
              eq(systemAuditLogs.module, 'auth'),
              eq(systemAuditLogs.action, 'login'),
              eq(systemAuditLogs.action, 'logout'),
              eq(systemAuditLogs.action, 'login_failed'),
              eq(systemAuditLogs.action, 'permission_denied'),
            )
          )
        );
      
      res.json({
        logs: logs.map(log => ({
          ...log,
          moduleLabel: getModuleLabel(log.module),
          actionLabel: getActionLabel(log.action),
        })),
        total: countResult[0]?.count || 0,
        limit: limitNum,
        offset: offsetNum,
      });
    } catch (error) {
      console.error("Error fetching activity log:", error);
      res.status(500).json({ error: "فشل في جلب سجل الأنشطة" });
    }
  });

  // Export security report
  app.get("/api/security/export-report", isAuthenticated, async (req, res) => {
    try {
      const user = req.currentUser!;
      const format = req.query.format as string || "json";
      const type = req.query.type as string || "activity"; // activity, sessions, all
      
      // Log export action
      await db.insert(systemAuditLogs).values({
        userId: user.id,
        module: 'security',
        action: 'export',
        description: `تصدير تقرير أمني بصيغة ${format}`,
        ipAddress: req.ip,
      });
      
      const data: any = {};
      
      // Fetch activity logs
      if (type === "activity" || type === "all") {
        const logs = await db.select({
          id: systemAuditLogs.id,
          module: systemAuditLogs.module,
          action: systemAuditLogs.action,
          description: systemAuditLogs.description,
          ipAddress: systemAuditLogs.ipAddress,
          createdAt: systemAuditLogs.createdAt,
        })
          .from(systemAuditLogs)
          .where(
            and(
              eq(systemAuditLogs.userId, user.id),
              or(
                eq(systemAuditLogs.module, 'security'),
                eq(systemAuditLogs.module, 'auth'),
                eq(systemAuditLogs.action, 'login'),
                eq(systemAuditLogs.action, 'logout'),
                eq(systemAuditLogs.action, 'login_failed'),
              )
            )
          )
          .orderBy(desc(systemAuditLogs.createdAt))
          .limit(1000);
        
        data.activityLogs = logs.map(log => ({
          ...log,
          moduleLabel: getModuleLabel(log.module),
          actionLabel: getActionLabel(log.action),
          createdAt: log.createdAt?.toISOString(),
        }));
      }
      
      // Fetch sessions
      if (type === "sessions" || type === "all") {
        const sessions = await db.select({
          id: userSessions.id,
          deviceType: userSessions.deviceType,
          browser: userSessions.browser,
          os: userSessions.os,
          ipAddress: userSessions.ipAddress,
          location: userSessions.location,
          createdAt: userSessions.createdAt,
          lastActivityAt: userSessions.lastActivityAt,
          isActive: userSessions.isActive,
        })
          .from(userSessions)
          .where(eq(userSessions.userId, user.id))
          .orderBy(desc(userSessions.lastActivityAt))
          .limit(100);
        
        data.sessions = sessions.map(s => ({
          ...s,
          createdAt: s.createdAt?.toISOString(),
          lastActivityAt: s.lastActivityAt?.toISOString(),
        }));
      }
      
      // Export format
      if (format === "csv") {
        let csv = "";
        
        if (data.activityLogs && data.activityLogs.length > 0) {
          csv += "سجل الأنشطة الأمنية\n";
          csv += "التاريخ,الوحدة,الإجراء,الوصف,عنوان IP\n";
          data.activityLogs.forEach((log: any) => {
            csv += `"${log.createdAt || ''}","${log.moduleLabel}","${log.actionLabel}","${log.description || ''}","${log.ipAddress || ''}"\n`;
          });
        }
        
        if (data.sessions && data.sessions.length > 0) {
          csv += "\nالجلسات\n";
          csv += "التاريخ,نوع الجهاز,المتصفح,النظام,عنوان IP,الموقع,الحالة\n";
          data.sessions.forEach((s: any) => {
            csv += `"${s.createdAt || ''}","${s.deviceType || ''}","${s.browser || ''}","${s.os || ''}","${s.ipAddress || ''}","${s.location || ''}","${s.isActive ? 'نشط' : 'منتهية'}"\n`;
          });
        }
        
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="security-report-${Date.now()}.csv"`);
        res.send("\ufeff" + csv); // BOM for Excel UTF-8
      } else {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="security-report-${Date.now()}.json"`);
        res.json({
          exportDate: new Date().toISOString(),
          userId: user.id,
          username: user.username,
          ...data,
        });
      }
    } catch (error) {
      console.error("Error exporting security report:", error);
      res.status(500).json({ error: "فشل في تصدير التقرير الأمني" });
    }
  });
}

// Helper functions
function getModuleLabel(module: string): string {
  const labels: Record<string, string> = {
    'inventory': 'المخزون',
    'projects': 'المشاريع',
    'contractors': 'المقاولين',
    'transfers': 'التحويلات',
    'users': 'المستخدمين',
    'contracts': 'العقود',
    'production': 'الإنتاج',
    'cashier': 'الصندوق',
    'reports': 'التقارير',
    'settings': 'الإعدادات',
    'security': 'الأمان',
    'governance': 'الحوكمة',
    'governance_board': 'مجلس الإدارة',
    'governance_shareholders': 'المساهمين',
    'governance_meetings': 'الاجتماعات',
    'governance_resolutions': 'القرارات',
    'governance_voting': 'التصويت',
    'audit_logs': 'سجل التدقيق',
    'security_management': 'إدارة الأمان',
  };
  return labels[module] || module;
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'create': 'إنشاء',
    'update': 'تحديث',
    'delete': 'حذف',
    'view': 'عرض',
    'export': 'تصدير',
    'approve': 'موافقة',
    'reject': 'رفض',
    'login': 'تسجيل دخول',
    'logout': 'تسجيل خروج',
    'login_failed': 'فشل تسجيل دخول',
    'permission_denied': 'رفض صلاحية',
    'security_alert': 'تنبيه أمني',
    'send_invitations': 'إرسال دعوات',
    'vote': 'تصويت',
    '2fa_enabled': 'تفعيل المصادقة الثنائية',
    '2fa_disabled': 'إيقاف المصادقة الثنائية',
  };
  return labels[action] || action;
}
