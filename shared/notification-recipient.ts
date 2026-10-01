import type { SystemNotification } from "./schema";

type NoticeScope = Pick<SystemNotification, "accessBranchIds" | "targetAllBranches" | "targetBranchIds">;

/** Freeform content can contain every branch in this scope. Intersection is
 * not sufficient authorization, even for an exact per-user target. */
export function operationsNoticeScopeAllowed(notice: NoticeScope, grantedBranches: ReadonlySet<string>): boolean {
  if (grantedBranches.size === 0) return false;
  const scope = notice.accessBranchIds?.length ? notice.accessBranchIds
    : notice.targetAllBranches ? null : notice.targetBranchIds;
  return !scope?.length || scope.every(id => grantedBranches.has(id));
}

/** Recipient surfaces need presentation data, not other recipients' IDs,
 * creator IDs, deduplication keys or Push delivery/authorization metadata. */
export function publicRecipientNotice(notice: SystemNotification & { sourceState?: "current" | "history" }) {
  return {
    id: notice.id, title: notice.title, content: notice.content,
    messageType: notice.messageType, priority: notice.priority,
    buttonText: notice.buttonText, buttonAction: notice.buttonAction,
    displayStyle: notice.displayStyle, emoji: notice.emoji,
    imageUrl: notice.imageUrl, soundEnabled: notice.soundEnabled,
    soundType: notice.soundType, customSoundUrl: notice.customSoundUrl,
    backgroundColor: notice.backgroundColor, textColor: notice.textColor,
    accentColor: notice.accentColor, animationType: notice.animationType,
    effectType: notice.effectType,
    autoCloseSeconds: notice.autoCloseSeconds, designConfig: notice.designConfig,
    showOnce: notice.showOnce, isActive: notice.isActive,
    startDate: notice.startDate, endDate: notice.endDate,
    displayTimeStart: notice.displayTimeStart, displayTimeEnd: notice.displayTimeEnd,
    createdAt: notice.createdAt, updatedAt: notice.updatedAt,
    ...(notice.sourceState ? { sourceState: notice.sourceState } : {}),
  };
}

export type RecipientNotice = ReturnType<typeof publicRecipientNotice>;