import { useState } from "react";
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
  history: { id: number; performedBy: string | null; eventTimestamp: string; eventType: string }[];
};
type Joining = {
  id: number; candidateName: string; branchId: string; position: string;
  notification: { id: number; status: string; actualStartDate: string } | null;
};
type Payroll = {
  lines: { branchEmployeeId?: number; employeeName: string; grossSalary?: number; netSalary?: number }[];
  totals: { totalNet: number; employeeCount: number };
  isLocked: boolean;
  reviews: { id: number; reviewedBy: string; reviewedAt: string; note: string | null }[];
};

export default function OperationsHrPage() {
  const client = useQueryClient();
  const { canView, canCreate, canApprove, canExport } = usePermissions();
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
  const branches = useQuery<Branch[]>({
    queryKey: ["/api/operations-hr/branches"], queryFn: async () => (await apiRequest("GET", "/api/operations-hr/branches")).json(),
    staleTime: 0, gcTime: 0,
  });
  const branch = branches.data?.find(b => b.id === branchSelection) ?? branches.data?.[0];
  const branchName = (id: string) => branches.data?.find(b => b.id === id)?.name ?? id;
  const employees = useQuery<Employee[]>({
    queryKey: ["/api/operations-hr/employees", branch?.id],
    queryFn: async () => (await apiRequest("GET", `/api/operations-hr/employees?branchId=${encodeURIComponent(branch!.id)}`)).json(),
    enabled: !!branch, staleTime: 0, gcTime: 0,
  });
  const payroll = useQuery<Payroll>({
    queryKey: ["/api/operations-hr/payroll", branch?.id, month],
    queryFn: async () => (await apiRequest("GET", `/api/operations-hr/payroll?${new URLSearchParams({ branchId: branch!.id, month })}`)).json(),
    enabled: !!branch && !!month && canView("operations_payroll"), staleTime: 0, gcTime: 0,
  });
  const transfers = useQuery<Transfer[]>({
    queryKey: ["/api/operations-hr/transfers"],
    queryFn: async () => (await apiRequest("GET", "/api/operations-hr/transfers")).json(),
    enabled: canView("operations_employee_transfer"), staleTime: 0, gcTime: 0,
  });
  const joining = useQuery<Joining[]>({
    queryKey: ["/api/operations-hr/joining"],
    queryFn: async () => (await apiRequest("GET", "/api/operations-hr/joining")).json(),
    enabled: canView("operations_joining"), staleTime: 0, gcTime: 0,
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
    setMessage(""); setLink("");
    try {
      let id = item.notification?.id;
      if (!id) {
        const created = await mutation.mutateAsync({ url: "/api/operations-hr/joining", body: {
          offerId: item.id, actualStartDate: startDates[item.id],
        } });
        id = created.id;
      }
      const sent = await mutation.mutateAsync({ url: `/api/operations-hr/joining/${id}/send`, body: {} });
      setLink(sent.link);
      setMessage(sent.whatsapp?.success ? "أُرسل رابط المباشرة عبر واتساب." : "أُنشئ الرابط؛ تعذر إرسال واتساب، يمكنك نسخ الرابط.");
      await client.invalidateQueries({ queryKey: ["/api/operations-hr/joining"] });
    } catch { /* onError surfaces the server message */ }
  };
  return <Layout><main dir="rtl" className="page-container mx-auto max-w-6xl space-y-6 pb-12">
    <header className="border-b border-border pb-4"><p className="text-sm font-bold text-primary">إدارة التشغيل / الموارد البشرية</p>
      <h1 className="mt-1 text-2xl font-black">مركز موارد التشغيل</h1>
      <p className="text-sm text-muted-foreground">موظفو الفروع المصرّح لك بها فقط، باستثناء الإدارة العامة. مراجعة الرواتب استشارية ولا تعطل اعتماد شؤون الموظفين.</p>
    </header>
    {message && <p role="status" className="rounded-lg border border-border bg-muted px-4 py-3 text-sm">{message}</p>}
    {link && <div className="rounded-lg border border-border bg-card p-3 text-sm"><p>رابط المباشرة (يصلح للاستخدام خلال مدة الإشعار):</p><a dir="ltr" href={link} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">{link}</a></div>}
    {branches.isError && <p role="alert">تعذر تحميل الفروع المصرّح بها. أعد المحاولة.</p>}
    {branches.data?.length === 0 && <p className="rounded-lg border border-border p-5">ليس لديك فروع مصرّح بها لإدارة موظفي التشغيل.</p>}
    {!branches.isError && !!branches.data?.length && <>
      <label className="block max-w-sm text-sm font-semibold">الفرع
        <select value={branch?.id ?? ""} onChange={e => { setBranchSelection(e.target.value); setEmployeeSelection(""); setDestination(""); }} className="mt-2 min-h-11 w-full rounded-lg border border-input bg-background px-3">
          {branches.data.map(b => <option value={b.id} key={b.id}>{b.name}</option>)}
        </select>
      </label>
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">الموظفون في {branch?.name}</h2>
        {employees.isError && <p role="alert">تعذر تحميل الموظفين.</p>}
        <div className="mt-3 max-h-64 overflow-auto text-sm">{!employees.isError && employees.data?.map(e =>
          <div key={e.id} className="flex justify-between gap-4 border-b border-border py-2"><span>{e.employeeName} · {e.jobTitle}</span><span className="text-muted-foreground">{e.status}</span></div>
        )}{!employees.isError && employees.data?.length === 0 && <p className="text-muted-foreground">لا يوجد موظفون في هذا الفرع.</p>}</div>
      </section>
      {canView("operations_payroll") && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">تقرير الرواتب والمراجعة</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-sm">الشهر <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="mt-1 w-44" /></label>
          {canExport("operations_payroll") && <Button variant="outline" onClick={exportPayroll} disabled={!payroll.data || payroll.isError}>تصدير تقرير الفرع</Button>}
          {canApprove("operations_payroll") && <Button onClick={review} disabled={!payroll.data || payroll.isError || mutation.isPending}>تسجيل مراجعة استشارية</Button>}
        </div>
        {payroll.isError && <p role="alert">تعذر تحميل تقرير الرواتب.</p>}
        {!payroll.isError && payroll.data && <><p className="mt-3 text-sm">عدد الموظفين: {payroll.data.totals.employeeCount} · الصافي: {payroll.data.totals.totalNet.toLocaleString("en-US")} · {payroll.data.isLocked ? "لقطة إغلاق محفوظة" : "معاينة حية قابلة للتغير"}</p>
          <div className="mt-2 max-h-72 overflow-auto"><table className="w-full text-right text-sm"><thead><tr><th className="py-2">الموظف</th><th>الإجمالي</th><th>الصافي</th></tr></thead><tbody>{payroll.data.lines.map((line, i) =>
            <tr key={`${line.branchEmployeeId ?? i}`} className="border-t border-border"><td className="py-2">{line.employeeName}</td><td>{Number(line.grossSalary ?? 0).toLocaleString("en-US")}</td><td>{Number(line.netSalary ?? 0).toLocaleString("en-US")}</td></tr>
          )}</tbody></table></div>
          <p className="mt-2 text-xs text-muted-foreground">مراجعات مسجلة: {payroll.data.reviews.length} · لا تؤثر على إغلاق الرواتب أو صرفها.</p>
        </>}
      </section>}
      {canView("operations_joining") && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">روابط المباشرة</h2><p className="text-xs text-muted-foreground">لأصحاب عروض العمل المقبولة في فروعك؛ لا تُرسل روابط لملفات موظفين آخرين.</p>
        {joining.isError && <p role="alert">تعذر تحميل إشعارات المباشرة.</p>}
        <div className="mt-3 space-y-2">{!joining.isError && joining.data?.filter(item => item.branchId === branch?.id).map(item =>
          <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-border py-2 text-sm">
            <span className="flex-1">{item.candidateName} · {item.position} · {item.notification?.status ?? "لم يُنشأ إشعار"}</span>
            {!item.notification && canCreate("operations_joining") && <Input aria-label={`تاريخ مباشرة ${item.candidateName}`} type="date" value={startDates[item.id] ?? ""} onChange={e => setStartDates({ ...startDates, [item.id]: e.target.value })} className="w-44" />}
            {canCreate("operations_joining") && (!item.notification || ["pending", "sent"].includes(item.notification.status)) && <Button variant="outline" disabled={mutation.isPending || (!item.notification && !startDates[item.id])} onClick={() => sendJoining(item)}>إنشاء / إرسال الرابط</Button>}
          </div>
        )}</div>
      </section>}
      {canView("operations_employee_transfer") && <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-bold">نقل الموظفين وسجل التحويلات</h2>
        {canCreate("operations_employee_transfer") && <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select aria-label="الموظف المراد نقله" value={employeeSelection} onChange={e => setEmployeeSelection(e.target.value)} className="min-h-11 rounded-lg border border-input bg-background px-2"><option value="">اختر موظفاً في {branch?.name}</option>{!employees.isError && employees.data?.filter(e => e.status === "active").map(e => <option key={e.id} value={e.id}>{e.employeeName}</option>)}</select>
          <select aria-label="فرع الوجهة" value={destination} onChange={e => setDestination(e.target.value)} className="min-h-11 rounded-lg border border-input bg-background px-2"><option value="">اختر فرع الوجهة</option>{branches.data.filter(b => b.id !== branch?.id).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <Input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="سبب النقل" aria-label="سبب النقل" />
          <Button disabled={mutation.isPending || !employeeSelection || !destination || !reason.trim()} onClick={transfer}>تنفيذ النقل وتسجيله</Button>
        </div>}
        {transfers.isError && <p role="alert">تعذر تحميل سجل النقل.</p>}
        <div className="mt-3 max-h-80 space-y-2 overflow-auto text-sm">{!transfers.isError && transfers.data?.map(t => <div key={t.id} className="border-b border-border py-2">
          <strong>{t.employeeName}</strong> · {branchName(t.sourceBranchId)} ← {branchName(t.destinationBranchId)} · {t.reason}
          <p className="text-xs text-muted-foreground">نفّذ بواسطة: {t.requestedByName || t.requestedBy} · {new Date(t.history[0]?.eventTimestamp ?? t.requestedAt).toLocaleString("ar-SA-u-nu-latn", { timeZone: "Asia/Riyadh" })} · {t.status}</p>
        </div>)}{!transfers.isError && transfers.data?.length === 0 && <p>لا يوجد سجل نقل ضمن الفروع المصرّح بها.</p>}</div>
      </section>}
    </>}
  </main></Layout>;
}