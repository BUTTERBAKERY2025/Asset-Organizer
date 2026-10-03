import { describe, expect, it } from "vitest";
import { resolvePayrollMembership as resolve, type PayrollTransfer } from "../server/payroll-historical-membership";
import { computeSalaryClosing } from "../server/salary-closing-calc";
import { readFileSync } from "node:fs";

const transfer = (date: string, source = "old", destination = "new", status = "completed"): PayrollTransfer =>
  ({ employeeId: 1, sourceBranchId: source, destinationBranchId: destination, effectiveDate: date, status });

describe("historical payroll branch membership", () => {
  it("keeps September in the old branch after an October transfer", () => {
    expect(resolve("new", [transfer("2026-10-01")], "2026-09")).toEqual({ branchId: "old" });
    expect(resolve("new", [transfer("2026-10-01")], "2026-10")).toEqual({ branchId: "new" });
  });
  it("reverses multiple later transfers without duplicating monthly ownership", () => {
    const history = [transfer("2026-10-01"), transfer("2026-11-02", "new", "third")];
    expect(resolve("third", history, "2026-09").branchId).toBe("old");
    expect(resolve("third", history, "2026-10").branchId).toBe("new");
  });
  it("blocks mid-month and last-day moves instead of inventing a split", () => {
    for (const date of ["2026-09-15", "2026-09-30"]) {
      expect(resolve("new", [transfer(date)], "2026-09").branchId).toBeNull();
    }
  });
  it("ignores unexecuted requests", () => {
    for (const status of ["pending", "hr_approved", "rejected", "cancelled"]) {
      expect(resolve("old", [transfer("2026-10-01", "old", "new", status)], "2026-09").branchId).toBe("old");
    }
  });
  it("fails closed on invalid dates, broken chains, same-day ambiguity and unrecorded moves", () => {
    for (const rows of [
      [transfer("2026-02-30")], [transfer("invalid")],
      [transfer("2026-10-01"), transfer("2026-11-01", "other", "new")],
      [transfer("2026-10-01"), transfer("2026-10-01", "new", "new")],
      [transfer("2026-10-01", "old", "third")],
    ]) expect(resolve("new", rows, "2026-09").branchId).toBeNull();
  });
  it("supports leap-month boundaries and unchanged branches", () => {
    expect(resolve("new", [transfer("2024-03-01")], "2024-02").branchId).toBe("old");
    expect(resolve("old", [], "2026-09").branchId).toBe("old");
  });
  it("propagates unresolved membership even when no salary lines exist", () => {
    const warning = { code: "historical_membership" as const, branchEmployeeId: null, employeeName: "review", message: "review" };
    const result = computeSalaryClosing({
      branchId: "old", month: "2026-09", employees: [], attendance: [], schedules: [],
      signedTimesheets: [], deductions: [], membershipWarnings: [warning],
    });
    expect(result.warnings).toContainEqual(warning);
    expect(result.lines).toEqual([]);
  });
  it("reproduces the pre-transfer salary with historical ownership, including deductions and attendance", () => {
    const employee = { id: 1, branchId: "old", employeeName: "Test", status: "active", salary: 3000, housingAllowance: 500 };
    const raw = {
      branchId: "old", month: "2026-09", employees: [employee],
      attendance: [{ branchId: "old", branchEmployeeId: 1, attendanceDate: "2026-09-01", status: "present", totalHours: 8 }],
      schedules: [{ branchId: "old", branchEmployeeId: 1, scheduleDate: "2026-09-01", isOff: false }],
      signedTimesheets: [], deductions: [{ branchEmployeeId: 1, amount: 100, type: "advance" }],
    };
    const before = computeSalaryClosing(raw);
    expect(before.lines).toHaveLength(1);
    const ownership = resolve("new", [transfer("2026-10-01")], raw.month);
    const after = computeSalaryClosing({ ...raw, employees: [{ ...employee, branchId: ownership.branchId }] });
    expect(after.lines).toEqual(before.lines);
    expect(after.totals).toEqual(before.totals);
    expect(computeSalaryClosing({ ...raw, employees: [{ ...employee, branchId: "new" }] }).lines).toEqual([]);
  });
  it("preserves snapshot-first reading and blocks close before persistence", () => {
    const routes = readFileSync("server/routes.ts", "utf8");
    const preview = routes.slice(routes.indexOf("const buildBranchPreview"), routes.indexOf("// Operations may inspect"));
    expect(preview.indexOf('existing.status === "closed"')).toBeLessThan(preview.indexOf("fetchSalaryClosingRaw"));
    const close = routes.slice(routes.indexOf('app.post("/api/salary-closing/close"'), routes.indexOf('app.post("/api/salary-closing/:id/reopen"'));
    expect(close.indexOf("PAYROLL_MEMBERSHIP_REVIEW_REQUIRED")).toBeLessThan(close.indexOf("const closurePayload"));
    const page = readFileSync("client/src/pages/salary-closing.tsx", "utf8");
    expect(page).toContain('data-testid="payroll-membership-review"');
    expect(page).toContain('data.warnings?.some((w: any) => w.code === "historical_membership")');
  });
});