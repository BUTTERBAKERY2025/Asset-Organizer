import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as XLSX from "xlsx";

// Real page functions, memory-only queries and captured output; no business DB.
const source = readFileSync("client/src/pages/salary-closing.tsx", "utf8");
const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = new Map<string, ts.Expression>();
function visit(n: ts.Node) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) nodes.set(n.name.text, n.initializer);
  ts.forEachChild(n, visit);
}
visit(ast);
function fixture(overrides: any = {}) {
  const rows = [["Alpha", "مصري", "خباز", 1000], ["Beta", "سعودي", "خباز", 2000], ["Gamma", "مصري", "كاشير", 3000]].map(
    ([employeeName, nationality, jobTitle, netSalary], i) => ({
      id: 100 + i, branchEmployeeId: i + 1, employeeName, nationality, jobTitle,
      employeeNumber: String(i + 1), netSalary, grossSalary: Number(netSalary) + 50, baseSalary: Number(netSalary) + 50,
      sickLeaveDeduction: 50, allowances: 0, absenceDeduction: 0, socialInsurance: 0,
      manualDeductionsTotal: 0, employeeStatus: "active", bankAccountNumber: "SA0000",
    }));
  const state: any = {};
  const c: any = {
    salaryClosingData: rows, search: "", nationalityFilter: "مصري", jobTitleFilter: "خباز",
    dataSourceFilter: "all", statusFilter: "all", bankFilter: "all", paymentStatusFilter: "all", paymentMethodFilter: "all",
    netMin: "", netMax: "", sortField: "employeeName", sortOrder: "asc", paymentByEmp: new Map(),
    salaryClosingPreviewQuery: { refetch: vi.fn(async () => ({ data: { lines: rows, unlinked: [{ id: 9 }], warnings: [] } })) },
    salaryPaymentsQuery: { refetch: vi.fn(async () => ({ data: [{ branchEmployeeId: 1, paymentMethod: "cash" }] })) },
    hasActiveFilters: true, isAllBranches: false, branch: "test", month: "2026-09",
    isRTL: true, getBranchName: () => "Test", employeeStatusLabel: () => "نشط",
    SALARY_DEDUCTION_TYPE_LABELS: {}, LEAVE_TYPE_LABELS: {}, SALARY_PAYMENT_METHOD_LABELS: { cash: "نقدي" },
    bankNameToSwift: () => "RIBLSARI", fmtDMY: () => "30/09/2026",
    toast: vi.fn(), alert: vi.fn(), confirm: () => true,
    fakeXlsx: { ...XLSX, default: undefined, writeFile: (wb: any) => { state.wb = wb; } },
    fetch: vi.fn(async (_: any, options: any) => { state.pdf = JSON.parse(options.body); return { ok: true, blob: async () => new Blob() }; }),
    window: { URL: { createObjectURL: () => "blob:test", revokeObjectURL: () => {} } },
    document: { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} } },
    printHtmlDocument: (html: string) => { state.html = html; },
    downloadFile: vi.fn(),
    ...overrides,
  };
  function compile(name: string) {
    const expression = nodes.get(name)!.getText(ast).replace('await import("xlsx")', "fakeXlsx").replace('await import("xlsx-js-style")', "fakeXlsx");
    return new Function(...Object.keys(c), ts.transpileModule(`return (${expression});`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText)(...Object.values(c));
  }
  for (const name of ["BANK_DATA_CURRENCIES", "BANK_DATA_CODES", "filterSalaryLines", "fetchLatestPayments", "fetchLatestClosing", "round2", "escapeHtml",
    "accruedBranchOf", "accruedDeptOf", "accruedOtherAllow", "accruedAbsence", "accruedInsurance",
    "accruedManual", "accruedTotalDed", "accruedNet", "manualDeductionsText", "buildAccruedGroups"]) c[name] = compile(name);
  return { rows, state, c, run: (name: string, ...args: any[]) => compile(name)(...args) };
}
describe("salary screen and exports use the same filters", () => {
  it.each(["exportSalaryClosingToExcel", "exportAccruedSalariesExcel", "exportPaymentsExcel"])("%s exports only matching employees", async name => {
    const f = fixture();
    await f.run(name, "paid");
    const all = JSON.stringify(f.state.wb);
    expect(all).toContain("Alpha");
    expect(all).not.toContain("Beta");
    expect(all).not.toContain("Gamma");
    expect(f.c.fetch).not.toHaveBeenCalled();
  });
  it("filters the actual PDF request and the accrued printable HTML", async () => {
    const f = fixture();
    await f.run("exportSalaryClosingToPDF");
    expect(f.state.pdf.employees.map((r: any) => r.employeeName)).toEqual(["Alpha"]);
    expect(f.state.pdf.employees[0].sickLeaveDeduction).toBe(50);
    await f.run("exportAccruedSalariesPDF");
    expect(f.state.html).toContain("Alpha");
    expect(f.state.html).not.toContain("Beta");
    expect(f.state.html).not.toContain("Gamma");
    expect(f.state.html).toContain("خصم الغياب والمرضية");
  });
  it("uses fresh payment identity, not snapshot line id or stale payment state", async () => {
    const f = fixture({ paymentStatusFilter: "paid", paymentMethodFilter: "cash" });
    const result = await f.c.fetchLatestClosing();
    expect(result.lines.map((r: any) => r.branchEmployeeId)).toEqual([1]);
    expect(result.unlinked).toEqual([]);
  });
  it.each(["returnedError", "throw"])("blocks export on payments failure: %s", async mode => {
    const f = fixture();
    if (mode === "throw") f.c.salaryPaymentsQuery.refetch.mockRejectedValue(new Error("offline"));
    else f.c.salaryPaymentsQuery.refetch.mockResolvedValue({ isError: true, data: [] });
    await f.run("exportSalaryClosingToExcel");
    expect(f.state.wb).toBeUndefined();
    expect(f.c.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "تعذر تحديث بيانات الصرف" }));
  });
  it("does not fall back to all employees on empty combined filters", async () => {
    const f = fixture({ nationalityFilter: "missing" });
    await f.run("exportSalaryClosingToPDF");
    expect(f.c.fetch).not.toHaveBeenCalled();
  });
  it("includes sick deductions once in accrued totals", () => {
    const f = fixture();
    expect(f.c.accruedTotalDed(f.rows[0])).toBe(50);
    expect(f.c.accruedNet(f.rows[0])).toBe(1000);
  });
  it("includes sick deductions in the actual server PDF table and totals", async () => {
    const pdfSource = readFileSync("server/pdf-generator.ts", "utf8");
    const pdfAst = ts.createSourceFile("pdf.ts", pdfSource, ts.ScriptTarget.Latest, true);
    const fn = pdfAst.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "generateSalaryClosingPdf")!;
    const context: any = {
      formatNumber: (n: number) => String(n), safeAverage: (n: number, d: number) => d ? n / d : 0,
      getPdfHeaderHtml: () => "", getPdfHeaderStyles: () => "", getPdfFooterStyles: () => "",
      getPdfFooterHtml: () => "", getSummaryHtml: (items: any) => JSON.stringify(items),
      formatPrintDate: () => "", generatePdfFromHtml: (html: string) => html,
    };
    const compiled = ts.transpileModule(fn.getText(pdfAst).replace("export ", "") + "\nreturn generateSalaryClosingPdf;", {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const render = new Function(...Object.keys(context), compiled)(...Object.values(context));
    const html = await render({ branchName: "Test", month: "2026-09", employees: [fixture().rows[0]] });
    expect(html).toContain("خصم الغياب والمرضية");
    expect(html).toContain("- 50");
    expect(html).toContain("1000");
  });
  it.each([
    { search: "Gamma", nationalityFilter: "all", jobTitleFilter: "all" },
    { netMin: "2500", nationalityFilter: "all", jobTitleFilter: "all" },
    { netMax: "1100" },
    { bankFilter: "has_bank" },
  ])("screen and refreshed export agree for %j", async filters => {
    const f = fixture(filters);
    expect((await f.c.fetchLatestClosing()).lines).toEqual(f.c.filterSalaryLines(f.rows));
  });
  it("bank workbook includes only matching eligible employees", async () => {
    const f = fixture();
    await f.run("exportBankFile", "2026-09-30");
    const workbook = JSON.stringify(f.state.wb);
    expect(workbook).toContain("Alpha");
    expect(workbook).not.toContain("Beta");
    expect(workbook).not.toContain("Gamma");
  });
  it("saved bank CSV sends only filtered snapshot line IDs", async () => {
    const f = fixture();
    f.c.salaryClosingPreviewQuery.refetch.mockResolvedValue({
      data: { lines: f.rows, isLocked: true, closure: { id: 7 } },
    });
    await f.run("exportSavedBankFile");
    expect(f.c.downloadFile).toHaveBeenCalledWith("/api/salary-closing/7/bank-file?lineIds=100", expect.any(String));
  });
  it("saved CSV endpoint rejects foreign or invalid line IDs and preserves selected order", async () => {
    const src = readFileSync("server/routes.ts", "utf8");
    const route = src.slice(src.indexOf('  app.get("/api/salary-closing/:id/bank-file"'), src.indexOf("  // PDF Generation endpoint for branch comparison report"));
    let handler: any;
    const context = {
      app: { get: (_: any, ...handlers: any[]) => { handler = handlers.at(-1); } },
      isAuthenticated: () => {}, requirePermission: () => () => {}, canAccessBranch: async () => true,
      storage: {
        getSalaryClosureById: async () => ({ branchId: "test", month: "2026-09" }),
        getSalaryClosureLines: async () => [{ id: 100, employeeName: "Alpha" }, { id: 101, employeeName: "Beta" }],
      },
    };
    new Function(...Object.keys(context), ts.transpileModule(route, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText)(...Object.values(context));
    for (const [lineIds, expected] of [["100", 200], ["999", 409], ["", 400], ["NaN", 400], ["101,100", 200]] as const) {
      const res: any = { code: 200, body: "", status(n: number) { this.code = n; return this; }, json(v: any) { this.body = v; },
        setHeader() {}, send(v: any) { this.body = v; } };
      await handler({ params: { id: "7" }, query: { lineIds } }, res);
      expect(res.code).toBe(expected);
      if (lineIds === "100") { expect(res.body).toContain("Alpha"); expect(res.body).not.toContain("Beta"); }
      if (lineIds === "101,100") expect(res.body.indexOf("Beta")).toBeLessThan(res.body.indexOf("Alpha"));
    }
  });
});