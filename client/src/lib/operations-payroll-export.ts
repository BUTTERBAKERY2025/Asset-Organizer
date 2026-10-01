import type { TDocumentDefinitions } from "pdfmake/interfaces";
import {
  OPERATIONS_PAYROLL_REVIEW_NOTICE, OPERATIONS_PAYROLL_WATERMARK,
  exportValue, operationsPayrollExportColumns, operationsPayrollExportHeaders,
  operationsPayrollExportRows, operationsPayrollExportSummary,
  type OperationsPayrollExport, type OperationsPayrollExportFormat,
} from "@shared/operations-payroll-export";
import { apiRequest } from "./queryClient";

export function operationsPayrollExportFilename(branchId: string, month: string, format: OperationsPayrollExportFormat) {
  return `operations-payroll-review-${branchId.replace(/[^a-zA-Z0-9_-]/g, "_")}-${month}.${format}`;
}

/** Explicitly reverse headers, row cells AND widths. Text itself is never reversed. */
export function operationsPayrollRtlTable(headers: string[], rows: Array<Array<string | number>>, widths: Array<number | "*" | "auto">) {
  // pdfMake's "*" widths respect each cell's minimum unbreakable width. A full
  // month JSON date array can make that minimum wider than the entire page,
  // moving ALL detail text off-page while leaving apparently empty ruled rows.
  // Bound widths to landscape A4's content area, including padding/borders.
  const flexibleCount = widths.filter(width => typeof width !== "number").length;
  const fixedTotal = widths.reduce<number>((sum, width) => sum + (typeof width === "number" ? width : 0), 0);
  const flexibleWidth = (841.89 - 56 - widths.length * 10 - (widths.length + 1) - fixedTotal) / Math.max(1, flexibleCount);
  const boundedWidths = widths.map(width => typeof width === "number" ? width : flexibleWidth);
  const wrapText = (value: string | number) => {
    let result = String(value);
    if (/^[\[{]/.test(result)) {
      try {
        JSON.parse(result);
        // JSON whitespace OUTSIDE quoted source values creates ordinary word
        // breaks without changing dates/notes. Nillima does not have a reliable
        // zero-width-space glyph, so never insert invisible control characters.
        result = result.replace(/("(?:\\.|[^"\\])*")|([,:])/g,
          (match, quoted, punctuation) => quoted ?? `${punctuation} `);
      } catch { /* Not JSON: retain the original source string. */ }
    }
    // Extremely long unspaced identifiers/URLs still wrap inside their bounded
    // cell. Line wrapping is presentation only; no characters or digits removed.
    return result.replace(/(\S{24})(?=\S)/g, "$1\n");
  };
  const cell = (value: string | number, heading = false) => ({
    // The installed fork auto-reverses tables based on cell.text. Stacks keep
    // column ordering explicit (and avoid data-dependent/double reversal).
    stack: [{ text: wrapText(value), alignment: "right", bold: heading, color: "#30243f", opacity: 1 }],
    ...(heading ? { fillColor: "#eee7f8" } : {}),
  });
  return {
    table: { headerRows: 1, dontBreakRows: true, widths: boundedWidths.reverse(), body: [
      headers.map(value => cell(value, true)).reverse(),
      ...rows.map(row => row.map(value => cell(value)).reverse()),
    ] },
    layout: {
      hLineColor: () => "#ded5e9", vLineColor: () => "#ded5e9",
      paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 4, paddingBottom: () => 4,
    },
    margin: [0, 8, 0, 12],
  };
}

export function operationsPayrollPdfDefinition(data: OperationsPayrollExport): TDocumentDefinitions {
  const text = (value: string, heading = false) => ({
    text: value, alignment: "right", ...(heading ? { bold: true, fontSize: 9, color: "#664294" } : {}),
    margin: [0, 2, 0, 2],
  });
  // Match the screen's core attendance counts and salary/settlement columns.
  // This review is deliberately not the full 49-field Excel/CSV detail export.
  // Do not sum/recalculate salaries or replace missing snapshot values with zero.
  const employeeTable = operationsPayrollRtlTable(
    ["الموظف", "الرقم الوظيفي", "الحضور", "الغياب", "الراحة", "إجازة مدفوعة", "إجازة بدون راتب", "الإجمالي", "الصافي", "المصروف", "المتبقي"],
    [
      ...data.lines.map((line, index) => [
        line.employeeName, exportValue(line.employeeNumber), exportValue(line.presentDays),
        exportValue(line.absentDays), exportValue(line.offDays), exportValue(line.paidLeaveDays),
        exportValue(line.unpaidLeaveDays), exportValue(line.grossSalary), exportValue(line.netSalary),
        exportValue(data.settlements[index]?.paid), exportValue(data.settlements[index]?.outstanding),
      ]),
      ["إجمالي المصدر", "", "—", "—", "—", "—", "—", exportValue(data.totals.totalGross),
        exportValue(data.totals.totalNet), exportValue(data.paymentTotals.paid), exportValue(data.paymentTotals.outstanding)],
    ], [116, 58, 32, 32, 32, 42, 42, "*", "*", "*", "*"],
  );
  const totalRow = employeeTable.table.body[employeeTable.table.body.length - 1];
  totalRow.forEach(cell => {
    cell.stack[0].bold = true;
    cell.fillColor = "#eee7f8";
  });
  // Less vertical padding, never a smaller font or narrower identity column.
  employeeTable.layout.paddingTop = () => 1.5;
  employeeTable.layout.paddingBottom = () => 1.5;
  employeeTable.margin = [0, 6, 0, 8];
  const warningCounts: Array<[string, number]> = [
    ["تنبيهات التقرير", data.warnings.length],
    ["تعذر إثراء البيانات", data.enrichmentFailures.length],
    ["حضور غير مرتبط", data.unlinkedSummary.totalRecords],
    ["صرف غير مرتبط بالكشف", data.paymentTotals.unmatchedPaymentCount],
    ["تسويات غير معلومة", data.paymentTotals.unknownSettlementCount],
  ];
  if (data.totals.employeeCount !== data.lines.length) warningCounts.push(["اختلاف عدد المصدر والسطور", 1]);
  const noWorkCount = data.lines.filter(line => line.noWorkAtAll).length;
  const adjustedCount = data.lines.filter(line => line.originalPresentDays != null).length;
  if (noWorkCount) warningCounts.push(["بلا بيانات دوام", noWorkCount]);
  if (adjustedCount) warningCounts.push(["حضور معدل يدوياً", adjustedCount]);
  const summaryTable = operationsPayrollRtlTable(
    ["عدد موظفي المصدر", "الأساسي", "البدلات", "خصم الغياب", "خصم المرضية", "التأمينات", "السلف والخصومات", "كل الصرف المسجل"],
    [[data.totals.employeeCount, data.totals.totalBase, data.totals.totalAllowances, data.totals.totalAbsenceDeduction,
      data.totals.totalSickLeaveDeduction, data.totals.totalSocialInsurance,
      data.totals.totalManualDeductions, data.paymentTotals.recordedPaid].map(exportValue)],
    ["*", "*", "*", "*", "*", "*", "*", "*"],
  );
  // Separate heading and count cells keep their association readable in the
  // RTL fork, which can move digits away from labels in mixed-text paragraphs.
  const warningTable = operationsPayrollRtlTable(
    warningCounts.map(([label]) => label), [warningCounts.map(([, count]) => count)],
    warningCounts.map(() => "*"),
  );
  for (const table of [summaryTable, warningTable]) {
    table.layout.paddingTop = () => 2;
    table.layout.paddingBottom = () => 2;
    table.margin = [0, 4, 0, 6];
  }
  const content: any[] = [
    text(`كامل الفرع والشهر دون فلاتر · سطور الكشف: ${data.lines.length} · المبالغ بالريال السعودي`, true),
    employeeTable,
    { unbreakable: true, stack: [text("إجماليات المصدر — دون إعادة احتساب", true), summaryTable] },
    text(`سجلات الصرف الحالية: ${data.payments.length} — ليست جزءاً من لقطة الإغلاق. غير مسجل لا يعني صفراً أو تسوية كاملة.`),
    { ...warningTable, unbreakable: true },
  ];
  if (!data.lines.length) content.push(text("لا توجد سطور رواتب في الفرع والشهر المحددين. الإجماليات أعلاه كما وردت من المصدر."));
  return {
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [28, 62, 28, 52],
    defaultStyle: { font: "Nillima", fontSize: 8.5, alignment: "right", color: "#30243f" },
    content,
    watermark: { text: OPERATIONS_PAYROLL_WATERMARK, color: "#8054b4", opacity: 0.07, fontSize: 36, angle: -18 },
    header: {
      stack: [
        { ...text(`${OPERATIONS_PAYROLL_WATERMARK} · ${data.branchName} · ${data.month} · ${data.source === "closed_snapshot" ? "لقطة إغلاق محفوظة" : "احتساب حي على الخادم — قابل للتغير"}`, true), fontSize: 11 },
        { text: "نسخة استشارية — ليست اعتماد شؤون الموظفين النهائي أو اعتماداً مالياً", alignment: "right", fontSize: 8, color: "#77558f" },
      ], margin: [28, 12, 28, 0],
    },
    footer: (page, pages) => ({
      stack: [
        { text: OPERATIONS_PAYROLL_REVIEW_NOTICE, alignment: "right", fontSize: 8, color: "#77558f" },
        { text: "تفاصيل التنبيهات والتواريخ والخصومات وسجلات الصرف: تقرير المصدر وتصدير Excel / CSV الكامل.", alignment: "right", fontSize: 8, color: "#77558f" },
        { text: `صفحة ${page} من ${pages} · إنشاء النسخة: ${data.generatedAt}`, alignment: "right", fontSize: 8, color: "#77558f" },
      ], margin: [28, 7, 28, 0],
    }),
  } as TDocumentDefinitions;
}

export async function operationsPayrollPdfBlob(data: OperationsPayrollExport): Promise<Blob> {
  const [module, fonts] = await Promise.all([
    import("@digicole/pdfmake-rtl/build/pdfmake"), import("@digicole/pdfmake-rtl/build/vfs_fonts"),
  ]);
  const pdf = module.default;
  const vfs = (fonts.default as any).default || fonts.default;
  const face = { normal: "Nillima.ttf", bold: "Nillima.ttf", italics: "Nillima.ttf", bolditalics: "Nillima.ttf" };
  const fontDefinitions = { Nillima: face, Roboto: face };
  // Explicit fonts avoid racing other PDF exports that mutate the global font map.
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("انتهت مهلة تجهيز PDF؛ حاول مجدداً.")), 60_000);
    try {
      pdf.createPdf(operationsPayrollPdfDefinition(data), undefined, fontDefinitions, vfs).getBlob((blob: Blob) => {
        clearTimeout(timeout); resolve(blob);
      });
    } catch (error) { clearTimeout(timeout); reject(error); }
  });
}

export async function operationsPayrollWorkbook(data: OperationsPayrollExport) {
  const xlsx = await import("xlsx");
  const workbook = xlsx.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  const addSheet = (name: string, rows: Array<Array<string | number>>, widths: number[]) => {
    const sheet = xlsx.utils.aoa_to_sheet(rows);
    // aoa_to_sheet treats strings (including =,+,-,@) as literal string cells,
    // not formulas. Do not use sheet formulas or infer formulas from source text.
    sheet["!cols"] = widths.map(wch => ({ wch }));
    xlsx.utils.book_append_sheet(workbook, sheet, name);
  };
  addSheet("المصدر والإجماليات", operationsPayrollExportSummary(data), [48, 100]);
  addSheet("كامل رواتب الفرع", [operationsPayrollExportHeaders(), ...operationsPayrollExportRows(data)],
    operationsPayrollExportHeaders().map((_, index) => index === 2 ? 30 : index < operationsPayrollExportColumns.length ? 22 : 26));
  const payrollSheet = workbook.Sheets["كامل رواتب الفرع"];
  payrollSheet["!autofilter"] = { ref: payrollSheet["!ref"]! };
  addSheet("سجلات الصرف", [
    ["معرف السجل", "معرف الموظف", "الفرع", "الشهر", "المبلغ", "طريقة الصرف", "تاريخ الصرف", "ملاحظات"],
    ...data.payments.map(p => [p.id, p.branchEmployeeId, p.branchId, p.month, exportValue(p.amount), p.paymentMethod, p.paidAt, exportValue(p.notes)]),
  ], [16, 18, 22, 16, 20, 24, 30, 50]);
  return { workbook, xlsx };
}

export async function operationsPayrollXlsxBlob(data: OperationsPayrollExport) {
  const { workbook, xlsx } = await operationsPayrollWorkbook(data);
  return new Blob([xlsx.write(workbook, { bookType: "xlsx", type: "array", compression: true })],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/** Only export-gated, fresh server data may feed an export. No table/report cache input. */
export async function downloadOperationsPayroll(input: {
  branchId: string; month: string; format: OperationsPayrollExportFormat; assertCurrent: () => void;
}, dependencies = {
  request: apiRequest, pdfBlob: operationsPayrollPdfBlob, xlsxBlob: operationsPayrollXlsxBlob,
  save: (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
}) {
  const { branchId, month, format, assertCurrent } = input;
  const endpoint = (requested: string) => `/api/operations-hr/payroll/export?${new URLSearchParams({ branchId, month, format: requested })}`;
  assertCurrent();
  const response = await dependencies.request("GET", endpoint(format));
  assertCurrent();
  let blob: Blob;
  if (format === "csv") blob = await response.blob();
  else {
    const data = await response.json() as OperationsPayrollExport;
    if (data.version !== 1 || data.scope !== "entire_branch_month" || data.branchId !== branchId || data.month !== month ||
        data.payments.some(p => p.branchId !== branchId || p.month !== month))
      throw new Error("بيانات التصدير لا تطابق الفرع والشهر المحددين؛ لم يُنزّل ملف.");
    assertCurrent();
    blob = await (format === "pdf" ? dependencies.pdfBlob(data) : dependencies.xlsxBlob(data));
  }
  assertCurrent();
  // Permissions/grants may change while a large PDF/workbook is being rendered.
  const gate = await (await dependencies.request("GET", endpoint("gate"))).json();
  if (gate.authorized !== true || gate.branchId !== branchId || gate.month !== month)
    throw new Error("تعذر التحقق من صلاحية تنزيل ملف الفرع والشهر المحددين.");
  assertCurrent();
  dependencies.save(blob, operationsPayrollExportFilename(branchId, month, format));
}