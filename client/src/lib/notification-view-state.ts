/** Recipient UI stores identities only, never a second copy of sensitive notice
 * content. A successful empty snapshot and an error both revoke prior content. */
export type NotificationQueueState = { scope: string; ids: number[]; shown: number[] };

export function reconcileNotificationQueue(
  previous: NotificationQueueState, scope: string, rows: readonly { id: number }[] | undefined, failed = false,
): NotificationQueueState {
  const base = previous.scope === scope ? previous : { scope, ids: [], shown: [] };
  if (failed || !rows) return { ...base, ids: [] };
  const current = new Set(rows.map(row => row.id));
  const ids = base.ids.filter(id => current.has(id));
  const shown = new Set(base.shown);
  for (const row of rows) {
    if (!shown.has(row.id)) {
      ids.push(row.id);
      shown.add(row.id);
    }
  }
  return { scope, ids, shown: [...shown] };
}

export function selectedRecipientNotice<T extends { id: number }>(
  selection: { id: number; scope: string } | null, scope: string, rows: readonly T[] | undefined, failed = false,
): T | null {
  return failed || selection?.scope !== scope ? null : rows?.find(row => row.id === selection.id) || null;
}

export const activeNotificationsKey = (userId?: string | null, branchId?: string | null) =>
  ["/api/active-notifications", userId || "", branchId || ""] as const;