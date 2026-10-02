import { describe, it, expect } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const source = readFileSync("server/hr-routes.ts", "utf8");
const ast = ts.createSourceFile("hr-routes.ts", source, ts.ScriptTarget.Latest, true);
function load(name: string, dependencies: Record<string, unknown>) {
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  if (!fn) throw new Error(`Missing ${name}`);
  const js = transformSync(fn.getText(ast), { loader: "ts", format: "cjs" }).code;
  return Function(...Object.keys(dependencies), `${js}; return ${name}`)(...Object.values(dependencies));
}
function fixture(branchId: string | null = "branch-b") {
  const predicates: unknown[] = [];
  const query: any = {
    from: () => query, innerJoin: () => query,
    where: (predicate: unknown) => { predicates.push(predicate); return query; },
    limit: async () => branchId === null ? [] : [{ branchId }],
  };
  return {
    predicates,
    deps: {
      db: { select: () => query },
      eq: (field: string, id: unknown) => ({ field, id }),
      employeeDocuments: { id: "document.id", branchEmployeeId: "document.employeeId" },
      branchEmployees: { id: "employee.id", branchId: "employee.branchId" },
    },
  };
}

describe("HR document trusted permission context", () => {
  it("takes an existing document's branch from the joined employee, not body/query", async () => {
    const f = fixture();
    const resolver = load("hrDocumentResourceContext", f.deps);
    expect(await resolver({ params: { id: "17" }, body: { branchId: "branch-a" }, query: { branchId: "branch-a" } }))
      .toEqual({ kind: "resource", branchId: "branch-b" });
    expect(f.predicates).toEqual([{ field: "document.id", id: 17 }]);
  });
  it("resolves creation against the selected employee's stored branch", async () => {
    const f = fixture();
    expect(await load("hrDocumentCreateContext", f.deps)({ body: { branchEmployeeId: 9, branchId: "branch-a" } }))
      .toEqual({ kind: "resource", branchId: "branch-b" });
    expect(f.predicates).toEqual([{ field: "employee.id", id: 9 }]);
  });
  it("missing documents never borrow a caller-claimed branch", async () => {
    const f = fixture(null);
    expect(await load("hrDocumentResourceContext", f.deps)({ params: { id: "17" }, query: { branchId: "branch-a" } }))
      .toEqual({ kind: "resource", branchId: "__unresolved_hr_document__" });
  });
  it("does not let cross-branch HR read elevation erase a scoped permission filter", () => {
    const narrowed = { branchIds: ["branch-a"], hasAccess: true };
    const getScope = load("getBranchScope", {
      getEffectiveBranchFilter: () => narrowed,
      hasPermissionScopeConstraint: () => true,
      hasCrossBranchHrAccess: () => true,
      resolveHrBranchScope: () => { throw new Error("must not widen"); },
    });
    expect(getScope({ method: "GET" })).toBe(narrowed);
  });
  it("opts all document list/create/edit/delete guards into trusted contexts", () => {
    for (const [method, action, context, route] of [
      ["get", "view", "hrDocumentCollectionContext", "/api/hr/documents"],
      ["post", "create", "hrDocumentCreateContext", "/api/hr/documents"],
      ["patch", "edit", "hrDocumentResourceContext", "/api/hr/documents/:id"],
      ["delete", "delete", "hrDocumentResourceContext", "/api/hr/documents/:id"],
    ]) expect(source).toContain(`app.${method}("${route}", isAuthenticated, requirePermission("hr_documents", "${action}", ${context})`);
  });
});