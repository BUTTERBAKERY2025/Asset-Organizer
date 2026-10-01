import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { riyadhBusinessDate } from "../shared/operations-performance";

const source = ts.createSourceFile("server/routes.ts", readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
const tables = Object.fromEntries([
  "branchDailyClosures", "branchDailyClosureJournals", "branchDailyClosurePayments",
  "cashierSalesJournals", "cashierPaymentBreakdowns",
].map(name => [name, { name, id: "id", status: "status", closureId: "closureId", journalId: "journalId",
  branchId: "branchId", closureDate: "closureDate" }])) as Record<string, any>;
const eq = (field: string, value: unknown) => ({ field, value });
const and = (...conditions: any[]) => ({ conditions });
const inArray = (field: string, values: unknown[]) => ({ field, values });
const matches = (row: any, condition: any): boolean => !condition || (condition.conditions
  ? condition.conditions.every((child: any) => matches(row, child))
  : condition.values ? condition.values.includes(row[condition.field]) : row[condition.field] === condition.value);
const sql = Object.assign((strings: TemplateStringsArray, ...values: any[]) => strings.join("?"), { join: () => "?" });
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

/** Execute the actual registered handler without loading unrelated routes or a live database. */
function handler(method: "post" | "delete", path: string, db: any) {
  let arrow: ts.ArrowFunction | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.expression.getText(source) === "app" && node.expression.name.text === method
      && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === path) {
      const candidate = node.arguments.at(-1);
      if (candidate && ts.isArrowFunction(candidate)) arrow = candidate;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!arrow) throw new Error(`Missing ${method} ${path}`);
  const deps = { db, ...tables, eq, and, inArray, sql, riyadhBusinessDate,
    isUserAdmin: (req: any) => req.currentUser.role === "admin",
    getCurrentUser: (req: any) => req.currentUser,
    canAccessBranch: async (_req: any, branchId: string) => branchId === "branch-b" };
  const compiled = ts.transpileModule(`const handler = ${arrow.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(deps), `${compiled}; return handler;`)(...Object.values(deps)) as (req: any, res: any) => Promise<void>;
}
function response() {
  const result: any = { status: vi.fn(() => result), json: vi.fn() };
  return result;
}
const request = (role = "admin", actorId = "creator", body: any = {}) =>
  ({ params: { id: "19" }, currentUser: { role, id: actorId }, body });

/** A row-locking, in-memory DB double. It never connects to or modifies real records. */
function database(status = "open") {
  const state: Record<string, any[]> = {
    branchDailyClosures: [{ id: 19, status, branchId: "branch-b", closureDate: "2026-09-15",
      createdBy: "creator", totalSales: 100, cashTotal: 100, journalsCount: 1 }],
    branchDailyClosureJournals: [{ closureId: 19, journalId: 7 }],
    branchDailyClosurePayments: [{ closureId: 19, paymentMethod: "cash", totalAmount: 100 }],
    cashierSalesJournals: [{ id: 7, status: "draft", branchId: "branch-b", journalDate: "2026-09-15",
      totalSales: 100, cashTotal: 100, branch_id: "branch-b", journal_date: "2026-09-15",
      total_sales: 100, cash_total: 100 }],
    cashierPaymentBreakdowns: [],
  };
  let tail = Promise.resolve();
  const events: string[] = [];
  const db: any = { state, events, holdNextLock: undefined, signalLocked: undefined, failDelete: undefined };
  const build = (release: { unlock?: () => void }) => ({
    select: () => {
      let table: any, condition: any;
      const read = () => state[table.name].filter(row => matches(row, condition)).map(row => ({ ...row }));
      const query: any = {
        from: (value: any) => { table = value; return query; },
        where: (value: any) => { condition = value; return query; },
        then: (resolve: any, reject: any) => Promise.resolve(read()).then(resolve, reject),
        for: async (mode: string) => {
          expect(mode).toBe("update");
          const previous = tail;
          const lock = deferred();
          tail = lock.promise;
          await previous;
          release.unlock = lock.resolve;
          events.push("closure-lock");
          const pause = db.holdNextLock;
          db.holdNextLock = undefined;
          db.signalLocked?.();
          if (pause) await pause;
          return read();
        },
      };
      return query;
    },
    execute: async (query: string) => {
      events.push("journal-lock");
      return { rows: query.includes("SELECT *") ? state.cashierSalesJournals.map(row => ({ ...row })) : [] };
    },
    update: (table: any) => ({ set: (values: any) => ({ where: (condition: any) => ({
      returning: async () => state[table.name].filter(row => matches(row, condition)).map(row => Object.assign(row, values)),
    }) }) }),
    delete: (table: any) => ({ where: async (condition: any) => {
      if (db.failDelete === table.name) throw new Error("injected transaction failure");
      events.push(`delete:${table.name}`);
      state[table.name] = state[table.name].filter(row => !matches(row, condition));
    } }),
    insert: (table: any) => ({ values: (values: any) => {
      const insert = () => {
        const row = { id: 20, ...values };
        state[table.name].push(row);
        return [row];
      };
      return { returning: async () => insert(), then: (resolve: any, reject: any) => Promise.resolve(insert()).then(resolve, reject) };
    } }),
  });
  Object.assign(db, build({}));
  db.transaction = async (work: any) => {
    const release: { unlock?: () => void } = {};
    const backup = structuredClone(state);
    try { return await work(build(release)); }
    catch (error) { Object.assign(state, backup); throw error; }
    finally { release.unlock?.(); }
  };
  return db;
}

afterEach(() => vi.useRealTimers());

describe("actual daily closure source lifecycle", () => {
  it("keeps deletion admin-only, regardless of who created the OPEN snapshot", async () => {
    const db = database();
    const res = response();
    await handler("delete", "/api/branch-daily-closures/:id", db)(request("cashier"), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(db.events).toEqual([]);
    expect(db.state.branchDailyClosures).toHaveLength(1);
  });

  it.each(["19-extra", "19.5", "-19", "1e1", "0"])("rejects noncanonical source IDs: %s", async id => {
    for (const [method, path] of [
      ["post", "/api/branch-daily-closures/:id/close"], ["delete", "/api/branch-daily-closures/:id"],
    ] as const) {
      const db = database(), res = response(), req = request();
      req.params.id = id;
      await handler(method, path, db)(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(db.events).toEqual([]);
    }
  });

  it("explicitly removes the complete OPEN snapshot and leaves all journals and their status/amounts intact", async () => {
    const db = database();
    const journals = structuredClone(db.state.cashierSalesJournals);
    const res = response();
    await handler("delete", "/api/branch-daily-closures/:id", db)(request(), res);
    expect(res.json).toHaveBeenCalledWith({ success: true, branchId: "branch-b", closureDate: "2026-09-15" });
    expect(db.state.branchDailyClosures).toEqual([]);
    expect(db.state.branchDailyClosureJournals).toEqual([]);
    expect(db.state.branchDailyClosurePayments).toEqual([]);
    expect(db.state.cashierSalesJournals).toEqual(journals);
    expect(db.events).toEqual(["closure-lock", "journal-lock", "delete:branchDailyClosurePayments",
      "delete:branchDailyClosureJournals", "delete:branchDailyClosures"]);
  });

  it("refuses CLOSED snapshots without unlinking or changing totals", async () => {
    const db = database("closed");
    const before = structuredClone(db.state);
    const res = response();
    await handler("delete", "/api/branch-daily-closures/:id", db)(request(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(db.state).toEqual(before);
    expect(db.events).toEqual(["closure-lock"]);
  });

  it("rolls back the entire removal if any child cleanup fails", async () => {
    const db = database();
    const before = structuredClone(db.state);
    db.failDelete = "branchDailyClosureJournals";
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = response();
      await handler("delete", "/api/branch-daily-closures/:id", db)(request(), res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(db.state).toEqual(before);
    } finally { quiet.mockRestore(); }
  });

  it.each(["close", "delete"] as const)("serializes %s-first finalization/removal without deleting an approved snapshot", async winner => {
    const db = database();
    const pause = deferred(), locked = deferred();
    db.holdNextLock = pause.promise;
    db.signalLocked = locked.resolve;
    const close = handler("post", "/api/branch-daily-closures/:id/close", db);
    const remove = handler("delete", "/api/branch-daily-closures/:id", db);
    const closedResponse = response(), removedResponse = response();
    const first = winner === "close" ? close(request(), closedResponse) : remove(request(), removedResponse);
    await locked.promise;
    const second = winner === "close" ? remove(request(), removedResponse) : close(request(), closedResponse);
    pause.resolve();
    await Promise.all([first, second]);
    if (winner === "close") {
      expect(db.state.branchDailyClosures[0]).toMatchObject({ status: "closed", totalSales: 100, closedBy: "creator" });
      expect(db.state.branchDailyClosureJournals).toHaveLength(1);
      expect(db.state.branchDailyClosurePayments).toHaveLength(1);
      expect(removedResponse.status).toHaveBeenCalledWith(409);
    } else {
      expect(db.state.branchDailyClosures).toEqual([]);
      expect(closedResponse.status).toHaveBeenCalledWith(409);
      expect(removedResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    }
  });

  it("preserves the admin creator approval exception, non-admin separation of duties and branch access", async () => {
    for (const [role, actorId, branchId, expected] of [
      ["admin", "creator", "branch-b", 200], ["cashier", "creator", "branch-b", 403],
      ["manager", "reviewer", "branch-b", 200], ["manager", "reviewer", "branch-other", 403],
    ] as const) {
      const db = database();
      db.state.branchDailyClosures[0].branchId = branchId;
      const res = response();
      await handler("post", "/api/branch-daily-closures/:id/close", db)(request(role, actorId), res);
      if (expected === 200) expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "closed" }));
      else expect(res.status).toHaveBeenCalledWith(expected);
    }
  });

  it("rebuilds an OPEN snapshot from corrected draft data without adding an approved-only policy", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T21:30:00Z"));
    const db = database();
    await handler("delete", "/api/branch-daily-closures/:id", db)(request(), response());
    Object.assign(db.state.cashierSalesJournals[0], { totalSales: 140, cashTotal: 140, total_sales: 140, cash_total: 140 });
    const res = response();
    await handler("post", "/api/branch-daily-closures", db)(request("admin", "creator", {
      branchId: "branch-b", closureDate: "2026-09-15", journalIds: [7],
    }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "open", totalSales: 140, cashTotal: 140, journalsCount: 1 }));
    expect(db.state.cashierSalesJournals[0].status).toBe("draft");
    expect(db.state.branchDailyClosureJournals).toEqual([expect.objectContaining({ closureId: 20, journalId: 7 })]);
  });

  it.each([
    { closureDate: "2026-09-16", journalIds: [7] }, { closureDate: "2026-02-30", journalIds: [7] },
    { closureDate: "2026-09-15", journalIds: [7, 7] }, { closureDate: "2026-09-15", journalIds: [7.5] },
  ])("rejects invalid dates/IDs and dates after Saudi today: %j", async body => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-14T21:30:00Z"));
    const db = database();
    const res = response();
    await handler("post", "/api/branch-daily-closures", db)(request("admin", "creator", { branchId: "branch-b", ...body }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.events).toEqual([]);
  });

  it("keeps existing journal linkage protection and canonical route permission checks", () => {
    const text = source.getFullText();
    expect(text).toContain('app.delete("/api/branch-daily-closures/:id", isAuthenticated, requirePermission("daily_closures", "delete")');
    expect(text).toContain('app.post("/api/branch-daily-closures/:id/close", isAuthenticated, requirePermission("daily_closures", "approve")');
    expect(text).toContain('throw new Error(`__JOURNAL_IN_CLOSURE__${lockRows[0].closureId}`)');
    expect(text).toContain("closureDate > riyadhBusinessDate(new Date())");
  });
});