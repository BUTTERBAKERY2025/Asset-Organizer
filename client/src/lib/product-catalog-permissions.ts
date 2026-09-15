import type { ModuleAction, SystemModule } from "@shared/schema";

export const PRODUCT_CATALOG_WRITE_MODULE: SystemModule = "operations";

export interface ProductCatalogWriteAccess {
  create: boolean;
  edit: boolean;
  delete: boolean;
}

/**
 * The catalog is readable through several modules, but its mutations remain
 * owned by the existing operations actions.
 */
export function getProductCatalogWriteAccess(
  hasPermission: (module: SystemModule, action: ModuleAction) => boolean,
): ProductCatalogWriteAccess {
  return {
    create: hasPermission(PRODUCT_CATALOG_WRITE_MODULE, "create"),
    edit: hasPermission(PRODUCT_CATALOG_WRITE_MODULE, "edit"),
    delete: hasPermission(PRODUCT_CATALOG_WRITE_MODULE, "delete"),
  };
}