import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import { db } from "./db";
import { systemAuditLogs } from "@shared/schema";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    activeBranchId?: string;
    lastActivity?: number;
  }
}

const isProduction = process.env.NODE_ENV === "production";

// Parse User-Agent to extract device info
function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
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

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "تم تجاوز عدد محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
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
      maxAge: sessionTtl,
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
  const host = req.get("host");
  
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const expectedHosts = [
        host,
        "localhost:5000",
        "0.0.0.0:5000",
      ];
      
      if (host && !expectedHosts.some(h => originUrl.host === h || originUrl.host.endsWith(`.${h}`))) {
        console.warn(`Origin validation failed: ${origin} vs ${host}`);
        return res.status(403).json({ error: "طلب غير مصرح من مصدر خارجي" });
      }
    } catch (e) {
      console.warn(`Invalid origin header: ${origin}`);
      return res.status(403).json({ error: "طلب غير مصرح" });
    }
  }
  
  next();
};

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  
  app.use("/api", apiRateLimiter);
  app.use("/api", validateOrigin);

  app.post("/api/auth/login", loginRateLimiter, async (req, res) => {
    try {
      const { username, password, rememberMe } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      }

      const user = await storage.verifyPassword(username, password);
      if (!user) {
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      // Security check: Prevent inactive users from logging in
      if (user.isActive === "inactive") {
        return res.status(403).json({ error: "حسابك معطّل. يرجى التواصل مع المسؤول." });
      }

      req.session.regenerate(async (regenerateErr) => {
        try {
          if (regenerateErr) {
            console.error("Session regenerate error:", regenerateErr);
            return res.status(500).json({ error: "فشل تسجيل الدخول" });
          }
          
          req.session.userId = user.id;
          req.session.lastActivity = Date.now();
          
          if (rememberMe) {
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
          } else {
            req.session.cookie.maxAge = 8 * 60 * 60 * 1000;
          }
        
          const userBranches = await storage.getUserBranchAccess(user.id);
          const defaultBranch = userBranches.find(b => b.isDefault) || userBranches[0];
          req.session.activeBranchId = defaultBranch?.branchId || undefined;
          
          req.session.save(async (saveErr) => {
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
              try {
                await storage.createSystemAuditLog({
                  module: "users",
                  entityId: user.id,
                  entityName: displayName,
                  action: "login",
                  details: `تسجيل دخول ناجح${rememberMe ? ' (تذكرني)' : ''}`,
                  userId: user.id,
                  userName: displayName,
                  ipAddress: req.ip || req.socket?.remoteAddress,
                  userAgent: req.headers['user-agent'],
                });
                
                // Create user session record with device info
                const userAgentStr = req.headers['user-agent'] || '';
                const deviceInfo = parseUserAgent(userAgentStr);
                const sessionExpiry = rememberMe 
                  ? new Date(Date.now() + 24 * 60 * 60 * 1000) 
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
              } catch (logError) {
                console.error("Failed to create audit log for login:", logError);
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
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "حدث خطأ أثناء تسجيل الدخول" });
    }
  });

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.json(null);
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.json(null);
      }

      // Security check: Auto-logout if user has been deactivated
      if (user.isActive === "inactive") {
        req.session.destroy(() => {});
        return res.status(403).json({ error: "حسابك معطّل. يرجى التواصل مع المسؤول." });
      }

      const { password: _, ...safeUser } = user;
      
      // Parallel fetch for better performance
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
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "فشل تغيير الفرع" });
        }
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
        await storage.createSystemAuditLog({
          module: "users",
          entityId: userId,
          entityName: userName,
          action: "logout",
          details: "تسجيل خروج",
          userId: userId,
          userName: userName,
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

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    // Log unauthorized access attempt
    logSecurityAlert({
      alertType: 'unauthorized_access',
      severity: 'low',
      attemptedResource: req.originalUrl,
      ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'],
    });
    return res.status(401).json({ message: "غير مصرح" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: "غير مصرح" });
  }

  // Security: Block inactive users from accessing any protected API
  if (user.isActive === "inactive") {
    // Log inactive user attempt
    logSecurityAlert({
      alertType: 'unauthorized_access',
      severity: 'medium',
      userId: user.id || undefined,
      userName: user.username || undefined,
      action: 'inactive_user_access',
      attemptedResource: req.originalUrl,
      ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'],
    });
    req.session.destroy(() => {});
    return res.status(403).json({ message: "حسابك معطّل. يرجى التواصل مع المسؤول." });
  }

  // Load user's branch access permissions
  const branchAccess = await storage.getUserBranchAccess(user.id);
  (req as any).currentUser = user;
  (req as any).userBranchAccess = branchAccess;
  (req as any).hasAllBranchesAccess = branchAccess.length > 0; // User has explicit branch access
  
  // Update session activity for online tracking (async, don't wait)
  if (req.sessionID) {
    storage.updateSessionActivity(req.sessionID).catch(() => {});
  }
  
  next();
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

// New middleware for granular permission checking
export const requirePermission = (module: string, action: string): RequestHandler => {
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
      if (module === "attendance_check" && ["view", "create", "edit"].includes(action)) {
        
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
    
    // Check granular permissions from database
    const permissions = await storage.getUserPermissions(user.id);
    let modulePerm = permissions.find((p: any) => p.module === module);
    
    // Backward compatibility: attendance_check also accepts attendance permission
    if (!modulePerm && module === 'attendance_check') {
      modulePerm = permissions.find((p: any) => p.module === 'attendance');
    }
    
    // Backward compatibility: smart_incentives_* modules also accept parent "incentives" permission
    if (!modulePerm && module.startsWith('smart_incentives_')) {
      modulePerm = permissions.find((p: any) => p.module === 'incentives');
    }
    
    if (!modulePerm) {
      // Log security alert
      logSecurityAlert({
        alertType: 'permission_denied',
        severity: 'medium',
        userId: user.id,
        userName: user.username,
        module,
        action,
        attemptedResource: req.originalUrl,
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'],
      });
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
    
    if (!actionsArray.includes(action)) {
      // Log security alert
      logSecurityAlert({
        alertType: 'permission_denied',
        severity: 'low',
        userId: user.id,
        userName: user.username,
        module,
        action,
        attemptedResource: req.originalUrl,
        ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
        userAgent: req.headers['user-agent'],
      });
      return res.status(403).json({ message: `غير مسموح - ليس لديك صلاحية ${action} على هذه الوحدة` });
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
    
    // Check granular permissions from database
    const permissions = await storage.getUserPermissions(user.id);
    let modulePerm = permissions.find((p: any) => p.module === module);
    
    // Backward compatibility: smart_incentives_* modules also accept parent "incentives" permission
    if (!modulePerm && module.startsWith('smart_incentives_')) {
      modulePerm = permissions.find((p: any) => p.module === 'incentives');
    }
    
    if (!modulePerm) {
      return res.status(403).json({ message: "غير مسموح - ليس لديك صلاحية على هذه الوحدة" });
    }
    
    const hasAnyAction = actions.some(action => modulePerm!.actions.includes(action));
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
    console.error(`SECURITY: User ${user.id} (${user.username}) has no branch assigned!`);
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
