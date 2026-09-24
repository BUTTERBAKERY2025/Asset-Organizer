import { useEffect } from "react";
import { useSearch } from "wouter";

/** Opens existing UI only. Consume before opening so rerenders cannot replay it. */
export function useBranchDeskIntent(branchId: string | null, ready: boolean, onIntent: (intent: string) => void) {
  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const intent = params.get("intent");
    if (!ready || !branchId || params.get("branchId") !== branchId
      || params.get("from") !== "branch-operations" || !intent) return;
    if (new URLSearchParams(window.location.search).get("intent") !== intent) return;
    params.delete("intent");
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params}${window.location.hash}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
    onIntent(intent);
  }, [search, branchId, ready, onIntent]);
}