import type { DelegatedEmployeeAccount, EmployeeAccountManagersResponse, EmployeeAccountManagerSelectionResponse } from "@shared/employee-account-delegation";

export type { DelegatedEmployeeAccount, EmployeeAccountsResponse } from "@shared/employee-account-delegation";
export type ManagementReason = DelegatedEmployeeAccount["management"]["reason"];
export type EmployeeAccountManager = EmployeeAccountManagersResponse["managers"][number];
export type EmployeeAccountManagerSelection = EmployeeAccountManagerSelectionResponse;

export function employeeManagementLabel(reason: ManagementReason) {
  return reason === "read_only_branch" ? "عرض فقط في هذا الفرع"
    : reason === "not_selected" ? "تغطية غير مؤكدة · استجابة قديمة"
    : "خارج نطاق الإدارة المفوّضة";
}

export function employeeManagementExplanation(reason: ManagementReason, actorRole?: string) {
  return reason === "not_selected" ? "أعاد الخادم رمز تفويض قديمًا. حدّث الدليل للتحقق من تغطية الفروع التلقائية؛ لا يلزم اختيار الموظف بالاسم، ولن نفترض الأهلية من بيانات قديمة."
    : reason === "read_only_branch" ? "صلاحيتك في هذا الفرع للقراءة فقط."
    : reason === "protected_account" ? "إدارة هذا الحساب غير متاحة عبر مسار التفويض؛ قد تكون صلاحياته أو إسناداته خارج حدود هذا المسار. هذه العلامة لا تعني أن الحساب موقوف أو أن إسناد القالب فشل. " + (actorRole === "admin"
      ? "بصفتك أدمن، استخدم «مقارنة وتجربة قالب» لمراجعة الإسناد وأي سبب يمنع تطبيقه."
      : "راجع مسؤول النظام لإدارة صلاحياته؛ لا يمكن تجاوز هذا القيد من مسار التفويض.") : "";
}