import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = ts.createSourceFile("server/routes.ts", readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);

/** Run the real registered route body, not a duplicate ownership predicate. */
function handler(action: "submit" | "post", dependencies: Record<string, unknown>) {
  let arrow: ts.ArrowFunction | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.expression.getText(source) === "app" && node.expression.name.text === "post"
        && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === `/api/cashier-journals/:id/${action}`) {
      const candidate = node.arguments.at(-1);
      if (candidate && ts.isArrowFunction(candidate)) arrow = candidate;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!arrow) throw Error(`Missing ${action} handler`);
  const compiled = ts.transpileModule(`const handler = ${arrow.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${compiled}; return handler;`)(...Object.values(dependencies));
}

describe("delegated cashier create grants cannot finalize another cashier's journal", () => {
  async function invoke(action: "submit" | "post", options: { owner?: boolean; manager?: boolean; branch?: boolean; missing?: boolean } = {}) {
    const currentUser = { id: "delegated-cashier", role: options.manager ? "admin" : "employee" };
    const journal = { id: 12, branchId: "a", cashierId: options.owner ? currentUser.id : "other-cashier",
      cashierName: "صاحب اليومية", status: "draft", journalDate: "2026-01-01" };
    const storage = {
      getCashierJournal: vi.fn().mockResolvedValue(options.missing ? undefined : journal),
      createCashierSignature: vi.fn().mockResolvedValue({}),
      postCashierJournal: vi.fn().mockResolvedValue({ ...journal, status: "posted" }),
      submitCashierJournal: vi.fn().mockResolvedValue({ ...journal, status: "submitted" }),
      getCashierSignatures: vi.fn().mockResolvedValue([]),
      calculateJournalIncentives: vi.fn().mockResolvedValue({ totalPoints: 0 }),
    };
    const dependencies = {
      storage, isUserAdmin: () => options.manager === true,
      canAccessBranch: vi.fn().mockResolvedValue(options.branch !== false),
      canUserViewAllCashiers: vi.fn().mockResolvedValue(options.manager === true),
      getCurrentUser: () => currentUser, auditEvent: vi.fn().mockResolvedValue(undefined),
    };
    const req = { params: { id: "12" }, currentUser, body: { signatureData: "forged-signature", signerName: "forged-name" }, ip: "127.0.0.1" };
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; },
      json: vi.fn() };
    await handler(action, dependencies)(req, res);
    return { res, storage, dependencies };
  }
  it.each(["submit", "post"] as const)("denies %s on a same-branch journal owned by another cashier before any signature or write", async action => {
    const { res, storage, dependencies } = await invoke(action);
    expect(res.statusCode).toBe(403);
    expect(storage.createCashierSignature).not.toHaveBeenCalled();
    expect(storage.postCashierJournal).not.toHaveBeenCalled();
    expect(storage.submitCashierJournal).not.toHaveBeenCalled();
    expect(storage.calculateJournalIncentives).not.toHaveBeenCalled();
    expect(dependencies.auditEvent).not.toHaveBeenCalled();
  });
  it.each(["submit", "post"] as const)("allows the cashier's own %s", async action => {
    const { res, storage } = await invoke(action, { owner: true });
    expect(res.statusCode).toBe(200);
    expect(storage[action === "post" ? "postCashierJournal" : "submitCashierJournal"]).toHaveBeenCalledWith(12);
  });
  it("retains authorized manager posting and branch/missing-record guards", async () => {
    expect((await invoke("post", { manager: true })).res.statusCode).toBe(200);
    const denied = await invoke("post", { owner: true, branch: false });
    expect(denied.res.statusCode).toBe(403);
    expect(denied.storage.postCashierJournal).not.toHaveBeenCalled();
    expect((await invoke("post", { missing: true })).res.statusCode).toBe(404);
  });
});