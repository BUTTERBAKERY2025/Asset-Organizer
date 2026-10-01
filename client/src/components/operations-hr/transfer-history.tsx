import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, getHttpStatus, shouldRetryQuery } from "@/lib/queryClient";
import { operationsQueryError, operationsReadState } from "@/lib/operations-payroll-report";
import {
  operationsEmployeeDateTime, transferEventLabels, transferStatusLabels, validateOperationsTransferPage,
  type OperationsBranch, type OperationsTransferPage,
} from "@/lib/operations-employees";
import { OperationsQueryFeedback } from "./query-feedback";

export function OperationsTransferHistory({ branch, branches }: { branch: OperationsBranch; branches: OperationsBranch[] }) {
  const scope = branches.map(row => row.id).sort().join(",");
  const history = useInfiniteQuery({
    queryKey: ["/api/operations-hr/transfers", branch.id, scope],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ branchId: branch.id, limit: "50" });
      if (pageParam) params.set("cursor", pageParam);
      const data = await (await apiRequest("GET", `/api/operations-hr/transfers?${params}`)).json() as OperationsTransferPage;
      return validateOperationsTransferPage(data, branch.id, branches.map(row => row.id));
    },
    getNextPageParam: page => page.hasMore ? page.nextCursor : undefined,
    staleTime: 0, gcTime: 0, placeholderData: undefined, retry: shouldRetryQuery, refetchOnMount: "always",
  });
  const denied = getHttpStatus(history.error) === 403;
  const state = operationsReadState(true, {
    ...history, isFetching: history.isFetching && !history.isFetchingNextPage,
    isError: history.isError && (!history.isFetchNextPageError || denied),
  });
  const rows = state === "ready" ? history.data?.pages.flatMap(page => page.transfers) ?? [] : [];
  const name = (id: string) => branches.find(row => row.id === id)?.name ?? id;
  const last = history.data?.pages.at(-1);
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">النقل الصادر والوارد لـ {branch.name} بين الفروع المصرّح بها فقط. تنفيذ النقل فوري؛ السجل يعرض المنفّذ والتوقيت الفعليين.</p>
    <OperationsQueryFeedback state={state} loading="جار تحميل سجل نقل الفرع…" failure={denied ? "لم يعد سجل النقل متاحًا ضمن صلاحياتك." : "تعذر تحميل سجل النقل."} error={history.error} onRetry={() => history.refetch()} />
    {state === "ready" && <>
      {!rows.length && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">لا يوجد سجل نقل في الفرع المختار.</p>}
      <div className="space-y-3">{rows.map(transfer => <article key={transfer.id} className="rounded-xl border border-border p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><div className="flex items-center gap-2"><span className={`rounded-lg p-2 ${transfer.sourceBranchId === branch.id ? "bg-orange-50 text-orange-800" : "bg-emerald-50 text-emerald-800"}`}>
            {transfer.sourceBranchId === branch.id ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
          </span><h3 className="font-bold">{transfer.employeeName}</h3></div>
            <p className="mt-2 text-xs text-muted-foreground">الرقم: <bdi>{transfer.employeeNumber || "غير مسجل"}</bdi> · {transfer.jobTitle || "الوظيفة غير مسجلة"}</p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs">{transferStatusLabels[transfer.status] || "حالة غير معروفة"}</span>
        </div>
        <p className="mt-3 font-medium">{transfer.sourceBranchId === branch.id ? "صادر" : "وارد"} · من {name(transfer.sourceBranchId)} إلى {name(transfer.destinationBranchId)}</p>
        <p className="mt-1 text-muted-foreground">السبب: {transfer.reason}</p>
        <p className="mt-2 text-xs text-muted-foreground">تاريخ السريان: <bdi>{transfer.effectiveDate || "غير مسجل"}</bdi> · طُلب بواسطة {transfer.requestedByName || transfer.requestedBy || "غير مسجل"} · {operationsEmployeeDateTime(transfer.requestedAt)}</p>
        {transfer.completedAt && <p className="mt-1 text-xs text-muted-foreground">وقت إتمام النقل: {operationsEmployeeDateTime(transfer.completedAt)}</p>}
        <details className="mt-3 rounded-lg bg-muted/30 p-3"><summary className="cursor-pointer text-xs font-semibold">سجل الإجراءات ({transfer.history.length})</summary>
          {!transfer.history.length && <p className="mt-2 text-xs text-muted-foreground">لا توجد أحداث مسجلة لهذا النقل.</p>}
          <ol className="mt-2 space-y-2 border-r-2 border-primary/20 pr-3">{transfer.history.map(event => <li key={event.id} className="text-xs">
            <strong>{transferEventLabels[event.eventType] || "إجراء مسجل"}</strong> · {event.performedByName || event.performedBy || "المنفّذ غير مسجل"} · {operationsEmployeeDateTime(event.eventTimestamp)}
            {event.details?.reason && <p className="mt-1 text-muted-foreground">السبب المسجل: {event.details.reason}</p>}
          </li>)}</ol>
        </details>
      </article>)}</div>
      {history.isFetchNextPageError && <p role="alert" className="text-sm text-destructive">تعذر تحميل السجلات التالية. {operationsQueryError(history.error)}</p>}
      {(last?.truncated || last?.hasMore) && <p className="text-xs text-muted-foreground">توجد سجلات إضافية؛ المعروض {rows.length} سجلًا ولا يمثل السجل الكامل.</p>}
      {history.hasNextPage && <Button variant="outline" disabled={history.isFetchingNextPage} onClick={() => { void history.fetchNextPage(); }}>{history.isFetchingNextPage ? "جار تحميل المزيد…" : history.isFetchNextPageError ? "إعادة محاولة تحميل المزيد" : "تحميل المزيد من السجل"}</Button>}
      {!!rows.length && !history.hasNextPage && !last?.truncated && <p className="text-xs text-muted-foreground">نهاية السجل المتاح ضمن صلاحياتك.</p>}
    </>}
  </div>;
}