import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const { select } = vi.hoisted(() => ({ select: vi.fn() }));
vi.mock("../server/db", () => ({ db: { select } }));
import { comparisonBranchIds, comparisonDate, comparisonEvidence, comparisonRange, buildCanonicalComparisons } from "../server/production-comparison-evidence";
import { comparisonSalesFingerprint, comparisonSalesMetadata } from "../server/comparison-sales-parser";

const dialect = new PgDialect();
const queries: Array<{ table: string; sql: string; params: unknown[] }> = [];
const records: Record<string, unknown[]> = {
  daily_production_batches: [],
  daily_sales_data: [],
  daily_comparisons: [],
  branches: [{ id: "branch-A" }, { id: "branch-B" }],
};

beforeEach(() => {
  queries.length = 0;
  select.mockReset();
  select.mockImplementation(() => ({
    from(table: { [key: symbol]: unknown }) {
      // Drizzle tables expose their own SQL name via the global symbol.
      const name = table[Symbol.for("drizzle:Name")] as string;
      return {
        then(resolve: (rows: unknown[]) => void) { return Promise.resolve(records[name]).then(resolve); },
        where(expression: any) {
          const query = dialect.sqlToQuery(expression);
          queries.push({ table: name, sql: query.sql, params: query.params });
          return Promise.resolve(records[name]);
        },
      };
    },
  }));
});

describe("production comparison evidence (isolated database)", () => {
  it("rejects invalid calendar dates, strings with suffixes and reversed intervals", () => {
    expect(comparisonDate("2025-02-29")).toBe(false);
    expect(comparisonDate("2024-02-29")).toBe(true);
    expect(comparisonDate("2024-01-01' OR true")).toBe(false);
    expect(comparisonRange("2024-02-02", "2024-02-01")).toBe(false);
  });

  it("constrains every source including legacy rows by the entire authorized branch set and range", async () => {
    const result = await comparisonEvidence(["branch-A", "branch-B"], "2024-01-01", "2024-01-31");
    expect(result).toEqual({ finishedBatches: 0, canonicalBatches: 0, nonCanonicalBatches: 0, salesRows: 0, legacyRows: 0 });
    expect(queries).toHaveLength(3);
    for (const query of queries) {
      expect(query.sql).toContain("branch_id");
      expect(query.sql).toContain(" in (");
      expect(query.params).toEqual(expect.arrayContaining(["branch-A", "branch-B", "2024-01-01", "2024-01-31"]));
    }
    expect(queries.find(q => q.table === "daily_production_batches")?.params).toContain("finished");
  });

  it("does not query unscoped sources when access has no branches", async () => {
    expect(await comparisonEvidence([], "2024-01-01", "2024-01-31")).toMatchObject({ salesRows: 0, finishedBatches: 0 });
    expect(queries).toHaveLength(0);
  });

  it("resolves admin all to explicit branch IDs, not an unscoped query", async () => {
    expect(await comparisonBranchIds(null)).toEqual(["branch-A", "branch-B"]);
    expect(await comparisonBranchIds(["branch-A"])).toEqual(["branch-A"]);
  });

  it("marks legacy production missing a canonical product or unit as uncovered", async () => {
    records.daily_production_batches = [
      { productId: 3, unit: "قطعة" }, { productId: null, unit: "قطعة" }, { productId: 4, unit: null },
    ];
    records.daily_sales_data = [{ id: 1 }];
    records.daily_comparisons = [{ id: 99 }];
    expect(await comparisonEvidence(["branch-A"], "2024-01-01", "2024-01-31")).toMatchObject({
      finishedBatches: 3, canonicalBatches: 1, nonCanonicalBatches: 2, salesRows: 1, legacyRows: 1,
    });
    records.daily_production_batches = [];
    records.daily_sales_data = [];
    records.daily_comparisons = [];
  });
  it("matches only full, frozen, canonical row multisets against finished same-day piece batches", () => {
    const frozen = {
      salesDate: "2024-01-01", productName: "خبز", productCategory: null,
      quantitySold: 3, salesValue: 12.32, productId: 8, unit: "piece" as const, catalogUnit: "قطعة",
      sourceProductId: 8, sourceSku: null, sourceUnit: "قطعة", sourceLine: 2,
    };
    const uploads = [{ id: 4, branchId: "branch-A", status: "completed",
      errorMessage: comparisonSalesMetadata(comparisonSalesFingerprint([frozen]), [frozen]) }];
    const sale = { id: 9, branchId: "branch-A", uploadId: 4, salesDate: frozen.salesDate,
      productName: frozen.productName, productCategory: null, quantitySold: 3, salesValue: Math.fround(12.32) };
    const batches = [{ id: 7, branchId: "branch-A", productionDate: "2024-01-01",
      productId: 8, unit: "حبة", quantity: 5, productName: "خبز", productCategory: "مخبوزات" }];
    const catalog = [
      { id: 8, name: "خبز", sku: null, category: "مخبوزات", unit: "قطعة" },
      { id: 9, name: "كيك", sku: null, category: "حلويات", unit: "قطعة" },
    ];
    const matched = buildCanonicalComparisons(batches, [sale], uploads, catalog);
    expect(matched.coverage.comparable).toBe(1);
    expect(matched.rows[0]).toMatchObject({ difference: 2, producedQuantity: 5, soldQuantity: 3,
      wasteValue: null, status: "variance" });
    expect(buildCanonicalComparisons(batches, [{ ...sale, salesValue: 99 }], uploads, catalog).coverage.comparable).toBe(0);
    const tamperedProduct = uploads[0].errorMessage!.replace('"productId":8', '"productId":9');
    expect(buildCanonicalComparisons(batches, [sale], [{ ...uploads[0], errorMessage: tamperedProduct }], catalog).coverage.comparable).toBe(0);
    const tamperedFingerprint = uploads[0].errorMessage!.replace(/"fingerprint":"[0-9a-f]+"/, `"fingerprint":"${"0".repeat(64)}"`);
    expect(buildCanonicalComparisons(batches, [sale], [{ ...uploads[0], errorMessage: tamperedFingerprint }], catalog).coverage.comparable).toBe(0);
    expect(buildCanonicalComparisons(batches, [sale, sale], uploads, catalog).coverage.comparable).toBe(0);
    expect(buildCanonicalComparisons(batches, [sale], [{ ...uploads[0], errorMessage: "sha256:legacy" }], catalog).coverage.comparable).toBe(0);
    expect(buildCanonicalComparisons(batches, [sale], [{ ...uploads[0], branchId: "branch-B" }], catalog).coverage.comparable).toBe(0);
    expect(buildCanonicalComparisons([{ ...batches[0], productionDate: "2024-01-02" }], [sale], uploads, catalog).coverage.comparable).toBe(0);
    expect(buildCanonicalComparisons([{ ...batches[0], unit: "كيلو" }], [sale], uploads, catalog).coverage.comparable).toBe(0);
  });
});