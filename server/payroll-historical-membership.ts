/** Resolve whole-month ownership only. Mid-month allocation is a payroll policy,
 * not something that can safely be inferred from the employee's current branch. */
export type PayrollTransfer = {
  employeeId: number; sourceBranchId: string; destinationBranchId: string;
  effectiveDate: string; status: string;
};
export function resolvePayrollMembership(
  currentBranch: string, transfers: PayrollTransfer[], month: string,
): { branchId: string | null; reason?: string } {
  const start = `${month}-01`;
  const [year, number] = month.split("-").map(Number);
  const end = `${month}-${String(new Date(year, number, 0).getDate()).padStart(2, "0")}`;
  const completed = transfers.filter(t => t.status === "completed").sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (completed.some((t, i) => !validDate(t.effectiveDate) ||
    t.sourceBranchId === t.destinationBranchId ||
    (i > 0 && (completed[i - 1].destinationBranchId !== t.sourceBranchId ||
      completed[i - 1].effectiveDate === t.effectiveDate))) ||
    (completed.length > 0 && completed[completed.length - 1].destinationBranchId !== currentBranch)) {
    return { branchId: null, reason: "سجل النقل متعارض أو تاريخه غير صالح؛ يلزم تصحيح التبعية التاريخية قبل اعتماد الرواتب." };
  }
  if (completed.some(t => t.effectiveDate > start && t.effectiveDate <= end)) {
    return { branchId: null, reason: "يوجد نقل داخل الشهر؛ يلزم اعتماد توزيع الاستحقاق بين الفروع قبل الإغلاق، منعًا لتكرار الراتب." };
  }
  let branchId = currentBranch;
  for (const t of [...completed].reverse()) {
    if (t.effectiveDate > end) branchId = t.sourceBranchId;
  }
  return { branchId };
}