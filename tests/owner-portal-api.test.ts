import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { OWNER_IMAGE_NOTICE, OWNER_SALES_STATUSES, ownerDate, ownerDateRange, ownerImageMime, ownerImageReference, ownerPage, ownerSalesResponse, ownerScope, ownerSearch, riyadhToday } from "../server/owner-portal-data";

describe("owner portal query validation", () => {
  it("uses Riyadh day at UTC rollover", () => {
    expect(riyadhToday(new Date("2026-01-01T21:05:00Z"))).toBe("2026-01-02");
  });
  it("rejects malformed, impossible and repeated dates", () => {
    for (const date of ["2026-02-29", "2026-13-01", "2026-1-01", ["2026-01-01"], "0000-01-01"]) expect(() => ownerDate(date)).toThrow();
    expect(ownerDate("2024-02-29")).toBe("2024-02-29");
  });
  it("limits range to 92 days and compares equal calendar days", () => {
    expect(ownerDateRange("2026-01-01", "2026-01-03")).toEqual({ dateFrom: "2026-01-01", dateTo: "2026-01-03", previousFrom: "2025-12-29", previousTo: "2025-12-31" });
    expect(() => ownerDateRange("2026-01-03", "2026-01-01")).toThrow();
    expect(() => ownerDateRange("2026-01-01", "2026-04-02")).not.toThrow();
    expect(() => ownerDateRange("2026-01-01", "2026-04-03")).toThrow();
  });
  it("bounds pagination and searches literal wildcard characters", () => {
    expect(ownerPage(undefined)).toBe(1);
    for (const page of ["0", "-1", "1.5", "100000", ["1"]]) expect(() => ownerPage(page)).toThrow();
    expect(ownerSearch("a%b_c")).toBe("%a\\%b\\_c%");
    expect(() => ownerSearch("a".repeat(101))).toThrow();
  });
});

describe("owner branch isolation", () => {
  it("never grants access from a default branch or a query alone", () => {
    expect(() => ownerScope("business_owner", [], ["default"], { hasAccess: true, branchIds: ["default"] })).toThrow();
    expect(() => ownerScope("business_owner", ["a"], ["a"], { hasAccess: true, branchIds: ["b"] })).toThrow();
    expect(() => ownerScope("business_owner", ["a"], ["a"], { hasAccess: false, branchIds: [] })).toThrow();
  });
  it("intersects explicit grants and effective allowed branches", () => {
    expect(ownerScope("business_owner", ["a", "b", "b"], ["a", "b"], { hasAccess: true, branchIds: ["b"] })).toEqual(["b"]);
    expect(ownerScope("admin", [], null, { hasAccess: true, branchIds: null })).toBeNull();
    expect(() => ownerScope("financial_manager", ["a"], null, { hasAccess: true, branchIds: null })).toThrow();
  });
});

describe("owner reporting semantics and minimized query contract", () => {
  it("matches operational posted and approved journals, excluding drafts and unapproved submissions", () => {
    expect(OWNER_SALES_STATUSES).toEqual(["posted", "approved"]);
  });
  it("distinguishes missing reports from true zero and never includes other branches", () => {
    const result = ownerSalesResponse([{ id: "a", name: "A" }, { id: "b", name: "B" }], [{ branchId: "a", sales: "0", journalCount: 1 }, { branchId: "secret", sales: "999", journalCount: 4 }], [], "2026-01-01", "2026-01-01");
    expect(result.branches[0]).toMatchObject({ sales: 0, status: "reported" });
    expect(result.branches[1]).toMatchObject({ sales: null, status: "missing", previousSales: null });
    expect(result.totals).toEqual({ sales: 0, journalCount: 1, reportedBranches: 1, branchCount: 2, previousSales: null });
  });
  it("registers only protected GET endpoints with private cache policy", () => {
    const source = readFileSync(new URL("../server/owner-portal-routes.ts", import.meta.url), "utf8");
    expect(source).toContain("app.get(path, isAuthenticated, handle)");
    expect(source).toContain('res.setHeader("Cache-Control", "private, no-store")');
    expect(source.match(/get\("\/api\/owner\//g)).toHaveLength(8);
    expect(source).not.toMatch(/app\.(post|put|patch|delete)|db\.(insert|update|delete)|\.select\(\)/);
  });
  it("does not select private financial, identity, personnel or attachment fields", () => {
    const source = readFileSync(new URL("../server/owner-portal-routes.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/shareholders\.(iban|phone|email|nationalId|bankAccountNumber|acquisitionPrice|sharePercentage)/);
    expect(source).not.toMatch(/marketing\w+\.(description|assignedTo|totalBudget|spentBudget|attachments|uploadedBy)/);
    expect(source).not.toMatch(/cashierSalesJournals\.(cashierName|cashierId|actualCashDrawer|openingBalance)/);
    expect(source).toContain("ownerImageReference");
    expect(OWNER_IMAGE_NOTICE).toContain("آمنة");
    expect(source).toContain("isNull(marketingAssets.branchId)");
    expect(source).toContain("limit(OWNER_PAGE_SIZE)");
    expect(source).toContain("::numeric");
  });
});

describe("owner image preview validation", () => {
  it("accepts only narrow internal document and object paths", () => {
    expect(ownerImageReference("/api/documents/file/design_123.png")).toEqual({ provider: "documents", key: "design_123.png" });
    expect(ownerImageReference("/api/uploads/file/photo.jpg")?.provider).toBe("documents");
    expect(ownerImageReference("/objects/uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")?.provider).toBe("objects");
    for (const path of ["https://example.com/a.png", "http://169.254.169.254/a.png", "//localhost/a.png", "/api/uploads/file/../a.png", "/api/uploads/file/%2e%2e/a.png", "/api/uploads/file/a.svg", "/api/uploads/file/a.png?token=secret", "/objects/maintenance-tickets/1/a.png", "/objects/uploads/a/../b"]) expect(ownerImageReference(path)).toBeNull();
  });
  it("rejects HTML/SVG and detects only raster formats from bytes", () => {
    expect(ownerImageMime(Buffer.from("<svg>unsafe content</svg>"))).toBeNull();
    expect(ownerImageMime(Buffer.from("<html>unsafe content</html>"))).toBeNull();
    expect(ownerImageMime(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]))).toBe("image/png");
    expect(ownerImageMime(Buffer.from("RIFF1234WEBP1234"))).toBe("image/webp");
  });
});