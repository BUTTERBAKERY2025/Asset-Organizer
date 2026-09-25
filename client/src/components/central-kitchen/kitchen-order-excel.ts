import { formatSaudiDateTime, SHORTAGE_LABELS, type PreparationSheet } from "./kitchen-order-share-model";
import { kitchenStatusLabel, type PdfKitchenOrder } from "./kitchen-order-pdf";

type SheetJs = typeof import("xlsx");
type ExcelValue = string | number;
const text = (input: unknown): string => {
  const result = input == null ? "" : String(input);
  // Always write untrusted values as literal strings, never as spreadsheet formulas.
  return /^[\s\u0000-\u001f]*[=+\-@\t\r]/.test(result) ? `'${result}` : result;
};
const numeric = (input: number | string | null | undefined): ExcelValue =>
  input == null || input === "" ? "" : typeof input === "number" ? input : Number.isFinite(Number(input)) ? Number(input) : text(input);
const filePart = (input: string) => input.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 80);

function append(XLSX: SheetJs, workbook: ReturnType<SheetJs["utils"]["book_new"]>, name: string, rows: ExcelValue[][]) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = rows[0]?.map((_, column) => ({ wch: column === 0 ? 26 : 20 })) || [];
  (worksheet as any)["!views"] = [{ rightToLeft: true }];
  XLSX.utils.book_append_sheet(workbook, worksheet, name);
  (workbook as any).Workbook = { ...((workbook as any).Workbook || {}), Views: [{ RTL: true }] };
  return worksheet;
}

export function buildKitchenOrderWorkbook(XLSX: SheetJs, order: PdfKitchenOrder) {
  const workbook = XLSX.utils.book_new();
  const metadata: ExcelValue[][] = [
    ["رقم الطلب", text(order.orderNumber)],
    ["الحالة", text(kitchenStatusLabel(order.status))],
    ["الفرع الطالب", text(order.requestBranchName || order.requestBranchId)],
    ["المطبخ المصدر", text(order.centralKitchenName || order.centralKitchenId)],
    ["تاريخ الإنشاء · السعودية", formatSaudiDateTime(order.createdAt)],
    ["تاريخ الحاجة", text(order.neededDate)],
    ["وقت الحاجة", text(order.neededTime)],
    ["ملاحظات الطلب", text(order.notes)],
    ["السائق", text(order.driverName)],
    ["المركبة", text(order.vehicleNumber)],
    ["حالة الفروقات", text(order.discrepancyStatus === "open" ? "مفتوحة" : order.discrepancyStatus === "resolved" ? "تمت المعالجة" : order.discrepancyStatus)],
    ["معالجة الفروقات", text(order.discrepancyResolutionNotes)],
  ];
  append(XLSX, workbook, "بيانات الطلب", metadata);
  const rows: ExcelValue[][] = [
    ["الصنف الأصلي", "الوحدة", "المطلوب", "المتوفر المعلن في الفرع", "الأصلي المجهز", "الصنف البديل", "وحدة البديل", "البديل المجهز", "المرسل", "المستلم", "التالف", "المفقود", "سبب النقص المسجل", "ملاحظة الصنف", "ملاحظة التجهيز", "ملاحظة الاستلام"],
    ...(order.items || []).map(item => [
      text(item.productName), text(item.unit), numeric(item.requestedQuantity),
      numeric(item.reportedAvailableQuantity), numeric(item.preparedQuantity),
      text(item.substituteProductName), text(item.substituteUnit), numeric(item.substituteQuantity),
      numeric(item.dispatchedQuantity), numeric(item.receivedQuantity), numeric(item.damagedQuantity), numeric(item.missingQuantity),
      text(item.shortageReason ? SHORTAGE_LABELS[item.shortageReason] || item.shortageReason : null),
      text(item.notes), text(item.preparationNotes), text(item.receivingNotes),
    ]),
  ];
  append(XLSX, workbook, "بنود الطلب", rows);
  return { workbook, filename: `طلب-المطبخ-${filePart(order.orderNumber)}.xlsx` };
}

export function buildPreparationSheetWorkbook(XLSX: SheetJs, sheet: PreparationSheet) {
  const workbook = XLSX.utils.book_new();
  append(XLSX, workbook, "الطلبات", [
    ["رقم الطلب", "الفرع الطالب", "الحالة", "وقت اللقطة · السعودية"],
    ...sheet.orders.map(order => [text(order.orderNumber), text(order.requestBranchName), text(kitchenStatusLabel(order.status)), formatSaudiDateTime(sheet.generatedAt)]),
  ]);
  append(XLSX, workbook, "التجهيز المجمع", [
    ["الصنف", "المصدر", "هوية الصنف", "الوحدة", "المطلوب", "المعتمد", "الأصلي المجهز", "البديل المجهز", "لم يحسم بعد", "نقص فعلي"],
    ...sheet.groups.map(group => [
      text(group.productName), group.provenance === "substitute" ? "بديل مجهز" : "صنف أصلي",
      text(group.identity), text(group.unit), group.requestedQuantity, group.approvedQuantity,
      group.preparedQuantity, group.substitutedQuantity, group.unpreparedQuantity, group.actualShortageQuantity,
    ]),
  ]);
  append(XLSX, workbook, "تفاصيل الطلبات", [
    ["رقم الطلب", "الفرع", "حالة الطلب", "الصنف", "المصدر", "هوية الصنف", "الوحدة", "المطلوب", "الأصلي المجهز", "الصنف البديل", "هوية البديل", "وحدة البديل", "البديل المجهز", "لم يحسم بعد", "نقص فعلي", "سبب النقص", "ملاحظات التجهيز"],
    ...sheet.groups.flatMap(group => group.orders.map(order => [
      text(order.orderNumber), text(order.branchName),
      text(kitchenStatusLabel(sheet.orders.find(source => source.id === order.id)?.status || "")),
      text(group.productName), group.provenance === "substitute" ? "بديل مجهز" : "صنف أصلي", text(group.identity), text(group.unit),
      order.requestedQuantity, order.preparedQuantity, text(order.substituteProductName), text(order.substituteIdentity),
      text(order.substituteUnit), order.substitutedQuantity, order.unpreparedQuantity, order.actualShortageQuantity,
      text(order.shortageReason ? SHORTAGE_LABELS[order.shortageReason] || order.shortageReason : null), text(order.preparationNotes),
    ])),
  ]);
  return { workbook, filename: `ورقة-التجهيز-${filePart(sheet.generatedAt.slice(0, 10))}.xlsx` };
}

export async function downloadKitchenExcel(kind: "order", input: PdfKitchenOrder): Promise<void>;
export async function downloadKitchenExcel(kind: "sheet", input: PreparationSheet): Promise<void>;
export async function downloadKitchenExcel(kind: "order" | "sheet", input: PdfKitchenOrder | PreparationSheet) {
  const XLSX = await import("xlsx");
  const result = kind === "order"
    ? buildKitchenOrderWorkbook(XLSX, input as PdfKitchenOrder)
    : buildPreparationSheetWorkbook(XLSX, input as PreparationSheet);
  XLSX.writeFile(result.workbook, result.filename, { bookType: "xlsx" });
}