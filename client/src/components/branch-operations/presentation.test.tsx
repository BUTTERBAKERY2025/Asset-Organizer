import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BadgeAlert, BriefcaseBusiness, ClipboardCheck, Clock, FileText, Gauge, MessageSquareWarning, PackageCheck, Receipt, Settings2, ShoppingBasket, UsersRound, Warehouse, Wrench } from "lucide-react";
import { BRANCH_OPERATION_ROUTES } from "@/lib/branch-operation-navigation";
import { PlatformAppIcon, type SemanticColor } from "@/components/platform-app-icon";
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

  it("uses full-width sections and uniform, legible tracks without the former count-weighted holes", () => {
    const css = readFileSync(new URL("./daily-workspace.css", import.meta.url), "utf8");
    const page = readFileSync(new URL("../../pages/branch-operations.tsx", import.meta.url), "utf8");
    expect(css).toMatch(/\.branch-ops-shell \.branch-ops-sections\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.branch-ops-shell \.branch-ops-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(css).toMatch(/@container branchops \(min-width: 760px\)/);
    expect(css).toMatch(/@container branchops \(min-width: 1200px\)/);
    expect(css).toMatch(/@container branchops \(min-width: 1450px\)/);
    expect(css).toContain("repeat(3, minmax(0, 1fr))");
    expect(css).toContain("repeat(4, minmax(0, 1fr))");
    expect(css).toContain("repeat(5, minmax(0, 1fr))");
    expect(css).not.toMatch(/\.branch-ops-section[^{}]*\{[^}]*flex(?:-basis)?:/);
    expect(css).not.toMatch(/auto-fill|auto-fit/);
    expect(css).toMatch(/\.branch-ops-shell \.branch-ops-card-title\s*\{[^}]*overflow:\s*visible;[^}]*word-break:\s*normal;[^}]*overflow-wrap:\s*normal/);
    expect(css).toMatch(/\.branch-ops-shell \.platform-app-icon\s*\{\s*width:\s*42px/);
    expect(page).toContain('className="branch-ops-sections"');
    expect(page).toContain("data-card-count={cards.length}");
    expect(page).toContain('dir="rtl"');
  });

  it("retains every actual icon symbol and its exact semantic palette, including unknown-card fallback", () => {
    const icons: Array<[string, typeof Receipt, SemanticColor]> = [
      ["sales", Receipt, "money"], ["cashier", Receipt, "money"],
      ["warehouse", Warehouse, "inventory"], ["attendance", Clock, "people"],
      ["targets", Gauge, "money"], ["closing", BriefcaseBusiness, "money"],
      ["kitchen", ClipboardCheck, "production"], ["purchasing", ShoppingBasket, "inventory"],
      ["waste", PackageCheck, "inventory"], ["maintenance", Wrench, "projects"],
      ["complaints", MessageSquareWarning, "people"], ["employees", UsersRound, "people"],
      ["documents", FileText, "people"], ["advances", BadgeAlert, "people"],
      ["future-module", Settings2, "system"],
    ];
    for (const [id, icon, color] of icons) {
      const html = renderToStaticMarkup(<OperationCardView card={card(id)} section={SECTIONS[0]} onOpen={vi.fn()} onRefresh={vi.fn()} />);
      const originalIcon = renderToStaticMarkup(<PlatformAppIcon icon={icon} color={color} />);
      expect(html).toContain(originalIcon);
    }
    const css = readFileSync(new URL("./daily-workspace.css", import.meta.url), "utf8");
    expect(css).toMatch(/\.platform-app-icon svg\s*\{\s*width:\s*23px;\s*height:\s*23px;\s*\}/);
    expect(css).not.toMatch(/var\(--color-(?:card|muted|foreground|border|background)\)/);
    expect(css).not.toMatch(/\.platform-app-icon[^{}]*\{[^}]*(?:background|color|fill|stroke)\s*:/);
  });

  it("retains the expanded metric/error contracts and all native collapsed sections", () => {
    const html = renderToStaticMarkup(<OperationCardView card={{
      ...card("cashier", "يوميات الكاشير"),
      metrics: [{ label: "مبيعات اليوم", value: 873.5, unit: "ر.س" }],
      statusLabel: "معتمدة", description: "من المصدر المصرح",
    }} section={SECTIONS[1]} expanded onOpen={vi.fn()} onRefresh={vi.fn()} onToggle={vi.fn()} />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('id="branch-operation-card-panel-cashier"');
    expect(html).toContain("873.5 ر.س");
    expect(html).toContain("معتمدة");
    expect(html).toContain("من المصدر المصرح");
    const failed = renderToStaticMarkup(<OperationCardView card={{ ...card("warehouse"), state: "error" }} section={SECTIONS[0]} expanded onOpen={vi.fn()} onRefresh={vi.fn()} />);
    expect(failed).toContain("تعذر تحديث المؤشرات");
    expect(failed).toContain("إعادة المحاولة");
    const page = readFileSync(new URL("../../pages/branch-operations.tsx", import.meta.url), "utf8");
    for (const id of ["branch-operations-section-people", "branch-operations-navigation-only", "branch-operations-push-settings"]) {
      expect(page).toMatch(new RegExp(`<details[^>]*data-testid="${id}"`));
    }
    expect(page).not.toMatch(/<details[^>]*\bopen[=>\s]/);
  });

  it("labels only the mixed branch entry, leaving kitchen-only workflow terminology untouched", () => {
    expect(BRANCH_OPERATION_ROUTES.find(route => route.id === "kitchen")?.label).toBe("طلبيات الفرع");
    const kitchen = readFileSync(new URL("../../pages/central-kitchen-orders.tsx", import.meta.url), "utf8");
    expect(kitchen).toContain('operationsView ? "تشغيل المطبخ اليومي" : "طلبيات الفرع"');
    expect(kitchen).toContain("طلب من المطبخ");
  });
});