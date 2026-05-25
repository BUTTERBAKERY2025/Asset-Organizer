import { useQuery, useQueryClient } from "@tanstack/react-query";
import { setCachedData, getCachedData, getCachedUser, hasValidSession } from "@/lib/persistentCache";
import type { Branch } from "@shared/schema";

interface InitData {
  user: any | null;
  branches: Branch[];
  permissions: { module: string; actions: string[] }[];
}

const FIVE_MINUTES = 1000 * 60 * 5;

export function useAppInit() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<InitData>({
    queryKey: ["/api/auth/init"],
    queryFn: async () => {
      const fallbackFromCache = (): InitData => ({
        user: hasValidSession() ? getCachedUser() : null,
        branches: (getCachedData("/api/branches") as Branch[] | undefined) ?? [],
        permissions: (getCachedData("/api/my-permissions") as { module: string; actions: string[] }[] | undefined) ?? [],
      });
      try {
        const pending = (window as any).__initPromise;
        if (pending) {
          (window as any).__initPromise = null;
          const result = await pending;
          return result;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);
        const res = await fetch("/api/auth/init", { credentials: "include", priority: "high" as any, signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return { user: null, branches: [], permissions: [] };
        const data = await res.json();
        if (data.user) {
          queryClient.setQueryData(["/api/auth/me"], data.user);
          setCachedData("/api/auth/me", data.user, FIVE_MINUTES);
        }
        if (data.branches) {
          queryClient.setQueryData(["/api/branches"], data.branches);
          setCachedData("/api/branches", data.branches, FIVE_MINUTES);
        }
        if (data.permissions) {
          queryClient.setQueryData(["/api/my-permissions"], data.permissions);
          setCachedData("/api/my-permissions", data.permissions, FIVE_MINUTES);
        }
        return data;
      } catch (err) {
        const fallback = fallbackFromCache();
        if (fallback.user) {
          console.warn("[useAppInit] network failed, using cached session", err);
          return fallback;
        }
        throw err;
      }
    },
    staleTime: FIVE_MINUTES,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    // Was true — caused a duplicate /api/auth/init request on every AuthGate
    // mount even though main.tsx already prefetched it. Setting to false means
    // we trust the staleTime window (5min) and skip the redundant network round-trip.
    refetchOnMount: false,
    refetchOnReconnect: true,
    retry: 1,
  });

  return {
    user: data?.user ?? null,
    branches: data?.branches ?? [],
    permissions: data?.permissions ?? [],
    isLoading,
    isAuthenticated: !!data?.user,
  };
}
