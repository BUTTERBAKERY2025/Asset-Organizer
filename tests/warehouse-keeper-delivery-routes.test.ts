import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  assignments: new Map<number, any>(),
  eventCount: 0,
}));
vi.mock("../server/db", () => {
  const query = async (sql: string, args: any[] = []) => {
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: 0 };
    if (sql.includes("FROM material_transfers t LEFT JOIN branches")) {
      const id = Number(args[0]);
      return { rows: [{
        id, status: id === 3 ? "delivered" : "approved", label: `MT-${id}`,
        source_id: id === 2 ? "other_branch" : "main_warehouse",
        destination_id: "receiver_branch", received_by: id === 3 ? "receiver" : null,
        source_name: "Source", destination_name: "Receiver",
        destination_warehouse_id: null, source_warehouse_id: null,
        items: [{ id: 77, name: "Material", quantity: 2, unit: "kg" }],
      }], rowCount: 1 };
    }
    if (sql.includes("SELECT id FROM material_transfers WHERE id=")) return { rows: [{ id: args[0] }], rowCount: 1 };
    if (sql.includes("SELECT id FROM users WHERE id =")) return { rows: [{ id: args[0] }], rowCount: 1 };
    if (sql.includes("INSERT INTO delivery_assignments") && !sql.includes("events")) {
      const id = 101 + state.assignments.size;
      state.assignments.set(id, {
        id, source_type: args[0], source_id: args[1], driver_id: args[2], vehicle_number: args[3],
        driver_name: "Driver", scheduled_at: null, status: "assigned", receiver_name: null,
        notes: null, signature_data: null, proof_at: null, receipt_approved_by: null,
        receipt_approved_at: null, started_at: null, completed_at: null, failed_at: null,
        failure_reason: null, cancelled_at: null, cancellation_reason: null,
        handover_recorded_at: null, handover_acknowledged_at: null, handover_driver_id: null,
        handover_vehicle_number: null, handover_items: null, handover_fingerprint: null,
        handover_revision: 0, created_at: new Date(), updated_at: new Date(),
      });
      return { rows: [{ id }], rowCount: 1 };
    }
    if (sql.includes("FROM delivery_assignments a JOIN users u")) {
      const row = state.assignments.get(Number(args[0]));
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (sql.includes("INSERT INTO delivery_assignment_events")) return { rows: [{ id: ++state.eventCount }], rowCount: 1 };
    if (sql.includes("UPDATE delivery_assignments SET")) {
      const row = state.assignments.get(Number(args[0]));
      if (row) {
        if (sql.includes("receipt_approved_by")) row.receipt_approved_by = args[2];
        if (sql.includes("status=$2")) row.status = args[1];
      }
      return { rows: [], rowCount: row ? 1 : 0 };
    }
    throw new Error(`Unexpected mock query: ${sql}`);
  };
  return { pool: { connect: async () => ({ query, release() {} }), query }, db: {} };
});
vi.mock("../server/delivery-notifications", () => ({ enqueueDeliveryNotice: async () => {} }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  getAllowedBranchIds: (req: any) => req.currentUser.role === "admin" ? null
    : req.currentUser.role === "warehouse_keeper" ? ["main_warehouse"] : [req.currentUser.branchId],
  canAccessBranch: async (req: any, id: string) => req.currentUser.role === "admin" || req.currentUser.branchId === id,
}));

import { registerDeliveryRoutes } from "../server/delivery-routes";

const handlers = new Map<string, any[]>();
registerDeliveryRoutes({
  get: (path: string, ...handlersForPath: any[]) => handlers.set(`GET ${path}`, handlersForPath),
  post: (path: string, ...handlersForPath: any[]) => handlers.set(`POST ${path}`, handlersForPath),
} as any);
const keeper = { id: "keeper", role: "warehouse_keeper", branchId: null, isActive: "active" };
const receiver = { id: "receiver", role: "employee", branchId: "receiver_branch", isActive: "active" };
const driver = { id: "driver", role: "employee", jobTitle: "delivery", branchId: "receiver_branch", isActive: "active" };
const outsider = { id: "outsider", role: "employee", branchId: "other_branch", isActive: "active" };
async function call(method: string, path: string, user: any, body: any = {}, params: any = {}) {
  const handler = handlers.get(`${method} ${path}`)!.at(-1);
  const req: any = { currentUser: user, body, params, query: {}, method, headers: {} };
  const res: any = {
    statusCode: 200, body: null, headersSent: false,
    status(code: number) { this.statusCode = code; return this; },
    json(data: any) { this.body = data; this.headersSent = true; return this; },
    setHeader() {},
  };
  await handler(req, res);
  return res;
}

describe("warehouse keeper delivery source and destination boundaries (mocked database)", () => {
  it("assigns a driver from its main-warehouse source, but cannot act as driver or receiver", async () => {
    const payload = { sourceType: "material_transfer", sourceId: 1, driverId: "driver", vehicleNumber: "TR-1" };
    const assigned = await call("POST", "/api/deliveries", keeper, payload);
    expect(assigned.statusCode).toBe(201);
    expect(assigned.body.sourceBranchId).toBe("main_warehouse");
    expect(assigned.body.capabilities.canReassign).toBe(true);
    const id = assigned.body.id;
    expect((await call("POST", "/api/deliveries/:id/start", keeper, {}, { id })).statusCode).toBe(403);
    expect((await call("POST", "/api/deliveries/:id/proof", keeper, {}, { id })).statusCode).toBe(400);
    expect((await call("POST", "/api/deliveries/:id/complete", keeper, {}, { id })).statusCode).toBe(403);
    expect((await call("POST", "/api/deliveries/:id/approve-receipt", keeper, {}, { id })).statusCode).toBe(403);
    expect((await call("POST", "/api/deliveries/:id/start", driver, {}, { id })).statusCode).toBe(409);
    expect((await call("POST", "/api/deliveries", keeper, { ...payload, sourceId: 2 })).statusCode).toBe(403);
    expect((await call("GET", "/api/deliveries/:id", keeper, {}, { id })).statusCode).toBe(200);
    expect((await call("GET", "/api/deliveries/:id", receiver, {}, { id })).statusCode).toBe(200);
    expect((await call("GET", "/api/deliveries/:id", outsider, {}, { id })).statusCode).toBe(403);
    expect((await call("GET", "/api/deliveries/:id/proof", receiver, {}, { id })).statusCode).toBe(200);
    expect((await call("GET", "/api/deliveries/:id/proof", outsider, {}, { id })).statusCode).toBe(403);
  });

  it("lets only the original destination receipt actor approve, never the source keeper", async () => {
    const id = 303;
    state.assignments.set(id, {
      ...state.assignments.values().next().value,
      id, source_id: 3, status: "awaiting_receipt", signature_data: "signed",
      proof_at: new Date(),
    });
    expect((await call("POST", "/api/deliveries/:id/approve-receipt", keeper, {}, { id })).statusCode).toBe(403);
    expect((await call("POST", "/api/deliveries/:id/approve-receipt",
      { ...receiver, id: "not-original" }, {}, { id })).statusCode).toBe(403);
    expect((await call("POST", "/api/deliveries/:id/approve-receipt", receiver, {}, { id })).statusCode).toBe(200);
  });
});