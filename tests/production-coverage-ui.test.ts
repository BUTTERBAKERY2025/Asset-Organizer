import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProductionItemCoverage } from "@shared/production-coverage";
import { CoverageScope, ItemCoverage, coverageReason } from "../client/src/components/central-kitchen/production-coverage";

const calculated: ProductionItemCoverage = {
  status: "calculated", reason: null, persistedReserved: 0, proposedFreeStock: 2.5,
  prospectiveInProgress: 0, remainingProductionNeed: 3, inProgressGuaranteed: false,
};
const render = (coverage: ProductionItemCoverage | undefined, advanced = false) =>
  renderToStaticMarkup(React.createElement(ItemCoverage, { coverage, unit: "كجم", advanced }));

describe("read-only coverage cards", () => {
  it("shows zero as a measured per-item quantity, never as unknown or a reservation promise", () => {
    const html = render(calculated);
    expect(html).toContain("0 كجم");
    expect(html).toContain("2.5 كجم");
    expect(html).toContain("3 كجم");
    expect(html).toContain("حجز محفوظ للطلب");
    expect(html).toContain("حصة مقترحة من المخزون الحر");
    expect(html).toContain("إنتاج جارٍ محتمل");
    expect(html).toContain("احتياج إنتاج متبقٍ");
    expect(html).toContain("الحصة المقترحة ليست حجزاً");
    expect(html).not.toContain("غير متحقق");
  });

  it("keeps a null calculated field unknown, and an unknown item hides numeric estimates", () => {
    expect(render({ ...calculated, remainingProductionNeed: null })).toContain("غير متحقق");
    const html = render({ ...calculated, status: "unknown", reason: "source_reservation_ledger_mismatch" });
    expect(html).toContain("رصيد الحجوزات لا يطابق سجل التخصيصات");
    expect(html).not.toContain("2.5 كجم");
    expect(html).not.toContain("احتياج إنتاج متبقٍ");
  });

  it("explains shadow, historical, receipt and substitute reasons in Arabic, and advanced is not another allocation", () => {
    expect(render({ ...calculated, status: "not_applicable", reason: "shadow_inventory_mode" })).toContain("التشغيل الظلّي");
    expect(render({ ...calculated, status: "unknown", reason: "legacy_inventory_mode_unknown" })).toContain("التاريخي غير معروف");
    expect(coverageReason("receipt_shortfall")).toContain("فرق الاستلام");
    expect(coverageReason("ambiguous_original_or_substitute_identity")).toContain("البديل");
    expect(coverageReason("catalog_identity_or_unit_unverified")).toContain("الكتالوج");
    expect(coverageReason("uncertain_competing_request")).toContain("طلب منافس");
    expect(coverageReason("prepared_reservation_unverified")).toContain("المجهز");
    expect(coverageReason("not_recognized")).not.toContain("not_recognized");
    const advanced = render(calculated, true);
    expect(advanced).toContain("لا تُخصص له حصة ثانية");
    expect(advanced).not.toContain("2.5 كجم");
  });

  it("shows a prepared request's verified saved reservation without inventing remaining need", () => {
    const prepared = render({
      status: "not_applicable", reason: "request_already_prepared", persistedReserved: 4.5,
      proposedFreeStock: null, prospectiveInProgress: null, remainingProductionNeed: null,
      inProgressGuaranteed: false,
    });
    expect(prepared).toContain("مجهز · لا تنطبق محاكاة حصة جديدة");
    expect(prepared).toContain("حجز أصلي محفوظ للطلب");
    expect(prepared).toContain("4.5 كجم");
    expect(prepared).toContain("احتياج إنتاج متبقٍ</dt><dd class=\"font-medium\">غير متحقق");
    expect(prepared).not.toContain("0 كجم");
    expect(prepared).not.toContain("حصة مقترحة من المخزون الحر");
    expect(render({ status: "not_applicable", reason: "request_already_prepared", persistedReserved: 0,
      proposedFreeStock: null, prospectiveInProgress: null, remainingProductionNeed: null, inProgressGuaranteed: false })).toContain("0 كجم");
  });

  it("shows cross-date priority, filter independence and incomplete candidate-pool metadata", () => {
    const base = { scope: "all_open_eligible_requests_current_state" as const, candidateLimit: 10000, candidateCount: 12, note: "" };
    const complete = renderToStaticMarkup(React.createElement(CoverageScope, { metadata: { ...base, status: "calculated", complete: true } }));
    expect(complete).toContain("حتى خارج تاريخ الصفوف المعروضة");
    expect(complete).toContain("تاريخ الاحتياج ثم رقم الطلب");
    expect(complete).toContain("لا يعيدان حساب الحصص");
    expect(complete).toContain("الإنتاج المكتمل داخل المخزون النهائي");
    expect(complete).toContain("لا تؤكد توفر المواد الخام");
    expect(complete).toContain("12 بند مرشح");
    const incomplete = renderToStaticMarkup(React.createElement(CoverageScope, { metadata: { ...base, status: "unknown", complete: false } }));
    expect(incomplete).toContain("حساب التغطية غير مكتمل");
    expect(incomplete).toContain("10000");
    const partial = renderToStaticMarkup(React.createElement(CoverageScope, { metadata: { ...base, status: "unknown", complete: true } }));
    expect(partial).toContain("نطاق الطلبات مكتمل");
    expect(partial).toContain("بعض البيانات غير متحققة");
    expect(partial).not.toContain("تجاوز الحد");
    expect(partial).not.toContain("حساب التغطية غير مكتمل");
    expect(renderToStaticMarkup(React.createElement(CoverageScope, { metadata: undefined }))).toContain("حالة نطاق الحساب غير معروفة");
  });
});