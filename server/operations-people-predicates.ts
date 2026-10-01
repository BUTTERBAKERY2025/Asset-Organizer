import type { OperationsPeopleSource, OperationsPeopleTool } from "@shared/operations-people";
import { operationsAdvanceFinalAuthority } from "@shared/operations-center";
import { reviewerMatchesStep } from "./leave-helpers";

export type PeopleActor = { id: string; role: string; allowed: string[] | null; reviewerTitle?: string | null };
export type PeopleGrants = {
  leavesView: boolean; leavesApprove: boolean; leavesCreate: boolean;
  advancesView: boolean; advancesApprove: boolean; advancesEdit: boolean;
  attendanceView: boolean; attendanceEdit: boolean;
  operationsHr: boolean; joiningView: boolean; joiningApprove: boolean;
  transfersView: boolean; payrollView: boolean; specialistEditConfigured: boolean;
};

export function peopleBranchAllowed(id: string) {
  return !["main_warehouse", "hq", "head_office"].includes(id.toLowerCase());
}

export function peopleSourceEnabled(source: OperationsPeopleSource, actor: PeopleActor, grants: PeopleGrants) {
  return source === "leaves" || source === "leave_movements" ? grants.leavesView
    : source === "advances" ? grants.advancesView
    : source === "attendance" ? grants.attendanceView
    : actor.role === "operations_manager" && grants.operationsHr && grants.joiningView && Array.isArray(actor.allowed);
}

/** Matches /api/hr/leaves/:id/review, including the source's higher-level bypass. */
export function peopleLeaveReviewer(level: number, chainValue: unknown, actor: PeopleActor) {
  const chain = Array.isArray(chainValue) ? chainValue as { level: number; jobTitle?: string; stepName?: string }[] : [];
  const current = chain.find(step => Number(step.level) === level);
  const owner = current?.stepName || current?.jobTitle || "مراجع الإجازات المخول";
  const matches = !current?.jobTitle || ["admin", "super_admin"].includes(actor.role)
    || chain.some(step => Number(step.level) >= level && !!step.jobTitle
      && reviewerMatchesStep({ reviewerJobTitle: actor.reviewerTitle, reviewerRole: actor.role, expectedJobTitle: step.jobTitle! }));
  return { matches, owner };
}

/** The source accepts approve OR edit but only its exact HR roles can finalize. */
export function peopleAdvanceAuthority(status: string, actor: PeopleActor, grants: PeopleGrants) {
  const final = operationsAdvanceFinalAuthority(actor.role, grants.specialistEditConfigured);
  const permitted = grants.advancesApprove || grants.advancesEdit;
  return {
    final,
    eligible: permitted && (final ? ["pending", "pre_approved", "signed"].includes(status) : status === "pending"),
    action: grants.advancesApprove ? "approve" : "edit",
  };
}

/** Parameterized active filters are identical for counts and pages. No PII blobs. */
export function operationsPeopleSql(source: OperationsPeopleSource, branchIds: string[], businessDate: string) {
  const employee = "e.id AS employee_id,e.employee_name,e.employee_number,e.job_title";
  const join = "LEFT JOIN branch_employees e ON e.id=r.branch_employee_id AND e.branch_id=r.branch_id";
  const scope = "r.branch_id=ANY($1::varchar[])";
  const values: unknown[] = [branchIds];
  if (source === "leaves") return {
    from: `leave_requests r ${join}`, where: `${scope} AND r.status='pending'`,
    select: `r.id,r.branch_id,r.status,r.current_level,r.approval_chain,${employee}`,
    order: "r.id DESC", values,
  };
  if (source === "leave_movements") {
    values.push(businessDate);
    return {
      from: `leave_requests r ${join}`,
      where: `${scope} AND r.status='approved' AND r.return_confirmed_at IS NULL AND
        ((r.exit_confirmed_at IS NULL AND r.start_date <= $2)
          OR (r.exit_confirmed_at IS NOT NULL AND r.end_date < $2))`,
      select: `r.id,r.branch_id,r.status,r.exit_confirmed_at,r.return_confirmed_at,${employee}`,
      order: "r.id DESC", values,
    };
  }
  if (source === "advances") return {
    from: `advance_requests r ${join}`, where: `${scope} AND r.status IN ('pending','pre_approved','awaiting_signature','signed')`,
    select: `r.id,r.branch_id,r.status,${employee}`, order: "r.id DESC", values,
  };
  if (source === "attendance") {
    values.push(businessDate);
    return {
      // Never match by name or multiply source rows. A canonical FK wins;
      // legacy identities are resolved only within the recorded branch.
      from: `attendance_records r LEFT JOIN LATERAL (
        SELECT e.id,e.employee_number,e.job_title FROM branch_employees e
        WHERE e.branch_id=r.branch_id AND (
          e.id=r.branch_employee_id OR (r.branch_employee_id IS NULL AND
          (r.employee_id='branch_emp_' || e.id::text OR r.employee_id=e.linked_user_id)))
        ORDER BY e.id LIMIT 1
      ) e ON true`, where: `${scope} AND r.attendance_date=$2 AND r.approved_at IS NULL`,
      select: `r.id,r.branch_id,r.status,r.employee_name,e.id AS employee_id,e.employee_number,e.job_title,
        r.approved_at,r.attendance_date::text AS attendance_date,r.actual_check_in,r.actual_check_out`,
      order: "r.id DESC", values,
    };
  }
  if (source !== "joining") throw new Error("Unknown people source");
  return {
    from: "onboarding_notifications r INNER JOIN job_offers o ON o.id=r.job_offer_id",
    where: `${scope} AND o.branch_id=r.branch_id AND o.status='accepted' AND o.hired_employee_id IS NULL
      AND r.status='signed' AND r.signed_at IS NOT NULL AND r.confirmed_at IS NULL
      AND r.converted_at IS NULL AND r.converted_employee_id IS NULL AND r.converted_branch_employee_id IS NULL
      AND r.cancelled_at IS NULL`,
    select: "r.id,r.branch_id,r.status,o.id AS offer_id,o.candidate_name AS employee_name,o.position AS job_title",
    order: "r.id DESC", values,
  };
}

/** Operations-only directory/workflow/history/advisory destinations; never generic HR. */
export function peopleTools(branchIds: string[], actor: PeopleActor, grants: PeopleGrants): OperationsPeopleTool[] {
  if (actor.role !== "operations_manager" || !grants.operationsHr || !Array.isArray(actor.allowed)) return [];
  const definitions: { id: OperationsPeopleTool["id"]; label: string; module: string; kind: OperationsPeopleTool["kind"]; enabled: boolean }[] = [
    { id: "directory", label: "دليل موظفي الفرع", module: "operations_hr", kind: "directory", enabled: true },
    { id: "joining", label: "مباشرة الموظفين", module: "operations_joining", kind: "workflow", enabled: grants.joiningView },
    { id: "transfers", label: "سجل نقل الموظفين المكتمل", module: "operations_employee_transfer", kind: "history", enabled: grants.transfersView },
    { id: "payroll", label: "مراجعة رواتب استشارية وليست اعتماداً", module: "operations_payroll", kind: "advisory", enabled: grants.payrollView },
  ];
  return branchIds.filter(id => actor.allowed!.includes(id) && peopleBranchAllowed(id)).flatMap(branchId =>
    definitions.filter(tool => tool.enabled).map(({ enabled: _enabled, ...tool }) => ({
      ...tool, branchId, href: `/hr-hub?${new URLSearchParams({
        branchId, tab: tool.id === "payroll" ? "payroll" : "employees",
        ...(tool.id !== "payroll" ? { section: tool.id } : {}),
      })}`,
    })));
}