export type BranchOperationsGroup = "operations" | "sales" | "people";

export type BranchOperationsCardState = "ready" | "error";

export interface BranchOperationsMetric {
  label: string;
  value: number;
  unit?: string;
}

export interface BranchOperationsAlert {
  label: string;
  count: number;
  href: string;
}

export interface BranchOperationsAction {
  label: string;
  href: string;
}

export interface BranchOperationsCard {
  id:
    | "maintenance"
    | "complaints"
    | "waste"
    | "purchasing"
    | "kitchen"
    | "closing"
    | "targets"
    | "sales"
    | "employees"
    | "documents"
    | "advances";
  title: string;
  group: BranchOperationsGroup;
  href: string;
  state: BranchOperationsCardState;
  metrics: BranchOperationsMetric[];
  alerts: BranchOperationsAlert[];
  actions?: BranchOperationsAction[];
}

export interface BranchOperationsSummaryResponse {
  branchId: string;
  generatedAt: string;
  businessDate: string;
  cards: BranchOperationsCard[];
}