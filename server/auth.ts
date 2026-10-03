import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { createPasswordLoginRateLimiter } from "./password-login-limiter";
import { storage } from "./storage";
import { branchTemplateSnapshot } from "./branch-template-decision";
import {
  checkPermissionDecision, evaluatePermissionDecision, hasPermissionDecisionDeny, centralMarketingSnapshot,
  type PermissionContext, type PermissionDecisionSnapshot,
} from "./permission-decision";
import {
  getPermissionScopeConstraint, isValidPermissionRequestContext,
  recordPermissionScopeConstraint,
  type PermissionContextResolver, type PermissionRequestContext,
} from "./permission-request-context";
export { getPermissionScopeConstraint } from "./permission-request-context";
export type { PermissionContextResolver, PermissionRequestContext } from "./permission-request-context";

export function hasPermissionScopeConstraint(req: any): boolean {
  return getPermissionScopeConstraint(req)?.branchIds !== undefined
    && getPermissionScopeConstraint(req)?.branchIds !== null;
}
import { createOwnerApiLockdown, isOwnerRequestAllowed, isOwnerSessionValid } from "./owner-security";
import { db, pool } from "./db";
import { systemAuditLogs, MODULE_ACTIONS, ROLE_PERMISSION_TEMPLATES, JOB_ROLE_PERMISSION_TEMPLATES, userPermissions, userPermissionOverrides, permissions as permissionDefinitions } from "@shared/schema";
import { and, eq, or, isNull, gt } from "drizzle-orm";
import { isLoginBlocked, trackLoginAttempt } from "./security";
import {
  getTwoFactorConfig,
  issueOtpForUser,
  verifyOtpForUser,
  logShareholderActivity,
} from "./shareholder-security";

// Cross-request auth caches are unsafe: a revocation on a different worker cannot
// invalidate them. Keep this legacy API for callers that already fall back to DB.
// This costs user/branch/permission reads per request, in exchange for immediate
// revocation of deactivated accounts, roles, branch access and explicit grants.
export function getCachedPermissionsForUser(_userId: string): any[] | null {
  return null;
}

/**
 * HR is a cross-branch function in this org. Admins, the dedicated `hr_manager`
 * role, and any user holding `hr_management` with the `view` action are treated
 * as cross-branch for HR READ access — otherwise they see zero data on HR pages
 * (employees / attendance) when they have no explicit branch assignment.
 *
 * READ-ONLY elevation: callers must gate this to safe (GET/HEAD) requests.
 * Finance/inventory/sales endpoints never call this helper and keep their
 * standard branch isolation. Single source of truth to avoid drift.
 */
export function hasCrossBranchHrReadAccess(req: any): boolean {
  const user = (req as any).currentUser;
  if (!user) return false;
  // A manually granted HR module must never override the operations manager's
  // explicit branch boundary.
  if (user.role === "operations_manager") return false;
  if (user.role === "admin") return true;
  // A route's resource decision must not be widened by a later HR shortcut.
  if (hasPermissionScopeConstraint(req)) return false;
  if (user.role === "hr_manager") return true;
  if (user.role === "hr_specialist") return true;
  const perms = (req as any).authPermissions || [];
  const hr = perms.find((p: any) => p.module === "hr_management");
  if (!hr) return false;
  const raw = hr.actions as unknown;
  const actions: string[] = Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === "string"
      ? (raw as string).replace(/[{}]/g, "").split(",").map((a) => a.trim())
      : [];
  return actions.includes("view");
}

// HR modules auto-granted to users with role === "hr_manager". Strictly HR —
// finance, inventory, sales, etc. are NOT included and stay branch-isolated.
// Shared between requirePermission and requireAnyPermission to prevent drift.
// NOTE: this set must cover everything an HR manager needs to actually do HR
// work — employees, attendance, and recruitment included — otherwise the HR
// Hub renders empty (data endpoints 403) even though the page itself opens.
export const HR_MANAGER_MODULES: ReadonlySet<string> = new Set([
  "hr_management",
  "hr_documents",
  "hr_leaves",
  "hr_warnings",
  "hr_advances",
  "hr_eos",
  "hr_evaluations",
  "salary_closing",
  // Employees & org
  "branch_employees",
  "employee_reports",
  "employee_transfers",
  "organizational_structure",
  // Attendance & shifts
  "shifts",
  "attendance",
  "attendance_check",
  "timesheet",
  // Recruitment / onboarding
  "hr_employment_applications",
  "hr_job_offers",
  "hr_onboarding",
]);

// HR modules auto-granted to users with role === "hr_specialist" (اختصاصي موارد
// بشرية). NARROWER than the HR manager: NO salary closing, NO end-of-service, NO
// employee transfers, NO org structure. Action-aware so sensitive modules stay
// scoped (e.g. employee_reports = view+export only).
// Cross-branch READ is granted separately via hasCrossBranchHrReadAccess.
// Omitted actions are inferred from the HTTP method before consulting this map;
// module presence alone must never authorize writes to a view-only module.
export const HR_SPECIALIST_PERMISSIONS: Record<string, string[]> = {
  hr_management: ["view"],
  // "approve" مطلوب لمسار اعتماد/رفض طلبات الإجازة (يُقيَّد إضافياً بسلسلة
  // الموافقات حسب المسمى الوظيفي إن كانت مفعّلة).
  hr_leaves: ["view", "create", "edit", "approve", "export"],
  hr_documents: ["view", "create", "edit", "export"],
  hr_warnings: ["view", "create", "edit", "export"],
  hr_advances: ["view", "create", "edit", "export"],
  // تقييم الأداء — إنشاء وتحرير المسودات، الاعتماد النهائي لمدير HR/الأدمن فقط
  hr_evaluations: ["view", "create", "edit", "export"],
  // Employees — can add & edit employee records (delete stays admin/HR-manager only)
  branch_employees: ["view", "create", "edit", "export"],
  // Reports — view only
  employee_reports: ["view", "export"],
  // Attendance & shifts
  attendance: ["view", "create", "edit", "export"],
  attendance_check: ["view", "create", "edit"],
  shifts: ["view", "create", "edit", "export"],
  timesheet: ["view", "export"],
  // Recruitment / onboarding
  hr_employment_applications: ["view", "create", "edit", "export"],
  hr_job_offers: ["view", "create", "edit", "export"],
  hr_onboarding: ["view", "create", "edit", "export"],
};

// Modules auto-granted to users with role === "financial_manager" (المدير المالي).
// Action-aware (mirrors HR_SPECIALIST_PERMISSIONS) and sourced from the shared
// ROLE_PERMISSION_TEMPLATES.financial_manager so there is a SINGLE source of truth.
// Auto-grant makes the role self-healing: it works even if the template was never
// applied to user_permissions (e.g. an account created before deploy). Cross-branch
// SCOPE is handled separately in getAllowedBranchIds / canAccessBranch; this map only
// governs WHICH modules/actions are authorized. Must be merged into /api/my-permissions
// too (see routes.ts) or the frontend sidebar/landing page won't match the backend.
export const PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS: Record<string, string[]> =
  Object.fromEntries(ROLE_PERMISSION_TEMPLATES.production_development_manager.map(
    (entry) => [entry.module, [...entry.actions]],
  ));

export const WAREHOUSE_KEEPER_PERMISSIONS: Record<string, string[]> =
  Object.fromEntries(ROLE_PERMISSION_TEMPLATES.warehouse_keeper.map(
    (entry) => [entry.module, [...entry.actions]],
  ));

// A custom direct-permission set represents the administrator's complete selection;
// never re-add template actions removed from it. Deny overrides win over both.
export function resolveWarehouseKeeperPermissions(
  effective: { module: string; actions: string[] }[],
  hasCustomPermissions: boolean,
  denied: { module: string; action: string }[],
): { module: string; actions: string[] }[] {
  const deniedKeys = new Set(denied.map(({ module, action }) => `${module}:${action}`));
  return Object.entries(WAREHOUSE_KEEPER_PERMISSIONS).map(([module, template]) => {
    const existing = effective.find((p) => p.module === module)?.actions ?? [];
    const actions = (hasCustomPermissions ? existing : [...template, ...existing])
      .filter((action, index, list) => template.includes(action) && list.indexOf(action) === index && !deniedKeys.has(`${module}:${action}`));
    return { module, actions };
  }).filter(({ actions }) => actions.length > 0);
}

export async function getWarehouseKeeperEffectivePermissions(userId: string, effective: { module: string; actions: string[] }[]) {
  const [direct, denied] = await Promise.all([
    db.select({ actions: userPermissions.actions }).from(userPermissions).where(eq(userPermissions.userId, userId)),
    db.select({ module: permissionDefinitions.module, action: permissionDefinitions.action })
      .from(userPermissionOverrides)
      .innerJoin(permissionDefinitions, eq(userPermissionOverrides.permissionId, permissionDefinitions.id))
      .where(and(eq(userPermissionOverrides.userId, userId), eq(userPermissionOverrides.allow, false),
        or(isNull(userPermissionOverrides.expiresAt), gt(userPermissionOverrides.expiresAt, new Date())))),
  ]);
  // An empty direct-permission row can be the result of revoking the final
  // action. Treat its presence as an explicit custom selection too.
  return resolveWarehouseKeeperPermissions(effective, direct.length > 0, denied);
}

export const FINANCIAL_MANAGER_PERMISSIONS: Record<string, string[]> =
  Object.fromEntries(
    ((ROLE_PERMISSION_TEMPLATES as any).financial_manager || []).map(
      (e: { module: string; actions: string[] }) => [e.module, e.actions],
    ),
  );

// Resolve a module's allowed actions for a financial_manager, tolerating the
// historical pnl / pnl_dashboard synonym so P&L API routes written against either
// name are authorized even when relying purely on auto-grant.
function financialManagerActionsFor(module: string): string[] | undefined {
  return (
    FINANCIAL_MANAGER_PERMISSIONS[module] ||
    (module === "pnl" ? FINANCIAL_MANAGER_PERMISSIONS["pnl_dashboard"] : undefined) ||
    (module === "pnl_dashboard" ? FINANCIAL_MANAGER_PERMISSIONS["pnl"] : undefined)
  );
}

// Modules auto-granted to users with role === "operations_manager" (مدير التشغيل).
// Sourced from ROLE_PERMISSION_TEMPLATES.operations_manager (single source of truth)
// so template and auto-grant never drift. Cross-branch SCOPE handled in
// getAllowedBranchIds / canAccessBranch. Must also be merged into /api/my-permissions
// (routes.ts) or the frontend sidebar/landing won't match backend authorization.
export const OPERATIONS_MANAGER_PERMISSIONS: Record<string, string[]> =
  Object.fromEntries(
    ((ROLE_PERMISSION_TEMPLATES as any).operations_manager || []).map(
      (e: { module: string; actions: string[] }) => [e.module, e.actions],
    ),
  );

// Legacy grants must not advertise access to modules the role cannot use.
// Keep response filtering and endpoint authorization on the same deny list.
export const OPERATIONS_MANAGER_DENIED_MODULES = [
  "hr_management", "salary_closing", "hr_onboarding", "hr_job_offers", "employee_transfers",
] as const;

export function isRoleModuleDenied(role: string, module: string): boolean {
  return role === "operations_manager"
    && (OPERATIONS_MANAGER_DENIED_MODULES as readonly string[]).includes(module);
}

export function filterRoleDeniedPermissions<T extends { module: string }>(
  role: string,
  permissions: T[],
): T[] {
  return permissions.filter(permission => !isRoleModuleDenied(role, permission.module));
}

// Branch managers can create requests for, and receive requests at, their own
// branch. Kitchen-side branch checks still prevent approve/prepare/dispatch.
export const BRANCH_MANAGER_CENTRAL_KITCHEN_PERMISSIONS = ["view", "create", "edit"] as const;
export const BRANCH_MANAGER_INTRINSIC_PERMISSIONS: Record<string, string[]> =
  Object.fromEntries(
    ((ROLE_PERMISSION_TEMPLATES as any).branch_manager || []).map(
      (entry: { module: string; actions: string[] }) => [entry.module, [...entry.actions]],
    ),
  );

// Direct rows select a module's *complete* action set, including an empty row
// (revocation). Other modules retain their ordinary effective grants. Overrides
// are applied last, so explicit denies can also remove intrinsic role actions.
export function resolveBranchManagerPermissions(
  effective: { module: string; actions: string[] }[],
  direct: { module: string; actions: string[] }[],
  overrides: { module: string; action: string; allow: boolean }[] = [],
): { module: string; actions: string[] }[] {
  const result = new Map<string, Set<string>>(effective.map((p) => [p.module, new Set(p.actions)]));
  for (const [module, actions] of Object.entries(BRANCH_MANAGER_INTRINSIC_PERMISSIONS)) {
    const selected = result.get(module) ?? new Set<string>();
    for (const action of actions) selected.add(action);
    result.set(module, selected);
  }
  for (const row of direct) result.set(row.module, new Set(row.actions));
  for (const { module, action, allow } of overrides) {
    const actions = result.get(module) ?? new Set<string>();
    if (allow) actions.add(action);
    else actions.delete(action);
    result.set(module, actions);
  }
  // requirePermission accepts these legacy module names only when the target
  // has no explicit module entry. Never mirror across an empty revoked row.
  for (const [source, target] of [
    ["attendance", "attendance_check"],
    ["pnl", "pnl_dashboard"],
    ["pnl_dashboard", "pnl"],
  ]) {
    if (!result.has(target) && result.has(source)) {
      result.set(target, new Set(result.get(source)));
    }
  }
  return Array.from(result, ([module, actions]) => ({ module, actions: [...actions] }));
}

export async function getBranchManagerEffectivePermissions(
  userId: string,
  effective: { module: string; actions: string[] }[],
) {
  const [direct, overrides] = await Promise.all([
    db.select({ module: userPermissions.module, actions: userPermissions.actions })
      .from(userPermissions).where(eq(userPermissions.userId, userId)),
    db.select({ module: permissionDefinitions.module, action: permissionDefinitions.action, allow: userPermissionOverrides.allow })
      .from(userPermissionOverrides)
      .innerJoin(permissionDefinitions, eq(userPermissionOverrides.permissionId, permissionDefinitions.id))
      .where(and(eq(userPermissionOverrides.userId, userId),
        or(isNull(userPermissionOverrides.expiresAt), gt(userPermissionOverrides.expiresAt, new Date())))),
  ]);
  return resolveBranchManagerPermissions(effective, direct, overrides);
}

// Existing delivery employees may predate the job-title template being applied
// to user_permissions. Only this job title + module receives the template's
// narrow view/edit actions; branch and task ownership are checked by the routes.
const DELIVERY_EMPLOYEE_ACTIONS = JOB_ROLE_PERMISSION_TEMPLATES.delivery.find(
  (entry) => entry.module === "delivery_tasks",
)?.actions ?? [];

function deliveryEmployeeActions(user: { role: string; jobTitle?: string | null }, module: string) {
  return module === "delivery_tasks" && user.role === "employee" && user.jobTitle === "delivery"
    ? DELIVERY_EMPLOYEE_ACTIONS
    : [];
}

// Resolve a module's allowed actions for an operations_manager, tolerating the
// historical attendance/attendance_check and quality/quality_control synonyms.
function operationsManagerActionsFor(module: string): string[] | undefined {
  return (
    OPERATIONS_MANAGER_PERMISSIONS[module] ||
    (module === "attendance_check" ? OPERATIONS_MANAGER_PERMISSIONS["attendance"] : undefined) ||
    (module === "quality" ? OPERATIONS_MANAGER_PERMISSIONS["quality_control"] : undefined) ||
    (module === "quality_control" ? OPERATIONS_MANAGER_PERMISSIONS["quality"] : undefined) ||
    (module === "waste" ? OPERATIONS_MANAGER_PERMISSIONS["waste_tracking"] : undefined) ||
    (module === "waste_tracking" ? OPERATIONS_MANAGER_PERMISSIONS["waste"] : undefined)
  );
}

export function invalidateAuthCache(_userId?: string) {
  // Compatibility for existing write paths; there is no cross-request auth cache.
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    activeBranchId?: string;
    lastActivity?: number;
    fingerprint?: string;
    createdAt?: number;
    ipAddress?: string;
    localAuthRevoked?: boolean;
    localAuthGeneration?: string;
    // المرحلة 5: حالة انتظار التحقق بخطوتين بعد كلمة المرور (قبل إنشاء الجلسة المصادَق عليها)
    pendingTwoFactor?: { userId: string; rememberMe: boolean; at: number };
  }
}

import crypto from "crypto";

function generateSessionFingerprint(req: any): string {
  const ua = req.headers['user-agent'] || '';
  const uaCore = ua.replace(/\d+[\._]\d+[\._]?\d*/g, 'X');
  return crypto.createHash('sha256').update(uaCore).digest('hex').substring(0, 32);
}

const isProduction = process.env.NODE_ENV === "production";

// Parse User-Agent to extract device info
export function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  let browser = "Unknown";
  let os = "Unknown";
  let device = "Desktop";

  // Detect Browser
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";

  // Detect OS
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  // Detect Device Type
  if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) {
    device = "Mobile";
  } else if (ua.includes("iPad") || ua.includes("Tablet")) {
    device = "Tablet";
  }

  return { browser, os, device };
}

// المرحلة 5: إنشاء الجلسة المصادَق عليها بعد التحقق من الهوية (كلمة المرور أو OTP).
// تُستخدم من مسار الدخول المباشر ومن مسار التحقق بخطوتين معاً لتفادي التكرار.
function establishSession(
  req: any,
  res: any,
  user: any,
  rememberMe: boolean,
  clientIp: string,
  generation: string,
  opts?: { twoFactor?: boolean },
) {
  req.session.regenerate(async (regenerateErr: any) => {
    try {
      if (regenerateErr) {
        console.error("Session regenerate error:", regenerateErr);
        return res.status(500).json({ error: "فشل تسجيل الدخول" });
      }

      req.session.userId = user.id;
      req.session.localAuthGeneration = generation;
      req.session.lastActivity = Date.now();
      req.session.fingerprint = generateSessionFingerprint(req);
      req.session.createdAt = Date.now();
      req.session.ipAddress = clientIp;

      if (rememberMe) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      } else {
        req.session.cookie.maxAge = 8 * 60 * 60 * 1000;
        req.session.cookie.expires = undefined as any;
      }

      const userBranches = await storage.getUserBranchAccess(user.id);
      const defaultBranch = userBranches.find((b: any) => b.isDefault) || userBranches[0];
      req.session.activeBranchId = defaultBranch?.branchId || undefined;

      req.session.save(async (saveErr: any) => {
        try {
          if (saveErr) {
            if (saveErr.code === "LOCAL_SESSION_REVOKED") {
              req.session.destroy(() => {});
              return res.status(401).json({ error: "انتهت صلاحية تسجيل الدخول. يرجى المحاولة من جديد." });
            }
            console.error("Session save error:", saveErr);
            return res.status(500).json({ error: "فشل تسجيل الدخول" });
          }
          const { password: _, ...safeUser } = user;

          let activeBranch = null;
          if (req.session.activeBranchId) {
            activeBranch = await storage.getBranch(req.session.activeBranchId);
          }

          const displayName = user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.username || 'غير معروف';
          const userAgentStr = req.headers['user-agent'] || '';
          const deviceInfo = parseUserAgent(userAgentStr);
          try {
            await storage.createSystemAuditLog({
              module: "users",
              entityId: user.id,
              entityName: displayName,
              action: "login",
              description: `تسجيل دخول ناجح${opts?.twoFactor ? ' (تحقق بخطوتين)' : ''}${rememberMe ? ' (تذكرني)' : ''}`,
              details: JSON.stringify({
                browser: deviceInfo.browser,
                os: deviceInfo.os,
                device: deviceInfo.device,
                rememberMe: !!rememberMe,
                twoFactor: !!opts?.twoFactor,
              }),
              userId: user.id,
              userName: displayName,
              branchId: req.session.activeBranchId || user.branchId || null,
              ipAddress: req.ip || req.socket?.remoteAddress,
              userAgent: userAgentStr,
            });

            const sessionExpiry = rememberMe
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              : new Date(Date.now() + 8 * 60 * 60 * 1000);

            await storage.createUserSession({
              sessionId: req.sessionID,
              userId: user.id,
              deviceInfo,
              ipAddress: req.ip || req.socket?.remoteAddress || null,
              userAgent: userAgentStr,
              isActive: true,
              lastActivityAt: new Date(),
              expiresAt: sessionExpiry,
            });

            try {
              const currentSessionId = req.sessionID;
              await storage.invalidateAllUserSessionsExcept(user.id, currentSessionId);
            } catch (e) {
              console.warn("Failed to invalidate old sessions:", e);
            }
          } catch (logError) {
            console.error("Failed to create audit log for login:", logError);
          }

          // المرحلة 5: سجّل دخول المساهم في سجل نشاط البوابة (أفضل جهد)
          if (user.role === "shareholder") {
            void logShareholderActivity({
              userId: user.id,
              action: "login",
              description: opts?.twoFactor ? "تسجيل دخول بالتحقق بخطوتين" : "تسجيل دخول",
              ipAddress: req.ip || req.socket?.remoteAddress || null,
              userAgent: userAgentStr,
            });
          }

          res.json({
            ...safeUser,
            activeBranchId: req.session.activeBranchId,
            activeBranch,
            allowedBranches: userBranches,
          });
        } catch (saveCallbackError) {
          console.error("Session save callback error:", saveCallbackError);
          if (!res.headersSent) {
            res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
          }
        }
      });
    } catch (regenerateCallbackError) {
      console.error("Session regenerate callback error:", regenerateCallbackError);
      if (!res.headersSent) {
        res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
      }
    }
  });
}

export const loginRateLimiter = createPasswordLoginRateLimiter();

const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "تم تجاوز عدد محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
});

const verifyPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "تم تجاوز عدد محاولات التحقق. يرجى المحاولة بعد 15 دقيقة." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "تم تجاوز عدد الطلبات المسموح. يرجى المحاولة لاحقاً." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Log security alert for unauthorized attempts
async function logSecurityAlert(data: {
  alertType: string;
  severity: string;
  userId?: string;
  userName?: string;
  module?: string;
  action?: string;
  attemptedResource?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await db.insert(systemAuditLogs).values({
      module: 'security',
      entityId: `alert_${Date.now()}`,
      entityName: `تنبيه أمني: ${data.alertType}`,
      action: 'security_alert',
      details: JSON.stringify(data),
      userId: data.userId || null,
      userName: data.userName || 'غير معروف',
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      description: `محاولة ${data.action || 'غير محددة'} على ${data.module || 'غير محدد'}`,
    });
  } catch (err) {
    console.error('Failed to log security alert:', err);
  }
}

export function createLocalSessionStore(queryPool = pool) {
  const sessionTtl = 8 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    pool: queryPool,
    createTableIfMissing: false,
    ttl: sessionTtl / 1000,
    tableName: "sessions",
    pruneSessionInterval: 60,
  });

  // connect-pg-simple's default UPSERT can resurrect a revoked session when an
  // already-running request finishes. Serialize against revocation on the SID
  // row and never overwrite a tombstone. Fresh logins regenerate a new SID.
  sessionStore.set = (sid, sess, callback) => {
    if (sid.startsWith("__local_auth_generation__:")) {
      return callback?.(new Error("Reserved local authentication record"));
    }
    const expires = sess.cookie?.expires
      ? new Date(sess.cookie.expires) : new Date(Date.now() + sessionTtl);
    const userId = sess.userId || sess.pendingTwoFactor?.userId || null;
    // The same SQL statement checks the credential snapshot's generation and
    // writes the SID. If revocation commits concurrently after this snapshot,
    // every subsequent authenticated request still checks the generation.
    queryPool.query(`
      INSERT INTO sessions (sid, sess, expire)
      SELECT $1, $2, $3 WHERE $4::text IS NULL OR (
        EXISTS (SELECT 1 FROM users WHERE id = $4 AND is_active IS DISTINCT FROM 'inactive')
        AND $5 = COALESCE((SELECT sess::jsonb->>'localAuthGeneration' FROM sessions
          WHERE sid = '__local_auth_generation__:' || $4), 'legacy')
      )
      ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire
      WHERE sessions.sess::jsonb->>'localAuthRevoked' IS DISTINCT FROM 'true'
    `, [sid, JSON.stringify(sess), expires, userId, sess.localAuthGeneration ?? "legacy"]).then(
      result => callback?.(result.rowCount ? undefined
        : Object.assign(new Error("Local authentication was revoked"), { code: "LOCAL_SESSION_REVOKED" })),
      error => callback?.(error),
    );
  };
  sessionStore.touch = (sid, sess, callback) => {
    if (sid.startsWith("__local_auth_generation__:")) return callback?.();
    const expires = sess.cookie?.expires
      ? new Date(sess.cookie.expires) : new Date(Date.now() + sessionTtl);
    queryPool.query(`
      UPDATE sessions SET expire = $2 WHERE sid = $1
        AND sess::jsonb->>'localAuthRevoked' IS DISTINCT FROM 'true'
    `, [sid, expires]).then(() => callback?.(), error => {
      // express-session supplies an error-capable callback (the upstream
      // connect-pg-simple type incorrectly declares it as zero-argument).
      (callback as ((error?: unknown) => void) | undefined)?.(error);
    });
  };
  // Destroying a rejected request must not remove the resurrection guard.
  // Tombstones contain no identity/credentials and expire via normal pruning.
  sessionStore.destroy = (sid, callback) => {
    if (sid.startsWith("__local_auth_generation__:")) return callback?.();
    queryPool.query(`
      UPDATE sessions SET
        sess = jsonb_build_object('cookie', sess::jsonb->'cookie', 'localAuthRevoked', true),
        expire = GREATEST(expire, NOW() + INTERVAL '12 hours')
      WHERE sid = $1 AND sess::jsonb->>'localAuthRevoked' IS DISTINCT FROM 'true'
    `, [sid]).then(() => callback?.(), error => callback?.(error));
  };
  return sessionStore;
}

export function getSession() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  return session({
    secret: sessionSecret,
    store: createLocalSessionStore(),
    resave: false,
    saveUninitialized: false,
    name: "__btr_sid",
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      path: "/",
    },
    rolling: true,
  });
}

// Runs immediately after express-session, including on handlers that only read
// session.userId (auth bootstrap, heartbeat, OTP, etc.). Never cache across
// requests or workers; legacy sessions without tracking rows remain compatible.
export const validateLocalSession: RequestHandler = async (req, res, next) => {
  const userId = req.session?.userId || req.session?.pendingTwoFactor?.userId;
  if (!userId) return next();
  try {
    const [user, valid] = await Promise.all([
      storage.getUser(userId),
      storage.isLocalSessionValid(userId, req.sessionID),
    ]);
    if (!user || !valid || user.isActive === "inactive") {
      req.session.destroy(() => {});
      res.clearCookie("__btr_sid", { path: "/" });
      res.set("Cache-Control", "no-store");
      return res.status(user?.isActive === "inactive" ? 403 : 401).json({
        error: user?.isActive === "inactive"
          ? "حسابك معطّل. يرجى التواصل مع المسؤول."
          : "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى",
      });
    }
    next();
  } catch (error) {
    console.error("Local session validation failed:", error);
    res.status(503).json({ error: "تعذر التحقق من صلاحية الحساب أو الجلسة" });
  }
};

export const validateOrigin: RequestHandler = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  
  const origin = req.get("origin");
  const referer = req.get("referer");
  const host = req.get("host");
  
  const sourceUrl = origin || referer;
  
  if (sourceUrl) {
    try {
      const parsedUrl = new URL(sourceUrl);
      const expectedHosts = [
        host,
        "localhost:5000",
        "0.0.0.0:5000",
      ];
      
      if (host && !expectedHosts.some(h => parsedUrl.host === h || parsedUrl.host.endsWith(`.${h}`))) {
        console.warn(`Origin validation failed: ${sourceUrl} vs ${host}`);
        return res.status(403).json({ error: "طلب غير مصرح من مصدر خارجي" });
      }
    } catch (e) {
      console.warn(`Invalid origin/referer header: ${sourceUrl}`);
      return res.status(403).json({ error: "طلب غير مصرح" });
    }
  } else if (isProduction) {
    console.warn("Mutating request without Origin or Referer header blocked in production");
    return res.status(403).json({ error: "طلب غير مصرح - مصدر الطلب غير معروف" });
  }
  
  next();
};

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(validateLocalSession);
  app.use(createOwnerApiLockdown(
    id => storage.getUser(id),
    async (userId, sessionId) => {
      const sessions = await storage.getUserSessions(userId);
      return sessions.some(session => isOwnerSessionValid(session, sessionId));
    },
  ));
  
  // Rate limiting and CSRF/origin validation are applied globally in index.ts

  app.post("/api/auth/login", loginRateLimiter, async (req, res) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    });
    try {
      const { username, password, rememberMe } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      }

      const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const blockCheck = isLoginBlocked(clientIp);
      if (blockCheck.blocked) {
        return res.status(429).json({ 
          error: `تم حظر تسجيل الدخول مؤقتاً. يرجى الانتظار ${blockCheck.remainingMinutes} دقيقة` 
        });
      }

      const credentials = await storage.verifyLocalLoginPassword(username, password);
      if (!credentials) {
        trackLoginAttempt(clientIp, false);
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      const { user, generation } = credentials;

      trackLoginAttempt(clientIp, true);

      // Security check: Prevent inactive users from logging in
      if (user.isActive === "inactive") {
        return res.status(403).json({ error: "حسابك معطّل. يرجى التواصل مع المسؤول." });
      }

      // المرحلة 5: التحقق بخطوتين للمساهمين (يتحكم به المدير عبر إعدادات البوابة)
      if (user.role === "shareholder") {
        const cfg = await getTwoFactorConfig();
        if (cfg.required) {
          const issued = await issueOtpForUser(user.id);
          if (!issued.ok) {
            if (issued.error === "no_phone") {
              return res.status(403).json({
                error: "لا يوجد رقم جوال مسجّل لحسابك لإرسال رمز التحقق. يرجى التواصل مع الإدارة.",
              });
            }
            return res.status(500).json({ error: "تعذّر إرسال رمز التحقق. يرجى المحاولة لاحقاً." });
          }
          // نُنشئ جلسة مؤقتة تحمل علامة الانتظار فقط (دون مصادقة كاملة)
          return req.session.regenerate((regenErr) => {
            if (regenErr) {
              console.error("Session regenerate (2FA) error:", regenErr);
              return res.status(500).json({ error: "فشل تسجيل الدخول" });
            }
            req.session.pendingTwoFactor = { userId: user.id, rememberMe: !!rememberMe, at: Date.now() };
            req.session.localAuthGeneration = generation;
            req.session.save((saveErr) => {
              if (saveErr) {
                if (saveErr.code === "LOCAL_SESSION_REVOKED") {
                  req.session.destroy(() => {});
                  return res.status(401).json({ error: "انتهت صلاحية تسجيل الدخول. يرجى المحاولة من جديد." });
                }
                console.error("Session save (2FA) error:", saveErr);
                return res.status(500).json({ error: "فشل تسجيل الدخول" });
              }
              return res.json({ otpRequired: true, phone: issued.phone, channel: issued.channel });
            });
          });
        }
      }

      return establishSession(req, res, user, !!rememberMe, clientIp, generation);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
    }
  });

  // المرحلة 5: التحقق من رمز OTP لإكمال دخول المساهم
  app.post("/api/auth/verify-otp", otpRateLimiter, async (req, res) => {
    res.set({ 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' });
    try {
      const pending = req.session.pendingTwoFactor;
      if (!pending || !pending.userId) {
        return res.status(401).json({ error: "انتهت جلسة التحقق. يرجى تسجيل الدخول من جديد." });
      }
      // مهلة كلية للتحدي: 10 دقائق منذ بدء الدخول
      if (Date.now() - pending.at > 10 * 60 * 1000) {
        delete req.session.pendingTwoFactor;
        return res.status(401).json({ error: "انتهت مهلة التحقق. يرجى تسجيل الدخول من جديد." });
      }
      const code = String(req.body?.code || "").trim();
      if (!/^\d{4,8}$/.test(code)) {
        return res.status(400).json({ error: "رمز غير صالح" });
      }
      const result = await verifyOtpForUser(pending.userId, code);
      if (!result.ok) {
        const messages: Record<string, string> = {
          no_challenge: "انتهت صلاحية الرمز. يرجى طلب رمز جديد.",
          expired: "انتهت صلاحية الرمز. يرجى طلب رمز جديد.",
          too_many_attempts: "تم تجاوز عدد المحاولات. يرجى طلب رمز جديد.",
          invalid: "الرمز غير صحيح.",
        };
        return res.status(401).json({ error: messages[result.error] || "تعذّر التحقق" });
      }
      const user = await storage.getUser(pending.userId);
      if (!user || user.isActive === "inactive") {
        delete req.session.pendingTwoFactor;
        return res.status(403).json({ error: "تعذّر إكمال الدخول. يرجى التواصل مع الإدارة." });
      }
      const rememberMe = pending.rememberMe;
      // Preserve the generation captured with the original password, never
      // refresh it after OTP verification or an administrator's reset.
      const generation = req.session.localAuthGeneration ?? "legacy";
      const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
      delete req.session.pendingTwoFactor;
      return establishSession(req, res, user, rememberMe, clientIp, generation, { twoFactor: true });
    } catch (error) {
      console.error("verify-otp error:", error);
      res.status(500).json({ error: "حدث خطأ أثناء التحقق" });
    }
  });

  // المرحلة 5: إعادة إرسال رمز OTP (مع ضوابط التكرار)
  app.post("/api/auth/resend-otp", otpRateLimiter, async (req, res) => {
    res.set({ 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' });
    try {
      const pending = req.session.pendingTwoFactor;
      if (!pending || !pending.userId) {
        return res.status(401).json({ error: "انتهت جلسة التحقق. يرجى تسجيل الدخول من جديد." });
      }
      // مهلة كلية للتحدي: 10 دقائق منذ بدء الدخول
      if (Date.now() - pending.at > 10 * 60 * 1000) {
        delete req.session.pendingTwoFactor;
        return res.status(401).json({ error: "انتهت مهلة التحقق. يرجى تسجيل الدخول من جديد." });
      }
      const issued = await issueOtpForUser(pending.userId, { resend: true });
      if (!issued.ok) {
        if (issued.error === "cooldown") {
          return res.status(429).json({ error: `يرجى الانتظار ${issued.retryAfter || 45} ثانية قبل إعادة الإرسال.` });
        }
        if (issued.error === "too_many_sends") {
          return res.status(429).json({ error: "تم تجاوز حد إعادة الإرسال. يرجى تسجيل الدخول من جديد لاحقاً." });
        }
        if (issued.error === "no_phone") {
          return res.status(403).json({ error: "لا يوجد رقم جوال مسجّل لحسابك." });
        }
        return res.status(500).json({ error: "تعذّر إرسال الرمز." });
      }
      return res.json({ otpRequired: true, phone: issued.phone, channel: issued.channel });
    } catch (error) {
      console.error("resend-otp error:", error);
      res.status(500).json({ error: "حدث خطأ أثناء إعادة الإرسال" });
    }
  });

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    try {
      if (!req.session.userId) {
        return res.json(null);
      }

      const userId = req.session.userId;

      const user = await storage.getUser(userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.json(null);
      }

      if (user.isActive === "inactive") {
        req.session.destroy(() => {});
        return res.status(403).json({ error: "حسابك معطّل. يرجى التواصل مع المسؤول." });
      }

      const { password: _, ...safeUser } = user;
      
      if (user.role === "business_owner") {
        const allowedBranches = await storage.getUserBranchAccess(user.id);
        return res.json({
          id: user.id, username: user.username, firstName: user.firstName,
          lastName: user.lastName, role: user.role, isActive: user.isActive,
          branchId: null, activeBranchId: null, activeBranch: null, allowedBranches,
        });
      }

      const [userBranches, activeBranch] = await Promise.all([
        storage.getUserBranchAccess(user.id),
        req.session.activeBranchId ? storage.getBranch(req.session.activeBranchId) : Promise.resolve(null)
      ]);
      
      res.json({
        ...safeUser,
        branchId: user.role === "warehouse_keeper" ? "main_warehouse" : safeUser.branchId,
        activeBranchId: user.role === "warehouse_keeper" ? "main_warehouse" : user.role === "operations_manager" && !userBranches.some((b: any) => b.branchId === req.session.activeBranchId) ? null : req.session.activeBranchId || null,
        activeBranch: user.role === "warehouse_keeper" || user.role === "operations_manager" && !userBranches.some((b: any) => b.branchId === req.session.activeBranchId) ? null : activeBranch,
        allowedBranches: user.role === "warehouse_keeper" ? [] : userBranches,
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.get("/api/auth/init", async (req, res) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    try {
      if (!req.session.userId) {
        return res.json({ user: null, branches: [], permissions: [] });
      }
      
      const userId = req.session.userId;
      let user: any, userBranches: any[], activeBranch: any, permissions: any[];
      
      const allBranchesPromise = storage.getAllBranches();
      const dbUser = await storage.getUser(userId);
      if (!dbUser) {
        req.session.destroy(() => {});
        return res.json({ user: null, branches: [], permissions: [] });
      }
      if (dbUser.isActive === "inactive") {
        req.session.destroy(() => {});
        return res.status(403).json({ error: "حسابك معطّل" });
      }
      const { password: _, ...safeUser } = dbUser;
      user = safeUser;
      const [ub, ab] = await Promise.all([
        storage.getUserBranchAccess(dbUser.id),
        req.session.activeBranchId ? storage.getBranch(req.session.activeBranchId) : Promise.resolve(null)
      ]);
      userBranches = ub;
      activeBranch = ab;
      permissions = [];
      
      const allBranches = await allBranchesPromise;
      let filteredBranches: any[] = [];
      if (user.role === "warehouse_keeper") {
        filteredBranches = [];
      } else if (user.role === "admin" || user.role === "financial_manager" || user.role === "production_development_manager") {
        // Financial Manager is a cross-branch role — sees every branch org-wide.
        filteredBranches = allBranches;
      } else if (user.role === "operations_manager") {
        // PHASE1: grants are explicit. No rows means DENY, never all.
        filteredBranches = allBranches.filter((b: any) => userBranches.some((ub: any) => ub.branchId === b.id));
      } else if (userBranches.length > 0) {
        const allowedIds = userBranches.map((b: any) => b.branchId);
        filteredBranches = allBranches.filter((b: any) => allowedIds.includes(b.id));
      } else if (user.branchId) {
        filteredBranches = allBranches.filter((b: any) => b.id === user.branchId);
      } else {
        filteredBranches = [];
      }
      
      if (permissions.length === 0) {
        if (user.role === "admin") {
          const { SYSTEM_MODULES, MODULE_ACTIONS } = await import("@shared/schema");
          permissions = SYSTEM_MODULES.map((m: string) => ({ module: m, actions: [...MODULE_ACTIONS] }));
        } else if (user.role === "attendance_clerk") {
          permissions = [{ module: "attendance_check", actions: ["view", "create", "edit"] }];
        } else {
          const userPerms = await storage.getUserPermissions(userId, { bypassCache: true });
          const permMap = new Map<string, string[]>();
          for (const p of userPerms) {
            if (!permMap.has(p.module)) permMap.set(p.module, []);
            const acts = permMap.get(p.module)!;
            for (const a of p.actions) {
              if (!acts.includes(a)) acts.push(a);
            }
          }
          permissions = Array.from(permMap.entries()).map(([module, actions]) => ({ module, actions }));
        }
      }
      
      if (user.role === "production_development_manager") {
        const merged = new Map<string, Set<string>>(permissions.map((p: any) => [p.module, new Set<string>(p.actions || [])]));
        for (const [module, actions] of Object.entries(PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS)) {
          merged.set(module, new Set([...(merged.get(module) || []), ...actions]));
        }
        permissions = Array.from(merged, ([module, actions]) => ({ module, actions: [...actions] }));
      }
      if (user.role === "operations_manager") {
        const merged = new Map<string, Set<string>>(permissions.map((p: any) => [p.module, new Set<string>(p.actions || [])]));
        for (const [module, actions] of Object.entries(OPERATIONS_MANAGER_PERMISSIONS)) {
          merged.set(module, new Set([...(merged.get(module) || []), ...actions]));
        }
        permissions = Array.from(merged, ([module, actions]) => ({ module, actions: [...actions] }));
      }
      if (user.role === "warehouse_keeper") {
        permissions = await getWarehouseKeeperEffectivePermissions(user.id, permissions);
      }
      if (user.role === "branch_manager") {
        permissions = await getBranchManagerEffectivePermissions(user.id, permissions);
      }
      res.json({
        user: {
          ...user,
          branchId: user.role === "warehouse_keeper" ? "main_warehouse" : user.branchId,
          activeBranchId: user.role === "warehouse_keeper" ? "main_warehouse" : user.role === "operations_manager" && !userBranches.some((b: any) => b.branchId === req.session.activeBranchId) ? null : req.session.activeBranchId || null,
          activeBranch: user.role === "warehouse_keeper" || user.role === "operations_manager" && !userBranches.some((b: any) => b.branchId === req.session.activeBranchId) ? null : activeBranch,
          allowedBranches: user.role === "warehouse_keeper" ? [] : userBranches,
        },
        branches: filteredBranches,
        permissions,
      });
    } catch (error) {
      console.error("Auth init error:", error);
      res.status(500).json({ error: "Failed to initialize" });
    }
  });

  // Switch active branch
  app.patch("/api/auth/active-branch", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "غير مصرح" });
      }

      const { branchId } = req.body;
      if (!branchId) {
        return res.status(400).json({ error: "معرف الفرع مطلوب" });
      }

      // Verify user has access to this branch
      const userBranches = await storage.getUserBranchAccess(req.session.userId);
      const hasAccess = userBranches.some(b => b.branchId === branchId);
      
      // If no branch access defined, user has access to all branches (for admins)
      const user = await storage.getUser(req.session.userId);
      if (user?.role === "warehouse_keeper") {
        return res.status(403).json({ error: "نطاق أمين المستودعات هو المستودع الرئيسي فقط" });
      }
      if ((user?.role === "operations_manager" && !hasAccess) || (!hasAccess && userBranches.length > 0 && user?.role !== "admin")) {
        return res.status(403).json({ error: "ليس لديك صلاحية للوصول لهذا الفرع" });
      }

      // Verify branch exists
      const branch = await storage.getBranch(branchId);
      if (!branch) {
        return res.status(404).json({ error: "الفرع غير موجود" });
      }

      req.session.activeBranchId = branchId;
      req.session.save(async (err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "فشل تغيير الفرع" });
        }
        try {
          const { invalidateCacheForUser } = await import("./api-cache");
          invalidateCacheForUser(req.session.userId!);
        } catch (e) {}
        res.json({ 
          success: true, 
          activeBranchId: branchId,
          activeBranch: branch 
        });
      });
    } catch (error) {
      console.error("Switch branch error:", error);
      res.status(500).json({ error: "حدث خطأ أثناء تغيير الفرع" });
    }
  });

  // Re-authentication endpoint for sensitive operations
  app.post("/api/auth/verify-password", verifyPasswordRateLimiter, async (req, res) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
    });
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: "كلمة المرور مطلوبة" });
      }
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(password, user.password || '');
      if (!isValid) {
        logSecurityAlert({
          alertType: 'reauth_failed',
          severity: 'medium',
          userId: user.id,
          userName: user.username || 'unknown',
          module: 'auth',
          action: 'verify_password_failed',
          ipAddress: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
        });
        return res.status(403).json({ error: "كلمة المرور غير صحيحة" });
      }
      res.json({ verified: true });
    } catch (error) {
      console.error("Password verification error:", error);
      res.status(500).json({ error: "حدث خطأ أثناء التحقق" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", async (req, res) => {
    const userId = req.session.userId;
    let userName = "غير معروف";
    
    // Get user info before destroying session
    if (userId) {
      try {
        const user = await storage.getUser(userId);
        if (user) {
          userName = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : user.username || 'غير معروف';
        }
        
        // Log logout to audit log
        const logoutDevice = parseUserAgent(req.headers['user-agent'] || '');
        await storage.createSystemAuditLog({
          module: "users",
          entityId: userId,
          entityName: userName,
          action: "logout",
          description: "تسجيل خروج",
          details: JSON.stringify({
            browser: logoutDevice.browser,
            os: logoutDevice.os,
            device: logoutDevice.device,
          }),
          userId: userId,
          userName: userName,
          branchId: req.session.activeBranchId || null,
          ipAddress: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
        });
        // Invalidate user session for online tracking
        if (req.sessionID) {
          await storage.invalidateSession(req.sessionID);
        }
      } catch (logError) {
        console.error("Failed to create audit log for logout:", logError);
      }
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "فشل تسجيل الخروج" });
      }
      res.clearCookie("__btr_sid", { path: "/" });
      res.json({ success: true });
    });
  });
}

const SERVER_INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 60 minutes server-side inactivity timeout — long enough for cashier shift-close forms (signature + attachments)
const MAX_SESSION_AGE = 12 * 60 * 60 * 1000; // 12 hours absolute max session lifetime

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح" });
  }

  const userId = req.session.userId;
  const now = Date.now();

  // SECURITY: Server-side inactivity timeout check
  if (req.session.lastActivity && (now - req.session.lastActivity) > SERVER_INACTIVITY_TIMEOUT) {
    const sessionId = req.sessionID;
    req.session.destroy(() => {});
    if (sessionId) storage.invalidateSession(sessionId).catch(() => {});
    return res.status(401).json({ message: "انتهت الجلسة بسبب عدم النشاط. يرجى تسجيل الدخول مرة أخرى" });
  }

  // SECURITY: Absolute session lifetime check (prevent indefinite sessions)
  if (req.session.createdAt && (now - req.session.createdAt) > MAX_SESSION_AGE) {
    const sessionId = req.sessionID;
    req.session.destroy(() => {});
    if (sessionId) storage.invalidateSession(sessionId).catch(() => {});
    return res.status(401).json({ message: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى" });
  }

  // SECURITY: Session fingerprint validation - prevent session hijacking
  if (req.session.fingerprint) {
    const currentFingerprint = generateSessionFingerprint(req);
    if (req.session.fingerprint !== currentFingerprint) {
      console.warn(`[Security] Session fingerprint mismatch for user ${userId}. Expected: ${req.session.fingerprint.substring(0,8)}..., Got: ${currentFingerprint.substring(0,8)}...`);
      logSecurityAlert({
        alertType: 'session_hijack_attempt',
        severity: 'critical',
        userId,
        module: 'auth',
        action: 'session_fingerprint_mismatch',
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
      });
      const sessionId = req.sessionID;
      req.session.destroy(() => {});
      if (sessionId) storage.invalidateSession(sessionId).catch(() => {});
      return res.status(401).json({ message: "تم اكتشاف تغيير في بصمة الجلسة. يرجى تسجيل الدخول مرة أخرى" });
    }
  }

  // Update last activity timestamp
  req.session.lastActivity = now;

  // Always read authoritative user and branch grants. Cross-worker revocations
  // must take effect on the next request, not after an in-process TTL expires.
  const [user, branchAccess] = await Promise.all([
    storage.getUser(userId),
    storage.getUserBranchAccess(userId)
  ]);

  if (!user) {
    return res.status(401).json({ message: "غير مصرح" });
  }

  if (user.isActive === "inactive") {
    req.session.destroy(() => {});
    return res.status(403).json({ message: "حسابك معطّل. يرجى التواصل مع المسؤول." });
  }

  // Pre-fetch permissions in parallel for non-admin users (will be needed by requirePermission)
  if (user.role === "business_owner") {
    const sessions = await storage.getUserSessions(user.id);
    if (!sessions.some(session => isOwnerSessionValid(session, req.sessionID))) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "انتهت صلاحية الجلسة" });
    }
  }
  if (user.role === "business_owner" && !isOwnerRequestAllowed(req.method, req.originalUrl)) {
    return res.status(403).json({ error: "حساب الأونر مخصص للاطلاع عبر بوابته فقط" });
  }
  let permissions: any[] = [];
  if (user.role !== "admin" && user.role !== "business_owner") {
    try {
      const snapshot = await getRequestPermissionSnapshot(req, userId);
      if (snapshot) {
        permissions = snapshotModulePermissions(snapshot, user, req.method);
      } else {
        permissions = await storage.getUserPermissions(userId, { bypassCache: true });
      }
    } catch (error) {
      return res.status(503).json({ message: "تعذر التحقق من الصلاحيات. يلزم إعداد مصدر الصلاحيات وترحيل 050 قبل النشر." });
    }
  }

  (req as any).currentUser = user;
  (req as any).userBranchAccess = branchAccess;
  // A grantless operations manager must never reach a legacy handler that
  // interprets an omitted filter as "all". Keep only the auth/bootstrap and
  // empty branch selector available so the client can explain the denial.
  if (user.role === "operations_manager" && branchAccess.length === 0
      && req.path !== "/api/branches" && req.path !== "/api/my-permissions"
      && !req.path.startsWith("/api/auth/")) {
    return res.status(403).json({ error: "لا توجد فروع مسموحة لحسابك" });
  }
  (req as any).hasAllBranchesAccess = branchAccess.length > 0;
  // Fresh, request-local snapshot: permission middleware can reuse this read
  // within this request, never across sessions or workers.
  (req as any).authPermissions = permissions;
  if (user.role === "warehouse_keeper" && !(req as any).authPermissionDecisionSnapshot) {
    (req as any).authPermissions = await getWarehouseKeeperEffectivePermissions(user.id, permissions);
  }
  if (user.role === "branch_manager" && !(req as any).authPermissionDecisionSnapshot) {
    (req as any).authPermissions = await getBranchManagerEffectivePermissions(user.id, permissions);
  }
  
  // Update session activity throttled (only once per 60s per session)
  if (req.sessionID) {
    const lastUpdate = sessionActivityThrottle.get(req.sessionID);
    const now = Date.now();
    if (!lastUpdate || now - lastUpdate > 60_000) {
      sessionActivityThrottle.set(req.sessionID, now);
      storage.updateSessionActivity(req.sessionID).catch(() => {});
    }
  }
  
  next();
};

// Throttle session activity updates to avoid DB writes on every request
const sessionActivityThrottle = new Map<string, number>();
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(sessionActivityThrottle.entries());
  for (const [key, val] of entries) {
    if (now - val > 300_000) sessionActivityThrottle.delete(key);
  }
}, 120_000);

// Catalog writes have a narrow products grant as well as the legacy operations
// grant. Do not grant the entire operations module to production management.
export const requireProductWritePermission = (action: "create" | "edit"): RequestHandler =>
  async (req, res, next) => {
    const user = (req as any).currentUser;
    if (!user) return res.status(401).json({ message: "غير مصرح" });
    if (user.role === "admin") return next();
    // Use the same deny/source/scope decision for the narrow grant and the legacy
    // operations alternative. Never let this specialized guard bypass revocation.
    if (typeof storage.getPermissionDecisionSnapshot === "function"
      || (req as any).authPermissionDecisionSnapshot) {
      try {
        const snapshot = await getRequestPermissionSnapshot(req, user.id);
        if (snapshot && hasPermissionDecisionDeny(snapshot, "products", action)) {
          return res.status(403).json({ message: "تم سحب صلاحية هذا الإجراء" });
        }
      } catch (error) {
        return res.status(503).json({ message: "تعذر التحقق من الصلاحيات. يلزم إعداد مصدر الصلاحيات وترحيل 050 قبل النشر." });
      }
      const probeResponse: any = {
        status() { return probeResponse; }, json() { return probeResponse; },
      };
      let allowed = false;
      await requirePermission("products", action)(req, probeResponse, () => { allowed = true; });
      if (allowed) return next();
      return requirePermission("operations", action)(req, res, next);
    }
    if (user.role === "viewer" || user.role === "attendance_clerk") {
      return requirePermission("products", action)(req, res, next);
    }
    if (user.role === "admin" || (user.role === "production_development_manager"
      && PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS.products.includes(action))) return next();
    const permissions = (req as any).authPermissions ?? await storage.getUserPermissions(user.id, { bypassCache: true });
    if (permissions.some((permission: any) => permission.module === "products"
      && Array.isArray(permission.actions) && permission.actions.includes(action))) return next();
    return requirePermission("operations", action)(req, res, next);
  };

export const requireRole = (roles: string[]): RequestHandler => {
  return async (req, res, next) => {
    const user = (req as any).currentUser;
    if (!user) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    
    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: "غير مسموح - صلاحيات غير كافية" });
    }
    
    next();
  };
};

/** Explicit revocations must precede operations role auto-grants. Cache only
 * on this authenticated request, never across users, heartbeats or requests. */
async function operationsPermissionDenials(req: any): Promise<Set<string>> {
  if (!req.operationsPermissionDenials) {
    const result = await pool.query(`SELECT p.module,p.action
      FROM user_permission_overrides o JOIN permissions p ON p.id=o.permission_id
      WHERE o.user_id=$1 AND o.allow=false
        AND (o.expires_at IS NULL OR o.expires_at > NOW())`, [req.currentUser.id]);
    req.operationsPermissionDenials = new Set(result.rows.map((row: any) => `${row.module}:${row.action}`));
  }
  return req.operationsPermissionDenials;
}

function snapshotModulePermissions(snapshot: PermissionDecisionSnapshot, user?: any, method = "GET"): { module: string; actions: string[] }[] {
  const modules = new Map<string, string[]>();
  for (const decision of evaluatePermissionDecision(snapshot)) {
    if (!decision.allowed) continue;
    if (user?.role === "warehouse_keeper" && !WAREHOUSE_KEEPER_PERMISSIONS[decision.module]?.includes(decision.action)) continue;
    if (user && !checkPermissionDecision(roleAdjustedSnapshot(snapshot, user, decision.module), decision.module, decision.action)) continue;
    const actions = modules.get(decision.module) ?? [];
    actions.push(decision.action);
    modules.set(decision.module, actions);
  }
  // These two roles historically expose their effective intrinsic selection on
  // authPermissions as well as in the middleware. Keep that compatibility, but
  // never flatten a scoped assignment into it or lose conservative deny checks.
  const intrinsic = user?.role === "warehouse_keeper" ? WAREHOUSE_KEEPER_PERMISSIONS
    : user?.role === "branch_manager" ? BRANCH_MANAGER_INTRINSIC_PERMISSIONS : {};
  for (const [module, actions] of Object.entries(intrinsic)) {
    const selected = new Set(modules.get(module) ?? []);
    for (const action of actions) {
      if (intrinsicPermissionGranted(user, snapshot, module, action, method)
        && !hasPermissionDecisionDeny(snapshot, module, action)) selected.add(action);
    }
    modules.set(module, [...selected]);
  }
  return Array.from(modules, ([module, actions]) => ({ module, actions }));
}

function directSnapshotRows(snapshot: PermissionDecisionSnapshot): { module: string; actions: string[] }[] {
  if (snapshot.sourceMode === "inherit") return [];
  const direct = (snapshot as PermissionDecisionSnapshot & {
    directPermissions?: { module: string; actions: string[] }[];
  }).directPermissions;
  if (!Array.isArray(direct)) throw new Error("Permission snapshot must retain raw direct rows, including empty selections");
  return direct;
}

function roleAdjustedSnapshot(snapshot: PermissionDecisionSnapshot, user: any, module: string): PermissionDecisionSnapshot {
  if (user.role !== "branch_manager") return snapshot;
  const custom = directSnapshotRows(snapshot).find(row => row.module === module);
  if (!custom) return snapshot;
  // The branch manager's explicit module row is a complete selection (including
  // []). An inherited/aliased action cannot undo that selection; independent
  // approved overrides and denies still apply to their own resource scopes.
  return { ...snapshot, tuples: snapshot.tuples.filter(tuple =>
    tuple.source === "override_grant" || tuple.source === "override_deny"
    || (tuple.module === module && custom.actions.includes(tuple.action))) };
}

async function getRequestPermissionSnapshot(req: any, userId: string): Promise<PermissionDecisionSnapshot | undefined> {
  if (req.authPermissionDecisionSnapshot) {
    if (req.authPermissionDecisionSnapshot.userId !== userId) throw new Error("Permission snapshot user mismatch");
    return req.authPermissionDecisionSnapshot;
  }
  // The production storage implements this method. Legacy, isolated middleware
  // fixtures which provide a partial storage stub retain their original path.
  if (typeof storage.getPermissionDecisionSnapshot !== "function") return undefined;
  const snapshot = await storage.getPermissionDecisionSnapshot(userId);
  if (snapshot.userId !== userId) throw new Error("Permission snapshot user mismatch");
  req.authPermissionDecisionSnapshot = snapshot;
  return snapshot;
}

export function intrinsicPermissionGranted(
  user: any, snapshot: PermissionDecisionSnapshot, module: string, action: string, method: string,
): boolean {
  const direct = user.role === "warehouse_keeper" || user.role === "branch_manager" ? directSnapshotRows(snapshot) : [];
  if (user.role === "warehouse_keeper") {
    return direct.length === 0 && !!WAREHOUSE_KEEPER_PERMISSIONS[module]?.includes(action);
  }
  if (user.role === "branch_manager") {
    const custom = direct.find(row => row.module === module);
    return custom ? custom.actions.includes(action)
      : !!BRANCH_MANAGER_INTRINSIC_PERMISSIONS[module]?.includes(action);
  }
  if (user.role === "attendance_clerk") return module === "attendance_check" && ["view", "create", "edit"].includes(action);
  if (deliveryEmployeeActions(user, module).includes(action)) return true;
  if (user.role === "hr_manager") return HR_MANAGER_MODULES.has(module) && (MODULE_ACTIONS as readonly string[]).includes(action);
  if (user.role === "hr_specialist") return !!HR_SPECIALIST_PERMISSIONS[module]?.includes(action);
  if (user.role === "production_development_manager") {
    return !!PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS[module]?.includes(action);
  }
  if (user.role === "financial_manager") return !!financialManagerActionsFor(module)?.includes(action);
  if (user.role === "operations_manager") return !!operationsManagerActionsFor(module)?.includes(action);
  return false;
}

export function contextualActionAllowed(
  req: any, snapshot: PermissionDecisionSnapshot, module: string, action: string, context: PermissionContext,
): boolean {
  const user = req.currentUser;
  if (snapshot.branchTemplates?.length)
    snapshot = branchTemplateSnapshot(snapshot, snapshot.branchTemplates, context);
  snapshot = roleAdjustedSnapshot(snapshot, user, module);
  if (user.role === "viewer" && action !== "view") return false;
  if (user.role === "attendance_clerk" && (module !== "attendance_check" || !["view", "create", "edit"].includes(action))) return false;
  if (isRoleModuleDenied(user.role, module)) return false;
  if (user.role === "warehouse_keeper" && !WAREHOUSE_KEEPER_PERMISSIONS[module]?.includes(action)) return false;
  if (hasPermissionDecisionDeny(snapshot, module, action, context)) return false;
  const unknownProductionInference = req.permissionActionInferred
    && user.role === "production_development_manager"
    && !["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const intrinsic = intrinsicPermissionGranted(user, snapshot, module, unknownProductionInference ? "delete" : action, req.method);
  if (!context.branchId) return intrinsic || checkPermissionDecision(snapshot, module, action, context);

  const legacyBranches = getLegacyAllowedBranchIds(req);
  const hrRead = ["GET", "HEAD"].includes(req.method) && action === "view"
    && HR_MANAGER_MODULES.has(module) && hasCrossBranchHrReadAccess({
      ...req, permissionScopeConstraint: undefined,
    });
  const inLegacyScope = hrRead || legacyBranches === null || legacyBranches.includes(context.branchId);
  // Preserve explicit operational and warehouse boundaries even if a historical
  // assignment has a wider scope. Other scoped sources carry their own scope.
  if ((user.role === "operations_manager" || user.role === "warehouse_keeper"
    || user.role === "business_owner") && !inLegacyScope) return false;
  if (inLegacyScope && intrinsic) return true;
  const scopedSources = { ...snapshot, tuples: snapshot.tuples.filter(tuple => tuple.source !== "direct" || tuple.branchId !== null) };
  return checkPermissionDecision(inLegacyScope ? snapshot : scopedSources, module, action, context);
}

/** Navigation ONLY: union actions usable in at least one candidate context.
 * This result is never installed as authPermissions or a request constraint.
 * Department IDs here describe granted tuples, not proof of an ID resource.
 * Routes still need persisted ownership/department context and the normal guard.
 */
export function projectNavigationPermissions(
  snapshot: PermissionDecisionSnapshot, req: any, branchCandidates: readonly string[],
  seed: { module: string; actions: string[] }[] = [],
): { module: string; actions: string[] }[] {
  const user = req.currentUser;
  if (!user) return [];
  if (["admin", "business_owner", "shareholder"].includes(user.role)) {
    return seed.map(row => ({ module: row.module, actions: [...row.actions] }));
  }
  const navigationRequest = {
    ...req, method: "GET", permissionActionInferred: false,
    permissionResourceContext: undefined, permissionScopeConstraint: undefined,
  };
  const keys = new Map<string, { module: string; action: string }>();
  const add = (module: string, action: string) => keys.set(JSON.stringify([module, action]), { module, action });
  for (const pair of evaluatePermissionDecision(snapshot)) add(pair.module, pair.action);
  for (const tuple of snapshot.tuples)
    if (tuple.module === "marketing" || tuple.module.startsWith("marketing_")) add(tuple.module, tuple.action);
  for (const row of seed) for (const action of row.actions) add(row.module, action);
  const roleMaps: Record<string, string[]>[] = [];
  if (user.role === "hr_manager") roleMaps.push(Object.fromEntries([...HR_MANAGER_MODULES].map(module => [module, [...MODULE_ACTIONS]])));
  if (user.role === "hr_specialist") roleMaps.push(HR_SPECIALIST_PERMISSIONS);
  if (user.role === "financial_manager") roleMaps.push(FINANCIAL_MANAGER_PERMISSIONS);
  if (user.role === "production_development_manager") roleMaps.push(PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS);
  if (user.role === "operations_manager") roleMaps.push(OPERATIONS_MANAGER_PERMISSIONS);
  if (user.role === "branch_manager") roleMaps.push(BRANCH_MANAGER_INTRINSIC_PERMISSIONS);
  if (user.role === "warehouse_keeper") roleMaps.push(WAREHOUSE_KEEPER_PERMISSIONS);
  if (user.role === "attendance_clerk") roleMaps.push({ attendance_check: ["view", "create", "edit"] });
  if (user.role === "employee" && user.jobTitle === "delivery") roleMaps.push({ delivery_tasks: DELIVERY_EMPLOYEE_ACTIONS });
  for (const map of roleMaps) for (const [module, actions] of Object.entries(map)) {
    for (const action of actions) add(module, action);
  }
  const branches = user.role === "warehouse_keeper" ? ["main_warehouse"]
    : [...new Set([...branchCandidates, ...(snapshot.branchTemplates ?? []).map(base => base.branchId)])];
  const departments = [...new Set(snapshot.tuples.flatMap(tuple => tuple.departmentId == null ? [] : [tuple.departmentId]))];
  const contexts: PermissionContext[] = user.role === "warehouse_keeper" ? [] : [{}];
  for (const branchId of branches) {
    contexts.push({ branchId });
    for (const departmentId of departments) contexts.push({ branchId, departmentId });
  }
  // Department-only resources can have no branch. This is display capability
  // only; unknown department context in request authorization still fails closed.
  if (user.role !== "warehouse_keeper") for (const departmentId of departments) contexts.push({ departmentId });
  const modules = new Map<string, Set<string>>();
  for (const { module, action } of keys.values()) {
    const centralMarketing = (module === "marketing" || module.startsWith("marketing_"))
      && contextualActionAllowed(navigationRequest, centralMarketingSnapshot(snapshot), module, action, {});
    if (!centralMarketing && !contexts.some(context => contextualActionAllowed(navigationRequest, snapshot, module, action, context))) continue;
    const actions = modules.get(module) ?? new Set<string>();
    actions.add(action);
    modules.set(module, actions);
  }
  return Array.from(modules, ([module, actions]) => ({ module, actions: [...actions] }));
}

export async function getNavigationPermissionProjection(
  req: any, branchCandidates: readonly string[], seed: { module: string; actions: string[] }[] = [],
): Promise<{ module: string; actions: string[] }[]> {
  const user = req.currentUser;
  if (!user) return [];
  if (["admin", "business_owner", "shareholder"].includes(user.role)) {
    return seed.map(row => ({ module: row.module, actions: [...row.actions] }));
  }
  const snapshot = await getRequestPermissionSnapshot(req, user.id);
  if (!snapshot) throw new Error("Navigation projection requires an authoritative permission decision snapshot");
  return projectNavigationPermissions(snapshot, req, branchCandidates, seed);
}

/** Route opt-in: resolve persisted ownership BEFORE evaluating the permission.
 * A null resolver result is a missing resource, not an unknown/global scope. */
export const withPermissionContext = (resolver: PermissionContextResolver): RequestHandler =>
  async (req, res, next) => {
    if ((req as any).currentUser?.role === "admin") return next();
    try {
      const context = await resolver(req);
      if (context === null) return res.status(404).json({ message: "المورد غير موجود" });
      if (!isValidPermissionRequestContext(context)) return res.status(403).json({ message: "تعذر إثبات نطاق المورد" });
      (req as any).permissionResourceContext = context;
      return next();
    } catch (error) {
      return next(error);
    }
  };

async function enforceContextualPermission(
  req: any, res: any, next: any, module: string, actions: string[],
  resolver?: PermissionContextResolver, actionInferred = false,
): Promise<boolean> {
  const snapshot = await getRequestPermissionSnapshot(req, req.currentUser.id);
  if (!snapshot) return false;
  req.permissionActionInferred = actionInferred;
  let context: PermissionRequestContext | undefined = req.permissionResourceContext;
  if (!context && !resolver && snapshot.branchTemplates?.length) {
    const { branchTemplateRouteContext } = await import("./branch-template-context");
    const legacy = getLegacyAllowedBranchIds(req) ?? [];
    const resolved = await branchTemplateRouteContext(req, module,
      [...new Set([...legacy, ...snapshot.branchTemplates.map(base => base.branchId)])]);
    if (resolved === null) {
      res.status(404).json({ message: "المورد غير موجود" });
      return true;
    }
    context = resolved;
  }
  if (resolver) {
    const resolved = await resolver(req);
    if (resolved === null) {
      res.status(404).json({ message: "المورد غير موجود" });
      return true;
    }
    context = resolved;
  }
  if (context && !isValidPermissionRequestContext(context)) {
    res.status(403).json({ message: "تعذر إثبات نطاق المورد" });
    return true;
  }
  if (context) req.permissionResourceContext = context;
  const allowedActions: string[] = [];
  let branchIds: string[] | null = null;
  if (context?.kind === "collection") {
    branchIds = [...new Set(context.branchIds)].filter(branchId => actions.some(action =>
      contextualActionAllowed(req, snapshot, module, action, { branchId, departmentId: context.departmentId })));
    for (const action of actions) {
      if (branchIds.some(branchId => contextualActionAllowed(req, snapshot, module, action, {
        branchId, departmentId: context.departmentId,
      }))) allowedActions.push(action);
    }
    // Empty authorized collections are permitted only with whole-route authority;
    // their [] constraint still forces an empty result, never a null/all filter.
    if (context.branchIds.length === 0) {
      allowedActions.push(...actions.filter(action => contextualActionAllowed(req, snapshot, module, action, {})));
    }
  } else {
    const resource = context?.kind === "resource" ? context : {};
    allowedActions.push(...actions.filter(action => contextualActionAllowed(req, snapshot, module, action, resource)));
    if (context?.kind === "resource" && context.branchId) branchIds = [context.branchId];
  }
  if (!allowedActions.length) {
    res.status(403).json({ message: "غير مسموح - ليس لديك صلاحية سارية ضمن نطاق هذا المورد" });
    return true;
  }
  recordPermissionScopeConstraint(req, {
    module, actions: allowedActions, kind: context?.kind ?? "unknown", branchIds,
  });
  if (getPermissionScopeConstraint(req)?.branchIds?.length === 0 && context?.kind !== "collection") {
    res.status(403).json({ message: "غير مسموح - نطاقات الصلاحيات لا تتطابق" });
    return true;
  }
  next();
  return true;
}

// New middleware for granular permission checking
export const requirePermission = (module: string, action?: string, contextResolver?: PermissionContextResolver): RequestHandler => {
  return async (req, res, next) => {
    const user = (req as any).currentUser;
    if (!user) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    if (req.path?.startsWith("/api/marketing/") && (module === "marketing" || module.startsWith("marketing_"))) {
      try {
        if (user.role !== "admin") await getRequestPermissionSnapshot(req, user.id);
        const { enforceMarketingScope } = await import("./marketing-scope");
        return await enforceMarketingScope(req, res, next, module, action ?? ({
          GET: "view", POST: "create", PATCH: "edit", PUT: "edit", DELETE: "delete",
        } as Record<string, string>)[req.method] ?? "edit");
      } catch { return res.status(503).json({ message: "تعذر التحقق من صلاحيات التسويق" }); }
    }
    
    // Admin has full access
    if (user.role === "admin") {
      return next();
    }
    // Resolve once before every role grant/restriction and the explicit fallback.
    // Unknown methods require edit; read/export POST routes must specify "view".
    const effectiveAction = action ?? ({
      GET: "view", HEAD: "view", OPTIONS: "view", POST: "create",
      PUT: "edit", PATCH: "edit", DELETE: "delete",
    } as Record<string, string>)[req.method] ?? "edit";
    try {
      if (await enforceContextualPermission(req, res, next, module, [effectiveAction], contextResolver, action === undefined)) return;
    } catch (error) {
      return res.status(503).json({ message: "تعذر التحقق من الصلاحيات أو نطاق المورد. يلزم إعداد مصدر الصلاحيات وترحيل 050 قبل النشر." });
    }
    if (user.role === "warehouse_keeper") {
      const allowed = (req as any).authPermissions ?? await getWarehouseKeeperEffectivePermissions(user.id, await storage.getUserPermissions(user.id, { bypassCache: true }));
      return allowed.some((p: any) => p.module === module && p.actions.includes(effectiveAction))
        ? next() : res.status(403).json({ message: "غير مسموح - صلاحية أمين المستودعات محدودة بالمستودع الرئيسي" });
    }
    
    // SECURITY: Attendance clerk has ONLY attendance_check permissions
    if (user.role === "attendance_clerk") {
      if (module === "attendance_check" && ["view", "create", "edit"].includes(effectiveAction)) {
        
        return next();
      }
      
      logSecurityAlert({
        alertType: 'permission_denied',
        severity: 'high',
        userId: user.id,
        userName: user.username,
        module,
        action: effectiveAction,
        attemptedResource: req.originalUrl,
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'],
      });
      return res.status(403).json({ message: "غير مسموح - مسجل الحضور لديه صلاحية تسجيل الحضور فقط" });
    }
    
    // Viewer can only view
    if (user.role === "viewer") {
      if (effectiveAction !== "view") {
        return res.status(403).json({ message: "غير مسموح - المشاهد يمكنه العرض فقط" });
      }
    }

    if (deliveryEmployeeActions(user, module).includes(effectiveAction)) return next();
    
    // HR Manager has no ROLE_PERMISSION_TEMPLATES entry. Its existing permission
    // responses grant MODULE_ACTIONS on this set, not arbitrary action strings.
    // Strictly scoped to HR — financial, inventory, sales, etc. still go through
    // the standard permission check below and remain branch-isolated.
    if (user.role === "hr_manager" && HR_MANAGER_MODULES.has(module)
      && (MODULE_ACTIONS as readonly string[]).includes(effectiveAction)) {
      return next();
    }

    // HR Specialist role: narrower, action-aware HR access. Modules not in the
    // map fall through to the standard explicit-permission check below (so an
    // admin can still grant extra modules to an individual specialist).
    if (user.role === "hr_specialist") {
      const allowed = HR_SPECIALIST_PERMISSIONS[module];
      if (allowed?.includes(effectiveAction)) {
        return next();
      }
    }

    if (user.role === "production_development_manager") {
      const allowed = PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS[module];
      // Preserve this role's stricter historical unknown-method auto-grant.
      const knownMethod = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"].includes(req.method);
      const requiredAction = action ?? (knownMethod ? effectiveAction : "delete");
      if (allowed?.includes(requiredAction)) return next();
    }

    // Financial Manager role: action-aware auto-grant for finance/HR-read modules
    // across ALL branches (branch scope handled in getAllowedBranchIds). Modules
    // not in the map fall through to the standard explicit-permission check below.
    if (user.role === "financial_manager") {
      const allowed = financialManagerActionsFor(module);
      if (allowed?.includes(effectiveAction)) {
        return next();
      }
    }

    // Operations Manager role: action-aware auto-grant for daily-operations modules
    // only in explicitly granted branches (scope handled by branch guards). Modules
    // not in the map fall through to the standard explicit-permission check below.
    if (user.role === "operations_manager") {
      // These legacy modules contain unscoped HR administration and financial
      // mutations. Use the purpose-built operations HR permissions instead.
      if (isRoleModuleDenied(user.role, module)) {
        return res.status(403).json({ error: "استخدم صلاحيات موارد التشغيل المحددة" });
      }
      if ((await operationsPermissionDenials(req)).has(`${module}:${effectiveAction}`)) {
        return res.status(403).json({ error: "تم سحب صلاحية هذا الإجراء" });
      }
      const allowed = operationsManagerActionsFor(module);
      if (allowed?.includes(effectiveAction)) {
        return next();
      }
    }

    // Only reuse permissions fetched by isAuthenticated for this request.
    const permissions = (req as any).authPermissions ?? (
      user.role === "branch_manager"
        ? await getBranchManagerEffectivePermissions(user.id, await storage.getUserPermissions(user.id, { bypassCache: true }))
        : await storage.getUserPermissions(user.id, { bypassCache: true })
    );
    let modulePerm = permissions.find((p: any) => p.module === module);
    
    // Backward compatibility: attendance_check also accepts attendance permission
    if (!modulePerm && module === 'attendance_check') {
      modulePerm = permissions.find((p: any) => p.module === 'attendance');
    }

    // Backward compatibility: `pnl` and `pnl_dashboard` are two historical
    // names for the same Profit & Loss module. The page route is guarded by
    // `pnl_dashboard` (visible in the permissions UI) while many API endpoints
    // were written against `pnl`. Accept either grant to avoid 403 on users
    // who were given one name but not the other.
    if (!modulePerm && module === 'pnl') {
      modulePerm = permissions.find((p: any) => p.module === 'pnl_dashboard');
    }
    if (!modulePerm && module === 'pnl_dashboard') {
      modulePerm = permissions.find((p: any) => p.module === 'pnl');
    }

    if (!modulePerm) {
      return res.status(403).json({ message: "غير مسموح - ليس لديك صلاحية على هذه الوحدة" });
    }
    
    // Handle both array and string formats for actions
    let actionsArray: string[] = [];
    const rawActions = modulePerm.actions as unknown;
    if (Array.isArray(rawActions)) {
      actionsArray = rawActions;
    } else if (typeof rawActions === 'string') {
      actionsArray = rawActions.replace(/[{}]/g, '').split(',').map((a: string) => a.trim());
    }
    
    if (!actionsArray.includes(effectiveAction)) {
      return res.status(403).json({ message: `غير مسموح - ليس لديك صلاحية ${effectiveAction} على هذه الوحدة` });
    }
    
    next();
  };
};

// Helper to require any of multiple actions (useful for edit/create combined routes)
export const requireAnyPermission = (module: string, actions: string[], contextResolver?: PermissionContextResolver): RequestHandler => {
  return async (req, res, next) => {
    const user = (req as any).currentUser;
    if (user && req.path?.startsWith("/api/marketing/") && (module === "marketing" || module.startsWith("marketing_"))) {
      try {
        if (user.role !== "admin") await getRequestPermissionSnapshot(req, user.id);
        const { enforceMarketingScope } = await import("./marketing-scope");
        return await enforceMarketingScope(req, res, next, module, actions);
      } catch { return res.status(503).json({ message: "تعذر التحقق من صلاحيات التسويق" }); }
    }
    if (user?.role === "admin") return next();
    if (user) {
      try {
        if (await enforceContextualPermission(req, res, next, module, actions, contextResolver)) return;
      } catch (error) {
        return res.status(503).json({ message: "تعذر التحقق من الصلاحيات أو نطاق المورد. يلزم إعداد مصدر الصلاحيات وترحيل 050 قبل النشر." });
      }
    }
    let permittedActions = actions;
    if (user?.role === "warehouse_keeper") {
      const allowed = (req as any).authPermissions ?? await getWarehouseKeeperEffectivePermissions(user.id, await storage.getUserPermissions(user.id, { bypassCache: true }));
      return allowed.some((p: any) => p.module === module && actions.some((action) => p.actions.includes(action)))
        ? next() : res.status(403).json({ message: "غير مسموح - صلاحية أمين المستودعات محدودة بالمستودع الرئيسي" });
    }
    if (!user) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    
    // Admin has full access
    if (user.role === "admin") {
      return next();
    }
    
    // SECURITY: Attendance clerk has ONLY attendance_check permissions
    if (user.role === "attendance_clerk") {
      const allowedActions = ["view", "create", "edit"];
      if (module === "attendance_check" && actions.some(a => allowedActions.includes(a))) {
        return next();
      }
      logSecurityAlert({
        alertType: 'permission_denied',
        severity: 'high',
        userId: user.id,
        userName: user.username,
        module,
        action: actions.join(','),
        attemptedResource: req.originalUrl,
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'],
      });
      return res.status(403).json({ message: "غير مسموح - مسجل الحضور لديه صلاحية تسجيل الحضور فقط" });
    }
    
    // Viewer can only view
    if (user.role === "viewer") {
      if (!actions.includes("view")) {
        return res.status(403).json({ message: "غير مسموح - المشاهد يمكنه العرض فقط" });
      }
    }

    if (actions.some((action) => deliveryEmployeeActions(user, module).includes(action))) return next();
    
    // Same finite HR-manager action breadth as requirePermission.
    if (user.role === "hr_manager" && HR_MANAGER_MODULES.has(module)
      && actions.some(a => (MODULE_ACTIONS as readonly string[]).includes(a))) {
      return next();
    }

    // HR Specialist: grant when ANY requested action is in the specialist's
    // allowed actions for this module (mirrors requirePermission above).
    if (user.role === "hr_specialist") {
      const allowed = HR_SPECIALIST_PERMISSIONS[module];
      if (allowed && actions.some((a) => allowed.includes(a))) {
        return next();
      }
    }

    if (user.role === "production_development_manager") {
      const allowed = PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS[module];
      if (allowed && actions.some((action) => allowed.includes(action))) return next();
    }

    // Financial Manager: grant when ANY requested action is allowed for this module
    // (mirrors requirePermission above).
    if (user.role === "financial_manager") {
      const allowed = financialManagerActionsFor(module);
      if (allowed && actions.some((a) => allowed.includes(a))) {
        return next();
      }
    }

    // Operations Manager: grant when ANY requested action is allowed for this module
    // (mirrors requirePermission above).
    if (user.role === "operations_manager") {
      // Hard-denied legacy modules cannot be restored by historical direct grants.
      if (isRoleModuleDenied(user.role, module)) {
        return res.status(403).json({ error: "استخدم صلاحيات موارد التشغيل المحددة" });
      }
      const denied = await operationsPermissionDenials(req);
      permittedActions = actions.filter(action => !denied.has(`${module}:${action}`));
      if (!permittedActions.length) return res.status(403).json({ error: "تم سحب صلاحيات هذه الإجراءات" });
      const allowed = operationsManagerActionsFor(module);
      if (allowed && permittedActions.some((a) => allowed.includes(a))) {
        return next();
      }
    }
    
    const permissions = (req as any).authPermissions ?? (
      user.role === "branch_manager"
        ? await getBranchManagerEffectivePermissions(user.id, await storage.getUserPermissions(user.id, { bypassCache: true }))
        : await storage.getUserPermissions(user.id, { bypassCache: true })
    );
    let modulePerm = permissions.find((p: any) => p.module === module);

    // Backward compatibility synonyms (mirrors requirePermission above).
    if (!modulePerm && module === 'attendance_check') {
      modulePerm = permissions.find((p: any) => p.module === 'attendance');
    }
    if (!modulePerm && module === 'pnl') {
      modulePerm = permissions.find((p: any) => p.module === 'pnl_dashboard');
    }
    if (!modulePerm && module === 'pnl_dashboard') {
      modulePerm = permissions.find((p: any) => p.module === 'pnl');
    }

    if (!modulePerm) {
      return res.status(403).json({ message: "غير مسموح - ليس لديك صلاحية على هذه الوحدة" });
    }
    
    const hasAnyAction = permittedActions.some(action => modulePerm.actions.includes(action));
    if (!hasAnyAction) {
      return res.status(403).json({ message: "غير مسموح - صلاحيات غير كافية" });
    }
    
    next();
  };
};

// Get active branch ID from request - returns null for admins (can see all) or the active branch for regular users
export function getActiveBranchFilter(req: any): string | null {
  const user = req.currentUser;
  const constraint = getPermissionScopeConstraint(req);
  if (user?.role !== "admin" && constraint?.branchIds !== undefined && constraint.branchIds !== null) {
    return constraint.branchIds.includes(req.session?.activeBranchId) ? req.session.activeBranchId
      : constraint.branchIds.length === 1 ? constraint.branchIds[0] : "__no_authorized_branch__";
  }
  if (user?.role === "warehouse_keeper") return "main_warehouse";
  if (user?.role === "operations_manager") {
    const allowed = getAllowedBranchIds(req)!;
    return allowed.includes(req.session?.activeBranchId) ? req.session.activeBranchId
      : allowed.length === 1 ? allowed[0] : "__no_authorized_branch__";
  }
  // Admin can see all branches - return null means no filter
  if (user?.role === "admin") {
    // But if admin has selected a specific branch, filter by it
    return req.session?.activeBranchId || null;
  }
  // Regular users: use session activeBranchId, or fall back to user's default branch
  return req.session?.activeBranchId || user?.branchId || null;
}

// Check if user can access/write to a specific branch
export async function canAccessBranch(req: any, branchId: string): Promise<boolean> {
  const user = req.currentUser;
  if (!user) return false;
  if (user.role === "admin") return true;
  const constraint = getPermissionScopeConstraint(req);
  if (constraint?.branchIds !== undefined && constraint.branchIds !== null) {
    return constraint.branchIds.includes(branchId);
  }
  if (constraint && req.authPermissionDecisionSnapshot && !constraint.actions.some(action =>
    contextualActionAllowed(req, req.authPermissionDecisionSnapshot, constraint.module, action, { branchId }))) return false;
  if (user.role === "business_owner") {
    const grants = await storage.getUserBranchAccess(user.id);
    return grants.some(grant => grant.branchId === branchId);
  }
  if (user.role === "warehouse_keeper") return branchId === "main_warehouse";
  
  // Admin can access all branches
  if (user.role === "admin") return true;

  // Financial Manager is a cross-branch role — can access every branch. Module-level
  // requirePermission still governs WHAT they can do; this only governs WHICH branch.
  if (user.role === "financial_manager" || user.role === "production_development_manager") return true;

  // Operations Manager: request-local, DB-fresh explicit grants only.
  if (user.role === "operations_manager") {
    const opsBranches = await storage.getUserBranchAccess(user.id);
    return branchId !== "main_warehouse" && opsBranches.some((access: any) => access.branchId === branchId);
  }
  
  // Check if user has the required permission for the module linked to this branch
  // Users with event_pos permissions should access EVENT-BB branch
  if (branchId === "EVENT-BB" && user.role !== "branch_manager") {
    const hasEventPosAccess = await storage.hasPermission(user.id, "event_pos", "view");
    if (hasEventPosAccess) {
      return true;
    }
  }
  
  // Use pre-loaded branch access from middleware (more efficient)
  const userBranches = req.userBranchAccess || await storage.getUserBranchAccess(user.id);
  
  // If user has explicit branch access, check if this branch is in the list
  if (userBranches.length > 0) {
    return userBranches.some((b: any) => b.branchId === branchId);
  }
  
  // No explicit access defined - fall back to user's assigned branchId
  return user.branchId === branchId;
}

// Middleware to ensure user has branch access before write operations
export const requireBranchAccess: RequestHandler = async (req, res, next) => {
  const user = (req as any).currentUser;
  if (!user) {
    return res.status(401).json({ message: "غير مصرح" });
  }
  
  // Admin can access all branches
  if (user.role === "admin") {
    return next();
  }
  
  // Get the branch from request body or query
  const branchId = req.body?.branchId || req.query?.branchId;
  
  if (!branchId) {
    if (user.role === "warehouse_keeper") {
      if (req.body) req.body.branchId = "main_warehouse";
      return next();
    }
    // If no branch specified, check if user has an active branch
    if (!req.session?.activeBranchId) {
      return res.status(400).json({ message: "يجب تحديد الفرع" });
    }
    // Never trust a stale session branch when a grant has been revoked.
    if (user.role === "operations_manager" && !(await canAccessBranch(req, req.session.activeBranchId))) {
      return res.status(403).json({ message: "ليس لديك صلاحية للوصول لهذا الفرع" });
    }
    // Inject active branch into request body
    if (req.body) {
      req.body.branchId = req.session.activeBranchId;
    }
    return next();
  }
  
  // Verify user has access to the specified branch
  const hasAccess = await canAccessBranch(req as any, branchId);
  if (!hasAccess) {
    return res.status(403).json({ message: "ليس لديك صلاحية للوصول لهذا الفرع" });
  }
  
  next();
};

// CRITICAL: Get mandatory branch filter for non-admin users
// This function returns:
// - For admins: null (can see all) OR activeBranchId if they selected one
// - For non-admins with all_branches access: null (can see all) OR activeBranchId if selected
// - For non-admins without all_branches: their activeBranchId or default branchId (NEVER null)
// Use this for ALL data retrieval to enforce branch isolation
export function getMandatoryBranchFilter(req: any): string | null {
  const user = req.currentUser;
  if (!user) return null;
  const constraint = getPermissionScopeConstraint(req);
  if (user.role !== "admin" && constraint?.branchIds !== undefined && constraint.branchIds !== null) {
    return constraint.branchIds.includes(req.session?.activeBranchId) ? req.session.activeBranchId
      : constraint.branchIds.length === 1 ? constraint.branchIds[0] : "__no_authorized_branch__";
  }
  if (user.role === "warehouse_keeper") return "main_warehouse";
  // This legacy helper cannot express multiple branch IDs. Fail closed rather
  // than returning null (which callers interpret as unrestricted).
  if (user.role === "operations_manager") {
    const allowed = getAllowedBranchIds(req)!;
    return allowed.includes(req.session?.activeBranchId) ? req.session.activeBranchId
      : allowed.length === 1 ? allowed[0] : "__no_authorized_branch__";
  }
  
  // Admin can see all branches unless they selected a specific one
  if (user.role === "admin") {
    return req.session?.activeBranchId || null;
  }
  
  // Check if user has explicit branch access (all_branches was selected)
  const userBranchAccess = req.userBranchAccess || [];
  if (userBranchAccess.length > 0) {
    // User has explicit branch access - they can see all their assigned branches
    // If they have an active branch selected, use it; otherwise null means all their branches
    return req.session?.activeBranchId || null;
  }
  
  // Non-admins without explicit access MUST have a branch filter - never return null
  const branchFilter = req.session?.activeBranchId || user.branchId;
  
  // If somehow no branch is assigned, this is a security issue - log it
  if (!branchFilter) {
    console.error(`SECURITY: User ${user.id} has no branch assigned!`);
  }
  
  return branchFilter || null;
}

// Check if user is admin (can see all branches)
export function isUserAdmin(req: any): boolean {
  const user = req.currentUser;
  return user?.role === "admin";
}

// Get list of branch IDs that user has access to
// Returns null if user can access ALL branches (admin or has all_branches access)
// Returns array of branch IDs if user has limited access
export function getAllowedBranchIds(req: any): string[] | null {
  if (req.currentUser?.role === "admin") return null;
  const constraint = getPermissionScopeConstraint(req);
  if (constraint?.branchIds !== undefined && constraint.branchIds !== null) return [...constraint.branchIds];
  const legacy = getLegacyAllowedBranchIds(req);
  if (!constraint || !req.authPermissionDecisionSnapshot || legacy === null) return legacy;
  return legacy.filter(branchId => constraint.actions.some(action =>
    contextualActionAllowed(req, req.authPermissionDecisionSnapshot, constraint.module, action, { branchId })));
}

function getLegacyAllowedBranchIds(req: any): string[] | null {
  const user = req.currentUser;
  if (!user) return [];
  if (user.role === "business_owner") return (req.userBranchAccess || []).map((grant: any) => grant.branchId);
  if (user.role === "warehouse_keeper") return ["main_warehouse"];
  
  // Admin can see all branches
  if (user.role === "admin") {
    return null; // null means all branches
  }

  // Financial Manager: نطاق مالي على مستوى المنشأة — يرى ويعتمد عبر كل الفروع.
  // تبقى الوحدات مقيّدة بقالب صلاحياته (مالية + موارد بشرية للقراءة)، فالتوسّع هنا
  // على مستوى الفرع فقط لا على مستوى الوحدات.
  if (user.role === "financial_manager" || user.role === "production_development_manager") {
    return null; // كل الفروع
  }

  // Operations Manager: no default-branch or all-branch fallback. isAuthenticated
  // loads these grants from the database on EVERY request.
  if (user.role === "operations_manager") {
    const opsAccess = req.userBranchAccess || [];
    return Array.isArray(opsAccess) ? opsAccess.map((access: any) => access.branchId).filter((id: string) => id !== "main_warehouse") : [];
  }
  
  // Check if user has explicit branch access
  const userBranchAccess = req.userBranchAccess || [];
  const assignedBranches: string[] = getPermissionScopeConstraint(req)
    ? (req.authPermissionDecisionSnapshot?.branchTemplates ?? []).map((base: any) => base.branchId) : [];
  if (userBranchAccess.length > 0) {
    // Return the list of branch IDs user has access to
    return [...new Set([...userBranchAccess.map((access: any) => access.branchId), ...assignedBranches])] as string[];
  }
  
  // Non-admins without explicit access - use their default branchId
  if (user.branchId) {
    return [...new Set([user.branchId, ...assignedBranches])];
  }
  
  // No access
  return assignedBranches;
}

// Check if user has access to multiple branches (not just one)
export function hasMultiBranchAccess(req: any): boolean {
  const allowedBranches = getAllowedBranchIds(req);
  return allowedBranches === null || allowedBranches.length > 1;
}

// Get effective branch filter for queries - handles multi-branch users correctly
// Returns: { branchIds: string[] | null, queryBranchId: string | null }
// branchIds = null means all branches (admin only)
// branchIds = [] means no access
// branchIds = [...] means filter by these branches
export function getEffectiveBranchFilter(req: any, queryBranchId?: string): {
  branchIds: string[] | null;
  singleBranchId: string | null;
  hasAccess: boolean;
} {
  const allowedBranches = getAllowedBranchIds(req);
  
  // Admin with no filter
  if (allowedBranches === null) {
    if (queryBranchId && queryBranchId !== "all") {
      return { branchIds: [queryBranchId], singleBranchId: queryBranchId, hasAccess: true };
    }
    return { branchIds: null, singleBranchId: null, hasAccess: true };
  }
  
  // No access at all
  if (allowedBranches.length === 0) {
    return { branchIds: [], singleBranchId: null, hasAccess: false };
  }
  
  // User has specific branches
  if (queryBranchId && queryBranchId !== "all") {
    // Verify user has access to requested branch
    if (allowedBranches.includes(queryBranchId)) {
      return { branchIds: [queryBranchId], singleBranchId: queryBranchId, hasAccess: true };
    }
    // User doesn't have access to requested branch
    return { branchIds: [], singleBranchId: null, hasAccess: false };
  }
  
  // Return all allowed branches
  if (allowedBranches.length === 1) {
    return { branchIds: allowedBranches, singleBranchId: allowedBranches[0], hasAccess: true };
  }
  
  return { branchIds: allowedBranches, singleBranchId: null, hasAccess: true };
}
