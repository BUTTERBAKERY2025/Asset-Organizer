import React from "react";
import type { ProductionCoverageMetadata, ProductionItemCoverage } from "@shared/production-coverage";
import { planningQuantity } from "./production-planning-model";

const reasons: Record<string, string> = {
  candidate_pool_truncated: "تجاوزت الطلبات المرشحة حد الحساب؛ لا يمكن تحديد حصة موثوقة.",
  shadow_inventory_mode: "الطلب محفوظ بوضع التشغيل الظلّي؛ لا تُحسب له تغطية مخزون فعلي.",
  legacy_inventory_mode_unknown: "وضع مخزون هذا الطلب التاريخي غير معروف.",
  request_not_open_approved: "الطلب ليس طلباً مفتوحاً معتمداً قابلاً للحساب.",
  ambiguous_original_or_substitute_identity: "تعذر تحديد طلب الصنف الأصلي بأمان؛ راجع البديل والصرف وفروقات الاستلام في سجل الطلب.",
  invalid_request_or_linked_batch_quantity: "كمية الطلب أو الدفعة المرتبطة غير قابلة للتحقق.",
  in_progress_identity_or_quantity_mismatch: "الدفعة الجارية المرتبطة لا تطابق هوية الصنف أو وحدته أو كميته.",
  duplicate_source: "تكرر مصدر المخزون؛ لا يمكن حساب الرصيد بأمان.",
  invalid_source_balance_or_identity: "هوية مصدر المخزون أو رصيده غير صالحين للحساب.",
  missing_allocation_source: "مصدر حجز محفوظ غير موجود في المخزون.",
  inconsistent_allocation_identity_or_quantity: "بيانات الحجز المحفوظ أو كميته غير متطابقة.",
  source_reservation_ledger_mismatch: "رصيد الحجوزات لا يطابق سجل التخصيصات.",
  reservation_exceeds_outstanding_demand: "الحجز المحفوظ يتجاوز الكمية المطلوبة غير المجهزة.",
  prepared_reservation_unverified: "لا يمكن التحقق من حجز الصنف المجهز ومطابقته لسجل الطلب والمخزون.",
  uncertain_competing_request: "يوجد طلب منافس غير متحقق للصنف نفسه؛ لا يمكن تخصيص رصيد المخزون الحر بأمان.",
  catalog_identity_or_unit_unverified: "تعذر التحقق من ربط الصنف أو وحدته بالكتالوج؛ لا يمكن حساب تغطيته بأمان.",
  stock_source_unavailable: "لا يوجد مصدر مخزون قابل للتحقق لهذا الصنف ووحدته.",
  request_already_prepared: "الطلب مجهز بالفعل؛ يُعرض الحجز الأصلي المحفوظ فقط، ولا تُقترح له حصة جديدة من المخزون.",
  advanced_plan_is_not_additional_request_demand: "أمر الإنتاج يشرح التنفيذ ولا يمثل طلب فرع إضافياً؛ لا تُخصص له حصة ثانية من المخزون.",
  request_not_in_complete_eligible_pool: "هذا الطلب خارج مجموعة الطلبات المؤهلة المحسوبة؛ لا يمكن استنتاج تغطيته.",
  receipt_shortfall: "فرق الاستلام يتبع سجل الطلب؛ لا يمكن افتراض أنه طلب إنتاج جديد.",
  receipt_shortfall_or_substitute: "فرق الاستلام أو الاستبدال يتبع سجل الطلب؛ لا يمكن افتراض أنه طلب إنتاج جديد.",
};

export function coverageReason(reason: string | null): string {
  return reason ? reasons[reason] ?? "تعذر التحقق من سبب التغطية؛ راجع تفاصيل الطلب الأصلية." : "لا تتوفر بيانات كافية لحساب التغطية.";
}

export function CoverageScope({ metadata }: { metadata: ProductionCoverageMetadata | undefined }) {
  return <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-sm text-sky-950">
    <p className="font-semibold">تقدير تغطية الطلبات · محاكاة للقراءة فقط</p>
    <p className="mt-1">تُوزع حصة المخزون النهائي الحر المقترحة على جميع طلبات المطبخ المفتوحة المعتمدة والمؤهلة، حتى خارج تاريخ الصفوف المعروضة، بأولوية تاريخ الاحتياج ثم رقم الطلب. يشمل نطاق القراءة الأصناف المجهزة لإظهار حجزها المحفوظ دون أن تستهلك حصة جديدة. البحث وتصفية المصدر أو الحالة يغيران العرض فقط ولا يعيدان حساب الحصص.</p>
    <p className="mt-1">الحجز المحفوظ هو الحجز الفعلي المسجل؛ الأصناف المجهزة تعرض حجزها المحفوظ فقط دون حصة جديدة. الحصة المقترحة ليست حجزاً فعلياً ولا إذناً بالصرف، والإنتاج الجاري احتمال غير مضمون. الإنتاج المكتمل داخل المخزون النهائي بالفعل، وليس كمية إضافية. هذه المحاكاة لا تؤكد توفر المواد الخام ولا تضمن التنفيذ. الكميات لكل صنف ووحدته فقط ولا تُجمع وحدات مختلفة.</p>
    {!metadata ? <p className="mt-2 font-medium">حالة نطاق الحساب غير معروفة؛ لا تفترض أن الصفوف المعروضة تشمل كل الطلبات.</p> :
      !metadata.complete ? <p role="alert" className="mt-2 font-medium">حساب التغطية غير مكتمل: بلغ نطاق الطلبات المرشحة {metadata.candidateCount} من حد {metadata.candidateLimit}؛ تجاوز الحد يمنع تحديد الحصص بثقة.</p> :
      metadata.status === "unknown" ? <p role="alert" className="mt-2 font-medium">نطاق الطلبات مكتمل ({metadata.candidateCount} بند مرشح)، لكن بعض البيانات غير متحققة. لا تفترض أن الحصص غير المتحققة صفر؛ الحصص المحسوبة موضحة لكل صنف على حدة.</p> :
      <p className="mt-2 text-xs">نطاق المحاكاة الحالي: {metadata.candidateCount} بند مرشح من جميع الطلبات المؤهلة، وليس من نتائج البحث أو تاريخ العرض.</p>}
  </div>;
}

export function ItemCoverage({ coverage, unit, advanced = false }: { coverage: ProductionItemCoverage | undefined; unit: string; advanced?: boolean }) {
  if (advanced) return <div className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-700"><strong>تفسير أمر الإنتاج:</strong> {coverageReason("advanced_plan_is_not_additional_request_demand")} الكميات المخططة والمنفذة أعلاه للمتابعة فقط، وليست تخصيص طلب آخر.</div>;
  if (coverage?.status === "not_applicable" && coverage.reason === "request_already_prepared") {
    return <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
      <strong>تغطية الطلب: مجهز · لا تنطبق محاكاة حصة جديدة</strong>
      <p className="mt-1">{coverageReason(coverage.reason)}</p>
      <dl className="mt-2 grid grid-cols-2 gap-3">
        <div><dt className="text-muted-foreground">حجز أصلي محفوظ للطلب</dt><dd className="font-medium">{planningQuantity(coverage.persistedReserved, unit)}</dd></div>
        <div><dt className="text-muted-foreground">احتياج إنتاج متبقٍ</dt><dd className="font-medium">{planningQuantity(coverage.remainingProductionNeed, unit)}</dd></div>
      </dl>
    </div>;
  }
  if (!coverage || coverage.status !== "calculated") {
    return <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
      <strong>تغطية الطلب: {coverage?.status === "not_applicable" ? "لا ينطبق" : "غير متحقق"}</strong>
      <p className="mt-1">{coverageReason(coverage?.reason ?? null)}</p>
    </div>;
  }
  return <div className="mt-3 rounded-md border border-sky-200 p-2 text-xs" aria-label="تغطية الطلب المحسوبة">
    <p className="font-semibold">تغطية الطلب · تقدير للقراءة فقط</p>
    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
      {([
        ["حجز محفوظ للطلب", coverage.persistedReserved],
        ["حصة مقترحة من المخزون الحر", coverage.proposedFreeStock],
        ["إنتاج جارٍ محتمل", coverage.prospectiveInProgress],
        ["احتياج إنتاج متبقٍ", coverage.remainingProductionNeed],
      ] as const).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{planningQuantity(value, unit)}</dd></div>)}
    </dl>
    <p className="mt-2 text-muted-foreground">الحصة المقترحة ليست حجزاً. الإنتاج الجاري غير مضمون؛ المكتمل ضمن المخزون النهائي، وليس إضافة إليه.</p>
  </div>;
}