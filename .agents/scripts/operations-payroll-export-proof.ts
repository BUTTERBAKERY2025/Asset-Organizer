import { mkdirSync, writeFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { operationsPayrollPdfBlob, operationsPayrollXlsxBlob } from "../../client/src/lib/operations-payroll-export";
import { buildOperationsPayrollExport } from "../../server/operations-payroll-export";
import { operationsPayrollFullCsv, type OperationsPayrollExportLine } from "../../shared/operations-payroll-export";
import * as xlsx from "xlsx";

// Local-only synthetic export proof. No requests, real employee data or business mutations.
const employee: OperationsPayrollExportLine = {
  id: null, branchEmployeeId: 1, employeeNumber: "SYNTHETIC-001", employeeName: "موظف اختبار صناعي",
  employeeStatus: "active", jobTitle: "وظيفة اختبار", department: "إدارة اختبار", nationality: "اختبار",
  iqamaNumber: null, bankName: "بنك اختبار", bankAccountNumber: "000000",
  presentDays: 0, originalPresentDays: null, attendanceAdjustmentReason: null, attendanceAdjustmentBy: null,
  absentDays: 30, offDays: 0, paidLeaveDays: 0, unpaidLeaveDays: 0, unpaidDays: 30,
  sickThreeQuarterDays: 0, sickUnpaidDays: 0, scheduledWorkDays: 30, scheduledHours: 240,
  lateDays: 0, totalHours: 0, baseSalary: 4000, housingAllowance: 0, allowances: 0,
  grossSalary: 4000, dailyRate: 133.33333333333334, absenceDeduction: 4000, sickLeaveDeduction: 0,
  socialInsurance: 0, manualDeductionsTotal: 0, manualDeductions: [], netSalary: 0,
  leaveBreakdown: [], presentDates: [], absentDates: Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`),
  absentDatesExplicit: [], absentDatesMissing: Array.from({ length: 30 }, (_, index) => `2026-09-${String(index + 1).padStart(2, "0")}`), offDates: [],
  dataSource: "attendance_only", noWorkAtAll: true,
};
const data = buildOperationsPayrollExport({
  branchId: "synthetic", branchName: "فرع اختبار صناعي", month: "2026-09",
  generatedAt: "2026-10-01T08:00:00.000Z", payments: [],
  report: {
    lines: [employee], totals: { employeeCount: 1, totalBase: 4000, totalAllowances: 0, totalGross: 4000,
      totalAbsenceDeduction: 4000, totalSickLeaveDeduction: 0, totalSocialInsurance: 0, totalManualDeductions: 0, totalNet: 0 },
    isLocked: false, warnings: [], enrichmentFailures: [],
    unlinkedSummary: { totalRecords: 0, presentRecords: 0, totalHours: 0 },
  },
});
const stem = process.argv[2] ?? ".agents/outputs/operations-payroll-export-synthetic";
mkdirSync(stem.slice(0, stem.lastIndexOf("/")), { recursive: true });
writeFileSync(`${stem}.pdf`, Buffer.from(await (await operationsPayrollPdfBlob(data)).arrayBuffer()));
const excelBytes = new Uint8Array(await (await operationsPayrollXlsxBlob(data)).arrayBuffer());
writeFileSync(`${stem}.xlsx`, excelBytes);
const csv = operationsPayrollFullCsv(data);
writeFileSync(`${stem}.csv`, csv);
const reopened = xlsx.read(excelBytes, { type: "array" });
const excelRows: any[][] = xlsx.utils.sheet_to_json(reopened.Sheets["كامل رواتب الفرع"], { header: 1 });
const reopenedCsv = xlsx.read(csv, { type: "string", raw: true });
const csvRows: any[][] = xlsx.utils.sheet_to_json(reopenedCsv.Sheets[reopenedCsv.SheetNames[0]], { header: 1 });
const csvHeading = csvRows.findIndex(row => row[0] === "معرف الموظف");
assert(csvHeading >= 0);
for (const [heading, value] of [["الإجمالي", 4000], ["خصم الأيام غير المدفوعة", 4000], ["الصافي", 0], ["المصروف", 0], ["المتبقي", 0]] as const) {
  assert.equal(excelRows[1][excelRows[0].indexOf(heading)], value, `XLSX ${heading}`);
  assert.equal(Number(csvRows[csvHeading + 1][csvRows[csvHeading].indexOf(heading)]), value, `CSV ${heading}`);
}
assert(csv.includes('"4000","0","0","0"'));
assert(csv.includes('"الصافي","0"'));
assert(csv.includes("موظف اختبار صناعي"));
assert.equal(data.lines[0].netSalary, 0);
console.log(`Synthetic PDF, XLSX, CSV: ${stem}.*; XLSX/CSV gross=4000, absence deduction=4000, net/paid/outstanding=0 verified.`);