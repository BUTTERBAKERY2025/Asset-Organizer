import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/usePermissions";

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
type Payroll = {
  lines: { branchEmployeeId?: number; employeeName: string; grossSalary?: number; netSalary?: number }[];
  totals: { totalNet: number; employeeCount: number };
  isLocked: boolean;
  reviews: { id: number; reviewedBy: string; reviewedByName?: string; reviewedAt: string; note: string | null }[];
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
  const { canView, canCreate, canApprove, canExport } = permissions;
  const [activeTab, setActiveTab] = useState<"employees" | "payroll">(() => new URLSearchParams(window.location.search).get("tab") === "payroll" ? "payroll" : "employees");
  const [branchSelection, setBranchSelection] = useState(() => new URLSearchParams(window.location.search).get("branchId") || "");
  const [month, setMonth] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("month");
    return requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested)
      ? requested : new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 7);
  });
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
    staleTime: 0, gcTime: 0,
  });
  const branch = branchSelection ? branches.data?.find(b => b.id === branchSelection) : branches.data?.[0];
  const branchName = (id: string) => branches.data?.find(b => b.id === id)?.name ?? id;
  useEffect(() => {
    setLink(""); setMessage(""); setConfirmJoiningId(null); setConfirmNotes("");
    setEmployeeSelection(""); setDestination(""); setReason("");
  }, [branchSelection, month]);
  const employees = useQuery<Employee[]>({
    queryKey: ["/api/operations-hr/employees", branch?.id],
    queryFn: async () => (await apiRequest("GET", `/api/operations-hr/employees?branchId=${encodeURIComponent(branch!.id)}`)).json(),
    enabled: !!branch && activeTab === "employees", staleTime: 0, gcTime: 0,
  });
  const payroll = useQuery<Payroll>({
    queryKey: ["/api/operations-hr/payroll", branch?.id, month],
    queryFn: async () => (await apiRequest("GET", `/api/operations-hr/payroll?${new URLSearchParams({ branchId: branch!.id, month })}`)).json(),
    enabled: !!branch && !!month && canView("operations_payroll"), staleTime: 0, gcTime: 0,
  });
  const transfers = useQuery<Transfer[]>({
    queryKey: ["/api/operations-hr/transfers"],
    queryFn: async () => (await apiRequest("GET", "/api/operations-hr/transfers")).json(),
    enabled: activeTab === "employees" && canView("operations_employee_transfer"), staleTime: 0, gcTime: 0,
  });
  const joining = useQuery<Joining[]>({
    queryKey: ["/api/operations-hr/joining"],
    queryFn: async () => (await apiRequest("GET", "/api/operations-hr/joining")).json(),
    enabled: activeTab === "employees" && canView("operations_joining"), staleTime: 0, gcTime: 0,
  });
  const mutation = useMutation({
    mutationFn: async ({ url, body }: { url: string; body: unknown }) =>
      (await apiRequest("POST", url, body)).json(),
    onError: (error: Error) => setMessage(error.message || "تعذر إكمال العملية"),
  });
  const transfer = async () => {
    if (!branch || !employeeSelection || !destination || !reason.trim()) return setMessage("حدد الموظف والفرع الجديد وسبب النقل.");
    setMessage("");
    try {
      await mutation.mutateAsync({ url: "/api/operations-hr/transfers", body: {
        employeeId: Number(employeeSelection), sourceBranchId: branch.id, destinationBranchId: destination, reason,
      } });
      setEmployeeSelection(""); setDestination(""); setReason("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["/api/operations-hr/employees"] }),
        client.invalidateQueries({ queryKey: ["/api/operations-hr/transfers"] }),
      ]);
      setMessage("تم النقل وحفظ اسم منفذه ووقت التنفيذ في السجل.");
    } catch { /* onError surfaces the server message */ }
  };
  const review = async () => {
    if (!branch) return;
    setMessage("");
    try {
      await mutation.mutateAsync({ url: "/api/operations-hr/payroll/review", body: { branchId: branch.id, month } });
      await client.invalidateQueries({ queryKey: ["/api/operations-hr/payroll"] });
      setMessage("سُجلت المراجعة الاستشارية؛ لا توقف اعتماد شؤون الموظفين.");
    } catch { /* onError surfaces the server message */ }
  };
  const exportPayroll = async () => {
    if (!branch) return;
    try {
      const result = await apiRequest("GET", `/api/operations-hr/payroll/export?${new URLSearchParams({ branchId: branch.id, month })}`);
      const url = URL.createObjectURL(await result.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `operations-payroll-${month}.csv`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر تصدير الرواتب"); }
  };
  const sendJoining = async (item: Joining) => {
    if (!branch || item.branchId !== branch.id || joining.isFetching) return;
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
      }
      const sent = await mutation.mutateAsync({ url: `/api/operations-hr/joining/${id}/send`, body: {} });
      setLink(sent.link);
      setMessage(sent.whatsapp?.success ? "أُرسل رابط المباشرة عبر واتساب." : "أُنشئ الرابط؛ تعذر إرسال واتساب، يمكنك نسخ الرابط.");
      await client.invalidateQueries({ queryKey: ["/api/operations-hr/joining"] });
    } catch { /* onError surfaces the server message */ }
  };
  const confirmJoining = async () => {
    const item = joining.data?.find(row => row.notification?.id === confirmJoiningId);
    if (!branch || !item || item.branchId !== branch.id || item.notification?.status !== "signed" || joining.isFetching) return;
    setMessage("");
    try {
      const result = await mutation.mutateAsync({ url: `/api/operations-hr/joining/${confirmJoiningId}/confirm`, body: { notes: confirmNotes.trim() } });
      setConfirmJoiningId(null); setConfirmNotes("");
      await client.invalidateQueries({ queryKey: ["/api/operations-hr/joining"] });
      setMessage(result.alreadyConfirmed ? "المباشرة معتمدة بالفعل؛ لم يُرسل إشعار مكرر."
        : "اعتُمدت المباشرة وأُنشئ إشعار لمدير شؤون الموظفين. استكمال ملف الموظف من اختصاص شؤون الموظفين.");
    } catch {
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
    {branches.isError && <p role="alert">تعذر تحميل الفروع المصرّح بها. أعد المحاولة.</p>}
    {branches.data?.length === 0 && <p className="rounded-lg border border-border p-5">ليس لديك فروع مصرّح بها لإدارة موظفي التشغيل.</p>}
    {!branches.isPending && !branches.isError && !!branchSelection && !branch && <p role="alert" className="text-destructive">الفرع المطلوب غير متاح ضمن صلاحياتك. اختر فرعًا مسموحًا؛ لم نعرض بيانات فرع آخر.</p>}
    {!branches.isError && !!branches.data?.length && <>
      <label className="block max-w-sm text-sm font-semibold">الفرع
        <select value={branch?.id ?? ""} onChange={e => { setBranchSelection(e.target.value); setEmployeeSelection(""); setDestination(""); }} className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3">
          {!branch && <option value="">اختر فرعًا مسموحًا</option>}
          {branches.data.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}
        </select>
      </label>
      <div className="flex gap-2" aria-label="مجال موارد التشغيل">
        <Button variant={activeTab === "employees" ? "default" : "outline"} onClick={() => setActiveTab("employees")}>الموظفون</Button>
        <Button variant={activeTab === "payroll" ? "default" : "outline"} onClick={() => setActiveTab("payroll")}>مراجعة رواتب الشهر</Button>
      </div>
      {activeTab === "employees" && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">الموظفون في {branch?.name}</h2>
        {employees.isError && <p role="alert">تعذر تحميل الموظفين.</p>}
        <div className="mt-3 max-h-64 overflow-auto text-sm">{!employees.isError && employees.data?.map(e =>
          <div key={e.id} className="flex justify-between gap-4 border-b border-border py-2"><span>{e.employeeName} · {e.jobTitle}</span><span className="text-muted-foreground">{e.status}</span></div>
        )}{!employees.isError && employees.data?.length === 0 && <p className="text-muted-foreground">لا يوجد موظفون في هذا الفرع.</p>}</div>
      </section>}
      {activeTab === "payroll" && !canView("operations_payroll") && <p role="alert" className="rounded-xl border border-border p-4">لا تملك صلاحية عرض رواتب التشغيل. لم تُعرض قائمة الموظفين كبديل لتقرير الرواتب.</p>}
      {activeTab === "payroll" && canView("operations_payroll") && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">تقرير الرواتب والمراجعة</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-sm">الشهر <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="mt-1 w-44" /></label>
          {canExport("operations_payroll") && <Button variant="outline" onClick={exportPayroll} disabled={!payroll.data || payroll.isError}>تصدير تقرير الفرع</Button>}
          {canApprove("operations_payroll") && <Button onClick={review} disabled={!payroll.data || payroll.isError || payroll.isFetching || mutation.isPending}>اعتماد مراجعة التشغيل</Button>}
        </div>
        {payroll.isPending && branch && <p role="status">جار تحميل رواتب الفرع والشهر المحددين…</p>}
        {payroll.isError && <p role="alert">تعذر تحميل تقرير الرواتب. <Button variant="outline" size="sm" onClick={() => payroll.refetch()}>إعادة المحاولة</Button></p>}
        {!payroll.isError && payroll.data && <><p className="mt-3 text-sm">عدد الموظفين: {payroll.data.totals.employeeCount} · الصافي: {payroll.data.totals.totalNet.toLocaleString("en-US")} · {payroll.data.isLocked ? "لقطة إغلاق محفوظة" : "معاينة حية قابلة للتغير"}</p>
          <div className="mt-2 max-h-72 overflow-auto"><table className="w-full text-right text-sm"><thead><tr><th className="py-2">الموظف</th><th>الإجمالي</th><th>الصافي</th></tr></thead><tbody>{payroll.data.lines.map((line, i) =>
            <tr key={`${line.branchEmployeeId ?? i}`} className="border-t border-border"><td className="py-2">{line.employeeName}</td><td>{Number(line.grossSalary ?? 0).toLocaleString("en-US")}</td><td>{Number(line.netSalary ?? 0).toLocaleString("en-US")}</td></tr>
          )}</tbody></table></div>
          <p className="mt-2 text-xs text-muted-foreground">مراجعات مسجلة: {payroll.data.reviews.length} · لا تؤثر على إغلاق الرواتب أو صرفها.</p>
          <p className="mt-1 text-xs text-muted-foreground">اعتماد مراجعة التشغيل استشاري؛ لا يوقف شؤون الموظفين ولا يُعد اعتمادًا ماليًا.</p>
          {payroll.data.reviews.map(item => <p key={item.id} className="mt-2 rounded-lg bg-muted p-2 text-xs">
            مراجعة التشغيل مسجلة بواسطة {item.reviewedByName || item.reviewedBy} · {dateTime(item.reviewedAt)}{item.note ? ` · ${item.note}` : ""}
          </p>)}
        </>}
      </section>}
      {activeTab === "employees" && canView("operations_joining") && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">الموظفون الجدد وإشعارات المباشرة</h2><p className="text-xs text-muted-foreground">عروض العمل المقبولة في الفرع المختار: أرسل الرابط، ثم اعتمد المباشرة بعد توقيع الموظف لإشعار مدير شؤون الموظفين.</p>
        {joining.isError && <p role="alert">تعذر تحميل إشعارات المباشرة.</p>}
        {joining.isPending && <p role="status">جار تحميل عروض العمل المقبولة…</p>}
        <div className="mt-3 space-y-2">{!joining.isError && joining.data?.filter(item => item.branchId === branch?.id).map(item =>
          <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-border py-2 text-sm">
            <div className="min-w-0 flex-1"><span>{item.candidateName} · {item.position}</span>
              <p className="mt-1 text-xs text-muted-foreground">{item.notification ? joiningStatus[item.notification.status] || item.notification.status : "عرض مقبول؛ لم يُنشأ إشعار مباشرة"}</p>
              {item.notification && <p className="text-xs text-muted-foreground">تاريخ المباشرة: {item.notification.actualStartDate}{item.notification.signedAt ? ` · وقّع الموظف: ${dateTime(item.notification.signedAt)}` : ""}</p>}
              {item.notification?.confirmedAt && <p className="text-xs text-muted-foreground">اعتمد بواسطة: {item.notification.confirmedByName || item.notification.confirmedBy || "غير مسجل"} · {dateTime(item.notification.confirmedAt)}{item.notification.confirmedNotes ? ` · ${item.notification.confirmedNotes}` : ""}</p>}
            </div>
            {!item.notification && canCreate("operations_joining") && <Input aria-label={`تاريخ مباشرة ${item.candidateName}`} type="date" value={startDates[item.id] ?? ""} onChange={e => setStartDates({ ...startDates, [item.id]: e.target.value })} className="w-44" />}
            {canCreate("operations_joining") && (!item.notification || ["pending", "sent"].includes(item.notification.status)) && <Button variant="outline" disabled={mutation.isPending || joining.isFetching || (!item.notification && !startDates[item.id])} onClick={() => sendJoining(item)}>{item.notification?.status === "sent" ? "إعادة إرسال رابط المباشرة" : "إرسال رابط المباشرة"}</Button>}
            {item.notification?.status === "signed" && canApprove("operations_joining") && <Button disabled={mutation.isPending || joining.isFetching} onClick={() => { setConfirmJoiningId(item.notification!.id); setConfirmNotes(""); }}>اعتماد المباشرة وإشعار شؤون الموظفين</Button>}
            {item.notification?.status === "signed" && !canApprove("operations_joining") && <p className="text-xs text-muted-foreground">تحتاج صلاحية اعتماد مباشرة التشغيل.</p>}
            {confirmJoiningId === item.notification?.id && <form className="w-full space-y-2 rounded-lg border border-border bg-muted/30 p-3" onSubmit={event => { event.preventDefault(); void confirmJoining(); }}>
              <p className="text-xs">تأكيد اعتماد المباشرة التي وقّعها الموظف بتاريخها المسجل وإشعار مدير شؤون الموظفين؛ لا يحوّل العرض إلى ملف موظف تلقائيًا.</p>
              <Input value={confirmNotes} onChange={event => setConfirmNotes(event.target.value)} maxLength={1000} placeholder="ملاحظة الاعتماد (اختيارية)" aria-label="ملاحظة اعتماد المباشرة" />
              <div className="flex flex-wrap gap-2"><Button type="submit" disabled={mutation.isPending || joining.isFetching}>تأكيد الاعتماد والإشعار</Button><Button type="button" variant="outline" onClick={() => setConfirmJoiningId(null)}>إلغاء</Button></div>
            </form>}
          </div>
        )}</div>
        {!joining.isPending && !joining.isError && !joining.data?.some(item => item.branchId === branch?.id) && <p className="mt-3 text-sm text-muted-foreground">لا توجد عروض مقبولة بانتظار استكمال المباشرة في الفرع المختار.</p>}
      </section>}
      {activeTab === "employees" && canView("operations_employee_transfer") && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">نقل الموظفين وسجل التحويلات</h2>
        {canCreate("operations_employee_transfer") && <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select aria-label="الموظف المراد نقله" value={employeeSelection} onChange={e => setEmployeeSelection(e.target.value)} className="min-h-11 rounded-lg border border-input bg-background px-2"><option value="">اختر موظفاً في {branch?.name}</option>{!employees.isError && employees.data?.filter(e => e.status === "active").map(e => <option key={e.id} value={e.id}>{e.employeeName}</option>)}</select>
          <select aria-label="فرع الوجهة" value={destination} onChange={e => setDestination(e.target.value)} className="min-h-11 rounded-lg border border-input bg-background px-2"><option value="">اختر فرع الوجهة</option>{branches.data.filter(b => b.id !== branch?.id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <Input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="سبب النقل" aria-label="سبب النقل" />
          <Button disabled={mutation.isPending || !employeeSelection || !destination || !reason.trim()} onClick={transfer}>تنفيذ النقل وتسجيله</Button>
        </div>}
        {transfers.isError && <p role="alert">تعذر تحميل سجل النقل.</p>}
        <div className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">{!transfers.isError && transfers.data?.filter(t => t.sourceBranchId === branch?.id || t.destinationBranchId === branch?.id).map(t => <div key={t.id} className="border-b border-border py-2">
          <strong>{t.employeeName}</strong> · من {branchName(t.sourceBranchId)} إلى {branchName(t.destinationBranchId)} · {t.reason}
          <p className="text-xs text-muted-foreground">طلب بواسطة: {t.requestedByName || t.requestedBy} · {dateTime(t.requestedAt)} · {t.status === "completed" ? "تم النقل" : t.status}</p>
          <ol className="mt-2 space-y-1 border-r-2 border-primary/20 pr-3">{t.history.map(event => <li key={event.id} className="text-xs">
            <strong>{event.eventType === "completed" ? "تنفيذ النقل" : event.eventType === "requested" ? "طلب النقل" : event.eventType}</strong> · {event.performedByName || event.performedBy || "المنفّذ غير مسجل"} · {dateTime(event.eventTimestamp)}
            {event.details?.reason && <p className="text-muted-foreground">السبب المسجل: {event.details.reason}</p>}
          </li>)}</ol>
        </div>)}{!transfers.isError && transfers.data?.length === 0 && <p>لا يوجد سجل نقل ضمن الفروع المصرّح بها.</p>}</div>
      </section>}
    </>}
  </main>;
}