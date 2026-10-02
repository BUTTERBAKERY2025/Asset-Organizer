import type { DelegatedPermission, EmployeeJobTemplateSummary, EmployeeTemplateAssignmentResponse, EmployeeTemplateAssignmentInput, EmployeeTemplateAccountCreatedResponse } from "@shared/employee-account-delegation";
import { EmployeeAccountRequestError, employeeAccountErrorMessage } from "@/lib/employee-account-delegation";

/** Phase 4 contract: immutable approved content is resolved by the server. */
export type ApprovedEmployeeTemplate = EmployeeJobTemplateSummary;
export type EmployeeAssignmentSnapshot = EmployeeTemplateAssignmentResponse;
export type EmployeeTemplateCommand = EmployeeTemplateAssignmentInput;
export type EmployeeTemplateCreated = EmployeeTemplateAccountCreatedResponse;

export function employeeTemplateKey(template: Pick<ApprovedEmployeeTemplate, "templateId" | "version">) {
  return `${template.templateId}:${template.version}`;
}

/** Exact direct-permission diff, not a client-side grant resolver or ceiling. */
export function employeeTemplateDiff(before: readonly DelegatedPermission[], after: readonly DelegatedPermission[]) {
  return Array.from(new Set([...before, ...after].map(row => row.module))).sort().map(module => {
    const previous = before.filter(row => row.module === module).flatMap(row => row.actions);
    const next = after.filter(row => row.module === module).flatMap(row => row.actions);
    return {
      module,
      before: Array.from(new Set(previous)).sort(),
      after: Array.from(new Set(next)).sort(),
      added: Array.from(new Set(next.filter(action => !previous.includes(action)))).sort(),
      removed: Array.from(new Set(previous.filter(action => !next.includes(action)))).sort(),
    };
  });
}

export function employeeTemplateError(error: unknown) {
  if (error instanceof EmployeeAccountRequestError) {
    if (error.status === 503 || error.code === "migration_required")
      return "تخزين إسناد القوالب غير جاهز. يلزم تطبيق الترحيل 053 ومراجعة الترحيلات 050–052 بواسطة مسؤول النظام؛ هذه ليست قائمة قوالب فارغة.";
    if (error.status === 409)
      return `${employeeAccountErrorMessage(error)} — تغيّرت حالة الحساب أو اعتماد الإصدار. احتفظنا باختيارك؛ حدّث المعاينة والقوالب ثم راجع الفرق وأكّد مجددًا.`;
    if (error.status === 403)
      return `${employeeAccountErrorMessage(error)} — الإسناد محظور وفق التفويض أو السياسة أو النطاق الحالي. لا يتم تجاوز الحسابات ذات الاستثناءات أو الإسنادات القديمة أو الأدوار غير المدعومة.`;
  }
  return employeeAccountErrorMessage(error);
}