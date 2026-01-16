import { QueryClient, QueryFunction } from "@tanstack/react-query";

const CACHE_TIMES = {
  STATIC: 1000 * 60 * 60, // 1 hour - for rarely changing data (branches, users)
  MEDIUM: 1000 * 60 * 10, // 10 minutes - for moderately changing data
  DYNAMIC: 1000 * 60 * 2, // 2 minutes - for frequently changing data
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
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const ENDPOINT_CACHE_TIERS: Record<string, number> = {
  "/api/branches": CACHE_TIMES.STATIC,
  "/api/my-permissions": CACHE_TIMES.STATIC,
  "/api/marketing/campaigns": CACHE_TIMES.MEDIUM,
  "/api/marketing/influencers": CACHE_TIMES.MEDIUM,
  "/api/marketing/influencer-contracts": CACHE_TIMES.MEDIUM,
  "/api/inventory": CACHE_TIMES.MEDIUM,
  "/api/dashboard/stats": CACHE_TIMES.DYNAMIC,
  "/api/construction-projects": CACHE_TIMES.MEDIUM,
  "/api/operations/products": CACHE_TIMES.MEDIUM,
};

export function prefetchQuery(queryKey: string[]) {
  const key = queryKey[0];
  const state = queryClient.getQueryState(queryKey);
  if (state?.status === "pending" || (state?.data !== undefined && !state?.isStale)) {
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
  ["/api/my-permissions"],
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
