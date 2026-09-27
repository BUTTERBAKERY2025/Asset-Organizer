import type { CentralKitchenRecipeStatus } from "@shared/central-kitchen-recipes";

export type RecipeListItem = { productName: string; status: CentralKitchenRecipeStatus };
export type RecipeStatusFilter = "all" | CentralKitchenRecipeStatus;
export const RECIPE_PAGE_SIZE = 12;

export function recipeListPage<T extends RecipeListItem>(
  items: readonly T[],
  search: string,
  status: RecipeStatusFilter,
  requestedPage: number,
  size = RECIPE_PAGE_SIZE,
) {
  const term = search.trim().toLocaleLowerCase();
  const filtered = items.filter(item =>
    (status === "all" || item.status === status) &&
    item.productName.toLocaleLowerCase().includes(term),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pageCount);
  return { items: filtered.slice((page - 1) * size, page * size), total: filtered.length, page, pageCount };
}