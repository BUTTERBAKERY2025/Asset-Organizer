import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { branchDeskActionUrl, branchDeskDate, branchOperationUrl, branchBoardUrl } from "../client/src/lib/branch-operation-navigation";

describe("branch desk destination intents", () => {
  it("separates supplier creation and receipt without losing scope", () => {
    expect(branchOperationUrl(branchDeskActionUrl("/central-kitchen-orders", "receive"), "b"))
      .toBe("/central-kitchen-orders?stage=dispatched&branchId=b&from=branch-operations");
    expect(branchDeskActionUrl("/transfer-requests", "receive")).toBe("/transfer-requests?status=in_transit&direction=incoming");
    expect(branchDeskActionUrl("/central-kitchen-orders", "create")).toBe("/central-kitchen-orders?intent=create");
    expect(branchDeskActionUrl("/transfer-requests", "create")).toBe("/transfer-requests?intent=create");
  });
  it("uses the existing cashier form and waste editor, never a new workflow", () => {
    expect(branchOperationUrl(branchDeskActionUrl("/cashier-journals", "create"), "b")).toContain("/cashier-journals/new?branchId=b");
    expect(branchBoardUrl("b", "/cashier-journals/new")).toBe("/branch-operations?branchId=b#branch-operation-card-cashier");
    expect(branchDeskActionUrl("/display-bar-waste", "create")).toBe("/display-bar-waste?tab=waste");
  });
  it("retains every server alert filter and rejects non-calendar dates", () => {
    expect(branchOperationUrl("/cashier-journals?status=rejected&startDate=2026-09-01&endDate=2026-09-01", "b"))
      .toContain("status=rejected&startDate=2026-09-01&endDate=2026-09-01&branchId=b");
    expect(branchDeskDate("2026-02-30")).toBe("");
    expect(branchDeskDate("2026-09-01")).toBe("2026-09-01");
    expect(branchDeskDate("bad")).toBe("");
  });
  it("consumes only matching authorized branch intents before opening existing UI", () => {
    const source = readFileSync("client/src/hooks/use-branch-desk-intent.ts", "utf8");
    expect(source).toContain('params.get("branchId") !== branchId');
    expect(source).toContain('params.get("from") !== "branch-operations"');
    expect(source.indexOf('params.delete("intent")')).toBeLessThan(source.indexOf("onIntent(intent)"));
    expect(source).not.toContain("fetch(");
  });
});