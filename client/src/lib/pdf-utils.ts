import type { MaterialTransfer, MaterialTransferItem } from "@shared/schema";
import {
  TRANSFER_BRAND,
  TRANSFER_ITEM_HEADINGS,
  formatTransferQuantity,
  mapTransferDocument,
  safeTransferFilePart,
} from "./transfer-document";

let pdfMake: any = null;
let amiriFontLoaded = false;
let cachedLogoBase64: string | null = null;

async function getPdfMake() {
  if (pdfMake) return pdfMake;
  const [pdfModule, vfsModule] = await Promise.all([
    import("@digicole/pdfmake-rtl/build/pdfmake"),
    import("@digicole/pdfmake-rtl/build/vfs_fonts"),
  ]);
  pdfMake = pdfModule.default as any;
  const vfs = vfsModule.default as any;
  pdfMake.vfs = vfs.default || vfs;
  pdfMake.fonts = {
    Nillima: { normal: 'Nillima.ttf', bold: 'Nillima.ttf', italics: 'Nillima.ttf', bolditalics: 'Nillima.ttf' },
    Roboto: { normal: 'Nillima.ttf', bold: 'Nillima.ttf', italics: 'Nillima.ttf', bolditalics: 'Nillima.ttf' },
  };
  return pdfMake;
}

async function loadAmiriFont(): Promise<void> {
  if (amiriFontLoaded) return;
  const pm = await getPdfMake();
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch('/assets/Amiri-Regular.ttf'),
      fetch('/assets/Amiri-Bold.ttf')
    ]);
    if (regularRes.ok && boldRes.ok) {
      const [regularBlob, boldBlob] = await Promise.all([regularRes.blob(), boldRes.blob()]);
      const [regularBase64, boldBase64] = await Promise.all([
        blobToBase64(regularBlob),
        blobToBase64(boldBlob)
      ]);
      pm.vfs['Amiri-Regular.ttf'] = regularBase64.split(',')[1];
      pm.vfs['Amiri-Bold.ttf'] = boldBase64.split(',')[1];
      pm.fonts = {
        Amiri: { normal: 'Amiri-Regular.ttf', bold: 'Amiri-Bold.ttf', italics: 'Amiri-Regular.ttf', bolditalics: 'Amiri-Bold.ttf' },
        Nillima: { normal: 'Nillima.ttf', bold: 'Nillima.ttf', italics: 'Nillima.ttf', bolditalics: 'Nillima.ttf' },
        Roboto: { normal: 'Nillima.ttf', bold: 'Nillima.ttf', italics: 'Nillima.ttf', bolditalics: 'Nillima.ttf' },
      };
      amiriFontLoaded = true;
    }
  } catch (e) {
    console.warn('Failed to load Amiri font, using default');
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function getLogoBase64(): Promise<string | null> {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const response = await fetch('/assets/logo.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result as string;
        resolve(cachedLogoBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export type MaterialTransferWithNames = MaterialTransfer & {
  sourceBranchName?: string | null;
  destinationBranchName?: string | null;
};

export type TransferItemWithAvailable = MaterialTransferItem & {
  availableQuantity?: number | null;
};

export async function generateTransferPdf(
  transfer: MaterialTransferWithNames,
  items: TransferItemWithAvailable[],
): Promise<void> {
  if (!items.length) throw new Error("لا توجد أصناف في التحويل لإنشاء المستند");
  const pm = await getPdfMake();
  await loadAmiriFont();
  const logo = await getLogoBase64();
  const doc = mapTransferDocument(transfer, items);
  const cell = (text: unknown, options: Record<string, unknown> = {}) => ({
    text: text == null || text === "" ? "—" : String(text), margin: [2, 4, 2, 4], fontSize: 8, ...options,
  });
  const header = (text: string) => cell(text, { bold: true, color: "#ffffff", fillColor: TRANSFER_BRAND.dark, alignment: "center" });
  const signature = (label: string, sig: { name: string | null; image: string | null }) => ({
    stack: [
      { text: label, bold: true, alignment: "center", fontSize: 9 },
      { text: sig.name || "الاسم: __________________", alignment: "center", fontSize: 8, margin: [0, 4, 0, 3] },
      ...(sig.image ? [{ image: sig.image, fit: [100, 38], alignment: "center" }] : [{ text: "التوقيع: __________________", alignment: "center", margin: [0, 18, 0, 0], fontSize: 8 }]),
    ], margin: [3, 5, 3, 5],
  });
  const definition = {
    pageSize: "A4",
    pageMargins: [24, 28, 24, 34],
    footer: (page: number, pages: number) => ({ text: `صفحة ${page} من ${pages}`, alignment: "center", fontSize: 8, color: "#777777", margin: [0, 8, 0, 0] }),
    watermark: doc.isUnapproved ? { text: "مسودة — غير معتمد", color: "#b58a3a", opacity: 0.1, bold: true } : undefined,
    content: [
      { columns: [
        logo ? { image: logo, fit: [62, 62], width: 75 } : { text: "BUTTER", bold: true, width: 75 },
        { stack: [{ text: "BUTTER", bold: true, fontSize: 15, characterSpacing: 2, alignment: "center" }, { text: "أمر تحويل مواد", bold: true, fontSize: 18, alignment: "center" }], width: "*" },
        { stack: [{ text: `المرجع: ${doc.reference}` }, { text: `الحالة: ${doc.statusLabel}`, bold: true }, { text: `التاريخ: ${doc.transferDate}` }], width: 135, fontSize: 8, alignment: "right" },
      ].reverse(), margin: [0, 0, 0, 6] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 547, y2: 0, lineWidth: 3, lineColor: TRANSFER_BRAND.gold }], margin: [0, 0, 0, 10] },
      { table: { widths: ["*", "*"], body: [
        [cell("جهة الاستلام", { color: "#777777" }), cell("جهة الإرسال", { color: "#777777" })],
        [cell(doc.destination, { bold: true, fontSize: 11 }), cell(doc.source, { bold: true, fontSize: 11 })],
      ] }, layout: { fillColor: (r: number) => r === 0 ? TRANSFER_BRAND.pale : null, hLineColor: () => "#d7d2c8", vLineColor: () => "#d7d2c8" }, margin: [0, 0, 0, 8] },
      ...(doc.driver || doc.vehicle ? [{ table: { widths: ["*", "*"], body: [[cell(`السائق: ${doc.driver || "—"}`), cell(`المركبة: ${doc.vehicle || "—"}`)]] }, layout: "lightHorizontalLines", margin: [0, 0, 0, 8] }] : []),
      { table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: [18, 31, "*", 31, 34, 34, 34, 34, 31, 52].reverse(),
        body: [
          ["م", TRANSFER_ITEM_HEADINGS.identifier, "اسم الصنف", "الوحدة", "المتوفر", "المطلوب", TRANSFER_ITEM_HEADINGS.quantity, "المستلم", "الفرق", "ملاحظات"].reverse().map(header),
          ...doc.items.map((item, index) => [
            item.sequence, item.code, item.name, item.unit,
            formatTransferQuantity(item.available), formatTransferQuantity(item.requested), formatTransferQuantity(item.sent),
            formatTransferQuantity(item.received), formatTransferQuantity(item.discrepancy), item.notes || "—",
          ].reverse().map((value) => cell(value, { alignment: "center", fillColor: index % 2 ? TRANSFER_BRAND.pale : "#ffffff" }))),
        ],
      }, layout: { hLineColor: () => "#d7d2c8", vLineColor: () => "#d7d2c8", hLineWidth: () => 0.5, vLineWidth: () => 0.5 }, margin: [0, 0, 0, 10] },
      ...(doc.notes || doc.deliveryNotes ? [{ text: [{ text: "ملاحظات: ", bold: true }, [doc.notes, doc.deliveryNotes].filter(Boolean).join(" — ")], fillColor: TRANSFER_BRAND.pale, margin: [5, 7, 5, 7], fontSize: 9 }] : []),
      { unbreakable: true, table: { widths: ["*", "*", "*"], body: [[
        signature("استلام", doc.signatures.receiver), signature("إرسال", doc.signatures.dispatcher), signature("إعداد", doc.signatures.preparer),
      ]] }, layout: { hLineColor: () => "#b58a3a", vLineColor: () => "#d7d2c8" }, margin: [0, 12, 0, 0] },
    ],
    defaultStyle: { font: amiriFontLoaded ? "Amiri" : "Nillima", alignment: "right" },
  };
  pm.createPdf(definition as any).download(`${safeTransferFilePart(transfer.transferNumber)}.pdf`);
}

export async function generateQuickTransferPdf(transfer: MaterialTransferWithNames): Promise<void> {
  const response = await fetch(`/api/warehouse/material-transfers/${transfer.id}/items`, { credentials: "include" });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`تعذر تحميل أصناف التحويل (${response.status})${message ? `: ${message}` : ""}`);
  }
  const items = await response.json();
  if (!Array.isArray(items)) throw new Error("استجابة أصناف التحويل غير صالحة");
  return generateTransferPdf(transfer, items);
}
