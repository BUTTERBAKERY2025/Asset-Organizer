import { beforeEach, describe, expect, it, vi } from "vitest";

const fakes = vi.hoisted(() => ({
  rows: [] as Array<unknown>,
  selectCalls: 0,
  permissionCalls: [] as string[],
  branchAllowed: true,
  allowMaintenance: true,
}));

function queryBuilder() {
  const builder: any = {
    from: () => builder,
    innerJoin: () => builder,
    where: () => builder,
    groupBy: () => builder,
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
    select: () => {
      fakes.selectCalls += 1;
      return queryBuilder();
    },
  },
}));

vi.mock("../server/storage", () => ({
  storage: {
    hasPermission: vi.fn(async (_userId: string, module: string) => {
      fakes.permissionCalls.push(module);
      return fakes.allowMaintenance && module === "maintenance";
    }),
  },
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
    expect(fakes.selectCalls).toBe(1);
    expect(fakes.permissionCalls).toEqual([]);
  });

  it("omits unauthorized modules and never runs their metric queries", async () => {
    fakes.rows.push([{ id: "branch-a" }]);
    const response = await request({ id: "employee", role: "employee" });
    expect(response.statusCode).toBe(200);
    expect(response.body.cards.map((card: any) => card.id)).toEqual(["maintenance"]);
    expect(fakes.permissionCalls).toHaveLength(11);
    expect(fakes.selectCalls).toBe(1);
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

  it("serves the real eleven-card contract and marks a failed card as error, not zero", async () => {
    fakes.rows.push(
      [{ id: "branch-a" }],
      [{ value: 2 }],
      [{ value: 1 }],
      new Error("waste metric unavailable"),
      [{ value: 2 }],
      [],
      [],
      [{ value: 4 }],
      [{ value: 1 }],
      [{ value: 3 }],
      [{ value: 5 }],
    );
    const response = await request({ id: "admin", role: "admin" });
    expect(response.statusCode).toBe(200);
    expect(response.body.branchId).toBe("branch-a");
    expect(response.body.cards.map((card: any) => card.id)).toEqual([
      "maintenance", "complaints", "waste", "purchasing", "kitchen", "closing",
      "targets", "sales", "employees", "documents", "advances",
    ]);
    expect(response.body.cards.map((card: any) => card.group)).toEqual([
      "operations", "operations", "operations", "operations", "operations", "operations",
      "sales", "sales", "people", "people", "people",
    ]);
    expect(response.body.cards.every((card: any) => card.href.includes("branchId=branch-a"))).toBe(true);
    const failed = response.body.cards.find((card: any) => card.id === "waste");
    expect(failed).toMatchObject({ state: "error", metrics: [], alerts: [] });
    expect(failed.metrics).not.toEqual([{ value: 0 }]);
  });
});