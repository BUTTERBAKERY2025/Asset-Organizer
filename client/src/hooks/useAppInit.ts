import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Branch } from "@shared/schema";

interface InitData {
  user: any | null;
  branches: Branch[];
  permissions: { module: string; actions: string[] }[];
}

export function useAppInit() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<InitData>({
    queryKey: ["/api/auth/init"],
    queryFn: async () => {
      const res = await fetch("/api/auth/init", { credentials: "include" });
      if (!res.ok) return { user: null, branches: [], permissions: [] };
      const data = await res.json();
      if (data.user) {
        queryClient.setQueryData(["/api/auth/me"], data.user);
      }
      if (data.branches) {
        queryClient.setQueryData(["/api/branches"], data.branches);
      }
      if (data.permissions) {
        queryClient.setQueryData(["/api/my-permissions"], data.permissions);
      }
      return data;
    },
    staleTime: 1000 * 60 * 5,
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
