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
    table: { headerRows: 1, widths: boundedWidths.reverse(), body: [
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
    text: value, alignment: "right", ...(heading ? { bold: true, fontSize: 13, color: "#664294" } : {}),
    margin: [0, 4, 0, 4],
  });
  const content: any[] = [
    text("تقرير مراجعة رواتب التشغيل — كامل الفرع", true),
    text(`${data.branchName} · ${data.month}`),
    operationsPayrollRtlTable(["البيان", "القيمة"], operationsPayrollExportSummary(data), [170, "*"]),
    text("ملخص جميع موظفي الفرع والشهر (المبالغ بالريال السعودي)", true),
    operationsPayrollRtlTable(
      ["الموظف", "الرقم الوظيفي", "الإجمالي", "خصم الغياب", "خصم المرضية", "التأمينات", "السلف والخصومات", "الصافي", "المصروف", "المتبقي"],
      data.lines.map((line, index) => [
        line.employeeName, exportValue(line.employeeNumber), exportValue(line.grossSalary),
        exportValue(line.absenceDeduction), exportValue(line.sickLeaveDeduction), exportValue(line.socialInsurance),
        exportValue(line.manualDeductionsTotal), exportValue(line.netSalary),
        exportValue(data.settlements[index]?.paid), exportValue(data.settlements[index]?.outstanding),
      ]), [110, 58, "*", "*", "*", "*", "*", "*", "*", "*"],
    ),
  ];
  if (!data.lines.length) content.push(text("لا توجد سطور رواتب في الفرع والشهر المحددين. الإجماليات أعلاه كما وردت من المصدر."));
  // Detailed fields stay readable instead of squeezing the 49 CSV/XLSX columns
  // into one illegible PDF table. The same full logical field list is used.
  data.lines.forEach((line, index) => {
    const values = operationsPayrollExportRows({ ...data, lines: [line], settlements: [data.settlements[index]] })[0];
    const fields = operationsPayrollExportHeaders().map((title, i): [string, string | number] => [title, values[i]]);
    const rows: Array<Array<string | number>> = [];
    for (let i = 0; i < fields.length; i += 2) rows.push([...fields[i], ...(fields[i + 1] ?? ["", ""])]);
    content.push(
      { ...text(`تفاصيل الموظف ${index + 1}: ${line.employeeName}`, true), pageBreak: "before" },
      operationsPayrollRtlTable(["الحقل", "القيمة", "الحقل", "القيمة"], rows, [110, "*", 110, "*"]),
    );
  });
  content.push(text("سجلات صرف الفرع والشهر — المصدر الحالي، وليس لقطة الإغلاق", true));
  if (data.payments.length) content.push(operationsPayrollRtlTable(
    ["معرف السجل", "معرف الموظف", "المبلغ", "الطريقة", "التاريخ", "ملاحظات"],
    data.payments.map(p => [p.id, p.branchEmployeeId, exportValue(p.amount), p.paymentMethod, p.paidAt, exportValue(p.notes)]),
    [60, 70, 85, 70, 145, "*"],
  ));
  else content.push(text("لا توجد سجلات صرف لهذا الفرع والشهر."));
  return {
    pageSize: "A4", pageOrientation: "landscape", pageMargins: [28, 62, 28, 52],
    defaultStyle: { font: "Nillima", fontSize: 8, alignment: "right", color: "#30243f" },
    content,
    watermark: { text: OPERATIONS_PAYROLL_WATERMARK, color: "#8054b4", opacity: 0.07, fontSize: 36, angle: -18 },
    header: {
      stack: [
        text(`${OPERATIONS_PAYROLL_WATERMARK} · ${data.branchName} · ${data.month}`, true),
        { text: "نسخة استشارية — ليست اعتماد شؤون الموظفين النهائي أو اعتماداً مالياً", alignment: "right", fontSize: 8, color: "#77558f" },
      ], margin: [28, 12, 28, 0],
    },
    footer: (page, pages) => ({
      stack: [
        { text: OPERATIONS_PAYROLL_REVIEW_NOTICE, alignment: "right", fontSize: 7, color: "#77558f" },
        { text: `صفحة ${page} من ${pages} · إنشاء النسخة: ${data.generatedAt}`, alignment: "right", fontSize: 7, color: "#77558f" },
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