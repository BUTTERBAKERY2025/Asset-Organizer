export const emptyCampaignForm = () => ({
  scopeType: "central" as const,
  branchId: null as string | null,
  name: "", nameAr: "", description: "", objective: "", season: "",
  totalBudget: 0, startDate: "", endDate: "", targetAudience: "", channels: "", notes: "",
});