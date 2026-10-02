import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { transformSync } from "esbuild";

const text = readFileSync("server/employee-account-delegation.ts", "utf8");
const ast = ts.createSourceFile("delegation.ts", text, ts.ScriptTarget.Latest, true);
const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "replacePermissions")!;
const js = transformSync(node.getText(ast), { loader: "ts", format: "cjs" }).code;
const mode = { userId: "mode.user" };
const permissions = { userId: "permissions.user" };
const replace = Function("userPermissionSourceModes", "userPermissions", "eq",
  `${js}; return replacePermissions`)(mode, permissions, (field: string, id: string) => ({ field, id }));

describe("delegated direct source-mode persistence", () => {
  it.each([
    { selected: [] },
    { selected: [{ module: "cashier_journal", actions: ["view"] }] },
  ])("stamps mode atomically with selected grants $selected", async ({ selected }) => {
    const events: any[] = [];
    const tx = {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          events.push({ table, values });
          return { onConflictDoUpdate: async (conflict: unknown) => events.push({ conflict }) };
        },
      }),
      delete: (table: unknown) => ({ where: async (where: unknown) => events.push({ deleted: table, where }) }),
    };
    await replace(tx, "employee-a", selected);
    expect(events[0]).toEqual({ table: mode, values: { userId: "employee-a", sourceMode: "direct" } });
    expect(events[1].conflict).toMatchObject({ target: mode.userId, set: { sourceMode: "direct" } });
    expect(events[2]).toEqual({ deleted: permissions, where: { field: "permissions.user", id: "employee-a" } });
    expect(events.filter(event => event.table === permissions)).toHaveLength(selected.length ? 1 : 0);
  });
});