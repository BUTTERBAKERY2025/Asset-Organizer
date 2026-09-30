import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BRANCH_OPERATION_ROUTES } from "@/lib/branch-operation-navigation";
import { OperationCardView, SectionHeader, SECTIONS, groupCards, type OperationCard } from "./presentation";

const card = (id: string, title = id): OperationCard => ({
  id, title, group: "operations", href: "/central-kitchen-orders", state: "ready",
  metrics: [], alerts: [],
});

describe("branch operations compact grouped board", () => {
  it("keeps sparse groups and their Arabic headings without inventing tiles", () => {
    const grouped = groupCards([card("kitchen", "طلبيات الفرع"), card("cashier"), card("waste")]);
    expect(grouped.map(({ section, cards }) => [section.id, cards.length])).toEqual([
      ["orders", 1], ["sales", 1], ["operations", 1],
    ]);
    const header = renderToStaticMarkup(<SectionHeader section={SECTIONS[0]} count={1} />);
    expect(header).toContain("التوريد والاستلام");
    expect(header).toContain('aria-label="1 صفحات عمل"');
  });

  it("keeps the tile navigation and details controls independently accessible", () => {
    const html = renderToStaticMarkup(<OperationCardView card={card("kitchen", "طلبيات الفرع")} section={SECTIONS[0]} onOpen={vi.fn()} onRefresh={vi.fn()} onToggle={vi.fn()} />);
    expect(html).toContain('aria-label="فتح طلبيات الفرع"');
    expect(html).toContain('aria-label="عرض تفاصيل طلبيات الفرع"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("branch-ops-card-main");
  });

  it("uses compact width-aware sections, capped singleton tiles, and smaller icons at every width", () => {
    const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");
    const page = readFileSync(new URL("../../pages/branch-operations.tsx", import.meta.url), "utf8");
    expect(css).toMatch(/\.branch-ops-sections\s*\{[^}]*flex-wrap:\s*wrap/s);
    expect(css).toMatch(/\.branch-ops-section\[data-card-count="1"\]\s*\{\s*flex:\s*0 1/);
    expect(css).toMatch(/\.branch-ops-grid\s*>\s*\.branch-ops-card\s*\{\s*max-width:/);
    expect(css).toMatch(/@container branchops \(min-width: 380px\)/);
    expect(css).toMatch(/@container branchops \(min-width: 760px\)/);
    expect(css).toMatch(/\.branch-ops-shell \.platform-app-icon\s*\{\s*width:\s*42px/);
    expect(page).toContain('className="branch-ops-sections"');
    expect(page).toContain("data-card-count={cards.length}");
    expect(page).toContain('dir="rtl"');
  });

  it("labels only the mixed branch entry, leaving kitchen-only workflow terminology untouched", () => {
    expect(BRANCH_OPERATION_ROUTES.find(route => route.id === "kitchen")?.label).toBe("طلبيات الفرع");
    const kitchen = readFileSync(new URL("../../pages/central-kitchen-orders.tsx", import.meta.url), "utf8");
    expect(kitchen).toContain('operationsView ? "تشغيل المطبخ اليومي" : "طلبيات الفرع"');
    expect(kitchen).toContain("طلب من المطبخ");
  });
});