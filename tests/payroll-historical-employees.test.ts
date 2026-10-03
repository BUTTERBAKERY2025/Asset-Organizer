import { beforeEach, describe, expect, it, vi } from "vitest";
const { select, responses } = vi.hoisted(() => ({ select: vi.fn(), responses: [] as any[] }));
vi.mock("../server/db", () => ({ db: { select } }));
import { loadHistoricalPayrollEmployees } from "../server/payroll-historical-employees";
const employee = { id: 9, branchId: "new", employeeName: "Test", employeeNumber: "9", salary: 3000, linkedUserId: "user" };
const transfer = { employeeId: 9, sourceBranchId: "old", destinationBranchId: "new", effectiveDate: "2026-10-01", status: "completed" };
beforeEach(() => {
  responses.length = 0;
  select.mockReset().mockImplementation(() => ({ from: () => ({ where: async () => responses.shift() }) }));
});
describe("historical payroll employee inputs (mock database, no writes)", () => {
  it("restores old branch identity without mutating current employee or salary", async () => {
    responses.push([employee], [transfer]);
    const result = await loadHistoricalPayrollEmployees("old", "2026-09", []);
    expect(result.employees[0]).toEqual({ ...employee, branchId: "old" });
    expect(result.warnings).toEqual([]);
    expect(employee.branchId).toBe("new");
  });
  it("does not include an incoming employee in the new branch's prior month", async () => {
    responses.push([employee], [transfer]);
    expect((await loadHistoricalPayrollEmployees("new", "2026-09", [])).employees).toEqual([]);
  });
  it("rejects missing transfer history backed by canonical, legacy, linked or import evidence", async () => {
    for (const row of [{ branchEmployeeId: 9 }, { employeeId: "branch_emp_9" },
      { employeeId: "user" }, { employeeNumber: "9" }, { employeeName: "Test" },
      { report: { branchEmployeeId: 9 } }]) {
      responses.push([employee], []);
      const result = await loadHistoricalPayrollEmployees("old", "2026-09", [row]);
      expect(result.employees).toEqual([]);
      expect(result.warnings[0].code).toBe("historical_membership");
      expect(JSON.stringify(result.warnings)).not.toContain('"Test"');
      expect(JSON.stringify(result.warnings)).not.toContain("3000");
    }
  });
  it("does not manufacture a salary split in either branch", async () => {
    for (const branch of ["old", "new"]) {
      responses.push([employee], [{ ...transfer, effectiveDate: "2026-09-15" }]);
      const result = await loadHistoricalPayrollEmployees(branch, "2026-09", []);
      expect(result.employees).toEqual([]);
      expect(result.warnings).toHaveLength(1);
    }
  });
  it("reports missing canonical employees instead of silently dropping their work", async () => {
    responses.push([]);
    const result = await loadHistoricalPayrollEmployees("old", "2026-09", [{ branchEmployeeId: 9 }]);
    expect(result.warnings).toHaveLength(1);
  });
});