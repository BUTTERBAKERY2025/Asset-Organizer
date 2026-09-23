import { describe, expect, it } from "vitest";
import {
  buildOrderSafeSummary,
  buildSheetSafeSummary,
  preparationSheetPrintHtml,
  type PreparationSheet,
} from "../client/src/components/central-kitchen/kitchen-order-share-model";
import {
  kitchenOrderPdfDefinition,
  preparationSheetPdfDefinition,
} from "../client/src/components/central-kitchen/kitchen-order-pdf";

const sheet: PreparationSheet = {
  generatedAt: "2026-09-22T09:00:00.000Z",
  snapshotStatus: "current_at_generation",
  orders: [{ id: 12, orderNumber: "CK-12", status: "prepared", requestBranchName: "العليا" }],
  groups: [{
    identity: "product:7",
    provenance: "original",
    productName: "<دقيق>",
    unit: "كجم",
    requestedQuantity: 2.5,
    approvedQuantity: 2.5,
    preparedQuantity: 1,
    substitutedQuantity: 0.5,
    actualShortageQuantity: 1,
    unpreparedQuantity: 0,
    orders: [{
      id: 12, orderNumber: "CK-12", branchName: "العليا", requestedQuantity: 2.5,
      preparedQuantity: 1, substitutedQuantity: 0.5, actualShortageQuantity: 1,
      substituteProductName: "دقيق بديل", substituteUnit: "كجم", substituteIdentity: "product:9",
      unpreparedQuantity: 0, shortageReason: "quality_issue", preparationNotes: "<ملاحظة حساسة>",
    }],
  }],
};

describe("central kitchen safe sharing", () => {
  it("shares authenticated links without notes, stock, or fulfillment details", () => {
    const text = buildSheetSafeSummary(sheet, "https://internal.example");
    expect(text).toContain("https://internal.example/central-kitchen-orders?orderId=12");
    expect(text).toContain("تتطلب تسجيل الدخول");
    expect(text).not.toContain("ملاحظة حساسة");
    expect(text).not.toContain("نقص");
    expect(text).not.toContain("2.5");
  });

  it("builds individual manual-share text without claiming delivery", () => {
    const text = buildOrderSafeSummary({
      id: 12, orderNumber: "CK-12", status: "prepared",
      requestBranchName: "العليا", centralKitchenName: "المركزي", neededDate: "2026-09-23",
    }, "https://internal.example");
    expect(text).toContain("orderId=12");
    expect(text).not.toMatch(/تم (الإرسال|التسليم)/);
  });

  it("escapes authorized notes in print HTML and labels actual shortages", () => {
    const html = preparationSheetPrintHtml(sheet);
    expect(html).toContain("&lt;دقيق&gt;");
    expect(html).toContain("&lt;ملاحظة حساسة&gt;");
    expect(html).not.toContain("<ملاحظة حساسة>");
    expect(html).toContain("نقص فعلي");
    expect(html).toContain("بديل");
    expect(html).toContain("page-break-inside:avoid");
    expect(html).toContain("display:table-header-group");
  });

  it("builds a complete, multipage-safe Arabic order PDF independently of print", () => {
    const definition = kitchenOrderPdfDefinition({
      orderNumber: "CK-12",
      status: "dispatched",
      requestBranchId: "branch-1",
      centralKitchenId: "kitchen-1",
      requestBranchName: "العليا",
      centralKitchenName: "المطبخ المركزي",
      neededDate: "2026-09-23",
      neededTime: "08:30",
      createdAt: "2026-09-22T09:00:00.000Z",
      notes: "ملاحظة الطلب",
      items: [{
        productName: "دقيق",
        unit: "كجم",
        requestedQuantity: 5,
        reportedAvailableQuantity: 1,
        preparedQuantity: 3,
        substituteQuantity: 1,
        substituteProductName: "دقيق بديل",
        preparationNotes: "ملاحظة التجهيز",
      }],
    }) as any;
    const serialized = JSON.stringify(definition);
    expect(definition.pageOrientation).toBe("landscape");
    expect(definition.defaultStyle.font).toBe("Amiri");
    expect(serialized).toContain("في الطريق");
    expect(serialized).toContain("العليا");
    expect(serialized).toContain("2026-09-23");
    expect(serialized).toContain("دقيق بديل");
    expect(serialized).toContain("ملاحظة الطلب");
    expect(serialized).toContain("ملاحظة التجهيز");
    expect(definition.content.find((entry: any) => entry.table)?.table.headerRows).toBe(1);
    expect(definition.content.find((entry: any) => entry.table)?.table.dontBreakRows).toBe(false);
  });

  it("keeps all preparation-sheet quantities, notes, branches, and statuses in the PDF model", () => {
    const definition = preparationSheetPdfDefinition(sheet) as any;
    const serialized = JSON.stringify(definition);
    expect(serialized).toContain("CK-12");
    expect(serialized).toContain("العليا");
    expect(serialized).toContain("ملاحظة حساسة");
    expect(serialized).toContain("نقص فعلي");
    expect(definition.content.find((entry: any) => entry.table)?.table.headerRows).toBe(1);
  });
});