import { queryClient } from "./queryClient";
import type { QueryKey } from "@tanstack/react-query";

interface OptimisticConfig<TData, TVariable> {
  queryKey: QueryKey;
  mutationFn: (variable: TVariable) => Promise<any>;
  updater: (old: TData | undefined, variable: TVariable) => TData;
  invalidateKeys?: QueryKey[];
}

export function createOptimisticMutation<TData, TVariable>(config: OptimisticConfig<TData, TVariable>) {
  return {
    mutationFn: config.mutationFn,
    onMutate: async (variable: TVariable) => {
      await queryClient.cancelQueries({ queryKey: config.queryKey });
      const previous = queryClient.getQueryData<TData>(config.queryKey);
      queryClient.setQueryData<TData>(config.queryKey, (old) => config.updater(old, variable));
      return { previous };
    },
    onError: (_err: any, _variable: TVariable, context: { previous?: TData } | undefined) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(config.queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: config.queryKey });
      if (config.invalidateKeys) {
        config.invalidateKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
    },
  };
}

export function instantInvalidate(...keys: QueryKey[]) {
  keys.forEach(key => {
    queryClient.invalidateQueries({ queryKey: key });
  });
}
