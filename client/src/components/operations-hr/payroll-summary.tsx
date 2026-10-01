import type { ReactNode } from "react";
import {
  payrollNumber, payrollSettlement, type OperationsPayrollLine, type OperationsPayrollPayment,
  type OperationsPayrollReport,
} from "@/lib/operations-payroll-report";

type FinancialTotals = {
  [Key in keyof OperationsPayrollReport["totals"]]: number | null;
};
export type OperationsPayrollSummary = {
  totals: FinancialTotals;
  deductions: number | null;
  settlement: {
    paid: number | null;
    remaining: number | null;
    excess: number | null;
    knownCount: number;
    unknownCount: number;
  } | null;
};

const round2 = (value: number) => Math.round(value * 100) / 100;
/** Aggregate already-calculated HR amounts only; never derive an employee's salary. */
function sumAmounts(values: (number | null | undefined)[]): number | null {
  return values.every(value => typeof value === "number" && Number.isFinite(value))
    ? round2(values.reduce<number>((sum, value) => sum + (value as number), 0)) : null;
}

/**
 * Both scopes share the same aggregation and settlement rules. Full-branch salary
 * totals remain the server/snapshot totals. Filtered amounts sum those exact HR
 * line fields, with the same final two-decimal rounding as salary-closing-calc.
 */
export function aggregateOperationsPayrollSummary(
  lines: OperationsPayrollLine[],
  payments?: OperationsPayrollPayment[],
  authoritativeTotals?: OperationsPayrollReport["totals"],
): OperationsPayrollSummary {
  const totals: FinancialTotals = authoritativeTotals ?? {
    employeeCount: lines.length,
    totalBase: sumAmounts(lines.map(line => line.baseSalary)),
    totalAllowances: sumAmounts(lines.map(line => line.allowances)),
    totalGross: sumAmounts(lines.map(line => line.grossSalary)),
    totalAbsenceDeduction: sumAmounts(lines.map(line => line.absenceDeduction)),
    totalSickLeaveDeduction: sumAmounts(lines.map(line => line.sickLeaveDeduction)),
    totalSocialInsurance: sumAmounts(lines.map(line => line.socialInsurance)),
    totalManualDeductions: sumAmounts(lines.map(line => line.manualDeductionsTotal)),
    totalNet: sumAmounts(lines.map(line => line.netSalary)),
  };
  const deductions = sumAmounts([
    totals.totalAbsenceDeduction, totals.totalSickLeaveDeduction,
    totals.totalSocialInsurance, totals.totalManualDeductions,
  ]);
  if (!payments) return { totals, deductions, settlement: null };
  const settlements = lines.map(line => ({ line, ...payrollSettlement(line, payments) }));
  const known = settlements.filter(row => row.paid !== null && row.remaining !== null);
  const unknownCount = settlements.length - known.length;
  // An entirely unknown set is not zero. Partial sums are explicitly labelled below.
  const hasKnownAmounts = known.length > 0 || lines.length === 0;
  return {
    totals, deductions,
    settlement: {
      paid: hasKnownAmounts ? sumAmounts(known.map(row => row.paid)) : null,
      remaining: hasKnownAmounts ? sumAmounts(known.map(row => row.remaining)) : null,
      // Sum each employee's excess separately: it cannot settle another employee's balance.
      excess: hasKnownAmounts ? sumAmounts(known.map(row => round2(Math.max(0, row.paid! - row.line.netSalary)))) : null,
      knownCount: known.length,
      unknownCount,
    },
  };
}

function Amount({ value, className = "", unavailable = "غير مسجل" }: {
  value: number | null; className?: string; unavailable?: string;
}) {
  return <span className={`inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 ${className}`}>
    {value === null ? <span>{unavailable}</span> : <>
      <bdi dir="ltr" className="min-w-0 break-all tabular-nums">{payrollNumber(value)}</bdi>
      <span className="text-xs font-medium">ر.س</span>
    </>}
  </span>;
}

function BreakdownRow({ label, value }: { label: string; value: number | null }) {
  return <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd><Amount value={value} className="text-sm font-semibold" /></dd>
  </div>;
}

function SummaryCard({ title, children, testId }: { title: string; children: ReactNode; testId: string }) {
  return <div className="min-w-0 rounded-xl border border-violet-200/70 bg-background p-4 shadow-sm dark:border-violet-800/60" data-testid={testId}>
    <h3 className="mb-2 text-sm font-semibold text-violet-950 dark:text-violet-200">{title}</h3>
    {children}
  </div>;
}

function SettlementNotice({ settlement }: { settlement: OperationsPayrollSummary["settlement"] }) {
  if (!settlement) return <p className="text-sm text-muted-foreground">بيانات الصرف غير متاحة؛ لا يمكن تحديد المصروف أو المتبقي حاليًا.</p>;
  if (!settlement.unknownCount) return null;
  return <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
    المصروف والمتبقي غير معلومين لـ <bdi dir="ltr" className="font-semibold tabular-nums">{payrollNumber(settlement.unknownCount)}</bdi> موظف بسبب مؤشر صرف دون مبلغ أو عدم وجود معرّف موظف مرتبط.
    {settlement.knownCount > 0 && <> المبالغ المعروضة تخص فقط <bdi dir="ltr" className="font-semibold tabular-nums">{payrollNumber(settlement.knownCount)}</bdi> موظف معلوم المبلغ، وليست إجمالي تسوية الكشف.</>}
  </p>;
}

export function OperationsPayrollBranchSummary({ report, branchName, month, payments }: {
  report: OperationsPayrollReport; branchName: string; month: string; payments?: OperationsPayrollPayment[];
}) {
  const { totals, deductions, settlement } = aggregateOperationsPayrollSummary(report.lines, payments, report.totals);
  const partial = !!settlement?.unknownCount;
  return <section dir="rtl" aria-label="ملخص رواتب الفرع بالكامل" className="min-w-0 space-y-3" data-testid="operations-payroll-branch-summary">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-violet-950 dark:text-violet-200">ملخص رواتب الفرع بالكامل</h2>
        <p className="mt-1 break-words text-sm text-muted-foreground">{branchName} · <bdi dir="ltr" className="tabular-nums">{month}</bdi> · لا يتأثر بفلاتر الكشف</p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 font-semibold text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
          <bdi dir="ltr" className="tabular-nums">{payrollNumber(totals.employeeCount)}</bdi> موظف في كشف الفرع
        </span>
        <span className={`rounded-full border px-3 py-1 ${report.isLocked ? "border-violet-200 text-violet-900 dark:border-violet-800 dark:text-violet-200" : "border-amber-200 text-amber-900 dark:border-amber-800 dark:text-amber-200"}`}>
          {report.isLocked ? "لقطة إغلاق محفوظة" : "معاينة حية قابلة للتغير"}
        </span>
      </div>
    </div>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="flex min-w-0 flex-col justify-between rounded-xl border border-violet-600 bg-gradient-to-br from-violet-700 to-violet-600 p-4 text-white shadow-sm" data-testid="payroll-total-net">
        <div>
          <h3 className="text-sm font-semibold text-violet-100">صافي رواتب الفرع</h3>
          <Amount value={totals.totalNet} className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl" />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-violet-100">الصافي المحتسب من شؤون الموظفين، وليس المبلغ المتبقي للصرف.</p>
      </div>
      <SummaryCard title="إجمالي الرواتب قبل الخصومات" testId="payroll-total-gross">
        <Amount value={totals.totalGross} className="text-2xl font-bold text-violet-950 dark:text-violet-100" />
        <dl className="mt-4 space-y-2 border-t border-border pt-3">
          <BreakdownRow label="الراتب الأساسي" value={totals.totalBase} />
          <BreakdownRow label="إجمالي البدلات" value={totals.totalAllowances} />
        </dl>
      </SummaryCard>
      <SummaryCard title="إجمالي الخصومات" testId="payroll-total-deductions">
        <Amount value={deductions} className="text-2xl font-bold text-violet-950 dark:text-violet-100" />
        <dl className="mt-3 space-y-2 border-t border-border pt-3">
          <BreakdownRow label="خصم الغياب" value={totals.totalAbsenceDeduction} />
          <BreakdownRow label="خصم المرضية" value={totals.totalSickLeaveDeduction} />
          <BreakdownRow label="التأمينات (GOSI)" value={totals.totalSocialInsurance} />
          <BreakdownRow label="سُلف / خصومات" value={totals.totalManualDeductions} />
        </dl>
      </SummaryCard>
      <SummaryCard title="متابعة الصرف" testId="payroll-total-settlement">
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-muted-foreground">{partial ? "المصروف معلوم المبلغ" : "المصروف المسجل"}</dt>
            <dd className="mt-1"><Amount value={settlement?.paid ?? null} unavailable={settlement ? "غير معلوم" : "غير متاح"} className="text-2xl font-bold" /></dd>
          </div>
          <div className="border-t border-border pt-3">
            <dt className="text-sm text-muted-foreground">{partial ? "المتبقي معلوم المبلغ" : "المتبقي للصرف"}</dt>
            <dd className="mt-1"><Amount value={settlement?.remaining ?? null} unavailable={settlement ? "غير معلوم" : "غير متاح"} className="text-2xl font-bold text-violet-800 dark:text-violet-200" /></dd>
          </div>
          {settlement?.excess != null && settlement.excess > 0 && <div className="rounded-lg bg-amber-50 p-2 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200" data-testid="payroll-settlement-excess">
            <dt className="text-sm">زيادة صرف مسجلة عن الصافي{partial ? " (معلومة المبلغ)" : ""}</dt>
            <dd className="mt-1"><Amount value={settlement.excess} className="text-lg font-bold" /></dd>
            <p className="mt-1 text-xs">لا تسوّي متبقي موظف آخر.</p>
          </div>}
        </dl>
        {report.isLocked && settlement && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">حالة الصرف من السجلات الحالية، وليست جزءًا من لقطة الإغلاق.</p>}
      </SummaryCard>
    </div>
    <SettlementNotice settlement={settlement} />
    <p className="rounded-lg border border-violet-200/70 bg-violet-50/60 px-3 py-2 text-sm leading-relaxed text-violet-950 dark:border-violet-800/60 dark:bg-violet-950/30 dark:text-violet-200">
      ملخص للمراجعة التشغيلية، وليس اعتمادًا نهائيًا من شؤون الموظفين. القيم من احتساب شؤون الموظفين على الخادم، دون إعادة احتساب الراتب في المتصفح. جميع التفاصيل للقراءة فقط؛ مراجعة التشغيل لا تغلق الرواتب أو تصرفها.
    </p>
  </section>;
}

export function OperationsPayrollFilteredSummary({ lines, fullCount, payments }: {
  lines: OperationsPayrollLine[]; fullCount: number; payments?: OperationsPayrollPayment[];
}) {
  const { totals, deductions, settlement } = aggregateOperationsPayrollSummary(lines, payments);
  const partial = !!settlement?.unknownCount;
  const metrics = [
    { label: "صافي الكشف المعروض", value: totals.totalNet },
    { label: "الإجمالي قبل الخصومات", value: totals.totalGross },
    { label: "إجمالي الخصومات", value: deductions },
    { label: partial ? "المصروف معلوم المبلغ" : "المصروف المسجل", value: settlement?.paid ?? null, unavailable: settlement ? "غير معلوم" : "غير متاح" },
    { label: partial ? "المتبقي معلوم المبلغ" : "المتبقي للصرف", value: settlement?.remaining ?? null, unavailable: settlement ? "غير معلوم" : "غير متاح" },
  ];
  return <section dir="rtl" aria-label="ملخص الكشف المعروض بعد الفلاتر" className="min-w-0 space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20" data-testid="operations-payroll-filtered-summary">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-sm font-bold text-violet-950 dark:text-violet-200">ملخص الكشف المعروض بعد الفلاتر</h3>
      <p className="text-sm"><bdi dir="ltr" className="font-semibold tabular-nums">{payrollNumber(lines.length)}</bdi> من <bdi dir="ltr" className="tabular-nums">{payrollNumber(fullCount)}</bdi> موظف في كشف الفرع</p>
    </div>
    <dl className="grid min-w-0 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {metrics.map((metric, index) => <div key={metric.label} className="min-w-0">
        <dt className="text-sm text-muted-foreground">{metric.label}</dt>
        <dd className="mt-1"><Amount value={metric.value} unavailable={metric.unavailable} className={`text-lg font-bold ${index === 0 ? "text-violet-800 dark:text-violet-200" : ""}`} /></dd>
      </div>)}
    </dl>
    {settlement?.excess != null && settlement.excess > 0 && <p className="text-sm text-amber-900 dark:text-amber-200">زيادة صرف مسجلة عن صافي الموظفين المعروضين: <Amount value={settlement.excess} className="font-semibold" /></p>}
    <SettlementNotice settlement={settlement} />
    <p className="text-sm text-muted-foreground">جمع قيم صفوف شؤون الموظفين المعروضة فقط؛ لا يغيّر ملخص الفرع الكامل أعلاه أو نطاق التصدير.</p>
  </section>;
}