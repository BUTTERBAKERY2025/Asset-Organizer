import { describe, expect, it } from "vitest";
import { makeOperationsQueueItem, operationsAdvanceFinalAuthority, operationsAdvanceDecisionMetadata, operationsDecisionMetadata, operationsDecisionQueue, operationsSalesSeries } from "../shared/operations-center";

const row = () => makeOperationsQueueItem("cashier_journal", 71, "submitted", "a", "cashier_journal", "يومية", "submitted", "/cashier-journals?branchId=a", "مراجع", null, "actor");

describe("truthful decision desk", () => {
  it("does not turn actor assignment or module view into awaiting approval", () => {
    const assigned = row();
    expect(operationsDecisionQueue([assigned], "actor", "2026-10-01T00:00:00Z").awaitingDecision).toEqual([]);
    expect(operationsDecisionMetadata(assigned, "actor", false, true, { module: "cashier_journal", action: "approve" }, "مراجعة")).toBeUndefined();
  });
  it("requires both the eligible stage and current actor action grant", () => {
    const assigned = row();
    expect(operationsDecisionMetadata(assigned, "actor", true, false, { module: "cashier_journal", action: "approve" }, "مراجعة")).toBeUndefined();
    const item = { ...assigned, decision: operationsDecisionMetadata(assigned, "actor", true, true, { module: "cashier_journal", action: "approve" }, "مراجعة") };
    expect(operationsDecisionQueue([item], "actor", "2026-10-01T00:00:00Z").awaitingDecision).toEqual([item]);
    expect(operationsDecisionQueue([item], "another-actor", "2026-10-01T00:00:00Z").awaitingDecision).toEqual([]);
    expect(item.decision?.href).toContain("/cashier-journals/71?");
  });
  it("does not turn a missed date, quality failure, or an assignment into emergency", () => {
    const overdue = { ...row(), status: "failed", dueAt: "2026-09-01T00:00:00Z" };
    expect(operationsDecisionQueue([overdue], "actor", "2026-10-01T00:00:00Z").critical).toEqual([]);
    expect(operationsDecisionQueue([{ ...overdue, priorityReason: "urgent" }], "actor", "2026-10-01T00:00:00Z").critical).toHaveLength(1);
  });
  it("keeps missing sales dates null while preserving true recorded zero sales", () => {
    expect(operationsSalesSeries(["2026-09-29", "2026-09-30"], [{ branchId: "a", date: "2026-09-30", sales: 0 }]))
      .toEqual([{ date: "2026-09-29", value: null, recordedBranches: 0 }, { date: "2026-09-30", value: 0, recordedBranches: 1 }]);
    expect(operationsSalesSeries(["2026-09-30"], [])).toEqual([{ date: "2026-09-30", value: null, recordedBranches: 0 }]);
  });
  it("matches advance final-role authority, not a generic edit grant", () => {
    for (const role of ["admin", "super_admin", "hr_manager"]) expect(operationsAdvanceFinalAuthority(role, false)).toBe(true);
    expect(operationsAdvanceFinalAuthority("hr_specialist", false)).toBe(false);
    expect(operationsAdvanceFinalAuthority("hr_specialist", true)).toBe(true);
    for (const role of ["operations_manager", "branch_manager", "manager", "viewer"]) expect(operationsAdvanceFinalAuthority(role, true)).toBe(false);
  });
  it("separates advance preliminary approval, HR signature preparation and signed final approval", () => {
    const advance = (status: string) => makeOperationsQueueItem("advance", 7, status, "a", "hr_advances", "سلفة", status, "/hr/advances?branchId=a");
    // Both review and send-for-signature endpoints accept either approve or edit.
    expect(operationsAdvanceDecisionMetadata(advance("pending"), "me", false, false, true)?.capability).toBe("approve");
    expect(operationsAdvanceDecisionMetadata(advance("pending"), "me", false, true, false)?.capability).toBe("approve");
    for (const status of ["pre_approved", "awaiting_signature", "signed"]) expect(operationsAdvanceDecisionMetadata(advance(status), "me", false, true, true)).toBeUndefined();
    for (const status of ["pending", "pre_approved"]) expect(operationsAdvanceDecisionMetadata(advance(status), "me", true, false, true)?.capability).toBe("review");
    expect(operationsAdvanceDecisionMetadata(advance("awaiting_signature"), "me", true, true, true)).toBeUndefined();
    expect(operationsAdvanceDecisionMetadata(advance("signed"), "me", true, false, true)?.capability).toBe("approve");
    for (const status of ["approved", "rejected", "pending", "signed"]) expect(operationsAdvanceDecisionMetadata(advance(status), "me", true, false, false)).toBeUndefined();
  });
  it("links the complaint record using the query parameter consumed by the existing detail drawer", () => {
    const item = makeOperationsQueueItem("branch_complaint", 9, "open", "a", "branch_complaints", "شكوى", "open", "/branch-complaints?branchId=a");
    expect(item.href).toBe("/branch-complaints?branchId=a&complaintId=9");
    expect(item.href).not.toContain("/branch-complaints/9");
  });
});