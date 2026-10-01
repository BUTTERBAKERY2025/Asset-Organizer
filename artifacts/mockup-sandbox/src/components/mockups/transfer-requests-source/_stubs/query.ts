import { branches, deliveryWorkspace, itemsFor, transfers, warehouseItems } from "./fixtures";
import { previewNotice } from "./actions";

export type QueryClient = typeof client;
type QueryOptions<T> = {
  queryKey: readonly unknown[];
  queryFn?: (...args: any[]) => Promise<T>;
  enabled?: boolean;
  placeholderData?: T | ((previous: T | undefined) => T | undefined);
  [key: string]: unknown;
};
type QueryState<T> =
  | { data: T; isSuccess: true; isError: false; error: null }
  | { data: undefined; isSuccess: false; isError: false; error: null }
  | { data: undefined; isSuccess: false; isError: true; error: Error };
type QueryResult<T> = QueryState<T> & {
  isLoading: false; isPending: false; isFetching: false;
  refetch: () => Promise<QueryResult<T>>;
};
function fixture(key: readonly unknown[]): unknown {
  const route = String(key[0]);
  if (route === "/api/warehouse/items") return warehouseItems;
  if (route === "/api/warehouse/material-transfers") {
    if (key[2] === "items") return itemsFor(Number(key[1]));
    const status = key[1];
    const branch = key[2];
    return transfers.filter(row => (status === "all" || status === undefined || status === row.status || key[5] === true)
      && (branch === "all" || branch === undefined || row.destinationBranchId === branch || row.sourceBranchId === branch));
  }
  if (route === "/api/deliveries/workspace") return deliveryWorkspace;
  if (route === "/api/deliveries/capabilities") return { canAssign: false, canReport: false, canExport: false };
  if (route === "/api/deliveries") return { deliveries: [] };
  if (route === "/api/deliveries/sources") return { sources: [] };
  if (route === "/api/deliveries/drivers") return { drivers: [] };
  if (route === "/api/branches") return branches;
  throw new Error(`No synthetic fixture for query: ${JSON.stringify(key)}`);
}
/** Never executes queryFn, including the exact source's fetch expressions. */
export function useQuery<T = unknown>(options: QueryOptions<T>): QueryResult<T> {
  let state: QueryState<T>;
  try {
    state = options.enabled === false
      ? { data: undefined, isSuccess: false, isError: false, error: null }
      : { data: fixture(options.queryKey) as T, isSuccess: true, isError: false, error: null };
  } catch (error) {
    state = { data: undefined, isSuccess: false, isError: true, error: error instanceof Error ? error : new Error(String(error)) };
  }
  const result: QueryResult<T> = {
    ...state, isLoading: false, isPending: false, isFetching: false,
    refetch: async () => result,
  };
  return result;
}
type MutationOptions<T, V> = {
  mutationFn: (variables: V) => Promise<T>;
  onSuccess?: (data: T, variables: V) => unknown;
  onError?: (error: Error, variables: V) => unknown;
};
/** Reject locally, rather than simulating a successful real-world action. */
export function useMutation<T = unknown, V = void>(options: MutationOptions<T, V>) {
  function rejected(variables: V) {
    previewNotice();
    const error = new Error("Synthetic preview: this action is disabled; nothing was sent or changed.");
    options.onError?.(error, variables);
    return error;
  }
  return { isPending: false, isError: false, error: null as Error | null, mutate: (variables: V) => { rejected(variables); }, mutateAsync: async (variables: V): Promise<T> => { throw rejected(variables); }, reset: () => {} };
}
const client = {
  invalidateQueries: async (_options?: { queryKey?: readonly unknown[]; predicate?: (query: { queryKey: readonly unknown[] }) => boolean; exact?: boolean }, _other?: unknown) => {},
  cancelQueries: async (_options?: any) => {},
  removeQueries: (_options?: any) => {},
  setQueryData: (_key: any, _update: any) => {},
  getQueryData: <T,>(_key: unknown): T | undefined => undefined,
};
export function useQueryClient() { return client; }