/** Presentation gate only. Actions remain exclusively server-authorized per record. */
export function isKitchenOperationsPresentation(user: { role?: string | null; jobTitle?: string | null } | null | undefined, canApprove: boolean): boolean {
  return user?.role === "admin" || user?.jobTitle === "production_manager" || canApprove;
}

export function adjacentOrderId(ids: Array<string | number>, selected: string | number | null, direction: -1 | 1): string | number | null {
  if (selected == null) return null;
  const index = ids.findIndex(id => String(id) === String(selected));
  return index < 0 ? null : ids[index + direction] ?? null;
}