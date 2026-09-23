import {
  TRANSFER_BRAND,
  TRANSFER_ITEM_HEADINGS,
  TRANSFER_STATUS_LABELS,
  formatTransferDate,
  mapTransferDocument,
  safeTransferFilePart,
  safeTransferSheetName,
  type TransferDocumentInput,
  type TransferDocumentItemInput,
} from "./transfer-document";

type SheetJs = typeof import("xlsx-js-style");

const border = {
  top: { style: "thin", color: { rgb: "D7D2C8" } },
  bottom: { style: "thin", color: { rgb: "D7D2C8" } },
  left: { style: "thin", color: { rgb: "D7D2C8" } },
  right: { style: "thin", color: { rgb: "D7D2C8" } },
};
const titleStyle = {
  font: { name: "Tahoma", sz: 18, bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: TRANSFER_BRAND.dark.slice(1).toUpperCase() } },
  alignment: { horizontal: "center", vertical: "center" },
};
const sectionStyle = {
  font: { name: "Tahoma", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: TRANSFER_BRAND.gold.slice(1).toUpperCase() } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border,
};
const bodyStyle = {
  font: { name: "Tahoma", sz: 10, color: { rgb: "24211D" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border,
};

export function buildTransferWorkbook(XLSX: SheetJs, transfer: TransferDocumentInput, items: TransferDocumentItemInput[]) {
  const doc = mapTransferDocument(transfer, items);
  const rows: any[][] = [
    ["BUTTER | أمر تحويل مواد", "", "", "", "", "", "", "", "", ""],
    [`المرجع: ${doc.reference}`, "", `الحالة: ${doc.statusLabel}`, "", `تاريخ التحويل: ${doc.transferDate}`, "", `تاريخ الإنشاء: ${doc.createdAt}`, "", "", ""],
    [`من: ${doc.source}`, "", "", "", "", `إلى: ${doc.destination}`, "", "", "", ""],
    [`السائق: ${doc.driver || "—"}`, "", `المركبة: ${doc.vehicle || "—"}`, "", `ملاحظات الطلب: ${doc.notes || "—"}`, "", "", "", "", ""],
    [`ملاحظات التسليم: ${doc.deliveryNotes || "—"}`, "", "", "", "", "", "", "", "", ""],
    [],
    ["م", TRANSFER_ITEM_HEADINGS.identifier, "اسم الصنف", "الوحدة", "المتوفر", "المطلوب", TRANSFER_ITEM_HEADINGS.quantity, "المستلم فعلياً", "الفرق", "ملاحظات"],
    ...doc.items.map((item) => [
      item.sequence, item.code, item.name, item.unit,
      item.available ?? "—", item.requested, item.sent, item.received ?? "—",
      item.discrepancy ?? "—", item.notes || "—",
    ]),
    [],
    [`إعداد: ${doc.signatures.preparer.name || "________________"}`, "", "",
      `إرسال: ${doc.signatures.dispatcher.name || "________________"}`, "", "",
      `استلام: ${doc.signatures.receiver.name || "________________"}`, "", "", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } },
    { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } },
    { s: { r: 1, c: 6 }, e: { r: 1, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
    { s: { r: 2, c: 5 }, e: { r: 2, c: 9 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
    { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } },
    { s: { r: 3, c: 4 }, e: { r: 3, c: 9 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 9 } },
  ];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      cell.s = r === 0 ? titleStyle : r === 6 ? sectionStyle : {
        ...bodyStyle,
        fill: r > 6 && r < 7 + doc.items.length && r % 2
          ? { fgColor: { rgb: "F7F3EA" } } : undefined,
      };
    }
  }
  ws["!cols"] = [{ wch: 5 }, { wch: 15 }, { wch: 28 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 15 }, { wch: 11 }, { wch: 26 }];
  const requestNotesHeight = 24 + Math.ceil((doc.notes?.length || 1) / 70) * 15;
  const deliveryNotesHeight = 24 + Math.ceil((doc.deliveryNotes?.length || 1) / 110) * 15;
  ws["!rows"] = [
    { hpt: 30 }, { hpt: 24 }, { hpt: 24 },
    { hpt: Math.min(300, requestNotesHeight) },
    { hpt: Math.min(300, deliveryNotesHeight) },
    { hpt: 8 }, { hpt: 28 },
  ];
  (ws as any)["!views"] = [{ rightToLeft: true }];
  const wb = XLSX.utils.book_new();
  (wb as any).Workbook = { ...((wb as any).Workbook || {}), Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, safeTransferSheetName(doc.reference));
  return { workbook: wb, filename: `${safeTransferFilePart(doc.reference)}.xlsx`, worksheet: ws };
}

export function buildTransferListWorkbook(XLSX: SheetJs, transfers: TransferDocumentInput[], context: string) {
  const rows: any[][] = [
    ["BUTTER | تقرير طلبات تحويل المواد", "", "", "", "", "", "", "", ""],
    [`السياق: ${context}`, "", "", `عدد الطلبات: ${transfers.length}`, "", "", `تاريخ التقرير: ${formatTransferDate(new Date(), true)}`, "", ""],
    ["رقم التحويل", "من", "إلى", "الحالة", "السائق", "المركبة", "تاريخ التحويل", "ملاحظات", "أنشأه"],
    ...transfers.map((t) => [
      t.transferNumber, t.sourceBranchName || "المستودع الرئيسي", t.destinationBranchName || "—",
      TRANSFER_STATUS_LABELS[t.status] || t.status, t.driverName || "—", t.vehicleNumber || "—",
      formatTransferDate(t.transferDate), t.notes || "—", t.createdByName || "—",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }];
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = 0; r <= range.e.r; r++) for (let c = 0; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell) cell.s = r === 0 ? titleStyle : r === 2 ? sectionStyle : { ...bodyStyle, fill: r > 2 && r % 2 ? { fgColor: { rgb: "F7F3EA" } } : undefined };
  }
  ws["!cols"] = [{ wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 15 }, { wch: 16 }, { wch: 28 }, { wch: 18 }];
  (ws as any)["!views"] = [{ rightToLeft: true }];
  const wb = XLSX.utils.book_new();
  (wb as any).Workbook = { ...((wb as any).Workbook || {}), Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, "تقرير التحويلات");
  return { workbook: wb, filename: `تقرير-تحويلات-${new Date().toISOString().slice(0, 10)}.xlsx`, worksheet: ws };
}