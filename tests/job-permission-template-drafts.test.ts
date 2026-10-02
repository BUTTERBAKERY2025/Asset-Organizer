import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import {
  JOB_TEMPLATE_PROPOSALS, JOB_TEMPLATE_MODULES, templateContentSchema, appendTemplateVersionSchema, approveTemplateVersionSchema,
} from "../shared/job-permission-templates";
import { JobPermissionTemplateStorage } from "../server/job-permission-template-storage";

vi.mock("../server/db", () => ({ pool: {} }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (req: any, res: any, next: any) => req.currentUser ? next() : res.status(401).json({}),
  requireRole: (roles: string[]) => (req: any, res: any, next: any) =>
    roles.includes(req.currentUser.role) ? next() : res.status(403).json({}),
}));
import { registerJobPermissionTemplateDraftRoutes } from "../server/job-permission-template-routes";

function mockStorage() {
  let templates: any[] = [], versions: any[] = [], audits: any[] = [], approvals: any[] = [];
  let snapshot: any;
  let ready = true, approvalsReady = true, failAudit = false;
  const query = vi.fn(async (sql: string, args: any[] = []): Promise<any> => {
    if (sql.includes("to_regclass")) return { rows: [{ ready, approvals_ready: approvalsReady }] };
    if (sql === "BEGIN") { snapshot = structuredClone({ templates, versions, audits, approvals }); return { rows: [] }; }
    if (sql === "COMMIT") return { rows: [] };
    if (sql === "ROLLBACK") { ({ templates, versions, audits, approvals } = snapshot); return { rows: [] }; }
    if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
    if (sql.startsWith("SELECT id")) return { rows: templates.filter(t => t.key === args[0]) };
    if (sql.startsWith("SELECT key")) return { rows: templates.filter(t => t.id === args[0]) };
    if (sql.startsWith("SELECT MAX")) return { rows: [{ latest: Math.max(0, ...versions.filter(v => v.template_id === args[0]).map(v => v.version)) }] };
    if (sql.includes("INSERT INTO public.job_permission_template_drafts")) {
      const id = templates.length + 1;
      templates.push({ id, key: args[0], created_by: args[1] });
      return { rows: [{ id }] };
    }
    if (sql.includes("INSERT INTO public.job_permission_template_draft_versions")) {
      versions.push({ template_id: args[0], version: args[1], content: JSON.parse(args[2]),
        change_reason: args[3], created_by: args[4], created_at: "2026-10-02T00:00:00Z", status: "draft" });
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO public.system_audit_logs")) {
      if (failAudit) throw new Error("audit unavailable");
      audits.push(args); return { rows: [] };
    }
    if (sql.includes("INSERT INTO public.job_permission_template_approvals")) {
      approvals.push({ template_id: args[0], version: args[1], reason: args[2],
        reviewed: args[3], acknowledge_empty_permissions: args[4], approved_by: args[5],
        approved_at: "2026-10-02T01:00:00Z" });
      return { rows: [] };
    }
    if (sql.startsWith("SELECT version")) return { rows: approvals.filter(a =>
      a.template_id === args[0] && (args.length < 2 || a.version === args[1])) };
    if (sql.includes("SELECT DISTINCT")) return { rows: templates.map(t => {
      const v = versions.filter(v => v.template_id === t.id).at(-1);
      return { ...t, ...v, latest_version_approved: approvals.some(a => a.template_id === t.id && a.version === v.version) };
    }) };
    if (sql.includes("SELECT v.version")) return { rows: versions.filter(v => v.template_id === args[0]) };
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const release = vi.fn();
  const pool = { query, connect: vi.fn(async () => ({ query, release })) };
  return {
    service: new JobPermissionTemplateStorage(pool as any), query, release,
    state: () => ({ templates, versions, audits }),
    approvals: () => approvals,
    missingMigration: () => { ready = false; },
    missingApprovalMigration: () => { approvalsReady = false; },
    failAudit: () => { failAudit = true; },
  };
}

describe("draft template schemas and proposals", () => {
  it("matches the matrix exactly; empty self and manager templates are intentional", () => {
    expect(JOB_TEMPLATE_PROPOSALS).toHaveLength(9);
    for (const content of JOB_TEMPLATE_PROPOSALS) expect(templateContentSchema.parse(content)).toEqual(content);
    const grants = Object.fromEntries(JOB_TEMPLATE_PROPOSALS.map(p => [p.key, p.permissions]));
    expect(grants.team_leader).toEqual([
      { module: "branch_stock", actions: ["view"] }, { module: "branch_supply", actions: ["view", "create", "edit"] },
      { module: "central_kitchen_orders", actions: ["view", "create", "edit"] },
    ]);
    expect(grants.cashier).toEqual([{ module: "cashier_journal", actions: ["view", "create"] }]);
    expect(grants.chef).toEqual([{ module: "quality_control", actions: ["view", "create"] }]);
    expect(grants.driver).toEqual([{ module: "delivery_tasks", actions: ["view", "edit"] }]);
    for (const key of ["operations_manager", "area_manager", "branch_manager", "barista", "worker"]) expect(grants[key]).toEqual([]);
    expect(JOB_TEMPLATE_MODULES.every(m => m.label && m.actions.length)).toBe(true);
  });
  it.each([
    { permissions: [{ module: "unknown", actions: ["view"] }] },
    { permissions: [{ module: "branch_stock", actions: ["activate"] }] },
    { permissions: [{ module: "branch_stock", actions: ["view", "view"] }] },
    { permissions: [{ module: "branch_stock", actions: [] }, { module: "branch_stock", actions: [] }] },
    { status: "approved" }, { scopeType: "all" }, { assignedUserId: "employee" },
  ])("rejects unknown, duplicate and activation/assignment fields: %j", patch => {
    expect(templateContentSchema.safeParse({ ...JOB_TEMPLATE_PROPOSALS[0], ...patch }).success).toBe(false);
  });
  it("requires meaningful change reason and expected version", () => {
    expect(appendTemplateVersionSchema.safeParse({ content: JOB_TEMPLATE_PROPOSALS[0], changeReason: " ", expectedLatestVersion: 1 }).success).toBe(false);
    expect(appendTemplateVersionSchema.safeParse({ content: JOB_TEMPLATE_PROPOSALS[0], changeReason: "review", expectedLatestVersion: 0 }).success).toBe(false);
  });
});

describe("transactional dedicated draft storage (mock database)", () => {
  it("creates audited empty drafts and appends without modifying old versions", async () => {
    const mock = mockStorage(), content = JOB_TEMPLATE_PROPOSALS[0];
    const first = await mock.service.create(content, "admin-a");
    expect(first.versions[0]).toMatchObject({ version: 1, status: "draft", createdBy: "admin-a", content });
    const second = await mock.service.append(first.id, { content: { ...content, name: "Reviewed draft" }, expectedLatestVersion: 1, changeReason: "review" }, "admin-b");
    expect(second.versions).toHaveLength(2);
    expect(second.versions[0]).toEqual(first.versions[0]);
    expect(second.versions[1]).toMatchObject({ version: 2, createdBy: "admin-b", changeReason: "review" });
    expect(mock.state().audits).toHaveLength(2);
    expect(mock.query.mock.calls.some(([sql]) => /UPDATE|DELETE/.test(sql) && !sql.includes("FOR UPDATE"))).toBe(false);
  });
  it("rejects stale writes, key changes and duplicate keys without extra versions", async () => {
    const mock = mockStorage(), content = JOB_TEMPLATE_PROPOSALS[3];
    const first = await mock.service.create(content, "admin");
    await mock.service.append(first.id, { content, expectedLatestVersion: 1, changeReason: "review" }, "admin");
    await expect(mock.service.append(first.id, { content, expectedLatestVersion: 1, changeReason: "stale" }, "admin")).rejects.toMatchObject({ status: 409, code: "stale_version" });
    await expect(mock.service.append(first.id, { content: { ...content, key: "other" }, expectedLatestVersion: 2, changeReason: "rename key" }, "admin")).rejects.toMatchObject({ status: 400 });
    await expect(mock.service.create(content, "admin")).rejects.toMatchObject({ status: 409, code: "key_conflict" });
    expect(mock.state().versions).toHaveLength(2);
    expect(mock.query.mock.calls.some(([sql]) => sql.includes("FOR UPDATE"))).toBe(true);
  });
  it("explicit seed is idempotent and transactional; no overwrite of an edited proposal", async () => {
    const mock = mockStorage();
    expect(mock.state().templates).toHaveLength(0);
    expect(await mock.service.seedProposals("admin")).toHaveLength(9);
    await mock.service.append(1, { content: { ...mock.state().versions[0].content, name: "custom" }, expectedLatestVersion: 1, changeReason: "review" }, "admin");
    await mock.service.seedProposals("admin");
    expect(mock.state().templates).toHaveLength(9);
    expect(mock.state().versions).toHaveLength(10);
    expect(mock.state().audits).toHaveLength(10);
    expect((await mock.service.detail(1)).versions[1].content.name).toBe("custom");
  });
  it("audit failure rolls back the entire seed batch", async () => {
    const mock = mockStorage(); mock.failAudit();
    await expect(mock.service.seedProposals("admin")).rejects.toThrow("audit unavailable");
    expect(mock.state()).toEqual({ templates: [], versions: [], audits: [] });
    expect(mock.release).toHaveBeenCalledOnce();
  });
  it("missing migration returns identifiable 503, not an empty list", async () => {
    const mock = mockStorage(); mock.missingMigration();
    await expect(mock.service.list()).rejects.toMatchObject({ status: 503, code: "migration_required" });
    await expect(mock.service.seedProposals("admin")).rejects.toMatchObject({ status: 503 });
    expect(mock.query.mock.calls.some(([sql]) => sql === "BEGIN")).toBe(false);
  });
});

describe("explicit immutable content approvals (mock database)", () => {
  const approval = { version: 1, expectedLatestVersion: 1, reason: "Reviewed selected content only", reviewed: true };
  it.each([
    { reason: " " }, { reviewed: false }, { reviewed: undefined }, { version: 0 },
    { expectedLatestVersion: 0 }, { activate: true }, { acknowledgeEmptyPermissions: false },
  ])("rejects missing review, reason and authority fields: %j", patch => {
    expect(approveTemplateVersionSchema.safeParse({ ...approval, ...patch }).success).toBe(false);
  });
  it("approves only explicitly, preserving draft content and recording exact actor/history", async () => {
    const mock = mockStorage();
    const first = await mock.service.create(JOB_TEMPLATE_PROPOSALS[4], "creator");
    expect(first.approvals).toEqual([]);
    expect((await mock.service.list())[0].latestVersionApproved).toBe(false);
    const approved = await mock.service.approve(first.id, approval, "reviewer");
    expect(approved.versions).toEqual(first.versions);
    expect(approved.approvals).toEqual([{ version: 1, reason: approval.reason,
      approvedAt: "2026-10-02T01:00:00.000Z", approvedBy: "reviewer" }]);
    expect((await mock.service.list())[0]).toMatchObject({ status: "draft", latestVersionApproved: true });
    expect(JSON.parse(mock.state().audits.at(-1)[4])).toMatchObject({ effectiveAuthority: false, reviewed: true, version: 1 });
    await expect(mock.service.approve(first.id, approval, "other")).rejects.toMatchObject({ status: 409, code: "already_approved" });
    expect(mock.approvals()).toHaveLength(1);
    expect(mock.state().audits).toHaveLength(2);
  });
  it("requires explicit empty acknowledgement including modules with zero actions", async () => {
    const mock = mockStorage();
    const content = { ...JOB_TEMPLATE_PROPOSALS[0], permissions: [{ module: "branch_stock" as const, actions: [] }] };
    const first = await mock.service.create(content, "admin");
    await expect(mock.service.approve(first.id, approval, "admin")).rejects.toMatchObject({
      status: 400, code: "empty_permissions_acknowledgement_required",
    });
    expect(mock.approvals()).toEqual([]);
    expect((await mock.service.approve(first.id, { ...approval, acknowledgeEmptyPermissions: true }, "admin")).approvals).toHaveLength(1);
  });
  it("new versions start unapproved, preserve history and reject old/stale selections", async () => {
    const mock = mockStorage(), content = JOB_TEMPLATE_PROPOSALS[4];
    const first = await mock.service.create(content, "admin");
    const approved = await mock.service.approve(first.id, approval, "admin");
    const next = await mock.service.append(first.id, { content, expectedLatestVersion: 1, changeReason: "new review" }, "admin");
    expect(next.approvals).toEqual(approved.approvals);
    expect((await mock.service.list())[0].latestVersionApproved).toBe(false);
    for (const patch of [{}, { version: 1, expectedLatestVersion: 2 }, { version: 2, expectedLatestVersion: 1 }])
      await expect(mock.service.approve(first.id, { ...approval, ...patch }, "admin")).rejects.toMatchObject({ status: 409, code: "stale_version" });
    expect(mock.state().audits).toHaveLength(3);
    const detail = await mock.service.approve(first.id, { ...approval, version: 2, expectedLatestVersion: 2 }, "admin");
    expect(detail.approvals.map(a => a.version)).toEqual([1, 2]);
  });
  it("approval audit failure rolls back approval, without changing immutable versions", async () => {
    const mock = mockStorage();
    const first = await mock.service.create(JOB_TEMPLATE_PROPOSALS[4], "admin");
    mock.failAudit();
    await expect(mock.service.approve(first.id, approval, "admin")).rejects.toThrow("audit unavailable");
    expect(mock.approvals()).toEqual([]);
    expect((await mock.service.detail(first.id)).versions).toEqual(first.versions);
    expect(mock.state().audits).toHaveLength(1);
  });
  it("missing052 is an explicit503 for detail, summaries and approval, never empty history", async () => {
    const mock = mockStorage();
    const first = await mock.service.create(JOB_TEMPLATE_PROPOSALS[4], "admin");
    mock.missingApprovalMigration();
    for (const action of [() => mock.service.detail(first.id), () => mock.service.list(), () => mock.service.approve(first.id, approval, "admin")])
      await expect(action()).rejects.toMatchObject({ status: 503, code: "migration_required", message: expect.stringContaining("052_job_permission_template_approvals.sql") });
    expect(mock.approvals()).toEqual([]);
  });
  it("prepared052 adds immutable guards/FK with no seeds or existing policy writes", async () => {
    const sql = await readFile("migrations/052_job_permission_template_approvals.sql", "utf8");
    expect(sql).toContain("BEFORE INSERT OR UPDATE OR DELETE");
    expect(sql).toContain("PRIMARY KEY (template_id, version)");
    expect(sql).toContain("REFERENCES public.job_permission_template_draft_versions(template_id, version)");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).not.toMatch(/INSERT INTO|UPDATE public\.|role_templates|user_permissions/);
  });
});

describe("admin-only route contract", () => {
  function routes() {
    const registered: any[] = [];
    const app = Object.fromEntries(["get", "post"].map(method => [method, (path: string, ...handlers: any[]) => registered.push({ method, path, handlers })]));
    const mock = mockStorage();
    registerJobPermissionTemplateDraftRoutes(app as any, mock.service);
    return { registered, mock };
  }
  async function invoke(route: any, currentUser?: any, body?: any, params = {}) {
    const req = { currentUser, body, params }, res: any = { statusCode: 200 };
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (value: any) => { res.body = value; return res; };
    for (const handler of route.handlers) {
      let next = false;
      await handler(req, res, () => { next = true; });
      if (!next) break;
    }
    return res;
  }
  it("registers only seven content-review routes and denies module-only/nonadmin users on all", async () => {
    const { registered, mock } = routes();
    expect(registered).toHaveLength(7);
    expect(registered.every(r => !/activate|assign|delete/.test(r.path))).toBe(true);
    for (const route of registered) {
      expect((await invoke(route)).statusCode).toBe(401);
      for (const role of ["operations_manager", "branch_manager", "employee", "viewer"])
        expect((await invoke(route, { id: "nonadmin", role, permissions: ["users", "rbac"] })).statusCode).toBe(403);
    }
    expect(mock.query).not.toHaveBeenCalled();
  });
  it("admin approval201 returns detail; repeated409 and missing052503 are explicit", async () => {
    const { registered, mock } = routes(), admin = { id: "admin", role: "admin" };
    const first = await mock.service.create(JOB_TEMPLATE_PROPOSALS[4], "admin");
    const route = registered.find(r => r.path.endsWith("/:id/approvals"));
    const body = { version: 1, expectedLatestVersion: 1, reason: "review", reviewed: true };
    const params = { id: String(first.id) };
    expect(await invoke(route, admin, body, params)).toMatchObject({ statusCode: 201, body: { approvals: [{ version: 1 }] } });
    expect(await invoke(route, admin, body, params)).toMatchObject({ statusCode: 409, body: { error: "already_approved" } });
    expect((await invoke(route, admin, { ...body, reviewed: false }, params)).statusCode).toBe(400);
    mock.missingApprovalMigration();
    expect(await invoke(route, admin, body, params)).toMatchObject({ statusCode: 503, body: { error: "migration_required", message: expect.stringContaining("052_") } });
  });
  it("catalog checks readiness; admin create returns 201 detail; invalid payload is 400", async () => {
    const { registered, mock } = routes(), admin = { id: "admin", role: "admin" };
    const catalog = registered.find(r => r.path.endsWith("/catalog"));
    expect((await invoke(catalog, admin)).body.proposals).toHaveLength(9);
    const create = registered.find(r => r.method === "post" && r.path.endsWith("job-template-drafts"));
    expect((await invoke(create, admin, { content: JOB_TEMPLATE_PROPOSALS[0] })).statusCode).toBe(201);
    expect((await invoke(create, admin, { content: JOB_TEMPLATE_PROPOSALS[0], activate: true })).statusCode).toBe(400);
    mock.missingMigration();
    expect(await invoke(catalog, admin)).toMatchObject({ statusCode: 503, body: { error: "migration_required" } });
  });
  it("prepared migration installs append guards and does not seed or touch employee permissions", async () => {
    const sql = await readFile("migrations/051_job_permission_template_drafts.sql", "utf8");
    expect(sql).toContain("BEFORE UPDATE OR DELETE");
    expect(sql).toContain("PRIMARY KEY (template_id, version)");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).not.toMatch(/INSERT INTO|UPDATE public\.users|role_templates|user_permissions/);
  });
});