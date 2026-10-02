import type { AdminAccountAddition, AdminAccountAdditionsResponse } from "@shared/employee-account-delegation";
import { EmployeeAccountRequestError, employeeAccountErrorMessage } from "@/lib/employee-account-delegation";

/** Phase 5 DTOs. Employee and current linked-user ownership are server-resolved. */
export type EmployeeAccountAddition = AdminAccountAddition;
export type EmployeeAccountAdditionsResponse = AdminAccountAdditionsResponse;
export type EmployeeAccountAdditionInput = Pick<AdminAccountAddition, "module" | "action" | "allow" | "scopeType" | "branchId" | "startsAt" | "endsAt" | "reason">;
export interface EmployeeAdditionDraft {
  module: string;
  action: string;
  effect: "" | "allow" | "deny";
  scopeType: "" | "global" | "branch";
  startsAt: string;
  endsAt: string;
  reason: string;
}
export const emptyEmployeeAdditionDraft = (): EmployeeAdditionDraft => ({
  module: "", action: "", effect: "", scopeType: "", startsAt: "", endsAt: "", reason: "",
});
export function additionDateInput(value: string | null) {
  if (!value) return "";
  // Riyadh has a fixed +03:00 offset. Preserve seconds/milliseconds on edits.
  return new Date(new Date(value).getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, -1);
}
export function additionDateMilliseconds(value: string) {
  return new Date(`${value}${value.length === 16 ? ":00" : ""}+03:00`).getTime();
}
export function additionDateISO(value: string) {
  return value ? new Date(additionDateMilliseconds(value)).toISOString() : null;
}
export function additionDateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "غير محدد";
}
export function employeeAdditionError(error: unknown) {
  if (error instanceof EmployeeAccountRequestError) {
    if (error.status === 503 || error.code === "migration_required")
      return "تخزين الإضافات المستقلة غير جاهز. يلزم تطبيق الترحيل 054 بواسطة مسؤول النظام؛ لا يعني هذا عدم وجود إضافات أو حذف الاستثناءات القديمة.";
    if (error.status === 409)
      return `${employeeAccountErrorMessage(error)} — تغيّرت الإضافة. احتفظنا بتعديلاتك؛ حدّث السجل، راجع المحتوى الحالي ثم أكّد مجددًا.`;
  }
  return employeeAccountErrorMessage(error);
}