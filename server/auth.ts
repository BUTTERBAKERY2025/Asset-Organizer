import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    activeBranchId?: string;
  }
}

export function getSession() {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
      sameSite: "none",
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      }

      const user = await storage.verifyPassword(username, password);
      if (!user) {
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }

      req.session.userId = user.id;
      
      // Get user's default branch
      const userBranches = await storage.getUserBranchAccess(user.id);
      const defaultBranch = userBranches.find(b => b.isDefault) || userBranches[0];
      req.session.activeBranchId = defaultBranch?.branchId || undefined;
      
      req.session.save(async (err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "فشل تسجيل الدخول" });
        }
        const { password: _, ...safeUser } = user;
        
        // Get branch details if available
        let activeBranch = null;
        if (req.session.activeBranchId) {
          activeBranch = await storage.getBranch(req.session.activeBranchId);
        }
        
        res.json({
          ...safeUser,
          activeBranchId: req.session.activeBranchId,
          activeBranch,
          allowedBranches: userBranches,
        });
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

      const { password: _, ...safeUser } = user;
      
      // Get user's branches
      const userBranches = await storage.getUserBranchAccess(user.id);
      
      // Get active branch details
      let activeBranch = null;
      if (req.session.activeBranchId) {
        activeBranch = await storage.getBranch(req.session.activeBranchId);
      }
      
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
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "فشل تسجيل الخروج" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: "غير مصرح" });
  }

  (req as any).currentUser = user;
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
    
    // Viewer can only view
    if (user.role === "viewer") {
      if (action !== "view") {
        return res.status(403).json({ message: "غير مسموح - المشاهد يمكنه العرض فقط" });
      }
    }
    
    // Check granular permissions from database
    const permissions = await storage.getUserPermissions(user.id);
    const modulePerm = permissions.find((p: any) => p.module === module);
    
    if (!modulePerm) {
      return res.status(403).json({ message: "غير مسموح - ليس لديك صلاحية على هذه الوحدة" });
    }
    
    if (!modulePerm.actions.includes(action)) {
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
    
    // Viewer can only view
    if (user.role === "viewer") {
      if (!actions.includes("view")) {
        return res.status(403).json({ message: "غير مسموح - المشاهد يمكنه العرض فقط" });
      }
    }
    
    // Check granular permissions from database
    const permissions = await storage.getUserPermissions(user.id);
    const modulePerm = permissions.find((p: any) => p.module === module);
    
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
  // Regular users must have an active branch to see data
  return req.session?.activeBranchId || null;
}

// Check if user can access/write to a specific branch
export async function canAccessBranch(req: any, branchId: string): Promise<boolean> {
  const user = req.currentUser;
  if (!user) return false;
  
  // Admin can access all branches
  if (user.role === "admin") return true;
  
  // Check user's branch access
  const userBranches = await storage.getUserBranchAccess(user.id);
  
  // If no branch restrictions defined, allow access
  if (userBranches.length === 0) return true;
  
  return userBranches.some(b => b.branchId === branchId);
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
