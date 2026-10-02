import type { DelegatedEmployeeAccount, EmployeeAccountManagersResponse, EmployeeAccountManagerSelectionResponse } from "@shared/employee-account-delegation";

export type { DelegatedEmployeeAccount, EmployeeAccountsResponse } from "@shared/employee-account-delegation";
export type ManagementReason = DelegatedEmployeeAccount["management"]["reason"];
export type EmployeeAccountManager = EmployeeAccountManagersResponse["managers"][number];
export type EmployeeAccountManagerSelection = EmployeeAccountManagerSelectionResponse;

export function employeeManagementExplanation(reason: ManagementReason) {
  return reason === "not_selected" ? "لم يفوضك مسؤول النظام بإدارة حساب هذا الموظف"
    : reason === "read_only_branch" ? "صلاحيتك في هذا الفرع للقراءة فقط."
    : reason === "protected_account" ? "حساب محمي — يتطلب مسؤول النظام. قد يتضمن استثناءات أو إسنادات قديمة أو دورًا غير مدعوم؛ إسناد القالب لا يتجاوز هذه الحماية." : "";
}