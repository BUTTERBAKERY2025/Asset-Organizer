import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCopy, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, getHttpStatus, shouldRetryQuery } from "@/lib/queryClient";
import { createOperationsHrCommandGuard } from "@/lib/operations-hr-state";
import { operationsQueryError, operationsReadState } from "@/lib/operations-payroll-report";
import {
  createOperationsEmployeeFlight, joiningStatusLabels, operationsEmployeeDateTime, operationsJoiningAction,
  operationsJoiningSendFeedback, operationsJoiningState, orderedOperationsJoining, sendOperationsJoining,
  type OperationsBranch, type OperationsJoining, type OperationsJoiningSendResult,
} from "@/lib/operations-employees";
import { OperationsQueryFeedback } from "./query-feedback";

type CandidateFeedback = { message: string; error?: boolean; sent?: OperationsJoiningSendResult };
export function OperationsJoiningWorkspace({ branch, canCreate, canApprove }: {
  branch: OperationsBranch; canCreate: boolean; canApprove: boolean;
}) {
  const client = useQueryClient();
  const joining = useQuery<OperationsJoining[]>({
    queryKey: ["/api/operations-hr/joining", branch.id],
    queryFn: async () => {
      const rows = await (await apiRequest("GET", `/api/operations-hr/joining?${new URLSearchParams({ branchId: branch.id })}`)).json() as OperationsJoining[];
      if (!Array.isArray(rows) || rows.some(row => row.branchId !== branch.id || (row.notification && row.notification.branchId !== branch.id)))
        throw new Error("المباشرات لا تطابق الفرع المحدد.");
      return rows;
    },
    staleTime: 0, gcTime: 0, placeholderData: undefined, retry: shouldRetryQuery, refetchOnMount: "always",
  });
  const state = operationsReadState(true, joining);
  const [dates, setDates] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, CandidateFeedback>>({});
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const flight = useRef(createOperationsEmployeeFlight()).current;
  const guard = useRef(createOperationsHrCommandGuard()).current;
  guard.update(JSON.stringify([branch.id, canCreate, canApprove]));
  useEffect(() => () => guard.invalidate(), [guard]);
  const refresh = () => client.invalidateQueries({ queryKey: ["/api/operations-hr/joining", branch.id] });
  const updateFeedback = (id: number, value: CandidateFeedback) => setFeedback(previous => ({ ...previous, [id]: value }));
  const send = async (item: OperationsJoining) => {
    if (state !== "ready" || item.branchId !== branch.id || operationsJoiningAction(item, canCreate, canApprove) !== "send" ||
        (!item.notification && !dates[item.id]) || flight.isBusy()) return;
    const token = guard.capture();
    await flight.run(async () => {
      updateFeedback(item.id, { message: "جار تجهيز الرابط ومحاولة الإرسال…" });
      try {
        const sent = await sendOperationsJoining(item, dates[item.id] ?? "", {
          create: async body => (await apiRequest("POST", "/api/operations-hr/joining", body)).json(),
          send: async id => (await apiRequest("POST", `/api/operations-hr/joining/${id}/send`, {})).json(),
          refresh, isCurrent: () => guard.isCurrent(token),
        });
        if (sent && guard.isCurrent(token)) updateFeedback(item.id, { message: operationsJoiningSendFeedback(sent), sent });
      } catch (error) {
        if (guard.isCurrent(token)) updateFeedback(item.id, {
          error: true, message: `${operationsQueryError(error) || "تعذر إكمال تجهيز الرابط."}${getHttpStatus(error) === 409 ? " أُعيد تحديث الحالة؛ راجعها قبل إعادة المحاولة." : ""}`,
        });
      }
    }, busy => { if (guard.isCurrent(token)) setBusyId(busy ? item.id : null); });
  };
  const confirm = async (item: OperationsJoining) => {
    if (state !== "ready" || item.branchId !== branch.id || operationsJoiningAction(item, canCreate, canApprove) !== "confirm" || !item.notification || flight.isBusy()) return;
    const token = guard.capture();
    await flight.run(async () => {
      try {
        const result = await (await apiRequest("POST", `/api/operations-hr/joining/${item.notification!.id}/confirm`, { notes: notes.trim() })).json();
        await refresh();
        if (!guard.isCurrent(token)) return;
        setConfirmId(null); setNotes("");
        updateFeedback(item.id, { message: result.alreadyConfirmed
          ? "المباشرة معتمدة بالفعل؛ لم يُرسل إشعار مكرر."
          : "اعتُمدت المباشرة وسُجل إشعار لشؤون الموظفين. استكمال الملف من اختصاص شؤون الموظفين." });
      } catch (error) {
        await refresh();
        if (guard.isCurrent(token)) updateFeedback(item.id, { error: true, message: `${operationsQueryError(error) || "تعذر اعتماد المباشرة."}${getHttpStatus(error) === 409 ? " أُعيد تحديث الحالة؛ راجعها قبل إعادة المحاولة." : ""}` });
      }
    }, busy => { if (guard.isCurrent(token)) setBusyId(busy ? item.id : null); });
  };
  const copyLink = async (item: OperationsJoining, sent: OperationsJoiningSendResult) => {
    const token = guard.capture();
    try {
      await navigator.clipboard.writeText(sent.link);
      if (guard.isCurrent(token)) updateFeedback(item.id, { sent, message: "نُسخ رابط هذا المرشح. النسخ لا يعني إرسال الرابط أو تسليمه." });
    } catch {
      if (guard.isCurrent(token)) updateFeedback(item.id, { sent, error: true, message: "تعذر النسخ التلقائي؛ حدد الرابط أدناه وانسخه يدويًا." });
    }
  };
  const rows = state === "ready" ? orderedOperationsJoining(joining.data ?? []) : [];
  const signedCount = rows.filter(row => operationsJoiningState(row) === "signed").length;
  return <div className="space-y-4">
    <p className="text-sm leading-7 text-muted-foreground">المباشرات الموقّعة أولًا لاتخاذ القرار، ثم تجهيز الروابط ومتابعة التوقيع. اعتماد التشغيل لا يُنشئ ملف موظف تلقائيًا.</p>
    {!!signedCount && <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary"><PenLine className="size-4" />{signedCount} مباشرة موقّعة تحتاج اعتماد التشغيل</div>}
    <OperationsQueryFeedback state={state} loading="جار تحميل مباشرات الفرع…" failure={getHttpStatus(joining.error) === 403 ? "لم تعد مباشرات الفرع متاحة ضمن صلاحياتك." : "تعذر تحميل المباشرات."} error={joining.error} onRetry={() => joining.refetch()} />
    {state === "ready" && !rows.length && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">لا توجد عروض مباشرة في الفرع المختار.</p>}
    {rows.map(item => {
      const status = operationsJoiningState(item);
      const action = operationsJoiningAction(item, canCreate, canApprove);
      const notice = item.notification;
      const local = feedback[item.id];
      const usableLink = local?.sent && !item.blockedExisting && ["pending", "sent"].includes(status) ? local.sent : undefined;
      return <article key={item.id} className={`space-y-3 rounded-xl border bg-card p-4 ${status === "signed" ? "border-primary/40" : "border-border"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-bold">{item.candidateName}</h3><p className="mt-1 text-sm text-muted-foreground">{item.position}</p></div>
          <span className={`rounded-full px-3 py-1 text-xs ${status === "signed" ? "bg-primary/10 font-semibold text-primary" : "bg-muted text-muted-foreground"}`}>{item.blockedExisting ? "يتطلب تنسيق شؤون الموظفين" : joiningStatusLabels[status] || "حالة غير معروفة"}</span>
        </div>
        {notice ? <div className="grid gap-1 text-xs leading-6 text-muted-foreground sm:grid-cols-2">
          <p>رقم الإشعار: <bdi>{notice.notificationNumber || "غير مسجل"}</bdi></p>
          <p>تاريخ المباشرة: <bdi>{notice.actualStartDate}</bdi></p>
          <p>صلاحية الرابط: {notice.expiresAt ? operationsEmployeeDateTime(notice.expiresAt) : "لم تُحدد بعد"}</p>
          {notice.sentAt && <p>تجهيز / إرسال الرابط: {operationsEmployeeDateTime(notice.sentAt)} (ليس تأكيد تسليم)</p>}
          {notice.signedAt && <p>توقيع المرشح: {operationsEmployeeDateTime(notice.signedAt)}</p>}
          {notice.confirmedAt && <p>اعتمد بواسطة {notice.confirmedByName || notice.confirmedBy || "غير مسجل"} · {operationsEmployeeDateTime(notice.confirmedAt)}</p>}
          {notice.confirmedNotes && <p className="sm:col-span-2">ملاحظة الاعتماد: {notice.confirmedNotes}</p>}
        </div> : !item.blockedExisting && status !== "converted" && <p className="text-xs text-muted-foreground">عرض مقبول؛ لم يُنشأ إشعار مباشرة بعد.</p>}
        {item.blockedExisting && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{item.blockedReason || "يوجد إشعار مرتبط خارج نطاق المباشرة الحالية؛ راجع شؤون الموظفين."}</p>}
        {action === "send" && <div className="flex flex-wrap items-end gap-2">
          {!notice && <label className="text-xs">تاريخ المباشرة<Input aria-label={`تاريخ مباشرة ${item.candidateName}`} className="mt-1 w-44" type="date" value={dates[item.id] ?? ""} disabled={busyId !== null} onChange={event => setDates(previous => ({ ...previous, [item.id]: event.target.value }))} /></label>}
          <Button variant="outline" disabled={busyId !== null || (!notice && !dates[item.id])} onClick={() => { void send(item); }}>
            {busyId === item.id ? "جار إكمال العملية…" : status === "sent" ? "إعادة إرسال رابط المباشرة" : "تجهيز رابط المباشرة وإرساله"}
          </Button>
        </div>}
        {action === "confirm" && confirmId !== item.id && <Button disabled={busyId !== null} onClick={() => { setConfirmId(item.id); setNotes(""); }}>اعتماد المباشرة وإشعار شؤون الموظفين</Button>}
        {action === "approval-denied" && <p className="text-xs text-muted-foreground">تحتاج صلاحية اعتماد مباشرة التشغيل لاتخاذ القرار.</p>}
        {action === "send-denied" && <p className="text-xs text-muted-foreground">تحتاج صلاحية إنشاء المباشرة لتجهيز الرابط أو إعادة إرساله.</p>}
        {action === "confirm" && confirmId === item.id && <form className="space-y-3 rounded-lg border border-border bg-muted/30 p-3" onSubmit={event => { event.preventDefault(); void confirm(item); }}>
          <p className="text-sm">تأكيد اعتماد المباشرة الموقّعة بتاريخها المسجل وإشعار شؤون الموظفين لاستكمال الملف.</p>
          <Input value={notes} maxLength={1000} disabled={busyId !== null} aria-label={`ملاحظة اعتماد ${item.candidateName}`} placeholder="ملاحظة الاعتماد (اختيارية)" onChange={event => setNotes(event.target.value)} />
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busyId !== null}>{busyId === item.id ? "جار الاعتماد وتحديث الحالة…" : "تأكيد الاعتماد والإشعار"}</Button><Button type="button" variant="outline" disabled={busyId !== null} onClick={() => setConfirmId(null)}>إلغاء</Button></div>
        </form>}
        {local && <div role={local.error ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${local.error ? "bg-destructive/5 text-destructive" : "bg-muted/50"}`}>
          <p>{local.message}</p>
          {usableLink && <div className="mt-2 space-y-2">
            <Input readOnly dir="ltr" value={usableLink.link} aria-label={`رابط مباشرة ${item.candidateName}`} onFocus={event => event.target.select()} />
            <p className="text-xs text-muted-foreground">الإشعار: <bdi>{usableLink.notificationNumber}</bdi> · صالح حتى {operationsEmployeeDateTime(usableLink.expiresAt)}{usableLink.tokenReused ? " · أُعيد استخدام الرابط الحالي" : ""}</p>
            <Button size="sm" variant="outline" onClick={() => { void copyLink(item, usableLink); }}><ClipboardCopy className="ml-1 size-4" />نسخ رابط {item.candidateName}</Button>
          </div>}
        </div>}
      </article>;
    })}
  </div>;
}