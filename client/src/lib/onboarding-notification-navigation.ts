/** Resolve a notification deep link exclusively from the authorized list response. */
export function joiningNotificationId(search: string): number | null {
  const values = new URLSearchParams(search).getAll("notificationId");
  const raw = values.length === 1 ? values[0] : null;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export function findAuthorizedJoiningNotification<T extends { notification: { id: number } | null }>(
  search: string,
  authorizedRows: readonly T[],
): T | null {
  const id = joiningNotificationId(search);
  return id === null ? null : authorizedRows.find(row => row.notification?.id === id) ?? null;
}

export function consumeJoiningNotificationLink<T extends { notification: { id: number } | null }>(
  search: string,
  authorizedRows: readonly T[],
  authorizedResponseReady: boolean,
  consumed: Set<string>,
): { handled: boolean; row: T | null } {
  const raw = new URLSearchParams(search).get("notificationId");
  if (!raw || !authorizedResponseReady || consumed.has(raw)) return { handled: false, row: null };
  consumed.add(raw);
  return { handled: true, row: findAuthorizedJoiningNotification(search, authorizedRows) };
}

export function joiningNotificationResponseReady(query: {
  isSuccess: boolean; isFetching: boolean; isError: boolean;
}) {
  return query.isSuccess && !query.isFetching && !query.isError;
}

export function retainAuthorizedJoiningRow<T extends { offer: { id: number } }>(
  selected: T | null,
  authorizedRows: readonly T[],
): T | null {
  return selected ? authorizedRows.find(row => row.offer.id === selected.offer.id) ?? null : null;
}