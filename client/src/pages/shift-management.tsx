import { useState, useEffect, useMemo, useRef } from "react";
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
import { useBranches } from "@/hooks/useBranches";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, Users, Plus, Save, Check, X, ChevronRight, ChevronLeft, FileText, UserCheck, Building2, CalendarDays, Download, Printer, Loader2, ArrowRight, FileSpreadsheet, File, Upload, FileUp, AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval, isToday, isSameMonth, parseISO, getDaysInMonth } from "date-fns";
import { ar } from "date-fns/locale";
import type { User, Branch, SchedulePeriod, EmployeeSchedule, AttendanceRecord, BranchEmployee } from "@shared/schema";
import * as XLSX from "xlsx";

const DAYS_AR = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const DAYS_EN = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const DAYS_ORDER = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];

interface ScheduleCell {
  startTime: string;
  endTime: string;
  isOff: boolean;
}

export default function ShiftManagementPage() {
  const [activeTab, setActiveTab] = useState("schedule");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 6 }));
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState<Record<string, Record<string, ScheduleCell>>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isGeneratingMonthly, setIsGeneratingMonthly] = useState(false);
  const [selectedShiftProfile, setSelectedShiftProfile] = useState<string>("morning");
  const [employeeShiftSelections, setEmployeeShiftSelections] = useState<Record<string, string>>({});
  const reportRef = useRef<HTMLDivElement>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { branches, userBranchId, canSelectBranch } = useBranches();
  
  const { data: shiftProfiles } = useQuery<{shiftCode: string; displayName: string; startTime: string; endTime: string; isActive: boolean}[]>({
    queryKey: ["/api/shift-profiles", selectedBranch],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/shift-profiles/${selectedBranch}`);
      return res.json();
    },
    enabled: selectedBranch !== "all",
  });
  const { data: users } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: branchEmployees } = useQuery<BranchEmployee[]>({
    queryKey: ["/api/branch-employees", selectedBranch],
    queryFn: async () => {
      const url = selectedBranch !== "all" 
        ? `/api/branch-employees?branchId=${selectedBranch}` 
        : "/api/branch-employees";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });
  const { data: periods } = useQuery<SchedulePeriod[]>({
    queryKey: ["/api/schedule-periods", selectedBranch],
  });
  const startDateStr = format(currentWeekStart, "yyyy-MM-dd");
  const endDateStr = format(addDays(currentWeekStart, 6), "yyyy-MM-dd");
  
  const { data: employeeSchedules } = useQuery<EmployeeSchedule[]>({
    queryKey: ["/api/employee-schedules", { branchId: selectedBranch, startDate: startDateStr, endDate: endDateStr }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/employee-schedules?branchId=${selectedBranch}&startDate=${startDateStr}&endDate=${endDateStr}`);
      return res.json();
    },
    enabled: selectedBranch !== "all",
  });
  const { data: attendanceRecords } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", { branchId: selectedBranch, startDate: startDateStr, endDate: endDateStr }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/attendance?branchId=${selectedBranch}&startDate=${startDateStr}&endDate=${endDateStr}`);
      return res.json();
    },
    enabled: selectedBranch !== "all",
  });

  const filteredEmployees = useMemo(() => {
    if (!branchEmployees) return [];
    const activeEmployees = branchEmployees.filter(e => e.status === "active");
    if (selectedBranch === "all") return activeEmployees;
    return activeEmployees.filter(e => e.branchId === selectedBranch);
  }, [branchEmployees, selectedBranch]);

  useEffect(() => {
    if (userBranchId && selectedBranch === "") {
      setSelectedBranch(userBranchId);
    } else if (!userBranchId && selectedBranch === "") {
      setSelectedBranch("all");
    }
  }, [userBranchId, selectedBranch]);

  useEffect(() => {
    const newScheduleData: Record<string, Record<string, ScheduleCell>> = {};
    if (employeeSchedules && Array.isArray(employeeSchedules) && employeeSchedules.length > 0) {
      employeeSchedules.forEach((schedule: EmployeeSchedule) => {
        const keyId = schedule.branchEmployeeId ? String(schedule.branchEmployeeId) : schedule.employeeId;
        if (!newScheduleData[keyId]) {
          newScheduleData[keyId] = {};
        }
        newScheduleData[keyId][schedule.scheduleDate] = {
          startTime: schedule.startTime || "08:00",
          endTime: schedule.endTime || "16:00",
          isOff: schedule.isOff,
        };
      });
    }
    setScheduleData(newScheduleData);
    setHasUnsavedChanges(false);
  }, [employeeSchedules, currentWeekStart, selectedBranch]);

  const weekDates = useMemo(() => {
    return DAYS_ORDER.map((_, index) => addDays(currentWeekStart, index));
  }, [currentWeekStart]);

  const handleScheduleChange = (employeeId: string, dateStr: string, field: keyof ScheduleCell, value: string | boolean) => {
    setScheduleData(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [dateStr]: {
          startTime: prev[employeeId]?.[dateStr]?.startTime || "08:00",
          endTime: prev[employeeId]?.[dateStr]?.endTime || "16:00",
          isOff: prev[employeeId]?.[dateStr]?.isOff || false,
          [field]: value,
        },
      },
    }));
    setHasUnsavedChanges(true);
  };

  const getShiftTypeFromTime = (startTime: string): string => {
    const hour = parseInt(startTime.split(":")[0], 10);
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 20) return "evening";
    return "night";
  };

  const saveSchedulesMutation = useMutation({
    mutationFn: async () => {
      const schedules: any[] = [];
      Object.entries(scheduleData).forEach(([employeeId, dates]) => {
        const employee = filteredEmployees.find(u => String(u.id) === employeeId);
        Object.entries(dates).forEach(([dateStr, data]) => {
          const shiftType = data.isOff ? null : getShiftTypeFromTime(data.startTime);
          schedules.push({
            employeeId: employee?.linkedUserId || `branch_emp_${employee?.id || employeeId}`,
            employeeName: employee?.employeeName || "غير معروف",
            branchEmployeeId: employee?.id,
            scheduleDate: dateStr,
            startTime: data.isOff ? null : data.startTime,
            endTime: data.isOff ? null : data.endTime,
            shiftType: shiftType,
            isOff: data.isOff,
            branchId: selectedBranch,
          });
        });
      });
      return apiRequest("POST", "/api/employee-schedules/bulk", { schedules });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-schedules"] });
      setHasUnsavedChanges(false);
      toast({ title: "تم حفظ جدول الدوام بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حفظ الجدول", variant: "destructive" });
    },
  });

  const getAttendanceForEmployee = (employeeId: string, dateStr: string) => {
    if (!attendanceRecords) return null;
    return attendanceRecords.find(r => r.employeeId === employeeId && r.attendanceDate === dateStr);
  };

  const getAttendanceStatus = (employeeId: string, dateStr: string, scheduledStart?: string) => {
    const attendance = getAttendanceForEmployee(employeeId, dateStr);
    if (!attendance) return null;
    
    if (attendance.actualCheckIn && attendance.actualCheckOut) {
      return { status: "completed", label: "حضر", color: "bg-green-100 text-green-700" };
    }
    if (attendance.actualCheckIn && !attendance.actualCheckOut) {
      return { status: "in_progress", label: "في العمل", color: "bg-blue-100 text-blue-700" };
    }
    return null;
  };

  const getBranchName = (branchId: string) => branches?.find(b => b.id === branchId)?.name || branchId;

  const activeShiftProfiles = useMemo(() => {
    return (shiftProfiles || []).filter(p => p.isActive);
  }, [shiftProfiles]);

  useEffect(() => {
    if (activeShiftProfiles.length > 0) {
      if (!activeShiftProfiles.find(p => p.shiftCode === selectedShiftProfile)) {
        setSelectedShiftProfile(activeShiftProfiles[0].shiftCode);
      }
    }
  }, [activeShiftProfiles, selectedShiftProfile]);

  useEffect(() => {
    setSelectedShiftProfile("morning");
  }, [selectedBranch]);

  const selectedProfileValid = useMemo(() => {
    return activeShiftProfiles.some(p => p.shiftCode === selectedShiftProfile);
  }, [activeShiftProfiles, selectedShiftProfile]);

  const applyDefaultSchedule = () => {
    const profile = activeShiftProfiles.find(p => p.shiftCode === selectedShiftProfile);
    if (!profile && activeShiftProfiles.length > 0) {
      toast({ title: "تنبيه", description: "يرجى اختيار وردية صالحة أولاً", variant: "destructive" });
      return;
    }
    const startTime = profile?.startTime || "08:00";
    const endTime = profile?.endTime || "16:00";
    const profileName = profile?.displayName || "افتراضي";
    
    const newScheduleData: Record<string, Record<string, ScheduleCell>> = {};
    filteredEmployees.forEach(emp => {
      newScheduleData[String(emp.id)] = {};
      weekDates.forEach((date, index) => {
        const dateStr = format(date, "yyyy-MM-dd");
        const isFriday = index === 6;
        newScheduleData[String(emp.id)][dateStr] = {
          startTime,
          endTime,
          isOff: isFriday,
        };
      });
    });
    setScheduleData(newScheduleData);
    setHasUnsavedChanges(true);
    toast({ title: "تم تطبيق الجدول", description: `${profileName} (${startTime} - ${endTime})، الجمعة إجازة` });
  };

  const getEmployeeShiftSelection = (empId: string) => {
    return employeeShiftSelections[empId] || selectedShiftProfile || "morning";
  };

  const setEmployeeShiftSelection = (empId: string, shiftCode: string) => {
    setEmployeeShiftSelections(prev => ({ ...prev, [empId]: shiftCode }));
  };

  const applyShiftToEmployee = (empId: string) => {
    const shiftCode = getEmployeeShiftSelection(empId);
    const profile = activeShiftProfiles.find(p => p.shiftCode === shiftCode);
    const startTime = profile?.startTime || "08:00";
    const endTime = profile?.endTime || "16:00";
    const profileName = profile?.displayName || "افتراضي";

    setScheduleData(prev => {
      const newData = { ...prev };
      if (!newData[empId]) {
        newData[empId] = {};
      }
      weekDates.forEach((date, index) => {
        const dateStr = format(date, "yyyy-MM-dd");
        const isFriday = index === 6;
        newData[empId][dateStr] = {
          startTime,
          endTime,
          isOff: isFriday,
        };
      });
      return newData;
    });
    setHasUnsavedChanges(true);
    toast({ title: "تم تطبيق الوردية", description: `${profileName} (${startTime} - ${endTime})` });
  };

  const exportWeeklyReport = () => {
    if (selectedBranch === "all") {
      toast({ title: "تنبيه", description: "يرجى اختيار فرع محدد أولاً", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    try {
      const reportData: any[] = [];
      
      filteredEmployees.forEach(employee => {
        const row: any = {
          "اسم الموظف": employee.employeeName,
          "المسمى الوظيفي": employee.jobTitle || "موظف",
        };
        const empIdStr = String(employee.id);
        const linkedUserId = employee.linkedUserId || empIdStr;
        
        weekDates.forEach((date, index) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const cellData = scheduleData[empIdStr]?.[dateStr];
          const attendance = getAttendanceForEmployee(linkedUserId, dateStr);
          
          if (cellData?.isOff) {
            row[DAYS_AR[index]] = "إجازة";
          } else if (cellData) {
            const scheduled = `${cellData.startTime} - ${cellData.endTime}`;
            const actual = attendance?.actualCheckIn ? `${attendance.actualCheckIn} - ${attendance.actualCheckOut || "-"}` : "لم يحضر";
            row[DAYS_AR[index]] = `المطلوب: ${scheduled} | الفعلي: ${actual}`;
          } else {
            row[DAYS_AR[index]] = "-";
          }
        });
        
        const empSchedule = scheduleData[empIdStr] || {};
        const workDays = Object.values(empSchedule).filter(d => !d.isOff).length;
        const attendedDays = attendanceRecords?.filter(r => r.employeeId === linkedUserId && r.actualCheckIn).length || 0;
        const rate = workDays > 0 ? Math.round((attendedDays / workDays) * 100) : 0;
        
        row["أيام العمل"] = workDays;
        row["أيام الحضور"] = attendedDays;
        row["نسبة الحضور"] = `${rate}%`;
        
        reportData.push(row);
      });
      
      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "تقرير الدوام");
      
      const fileName = `تقرير_الدوام_${format(currentWeekStart, "yyyy-MM-dd")}_${getBranchName(selectedBranch)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({ title: "تم تصدير التقرير بنجاح" });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في تصدير التقرير", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const generateMonthlyReport = async () => {
    if (selectedBranch === "all") {
      toast({ title: "تنبيه", description: "يرجى اختيار فرع محدد أولاً", variant: "destructive" });
      return;
    }
    setIsGeneratingMonthly(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0);
      const daysInMonth = getDaysInMonth(monthStart);
      
      const res = await apiRequest("GET", `/api/attendance?branchId=${selectedBranch}&startDate=${format(monthStart, "yyyy-MM-dd")}&endDate=${format(monthEnd, "yyyy-MM-dd")}`);
      const monthlyAttendance: AttendanceRecord[] = await res.json();
      
      const reportData: any[] = [];
      
      filteredEmployees.forEach(employee => {
        const linkedUserId = employee.linkedUserId || String(employee.id);
        const empAttendance = monthlyAttendance.filter(a => a.employeeId === linkedUserId);
        const presentDays = empAttendance.filter(a => a.actualCheckIn).length;
        const lateDays = empAttendance.filter(a => a.status === "late").length;
        const totalWorkHours = empAttendance.reduce((sum, a) => sum + (a.workingHours || 0), 0);
        const totalOvertimeMinutes = empAttendance.reduce((sum, a) => sum + (a.overtimeMinutes || 0), 0);
        const totalLateMinutes = empAttendance.reduce((sum, a) => sum + (a.lateMinutes || 0), 0);
        
        reportData.push({
          "اسم الموظف": employee.employeeName,
          "المسمى الوظيفي": employee.jobTitle || "موظف",
          "أيام العمل المتوقعة": Math.max(daysInMonth - 4, 1),
          "أيام الحضور": presentDays,
          "أيام الغياب": Math.max((daysInMonth - 4) - presentDays, 0),
          "أيام التأخير": lateDays,
          "إجمالي ساعات العمل": totalWorkHours.toFixed(1),
          "دقائق العمل الإضافي": totalOvertimeMinutes,
          "دقائق التأخير": totalLateMinutes,
          "نسبة الحضور": `${daysInMonth > 4 ? Math.round((presentDays / (daysInMonth - 4)) * 100) : 0}%`,
        });
      });
      
      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "التقرير الشهري");
      
      const fileName = `التقرير_الشهري_${selectedMonth}_${getBranchName(selectedBranch)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({ title: "تم إنشاء التقرير الشهري بنجاح" });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في إنشاء التقرير", variant: "destructive" });
    } finally {
      setIsGeneratingMonthly(false);
    }
  };

  const printReport = () => {
    if (selectedBranch === "all") {
      toast({ title: "تنبيه", description: "يرجى اختيار فرع محدد أولاً", variant: "destructive" });
      return;
    }
    if (filteredEmployees.length === 0) {
      toast({ title: "تنبيه", description: "لا يوجد موظفين لعرض التقرير", variant: "destructive" });
      return;
    }
    const printContent = document.getElementById("printable-report");
    if (printContent) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html dir="rtl">
            <head>
              <title>تقرير الدوام - ${getBranchName(selectedBranch)}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; direction: rtl; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                th { background-color: #f4f4f4; }
                h1 { text-align: center; color: #333; }
                h2 { color: #666; margin-top: 30px; }
                .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
                .badge-green { background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 4px; }
                .badge-red { background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 4px; }
                .badge-amber { background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 4px; }
              </style>
            </head>
            <body>
              <h1>تقرير الدوام - ${getBranchName(selectedBranch)}</h1>
              <div class="header">
                <div>الفترة: ${format(currentWeekStart, "dd/MM/yyyy")} - ${format(addDays(currentWeekStart, 6), "dd/MM/yyyy")}</div>
                <div>تاريخ الطباعة: ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>أيام العمل</th>
                    <th>أيام الإجازة</th>
                    <th>أيام الحضور</th>
                    <th>أيام الغياب</th>
                    <th>نسبة الحضور</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredEmployees.map(employee => {
                    const empIdStr = String(employee.id);
                    const linkedUserId = employee.linkedUserId || empIdStr;
                    const empSchedule = scheduleData[empIdStr] || {};
                    const workDays = Object.values(empSchedule).filter(d => !d.isOff).length;
                    const offDays = Object.values(empSchedule).filter(d => d.isOff).length;
                    const attendedDays = attendanceRecords?.filter(r => r.employeeId === linkedUserId && r.actualCheckIn).length || 0;
                    const absentDays = workDays - attendedDays;
                    const rate = workDays > 0 ? Math.round((attendedDays / workDays) * 100) : 0;
                    const badgeClass = rate >= 80 ? "badge-green" : rate >= 50 ? "badge-amber" : "badge-red";
                    
                    return `
                      <tr>
                        <td>${employee.employeeName}</td>
                        <td>${workDays}</td>
                        <td>${offDays}</td>
                        <td style="color: green;">${attendedDays}</td>
                        <td style="color: red;">${absentDays > 0 ? absentDays : 0}</td>
                        <td><span class="${badgeClass}">${rate}%</span></td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const formatTo12HourExcel = (time24: string) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'م' : 'ص';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const exportScheduleToExcel = () => {
    if (selectedBranch === "all") {
      toast({ title: "تنبيه", description: "يرجى اختيار فرع محدد أولاً", variant: "destructive" });
      return;
    }
    if (filteredEmployees.length === 0) {
      toast({ title: "تنبيه", description: "لا يوجد موظفين لتصدير الجدول", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    try {
      const reportData: any[] = [];
      
      filteredEmployees.forEach(employee => {
        const empIdStr = String(employee.id);
        const row: any = {
          "اسم الموظف": employee.employeeName,
          "المسمى الوظيفي": employee.jobTitle || "موظف",
        };
        
        weekDates.forEach((date, index) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const cellData = scheduleData[empIdStr]?.[dateStr];
          
          if (cellData?.isOff) {
            row[`${DAYS_AR[index]} ${format(date, "dd/MM")}`] = "إجازة";
          } else if (cellData) {
            const start12 = formatTo12HourExcel(cellData.startTime);
            const end12 = formatTo12HourExcel(cellData.endTime);
            row[`${DAYS_AR[index]} ${format(date, "dd/MM")}`] = `${start12} - ${end12}`;
          } else {
            row[`${DAYS_AR[index]} ${format(date, "dd/MM")}`] = "-";
          }
        });
        
        reportData.push(row);
      });
      
      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "جدول الدوام");
      
      const fileName = `جدول_الدوام_${format(currentWeekStart, "yyyy-MM-dd")}_${getBranchName(selectedBranch)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({ title: "تم تصدير جدول الدوام بنجاح" });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في تصدير جدول الدوام", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const exportScheduleToPdf = async () => {
    if (selectedBranch === "all") {
      toast({ title: "تنبيه", description: "يرجى اختيار فرع محدد أولاً", variant: "destructive" });
      return;
    }
    if (filteredEmployees.length === 0) {
      toast({ title: "تنبيه", description: "لا يوجد موظفين لتصدير الجدول", variant: "destructive" });
      return;
    }
    setIsExportingPdf(true);
    try {
      const scheduleRows = filteredEmployees.map(employee => {
        const empIdStr = String(employee.id);
        const days = weekDates.map((date, index) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const cellData = scheduleData[empIdStr]?.[dateStr];
          return {
            day: DAYS_AR[index],
            date: format(date, "dd/MM"),
            isOff: cellData?.isOff || false,
            startTime: cellData?.startTime || "",
            endTime: cellData?.endTime || "",
          };
        });
        return {
          employeeName: employee.employeeName,
          jobTitle: employee.jobTitle || "موظف",
          days,
        };
      });

      const res = await apiRequest("POST", "/api/reports/weekly-schedule-pdf", {
        branchName: getBranchName(selectedBranch),
        periodStart: format(currentWeekStart, "dd/MM/yyyy"),
        periodEnd: format(addDays(currentWeekStart, 6), "dd/MM/yyyy"),
        weekDates: weekDates.map((d, i) => ({ day: DAYS_AR[i], dayEn: DAYS_EN[i], date: format(d, "dd/MM") })),
        employees: scheduleRows,
      });
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `جدول_الدوام_${format(currentWeekStart, "yyyy-MM-dd")}_${getBranchName(selectedBranch)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({ title: "تم تصدير جدول الدوام بصيغة PDF بنجاح" });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في تصدير جدول الدوام كـ PDF", variant: "destructive" });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const formatTo12Hour = (time24: string) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'م' : 'ص';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const printSchedule = () => {
    if (selectedBranch === "all") {
      toast({ title: "تنبيه", description: "يرجى اختيار فرع محدد أولاً", variant: "destructive" });
      return;
    }
    if (filteredEmployees.length === 0) {
      toast({ title: "تنبيه", description: "لا يوجد موظفين لطباعة الجدول", variant: "destructive" });
      return;
    }
    
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      const tableRows = filteredEmployees.map(employee => {
        const empIdStr = String(employee.id);
        const cells = weekDates.map((date, index) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const cellData = scheduleData[empIdStr]?.[dateStr];
          if (cellData?.isOff) {
            return `<td class="cell-off"><span class="off-badge">🏖️ إجازة</span></td>`;
          } else if (cellData) {
            return `<td class="cell-work"><div class="time-from">من ${formatTo12Hour(cellData.startTime)}</div><div class="time-to">إلى ${formatTo12Hour(cellData.endTime)}</div></td>`;
          }
          return `<td style="text-align: center; color: #999;">-</td>`;
        }).join("");
        return `<tr><td class="cell-employee"><div class="emp-name">${employee.employeeName}</div><div class="emp-title">${employee.jobTitle || "موظف"}</div></td>${cells}</tr>`;
      }).join("");

      const headerCells = weekDates.map((date, index) => 
        `<th class="day-header"><div class="day-name">${DAYS_AR[index]}</div><div class="day-date">${format(date, "dd/MM")}</div></th>`
      ).join("");

      printWindow.document.write(`
        <html dir="rtl">
          <head>
            <title>جدول الدوام - ${getBranchName(selectedBranch)}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
              body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; direction: rtl; background: #fff; }
              .report-header { background: linear-gradient(135deg, #d4a853 0%, #b8942d 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center; }
              .report-title { font-size: 22px; font-weight: 700; margin-bottom: 5px; }
              .report-subtitle { font-size: 14px; opacity: 0.9; }
              .report-period { background: rgba(255,255,255,0.2); padding: 8px 20px; border-radius: 20px; display: inline-block; margin-top: 10px; font-size: 12px; }
              table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 15px; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              th, td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; }
              .day-header { background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%); font-weight: 600; text-align: center; min-width: 90px; border-left: 1px solid #e5e7eb; }
              .day-name { font-size: 12px; font-weight: 700; color: #1f2937; }
              .day-date { font-size: 10px; color: #6b7280; margin-top: 2px; }
              th:first-child { background: linear-gradient(180deg, #d4a853 0%, #b8942d 100%); color: white; text-align: right; min-width: 140px; font-size: 13px; }
              tr:nth-child(even) { background: #fafafa; }
              .cell-employee { text-align: right; border-left: 3px solid #d4a853; padding-right: 12px; }
              .emp-name { font-weight: 600; font-size: 11px; color: #1f2937; }
              .emp-title { font-size: 9px; color: #6b7280; margin-top: 2px; }
              .cell-work { text-align: center; background: #f0fdf4; border-left: 1px solid #e5e7eb; }
              .time-from, .time-to { font-size: 10px; color: #166534; }
              .time-from { font-weight: 600; }
              .cell-off { text-align: center; background: #fffbeb; border-left: 1px solid #e5e7eb; }
              .off-badge { background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; }
              @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
            </style>
          </head>
          <body>
            <div class="report-header">
              <div class="report-title">📋 جدول الدوام الأسبوعي</div>
              <div class="report-subtitle">${getBranchName(selectedBranch)}</div>
              <div class="report-period">📅 ${format(currentWeekStart, "dd MMMM yyyy", { locale: ar })} - ${format(addDays(currentWeekStart, 6), "dd MMMM yyyy", { locale: ar })}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="text-align: right;">الموظف / المسمى</th>
                  ${headerCells}
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const exportToPdf = async () => {
    if (selectedBranch === "all") {
      toast({ title: "تنبيه", description: "يرجى اختيار فرع محدد أولاً", variant: "destructive" });
      return;
    }
    if (filteredEmployees.length === 0) {
      toast({ title: "تنبيه", description: "لا يوجد موظفين لتصدير التقرير", variant: "destructive" });
      return;
    }
    setIsExportingPdf(true);
    try {
      const reportData = filteredEmployees.map(employee => {
        const empIdStr = String(employee.id);
        const linkedUserId = employee.linkedUserId || empIdStr;
        const empSchedule = scheduleData[empIdStr] || {};
        const workDays = Object.values(empSchedule).filter(d => !d.isOff).length;
        const offDays = Object.values(empSchedule).filter(d => d.isOff).length;
        const attendedDays = attendanceRecords?.filter(r => r.employeeId === linkedUserId && r.actualCheckIn).length || 0;
        const absentDays = workDays - attendedDays;
        const rate = workDays > 0 ? Math.round((attendedDays / workDays) * 100) : 0;
        return { employeeName: employee.employeeName, workDays, offDays, attendedDays, absentDays: Math.max(absentDays, 0), rate };
      });

      const res = await apiRequest("POST", "/api/reports/shift-schedule-pdf", {
        branchName: getBranchName(selectedBranch),
        periodStart: format(currentWeekStart, "dd/MM/yyyy"),
        periodEnd: format(addDays(currentWeekStart, 6), "dd/MM/yyyy"),
        employees: reportData,
      });
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `تقرير_الدوام_${format(currentWeekStart, "yyyy-MM-dd")}_${getBranchName(selectedBranch)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({ title: "تم تصدير التقرير بصيغة PDF بنجاح" });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في تصدير التقرير كـ PDF", variant: "destructive" });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const [, navigate] = useLocation();

  // Download Excel template for importing schedules
  const downloadImportTemplate = () => {
    if (selectedBranch === "all") {
      toast({ title: "تنبيه", description: "يرجى اختيار فرع محدد أولاً", variant: "destructive" });
      return;
    }
    if (filteredEmployees.length === 0) {
      toast({ title: "تنبيه", description: "لا يوجد موظفين في هذا الفرع", variant: "destructive" });
      return;
    }

    const templateData = filteredEmployees.map(emp => {
      const row: any = {
        "رقم الموظف Employee ID": emp.id,
        "اسم الموظف Employee Name": emp.employeeName,
        "المسمى الوظيفي Job Title": emp.jobTitle || "موظف",
      };
      weekDates.forEach((date, index) => {
        row[`${DAYS_AR[index]} ${DAYS_EN[index]} ${format(date, "dd/MM")}`] = "";
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Schedule Template");
    
    // Add instructions sheet
    const instructions = [
      { "التعليمات Instructions": "كيفية ملء الجدول / How to fill the schedule:" },
      { "التعليمات Instructions": "" },
      { "التعليمات Instructions": "1. لا تغير رقم الموظف أو الاسم / Do not change Employee ID or Name" },
      { "التعليمات Instructions": "2. لتحديد وقت العمل اكتب: 08:00-16:00 / For work time write: 08:00-16:00" },
      { "التعليمات Instructions": "3. للإجازة اكتب: إجازة أو OFF / For day off write: إجازة or OFF" },
      { "التعليمات Instructions": "4. اترك الخلية فارغة إذا لم يتغير الجدول / Leave cell empty if no change" },
      { "التعليمات Instructions": "" },
      { "التعليمات Instructions": "أمثلة Examples:" },
      { "التعليمات Instructions": "08:00-16:00 = وردية صباحية / Morning shift" },
      { "التعليمات Instructions": "16:00-00:00 = وردية مسائية / Evening shift" },
      { "التعليمات Instructions": "إجازة = يوم إجازة / Day off" },
    ];
    const wsInstructions = XLSX.utils.json_to_sheet(instructions);
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
    
    const fileName = `نموذج_استيراد_الجدول_${format(currentWeekStart, "yyyy-MM-dd")}_${getBranchName(selectedBranch)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast({ title: "تم تحميل نموذج الاستيراد بنجاح" });
  };

  // Handle Excel file upload and parsing
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const errors: string[] = [];
        const parsedData: any[] = [];

        jsonData.forEach((row: any, rowIndex) => {
          const empId = row["رقم الموظف Employee ID"];
          const empName = row["اسم الموظف Employee Name"];
          
          if (!empId) {
            errors.push(`صف ${rowIndex + 2}: رقم الموظف مفقود`);
            return;
          }

          const employee = filteredEmployees.find(e => e.id === empId || e.id === Number(empId));
          if (!employee) {
            errors.push(`صف ${rowIndex + 2}: الموظف "${empName}" غير موجود في الفرع`);
            return;
          }

          const scheduleRow: any = {
            employeeId: employee.id,
            employeeName: employee.employeeName,
            schedules: []
          };

          weekDates.forEach((date, index) => {
            const columnKey = Object.keys(row).find(k => k.includes(DAYS_EN[index]) || k.includes(DAYS_AR[index]));
            const cellValue = columnKey ? String(row[columnKey] || "").trim() : "";
            
            if (!cellValue) return;

            const dateStr = format(date, "yyyy-MM-dd");
            
            if (cellValue.toLowerCase() === "off" || cellValue === "إجازة" || cellValue.includes("إجازة")) {
              scheduleRow.schedules.push({
                date: dateStr,
                dayOfWeek: DAYS_ORDER[index],
                isOff: true,
                startTime: null,
                endTime: null
              });
            } else if (cellValue.includes("-")) {
              const [start, end] = cellValue.split("-").map(t => t.trim());
              if (start && end && /^\d{1,2}:\d{2}$/.test(start) && /^\d{1,2}:\d{2}$/.test(end)) {
                scheduleRow.schedules.push({
                  date: dateStr,
                  dayOfWeek: DAYS_ORDER[index],
                  isOff: false,
                  startTime: start.padStart(5, "0"),
                  endTime: end.padStart(5, "0")
                });
              } else {
                errors.push(`صف ${rowIndex + 2}, يوم ${DAYS_AR[index]}: تنسيق الوقت غير صحيح`);
              }
            }
          });

          if (scheduleRow.schedules.length > 0) {
            parsedData.push(scheduleRow);
          }
        });

        setImportData(parsedData);
        setImportErrors(errors);
        setIsImportDialogOpen(true);
      } catch (error) {
        toast({ title: "خطأ", description: "فشل في قراءة ملف Excel", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Apply imported schedules
  const applyImportedSchedules = async () => {
    if (importData.length === 0) {
      toast({ title: "تنبيه", description: "لا توجد بيانات للاستيراد", variant: "destructive" });
      return;
    }

    setIsImporting(true);
    try {
      const schedulesToSave: any[] = [];
      
      importData.forEach(empData => {
        const employee = filteredEmployees.find(e => e.id === empData.employeeId);
        if (!employee) return;

        empData.schedules.forEach((schedule: any) => {
          schedulesToSave.push({
            employeeId: employee.linkedUserId || `branch_emp_${employee.id}`,
            employeeName: employee.employeeName,
            branchId: selectedBranch,
            branchEmployeeId: employee.id,
            scheduleDate: schedule.date,
            dayOfWeek: schedule.dayOfWeek,
            isOff: schedule.isOff,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            status: "scheduled"
          });
        });
      });

      // Save via API
      await apiRequest("POST", "/api/employee-schedules/bulk", { schedules: schedulesToSave });
      
      toast({ title: "تم استيراد الجداول بنجاح", description: `تم تحديث ${schedulesToSave.length} جدول` });
      setIsImportDialogOpen(false);
      setImportData([]);
      setImportErrors([]);
      queryClient.invalidateQueries({ queryKey: ["/api/employee-schedules"] });
    } catch (error) {
      toast({ title: "خطأ", description: "فشل في حفظ الجداول المستوردة", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8"
              onClick={() => navigate("/attendance-dashboard")}
              data-testid="btn-back"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary" data-testid="page-title">جدولة الدوام</h1>
              <p className="text-muted-foreground mt-1">إنشاء وإدارة جداول دوام الموظفين للفروع</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-48 h-11 sm:h-10" data-testid="select-branch" disabled={!canSelectBranch}>
                <Building2 className="w-4 h-4 ml-2" />
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {canSelectBranch && <SelectItem value="all">جميع الفروع</SelectItem>}
                {branches?.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedBranch === "all" ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">اختر الفرع</h3>
              <p className="text-muted-foreground">يرجى اختيار فرع محدد لعرض وإدارة جدول الدوام</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-[600px]">
              <TabsTrigger value="schedule" className="gap-2" data-testid="tab-schedule">
                <CalendarDays className="w-4 h-4" />جدول الدوام
              </TabsTrigger>
              <TabsTrigger value="attendance" className="gap-2" data-testid="tab-attendance">
                <UserCheck className="w-4 h-4" />سجل الحضور
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-2" data-testid="tab-reports">
                <FileText className="w-4 h-4" />التقارير
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
                <Clock className="w-4 h-4" />إعدادات الورديات
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5" />
                        جدول الدوام الأسبوعي - {getBranchName(selectedBranch)}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {format(currentWeekStart, "dd MMMM yyyy", { locale: ar })} - {format(addDays(currentWeekStart, 6), "dd MMMM yyyy", { locale: ar })}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Button variant="outline" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} data-testid="btn-prev-week">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 6 }))} className="h-11 sm:h-9" data-testid="btn-current-week">
                        هذا الأسبوع
                      </Button>
                      <Button variant="outline" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))} data-testid="btn-next-week">
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="gap-2 h-11 sm:h-9" disabled={isExporting || isExportingPdf} data-testid="btn-export-schedule">
                            {(isExporting || isExportingPdf) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            تصدير
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={exportScheduleToExcel} className="gap-2 cursor-pointer" data-testid="btn-export-schedule-excel">
                            <FileSpreadsheet className="w-4 h-4 text-green-600" />
                            تصدير Excel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={exportScheduleToPdf} className="gap-2 cursor-pointer" data-testid="btn-export-schedule-pdf">
                            <File className="w-4 h-4 text-red-600" />
                            تصدير PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={printSchedule} className="gap-2 cursor-pointer" data-testid="btn-print-schedule">
                            <Printer className="w-4 h-4 text-blue-600" />
                            طباعة
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={downloadImportTemplate} className="gap-2 cursor-pointer" data-testid="btn-download-template">
                            <Download className="w-4 h-4 text-amber-600" />
                            تحميل نموذج الاستيراد
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2 cursor-pointer" data-testid="btn-import-excel">
                            <Upload className="w-4 h-4 text-purple-600" />
                            استيراد من Excel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4 items-center">
                    <Select value={selectedShiftProfile} onValueChange={setSelectedShiftProfile}>
                      <SelectTrigger className="w-48 h-11 sm:h-10" data-testid="select-shift-profile">
                        <Clock className="w-4 h-4 ml-2" />
                        <SelectValue placeholder="اختر الوردية" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {activeShiftProfiles.length > 0 ? (
                          activeShiftProfiles.map(profile => (
                            <SelectItem key={profile.shiftCode} value={profile.shiftCode}>
                              {profile.displayName} ({profile.startTime} - {profile.endTime})
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="morning">الوردية الصباحية (06:00 - 14:00)</SelectItem>
                            <SelectItem value="evening">الوردية المسائية (14:00 - 22:00)</SelectItem>
                            <SelectItem value="night">الوردية الليلية (22:00 - 06:00)</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={applyDefaultSchedule} className="gap-2 h-11 sm:h-9" data-testid="btn-apply-default">
                      <Users className="w-4 h-4" />
                      تطبيق على الجميع
                    </Button>
                    {hasUnsavedChanges && (
                      <Button onClick={() => saveSchedulesMutation.mutate()} disabled={saveSchedulesMutation.isPending} className="gap-2 h-11 sm:h-9" data-testid="btn-save-schedule">
                        <Save className="w-4 h-4" />
                        {saveSchedulesMutation.isPending ? "جاري الحفظ..." : "حفظ الجدول"}
                      </Button>
                    )}
                  </div>

                  {filteredEmployees.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>لا يوجد موظفين في هذا الفرع</p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-right sticky right-0 bg-muted/50 z-10 min-w-[280px] font-bold">
                              الموظف / الوردية
                            </TableHead>
                            {weekDates.map((date, index) => (
                              <TableHead key={index} className={`text-center min-w-[140px] ${isToday(date) ? "bg-primary/10" : ""}`}>
                                <div className="font-bold">{DAYS_AR[index]}</div>
                                <div className={`text-sm ${isToday(date) ? "text-primary font-bold" : "text-muted-foreground"}`}>
                                  {format(date, "dd/MM")}
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEmployees.map(employee => {
                            const empIdStr = String(employee.id);
                            const linkedUserId = employee.linkedUserId || empIdStr;
                            return (
                            <TableRow key={employee.id} data-testid={`row-employee-${employee.id}`}>
                              <TableCell className="font-medium sticky right-0 bg-background z-10 border-l min-w-[280px]">
                                <div className="font-semibold">{employee.employeeName}</div>
                                <div className="text-xs text-muted-foreground mb-2">{employee.jobTitle || "موظف"}</div>
                                <div className="flex gap-1 items-center">
                                  <Select 
                                    value={getEmployeeShiftSelection(empIdStr)} 
                                    onValueChange={(val) => setEmployeeShiftSelection(empIdStr, val)}
                                  >
                                    <SelectTrigger className="h-7 text-xs w-28" data-testid={`select-shift-${employee.id}`}>
                                      <SelectValue placeholder="الوردية" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60 overflow-y-auto">
                                      {activeShiftProfiles.length > 0 ? (
                                        activeShiftProfiles.map(profile => (
                                          <SelectItem key={profile.shiftCode} value={profile.shiftCode} className="text-xs">
                                            {profile.displayName}
                                          </SelectItem>
                                        ))
                                      ) : (
                                        <>
                                          <SelectItem value="morning" className="text-xs">صباحية</SelectItem>
                                          <SelectItem value="evening" className="text-xs">مسائية</SelectItem>
                                          <SelectItem value="night" className="text-xs">ليلية</SelectItem>
                                        </>
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-7 text-xs px-2"
                                    onClick={() => applyShiftToEmployee(empIdStr)}
                                    data-testid={`btn-apply-shift-${employee.id}`}
                                  >
                                    تطبيق
                                  </Button>
                                </div>
                              </TableCell>
                              {weekDates.map((date, index) => {
                                const dateStr = format(date, "yyyy-MM-dd");
                                const cellData = scheduleData[empIdStr]?.[dateStr] || { startTime: "08:00", endTime: "16:00", isOff: false };
                                const attendance = getAttendanceStatus(linkedUserId, dateStr, cellData.startTime);
                                
                                return (
                                  <TableCell key={index} className={`p-2 ${isToday(date) ? "bg-primary/5" : ""} ${cellData.isOff ? "bg-gray-100" : ""}`}>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-center gap-2">
                                        <Checkbox
                                          checked={cellData.isOff}
                                          onCheckedChange={(checked) => handleScheduleChange(empIdStr, dateStr, "isOff", checked as boolean)}
                                          data-testid={`checkbox-off-${employee.id}-${dateStr}`}
                                        />
                                        <span className="text-xs">إجازة</span>
                                      </div>
                                      {!cellData.isOff && (
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs text-muted-foreground w-8">من</span>
                                            <Input
                                              type="time"
                                              value={cellData.startTime}
                                              onChange={(e) => handleScheduleChange(empIdStr, dateStr, "startTime", e.target.value)}
                                              className="h-7 text-xs"
                                              data-testid={`input-start-${employee.id}-${dateStr}`}
                                            />
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs text-muted-foreground w-8">إلى</span>
                                            <Input
                                              type="time"
                                              value={cellData.endTime}
                                              onChange={(e) => handleScheduleChange(empIdStr, dateStr, "endTime", e.target.value)}
                                              className="h-7 text-xs"
                                              data-testid={`input-end-${employee.id}-${dateStr}`}
                                            />
                                          </div>
                                        </div>
                                      )}
                                      {cellData.isOff && (
                                        <div className="text-center">
                                          <Badge variant="secondary" className="text-xs">إجازة</Badge>
                                        </div>
                                      )}
                                      {attendance && (
                                        <Badge className={`text-xs ${attendance.color}`}>{attendance.label}</Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );})}
                        </TableBody>
                      </Table>
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
                    سجل الحضور والانصراف - {getBranchName(selectedBranch)}
                  </CardTitle>
                  <CardDescription>
                    مقارنة جدول الدوام مع الحضور الفعلي للموظفين
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-4 items-center">
                    <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <span className="text-sm font-medium">
                      {format(currentWeekStart, "dd MMMM", { locale: ar })} - {format(addDays(currentWeekStart, 6), "dd MMMM yyyy", { locale: ar })}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  </div>

                  {filteredEmployees.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>لا يوجد موظفين</p>
                    </div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-right min-w-[180px] font-bold">الموظف</TableHead>
                            {weekDates.map((date, index) => (
                              <TableHead key={index} className={`text-center min-w-[150px] ${isToday(date) ? "bg-primary/10" : ""}`}>
                                <div className="font-bold">{DAYS_AR[index]}</div>
                                <div className="text-sm text-muted-foreground">{format(date, "dd/MM")}</div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredEmployees.map(employee => {
                            const empIdStr = String(employee.id);
                            const linkedUserId = employee.linkedUserId || empIdStr;
                            return (
                            <TableRow key={employee.id}>
                              <TableCell className="font-medium border-l">
                                <div className="font-semibold">{employee.employeeName}</div>
                                <div className="text-xs text-muted-foreground">{employee.jobTitle || "موظف"}</div>
                              </TableCell>
                              {weekDates.map((date, index) => {
                                const dateStr = format(date, "yyyy-MM-dd");
                                const cellData = scheduleData[empIdStr]?.[dateStr];
                                const attendance = getAttendanceForEmployee(linkedUserId, dateStr);
                                
                                return (
                                  <TableCell key={index} className={`p-2 text-center ${isToday(date) ? "bg-primary/5" : ""}`}>
                                    {cellData?.isOff ? (
                                      <Badge variant="secondary">إجازة</Badge>
                                    ) : (
                                      <div className="space-y-1">
                                        <div className="text-xs text-muted-foreground">
                                          المطلوب: {cellData?.startTime || "-"} - {cellData?.endTime || "-"}
                                        </div>
                                        {attendance ? (
                                          <div className="space-y-1">
                                            <div className="text-xs">
                                              حضر: <span className="font-medium text-green-600">{attendance.actualCheckIn || "-"}</span>
                                            </div>
                                            <div className="text-xs">
                                              انصرف: <span className="font-medium text-red-600">{attendance.actualCheckOut || "-"}</span>
                                            </div>
                                            {attendance.status === "present" && (
                                              <Badge className="bg-green-100 text-green-700 text-xs">حاضر</Badge>
                                            )}
                                            {attendance.status === "late" && (
                                              <Badge className="bg-amber-100 text-amber-700 text-xs">متأخر</Badge>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="text-xs text-muted-foreground">
                                            {new Date(dateStr) < new Date() ? (
                                              <Badge className="bg-red-100 text-red-700 text-xs">غائب</Badge>
                                            ) : (
                                              <span>-</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      التقرير الأسبوعي
                    </CardTitle>
                    <CardDescription>
                      ملخص دوام الموظفين للأسبوع الحالي
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span>عدد الموظفين:</span>
                        <span className="font-bold">{filteredEmployees.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>إجمالي أيام العمل المخططة:</span>
                        <span className="font-bold">
                          {Object.values(scheduleData).reduce((total, emp) => {
                            return total + Object.values(emp).filter(d => !d.isOff).length;
                          }, 0)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>إجمالي أيام الإجازات:</span>
                        <span className="font-bold">
                          {Object.values(scheduleData).reduce((total, emp) => {
                            return total + Object.values(emp).filter(d => d.isOff).length;
                          }, 0)}
                        </span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full gap-2 h-11 sm:h-9" disabled={isExporting || isExportingPdf} data-testid="btn-export-weekly">
                            {(isExporting || isExportingPdf) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isExporting ? "جاري التصدير Excel..." : isExportingPdf ? "جاري التصدير PDF..." : "تصدير التقرير"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={exportWeeklyReport} className="gap-2 cursor-pointer" data-testid="btn-export-excel">
                            <FileSpreadsheet className="w-4 h-4 text-green-600" />
                            تصدير Excel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={exportToPdf} className="gap-2 cursor-pointer" data-testid="btn-export-pdf">
                            <File className="w-4 h-4 text-red-600" />
                            تصدير PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={printReport} className="gap-2 cursor-pointer" data-testid="btn-print-weekly">
                            <Printer className="w-4 h-4 text-blue-600" />
                            طباعة
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      التقرير الشهري
                    </CardTitle>
                    <CardDescription>
                      ملخص شامل لدوام الموظفين خلال الشهر
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر الشهر" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          <SelectItem value={format(new Date(), "yyyy-MM")}>
                            {format(new Date(), "MMMM yyyy", { locale: ar })}
                          </SelectItem>
                          <SelectItem value={format(subMonths(new Date(), 1), "yyyy-MM")}>
                            {format(subMonths(new Date(), 1), "MMMM yyyy", { locale: ar })}
                          </SelectItem>
                          <SelectItem value={format(subMonths(new Date(), 2), "yyyy-MM")}>
                            {format(subMonths(new Date(), 2), "MMMM yyyy", { locale: ar })}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" className="w-full gap-2" onClick={generateMonthlyReport} disabled={isGeneratingMonthly} data-testid="btn-generate-monthly">
                        {isGeneratingMonthly ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        {isGeneratingMonthly ? "جاري الإنشاء..." : "إنشاء التقرير"}
                      </Button>
                      <Button variant="outline" className="w-full gap-2" onClick={printReport} data-testid="btn-print-report">
                        <Printer className="w-4 h-4" />
                        طباعة التقرير
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card id="printable-report">
                <CardHeader>
                  <CardTitle>تقرير تفصيلي للموظفين</CardTitle>
                  <CardDescription>عرض دوام كل موظف بالتفصيل</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">الموظف</TableHead>
                          <TableHead className="text-center">أيام العمل</TableHead>
                          <TableHead className="text-center">أيام الإجازة</TableHead>
                          <TableHead className="text-center">أيام الحضور</TableHead>
                          <TableHead className="text-center">أيام الغياب</TableHead>
                          <TableHead className="text-center">نسبة الحضور</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEmployees.map(employee => {
                          const empIdStr = String(employee.id);
                          const linkedUserId = employee.linkedUserId || empIdStr;
                          const empSchedule = scheduleData[empIdStr] || {};
                          const workDays = Object.values(empSchedule).filter(d => !d.isOff).length;
                          const offDays = Object.values(empSchedule).filter(d => d.isOff).length;
                          const attendedDays = attendanceRecords?.filter(r => r.employeeId === linkedUserId && r.actualCheckIn).length || 0;
                          const absentDays = workDays - attendedDays;
                          const rate = workDays > 0 ? Math.round((attendedDays / workDays) * 100) : 0;
                          
                          return (
                            <TableRow key={employee.id}>
                              <TableCell className="font-medium">
                                {employee.employeeName}
                              </TableCell>
                              <TableCell className="text-center">{workDays}</TableCell>
                              <TableCell className="text-center">{offDays}</TableCell>
                              <TableCell className="text-center text-green-600 font-medium">{attendedDays}</TableCell>
                              <TableCell className="text-center text-red-600 font-medium">{absentDays > 0 ? absentDays : 0}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={rate >= 80 ? "bg-green-100 text-green-700" : rate >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}>
                                  {rate}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <ShiftProfilesSettings branchId={selectedBranch} branchName={getBranchName(selectedBranch)} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Import Preview Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="w-5 h-5" />
              معاينة البيانات المستوردة
            </DialogTitle>
            <DialogDescription>
              راجع البيانات قبل الحفظ. سيتم تحديث الجداول الموجودة أو إنشاء جداول جديدة.
            </DialogDescription>
          </DialogHeader>

          {importErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-destructive flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4" />
                تحذيرات ({importErrors.length})
              </h4>
              <ul className="text-sm text-destructive space-y-1 list-disc list-inside max-h-32 overflow-y-auto">
                {importErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {importData.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الموظف</TableHead>
                    <TableHead className="text-center">عدد الأيام</TableHead>
                    <TableHead className="text-right">التفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importData.map((emp, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{emp.employeeName}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{emp.schedules.length} أيام</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {emp.schedules.slice(0, 4).map((s: any, i: number) => (
                            <Badge key={i} variant={s.isOff ? "outline" : "default"} className="text-xs">
                              {s.isOff ? "إجازة" : `${s.startTime}-${s.endTime}`}
                            </Badge>
                          ))}
                          {emp.schedules.length > 4 && (
                            <Badge variant="secondary" className="text-xs">+{emp.schedules.length - 4}</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {importData.length === 0 && importErrors.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              لم يتم العثور على بيانات صالحة للاستيراد
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={applyImportedSchedules}
              disabled={importData.length === 0 || isImporting}
              className="gap-2"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              استيراد {importData.reduce((sum, e) => sum + e.schedules.length, 0)} جدول
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

interface ShiftProfile {
  id?: number;
  branchId: string;
  shiftCode: string;
  displayName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutesBefore: number;
  graceMinutesAfter: number;
  isActive: boolean;
  sortOrder: number;
}

const DEFAULT_SHIFT_PROFILES: Omit<ShiftProfile, 'id' | 'branchId'>[] = [
  { shiftCode: "morning", displayName: "الوردية الصباحية", startTime: "06:00", endTime: "14:00", breakMinutes: 60, graceMinutesBefore: 15, graceMinutesAfter: 15, isActive: true, sortOrder: 1 },
  { shiftCode: "evening", displayName: "الوردية المسائية", startTime: "14:00", endTime: "22:00", breakMinutes: 60, graceMinutesBefore: 15, graceMinutesAfter: 15, isActive: true, sortOrder: 2 },
  { shiftCode: "night", displayName: "الوردية الليلية", startTime: "22:00", endTime: "06:00", breakMinutes: 60, graceMinutesBefore: 15, graceMinutesAfter: 15, isActive: true, sortOrder: 3 },
];

function ShiftProfilesSettings({ branchId, branchName }: { branchId: string; branchName: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profiles, setProfiles] = useState<ShiftProfile[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: savedProfiles, isLoading } = useQuery<ShiftProfile[]>({
    queryKey: ["/api/shift-profiles", branchId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/shift-profiles/${branchId}`);
      return res.json();
    },
    enabled: !!branchId,
  });

  useEffect(() => {
    if (savedProfiles && savedProfiles.length > 0) {
      setProfiles(savedProfiles);
    } else if (savedProfiles && savedProfiles.length === 0) {
      setProfiles(DEFAULT_SHIFT_PROFILES.map(p => ({ ...p, branchId })));
    }
    setHasChanges(false);
  }, [savedProfiles, branchId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/shift-profiles/${branchId}`, { profiles });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-profiles", branchId] });
      setHasChanges(false);
      toast({ title: "تم حفظ إعدادات الورديات بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حفظ الإعدادات", variant: "destructive" });
    },
  });

  const handleProfileChange = (index: number, field: keyof ShiftProfile, value: string | number | boolean) => {
    setProfiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setHasChanges(true);
  };

  const addCustomShift = () => {
    setProfiles(prev => [
      ...prev,
      {
        branchId,
        shiftCode: `custom_${Date.now()}`,
        displayName: "وردية مخصصة",
        startTime: "08:00",
        endTime: "16:00",
        breakMinutes: 60,
        graceMinutesBefore: 15,
        graceMinutesAfter: 15,
        isActive: true,
        sortOrder: prev.length + 1,
      },
    ]);
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    setProfiles(DEFAULT_SHIFT_PROFILES.map(p => ({ ...p, branchId })));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>جاري تحميل الإعدادات...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              إعدادات ساعات العمل للورديات - {branchName}
            </CardTitle>
            <CardDescription className="mt-1">
              تحديد مواعيد بداية ونهاية كل وردية لهذا الفرع. سيتم تطبيق هذه الإعدادات تلقائياً عند إنشاء جداول الدوام.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetToDefaults} data-testid="btn-reset-defaults">
              إعادة الضبط
            </Button>
            <Button variant="outline" onClick={addCustomShift} data-testid="btn-add-custom-shift">
              <Plus className="w-4 h-4 ml-2" />
              إضافة وردية
            </Button>
            {hasChanges && (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="btn-save-shift-settings">
                <Save className="w-4 h-4 ml-2" />
                {saveMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map((profile, index) => (
            <Card key={profile.shiftCode} className={!profile.isActive ? "opacity-50" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Input
                    value={profile.displayName}
                    onChange={(e) => handleProfileChange(index, "displayName", e.target.value)}
                    className="font-bold text-lg border-0 p-0 h-auto focus-visible:ring-0"
                    data-testid={`input-shift-name-${profile.shiftCode}`}
                  />
                  <Badge variant={profile.isActive ? "default" : "secondary"}>
                    {profile.isActive ? "مفعّل" : "معطّل"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  كود الوردية: {profile.shiftCode}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">وقت البداية</Label>
                    <Input
                      type="time"
                      value={profile.startTime}
                      onChange={(e) => handleProfileChange(index, "startTime", e.target.value)}
                      className="mt-1"
                      data-testid={`input-start-time-${profile.shiftCode}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">وقت النهاية</Label>
                    <Input
                      type="time"
                      value={profile.endTime}
                      onChange={(e) => handleProfileChange(index, "endTime", e.target.value)}
                      className="mt-1"
                      data-testid={`input-end-time-${profile.shiftCode}`}
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs">فترة الاستراحة (دقائق)</Label>
                  <Input
                    type="number"
                    value={profile.breakMinutes}
                    onChange={(e) => handleProfileChange(index, "breakMinutes", parseInt(e.target.value) || 0)}
                    className="mt-1"
                    min={0}
                    max={120}
                    data-testid={`input-break-${profile.shiftCode}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">سماحية قبل (دقائق)</Label>
                    <Input
                      type="number"
                      value={profile.graceMinutesBefore}
                      onChange={(e) => handleProfileChange(index, "graceMinutesBefore", parseInt(e.target.value) || 0)}
                      className="mt-1"
                      min={0}
                      max={60}
                      data-testid={`input-grace-before-${profile.shiftCode}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">سماحية بعد (دقائق)</Label>
                    <Input
                      type="number"
                      value={profile.graceMinutesAfter}
                      onChange={(e) => handleProfileChange(index, "graceMinutesAfter", parseInt(e.target.value) || 0)}
                      className="mt-1"
                      min={0}
                      max={60}
                      data-testid={`input-grace-after-${profile.shiftCode}`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <Label htmlFor={`active-${profile.shiftCode}`} className="text-sm">تفعيل الوردية</Label>
                  <Checkbox
                    id={`active-${profile.shiftCode}`}
                    checked={profile.isActive}
                    onCheckedChange={(checked) => handleProfileChange(index, "isActive", checked === true)}
                    data-testid={`checkbox-active-${profile.shiftCode}`}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            كيفية استخدام إعدادات الورديات
          </h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>عند إنشاء جدول دوام جديد، اختر نوع الوردية وسيتم تعبئة الأوقات تلقائياً</li>
            <li>فترة السماحية تستخدم لحساب التأخير (مثال: 15 دقيقة سماحية = لا يحتسب تأخير قبل 15 دقيقة)</li>
            <li>يمكنك تعديل الأوقات يدوياً بعد التعبئة التلقائية إذا لزم الأمر</li>
            <li>الورديات المعطلة لن تظهر في قائمة الاختيار عند إنشاء الجداول</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
