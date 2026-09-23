import { useEffect, useState } from "react";
import {
  AlertTriangle, BadgeAlert, BriefcaseBusiness, CalendarDays, ChevronLeft,
  ClipboardCheck, FileText, Gauge, MessageSquareWarning, PackageCheck, RefreshCw,
  Settings2, ShieldAlert, ShoppingBasket, Store, UsersRound, WalletCards, Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import maintenanceArt from "@/assets/branch-ops-icons/maintenance.svg";
import wasteArt from "@/assets/branch-ops-icons/waste.svg";
import purchasingArt from "@/assets/branch-ops-icons/purchasing.svg";
import kitchenArt from "@/assets/branch-ops-icons/kitchen.svg";
import closingArt from "@/assets/branch-ops-icons/closing.svg";
import targetsArt from "@/assets/branch-ops-icons/targets.svg";
import salesArt from "@/assets/branch-ops-icons/sales.svg";
import employeesArt from "@/assets/branch-ops-icons/employees.svg";
import documentsArt from "@/assets/branch-ops-icons/documents.svg";
import advancesArt from "@/assets/branch-ops-icons/advances.svg";
import complaintsArt from "@/assets/branch-ops-icons/complaints.svg";
import needsActionArt from "@/assets/branch-ops-icons/needs-action.svg";
import storeArt from "@/assets/branch-ops-icons/store.svg";

export type OperationCard = {
  id: string;
  title: string;
  group: string;
  href: string;
  state: "ready" | "error";
  metrics: Array<{ label: string; value: number; unit?: string }>;
  alerts: Array<{ label: string; count: number; href: string }>;
};

type IconMeta = { icon: typeof Wrench; tone: string; wash: string; art?: string };

// Bespoke paper-cut illustration set (client/src/assets/branch-ops-icons). The
// lucide glyph stays as the fallback whenever an illustration fails to load.
const CARD_META: Record<string, IconMeta> = {
  maintenance: { icon: Wrench, tone: "#ad604d", wash: "#f7e4de", art: maintenanceArt },
  waste: { icon: PackageCheck, tone: "#9b536b", wash: "#f3e3e9", art: wasteArt },
  purchasing: { icon: ShoppingBasket, tone: "#477a70", wash: "#dfeee9", art: purchasingArt },
  kitchen: { icon: ClipboardCheck, tone: "#5875a0", wash: "#e4ebf5", art: kitchenArt },
  closing: { icon: BriefcaseBusiness, tone: "#8f623f", wash: "#f2e7da", art: closingArt },
  targets: { icon: Gauge, tone: "#85568e", wash: "#efe4f0", art: targetsArt },
  sales: { icon: WalletCards, tone: "#39768b", wash: "#e1edf0", art: salesArt },
  employees: { icon: UsersRound, tone: "#58744d", wash: "#e6eddf", art: employeesArt },
  documents: { icon: FileText, tone: "#81694f", wash: "#eee7df", art: documentsArt },
  advances: { icon: BadgeAlert, tone: "#a44c59", wash: "#f5e2e4", art: advancesArt },
  complaints: { icon: MessageSquareWarning, tone: "#9b536b", wash: "#f3e3e9", art: complaintsArt },
};

const FALLBACK_META: IconMeta = { icon: Settings2, tone: "#6f5267", wash: "#eee5e9" };

export const BOARD_ART = { needsAction: needsActionArt, store: storeArt } as const;

/** Decorative illustration with a glyph fallback; the adjacent title carries the meaning. */
export function Artwork({ src, fallback: Fallback, className }: { src?: string; fallback: typeof Wrench; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (!src || broken) return <Fallback aria-hidden="true" className={className} />;
  return <img src={src} alt="" aria-hidden="true" decoding="async" draggable={false} className={className} onError={() => setBroken(true)} />;
}

export const GROUP_META = {
  operations: { label: "تشغيل الفرع", accent: "var(--ops-mint)", icon: Gauge },
  sales: { label: "المبيعات والإقفال", accent: "var(--ops-gold)", icon: WalletCards },
  people: { label: "الفريق والملفات", accent: "var(--ops-sky)", icon: UsersRound },
} as const;

export function formatServerDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(parsed);
}

export function BusinessDate({ value }: { value: string }) {
  return <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
    <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#713b5d] px-3 py-1.5 font-bold text-[#fffaf3]"><CalendarDays className="h-4 w-4" />يوم العمل: {formatServerDate(value)}</span>
    <span className="text-[#786b72]">المؤشرات والتنبيهات حسب صلاحياتك في هذا الفرع.</span>
  </div>;
}

export function NeedsActionStrip({ branchId, cards, onOpen }: { branchId: string; cards: OperationCard[]; onOpen: (href: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [branchId]);
  const actions = cards.flatMap((card) => card.state === "ready" ? card.alerts.filter((alert) => alert.count > 0)
    .map((alert, index) => ({ ...alert, cardId: card.id, cardTitle: card.title, index })) : []);
  const allReady = cards.every((card) => card.state === "ready");

  return <section className="mt-4 rounded-2xl border border-[#e4cabc] bg-[#fff8f0] p-3" aria-labelledby="branch-ops-needs-action" data-testid="branch-operations-needs-action">
    <div className="flex items-center gap-2">
      <span className="branch-ops-badge flex h-11 w-11 items-center justify-center rounded-xl bg-[#f7ddd7] text-[#a54640]"><Artwork src={BOARD_ART.needsAction} fallback={BadgeAlert} className="h-8 w-8" /></span>
      <h2 id="branch-ops-needs-action" className="font-black text-[#403442]">يحتاج إجراء</h2>
    </div>
    {actions.length ? <div className="mt-2.5 flex flex-wrap gap-2">
      {actions.map((action, position) => <button key={`${action.cardId}-${action.index}-${action.href}`} type="button" className={`${!expanded && position >= 4 ? "hidden sm:inline-flex" : "inline-flex"} branch-ops-action items-center gap-1.5`} onClick={() => onOpen(action.href)} data-testid={`branch-operation-top-action-${action.cardId}-${action.index}`} aria-label={`${action.cardTitle}: ${action.label}`}>
        <span className="rounded-md bg-[#f7ddd7] px-1.5 py-0.5 font-black">{action.count.toLocaleString("en-US")}</span><span>{action.cardTitle} · {action.label}</span>
      </button>)}
      {actions.length > 4 && <button type="button" className="min-h-11 px-2 text-xs font-black text-[#713b5d] sm:hidden" onClick={() => setExpanded((value) => !value)} data-testid="button-toggle-branch-actions">{expanded ? "عرض أقل" : `عرض المزيد (${actions.length - 4})`}</button>}
    </div> : <p className="mt-2 text-sm text-[#74656d]" data-testid="branch-operations-actions-empty">{allReady ? "لا توجد إجراءات معلقة ضمن الوحدات المتاحة." : "تعذر التحقق من بعض الوحدات؛ أعد المحاولة قبل اعتبار يوم العمل مكتملًا."}</p>}
  </section>;
}

export function OperationCardView({ card, onOpen, onRefresh }: { card: OperationCard; onOpen: (href: string) => void; onRefresh: () => void }) {
  const meta = CARD_META[card.id] ?? FALLBACK_META;
  const urgent = card.alerts.filter((alert) => alert.count > 0);
  return <article className="branch-ops-card text-[#332c3d]" data-testid={`branch-operation-card-${card.id}`}>
    <button type="button" className="branch-ops-card-main" onClick={() => onOpen(card.href)} aria-label={`فتح ${card.title}`}>
      <div className="flex items-start gap-3">
        <span className="branch-ops-icon" style={{ color: meta.tone, backgroundColor: meta.wash }}><Artwork src={meta.art} fallback={meta.icon} /></span>
        <span className="min-w-0 flex-1 pt-1">
          <h3 className="block break-words text-base font-black leading-snug text-[#332c3d]">{card.title}</h3>
          {card.state === "error" ? <span className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#a53e3e]"><AlertTriangle className="h-3.5 w-3.5" />تعذر تحديث المؤشرات</span>
            : card.metrics.length > 0 ? <span className="mt-1.5 block space-y-0.5 text-xs leading-5 text-[#655863]">{card.metrics.map((metric) => <span className="block break-words" key={metric.label}><b className="font-black text-[#332c3d]">{metric.value.toLocaleString("en-US")}{metric.unit ? ` ${metric.unit}` : ""}</b> {metric.label}</span>)}</span>
              : <span className="mt-1.5 block text-xs text-[#74656d]">فتح التفاصيل والمتابعة</span>}
        </span>
        <span className="mt-1 inline-flex shrink-0 items-center gap-0.5 text-xs font-black text-[#713b5d]"><span className="sr-only">فتح الصفحة</span><ChevronLeft className="h-4 w-4" aria-hidden="true" /></span>
      </div>
    </button>
    {card.state === "error" ? <div className="px-3 pb-3 md:px-3.5 md:pb-3.5"><Button variant="ghost" className="branch-ops-refresh min-h-11 px-2 font-bold text-[#a53e3e] hover:bg-[#fcece8] hover:text-[#84302f]" onClick={onRefresh}><RefreshCw className="ml-2 h-4 w-4" />إعادة المحاولة</Button></div>
      : urgent.length > 0 && <div className="branch-ops-alerts">{urgent.map((alert) => <button key={`${alert.label}-${alert.href}`} type="button" className="branch-ops-action inline-flex items-center gap-1" onClick={() => onOpen(alert.href)} aria-label={`${card.title}: ${alert.count} ${alert.label}`}><b>{alert.count.toLocaleString("en-US")}</b><span className="break-words">{alert.label}</span></button>)}</div>}
  </article>;
}

export function EmptyState({ title, text, icon: Icon, action }: { title: string; text: string; icon: typeof Store; action?: () => void }) {
  return <section className="mt-8 rounded-3xl border border-dashed border-[#d6bdac] bg-[#fffdf9] px-5 py-10 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3e5d4] text-[#713b5d]"><Icon className="h-6 w-6" /></span><h2 className="mt-4 text-lg font-black text-[#332c3d]">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-[#74656d]">{text}</p>{action && <Button className="mt-5 min-h-11 bg-[#713b5d] hover:bg-[#593049]" onClick={action}><RefreshCw className="ml-2 h-4 w-4" />تحديث اللوحة</Button>}</section>;
}

export function BoardSkeleton() {
  return <div className="mt-7 space-y-7" aria-label="جار تحميل لوحة الفرع" aria-busy="true"><div className="branch-ops-shimmer h-8 w-44 rounded-lg" /><div className="branch-ops-grid">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="branch-ops-shimmer h-32 rounded-2xl" />)}</div></div>;
}

export { AlertTriangle, Settings2, ShieldAlert, Store };