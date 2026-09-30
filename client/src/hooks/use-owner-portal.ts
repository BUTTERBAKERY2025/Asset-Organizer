import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { OwnerBranchesResponse, OwnerSalesResponse, OwnerOverviewResponse, OwnerAssetsResponse, OwnerShareholdersResponse, OwnerMarketingResponse, OwnerMarketingSection } from "@shared/owner-portal";

let accessRevoked = false;
const listeners = new Set<() => void>();
export const ownerAccessRevoked = () => accessRevoked;
export const subscribeOwnerAccess = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const restoreOwnerAccess = () => { accessRevoked = false; listeners.forEach(listener => listener()); };
export class OwnerAccessError extends Error {
  constructor(public status: 401 | 403) { super(status === 403 ? "ليس لديك تصريح لعرض هذه البيانات" : "انتهت الجلسة"); }
}

/** Fail closed across every tab, including currently observed queries. No cancel/reset:
 * cancelling the rejected query leaves React Query observers stuck in loading.
 */
export function revokeOwnerAccess(status: 401 | 403) {
  accessRevoked = true;
  listeners.forEach(listener => listener());
  queryClient.removeQueries({ queryKey: ["owner"] });
  queryClient.removeQueries({ queryKey: ["/api/branches"] });
  queryClient.removeQueries({ queryKey: ["/api/my-permissions"] });
  if (status === 401) {
    queryClient.setQueryData(["/api/auth/me"], null);
  } else {
    // Revalidate the authoritative session, never fall back to cached scope.
    void queryClient.invalidateQueries({ queryKey: ["/api/auth/me"], refetchType: "all" });
  }
}

export async function ownerGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url.pathname + url.search, { credentials: "include" });
  if (response.status === 401 || response.status === 403) {
    revokeOwnerAccess(response.status);
    if (response.status === 401) {
      window.location.assign("/login");
    }
    throw new OwnerAccessError(response.status);
  }
  // An older in-flight request may finish after another request was denied.
  if (accessRevoked) throw new OwnerAccessError(403);
  if (!response.ok) throw new Error(response.status === 403 ? "ليس لديك تصريح لعرض هذه البيانات" : "تعذر تحميل البيانات من المصدر");
  return response.json() as Promise<T>;
}
const options = { staleTime: 60_000, retry: (failures: number, error: Error) => !(error instanceof OwnerAccessError) && failures < 1, refetchOnWindowFocus: false };
export const useOwnerBranches = (enabled = true) => useQuery({ queryKey: ["owner", "branches"], queryFn: () => ownerGet<OwnerBranchesResponse>("/api/owner/branches"), enabled, ...options });
export const useOwnerOverview = (date: string, branchId: string, enabled: boolean) => useQuery({ queryKey: ["owner", "overview", date, branchId], queryFn: () => ownerGet<OwnerOverviewResponse>("/api/owner/overview", { date, branchId }), enabled, ...options });
export const useOwnerSales = (dateFrom: string, dateTo: string, branchId: string, enabled: boolean) => useQuery({ queryKey: ["owner", "sales", dateFrom, dateTo, branchId], queryFn: () => ownerGet<OwnerSalesResponse>("/api/owner/sales", { dateFrom, dateTo, branchId }), enabled, ...options });
export const useOwnerAssets = (branchId: string, search: string, page: number, enabled: boolean) => useQuery({ queryKey: ["owner", "assets", branchId, search, page], queryFn: () => ownerGet<OwnerAssetsResponse>("/api/owner/assets", { branchId, search, page: String(page) }), enabled, ...options });
export const useOwnerShareholders = (search: string, page: number, enabled: boolean) => useQuery({ queryKey: ["owner", "shareholders", search, page], queryFn: () => ownerGet<OwnerShareholdersResponse>("/api/owner/shareholders", { search, page: String(page) }), enabled, ...options });
export const useOwnerMarketing = (section: OwnerMarketingSection, search: string, page: number, enabled: boolean) => useQuery({ queryKey: ["owner", "marketing", section, search, page], queryFn: () => ownerGet<OwnerMarketingResponse>("/api/owner/marketing", { section, search, page: String(page) }), enabled, ...options });