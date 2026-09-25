export type DeliverySourceType = "kitchen" | "material_transfer";
export type DeliveryStatus = "assigned" | "in_transit" | "awaiting_receipt" | "receipt_approved" | "completed" | "failed";

export interface DeliverySource {
  sourceType: DeliverySourceType;
  sourceId: number;
  sourceStatus: string;
  sourceLabel: string;
  sourceBranchId: string | null;
  sourceBranchName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  items: Array<{ id: number; name: string; quantity: number; unit: string | null }>;
}

export interface DeliveryDTO extends DeliverySource {
  id: number;
  driverId: string;
  driverName: string;
  vehicleNumber: string;
  scheduledAt: string | null;
  status: DeliveryStatus;
  receiverName: string | null;
  notes: string | null;
  proofPresent: boolean;
  proofAt: string | null;
  receiptApprovedBy: string | null;
  receiptApprovedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  capabilities: {
    canStart: boolean;
    canSubmitProof: boolean;
    canApproveReceipt: boolean;
    canComplete: boolean;
    canFail: boolean;
    canReassign: boolean;
  };
}

export const activeDeliveryStatuses = ["assigned", "in_transit", "awaiting_receipt", "receipt_approved"] as const;

export function deliveryTransitionAllowed(status: DeliveryStatus, action: "start" | "proof" | "approve-receipt" | "complete" | "fail" | "reassign"): boolean {
  switch (action) {
    case "start": return status === "assigned";
    case "proof": return status === "in_transit" || status === "awaiting_receipt";
    case "approve-receipt": return status === "awaiting_receipt";
    case "complete": return status === "receipt_approved";
    case "fail": return status === "assigned" || status === "in_transit" || status === "awaiting_receipt";
    case "reassign": return status === "assigned" || status === "in_transit" || status === "awaiting_receipt" || status === "failed";
  }
}

export function receiptMatchesSource(sourceType: DeliverySourceType, status: string, receivedBy: string | null, approverId: string): boolean {
  return !!receivedBy && receivedBy === approverId && status === (sourceType === "kitchen" ? "received" : "delivered");
}