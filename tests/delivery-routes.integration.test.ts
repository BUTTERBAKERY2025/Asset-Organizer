import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";

const state = vi.hoisted(() => ({
  client: null as any,
  permissions: new Map<string, any[]>(),
  failAttachmentInsert: false,
}));
vi.mock("multer", () => ({
  default: Object.assign(() => ({
    single: () => (req: any, _res: any, callback: (error?: Error) => Promise<void>) => { void callback(); },
  }), { memoryStorage: () => ({}) }),
}));
vi.mock("../server/db", () => ({
  db: {},
  pool: {
    connect: async () => ({
      query: async (sql: string, values?: any[]) => {
        if (sql === "BEGIN") return state.client.query("SAVEPOINT delivery_route_action");
        if (sql === "COMMIT") return state.client.query("RELEASE SAVEPOINT delivery_route_action");
        if (sql === "ROLLBACK") return state.client.query("ROLLBACK TO SAVEPOINT delivery_route_action");
        if (state.failAttachmentInsert && /INSERT INTO delivery_carrier_attachments/.test(sql))
          throw Error("metadata insert failed");
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

import { csvCell, reportDateBounds, registerDeliveryRoutes } from "../server/delivery-routes";
import { ObjectStorageService } from "../server/replit_integrations/object_storage/objectStorage";

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
  finishedTransfer: 0,
  legacyTransfer: 0,
  warehouseShipment: 0,
  inventory: 0,
  product: 0,
  warehouse: 0,
  kitchen: "",
  destination: "",
  outsider: "",
  manager: null as Actor | null,
  driver: null as Actor | null,
  otherDriver: null as Actor | null,
  receiver: null as Actor | null,
  outsiderUser: null as Actor | null,
  warehouseManager: null as Actor | null,
};
let client: pg.PoolClient;
let pool: pg.Pool;
const actor = (name: string, branchId: string, jobTitle = "employee"): Actor => ({
  id: `${fixture.prefix}-${name}`, role: "employee", branchId, jobTitle, isActive: "active",
});
const grant = (user: Actor, modules: Record<string, string[]>) => {
  state.permissions.set(user.id, Object.entries(modules).map(([module, actions]) => ({ module, actions })));
};
async function invoke(method: string, path: string, user: Actor, body: any = {}, params: any = {}, query: any = {}, file?: any) {
  const route = handlers.get(`${method} ${path}`);
  if (!route) throw Error(`Missing route ${method} ${path}`);
  const req: any = { currentUser: user, method, body, params, query, file, userBranchAccess: [],
    headers: {}, originalUrl: path, ip: "127.0.0.1" };
  if (user.role === "warehouse_keeper") req.authPermissions = state.permissions.get(user.id) || [];
  const res: any = {
    statusCode: 200, headersSent: false, body: null, csv: "",
    status(code: number) { this.statusCode = code; return this; },
    json(data: any) { this.body = data; this.headersSent = true; this.done?.(); return this; },
    setHeader() {},
    send(data: any) { this.body = data; this.headersSent = true; this.done?.(); return this; },
    write(chunk: string) { this.headersSent = true; this.csv += chunk; return true; },
    end() { this.headersSent = true; },
  };
  // The first middleware is the real isAuthenticated; its session lookup is
  // deliberately excluded. All in-handler permission checks use real auth.ts.
  const completed = new Promise<void>(resolve => { res.done = resolve; });
  await route[route.length - 1](req, res);
  if (path.includes("/attachments") && method === "POST") await completed;
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
    fixture.warehouseManager = { ...actor("warehouse-manager", fixture.kitchen), role: "admin" };
    for (const user of [fixture.manager, fixture.driver, fixture.otherDriver, fixture.receiver, fixture.outsiderUser, fixture.warehouseManager]) {
      await client.query("INSERT INTO users (id,first_name,role,branch_id,job_title,is_active) VALUES ($1,$2,$3,$4,$5,$6)",
        [user.id, user.id, user.role, user.branchId, user.jobTitle, user.isActive]);
    }
    grant(fixture.manager, { delivery_tasks: ["create", "view", "edit"], central_kitchen_orders: ["edit", "view"], warehouse: ["edit", "view"], production: ["edit", "view"] });
    grant(fixture.receiver, { delivery_tasks: ["approve"], central_kitchen_orders: ["edit"] });
    grant(fixture.outsiderUser, { delivery_tasks: ["view", "approve"], central_kitchen_orders: ["view", "edit"] });
    grant(fixture.warehouseManager, { delivery_tasks: ["approve", "create", "view", "edit"], warehouse: ["edit", "view"], production: ["edit", "view"] });
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
    fixture.product = (await client.query(`INSERT INTO products (name,category,unit,operations_enabled,is_active)
      VALUES ($1,'finish','piece',true,'true') RETURNING id`, [fixture.prefix])).rows[0].id;
    fixture.inventory = (await client.query(`INSERT INTO finished_goods_inventory
      (branch_id,product_id,product_name,product_name_normalized,quantity,unit,production_date)
      VALUES ($1,$2,$3,lower($3),10,'piece','2023-02-14') RETURNING id`,
      [fixture.kitchen, fixture.product, fixture.prefix])).rows[0].id;
    fixture.warehouse = Number((await client.query("INSERT INTO managed_warehouses(name) VALUES($1) RETURNING id",
      [fixture.prefix])).rows[0].id);
    const fg = async (policy: string | null, status: string) => Number((await client.query(`INSERT INTO finished_goods_transfers
      (inventory_id,source_branch_id,destination_type,destination_branch_id,product_id,product_name,quantity,unit,
       transfer_date,status,transport_policy,production_date,created_by)
      VALUES ($1,$2,'branch',$3,$4,$5,3,'piece',current_date::text,$6,$7,'2023-02-14',$8) RETURNING id`,
      [fixture.inventory, fixture.kitchen, fixture.destination, fixture.product, fixture.prefix,
        status, policy, fixture.manager!.id])).rows[0].id);
    fixture.finishedTransfer = await fg("branch_receipt", "in_transit");
    fixture.legacyTransfer = await fg(null, "completed");
    fixture.warehouseShipment = Number((await client.query(`INSERT INTO kitchen_warehouse_shipments
      (source_branch_id,destination_warehouse_id,product_id,product_name,unit,quantity,status,
       created_by,create_key,create_fingerprint)
      VALUES ($1,$2,$3,$4,'piece',3,'dispatched',$5,$6,$7) RETURNING id`,
      [fixture.kitchen, fixture.warehouse, fixture.product, fixture.prefix, fixture.manager!.id,
        fixture.prefix, "a".repeat(64)])).rows[0].id);
    registerDeliveryRoutes(app);
  });
  afterAll(async () => {
    if (client) { await client.query("ROLLBACK"); client.release(); }
    if (pool) await pool.end();
    state.client = null;
  });

  it("fails storage safely, preserves insert errors on cleanup, and serves authorized private bytes", async () => {
    const id = Number((await client.query(`INSERT INTO delivery_assignments
      (source_type,source_id,transport_mode,status,created_by,carrier,waybill,package_count)
      VALUES ('kitchen',$1,'external','assigned',$2,'road','test-waybill',1) RETURNING id`,
      [fixture.source, fixture.manager!.id])).rows[0].id);
    const bytes = Buffer.from([255, 216, 255, 1, 255, 217]);
    const stored = new Map<string, Buffer>();
    const ready = vi.spyOn(ObjectStorageService.prototype, "isPrivateObjectStorageReady").mockResolvedValue(true);
    const upload = vi.spyOn(ObjectStorageService.prototype, "uploadPrivateObject").mockImplementation(async (path, data) => {
      stored.set(path, Buffer.from(data));
    });
    const remove = vi.spyOn(ObjectStorageService.prototype, "deletePrivateObject").mockImplementation(async path => {
      stored.delete(path);
    });
    const download = vi.spyOn(ObjectStorageService.prototype, "downloadPrivateObject").mockImplementation(async path => {
      const data = stored.get(path);
      if (!data) throw Error("missing");
      return { data, contentType: "image/jpeg", size: data.length };
    });
    const post = () => invoke("POST", "/api/deliveries/:id/attachments", fixture.manager!,
      { kind: "shipment_photo" }, { id }, {}, { buffer: bytes, mimetype: "image/jpeg", originalname: "evidence.jpg" });
    try {
      upload.mockRejectedValueOnce(Error("provider offline"));
      const failed = await post();
      expect(failed.statusCode).toBe(503);
      expect(failed.body).toEqual({ error: "مخزن المرفقات الخاص غير متاح حالياً" });
      expect((await client.query("SELECT id FROM delivery_carrier_attachments WHERE assignment_id=$1", [id])).rowCount).toBe(0);

      state.failAttachmentInsert = true;
      const insertion = await post();
      expect(insertion.statusCode).toBe(500);
      expect(insertion.body.error).toBe("Delivery operation failed");
      expect(remove).toHaveBeenCalled();
      expect(stored.size).toBe(0);
      state.failAttachmentInsert = false;

      state.failAttachmentInsert = true;
      remove.mockRejectedValueOnce(Error("cleanup also failed"));
      const doubleFailure = await post();
      expect(doubleFailure.statusCode).toBe(500);
      expect(doubleFailure.body.error).toBe("Delivery operation failed");
      state.failAttachmentInsert = false;
      stored.clear(); // In-memory fake: cleanup was intentionally made to fail above.

      const success = await post();
      expect(success.statusCode).toBe(201);
      const rows = (await client.query("SELECT id,storage_path FROM delivery_carrier_attachments WHERE assignment_id=$1", [id])).rows;
      expect(rows).toHaveLength(1);
      expect(stored.get(rows[0].storage_path)).toEqual(bytes);
      const route = "/api/deliveries/:id/attachments/:attachmentId";
      expect((await invoke("GET", route, fixture.outsiderUser!, {}, { id, attachmentId: rows[0].id })).statusCode).toBe(403);
      const received = await invoke("GET", route, fixture.manager!, {}, { id, attachmentId: rows[0].id });
      expect(received.statusCode).toBe(200);
      expect(received.body).toEqual(bytes);
      expect(download).toHaveBeenCalledWith(rows[0].storage_path);
    } finally {
      state.failAttachmentInsert = false;
      ready.mockRestore(); upload.mockRestore(); remove.mockRestore(); download.mockRestore();
    }
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
      expect.objectContaining({ sourceType: "finished_goods_transfer", sourceId: fixture.finishedTransfer,
        items: [expect.objectContaining({ quantity: 3 })] }),
    ]));
    expect(sources.body.sources).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "finished_goods_transfer", sourceId: fixture.legacyTransfer }),
    ]));
    const warehouseSources = await invoke("GET", "/api/deliveries/sources", fixture.warehouseManager!);
    expect(warehouseSources.body.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "kitchen_warehouse_shipment", sourceId: fixture.warehouseShipment,
        destinationBranchId: null, destinationWarehouseId: fixture.warehouse }),
    ]));
    const denied = await invoke("GET", "/api/deliveries/sources", fixture.outsiderUser!);
    expect(denied.statusCode).toBe(403);
    const previous = state.permissions.get(fixture.manager!.id);
    state.permissions.set(fixture.manager!.id, [{ module: "central_kitchen_orders", actions: ["edit", "view"] }]);
    expect((await invoke("GET", "/api/deliveries/drivers", fixture.manager!)).statusCode).toBe(403);
    state.permissions.set(fixture.manager!.id, previous!);
  });

  it("rolls back creation when its response projection fails", async () => {
    const order = await client.query(`INSERT INTO central_kitchen_orders
      (order_number,request_branch_id,central_kitchen_id,order_date,status,idempotency_key,payload_fingerprint,created_by)
      VALUES ($1,$2,$3,current_date,'prepared',$4,$5,$6) RETURNING id`,
      [`${fixture.prefix}-projection`, fixture.destination, fixture.kitchen,
        `${fixture.prefix}-projection-key`, "c".repeat(64), fixture.manager!.id]);
    const sourceId = order.rows[0].id;
    const originalQuery = client.query.bind(client);
    const failure = new Error("simulated assignment projection failure");
    (client as any).query = (sql: string, values?: any[]) => {
      if (sql.includes("SELECT a.*, concat_ws(")) return Promise.reject(failure);
      return originalQuery(sql, values);
    };
    try {
      const response = await invoke("POST", "/api/deliveries", fixture.manager!, {
        sourceType: "kitchen", sourceId, driverId: fixture.driver!.id,
        vehicleNumber: "vehicle01", scheduledAt: "2026-09-27T19:15:00+03:00",
      });
      expect(response.statusCode).toBe(500);
    } finally {
      (client as any).query = originalQuery;
    }
    const assignments = await client.query(
      "SELECT id FROM delivery_assignments WHERE source_type='kitchen' AND source_id=$1", [sourceId]);
    expect(assignments.rowCount).toBe(0);
  });

  it("does not create a task when the assigned notice violates an older outbox check", async () => {
    const order = await client.query(`INSERT INTO central_kitchen_orders
      (order_number,request_branch_id,central_kitchen_id,order_date,status,idempotency_key,payload_fingerprint,created_by)
      VALUES ($1,$2,$3,current_date,'prepared',$4,$5,$6) RETURNING id`,
      [`${fixture.prefix}-outbox`, fixture.destination, fixture.kitchen,
        `${fixture.prefix}-outbox-key`, "d".repeat(64), fixture.manager!.id]);
    const sourceId = order.rows[0].id;
    const originalQuery = client.query.bind(client);
    (client as any).query = (sql: string, values?: any[]) => {
      if (sql.includes("INSERT INTO delivery_notification_outbox")) {
        return Promise.reject(Object.assign(new Error(
          'new row for relation "delivery_notification_outbox" violates check constraint "delivery_notification_outbox_event_type_check"',
        ), { code: "23514" }));
      }
      return originalQuery(sql, values);
    };
    try {
      const response = await invoke("POST", "/api/deliveries", fixture.manager!, {
        sourceType: "kitchen", sourceId, driverId: fixture.driver!.id, vehicleNumber: "vehicle01",
      });
      expect(response.statusCode).toBe(500);
    } finally {
      (client as any).query = originalQuery;
    }
    const assignments = await client.query(
      "SELECT id FROM delivery_assignments WHERE source_type='kitchen' AND source_id=$1", [sourceId]);
    expect(assignments.rowCount).toBe(0);
    const events = await client.query(`SELECT e.id FROM delivery_assignment_events e
      JOIN delivery_assignments a ON a.id=e.assignment_id
      WHERE a.source_type='kitchen' AND a.source_id=$1`, [sourceId]);
    expect(events.rowCount).toBe(0);
  });

  it("assigns before dispatch and requires a current-driver physical handover and acknowledgement", async () => {
    const transfer = await client.query(`INSERT INTO finished_goods_transfers
      (inventory_id,source_branch_id,destination_type,destination_branch_id,product_id,product_name,quantity,unit,
       transfer_date,status,transport_policy,production_date,created_by)
      VALUES ($1,$2,'branch',$3,$4,$5,3,'piece',current_date::text,'pending','branch_receipt','2023-02-14',$6)
      RETURNING id`, [fixture.inventory,fixture.kitchen,fixture.destination,fixture.product,fixture.prefix,fixture.manager!.id]);
    const sourceId = transfer.rows[0].id;
    const request = { sourceType: "finished_goods_transfer", sourceId, driverId: fixture.driver!.id, vehicleNumber: "V-1" };
    const created = await invoke("POST","/api/deliveries",fixture.manager!,request);
    expect(created.statusCode).toBe(201);
    const id = created.body.id;
    expect((await invoke("POST","/api/deliveries/:id/start",fixture.driver!,{}, { id })).statusCode).toBe(409);
    expect(created.body.capabilities.canFail).toBe(false);
    expect((await invoke("POST","/api/deliveries/:id/fail",fixture.driver!,
      { reason: "Not yet dispatched" }, { id })).statusCode).toBe(409);
    const items = [{ id: sourceId, quantity: 3 }];
    expect((await invoke("POST","/api/deliveries/:id/handover",fixture.receiver!,{ items },{ id })).statusCode).toBe(403);
    expect((await invoke("POST","/api/deliveries/:id/handover",fixture.manager!,{ items: [{ id: sourceId, quantity: 4 }] },{ id })).statusCode).toBe(400);
    expect((await invoke("POST","/api/deliveries/:id/handover",fixture.manager!,{ items },{ id })).statusCode).toBe(200);
    expect((await invoke("POST","/api/deliveries/:id/acknowledge-handover",fixture.otherDriver!,{}, { id })).statusCode).toBe(403);
    expect((await invoke("POST","/api/deliveries/:id/acknowledge-handover",fixture.driver!,{}, { id })).statusCode).toBe(200);
    expect((await invoke("POST","/api/deliveries/:id/start",fixture.driver!,{}, { id })).statusCode).toBe(409);
    const revised = await invoke("POST","/api/deliveries/:id/reassign",fixture.manager!,
      { driverId: fixture.otherDriver!.id, vehicleNumber: "V-2" },{ id });
    expect(revised.statusCode).toBe(200);
    expect(revised.body.handoverAcknowledgedAt).toBeNull();
    expect((await invoke("POST","/api/deliveries/:id/acknowledge-handover",fixture.driver!,{}, { id })).statusCode).toBe(403);
    expect((await invoke("POST","/api/deliveries/:id/start",fixture.otherDriver!,{}, { id })).statusCode).toBe(409);
    expect((await invoke("POST","/api/deliveries/:id/handover",fixture.manager!,{ items },{ id })).statusCode).toBe(200);
    expect((await invoke("POST","/api/deliveries/:id/acknowledge-handover",fixture.otherDriver!,{}, { id })).statusCode).toBe(200);
    await client.query("UPDATE finished_goods_transfers SET status='in_transit' WHERE id=$1",[sourceId]);
    expect((await invoke("POST","/api/deliveries/:id/start",fixture.otherDriver!,{}, { id })).body.status).toBe("in_transit");
  });

  it("recovers legacy assigned work after source receipt with late proof but never posts stock", async () => {
    const order = await client.query(`INSERT INTO central_kitchen_orders
      (order_number,request_branch_id,central_kitchen_id,order_date,status,idempotency_key,payload_fingerprint,created_by)
      VALUES ($1,$2,$3,current_date,'dispatched',$4,$5,$6) RETURNING id`,
      [`${fixture.prefix}-late`,fixture.destination,fixture.kitchen,`${fixture.prefix}-late-key`,"b".repeat(64),fixture.manager!.id]);
    const sourceId = order.rows[0].id;
    const created = await invoke("POST","/api/deliveries",fixture.manager!,
      { sourceType: "kitchen", sourceId, driverId: fixture.driver!.id, vehicleNumber: "Late-1" });
    expect(created.statusCode).toBe(201);
    const id = created.body.id;
    await client.query("UPDATE central_kitchen_orders SET status='received',received_by=$1 WHERE id=$2",
      [fixture.receiver!.id,sourceId]);
    const before = Number((await client.query("SELECT quantity FROM finished_goods_inventory WHERE id=$1",
      [fixture.inventory])).rows[0].quantity);
    const view = await invoke("GET","/api/deliveries/:id",fixture.driver!,{}, { id });
    expect(view.body.capabilities.canStart).toBe(true);
    expect((await invoke("POST","/api/deliveries/:id/start",fixture.driver!,{}, { id })).body.status).toBe("in_transit");
    expect((await invoke("POST","/api/deliveries/:id/proof",fixture.driver!,
      { signatureData: png,receiverName:"Late receiver" },{ id })).body.status).toBe("awaiting_receipt");
    expect((await invoke("POST","/api/deliveries/:id/approve-receipt",fixture.outsiderUser!,{}, { id })).statusCode).toBe(403);
    expect((await invoke("POST","/api/deliveries/:id/approve-receipt",fixture.receiver!,{}, { id })).body.status).toBe("receipt_approved");
    expect((await invoke("POST","/api/deliveries/:id/complete",fixture.driver!,{}, { id })).body.status).toBe("completed");
    expect(Number((await client.query("SELECT quantity FROM finished_goods_inventory WHERE id=$1",
      [fixture.inventory])).rows[0].quantity)).toBe(before);
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
    expect((await invoke("POST", "/api/deliveries/:id/start", fixture.otherDriver!, {}, { id })).statusCode).toBe(409);
  });

  it("finished-goods receipt must be posted by the authenticated destination actor; driver proof never posts stock", async () => {
    const request = { sourceType: "finished_goods_transfer", sourceId: fixture.finishedTransfer,
      driverId: fixture.driver!.id, vehicleNumber: "FG-1" };
    expect((await invoke("POST", "/api/deliveries", fixture.outsiderUser!, request)).statusCode).toBe(403);
    expect((await invoke("POST", "/api/deliveries", fixture.manager!,
      { ...request, sourceId: fixture.legacyTransfer })).statusCode).toBe(403);
    const created = await invoke("POST", "/api/deliveries", fixture.manager!, request);
    expect(created.statusCode).toBe(201);
    const id = created.body.id;
    expect((await invoke("POST", "/api/deliveries/:id/start", fixture.driver!, {}, { id })).body.status).toBe("in_transit");
    expect((await invoke("POST", "/api/deliveries/:id/proof", fixture.driver!,
      { signatureData: png, receiverName: "Actual recipient" }, { id })).body.status).toBe("awaiting_receipt");
    const stock = await client.query("SELECT quantity FROM finished_goods_inventory WHERE id=$1", [fixture.inventory]);
    expect(Number(stock.rows[0].quantity)).toBe(10);
    expect((await client.query("SELECT received_by,status FROM finished_goods_transfers WHERE id=$1",
      [fixture.finishedTransfer])).rows[0]).toMatchObject({ received_by: null, status: "in_transit" });
    expect((await invoke("POST", "/api/deliveries/:id/approve-receipt", fixture.receiver!, {}, { id })).statusCode).toBe(403);
    grant(fixture.receiver!, { delivery_tasks: ["approve"], production: ["edit", "view"] });
    expect((await invoke("POST", "/api/deliveries/:id/approve-receipt", fixture.receiver!, {}, { id })).statusCode).toBe(409);
    await client.query("UPDATE finished_goods_transfers SET status='received',received_by=$1,received_quantity=3 WHERE id=$2",
      [fixture.warehouseManager!.id, fixture.finishedTransfer]);
    expect((await invoke("POST", "/api/deliveries/:id/approve-receipt", fixture.receiver!, {}, { id })).statusCode).toBe(403);
    await client.query("UPDATE finished_goods_transfers SET received_by=$1 WHERE id=$2",
      [fixture.receiver!.id, fixture.finishedTransfer]);
    expect((await invoke("POST", "/api/deliveries/:id/cancel", fixture.manager!, { reason: "Cannot deliver" }, { id })).statusCode).toBe(409);
    expect((await invoke("POST", "/api/deliveries/:id/reassign", fixture.manager!,
      { driverId: fixture.otherDriver!.id, vehicleNumber: "FG-2" }, { id })).statusCode).toBe(409);
    expect((await invoke("POST", "/api/deliveries/:id/approve-receipt", fixture.receiver!, {}, { id })).body.status).toBe("receipt_approved");
    expect((await invoke("POST", "/api/deliveries/:id/complete", fixture.driver!, {}, { id })).body.status).toBe("completed");
  });

  it("managed warehouse receipt is scoped to global warehouse authority, not an invented branch", async () => {
    const request = { sourceType: "kitchen_warehouse_shipment", sourceId: fixture.warehouseShipment,
      driverId: fixture.driver!.id, vehicleNumber: "WH-1" };
    expect((await invoke("POST", "/api/deliveries", fixture.manager!, request)).statusCode).toBe(403);
    const created = await invoke("POST", "/api/deliveries", fixture.warehouseManager!, request);
    expect(created.statusCode).toBe(201);
    const id = created.body.id;
    expect(created.body).toMatchObject({ destinationBranchId: null, destinationWarehouseId: fixture.warehouse });
    expect((await invoke("GET", "/api/deliveries/:id", fixture.receiver!, {}, { id })).statusCode).toBe(403);
    expect((await invoke("POST", "/api/deliveries/:id/start", fixture.driver!, {}, { id })).body.status).toBe("in_transit");
    expect((await invoke("POST", "/api/deliveries/:id/proof", fixture.driver!,
      { signatureData: png, receiverName: "Warehouse receiver" }, { id })).body.status).toBe("awaiting_receipt");
    expect((await client.query("SELECT received_by,status FROM kitchen_warehouse_shipments WHERE id=$1",
      [fixture.warehouseShipment])).rows[0]).toMatchObject({ received_by: null, status: "dispatched" });
    expect(Number((await client.query("SELECT count(*) amount FROM managed_warehouse_product_stock WHERE warehouse_id=$1",
      [fixture.warehouse])).rows[0].amount)).toBe(0);
    expect((await invoke("POST", "/api/deliveries/:id/approve-receipt", fixture.warehouseManager!, {}, { id })).statusCode).toBe(409);
    await client.query("UPDATE kitchen_warehouse_shipments SET status='received',received_by=$1,received_quantity=3 WHERE id=$2",
      [fixture.receiver!.id, fixture.warehouseShipment]);
    expect((await invoke("POST", "/api/deliveries/:id/approve-receipt", fixture.warehouseManager!, {}, { id })).statusCode).toBe(403);
    await client.query("UPDATE kitchen_warehouse_shipments SET received_by=$1 WHERE id=$2",
      [fixture.warehouseManager!.id, fixture.warehouseShipment]);
    expect((await invoke("POST", "/api/deliveries/:id/approve-receipt", fixture.warehouseManager!, {}, { id })).body.status).toBe("receipt_approved");
  });

  it("requires export and source read scope for reports without exposing a driver's other tasks", async () => {
    expect((await invoke("GET", "/api/deliveries/reports", fixture.driver!)).statusCode).toBe(403);
    expect((await invoke("GET", "/api/deliveries/capabilities", fixture.driver!)).body.canReport).toBe(false);
    const viewOnly = await invoke("GET", "/api/deliveries/reports", fixture.manager!);
    expect(viewOnly.statusCode).toBe(200);
    expect(viewOnly.body.deliveries).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "kitchen", sourceId: fixture.source }),
    ]));
    expect((await invoke("GET", "/api/deliveries/capabilities", fixture.manager!)).body)
      .toMatchObject({ canReport: true, canExport: false });
    const original = state.permissions.get(fixture.manager!.id)!;
    try {
      grant(fixture.manager!, { delivery_tasks: ["view", "edit", "create", "export"],
        central_kitchen_orders: ["view", "edit"], warehouse: ["view", "edit"], production: ["view", "edit"] });
      expect((await invoke("GET", "/api/deliveries/capabilities", fixture.manager!)).body)
        .toMatchObject({ canReport: true, canExport: true });
      const report = await invoke("GET", "/api/deliveries/reports", fixture.manager!);
      expect(report.statusCode).toBe(200);
      expect(report.body.deliveries).toEqual(expect.arrayContaining([
        expect.objectContaining({ sourceType: "kitchen", sourceId: fixture.source }),
      ]));
      expect(report.body.summary.total).toBe(report.body.deliveries.length);
      grant(fixture.manager!, { delivery_tasks: ["view", "export"], warehouse: ["view"] });
      const restricted = await invoke("GET", "/api/deliveries/reports", fixture.manager!);
      expect(restricted.statusCode).toBe(200);
      expect(restricted.body.deliveries.some((d: any) => d.sourceType === "kitchen")).toBe(false);
      expect(restricted.body.deliveries.every((d: any) => d.sourceType === "material_transfer"
        || d.sourceType === "reverse_movement" || d.sourceType === "kitchen_warehouse_shipment")).toBe(true);
      grant(fixture.manager!, { delivery_tasks: ["view"], central_kitchen_orders: ["edit"] });
      expect((await invoke("GET", "/api/deliveries/capabilities", fixture.manager!)).body)
        .toMatchObject({ canReport: false, canExport: false });
      expect((await invoke("GET", "/api/deliveries/reports", fixture.manager!)).statusCode).toBe(403);
    } finally {
      state.permissions.set(fixture.manager!.id, original);
    }
  });

  it("paginates after source authorization, counts all matches and exports every row safely", async () => {
    const manager = { ...fixture.manager!, role: "warehouse_keeper", branchId: "main_warehouse" };
    const original = state.permissions.get(manager.id)!;
    const ids: number[] = [];
    try {
      grant(manager, { delivery_tasks: ["view", "export"], warehouse: ["view"] });
      // More than the old 500-row cap, with inaccessible rows first in scan order.
      for (let n = 0; n < 510; n++) {
        const allowed = n >= 505;
        const order = allowed ? await client.query(`INSERT INTO material_transfers
          (transfer_number,source_type,source_branch_id,destination_branch_id,transfer_date,status,created_by)
          VALUES ($1,'branch',$2,$3,current_date::text,'in_transit',$4) RETURNING id`,
          [`${fixture.prefix}-${n}`, "main_warehouse", fixture.destination, manager.id])
          : await client.query(`INSERT INTO central_kitchen_orders
          (order_number,request_branch_id,central_kitchen_id,order_date,status,idempotency_key,payload_fingerprint,created_by)
          VALUES ($1,$2,$3,current_date,'dispatched',$4,$5,$6) RETURNING id`,
          [`${fixture.prefix}-${n}`, fixture.destination,
            fixture.outsider, `${fixture.prefix}-report-${n}`,
            "f".repeat(64), manager.id]);
        const assignment = await client.query(`INSERT INTO delivery_assignments
          (source_type,source_id,transport_mode,driver_id,vehicle_number,status,created_by,created_at,
            carrier,carrier_name,waybill,package_count)
          VALUES ($6,$1,'external',NULL,NULL,'assigned',$2,$3,'other',$4,$5,1) RETURNING id`,
          [order.rows[0].id, manager.id, n === 509 ? "2026-01-02T20:59:59Z" : "2026-01-01T21:00:00Z",
            allowed ? "شركة =SUM(1)" : "hidden", allowed ? "=2+2" : "hidden",
            allowed ? "material_transfer" : "kitchen"]);
        ids.push(Number(assignment.rows[0].id));
      }
      const outside = await client.query(`INSERT INTO material_transfers
        (transfer_number,source_type,source_branch_id,destination_branch_id,transfer_date,status,created_by)
        VALUES ($1,'branch','main_warehouse',$2,current_date::text,'in_transit',$3) RETURNING id`,
        [`${fixture.prefix}-outside`, fixture.destination, manager.id]);
      await client.query(`INSERT INTO delivery_assignments
        (source_type,source_id,transport_mode,driver_id,vehicle_number,status,created_by,created_at,carrier,carrier_name,waybill,package_count)
        VALUES ('material_transfer',$1,'external',NULL,NULL,'assigned',$2,$3,'other','شركة =SUM(1)','=2+2',1)`,
        [outside.rows[0].id, manager.id, "2026-01-02T21:00:00Z"]);
      await client.query("UPDATE delivery_assignments SET started_at=$2,completed_at=$3,status='completed' WHERE id=$1",
        [ids[505], "2026-01-04T09:00:00Z", "2026-01-02T20:59:59Z"]);
      await client.query(`UPDATE material_transfers SET departure_time=$2 WHERE id=
        (SELECT source_id FROM delivery_assignments WHERE id=$1)`,
        [ids[505], "2026-01-01T21:00:00Z"]);
      const q = { from: "2026-01-02", to: "2026-01-02", carrier: "other", carrierName: "شركة =SUM(1)" };
      const page = await invoke("GET", "/api/deliveries/reports", manager, {}, {}, { ...q, page: "1", pageSize: "2" });
      expect(page.statusCode).toBe(200);
      expect(page.body.summary.total).toBe(5);
      expect(page.body.deliveries).toHaveLength(2);
      const last = await invoke("GET", "/api/deliveries/reports", manager, {}, {}, { ...q, page: "3", pageSize: "2" });
      expect(last.body.deliveries).toHaveLength(1);
      const csv = await invoke("GET", "/api/deliveries/reports/export", manager, {}, {}, q);
      expect(csv.statusCode).toBe(200);
      expect(csv.csv.startsWith("\uFEFF")).toBe(true);
      expect(csv.csv.split("\r\n").filter(Boolean)).toHaveLength(6);
      expect(csv.csv.slice(1).split("\r\n")[0].split(",").map(value => value.replace(/^"|"$/g, "")))
        .toEqual(["المصدر", "النوع", "شركة الشحن", "رقم البوليصة", "السائق الداخلي", "المركبة",
          "المستلم", "الحالة", "الإنشاء (السعودية +03:00)", "الإرسال الفعلي من المصدر (السعودية +03:00)",
          "الإكمال (السعودية +03:00)"]);
      expect(csv.csv).toContain("'=2+2");
      expect(csv.csv).not.toContain("hidden");
      expect(csv.csv).toContain("نقل مواد");
      expect(csv.csv).toContain("مكتملة");
      expect(csv.csv).toContain("الإرسال الفعلي من المصدر (السعودية +03:00)");
      expect(csv.csv).toContain("2026-01-02T00:00:00.000+03:00");
      expect(csv.csv).not.toContain("2026-01-04T09:00:00");
      expect((await invoke("GET", "/api/deliveries/reports", manager, {}, {},
        { ...q, sourceBranchId: fixture.outsider })).body.summary.total).toBe(0);
      expect((await invoke("GET", "/api/deliveries/reports", manager, {}, {},
        { ...q, destinationBranchId: fixture.outsider })).body.summary.total).toBe(0);
      expect((await invoke("GET", "/api/deliveries/reports", manager, {}, {},
        { ...q, carrierName: "unknown" })).body.summary.total).toBe(0);
      expect((await invoke("GET", "/api/deliveries/reports", manager, {}, {},
        { ...q, status: "completed" })).body.summary.total).toBe(1);
      expect((await invoke("GET", "/api/deliveries/reports/export", fixture.driver!, {}, {}, q)).statusCode).toBe(403);
      grant(manager, { delivery_tasks: ["view"], warehouse: ["view"] });
      expect((await invoke("GET", "/api/deliveries/reports/export", manager, {}, {}, q)).statusCode).toBe(403);
      for (const dateType of ["created", "dispatched", "completed"]) {
        const result = await invoke("GET", "/api/deliveries/reports", manager, {}, {},
          { ...q, dateType });
        expect(result.body.summary.total).toBe(dateType === "created" ? 5 : 1);
        if (dateType === "dispatched") {
          expect(result.body.deliveries[0].reportDispatchedAt).toBe("2026-01-01T21:00:00.000Z");
          expect(result.body.deliveries[0].startedAt).toBe("2026-01-04T09:00:00.000Z");
        }
      }
      for (const invalid of [{ dateType: "a.created_at;DROP TABLE users" }, { carrier: "bogus" },
        { from: "2026-01-03", to: "2026-01-02" }, { carrier: "road", carrierName: "hidden" }]) {
        expect((await invoke("GET", "/api/deliveries/reports", manager, {}, {}, { ...q, ...invalid })).statusCode).toBe(400);
      }
    } finally { state.permissions.set(manager.id, original); }
  });

  it("uses inclusive Riyadh calendar days and neutralizes spreadsheet formulas", () => {
    expect(reportDateBounds("2026-01-02").start.toISOString()).toBe("2026-01-01T21:00:00.000Z");
    expect(reportDateBounds("2026-01-02").end.toISOString()).toBe("2026-01-02T21:00:00.000Z");
    expect(csvCell('=1+2 "quoted"')).toBe('"\'=1+2 ""quoted"""');
    expect(csvCell("  @cmd")).toBe('"\'  @cmd"');
  });

  it("denies a revoked driver write and hides old proof after cancellation", async () => {
    const order = await client.query(`INSERT INTO central_kitchen_orders
      (order_number,request_branch_id,central_kitchen_id,order_date,status,idempotency_key,payload_fingerprint,created_by)
      VALUES ($1,$2,$3,current_date,'dispatched',$4,$5,$6) RETURNING id`,
      [`${fixture.prefix}-cancel-proof`, fixture.destination, fixture.kitchen,
        `${fixture.prefix}-cancel-proof-key`, "e".repeat(64), fixture.manager!.id]);
    const created = await invoke("POST", "/api/deliveries", fixture.manager!, {
      sourceType: "kitchen", sourceId: order.rows[0].id, driverId: fixture.driver!.id, vehicleNumber: "CP-1",
    });
    expect(created.statusCode).toBe(201);
    const id = created.body.id;
    // Viewer-role restrictions apply even when the identity is still the assigned driver.
    const restricted = { ...fixture.driver!, role: "viewer" };
    expect((await invoke("POST", "/api/deliveries/:id/start", restricted, {}, { id })).statusCode).toBe(403);
    expect((await invoke("GET", "/api/deliveries/:id", restricted, {}, { id })).statusCode).toBe(403);
    expect((await invoke("POST", "/api/deliveries/:id/start", fixture.driver!, {}, { id })).statusCode).toBe(200);
    expect((await invoke("POST", "/api/deliveries/:id/proof", fixture.driver!,
      { signatureData: png, receiverName: "Recipient" }, { id })).statusCode).toBe(200);
    expect((await invoke("GET", "/api/deliveries/:id/proof", fixture.driver!, {}, { id })).body.signatureData).toBe(png);
    expect((await invoke("POST", "/api/deliveries/:id/cancel", fixture.manager!,
      { reason: "Carrier changed" }, { id })).statusCode).toBe(200);
    expect((await invoke("GET", "/api/deliveries/:id", fixture.driver!, {}, { id })).body.proofPresent).toBe(false);
    expect((await invoke("GET", "/api/deliveries/:id", fixture.manager!, {}, { id })).body.proofPresent).toBe(true);
    expect((await invoke("GET", "/api/deliveries/:id/proof", fixture.driver!, {}, { id })).statusCode).toBe(403);
    expect((await invoke("GET", "/api/deliveries/:id/proof", fixture.manager!, {}, { id })).body.signatureData).toBe(png);
    expect((await invoke("POST", "/api/deliveries/:id/reassign", fixture.manager!,
      { driverId: fixture.otherDriver!.id, vehicleNumber: "CP-2" }, { id })).statusCode).toBe(200);
    expect((await invoke("GET", "/api/deliveries/:id/proof", fixture.driver!, {}, { id })).statusCode).toBe(403);
    expect((await invoke("GET", "/api/deliveries/:id/proof", fixture.otherDriver!, {}, { id })).body.signatureData).toBeNull();
  });

  it("cancels only metadata with reason, enqueues once and can reassign same unreceived source safely", async () => {
    const request = { sourceType: "material_transfer", sourceId: fixture.transfer,
      driverId: fixture.driver!.id, vehicleNumber: "V-4" };
    // Earlier test already created and failed/reassigned this transfer; reuse its task.
    const row = (await client.query("SELECT id FROM delivery_assignments WHERE source_type='material_transfer' AND source_id=$1",
      [fixture.transfer])).rows[0];
    const id = Number(row.id);
    expect((await invoke("POST", "/api/deliveries/:id/cancel", fixture.driver!, { reason: "No service" }, { id })).statusCode).toBe(403);
    expect((await invoke("POST", "/api/deliveries/:id/cancel", fixture.manager!, { reason: "Change carrier" }, { id })).body.status).toBe("cancelled");
    expect((await invoke("POST", "/api/deliveries/:id/cancel", fixture.manager!, { reason: "Change carrier" }, { id })).statusCode).toBe(409);
    expect((await invoke("POST", "/api/deliveries", fixture.manager!, request)).statusCode).toBe(409);
    expect((await client.query("SELECT status FROM material_transfers WHERE id=$1", [fixture.transfer])).rows[0].status).toBe("in_transit");
    const reassigned = await invoke("POST", "/api/deliveries/:id/reassign", fixture.manager!,
      { driverId: fixture.driver!.id, vehicleNumber: "V-5" }, { id });
    expect(reassigned.body).toMatchObject({ id, status: "assigned", proofPresent: false,
      cancellationReason: null, driverId: fixture.driver!.id });
    expect(Number((await client.query(`SELECT count(*) amount FROM delivery_assignments
      WHERE source_type='material_transfer' AND source_id=$1`, [fixture.transfer])).rows[0].amount)).toBe(1);
    expect(Number((await client.query(`SELECT count(*) amount FROM delivery_notification_outbox
      WHERE assignment_id=$1 AND event_type='cancelled'`, [id])).rows[0].amount)).toBe(1);
  });
});