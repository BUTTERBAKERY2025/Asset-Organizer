// The production HQ is a real branches row; it is not a virtual warehouse scope.
export const HQ_BRANCH_ID = "main_warehouse";

export function isHeadquartersEmployee(user: { branchId?: string | null }): boolean {
  return user.branchId === HQ_BRANCH_ID;
}