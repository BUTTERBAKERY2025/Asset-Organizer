import { escapePrintHtml, formatSaudiDateTime, type PreparationSheet } from "./kitchen-order-share-model";
import { formatKitchenNumber } from "./display-format";

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
const quantity = (input: unknown, unit: string) => `${typeof input === "number" || (typeof input === "string" && input.trim() !== "" && Number.isFinite(Number(input))) ? formatKitchenNumber(input as number | string) : value(input)} ${unit}`;
const statusLabel = (status: string) => STATUS_LABELS[status?.toLowerCase().replaceAll(" ", "_")] || value(status);
const COLORS = { brown: "#5E3A28", orange: "#D9822B", cream: "#FAFAF9", line: "#D6D3D1", ink: "#292524", muted: "#78716C" };

const tableLayout = {
  fillColor: (rowIndex: number) => rowIndex === 0 ? "#F1F1F0" : null,
  hLineColor: () => COLORS.line,
  vLineColor: () => COLORS.line,
  hLineWidth: () => 0.45,
  vLineWidth: () => 0.45,
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

const headerCell = (text: string) => ({ text, color: COLORS.ink, bold: true, alignment: "center", fontSize: 8.5 });
const cell = (text: string) => ({ text, alignment: "right", color: COLORS.ink });

function itemNotes(item: PdfOrderItem, shortage: number) {
  return [
    item.notes ? `ملاحظة الصنف: ${item.notes}` : null,
    item.preparationNotes ? `ملاحظة التجهيز: ${item.preparationNotes}` : null,
    shortage > 0 && item.shortageReason ? `سبب النقص: ${SHORTAGE_LABELS[item.shortageReason] || item.shortageReason}` : null,
    item.dispatchedQuantity != null ? `المرسل: ${quantity(item.dispatchedQuantity, item.unit)}` : null,
    item.receivedQuantity != null ? `المستلم: ${quantity(item.receivedQuantity, item.unit)}` : null,
    item.damagedQuantity != null ? `التالف: ${quantity(item.damagedQuantity, item.unit)}` : null,
    item.missingQuantity != null ? `المفقود: ${quantity(item.missingQuantity, item.unit)}` : null,
    item.receivingNotes ? `ملاحظة الاستلام: ${item.receivingNotes}` : null,
  ].filter(Boolean).join(" · ") || "—";
}

function documentHeader(title: string, documentNumber: string, logoDataUri?: string | null, compact = false) {
  return {
    table: {
      widths: compact ? [72, "*", 205] : [88, "*", 118],
      body: [[
        logoDataUri ? compact
          ? { image: logoDataUri, cover: { width: 72, height: 40, align: "center", valign: "center" }, alignment: "left" }
          : { image: logoDataUri, fit: [76, 58], alignment: "left" }
          : { text: "" },
        { stack: [{ text: title, style: "title" }, { text: "Butter Bakery · باتر بيكري", style: "brandLine" }], alignment: "center", margin: [0, compact ? 1 : 5, 0, 0] },
        { stack: [{ text: "رقم المستند", style: "eyebrow" }, { text: value(documentNumber), bold: true, fontSize: compact ? 10 : 12, color: COLORS.brown, noWrap: true }], alignment: "right", margin: [0, compact ? 2 : 10, 0, 0], fillColor: compact ? "#FAFAF9" : undefined },
      ]],
    },
    layout: { hLineColor: () => COLORS.orange, hLineWidth: (index: number) => index === 1 ? 1.25 : 0, vLineWidth: () => 0 },
    margin: [0, 0, 0, compact ? 5 : 14],
  };
}

const metaCell = (label: string, text: unknown) => ({
  stack: [{ text: label, style: "eyebrow" }, { text: value(text), color: COLORS.ink, bold: true, margin: [0, 2, 0, 0] }],
  fillColor: "#FAFAF9",
  margin: [3, 2, 3, 2],
});

function footer(documentNumber: string) {
  return (currentPage: number, pageCount: number) => ({
    margin: [32, 7, 32, 0],
    columns: [
      { text: `الصفحة ${formatKitchenNumber(currentPage)} / ${formatKitchenNumber(pageCount)}`, alignment: "left", color: COLORS.muted, fontSize: 8 },
      { text: `باتر بيكري · ${value(documentNumber)}`, alignment: "right", color: COLORS.muted, fontSize: 8 },
    ],
  });
}

export function kitchenOrderPdfDefinition(order: PdfKitchenOrder, logoDataUri?: string | null) {
  const items = order.items || [];
  const itemHeader = ["م", "الصنف", "الوحدة", "المطلوب", "المتوفر", "المجهز", "النقص", "البديل", "الملاحظات"].map(headerCell);
  const itemRows = items.map((item, index) => {
      const prepared = Number(item.preparedQuantity || 0);
      const substitute = Number(item.substituteQuantity || 0);
      const shortage = Math.max(0, Number(item.requestedQuantity) - prepared - substitute);
      return [
        { text: formatKitchenNumber(index + 1), alignment: "center", noWrap: true },
        { text: value(item.productName), bold: true, alignment: "right", color: COLORS.ink },
        { text: value(item.unit), alignment: "center" },
        { text: formatKitchenNumber(item.requestedQuantity), alignment: "center" },
        { text: item.reportedAvailableQuantity == null ? "غير مسجل" : formatKitchenNumber(item.reportedAvailableQuantity), alignment: "center" },
        { text: formatKitchenNumber(prepared), alignment: "center" },
        { text: formatKitchenNumber(shortage), alignment: "center" },
        cell(substitute > 0 ? `${value(item.substituteProductName)}\n${quantity(substitute, item.substituteUnit || item.unit)}` : "—"),
        { ...cell(itemNotes(item, shortage)), fontSize: 9, lineHeight: 1.02 },
      ];
    });
  const closingRowCount = Math.min(2, itemRows.length);
  const mainRows = itemRows.slice(0, itemRows.length - closingRowCount);
  const closingRows = itemRows.slice(itemRows.length - closingRowCount);
  const operationalText = [
    order.driverName || order.vehicleNumber ? `بيانات الإرسال — السائق: ${value(order.driverName)} · المركبة: ${value(order.vehicleNumber)}` : null,
    order.discrepancyStatus === "open" || order.discrepancyResolutionNotes ? `الفروقات — ${order.discrepancyStatus === "open" ? "مفتوحة" : "تمت المعالجة"} · ${value(order.discrepancyResolutionNotes)}` : null,
  ].filter(Boolean).join("\n");
  const signatures = {
    table: {
      widths: ["*", "*", "*"],
      body: [[
        { stack: [{ text: "مسؤول الاستلام", bold: true }, { text: "الاسم: ____________________\nالتوقيع: __________________\nالتاريخ: __________________", margin: [0, 3, 0, 0] }] },
        { stack: [{ text: "مسؤول الإرسال", bold: true }, { text: "الاسم: ____________________\nالتوقيع: __________________\nالتاريخ: __________________", margin: [0, 3, 0, 0] }] },
        { stack: [{ text: "مسؤول التجهيز", bold: true }, { text: "الاسم: ____________________\nالتوقيع: __________________\nالتاريخ: __________________", margin: [0, 3, 0, 0] }] },
      ]],
    },
    layout: { hLineColor: () => COLORS.line, vLineColor: () => COLORS.line, hLineWidth: () => 0.5, vLineWidth: () => 0.5, paddingLeft: () => 7, paddingRight: () => 7, paddingTop: () => 5, paddingBottom: () => 5 },
    margin: [0, 8, 0, 0],
  };
  return {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [25, 69, 25, 31],
    defaultStyle: { font: "Amiri", fontSize: 9, alignment: "right", color: COLORS.ink, lineHeight: 1.04 },
    header: () => ({ ...documentHeader("سند طلب المطبخ المركزي", order.orderNumber, logoDataUri, true), margin: [25, 14, 25, 0] }),
    footer: footer(order.orderNumber),
    content: [
      {
        table: {
          widths: ["*", "*", "*"],
          body: [
            [metaCell("الحالة", statusLabel(order.status)), metaCell("المطبخ المركزي", order.centralKitchenName || order.centralKitchenId), metaCell("الفرع الطالب", order.requestBranchName || order.requestBranchId)],
            [metaCell("تاريخ ووقت الإنشاء · السعودية", formatSaudiDateTime(order.createdAt)), metaCell("وقت الحاجة", order.neededTime), metaCell("تاريخ الحاجة", order.neededDate)],
          ],
        },
        layout: { hLineColor: () => "#FFFFFF", vLineColor: () => "#FFFFFF", hLineWidth: () => 4, vLineWidth: () => 4 },
        margin: [0, 0, 0, 6],
      },
      ...(order.notes ? [{ columns: [{ text: "ملاحظات الطلب", style: "eyebrow", width: 72 }, { text: order.notes }], fillColor: COLORS.cream, margin: [5, 4, 5, 6] }] : []),
      ...(mainRows.length ? [{ table: { headerRows: 1, widths: [22, 120, 38, 45, 50, 45, 42, 85, "*"], dontBreakRows: true, body: [itemHeader, ...mainRows] }, layout: tableLayout }] : []),
      {
        stack: [
          { table: { headerRows: 1, widths: [22, 120, 38, 45, 50, 45, 42, 85, "*"], dontBreakRows: true, body: [itemHeader, ...closingRows] }, layout: tableLayout },
          ...(operationalText ? [{ text: operationalText, margin: [3, 6, 3, 0], fontSize: 8.5 }] : []),
          signatures,
        ],
        unbreakable: true,
      },
    ],
    styles: {
      title: { fontSize: 14, bold: true, alignment: "center", color: COLORS.brown },
      brandLine: { fontSize: 8, alignment: "center", color: COLORS.orange, margin: [0, 1, 0, 0] },
      eyebrow: { fontSize: 7.5, color: COLORS.muted },
      sectionLabel: { fontSize: 9, bold: true, color: COLORS.orange, margin: [0, 0, 0, 2] },
    },
  };
}

export function kitchenOrderPrintHtml(order: PdfKitchenOrder, logoDataUri?: string | null) {
  const escape = escapePrintHtml;
  const items = order.items || [];
  const rows = items.map((item, index) => {
    const prepared = Number(item.preparedQuantity || 0);
    const substitute = Number(item.substituteQuantity || 0);
    const shortage = Math.max(0, Number(item.requestedQuantity) - prepared - substitute);
    const notes = [
      item.notes ? `ملاحظة الصنف: ${item.notes}` : null,
      item.preparationNotes ? `ملاحظة التجهيز: ${item.preparationNotes}` : null,
      shortage > 0 && item.shortageReason ? `سبب النقص: ${SHORTAGE_LABELS[item.shortageReason] || item.shortageReason}` : null,
      item.dispatchedQuantity != null ? `المرسل: ${quantity(item.dispatchedQuantity, item.unit)}` : null,
      item.receivedQuantity != null ? `المستلم: ${quantity(item.receivedQuantity, item.unit)}` : null,
      item.damagedQuantity != null ? `التالف: ${quantity(item.damagedQuantity, item.unit)}` : null,
      item.missingQuantity != null ? `المفقود: ${quantity(item.missingQuantity, item.unit)}` : null,
      item.receivingNotes ? `ملاحظة الاستلام: ${item.receivingNotes}` : null,
    ].filter(Boolean).map(escape).join(" · ");
    const substituteText = substitute > 0
      ? `${escape(item.substituteProductName)}<small>${escape(quantity(substitute, item.substituteUnit || item.unit))}</small>`
      : "—";
    return `<tr>
      <td class="number">${escape(formatKitchenNumber(index + 1))}</td>
      <td class="item">${escape(item.productName)}</td>
      <td class="center">${escape(item.unit)}</td>
      <td class="number">${escape(formatKitchenNumber(item.requestedQuantity))}</td>
      <td class="number">${item.reportedAvailableQuantity == null ? "غير مسجل" : escape(formatKitchenNumber(item.reportedAvailableQuantity))}</td>
      <td class="number">${escape(formatKitchenNumber(prepared))}</td>
      <td class="number">${escape(formatKitchenNumber(shortage))}</td>
      <td>${substituteText}</td>
      <td class="notes">${notes || "—"}</td>
    </tr>`;
  }).join("");
  const operationalNotes = [
    order.driverName || order.vehicleNumber
      ? `بيانات الإرسال — السائق: ${value(order.driverName)} · المركبة: ${value(order.vehicleNumber)}`
      : null,
    order.discrepancyStatus === "open" || order.discrepancyResolutionNotes
      ? `الفروقات — ${order.discrepancyStatus === "open" ? "مفتوحة" : "تمت المعالجة"} · ${value(order.discrepancyResolutionNotes)}`
      : null,
  ].filter(Boolean).map(escape).join("<br>");
  const logo = logoDataUri ? `<img src="${escape(logoDataUri)}" alt="Butter Bakery">` : "";
  const signature = (title: string) => `<div class="signature"><strong>${title}</strong><span>الاسم: ____________________</span><span>التوقيع: __________________</span><span>التاريخ: __________________</span></div>`;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>سند طلب المطبخ المركزي ${escape(order.orderNumber)}</title><style>
html,body{display:block!important;height:auto!important;margin:0}*{box-sizing:border-box}body{font-family:Arial,"Segoe UI",sans-serif;color:#292524;font-size:9.5pt;line-height:1.28}
.page-wrap{width:100%;border-collapse:collapse}.page-wrap>thead>tr>th,.page-wrap>tbody>tr>td{border:0;padding:0;background:transparent}.page-wrap>thead{display:table-header-group}.page-wrap>tbody>tr{break-inside:auto!important;page-break-inside:auto!important}
.running-header{display:grid;grid-template-columns:82px 1fr 205px;direction:ltr;align-items:center;border-bottom:1.5px solid #d9822b;padding:0 0 4px;margin-bottom:6px}.running-header img{width:72px;height:40px;object-fit:cover;object-position:center}.heading{direction:rtl;text-align:center}.heading h1{font-size:14pt;color:#5e3a28;margin:0}.heading p{font-size:8pt;color:#d9822b;margin:1px 0 0}.document-number{direction:rtl;text-align:right;background:#fafaf9;padding:4px 7px;white-space:nowrap}.document-number small{display:block;color:#78716c;font-size:7pt}.document-number b{direction:ltr;unicode-bidi:embed;display:block;font-size:10pt;color:#5e3a28}
.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:6px}.meta div{background:#fafaf9;border:1px solid #e7e5e4;padding:4px 6px;min-height:34px}.meta small{display:block;color:#78716c;font-size:7pt;margin-bottom:1px}.order-note{display:grid;grid-template-columns:80px 1fr;background:#fafaf9;border-right:2px solid #d9822b;padding:5px 7px;margin-bottom:6px}.order-note small{color:#78716c}
.items{width:100%;border-collapse:collapse;table-layout:fixed}.items thead{display:table-header-group}.items tr{break-inside:avoid;page-break-inside:avoid}.items th,.items td{border:.5px solid #d6d3d1;padding:3px 4px;text-align:right;vertical-align:top;overflow-wrap:break-word}.items th{background:#f1f1f0;font-weight:700;text-align:center;font-size:8.5pt}.items td{font-size:9pt;line-height:1.18}.items .center,.items .number{text-align:center}.items .number{direction:ltr;font-variant-numeric:tabular-nums}.items .item{font-weight:700}.items small{display:block;color:#78716c;margin-top:1px}.items .notes{font-size:9pt;line-height:1.16}
.operational{font-size:8.5pt;margin:6px 3px 0}.signatures{display:grid;grid-template-columns:repeat(3,1fr);break-inside:avoid;page-break-inside:avoid;margin-top:8px;border:.5px solid #d6d3d1}.signature{padding:6px 8px;border-left:.5px solid #d6d3d1;min-height:66px}.signature:last-child{border-left:0}.signature strong,.signature span{display:block}.signature span{margin-top:3px}
.footer{position:fixed;bottom:-8mm;left:0;right:0;display:flex;justify-content:space-between;color:#78716c;font-size:8pt}.page-number:after{content:"الصفحة " counter(page) " / " counter(pages)}
@page{size:A4 landscape;margin:11mm 9mm 14mm}@media print{body{padding:0}}
</style></head><body><table class="page-wrap"><thead><tr><th><header class="running-header">${logo}<div class="heading"><h1>سند طلب المطبخ المركزي</h1><p>Butter Bakery · باتر بيكري</p></div><div class="document-number"><small>رقم المستند</small><b>${escape(order.orderNumber)}</b></div></header></th></tr></thead><tbody><tr><td>
<section class="meta"><div><small>الفرع الطالب</small><b>${escape(order.requestBranchName || order.requestBranchId)}</b></div><div><small>المطبخ المركزي</small><b>${escape(order.centralKitchenName || order.centralKitchenId)}</b></div><div><small>الحالة</small><b>${escape(statusLabel(order.status))}</b></div><div><small>تاريخ الحاجة</small><b>${escape(order.neededDate)} · ${escape(order.neededTime)}</b></div><div><small>تاريخ الإنشاء · السعودية</small><b>${escape(formatSaudiDateTime(order.createdAt))}</b></div><div><small>عدد البنود</small><b>${escape(formatKitchenNumber(items.length))}</b></div></section>
${order.notes ? `<section class="order-note"><small>ملاحظات الطلب</small><span>${escape(order.notes)}</span></section>` : ""}
<table class="items"><colgroup><col style="width:3%"><col style="width:16%"><col style="width:5%"><col style="width:6%"><col style="width:7%"><col style="width:6%"><col style="width:5%"><col style="width:11%"><col style="width:41%"></colgroup><thead><tr><th>م</th><th>الصنف</th><th>الوحدة</th><th>المطلوب</th><th>المتوفر</th><th>المجهز</th><th>النقص</th><th>البديل</th><th>الملاحظات</th></tr></thead><tbody>${rows}</tbody></table>
${operationalNotes ? `<section class="operational">${operationalNotes}</section>` : ""}
<section class="signatures">${signature("مسؤول الاستلام")}${signature("مسؤول الإرسال")}${signature("مسؤول التجهيز")}</section>
</td></tr></tbody></table><footer class="footer"><span class="page-number"></span><span>Butter Bakery · ${escape(order.orderNumber)}</span></footer><script>window.onload=()=>window.print()<\/script></body></html>`;
}

export function preparationSheetPdfDefinition(sheet: PreparationSheet, logoDataUri?: string | null) {
  const body = [
    ["الصنف", "الوحدة", "المطلوب", "المعتمد", "الأصلي", "البديل", "لم يُحسم", "نقص فعلي", "تفاصيل الطلبات"].map(headerCell),
    ...sheet.groups.map(group => [
      `${group.productName}\n${group.provenance === "substitute" ? "بديل مجهز" : "صنف أصلي"}`,
      value(group.unit),
      formatKitchenNumber(group.requestedQuantity),
      formatKitchenNumber(group.approvedQuantity),
      formatKitchenNumber(group.preparedQuantity),
      group.substitutedQuantity ? formatKitchenNumber(group.substitutedQuantity) : "—",
      group.unpreparedQuantity ? formatKitchenNumber(group.unpreparedQuantity) : "—",
      group.actualShortageQuantity ? formatKitchenNumber(group.actualShortageQuantity) : "—",
      group.orders.map(order => {
        const details = [
          order.orderNumber,
          order.branchName,
          `مطلوب ${formatKitchenNumber(order.requestedQuantity)}`,
          `أصلي ${formatKitchenNumber(order.preparedQuantity)}`,
          order.substitutedQuantity ? `بديل ${formatKitchenNumber(order.substitutedQuantity)} ${order.substituteUnit || group.unit} — ${value(order.substituteProductName)}` : null,
          order.unpreparedQuantity ? `لم يُحسم ${formatKitchenNumber(order.unpreparedQuantity)}` : null,
          order.actualShortageQuantity ? `نقص فعلي ${formatKitchenNumber(order.actualShortageQuantity)}` : null,
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
      documentHeader("ورقة التجهيز المجمعة", `${formatKitchenNumber(sheet.orders.length)} طلبات`, logoDataUri),
      { text: `${formatKitchenNumber(sheet.orders.length)} طلبات · لقطة ${formatSaudiDateTime(sheet.generatedAt)} بتوقيت السعودية`, alignment: "center", color: COLORS.muted, margin: [0, 0, 0, 10] },
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