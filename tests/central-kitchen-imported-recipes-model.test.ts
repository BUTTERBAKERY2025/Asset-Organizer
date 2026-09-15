import { describe, expect, it } from "vitest";
import {
  buildImportNotes,
  canReviewImportedRecipes,
  canonicalRecipeUnit,
  groupImportedIngredients,
  isBoxToPieceOutputEquivalence,
  prepareImportedRecipe,
  recipeMatchesImportSource,
  sameRecipeUnit,
  validateImportedReview,
  type ImportedRecipeReview,
  type ImportedRecipeSource,
} from "../client/src/components/central-kitchen/imported-recipes-model";
import { mapPastryRecipeImportSources } from "../server/central-kitchen-recipe-import";

const products = [{ id: 1, name: "Cake", unit: "piece" }];
const materials = [{ id: 2, name: "Flour", unit: "kg" }];

function source(overrides: Partial<ImportedRecipeSource> = {}): ImportedRecipeSource {
  return {
    sourceId: "pastry-test",
    name: "Test source",
    outputQuantity: 5,
    outputUnit: "piece",
    rawSourceText: "Cake",
    productId: null,
    ingredients: [{
      sourceName: "Flour",
      sourceQuantity: "1",
      sourceUnit: "kg",
      warehouseItemId: 2,
      quantity: 1,
      unit: "kg",
      issue: null,
    }],
    issues: [],
    ...overrides,
  };
}

function review(overrides: Partial<ImportedRecipeReview> = {}): ImportedRecipeReview {
  return {
    sourceId: "pastry-test",
    productId: "1",
    outputQuantity: "5",
    ingredients: [{
      rowId: "source:0",
      sourceName: "Flour",
      sourceQuantity: "1",
      sourceUnit: "kg",
      warehouseItemId: "2",
      quantity: "1",
      issue: null,
      quantityEdited: false,
      issueAcknowledged: false,
      numericAcknowledged: false,
    }],
    removedSourceRows: [],
    acknowledgedSourceIssues: [],
    notes: "",
    ...overrides,
  };
}

describe("imported recipe review model", () => {
  it("does not allow a missing yield or product to become a placeholder", () => {
    const errors = validateImportedReview(
      source({ outputQuantity: null, outputUnit: null }),
      review({ productId: "", outputQuantity: "" }),
      products,
      materials,
    );
    expect(errors.join(" ")).toContain("منتج");
    expect(errors.join(" ")).toContain("كمية إخراج");
  });

  it("requires an edit and acknowledgement for a unit conversion that is not inferred", () => {
    const imported = source({
      ingredients: [{
        sourceName: "Milk",
        sourceQuantity: "500",
        sourceUnit: "g",
        warehouseItemId: null,
        quantity: null,
        unit: null,
        issue: "UNRESOLVED: source unit cannot be converted safely",
      }],
    });
    const base = review({
      ingredients: [{
        rowId: "source:0",
        sourceName: "Milk",
        sourceQuantity: "500",
        sourceUnit: "g",
        warehouseItemId: "3",
        quantity: "2",
        issue: "UNRESOLVED: source unit cannot be converted safely",
        quantityEdited: true,
        issueAcknowledged: false,
        numericAcknowledged: false,
      }],
    });
    const materialsWithMilk = [...materials, { id: 3, name: "Milk", unit: "litre" }];
    expect(validateImportedReview(imported, base, products, materialsWithMilk).length).toBeGreaterThan(0);
    const resolved = {
      ...base,
      ingredients: [{ ...base.ingredients[0], issueAcknowledged: true, numericAcknowledged: true }],
      acknowledgedSourceIssues: ["ingredient:0"],
    };
    expect(validateImportedReview(imported, resolved, products, materialsWithMilk)).toEqual([]);
  });

  it("sums duplicate material lines using exact six-decimal quantities", () => {
    expect(groupImportedIngredients([
      { warehouseItemId: 9, quantity: "0.100001" },
      { warehouseItemId: 9, quantity: "0.200002" },
      { warehouseItemId: 3, quantity: "2" },
    ])).toEqual([
      { warehouseItemId: 9, quantity: "0.300003" },
      { warehouseItemId: 3, quantity: "2" },
    ]);
  });

  it("gives review access only when both view and create are granted", () => {
    expect(canReviewImportedRecipes(false, true)).toBe(false);
    expect(canReviewImportedRecipes(true, false)).toBe(false);
    expect(canReviewImportedRecipes(true, true)).toBe(true);
  });

  it("compares only supported localized dimensions and keeps grams distinct", () => {
    expect(canonicalRecipeUnit("كجم")).toBe("kg");
    expect(canonicalRecipeUnit("كيلو")).toBe("kg");
    expect(canonicalRecipeUnit("قطعة")).toBe("piece");
    expect(canonicalRecipeUnit("لتر")).toBe("litre");
    expect(sameRecipeUnit("kg", "كجم")).toBe(true);
    expect(sameRecipeUnit("piece", "قطعة")).toBe(true);
    expect(sameRecipeUnit("litre", "لتر")).toBe(true);
    expect(sameRecipeUnit("g", "كجم")).toBe(false);
    expect(sameRecipeUnit("litre", "قطعة")).toBe(false);
    expect(isBoxToPieceOutputEquivalence("box", "قطعة")).toBe(true);
    expect(isBoxToPieceOutputEquivalence("piece", "قطعة")).toBe(false);
  });

  it("prepares an actual mapped pastry recipe against Arabic catalog units", () => {
    const catalog = {
      products: [{ id: 101, name: "Chocolate Cookies", unit: "قطعة" }],
      materials: [
        { id: 201, name: "Butter", unit: "كجم" },
        { id: 202, name: "Brown Sugar", unit: "كجم" },
        { id: 203, name: "Egg", unit: "قطعة" },
        { id: 204, name: "Flour", unit: "كجم" },
        { id: 205, name: "Baking Powder", unit: "كجم" },
        { id: 206, name: "Baking Soda", unit: "كجم" },
        { id: 207, name: "Dark Chocolate", unit: "كجم" },
      ],
    };
    const mapped = mapPastryRecipeImportSources(catalog);
    const imported = mapped.find(item => item.sourceId === "pastry-choclate-cookies")!;
    const reviewInput: ImportedRecipeReview = {
      sourceId: imported.sourceId,
      productId: String(imported.productId),
      outputQuantity: String(imported.outputQuantity),
      ingredients: imported.ingredients.map((ingredient, index) => ({
        rowId: `source:${index}`,
        sourceName: ingredient.sourceName,
        sourceQuantity: ingredient.sourceQuantity,
        sourceUnit: ingredient.sourceUnit,
        warehouseItemId: String(ingredient.warehouseItemId),
        quantity: String(ingredient.quantity),
        issue: ingredient.issue,
        quantityEdited: false,
        issueAcknowledged: false,
        numericAcknowledged: false,
      })),
      removedSourceRows: [],
      acknowledgedSourceIssues: [],
      notes: "",
    };
    const prepared = prepareImportedRecipe(imported, reviewInput, catalog.products, catalog.materials);
    expect(prepared).toMatchObject({
      sourceId: "pastry-choclate-cookies",
      productId: 101,
      outputQuantity: "35",
    });
    expect(prepared.ingredients).toHaveLength(7);
    expect(prepared.ingredients.every(ingredient => ingredient.quantity.length > 0)).toBe(true);
  });

  it("requires explicit acknowledgement for a box source mapped to a piece product", () => {
    const imported = source({ outputQuantity: 12, outputUnit: "box" });
    const withoutAcknowledgement = validateImportedReview(
      imported,
      review({ outputQuantity: "12" }),
      [{ id: 1, name: "Mini Honey Cake Box", unit: "قطعة" }],
      materials,
    );
    expect(withoutAcknowledgement.join(" ")).toContain("صندوق");
    expect(validateImportedReview(
      imported,
      review({ outputQuantity: "12", outputUnitAcknowledged: true }),
      [{ id: 1, name: "Mini Honey Cake Box", unit: "قطعة" }],
      materials,
    )).toEqual([]);
  });

  it("keeps a concise source marker while matching a saved recipe", () => {
    const notes = buildImportNotes("pastry-test", "تمت مراجعة الوحدات");
    expect(notes).toContain("[import-source:pastry-test]");
    expect(recipeMatchesImportSource({ notes }, "pastry-test")).toBe(true);
    expect(recipeMatchesImportSource({ notes: "[import-source:other]" }, "pastry-test")).toBe(false);
    const prepared = prepareImportedRecipe(source(), review(), products, materials);
    expect(prepared.notes).toContain("[import-source:pastry-test]");
  });
});
