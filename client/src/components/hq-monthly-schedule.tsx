import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, getDaysInMonth, addMonths, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarDays, ChevronRight, ChevronLeft, Users, Save, Clock, Coffee } from "lucide-react";

// وضع الجدولة الشهرية الموحدة — خاص بفرع المركز الرئيسي (الإدارة المركزية):
// - وردية واحدة موحدة لجميع الموظفين
// - الجمعة إجازة أسبوعية للجميع
// - التوليد والحفظ يتم لكامل الشهر دفعة واحدة
// لا يؤثر إطلاقاً على الجدولة الأسبوعية لباقي الفروع.
export const HQ_BRANCH_ID = "main_warehouse";

const FRIDAY = 5; // getDay(): الجمعة = 5

type Cell = { startTime: string; endTime: string; isOff: boolean };

type BundleEmployee = {
  id: number;
  employeeName: string;
  position?: string | null;
  status: string;
  branchId: string;
  linkedUserId?: string | null;
};

type BundleSchedule = {
  employeeId: string;
  branchEmployeeId?: number | null;
  scheduleDate: string;
  startTime?: string | null;
  endTime?: string | null;
  isOff: boolean;
};

type ApprovedLeave = { branchEmployeeId: number; startDate: string; endDate: string; leaveType?: string };

export default function HQMonthlySchedule({ branchId, branchName }: { branchId: string; branchName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [grid, setGrid] = useState<Record<string, Record<string, Cell>>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const monthStart = useMemo(() => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), [currentMonth]);
  const daysInMonth = getDaysInMonth(monthStart);
  const startDateStr = format(monthStart, "yyyy-MM-dd");
  const endDateStr = format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), daysInMonth), "yyyy-MM-dd");

  const dates = useMemo(() => {
    const out: { dateStr: string; day: number; isFriday: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
      out.push({ dateStr: format(dt, "yyyy-MM-dd"), day: d, isFriday: dt.getDay() === FRIDAY });
    }
    return out;
  }, [currentMonth, daysInMonth]);

  const { data: bundle, isLoading } = useQuery<{
    shiftProfiles: { shiftCode: string; displayName: string; startTime: string; endTime: string; isActive: boolean }[];
    employees: BundleEmployee[];
    schedules: BundleSchedule[];
    approvedLeaves?: ApprovedLeave[];
    scheduleVersion?: string;
  }>({
    queryKey: ["/api/shift-management/bundle", branchId, startDateStr, endDateStr],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId, startDate: startDateStr, endDate: endDateStr });
      const res = await apiRequest("GET", `/api/shift-management/bundle?${params}`);
      return await res.json();
    },
  });

  const employees = useMemo(() => {
    const list = (bundle?.employees || []).filter(e => e.branchId === branchId);
    return [...list].sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1));
  }, [bundle?.employees, branchId]);
  const activeEmployees = useMemo(() => employees.filter(e => e.status === "active"), [employees]);

  const activeProfiles = useMemo(() => (bundle?.shiftProfiles || []).filter(p => p.isActive !== false), [bundle?.shiftProfiles]);

  // تعبئة وقت الوردية من إعدادات الورديات عند توفرها (مع إمكانية التعديل اليدوي)
  useEffect(() => {
    if (!selectedProfile && activeProfiles.length > 0) {
      const p = activeProfiles[0];
      setSelectedProfile(p.shiftCode);
      if (p.startTime) setStartTime(p.startTime);
      if (p.endTime) setEndTime(p.endTime);
    }
  }, [activeProfiles, selectedProfile]);

  const applyProfile = (code: string) => {
    setSelectedProfile(code);
    const p = activeProfiles.find(x => x.shiftCode === code);
    if (p) {
      setStartTime(p.startTime || "09:00");
      setEndTime(p.endTime || "18:00");
    }
  };

  const leaveByEmp = useMemo(() => {
    const m = new Map<number, ApprovedLeave[]>();
    for (const l of bundle?.approvedLeaves || []) {
      if (!m.has(l.branchEmployeeId)) m.set(l.branchEmployeeId, []);
      m.get(l.branchEmployeeId)!.push(l);
    }
    return m;
  }, [bundle?.approvedLeaves]);

  const isApprovedLeave = (empId: number, dateStr: string) =>
    (leaveByEmp.get(empId) || []).some(l => dateStr >= l.startDate && dateStr <= l.endDate);

  // تحميل الجدول المحفوظ من السيرفر إلى الشبكة
  useEffect(() => {
    if (!bundle || hasChanges) return;
    const next: Record<string, Record<string, Cell>> = {};
    const empLookup = new Map<string, string>();
    for (const emp of employees) {
      empLookup.set(`branch_emp_${emp.id}`, String(emp.id));
      if (emp.linkedUserId) empLookup.set(emp.linkedUserId, String(emp.id));
    }
    for (const s of bundle.schedules || []) {
      const key = s.branchEmployeeId ? String(s.branchEmployeeId) : (empLookup.get(s.employeeId) || s.employeeId);
      if (!next[key]) next[key] = {};
      next[key][s.scheduleDate] = {
        startTime: s.startTime || "09:00",
        endTime: s.endTime || "18:00",
        isOff: s.isOff,
      };
    }
    setGrid(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, startDateStr, employees.length]);

  const generateMonth = () => {
    if (activeEmployees.length === 0) {
      toast({ title: "تنبيه", description: "لا يوجد موظفون نشطون في المركز الرئيسي", variant: "destructive" });
      return;
    }
    setGrid(prev => {
      const next: Record<string, Record<string, Cell>> = { ...prev };
      for (const emp of activeEmployees) {
        const key = String(emp.id);
        next[key] = { ...(next[key] || {}) };
        for (const d of dates) {
          if (isApprovedLeave(emp.id, d.dateStr)) continue; // الإجازات المعتمدة لا تُلمس
          next[key][d.dateStr] = { startTime, endTime, isOff: d.isFriday };
        }
      }
      return next;
    });
    setHasChanges(true);
    toast({
      title: "تم توليد جدول الشهر",
      description: `${format(monthStart, "MMMM yyyy", { locale: ar })} — دوام موحد (${startTime} - ${endTime})، الجمعة إجازة للجميع. اضغط حفظ للتأكيد`,
    });
  };

  const toggleCell = (emp: BundleEmployee, dateStr: string) => {
    if (emp.status !== "active") {
      toast({ title: "موظف غير نشط", description: "جدول هذا الموظف للعرض فقط", variant: "destructive" });
      return;
    }
    if (isApprovedLeave(emp.id, dateStr)) {
      toast({ title: "إجازة معتمدة", description: "هذا اليوم مغطى بإجازة معتمدة من نظام الإجازات", variant: "destructive" });
      return;
    }
    // الجمعة إجازة أسبوعية ثابتة للجميع في المركز الرئيسي — غير قابلة للتعديل
    if (new Date(dateStr + "T12:00:00").getDay() === FRIDAY) {
      toast({ title: "الجمعة إجازة ثابتة", description: "الجمعة إجازة أسبوعية موحدة لجميع موظفي الإدارة المركزية", variant: "destructive" });
      return;
    }
    const key = String(emp.id);
    setGrid(prev => {
      const cur = prev[key]?.[dateStr];
      const next = { ...prev, [key]: { ...(prev[key] || {}) } };
      if (!cur) {
        next[key][dateStr] = { startTime, endTime, isOff: false };
      } else {
        next[key][dateStr] = { ...cur, isOff: !cur.isOff };
      }
      return next;
    });
    setHasChanges(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const schedules: any[] = [];
      // الحفظ الشهري يضمن شهراً كاملاً: أي يوم ناقص لأي موظف نشط يُستكمل تلقائياً
      // بالوردية الموحدة (والجمعة إجازة) حتى لا يبقى موظف بلا جدول يمنعه من التحضير.
      for (const emp of activeEmployees) {
        const key = String(emp.id);
        const empGrid = grid[key] || {};
        for (const d of dates) {
          if (isApprovedLeave(emp.id, d.dateStr)) continue;
          const cell = empGrid[d.dateStr] || { startTime, endTime, isOff: d.isFriday };
          const isOff = d.isFriday ? true : cell.isOff; // الجمعة إجازة دائماً
          schedules.push({
            employeeId: emp.linkedUserId || `branch_emp_${emp.id}`,
            employeeName: emp.employeeName || "غير معروف",
            branchEmployeeId: emp.id,
            scheduleDate: d.dateStr,
            dayOfWeek: dayNames[new Date(d.dateStr + "T12:00:00").getDay()],
            startTime: isOff ? null : (cell.startTime || startTime),
            endTime: isOff ? null : (cell.endTime || endTime),
            shiftType: isOff ? null : "morning",
            isOff,
            branchId,
          });
        }
      }
      if (schedules.length === 0) throw new Error("لا توجد بيانات للحفظ — اضغط «توليد جدول الشهر» أولاً");
      const res = await apiRequest("POST", "/api/employee-schedules/bulk", {
        schedules,
        baseline: bundle?.scheduleVersion != null ? {
          branchId,
          startDate: startDateStr,
          endDate: endDateStr,
          version: bundle.scheduleVersion,
        } : undefined,
        force: true, // الوضع الشهري يحفظ الشهر كاملاً — يتجاوز فحص تعارض النسخ الأسبوعي
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`خطأ في الخادم (${res.status}) - يرجى المحاولة مرة أخرى`);
      }
      return await res.json();
    },
    onSuccess: async (data: any) => {
      setHasChanges(false);
      await queryClient.refetchQueries({ queryKey: ["/api/shift-management/bundle", branchId, startDateStr, endDateStr] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-schedules"] });
      if (data?.errors && data.errors.length > 0) {
        toast({
          title: `تم حفظ ${data.saved || 0} من ${data.total || 0} (حفظ جزئي)`,
          description: data.errors[0],
          variant: "destructive",
        });
      } else {
        toast({ title: "تم حفظ جدول الشهر بنجاح", description: `${data?.saved || 0} سجل دوام` });
      }
    },
    onError: (error: any) => {
      let msg = error?.message || "خطأ غير معروف";
      if (msg.includes("<!DOCTYPE") || msg.includes("<html")) msg = "خطأ في الخادم - يرجى المحاولة مرة أخرى";
      toast({ title: "فشل حفظ الجدول", description: msg.substring(0, 300), variant: "destructive" });
    },
  });

  const offCount = (empId: string) => Object.values(grid[empId] || {}).filter(c => c.isOff).length;
  const workCount = (empId: string) => Object.values(grid[empId] || {}).filter(c => !c.isOff).length;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              الجدولة الشهرية الموحدة - {branchName}
            </CardTitle>
            <CardDescription className="mt-1">
              {format(monthStart, "MMMM yyyy", { locale: ar })} — دوام موحد لجميع موظفي الإدارة، والجمعة إجازة أسبوعية للجميع
            </CardDescription>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="btn-hq-prev-month">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="h-9" onClick={() => setCurrentMonth(new Date())} data-testid="btn-hq-current-month">
              هذا الشهر
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="btn-hq-next-month">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-lg border bg-muted/40">
          {activeProfiles.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">الوردية المحفوظة</div>
              <Select value={selectedProfile} onValueChange={applyProfile}>
                <SelectTrigger className="w-52 h-10" data-testid="select-hq-shift-profile">
                  <Clock className="w-4 h-4 ml-2" />
                  <SelectValue placeholder="اختر وردية" />
                </SelectTrigger>
                <SelectContent>
                  {activeProfiles.map(p => (
                    <SelectItem key={p.shiftCode} value={p.shiftCode}>
                      {p.displayName} ({p.startTime} - {p.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground mb-1">من</div>
            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-28 h-10" data-testid="input-hq-start-time" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">إلى</div>
            <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-28 h-10" data-testid="input-hq-end-time" />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground pb-2.5">
            <Coffee className="w-3.5 h-3.5" />
            استراحة ساعة (12:00 - 01:00 ظهراً)
          </div>
          <div className="flex gap-2 mr-auto">
            <Button onClick={generateMonth} className="gap-2 h-10" data-testid="btn-hq-generate-month">
              <Users className="w-4 h-4" />
              توليد جدول الشهر للجميع
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              variant={hasChanges ? "default" : "outline"}
              className="gap-2 h-10"
              data-testid="btn-hq-save-month"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ الشهر
            </Button>
          </div>
        </div>

        {hasChanges && (
          <div className="mb-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2" data-testid="banner-hq-unsaved">
            يوجد تغييرات غير محفوظة — اضغط «حفظ الشهر» لتأكيدها
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin ml-2" /> جاري التحميل...
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">لا يوجد موظفون في هذا الفرع</div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs" dir="rtl">
              <thead>
                <tr className="bg-muted/60">
                  <th className="sticky right-0 bg-muted p-2 text-right min-w-[160px] z-10">الموظف</th>
                  {dates.map(d => (
                    <th key={d.dateStr} className={`p-1 text-center min-w-[28px] ${d.isFriday ? "bg-emerald-100 dark:bg-emerald-950/40" : ""}`}>
                      <div className="font-bold">{d.day}</div>
                      <div className="text-[9px] text-muted-foreground">{format(new Date(d.dateStr + "T12:00:00"), "EEEEE", { locale: ar })}</div>
                    </th>
                  ))}
                  <th className="p-2 text-center min-w-[60px]">دوام/إجازة</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const key = String(emp.id);
                  const inactive = emp.status !== "active";
                  return (
                    <tr key={emp.id} className={`border-t ${inactive ? "opacity-60" : ""}`} data-testid={`row-hq-emp-${emp.id}`}>
                      <td className="sticky right-0 bg-background p-2 z-10">
                        <div className="font-medium truncate max-w-[150px]">{emp.employeeName}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                          {emp.position || ""}
                          {inactive && <Badge variant="outline" className="mr-1 text-[9px]">غير نشط</Badge>}
                        </div>
                      </td>
                      {dates.map(d => {
                        const cell = grid[key]?.[d.dateStr];
                        const leave = isApprovedLeave(emp.id, d.dateStr);
                        let cls = "bg-muted/30 text-muted-foreground"; // لا جدول
                        let label = "—";
                        if (leave) { cls = "bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200"; label = "إ"; }
                        else if (cell?.isOff) { cls = "bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200"; label = "ج"; }
                        else if (cell) { cls = "bg-primary/15 text-primary"; label = "✓"; }
                        return (
                          <td
                            key={d.dateStr}
                            onClick={() => toggleCell(emp, d.dateStr)}
                            className={`p-0.5 text-center cursor-pointer select-none border-r border-border/40 ${cls} ${inactive || leave ? "cursor-not-allowed" : "hover:opacity-70"}`}
                            title={leave ? "إجازة معتمدة" : cell?.isOff ? "إجازة أسبوعية" : cell ? `${cell.startTime} - ${cell.endTime}` : "بدون جدول"}
                          >
                            {label}
                          </td>
                        );
                      })}
                      <td className="p-1 text-center whitespace-nowrap text-[10px] text-muted-foreground">
                        {workCount(key)} / {offCount(key)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
          <span><span className="inline-block w-3 h-3 rounded-sm bg-primary/15 align-middle ml-1" />✓ دوام ({startTime} - {endTime})</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/60 align-middle ml-1" />ج إجازة أسبوعية (الجمعة)</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-amber-200 dark:bg-amber-900/60 align-middle ml-1" />إ إجازة معتمدة (مقفلة)</span>
          <span>اضغط على أي خلية لتبديل دوام/إجازة</span>
        </div>
      </CardContent>
    </Card>
  );
}
