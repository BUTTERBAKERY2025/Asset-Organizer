import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { ArrowLeftRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, getHttpStatus, shouldRetryQuery } from "@/lib/queryClient";
import { operationsReadState } from "@/lib/operations-payroll-report";
import {
  operationsEmployeeQueryNeeded, operationsEmployeeSection, operationsEmployeeSectionHref, operationsEmployeeSections,
  type OperationsBranch, type OperationsEmployee,
} from "@/lib/operations-employees";
import { OperationsEmployeeDirectory } from "./employee-directory";
import { OperationsEmployeeTransferDialog } from "./transfer-dialog";
import { OperationsJoiningWorkspace } from "./joining-workspace";
import { OperationsTransferHistory } from "./transfer-history";
import { OperationsQueryFeedback } from "./query-feedback";

export function OperationsEmployeesWorkspace({ branch, branches, capabilities }: {
  branch: OperationsBranch; branches: OperationsBranch[];
  capabilities: { joiningView: boolean; joiningCreate: boolean; joiningApprove: boolean; transferView: boolean; transferCreate: boolean };
}) {
  const [path, navigate] = useLocation();
  const search = useSearch();
  const section = operationsEmployeeSection(search);
  const [dialog, setDialog] = useState<{ employeeId: number | null } | null>(null);
  const [message, setMessage] = useState("");
  const employeesNeeded = operationsEmployeeQueryNeeded(section, !!dialog);
  const employees = useQuery<OperationsEmployee[]>({
    queryKey: ["/api/operations-hr/employees", branch.id],
    queryFn: async () => {
      const rows = await (await apiRequest("GET", `/api/operations-hr/employees?${new URLSearchParams({ branchId: branch.id })}`)).json() as OperationsEmployee[];
      if (!Array.isArray(rows) || rows.some(row => row.branchId !== branch.id))
        throw new Error("قائمة الموظفين لا تطابق الفرع المحدد.");
      return rows;
    },
    enabled: employeesNeeded, staleTime: 0, gcTime: 0, placeholderData: undefined, retry: shouldRetryQuery, refetchOnMount: "always",
  });
  const employeesState = operationsReadState(employeesNeeded, employees);
  const chooseSection = (next: typeof section) => {
    setDialog(null); setMessage("");
    navigate(operationsEmployeeSectionHref(path, search, next), { replace: true });
  };
  return <section className="overflow-hidden rounded-2xl border border-border bg-card">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Users className="size-5" /></span>
        <div><h2 className="text-lg font-bold">موظفو {branch.name}</h2><p className="text-xs text-muted-foreground">الدليل والمباشرات والنقل في نطاق فرع واحد</p></div>
      </div>
      {section === "transfers" && capabilities.transferCreate && <Button variant="outline" onClick={() => { setMessage(""); setDialog({ employeeId: null }); }}><ArrowLeftRight className="ml-2 size-4" />نقل موظف</Button>}
    </div>
    <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-2" aria-label="أقسام موظفي التشغيل">
      {operationsEmployeeSections.map(item => <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined} onClick={() => chooseSection(item.id)}
        className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${section === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{item.label}</button>)}
    </nav>
    <div className="space-y-4 p-4 sm:p-5">
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">{message}</p>}
      {section === "directory" && <>
        <OperationsQueryFeedback state={employeesState} loading="جار تحميل موظفي الفرع…" failure={getHttpStatus(employees.error) === 403 ? "لم يعد دليل الموظفين متاحًا ضمن صلاحياتك." : "تعذر تحميل الموظفين."} error={employees.error} onRetry={() => employees.refetch()} />
        {employeesState === "ready" && employees.data && <OperationsEmployeeDirectory employees={employees.data} branchId={branch.id} canTransfer={capabilities.transferCreate}
          onTransfer={employee => { setMessage(""); setDialog({ employeeId: employee.id }); }} />}
      </>}
      {section === "joining" && (capabilities.joiningView
        ? <OperationsJoiningWorkspace branch={branch} canCreate={capabilities.joiningCreate} canApprove={capabilities.joiningApprove} />
        : <p role="alert" className="rounded-lg border border-border p-5 text-sm">لا تملك صلاحية عرض مباشرات التشغيل. لم تُحمّل أي مباشرَات.</p>)}
      {section === "transfers" && (capabilities.transferView
        ? <OperationsTransferHistory branch={branch} branches={branches} />
        : <p role="alert" className="rounded-lg border border-border p-5 text-sm">لا تملك صلاحية عرض سجل النقل. لم يُحمّل السجل.</p>)}
    </div>
    {dialog && capabilities.transferCreate && <OperationsEmployeeTransferDialog branch={branch} branches={branches}
      employees={employees.data} employeesState={employeesState} employeesError={employees.error} retry={() => employees.refetch()}
      preselectedId={dialog.employeeId} canCreate={capabilities.transferCreate} onClose={() => setDialog(null)}
      onComplete={text => { setDialog(null); setMessage(text); }} />}
  </section>;
}