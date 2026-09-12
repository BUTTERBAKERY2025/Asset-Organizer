import type { CentralKitchenMaterialRequirementsContract } from "@shared/central-kitchen-batch-materials";

export type FinishReadinessKind =
  | "loading"
  | "error"
  | "shortage"
  | "already_consumed"
  | "inconsistent"
  | "ready"
  | "legacy";

export type FinishReadiness = {
  kind: FinishReadinessKind;
  canFinish: boolean;
  reason?: string;
};

type RequirementsQueryState = {
  data?: CentralKitchenMaterialRequirementsContract;
  isLoading: boolean;
  isFetching?: boolean;
  isError: boolean;
  error?: unknown;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "");
}

function isKnownInconsistency(error: unknown): boolean {
  return /(لقطة مواد|سجل صرف مواد|غير مكتملة|العبث|غير معلنة|حالة استهلاك مضللة)/.test(errorMessage(error));
}

/**
 * Requirements are returned with NUMERIC(18,6) values as strings. Compare
 * shortage values as scaled integers so a six-decimal value is never rounded
 * through a floating-point preflight.
 */
function isPositiveQuantity(value: string | number): boolean {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,6})?$/.test(text)) return true;
  const [whole, fraction = ""] = text.split(".");
  const normalizedWhole = whole.replace(/^0+/, "") || "0";
  const normalizedFraction = (fraction + "000000").slice(0, 6);
  return normalizedWhole !== "0" || /[1-9]/.test(normalizedFraction);
}

function hasValidQuantity(value: string | number): boolean {
  return /^\d+(?:\.\d{1,6})?$/.test(String(value).trim());
}

export function getFinishReadiness(query: RequirementsQueryState): FinishReadiness {
  if (query.isLoading || query.isFetching) {
    return { kind: "loading", canFinish: false, reason: "جارٍ إعادة التحقق من احتياج المواد." };
  }
  if (query.isError || !query.data) {
    return {
      kind: isKnownInconsistency(query.error) ? "inconsistent" : "error",
      canFinish: false,
      reason: errorMessage(query.error) || "تعذر قراءة حالة احتياج المواد.",
    };
  }

  const data = query.data;
  if (!data.recipeBacked) {
    const validLegacy = data.recipe === null
      && data.materialConsumptionStatus === "not_applicable"
      && data.requirements.length === 0;
    return validLegacy
      ? { kind: "legacy", canFinish: true }
      : { kind: "inconsistent", canFinish: false, reason: "بيانات الدفعة القديمة لا تطابق حالة عدم ارتباطها بوصفة." };
  }

  if (!data.recipe || data.materialConsumptionStatus === "not_applicable"
    || !["pending", "consumed"].includes(data.materialConsumptionStatus)) {
    return { kind: "inconsistent", canFinish: false, reason: "لقطة وصفة الدفعة غير متسقة؛ لا يمكن تأكيد أثر المخزون." };
  }
  if (data.materialConsumptionStatus === "consumed") {
    return { kind: "already_consumed", canFinish: false, reason: "تم صرف مواد هذه الدفعة بالفعل." };
  }
  if (data.requirements.some(item => !hasValidQuantity(item.requiredQuantity)
    || !hasValidQuantity(item.currentQuantity)
    || !hasValidQuantity(item.reservedQuantity)
    || !hasValidQuantity(item.availableQuantity)
    || !hasValidQuantity(item.shortageQuantity))) {
    return { kind: "inconsistent", canFinish: false, reason: "أرقام احتياج مواد الوصفة غير صالحة." };
  }
  if (data.requirements.some(item => isPositiveQuantity(item.shortageQuantity))) {
    return { kind: "shortage", canFinish: false, reason: "لا يتوفر رصيد كافٍ لكل مواد الوصفة." };
  }
  return { kind: "ready", canFinish: true };
}
