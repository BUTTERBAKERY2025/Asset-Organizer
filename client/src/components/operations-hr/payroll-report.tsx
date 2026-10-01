import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LEAVE_TYPE_LABELS, SALARY_DEDUCTION_TYPE_LABELS, SALARY_PAYMENT_METHOD_LABELS } from "@shared/schema";
import {
  emptyPayrollFilters, filterOperationsPayroll, payrollDateTime, payrollNumber, payrollSettlement,
  payrollSourceLabels, payrollStatusLabels, type OperationsPayrollLine, type OperationsPayrollPayment,
  type OperationsPayrollReport, type PayrollFilters,
} from "@/lib/operations-payroll-report";
import { OperationsPayrollAttendanceDetails } from "./payroll-attendance";
import { OperationsPayrollBranchSummary, OperationsPayrollFilteredSummary } from "./payroll-summary";

function DetailPopover({ label, value, children, tone = "" }: {
  label: string; value: ReactNode; children: ReactNode; tone?: string;
}) {
  return <Popover><PopoverTrigger asChild>
    <button type="button" aria-label={label} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Badge variant="outline" className={`cursor-pointer whitespace-nowrap ${tone}`}>{value}</Badge>
    </button>
  </PopoverTrigger><PopoverContent dir="rtl" side="top" className="max-h-96 w-80 overflow-y-auto text-xs">
    <h3 className="mb-2 font-bold">{label}</h3>{children}
  </PopoverContent></Popover>;
}
function Dates({ dates, empty }: { dates: string[]; empty: string }) {
  return dates.length ? <div className="mt-1 grid grid-cols-2 gap-1">{dates.map((date, index) =>
    <span dir="ltr" key={`${date}-${index}`} className="rounded bg-muted px-2 py-1 text-center font-mono">{date}</span>)}</div> : <p className="text-muted-foreground">{empty}</p>;
}
function AttendanceDays({ line }: { line: OperationsPayrollLine }) {
  return <>
    <td><DetailPopover label={`أيام الحضور · ${line.employeeName}`} value={`${payrollNumber(line.presentDays)}${line.originalPresentDays != null ? " ✎" : ""}`} tone="text-green-700">
      {line.originalPresentDays != null && <div className="mb-2 rounded border border-amber-300 p-2">
        <p className="font-bold">تم تعديل أيام الحضور بواسطة شؤون الموظفين</p>
        <p>قبل التعديل: {payrollNumber(line.originalPresentDays)} · بعد التعديل: {payrollNumber(line.presentDays)}</p>
        <p>السبب: {line.attendanceAdjustmentReason || "غير مسجل"}</p><p>المنفّذ: {line.attendanceAdjustmentBy || "غير مسجل"}</p>
      </div>}
      <Dates dates={line.presentDates} empty="لا توجد تواريخ حضور مسجلة." />
    </DetailPopover></td>
    <td><DetailPopover label={`أيام الغياب · ${line.employeeName}`} value={payrollNumber(line.absentDays)} tone="text-red-700">
      <p className="font-semibold">غياب صريح مسجل ({line.absentDatesExplicit.length})</p>
      <Dates dates={line.absentDatesExplicit} empty="لا توجد أيام غياب صريح مسجلة." />
      <p className="mt-3 font-semibold">أيام بدون تسجيل حضور ({line.absentDatesMissing.length})</p>
      <Dates dates={line.absentDatesMissing} empty="لا توجد أيام مفقودة." />
      <p className="mt-2 text-muted-foreground">تقرير الإغلاق المحفوظ يعرض تواريخ الغياب مجمّعة كغياب صريح، وقد تختلف الأعداد عن التواريخ عند وجود تعديل يدوي.</p>
    </DetailPopover></td>
    <td><DetailPopover label={`الراحات الأسبوعية · ${line.employeeName}`} value={payrollNumber(line.offDays)} tone="text-amber-700">
      <p className="mb-2">تُحتسب ضمن أيام الصرف.</p><Dates dates={line.offDates} empty="لا توجد تواريخ راحة مسجلة." />
    </DetailPopover></td>
    <td><DetailPopover label={`الإجازات المعتمدة · ${line.employeeName}`} value={line.leaveBreakdown.reduce((sum, leave) => sum + leave.days, 0)} tone="text-blue-700">
      {line.leaveBreakdown.length === 0 ? <p>لا توجد إجازات معتمدة محتسبة.</p> : line.leaveBreakdown.map(leave =>
        <p key={leave.type} className="mb-1 rounded bg-muted p-2">{LEAVE_TYPE_LABELS[leave.type] || leave.type} · {payrollNumber(leave.days)} يوم · {leave.paid ? "مدفوعة" : "مخصومة"}</p>)}
      <p className="mt-2">إجازة مدفوعة: {payrollNumber(line.paidLeaveDays)} · بدون راتب: {payrollNumber(line.unpaidLeaveDays)}</p>
      <p>مرضية بأجر 75%: {payrollNumber(line.sickThreeQuarterDays)} · مرضية بدون أجر: {payrollNumber(line.sickUnpaidDays)}</p>
      <p className="mt-2 text-muted-foreground">المرضية تخضع لشرائح المادة 117؛ الأيام بدون أجر ضمن خصم الغياب، وأيام 75% تُخصم بربع قيمة اليوم.</p>
    </DetailPopover></td>
  </>;
}
function PayrollFilter({ label, value, onChange, values }: {
  label: string; value: string; onChange: (value: string) => void; values: [string, string][] | string[];
}) {
  return <label className="text-xs">{label}<select value={value} onChange={event => onChange(event.target.value)} className="mt-1 min-h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
    <option value="all">الكل</option>{values.map(row => {
      const [key, name] = typeof row === "string" ? [row, row] : row;
      return <option key={key} value={key}>{name}</option>;
    })}
  </select></label>;
}

/** Read-only parity with HR's report columns/popovers, not HR's mutation controls. */
export function OperationsPayrollReportTable({ report, branchId, branchName, month, payments }: {
  report: OperationsPayrollReport; branchId: string; branchName: string; month: string;
  payments?: OperationsPayrollPayment[];
}) {
  const [filters, setFilters] = useState<PayrollFilters>(emptyPayrollFilters);
  const setFilter = (key: keyof PayrollFilters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  const lines = filterOperationsPayroll(report.lines, filters, payments);
  const distinct = (key: "jobTitle" | "nationality") => Array.from(new Set(report.lines.map(line => line[key]).filter(Boolean))).sort();
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => key === "search" ? value.trim() !== "" : value !== "all");
  const columns = ["#", "رقم الموظف", "الاسم / حالة الموظف", "الوظيفة", "الإدارة", "الجنسية", "الإقامة / الهوية", "مصدر البيانات",
    "البنك / الآيبان", "أيام العمل", "الحضور", "الغياب", "الراحات الأسبوعية", "الإجازات", "إجازات مدفوعة", "إجازات بدون راتب",
    "أيام مخصومة", "أيام التأخير", "ساعات الجدول", "الساعات الفعلية", "الراتب الأساسي", "بدل السكن", "البدلات", "إجمالي الراتب",
    "قيمة اليوم", "خصم الغياب", "خصم المرضية", "التأمينات (GOSI)", "سُلف / خصومات", "الصافي", "حالة الدفع", "المصروف المسجل", "المتبقي"];
  return <div className="mt-4 min-w-0 space-y-4" data-testid="operations-full-payroll-report">
    <OperationsPayrollBranchSummary report={report} branchName={branchName} month={month} payments={payments} />
    {report.enrichmentFailures?.map((failure, index) => <p key={`${failure.source}-${index}`} role="alert" className="text-sm text-destructive">{failure.message} · القيم المالية محفوظة؛ البيانات الحالية للموظف غير مكتملة.</p>)}
    {report.warnings.length > 0 && <details className="rounded-lg border border-border p-3 text-xs">
      <summary className="cursor-pointer font-semibold">تنبيهات تقرير شؤون الموظفين ({report.warnings.length})</summary>
      <ul className="mt-2 space-y-1">{report.warnings.map((warning, index) => <li key={`${warning.branchEmployeeId}-${warning.code}-${index}`}>{warning.message}</li>)}</ul>
    </details>}
    {report.unlinkedSummary.totalRecords > 0 && <p className="text-xs text-amber-700">سجلات حضور غير مرتبطة بموظف: {payrollNumber(report.unlinkedSummary.totalRecords)} · هذه السجلات لا تُسند إلى موظف في الكشف. {report.isLocked ? "تفاصيلها غير محفوظة في لقطة الإغلاق." : `سجلات الحضور: ${payrollNumber(report.unlinkedSummary.presentRecords)} · الساعات: ${payrollNumber(report.unlinkedSummary.totalHours)}`}</p>}
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
      <label className="text-xs sm:col-span-2">بحث في الموظفين<Input value={filters.search} onChange={event => setFilter("search", event.target.value)} placeholder="الاسم، الرقم، الوظيفة، الإدارة أو الآيبان" className="mt-1 h-9" /></label>
      <PayrollFilter label="حالة الموظف" value={filters.status} onChange={value => setFilter("status", value)} values={Object.entries(payrollStatusLabels)} />
      <PayrollFilter label="مصدر البيانات" value={filters.source} onChange={value => setFilter("source", value)} values={Object.entries(payrollSourceLabels)} />
      <PayrollFilter label="الوظيفة" value={filters.jobTitle} onChange={value => setFilter("jobTitle", value)} values={distinct("jobTitle")} />
      <PayrollFilter label="الجنسية" value={filters.nationality} onChange={value => setFilter("nationality", value)} values={distinct("nationality")} />
      <PayrollFilter label="البيانات البنكية" value={filters.bank} onChange={value => setFilter("bank", value)} values={[["available", "مسجلة"], ["missing", "غير مسجلة"]]} />
      <div className="flex items-end"><Button variant="outline" size="sm" onClick={() => setFilters(emptyPayrollFilters)}>إزالة الفلاتر</Button></div>
      {payments && <>
        <PayrollFilter label="حالة الدفع" value={filters.payment} onChange={value => setFilter("payment", value)} values={[["paid", "يوجد مؤشر صرف"], ["unpaid", "لا يوجد مؤشر صرف"]]} />
        <PayrollFilter label="طريقة الدفع" value={filters.paymentMethod} onChange={value => setFilter("paymentMethod", value)} values={Object.entries(SALARY_PAYMENT_METHOD_LABELS)} />
      </>}
    </div>
    {hasActiveFilters && <OperationsPayrollFilteredSummary lines={lines} fullCount={report.totals.employeeCount} payments={payments} />}
    <p className="text-sm text-muted-foreground">المعروض في الكشف: <bdi dir="ltr" className="tabular-nums">{payrollNumber(lines.length)}</bdi> من <bdi dir="ltr" className="tabular-nums">{payrollNumber(report.totals.employeeCount)}</bdi> موظف في كشف الفرع · المبالغ بالريال السعودي · اضغط أعداد الأيام والخصومات لعرض التفاصيل. مرّر أفقيًا لعرض جميع الأعمدة. التصدير يشمل تقرير الفرع الكامل ولا يتأثر بفلاتر العرض.</p>
    {report.lines.length === 0 ? <p className="rounded-lg border border-border p-4 text-sm">لا يوجد موظفون في تقرير الرواتب لهذا الفرع والشهر.</p> : lines.length === 0 ? <p className="rounded-lg border border-border p-4 text-sm">{!payments && (filters.payment !== "all" || filters.paymentMethod !== "all") ? "انتظر تحميل حالة الدفع أو أزل فلتر الدفع؛ لا يمكن تحديد المدفوع والمتبقي حاليًا." : "لا يوجد موظفون يطابقون البحث والفلاتر."}</p> :
      <div role="region" aria-label="تقرير الرواتب التفصيلي، قابل للتمرير أفقيًا وعموديًا" tabIndex={0} className="max-h-[65vh] max-w-full overflow-auto rounded-lg border border-border">
        <table className="w-full min-w-max border-separate border-spacing-0 text-center text-xs [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-3 [&_td]:align-top">
          <caption className="sr-only">تقرير رواتب {branchName} لشهر {month} · للقراءة فقط</caption>
          <thead className="sticky top-0 z-10 bg-muted"><tr>{columns.map(column => <th key={column} scope="col" className="whitespace-nowrap border-b border-border px-3 py-3">{column}</th>)}</tr></thead>
          <tbody>{lines.map((line, index) => {
            const settlement = payments ? payrollSettlement(line, payments) : undefined;
            const payment = settlement?.payment;
            return <tr key={`${line.branchEmployeeId ?? "unlinked"}-${line.id ?? index}`} className={line.noWorkAtAll ? "bg-destructive/5" : line.dataSource === "signed_timesheet" ? "bg-green-500/5" : ""}>
              <td>{index + 1}</td><td className="font-mono">{line.employeeNumber || "—"}</td>
              <td className="min-w-52 text-right"><strong>{line.employeeName}</strong><p className="mt-1"><Badge variant="outline" className={line.employeeStatus === "active" ? "text-green-700" : "text-red-700"}>{payrollStatusLabels[line.employeeStatus] || line.employeeStatus || "غير معروف"}</Badge></p>{line.noWorkAtAll && <p className="mt-1 text-destructive">لا توجد بيانات دوام للشهر</p>}</td>
              <td>{line.jobTitle || "—"}</td><td>{line.department || "—"}</td><td>{line.nationality || "—"}</td><td dir="ltr" className="font-mono">{line.iqamaNumber || "غير مسجل"}</td>
              <td>{payrollSourceLabels[line.dataSource] || line.dataSource || "غير مسجل"}</td>
              <td className="min-w-56 text-right">{line.bankName || (line.bankAccountNumber ? "البنك غير مسجل" : "بيانات بنكية غير مسجلة")}<p dir="ltr" className="mt-1 whitespace-nowrap text-left font-mono">{line.bankAccountNumber || "—"}</p></td>
              <td>{payrollNumber(line.scheduledWorkDays)}</td><AttendanceDays line={line} />
              <td>{payrollNumber(line.paidLeaveDays)}</td><td>{payrollNumber(line.unpaidLeaveDays)}</td><td>{payrollNumber(line.unpaidDays)}</td><td>{payrollNumber(line.lateDays)}</td><td>{payrollNumber(line.scheduledHours)}</td>
              <td>{payrollNumber(line.totalHours)}{line.branchEmployeeId != null && <OperationsPayrollAttendanceDetails branchId={branchId} month={month} branchEmployeeId={line.branchEmployeeId} employeeName={line.employeeName} isLocked={report.isLocked} />}</td>
              <td>{payrollNumber(line.baseSalary)}</td><td>{payrollNumber(line.housingAllowance)}</td><td>{payrollNumber(line.allowances)}</td><td>{payrollNumber(line.grossSalary)}</td><td>{payrollNumber(line.dailyRate)}</td>
              <td className="text-red-700">{payrollNumber(line.absenceDeduction)}</td><td className="text-red-700">{payrollNumber(line.sickLeaveDeduction)}</td><td className="text-red-700">{payrollNumber(line.socialInsurance)}</td>
              <td><DetailPopover label={`السُلف والخصومات · ${line.employeeName}`} value={payrollNumber(line.manualDeductionsTotal)} tone="text-red-700">
                {line.manualDeductions.length === 0 ? <p>لا توجد سُلف أو خصومات يدوية مسجلة.</p> : line.manualDeductions.map((deduction, i) => <div key={i} className="mb-2 rounded bg-muted p-2"><p>{SALARY_DEDUCTION_TYPE_LABELS[deduction.type] || deduction.type} · {payrollNumber(deduction.amount)} ر.س</p>{deduction.description && <p className="mt-1">{deduction.description}</p>}</div>)}
              </DetailPopover></td><td className="font-bold">{payrollNumber(line.netSalary)}</td>
              <td>{!settlement || line.branchEmployeeId == null ? <span className="text-muted-foreground">حالة الدفع غير متاحة</span> : payment ? <DetailPopover label={`سجل الصرف · ${line.employeeName}`} value={payment.amount == null ? "مؤشر صرف" : settlement.remaining === 0 ? "مدفوع" : "صرف جزئي"} tone="text-green-700">
                <p>الطريقة: {SALARY_PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}</p><p>التاريخ: {payrollDateTime(payment.paidAt)}</p>
                <p>المبلغ: {payrollNumber(payment.amount)} ر.س</p>{payment.notes && <p>ملاحظة: {payment.notes}</p>}
                {payment.amount == null && <p className="mt-2 text-amber-700">مؤشر صرف قديم بدون مبلغ؛ ليس دليلًا على تسوية كامل الراتب.</p>}
              </DetailPopover> : <Badge variant="outline" className="whitespace-nowrap text-amber-700">لا يوجد مؤشر صرف</Badge>}</td>
              <td>{settlement ? settlement.paid == null ? "المبلغ غير مسجل" : payrollNumber(settlement.paid) : "غير متاح"}</td>
              <td>{settlement ? settlement.remaining == null ? "غير معلوم" : payrollNumber(settlement.remaining) : "غير متاح"}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
  </div>;
}