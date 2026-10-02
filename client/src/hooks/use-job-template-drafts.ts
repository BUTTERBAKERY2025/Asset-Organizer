import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { TemplateContent, TemplateVersion, TemplateSummary, TemplateDetail } from "@shared/job-permission-templates";
export type { TemplateContent, TemplateVersion, TemplateSummary };

export interface DraftCatalog {
  modules: { id: TemplateContent["permissions"][number]["module"]; label: string; actions: TemplateContent["permissions"][number]["actions"] }[];
  proposals: TemplateContent[];
}
const base = "/api/rbac/job-template-drafts";
const read = async <T,>(url: string, signal?: AbortSignal): Promise<T> =>
  (await apiRequest("GET", url, undefined, undefined, { signal })).json();

export function useJobTemplateDrafts(userId: string, selectedId: number | null) {
  const client = useQueryClient();
  const listKey = [base, { adminId: userId }];
  const detailKey = [`${base}/${selectedId}`, { adminId: userId }];
  const options = { enabled: !!userId, retry: false, placeholderData: undefined, staleTime: 0, refetchOnMount: "always" as const };
  const catalog = useQuery({
    ...options, queryKey: [`${base}/catalog`, { adminId: userId }],
    queryFn: ({ signal }) => read<DraftCatalog>(`${base}/catalog`, signal),
  });
  const list = useQuery({
    ...options, queryKey: listKey,
    queryFn: ({ signal }) => read<TemplateSummary[]>(base, signal),
  });
  const detail = useQuery({
    ...options, queryKey: detailKey, enabled: !!userId && !!selectedId,
    queryFn: ({ signal }) => read<TemplateDetail>(`${base}/${selectedId}`, signal),
  });
  const save = useMutation({
    retry: false,
    mutationFn: async (input: { id: number | null; content: TemplateContent; expectedLatestVersion: number; changeReason: string }): Promise<TemplateDetail> => {
      const url = input.id ? `${base}/${input.id}/versions` : base;
      const body = input.id
        ? { expectedLatestVersion: input.expectedLatestVersion, content: input.content, changeReason: input.changeReason }
        : { content: input.content };
      return (await apiRequest("POST", url, body)).json();
    },
    onSuccess: (saved) => {
      // Append/create returns the authoritative history. Never leave a cached
      // pre-save detail behind for the next selection to initialize from.
      client.setQueryData([`${base}/${saved.id}`, { adminId: userId }], saved);
      void client.invalidateQueries({ queryKey: listKey });
    },
  });
  const seed = useMutation({
    retry: false,
    mutationFn: async () => (await apiRequest("POST", `${base}/seed-proposals`, {})).json(),
    onSuccess: () => { void client.invalidateQueries({ queryKey: listKey }); },
  });
  return { catalog, list, detail, save, seed };
}