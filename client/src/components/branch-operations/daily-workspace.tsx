import { useState } from "react";
import { ChevronDown, ChevronLeft, FileWarning, MoreHorizontal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { partitionActions, type OperationCard } from "./presentation";

// Keep the same quick-access card set as the former QuickActions panel. A fallback
// href is navigation, never evidence of permission to create or receive.
const quickCardIds = ["kitchen", "warehouse", "waste", "complaints", "maintenance", "cashier", "closing"];

export function topQuickLinks(cards: OperationCard[]) {
  const byId = new Map(cards.map(card => [card.id, card]));
  const create: Array<{ label: string; href: string; cardTitle: string }> = [];
  const receive: typeof create = [];
  const navigate: typeof create = [];
  for (const id of quickCardIds) {
    const card = byId.get(id);
    if (!card || card.state !== "ready") continue;
    if (!card.quickActions?.length) {
      navigate.push({ label: `فتح ${card.title}`, href: card.href, cardTitle: card.title });
      continue;
    }
    for (const action of card.quickActions) {
      (action.kind === "create" ? create : receive).push({ label: action.label, href: action.href, cardTitle: card.title });
    }
  }
  return { create, receive, navigate };
}

export function DailyWorkspace({ branchId, cards, onOpen, onRefresh, refreshing = false }: {
  branchId: string; cards: OperationCard[]; onOpen: (href: string) => void; onRefresh: () => void; refreshing?: boolean;
}) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const errors = cards.filter(card => card.state === "error");
  const { now, routine } = partitionActions(cards);
  const actions = [...now, ...routine];
  const links = topQuickLinks(cards);
  return <div className="branch-desk-top branch-ops-daily-deck" data-testid="branch-operations-daily-deck">
    <section className="branch-desk-toolbar" aria-label="إجراءات الفرع السريعة">
      <div className="branch-desk-menus">
        {links.create.length > 0 && <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild><Button className="min-h-11" data-testid="branch-ops-create-menu"><MoreHorizontal className="ml-2 h-4 w-4" />إجراء جديد</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel>إجراءات إنشاء معلنة لهذا الفرع</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {links.create.map((link, index) => <DropdownMenuItem key={`${link.href}-${index}`} onSelect={() => onOpen(link.href)}>{link.label} · {link.cardTitle}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>}
        {links.receive.length > 0 && <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild><Button variant="outline" className="min-h-11" data-testid="branch-ops-receive-menu">الاستلام<ChevronDown className="mr-2 h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel>متابعة الاستلام من المصدر</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {links.receive.map((link, index) => <DropdownMenuItem key={`${link.href}-${index}`} onSelect={() => onOpen(link.href)}>{link.label} · {link.cardTitle}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>}
        {links.navigate.length > 0 && <DropdownMenu dir="rtl">
          <DropdownMenuTrigger asChild><Button variant="ghost" className="min-h-11" data-testid="branch-ops-quick-links-menu">روابط صفحات العمل<ChevronDown className="mr-2 h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel>روابط تنقل فقط · ليست إجراءات</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {links.navigate.map((link, index) => <DropdownMenuItem key={`${link.href}-${index}`} onSelect={() => onOpen(link.href)}>{link.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>}
      </div>
    </section>
    {(actions.length > 0 || errors.length > 0) && <section className={`branch-desk-notification ${errors.length ? "branch-desk-notification-incomplete" : ""}`} aria-label="تنبيهات المتابعة" data-testid="branch-operations-intervention-notification">
      <div className="branch-desk-notification-intro">
        {errors.length > 0 ? <FileWarning className="h-4 w-4 shrink-0" /> : null}
        <p>{errors.length > 0 ? <><strong>نتائج المتابعة غير مكتملة.</strong> تعذر التحقق من {errors.length.toLocaleString("en-US")} مصدر؛ عدم ظهور عمل لا يعني عدم وجوده.</> : actions.length ? <><strong>{actions.length.toLocaleString("en-US")} متابعة تحتاج تدخلاً.</strong> تشمل العاجل والروتيني من المصادر المتاحة.</> : "لا توجد متابعات تتطلب تدخلاً من المصادر المتاحة."}</p>
      </div>
      {(actions.length > 0 || errors.length > 0) && <button type="button" className="branch-desk-details" aria-expanded={notificationOpen} aria-controls={`branch-operations-intervention-content-${branchId}`} onClick={() => setNotificationOpen(value => !value)}>
        {notificationOpen ? "إخفاء التفاصيل" : "عرض التفاصيل"}<ChevronDown className={`h-4 w-4 transition-transform ${notificationOpen ? "rotate-180" : ""}`} />
      </button>}
      {notificationOpen && <div id={`branch-operations-intervention-content-${branchId}`} className="branch-desk-notification-details">
        {actions.map(action => <div key={`${action.cardId}-${action.index}`} className="branch-desk-action" data-testid={`branch-operation-top-action-${action.cardId}-${action.index}`}>
          <div className="min-w-0"><p className="font-semibold">{(action.priority === "critical" || action.priority === "high") && <span className="text-destructive">عاجل · </span>}{action.cardTitle} · {action.label} <span className="text-muted-foreground">({action.count.toLocaleString("en-US")})</span></p>{action.description && <p className="text-xs text-muted-foreground">{action.description}</p>}</div>
          <Button variant="ghost" size="sm" className="min-h-10 shrink-0" onClick={() => onOpen(action.href)} aria-label={`فتح المتابعة: ${action.cardTitle}: ${action.label}`}>متابعة<ChevronLeft className="mr-1 h-4 w-4" /></Button>
        </div>)}
        {errors.length > 0 && <div className="branch-desk-error-list">{errors.map(card => <span key={card.id}>{card.title} · غير متاح</span>)}<Button variant="outline" size="sm" className="min-h-10" onClick={onRefresh} disabled={refreshing}><RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />إعادة المحاولة</Button></div>}
      </div>}
    </section>}
  </div>;
}