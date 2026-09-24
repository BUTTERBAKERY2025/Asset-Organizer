import { useEffect, useState } from "react";
import {
  AlertTriangle, BadgeAlert, BriefcaseBusiness, CalendarDays, ChevronDown, ChevronLeft, ClipboardCheck,
  FileText, Gauge, MessageSquareWarning, PackageCheck, RefreshCw, Settings2, ShieldAlert,
  ShoppingBasket, Store, TrendingUp, Truck, UsersRound, Receipt, Wrench, Warehouse, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformAppIcon, type SemanticColor } from "@/components/platform-app-icon";

export type OperationCard = {
  id: string;
  title: string;
  group: string;
  href: string;
  state: "ready" | "error";
  statusLabel?: string;
  description?: string;
  metrics: Array<{ label: string; value: number; unit?: string }>;
  alerts: Array<{ label: string; count: number; href: string; priority?: "critical" | "high" | "normal" | "low"; dueAt?: string; actionLabel?: string; description?: string }>;
  quickActions?: Array<{ label: string; href: string; kind: "create" | "receive" }>;
};

type Glyph = typeof Wrench;

/** Daily workflow groups; administrative follow-up is secondary. */
export type SectionId = "sales" | "orders" | "operations" | "people";

export type SectionMeta = {
  id: SectionId;
  label: string;
  hint: string;
  icon: Glyph;
  cardIds: string[];
  tile: string;
  badge: string;
  dot: string;
};

export const SECTIONS: readonly SectionMeta[] = [
  {
    id: "orders", label: "التوريد والاستلام", hint: "طلبات المطبخ والمستودع الرئيسي والمشتريات.", icon: Truck,
    cardIds: ["kitchen", "warehouse", "purchasing"],
    tile: "bg-emerald-500", badge: "bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/60", dot: "bg-emerald-500",
  },
  {
    id: "sales", label: "الوردية والمبيعات والإغلاق", hint: "يومية الكاشير وأداء اليوم والإغلاق والحضور.", icon: TrendingUp,
    cardIds: ["cashier", "sales", "targets", "closing", "attendance"],
    tile: "bg-amber-500", badge: "bg-amber-50 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-900/60", dot: "bg-amber-500",
  },
  {
    id: "operations", label: "مشكلات الفرع", hint: "الشكاوى والصيانة ومتابعة الهدر.", icon: Gauge,
    cardIds: ["complaints", "maintenance", "waste"],
    tile: "bg-orange-500", badge: "bg-orange-50 ring-orange-100 dark:bg-orange-950/40 dark:ring-orange-900/60", dot: "bg-orange-500",
  },
  {
    id: "people", label: "الفريق والمتابعات الإدارية", hint: "الموظفون والوثائق والسلف عند الحاجة.", icon: UsersRound,
    cardIds: ["employees", "documents", "advances"],
    tile: "bg-teal-500", badge: "bg-teal-50 ring-teal-100 dark:bg-teal-950/40 dark:ring-teal-900/60", dot: "bg-teal-500",
  },
] as const;

// Cards the server may add later land in the section matching their server group.
const SERVER_GROUP_FALLBACK: Record<string, SectionId> = { orders: "orders", sales: "sales", operations: "operations", people: "people" };

export function groupCards(cards: OperationCard[]): Array<{ section: SectionMeta; cards: OperationCard[] }> {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const placed = new Set<string>();
  const buckets = SECTIONS.map((section) => ({
    section,
    cards: section.cardIds.flatMap((id) => { const card = byId.get(id); if (!card) return []; placed.add(id); return [card]; }),
  }));
  for (const card of cards) {
    if (placed.has(card.id)) continue;
    const target = buckets.find((bucket) => bucket.section.id === (SERVER_GROUP_FALLBACK[card.group] ?? "operations")) ?? buckets[2];
    target.cards.push(card);
    placed.add(card.id);
  }
  return buckets.filter((bucket) => bucket.cards.length > 0);
}

type IconMeta = { icon: Glyph; color: SemanticColor };
const CARD_META: Record<string, IconMeta> = {
  sales: { icon: Receipt, color: "money" },
  cashier: { icon: Receipt, color: "money" },
  warehouse: { icon: Warehouse, color: "inventory" },
  attendance: { icon: Clock, color: "people" },
  targets: { icon: Gauge, color: "money" },
  closing: { icon: BriefcaseBusiness, color: "money" },
  kitchen: { icon: ClipboardCheck, color: "production" },
  purchasing: { icon: ShoppingBasket, color: "inventory" },
  waste: { icon: PackageCheck, color: "inventory" },
  maintenance: { icon: Wrench, color: "projects" },
  complaints: { icon: MessageSquareWarning, color: "people" },
  employees: { icon: UsersRound, color: "people" },
  documents: { icon: FileText, color: "people" },
  advances: { icon: BadgeAlert, color: "people" },
};

const FALLBACK_META: IconMeta = { icon: Settings2, color: "system" };

export function formatServerDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(parsed);
}

export function BusinessDate({ value }: { value: string }) {
  return <span className="inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
    <CalendarDays className="h-4 w-4" />يوم العمل: {formatServerDate(value)}
  </span>;
}

export function SectionHeader({ section, count }: { section: SectionMeta; count: number }) {
  return <div className="mb-3 flex items-start gap-3">
    <div className="min-w-0">
      <h2 id={`branch-ops-${section.id}`} className="font-black text-foreground">{section.label}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{section.hint}</p>
    </div>
  </div>;
}

export function requiredActions(cards: OperationCard[]) {
  const rank = { critical: 0, high: 1, normal: 2, low: 3 };
  const due = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Infinity;
  const sorted = cards.flatMap(card => card.state === "ready" ? card.alerts.filter(alert => alert.count > 0)
    .map((alert, index) => ({ ...alert, cardId: card.id, cardTitle: card.title, index })) : [])
    .sort((a, b) => rank[a.priority ?? "normal"] - rank[b.priority ?? "normal"] || due(a.dueAt) - due(b.dueAt));
  const seen = new Set<string>();
  return sorted.filter(action => {
    const url = new URL(action.href, "https://internal.invalid");
    url.searchParams.delete("branchId");
    url.searchParams.delete("from");
    url.searchParams.sort();
    const key = JSON.stringify([action.cardId, url.pathname, url.search, action.label, action.count, action.priority, action.dueAt, action.actionLabel, action.description]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isNavigationOnly(card: OperationCard) {
  // Empty results from a measured source (e.g. no approved sales or target)
  // mean unavailable data, not a navigation-only module.
  const measured = ["sales", "targets", "cashier", "kitchen", "warehouse", "purchasing", "waste", "closing", "attendance", "complaints", "employees", "documents", "advances"];
  return card.state === "ready" && !measured.includes(card.id) && card.metrics.length === 0 && card.alerts.length === 0;
}

export function partitionActions(cards: OperationCard[]) {
  const actions = requiredActions(cards);
  return {
    now: actions.filter(action => action.priority === "critical" || action.priority === "high"),
    routine: actions.filter(action => action.priority !== "critical" && action.priority !== "high"),
  };
}

export function DayOverview({ cards, compact = false }: { cards: OperationCard[]; compact?: boolean }) {
  const hasSalesComparison = dailySalesProgress(cards) !== null;
  const fields = [
    { id: "sales", label: "مبيعات اليوميات المعتمدة والمرحلة", unit: "ر.س" },
    { id: "targets", label: "هدف اليوم المعتمد", unit: "ر.س" },
    { id: "waste", label: "سجلات هدر اليوم", unit: undefined },
  ];
  const visible = fields.flatMap(field => {
    if (hasSalesComparison && (field.id === "sales" || field.id === "targets")) return [];
    const card = cards.find(card => card.id === field.id && card.state === "ready");
    if (!card) return [];
    const metric = card.metrics.find(metric => metric.label === field.label && metric.unit === field.unit);
    return [{ ...field, value: metric && Number.isFinite(metric.value) ? metric.value : null }];
  });
  if (!visible.length) return null;
  const compactLabels: Record<string, string> = { sales: "مبيعات معتمدة", targets: "هدف اليوم", waste: "سجلات هدر" };
  return <section className={`${compact ? "branch-ops-day-strip mt-0" : "mt-4"} rounded-xl border bg-card px-3 py-2.5`} aria-labelledby="branch-day-overview">
    <div className={compact ? "branch-ops-day-strip-title flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1" : "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"}>
      <h2 id="branch-day-overview" className="text-sm font-bold">نظرة على اليوم</h2>
      <p className="text-[11px] text-muted-foreground">المتاح فقط</p>
    </div>
    <dl className={`${compact ? "branch-ops-day-strip-metrics mt-0 divide-x divide-x-reverse divide-border" : "mt-2 flex flex-wrap divide-x divide-x-reverse divide-border"}`}>{visible.map(field => <div key={field.id} className={compact ? "branch-ops-day-strip-metric" : "min-w-28 flex-1 px-3 first:pr-0 last:pl-0"}>
      <dt className="text-[11px] text-muted-foreground" title={field.label}>{compactLabels[field.id] ?? field.label}</dt>
      <dd className="mt-0.5 text-sm font-bold">{field.value === null ? "غير متاح" : `${field.value.toLocaleString("en-US")}${field.unit ? ` ${field.unit}` : ""}`}</dd>
    </div>)}</dl>
    <p className={compact ? "branch-ops-day-strip-note text-muted-foreground" : "mt-2 text-[11px] text-muted-foreground"}>عدم توفر البيانات لا يعني صفرًا.</p>
  </section>;
}

export function dailySalesProgress(cards: OperationCard[]) {
  const sales = cards.find(card => card.id === "sales" && card.state === "ready");
  const targets = cards.find(card => card.id === "targets" && card.state === "ready");
  const actual = sales?.metrics.find(metric => metric.label === "مبيعات اليوميات المعتمدة والمرحلة" && metric.unit === "ر.س")?.value;
  const target = targets?.metrics.find(metric => metric.label === "هدف اليوم المعتمد" && metric.unit === "ر.س")?.value;
  if (typeof actual !== "number" || !Number.isFinite(actual) || actual < 0
    || typeof target !== "number" || !Number.isFinite(target) || target <= 0) return null;
  const ratio = actual / target * 100;
  return { actual, target, percentage: actual > 0 && Number.isFinite(ratio) ? ratio : null };
}

export function DailySalesProgress({ cards, compact = false }: { cards: OperationCard[]; compact?: boolean }) {
  const progress = dailySalesProgress(cards);
  if (!progress) return null;
  const format = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return <section className={`${compact ? "mt-0" : "mt-4"} rounded-xl border border-border bg-card p-3`} aria-labelledby="branch-daily-sales-progress" data-testid="branch-daily-sales-progress">
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <h2 id="branch-daily-sales-progress" className="font-bold">مبيعات اليوميات المعتمدة مقابل الهدف</h2>
      <p><b>{format(progress.actual)}</b> من {format(progress.target)} ر.س{progress.percentage !== null && <span className="mr-2 font-bold text-emerald-700 dark:text-emerald-300">{format(progress.percentage)}%</span>}</p>
    </div>
    {progress.percentage !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, progress.percentage)}%` }} /></div>}
    <p className="mt-2 text-xs text-muted-foreground">مبيعات اليوميات المعتمدة والمرحلة فقط، مقابل هدف اليوم المعتمد من التوزيع اليومي الفعلي.</p>
  </section>;
}

export function QuickActions({ cards, onOpen, compact = false }: { cards: OperationCard[]; onOpen: (href: string) => void; compact?: boolean }) {
  // Only explicit server permission metadata can advertise an action.
  const byId = new Map(cards.map(card => [card.id, card]));
  const supplies = ["kitchen", "warehouse"].flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const direct = ["waste", "complaints", "maintenance", "cashier", "closing"].flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
  const visible = [...supplies, ...direct].filter(card => card.state === "ready");
  if (!visible.length) return null;
  return <section className={compact ? "mt-0 rounded-xl border border-border bg-card p-3" : "mt-5"} aria-labelledby="branch-quick-actions">
    <h2 id="branch-quick-actions" className="mb-2 text-sm font-bold">وصول سريع</h2>
    <div className="flex flex-wrap items-start gap-2">
      {visible.map(card => <div key={card.id} className="flex flex-wrap gap-1">
        {(card.quickActions?.length ? card.quickActions : [{ label: `فتح ${card.title}`, href: card.href, kind: null }]).map((action, index) =>
          <Button key={`${card.id}-${index}`} variant="outline" className="min-h-11" onClick={() => onOpen(action.href)}>
            {action.kind ? `${action.label} · ${card.title}` : action.label}
          </Button>)}
      </div>)}
    </div>
    <p className="mt-2 text-xs text-muted-foreground">الإجراءات الظاهرة حسب الصلاحيات المعلنة؛ بقية الروابط تفتح صفحة العمل فقط.</p>
  </section>;
}

export function NeedsActionStrip({ branchId, cards, onOpen, routine = false, compact = false, suppressIncompleteWarning = false }: { branchId: string; cards: OperationCard[]; onOpen: (href: string) => void; routine?: boolean; compact?: boolean; suppressIncompleteWarning?: boolean }) {
  const [routineOpen, setRoutineOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => { setRoutineOpen(false); setExpanded(false); setSearch(""); }, [branchId]);
  const topics = partitionActions(cards)[routine ? "routine" : "now"];
  const actions = topics.filter(action => `${action.cardTitle} ${action.label}`.includes(search.trim()));
  const allReady = cards.every((card) => card.state === "ready");
  const headingId = routine ? "branch-ops-routine" : "branch-ops-needs-action";

  const content = <>
    {routine && topics.length > 4 && <input aria-label="بحث المتابعات الروتينية" placeholder="بحث باسم الوحدة أو المتابعة" value={search} onChange={event => { setSearch(event.target.value); setExpanded(true); }} className="mt-3 min-h-11 w-full rounded-lg border bg-background px-3 text-sm" />}
    {actions.length ? <div className={compact && !routine ? "branch-ops-compact-actions" : "mt-3 space-y-2"}>
      {actions.slice(0, expanded ? undefined : 4).map(action => {
        const urgent = action.priority === "critical" || action.priority === "high";
        if (compact && !routine) return <div key={`${action.cardId}-${action.index}`} className="branch-ops-compact-action" data-urgent={urgent} data-testid={`branch-operation-top-action-${action.cardId}-${action.index}`}>
          <div className="branch-ops-compact-action-copy">
            <span className={`text-[11px] font-bold ${urgent ? "text-destructive" : "text-muted-foreground"}`}>{urgent ? "عاجل" : "متابعة"}</span>
            <p className="font-semibold" title={`${action.cardTitle} · ${action.label}`}>{action.cardTitle} · {action.label} ({action.count.toLocaleString("en-US")})</p>
            {(action.description || action.dueAt && Number.isFinite(Date.parse(action.dueAt))) && <p className="mt-0.5 text-[11px] text-muted-foreground" title={action.description ?? undefined}>{action.description ?? `أقدم موعد: ${formatServerDate(action.dueAt!)}`}</p>}
          </div>
          <Button variant="outline" size="sm" className="branch-ops-followup shrink-0" onClick={() => onOpen(action.href)} aria-label={`فتح المتابعة: ${action.cardTitle}: ${action.label}`}>متابعة<ChevronLeft className="mr-1 h-4 w-4" /></Button>
        </div>;
        return <div key={`${action.cardId}-${action.index}`} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${urgent ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30" : "border-border bg-muted/30"}`} data-testid={`branch-operation-top-action-${action.cardId}-${action.index}`}>
          <div className="min-w-0 flex-1 text-sm">
            <span className={`text-xs font-bold ${urgent ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground"}`}>{urgent ? "عاجل" : "متابعة"}</span>
            <p className="font-semibold">{action.cardTitle} · {action.label} <b>({action.count.toLocaleString("en-US")})</b></p>
            {action.description && <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>}
            {action.dueAt && Number.isFinite(Date.parse(action.dueAt)) && <p className="mt-1 text-xs text-muted-foreground">أقدم موعد ضمن الموضوع: {formatServerDate(action.dueAt)} · {new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit" }).format(new Date(action.dueAt))}</p>}
          </div>
          <Button variant="outline" className="min-h-11 shrink-0" onClick={() => onOpen(action.href)} aria-label={`فتح المتابعة: ${action.cardTitle}: ${action.label}`}>فتح المتابعة<ChevronLeft className="mr-1 h-4 w-4" /></Button>
        </div>;
      })}
      {actions.length > 4 && <button type="button" className="min-h-11 px-2 text-xs font-black text-primary" onClick={() => setExpanded(value => !value)} data-testid="button-toggle-branch-actions">{expanded ? "عرض أقل" : `عرض المزيد (${actions.length - 4})`}</button>}
    </div> : <p className="mt-2 text-sm text-muted-foreground" data-testid="branch-operations-actions-empty">{search ? "لا توجد نتائج مطابقة للبحث." : cards.length === 0 ? "لا توجد وحدات مسموحة للتحقق من إجراءاتها." : cards.every(isNavigationOnly) ? "المتاح روابط تنقل فقط؛ لا توجد بيانات للتحقق من المتابعات." : routine ? "لا توجد موضوعات روتينية معروضة من المصادر المتاحة." : "لا توجد موضوعات حرجة أو عالية معروضة من المصادر المتاحة؛ راجع المتابعات الروتينية."}</p>}
    {!allReady && !suppressIncompleteWarning && <p className={compact ? "branch-ops-compact-warning text-destructive" : "mt-3 text-xs text-destructive"} role="status">تعذر التحقق من بعض الوحدات؛ القائمة غير مكتملة حتى إعادة المحاولة.</p>}
  </>;
  return <section className={`${compact ? "branch-ops-compact-panel" : "mt-4 rounded-2xl p-4 shadow-sm"} border border-border bg-card`} aria-labelledby={headingId} data-testid={routine ? "branch-operations-routine" : "branch-operations-needs-action"}>
    <div className="flex items-center gap-2">
      <div>
        <h2 id={headingId} className="font-black text-foreground">{routine ? "المتابعات الروتينية" : "المطلوب الآن"}</h2>
        <p className="text-[11px] text-muted-foreground">{topics.length.toLocaleString("en-US")} موضوع متابعة · {routine ? "أولوية عادية ومنخفضة" : "أولوية حرجة وعالية"} — ليست مجموع السجلات</p>
      </div>
      {routine && <button type="button" className="mr-auto inline-flex min-h-10 items-center gap-1 text-xs font-black text-primary" onClick={() => setRoutineOpen(value => !value)} aria-expanded={routineOpen} aria-controls="branch-ops-routine-content">
        {routineOpen ? "إخفاء" : "عرض المتابعات"}<ChevronDown className={`h-4 w-4 transition-transform ${routineOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>}
    </div>
    {routine && !allReady && !suppressIncompleteWarning && <p className="branch-ops-compact-warning text-destructive" role="status">تعذر التحقق من بعض الوحدات؛ المتابعات المعروضة غير مكتملة حتى إعادة المحاولة.</p>}
    {routine ? routineOpen && <div id="branch-ops-routine-content">{content}</div> : content}
  </section>;
}

export function OperationCardView({ card, section, onOpen, onRefresh, expanded = false, onToggle }: { card: OperationCard; section: SectionMeta; onOpen: (href: string) => void; onRefresh: () => void; expanded?: boolean; onToggle?: () => void }) {
  const meta = CARD_META[card.id] ?? FALLBACK_META;
  const panelId = `branch-operation-card-panel-${card.id}`;
  return <article id={`branch-operation-card-${card.id}`} className={`branch-ops-card border border-border bg-card text-card-foreground shadow-sm ${expanded ? "branch-ops-card-expanded" : ""}`} data-testid={`branch-operation-card-${card.id}`}>
    <button type="button" className="group branch-ops-card-main" onClick={() => onOpen(card.href)} aria-label={`فتح ${card.title}`}>
      <div className="flex items-center gap-3">
        <PlatformAppIcon icon={meta.icon} color={meta.color} />
        <span className="min-w-0 flex-1">
          <h3 className="branch-ops-card-title block break-words text-base font-black leading-snug text-foreground">{card.title}</h3>
          <span className="mt-1 block text-xs font-semibold text-muted-foreground">فتح صفحة العمل</span>
        </span>
        <ChevronLeft className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      </div>
    </button>
    <button type="button" className="branch-ops-card-details" onClick={onToggle} aria-expanded={expanded} aria-controls={panelId} aria-label={`${expanded ? "إخفاء" : "عرض"} تفاصيل ${card.title}`}>
      <span>التفاصيل</span><ChevronDown className={`branch-ops-card-chevron h-4 w-4 ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
    {expanded && <div id={panelId} className="branch-ops-card-panel">
      {isNavigationOnly(card) && <p className="text-xs font-bold text-muted-foreground">رابط تنقل فقط · لا يعكس حالة إنجاز</p>}
      {card.state === "error" ? <p className="inline-flex items-center gap-1 text-xs font-bold text-destructive"><AlertTriangle className="h-3.5 w-3.5" />تعذر تحديث المؤشرات</p>
        : card.metrics.length > 0 ? <div className="space-y-1 text-xs leading-5 text-muted-foreground">{card.statusLabel && <p className="font-semibold">{card.statusLabel}</p>}{card.metrics.map((metric) => <p className="break-words" key={metric.label}><b className="font-black text-foreground">{metric.value.toLocaleString("en-US")}{metric.unit ? ` ${metric.unit}` : ""}</b> {metric.label}</p>)}</div>
          : <p className="text-xs text-muted-foreground">{card.statusLabel ?? (isNavigationOnly(card) ? "صفحة متابعة — لا توجد مؤشرات معروضة" : "المؤشرات غير متاحة — لا يعني ذلك صفرًا")}</p>}
      {card.state === "ready" && card.description && <p className="mt-2 text-xs leading-5 text-muted-foreground">{card.description}</p>}
      {card.state === "error" && <Button variant="ghost" className="branch-ops-refresh mt-3 min-h-11 text-destructive" onClick={onRefresh}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button>}
    </div>}
  </article>;
}

export function EmptyState({ title, text, icon: Icon, action }: { title: string; text: string; icon: typeof Store; action?: () => void }) {
  return <section className="mt-8 rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Icon className="h-6 w-6" /></span><h2 className="mt-4 text-lg font-black text-foreground">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text}</p>{action && <Button className="mt-5 min-h-11" onClick={action}><RefreshCw className="ml-2 h-4 w-4" />تحديث اللوحة</Button>}</section>;
}

export function BoardSkeleton() {
  return <div className="mt-7 space-y-7" aria-label="جار تحميل لوحة الفرع" aria-busy="true"><div className="branch-ops-shimmer h-8 w-44 rounded-lg" /><div className="branch-ops-grid">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="branch-ops-shimmer h-32 rounded-2xl" />)}</div></div>;
}

export { AlertTriangle, Settings2, ShieldAlert, Store };
