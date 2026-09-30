import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { OperationsMonthCommand, OperationsMonthWorkflow } from "@shared/operations-month-workflow";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { time } from "./record-sheet";
import { lastCompletedOperationsMonth, monthMoney, validMonthSource } from "./month-workflow-presentation";
import { monthlyReturnIntent, withMonthlyReturn } from "@/lib/operations-center-navigation";

type FileId = "payroll" | "expenses" | "closing" | "sales";
type Command = "close" | "reopen" | "declare" | "remove-declaration";
const files: { id: FileId; label: string }[] = [
  { id: "payroll", label: "الرواتب والصرف" }, { id: "expenses", label: "المصروفات" },
  { id: "closing", label: "الإغلاقات التشغيلية" }, { id: "sales", label: "المبيعات والنتائج" },
];
const statusLabel = { closed: "مغلق", open: "مفتوح", reopened: "أعيد فتحه", not_closed: "لم تُغلق الرواتب", unavailable: "غير متاح" };
const actionLabel: Record<Command, string> = { close: "إغلاق المراجعة التشغيلية للشهر", reopen: "إعادة فتح الشهر", declare: "توثيق يوم غير تشغيلي", "remove-declaration": "إلغاء توثيق اليوم" };
const outstandingAmount = (remaining: number | null) => remaining === null ? null : Math.max(0, remaining);
const excessAmount = (balance: { overpaid: number | null }) => balance.overpaid;
const settlementLabel: Record<OperationsMonthWorkflow["payroll"]["settlementStatus"], string> = {
  unavailable: "غير متاح", not_closed: "لا توجد لقطة مغلقة", unreconciled: "دفعات تحتاج مطابقة",
  unknown_amount: "مبالغ صرف غير مؤكدة", unpaid: "لم يُسجل صرف", partial: "صرف جزئي",
  paid: "الاستحقاق مطابق للصرف المسجل", overpaid: "زيادة صرف تحتاج مطابقة",
};

export function OperationsMonthWorkspace({ branches, actorId, open }: {
  branches: { id: string; name: string }[]; actorId?: string;
  open: (href: string, branchId: string) => void;
}) {
  const [intent] = useState(() => monthlyReturnIntent(window.location.search, branches.map(branch => branch.id)));
  const [branchId, setBranchId] = useState(intent.branchId || (branches.length === 1 ? branches[0].id : ""));
  const [month, setMonth] = useState(intent.month || lastCompletedOperationsMonth());
  const [file, setFile] = useState<FileId | null>(intent.file);
  const [detail, setDetail] = useState(!!intent.file && !!intent.branchId);
  const [command, setCommand] = useState<Command | null>(null);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<{ scope: string; message: string } | null>(null);
  const client = useQueryClient();
  const validScope = branches.some(branch => branch.id === branchId) && /^20\d{2}-(0[1-9]|1[0-2])$/.test(month);
  const scope = `${actorId}:${branchId}:${month}`;
  const key = ["/api/operations-center/month-workflow", actorId, branchId, month];
  const query = useQuery<OperationsMonthWorkflow>({
    queryKey: key, enabled: validScope, retry: false, staleTime: 0,
    refetchOnWindowFocus: true, refetchInterval: 60_000,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/operations-center/month-workflow?${new URLSearchParams({ branchId, month })}`, {
        credentials: "include", cache: "no-store", signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || body?.message || `تعذر تحميل ملف الشهر (${response.status})`);
      }
      return response.json();
    },
  });
  const data = validScope && !query.isError && query.data?.branchId === branchId && query.data.month === month ? query.data : null;
  const mutation = useMutation({
    mutationFn: async (request: { action: Command; body: OperationsMonthCommand; scope: string; key: typeof key }) => {
      const response = await apiRequest("POST", `/api/operations-center/month-workflow/${request.action}`, request.body);
      return await response.json() as OperationsMonthWorkflow;
    },
    onSuccess: (result, request) => {
      if (result.branchId === request.body.branchId && result.month === request.body.month) client.setQueryData(request.key, result);
      setCommand(null); setNote(""); setDate(""); setError(null);
      void client.invalidateQueries({ queryKey: request.key });
      void client.invalidateQueries({ queryKey: ["/api/operations-center"] });
    },
    onError: (cause, request) => {
      setError({ scope: request.scope, message: cause instanceof Error ? cause.message : "تعذر حفظ الإجراء؛ لم نعتبر الشهر مغلقًا." });
      // A conflict/revocation invalidates the previous capability and revision.
      client.removeQueries({ queryKey: request.key, exact: true });
      if (request.scope === scope) void query.refetch();
    },
  });
  const reset = () => { setFile(null); setDetail(false); setCommand(null); setNote(""); setDate(""); setError(null); };
  const canAct = !!data && !query.isFetching && !mutation.isPending;
  const permitted = !!data && (command === "close" ? data.closing.canClose : command === "reopen" ? data.closing.canReopen : data.closing.canDeclare);
  const submit = () => {
    if (!command || !data || !canAct || !permitted || note.trim().length < 3) return;
    if ((command === "declare" || command === "remove-declaration") && !date.startsWith(`${month}-`)) return;
    mutation.mutate({ action: command, scope, key, body: { branchId, month, revision: data.closing.revision, note: note.trim(), ...(date ? { date } : {}) } });
  };
  const openMonthlySource = (href: string) => open(withMonthlyReturn(href, branchId, month, file, window.location.origin), branchId);
  const source = (href: string | null, label: string) => href && validMonthSource(href, branchId, month, window.location.origin)
    ? <Button type="button" variant="outline" size="sm" disabled={!canAct} onClick={() => openMonthlySource(href)}>{label}<ArrowUpLeft className="mr-1 size-4" /></Button> : null;
  const begin = (action: Command, selectedDate = "") => { setCommand(action); setDate(selectedDate); setNote(""); setError(null); };
  const branch = branches.find(item => item.id === branchId);
  const caption = (id: FileId) => !data ? "اختر فرعًا لتحميل الملف" : id === "payroll"
    ? data.payroll.available ? `${statusLabel[data.payroll.status]} · المتبقي ${monthMoney(outstandingAmount(data.payroll.remaining))}${(excessAmount(data.payroll) || 0) > 0 ? " · زيادة صرف تحتاج مطابقة" : ""}` : data.payroll.reason || "لا تتوفر صلاحية الرواتب"
    : id === "expenses" ? data.expenses.available ? `مصروفات مسجلة ${monthMoney(data.expenses.recorded)}` : data.expenses.reason || "لا تتوفر صلاحية المصروفات"
    : id === "closing" ? data.closing.available ? `${statusLabel[data.closing.status]}${data.closing.drifted ? " · تغيرت أدلة الإغلاق" : ""} · ${data.closing.blockers.length} عوائق` : data.closing.reason || "المصدر غير متاح"
    : data.sales.available ? `مبيعات مؤكدة ${monthMoney(data.sales.confirmed)}` : data.sales.reason || "لا تتوفر صلاحية المبيعات";

  return <div className="oc-workspace-grid" data-detail={detail} data-testid="operations-month-workspace">
    <div className="oc-workspace-list space-y-3">
      <label className="block text-xs font-bold">الشهر
        <input aria-label="شهر الإغلاق" type="month" value={month} disabled={mutation.isPending} onChange={event => { setMonth(event.target.value); reset(); }} className="mt-1 block min-h-10 w-full rounded-lg border border-violet-200 bg-[#fdfbff] px-3 text-sm" />
      </label>
      <label className="block text-xs font-bold">الفرع
        <select aria-label="فرع إغلاق الشهر" value={validScope ? branchId : ""} disabled={mutation.isPending} onChange={event => { setBranchId(event.target.value); reset(); }} className="mt-1 block min-h-10 w-full rounded-lg border border-violet-200 bg-[#fdfbff] px-3 text-sm">
          <option value="">اختر فرعًا — لا يوجد إجراء على كل الفروع</option>
          {branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">الشهر الافتراضي هو آخر شهر مكتمل. الإجراءات تخص فرعًا واحدًا وشهرًا واحدًا.</p>
      {query.isLoading && <p role="status" className="text-sm">جار تحميل ملف الشهر…</p>}
      {query.isError && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{query.error.message}</p><Button variant="outline" size="sm" onClick={() => query.refetch()}>إعادة المحاولة</Button></div>}
      {files.map(item => <button type="button" key={item.id} className="oc-list-item" data-active={file === item.id} disabled={!data || mutation.isPending} onClick={() => { setFile(item.id); setDetail(true); setCommand(null); }}>
        <strong className="block text-sm">{item.label}</strong><span className="mt-1 block text-xs text-muted-foreground">{caption(item.id)}</span>
      </button>)}
      {data && <p className="text-[11px] text-muted-foreground">آخر تحقق: {time(data.generatedAt)} <button type="button" aria-label="تحديث ملف الشهر" disabled={query.isFetching || mutation.isPending} onClick={() => query.refetch()}><RefreshCw className={`inline size-3.5 ${query.isFetching ? "animate-spin" : ""}`} /></button></p>}
    </div>
    <div className="oc-workspace-detail space-y-4">
      <button type="button" className="inline-flex items-center gap-1 text-sm font-bold text-violet-700 md:hidden" onClick={() => setDetail(false)}><ChevronRight className="size-4" />العودة للملفات والفرع</button>
      {!data || !file ? <p className="py-12 text-center text-sm text-muted-foreground">{!validScope ? "اختر الفرع والشهر، ثم افتح أحد الملفات الأربعة." : query.isError ? "تعذر التحقق من ملف الشهر؛ لا توجد إجراءات متاحة." : "اختر ملفًا لعرض تفاصيله والإجراء التالي."}</p> : <>
        <header><p className="text-xs font-bold text-violet-700">{branch?.name} · {month}</p><h3 className="mt-1 text-xl font-bold">{files.find(item => item.id === file)?.label}</h3></header>
        {error?.scope === scope && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error.message}</p>}
        {file === "payroll" && (data.payroll.available ? <>
          <div className="grid gap-2 sm:grid-cols-3">{[["مستحق الرواتب المغلقة", data.payroll.due], ["الصرف المسجل فعليًا", data.payroll.recordedPaid], ["المتبقي المؤكد", outstandingAmount(data.payroll.remaining)]].map(([label, value]) => <div key={String(label)} className="oc-panel p-3"><span className="text-xs text-muted-foreground">{label}</span><strong className="mt-1 block text-lg">{monthMoney(value as number | null)}</strong></div>)}</div>
          <p className="text-sm">حالة إغلاق الرواتب: <strong>{statusLabel[data.payroll.status]}</strong></p>
          <p className="text-sm">مطابقة الصرف: <strong>{settlementLabel[data.payroll.settlementStatus]}</strong> · الصرف المطابق للاستحقاق: {monthMoney(data.payroll.paid)}</p>
          <p className="text-xs text-muted-foreground">المستحق من لقطة الرواتب المحفوظة؛ الصرف من سجلات الدفع، وليس عدد الدفعات. {data.payroll.status === "not_closed" ? "لا توجد لقطة مغلقة؛ لا يمكن اعتبار الأرقام راتب الشهر النهائي." : ""}</p>
          {data.payroll.unknownPaymentAmounts > 0 && <p role="status" className="text-sm text-amber-800">توجد {data.payroll.unknownPaymentAmounts} دفعات غير محددة المبلغ؛ الصرف والمتبقي غير مؤكدين.</p>}
          {(excessAmount(data.payroll) || 0) > 0 && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><strong>زيادة صرف تحتاج مطابقة: {monthMoney(excessAmount(data.payroll))}</strong><span className="mt-1 block text-xs">هذه الزيادة ليست متبقيًا سالبًا ولا دليل تسوية؛ راجع بنود الاستحقاق وسجل الدفعات.</span></p>}
          {data.payroll.unreconciledPaymentCount > 0 && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">توجد {data.payroll.unreconciledPaymentCount} دفعات بمبلغ {monthMoney(data.payroll.unreconciledPaymentAmount)} بلا بند موظف مطابق في لقطة الرواتب المعروضة. يجب مطابقتها؛ وجودها ليس دليل سداد استحقاقات هذه اللقطة.</p>}
          {source(data.payroll.sourceHref, data.payroll.canManage ? "فتح إغلاق الرواتب وتسجيل الصرف" : "فتح مصدر الرواتب")}
          {!data.payroll.canManage && <p className="text-xs text-muted-foreground">ليس لديك إجراء مالي هنا. إغلاق الرواتب وتسجيل الصرف يخضعان لصلاحيات المصدر.</p>}
          <h4 className="font-bold">استحقاق الموظفين والصرف</h4>
          {!data.payroll.employees.length && <p className="text-sm text-muted-foreground">لا توجد بنود استحقاق محفوظة لهذا الشهر.</p>}
          {data.payroll.employees.map(item => <article key={item.employeeId} className="oc-panel p-3 text-sm"><strong>{item.name}</strong><p className="mt-1 text-xs">مستحق: {monthMoney(item.due)} · مصروف: {monthMoney(item.paid)} · متبقٍ: {monthMoney(outstandingAmount(item.remaining))}</p>{(excessAmount(item) || 0) > 0 && <p className="mt-1 text-xs font-bold text-amber-900">زيادة صرف تحتاج مطابقة: {monthMoney(excessAmount(item))}</p>}</article>)}
          <h4 className="font-bold">سجل الصرف</h4>
          {!data.payroll.payments.length && <p className="text-sm text-muted-foreground">لا توجد دفعات مسجلة لهذا الشهر.</p>}
          {data.payroll.payments.map(payment => <article key={payment.id} className="oc-panel p-3 text-sm"><strong>{data.payroll.employees.find(item => item.employeeId === payment.employeeId)?.name || `موظف #${payment.employeeId}`} · {monthMoney(payment.amount)}</strong><p className="mt-1 text-xs">{time(payment.paidAt)} · {payment.method} · سجّلها: {payment.actor || "غير معروف من المصدر"}</p>{!payment.reconciled && <p className="mt-1 text-xs font-bold text-amber-900">هذه الدفعة تحتاج مطابقة مع لقطة الاستحقاق.</p>}{payment.note && <p className="mt-1 text-xs">{payment.note}</p>}</article>)}
        </> : <Unavailable reason={data.payroll.reason} />)}
        {file === "expenses" && (data.expenses.available ? <>
          <div className="oc-panel p-4"><span className="text-xs">إجمالي المصروفات المسجلة</span><strong className="mt-1 block text-xl">{monthMoney(data.expenses.recorded)}</strong><p className="mt-2 text-xs text-muted-foreground">هذه قيود مصروفات وليست إثبات دفع نقدي. حالة الصرف غير متاحة من هذا المصدر.</p></div>
          {data.expenses.items.map((item, index) => <div key={`${item.label}:${index}`} className="oc-panel flex justify-between gap-3 p-3 text-sm"><span>{item.label}</span><strong>{monthMoney(item.amount)}</strong></div>)}
          {source(data.expenses.sourceHref, data.expenses.canManage ? "فتح مصروفات الشهر ومراجعتها" : "فتح سجل المصروفات")}
          {!data.expenses.canManage && <p className="text-xs text-muted-foreground">عرض فقط؛ تسجيل أو تعديل المصروفات يتطلب صلاحية المصدر.</p>}
        </> : <Unavailable reason={data.expenses.reason} />)}
        {file === "sales" && (data.sales.available ? <>
          <div className="oc-panel p-4"><span className="text-xs">مبيعات الأيام المغلقة فقط</span><strong className="mt-1 block text-xl">{monthMoney(data.sales.confirmed)}</strong><p className="mt-2 text-xs">عدد الأيام المغلقة: {data.sales.closedDays}. ليست إجمالي الشهر إذا كانت الإغلاقات ناقصة.</p></div>
          {source(data.sales.sourceHref, "فتح نتائج الشهر")}
        </> : <Unavailable reason={data.sales.reason} />)}
        {file === "closing" && (data.closing.available ? <>
          <div className="oc-panel p-4"><strong>حالة الشهر: {statusLabel[data.closing.status]}</strong><p className="mt-2 text-sm">إغلاق مراجعة تشغيلية محفوظ؛ لا يعتمد الرواتب أو الصرف ولا يقفل السجلات المالية.</p>{data.closing.closedAt && <p className="mt-2 text-xs">أغلقه: {data.closing.closedBy || "غير معروف"} · {time(data.closing.closedAt)}</p>}</div>
          {data.closing.drifted && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">تغيرت أدلة التشغيل بعد الإغلاق. يجب إعادة الفتح والمراجعة؛ الإغلاق السابق لا يثبت اكتمال البيانات الحالية.</p>}
          {!!data.closing.blockers.length && <div className="oc-panel p-4"><h4 className="font-bold">ما يمنع إغلاق الشهر</h4><ul className="mt-2 list-inside list-disc text-sm">{data.closing.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul></div>}
          <div className="flex flex-wrap gap-2">
            {(data.closing.canClose || data.closing.canDeclare) && <Button disabled={!canAct || !data.closing.canClose || !!data.closing.blockers.length || !data.closing.ended} onClick={() => begin("close")}>إغلاق الشهر التشغيلي</Button>}
            {data.closing.canReopen && <Button variant="outline" disabled={!canAct} onClick={() => begin("reopen")}>إعادة فتح الشهر</Button>}
            {source(data.closing.sourceHref, "استكمال الإغلاقات اليومية")}
          </div>
          {!data.closing.canClose && !data.closing.canReopen && !data.closing.canDeclare && <p className="text-xs text-muted-foreground">لا يتوفر إجراء إغلاق أو إعادة فتح في الحالة الحالية أو ضمن صلاحياتك.</p>}
          {!data.closing.ended && <p className="text-sm text-amber-800">الشهر لم ينتهِ بعد؛ إغلاقه غير مسموح.</p>}
          {!!data.closing.missingDates.length && <div className="oc-panel p-4"><h4 className="font-bold">أيام بلا سجل أو توثيق</h4><p className="mt-1 text-xs text-muted-foreground">غياب السجل ليس صفر مبيعات ولا إثبات توقف. استكمل السجل أو وثّق سبب عدم التشغيل لكل يوم.</p><div className="mt-3 flex flex-wrap gap-2">{data.closing.missingDates.map(day => <button key={day} type="button" disabled={!data.closing.canDeclare || !canAct} onClick={() => begin("declare", day)} className="rounded-lg border border-violet-200 px-2 py-1 text-xs disabled:opacity-60">{day}</button>)}</div></div>}
          {command && <form onSubmit={event => { event.preventDefault(); submit(); }} className="oc-panel space-y-3 border-violet-300 p-4" aria-label="تأكيد إجراء الشهر"><strong className="block text-sm">{actionLabel[command]}{date ? ` · ${date}` : ""}</strong><p className="text-xs">سيُحفظ الإجراء باسم حسابك مع التاريخ والسبب. لا ينفذ صرفًا أو اعتمادًا ماليًا.</p><label className="block text-xs font-bold">السبب / ملاحظة المراجعة<textarea aria-label="سبب إجراء الشهر" value={note} onChange={event => setNote(event.target.value)} minLength={3} maxLength={1000} required className="mt-1 min-h-20 w-full rounded-lg border border-violet-200 bg-white p-2 text-sm" /></label><div className="flex gap-2"><Button type="submit" disabled={!canAct || !permitted || note.trim().length < 3}>{mutation.isPending ? "جار الحفظ…" : "تأكيد وحفظ"}</Button><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setCommand(null)}>إلغاء</Button></div></form>}
          {!!data.closing.declarations.length && <div className="space-y-2"><h4 className="font-bold">أيام غير تشغيلية موثقة</h4>{data.closing.declarations.map(item => <article key={item.date} className="oc-panel p-3 text-sm"><strong>{item.date}</strong><p>{item.note}</p><p className="mt-1 text-xs text-muted-foreground">{item.actor} · {time(item.at)}</p>{data.closing.canDeclare && <Button size="sm" variant="outline" className="mt-2" disabled={!canAct} onClick={() => begin("remove-declaration", item.date)}>إلغاء التوثيق</Button>}</article>)}</div>}
          <h4 className="font-bold">الإغلاقات اليومية المسجلة</h4>
          {data.closing.dailyRecords.map(item => <article key={item.id} className="oc-panel flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><div><strong>{item.date}</strong><p className="text-xs">الحالة: {item.status} · المبيعات المسجلة: {monthMoney(item.sales)}</p></div><Button variant="outline" size="sm" disabled={!canAct} onClick={() => {
            try {
              const url = new URL(item.href, window.location.origin);
              if (url.origin === window.location.origin && url.pathname === `/branch-daily-closures/${item.id}` && item.date.startsWith(`${month}-`) && url.searchParams.get("branchId") === branchId) openMonthlySource(item.href);
            } catch { setError({ scope, message: "رابط الإغلاق اليومي غير صالح." }); }
          }}>فتح الإغلاق اليومي</Button></article>)}
          <h4 className="font-bold">سجل إجراءات الشهر</h4>
          {!data.closing.history.length && <p className="text-xs text-muted-foreground">لم تُسجّل إجراءات شهرية بعد.</p>}
          {data.closing.history.map((item, index) => <article key={`${item.at}:${index}`} className="oc-panel p-3 text-sm"><strong>{actionLabel[item.action === "remove_declaration" ? "remove-declaration" : item.action]}</strong><p className="mt-1 text-xs">{item.actor} · {time(item.at)}</p><p className="mt-1 text-xs">{item.note}</p></article>)}
        </> : <Unavailable reason={data.closing.reason} />)}
      </>}
    </div>
  </div>;
}

function Unavailable({ reason }: { reason?: string }) {
  return <div role="status" className="oc-panel p-4 text-sm"><strong>الملف غير متاح</strong><p className="mt-2">{reason || "لا تتوفر صلاحية المصدر أو تعذر تحميله. لا نعرض بيانات ناقصة كصفر ولا نعتبر الملف مكتملًا."}</p></div>;
}