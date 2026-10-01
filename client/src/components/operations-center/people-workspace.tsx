import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpLeft, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import type { OperationsQueueItem } from "@shared/operations-center";
import type { OperationsPeopleRecord, OperationsPeopleResponse } from "@shared/operations-people";
import { Button } from "@/components/ui/button";
import { createOperationsHrCommandGuard } from "@/lib/operations-hr-state";
import { time } from "./record-sheet";
import {
  filterPeopleRecords, peopleCoverageText, peopleHasDecision, peopleNextAction, peoplePageFacts,
  peopleReadToolHref, peopleRecordKey, peopleRequestParams, peopleScopeMatches, peopleSelectionIntent,
  peopleSourceHref, peopleSourceLabel, peopleSources, peopleStageLabel, peopleToolHref,
  type PeopleRequest, type PeopleSource,
} from "./people-workspace-model";

type Branch = { id: string; name: string };
type OpenSource = (href: string, branchId: string, item?: OperationsQueueItem, isIntentCurrent?: () => boolean) => void;
const pageSize = 30;
export const peopleQueryKey = (request: PeopleRequest, actorId?: string) =>
  ["/api/operations-center/people", actorId, [...request.branchIds].sort().join(","), request.source, request.offset, request.limit] as const;

export function useOperationsPeopleQuery(request: PeopleRequest, actorId?: string, intentValid = true) {
  return useQuery<OperationsPeopleResponse>({
    queryKey: peopleQueryKey(request, actorId),
    enabled: intentValid && !!actorId && request.branchIds.length > 0 && request.branchIds.length <= 30,
    retry: false, staleTime: 0, gcTime: 0, placeholderData: undefined, refetchOnMount: "always",
    // The center live hook owns scoped SSE/polling invalidation of this prefix.
    refetchInterval: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      if (!intentValid) throw new Error("نطاق العودة إلى الموظفين غير صالح أو لم يعد مصرحًا به.");
      const response = await fetch(`/api/operations-center/people?${peopleRequestParams(request)}`, {
        credentials: "include", cache: "no-store", signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || body?.message || `تعذر تحميل حالات الموظفين (${response.status}).`);
      }
      const data: OperationsPeopleResponse = await response.json();
      if (!peopleScopeMatches(data, request)) throw new Error("بيانات الموظفين لا تطابق نطاق الفروع أو صفحة المصدر المطلوبة.");
      return data;
    },
  });
}

export function OperationsPeopleWorkspace({ branches, actorId, open }: {
  branches: Branch[]; actorId?: string; open: OpenSource;
}) {
  const client = useQueryClient();
  const [intent] = useState(() => peopleSelectionIntent(typeof window !== "undefined" ? window.location.search : "", branches.map(branch => branch.id)));
  const [intentCommands] = useState(createOperationsHrCommandGuard);
  const [branchId, setBranchId] = useState(intent.branchId);
  const [source, setSource] = useState<PeopleSource>(intent.source);
  const [offset, setOffset] = useState(0);
  const [stage, setStage] = useState("all");
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<string | null>(intent.record);
  const [mobileDetail, setMobileDetail] = useState(!!intent.record);
  const [payrollMonth, setPayrollMonth] = useState("");
  const [actionError, setActionError] = useState("");
  const currentReturnIntent = peopleSelectionIntent(typeof window !== "undefined" ? window.location.search : "", branches.map(branch => branch.id));
  const intentValid = intent.valid && currentReturnIntent.valid && (!branchId || branches.some(branch => branch.id === branchId));
  const scopedBranches = intentValid ? branches.filter(branch => !branchId || branch.id === branchId) : [];
  const request: PeopleRequest = { branchIds: scopedBranches.map(branch => branch.id), source, offset, limit: pageSize };
  const query = useOperationsPeopleQuery(request, actorId, intentValid);
  const snapshotRejected = !!query.data && !peopleScopeMatches(query.data, request);
  const data = intentValid && actorId && !query.isError && !snapshotRejected && query.data ? query.data : null;
  const records = data ? filterPeopleRecords(data.records, { stage, search }, branches) : [];
  const record = records.find(item => peopleRecordKey(item) === selection);
  const stages = Array.from(new Set(data?.records.map(item => item.step) || []));
  // Every render also guards changed actor/scope, revocation and refreshed source data.
  intentCommands.update(JSON.stringify([
    actorId, branches.map(branch => branch.id).sort(), intentValid, branchId, source, offset,
    stage, search, selection, payrollMonth, mobileDetail, query.dataUpdatedAt, query.status, query.fetchStatus,
  ]));
  useEffect(() => () => intentCommands.invalidate(), [intentCommands]);
  // Invalidate synchronously before setters: even a batched A→B→A is new intent.
  const changeIntent = (change: () => void) => { intentCommands.invalidate(); change(); };
  const reset = () => {
    intentCommands.invalidate();
    setOffset(0); setStage("all"); setSearch(""); setSelection(null); setMobileDetail(false);
    setPayrollMonth(""); setActionError("");
  };
  const paginate = (value: number) => {
    intentCommands.invalidate();
    setOffset(value); setStage("all"); setSearch(""); setSelection(null); setMobileDetail(false); setActionError("");
  };
  // Resolve the clicked case/tool from current cache state, not a previously rendered object.
  // The page's existing go then checks fresh source grants before navigation.
  const current = () => {
    const state = client.getQueryState<OperationsPeopleResponse>(peopleQueryKey(request, actorId));
    return intentValid && actorId && state?.status === "success" && state.fetchStatus === "idle" && state.data &&
      peopleScopeMatches(state.data, request) ? state.data : null;
  };
  const openRecord = (key: string) => {
    const latest = current();
    const clicked = latest && filterPeopleRecords(latest.records, { stage, search }, branches)
      .find(item => peopleRecordKey(item) === key);
    const destination = clicked && peopleSourceHref(clicked, actorId, window.location.origin, latest!.businessDate);
    if (!clicked || !destination?.href) {
      setActionError("تعذر التحقق من الحالة أو رابطها الحالي؛ لم يُفتح مصدر قديم. حدّث الحالات وأعد الاختيار."); return;
    }
    const token = intentCommands.capture();
    setActionError(""); open(destination.href, clicked.branchId, clicked, () => intentCommands.isCurrent(token));
  };
  const openTool = (id: string) => {
    const latest = current();
    const tool = latest?.tools.find(item => item.id === id && item.branchId === branchId);
    const href = latest && (tool ? peopleToolHref(tool, branchId, payrollMonth, window.location.origin) :
      peopleReadToolHref(id, branchId, latest, window.location.origin));
    if (!href) { setActionError("تعذر التحقق من أداة المصدر الحالية. اختر فرعًا وشهر الرواتب عند الحاجة ثم حدّث البيانات."); return; }
    const token = intentCommands.capture();
    setActionError(""); open(href, branchId, undefined, () => intentCommands.isCurrent(token));
  };

  if (!intentValid) return <div className="oc-workspace-grid oc-people-workspace" data-detail="false" data-testid="operations-people-workspace">
    <div className="oc-workspace-list">
      <p role="alert" className="oc-panel p-4 text-sm leading-7 text-destructive">نطاق العودة إلى الموظفين غير صالح أو لم يعد مصرحًا به. لم تُحمّل بيانات ولم تُفتح إجراءات، ولم يُوسّع النطاق إلى كل الفروع. أغلق النافذة واختر نطاقًا مصرحًا من المركز.</p>
    </div>
    <div className="oc-workspace-detail"><p className="text-sm leading-7 text-muted-foreground">أخفيت الحالات والتفاصيل والأدوات حتى اختيار نطاق مصرح به صراحةً.</p></div>
  </div>;

  return <div className="oc-workspace-grid oc-people-workspace" data-detail={mobileDetail} data-testid="operations-people-workspace">
    <div className="oc-workspace-list space-y-3">
      <div className="oc-panel space-y-1 p-3">
        <h3 className="text-sm font-bold">حالات الموظفين المفتوحة · ما الخطوة التالية؟</h3>
        <p className="text-xs leading-6 text-muted-foreground">هذه أعمال مفتوحة حاليًا وليست كل موظفي الفرع أو مهام اليوم. يعرض المركز الحالة والمسؤول ومسار الإجراء فقط؛ لا يعدّل موظفًا ولا يعتمد طلبًا هنا.</p>
        <p className="text-xs leading-6 text-muted-foreground">الحضور المعلّق وحده ليس إثبات غياب ولا طلب اعتماد؛ أي إجراء يظهر فقط وفق صلاحية الحالة الفعلية في مصدرها.</p>
      </div>
      <div className="oc-people-filters">
        <label>الفرع
          <select aria-label="فرع متابعة الموظفين" value={branchId} onChange={event => { setBranchId(event.target.value); reset(); }}>
            <option value="">كل الفروع المختارة · اختر فرعًا لفتح الأدوات</option>
            {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label>المصدر
          <select aria-label="مصدر متابعة الموظفين" value={source} onChange={event => { setSource(event.target.value as PeopleSource); reset(); }}>
            <option value="all">كل مصادر الموظفين</option>
            {peopleSources.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>المرحلة · في الصفحة
          <select aria-label="مرحلة حالات الموظفين في الصفحة" value={stage} onChange={event => changeIntent(() => { setStage(event.target.value); setActionError(""); })}>
            <option value="all">كل مراحل الصفحة</option>
            {stage !== "all" && !stages.includes(stage) && <option value={stage}>{peopleStageLabel(stage)}</option>}
            {stages.map(value => <option key={value} value={value}>{peopleStageLabel(value)}</option>)}
          </select>
        </label>
        <label>بحث · في الصفحة
          <span className="relative block"><Search className="pointer-events-none absolute right-3 top-3 size-4 text-violet-500" />
            <input aria-label="بحث في صفحة حالات الموظفين" value={search} maxLength={200} onChange={event => changeIntent(() => { setSearch(event.target.value); setActionError(""); })} placeholder="الموظف، رقم المصدر، المسؤول…" className="!pr-9" />
          </span>
        </label>
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">الفرع والمصدر يرشحان كامل نطاق الخادم قبل ترقيم الصفحات. المرحلة والبحث يرشحان الصفحة المحمّلة فقط؛ ليست هذه صفحة الطابور العام.</p>
      {query.isPending && <p role="status" className="text-sm">جار تحميل حالات الموظفين…</p>}
      {query.isError && <div role="alert" className="oc-panel space-y-2 p-3 text-sm text-destructive"><p>{query.error.message}</p><Button type="button" variant="outline" size="sm" onClick={() => changeIntent(() => { void query.refetch(); })}>إعادة المحاولة</Button></div>}
      {snapshotRejected && !query.isError && <p role="alert" className="text-xs leading-6 text-destructive">أخفيت بيانات سابقة لا تطابق نطاق الفروع أو صلاحيات المصدر أو الصفحة الحالية. حدّث الحالات للتحقق.</p>}
      {data && <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">حالات العمل الحالية</h3>
          <Button type="button" variant="ghost" size="sm" disabled={query.isFetching} onClick={() => changeIntent(() => { void query.refetch(); })}><RefreshCw className={`ml-1 size-3.5 ${query.isFetching ? "animate-spin" : ""}`} />تحديث الحالات</Button>
        </div>
        <PeopleCounters records={records} actorId={actorId} data={data} filtered={stage !== "all" || !!search.trim()} />
        {records.map(item => <button type="button" className="oc-list-item oc-people-case" key={peopleRecordKey(item)}
          data-active={selection === peopleRecordKey(item)} onClick={() => changeIntent(() => { setSelection(peopleRecordKey(item)); setMobileDetail(true); setActionError(""); })}>
          <span className="oc-people-case-top"><strong>{peopleSourceLabel(item.domain)} <bdi>#{item.sourceId}</bdi></strong><span className="oc-people-stage">{peopleStageLabel(item.step)}</span></span>
          <span className="mt-1 block text-sm font-semibold">{item.employee?.name || item.title}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{branches.find(branch => branch.id === item.branchId)?.name || item.branchId}{item.employee?.number ? <> · <bdi>{item.employee.number}</bdi></> : null}</span>
          <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">الحالة المسجلة: {peopleStageLabel(item.status)}</span>
          <span className="mt-2 block text-xs leading-5"><strong>التالي: </strong>{peopleNextAction(item, actorId)}</span>
          <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">المسؤول: {item.owner || "غير مسجل في المصدر"}</span>
          {peopleHasDecision(item, actorId) && <span className="mt-1 block text-[11px] font-bold text-violet-800">بانتظار قرارك · صلاحية حالية من المصدر</span>}
        </button>)}
        {!records.length && <p role="status" className="rounded-xl border border-dashed border-violet-200 p-4 text-sm text-muted-foreground">{stage !== "all" || search.trim() ? "لا نتائج تطابق المرحلة والبحث في هذه الصفحة." : "لا حالات ظاهرة لهذا المصدر في هذه الصفحة؛ الغياب لا يثبت اكتمال العمل."} تبقى أدوات المصادر المصرح بها متاحة ولو كان عدد الحالات صفرًا.</p>}
        <nav aria-label="صفحات حالات الموظفين" className="flex flex-wrap items-center gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" disabled={offset === 0 || query.isFetching} onClick={() => paginate(Math.max(0, offset - pageSize))}><ChevronRight className="size-4" />السابقة</Button>
          <span className="text-xs text-muted-foreground">صفحة {Math.floor(offset / pageSize) + 1}</span>
          <Button type="button" variant="outline" size="sm" disabled={data.coverage.nextOffset === null || query.isFetching} onClick={() => { if (data.coverage.nextOffset !== null) paginate(data.coverage.nextOffset); }}>التالية<ChevronLeft className="size-4" /></Button>
        </nav>
        <PeopleTools data={data} branchId={branchId} month={payrollMonth} onMonth={month => changeIntent(() => setPayrollMonth(month))} refreshing={query.isFetching} onOpen={openTool} />
        <PeopleSummaries data={data} />
        <p className="text-[11px] text-muted-foreground">آخر تحقق: {time(data.generatedAt)}{query.isFetching ? " · جار التحقق من المصدر…" : ""}</p>
      </>}
      {actionError && <p role="alert" className="text-xs leading-6 text-destructive">{actionError}</p>}
    </div>
    <div className="oc-workspace-detail space-y-4">
      <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-violet-700 md:hidden" onClick={() => changeIntent(() => setMobileDetail(false))}><ChevronRight className="size-4" />العودة للحالات والمرشحات</button>
      {query.isError ? <p role="alert" className="text-sm text-destructive">تعذر التحقق من صلاحية المصدر؛ أخفيت التفاصيل والإجراء السابق. أعد تحميل الحالات.</p>
        : snapshotRejected ? <p role="alert" className="text-sm text-destructive">لم تطابق البيانات الحالية النطاق أو صلاحية المصدر؛ أخفيت التفاصيل والإجراء السابق.</p>
        : query.isPending ? <p role="status" className="text-sm text-muted-foreground">جار التحقق من حالات الموظفين ضمن النطاق المختار…</p>
        : record && data ? <PeopleRecordDetail record={record} branches={branches} actorId={actorId} businessDate={data.businessDate} refreshing={query.isFetching} onOpen={() => openRecord(peopleRecordKey(record))} />
        : selection && data ? <p role="status" className="oc-panel p-4 text-sm leading-7">الحالة المحددة لم تعد ضمن نتائج هذه الصفحة بعد التحديث أو الترشيح. قد تغيرت مرحلتها أو نطاقها أو موقعها في الصفحات؛ هذا ليس تأكيدًا لإكمالها. اختر حالة ظاهرة أو راجع المصدر.</p>
        : <div className="py-12 text-center"><h3 className="text-base font-bold">اختر حالة عمل، لا بطاقة إجمالية</h3><p className="mt-2 text-sm leading-7 text-muted-foreground">ستظهر هوية المصدر والموظف المصرح به والمرحلة والمسؤول والخطوة التالية. أدوات الموظفين والرواتب مستقلة عن حالات المتابعة ولا تصبح مهامًا لأنك فتحتها.</p></div>}
      {actionError && mobileDetail && <p role="alert" className="text-xs leading-6 text-destructive">{actionError}</p>}
    </div>
  </div>;
}

export function PeopleCounters({ records, actorId, data, filtered }: {
  records: OperationsPeopleRecord[]; actorId?: string; data: OperationsPeopleResponse; filtered: boolean;
}) {
  const facts = peoplePageFacts(records, actorId);
  return <div aria-label="حقائق حالات الموظفين المعروضة" className="space-y-2">
    <p role="status" className="text-[11px] leading-5 text-muted-foreground">{peopleCoverageText(data)}</p>
    <dl className="oc-people-counters">{[["حالات ظاهرة", facts.count], ["بانتظار قرارك", facts.awaitingActor]].map(([label, value]) =>
      <div key={String(label)}><dt>{label}</dt><dd>{Number(value).toLocaleString("en-US")}</dd></div>)}</dl>
    <p className="text-[10px] leading-5 text-muted-foreground">العدادات {filtered ? "للنتائج المرشحة في" : "في"} هذه الصفحة فقط، وليست عدد الموظفين أو مجموع أعمال اليوم. الحالة أو الإسناد وحدهما لا يمنحانك صلاحية قرار.</p>
  </div>;
}

export function PeopleRecordDetail({ record, branches, actorId, businessDate, refreshing, onOpen }: {
  record: OperationsPeopleRecord; branches: Branch[]; actorId?: string; businessDate?: string; refreshing: boolean; onOpen: () => void;
}) {
  const source = peopleSourceHref(record, actorId, typeof window !== "undefined" ? window.location.origin : "https://operations.invalid", businessDate);
  return <article className="oc-people-record space-y-4">
    <header><p className="text-xs font-bold text-violet-700">{peopleSourceLabel(record.domain)} · <bdi>#{record.sourceId}</bdi></p>
      <h3 className="mt-1 text-xl font-bold">{record.employee?.name || record.title}</h3>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">{branches.find(branch => branch.id === record.branchId)?.name || record.branchId} · {record.title}</p></header>
    <div className="oc-panel border-r-4 border-r-violet-500 p-4"><h4 className="text-sm font-bold">الخطوة التالية في المصدر</h4><p className="mt-1 text-sm leading-7">{peopleNextAction(record, actorId)}</p>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">{source.decision ? "بانتظار قرارك وفق صلاحية الحالة الحالية؛ يعيد المصدر التحقق قبل التنفيذ." : "متابعة الحالة لا تعني أن اعتمادها مسند إليك أو أنك تملك اتخاذ القرار."}</p></div>
    {record.reason && <p className="oc-panel p-3 text-xs leading-7">{record.reason}</p>}
    {record.domain === "attendance" && <p className="oc-panel p-3 text-xs leading-7">السجل المعلّق لا يعني الغياب، ولا يثبت الحاجة لاعتماد؛ راجع بيانات الحضور في المصدر قبل الاستنتاج.</p>}
    {source.decision && <p className="oc-panel bg-violet-50 p-3 text-xs leading-7"><strong>سبب القرار المصرح به: </strong>{record.decision!.reason}</p>}
    <dl className="oc-panel oc-people-facts divide-y divide-[#e7def0] text-sm">{[
      ["رقم المصدر", `#${record.sourceId}`], ["الموظف", record.employee?.name || "لا يقدم المصدر هوية موظف هنا"],
      ["الرقم الوظيفي", record.employee?.number || "غير مسجل في المصدر"],
      ["المرحلة الحالية", peopleStageLabel(record.step)], ["الحالة المسجلة", peopleStageLabel(record.status)],
      ["الجهة المسؤولة", record.owner || "غير مسجلة في المصدر"],
      ["الإسناد الفردي", record.ownerId ? "مسجل في المصدر؛ لا يمنح صلاحية قرار" : "غير مسجل في المصدر"],
      ["الموعد المسجل", record.dueAt ? time(record.dueAt) : "غير مسجل؛ لا نفترض موعدًا"],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {record.history && record.history.length > 0 && <section><h4 className="text-sm font-bold">وقائع مسجلة في المصدر</h4><div className="mt-2 space-y-2">{record.history.map((fact, index) => <p key={index} className="oc-panel p-3 text-xs leading-6">{fact.label}{fact.at && <small className="block text-muted-foreground">{time(fact.at)}</small>}</p>)}</div></section>}
    <p className="text-xs leading-6 text-muted-foreground">العرض والفتح لا يغيّران الحالة. الاعتماد وتعديل بيانات الموظف والحسابات تتم في المسار المختص وحده؛ لا يعيد المركز حساب الرواتب أو السلف أو الإجازات.</p>
    {source.href ? <Button type="button" className="oc-people-source-action bg-[#6941a5] hover:bg-[#4a2c75]" disabled={refreshing} onClick={onOpen}>{source.label}<ArrowUpLeft className="mr-2 size-4 shrink-0" /></Button>
      : <p role="alert" className="text-xs text-destructive">رابط المصدر لا يطابق الحالة المصرح بها؛ لم يُتح إجراء الفتح. حدّث الحالات أو راجع المصدر المختص.</p>}
  </article>;
}

export function PeopleSummaries({ data }: { data: OperationsPeopleResponse }) {
  return <details className="oc-panel oc-people-summaries p-3">
    <summary className="cursor-pointer text-xs font-bold text-violet-800">ملخصات المصادر والموظفين · ليست حالات عمل</summary>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">كل عدد وفق تعريف مصدره؛ لا تُجمع طلبات الإجازات والحركات والسلف والحضور مع عدد الموظفين.</p>
    <div className="mt-2 space-y-2">{data.summaries.map(summary => <div key={summary.source} className="border-b border-violet-100 py-2">
      <div className="flex items-start justify-between gap-2"><strong className="text-xs">{summary.label}</strong><b className="text-sm tabular-nums">{summary.coverage === "complete" && summary.value !== null ? summary.value.toLocaleString("en-US") : "غير متاح"}</b></div>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{summary.definition}</p>
      {summary.coverage !== "complete" && <p className="text-[11px] text-amber-900">{summary.coverage === "forbidden" ? "لا تتوفر صلاحية هذا المصدر." : "تعذر التحقق من هذا المصدر."} ليس صفرًا.</p>}
    </div>)}</div>
    <p className="mt-2 text-xs leading-6"><strong>الموظفون في النطاق: </strong>{data.employees.coverage === "complete" && data.employees.value !== null ? data.employees.value.toLocaleString("en-US") : "غير متاح"}
      {" · "}النشطون: {data.employees.coverage === "complete" && data.employees.active !== null ? data.employees.active.toLocaleString("en-US") : "غير متاح"}</p>
    <p className="text-[11px] leading-5 text-muted-foreground">{data.employees.definition}</p>
    {peopleSources.filter(source => data.coverage.sources[source.id]?.state !== "complete").map(source => <p key={source.id} className="mt-2 text-xs leading-6 text-amber-900">{source.label}: {data.coverage.sources[source.id]?.state === "forbidden" ? "لا تتوفر صلاحية المصدر حاليًا." : "تعذر التحقق من المصدر؛ أعد المحاولة."} ليس صفرًا.</p>)}
  </details>;
}

export function PeopleTools({ data, branchId, month, onMonth, refreshing, onOpen }: {
  data: OperationsPeopleResponse; branchId: string; month: string; onMonth: (month: string) => void;
  refreshing: boolean; onOpen: (id: string) => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://operations.invalid";
  const tools = data.tools.filter(tool => branchId && tool.branchId === branchId);
  return <details className="oc-people-tools">
    <summary>أدوات الفرع · الدليل والمباشرة والنقل والرواتب</summary>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">مسارات مستقلة تبقى متاحة ضمن صلاحياتك ولو كان عدد الحالات صفرًا. النقل سجل حركة وليس قائمة مهام؛ الرواتب أداة مراجعة وليست طلب اعتماد.</p>
    {!branchId ? <p role="status" className="mt-2 text-xs font-semibold text-violet-800">اختر فرعًا واحدًا صراحةً من المرشح لفتح الأدوات؛ لا يوجد مسار موظفين لكل الفروع.</p> : <>
      {tools.some(tool => tool.id === "payroll") && <div className="oc-people-filters mt-2"><label>شهر الرواتب · اختيار صريح<input type="month" aria-label="شهر الرواتب لأداة الفرع" value={month} onChange={event => onMonth(event.target.value)} /></label></div>}
      <div className="oc-people-tools-grid mt-2">
        {tools.map(tool => <Button key={tool.id} type="button" variant="outline" size="sm" disabled={refreshing || !peopleToolHref(tool, branchId, month, origin)} onClick={() => onOpen(tool.id)}>{tool.label}<ArrowUpLeft className="mr-1 size-3.5 shrink-0" /></Button>)}
        {(["attendance", "leaves", "advances"] as const).map(id => <Button key={id} type="button" variant="outline" size="sm" disabled={refreshing || !peopleReadToolHref(id, branchId, data, origin)} onClick={() => onOpen(id)}>{peopleSourceLabel(id)}{data.coverage.sources[id]?.state !== "complete" ? " · غير متاح" : ""}<ArrowUpLeft className="mr-1 size-3.5 shrink-0" /></Button>)}
      </div>
      {tools.some(tool => tool.id === "payroll") && !month && <p className="mt-2 text-[11px] text-muted-foreground">حدد الشهر لفتح الرواتب؛ لن يُرسل شهر افتراضي أو شهر للمقارنة بدل الشهر الفعلي.</p>}
      {!tools.length && <p className="mt-2 text-xs text-muted-foreground">لم يقدّم المصدر أدوات الموارد البشرية لهذا الفرع ضمن صلاحياتك الحالية.</p>}
    </>}
  </details>;
}