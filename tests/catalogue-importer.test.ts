import { describe, expect, it, vi } from "vitest";

// Planner tests intentionally exercise no database path. The import service is
// covered against PostgreSQL in catalogue-importer.local-pg.integration.test.ts.
vi.mock("../server/db", () => ({ db: {}, pool: {} }));
import {
  CatalogueImportError,
  createStagedCataloguePlan,
} from "../server/catalogue-importer";
import { buildCatalogueReconciliation } from "../scripts/catalog-reconciliation";

const sourceChecksum = "a".repeat(64);
const snapshotChecksum = "b".repeat(64);
const targetIdentity = "c".repeat(64);

function reconciliation() {
  return buildCatalogueReconciliation({
    products: [
      { code: "P-EXACT", name: "Exact", unit: "PC" },
      { code: "P-RECODE", name: "Recode", unit: "PC" },
      { code: "P-NEW", name: "New", unit: "PC" },
    ],
    warehouse: [],
    categories: [
      { name: "Exact", category: "Bakery" },
      { name: "Recode", category: "Bakery" },
      { name: "New", category: "Pastry" },
    ],
    currentProducts: [
      { id: 1, sku: "P-EXACT", name: "Exact", unit: "قطعة", basePrice: 19, stock: 13 },
      { id: 2, sku: "F-2", name: "Recode", unit: "piece", basePrice: 21, stock: 8 },
      { id: 3, sku: "F-OLD", name: "Old", unit: "piece", basePrice: 30, stock: 4 },
    ],
    currentWarehouse: [],
  });
}

describe("authoritative catalogue staged planner", () => {
  it("is dry-run by default and never turns a name candidate into an action", () => {
    const plan = createStagedCataloguePlan({
      reconciliation: reconciliation(),
      targetId: "confirmed-local-target",
      targetIdentity,
      sourceChecksum,
      snapshotChecksum,
      approvals: [],
    });

    expect(plan.operations).toEqual([
      expect.objectContaining({
        namespace: "products",
        action: "keep",
        sourceCode: "P-EXACT",
        currentId: 1,
        usageSections: ["Bakery"],
      }),
    ]);
    expect(plan.reviewRequiredCount).toBe(3);
    expect(plan.operations.some((operation) => operation.action === "adopt_code")).toBe(false);
  });

  it("requires an explicit approved recode and does not alter prices or stock in its plan", () => {
    const plan = createStagedCataloguePlan({
      reconciliation: reconciliation(),
      targetId: "confirmed-local-target",
      targetIdentity,
      sourceChecksum,
      snapshotChecksum,
      approvals: [
        {
          namespace: "products",
          action: "adopt_code",
          sourceCode: "P-RECODE",
          currentId: 2,
          identityAcknowledgement: "MANUAL_IDENTITY_CONFIRMED",
          reason: "Reviewer confirmed existing Arabic catalogue identity",
        },
        {
          namespace: "products", action: "add", sourceCode: "P-NEW", category: "pastry",
          availabilityDisposition: "inactive_pending_price",
        },
        {
          namespace: "products",
          action: "defer",
          currentId: 3,
          reason: "Historical product retained pending separate retirement review",
          reviewAcknowledgement: "LEGACY_RECORD_REVIEWED",
        },
      ],
    });

    expect(plan.reviewRequiredCount).toBe(0);
    expect(plan.operations).toContainEqual(expect.objectContaining({
      action: "adopt_code", currentId: 2, sourceCode: "P-RECODE",
    }));
    expect(plan.operations).toContainEqual(expect.objectContaining({
      action: "add", sourceCode: "P-NEW", category: "pastry",
    }));
    expect(JSON.stringify(plan.operations)).not.toContain("basePrice");
    expect(JSON.stringify(plan.operations)).not.toContain("stock");
  });

  it("adds a source-alias usage section only when the reviewer selects that exact row match", () => {
    const result = reconciliation();
    const source = result.productRows.find((row) => row.sourceCode === "P-NEW")!;
    (source.categoryMatches as any[]).push({
      ...source.categoryMatches[0],
      category: "Finish bakery",
      matchedBy: "source_alias",
    });
    const plan = createStagedCataloguePlan({
      reconciliation: result,
      targetId: "confirmed-local-target",
      targetIdentity,
      sourceChecksum,
      snapshotChecksum,
      approvals: [{
        namespace: "products",
        action: "add",
        sourceCode: "P-NEW",
        category: "pastry",
        availabilityDisposition: "inactive_pending_price",
        approvedAliasSections: ["Finish bakery"],
      }],
    });
    expect(plan.operations).toContainEqual(expect.objectContaining({
      action: "add",
      sourceCode: "P-NEW",
      usageSections: ["Finish bakery", "Pastry"],
    }));
    expect(() => createStagedCataloguePlan({
      reconciliation: result,
      targetId: "confirmed-local-target",
      targetIdentity,
      sourceChecksum,
      snapshotChecksum,
      approvals: [{
        namespace: "products",
        action: "add",
        sourceCode: "P-NEW",
        category: "pastry",
        availabilityDisposition: "inactive_pending_price",
        approvedAliasSections: ["Unreviewed section"],
      }],
    })).toThrow("قسم الاسم البديل");
  });

  it("allows an ambiguous Arabic/bilingual recode only with explicit confirmation and equal units", () => {
    const result = buildCatalogueReconciliation({
      products: [{ code: "P-1", name: "Same", unit: "PC" }],
      warehouse: [],
      categories: [{ name: "Same", category: "Bakery" }],
      currentProducts: [
        { id: 1, sku: "F-1", name: "Same", unit: "piece" },
        { id: 2, sku: "F-2", name: "same", unit: "piece" },
      ],
      currentWarehouse: [],
    });
    const plan = createStagedCataloguePlan({
      reconciliation: result,
      targetId: "confirmed-local-target",
      targetIdentity,
      sourceChecksum,
      snapshotChecksum,
      approvals: [{
        namespace: "products",
        action: "adopt_code",
        sourceCode: "P-1",
        currentId: 1,
        identityAcknowledgement: "MANUAL_IDENTITY_CONFIRMED",
        reason: "Attempted ambiguous candidate",
      }],
    });
    expect(plan.operations).toContainEqual(expect.objectContaining({
      action: "adopt_code", sourceCode: "P-1", currentId: 1,
    }));

    const incompatible = buildCatalogueReconciliation({
      products: [{ code: "P-KG", name: "Bilingual flour", unit: "KG" }],
      warehouse: [],
      categories: [{ name: "Bilingual flour", category: "Bakery" }],
      currentProducts: [{ id: 9, sku: "F-9", name: "دقيق", unit: "piece" }],
      currentWarehouse: [],
    });
    expect(() => createStagedCataloguePlan({
      reconciliation: incompatible,
      targetId: "confirmed-local-target",
      targetIdentity,
      sourceChecksum,
      snapshotChecksum,
      approvals: [{
        namespace: "products",
        action: "adopt_code",
        sourceCode: "P-KG",
        currentId: 9,
        identityAcknowledgement: "MANUAL_IDENTITY_CONFIRMED",
        reason: "Incorrect unit cannot be reinterpreted",
      }],
    })).toThrow(CatalogueImportError);
  });

  it("requires explicit reviewed legacy cleanup and makes hard deletion auditable", () => {
    const result = buildCatalogueReconciliation({
      products: [],
      warehouse: [],
      categories: [],
      currentProducts: [{ id: 8, sku: "F-8", name: "Legacy", unit: "piece" }],
      currentWarehouse: [],
    });
    expect(() => createStagedCataloguePlan({
      reconciliation: result,
      targetId: "confirmed-local-target",
      targetIdentity,
      sourceChecksum,
      snapshotChecksum,
      approvals: [{ namespace: "products", action: "hard_delete", currentId: 8, reason: "unused" }],
    })).toThrow("يلزم إقرار");

    const plan = createStagedCataloguePlan({
      reconciliation: result,
      targetId: "confirmed-local-target",
      targetIdentity,
      sourceChecksum,
      snapshotChecksum,
      approvals: [{
        namespace: "products",
        action: "hard_delete",
        currentId: 8,
        reason: "No references after reviewer inspection; apply must prove again",
        reviewAcknowledgement: "LEGACY_RECORD_REVIEWED",
      }],
    });
    expect(plan.rollbackPlan.irreversibleHardDeletes).toBe(1);
  });
});