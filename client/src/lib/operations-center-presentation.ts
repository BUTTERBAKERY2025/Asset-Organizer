import type { OperationsCard, OperationsQueueItem } from "@shared/operations-center";

const sourceLabels: Record<string, string> = {
  maintenance: "الصيانة", kitchen_order: "طلبات المطبخ", central_kitchen: "المطبخ",
  central_kitchen_orders: "طلبات المطبخ", transfer: "التحويلات", transfer_requests: "التحويلات",
  reverse_movement: "المرتجعات", reverse_logistics: "المرتجعات",
  delivery_assignment: "التوصيل", delivery_tasks: "التوصيل",
  leave: "الإجازات", hr_leaves: "الإجازات", attendance_record: "الحضور", attendance: "الحضور",
  attendance_check: "الحضور", advance: "السلف", hr_advances: "السلف",
  quality_check: "الجودة", quality_control: "الجودة", quality: "الجودة",
  closure: "إقفال الفرع", branch_daily_closing: "إقفال الفرع",
  cashier_journal: "يوميات الكاشير", cashier: "يوميات الكاشير",
};
export function operationsSourceLabel(key?: string) {
  return key && sourceLabels[key] ? sourceLabels[key] : "متابعة تشغيلية";
}

/** A domain is a navigation group, never an aggregate of heterogeneous measures. */
export function groupOperationsSources(cards: readonly OperationsCard[]) {
  const groups = new Map<string, { id: string; label: string; module: string; cards: OperationsCard[] }>();
  for (const card of cards) {
    const group = groups.get(card.id) ?? { id: card.id, label: card.title, module: card.module, cards: [] };
    group.cards.push(card);
    groups.set(card.id, group);
  }
  return [...groups.values()];
}

export type SourceSelection = { branchId: string; cardId: string };
/** Never silently substitute the first card from another branch after a filter/refetch. */
export function findSelectedSource(cards: readonly OperationsCard[], selected: SourceSelection | null) {
  return selected ? cards.find(card => card.branchId === selected.branchId && card.id === selected.cardId) ?? null : null;
}
export function findSelectedRecord(items: readonly OperationsQueueItem[], selectedId: string | null) {
  return selectedId ? items.find(item => item.id === selectedId) ?? null : null;
}
/** A loaded slice is not an all-time total when queue pagination or source gaps exist. */
export function queueQualifier(truncated: boolean, nextOffset: number | null, offset: number, unavailable: boolean) {
  return truncated || nextOffset !== null || offset > 0 || unavailable
    ? "في الصفحة المعروضة فقط؛ ليست إجمالي النطاق"
    : "في البيانات المعروضة من المصادر المتاحة";
}