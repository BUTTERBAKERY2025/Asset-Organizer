import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { db } from "./db";
import { systemAuditLogs, ROLE_PERMISSION_TEMPLATES } from "@shared/schema";
import { isLoginBlocked, trackLoginAttempt } from "./security";
import {
  getTwoFactorConfig,
  issueOtpForUser,
  verifyOtpForUser,
  logShareholderActivity,
} from "./shareholder-security";

// ============================================================
// HIGH-PERFORMANCE IN-MEMORY CACHE FOR AUTH MIDDLEWARE
// Eliminates repeated DB queries for user, branch access, and permissions
// ============================================================
interface CachedUserData {
  user: any;
  branchAccess: any[];
  permissions: any[];
  timestamp: number;
}

const AUTH_CACHE_TTL = 60_000; // 30 seconds - balance between performance and freshness
const PERMISSIONS_CACHE_TTL = 120_000; // 1 minute for permissions (change less frequently)
const authCache = new Map<string, CachedUserData>();

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(authCache.entries());
  for (const [key, val] of entries) {
    if (now - val.timestamp > AUTH_CACHE_TTL * 2) {
      authCache.delete(key);
    }
  }
}, 60_000);

function getCachedAuth(userId: string): CachedUserData | null {
  const cached = authCache.get(userId);
  if (cached && Date.now() - cached.timestamp < AUTH_CACHE_TTL) {
    return cached;
  }
  return null;
}

function getCachedPermissions(userId: string): any[] | null {
  const cached = authCache.get(userId);
  if (cached && Date.now() - cached.timestamp < PERMISSIONS_CACHE_TTL) {
    return cached.permissions;
  }
  return null;
}

export function getCachedPermissionsForUser(userId: string): any[] | null {
  return getCachedPermissions(userId);
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
  if (user.role === "admin") return true;
  if (user.role === "hr_manager") return true;
  if (user.role === "hr_specialist") return true;
  const perms = getCachedPermissionsForUser(user.id) || [];
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
// NOTE: many HR routes call requirePermission(module) WITHOUT an action arg
// (action === undefined). For those, presence of the module in this map grants
// access. Routes that DO pass an action (e.g. branch_employees create/edit/delete)
// are enforced against the listed actions, so view-only modules stay view-only.
export const HR_SPECIALIST_PERMISSIONS: Record<string, string[]> = {
  hr_management: ["view"],
  hr_leaves: ["view", "create", "edit", "export"],
  hr_documents: ["view", "create", "edit", "export"],
  hr_warnings: ["view", "create", "edit", "export"],
  hr_advances: ["view", "create", "edit", "export"],
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

function setCachedAuth(userId: string, user: any, branchAccess: any[], permissions: any[]) {
  authCache.set(userId, { user, branchAccess, permissions, timestamp: Date.now() });
}

export function invalidateAuthCache(userId?: string) {
  if (userId) {
    authCache.delete(userId);
  } else {
    authCache.clear();
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    activeBranchId?: string;
    lastActivity?: number;
    fingerprint?: string;
    createdAt?: number;
    ipAddress?: string;
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
  opts?: { twoFactor?: boolean },
) {
  req.session.regenerate(async (regenerateErr: any) => {
    try {
      if (regenerateErr) {
        console.error("Session regenerate error:", regenerateErr);
        return res.status(500).json({ error: "فشل تسجيل الدخول" });
      }

      req.session.userId = user.id;
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

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "تم تجاوز عدد محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة." },
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

export function getSession() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  
  const sessionTtl = 8 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl / 1000,
    tableName: "sessions",
    pruneSessionInterval: 60,
  });
  return session({
    secret: sessionSecret,
    store: sessionStore,
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

      const user = await storage.verifyPassword(username, password);
      if (!user) {
        trackLoginAttempt(clientIp, false);
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

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
            req.session.save((saveErr) => {
              if (saveErr) {
                console.error("Session save (2FA) error:", saveErr);
                return res.status(500).json({ error: "فشل تسجيل الدخول" });
              }
              return res.json({ otpRequired: true, phone: issued.phone, channel: issued.channel });
            });
          });
        }
      }

      return establishSession(req, res, user, !!rememberMe, clientIp);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
    }
  });

  // المرحلة 5: التحقق من رمز OTP لإكمال دخول المساهم
  app.post("/api/auth/verify-otp", loginRateLimiter, async (req, res) => {
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
      const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
      delete req.session.pendingTwoFactor;
      return establishSession(req, res, user, rememberMe, clientIp, { twoFactor: true });
    } catch (error) {
      console.error("verify-otp error:", error);
      res.status(500).json({ error: "حدث خطأ أثناء التحقق" });
    }
  });

  // المرحلة 5: إعادة إرسال رمز OTP (مع ضوابط التكرار)
  app.post("/api/auth/resend-otp", loginRateLimiter, async (req, res) => {
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
      const cached = getCachedAuth(userId);
      
      if (cached) {
        const { password: _, ...safeUser } = cached.user;
        
        if (safeUser.isActive === "inactive") {
          invalidateAuthCache(userId);
          req.session.destroy(() => {});
          return res.status(403).json({ error: "حسابك معطّل. يرجى التواصل مع المسؤول." });
        }

        const activeBranch = req.session.activeBranchId 
          ? await storage.getBranch(req.session.activeBranchId) 
          : null;
        
        return res.json({
          ...safeUser,
          activeBranchId: req.session.activeBranchId || null,
          activeBranch,
          allowedBranches: cached.branchAccess,
        });
      }

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
      
      const [userBranches, activeBranch] = await Promise.all([
        storage.getUserBranchAccess(user.id),
        req.session.activeBranchId ? storage.getBranch(req.session.activeBranchId) : Promise.resolve(null)
      ]);
      
      res.json({
        ...safeUser,
        activeBranchId: req.session.activeBranchId || null,
        activeBranch,
        allowedBranches: userBranches,
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
      const cached = getCachedAuth(userId);
      
      let user: any, userBranches: any[], activeBranch: any, permissions: any[];
      
      const allBranchesPromise = storage.getAllBranches();

      if (cached) {
        const { password: _, ...safeUser } = cached.user;
        user = safeUser;
        userBranches = cached.branchAccess;
        activeBranch = req.session.activeBranchId 
          ? cached.branchAccess.find((b: any) => b.branchId === req.session.activeBranchId)
            ? await storage.getBranch(req.session.activeBranchId) : null
          : null;
        permissions = cached.permissions || [];
      } else {
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
      }
      
      const allBranches = await allBranchesPromise;
      let filteredBranches: any[] = [];
      if (user.role === "admin" || user.role === "financial_manager" || user.role === "operations_manager") {
        // Financial Manager & Operations Manager are cross-branch roles — see every branch org-wide.
        filteredBranches = allBranches;
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
          const { getCachedPermissionsForUser } = await import("./auth");
          permissions = getCachedPermissionsForUser(userId) || [];
          if (permissions.length === 0) {
            const userPerms = await storage.getUserPermissions(userId);
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
      }
      
      res.json({
        user: {
          ...user,
          activeBranchId: req.session.activeBranchId || null,
          activeBranch,
          allowedBranches: userBranches,
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
      if (!hasAccess && userBranches.length > 0 && user?.role !== "admin") {
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
  app.post("/api/auth/verify-password", async (req, res) => {
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

  // Check in-memory cache first (eliminates DB queries for 30s)
  const cached = getCachedAuth(userId);
  if (cached) {
    const user = cached.user;
    if (user.isActive === "inactive") {
      invalidateAuthCache(userId);
      req.session.destroy(() => {});
      return res.status(403).json({ message: "حسابك معطّل. يرجى التواصل مع المسؤول." });
    }
    (req as any).currentUser = user;
    (req as any).userBranchAccess = cached.branchAccess;
    (req as any).hasAllBranchesAccess = cached.branchAccess.length > 0;
    
    // Throttled session activity update (also on cache hits)
    if (req.sessionID) {
      const lastUpdate = sessionActivityThrottle.get(req.sessionID);
      if (!lastUpdate || now - lastUpdate > 60_000) {
        sessionActivityThrottle.set(req.sessionID, now);
        storage.updateSessionActivity(req.sessionID).catch(() => {});
      }
    }
    return next();
  }

  // Cache miss - fetch from DB (parallel queries)
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
  let permissions: any[] = [];
  if (user.role !== "admin") {
    permissions = await storage.getUserPermissions(userId);
  }

  // Store in cache
  setCachedAuth(userId, user, branchAccess, permissions);

  (req as any).currentUser = user;
  (req as any).userBranchAccess = branchAccess;
  (req as any).hasAllBranchesAccess = branchAccess.length > 0;
  
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

// New middleware for granular permission checking
export const requirePermission = (module: string, action?: string): RequestHandler => {
  return async (req, res, next) => {
    const user = (req as any).currentUser;
    if (!user) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    
    // Admin has full access
    if (user.role === "admin") {
      return next();
    }
    
    // SECURITY: Attendance clerk has ONLY attendance_check permissions
    if (user.role === "attendance_clerk") {
      if (module === "attendance_check" && action != null && ["view", "create", "edit"].includes(action)) {
        
        return next();
      }
      
      logSecurityAlert({
        alertType: 'permission_denied',
        severity: 'high',
        userId: user.id,
        userName: user.username,
        module,
        action,
        attemptedResource: req.originalUrl,
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'],
      });
      return res.status(403).json({ message: "غير مسموح - مسجل الحضور لديه صلاحية تسجيل الحضور فقط" });
    }
    
    // Viewer can only view
    if (user.role === "viewer") {
      if (action !== "view") {
        return res.status(403).json({ message: "غير مسموح - المشاهد يمكنه العرض فقط" });
      }
    }
    
    // HR Manager role: auto-grants access to all HR modules across all branches.
    // Strictly scoped to HR — financial, inventory, sales, etc. still go through
    // the standard permission check below and remain branch-isolated.
    if (user.role === "hr_manager" && HR_MANAGER_MODULES.has(module)) {
      return next();
    }

    // HR Specialist role: narrower, action-aware HR access. Modules not in the
    // map fall through to the standard explicit-permission check below (so an
    // admin can still grant extra modules to an individual specialist).
    if (user.role === "hr_specialist") {
      const allowed = HR_SPECIALIST_PERMISSIONS[module];
      if (allowed && (action == null || allowed.includes(action))) {
        return next();
      }
    }

    // Financial Manager role: action-aware auto-grant for finance/HR-read modules
    // across ALL branches (branch scope handled in getAllowedBranchIds). Modules
    // not in the map fall through to the standard explicit-permission check below.
    if (user.role === "financial_manager") {
      const allowed = financialManagerActionsFor(module);
      if (allowed && (action == null || allowed.includes(action))) {
        return next();
      }
    }

    // Operations Manager role: action-aware auto-grant for daily-operations modules
    // across ALL branches (branch scope handled in getAllowedBranchIds). Modules
    // not in the map fall through to the standard explicit-permission check below.
    if (user.role === "operations_manager") {
      const allowed = operationsManagerActionsFor(module);
      if (allowed && (action == null || allowed.includes(action))) {
        return next();
      }
    }
    
    // Use cached permissions (pre-fetched by isAuthenticated middleware)
    const permissions = getCachedPermissions(user.id) || await storage.getUserPermissions(user.id);
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
    
    // When routes call requirePermission(module) without an explicit action,
    // infer a safe action from the HTTP method so module presence alone can
    // NEVER grant write access (GET→view, POST→create, PUT/PATCH→edit,
    // DELETE→delete; unknown methods default to the strictest common action).
    const METHOD_ACTION: Record<string, string> = {
      GET: "view", HEAD: "view", OPTIONS: "view",
      POST: "create", PUT: "edit", PATCH: "edit", DELETE: "delete",
    };
    const effectiveAction = action ?? METHOD_ACTION[req.method] ?? "edit";
    if (!actionsArray.includes(effectiveAction)) {
      return res.status(403).json({ message: `غير مسموح - ليس لديك صلاحية ${effectiveAction} على هذه الوحدة` });
    }
    
    next();
  };
};

// Helper to require any of multiple actions (useful for edit/create combined routes)
export const requireAnyPermission = (module: string, actions: string[]): RequestHandler => {
  return async (req, res, next) => {
    const user = (req as any).currentUser;
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
    
    // HR Manager auto-grants HR modules (shared constant w/ requirePermission)
    if (user.role === "hr_manager" && HR_MANAGER_MODULES.has(module)) {
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
      const allowed = operationsManagerActionsFor(module);
      if (allowed && actions.some((a) => allowed.includes(a))) {
        return next();
      }
    }
    
    // Use cached permissions (pre-fetched by isAuthenticated middleware)
    const permissions = getCachedPermissions(user.id) || await storage.getUserPermissions(user.id);
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
    
    const hasAnyAction = actions.some(action => modulePerm.actions.includes(action));
    if (!hasAnyAction) {
      return res.status(403).json({ message: "غير مسموح - صلاحيات غير كافية" });
    }
    
    next();
  };
};

// Get active branch ID from request - returns null for admins (can see all) or the active branch for regular users
export function getActiveBranchFilter(req: any): string | null {
  const user = req.currentUser;
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
  
  // Admin can access all branches
  if (user.role === "admin") return true;

  // Financial Manager is a cross-branch role — can access every branch. Module-level
  // requirePermission still governs WHAT they can do; this only governs WHICH branch.
  if (user.role === "financial_manager") return true;

  // Operations Manager is a cross-branch role — manages daily operations in every
  // branch. Module-level requirePermission still governs WHAT they can do.
  if (user.role === "operations_manager") return true;
  
  // Check if user has the required permission for the module linked to this branch
  // Users with event_pos permissions should access EVENT-BB branch
  if (branchId === "EVENT-BB") {
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
    // If no branch specified, check if user has an active branch
    if (!req.session?.activeBranchId) {
      return res.status(400).json({ message: "يجب تحديد الفرع" });
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
  const user = req.currentUser;
  if (!user) return [];
  
  // Admin can see all branches
  if (user.role === "admin") {
    return null; // null means all branches
  }

  // Financial Manager: نطاق مالي على مستوى المنشأة — يرى ويعتمد عبر كل الفروع.
  // تبقى الوحدات مقيّدة بقالب صلاحياته (مالية + موارد بشرية للقراءة)، فالتوسّع هنا
  // على مستوى الفرع فقط لا على مستوى الوحدات.
  if (user.role === "financial_manager") {
    return null; // كل الفروع
  }

  // Operations Manager: مدير التشغيل — نطاق تشغيلي على مستوى المنشأة، يدير
  // العمليات اليومية عبر كل الفروع. الوحدات مقيّدة بقالب صلاحياته التشغيلية.
  if (user.role === "operations_manager") {
    return null; // كل الفروع
  }
  
  // Check if user has explicit branch access
  const userBranchAccess = req.userBranchAccess || [];
  if (userBranchAccess.length > 0) {
    // Return the list of branch IDs user has access to
    return userBranchAccess.map((access: any) => access.branchId);
  }
  
  // Non-admins without explicit access - use their default branchId
  if (user.branchId) {
    return [user.branchId];
  }
  
  // No access
  return [];
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
