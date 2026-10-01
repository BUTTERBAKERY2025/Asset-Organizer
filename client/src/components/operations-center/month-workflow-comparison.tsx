import type { OperationsMonthAllWorkflow, OperationsMonthWorkflow } from "@shared/operations-month-workflow";
import { ArrowUpLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthFileLabels, monthFileState, monthMoney, monthNextStep, monthSourceLabels, validMonthSource, type MonthFileId } from "./month-workflow-presentation";
import { MonthSalesLedger } from "./month-sales-ledger";

const count = (value: number | null | undefined) => value === null || value === undefined ? "غير متاح" : String(value);
const reviewStatus = { closed: "مغلق", open: "مفتوح", reopened: "أعيد فتحه", unavailable: "غير متاح" };

export function MonthSourceState({ workflow, file }: { workflow: OperationsMonthWorkflow; file: MonthFileId }) {
  const state = monthFileState(workflow, file);
  return <span className="oc-month-state" data-state={state}>{monthSourceLabels[state]}</span>;
}

/** This view contains only evidence and source navigation. A branch drill loads
 * a fresh single workflow; aggregate revisions/capabilities are never reused. */
export function MonthWorkflowComparison({ data, file, busy, selectBranch, openSource, origin }: {
  data: OperationsMonthAllWorkflow; file: MonthFileId; busy: boolean; origin: string;
  selectBranch: (branchId: string) => void;
  openSource: (href: string, branchId: string) => void;
}) {
  const summary = data.totals[file];
  const coverage = summary.coverage;
  const totals: { label: string; value: number | null; field: string; money?: boolean }[] = file === "payroll"
    ? [{ label: "استحقاق اللقطات المغلقة", value: data.totals.payroll.due, field: "due", money: true },
      { label: "الصرف المسجل", value: data.totals.payroll.recordedPaid, field: "recordedPaid", money: true },
      { label: "عجز استحقاق الموظفين", value: data.totals.payroll.remaining, field: "remaining", money: true },
      { label: "زيادة صرف تحتاج مطابقة", value: data.totals.payroll.overpaid, field: "overpaid", money: true }]
    : file === "expenses"
      ? [{ label: "المصروفات المسجلة", value: data.totals.expenses.recorded, field: "recorded", money: true },
        { label: "المدفوع نقديًا", value: data.totals.expenses.paid, field: "paid", money: true }]
      : file === "sales"
        ? [{ label: "إجمالي اليوميات المسجلة", value: data.totals.sales.confirmed, field: "confirmed", money: true },
          { label: "اليوميات المعتمدة أو المرحلة", value: data.totals.sales.recordedCount, field: "recordedCount" },
          { label: "أيام الفروع المسجلة", value: data.totals.sales.recordedBranchDays, field: "recordedBranchDays" }]
        : [{ label: "مراجعات شهرية مغلقة", value: data.totals.closing.closedCount, field: "closedCount" },
          { label: "مراجعات مفتوحة", value: data.totals.closing.openCount, field: "openCount" },
          { label: "مراجعات أعيد فتحها", value: data.totals.closing.reopenedCount, field: "reopenedCount" },
          { label: "أدلة تغيرت بعد الإغلاق", value: data.totals.closing.driftedCount, field: "driftedCount" }];
  return <section className="space-y-4" aria-label={`مقارنة ${monthFileLabels[file]}`} data-testid="month-all-comparison">
    <header><p className="text-xs font-bold text-violet-700">كل الفروع المصرح بها · {data.month}</p><h3 className="mt-1 text-xl font-bold">{monthFileLabels[file]}</h3></header>
    <div className="oc-panel space-y-2 border-violet-200 bg-violet-50 p-4 text-sm">
      <strong>مقارنة للقراءة فقط · {data.scope.branchCount} فروع</strong>
      <p>يشمل النطاق كل الفروع التي أجازها السيرفر، وليس فقط الفروع المحددة في لوحة المركز. لا توجد إجراءات جماعية أو اعتماد مالي هنا.</p>
      <p className="text-xs">تغطية المصادر: {coverage.availableCount} متاح من {coverage.branchCount} · {coverage.partialCount} جزئي · {coverage.unavailableCount} غير متاح · {coverage.forbiddenCount} بلا صلاحية. الأرقام المعروفة فقط مجمعة؛ غير المعروف ليس صفرًا.</p>
    </div>
    <div className="oc-month-metrics">{totals.map(metric => {
      const evidence = (data.totals.metrics[file] as Record<string, { value: number | null; knownCount: number; unknownCount: number; state: string }>)[metric.field];
      return <article key={metric.field} className="oc-panel p-3">
        <span className="text-xs text-muted-foreground">{metric.label}</span>
        <strong className="mt-1 block text-lg">{metric.money ? monthMoney(metric.value) : count(metric.value)}</strong>
        {evidence && <p className="mt-1 text-[11px] text-muted-foreground">{evidence.state === "complete" ? "إجمالي الأدلة المتاحة" : evidence.state === "partial" ? "مجموع جزئي فقط" : "لا يوجد مبلغ / عدد مؤكد"} · معروف {evidence.knownCount} · غير معروف {evidence.unknownCount}</p>}
      </article>;
    })}</div>
    {file === "payroll" && <p className="text-xs leading-6 text-muted-foreground">الاستحقاق من لقطات الرواتب المغلقة فقط. عجز الموظفين وزيادة الصرف منفصلان؛ سداد زائد لموظف لا يسدد موظفًا آخر. لا يثبت مجموع دفعات مجهولة أو غير مطابقة تسوية الاستحقاق.</p>}
    {file === "expenses" && <p className="text-xs leading-6 text-muted-foreground">المصروفات قيود تكلفة وليست إثبات دفع. حالة المدفوع غير معروفة من هذا المصدر، ولا تشمل هذه القيود الرواتب أو تكلفة البضاعة.</p>}
    {file === "sales" && <div className="oc-panel p-3 text-xs leading-6"><strong>المصدر: يوميات الكاشير المعتمدة أو المرحلة</strong><p>{data.totals.sales.definition}</p><p>تغطية جزئية للشهر، لا تشمل الأيام التي لم تُسجّل يومياتها. ليست صافي المبيعات ولا مجموع الإغلاقات اليومية. آخر يوم مسجل: {data.totals.sales.lastRecordedDate || "غير متاح"}</p></div>}
    {file === "closing" && <p className="text-xs leading-6 text-muted-foreground">المراجعة الشهرية لقطة تشغيلية يومية محفوظة؛ لا تقفل الرواتب أو المصروفات أو المبيعات. التفاصيل المالية قراءة حية من مصادرها.</p>}
    <h4 className="text-sm font-bold">مقارنة الفروع والخطوة التالية</h4>
    {!data.branches.length && <p role="status" className="oc-panel p-4 text-sm">لا توجد فروع مصرح بها في الاستجابة الحالية.</p>}
    {data.branches.map(row => {
      const workflow = row.workflow;
      const href = workflow[file].sourceHref;
      const legalSource = href && validMonthSource(href, row.branchId, data.month, origin);
      return <article key={row.branchId} className="oc-panel oc-month-branch space-y-3 p-4">
        <header className="flex flex-wrap items-center justify-between gap-2"><h5 className="font-bold">{row.branchName}</h5><MonthSourceState workflow={workflow} file={file} /></header>
        {workflow[file].reason && <p className="text-xs leading-6 text-muted-foreground">{workflow[file].reason}</p>}
        {file === "payroll" && <dl className="oc-month-facts">
          <div><dt>استحقاق مغلق</dt><dd>{monthMoney(workflow.payroll.due)}</dd></div>
          <div><dt>الصرف المسجل</dt><dd>{monthMoney(workflow.payroll.recordedPaid)}</dd></div>
          <div><dt>العجز</dt><dd>{monthMoney(workflow.payroll.remaining)}</dd></div>
          <div><dt>الزيادة</dt><dd>{monthMoney(workflow.payroll.overpaid)}</dd></div>
        </dl>}
        {file === "expenses" && <p className="text-sm">مسجل: <strong>{monthMoney(workflow.expenses.recorded)}</strong> · مدفوع: <strong>غير متاح</strong></p>}
        {file === "sales" && <div className="space-y-2 text-sm"><p>إجمالي مسجل: <strong>{monthMoney(workflow.sales.confirmed)}</strong></p><p className="text-xs">اليوميات: {count(workflow.sales.recordedCount)} · أيام الفرع المسجلة: {count(workflow.sales.recordedBranchDays)} · آخر تسجيل: {workflow.sales.lastRecordedDate || "غير متاح"}</p>{workflow.sales.available && <details><summary className="cursor-pointer text-xs font-bold text-violet-700">سجل المبيعات اليومي لهذا الفرع</summary><div className="mt-3"><MonthSalesLedger sales={workflow.sales} month={data.month} /></div></details>}</div>}
        {file === "closing" && <div className="space-y-2 text-sm"><p>حالة المراجعة: <strong>{reviewStatus[workflow.closing.status]}</strong>{workflow.closing.drifted && " · تغيرت الأدلة"}</p><p className="text-xs">{workflow.closing.dailyEvidenceAvailable ? `${workflow.closing.dailyRecords.length} سجلات يومية` : "أدلة الأيام غير متاحة"} · {workflow.closing.dailyEvidenceAvailable && workflow.closing.reviewEvidenceAvailable ? `${workflow.closing.missingDates.length} أيام بلا دليل` : "اكتمال الأيام غير معروف"}</p>{!!workflow.closing.blockers.length && <details><summary className="cursor-pointer text-xs font-bold text-violet-700">العوائق والتواريخ ({workflow.closing.blockers.length})</summary><ul className="mt-2 list-inside list-disc text-xs leading-6">{workflow.closing.blockers.map((blocker, index) => <li key={index}>{blocker}</li>)}</ul></details>}{!!workflow.closing.dailyRecords.length && <details><summary className="cursor-pointer text-xs font-bold text-violet-700">سجلات الأيام ({workflow.closing.dailyRecords.length})</summary><ul className="mt-2 text-xs leading-6">{workflow.closing.dailyRecords.map(record => <li key={record.id}>{record.date} · سجل #{record.id} · {record.status === "closed" ? "مغلق" : record.status === "open" ? "مفتوح" : record.status}</li>)}</ul></details>}</div>}
        <p className="oc-month-next"><strong>الخطوة التالية: </strong>{monthNextStep(workflow, file)}</p>
        {href && !legalSource && workflow[file].available && <p role="alert" className="text-xs text-destructive">رابط المصدر لا يطابق هذا الفرع والشهر والفترة؛ لم نتيح فتحه.</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => selectBranch(row.branchId)}>تفاصيل الفرع ومراجعته <ArrowUpLeft className="mr-1 size-4" /></Button>
          {legalSource && workflow[file].available && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => openSource(href!, row.branchId)}>فتح مصدر هذا الفرع <ArrowUpLeft className="mr-1 size-4" /></Button>}
        </div>
      </article>;
    })}
  </section>;
}