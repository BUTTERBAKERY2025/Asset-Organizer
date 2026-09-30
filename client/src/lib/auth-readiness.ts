/** Cached identity can populate a placeholder but never mount protected UI. */
export function isAuthoritativeAuthReady(input: {
  fetchedAfterMount: boolean;
  fetching: boolean;
  error: boolean;
  role: string | undefined;
  hasUser: boolean;
  legacyLoading: boolean;
}) {
  if (!input.fetchedAfterMount || input.fetching || input.error) return false;
  return !input.hasUser || input.role === "business_owner" || !input.legacyLoading;
}