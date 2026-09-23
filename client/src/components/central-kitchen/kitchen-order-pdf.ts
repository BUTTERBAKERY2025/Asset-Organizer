import type { PreparationSheet } from "./kitchen-order-share-model";

type PdfOrderItem = {
  productName: string;
  unit: string;
  requestedQuantity: number;
  reportedAvailableQuantity?: number | string | null;
  preparedQuantity?: number | null;
  substituteQuantity?: number | null;
  substituteProductName?: string | null;
  substituteUnit?: string | null;
  shortageReason?: string | null;
  preparationNotes?: string | null;
  notes?: string;
  dispatchedQuantity?: number | null;
  receivedQuantity?: number | null;
  damagedQuantity?: number | null;
  missingQuantity?: number | null;
  receivingNotes?: string | null;
};

export type PdfKitchenOrder = {
  orderNumber: string;
  status: string;
  requestBranchId: string;
  centralKitchenId: string;
  requestBranchName?: string | null;
  centralKitchenName?: string | null;
  neededDate?: string;
  neededTime?: string;
  createdAt: string;
  notes?: string;
  driverName?: string | null;
  vehicleNumber?: string | null;
  discrepancyStatus?: string;
  discrepancyResolutionNotes?: string | null;
  items?: PdfOrderItem[];
};

const STATUS_LABELS: Record<string, string> = {
  cancelled: "ملغي",
  requested: "بانتظار الاعتماد",
  pending: "بانتظار الاعتماد",
  approved: "معتمد",
  prepared: "تم التجهيز",
  dispatched: "في الطريق",
  received: "تم الاستلام",
  draft: "مسودة",
};

const SHORTAGE_LABELS: Record<string, string> = {
  unavailable: "غير متوفر",
  out_of_stock: "نفاد المخزون",
  production_issue: "تعذر الإنتاج",
  quality_issue: "مشكلة جودة",
  other: "سبب آخر",
};

const value = (input: unknown) => input == null || input === "" ? "—" : String(input);
const quantity = (input: unknown, unit: string) => `${value(input)} ${unit}`;
const statusLabel = (status: string) => STATUS_LABELS[status?.toLowerCase().replaceAll(" ", "_")] || value(status);

const tableLayout = {
  fillColor: (rowIndex: number) => rowIndex === 0 ? "#f3f4f6" : null,
  hLineColor: () => "#d8dee9",
  vLineColor: () => "#d8dee9",
};

export function kitchenOrderPdfDefinition(order: PdfKitchenOrder) {
  const body = [
    ["ملاحظات", "النقص", "البديل", "المجهز", "المتوفر في الفرع", "المطلوب", "الصنف"],
    ...(order.items || []).map(item => {
      const prepared = Number(item.preparedQuantity || 0);
      const substitute = Number(item.substituteQuantity || 0);
      const shortage = Math.max(0, Number(item.requestedQuantity) - prepared - substitute);
      return [
        value(item.receivingNotes || item.preparationNotes || (shortage > 0 ? SHORTAGE_LABELS[item.shortageReason || ""] : item.notes)),
        quantity(shortage, item.unit),
        substitute > 0 ? `${quantity(substitute, item.substituteUnit || item.unit)} — ${value(item.substituteProductName)}` : "—",
        quantity(prepared, item.unit),
        item.reportedAvailableQuantity == null ? "غير مسجل" : quantity(item.reportedAvailableQuantity, item.unit),
        quantity(item.requestedQuantity, item.unit),
        value(item.productName),
      ];
    }),
  ];
  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 34, 28, 34],
    defaultStyle: { font: "Amiri", fontSize: 9, alignment: "right" },
    content: [
      { text: "سند طلب المطبخ المركزي", style: "title" },
      { text: value(order.orderNumber), alignment: "center", margin: [0, 2, 0, 14] },
      {
        columns: [
          { text: `الحالة: ${statusLabel(order.status)}` },
          { text: `المطبخ المركزي: ${value(order.centralKitchenName || order.centralKitchenId)}` },
          { text: `الفرع الطالب: ${value(order.requestBranchName || order.requestBranchId)}` },
        ],
        columnGap: 12,
        margin: [0, 0, 0, 8],
      },
      {
        columns: [
          { text: `تاريخ الإنشاء: ${value(order.createdAt)}` },
          { text: `وقت الحاجة: ${value(order.neededTime)}` },
          { text: `تاريخ الحاجة: ${value(order.neededDate)}` },
        ],
        columnGap: 12,
        margin: [0, 0, 0, 10],
      },
      ...(order.notes ? [{ text: `ملاحظات الطلب: ${order.notes}`, margin: [0, 0, 0, 10] }] : []),
      { table: { headerRows: 1, widths: ["*", 48, 90, 58, 70, 62, 95], dontBreakRows: false, body }, layout: tableLayout },
      ...(order.driverName || order.vehicleNumber ? [{ text: `بيانات الإرسال: السائق ${value(order.driverName)} · المركبة ${value(order.vehicleNumber)}`, margin: [0, 12, 0, 0] }] : []),
      ...(order.discrepancyStatus === "open" || order.discrepancyResolutionNotes ? [{ text: `حالة الفروقات: ${order.discrepancyStatus === "open" ? "مفتوحة" : "تمت المعالجة"} · ${value(order.discrepancyResolutionNotes)}`, margin: [0, 8, 0, 0] }] : []),
      { columns: [{ text: "مسؤول الإرسال", alignment: "center" }, { text: "مسؤول التجهيز", alignment: "center" }], margin: [0, 42, 0, 0] },
    ],
    styles: { title: { fontSize: 18, bold: true, alignment: "center" } },
  };
}

export function preparationSheetPdfDefinition(sheet: PreparationSheet) {
  const body = [
    ["تفاصيل الطلبات", "نقص فعلي", "لم يُحسم", "البديل", "الأصلي", "المعتمد", "المطلوب", "الوحدة", "الصنف"],
    ...sheet.groups.map(group => [
      group.orders.map(order => {
        const details = [
          order.orderNumber,
          order.branchName,
          `مطلوب ${order.requestedQuantity}`,
          `أصلي ${order.preparedQuantity}`,
          order.substitutedQuantity ? `بديل ${order.substitutedQuantity} ${order.substituteUnit || group.unit} — ${value(order.substituteProductName)}` : null,
          order.unpreparedQuantity ? `لم يُحسم ${order.unpreparedQuantity}` : null,
          order.actualShortageQuantity ? `نقص فعلي ${order.actualShortageQuantity}` : null,
          order.shortageReason ? SHORTAGE_LABELS[order.shortageReason] || order.shortageReason : null,
          order.preparationNotes,
        ].filter(Boolean);
        return details.join(" · ");
      }).join("\n"),
      value(group.actualShortageQuantity || null),
      value(group.unpreparedQuantity || null),
      value(group.substitutedQuantity || null),
      value(group.preparedQuantity),
      value(group.approvedQuantity),
      value(group.requestedQuantity),
      value(group.unit),
      `${group.productName}\n${group.provenance === "substitute" ? "بديل مجهز" : "صنف أصلي"}`,
    ]),
  ];
  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [24, 30, 24, 30],
    defaultStyle: { font: "Amiri", fontSize: 8, alignment: "right" },
    content: [
      { text: "ورقة التجهيز المجمعة", style: "title" },
      { text: `${sheet.orders.length} طلبات · لقطة ${new Date(sheet.generatedAt).toLocaleString("ar-SA")}`, alignment: "center", margin: [0, 3, 0, 12] },
      { text: sheet.orders.map(order => `${order.orderNumber} · ${order.requestBranchName || "—"} · ${statusLabel(order.status)}`).join("\n"), margin: [0, 0, 0, 10] },
      { table: { headerRows: 1, widths: ["*", 45, 45, 45, 45, 45, 45, 38, 75], dontBreakRows: false, body }, layout: tableLayout },
    ],
    styles: { title: { fontSize: 18, bold: true, alignment: "center" } },
  };
}

let fontPromise: Promise<any> | null = null;

async function configuredPdfMake() {
  if (!fontPromise) {
    fontPromise = Promise.all([
      import("@digicole/pdfmake-rtl/build/pdfmake"),
      import("@digicole/pdfmake-rtl/build/vfs_fonts"),
      fetch("/assets/Amiri-Regular.ttf"),
      fetch("/assets/Amiri-Bold.ttf"),
    ]).then(async ([pdfModule, vfsModule, regular, bold]) => {
      if (!regular.ok || !bold.ok) throw new Error("تعذر تحميل خط PDF العربي");
      const pdfMake = pdfModule.default as any;
      const bundledVfs = (vfsModule.default as any).default || vfsModule.default;
      const virtualFiles = {
        ...bundledVfs,
        "Amiri-Regular.ttf": arrayBufferToBase64(await regular.arrayBuffer()),
        "Amiri-Bold.ttf": arrayBufferToBase64(await bold.arrayBuffer()),
      };
      const amiri = { normal: "Amiri-Regular.ttf", bold: "Amiri-Bold.ttf", italics: "Amiri-Regular.ttf", bolditalics: "Amiri-Bold.ttf" };
      // The RTL fork internally requests Nillima for bidi runs even when the
      // document default is Amiri, so map every fallback to the embedded font.
      const fonts = { Amiri: amiri, Nillima: amiri, Roboto: amiri };
      if (typeof pdfMake.addVirtualFileSystem === "function") pdfMake.addVirtualFileSystem(virtualFiles);
      else pdfMake.vfs = virtualFiles;
      if (typeof pdfMake.setFonts === "function") pdfMake.setFonts(fonts);
      else pdfMake.fonts = fonts;
      return pdfMake;
    }).catch(error => {
      fontPromise = null;
      throw error;
    });
  }
  return fontPromise;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(offset, offset + 0x8000)));
  }
  return btoa(binary);
}

export async function downloadKitchenPdf(definition: unknown, filename: string) {
  const pdfMake = await configuredPdfMake();
  await new Promise<void>((resolve, reject) => {
    try {
      pdfMake.createPdf(definition).download(filename, resolve);
    } catch (error) {
      reject(error);
    }
  });
}