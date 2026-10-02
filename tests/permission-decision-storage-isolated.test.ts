import { readFileSync } from "node:fs";
import { createContext, Script } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import {
  normalizePermissionDecisionSnapshot, checkPermissionDecision,
  evaluatePermissionDecision, hasPermissionDecisionDeny, isPermissionTupleCurrent,
  type PermissionDecisionInput,
} from "../server/permission-decision";

// Pure fixtures plus AST-extracted real storage methods. Never import storage,
// db, dotenv, the application bootstrap, or any database driver.
const now = Date.parse("2026-10-02T12:00:00Z");
const role = (changes = {}) => ({
  module: "orders", action: "view", permissionId: 1, roleName: "reader",
  scopeType: "branch", branchId: "A", departmentId: null,
  startDate: new Date(now), endDate: null, isActive: true, ...changes,
});
const override = (changes = {}) => ({
  module: "orders", action: "view", permissionId: 1, allow: false,
  branchId: "A", departmentId: null, expiresAt: null, ...changes,
});
const input = (changes: Partial<PermissionDecisionInput> = {}): PermissionDecisionInput => ({
  userId: "u", sourceMode: null, direct: [], roles: [role()], overrides: [], ...changes,
});
const snapshot = (changes: Partial<PermissionDecisionInput> = {}) =>
  normalizePermissionDecisionSnapshot(input(changes), now);

describe("pure shared permission decisions", () => {
  it("global override start is inclusive in the existing temporal resolver", () => {
    for (const startDate of [new Date(now + 1), "2099-01-01T00:00:00Z"]) {
      const s = snapshot({ sourceMode: "direct", direct: [], roles: [],
        overrides: [override({ branchId: null, allow: true, startDate })] });
      expect(checkPermissionDecision(s, "orders", "view")).toBe(false);
      expect(evaluatePermissionDecision(s).every(p => !p.allowed)).toBe(true);
    }
    expect(checkPermissionDecision(snapshot({ sourceMode: "direct", direct: [], roles: [],
      overrides: [override({ branchId: null, allow: true, startDate: new Date(now) })] }), "orders", "view")).toBe(true);
  });
  it("clones raw direct rows including empty actions without promoting them to effective grants", () => {
    const direct = [{ module: "orders", actions: [] as string[] }, { module: "cash", actions: ["view"] }];
    const s = snapshot({ sourceMode: "inherit", direct });
    expect(s.directPermissions).toEqual(direct);
    expect(s.directPermissions).not.toBe(direct);
    expect(s.directPermissions[0]).not.toBe(direct[0]);
    expect(s.directPermissions[1].actions).not.toBe(direct[1].actions);
    direct[0].actions.push("delete");
    direct[1].actions.push("edit");
    direct[1].module = "changed";
    expect(s.directPermissions).toEqual([{ module: "orders", actions: [] }, { module: "cash", actions: ["view"] }]);
    expect(checkPermissionDecision(s, "cash", "view")).toBe(false);
    expect(checkPermissionDecision(s, "orders", "delete", { branchId: "A" })).toBe(false);
  });
  it("preserves null legacy heuristic, direct empty, and explicit inherit without unioning bases", () => {
    const direct = [{ module: "cash", actions: ["edit"] }];
    expect(checkPermissionDecision(snapshot({ direct }), "orders", "view", { branchId: "A" })).toBe(false);
    expect(checkPermissionDecision(snapshot({ direct }), "cash", "edit")).toBe(true);
    expect(checkPermissionDecision(snapshot({ sourceMode: "direct" }), "orders", "view", { branchId: "A" })).toBe(false);
    expect(checkPermissionDecision(snapshot({ sourceMode: "inherit", direct }), "orders", "view", { branchId: "A" })).toBe(true);
    expect(checkPermissionDecision(snapshot({ sourceMode: "inherit", direct }), "cash", "edit")).toBe(false);
  });
  it("scoped grants require concrete context and do not create an action × branch union", () => {
    const s = snapshot({ roles: [role(), role({ action: "edit", branchId: "B" })] });
    expect(checkPermissionDecision(s, "orders", "view")).toBe(false);
    expect(checkPermissionDecision(s, "orders", "edit", { branchId: "A" })).toBe(false);
    expect(checkPermissionDecision(s, "orders", "view", { branchId: "B" })).toBe(false);
    expect(checkPermissionDecision(s, "orders", "edit", { branchId: "B" })).toBe(true);
  });
  it("legacy null-branch assignments mean every concrete branch, never unscoped global", () => {
    const s = snapshot({ roles: [role({ branchId: null })] });
    expect(checkPermissionDecision(s, "orders", "view")).toBe(false);
    expect(checkPermissionDecision(s, "orders", "view", { branchId: "A" })).toBe(true);
    expect(checkPermissionDecision(s, "orders", "view", { branchId: "B" })).toBe(true);
  });
  it("department and joint scopes require all tuple dimensions", () => {
    const s = snapshot({ roles: [role({ scopeType: "department", branchId: null, departmentId: 3 })] });
    expect(checkPermissionDecision(s, "orders", "view", { branchId: "A" })).toBe(false);
    expect(checkPermissionDecision(s, "orders", "view", { departmentId: 3 })).toBe(true);
    expect(checkPermissionDecision(s, "orders", "view", { departmentId: 4 })).toBe(false);
    const joint = snapshot({ roles: [role({ scopeType: "branch_department", branchId: null, departmentId: 3 })] });
    expect(checkPermissionDecision(joint, "orders", "view", { departmentId: 3 })).toBe(false);
    expect(checkPermissionDecision(joint, "orders", "view", { branchId: "A", departmentId: 3 })).toBe(true);
  });
  it.each([
    [{ isActive: false }, false], [{ startDate: new Date(now + 1) }, false],
    [{ startDate: new Date(now) }, true], [{ endDate: new Date(now) }, false],
    [{ endDate: new Date(now + 1) }, true], [{ startDate: "bad" }, false],
  ])("assignment boundaries %j => %s", (changes, allowed) => {
    expect(checkPermissionDecision(snapshot({ roles: [role(changes)] }), "orders", "view", { branchId: "A" })).toBe(allowed);
  });
  it("overrides expire strictly after now and denies win independently of row order", () => {
    for (const overrides of [
      [override(), override({ allow: true })],
      [override({ allow: true }), override()],
    ]) {
      expect(checkPermissionDecision(snapshot({ overrides }), "orders", "view", { branchId: "A" })).toBe(false);
    }
    expect(checkPermissionDecision(snapshot({ overrides: [override({ expiresAt: new Date(now) })] }),
      "orders", "view", { branchId: "A" })).toBe(true);
    expect(checkPermissionDecision(snapshot({ overrides: [override({ expiresAt: new Date(now + 1) })] }),
      "orders", "view", { branchId: "A" })).toBe(false);
  });
  it("branch/department deny affects only its scope; absent context fails conservatively", () => {
    const s = snapshot({
      direct: [{ module: "orders", actions: ["view"] }],
      overrides: [override({ departmentId: 3 })],
    });
    expect(checkPermissionDecision(s, "orders", "view", { branchId: "A", departmentId: 3 })).toBe(false);
    expect(checkPermissionDecision(s, "orders", "view", { branchId: "B", departmentId: 3 })).toBe(true);
    expect(checkPermissionDecision(s, "orders", "view", { branchId: "A", departmentId: 4 })).toBe(true);
    expect(checkPermissionDecision(s, "orders", "view")).toBe(false);
    expect(hasPermissionDecisionDeny(s, "orders", "view", { branchId: "A", departmentId: 3 })).toBe(true);
  });
  it("override grants remain independent of source mode, scoped and expiring", () => {
    const s = snapshot({ sourceMode: "direct", overrides: [override({ allow: true })] });
    expect(checkPermissionDecision(s, "orders", "view")).toBe(false);
    expect(checkPermissionDecision(s, "orders", "view", { branchId: "A" })).toBe(true);
  });
  it("mirrors historical aliases directionally without broadening scope or bypassing denies", () => {
    const s = snapshot({ roles: [role({ module: "attendance" })] });
    expect(checkPermissionDecision(s, "attendance_check", "view", { branchId: "A" })).toBe(true);
    expect(checkPermissionDecision(s, "attendance_check", "view", { branchId: "B" })).toBe(false);
    expect(checkPermissionDecision(snapshot({ direct: [{ module: "attendance_check", actions: ["view"] }] }),
      "attendance", "view")).toBe(false);
    const denied = snapshot({ direct: [{ module: "pnl", actions: ["view"] }],
      overrides: [override({ module: "pnl", branchId: null })] });
    expect(checkPermissionDecision(denied, "pnl_dashboard", "view")).toBe(false);
  });
  it("invalid or undefined source metadata never silently selects inheritance", () => {
    expect(() => normalizePermissionDecisionSnapshot(input({ sourceMode: undefined as any }))).toThrow("source mode");
    expect(() => normalizePermissionDecisionSnapshot(input({ sourceMode: "invalid" as any }))).toThrow("source mode");
  });
});

const source = ts.createSourceFile("server/storage.ts", readFileSync("server/storage.ts", "utf8"), ts.ScriptTarget.Latest, true);
const cls = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "DatabaseStorage") as ts.ClassDeclaration;
const names = ["getPermissionDecisionSnapshot", "getUserPermissions", "getUserPermissionsWithSources",
  "getInheritedPermissions", "getUserEffectivePermissions", "userHasPermission", "hasPermission",
  "setUserPermission", "deleteUserPermissions", "updateUserPermissionsWithAudit",
  "createUserPermissionOverride", "deleteUserPermissionOverride", "createUserAssignment"];
const methods = names.map(name => {
  const found = cls.members.filter(node => ts.isMethodDeclaration(node) && node.name.getText(source) === name);
  if (found.length !== 1) throw new Error(`Missing unique actual method ${name}`);
  return found[0].getText(source);
});
const compiled = ts.transpileModule(`class ActualStorage { ${methods.join("\n")} } globalThis.storage = new ActualStorage();`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true,
});
if (compiled.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw new Error("Storage transpile error");
const script = new Script(compiled.outputText);
function fixture(changes: Partial<PermissionDecisionInput> = {}, metadataMissing = false) {
  let data = input(changes);
  const state = { direct: structuredClone(data.direct), metadata: data.sourceMode, denies: structuredClone(data.overrides) };
  const tables = Object.fromEntries(["userPermissionSourceModes", "userPermissions", "userAssignments",
    "rolePermissions", "permissions", "roles", "userPermissionOverrides", "permissionAuditLogs"].map(name =>
    [name, new Proxy({ tableName: name }, { get: (target, key) => key in target ? target[key as keyof typeof target] : `${name}.${String(key)}` })]));
  const writes: string[] = [];
  let failAudit = false;
  const rows = (table: any) => {
    switch (table.tableName) {
      case "userPermissionSourceModes":
        if (metadataMissing) throw new Error("relation does not exist");
        return [{ sourceMode: state.metadata }];
      case "userPermissions": return state.direct;
      case "userAssignments": return data.roles;
      case "userPermissionOverrides": return state.denies;
      case "permissions": return [{ id: 1, module: "orders", action: "view" }];
      default: throw new Error(`Unexpected read ${table.tableName}`);
    }
  };
  const awaitable = (run: () => any) => ({
    returning: async () => run(),
    then: (resolve: (value: any) => void, reject: (error: any) => void) => Promise.resolve().then(run).then(resolve, reject),
  });
  const db: any = {
    execute: vi.fn(async () => ({ rows: [{ ready: true }] })),
    select: () => ({
      from: (table: any) => {
        const chain = { innerJoin: () => chain, where: async () => structuredClone(rows(table)) };
        return chain;
      },
    }),
    insert: (table: any) => ({
      values: (values: any) => {
        const run = () => {
          writes.push(`insert:${table.tableName}`);
          if (table.tableName === "permissionAuditLogs" && failAudit) throw new Error("audit failed");
          if (table.tableName === "userPermissions") state.direct.push(values);
          if (table.tableName === "userPermissionOverrides") state.denies.push(values);
          return [{ id: 7, ...values }];
        };
        return {
          ...awaitable(run),
          onConflictDoUpdate: async () => {
            if (metadataMissing) throw new Error("relation does not exist");
            writes.push("stamp:direct");
            state.metadata = values.sourceMode;
          },
        };
      },
    }),
    delete: (table: any) => ({
      where: () => awaitable(() => {
        writes.push(`delete:${table.tableName}`);
        if (table.tableName === "userPermissions") { const old = state.direct; state.direct = []; return old; }
        if (table.tableName === "userPermissionOverrides") { const old = state.denies; state.denies = []; return old; }
        throw new Error("Unexpected delete");
      }),
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: () => awaitable(() => {
          writes.push(`update:${table.tableName}`);
          if (table.tableName !== "userPermissions") throw new Error("Unexpected update");
          state.direct = state.direct.map(row => ({ ...row, ...values }));
          return state.direct;
        }),
      }),
    }),
    transaction: vi.fn(async (work: (tx: any) => any) => {
      const before = structuredClone(state);
      try { return await work(db); }
      catch (error) { Object.assign(state, before); throw error; }
    }),
  };
  const context = createContext({
    sql: (parts: any, ...values: any[]) => ({ parts, values }),
    ...tables, db, eq: (column: any, value: any) => ({ column, value }), and: (...args: any[]) => args,
    normalizePermissionDecisionSnapshot: (value: PermissionDecisionInput) => normalizePermissionDecisionSnapshot(value, now),
    checkPermissionDecision, evaluatePermissionDecision, isPermissionTupleCurrent,
  }, { codeGeneration: { strings: false, wasm: false } });
  script.runInContext(context);
  const storage = context.storage;
  storage.invalidatePermissionsCache = vi.fn();
  storage.getUserAssignments = async () => [];
  storage.getAllBranches = async () => [{ id: "A" }, { id: "B" }];
  storage.getRole = async () => null;
  return { storage, state, writes, db, failAudit: () => { failAudit = true; } };
}

describe("actual storage methods with strict offline doubles", () => {
  it("flat getUserPermissions and contextual checks both suppress future and expired global extras", async () => {
    const f = fixture({ sourceMode: "direct", direct: [], roles: [], overrides: [
      override({ allow: true, branchId: null, startDate: new Date(now + 1) }),
    ] });
    expect(await f.storage.getUserPermissions("u")).toEqual([]);
    expect(await f.storage.userHasPermission("u", "orders", "view", "A")).toBe(false);
    f.state.denies[0].startDate = new Date(now);
    expect(await f.storage.getUserPermissions("u")).toEqual([expect.objectContaining({ module: "orders", actions: ["view"] })]);
    f.state.denies[0].expiresAt = new Date(now);
    expect(await f.storage.getUserPermissions("u")).toEqual([]);
  });
  it("snapshot reads coherent request-fresh tuples and explicit metadata", async () => {
    const f = fixture({ overrides: [override()] });
    const first = await f.storage.getPermissionDecisionSnapshot("u");
    expect(first.tuples).toHaveLength(2);
    expect(first.tuples[0]).toMatchObject({ scopeType: "branch", branchId: "A", startDate: new Date(now) });
    f.state.denies = [];
    expect((await f.storage.getPermissionDecisionSnapshot("u")).tuples).toHaveLength(1);
    expect(f.db.transaction).toHaveBeenCalledTimes(2);
    expect(f.db.transaction.mock.calls[0][1]).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  });
  it("missing migration fails explicitly without direct/inherited fallback", async () => {
    const f = fixture({ direct: [{ module: "orders", actions: ["view"] }] }, true);
    await expect(f.storage.getUserPermissions("u")).rejects.toThrow("manual migration 050");
    await expect(f.storage.userHasPermission("u", "orders", "view", "A")).rejects.toThrow("manual migration 050");
  });
  it("all contextual projections agree without crossing action and branch sets", async () => {
    const f = fixture({ roles: [role(), role({ action: "edit", branchId: "B" })] });
    for (const branchId of ["A", "B"]) {
      const context = { branchId };
      const flat = await f.storage.getUserPermissions("u", { context });
      const sourced = await f.storage.getUserPermissionsWithSources("u", context);
      const inherited = await f.storage.getInheritedPermissions("u", context);
      const effective = await f.storage.getUserEffectivePermissions("u", context);
      for (const action of ["view", "edit"]) {
        const allowed = await f.storage.userHasPermission("u", "orders", action, branchId);
        expect(flat.some((p: any) => p.module === "orders" && p.actions.includes(action))).toBe(allowed);
        expect(sourced.some((p: any) => p.module === "orders" && p.action === action && p.isActive)).toBe(allowed);
        expect(inherited.some((p: any) => p.module === "orders" && p.action === action)).toBe(allowed);
        expect(effective.permissions.some((p: any) => p.action === action && p.allowed)).toBe(allowed);
      }
    }
    expect(await f.storage.getUserPermissions("u")).toEqual([]);
  });
  it("empty intentional replacement stamps direct atomically and retains all independent denies", async () => {
    const f = fixture({ direct: [{ module: "orders", actions: ["view"] }], overrides: [override()] });
    expect(await f.storage.updateUserPermissionsWithAudit("u", [], "admin", null)).toEqual([]);
    expect(f.state.metadata).toBe("direct");
    expect(f.state.denies).toHaveLength(1);
    expect(f.writes).not.toContain("delete:userPermissionOverrides");
    expect(f.writes).toContain("insert:permissionAuditLogs");
    expect(await f.storage.userHasPermission("u", "orders", "view", "A")).toBe(false);
  });
  it("failed audited replacement rolls back mode and direct rows", async () => {
    const f = fixture({ direct: [{ module: "orders", actions: ["view"] }] });
    f.failAudit();
    await expect(f.storage.updateUserPermissionsWithAudit("u", [], "admin", null)).rejects.toThrow("audit failed");
    expect(f.state.metadata).toBeNull();
    expect(f.state.direct).toEqual([{ module: "orders", actions: ["view"] }]);
  });
  it("missing metadata during intentional deletion cannot delete direct rows", async () => {
    const f = fixture({ direct: [{ module: "orders", actions: ["view"] }] }, true);
    await expect(f.storage.deleteUserPermissions("u")).rejects.toThrow("relation does not exist");
    expect(f.state.direct).toHaveLength(1);
    expect(f.writes).not.toContain("delete:userPermissions");
  });
  it("individual direct writes, overrides and assignments invalidate permissions", async () => {
    const f = fixture();
    await f.storage.setUserPermission({ userId: "u", module: "cash", actions: [] });
    expect(f.state.metadata).toBe("direct");
    await f.storage.createUserPermissionOverride({ userId: "u", ...override({ allow: true }) });
    await f.storage.createUserAssignment({ userId: "u", roleId: 4 });
    expect(f.storage.invalidatePermissionsCache).toHaveBeenCalledWith("u");
    expect(f.storage.invalidatePermissionsCache.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
  it("alias projections agree for directional grants and scoped alias denies", async () => {
    const f = fixture({
      roles: [role({ module: "attendance" })],
      overrides: [override({ module: "attendance_check", branchId: "B" })],
    });
    const flat = await f.storage.getUserPermissions("u", { context: { branchId: "A" } });
    const sourced = await f.storage.getUserPermissionsWithSources("u", { branchId: "A" });
    const inherited = await f.storage.getInheritedPermissions("u", { branchId: "A" });
    expect(flat.map((p: any) => p.module)).toContain("attendance_check");
    expect(sourced.some((p: any) => p.module === "attendance_check" && p.isActive)).toBe(true);
    expect(inherited.some((p: any) => p.module === "attendance_check")).toBe(true);
    expect(await f.storage.userHasPermission("u", "attendance_check", "view", "B")).toBe(false);
  });
  it("successful empty deletion cannot revive assigned roles", async () => {
    const f = fixture();
    await f.storage.deleteUserPermissions("u");
    expect(f.state.metadata).toBe("direct");
    expect(await f.storage.userHasPermission("u", "orders", "view", "A")).toBe(false);
    expect(await f.storage.getInheritedPermissions("u", { branchId: "A" })).toEqual([]);
  });
});