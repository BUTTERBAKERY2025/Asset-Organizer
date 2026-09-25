import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { branchOperationUrl } from "../client/src/lib/branch-operation-navigation";
import { readFileSync } from "node:fs";

const fakes = vi.hoisted(() => ({
  rows: [] as Array<unknown>,
  selectCalls: 0,
  permissionCalls: [] as string[],
  branchAllowed: true,
  allowMaintenance: true,
  modules: [] as string[],
  editAllowed: false,
  createAllowed: false,
  approveModules: [] as string[],
  kitchenReceiver: false,
  predicates: [] as any[],
  selections: [] as any[],
  joins: [] as any[],
}));

function queryBuilder() {
  const builder: any = {
    from: () => builder,
    innerJoin: () => builder,
    leftJoin: (_table: unknown, predicate: unknown) => { fakes.joins.push(predicate); return builder; },
    where: (predicate: unknown) => { fakes.predicates.push(predicate); return builder; },
    groupBy: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      const next = fakes.rows.shift() ?? [];
      return next instanceof Error ? Promise.reject(next).then(resolve, reject) : Promise.resolve(next).then(resolve, reject);
    },
  };
  return builder;
}

vi.mock("../server/db", () => ({
  db: {
    select: (selection: unknown) => {
      fakes.selectCalls += 1;
      fakes.selections.push(selection);
      return queryBuilder();
    },
  },
}));

vi.mock("../server/storage", () => ({
  storage: {
    hasPermission: vi.fn(async (_userId: string, module: string, action: string) => {
      fakes.permissionCalls.push(module);
      if (action === "approve") return fakes.approveModules.includes(module);
      if (action === "create") return fakes.createAllowed;
      if (action !== "view") return fakes.editAllowed;
      return (fakes.allowMaintenance && module === "maintenance") || fakes.modules.includes(module);
    }),
  },
}));

vi.mock("../server/central-kitchen-routing", () => ({
  kitchenActionAllowed: vi.fn(async () => fakes.kitchenReceiver),
}));
vi.mock("../server/employee-documents-read", () => ({
  readEmployeeDocumentMetadata: vi.fn(async () => ({ stats: { expired: 2, expiringSoon: 3 } })),
}));

vi.mock("../server/auth", () => ({
  isAuthenticated: (req: any, _res: any, next: () => void) => next(),
  canAccessBranch: vi.fn(async () => fakes.branchAllowed),
  HR_MANAGER_MODULES: new Set(["branch_employees", "hr_documents", "hr_advances"]),
  HR_SPECIALIST_PERMISSIONS: {},
  PRODUCTION_DEVELOPMENT_MANAGER_PERMISSIONS: {},
  FINANCIAL_MANAGER_PERMISSIONS: {},
  OPERATIONS_MANAGER_PERMISSIONS: { waste: ["view"] },
  BRANCH_MANAGER_CENTRAL_KITCHEN_PERMISSIONS: ["view", "create", "edit"],
  BRANCH_MANAGER_INTRINSIC_PERMISSIONS: { central_kitchen_orders: ["view", "create", "edit"] },
}));

import { registerBranchOperationsRoute } from "../server/branch-operations";

type CapturedRoute = { middleware: Function; handler: Function };

function registeredRoute(): CapturedRoute {
  let captured: CapturedRoute | undefined;
  const app = {
    get(path: string, middleware: Function, handler: Function) {
      expect(path).toBe("/api/branch-operations/summary");
      captured = { middleware, handler };
    },
  };
  registerBranchOperationsRoute(app as any);
  expect(captured).toBeDefined();
  return captured!;
}

async function request(currentUser: any, branchId: unknown = "branch-a") {
  const route = registeredRoute();
  const req: any = { currentUser, query: { branchId }, method: "GET" };
  const response: any = { statusCode: 200, body: undefined, headers: {} };
  const res: any = {
    set(name: string, value: string) {
      response.headers[name] = value;
      return res;
    },
    status(statusCode: number) {
      response.statusCode = statusCode;
      return res;
    },
    json(body: unknown) {
      response.body = body;
      return res;
    },
  };
  const errors: unknown[] = [];
  await new Promise<void>((resolve, reject) => {
    route.middleware(req, res, (error?: unknown) => error ? reject(error) : resolve());
  });
  await route.handler(req, res, (error: unknown) => errors.push(error));
  expect(errors).toEqual([]);
  return response;
}

describe("registered branch operations summary handler", () => {
  beforeEach(() => {
    fakes.rows.length = 0;
    fakes.selectCalls = 0;
    fakes.permissionCalls.length = 0;
    fakes.branchAllowed = true;
    fakes.allowMaintenance = true;
    fakes.modules = [];
    fakes.editAllowed = false;
    fakes.createAllowed = false;
    fakes.approveModules = [];
    fakes.kitchenReceiver = false;
    fakes.predicates = [];
    fakes.selections = [];
    fakes.joins = [];
  });

  it("rejects all-branch requests before any database or permission query", async () => {
    const response = await request({ id: "admin", role: "admin" }, "all");
    expect(response.statusCode).toBe(400);
    expect(response.headers["Cache-Control"]).toBe("no-store");
    expect(fakes.selectCalls).toBe(0);
    expect(fakes.permissionCalls).toEqual([]);
  });

  it("returns cross-branch 403 without executing permission or metric queries", async () => {
    fakes.rows.push([{ id: "branch-a" }]);
    fakes.branchAllowed = false;
    const response = await request({ id: "employee", role: "employee" });
    expect(response.statusCode).toBe(403);
    expect(fakes.selectCalls).toBe(0);
    expect(fakes.permissionCalls).toEqual([]);
  });

  it("omits unauthorized modules and never runs their metric queries", async () => {
    fakes.rows.push([{ id: "branch-a" }]);
    const response = await request({ id: "employee", role: "employee" });
    expect(response.statusCode).toBe(200);
    expect(response.body.cards.map((card: any) => card.id)).toEqual(["maintenance"]);
    expect(fakes.permissionCalls).toHaveLength(14);
    expect(fakes.selectCalls).toBe(3);
  });

  it("returns global 403 when no module is authorized, without metric queries", async () => {
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }]);
    const response = await request({ id: "employee", role: "employee" });
    expect(response.statusCode).toBe(403);
    expect(fakes.selectCalls).toBe(1);
  });

  it("enforces restricted roles and honors the same operations-role module alias as auth", async () => {
    fakes.rows.push([{ id: "branch-a" }]);
    const clerk = await request({ id: "clerk", role: "attendance_clerk" });
    expect(clerk.statusCode).toBe(403);
    expect(fakes.selectCalls).toBe(1);
    expect(fakes.permissionCalls).toEqual([]);

    fakes.selectCalls = 0;
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }], [{ value: 7 }]);
    const operations = await request({ id: "ops", role: "operations_manager" });
    expect(operations.statusCode).toBe(200);
    expect(operations.body.cards.map((card: any) => card.id)).toEqual(["waste"]);
    expect(operations.body.cards[0].metrics[0].value).toBe(7);
    expect(fakes.selectCalls).toBe(2);
  });

  it("isolates failed metrics instead of reporting fake zeros", async () => {
    fakes.modules = ["waste_tracking"];
    fakes.rows.push(
      [{ id: "branch-a" }],
      [],
      [],
      new Error("waste metric unavailable"),
    );
    const response = await request({ id: "employee", role: "employee" });
    expect(response.statusCode).toBe(200);
    expect(response.body.branchId).toBe("branch-a");
    expect(response.body.cards.map((card: any) => card.id)).toEqual([
      "maintenance", "waste",
    ]);
    expect(response.body.cards.every((card: any) => card.href.includes("branchId=branch-a"))).toBe(true);
    const failed = response.body.cards.find((card: any) => card.id === "waste");
    expect(failed).toMatchObject({ state: "error", metrics: [], alerts: [] });
    expect(failed.metrics).not.toEqual([{ value: 0 }]);
  });

  it("reports real branch-scoped maintenance status and overdue counts with disjoint alerts", async () => {
    fakes.rows.push(
      [{ id: "branch-a" }],
      [
        { status: "open", value: 5 },
        { status: "assigned", value: 2 },
        { status: "in_progress", value: 3 },
        { status: "closed", value: 4 },
      ],
      [
        { status: "open", value: 2, oldestDue: new Date("2025-01-01T09:00:00Z") },
        { status: "assigned", value: 1, oldestDue: new Date("2025-01-02T09:00:00Z") },
        { status: "in_progress", value: 1, oldestDue: new Date("2025-01-03T09:00:00Z") },
      ],
    );
    const response = await request({ id: "employee", role: "employee" });
    const card = response.body.cards[0];
    expect(card.metrics.map((metric: any) => metric.value)).toEqual([5, 2, 3, 4, 4]);
    expect(card.alerts.map((alert: any) => alert.count)).toEqual([4, 3]);
    expect(card.alerts[0]).toMatchObject({
      href: "/maintenance?branchId=branch-a&status=active&overdue=true",
      dueAt: "2025-01-01T09:00:00.000Z",
      actionLabel: "عرض المتابعة",
      priority: "high",
    });
    expect(card.alerts[1]).toMatchObject({
      href: "/maintenance?branchId=branch-a&status=open",
      actionLabel: "عرض المتابعة",
      priority: "normal",
    });
    expect(card.alerts.reduce((sum: number, alert: any) => sum + alert.count, 0)).toBe(7);

    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(fakes.predicates[1]).params).toEqual(["branch-a"]);
    const overdueScope = dialect.sqlToQuery(fakes.predicates[2]);
    expect(overdueScope.params.slice(0, 4)).toEqual(["branch-a", "open", "assigned", "in_progress"]);
    expect(overdueScope.sql).toContain('"maintenance_tickets"."due_at" <');
  });

  it("surfaces an unavailable maintenance migration as a card error without synthetic zeros", async () => {
    fakes.rows.push([{ id: "branch-a" }], new Error("relation maintenance_tickets does not exist"), []);
    const response = await request({ id: "employee", role: "employee" });
    expect(response.body.cards[0]).toMatchObject({
      id: "maintenance",
      state: "error",
      metrics: [],
      alerts: [],
    });
    expect(response.body.cards[0].statusLabel).toBeUndefined();
  });

  it.each([[false, false], [true, false], [true, true]])(
    "requires edit=%s and assigned receiver=%s for a kitchen receipt",
    async (edit, receiver) => {
      fakes.allowMaintenance = false;
      fakes.modules = ["central_kitchen_orders"];
      fakes.editAllowed = edit;
      fakes.kitchenReceiver = receiver;
      fakes.rows.push([{ id: "branch-a" }], [{ status: "dispatched", value: 3 }]);
      const response = await request({ id: "employee", role: "employee" });
      const card = response.body.cards[0];
      expect(card.metrics[3].value).toBe(3);
      expect(card.alerts.length).toBe(1);
      expect(card.alerts[0].actionLabel).toBe(edit && receiver ? "تأكيد الاستلام" : "عرض المتابعة");
      expect(card.alerts[0].href).toBe("/central-kitchen-orders?stage=dispatched&branchId=branch-a");
      expect(card.quickActions.some((action: any) => action.kind === "receive")).toBe(edit && receiver);
    },
  );

  it("uses the actual earliest timestamp rather than pairing it with a different earliest date", async () => {
    fakes.allowMaintenance = false;
    fakes.modules = ["central_kitchen_orders"];
    fakes.rows.push([{ id: "branch-a" }], [{
      status: "dispatched", value: 1, oldestNeededDate: "2026-01-01",
      oldestDue: "2026-01-05T08:00:00.000Z",
    }]);
    const response = await request({ id: "employee", role: "employee" });
    expect(response.body.cards[0].alerts[0].description).toContain("أقدم وقت احتياج محدد");
    expect(response.body.cards[0].alerts[0].description).not.toContain("2026-01-01");
  });

  it("exposes a cashier creation link only with create permission and through a registered destination", async () => {
    fakes.allowMaintenance = false;
    fakes.modules = ["cashier_journal"];
    fakes.rows.push([{ id: "branch-a" }], [], []);
    const reader = await request({ id: "cashier-a", role: "employee" });
    expect(reader.body.cards[0].quickActions).toEqual([]);

    fakes.createAllowed = true;
    fakes.rows.push([{ id: "branch-a" }], [], []);
    const creator = await request({ id: "cashier-a", role: "employee" });
    const action = creator.body.cards[0].quickActions[0];
    expect(action).toEqual({
      label: "يومية جديدة", href: "/cashier-journals/new?branchId=branch-a", kind: "create",
    });
    expect(branchOperationUrl(action.href, "branch-a")).toBe("/cashier-journals/new?branchId=branch-a&from=branch-operations");
    expect(readFileSync("client/src/App.tsx", "utf8")).toContain('<Route path="/cashier-journals/new">');
  });

  it("never turns source-side shipments into destination receipt actions", async () => {
    fakes.allowMaintenance = false;
    fakes.modules = ["warehouse"];
    fakes.editAllowed = true;
    fakes.rows.push([{ id: "branch-a" }], [{ value: 8 }], [
      { source: "branch-a", destination: "branch-b", status: "in_transit", value: 7 },
      { source: "branch-b", destination: "branch-a", status: "in_transit", value: 2 },
    ]);
    const response = await request({ id: "employee", role: "employee" });
    expect(response.body.cards[0].alerts).toEqual([]);
    expect(response.body.cards[1].alerts[0].count).toBe(2);
    expect(response.body.cards[1].metrics[1].value).toBe(7);
    expect(response.body.cards[1].quickActions).toContainEqual({
      label: "استلام تحويلات واردة",
      href: "/transfer-requests?status=in_transit&direction=incoming&branchId=branch-a",
      kind: "receive",
    });
    const scope = new PgDialect().sqlToQuery(fakes.predicates[2]);
    expect(scope.sql).toContain('"material_transfers"."source_branch_id"');
    expect(scope.sql).toContain('"material_transfers"."destination_branch_id"');
    expect(scope.params.slice(0, 2)).toEqual(["branch-a", "branch-a"]);
  });

  it("does not infer warehouse creation from edit or receipt from create", async () => {
    fakes.allowMaintenance = false;
    fakes.modules = ["warehouse"];
    fakes.createAllowed = true;
    fakes.rows.push([{ id: "branch-a" }], [{ value: 0 }], [
      { source: "main_warehouse", destination: "branch-a", status: "in_transit", value: 2 },
    ]);
    const response = await request({ id: "employee", role: "employee" });
    expect(response.body.cards[1].quickActions).toEqual([{
      label: "طلب تحويل جديد", href: "/transfer-requests?intent=create&from=branch-operations&branchId=branch-a", kind: "create",
    }]);
    expect(response.body.cards[1].alerts[0].actionLabel).toBe("عرض المتابعة");
  });

  it.each([undefined, { status: "open" }])("does not alarm about today's missing or unfinished closing", async closure => {
    fakes.allowMaintenance = false;
    fakes.modules = ["daily_closures"];
    fakes.rows.push([{ id: "branch-a" }], closure ? [closure] : [], [{ value: 0 }]);
    const response = await request({ id: "employee", role: "employee" });
    expect(response.body.cards[0].alerts).toEqual([]);
    expect(response.body.cards[0].actions).toBeUndefined();
  });

  it("separates unresolved complaints from resolved cases and overdue first responses", async () => {
    fakes.modules = ["branch_complaints"];
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }], [{ value: 4 }], [{ value: 2 }], [{ value: 1, oldestDue: new Date("2025-01-01T09:00:00Z") }]);
    const response = await request({ id: "employee", role: "employee" });
    expect(response.body.cards[0].metrics.map((m: any) => m.value)).toEqual([4, 2, 1]);
    expect(response.body.cards[0].alerts[0]).toMatchObject({
      dueAt: "2025-01-01T09:00:00.000Z", actionLabel: "عرض المتابعة", priority: "high",
    });
    expect(response.body.cards[0].alerts[0].label).toContain("أقدم");
    const dialect = new PgDialect();
    const open = dialect.sqlToQuery(fakes.predicates[1]);
    expect(open.params).toEqual(["branch-a", "open", "in_progress"]);
    expect(dialect.sqlToQuery(fakes.predicates[3]).sql).toContain('"first_responded_at" is null');
    expect(dialect.sqlToQuery(fakes.predicates[3]).params).toContain("in_progress");
    expect(dialect.sqlToQuery(fakes.predicates[3]).params).not.toContain("resolved");
    expect(response.body.cards[0].alerts[0].href).toContain("overdue=true");
    expect(response.body.cards[0].alerts[1]).toMatchObject({
      count: 3, priority: "normal", actionLabel: "عرض المتابعة",
      href: "/branch-complaints?unresolved=true&overdue=false&branchId=branch-a",
    });
    expect(response.body.cards[0].alerts[1].dueAt).toBeUndefined();
  });

  it.each([
    ["employee", [], false, true],
    ["manager", [], false, false],
    ["employee", ["cashier_performance"], false, false],
    ["employee", ["cashier_journal"], true, false],
    ["viewer", ["cashier_journal"], false, false],
  ])("distinguishes submitted journal review authority for %s with %j", async (role, grants, approve, ownOnly) => {
    fakes.allowMaintenance = false;
    fakes.modules = ["cashier_journal"];
    fakes.approveModules = grants as string[];
    fakes.rows.push([{ id: "branch-a" }], [], [{ status: "submitted", value: 2, oldestDate: "2026-01-01" }]);
    const response = await request({ id: "cashier-a", role });
    const alert = response.body.cards[0].alerts[0];
    expect(alert.actionLabel).toBe(approve ? "مراجعة للاعتماد" : "عرض المتابعة");
    expect(alert.href).toBe(`/cashier-journals?status=submitted&startDate=2026-01-01&endDate=${response.body.businessDate}&branchId=branch-a`);
    expect(alert.dueAt).toBeUndefined();
    const scope = new PgDialect().sqlToQuery(fakes.predicates[2]);
    expect(scope.params.includes("cashier-a")).toBe(ownOnly);
    expect(scope.params).toContain("branch-a");
    expect(scope.params).toContain("submitted");
    expect(response.body.cards.map((c: any) => c.id)).toEqual(["cashier"]);
  });

  it("separates kitchen supplier stages from receipt without fake deadlines", async () => {
    fakes.allowMaintenance = false;
    fakes.modules = ["central_kitchen_orders"];
    fakes.rows.push([{ id: "branch-a" }], [
      { status: "requested", value: 2 }, { status: "approved", value: 3 }, { status: "prepared", value: 1 },
    ]);
    const response = await request({ id: "employee", role: "employee" });
    const alerts = response.body.cards[0].alerts;
    expect(alerts.map((a: any) => a.count)).toEqual([2, 3, 1]);
    expect(alerts.every((a: any) => a.actionLabel === "عرض المتابعة" && a.priority === "low" && !a.dueAt)).toBe(true);
    expect(alerts[0].href).toBe("/central-kitchen-orders?stage=requested&branchId=branch-a");
  });

  it("keeps incoming pending warehouse stages separate from outgoing shipments", async () => {
    fakes.allowMaintenance = false;
    fakes.modules = ["warehouse"];
    fakes.rows.push([{ id: "branch-a" }], [], [
      { source: "branch-a", destination: "branch-b", status: "pending", value: 9 },
      { source: "branch-b", destination: "branch-a", status: "pending", value: 2 },
      { source: "branch-b", destination: "branch-a", status: "approved", value: 3 },
      { source: "branch-b", destination: "branch-a", status: "in_transit", value: 1 },
    ]);
    const response = await request({ id: "reader", role: "viewer" });
    const card = response.body.cards[1];
    expect(card.alerts.map((a: any) => a.count)).toEqual([1, 2, 3]);
    expect(card.alerts.every((a: any) => a.actionLabel === "عرض المتابعة" && a.href.includes("direction=incoming") && !a.dueAt)).toBe(true);
    expect(card.metrics[1].value).toBe(9);
  });

  it.each(["cashier_journal", "branch_complaints", "central_kitchen_orders"])("surfaces failed %s followups as an error, not completion", async module => {
    fakes.allowMaintenance = false;
    fakes.modules = [module];
    fakes.rows.push([{ id: "branch-a" }], new Error("source unavailable"));
    const response = await request({ id: "employee", role: "employee" });
    expect(response.body.cards[0]).toMatchObject({ state: "error", metrics: [], alerts: [] });
    expect(response.body.cards[0].statusLabel).toBeUndefined();
  });

  it("scopes cashier counters and backlog to the current actor without approve authority", async () => {
    fakes.modules = ["cashier_journal"];
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }], [{ status: "draft", value: 1 }],
      [{ status: "draft", value: 2, oldestDate: "2026-01-01" }, { status: "rejected", value: 1, oldestDate: "2026-02-01" }]);
    const response = await request({ id: "cashier-a", role: "employee" });
    const dialect = new PgDialect();
    for (const predicate of fakes.predicates.slice(1)) expect(dialect.sqlToQuery(predicate).params).toContain("cashier-a");
    const card = response.body.cards[0];
    expect(card.alerts[0].href).toContain("status=draft&startDate=2026-01-01");
    expect(card.alerts[1].description).toContain("لا يدعم");
    expect(card.alerts.every((alert: any) => !alert.dueAt)).toBe(true);
  });

  it("does not query schedules without shifts permission", async () => {
    fakes.modules = ["attendance"];
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }], []);
    const response = await request({ id: "employee", role: "employee" });
    expect(fakes.selectCalls).toBe(2);
    expect(response.body.cards[0].statusLabel).toContain("تتطلب صلاحية");
    expect(response.body.cards[0].metrics.some((metric: any) => metric.label.includes("مجدول"))).toBe(false);
    const identitySql = new PgDialect().sqlToQuery(fakes.joins[0]).sql;
    expect(identitySql).toContain('"attendance_records"."branch_employee_id"');
    expect(identitySql).toContain("^branch_emp_[0-9]+$");
    expect(identitySql).toContain("linked_user_id");
    expect(identitySql).not.toContain("employee_name");
  });

  it("queries branch/day scoped schedules only with a shifts grant and no fabricated missing schedules", async () => {
    fakes.modules = ["attendance", "shifts"];
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }], [], []);
    const response = await request({ id: "employee", role: "employee" });
    expect(fakes.selectCalls).toBe(3);
    const dialect = new PgDialect();
    for (const predicate of fakes.predicates.slice(1)) {
      expect(dialect.sqlToQuery(predicate).params).toEqual(["branch-a", response.body.businessDate]);
    }
    expect(response.body.cards[0]).toMatchObject({ state: "ready", statusLabel: "لا توجد جدولة محفوظة اليوم", alerts: [] });
  });

  it("returns error with no false zero attendance counters if the source fails", async () => {
    fakes.modules = ["attendance"];
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }], new Error("attendance unavailable"));
    const response = await request({ id: "employee", role: "employee" });
    expect(response.body.cards[0]).toMatchObject({ state: "error", metrics: [], alerts: [] });
  });

  it("keeps approved advances out of pending stages and does not invent actor actions", async () => {
    fakes.modules = ["hr_advances"];
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }], [{ status: "awaiting_signature", value: 3 }]);
    const response = await request({ id: "employee", role: "employee" });
    expect(response.body.cards[0].alerts).toEqual([]);
    expect(response.body.cards[0].actions).toBeUndefined();
    expect(new PgDialect().sqlToQuery(fakes.predicates[1]).params).toEqual([
      "branch-a", "pending", "pre_approved", "awaiting_signature", "signed",
    ]);
  });

  it("does not fabricate a daily target when no approved allocation exists", async () => {
    fakes.modules = ["targets"];
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }], []);
    const response = await request({ id: "employee", role: "employee" });
    expect(response.body.cards[0].metrics).toEqual([]);
    expect(response.body.cards[0].statusLabel).toContain("لا يوجد");
    expect(fakes.selectCalls).toBe(2);
  });

  it("exposes the oldest unclosed business date without inventing a cutoff instant", async () => {
    fakes.modules = ["daily_closures"];
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }], [], [{ value: 2, oldestDate: "2025-01-01" }]);
    const response = await request({ id: "viewer", role: "viewer" });
    const alert = response.body.cards[0].alerts[0];
    expect(alert.dueAt).toBeUndefined();
    expect(alert.description).toContain("2025-01-01");
    expect(alert.actionLabel).toBe("عرض المتابعة");
  });

  it("uses different document urgency and read-only follow-up labels", async () => {
    fakes.modules = ["hr_documents"];
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }]);
    const response = await request({ id: "viewer", role: "viewer" });
    const alerts = response.body.cards[0].alerts;
    expect(alerts.map((alert: any) => alert.priority)).toEqual(["high", "low"]);
    expect(alerts.every((alert: any) => alert.actionLabel === "عرض المتابعة")).toBe(true);
    expect(response.body.cards[0].actions).toBeUndefined();
  });

  it("casts real sales values before aggregation, not after the sum", async () => {
    fakes.modules = ["sales_analytics"];
    fakes.allowMaintenance = false;
    fakes.rows.push([{ id: "branch-a" }], [{ records: 2, value: 25.5 }]);
    const response = await request({ id: "viewer", role: "viewer" });
    expect(response.body.cards[0].metrics[0].value).toBe(25.5);
    const aggregate = new PgDialect().sqlToQuery(fakes.selections[1].value);
    expect(aggregate.sql).toContain('sum("cashier_sales_journals"."total_sales"::double precision)');
  });
});