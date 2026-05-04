import type { Request } from "express";
import { storage } from "./storage";

// ============================================================
// Phase 9: Approval Thresholds (env-overridable)
// ============================================================
// المبالغ المرجعية لتطبيق سياسة الموافقة:
// - amount >= MEDIUM => يجب إرفاق فاتورة + رقم فاتورة
// - amount >= LARGE  => يحتاج صلاحية موافقة كبار + ملاحظة تبرير
export const APPROVAL_THRESHOLDS = {
  medium: Number(process.env.APPROVAL_MEDIUM_AMOUNT || 5000),
  large: Number(process.env.APPROVAL_LARGE_AMOUNT || 50000),
  variationPercent: Number(process.env.VARIATION_LARGE_PERCENT || 10),
};

export function getApprovalThresholds() {
  return { ...APPROVAL_THRESHOLDS };
}

// ============================================================
// Audit logging helper — wraps storage.createSystemAuditLog
// Never throws; logging failures shouldn't break the main flow.
// ============================================================
export async function auditEvent(params: {
  req: Request;
  module: string;        // "contracts" | "payment_requests" | "contract_variations" | ...
  entityId: string | number;
  action: string;        // "create" | "update" | "delete" | "approve" | "reject" | "mark_paid" | ...
  entityName?: string;
  description?: string;
  details?: Record<string, any>;
  targetId?: string | number;
}): Promise<void> {
  try {
    const user: any = (params.req as any).currentUser || null;
    await storage.createSystemAuditLog({
      module: params.module,
      entityId: String(params.entityId),
      entityName: params.entityName || null,
      action: params.action,
      details: params.details ? JSON.stringify(params.details) : null,
      userId: user?.id || null,
      userName: user?.fullName || user?.username || null,
      targetId: params.targetId != null ? String(params.targetId) : null,
      description: params.description || null,
      ipAddress: (params.req.headers["x-forwarded-for"] as string) || params.req.socket?.remoteAddress || null,
      userAgent: params.req.headers["user-agent"] || null,
    } as any);
  } catch (e) {
    console.error("[audit] logging failed:", e);
  }
}
