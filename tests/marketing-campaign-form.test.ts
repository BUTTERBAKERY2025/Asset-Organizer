import { describe, it, expect } from "vitest";
import { createFormControl } from "react-hook-form";
import { emptyCampaignForm } from "../client/src/lib/marketing-campaign-form";

describe("new campaign after closing an edit", () => {
  it("clears the previous edit values and validation when resetting for creation", () => {
    const form = createFormControl({ defaultValues: emptyCampaignForm() });
    form.reset({ ...emptyCampaignForm(), name: "Previous campaign", nameAr: "سابقة",
      branchId: "old-branch", description: "Previous description", startDate: "2026-10-03", totalBudget: 100 });
    form.setError("scopeType", { type: "required", message: "حدد نطاق الحملة" });
    form.reset(emptyCampaignForm());
    expect(form.getValues()).toEqual(emptyCampaignForm());
    expect(form.getFieldState("scopeType").error).toBeUndefined();
  });
});