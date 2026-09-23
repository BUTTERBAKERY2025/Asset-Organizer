import { formatSaudiDateTime, type PreparationSheet } from "./kitchen-order-share-model";

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
const COLORS = { brown: "#704126", orange: "#D9822B", cream: "#FFF7EA", line: "#DEC9B5", ink: "#432B20", muted: "#806D60" };

const tableLayout = {
  fillColor: (rowIndex: number) => rowIndex === 0 ? COLORS.brown : rowIndex % 2 === 0 ? COLORS.cream : null,
  hLineColor: () => COLORS.line,
  vLineColor: () => COLORS.line,
  hLineWidth: (index: number) => index === 0 ? 0 : 0.6,
  vLineWidth: () => 0.6,
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

const headerCell = (text: string) => ({ text, color: "#FFFFFF", bold: true, alignment: "right" });
const cell = (text: string) => ({ text, alignment: "right", color: COLORS.ink });

function fulfillmentDetails(item: PdfOrderItem) {
  return [
    item.dispatchedQuantity != null ? `المرسل: ${quantity(item.dispatchedQuantity, item.unit)}` : null,
    item.receivedQuantity != null ? `المستلم: ${quantity(item.receivedQuantity, item.unit)}` : null,
    item.damagedQuantity != null ? `التالف: ${quantity(item.damagedQuantity, item.unit)}` : null,
    item.missingQuantity != null ? `المفقود: ${quantity(item.missingQuantity, item.unit)}` : null,
  ].filter(Boolean).join("\n") || "—";
}

function itemNotes(item: PdfOrderItem, shortage: number) {
  return [
    item.notes,
    item.preparationNotes,
    shortage > 0 && item.shortageReason ? SHORTAGE_LABELS[item.shortageReason] || item.shortageReason : null,
    item.receivingNotes,
  ].filter(Boolean).join("\n") || "—";
}

function documentHeader(title: string, documentNumber: string, logoDataUri?: string | null) {
  return {
    table: {
      widths: [88, "*", 118],
      body: [[
        logoDataUri ? { image: logoDataUri, width: 76, height: 58, fit: [76, 58], alignment: "left" } : { text: "" },
        { stack: [{ text: title, style: "title" }, { text: "باتر بيكري · المطبخ المركزي", style: "brandLine" }], alignment: "center", margin: [0, 5, 0, 0] },
        { stack: [{ text: "رقم المستند", style: "eyebrow" }, { text: value(documentNumber), bold: true, fontSize: 12, color: COLORS.brown }], alignment: "right", margin: [0, 10, 0, 0] },
      ]],
    },
    layout: { hLineColor: () => COLORS.orange, hLineWidth: (index: number) => index === 1 ? 2 : 0, vLineWidth: () => 0 },
    margin: [0, 0, 0, 14],
  };
}

const metaCell = (label: string, text: unknown) => ({
  stack: [{ text: label, style: "eyebrow" }, { text: value(text), color: COLORS.ink, bold: true, margin: [0, 2, 0, 0] }],
  fillColor: COLORS.cream,
  margin: [4, 4, 4, 4],
});

function footer(documentNumber: string) {
  return (currentPage: number, pageCount: number) => ({
    margin: [32, 7, 32, 0],
    columns: [
      { text: `الصفحة ${currentPage} / ${pageCount}`, alignment: "left", color: COLORS.muted, fontSize: 8 },
      { text: `باتر بيكري · ${value(documentNumber)}`, alignment: "right", color: COLORS.muted, fontSize: 8 },
    ],
  });
}

export function kitchenOrderPdfDefinition(order: PdfKitchenOrder, logoDataUri?: string | null) {
  const items = order.items || [];
  const compact = items.length <= 3;
  const body = compact
    ? [
      ["الصنف", "المطلوب والمتوفر", "التجهيز والبديل والنقص", "ملاحظات وتفاصيل الاستلام"].map(headerCell),
      ...items.map(item => {
        const prepared = Number(item.preparedQuantity || 0);
        const substitute = Number(item.substituteQuantity || 0);
        const shortage = Math.max(0, Number(item.requestedQuantity) - prepared - substitute);
        const preparedText = [
          `الأصلي: ${quantity(prepared, item.unit)}`,
          substitute > 0 ? `البديل: ${quantity(substitute, item.substituteUnit || item.unit)} — ${value(item.substituteProductName)}` : "البديل: —",
          `النقص: ${quantity(shortage, item.unit)}`,
        ].join("\n");
        return [
          { stack: [{ text: value(item.productName), bold: true }, { text: value(item.unit), fontSize: 8, color: COLORS.muted }], alignment: "right" },
          cell(`المطلوب: ${quantity(item.requestedQuantity, item.unit)}\nالمتوفر: ${item.reportedAvailableQuantity == null ? "غير مسجل" : quantity(item.reportedAvailableQuantity, item.unit)}`),
          cell(preparedText),
          cell([itemNotes(item, shortage), fulfillmentDetails(item)].filter(text => text !== "—").join("\n") || "—"),
        ];
      }),
    ]
    : [
      ["الصنف", "المطلوب", "المتوفر بالفرع", "المجهز", "البديل", "النقص", "الملاحظات والاستلام"].map(headerCell),
      ...items.map(item => {
      const prepared = Number(item.preparedQuantity || 0);
      const substitute = Number(item.substituteQuantity || 0);
      const shortage = Math.max(0, Number(item.requestedQuantity) - prepared - substitute);
      return [
        { text: value(item.productName), bold: true, alignment: "right", color: COLORS.ink },
        cell(quantity(item.requestedQuantity, item.unit)),
        cell(item.reportedAvailableQuantity == null ? "غير مسجل" : quantity(item.reportedAvailableQuantity, item.unit)),
        cell(quantity(prepared, item.unit)),
        cell(substitute > 0 ? `${quantity(substitute, item.substituteUnit || item.unit)}\n${value(item.substituteProductName)}` : "—"),
        cell(quantity(shortage, item.unit)),
        cell([itemNotes(item, shortage), fulfillmentDetails(item)].filter(text => text !== "—").join("\n") || "—"),
      ];
      }),
    ];
  return {
    pageSize: "A4",
    pageOrientation: compact ? "portrait" : "landscape",
    pageMargins: [32, 28, 32, 38],
    defaultStyle: { font: "Amiri", fontSize: compact ? 10 : 8.5, alignment: "right", color: COLORS.ink, lineHeight: 1.12 },
    footer: footer(order.orderNumber),
    content: [
      documentHeader("سند طلب المطبخ المركزي", order.orderNumber, logoDataUri),
      {
        table: {
          widths: ["*", "*", "*"],
          body: [
            [metaCell("الحالة", statusLabel(order.status)), metaCell("المطبخ المركزي", order.centralKitchenName || order.centralKitchenId), metaCell("الفرع الطالب", order.requestBranchName || order.requestBranchId)],
            [metaCell("تاريخ ووقت الإنشاء · السعودية", formatSaudiDateTime(order.createdAt)), metaCell("وقت الحاجة", order.neededTime), metaCell("تاريخ الحاجة", order.neededDate)],
          ],
        },
        layout: { hLineColor: () => "#FFFFFF", vLineColor: () => "#FFFFFF", hLineWidth: () => 4, vLineWidth: () => 4 },
        margin: [0, 0, 0, 12],
      },
      ...(order.notes ? [{ stack: [{ text: "ملاحظات الطلب", style: "eyebrow" }, { text: order.notes, margin: [0, 3, 0, 0] }], fillColor: COLORS.cream, margin: [8, 7, 8, 10] }] : []),
      { table: { headerRows: 1, widths: compact ? ["*", 105, 145, 132] : ["*", 54, 66, 52, 82, 45, 122], dontBreakRows: true, body }, layout: tableLayout },
      ...(order.driverName || order.vehicleNumber ? [{ stack: [{ text: "بيانات الإرسال", style: "sectionLabel" }, { text: `السائق: ${value(order.driverName)}   ·   المركبة: ${value(order.vehicleNumber)}` }], margin: [0, 12, 0, 0] }] : []),
      ...(order.discrepancyStatus === "open" || order.discrepancyResolutionNotes ? [{ stack: [{ text: "الفروقات", style: "sectionLabel" }, { text: `${order.discrepancyStatus === "open" ? "مفتوحة" : "تمت المعالجة"} · ${value(order.discrepancyResolutionNotes)}` }], margin: [0, 9, 0, 0] }] : []),
      {
        columns: [
          { stack: [{ text: "\n\n", margin: [0, 16, 0, 0] }, { text: "مسؤول الإرسال", alignment: "center", border: [false, true, false, false] }] },
          { text: "", width: 70 },
          { stack: [{ text: "\n\n", margin: [0, 16, 0, 0] }, { text: "مسؤول التجهيز", alignment: "center", border: [false, true, false, false] }] },
        ],
        unbreakable: true,
        margin: [20, 20, 20, 0],
      },
    ],
    styles: {
      title: { fontSize: 18, bold: true, alignment: "center", color: COLORS.brown },
      brandLine: { fontSize: 9, alignment: "center", color: COLORS.orange, margin: [0, 2, 0, 0] },
      eyebrow: { fontSize: 8, color: COLORS.muted },
      sectionLabel: { fontSize: 9, bold: true, color: COLORS.orange, margin: [0, 0, 0, 2] },
    },
  };
}

export function preparationSheetPdfDefinition(sheet: PreparationSheet, logoDataUri?: string | null) {
  const body = [
    ["الصنف", "الوحدة", "المطلوب", "المعتمد", "الأصلي", "البديل", "لم يُحسم", "نقص فعلي", "تفاصيل الطلبات"].map(headerCell),
    ...sheet.groups.map(group => [
      `${group.productName}\n${group.provenance === "substitute" ? "بديل مجهز" : "صنف أصلي"}`,
      value(group.unit),
      value(group.requestedQuantity),
      value(group.approvedQuantity),
      value(group.preparedQuantity),
      value(group.substitutedQuantity || null),
      value(group.unpreparedQuantity || null),
      value(group.actualShortageQuantity || null),
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
    ]),
  ];
  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 26, 28, 38],
    defaultStyle: { font: "Amiri", fontSize: 8, alignment: "right", color: COLORS.ink },
    footer: footer(`ورقة تجهيز · ${sheet.generatedAt.slice(0, 10)}`),
    content: [
      documentHeader("ورقة التجهيز المجمعة", `${sheet.orders.length} طلبات`, logoDataUri),
      { text: `${sheet.orders.length} طلبات · لقطة ${formatSaudiDateTime(sheet.generatedAt)} بتوقيت السعودية`, alignment: "center", color: COLORS.muted, margin: [0, 0, 0, 10] },
      { text: sheet.orders.map(order => `${order.orderNumber} · ${order.requestBranchName || "—"} · ${statusLabel(order.status)}`).join("\n"), margin: [0, 0, 0, 10] },
      { table: { headerRows: 1, widths: [82, 38, 45, 45, 45, 45, 45, 45, "*"], dontBreakRows: true, body }, layout: tableLayout },
    ],
    styles: {
      title: { fontSize: 18, bold: true, alignment: "center", color: COLORS.brown },
      brandLine: { fontSize: 9, alignment: "center", color: COLORS.orange },
      eyebrow: { fontSize: 8, color: COLORS.muted },
    },
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