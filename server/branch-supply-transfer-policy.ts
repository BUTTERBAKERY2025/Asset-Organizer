/** The destination's authority does not imply control of the warehouse source. */
export function branchSupplyTransferAllowed(
  action: "create" | "view" | "modify" | "cancel" | "receive" | "approve" | "reject" | "dispatch",
  transfer: { sourceBranchId: string | null; destinationBranchId: string | null; status?: string },
  authorizedDestination: boolean,
): boolean {
  if (!authorizedDestination || transfer.sourceBranchId !== "main_warehouse"
    || !transfer.destinationBranchId || transfer.destinationBranchId === "main_warehouse") return false;
  switch (action) {
    case "create": return true;
    case "view": return true;
    case "modify": return transfer.status === "pending";
    case "cancel": return transfer.status === "pending";
    case "receive": return transfer.status === "in_transit" || transfer.status === "delivered";
    case "approve":
    case "reject":
    case "dispatch": return false;
  }
}