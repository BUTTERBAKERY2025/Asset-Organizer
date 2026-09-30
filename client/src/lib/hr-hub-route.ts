/** Match App's /hr-hub role switch; grants do not change the destination page. */
export function hrHubModule(role?: string | null): "operations_hr" | "hr_management" {
  return role === "operations_manager" ? "operations_hr" : "hr_management";
}