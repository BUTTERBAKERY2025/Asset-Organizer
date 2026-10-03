// Only the freshly authorized branch list may select a schedule branch.
// Keep the requested selection separate so a temporary refetch does not lose it.
export function resolveScheduleBranch(
  requested: string,
  branches: readonly { id: string }[],
  ready: boolean,
  canSelectBranch: boolean,
): string {
  if (!ready || branches.length === 0) return "";
  if (!canSelectBranch) return branches.length === 1 ? branches[0].id : "";
  if (requested === "all" || branches.some(branch => branch.id === requested)) return requested;
  return "all";
}