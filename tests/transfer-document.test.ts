import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx-js-style";
import AdmZip from "adm-zip";
import { buildTransferListWorkbook, buildTransferWorkbook } from "../client/src/lib/transfer-export";
import {
  TRANSFER_ITEM_HEADINGS,
  formatTransferDate,
  formatTransferQuantity,
  isSafeSignatureImage,
  mapTransferDocument,
  safeTransferSheetName,
} from "../client/src/lib/transfer-document";

const transfer = {
  id: 7, transferNumber: "TR/7:*?", status: "pending",
  sourceBranchName: "المستودع", destinationBranchName: "الفرع",
  createdByName: "المعد", receivedByName: null,
  receiverSignature: "javascript:alert(1)",
  deliveryNotes: "تم فحص العبوات عند الاستلام",
};
const items = [{
  itemId: 99, itemName: "دقيق", unit: "كجم", quantity: 2.375,
  originalQuantity: 3.5, availableQuantity: null, receivedQuantity: null,
  discrepancy: -1.125, discrepancyNotes: "نقص مسجل", notes: null,
}];

describe("transfer document model", () => {
  it("preserves decimals and does not invent receipt or discrepancy values", () => {
    const document = mapTransferDocument(transfer, items);
    expect(document.items[0]).toMatchObject({
      code: "99", requested: 3.5, sent: 2.375, available: null,
      received: null, discrepancy: -1.125,
    });
    expect(formatTransferQuantity(null)).toBe("—");
    expect(formatTransferQuantity(2.375)).toBe("2.375");
    expect(document.isUnapproved).toBe(true);
    expect(TRANSFER_ITEM_HEADINGS.identifier).toBe("معرّف الصنف");
    expect(TRANSFER_ITEM_HEADINGS.quantity).toBe("كمية التحويل");
    expect(TRANSFER_ITEM_HEADINGS.quantity).not.toContain("المرسل");
  });

  it("only permits bounded image data URLs for signatures", () => {
    expect(isSafeSignatureImage("javascript:alert(1)")).toBe(false);
    expect(isSafeSignatureImage("data:image/png;base64,aGVsbG8=")).toBe(true);
    expect(safeTransferSheetName("'TR/[7]:*?'")).toBe("TR--7----");
  });

  it("formats date-only and timestamps consistently in Saudi time", () => {
    expect(formatTransferDate("2026-09-23")).toBe("23/09/2026");
    expect(formatTransferDate("2025-12-31T22:30:00.000Z", true)).toBe("01/01/2026 01:30");
  });
});

describe("transfer workbook helpers", () => {
  it("creates an RTL formal sheet and keeps quantities numeric", () => {
    const output = buildTransferWorkbook(XLSX, transfer, items);
    expect(output.worksheet["!views"]?.[0]).toMatchObject({ rightToLeft: true });
    expect(output.worksheet["B7"].v).toBe("معرّف الصنف");
    expect(output.worksheet["G7"].v).toBe("كمية التحويل");
    expect(output.worksheet["F8"].t).toBe("n");
    expect(output.worksheet["F8"].v).toBe(3.5);
    expect(output.worksheet["G8"].v).toBe(2.375);
    expect(output.worksheet["H8"].v).toBe("—");
    expect(output.worksheet["I8"].t).toBe("n");
    expect(output.worksheet["I8"].v).toBe(-1.125);
    expect(output.worksheet["J8"].v).toBe("نقص مسجل");
    expect(output.worksheet["A5"].v).toContain("تم فحص العبوات");
    expect(output.worksheet["!merges"]?.length).toBeGreaterThan(0);
  });

  it("serializes the workbook view as right-to-left XML", () => {
    const output = buildTransferWorkbook(XLSX, transfer, items);
    const buffer = XLSX.write(output.workbook, { type: "buffer", bookType: "xlsx" });
    const sheetXml = new AdmZip(buffer).readAsText("xl/worksheets/sheet1.xml");
    expect(sheetXml).toContain('<sheetView workbookViewId="0" rightToLeft="1"/>');
  });

  it("labels list output as a contextual report", () => {
    const output = buildTransferListWorkbook(XLSX, [transfer], "الحالة: معلقة");
    expect(output.worksheet["A1"].v).toContain("تقرير");
    expect(output.worksheet["A2"].v).toContain("الحالة");
    expect(output.worksheet["D2"].v).toContain("1");
  });
});