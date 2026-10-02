import { z } from "zod";

const assignmentId = z.number().int().positive().max(2147483647);
export const assignmentUserId = z.string().min(1).refine(value => value === value.trim());
const assignmentDate = z.union([
  z.string().date(),
  z.string().datetime({ offset: true }),
]).transform(value => new Date(value)).nullable();

const assignmentFields = {
  roleId: assignmentId,
  branchId: assignmentUserId.nullable().optional(),
  departmentId: assignmentId.nullable().optional(),
  scopeType: z.enum(["global", "branch", "department"]).optional(),
  isPrimary: z.boolean().optional(),
  startDate: assignmentDate.optional(),
  endDate: assignmentDate.optional(),
};

export const assignmentCreateBody = z.object(assignmentFields).strict();
export const assignmentUpdateBody = z.object({
  ...assignmentFields,
  roleId: assignmentId.optional(),
  isActive: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0);

type AssignmentScopeAndTime = {
  branchId?: string | null;
  departmentId?: number | null;
  scopeType?: string;
  startDate?: Date | null;
  endDate?: Date | null;
};

// Scope lives on the assignment, never in permanent user_branch_access rows.
// Historical scopeType=branch + branchId=null means all branches; preserve it.
export function normalizeAssignmentScope<T extends AssignmentScopeAndTime>(value: T): T {
  if (value.branchId !== "all_branches" || value.scopeType === "department") return value;
  return { ...value, branchId: null, scopeType: value.scopeType ?? "global" };
}

export function isValidAssignmentScopeAndTime(value: AssignmentScopeAndTime): boolean {
  const scope = value.scopeType ?? "branch";
  const branch = value.branchId ?? null;
  const department = value.departmentId ?? null;
  if (scope === "global" && (branch !== null || department !== null)) return false;
  if (scope === "branch" && department !== null) return false;
  if (scope === "department" && (department === null || branch !== null)) return false;
  if (!["global", "branch", "department"].includes(scope)) return false;
  const { startDate, endDate } = value;
  if (startDate && !Number.isFinite(startDate.getTime())) return false;
  if (endDate && !Number.isFinite(endDate.getTime())) return false;
  return !startDate || !endDate || startDate.getTime() < endDate.getTime();
}