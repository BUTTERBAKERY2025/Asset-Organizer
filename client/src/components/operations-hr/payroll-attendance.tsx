import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, shouldRetryQuery } from "@/lib/queryClient";
import { operationsReadState, payrollNumber, type OperationsPayrollAttendance } from "@/lib/operations-payroll-report";
import { OperationsQueryFeedback } from "./query-feedback";

const attendanceLabels: Record<string, string> = {
  present: "حاضر", late: "متأخر", absent: "غائب", day_off: "راحة", on_leave: "إجازة",
};
const statusLabel = (value: string) => attendanceLabels[value] || value;
const time = (value: string | null) => value || "غير مسجل";

export function OperationsPayrollAttendanceDetails({ branchId, month, branchEmployeeId, employeeName, isLocked }: {
  branchId: string; month: string; branchEmployeeId: number; employeeName: string; isLocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const details = useQuery<OperationsPayrollAttendance>({
    queryKey: ["/api/operations-hr/payroll/attendance", branchId, month, branchEmployeeId],
    queryFn: async () => {
      const data = await (await apiRequest("GET", `/api/operations-hr/payroll/attendance?${new URLSearchParams({
        branchId, month, branchEmployeeId: String(branchEmployeeId),
      })}`)).json() as OperationsPayrollAttendance;
      if (data.branchId !== branchId || data.month !== month || data.branchEmployeeId !== branchEmployeeId)
        throw new Error("تفاصيل الحضور لا تطابق الفرع والموظف والشهر المحددين.");
      return data;
    },
    enabled: open, staleTime: 0, gcTime: 0, placeholderData: undefined,
    refetchOnMount: "always", retry: shouldRetryQuery,
  });
  const state = operationsReadState(open, details);
  const data = state === "ready" ? details.data : undefined;
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs" aria-label={`تفاصيل الحضور والانصراف ${employeeName}`}>الحضور والانصراف</Button></DialogTrigger>
    <DialogContent dir="rtl" className="max-h-[85vh] max-w-4xl overflow-y-auto">
      <DialogHeader><DialogTitle>تفاصيل الحضور والانصراف · {employeeName}</DialogTitle></DialogHeader>
      <p className="text-xs text-muted-foreground">{month} · بيانات المصدر الحالية، للقراءة فقط.
        {isLocked ? " تقرير الراتب لقطة إغلاق محفوظة؛ سجلات الحضور التالية ليست لقطة تاريخية مجمّدة وقد تتغير." : " لا تغيّر هذه الشاشة الحساب أو سجلات الحضور."}</p>
      <OperationsQueryFeedback state={state} loading="جار تحميل تفاصيل الحضور والانصراف…" failure="تعذر تحميل تفاصيل الحضور؛ لم نعرض بيانات موظف آخر." error={details.error} onRetry={() => details.refetch()} />
      {data && <OperationsPayrollEvidenceTables data={data} />}
    </DialogContent>
  </Dialog>;
}

/** Isolated evidence view: no edit actions and no second source of payroll calculations. */
export function OperationsPayrollEvidenceTables({ data }: { data: OperationsPayrollAttendance }) {
  return <div className="space-y-5 text-sm">
        <section><h3 className="mb-2 font-bold">سجلات البصمة ({data.attendance.length})</h3>
          {data.attendance.length === 0 ? <p className="text-muted-foreground">لا توجد سجلات بصمة لهذا الموظف في الفرع والشهر المحددين.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-right text-xs">
            <thead><tr className="border-b"><th>التاريخ</th><th>الحالة</th><th>الدخول</th><th>الخروج</th><th>الساعات</th><th>بداية الجدول</th><th>نهاية الجدول</th><th>التأخير (دقيقة)</th><th>خروج مبكر (دقيقة)</th><th>إضافي (دقيقة)</th><th>ملاحظات</th></tr></thead>
            <tbody>{data.attendance.map(row => <tr key={row.id} className="border-b"><td className="py-2 font-mono">{row.attendanceDate}</td><td>{statusLabel(row.status)}</td><td dir="ltr">{time(row.checkInTime)}</td><td dir="ltr">{time(row.checkOutTime)}</td><td>{payrollNumber(row.workingHours)}</td><td dir="ltr">{time(row.scheduledStartTime)}</td><td dir="ltr">{time(row.scheduledEndTime)}</td><td>{payrollNumber(row.lateMinutes)}</td><td>{payrollNumber(row.earlyLeaveMinutes)}</td><td>{payrollNumber(row.overtimeMinutes)}</td><td>{row.notes || "—"}</td></tr>)}</tbody>
          </table></div>}
        </section>
        <section><h3 className="mb-2 font-bold">جدول العمل ({data.schedules.length})</h3>
          {data.schedules.length === 0 ? <p className="text-muted-foreground">لا يوجد جدول عمل مسجل.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-right text-xs">
            <thead><tr className="border-b"><th>التاريخ</th><th>النوع</th><th>البداية</th><th>النهاية</th><th>الاستراحة (دقيقة)</th><th>ملاحظات</th></tr></thead>
            <tbody>{data.schedules.map(row => <tr key={row.id} className="border-b"><td className="py-2 font-mono">{row.scheduleDate}</td><td>{row.isOff ? "راحة" : row.shiftType || "عمل"}</td><td dir="ltr">{time(row.startTime)}</td><td dir="ltr">{time(row.endTime)}</td><td>{payrollNumber(row.breakDuration)}</td><td>{row.notes || "—"}</td></tr>)}</tbody>
          </table></div>}
        </section>
        <section><h3 className="mb-2 font-bold">التايم شيت الموقّع ({data.signedTimesheets.length})</h3>
          {data.signedTimesheets.length === 0 && <p className="text-muted-foreground">لا يوجد تايم شيت موقّع.</p>}
          {data.signedTimesheets.map(report => <div key={report.id} className="mb-3 overflow-x-auto"><p className="mb-2 text-xs">تقرير #{report.id} · {report.status === "finalized" ? "نهائي موقّع" : report.status}</p>
            {report.entries.length === 0 ? <p className="text-muted-foreground">لا توجد أيام مسجلة في هذا التقرير ضمن الشهر.</p> : <table className="w-full min-w-[720px] text-right text-xs">
              <thead><tr className="border-b"><th>التاريخ</th><th>الحالة</th><th>الدخول</th><th>الخروج</th><th>ساعات الجدول</th><th>الساعات الفعلية</th><th>ملاحظات</th></tr></thead>
              <tbody>{report.entries.map((row, index) => <tr key={`${row.date}-${index}`} className="border-b"><td className="py-2 font-mono">{row.date}</td><td>{row.isOff ? "راحة" : statusLabel(row.status)}</td><td dir="ltr">{time(row.checkInTime)}</td><td dir="ltr">{time(row.checkOutTime)}</td><td>{payrollNumber(row.scheduledHours)}</td><td>{payrollNumber(row.actualHours)}</td><td>{row.notes || "—"}</td></tr>)}</tbody>
            </table>}
          </div>)}
        </section>
      </div>;
}