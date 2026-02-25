import { useQuery, useQueryClient } from "@tanstack/react-query";
import { setCachedData } from "@/lib/persistentCache";
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
      const pending = (window as any).__initPromise;
      if (pending) {
        (window as any).__initPromise = null;
        const result = await pending;
        return result;
      }
      const res = await fetch("/api/auth/init", { credentials: "include", priority: "high" as any });
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
    },
    staleTime: FIVE_MINUTES,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
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
