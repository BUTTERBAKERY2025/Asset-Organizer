import { describe, expect, it } from "vitest";
import {
  JOB_ROLE_PERMISSION_TEMPLATES,
  PRODUCT_CATALOG_READ_MODULES,
} from "../shared/schema";
import {
  getProductCatalogWriteAccess,
  PRODUCT_CATALOG_ADDITIVE_WRITE_MODULE,
  PRODUCT_CATALOG_WRITE_MODULE,
} from "../client/src/lib/product-catalog-permissions";

function actionsFor(module: string) {
  return JOB_ROLE_PERMISSION_TEMPLATES.production_manager.find((permission) => permission.module === module)?.actions;
}

describe("product catalog permission contracts", () => {
  it("allows the catalog route through the existing read modules only", () => {
    expect(PRODUCT_CATALOG_READ_MODULES).toEqual([
      "operations",
      "products",
      "production",
      "daily_production",
      "advanced_production",
    ]);
    expect(PRODUCT_CATALOG_READ_MODULES).not.toContain("central_kitchen_recipes");
  });

  it("keeps the production manager job template coherent and read-only for products", () => {
    expect(actionsFor("production")).toEqual(["view", "create", "edit", "delete"]);
    expect(actionsFor("shifts")).toEqual(["view", "create", "edit", "delete"]);
    expect(actionsFor("quality_control")).toEqual(["view", "create", "edit", "delete"]);
    expect(actionsFor("daily_production")).toEqual(["view", "create", "edit", "export", "print"]);
    expect(actionsFor("advanced_production")).toEqual(["view", "create", "edit", "export"]);
    expect(actionsFor("central_kitchen_orders")).toEqual(["view", "edit", "approve", "export", "print"]);
    expect(actionsFor("products")).toEqual(["view"]);
    expect(actionsFor("central_kitchen_recipes")).toBeUndefined();
  });

  it("allows additive product create/edit without broad operations access", () => {
    expect(PRODUCT_CATALOG_WRITE_MODULE).toBe("operations");
    expect(PRODUCT_CATALOG_ADDITIVE_WRITE_MODULE).toBe("products");

    const readOnly = getProductCatalogWriteAccess(() => false);
    expect(readOnly).toEqual({ create: false, edit: false, delete: false });

    const operationsCreateOnly = getProductCatalogWriteAccess((module, action) =>
      module === "operations" && action === "create",
    );
    expect(operationsCreateOnly).toEqual({ create: true, edit: false, delete: false });

    const productsEditOnly = getProductCatalogWriteAccess((module, action) =>
      module === "products" && action === "edit",
    );
    expect(productsEditOnly).toEqual({ create: false, edit: true, delete: false });
  });
});