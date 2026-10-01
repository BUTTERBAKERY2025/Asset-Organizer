import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { peopleSourceHref, peopleToolHref } from "../client/src/components/operations-center/people-workspace-model";
import {
  operationsPeopleSources, parseOperationsPeopleQuery, peopleJoiningHref, peoplePagePlan,
} from "../shared/operations-people";
import {
  operationsPeopleSql, peopleAdvanceAuthority, peopleBranchAllowed, peopleLeaveReviewer, peopleSourceEnabled, peopleTools,
  type PeopleActor, type PeopleGrants,
} from "../server/operations-people-predicates";

const query = vi.hoisted(() => vi.fn());
const reviewer = vi.hoisted(() => vi.fn(async () => "مدير التشغيل"));
vi.mock("../server/db", () => ({ pool: { query }, db: {} }));
vi.mock("../server/auth", () => ({
  getAllowedBranchIds: (req: any) => req.allowed,
  HR_SPECIALIST_PERMISSIONS: { hr_advances: ["view", "edit"] },
}));
vi.mock("../server/branch-operations", () => ({
  hasAuthoritativePermission: async (req: any, module: string, action: string) => req.grants?.includes(`${module}:${action}`) === true,
}));
// Keep the real source reviewer matcher while isolating its database lookup.
vi.mock("../server/leave-helpers", async importOriginal => ({
  ...await importOriginal<typeof import("../server/leave-helpers")>(),
  resolveReviewerJobTitle: reviewer,
}));
import { peopleGrants, projectOperationsPeople, projectPeopleRecord } from "../server/operations-people";

const actor: PeopleActor = { id: "operator", role: "operations_manager", allowed: ["a", "b"], reviewerTitle: "مدير التشغيل" };
const grants: PeopleGrants = {
  leavesView: true, leavesApprove: true, leavesCreate: true,
  advancesView: true, advancesApprove: true, advancesEdit: true,
  attendanceView: true, attendanceEdit: true, operationsHr: true,
  joiningView: true, joiningApprove: true, transfersView: true, payrollView: true, specialistEditConfigured: true,
};
const permissions = ["hr_leaves", "hr_advances", "attendance", "operations_hr", "operations_joining", "operations_employee_transfer", "operations_payroll"]
  .flatMap(module => ["view", "create", "edit", "approve"].map(action => `${module}:${action}`));
const req = (extra: Record<string, unknown> = {}) => ({
  currentUser: { id: actor.id, role: actor.role }, allowed: actor.allowed, grants: permissions, ...extra,
}) as any;
const row = { id: 41, branch_id: "a", status: "pending", employee_id: 5, employee_name: "اسم الموظف",
  employee_number: "EMP-5", job_title: "كاشير" };
const setup = (counts: Partial<Record<(typeof operationsPeopleSources)[number], number>> = {}) => {
  query.mockImplementation(async (text: string, values: unknown[]) => {
    if (text.startsWith("SELECT id,name FROM branches")) return { rows: (values[0] as string[]).map(id => ({ id, name: id })) };
    if (text.includes("FROM branch_employees WHERE")) return { rows: [{ total: "9", active: "7" }] };
    if (text.startsWith("SELECT count")) {
      const source = text.includes("onboarding_notifications") ? "joining" : text.includes("advance_requests") ? "advances"
        : text.includes("attendance_records") ? "attendance" : text.includes("status='approved'") ? "leave_movements" : "leaves";
      return { rows: [{ total: String(counts[source] ?? 0) }] };
    }
    return { rows: text.includes("onboarding_notifications") ? [{ ...row, status: "signed", offer_id: 73 }] : [{ ...row }] };
  });
};

describe("people explicit scope and independent full pagination", () => {
  beforeEach(() => { query.mockReset(); reviewer.mockClear(); });
  it.each([{}, { branchIds: "all" }, { branchIds: "a,a" }, { branchIds: ["a"] }, { branchIds: "a," },
    { branchIds: "a", source: "employees" }, { branchIds: "a", source: ["leaves"] }, { branchIds: "a", offset: "-1" },
    { branchIds: "a", offset: "1.2" }, { branchIds: "a", offset: ["1"] }, { branchIds: "a", limit: "101" },
    { branchIds: "a", limit: "0" }, { branchIds: "a", offset: String(Number.MAX_SAFE_INTEGER + 1) }])("rejects malformed query %j", input => {
    expect(() => parseOperationsPeopleQuery(input)).toThrow();
  });
  it("allows older pages past the overview's fixed 100 and offset 10000", () => {
    expect(parseOperationsPeopleQuery({ branchIds: "a,b", offset: "25001" }).offset).toBe(25001);
    expect(peoplePagePlan([{ source: "leaves", count: 180 }, { source: "advances", count: 240 }], 175, 20))
      .toEqual([{ source: "leaves", offset: 175, limit: 5 }, { source: "advances", offset: 0, limit: 15 }]);
    expect(peoplePagePlan([{ source: "attendance", count: 50000 }], 25001, 50))
      .toEqual([{ source: "attendance", offset: 25001, limit: 50 }]);
  });
  it("denies unauthorized and warehouse/HQ scope before any source or employee lookup", async () => {
    for (const ids of [["b"], ["main_warehouse"], ["hq"], ["head_office"]])
      await expect(projectOperationsPeople(req({ allowed: ["a"] }), ids, "all")).rejects.toMatchObject({ status: 403 });
    expect(query).not.toHaveBeenCalled();
    expect(peopleBranchAllowed("a")).toBe(true);
  });
  it("fails closed on unknown sources even outside the HTTP parser", async () => {
    await expect(projectOperationsPeople(req(), ["a"], "stock" as any)).rejects.toMatchObject({ status: 400 });
    expect(() => operationsPeopleSql("stock" as any, ["a"], "2026-10-01")).toThrow();
    expect(() => projectPeopleRecord("stock" as any, row, actor, grants, "2026-10-01")).toThrow();
    expect(query).not.toHaveBeenCalled();
  });
  it("uses the same full active SQL predicate for counts and pages, not newest100 post filtering", async () => {
    setup({ leaves: 340, advances: 120 });
    const result = await projectOperationsPeople(req(), ["a"], "leaves", 175, 25);
    expect(result.coverage.total).toBe(340);
    expect(result.coverage.nextOffset).toBe(200);
    expect(result.summaries.find(summary => summary.source === "advances")?.value).toBe(120);
    expect(result.employees).toMatchObject({ value: 9, active: 7, coverage: "complete" });
    const count = query.mock.calls.find(([text]) => text.startsWith("SELECT count") && text.includes("r.status='pending'"))!;
    const page = query.mock.calls.find(([text]) => text.startsWith("SELECT r.id"))!;
    const predicate = operationsPeopleSql("leaves", ["a"], result.businessDate).where;
    expect(count[0]).toContain(`WHERE ${predicate}`);
    expect(page[0]).toContain(`WHERE ${predicate} ORDER BY r.id DESC`);
    expect(page[1]).toEqual([["a"], 25, 175]);
    expect(result.records[0].canonicalId).toBe("leave:41");
  });
  it("counts all summaries independently while only paging the requested source", async () => {
    setup({ leaves: 125, advances: 102, attendance: 7, joining: 2 });
    const result = await projectOperationsPeople(req(), ["a"], "advances", 101, 1);
    expect(result.summaries.map(summary => summary.value)).toEqual([125, 0, 102, 7, 2]);
    expect(result.coverage.total).toBe(102);
    expect(result.coverage.nextOffset).toBeNull();
    expect(result.records.every(record => record.domain === "advances")).toBe(true);
    expect(query.mock.calls.filter(([text]) => text.startsWith("SELECT r.id"))).toHaveLength(1);
  });
  it.each(operationsPeopleSources)("uses count/page active predicate parity for %s", async source => {
    setup({ [source]: 1001 });
    const result = await projectOperationsPeople(req(), ["a", "b"], source, 701, 50);
    const sql = operationsPeopleSql(source, ["a", "b"], result.businessDate);
    const count = query.mock.calls.find(([text]) => text === `SELECT count(*)::text AS total FROM ${sql.from} WHERE ${sql.where}`)!;
    const page = query.mock.calls.find(([text]) => text.startsWith(`SELECT ${sql.select} FROM ${sql.from} WHERE ${sql.where}`))!;
    expect(count).toBeDefined();
    expect(count[1]).toEqual(sql.values);
    expect(page).toBeDefined();
    expect(page[0]).toContain(`ORDER BY ${sql.order}`);
    expect(page[1]).toEqual([...sql.values, 50, 701]);
    expect(result.coverage.total).toBe(1001);
    expect(result.coverage.nextOffset).toBe(751);
  });
  it("rejects a source row outside explicit selected scope rather than leaking it", async () => {
    setup({ attendance: 1 });
    const implementation = query.getMockImplementation()!;
    query.mockImplementation(async (...args) => args[0].startsWith("SELECT r.id")
      ? { rows: [{ ...row, branch_id: "ungranted" }] } : implementation(...args));
    const result = await projectOperationsPeople(req(), ["a"], "attendance");
    expect(result.records).toEqual([]);
    expect(result.coverage.sources.attendance.state).toBe("unavailable");
    expect(result.coverage.total).toBeNull();
  });
  it("source count failures and forbidden sources are null, not false zero", async () => {
    setup();
    const implementation = query.getMockImplementation()!;
    query.mockImplementation(async (...args) => {
      if (args[0].includes("advance_requests")) throw new Error("unavailable");
      return implementation(...args);
    });
    const result = await projectOperationsPeople(req({ grants: ["hr_leaves:view", "hr_advances:view"] }), ["a"], "all");
    expect(result.summaries.find(summary => summary.source === "leaves")).toMatchObject({ value: 0, coverage: "complete" });
    expect(result.summaries.find(summary => summary.source === "advances")).toMatchObject({ value: null, coverage: "unavailable" });
    expect(result.summaries.find(summary => summary.source === "joining")).toMatchObject({ value: null, coverage: "forbidden" });
    expect(result.employees).toMatchObject({ value: null, active: null, coverage: "forbidden" });
    expect(result.coverage.total).toBeNull();
    expect(result.tools).toEqual([]);
  });
  it("page failures invalidate the source count too", async () => {
    setup({ leaves: 200 });
    const implementation = query.getMockImplementation()!;
    query.mockImplementation(async (...args) => {
      if (args[0].startsWith("SELECT r.id")) throw new Error("page failed");
      return implementation(...args);
    });
    const result = await projectOperationsPeople(req(), ["a"], "leaves", 100, 25);
    expect(result.records).toEqual([]);
    expect(result.summaries[0]).toMatchObject({ value: null, coverage: "unavailable" });
    expect(result.coverage.total).toBeNull();
  });
  it("does not load bulk HR bundles, and fresh denied grants revoke employee aggregate/tools", async () => {
    setup({ joining: 1 });
    const request = req();
    expect((await projectOperationsPeople(request, ["a"], "joining")).tools.length).toBe(4);
    request.grants = [];
    query.mockClear();
    const result = await projectOperationsPeople(request, ["a"], "joining");
    expect(result.records).toEqual([]);
    expect(result.employees.value).toBeNull();
    expect(result.tools).toEqual([]);
    expect(query.mock.calls).toHaveLength(1); // branch existence only
    expect((await peopleGrants(request)).joiningApprove).toBe(false);
  });
  it("keeps employee aggregates null if any employee aggregate is unavailable", async () => {
    setup();
    const implementation = query.getMockImplementation()!;
    query.mockImplementation(async (...args) => {
      if (args[0].includes("FROM branch_employees WHERE")) return { rows: [{ total: "9", active: "invalid" }] };
      return implementation(...args);
    });
    const result = await projectOperationsPeople(req(), ["a"], "leaves");
    expect(result.employees).toMatchObject({ value: null, active: null, coverage: "unavailable" });
  });
  it.each(["admin", "super_admin", "manager", "ops_manager", "operations-manager", "hr_manager"])(
    "never upgrades %s into operations HR tools or joining even with all module grants", async role => {
      setup();
      const result = await projectOperationsPeople(req({ currentUser: { id: "other", role }, allowed: ["a"] }), ["a"], "joining");
      expect(result.tools).toEqual([]);
      expect(result.employees.coverage).toBe("forbidden");
      expect(result.coverage.sources.joining.state).toBe("forbidden");
    });
});

describe("source stages, actual authority and minimal payload", () => {
  it("follows current leave chain and source-authorized higher-level bypass", () => {
    const chain = [{ level: 1, jobTitle: "مدير الفرع" }, { level: 2, jobTitle: "مدير التشغيل" }, { level: 3, jobTitle: "مدير شؤون الموظفين" }];
    expect(peopleLeaveReviewer(1, chain, actor).matches).toBe(true);
    expect(peopleLeaveReviewer(3, chain, actor).matches).toBe(false);
    expect(peopleLeaveReviewer(1, chain, { ...actor, role: "viewer", reviewerTitle: null }).matches).toBe(false);
    expect(peopleLeaveReviewer(3, chain, { ...actor, role: "admin" }).matches).toBe(true);
    const item = projectPeopleRecord("leaves", { ...row, current_level: 3, approval_chain: chain }, actor, grants, "2026-10-01");
    expect(item.decision).toBeUndefined();
    expect(projectPeopleRecord("leaves", { ...row, current_level: 1, approval_chain: chain }, actor, grants, "2026-10-01").decision?.actorId).toBe(actor.id);
    expect(projectPeopleRecord("leaves", { ...row, status: "approved", current_level: 1 }, actor, grants, "2026-10-01").decision).toBeUndefined();
  });
  it.each(["operations_manager", "branch_manager", "manager", "viewer"])("limits %s to pending preliminary advance authority", role => {
    const current = { ...actor, role };
    expect(peopleAdvanceAuthority("pending", current, grants)).toMatchObject({ final: false, eligible: true });
    for (const status of ["pre_approved", "awaiting_signature", "signed", "approved"])
      expect(peopleAdvanceAuthority(status, current, grants).eligible).toBe(false);
    expect(projectPeopleRecord("advances", row, current, grants, "2026-10-01").decision?.label).toBe("موافقة أولية فقط");
  });
  it.each(["admin", "super_admin", "hr_manager", "hr_specialist"])("exposes %s HR review then signed final approval, never employee signature decision", role => {
    const current = { ...actor, role };
    for (const status of ["pending", "pre_approved"]) {
      const item = projectPeopleRecord("advances", { ...row, status }, current, grants, "2026-10-01");
      expect(item.decision?.capability).toBe("review");
    }
    expect(projectPeopleRecord("advances", { ...row, status: "signed" }, current, grants, "2026-10-01").decision?.capability).toBe("approve");
    expect(projectPeopleRecord("advances", { ...row, status: "awaiting_signature" }, current, grants, "2026-10-01").decision).toBeUndefined();
    expect(peopleAdvanceAuthority("signed", { ...actor, role: "hr_specialist" }, { ...grants, specialistEditConfigured: false }).eligible).toBe(false);
  });
  it("uses actual approve OR edit authority and denies revoked actions", () => {
    const onlyEdit = { ...grants, advancesApprove: false };
    expect(projectPeopleRecord("advances", row, actor, onlyEdit, "2026-10-01").decision?.permission.action).toBe("edit");
    expect(projectPeopleRecord("advances", row, actor, { ...onlyEdit, advancesEdit: false }, "2026-10-01").decision).toBeUndefined();
    expect(projectPeopleRecord("leaves", { ...row, current_level: 1 }, actor, { ...grants, leavesApprove: false }, "2026-10-01").decision).toBeUndefined();
  });
  it("attendance approval is approved_at, never status; no missing-employee absence inference", () => {
    const sql = operationsPeopleSql("attendance", ["a"], "2026-10-01");
    expect(sql.where).toContain("r.attendance_date=$2 AND r.approved_at IS NULL");
    expect(sql.where).not.toContain("status=");
    expect(sql.values).toEqual([["a"], "2026-10-01"]);
    for (const status of ["present", "late", "absent", "on_leave", "pending"]) {
      const item = projectPeopleRecord("attendance", { ...row, status, approved_at: null }, actor, grants, "2026-10-01");
      expect(item.decision).toBeUndefined();
      expect(item.step).toBe("attendance_review");
      expect(item.href).toContain("/employee-attendance-report?");
      expect(peopleSourceHref(item, actor.id, "https://local.invalid", "2026-10-01").href).not.toBeNull();
    }
    expect(projectPeopleRecord("attendance", { ...row, approved_at: "2026-10-01" }, actor, grants, "2026-10-01").decision).toBeUndefined();
    expect(projectPeopleRecord("attendance", row, actor, { ...grants, attendanceEdit: false }, "2026-10-01").decision).toBeUndefined();
  });
  it("projects actual attendance facts and linked employee number without inventing missing times", () => {
    const item = projectPeopleRecord("attendance", { ...row, employee_name: "Test", employee_number: "MED-001",
      attendance_date: "2026-10-01", actual_check_in: "08:05:00", actual_check_out: null }, actor, grants, "2026-10-01");
    expect(item.employee?.number).toBe("MED-001");
    expect(item.attendance).toEqual({ date: "2026-10-01", checkIn: "08:05:00", checkOut: null });
    expect(item.decision).toBeUndefined();
    const sql = operationsPeopleSql("attendance", ["a"], "2026-10-01");
    expect(sql.from).toContain("e.branch_id=r.branch_id");
    expect(sql.from).toContain("r.branch_employee_id IS NULL");
    expect(sql.from).toContain("e.linked_user_id");
    expect(sql.from).toContain("LIMIT 1");
    expect(sql.select).toContain("e.employee_number");
  });
  it("approved leave movement followup uses persisted confirmation fields and never fabricates approval/absence", () => {
    const sql = operationsPeopleSql("leave_movements", ["a"], "2026-10-01");
    expect(sql.where).toContain("r.status='approved'");
    expect(sql.where).toContain("r.exit_confirmed_at IS NULL AND r.start_date <= $2");
    expect(sql.where).toContain("r.status='approved' AND r.return_confirmed_at IS NULL");
    expect(sql.where).toContain("r.exit_confirmed_at IS NOT NULL AND r.end_date < $2");
    const exit = projectPeopleRecord("leave_movements", { ...row, status: "approved", exit_confirmed_at: null }, actor, grants, "2026-10-01");
    expect(exit.step).toBe("confirm_exit");
    expect(exit.decision).toBeUndefined();
    expect(exit.dueAt).toBeNull();
    const returning = projectPeopleRecord("leave_movements", { ...row, status: "approved", exit_confirmed_at: "2026-09-01" }, actor, grants, "2026-10-01");
    expect(returning.step).toBe("confirm_return");
    expect(returning.decision).toBeUndefined();
  });
  it("joining predicates exclude branch-mismatch, converted, confirmed, cancelled and unsigned records before count/page", () => {
    const sql = operationsPeopleSql("joining", ["a"], "2026-10-01");
    for (const predicate of ["o.branch_id=r.branch_id", "o.status='accepted'", "o.hired_employee_id IS NULL",
      "r.status='signed'", "r.signed_at IS NOT NULL", "r.confirmed_at IS NULL", "r.converted_at IS NULL",
      "r.converted_employee_id IS NULL", "r.converted_branch_employee_id IS NULL", "r.cancelled_at IS NULL"])
      expect(sql.where).toContain(predicate);
    expect(peopleSourceEnabled("joining", { ...actor, role: "manager" }, grants)).toBe(false);
    const item = projectPeopleRecord("joining", { ...row, status: "signed", offer_id: 73 }, actor, grants, "2026-10-01");
    expect(item).toMatchObject({ sourceType: "joining_notification", sourceId: "41", notificationId: 41, offerId: 73 });
    expect(item.href).toBe(peopleJoiningHref("a", 41));
    const target = new URL(item.href, "https://local.invalid");
    expect(target.searchParams.get("tab")).toBe("employees");
    expect(target.searchParams.get("section")).toBe("joining");
    expect(target.searchParams.get("notificationId")).toBe("41");
    expect(target.searchParams.has("offerId")).toBe(false);
    expect(item.decision?.actorId).toBe(actor.id);
    expect(peopleSourceHref(item, actor.id, "https://local.invalid", "2026-10-01").href).not.toBeNull();
    expect(projectPeopleRecord("joining", { ...row, status: "signed", offer_id: 73 }, actor,
      { ...grants, joiningApprove: false }, "2026-10-01").decision).toBeUndefined();
  });
  it("tools require canonical role, operations HR and actual module gates; transfers are history/payroll advisory", () => {
    expect(peopleTools(["a"], actor, grants).map(tool => [tool.id, tool.kind]))
      .toEqual([["directory", "directory"], ["joining", "workflow"], ["transfers", "history"], ["payroll", "advisory"]]);
    expect(peopleTools(["a", "ungranted", "main_warehouse"], actor, grants)).toHaveLength(4);
    expect(peopleTools(["a"], actor, { ...grants, operationsHr: false })).toEqual([]);
    expect(peopleTools(["a"], actor, { ...grants, joiningView: false, transfersView: false, payrollView: false })).toHaveLength(1);
    expect(peopleTools(["a"], { ...actor, allowed: null }, grants)).toEqual([]);
    for (const tool of peopleTools(["a"], actor, grants)) {
      expect(peopleToolHref(tool, "a", "2026-10", "https://local.invalid")).not.toBeNull();
      const url = new URL(tool.href, "https://local.invalid");
      expect(url.pathname).toBe("/hr-hub");
      expect(url.searchParams.get("tab")).toBe(tool.id === "payroll" ? "payroll" : "employees");
      expect(url.searchParams.get("section")).toBe(tool.id === "payroll" ? null : tool.id);
    }
  });
  it("only projects whitelisted employee display, not bank/contact/token/signature fields even if injected into a source row", () => {
    const sensitive = { ...row, offer_id: 73, current_level: 1, bankAccount: "SECRET", phone: "SECRET",
      email: "SECRET", token: "SECRET", signatureData: "SECRET", candidate_signature: "SECRET", notes: "SECRET" };
    for (const domain of operationsPeopleSources) {
      const item = projectPeopleRecord(domain, sensitive, actor, grants, "2026-10-01");
      expect(JSON.stringify(item)).not.toContain("SECRET");
      expect(item.employee).toEqual({ id: 5, name: row.employee_name, number: row.employee_number, jobTitle: row.job_title });
      expect(operationsPeopleSql(domain, ["a"], "2026-10-01").select).not.toMatch(/\*|phone|email|bank|token|signature|notes/);
    }
  });
  it("registers only a read-only endpoint and leaves the global center domains untouched", () => {
    const registration = readFileSync("server/operations-center.ts", "utf8");
    expect(registration).toContain('app.get("/api/operations-center/people", ...auth');
    expect(registration).not.toMatch(/app\.(post|put|patch|delete)\("\/api\/operations-center\/people/);
    const implementation = readFileSync("server/operations-people.ts", "utf8");
    expect(implementation).not.toMatch(/\.insert\(|\.update\(|\.delete\(|CREATE TABLE|ensureOperationsJoiningSchema|getBranchEmployees|getHrBundle/);
  });
});