import { MaterialTransferCreationError } from "./material-transfer-creation";

export interface MaterialTransferCatalogItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  isActive: boolean | null;
}

type MaterialTransferItemIdentity = {
  itemId: number;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  availableQuantity?: number | null;
};

export function resolveMaterialTransferCatalogItems<
  T extends MaterialTransferItemIdentity,
>(
  items: readonly T[],
  catalogItems: readonly MaterialTransferCatalogItem[],
): Array<Omit<T, "itemName" | "category" | "unit"> & Pick<MaterialTransferItemIdentity, "itemName" | "category" | "unit">> {
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));

  return items.map((item) => {
    const catalogItem = catalogById.get(item.itemId);
    if (!catalogItem) {
      throw new MaterialTransferCreationError(
        `صنف المستودع رقم ${item.itemId} غير موجود`,
        400,
      );
    }
    if (catalogItem.isActive !== true) {
      throw new MaterialTransferCreationError(
        `صنف المستودع رقم ${item.itemId} غير نشط`,
        400,
      );
    }
    if (item.unit !== catalogItem.unit) {
      throw new MaterialTransferCreationError(
        `وحدة صنف المستودع رقم ${item.itemId} لا تطابق الوحدة المعتمدة`,
        400,
      );
    }
    if (catalogItem.unit === "قطعة" && (
      !Number.isInteger(item.quantity)
      || (item.availableQuantity != null && !Number.isInteger(item.availableQuantity))
    )) {
      throw new MaterialTransferCreationError(
        `كمية صنف المستودع رقم ${item.itemId} بالقطعة يجب أن تكون عدداً صحيحاً`,
        400,
      );
    }

    return {
      ...item,
      itemName: catalogItem.name,
      category: catalogItem.category,
      unit: catalogItem.unit,
    };
  });
}