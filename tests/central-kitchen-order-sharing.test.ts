import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildOrderSafeSummary,
  buildSheetSafeSummary,
  preparationSheetPrintHtml,
  type PreparationSheet,
} from "../client/src/components/central-kitchen/kitchen-order-share-model";
import {
  kitchenOrderPrintHtml,
  kitchenOrderPdfDefinition,
  preparationSheetPdfDefinition,
} from "../client/src/components/central-kitchen/kitchen-order-pdf";
import * as XLSX from "xlsx";
import { buildKitchenOrderWorkbook, buildPreparationSheetWorkbook } from "../client/src/components/central-kitchen/kitchen-order-excel";

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
    const embeddedLogo = "data:image/png;base64,authenticLogoBytes";
    const definition = kitchenOrderPdfDefinition({
      orderNumber: "CK-20260922-71F64FEC871A",
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
        dispatchedQuantity: 4,
        receivedQuantity: 2,
        damagedQuantity: 1,
        missingQuantity: 1,
        receivingNotes: "ملاحظة الاستلام",
      }],
    }, embeddedLogo) as any;
    const serialized = JSON.stringify(definition);
    const runningHeader = JSON.stringify(definition.header(1, 1));
    expect(definition.pageOrientation).toBe("landscape");
    expect(definition.defaultStyle.font).toBe("Amiri");
    expect(definition.defaultStyle.fontSize).toBeGreaterThanOrEqual(9);
    expect(runningHeader).toContain(embeddedLogo);
    expect(runningHeader).toContain("CK-20260922-71F64FEC871A");
    expect(serialized).toContain("في الطريق");
    expect(serialized).toContain("العليا");
    expect(serialized).toContain("2026-09-23");
    expect(serialized).toContain("دقيق بديل");
    expect(serialized).toContain("ملاحظة الطلب");
    expect(serialized).toContain("ملاحظة التجهيز");
    expect(serialized).toContain("ملاحظة الاستلام");
    expect(serialized).toContain("التالف");
    expect(serialized).toContain("المفقود");
    expect(serialized).not.toContain("2026-09-22T09:00:00.000Z");
    expect(serialized).toContain("السعودية");
    expect(typeof definition.footer).toBe("function");
    const closingBlock = definition.content.find((entry: any) => entry.stack?.some((node: any) => node.table?.headerRows === 1));
    const itemTable = closingBlock.stack.find((entry: any) => entry.table?.headerRows === 1);
    expect(itemTable.table.headerRows).toBe(1);
    expect(itemTable.table.dontBreakRows).toBe(true);
    expect(itemTable.table.body[0].map((entry: any) => entry.text)).toEqual([
      "الملاحظات", "البديل", "المتبقي للتجهيز", "المجهز", "المتوفر", "المطلوب", "الوحدة", "الصنف", "م",
    ]);
    expect(itemTable.table.widths).toEqual(["*", 85, 65, 45, 50, 45, 38, 120, 22]);
    expect(itemTable.table.body[1][7].text).toBe("دقيق");
    expect(serialized).toContain("حقول توقيع فارغة");
    expect(closingBlock.stack.find((entry: any) => entry.table?.widths?.length === 3).table.body[0]).toHaveLength(3);
  });

  it("keeps all preparation-sheet quantities, notes, branches, and statuses in the PDF model", () => {
    const definition = preparationSheetPdfDefinition(sheet, "data:image/png;base64,logo") as any;
    const serialized = JSON.stringify(definition);
    expect(serialized).toContain("CK-12");
    expect(serialized).toContain("العليا");
    expect(serialized).toContain("ملاحظة حساسة");
    expect(serialized).toContain("نقص فعلي");
    expect(serialized).toContain("data:image/png;base64,logo");
    expect(serialized).not.toContain("2026-09-22T09:00:00.000Z");
    expect(definition.content.find((entry: any) => entry.table?.headerRows === 1)?.table.headerRows).toBe(1);
    const table = definition.content.find((entry: any) => entry.table?.headerRows === 1).table;
    expect(table.body[0].map((cell: any) => cell.text)).toEqual([
      "تفاصيل الطلبات", "نقص فعلي", "لم يُحسم", "البديل", "الأصلي", "المعتمد", "المطلوب", "الوحدة", "الصنف",
    ]);
    expect(table.widths).toEqual(["*", 45, 45, 45, 45, 45, 45, 38, 82]);
    expect(table.body[1][8]).toContain("product:7");
  });

  it("builds the matching formal landscape print document with safe repeated headers", () => {
    const html = kitchenOrderPrintHtml({
      orderNumber: "CK-20260922-71F64FEC871A",
      status: "received",
      requestBranchId: "branch-1",
      centralKitchenId: "kitchen-1",
      createdAt: "2026-09-22T09:00:00.000Z",
      items: [{
        productName: "<كرواسون>",
        unit: "قطعة",
        requestedQuantity: 4,
        preparedQuantity: 2,
        substituteQuantity: 1,
        substituteProductName: "بديل",
        substituteUnit: "علبة",
        dispatchedQuantity: 3,
        receivedQuantity: 1,
        damagedQuantity: 1,
        missingQuantity: 1,
        receivingNotes: "<ملاحظة استلام>",
      }],
    }, "data:image/png;base64,logo");
    expect(html).toContain("@page{size:A4 landscape");
    expect(html).toContain("display:table-header-group");
    expect(html).toContain("CK-20260922-71F64FEC871A");
    expect(html).toContain("&lt;كرواسون&gt;");
    expect(html).toContain("&lt;ملاحظة استلام&gt;");
    expect(html).toContain("مسؤول التجهيز");
    expect(html).toContain("مسؤول الإرسال");
    expect(html).toContain("مسؤول الاستلام");
    expect(html).toContain("counter(pages)");
  });
});

describe("central kitchen Excel exports", () => {
  it("shows both export actions only inside the existing export-permission boundary", () => {
    const source = readFileSync(new URL("../client/src/components/central-kitchen/kitchen-order-sharing.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/\{canExport && <><Button data-testid="sheet-export-pdf"[\s\S]*?data-testid="sheet-export-excel"[\s\S]*?<\/Button><\/>\}/);
    expect(source).toMatch(/\{canExport && <><Button data-testid="order-export-pdf"[\s\S]*?data-testid="order-export-excel"[\s\S]*?<\/Button><\/>\}/);
    expect(source).toContain('disabled={!!exporting}');
  });
  it("preserves source quantities and lifecycle evidence without filling unknowns", () => {
    const { workbook } = buildKitchenOrderWorkbook(XLSX, {
      orderNumber: "CK-12", status: "received", requestBranchId: "1", centralKitchenId: "2",
      requestBranchName: "=branch", centralKitchenName: "المطبخ", createdAt: "2026-09-22T09:00:00.000Z",
      discrepancyStatus: "open", discrepancyResolutionNotes: null,
      items: [{ productName: "=SUM(1,1)", unit: "كجم", requestedQuantity: 2.5, reportedAvailableQuantity: 0,
        preparedQuantity: 1, substituteProductName: "بديل", substituteQuantity: 0.5,
        dispatchedQuantity: 1.5, receivedQuantity: 1, damagedQuantity: 0.25,
        missingQuantity: null, receivingNotes: "@note" }],
    });
    const meta = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["بيانات الطلب"], { header: 1 });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["بنود الطلب"], { header: 1, defval: "" });
    expect(meta).toContainEqual(["الفرع الطالب", "'=branch"]);
    expect(meta).toContainEqual(["حالة الفروقات", "مفتوحة"]);
    expect(meta.find(row => row[0] === "تاريخ الإنشاء · السعودية")?.[1]).not.toContain("09:00:00.000Z");
    expect(rows[1][0]).toBe("'=SUM(1,1)");
    expect(rows[1][2]).toBe(2.5);
    expect(rows[1][3]).toBe(0);
    expect(rows[1][8]).toBe(1.5);
    expect(rows[1][11]).toBe("");
    expect(rows[1][15]).toBe("'@note");
    expect(workbook.Sheets["بنود الطلب"].A2.f).toBeUndefined();
  });

  it("preserves per-order sheet status and separately tracked original and substitute quantities", () => {
    const { workbook } = buildPreparationSheetWorkbook(XLSX, sheet);
    const orders = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["الطلبات"], { header: 1 });
    const groups = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["التجهيز المجمع"], { header: 1 });
    const details = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["تفاصيل الطلبات"], { header: 1 });
    expect(orders[1]).toContain("تم التجهيز");
    expect(groups[1]).toContain("product:7");
    expect(groups[1]).toContain(2.5);
    expect(groups[1]).toContain(0.5);
    expect(details[1]).toContain("دقيق بديل");
    expect(details[1]).toContain("مشكلة جودة");
    expect(details[1]).toContain("<ملاحظة حساسة>");
    expect((workbook.Sheets["الطلبات"] as any)["!views"]).toEqual([{ rightToLeft: true }]);
  });
});