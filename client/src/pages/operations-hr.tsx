import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, shouldRetryQuery } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/usePermissions";
import { createOperationsHrCommandGuard, operationsHrSelectionHref, operationsHrSelectionIntent, operationsPayrollReportReady, validOperationsPayrollMonth } from "@/lib/operations-hr-state";
import { operationsReadState, type OperationsPayrollPayments, type OperationsPayrollReport } from "@/lib/operations-payroll-report";
import { OperationsPayrollReportTable } from "@/components/operations-hr/payroll-report";
import { OperationsQueryFeedback } from "@/components/operations-hr/query-feedback";

type Branch = { id: string; name: string };
type Employee = { id: number; employeeName: string; employeeNumber: string | null; jobTitle: string; status: string; branchId: string };
type Transfer = {
  id: number; employeeName: string; sourceBranchId: string; destinationBranchId: string;
  requestedBy: string; requestedByName: string; requestedAt: string; reason: string; status: string;
  history: { id: number; performedBy: string | null; performedByName: string | null; eventTimestamp: string; eventType: string;
    details: { reason?: string; sourceBranchId?: string; destinationBranchId?: string } | null }[];
};
type Joining = {
  id: number; candidateName: string; branchId: string; position: string;
  notification: { id: number; status: string; actualStartDate: string; signedAt: string | null;
    confirmedAt: string | null; confirmedBy: string | null; confirmedByName: string | null; confirmedNotes: string | null } | null;
};
export default function OperationsHrPage() {
  const permissions = usePermissions();
  return <Layout><OperationsHrContent permissions={permissions} /></Layout>;
}

const dateTime = (value: string) => new Date(value).toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh" });
const joiningStatus: Record<string, string> = {
  pending: "لم يُرسل الرابط", sent: "أُرسل الرابط؛ بانتظار التوقيع",
  signed: "وقّع الموظف؛ بانتظار اعتماد التشغيل", confirmed: "تم اعتماد المباشرة",
  cancelled: "أُلغيت المباشرة", expired: "انتهت مدة المباشرة",
};

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
  const [employeeSelection, setEmployeeSelection] = useState("");
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [startDates, setStartDates] = useState<Record<number, string>>({});
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [confirmJoiningId, setConfirmJoiningId] = useState<number | null>(null);
  const [confirmNotes, setConfirmNotes] = useState("");
  const branches = useQuery<Branch[]>({
    queryKey: ["/api/operations-hr/branches"], queryFn: async () => (await apiRequest("GET", "/api/operations-hr/branches")).json(),
    staleTime: 0, gcTime: 0, placeholderData: undefined, retry: shouldRetryQuery, refetchOnMount: "always",
  });
  const branchesState = operationsReadState(true, branches);
  const select = (change: Partial<typeof selection>) => {
    const next = { ...selection, ...change };
    navigate(operationsHrSelectionHref(pathname, search, next.branchId, next.month, next.tab,
      (branches.data ?? []).map(row => row.id)), { replace: true });
  };
  const setBranchSelection = (branchId: string) => select({ branchId });
  const setMonth = (nextMonth: string) => select({ month: nextMonth });
  const setActiveTab = (tab: "employees" | "payroll") => select({ tab });
  const branch = branchSelection ? branches.data?.find(b => b.id === branchSelection)
    : branches.data?.length === 1 ? branches.data[0] : undefined;
  const authorizedBranch = !!branch && branchesState === "ready";
  const validMonth = validOperationsPayrollMonth(month);
  const commands = useRef(createOperationsHrCommandGuard()).current;
  const commandScope = JSON.stringify([branchSelection, branch?.id, month, activeTab, authorizedBranch,
    canView("operations_payroll"), canView("operations_joining"), canView("operations_employee_transfer"),
    canApprove("operations_payroll"), canExport("operations_payroll"),
    canCreate("operations_joining"), canApprove("operations_joining"), canCreate("operations_employee_transfer")]);
  commands.update(commandScope);
  useEffect(() => () => commands.invalidate(), [commands]);
  const branchName = (id: string) => branches.data?.find(b => b.id === id)?.name ?? id;
  useEffect(() => {
    setLink(""); setMessage(""); setConfirmJoiningId(null); setConfirmNotes("");
    setEmployeeSelection(""); setDestination(""); setReason(""); setStartDates({});
  }, [commandScope]);
  useEffect(() => {
    if (branchesState !== "ready") return;
    const next = operationsHrSelectionHref(pathname, search, branchSelection || branch?.id || "", month,
      activeTab, (branches.data ?? []).map(row => row.id));
    if (next !== `${pathname}${search ? `?${search}` : ""}`) navigate(next, { replace: true });
  }, [pathname, search, branchSelection, branch?.id, month, activeTab, branches.data, branchesState, navigate]);
  const employees = useQuery<Employee[]>({
    queryKey: ["/api/operations-hr/employees", branch?.id],
    queryFn: async () => (await apiRequest("GET", `/api/operations-hr/employees?branchId=${encodeURIComponent(branch!.id)}`)).json(),
    enabled: authorizedBranch && activeTab === "employees", staleTime: 0, gcTime: 0,
    placeholderData: undefined, retry: shouldRetryQuery, refetchOnMount: "always",
  });
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
  const transfers = useQuery<Transfer[]>({
    queryKey: ["/api/operations-hr/transfers", branch?.id],
    queryFn: async () => (await apiRequest("GET", "/api/operations-hr/transfers")).json(),
    enabled: authorizedBranch && activeTab === "employees" && canView("operations_employee_transfer"), staleTime: 0, gcTime: 0,
    placeholderData: undefined, retry: shouldRetryQuery, refetchOnMount: "always",
  });
  const joining = useQuery<Joining[]>({
    queryKey: ["/api/operations-hr/joining", branch?.id],
    queryFn: async () => (await apiRequest("GET", "/api/operations-hr/joining")).json(),
    enabled: authorizedBranch && activeTab === "employees" && canView("operations_joining"), staleTime: 0, gcTime: 0,
    placeholderData: undefined, retry: shouldRetryQuery, refetchOnMount: "always",
  });
  const employeesReady = operationsReadState(authorizedBranch && activeTab === "employees", employees) === "ready";
  const joiningState = operationsReadState(authorizedBranch && activeTab === "employees" && canView("operations_joining"), joining);
  const transfersState = operationsReadState(authorizedBranch && activeTab === "employees" && canView("operations_employee_transfer"), transfers);
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
  const transfer = async () => {
    if (!authorizedBranch || !branch || !employeesReady || !canCreate("operations_employee_transfer") || mutation.isPending) return;
    if (!employeeSelection || !destination || !reason.trim()) return setMessage("حدد الموظف والفرع الجديد وسبب النقل.");
    const token = commands.capture();
    setMessage("");
    try {
      await mutation.mutateAsync({ url: "/api/operations-hr/transfers", body: {
        employeeId: Number(employeeSelection), sourceBranchId: branch.id, destinationBranchId: destination, reason,
      } });
      await Promise.all([
        client.invalidateQueries({ queryKey: ["/api/operations-hr/employees"] }),
        client.invalidateQueries({ queryKey: ["/api/operations-hr/transfers"] }),
      ]);
      if (!commands.isCurrent(token)) return;
      setEmployeeSelection(""); setDestination(""); setReason("");
      setMessage("تم النقل وحفظ اسم منفذه ووقت التنفيذ في السجل.");
    } catch (error) { commandError(token, error); }
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
  const exportPayroll = async () => {
    if (!branch || !reportReady || !canExport("operations_payroll")) return;
    const token = commands.capture();
    const exportMonth = month;
    setMessage("");
    try {
      const result = await apiRequest("GET", `/api/operations-hr/payroll/export?${new URLSearchParams({ branchId: branch.id, month })}`);
      const blob = await result.blob();
      if (!commands.isCurrent(token)) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `operations-payroll-${exportMonth}.csv`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { commandError(token, error); }
  };
  const sendJoining = async (item: Joining) => {
    if (!authorizedBranch || !branch || !canCreate("operations_joining") || mutation.isPending || item.branchId !== branch.id || joiningState !== "ready") return;
    const token = commands.capture();
    setMessage(""); setLink("");
    try {
      let id = item.notification?.id;
      if (!id) {
        const created = await mutation.mutateAsync({ url: "/api/operations-hr/joining", body: {
          offerId: item.id, actualStartDate: startDates[item.id],
        } });
        id = created.id;
        // A failed channel send must not leave the list pretending there is
        // still no notification. Refresh immediately after persisted creation.
        await client.invalidateQueries({ queryKey: ["/api/operations-hr/joining"] });
        if (!commands.isCurrent(token)) return;
      }
      const sent = await mutation.mutateAsync({ url: `/api/operations-hr/joining/${id}/send`, body: {} });
      await client.invalidateQueries({ queryKey: ["/api/operations-hr/joining"] });
      if (!commands.isCurrent(token)) return;
      setLink(sent.link);
      setMessage(sent.whatsapp?.success ? "أُرسل رابط المباشرة عبر واتساب." : "أُنشئ الرابط؛ تعذر إرسال واتساب، يمكنك نسخ الرابط.");
    } catch (error) { commandError(token, error); }
  };
  const confirmJoining = async () => {
    const item = joining.data?.find(row => row.notification?.id === confirmJoiningId);
    if (!authorizedBranch || !branch || !canApprove("operations_joining") || mutation.isPending || !item || item.branchId !== branch.id || item.notification?.status !== "signed" || joiningState !== "ready") return;
    const token = commands.capture();
    setMessage("");
    try {
      const result = await mutation.mutateAsync({ url: `/api/operations-hr/joining/${confirmJoiningId}/confirm`, body: { notes: confirmNotes.trim() } });
      await client.invalidateQueries({ queryKey: ["/api/operations-hr/joining"] });
      if (!commands.isCurrent(token)) return;
      setConfirmJoiningId(null); setConfirmNotes("");
      setMessage(result.alreadyConfirmed ? "المباشرة معتمدة بالفعل؛ لم يُرسل إشعار مكرر."
        : "اعتُمدت المباشرة وأُنشئ إشعار لمدير شؤون الموظفين. استكمال ملف الموظف من اختصاص شؤون الموظفين.");
    } catch (error) {
      commandError(token, error);
      void client.invalidateQueries({ queryKey: ["/api/operations-hr/joining"] });
    }
  };
  return <main dir="rtl" className="page-container mx-auto max-w-6xl space-y-6 pb-12">
    <header className="border-b border-border pb-4"><p className="text-sm font-bold text-primary">إدارة التشغيل / الموارد البشرية</p>
      <h1 className="mt-1 text-2xl font-black">{activeTab === "payroll" ? `مراجعة رواتب التشغيل · ${month}` : "مركز موارد التشغيل"}</h1>
      <p className="text-sm text-muted-foreground">موظفو الفروع المصرّح لك بها فقط، باستثناء الإدارة العامة. مراجعة الرواتب استشارية ولا تعطل اعتماد شؤون الموظفين.</p>
    </header>
    {message && <p role="status" className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">{message}</p>}
    {link && <div className="rounded-lg border border-border bg-card p-3 text-sm"><p>رابط المباشرة (يصلح للاستخدام خلال مدة الإشعار):</p><a dir="ltr" href={link} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">{link}</a></div>}
    <OperationsQueryFeedback state={branchesState} loading="جار التحقق من نطاق الفروع المصرّح به…" failure="تعذر تحميل الفروع المصرّح بها." error={branches.error} onRetry={() => branches.refetch()} />
    {branchesState === "ready" && branches.data?.length === 0 && <p className="rounded-lg border border-border p-5">ليس لديك فروع مصرّح بها لإدارة موظفي التشغيل.</p>}
    {branchesState === "ready" && !!branchSelection && !branch && <p role="alert" className="text-destructive">الفرع المطلوب غير متاح ضمن صلاحياتك. اختر فرعًا مسموحًا؛ لم نعرض بيانات فرع آخر.</p>}
    {branchesState === "ready" && !!branches.data?.length && <>
      <label className="block max-w-sm text-sm font-semibold">الفرع
        <select value={branch?.id ?? ""} onChange={e => { setBranchSelection(e.target.value); setEmployeeSelection(""); setDestination(""); }} className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3">
          {!branch && <option value="">اختر فرعًا مسموحًا</option>}
          {branches.data.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}
        </select>
      </label>
      {!authorizedBranch && branches.isFetching && <p role="status" className="text-sm text-muted-foreground">جار التحقق من نطاق الفروع المصرّح به…</p>}
      <div className="flex gap-2" aria-label="مجال موارد التشغيل">
        <Button variant={activeTab === "employees" ? "default" : "outline"} onClick={() => setActiveTab("employees")}>الموظفون</Button>
        <Button variant={activeTab === "payroll" ? "default" : "outline"} onClick={() => setActiveTab("payroll")}>مراجعة رواتب الشهر</Button>
      </div>
      {activeTab === "employees" && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">الموظفون في {branch?.name}</h2>
        <OperationsQueryFeedback state={operationsReadState(authorizedBranch, employees)} loading="جار تحميل موظفي الفرع المحدد…" failure="تعذر تحميل الموظفين." error={employees.error} onRetry={() => employees.refetch()} />
        {!branch && <p className="mt-3 text-sm text-muted-foreground">اختر فرعًا مصرّحًا به لعرض الموظفين.</p>}
        <div className="mt-3 max-h-64 overflow-auto text-sm">{employeesReady && employees.data?.map(e =>
          <div key={e.id} className="flex justify-between gap-4 border-b border-border py-2"><span>{e.employeeName} · {e.jobTitle}</span><span className="text-muted-foreground">{e.status}</span></div>
        )}{employeesReady && employees.data?.length === 0 && <p className="text-muted-foreground">لا يوجد موظفون في هذا الفرع.</p>}</div>
      </section>}
      {activeTab === "payroll" && !canView("operations_payroll") && <p role="alert" className="rounded-xl border border-border p-4">لا تملك صلاحية عرض رواتب التشغيل. لم تُعرض قائمة الموظفين كبديل لتقرير الرواتب.</p>}
      {activeTab === "payroll" && canView("operations_payroll") && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">تقرير الرواتب والمراجعة</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-sm">الشهر <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="mt-1 w-44" /></label>
          {canExport("operations_payroll") && <Button variant="outline" onClick={exportPayroll} disabled={!reportReady || mutation.isPending}>تصدير تقرير الفرع</Button>}
          {canApprove("operations_payroll") && <Button onClick={review} disabled={!reportReady || mutation.isPending}>اعتماد مراجعة التشغيل</Button>}
        </div>
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
      {activeTab === "employees" && canView("operations_joining") && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">الموظفون الجدد وإشعارات المباشرة</h2><p className="text-xs text-muted-foreground">عروض العمل المقبولة في الفرع المختار: أرسل الرابط، ثم اعتمد المباشرة بعد توقيع الموظف لإشعار مدير شؤون الموظفين.</p>
        <OperationsQueryFeedback state={joiningState} loading="جار تحميل عروض العمل المقبولة…" failure="تعذر تحميل إشعارات المباشرة." error={joining.error} onRetry={() => joining.refetch()} />
        {!branch && !branches.isFetching && <p className="mt-3 text-sm text-muted-foreground">اختر فرعًا مصرّحًا به لعرض إشعارات المباشرة.</p>}
        <div className="mt-3 space-y-2">{joiningState === "ready" && joining.data?.filter(item => item.branchId === branch?.id).map(item =>
          <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-border py-2 text-sm">
            <div className="min-w-0 flex-1"><span>{item.candidateName} · {item.position}</span>
              <p className="mt-1 text-xs text-muted-foreground">{item.notification ? joiningStatus[item.notification.status] || item.notification.status : "عرض مقبول؛ لم يُنشأ إشعار مباشرة"}</p>
              {item.notification && <p className="text-xs text-muted-foreground">تاريخ المباشرة: {item.notification.actualStartDate}{item.notification.signedAt ? ` · وقّع الموظف: ${dateTime(item.notification.signedAt)}` : ""}</p>}
              {item.notification?.confirmedAt && <p className="text-xs text-muted-foreground">اعتمد بواسطة: {item.notification.confirmedByName || item.notification.confirmedBy || "غير مسجل"} · {dateTime(item.notification.confirmedAt)}{item.notification.confirmedNotes ? ` · ${item.notification.confirmedNotes}` : ""}</p>}
            </div>
            {!item.notification && canCreate("operations_joining") && <Input aria-label={`تاريخ مباشرة ${item.candidateName}`} type="date" value={startDates[item.id] ?? ""} onChange={e => setStartDates({ ...startDates, [item.id]: e.target.value })} className="w-44" />}
            {canCreate("operations_joining") && (!item.notification || ["pending", "sent"].includes(item.notification.status)) && <Button variant="outline" disabled={!authorizedBranch || mutation.isPending || joining.isFetching || (!item.notification && !startDates[item.id])} onClick={() => sendJoining(item)}>{item.notification?.status === "sent" ? "إعادة إرسال رابط المباشرة" : "إرسال رابط المباشرة"}</Button>}
            {item.notification?.status === "signed" && canApprove("operations_joining") && <Button disabled={!authorizedBranch || mutation.isPending || joining.isFetching} onClick={() => { setConfirmJoiningId(item.notification!.id); setConfirmNotes(""); }}>اعتماد المباشرة وإشعار شؤون الموظفين</Button>}
            {item.notification?.status === "signed" && !canApprove("operations_joining") && <p className="text-xs text-muted-foreground">تحتاج صلاحية اعتماد مباشرة التشغيل.</p>}
            {confirmJoiningId === item.notification?.id && <form className="w-full space-y-2 rounded-lg border border-border bg-muted/30 p-3" onSubmit={event => { event.preventDefault(); void confirmJoining(); }}>
              <p className="text-xs">تأكيد اعتماد المباشرة التي وقّعها الموظف بتاريخها المسجل وإشعار مدير شؤون الموظفين؛ لا يحوّل العرض إلى ملف موظف تلقائيًا.</p>
              <Input value={confirmNotes} onChange={event => setConfirmNotes(event.target.value)} maxLength={1000} placeholder="ملاحظة الاعتماد (اختيارية)" aria-label="ملاحظة اعتماد المباشرة" />
              <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!authorizedBranch || mutation.isPending || joining.isFetching}>تأكيد الاعتماد والإشعار</Button><Button type="button" variant="outline" onClick={() => setConfirmJoiningId(null)}>إلغاء</Button></div>
            </form>}
          </div>
        )}</div>
        {joiningState === "ready" && !joining.data?.some(item => item.branchId === branch?.id) && <p className="mt-3 text-sm text-muted-foreground">لا توجد عروض مقبولة بانتظار استكمال المباشرة في الفرع المختار.</p>}
      </section>}
      {activeTab === "employees" && canView("operations_employee_transfer") && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">نقل الموظفين وسجل التحويلات</h2>
        {canCreate("operations_employee_transfer") && <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select aria-label="الموظف المراد نقله" disabled={!employeesReady} value={employeeSelection} onChange={e => setEmployeeSelection(e.target.value)} className="min-h-11 rounded-lg border border-input bg-background px-2"><option value="">اختر موظفاً في {branch?.name}</option>{employeesReady && employees.data?.filter(e => e.status === "active").map(e => <option key={e.id} value={e.id}>{e.employeeName}</option>)}</select>
          <select aria-label="فرع الوجهة" value={destination} onChange={e => setDestination(e.target.value)} className="min-h-11 rounded-lg border border-input bg-background px-2"><option value="">اختر فرع الوجهة</option>{branches.data.filter(b => b.id !== branch?.id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <Input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="سبب النقل" aria-label="سبب النقل" />
          <Button disabled={!employeesReady || mutation.isPending || !employeeSelection || !destination || !reason.trim()} onClick={transfer}>تنفيذ النقل وتسجيله</Button>
        </div>}
        <OperationsQueryFeedback state={transfersState} loading="جار تحميل سجل النقل…" failure="تعذر تحميل سجل النقل." error={transfers.error} onRetry={() => transfers.refetch()} />
        {!branch && <p className="mt-3 text-sm text-muted-foreground">اختر فرعًا مصرّحًا به لعرض سجل النقل.</p>}
        <div className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">{transfersState === "ready" && transfers.data?.filter(t => t.sourceBranchId === branch?.id || t.destinationBranchId === branch?.id).map(t => <div key={t.id} className="border-b border-border py-2">
          <strong>{t.employeeName}</strong> · من {branchName(t.sourceBranchId)} إلى {branchName(t.destinationBranchId)} · {t.reason}
          <p className="text-xs text-muted-foreground">طلب بواسطة: {t.requestedByName || t.requestedBy} · {dateTime(t.requestedAt)} · {t.status === "completed" ? "تم النقل" : t.status}</p>
          <ol className="mt-2 space-y-1 border-r-2 border-primary/20 pr-3">{t.history.map(event => <li key={event.id} className="text-xs">
            <strong>{event.eventType === "completed" ? "تنفيذ النقل" : event.eventType === "requested" ? "طلب النقل" : event.eventType}</strong> · {event.performedByName || event.performedBy || "المنفّذ غير مسجل"} · {dateTime(event.eventTimestamp)}
            {event.details?.reason && <p className="text-muted-foreground">السبب المسجل: {event.details.reason}</p>}
          </li>)}</ol>
        </div>)}{transfersState === "ready" && !transfers.data?.some(t => t.sourceBranchId === branch?.id || t.destinationBranchId === branch?.id) && <p>لا يوجد سجل نقل في الفرع المختار.</p>}</div>
      </section>}
    </>}
  </main>;
}