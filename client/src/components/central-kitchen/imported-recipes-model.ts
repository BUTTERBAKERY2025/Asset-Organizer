/**
 * Pure helpers for the imported-recipe review flow.
 *
 * Imported sources are deliberately kept separate from saved recipe contracts.
 * A source becomes a saved recipe only after the normal recipe-book create
 * mutation has accepted the prepared draft.
 */

export type ImportedRecipeIngredientSource = {
  sourceName: string;
  sourceQuantity: string;
  sourceUnit: string;
  warehouseItemId: number | null;
  quantity: number | null;
  unit: string | null;
  issue: string | null;
};

export type ImportedRecipeSource = {
  sourceId: string;
  name: string;
  outputQuantity: number | null;
  outputUnit: string | null;
  rawSourceText: string;
  productId: number | null;
  ingredients: ImportedRecipeIngredientSource[];
  issues: string[];
};

export type ImportedRecipeCatalogProduct = {
  id: number;
  name: string;
  unit: string;
};

export type ImportedRecipeCatalogMaterial = {
  id: number;
  name: string;
  unit: string;
};

export type ImportedIngredientReview = {
  rowId: string;
  sourceName: string;
  sourceQuantity: string;
  sourceUnit: string;
  warehouseItemId: string;
  quantity: string;
  issue: string | null;
  quantityEdited: boolean;
  issueAcknowledged: boolean;
  numericAcknowledged: boolean;
};

export type ImportedRecipeReview = {
  sourceId: string;
  productId: string;
  outputQuantity: string;
  ingredients: ImportedIngredientReview[];
  removedSourceRows: string[];
  acknowledgedSourceIssues: string[];
  notes: string;
  outputUnitAcknowledged?: boolean;
};

export type PreparedImportedRecipe = {
  sourceId: string;
  productId: number;
  outputQuantity: string;
  notes: string;
  ingredients: Array<{
    warehouseItemId: number;
    quantity: string;
  }>;
};

export function canReviewImportedRecipes(canView: boolean, canCreate: boolean): boolean {
  return canView && canCreate;
}

export type CanonicalRecipeUnit = "kg" | "piece" | "litre";

/**
 * Catalog labels are localized. Only these three dimensions are canonicalized
 * here; in particular, grams are not treated as kilograms on the client.
 * The server has already normalized a safe g -> kg source into source.unit
 * and its converted quantity before this helper is called.
 */
export function canonicalRecipeUnit(value: string | null | undefined): CanonicalRecipeUnit | null {
  const normalized = asTrimmedString(value).toLocaleLowerCase("en-US");
  if (["kg", "كجم", "كيلو"].includes(normalized)) return "kg";
  if (["piece", "قطعة"].includes(normalized)) return "piece";
  if (["litre", "لتر"].includes(normalized)) return "litre";
  return null;
}

export function sameRecipeUnit(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const leftUnit = canonicalRecipeUnit(left);
  const rightUnit = canonicalRecipeUnit(right);
  return leftUnit !== null && leftUnit === rightUnit;
}

export function isBoxToPieceOutputEquivalence(
  sourceUnit: string | null | undefined,
  catalogUnit: string | null | undefined,
): boolean {
  return asTrimmedString(sourceUnit).toLocaleLowerCase("en-US") === "box"
    && canonicalRecipeUnit(catalogUnit) === "piece";
}

const DECIMAL_PATTERN = /^\d+(?:\.\d{1,6})?$/;
const MICRO_UNITS = 1_000_000;

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Keep the source marker short and deterministic. It is intentionally plain
 * text because it is stored in the existing recipe notes field.
 */
export function getImportSourceMarker(sourceId: string | number): string {
  return `[import-source:${String(sourceId).trim().slice(0, 1_800)}]`;
}

export function buildImportNotes(
  sourceId: string | number,
  optionalMethodNotes = "",
): string {
  const marker = getImportSourceMarker(sourceId);
  const methodNotes = optionalMethodNotes.trim();
  if (!methodNotes) return marker;
  return `${marker}\n${methodNotes}`.slice(0, 2_000);
}

export function recipeMatchesImportSource(
  recipe: { notes?: string | null },
  sourceId: string | number,
): boolean {
  return typeof recipe.notes === "string"
    && recipe.notes.includes(getImportSourceMarker(sourceId));
}

export function decimalToMicroUnits(value: string | number): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const scaled = value * MICRO_UNITS;
    if (Math.abs(scaled - Math.round(scaled)) > Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8) {
      return null;
    }
  }
  const text = typeof value === "number" ? value.toFixed(6) : asTrimmedString(value);
  if (!text || !DECIMAL_PATTERN.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const microUnits = Number(whole) * MICRO_UNITS + Number(fraction.padEnd(6, "0"));
  if (!Number.isSafeInteger(microUnits) || microUnits <= 0 || microUnits > 1_000_000_000_000_000) return null;
  return microUnits;
}

export function microUnitsToDecimal(value: number): string {
  if (!Number.isSafeInteger(value) || value <= 0) return "";
  const whole = Math.floor(value / MICRO_UNITS);
  const fraction = String(value % MICRO_UNITS).padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

/**
 * The server recipe contract allows one row per material. Imported sources
 * can contain duplicates, so merge them with integer micro-units rather than
 * floating-point addition. No line is silently discarded.
 */
export function groupImportedIngredients(
  ingredients: Array<{ warehouseItemId: number; quantity: string | number }>,
): Array<{ warehouseItemId: number; quantity: string }> {
  const sums = new Map<number, number>();
  for (const ingredient of ingredients) {
    if (!Number.isInteger(ingredient.warehouseItemId) || ingredient.warehouseItemId <= 0) {
      throw new Error("مادة الوصفة غير صالحة ولا يمكن إسقاط صفها أثناء التجميع.");
    }
    const microUnits = decimalToMicroUnits(ingredient.quantity);
    if (microUnits === null) {
      throw new Error("كمية المادة غير صالحة ولا يمكن إسقاطها أثناء التجميع.");
    }
    const sum = (sums.get(ingredient.warehouseItemId) || 0) + microUnits;
    if (!Number.isSafeInteger(sum)) {
      throw new Error("إجمالي كمية المادة يتجاوز الدقة الآمنة ذات الست خانات العشرية.");
    }
    sums.set(ingredient.warehouseItemId, sum);
  }
  return [...sums.entries()]
    .map(([warehouseItemId, quantity]) => ({
      warehouseItemId,
      quantity: microUnitsToDecimal(quantity),
    }));
}

export function isPositiveSixDecimal(value: string | number): boolean {
  return decimalToMicroUnits(value) !== null;
}

export function sourceQuantityIsNumeric(
  row: Pick<ImportedRecipeIngredientSource, "sourceQuantity">,
): boolean {
  return decimalToMicroUnits(row.sourceQuantity) !== null;
}

/**
 * A parsed number with no trusted normalized quantity must be edited by the
 * reviewer. Merely selecting a material or its unit is never an
 * acknowledgement of an ambiguous source number.
 */
export function requiresNumericAcknowledgement(
  row: Pick<ImportedRecipeIngredientSource, "sourceQuantity" | "quantity" | "issue">,
): boolean {
  if (!sourceQuantityIsNumeric(row)) return false;
  if (row.quantity === null) return true;
  const issue = asTrimmedString(row.issue).toLocaleLowerCase();
  return /ambig|doubt|uncertain|question|unit|numeric|ملتبس|وحد|رقم|غير واضح|شك/.test(issue);
}

export function ingredientReviewIsResolved(
  row: ImportedIngredientReview,
  source: ImportedRecipeIngredientSource,
  material?: ImportedRecipeCatalogMaterial,
): boolean {
  const materialId = Number(row.warehouseItemId);
  if (!Number.isInteger(materialId) || materialId <= 0 || !material) return false;
  const sourceUnit = (source.unit || source.sourceUnit || "").trim();
  const unitMismatch = sourceUnit && !sameRecipeUnit(sourceUnit, material.unit);
  const hasExplicitCorrection = row.quantityEdited && row.numericAcknowledged;
  if (unitMismatch && !hasExplicitCorrection) return false;
  if (!isPositiveSixDecimal(row.quantity)) return false;
  if (source.issue && !row.issueAcknowledged) return false;
  if (requiresNumericAcknowledgement(source)
    && (!row.quantityEdited || !row.numericAcknowledged)) return false;
  return true;
}

export function allImportedReviewIssuesResolved(
  source: ImportedRecipeSource,
  review: ImportedRecipeReview,
): boolean {
  const sourceIssuesResolved = source.issues.every((_, index) =>
    review.acknowledgedSourceIssues.includes(`source:${index}`),
  );
  const ingredientIssuesResolved = source.ingredients.every((ingredient, index) => {
    if (!ingredient.issue) return true;
    const row = review.ingredients.find(candidate => candidate.rowId === `source:${index}`);
    return Boolean(row?.issueAcknowledged)
      || review.acknowledgedSourceIssues.includes(`ingredient:${index}`);
  });
  return sourceIssuesResolved && ingredientIssuesResolved;
}

export function validateImportedReview(
  source: ImportedRecipeSource,
  review: ImportedRecipeReview,
  products: ImportedRecipeCatalogProduct[],
  materials: ImportedRecipeCatalogMaterial[],
): string[] {
  const errors: string[] = [];
  const product = products.find(item => item.id === Number(review.productId));
  if (!product) errors.push("اختر منتج الإخراج من الكتالوج.");
  if (!isPositiveSixDecimal(review.outputQuantity)) {
    errors.push("أدخل كمية إخراج موجبة بدقة لا تتجاوز ست خانات عشرية.");
  }
  if (review.notes.toLocaleUpperCase("en-US").includes("UNRESOLVED")) {
    errors.push("لا يمكن أن تحتوي ملاحظات الوصفة على علامة استيراد غير محسومة.");
  }
  if (source.outputUnit && product && !sameRecipeUnit(source.outputUnit, product.unit)) {
    if (!isBoxToPieceOutputEquivalence(source.outputUnit, product.unit)
      || review.outputUnitAcknowledged !== true) {
      errors.push(isBoxToPieceOutputEquivalence(source.outputUnit, product.unit)
        ? "أكّد أن وحدة قطعة الكتالوج تمثل صندوقاً واحداً لهذا المصدر؛ لا يُفترض تحويل العدد."
        : "وحدة ناتج المصدر لا تطابق وحدة المنتج المختار؛ لا يُفترض تحويل الناتج.");
    }
  }
  if (!source.ingredients.length && !review.ingredients.length) {
    errors.push("أضف مادة واحدة على الأقل قبل الحفظ.");
  }
  source.ingredients.forEach((sourceIngredient, index) => {
    const sourceRowId = `source:${index}`;
    if (review.removedSourceRows.includes(sourceRowId)) return;
    const reviewIngredient = review.ingredients.find(item => item.rowId === sourceRowId);
    const material = reviewIngredient
      ? materials.find(item => item.id === Number(reviewIngredient.warehouseItemId))
      : undefined;
    if (!reviewIngredient || !ingredientReviewIsResolved(reviewIngredient, sourceIngredient, material)) {
      errors.push(`لم تكتمل مراجعة مادة المصدر رقم ${index + 1}.`);
    }
  });
  const addedIngredients = review.ingredients.filter(item => item.rowId.startsWith("added:"));
  if (addedIngredients.length) {
    addedIngredients.forEach((reviewIngredient, index) => {
      const material = materials.find(item => item.id === Number(reviewIngredient.warehouseItemId));
      if (!ingredientReviewIsResolved(
        reviewIngredient,
        {
          sourceName: "مادة مضافة يدوياً",
          sourceQuantity: "",
          sourceUnit: "",
          warehouseItemId: null,
          quantity: null,
          unit: null,
          issue: null,
        },
        material,
      )) {
        errors.push(`لم تكتمل مراجعة المادة المضافة رقم ${index + 1}.`);
      }
    });
  }
  if (!allImportedReviewIssuesResolved(source, review)) {
    errors.push("أكّد معالجة كل ملاحظات المصدر والمواد.");
  }
  return errors;
}

export function prepareImportedRecipe(
  source: ImportedRecipeSource,
  review: ImportedRecipeReview,
  products: ImportedRecipeCatalogProduct[],
  materials: ImportedRecipeCatalogMaterial[],
): PreparedImportedRecipe {
  const errors = validateImportedReview(source, review, products, materials);
  if (errors.length) throw new Error(errors[0]);
  const ingredients = review.ingredients.map(item => ({
    warehouseItemId: Number(item.warehouseItemId),
    quantity: item.quantity,
  }));
  const grouped = groupImportedIngredients(ingredients);
  if (!grouped.length) throw new Error("أضف مادة واحدة على الأقل قبل الحفظ.");
  const product = products.find(item => item.id === Number(review.productId));
  if (!product) throw new Error("اختر منتج الإخراج من الكتالوج.");
  return {
    sourceId: source.sourceId,
    productId: product.id,
    outputQuantity: review.outputQuantity,
    notes: buildImportNotes(source.sourceId, review.notes),
    ingredients: grouped,
  };
}
