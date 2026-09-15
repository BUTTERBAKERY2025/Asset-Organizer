import { describe, expect, it } from "vitest";
import {
  PASTRY_RECIPE_IMPORT_SOURCES,
  mapPastryRecipeImportSources,
} from "../server/central-kitchen-recipe-import";

describe("central kitchen pastry recipe source import", () => {
  it("publishes eleven deterministic source records and keeps the confirmed yields", () => {
    expect(PASTRY_RECIPE_IMPORT_SOURCES).toHaveLength(11);
    const sourceIds = PASTRY_RECIPE_IMPORT_SOURCES.map((source) => source.sourceId);
    expect(new Set(sourceIds).size).toBe(11);
    expect(sourceIds).toEqual(
      PASTRY_RECIPE_IMPORT_SOURCES.map((source) => source.sourceId),
    );

    const expectedYields: Record<string, [number | null, string | null]> = {
      "pastry-creme-brulee": [50, "piece"],
      "pastry-bb-cake": [85, "piece"],
      "pastry-rocher": [64, "piece"],
      "pastry-san-sebastian": [72, "piece"],
      "pastry-honey-cake": [40, "piece"],
      "pastry-choclate-cookies": [35, "piece"],
      "pastry-mini-honey-cake-box": [12, "box"],
      "pastry-madrid-cheeseca": [60, "piece"],
      "pastry-choclate-matilda": [34, "piece"],
      "pastry-madeline-biscuit": [88, "piece"],
      "pastry-national-day-cake": [null, null],
    };
    for (const source of PASTRY_RECIPE_IMPORT_SOURCES) {
      expect([source.outputQuantity, source.outputUnit]).toEqual(expectedYields[source.sourceId]);
    }
  });

  it("retains source text outside A6, including sauces", () => {
    const bb = PASTRY_RECIPE_IMPORT_SOURCES.find(
      (source) => source.sourceId === "pastry-bb-cake",
    )!;
    const rocher = PASTRY_RECIPE_IMPORT_SOURCES.find(
      (source) => source.sourceId === "pastry-rocher",
    )!;
    const sanSebastian = PASTRY_RECIPE_IMPORT_SOURCES.find(
      (source) => source.sourceId === "pastry-san-sebastian",
    )!;
    expect(bb.rawSourceText).toContain("Bb Cake Sauce");
    expect(bb.rawSourceText).toContain("85pcs Riang 4s");
    expect(rocher.rawSourceText).toContain("Frosting : Milk: 250 g");
    expect(sanSebastian.rawSourceText).toContain("San Sebastian and Matilda Sauce.");
  });

  it("flags every source quantity at or above 100 kg without changing its raw value", () => {
    const mapped = mapPastryRecipeImportSources({ products: [], materials: [] });
    for (const source of PASTRY_RECIPE_IMPORT_SOURCES) {
      expect(source.rawSourceText.trim().length, source.sourceId).toBeGreaterThan(0);
      expect(source.ingredients.length, source.sourceId).toBeGreaterThan(0);
      const mappedSource = mapped.find((candidate) => candidate.sourceId === source.sourceId)!;
      source.ingredients.forEach((rawIngredient, index) => {
        const rawUnit = rawIngredient.rawUnit?.trim().toLocaleLowerCase("en-US");
        const rawQuantity = rawIngredient.rawQuantity === null
          ? Number.NaN
          : Number(rawIngredient.rawQuantity);
        if (rawUnit === "kg" && Number.isFinite(rawQuantity) && rawQuantity >= 100) {
          expect(rawIngredient.issue, `${source.sourceId}:${index}`).toMatch(/doubtful|correct|acknowledge/i);
          expect(mappedSource.ingredients[index].sourceQuantity).toBe(rawIngredient.rawQuantity);
          expect(mappedSource.ingredients[index].sourceUnit).toBe(rawIngredient.rawUnit);
          expect(mappedSource.ingredients[index].issue).toMatch(/UNRESOLVED/i);
        }
      });
    }
  });

  it("does not make weight-to-piece/volume conversions or unsafe substitutions", () => {
    const mapped = mapPastryRecipeImportSources({
      products: [
        { id: 1, name: "B.B Cake", unit: "piece" },
        { id: 2, name: "Madrid Cheesecake (large)", unit: "piece" },
        { id: 3, name: "Madrid Cheesecake (small)", unit: "piece" },
      ],
      materials: [
        { id: 10, name: "Egg", unit: "piece" },
        { id: 11, name: "Milk", unit: "litre" },
        { id: 12, name: "Digestive Biscuits", unit: "kg" },
        { id: 13, name: "Whole Egg", unit: "piece" },
      ],
    });

    const bb = mapped.find((source) => source.sourceId === "pastry-bb-cake")!;
    const eggFromGrams = bb.ingredients.find(
      (ingredient) => ingredient.sourceName === "egg",
    )!;
    expect(eggFromGrams).toMatchObject({
      sourceQuantity: "1.05",
      sourceUnit: "g",
      quantity: null,
      unit: null,
    });
    expect(eggFromGrams.issue).toContain("UNRESOLVED");

    const cream = bb.ingredients.find(
      (ingredient) => ingredient.sourceName === "liquide cream",
    )!;
    expect(cream).toMatchObject({ warehouseItemId: null, quantity: null, unit: null });
    const oil = bb.ingredients.find((ingredient) => ingredient.sourceName === "oil")!;
    expect(oil).toMatchObject({ quantity: null, unit: null });
    const digestive = bb.ingredients.find(
      (ingredient) => ingredient.sourceName === "Digestive Biscuits",
    )!;
    expect(digestive).toMatchObject({ quantity: null, unit: null });

    const rocher = mapped.find((source) => source.sourceId === "pastry-rocher")!;
    expect(rocher.ingredients.find(
      (ingredient) => ingredient.sourceName === "egg whites",
    )!.warehouseItemId).toBeNull();

    const madrid = mapped.find((source) => source.sourceId === "pastry-madrid-cheeseca")!;
    expect(madrid.productId).toBeNull();
    expect(madrid.issues.join(" ")).toContain("Madrid");
  });

  it("leaves unmatched Madeleine and National Day products unresolved", () => {
    const mapped = mapPastryRecipeImportSources({ products: [], materials: [] });
    expect(mapped.find((source) => source.sourceId === "pastry-madeline-biscuit")!.productId)
      .toBeNull();
    expect(mapped.find((source) => source.sourceId === "pastry-national-day-cake")!.productId)
      .toBeNull();
  });
});