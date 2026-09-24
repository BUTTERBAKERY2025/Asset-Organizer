import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BusinessDate, NeedsActionStrip, OperationCardView, DayOverview, DailySalesProgress,
  QuickActions, SectionHeader, SECTIONS, groupCards, isNavigationOnly,
} from "./_shared/presentation";
import { sampleBoard, sampleBranch } from "./_shared/fixtures";
import "./_group.css";

/** Extracted branch-operations page. Auth, query, router and push settings are sandbox-only stubs. */
export function Current() {
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const validBoard = sampleBoard;
  const go = (href: string) => setNotice(`معاينة فقط — لا يتم فتح صفحات التطبيق (${href.split("?")[0]}).`);
  const refresh = () => setNotice("معاينة فقط — لا يوجد اتصال بالخادم أو إعادة تحميل للبيانات.");

  return (
    <div className="branch-workspace-scope min-h-screen bg-background text-foreground">
      <main className="branch-ops-shell page-container pb-10" dir="rtl" data-testid="branch-operations-page">
        <section className="pt-4">
          <div className="branch-ops-head border-b border-border pb-3">
            <div className="min-w-0">
              <div>
                <h1 className="text-xl font-black text-foreground">لوحة الفرع التشغيلية</h1>
                <p className="mt-1 text-xs text-muted-foreground">متابعة يوم العمل في فرعك <span className="mr-2 inline-block"><BusinessDate value={validBoard.businessDate} /></span></p>
              </div>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Select value={sampleBranch.id} onValueChange={() => {}} disabled>
                <SelectTrigger className="min-h-11 min-w-0 flex-1 sm:w-[220px] sm:flex-none" data-testid="select-branch-operations"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent><SelectItem value={sampleBranch.id}>{sampleBranch.name}</SelectItem></SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={refresh} data-testid="button-refresh-branch-operations">
                <RefreshCw className="ml-2 h-4 w-4" />تحديث
              </Button>
              <span className="basis-full text-xs text-muted-foreground sm:basis-auto">
                آخر تحديث: {new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", numberingSystem: "latn" }).format(new Date(validBoard.generatedAt))}
              </span>
            </div>
          </div>
          {notice && <p className="mt-2 text-sm font-semibold text-muted-foreground" role="status">{notice}</p>}
        </section>
        <>
          <div className="branch-ops-daily-deck">
            <DayOverview cards={validBoard.cards} compact />
            <DailySalesProgress cards={validBoard.cards} compact />
            <div className="branch-ops-action-layout">
              <NeedsActionStrip key={validBoard.branchId} branchId={validBoard.branchId} cards={validBoard.cards} onOpen={go} compact />
              <div className="branch-ops-side-stack">
                <QuickActions key={`quick-${validBoard.branchId}`} cards={validBoard.cards} onOpen={go} compact />
                <NeedsActionStrip key={`routine-${validBoard.branchId}`} branchId={validBoard.branchId} cards={validBoard.cards} onOpen={go} routine compact />
              </div>
            </div>
          </div>
          <div className="mt-6 space-y-8">
            <h2 className="text-lg font-black">المؤشرات وصفحات العمل</h2>
            {groupCards(validBoard.cards.filter(card => !isNavigationOnly(card))).map(({ section, cards }) => section.id === "people" ? (
              <details key={`${validBoard.branchId}-${section.id}`} className="rounded-xl border border-border bg-muted/20 p-4" data-testid="branch-operations-section-people">
                <summary className="min-h-8 cursor-pointer font-bold" id="branch-ops-people">{section.label}</summary>
                <p className="mb-3 text-xs text-muted-foreground">{section.hint}</p>
                <div className="branch-ops-grid">{cards.map(card => <OperationCardView key={card.id} card={card} section={section} onOpen={go} onRefresh={refresh} expanded={expandedCardId === card.id} onToggle={() => setExpandedCardId(current => current === card.id ? null : card.id)} />)}</div>
              </details>
            ) : (
              <section key={section.id} aria-labelledby={`branch-ops-${section.id}`} data-testid={`branch-operations-section-${section.id}`}>
                <SectionHeader section={section} count={cards.length} />
                <div className="branch-ops-grid">
                  {cards.map((card) => <OperationCardView key={card.id} card={card} section={section} onOpen={go} onRefresh={refresh} expanded={expandedCardId === card.id} onToggle={() => setExpandedCardId(current => current === card.id ? null : card.id)} />)}
                </div>
              </section>
            ))}
            {validBoard.cards.some(isNavigationOnly) && <details className="rounded-xl border bg-muted/20 p-4" data-testid="branch-operations-navigation-only">
              <summary className="min-h-11 cursor-pointer font-bold">روابط تنقل فقط ({validBoard.cards.filter(isNavigationOnly).length})</summary>
              <p className="mb-3 text-xs text-muted-foreground">هذه الصفحات لا توفر مؤشرات للوحة؛ فتحها لا يعني وجود إجراء مطلوب أو اكتماله.</p>
              <div className="branch-ops-grid">{validBoard.cards.filter(isNavigationOnly).map(card => <OperationCardView key={card.id} card={card} section={SECTIONS[2]} onOpen={go} onRefresh={refresh} expanded={expandedCardId === card.id} onToggle={() => setExpandedCardId(current => current === card.id ? null : card.id)} />)}</div>
            </details>}
          </div>
          <details className="mt-8 rounded-xl border border-border bg-muted/20 px-3 py-2" data-testid="branch-operations-push-settings">
            <summary className="flex min-h-11 cursor-pointer items-center font-bold text-foreground">إعدادات إشعارات الجوال</summary>
            <p className="mb-1 mt-2 text-xs text-muted-foreground">معاينة فقط — تتطلب إعدادات الإشعارات حساباً مسجلاً في التطبيق.</p>
          </details>
        </>
      </main>
    </div>
  );
}