import { describe, expect, it } from "vitest";
import type { OperationsCard, OperationsQueueItem } from "@shared/operations-center";
import { findSelectedRecord, findSelectedSource, groupOperationsSources, queueQualifier } from "./operations-center-presentation";

const cards = Array.from({ length: 14 }, (_, branch) => Array.from({ length: 14 }, (_, domain) => ({
  id: `domain-${domain}`, branchId: `branch-${branch}`, title: `مجال ${domain}`, module: "تشغيل",
  state: branch === 4 && domain === 2 ? "error" : "ready", href: `/source/${domain}`,
  alerts: [], metrics: [{ key: "measure", label: "كمية", value: branch === 0 ? null : branch - 1, unit: domain % 2 ? "ريال" : "عدد", coverage: branch === 0 ? "unavailable" : "complete", definition: "تجربة", source: "تجربة", period: "اليوم", scope: [`branch-${branch}`], asOf: "2026-10-18T10:00:00Z" }],
} as OperationsCard))).flat();

describe("operations center presentation contracts", () => {
  it("groups a 14 × 14 response into 14 domains without aggregating incomparable values", () => {
    const groups = groupOperationsSources(cards);
    expect(cards).toHaveLength(196);
    expect(groups).toHaveLength(14);
    expect(groups.every(group => group.cards.length === 14)).toBe(true);
    expect(groups[2].cards[0].metrics[0].value).toBeNull();
    expect(groups[2].cards[1].metrics[0].value).toBe(0);
    expect(groups[2].cards[1].metrics[0].coverage).toBe("complete");
    expect(groups[2].cards[0].metrics[0].unit).not.toBe(groups[1].cards[0].metrics[0].unit);
    expect(groups[2]).not.toHaveProperty("total");
  });
  it("selects exact branch and domain, never another branch with the same domain id", () => {
    expect(findSelectedSource(cards, { branchId: "branch-8", cardId: "domain-2" })?.branchId).toBe("branch-8");
    expect(findSelectedSource(cards.filter(card => card.branchId !== "branch-8"), { branchId: "branch-8", cardId: "domain-2" })).toBeNull();
    expect(findSelectedSource(cards, null)).toBeNull();
  });
  it("never replaces a vanished record with the first record", () => {
    const items = [{ id: "one" }, { id: "two" }] as OperationsQueueItem[];
    expect(findSelectedRecord(items, "missing")).toBeNull();
    expect(findSelectedRecord(items, null)).toBeNull();
  });
  it("qualifies counts when the loaded page, pagination, or missing source cannot establish a total", () => {
    expect(queueQualifier(false, null, 0, false)).toContain("المصادر المتاحة");
    expect(queueQualifier(true, null, 0, false)).toContain("الصفحة");
    expect(queueQualifier(false, 25, 0, false)).toContain("الصفحة");
    expect(queueQualifier(false, null, 25, false)).toContain("الصفحة");
    expect(queueQualifier(false, null, 0, true)).toContain("الصفحة");
  });
});