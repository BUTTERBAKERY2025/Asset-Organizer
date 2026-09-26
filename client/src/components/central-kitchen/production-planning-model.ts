import type { ProductionPlanningItem, ProductionPlanningRow, ProductionPlanningSource } from "@shared/production-planning";

export type PlanningFilters = { source: "all" | ProductionPlanningSource; status: string; search: string };

const statusLabels: Record<string, string> = {
  draft: "مسودة", requested: "مطلوب", pending: "قيد الانتظار", approved: "معتمد",
  prepared: "مجهز", dispatched: "مرسل", received: "مستلم",
  in_progress: "قيد التنفيذ", completed: "مكتمل", cancelled: "ملغي",
};

const issueLabels: Record<string, string> = {
  overdue: "تاريخ الاحتياج سابق ولم يكتمل الطلب",
  no_catalog_mapping: "بند دون ربط موثوق بالكتالوج",
  unfinished_linked_batch: "توجد دفعة إنتاج مرتبطة غير منتهية",
  historical_inventory_mode_unknown: "وضع مخزون الطلب التاريخي غير معروف",
  catalog_mapping_unverified: "ربط الصنف بالكتالوج غير متحقق",
  current_approved_recipe_unavailable_informational: "لا يوجد دليل وصفة معتمدة حالية لهذا البند؛ لا ينفي ذلك وصفة تاريخية",
  production_completion_unavailable_without_comparable_explicit_batch_link: "لا يمكن التحقق من كمية الإنتاج دون دفعة مرتبطة صراحةً وقابلة للمقارنة",
  range_plan_counted_once: "أمر إنتاج يغطي فترة زمنية ويُعرض مرة واحدة فقط",
  not_a_central_request: "هذا أمر إنتاج مستقل وليس طلب فرع",
  active_finished_product_mapping_unverified: "لم يتحقق ربط الصنف بمنتج نهائي نشط",
  current_catalog_unit_differs_from_request_unit: "وحدة الكتالوج الحالية تختلف عن الوحدة المحفوظة في الطلب",
  linked_production_exceeds_plan: "الإنتاج المرتبط يتجاوز الكمية المخططة؛ راجع الدفعات الأصلية",
};

export function planningStatusLabel(status: string): string {
  return statusLabels[status.toLowerCase()] || "حالة غير معروفة؛ راجع السجل الأصلي";
}

export function planningIssueLabel(issue: string): string {
  return issueLabels[issue] || "ملاحظة غير معروفة من المصدر؛ راجع السجل الأصلي";
}

export function filterPlanningRows(rows: readonly ProductionPlanningRow[], filters: PlanningFilters): ProductionPlanningRow[] {
  const needle = filters.search.trim().toLocaleLowerCase("ar");
  return rows.filter(row =>
    (filters.source === "all" || row.source === filters.source) &&
    (filters.status === "all" || row.status === filters.status) &&
    (!needle || [row.number, row.originLabel, row.status, planningStatusLabel(row.status), ...row.items.map(item => item.productName)]
      .join(" ").toLocaleLowerCase("ar").includes(needle))
  );
}

const number = new Intl.NumberFormat("ar-SA-u-nu-latn", { maximumFractionDigits: 6 });

export function planningQuantity(value: number | null, unit: string): string {
  return value === null || !Number.isFinite(value) ? "غير متحقق" : `${number.format(value)} ${unit}`;
}

export function planningItemQuantities(item: ProductionPlanningItem) {
  return {
    planned: planningQuantity(item.plannedQuantity, item.unit),
    completed: planningQuantity(item.completedQuantity, item.unit),
    inProgress: planningQuantity(item.inProgressQuantity, item.unit),
    remaining: planningQuantity(item.remainingQuantity, item.unit),
  };
}