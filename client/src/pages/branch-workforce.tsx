import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignaturePad } from "@/components/signature-pad";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { apiRequest } from "@/lib/queryClient";

interface Employee { id: number; employeeName: string; linkedUserId: string | null; status: string }
interface Schedule { id: number; branchEmployeeId: number | null; employeeId: string; scheduleDate: string; startTime: string | null; endTime: string | null; isOff: boolean; shiftType: string | null }
interface Attendance { employeeId: string; branchEmployeeId: number | null; actualCheckIn: string | null; actualCheckOut: string | null }
interface Bundle {
  employees: Employee[]; schedules: Schedule[]; attendance: Attendance[];
  scheduleVersion: string; weeklyLock: unknown[];
  approvedLeaves: { branchEmployeeId: number; startDate: string; endDate: string }[];
}
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const yesterday = () => new Date(Date.parse(`${today()}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);

export default function BranchWorkforce() {
  const { user } = useAuth();
  const { canCreate, canEdit } = usePermissions();
  const branchId = user?.branchId;
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [edit, setEdit] = useState<{ employee: Employee; start: string; end: string; off: boolean } | null>(null);
  const [clock, setClock] = useState<{ employee: Employee; schedule?: Schedule; out: boolean } | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const bundle = useQuery<Bundle>({
    queryKey: ["/api/shift-management/bundle", "branch-workforce", user?.id, branchId, date],
    queryFn: async () => (await apiRequest("GET", `/api/shift-management/bundle?branchId=${encodeURIComponent(branchId!)}&startDate=${date}&endDate=${date}`)).json(),
    enabled: !!branchId, staleTime: 0, gcTime: 0,
  });
  async function saveSchedule() {
    if (!edit || !bundle.data) return;
    setPending(true); setError("");
    try {
      const response = await apiRequest("POST", "/api/employee-schedules/bulk", {
        schedules: [{ branchId, branchEmployeeId: edit.employee.id,
          employeeId: edit.employee.linkedUserId || `branch_emp_${edit.employee.id}`,
          employeeName: edit.employee.employeeName, scheduleDate: date,
          startTime: edit.off ? null : edit.start, endTime: edit.off ? null : edit.end,
          isOff: edit.off, status: "scheduled" }],
        baseline: { branchId, startDate: date, endDate: date, version: bundle.data.scheduleVersion },
      });
      const result = await response.json();
      if (result.errors?.length) throw new Error("تعذر حفظ بعض الجداول؛ حدّث الصفحة وراجع بيانات اليوم.");
      setEdit(null); await bundle.refetch();
    } catch (e: any) { setError(e.message); } finally { setPending(false); }
  }
  async function recordClock() {
    if (!clock || !signature) return;
    setPending(true); setError("");
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000, enableHighAccuracy: true }));
      await apiRequest("POST", `/api/attendance/${clock.out ? "check-out-employee" : "check-in-employee"}`, {
        branchId, employeeId: clock.employee.linkedUserId || `branch_emp_${clock.employee.id}`,
        employeeName: clock.employee.employeeName, scheduleId: clock.schedule?.id,
        scheduledStartTime: clock.schedule?.startTime, scheduledEndTime: clock.schedule?.endTime,
        attendanceDate: date, signature, userLatitude: position.coords.latitude, userLongitude: position.coords.longitude,
      });
      setClock(null); setSignature(null); await bundle.refetch();
    } catch (e: any) { setError(e.message || "تعذر التحقق من الموقع أو تسجيل الحضور"); } finally { setPending(false); }
  }
  return <Layout><div className="mx-auto max-w-5xl space-y-4 p-4" dir="rtl">
    <h1 className="text-2xl font-bold">حضور الفرع وجدولة الدوام</h1>
    <p className="text-muted-foreground">جدولة موظفي الفرع وتسجيل الحضور بالتوقيع والموقع. لا تشمل الرواتب أو ملفات الموظفين أو إدارة البصمات.</p>
    <Input className="w-48" type="date" aria-label="تاريخ الجدول والحضور" value={date} onChange={e => { setDate(e.target.value); setEdit(null); setClock(null); setError(""); }} />
    <Button variant="outline" onClick={() => bundle.refetch()} disabled={bundle.isFetching}>تحديث</Button>
    {!branchId && <p role="alert">يجب ربط الحساب بفرع.</p>}
    {(error || bundle.isError) && <p role="alert" className="text-destructive">{error || bundle.error?.message}</p>}
    {bundle.isLoading && <p>جارٍ تحميل موظفي الفرع…</p>}
    {edit && <Card><CardHeader><CardTitle>جدول {edit.employee.employeeName}</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-3">
      <label>البداية <Input type="time" value={edit.start} disabled={edit.off} onChange={e => setEdit({ ...edit, start: e.target.value })} /></label>
      <label>النهاية <Input type="time" value={edit.end} disabled={edit.off} onChange={e => setEdit({ ...edit, end: e.target.value })} /></label>
      <label><input type="checkbox" checked={edit.off} onChange={e => setEdit({ ...edit, off: e.target.checked })} /> راحة أسبوعية</label>
      <Button onClick={saveSchedule} disabled={pending || (!edit.off && (!edit.start || !edit.end))}>حفظ الجدول</Button>
      <Button variant="outline" onClick={() => setEdit(null)} disabled={pending}>إلغاء</Button>
    </CardContent></Card>}
    {clock && <Card><CardHeader><CardTitle>توقيع {clock.employee.employeeName} — {clock.out ? "انصراف" : "حضور"}</CardTitle></CardHeader><CardContent className="space-y-3">
      <SignaturePad key={`${clock.employee.id}-${clock.out}`} onSignatureChange={setSignature} disabled={pending} />
      <Button onClick={recordClock} disabled={pending || !signature}>تأكيد بالتوقيع والموقع</Button>
      <Button variant="outline" onClick={() => { setClock(null); setSignature(null); }} disabled={pending}>إلغاء</Button>
    </CardContent></Card>}
    {!bundle.isError && !bundle.isFetching && bundle.data?.employees.map(employee => {
      const schedule = bundle.data.schedules.find(s => s.branchEmployeeId === employee.id
        || (!s.branchEmployeeId && [employee.linkedUserId, `branch_emp_${employee.id}`].includes(s.employeeId)));
      const attendance = bundle.data.attendance.find(a => a.branchEmployeeId === employee.id || a.employeeId === (employee.linkedUserId || `branch_emp_${employee.id}`));
      const leave = bundle.data.approvedLeaves.some(l => l.branchEmployeeId === employee.id && l.startDate <= date && l.endDate >= date);
      const editable = employee.status === "active" && !leave && !bundle.data.weeklyLock.length;
      const canSchedule = schedule ? canEdit("branch_workforce") : canCreate("branch_workforce");
      return <Card key={employee.id}><CardHeader><CardTitle className="text-base">{employee.employeeName}</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-3">
        <span>{leave ? "إجازة معتمدة (غير قابلة للتعديل)" : schedule?.isOff ? "راحة أسبوعية" : schedule ? `${schedule.startTime ?? "—"} — ${schedule.endTime ?? "—"}` : "لم يُجدول بعد"}</span>
        <span>{attendance?.actualCheckIn ? attendance.actualCheckOut ? "تم الانصراف" : "على رأس العمل" : "لم يسجل الحضور"}</span>
        {editable && canSchedule && <Button variant="outline" disabled={pending} onClick={() => setEdit({ employee, start: schedule?.startTime || "08:00", end: schedule?.endTime || "16:00", off: schedule?.isOff || false })}>جدولة الدوام</Button>}
        {employee.status === "active" && !leave && !schedule?.isOff && (date === today() || date === yesterday()) && (
          attendance?.actualCheckIn && !attendance.actualCheckOut
            ? canEdit("branch_workforce") && <Button disabled={pending} onClick={() => { setClock({ employee, schedule, out: true }); setSignature(null); }}>تسجيل الانصراف</Button>
            : !attendance?.actualCheckIn && canCreate("branch_workforce") && <Button disabled={pending} onClick={() => { setClock({ employee, schedule, out: false }); setSignature(null); }}>تسجيل الحضور</Button>
        )}
      </CardContent></Card>;
    })}
  </div></Layout>;
}