import type { OperationsQueueItem } from "@shared/operations-center";

/** Only persisted personal assignments qualify as mine; waiting also includes
 * unassigned workflow steps, without attributing them to another person. */
export function filterOperationsQueue(
  items: readonly OperationsQueueItem[],
  actorId: string | undefined,
  owner: "all" | "mine" | "waiting",
  source: string,
): OperationsQueueItem[] {
  return items.filter(item => (source === "all" || item.sourceType === source) &&
    (owner === "all" || (owner === "mine"
      ? !!actorId && item.ownerId === actorId
      : !actorId || item.ownerId !== actorId)));
}