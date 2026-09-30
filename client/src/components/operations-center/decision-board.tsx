import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Activity, AlertTriangle, ArrowLeft, ArrowUpLeft, CalendarDays, ChartNoAxesCombined, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Factory, MapPinned, Search, ShieldCheck, Sparkles, Users, Wrench } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { operationsDecisionQueue, type OperationsCenterResponse, type OperationsQueueItem, type OperationsCard } from "@shared/operations-center";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { operationsSourceLabel, queueQualifier } from "@/lib/operations-center-presentation";
import { Metric, time } from "./record-sheet";
import { OperationsMonthWorkspace } from "./month-workflow";
import "./decision-board.css";

const fmt = (value: number) => new Intl.NumberFormat("en-US").format(value);
const dayKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const domains = [
  { id: "branches", label: "الفروع والتشغيل اليومي", hint: "حالة الفروع والإغلاقات", icon: MapPinned, types: ["daily_closure", "cashier_journal", "branch_complaint"], modules: ["daily_closures", "cashier_journal", "branch_complaints"] },
  { id: "people", label: "الموظفون", hint: "الحضور والإجازات والسلف", icon: Users, types: ["attendance_record", "leave", "advance"], modules: ["attendance", "hr_leaves", "hr_advances"] },
  { id: "production", label: "الإنتاج والتوريد", hint: "المطبخ والتحويلات والتوصيل", icon: Factory, types: ["kitchen_order", "transfer", "reverse_movement", "delivery_assignment"], modules: ["central_kitchen_orders", "warehouse", "delivery_tasks"] },
  { id: "quality", label: "الجودة والصيانة", hint: "الفحوص والبلاغات", icon: Wrench, types: ["quality_check", "maintenance"], modules: ["quality_control", "maintenance"] },
  { id: "sales", label: "المبيعات والأداء", hint: "المبيعات ويوميات الكاشير", icon: ChartNoAxesCombined, types: ["cashier_journal", "daily_closure"], modules: ["sales_analytics", "cashier_journal", "daily_closures"] },
] as const;
type Workspace = "urgent" | "followup" | "decision" | "today" | "monthly" | "branches" | "people" | "production" | "quality" | "sales" | "analysis" | null;
type Selected = { kind: "record"; id: string } | { kind: "card"; id: string; branchId: string } | { kind: "branch"; id: string } | null;
type Insight = { title: string; explanation: string; sourceType: string; sourceId: string; branchId: string; href: string; evidence?: { label: string; source: string; period: string; value: number | null; unit?: string } };
type InsightResponse = { kind: "ai"; generatedAt: string; insights: Insight[] };
const reasonFor = (item: OperationsQueueItem) => item.decision?.reason || item.reason || (item.priorityReason ? "أولوية عاجلة مسجلة في المصدر." : `الحالة المسجلة: ${item.status}`);

function ChartPanel({ title, note, children, onClick }: { title: string; note: string; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="oc-panel min-w-0 p-4 text-right hover:border-violet-300 focus-visible:outline-2 focus-visible:outline-violet-600">
    <span className="flex items-center justify-between gap-2"><strong className="text-sm">{title}</strong><ArrowUpLeft className="size-4 text-violet-700" /></span>
    <span className="block text-xs text-muted-foreground">{note}</span>
    <div className="oc-chart mt-2 pointer-events-none" dir="ltr">{children}</div>
  </button>;
}

export function OperationsDecisionBoard({ data, actorId, offset, onOffset, open, openBranch, retry, canOpenEmployees = false }: {
  data: OperationsCenterResponse; actorId?: string; offset: number; onOffset: (value: number) => void; canOpenEmployees?: boolean;
  open: (href: string, branchId: string, item?: OperationsQueueItem) => void;
  openBranch: (id: string) => void; retry: () => void;
}) {
  const [view, setView] = useState<Workspace>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [search, setSearch] = useState("");
  const [mobileDetail, setMobileDetail] = useState(false);
  const ids = data.scope.branchIds;
  const scopeKey = [...ids].sort().join(",");
  const branchName = (id: string) => data.branches.find(branch => branch.id === id)?.name ?? id;
  const { unique: queue, critical, awaitingDecision } = useMemo(
    () => operationsDecisionQueue(data.queue.filter(item => ids.includes(item.branchId)), actorId, data.generatedAt),
    [data.queue, data.generatedAt, actorId, scopeKey]);
  const decision = awaitingDecision;
  const today = queue.filter(item => item.dueAt && Number.isFinite(Date.parse(item.dueAt)) && dayKey(item.dueAt) === data.businessDate);
  const followup = queue.filter(item => !critical.includes(item) && !decision.includes(item));
  const cohorts = { urgent: critical, followup, decision, today };
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
  const salesPoints = (analysis?.sales.daily || []).map(point => ({ date: point.date.slice(5), value: point.value }));
  const branchPoints = (analysis?.followups.byBranch || []).filter(point => ids.includes(point.branchId)).map(point => ({ name: branchName(point.branchId), value: point.count }));
  const insights = useMutation({
    mutationFn: async (request: { scope: string; branchIds: string[] }) => {
      const response = await apiRequest("POST", "/api/operations-center/insights", { branchIds: request.branchIds });
      return { scope: request.scope, result: await response.json() as InsightResponse };
    },
  });
  const aiResult = insights.data?.scope === scopeKey ? insights.data.result : null;
  const aiError = insights.variables?.scope === scopeKey && insights.isError;
  const aiLoading = insights.variables?.scope === scopeKey && insights.isPending;
  const choose = (next: Selected) => { setSelected(next); setMobileDetail(true); };
  const enter = (next: Workspace, selection: Selected = null) => { setSearch(""); setView(next); setSelected(selection); setMobileDetail(!!selection); };
  const urgentCase = critical[0];
  const record = selected?.kind === "record" ? queue.find(item => item.id === selected.id) : undefined;
  const card = selected?.kind === "card" ? cards.find(item => item.id === selected.id && item.branchId === selected.branchId) : undefined;
  const filtered = (text: string) => text.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const rows = (view && view in cohorts ? cohorts[view as keyof typeof cohorts] : domainRows).filter(item => filtered(`${item.title} ${item.status} ${branchName(item.branchId)}`));
  const sources = domainCards.filter(item => filtered(`${item.title} ${branchName(item.branchId)}`));
  const aiOpen = (insight: Insight) => {
    if (!ids.includes(insight.branchId)) return;
    const found = queue.find(item => item.sourceType === insight.sourceType && item.sourceId === insight.sourceId && item.branchId === insight.branchId);
    if (found && found.href === insight.href) { enter("analysis", { kind: "record", id: found.id }); return; }
    const source = cards.find(item => item.branchId === insight.branchId && item.href === insight.href);
    if (source) { enter("analysis", { kind: "card", id: source.id, branchId: source.branchId }); return; }
    // Server-attached analytic/monthly provenance only; never navigate a URL supplied by model text.
    const expectedPaths: Record<string, string[]> = { sales_trend: ["/sales-analytics"], payroll_month: ["/hr-hub", "/salary-closing"], expenses_month: ["/pnl-dashboard"] };
    if (!expectedPaths[insight.sourceType]) return;
    try {
      const destination = new URL(insight.href, window.location.origin);
      const month = insight.evidence?.period?.slice(0, 7);
      if (destination.origin === window.location.origin &&
        expectedPaths[insight.sourceType].includes(destination.pathname) &&
        destination.searchParams.get(destination.pathname === "/salary-closing" ? "branch" : "branchId") === insight.branchId &&
        /^\d{4}-(0[1-9]|1[0-2])$/.test(month || "") &&
        destination.searchParams.get("month") === month) open(insight.href, insight.branchId);
    } catch { /* Invalid provenance link is not navigable. */ }
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
        {critical.length > 0 && tile("urgent", "طارئ", "أولوية صريحة من المصدر", AlertTriangle, critical.length, "oc-tile-urgent")}
        {followup.length > 0 && tile("followup", "يحتاج متابعة", "سجلات تشغيل مفتوحة", Activity, followup.length)}
        {decision.length > 0 && tile("decision", "بانتظار قراري", "قرار مطلوب صراحةً", ShieldCheck, decision.length, "oc-tile-decision")}
        {today.length > 0 && tile("today", "مهام اليوم", "مواعيد مسجلة لهذا اليوم", ClipboardList, today.length)}
        {tile("monthly", "الإغلاقات الشهرية", "ملفات الشهر الأربعة", CalendarDays)}
      </div>
      {unavailable && <p role="status" className="mt-2 text-xs text-amber-900">بعض المصادر غير متاحة؛ الأعداد تخص السجلات المعروضة فقط وليست دليل اكتمال.</p>}
    </section>

    <section aria-labelledby="oc-domain-heading">
      <div className="mb-2"><p className="text-xs font-bold text-violet-700">02 / مجالات التشغيل</p><h2 id="oc-domain-heading" className="text-lg font-bold">افتح مجال العمل</h2></div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">{domains.filter(domainAvailable).map(item => tile(item.id, item.label, item.hint, item.icon))}</div>
    </section>

    <section aria-labelledby="oc-evidence-heading">
      <div className="mb-2 flex items-end justify-between"><div><p className="text-xs font-bold text-violet-700">03 / قراءة الأداء</p><h2 id="oc-evidence-heading" className="text-lg font-bold">أدلة من التشغيل</h2></div><button type="button" className="text-xs font-bold text-violet-700 hover:underline" onClick={() => enter("analysis")}>تفاصيل التحليل <ArrowUpLeft className="inline size-3.5" /></button></div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(230px,.7fr)]">
        <ChartPanel title="اتجاه المبيعات المسجلة" note="من السجلات المتاحة فقط · غياب اليوم ليس صفرًا" onClick={() => enter("analysis")}>
          {salesPoints.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={salesPoints} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}><CartesianGrid vertical={false} stroke="#eee8f3" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} width={46} tickFormatter={fmt} /><Tooltip formatter={value => [`${fmt(Number(value))} ر.س`, "مبيعات مسجلة"]} /><Area type="monotone" dataKey="value" stroke="#6941a5" fill="#e8ddf4" strokeWidth={2} connectNulls={false} /></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{analysis ? "لا توجد نقاط مبيعات مؤكدة قابلة للرسم" : "دليل المبيعات غير متاح"}</div>}
        </ChartPanel>
        <ChartPanel title="المتابعات حسب الفرع" note="سجلات متابعة ظاهرة · ليست إجمالي كل المهام" onClick={() => enter("analysis")}>
          {branchPoints.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={branchPoints} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}><CartesianGrid vertical={false} stroke="#eee8f3" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} /><Tooltip formatter={value => [fmt(Number(value)), "متابعات"]} /><Bar dataKey="value" fill="#7953ae" radius={[4, 4, 0, 0]} maxBarSize={38} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{analysis ? "لا توجد متابعات مرئية قابلة للرسم" : "دليل المتابعات غير متاح"}</div>}
        </ChartPanel>
      <div className="oc-panel flex flex-col gap-3 p-4 md:col-span-2 md:flex-row md:items-center lg:col-span-1 lg:items-start">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><Sparkles size={19} /></span>
        <div className="min-w-0 flex-1"><strong className="text-sm">القراءة التشغيلية</strong><p className="mt-0.5 text-sm text-muted-foreground">{analysis?.observations?.[0]?.explanation || (aiResult?.insights.length ? aiResult.insights[0].explanation : analysis ? `${analysis.sales.total === null ? "المبيعات المؤكدة غير متاحة" : `المبيعات المسجلة ${fmt(analysis.sales.total)} ر.س`} · ${analysis.followups.coverage === "unavailable" ? "المتابعات غير متاحة" : `${fmt(analysis.followups.byBranch.reduce((total, branch) => total + branch.count, 0))} متابعة في الفروع المعروضة`}. ${analysis.sales.coverage === "partial" ? "بيانات المبيعات جزئية." : ""}` : "الأدلة التشغيلية غير متاحة بعد. طلب تحليل المساعد يدوي فقط ولا يعمل تلقائيًا.")}</p></div>
        <Button variant="outline" size="sm" onClick={() => enter("analysis")}>عرض الأدلة</Button>
      </div>
      </div>
    </section>

    <Dialog open={!!view} onOpenChange={openState => { if (!openState) { setView(null); setSelected(null); setMobileDetail(false); } }}>
      <DialogContent dir="rtl" className="oc-board oc-workspace">
        <DialogHeader className="shrink-0 border-b border-[#e7def0] bg-[#fdfbff] px-5 py-4 text-right">
          <p className="text-[11px] font-bold text-violet-700">BUTTER BAKERY / مركز التشغيل</p>
          <DialogTitle className="text-right text-xl font-bold">{view === "urgent" ? "حالات طارئة" : view === "followup" ? "يحتاج متابعة" : view === "decision" ? "بانتظار قراري" : view === "today" ? "مهام اليوم" : view === "monthly" ? "الإغلاقات الشهرية" : view === "analysis" ? "الأداء والتحليل" : domain?.label || "مجال التشغيل"}</DialogTitle>
          <DialogDescription className="text-right text-xs">نطاق الفروع المختار · عرض السجل لا يغيّر حالته</DialogDescription>
        </DialogHeader>
        {view === "monthly" ? <OperationsMonthWorkspace key={`${actorId}:${scopeKey}`} branches={data.branches.filter(branch => ids.includes(branch.id))} actorId={actorId} open={open} /> : <div className="oc-workspace-grid" data-detail={mobileDetail}>
          <div className="oc-workspace-list space-y-2">
            {view === "analysis" ? <div className="space-y-3 text-sm">
              <strong>الأدلة ومصدر التحليل</strong>
              <p className="text-xs text-muted-foreground">المبيعات من السجلات المؤكدة فقط. المتابعات من السجلات المرئية ضمن هذا النطاق. البيانات الناقصة لا تُعرض كصفر.</p>
              <p>{analysis ? `مصدر المبيعات: ${analysis.sales.source} · مصدر المتابعات: ${analysis.followups.source}` : "لا توجد أدلة تحليل متاحة من الخادم لهذا النطاق."}</p>
              {analysis?.observations?.map((observation, index) => <div className="oc-panel p-3" key={index}>
                <strong>{observation.title}</strong><p className="text-xs text-muted-foreground">{observation.explanation}</p><small>المصدر: {observation.source}</small>
                {observation.href && observation.branchId && ids.includes(observation.branchId) &&
                  (queue.some(item => item.branchId === observation.branchId && (item.href === observation.href || item.decision?.href === observation.href)) || analysis.sales.hrefs.some(item => item.branchId === observation.branchId && item.href === observation.href)) &&
                  <Button variant="outline" size="sm" className="mt-2 block" onClick={() => open(observation.href!, observation.branchId!)}>فتح المصدر</Button>}
              </div>)}
              <Button variant="outline" size="sm" disabled={aiLoading} onClick={() => insights.mutate({ scope: scopeKey, branchIds: [...ids] })}>{aiLoading ? "جار التحليل…" : "طلب تحليل مساعد"}</Button>
              {aiError && <p role="alert" className="text-xs text-red-700">تعذر التحليل. لم يُشغّل الطلب مجددًا تلقائيًا.</p>}
              {aiResult?.insights.map((insight, index) => <div className="oc-panel space-y-2 p-3" key={`${insight.sourceType}:${insight.sourceId}:${index}`}>
                <strong className="text-sm">{insight.title}</strong><p className="text-xs text-muted-foreground">{insight.explanation}</p>
                {insight.evidence && <div className="rounded-lg bg-violet-50 p-3 text-xs"><strong>الدليل المسجل: {insight.evidence.label}</strong><p>{insight.evidence.value === null ? "القيمة غير متاحة" : `${fmt(insight.evidence.value)} ${insight.evidence.unit || ""}`} · الفترة: {insight.evidence.period}</p><p>المصدر: {insight.evidence.source}</p></div>}
                <Button variant="outline" size="sm" onClick={() => aiOpen(insight)}>مراجعة المصدر <ArrowUpLeft className="mr-1 size-4" /></Button>
              </div>)}
            </div> : view === "branches" ? data.branches.filter(item => ids.includes(item.id)).map(item => <button type="button" key={item.id} onClick={() => choose({ kind: "branch", id: item.id })} className="oc-list-item" data-active={selected?.kind === "branch" && selected.id === item.id}><strong>{item.name}</strong><span className="mt-1 block text-xs text-muted-foreground">{queue.filter(row => row.branchId === item.id).length} سجلات في الصفحة الحالية</span></button>) : <>
              {view === "people" && canOpenEmployees && <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50 p-3">
                <strong className="text-sm">إدارة الموظفين · اختر الفرع</strong>
                <p className="text-xs text-muted-foreground">رواتب · مباشرة · نقل. فتح المسار المختص لفرع واحد فقط.</p>
                {data.branches.filter(branch => ids.includes(branch.id)).map(branch => <button key={branch.id} type="button" className="oc-list-item" onClick={() => choose({ kind: "branch", id: branch.id })} data-active={selected?.kind === "branch" && selected.id === branch.id}>{branch.name} <ChevronLeft className="inline size-4 text-violet-700" /></button>)}
              </div>}
              <label className="relative block"><Search className="absolute right-3 top-3 size-4 text-violet-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث في السجلات" aria-label="بحث في السجلات" className="min-h-10 w-full rounded-lg border border-violet-200 bg-[#fdfbff] pr-10 pl-3 text-sm" /></label>
              {rows.map(item => <button key={item.id} type="button" onClick={() => choose({ kind: "record", id: item.id })} className="oc-list-item" data-active={selected?.kind === "record" && selected.id === item.id}><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{branchName(item.branchId)} · {operationsSourceLabel(item.sourceType)} · {item.status}</span></button>)}
              {sources.map(item => <button key={`${item.branchId}:${item.id}`} type="button" onClick={() => choose({ kind: "card", id: item.id, branchId: item.branchId })} className="oc-list-item" data-active={selected?.kind === "card" && selected.id === item.id && selected.branchId === item.branchId}><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{branchName(item.branchId)} · مصدر المجال</span></button>)}
              {!rows.length && !sources.length && !(view === "people" && canOpenEmployees) && <p className="rounded-xl border border-dashed border-violet-200 p-5 text-center text-sm text-muted-foreground">{search ? "لا نتائج تطابق البحث." : "لا سجلات ظاهرة في هذه الصفحة؛ الغياب لا يعني اكتمال العمل."}</p>}
              {view !== "decision" && view !== "today" && <div className="flex gap-2 pt-2"><Button variant="outline" size="sm" disabled={offset === 0} onClick={() => { setSelected(null); setMobileDetail(false); onOffset(Math.max(0, offset - data.scope.limit)); }}><ChevronRight className="size-4" />السابقة</Button><Button variant="outline" size="sm" disabled={data.coverage.nextOffset === null} onClick={() => { setSelected(null); setMobileDetail(false); onOffset(data.coverage.nextOffset!); }}>التالية<ChevronLeft className="size-4" /></Button></div>}
            </>}
          </div>
          <div className="oc-workspace-detail">
            <button type="button" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-violet-700 md:hidden" onClick={() => setMobileDetail(false)}><ChevronRight className="size-4" />العودة للقائمة</button>
            {record ? <RecordDetail item={record} branch={branchName(record.branchId)} open={open} /> :
              card ? <CardDetail card={card} branch={branchName(card.branchId)} open={open} retry={retry} /> :
              selected?.kind === "branch" ? <div className="space-y-4"><h3 className="text-xl font-bold">{branchName(selected.id)}</h3>
                <p className="text-sm text-muted-foreground">{view === "people" ? "مسار الموظفين والرواتب والمباشرة والنقل لهذا الفرع. الإجراءات تخضع لصلاحيات المصدر." : "عرض تفاصيل التشغيل اليومية لهذا الفرع في مسار المصدر المخصص."}</p>
                {view === "people" && canOpenEmployees ? <Button onClick={() => open("/hr-hub", selected.id)}>فتح إدارة الموظفين <ArrowUpLeft className="mr-2 size-4" /></Button> :
                  <Button onClick={() => openBranch(selected.id)}>فتح تشغيل الفرع <ArrowUpLeft className="mr-2 size-4" /></Button>}
              </div> :
              view === "analysis" ? <div className="space-y-4"><h3 className="text-lg font-bold">كيف نقرأ الأداء؟</h3><p className="text-sm text-muted-foreground">تظهر الرسوم على الصفحة الرئيسية. افتح سجلًا من قراءة المساعد لمراجعة الوقائع في المصدر؛ الاقتراح لا يغير السجل.</p><p className="text-sm">تغطية المبيعات: {analysis?.sales.coverage || "غير معروفة"} · تغطية المتابعات: {analysis?.followups.coverage || qualified}</p>{aiResult && <p className="text-xs text-muted-foreground">آخر طلب تحليل: {time(aiResult.generatedAt)}</p>}</div> :
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground"><CircleHelp className="size-9 text-violet-400" /><p className="max-w-sm text-sm">اختر سجلًا من القائمة لعرض السبب والمسؤول والموعد وتفاصيل المصدر هنا.</p></div>}
          </div>
        </div>}
      </DialogContent>
    </Dialog>
  </div>;
}

function RecordDetail({ item, branch, open }: { item: OperationsQueueItem; branch: string; open: (href: string, branchId: string, item?: OperationsQueueItem) => void }) {
  const history = item.history || [];
  return <div className="space-y-5"><div><p className="text-xs font-bold text-violet-700">{branch} / {operationsSourceLabel(item.sourceType)}</p><h3 className="mt-1 text-xl font-bold">{item.title}</h3><p className="mt-1 text-sm text-muted-foreground">{item.status}</p></div>
    <div className="oc-panel border-r-4 border-r-violet-500 p-4"><strong className="text-sm">لماذا يحتاج الانتباه؟</strong><p className="mt-1 text-sm leading-7">{reasonFor(item)}</p></div>
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
      ["الحالة / الخطوة", `${item.status} · ${item.step}`],
    ].map(([label, value]) => <div className="flex justify-between gap-4 p-3" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="text-left font-semibold">{value}</dd></div>)}</dl>
    <div><h4 className="text-sm font-bold">سجل الوقائع</h4>{history.length ? <div className="mt-2 space-y-2">{history.map((fact, index) => <p className="oc-panel p-3 text-sm" key={index}>{fact.label} {fact.at && <span className="block text-xs text-muted-foreground">{time(fact.at)}</span>}</p>)}</div> : <p className="mt-1 text-sm text-muted-foreground">لا يقدم هذا المصدر سجل وقائع تفصيليًا هنا؛ راجع السجل الأصلي قبل اتخاذ القرار.</p>}</div>
    <Button className="min-h-11 bg-[#6941a5] hover:bg-[#4a2c75]" onClick={() => open(item.decision?.awaitingActor ? item.decision.href : item.href, item.branchId, item)}>{item.decision?.awaitingActor ? `${item.decision.label} في المسار المختص` : "فتح السجل للمتابعة"} <ArrowUpLeft className="mr-2 size-4" /></Button>
  </div>;
}
function CardDetail({ card, branch, open, retry }: { card: OperationsCard; branch: string; open: (href: string, branchId: string) => void; retry: () => void }) {
  return <div className="space-y-4"><p className="text-xs font-bold text-violet-700">{branch} / مصدر المجال</p><h3 className="text-xl font-bold">{card.title}</h3>{card.state !== "ready" ? <div role="alert" className="oc-panel p-4 text-sm">المصدر غير متاح؛ الغياب ليس صفرًا. {card.error}<Button variant="outline" size="sm" className="mt-3 block" onClick={retry}>إعادة المحاولة</Button></div> : <div className="grid gap-2 sm:grid-cols-2">{card.metrics.map((metric, index) => <Metric key={`${metric.key}:${index}`} metric={metric} />)}</div>}<Button onClick={() => open(card.href, card.branchId)}>فتح مصدر الفرع <ArrowUpLeft className="mr-2 size-4" /></Button></div>;
}