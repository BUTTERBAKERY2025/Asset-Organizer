import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { OwnerBranchesResponse, OwnerSalesResponse, OwnerOverviewResponse, OwnerAssetsResponse, OwnerShareholdersResponse, OwnerMarketingResponse, OwnerMarketingSection } from "@shared/owner-portal";

let accessRevoked = false;
let accessGeneration = 0;
const listeners = new Set<() => void>();
export const ownerAccessRevoked = () => accessRevoked;
export const subscribeOwnerAccess = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
/** Capture before starting asynchronous work; check again before consuming or exporting it. */
export const getOwnerAccessGeneration = () => accessGeneration;
export function assertOwnerAccessGeneration(generation: number): void {
  if (accessRevoked || generation !== accessGeneration) throw new OwnerAccessError(403);
}
export const restoreOwnerAccess = () => {
  // Only an explicit, locally verified recheck may restore this tab. Old requests
  // must never populate the new generation's cache.
  accessGeneration++;
  queryClient.removeQueries({ queryKey: ["owner"] });
  accessRevoked = false;
  listeners.forEach(listener => listener());
};
export class OwnerAccessError extends Error {
  constructor(public status: 401 | 403) { super(status === 403 ? "ليس لديك تصريح لعرض هذه البيانات" : "انتهت الجلسة"); }
}

/** Fail closed across every tab, including currently observed queries. No cancel/reset:
 * cancelling the rejected query leaves React Query observers stuck in loading.
 */
const OWNER_REVOKE_SIGNAL = "owner-access-revoked";
let channel: BroadcastChannel | undefined;
if (typeof window !== "undefined") {
  if (typeof BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(OWNER_REVOKE_SIGNAL);
      channel.onmessage = () => revokeOwnerAccess(403, false);
    } catch {
      // Storage events still propagate revocations when BroadcastChannel is unavailable.
    }
  }
  window.addEventListener("storage", event => {
    if (event.key === OWNER_REVOKE_SIGNAL && event.newValue !== null) revokeOwnerAccess(403, false);
  });
}

export function revokeOwnerAccess(status: 401 | 403, broadcast = true) {
  accessGeneration++;
  accessRevoked = true;
  listeners.forEach(listener => listener());
  queryClient.removeQueries({ queryKey: ["owner"] });
  queryClient.removeQueries({ queryKey: ["/api/branches"] });
  queryClient.removeQueries({ queryKey: ["/api/my-permissions"] });
  // A cached owner identity is not an authorization source after denial,
  // including when another window triggered the denial.
  queryClient.setQueryData(["/api/auth/me"], null);
  if (status === 403) {
    // Revalidate the authoritative session, never fall back to cached scope.
    void queryClient.invalidateQueries({ queryKey: ["/api/auth/me"], refetchType: "all" });
  }
  if (broadcast) {
    // No role, identity, branch, or response data crosses windows.
    try { channel?.postMessage("revoked"); } catch { /* storage fallback */ }
    try { window.localStorage.setItem(OWNER_REVOKE_SIGNAL, String(Date.now()) + ":" + Math.random()); } catch { /* private browsing */ }
  }
}

export async function ownerGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const generation = getOwnerAccessGeneration();
  assertOwnerAccessGeneration(generation);
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.pathname + url.search, { credentials: "include" });
  assertOwnerAccessGeneration(generation);
  if (response.status === 401 || response.status === 403) {
    revokeOwnerAccess(response.status);
    if (response.status === 401) {
      window.location.assign("/login");
    }
    throw new OwnerAccessError(response.status);
  }
  // An older in-flight request may finish after another request was denied.
  if (!response.ok) throw new Error(response.status === 403 ? "ليس لديك تصريح لعرض هذه البيانات" : "تعذر تحميل البيانات من المصدر");
  const data = await response.json() as T;
  assertOwnerAccessGeneration(generation);
  return data;
}
const options = { staleTime: 60_000, retry: (failures: number, error: Error) => !(error instanceof OwnerAccessError) && failures < 1, refetchOnWindowFocus: false };
export const useOwnerBranches = (enabled = true) => useQuery({ queryKey: ["owner", "branches"], queryFn: () => ownerGet<OwnerBranchesResponse>("/api/owner/branches"), enabled, ...options });
export const useOwnerOverview = (date: string, branchId: string, enabled: boolean) => useQuery({ queryKey: ["owner", "overview", date, branchId], queryFn: () => ownerGet<OwnerOverviewResponse>("/api/owner/overview", { date, branchId }), enabled, ...options });
export const useOwnerSales = (dateFrom: string, dateTo: string, branchId: string, enabled: boolean) => useQuery({ queryKey: ["owner", "sales", dateFrom, dateTo, branchId], queryFn: () => ownerGet<OwnerSalesResponse>("/api/owner/sales", { dateFrom, dateTo, branchId }), enabled, ...options });
export const useOwnerAssets = (branchId: string, search: string, page: number, enabled: boolean) => useQuery({ queryKey: ["owner", "assets", branchId, search, page], queryFn: () => ownerGet<OwnerAssetsResponse>("/api/owner/assets", { branchId, search, page: String(page) }), enabled, ...options });
export const useOwnerShareholders = (search: string, page: number, enabled: boolean) => useQuery({ queryKey: ["owner", "shareholders", search, page], queryFn: () => ownerGet<OwnerShareholdersResponse>("/api/owner/shareholders", { search, page: String(page) }), enabled, ...options });
export const useOwnerMarketing = (section: OwnerMarketingSection, search: string, page: number, enabled: boolean) => useQuery({ queryKey: ["owner", "marketing", section, search, page], queryFn: () => ownerGet<OwnerMarketingResponse>("/api/owner/marketing", { section, search, page: String(page) }), enabled, ...options });