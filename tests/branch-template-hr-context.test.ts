import { describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ attendance: vi.fn(), employee: vi.fn(), linked: vi.fn(), records: vi.fn() }));
vi.mock("../server/storage", () => ({ storage: {
  getAttendanceRecord: mocks.attendance, getBranchEmployee: mocks.employee,
  getBranchEmployeeByLinkedUserId: mocks.linked,
  getEmployeeAttendanceAcrossBranches: mocks.records,
} }));
import { branchTemplateHrContext, monthlyAttendanceWithinBranches } from "../server/branch-template-hr-context";

describe("HR branch template request contexts", () => {
  it("uses persisted owners instead of forged branch input", async () => {
    mocks.attendance.mockResolvedValue({ branchId: "b" });
    mocks.employee.mockResolvedValue({ branchId: "b" });
    for (const [module, path] of [
      ["attendance", "/api/attendance/12"],
      ["attendance", "/api/attendance/12/approve"],
      ["branch_employees", "/api/branch-employees/12"],
    ]) expect(await branchTemplateHrContext({
      method: "PATCH", path, body: { branchId: "a" }, query: { branchId: "a" },
    }, module, ["a", "b"])).toEqual({ kind: "resource", branchId: "b" });
  });
  it("fails closed on missing resources", async () => {
    mocks.attendance.mockResolvedValue(undefined);
    expect(await branchTemplateHrContext({ method: "GET", path: "/api/attendance/12" },
      "attendance", ["a"])).toBeNull();
  });
  it("preserves the candidate branch universe for reviewed collections", async () => {
    for (const [module, path] of [
      ["branch_employees", "/api/branch-employees/bundle"],
      ["attendance", "/api/attendance"],
      ["attendance_check", "/api/attendance-check/bundle"],
    ]) expect(await branchTemplateHrContext({ method: "GET", path, query: { branchId: "foreign" } },
      module, ["a", "b"])).toEqual({ kind: "collection", branchIds: ["a", "b"] });
  });
  it("does not implicitly authorize debug routes", async () => {
    expect(await branchTemplateHrContext({ method: "GET", path: "/api/attendance-debug" },
      "branch_employees", ["a"])).toBeUndefined();
  });
  it("requires authority over every contributing branch for a monthly aggregate", async () => {
    mocks.records.mockResolvedValue([{ branchId: "b" }, { branchId: "a" }]);
    expect(await monthlyAttendanceWithinBranches("employee", "2026-10", "b", ["b"])).toBe(false);
    expect(await monthlyAttendanceWithinBranches("employee", "2026-10", "b", ["a", "b"])).toBe(true);
    mocks.records.mockResolvedValue([{ branchId: "b" }]);
    expect(await monthlyAttendanceWithinBranches("employee", "2026-10", "b", ["b"])).toBe(true);
    expect(await monthlyAttendanceWithinBranches("employee", "invalid", "b", ["b"])).toBe(false);
  });
});