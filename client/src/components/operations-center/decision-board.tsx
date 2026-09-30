import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, ArrowLeft, ArrowUpLeft, BellRing, CalendarDays, ChevronLeft, ChevronRight, Factory, FileSearch, MapPin, PackageCheck, Search, ShieldCheck, Sparkles, TrendingUp, Users, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { operationsDecisionQueue, type OperationsCenterResponse, type OperationsMonthResponse, type OperationsQueueItem } from "@shared/operations-center";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { RecordSheet, time } from "./record-sheet";
import { findSelectedRecord, findSelectedSource, operationsSourceLabel, queueQualifier, type SourceSelection } from "@/lib/operations-center-presentation";
import "./decision-board.css";

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
const domains = [
  { id: "people", title: "متابعة الحضور", hint: "حضور · إجازات · سلف", icon: Users, types: ["attendance_record", "leave", "advance"], modules: ["attendance", "hr_leaves", "hr_advances"] },
  { id: "kitchen", title: "المطبخ", hint: "الطلبات والإنتاج", icon: Factory, types: ["kitchen_order"], modules: ["central_kitchen_orders"] },
  { id: "supply", title: "المواد والتوصيل", hint: "تحويلات · مرتجعات · توصيل", icon: PackageCheck, types: ["transfer", "reverse_movement", "delivery_assignment"], modules: ["warehouse", "delivery_tasks"] },
  { id: "quality", title: "الجودة والصيانة", hint: "فحوص · بلاغات", icon: Wrench, types: ["quality_check", "maintenance"], modules: ["quality_control", "maintenance"] },
  { id: "sales", title: "المبيعات والإقفال", hint: "يوميات · إغلاقات", icon: TrendingUp, types: ["cashier_journal", "daily_closure"], modules: ["cashier_journal", "daily_closures", "sales_analytics"] },
] as const;
type DomainId = typeof domains[number]["id"];
type View = DomainId | "branches" | "monthly" | "analysis" | "evidence" | null;
type Focus = "critical" | "overdue" | "assigned" | "followup" | "today" | "all";
type Insight = { title: string; explanation: string; sourceType: string; sourceId: string; branchId: string; href: string };
type InsightResponse = { kind: "ai"; generatedAt: string; insights: Insight[]; coverage: OperationsCenterResponse["coverage"] };

function QueueRow({ item, branch, onOpen }: { item: OperationsQueueItem; branch: string; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="oc-row flex w-full items-center gap-3 rounded-xl border border-[#e9e2ef] bg-[#fdfcff] px-3 py-2.5 text-right focus-visible:outline-2 focus-visible:outline-violet-600">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f2ebf9] text-violet-700"><FileSearch className="size-4" /></span>
    <span className="min-w-0 flex-1"><strong className="block truncate text-[13px] font-bold text-[#29213b]">{item.title}</strong><small className="block truncate text-[11px] text-muted-foreground">{branch} · {operationsSourceLabel(item.sourceType)} · {item.status}</small></span>
    <ChevronLeft className="size-4 shrink-0 text-violet-600" />
  </button>;
}

export function OperationsDecisionBoard({ data, actorId, offset, onOffset, open, openBranch, retry }: {
  data: OperationsCenterResponse; actorId?: string; offset: number; onOffset: (value: number) => void;
  open: (href: string, branchId: string, item?: OperationsQueueItem) => void;
  openBranch: (id: string) => void; retry: () => void;
}) {
  const [view, setView] = useState<View>(null);
  const { canView } = usePermissions();
  const [focus, setFocus] = useState<Focus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [source, setSource] = useState<SourceSelection | null>(null);
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit" }).format(new Date()));
  const [search, setSearch] = useState("");
  const ids = data.scope.branchIds;
  const scopedIds = ids;
  const current = "";
  const scopeKey = [...scopedIds].sort().join(",");
  const branchName = (id: string) => data.branches.find(b => b.id === id)?.name ?? id;
  const { unique: queue, critical, urgent: overdue, assigned, followup } = useMemo(
    () => operationsDecisionQueue(data.queue.filter(item => ids.includes(item.branchId)), actorId, data.generatedAt),
    [data, actorId]);
  const today = queue.filter(item => item.dueAt && Number.isFinite(Date.parse(item.dueAt)) && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(item.dueAt)) === data.businessDate && !critical.includes(item) && !overdue.includes(item));
  const cohorts: Record<Focus, OperationsQueueItem[]> = { critical, overdue, assigned, followup, today, all: queue };
  const visible = cohorts[focus];
  const selectedDomain = domains.find(d => d.id === view);
  const domainItems = selectedDomain ? queue.filter(item => (selectedDomain.types as readonly string[]).includes(item.sourceType)) : [];
  const domainCards = selectedDomain ? data.cards.filter(card => scopedIds.includes(card.branchId) && (selectedDomain.modules as readonly string[]).includes(card.module)) : [];
  const filteredDomainItems = domainItems.filter(item => `${item.title} ${item.status} ${branchName(item.branchId)}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const filteredCards = domainCards.filter(card => `${card.title} ${branchName(card.branchId)}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const selectedRecord = findSelectedRecord(queue, selectedId);
  const selectedCard = findSelectedSource(data.cards.filter(card => scopedIds.includes(card.branchId)), source);
  const unavailable = Object.entries(data.coverage.queue).filter(([, state]) => state === "unavailable").map(([name]) => name);
  const qualified = queueQualifier(data.coverage.truncated, data.coverage.nextOffset, offset, unavailable.length > 0);

  const monthly = useQuery<OperationsMonthResponse>({
    queryKey: ["/api/operations-center/monthly", month, scopeKey, actorId],
    enabled: view === "monthly" && !!scopeKey && /^\d{4}-(0[1-9]|1[0-2])$/.test(month),
    retry: false, staleTime: 60_000, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/operations-center/monthly?${new URLSearchParams({ month, branchIds: scopeKey })}`, { credentials: "include", signal, cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
  });
  const monthData = monthly.data?.month === month && monthly.data.branchIds.length === scopedIds.length && monthly.data.branchIds.every(id => scopedIds.includes(id)) ? monthly.data : null;
  // A mutation cannot silently re-run on a live refresh, window focus, or branch filter change.
  const insights = useMutation({
    mutationFn: async (request: { scope: string; branchIds: string[] }) => {
      const response = await apiRequest("POST", "/api/operations-center/insights", { branchIds: request.branchIds });
      return { scope: request.scope, result: await response.json() as InsightResponse };
    },
  });
  const aiResult = insights.data?.scope === scopeKey ? insights.data.result : null;
  const aiError = insights.variables?.scope === scopeKey && insights.isError;
  const aiLoading = insights.variables?.scope === scopeKey && insights.isPending;

  const chart = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const day of data.daily.filter(day => scopedIds.includes(day.branchId) && (day.closing === "closed" || day.closing === "incomplete"))) {
      byDate.set(day.date, (byDate.get(day.date) ?? 0) + (day.closing === "closed" ? 1 : 0));
    }
    return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date: date.slice(5), count }));
  }, [data.daily, scopeKey]);
  const hasClosureGaps = data.daily.some(day => scopedIds.includes(day.branchId) && day.closing === "unavailable");
  const domainAvailable = (domain: typeof domains[number]) =>
    queue.some(item => (domain.types as readonly string[]).includes(item.sourceType)) ||
    data.cards.some(card => scopedIds.includes(card.branchId) && (domain.modules as readonly string[]).includes(card.module)) ||
    data.modules.some(module => (domain.modules as readonly string[]).includes(module));
  const openRecord = (item: OperationsQueueItem) => { setView(null); setSelectedId(item.id); };
  const openSource = (cardId: string, branchId: string) => { setView(null); setSource({ cardId, branchId }); };
  const showFocus = (value: Focus) => { setFocus(value); setView("evidence"); };
  const aiOpen = (insight: Insight) => {
    if (!scopedIds.includes(insight.branchId)) return;
    const item = queue.find(row => row.sourceType === insight.sourceType && row.sourceId === insight.sourceId && row.branchId === insight.branchId);
    if (item) openRecord(item);
    else {
      // Do not trust model-generated hrefs. Only persisted, currently-authorized records can navigate.
      const card = data.cards.find(row => row.branchId === insight.branchId && row.href === insight.href);
      if (card) open(card.href, card.branchId);
    }
  };

  return <div className="oc-board space-y-3 pb-5" data-testid="operations-decision-board">
    <section className="oc-panel p-3 sm:p-4" aria-label="الاهتمام الآن">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-base font-black">يحتاج انتباهك الآن</h2><p className="text-xs text-muted-foreground">سجلات للمتابعة والقراءة، لا اعتماد تلقائي · {qualified}</p></div>
        <button type="button" onClick={() => showFocus("all")} className="text-xs font-bold text-primary hover:underline">كل السجلات <ArrowLeft className="inline size-3.5" /></button>
      </div>
      {unavailable.length > 0 && <p role="status" className="mt-2 text-xs text-amber-900">تعذر تحميل {fmt(unavailable.length)} مصادر؛ القائمة جزئية وليست صفرًا.</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">{([
         ["critical", "أولوية عاجلة مسجلة", BellRing], ["overdue", "مواعيد منقضية", CalendarDays], ["assigned", "مسند إليّ", ShieldCheck],
        ["followup", "يحتاج متابعة", Activity], ["today", "يستحق اليوم", CalendarDays],
      ] as const).filter(([id]) => cohorts[id].length > 0).map(([id, label, Icon]) =>
        <button key={id} type="button" onClick={() => showFocus(id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold hover:bg-accent"><Icon className="size-3.5 text-primary" />{label} · {fmt(cohorts[id].length)}</button>)}</div>
      {queue.length ? <div className="mt-3 grid gap-2 md:grid-cols-3">{[...critical, ...overdue, ...assigned, ...followup].slice(0, 3).map(item =>
        <QueueRow key={item.id} item={item} branch={branchName(item.branchId)} onOpen={() => openRecord(item)} />)}</div>
        : <p className="mt-3 text-xs text-muted-foreground">لا سجلات ظاهرة في الصفحة الحالية؛ غياب السجل لا يعني اكتمال العمل.</p>}
    </section>
    <section aria-label="مجالات العمل اليومية">
      <h2 className="mb-2 text-sm font-black">مسارات العمل</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">{domains.filter(domainAvailable).map(domain =>
        <button key={domain.id} type="button" onClick={() => { setSearch(""); setView(domain.id); }} className="oc-domain flex min-h-[82px] items-center gap-2 rounded-xl border border-border bg-card p-3 text-right focus-visible:outline-2 focus-visible:outline-primary">
          <domain.icon className="size-5 shrink-0 text-primary" /><span className="min-w-0"><strong className="block text-xs">{domain.title}</strong><small className="block truncate text-[10px] text-muted-foreground">{domain.hint}</small></span>
        </button>)}
        {canView("operations_hr") && scopedIds.length > 0 && <button type="button" onClick={() => open("/hr-hub", scopedIds[0])} className="oc-domain flex min-h-[82px] items-center gap-2 rounded-xl border border-border bg-card p-3 text-right"><Users className="size-5 text-primary" /><span><strong className="block text-xs">إدارة الموظفين</strong><small className="text-[10px] text-muted-foreground">رواتب · مباشرة · نقل</small></span></button>}
        {([
          ["branches", "الفروع", MapPin], ["monthly", "إغلاقات الشهر", CalendarDays],
          ["analysis", "التحليل والمساعد", Sparkles],
        ] as const).map(([id, title, Icon]) => <button key={id} type="button" onClick={() => setView(id)} className="oc-domain flex min-h-[82px] items-center gap-2 rounded-xl border border-border bg-card p-3 text-right"><Icon className="size-5 shrink-0 text-primary" /><strong className="text-xs">{title}</strong></button>)}
      </div>
    </section>

    <Sheet open={!!view} onOpenChange={value => { if (!value) { setView(null); setSearch(""); } }}>
      <SheetContent side="left" dir="rtl" className="!w-full !max-w-[620px] overflow-y-auto border-violet-100 bg-[#fbf9fe] p-0 text-[#29213b]">
        <div className="sticky top-0 z-10 border-b border-violet-100 bg-[#fbf9fe]/95 px-5 pb-4 pt-8 backdrop-blur-sm sm:px-6">
          <SheetTitle className="mt-1 text-right text-xl font-black">{selectedDomain?.title ?? (view === "monthly" ? "إغلاقات الشهر" : view === "branches" ? "الفروع" : view === "analysis" ? "التحليل والمساعد" : "سجلات المتابعة")}</SheetTitle>
          <SheetDescription className="mt-1 text-right text-xs">ضمن الفروع المصرح بها فقط · القراءة لا تنفذ إجراءً على المصدر.</SheetDescription>
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {view === "analysis" && <>
            <div className="rounded-xl border border-border bg-card p-3"><h3 className="text-sm font-bold">الإغلاقات المسجلة · آخر 7 أيام</h3><p className="text-xs text-muted-foreground">سجلات مؤكدة فقط؛ غياب السجل ليس صفرًا.</p>
              {chart.length ? <div className="mt-3 h-44" dir="ltr"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" name="إغلاق مسجل" fill="#794ab5" /></BarChart></ResponsiveContainer></div> : <p className="mt-3 text-xs">لا توجد أدلة إغلاق متاحة للرسم.</p>}
              {hasClosureGaps && <p className="mt-2 text-xs text-amber-800">بعض بيانات الإغلاق غير متاحة؛ الرسم جزئي.</p>}
            </div>
            <div className="rounded-xl border border-border bg-card p-3"><h3 className="text-sm font-bold">مساعد القرار</h3><p className="mt-1 text-xs text-muted-foreground">اقتراحات من سجلات النطاق الحالي، لا تُنفّذ إجراءات أو اعتمادات.</p>
              <Button variant="outline" size="sm" className="mt-3" disabled={aiLoading} onClick={() => insights.mutate({ scope: scopeKey, branchIds: [...scopedIds] })}>{aiLoading ? "جار التحليل…" : "تحليل هذا النطاق"}</Button>
              {aiError && <p role="alert" className="mt-2 text-xs text-destructive">{insights.error instanceof Error ? insights.error.message : "تعذر التحليل."}</p>}
              {aiResult && <div className="mt-3 space-y-2">{aiResult.insights.length ? aiResult.insights.map((insight, index) => <button key={`${insight.sourceType}:${insight.sourceId}:${index}`} type="button" onClick={() => aiOpen(insight)} className="block w-full rounded-lg border border-border p-2 text-right text-xs hover:bg-accent"><strong>{insight.title}</strong><span className="block text-muted-foreground">{insight.explanation}</span></button>) : <p className="text-xs text-muted-foreground">لا توجد اقتراحات مدعومة بالسجلات الحالية.</p>}</div>}
            </div>
          </>}
          {view === "branches" && <div className="space-y-2">{data.branches.filter(item => scopedIds.includes(item.id)).map(item => <button key={item.id} type="button" onClick={() => openBranch(item.id)} className="oc-row flex w-full items-center justify-between rounded-xl border border-violet-100 bg-card p-3 text-right text-sm font-bold"><span className="flex items-center gap-2"><MapPin className="size-4 text-violet-600" />{item.name}</span><ArrowUpLeft className="size-4 text-violet-600" /></button>)}</div>}
          {view === "monthly" && <>
            <label className="block text-xs font-bold">الشهر <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="mt-1 block min-h-10 rounded-lg border border-violet-200 bg-card px-2 text-sm" /></label>
            <p className="text-xs text-muted-foreground">الأرقام المجمعة للفروع المختارة؛ تفاصيل كل فرع وروابطه الأصلية تظهر داخل كل قسم عند توفرها.</p>
            {monthly.isPending && <div role="status" className="space-y-2"><div className="h-24 animate-pulse rounded-xl bg-violet-100" /><div className="h-24 animate-pulse rounded-xl bg-violet-100" /><span className="sr-only">جار تحميل بيانات الشهر</span></div>}
            {monthly.isError && <div role="alert" className="rounded-xl border border-rose-200 p-4 text-sm text-rose-700">تعذر تحميل بيانات الشهر. الغياب ليس صفرًا. <Button variant="outline" size="sm" className="mt-2 block" onClick={() => monthly.refetch()}>إعادة المحاولة</Button></div>}
            {monthData?.sections.find(section => section.id === "sales" && section.branches?.some(entry => entry.value !== null))?.branches && (() => {
              const rows = monthData.sections.find(section => section.id === "sales")!.branches!.filter(entry => entry.value !== null);
              return <div className="rounded-2xl border border-violet-100 bg-card p-4">
                <h3 className="text-sm font-black">المبيعات المسجلة حسب الفرع</h3><p className="mt-1 text-[11px] text-muted-foreground">من الإغلاقات المؤكدة للشهر فقط · الفروع دون سجل غير مدرجة</p>
                <div className="mt-3 max-h-[300px] overflow-y-auto" dir="ltr"><div style={{ height: Math.max(130, rows.length * 34) }}><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={rows.map(entry => ({ branch: branchName(entry.branchId), value: entry.value }))} margin={{ top: 2, left: 4, right: 14, bottom: 2 }} barSize={14}>
                  <CartesianGrid stroke="#eee7f4" horizontal={false} /><XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={fmt} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="branch" width={95} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={value => [`${fmt(Number(value))} ر.س`, "مبيعات مسجلة"]} contentStyle={{ borderRadius: 12, borderColor: "#e7def0", fontSize: 12, direction: "rtl" }} /><Bar dataKey="value" fill="#794ab5" radius={[0, 5, 5, 0]} />
                </BarChart></ResponsiveContainer></div></div>
              </div>;
            })()}
            {monthData?.sections.map(section => <article key={section.id} className="rounded-2xl border border-violet-100 bg-card p-4">
              <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-black">{section.label}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${section.coverage === "complete" ? "bg-violet-100 text-violet-800" : "bg-amber-50 text-amber-800"}`}>{section.coverage === "complete" ? "تغطية مكتملة" : section.coverage === "partial" ? "تغطية جزئية" : "المصدر غير متاح"}</span></div>
              <strong className="mt-2 block text-xl font-black tabular-nums">{section.value === null ? "غير متاح" : `${fmt(section.value)}${["payroll", "expenses", "sales"].includes(section.id) ? " ر.س" : ""}`}</strong>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{section.summary}</p><p className="mt-2 text-[11px] text-muted-foreground">المصدر: {section.source} · <span dir="ltr">{month}</span></p>
              {section.branches && <details className="mt-3 rounded-lg border border-violet-100 p-2.5"><summary className="cursor-pointer text-xs font-bold text-violet-800">تفصيل الفروع · {fmt(section.branches.length)}</summary><div className="mt-2 space-y-2">{section.branches.filter(entry => scopedIds.includes(entry.branchId)).map(entry => <div key={entry.branchId} className="rounded-lg bg-[#f8f5fc] p-2.5 text-xs"><div className="flex justify-between gap-2"><strong>{branchName(entry.branchId)}</strong><strong>{entry.value === null ? "غير متاح" : fmt(entry.value)}</strong></div><p className="mt-1 leading-relaxed text-muted-foreground">{entry.summary}</p>{entry.href && <button type="button" onClick={() => open(entry.href!, entry.branchId)} className="mt-2 inline-flex items-center gap-1 font-bold text-violet-700 hover:underline">فتح مصدر الفرع <ArrowUpLeft className="size-3" /></button>}</div>)}</div></details>}
              {section.href && scopedIds.length === 1 && <Button variant="outline" size="sm" className="mt-3 border-violet-200 text-violet-800" onClick={() => open(section.href!, scopedIds[0])}>فتح مصدر الفرع <ArrowUpLeft className="mr-1 size-3.5" /></Button>}
            </article>)}
            {monthData && !monthData.sections.length && <p className="rounded-xl border border-dashed border-violet-200 p-5 text-center text-xs text-muted-foreground">لا توجد مصادر شهرية مصرح بها لهذا النطاق. لا يعني ذلك إغلاق الشهر.</p>}
          </>}
          {view === "evidence" && <>
            <div className="flex flex-wrap gap-1.5">{([
               ["all", "كل السجلات"], ["critical", "أولوية عاجلة مسجلة"], ["overdue", "مواعيد منقضية"], ["assigned", "مسند إليّ"], ["followup", "متابعة"], ["today", "اليوم"],
             ] as const).filter(([key]) => key === "all" || cohorts[key].length > 0).map(([key, label]) => <button key={key} type="button" onClick={() => setFocus(key)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${focus === key ? "bg-violet-700 text-white" : "border border-violet-200 bg-card text-violet-800"}`}>{label} · {fmt(cohorts[key].length)}</button>)}</div>
            <p className="text-xs text-muted-foreground">سجلات {qualified}. المواعيد المنقضية ليست بالضرورة حالات طوارئ.</p>
            <div className="space-y-2">{visible.map(item => <QueueRow key={item.id} item={item} branch={branchName(item.branchId)} onOpen={() => openRecord(item)} />)}</div>
            {!visible.length && <div className="rounded-xl border border-dashed border-violet-200 p-5 text-center text-xs text-muted-foreground">لا سجلات في هذه المجموعة ضمن الصفحة الحالية.</div>}
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - data.scope.limit))}><ChevronRight className="size-4" />السابقة</Button><Button variant="outline" size="sm" disabled={data.coverage.nextOffset === null} onClick={() => onOffset(data.coverage.nextOffset!)}>التالية<ChevronLeft className="size-4" /></Button></div>
          </>}
          {selectedDomain && <>
            <label className="relative block"><Search className="absolute right-3 top-3 size-4 text-violet-500" /><input aria-label="بحث سجلات المجال" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث في السجلات والمصادر" className="min-h-10 w-full rounded-xl border border-violet-200 bg-card pr-10 pl-3 text-sm outline-none focus:border-violet-500" /></label>
            {!!filteredDomainItems.length && <div className="space-y-2"><h3 className="text-xs font-black text-violet-800">سجلات المتابعة · {fmt(filteredDomainItems.length)}</h3>{filteredDomainItems.map(item => <QueueRow key={item.id} item={item} branch={branchName(item.branchId)} onOpen={() => openRecord(item)} />)}</div>}
            {!!filteredCards.length && <details className="rounded-xl border border-border bg-card p-3"><summary className="cursor-pointer text-xs font-bold text-primary">مصادر المجال · {fmt(filteredCards.length)}</summary><div className="mt-3 space-y-2">{filteredCards.map(card => <button key={`${card.branchId}:${card.id}`} type="button" onClick={() => openSource(card.id, card.branchId)} className="oc-row flex w-full items-center gap-3 rounded-xl border border-violet-100 p-3 text-right text-xs"><span className="min-w-0 flex-1"><strong className="block truncate">{card.title}</strong><span className="text-muted-foreground">{branchName(card.branchId)} · {card.state === "ready" ? "مؤشرات متاحة" : "المصدر غير متاح"}</span></span><ChevronLeft className="size-4 text-violet-600" /></button>)}</div></details>}
            {!filteredDomainItems.length && !filteredCards.length && <p className="rounded-xl border border-dashed border-violet-200 p-5 text-center text-xs text-muted-foreground">{search ? "لا نتائج تطابق البحث." : "لا سجلات ظاهرة في هذه الصفحة؛ قد تكون هناك سجلات لم تُحمّل بعد."}</p>}
          </>}
        </div>
      </SheetContent>
    </Sheet>
    <RecordSheet record={selectedRecord} card={selectedCard} branch={selectedRecord ? branchName(selectedRecord.branchId) : selectedCard ? branchName(selectedCard.branchId) : ""} onClose={() => { setSelectedId(null); setSource(null); }} open={open} retry={retry} />
  </div>;
}