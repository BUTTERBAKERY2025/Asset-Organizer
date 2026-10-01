import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, ArrowUpLeft, CalendarDays, ChartNoAxesCombined, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Factory, MapPinned, Search, ShieldCheck, Sparkles, Users, Wrench } from "lucide-react";
import { isOperationsInvestigationEvidence, operationsDecisionBoardProjection, type OperationsCenterResponse, type OperationsQueueItem, type OperationsCard } from "@shared/operations-center";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { operationsSourceLabel, queueQualifier } from "@/lib/operations-center-presentation";
import { Metric, time } from "./record-sheet";
import { OperationsMonthWorkspace } from "./month-workflow";
import "./decision-board.css";
import { monthlyReturnIntent } from "@/lib/operations-center-navigation";
import { analyticsSource, validatedInsightHref, type AnalyticsChart, type PerformanceDays } from "./analytics-model";
import { PerformanceDetail, PerformancePanel, PerformancePeriod, PerformanceRange, PerformanceSummary } from "./performance-panels";
import { AnalyticsAssistant, useOperationsAssistant } from "./analytics-assistant";
import { OperationsSupplyWorkspace } from "./supply-workspace";
import { OperationsPeopleWorkspace } from "./people-workspace";

const fmt = (value: number) => new Intl.NumberFormat("en-US").format(value);
const domains = [
  { id: "branches", label: "الفروع والتشغيل اليومي", hint: "حالة الفروع والإغلاقات", icon: MapPinned, types: ["daily_closure", "cashier_journal", "branch_complaint"], modules: ["daily_closures", "cashier_journal", "branch_complaints"] },
  { id: "people", label: "الموظفون", hint: "حالات العمل والخطوة التالية", icon: Users, types: ["attendance_record", "leave", "advance", "joining_offer", "joining_notification"], modules: ["attendance", "hr_leaves", "hr_advances", "operations_hr", "operations_joining"] },
  { id: "production", label: "الإنتاج والتوريد", hint: "حالات التوريد والخطوة التالية", icon: Factory, types: ["kitchen_order", "transfer", "reverse_movement", "delivery_assignment"], modules: ["central_kitchen_orders", "warehouse", "branch_supply", "delivery_tasks", "production"] },
  { id: "quality", label: "الجودة والصيانة", hint: "الفحوص والبلاغات", icon: Wrench, types: ["quality_check", "maintenance"], modules: ["quality_control", "maintenance"] },
  { id: "sales", label: "المبيعات والأداء", hint: "المبيعات ويوميات الكاشير", icon: ChartNoAxesCombined, types: ["cashier_journal", "daily_closure"], modules: ["sales_analytics", "cashier_journal", "daily_closures"] },
] as const;
type Workspace = "urgent" | "followup" | "decision" | "today" | "monthly" | "branches" | "people" | "production" | "quality" | "sales" | "analysis" | null;
type Selected = { kind: "record"; id: string } | { kind: "card"; id: string; branchId: string } | { kind: "branch"; id: string } | null;
type OpenSource = (href: string, branchId: string, item?: OperationsQueueItem, isIntentCurrent?: () => boolean) => void;
const reasonFor = (item: OperationsQueueItem) => item.decision?.reason || item.reason || (item.priorityReason ? "أولوية عاجلة مسجلة في المصدر." : `الحالة المسجلة: ${item.status}`);

export function OperationsDecisionBoard({ data, actorId, offset, onOffset, open, openBranch, retry, canOpenEmployees = false, performanceDays = 7, onPerformanceDays, performanceLoading = false, evidenceRefreshing = false, monthlyBranches, monthlyReady = true, monthlyLiveManaged = false }: {
  data: OperationsCenterResponse; actorId?: string; offset: number; onOffset: (value: number) => void; canOpenEmployees?: boolean;
  performanceDays?: PerformanceDays; onPerformanceDays?: (value: PerformanceDays) => void;
  performanceLoading?: boolean; evidenceRefreshing?: boolean;
  monthlyBranches?: { id: string; name: string }[]; monthlyReady?: boolean; monthlyLiveManaged?: boolean;
  open: OpenSource;
  openBranch: (id: string) => void; retry: () => void;
}) {
   const [view, setView] = useState<Workspace>(() => monthlyReturnIntent(window.location.search, (monthlyBranches || data.branches).map(branch => branch.id)).monthly ? "monthly" : new URLSearchParams(window.location.search).get("workspace") === "analysis" ? "analysis" : new URLSearchParams(window.location.search).get("workspace") === "production" ? "production" : new URLSearchParams(window.location.search).get("workspace") === "people" ? "people" : null);
  const [selected, setSelected] = useState<Selected>(null);
  const [search, setSearch] = useState("");
  const [mobileDetail, setMobileDetail] = useState(() => new URLSearchParams(window.location.search).get("workspace") === "analysis");
  const [analysisTab, setAnalysisTab] = useState<AnalyticsChart | "assistant">("sales");
  const [analysisLinkError, setAnalysisLinkError] = useState("");
  const ids = data.scope.branchIds;
  const scopeKey = [...ids].sort().join(",");
  const branchName = (id: string) => data.branches.find(branch => branch.id === id)?.name ?? id;
  const { queue, critical, overdue, priority, followup, decision, today, evidence } = useMemo(
    () => operationsDecisionBoardProjection(data.queue, ids, actorId, data.generatedAt, data.businessDate),
    [data.queue, data.generatedAt, data.businessDate, actorId, scopeKey]);
  const cohorts = { urgent: priority, followup, decision, today };
  const cards = data.cards.filter(card => ids.includes(card.branchId));
  const domain = domains.find(item => item.id === view);
  const domainRows = domain ? queue.filter(item => (domain.types as readonly string[]).includes(item.sourceType)) : [];
  const domainCards = domain ? cards.filter(card => (domain.modules as readonly string[]).includes(card.module)) : [];
  const domainAvailable = (entry: typeof domains[number]) => entry.id === "branches" || (entry.id === "people" && canOpenEmployees) ||
    queue.some(item => (entry.types as readonly string[]).includes(item.sourceType)) ||
    cards.some(card => (entry.modules as readonly string[]).includes(card.module)) ||
    data.modules.some(module => (entry.modules as readonly string[]).includes(module));
  const unavailable = Object.values(data.coverage.queue).some(value => value === "unavailable");
  const qualified = queueQualifier(data.coverage.truncated, data.coverage.nextOffset, offset, unavailable);
  const analysis = data.analytics;
  const assistant = useOperationsAssistant(data, actorId, performanceDays, evidenceRefreshing);
  const choose = (next: Selected) => { setSelected(next); setMobileDetail(true); };
  const enter = (next: Workspace, selection: Selected = null) => { setSearch(""); setView(next); setSelected(selection); setMobileDetail(!!selection); };
  const urgentCase = critical[0];
  const record = selected?.kind === "record" ? queue.find(item => item.id === selected.id) : undefined;
  const card = selected?.kind === "card" ? cards.find(item => item.id === selected.id && item.branchId === selected.branchId) : undefined;
  const filtered = (text: string) => text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const rows = (view && view in cohorts ? cohorts[view as keyof typeof cohorts] : domainRows).filter(item => filtered(`${item.title} ${item.status} ${branchName(item.branchId)}`));
  const sources = domainCards.filter(item => filtered(`${item.title} ${branchName(item.branchId)}`));
  const showAnalysis = (tab: AnalyticsChart | "assistant") => {
    enter("analysis"); setAnalysisTab(tab); setMobileDetail(true); setAnalysisLinkError("");
  };
  const openAnalytics: OpenSource = (href, branchId, item, isIntentCurrent) => {
    const destination = new URL(href, window.location.origin);
    destination.searchParams.set("centerWorkspace", "analysis");
    open(`${destination.pathname}${destination.search}${destination.hash}`, branchId, item, isIntentCurrent);
  };
  const tile = (key: Workspace, label: string, hint: string, Icon: typeof Activity, count?: number, accent?: string) =>
    <button key={key} type="button" onClick={() => enter(key)} className={`oc-tile ${accent || ""}`}><span className="oc-tile-icon"><Icon size={23} strokeWidth={1.9} /></span><span className="min-w-0 flex-1"><strong className="block text-[14px] font-bold leading-6">{label}</strong><small className="block text-xs leading-5 text-muted-foreground">{hint}</small></span>{count !== undefined && <b className="self-start rounded-full bg-violet-100 px-2 py-0.5 text-xs tabular-nums text-violet-800">{fmt(count)}</b>}</button>;

  return <div className="oc-board space-y-3 pb-5" data-testid="operations-decision-board">
    {urgentCase && <section className="flex flex-col gap-3 rounded-2xl border border-[#efc9bb] bg-[#fff6f0] p-3 sm:flex-row sm:items-center" aria-label="حالة عاجلة">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#fbe7dc] text-[#a54629]"><AlertTriangle size={20} /></span>
      <div className="min-w-0 flex-1"><strong className="block text-sm text-[#7d3928]">حالة عاجلة · {branchName(urgentCase.branchId)}</strong><p className="mt-0.5 text-sm font-semibold">{urgentCase.title} — {reasonFor(urgentCase)}</p><p className="text-xs text-[#785c52]">المسؤول: {urgentCase.owner || "غير معروف"}{urgentCase.dueAt ? ` · الموعد ${time(urgentCase.dueAt)}` : ""}</p></div>
      <Button type="button" className="shrink-0 bg-[#6941a5] hover:bg-[#4a2c75]" onClick={() => enter("urgent", { kind: "record", id: urgentCase.id })}>معالجة <ArrowLeft className="mr-2 size-4" /></Button>
    </section>}

    <section aria-labelledby="oc-daily-heading">
      <div className="mb-2 flex items-end justify-between gap-3"><div><p className="text-xs font-bold text-violet-700">01 / مسار القرار</p><h2 id="oc-daily-heading" className="text-lg font-bold">ما يحتاج منك اليوم</h2></div><span className="text-xs text-muted-foreground">{qualified}</span></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
         {priority.length > 0 && tile("urgent", "الأولوية", `طارئ ${fmt(critical.length)} · متأخر ${fmt(overdue.length)}`, AlertTriangle, priority.length, "oc-tile-urgent")}
        {followup.length > 0 && tile("followup", "يحتاج متابعة", "سجلات تشغيل مفتوحة", Activity, followup.length)}
        {decision.length > 0 && tile("decision", "بانتظار قراري", "قرار مطلوب صراحةً", ShieldCheck, decision.length, "oc-tile-decision")}
        {today.length > 0 && tile("today", "مهام اليوم", "مواعيد مسجلة لهذا اليوم", ClipboardList, today.length)}
         {tile("monthly", "ملفات الشهر والإغلاق", "مقارنة الفروع · مراجعة فرع واحد", CalendarDays)}
      </div>
       {evidence.length > 0 && <button type="button" onClick={() => enter("quality")} className="mt-2 text-right text-xs font-semibold text-violet-700 hover:underline">{fmt(evidence.length)} دليل جودة يحتاج التحقيق · فحوص اليوم ملاحظات وليست مهام قابلة للإكمال <ArrowUpLeft className="inline size-3.5" /></button>}
      {unavailable && <p role="status" className="mt-2 text-xs text-amber-900">بعض المصادر غير متاحة؛ الأعداد تخص السجلات المعروضة فقط وليست دليل اكتمال.</p>}
    </section>

    <section aria-labelledby="oc-domain-heading">
      <div className="mb-2"><p className="text-xs font-bold text-violet-700">02 / مجالات التشغيل</p><h2 id="oc-domain-heading" className="text-lg font-bold">افتح مجال العمل</h2></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">{domains.filter(domainAvailable).map(item => tile(item.id, item.label, item.hint, item.icon))}</div>
    </section>

    <section aria-labelledby="oc-evidence-heading">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold text-violet-700">03 / قراءة الأداء</p><h2 id="oc-evidence-heading" className="text-lg font-bold">أدلة من التشغيل</h2></div>
        <div className="flex flex-wrap items-center gap-3">{onPerformanceDays && <PerformanceRange days={performanceDays} onChange={onPerformanceDays} />}<button type="button" className="text-xs font-bold text-violet-700 hover:underline" onClick={() => showAnalysis("sales")}>تفاصيل التحليل <ArrowUpLeft className="inline size-3.5" /></button></div>
      </div>
      <div className="mb-2"><PerformancePeriod data={data} /></div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(230px,.7fr)]">
        <PerformancePanel chart="sales" data={data} loading={performanceLoading} onExpand={() => showAnalysis("sales")} />
        <PerformancePanel chart="followups" data={data} onExpand={() => showAnalysis("followups")} />
      <div className="oc-panel flex flex-col gap-3 p-4 md:col-span-2 md:flex-row md:items-center lg:col-span-1 lg:items-start">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><Sparkles size={19} /></span>
        <div className="min-w-0 flex-1 space-y-2"><PerformanceSummary data={data} />
          {assistant.result?.insights[0] && <p className="border-t border-violet-100 pt-2 text-xs leading-6"><strong className="text-violet-700">اقتراح المساعد (ليس حقيقة تشغيلية): </strong>{assistant.result.insights[0].explanation}</p>}
          <Button variant="outline" size="sm" onClick={() => showAnalysis("assistant")}>المساعد ومراجعة الأدلة</Button>
        </div>
      </div>
      </div>
    </section>

    <Dialog open={!!view} onOpenChange={openState => { if (!openState) { setView(null); setSelected(null); setMobileDetail(false); } }}>
       <DialogContent dir="rtl" className={`oc-board oc-workspace ${view === "analysis" ? "oc-analytics-workspace" : view === "monthly" ? "oc-month-workspace" : view === "people" ? "oc-people-window" : ""}`}>
        <DialogHeader className="oc-workspace-heading shrink-0 border-b border-[#e7def0] bg-[#fdfbff] px-5 py-4 text-right">
          <p className="text-[11px] font-bold text-violet-700">BUTTER BAKERY / مركز التشغيل</p>
           <DialogTitle className="text-right text-xl font-bold">{view === "urgent" ? "الأولوية: طارئ ومتأخر" : view === "followup" ? "يحتاج متابعة" : view === "decision" ? "بانتظار قراري" : view === "today" ? "مهام اليوم" : view === "monthly" ? "الإغلاقات الشهرية" : view === "analysis" ? "الأداء والتحليل" : domain?.label || "مجال التشغيل"}</DialogTitle>
           <DialogDescription className="text-right text-xs">{view === "monthly" ? "كل الفروع المصرح بها للمقارنة فقط · الإجراءات التشغيلية لفرع واحد وشهر واحد" : view === "production" ? "متابعة يومية للإنتاج والتوريد · الإجراء النهائي والصلاحية في المصدر المختص" : view === "people" ? "حالات موظفين مفتوحة حاليًا · الإجراء النهائي في المصدر · ليست كلها مهام اليوم" : "نطاق الفروع المختار · عرض السجل لا يغيّر حالته"}</DialogDescription>
          {view === "analysis" && onPerformanceDays && <PerformanceRange days={performanceDays} onChange={onPerformanceDays} />}
        </DialogHeader>
         {view === "monthly" ? <OperationsMonthWorkspace key={`${actorId}:${(monthlyBranches || data.branches).map(branch => branch.id).sort().join(",")}`} branches={monthlyBranches || data.branches} actorId={actorId} ready={monthlyReady} liveManaged={monthlyLiveManaged} open={open} /> : view === "production" ? <OperationsSupplyWorkspace key={`${actorId}:${scopeKey}`} branches={data.branches.filter(branch => ids.includes(branch.id))} actorId={actorId} open={open} canOpenPurchasing={data.modules.includes("warehouse")} /> : view === "people" ? <OperationsPeopleWorkspace key={`${actorId}:${scopeKey}`} branches={data.branches.filter(branch => ids.includes(branch.id))} actorId={actorId} open={open} /> : <div className="oc-workspace-grid" data-detail={mobileDetail}>
          <div className="oc-workspace-list space-y-2">
            {view === "analysis" ? <div className="space-y-3 text-sm">
              <strong>الأدلة ومصدر التحليل</strong>
              <PerformancePeriod data={data} />
              <p className="text-xs text-muted-foreground">إجمالي يوميات المبيعات المعتمدة أو المرحلة، وليس صافي المبيعات. المتابعات لقطة حالية من السجلات المحمّلة. البيانات الناقصة لا تُعرض كصفر.</p>
              {(["sales", "followups", "assistant"] as const).map(tab => <button type="button" className="oc-list-item" key={tab} data-active={!selected && analysisTab === tab} onClick={() => { setSelected(null); setAnalysisTab(tab); setMobileDetail(true); }}>
                <strong>{tab === "sales" ? "المبيعات · الرسم والأيام والفروع" : tab === "followups" ? "المتابعات · الرسم ومصادر الفروع" : "تحليل المساعد · اقتراحات لا حقائق"}</strong><ChevronLeft className="inline size-4 text-violet-700" />
              </button>)}
              <h3 className="text-xs font-bold">ملاحظات من السجلات · ليست استجابة المساعد</h3>
              {analysis?.observations?.map((observation, index) => <div className="oc-panel p-3" key={index}>
                <strong>{observation.title}</strong><p className="text-xs leading-6 text-muted-foreground">{observation.explanation}</p><small>المصدر: {analyticsSource(observation.source)}</small>
                <details className="mt-2"><summary className="cursor-pointer text-xs font-bold text-violet-700">مصادر الدليل ({observation.sourceRefs?.length || 0})</summary>
                {observation.sourceRefs?.map((reference, sourceIndex) => <Button key={`${reference.sourceType}:${reference.sourceId}:${sourceIndex}`} variant="outline" size="sm" className="mt-2 block" onClick={() => {
                  const href = validatedInsightHref({ ...reference, evidence: { label: "", source: observation.source, value: null, period: `${analysis.period.from}/${analysis.period.to}` } }, data, window.location.origin);
                  if (!href) { setAnalysisLinkError("رابط المصدر لا يطابق الدليل أو النطاق والفترة؛ لم يتم فتحه."); return; }
                  setAnalysisLinkError("");
                  openAnalytics(href, reference.branchId, queue.find(item => item.sourceType === reference.sourceType && item.sourceId === reference.sourceId && item.branchId === reference.branchId));
                }}>فتح مصدر الدليل {observation.sourceRefs.length > 1 ? sourceIndex + 1 : ""}</Button>)}
                </details>
              </div>)}
              {analysisLinkError && <p role="alert" className="text-xs text-red-700">{analysisLinkError}</p>}
            </div> : view === "branches" ? data.branches.filter(item => ids.includes(item.id)).map(item => <button type="button" key={item.id} onClick={() => choose({ kind: "branch", id: item.id })} className="oc-list-item" data-active={selected?.kind === "branch" && selected.id === item.id}><strong>{item.name}</strong><span className="mt-1 block text-xs text-muted-foreground">{queue.filter(row => row.branchId === item.id).length} سجلات في الصفحة الحالية</span></button>) : <>
              <label className="relative block"><Search className="absolute right-3 top-3 size-4 text-violet-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث في السجلات" aria-label="بحث في السجلات" className="min-h-10 w-full rounded-lg border border-violet-200 bg-[#fdfbff] pr-10 pl-3 text-sm" /></label>
               {view === "urgent" ? [
                 { key: "critical", label: "طارئ · أولوية صريحة من المصدر", items: rows.filter(item => critical.includes(item)) },
                 { key: "overdue", label: "متأخر · تجاوز الموعد المسجل", items: rows.filter(item => overdue.includes(item)) },
               ].filter(group => group.items.length).map(group => <section key={group.key} aria-label={group.label} className="space-y-2">
                 <h3 className="text-xs font-bold text-violet-800">{group.label} ({fmt(group.items.length)})</h3>
                 {group.items.map(item => <button key={item.id} type="button" onClick={() => choose({ kind: "record", id: item.id })} className="oc-list-item" data-active={selected?.kind === "record" && selected.id === item.id}><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{branchName(item.branchId)} · {operationsSourceLabel(item.sourceType)} · {item.status}</span></button>)}
               </section>) : rows.map(item => <button key={item.id} type="button" onClick={() => choose({ kind: "record", id: item.id })} className="oc-list-item" data-active={selected?.kind === "record" && selected.id === item.id}><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{branchName(item.branchId)} · {operationsSourceLabel(item.sourceType)} · {item.status}{isOperationsInvestigationEvidence(item) ? " · دليل للتحقيق، لا حالة معالجة" : ""}</span></button>)}
              {sources.map(item => <button key={`${item.branchId}:${item.id}`} type="button" onClick={() => choose({ kind: "card", id: item.id, branchId: item.branchId })} className="oc-list-item" data-active={selected?.kind === "card" && selected.id === item.id && selected.branchId === item.branchId}><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{branchName(item.branchId)} · مصدر المجال</span></button>)}
              {!rows.length && !sources.length && <p className="rounded-xl border border-dashed border-violet-200 p-5 text-center text-sm text-muted-foreground">{search ? "لا نتائج تطابق البحث." : "لا سجلات ظاهرة في هذه الصفحة؛ الغياب لا يعني اكتمال العمل."}</p>}
              {view !== "decision" && view !== "today" && <div className="flex gap-2 pt-2"><Button variant="outline" size="sm" disabled={offset === 0} onClick={() => { setSelected(null); setMobileDetail(false); onOffset(Math.max(0, offset - data.scope.limit)); }}><ChevronRight className="size-4" />السابقة</Button><Button variant="outline" size="sm" disabled={data.coverage.nextOffset === null} onClick={() => { setSelected(null); setMobileDetail(false); onOffset(data.coverage.nextOffset!); }}>التالية<ChevronLeft className="size-4" /></Button></div>}
            </>}
          </div>
          <div className="oc-workspace-detail">
            <button type="button" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-violet-700 md:hidden" onClick={() => setMobileDetail(false)}><ChevronRight className="size-4" />العودة للقائمة</button>
            {record ? <RecordDetail item={record} branch={branchName(record.branchId)} open={open} /> :
              card ? <CardDetail card={card} branch={branchName(card.branchId)} open={open} retry={retry} /> :
              selected?.kind === "branch" ? <div className="space-y-4"><h3 className="text-xl font-bold">{branchName(selected.id)}</h3>
                <p className="text-sm text-muted-foreground">عرض تفاصيل التشغيل اليومية لهذا الفرع في مسار المصدر المخصص.</p>
                <Button onClick={() => openBranch(selected.id)}>فتح تشغيل الفرع <ArrowUpLeft className="mr-2 size-4" /></Button>
              </div> :
              view === "analysis" ? analysisTab === "assistant" ? <AnalyticsAssistant data={data} assistant={assistant} open={openAnalytics} /> : <PerformanceDetail chart={analysisTab} data={data} loading={performanceLoading} open={openAnalytics} /> :
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground"><CircleHelp className="size-9 text-violet-400" /><p className="max-w-sm text-sm">اختر سجلًا من القائمة لعرض السبب والمسؤول والموعد وتفاصيل المصدر هنا.</p></div>}
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </div>;
}

function RecordDetail({ item, branch, open }: { item: OperationsQueueItem; branch: string; open: OpenSource }) {
  const history = item.history || [];
  const investigation = isOperationsInvestigationEvidence(item);
  return <div className="space-y-5"><div><p className="text-xs font-bold text-violet-700">{branch} / {operationsSourceLabel(item.sourceType)}</p><h3 className="mt-1 text-xl font-bold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.status}</p></div>
    <div className="oc-panel border-r-4 border-r-violet-500 p-4"><strong className="text-sm">لماذا يحتاج الانتباه؟</strong><p className="mt-1 text-sm leading-7">{reasonFor(item)}</p></div>
    {investigation && <p className="oc-panel bg-violet-50 p-4 text-sm">دليل جودة يحتاج التحقيق، وليس مهمة غير محلولة. لا يسجل المصدر دورة معالجة أو إغلاق؛ اختفاء الفحص من فحوص اليوم لا يثبت معالجة الملاحظة.</p>}
    {item.decision?.awaitingActor && <div className="oc-panel border-r-4 border-r-[#6941a5] bg-violet-50 p-4">
      <strong className="text-sm text-violet-900">بانتظار قرارك الآن</strong>
      <p className="mt-1 text-sm leading-7">{item.decision.reason}</p>
      <p className="mt-2 text-xs text-violet-800">الإجراء المصرح به: {item.decision.label} · {item.decision.capability === "approve" ? "اعتماد" : "مراجعة"} ضمن صلاحية المصدر.</p>
      <p className="mt-1 text-xs text-muted-foreground">الخطوة التالية: افتح مسار المصدر لاتخاذ الإجراء؛ العرض هنا لا ينفّذ القرار.</p>
    </div>}
    <dl className="oc-panel divide-y divide-[#e7def0] text-sm">{[
      ["الجهة المسؤولة", item.owner || "غير معروفة"],
      ["الإسناد الفردي للسجل", item.ownerId ? "مسجل في المصدر" : "غير معروف من المصدر؛ منفصل عن صلاحية قرارك"],
      ["الموعد", item.dueAt ? time(item.dueAt) : "غير معروف"],
       [investigation ? "نتيجة الفحص (ليست حالة معالجة)" : "الحالة / الخطوة", `${item.status} · ${item.step}`],
    ].map(([label, value]) => <div className="flex justify-between gap-4 p-3" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="text-left font-semibold">{value}</dd></div>)}</dl>
    <div><h4 className="text-sm font-bold">سجل الوقائع</h4>{history.length ? <div className="mt-2 space-y-2">{history.map((fact, index) => <p className="oc-panel p-3 text-sm" key={index}>{fact.label} {fact.at && <span className="block text-xs text-muted-foreground">{time(fact.at)}</span>}</p>)}</div> : <p className="mt-1 text-sm text-muted-foreground">لا يقدم هذا المصدر سجل وقائع تفصيليًا هنا؛ راجع السجل الأصلي قبل اتخاذ القرار.</p>}</div>
    <Button className="min-h-11 bg-[#6941a5] hover:bg-[#4a2c75]" onClick={() => open(item.decision?.awaitingActor ? item.decision.href : item.href, item.branchId, item)}>{item.decision?.awaitingActor ? `${item.decision.label} في المسار المختص` : investigation ? "فتح دليل الجودة للتحقيق" : "فتح السجل للمتابعة"} <ArrowUpLeft className="mr-2 size-4" /></Button>
  </div>;
}
function CardDetail({ card, branch, open, retry }: { card: OperationsCard; branch: string; open: OpenSource; retry: () => void }) {
  return <div className="space-y-4"><p className="text-xs font-bold text-violet-700">{branch} / مصدر المجال</p><h3 className="text-xl font-bold">{card.title}</h3>{card.state !== "ready" ? <div role="alert" className="oc-panel p-4 text-sm">المصدر غير متاح؛ الغياب ليس صفرًا. {card.error}<Button variant="outline" size="sm" className="mt-3 block" onClick={retry}>إعادة المحاولة</Button></div> : <div className="grid gap-2 sm:grid-cols-2">{card.metrics.map((metric, index) => <Metric key={`${metric.key}:${index}`} metric={metric} />)}</div>}<Button onClick={() => open(card.href, card.branchId)}>فتح مصدر الفرع <ArrowUpLeft className="mr-2 size-4" /></Button></div>;
}