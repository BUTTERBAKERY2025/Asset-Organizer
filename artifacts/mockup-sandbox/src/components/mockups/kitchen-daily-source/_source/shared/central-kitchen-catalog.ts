export type CentralKitchenCatalogItem = {
  id: number;
  source: "product" | "warehouse";
  name: string;
  unit: string;
  sku?: string;
  category?: string;
  nameEn?: string;
};

export type CentralKitchenCatalogV2 = {
  schemaVersion: 2;
  items: CentralKitchenCatalogItem[];
};

export class CentralKitchenCatalogContractError extends Error {
  constructor() {
    super("إصدار كتالوج الأصناف غير متوافق. أعد تحميل الصفحة للحصول على الإصدار الأحدث.");
    this.name = "CentralKitchenCatalogContractError";
  }
}

// The request schema trims names and units. Compare the same outer whitespace
// on both sides while preserving every character inside the identity.
export function matchesCentralKitchenCatalogIdentity(
  submitted: { productName: string; unit: string },
  catalog: { name: string; unit: string },
  validateUnit = true,
): boolean {
  return submitted.productName.trim() === catalog.name.trim()
    && (!validateUnit || submitted.unit.trim() === catalog.unit.trim());
}

export function parseCentralKitchenCatalogV2(value: unknown): CentralKitchenCatalogV2 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CentralKitchenCatalogContractError();
  }
  const payload = value as Record<string, unknown>;
  if (payload.schemaVersion !== 2 || !Array.isArray(payload.items)
    || Object.keys(payload).some((key) => key !== "schemaVersion" && key !== "items")) {
    throw new CentralKitchenCatalogContractError();
  }
  const items = payload.items.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new CentralKitchenCatalogContractError();
    }
    const item = raw as Record<string, unknown>;
    const validKeys = new Set(["id", "source", "name", "unit", "sku", "category", "nameEn"]);
    if (Object.keys(item).some((key) => !validKeys.has(key))
      || typeof item.id !== "number" || !Number.isInteger(item.id) || item.id <= 0
      || (item.source !== "product" && item.source !== "warehouse")
      || typeof item.name !== "string" || !item.name.trim()
      || typeof item.unit !== "string" || !item.unit.trim()
      || (item.category !== undefined && (typeof item.category !== "string" || !item.category.trim()))
      || (item.nameEn !== undefined && (typeof item.nameEn !== "string" || !item.nameEn.trim()))
      || (item.sku !== undefined && (typeof item.sku !== "string" || !item.sku.trim()))) {
      throw new CentralKitchenCatalogContractError();
    }
    return {
      id: item.id,
      source: item.source,
      name: item.name.trim(),
      unit: item.unit.trim(),
      ...(item.sku !== undefined ? { sku: item.sku } : {}),
      ...(item.category !== undefined ? { category: item.category } : {}),
      ...(item.nameEn !== undefined ? { nameEn: item.nameEn } : {}),
    } as CentralKitchenCatalogItem;
  });
  return { schemaVersion: 2, items };
}