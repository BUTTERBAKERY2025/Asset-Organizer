import { describe, expect, it } from "vitest";
import { SECTIONS, groupCards, type OperationCard } from "../client/src/components/branch-operations/presentation";

const card = (id: string, group: string): OperationCard => ({ id, title: id, group, href: `/${id}`, state: "ready", metrics: [], alerts: [] });

// Server order is deliberately different from the board order to prove the client re-sorts.
const serverCards = ["maintenance", "complaints", "waste", "purchasing", "kitchen", "closing"].map((id) => card(id, "operations"))
  .concat(["targets", "sales"].map((id) => card(id, "sales")), ["employees", "documents", "advances"].map((id) => card(id, "people")));

describe("branch operations board sections", () => {
  it("orders sections by daily work: supply, shift, issues, secondary team", () => {
    const grouped = groupCards(serverCards);
    expect(grouped.map((bucket) => bucket.section.id)).toEqual(["orders", "sales", "operations", "people"]);
    expect(grouped.map((bucket) => bucket.cards.map((c) => c.id))).toEqual([
      ["kitchen", "purchasing"],
      ["sales", "targets", "closing"],
      ["complaints", "maintenance", "waste"],
      ["employees", "documents", "advances"],
    ]);
  });

  it("never drops or duplicates a card and hides empty sections", () => {
    const subset = serverCards.filter((c) => ["waste", "advances"].includes(c.id));
    const grouped = groupCards(subset);
    expect(grouped.map((bucket) => bucket.section.id)).toEqual(["operations", "people"]);
    expect(grouped.flatMap((bucket) => bucket.cards.map((c) => c.id)).sort()).toEqual(["advances", "waste"]);
    expect(groupCards([])).toEqual([]);
  });

  it("appends unknown future cards to the section matching their server group", () => {
    const grouped = groupCards([...serverCards, card("deliveries", "people"), card("mystery", "unknown-group")]);
    const byId = Object.fromEntries(grouped.map((bucket) => [bucket.section.id, bucket.cards.map((c) => c.id)]));
    expect(byId.people).toEqual(["employees", "documents", "advances", "deliveries"]);
    expect(byId.operations).toEqual(["complaints", "maintenance", "waste", "mystery"]);
    expect(grouped.flatMap((bucket) => bucket.cards)).toHaveLength(serverCards.length + 2);
  });

  it("every section card id is unique across the board definition", () => {
    const ids = SECTIONS.flatMap((section) => section.cardIds);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
