import type { RequestHandler } from "express";

export function isOwnerSessionValid(
  session: { sessionId: string; isActive: boolean; expiresAt: Date | string },
  sessionId: string,
  now = Date.now(),
): boolean {
  return session.sessionId === sessionId && session.isActive === true &&
    new Date(session.expiresAt).getTime() > now;
}

/** Validate the complete selection, never silently discard invalid grants. */
export function validateOwnerBranches(
  branchIds: unknown,
  branchId: unknown,
  existingIds: string[],
  availableIds: string[],
): { ids: string[]; replace: boolean } {
  const available = new Set(availableIds);
  if (branchId === "all_branches") throw new Error("حدد فروع الأونر صراحةً");
  if (branchIds !== undefined && !Array.isArray(branchIds)) {
    throw new Error("يجب إرسال فروع الأونر كقائمة");
  }
  if (branchId !== undefined && branchId !== null && branchId !== "" && branchId !== "none" &&
      (typeof branchId !== "string" || !available.has(branchId))) {
    throw new Error("يوجد فرع غير صالح ضمن فروع الأونر");
  }
  const replace = branchIds !== undefined || branchId !== undefined;
  const selection: unknown[] = branchIds !== undefined ? branchIds as unknown[]
    : branchId !== undefined ? [branchId] : existingIds;
  if (!selection.length) throw new Error("حدد فرعاً صالحاً واحداً على الأقل لحساب الأونر");
  if (selection.some(id => typeof id !== "string" || !available.has(id))) {
    throw new Error("حدد فروعاً صالحة لحساب الأونر؛ أحد الفروع غير موجود");
  }
  return { ids: [...new Set(selection as string[])], replace };
}

/** Fail closed on ambiguous URLs rather than normalizing into a privileged route. */
export function isOwnerRequestAllowed(method: string, url: string): boolean {
  const raw = url.split("?")[0];
  if (/%|\\|\/\/|[\u0000-\u001f]/.test(raw)) return false;
  if (raw.split("/").some(part => part === "." || part === "..")) return false;
  const path = raw.replace(/\/+$/, "");
  if (method === "GET" || method === "HEAD") {
    return path === "/api/auth/me" || path.startsWith("/api/owner/");
  }
  return method === "POST" && path === "/api/auth/logout";
}

/** Read identity afresh on EVERY request, even routes without isAuthenticated. */
export function createOwnerApiLockdown(
  getUser: (id: string) => Promise<{ role: string; isActive: string | null } | undefined>,
  isSessionActive?: (userId: string, sessionId: string) => Promise<boolean>,
): RequestHandler {
  return async (req, res, next) => {
    if (/^\/api\/owner(?:\/|$)/i.test(req.path)) res.set("Cache-Control", "no-store");
    if (!/^\/api(?:\/|$)/i.test(req.path) || !req.session?.userId) return next();
    try {
      const user = await getUser(req.session.userId);
      // Preserve /auth/me's established missing-user/null and inactive/403
      // contract. Existing non-owner auth handlers retain their own policies.
      if ((!user || user.isActive === "inactive") &&
          (req.method === "GET" || req.method === "HEAD") &&
          req.path.replace(/\/+$/, "").toLowerCase() === "/api/auth/me") return next();
      if (!user || (user.role === "business_owner" && user.isActive === "inactive")) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "انتهت صلاحية الحساب أو الجلسة" });
      }
      if (user.role === "business_owner") {
        res.set("Cache-Control", "no-store");
        if (isSessionActive && req.path.replace(/\/+$/, "") !== "/api/auth/logout" &&
            !await isSessionActive(req.session.userId, req.sessionID)) {
          req.session.destroy(() => {});
          return res.status(401).json({ error: "انتهت صلاحية الجلسة" });
        }
        if (!isOwnerRequestAllowed(req.method, req.originalUrl)) {
          return res.status(403).json({ error: "حساب الأونر مخصص للاطلاع عبر بوابته فقط" });
        }
      }
      next();
    } catch {
      res.status(503).json({ error: "تعذر التحقق من صلاحية الحساب" });
    }
  };
}