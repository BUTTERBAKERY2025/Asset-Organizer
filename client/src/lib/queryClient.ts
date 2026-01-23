import { QueryClient, QueryFunction } from "@tanstack/react-query";

const CACHE_TIMES = {
  STATIC: 1000 * 60 * 60, // 1 hour - for rarely changing data (branches, permissions)
  LONG: 1000 * 60 * 30, // 30 minutes - for slowly changing data (users, products)
  MEDIUM: 1000 * 60 * 5, // 5 minutes - for moderately changing data
  SHORT: 1000 * 60 * 2, // 2 minutes - for frequently changing data
  DYNAMIC: 1000 * 30, // 30 seconds - for real-time data (dashboards)
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      staleTime: CACHE_TIMES.MEDIUM,
      gcTime: 1000 * 60 * 60, // 1 hour garbage collection
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error instanceof Error && error.message.startsWith("401")) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
    mutations: {
      retry: false,
    },
  },
});

const ENDPOINT_CACHE_TIERS: Record<string, number> = {
  // Static data - rarely changes
  "/api/branches": CACHE_TIMES.STATIC,
  "/api/my-permissions": CACHE_TIMES.MEDIUM, // Permissions need to refresh reasonably quickly
  "/api/users": CACHE_TIMES.LONG,
  
  // Product/catalog data - changes slowly
  "/api/operations/products": CACHE_TIMES.LONG,
  "/api/warehouse/items": CACHE_TIMES.LONG,
  
  // Moderate change frequency
  "/api/marketing/campaigns": CACHE_TIMES.MEDIUM,
  "/api/marketing/influencers": CACHE_TIMES.MEDIUM,
  "/api/marketing/influencer-contracts": CACHE_TIMES.MEDIUM,
  "/api/inventory": CACHE_TIMES.MEDIUM,
  "/api/construction-projects": CACHE_TIMES.MEDIUM,
  "/api/assets": CACHE_TIMES.MEDIUM,
  "/api/material-requests": CACHE_TIMES.SHORT,
  "/api/material-transfers": CACHE_TIMES.SHORT,
  
  // Real-time data - needs fresh data
  "/api/dashboard/stats": CACHE_TIMES.DYNAMIC,
  "/api/daily-production": CACHE_TIMES.DYNAMIC,
  "/api/cashier-journals": CACHE_TIMES.DYNAMIC,
};

// Endpoints that should NOT be prefetched on hover (large datasets)
const SKIP_PREFETCH_ENDPOINTS = new Set([
  "/api/audit-logs",
  "/api/system-audit-logs",
  "/api/warehouse-movement-logs",
  "/api/inventory",
  "/api/daily-production",
]);

export function prefetchQuery(queryKey: string[]) {
  const key = queryKey[0];
  
  // Skip prefetching large datasets to avoid slow hover prefetch
  if (SKIP_PREFETCH_ENDPOINTS.has(key)) {
    return;
  }
  
  const state = queryClient.getQueryState(queryKey);
  if (state?.status === "pending" || state?.data !== undefined) {
    return;
  }
  
  const staleTime = ENDPOINT_CACHE_TIERS[key] ?? CACHE_TIMES.MEDIUM;
  
  queryClient.prefetchQuery({
    queryKey,
    staleTime,
  });
}

export const STATIC_QUERIES = [
  ["/api/branches"],
  // Note: /api/my-permissions uses MEDIUM cache tier, prefetched on auth only
];

export function prefetchStaticData() {
  STATIC_QUERIES.forEach(queryKey => {
    const state = queryClient.getQueryState(queryKey);
    if (state?.status === "pending" || state?.data !== undefined) {
      return;
    }
    queryClient.prefetchQuery({
      queryKey,
      staleTime: CACHE_TIMES.STATIC,
    });
  });
}

export { CACHE_TIMES };
