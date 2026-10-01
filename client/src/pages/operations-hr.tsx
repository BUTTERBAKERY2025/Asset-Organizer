import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { apiRequest, getHttpStatus, shouldRetryQuery } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/usePermissions";
import { createOperationsHrCommandGuard, operationsHrSelectionHref, operationsHrSelectionIntent, operationsPayrollReportReady, validOperationsPayrollMonth } from "@/lib/operations-hr-state";
import { monthlySourceIntent, peopleSourceIntent, preserveMonthlyAllReturn } from "@/lib/operations-center-navigation";
import { operationsReadState, type OperationsPayrollPayments, type OperationsPayrollReport } from "@/lib/operations-payroll-report";
import { OperationsPayrollReportTable } from "@/components/operations-hr/payroll-report";
import { OperationsQueryFeedback } from "@/components/operations-hr/query-feedback";
import { operationsBranchPrerequisite, operationsEmployeeSection, type OperationsBranch } from "@/lib/operations-employees";
import { OperationsBranchPrerequisite } from "@/components/operations-hr/branch-prerequisite";
import { OperationsEmployeesWorkspace } from "@/components/operations-hr/employees-workspace";
import { downloadOperationsPayroll } from "@/lib/operations-payroll-export";
import type { OperationsPayrollExportFormat } from "@shared/operations-payroll-export";

export default function OperationsHrPage() {
  const permissions = usePermissions();
  return <Layout><OperationsHrContent permissions={permissions} /></Layout>;
}

const dateTime = (value: string) => new Date(value).toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh" });

/** Actual page content, shared by the authenticated page and isolated UI proof. */
export function OperationsHrContent({ permissions }: {
  permissions: Pick<ReturnType<typeof usePermissions>, "canView" | "canCreate" | "canApprove" | "canExport">;
}) {
  const client = useQueryClient();
  const [pathname, navigate] = useLocation();
  const search = useSearch();
  const { canView, canCreate, canApprove, canExport } = permissions;
  const defaultMonth = useRef(new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 7)).current;
  const selection = operationsHrSelectionIntent(search, defaultMonth);
  const { branchId: branchSelection, month, tab: activeTab } = selection;
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState<OperationsPayrollExportFormat | null>(null);
  const exportInFlight = useRef<object | null>(null);
  const commands = useRef(createOperationsHrCommandGuard()).current;
  const branches = useQuery<OperationsBranch[]>({
    queryKey: ["/api/operations-hr/branches"], queryFn: async () => (await apiRequest("GET", "/api/operations-hr/branches")).json(),
    staleTime: 0, gcTime: 0, placeholderData: undefined, retry: shouldRetryQuery, refetchOnMount: "always",
  });
  const branchesState = operationsReadState(true, branches);
  const context = new URLSearchParams(search);
  const monthlyRequested = context.getAll("centerWorkspace").includes("monthly")
    || ["centerMonth", "centerMonthBranchId", "centerMonthFile"].some(key => context.has(key));
  const peopleRequested = context.getAll("centerWorkspace").includes("people")
    || ["centerPeopleBranchId", "centerPeopleRecord"].some(key => context.has(key));
  const sourceUrl = new URL(`${pathname}?${search}`, window.location.origin);
  const authorizedIds = (branches.data ?? []).map(row => row.id);
  const joiningRequested = context.has("offerId") || context.has("notificationId");
  const joiningQueryValid = !joiningRequested || (context.getAll("tab").length <= 1
    && (!context.has("tab") || context.get("tab") === "employees")
    && context.getAll("section").length <= 1 && (!context.has("section") || context.get("section") === "joining"));
  const sourceValid = (!monthlyRequested || !!monthlySourceIntent(sourceUrl, authorizedIds))
    && (!peopleRequested || !!peopleSourceIntent(sourceUrl, authorizedIds)) && joiningQueryValid;
  const prerequisite = operationsBranchPrerequisite(branchesState, branches.data,
    sourceValid ? branchSelection : "__invalid_scope__", getHttpStatus(branches.error) === 403);
  const select = (change: Partial<typeof selection>) => {
    commands.invalidate();
    const next = { ...selection, ...change };
    navigate(preserveMonthlyAllReturn(operationsHrSelectionHref(pathname, search, next.branchId, next.month, next.tab,
      (branches.data ?? []).map(row => row.id)), search), { replace: true });
  };
  const setBranchSelection = (branchId: string) => select({ branchId });
  const setMonth = (nextMonth: string) => select({ month: nextMonth });
  const setActiveTab = (tab: "employees" | "payroll") => select({ tab });
  const branch = branchSelection ? branches.data?.find(b => b.id === branchSelection)
    : branches.data?.length === 1 ? branches.data[0] : undefined;
  const authorizedBranch = !!branch && branchesState === "ready" && sourceValid;
  const validMonth = validOperationsPayrollMonth(month);
  const commandScope = JSON.stringify([branchSelection, branch?.id, month, activeTab, authorizedBranch,
    canView("operations_payroll"), canView("operations_joining"), canView("operations_employee_transfer"),
    canApprove("operations_payroll"), canExport("operations_payroll"),
    canCreate("operations_joining"), canApprove("operations_joining"), canCreate("operations_employee_transfer")]);
  commands.update(commandScope);
  useEffect(() => () => commands.invalidate(), [commands]);
  useEffect(() => {
    setMessage("");
    setExporting(null);
    exportInFlight.current = null;
  }, [commandScope]);
  useEffect(() => {
    if (branchesState !== "ready") return;
    // Automatic normalization is not an intentional new selection. Never
    // repair forged/duplicate/revoked return context into an authorized month.
    if (!sourceValid || branchSelection === "__invalid_scope__") return;
    const next = preserveMonthlyAllReturn(operationsHrSelectionHref(pathname, search, branchSelection || branch?.id || "", month,
      activeTab, (branches.data ?? []).map(row => row.id)), search);
    if (next !== `${pathname}${search ? `?${search}` : ""}`) navigate(next, { replace: true });
  }, [pathname, search, branchSelection, branch?.id, month, activeTab, branches.data, branchesState, sourceValid, navigate]);
  const payroll = useQuery<OperationsPayrollReport>({
    queryKey: ["/api/operations-hr/payroll", branch?.id, month],
    queryFn: async () => (await apiRequest("GET", `/api/operations-hr/payroll?${new URLSearchParams({ branchId: branch!.id, month })}`)).json(),
    enabled: authorizedBranch && validMonth && activeTab === "payroll" && canView("operations_payroll"), staleTime: 0, gcTime: 0,
    placeholderData: undefined, retry: shouldRetryQuery, refetchOnMount: "always",
  });
  const payments = useQuery<OperationsPayrollPayments>({
    queryKey: ["/api/operations-hr/payroll/payments", branch?.id, month],
    queryFn: async () => {
      const data = await (await apiRequest("GET", `/api/operations-hr/payroll/payments?${new URLSearchParams({ branchId: branch!.id, month })}`)).json() as OperationsPayrollPayments;
      if (data.branchId !== branch!.id || data.month !== month ||
          data.payments.some(payment => payment.branchId !== branch!.id || payment.month !== month))
        throw new Error("سجلات الصرف لا تطابق الفرع والشهر المحددين.");
      return data;
    },
    enabled: authorizedBranch && validMonth && activeTab === "payroll" && canView("operations_payroll"), staleTime: 0, gcTime: 0,
    placeholderData: undefined, retry: shouldRetryQuery, refetchOnMount: "always",
  });
  const payrollState = operationsReadState(authorizedBranch && validMonth && activeTab === "payroll" && canView("operations_payroll"), payroll);
  const paymentsState = operationsReadState(authorizedBranch && validMonth && activeTab === "payroll" && canView("operations_payroll"), payments);
  const mutation = useMutation({
    mutationFn: async ({ url, body }: { url: string; body: unknown }) =>
      (await apiRequest("POST", url, body)).json(),
  });
  const reportReady = operationsPayrollReportReady({
    authorizedBranch, month, fetching: payroll.isFetching, error: payroll.isError, hasData: !!payroll.data,
  }) && payrollState === "ready" && canView("operations_payroll");
  const commandError = (token: number, error: unknown) => {
    if (commands.isCurrent(token)) setMessage(error instanceof Error ? error.message : "تعذر إكمال العملية");
  };
  const review = async () => {
    if (!branch || !reportReady || !canApprove("operations_payroll") || mutation.isPending) return;
    const token = commands.capture();
    setMessage("");
    try {
      await mutation.mutateAsync({ url: "/api/operations-hr/payroll/review", body: { branchId: branch.id, month } });
      await client.invalidateQueries({ queryKey: ["/api/operations-hr/payroll"] });
      if (!commands.isCurrent(token)) return;
      setMessage("سُجلت المراجعة الاستشارية؛ لا توقف اعتماد شؤون الموظفين.");
    } catch (error) { commandError(token, error); }
  };
  const exportPayroll = async (format: OperationsPayrollExportFormat) => {
    if (!branch || !reportReady || !canExport("operations_payroll") || !canView("operations_payroll") || exportInFlight.current) return;
    const token = commands.capture();
    const flight = {};
    exportInFlight.current = flight;
    setExporting(format);
    setMessage("");
    try {
      await downloadOperationsPayroll({
        branchId: branch.id, month, format,
        assertCurrent: () => {
          if (!commands.isCurrent(token)) throw new Error("تغيّر الفرع أو الشهر أو الصلاحية؛ أُلغي تنزيل النسخة القديمة.");
        },
      });
      if (commands.isCurrent(token)) setMessage("نُزّلت نسخة مراجعة كامل الفرع والشهر؛ لا تتأثر بفلاتر الجدول وليست اعتماد شؤون الموظفين النهائي.");
    } catch (error) { commandError(token, error); }
    finally {
      if (exportInFlight.current === flight) { exportInFlight.current = null; setExporting(null); }
    }
  };
  return <main dir="rtl" className="page-container mx-auto max-w-6xl space-y-6 pb-12">
    <header className="border-b border-border pb-4"><p className="text-sm font-bold text-primary">إدارة التشغيل / الموارد البشرية</p>
      <h1 className="mt-1 text-2xl font-black">{activeTab === "payroll" ? `مراجعة رواتب التشغيل · ${month}` : "مركز موارد التشغيل"}</h1>
      <p className="text-sm text-muted-foreground">موظفو الفروع المصرّح لك بها فقط، باستثناء الإدارة العامة. مراجعة الرواتب استشارية ولا تعطل اعتماد شؤون الموظفين.</p>
    </header>
    {message && <p role="status" className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">{message}</p>}
    {branchesState === "ready" && !!branches.data?.length && <>
      <label className="block max-w-sm text-sm font-semibold">الفرع
        <select value={branch?.id ?? ""} onChange={e => setBranchSelection(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3">
          {!branch && <option value="">اختر فرعًا مسموحًا</option>}
          {branches.data.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}
        </select>
      </label>
      <div className="flex gap-2" aria-label="مجال موارد التشغيل">
        <Button variant={activeTab === "employees" ? "default" : "outline"} onClick={() => setActiveTab("employees")}>الموظفون</Button>
        <Button variant={activeTab === "payroll" ? "default" : "outline"} onClick={() => setActiveTab("payroll")}>مراجعة رواتب الشهر</Button>
      </div>
      {authorizedBranch && branch && activeTab === "employees" && <OperationsEmployeesWorkspace key={`${commandScope}:${operationsEmployeeSection(search)}`}
        branch={branch} branches={branches.data} capabilities={{
          joiningView: canView("operations_joining"), joiningCreate: canCreate("operations_joining"), joiningApprove: canApprove("operations_joining"),
          transferView: canView("operations_employee_transfer"), transferCreate: canCreate("operations_employee_transfer"),
        }} />}
      {authorizedBranch && activeTab === "payroll" && !canView("operations_payroll") && <p role="alert" className="rounded-xl border border-border p-4">لا تملك صلاحية عرض رواتب التشغيل. لم تُعرض قائمة الموظفين كبديل لتقرير الرواتب.</p>}
      {authorizedBranch && activeTab === "payroll" && canView("operations_payroll") && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">تقرير الرواتب والمراجعة</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-sm">الشهر <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="mt-1 w-44" /></label>
          {canExport("operations_payroll") && <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild><Button variant="outline" disabled={!reportReady || mutation.isPending || !!exporting} aria-busy={!!exporting}>
              {exporting ? `جار تجهيز ${exporting === "xlsx" ? "Excel" : exporting.toUpperCase()}…` : "تصدير كامل الفرع"}
            </Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem disabled={!!exporting} onSelect={() => void exportPayroll("pdf")}>PDF — نسخة مراجعة</DropdownMenuItem>
              <DropdownMenuItem disabled={!!exporting} onSelect={() => void exportPayroll("xlsx")}>Excel (.xlsx) — كامل الفرع</DropdownMenuItem>
              <DropdownMenuItem disabled={!!exporting} onSelect={() => void exportPayroll("csv")}>CSV — كامل الفرع</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
          {canApprove("operations_payroll") && <Button onClick={review} disabled={!reportReady || mutation.isPending}>اعتماد مراجعة التشغيل</Button>}
        </div>
        {canExport("operations_payroll") && <p className="mt-2 text-xs text-muted-foreground">التصدير يشمل كامل الفرع والشهر، مستقلاً عن فلاتر الجدول أو الصفحة المعروضة. نسخة للمراجعة فقط وليست اعتماد شؤون الموظفين النهائي.</p>}
        {!validMonth && <p role="alert" className="mt-3 text-sm text-destructive">اختر شهرًا صحيحًا بصيغة YYYY-MM قبل تحميل الرواتب أو اعتماد مراجعتها أو تصديرها.</p>}
        {!branch && validMonth && <p role="status" className="mt-3 text-sm">اختر فرعًا مصرّحًا به لعرض تقرير الرواتب.</p>}
        <OperationsQueryFeedback state={payrollState} loading="جار تحميل رواتب الفرع والشهر المحددين…" failure="تعذر تحميل تقرير الرواتب." error={payroll.error} onRetry={() => payroll.refetch()} />
        {reportReady && branch && payroll.data && <>
          <OperationsQueryFeedback state={paymentsState} loading="جار تحميل حالة صرف رواتب الفرع والشهر المحددين…" failure="تعذر تحميل حالة الدفع؛ تقرير الرواتب ظاهر، لكن المصروف والمتبقي غير متاحين." error={payments.error} onRetry={() => payments.refetch()} />
          <OperationsPayrollReportTable key={`${branch.id}:${month}`} report={payroll.data} branchId={branch.id} branchName={branch.name} month={month} payments={paymentsState === "ready" ? payments.data?.payments : undefined} />
          <p className="mt-2 text-xs text-muted-foreground">مراجعات مسجلة: {payroll.data.reviews.length} · لا تؤثر على إغلاق الرواتب أو صرفها.</p>
          <p className="mt-1 text-xs text-muted-foreground">اعتماد مراجعة التشغيل استشاري؛ لا يوقف شؤون الموظفين ولا يُعد اعتمادًا ماليًا.</p>
          {payroll.data.reviews.map(item => <p key={item.id} className="mt-2 rounded-lg bg-muted p-2 text-xs">
            مراجعة التشغيل مسجلة بواسطة {item.reviewedByName || item.reviewedBy} · {dateTime(item.reviewedAt)}{item.note ? ` · ${item.note}` : ""}
          </p>)}
        </>}
      </section>}
    </>}
    {prerequisite !== "ready" && <OperationsBranchPrerequisite state={prerequisite} error={branches.error} retry={() => branches.refetch()} />}
  </main>;
}