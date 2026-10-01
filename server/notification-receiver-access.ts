import type { Request } from "express";
import { canAccessBranch, getAllowedBranchIds } from "./auth";
import { storage } from "./storage";

/** Session branch is intent, never a grant. No fallback after an explicit
 * branch is revoked; callers return 403 and clear stale recipient content. */
export async function notificationRecipientBranches(req: Request): Promise<string[]> {
  const allowed = getAllowedBranchIds(req);
  const selected = req.session.activeBranchId;
  if (selected) {
    if (!(await canAccessBranch(req, selected))) {
      throw Object.assign(new Error("فرع الإشعارات المحدد لم يعد مصرحًا به"), { status: 403 });
    }
    if (allowed === null && !(await storage.getBranch(selected))) {
      throw Object.assign(new Error("فرع الإشعارات المحدد غير موجود"), { status: 403 });
    }
    return [selected];
  }
  const primary = req.currentUser?.branchId;
  if (primary && await canAccessBranch(req, primary)) return [primary];
  // Operations accounts commonly have no primary branch. Without explicit
  // active intent, use only their fresh grants, never all system branches.
  if (req.currentUser?.role === "operations_manager") return allowed || [];
  // Empty sentinel preserves branchless global/personal announcements for
  // other roles without treating it as an authorized operational branch.
  return [""];
}