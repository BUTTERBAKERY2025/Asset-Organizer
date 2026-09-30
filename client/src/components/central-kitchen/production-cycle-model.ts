import type { ProductionPlanningResponse } from "@shared/production-planning";

export type CycleRecord = Record<string, unknown> & { id: number };
export type MovementLane = "raw" | "shipments" | "returns";
export function cycleStatusLabel(status: unknown) {
  const key = String(status ?? "");
  return ({
    pending: "بانتظار الاعتماد", requested: "مطلوب", approved: "معتمد",
    in_progress: "قيد الإنتاج", finished: "انتهى الإنتاج", prepared: "مجهز",
    in_transit: "في الطريق", dispatched: "أُرسل", delivered: "تم التسليم",
    received: "مستلم", inspected: "تم الفحص", written_off: "شُطب", cancelled: "ملغى",
  } as Record<string, string>)[key] ?? `حالة المصدر: ${key || "غير معروفة"}`;
}

/** Local presentation filter only; every request still passes the source API's authorization. */
export function cycleMovements(rows: CycleRecord[], lane: MovementLane, kitchenId: string, date: string) {
  return rows.filter(row => {
    const scoped = lane === "raw" ? row.destinationBranchId === kitchenId
      : lane === "shipments" ? row.source_branch_id === kitchenId
      : row.source_branch_id === kitchenId || row.destination_branch_id === kitchenId;
    if (!scoped) return false;
    const timestamp = row.createdAt ?? row.created_at;
    const parsed = typeof timestamp === "string" ? new Date(timestamp) : null;
    const day = parsed && Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(parsed) : null;
    // Keep open backlog and unclassified dates visible, never reconstruct a historical balance.
    const closed = ["delivered", "received", "cancelled", "inspected", "written_off"].includes(String(row.status));
    return day === null || day === date || (!closed && day < date);
  });
}

export function explicitPlanReferences(data: ProductionPlanningResponse | undefined, requestItemId: number) {
  return (data?.rows ?? []).filter(row => row.source === "advanced_plan")
    .flatMap(row => row.items.filter(item => item.requestLink?.requestItemId === requestItemId)
      .map(item => ({ planId: row.id, itemId: item.id, quantity: item.requestLink!.allocatedQuantity, href: row.directLink })));
}

export function cycleReadError(status: number) {
  return status === 403 ? "غير مصرح بعرض هذا المسار أو هذا المطبخ."
    : status === 401 ? "انتهت الجلسة؛ سجّل الدخول مجددًا."
    : `تعذر تحميل بيانات المسار (${status}).`;
}

export async function readCycleSource<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", signal });
  if (!response.ok) throw new Error(cycleReadError(response.status));
  return response.json();
}