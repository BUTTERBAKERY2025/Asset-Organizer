import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { DayOverview, NeedsActionStrip, OperationCardView, SECTIONS, partitionActions, type OperationCard } from "../client/src/components/branch-operations/presentation";

vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
const card = (overrides: Partial<OperationCard> = {}): OperationCard => ({
  id: "kitchen", title: "المطبخ", group: "operations", href: "/central-kitchen-orders",
  state: "ready", metrics: [], alerts: [], ...overrides,
});
const render = (cards: OperationCard[], routine = false) => renderToStaticMarkup(createElement(NeedsActionStrip, { branchId: "b", cards, routine, onOpen() {} }));
describe("priority desk components", () => {
  it("renders disjoint NOW and routine topics, not a mixed record total", () => {
    const cards = [card({ alerts: [
      { label: "urgent-topic", count: 31, href: "/central-kitchen-orders", priority: "critical" },
      { label: "routine-topic", count: 12, href: "/central-kitchen-orders", priority: "low" },
      { label: "default-topic", count: 4, href: "/central-kitchen-orders" },
    ] })];
    expect(partitionActions(cards).now).toHaveLength(1);
    expect(partitionActions(cards).routine).toHaveLength(2);
    expect(render(cards)).toContain("1 موضوع متابعة");
    expect(render(cards)).not.toContain("routine-topic");
    expect(render(cards, true)).not.toContain("urgent-topic");
    expect(render(cards, true)).toContain("2 موضوع متابعة");
  });
  it("uses oldest-topic date and navigation-safe labels, never mutation promises", () => {
    const html = render([card({ alerts: [{ label: "topic", count: 2, href: "/central-kitchen-orders", priority: "high", dueAt: "2026-03-01T10:00:00Z", actionLabel: "اعتماد نهائي" }] })]);
    expect(html).toContain("أقدم موعد ضمن الموضوع");
    expect(html).toContain("فتح المتابعة");
    expect(html).not.toContain("اعتماد نهائي");
  });
  it("never calls empty, link-only or failed sources complete", () => {
    for (const cards of [[], [card()], [card({ state: "error" })]]) {
      const html = render(cards);
      expect(html).not.toContain("لا توجد إجراءات معلقة");
      expect(html).not.toContain("يوم العمل مكتمل");
    }
    expect(render([card({ id: "maintenance" })])).toContain("روابط تنقل فقط");
    expect(render([card({ state: "error" })])).toContain("القائمة غير مكتملة");
  });
  it("keeps each compact urgent follow-up on its own full row with a 44px action", () => {
    const html = renderToStaticMarkup(createElement(NeedsActionStrip, { branchId: "b", compact: true, onOpen() {}, cards: [card({
      alerts: [
        { label: "one", count: 1, href: "/central-kitchen-orders", priority: "critical" },
        { label: "two", count: 2, href: "/central-kitchen-orders?tab=two", priority: "high" },
        { label: "three", count: 3, href: "/central-kitchen-orders?tab=three", priority: "high" },
        { label: "four", count: 4, href: "/central-kitchen-orders?tab=four", priority: "critical" },
      ],
    })] }));
    expect((html.match(/branch-ops-compact-action"/g) ?? []).length).toBe(4);
    expect(html).toContain("branch-ops-followup");
  });
  it("renders ready exact-unit metrics with unknown distinct from measured zero", () => {
    const html = renderToStaticMarkup(createElement(DayOverview, { cards: [
      card({ id: "sales", metrics: [{ label: "مبيعات اليوميات المعتمدة والمرحلة", value: 0, unit: "ر.س" }] }),
      card({ id: "targets" }),
      card({ id: "waste", state: "error", metrics: [{ label: "سجلات هدر اليوم", value: 9 }] }),
    ] }));
    expect(html).toContain("0 ر.س");
    expect(html).toContain("غير متاح");
    expect(html).not.toContain("سجلات هدر اليوم");
    expect(renderToStaticMarkup(createElement(DayOverview, { cards: [] }))).toBe("");
  });
  it("marks navigation-only cards without treating zero metrics as navigation-only", () => {
    const markup = (value: OperationCard, expanded = false) => renderToStaticMarkup(createElement(OperationCardView, { card: value, section: SECTIONS[0], onOpen() {}, onRefresh() {}, expanded }));
    expect(markup(card({ id: "maintenance" }))).not.toContain("رابط تنقل فقط");
    expect(markup(card({ id: "maintenance" }), true)).toContain("رابط تنقل فقط");
    expect(markup(card({ id: "targets" }), true)).toContain("المؤشرات غير متاحة");
    expect(markup(card({ metrics: [{ label: "count", value: 0 }] }), true)).not.toContain("رابط تنقل فقط");
  });
});