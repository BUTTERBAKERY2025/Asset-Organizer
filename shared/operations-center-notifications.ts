import type { SystemNotification } from "./schema";

/** The canonical recipient/workflow eligibility is checked by storage first.
 * This second gate prevents a notice scoped outside the selected view from leaking into it. */
export function noticeInSelectedScope(
  notice: Pick<SystemNotification, "targetAllBranches" | "targetBranchIds" | "accessBranchIds">,
  selected: string[],
): { kind: "general" | "branch"; branchIds: string[] } | null {
  const scope = notice.accessBranchIds?.length ? notice.accessBranchIds
    : notice.targetAllBranches ? null : notice.targetBranchIds;
  if (!scope) return notice.targetAllBranches
    ? { kind: "general", branchIds: [] } : null;
  // A notice covering an unselected (or ungranted) branch may contain details
  // about that branch in its freeform text. Never partially expose it.
  if (!scope.length || !scope.every(id => selected.includes(id))) return null;
  return { kind: "branch", branchIds: Array.from(new Set(scope)) };
}

export function publicCenterNotice(
  n: SystemNotification,
  scope: NonNullable<ReturnType<typeof noticeInSelectedScope>>,
  read: boolean,
) {
  return {
    id: n.id, title: n.title, content: n.content, messageType: n.messageType,
    priority: n.priority, createdAt: n.createdAt, buttonText: n.buttonText,
    buttonAction: n.buttonAction, kind: scope.kind, branchIds: scope.branchIds, read,
  };
}

export function parseNoticeAction(action: string | null | undefined, origin: string): string | null {
  if (!action || !action.startsWith("/") || action.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(action)) return null;
  try {
    const url = new URL(action, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return null; }
}