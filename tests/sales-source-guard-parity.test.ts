import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("sales source guard parity", () => {
  it("uses sales permission for both analytics endpoints, not operations permission", () => {
    const routes = readFileSync("server/routes.ts", "utf8");
    for (const path of ["targets-vs-actuals", "shifts"]) {
      expect(routes).toContain(`app.get("/api/analytics/${path}", isAuthenticated, requirePermission("sales_analytics", "view")`);
    }
  });
  it("authorizes branch opening evidence by its source, not staffing shifts", () => {
    const center = readFileSync("server/operations-center.ts", "utf8");
    expect(center).toMatch(/if \(enabled\("branch_closure"\)\) \{\s*try \{\s*const rows = await db.select\(\{ branchId: branchShifts/);
  });
  it("delegates sales and closing module checks to the authoritative source middleware", () => {
    const code = readFileSync("server/branch-operations.ts", "utf8");
    expect(code).toMatch(/"cashier_journal", "cashier_performance", "daily_closures", "sales_analytics", "branch_closure"\]\.includes\(module\)\)\s*return hasAuthoritativePermission/);
  });
});