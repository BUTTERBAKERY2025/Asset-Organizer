import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOperationsPayrollExport } from "../server/operations-payroll-export";
import {
  OPERATIONS_PAYROLL_WATERMARK, exportValue, operationsPayrollExportRows, operationsPayrollFullCsv,
  type OperationsPayrollExportLine,
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
    expect(JSON.stringify(definition.content)).toContain("43.345");
    expect(JSON.stringify(definition)).not.toMatch(/signature|stamp|ختم نهائي/);
    const blob = await operationsPayrollPdfBlob(fixture());
    expect((await blob.text()).slice(0, 5)).toBe("%PDF-");
    expect(blob.size).toBeGreaterThan(1000);
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loading = getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
    const document = await loading.promise;
    expect(document.numPages).toBeGreaterThan(1);
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

  it("keeps full-month date arrays and employee details visibly inside rendered PDF cells (blank-grid regression)", async () => {
    const dates = Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`);
    const data = fixture([line({ baseSalary: 4000, allowances: 0, grossSalary: 4000, absenceDeduction: 4000, netSalary: 0, absentDates: dates, absentDatesMissing: dates })]);
    data.source = "live_calculation";
    data.snapshotClosedAt = null;
    data.totals = { ...data.totals, totalBase: 4000, totalAllowances: 0, totalGross: 4000, totalAbsenceDeduction: 4000, totalNet: 0 };
    const pdf = await operationsPayrollPdfBlob(data);
    // pdfjs 6's renderer requires Node 24's ArrayBuffer transfer API; the
    // application/test runner is Node 22. A test-only copy is sufficient here.
    if (!("transferToFixedLength" in ArrayBuffer.prototype)) {
      Object.defineProperty(ArrayBuffer.prototype, "transferToFixedLength", {
        configurable: true, value: function (this: ArrayBuffer, length: number) { return this.slice(0, length); },
      });
    }
    const { getDocument, Util } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { createCanvas } = await import("@napi-rs/canvas");
    const loading = getDocument({ data: new Uint8Array(await pdf.arrayBuffer()) });
    const document = await loading.promise;
    let checkedAmount = false;
    let checkedLastDate = false;
    for (let number = 3; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await page.render({ viewport, canvas: canvas as any, canvasContext: context as any }).promise;
      const items = (await page.getTextContent()).items.filter((item: any) => typeof item.str === "string") as any[];
      for (const item of items.filter(item => item.str === "4000" || item.str.includes("2026-09-30"))) {
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
        if (item.str === "4000") checkedAmount = true;
        if (item.str.includes("2026-09-30")) checkedLastDate = true;
      }
    }
    expect(checkedAmount).toBe(true);
    expect(checkedLastDate).toBe(true);
    await loading.destroy();
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
    expect(page).toContain("aria-busy={!!exporting}");
    expect(page).toContain("disabled={!reportReady || mutation.isPending || !!exporting}");
    const action = page.slice(page.indexOf("const exportPayroll ="), page.indexOf("return <main"));
    expect(action).not.toContain("payroll.data");
    expect(action).toContain("commands.isCurrent(token)");
  });
});