import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  getMaintenanceTicketTransition, maintenanceTicketTransitionSchema, maintenanceTicketListQuerySchema,
  maintenanceTicketCreateSchema, maintenanceTicketPatchSchema,
} from "../shared/maintenance-tickets";

const f = vi.hoisted(() => ({
  rows: [] as any[], writes: [] as any[], predicates: [] as any[], failAudit: false,
  permissions: ["view", "create", "edit", "approve"], active: true, branchAllowed: true,
  role: "employee", userRows: [] as any[],
  directRows: null as any[] | null, roleGrants: [] as any[], overrides: [] as any[],
  committed: [] as any[], ready: true, cleanups: 0, downloads: 0,
  file: { buffer: Buffer.from([255,216,255,1]), originalname: "photo.jpg", size: 4 },
}));
vi.mock("../server/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  function builder(table?: any, write = false) {
    let name = table ? getTableName(table) : "";
    const result: any = {
      from(t: any) { name = getTableName(t); return result; },
      innerJoin: () => result,
      where(p: any) { f.predicates.push(p); return result; },
      limit: () => result, offset: () => result, orderBy: () => result,
      set(value: any) { f.writes.push({ table: name, value }); return result; },
      values(value: any) { f.writes.push({ table: name, value }); return result; },
      returning: () => result,
      then(resolve: any, reject: any) {
        if (f.failAudit && name === "system_audit_logs") return Promise.reject(new Error("audit failed")).then(resolve, reject);
        let rows: any[];
        if (!write && name === "users") rows = f.userRows.length ? f.userRows.shift()
          : f.active ? [{ id: "u1", role: f.role, isActive: "active", username: "tester", branchId: "a" }] : [];
        else if (!write && name === "user_permissions") rows = f.directRows ?? [{ module: "maintenance", actions: [...f.permissions] }];
        else if (!write && name === "user_assignments") rows = f.roleGrants;
        else if (!write && name === "user_permission_overrides") rows = f.overrides;
        else if (!write && name === "user_branch_access") rows = [{ branchId: "a" }];
        else rows = f.rows.shift() ?? [];
        return Promise.resolve(rows).then(resolve, reject);
      },
    };
    return result;
  }
  const db: any = { select: () => builder(), insert: (t: any) => builder(t, true), update: (t: any) => builder(t, true) };
  db.transaction = async (work: any) => {
    const before = f.writes.length;
    try { const result = await work(db); f.committed.push(...f.writes.slice(before)); return result; }
    catch (error) { f.writes.splice(before); throw error; }
  };
  return { db };
});
vi.mock("../server/auth", () => ({
  isAuthenticated: (req: any, res: any, next: any) => req.session.userId ? next() : res.status(401).json({}),
  canAccessBranch: async (_req: any, branchId: string) => f.branchAllowed && branchId === "a",
  OPERATIONS_MANAGER_PERMISSIONS: {}, BRANCH_MANAGER_INTRINSIC_PERMISSIONS: {},
}));
vi.mock("../server/maintenance-ticket-attachment-storage", () => ({
  maintenanceTicketAttachmentStorage: {
    isReady: async () => f.ready,
    upload: async () => ({ storagePath: "/objects/maintenance-tickets/private.jpg" }),
    delete: async () => { f.cleanups++; },
    download: async () => { f.downloads++; return { data: Buffer.from("photo") }; },
  },
}));
vi.mock("multer", () => {
  const multer: any = () => ({ single: () => (req: any, _res: any, next: any) => { req.file = f.file; next(); } });
  multer.memoryStorage = () => ({});
  return { default: multer };
});
import { registerMaintenanceTicketRoutes, sniffMaintenancePhoto } from "../server/maintenance-tickets";
import { storage } from "../server/storage";
const routes: any[] = [];
const app: any = {};
for (const method of ["get","post","patch","delete"]) app[method] = (path: string, ...handlers: any[]) => routes.push({ method, path, handlers });
registerMaintenanceTicketRoutes(app);
async function invoke(method: string, suffix: string, options: any = {}) {
  const route = routes.find(r => r.method === method && r.path === `/api/maintenance-tickets${suffix}`);
  expect(route).toBeDefined();
  const req: any = { session: { userId: "u1" }, params: { id: "1", attachmentId: "2" }, query: { branchId: "a" }, body: {}, ...options };
  let done!: () => void;
  const completed = new Promise<void>(resolve => { done = resolve; });
  const res: any = { statusCode: 200, headers: {}, status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; done(); return this; },
    send(body: any) { this.body = body; done(); return this; },
    setHeader(key: string, value: string) { this.headers[key] = value; },
  };
  let index = 0;
  function next(error?: any) {
    if (error) { res.error = error; done(); return; }
    const fn = route.handlers[index++];
    if (fn) Promise.resolve(fn(req, res, next)).catch(next);
  }
  next();
  await completed;
  return res;
}
const ticket = { id: 1, branchId: "a", description: "عطل", priority: "normal", status: "open", version: 1, assigneeUserId: null };
beforeEach(() => {
  storage.invalidatePermissionsCache();
  f.rows = []; f.writes = []; f.predicates = []; f.committed = []; f.failAudit = false;
  f.permissions = ["view","create","edit","approve"]; f.active = true; f.branchAllowed = true;
  f.role = "employee"; f.userRows = [];
  f.directRows = null; f.roleGrants = []; f.overrides = [];
  f.ready = true; f.cleanups = 0; f.downloads = 0;
});
describe("maintenance workflow contract", () => {
  it("requires assignment before processing and approval workflow after processing", () => {
    expect(getMaintenanceTicketTransition("open","start")).toBeNull();
    expect(getMaintenanceTicketTransition("open","close")).toBeNull();
    expect(getMaintenanceTicketTransition("open","assign")).toBe("assigned");
    expect(getMaintenanceTicketTransition("assigned","start")).toBe("in_progress");
    expect(getMaintenanceTicketTransition("in_progress","close")).toBe("closed");
    expect(getMaintenanceTicketTransition("closed","reopen")).toBe("open");
    expect(getMaintenanceTicketTransition("closed","assign")).toBeNull();
  });
  it("validates reasons, identity and immutable fields; supports dashboard active links", () => {
    expect(maintenanceTicketTransitionSchema.safeParse({ version: 1, action: "reopen", reason: " " }).success).toBe(false);
    expect(maintenanceTicketTransitionSchema.safeParse({ version: 1, action: "assign" }).success).toBe(false);
    expect(maintenanceTicketCreateSchema.safeParse({ branchId: "a", description: "عطل", status: "closed" }).success).toBe(false);
    expect(maintenanceTicketPatchSchema.safeParse({ version: 1, branchId: "b" }).success).toBe(false);
    expect(maintenanceTicketListQuerySchema.parse({ branchId: "a", status: "active", overdue: "true" }).status).toBe("active");
  });
  it("accepts image signatures only, never client MIME or executable/svg/pdf content", () => {
    expect(sniffMaintenancePhoto(Buffer.from("%PDF-fixture"))).toBeNull();
    expect(sniffMaintenancePhoto(Buffer.from("<svg>"))).toBeNull();
    expect(sniffMaintenancePhoto(f.file.buffer)?.mimeType).toBe("image/jpeg");
  });
});
describe("maintenance registered API security and transactions", () => {
  describe("fresh standard effective permissions (real storage resolver)", () => {
    it.each([
      ["get", "", "view"],
      ["get", "/summary", "view"],
      ["get", "/options", "view"],
      ["get", "/:id", "view"],
      ["get", "/:id/attachments/:attachmentId", "view"],
      ["post", "", "create"],
      ["patch", "/:id", "edit"],
      ["post", "/:id/attachments", "edit"],
      ["delete", "/:id/attachments/:attachmentId", "edit"],
    ])("active deny overrides warm grants on %s %s (%s)", async (method, suffix, action) => {
      const warm = await storage.getUserPermissions("u1");
      expect(warm.find(p => p.module === "maintenance")?.actions).toContain(action);
      f.overrides = [{ module: "maintenance", action, allow: false, expiresAt: null }];
      // The ordinary resolver is intentionally still cached; maintenance must not use it.
      expect((await storage.getUserPermissions("u1")).find(p => p.module === "maintenance")?.actions).toContain(action);
      const response = await invoke(method, suffix, { body: { version: 1, description: "تعديل", branchId: "a" } });
      expect(response.statusCode).toBe(403);
      expect(f.writes).toHaveLength(0);
      expect(f.downloads).toBe(0);
    });
    it.each([
      ["assign", "edit"], ["start", "edit"], ["close", "approve"], ["reopen", "approve"],
    ])("deny override blocks transition %s", async (action, permission) => {
      f.overrides = [{ module: "maintenance", action: permission, allow: false, expiresAt: null }];
      const response = await invoke("post", "/:id/transition", {
        body: { version: 1, action, assigneeUserId: "u1", reason: "عاد العطل" },
      });
      expect(response.statusCode).toBe(403);
      expect(f.writes).toHaveLength(0);
    });
    it("allows RBAC-only view/create and queries active role assignments", async () => {
      f.directRows = [];
      f.roleGrants = ["view", "create"].map(action => ({ module: "maintenance", action }));
      f.rows.push([ticket], [], []);
      expect((await invoke("post", "", { body: { branchId: "a", description: "عطل" } })).statusCode).toBe(201);
      const queries = f.predicates.map(p => new PgDialect().sqlToQuery(p));
      expect(queries.some(q => q.sql.includes('"user_assignments"."is_active" =') && q.params.includes(true))).toBe(true);
    });
    it("applies deny overrides to RBAC-only grants too", async () => {
      f.directRows = [];
      f.roleGrants = [{ module: "maintenance", action: "view" }];
      f.overrides = [{ module: "maintenance", action: "view", allow: false }];
      expect((await invoke("get", "")).statusCode).toBe(403);
    });
    it("merges every direct row for the module, not just the first", async () => {
      f.directRows = [
        { module: "maintenance", actions: ["view"] },
        { module: "maintenance", actions: ["create"] },
        { module: "inventory", actions: ["view"] },
      ];
      f.rows.push([ticket], [], []);
      expect((await invoke("post", "", { body: { branchId: "a", description: "عطل" } })).statusCode).toBe(201);
    });
    it("preserves standard custom-direct-rows OR assignment precedence (not a union)", async () => {
      f.directRows = [{ module: "inventory", actions: ["view"] }];
      f.roleGrants = [{ module: "maintenance", action: "view" }];
      expect((await invoke("get", "")).statusCode).toBe(403);
    });
    it("active allow override grants actions absent from direct and assignment rows", async () => {
      f.directRows = [];
      f.overrides = ["view", "create"].map(action => ({ module: "maintenance", action, allow: true, expiresAt: null }));
      f.rows.push([ticket], [], []);
      expect((await invoke("post", "", { body: { branchId: "a", description: "عطل" } })).statusCode).toBe(201);
    });
    it("ignores expired deny overrides without removing an existing grant", async () => {
      f.overrides = [{ module: "maintenance", action: "view", allow: false, expiresAt: new Date(0) }];
      f.rows.push([], [{ value: 0 }]);
      expect((await invoke("get", "")).statusCode).toBe(200);
    });
    it("expired allow overrides never grant absent permissions", async () => {
      f.directRows = [];
      f.overrides = [{ module: "maintenance", action: "view", allow: true, expiresAt: new Date(0) }];
      expect((await invoke("get", "")).statusCode).toBe(403);
    });
    it("assignee options apply effective deny overrides too", async () => {
      f.overrides = [{ module: "maintenance", action: "edit", allow: false, expiresAt: null }];
      f.rows.push([]);
      const response = await invoke("get", "/options");
      expect(response.statusCode).toBe(200);
      expect(response.body.assignees).toEqual([]);
    });
    it("allow overrides do not override hard role restrictions", async () => {
      f.role = "viewer"; f.directRows = [];
      f.overrides = ["view", "edit", "approve"].map(action => ({ module: "maintenance", action, allow: true }));
      expect((await invoke("patch", "/:id", { body: { version: 1, description: "تعديل" } })).statusCode).toBe(403);
      f.role = "attendance_clerk";
      expect((await invoke("get", "")).statusCode).toBe(403);
    });
  });
  describe.each(["viewer", "attendance_clerk"])("hard role boundary: %s", role => {
    it.each([
      ["post", "", { branchId: "a", description: "عطل" }],
      ["patch", "/:id", { version: 1, description: "تعديل" }],
      ["post", "/:id/transition", { version: 1, action: "assign", assigneeUserId: "u1" }],
      ["post", "/:id/transition", { version: 1, action: "start" }],
      ["post", "/:id/transition", { version: 1, action: "close" }],
      ["post", "/:id/transition", { version: 1, action: "reopen", reason: "عاد العطل" }],
      ["post", "/:id/attachments", { version: "1" }],
      ["delete", "/:id/attachments/:attachmentId", { version: 1 }],
    ])("denies %s %s despite persisted grants and stale admin identity", async (method, suffix, body) => {
      f.role = role;
      const response = await invoke(method, suffix, {
        body, currentUser: { id: "u1", role: "admin" },
      });
      expect(response.statusCode).toBe(403);
      expect(f.writes).toHaveLength(0);
      expect(f.downloads).toBe(0);
    });
  });
  it.each(["", "/summary", "/options", "/:id", "/:id/attachments/:attachmentId"])(
    "attendance clerk cannot read %s even with persisted view grants", async suffix => {
      f.role = "attendance_clerk";
      expect((await invoke("get", suffix, { currentUser: { id: "u1", role: "admin" } })).statusCode).toBe(403);
      expect(f.downloads).toBe(0);
    },
  );
  it("viewer can view with a grant but cannot view without one", async () => {
    f.role = "viewer";
    f.rows.push([], [{ value: 0 }]);
    expect((await invoke("get", "")).statusCode).toBe(200);
    f.permissions = ["edit", "approve"];
    expect((await invoke("get", "")).statusCode).toBe(403);
  });
  it("options excludes restricted assignee roles using the same fresh permission resolver", async () => {
    const person = (id: string, role: string) => ({ id, role, isActive: "active", username: id, branchId: "a" });
    const actor = person("actor", "employee");
    const viewer = person("viewer", "viewer");
    const clerk = person("clerk", "attendance_clerk");
    const worker = person("worker", "employee");
    f.userRows.push([actor], [viewer, clerk, worker], [viewer], [clerk], [worker]);
    f.rows.push([]);
    const response = await invoke("get", "/options");
    expect(response.statusCode).toBe(200);
    expect(response.body.assignees.map((person: any) => person.id)).toEqual(["worker"]);
  });
  it.each(["viewer", "attendance_clerk"])("rejects direct assignment to %s despite persisted grants", async role => {
    const actor = { id: "u1", role: "employee", isActive: "active", username: "actor", branchId: "a" };
    const restricted = { ...actor, id: "restricted", role };
    f.userRows.push([actor], [restricted]);
    f.rows.push([ticket]);
    const response = await invoke("post", "/:id/transition", {
      body: { version: 1, action: "assign", assigneeUserId: "restricted" },
    });
    expect(response.statusCode).toBe(400);
    expect(f.writes).toHaveLength(0);
  });
  it("requires fresh active identity, explicit action grants and view even for writers", async () => {
    expect((await invoke("get","", { session: {} })).statusCode).toBe(401);
    f.active = false;
    expect((await invoke("get","")).statusCode).toBe(403);
    f.active = true; f.permissions = ["create"];
    expect((await invoke("post","", { body: { branchId: "a", description: "عطل" } })).statusCode).toBe(403);
    f.permissions = ["view","edit"];
    expect((await invoke("post","/:id/transition", { body: { action: "close", version: 1 } })).statusCode).toBe(403);
    expect((await invoke("post","/:id/transition", { body: { action: "reopen", version: 1, reason: "عاد العطل" } })).statusCode).toBe(403);
    expect(f.writes).toHaveLength(0);
  });
  it.each(["", "/summary", "/options"])("rejects out-of-scope branch for %s", async suffix => {
    expect((await invoke("get",suffix,{ query: { branchId: "b" } })).statusCode).toBe(403);
  });
  it("enforces branch isolation on detail and photo reads", async () => {
    f.rows.push([{ ...ticket, branchId: "b" }]);
    expect((await invoke("get","/:id")).statusCode).toBe(404);
    f.rows.push([{ ...ticket, branchId: "b" }]);
    expect((await invoke("get","/:id/attachments/:attachmentId")).statusCode).toBe(404);
    expect(f.downloads).toBe(0);
  });
  it("filters active overdue lists by branch, active states and due date", async () => {
    f.rows.push([], [{ value: 0 }]);
    const response = await invoke("get","", { query: { branchId: "a", status: "active", overdue: "true" } });
    expect(response.statusCode).toBe(200);
    const queries = f.predicates.map(p => new PgDialect().sqlToQuery(p));
    const filter = queries.find(q => q.sql.includes('"due_at" <'))!;
    expect(filter.params).toEqual(expect.arrayContaining(["a","open","assigned","in_progress"]));
    expect(filter.params).not.toContain("closed");
    expect(response.headers["Cache-Control"]).toBe("private, no-store");
  });
  it("creates ticket, event and audit together", async () => {
    f.rows.push([ticket], [], []);
    const response = await invoke("post","", { body: { branchId: "a", description: "عطل" } });
    expect(response.statusCode).toBe(201);
    expect(f.committed.map(w => w.table)).toEqual(["maintenance_tickets","maintenance_ticket_events","system_audit_logs"]);
  });
  it("rejects cross-branch assets and ineligible assignees before writing", async () => {
    f.rows.push([]);
    expect((await invoke("post","", { body: { branchId: "a", description: "عطل", assetId: "other" } })).statusCode).toBe(400);
    f.permissions = ["view","create"];
    expect((await invoke("post","", { body: { branchId: "a", description: "عطل", assigneeUserId: "u2" } })).statusCode).toBe(400);
    expect(f.writes).toHaveLength(0);
  });
  it("rolls back mutations if audit persistence fails", async () => {
    f.failAudit = true;
    f.rows.push([ticket], []);
    const response = await invoke("post","", { body: { branchId: "a", description: "عطل" } });
    expect(response.error.message).toBe("audit failed");
    expect(f.committed).toHaveLength(0);
  });
  it("rejects stale edits with no event/audit, and prevents edits on closed tickets", async () => {
    f.rows.push([ticket], []);
    expect((await invoke("patch","/:id", { body: { version: 1, description: "تعديل" } })).statusCode).toBe(409);
    expect(f.committed).toHaveLength(0);
    f.rows.push([{ ...ticket, status: "closed" }]);
    expect((await invoke("patch","/:id", { body: { version: 1, description: "تعديل" } })).statusCode).toBe(409);
  });
  it("records reopen reason, clears closure/assignment, and guards status/version", async () => {
    f.rows.push([{ ...ticket, status: "closed" }], [{ ...ticket, version: 2 }], [], []);
    const response = await invoke("post","/:id/transition", { body: { version: 1, action: "reopen", reason: "عاد العطل" } });
    expect(response.statusCode).toBe(200);
    expect(f.committed[0].value).toMatchObject({ closedAt: null, assigneeUserId: null, status: "open", version: 2 });
    expect(f.committed[1].value.reason).toBe("عاد العطل");
    const sql = f.predicates.map(p => new PgDialect().sqlToQuery(p).sql).find(s => s.includes('"version" ='));
    expect(sql).toContain('"status" =');
  });
  it.each([
    ["open", "assign", "assigned"],
    ["assigned", "start", "in_progress"],
    ["in_progress", "close", "closed"],
  ])("performs %s -> %s with atomic event and audit", async (from, action, to) => {
    f.rows.push(
      [{ ...ticket, status: from, assigneeUserId: "u1" }],
      [{ ...ticket, status: to, assigneeUserId: "u1", version: 2 }], [], [],
    );
    const response = await invoke("post", "/:id/transition", {
      body: { version: 1, action, ...(action === "assign" ? { assigneeUserId: "u1" } : {}) },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe(to);
    expect(f.committed).toHaveLength(3);
  });
  it("rejects stale transition and stale attachment archive without audit events", async () => {
    f.rows.push([{ ...ticket, status: "in_progress" }], []);
    expect((await invoke("post", "/:id/transition", { body: { version: 1, action: "close" } })).statusCode).toBe(409);
    f.rows.push([ticket], []);
    expect((await invoke("delete", "/:id/attachments/:attachmentId", { body: { version: 1 } })).statusCode).toBe(409);
    expect(f.committed).toHaveLength(0);
  });
  it("compensates private photo upload on stale ticket, with no metadata committed", async () => {
    f.rows.push([ticket], []);
    const response = await invoke("post","/:id/attachments", { body: { version: "1" } });
    expect(response.statusCode).toBe(409);
    expect(f.cleanups).toBe(1);
    expect(f.committed).toHaveLength(0);
  });
  it("surfaces unavailable private storage without public fallback", async () => {
    f.ready = false; f.rows.push([ticket]);
    expect((await invoke("post","/:id/attachments", { body: { version: "1" } })).statusCode).toBe(503);
    expect(f.writes).toHaveLength(0);
  });
  it("hides private paths in detail and scopes downloads to active ticket attachment", async () => {
    const photo = { id: 2, ticketId: 1, storagePath: "/objects/maintenance-tickets/private.jpg", mimeType: "image/jpeg", originalName: "photo.jpg" };
    f.rows.push([ticket], [], [photo]);
    const response = await invoke("get","/:id");
    expect(response.body.attachments[0]).not.toHaveProperty("storagePath");
    f.rows.push([ticket], [photo]);
    const download = await invoke("get","/:id/attachments/:attachmentId");
    expect(download.headers["Cache-Control"]).toBe("private, no-store");
    expect(download.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(f.downloads).toBe(1);
  });
});