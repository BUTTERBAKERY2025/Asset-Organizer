import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, getHttpStatus } from "@/lib/queryClient";
import { createOperationsHrCommandGuard } from "@/lib/operations-hr-state";
import { operationsQueryError, type OperationsReadState } from "@/lib/operations-payroll-report";
import { createOperationsEmployeeFlight, operationsEmployeeCanTransfer, type OperationsBranch, type OperationsEmployee } from "@/lib/operations-employees";
import { OperationsQueryFeedback } from "./query-feedback";

export function OperationsEmployeeTransferDialog({ branch, branches, employees, employeesState, employeesError, retry, preselectedId, canCreate, onClose, onComplete }: {
  branch: OperationsBranch; branches: OperationsBranch[]; employees: OperationsEmployee[] | undefined;
  employeesState: OperationsReadState; employeesError: unknown; retry: () => unknown;
  preselectedId: number | null; canCreate: boolean; onClose: () => void; onComplete: (message: string) => void;
}) {
  const client = useQueryClient();
  const [employeeId, setEmployeeId] = useState(preselectedId?.toString() ?? "");
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const flight = useRef(createOperationsEmployeeFlight()).current;
  const guard = useRef(createOperationsHrCommandGuard()).current;
  guard.update(JSON.stringify([branch.id, canCreate, branches.map(row => row.id)]));
  useEffect(() => () => guard.invalidate(), [guard]);
  const employee = employeesState === "ready" ? employees?.find(row => row.id === Number(employeeId)) : undefined;
  const destinationBranch = branches.find(row => row.id === destination && row.id !== branch.id);
  const valid = !!employee && operationsEmployeeCanTransfer(employee, branch.id, canCreate) && !!destinationBranch && !!reason.trim() && reason.length <= 500;
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ["/api/operations-hr/employees"] }),
    client.invalidateQueries({ queryKey: ["/api/operations-hr/transfers"] }),
  ]);
  const submit = async () => {
    if (!valid || !employee || flight.isBusy()) return;
    const token = guard.capture();
    await flight.run(async () => {
      setMessage("");
      try {
        await apiRequest("POST", "/api/operations-hr/transfers", {
          employeeId: employee.id, sourceBranchId: branch.id, destinationBranchId: destination, reason: reason.trim(),
        });
        await refresh();
        if (!guard.isCurrent(token)) return;
        onComplete(`تم نقل ${employee.employeeName} إلى ${destinationBranch!.name} وحُفظ الإجراء في السجل.`);
      } catch (error) {
        await refresh();
        if (!guard.isCurrent(token)) return;
        setMessage(`${operationsQueryError(error) || "تعذر تنفيذ النقل."}${getHttpStatus(error) === 409 ? " أُعيد تحديث بيانات الفرع؛ تحقق منها قبل المحاولة." : ""}`);
      }
    }, value => { if (guard.isCurrent(token)) setBusy(value); });
  };
  return <Dialog open onOpenChange={open => { if (!open && !flight.isBusy()) onClose(); }}>
    <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>نقل موظف بين الفروع</DialogTitle><DialogDescription>النقل يُنفّذ فور التأكيد، وليس طلب موافقة. يُحدّث فرع الموظف ويحفظ السبب والمنفّذ في سجل النقل.</DialogDescription></DialogHeader>
      <OperationsQueryFeedback state={employeesState} loading="جار التحقق من موظفي الفرع…" failure="تعذر تحميل الموظفين؛ النقل غير متاح." error={employeesError} onRetry={retry} />
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label className="block text-sm font-medium">الموظف<select disabled={busy || employeesState !== "ready" || !canCreate} value={employeeId} onChange={event => setEmployeeId(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3">
          <option value="">اختر موظفًا نشطًا</option>{employeesState === "ready" && employees?.filter(row => operationsEmployeeCanTransfer(row, branch.id, canCreate)).map(row => <option key={row.id} value={row.id}>{row.employeeName} · {row.employeeNumber || "الرقم غير مسجل"}</option>)}
        </select></label>
        {preselectedId && employeesState === "ready" && !employees?.some(row => row.id === preselectedId && row.status === "active") && <p role="alert" className="text-sm text-destructive">لم يعد الموظف المحدد نشطًا في هذا الفرع. اختر موظفًا من القائمة المحدثة.</p>}
        <label className="block text-sm font-medium">فرع الوجهة<select disabled={busy || !canCreate} value={destination} onChange={event => setDestination(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3">
          <option value="">اختر فرع الوجهة</option>{branches.filter(row => row.id !== branch.id).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select></label>
        {branches.length < 2 && <p className="text-xs text-muted-foreground">لا يوجد فرع وجهة آخر مصرّح به. راجع مسؤول الصلاحيات.</p>}
        <label className="block text-sm font-medium">سبب النقل <span className="font-normal text-muted-foreground">(مطلوب)</span>
          <Textarea className="mt-1" value={reason} disabled={busy || !canCreate} maxLength={500} onChange={event => setReason(event.target.value)} placeholder="اكتب سبب النقل لتوثيقه في السجل" />
        </label>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-950"><strong>تأكيد النقل الفوري</strong>
          <p>{employee ? employee.employeeName : "الموظف المختار"} · من {branch.name} إلى {destinationBranch?.name || "فرع الوجهة الذي تختاره"}.</p>
          <p className="text-xs">الحسابات المرتبطة بصلاحيات أو إجراءات نقل قائمة قد تتطلب تنسيقًا مع شؤون الموظفين؛ سيعرض الخادم سبب المنع.</p>
        </div>
        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!valid || busy}>{busy ? "جار تنفيذ النقل وتحديث السجل…" : "تأكيد النقل الفوري"}</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}