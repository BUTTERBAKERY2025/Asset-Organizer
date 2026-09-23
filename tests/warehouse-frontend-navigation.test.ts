import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveNavigationBranch } from "../client/src/hooks/use-branch-navigation";

const page = (name: string) =>
  readFileSync(new URL(`../client/src/pages/${name}.tsx`, import.meta.url), "utf8");

describe("warehouse frontend navigation and permissions", () => {
  it("keeps branch links query-based, encoded, and authorized", () => {
    expect(resolveNavigationBranch("?branchId=north%20%26%20west", [
      { id: "north & west" },
      { id: "south" },
    ])).toEqual({ hasBranchParam: true, branchId: "north & west" });
    expect(resolveNavigationBranch("?branchId=forbidden", [{ id: "south" }]))
      .toEqual({ hasBranchParam: true, branchId: "south" });

    const dashboard = page("warehouse-dashboard");
    expect(dashboard).toContain("`/branch-stock${branchQuery}`");
    expect(dashboard).toContain("`/warehouse-inventory${branchQuery}`");
    expect(dashboard).not.toMatch(/branch-stock\\?\/\\$\\{selectedBranch\\}/);
    expect(dashboard).toContain("navigate(`/warehouse${");
  });

  it("uses the warehouse API permission module for item mutations", () => {
    const inventory = page("warehouse-inventory");
    expect(inventory).toContain('canCreate("warehouse")');
    expect(inventory).toContain('canEdit("warehouse")');
    expect(inventory).toContain('canDelete("warehouse")');
    expect(inventory).not.toMatch(/can(?:Create|Edit|Delete)\("warehouse_inventory"\)/);

    const purchasing = page("purchasing-requests");
    expect(purchasing).toContain('canCreate("warehouse")');
    expect(purchasing).toContain('canEdit("warehouse")');
    expect(purchasing).toContain('canExport("warehouse")');
  });

  it("retains canonical warehouse back links and explicit global stock scope", () => {
    expect(page("branch-stock")).toContain("`/warehouse?branchId=${encodeURIComponent(selectedBranch)}`");
    expect(page("warehouse-movement-logs")).toContain("<Link href={`/warehouse${branchQuery}`}>");
    expect(page("warehouse-inventory")).toContain("global-stock-scope");
  });
});