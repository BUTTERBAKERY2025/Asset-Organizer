import { syntheticBoard } from "./fixtures";

/** Never invokes queryFn: the exact page's fetch expression is inert in this preview. */
export function useQuery<T>(options: { queryKey: readonly unknown[]; queryFn?: (context: { signal: AbortSignal }) => Promise<unknown>; [key: string]: unknown }) {
  if (options.queryKey[0] !== "/api/branch-operations/summary") {
    throw new Error(`No synthetic fixture for query ${String(options.queryKey[0])}`);
  }
  return { data: syntheticBoard as T, error: null as Error | null, isError: false, isLoading: false, isFetching: false, refetch: async () => ({ data: syntheticBoard as T }) };
}
const client = {
  cancelQueries: async (_options: unknown) => {},
  removeQueries: (_options: unknown) => {},
  setQueryData: (_key: unknown, _update: unknown) => {},
};
export function useQueryClient() { return client; }