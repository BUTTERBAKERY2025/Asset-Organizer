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
} from "@shared/schema";

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
          accessType: userBranchAccess.accessType,
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
            accessType: b.accessType,
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
  };
  return labels[action] || action;
}
