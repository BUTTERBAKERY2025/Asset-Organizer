import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpLeft, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import type { OperationsQueueItem, OperationsSupplyRecord, OperationsSupplyResponse } from "@shared/operations-center";
import { Button } from "@/components/ui/button";
import { withSupplyPageReturn } from "@/lib/operations-center-navigation";
import { time } from "./record-sheet";
import {
  filterSupplyRecords, supplyCoverageText, supplyPageFacts, supplyPriorityLabel, supplyRecordKey,
  supplyRequestParams, supplyScopeMatches, supplySelectionIntent, supplySourceHref, supplySourceLabel, supplySources, supplyStageLabel,
  type SupplyRequest, type SupplySource,
} from "./supply-workspace-model";

type Branch = { id: string; name: string };
type OpenSource = (href: string, branchId: string, item?: OperationsQueueItem) => void;
const pageSize = 30;

export function useOperationsSupplyQuery(request: SupplyRequest, actorId?: string) {
  const scope = [...request.branchIds].sort().join(",");
  return useQuery<OperationsSupplyResponse>({
    queryKey: ["/api/operations-center/supply", actorId, scope, request.source, request.offset, request.limit],
    enabled: !!actorId && request.branchIds.length > 0 && request.branchIds.length <= 30,
    retry: false, staleTime: 0,
    // The page's live hook owns SSE + polling invalidation for this prefix.
    refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/operations-center/supply?${supplyRequestParams(request)}`, {
        credentials: "include", cache: "no-store", signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || body?.message || `تعذر تحميل متابعة التوريد والنقل (${response.status}).`);
      }
      const data: OperationsSupplyResponse = await response.json();
      if (!supplyScopeMatches(data, request)) throw new Error("بيانات متابعة التوريد لا تطابق نطاق الفروع أو صفحة المصدر المطلوبة.");
      return data;
    },
  });
}

export function OperationsSupplyWorkspace({ branches, actorId, open, canOpenPurchasing = false }: {
  branches: Branch[]; actorId?: string; open: OpenSource; canOpenPurchasing?: boolean;
}) {
  const [intent] = useState(() => supplySelectionIntent(typeof window !== "undefined" ? window.location.search : "", branches.map(branch => branch.id)));
  const [branchId, setBranchId] = useState(intent.branchId);
  const [source, setSource] = useState<SupplySource>(intent.source);
  const [offset, setOffset] = useState(intent.offset);
  const [stage, setStage] = useState("all");
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<string | null>(intent.record);
  const [mobileDetail, setMobileDetail] = useState(!!intent.record);
  const intentValid = intent.valid && supplySelectionIntent(typeof window !== "undefined" ? window.location.search : "", branches.map(branch => branch.id)).valid
    && (!branchId || branches.some(branch => branch.id === branchId));
  const scopedBranches = intentValid ? branches.filter(branch => !branchId || branch.id === branchId) : [];
  const request: SupplyRequest = { branchIds: scopedBranches.map(branch => branch.id), source, offset, limit: pageSize };
  const query = useOperationsSupplyQuery(request, actorId);
  const data = !query.isError && query.data && supplyScopeMatches(query.data, request) ? query.data : null;
  const records = data ? filterSupplyRecords(data.records, { stage, search }, branches) : [];
  const record = records.find(item => supplyRecordKey(item) === selection);
  const stages = [...new Set(data?.records.map(item => item.stage) || [])];
  const reset = () => { setOffset(0); setStage("all"); setSearch(""); setSelection(null); setMobileDetail(false); };
  const paginate = (value: number) => { setOffset(value); setStage("all"); setSearch(""); setSelection(null); setMobileDetail(false); };
  const openWithPage: OpenSource = (href, selectedBranch, item) => {
    if (!intentValid || !item || !data || query.isFetching || !records.some(record => supplyRecordKey(record) === supplyRecordKey(item))) return;
    open(withSupplyPageReturn(href, { source, branchId, offset }, window.location.origin), selectedBranch, item);
  };

  if (!intentValid) return <p role="alert" className="oc-panel p-4 text-sm text-destructive">نطاق العودة إلى حالات التوريد أو صفحة المصدر غير صالح أو لم يعد مصرحًا به. لم تُحمّل بيانات ولم يُوسّع النطاق إلى كل الفروع. أغلق النافذة واختر نطاقًا مصرحًا من المركز.</p>;

  return <div className="oc-workspace-grid oc-supply-workspace" data-detail={mobileDetail} data-testid="operations-supply-workspace">
    <div className="oc-workspace-list space-y-3">
      <div className="oc-panel space-y-1 p-3">
        <h3 className="text-sm font-bold">متابعة يومية من الطلب إلى الاستلام</h3>
        <p className="text-xs leading-6 text-muted-foreground">اعرف المرحلة الحالية والجهة المسؤولة والخطوة التالية. هذا المركز للمتابعة؛ المصدر المختص يظل المرجع النهائي للصلاحية والتنفيذ والمخزون، ولا ينفّذ العرض هنا أي إجراء.</p>
      </div>
      <div className="oc-supply-filters">
        <label>الفرع
          <select aria-label="فرع متابعة التوريد" value={branchId} onChange={event => { setBranchId(event.target.value); reset(); }}>
            <option value="">كل الفروع المختارة في المركز</option>
            {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label>المصدر
          <select aria-label="مصدر متابعة التوريد" value={source} onChange={event => { setSource(event.target.value as SupplySource); reset(); }}>
            <option value="all">كل مصادر التوريد والنقل والمرتجعات</option>
            {supplySources.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>المرحلة · في الصفحة
          <select aria-label="مرحلة متابعة التوريد في الصفحة" value={stage} onChange={event => setStage(event.target.value)}>
            <option value="all">كل مراحل الصفحة</option>
            {stage !== "all" && !stages.includes(stage) && <option value={stage}>{supplyStageLabel(stage)}</option>}
            {stages.map(value => <option key={value} value={value}>{supplyStageLabel(value)}</option>)}
          </select>
        </label>
        <label>بحث · في الصفحة
          <span className="relative block"><Search className="pointer-events-none absolute right-3 top-3 size-4 text-violet-500" />
            <input aria-label="بحث في صفحة متابعة التوريد" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder="رقم المصدر، الفرع، المسؤول…" className="!pr-9" />
          </span>
        </label>
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">الفرع والمصدر يرشحان كامل نطاق الخادم قبل ترقيم الصفحات. المرحلة والبحث يرشحان الصفحة المحمّلة فقط؛ الترتيب حسب المصدر ثم الأحدث داخله، وليس حسب الأولوية.</p>
      <p className="text-[11px] leading-5 text-muted-foreground">النطاق: طلبات المطبخ والتحويلات والمرتجعات والتوصيل؛ لا يشمل خطط الإنتاج أو دفعاته الفعلية كمصادر مستقلة.</p>
      {scopedBranches.some(branch => branch.id === "main_warehouse") && <p className="text-[11px] leading-5 text-muted-foreground">المستودع الرئيسي نطاق عرض؛ ولصاحب صلاحية المستودعات العامة يشمل النقل بين المستودعات، ولا يعني أن المستودع الرئيسي طرف في كل حركة.</p>}
      {query.isPending && <p role="status" className="text-sm">جار تحميل حالات التوريد والنقل…</p>}
      {query.isError && <div role="alert" className="oc-panel space-y-2 p-3 text-sm text-destructive"><p>{query.error.message}</p><Button type="button" variant="outline" size="sm" onClick={() => query.refetch()}>إعادة المحاولة</Button></div>}
      {data && <>
        <SupplySummaries data={data} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">حالات المتابعة</h3>
          <Button type="button" variant="ghost" size="sm" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={`ml-1 size-3.5 ${query.isFetching ? "animate-spin" : ""}`} />تحديث الحالات</Button>
        </div>
        <SupplyCounters records={records} actorId={actorId} data={data} filtered={stage !== "all" || !!search.trim()} />
        {records.map(item => <button type="button" className="oc-list-item oc-supply-case" key={supplyRecordKey(item)}
          data-active={selection === supplyRecordKey(item)} onClick={() => { setSelection(supplyRecordKey(item)); setMobileDetail(true); }}>
          <span className="oc-supply-case-top"><strong>{supplySourceLabel(item.domain)} <bdi>#{item.sourceId}</bdi></strong><span className="oc-supply-stage">{supplyStageLabel(item.stage)}</span></span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.title}</span>
          <span className="mt-1 block text-xs leading-5">{item.branchIds.map(id => branches.find(branch => branch.id === id)?.name || id).join(" · ")}</span>
          <span className="mt-2 block text-xs leading-5"><strong>التالي: </strong>{item.nextStep.label || "غير محدد من المصدر"}</span>
          <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">المسؤول: {item.responsibleRole || item.owner || "غير مسجل"} · الموعد: {item.dueAt ? time(item.dueAt) : "غير مسجل"}</span>
          <span className="mt-1 block text-[11px] text-muted-foreground">الأولوية: {supplyPriorityLabel(item)}</span>
        </button>)}
        {!records.length && <p role="status" className="rounded-xl border border-dashed border-violet-200 p-4 text-sm text-muted-foreground">{stage !== "all" || search.trim() ? "لا نتائج تطابق المرحلة والبحث في هذه الصفحة." : "لا حالات ظاهرة لهذا المصدر في هذه الصفحة؛ الغياب لا يثبت اكتمال العمل."} تبقى المصادر ذات العدد صفر متاحة من مرشح المصدر.</p>}
        <nav aria-label="صفحات حالات التوريد والنقل" className="flex flex-wrap items-center gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" disabled={offset === 0 || query.isFetching} onClick={() => paginate(Math.max(0, offset - pageSize))}><ChevronRight className="size-4" />السابقة</Button>
          <span className="text-xs text-muted-foreground">صفحة {Math.floor(offset / pageSize) + 1}</span>
          <Button type="button" variant="outline" size="sm" disabled={data.coverage.nextOffset === null || query.isFetching} onClick={() => { if (data.coverage.nextOffset !== null) paginate(data.coverage.nextOffset); }}>التالية<ChevronLeft className="size-4" /></Button>
        </nav>
        <p className="text-[11px] text-muted-foreground">آخر تحقق: {time(data.generatedAt)}{query.isFetching ? " · جار التحقق من المصدر…" : ""}</p>
      </>}
      {canOpenPurchasing && <details className="oc-supply-secondary">
        <summary>اختصار ثانوي · المشتريات</summary>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">مسار مستقل لاحتياج الشراء؛ ليس حالة متابعة ولا يدخل في عدادات التوريد. اختر فرعًا لفتح المصدر.</p>
        {scopedBranches.length === 1 ? <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => open("/purchasing-requests?centerWorkspace=production", scopedBranches[0].id)}>مشتريات {scopedBranches[0].name}<ArrowUpLeft className="mr-1 size-3.5" /></Button>
          : <p className="mt-2 text-xs text-muted-foreground">حدد فرعًا واحدًا من المرشح أعلاه لإظهار اختصار المشتريات.</p>}
      </details>}
    </div>
    <div className="oc-workspace-detail space-y-4">
      <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-violet-700 md:hidden" onClick={() => setMobileDetail(false)}><ChevronRight className="size-4" />العودة للحالات والمرشحات</button>
      {query.isError ? <p role="alert" className="text-sm text-destructive">تعذر التحقق من حالات المصدر؛ أخفيت التفاصيل والإجراء السابق. أعد تحميل الحالات.</p>
        : query.isPending ? <p role="status" className="text-sm text-muted-foreground">جار التحقق من حالات المصدر ضمن النطاق المختار…</p>
        : record && data ? <SupplyRecordDetail record={record} branches={branches} actorId={actorId} open={openWithPage} refreshing={query.isFetching} />
        : selection && data ? <p role="status" className="oc-panel p-4 text-sm leading-7">السجل المحدد لم يعد ضمن نتائج هذه الصفحة بعد التحديث أو الترشيح. قد تكون مرحلته أو نطاقه أو موقعه في الصفحات قد تغير؛ هذا ليس تأكيدًا لإكماله. اختر سجلًا ظاهرًا أو راجع المصدر.</p>
        : <div className="py-12 text-center"><h3 className="text-base font-bold">ما الخطوة التالية لكل حالة؟</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">اختر حالة لعرض المسؤول والموعد والأولوية والإجراء المصرح به في مصدرها. ملخصات المصادر منفصلة عن الحالات، ولا تُجمع أعدادها كرصيد أو إنتاج منجز.</p></div>}
    </div>
  </div>;
}

export function SupplySummaries({ data }: { data: OperationsSupplyResponse }) {
  return <details className="oc-panel oc-supply-summaries p-3">
    <summary className="cursor-pointer text-xs font-bold text-violet-800">ملخصات المصادر · منفصلة عن حالات المتابعة</summary>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">كل رقم وفق تعريف مصدره؛ لا تُجمع أعداد الطلبات والتحويلات والمرتجعات والتوصيل ككمية واحدة.</p>
    <div className="mt-2 space-y-2">{data.summaries.map(summary => <div key={summary.source} className="rounded-lg border border-violet-100 p-2">
      <div className="flex items-start justify-between gap-2"><strong className="text-xs">{summary.label}</strong><b className="text-sm tabular-nums">{summary.coverage === "complete" && summary.value !== null ? summary.value.toLocaleString("en-US") : "غير متاح"}</b></div>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{summary.definition}</p>
      {summary.coverage !== "complete" && <p className="text-[11px] text-amber-900">{summary.coverage === "forbidden" ? "لا تتوفر صلاحية هذا المصدر." : "تعذر التحقق من هذا المصدر."} ليس صفرًا.</p>}
    </div>)}</div>
    {Object.entries(data.coverage.sources).filter(([id, source]) => (data.scope.source === "all" || data.scope.source === id) && source.state !== "complete").map(([id, source]) => <p key={id} className="mt-2 text-xs text-amber-900">{supplySourceLabel(id)}: {source.state === "forbidden" ? "لا تتوفر صلاحية المصدر حاليًا." : "تعذر تحميل المصدر أو التحقق من بياناته؛ أعد المحاولة."}</p>)}
  </details>;
}

export function SupplyCounters({ records, actorId, data, filtered }: {
  records: OperationsSupplyRecord[]; actorId?: string; data: OperationsSupplyResponse; filtered: boolean;
}) {
  const facts = supplyPageFacts(records, actorId, data.generatedAt);
  const missing = data.coverage.total === null || Object.entries(data.coverage.sources)
    .some(([id, source]) => (data.scope.source === "all" || data.scope.source === id) && source.state !== "complete");
  const unknownPriority = data.coverage.priorityCoverage === "unavailable" || records.some(record => record.priorityCoverage === "unavailable");
  const unavailable = missing && facts.count === 0;
  return <div aria-label="حقائق الحالات المعروضة" className="space-y-2">
    <p role="status" className="text-[11px] leading-5 text-muted-foreground">{supplyCoverageText(data)}</p>
    <dl className="oc-supply-counters">{[
      ["حالات ظاهرة", unavailable ? null : facts.count], ["بانتظار قرارك", unavailable ? null : facts.awaitingActor],
      ["عاجلة من المصدر", unavailable || unknownPriority ? null : facts.urgent], ["تجاوزت موعدها المسجل", unavailable ? null : facts.overdue],
    ].map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value === null ? "غير متاح" : Number(value).toLocaleString("en-US")}</dd></div>)}</dl>
    {unknownPriority && <p className="text-[11px] text-muted-foreground">بيانات الأولوية غير متاحة لبعض الحالات؛ لا يُستنتج منها عدم وجود حالات عاجلة.</p>}
    <p className="text-[10px] leading-5 text-muted-foreground">العدادات {filtered ? "للنتائج المرشحة في" : "في"} هذه الصفحة فقط؛ قد تتداخل ولا تُجمع. التأخر يعتمد على موعد مسجل، ولا يعني أولوية عاجلة أو إسنادًا شخصيًا.</p>
  </div>;
}

export function SupplyRecordDetail({ record, branches, actorId, open, refreshing }: {
  record: OperationsSupplyRecord; branches: Branch[]; actorId?: string; open: OpenSource; refreshing: boolean;
}) {
  const source = supplySourceHref(record, actorId, typeof window !== "undefined" ? window.location.origin : "https://operations.invalid");
  const inventory = record.inventoryMode === "real" ? "حقيقي وفق المصدر" : record.inventoryMode === "shadow" ? "ظل / تشغيلي؛ ليس إثبات رصيد فعلي" : "غير معروف من المصدر";
  return <article className="oc-supply-record space-y-4">
    <header><p className="text-xs font-bold text-violet-700">{supplySourceLabel(record.domain)} · <bdi>#{record.sourceId}</bdi></p><h3 className="mt-1 text-xl font-bold">{record.title}</h3><p className="mt-1 text-xs leading-6 text-muted-foreground">{record.branchIds.map(id => branches.find(branch => branch.id === id)?.name || id).join(" · ")}</p></header>
    <div className="oc-panel border-r-4 border-r-violet-500 p-4"><h4 className="text-sm font-bold">الخطوة التالية في المصدر</h4><p className="mt-1 text-sm leading-7">{record.nextStep.label || "لا يقدم المصدر خطوة تالية؛ افتح السجل الأصلي للمتابعة."}</p>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">{source.decision ? "تملك صلاحية هذه الخطوة وفق الحالة المحمّلة؛ يعيد المصدر التحقق قبل التنفيذ." : "المتابعة لا تعني أن الإجراء التالي مسند إليك أو أنك تملك اعتماده."}</p></div>
    {record.capabilityCoverage === "unavailable" && <p role="status" className="oc-panel p-3 text-xs leading-6 text-amber-900">تعذر التحقق من صلاحية الخطوة الحالية؛ المتاح هو عرض المصدر فقط، وليس دليلًا على امتلاك صلاحية تنفيذها.</p>}
    {record.relatedSource && <p className="oc-panel p-3 text-xs leading-6">هذا تكليف نقل مستقل مرتبط بسجل مصدر <bdi>#{record.relatedSource.sourceId}</bdi>؛ لا يُجمع عدده مع الطلب أو التحويل كحركة مخزون إضافية.</p>}
    <dl className="oc-panel oc-supply-facts divide-y divide-[#e7def0] text-sm">{[
      ["رقم المصدر", `#${record.sourceId}`], ["المرحلة الحالية", supplyStageLabel(record.stage)],
      ["الجهة المسؤولة", record.responsibleRole || record.owner || "غير مسجلة في المصدر"],
      ["الإسناد الفردي", record.ownerId ? "مسجل في المصدر؛ لا يمنح صلاحية قرار" : "غير مسجل في المصدر"],
      [record.deadlineLabel || "الموعد المسجل", record.dueAt ? time(record.dueAt) : "غير مسجل؛ لا نفترض موعدًا"],
      ["الأولوية المسجلة", supplyPriorityLabel(record)], ["وضع المخزون", inventory],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {record.history && record.history.length > 0 && <section><h4 className="text-sm font-bold">وقائع مسجلة في المصدر</h4><div className="mt-2 space-y-2">{record.history.map((fact, index) => <p key={index} className="oc-panel p-3 text-xs leading-6">{fact.label}{fact.at && <small className="block text-muted-foreground">{time(fact.at)}</small>}</p>)}</div></section>}
    <p className="text-xs leading-6 text-muted-foreground">فتح المصدر لا يعتمد الطلب، ولا يثبت الشحن أو الاستلام أو إتاحة المخزون. التنفيذ والتسوية وتأكيد الاستلام تتم في المسار المختص وحده.</p>
    {source.href ? <Button type="button" className="oc-supply-source-action min-h-11 bg-[#6941a5] hover:bg-[#4a2c75]" disabled={refreshing} onClick={() => {
      const latest = supplySourceHref(record, actorId, window.location.origin);
      if (latest.href) open(latest.href, record.branchId, record);
    }}>{source.label}<ArrowUpLeft className="mr-2 size-4 shrink-0" /></Button>
      : <p role="alert" className="text-xs text-destructive">رابط المصدر لا يطابق السجل المصرح به؛ لم يُتح إجراء الفتح. حدّث الحالات أو راجع المصدر المختص.</p>}
  </article>;
}