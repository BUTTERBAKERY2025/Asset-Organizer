import { useState } from "react";
import { ChevronDown, FileWarning, MoreHorizontal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DayOverview, DailySalesProgress, NeedsActionStrip, partitionActions, type OperationCard } from "./presentation";

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
  const [errorsOpen, setErrorsOpen] = useState(false);
  const errors = cards.filter(card => card.state === "error");
  const { now } = partitionActions(cards);
  const links = topQuickLinks(cards);
  return <div className="branch-desk-top branch-ops-daily-deck" data-testid="branch-operations-daily-deck">
    <div className="branch-desk-snapshot">
      <DayOverview cards={cards} compact />
      <DailySalesProgress cards={cards} compact />
    </div>
    <section className="branch-desk-focus" aria-label="أولويات يوم العمل">
      <div className="branch-desk-focus-head">
        <div>
          <p className="branch-desk-kicker">ابدأ من هنا</p>
          <h2>{now.length ? `${now.length.toLocaleString("en-US")} موضوعات تحتاج متابعة عاجلة` : "المتابعات المتاحة ليوم العمل"}</h2>
          <p className="branch-desk-caption">كل موضوع من مصدره؛ العدد يصف الموضوعات، وليس مجموع السجلات.</p>
        </div>
        <div className="branch-desk-menus">
          {links.create.length > 0 && <DropdownMenu>
            <DropdownMenuTrigger asChild><Button className="min-h-11" data-testid="branch-ops-create-menu"><MoreHorizontal className="ml-2 h-4 w-4" />إجراء جديد</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir="rtl" className="min-w-56">
              <DropdownMenuLabel>إجراءات إنشاء معلنة لهذا الفرع</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {links.create.map((link, index) => <DropdownMenuItem key={`${link.href}-${index}`} onSelect={() => onOpen(link.href)}>{link.label} · {link.cardTitle}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>}
          {links.receive.length > 0 && <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" className="min-h-11" data-testid="branch-ops-receive-menu">الاستلام<ChevronDown className="mr-2 h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir="rtl" className="min-w-56">
              <DropdownMenuLabel>متابعة الاستلام من المصدر</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {links.receive.map((link, index) => <DropdownMenuItem key={`${link.href}-${index}`} onSelect={() => onOpen(link.href)}>{link.label} · {link.cardTitle}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>}
          {links.navigate.length > 0 && <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" className="min-h-11" data-testid="branch-ops-quick-links-menu">روابط صفحات العمل<ChevronDown className="mr-2 h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir="rtl" className="min-w-56">
              <DropdownMenuLabel>روابط تنقل فقط · ليست إجراءات</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {links.navigate.map((link, index) => <DropdownMenuItem key={`${link.href}-${index}`} onSelect={() => onOpen(link.href)}>{link.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </div>
      <div className="branch-desk-priorities">
        <NeedsActionStrip key={`now-${branchId}`} branchId={branchId} cards={cards} onOpen={onOpen} compact suppressIncompleteWarning />
        <NeedsActionStrip key={`routine-${branchId}`} branchId={branchId} cards={cards} onOpen={onOpen} routine compact suppressIncompleteWarning />
      </div>
    </section>
    {errors.length > 0 && <section className="branch-desk-warning" aria-label="تنبيه اكتمال البيانات" data-testid="branch-operations-partial-warning">
      <div className="branch-desk-warning-intro"><FileWarning className="h-5 w-5 shrink-0" /><p><strong>بعض المصادر غير متاحة للتحقق.</strong> المتابعات المعروضة غير مكتملة؛ عدم ظهور عمل لا يعني عدم وجوده.</p></div>
      <button type="button" className="branch-desk-details" aria-expanded={errorsOpen} onClick={() => setErrorsOpen(value => !value)}>
        {errorsOpen ? "إخفاء المصادر" : `عرض المصادر (${errors.length})`}<ChevronDown className={`h-4 w-4 ${errorsOpen ? "rotate-180" : ""}`} />
      </button>
      {errorsOpen && <div className="branch-desk-error-list">
        {errors.map(card => <span key={card.id}>{card.title} · غير متاح</span>)}
        <Button variant="outline" size="sm" className="min-h-11" onClick={onRefresh} disabled={refreshing}><RefreshCw className={`ml-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />إعادة المحاولة</Button>
      </div>}
    </section>}
  </div>;
}