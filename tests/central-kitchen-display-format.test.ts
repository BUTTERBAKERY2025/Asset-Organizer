import { describe, expect, it } from "vitest";
import {
  formatKitchenNumber,
  formatKitchenSaudiDateTime,
} from "../client/src/components/central-kitchen/display-format";
import {
  formatSaudiDateTime,
  preparationSheetPrintHtml,
  type PreparationSheet,
} from "../client/src/components/central-kitchen/kitchen-order-share-model";
import { preparationSheetPdfDefinition } from "../client/src/components/central-kitchen/kitchen-order-pdf";

const ARABIC_DIGITS = /[٠-٩]/;

const sheet: PreparationSheet = {
  generatedAt: "2025-01-02T21:04:00.000Z",
  snapshotStatus: "current_at_generation",
  orders: [{ id: 1, orderNumber: "CK-123", status: "approved", requestBranchName: "الفرع" }],
  groups: [{
    identity: "product:1",
    provenance: "original",
    productName: "منتج",
    unit: "كجم",
    requestedQuantity: 1234.5,
    approvedQuantity: 1234.5,
    preparedQuantity: 1200.25,
    substitutedQuantity: 10,
    actualShortageQuantity: 4.25,
    unpreparedQuantity: 20,
    orders: [{
      id: 1,
      orderNumber: "CK-123",
      branchName: "الفرع",
      requestedQuantity: 1234.5,
      preparedQuantity: 1200.25,
      substitutedQuantity: 10,
      substituteProductName: "بديل",
      substituteUnit: "كجم",
      substituteIdentity: "product:2",
      actualShortageQuantity: 4.25,
      unpreparedQuantity: 20,
      shortageReason: "unavailable",
      preparationNotes: null,
    }],
  }],
};

describe("central kitchen Western-digit display contract", () => {
  it("formats quantities, percentages, currency and Saudi Gregorian dates with Latin digits", () => {
    const values = [
      formatKitchenNumber(1234.5),
      formatKitchenNumber(12.5, { style: "percent" }),
      formatKitchenNumber(1234.5, { style: "currency", currency: "SAR" }),
      formatKitchenSaudiDateTime(sheet.generatedAt),
      formatSaudiDateTime(sheet.generatedAt),
    ];

    expect(values.join(" ")).not.toMatch(ARABIC_DIGITS);
    expect(values[0]).toBe("1,234.5");
    expect(values[3]).toMatch(/2025/);
  });

  it("keeps print and PDF generated numeric strings free of Arabic-Indic digits", () => {
    const html = preparationSheetPrintHtml(sheet);
    const pdf = preparationSheetPdfDefinition(sheet) as any;
    const footerText = JSON.stringify(pdf.footer(2, 12));
    const generated = `${html}\n${JSON.stringify(pdf.content)}\n${footerText}`;

    expect(generated).not.toMatch(ARABIC_DIGITS);
    expect(generated).toContain("1,234.5");
    expect(footerText).toContain("2 / 12");
  });
});