import type { OperationsMonthAction, OperationsMonthCommand, OperationsMonthCommandResult } from "@shared/operations-month-workflow";

/** A mismatched/malformed response is not proof of failure or safe to resend. */
export function readMonthCommandResult(
  value: unknown,
  expected: { action: OperationsMonthAction; body: OperationsMonthCommand },
): OperationsMonthCommandResult {
  const result = value as OperationsMonthCommandResult | null;
  const saved = result?.command;
  if (!saved || saved.committed !== true || saved.branchId !== expected.body.branchId ||
      saved.month !== expected.body.month || saved.action !== expected.action ||
      !Number.isSafeInteger(saved.revision) || saved.revision < 0 || typeof saved.changed !== "boolean" ||
      !["available", "partial", "unavailable"].includes(result!.refresh) ||
      typeof result!.message !== "string" || !result!.message ||
      (result!.refresh === "unavailable" ? result!.workflow !== null : !result!.workflow) ||
      (result!.workflow && (result!.workflow.branchId !== saved.branchId || result!.workflow.month !== saved.month))) {
    throw new Error("لم يصل تأكيد موثوق للحفظ؛ حدّث ملف الشهر للتحقق قبل إعادة إرسال أي إجراء.");
  }
  return result!;
}