/**
 * Standalone delivery desk eligibility. Module view permission is checked
 * separately; this does not grant delivery actions or embedded receipt access.
 */
export function canAccessDeliveryWorkspace(user: { role: string; jobTitle?: string | null } | null | undefined): boolean {
  return user?.role === "admin"
    || user?.role === "warehouse_keeper"
    || (user?.role === "employee" && user.jobTitle === "delivery");
}