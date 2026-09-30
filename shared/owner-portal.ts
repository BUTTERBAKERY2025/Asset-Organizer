/** Read-only owner API. Monetary totals are reported journal sales, not net sales. */
export type OwnerMarketingSection = "campaigns" | "calendar" | "tasks" | "content";
export interface OwnerBranch { id: string; name: string }
export interface OwnerBranchesResponse { branches: OwnerBranch[]; generatedAt: string }
export interface OwnerSalesResponse {
  latestReportDate?: string | null;
  sourceLabel: string;
  generatedAt: string;
  dateFrom: string;
  dateTo: string;
  totals: { sales: number; journalCount: number; reportedBranches: number; branchCount: number; previousSales: number | null };
  branches: Array<OwnerBranch & { sales: number | null; journalCount: number; status: "reported" | "missing"; previousSales: number | null }>;
}
export interface OwnerOverviewResponse extends OwnerSalesResponse {
  assets: { total: number; needsAttention: number };
  marketing: { activeCampaigns: number };
  shareholders: { count: number; totalShares: number };
}
export interface OwnerAssetsResponse {
  items: Array<{ id: string; name: string; branchName: string; status: string; category: string | null; imageUrl: string | null; maintenanceSummary: string | null }>;
  page: number; pageSize: number; total: number; generatedAt: string;
}
export interface OwnerShareholdersResponse {
  items: Array<{ id: number; name: string; shares: number; ownershipPercent: number | null }>;
  summary: { count: number; totalShares: number; ownershipBasis: string };
  page: number; pageSize: number; total: number; generatedAt: string;
}
export interface OwnerMarketingResponse {
  items: Array<{ id: string; title: string; status: string; date: string | null; summary: string | null; imageUrl: string | null }>;
  section: OwnerMarketingSection;
  page: number; pageSize: number; total: number; scopeLabel: "على مستوى الشركة"; generatedAt: string;
}