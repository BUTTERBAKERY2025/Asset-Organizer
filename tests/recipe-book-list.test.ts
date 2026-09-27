import { describe, expect, it } from "vitest";
import { recipeListPage, RECIPE_PAGE_SIZE } from "../client/src/components/central-kitchen/recipe-book-list";

const rows = Array.from({ length: 31 }, (_, index) => ({
  productName: `منتج ${index + 1}`,
  status: (index % 3 === 0 ? "draft" : index % 3 === 1 ? "approved" : "superseded") as "draft" | "approved" | "superseded",
}));

describe("recipe book list", () => {
  it("pages dense catalogs without dropping the final row", () => {
    expect(recipeListPage(rows, "", "all", 1).items).toHaveLength(RECIPE_PAGE_SIZE);
    expect(recipeListPage(rows, "", "all", 3)).toMatchObject({ total: 31, page: 3, pageCount: 3 });
    expect(recipeListPage(rows, "", "all", 3).items).toHaveLength(7);
  });
  it("filters before pagination and clamps an old page after filters change", () => {
    const result = recipeListPage(rows, " منتج 1 ", "draft", 3);
    expect(result.page).toBe(1);
    expect(result.items.every(row => row.status === "draft" && row.productName.includes("1"))).toBe(true);
  });
  it("has a stable empty page for no matches", () => {
    expect(recipeListPage(rows, "غير موجود", "approved", 9)).toMatchObject({ items: [], total: 0, page: 1, pageCount: 1 });
  });
});