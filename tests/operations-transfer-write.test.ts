import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  data: {} as any, statements: [] as string[], reads: [] as any[], writes: [] as string[],
  tail: Promise.resolve(), transactions: 0, rollbacks: 0, failAt: "", schemaError: undefined as any,
}));

// Transaction-local drafts + an actual asynchronous employee mutex. There is no
// database connection and no business data in these tests.
vi.mock("../server/db", () => ({ db: {
  transaction: async (callback: any) => {
    state.transactions++;
    let release: (() => void) | undefined;
    let draft: any;
    const data = () => draft ?? state.data;
    const writable = () => draft ??= structuredClone(state.data);
    const dialect = new PgDialect();
    const tx: any = {
      execute: async (statement: any) => {
        const query = dialect.sqlToQuery(statement);
        state.statements.push(query.sql);
        if (query.sql.includes("WHERE false")) {
          if (state.schemaError) throw state.schemaError;
        } else if (query.sql.includes("FROM branch_employees")) {
          const previous = state.tail;
          state.tail = new Promise<void>(resolve => { release = resolve; });
          await previous;
        }
        return { rows: [] };
      },
      select: (selection: any) => ({ from: (table: any) => {
        const name = getTableName(table);
        let condition: any;
        const rows = () => {
          const query = dialect.sqlToQuery(condition);
          state.reads.push({ table: name, query, locked: !!release });
          const id = query.params[0];
          if (name === "branch_employees") return data().employees.filter((row: any) => row.id === id);
          if (name === "users") return data().users.filter((row: any) => row.id === id);
          if (name === "user_branch_access") return data().grants.filter((row: any) => row.userId === id);
          if (name === "user_assignments") return data().assignments.filter((row: any) => row.userId === id && row.isActive);
          if (name === "employee_transfer_requests") {
            if (query.sql.includes('"employee_id"')) return data().transfers.filter((row: any) =>
              row.employeeId === id && query.params.slice(1).includes(row.status));
            return data().transfers.filter((row: any) => row.id === id);
          }
          throw new Error(`Unexpected table ${name}`);
        };
        const builder: any = {
          where(value: any) { condition = value; return builder; },
          limit: async (limit: number) => rows().slice(0, limit),
          then: (resolve: any, reject: any) => Promise.resolve(rows()).then(resolve, reject),
        };
        return builder;
      } }),
      insert: (table: any) => ({ values: (value: any) => {
        const name = getTableName(table);
        state.writes.push(`insert:${name}`);
        if (state.failAt === `insert:${name}`) throw new Error("INJECTED_WRITE_FAILURE");
        const current = writable();
        const key = name === "employee_transfer_requests" ? "transfers" : "history";
        const row = { id: Math.max(0, ...current[key].map((item: any) => item.id)) + 1, ...value };
        current[key].push(row);
        return { returning: async () => [row], then: (resolve: any, reject: any) => Promise.resolve().then(resolve, reject) };
      } }),
      update: (table: any) => ({ set: (values: any) => ({ where: (condition: any) => {
        const name = getTableName(table);
        state.writes.push(`update:${name}`);
        if (state.failAt === `update:${name}`) throw new Error("INJECTED_WRITE_FAILURE");
        const id = dialect.sqlToQuery(condition).params[0];
        const key = name === "branch_employees" ? "employees" : name === "users" ? "users" : "transfers";
        const updated = writable()[key].filter((row: any) => row.id === id);
        updated.forEach((row: any) => Object.assign(row, values));
        return { returning: async () => updated, then: (resolve: any, reject: any) => Promise.resolve().then(resolve, reject) };
      } }) }),
    };
    try {
      const result = await callback(tx);
      if (draft) state.data = draft;
      return result;
    } catch (error) {
      state.rollbacks++;
      throw error;
    } finally {
      release?.();
    }
  },
} }));
vi.mock("../server/auth", () => ({
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  getAllowedBranchIds: (req: any) => req.allowed,
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));
import { completeHrEmployeeTransfer, registerOperationsHrRoutes } from "../server/operations-hr-routes";

const routes: Record<string, Function[]> = {};
registerOperationsHrRoutes({
  get() {},
  post: (path: string, ...handlers: Function[]) => { routes[path] = handlers; },
} as any);
const base = { employeeId: 1, sourceBranchId: "a", destinationBranchId: "b", reason: "  operational move  " };
async function post(body: any = base, allowed = ["a", "b", "c"]) {
  let status = 200, result: any;
  const res: any = {
    status(value: number) { status = value; return this; },
    json(value: any) { result = value; return this; },
  };
  await routes["/api/operations-hr/transfers"].at(-1)!({
    currentUser: { id: "actual-actor", role: "operations_manager" }, body, allowed,
  }, res);
  return { status, result };
}
function pending(status = "pending", sourceBranchId = "a") {
  return { id: 10, employeeId: 1, sourceBranchId, destinationBranchId: "c",
    requestedBy: "original-requester", status, effectiveDate: "2026-10-01" };
}
beforeEach(() => {
  vi.useRealTimers();
  state.data = {
    employees: [{ id: 1, branchId: "a", status: "active", linkedUserId: "linked" }],
    users: [{ id: "linked", role: "employee", branchId: "a" }], grants: [], assignments: [],
    transfers: [], history: [],
  };
  state.statements = []; state.reads = []; state.writes = []; state.tail = Promise.resolve();
  state.transactions = 0; state.rollbacks = 0; state.failAt = ""; state.schemaError = undefined;
});

describe("operations transfer transaction", () => {
  it("uses the Saudi effective date, moves the ordinary linked account, and records the real actor atomically", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T22:30:00.000Z"));
    try {
      const response = await post();
      expect(response.status).toBe(201);
      expect(response.result).toMatchObject({
        sourceBranchId: "a", destinationBranchId: "b", status: "completed",
        requestedBy: "actual-actor", reason: "operational move", effectiveDate: "2026-10-01",
        completedAt: new Date("2026-09-30T22:30:00.000Z"),
      });
      expect(state.data.employees[0].branchId).toBe("b");
      expect(state.data.users[0]).toMatchObject({ role: "employee", branchId: "b" });
      expect(state.data.history).toEqual([expect.objectContaining({
        transferId: response.result.id, eventType: "completed", performedBy: "actual-actor",
        details: { employeeId: 1, sourceBranchId: "a", destinationBranchId: "b", reason: "operational move" },
      })]);
    } finally {
      vi.useRealTimers();
    }
  });
  it("serializes simultaneous different destinations; exactly one commits and the stale loser makes no extra history", async () => {
    const outcomes = await Promise.all([post(), post({ ...base, destinationBranchId: "c" })]);
    expect(outcomes.map(row => row.status).sort()).toEqual([201, 409]);
    expect(state.data.transfers).toHaveLength(1);
    expect(state.data.history).toHaveLength(1);
    expect(state.data.users[0].branchId).toBe(state.data.employees[0].branchId);
    expect(state.statements.filter(query => /FROM branch_employees.*FOR UPDATE/.test(query))).toHaveLength(2);
    expect(state.reads.filter(row => row.table === "branch_employees").every(row => row.locked)).toBe(true);
  });
  it("refuses a repeated request without a second transfer, move or audit entry", async () => {
    expect((await post()).status).toBe(201);
    const afterFirst = structuredClone(state.data);
    const writeCount = state.writes.length;
    expect((await post()).status).toBe(409);
    expect(state.data).toEqual(afterFirst);
    expect(state.writes).toHaveLength(writeCount);
  });
  it.each(["pending", "source_approved", "dest_approved", "hr_approved"])("blocks existing %s requests under the employee lock", async status => {
    state.data.transfers = [pending(status)];
    const before = structuredClone(state.data);
    const response = await post();
    expect(response).toMatchObject({ status: 409, result: { code: "TRANSFER_ALREADY_PENDING" } });
    expect(state.data).toEqual(before);
    expect(state.writes).toEqual([]);
    const pendingRead = state.reads.find(row => row.table === "employee_transfer_requests");
    expect(pendingRead.locked).toBe(true);
    expect(pendingRead.query.params).toEqual([1, "pending", "source_approved", "dest_approved", "hr_approved"]);
  });
  it.each(["completed", "rejected", "cancelled"])("does not block a terminal %s request", async status => {
    state.data.transfers = [pending(status)];
    expect((await post()).status).toBe(201);
    expect(state.data.transfers).toHaveLength(2);
  });
  it("rejects a stale source without any writes", async () => {
    state.data.employees[0].branchId = "c";
    const before = structuredClone(state.data);
    const response = await post();
    expect(response.status).toBe(409);
    expect(response.result.error).toContain("تغير فرع الموظف");
    expect(state.writes).toEqual([]);
    expect(state.data).toEqual(before);
  });
  it("returns not-found or refuses a same-branch move before any writes", async () => {
    expect((await post({ ...base, destinationBranchId: "a" })).status).toBe(403);
    state.data.employees = [];
    expect((await post()).status).toBe(404);
    expect(state.writes).toEqual([]);
  });
  it.each(["inactive", "terminated", "on_leave"])("rejects employee status %s", async status => {
    state.data.employees[0].status = status;
    const before = structuredClone(state.data);
    expect((await post()).status).toBe(409);
    expect(state.writes).toEqual([]);
    expect(state.data).toEqual(before);
  });
  it.each(["branch_manager", "operations_manager", "admin", "cashier", "hr_manager"])("preserves linked role restriction: %s", async role => {
    state.data.users[0].role = role;
    const before = structuredClone(state.data);
    expect((await post()).status).toBe(409);
    expect(state.writes).toEqual([]);
    expect(state.data).toEqual(before);
  });
  it.each(["grants", "assignments", "missing-user"])("rejects linked restriction %s without changing any accounts or audit", async restriction => {
    if (restriction === "grants") state.data.grants = [{ id: 1, userId: "linked", branchId: "a" }];
    if (restriction === "assignments") state.data.assignments = [{ id: 1, userId: "linked", isActive: true }];
    if (restriction === "missing-user") state.data.users = [];
    const before = structuredClone(state.data);
    expect((await post()).status).toBe(409);
    expect(state.writes).toEqual([]);
    expect(state.data).toEqual(before);
    expect(state.rollbacks).toBe(1);
  });
  it("permits a viewer with only inactive assignments, without altering assignment history", async () => {
    state.data.users[0].role = "viewer";
    state.data.assignments = [{ id: 1, userId: "linked", isActive: false }];
    expect((await post()).status).toBe(201);
    expect(state.data.assignments).toEqual([{ id: 1, userId: "linked", isActive: false }]);
    expect(state.data.users[0]).toMatchObject({ role: "viewer", branchId: "b" });
  });
  it("can transfer an employee without a linked account", async () => {
    state.data.employees[0].linkedUserId = null;
    expect((await post()).status).toBe(201);
    expect(state.data.users[0].branchId).toBe("a");
  });
  it.each(["update:users", "insert:transfer_history"])("rolls back transfer, employee and linked user on failure at %s", async failAt => {
    const before = structuredClone(state.data);
    state.failAt = failAt;
    const response = await post();
    expect(response.status).toBe(500);
    expect(response.result.error).toContain("لم تُحفظ تغييرات جزئية");
    expect(state.data).toEqual(before);
    expect(state.rollbacks).toBe(1);
  });
  it("returns a clear 503 before writes for missing schema, never attempting a migration", async () => {
    state.schemaError = { cause: { code: "42703" } };
    const before = structuredClone(state.data);
    const response = await post();
    expect(response.status).toBe(503);
    expect(response.result.code).toBe("TRANSFER_SCHEMA_NOT_READY");
    expect(state.writes).toEqual([]);
    expect(state.data).toEqual(before);
    expect(state.statements).toHaveLength(1);
    expect(state.statements[0]).toContain("WHERE false");
    expect(state.statements[0]).not.toMatch(/\b(CREATE|ALTER|INSERT|UPDATE|DELETE)\b/);
  });
});

describe("legacy HR completion shares transfer safety", () => {
  it("delegates only the completion route to the locked helper", () => {
    const source = readFileSync("server/routes.ts", "utf8");
    const completion = source.slice(source.indexOf('app.post("/api/employee-transfers/:id/complete"'),
      source.indexOf('app.post("/api/employee-transfers/:id/cancel"'));
    expect(completion).toContain("completeHrEmployeeTransfer(id, userId)");
    expect(completion).not.toContain("storage.updateBranchEmployee");
    expect(completion).toContain('error?.message === "STALE_SOURCE"');
  });
  it("atomically completes an approved request with employee/account movement and real completion actor", async () => {
    state.data.transfers = [pending("hr_approved")];
    const result = await completeHrEmployeeTransfer(10, "hr-completer");
    expect(result).toMatchObject({ status: "completed", currentApproverRole: null, completedAt: expect.any(Date) });
    expect(state.data.employees[0].branchId).toBe("c");
    expect(state.data.users[0].branchId).toBe("c");
    expect(state.data.history[0]).toMatchObject({ transferId: 10, eventType: "completed", performedBy: "hr-completer" });
  });
  it("refuses an old approved source after an operations move rather than overwriting the new branch", async () => {
    expect((await post()).status).toBe(201);
    state.data.transfers.push(pending("hr_approved", "a"));
    const before = structuredClone(state.data);
    const writeCount = state.writes.length;
    await expect(completeHrEmployeeTransfer(10, "hr-completer")).rejects.toThrow("STALE_SOURCE");
    expect(state.data).toEqual(before);
    expect(state.writes).toHaveLength(writeCount);
  });
  it("serializes competing HR and operations completion; the approved request cannot be bypassed", async () => {
    state.data.transfers = [pending("hr_approved")];
    const [operations, hr] = await Promise.all([post(), completeHrEmployeeTransfer(10, "hr-completer")]);
    expect(operations.status).toBe(409);
    expect(hr.status).toBe("completed");
    expect(state.data.employees[0].branchId).toBe("c");
    expect(state.data.transfers).toHaveLength(1);
    expect(state.data.history).toHaveLength(1);
  });
  it("makes simultaneous/repeated HR completion idempotent, even if the employee subsequently moved", async () => {
    state.data.transfers = [pending("hr_approved")];
    const results = await Promise.all([completeHrEmployeeTransfer(10, "first"), completeHrEmployeeTransfer(10, "second")]);
    expect(results.every(result => result.status === "completed")).toBe(true);
    expect(state.data.history).toHaveLength(1);
    state.data.employees[0].branchId = "b";
    state.data.users[0].branchId = "b";
    const writeCount = state.writes.length;
    await completeHrEmployeeTransfer(10, "third");
    expect(state.data.employees[0].branchId).toBe("b");
    expect(state.writes).toHaveLength(writeCount);
  });
  it.each(["pending", "source_approved", "dest_approved", "rejected", "cancelled"])("does not complete unapproved status %s", async status => {
    state.data.transfers = [pending(status)];
    await expect(completeHrEmployeeTransfer(10, "hr")).rejects.toThrow("TRANSFER_NOT_APPROVED");
    expect(state.writes).toEqual([]);
  });
  it.each(["inactive", "role", "grants", "assignments"])("refuses unsafe legacy completion: %s", async restriction => {
    state.data.transfers = [pending("hr_approved")];
    if (restriction === "inactive") state.data.employees[0].status = "inactive";
    if (restriction === "role") state.data.users[0].role = "branch_manager";
    if (restriction === "grants") state.data.grants = [{ id: 1, userId: "linked", branchId: "a" }];
    if (restriction === "assignments") state.data.assignments = [{ id: 1, userId: "linked", isActive: true }];
    const before = structuredClone(state.data);
    await expect(completeHrEmployeeTransfer(10, "hr")).rejects.toThrow(
      restriction === "inactive" ? "INACTIVE_EMPLOYEE" : "LINKED_ACCOUNT_NEEDS_HR",
    );
    expect(state.data).toEqual(before);
    expect(state.writes).toEqual([]);
  });
  it("rolls back legacy completion if writing audit fails", async () => {
    state.data.transfers = [pending("hr_approved")];
    const before = structuredClone(state.data);
    state.failAt = "insert:transfer_history";
    await expect(completeHrEmployeeTransfer(10, "hr")).rejects.toThrow("INJECTED_WRITE_FAILURE");
    expect(state.data).toEqual(before);
  });
});