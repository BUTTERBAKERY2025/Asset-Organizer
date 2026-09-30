export type ProductionDashboardTab = "cycle" | "tracking" | "workplan" | "operations" | "recipes" | "legacy" | "settings-review" | "unified-planning";

export function getProductionDashboardTab(search: string, canViewRecipes: boolean): ProductionDashboardTab {
  const requestedTab = new URLSearchParams(search).get("tab");
  if (requestedTab === "recipes" && !canViewRecipes) return "cycle";
  return requestedTab === "cycle" || requestedTab === "tracking" || requestedTab === "operations" || requestedTab === "workplan" || requestedTab === "recipes" || requestedTab === "legacy" ||
    requestedTab === "settings-review" || requestedTab === "unified-planning"
    ? requestedTab
    : "cycle";
}