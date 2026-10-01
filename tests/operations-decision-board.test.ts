import { describe, expect, it } from "vitest";
import { makeOperationsQueueItem, operationsDecisionBoardProjection, operationsDecisionMetadata, operationsDecisionQueue } from "../shared/operations-center";

describe("operations decision evidence", () => {
  it("deduplicates a persisted record across workflow steps without merging different records sharing a destination", () => {
    const first = makeOperationsQueueItem("maintenance", 1, "open", "a", "maintenance", "بلاغ", "open", "/maintenance?branchId=a");
    const next = { ...first, id: "maintenance:1:assigned:a", step: "assigned" };
    const other = makeOperationsQueueItem("maintenance", 2, "open", "a", "maintenance", "بلاغ", "open", "/maintenance?branchId=a");
    expect(operationsDecisionQueue([first, next, other], undefined, "2026-09-30T12:00:00Z").unique.map(row => row.sourceId)).toEqual(["1", "2"]);
  });
  it("only calls a record urgent after a real deadline, and only calls a person assigned when ownerId matches", () => {
    const overdue = makeOperationsQueueItem("maintenance", 1, "open", "a", "maintenance", "بلاغ", "open", "/maintenance", "manager", "2026-09-29T00:00:00Z");
    const assigned = makeOperationsQueueItem("maintenance", 2, "open", "a", "maintenance", "بلاغ", "open", "/maintenance", "manager", null, "me");
    const unclear = makeOperationsQueueItem("maintenance", 3, "open", "a", "maintenance", "بلاغ", "open", "/maintenance", "manager");
    const result = operationsDecisionQueue([overdue, assigned, unclear], "me", "2026-09-30T12:00:00Z");
    expect(result.urgent).toEqual([overdue]);
    expect(result.assigned).toEqual([assigned]);
    expect(result.followup).toEqual([unclear]);
  });
  it("keeps source-declared urgent priority distinct from overdue, assigned and followup", () => {
    const sourceUrgent = { ...makeOperationsQueueItem("maintenance", 4, "open", "a", "maintenance", "بلاغ", "open", "/maintenance", "manager", "2026-09-29T00:00:00Z", "me"), priorityReason: "urgent" as const };
    const overdue = makeOperationsQueueItem("maintenance", 5, "open", "a", "maintenance", "بلاغ", "open", "/maintenance", "manager", "2026-09-29T00:00:00Z", "me");
    const assigned = makeOperationsQueueItem("maintenance", 6, "open", "a", "maintenance", "بلاغ", "open", "/maintenance", "manager", null, "me");
    const followup = makeOperationsQueueItem("maintenance", 7, "open", "a", "maintenance", "بلاغ", "open", "/maintenance");
    const result = operationsDecisionQueue([sourceUrgent, overdue, assigned, followup], "me", "2026-09-30T12:00:00Z");
    expect(result.critical).toEqual([sourceUrgent]);
    expect(result.urgent).toEqual([overdue]);
    expect(result.assigned).toEqual([assigned]);
    expect(result.followup).toEqual([followup]);
    expect([...result.critical, ...result.urgent, ...result.assigned, ...result.followup]).toHaveLength(result.unique.length);
  });
});

describe("projection consumed by the decision board", () => {
  const asOf = "2026-09-30T12:00:00Z";
  const project = (rows: Parameters<typeof operationsDecisionBoardProjection>[0]) =>
    operationsDecisionBoardProjection(rows, ["a"], "me", asOf, "2026-09-30");

  it("surfaces overdue in the existing priority workspace without classifying it as an emergency or duplicating identities", () => {
    const critical = { ...makeOperationsQueueItem("maintenance", 11, "open", "a", "maintenance", "Emergency", "open", "/maintenance",
      "me", "2026-09-29T12:00:00Z", "me"), priorityReason: "urgent" as const };
    const overdue = makeOperationsQueueItem("branch_complaint", 12, "in_progress", "a", "branch_complaints", "Overdue", "in_progress",
      "/branch-complaints", "me", "2026-09-29T12:00:00Z", "me");
    const missing = makeOperationsQueueItem("maintenance", 13, "open", "a", "maintenance", "No deadline", "open", "/maintenance");
    const malformed = { ...missing, id: "maintenance:14:open:a", sourceId: "14", dueAt: "not-a-date" };
    const future = { ...missing, id: "maintenance:15:open:a", sourceId: "15", dueAt: "2026-10-01T12:00:00Z" };
    const equal = { ...missing, id: "maintenance:16:open:a", sourceId: "16", dueAt: asOf };
    const deniedBranch = { ...overdue, id: "branch_complaint:12:in_progress:b", branchId: "b" };
    const result = project([critical, overdue, { ...overdue, id: "branch_complaint:12:open:a", step: "open" },
      missing, malformed, future, equal, deniedBranch]);
    expect(result.critical).toEqual([critical]);
    expect(result.overdue).toEqual([overdue]);
    expect(result.priority).toEqual([critical, overdue]);
    expect(result.followup).toEqual([missing, malformed, future, equal]);
    expect(result.today).toEqual([equal]);
    expect(result.queue).toHaveLength(6);
  });

  it("does not make quality observations completable tasks, decisions or overdue work", () => {
    const quality = { ...makeOperationsQueueItem("quality_check", 21, "failed", "a", "quality_control", "دليل جودة يحتاج التحقيق", "failed",
      "/quality-control", "me", "2026-09-30T01:00:00Z", "me"), priorityReason: "critical" as const };
    // Even malformed metadata must not invent a lifecycle absent from this source.
    const evidence = { ...quality, decision: operationsDecisionMetadata(quality, "me", true, true,
      { module: "quality_control", action: "approve" }, "Invalid decision") };
    const result = project([evidence]);
    expect(result.evidence).toEqual([evidence]);
    expect(result.queue).toEqual([evidence]);
    for (const cohort of [result.critical, result.overdue, result.priority, result.followup, result.decision, result.today])
      expect(cohort).toEqual([]);
  });

  it("uses Riyadh dates for today's recorded deadlines and never equates assignments with a decision", () => {
    const today = makeOperationsQueueItem("maintenance", 31, "assigned", "a", "maintenance", "بلاغ", "assigned", "/maintenance",
      "me", "2026-09-29T22:00:00Z", "me");
    const resolved = makeOperationsQueueItem("branch_complaint", 32, "resolved", "a", "branch_complaints", "شكوى", "resolved",
      "/branch-complaints?branchId=a", "another-user");
    resolved.decision = operationsDecisionMetadata(resolved, "me", true, true,
      { module: "branch_complaints", action: "approve" }, "مراجعة الحل وإغلاق الشكوى");
    const otherActor = { ...resolved, id: "branch_complaint:33:resolved:a", sourceId: "33",
      decision: { ...resolved.decision!, actorId: "another-user" } };
    const result = project([today, resolved, otherActor]);
    expect(result.today).toEqual([today]);
    expect(result.decision).toEqual([resolved]);
    expect(result.decision[0].decision?.href).toBe("/branch-complaints?branchId=a&complaintId=32");
  });
});