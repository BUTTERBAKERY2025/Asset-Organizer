import type { OperationsReadState } from "./operations-payroll-report";

export type OperationsBranch = { id: string; name: string };
export type OperationsEmployee = {
  id: number; employeeName: string; employeeNumber: string | null;
  jobTitle: string; status: string; branchId: string;
};
export type OperationsJoining = {
  id: number; candidateName: string; branchId: string; position: string;
  status: string; blockedExisting: boolean; blockedReason: string | null;
  notification: {
    id: number; branchId: string; status: string; notificationNumber: string;
    actualStartDate: string; sentAt: string | null; expiresAt: string | null; signedAt: string | null;
    confirmedAt: string | null; confirmedBy: string | null; confirmedByName: string | null; confirmedNotes: string | null;
  } | null;
};
export type OperationsJoiningSendResult = {
  link: string; notificationNumber: string; expiresAt: string; sentAt: string;
  tokenReused: boolean; whatsapp: { success: boolean; skipped: boolean; status: "sent" | "failed" | "skipped" };
};
export type OperationsEmployeeTransfer = {
  id: number; employeeId: number; employeeName: string; employeeNumber: string | null; jobTitle: string;
  sourceBranchId: string; destinationBranchId: string; reason: string; status: string;
  requestedAt: string; effectiveDate: string; completedAt: string | null; requestedBy: string; requestedByName: string | null;
  history: {
    id: number; eventType: string; eventTimestamp: string; performedBy: string | null; performedByName: string | null;
    details: { reason?: string } | null;
  }[];
};
export type OperationsTransferPage = {
  transfers: OperationsEmployeeTransfer[]; nextCursor: string | null; hasMore: boolean; truncated: boolean; limit: number;
};
export function validateOperationsTransferPage(page: OperationsTransferPage, branchId: string, allowedIds: readonly string[]) {
  if (!page || !Array.isArray(page.transfers) || typeof page.hasMore !== "boolean" ||
      typeof page.truncated !== "boolean" || !(page.nextCursor === null || typeof page.nextCursor === "string") ||
      (page.hasMore && !page.nextCursor) ||
      page.transfers.some(row => !allowedIds.includes(row.sourceBranchId) || !allowedIds.includes(row.destinationBranchId) ||
        (row.sourceBranchId !== branchId && row.destinationBranchId !== branchId)))
    throw new Error("سجل النقل لا يطابق الفرع أو نطاق الصلاحيات المحدد.");
  return page;
}
export const transferStatusLabels: Record<string, string> = {
  completed: "تم النقل", pending: "بانتظار الموافقة", source_approved: "اعتمده فرع المصدر",
  dest_approved: "اعتمده فرع الوجهة", hr_approved: "اعتمدته شؤون الموظفين", rejected: "مرفوض", cancelled: "ملغى",
};
export const transferEventLabels: Record<string, string> = {
  requested: "طلب النقل", completed: "تنفيذ النقل", source_approved: "اعتماد المصدر",
  dest_approved: "اعتماد الوجهة", hr_approved: "اعتماد شؤون الموظفين", rejected: "رفض النقل", cancelled: "إلغاء النقل",
};
export type OperationsEmployeeSection = "directory" | "joining" | "transfers";
export const operationsEmployeeSections = [
  { id: "directory", label: "دليل الموظفين" },
  { id: "joining", label: "المباشرات" },
  { id: "transfers", label: "سجل النقل" },
] as const;
export function operationsEmployeeSection(search: string): OperationsEmployeeSection {
  const section = new URLSearchParams(search).get("section");
  return section === "joining" || section === "transfers" ? section : "directory";
}
export function operationsEmployeeSectionHref(path: string, search: string, section: OperationsEmployeeSection) {
  const params = new URLSearchParams(search);
  params.set("section", section);
  return `${path}?${params}`;
}

/** No data from a previously authorized branch while grants are being refreshed. */
export function operationsBranchPrerequisite(
  state: OperationsReadState, branches: readonly OperationsBranch[] | undefined, requested: string, denied: boolean,
): "loading" | "error" | "denied" | "no-grants" | "choose" | "ready" {
  if (state === "loading" || state === "scope") return "loading";
  if (state === "error") return denied ? "denied" : "error";
  if (!branches?.length) return "no-grants";
  if (requested && !branches.some(branch => branch.id === requested)) return "denied";
  if (!requested && branches.length > 1) return "choose";
  return "ready";
}
export const employeeStatusLabels: Record<string, string> = {
  active: "نشط", inactive: "غير نشط", terminated: "منتهي الخدمة", on_leave: "في إجازة",
};
export const employeeStatusLabel = (status: string) => employeeStatusLabels[status] ?? "حالة غير معروفة";
export function operationsEmployeePage(
  employees: readonly OperationsEmployee[], filters: { search: string; status: string; jobTitle: string },
  requestedPage: number, pageSize = 15,
) {
  const needle = filters.search.trim().toLocaleLowerCase();
  const filtered = employees.filter(employee =>
    (!needle || [employee.employeeName, employee.employeeNumber, employee.jobTitle, employeeStatusLabel(employee.status)]
      .some(value => value?.toLocaleLowerCase().includes(needle))) &&
    (filters.status === "all" || employee.status === filters.status) &&
    (filters.jobTitle === "all" || employee.jobTitle === filters.jobTitle));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(pages, Math.max(1, requestedPage));
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, pages, page };
}
export function operationsEmployeeQueryNeeded(section: OperationsEmployeeSection, transferOpen: boolean) {
  return section === "directory" || transferOpen;
}
export function operationsEmployeeCanTransfer(employee: OperationsEmployee, branchId: string, canCreate: boolean) {
  return canCreate && employee.branchId === branchId && employee.status === "active";
}
export const joiningStatusLabels: Record<string, string> = {
  pending: "لم يُجهّز رابط المباشرة", sent: "رابط المباشرة جاهز؛ بانتظار التوقيع",
  signed: "وقّع المرشح؛ يحتاج اعتماد التشغيل", confirmed: "تم اعتماد المباشرة",
  cancelled: "أُلغيت المباشرة", expired: "انتهت صلاحية المباشرة", converted: "استُكمل التحويل إلى موظف",
};
export function operationsJoiningState(item: OperationsJoining) {
  return item.status === "converted" ? "converted" : item.notification?.status ?? "pending";
}
export function operationsJoiningAction(item: OperationsJoining, canCreate: boolean, canApprove: boolean) {
  if (item.blockedExisting) return "blocked";
  const state = operationsJoiningState(item);
  if (state === "signed") return canApprove ? "confirm" : "approval-denied";
  if (["pending", "sent"].includes(state)) return canCreate ? "send" : "send-denied";
  return "terminal";
}
export function orderedOperationsJoining(items: readonly OperationsJoining[]) {
  const order: Record<string, number> = { signed: 0, pending: 1, sent: 2, confirmed: 3 };
  return [...items].sort((a, b) => (order[operationsJoiningState(a)] ?? 4) - (order[operationsJoiningState(b)] ?? 4) || b.id - a.id);
}
export function operationsJoiningSendFeedback(result: OperationsJoiningSendResult) {
  if (result.whatsapp.success)
    return "قَبِل مزود واتساب طلب الإرسال؛ لا يعني ذلك تأكيد التسليم. يمكنك نسخ الرابط.";
  return result.whatsapp.skipped || result.whatsapp.status === "skipped"
    ? "الرابط جاهز؛ لم تُستخدم قناة واتساب. انسخ الرابط وشاركه عبر القناة المناسبة."
    : "الرابط جاهز، لكن تعذر إرساله عبر واتساب. انسخ الرابط لإرساله يدويًا.";
}
/** The lock covers the entire command, not just individual POST mutations. */
export function createOperationsEmployeeFlight() {
  let busy = false;
  return {
    isBusy: () => busy,
    async run(work: () => Promise<void>, onBusy: (value: boolean) => void) {
      if (busy) return false;
      busy = true;
      onBusy(true);
      try { await work(); return true; }
      finally { busy = false; onBusy(false); }
    },
  };
}
/** Creation may persist even if sending fails; always reconcile the branch list. */
export async function sendOperationsJoining(
  item: OperationsJoining, actualStartDate: string,
  io: {
    create: (body: { offerId: number; actualStartDate: string }) => Promise<{ id: number }>;
    send: (id: number) => Promise<OperationsJoiningSendResult>;
    refresh: () => Promise<unknown>; isCurrent: () => boolean;
  },
) {
  try {
    let id = item.notification?.id;
    if (!id) {
      const created = await io.create({ offerId: item.id, actualStartDate });
      id = created.id;
      await io.refresh();
      if (!io.isCurrent()) return;
    }
    const sent = await io.send(id);
    await io.refresh();
    return io.isCurrent() ? sent : undefined;
  } catch (error) {
    await io.refresh();
    throw error;
  }
}
export const operationsEmployeeDateTime = (value: string) =>
  new Date(value).toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh" });