import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync("client/src/pages/platform-home.tsx", "utf8");
const demandSource = readFileSync("client/src/pages/central-kitchen-demand-report.tsx", "utf8");

describe("reliability page contracts", () => {
  it("keys and requests the employee count by the actual countOnly URL", () => {
    expect(homeSource).toContain('queryKey: ["/api/branch-employees?countOnly=true"]');
    expect(homeSource).toContain('apiRequest("GET", "/api/branch-employees?countOnly=true")');
    expect(homeSource).not.toContain('"/api/branch-employees/count"');
  });

  it("keeps the dashboard branch key and permission-based sales gate", () => {
    expect(homeSource).toContain('queryKey: ["/api/dashboard/stats", activeBranch?.id]');
    expect(homeSource).toContain("const canViewSales =");
    expect(homeSource).toContain('{canViewSales && (');
  });

  it("lets both demand reads inherit bounded global transient retry", () => {
    const reportQuery = demandSource.match(/const report = useQuery[^;]+;/)?.[0] ?? "";
    const candidatesQuery = demandSource.match(/const candidates = useQuery[^;]+;/)?.[0] ?? "";
    expect(reportQuery).not.toContain("retry:");
    expect(candidatesQuery).not.toContain("retry:");
    expect(demandSource).toContain("لم تُفترض بيانات بديلة");
  });
});