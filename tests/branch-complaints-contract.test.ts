import { describe, expect, it } from "vitest";
import {
  branchComplaintCreateSchema,
  branchComplaintPatchSchema,
  branchComplaintTransitionSchema,
  getBranchComplaintTransition,
} from "../shared/branch-complaints";

describe("branch complaints contract", () => {
  it("whitelists create and patch fields", () => {
    expect(branchComplaintCreateSchema.safeParse({
      branchId: "b1", subject: "شكوى", description: "تفاصيل", category: "service",
      priority: "normal", status: "closed",
    }).success).toBe(false);
    expect(branchComplaintPatchSchema.safeParse({
      version: 1, subject: "تعديل", branchId: "b2",
    }).success).toBe(false);
  });

  it("enforces transition reasons and resolution", () => {
    expect(branchComplaintTransitionSchema.safeParse({ version: 1, action: "resolve", reason: "" }).success).toBe(false);
    expect(branchComplaintTransitionSchema.safeParse({ version: 1, action: "close", reason: "" }).success).toBe(false);
    expect(branchComplaintTransitionSchema.safeParse({ version: 1, action: "reopen", reason: "إعادة المعالجة" }).success).toBe(true);
  });

  it("implements the lifecycle without implicit transitions", () => {
    expect(getBranchComplaintTransition("open", "start")).toBe("in_progress");
    expect(getBranchComplaintTransition("in_progress", "resolve")).toBe("resolved");
    expect(getBranchComplaintTransition("resolved", "close")).toBe("closed");
    expect(getBranchComplaintTransition("closed", "reopen")).toBe("open");
    expect(getBranchComplaintTransition("open", "close")).toBeNull();
    expect(getBranchComplaintTransition("resolved", "reopen")).toBe("open");
  });
});