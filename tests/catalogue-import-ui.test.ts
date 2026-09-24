import { describe, expect, it } from "vitest";
import {
  approvalFromDecision,
  aliasDerivedUsageSections,
  buildCatalogueImportApprovals,
  canManuallyAdoptCode,
  selectableCurrentRecords,
  unresolvedCatalogueRows,
  type CatalogueReviewRow,
} from "../client/src/lib/catalogue-import";

const recode: CatalogueReviewRow = {
  namespace: "products",
  status: "review",
  sourceCode: "SK-100",
  sourceName: "Exact bilingual name",
  sourceUnit: "PC",
  matchMethod: "name_recode_review",
  candidateCurrentId: 42,
  candidateCurrentRecord: { id: 42, sku: "AR-42", name: "اسم عربي", unit: "قطعة" },
};

describe("catalogue import admin review helpers", () => {
  it("never turns a review candidate into an automatic identity approval", () => {
    expect(canManuallyAdoptCode(recode)).toBe(true);
    expect(approvalFromDecision(recode, undefined)).toBeNull();
    expect(approvalFromDecision(recode, { action: "defer" })).toBeNull();
  });

  it("emits a bilingual recode only after a manually selected internal ID, identity acknowledgement, and reason", () => {
    expect(approvalFromDecision(recode, { action: "adopt_code" })).toBeNull();
    expect(approvalFromDecision(recode, {
      action: "adopt_code", currentId: 42, identityConfirmed: true,
      reason: "Reviewer manually verified the Arabic current record.",
    })).toEqual({
      namespace: "products",
      action: "adopt_code",
      sourceCode: "SK-100",
      currentId: 42,
      identityAcknowledgement: "MANUAL_IDENTITY_CONFIRMED",
      reason: "Reviewer manually verified the Arabic current record.",
    });
  });

  it("sends alias-derived usage sections only when the reviewer checked returned alias matches", () => {
    const aliasRecode: CatalogueReviewRow = {
      ...recode,
      categories: [
        { category: "Finish bakery", matchedBy: "source_alias" },
        { category: "Breakfast", matchedBy: "source_alias" },
      ],
    };
    expect(approvalFromDecision(aliasRecode, {
      action: "adopt_code", currentId: 42, identityConfirmed: true,
      reason: "Reviewer verified the bilingual source record.",
    })).not.toHaveProperty("approvedAliasSections");
    expect(approvalFromDecision(aliasRecode, {
      action: "adopt_code", currentId: 42, identityConfirmed: true,
      reason: "Reviewer verified the bilingual source record.",
      approvedAliasSections: ["Breakfast", "Finish bakery"],
    })).toMatchObject({
      action: "adopt_code",
      approvedAliasSections: ["Breakfast", "Finish bakery"],
    });
  });

  it("uses only records returned by review as an explicit picker and never preselects a candidate", () => {
    const legacy: CatalogueReviewRow = {
      namespace: "products", status: "legacy_review", sourceCode: null,
      sourceName: null, sourceUnit: null, currentId: 77,
      currentRecord: { id: 77, sku: "OLD-77", name: "Arabic legacy", unit: "piece" },
    };
    expect(selectableCurrentRecords(recode, {}, [legacy]).map((record) => record.id)).toEqual([42, 77]);
    expect(approvalFromDecision(recode, {
      action: "adopt_code", identityConfirmed: true, reason: "No internal ID selected",
    })).toBeNull();
  });

  it("allows a reviewer to explicitly map a code-match/name-mismatch row without treating its source code as an ID", () => {
    const codeMatchWithDifferentName: CatalogueReviewRow = {
      namespace: "products", status: "review", sourceCode: "P-0",
      sourceName: "Bilingual source name", sourceUnit: "PC", matchMethod: "sku",
      currentRecords: [{ id: 8, sku: "P-0", name: "اسم عربي مختلف", unit: "piece" }],
    };
    expect(selectableCurrentRecords(codeMatchWithDifferentName).map((record) => record.id)).toEqual([8]);
    expect(approvalFromDecision(codeMatchWithDifferentName, {
      action: "adopt_code", currentId: 8, identityConfirmed: true,
      reason: "Reviewer confirmed the same business code belongs to current record 8.",
    })).toMatchObject({
      action: "adopt_code", sourceCode: "P-0", currentId: 8,
      identityAcknowledgement: "MANUAL_IDENTITY_CONFIRMED",
    });
  });

  it("requires a reviewer-selected category and an explicit valid availability/price disposition for additions", () => {
    const add: CatalogueReviewRow = {
      namespace: "warehouse", status: "add_candidate", sourceCode: "RM-5",
      sourceName: "Flour", sourceUnit: "KG",
      categories: [
        { category: "Finish bakery", matchedBy: "source_alias" },
        { category: "Storage", matchedBy: "source_alias" },
        { category: "Raw", matchedBy: "canonical_name" },
      ],
    };
    expect(aliasDerivedUsageSections(add)).toEqual(["Finish bakery", "Storage"]);
    expect(approvalFromDecision(add, { action: "add", category: "raw" })).toBeNull();
    expect(approvalFromDecision(add, {
      action: "add", category: "raw", availabilityDisposition: "active_priced", price: 0,
    })).toBeNull();
    expect(approvalFromDecision(add, {
      action: "add", category: "raw", availabilityDisposition: "inactive_pending_price", price: 12,
    })).toBeNull();
    expect(approvalFromDecision(add, {
      action: "add", category: "raw", availabilityDisposition: "active_priced", price: 12.5,
    })).toMatchObject({
      action: "add", sourceCode: "RM-5", category: "raw", availabilityDisposition: "active_priced", price: 12.5,
    });
    expect(approvalFromDecision(add, {
      action: "add", category: "raw", availabilityDisposition: "inactive_pending_price",
    })).toEqual({
      namespace: "warehouse", action: "add", sourceCode: "RM-5", category: "raw",
      availabilityDisposition: "inactive_pending_price",
    });
    expect(approvalFromDecision(add, {
      action: "add", category: "raw", availabilityDisposition: "inactive_pending_price",
      approvedAliasSections: ["Not returned by review"],
    })).toBeNull();
    expect(approvalFromDecision(add, {
      action: "add", category: "raw", availabilityDisposition: "inactive_pending_price",
      approvedAliasSections: ["Storage", "Finish bakery"],
    })).toMatchObject({
      action: "add",
      availabilityDisposition: "inactive_pending_price",
      approvedAliasSections: ["Finish bakery", "Storage"],
    });
  });

  it("requires a legacy acknowledgement and reason for every cleanup decision", () => {
    const legacy: CatalogueReviewRow = {
      namespace: "products", status: "legacy_review", sourceCode: null,
      sourceName: null, sourceUnit: null, currentId: 9,
    };
    expect(approvalFromDecision(legacy, { action: "hard_delete", reason: "checked" })).toBeNull();
    expect(approvalFromDecision(legacy, { action: "hard_delete", legacyReviewed: true })).toBeNull();
    const approvals = buildCatalogueImportApprovals([legacy], {
      "products:legacy:9": { action: "hard_delete", reason: "Reviewed all references", legacyReviewed: true },
    });
    expect(approvals[0]).toMatchObject({ action: "hard_delete", currentId: 9, reviewAcknowledgement: "LEGACY_RECORD_REVIEWED" });
    expect(unresolvedCatalogueRows([legacy], {}).length).toBe(1);
  });

  it("does not require a separately cleaned legacy row once a source adoption explicitly maps that same identity", () => {
    const legacy: CatalogueReviewRow = {
      namespace: "products", status: "legacy_review", sourceCode: null,
      sourceName: null, sourceUnit: null, currentId: 42,
      currentRecord: { id: 42, sku: "OLD-42", name: "Arabic current", unit: "piece" },
    };
    const approvals = buildCatalogueImportApprovals([recode, legacy], {
      "products:source:SK-100": {
        action: "adopt_code", currentId: 42, identityConfirmed: true,
        reason: "Reviewer manually verified the bilingual mapping.",
      },
    });
    expect(approvals).toHaveLength(1);
    expect(unresolvedCatalogueRows([recode, legacy], {
      "products:source:SK-100": {
        action: "adopt_code", currentId: 42, identityConfirmed: true,
        reason: "Reviewer manually verified the bilingual mapping.",
      },
    })).toEqual([]);
  });
});