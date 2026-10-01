import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  parseOperationsSupplyQuery, supplyPagePlan, uniqueSupplyRecords, type OperationsSupplyRecord,
} from "../shared/operations-supply";
import {
  operationsSupplySql, kitchenSupplyActiveSql, reverseSupplyActiveSql,
  supplyTransferSourceAuthority, supplyMainWarehouseAuthority, type SupplyActor, type SupplyGrants,
} from "../server/operations-supply-predicates";

const query = vi.hoisted(() => vi.fn());
vi.mock("../server/db", () => ({ pool: { query }, db: {} }));
vi.mock("../server/auth", () => ({
  getAllowedBranchIds: (req: any) => req.allowed,
}));
vi.mock("../server/branch-operations", () => ({
  hasEffectiveViewPermission: async (req: any, module: string, action: string) =>
    req.grants?.includes(`${module}:${action}`) === true,
}));
vi.mock("../server/central-kitchen-routing", () => ({ kitchenActionAllowed: async () => false }));
import { kitchenSupplyDeadline, supplyDeliveryDeadline, projectOperationsSupply, projectSupplyRecord } from "../server/operations-supply";

const actor: SupplyActor = { id: "operator", role: "operations_manager", branchId: "ungranted", allowed: ["a", "b"] };
const grants: SupplyGrants = {
  kitchenView: true, kitchenEdit: true, kitchenApprove: true,
  transferView: true, transferEdit: true, warehouseView: true, warehouseEdit: true,
  productionView: true, productionEdit: true, deliveryView: true, deliveryEdit: true, deliveryApprove: true,
  returnKinds: ["material_return", "product_return", "warehouse_transfer"],
};
const allPermissions = ["central_kitchen_orders", "warehouse", "production", "delivery_tasks", "branch_supply"]
  .flatMap(module => ["view", "edit", "approve", "export"].map(action => `${module}:${action}`));
const req = (extra: Record<string, unknown> = {}) => ({
  currentUser: { id: actor.id, role: actor.role, branchId: actor.branchId },
  allowed: actor.allowed, grants: allPermissions, authPermissions: [], ...extra,
}) as any;

describe("explicit supply scope and full source pagination", () => {
  beforeEach(() => query.mockReset());
  it.each([{}, { branchIds: "all" }, { branchIds: "a,a" }, { branchIds: ["a"] }, { branchIds: "a," },
    { branchIds: "a", source: "maintenance" }, { branchIds: "a", offset: "-1" },
    { branchIds: "a", limit: "101" }, { branchIds: "a", offset: ["0"] }])("fails closed on invalid scope/query %j", input => {
    expect(() => parseOperationsSupplyQuery(input)).toThrow();
  });
  it("does not cap the oldest reachable offset at 100 or 10000", () => {
    expect(parseOperationsSupplyQuery({ branchIds: "a,b", offset: "20001", limit: "100" }).offset).toBe(20001);
    expect(supplyPagePlan([{ source: "kitchen", count: 350 }, { source: "transfers", count: 220 }], 325, 50))
      .toEqual([{ source: "kitchen", offset: 325, limit: 25 }, { source: "transfers", offset: 0, limit: 25 }]);
    expect(supplyPagePlan([{ source: "reverse", count: 20000 }], 19000, 50))
      .toEqual([{ source: "reverse", offset: 19000, limit: 50 }]);
  });
  it("rejects the entire request when any branch is not granted, before any source query", async () => {
    await expect(projectOperationsSupply(req(), ["a", "ungranted"], "all")).rejects.toMatchObject({ status: 403 });
    expect(query).not.toHaveBeenCalled();
  });
  it("rejects nonexistent branches even for a globally scoped actor", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "a", name: "A" }] });
    await expect(projectOperationsSupply(req({ allowed: null }), ["a", "missing"], "all")).rejects.toMatchObject({ status: 403 });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("counts the entire active cohort and passes a real SQL offset beyond 100", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "a", name: "A" }] })
      .mockResolvedValueOnce({ rows: [{ total: "302" }] })
      .mockResolvedValueOnce({ rows: [
        { id: "201", status: "received", source_branch_id: "a", destination_branch_id: "b", inventory_mode: null, discrepancy_status: "open" },
      ] });
    const result = await projectOperationsSupply(req(), ["a"], "kitchen", 101, 50);
    expect(result.summaries[0].value).toBe(302);
    expect(result.coverage.nextOffset).toBe(151);
    expect(result.records[0]).toMatchObject({ sourceId: "201", inventoryMode: "unknown", stage: "discrepancy_open", branchIds: ["a"] });
    const [sql, values] = query.mock.calls[2];
    expect(sql).toContain(kitchenSupplyActiveSql);
    expect(sql.indexOf("WHERE")).toBeLessThan(sql.indexOf("LIMIT"));
    expect(values).toEqual([["a"], ["a", "b"], 50, 101]);
    expect(query.mock.calls[1][0]).not.toContain("LIMIT");
  });
  it("forbidden and failed sources are null, never zero; a complete empty source is zero", async () => {
    query.mockResolvedValueOnce({ rows: [{ id: "a", name: "A" }] });
    const denied = await projectOperationsSupply(req({ grants: [] }), ["a"], "transfers");
    expect(denied.summaries[0]).toMatchObject({ value: null, coverage: "forbidden" });
    expect(denied.coverage.total).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    query.mockReset().mockResolvedValueOnce({ rows: [{ id: "a", name: "A" }] }).mockRejectedValueOnce(new Error("Unavailable database"));
    const failed = await projectOperationsSupply(req(), ["a"], "transfers");
    expect(failed.summaries[0]).toMatchObject({ value: null, coverage: "unavailable" });
    query.mockReset().mockResolvedValueOnce({ rows: [{ id: "a", name: "A" }] }).mockResolvedValueOnce({ rows: [{ total: "0" }] });
    const empty = await projectOperationsSupply(req(), ["a"], "transfers");
    expect(empty.summaries[0]).toMatchObject({ value: 0, coverage: "complete" });
    expect(empty.coverage.priorityCoverage).toBe("unavailable");
  });
});

describe("authoritative source predicates, not role-expanded grants", () => {
  it("kitchen includes authorized supplier and requester sides, but branch manager requester only", () => {
    const supply = operationsSupplySql("kitchen", ["a"], actor, grants);
    expect(supply.where).toContain("k.central_kitchen_id=ANY($1");
    expect(supply.where).toContain("k.request_branch_id=ANY($1");
    expect(supply.where).toContain("k.discrepancy_status='open'");
    const branch = operationsSupplySql("kitchen", ["a"], { ...actor, role: "branch_manager" }, grants);
    expect(branch.where).not.toContain("k.central_kitchen_id=ANY");
    expect(branch.where).toContain("k.request_branch_id=ANY($2");
  });
  it("branch_supply is a main-warehouse destination request, never warehouse source operation", () => {
    const branch = { ...actor, role: "branch_manager" };
    const sql = operationsSupplySql("transfers", ["a", "b"], branch, grants);
    expect(sql.where).toContain("t.source_branch_id='main_warehouse'");
    expect(sql.where).toContain("t.destination_branch_id=ANY($2");
    expect(supplyTransferSourceAuthority(branch, "a")).toBe(false);
    expect(supplyTransferSourceAuthority(actor, "main_warehouse")).toBe(false);
    expect(supplyMainWarehouseAuthority(actor)).toBe(false);
    expect(supplyTransferSourceAuthority(actor, "ungranted")).toBe(false);
    expect(supplyTransferSourceAuthority(actor, "a")).toBe(true);
  });
  it("keeper source restriction is not broadened into destination read/receipt", () => {
    const keeper = { ...actor, role: "warehouse_keeper", allowed: ["main_warehouse"] };
    const sql = operationsSupplySql("transfers", ["main_warehouse"], keeper, grants);
    expect(sql.where).toContain("t.source_branch_id='main_warehouse'");
    expect(sql.where).not.toContain("OR t.destination_branch_id");
    expect(operationsSupplySql("delivery", ["main_warehouse"], keeper, grants).select).toContain("((false) AND");
  });
  it("received reverse movements await inspection; inspected damage excludes fully written-off records in SQL before pagination", () => {
    const sql = operationsSupplySql("reverse", ["a"], actor, grants);
    expect(sql.where).toContain(reverseSupplyActiveSql);
    expect(sql.where).toContain("'received'");
    expect(sql.where).toContain("r.damaged_quantity > r.written_off_quantity");
    expect(sql.where).toContain("r.kind<>'warehouse_transfer'");
    const branch = operationsSupplySql("reverse", ["a"], { ...actor, role: "branch_manager" },
      { ...grants, returnKinds: ["product_return"] });
    expect(branch.values[2]).toEqual(["product_return"]);
    expect(branch.where).toContain("r.source_branch_id=ANY($2");
    expect(branch.where).not.toContain("destination_branch_id=ANY");
  });
  it("includes warehouse-to-warehouse movements only in an explicit global warehouse desk", async () => {
    const global = { ...actor, allowed: null };
    expect(operationsSupplySql("reverse", ["main_warehouse"], global, grants).where)
      .toContain("OR r.kind='warehouse_transfer'");
    expect(operationsSupplySql("reverse", ["a"], global, grants).where).toContain("OR false");
    expect(operationsSupplySql("reverse", ["main_warehouse"], actor, grants).where)
      .toContain("r.kind<>'warehouse_transfer'");
    expect(operationsSupplySql("delivery", ["main_warehouse"], global, grants).where)
      .toContain("d.kind='warehouse_transfer'");
    expect(operationsSupplySql("delivery", ["a"], global, grants).where).toContain("AND false))");
    const movement = await projectSupplyRecord("reverse", {
      id: "8", kind: "warehouse_transfer", status: "received",
      source_branch_id: null, destination_branch_id: null,
      source_warehouse_id: 4, destination_warehouse_id: 6,
    }, ["main_warehouse"], global, grants, async () => false);
    expect(movement).toMatchObject({ branchId: "main_warehouse", branchIds: ["main_warehouse"],
      decision: { permission: { module: "warehouse", action: "edit" } } });
    expect(movement.reason).toContain("لا يرتبط بفرع");
  });
  it("delivery recipient read requires destination edit plus delivery approve, not merely view", () => {
    const sql = operationsSupplySql("delivery", ["b"], actor,
      { ...grants, deliveryApprove: false, kitchenEdit: false, transferEdit: false, warehouseEdit: false, productionEdit: false });
    expect(sql.select).toContain("AND false) AS can_receive");
    expect(sql.where).toContain("d.source_branch_id=ANY($2");
    expect(sql.where).toContain("d.destination_branch_id=ANY($1");
    expect(sql.where).toContain("d.source_status IS NOT NULL");
  });
});

describe("practical source records", () => {
  it("counts one canonical movement despite selected endpoint copies and different stages", async () => {
    const row = { id: "41", status: "approved", source_branch_id: "a", destination_branch_id: "b" };
    const record = await projectSupplyRecord("transfers", row, ["a", "b"], actor, grants, async () => false);
    expect(record.branchIds).toEqual(["a", "b"]);
    expect(record.id).toBe("transfer:41");
    expect(uniqueSupplyRecords([record, { ...record, branchId: "a", step: "changed" }])).toHaveLength(1);
    expect(record.decision).toBeUndefined();
    const pending = await projectSupplyRecord("transfers", { ...row, status: "pending" }, ["a", "b"], actor, grants, async () => false);
    expect(pending.decision).toMatchObject({ actorId: actor.id, permission: { module: "warehouse", action: "edit" } });
    const branchRecord = await projectSupplyRecord("transfers", row, ["b"], { ...actor, role: "branch_manager" }, grants, async () => false);
    expect(branchRecord.decision).toBeUndefined();
  });
  it("does not invent a deadline from a date or urgency from lateness", async () => {
    expect(kitchenSupplyDeadline({ needed_date: "2026-06-18", needed_time: null })).toBeNull();
    expect(kitchenSupplyDeadline({ needed_date: "2026-06-18", needed_time: "10:00" })).toBe("2026-06-18T07:00:00.000Z");
    const record = await projectSupplyRecord("kitchen", { id: "41", status: "dispatched",
      source_branch_id: "a", destination_branch_id: "b", inventory_mode: "shadow", needed_date: "2026-06-18" },
      ["b"], actor, grants, async () => false);
    expect(record).toMatchObject({ dueAt: null, priority: null, inventoryMode: "shadow", ownerId: null });
    expect(record.priorityReason).toBeUndefined();
    expect(record.priorityCoverage).toBe("unavailable");
    expect(record.decision).toBeUndefined();
  });
  it("records only absolute source deadlines for delivery, not guessed local time or urgency", async () => {
    expect(supplyDeliveryDeadline(new Date("2026-06-18T07:00:00.000Z"))).toBe("2026-06-18T07:00:00.000Z");
    expect(supplyDeliveryDeadline("2026-06-18T10:00:00+03:00")).toBe("2026-06-18T07:00:00.000Z");
    expect(supplyDeliveryDeadline("2026-06-18T10:00:00")).toBeNull();
    expect(supplyDeliveryDeadline("invalidZ")).toBeNull();
    const delivery = await projectSupplyRecord("delivery", {
      id: "14", status: "assigned", source_branch_id: "a", destination_branch_id: "b",
      source_type: "kitchen", source_id: "44", scheduled_at: new Date("2026-06-18T07:00:00.000Z"),
    }, ["a"], actor, grants, async () => false);
    expect(delivery.dueAt).toBe("2026-06-18T07:00:00.000Z");
    expect(delivery.deadlineLabel).toContain("التوصيل المجدول");
  });
  it("stage plus permission is insufficient when current kitchen routing declines the actor", async () => {
    const base = { id: "41", status: "requested", source_branch_id: "a", destination_branch_id: "b" };
    const no = await projectSupplyRecord("kitchen", base, ["a"], actor, grants, async () => false);
    const yes = await projectSupplyRecord("kitchen", base, ["a"], actor, grants, async () => true);
    expect(no.decision).toBeUndefined();
    expect(yes.decision?.awaitingActor).toBe(true);
    const destinationOnly = await projectSupplyRecord("kitchen", base, ["b"], { ...actor, allowed: ["b"] }, grants, async () => true);
    expect(destinationOnly.decision).toBeUndefined();
    const unknown = await projectSupplyRecord("kitchen", base, ["a"], actor, grants, async () => { throw new Error("Routing unavailable"); });
    expect(unknown.capabilityCoverage).toBe("unavailable");
    expect(unknown.decision).toBeUndefined();
  });
  it("never advertises a decision while a real-inventory kitchen is paused", async () => {
    const base = { id: "41", status: "requested", source_branch_id: "a", destination_branch_id: "b",
      inventory_mode: "real", runtime_mode: "paused" };
    let routingChecked = false;
    const paused = await projectSupplyRecord("kitchen", base, ["a"], actor, grants, async () => {
      routingChecked = true; return true;
    });
    expect(routingChecked).toBe(false);
    expect(paused.decision).toBeUndefined();
    expect(paused.capabilityCoverage).toBe("unavailable");
    expect(paused.reason).toContain("متوقفة مؤقتًا");
    const active = await projectSupplyRecord("kitchen", { ...base, runtime_mode: "real" },
      ["a"], actor, grants, async () => true);
    expect(active.decision?.awaitingActor).toBe(true);
  });
  it("requires documented carrier handover to approve receipt and true source-manager authority to close", async () => {
    const base = {
      id: "91", status: "awaiting_receipt", source_branch_id: "a", destination_branch_id: "b",
      source_type: "kitchen" as const, source_id: "41", source_status: "received", received_by: actor.id,
      can_receive: true, transport_mode: "external", evidence_ready: true, can_manage: true,
    };
    const row = { ...base, handover_recorded_at: new Date("2026-06-18T05:00:00.000Z") };
    expect((await projectSupplyRecord("delivery", base, ["b"], actor, grants, async () => false)).decision).toBeUndefined();
    expect((await projectSupplyRecord("delivery", row, ["b"], actor, grants, async () => false)).decision)
      .toMatchObject({ permission: { module: "delivery_tasks", action: "approve" } });
    const completion = { ...row, status: "receipt_approved", receipt_approved_by: actor.id };
    expect((await projectSupplyRecord("delivery", completion, ["a"], actor, grants, async () => false)).decision)
      .toMatchObject({ permission: { module: "delivery_tasks", action: "edit" } });
    for (const denied of [
      { ...completion, can_manage: false }, { ...completion, handover_recorded_at: null },
      { ...completion, evidence_ready: false }, { ...completion, exception_reason: "unresolved" },
      { ...completion, receipt_approved_by: "other" }, { ...completion, source_status: "dispatched" },
    ]) expect((await projectSupplyRecord("delivery", denied, ["a"], actor, grants, async () => false)).decision).toBeUndefined();
    const internal = await projectSupplyRecord("delivery",
      { ...completion, transport_mode: "internal" }, ["a"], actor, grants, async () => false);
    expect(internal.decision).toBeUndefined();
    expect(internal.responsibleRole).toContain("السائق");
  });
  it("delivery navigates through the legal source instead of forbidden standalone desk", async () => {
    const record = await projectSupplyRecord("delivery", {
      id: "91", status: "awaiting_receipt", source_branch_id: "a", destination_branch_id: "b",
      source_type: "kitchen", source_id: "41", source_status: "received", received_by: actor.id,
      can_receive: true, transport_mode: "internal", proof_present: true, inventory_mode: "real",
    }, ["b"], actor, grants, async () => false);
    expect(record.href).toContain("/central-kitchen-orders?");
    expect(record.href).toContain("orderId=41");
    expect(record.href).toContain("deliveryId=91");
    expect(record.href).not.toContain("driver-deliveries");
    expect(record.relatedSource).toEqual({ sourceType: "kitchen", sourceId: "41" });
    expect(record.decision?.awaitingActor).toBe(true);
    const otherActor = await projectSupplyRecord("delivery", {
      id: "91", status: "awaiting_receipt", source_branch_id: "a", destination_branch_id: "b",
      source_type: "kitchen", source_id: "41", source_status: "received", received_by: "someone-else",
      can_receive: true, transport_mode: "internal", proof_present: true,
    }, ["b"], actor, grants, async () => false);
    expect(otherActor.decision).toBeUndefined();
  });
  it("recipient delivery visibility cannot manufacture an illegal transfer or reverse page link", async () => {
    const branchActor = { ...actor, role: "branch_manager", allowed: ["b"] };
    const row = { id: "91", status: "assigned", source_branch_id: "a", destination_branch_id: "b" };
    const transfer = await projectSupplyRecord("delivery", { ...row, source_type: "material_transfer", source_id: "41" },
      ["b"], branchActor, grants, async () => false);
    expect(transfer.href).toBe("");
    expect(transfer.nextStep.href).toBeNull();
    const reverse = await projectSupplyRecord("delivery", { ...row, source_type: "reverse_movement", source_id: "41", kind: "product_return" },
      ["b"], branchActor, grants, async () => false);
    expect(reverse.href).toBe("");
    expect(reverse.actions).toEqual([]);
  });
});