import type { DeliveryDTO, DeliverySourceType, DeliveryStatus } from "./delivery.ts";

export type DeliveryWorkspaceStatus = "active" | "all" | DeliveryStatus;
export type DeliveryWorkspaceCarrier = "all" | "internal" | "road" | "naqel" | "other";
export interface DeliveryWorkspaceQuery {
  q?: string;
  status: DeliveryWorkspaceStatus;
  carrier: DeliveryWorkspaceCarrier;
  sourceType?: DeliverySourceType;
  sourceId?: number;
  sourceBranchId?: string;
  destinationBranchId?: string;
  page: number;
  pageSize: 25 | 50 | 100;
}
export interface DeliveryWorkspaceResponse {
  deliveries: DeliveryDTO[];
  total: number;
  page: number;
  pageSize: 25 | 50 | 100;
  counts: Record<DeliveryStatus | "active", number>;
  filters: {
    sources: Array<{ id: string; name: string }>;
    destinations: Array<{ id: string; name: string }>;
  };
}