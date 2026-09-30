import { describe, expect, it } from "vitest";
import type { OperationsQueueItem } from "@shared/operations-center";
import { filterOperationsQueue } from "../client/src/lib/operations-center-queue";

const row = (sourceType: string, owner: string, ownerId: string | null): OperationsQueueItem => ({
  id: `${sourceType}-${ownerId}`, sourceType, sourceId: "1", step: "pending", branchId: "b1",
  module: "maintenance", title: "بلاغ", status: "open", owner, ownerId, dueAt: null,
  href: "/maintenance?ticketId=1&branchId=b1", actions: [],
});

describe("operations queue assignment", () => {
  const items = [
    row("maintenance", "u1", null), // A stage label may look like the user's ID.
    row("maintenance", "مدير التشغيل", "u1"),
    row("quality_check", "مدير التشغيل", "u2"),
    row("quality_check", "غير محدد", null),
  ];
  it("uses only the persisted ownerId for mine", () => {
    expect(filterOperationsQueue(items, "u1", "mine", "all")).toEqual([items[1]]);
    expect(filterOperationsQueue(items, undefined, "mine", "all")).toEqual([]);
  });
  it("keeps unassigned workflow steps waiting without claiming another assignee", () => {
    expect(filterOperationsQueue(items, "u1", "waiting", "all")).toEqual([items[0], items[2], items[3]]);
    expect(filterOperationsQueue(items, "u1", "waiting", "maintenance")).toEqual([items[0]]);
  });
});