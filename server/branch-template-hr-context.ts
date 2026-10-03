import { storage } from "./storage";

/** Monthly summaries are whole-employee aggregates, not per-branch subtotals.
 * Never publish a partial recalculation into the shared monthly cache. */
export async function monthlyAttendanceWithinBranches(
  employeeId: string, month: string, ownerBranch: string, allowedBranches: string[] | null,
) {
  if (allowedBranches === null) return true;
  if (!allowedBranches.includes(ownerBranch) || !/^\d{4}-\d{2}$/.test(month)) return false;
  const records = await storage.getEmployeeAttendanceAcrossBranches(employeeId, `${month}-01`, `${month}-31`);
  return records.every(record => allowedBranches.includes(record.branchId));
}

/** Only routes whose handlers enforce the resulting branch constraint. */
export async function branchTemplateHrContext(req: any, module: string, branches: string[]) {
  const { path, method } = req;
  const lists: Record<string, string[]> = {
    branch_employees: ["/api/branch-employees", "/api/branch-employees/bundle", "/api/branch-employees/stats"],
    attendance: ["/api/attendance", "/api/attendance-summary", "/api/attendance/stats/today",
      "/api/attendance-dashboard-stats", "/api/employee-attendance-report"],
    attendance_check: ["/api/attendance-check/bundle", "/api/scheduled-employees-for-attendance"],
  };
  if (method === "GET" && lists[module]?.includes(path))
    return { kind: "collection" as const, branchIds: branches };
  if (module === "attendance_check" && method === "POST") {
    if (path === "/api/attendance/check-in-employee" && typeof req.body?.branchId === "string")
      return { kind: "resource" as const, branchId: req.body.branchId };
    // Checkout resolves today's/overnight attendance inside its handler, then
    // checks that persisted record's branch before changing it.
    if (path === "/api/attendance/check-out-employee")
      return { kind: "collection" as const, branchIds: branches };
  }
  if (module === "attendance") {
    if ((method === "GET" && /^\/api\/attendance-summary\/[^/]+\/\d{4}-\d{2}$/.test(path))
      || (method === "POST" && /^\/api\/attendance-summary\/calculate\/[^/]+\/\d{4}-\d{2}$/.test(path)))
      return { kind: "collection" as const, branchIds: branches };
    if (method === "POST" && path === "/api/attendance" && typeof req.body?.branchId === "string")
      return { kind: "resource" as const, branchId: req.body.branchId };
    const recordId = path.match(/^\/api\/attendance\/([1-9]\d*)(?:\/approve)?$/);
    if (recordId) {
      const record = await storage.getAttendanceRecord(Number(recordId[1]));
      return record?.branchId ? { kind: "resource" as const, branchId: record.branchId } : null;
    }
  }
  if (module === "branch_employees") {
    if (method === "POST" && path === "/api/branch-employees" && typeof req.body?.branchId === "string")
      return { kind: "resource" as const, branchId: req.body.branchId };
    const linked = path.match(/^\/api\/branch-employees\/by-user\/([^/]+)$/);
    if (linked) {
      const employee = await storage.getBranchEmployeeByLinkedUserId(req.params.userId);
      return employee?.branchId ? { kind: "resource" as const, branchId: employee.branchId } : null;
    }
  }
  const employee = path.match(/^\/api\/branch-employees\/([1-9]\d*)(?:\/(status-history|schedules|attendance|timesheets|link-user|unlink-user))?$/);
  if (employee && ((module === "branch_employees" && !["attendance", "timesheets"].includes(employee[2]))
    || (module === "attendance" && ["attendance", "timesheets"].includes(employee[2])))) {
    const record = await storage.getBranchEmployee(Number(employee[1]));
    // These histories can legitimately span several permitted branches.
    // Their handlers verify the employee then filter each historical row.
    if (record?.branchId && ["schedules", "attendance", "timesheets"].includes(employee[2]))
      return { kind: "collection" as const, branchIds: branches };
    return record?.branchId ? { kind: "resource" as const, branchId: record.branchId } : null;
  }
  return undefined;
}