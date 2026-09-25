export type WarehouseCatalogEntry = {
  id: number;
  name: string;
  nameEn?: string | null;
  sku?: string | null;
  barcode?: string | null;
  category: string;
  unit: string;
};

const CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  raw_materials: { ar: "مواد خام", en: "Raw Materials" },
  packaging: { ar: "مواد تعبئة وتغليف", en: "Packaging Items" },
  perishables: { ar: "مواد سريعة التلف", en: "Perishables" },
  cleaning: { ar: "مواد تنظيف", en: "Cleaning Items" },
  stationery: { ar: "قرطاسية", en: "Stationery" },
};

export const warehouseCategoryLabel = (category: string, isRTL: boolean) =>
  CATEGORY_LABELS[category]?.[isRTL ? "ar" : "en"] ?? category;

export type WarehouseTransferDraftItem = {
  itemId: number;
  itemName: string;
  category: string;
  quantity: string;
  availableQuantity: string | null;
  unit: string;
  notes: string;
};

export function normalizeWarehouseCatalogSearch(value: string) {
  return value.toLocaleLowerCase("ar").normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "").replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
}

export function filterWarehouseCatalog(catalog: WarehouseCatalogEntry[], search: string, category: string) {
  const query = normalizeWarehouseCatalogSearch(search);
  return catalog.filter(item => {
    if (category !== "all" && item.category !== category) return false;
    if (!query) return true;
    return normalizeWarehouseCatalogSearch([
      item.name, item.nameEn, item.sku, item.barcode, item.category, item.unit,
    ].filter(Boolean).join(" ")).includes(query);
  });
}

export function addWarehouseCatalogItem(items: WarehouseTransferDraftItem[], selected: WarehouseCatalogEntry) {
  if (items.some(item => item.itemId === selected.id)) return items;
  return [...items, {
    itemId: selected.id,
    itemName: selected.name,
    category: selected.category,
    quantity: "1",
    availableQuantity: null,
    unit: selected.unit,
    notes: "",
  }];
}

export function isWarehouseDecimal(value: string, allowZero: boolean) {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value.trim())) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && (allowZero ? parsed >= 0 : parsed > 0);
}

export function isValidWarehouseDraftItem(item: WarehouseTransferDraftItem, requireAvailableQuantity = true) {
  return Number.isInteger(item.itemId) && item.itemId > 0 && !!item.itemName.trim()
    && !!item.category.trim() && !!item.unit.trim()
    && isWarehouseDecimal(item.quantity, false)
    && (!requireAvailableQuantity || (item.availableQuantity !== null && isWarehouseDecimal(item.availableQuantity, true)))
    && (item.unit !== "قطعة" || (
      Number.isInteger(Number(item.quantity))
      && (!requireAvailableQuantity || Number.isInteger(Number(item.availableQuantity)))
    ));
}