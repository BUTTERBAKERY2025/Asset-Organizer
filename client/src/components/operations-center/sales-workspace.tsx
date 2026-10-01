import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpLeft, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { OperationsSalesRecord, OperationsSalesResponse } from "@shared/operations-sales";
import type { OperationsQueueItem } from "@shared/operations-center";
import { Button } from "@/components/ui/button";
import { createOperationsHrCommandGuard } from "@/lib/operations-hr-state";
import { withSalesPageReturn } from "@/lib/operations-center-navigation";
import { filterSalesRecords, salesHasDecision, salesRecordKey, salesRequestParams, salesScopeMatches, salesSelectionIntent,
  salesSourceHref, salesSources, salesStageLabel, type SalesRequest } from "./sales-workspace-model";

type Branch = { id: string; name: string };
type OpenSource = (href: string, branchId: string, item?: OperationsQueueItem, isCurrent?: () => boolean) => void;
export const salesQueryKey = (request: SalesRequest, actorId?: string) =>
  ["/api/operations-center/sales", actorId, [...request.branchIds].sort().join(","), request.source, request.offset, request.limit] as const;
export function useOperationsSalesQuery(request: SalesRequest, actorId?: string, valid = true) {
  return useQuery<OperationsSalesResponse>({
    queryKey: salesQueryKey(request, actorId), enabled: valid && !!actorId && request.branchIds.length > 0,
    retry: false, staleTime: 0, gcTime: 0, placeholderData: undefined,
    refetchOnMount: "always", refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/operations-center/sales?${salesRequestParams(request)}`, { signal, credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "تعذر تحميل متابعة اليوميات والإغلاقات.");
      const data: OperationsSalesResponse = await response.json();
      if (!salesScopeMatches(data, request)) throw new Error("بيانات المتابعة لا تطابق النطاق أو الصفحة الحالية.");
      return data;
    },
  });
}
export function OperationsSalesWorkspace({ branches, actorId, open }: { branches: Branch[]; actorId?: string; open: OpenSource }) {
  const client = useQueryClient();
  const [intent] = useState(() => salesSelectionIntent(typeof window !== "undefined" ? window.location.search : "", branches.map(branch => branch.id)));
  const [commands] = useState(createOperationsHrCommandGuard);
  const [branchId, setBranchId] = useState(intent.branchId);
  const [source, setSource] = useState(intent.source);
  const [offset, setOffset] = useState(intent.offset);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [selection, setSelection] = useState(intent.record);
  const [mobileDetail, setMobileDetail] = useState(!!intent.record);
  const [error, setError] = useState("");
  const valid = intent.valid && (!branchId || branches.some(branch => branch.id === branchId))
    && salesSelectionIntent(typeof window !== "undefined" ? window.location.search : "", branches.map(branch => branch.id)).valid;
  const request: SalesRequest = { branchId, branchIds: valid ? branches.filter(branch => !branchId || branch.id === branchId).map(branch => branch.id) : [], source, offset, limit: 30 };
  const query = useOperationsSalesQuery(request, actorId, valid);
  const data = valid && !query.isError && query.data && salesScopeMatches(query.data, request) ? query.data : null;
  const records = data ? filterSalesRecords(data.records, search, stage, branches) : [];
  const record = records.find(row => salesRecordKey(row) === selection);
  commands.update(JSON.stringify([actorId, request, search, stage, selection, mobileDetail, query.dataUpdatedAt, query.status, query.fetchStatus]));
  useEffect(() => () => commands.invalidate(), [commands]);
  const change = (action: () => void) => { commands.invalidate(); setError(""); action(); };
  const reset = () => { setOffset(0); setSearch(""); setStage("all"); setSelection(null); setMobileDetail(false); };
  const openRecord = () => {
    const cache = client.getQueryState<OperationsSalesResponse>(salesQueryKey(request, actorId));
    const fresh = valid && cache?.status === "success" && cache.fetchStatus === "idle" && cache.data && salesScopeMatches(cache.data, request) ? cache.data : null;
    const clicked = fresh && filterSalesRecords(fresh.records, search, stage, branches).find(row => salesRecordKey(row) === selection);
    const href = clicked && salesSourceHref(clicked, actorId, window.location.origin);
    if (!clicked || !href) { setError("لم يُتحقق من الحالة الحالية؛ حدّث الحالات ثم أعد اختيارها."); return; }
    const token = commands.capture();
    open(withSalesPageReturn(href, clicked, { source, branchId, offset }, window.location.origin), clicked.branchId, clicked, () => commands.isCurrent(token));
  };
  if (!valid) return <p role="alert" className="oc-panel p-4 text-sm text-destructive">نطاق العودة أو الصفحة غير صالح أو لم يعد مصرحًا به. لم تُحمّل بيانات ولم يُوسّع النطاق.</p>;
  const complete = data && data.coverage.total !== null && salesSources.filter(item => source === "all" || item.id === source).every(item => data.coverage.sources[item.id].state === "complete");
  return <div className="oc-workspace-grid" data-detail={mobileDetail} data-testid="operations-sales-workspace">
    <div className="oc-workspace-list space-y-3">
      <div className="oc-panel p-3 text-xs leading-6"><h3 className="text-sm font-bold">متابعة اليوميات والإغلاق اليومي</h3>
        <p>سجلات محفوظة غير نهائية ضمن الفروع المصرح بها؛ ليست غياب إغلاق مصطنعًا أو مجموع مبيعات. التاريخ يوم العمل وليس موعد استحقاق.</p>
        <p>الاعتماد في المصدر وللمخوّل فقط. المراجعة هنا لا تغيّر السجل أو الصلاحيات المالية.</p></div>
      <div className="oc-people-filters">
        <label>الفرع<select aria-label="فرع متابعة اليوميات" value={branchId} onChange={event => change(() => { setBranchId(event.target.value); reset(); })}><option value="">كل الفروع المختارة</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label>المصدر<select aria-label="مصدر متابعة اليوميات" value={source} onChange={event => change(() => { setSource(event.target.value as SalesRequest["source"]); reset(); })}><option value="all">اليوميات والإغلاقات</option>{salesSources.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>المرحلة · في الصفحة<select aria-label="مرحلة متابعة اليوميات" value={stage} onChange={event => change(() => { setStage(event.target.value); setSelection(null); setMobileDetail(false); })}><option value="all">كل مراحل الصفحة</option>{Array.from(new Set(data?.records.map(row => row.step) || [])).map(value => <option key={value} value={value}>{salesStageLabel(value)}</option>)}</select></label>
        <label>بحث · في الصفحة<input aria-label="بحث متابعة اليوميات" value={search} onChange={event => change(() => { setSearch(event.target.value); setSelection(null); setMobileDetail(false); })} placeholder="تاريخ العمل، رقم السجل، المنشئ…" /></label>
      </div>
      <p className="text-[11px] text-muted-foreground">الفرع والمصدر يرشحان كامل النطاق؛ المرحلة والبحث يرشحان الصفحة فقط. الترتيب حسب المصدر ثم تاريخ العمل داخله.</p>
      {query.isPending && <p role="status">جار تحميل الحالات…</p>}
      {query.isError && <p role="alert" className="text-sm text-destructive">{query.error.message}</p>}
      <Button type="button" size="sm" variant="ghost" disabled={query.isFetching} onClick={() => change(() => { void query.refetch(); })}><RefreshCw className="ml-1 size-4" />تحديث الحالات</Button>
      {data && <>
        <p role="status" className="text-xs text-muted-foreground">{complete ? `السجلات المؤهلة في النطاق: ${data.coverage.total}` : "تغطية غير مكتملة؛ المصدر غير المتاح ليس صفرًا."}</p>
        <dl className="oc-people-counters">{[["حالات الصفحة", records.length], ["بانتظار قرارك", records.filter(row => salesHasDecision(row, actorId)).length]].map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{!complete && records.length === 0 ? "غير متاح" : count}</dd></div>)}</dl>
        {salesSources.filter(item => (source === "all" || source === item.id) && data.coverage.sources[item.id].state !== "complete").map(item => <p key={item.id} className="text-xs text-amber-900">{item.label}: {data.coverage.sources[item.id].state === "forbidden" ? "لا تتوفر صلاحية المصدر." : "تعذر التحقق من المصدر؛ أعد المحاولة."}</p>)}
        {records.map(row => <button type="button" className="oc-list-item text-right" key={salesRecordKey(row)} data-active={selection === salesRecordKey(row)} onClick={() => change(() => { setSelection(salesRecordKey(row)); setMobileDetail(true); })}>
          <strong>{row.title} · <bdi>#{row.sourceId}</bdi></strong><span className="block text-xs">{branches.find(branch => branch.id === row.branchId)?.name} · <bdi>{row.businessDate}</bdi> · {salesStageLabel(row.status)}</span>
          <span className="block text-xs">{salesHasDecision(row, actorId) ? row.decision!.label : row.nextStep.label}</span>
        </button>)}
        {!records.length && <p role="status" className="oc-panel p-3 text-sm">{!complete ? "تعذر تأكيد خلو المصدر؛ ليست نتيجة صفر مؤكدة." : search.trim() || stage !== "all" ? "لا نتائج تطابق البحث والمرحلة في هذه الصفحة." : "لا سجلات مؤهلة في هذه الصفحة؛ هذا لا يثبت اكتمال جميع أعمال الفرع."}</p>}
        <nav aria-label="صفحات متابعة اليوميات" className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={offset === 0 || query.isFetching} onClick={() => change(() => { reset(); setOffset(Math.max(0, offset - 30)); })}><ChevronRight className="size-4" />السابقة</Button><span className="text-xs">صفحة {offset / 30 + 1}</span><Button size="sm" variant="outline" disabled={data.coverage.nextOffset === null || query.isFetching} onClick={() => change(() => { reset(); setOffset(data.coverage.nextOffset!); })}>التالية<ChevronLeft className="size-4" /></Button></nav>
      </>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
    <div className="oc-workspace-detail space-y-4">
      <button type="button" className="min-h-11 text-sm font-bold text-violet-700 md:hidden" onClick={() => change(() => setMobileDetail(false))}>العودة للحالات والمرشحات</button>
      {record && data ? <SalesRecordDetail record={record} actorId={actorId} refreshing={query.isFetching} onOpen={openRecord} />
        : <p className="py-12 text-center text-sm text-muted-foreground">{query.isError ? "أخفيت التفاصيل بعد تعذر التحقق من المصدر." : selection ? "الحالة لم تعد ضمن الصفحة الحالية؛ اختر حالة ظاهرة أو حدّث الحالات." : "اختر يومية أو إغلاقًا لعرض تاريخ العمل والوقائع والخطوة التالية."}</p>}
    </div>
  </div>;
}
const fact = (value: number | null) => value === null ? "غير متاح في بيانات العرض" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
export function SalesRecordDetail({ record, actorId, refreshing, onOpen }: { record: OperationsSalesRecord; actorId?: string; refreshing: boolean; onOpen: () => void }) {
  const decision = salesHasDecision(record, actorId);
  return <article className="space-y-4">
    <header><h3 className="text-xl font-bold">{record.title} · <bdi>#{record.sourceId}</bdi></h3><p className="text-sm">{salesStageLabel(record.status)}</p></header>
    <div className="oc-panel p-4"><strong>الخطوة التالية في المصدر</strong><p className="text-sm leading-7">{decision ? record.decision!.label : record.nextStep.label}</p>
      <p className="text-xs leading-6">{decision ? "بانتظار قرارك وفق صلاحية المصدر وفصل الواجبات؛ يعيد المصدر التحقق قبل الاعتماد." : "متابعة السجل لا تمنح اعتمادًا ماليًا؛ الإجراء للمخوّل في المصدر فقط."}</p></div>
    {record.reason && !/^الحالة المسجلة:/.test(record.reason) && <p className="oc-panel p-3 text-xs leading-6">{record.reason}</p>}
    <dl className="oc-panel oc-people-facts divide-y text-sm">{[
      ["تاريخ العمل", record.businessDate], ["المنشئ", record.creator.name || "لا يقدم المصدر اسم المنشئ في هذه اللقطة"],
      ...(record.cashier ? [["الكاشير", record.cashier.name]] : []),
      ["الحالة المسجلة", salesStageLabel(record.status)], ["إجمالي السجل", fact(record.facts.totalSales)],
      ["الفرق النقدي المسجل", fact(record.facts.cashDiscrepancy)], ["الفرق البنكي المسجل", fact(record.facts.bankDiscrepancy)],
      ...(record.domain === "closures" ? [["اليوميات المشمولة", fact(record.facts.journalsCount)]] : []),
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd><bdi>{value}</bdi></dd></div>)}</dl>
    {record.domain === "closures" && <p className="text-xs leading-6 text-muted-foreground">الإغلاق لقطة لليوميات المشمولة؛ اعتماده لا يثبت وحده شمول كل يوميات الفرع أو خلوه من الفروق. تاريخ العمل ليس موعدًا متأخرًا.</p>}
    {salesSourceHref(record, actorId, typeof window !== "undefined" ? window.location.origin : "https://operations.invalid")
      ? <Button type="button" disabled={refreshing} className="bg-[#6941a5]" onClick={onOpen}>{decision ? "فتح المصدر لمراجعة الاعتماد" : "فتح السجل للمتابعة"}<ArrowUpLeft className="mr-2 size-4" /></Button>
      : <p role="alert" className="text-destructive text-sm">رابط المصدر لا يطابق هوية الحالة؛ حدّث البيانات.</p>}
  </article>;
}