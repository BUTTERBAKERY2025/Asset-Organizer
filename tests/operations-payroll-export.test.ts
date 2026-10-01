import { readFileSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOperationsPayrollExport } from "../server/operations-payroll-export";
import {
  OPERATIONS_PAYROLL_WATERMARK, exportValue, operationsPayrollExportRows, operationsPayrollFullCsv,
  type OperationsPayrollExport, type OperationsPayrollExportLine,
} from "../shared/operations-payroll-export";
import {
  downloadOperationsPayroll, operationsPayrollExportFilename, operationsPayrollPdfDefinition,
  operationsPayrollRtlTable, operationsPayrollWorkbook, operationsPayrollXlsxBlob, operationsPayrollPdfBlob,
} from "../client/src/lib/operations-payroll-export";
import { createOperationsHrCommandGuard } from "../client/src/lib/operations-hr-state";

const originalTransfer = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "transferToFixedLength");
afterEach(() => {
  if (originalTransfer) Object.defineProperty(ArrayBuffer.prototype, "transferToFixedLength", originalTransfer);
  else Reflect.deleteProperty(ArrayBuffer.prototype, "transferToFixedLength");
});

const line = (overrides: Partial<OperationsPayrollExportLine> = {}): OperationsPayrollExportLine => ({
  id: null, branchEmployeeId: 18, employeeName: "أحمد علي", employeeNumber: "00018",
  employeeStatus: "active", jobTitle: "خباز", department: null, nationality: "سعودي", iqamaNumber: "001122",
  bankName: "بنك", bankAccountNumber: "000123", presentDays: 0, originalPresentDays: null,
  attendanceAdjustmentReason: null, attendanceAdjustmentBy: null, absentDays: 2, offDays: 0,
  paidLeaveDays: 0, unpaidLeaveDays: 0, unpaidDays: 2, sickThreeQuarterDays: 0, sickUnpaidDays: 0,
  scheduledWorkDays: 2, scheduledHours: 16, lateDays: 0, totalHours: 0,
  baseSalary: 1200.25, housingAllowance: 0, allowances: 100.1, grossSalary: 1300.35, dailyRate: 43.345,
  absenceDeduction: 86.69, sickLeaveDeduction: 0, socialInsurance: 10, manualDeductionsTotal: 3.11,
  manualDeductions: [{ type: "advance", amount: 3.11, description: "سلفة" }], netSalary: 1200.55,
  leaveBreakdown: [], presentDates: [], absentDates: ["2026-09-01"], absentDatesExplicit: [],
  absentDatesMissing: ["2026-09-01"], offDates: [], dataSource: "attendance_only", noWorkAtAll: true, ...overrides,
});
function fixture(lines = [line()], payments: any[] = []) {
  return buildOperationsPayrollExport({
    branchId: "a", branchName: "فرع عربي", month: "2026-09", generatedAt: "2026-10-01T09:10:11.000Z",
    report: {
      lines, totals: { employeeCount: lines.length, totalBase: 1200.25, totalAllowances: 100.1, totalGross: 1300.35,
        totalAbsenceDeduction: 86.69, totalSickLeaveDeduction: 0, totalSocialInsurance: 10, totalManualDeductions: 3.11, totalNet: 1200.55 },
      isLocked: true, closure: { closedAt: "2026-09-30T20:00:00.000Z" }, warnings: [], enrichmentFailures: [],
      unlinkedSummary: { totalRecords: 0, presentRecords: 0, totalHours: 0 },
    }, payments,
  });
}
const payment = (amount: number | null, branchEmployeeId = 18) => ({
  id: branchEmployeeId, branchEmployeeId, branchId: "a", month: "2026-09", amount,
  paymentMethod: "cash", paidAt: "2026-10-01", notes: null,
});

// Synthetic, deliberately large detail payload: PDF must ignore it while the
// full spreadsheet/CSV continues to preserve every date, adjustment and note.
function compactFixture(count: number) {
  const dates = Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`);
  const names = ["أحمد محمد علي", "خالد عبدالله حسن", "محمد صالح إبراهيم", "عمر يوسف سالم", "حسن علي مصطفى", "سعيد أحمد محمود"];
  const lines = Array.from({ length: count }, (_, index) => line({
    branchEmployeeId: index + 1, employeeNumber: String(index + 1).padStart(5, "0"),
    employeeName: names[index % names.length], presentDays: 24, absentDays: 2, offDays: 4,
    paidLeaveDays: 0, unpaidLeaveDays: 0, scheduledWorkDays: 26, totalHours: 192,
    baseSalary: 3500 + index * 100, allowances: 200, grossSalary: 3700 + index * 100,
    absenceDeduction: 90, socialInsurance: 10, manualDeductionsTotal: 0, netSalary: 3600 + index * 100,
    presentDates: dates, absentDates: dates, absentDatesMissing: dates, offDates: dates,
    manualDeductions: [{ type: "advance", amount: 0, description: "تفصيل طويل لا يظهر في النسخة المختصرة".repeat(10) }],
    noWorkAtAll: false,
  }));
  const payments = lines.filter((_, index) => index % 3 !== 2).map((employee, index) =>
    payment(index % 2 === 0 ? employee.netSalary : 1000, employee.branchEmployeeId!));
  const data = fixture(lines, payments);
  data.branchName = "فرع تجريبي — بيانات اصطناعية";
  const sum = (key: "baseSalary" | "allowances" | "grossSalary" | "netSalary") =>
    lines.reduce((total, employee) => total + employee[key], 0);
  data.totals = { employeeCount: count, totalBase: sum("baseSalary"), totalAllowances: sum("allowances"),
    totalGross: sum("grossSalary"), totalNet: sum("netSalary"), totalAbsenceDeduction: count * 90,
    totalSickLeaveDeduction: 0, totalSocialInsurance: count * 10, totalManualDeductions: 0 };
  return data;
}

async function renderedPdf(data: OperationsPayrollExport) {
  const blob = await operationsPayrollPdfBlob(data);
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loading = getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const document = await loading.promise;
  const pages: Array<{ items: any[]; text: string; width: number; height: number }> = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const items = (await page.getTextContent()).items.filter((item: any) => typeof item.str === "string") as any[];
    const viewport = page.getViewport({ scale: 1 });
    pages.push({ items, text: items.map(item => item.str).join(" "), width: viewport.width, height: viewport.height });
  }
  return { blob, loading, document, pages };
}

describe("full operations export authoritative contract", () => {
  it("preserves exact salary fields/header totals and derives only settlement without mutating source", () => {
    const source = fixture([line()], [payment(200.35), payment(0.1, 99), payment(0.2, 100)]);
    const before = JSON.stringify(source);
    expect(source.paymentTotals).toEqual({ paid: 200.35, outstanding: 1000.2, recordedPaid: 200.65, unmatchedPaymentCount: 2, unknownSettlementCount: 0 });
    const rows = operationsPayrollExportRows(source);
    expect(rows[0]).toContain(43.345);
    expect(rows[0]).toContain(0);
    expect(rows[0]).toContain("000123");
    expect(rows[0]).toContain("غير مسجل");
    expect(source.totals.totalNet).toBe(1200.55);
    expect(JSON.stringify(source)).toBe(before);
    expect(exportValue(0)).toBe(0);
    expect(exportValue(null)).toBe("غير مسجل");
  });

  it("never invents a paid amount for legacy null payments or unidentifiable snapshot employees", () => {
    const data = fixture([line(), line({ branchEmployeeId: null })], [payment(null)]);
    expect(data.paymentTotals).toMatchObject({ paid: null, outstanding: null, recordedPaid: null, unknownSettlementCount: 2 });
    expect(data.settlements.every(row => row.paid === null && row.outstanding === null)).toBe(true);
    const zero = fixture([line({ netSalary: 0 })], [payment(0)]);
    expect(zero.paymentTotals).toMatchObject({ paid: 0, outstanding: 0, recordedPaid: 0 });
    expect(fixture([line({ netSalary: -10 })]).settlements[0]).toMatchObject({ paid: 0, outstanding: 0 });
    expect(fixture([]).paymentTotals).toMatchObject({ paid: 0, outstanding: 0 });
  });

  it("CSV uses the same full data, exact amounts, notices/source/payment totals and neutralizes formulas", () => {
    const csv = operationsPayrollFullCsv(fixture([line({ employeeName: '=HYPERLINK("evil")', netSalary: -12.75 })]));
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""evil"")"');
    expect(csv).toContain('"-12.75"');
    expect(csv).toContain('"43.345"');
    for (const text of ["المصروف", "المتبقي", "لقطة إغلاق محفوظة", "ليست اعتماداً نهائياً", "2026-09", "فرع عربي", "كامل الفرع والشهر"]) expect(csv).toContain(text);
  });

  it("XLSX is a real RTL workbook, has every field and totals, and treats formula text/account IDs as literal strings", async () => {
    const data = fixture([line({ employeeName: "=1+1", bankName: "@cmd", bankAccountNumber: "000123" })], [payment(0)]);
    const { workbook, xlsx } = await operationsPayrollWorkbook(data);
    expect(workbook.SheetNames).toEqual(["المصدر والإجماليات", "كامل رواتب الفرع", "سجلات الصرف"]);
    expect(workbook.Workbook?.Views?.[0]?.RTL).toBe(true);
    const sheet = workbook.Sheets["كامل رواتب الفرع"];
    expect(sheet.C2).toMatchObject({ t: "s", v: "=1+1" });
    expect(sheet.C2.f).toBeUndefined();
    expect(sheet.J2).toMatchObject({ t: "s", v: "000123" });
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    expect(rows[1]).toEqual(operationsPayrollExportRows(data)[0]);
    const blob = await operationsPayrollXlsxBlob(data);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
    const reopened = xlsx.read(bytes, { type: "array" });
    expect(reopened.Sheets["كامل رواتب الفرع"].C2).toMatchObject({ t: "s", v: "=1+1" });
    expect(reopened.Sheets["كامل رواتب الفرع"].C2.f).toBeUndefined();
    expect(JSON.stringify(xlsx.utils.sheet_to_json(reopened.Sheets["المصدر والإجماليات"], { header: 1 }))).toContain("1200.55");
  });

  it("PDF reverses headers/cells/widths together, repeats the violet advisory watermark, header and footer, never an HR stamp", async () => {
    const table = operationsPayrollRtlTable(["الموظف", "الصافي"], [["أحمد", 123]], [110, "*"]);
    expect(table.table.widths[0]).toBeCloseTo(652.89);
    expect(table.table.widths[1]).toBe(110);
    expect(table.table.body.map(row => row.map(cell => cell.stack[0].text))).toEqual([["الصافي", "الموظف"], ["123", "أحمد"]]);
    const definition = operationsPayrollPdfDefinition(fixture());
    expect(definition.watermark).toMatchObject({ text: OPERATIONS_PAYROLL_WATERMARK, color: "#8054b4", opacity: 0.07 });
    expect(JSON.stringify(definition.header)).toContain("ليست اعتماد شؤون الموظفين النهائي");
    expect(JSON.stringify((definition.footer as Function)(2, 3))).toContain("ليست اعتماداً نهائياً");
    expect(JSON.stringify(definition.content)).toContain("1200.55");
    expect(JSON.stringify(definition.content)).not.toContain("43.345");
    expect(JSON.stringify(definition)).not.toMatch(/signature|stamp|ختم نهائي/);
    const blob = await operationsPayrollPdfBlob(fixture());
    expect((await blob.text()).slice(0, 5)).toBe("%PDF-");
    expect(blob.size).toBeGreaterThan(1000);
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
    const document = await loading.promise;
    expect(document.numPages).toBe(1);
    let checkedColumnPositions = false;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const items = (await page.getTextContent()).items.filter((item: any) => typeof item.str === "string") as any[];
      const text = items.map(item => item.str).join(" ");
      expect(text).toContain("للمراجعة");
      expect(text).toContain("النهائي");
      // Check actual PDF geometry, not just the pre-render definition: the
      // employee identity must be visually to the right of the employee number.
      const number = items.find(item => item.str === "00018");
      if (number) {
        const name = items.find(item => item.str.includes("أحمد") && Math.abs(item.transform[5] - number.transform[5]) < 2);
        if (name) {
          expect(name.transform[4]).toBeGreaterThan(number.transform[4]);
          checkedColumnPositions = true;
        }
      }
    }
    expect(checkedColumnPositions).toBe(true);
    await loading.destroy();
  });

  it("renders 18 employees in 1–2 readable pages, excludes long detail arrays only from PDF, and paints bounded RTL cells", async () => {
    const data = compactFixture(18);
    const before = JSON.stringify(data);
    const definition = operationsPayrollPdfDefinition(data);
    expect(JSON.stringify(definition.content)).not.toMatch(/pageBreak|2026-09-30|تفاصيل الموظف|تفصيل طويل/);
    expect(definition.defaultStyle?.fontSize).toBeGreaterThanOrEqual(8);
    const result = await renderedPdf(data);
    expect(result.document.numPages).toBeGreaterThanOrEqual(1);
    expect(result.document.numPages).toBeLessThanOrEqual(2);
    const numbers = result.pages.flatMap(page => page.items.filter(item => /^000\d{2}$/.test(item.str)).map(item => item.str));
    expect(numbers).toEqual(data.lines.map(employee => employee.employeeNumber));
    expect(JSON.stringify(data)).toBe(before);
    expect(operationsPayrollFullCsv(data)).toContain("2026-09-30");
    const { workbook, xlsx } = await operationsPayrollWorkbook(data);
    expect(JSON.stringify(xlsx.utils.sheet_to_json(workbook.Sheets["كامل رواتب الفرع"], { header: 1 }))).toContain("2026-09-30");
    // pdfjs 6's renderer requires Node 24's ArrayBuffer transfer API; the
    // application/test runner is Node 22. A test-only copy is sufficient here.
    if (!("transferToFixedLength" in ArrayBuffer.prototype)) {
      Object.defineProperty(ArrayBuffer.prototype, "transferToFixedLength", {
        configurable: true, value: function (this: ArrayBuffer, length: number) { return this.slice(0, length); },
      });
    }
    const { Util } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { createCanvas } = await import("@napi-rs/canvas");
    let checkedAmount = false;
    for (let number = 1; number <= result.document.numPages; number++) {
      const page = await result.document.getPage(number);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await page.render({ viewport, canvas: canvas as any, canvasContext: context as any }).promise;
      const items = (await page.getTextContent()).items.filter((item: any) => typeof item.str === "string") as any[];
      const rowNumbers = items.filter(item => /^000\d{2}$/.test(item.str));
      if (rowNumbers.length) {
        const employeeHeader = items.find(item => item.str.endsWith("وظف"));
        const numberHeader = items.find(item => item.str.includes("الوظيفي"));
        expect(employeeHeader.transform[4]).toBeGreaterThan(numberHeader.transform[4]);
      }
      for (const numberCell of rowNumbers) {
        const row = items.filter(item => Math.abs(item.transform[5] - numberCell.transform[5]) < 2);
        expect(row.some(item => item.transform[4] > numberCell.transform[4] && /[أ-ي]/.test(item.str))).toBe(true);
        for (const rowCell of row.filter(item => item.str.trim())) {
          expect(Math.hypot(rowCell.transform[0], rowCell.transform[1])).toBeGreaterThanOrEqual(8);
        }
      }
      for (const item of items.filter(item => item.str === "4000")) {
        const position = Util.transform(viewport.transform, item.transform);
        const x = Math.floor(position[4]) - 2;
        const y = Math.floor(position[5]) - 20;
        const width = Math.ceil(item.width * 2) + 4;
        expect(x).toBeGreaterThanOrEqual(50);
        expect(x + width).toBeLessThan(viewport.width - 40);
        expect(y).toBeGreaterThan(110);
        expect(y + 26).toBeLessThan(viewport.height - 95);
        const pixels = context.getImageData(x, y, width, 26).data;
        let darkPixels = 0;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          if (pixels[offset] < 180 && pixels[offset + 1] < 180 && pixels[offset + 2] < 180) darkPixels++;
        }
        // Pale borders/watermark are excluded: source text must really paint.
        expect(darkPixels).toBeGreaterThan(12);
        checkedAmount = true;
      }
      if (process.env.OPERATIONS_PAYROLL_PDF_ARTIFACT === "1") {
        writeFileSync(`/tmp/operations-payroll-compact-page-${number}.png`, canvas.toBuffer("image/png"));
      }
    }
    expect(checkedAmount).toBe(true);
    if (process.env.OPERATIONS_PAYROLL_PDF_ARTIFACT === "1") {
      writeFileSync("/tmp/operations-payroll-compact.pdf", new Uint8Array(await result.blob.arrayBuffer()));
      console.info(`Synthetic 18-employee compact PDF: ${result.document.numPages} page(s)`);
    }
    await result.loading.destroy();
  });

  it("naturally paginates 100 employees with every row exactly once and repeating RTL table headers/advisory/footer", async () => {
    const data = compactFixture(100);
    const result = await renderedPdf(data);
    expect(result.document.numPages).toBeGreaterThan(1);
    expect(result.document.numPages).toBeLessThan(10);
    const numbers = result.pages.flatMap(page => page.items.filter(item => /^00\d{3}$/.test(item.str)).map(item => item.str));
    expect(numbers).toEqual(data.lines.map(employee => employee.employeeNumber));
    for (const page of result.pages) {
      expect(page.text).toContain("للمراجعة");
      expect(page.text).toContain("النهائي");
      expect(page.text).toContain("صفحة");
      expect(page.text).toContain("2026-09");
      // Header/footer/watermark repeat even if a final summary spills to a page.
      if (page.items.some(item => /^00\d{3}$/.test(item.str))) {
        const name = page.items.find(item => item.str.endsWith("وظف"));
        const number = page.items.find(item => item.str.includes("الوظيفي"));
        expect(name.transform[4]).toBeGreaterThan(number.transform[4]);
        expect(page.text).toContain("الحضور");
        expect(page.text).toContain("تبقي");
      }
      for (const item of page.items.filter(item => /^00\d{3}$/.test(item.str))) {
        expect(Math.abs(item.transform[0])).toBeGreaterThanOrEqual(8);
        expect(item.transform[4]).toBeGreaterThan(28);
        expect(item.transform[4] + item.width).toBeLessThan(page.width - 28);
        expect(item.transform[5]).toBeGreaterThan(52);
        expect(item.transform[5]).toBeLessThan(page.height - 62);
      }
    }
    if (process.env.OPERATIONS_PAYROLL_PDF_ARTIFACT === "1") console.info(`Synthetic 100-employee compact PDF: ${result.document.numPages} page(s)`);
    await result.loading.destroy();
  });

  it.each(["closed_snapshot", "live_calculation"] as const)("preserves %s source, authoritative totals, null/zero settlements and succinct warning counts in real PDF", async source => {
    const data = fixture([
      line({ employeeNumber: "00001", grossSalary: 0, netSalary: 0, presentDays: 0 }),
      line({ employeeNumber: "00002", branchEmployeeId: 19, grossSalary: 900, netSalary: 700 }),
      line({ employeeNumber: "00003", branchEmployeeId: null, presentDays: null as any }),
      line({ employeeNumber: "00004", branchEmployeeId: 20, netSalary: -12.75 }),
    ], [payment(0), payment(null, 19), payment(45, 99)]);
    data.source = source;
    data.snapshotClosedAt = source === "closed_snapshot" ? data.snapshotClosedAt : null;
    // Deliberately disagree with line sums/count: source totals must win.
    data.totals.employeeCount = 8;
    data.totals.totalNet = 7654.32;
    data.totals.totalGross = 8765.43;
    data.warnings = [{ branchEmployeeId: 18, employeeName: "أحمد", code: "missing_bank", message: "تفصيل تحذير موجود في المصدر فقط" }];
    data.enrichmentFailures = [{ source: "employee", message: "تفصيل إثراء موجود في المصدر فقط" }];
    data.unlinkedSummary = { totalRecords: 7, presentRecords: 4, totalHours: 32 };
    const before = JSON.stringify(data);
    const definition = operationsPayrollPdfDefinition(data);
    const definitionText = JSON.stringify(definition);
    const warningTable = (definition.content as any[]).find(node => node.table?.body[0].some((cell: any) => cell.stack[0].text === "تنبيهات التقرير"));
    const warningCells = new Map(warningTable.table.body[0].map((cell: any, index: number) =>
      [cell.stack[0].text, warningTable.table.body[1][index].stack[0].text]));
    for (const [label, count] of [["تنبيهات التقرير", "1"], ["تعذر إثراء البيانات", "1"], ["حضور غير مرتبط", "7"],
      ["صرف غير مرتبط بالكشف", "1"], ["تسويات غير معلومة", "2"], ["اختلاف عدد المصدر والسطور", "1"]]) expect(warningCells.get(label)).toBe(count);
    expect(definitionText).not.toContain("تفصيل تحذير");
    expect(operationsPayrollFullCsv(data)).toContain("تفصيل تحذير");
    const result = await renderedPdf(data);
    const allText = result.pages.map(page => page.text).join(" ");
    for (const value of ["7654.32", "8765.43", "-12.75", "غير مسجل", "Excel", "CSV"]) expect(allText).toContain(value);
    expect(allText).toContain(source === "closed_snapshot" ? "لقطة" : "حي");
    const items = result.pages.flatMap(page => page.items);
    const warningHeader = items.find(item => item.str.includes("تنبيهات التقرير"));
    expect(warningHeader).toBeDefined();
    // Real PDF count must sit beneath its own label, not float into a detached
    // run of digits at the opposite end of an RTL paragraph.
    expect(items.some(item => item.str === "1" && Math.abs(item.transform[4] + item.width -
      warningHeader.transform[4] - warningHeader.width) < 2 && warningHeader.transform[5] - item.transform[5] > 10 &&
      warningHeader.transform[5] - item.transform[5] < 45)).toBe(true);
    const zeroEmployee = items.find(item => item.str === "00001");
    const zeroRow = items.filter(item => Math.abs(item.transform[5] - zeroEmployee.transform[5]) < 2);
    expect(zeroRow.filter(item => item.str === "0").length).toBeGreaterThanOrEqual(4);
    const unknownEmployee = items.find(item => item.str === "00002");
    const unknownRow = items.filter(item => Math.abs(item.transform[5] - unknownEmployee.transform[5]) < 2);
    expect(unknownRow.filter(item => item.str.includes("مسجل")).length).toBeGreaterThanOrEqual(2);
    const noPaymentEmployee = items.find(item => item.str === "00004");
    const noPaymentRow = items.filter(item => Math.abs(item.transform[5] - noPaymentEmployee.transform[5]) < 2);
    // No payment is zero, whereas a legacy payment with no amount is unknown.
    expect(noPaymentRow.filter(item => item.str === "0").length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(data)).toBe(before);
    await result.loading.destroy();
  });

  it("renders empty report totals and no-payment state without fabricated employee rows", async () => {
    const data = fixture([]);
    const result = await renderedPdf(data);
    expect(result.document.numPages).toBe(1);
    const text = result.pages[0].text;
    expect(text).toContain("توجد سطور رواتب");
    expect(text).toContain("1200.55");
    expect(text).toContain("غير مسجل");
    expect(result.pages[0].items.some(item => /^\d{5}$/.test(item.str))).toBe(false);
    const definition = JSON.stringify(operationsPayrollPdfDefinition(data));
    expect(definition).toContain("سجلات الصرف الحالية: 0");
    expect(definition).toContain("تسويات غير معلومة");
    await result.loading.destroy();
  });
});

describe("downloads use fresh export permission and discard obsolete branch/month commands", () => {
  const run = (format: "pdf" | "xlsx" | "csv", assertCurrent = () => {}) => {
    const request = vi.fn(async (_method: string, url: string) =>
      url.includes("format=gate") ? new Response(JSON.stringify({ branchId: "a", month: "2026-09", authorized: true }))
        : format === "csv" ? new Response(operationsPayrollFullCsv(fixture())) : new Response(JSON.stringify(fixture())));
    const dependencies = { request, pdfBlob: vi.fn(async () => new Blob(["%PDF-"])), xlsxBlob: vi.fn(async () => new Blob(["PK"])), save: vi.fn() };
    return { request, dependencies, start: () => downloadOperationsPayroll({ branchId: "a", month: "2026-09", format, assertCurrent }, dependencies) };
  };
  it.each(["pdf", "xlsx", "csv"] as const)("gets %s exclusively from export endpoint, rechecks grants before save, uses actual extension", async format => {
    const f = run(format); await f.start();
    expect(f.request).toHaveBeenCalledTimes(2);
    expect(f.request.mock.calls.every(([, url]) => url.startsWith("/api/operations-hr/payroll/export?"))).toBe(true);
    expect(f.request.mock.calls[1][1]).toContain("format=gate");
    expect(f.dependencies.save).toHaveBeenCalledWith(expect.any(Blob), operationsPayrollExportFilename("a", "2026-09", format));
  });
  it("a fresh permission denial fails loudly and never saves cached view data", async () => {
    const f = run("pdf");
    f.request.mockRejectedValueOnce(new Error("403: export denied"));
    await expect(f.start()).rejects.toThrow("export denied");
    expect(f.dependencies.pdfBlob).not.toHaveBeenCalled();
    expect(f.dependencies.save).not.toHaveBeenCalled();
  });
  it("revoked permission at final authorization gate discards an already-generated file", async () => {
    const f = run("xlsx");
    f.request.mockImplementation(async (_method, url) => {
      if (url.includes("gate")) throw new Error("403: grants revoked");
      return new Response(JSON.stringify(fixture()));
    });
    await expect(f.start()).rejects.toThrow("grants revoked");
    expect(f.dependencies.xlsxBlob).toHaveBeenCalled();
    expect(f.dependencies.save).not.toHaveBeenCalled();
  });
  it("rejects a mismatched server scope before formatting", async () => {
    const f = run("pdf");
    f.request.mockResolvedValueOnce(new Response(JSON.stringify({ ...fixture(), branchId: "outside" })));
    await expect(f.start()).rejects.toThrow("لا تطابق");
    expect(f.dependencies.pdfBlob).not.toHaveBeenCalled();
    expect(f.dependencies.save).not.toHaveBeenCalled();
  });
  it("A→B→A navigation invalidates the first A command while format generation is in flight", async () => {
    const guard = createOperationsHrCommandGuard(); guard.update("a:2026-09");
    const token = guard.capture();
    const f = run("pdf", () => { if (!guard.isCurrent(token)) throw new Error("stale selection"); });
    f.dependencies.pdfBlob.mockImplementation(async () => {
      guard.update("b:2026-10"); guard.update("a:2026-09"); return new Blob(["pdf"]);
    });
    await expect(f.start()).rejects.toThrow("stale selection");
    expect(f.request).toHaveBeenCalledTimes(1);
    expect(f.dependencies.save).not.toHaveBeenCalled();
  });
  it("page offers all formats with loading/disable feedback and never feeds cached payroll.data into exports", () => {
    const page = readFileSync("client/src/pages/operations-hr.tsx", "utf8");
    for (const format of ["pdf", "xlsx", "csv"]) expect(page).toContain(`exportPayroll("${format}")`);
    expect(page).toContain("PDF — مراجعة مختصرة");
    expect(page).toContain("aria-busy={!!exporting}");
    expect(page).toContain("disabled={!reportReady || mutation.isPending || !!exporting}");
    const action = page.slice(page.indexOf("const exportPayroll ="), page.indexOf("return <main"));
    expect(action).not.toContain("payroll.data");
    expect(action).toContain("commands.isCurrent(token)");
  });
});