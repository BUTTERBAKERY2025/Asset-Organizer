import { useEffect, useState } from "react";
import {
  AlertTriangle, BadgeAlert, BriefcaseBusiness, CalendarDays, ChevronLeft, ClipboardCheck,
  FileText, Gauge, MessageSquareWarning, PackageCheck, RefreshCw, Settings2, ShieldAlert,
  ShoppingBasket, Store, TrendingUp, Truck, UsersRound, Receipt, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformAppIcon, type SemanticColor } from "@/components/platform-app-icon";

export type OperationCard = {
  id: string;
  title: string;
  group: string;
  href: string;
  state: "ready" | "error";
  metrics: Array<{ label: string; value: number; unit?: string }>;
  alerts: Array<{ label: string; count: number; href: string }>;
};

type Glyph = typeof Wrench;

/**
 * Sections follow the branch's working order: numbers first (sales, targets,
 * closing), then the supply chain, then upkeep, then the team. Colors reuse the
 * platform's semantic families (money = emerald, inventory = amber,
 * projects = orange, people = teal) so the board reads like the rest of the app.
 */
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
    id: "sales", label: "المبيعات والأهداف", hint: "ابدأ من هنا: أرقام اليوم مقابل الهدف، ثم إقفال الوردية.", icon: TrendingUp,
    cardIds: ["sales", "targets", "closing"],
    tile: "bg-emerald-500", badge: "bg-emerald-50 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/60", dot: "bg-emerald-500",
  },
  {
    id: "orders", label: "الطلبيات والمخزون", hint: "ما يحتاجه الفرع من المطبخ والمشتريات، وما يُهدر منه.", icon: Truck,
    cardIds: ["kitchen", "purchasing", "waste"],
    tile: "bg-amber-500", badge: "bg-amber-50 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-900/60", dot: "bg-amber-500",
  },
  {
    id: "operations", label: "تشغيل الفرع", hint: "أعطال الفرع وشكاوى العملاء التي تنتظر الرد.", icon: Gauge,
    cardIds: ["maintenance", "complaints"],
    tile: "bg-orange-500", badge: "bg-orange-50 ring-orange-100 dark:bg-orange-950/40 dark:ring-orange-900/60", dot: "bg-orange-500",
  },
  {
    id: "people", label: "الفريق والملفات", hint: "الموظفون، وثائقهم، وطلبات السلف.", icon: UsersRound,
    cardIds: ["employees", "documents", "advances"],
    tile: "bg-teal-500", badge: "bg-teal-50 ring-teal-100 dark:bg-teal-950/40 dark:ring-teal-900/60", dot: "bg-teal-500",
  },
] as const;

// Cards the server may add later land in the section matching their server group.
const SERVER_GROUP_FALLBACK: Record<string, SectionId> = { sales: "sales", operations: "operations", people: "people" };

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
  }
  return buckets.filter((bucket) => bucket.cards.length > 0);
}

type IconMeta = { icon: Glyph; color: SemanticColor };
const CARD_META: Record<string, IconMeta> = {
  sales: { icon: Receipt, color: "money" },
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
  return <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
    <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-primary px-3 py-1.5 font-bold text-primary-foreground shadow-sm"><CalendarDays className="h-4 w-4" />يوم العمل: {formatServerDate(value)}</span>
    <span className="text-muted-foreground">المؤشرات والتنبيهات حسب صلاحياتك في هذا الفرع.</span>
  </div>;
}

export function SectionHeader({ section, count }: { section: SectionMeta; count: number }) {
  const Icon = section.icon;
  return <div className="mb-3 flex items-start gap-3">
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${section.tile}`}><Icon className="h-4.5 w-4.5" aria-hidden="true" /></span>
    <div className="min-w-0">
      <h2 id={`branch-ops-${section.id}`} className="flex items-center gap-2 font-black text-foreground">{section.label}<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{count.toLocaleString("en-US")}</span></h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{section.hint}</p>
    </div>
  </div>;
}

export function NeedsActionStrip({ branchId, cards, onOpen }: { branchId: string; cards: OperationCard[]; onOpen: (href: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [branchId]);
  const ordered = groupCards(cards).flatMap((bucket) => bucket.cards);
  const actions = ordered.flatMap((card) => card.state === "ready" ? card.alerts.filter((alert) => alert.count > 0)
    .map((alert, index) => ({ ...alert, cardId: card.id, cardTitle: card.title, index })) : []);
  const allReady = cards.every((card) => card.state === "ready");

  return <section className="mt-4 rounded-2xl border border-rose-100 bg-card p-3 shadow-sm dark:border-rose-900/50" aria-labelledby="branch-ops-needs-action" data-testid="branch-operations-needs-action">
    <div className="flex items-center gap-2">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500 text-white"><BadgeAlert className="h-6 w-6" aria-hidden="true" /></span>
      <div>
        <h2 id="branch-ops-needs-action" className="font-black text-foreground">يحتاج إجراء</h2>
        {actions.length > 0 && <p className="text-[11px] text-muted-foreground">{actions.length.toLocaleString("en-US")} تنبيهًا مرتبة حسب أولوية العمل</p>}
      </div>
    </div>
    {actions.length ? <div className="mt-2.5 flex flex-wrap gap-2">
      {actions.map((action, position) => <button key={`${action.cardId}-${action.index}-${action.href}`} type="button" className={`${!expanded && position >= 4 ? "hidden sm:inline-flex" : "inline-flex"} branch-ops-action border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/45 dark:text-rose-200 dark:hover:bg-rose-900/60 items-center gap-1.5`} onClick={() => onOpen(action.href)} data-testid={`branch-operation-top-action-${action.cardId}-${action.index}`} aria-label={`${action.cardTitle}: ${action.label}`}>
        <span className="rounded-md bg-rose-100 px-1.5 py-0.5 font-black text-rose-800 dark:bg-rose-900/60 dark:text-rose-100">{action.count.toLocaleString("en-US")}</span><span>{action.cardTitle} · {action.label}</span>
      </button>)}
      {actions.length > 4 && <button type="button" className="min-h-11 px-2 text-xs font-black text-primary sm:hidden" onClick={() => setExpanded((value) => !value)} data-testid="button-toggle-branch-actions">{expanded ? "عرض أقل" : `عرض المزيد (${actions.length - 4})`}</button>}
    </div> : <p className="mt-2 text-sm text-muted-foreground" data-testid="branch-operations-actions-empty">{allReady ? "لا توجد إجراءات معلقة ضمن الوحدات المتاحة." : "تعذر التحقق من بعض الوحدات؛ أعد المحاولة قبل اعتبار يوم العمل مكتملًا."}</p>}
  </section>;
}

export function OperationCardView({ card, section, onOpen, onRefresh }: { card: OperationCard; section: SectionMeta; onOpen: (href: string) => void; onRefresh: () => void }) {
  const meta = CARD_META[card.id] ?? FALLBACK_META;
  const urgent = card.alerts.filter((alert) => alert.count > 0);
  return <article id={`branch-operation-card-${card.id}`} className="branch-ops-card border border-border bg-card text-card-foreground shadow-sm" data-testid={`branch-operation-card-${card.id}`}>
    <button type="button" className="group branch-ops-card-main" onClick={() => onOpen(card.href)} aria-label={`فتح ${card.title}`}>
      <div className="flex items-start gap-3">
        <PlatformAppIcon icon={meta.icon} color={meta.color} />
        <span className="min-w-0 flex-1 pt-1">
          <h3 className="block break-words text-base font-black leading-snug text-foreground">{card.title}</h3>
          {card.state === "error" ? <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-destructive"><AlertTriangle className="h-3.5 w-3.5" />تعذر تحديث المؤشرات</span>
            : card.metrics.length > 0 ? <span className="mt-1.5 block space-y-0.5 text-xs leading-5 text-muted-foreground">{card.metrics.map((metric) => <span className="block break-words" key={metric.label}><b className="font-black text-foreground">{metric.value.toLocaleString("en-US")}{metric.unit ? ` ${metric.unit}` : ""}</b> {metric.label}</span>)}</span>
              : <span className="mt-1.5 block text-xs text-muted-foreground">فتح التفاصيل والمتابعة</span>}
        </span>
        <span className="mt-1 inline-flex shrink-0 items-center gap-0.5 text-xs font-black text-primary"><span className="sr-only">فتح الصفحة</span><ChevronLeft className="h-4 w-4" aria-hidden="true" /></span>
      </div>
    </button>
    {card.state === "error" ? <div className="px-3 pb-3 md:px-3.5 md:pb-3.5"><Button variant="ghost" className="branch-ops-refresh min-h-11 px-2 font-bold text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onRefresh}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button></div>
      : urgent.length > 0 && <div className="branch-ops-alerts">{urgent.map((alert) => <button key={`${alert.label}-${alert.href}`} type="button" className="branch-ops-action border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/45 dark:text-rose-200 dark:hover:bg-rose-900/60 inline-flex items-center gap-1" onClick={() => onOpen(alert.href)} aria-label={`${card.title}: ${alert.count} ${alert.label}`}><b>{alert.count.toLocaleString("en-US")}</b><span className="break-words">{alert.label}</span></button>)}</div>}
  </article>;
}

export function EmptyState({ title, text, icon: Icon, action }: { title: string; text: string; icon: typeof Store; action?: () => void }) {
  return <section className="mt-8 rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Icon className="h-6 w-6" /></span><h2 className="mt-4 text-lg font-black text-foreground">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{text}</p>{action && <Button className="mt-5 min-h-11" onClick={action}><RefreshCw className="ml-2 h-4 w-4" />تحديث اللوحة</Button>}</section>;
}

export function BoardSkeleton() {
  return <div className="mt-7 space-y-7" aria-label="جار تحميل لوحة الفرع" aria-busy="true"><div className="branch-ops-shimmer h-8 w-44 rounded-lg" /><div className="branch-ops-grid">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="branch-ops-shimmer h-32 rounded-2xl" />)}</div></div>;
}

export { AlertTriangle, Settings2, ShieldAlert, Store };
