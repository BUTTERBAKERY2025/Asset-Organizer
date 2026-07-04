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

// Hard ceiling on every network request. Prevents the UI from hanging
// indefinitely when Supabase Pooler stalls or a mobile connection drops mid-request.
// 30s is comfortably above the server's statement_timeout (45s would never reach client
// in practice — Supabase usually 502s long before that on stalls).
const FETCH_TIMEOUT_MS = 30000;

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  // Respect any AbortSignal the caller passes by chaining it with the internal timeout.
  const controller = new AbortController();
  const externalSignal = options.signal as AbortSignal | undefined;
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  });
}

const inflightRequests = new Map<string, Promise<{ status: number; statusText: string; headers: Headers; body: ArrayBuffer }>>();

async function deduplicatedFetch(url: string, options?: RequestInit): Promise<Response> {
  const method = options?.method || "GET";
  if (method !== "GET") {
    return fetchWithTimeout(url, options);
  }
  let entry = inflightRequests.get(url);
  if (!entry) {
    const fetchPromise = fetchWithTimeout(url, options);
    const bodyPromise = fetchPromise.then(async (res) => {
      const body = await res.arrayBuffer();
      return { status: res.status, statusText: res.statusText, headers: res.headers, body };
    }).catch(err => {
      inflightRequests.delete(url);
      throw err;
    });
    entry = bodyPromise;
    inflightRequests.set(url, entry);
    bodyPromise.then(() => {
      setTimeout(() => inflightRequests.delete(url), 50);
    }).catch(() => {});
  }
  const { status, statusText, headers, body } = await entry;
  return new Response(body.slice(0), { status, statusText, headers });
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetchWithTimeout(url, {
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
      refetchOnMount: false,
      refetchOnReconnect: true,
      staleTime: CACHE_TIMES.MEDIUM,
      gcTime: 1000 * 60 * 120,
      // Smart retry: 3 attempts total for transient errors, none for real client errors.
      // Solves the "I have to reload to get my data" problem — Supabase Pooler often
      // returns 502/503/504 on cold-start, and mobile networks drop one packet here
      // and there. Without retry, each glitch becomes a visible failure.
      retry: (failureCount, error) => {
        const msg = error instanceof Error ? error.message : "";
        // Permanent / authoritative errors — never retry, the answer won't change
        // (auth, permissions, validation, not-found):
        if (/^(400|401|403|404|409|410|422):/.test(msg)) return false;
        // Everything else (network failure, timeout, 408/425/429/500/502/503/504,
        // dropped connection mid-stream) is transient — try up to 3 times total.
        return failureCount < 2;
      },
      // Exponential backoff: 1s → 3s → 6s. Gives Supabase enough time to recover
      // from a cold-start without making the user wait forever.
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2.5, attemptIndex), 6000),
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
  "/api/dashboard/widgets": CACHE_TIMES.MEDIUM,
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
    '/api/auth/me',
  ];
  for (const url of endpoints) {
    const cached = getCachedData(url);
    if (cached !== undefined) {
      queryClient.setQueryData([url], cached);
    }
  }
}

export { CACHE_TIMES };
