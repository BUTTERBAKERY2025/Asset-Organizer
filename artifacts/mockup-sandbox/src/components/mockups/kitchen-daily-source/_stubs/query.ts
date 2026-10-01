import { useEffect, useState } from "react";
import { fixture, now } from "./fixtures";
import { previewNotice } from "./actions";

type QueryOptions<T> = {
  queryKey: readonly unknown[];
  queryFn?: (...args: any[]) => Promise<T>;
  enabled?: boolean;
  retry?: boolean | number | ((count: number, error: Error) => boolean);
  [key: string]: unknown;
};
type QueryState<T, E> =
  | { data: T; isSuccess: true; isError: false; error: null }
  | { data: undefined; isSuccess: false; isError: false; error: null }
  | { data: T | undefined; isSuccess: false; isError: true; error: E };
export type UseQueryResult<T, E = Error> = QueryState<T, E> & {
  isLoading: boolean; isPending: boolean; isFetching: boolean; isRefetchError: boolean;
  isPlaceholderData: boolean; dataUpdatedAt: number;
  refetch: () => Promise<UseQueryResult<T, E>>;
};
/** No queryFn/network effects, except the policy's local synthetic clock setup. */
export function useQuery<T = unknown, E = Error>(options: QueryOptions<T>): UseQueryResult<T, E> {
  const [, policyReady] = useState(0);
  const key = JSON.stringify(options.queryKey);
  useEffect(() => {
    // This exact hook initializes its monotonic clock inside queryFn. apiRequest
    // is already sandbox-local; invoking only this read never accesses a backend.
    if (options.queryKey[0] !== "/api/central-kitchen-orders/policy" || !options.queryFn) return;
    let active = true;
    void options.queryFn().then(() => { if (active) policyReady(value => value + 1); }).catch(error => {
      previewNotice(error instanceof Error ? error.message : String(error));
    });
    return () => { active = false; };
  }, [key]);
  return localResult<T, E>(options);
}
function localResult<T, E = Error>(options: QueryOptions<T>): UseQueryResult<T, E> {
  let state: QueryState<T, E> = { data: undefined, isSuccess: false, isError: false, error: null };
  if (options.enabled !== false) {
    try { state = { data: fixture(options.queryKey) as T, isSuccess: true, isError: false, error: null }; }
    catch (failure) { state = { data: undefined, isSuccess: false, isError: true, error: failure as E }; }
  }
  const result: UseQueryResult<T, E> = {
    ...state,
    isLoading: false, isPending: false, isFetching: false, isRefetchError: false,
    isPlaceholderData: false, dataUpdatedAt: state.data === undefined ? 0 : now.getTime(),
    refetch: async () => {
      if (options.queryKey[0] === "/api/central-kitchen-orders/policy" && options.queryFn) await options.queryFn();
      return result;
    },
  };
  return result;
}
export function useQueries<T = unknown>({ queries }: { queries: QueryOptions<T>[] }) {
  return queries.map(query => localResult(query));
}
type MutationOptions<T, V> = {
  mutationFn: (variables: V) => Promise<T>;
  onSuccess?: (data: T, variables: V) => unknown;
  onError?: (error: Error, variables: V) => unknown;
  [key: string]: unknown;
};
/** Never execute mutationFn/onSuccess; reject explicitly without sending writes. */
export function useMutation<T = unknown, V = void>(options: MutationOptions<T, V>) {
  function rejected(variables: V) {
    const error = new Error("Synthetic preview: action disabled; nothing was sent or changed.");
    previewNotice();
    options.onError?.(error, variables);
    return error;
  }
  return {
    isPending: false, isError: false, isSuccess: false, error: null as Error | null,
    mutate: (variables: V) => { rejected(variables); },
    mutateAsync: async (variables: V): Promise<T> => { throw rejected(variables); },
    reset: () => {},
  };
}
const client = {
  invalidateQueries: async (_options?: { queryKey?: readonly unknown[]; predicate?: (query: { queryKey: readonly unknown[] }) => boolean; exact?: boolean }, _other?: unknown) => {},
  refetchQueries: async (_options?: any) => {},
  cancelQueries: async (_options?: any) => {},
  removeQueries: (_options?: any) => {},
  setQueryData: (_key: any, _update: any) => {},
  getQueryData: <T,>(_key: unknown): T | undefined => undefined,
};
export type QueryClient = typeof client;
export function useQueryClient() { return client; }