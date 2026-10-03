import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { transpileModule, ScriptTarget, ModuleKind } from "typescript";
import { computeSalaryClosing } from "../server/salary-closing-calc";

// Execute the real close handler against memory-only inputs. No server/db import.
function fixture() {
  const source = readFileSync("server/routes.ts", "utf8");
  const closeSource = source.slice(source.indexOf('  app.post("/api/salary-closing/close"'),
    source.indexOf('  // إعادة فتح إغلاق (للمدير فقط)'));
  let handler: any;
  const raw = { branchId: "old", month: "2026-09", employees: [{
    id: 9, branchId: "old", status: "active", employeeName: "Synthetic", salary: 3000,
  }], attendance: [{ branchId: "old", branchEmployeeId: 9, attendanceDate: "2026-09-01", status: "present" }],
  schedules: [], signedTimesheets: [], deductions: [], membershipWarnings: [] as any[] };
  const storage = {
    getSalaryClosureByBranchAndMonth: vi.fn(async (): Promise<any> => undefined),
    createSalaryClosureWithLines: vi.fn(async (header: any, lines: any[]) => ({ id: 50, ...header, lines })),
    replaceSalaryClosureWithLines: vi.fn(async (id: number, header: any, lines: any[]) => ({ id, ...header, lines })),
  };
  const context = {
    app: { post: (_path: string, ...handlers: any[]) => { handler = handlers.at(-1); } },
    storage, computeSalaryClosing,
    fetchSalaryClosingRaw: vi.fn(async () => raw),
    isAuthenticated: () => {}, requirePermission: () => () => {},
    isValidMonth: (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s),
    canAccessBranch: vi.fn(async () => true),
    currentUserName: () => "Synthetic",
    auditEvent: vi.fn(async () => {}),
    payrollReadError: () => ({ error: "unavailable" }),
  };
  new Function(...Object.keys(context), transpileModule(closeSource, {
    compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.ESNext },
  }).outputText)(...Object.values(context));
  async function close() {
    const res = { statusCode: 200, body: null as any,
      status(n: number) { this.statusCode = n; return this; },
      json(data: any) { this.body = data; return this; },
    };
    await handler({ currentUser: { id: "synthetic" }, body: {
      branchId: "old", month: "2026-09", acknowledgeWarnings: true,
    } }, res);
    return res;
  }
  return { close, raw, storage, context };
}
describe("actual payroll close handler with historical ownership", () => {
  it("refuses unresolved membership even when warnings are acknowledged", async () => {
    const f = fixture();
    f.raw.membershipWarnings.push({ code: "historical_membership", message: "review" });
    const res = await f.close();
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("PAYROLL_MEMBERSHIP_REVIEW_REQUIRED");
    expect(f.storage.createSalaryClosureWithLines).not.toHaveBeenCalled();
    expect(f.storage.replaceSalaryClosureWithLines).not.toHaveBeenCalled();
  });
  it("saves historical branch and employee identity in a new snapshot", async () => {
    const f = fixture();
    const res = await f.close();
    expect(res.statusCode).toBe(201);
    expect(res.body.closure.branchId).toBe("old");
    expect(res.body.closure.lines[0].branchEmployeeId).toBe(9);
    expect(res.body.closure.totalNet).toBe(computeSalaryClosing(f.raw).totals.totalNet);
  });
  it("never recalculates or rewrites an already closed snapshot", async () => {
    const f = fixture();
    f.storage.getSalaryClosureByBranchAndMonth.mockResolvedValue({ id: 50, status: "closed" });
    expect((await f.close()).statusCode).toBe(409);
    expect(f.context.fetchSalaryClosingRaw).not.toHaveBeenCalled();
    expect(f.storage.createSalaryClosureWithLines).not.toHaveBeenCalled();
    expect(f.storage.replaceSalaryClosureWithLines).not.toHaveBeenCalled();
  });
  it("preserves the reopened closure identity and checks branch scope before reading", async () => {
    const f = fixture();
    f.context.canAccessBranch.mockResolvedValue(false);
    expect((await f.close()).statusCode).toBe(403);
    expect(f.context.fetchSalaryClosingRaw).not.toHaveBeenCalled();
    f.context.canAccessBranch.mockResolvedValue(true);
    f.storage.getSalaryClosureByBranchAndMonth.mockResolvedValue({ id: 77, status: "reopened" });
    expect((await f.close()).body.closure.id).toBe(77);
    expect(f.storage.createSalaryClosureWithLines).not.toHaveBeenCalled();
  });
});