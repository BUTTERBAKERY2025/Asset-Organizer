import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Users, Plus, Copy, Save, Trash2, Check, X, ChevronRight, ChevronLeft, FileText, UserCheck, AlertCircle, Building2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, parseISO, isSameDay } from "date-fns";
import { ar } from "date-fns/locale";
import type { User, Branch, SchedulePeriod, EmployeeSchedule, AttendanceRecord } from "@shared/schema";
import { DAYS_OF_WEEK_LABELS, SHIFT_TYPE_LABELS, ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_ICONS } from "@shared/schema";

const DAYS_ORDER = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-amber-100 text-amber-700",
};

export default function ShiftManagementPage() {
  const [activeTab, setActiveTab] = useState("schedule");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    return startOfWeek(now, { weekStartsOn: 6 });
  });
  const [isCreatePeriodOpen, setIsCreatePeriodOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<SchedulePeriod | null>(null);
  const [scheduleData, setScheduleData] = useState<Record<string, Record<string, { startTime: string; endTime: string; isOff: boolean; shiftType: string }>>>({});
  const [isBulkShiftOpen, setIsBulkShiftOpen] = useState(false);
  const [bulkShiftForm, setBulkShiftForm] = useState({
    name: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "08:00",
    endTime: "16:00",
    supervisorName: "",
    notes: "",
  });
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: branches } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: periods } = useQuery<SchedulePeriod[]>({
    queryKey: ["/api/schedule-periods", selectedBranch],
  });
  const { data: employeeSchedules } = useQuery<EmployeeSchedule[]>({
    queryKey: ["/api/employee-schedules", selectedPeriod?.id],
    enabled: !!selectedPeriod,
  });
  const { data: todayAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", format(new Date(), "yyyy-MM-dd"), selectedBranch],
  });
  const { data: attendanceStats } = useQuery<{
    date: string;
    total: number;
    present: number;
    late: number;
    absent: number;
    earlyLeave: number;
    onLeave: number;
    attendanceRate: number;
  }>({
    queryKey: ["/api/attendance/stats/today", selectedBranch],
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (selectedBranch === "all") return users.filter(u => u.isActive === "active");
    return users.filter(u => u.branchId === selectedBranch && u.isActive === "active");
  }, [users, selectedBranch]);

  useEffect(() => {
    if (user?.role !== "admin" && user?.branchId && selectedBranch === "all") {
      setSelectedBranch(user.branchId);
    }
  }, [user, selectedBranch]);

  useEffect(() => {
    if (employeeSchedules && Array.isArray(employeeSchedules) && employeeSchedules.length > 0) {
      const newScheduleData: Record<string, Record<string, { startTime: string; endTime: string; isOff: boolean; shiftType: string }>> = {};
      employeeSchedules.forEach((schedule: EmployeeSchedule) => {
        if (!newScheduleData[schedule.employeeId]) {
          newScheduleData[schedule.employeeId] = {};
        }
        newScheduleData[schedule.employeeId][schedule.scheduleDate] = {
          startTime: schedule.startTime || "",
          endTime: schedule.endTime || "",
          isOff: schedule.isOff,
          shiftType: schedule.shiftType || "morning",
        };
      });
      setScheduleData(newScheduleData);
    }
  }, [employeeSchedules]);

  const createPeriodMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await apiRequest("/api/schedule-periods", "POST", data);
      return result as unknown as SchedulePeriod;
    },
    onSuccess: (period) => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-periods"] });
      setSelectedPeriod(period);
      setIsCreatePeriodOpen(false);
      toast({ title: "تم إنشاء فترة الجدول بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إنشاء الفترة", variant: "destructive" });
    },
  });

  const saveSchedulesMutation = useMutation({
    mutationFn: async (data: { periodId: number; schedules: any[] }) => {
      return apiRequest("/api/employee-schedules/bulk", "POST", { schedules: data.schedules });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-schedules"] });
      toast({ title: "تم حفظ الجداول بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حفظ الجداول", variant: "destructive" });
    },
  });

  const publishPeriodMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/schedule-periods/${id}/publish`, "POST", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-periods"] });
      toast({ title: "تم نشر الجدول بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في نشر الجدول", variant: "destructive" });
    },
  });

  const createBulkShiftMutation = useMutation({
    mutationFn: async (data: { shift: typeof bulkShiftForm; employees: string[]; branchId: string }) => {
      const shiftData = {
        branchId: data.branchId,
        name: data.shift.name,
        date: data.shift.date,
        startTime: data.shift.startTime,
        endTime: data.shift.endTime,
        supervisorName: data.shift.supervisorName || null,
        notes: data.shift.notes || null,
        status: "active",
        employeeCount: data.employees.length,
      };
      const shift = await apiRequest("/api/shifts", "POST", shiftData) as unknown as { id: number };
      if (data.employees.length > 0 && shift?.id) {
        const employeePromises = data.employees.map(empId => {
          const emp = users?.find(u => u.id === empId);
          const empName = emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.username || "Unknown" : "Unknown";
          return apiRequest(`/api/shifts/${shift.id}/employees`, "POST", {
            employeeName: empName,
            role: emp?.jobTitle || "موظف",
            status: "expected",
          });
        });
        await Promise.all(employeePromises);
      }
      return shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setIsBulkShiftOpen(false);
      setBulkShiftForm({
        name: "",
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "08:00",
        endTime: "16:00",
        supervisorName: "",
        notes: "",
      });
      setSelectedEmployees([]);
      toast({ title: "تم إنشاء الوردية بنجاح", description: "تمت إضافة جميع الموظفين المحددين" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إنشاء الوردية", variant: "destructive" });
    },
  });

  const weekDates = useMemo(() => {
    return DAYS_ORDER.map((_, index) => addDays(currentWeekStart, index));
  }, [currentWeekStart]);

  const handleCreatePeriod = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createPeriodMutation.mutate({
      branchId: formData.get("branchId"),
      periodType: formData.get("periodType"),
      startDate: format(currentWeekStart, "yyyy-MM-dd"),
      endDate: format(endOfWeek(currentWeekStart, { weekStartsOn: 6 }), "yyyy-MM-dd"),
      status: "draft",
    });
  };

  const handleScheduleChange = (employeeId: string, date: Date, field: string, value: string | boolean) => {
    const dateStr = format(date, "yyyy-MM-dd");
    setScheduleData(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [dateStr]: {
          ...prev[employeeId]?.[dateStr],
          startTime: prev[employeeId]?.[dateStr]?.startTime || "08:00",
          endTime: prev[employeeId]?.[dateStr]?.endTime || "16:00",
          isOff: prev[employeeId]?.[dateStr]?.isOff || false,
          shiftType: prev[employeeId]?.[dateStr]?.shiftType || "morning",
          [field]: value,
        },
      },
    }));
  };

  const handleSaveSchedules = () => {
    if (!selectedPeriod) {
      toast({ title: "يرجى اختيار فترة أولاً", variant: "destructive" });
      return;
    }
    const schedules: any[] = [];
    Object.entries(scheduleData).forEach(([employeeId, dates]) => {
      const employee = filteredUsers.find(u => u.id === employeeId);
      Object.entries(dates).forEach(([dateStr, data]) => {
        const dayOfWeek = DAYS_ORDER[weekDates.findIndex(d => format(d, "yyyy-MM-dd") === dateStr)];
        if (dayOfWeek) {
          schedules.push({
            periodId: selectedPeriod.id,
            employeeId,
            employeeName: employee ? `${employee.firstName || ""} ${employee.lastName || ""}`.trim() || employee.username : "Unknown",
            scheduleDate: dateStr,
            dayOfWeek,
            shiftType: data.shiftType,
            startTime: data.isOff ? null : data.startTime,
            endTime: data.isOff ? null : data.endTime,
            isOff: data.isOff,
          });
        }
      });
    });
    saveSchedulesMutation.mutate({ periodId: selectedPeriod.id, schedules });
  };

  const getBranchName = (branchId: string) => branches?.find(b => b.id === branchId)?.name || branchId;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary" data-testid="page-title">إدارة الورديات</h1>
            <p className="text-muted-foreground mt-1">جدولة وإدارة ورديات العمل والحضور والانصراف</p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-48" data-testid="select-branch">
                <Building2 className="w-4 h-4 ml-2" />
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {user?.role === "admin" && <SelectItem value="all">جميع الفروع</SelectItem>}
                {branches?.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {attendanceStats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100"><Users className="w-5 h-5 text-blue-600" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">إجمالي الموظفين</p>
                    <p className="text-xl font-bold" data-testid="stat-total">{filteredUsers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100"><Check className="w-5 h-5 text-green-600" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">حاضرون اليوم</p>
                    <p className="text-xl font-bold text-green-600" data-testid="stat-present">{attendanceStats.present || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100"><Clock className="w-5 h-5 text-amber-600" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">متأخرون</p>
                    <p className="text-xl font-bold text-amber-600" data-testid="stat-late">{attendanceStats.late || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100"><X className="w-5 h-5 text-red-600" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">غائبون</p>
                    <p className="text-xl font-bold text-red-600" data-testid="stat-absent">{attendanceStats.absent || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100"><UserCheck className="w-5 h-5 text-purple-600" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">نسبة الحضور</p>
                    <p className="text-xl font-bold text-purple-600" data-testid="stat-rate">{attendanceStats.attendanceRate || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-[400px]">
            <TabsTrigger value="schedule" className="gap-2"><Calendar className="w-4 h-4" />جدول الدوام</TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2"><UserCheck className="w-4 h-4" />الحضور اليومي</TabsTrigger>
            <TabsTrigger value="reports" className="gap-2"><FileText className="w-4 h-4" />التقارير</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      جدول الدوام الأسبوعي
                    </CardTitle>
                    <CardDescription>
                      {format(currentWeekStart, "dd MMMM yyyy", { locale: ar })} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 6 }), "dd MMMM yyyy", { locale: ar })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 6 }))}>
                      هذا الأسبوع
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Dialog open={isCreatePeriodOpen} onOpenChange={setIsCreatePeriodOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2"><Plus className="w-4 h-4" />إنشاء فترة جديدة</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>إنشاء فترة جدول جديدة</DialogTitle>
                          <DialogDescription>أنشئ فترة جدول أسبوعية أو شهرية جديدة</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreatePeriod}>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>الفرع</Label>
                              <Select name="branchId" defaultValue={selectedBranch !== "all" ? selectedBranch : undefined}>
                                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                                <SelectContent>
                                  {branches?.map(branch => (
                                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>نوع الفترة</Label>
                              <Select name="periodType" defaultValue="weekly">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="weekly">أسبوعي</SelectItem>
                                  <SelectItem value="monthly">شهري</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <p>تاريخ البداية: {format(currentWeekStart, "dd MMMM yyyy", { locale: ar })}</p>
                              <p>تاريخ النهاية: {format(endOfWeek(currentWeekStart, { weekStartsOn: 6 }), "dd MMMM yyyy", { locale: ar })}</p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={createPeriodMutation.isPending}>
                              {createPeriodMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={isBulkShiftOpen} onOpenChange={setIsBulkShiftOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2" data-testid="btn-bulk-shift"><Users className="w-4 h-4" />وردية جماعية للفرع</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>إنشاء وردية جماعية للفرع</DialogTitle>
                          <DialogDescription>أنشئ وردية واحدة وأضف جميع موظفي الفرع أو اختر موظفين محددين</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>اسم الوردية</Label>
                              <Input
                                value={bulkShiftForm.name}
                                onChange={(e) => setBulkShiftForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="مثال: وردية صباحية - الأحد"
                                data-testid="input-shift-name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>التاريخ</Label>
                              <Input
                                type="date"
                                value={bulkShiftForm.date}
                                onChange={(e) => setBulkShiftForm(prev => ({ ...prev, date: e.target.value }))}
                                data-testid="input-shift-date"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>وقت البداية</Label>
                              <Input
                                type="time"
                                value={bulkShiftForm.startTime}
                                onChange={(e) => setBulkShiftForm(prev => ({ ...prev, startTime: e.target.value }))}
                                data-testid="input-shift-start"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>وقت النهاية</Label>
                              <Input
                                type="time"
                                value={bulkShiftForm.endTime}
                                onChange={(e) => setBulkShiftForm(prev => ({ ...prev, endTime: e.target.value }))}
                                data-testid="input-shift-end"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>المشرف</Label>
                              <Input
                                value={bulkShiftForm.supervisorName}
                                onChange={(e) => setBulkShiftForm(prev => ({ ...prev, supervisorName: e.target.value }))}
                                placeholder="اسم المشرف"
                                data-testid="input-shift-supervisor"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>ملاحظات</Label>
                              <Input
                                value={bulkShiftForm.notes}
                                onChange={(e) => setBulkShiftForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="ملاحظات إضافية (اختياري)"
                                data-testid="input-shift-notes"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>اختيار الموظفين ({selectedEmployees.length} من {filteredUsers.length})</Label>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedEmployees(filteredUsers.map(u => u.id))}
                                  data-testid="btn-select-all"
                                >
                                  تحديد الكل
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedEmployees([])}
                                  data-testid="btn-deselect-all"
                                >
                                  إلغاء الكل
                                </Button>
                              </div>
                            </div>
                            <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                              {filteredUsers.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">يرجى اختيار فرع أولاً لعرض الموظفين</p>
                              ) : (
                                <div className="space-y-2">
                                  {filteredUsers.map(emp => (
                                    <div key={emp.id} className="flex items-center gap-2">
                                      <Checkbox
                                        id={`emp-${emp.id}`}
                                        checked={selectedEmployees.includes(emp.id)}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedEmployees(prev => [...prev, emp.id]);
                                          } else {
                                            setSelectedEmployees(prev => prev.filter(id => id !== emp.id));
                                          }
                                        }}
                                        data-testid={`checkbox-emp-${emp.id}`}
                                      />
                                      <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer flex-1">
                                        {emp.firstName} {emp.lastName}
                                        <span className="text-muted-foreground mr-2">({emp.jobTitle || "موظف"})</span>
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => {
                              if (!bulkShiftForm.name) {
                                toast({ title: "يرجى إدخال اسم الوردية", variant: "destructive" });
                                return;
                              }
                              if (selectedBranch === "all") {
                                toast({ title: "يرجى اختيار فرع محدد", variant: "destructive" });
                                return;
                              }
                              if (selectedEmployees.length === 0) {
                                toast({ title: "يرجى اختيار موظف واحد على الأقل", variant: "destructive" });
                                return;
                              }
                              createBulkShiftMutation.mutate({
                                shift: bulkShiftForm,
                                employees: selectedEmployees,
                                branchId: selectedBranch,
                              });
                            }}
                            disabled={createBulkShiftMutation.isPending || !bulkShiftForm.name || selectedBranch === "all" || selectedEmployees.length === 0}
                            data-testid="btn-create-bulk-shift"
                          >
                            {createBulkShiftMutation.isPending ? "جاري الإنشاء..." : `إنشاء الوردية (${selectedEmployees.length} موظف)`}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {periods && periods.length > 0 && (
                  <div className="mb-4">
                    <Label>اختر فترة الجدول</Label>
                    <Select value={selectedPeriod?.id?.toString() || ""} onValueChange={(v) => setSelectedPeriod(periods.find(p => p.id === parseInt(v)) || null)}>
                      <SelectTrigger className="w-64"><SelectValue placeholder="اختر فترة" /></SelectTrigger>
                      <SelectContent>
                        {periods.map(period => (
                          <SelectItem key={period.id} value={period.id.toString()}>
                            {getBranchName(period.branchId)} - {period.startDate} إلى {period.endDate}
                            <Badge className={`mr-2 ${STATUS_COLORS[period.status]}`}>{period.status === "draft" ? "مسودة" : period.status === "published" ? "منشور" : "مؤرشف"}</Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right sticky right-0 bg-muted/50 z-10 min-w-[150px]">الموظف</TableHead>
                        {weekDates.map((date, index) => (
                          <TableHead key={index} className="text-center min-w-[120px]">
                            <div>{DAYS_OF_WEEK_LABELS[DAYS_ORDER[index] as keyof typeof DAYS_OF_WEEK_LABELS]}</div>
                            <div className="text-xs text-muted-foreground">{format(date, "dd/MM")}</div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            لا يوجد موظفين في هذا الفرع
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredUsers.map(employee => (
                          <TableRow key={employee.id} data-testid={`employee-row-${employee.id}`}>
                            <TableCell className="font-medium sticky right-0 bg-background z-10">
                              {employee.firstName} {employee.lastName}
                              <div className="text-xs text-muted-foreground">{employee.jobTitle || "موظف"}</div>
                            </TableCell>
                            {weekDates.map((date, index) => {
                              const dateStr = format(date, "yyyy-MM-dd");
                              const dayData = scheduleData[employee.id]?.[dateStr] || { startTime: "08:00", endTime: "16:00", isOff: false, shiftType: "morning" };
                              return (
                                <TableCell key={index} className="p-1">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-center gap-1">
                                      <Checkbox
                                        checked={dayData.isOff}
                                        onCheckedChange={(checked) => handleScheduleChange(employee.id, date, "isOff", checked as boolean)}
                                      />
                                      <span className="text-xs">إجازة</span>
                                    </div>
                                    {!dayData.isOff && (
                                      <>
                                        <Select
                                          value={dayData.shiftType}
                                          onValueChange={(v) => handleScheduleChange(employee.id, date, "shiftType", v)}
                                        >
                                          <SelectTrigger className="h-7 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="morning">صباحي</SelectItem>
                                            <SelectItem value="evening">مسائي</SelectItem>
                                            <SelectItem value="night">ليلي</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <div className="flex gap-1">
                                          <Input
                                            type="time"
                                            value={dayData.startTime}
                                            onChange={(e) => handleScheduleChange(employee.id, date, "startTime", e.target.value)}
                                            className="h-6 text-xs p-1"
                                          />
                                          <Input
                                            type="time"
                                            value={dayData.endTime}
                                            onChange={(e) => handleScheduleChange(employee.id, date, "endTime", e.target.value)}
                                            className="h-6 text-xs p-1"
                                          />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {selectedPeriod && (
                  <div className="flex gap-2 mt-4 justify-end">
                    <Button variant="outline" onClick={handleSaveSchedules} disabled={saveSchedulesMutation.isPending} className="gap-2">
                      <Save className="w-4 h-4" />
                      {saveSchedulesMutation.isPending ? "جاري الحفظ..." : "حفظ الجداول"}
                    </Button>
                    {selectedPeriod.status === "draft" && (
                      <Button onClick={() => publishPeriodMutation.mutate(selectedPeriod.id)} disabled={publishPeriodMutation.isPending} className="gap-2">
                        <Check className="w-4 h-4" />
                        {publishPeriodMutation.isPending ? "جاري النشر..." : "نشر الجدول"}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  سجل الحضور اليومي - {format(new Date(), "dd MMMM yyyy", { locale: ar })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">الموظف</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="text-center">وقت الحضور</TableHead>
                        <TableHead className="text-center">وقت الانصراف</TableHead>
                        <TableHead className="text-center">ساعات العمل</TableHead>
                        <TableHead className="text-center">التوقيع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(!todayAttendance || todayAttendance.length === 0) ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            لا توجد سجلات حضور لليوم
                          </TableCell>
                        </TableRow>
                      ) : (
                        todayAttendance.map(record => (
                          <TableRow key={record.id} data-testid={`attendance-row-${record.id}`}>
                            <TableCell className="font-medium">{record.employeeName}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={
                                record.status === "present" ? "bg-green-100 text-green-700" :
                                record.status === "late" ? "bg-amber-100 text-amber-700" :
                                record.status === "absent" ? "bg-red-100 text-red-700" :
                                "bg-gray-100 text-gray-700"
                              }>
                                {ATTENDANCE_STATUS_ICONS[record.status as keyof typeof ATTENDANCE_STATUS_ICONS]} {ATTENDANCE_STATUS_LABELS[record.status as keyof typeof ATTENDANCE_STATUS_LABELS] || record.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-mono">{record.actualCheckIn || "-"}</TableCell>
                            <TableCell className="text-center font-mono">{record.actualCheckOut || "-"}</TableCell>
                            <TableCell className="text-center">{record.workingHours ? `${record.workingHours.toFixed(1)} ساعة` : "-"}</TableCell>
                            <TableCell className="text-center">
                              {record.checkInSignature ? <Check className="w-4 h-4 text-green-600 mx-auto" /> : <X className="w-4 h-4 text-gray-400 mx-auto" />}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  تقارير الحضور والانصراف
                </CardTitle>
                <CardDescription>تقارير أسبوعية وشهرية مفصلة للموظفين</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">قريباً</p>
                  <p>سيتم إضافة التقارير التفصيلية قريباً</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
