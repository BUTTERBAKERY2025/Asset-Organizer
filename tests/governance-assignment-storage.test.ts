import { readFileSync } from "node:fs";
import { createContext, Script } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Run only the actual storage mutation methods extracted from the AST.
// Never import storage/db/server bootstrap or connect to a database.
const source = ts.createSourceFile("server/storage.ts", readFileSync("server/storage.ts", "utf8"),
  ts.ScriptTarget.Latest, true);
const storageClass = source.statements.find(node =>
  ts.isClassDeclaration(node) && node.name?.text === "DatabaseStorage") as ts.ClassDeclaration | undefined;
if (!storageClass) throw new Error("Missing actual DatabaseStorage class");
const methodNames = ["updateUserAssignment", "deleteUserAssignment"];
const methods = methodNames.map(name => {
  const matches = storageClass.members.filter(node =>
    ts.isMethodDeclaration(node) && node.name.getText(source) === name);
  if (matches.length !== 1) throw new Error(`Missing unique actual storage method: ${name}`);
  return matches[0].getText(source);
});
const compiled = ts.transpileModule(`class ExtractedStorage {
  ${methods.join("\n")}
}
globalThis.extracted = new ExtractedStorage();`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  reportDiagnostics: true,
});
if (compiled.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) {
  throw new Error("Actual assignment storage methods did not transpile");
}
const script = new Script(compiled.outputText);

type Row = { id: number; userId: string; roleId: number; [key: string]: unknown };
type Predicate = { column: "id" | "userId"; value: unknown };
function forbidden(name: string): never {
  throw new Error(`Unexpected isolated storage dependency: ${name}`);
}
function strict<T extends object>(name: string, object: T): T {
  return new Proxy(object, {
    get(target, property, receiver) {
      if (!(property in target)) return forbidden(`${name}.${String(property)}`);
      return Reflect.get(target, property, receiver);
    },
  });
}

function fixture(owner = "other", beforeWrite?: (rows: Map<number, Row>) => void) {
  const rows = new Map<number, Row>([
    [41, { id: 41, userId: owner, roleId: 5, isActive: true }],
    [42, { id: 42, userId: "other", roleId: 6, isActive: true }],
  ]);
  const table = strict("userAssignments", { id: "id", userId: "userId" });
  const calls: { operation: string; predicates: Predicate[]; changes?: Record<string, unknown> }[] = [];
  let writes = 0;
  const eq = (column: Predicate["column"], value: unknown): Predicate => {
    expect(["id", "userId"]).toContain(column);
    return { column, value };
  };
  const and = (...predicates: Predicate[]) => predicates;
  const where = (operation: string, changes?: Record<string, unknown>) => (predicates: Predicate[]) => {
    // The double accepts only an atomic compound predicate, not an ID-only write
    // or an owner pre-read. The race fires immediately before predicate evaluation.
    expect(Array.isArray(predicates)).toBe(true);
    expect(predicates.map(p => p.column).sort()).toEqual(["id", "userId"]);
    calls.push({ operation, predicates, changes });
    return strict("returning builder", {
      returning: async () => {
        beforeWrite?.(rows);
        const matched = [...rows.values()].filter(row =>
          predicates.every(predicate => row[predicate.column] === predicate.value));
        for (const row of matched) {
          writes++;
          if (operation === "update") rows.set(row.id, { ...row, ...changes });
          else rows.delete(row.id);
        }
        return matched.map(row => operation === "update" ? rows.get(row.id)! : { ...row });
      },
    });
  };
  const db = strict("db", {
    update: vi.fn((actualTable: unknown) => {
      expect(actualTable).toBe(table);
      return strict("update builder", {
        set: (changes: Record<string, unknown>) => strict("update where builder", {
          where: where("update", changes),
        }),
      });
    }),
    delete: vi.fn((actualTable: unknown) => {
      expect(actualTable).toBe(table);
      return strict("delete builder", { where: where("delete") });
    }),
  });
  const blocked = strict("blocked I/O", {});
  const context = createContext({
    db, userAssignments: table, eq, and,
    process: blocked, pool: blocked,
    fetch: () => forbidden("fetch"), require: () => forbidden("require"),
    setTimeout: () => forbidden("setTimeout"), setInterval: () => forbidden("setInterval"),
    console: blocked,
  }, { codeGeneration: { strings: false, wasm: false } });
  script.runInContext(context, { timeout: 1000 });
  const storage = context.extracted as {
    updateUserAssignment(id: number, userId: string, changes: Record<string, unknown>): Promise<Row | undefined>;
    deleteUserAssignment(id: number, userId: string): Promise<boolean>;
    invalidatePermissionsCache: ReturnType<typeof vi.fn>;
  };
  storage.invalidatePermissionsCache = vi.fn();
  const mutate = (operation: string, id = 41, userId = "other") => operation === "update"
    ? storage.updateUserAssignment(id, userId, { roleId: 9 })
    : storage.deleteUserAssignment(id, userId);
  return { rows, calls, db, storage, mutate, get writes() { return writes; } };
}

describe("isolated actual RBAC assignment storage mutations", () => {
  for (const operation of ["update", "delete"]) {
    it(`${operation}: matched owner mutates exactly one ID and invalidates its cache`, async () => {
      const f = fixture();
      const untouched = structuredClone(f.rows.get(42));
      const result = await f.mutate(operation);
      expect(result).toEqual(operation === "update" ? f.rows.get(41) : true);
      expect(f.writes).toBe(1);
      expect(f.calls).toHaveLength(1);
      expect(f.calls[0].predicates).toEqual([
        { column: "id", value: 41 }, { column: "userId", value: "other" },
      ]);
      if (operation === "update") {
        expect(f.rows.get(41)?.roleId).toBe(9);
        expect(Object.prototype.toString.call(f.rows.get(41)?.updatedAt)).toBe("[object Date]");
        expect(Number.isFinite((f.rows.get(41)?.updatedAt as Date).getTime())).toBe(true);
      } else expect(f.rows.has(41)).toBe(false);
      expect(f.rows.get(42)).toEqual(untouched);
      expect(f.storage.invalidatePermissionsCache).toHaveBeenCalledExactlyOnceWith("other");
    });

    it.each(["editor", "third"])(`${operation}: mismatched owner %s cannot write or invalidate cache`, async owner => {
      const f = fixture(owner);
      const before = structuredClone(f.rows);
      expect(await f.mutate(operation)).toBe(operation === "update" ? undefined : false);
      expect(f.rows).toEqual(before);
      expect(f.writes).toBe(0);
      expect(f.storage.invalidatePermissionsCache).not.toHaveBeenCalled();
    });

    it(`${operation}: absent ID does not mutate another assignment with matching owner`, async () => {
      const f = fixture();
      const before = structuredClone(f.rows);
      expect(await f.mutate(operation, 999)).toBe(operation === "update" ? undefined : false);
      expect(f.rows).toEqual(before);
      expect(f.writes).toBe(0);
      expect(f.storage.invalidatePermissionsCache).not.toHaveBeenCalled();
    });

    it(`${operation}: concurrent owner change before mutation is evaluated atomically`, async () => {
      const f = fixture("other", rows => {
        rows.set(41, { ...rows.get(41)!, userId: "third" });
      });
      expect(await f.mutate(operation)).toBe(operation === "update" ? undefined : false);
      expect(f.rows.get(41)).toEqual({ id: 41, userId: "third", roleId: 5, isActive: true });
      expect(f.rows.get(42)?.roleId).toBe(6);
      expect(f.writes).toBe(0);
      expect(f.storage.invalidatePermissionsCache).not.toHaveBeenCalled();
    });

    it(`${operation}: concurrent deletion before mutation yields no success or cache invalidation`, async () => {
      const f = fixture("other", rows => { rows.delete(41); });
      expect(await f.mutate(operation)).toBe(operation === "update" ? undefined : false);
      expect(f.rows.has(41)).toBe(false);
      expect(f.writes).toBe(0);
      expect(f.storage.invalidatePermissionsCache).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, NaN, Infinity, 2147483648, Number.MAX_SAFE_INTEGER])(
      `${operation}: invalid ID %s fails before querying`, async id => {
        const f = fixture();
        await expect(f.mutate(operation, id)).rejects.toThrow("Invalid assignment identity");
        expect(f.db.update).not.toHaveBeenCalled();
        expect(f.db.delete).not.toHaveBeenCalled();
        expect(f.storage.invalidatePermissionsCache).not.toHaveBeenCalled();
      },
    );

    it.each(["", " ", " other ", undefined as unknown as string])(
      `${operation}: invalid expected owner %j fails before querying`, async userId => {
        const f = fixture();
        // Call directly because mutate's default owner intentionally replaces undefined.
        const result = operation === "update"
          ? f.storage.updateUserAssignment(41, userId, { roleId: 9 })
          : f.storage.deleteUserAssignment(41, userId);
        await expect(result).rejects.toThrow("Invalid assignment identity");
        expect(f.db.update).not.toHaveBeenCalled();
        expect(f.db.delete).not.toHaveBeenCalled();
      },
    );
  }

  it.each([
    { userId: "editor", roleId: 9 }, { userId: "other", roleId: 9 },
    { id: 42, roleId: 9 }, { createdAt: new Date(), roleId: 9 },
    { updatedAt: new Date(), roleId: 9 }, { unknown: true }, {}, [],
    null as unknown as Record<string, unknown>,
  ])("update: rejects identity and non-whitelisted fields %j without database access", async changes => {
    const f = fixture();
    const before = structuredClone(f.rows);
    await expect(f.storage.updateUserAssignment(41, "other", changes as Record<string, unknown>))
      .rejects.toThrow("Invalid assignment update fields");
    expect(f.rows).toEqual(before);
    expect(f.db.update).not.toHaveBeenCalled();
    expect(f.storage.invalidatePermissionsCache).not.toHaveBeenCalled();
  });

  it("update: whitelist excludes inherited owner/identity properties", async () => {
    const f = fixture();
    const changes = Object.assign(Object.create({ userId: "third", id: 42 }), { roleId: 9 });
    await f.storage.updateUserAssignment(41, "other", changes);
    expect(f.rows.get(41)?.userId).toBe("other");
    expect(f.rows.get(41)?.id).toBe(41);
    expect(f.rows.get(41)?.roleId).toBe(9);
    expect(Object.keys(f.calls[0].changes!).sort()).toEqual(["roleId", "updatedAt"]);
  });

  it("update: all mutable fields are preserved while identity remains fixed", async () => {
    const f = fixture();
    const changes = { roleId: 9, branchId: null, departmentId: null, scopeType: "global",
      isPrimary: false, isActive: false, startDate: new Date("2026-10-01"), endDate: null };
    await f.storage.updateUserAssignment(41, "other", changes);
    expect(f.rows.get(41)).toMatchObject({ ...changes, id: 41, userId: "other" });
    expect(f.storage.invalidatePermissionsCache).toHaveBeenCalledExactlyOnceWith("other");
  });
});