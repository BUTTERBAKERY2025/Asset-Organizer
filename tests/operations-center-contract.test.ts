import { describe, expect, it } from "vitest";
import { availableCardMetrics, deduplicateOperationsQueue, makeOperationsQueueItem, qualityPassRate, sourceRecordHref, validateOperationsBranches } from "../shared/operations-center";
import type { OperationsCard, OperationsQueueItem } from "../shared/operations-center";

describe("operations center projection invariants", () => {
  it("rejects an unauthorized or missing branch in the entire requested set", () => {
    expect(validateOperationsBranches(["a", "b"], ["a"], ["a", "b"])).toBe(false);
    expect(validateOperationsBranches(["a", "missing"], null, ["a"])).toBe(false);
    expect(validateOperationsBranches(["a", "b"], ["a", "b"], ["a", "b"])).toBe(true);
  });
  it("does not fabricate a quality rate when no inspections were recorded", () => {
    expect(qualityPassRate([])).toBeNull();
    expect(qualityPassRate(["passed", "failed", "needs_improvement"])).toBeCloseTo(100 / 3);
  });
  it("keeps healthy cards while excluding a partially failed source from totals", () => {
    const ready = {
      id: "maintenance", branchId: "a", module: "maintenance", group: "operations",
      href: "/maintenance", title: "Maintenance", state: "ready",
      metrics: [{ key: "open", label: "Open", value: 2, source: "maintenance",
        definition: "Open tickets", period: "current", scope: ["a"], asOf: "2026-01-01T00:00:00Z",
        coverage: "complete" }], alerts: [],
    } as OperationsCard;
    const failed = { ...ready, id: "kitchen", state: "error",
      error: "Source unavailable", metrics: [] } as OperationsCard;
    expect(availableCardMetrics([ready, failed])).toEqual(ready.metrics);
  });
  it("keeps canonical source and branch identity, not URL identity", () => {
    const item = (id: string): OperationsQueueItem => ({
      id, sourceType: "maintenance", sourceId: id.split(":")[1], step: "open", branchId: "a",
      module: "maintenance", title: "Maintenance", status: "open", owner: "unknown", ownerId: null, dueAt: null,
      href: "/maintenance?branchId=a", actions: [{ label: "Read", href: "/maintenance?branchId=a", capability: "read" }],
    });
    expect(deduplicateOperationsQueue([item("maintenance:1:open:a"), item("maintenance:2:open:a"),
      item("maintenance:1:open:a")]).map(row => row.id))
      .toEqual(["maintenance:1:open:a", "maintenance:2:open:a"]);
  });
  it.each([
    ["maintenance", "/maintenance", "ticketId"],
    ["kitchen_order", "/central-kitchen-orders?stage=dispatched", "orderId"],
    ["transfer", "/transfer-requests?direction=incoming", "transferId"],
    ["reverse_movement", "/reverse-logistics", "movementId"],
    ["delivery_assignment", "/driver-deliveries", "deliveryId"],
    ["leave", "/hr/leaves", "leaveId"],
    ["attendance_record", "/employee-attendance-report", "attendanceId"],
    ["advance", "/hr/advances", "advanceId"],
    ["quality_check", "/quality-control", "checkId"],
    ["daily_closure", "/branch-daily-closing?date=2026-01-01", "closureId"],
  ])("links exact %s source ID without losing branch scope", (type, path, parameter) => {
    const href = sourceRecordHref(type, 41, `${path}${path.includes("?") ? "&" : "?"}branchId=a`);
    const url = new URL(href, "https://local.invalid");
    expect(url.searchParams.get(parameter)).toBe("41");
    expect(url.searchParams.get("branchId")).toBe("a");
  });
  it("uses the existing cashier journal detail path", () => {
    expect(sourceRecordHref("cashier_journal", 41, "/cashier-journals?branchId=a&status=draft"))
      .toBe("/cashier-journals/41?branchId=a");
  });
  it("does not claim unresolved manager turns as mine", () => {
    const unresolved = makeOperationsQueueItem("advance", 41, "pending", "a", "hr_advances",
      "Advance", "pending", "/hr/advances?branchId=a", "مدير التشغيل");
    const assigned = makeOperationsQueueItem("maintenance", 42, "assigned", "a", "maintenance",
      "Maintenance", "assigned", "/maintenance?branchId=a", "Manager", null, "manager-1");
    expect(unresolved.owner).toBe("مدير التشغيل");
    expect(unresolved.ownerId).toBeNull();
    expect(unresolved.actions[0].href).toBe(unresolved.href);
    expect(assigned.ownerId).toBe("manager-1");
    expect(deduplicateOperationsQueue([unresolved, assigned, unresolved])).toHaveLength(2);
  });
});