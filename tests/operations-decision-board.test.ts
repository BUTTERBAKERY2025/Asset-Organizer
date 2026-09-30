import { describe, expect, it } from "vitest";
import { makeOperationsQueueItem, operationsDecisionQueue } from "../shared/operations-center";

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
});