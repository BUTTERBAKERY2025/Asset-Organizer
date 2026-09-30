import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowUpLeft, CalendarDays, Download, Info, RefreshCw, Store } from "lucide-react";
import type { OperationsCard, OperationsCenterResponse, OperationsMetric, OperationsQueueItem } from "@shared/operations-center";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";
import { useOperationsCenterLive } from "@/hooks/useOperationsCenterLive";
import { filterOperationsQueue } from "@/lib/operations-center-queue";

type Area = "overview" | "branches" | "interventions" | "employees" | "supply" | "closing" | "digest";
const AREAS: { id: Area; label: string }[] = [
  { id: "overview", label: "نظرة عامة" }, { id: "branches", label: "الفروع" },
  { id: "interventions", label: "التدخلات" }, { id: "employees", label: "الموظفون" },
  { id: "supply", label: "التوريد" }, { id: "closing", label: "الإغلاق والجودة والصيانة" },
  { id: "digest", label: "اليومي والأسبوعي" },
];
const CARD_AREAS: Record<string, Area> = {
  complaints: "interventions", employees: "employees", documents: "employees",
  attendance: "employees", advances: "employees", purchasing: "supply",
  kitchen: "supply", warehouse: "supply", closing: "closing",
  cashier: "closing", waste: "closing", maintenance: "closing",
  sales: "closing", targets: "closing",
};
const RECORD_PARAMS: Record<string, string> = {
  maintenance: "ticketId", kitchen_order: "orderId", transfer: "transferId",
  reverse_movement: "movementId", delivery_assignment: "deliveryId",
  leave: "leaveId", attendance_record: "attendanceId", advance: "advanceId",
  quality_check: "checkId",
};
const time = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("ar-SA", { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" }).format(date)
    : "غير متاح";
};
const metricValue = (metric: OperationsMetric) =>
  metric.value === null || metric.coverage === "unavailable" ? "غير متاح" : `${new Intl.NumberFormat("ar-SA").format(metric.value)}${metric.unit ? ` ${metric.unit}` : ""}`;
const coverageLabel = (coverage: OperationsMetric["coverage"]) =>
  coverage === "complete" ? "تغطية كاملة" : coverage === "partial" ? "تغطية جزئية" : "غير متاح";

function Metric({ metric }: { metric: OperationsMetric }) {
  return <div className="rounded-xl border bg-card p-4 min-w-0" data-testid={`operations-metric-${metric.key}`}>
    <div className="flex items-start justify-between gap-2">
      <span className="text-sm text-muted-foreground">{metric.label}</span>
      <details className="relative shrink-0 text-xs text-muted-foreground">
        <summary className="cursor-pointer list-none rounded-full p-1 hover:bg-muted" aria-label={`تعريف ومصدر ${metric.label}`}><Info className="h-4 w-4" /></summary>
        <div className="absolute left-0 z-20 w-64 max-w-[75vw] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg space-y-1">
          <p>التعريف: {metric.definition}</p><p>المصدر: {metric.source}</p>
          <p>الفترة: {metric.period}</p><p>النطاق: {metric.scope.join("، ") || "غير متاح"}</p>
          <p>آخر تحديث: {time(metric.asOf)}</p><p>{coverageLabel(metric.coverage)}</p>
        </div>
      </details>
    </div>
    <p className="mt-2 text-2xl font-black tabular-nums">{metricValue(metric)}</p>
    {metric.coverage !== "complete" && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{coverageLabel(metric.coverage)}</p>}
  </div>;
}

function Empty({ message }: { message: string }) {
  return <p className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">{message}</p>;
}

export default function OperationsCenterPage() {
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const { user } = useAuth();
  const { branches, isLoading: branchesLoading, isError: branchesError, refetch: refetchBranches } = useBranches();
  const { canExport, canView, isLoading: permissionsLoading } = usePermissions();
  const [scopeChecked, setScopeChecked] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => new URLSearchParams(window.location.search).get("branchIds")?.split(",").filter(Boolean) ?? []);
  const [invalidSelection, setInvalidSelection] = useState(false);
  const [area, setArea] = useState<Area>("overview");
  const [queueFilter, setQueueFilter] = useState<"all" | "mine" | "waiting">("all");
  const [queueSource, setQueueSource] = useState("all");
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState("");
  const allowedIds = useMemo(() => branches.map(branch => branch.id), [branches]);
  // An empty selection means the server's current authorized scope, not cached client-side "all".
  const effectiveIds = selected.filter(id => allowedIds.includes(id));
  const key = ["/api/operations-center", user?.id, [...effectiveIds].sort().join(","), offset];
  const allowed = !permissionsLoading && canView("operations");
  // Keep the last validated scope while useBranches temporarily hides rows
  // during an authorization refetch; a transient empty list is not a revoke.
  const liveScope = useRef<string[]>([]);
  if (scopeChecked && !branchesLoading && !branchesError) liveScope.current = effectiveIds.length ? effectiveIds : allowedIds;
  useEffect(() => {
    setScopeChecked(false);
    client.removeQueries({ queryKey: ["/api/operations-center"] });
    void refetchBranches().then(result => setScopeChecked(!result.isError));
  }, [user?.id]);
  useEffect(() => {
    const removed = selected.some(id => !allowedIds.includes(id));
    if (removed || branchesError || !allowed) {
      void client.cancelQueries({ queryKey: ["/api/operations-center"] });
      client.removeQueries({ queryKey: ["/api/operations-center"] });
      if (removed && !branchesLoading && scopeChecked) setInvalidSelection(true);
    }
  }, [allowedIds.join(","), branchesError, branchesLoading, scopeChecked, allowed]);
  useEffect(() => {
    const refreshScope = () => {
      setScopeChecked(false);
      void client.cancelQueries({ queryKey: ["/api/operations-center"] });
      client.removeQueries({ queryKey: ["/api/operations-center"] });
      void refetchBranches().then(result => setScopeChecked(!result.isError));
    };
    window.addEventListener("focus", refreshScope);
    return () => window.removeEventListener("focus", refreshScope);
  }, [refetchBranches]);
  const live = useOperationsCenterLive({
    enabled: !!user?.id && allowed && scopeChecked && !invalidSelection && !branchesError && !branchesLoading && allowedIds.length > 0 && (effectiveIds.length || allowedIds.length) <= 25,
    branchIds: liveScope.current,
    onInvalidate: reason => {
      if (reason === "scope-invalidated") {
        setScopeChecked(false);
        void client.cancelQueries({ queryKey: ["/api/operations-center"] });
        client.removeQueries({ queryKey: ["/api/operations-center"] });
        void refetchBranches().then(result => setScopeChecked(!result.isError));
      } else void client.invalidateQueries({ queryKey: ["/api/operations-center"] });
    },
  });

  const center = useQuery<OperationsCenterResponse>({
    queryKey: key,
    enabled: !!user?.id && allowed && scopeChecked && !invalidSelection && !branchesLoading && !branchesError && allowedIds.length > 0,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (effectiveIds.length) params.set("branchIds", effectiveIds.join(","));
      if (offset) params.set("offset", String(offset));
      const res = await fetch(`/api/operations-center${params.size ? `?${params}` : ""}`, { credentials: "include", signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    retry: false, staleTime: 0, refetchInterval: 60_000, refetchOnWindowFocus: "always",
    placeholderData: undefined,
  });
  const data = scopeChecked && allowed && !branchesLoading && !branchesError && !center.isError &&
    center.data?.scope.branchIds.every(id => allowedIds.includes(id)) &&
    (!effectiveIds.length || center.data.scope.branchIds.every(id => effectiveIds.includes(id)))
    ? center.data : undefined;
  const branchName = (id: string) => data?.branches.find(b => b.id === id)?.name ?? branches.find(b => b.id === id)?.name ?? "فرع غير متاح";
  const changeScope = (ids: string[]) => {
    setMessage("");
    setOffset(0);
    setInvalidSelection(false);
    void client.cancelQueries({ queryKey: ["/api/operations-center"] });
    client.removeQueries({ queryKey: ["/api/operations-center"] });
    const next = ids.filter(id => allowedIds.includes(id));
    setSelected(next);
    navigate(`/operations-center${next.length ? `?${new URLSearchParams({ branchIds: next.join(",") })}` : ""}`, { replace: true });
  };
  const go = (href: string, branchId: string, item?: OperationsQueueItem) => {
    if (!data?.scope.branchIds.includes(branchId)) return;
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) throw new Error();
      if (item) {
        const parameter = RECORD_PARAMS[item.sourceType];
        if (!/^[1-9]\d*$/.test(item.sourceId) ||
          (item.sourceType === "cashier_journal"
            ? url.pathname !== `/cashier-journals/${item.sourceId}`
            : item.sourceType !== "daily_closure" && (!parameter || url.searchParams.get(parameter) !== item.sourceId))) throw new Error();
      }
      // The existing daily-closure detail route fetches the exact authorized
      // closure; the creation page does not understand closureId.
      if (item?.sourceType === "daily_closure") {
        if (!/^[1-9]\d*$/.test(item.sourceId)) throw new Error();
        url.pathname = `/branch-daily-closures/${item.sourceId}`;
        url.search = "";
      }
      url.searchParams.set("branchId", branchId);
      url.searchParams.set("from", "operations-center");
      url.searchParams.set("centerBranchIds", effectiveIds.join(","));
      navigate(`${url.pathname}${url.search}${url.hash}`);
    } catch { setMessage("رابط المصدر غير صالح؛ لم يتم فتحه."); }
  };
  const cards = data?.cards.filter(card => data.scope.branchIds.includes(card.branchId)) ?? [];
  const queue = data?.queue.filter(item => data.scope.branchIds.includes(item.branchId)) ?? [];
  const visibleQueue = filterOperationsQueue(queue, user?.id, queueFilter, queueSource);
  const areaCards = area === "overview" || area === "branches" ? cards : cards.filter(card => CARD_AREAS[card.id] === area);
  const exportScope = async () => {
    if (!canExport("operations") || !data) return;
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (effectiveIds.length) params.set("branchIds", effectiveIds.join(","));
      const res = await fetch(`/api/operations-center/export?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = new Blob([await res.text()], { type: "application/json;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "operations-center.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch { setMessage("تعذر التصدير من الخادم. حاول مرة أخرى."); }
  };
  return <Layout><main dir="rtl" className="page-container mx-auto max-w-7xl space-y-6 pb-12 pt-5" data-testid="operations-center-page">
    <header className="rounded-2xl border bg-card p-5 sm:p-7">
      <p className="text-xs font-bold tracking-wider text-muted-foreground">BUTTER BAKERY · عمليات الفروع</p>
      <h1 className="mt-2 text-2xl font-black sm:text-3xl">مركز إدارة التشغيل</h1>
      <p className="mt-2 text-sm text-muted-foreground">متابعة الفروع المسموح بها من المصادر التشغيلية الفعلية، دون اعتماد بيانات غير متاحة.</p>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <p className="mb-2 text-xs font-semibold">نطاق الفروع</p>
          <details className="rounded-lg border bg-background">
            <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">{effectiveIds.length ? `الفروع المختارة (${effectiveIds.length})` : `كل الفروع المسموح بها (${allowedIds.length})`}</summary>
            <div className="max-h-64 space-y-1 overflow-y-auto border-t p-2">
              <Button variant="ghost" className="w-full justify-start" onClick={() => changeScope([])}>كل الفروع المسموح بها</Button>
              {branches.map(branch => <label key={branch.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded px-2 hover:bg-muted">
                <input type="checkbox" checked={effectiveIds.includes(branch.id)} onChange={event => changeScope(event.target.checked ? [...effectiveIds, branch.id] : effectiveIds.length ? effectiveIds.filter(id => id !== branch.id) : allowedIds.filter(id => id !== branch.id))} />
                {branch.name}
              </label>)}
            </div>
          </details>
        </div>
        <Button variant="outline" className="min-h-11" disabled={!data || center.isFetching} onClick={() => center.refetch()}><RefreshCw className={`ml-2 h-4 w-4 ${center.isFetching ? "animate-spin" : ""}`} />تحديث</Button>
        {canExport("operations") && <Button variant="outline" className="min-h-11" disabled={!data} onClick={exportScope}><Download className="ml-2 h-4 w-4" />تصدير</Button>}
      </div>
      {data && <p className="mt-3 text-xs text-muted-foreground">يوم العمل: {data.businessDate} · آخر توليد: {time(data.generatedAt)} بتوقيت السعودية · {data.scope.branchIds.length} فرع ضمن النطاق · الاتصال: {live.status === "connected" ? "مباشر" : live.status === "polling" ? "تحديث دوري" : live.status === "access-invalidated" ? "الصلاحيات تغيرت" : "جار التحقق"} (آخر فحص {live.lastCheckedAt ? time(new Date(live.lastCheckedAt).toISOString()) : "غير متاح"})</p>}
      {message && <p role="alert" className="mt-3 text-sm text-destructive">{message}</p>}
    </header>
    <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="أقسام مركز التشغيل">{AREAS.map(item => <button key={item.id} type="button" aria-current={area === item.id ? "page" : undefined} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold ${area === item.id ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`} onClick={() => setArea(item.id)}>{item.label}</button>)}</nav>
    {branchesError ? <Empty message="تعذر التحقق من الفروع المسموح بها. حدّث قائمة الفروع وحاول مجددًا." /> : !allowed && !permissionsLoading ? <Empty message="لا تملك صلاحية عرض مركز التشغيل." /> : branchesLoading || !scopeChecked ? <p role="status" className="rounded-xl border p-8 text-center">جار تحميل نطاق الفروع والبيانات…</p> : invalidSelection ? <Empty message="تغير نطاق الصلاحيات أو الفرع المطلوب غير مسموح. اختر نطاقًا جديدًا من الفروع المتاحة أعلاه." /> : center.isLoading ? <p role="status" className="rounded-xl border p-8 text-center">جار تحميل البيانات…</p> : !allowedIds.length ? <Empty message="لا توجد فروع مسموح بها لهذا الحساب." /> : center.isError ? <div className="rounded-xl border p-6 text-center"><AlertTriangle className="mx-auto mb-2 h-6 w-6 text-destructive" /><p>تعذر تحميل المركز ({center.error instanceof Error ? center.error.message : "خطأ غير معروف"}). لم نعرض بيانات قديمة.</p><Button variant="outline" className="mt-3" onClick={() => center.refetch()}>إعادة المحاولة</Button></div> : data ? <>
      {data.coverage.truncated && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">قائمة المتابعات جزئية؛ توجد نتائج إضافية لم تُعرض. لا تعتبر الأعداد إجماليًا نهائيًا.</p>}
      {(area === "overview" || area === "branches") && <section className="space-y-3"><h2 className="text-lg font-black">الملخص التنفيذي</h2>{data.metrics.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{data.metrics.map((metric, index) => <Metric key={`${metric.key}-${metric.scope.join(",")}-${index}`} metric={metric} />)}</div> : <Empty message="لا توجد مؤشرات متاحة في هذا النطاق." />}</section>}
      {(area === "overview" || area === "branches") && <section className="space-y-3"><h2 className="text-lg font-black">الفروع</h2><div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[560px] text-right text-sm"><thead className="bg-muted/50"><tr><th className="p-3">الفرع</th><th className="p-3">المصادر المتاحة</th><th className="p-3">المتابعات المعروضة</th><th className="p-3">مساحة الفرع</th></tr></thead><tbody>{data.branches.filter(branch => data.scope.branchIds.includes(branch.id)).map(branch => <tr key={branch.id} className="border-t"><td className="p-3 font-bold">{branch.name}</td><td className="p-3">{cards.filter(card => card.branchId === branch.id && card.state === "ready").length} بطاقة</td><td className="p-3">{data.coverage.truncated ? "جزئي" : queue.filter(item => item.branchId === branch.id).length}</td><td className="p-3"><Button variant="link" onClick={() => navigate(`/branch-operations?branchId=${encodeURIComponent(branch.id)}`)}><Store className="ml-1 h-4 w-4" />فتح الفرع</Button></td></tr>)}</tbody></table></div></section>}
      {(area === "overview" || area === "interventions") && <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-black">طابور المتابعات</h2><div className="flex flex-wrap gap-1">{(["all", "mine", "waiting"] as const).map(filter => <Button key={filter} size="sm" variant={queueFilter === filter ? "default" : "outline"} onClick={() => setQueueFilter(filter)}>{filter === "all" ? "الكل" : filter === "mine" ? "لي (إسناد مؤكد)" : "بانتظار المتابعة"}</Button>)}</div></div>
        <label className="block text-xs text-muted-foreground">حسب المصدر <select value={queueSource} onChange={event => setQueueSource(event.target.value)} className="mr-2 min-h-10 rounded-lg border bg-background px-2 text-sm text-foreground"><option value="all">كل المصادر</option>{[...new Set(queue.map(item => item.sourceType))].map(source => <option key={source} value={source}>{source}</option>)}</select></label>
        {visibleQueue.length ? <div className="grid gap-3 md:grid-cols-2">{visibleQueue.map(item => <QueueRow key={`${item.sourceType}-${item.id}`} item={item} branch={branchName(item.branchId)} open={go} />)}</div> : <Empty message={queueFilter === "all" ? "لا توجد متابعات معروضة من المصادر المتاحة؛ قد تكون بعض المصادر غير متاحة." : "لا توجد متابعات معروضة لهذا المرشح؛ لا تُعدّ سجلات المالك غير المعروفة مسندة إليك."} />}
        <div className="flex gap-2">{offset > 0 && <Button variant="outline" onClick={() => setOffset(Math.max(0, offset - data.scope.limit))}>السابق</Button>}{data.coverage.nextOffset !== null && <Button variant="outline" onClick={() => setOffset(data.coverage.nextOffset!)}>المزيد من المتابعات</Button>}</div>
        {Object.entries(data.coverage.queue).filter(([, status]) => status === "unavailable").length > 0 && <p className="text-xs text-muted-foreground">بعض مصادر الطابور غير متاحة؛ لا يُحسب غيابها صفرًا.</p>}
      </section>}
      {area !== "digest" && <section className="space-y-3"><h2 className="text-lg font-black">{area === "overview" || area === "branches" ? "المؤشرات حسب الفرع" : AREAS.find(item => item.id === area)?.label}</h2>{areaCards.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{areaCards.map(card => <Card key={`${card.branchId}-${card.id}`} card={card} branch={branchName(card.branchId)} open={go} retry={() => center.refetch()} />)}</div> : <Empty message="لا توجد بطاقات متاحة لهذا القسم والصلاحيات الحالية." />}</section>}
      {area === "digest" && <section className="space-y-5"><div><h2 className="mb-3 text-lg font-black">فتح اليوم وإقفاله</h2>{data.daily.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.daily.map((day, index) => <div key={`${day.branchId}-${day.date}-${index}`} className="rounded-xl border bg-card p-4 text-sm"><p className="font-bold">{branchName(day.branchId)} · {day.date}</p><p className="mt-2">الفتح: {day.opening === "recorded" ? "مسجل" : "لا تتوفر بيانات فتح"}</p><p>الإقفال: {day.closing === "closed" ? "مغلق" : day.closing === "incomplete" ? "غير مكتمل" : "غير مسجل"}</p><p>اليوميات: {day.journalCount ?? "غير متاح"}</p><details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">المصادر</summary>{day.source.join("، ") || "غير متاح"}</details></div>)}</div> : <Empty message="لا توجد أدلة يومية متاحة ضمن هذا النطاق." />}</div><div><h2 className="mb-3 text-lg font-black">ملخص الأسابيع المسجلة</h2>{data.weekly.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.weekly.map(week => <div key={`${week.startDate}-${week.endDate}`} className="rounded-xl border bg-card p-4 text-sm"><CalendarDays className="mb-2 h-5 w-5 text-primary" /><p className="font-bold">{week.startDate} – {week.endDate}</p><p>إقفالات مسجلة: {week.recordedClosings}</p><p>يوميات مسجلة: {week.recordedJournals ?? "غير متاح"}</p><p className="mt-1 text-xs text-muted-foreground">{coverageLabel(week.coverage)}</p></div>)}</div> : <Empty message="لا تتوفر مؤشرات أسبوعية فعلية لهذا النطاق؛ لا نولّد تاريخًا افتراضيًا." />}</div></section>}
    </> : <Empty message="تعذر التحقق من نطاق الاستجابة. حدّث الصفحة بعد مراجعة صلاحيات الفروع." />}
  </main></Layout>;
}

function QueueRow({ item, branch, open }: { item: OperationsQueueItem; branch: string; open: (href: string, id: string, item?: OperationsQueueItem) => void }) {
  return <article className="rounded-xl border bg-card p-4 text-sm"><p className="text-xs text-muted-foreground">{branch} · {item.sourceType} · {item.status}</p><h3 className="mt-1 font-bold">{item.title}</h3><p className="mt-2">الخطوة: {item.step} · جهة المتابعة: {item.owner || "غير معروفة"}</p><p className="text-xs text-muted-foreground">الإسناد الفردي: {item.ownerId ? "مسجل" : "غير معروف"}</p><p>الموعد: {item.dueAt ? time(item.dueAt) : "غير معروف"}</p><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => open(item.href, item.branchId, item)}>فتح السجل المحدد <ArrowUpLeft className="mr-1 h-4 w-4" /></Button></div></article>;
}

function Card({ card, branch, open, retry }: { card: OperationsCard; branch: string; open: (href: string, id: string) => void; retry: () => void }) {
  return <article className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">{branch} · {card.module}</p><h3 className="mt-1 font-bold">{card.title}</h3>{card.state === "error" ? <div className="mt-3 text-sm text-destructive" role="alert"><p>{card.error || "تعذر جلب هذا المصدر؛ المؤشرات غير متاحة."}</p><Button variant="outline" size="sm" className="mt-2" onClick={retry}>إعادة المحاولة</Button></div> : <><div className="mt-3 grid grid-cols-2 gap-2">{card.metrics.map(metric => <Metric key={metric.key} metric={metric} />)}</div>{card.alerts.length > 0 && <p className="mt-2 text-sm text-muted-foreground">تنبيهات المصدر: {card.alerts.map(alert => `${alert.label}: ${alert.count}`).join(" · ")}</p>}</>}<Button variant="link" className="mt-2 px-0" onClick={() => open(card.href, card.branchId)}>فتح المصدر <ArrowUpLeft className="mr-1 h-4 w-4" /></Button></article>;
}