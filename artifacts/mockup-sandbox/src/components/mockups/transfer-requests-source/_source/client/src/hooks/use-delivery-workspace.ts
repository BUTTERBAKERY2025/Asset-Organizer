import { sandboxFetch as fetch } from "../../../../_stubs/effects.ts";
import { useQuery } from "../../../../_stubs/query.ts";
import type { Delivery } from "../pages/driver-deliveries.tsx";
import type { DeliveryWorkspaceCarrier, DeliveryWorkspaceQuery, DeliveryWorkspaceResponse, DeliveryWorkspaceStatus } from "../../../shared/delivery-workspace-list.ts";

export type WorkspaceStatus = DeliveryWorkspaceStatus;
export type WorkspaceCarrier = DeliveryWorkspaceCarrier;
export type WorkspaceFilters = Omit<DeliveryWorkspaceQuery, "q" | "sourceBranchId" | "destinationBranchId"> & {
  q: string;
  sourceBranchId: string;
  destinationBranchId: string;
};
export type WorkspaceResponse = Omit<DeliveryWorkspaceResponse, "deliveries"> & {
  deliveries: Delivery[];
};

export function useDeliveryWorkspace(filters: WorkspaceFilters, enabled = true) {
  const params = new URLSearchParams({
    status: filters.status,
    carrier: filters.carrier,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  if (filters.q.trim()) params.set("q", filters.q.trim().slice(0, 160));
  if (filters.sourceType && filters.sourceId) {
    params.set("sourceType", filters.sourceType);
    params.set("sourceId", String(filters.sourceId));
  }
  if (filters.sourceBranchId !== "all") params.set("sourceBranchId", filters.sourceBranchId);
  if (filters.destinationBranchId !== "all") params.set("destinationBranchId", filters.destinationBranchId);
  const url = `/api/deliveries/workspace?${params}`;
  return useQuery({
    queryKey: ["/api/deliveries/workspace", url],
    queryFn: async (): Promise<WorkspaceResponse> => {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error(`${response.status}: تعذر تحميل مساحة التوصيل`);
      return response.json() as Promise<WorkspaceResponse>;
    },
    enabled,
    staleTime: 15_000,
  });
}