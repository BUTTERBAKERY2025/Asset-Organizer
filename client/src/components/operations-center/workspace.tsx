import { useState, type ReactNode } from "react";
import { ArrowUpLeft, ChevronLeft, ClipboardList, Layers3, MapPin, Search, Store } from "lucide-react";
import type { OperationsCard, OperationsCenterResponse, OperationsQueueItem } from "@shared/operations-center";
import { Button } from "@/components/ui/button";
import { filterOperationsQueue } from "@/lib/operations-center-queue";
import { findSelectedRecord, findSelectedSource, groupOperationsSources, operationsSourceLabel, queueQualifier, type SourceSelection } from "@/lib/operations-center-presentation";
import { Metric, RecordSheet, coverageLabel, time } from "./record-sheet";
export { time } from "./record-sheet";

type View = "overview" | "inbox" | "sources" | "branches" | "digest";
const views: { id: View; title: string }[] = [
  { id: "overview", title: "المشهد" }, { id: "inbox", title: "المتابعات" },
  { id: "sources", title: "المصادر" }, { id: "branches", title: "الفروع" },
  { id: "digest", title: "اليومي والأسبوعي" },
];
function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[#dcd0cd] bg-[#fbf8f5] px-5 py-10 text-center text-sm leading-7 text-[#776a70]">{children}</div>;
}
function QueueRow({ item, name, choose }: { item: OperationsQueueItem; name: string; choose: () => void }) {
  return <button type="button" onClick={choose} className="group flex min-h-[76px] w-full items-center justify-between gap-4 border-b border-[#ebe1de] px-4 py-3 text-right transition-colors last:border-b-0 hover:bg-[#f8f2ee] sm:px-5">
    <div className="min-w-0"><p className="text-xs font-semibold text-[#9a5948]">{name} <span className="mx-1 text-[#c9bcb7]">/</span> {operationsSourceLabel(item.sourceType)}</p>
      <p className="mt-1 line-clamp-2 text-sm font-bold leading-6 text-[#3e3039]">{item.title}</p>
      <p className="mt-1 text-xs text-[#766a6f]">{item.status} · {item.step}{item.dueAt ? ` · ${time(item.dueAt)}` : ""}</p>
    </div><ChevronLeft className="h-5 w-5 shrink-0 text-[#aa8280] transition-transform group-hover:-translate-x-1" /></button>;
}
function Digest({ data, branchId, name }: { data: OperationsCenterResponse; branchId: string | null; name: (id: string) => string }) {
  const days = data.daily.filter(day => !branchId || branchId === day.branchId);
  return <div className="space-y-8">
    <section><div className="mb-4"><h2 className="text-xl font-extrabold">دليل اليوم</h2><p className="mt-1 text-sm text-[#786a70]">حالة السجلات المتاحة، دون تفسير الغياب بأنه إقفال أو نجاح.</p></div>
      {days.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{days.map((day, index) => <article key={`${day.branchId}-${day.date}-${index}`} className="rounded-xl border border-[#e8ddda] bg-[#fffdfa] p-4">
        <div className="flex items-center justify-between gap-2"><strong>{name(day.branchId)}</strong><span className="text-xs text-[#786a70]">{day.date}</span></div>
        <p className="mt-3 text-sm">الفتح: {day.opening === "recorded" ? "مسجل" : "غير متاح"}</p>
        <p className="mt-1 text-sm">الإقفال: {day.closing === "closed" ? "مغلق" : day.closing === "incomplete" ? "غير مكتمل" : day.closing === "not_recorded" ? "غير مسجل" : "غير متاح"}</p>
        <p className="mt-1 text-sm">اليوميات: {day.journalCount ?? "غير متاح"}</p>
        <details className="mt-3 text-xs text-[#786a70]"><summary className="cursor-pointer">مصادر الدليل</summary><p className="mt-1">{day.source.join("، ") || "غير متاح"}</p></details>
      </article>)}</div> : <Empty>لا توجد أدلة يومية متاحة ضمن هذا الاختيار.</Empty>}</section>
    <section><h2 className="mb-4 text-xl font-extrabold">الأسابيع المسجلة <span className="text-sm font-normal text-[#786a70]">· كامل النطاق، وليس الفرع المحدد</span></h2>
      {data.weekly.length ? <div className="grid gap-3 md:grid-cols-2">{data.weekly.map(week => <article key={`${week.startDate}-${week.endDate}`} className="rounded-xl border border-[#e8ddda] bg-[#fffdfa] p-4 text-sm">
        <strong>{week.startDate} — {week.endDate}</strong><p className="mt-2">إقفالات مسجلة: {week.recordedClosings} · يوميات مسجلة: {week.recordedJournals ?? "غير متاح"}</p><p className="mt-2 text-xs text-[#955738]">{coverageLabel(week.coverage)}</p>
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
  const sourceRows = (group: (typeof groups)[number]) => <div className="divide-y divide-[#ece2df] border-t border-[#ece2df] bg-[#faf7f4]">
    {group.cards.map(source => <button key={`${source.branchId}:${source.id}`} type="button" onClick={() => { setSelectedRecord(null); setSelectedSource({ branchId: source.branchId, cardId: source.id }); }} className="flex min-h-14 w-full items-center justify-between gap-3 px-5 py-3 text-right hover:bg-[#f1e8e4]">
      <span><strong className="block text-sm text-[#44323e]">{name(source.branchId)}</strong><span className={`text-xs ${source.state === "ready" ? "text-[#766970]" : "font-semibold text-[#a4543e]"}`}>{source.state === "ready" ? `${source.metrics.length} مؤشرات من المصدر` : source.state === "error" ? "تعذر جلب المصدر" : "المصدر غير متاح"}</span></span><ChevronLeft className="h-4 w-4 text-[#aa8280]" />
    </button>)}</div>;
  return <div className="space-y-5 text-[#342832]">
    <nav aria-label="أقسام مركز التشغيل" className="oc-tab-strip flex gap-2 overflow-x-auto border-b border-[#dfd3d0]">
      {views.map(entry => <button type="button" key={entry.id} aria-current={view === entry.id ? "page" : undefined} onClick={() => switchView(entry.id)} className={`min-h-12 shrink-0 border-b-[3px] px-4 text-sm font-bold ${view === entry.id ? "border-[#a45743] text-[#3d2d39]" : "border-transparent text-[#786b72] hover:text-[#3d2d39]"}`}>{entry.title}</button>)}
    </nav>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold text-[#9d5947]">مساحة القرار / {views.find(entry => entry.id === view)?.title}</p><h2 className="mt-1 text-xl font-extrabold sm:text-2xl">{view === "overview" ? "ما يحدث عبر الفروع" : view === "inbox" ? "سجلات تحتاج متابعة" : view === "sources" ? "المصادر بحسب المجال" : view === "branches" ? "الفروع في النطاق" : "السجلات اليومية والأسبوعية"}</h2></div>
      <details className="relative z-20 min-w-[190px] rounded-xl border border-[#dfd3d0] bg-[#fffdfa]">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold"><MapPin className="h-4 w-4 text-[#a45743]" /><span className="max-w-40 truncate">{activeBranch ? name(activeBranch) : "كل الفروع"}</span></summary>
        <div className="absolute left-0 top-full mt-2 w-[min(320px,85vw)] rounded-xl border border-[#dfd3d0] bg-[#fffdfa] p-2 shadow-xl">
          <label className="flex items-center gap-2 rounded-lg border border-[#e5d9d5] px-2"><Search className="h-4 w-4 text-[#786b72]" /><input aria-label="بحث عن فرع" value={branchSearch} onChange={event => setBranchSearch(event.target.value)} placeholder="ابحث عن فرع" className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          <div className="oc-branch-results mt-2 max-h-60 overflow-y-auto">
            <button type="button" onClick={event => { selectBranch(null); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm font-bold hover:bg-[#f5ede9]">كل الفروع المسموح بها</button>
            {branches.filter(branch => branch.name.toLocaleLowerCase().includes(branchSearch.toLocaleLowerCase().trim())).map(branch => <button type="button" key={branch.id} onClick={event => { selectBranch(branch.id); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="min-h-10 w-full rounded-lg px-3 text-right text-sm hover:bg-[#f5ede9]">{branch.name}</button>)}
          </div>
        </div>
      </details>
    </div>
    {view === "overview" && <>
      <div className="grid overflow-hidden rounded-2xl border border-[#e3d8d4] bg-[#fffdfa] md:grid-cols-[1.2fr_1fr]">
        <div className="border-b border-[#e9deda] p-5 sm:p-7 md:border-b-0 md:border-l">
          <p className="text-sm font-bold text-[#9a5948]">المتابعات في الصفحة الحالية</p>
          <p className="mt-2 text-5xl font-extrabold tracking-tight text-[#3d2d39]">{scopedQueue.length.toLocaleString("ar-SA")}</p>
          <p className="mt-2 text-sm text-[#766a70]">{qualifier}</p>
          <Button variant="outline" className="mt-5 min-h-11 rounded-xl border-[#bfa9a6] text-[#493441]" onClick={() => switchView("inbox")}>افتح المتابعات <ChevronLeft className="mr-2 h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-2 gap-0 divide-x divide-[#e9deda] p-5 sm:p-7">
          <div className="pl-4"><p className="text-2xl font-extrabold">{scopedQueue.filter(item => !!actorId && item.ownerId === actorId).length.toLocaleString("ar-SA")}</p><p className="mt-2 text-sm text-[#766a70]">مسندة لي في الصفحة</p></div>
          <div className="pr-4"><p className="text-2xl font-extrabold text-[#965339]">{failedCards.length.toLocaleString("ar-SA")}</p><p className="mt-2 text-sm text-[#766a70]">مصادر فرعية غير جاهزة</p></div>
          <p className="col-span-2 mt-5 border-t border-[#e9deda] pt-4 text-xs leading-6 text-[#786a70]">{failedCards.length ? "توجد مصادر لم تكتمل قراءتها؛ أعداد السجلات لا تمثل بياناتها." : "عدم ظهور مصدر غير متاح في القائمة لا يعني عدم وجود متابعات."}{unavailableSources.length > 0 && ` · ${unavailableSources.length} مصادر طابور غير متاحة.`}</p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e3d8d4] bg-[#fffdfa]">
          <div className="flex items-center justify-between gap-3 border-b border-[#e9deda] px-5 py-4"><div><h3 className="font-extrabold">المتابعات الحالية</h3><p className="text-xs text-[#786a70]">أول السجلات في ترتيب المصدر، دون ترتيب أولوية مستنتج</p></div><ClipboardList className="h-5 w-5 text-[#a45743]" /></div>
          {scopedQueue.length ? scopedQueue.slice(0, 4).map(item => <QueueRow key={item.id} item={item} name={name(item.branchId)} choose={() => { setSelectedRecord(item.id); setSelectedSource(null); }} />) : <div className="p-4"><Empty>لا توجد سجلات معروضة هنا؛ راجع حدود التغطية قبل الاستنتاج.</Empty></div>}
          {scopedQueue.length > 4 && <button type="button" onClick={() => switchView("inbox")} className="min-h-11 w-full border-t border-[#e9deda] text-sm font-bold text-[#804c48] hover:bg-[#f8f2ee]">عرض بقية الصفحة <ChevronLeft className="mr-1 inline h-4 w-4" /></button>}
        </section>
        <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e3d8d4] bg-[#fffdfa]">
          <div className="flex items-center justify-between gap-3 border-b border-[#e9deda] px-5 py-4"><div><h3 className="font-extrabold">قراءة الفروع</h3><p className="text-xs text-[#786a70]">سجلات معروضة ومصادر قابلة للقراءة، لا تقييم صحة</p></div><Store className="h-5 w-5 text-[#a45743]" /></div>
          {branches.filter(branch => !activeBranch || branch.id === activeBranch).slice(0, 5).map(branch => <button key={branch.id} type="button" onClick={() => { selectBranch(branch.id); switchView("sources"); }} className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-[#ebe1de] px-5 text-right text-sm hover:bg-[#f8f2ee]"><strong>{branch.name}</strong><span className="text-xs text-[#786a70]">{data.coverage.truncated ? "متابعات جزئية" : `${queue.filter(item => item.branchId === branch.id).length} معروضة`} · {cards.filter(card => card.branchId === branch.id && card.state === "ready").length} مصادر جاهزة</span></button>)}
          {!activeBranch && branches.length > 5 && <button type="button" onClick={() => switchView("branches")} className="min-h-12 w-full text-sm font-bold text-[#804c48] hover:bg-[#f8f2ee]">عرض جميع الفروع ({branches.length}) <ChevronLeft className="mr-1 inline h-4 w-4" /></button>}
        </section>
      </div>
    </>}
    {view === "inbox" && <section className="overflow-hidden rounded-2xl border border-[#e3d8d4] bg-[#fffdfa]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9deda] p-4 sm:p-5"><div><h3 className="font-extrabold">{visibleQueue.length} سجلات معروضة</h3><p className="text-xs text-[#786a70]">{qualifier}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-[#f4eeeb] p-1">{(["all", "mine", "waiting"] as const).map(filter => <button key={filter} type="button" onClick={() => { closeDetail(); setQueueFilter(filter); }} className={`min-h-9 rounded-md px-3 text-xs font-bold ${queueFilter === filter ? "bg-[#442d40] text-[#fff8f3]" : "text-[#766a70]"}`}>{filter === "all" ? "الكل" : filter === "mine" ? "المسند لي" : "غير المسند لي"}</button>)}</div>
          <label className="sr-only" htmlFor="oc-queue-source">مصدر السجل</label><select id="oc-queue-source" value={queueSource} onChange={event => { closeDetail(); setQueueSource(event.target.value); }} className="min-h-10 rounded-lg border border-[#e3d8d4] bg-[#fffdfa] px-2 text-sm"><option value="all">كل المصادر</option>{[...new Set(queue.map(item => item.sourceType))].map(source => <option key={source} value={source}>{operationsSourceLabel(source)}</option>)}</select>
        </div>
      </div>
      <div className="border-b border-[#e9deda] p-4"><label className="flex items-center gap-2 rounded-xl border border-[#e3d8d4] px-3"><Search className="h-4 w-4 text-[#a45743]" /><input value={queueSearch} onChange={event => { closeDetail(); setQueueSearch(event.target.value); }} placeholder="ابحث بالفرع أو السجل أو الحالة" aria-label="بحث المتابعات" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label></div>
      {visibleQueue.length ? visibleQueue.map(item => <QueueRow key={item.id} item={item} name={name(item.branchId)} choose={() => { setSelectedSource(null); setSelectedRecord(item.id); }} />) : <div className="p-4"><Empty>لا توجد سجلات تطابق هذا الاختيار؛ لا يُعد غياب المصادر غير المتاحة صفرًا.</Empty></div>}
      {(offset > 0 || data.coverage.nextOffset !== null) && <div className="flex gap-2 border-t border-[#e9deda] p-4">{offset > 0 && <Button variant="outline" onClick={() => { closeDetail(); onOffset(Math.max(0, offset - data.scope.limit)); }}>السابق</Button>}{data.coverage.nextOffset !== null && <Button variant="outline" onClick={() => { closeDetail(); onOffset(data.coverage.nextOffset!); }}>المزيد من المتابعات</Button>}</div>}
    </section>}
    {view === "sources" && <section className="overflow-hidden rounded-2xl border border-[#e3d8d4] bg-[#fffdfa]">
      <div className="border-b border-[#e9deda] p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold">المجالات التشغيلية</h3><p className="mt-1 text-sm text-[#786a70]">{groups.length} مجالات · اختر مجالًا لعرض فروعه، ثم افتح مصدر الفرع</p></div><Layers3 className="h-5 w-5 text-[#a45743]" /></div>
        <label className="mt-4 flex items-center gap-2 rounded-xl border border-[#e3d8d4] px-3"><Search className="h-4 w-4 text-[#a45743]" /><input value={sourceSearch} onChange={event => { closeDetail(); setSourceSearch(event.target.value); }} placeholder="ابحث عن مجال أو مصدر" aria-label="بحث المصادر" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      </div>
      {groups.length ? groups.map(group => <div key={group.id}><button type="button" aria-expanded={expandedGroup === group.id} onClick={() => { closeDetail(); setExpandedGroup(expandedGroup === group.id ? null : group.id); }} className={`flex min-h-20 w-full items-center justify-between gap-4 border-b border-[#ebe1de] px-5 text-right hover:bg-[#f8f2ee] ${expandedGroup === group.id ? "bg-[#f6efeb]" : ""}`}>
        <span className="min-w-0"><strong className="block text-base">{group.label}</strong><span className="mt-1 block text-xs text-[#786a70]">{group.cards.length} فروع مسجلة{group.cards.some(card => card.state !== "ready") ? ` · ${group.cards.filter(card => card.state !== "ready").length} مصادر غير جاهزة` : ""}</span></span><ChevronLeft className={`h-5 w-5 shrink-0 text-[#a45743] transition-transform ${expandedGroup === group.id ? "-rotate-90" : ""}`} />
      </button>{expandedGroup === group.id && sourceRows(group)}</div>) : <div className="p-4"><Empty>لا توجد مجالات تطابق البحث أو النطاق المحدد.</Empty></div>}
    </section>}
    {view === "branches" && <section className="overflow-hidden rounded-2xl border border-[#e3d8d4] bg-[#fffdfa]">
      <div className="border-b border-[#e9deda] p-5"><h3 className="font-extrabold">المقارنة بحسب الفرع</h3><p className="mt-1 text-sm text-[#786a70]">الأعداد هنا سجلات ومصادر معروضة فقط؛ ليست نسبة أداء أو تقييمًا للفرع.</p></div>
      <div className="divide-y divide-[#ebe1de]">{branches.filter(branch => !activeBranch || activeBranch === branch.id).map(branch => <div key={branch.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><strong className="text-sm">{branch.name}</strong><p className="mt-1 text-xs text-[#786a70]">{data.coverage.truncated ? "متابعات جزئية" : `${queue.filter(item => item.branchId === branch.id).length} متابعة في الصفحة`} · {cards.filter(card => card.branchId === branch.id && card.state === "ready").length} مصادر جاهزة · {cards.filter(card => card.branchId === branch.id && card.state !== "ready").length} غير جاهزة</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { selectBranch(branch.id); switchView("sources"); }}>مصادر الفرع</Button><Button variant="ghost" size="sm" onClick={() => openBranch(branch.id)}>مساحة الفرع <ArrowUpLeft className="mr-1 h-4 w-4" /></Button></div></div>)}</div>
    </section>}
    {view === "digest" && <Digest data={data} branchId={activeBranch} name={name} />}
    <div className="border-t border-[#e6dad6] pt-3">
      <button type="button" onClick={() => setMetricsOpen(!metricsOpen)} aria-expanded={metricsOpen} className="flex min-h-11 w-full items-center justify-between gap-3 text-right text-sm font-bold text-[#674f5a]"><span>مؤشرات النطاق وتعريفاتها</span><span className="text-xs font-normal text-[#786a70]">{data.metrics.length} مؤشر {metricsOpen ? "−" : "+"}</span></button>
      {metricsOpen && (data.metrics.length ? <div className="grid gap-3 pt-3 sm:grid-cols-2 lg:grid-cols-3">{data.metrics.map((metric, index) => <Metric key={`${metric.key}-${metric.scope.join(",")}-${index}`} metric={metric} />)}</div> : <Empty>لا توجد مؤشرات متاحة في هذا النطاق.</Empty>)}
    </div>
    {unavailableSources.length > 0 && <details className="rounded-xl border border-[#e8d9d0] bg-[#faf4ef] p-3 text-xs text-[#8b533b]"><summary className="cursor-pointer font-bold">حدود التغطية: {unavailableSources.length} مصادر طابور غير متاحة</summary><p className="mt-2 leading-6">المصادر: {unavailableSources.join("، ")}. عدم ظهور متابعات منها لا يعني صفرًا.</p></details>}
    <RecordSheet record={record} card={card} branch={record ? name(record.branchId) : card ? name(card.branchId) : ""} onClose={closeDetail} open={open} retry={retry} />
  </div>;
}