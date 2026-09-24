import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const complaintsSource = read("../client/src/pages/branch-complaints.tsx");
const cashierSource = read("../client/src/pages/cashier-journals.tsx");
const routesSource = read("../server/routes.ts");
const storageSource = read("../server/storage.ts");

describe("daily board linked filter cache identities", () => {
  it("keeps overdue-only complaint navigation in list cache identity and request", () => {
    expect(complaintsSource).toContain(
      'queryKey: ["/api/branch-complaints", branchId, page, status, priority, overdueOnly]',
    );
    expect(complaintsSource).toContain('if (overdueOnly) query.set("overdue", "true")');
    expect(complaintsSource).toContain(
      "branchId === navigation.branchId",
    );
  });

  it("keeps discrepancy in both cashier list and KPI cache identities and requests", () => {
    expect(cashierSource).toContain(
      'queryKey: ["/api/cashier-journals", branchFilter, statusFilter, discrepancyFilter, cashierFilter, debouncedSearch, dateFrom, dateTo, currentPage]',
    );
    expect(cashierSource).toContain(
      'queryKey: ["/api/cashier-journals/stats/summary", branchFilter, statusFilter, discrepancyFilter, cashierFilter, debouncedSearch, dateFrom, dateTo]',
    );
    expect(cashierSource.match(
      /params\.set\("discrepancyStatus", discrepancy\)/g,
    )).toHaveLength(2);
  });
});

describe("cashier list and KPI filter equivalence", () => {
  it("forwards discrepancy through the scoped stats route before aggregation", () => {
    const statsRoute = routesSource.slice(
      routesSource.indexOf('app.get("/api/cashier-journals/stats/summary"'),
      routesSource.indexOf("// Get all payment breakdowns", routesSource.indexOf('app.get("/api/cashier-journals/stats/summary"')),
    );

    expect(statsRoute).toContain(
      'if (discrepancyStatus && discrepancyStatus !== "all") filters.discrepancyStatus = String(discrepancyStatus);',
    );
    expect(statsRoute.indexOf("filters.branchIds = allowedBranches")).toBeLessThan(
      statsRoute.indexOf("getCashierJournalStatsSummary(filters)"),
    );
    expect(statsRoute.indexOf("filters.cashierId = String(user.id)")).toBeLessThan(
      statsRoute.indexOf("getCashierJournalStatsSummary(filters)"),
    );
  });

  it("applies the same discrepancy predicate to list rows and KPI aggregation", () => {
    const predicate =
      "conditions.push(eq(cashierSalesJournals.discrepancyStatus, filters.discrepancyStatus))";
    expect(storageSource.split(predicate)).toHaveLength(3);
  });
});