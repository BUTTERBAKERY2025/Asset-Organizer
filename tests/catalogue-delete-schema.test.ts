import { describe, expect, it, vi } from "vitest";

vi.mock("../server/db", () => ({ db: {}, pool: {} }));

import { catalogueDeletionReferencePolicy } from "../server/catalogue-importer";

describe("catalogue hard-delete schema policy", () => {
  it("classifies every current catalogue semantic identifier and excludes unrelated generic item IDs", () => {
    const productReferences = catalogueDeletionReferencePolicy.semanticReferences.products
      .map((reference) => `${reference.table}.${reference.column}`);
    const warehouseReferences = catalogueDeletionReferencePolicy.semanticReferences.warehouse
      .map((reference) => `${reference.table}.${reference.column}`);

    expect(productReferences).toEqual(["pos_refund_items.product_id"]);
    expect(warehouseReferences).toEqual([]);
    expect(catalogueDeletionReferencePolicy.explicitlyUnrelatedGenericItemIds).toEqual([
      "assembly_resolution_votes.item_id",
      "assembly_revote_grants.item_id",
      "shift_checklist_responses.item_id",
    ]);
  });
});