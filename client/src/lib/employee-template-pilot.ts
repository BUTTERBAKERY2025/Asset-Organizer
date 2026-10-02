import type { EmployeeTemplateAssignedResponse, EmployeeTemplatePilotResponse } from "@shared/employee-account-delegation";
import { EmployeeAccountRequestError, employeeAccountErrorMessage } from "@/lib/employee-account-delegation";

export type EmployeeTemplatePilotResult = EmployeeTemplateAssignedResponse & { comparison: EmployeeTemplatePilotResponse };
export interface EmployeeTemplatePilotInput {
  templateId: number;
  version: number;
  branchId: string;
  reason: string;
  expectedComparisonRevision: string;
  acknowledgeChanges: true;
}
export const employeeTemplatePilotEndpoint = (employeeId: number) => `/api/admin/employee-template-pilot/${employeeId}`;

export function employeeTemplatePilotError(error: unknown) {
  if (error instanceof EmployeeAccountRequestError) {
    if (error.status === 503 || error.code === "migration_required")
      return "تخزين القوالب أو الإضافات المطلوب للمقارنة غير جاهز. راجع الترحيلات 050–054 مع مسؤول النظام؛ لم نعتبر الصلاحيات أو الإضافات قائمة فارغة.";
    if (error.status === 409)
      return `${employeeAccountErrorMessage(error)} — تغيّرت المقارنة أو صلاحية بياناتها. احتفظنا بالقالب والسبب؛ أعد المقارنة من الخادم ثم راجع وأكّد مجددًا.`;
    if (error.status === 403)
      return `${employeeAccountErrorMessage(error)} — التجربة محظورة في الحالة الحالية. لا نستنتج صلاحيات بديلة للحسابات المحمية أو المسارات غير المدعومة.`;
  }
  return employeeAccountErrorMessage(error);
}