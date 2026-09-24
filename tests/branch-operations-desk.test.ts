import { afterAll, describe, expect, it, vi } from "vitest";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { groupCards, requiredActions, dailySalesProgress, DailySalesProgress, DayOverview, QuickActions, NeedsActionStrip, OperationCardView, SECTIONS, type OperationCard } from "../client/src/components/branch-operations/presentation";

const card = (id: string, alerts: OperationCard["alerts"] = []): OperationCard => ({
  id, title: id, group: "operations", href: id === "warehouse" ? "/transfer-requests" : "/central-kitchen-orders", state: "ready", metrics: [], alerts,
});
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
describe("daily branch desk", () => {
  const sales = { ...card("sales"), metrics: [{ label: "مبيعات اليوميات المعتمدة والمرحلة", value: 750, unit: "ر.س" }] };
  const targets = { ...card("targets"), metrics: [{ label: "هدف اليوم المعتمد", value: 1000, unit: "ر.س" }] };
  it("derives progress only from actual approved daily fields and discloses ledger basis", () => {
    expect(dailySalesProgress([sales, targets])).toEqual({ actual: 750, target: 1000, percentage: 75 });
    const html = renderToStaticMarkup(createElement(DailySalesProgress, { cards: [sales, targets] }));
    expect(html).toContain("75");
    expect(html).toContain("مبيعات اليوميات المعتمدة مقابل الهدف");
    expect(html).toContain("مبيعات اليوميات المعتمدة والمرحلة فقط");
  });
  it("labels waste as a count of records, never currency or waste cost", () => {
    const html = renderToStaticMarkup(createElement(DayOverview, { compact: true, cards: [
      { ...card("waste"), metrics: [{ label: "سجلات هدر اليوم", value: 4 }] },
    ] }));
    expect(html).toContain("سجلات هدر");
    expect(html).toContain(">4<");
    expect(html).not.toContain("ر.س");
  });
  it("omits comparison for absent permissions, missing daily records, error, invalid or unapproved target", () => {
    for (const cards of [
      [sales], [targets], [sales, { ...targets, state: "error" as const }],
      [{ ...sales, metrics: [] }, targets], [sales, { ...targets, metrics: [] }],
      [sales, { ...targets, metrics: [{ label: "هدف اليوم المعتمد", unit: "ر.س", value: 0 }] }],
      [sales, { ...targets, metrics: [{ label: "هدف الشهر", unit: "ر.س", value: 1000 }] }],
      [{ ...sales, metrics: [{ ...sales.metrics[0], value: NaN }] }, targets],
    ]) {
      expect(dailySalesProgress(cards)).toBeNull();
      expect(renderToStaticMarkup(createElement(DailySalesProgress, { cards }))).toBe("");
    }
  });
  it("does not show a percentage for a recorded zero and does not cap above-target text", () => {
    const zero = { ...sales, metrics: [{ ...sales.metrics[0], value: 0 }] };
    expect(dailySalesProgress([zero, targets])?.percentage).toBeNull();
    expect(renderToStaticMarkup(createElement(DailySalesProgress, { cards: [zero, targets] }))).not.toContain("%");
    expect(dailySalesProgress([{ ...sales, metrics: [{ ...sales.metrics[0], value: 1250 }] }, targets])?.percentage).toBe(125);
  });
  it("places independently permitted supply and shift cards without inventing absent cards", () => {
    expect(groupCards([card("attendance"), card("warehouse"), card("cashier")]).map(g => g.cards.map(c => c.id)))
      .toEqual([["warehouse"], ["cashier", "attendance"]]);
  });
  it("deduplicates exact repeated alerts, not distinct priorities, counts, or sources sharing a destination", () => {
    const actions = requiredActions([card("kitchen", [
      { label: "normal later", count: 1, href: "/central-kitchen-orders", dueAt: "2026-03-05T00:00:00Z" },
      { label: "normal earlier", count: 1, href: "/central-kitchen-orders", dueAt: "2026-03-01T00:00:00Z" },
      { label: "urgent", count: 1, href: "/central-kitchen-orders?branchId=b", priority: "high" },
      { label: "urgent", count: 1, href: "/central-kitchen-orders?from=branch-operations", priority: "high" },
      { label: "critical", count: 1, href: "/central-kitchen-orders", priority: "critical" },
      { label: "zero", count: 0, href: "/central-kitchen-orders" },
    ])]);
    expect(actions.map(a => a.label)).toEqual(["critical", "urgent", "normal earlier", "normal later"]);
    const shared = requiredActions([
      card("kitchen", [{ label: "المتابعة", count: 2, href: "/central-kitchen-orders", priority: "high" },
        { label: "المتابعة", count: 5, href: "/central-kitchen-orders", priority: "critical" }]),
      card("warehouse", [{ label: "المتابعة", count: 3, href: "/central-kitchen-orders", priority: "high" }]),
    ]);
    expect(shared.map(a => [a.cardId, a.count, a.priority])).toEqual([
      ["kitchen", 5, "critical"], ["kitchen", 2, "high"], ["warehouse", 3, "high"],
    ]);
  });
  it("shows navigation-only links for unknown permissions, and explicit server-granted actions only", () => {
    const html = renderToStaticMarkup(createElement(QuickActions, { cards: [card("kitchen")], onOpen() {} }));
    expect(html).toContain("فتح kitchen");
    expect(html).not.toContain("الاستلام");
    expect(html).not.toContain("طلب احتياجات");
    expect(html).not.toContain("فتح cashier");
    expect(renderToStaticMarkup(createElement(QuickActions, { cards: [], onOpen() {} }))).toBe("");
    const permitted = renderToStaticMarkup(createElement(QuickActions, { cards: [
      { ...card("kitchen"), quickActions: [{ label: "طلب احتياجات", href: "/central-kitchen-orders?intent=create", kind: "create" }] },
      card("warehouse"),
    ], onOpen() {} }));
    expect(permitted).toContain("طلب احتياجات · kitchen");
    expect(permitted).toContain("فتح warehouse");
    expect(permitted).not.toContain("الاستلام");
    expect(renderToStaticMarkup(createElement(QuickActions, { cards: [
      { ...card("kitchen"), state: "error" },
    ], onOpen() {} }))).toBe("");
  });
  it("renders actionable alerts only once, supports navigation-only status and incomplete results", () => {
    const ready = card("kitchen", [{ label: "unique-alert", count: 2, href: "/central-kitchen-orders" }]);
    const failed = { ...card("warehouse"), state: "error" as const };
    const html = renderToStaticMarkup(createElement(NeedsActionStrip, { branchId: "b", cards: [ready, failed], onOpen() {} }));
    expect(html).toContain("القائمة غير مكتملة");
    expect(requiredActions([failed])).toEqual([]);
    const detail = renderToStaticMarkup(createElement(OperationCardView, {
      card: { ...ready, statusLabel: "navigation-status", description: "navigation-detail" },
      section: SECTIONS[0], onOpen() {}, onRefresh() {}, expanded: true,
    }));
    expect(detail).not.toContain("unique-alert");
    expect(detail).toContain("navigation-status");
    expect(detail).toContain("navigation-detail");
    expect(detail).toContain("فتح kitchen");
    expect(detail).toContain('class="group branch-ops-card-main"');
    expect(detail).toContain('aria-label="فتح kitchen"');
    expect(detail).toContain("التفاصيل");
    expect(detail).toContain('aria-controls="branch-operation-card-panel-kitchen"');
  });
  it("keeps primary navigation and the details toggle as separate actions", () => {
    const opened: string[] = [];
    let toggles = 0;
    const view = OperationCardView({
      card: card("kitchen"),
      section: SECTIONS[0],
      onOpen: href => opened.push(href),
      onRefresh() {},
      onToggle: () => { toggles += 1; },
    }) as React.ReactElement<{ children: React.ReactElement<any>[] }>;
    const [primary, details] = view.props.children;
    primary.props.onClick();
    expect(opened).toEqual(["/central-kitchen-orders"]);
    expect(toggles).toBe(0);
    details.props.onClick();
    expect(opened).toEqual(["/central-kitchen-orders"]);
    expect(toggles).toBe(1);
  });
});