import { isNewCatalogReferenceAllowed } from "@shared/catalog-activity";

type CatalogProduct = {
  productType?: string | null;
  unit?: string | null;
  isActive?: unknown;
  operationsEnabled?: boolean | null;
};

/**
 * A new finished target is an integer count of its catalog unit, not an
 * arbitrary client unit (nor a quantity of a warehouse material).
 */
export function validateFinishedProductionTarget(
  product: CatalogProduct | null | undefined,
  quantity: unknown,
  suppliedUnit?: unknown,
): string | null {
  if (!product || !isNewCatalogReferenceAllowed(product) || product.productType !== "finish") {
    return "يجب اختيار منتج نهائي متاح للتشغيل من الكتالوج";
  }
  const numeric = typeof quantity === "number" || typeof quantity === "string" && quantity.trim()
    ? Number(quantity) : NaN;
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    return "كمية المنتج النهائي يجب أن تكون عدداً صحيحاً أكبر من صفر";
  }
  const catalogUnit = product.unit?.trim();
  if (!catalogUnit) return "وحدة المنتج النهائي غير معتمدة في الكتالوج";
  if (suppliedUnit !== undefined && suppliedUnit !== null && suppliedUnit !== catalogUnit) {
    return "الوحدة لا تطابق وحدة المنتج المعتمدة في الكتالوج";
  }
  return null;
}