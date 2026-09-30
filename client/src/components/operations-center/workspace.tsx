import { useState, type ReactNode } from "react";
import { ArrowUpLeft, ChevronDown, ChevronLeft, ClipboardList, Layers3, MapPin, Search, Store, CalendarDays } from "lucide-react";
import type { OperationsCenterResponse, OperationsQueueItem } from "@shared/operations-center";
import { Button } from "@/components/ui/button";
import { filterOperationsQueue } from "@/lib/operations-center-queue";
import { findSelectedRecord, findSelectedSource, groupOperationsSources, operationsSourceLabel, queueQualifier, type SourceSelection } from "@/lib/operations-center-presentation";
import { Metric, RecordSheet, coverageLabel, time } from "./record-sheet";
export { time } from "./record-sheet";

type View = "overview" | "inbox" | "sources" | "branches" | "digest";
const views = [
  { id: "overview", title: "المشهد", icon: Layers3 },
  { id: "inbox", title: "المتابعات", icon: ClipboardList },
  { id: "sources", title: "المصادر", icon: Store },
  { id: "branches", title: "الفروع", icon: MapPin },
  { id: "digest", title: "اليومي والأسبوعي", icon: CalendarDays },
] satisfies { id: View; title: string; icon: typeof Layers3 }[];
const number = (value: number) => value.toLocaleString("en-US");

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-9 text-center text-sm leading-7 text-muted-foreground">{children}</div>;
}
function QueueRow({ item, name, choose }: { item: OperationsQueueItem; name: string; choose: () => void }) {
  return <button type="button" onClick={choose} className="group flex min-h-[72px] w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-right last:border-b-0 hover:bg-accent/50 focus-visible:outline-2 focus-visible:outline-primary sm:px-5">
    <div className="min-w-0">
      <p className="text-xs font-semibold text-primary">{name} <span className="mx-1 text-muted-foreground">/</span> {operationsSourceLabel(item.sourceType)}</p>
      <p className="mt-0.5 line-clamp-2 text-sm font-bold leading-6 text-foreground">{item.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{item.status} · {item.step}{item.dueAt ? ` · ${time(item.dueAt)}` : ""}</p>
    </div><ChevronLeft className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:-translate-x-1" />
  </button>;
}
function Digest({ data, branchId, name }: { data: OperationsCenterResponse; branchId: string | null; name: (id: string) => string }) {
  const days = data.daily.filter(day => !branchId || branchId === day.branchId);
  return <div className="space-y-7">
    <section><div className="mb-3"><h2 className="text-lg font-black">دليل اليوم</h2><p className="mt-1 text-sm text-muted-foreground">حالة السجلات المتاحة؛ غياب السجل لا يعني إقفالًا أو نجاحًا.</p></div>
      {days.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{days.map((day, index) => <article key={`${day.branchId}-${day.date}-${index}`} className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2"><strong>{name(day.branchId)}</strong><span className="text-xs text-muted-foreground">{day.date}</span></div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs"><p><span className="block text-muted-foreground">الفتح</span><strong>{day.opening === "recorded" ? "مسجل" : "غير متاح"}</strong></p><p><span className="block text-muted-foreground">الإقفال</span><strong>{day.closing === "closed" ? "مغلق" : day.closing === "incomplete" ? "غير مكتمل" : day.closing === "not_recorded" ? "غير مسجل" : "غير متاح"}</strong></p><p><span className="block text-muted-foreground">اليوميات</span><strong>{day.journalCount ?? "غير متاح"}</strong></p></div>
        <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">مصادر الدليل</summary><p className="mt-1">{day.source.join("، ") || "غير متاح"}</p></details>
      </article>)}</div> : <Empty>لا توجد أدلة يومية متاحة ضمن هذا الاختيار.</Empty>}</section>
    <section><h2 className="mb-3 text-lg font-black">الأسابيع المسجلة <span className="text-xs font-normal text-muted-foreground">· كامل النطاق، وليس الفرع المحدد</span></h2>
      {data.weekly.length ? <div className="grid gap-3 md:grid-cols-2">{data.weekly.map(week => <article key={`${week.startDate}-${week.endDate}`} className="rounded-xl border border-border bg-card p-4 text-sm">
        <strong>{week.startDate} — {week.endDate}</strong><p className="mt-2">إقفالات مسجلة: {week.recordedClosings} · يوميات مسجلة: {week.recordedJournals ?? "غير متاح"}</p><p className="mt-2 text-xs text-muted-foreground">{coverageLabel(week.coverage)}</p>
      </article>)}</div> : <Empty>لا تتوفر مؤشرات أسبوعية فعلية لهذا النطاق.</Empty>}</section>
  </div>;
}

export function OperationsWorkspace({ data, actorId, offset, onOffset, open, openBranch, retry }: {
  data: OperationsCenterResponse; actorId?: string; offset: number; onOffset: (value: number) => void;
  open: (href: string, branchId: string, item?: OperationsQueueItem) => void;
  openBranch: (id: string) => void; retry: () => void;
}) {
  const [view, setView] = useState<View>("overview");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchSearch, setBranchSearch] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [queueSource, setQueueSource] = useState("all");
  const [queueFilter, setQueueFilter] = useState<"all" | "mine" | "waiting">("all");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<SourceSelection | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const activeBranch = branchId && data.scope.branchIds.includes(branchId) ? branchId : null;
  const branches = data.branches.filter(branch => data.scope.branchIds.includes(branch.id));
  const name = (id: string) => branches.find(branch => branch.id === id)?.name ?? "فرع غير متاح";
  const cards = data.cards.filter(card => data.scope.branchIds.includes(card.branchId));
  const queue = data.queue.filter(item => data.scope.branchIds.includes(item.branchId));
  const scopedCards = cards.filter(card => !activeBranch || card.branchId === activeBranch);
  const scopedQueue = queue.filter(item => !activeBranch || item.branchId === activeBranch);
  const loadedQueue = filterOperationsQueue(scopedQueue, actorId, queueFilter, queueSource);
  const visibleQueue = loadedQueue.filter(item => `${item.title} ${item.status} ${item.step} ${name(item.branchId)}`.toLocaleLowerCase().includes(queueSearch.toLocaleLowerCase().trim()));
  const groups = groupOperationsSources(scopedCards).filter(group => `${group.label} ${group.module} ${group.id}`.toLocaleLowerCase().includes(sourceSearch.toLocaleLowerCase().trim()));
  const unavailableSources = Object.entries(data.coverage.queue).filter(([, state]) => state === "unavailable").map(([id]) => id);
  const failedCards = scopedCards.filter(card => card.state !== "ready");
  const qualifier = queueQualifier(data.coverage.truncated, data.coverage.nextOffset, offset, unavailableSources.length > 0);
  // A scope or tab change invalidates any open detail. No implicit fallback to the first result.
  const record = view === "overview" ? findSelectedRecord(scopedQueue, selectedRecord) : view === "inbox" ? findSelectedRecord(visibleQueue, selectedRecord) : null;
  const card = view === "sources" ? findSelectedSource(scopedCards, selectedSource) : null;
  const switchView = (next: View) => { setSelectedRecord(null); setSelectedSource(null); setView(next); };
  const selectBranch = (id: string | null) => { setSelectedRecord(null); setSelectedSource(null); setExpandedGroup(null); setBranchSearch(""); setBranchId(id); };
  const closeDetail = () => { setSelectedRecord(null); setSelectedSource(null); };
  return <div className="space-y-5">
    <nav aria-label="أقسام مركز التشغيل" className="oc-tab-strip flex gap-1 overflow-x-auto border-b border-border">
      {views.map(entry => <button type="button" key={entry.id} aria-current={view === entry.id ? "page" : undefined} onClick={() => switchView(entry.id)} className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-bold sm:px-4 ${view === entry.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}><entry.icon className="h-4 w-4" />{entry.title}</button>)}
    </nav>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold text-primary">مساحة القرار / {views.find(entry => entry.id === view)?.title}</p><h2 className="mt-0.5 text-xl font-black text-foreground sm:text-2xl">{view === "overview" ? "ما يحدث عبر الفروع" : view === "inbox" ? "سجلات تحتاج متابعة" : view === "sources" ? "المصادر بحسب المجال" : view === "branches" ? "الفروع في النطاق" : "السجلات اليومية والأسبوعية"}</h2></div>
      <details className="relative z-20 min-w-[170px] rounded-lg border border-border bg-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-bold"><MapPin className="h-4 w-4 text-primary" /><span className="max-w-40 truncate">{activeBranch ? name(activeBranch) : "كل الفروع"}</span><ChevronDown className="mr-auto h-4 w-4 text-muted-foreground" /></summary>
        <div className="absolute left-0 top-full mt-2 w-[min(320px,85vw)] rounded-xl border border-border bg-popover p-2 shadow-lg">
          <label className="flex items-center gap-2 rounded-lg border border-input px-2"><Search className="h-4 w-4 text-muted-foreground" /><input aria-label="بحث عن فرع" value={branchSearch} onChange={event => setBranchSearch(event.target.value)} placeholder="ابحث عن فرع" className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <div className="oc-branch-results mt-2 max-h-60 overflow-y-auto">
            <button type="button" onClick={event => { selectBranch(null); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold hover:bg-accent">كل الفروع المسموح بها</button>
            {branches.filter(branch => branch.name.toLocaleLowerCase().includes(branchSearch.toLocaleLowerCase().trim())).map(branch => <button type="button" key={branch.id} onClick={event => { selectBranch(branch.id); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm hover:bg-accent">{branch.name}</button>)}
          </div>
        </div>
      </details>
    </div>
    {view === "overview" && <>
      <section className="grid overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="border-b border-border p-4 sm:p-5 md:border-b-0 md:border-l">
          <p className="text-sm font-bold text-muted-foreground">المتابعات في الصفحة الحالية</p>
          <div className="mt-1 flex items-end gap-4"><p className="text-4xl font-black leading-none text-primary">{number(scopedQueue.length)}</p><Button variant="outline" size="sm" className="min-h-10" onClick={() => switchView("inbox")}>عرض المتابعات <ChevronLeft className="mr-1 h-4 w-4" /></Button></div>
          <p className="mt-2 text-xs text-muted-foreground">{qualifier}</p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border p-4 sm:p-5">
          <div className="pl-3"><p className="text-2xl font-black text-foreground">{number(scopedQueue.filter(item => !!actorId && item.ownerId === actorId).length)}</p><p className="text-xs text-muted-foreground">مسندة لي في الصفحة</p></div>
          <div className="pr-3"><p className="text-2xl font-black text-foreground">{number(failedCards.length)}</p><p className="text-xs text-muted-foreground">مصادر فرعية غير جاهزة</p></div>
          <p className="col-span-2 mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">{failedCards.length ? "توجد مصادر لم تكتمل قراءتها؛ أعداد السجلات لا تمثل بياناتها." : "عدم ظهور مصدر غير متاح في القائمة لا يعني عدم وجود متابعات."}{unavailableSources.length > 0 && ` · ${number(unavailableSources.length)} مصادر طابور غير متاحة.`}</p>
        </div>
      </section>
      {/* The overview stays focused on decisions. The notification panel is composed by the page, outside this workspace. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5"><div><h3 className="font-black">المتابعات الحالية</h3><p className="text-xs text-muted-foreground">أول السجلات في ترتيب المصدر؛ بلا أولوية مستنتجة</p></div><ClipboardList className="h-5 w-5 text-primary" /></div>
          {scopedQueue.length ? scopedQueue.slice(0, 4).map(item => <QueueRow key={item.id} item={item} name={name(item.branchId)} choose={() => { setSelectedRecord(item.id); setSelectedSource(null); }} />) : <div className="p-4"><Empty>لا توجد سجلات معروضة هنا؛ راجع حدود التغطية قبل الاستنتاج.</Empty></div>}
          {scopedQueue.length > 4 && <button type="button" onClick={() => switchView("inbox")} className="min-h-11 w-full border-t border-border text-sm font-bold text-primary hover:bg-accent/50">عرض بقية الصفحة <ChevronLeft className="mr-1 inline h-4 w-4" /></button>}
        </section>
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5"><div><h3 className="font-black">قراءة الفروع</h3><p className="text-xs text-muted-foreground">سجلات ومصادر معروضة، لا تقييم صحة</p></div><Store className="h-5 w-5 text-primary" /></div>
          {branches.filter(branch => !activeBranch || branch.id === activeBranch).slice(0, 5).map(branch => <button key={branch.id} type="button" onClick={() => { selectBranch(branch.id); switchView("sources"); }} className="flex min-h-14 w-full flex-wrap items-center justify-between gap-x-3 border-b border-border px-4 py-2 text-right text-sm hover:bg-accent/50 sm:px-5"><strong>{branch.name}</strong><span className="text-xs text-muted-foreground">{data.coverage.truncated ? "متابعات جزئية" : `${number(queue.filter(item => item.branchId === branch.id).length)} معروضة`} · {number(cards.filter(card => card.branchId === branch.id && card.state === "ready").length)} مصادر جاهزة</span></button>)}
          {!activeBranch && branches.length > 5 && <button type="button" onClick={() => switchView("branches")} className="min-h-11 w-full text-sm font-bold text-primary hover:bg-accent/50">عرض جميع الفروع ({number(branches.length)}) <ChevronLeft className="mr-1 inline h-4 w-4" /></button>}
        </section>
      </div>
    </>}
    {view === "inbox" && <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div><h3 className="font-black">{number(visibleQueue.length)} سجلات معروضة</h3><p className="text-xs text-muted-foreground">{qualifier}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-muted p-1">{(["all", "mine", "waiting"] as const).map(filter => <button key={filter} type="button" onClick={() => { closeDetail(); setQueueFilter(filter); }} className={`min-h-9 rounded-md px-2 text-xs font-bold sm:px-3 ${queueFilter === filter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{filter === "all" ? "الكل" : filter === "mine" ? "المسند لي" : "غير المسند لي"}</button>)}</div>
          <label className="sr-only" htmlFor="oc-queue-source">مصدر السجل</label><select id="oc-queue-source" value={queueSource} onChange={event => { closeDetail(); setQueueSource(event.target.value); }} className="min-h-10 rounded-lg border border-input bg-background px-2 text-sm"><option value="all">كل المصادر</option>{[...new Set(queue.map(item => item.sourceType))].map(source => <option key={source} value={source}>{operationsSourceLabel(source)}</option>)}</select>
        </div>
      </div>
      <div className="border-b border-border p-4"><label className="flex items-center gap-2 rounded-lg border border-input px-3"><Search className="h-4 w-4 text-primary" /><input value={queueSearch} onChange={event => { closeDetail(); setQueueSearch(event.target.value); }} placeholder="ابحث بالفرع أو السجل أو الحالة" aria-label="بحث المتابعات" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label></div>
      {visibleQueue.length ? visibleQueue.map(item => <QueueRow key={item.id} item={item} name={name(item.branchId)} choose={() => { setSelectedSource(null); setSelectedRecord(item.id); }} />) : <div className="p-4"><Empty>لا توجد سجلات تطابق هذا الاختيار؛ لا يُعد غياب المصادر غير المتاحة صفرًا.</Empty></div>}
      {(offset > 0 || data.coverage.nextOffset !== null) && <div className="flex gap-2 border-t border-border p-4">{offset > 0 && <Button variant="outline" onClick={() => { closeDetail(); onOffset(Math.max(0, offset - data.scope.limit)); }}>السابق</Button>}{data.coverage.nextOffset !== null && <Button variant="outline" onClick={() => { closeDetail(); onOffset(data.coverage.nextOffset!); }}>المزيد من المتابعات</Button>}</div>}
    </section>}
    {view === "sources" && <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-black">المجالات التشغيلية</h3><p className="mt-1 text-sm text-muted-foreground">{number(groups.length)} مجالات · اختر مجالًا ثم مصدر فرع لعرض التفاصيل</p></div>
        <label className="flex w-full items-center gap-2 rounded-lg border border-input bg-card px-3 sm:w-72"><Search className="h-4 w-4 text-primary" /><input value={sourceSearch} onChange={event => { closeDetail(); setSourceSearch(event.target.value); }} placeholder="ابحث عن مجال أو مصدر" aria-label="بحث المصادر" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      </div>
      {groups.length ? <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">{groups.map(group => <article key={group.id} className="overflow-hidden rounded-xl border border-border bg-card">
        <button type="button" aria-expanded={expandedGroup === group.id} onClick={() => { closeDetail(); setExpandedGroup(expandedGroup === group.id ? null : group.id); }} className="flex min-h-[84px] w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-accent/50">
          <span className="min-w-0"><strong className="block text-sm font-black text-foreground">{group.label}</strong><span className="mt-1 block text-xs text-muted-foreground">{number(group.cards.length)} مصادر فرعية{group.cards.some(card => card.state !== "ready") ? ` · ${number(group.cards.filter(card => card.state !== "ready").length)} غير جاهزة` : ""}</span></span><ChevronDown className={`h-4 w-4 shrink-0 text-primary transition-transform ${expandedGroup === group.id ? "rotate-180" : ""}`} />
        </button>
        {expandedGroup === group.id && <div className="max-h-72 divide-y divide-border overflow-y-auto border-t border-border bg-muted/20">{group.cards.map(source => <button key={`${source.branchId}:${source.id}`} type="button" onClick={() => { setSelectedRecord(null); setSelectedSource({ branchId: source.branchId, cardId: source.id }); }} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-right hover:bg-accent/60">
          <span className="min-w-0"><strong className="block text-sm">{name(source.branchId)}</strong><span className={`text-xs ${source.state === "ready" ? "text-muted-foreground" : "font-semibold text-destructive"}`}>{source.state === "ready" ? `${number(source.metrics.length)} مؤشرات من المصدر` : source.state === "error" ? "تعذر جلب المصدر" : "المصدر غير متاح"}</span></span><ChevronLeft className="h-4 w-4 text-primary" />
        </button>)}</div>}
      </article>)}</div> : <Empty>لا توجد مجالات تطابق البحث أو النطاق المحدد.</Empty>}
    </section>}
    {view === "branches" && <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4"><h3 className="font-black">المقارنة بحسب الفرع</h3><p className="mt-1 text-sm text-muted-foreground">الأعداد هنا سجلات ومصادر معروضة فقط؛ ليست نسبة أداء أو تقييمًا للفرع.</p></div>
      <div className="divide-y divide-border">{branches.filter(branch => !activeBranch || activeBranch === branch.id).map(branch => <div key={branch.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"><div><strong className="text-sm">{branch.name}</strong><p className="mt-1 text-xs text-muted-foreground">{data.coverage.truncated ? "متابعات جزئية" : `${number(queue.filter(item => item.branchId === branch.id).length)} متابعة في الصفحة`} · {number(cards.filter(card => card.branchId === branch.id && card.state === "ready").length)} مصادر جاهزة · {number(cards.filter(card => card.branchId === branch.id && card.state !== "ready").length)} غير جاهزة</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { selectBranch(branch.id); switchView("sources"); }}>مصادر الفرع</Button><Button variant="ghost" size="sm" onClick={() => openBranch(branch.id)}>مساحة الفرع <ArrowUpLeft className="mr-1 h-4 w-4" /></Button></div></div>)}</div>
    </section>}
    {view === "digest" && <Digest data={data} branchId={activeBranch} name={name} />}
    <div className="border-t border-border pt-3">
      <button type="button" onClick={() => setMetricsOpen(!metricsOpen)} aria-expanded={metricsOpen} className="flex min-h-11 w-full items-center justify-between gap-3 text-right text-sm font-bold text-foreground"><span>مؤشرات النطاق وتعريفاتها</span><span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">{number(data.metrics.length)} مؤشر <ChevronDown className={`h-4 w-4 transition-transform ${metricsOpen ? "rotate-180" : ""}`} /></span></button>
      {metricsOpen && (data.metrics.length ? <div className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">{data.metrics.map((metric, index) => <Metric key={`${metric.key}-${metric.scope.join(",")}-${index}`} metric={metric} />)}</div> : <Empty>لا توجد مؤشرات متاحة في هذا النطاق.</Empty>)}
    </div>
    {unavailableSources.length > 0 && <details className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><summary className="cursor-pointer font-bold">حدود التغطية: {number(unavailableSources.length)} مصادر طابور غير متاحة</summary><p className="mt-2 leading-6">المصادر: {unavailableSources.join("، ")}. عدم ظهور متابعات منها لا يعني صفرًا.</p></details>}
    <RecordSheet record={record} card={card} branch={record ? name(record.branchId) : card ? name(card.branchId) : ""} onClose={closeDetail} open={open} retry={retry} />
  </div>;
}