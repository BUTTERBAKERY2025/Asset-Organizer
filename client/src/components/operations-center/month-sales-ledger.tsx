import type { OperationsMonthWorkflow } from "@shared/operations-month-workflow";
import type { OperationsSalesDay } from "@shared/operations-center";
import { monthMoney, operationsMonthPeriod } from "./month-workflow-presentation";

type SalesLedger = OperationsMonthWorkflow["sales"] & { daily?: OperationsSalesDay[] };
const count = (value: number | null | undefined) => value === null || value === undefined ? "غير متاح" : String(value);

/** Null daily values stay unknown even when another date has proven zero. */
export function MonthSalesLedger({ sales, month }: { sales: SalesLedger; month: string }) {
  const period = operationsMonthPeriod(month);
  const daily = sales.daily?.filter(day => period && day.date >= period.from && day.date <= period.to);
  return <section className="space-y-3" aria-label="تفاصيل المبيعات المسجلة للشهر">
    <div className="oc-month-metrics">
      <div className="oc-panel p-3"><span className="text-xs text-muted-foreground">إجمالي اليوميات المسجلة · ليس الصافي</span><strong className="mt-1 block text-xl">{monthMoney(sales.confirmed)}</strong></div>
      <div className="oc-panel p-3"><span className="text-xs text-muted-foreground">اليوميات المعتمدة أو المرحلة</span><strong className="mt-1 block text-xl">{count(sales.recordedCount)}</strong></div>
      <div className="oc-panel p-3"><span className="text-xs text-muted-foreground">أيام الفرع المسجلة</span><strong className="mt-1 block text-xl">{count(sales.recordedBranchDays)}</strong></div>
    </div>
    <div className="oc-panel space-y-1 p-3 text-xs leading-6"><strong>المصدر: يوميات الكاشير المعتمدة أو المرحلة</strong>
      <p>{sales.definition || "مجموع إجمالي المبيعات في يوميات الكاشير المعتمدة أو المرحلة؛ ليس مجموع الإغلاقات اليومية ولا صافي المبيعات بعد الاسترجاع."}</p>
      <p>الفترة: {period?.from} إلى {period?.to} · آخر يوم مسجل: {sales.lastRecordedDate || "غير متاح"}</p>
      <p>تغطية جزئية للأيام المسجلة فقط. اليوم بلا يومية ليس يومًا بصفر مبيعات، والمراجعة التشغيلية لا تعتمد هذه الأرقام.</p>
    </div>
    {sales.state === "no_records" && <p role="status" className="text-sm text-muted-foreground">لا توجد يوميات معتمدة أو مرحلة لهذا الفرع والشهر؛ لا نعرض إجماليًا مفترضًا يساوي صفرًا.</p>}
    <h4 className="font-bold">سجل المبيعات اليومي</h4>
    {daily && daily.length > 0 ? <div className="oc-evidence-table"><table>
      <caption>الأيام في الشهر المحدد · غير المسجل يبقى غير متاح</caption>
      <thead><tr><th scope="col">اليوم</th><th scope="col">المبيعات المسجلة</th><th scope="col">عدد اليوميات</th></tr></thead>
      <tbody>{daily.map(day => <tr key={day.date}><th scope="row">{day.date}</th><td>{monthMoney(day.value)}</td><td>{count(day.recordedCount)}</td></tr>)}</tbody>
    </table></div> : <p className="text-xs leading-6 text-muted-foreground">تفاصيل الأيام غير متاحة في رد المصدر الحالي؛ افتح مصدر المبيعات بنفس الفرع والفترة للاطلاع على اليوميات، ولا تستنتج أرقامًا من الإغلاقات اليومية.</p>}
  </section>;
}