import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCachedData, setCachedData, shouldPersist } from "./persistentCache";

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

const inflightRequests = new Map<string, { promise: Promise<Response>; response?: Response }>();

async function deduplicatedFetch(url: string, options?: RequestInit): Promise<Response> {
  const method = options?.method || "GET";
  if (method !== "GET") {
    return fetch(url, options);
  }
  const existing = inflightRequests.get(url);
  if (existing) {
    if (existing.response) {
      return existing.response.clone();
    }
    return existing.promise.then(r => r.clone());
  }
  const fetchOptions: RequestInit = {
    ...options,
    keepalive: true,
  };
  const entry: { promise: Promise<Response>; response?: Response } = {
    promise: fetch(url, fetchOptions).then(r => {
      entry.response = r;
      return r;
    }).catch(err => {
      inflightRequests.delete(url);
      throw err;
    }),
  };
  inflightRequests.set(url, entry);
  try {
    const result = await entry.promise;
    return result.clone();
  } finally {
    inflightRequests.delete(url);
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
  async ({ queryKey, meta }) => {
    const url = queryKey[0] as string;
    const res = await deduplicatedFetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    if (shouldPersist(url)) {
      const ttl = ENDPOINT_CACHE_TIERS[url.split('?')[0]] ?? CACHE_TIMES.MEDIUM;
      setCachedData(url, data, ttl);
    }
    return data;
  };

export function getStaleTimeForEndpoint(url: string): number {
  const basePath = url.split("?")[0];
  for (const [pattern, time] of Object.entries(ENDPOINT_CACHE_TIERS)) {
    if (basePath === pattern || basePath.startsWith(pattern + "/")) {
      return time;
    }
  }
  return CACHE_TIMES.MEDIUM;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: "always",
      staleTime: CACHE_TIMES.MEDIUM,
      gcTime: 1000 * 60 * 120,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.startsWith("401")) {
          return false;
        }
        return failureCount < 1;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
      structuralSharing: true,
      networkMode: "offlineFirst",
      placeholderData: (previousData: any) => previousData,
    },
    mutations: {
      retry: false,
      networkMode: "offlineFirst",
    },
  },
});

const ENDPOINT_CACHE_TIERS: Record<string, number> = {
  "/api/branches": CACHE_TIMES.STATIC,
  "/api/my-permissions": CACHE_TIMES.LONG,
  "/api/users": CACHE_TIMES.LONG,
  "/api/products": CACHE_TIMES.LONG,
  "/api/product-categories": CACHE_TIMES.STATIC,
  "/api/departments": CACHE_TIMES.STATIC,
  "/api/roles": CACHE_TIMES.STATIC,
  "/api/chart-of-accounts": CACHE_TIMES.STATIC,
  "/api/checklist-templates": CACHE_TIMES.LONG,
  "/api/point-settings": CACHE_TIMES.LONG,
  "/api/product-commissions": CACHE_TIMES.LONG,
  "/api/waste-risk-rules": CACHE_TIMES.LONG,
  "/api/biometric-settings": CACHE_TIMES.LONG,
  "/api/operations/products": CACHE_TIMES.LONG,
  "/api/warehouse/items": CACHE_TIMES.LONG,
  "/api/contractors": CACHE_TIMES.LONG,
  "/api/governance": CACHE_TIMES.LONG,
  "/api/marketing/campaigns": CACHE_TIMES.MEDIUM,
  "/api/marketing/influencers": CACHE_TIMES.MEDIUM,
  "/api/marketing/influencer-contracts": CACHE_TIMES.MEDIUM,
  "/api/inventory": CACHE_TIMES.MEDIUM,
  "/api/construction-projects": CACHE_TIMES.MEDIUM,
  "/api/assets": CACHE_TIMES.MEDIUM,
  "/api/branch-employees": CACHE_TIMES.MEDIUM,
  "/api/shifts": CACHE_TIMES.MEDIUM,
  "/api/documents": CACHE_TIMES.MEDIUM,
  "/api/targets": CACHE_TIMES.MEDIUM,
  "/api/material-requests": CACHE_TIMES.SHORT,
  "/api/material-transfers": CACHE_TIMES.SHORT,
  "/api/attendance-records": CACHE_TIMES.SHORT,
  "/api/transfer-requests": CACHE_TIMES.SHORT,
  "/api/system-notifications": CACHE_TIMES.MEDIUM,
  "/api/dashboard/stats": CACHE_TIMES.DYNAMIC,
  "/api/daily-production": CACHE_TIMES.DYNAMIC,
  "/api/cashier-journals": CACHE_TIMES.DYNAMIC,
  "/api/command-center": CACHE_TIMES.DYNAMIC,
  "/api/active-notifications": CACHE_TIMES.SHORT,
  "/api/operations/reports": CACHE_TIMES.MEDIUM,
  "/api/operations/reports-bundle": CACHE_TIMES.MEDIUM,
  "/api/operations/stats": CACHE_TIMES.MEDIUM,
  "/api/reports/branch-overview": CACHE_TIMES.MEDIUM,
  "/api/reports/executive-summary": CACHE_TIMES.MEDIUM,
  "/api/reports/payment-mismatch": CACHE_TIMES.MEDIUM,
  "/api/cashier-payment-breakdowns": CACHE_TIMES.MEDIUM,
  "/api/branch-cashiers": CACHE_TIMES.LONG,
  "/api/pos/report": CACHE_TIMES.SHORT,
  "/api/pos/sales": CACHE_TIMES.SHORT,
  "/api/targets/progress-summary": CACHE_TIMES.MEDIUM,
  "/api/targets/leaderboard": CACHE_TIMES.MEDIUM,
  "/api/incentives/bundle": CACHE_TIMES.MEDIUM,
  "/api/warehouse/bundle": CACHE_TIMES.MEDIUM,
  "/api/branch-employees/bundle": CACHE_TIMES.MEDIUM,
  "/api/cashier-performance/bundle": CACHE_TIMES.SHORT,
  "/api/employee-reports/bundle": CACHE_TIMES.MEDIUM,
  "/api/shift-management/bundle": CACHE_TIMES.SHORT,
};

// Endpoints that should NOT be prefetched on hover (large datasets)
const SKIP_PREFETCH_ENDPOINTS = new Set([
  "/api/audit-logs",
  "/api/system-audit-logs",
  "/api/warehouse-movement-logs",
  "/api/inventory",
  "/api/daily-production",
  "/api/operations/reports-bundle",
  "/api/operations/reports",
  "/api/reports/branch-overview",
  "/api/reports/executive-summary",
  "/api/cashier-payment-breakdowns",
  "/api/incentives/bundle",
  "/api/warehouse/bundle",
  "/api/branch-employees/bundle",
  "/api/cashier-performance/bundle",
  "/api/employee-reports/bundle",
  "/api/shift-management/bundle",
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
  ["/api/product-categories"],
  ["/api/departments"],
  ["/api/roles"],
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

export function hydrateFromPersistentCache() {
  const endpoints = [
    '/api/branches', '/api/products', '/api/product-categories',
    '/api/departments', '/api/roles',
    '/api/operations/products', '/api/branch-cashiers',
    '/api/chart-of-accounts', '/api/contractors',
    '/api/dashboard/stats', '/api/command-center',
    '/api/warehouse/items', '/api/targets',
    '/api/my-permissions', '/api/auth/me',
  ];
  for (const url of endpoints) {
    const cached = getCachedData(url);
    if (cached !== undefined) {
      queryClient.setQueryData([url], cached);
    }
  }
}

export { CACHE_TIMES };
