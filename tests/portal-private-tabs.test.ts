import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";

// In-memory relational fixture: predicates are evaluated against every actor's
// rows, not prefiltered by the mocked authentication state. No DB or env writes.
const fixture = vi.hoisted(() => {
  const state = {
    actor: "user-a" as string | null,
    revoked: false,
    flags: {} as Record<string, string>,
    tables: {} as Record<string, any[]>,
    failTable: null as string | null,
    failSettings: false,
    reads: [] as string[],
  };
  const tableName = (table: any): string => table[Symbol.for("drizzle:Name")];
  const fieldName = (column: any): string =>
    column.name.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
  function matches(predicate: any, row: any): boolean {
    if (!predicate) return true;
    if (predicate.kind === "and") return predicate.parts.every((p: any) => matches(p, row));
    if (predicate.kind === "or") return predicate.parts.some((p: any) => matches(p, row));
    if (predicate.kind !== "eq") throw new Error("Unsupported fixture predicate");
    const name = tableName(predicate.column.table);
    const source = name === "salary_closure_lines" ? row.line : name === "salary_closures" ? row.closure : row;
    return source?.[fieldName(predicate.column)] === predicate.value;
  }
  const db = {
    select: vi.fn(() => {
      let table: any;
      let predicate: any;
      let maximum = Infinity;
      let joined = false;
      const execute = async () => {
        const name = tableName(table);
        state.reads.push(name);
        if (state.failTable === name) throw new Error("fixture read failure");
        let rows = state.tables[name] || [];
        if (joined) {
          rows = rows.flatMap(line => (state.tables.salary_closures || [])
            .filter(closure => closure.id === line.closureId)
            .map(closure => ({
              line, closure, month: closure.month, closedAt: closure.closedAt,
              closureStatus: closure.status,
            })));
        }
        return rows.filter(row => matches(predicate, row)).slice(0, maximum);
      };
      const builder: any = {
        from: (value: any) => { table = value; return builder; },
        where: (value: any) => { predicate = value; return builder; },
        orderBy: () => builder,
        innerJoin: () => { joined = true; return builder; },
        limit: (value: number) => { maximum = value; return builder; },
        then: (resolve: any, reject: any) => execute().then(resolve, reject),
      };
      return builder;
    }),
  };
  const storage = {
    getPortalSetting: vi.fn(async (key: string) => {
      if (state.failSettings) throw new Error("fixture settings failure");
      return state.flags[key];
    }),
    getActiveDailyChallenges: vi.fn(async () => []),
    getPointSettings: vi.fn(async () => ({
      isActive: true, seasonalMultiplier: 1, maxDailyPoints: null,
    })),
  };
  return { state, db, storage };
});

vi.mock("drizzle-orm", async importOriginal => ({
  ...await importOriginal<any>(),
  eq: (column: any, value: any) => ({ kind: "eq", column, value }),
  and: (...parts: any[]) => ({ kind: "and", parts }),
  or: (...parts: any[]) => ({ kind: "or", parts }),
}));
vi.mock("../server/db", () => ({ db: fixture.db, pool: {} }));
vi.mock("../server/storage", () => ({ storage: fixture.storage }));
vi.mock("../server/auth", () => {
  const permission = () => (_req: any, _res: any, next: any) => next();
  return {
    isAuthenticated: (req: any, res: any, next: any) => {
      if (fixture.state.revoked) return res.status(403).json({ error: "revoked" });
      if (!fixture.state.actor) return res.status(401).json({ error: "unauthorized" });
      req.currentUser = { id: fixture.state.actor, role: "employee" };
      // A stale secondary identity must never override authoritative currentUser.
      req.user = { id: "user-b", claims: { sub: "user-b" } };
      req.session = { portalAudited: true };
      next();
    },
    requirePermission: permission,
    requireAnyPermission: permission,
    getEffectiveBranchFilter: () => ({ hasAccess: true }),
    parseUserAgent: () => ({}),
    getCachedPermissionsForUser: () => [],
    HR_SPECIALIST_PERMISSIONS: {},
  };
});

const privatePaths = [
  "/api/my/incentives",
  "/api/my/challenges/today",
  "/api/my/documents",
  "/api/my/salary",
  "/api/my/payslips",
] as const;
const gatedPaths = [
  ["/api/my/incentives", "show_incentives"],
  ["/api/my/challenges/today", "show_incentives"],
  ["/api/my/documents", "show_documents"],
  ["/api/my/salary", "show_salary"],
  ["/api/my/payslips", "show_salary"],
] as const;
let server: Server;
let base: string;

async function api(path: string) {
  const response = await fetch(`${base}${path}`);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return { status: response.status, json: await response.json() };
}

beforeAll(async () => {
  const { registerSelfServiceRoutes } = await import("../server/self-service-routes");
  const app = express();
  registerSelfServiceRoutes(app);
  await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test listener");
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
  fixture.state.actor = "user-a";
  fixture.state.revoked = false;
  fixture.state.failTable = null;
  fixture.state.failSettings = false;
  fixture.state.reads = [];
  fixture.state.flags = {
    show_documents: "true", show_incentives: "true", show_salary: "true",
  };
  const employees = ["a", "b"].map((actor, index) => ({
    id: index + 1, linkedUserId: `user-${actor}`, branchId: `branch-${actor}`,
    employeeName: `Employee ${actor}`, salary: 4000 + index * 3000,
    housingAllowance: 500 + index * 100, transportAllowance: 100,
    foodAllowance: 50, otherAllowances: 25, socialInsuranceDeduction: 200,
    totalSalary: 4675 + index * 3100,
    iqamaExpiry: `203${index}-01-01`, healthCertificateExpiry: `203${index}-02-01`,
    bankAccountNumber: `private-bank-${actor}`, passportNumber: `private-passport-${actor}`,
  }));
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  fixture.state.tables = {
    branch_employees: employees,
    branches: employees.map(e => ({ id: e.branchId, name: e.branchId })),
    employee_documents: employees.map(e => ({
      id: e.id * 10, branchEmployeeId: e.id, fileUrl: `/private/employee-${e.id}.pdf`,
    })),
    incentive_awards: [
      ...employees.map(e => ({ id: e.id * 20, cashierId: e.linkedUserId, amount: e.id * 100 })),
      { id: 999, cashierId: "unlinked-user", amount: 9000 },
    ],
    salary_deductions: employees.flatMap(e => [
      { id: e.id * 30, branchEmployeeId: e.id, month: "2026-03", amount: e.id * 10, type: "manual", description: `own-${e.id}`, createdBy: "private-admin" },
      { id: e.id * 30 + 1, branchEmployeeId: e.id, month: "2026-02", amount: 900 },
    ]),
    salary_closures: [
      { id: 1, status: "closed", month: "2026-03", closedAt: "2026-04-01" },
      { id: 2, status: "draft", month: "2026-02" },
      { id: 3, status: "reopened", month: "2026-01" },
    ],
    salary_closure_lines: employees.flatMap(e => [1, 2, 3].map(closureId => ({
      id: e.id * 40 + closureId, branchEmployeeId: e.id, closureId,
      baseSalary: e.salary, netSalary: e.totalSalary - e.id * 10,
      grossSalary: e.totalSalary, allowances: 675, presentDays: 20, absentDays: 1,
      offDays: 4, paidLeaveDays: 2, unpaidLeaveDays: 0, absenceDeduction: 10,
      socialInsurance: 200, manualDeductionsTotal: e.id * 10,
      manualDeductions: [], internalNote: "private-payroll-note", bankAccountNumber: e.bankAccountNumber,
    }))),
    cashier_sales_journals: employees.flatMap(e => [
      { id: e.id * 50, cashierId: e.linkedUserId, branchId: e.branchId, journalDate: date, totalSales: 100, transactionCount: 10, customerCount: 10 },
      { id: e.id * 50 + 1, cashierId: e.linkedUserId, branchId: "tampered-branch", journalDate: date },
      { id: e.id * 50 + 2, cashierId: e.linkedUserId, branchId: e.branchId, journalDate: "2000-01-01" },
    ]),
  };
});

describe("private portal tabs use only the authenticated actor's linked employee", () => {
  it.each(["a", "b"])("actor %s receives own data despite foreign identity parameters", async actor => {
    fixture.state.actor = `user-${actor}`;
    const id = actor === "a" ? 1 : 2;
    const other = actor === "a" ? "b" : "a";
    const tampered = `?employeeId=${3 - id}&branchEmployeeId=${3 - id}&userId=user-${other}&cashierId=user-${other}&branchId=branch-${other}&month=2026-03`;
    expect(await api(`/api/my/incentives${tampered}`)).toEqual({
      status: 200, json: [{ id: id * 20, cashierId: `user-${actor}`, amount: id * 100 }],
    });
    const documents = await api(`/api/my/documents${tampered}`);
    expect(documents.status).toBe(200);
    expect(documents.json.documents.map((d: any) => d.id)).toEqual([id * 10]);
    expect(documents.json.expiry.iqamaExpiry).toBe(`203${id - 1}-01-01`);
    const salary = await api(`/api/my/salary${tampered}`);
    expect(salary.status).toBe(200);
    expect(salary.json.components.salary).toBe(id === 1 ? 4000 : 7000);
    expect(salary.json.deductions.map((d: any) => d.id)).toEqual([id * 30]);
    expect(salary.json.totalDeductions).toBe(id * 10);
    const payslips = await api(`/api/my/payslips${tampered}`);
    expect(payslips.status).toBe(200);
    expect(payslips.json).toHaveLength(1);
    expect(payslips.json[0]).toMatchObject({ month: "2026-03", baseSalary: id === 1 ? 4000 : 7000 });
    const challenges = await api(`/api/my/challenges/today${tampered}`);
    expect(challenges.status).toBe(200);
    expect(challenges.json.journals.map((j: any) => j.id)).toEqual([id * 50]);
    expect(fixture.storage.getActiveDailyChallenges).toHaveBeenCalledWith(`branch-${actor}`, challenges.json.date);
  });

  it("does not leak payroll internal or employee identity fields in income responses", async () => {
    const salary = (await api("/api/my/salary?month=2026-03")).json;
    expect(Object.keys(salary).sort()).toEqual(["components", "deductions", "month", "totalDeductions"]);
    expect(Object.keys(salary.components).sort()).toEqual([
      "salary", "housingAllowance", "transportAllowance", "foodAllowance",
      "otherAllowances", "socialInsuranceDeduction", "totalSalary",
    ].sort());
    expect(Object.keys(salary.deductions[0]).sort()).toEqual(["id", "type", "amount", "description", "month"].sort());
    const slips = (await api("/api/my/payslips")).json;
    const serialized = JSON.stringify({ salary, slips });
    for (const key of ["bankAccountNumber", "passportNumber", "internalNote", "createdBy", "linkedUserId", "branchEmployeeId"]) {
      expect(serialized).not.toContain(key);
    }
  });

  it("never includes income in the profile when salary visibility is revoked", async () => {
    fixture.state.flags.show_salary = "false";
    const profile = await api("/api/my/profile");
    expect(profile.status).toBe(200);
    expect(profile.json.employee.id).toBe(1);
    const serialized = JSON.stringify(profile.json);
    for (const key of ["salary", "Salary", "Allowance", "Insurance", "bankAccount", "passportNumber"]) {
      expect(serialized).not.toContain(key);
    }
  });

  it("returns no private rows for an unlinked actor, even with preexisting awards", async () => {
    fixture.state.actor = "unlinked-user";
    expect((await api("/api/my/incentives?userId=user-a")).json).toEqual([]);
    expect((await api("/api/my/documents?employeeId=1")).json).toEqual({ documents: [], expiry: null });
    expect((await api("/api/my/payslips?employeeId=1")).json).toEqual([]);
    expect((await api("/api/my/salary?employeeId=1")).status).toBe(403);
    expect((await api("/api/my/challenges/today?userId=user-a")).json.journals).toEqual([]);
    expect(fixture.state.reads.every(table => table === "branch_employees")).toBe(true);
  });

  it("honors unlinking and reopened payroll on the very next request", async () => {
    expect((await api("/api/my/payslips")).json).toHaveLength(1);
    fixture.state.tables.salary_closures[0].status = "reopened";
    expect((await api("/api/my/payslips")).json).toEqual([]);
    expect((await api("/api/my/incentives")).json).toHaveLength(1);
    fixture.state.tables.branch_employees[0].linkedUserId = null;
    expect((await api("/api/my/incentives")).json).toEqual([]);
  });
});

describe("private responses and revocations are never stored", () => {
  it.each(gatedPaths)("revoking %s denies the next request before private reads", async (path, flag) => {
    expect((await api(path)).status).toBe(200);
    fixture.state.flags[flag] = "false";
    fixture.state.reads = [];
    const denied = await api(path);
    expect(denied).toMatchObject({ status: 403, json: { disabled: true } });
    expect(fixture.state.reads).toEqual([]);
  });

  it.each(privatePaths)("%s fails closed when portal settings cannot be read", async path => {
    fixture.state.failSettings = true;
    expect(await api(path)).toMatchObject({ status: 403, json: { disabled: true } });
    expect(fixture.state.reads).toEqual([]);
  });

  it.each(privatePaths)("%s does not cache auth denials or database errors", async path => {
    fixture.state.actor = null;
    expect((await api(path)).status).toBe(401);
    fixture.state.actor = "user-a";
    fixture.state.revoked = true;
    expect((await api(path)).status).toBe(403);
    fixture.state.revoked = false;
    fixture.state.failTable = "branch_employees";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await api(path)).toMatchObject({ status: 500, json: { error: "fixture read failure" } });
    } finally {
      log.mockRestore();
    }
  });
});