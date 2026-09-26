export type ProductionDashboardTab = "workplan" | "operations" | "recipes" | "legacy" | "settings-review" | "unified-planning";

export function getProductionDashboardTab(search: string, canViewRecipes: boolean): ProductionDashboardTab {
  const requestedTab = new URLSearchParams(search).get("tab");
  if (requestedTab === "recipes" && !canViewRecipes) return "operations";
  return requestedTab === "workplan" || requestedTab === "recipes" || requestedTab === "legacy" ||
    requestedTab === "settings-review" || requestedTab === "unified-planning"
    ? requestedTab
    : "operations";
}