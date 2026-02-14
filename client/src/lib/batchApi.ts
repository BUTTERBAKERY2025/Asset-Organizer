import { useQueries, UseQueryResult } from "@tanstack/react-query";

interface BatchRequest {
  url: string;
}

interface BatchResponse {
  results: Array<{
    url: string;
    status: number;
    data: any;
  }>;
}

export async function fetchBatch(urls: string[]): Promise<BatchResponse> {
  const res = await fetch("/api/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ requests: urls.map(url => ({ url })) }),
  });
  
  if (!res.ok) {
    throw new Error(`Batch request failed: ${res.status}`);
  }
  
  return res.json();
}

export function useBatchQueries<T extends Record<string, string>>(
  endpoints: T,
  options?: { enabled?: boolean; staleTime?: number }
): Record<keyof T, { data: any; isLoading: boolean; error: any }> {
  const keys = Object.keys(endpoints) as (keyof T)[];
  const urls = Object.values(endpoints);
  
  const queryResults = useQueries({
    queries: keys.map((key, index) => ({
      queryKey: [urls[index]],
      staleTime: options?.staleTime ?? 30000,
      enabled: options?.enabled !== false,
    })),
  });

  const result = {} as Record<keyof T, { data: any; isLoading: boolean; error: any }>;
  keys.forEach((key, index) => {
    result[key] = {
      data: queryResults[index]?.data,
      isLoading: queryResults[index]?.isLoading ?? true,
      error: queryResults[index]?.error,
    };
  });

  return result;
}
