import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUpLeft, CalendarDays, ChevronLeft, Clock3, Info, Layers3, MapPin, Store } from "lucide-react";
import type { OperationsCard, OperationsCenterResponse, OperationsMetric, OperationsQueueItem } from "@shared/operations-center";
import { Button } from "@/components/ui/button";
import { filterOperationsQueue } from "@/lib/operations-center-queue";

export type DeskArea = "inbox" | "sources" | "employees" | "supply" | "closing" | "digest";
const areas: { id: DeskArea; label: string }[] = [
  { id: "inbox", label: "المتابعات" }, { id: "sources", label: "المصادر" }, { id: "employees", label: "الأفراد" },
  { id: "supply", label: "التوريد" }, { id: "closing", label: "الإغلاق والجودة" },
  { id: "digest", label: "اليومي والأسبوعي" },
];
const cardAreas: Record<string, DeskArea> = {
  complaints: "inbox", employees: "employees", documents: "employees",
  attendance: "employees", advances: "employees", purchasing: "supply",
  kitchen: "supply", warehouse: "supply", closing: "closing",
  cashier: "closing", waste: "closing", maintenance: "closing",
  sales: "closing", targets: "closing",
};
export function time(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" }).format(date)
    : "غير متاح";
}
const number = (value: number) => new Intl.NumberFormat("ar-SA").format(value);
const coverageLabel = (coverage: OperationsMetric["coverage"]) =>
  coverage === "complete" ? "تغطية كاملة" : coverage === "partial" ? "تغطية جزئية" : "غير متاح";
function Metric({ metric }: { metric: OperationsMetric }) {
  return <div className="min-w-0 rounded-xl border border-[#e7dfe0] bg-[#faf7f3] p-3" data-testid={`operations-metric-${metric.key}`}>
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs font-bold text-[#60545c]">{metric.label}</span>
      <details className="relative shrink-0 text-[#746972]">
        <summary className="cursor-pointer list-none rounded p-0.5 hover:bg-[#eee4e2]" aria-label={`تعريف ومصدر ${metric.label}`}><Info className="h-4 w-4" /></summary>
        <div className="absolute left-0 z-30 w-64 max-w-[75vw] space-y-1 rounded-xl border bg-popover p-3 text-xs leading-6 text-popover-foreground shadow-xl">
          <p>التعريف: {metric.definition}</p><p>المصدر: {metric.source}</p><p>الفترة: {metric.period}</p>
          <p>النطاق: {metric.scope.join("، ") || "غير متاح"}</p><p>آخر تحديث: {time(metric.asOf)}</p><p>{coverageLabel(metric.coverage)}</p>
        </div>
      </details>
    </div>
    <p className="mt-1 text-xl font-extrabold tabular-nums text-[#342832]">{metric.value === null || metric.coverage === "unavailable" ? "غير متاح" : `${number(metric.value)}${metric.unit ? ` ${metric.unit}` : ""}`}</p>
    {metric.coverage !== "complete" && <p className="mt-1 text-[11px] font-bold text-[#9b5a31]">{coverageLabel(metric.coverage)}</p>}
  </div>;
}
function Blank({ children }: { children: ReactNode }) {
  return <div className="m-4 rounded-xl border border-dashed border-[#dacbca] bg-[#faf7f3] px-5 py-9 text-center text-sm leading-6 text-[#726871]">{children}</div>;
}

function RecordDetail({ item, branch, open }: { item: OperationsQueueItem; branch: string; open: (href: string, branchId: string, item?: OperationsQueueItem) => void }) {
  return <div className="p-5 lg:p-6">
    <div className="mb-6 flex items-center gap-2 text-[11px] font-bold text-[#9b5547]"><span className="h-2 w-2 rounded-full bg-[#b36d58]" /> سجل متابعة محدد</div>
    <p className="text-xs font-bold text-[#786c74]">{branch} <span className="mx-1">/</span> {item.module}</p>
    <h3 className="mt-3 text-xl font-extrabold leading-snug text-[#342832]">{item.title}</h3>
    <div className="mt-6 overflow-hidden rounded-xl border border-[#e9dfe0] bg-[#faf7f3] text-sm">
      {[
        ["الحالة", item.status], ["الخطوة الحالية", item.step],
        ["جهة المتابعة", item.owner || "غير معروفة"],
        ["الإسناد الفردي", item.ownerId ? "مسجل" : "غير معروف"],
        ["الموعد", item.dueAt ? time(item.dueAt) : "غير معروف"],
        ["نوع المصدر", item.sourceType],
      ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-[#e9dfe0] px-4 py-3 last:border-b-0"><span className="shrink-0 text-[#81757c]">{label}</span><span className="text-left font-bold text-[#382c35]">{value}</span></div>)}
    </div>
    <Button className="mt-5 min-h-11 w-full rounded-xl bg-[#442d40] text-[#fff8f3] hover:bg-[#63445a]" onClick={() => open(item.href, item.branchId, item)}>فتح السجل المحدد <ArrowUpLeft className="mr-2 h-4 w-4" /></Button>
    <p className="mt-3 text-xs leading-5 text-[#81757c]">يفتح السجل الأصلي داخل النظام. لا يتم تغيير حالته من هنا.</p>
  </div>;
}
function SourceDetail({ card, branch, open, retry }: { card: OperationsCard; branch: string; open: (href: string, branchId: string) => void; retry: () => void }) {
  return <div className="p-5 lg:p-6">
    <div className="mb-6 flex items-center gap-2 text-[11px] font-bold text-[#9b5547]"><Layers3 className="h-4 w-4" /> مصدر تشغيلي</div>
    <p className="text-xs font-bold text-[#786c74]">{branch} / {card.module}</p>
    <h3 className="mt-3 text-xl font-extrabold text-[#342832]">{card.title}</h3>
    {card.state === "error" ? <div className="mt-5 rounded-xl border border-[#e5c5ba] bg-[#fff2eb] p-4 text-sm text-[#944c36]" role="alert">
      <AlertTriangle className="mb-2 h-5 w-5" /><p>{card.error || "تعذر جلب هذا المصدر؛ المؤشرات غير متاحة."}</p><Button variant="outline" size="sm" className="mt-3" onClick={retry}>إعادة المحاولة</Button>
    </div> : <>
      {card.state !== "ready" && <p className="mt-4 text-sm text-[#9b5a31]">بيانات المصدر غير متاحة؛ لا يُفسّر الغياب على أنه صفر.</p>}
      {card.metrics.length > 0 && <div className="mt-5 grid grid-cols-2 gap-2">{card.metrics.map((metric, index) => <Metric key={`${metric.key}-${index}`} metric={metric} />)}</div>}
      {card.alerts.length > 0 && <div className="mt-5 rounded-xl border border-[#e9dfe0] p-4"><p className="mb-2 text-xs font-bold text-[#786c74]">تنبيهات المصدر</p>{card.alerts.map((alert, index) => <p key={`${alert.label}-${index}`} className="flex justify-between border-t border-[#eee6e5] py-2 text-sm"><span>{alert.label}</span><strong>{alert.count}</strong></p>)}</div>}
    </>}
    <Button variant="outline" className="mt-5 min-h-11 w-full rounded-xl border-[#bfa8ac] text-[#442d40]" onClick={() => open(card.href, card.branchId)}>فتح المصدر <ArrowUpLeft className="mr-2 h-4 w-4" /></Button>
  </div>;
}

function Digest({ data, name, branchId }: { data: OperationsCenterResponse; name: (id: string) => string; branchId: string | null }) {
  return <div className="oc-pane oc-scroll flex-1 overflow-y-auto p-4 lg:p-6">
    <h2 className="text-lg font-extrabold text-[#342832]">دليل اليوم</h2>
    <p className="mt-1 text-xs text-[#81757c]">حالة السجلات المتاحة، لا استنتاج عن الفروع التي غابت بياناتها.</p>
    {data.daily.filter(day => !branchId || day.branchId === branchId).length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{data.daily.filter(day => !branchId || day.branchId === branchId).map((day, index) => <div key={`${day.branchId}-${day.date}-${index}`} className="rounded-xl border border-[#e9dfe0] bg-[#faf7f3] p-4 text-sm">
      <div className="flex justify-between gap-3"><strong>{name(day.branchId)}</strong><span className="text-[#81757c]">{day.date}</span></div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-[#eee5e5] px-2 py-1">فتح: {day.opening === "recorded" ? "مسجل" : "غير متاح"}</span><span className="rounded-md bg-[#eee5e5] px-2 py-1">إقفال: {day.closing === "closed" ? "مغلق" : day.closing === "incomplete" ? "غير مكتمل" : day.closing === "not_recorded" ? "غير مسجل" : "غير متاح"}</span><span className="rounded-md bg-[#eee5e5] px-2 py-1">يوميات: {day.journalCount ?? "غير متاح"}</span></div>
      <details className="mt-3 text-xs text-[#786c74]"><summary className="cursor-pointer">مصادر السجل</summary><p className="mt-2">{day.source.join("، ") || "غير متاح"}</p></details>
    </div>)}</div> : <Blank>لا توجد أدلة يومية متاحة ضمن هذا النطاق.</Blank>}
    <h2 className="mt-9 text-lg font-extrabold text-[#342832]">الأسابيع المسجلة <span className="text-xs font-normal text-[#81757c]">· كامل النطاق</span></h2>
    {data.weekly.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{data.weekly.map(week => <div key={`${week.startDate}-${week.endDate}`} className="rounded-xl border border-[#e9dfe0] p-4 text-sm">
      <p className="flex items-center gap-2 font-bold"><CalendarDays className="h-4 w-4 text-[#9b5547]" /> {week.startDate} — {week.endDate}</p>
      <p className="mt-3">إقفالات مسجلة: {number(week.recordedClosings)} <span className="mx-1 text-[#c8b8b7]">/</span> يوميات مسجلة: {week.recordedJournals === null ? "غير متاح" : number(week.recordedJournals)}</p>
      <p className="mt-2 text-xs text-[#9b5a31]">{coverageLabel(week.coverage)}</p>
    </div>)}</div> : <Blank>لا تتوفر مؤشرات أسبوعية فعلية لهذا النطاق.</Blank>}
  </div>;
}

export function OperationsWorkspace({ data, actorId, offset, onOffset, open, openBranch, retry }: {
  data: OperationsCenterResponse; actorId?: string; offset: number; onOffset: (value: number) => void;
  open: (href: string, branchId: string, item?: OperationsQueueItem) => void;
  openBranch: (id: string) => void; retry: () => void;
}) {
  const [area, setArea] = useState<DeskArea>("inbox");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<"all" | "mine" | "waiting">("all");
  const [queueSource, setQueueSource] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const activeBranch = branchId && data.scope.branchIds.includes(branchId) ? branchId : null;
  const cards = data.cards.filter(card => data.scope.branchIds.includes(card.branchId));
  const queue = data.queue.filter(item => data.scope.branchIds.includes(item.branchId));
  const scopedQueue = queue.filter(item => !activeBranch || item.branchId === activeBranch);
  const visibleQueue = filterOperationsQueue(scopedQueue, actorId, queueFilter, queueSource);
  const visibleCards = cards.filter(card => (!activeBranch || card.branchId === activeBranch) && (area === "sources" || cardAreas[card.id] === area));
  const focusedRecord = visibleQueue.find(item => item.id === selectedRecord) ?? visibleQueue[0];
  const focusedCard = visibleCards.find(card => `${card.branchId}:${card.id}` === selectedCard) ?? visibleCards[0];
  const name = (id: string) => data.branches.find(branch => branch.id === id)?.name ?? "فرع غير متاح";
  const unavailable = Object.entries(data.coverage.queue).filter(([, status]) => status === "unavailable").map(([source]) => source);
  const selectArea = (id: DeskArea) => { setArea(id); setMobileDetail(false); };
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3 overflow-x-auto border-b border-[#ded1d0]" aria-label="أقسام مركز التشغيل">
      <nav className="flex shrink-0 gap-1">{areas.map(item => <button key={item.id} type="button" aria-current={area === item.id ? "page" : undefined} onClick={() => selectArea(item.id)} className={`min-h-11 whitespace-nowrap border-b-[3px] px-3 text-sm font-bold transition-colors ${area === item.id ? "border-[#a45b48] text-[#442d40]" : "border-transparent text-[#81757c] hover:text-[#442d40]"}`}>{item.label}</button>)}</nav>
    </div>
    <div className="oc-workspace grid overflow-hidden rounded-2xl border border-[#e1d5d5] bg-[#fffdfa] shadow-[0_10px_35px_rgba(65,40,55,0.05)] lg:grid-cols-[210px_minmax(0,1fr)_345px] xl:grid-cols-[235px_minmax(0,1fr)_380px]">
      <aside className="oc-pane oc-scroll border-b border-[#e9dfe0] bg-[#f7f1ee] lg:border-b-0 lg:border-l">
        <div className="flex items-center justify-between px-4 pb-2 pt-4"><h2 className="text-xs font-extrabold text-[#5f4b56]">الفروع في النطاق</h2><MapPin className="h-4 w-4 text-[#ad7870]" /></div>
        <div className="oc-branch-list">
        <button type="button" onClick={() => { setBranchId(null); setMobileDetail(false); }} className={`flex min-h-11 w-full items-center justify-between px-4 text-right text-sm font-bold ${!activeBranch ? "border-r-[3px] border-[#a45b48] bg-[#eee2df] text-[#442d40]" : "text-[#6d6069] hover:bg-[#eee7e3]"}`}><span>كل الفروع</span><span className="text-xs tabular-nums">{data.scope.branchIds.length}</span></button>
        {data.branches.filter(branch => data.scope.branchIds.includes(branch.id)).map(branch => <div key={branch.id} className={`oc-branch-entry group flex items-center gap-1 border-t border-[#eee5e2] ${activeBranch === branch.id ? "bg-[#eee2df]" : ""}`}>
          <button type="button" onClick={() => { setBranchId(branch.id); setMobileDetail(false); }} className={`min-h-14 min-w-0 flex-1 px-4 text-right ${activeBranch === branch.id ? "border-r-[3px] border-[#a45b48] pr-[13px]" : "hover:bg-[#eee7e3]"}`}>
            <span className="block truncate text-sm font-bold text-[#42313e]">{branch.name}</span><span className="block text-[11px] text-[#81757c]">{data.coverage.truncated ? "المتابعات جزئية" : `${queue.filter(item => item.branchId === branch.id).length} متابعة معروضة`} · {cards.filter(card => card.branchId === branch.id && card.state === "ready").length} مصدر متاح</span>
          </button>
          <button type="button" title={`فتح مساحة ${branch.name}`} aria-label={`فتح مساحة ${branch.name}`} onClick={() => openBranch(branch.id)} className="ml-2 rounded-lg p-2 text-[#8c6974] hover:bg-[#e5d9d7]"><ArrowUpLeft className="h-4 w-4" /></button>
        </div>)}</div>
        <div className="m-3 rounded-xl border border-[#e9dcd8] bg-[#fffdfa] p-3 text-xs leading-5 text-[#786c74]"><strong className="hidden text-[#5b4552] lg:block">حدود القراءة</strong>{data.coverage.truncated ? "قائمة المتابعات جزئية، وهناك نتائج إضافية." : "المتابعات المعروضة من المصادر المتاحة فقط."}{unavailable.length > 0 && <details className="mt-2"><summary className="cursor-pointer font-bold text-[#98553d]">{unavailable.length} مصادر طابور غير متاحة</summary><p className="mt-1">{unavailable.join("، ")}. الغياب لا يعني صفرًا.</p></details>}</div>
      </aside>
      {area === "digest" ? <div className="flex min-w-0 flex-col lg:col-span-2"><Digest data={data} name={name} branchId={activeBranch} /></div> : <>
        <section className={`oc-pane oc-scroll min-w-0 border-[#e9dfe0] lg:border-l ${mobileDetail ? "hidden lg:block" : "block"}`}>
          <div className="sticky top-0 z-10 border-b border-[#eee5e5] bg-[#fffdfa] px-4 py-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-bold text-[#a45b48]">{activeBranch ? name(activeBranch) : "كل الفروع المسموح بها"}</p><h2 className="mt-0.5 text-lg font-extrabold text-[#342832]">{area === "inbox" ? "قائمة المتابعة" : areas.find(entry => entry.id === area)?.label}</h2></div><span className="rounded-lg bg-[#f3ece8] px-2.5 py-1 text-xs font-bold text-[#66525b]">{area === "inbox" ? visibleQueue.length : visibleCards.length} معروض</span></div>
            {area === "inbox" && <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-[#e5d9d8] bg-[#f8f3f0] p-0.5">{(["all", "mine", "waiting"] as const).map(filter => <button type="button" key={filter} onClick={() => { setQueueFilter(filter); setMobileDetail(false); }} className={`min-h-9 rounded-md px-3 text-xs font-bold ${queueFilter === filter ? "bg-[#442d40] text-[#fff8f3]" : "text-[#73656c] hover:bg-[#eee4e1]"}`}>{filter === "all" ? "الكل" : filter === "mine" ? "المسند لي" : "غير المسند لي"}</button>)}</div>
              <label className="sr-only" htmlFor="oc-source">المصدر</label><select id="oc-source" value={queueSource} onChange={event => { setQueueSource(event.target.value); setMobileDetail(false); }} className="min-h-10 max-w-36 rounded-lg border border-[#e5d9d8] bg-[#fffdfa] px-2 text-xs text-[#42313e]"><option value="all">كل المصادر</option>{[...new Set(queue.map(item => item.sourceType))].map(source => <option key={source} value={source}>{source}</option>)}</select>
            </div>}
          </div>
          {area === "inbox" ? <>
            {visibleQueue.length ? <div className="divide-y divide-[#eee6e5]">{visibleQueue.map(item => <button type="button" key={`${item.sourceType}-${item.id}`} onClick={() => { setSelectedRecord(item.id); setMobileDetail(true); }} className={`w-full px-4 py-4 text-right transition-colors hover:bg-[#faf5f1] ${focusedRecord?.id === item.id ? "oc-selected bg-[#fbf4f0]" : ""}`}>
              <div className="flex items-center justify-between gap-3 text-[11px] text-[#81757c]"><span className="truncate">{name(item.branchId)} <span className="mx-1">·</span> {item.module}</span><ChevronLeft className="h-4 w-4 shrink-0" /></div>
              <p className="mt-1.5 line-clamp-2 text-sm font-extrabold leading-6 text-[#3d3039]">{item.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#756970]"><span className="rounded bg-[#efe8e5] px-1.5 py-0.5 font-bold text-[#7c514e]">{item.status}</span><span>{item.step}</span>{item.dueAt && <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{time(item.dueAt)}</span>}</div>
            </button>)}</div> : <Blank>{queueFilter === "all" ? "لا توجد متابعات معروضة من المصادر المتاحة. بعض المصادر قد تكون غير متاحة." : "لا توجد متابعات لهذا المرشح؛ الإسناد غير المعروف لا يُحسب مسندًا إليك."}</Blank>}
            {(offset > 0 || data.coverage.nextOffset !== null) && <div className="flex gap-2 border-t border-[#eee6e5] p-4">{offset > 0 && <Button size="sm" variant="outline" onClick={() => { onOffset(Math.max(0, offset - data.scope.limit)); setMobileDetail(false); }}>السابق</Button>}{data.coverage.nextOffset !== null && <Button size="sm" variant="outline" onClick={() => { onOffset(data.coverage.nextOffset!); setMobileDetail(false); }}>المزيد من المتابعات</Button>}</div>}
          </> : visibleCards.length ? <div className="divide-y divide-[#eee6e5]">{visibleCards.map(card => <button type="button" key={`${card.branchId}-${card.id}`} onClick={() => { setSelectedCard(`${card.branchId}:${card.id}`); setMobileDetail(true); }} className={`w-full px-4 py-4 text-right hover:bg-[#faf5f1] ${focusedCard === card ? "oc-selected bg-[#fbf4f0]" : ""}`}><div className="flex items-center justify-between gap-3"><span className="text-[11px] text-[#81757c]">{name(card.branchId)} · {card.module}</span><ChevronLeft className="h-4 w-4 text-[#81757c]" /></div><p className="mt-1 font-extrabold text-[#3d3039]">{card.title}</p><span className={`mt-2 inline-block text-xs ${card.state === "ready" ? "text-[#716570]" : "font-bold text-[#a3543b]"}`}>{card.state === "ready" ? `${card.metrics.length} مؤشرات من المصدر` : card.state === "error" ? "تعذر جلب المصدر" : "المصدر غير متاح"}</span></button>)}</div> : <Blank>لا توجد مصادر متاحة لهذا القسم والنطاق الحالي.</Blank>}
        </section>
        <aside className={`oc-pane oc-scroll min-w-0 bg-[#fffdfa] ${mobileDetail ? "block" : "hidden lg:block"}`}>
          <button type="button" className="flex min-h-11 items-center gap-1 border-b border-[#eee5e5] px-4 text-xs font-bold text-[#7f5b62] lg:hidden" onClick={() => setMobileDetail(false)}>العودة إلى القائمة <ChevronLeft className="h-4 w-4 rotate-180" /></button>
          {area === "inbox" ? focusedRecord ? <RecordDetail item={focusedRecord} branch={name(focusedRecord.branchId)} open={open} /> : <Blank>اختر متابعة من القائمة لعرض مصدرها وخطوتها.</Blank> : focusedCard ? <SourceDetail card={focusedCard} branch={name(focusedCard.branchId)} open={open} retry={retry} /> : <Blank>اختر مصدرًا لعرض تفاصيله.</Blank>}
        </aside>
      </>}
    </div>
    <details className="group rounded-xl border border-[#e5d9d8] bg-[#fffdfa]">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-bold text-[#5c4855]"><span className="flex items-center gap-2"><Store className="h-4 w-4 text-[#a45b48]" /> مؤشرات النطاق وتعريفاتها</span><span className="text-xs font-normal text-[#81757c]">{data.metrics.length} مؤشر</span></summary>
      <div className="grid gap-2 border-t border-[#eee6e5] p-3 sm:grid-cols-2 lg:grid-cols-4">{data.metrics.length ? data.metrics.map((metric, index) => <Metric key={`${metric.key}-${metric.scope.join(",")}-${index}`} metric={metric} />) : <p className="p-3 text-sm text-[#81757c]">لا توجد مؤشرات متاحة في هذا النطاق.</p>}</div>
    </details>
  </div>;
}