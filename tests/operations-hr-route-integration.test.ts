import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { hrHubModule } from "../client/src/lib/hr-hub-route";
import { preloadRoute, resolvePreloadPage } from "../client/src/lib/pagePreloader";
import { attachCenterContext, operationsCenterReturnHref, withMonthlyReturn } from "../client/src/lib/operations-center-navigation";

const loaded = vi.hoisted(() => ({ operations: 0, hr: 0 }));
vi.mock("@/pages/operations-hr", () => {
  loaded.operations++;
  return { default: () => null };
});
vi.mock("@/pages/hr-hub", () => {
  loaded.hr++;
  return { default: () => null };
});

describe("HR hub entry matches its actual role-switched destination", () => {
  it.each([
    ["operations_manager", ["operations_hr"], true],
    ["operations_manager", ["hr_management"], false],
    ["operations_manager", ["operations_hr", "hr_management"], true],
    ["hr_manager", ["hr_management"], true],
    ["hr_manager", ["operations_hr"], false],
    ["employee", [], false],
  ])("checks the destination grant for %s with %j", (role, grants, allowed) => {
    expect((grants as string[]).includes(hrHubModule(role))).toBe(allowed);
  });

  it("uses the same gate in sidebar and center, and passes the fresh role to hover preload", () => {
    const layout = readFileSync("client/src/components/layout.tsx", "utf8");
    const center = readFileSync("client/src/pages/operations-center.tsx", "utf8");
    expect(layout).toMatch(/href: "\/hr-hub"[^\n]*module: hrHubModule\(user\?\.role\)/);
    expect(center).toContain('canOpenEmployees={canView(hrHubModule(user?.role))}');
    expect(layout).toContain("preloadRoute(href, user?.role)");
    expect(layout).toMatch(/preloadRoute\(href, user\?\.role\);[\s\S]*?}, \[user\?\.role\]\);/);
    const app = readFileSync("client/src/App.tsx", "utf8");
    expect(app).toMatch(/path="\/hr-hub"[\s\S]*?user\?\.role === "operations_manager"[\s\S]*?module="operations_hr"[\s\S]*?module="hr_management"/);
  });
});

describe("query-bearing internal source preload", () => {
  const source = "/hr-hub?branchId=one&month=2026-09&tab=payroll#report";
  it("resolves only the destination for the active role and waits when role is unknown", () => {
    expect(resolvePreloadPage(source, "operations_manager")).toBe("operations-hr");
    expect(resolvePreloadPage(source, "hr_manager")).toBe("hr-hub");
    expect(resolvePreloadPage(source)).toBeUndefined();
    expect(resolvePreloadPage(source, null)).toBeUndefined();
    expect(resolvePreloadPage("/sales-analytics?branchId=one&month=2026-09#sales")).toBe("sales-analytics");
  });

  it.each([
    "https://evil.test/hr-hub?branchId=one",
    "//evil.test/hr-hub",
    "/\\evil.test/hr-hub",
    "/hr-hub\n",
    "javascript:alert(1)",
    "/unregistered?path=/hr-hub",
  ])("does not select a page for unsafe or unknown intent %j", href => {
    expect(resolvePreloadPage(href, "operations_manager")).toBeUndefined();
  });

  it("actually loads only one HR page per role and deduplicates query variants", async () => {
    preloadRoute(source);
    expect(loaded).toEqual({ operations: 0, hr: 0 });
    preloadRoute(source, "operations_manager");
    await vi.waitFor(() => expect(loaded.operations).toBe(1));
    expect(loaded.hr).toBe(0);
    preloadRoute("/hr-hub?branchId=two&month=2026-08", "operations_manager");
    expect(loaded.operations).toBe(1);
    preloadRoute(source, "hr_manager");
    await vi.waitFor(() => expect(loaded.hr).toBe(1));
    expect(loaded.operations).toBe(1);
  });
});

describe("existing center breadcrumb is reused rather than duplicated", () => {
  it("retains payroll branch/month/file and revalidates scope on return", () => {
    const origin = "https://bakery.test";
    const destination = new URL(withMonthlyReturn(
      "/hr-hub?branchId=one&month=2026-09&tab=payroll", "one", "2026-09", "payroll", origin,
    ), origin);
    attachCenterContext(destination, "one", ["one", "two"]);
    const back = new URL(operationsCenterReturnHref(destination.search, ["one"]), origin);
    expect(back.searchParams.get("branchIds")).toBe("one");
    expect(back.searchParams.get("monthBranchId")).toBe("one");
    expect(back.searchParams.get("month")).toBe("2026-09");
    expect(back.searchParams.get("monthFile")).toBe("payroll");
    expect(operationsCenterReturnHref(destination.search, [])).toBe("/operations-center");
  });

  it("confirms Layout already renders the authorized source-page breadcrumb", () => {
    expect(readFileSync("client/src/components/layout.tsx", "utf8")).toContain("<BranchOperationsNavigation />");
    const breadcrumb = readFileSync("client/src/components/branch-operations/navigation.tsx", "utf8");
    expect(breadcrumb).toContain('"/hr-hub": { section: "الموظفون"');
    expect(breadcrumb).toContain("operationsCenterReturnHref(window.location.search, branches.map(branch => branch.id))");
  });
});