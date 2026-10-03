import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OperationCardView, SECTIONS, type OperationCard } from "./presentation";
import { WorkGroups, WORK_GROUPS, groupWorkPages } from "./work-groups";

const card = (id: string, group = "operations"): OperationCard => ({
  id, title: `صفحة ${id}`, group, href: `/${id}?branchId=fixture`, state: "ready", metrics: [], alerts: [],
});

describe("branch desk expandable workflow groups", () => {
  it("assigns all fourteen functions to the exact four approved workflows in order", () => {
    const cards = WORK_GROUPS.flatMap(group => group.cardIds).reverse().map(id => card(id));
    const grouped = groupWorkPages(cards);
    expect(grouped.map(({ section }) => section.label)).toEqual([
      "التوريد والاستلام", "المبيعات وإغلاق اليوم", "الموظفون والوردية", "متابعة الفرع",
    ]);
    expect(grouped.map(({ cards }) => cards.map(card => card.id))).toEqual([
      ["kitchen", "warehouse", "purchasing"], ["cashier", "sales", "targets", "closing"],
      ["attendance", "employees", "documents", "advances"], ["complaints", "maintenance", "waste"],
    ]);
    expect(grouped.flatMap(group => group.cards)).toHaveLength(14);
    expect(new Set(WORK_GROUPS.flatMap(group => group.cardIds)).size).toBe(14);
  });

  it("includes navigation-only and future permitted pages without inventing empty groups", () => {
    const cards = [card("maintenance"), card("documents"), card("future-delivery", "orders"), card("future-page", "unknown")];
    const groups = groupWorkPages(cards);
    expect(groups.map(group => [group.section.id, group.cards.map(card => card.id)])).toEqual([
      ["orders", ["future-delivery"]], ["people", ["documents"]], ["operations", ["maintenance", "future-page"]],
    ]);
    expect(groupWorkPages([])).toEqual([]);
    const html = renderToStaticMarkup(<WorkGroups cards={cards} expandedCardId="maintenance" onOpen={vi.fn()} onToggle={vi.fn()} onRefresh={vi.fn()} />);
    expect(html).toContain("رابط تنقل فقط · لا يعكس حالة إنجاز");
    expect(html).toContain('aria-label="2 صفحات مسموحة"');
    expect(html).not.toContain("branch-operations-navigation-only");
  });

  it("renders only one semantic icon per group, native collapsed summaries and text-only functional rows", () => {
    const cards = WORK_GROUPS.flatMap(group => group.cardIds.map(id => card(id)));
    const html = renderToStaticMarkup(<WorkGroups cards={cards} expandedCardId={null} onOpen={vi.fn()} onToggle={vi.fn()} onRefresh={vi.fn()} />);
    expect(html.match(/class="platform-app-icon /g)).toHaveLength(4);
    expect(html.match(/<details /g)).toHaveLength(4);
    expect(html.match(/branch-ops-function-row/g)).toHaveLength(14);
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=""|\s|>)/);
    expect(html).not.toContain("فتح صفحة العمل");
    expect(html).toContain('aria-label="فتح صفحة kitchen"');
    expect(html).toContain('aria-label="عرض تفاصيل صفحة kitchen"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("preserves row metrics, unavailable/error states and maintenance workflow semantics", () => {
    const render = (value: OperationCard) => renderToStaticMarkup(<OperationCardView card={value} section={SECTIONS[2]} variant="row" expanded onOpen={vi.fn()} onRefresh={vi.fn()} onToggle={vi.fn()} />);
    const metrics = render({ ...card("cashier"), metrics: [{ label: "مبيعات اليوم", value: 873.5, unit: "ر.س" }], statusLabel: "معتمدة", description: "من المصدر" });
    expect(metrics).toContain("873.5 ر.س");
    expect(metrics).toContain("معتمدة");
    expect(metrics).toContain("من المصدر");
    expect(metrics).toContain('id="branch-operation-card-panel-cashier"');
    expect(metrics).not.toContain("platform-app-icon");
    expect(render(card("targets"))).toContain("المؤشرات غير متاحة — لا يعني ذلك صفرًا");
    const failed = render({ ...card("warehouse"), state: "error" });
    expect(failed).toContain("تعذر تحديث المؤشرات");
    expect(failed).toContain("إعادة المحاولة");
  });

  it("keeps return anchors, branch-reset remount, all permitted cards and unchanged daily intervention deck", () => {
    const page = readFileSync(new URL("../../pages/branch-operations.tsx", import.meta.url), "utf8");
    expect(page).toContain("<WorkGroups key={validBoard.branchId} cards={validBoard.cards} expandedCardId={expandedCardId}");
    expect(page).toContain("setExpandedCardId(null)");
    expect(page).toContain('querySelector<HTMLButtonElement>(".branch-ops-card-main")');
    expect(page).toContain("parent instanceof HTMLDetailsElement");
    expect(page).toContain('<DailyWorkspace key={validBoard.branchId} branchId={validBoard.branchId} cards={validBoard.cards} onOpen={go} onRefresh={() => board.refetch()} refreshing={board.isFetching} />');
    const css = readFileSync(new URL("./daily-workspace.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.branch-ops-shell \.branch-ops-function-row \.branch-ops-card-main\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.branch-ops-shell \.branch-ops-function-row \.branch-ops-card-details\s*\{[^}]*min-height:\s*44px/);
    expect(css).toContain(".branch-ops-group-chevron { transition: none; }");
  });
});