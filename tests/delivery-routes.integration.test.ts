import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";

const state = vi.hoisted(() => ({
  client: null as any,
  permissions: new Map<string, any[]>(),
}));
vi.mock("../server/db", () => ({
  db: {},
  pool: {
    connect: async () => ({
      query: async (sql: string, values?: any[]) => {
        if (sql === "BEGIN") return state.client.query("SAVEPOINT delivery_route_action");
        if (sql === "COMMIT") return state.client.query("RELEASE SAVEPOINT delivery_route_action");
        if (sql === "ROLLBACK") return state.client.query("ROLLBACK TO SAVEPOINT delivery_route_action");
        return state.client.query(sql, values);
      },
      release: () => {},
    }),
    query: (sql: string, values?: any[]) => state.client.query(sql, values),
  },
}));
vi.mock("../server/storage", () => ({
  storage: {
    getUserPermissions: async (id: string) => state.permissions.get(id) || [],
    getUserBranchAccess: async () => [],
    hasPermission: async () => false,
  },
}));
vi.mock("../server/security", () => ({ isLoginBlocked: vi.fn(), trackLoginAttempt: vi.fn() }));
vi.mock("../server/shareholder-security", () => ({
  getTwoFactorConfig: vi.fn(), issueOtpForUser: vi.fn(),
  verifyOtpForUser: vi.fn(), logShareholderActivity: vi.fn(),
}));

import { registerDeliveryRoutes } from "../server/delivery-routes";

const handlers = new Map<string, any[]>();
const app: any = {
  get(path: string, ...fn: any[]) { handlers.set(`GET ${path}`, fn); },
  post(path: string, ...fn: any[]) { handlers.set(`POST ${path}`, fn); },
};
type Actor = { id: string; role: string; branchId: string; jobTitle: string; isActive: string };
const fixture = {
  prefix: `delivery-integration-${randomUUID()}`,
  source: 0,
  transfer: 0,
  kitchen: "",
  destination: "",
  outsider: "",
  manager: null as Actor | null,
  driver: null as Actor | null,
  otherDriver: null as Actor | null,
  receiver: null as Actor | null,
  outsiderUser: null as Actor | null,
};
let client: pg.PoolClient;
let pool: pg.Pool;
const actor = (name: string, branchId: string, jobTitle = "employee"): Actor => ({
  id: `${fixture.prefix}-${name}`, role: "employee", branchId, jobTitle, isActive: "active",
});
const grant = (user: Actor, modules: Record<string, string[]>) => {
  state.permissions.set(user.id, Object.entries(modules).map(([module, actions]) => ({ module, actions })));
};
async function invoke(method: string, path: string, user: Actor, body: any = {}, params: any = {}) {
  const route = handlers.get(`${method} ${path}`);
  if (!route) throw Error(`Missing route ${method} ${path}`);
  const req: any = { currentUser: user, method, body, params, query: {}, userBranchAccess: [],
    headers: {}, originalUrl: path, ip: "127.0.0.1" };
  const res: any = {
    statusCode: 200, headersSent: false, body: null,
    status(code: number) { this.statusCode = code; return this; },
    json(data: any) { this.body = data; this.headersSent = true; return this; },
    setHeader() {},
  };
  // The first middleware is the real isAuthenticated; its session lookup is
  // deliberately excluded. All in-handler permission checks use real auth.ts.
  await route[route.length - 1](req, res);
  return res;
}
const png = (() => {
  const chunk = (type: string, data: Buffer) => {
    const content = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of content) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const result = Buffer.alloc(content.length + 8);
    result.writeUInt32BE(data.length);
    content.copy(result, 4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, content.length + 4);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(200, 0); header.writeUInt32BE(80, 4);
  header[8] = 8; header[9] = 6;
  const scanlines = Buffer.alloc(80 * (1 + 200 * 4));
  const data = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${data.toString("base64")}`;
})();

describe("delivery routes against local PostgreSQL contracts", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || "postgres://invalid/");
    if (process.env.USE_SUPABASE === "true" || url.hostname !== "helium" || url.pathname !== "/heliumdb")
      throw Error("Delivery integration test requires local development heliumdb, refusing remote database");
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    client = await pool.connect();
    state.client = client;
    await client.query("BEGIN");
    const identity = await client.query("SELECT current_database() AS name");
    if (identity.rows[0].name !== "heliumdb") throw Error("Unexpected database");
    for (const key of ["kitchen", "destination", "outsider"] as const) {
      fixture[key] = `${fixture.prefix}-${key}`;
      await client.query("INSERT INTO branches (id,name,is_central_kitchen) VALUES ($1,$2,$3)",
        [fixture[key], key, key === "kitchen"]);
    }
    fixture.manager = actor("manager", fixture.kitchen);
    fixture.driver = actor("driver", fixture.kitchen, "delivery");
    fixture.otherDriver = actor("other-driver", fixture.kitchen, "delivery");
    fixture.receiver = actor("receiver", fixture.destination);
    fixture.outsiderUser = actor("outsider", fixture.outsider);
    for (const user of [fixture.manager, fixture.driver, fixture.otherDriver, fixture.receiver, fixture.outsiderUser]) {
      await client.query("INSERT INTO users (id,first_name,role,branch_id,job_title,is_active) VALUES ($1,$2,$3,$4,$5,$6)",
        [user.id, user.id, user.role, user.branchId, user.jobTitle, user.isActive]);
    }
    grant(fixture.manager, { delivery_tasks: ["create", "view", "edit"], central_kitchen_orders: ["edit", "view"], warehouse: ["edit", "view"] });
    grant(fixture.receiver, { delivery_tasks: ["approve"], central_kitchen_orders: ["edit"] });
    grant(fixture.outsiderUser, { delivery_tasks: ["view", "approve"], central_kitchen_orders: ["view", "edit"] });
    const source = await client.query(`INSERT INTO central_kitchen_orders
      (order_number,request_branch_id,central_kitchen_id,order_date,status,idempotency_key,payload_fingerprint,created_by)
      VALUES ($1,$2,$3,current_date,'dispatched',$4,$5,$6) RETURNING id`,
      [fixture.prefix, fixture.destination, fixture.kitchen, `${fixture.prefix}-key`, "a".repeat(64), fixture.manager.id]);
    fixture.source = source.rows[0].id;
    const transfer = await client.query(`INSERT INTO material_transfers
      (transfer_number,source_type,source_branch_id,destination_branch_id,transfer_date,status,created_by)
      VALUES ($1,'branch',$2,$3,current_date::text,'in_transit',$4) RETURNING id`,
      [fixture.prefix, fixture.kitchen, fixture.destination, fixture.manager.id]);
    fixture.transfer = transfer.rows[0].id;
    registerDeliveryRoutes(app);
  });
  afterAll(async () => {
    if (client) { await client.query("ROLLBACK"); client.release(); }
    if (pool) await pool.end();
    state.client = null;
  });

  it("runs the real text is_active driver SQL and source projections", async () => {
    const drivers = await invoke("GET", "/api/deliveries/drivers", fixture.manager!);
    expect(drivers.statusCode).toBe(200);
    expect(drivers.body.drivers.map((d: any) => d.id)).toContain(fixture.driver!.id);
    const sources = await invoke("GET", "/api/deliveries/sources", fixture.manager!);
    expect(sources.statusCode).toBe(200);
    expect(sources.body.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "kitchen", sourceId: fixture.source, items: [] }),
      expect.objectContaining({ sourceType: "material_transfer", sourceId: fixture.transfer, items: [] }),
    ]));
    const denied = await invoke("GET", "/api/deliveries/sources", fixture.outsiderUser!);
    expect(denied.statusCode).toBe(403);
    const previous = state.permissions.get(fixture.manager!.id);
    state.permissions.set(fixture.manager!.id, [{ module: "central_kitchen_orders", actions: ["edit", "view"] }]);
    expect((await invoke("GET", "/api/deliveries/drivers", fixture.manager!)).statusCode).toBe(403);
    state.permissions.set(fixture.manager!.id, previous!);
  });

  it("requires live branch scope, actual permission middleware and source receipt proof", async () => {
    const request = { sourceType: "kitchen", sourceId: fixture.source, driverId: fixture.driver!.id, vehicleNumber: "V-1" };
    expect((await invoke("POST", "/api/deliveries", fixture.outsiderUser!, request)).statusCode).toBe(403);
    expect((await invoke("POST", "/api/deliveries", fixture.manager!, { ...request, driverId: fixture.outsiderUser!.id })).statusCode).toBe(400);
    const created = await invoke("POST", "/api/deliveries", fixture.manager!, request);
    expect(created.statusCode).toBe(201);
    const id = created.body.id;
    expect((await invoke("POST", "/api/deliveries", fixture.manager!, request)).statusCode).toBe(409);
    expect((await invoke("GET", "/api/deliveries/:id/proof", fixture.outsiderUser!, {}, { id })).statusCode).toBe(403);
    expect((await invoke("POST", "/api/deliveries/:id/start", fixture.otherDriver!, {}, { id })).statusCode).toBe(403);
    expect((await invoke("POST", "/api/deliveries/:id/start", fixture.driver!, {}, { id })).body.status).toBe("in_transit");
    expect((await invoke("POST", "/api/deliveries/:id/complete", fixture.driver!, {}, { id })).statusCode).toBe(409);
    expect((await invoke("POST", "/api/deliveries/:id/proof", fixture.driver!, { signatureData: "fake", receiverName: "Receiver" }, { id })).statusCode).toBe(400);
    const tampered = Buffer.from(png.slice("data:image/png;base64,".length), "base64");
    tampered[29] ^= 1; // IHDR CRC; valid-looking header with altered bytes.
    const forged = `data:image/png;base64,${tampered.toString("base64")}`;
    expect((await invoke("POST", "/api/deliveries/:id/proof", fixture.driver!, { signatureData: forged, receiverName: "Receiver" }, { id })).statusCode).toBe(400);
    expect((await invoke("POST", "/api/deliveries/:id/proof", fixture.driver!, { signatureData: png, receiverName: "Receiver" }, { id })).body.status).toBe("awaiting_receipt");
    expect((await invoke("POST", "/api/deliveries/:id/approve-receipt", fixture.receiver!, {}, { id })).statusCode).toBe(409);
    await client.query("UPDATE central_kitchen_orders SET status='received', received_by=$1 WHERE id=$2", [fixture.receiver!.id, fixture.source]);
    const receiverGrants = state.permissions.get(fixture.receiver!.id)!;
    state.permissions.set(fixture.receiver!.id, [{ module: "central_kitchen_orders", actions: ["edit"] }]);
    expect((await invoke("POST", "/api/deliveries/:id/approve-receipt", fixture.receiver!, {}, { id })).statusCode).toBe(403);
    state.permissions.set(fixture.receiver!.id, receiverGrants);
    expect((await invoke("POST", "/api/deliveries/:id/approve-receipt", fixture.outsiderUser!, {}, { id })).statusCode).toBe(403);
    expect((await invoke("POST", "/api/deliveries/:id/approve-receipt", fixture.receiver!, {}, { id })).body.status).toBe("receipt_approved");
    await client.query("UPDATE central_kitchen_orders SET received_by=$1 WHERE id=$2", [fixture.outsiderUser!.id, fixture.source]);
    expect((await invoke("POST", "/api/deliveries/:id/complete", fixture.driver!, {}, { id })).statusCode).toBe(409);
    await client.query("UPDATE central_kitchen_orders SET received_by=$1 WHERE id=$2", [fixture.receiver!.id, fixture.source]);
    expect((await invoke("POST", "/api/deliveries/:id/complete", fixture.driver!, {}, { id })).body.status).toBe("completed");
    expect((await invoke("POST", "/api/deliveries/:id/complete", fixture.driver!, {}, { id })).statusCode).toBe(409);
  });

  it("enforces reassignment ownership and preserves the failed assignment", async () => {
    const created = await invoke("POST", "/api/deliveries", fixture.manager!, {
      sourceType: "material_transfer", sourceId: fixture.transfer, driverId: fixture.driver!.id, vehicleNumber: "V-2",
    });
    expect(created.statusCode).toBe(201);
    const id = created.body.id;
    expect((await invoke("POST", "/api/deliveries/:id/fail", fixture.otherDriver!, { reason: "Cannot deliver" }, { id })).statusCode).toBe(403);
    expect((await invoke("POST", "/api/deliveries/:id/fail", fixture.driver!, { reason: "Cannot deliver" }, { id })).body.status).toBe("failed");
    expect((await invoke("POST", "/api/deliveries/:id/start", fixture.driver!, {}, { id })).statusCode).toBe(409);
    expect((await invoke("POST", "/api/deliveries/:id/reassign", fixture.outsiderUser!, {
      driverId: fixture.otherDriver!.id, vehicleNumber: "V-3",
    }, { id })).statusCode).toBe(403);
    const reassigned = await invoke("POST", "/api/deliveries/:id/reassign", fixture.manager!, {
      driverId: fixture.otherDriver!.id, vehicleNumber: "V-3",
    }, { id });
    expect(reassigned.body).toEqual(expect.objectContaining({ id, driverId: fixture.otherDriver!.id, status: "assigned", proofPresent: false }));
    expect((await invoke("GET", "/api/deliveries/:id/proof", fixture.driver!, {}, { id })).statusCode).toBe(403);
    expect((await invoke("POST", "/api/deliveries/:id/start", fixture.driver!, {}, { id })).statusCode).toBe(403);
    expect((await invoke("POST", "/api/deliveries/:id/start", fixture.otherDriver!, {}, { id })).body.status).toBe("in_transit");
  });
});