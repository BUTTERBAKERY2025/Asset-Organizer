import React, { useState, useRef, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useBranches } from "@/hooks/useBranches";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  ChevronLeft,
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Building2,
  CalendarDays,
  Wallet,
  RefreshCw,
  Shield,
  Plus,
  Trash2,
  MinusCircle,
} from "lucide-react";
import type { BranchEmployee, AttendanceRecord, TimesheetReport, SalaryDeduction } from "@shared/schema";
import { SALARY_DEDUCTION_TYPE_LABELS } from "@shared/schema";

// =====================================================
// مكوّن نافذة إدارة السُلف والخصومات اليدوية للموظف
// =====================================================
function DeductionsPopover({
  branchEmployeeId,
  branchId,
  month,
  employeeName,
  initialDeductions,
  totalAmount,
  onChanged,
}: {
  branchEmployeeId: number;
  branchId: string;
  month: string;
  employeeName: string;
  initialDeductions: SalaryDeduction[];
  totalAmount: number;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newType, setNewType] = useState<string>("advance");
  const [newAmount, setNewAmount] = useState<string>("");
  const [newDescription, setNewDescription] = useState<string>("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/employee-reports/bundle", "salary-closing"] });
    onChanged();
  };

  const createMutation = useMutation({
    mutationFn: async (payload: { type: string; amount: number; description: string }) => {
      const res = await fetch("/api/salary-deductions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchEmployeeId,
          branchId,
          month,
          type: payload.type,
          amount: payload.amount,
          description: payload.description || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل الحفظ");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الإضافة", description: "تم تسجيل السلفة/الخصم بنجاح" });
      setNewAmount("");
      setNewDescription("");
      refresh();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/salary-deductions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل الحذف");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "تم الحذف", description: "تم حذف السجل بنجاح" });
      refresh();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleAdd = () => {
    const amount = parseFloat(newAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "مبلغ غير صحيح", description: "أدخل مبلغ موجب", variant: "destructive" });
      return;
    }
    createMutation.mutate({ type: newType, amount, description: newDescription.trim() });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={`btn-deductions-${branchEmployeeId}`}
          className="flex flex-col items-center gap-0.5 hover:bg-orange-50 rounded p-1 transition-colors w-full"
          title="إضافة/تعديل السُلف والخصومات اليدوية"
        >
          {totalAmount > 0 ? (
            <Badge className="bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200 cursor-pointer text-xs">
              - {totalAmount.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س
            </Badge>
          ) : (
            <span className="text-gray-400 text-xs flex items-center gap-1">
              <Plus className="w-3 h-3" /> إضافة
            </span>
          )}
          {initialDeductions.length > 0 && (
            <span className="text-[10px] text-gray-500">{initialDeductions.length} عنصر</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-h-[500px] overflow-y-auto" side="top">
        <div className="space-y-3">
          <div className="border-b pb-2">
            <div className="text-sm font-bold text-gray-900">السُلف والخصومات اليدوية</div>
            <div className="text-xs text-gray-600">{employeeName} — {month}</div>
          </div>

          {initialDeductions.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-gray-700">السجلات الحالية:</div>
              {initialDeductions.map(d => (
                <div key={d.id} className="flex items-start justify-between gap-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-orange-200 text-orange-900 text-[10px] px-1.5 py-0">
                        {SALARY_DEDUCTION_TYPE_LABELS[d.type] || d.type}
                      </Badge>
                      <span className="font-bold text-orange-900">
                        {d.amount.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س
                      </span>
                    </div>
                    {d.description && (
                      <div className="text-gray-600 mt-0.5 break-words">{d.description}</div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`حذف ${SALARY_DEDUCTION_TYPE_LABELS[d.type]} بمبلغ ${d.amount} ر.س؟`)) {
                        deleteMutation.mutate(d.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`btn-delete-deduction-${d.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <div className="text-xs font-bold text-orange-900 text-left pt-1 border-t border-orange-200">
                الإجمالي: - {totalAmount.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-semibold text-gray-700">إضافة جديدة:</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">النوع</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-deduction-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SALARY_DEDUCTION_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px]">المبلغ (ر.س)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-xs"
                  data-testid="input-deduction-amount"
                />
              </div>
            </div>
            <div>
              <Label className="text-[11px]">الوصف (اختياري)</Label>
              <Textarea
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="مثال: سلفة شهر يناير، خصم تأخير..."
                rows={2}
                className="text-xs resize-none"
                data-testid="input-deduction-description"
              />
            </div>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={createMutation.isPending || !newAmount}
              size="sm"
              className="w-full h-8 text-xs bg-orange-600 hover:bg-orange-700"
              data-testid="btn-add-deduction"
            >
              <Plus className="w-3.5 h-3.5 ml-1" />
              {createMutation.isPending ? "جاري الحفظ..." : "إضافة"}
            </Button>
          </div>

          <div className="text-[10px] text-gray-500 pt-1 border-t">
            💡 المبلغ المُسجَّل سيُخصم من صافي الراتب تلقائياً عند إغلاق هذا الشهر.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function formatCurrency(value: number | null | undefined, isRTL: boolean = true): string {
  if (value == null) return isRTL ? "0 ريال" : "0 SAR";
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) + (isRTL ? " ريال" : " SAR");
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "0";
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString('en-US');
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return "--";
  return timeStr;
}

export default function EmployeeReportsDashboardPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [, navigate] = useLocation();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [showSalaryClosingDialog, setShowSalaryClosingDialog] = useState(false);
  const [salaryClosingBranch, setSalaryClosingBranch] = useState<string>("");
  const [salaryClosingMonth, setSalaryClosingMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [salarySearchQuery, setSalarySearchQuery] = useState<string>("");
  const [salaryMinFilter, setSalaryMinFilter] = useState<string>("");
  const [salaryMaxFilter, setSalaryMaxFilter] = useState<string>("");
  const [salaryNationalityFilter, setSalaryNationalityFilter] = useState<string>("all");
  const [salarySortField, setSalarySortField] = useState<string>("employeeName");
  const [salarySortOrder, setSalarySortOrder] = useState<"asc" | "desc">("asc");

  const { branches, userBranchId, canSelectBranch } = useBranches();

  useEffect(() => {
    if (userBranchId) {
      setSelectedBranch(userBranchId);
    } else if (canSelectBranch) {
      setSelectedBranch("all");
    }
  }, [userBranchId, canSelectBranch]);

  const { data: bundle, isLoading: bundleLoading } = useQuery<{
    employees: BranchEmployee[];
    attendance: AttendanceRecord[];
    schedules: any[];
    signedTimesheets?: Array<{ report: any; entries: any[] }>;
  }>({
    queryKey: ["/api/employee-reports/bundle", selectedBranch, selectedMonth],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") params.set("branchId", selectedBranch);
      if (selectedMonth) params.set("month", selectedMonth);
      const res = await fetch(`/api/employee-reports/bundle?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedBranch,
    staleTime: 60_000,
  });

  const employees = bundle?.employees;
  const attendanceRecords = bundle?.attendance;
  const employeeSchedules = bundle?.schedules;

  // استعلام مخصص لتقرير إغلاق الرواتب - يستخدم متغيرات الإغلاق المنفصلة
  // لضمان تحميل بصمات وجداول الشهر/الفرع المختار في نافذة الإغلاق (وليس الشاشة العامة)
  const { data: salaryClosingBundle, isLoading: salaryClosingBundleLoading } = useQuery<{
    employees: BranchEmployee[];
    attendance: AttendanceRecord[];
    schedules: any[];
    signedTimesheets?: Array<{ report: any; entries: any[] }>;
    salaryDeductions?: SalaryDeduction[];
  }>({
    queryKey: ["/api/employee-reports/bundle", "salary-closing", salaryClosingBranch, salaryClosingMonth],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (salaryClosingBranch && salaryClosingBranch !== "all") params.set("branchId", salaryClosingBranch);
      if (salaryClosingMonth) params.set("month", salaryClosingMonth);
      const res = await fetch(`/api/employee-reports/bundle?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary closing bundle");
      return res.json();
    },
    enabled: !!salaryClosingBranch && salaryClosingBranch !== "all" && showSalaryClosingDialog,
    staleTime: 60_000,
  });

  // عند فتح نافذة إغلاق الرواتب لفرع محدد:
  // نستخدم فقط بيانات الـ bundle المخصص للإغلاق لتجنب عرض/تصدير بيانات قديمة من الشاشة العامة.
  // عندما تكون النافذة مغلقة أو الفرع="all" نعتمد على بيانات الشاشة العامة كاحتياط.
  const salaryDialogActive = !!salaryClosingBranch && salaryClosingBranch !== "all" && showSalaryClosingDialog;
  const salaryClosingEmployees = salaryDialogActive
    ? salaryClosingBundle?.employees
    : (salaryClosingBundle?.employees ?? employees);
  const salaryClosingAttendance = salaryDialogActive
    ? salaryClosingBundle?.attendance
    : (salaryClosingBundle?.attendance ?? attendanceRecords);
  const salaryClosingSchedules = salaryDialogActive
    ? salaryClosingBundle?.schedules
    : (salaryClosingBundle?.schedules ?? employeeSchedules);
  const salaryClosingSignedTimesheets = salaryDialogActive
    ? salaryClosingBundle?.signedTimesheets
    : (salaryClosingBundle?.signedTimesheets ?? bundle?.signedTimesheets);
  const salaryClosingDeductions: SalaryDeduction[] = (salaryDialogActive
    ? salaryClosingBundle?.salaryDeductions
    : salaryClosingBundle?.salaryDeductions) ?? [];
  // مؤشر "البيانات جاهزة للإغلاق" - إما النافذة غير نشطة، أو الـ bundle المخصص اكتمل تحميله
  const salaryClosingReady = !salaryDialogActive || (!!salaryClosingBundle && !salaryClosingBundleLoading);
  const employeesLoading = bundleLoading;
  const attendanceLoading = bundleLoading;

  const { data: timesheetReports } = useQuery<TimesheetReport[]>({
    queryKey: ["/api/timesheet-reports"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: activeTab === "timesheets",
    staleTime: 60_000,
  });

  const { data: cashierJournals } = useQuery<{ id: number; branchId: string; cashierName: string; cashierId: string; reportDate: string; totalSales: number; totalCash: number; status: string }[]>({
    queryKey: ["/api/cashier-journals"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: activeTab === "performance",
    staleTime: 60_000,
  });

  const getBranchName = (branchId: string) => {
    const branch = branches?.find(b => b.id === branchId);
    return branch?.name || branchId;
  };

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(emp => {
      if (selectedBranch !== "all" && emp.branchId !== selectedBranch) return false;
      if (selectedJobTitle !== "all" && emp.jobTitle !== selectedJobTitle) return false;
      if (selectedEmployee !== "all" && emp.id.toString() !== selectedEmployee) return false;
      return true;
    });
  }, [employees, selectedBranch, selectedJobTitle, selectedEmployee]);

  const filteredEmployeeLookup = useMemo(() => {
    const employeeIds = new Set<string>();
    filteredEmployees.forEach(emp => {
      employeeIds.add(emp.id.toString());
      employeeIds.add(`branch_emp_${emp.id}`);
      if ((emp as any).linkedUserId) {
        employeeIds.add((emp as any).linkedUserId);
      }
    });
    return {
      ids: new Set(filteredEmployees.map(emp => emp.id)),
      employeeIds,
    };
  }, [filteredEmployees]);

  // Filtered and sorted employees for salary tab
  const salaryFilteredEmployees = useMemo(() => {
    let result = [...filteredEmployees];
    
    // Apply search filter
    if (salarySearchQuery.trim()) {
      const query = salarySearchQuery.toLowerCase().trim();
      result = result.filter(emp => 
        emp.employeeName.toLowerCase().includes(query) ||
        (emp.employeeNumber?.toLowerCase()?.includes(query) ?? false) ||
        emp.jobTitle.toLowerCase().includes(query)
      );
    }
    
    // Apply nationality filter
    if (salaryNationalityFilter !== "all") {
      result = result.filter(emp => emp.nationality === salaryNationalityFilter);
    }
    
    // Apply salary range filter
    const minSalary = salaryMinFilter ? parseFloat(salaryMinFilter) : 0;
    const maxSalary = salaryMaxFilter ? parseFloat(salaryMaxFilter) : Infinity;
    result = result.filter(emp => {
      const salary = emp.totalSalary || 0;
      return salary >= minSalary && salary <= maxSalary;
    });
    
    // Apply sorting
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (salarySortField) {
        case "employeeName": aVal = a.employeeName; bVal = b.employeeName; break;
        case "salary": aVal = a.salary || 0; bVal = b.salary || 0; break;
        case "totalSalary": aVal = a.totalSalary || 0; bVal = b.totalSalary || 0; break;
        case "branchId": aVal = getBranchName(a.branchId); bVal = getBranchName(b.branchId); break;
        case "jobTitle": aVal = a.jobTitle; bVal = b.jobTitle; break;
        default: aVal = a.employeeName; bVal = b.employeeName;
      }
      if (typeof aVal === "string") {
        return salarySortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return salarySortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
    
    return result;
  }, [filteredEmployees, salarySearchQuery, salaryNationalityFilter, salaryMinFilter, salaryMaxFilter, salarySortField, salarySortOrder, getBranchName]);

  const uniqueNationalities = useMemo(() => {
    if (!employees) return [];
    return Array.from(new Set(employees.map(emp => emp.nationality))).sort();
  }, [employees]);

  const filteredAttendance = useMemo(() => {
    if (!attendanceRecords) return [];
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = `${selectedMonth}-31`;
    return attendanceRecords.filter(rec => {
      if (selectedBranch !== "all" && rec.branchId !== selectedBranch) return false;
      if (rec.attendanceDate < monthStart || rec.attendanceDate > monthEnd) return false;
      if (selectedJobTitle !== "all" || selectedEmployee !== "all") {
        const matchesByBranchEmployeeId = rec.branchEmployeeId && filteredEmployeeLookup.ids.has(rec.branchEmployeeId);
        const matchesByEmployeeId = filteredEmployeeLookup.employeeIds.has(rec.employeeId);
        const matchesByName = rec.employeeName && filteredEmployees.some(emp => emp.employeeName === rec.employeeName && emp.branchId === rec.branchId);
        if (!matchesByBranchEmployeeId && !matchesByEmployeeId && !matchesByName) return false;
      }
      return true;
    });
  }, [attendanceRecords, selectedBranch, selectedMonth, selectedJobTitle, selectedEmployee, filteredEmployeeLookup, filteredEmployees]);

  const jobTitles = useMemo(() => {
    if (!employees) return [];
    return Array.from(new Set(employees.map(emp => emp.jobTitle)));
  }, [employees]);

  const allBranchMonthAttendance = useMemo(() => {
    if (!attendanceRecords) return [];
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = `${selectedMonth}-31`;
    return attendanceRecords.filter(rec => {
      if (selectedBranch !== "all" && rec.branchId !== selectedBranch) return false;
      if (rec.attendanceDate < monthStart || rec.attendanceDate > monthEnd) return false;
      return true;
    });
  }, [attendanceRecords, selectedBranch, selectedMonth]);

  const overviewStats = useMemo(() => {
    const totalEmployees = filteredEmployees.length;
    const totalSalaries = filteredEmployees.reduce((sum, emp) => sum + (emp.totalSalary || emp.salary || 0), 0);
    const saudiEmployees = filteredEmployees.filter(emp => emp.nationality === "سعودي").length;
    const activeEmployees = filteredEmployees.filter(emp => emp.status === "active").length;
    const totalInsurance = filteredEmployees
      .filter(emp => emp.nationality === "سعودي")
      .reduce((sum, emp) => {
        const storedDeduction = emp.socialInsuranceDeduction || 0;
        if (storedDeduction > 0) return sum + storedDeduction;
        const baseSalary = emp.salary || 0;
        return sum + Math.round(baseSalary * 0.0975);
      }, 0);
    
    const attendanceData = (selectedJobTitle !== "all" || selectedEmployee !== "all") 
      ? filteredAttendance 
      : allBranchMonthAttendance;
    const attendanceCount = attendanceData.length;
    const presentCount = attendanceData.filter(r => r.status === "present").length;
    const absentCount = attendanceData.filter(r => r.status === "absent").length;
    const lateCount = attendanceData.filter(r => r.status === "late").length;
    const attendanceRate = attendanceCount > 0 ? Math.round((presentCount / attendanceCount) * 100) : 0;

    return {
      totalEmployees,
      totalSalaries,
      saudiEmployees,
      activeEmployees,
      totalInsurance,
      attendanceCount,
      presentCount,
      absentCount,
      lateCount,
      attendanceRate,
    };
  }, [filteredEmployees, allBranchMonthAttendance, filteredAttendance, selectedJobTitle, selectedEmployee]);

  const employeeLookupByRecord = useMemo(() => {
    if (!filteredEmployees) return new Map<string, number>();
    const lookup = new Map<string, number>();
    filteredEmployees.forEach(emp => {
      lookup.set(`bid:${emp.id}`, emp.id);
      lookup.set(`eid:${emp.id.toString()}`, emp.id);
      lookup.set(`eid:branch_emp_${emp.id}`, emp.id);
      if (emp.employeeNumber) {
        lookup.set(`enum:${emp.employeeNumber}`, emp.id);
      }
      if ((emp as any).linkedUserId) {
        lookup.set(`eid:${(emp as any).linkedUserId}`, emp.id);
      }
    });
    return lookup;
  }, [filteredEmployees]);

  const resolveEmployeeId = (rec: AttendanceRecord, lookup: Map<string, number>): number | null => {
    if (rec.branchEmployeeId && lookup.has(`bid:${rec.branchEmployeeId}`)) {
      return rec.branchEmployeeId;
    }
    if (lookup.has(`eid:${rec.employeeId}`)) {
      return lookup.get(`eid:${rec.employeeId}`) || null;
    }
    if (rec.employeeName) {
      for (const emp of filteredEmployees) {
        if (emp.employeeName === rec.employeeName && emp.branchId === rec.branchId) {
          return emp.id;
        }
      }
    }
    return null;
  };

  const { attendanceByEmployee, unlinkedRecordsCount, unlinkedRecords } = useMemo(() => {
    const map = new Map<number, { present: number; absent: number; late: number; total: number }>();
    const unlinkedList: AttendanceRecord[] = [];
    
    filteredAttendance.forEach(rec => {
      const empId = resolveEmployeeId(rec, employeeLookupByRecord);
      if (!empId) {
        unlinkedList.push(rec);
        return;
      }
      const current = map.get(empId) || { present: 0, absent: 0, late: 0, total: 0 };
      current.total++;
      if (rec.status === "present") current.present++;
      else if (rec.status === "absent") current.absent++;
      else if (rec.status === "late") current.late++;
      map.set(empId, current);
    });
    return { attendanceByEmployee: map, unlinkedRecordsCount: unlinkedList.length, unlinkedRecords: unlinkedList };
  }, [filteredAttendance, employeeLookupByRecord]);

  const nationalityChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredEmployees.forEach(emp => {
      map.set(emp.nationality, (map.get(emp.nationality) || 0) + 1);
    });
    const sorted = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    
    // Show top 5 and group rest as "Others"
    if (sorted.length > 5) {
      const top5 = sorted.slice(0, 5);
      const othersSum = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
      return [...top5, { name: isRTL ? "أخرى" : "Others", value: othersSum }];
    }
    return sorted;
  }, [filteredEmployees, isRTL]);

  const jobTitleChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredEmployees.forEach(emp => {
      map.set(emp.jobTitle, (map.get(emp.jobTitle) || 0) + 1);
    });
    const sorted = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    
    // Show top 8 only for cleaner chart
    return sorted.slice(0, 8);
  }, [filteredEmployees]);

  const jobTitleFullData = useMemo(() => {
    const map = new Map<string, number>();
    filteredEmployees.forEach(emp => {
      map.set(emp.jobTitle, (map.get(emp.jobTitle) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEmployees]);

  const branchSalaryData = useMemo(() => {
    const map = new Map<string, number>();
    filteredEmployees.forEach(emp => {
      const branchName = getBranchName(emp.branchId);
      map.set(branchName, (map.get(branchName) || 0) + (emp.totalSalary || emp.salary || 0));
    });
    return Array.from(map.entries())
      .map(([name, salary]) => ({ name, salary }))
      .sort((a, b) => b.salary - a.salary);
  }, [filteredEmployees, branches]);

  const previousMonthStats = useMemo(() => {
    if (!employees || !attendanceRecords) return null;
    const currentDate = new Date(selectedMonth + "-01");
    const prevMonthDate = new Date(currentDate);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonth = prevMonthDate.toISOString().slice(0, 7);
    const prevMonthStart = `${prevMonth}-01`;
    const prevMonthEnd = `${prevMonth}-31`;
    const prevMonthLastDay = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0);
    
    const prevMonthEmployees = employees.filter(emp => {
      if (selectedBranch !== "all" && emp.branchId !== selectedBranch) return false;
      if (selectedJobTitle !== "all" && emp.jobTitle !== selectedJobTitle) return false;
      if (selectedEmployee !== "all" && emp.id.toString() !== selectedEmployee) return false;
      if (emp.hireDate && new Date(emp.hireDate) > prevMonthLastDay) return false;
      if (emp.status !== "active" && emp.status !== "terminated" && emp.status !== "resigned") return false;
      return true;
    });
    
    const prevMonthEmployeeIds = new Set(prevMonthEmployees.map(emp => emp.id));
    const prevMonthEmpIdStrings = new Set<string>();
    prevMonthEmployees.forEach(emp => {
      prevMonthEmpIdStrings.add(emp.id.toString());
      prevMonthEmpIdStrings.add(`branch_emp_${emp.id}`);
      if ((emp as any).linkedUserId) prevMonthEmpIdStrings.add((emp as any).linkedUserId);
    });
    
    const prevAttendance = attendanceRecords.filter(rec => {
      if (selectedBranch !== "all" && rec.branchId !== selectedBranch) return false;
      if (rec.attendanceDate < prevMonthStart || rec.attendanceDate > prevMonthEnd) return false;
      if (selectedJobTitle !== "all" || selectedEmployee !== "all") {
        const matchesByBranchEmployeeId = rec.branchEmployeeId && prevMonthEmployeeIds.has(rec.branchEmployeeId);
        const matchesByEmployeeId = prevMonthEmpIdStrings.has(rec.employeeId);
        const matchesByName = rec.employeeName && prevMonthEmployees.some(emp => emp.employeeName === rec.employeeName && emp.branchId === rec.branchId);
        if (!matchesByBranchEmployeeId && !matchesByEmployeeId && !matchesByName) return false;
      }
      return true;
    });
    
    const prevPresentCount = prevAttendance.filter(r => r.status === "present").length;
    const prevTotalAttendance = prevAttendance.length;
    const prevAttendanceRate = prevTotalAttendance > 0 ? Math.round((prevPresentCount / prevTotalAttendance) * 100) : 0;
    
    const prevTotalSalaries = prevMonthEmployees.reduce((sum, emp) => sum + (emp.totalSalary || emp.salary || 0), 0);
    
    return {
      attendanceRate: prevAttendanceRate,
      totalSalaries: prevTotalSalaries,
      totalEmployees: prevMonthEmployees.length,
    };
  }, [employees, attendanceRecords, selectedMonth, selectedBranch, selectedJobTitle, selectedEmployee]);

  const getChangeIndicator = (current: number, previous: number | undefined) => {
    if (!previous || previous === 0) return { change: 0, isPositive: true };
    const change = Math.round(((current - previous) / previous) * 100);
    return { change, isPositive: change >= 0 };
  };

  const branchComparisonData = useMemo(() => {
    if (!employees || !branches || !attendanceRecords) return [];
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = `${selectedMonth}-31`;
    
    const branchesToProcess = selectedBranch !== "all" 
      ? branches.filter(b => b.id === selectedBranch)
      : branches;
    
    return branchesToProcess.map(branch => {
      const branchEmps = employees.filter(emp => {
        if (emp.branchId !== branch.id) return false;
        if (emp.status !== "active") return false;
        if (selectedJobTitle !== "all" && emp.jobTitle !== selectedJobTitle) return false;
        if (selectedEmployee !== "all" && emp.id.toString() !== selectedEmployee) return false;
        return true;
      });
      
      const branchEmployeeIds = new Set(branchEmps.map(e => e.id));
      const branchEmpIdStrings = new Set<string>();
      branchEmps.forEach(e => {
        branchEmpIdStrings.add(e.id.toString());
        branchEmpIdStrings.add(`branch_emp_${e.id}`);
        if ((e as any).linkedUserId) branchEmpIdStrings.add((e as any).linkedUserId);
      });
      const branchAttendance = attendanceRecords.filter(rec => {
        if (rec.branchId !== branch.id) return false;
        if (rec.attendanceDate < monthStart || rec.attendanceDate > monthEnd) return false;
        if (selectedJobTitle !== "all" || selectedEmployee !== "all") {
          const matchesByBranchEmployeeId = rec.branchEmployeeId && branchEmployeeIds.has(rec.branchEmployeeId);
          const matchesByEmployeeId = branchEmpIdStrings.has(rec.employeeId);
          const matchesByName = rec.employeeName && branchEmps.some(emp => emp.employeeName === rec.employeeName && emp.branchId === rec.branchId);
          if (!matchesByBranchEmployeeId && !matchesByEmployeeId && !matchesByName) return false;
        }
        return true;
      });
      
      const employeeCount = branchEmps.length;
      const saudiCount = branchEmps.filter(emp => emp.nationality === "سعودي").length;
      const saudiPercentage = employeeCount > 0 ? Math.round((saudiCount / employeeCount) * 100) : 0;
      const totalSalary = branchEmps.reduce((sum, emp) => sum + (emp.totalSalary || emp.salary || 0), 0);
      const avgSalary = employeeCount > 0 ? Math.round(totalSalary / employeeCount) : 0;
      const totalInsurance = branchEmps.filter(emp => emp.nationality === "سعودي")
        .reduce((sum, emp) => {
          const storedDeduction = emp.socialInsuranceDeduction || 0;
          if (storedDeduction > 0) return sum + storedDeduction;
          const baseSalary = emp.salary || 0;
          return sum + Math.round(baseSalary * 0.0975);
        }, 0);
      const totalAllowances = branchEmps.reduce((sum, emp) => 
        sum + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0), 0);
      
      const presentCount = branchAttendance.filter(r => r.status === "present" || r.status === "late").length;
      const absentCount = branchAttendance.filter(r => r.status === "absent").length;
      const lateCount = branchAttendance.filter(r => r.status === "late").length;
      const totalAttendance = branchAttendance.length;
      const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;
      const absentRate = totalAttendance > 0 ? Math.round((absentCount / totalAttendance) * 100) : 0;
      const totalHours = branchAttendance.reduce((sum, r) => sum + (Number(r.workingHours) || 0), 0);
      
      return {
        branchId: branch.id,
        branchName: branch.name,
        employeeCount,
        saudiCount,
        saudiPercentage,
        totalSalary,
        avgSalary,
        totalInsurance,
        totalAllowances,
        presentCount,
        absentCount,
        lateCount,
        attendanceRate,
        absentRate,
        totalHours: Math.round(totalHours),
      };
    }).filter(b => b.employeeCount > 0);
  }, [employees, branches, attendanceRecords, selectedMonth, selectedBranch, selectedJobTitle, selectedEmployee]);

  const jobComparisonData = useMemo(() => {
    if (!employees || !branches || !attendanceRecords) return [];
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = `${selectedMonth}-31`;
    
    const jobBranchMap = new Map<string, Map<string, {
      count: number;
      totalSalary: number;
      minSalary: number;
      maxSalary: number;
      present: number;
      absent: number;
      totalRecords: number;
    }>>();
    
    employees.filter(emp => {
      if (emp.status !== "active") return false;
      if (selectedBranch !== "all" && emp.branchId !== selectedBranch) return false;
      if (selectedJobTitle !== "all" && emp.jobTitle !== selectedJobTitle) return false;
      if (selectedEmployee !== "all" && emp.id.toString() !== selectedEmployee) return false;
      return true;
    }).forEach(emp => {
      if (!jobBranchMap.has(emp.jobTitle)) {
        jobBranchMap.set(emp.jobTitle, new Map());
      }
      const branchMap = jobBranchMap.get(emp.jobTitle)!;
      const branchName = getBranchName(emp.branchId);
      const current = branchMap.get(branchName) || { 
        count: 0, totalSalary: 0, minSalary: Infinity, maxSalary: 0, present: 0, absent: 0, totalRecords: 0 
      };
      const salary = emp.totalSalary || emp.salary || 0;
      current.count++;
      current.totalSalary += salary;
      current.minSalary = Math.min(current.minSalary, salary);
      current.maxSalary = Math.max(current.maxSalary, salary);
      
      const empAttendance = attendanceRecords.filter(rec => 
        (rec.branchEmployeeId === emp.id || rec.employeeId === emp.id.toString() || rec.employeeId === `branch_emp_${emp.id}` || ((emp as any).linkedUserId && rec.employeeId === (emp as any).linkedUserId) || (rec.employeeName === emp.employeeName && rec.branchId === emp.branchId)) &&
        rec.attendanceDate >= monthStart && rec.attendanceDate <= monthEnd
      );
      current.present += empAttendance.filter(r => r.status === "present" || r.status === "late").length;
      current.absent += empAttendance.filter(r => r.status === "absent").length;
      current.totalRecords += empAttendance.length;
      
      branchMap.set(branchName, current);
    });
    
    const results: Array<{
      jobTitle: string;
      branches: Array<{
        branchName: string;
        count: number;
        avgSalary: number;
        minSalary: number;
        maxSalary: number;
        attendanceRate: number;
      }>;
      totalCount: number;
      avgSalary: number;
      minSalary: number;
      maxSalary: number;
      salaryVariance: number;
    }> = [];
    
    jobBranchMap.forEach((branchMap, jobTitle) => {
      const branchData: Array<{
        branchName: string;
        count: number;
        avgSalary: number;
        minSalary: number;
        maxSalary: number;
        attendanceRate: number;
      }> = [];
      let totalCount = 0;
      let totalSalary = 0;
      let overallMin = Infinity;
      let overallMax = 0;
      
      branchMap.forEach((data, branchName) => {
        const avgSalary = data.count > 0 ? Math.round(data.totalSalary / data.count) : 0;
        const attendanceRate = data.totalRecords > 0 ? Math.round((data.present / data.totalRecords) * 100) : 0;
        branchData.push({
          branchName,
          count: data.count,
          avgSalary,
          minSalary: data.minSalary === Infinity ? 0 : data.minSalary,
          maxSalary: data.maxSalary,
          attendanceRate,
        });
        totalCount += data.count;
        totalSalary += data.totalSalary;
        overallMin = Math.min(overallMin, data.minSalary);
        overallMax = Math.max(overallMax, data.maxSalary);
      });
      
      if (branchData.length > 1) {
        const avgSalary = totalCount > 0 ? Math.round(totalSalary / totalCount) : 0;
        const salaryVariance = overallMax - (overallMin === Infinity ? 0 : overallMin);
        results.push({
          jobTitle,
          branches: branchData.sort((a, b) => b.avgSalary - a.avgSalary),
          totalCount,
          avgSalary,
          minSalary: overallMin === Infinity ? 0 : overallMin,
          maxSalary: overallMax,
          salaryVariance,
        });
      }
    });
    
    return results.sort((a, b) => b.salaryVariance - a.salaryVariance);
  }, [employees, branches, attendanceRecords, selectedMonth, selectedBranch, selectedJobTitle, selectedEmployee, getBranchName]);

  const topEmployeesBySalary = useMemo(() => {
    return [...filteredEmployees]
      .sort((a, b) => (b.totalSalary || b.salary || 0) - (a.totalSalary || a.salary || 0))
      .slice(0, 10);
  }, [filteredEmployees]);

  const allowancesBreakdown = useMemo(() => {
    const totals = filteredEmployees.reduce((acc, emp) => ({
      housing: acc.housing + (emp.housingAllowance || 0),
      transport: acc.transport + (emp.transportAllowance || 0),
      food: acc.food + (emp.foodAllowance || 0),
      other: acc.other + (emp.otherAllowances || 0),
    }), { housing: 0, transport: 0, food: 0, other: 0 });
    
    return [
      { name: isRTL ? "بدل السكن" : "Housing", value: totals.housing, color: "#3b82f6" },
      { name: isRTL ? "بدل النقل" : "Transport", value: totals.transport, color: "#10b981" },
      { name: isRTL ? "بدل الطعام" : "Food", value: totals.food, color: "#f59e0b" },
      { name: isRTL ? "بدلات أخرى" : "Other", value: totals.other, color: "#8b5cf6" },
    ].filter(item => item.value > 0);
  }, [filteredEmployees, isRTL]);

  const { salaryClosingData, salaryClosingUnlinkedCount, salaryClosingUnlinkedRecords, salaryClosingUnlinkedSummary } = useMemo(() => {
    if (!salaryClosingBranch || salaryClosingBranch === "all") return { salaryClosingData: [], salaryClosingUnlinkedCount: 0, salaryClosingUnlinkedRecords: [] as AttendanceRecord[], salaryClosingUnlinkedSummary: { totalRecords: 0, presentRecords: 0, totalHours: 0 } };
    
    const branchEmployees = salaryClosingEmployees?.filter(emp => emp.branchId === salaryClosingBranch && emp.status === "active") || [];
    const monthStart = `${salaryClosingMonth}-01`;
    // Compute proper last day of selected month (instead of always 31)
    const [yearNum, monthNum] = salaryClosingMonth.split("-").map(Number);
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const monthEnd = `${salaryClosingMonth}-${String(lastDay).padStart(2, "0")}`;

    const monthAttendance = salaryClosingAttendance?.filter(rec => 
      rec.branchId === salaryClosingBranch && 
      rec.attendanceDate >= monthStart && 
      rec.attendanceDate <= monthEnd
    ) || [];

    const monthSchedules = (salaryClosingSchedules || []).filter((s: any) =>
      s.branchId === salaryClosingBranch &&
      s.scheduleDate >= monthStart &&
      s.scheduleDate <= monthEnd
    );

    // Index signed (finalized) timesheet entries by employee match keys
    const signedByEmpId = new Map<number, { report: any; entries: any[] }>();
    const signedReports = (salaryClosingSignedTimesheets || []).filter((r: any) =>
      r.report && r.report.branchId === salaryClosingBranch && r.report.status === "finalized"
    );

    const employeeLookup = new Map<string, number>();
    const normalizeName = (s: any) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
    const nameLookup = new Map<string, number>();
    branchEmployees.forEach(emp => {
      employeeLookup.set(`bid:${emp.id}`, emp.id);
      employeeLookup.set(`bid:${String(emp.id)}`, emp.id);
      employeeLookup.set(`eid:${emp.id.toString()}`, emp.id);
      employeeLookup.set(`eid:branch_emp_${emp.id}`, emp.id);
      if (emp.employeeNumber) {
        employeeLookup.set(`enum:${emp.employeeNumber}`, emp.id);
        employeeLookup.set(`enum:${String(emp.employeeNumber).trim()}`, emp.id);
      }
      if ((emp as any).linkedUserId) {
        employeeLookup.set(`eid:${(emp as any).linkedUserId}`, emp.id);
      }
      if (emp.employeeName) {
        nameLookup.set(normalizeName(emp.employeeName), emp.id);
      }
    });
    
    const matchEmployee = (rec: AttendanceRecord): number | null => {
      if (rec.branchEmployeeId !== null && rec.branchEmployeeId !== undefined) {
        const k = `bid:${rec.branchEmployeeId}`;
        if (employeeLookup.has(k)) return employeeLookup.get(k)!;
      }
      if (rec.employeeId) {
        const k = `eid:${rec.employeeId}`;
        if (employeeLookup.has(k)) return employeeLookup.get(k)!;
      }
      const employeeNumber = (rec as any).employeeNumber;
      if (employeeNumber) {
        const k = `enum:${String(employeeNumber).trim()}`;
        if (employeeLookup.has(k)) return employeeLookup.get(k)!;
      }
      if (rec.employeeName) {
        const k = normalizeName(rec.employeeName);
        if (nameLookup.has(k)) return nameLookup.get(k)!;
      }
      return null;
    };

    // Now resolve signed timesheet reports → employee id, keep latest report per employee
    signedReports.forEach((r: any) => {
      const rep = r.report;
      let empId: number | null = null;
      if (rep.branchEmployeeId !== null && rep.branchEmployeeId !== undefined) {
        const k = `bid:${rep.branchEmployeeId}`;
        if (employeeLookup.has(k)) empId = employeeLookup.get(k)!;
      }
      if (empId === null && rep.employeeId) {
        const k = `eid:${rep.employeeId}`;
        if (employeeLookup.has(k)) empId = employeeLookup.get(k)!;
      }
      if (empId === null) return;
      const existing = signedByEmpId.get(empId);
      // Prefer the most recent signed report (by managerSignedAt or createdAt)
      if (!existing) {
        signedByEmpId.set(empId, r);
      } else {
        const ts = (rep.managerSignedAt || rep.updatedAt || rep.createdAt || "");
        const tsExisting = (existing.report.managerSignedAt || existing.report.updatedAt || existing.report.createdAt || "");
        if (ts > tsExisting) signedByEmpId.set(empId, r);
      }
    });

    // Match a schedule row to an employee using the same lookup map
    const matchScheduleEmployee = (s: any): number | null => {
      if (s.branchEmployeeId !== null && s.branchEmployeeId !== undefined) {
        const k = `bid:${s.branchEmployeeId}`;
        if (employeeLookup.has(k)) return employeeLookup.get(k)!;
      }
      if (s.employeeId) {
        const k = `eid:${s.employeeId}`;
        if (employeeLookup.has(k)) return employeeLookup.get(k)!;
      }
      if (s.employeeName) {
        const k = normalizeName(s.employeeName);
        if (nameLookup.has(k)) return nameLookup.get(k)!;
      }
      return null;
    };

    // Helper: compute scheduled hours for a single schedule row (HH:MM start/end minus break)
    const scheduledHoursOf = (s: any): number => {
      if (!s.startTime || !s.endTime || s.isOff) return 0;
      const [sh, sm] = String(s.startTime).split(":").map(Number);
      const [eh, em] = String(s.endTime).split(":").map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60; // overnight shift
      const breakMin = Number(s.breakDuration) || 0;
      mins = Math.max(0, mins - breakMin);
      return mins / 60;
    };
    
    const unlinkedList: AttendanceRecord[] = [];
    monthAttendance.forEach(rec => {
      if (matchEmployee(rec) === null) {
        unlinkedList.push(rec);
      }
    });
    
    const unlinkedSummary = {
      totalRecords: unlinkedList.length,
      presentRecords: unlinkedList.filter(r => r.status === "present" || r.status === "late").length,
      totalHours: unlinkedList.reduce((sum, r) => sum + (Number(r.workingHours) || 0), 0),
    };

    const data = branchEmployees.map(emp => {
      // Schedule-based metrics (planned)
      const empSchedules = monthSchedules.filter((s: any) => matchScheduleEmployee(s) === emp.id);
      const empAttendance = monthAttendance.filter(a => matchEmployee(a) === emp.id);
      const attendanceByDate = new Map<string, AttendanceRecord>();
      empAttendance.forEach(a => attendanceByDate.set(a.attendanceDate, a));

      const lateDays = empAttendance.filter(a => a.status === "late").length;

      const presentDates: string[] = [];
      const absentDatesExplicit: string[] = [];
      const absentDatesMissing: string[] = [];
      const offDates: string[] = [];

      let presentDays = 0;
      let absentDays = 0;
      let offDays = 0;
      let scheduledWorkDays = 0;
      let scheduledHoursTotal = 0;
      let totalHours = 0;
      // dataSource: "signed_timesheet" (موقّع), "schedule_attendance" (جدول+بصمة), "attendance_only" (بصمة فقط)
      let dataSource: "signed_timesheet" | "schedule_attendance" | "attendance_only" = "attendance_only";
      let signedReportInfo: { id: number; managerSignedAt: string | null; employeeSignedAt: string | null } | null = null;

      const signed = signedByEmpId.get(emp.id);

      if (signed && signed.entries.length > 0) {
        // ✅ مصدر الحقيقة: التايم شيت الموقّع من الموظف والمدير
        dataSource = "signed_timesheet";
        signedReportInfo = {
          id: signed.report.id,
          managerSignedAt: signed.report.managerSignedAt || null,
          employeeSignedAt: signed.report.employeeSignedAt || null,
        };
        const entries = signed.entries.filter((e: any) => e.date >= monthStart && e.date <= monthEnd);
        entries.forEach((e: any) => {
          if (e.isOff || e.status === "day_off") {
            offDays++;
            offDates.push(e.date);
            return;
          }
          scheduledWorkDays++;
          scheduledHoursTotal += Number(e.scheduledHours) || 0;
          if (e.status === "present" || e.status === "late") {
            presentDays++;
            presentDates.push(e.date);
            totalHours += Number(e.actualHours) || Number(e.scheduledHours) || 0;
          } else if (e.status === "absent") {
            absentDays++;
            absentDatesExplicit.push(e.date);
          } else {
            // pending or unknown — لا نحسبها (التقرير الموقّع نهائي)
          }
        });
      } else if (empSchedules.length > 0) {
        // المسار القديم: جدول + بصمة
        dataSource = "schedule_attendance";
        offDays = empSchedules.filter((s: any) => s.isOff === true).length;
        scheduledWorkDays = empSchedules.filter((s: any) => s.isOff !== true).length;
        scheduledHoursTotal = empSchedules.reduce((sum: number, s: any) => sum + scheduledHoursOf(s), 0);
        empSchedules.forEach((s: any) => { if (s.isOff) offDates.push(s.scheduleDate); });

        empSchedules.forEach((s: any) => {
          if (s.isOff) return;
          const att = attendanceByDate.get(s.scheduleDate);
          if (att && (att.status === "present" || att.status === "late")) {
            presentDays++;
            totalHours += Number(att.workingHours) || scheduledHoursOf(s);
            presentDates.push(s.scheduleDate);
          } else if (att && att.status === "absent") {
            absentDays++;
            absentDatesExplicit.push(s.scheduleDate);
          } else if (!att) {
            const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
            if (s.scheduleDate <= todayLocal) {
              absentDays++;
              absentDatesMissing.push(s.scheduleDate);
            }
          }
        });

        empAttendance.forEach(a => {
          const isScheduled = empSchedules.some((s: any) => s.scheduleDate === a.attendanceDate);
          if (!isScheduled && (a.status === "present" || a.status === "late")) {
            presentDays++;
            totalHours += Number(a.workingHours) || 0;
            presentDates.push(a.attendanceDate);
          }
        });
      } else {
        // المسار الاحتياطي: بصمة فقط (لا جدول ولا تايم شيت موقّع)
        dataSource = "attendance_only";
        presentDays = empAttendance.filter(a => a.status === "present" || a.status === "late").length;
        absentDays = empAttendance.filter(a => a.status === "absent").length;
        totalHours = empAttendance.reduce((sum, a) => sum + (Number(a.workingHours) || 0), 0);
        empAttendance.forEach(a => {
          if (a.status === "present" || a.status === "late") presentDates.push(a.attendanceDate);
          else if (a.status === "absent") absentDatesExplicit.push(a.attendanceDate);
        });
      }

      presentDates.sort();
      absentDatesExplicit.sort();
      absentDatesMissing.sort();
      offDates.sort();

      const baseSalary = emp.salary || 0;
      const allowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
      const grossSalary = baseSalary + allowances;
      const storedInsurance = emp.socialInsuranceDeduction || 0;
      const socialInsurance = emp.nationality === "سعودي" 
        ? (storedInsurance > 0 ? storedInsurance : Math.round(baseSalary * 0.0975))
        : 0;
      // خصم الغياب: قيمة اليوم = الراتب الإجمالي (شامل البدلات) ÷ 30 (نظام العمل السعودي)
      // ثم خصم الغياب = عدد أيام الغياب × قيمة اليوم
      const dailyRate = grossSalary / 30;

      // ⚠️ قاعدة مهمة: إذا الموظف ما داوم ولا يوم في الشهر (صفر حضور + صفر جدول + صفر تايم شيت موقّع)
      // فهذا يعني إما أنه لم يلتحق بالعمل، أو منقطع، أو في إجازة بدون راتب → الراتب = 0
      // ونحسب الشهر كله غياب (30 يوم) لتظهر المعادلة شفافة في التقرير.
      const noWorkAtAll = presentDays === 0 && scheduledWorkDays === 0 && offDays === 0 && empAttendance.length === 0;
      const effectiveAbsentDays = noWorkAtAll ? 30 : absentDays;
      const absenceDeduction = noWorkAtAll
        ? Math.round((grossSalary - socialInsurance) * 100) / 100  // كامل الراتب يُخصم بعد التأمينات
        : Math.round(absentDays * dailyRate * 100) / 100;

      // السُلف والخصومات اليدوية لهذا الموظف في هذا الشهر
      const empDeductions = salaryClosingDeductions.filter(d => d.branchEmployeeId === emp.id);
      const manualDeductionsTotal = Math.round(
        empDeductions.reduce((sum, d) => sum + (d.amount || 0), 0) * 100
      ) / 100;

      // الصافي بعد كل الخصومات (لا يقل عن صفر)
      const netBeforeManual = noWorkAtAll
        ? 0
        : Math.round((grossSalary - socialInsurance - absenceDeduction) * 100) / 100;
      const netSalary = Math.max(0, Math.round((netBeforeManual - manualDeductionsTotal) * 100) / 100);

      return {
        id: emp.id,
        employeeNumber: emp.employeeNumber,
        employeeName: emp.employeeName,
        jobTitle: emp.jobTitle,
        nationality: emp.nationality,
        bankName: (emp as any).bankName || "",
        bankAccountNumber: (emp as any).bankAccountNumber || "",
        presentDays,
        absentDays: effectiveAbsentDays,
        offDays,
        scheduledWorkDays,
        scheduledHours: Math.round(scheduledHoursTotal * 10) / 10,
        lateDays,
        totalHours: Math.round(totalHours * 10) / 10,
        baseSalary,
        allowances,
        grossSalary,
        dailyRate: Math.round(dailyRate * 100) / 100,
        absenceDeduction,
        socialInsurance,
        manualDeductions: empDeductions,
        manualDeductionsTotal,
        netSalary,
        dataSource,
        signedReportInfo,
        noWorkAtAll,
        presentDates,
        absentDatesExplicit,
        absentDatesMissing,
        offDates,
      };
    });
    
    return { salaryClosingData: data, salaryClosingUnlinkedCount: unlinkedList.length, salaryClosingUnlinkedRecords: unlinkedList, salaryClosingUnlinkedSummary: unlinkedSummary };
  }, [salaryClosingBranch, salaryClosingMonth, salaryClosingEmployees, salaryClosingAttendance, salaryClosingSchedules, salaryClosingSignedTimesheets, salaryClosingDeductions]);

  const exportUnlinkedRecordsToExcel = async () => {
    const XLSX = await import("xlsx");
    if (unlinkedRecords.length === 0) return;
    const data = unlinkedRecords.map((rec, index) => ({
      [isRTL ? "م" : "#"]: index + 1,
      [isRTL ? "التاريخ" : "Date"]: rec.attendanceDate,
      [isRTL ? "اسم الموظف (غير مرتبط)" : "Employee Name (Unlinked)"]: rec.employeeName,
      [isRTL ? "معرف الموظف" : "Employee ID"]: rec.employeeId || "-",
      [isRTL ? "الفرع" : "Branch"]: getBranchName(rec.branchId),
      [isRTL ? "الحالة" : "Status"]: rec.status === "present" ? (isRTL ? "حاضر" : "Present") : rec.status === "absent" ? (isRTL ? "غائب" : "Absent") : rec.status === "late" ? (isRTL ? "متأخر" : "Late") : rec.status,
      [isRTL ? "وقت الحضور" : "Check In"]: rec.actualCheckIn || "-",
      [isRTL ? "وقت الانصراف" : "Check Out"]: rec.actualCheckOut || "-",
      [isRTL ? "ساعات العمل" : "Working Hours"]: rec.workingHours || 0,
      [isRTL ? "ملاحظات" : "Notes"]: rec.notes || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRTL ? "سجلات غير مرتبطة" : "Unlinked Records");
    XLSX.writeFile(wb, `${isRTL ? "سجلات_حضور_غير_مرتبطة" : "unlinked_attendance_records"}_${selectedMonth}.xlsx`);
  };

  const exportAttendanceToExcel = async () => {
    const XLSX = await import("xlsx");
    const data = filteredEmployees.map((emp, index) => {
      const attendance = attendanceByEmployee.get(emp.id) || { present: 0, absent: 0, late: 0, total: 0 };
      const rate = attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0;
      return {
        [isRTL ? "م" : "#"]: index + 1,
        [isRTL ? "الموظف" : "Employee"]: emp.employeeName,
        [isRTL ? "الفرع" : "Branch"]: getBranchName(emp.branchId),
        [isRTL ? "الوظيفة" : "Job Title"]: emp.jobTitle,
        [isRTL ? "أيام الحضور" : "Present Days"]: attendance.present,
        [isRTL ? "أيام الغياب" : "Absent Days"]: attendance.absent,
        [isRTL ? "أيام التأخير" : "Late Days"]: attendance.late,
        [isRTL ? "نسبة الحضور" : "Attendance Rate"]: `${rate}%`,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRTL ? "تقرير الحضور" : "Attendance Report");
    XLSX.writeFile(wb, `${isRTL ? "تقرير_الحضور" : "attendance_report"}_${selectedMonth}.xlsx`);
  };

  const exportSalaryClosingToExcel = async () => {
    if (salaryClosingData.length === 0) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    
    const summaryData = [
      { [isRTL ? "البيان" : "Item"]: isRTL ? "الفرع" : "Branch", [isRTL ? "القيمة" : "Value"]: getBranchName(salaryClosingBranch) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "الشهر" : "Month", [isRTL ? "القيمة" : "Value"]: salaryClosingMonth },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "عدد الموظفين" : "Employee Count", [isRTL ? "القيمة" : "Value"]: salaryClosingData.length },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي الرواتب (شامل البدلات)" : "Total Salaries (Incl. Allowances)", [isRTL ? "القيمة" : "Value"]: salaryClosingData.reduce((sum, e) => sum + e.grossSalary, 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي خصم الغياب" : "Total Absence Deduction", [isRTL ? "القيمة" : "Value"]: salaryClosingData.reduce((sum, e) => sum + e.absenceDeduction, 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي التأمينات الاجتماعية" : "Total Social Insurance", [isRTL ? "القيمة" : "Value"]: salaryClosingData.reduce((sum, e) => sum + e.socialInsurance, 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي السُلف والخصومات اليدوية" : "Total Manual Deductions", [isRTL ? "القيمة" : "Value"]: salaryClosingData.reduce((sum, e) => sum + (e.manualDeductionsTotal || 0), 0) },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "صافي الرواتب المستحقة" : "Net Salaries Due", [isRTL ? "القيمة" : "Value"]: salaryClosingData.reduce((sum, e) => sum + e.netSalary, 0) },
      { [isRTL ? "البيان" : "Item"]: "", [isRTL ? "القيمة" : "Value"]: "" },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "سجلات حضور غير مرتبطة" : "Unlinked Attendance Records", [isRTL ? "القيمة" : "Value"]: salaryClosingUnlinkedCount },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "سجلات حضور (غير مرتبطة)" : "Present Records (Unlinked)", [isRTL ? "القيمة" : "Value"]: salaryClosingUnlinkedSummary.presentRecords },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "إجمالي ساعات غير مرتبطة" : "Total Unlinked Hours", [isRTL ? "القيمة" : "Value"]: Math.round(salaryClosingUnlinkedSummary.totalHours * 10) / 10 },
      { [isRTL ? "البيان" : "Item"]: isRTL ? "ملاحظة" : "Note", [isRTL ? "القيمة" : "Value"]: salaryClosingUnlinkedCount > 0 ? (isRTL ? "توجد سجلات حضور غير مرتبطة بموظفين - راجع ورقة السجلات غير المرتبطة للتفاصيل والمراجعة" : "Unlinked attendance records exist - see Unlinked Records sheet for details") : (isRTL ? "جميع السجلات مرتبطة بموظفين" : "All records are linked to employees") },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, isRTL ? "ملخص" : "Summary");
    
    const data = salaryClosingData.map((emp, index) => ({
      [isRTL ? "م" : "#"]: index + 1,
      [isRTL ? "رقم الموظف" : "Employee #"]: emp.employeeNumber,
      [isRTL ? "الاسم" : "Name"]: emp.employeeName,
      [isRTL ? "الوظيفة" : "Job Title"]: emp.jobTitle,
      [isRTL ? "الجنسية" : "Nationality"]: emp.nationality,
      [isRTL ? "البنك" : "Bank"]: emp.bankName || "",
      [isRTL ? "الآيبان / رقم الحساب" : "IBAN / Account #"]: emp.bankAccountNumber || "",
      [isRTL ? "السُلف والخصومات اليدوية" : "Manual Deductions"]: emp.manualDeductionsTotal || 0,
      [isRTL ? "تفاصيل السُلف/الخصومات" : "Deductions Detail"]: (emp.manualDeductions || [])
        .map((d: any) => `${SALARY_DEDUCTION_TYPE_LABELS[d.type] || d.type}: ${d.amount}${d.description ? ` (${d.description})` : ""}`)
        .join(" | "),
      [isRTL ? "مصدر البيانات" : "Data Source"]:
        emp.dataSource === "signed_timesheet"
          ? (isRTL ? "تايم شيت موقّع ✓" : "Signed Timesheet ✓")
          : emp.dataSource === "schedule_attendance"
          ? (isRTL ? "جدول + بصمة" : "Schedule + Attendance")
          : (isRTL ? "بصمة فقط" : "Attendance only"),
      [isRTL ? "أيام العمل المجدولة" : "Scheduled Work Days"]: emp.scheduledWorkDays,
      [isRTL ? "أيام الإجازة" : "Off Days"]: emp.offDays,
      [isRTL ? "ساعات الجدول" : "Scheduled Hours"]: emp.scheduledHours,
      [isRTL ? "أيام الحضور" : "Present Days"]: emp.presentDays,
      [isRTL ? "أيام الغياب" : "Absent Days"]: emp.absentDays,
      [isRTL ? "أيام التأخير" : "Late Days"]: emp.lateDays,
      [isRTL ? "إجمالي الساعات" : "Total Hours"]: emp.totalHours,
      [isRTL ? "الراتب الأساسي" : "Base Salary"]: emp.baseSalary,
      [isRTL ? "البدلات" : "Allowances"]: emp.allowances,
      [isRTL ? "إجمالي الراتب" : "Gross Salary"]: emp.grossSalary,
      [isRTL ? "قيمة اليوم" : "Daily Rate"]: emp.dailyRate,
      [isRTL ? "خصم الغياب" : "Absence Deduction"]: emp.absenceDeduction,
      [isRTL ? "التأمينات الاجتماعية" : "Social Insurance"]: emp.socialInsurance,
      [isRTL ? "صافي الراتب" : "Net Salary"]: emp.netSalary,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, isRTL ? "تفاصيل الرواتب" : "Salary Details");
    
    if (salaryClosingUnlinkedRecords.length > 0) {
      const unlinkedData = salaryClosingUnlinkedRecords.map((rec, index) => ({
        [isRTL ? "م" : "#"]: index + 1,
        [isRTL ? "التاريخ" : "Date"]: rec.attendanceDate,
        [isRTL ? "اسم الموظف (غير مرتبط)" : "Employee Name (Unlinked)"]: rec.employeeName,
        [isRTL ? "معرف الموظف" : "Employee ID"]: rec.employeeId || "-",
        [isRTL ? "الحالة" : "Status"]: rec.status === "present" ? (isRTL ? "حاضر" : "Present") : rec.status === "absent" ? (isRTL ? "غائب" : "Absent") : rec.status === "late" ? (isRTL ? "متأخر" : "Late") : rec.status,
        [isRTL ? "وقت الحضور" : "Check In"]: rec.actualCheckIn || "-",
        [isRTL ? "وقت الانصراف" : "Check Out"]: rec.actualCheckOut || "-",
        [isRTL ? "ساعات العمل" : "Working Hours"]: rec.workingHours || 0,
        [isRTL ? "ملاحظات" : "Notes"]: rec.notes || "-",
      }));
      const wsUnlinked = XLSX.utils.json_to_sheet(unlinkedData);
      XLSX.utils.book_append_sheet(wb, wsUnlinked, isRTL ? "سجلات غير مرتبطة" : "Unlinked Records");
    }
    
    XLSX.writeFile(wb, `${isRTL ? "إغلاق_الرواتب" : "salary_closing"}_${getBranchName(salaryClosingBranch)}_${salaryClosingMonth}.xlsx`);
  };

  const exportSalaryClosingToPDF = async () => {
    console.log("PDF export button clicked, data length:", salaryClosingData.length);
    if (salaryClosingData.length === 0) {
      console.log("No data to export");
      alert(isRTL ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }
    
    try {
      const requestData = {
        branchName: getBranchName(salaryClosingBranch),
        month: salaryClosingMonth,
        employees: salaryClosingData.map(emp => ({
          employeeName: emp.employeeName,
          jobTitle: emp.jobTitle,
          bankName: emp.bankName,
          bankAccountNumber: emp.bankAccountNumber,
          scheduledWorkDays: emp.scheduledWorkDays,
          offDays: emp.offDays,
          presentDays: emp.presentDays,
          absentDays: emp.absentDays,
          totalHours: emp.totalHours,
          baseSalary: emp.baseSalary,
          allowances: emp.allowances,
          dailyRate: emp.dailyRate,
          absenceDeduction: emp.absenceDeduction,
          socialInsurance: emp.socialInsurance,
          manualDeductions: (emp.manualDeductions || []).map((d: any) => ({
            type: SALARY_DEDUCTION_TYPE_LABELS[d.type] || d.type,
            amount: d.amount,
            description: d.description,
          })),
          manualDeductionsTotal: emp.manualDeductionsTotal || 0,
          netSalary: emp.netSalary,
          dataSource: emp.dataSource,
        })),
        dataSourceSummary: {
          signed: salaryClosingData.filter(e => e.dataSource === "signed_timesheet").length,
          schedule: salaryClosingData.filter(e => e.dataSource === "schedule_attendance").length,
          attendanceOnly: salaryClosingData.filter(e => e.dataSource === "attendance_only").length,
        },
      };

      const response = await fetch("/api/pdf/salary-closing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(isRTL ? "فشل في إنشاء ملف PDF" : "Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isRTL ? "إغلاق_الرواتب" : "salary_closing"}_${getBranchName(salaryClosingBranch)}_${salaryClosingMonth}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log("PDF download completed");
    } catch (error) {
      console.error("Error in exportSalaryClosingToPDF:", error);
      alert((isRTL ? "خطأ في تصدير PDF: " : "PDF export error: ") + (error as Error).message);
    }
  };

  // ==================== NEW EXPORT FUNCTIONS ====================

  const exportBranchComparisonToExcel = async () => {
    const XLSX = await import("xlsx");
    if (branchComparisonData.length === 0) return;
    const data = branchComparisonData.map((branch, index) => ({
      [isRTL ? "م" : "#"]: index + 1,
      [isRTL ? "الفرع" : "Branch"]: branch.branchName,
      [isRTL ? "عدد الموظفين" : "Employees"]: branch.employeeCount,
      [isRTL ? "السعوديين" : "Saudis"]: branch.saudiCount,
      [isRTL ? "نسبة السعودة %" : "Saudization %"]: branch.saudiPercentage,
      [isRTL ? "إجمالي الرواتب" : "Total Salary"]: branch.totalSalary,
      [isRTL ? "متوسط الراتب" : "Avg Salary"]: branch.avgSalary,
      [isRTL ? "التأمينات" : "Insurance"]: branch.totalInsurance,
      [isRTL ? "البدلات" : "Allowances"]: branch.totalAllowances,
      [isRTL ? "نسبة الحضور %" : "Attendance %"]: branch.attendanceRate,
      [isRTL ? "نسبة الغياب %" : "Absence %"]: branch.absentRate,
      [isRTL ? "أيام الحضور" : "Present Days"]: branch.presentCount,
      [isRTL ? "أيام الغياب" : "Absent Days"]: branch.absentCount,
      [isRTL ? "أيام التأخير" : "Late Days"]: branch.lateCount,
      [isRTL ? "إجمالي الساعات" : "Total Hours"]: branch.totalHours,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRTL ? "مقارنة الفروع" : "Branch Comparison");
    XLSX.writeFile(wb, `${isRTL ? "مقارنة_الفروع" : "branch_comparison"}_${selectedMonth}.xlsx`);
  };

  const exportBranchComparisonToPDF = async () => {
    if (branchComparisonData.length === 0) return;
    try {
      const response = await fetch("/api/pdf/branch-comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          month: selectedMonth,
          branches: branchComparisonData.map((b) => ({
            branchName: b.branchName,
            employeeCount: b.employeeCount,
            saudiPercentage: b.saudiPercentage,
            totalSalary: b.totalSalary,
            attendanceRate: b.attendanceRate,
            totalHours: b.totalHours,
          })),
        }),
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isRTL ? "مقارنة_الفروع" : "branch_comparison"}_${selectedMonth}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting branch comparison PDF:", error);
      toast({
        title: isRTL ? "فشل تصدير PDF لمقارنة الفروع" : "Failed to export branch comparison PDF",
        description: (error as Error)?.message,
        variant: "destructive",
      });
    }
  };

  const exportJobComparisonToExcel = async () => {
    const XLSX = await import("xlsx");
    if (jobComparisonData.length === 0) return;
    const data: any[] = [];
    jobComparisonData.forEach((job, jobIndex) => {
      job.branches.forEach((branch, branchIndex) => {
        data.push({
          [isRTL ? "م" : "#"]: branchIndex === 0 ? jobIndex + 1 : "",
          [isRTL ? "المسمى الوظيفي" : "Job Title"]: branchIndex === 0 ? job.jobTitle : "",
          [isRTL ? "الفرع" : "Branch"]: branch.branchName,
          [isRTL ? "العدد" : "Count"]: branch.count,
          [isRTL ? "متوسط الراتب" : "Avg Salary"]: branch.avgSalary,
          [isRTL ? "أدنى راتب" : "Min Salary"]: branch.minSalary,
          [isRTL ? "أعلى راتب" : "Max Salary"]: branch.maxSalary,
          [isRTL ? "نسبة الحضور %" : "Attendance %"]: branch.attendanceRate,
          [isRTL ? "الفرق عن المتوسط" : "Diff from Avg"]: branch.avgSalary - job.avgSalary,
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRTL ? "مقارنة الوظائف" : "Job Comparison");
    XLSX.writeFile(wb, `${isRTL ? "مقارنة_الوظائف" : "job_comparison"}_${selectedMonth}.xlsx`);
  };

  const exportJobComparisonToPDF = async () => {
    if (jobComparisonData.length === 0) return;
    try {
      const response = await fetch("/api/pdf/job-comparison", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          month: selectedMonth,
          jobs: jobComparisonData.map((job) => ({
            jobTitle: job.jobTitle,
            avgSalary: job.avgSalary,
            branches: job.branches.map((b) => ({
              branchName: b.branchName,
              count: b.count,
              avgSalary: b.avgSalary,
            })),
          })),
        }),
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isRTL ? "مقارنة_الوظائف" : "job_comparison"}_${selectedMonth}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting job comparison PDF:", error);
      toast({
        title: isRTL ? "فشل تصدير PDF لمقارنة الوظائف" : "Failed to export job comparison PDF",
        description: (error as Error)?.message,
        variant: "destructive",
      });
    }
  };

  const exportSalariesTableToExcel = async () => {
    const XLSX = await import("xlsx");
    if (filteredEmployees.length === 0) return;
    const data = filteredEmployees.map((emp, index) => {
      const allowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
      const storedIns = emp.socialInsuranceDeduction || 0;
      const insurance = emp.nationality === "سعودي" ? (storedIns > 0 ? storedIns : Math.round((emp.salary || 0) * 0.0975)) : 0;
      return {
        [isRTL ? "م" : "#"]: index + 1,
        [isRTL ? "الموظف" : "Employee"]: emp.employeeName,
        [isRTL ? "رقم الموظف" : "Employee #"]: emp.employeeNumber,
        [isRTL ? "الفرع" : "Branch"]: getBranchName(emp.branchId),
        [isRTL ? "الوظيفة" : "Job Title"]: emp.jobTitle,
        [isRTL ? "الجنسية" : "Nationality"]: emp.nationality,
        [isRTL ? "الراتب الأساسي" : "Base Salary"]: emp.salary || 0,
        [isRTL ? "البدلات" : "Allowances"]: allowances,
        [isRTL ? "إجمالي الراتب" : "Total Salary"]: emp.totalSalary || emp.salary || 0,
        [isRTL ? "التأمينات" : "Insurance"]: insurance,
        [isRTL ? "صافي الراتب" : "Net Salary"]: (emp.totalSalary || emp.salary || 0) - insurance,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isRTL ? "جدول الرواتب" : "Salary Table");
    XLSX.writeFile(wb, `${isRTL ? "جدول_الرواتب_التفصيلي" : "detailed_salary_table"}_${selectedMonth}.xlsx`);
  };

  const exportSalariesTableToPDF = async () => {
    if (filteredEmployees.length === 0) return;
    try {
      const employees = filteredEmployees.map((emp) => {
        const allowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
        const storedIns = emp.socialInsuranceDeduction || 0;
        const insurance = emp.nationality === "سعودي" ? (storedIns > 0 ? storedIns : Math.round((emp.salary || 0) * 0.0975)) : 0;
        const netSalary = (emp.totalSalary || emp.salary || 0) - insurance;
        return {
          employeeName: emp.employeeName,
          jobTitle: emp.jobTitle,
          salary: emp.salary || 0,
          allowances,
          insurance,
          netSalary,
        };
      });
      const response = await fetch("/api/pdf/salaries-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ month: selectedMonth, employees }),
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isRTL ? "جدول_الرواتب" : "salary_table"}_${selectedMonth}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting salaries table PDF:", error);
      toast({
        title: isRTL ? "فشل تصدير PDF لجدول الرواتب" : "Failed to export salaries PDF",
        description: (error as Error)?.message,
        variant: "destructive",
      });
    }
  };

  const exportAnalyticsToExcel = async () => {
    if (filteredEmployees.length === 0) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    
    const empData = filteredEmployees.map((emp, index) => {
      const allowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
      const storedIns = emp.socialInsuranceDeduction || 0;
      const insurance = emp.nationality === "سعودي" ? (storedIns > 0 ? storedIns : Math.round((emp.salary || 0) * 0.0975)) : 0;
      return {
        [isRTL ? "م" : "#"]: index + 1,
        [isRTL ? "الموظف" : "Employee"]: emp.employeeName,
        [isRTL ? "الفرع" : "Branch"]: getBranchName(emp.branchId),
        [isRTL ? "الوظيفة" : "Job Title"]: emp.jobTitle,
        [isRTL ? "الجنسية" : "Nationality"]: emp.nationality,
        [isRTL ? "الراتب الأساسي" : "Base Salary"]: emp.salary || 0,
        [isRTL ? "البدلات" : "Allowances"]: allowances,
        [isRTL ? "التأمينات" : "Insurance"]: insurance,
      };
    });
    const wsEmp = XLSX.utils.json_to_sheet(empData);
    XLSX.utils.book_append_sheet(wb, wsEmp, isRTL ? "بيانات الموظفين" : "Employee Data");
    
    const branchDistData = branchComparisonData.map((b: { branchName: string; employeeCount: number }) => ({
      [isRTL ? "الفرع" : "Branch"]: b.branchName,
      [isRTL ? "عدد الموظفين" : "Employee Count"]: b.employeeCount,
    }));
    const wsBranch = XLSX.utils.json_to_sheet(branchDistData);
    XLSX.utils.book_append_sheet(wb, wsBranch, isRTL ? "توزيع الفروع" : "Branch Distribution");
    
    const jobData = jobTitleChartData.map(j => ({
      [isRTL ? "الوظيفة" : "Job Title"]: j.name,
      [isRTL ? "العدد" : "Count"]: j.value,
    }));
    const wsJob = XLSX.utils.json_to_sheet(jobData);
    XLSX.utils.book_append_sheet(wb, wsJob, isRTL ? "توزيع الوظائف" : "Job Distribution");
    
    XLSX.writeFile(wb, `${isRTL ? "تحليلات_الموظفين" : "employee_analytics"}_${selectedMonth}.xlsx`);
  };

  const exportKPIsToExcel = async () => {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    
    const kpiData = [
      { [isRTL ? "المؤشر" : "Indicator"]: isRTL ? "إجمالي الموظفين" : "Total Employees", [isRTL ? "القيمة" : "Value"]: overviewStats.totalEmployees },
      { [isRTL ? "المؤشر" : "Indicator"]: isRTL ? "الموظفين النشطين" : "Active Employees", [isRTL ? "القيمة" : "Value"]: filteredEmployees.filter(e => e.status === "active").length },
      { [isRTL ? "المؤشر" : "Indicator"]: isRTL ? "نسبة الحضور" : "Attendance Rate", [isRTL ? "القيمة" : "Value"]: `${overviewStats.attendanceRate}%` },
      { [isRTL ? "المؤشر" : "Indicator"]: isRTL ? "أيام الحضور" : "Present Days", [isRTL ? "القيمة" : "Value"]: overviewStats.presentCount },
      { [isRTL ? "المؤشر" : "Indicator"]: isRTL ? "أيام الغياب" : "Absent Days", [isRTL ? "القيمة" : "Value"]: overviewStats.absentCount },
      { [isRTL ? "المؤشر" : "Indicator"]: isRTL ? "إجمالي الرواتب" : "Total Salaries", [isRTL ? "القيمة" : "Value"]: overviewStats.totalSalaries },
      { [isRTL ? "المؤشر" : "Indicator"]: isRTL ? "متوسط الراتب" : "Avg Salary", [isRTL ? "القيمة" : "Value"]: overviewStats.totalEmployees > 0 ? Math.round(overviewStats.totalSalaries / overviewStats.totalEmployees) : 0 },
      { [isRTL ? "المؤشر" : "Indicator"]: isRTL ? "عدد السعوديين" : "Saudi Count", [isRTL ? "القيمة" : "Value"]: overviewStats.saudiEmployees },
      { [isRTL ? "المؤشر" : "Indicator"]: isRTL ? "نسبة السعودة" : "Saudization Rate", [isRTL ? "القيمة" : "Value"]: `${overviewStats.totalEmployees > 0 ? Math.round((overviewStats.saudiEmployees / overviewStats.totalEmployees) * 100) : 0}%` },
      { [isRTL ? "المؤشر" : "Indicator"]: isRTL ? "إجمالي التأمينات" : "Total Insurance", [isRTL ? "القيمة" : "Value"]: overviewStats.totalInsurance },
    ];
    const wsKPI = XLSX.utils.json_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, wsKPI, isRTL ? "المؤشرات الرئيسية" : "Key Indicators");
    
    const topData = topEmployeesBySalary.map((emp, index) => ({
      [isRTL ? "م" : "#"]: index + 1,
      [isRTL ? "الموظف" : "Employee"]: emp.employeeName,
      [isRTL ? "الفرع" : "Branch"]: getBranchName(emp.branchId),
      [isRTL ? "الوظيفة" : "Job Title"]: emp.jobTitle,
      [isRTL ? "الراتب" : "Salary"]: emp.totalSalary || emp.salary,
    }));
    const wsTop = XLSX.utils.json_to_sheet(topData);
    XLSX.utils.book_append_sheet(wb, wsTop, isRTL ? "أعلى الرواتب" : "Top Salaries");
    
    const allowData = allowancesBreakdown.map(a => ({
      [isRTL ? "البدل" : "Allowance"]: a.name,
      [isRTL ? "القيمة" : "Value"]: a.value,
    }));
    const wsAllow = XLSX.utils.json_to_sheet(allowData);
    XLSX.utils.book_append_sheet(wb, wsAllow, isRTL ? "البدلات" : "Allowances");
    
    const branchSummary = branchComparisonData.map((b, index) => ({
      [isRTL ? "م" : "#"]: index + 1,
      [isRTL ? "الفرع" : "Branch"]: b.branchName,
      [isRTL ? "الموظفين" : "Employees"]: b.employeeCount,
      [isRTL ? "الرواتب" : "Salaries"]: b.totalSalary,
      [isRTL ? "نسبة الحضور" : "Attendance %"]: `${b.attendanceRate}%`,
    }));
    const wsBranch = XLSX.utils.json_to_sheet(branchSummary);
    XLSX.utils.book_append_sheet(wb, wsBranch, isRTL ? "ملخص الفروع" : "Branch Summary");
    
    XLSX.writeFile(wb, `${isRTL ? "مؤشرات_الأداء" : "kpi_report"}_${selectedMonth}.xlsx`);
  };

  const exportKPIsToPDF = async () => {
    try {
      const saudiPercentage = overviewStats.totalEmployees > 0 ? Math.round((overviewStats.saudiEmployees / overviewStats.totalEmployees) * 100) : 0;
      const response = await fetch("/api/pdf/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          month: selectedMonth,
          totalEmployees: overviewStats.totalEmployees,
          attendanceRate: overviewStats.attendanceRate,
          totalSalaries: overviewStats.totalSalaries,
          saudiPercentage,
          totalInsurance: overviewStats.totalInsurance,
          topEmployees: topEmployeesBySalary.map((emp) => ({
            employeeName: emp.employeeName,
            jobTitle: emp.jobTitle,
            salary: emp.totalSalary || emp.salary,
          })),
        }),
      });
      if (!response.ok) throw new Error("Failed to generate PDF");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isRTL ? "مؤشرات_الأداء" : "kpi_report"}_${selectedMonth}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting KPIs PDF:", error);
      toast({
        title: isRTL ? "فشل تصدير PDF للمؤشرات" : "Failed to export KPIs PDF",
        description: (error as Error)?.message,
        variant: "destructive",
      });
    }
  };

  // ==================== ENHANCED KPI METRICS ====================

  // 1. مؤشرات الأداء المقارنة - اتجاه الرواتب على مدار 6 أشهر
  const salaryTrends = useMemo(() => {
    const trends = [];
    const baseDate = new Date(selectedMonth + "-01");
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(baseDate);
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7);
      const monthName = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      
      const monthEmployees = employees?.filter(emp => {
        if (selectedBranch !== "all" && emp.branchId !== selectedBranch) return false;
        if (selectedJobTitle !== "all" && emp.jobTitle !== selectedJobTitle) return false;
        if (selectedEmployee !== "all" && emp.id.toString() !== selectedEmployee) return false;
        const hireDate = emp.hireDate ? new Date(emp.hireDate) : null;
        if (hireDate && hireDate > date) return false;
        return true;
      }) || [];
      
      const totalSalary = monthEmployees.reduce((sum, emp) => sum + (emp.totalSalary || emp.salary || 0), 0);
      const avgSalary = monthEmployees.length > 0 ? Math.round(totalSalary / monthEmployees.length) : 0;
      
      trends.push({
        month: monthName,
        monthKey,
        totalSalary,
        avgSalary,
        employeeCount: monthEmployees.length,
      });
    }
    return trends;
  }, [employees, selectedMonth, selectedBranch, selectedJobTitle, selectedEmployee]);

  // 2. مؤشرات الإنتاجية
  const productivityMetrics = useMemo(() => {
    const totalSalary = overviewStats.totalSalaries;
    const employeeCount = overviewStats.totalEmployees;
    const attendanceData = (selectedJobTitle !== "all" || selectedEmployee !== "all") 
      ? filteredAttendance 
      : allBranchMonthAttendance;
    const totalHours = attendanceData.reduce((sum, r) => sum + (Number(r.workingHours) || 0), 0);
    
    const avgCostPerEmployee = employeeCount > 0 ? Math.round(totalSalary / employeeCount) : 0;
    const avgHoursPerEmployee = employeeCount > 0 ? Math.round((totalHours / employeeCount) * 10) / 10 : 0;
    const costPerHour = totalHours > 0 ? Math.round(totalSalary / totalHours) : 0;
    
    const branchProductivity = branchComparisonData.map(branch => ({
      branchName: branch.branchName,
      avgCost: branch.avgSalary,
      totalHours: branch.totalHours,
      costPerHour: branch.totalHours > 0 ? Math.round(branch.totalSalary / branch.totalHours) : 0,
      attendanceRate: branch.attendanceRate,
    }));
    
    return {
      avgCostPerEmployee,
      avgHoursPerEmployee,
      costPerHour,
      totalWorkingHours: Math.round(totalHours),
      branchProductivity,
    };
  }, [overviewStats, allBranchMonthAttendance, filteredAttendance, branchComparisonData, selectedJobTitle, selectedEmployee]);

  // 3. مؤشرات الدوران الوظيفي
  const turnoverMetrics = useMemo(() => {
    const currentDate = new Date(selectedMonth + "-01");
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = `${selectedMonth}-31`;
    const oneMonthAgo = new Date(currentDate);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const newEmployees = filteredEmployees.filter(emp => {
      if (!emp.hireDate) return false;
      return emp.hireDate >= monthStart && emp.hireDate <= monthEnd;
    });
    
    const terminatedEmployees = filteredEmployees.filter(emp => {
      return emp.status === "terminated" || emp.status === "resigned";
    });
    
    const activeEmployees = filteredEmployees.filter(emp => emp.status === "active");
    const totalEmployees = filteredEmployees.length;
    const stabilityRate = totalEmployees > 0 
      ? Math.round((activeEmployees.length / totalEmployees) * 100) 
      : 0;
    
    const turnoverRate = totalEmployees > 0 
      ? Math.round((terminatedEmployees.length / totalEmployees) * 100) 
      : 0;
    
    const avgTenure = activeEmployees.length > 0
      ? Math.round(activeEmployees.reduce((sum, emp) => {
          if (!emp.hireDate) return sum;
          const hireDate = new Date(emp.hireDate);
          const months = (currentDate.getFullYear() - hireDate.getFullYear()) * 12 + 
                        (currentDate.getMonth() - hireDate.getMonth());
          return sum + Math.max(0, months);
        }, 0) / activeEmployees.length)
      : 0;
    
    return {
      newEmployees: newEmployees.length,
      newEmployeesList: newEmployees.slice(0, 5),
      terminatedEmployees: terminatedEmployees.length,
      terminatedList: terminatedEmployees.slice(0, 5),
      activeEmployees: activeEmployees.length,
      stabilityRate,
      turnoverRate,
      avgTenureMonths: avgTenure,
    };
  }, [filteredEmployees, selectedMonth]);

  // 4. مؤشرات التكاليف
  const costAnalysis = useMemo(() => {
    const baseSalaries = filteredEmployees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
    const totalAllowances = filteredEmployees.reduce((sum, emp) => 
      sum + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + 
      (emp.foodAllowance || 0) + (emp.otherAllowances || 0), 0);
    const totalInsurance = overviewStats.totalInsurance;
    const totalCost = overviewStats.totalSalaries;
    
    const allowancePercentage = totalCost > 0 ? Math.round((totalAllowances / totalCost) * 100) : 0;
    const insurancePercentage = totalCost > 0 ? Math.round((totalInsurance / totalCost) * 100) : 0;
    
    const attendanceData = (selectedJobTitle !== "all" || selectedEmployee !== "all") 
      ? filteredAttendance 
      : allBranchMonthAttendance;
    const totalOvertimeHours = attendanceData.reduce((sum, r) => {
      const hours = Number(r.workingHours) || 0;
      return sum + Math.max(0, hours - 8);
    }, 0);
    const overtimeCost = Math.round(totalOvertimeHours * 50);
    
    const costByJobTitle = new Map<string, { count: number; totalCost: number }>();
    filteredEmployees.forEach(emp => {
      const current = costByJobTitle.get(emp.jobTitle) || { count: 0, totalCost: 0 };
      current.count++;
      current.totalCost += (emp.totalSalary || emp.salary || 0);
      costByJobTitle.set(emp.jobTitle, current);
    });
    
    const costDistribution = Array.from(costByJobTitle.entries())
      .map(([jobTitle, data]) => ({
        jobTitle,
        count: data.count,
        totalCost: data.totalCost,
        avgCost: Math.round(data.totalCost / data.count),
        percentage: totalCost > 0 ? Math.round((data.totalCost / totalCost) * 100) : 0,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);
    
    return {
      baseSalaries,
      totalAllowances,
      totalInsurance,
      totalCost,
      allowancePercentage,
      insurancePercentage,
      overtimeHours: Math.round(totalOvertimeHours),
      overtimeCost,
      costDistribution,
    };
  }, [filteredEmployees, overviewStats, allBranchMonthAttendance, filteredAttendance, selectedJobTitle, selectedEmployee]);

  // 5. تنبيهات ذكية
  const smartAlerts = useMemo(() => {
    const alerts: { type: "warning" | "danger" | "info"; title: string; message: string; count: number }[] = [];
    
    const highSalaryThreshold = 30000;
    const highSalaryEmployees = filteredEmployees.filter(emp => (emp.totalSalary || emp.salary || 0) > highSalaryThreshold);
    if (highSalaryEmployees.length > 0) {
      alerts.push({
        type: "warning",
        title: "موظفين برواتب مرتفعة",
        message: `${highSalaryEmployees.length} موظف براتب أعلى من ${formatNumber(highSalaryThreshold)} ريال`,
        count: highSalaryEmployees.length,
      });
    }
    
    const lowAttendanceBranches = branchComparisonData.filter(b => b.attendanceRate < 70);
    if (lowAttendanceBranches.length > 0) {
      alerts.push({
        type: "danger",
        title: "فروع بنسبة حضور منخفضة",
        message: `${lowAttendanceBranches.length} فرع بنسبة حضور أقل من 70%: ${lowAttendanceBranches.map(b => b.branchName).join(", ")}`,
        count: lowAttendanceBranches.length,
      });
    }
    
    const noAttendanceEmployees = filteredEmployees.filter(emp => {
      const attendance = attendanceByEmployee.get(emp.id);
      return !attendance || attendance.total === 0;
    });
    if (noAttendanceEmployees.length > 0) {
      alerts.push({
        type: "danger",
        title: "موظفين بدون سجل حضور",
        message: `${noAttendanceEmployees.length} موظف ليس لديهم أي سجل حضور هذا الشهر`,
        count: noAttendanceEmployees.length,
      });
    }
    
    const expiredIqama = filteredEmployees.filter(emp => {
      if (!emp.iqamaExpiry || emp.nationality === "سعودي") return false;
      return new Date(emp.iqamaExpiry) < new Date();
    });
    if (expiredIqama.length > 0) {
      alerts.push({
        type: "danger",
        title: "إقامات منتهية",
        message: `${expiredIqama.length} موظف إقامتهم منتهية الصلاحية`,
        count: expiredIqama.length,
      });
    }
    
    const lowSaudization = branchComparisonData.filter(b => b.saudiPercentage < 15);
    if (lowSaudization.length > 0) {
      alerts.push({
        type: "warning",
        title: "فروع بنسبة سعودة منخفضة",
        message: `${lowSaudization.length} فرع بنسبة سعودة أقل من 15%`,
        count: lowSaudization.length,
      });
    }
    
    return alerts;
  }, [filteredEmployees, branchComparisonData, attendanceByEmployee]);

  // 6. توزيع الموظفين حسب سنوات الخبرة
  const experienceDistribution = useMemo(() => {
    const currentDate = new Date(selectedMonth + "-01");
    const distribution = { "0-1 سنة": 0, "1-3 سنوات": 0, "3-5 سنوات": 0, "5-10 سنوات": 0, "+10 سنوات": 0 };
    
    filteredEmployees.forEach(emp => {
      if (!emp.hireDate) {
        distribution["0-1 سنة"]++;
        return;
      }
      const hireDate = new Date(emp.hireDate);
      const years = (currentDate.getFullYear() - hireDate.getFullYear());
      
      if (years < 1) distribution["0-1 سنة"]++;
      else if (years < 3) distribution["1-3 سنوات"]++;
      else if (years < 5) distribution["3-5 سنوات"]++;
      else if (years < 10) distribution["5-10 سنوات"]++;
      else distribution["+10 سنوات"]++;
    });
    
    return Object.entries(distribution).map(([name, value]) => ({ name, value }));
  }, [filteredEmployees, selectedMonth]);

  // ==================== NEW ANALYTICS DATA ====================

  const nationalityDistribution = useMemo(() => {
    const map = new Map<string, number>();
    filteredEmployees.forEach(emp => {
      const nat = emp.nationality || "غير محدد";
      map.set(nat, (map.get(nat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredEmployees]);

  const lateAnalysis = useMemo(() => {
    const lateMap = new Map<number, { name: string; branch: string; lateDays: number; lateMinutes: number }>();
    filteredEmployees.forEach(emp => {
      const attendance = attendanceByEmployee.get(emp.id);
      if (attendance && attendance.late > 0) {
        lateMap.set(emp.id, {
          name: emp.employeeName,
          branch: getBranchName(emp.branchId),
          lateDays: attendance.late,
          lateMinutes: 0,
        });
      }
    });
    return Array.from(lateMap.values()).sort((a, b) => b.lateDays - a.lateDays).slice(0, 10);
  }, [filteredEmployees, attendanceByEmployee]);

  const overtimeAnalysis = useMemo(() => {
    if (!attendanceRecords || !branches) return [];
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = `${selectedMonth}-31`;
    
    return branches.map(branch => {
      const branchAttendance = attendanceRecords.filter(rec => 
        rec.branchId === branch.id && 
        rec.attendanceDate >= monthStart && 
        rec.attendanceDate <= monthEnd
      );
      const totalHours = branchAttendance.reduce((sum, r) => sum + (Number(r.workingHours) || 0), 0);
      const standardHours = branchAttendance.length * 8;
      const overtime = Math.max(0, totalHours - standardHours);
      return {
        branchName: branch.name,
        totalHours: Math.round(totalHours),
        standardHours,
        overtime: Math.round(overtime),
      };
    }).filter(b => b.totalHours > 0);
  }, [attendanceRecords, branches, selectedMonth]);

  const branchPerformanceRanking = useMemo(() => {
    return branchComparisonData.map(branch => {
      const saudiScore = branch.saudiPercentage >= 30 ? 25 : Math.round((branch.saudiPercentage / 30) * 25);
      const attendanceScore = branch.attendanceRate >= 80 ? 25 : Math.round((branch.attendanceRate / 80) * 25);
      const productivityScore = branch.totalHours > 0 ? Math.min(25, Math.round((branch.totalHours / (branch.employeeCount * 200)) * 25)) : 0;
      const efficiencyScore = 25;
      const totalScore = saudiScore + attendanceScore + productivityScore + efficiencyScore;
      return {
        ...branch,
        saudiScore,
        attendanceScore,
        productivityScore,
        efficiencyScore,
        totalScore,
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }, [branchComparisonData]);

  // ==================== DATA QUALITY METRICS ====================
  const dataQualityMetrics = useMemo(() => {
    const today = new Date();
    const monthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const workingDays = Math.floor(monthDays * (5/7));
    
    const employeesWithMissingAttendance: { emp: BranchEmployee; missingDays: number; percentage: number }[] = [];
    const employeesWithMissingSalary: BranchEmployee[] = [];
    const employeesWithAnomalies: { emp: BranchEmployee; issue: string; severity: "high" | "medium" | "low" }[] = [];
    
    filteredEmployees.forEach(emp => {
      const attendance = attendanceByEmployee.get(emp.id);
      const recordedDays = attendance?.total || 0;
      const missingDays = Math.max(0, workingDays - recordedDays);
      
      if (missingDays > 5) {
        const percentage = Math.round((missingDays / workingDays) * 100);
        employeesWithMissingAttendance.push({ emp, missingDays, percentage });
      }
      
      if (!emp.salary || emp.salary <= 0) {
        employeesWithMissingSalary.push(emp);
      }
      
      if (emp.salary && emp.salary < 1500) {
        employeesWithAnomalies.push({ emp, issue: "راتب أقل من الحد الأدنى (1500)", severity: "high" });
      }
      if (emp.salary && emp.salary > 50000) {
        employeesWithAnomalies.push({ emp, issue: "راتب مرتفع جداً (> 50,000)", severity: "medium" });
      }
      if (!emp.nationality) {
        employeesWithAnomalies.push({ emp, issue: "الجنسية غير محددة", severity: "medium" });
      }
      if (!emp.jobTitle) {
        employeesWithAnomalies.push({ emp, issue: "المسمى الوظيفي غير محدد", severity: "low" });
      }
      if (emp.nationality !== "سعودي" && !emp.iqamaNumber) {
        employeesWithAnomalies.push({ emp, issue: "رقم الإقامة غير مسجل", severity: "high" });
      }
    });
    
    const totalIssues = employeesWithMissingAttendance.length + employeesWithMissingSalary.length + employeesWithAnomalies.length;
    const qualityScore = Math.max(0, 100 - Math.round((totalIssues / Math.max(1, filteredEmployees.length)) * 100));
    
    return {
      employeesWithMissingAttendance: employeesWithMissingAttendance.sort((a, b) => b.missingDays - a.missingDays),
      employeesWithMissingSalary,
      employeesWithAnomalies,
      qualityScore,
      totalIssues,
    };
  }, [filteredEmployees, attendanceByEmployee]);

  // ==================== NORMALIZATION FUNCTIONS ====================
  // توحيد أسماء الجنسيات المتشابهة
  const normalizeNationality = (nationality: string | null | undefined): string => {
    if (!nationality) return "غير محدد";
    const nat = nationality.trim().toLowerCase();
    // توحيد الجنسيات المتشابهة
    if (nat.includes("بنجلاديش") || nat.includes("بنغلاديش") || nat === "بنجلاديشي" || nat === "بنغلاديشي" || nat === "bangladesh" || nat === "bangladeshi") {
      return "بنجلاديش";
    }
    if (nat.includes("مصر") || nat === "مصري" || nat === "egypt" || nat === "egyptian") {
      return "مصري";
    }
    if (nat.includes("سعود") || nat === "saudi" || nat === "saudi arabian" || nat === "ksa") {
      return "سعودي";
    }
    if (nat.includes("هند") || nat === "هندي" || nat === "india" || nat === "indian") {
      return "هندي";
    }
    if (nat.includes("باكستان") || nat === "باكستاني" || nat === "pakistan" || nat === "pakistani") {
      return "باكستاني";
    }
    if (nat.includes("فلبين") || nat === "فلبيني" || nat === "philippines" || nat === "filipino") {
      return "فلبيني";
    }
    if (nat.includes("سودان") || nat === "سوداني" || nat === "sudan" || nat === "sudanese") {
      return "سوداني";
    }
    if (nat.includes("يمن") || nat === "يمني" || nat === "yemen" || nat === "yemeni") {
      return "يمني";
    }
    if (nat.includes("سريلانكا") || nat === "سريلانكي" || nat === "sri lanka" || nat === "sri lankan") {
      return "سريلانكي";
    }
    if (nat.includes("نيبال") || nat === "نيبالي" || nat === "nepal" || nat === "nepali" || nat === "nepalese") {
      return "نيبالي";
    }
    if (nat.includes("تونس") || nat === "تونسي" || nat === "tunisia" || nat === "tunisian") {
      return "تونسي";
    }
    if (nat.includes("اردن") || nat.includes("أردن") || nat === "اردني" || nat === "أردني" || nat === "jordan" || nat === "jordanian") {
      return "أردني";
    }
    if (nat.includes("سوري") || nat.includes("سوريا") || nat === "syria" || nat === "syrian") {
      return "سوري";
    }
    return nationality.trim();
  };

  // توحيد أسماء الوظائف المتشابهة
  const normalizeJobTitle = (jobTitle: string | null | undefined): string => {
    if (!jobTitle) return "غير محدد";
    const job = jobTitle.trim();
    // إزالة المسافات الزائدة وتوحيد الكتابة
    const normalizedJob = job.replace(/\s+/g, ' ').trim();
    // توحيد بعض المسميات الشائعة
    if (normalizedJob.toLowerCase() === "worker" || normalizedJob === "عامل " || normalizedJob === " عامل") {
      return "عامل";
    }
    if (normalizedJob.toLowerCase() === "cashier" || normalizedJob === "كاشير " || normalizedJob === " كاشير") {
      return "كاشير";
    }
    if (normalizedJob.toLowerCase() === "barista" || normalizedJob === "باريستا " || normalizedJob === " باريستا") {
      return "باريستا";
    }
    if (normalizedJob.toLowerCase() === "baker" || normalizedJob.toLowerCase() === "bakery" || normalizedJob === "بيكري " || normalizedJob === " بيكري") {
      return "بيكري";
    }
    if (normalizedJob.toLowerCase() === "waiter" || normalizedJob === "واتر " || normalizedJob === " واتر" || normalizedJob === "ويتر") {
      return "واتر";
    }
    if (normalizedJob.toLowerCase() === "manager" || normalizedJob === "مدير " || normalizedJob === " مدير") {
      return "مدير";
    }
    return normalizedJob;
  };

  // ==================== COMPLIANCE METRICS ====================
  const complianceMetrics = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    
    const saudiEmployees = filteredEmployees.filter(emp => emp.nationality === "سعودي");
    const nonSaudiEmployees = filteredEmployees.filter(emp => emp.nationality !== "سعودي");
    const saudizationRate = filteredEmployees.length > 0 ? Math.round((saudiEmployees.length / filteredEmployees.length) * 100) : 0;
    const requiredSaudization = 30;
    const saudizationGap = requiredSaudization - saudizationRate;
    const saudizationStatus: "green" | "yellow" | "red" = saudizationRate >= requiredSaudization ? "green" : saudizationRate >= requiredSaudization - 5 ? "yellow" : "red";
    
    const gosiReport = saudiEmployees.map(emp => {
      const baseSalary = emp.salary || 0;
      const storedDeduction = emp.socialInsuranceDeduction || 0;
      const calculatedDeduction = storedDeduction > 0 ? storedDeduction : Math.round(baseSalary * 0.0975);
      const employerContribution = Math.round(baseSalary * 0.1175);
      return {
        emp,
        baseSalary,
        employeeContribution: calculatedDeduction,
        employerContribution,
        totalContribution: calculatedDeduction + employerContribution,
      };
    });
    const totalGosiEmployee = gosiReport.reduce((sum, r) => sum + r.employeeContribution, 0);
    const totalGosiEmployer = gosiReport.reduce((sum, r) => sum + r.employerContribution, 0);

    // تحليل تكاليف غير السعوديين (2% تأمين إصابات عمل + رسوم)
    // القيم محدثة حسب نظام وزارة الموارد البشرية للشركات الكبيرة
    const WORK_PERMIT_MONTHLY = 800; // 9,600 ريال/سنة (رسوم رخصة العمل للشركات الكبيرة)
    const IQAMA_FEES_MONTHLY = 54; // 650 ريال/سنة (رسوم الإقامة)
    const EXPAT_LEVY_MONTHLY = 800; // 9,600 ريال/سنة (المقابل المالي للشركات الكبيرة)
    const NON_SAUDI_INSURANCE_RATE = 0.02; // 2% تأمين إصابات العمل

    const nonSaudiByNationality = new Map<string, { 
      count: number; 
      totalBaseSalary: number; 
      totalHousing: number;
      insurableSalary: number;
      insuranceCost: number;
      workPermitCost: number;
      expatLevyCost: number;
      iqamaCost: number;
      totalMonthlyCost: number;
    }>();

    nonSaudiEmployees.filter(e => e.status === "active").forEach(emp => {
      const nat = normalizeNationality(emp.nationality) || "غير محدد";
      const existing = nonSaudiByNationality.get(nat) || { 
        count: 0, 
        totalBaseSalary: 0, 
        totalHousing: 0,
        insurableSalary: 0,
        insuranceCost: 0,
        workPermitCost: 0,
        expatLevyCost: 0,
        iqamaCost: 0,
        totalMonthlyCost: 0,
      };
      const baseSalary = emp.salary || 0;
      const housing = emp.housingAllowance || 0;
      const insurableSalary = baseSalary + housing;
      const insuranceCost = Math.round(insurableSalary * NON_SAUDI_INSURANCE_RATE);
      
      existing.count++;
      existing.totalBaseSalary += baseSalary;
      existing.totalHousing += housing;
      existing.insurableSalary += insurableSalary;
      existing.insuranceCost += insuranceCost;
      existing.workPermitCost += WORK_PERMIT_MONTHLY;
      existing.expatLevyCost += EXPAT_LEVY_MONTHLY;
      existing.iqamaCost += IQAMA_FEES_MONTHLY;
      existing.totalMonthlyCost += insuranceCost + WORK_PERMIT_MONTHLY + EXPAT_LEVY_MONTHLY + IQAMA_FEES_MONTHLY;
      nonSaudiByNationality.set(nat, existing);
    });

    const nonSaudiCostAnalysis = Array.from(nonSaudiByNationality.entries()).map(([nationality, data]) => ({
      nationality,
      ...data,
    })).sort((a, b) => b.count - a.count);

    const totalNonSaudiCount = nonSaudiCostAnalysis.reduce((sum, n) => sum + n.count, 0);
    const totalNonSaudiInsurance = nonSaudiCostAnalysis.reduce((sum, n) => sum + n.insuranceCost, 0);
    const totalNonSaudiWorkPermit = nonSaudiCostAnalysis.reduce((sum, n) => sum + n.workPermitCost, 0);
    const totalNonSaudiExpatLevy = nonSaudiCostAnalysis.reduce((sum, n) => sum + n.expatLevyCost, 0);
    const totalNonSaudiIqama = nonSaudiCostAnalysis.reduce((sum, n) => sum + n.iqamaCost, 0);
    const totalNonSaudiMonthlyCost = nonSaudiCostAnalysis.reduce((sum, n) => sum + n.totalMonthlyCost, 0);
    const totalNonSaudiInsurableSalary = nonSaudiCostAnalysis.reduce((sum, n) => sum + n.insurableSalary, 0);
    
    const expiringContracts: { emp: BranchEmployee; expiryDate: string; daysLeft: number; type: "contract" | "iqama" | "passport" }[] = [];
    
    filteredEmployees.forEach(emp => {
      if (emp.iqamaExpiry) {
        const expiryDate = new Date(emp.iqamaExpiry);
        if (expiryDate <= sixtyDaysFromNow && expiryDate >= today) {
          expiringContracts.push({
            emp,
            expiryDate: emp.iqamaExpiry,
            daysLeft: Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
            type: "iqama",
          });
        }
      }
      if (emp.passportExpiry) {
        const expiryDate = new Date(emp.passportExpiry);
        if (expiryDate <= sixtyDaysFromNow && expiryDate >= today) {
          expiringContracts.push({
            emp,
            expiryDate: emp.passportExpiry,
            daysLeft: Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)),
            type: "passport",
          });
        }
      }
    });
    
    // نسبة السعودة لكل فرع
    const branchSaudization = branches?.map(branch => {
      const branchEmps = filteredEmployees.filter(e => e.branchId === branch.id && e.status === "active");
      const branchSaudis = branchEmps.filter(e => e.nationality === "سعودي");
      const rate = branchEmps.length > 0 ? Math.round((branchSaudis.length / branchEmps.length) * 100) : 0;
      const status: "green" | "yellow" | "red" = rate >= requiredSaudization ? "green" : rate >= requiredSaudization - 5 ? "yellow" : "red";
      return {
        branchId: branch.id,
        branchName: branch.name,
        total: branchEmps.length,
        saudis: branchSaudis.length,
        nonSaudis: branchEmps.length - branchSaudis.length,
        rate,
        gap: Math.max(0, requiredSaudization - rate),
        neededSaudis: Math.max(0, Math.ceil((requiredSaudization / 100 * branchEmps.length) - branchSaudis.length)),
        status,
      };
    }).filter(b => b.total > 0).sort((a, b) => b.rate - a.rate) || [];

    // التكاليف الحكومية الشاملة
    const MUQABIL_MALI_MONTHLY = 400; // المقابل المالي للعمالة الفائضة
    const IQAMA_RENEWAL_YEARLY = 650; // تجديد الإقامة
    const EXIT_REENTRY_SINGLE = 200; // تأشيرة خروج وعودة مفردة
    const EXIT_REENTRY_MULTIPLE = 500; // تأشيرة خروج وعودة متعددة
    
    const activeNonSaudis = nonSaudiEmployees.filter(e => e.status === "active").length;
    const excessWorkers = Math.max(0, activeNonSaudis - Math.floor(saudiEmployees.length * (100 / requiredSaudization - 1)));
    
    // تكاليف صاحب العمل فقط (لا تشمل حصة الموظف)
    const laborFeesOnly = totalNonSaudiWorkPermit + totalNonSaudiExpatLevy + totalNonSaudiIqama; // رسوم العمالة بدون التأمين
    const muqabilMaliMonthly = excessWorkers * MUQABIL_MALI_MONTHLY;
    
    const governmentCosts = {
      // التأمينات الاجتماعية (حصة صاحب العمل فقط)
      gosiSaudiEmployee: totalGosiEmployee, // للعرض فقط - يُخصم من الموظف
      gosiSaudiEmployer: totalGosiEmployer, // تكلفة على صاحب العمل
      gosiNonSaudiEmployer: totalNonSaudiInsurance, // 2% تأمين إصابات العمل
      totalGosiEmployerOnly: totalGosiEmployer + totalNonSaudiInsurance, // إجمالي التأمينات على صاحب العمل
      // رسوم العمالة (منفصلة عن التأمين)
      workPermitTotal: totalNonSaudiWorkPermit,
      expatLevyTotal: totalNonSaudiExpatLevy,
      iqamaFeesTotal: totalNonSaudiIqama,
      laborFeesTotal: laborFeesOnly,
      // المقابل المالي
      excessWorkers,
      muqabilMaliMonthly,
      muqabilMaliYearly: muqabilMaliMonthly * 12,
      // إجمالي تكاليف صاحب العمل الشهرية (بدون حصة الموظف)
      totalMonthlyEmployerCost: totalGosiEmployer + totalNonSaudiInsurance + laborFeesOnly + muqabilMaliMonthly,
      // إجمالي تكاليف صاحب العمل السنوية
      totalYearlyEmployerCost: (totalGosiEmployer + totalNonSaudiInsurance + laborFeesOnly + muqabilMaliMonthly) * 12,
    };

    // حالة وثائق كل موظف
    const employeeDocumentStatus = filteredEmployees.filter(e => e.status === "active").map(emp => {
      const issues: string[] = [];
      let status: "complete" | "incomplete" | "expired" = "complete";
      
      // فحص الإقامة
      if (emp.nationality !== "سعودي") {
        if (!emp.iqamaNumber) {
          issues.push("رقم الإقامة غير مسجل");
          status = "incomplete";
        }
        if (!emp.iqamaExpiry) {
          issues.push("تاريخ انتهاء الإقامة غير مسجل");
          status = "incomplete";
        } else if (new Date(emp.iqamaExpiry) < today) {
          issues.push("الإقامة منتهية");
          status = "expired";
        }
      }
      
      // فحص الجواز
      if (!emp.passportNumber) {
        issues.push("رقم الجواز غير مسجل");
        if (status !== "expired") status = "incomplete";
      }
      if (!emp.passportExpiry) {
        issues.push("تاريخ انتهاء الجواز غير مسجل");
        if (status !== "expired") status = "incomplete";
      } else if (new Date(emp.passportExpiry) < today) {
        issues.push("الجواز منتهي");
        status = "expired";
      }
      
      // فحص الشهادة الصحية
      if (!emp.healthCertificate || emp.healthCertificate === "none") {
        issues.push("الشهادة الصحية غير مسجلة");
        if (status !== "expired") status = "incomplete";
      } else if (!emp.healthCertificateExpiry) {
        issues.push("تاريخ انتهاء الشهادة الصحية غير مسجل");
        if (status !== "expired") status = "incomplete";
      } else if (new Date(emp.healthCertificateExpiry) < today) {
        issues.push("الشهادة الصحية منتهية");
        status = "expired";
      }
      
      // فحص البيانات الأساسية
      if (!emp.nationality) {
        issues.push("الجنسية غير محددة");
        if (status !== "expired") status = "incomplete";
      }
      if (!emp.phoneNumber) {
        issues.push("رقم الهاتف غير مسجل");
        if (status !== "expired") status = "incomplete";
      }
      
      return {
        emp,
        status,
        issues,
        issueCount: issues.length,
      };
    });

    const documentStatusSummary = {
      complete: employeeDocumentStatus.filter(e => e.status === "complete").length,
      incomplete: employeeDocumentStatus.filter(e => e.status === "incomplete").length,
      expired: employeeDocumentStatus.filter(e => e.status === "expired").length,
      total: employeeDocumentStatus.length,
      completionRate: employeeDocumentStatus.length > 0 
        ? Math.round((employeeDocumentStatus.filter(e => e.status === "complete").length / employeeDocumentStatus.length) * 100) 
        : 0,
    };

    return {
      saudiEmployees: saudiEmployees.length,
      nonSaudiEmployees: nonSaudiEmployees.length,
      saudizationRate,
      requiredSaudization,
      saudizationGap,
      saudizationStatus,
      gosiReport,
      totalGosiEmployee,
      totalGosiEmployer,
      totalGosi: totalGosiEmployee + totalGosiEmployer,
      expiringContracts: expiringContracts.sort((a, b) => a.daysLeft - b.daysLeft),
      criticalExpiries: expiringContracts.filter(e => e.daysLeft <= 30).length,
      // تكاليف غير السعوديين
      nonSaudiCostAnalysis,
      totalNonSaudiCount,
      totalNonSaudiInsurance,
      totalNonSaudiWorkPermit,
      totalNonSaudiExpatLevy,
      totalNonSaudiIqama,
      totalNonSaudiMonthlyCost,
      totalNonSaudiInsurableSalary,
      // مقارنة التكاليف
      totalEmployerCostSaudi: totalGosiEmployer,
      totalEmployerCostNonSaudi: totalNonSaudiMonthlyCost,
      totalEmployerCost: totalGosiEmployer + totalNonSaudiMonthlyCost,
      // السعودة حسب الفرع
      branchSaudization,
      // التكاليف الحكومية
      governmentCosts,
      // حالة الوثائق
      employeeDocumentStatus: employeeDocumentStatus.sort((a, b) => b.issueCount - a.issueCount),
      documentStatusSummary,
    };
  }, [filteredEmployees, branches]);

  // ==================== HEALTH CERTIFICATE ANALYSIS ====================
  const healthCertificateAnalysis = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
    
    const validCertificates: typeof filteredEmployees = [];
    const expiredCertificates: typeof filteredEmployees = [];
    const noCertificates: typeof filteredEmployees = [];
    const expiringWithin30: { emp: BranchEmployee; daysLeft: number }[] = [];
    const expiringWithin60: { emp: BranchEmployee; daysLeft: number }[] = [];
    const expiringWithin90: { emp: BranchEmployee; daysLeft: number }[] = [];
    
    filteredEmployees.forEach(emp => {
      const status = emp.healthCertificate || "none";
      const expiry = emp.healthCertificateExpiry;
      
      if (status === "none" || !expiry) {
        noCertificates.push(emp);
      } else {
        const expiryDate = new Date(expiry);
        if (expiryDate < today) {
          expiredCertificates.push(emp);
        } else {
          validCertificates.push(emp);
          const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
          if (expiryDate <= thirtyDaysFromNow) {
            expiringWithin30.push({ emp, daysLeft });
          } else if (expiryDate <= sixtyDaysFromNow) {
            expiringWithin60.push({ emp, daysLeft });
          } else if (expiryDate <= ninetyDaysFromNow) {
            expiringWithin90.push({ emp, daysLeft });
          }
        }
      }
    });
    
    const complianceRate = filteredEmployees.length > 0 
      ? Math.round((validCertificates.length / filteredEmployees.length) * 100) 
      : 0;
    
    const branchCompliance = branches?.map(branch => {
      const branchEmps = filteredEmployees.filter(e => e.branchId === branch.id);
      const valid = branchEmps.filter(e => e.healthCertificate === "valid" && e.healthCertificateExpiry && new Date(e.healthCertificateExpiry) >= today).length;
      const rate = branchEmps.length > 0 ? Math.round((valid / branchEmps.length) * 100) : 0;
      return { branchId: branch.id, branchName: branch.name, total: branchEmps.length, valid, rate };
    }).filter(b => b.total > 0) || [];
    
    const jobCompliance = new Map<string, { total: number; valid: number }>();
    filteredEmployees.forEach(emp => {
      const job = emp.jobTitle || "غير محدد";
      const current = jobCompliance.get(job) || { total: 0, valid: 0 };
      current.total++;
      if (emp.healthCertificate === "valid" && emp.healthCertificateExpiry && new Date(emp.healthCertificateExpiry) >= today) {
        current.valid++;
      }
      jobCompliance.set(job, current);
    });
    const jobComplianceArray = Array.from(jobCompliance.entries()).map(([job, data]) => ({
      job,
      ...data,
      rate: data.total > 0 ? Math.round((data.valid / data.total) * 100) : 0
    })).sort((a, b) => b.total - a.total);
    
    const allExpiring = [...expiringWithin30, ...expiringWithin60, ...expiringWithin90].sort((a, b) => a.daysLeft - b.daysLeft);
    
    return {
      valid: validCertificates.length,
      expired: expiredCertificates.length,
      none: noCertificates.length,
      complianceRate,
      expiringWithin30,
      expiringWithin60,
      expiringWithin90,
      allExpiring,
      branchCompliance,
      jobCompliance: jobComplianceArray,
      needsRenewal: [...expiredCertificates, ...noCertificates, ...expiringWithin30.map(e => e.emp)],
    };
  }, [filteredEmployees, branches]);

  // ==================== COMPREHENSIVE COMPARISONS ====================
  const comprehensiveComparisons = useMemo(() => {
    if (!employees || !branches) return null;
    
    // Branch salary comparisons
    const branchSalaryStats = branches.map(branch => {
      const branchEmps = employees.filter(e => e.branchId === branch.id && e.status === "active");
      const salaries = branchEmps.map(e => e.salary || 0).filter(s => s > 0);
      const totalSalary = salaries.reduce((sum, s) => sum + s, 0);
      const avgSalary = salaries.length > 0 ? Math.round(totalSalary / salaries.length) : 0;
      const maxSalary = salaries.length > 0 ? Math.max(...salaries) : 0;
      const minSalary = salaries.length > 0 ? Math.min(...salaries) : 0;
      const highestPaid = branchEmps.find(e => e.salary === maxSalary);
      const lowestPaid = branchEmps.find(e => e.salary === minSalary);
      return {
        branchId: branch.id,
        branchName: branch.name,
        employeeCount: branchEmps.length,
        totalSalary,
        avgSalary,
        maxSalary,
        minSalary,
        highestPaid: highestPaid?.employeeName || "--",
        lowestPaid: lowestPaid?.employeeName || "--",
      };
    }).filter(b => b.employeeCount > 0).sort((a, b) => b.avgSalary - a.avgSalary);

    // Job title comparisons across branches (with normalization)
    const normalizedJobMap = new Map<string, typeof employees>();
    employees.filter(e => e.status === "active").forEach(emp => {
      const normalizedJob = normalizeJobTitle(emp.jobTitle);
      const existing = normalizedJobMap.get(normalizedJob) || [];
      existing.push(emp);
      normalizedJobMap.set(normalizedJob, existing);
    });
    const jobTitles = Array.from(normalizedJobMap.keys());
    const jobAcrossBranches = jobTitles.map(job => {
      const jobEmps = normalizedJobMap.get(job) || [];
      const byBranch = branches.map(branch => {
        const branchJobEmps = jobEmps.filter(e => e.branchId === branch.id);
        const salaries = branchJobEmps.map(e => e.salary || 0);
        const avg = salaries.length > 0 ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length) : 0;
        return { branchId: branch.id, branchName: branch.name, count: branchJobEmps.length, avgSalary: avg };
      }).filter(b => b.count > 0);
      const allSalaries = jobEmps.map(e => e.salary || 0).filter(s => s > 0);
      const overallAvg = allSalaries.length > 0 ? Math.round(allSalaries.reduce((a, b) => a + b, 0) / allSalaries.length) : 0;
      const maxBranch = byBranch.reduce((max, b) => b.avgSalary > max.avgSalary ? b : max, { avgSalary: 0, branchName: "--" } as any);
      const minBranch = byBranch.filter(b => b.avgSalary > 0).reduce((min, b) => b.avgSalary < min.avgSalary ? b : min, { avgSalary: Infinity, branchName: "--" } as any);
      return {
        jobTitle: job,
        totalCount: jobEmps.length,
        overallAvgSalary: overallAvg,
        byBranch,
        highestPayingBranch: maxBranch.branchName,
        lowestPayingBranch: minBranch.avgSalary !== Infinity ? minBranch.branchName : "--",
        salaryGap: maxBranch.avgSalary - (minBranch.avgSalary !== Infinity ? minBranch.avgSalary : 0),
      };
    }).filter(j => j.totalCount > 0).sort((a, b) => b.totalCount - a.totalCount);

    // Nationality comparisons (with normalization)
    const normalizedNatMap = new Map<string, typeof employees>();
    employees.filter(e => e.status === "active").forEach(emp => {
      const normalizedNat = normalizeNationality(emp.nationality);
      const existing = normalizedNatMap.get(normalizedNat) || [];
      existing.push(emp);
      normalizedNatMap.set(normalizedNat, existing);
    });
    const nationalities = Array.from(normalizedNatMap.keys());
    const nationalityStats = nationalities.map(nat => {
      const natEmps = normalizedNatMap.get(nat) || [];
      const salaries = natEmps.map(e => e.salary || 0).filter(s => s > 0);
      const totalSalary = salaries.reduce((sum, s) => sum + s, 0);
      const avgSalary = salaries.length > 0 ? Math.round(totalSalary / salaries.length) : 0;
      const byBranch = branches.map(branch => ({
        branchName: branch.name,
        count: natEmps.filter(e => e.branchId === branch.id).length
      })).filter(b => b.count > 0);
      return {
        nationality: nat,
        count: natEmps.length,
        percentage: employees.filter(e => e.status === "active").length > 0 
          ? Math.round((natEmps.length / employees.filter(e => e.status === "active").length) * 100) : 0,
        avgSalary,
        totalSalary,
        byBranch,
      };
    }).sort((a, b) => b.count - a.count);

    // Employee count per branch with details
    const branchEmployeeCounts = branches.map(branch => {
      const branchEmps = employees.filter(e => e.branchId === branch.id);
      const active = branchEmps.filter(e => e.status === "active").length;
      const terminated = branchEmps.filter(e => e.status === "terminated").length;
      const onLeave = branchEmps.filter(e => e.status === "on_leave").length;
      const saudis = branchEmps.filter(e => e.nationality === "سعودي" && e.status === "active").length;
      const saudizationRate = active > 0 ? Math.round((saudis / active) * 100) : 0;
      const totalSalary = branchEmps.filter(e => e.status === "active").reduce((sum, e) => sum + (e.salary || 0), 0);
      return {
        branchId: branch.id,
        branchName: branch.name,
        total: branchEmps.length,
        active,
        terminated,
        onLeave,
        saudis,
        nonSaudis: active - saudis,
        saudizationRate,
        totalSalary,
        avgSalary: active > 0 ? Math.round(totalSalary / active) : 0,
      };
    }).filter(b => b.total > 0).sort((a, b) => b.active - a.active);

    // Salary distribution analysis
    const activeSalaries = employees.filter(e => e.status === "active" && e.salary).map(e => e.salary || 0);
    const salaryRanges = [
      { range: "أقل من 3,000", min: 0, max: 3000, count: 0 },
      { range: "3,000 - 5,000", min: 3000, max: 5000, count: 0 },
      { range: "5,000 - 8,000", min: 5000, max: 8000, count: 0 },
      { range: "8,000 - 12,000", min: 8000, max: 12000, count: 0 },
      { range: "12,000 - 20,000", min: 12000, max: 20000, count: 0 },
      { range: "أكثر من 20,000", min: 20000, max: Infinity, count: 0 },
    ];
    activeSalaries.forEach(sal => {
      const range = salaryRanges.find(r => sal >= r.min && sal < r.max);
      if (range) range.count++;
    });

    // Tenure distribution analysis (مدة الخدمة)
    const today = new Date();
    const tenureRanges = [
      { range: "أقل من سنة", min: 0, max: 1, count: 0, employees: [] as any[] },
      { range: "1-3 سنوات", min: 1, max: 3, count: 0, employees: [] as any[] },
      { range: "3-5 سنوات", min: 3, max: 5, count: 0, employees: [] as any[] },
      { range: "أكثر من 5 سنوات", min: 5, max: 100, count: 0, employees: [] as any[] },
    ];
    const activeEmpsWithHireDate = employees.filter(e => e.status === "active" && e.hireDate);
    activeEmpsWithHireDate.forEach(emp => {
      const hireDate = new Date(emp.hireDate!);
      const years = (today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      const range = tenureRanges.find(r => years >= r.min && years < r.max);
      if (range) {
        range.count++;
        range.employees.push({ name: emp.employeeName, years: Math.round(years * 10) / 10, salary: emp.salary });
      }
    });
    const tenureByBranch = branches.map(branch => {
      const branchEmps = activeEmpsWithHireDate.filter(e => e.branchId === branch.id);
      const avgTenure = branchEmps.length > 0 
        ? Math.round(branchEmps.reduce((sum, e) => {
            const years = (today.getTime() - new Date(e.hireDate!).getTime()) / (1000 * 60 * 60 * 24 * 365);
            return sum + years;
          }, 0) / branchEmps.length * 10) / 10
        : 0;
      return { branchName: branch.name, avgTenure, count: branchEmps.length };
    }).filter(b => b.count > 0).sort((a, b) => b.avgTenure - a.avgTenure);

    // Salary gap analysis by nationality for same job (تحليل الفجوة الراتبية) - with normalization
    const salaryGapByJob: Array<{
      jobTitle: string;
      nationalityComparisons: Array<{ nationality: string; avgSalary: number; count: number }>;
      maxGap: number;
      highestPaidNat: string;
      lowestPaidNat: string;
    }> = [];
    
    jobTitles.forEach(job => {
      const jobEmps = (normalizedJobMap.get(job) || []).filter(e => e.salary);
      if (jobEmps.length < 2) return;
      
      const natSalaries = new Map<string, { total: number; count: number }>();
      jobEmps.forEach(emp => {
        const nat = normalizeNationality(emp.nationality);
        const current = natSalaries.get(nat) || { total: 0, count: 0 };
        current.total += emp.salary || 0;
        current.count++;
        natSalaries.set(nat, current);
      });
      
      if (natSalaries.size < 2) return;
      
      const comparisons = Array.from(natSalaries.entries()).map(([nat, data]) => ({
        nationality: nat,
        avgSalary: Math.round(data.total / data.count),
        count: data.count
      })).sort((a, b) => b.avgSalary - a.avgSalary);
      
      const maxSalary = comparisons[0]?.avgSalary || 0;
      const minSalary = comparisons[comparisons.length - 1]?.avgSalary || 0;
      
      salaryGapByJob.push({
        jobTitle: job,
        nationalityComparisons: comparisons,
        maxGap: maxSalary - minSalary,
        highestPaidNat: comparisons[0]?.nationality || "--",
        lowestPaidNat: comparisons[comparisons.length - 1]?.nationality || "--",
      });
    });
    
    const sortedSalaryGap = salaryGapByJob.sort((a, b) => b.maxGap - a.maxGap).slice(0, 15);

    // تحليل البدلات حسب الفرع
    const allowancesAnalysis = branches.map(branch => {
      const branchEmps = employees.filter(e => e.branchId === branch.id && e.status === "active");
      const totalHousing = branchEmps.reduce((sum, e) => sum + (e.housingAllowance || 0), 0);
      const totalTransport = branchEmps.reduce((sum, e) => sum + (e.transportAllowance || 0), 0);
      const totalFood = branchEmps.reduce((sum, e) => sum + (e.foodAllowance || 0), 0);
      const totalOther = branchEmps.reduce((sum, e) => sum + (e.otherAllowances || 0), 0);
      const totalAllowances = totalHousing + totalTransport + totalFood + totalOther;
      return {
        branchName: branch.name,
        branchId: branch.id,
        employeeCount: branchEmps.length,
        housingAllowance: totalHousing,
        transportAllowance: totalTransport,
        foodAllowance: totalFood,
        otherAllowances: totalOther,
        totalAllowances,
        avgAllowancePerEmployee: branchEmps.length > 0 ? Math.round(totalAllowances / branchEmps.length) : 0,
      };
    }).filter(b => b.employeeCount > 0).sort((a, b) => b.totalAllowances - a.totalAllowances);

    // التكلفة الشهرية الإجمالية لكل فرع
    const monthlyCostAnalysis = branches.map(branch => {
      const branchEmps = employees.filter(e => e.branchId === branch.id && e.status === "active");
      const totalSalaries = branchEmps.reduce((sum, e) => sum + (e.salary || 0), 0);
      const totalHousing = branchEmps.reduce((sum, e) => sum + (e.housingAllowance || 0), 0);
      const totalTransport = branchEmps.reduce((sum, e) => sum + (e.transportAllowance || 0), 0);
      const totalFood = branchEmps.reduce((sum, e) => sum + (e.foodAllowance || 0), 0);
      const totalOther = branchEmps.reduce((sum, e) => sum + (e.otherAllowances || 0), 0);
      const totalAllowances = totalHousing + totalTransport + totalFood + totalOther;
      // التأمينات الاجتماعية 9.75% للسعوديين فقط
      const saudiEmps = branchEmps.filter(e => normalizeNationality(e.nationality) === "سعودي");
      const socialInsurance = saudiEmps.reduce((sum, e) => sum + Math.round((e.salary || 0) * 0.0975), 0);
      const totalCost = totalSalaries + totalAllowances + socialInsurance;
      const costPerEmployee = branchEmps.length > 0 ? Math.round(totalCost / branchEmps.length) : 0;
      return {
        branchName: branch.name,
        branchId: branch.id,
        employeeCount: branchEmps.length,
        totalSalaries,
        totalAllowances,
        socialInsurance,
        totalCost,
        costPerEmployee,
      };
    }).filter(b => b.employeeCount > 0).sort((a, b) => b.totalCost - a.totalCost);

    // كفاءة الفرع المالية (الرواتب مقابل المبيعات)
    const grandTotalCost = monthlyCostAnalysis.reduce((sum, b) => sum + b.totalCost, 0);
    const grandTotalSalaries = monthlyCostAnalysis.reduce((sum, b) => sum + b.totalSalaries, 0);
    const grandTotalAllowances = monthlyCostAnalysis.reduce((sum, b) => sum + b.totalAllowances, 0);
    const grandTotalInsurance = monthlyCostAnalysis.reduce((sum, b) => sum + b.socialInsurance, 0);

    return {
      branchSalaryStats,
      jobAcrossBranches: jobAcrossBranches.slice(0, 15),
      nationalityStats,
      branchEmployeeCounts,
      salaryRanges,
      tenureRanges,
      tenureByBranch,
      salaryGapByJob: sortedSalaryGap,
      allowancesAnalysis,
      monthlyCostAnalysis,
      summary: {
        totalBranches: branchSalaryStats.length,
        totalActiveEmployees: employees.filter(e => e.status === "active").length,
        overallAvgSalary: activeSalaries.length > 0 ? Math.round(activeSalaries.reduce((a, b) => a + b, 0) / activeSalaries.length) : 0,
        highestAvgBranch: branchSalaryStats[0]?.branchName || "--",
        lowestAvgBranch: branchSalaryStats[branchSalaryStats.length - 1]?.branchName || "--",
        avgTenure: activeEmpsWithHireDate.length > 0 
          ? Math.round(activeEmpsWithHireDate.reduce((sum, e) => {
              return sum + (today.getTime() - new Date(e.hireDate!).getTime()) / (1000 * 60 * 60 * 24 * 365);
            }, 0) / activeEmpsWithHireDate.length * 10) / 10
          : 0,
        grandTotalCost,
        grandTotalSalaries,
        grandTotalAllowances,
        grandTotalInsurance,
      }
    };
  }, [employees, branches]);

  // ==================== TURNOVER ANALYSIS ====================
  const turnoverAnalysis = useMemo(() => {
    const terminatedEmployees = employees?.filter(emp => emp.status === "terminated") || [];
    const onLeaveEmployees = employees?.filter(emp => emp.status === "on_leave") || [];
    const activeEmployees = employees?.filter(emp => emp.status === "active") || [];
    
    const totalEmployeesEver = (employees?.length || 0);
    const turnoverRate = totalEmployeesEver > 0 ? Math.round((terminatedEmployees.length / totalEmployeesEver) * 100) : 0;
    
    const turnoverByBranch = branches?.map(branch => {
      const branchTerminated = terminatedEmployees.filter(emp => emp.branchId === branch.id).length;
      const branchActive = activeEmployees.filter(emp => emp.branchId === branch.id).length;
      const branchTotal = branchTerminated + branchActive;
      const rate = branchTotal > 0 ? Math.round((branchTerminated / branchTotal) * 100) : 0;
      return { branchName: branch.name, branchId: branch.id, terminated: branchTerminated, active: branchActive, rate };
    }).filter(b => b.terminated > 0 || b.active > 0) || [];
    
    const turnoverByJob = new Map<string, { terminated: number; active: number }>();
    terminatedEmployees.forEach(emp => {
      const current = turnoverByJob.get(emp.jobTitle) || { terminated: 0, active: 0 };
      current.terminated++;
      turnoverByJob.set(emp.jobTitle, current);
    });
    activeEmployees.forEach(emp => {
      const current = turnoverByJob.get(emp.jobTitle) || { terminated: 0, active: 0 };
      current.active++;
      turnoverByJob.set(emp.jobTitle, current);
    });
    const turnoverByJobArray = Array.from(turnoverByJob.entries()).map(([jobTitle, data]) => ({
      jobTitle,
      ...data,
      rate: data.terminated + data.active > 0 ? Math.round((data.terminated / (data.terminated + data.active)) * 100) : 0,
    })).sort((a, b) => b.rate - a.rate);
    
    return {
      totalTerminated: terminatedEmployees.length,
      totalOnLeave: onLeaveEmployees.length,
      totalActive: activeEmployees.length,
      turnoverRate,
      turnoverByBranch: turnoverByBranch.sort((a, b) => b.rate - a.rate),
      turnoverByJob: turnoverByJobArray.slice(0, 10),
      recentTerminations: terminatedEmployees.slice(0, 10),
    };
  }, [employees, branches]);

  // ==================== ATTENDANCE vs SCHEDULE VARIANCE ====================
  const scheduleVarianceAnalysis = useMemo(() => {
    if (!employeeSchedules || !attendanceRecords) return { variances: [], summary: { onTime: 0, late: 0, absent: 0, early: 0, total: 0 } };
    
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = `${selectedMonth}-31`;
    
    const scheduledForMonth = employeeSchedules.filter(s => 
      s.scheduleDate >= monthStart && s.scheduleDate <= monthEnd &&
      (selectedBranch === "all" || s.branchEmployeeId)
    );
    
    const attendanceMap = new Map<string, AttendanceRecord>();
    attendanceRecords.filter(r => r.attendanceDate >= monthStart && r.attendanceDate <= monthEnd)
      .forEach(r => {
        const key = `${r.branchEmployeeId || r.employeeId}-${r.attendanceDate}`;
        attendanceMap.set(key, r);
      });
    
    let onTime = 0, late = 0, absent = 0, early = 0;
    const employeeVariances = new Map<number, { name: string; scheduled: number; attended: number; lateCount: number; earlyDepartures: number }>();
    
    scheduledForMonth.forEach(schedule => {
      if (!schedule.branchEmployeeId) return;
      const key = `${schedule.branchEmployeeId}-${schedule.scheduleDate}`;
      const attendance = attendanceMap.get(key);
      const emp = filteredEmployees.find(e => e.id === schedule.branchEmployeeId);
      
      if (!employeeVariances.has(schedule.branchEmployeeId)) {
        employeeVariances.set(schedule.branchEmployeeId, { 
          name: emp?.employeeName || "غير معروف", 
          scheduled: 0, attended: 0, lateCount: 0, earlyDepartures: 0 
        });
      }
      const empVar = employeeVariances.get(schedule.branchEmployeeId)!;
      empVar.scheduled++;
      
      if (!attendance) {
        absent++;
      } else {
        empVar.attended++;
        if (attendance.status === "late") {
          late++;
          empVar.lateCount++;
        } else if (attendance.status === "present") {
          onTime++;
        }
      }
    });
    
    return {
      variances: Array.from(employeeVariances.values())
        .map(v => ({ ...v, attendanceRate: v.scheduled > 0 ? Math.round((v.attended / v.scheduled) * 100) : 0 }))
        .sort((a, b) => a.attendanceRate - b.attendanceRate)
        .slice(0, 10),
      summary: { onTime, late, absent, early, total: scheduledForMonth.length },
    };
  }, [employeeSchedules, attendanceRecords, selectedMonth, selectedBranch, filteredEmployees]);

  // ==================== CASHIER SALES PERFORMANCE ====================
  const cashierPerformanceAnalysis = useMemo(() => {
    if (!cashierJournals || !employees) return { cashierPerformance: [], branchSales: [], totalSales: 0 };
    
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = `${selectedMonth}-31`;
    
    const monthJournals = cashierJournals.filter(j => 
      j.reportDate >= monthStart && j.reportDate <= monthEnd &&
      (selectedBranch === "all" || j.branchId === selectedBranch)
    );
    
    const cashierSalesMap = new Map<string, { name: string; totalSales: number; daysWorked: number; avgDaily: number }>();
    const branchSalesMap = new Map<string, { branchName: string; totalSales: number; journalCount: number }>();
    
    monthJournals.forEach(journal => {
      const branchName = getBranchName(journal.branchId);
      
      if (!cashierSalesMap.has(journal.cashierId)) {
        const emp = employees.find(e => e.linkedUserId === journal.cashierId);
        cashierSalesMap.set(journal.cashierId, { 
          name: journal.cashierName || emp?.employeeName || "كاشير غير معروف",
          totalSales: 0, daysWorked: 0, avgDaily: 0 
        });
      }
      const cashierData = cashierSalesMap.get(journal.cashierId)!;
      cashierData.totalSales += journal.totalSales || 0;
      cashierData.daysWorked++;
      
      if (!branchSalesMap.has(journal.branchId)) {
        branchSalesMap.set(journal.branchId, { branchName, totalSales: 0, journalCount: 0 });
      }
      const branchData = branchSalesMap.get(journal.branchId)!;
      branchData.totalSales += journal.totalSales || 0;
      branchData.journalCount++;
    });
    
    const cashierPerformance = Array.from(cashierSalesMap.values())
      .map(c => ({ ...c, avgDaily: c.daysWorked > 0 ? Math.round(c.totalSales / c.daysWorked) : 0 }))
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10);
    
    const branchSales = Array.from(branchSalesMap.values()).sort((a, b) => b.totalSales - a.totalSales);
    const totalSales = monthJournals.reduce((sum, j) => sum + (j.totalSales || 0), 0);
    
    return { cashierPerformance, branchSales, totalSales };
  }, [cashierJournals, employees, selectedMonth, selectedBranch, getBranchName]);

  // ==================== ADVANCED FILTERS DATA ====================
  const tenureDistribution = useMemo(() => {
    const distribution = { lessThan1Year: 0, oneToThree: 0, threeToFive: 0, moreThanFive: 0 };
    const today = new Date();
    
    filteredEmployees.forEach(emp => {
      if (!emp.hireDate) {
        distribution.lessThan1Year++;
        return;
      }
      const hireDate = new Date(emp.hireDate);
      const yearsOfService = (today.getTime() - hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      
      if (yearsOfService < 1) distribution.lessThan1Year++;
      else if (yearsOfService < 3) distribution.oneToThree++;
      else if (yearsOfService < 5) distribution.threeToFive++;
      else distribution.moreThanFive++;
    });
    
    return [
      { name: "أقل من سنة", value: distribution.lessThan1Year },
      { name: "1-3 سنوات", value: distribution.oneToThree },
      { name: "3-5 سنوات", value: distribution.threeToFive },
      { name: "أكثر من 5 سنوات", value: distribution.moreThanFive },
    ];
  }, [filteredEmployees]);

  // ==================== EARLY WARNING INDICATORS ====================
  const earlyWarningIndicators = useMemo(() => {
    const warnings: { emp: BranchEmployee; type: string; severity: "high" | "medium" | "low"; description: string }[] = [];
    
    filteredEmployees.forEach(emp => {
      const attendance = attendanceByEmployee.get(emp.id);
      if (!attendance) return;
      
      const absentRate = attendance.total > 0 ? (attendance.absent / attendance.total) * 100 : 0;
      const lateRate = attendance.total > 0 ? (attendance.late / attendance.total) * 100 : 0;
      
      if (absentRate >= 20) {
        warnings.push({ emp, type: "غياب متكرر", severity: "high", description: `نسبة غياب ${Math.round(absentRate)}%` });
      } else if (absentRate >= 10) {
        warnings.push({ emp, type: "غياب متوسط", severity: "medium", description: `نسبة غياب ${Math.round(absentRate)}%` });
      }
      
      if (lateRate >= 30) {
        warnings.push({ emp, type: "تأخير متكرر", severity: "high", description: `نسبة تأخير ${Math.round(lateRate)}%` });
      } else if (lateRate >= 15) {
        warnings.push({ emp, type: "تأخير متوسط", severity: "medium", description: `نسبة تأخير ${Math.round(lateRate)}%` });
      }
    });
    
    return warnings.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [filteredEmployees, attendanceByEmployee]);

  const isLoading = employeesLoading || attendanceLoading;

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-4" dir="rtl" ref={printRef}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" onClick={() => navigate("/attendance-dashboard")} data-testid="button-back">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{isRTL ? "التقارير الشاملة" : "Comprehensive Reports"}</h1>
              <p className="text-xs sm:text-sm text-gray-500">{isRTL ? "تقارير تحليلية شاملة لموظفي الفروع والحضور والرواتب" : "Comprehensive analytics reports for branch employees, attendance, and salaries"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="default" 
              className="h-11 sm:h-9 bg-green-600 hover:bg-green-700"
              onClick={() => setShowSalaryClosingDialog(true)}
              data-testid="button-salary-closing"
            >
              <Wallet className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
              {isRTL ? "إغلاق الرواتب الشهرية" : "Monthly Salary Closing"}
            </Button>
          </div>
        </div>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>{isRTL ? "الفرع" : "Branch"}</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!canSelectBranch}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-branch">
                    <SelectValue placeholder={isRTL ? "جميع الفروع" : "All Branches"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {canSelectBranch && <SelectItem value="all">{isRTL ? "جميع الفروع" : "All Branches"}</SelectItem>}
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "الشهر" : "Month"}</Label>
                <Input 
                  className="h-11 sm:h-10"
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  data-testid="input-month"
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "الوظيفة" : "Job Title"}</Label>
                <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-job">
                    <SelectValue placeholder={isRTL ? "جميع الوظائف" : "All Job Titles"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="all">{isRTL ? "جميع الوظائف" : "All Job Titles"}</SelectItem>
                    {jobTitles.map((job) => (
                      <SelectItem key={job} value={job}>{job}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "الموظف" : "Employee"}</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="h-11 sm:h-10" data-testid="select-employee">
                    <SelectValue placeholder={isRTL ? "جميع الموظفين" : "All Employees"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    <SelectItem value="all">{isRTL ? "جميع الموظفين" : "All Employees"}</SelectItem>
                    {employees?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.employeeName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="h-11 sm:h-9" onClick={() => {
                  setSelectedBranch("all");
                  setSelectedJobTitle("all");
                  setSelectedEmployee("all");
                }} data-testid="button-reset-filters">
                  <RefreshCw className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                  {isRTL ? "إعادة تعيين" : "Reset"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4 pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{formatNumber(overviewStats.totalEmployees)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{isRTL ? "إجمالي الموظفين" : "Total Employees"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{overviewStats.attendanceRate}%</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{isRTL ? "نسبة الحضور" : "Attendance Rate"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
                  <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{formatNumber(overviewStats.absentCount)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{isRTL ? "أيام الغياب" : "Absent Days"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-amber-100 rounded-lg">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{formatCurrency(overviewStats.totalSalaries, isRTL)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{isRTL ? "إجمالي الرواتب" : "Total Salaries"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-teal-100 rounded-lg">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{formatNumber(overviewStats.saudiEmployees)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{isRTL ? "الموظفين السعوديين" : "Saudi Employees"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 pt-3 sm:pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold">{formatCurrency(overviewStats.totalInsurance, isRTL)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{isRTL ? "التأمينات الاجتماعية" : "Social Insurance"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {unlinkedRecordsCount > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-orange-800">
                      {isRTL ? `${formatNumber(unlinkedRecordsCount)} سجل حضور غير مرتبط` : `${formatNumber(unlinkedRecordsCount)} Unlinked Attendance Records`}
                    </p>
                    <p className="text-sm text-orange-600">
                      {isRTL ? "سجلات لا يمكن ربطها بموظفين محددين - قم بتصديرها للمراجعة" : "Records that cannot be linked to specific employees - export for review"}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportUnlinkedRecordsToExcel}
                  className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  data-testid="button-export-unlinked"
                >
                  <Download className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                  {isRTL ? "تصدير للمراجعة" : "Export for Review"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <div className="overflow-x-auto pb-2 scrollbar-thin">
              <TabsList className="inline-flex h-auto flex-wrap gap-1 p-1 bg-muted/50 rounded-lg">
              <TabsTrigger value="overview" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-overview">
                <BarChart3 className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "نظرة عامة" : "Overview"}
              </TabsTrigger>
              <TabsTrigger value="data-quality" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-data-quality">
                <AlertCircle className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "جودة البيانات" : "Data Quality"}
              </TabsTrigger>
              <TabsTrigger value="compliance" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-compliance">
                <CheckCircle className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "الامتثال" : "Compliance"}
              </TabsTrigger>
              <TabsTrigger value="turnover" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-turnover">
                <RefreshCw className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "الدوران" : "Turnover"}
              </TabsTrigger>
              <TabsTrigger value="branch-comparison" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-branch-comparison">
                <Building2 className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "الفروع" : "Branches"}
              </TabsTrigger>
              <TabsTrigger value="job-comparison" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-job-comparison">
                <Users className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "الوظائف" : "Job Titles"}
              </TabsTrigger>
              <TabsTrigger value="attendance" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-attendance">
                <Calendar className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "الحضور" : "Attendance"}
              </TabsTrigger>
              <TabsTrigger value="salaries" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-salaries">
                <DollarSign className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "الرواتب" : "Salaries"}
              </TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-analytics">
                <TrendingUp className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "التحليلات" : "Analytics"}
              </TabsTrigger>
              <TabsTrigger value="kpis" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-kpis">
                <PieChartIcon className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "المؤشرات" : "KPIs"}
              </TabsTrigger>
              <TabsTrigger value="health-certificates" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-health-certificates">
                <CheckCircle className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "الشهادات الصحية" : "Health Certs"}
              </TabsTrigger>
              <TabsTrigger value="comparisons" className="text-xs px-3 py-2 whitespace-nowrap" data-testid="tab-comparisons">
                <BarChart3 className={`w-3.5 h-3.5 ${isRTL ? "ml-1" : "mr-1"}`} />
                {isRTL ? "المقارنات" : "Comparisons"}
              </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="space-y-4">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600 font-medium">{isRTL ? "إجمالي الموظفين" : "Total Employees"}</p>
                        <p className="text-3xl font-bold text-blue-800">{formatNumber(overviewStats.totalEmployees)}</p>
                        <p className="text-xs text-blue-500 mt-1">
                          {isRTL ? "نشط:" : "Active:"} {formatNumber(overviewStats.activeEmployees)}
                        </p>
                      </div>
                      <div className="p-3 bg-blue-200 rounded-full">
                        <Users className="w-6 h-6 text-blue-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600 font-medium">{isRTL ? "إجمالي الرواتب" : "Total Salaries"}</p>
                        <p className="text-2xl font-bold text-green-800">{formatCurrency(overviewStats.totalSalaries, isRTL)}</p>
                        <p className="text-xs text-green-500 mt-1">
                          {isRTL ? "تأمينات:" : "Insurance:"} {formatCurrency(overviewStats.totalInsurance, isRTL)}
                        </p>
                      </div>
                      <div className="p-3 bg-green-200 rounded-full">
                        <DollarSign className="w-6 h-6 text-green-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-amber-600 font-medium">{isRTL ? "نسبة السعودة" : "Saudization Rate"}</p>
                        <p className="text-3xl font-bold text-amber-800">
                          {overviewStats.totalEmployees > 0 ? Math.round((overviewStats.saudiEmployees / overviewStats.totalEmployees) * 100) : 0}%
                        </p>
                        <p className="text-xs text-amber-500 mt-1">
                          {isRTL ? `${formatNumber(overviewStats.saudiEmployees)} سعودي من ${formatNumber(overviewStats.totalEmployees)}` : `${formatNumber(overviewStats.saudiEmployees)} Saudi of ${formatNumber(overviewStats.totalEmployees)}`}
                        </p>
                      </div>
                      <div className="p-3 bg-amber-200 rounded-full">
                        <Shield className="w-6 h-6 text-amber-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-purple-600 font-medium">{isRTL ? "معدل الحضور" : "Attendance Rate"}</p>
                        <p className="text-3xl font-bold text-purple-800">{overviewStats.attendanceRate}%</p>
                        <div className="flex items-center gap-2 mt-1">
                          {previousMonthStats && (
                            <span className={`text-xs flex items-center gap-1 ${getChangeIndicator(overviewStats.attendanceRate, previousMonthStats.attendanceRate).isPositive ? "text-green-600" : "text-red-600"}`}>
                              {getChangeIndicator(overviewStats.attendanceRate, previousMonthStats.attendanceRate).isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                              {Math.abs(getChangeIndicator(overviewStats.attendanceRate, previousMonthStats.attendanceRate).change)}% {isRTL ? "من الشهر السابق" : "from last month"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-3 bg-purple-200 rounded-full">
                        <Clock className="w-6 h-6 text-purple-700" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row - Improved Design */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Nationality Distribution - Clean Donut with Summary */}
                <Card className="overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-amber-800">
                      <PieChartIcon className="w-5 h-5" />
                      {isRTL ? "توزيع الموظفين حسب الجنسية" : "Employee Distribution by Nationality"}
                    </CardTitle>
                    <CardDescription>{isRTL ? "أعلى 5 جنسيات + أخرى" : "Top 5 nationalities + others"}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-6">
                      {/* Donut Chart */}
                      <div className="flex-shrink-0" style={{ width: 200, height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={nationalityChartData}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              innerRadius={50}
                              fill="#8884d8"
                              dataKey="value"
                              paddingAngle={3}
                            >
                              {nationalityChartData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={COLORS[index % COLORS.length]}
                                  stroke="#fff"
                                  strokeWidth={2}
                                />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value, name) => [formatNumber(Number(value)), name]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Custom Legend */}
                      <div className="flex-1 space-y-2">
                        {nationalityChartData.map((item, index) => {
                          const total = nationalityChartData.reduce((sum, i) => sum + i.value, 0);
                          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
                          return (
                            <div key={item.name} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                />
                                <span className="text-sm font-medium text-gray-700">{item.name}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-gray-900">{formatNumber(item.value)}</span>
                                <span className="text-xs text-gray-500 w-10 text-left">{percent}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Job Title Distribution - Clean Horizontal Bars */}
                <Card className="overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <BarChart3 className="w-5 h-5" />
                      {isRTL ? "توزيع الموظفين حسب الوظيفة" : "Employee Distribution by Job Title"}
                    </CardTitle>
                    <CardDescription>{isRTL ? `أعلى 8 وظائف (إجمالي ${jobTitleFullData.length} وظيفة)` : `Top 8 job titles (Total ${jobTitleFullData.length} titles)`}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      {jobTitleChartData.map((item, index) => {
                        const maxValue = jobTitleChartData[0]?.value || 1;
                        const percent = Math.round((item.value / maxValue) * 100);
                        const gradientColors = [
                          "from-amber-400 to-amber-500",
                          "from-orange-400 to-orange-500",
                          "from-yellow-400 to-yellow-500",
                          "from-lime-400 to-lime-500",
                          "from-green-400 to-green-500",
                          "from-teal-400 to-teal-500",
                          "from-cyan-400 to-cyan-500",
                          "from-sky-400 to-sky-500",
                        ];
                        return (
                          <div key={item.name} className="group">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]" title={item.name}>
                                {item.name}
                              </span>
                              <span className="text-sm font-bold text-gray-900">{formatNumber(item.value)}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                              <div 
                                className={`h-full bg-gradient-to-r ${gradientColors[index % gradientColors.length]} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                                style={{ width: `${percent}%` }}
                              >
                                {percent >= 30 && (
                                  <span className="text-xs font-medium text-white">{percent}%</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {jobTitleFullData.length > 8 && (
                      <p className="text-xs text-gray-400 text-center mt-4">
                        {isRTL ? `و ${jobTitleFullData.length - 8} وظائف أخرى...` : `And ${jobTitleFullData.length - 8} more job titles...`}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Branch Salary Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    {isRTL ? "إجمالي الرواتب حسب الفرع" : "Total Salaries by Branch"}
                  </CardTitle>
                  <CardDescription>{isRTL ? "مرتب من الأعلى للأقل" : "Sorted from highest to lowest"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={branchSalaryData} margin={{ top: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(value) => formatNumber(value)} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value), isRTL)} />
                      <Bar 
                        dataKey="salary" 
                        fill="#10b981" 
                        name={isRTL ? "إجمالي الرواتب" : "Total Salaries"}
                        label={{ position: 'top', fill: '#666', fontSize: 10, formatter: (value: number) => formatNumber(value) }}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Attendance Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600">{isRTL ? "حضور" : "Present"}</p>
                        <p className="text-2xl font-bold text-green-800">{formatNumber(overviewStats.presentCount)}</p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-red-600">{isRTL ? "غياب" : "Absent"}</p>
                        <p className="text-2xl font-bold text-red-800">{formatNumber(overviewStats.absentCount)}</p>
                      </div>
                      <XCircle className="w-8 h-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-yellow-600">{isRTL ? "تأخير" : "Late"}</p>
                        <p className="text-2xl font-bold text-yellow-800">{formatNumber(overviewStats.lateCount)}</p>
                      </div>
                      <AlertCircle className="w-8 h-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ==================== DATA QUALITY TAB ==================== */}
            <TabsContent value="data-quality" className="space-y-4" data-testid="tab-content-data-quality">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className={`${dataQualityMetrics.qualityScore >= 80 ? "bg-green-50 border-green-200" : dataQualityMetrics.qualityScore >= 60 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className={`text-4xl font-bold ${dataQualityMetrics.qualityScore >= 80 ? "text-green-700" : dataQualityMetrics.qualityScore >= 60 ? "text-yellow-700" : "text-red-700"}`}>
                        {dataQualityMetrics.qualityScore}%
                      </p>
                      <p className="text-sm text-gray-600">{isRTL ? "مؤشر جودة البيانات" : "Data Quality Index"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-orange-700">{dataQualityMetrics.employeesWithMissingAttendance.length}</p>
                      <p className="text-sm text-orange-600">{isRTL ? "حضور ناقص" : "Missing Attendance"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-700">{dataQualityMetrics.employeesWithMissingSalary.length}</p>
                      <p className="text-sm text-red-600">{isRTL ? "رواتب غير مدخلة" : "Missing Salaries"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-purple-700">{dataQualityMetrics.employeesWithAnomalies.length}</p>
                      <p className="text-sm text-purple-600">{isRTL ? "قيم غير منطقية" : "Anomalies"}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-missing-attendance">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-700">
                      <AlertCircle className="w-5 h-5" />
                      {isRTL ? "موظفين بحضور ناقص" : "Employees with Missing Attendance"}
                    </CardTitle>
                    <CardDescription>{isRTL ? "موظفين لديهم أكثر من 5 أيام حضور مفقودة" : "Employees with more than 5 missing attendance days"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dataQualityMetrics.employeesWithMissingAttendance.length === 0 ? (
                      <div className="text-center py-8 text-green-600">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                        {isRTL ? "جميع سجلات الحضور مكتملة" : "All attendance records are complete"}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {dataQualityMetrics.employeesWithMissingAttendance.map(({ emp, missingDays, percentage }) => (
                          <div key={emp.id} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                            <div>
                              <p className="font-medium text-sm">{emp.employeeName}</p>
                              <p className="text-xs text-gray-500">{getBranchName(emp.branchId)}</p>
                            </div>
                            <Badge className="bg-orange-100 text-orange-800">{isRTL ? `${missingDays} يوم (${percentage}%)` : `${missingDays} days (${percentage}%)`}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-anomalies">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700">
                      <XCircle className="w-5 h-5" />
                      {isRTL ? "قيم غير منطقية" : "Anomalies"}
                    </CardTitle>
                    <CardDescription>{isRTL ? "بيانات تحتاج مراجعة وتصحيح" : "Data that needs review and correction"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dataQualityMetrics.employeesWithAnomalies.length === 0 ? (
                      <div className="text-center py-8 text-green-600">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                        {isRTL ? "لا توجد قيم غير منطقية" : "No anomalies found"}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {dataQualityMetrics.employeesWithAnomalies.map((item, index) => (
                          <div key={index} className={`flex items-center justify-between p-2 rounded ${item.severity === "high" ? "bg-red-50" : item.severity === "medium" ? "bg-yellow-50" : "bg-gray-50"}`}>
                            <div>
                              <p className="font-medium text-sm">{item.emp.employeeName}</p>
                              <p className="text-xs text-gray-500">{item.issue}</p>
                            </div>
                            <Badge className={`${item.severity === "high" ? "bg-red-100 text-red-800" : item.severity === "medium" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800"}`}>
                              {item.severity === "high" ? (isRTL ? "عالي" : "High") : item.severity === "medium" ? (isRTL ? "متوسط" : "Medium") : (isRTL ? "منخفض" : "Low")}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ==================== COMPLIANCE TAB ==================== */}
            <TabsContent value="compliance" className="space-y-4" data-testid="tab-content-compliance">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className={`${complianceMetrics.saudizationStatus === "green" ? "bg-green-50 border-green-200" : complianceMetrics.saudizationStatus === "yellow" ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className={`text-4xl font-bold ${complianceMetrics.saudizationStatus === "green" ? "text-green-700" : complianceMetrics.saudizationStatus === "yellow" ? "text-yellow-700" : "text-red-700"}`}>
                        {complianceMetrics.saudizationRate}%
                      </p>
                      <p className="text-sm text-gray-600">{isRTL ? "نسبة السعودة" : "Saudization Rate"}</p>
                      <p className="text-xs text-gray-500">{isRTL ? `المطلوب: ${complianceMetrics.requiredSaudization}%` : `Required: ${complianceMetrics.requiredSaudization}%`}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-700">{formatCurrency(complianceMetrics.totalGosi, isRTL)}</p>
                      <p className="text-sm text-blue-600">{isRTL ? "إجمالي التأمينات" : "Total Insurance"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-teal-50 border-teal-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-teal-700">{complianceMetrics.saudiEmployees}</p>
                      <p className="text-sm text-teal-600">{isRTL ? "موظفين سعوديين" : "Saudi Employees"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className={`${complianceMetrics.criticalExpiries > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className={`text-3xl font-bold ${complianceMetrics.criticalExpiries > 0 ? "text-red-700" : "text-green-700"}`}>{complianceMetrics.expiringContracts.length}</p>
                      <p className={`text-sm ${complianceMetrics.criticalExpiries > 0 ? "text-red-600" : "text-green-600"}`}>{isRTL ? "وثائق تنتهي قريباً" : "Expiring Documents"}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-gosi-report">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      {isRTL ? "تقرير التأمينات الاجتماعية (GOSI)" : "Social Insurance Report (GOSI)"}
                    </CardTitle>
                    <CardDescription>{isRTL ? "حصة الموظف 9.75% + حصة صاحب العمل 11.75%" : "Employee share 9.75% + Employer share 11.75%"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-700">{formatCurrency(complianceMetrics.totalGosiEmployee, isRTL)}</p>
                          <p className="text-xs text-blue-600">{isRTL ? "حصة الموظف (9.75%)" : "Employee Share (9.75%)"}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-700">{formatCurrency(complianceMetrics.totalGosiEmployer, isRTL)}</p>
                          <p className="text-xs text-blue-600">{isRTL ? "حصة صاحب العمل (11.75%)" : "Employer Share (11.75%)"}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-800">{formatCurrency(complianceMetrics.totalGosi, isRTL)}</p>
                          <p className="text-xs text-blue-600">{isRTL ? "الإجمالي" : "Total"}</p>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto overflow-x-auto -mx-2 sm:mx-0">
                        <Table className="min-w-[400px]">
                          <TableHeader>
                            <TableRow className="text-[10px] sm:text-xs">
                              <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الموظف" : "Employee"}</TableHead>
                              <TableHead className="hidden md:table-cell text-center">{isRTL ? "الراتب الأساسي" : "Base Salary"}</TableHead>
                              <TableHead className="text-center">{isRTL ? "حصة الموظف" : "Employee Share"}</TableHead>
                              <TableHead className="text-center">{isRTL ? "حصة صاحب العمل" : "Employer Share"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {complianceMetrics.gosiReport.slice(0, 10).map(row => (
                              <TableRow key={row.emp.id} className="text-xs sm:text-sm">
                                <TableCell className={isRTL ? "text-right" : "text-left"}>{row.emp.employeeName}</TableCell>
                                <TableCell className="hidden md:table-cell text-center">{formatCurrency(row.baseSalary, isRTL)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(row.employeeContribution, isRTL)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(row.employerContribution, isRTL)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-expiring-documents">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-red-600" />
                      {isRTL ? "وثائق تنتهي خلال 60 يوم" : "Documents Expiring Within 60 Days"}
                    </CardTitle>
                    <CardDescription>{isRTL ? "إقامات وجوازات تحتاج تجديد" : "Residencies and passports needing renewal"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {complianceMetrics.expiringContracts.length === 0 ? (
                      <div className="text-center py-8 text-green-600">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                        {isRTL ? "لا توجد وثائق تنتهي قريباً" : "No documents expiring soon"}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {complianceMetrics.expiringContracts.map((item, index) => (
                          <div key={index} className={`flex items-center justify-between p-2 rounded ${item.daysLeft <= 30 ? "bg-red-50" : "bg-yellow-50"}`}>
                            <div>
                              <p className="font-medium text-sm">{item.emp.employeeName}</p>
                              <p className="text-xs text-gray-500">
                                {isRTL 
                                  ? `${item.type === "iqama" ? "إقامة" : item.type === "passport" ? "جواز" : "عقد"} - ينتهي: ${formatDate(item.expiryDate)}`
                                  : `${item.type === "iqama" ? "Iqama" : item.type === "passport" ? "Passport" : "Contract"} - Expires: ${formatDate(item.expiryDate)}`
                                }
                              </p>
                            </div>
                            <Badge className={`${item.daysLeft <= 30 ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                              {isRTL ? `${item.daysLeft} يوم` : `${item.daysLeft} days`}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* تكاليف غير السعوديين */}
              <Card data-testid="card-non-saudi-costs">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-500" />
                    {isRTL ? "تكاليف الموظفين غير السعوديين على صاحب العمل" : "Non-Saudi Employee Costs for Employer"}
                  </CardTitle>
                  <CardDescription>
                    {isRTL 
                      ? "تأمين إصابات العمل (2%) + رسوم رخصة العمل (800 ريال/شهر) + المقابل المالي (800 ريال/شهر) + رسوم الإقامة (54 ريال/شهر)" 
                      : "Work injury insurance (2%) + Work permit (800 SAR/mo) + Expat levy (800 SAR/mo) + Residency (54 SAR/mo)"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* ملخص التكاليف */}
                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3 mb-4 sm:mb-6">
                    <div className="text-center p-2 sm:p-3 bg-orange-50 rounded-lg">
                      <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600">{formatNumber(complianceMetrics.totalNonSaudiCount)}</p>
                      <p className="text-[10px] sm:text-xs text-gray-600">{isRTL ? "غير سعودي" : "Non-Saudi"}</p>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg">
                      <p className="text-base sm:text-lg md:text-xl font-bold text-blue-600">{formatCurrency(complianceMetrics.totalNonSaudiInsurance, isRTL)}</p>
                      <p className="text-[10px] sm:text-xs text-gray-600">{isRTL ? "تأمين 2%" : "Insurance 2%"}</p>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-purple-50 rounded-lg">
                      <p className="text-base sm:text-lg md:text-xl font-bold text-purple-600">{formatCurrency(complianceMetrics.totalNonSaudiWorkPermit, isRTL)}</p>
                      <p className="text-[10px] sm:text-xs text-gray-600">{isRTL ? "رخصة العمل" : "Work Permit"}</p>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-amber-50 rounded-lg">
                      <p className="text-base sm:text-lg md:text-xl font-bold text-amber-600">{formatCurrency(complianceMetrics.totalNonSaudiExpatLevy, isRTL)}</p>
                      <p className="text-[10px] sm:text-xs text-gray-600">{isRTL ? "المقابل المالي" : "Expat Levy"}</p>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-teal-50 rounded-lg">
                      <p className="text-base sm:text-lg md:text-xl font-bold text-teal-600">{formatCurrency(complianceMetrics.totalNonSaudiIqama, isRTL)}</p>
                      <p className="text-[10px] sm:text-xs text-gray-600">{isRTL ? "رسوم الإقامة" : "Residency Fees"}</p>
                    </div>
                    <div className="text-center p-2 sm:p-3 bg-red-50 rounded-lg col-span-2 lg:col-span-1">
                      <p className="text-base sm:text-lg md:text-xl font-bold text-red-600">{formatCurrency(complianceMetrics.totalNonSaudiMonthlyCost, isRTL)}</p>
                      <p className="text-xs text-gray-600">{isRTL ? "إجمالي شهري" : "Monthly Total"}</p>
                    </div>
                  </div>

                  {/* جدول التفاصيل حسب الجنسية */}
                  {complianceMetrics.nonSaudiCostAnalysis.length > 0 && (
                    <div className="overflow-x-auto">
                      <Table className="w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className={`${isRTL ? "text-right" : "text-left"} min-w-[80px]`}>{isRTL ? "الجنسية" : "Nationality"}</TableHead>
                            <TableHead className="text-center min-w-[50px]">{isRTL ? "العدد" : "Count"}</TableHead>
                            <TableHead className="text-center min-w-[90px]">{isRTL ? "الراتب+السكن" : "Salary+Housing"}</TableHead>
                            <TableHead className="text-center min-w-[70px]">{isRTL ? "تأمين 2%" : "Ins. 2%"}</TableHead>
                            <TableHead className="text-center min-w-[70px]">{isRTL ? "رخصة العمل" : "Work Permit"}</TableHead>
                            <TableHead className="text-center min-w-[70px]">{isRTL ? "المقابل المالي" : "Expat Levy"}</TableHead>
                            <TableHead className="text-center min-w-[60px]">{isRTL ? "الإقامة" : "Residency"}</TableHead>
                            <TableHead className="text-center min-w-[90px]">{isRTL ? "إجمالي التكلفة" : "Total Cost"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {complianceMetrics.nonSaudiCostAnalysis.map((nat, i) => (
                            <TableRow key={i}>
                              <TableCell className={`font-medium ${isRTL ? "text-right" : "text-left"}`}>{nat.nationality}</TableCell>
                              <TableCell className="text-center">{formatNumber(nat.count)}</TableCell>
                              <TableCell className="text-center">{formatCurrency(nat.insurableSalary, isRTL)}</TableCell>
                              <TableCell className="text-center text-blue-600">{formatCurrency(nat.insuranceCost, isRTL)}</TableCell>
                              <TableCell className="text-center text-purple-600">{formatCurrency(nat.workPermitCost, isRTL)}</TableCell>
                              <TableCell className="text-center text-amber-600">{formatCurrency(nat.expatLevyCost, isRTL)}</TableCell>
                              <TableCell className="text-center text-teal-600">{formatCurrency(nat.iqamaCost, isRTL)}</TableCell>
                              <TableCell className="text-center font-bold text-red-600">{formatCurrency(nat.totalMonthlyCost, isRTL)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* مقارنة التكاليف */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-bold mb-3 text-gray-700">{isRTL ? "مقارنة تكاليف صاحب العمل الشهرية" : "Monthly Employer Cost Comparison"}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-green-100 rounded-lg text-center">
                        <p className="text-lg font-bold text-green-700">{formatCurrency(complianceMetrics.totalEmployerCostSaudi, isRTL)}</p>
                        <p className="text-xs text-green-600">{isRTL ? "السعوديين (11.75%)" : "Saudis (11.75%)"}</p>
                        <p className="text-xs text-gray-500">{isRTL ? `${complianceMetrics.saudiEmployees} موظف` : `${complianceMetrics.saudiEmployees} employees`}</p>
                      </div>
                      <div className="p-3 bg-orange-100 rounded-lg text-center">
                        <p className="text-lg font-bold text-orange-700">{formatCurrency(complianceMetrics.totalEmployerCostNonSaudi, isRTL)}</p>
                        <p className="text-xs text-orange-600">{isRTL ? "غير السعوديين (2%+رسوم)" : "Non-Saudis (2%+fees)"}</p>
                        <p className="text-xs text-gray-500">{isRTL ? `${complianceMetrics.totalNonSaudiCount} موظف` : `${complianceMetrics.totalNonSaudiCount} employees`}</p>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-lg text-center">
                        <p className="text-lg font-bold text-blue-700">{formatCurrency(complianceMetrics.totalEmployerCost, isRTL)}</p>
                        <p className="text-xs text-blue-600">{isRTL ? "الإجمالي الشهري" : "Monthly Total"}</p>
                        <p className="text-xs text-gray-500">{isRTL ? `${complianceMetrics.saudiEmployees + complianceMetrics.totalNonSaudiCount} موظف` : `${complianceMetrics.saudiEmployees + complianceMetrics.totalNonSaudiCount} employees`}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {complianceMetrics.saudizationGap > 0 && (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <AlertCircle className="w-8 h-8 text-red-600" />
                      <div>
                        <p className="font-bold text-red-800">{isRTL ? "تحذير: نسبة السعودة أقل من المطلوب" : "Warning: Saudization rate is below required"}</p>
                        <p className="text-sm text-red-600">
                          {isRTL 
                            ? `يجب توظيف ${Math.ceil((complianceMetrics.requiredSaudization / 100 * (complianceMetrics.saudiEmployees + complianceMetrics.nonSaudiEmployees)) - complianceMetrics.saudiEmployees)} موظف سعودي إضافي للوصول للنسبة المطلوبة (${complianceMetrics.requiredSaudization}%)`
                            : `Need to hire ${Math.ceil((complianceMetrics.requiredSaudization / 100 * (complianceMetrics.saudiEmployees + complianceMetrics.nonSaudiEmployees)) - complianceMetrics.saudiEmployees)} additional Saudi employees to reach required rate (${complianceMetrics.requiredSaudization}%)`
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* تحذيرات الشهادات الصحية */}
              <Card data-testid="card-health-warnings">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    {isRTL ? "تحذيرات الشهادات الصحية" : "Health Certificate Warnings"}
                  </CardTitle>
                  <CardDescription>{isRTL ? "الشهادات المنتهية أو القريبة من الانتهاء" : "Expired or soon-to-expire certificates"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className={`text-center p-3 rounded-lg ${healthCertificateAnalysis.expired > 0 ? "bg-red-50" : "bg-green-50"}`}>
                      <p className={`text-2xl font-bold ${healthCertificateAnalysis.expired > 0 ? "text-red-600" : "text-green-600"}`}>{formatNumber(healthCertificateAnalysis.expired)}</p>
                      <p className="text-xs text-gray-600">{isRTL ? "منتهية" : "Expired"}</p>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${healthCertificateAnalysis.expiringWithin30.length > 0 ? "bg-orange-50" : "bg-green-50"}`}>
                      <p className={`text-2xl font-bold ${healthCertificateAnalysis.expiringWithin30.length > 0 ? "text-orange-600" : "text-green-600"}`}>{formatNumber(healthCertificateAnalysis.expiringWithin30.length)}</p>
                      <p className="text-xs text-gray-600">{isRTL ? "تنتهي خلال 30 يوم" : "Expiring in 30 days"}</p>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${healthCertificateAnalysis.none > 0 ? "bg-yellow-50" : "bg-green-50"}`}>
                      <p className={`text-2xl font-bold ${healthCertificateAnalysis.none > 0 ? "text-yellow-600" : "text-green-600"}`}>{formatNumber(healthCertificateAnalysis.none)}</p>
                      <p className="text-xs text-gray-600">{isRTL ? "بدون شهادة" : "No Certificate"}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-50">
                      <p className="text-2xl font-bold text-green-600">{healthCertificateAnalysis.complianceRate}%</p>
                      <p className="text-xs text-gray-600">{isRTL ? "نسبة الامتثال" : "Compliance Rate"}</p>
                    </div>
                  </div>
                  {(healthCertificateAnalysis.expired > 0 || healthCertificateAnalysis.expiringWithin30.length > 0) && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {healthCertificateAnalysis.allExpiring.slice(0, 10).map((item, i) => (
                        <div key={i} className={`flex items-center justify-between p-2 rounded ${item.daysLeft <= 0 ? "bg-red-50" : item.daysLeft <= 30 ? "bg-orange-50" : "bg-yellow-50"}`}>
                          <div>
                            <p className="font-medium text-sm">{item.emp.employeeName}</p>
                            <p className="text-xs text-gray-500">{branches?.find(b => b.id === item.emp.branchId)?.name || item.emp.branchId}</p>
                          </div>
                          <Badge className={`${item.daysLeft <= 0 ? "bg-red-100 text-red-800" : item.daysLeft <= 30 ? "bg-orange-100 text-orange-800" : "bg-yellow-100 text-yellow-800"}`}>
                            {item.daysLeft <= 0 ? (isRTL ? "منتهية" : "Expired") : (isRTL ? `${item.daysLeft} يوم` : `${item.daysLeft} days`)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* نسبة السعودة لكل فرع */}
              <Card data-testid="card-branch-saudization">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-teal-500" />
                    {isRTL ? "نسبة السعودة حسب الفرع" : "Saudization Rate by Branch"}
                  </CardTitle>
                  <CardDescription>{isRTL ? `المطلوب: ${complianceMetrics.requiredSaudization}% لكل فرع` : `Required: ${complianceMetrics.requiredSaudization}% per branch`}</CardDescription>
                </CardHeader>
                <CardContent>
                  {complianceMetrics.branchSaudization.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">{isRTL ? "لا توجد بيانات" : "No data available"}</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {complianceMetrics.branchSaudization.map(branch => (
                        <div key={branch.branchId} className={`p-4 rounded-lg border-2 ${branch.status === "green" ? "bg-green-50 border-green-200" : branch.status === "yellow" ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-bold text-gray-800">{branch.branchName}</h4>
                            <Badge className={`${branch.status === "green" ? "bg-green-100 text-green-800" : branch.status === "yellow" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
                              {branch.rate}%
                            </Badge>
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">{isRTL ? "إجمالي الموظفين:" : "Total Employees:"}</span>
                              <span className="font-medium">{formatNumber(branch.total)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-green-600">{isRTL ? "سعوديين:" : "Saudis:"}</span>
                              <span className="font-medium text-green-700">{formatNumber(branch.saudis)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-orange-600">{isRTL ? "غير سعوديين:" : "Non-Saudis:"}</span>
                              <span className="font-medium text-orange-700">{formatNumber(branch.nonSaudis)}</span>
                            </div>
                            {branch.neededSaudis > 0 && (
                              <div className="flex justify-between pt-1 border-t">
                                <span className="text-red-600">{isRTL ? "المطلوب توظيفهم:" : "Needed to hire:"}</span>
                                <span className="font-bold text-red-700">{formatNumber(branch.neededSaudis)}</span>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${branch.status === "green" ? "bg-green-500" : branch.status === "yellow" ? "bg-yellow-500" : "bg-red-500"}`}
                              style={{ width: `${Math.min(100, branch.rate)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* تقرير التكاليف الحكومية الشامل */}
              <Card data-testid="card-government-costs">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-500" />
                    {isRTL ? "تقرير التكاليف الحكومية الشامل" : "Comprehensive Government Costs Report"}
                  </CardTitle>
                  <CardDescription>{isRTL ? "جميع الرسوم والتكاليف الحكومية الشهرية والسنوية" : "All monthly and annual government fees and costs"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* التأمينات الاجتماعية */}
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        {isRTL ? "التأمينات الاجتماعية (شهري)" : "Social Insurance (Monthly)"}
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>{isRTL ? "حصة الموظف السعودي (9.75%):" : "Saudi Employee Share (9.75%):"}</span>
                          <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.gosiSaudiEmployee, isRTL)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{isRTL ? "حصة صاحب العمل للسعوديين (11.75%):" : "Employer Share for Saudis (11.75%):"}</span>
                          <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.gosiSaudiEmployer, isRTL)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{isRTL ? "تأمين إصابات العمل لغير السعوديين (2%):" : "Work Injury Insurance for Non-Saudis (2%):"}</span>
                          <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.gosiNonSaudiEmployer, isRTL)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t font-bold text-blue-800">
                          <span>{isRTL ? "إجمالي التأمينات (صاحب العمل):" : "Total Insurance (Employer):"}</span>
                          <span>{formatCurrency(complianceMetrics.governmentCosts.totalGosiEmployerOnly, isRTL)}</span>
                        </div>
                      </div>
                    </div>

                    {/* رسوم العمالة */}
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {isRTL ? "رسوم العمالة (شهري)" : "Labor Fees (Monthly)"}
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>{isRTL ? "رخص العمل (66 ريال/موظف):" : "Work Permits (66 SAR/employee):"}</span>
                          <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.workPermitTotal, isRTL)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{isRTL ? "رسوم الإقامة (54 ريال/موظف):" : "Residency Fees (54 SAR/employee):"}</span>
                          <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.iqamaFeesTotal, isRTL)}</span>
                        </div>
                        {complianceMetrics.governmentCosts.excessWorkers > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>{isRTL ? `المقابل المالي (${complianceMetrics.governmentCosts.excessWorkers} عامل فائض):` : `Financial Compensation (${complianceMetrics.governmentCosts.excessWorkers} excess workers):`}</span>
                            <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.muqabilMaliMonthly, isRTL)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t font-bold text-purple-800">
                          <span>{isRTL ? "إجمالي رسوم العمالة:" : "Total Labor Fees:"}</span>
                          <span>{formatCurrency(complianceMetrics.governmentCosts.laborFeesTotal + complianceMetrics.governmentCosts.muqabilMaliMonthly, isRTL)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* الإجمالي */}
                  <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-2xl font-bold text-gray-800">{formatCurrency(complianceMetrics.governmentCosts.totalMonthlyEmployerCost, isRTL)}</p>
                        <p className="text-sm text-gray-600">{isRTL ? "إجمالي تكاليف صاحب العمل الشهرية" : "Total Monthly Employer Costs"}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-2xl font-bold text-gray-800">{formatCurrency(complianceMetrics.governmentCosts.totalYearlyEmployerCost, isRTL)}</p>
                        <p className="text-sm text-gray-600">{isRTL ? "إجمالي تكاليف صاحب العمل السنوية" : "Total Annual Employer Costs"}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* حالة وثائق الموظفين */}
              <Card data-testid="card-document-status">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    {isRTL ? "حالة وثائق الموظفين" : "Employee Document Status"}
                  </CardTitle>
                  <CardDescription>{isRTL ? "نسبة اكتمال ملفات الموظفين" : "Employee file completion rate"}</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* ملخص الحالة */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{formatNumber(complianceMetrics.documentStatusSummary.complete)}</p>
                      <p className="text-xs text-gray-600">{isRTL ? "مكتمل" : "Complete"}</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{formatNumber(complianceMetrics.documentStatusSummary.incomplete)}</p>
                      <p className="text-xs text-gray-600">{isRTL ? "ناقص" : "Incomplete"}</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{formatNumber(complianceMetrics.documentStatusSummary.expired)}</p>
                      <p className="text-xs text-gray-600">{isRTL ? "منتهي" : "Expired"}</p>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${complianceMetrics.documentStatusSummary.completionRate >= 80 ? "bg-green-50" : complianceMetrics.documentStatusSummary.completionRate >= 60 ? "bg-yellow-50" : "bg-red-50"}`}>
                      <p className={`text-2xl font-bold ${complianceMetrics.documentStatusSummary.completionRate >= 80 ? "text-green-600" : complianceMetrics.documentStatusSummary.completionRate >= 60 ? "text-yellow-600" : "text-red-600"}`}>{complianceMetrics.documentStatusSummary.completionRate}%</p>
                      <p className="text-xs text-gray-600">{isRTL ? "نسبة الاكتمال" : "Completion Rate"}</p>
                    </div>
                  </div>

                  {/* قائمة الموظفين بمشاكل */}
                  {complianceMetrics.employeeDocumentStatus.filter(e => e.status !== "complete").length > 0 && (
                    <div className="overflow-x-auto">
                      <Table className="table-fixed w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className={`${isRTL ? "text-right" : "text-left"} w-[150px]`}>{isRTL ? "الموظف" : "Employee"}</TableHead>
                            <TableHead className="text-center w-[100px]">{isRTL ? "الفرع" : "Branch"}</TableHead>
                            <TableHead className="text-center w-[80px]">{isRTL ? "الحالة" : "Status"}</TableHead>
                            <TableHead className={`${isRTL ? "text-right" : "text-left"} w-[250px]`}>{isRTL ? "المشاكل" : "Issues"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {complianceMetrics.employeeDocumentStatus.filter(e => e.status !== "complete").slice(0, 15).map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className={`font-medium ${isRTL ? "text-right" : "text-left"}`}>{item.emp.employeeName}</TableCell>
                              <TableCell className="text-center text-sm">{branches?.find(b => b.id === item.emp.branchId)?.name || item.emp.branchId}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`${item.status === "expired" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                                  {item.status === "expired" ? (isRTL ? "منتهي" : "Expired") : (isRTL ? "ناقص" : "Incomplete")}
                                </Badge>
                              </TableCell>
                              <TableCell className={`${isRTL ? "text-right" : "text-left"} text-xs text-gray-600`}>{item.issues.slice(0, 3).join(" • ")}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* أزرار تصدير التقارير */}
              <Card data-testid="card-export-reports">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-green-500" />
                    {isRTL ? "تصدير تقارير الجهات الحكومية" : "Export Government Reports"}
                  </CardTitle>
                  <CardDescription>{isRTL ? "تقارير جاهزة للتقديم للجهات الحكومية" : "Reports ready for government submission"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2"
                      onClick={async () => {
                        const XLSX = await import("xlsx");
                        const data = complianceMetrics.gosiReport.map(r => ({
                          [isRTL ? "اسم الموظف" : "Employee Name"]: r.emp.employeeName,
                          [isRTL ? "رقم الهوية" : "ID Number"]: r.emp.iqamaNumber || "",
                          [isRTL ? "الراتب الأساسي" : "Base Salary"]: r.baseSalary,
                          [isRTL ? "حصة الموظف (9.75%)" : "Employee Share (9.75%)"]: r.employeeContribution,
                          [isRTL ? "حصة صاحب العمل (11.75%)" : "Employer Share (11.75%)"]: r.employerContribution,
                          [isRTL ? "الإجمالي" : "Total"]: r.totalContribution,
                        }));
                        const ws = XLSX.utils.json_to_sheet(data);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, isRTL ? "تقرير التأمينات" : "GOSI Report");
                        XLSX.writeFile(wb, isRTL ? `تقرير_التأمينات_${new Date().toISOString().split('T')[0]}.xlsx` : `GOSI_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
                      }}
                    >
                      <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                      <span className="font-medium">{isRTL ? "تقرير التأمينات الاجتماعية" : "Social Insurance Report"}</span>
                      <span className="text-xs text-gray-500">Excel</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2"
                      onClick={async () => {
                        const XLSX = await import("xlsx");
                        const data = filteredEmployees.filter(e => e.nationality !== "سعودي" && e.status === "active").map(emp => ({
                          [isRTL ? "اسم الموظف" : "Employee Name"]: emp.employeeName,
                          [isRTL ? "الجنسية" : "Nationality"]: emp.nationality,
                          [isRTL ? "رقم الإقامة" : "Iqama Number"]: emp.iqamaNumber || "",
                          [isRTL ? "تاريخ انتهاء الإقامة" : "Iqama Expiry"]: emp.iqamaExpiry || "",
                          [isRTL ? "رقم الجواز" : "Passport Number"]: emp.passportNumber || "",
                          [isRTL ? "المسمى الوظيفي" : "Job Title"]: emp.jobTitle || "",
                          [isRTL ? "الفرع" : "Branch"]: branches?.find(b => b.id === emp.branchId)?.name || emp.branchId,
                        }));
                        const ws = XLSX.utils.json_to_sheet(data);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, isRTL ? "العمالة الوافدة" : "Expat Workers");
                        XLSX.writeFile(wb, isRTL ? `تقرير_مكتب_العمل_${new Date().toISOString().split('T')[0]}.xlsx` : `Labor_Office_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
                      }}
                    >
                      <FileSpreadsheet className="w-8 h-8 text-purple-600" />
                      <span className="font-medium">{isRTL ? "تقرير مكتب العمل" : "Labor Office Report"}</span>
                      <span className="text-xs text-gray-500">Excel</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2"
                      onClick={async () => {
                        const XLSX = await import("xlsx");
                        const data = complianceMetrics.branchSaudization.map(b => ({
                          [isRTL ? "الفرع" : "Branch"]: b.branchName,
                          [isRTL ? "إجمالي الموظفين" : "Total Employees"]: b.total,
                          [isRTL ? "السعوديين" : "Saudis"]: b.saudis,
                          [isRTL ? "غير السعوديين" : "Non-Saudis"]: b.nonSaudis,
                          [isRTL ? "نسبة السعودة" : "Saudization Rate"]: `${b.rate}%`,
                          [isRTL ? "الحالة" : "Status"]: b.status === "green" ? (isRTL ? "ملتزم" : "Compliant") : b.status === "yellow" ? (isRTL ? "قريب" : "Near") : (isRTL ? "غير ملتزم" : "Non-Compliant"),
                          [isRTL ? "المطلوب توظيفهم" : "Needed to Hire"]: b.neededSaudis,
                        }));
                        const ws = XLSX.utils.json_to_sheet(data);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, isRTL ? "نسب السعودة" : "Saudization Rates");
                        XLSX.writeFile(wb, isRTL ? `تقرير_السعودة_${new Date().toISOString().split('T')[0]}.xlsx` : `Saudization_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
                      }}
                    >
                      <FileSpreadsheet className="w-8 h-8 text-teal-600" />
                      <span className="font-medium">{isRTL ? "تقرير نسب السعودة" : "Saudization Report"}</span>
                      <span className="text-xs text-gray-500">Excel</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ==================== TURNOVER TAB ==================== */}
            <TabsContent value="turnover" className="space-y-4" data-testid="tab-content-turnover">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className={`${turnoverAnalysis.turnoverRate <= 10 ? "bg-green-50 border-green-200" : turnoverAnalysis.turnoverRate <= 20 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className={`text-4xl font-bold ${turnoverAnalysis.turnoverRate <= 10 ? "text-green-700" : turnoverAnalysis.turnoverRate <= 20 ? "text-yellow-700" : "text-red-700"}`}>
                        {turnoverAnalysis.turnoverRate}%
                      </p>
                      <p className="text-sm text-gray-600">{isRTL ? "نسبة الدوران" : "Turnover Rate"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-700">{formatNumber(turnoverAnalysis.totalActive)}</p>
                      <p className="text-sm text-green-600">{isRTL ? "نشط" : "Active"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-700">{formatNumber(turnoverAnalysis.totalTerminated)}</p>
                      <p className="text-sm text-red-600">{isRTL ? "منتهي" : "Terminated"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-yellow-700">{formatNumber(turnoverAnalysis.totalOnLeave)}</p>
                      <p className="text-sm text-yellow-600">{isRTL ? "في إجازة" : "On Leave"}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-turnover-by-branch">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      {isRTL ? "الدوران حسب الفرع" : "Turnover by Branch"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {turnoverAnalysis.turnoverByBranch.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">{isRTL ? "لا توجد بيانات" : "No data available"}</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={turnoverAnalysis.turnoverByBranch} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="branchName" type="category" width={100} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="active" fill="#10b981" name={isRTL ? "نشط" : "Active"} />
                          <Bar dataKey="terminated" fill="#ef4444" name={isRTL ? "منتهي" : "Terminated"} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-turnover-by-job">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {isRTL ? "أعلى وظائف في الدوران" : "Top Turnover Jobs"}
                    </CardTitle>
                    <CardDescription>{isRTL ? "الوظائف ذات أعلى نسبة ترك عمل" : "Jobs with highest turnover rates"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {turnoverAnalysis.turnoverByJob.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">{isRTL ? "لا توجد بيانات" : "No data available"}</div>
                    ) : (
                      <div className="space-y-3">
                        {turnoverAnalysis.turnoverByJob.map((job, index) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{job.jobTitle}</span>
                              <Badge className={`${job.rate >= 30 ? "bg-red-100 text-red-800" : job.rate >= 15 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                                {job.rate}%
                              </Badge>
                            </div>
                            <div className="flex gap-4 text-xs text-gray-500">
                              <span>{isRTL ? "نشط" : "Active"}: {job.active}</span>
                              <span>{isRTL ? "منتهي" : "Terminated"}: {job.terminated}</span>
                            </div>
                            <div className="mt-2 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${job.rate >= 30 ? "bg-red-500" : job.rate >= 15 ? "bg-yellow-500" : "bg-green-500"}`}
                                style={{ width: `${Math.min(100, job.rate)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="branch-comparison" className="space-y-4" data-testid="tab-content-branch-comparison">
              <Card data-testid="card-branch-comparison-table">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        {isRTL ? "مقارنة شاملة بين الفروع" : "Comprehensive Branch Comparison"}
                      </CardTitle>
                      <CardDescription>{isRTL ? `مقارنة مؤشرات الأداء والموظفين والرواتب عبر جميع الفروع لشهر ${selectedMonth}` : `Performance, employee and salary comparison across all branches for ${selectedMonth}`}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportBranchComparisonToExcel} data-testid="button-export-branch-excel">
                        <FileSpreadsheet className="w-4 h-4 ml-1" />
                        Excel
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportBranchComparisonToPDF} data-testid="button-export-branch-pdf">
                        <FileText className="w-4 h-4 ml-1" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">{isRTL ? "الفرع" : "Branch"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "الموظفين" : "Employees"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "السعوديين" : "Saudis"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "نسبة السعودة" : "Saudization %"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "إجمالي الرواتب" : "Total Salaries"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "متوسط الراتب" : "Avg Salary"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "نسبة الحضور" : "Attendance %"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "الغياب" : "Absences"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "ساعات العمل" : "Work Hours"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {branchComparisonData.map((branch) => (
                          <TableRow key={branch.branchId}>
                            <TableCell className="font-medium">{branch.branchName}</TableCell>
                            <TableCell className="text-center">{formatNumber(branch.employeeCount)}</TableCell>
                            <TableCell className="text-center">{formatNumber(branch.saudiCount)}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={branch.saudiPercentage >= 30 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                {branch.saudiPercentage}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{formatCurrency(branch.totalSalary, isRTL)}</TableCell>
                            <TableCell className="text-center">{formatCurrency(branch.avgSalary, isRTL)}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={branch.attendanceRate >= 80 ? "bg-green-100 text-green-800" : branch.attendanceRate >= 60 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                                {branch.attendanceRate}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-red-600">{formatNumber(branch.absentCount)}</TableCell>
                            <TableCell className="text-center">{formatNumber(branch.totalHours)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{isRTL ? "مقارنة عدد الموظفين" : "Employee Count Comparison"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="employeeCount" fill="#3b82f6" name={isRTL ? "إجمالي الموظفين" : "Total Employees"} />
                        <Bar dataKey="saudiCount" fill="#10b981" name={isRTL ? "السعوديين" : "Saudis"} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{isRTL ? "مقارنة نسب الحضور والغياب" : "Attendance & Absence Comparison"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="attendanceRate" fill="#10b981" name={isRTL ? "نسبة الحضور %" : "Attendance %"} />
                        <Bar dataKey="absentRate" fill="#ef4444" name={isRTL ? "نسبة الغياب %" : "Absence %"} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{isRTL ? "مقارنة متوسط الرواتب" : "Average Salary Comparison"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value), isRTL)} />
                        <Bar dataKey="avgSalary" fill="#f59e0b" name={isRTL ? "متوسط الراتب" : "Average Salary"} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{isRTL ? "مقارنة ساعات العمل" : "Work Hours Comparison"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="totalHours" fill="#8b5cf6" name={isRTL ? "إجمالي الساعات" : "Total Hours"} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="job-comparison" className="space-y-4" data-testid="tab-content-job-comparison">
              <Card data-testid="card-job-comparison">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        {isRTL ? "مقارنة الوظائف عبر الفروع" : "Job Comparison Across Branches"}
                      </CardTitle>
                      <CardDescription>{isRTL ? "تحليل فروقات الرواتب لنفس المسمى الوظيفي في فروع مختلفة (مرتبة حسب أكبر فرق)" : "Salary variance analysis for the same job title across different branches (sorted by largest variance)"}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportJobComparisonToExcel} data-testid="button-export-job-excel">
                        <FileSpreadsheet className="w-4 h-4 ml-1" />
                        Excel
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportJobComparisonToPDF} data-testid="button-export-job-pdf">
                        <FileText className="w-4 h-4 ml-1" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {jobComparisonData.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      {isRTL ? "لا توجد وظائف متكررة في أكثر من فرع للمقارنة" : "No jobs found in more than one branch for comparison"}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {jobComparisonData.slice(0, 10).map((job) => (
                        <Card key={job.jobTitle} className="border-amber-200">
                          <CardHeader className="py-3 bg-amber-50">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{job.jobTitle}</CardTitle>
                              <div className="flex items-center gap-4 text-sm">
                                <span>{isRTL ? "العدد الكلي" : "Total Count"}: <strong>{job.totalCount}</strong></span>
                                <span>{isRTL ? "المتوسط" : "Average"}: <strong>{formatCurrency(job.avgSalary, isRTL)}</strong></span>
                                <Badge className={job.salaryVariance > 1000 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                                  {isRTL ? "فرق" : "Variance"}: {formatCurrency(job.salaryVariance, isRTL)}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="py-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">{isRTL ? "الفرع" : "Branch"}</TableHead>
                                  <TableHead className="text-center">{isRTL ? "العدد" : "Count"}</TableHead>
                                  <TableHead className="text-center">{isRTL ? "متوسط الراتب" : "Avg Salary"}</TableHead>
                                  <TableHead className="text-center">{isRTL ? "أقل راتب" : "Min Salary"}</TableHead>
                                  <TableHead className="text-center">{isRTL ? "أعلى راتب" : "Max Salary"}</TableHead>
                                  <TableHead className="text-center">{isRTL ? "نسبة الحضور" : "Attendance %"}</TableHead>
                                  <TableHead className="text-center">{isRTL ? "الفرق عن المتوسط" : "Variance from Avg"}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {job.branches.map((branch) => {
                                  const diff = branch.avgSalary - job.avgSalary;
                                  return (
                                    <TableRow key={branch.branchName}>
                                      <TableCell className="font-medium">{branch.branchName}</TableCell>
                                      <TableCell className="text-center">{branch.count}</TableCell>
                                      <TableCell className="text-center font-bold">{formatCurrency(branch.avgSalary, isRTL)}</TableCell>
                                      <TableCell className="text-center text-gray-500">{formatCurrency(branch.minSalary, isRTL)}</TableCell>
                                      <TableCell className="text-center text-gray-500">{formatCurrency(branch.maxSalary, isRTL)}</TableCell>
                                      <TableCell className="text-center">
                                        <Badge className={branch.attendanceRate >= 80 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                                          {branch.attendanceRate}%
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <span className={diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-500"}>
                                          {diff > 0 ? "+" : ""}{formatCurrency(diff, isRTL)}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="space-y-4">
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={exportAttendanceToExcel} data-testid="button-export-attendance">
                  <FileSpreadsheet className="w-4 h-4 ml-2" />
                  {isRTL ? "تصدير Excel" : "Export Excel"}
                </Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>{isRTL ? "تقرير الحضور والغياب التفصيلي" : "Detailed Attendance Report"}</CardTitle>
                  <CardDescription>{isRTL ? `بيانات الحضور لشهر ${selectedMonth}` : `Attendance data for ${selectedMonth}`}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">{isRTL ? "م" : "#"}</TableHead>
                        <TableHead className="text-right">{isRTL ? "الموظف" : "Employee"}</TableHead>
                        <TableHead className="text-right">{isRTL ? "الفرع" : "Branch"}</TableHead>
                        <TableHead className="text-right">{isRTL ? "الوظيفة" : "Job Title"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الحضور" : "Present"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "الغياب" : "Absent"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "التأخير" : "Late"}</TableHead>
                        <TableHead className="text-center">{isRTL ? "نسبة الحضور" : "Attendance %"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp, index) => {
                        const attendance = attendanceByEmployee.get(emp.id) || { present: 0, absent: 0, late: 0, total: 0 };
                        const rate = attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0;
                        return (
                          <TableRow key={emp.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">{emp.employeeName}</TableCell>
                            <TableCell>{getBranchName(emp.branchId)}</TableCell>
                            <TableCell>{emp.jobTitle}</TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-green-100 text-green-800">{attendance.present}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-red-100 text-red-800">{attendance.absent}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-yellow-100 text-yellow-800">{attendance.late}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={rate >= 90 ? "bg-green-100 text-green-800" : rate >= 70 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}>
                                {rate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="salaries" className="space-y-6">
              {/* Salary KPI Cards */}
              {(() => {
                const salaryStats = filteredEmployees.reduce((acc, emp) => {
                  const housing = emp.housingAllowance || 0;
                  const transport = emp.transportAllowance || 0;
                  const food = emp.foodAllowance || 0;
                  const other = emp.otherAllowances || 0;
                  const storedIns = emp.socialInsuranceDeduction || 0;
                  const insurance = emp.nationality === "سعودي" 
                    ? (storedIns > 0 ? storedIns : Math.round((emp.salary || 0) * 0.0975))
                    : 0;
                  
                  acc.totalBasic += (emp.salary || 0);
                  acc.totalHousing += housing;
                  acc.totalTransport += transport;
                  acc.totalFood += food;
                  acc.totalOther += other;
                  acc.totalAllowances += housing + transport + food + other;
                  acc.totalInsurance += insurance;
                  acc.totalNet += (emp.totalSalary || 0);
                  acc.count++;
                  return acc;
                }, { totalBasic: 0, totalHousing: 0, totalTransport: 0, totalFood: 0, totalOther: 0, totalAllowances: 0, totalInsurance: 0, totalNet: 0, count: 0 });

                const avgSalary = salaryStats.count > 0 ? Math.round(salaryStats.totalNet / salaryStats.count) : 0;
                const costPerEmployee = salaryStats.count > 0 ? Math.round((salaryStats.totalBasic + salaryStats.totalAllowances) / salaryStats.count) : 0;

                // Salary distribution by branch
                const salaryByBranch = filteredEmployees.reduce((acc, emp) => {
                  const branchName = getBranchName(emp.branchId);
                  if (!acc[branchName]) {
                    acc[branchName] = { name: branchName, basic: 0, allowances: 0, insurance: 0, net: 0, count: 0 };
                  }
                  const housing = emp.housingAllowance || 0;
                  const transport = emp.transportAllowance || 0;
                  const food = emp.foodAllowance || 0;
                  const other = emp.otherAllowances || 0;
                  const storedIns = emp.socialInsuranceDeduction || 0;
                  const insurance = emp.nationality === "سعودي" 
                    ? (storedIns > 0 ? storedIns : Math.round((emp.salary || 0) * 0.0975))
                    : 0;
                  acc[branchName].basic += (emp.salary || 0);
                  acc[branchName].allowances += housing + transport + food + other;
                  acc[branchName].insurance += insurance;
                  acc[branchName].net += (emp.totalSalary || 0);
                  acc[branchName].count++;
                  return acc;
                }, {} as Record<string, { name: string; basic: number; allowances: number; insurance: number; net: number; count: number }>);
                const branchSalaryChartData = Object.values(salaryByBranch).sort((a, b) => b.net - a.net);

                // Salary ranges distribution
                const salaryRanges = [
                  { range: isRTL ? "أقل من 2,000" : "Under 2,000", min: 0, max: 2000, count: 0 },
                  { range: "2,000 - 4,000", min: 2000, max: 4000, count: 0 },
                  { range: "4,000 - 6,000", min: 4000, max: 6000, count: 0 },
                  { range: "6,000 - 8,000", min: 6000, max: 8000, count: 0 },
                  { range: "8,000 - 10,000", min: 8000, max: 10000, count: 0 },
                  { range: isRTL ? "أكثر من 10,000" : "Above 10,000", min: 10000, max: Infinity, count: 0 },
                ];
                filteredEmployees.forEach(emp => {
                  const salary = emp.totalSalary || 0;
                  const range = salaryRanges.find(r => salary >= r.min && salary < r.max);
                  if (range) range.count++;
                });

                // Allowances breakdown
                const allowancesBreakdown = [
                  { name: isRTL ? "بدل سكن" : "Housing", value: salaryStats.totalHousing, color: "#f59e0b" },
                  { name: isRTL ? "بدل مواصلات" : "Transport", value: salaryStats.totalTransport, color: "#3b82f6" },
                  { name: isRTL ? "بدل طعام" : "Food", value: salaryStats.totalFood, color: "#10b981" },
                  { name: isRTL ? "بدلات أخرى" : "Other", value: salaryStats.totalOther, color: "#8b5cf6" },
                ].filter(a => a.value > 0);

                return (
                  <>
                    {/* KPI Cards Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <DollarSign className="w-6 h-6 mx-auto text-green-600 mb-1" />
                            <p className="text-xs text-green-600">{isRTL ? "إجمالي الرواتب" : "Total Salaries"}</p>
                            <p className="text-lg font-bold text-green-800">{formatCurrency(salaryStats.totalNet, isRTL)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <Wallet className="w-6 h-6 mx-auto text-blue-600 mb-1" />
                            <p className="text-xs text-blue-600">{isRTL ? "الرواتب الأساسية" : "Basic Salaries"}</p>
                            <p className="text-lg font-bold text-blue-800">{formatCurrency(salaryStats.totalBasic, isRTL)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <TrendingUp className="w-6 h-6 mx-auto text-amber-600 mb-1" />
                            <p className="text-xs text-amber-600">{isRTL ? "إجمالي البدلات" : "Total Allowances"}</p>
                            <p className="text-lg font-bold text-amber-800">{formatCurrency(salaryStats.totalAllowances, isRTL)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <Shield className="w-6 h-6 mx-auto text-red-600 mb-1" />
                            <p className="text-xs text-red-600">{isRTL ? "التأمينات الاجتماعية" : "Social Insurance"}</p>
                            <p className="text-lg font-bold text-red-800">{formatCurrency(salaryStats.totalInsurance, isRTL)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <Users className="w-6 h-6 mx-auto text-purple-600 mb-1" />
                            <p className="text-xs text-purple-600">{isRTL ? "متوسط الراتب" : "Average Salary"}</p>
                            <p className="text-lg font-bold text-purple-800">{formatCurrency(avgSalary, isRTL)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <BarChart3 className="w-6 h-6 mx-auto text-teal-600 mb-1" />
                            <p className="text-xs text-teal-600">{isRTL ? "تكلفة الموظف" : "Cost Per Employee"}</p>
                            <p className="text-lg font-bold text-teal-800">{formatCurrency(costPerEmployee, isRTL)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Salary by Branch Chart */}
                      <Card>
                        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                          <CardTitle className="flex items-center gap-2 text-green-800">
                            <Building2 className="w-5 h-5" />
                            {isRTL ? "توزيع الرواتب حسب الفرع" : "Salary Distribution by Branch"}
                          </CardTitle>
                          <CardDescription>{isRTL ? "إجمالي الرواتب والبدلات لكل فرع" : "Total salaries and allowances per branch"}</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={branchSalaryChartData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
                              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                              <Tooltip formatter={(value) => formatCurrency(Number(value), isRTL)} />
                              <Legend />
                              <Bar dataKey="basic" stackId="a" fill="#3b82f6" name={isRTL ? "الأساسي" : "Basic"} radius={[0, 0, 0, 0]} />
                              <Bar dataKey="allowances" stackId="a" fill="#f59e0b" name={isRTL ? "البدلات" : "Allowances"} radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Salary Ranges Chart */}
                      <Card>
                        <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b">
                          <CardTitle className="flex items-center gap-2 text-purple-800">
                            <BarChart3 className="w-5 h-5" />
                            {isRTL ? "توزيع نطاقات الرواتب" : "Salary Range Distribution"}
                          </CardTitle>
                          <CardDescription>{isRTL ? "عدد الموظفين في كل نطاق" : "Number of employees in each range"}</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            {salaryRanges.map((range, index) => {
                              const maxCount = Math.max(...salaryRanges.map(r => r.count), 1);
                              const percent = Math.round((range.count / maxCount) * 100);
                              const colors = ["bg-blue-400", "bg-green-400", "bg-yellow-400", "bg-orange-400", "bg-red-400", "bg-purple-400"];
                              return (
                                <div key={range.range}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-gray-700">{range.range} {isRTL ? "ريال" : "SAR"}</span>
                                    <span className="text-sm font-bold text-gray-900">{range.count} {isRTL ? "موظف" : "employees"}</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden">
                                    <div 
                                      className={`h-full ${colors[index]} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                                      style={{ width: `${percent}%` }}
                                    >
                                      {percent >= 20 && <span className="text-xs font-medium text-white">{range.count}</span>}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Allowances Breakdown + Branch Summary */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Allowances Pie Chart */}
                      <Card>
                        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
                          <CardTitle className="flex items-center gap-2 text-amber-800">
                            <PieChartIcon className="w-5 h-5" />
                            {isRTL ? "توزيع البدلات" : "Allowances Distribution"}
                          </CardTitle>
                          <CardDescription>{isRTL ? "نسبة كل نوع من البدلات" : "Percentage of each allowance type"}</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                          {allowancesBreakdown.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">{isRTL ? "لا توجد بدلات مسجلة" : "No allowances recorded"}</div>
                          ) : (
                            <div className="flex items-center gap-6">
                              <div style={{ width: 180, height: 180 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={allowancesBreakdown}
                                      cx="50%"
                                      cy="50%"
                                      outerRadius={70}
                                      innerRadius={45}
                                      dataKey="value"
                                      paddingAngle={3}
                                    >
                                      {allowancesBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                                      ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(Number(value), isRTL)} />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                              <div className="flex-1 space-y-2">
                                {allowancesBreakdown.map((item) => {
                                  const percent = salaryStats.totalAllowances > 0 
                                    ? Math.round((item.value / salaryStats.totalAllowances) * 100) 
                                    : 0;
                                  return (
                                    <div key={item.name} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-sm font-medium text-gray-700">{item.name}</span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-gray-900">{formatCurrency(item.value, isRTL)}</span>
                                        <span className="text-xs text-gray-500 w-10">{percent}%</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Branch Summary Table */}
                      <Card>
                        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
                          <CardTitle className="flex items-center gap-2 text-blue-800">
                            <Building2 className="w-5 h-5" />
                            {isRTL ? "ملخص الرواتب حسب الفرع" : "Salary Summary by Branch"}
                          </CardTitle>
                          <CardDescription>{isRTL ? "إجماليات كل فرع" : "Totals per branch"}</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">{isRTL ? "الفرع" : "Branch"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "الموظفين" : "Employees"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "الأساسي" : "Basic"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "البدلات" : "Allowances"}</TableHead>
                                <TableHead className="text-center">{isRTL ? "الصافي" : "Net"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {branchSalaryChartData.map((branch) => (
                                <TableRow key={branch.name}>
                                  <TableCell className="font-medium">{branch.name}</TableCell>
                                  <TableCell className="text-center">{branch.count}</TableCell>
                                  <TableCell className="text-center text-sm">{formatCurrency(branch.basic, isRTL)}</TableCell>
                                  <TableCell className="text-center text-sm">{formatCurrency(branch.allowances, isRTL)}</TableCell>
                                  <TableCell className="text-center font-bold text-green-700">{formatCurrency(branch.net, isRTL)}</TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-gray-50 font-bold">
                                <TableCell>{isRTL ? "الإجمالي" : "Total"}</TableCell>
                                <TableCell className="text-center">{salaryStats.count}</TableCell>
                                <TableCell className="text-center">{formatCurrency(salaryStats.totalBasic, isRTL)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(salaryStats.totalAllowances, isRTL)}</TableCell>
                                <TableCell className="text-center text-green-700">{formatCurrency(salaryStats.totalNet, isRTL)}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                );
              })()}

              {/* Detailed Salary Table */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle>{isRTL ? "جدول الرواتب التفصيلي" : "Detailed Salary Table"}</CardTitle>
                      <CardDescription>{isRTL ? "بيانات الرواتب والبدلات المفصلة لجميع الموظفين" : "Detailed salary and allowance data for all employees"}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportSalariesTableToExcel} data-testid="button-export-salaries-excel">
                        <FileSpreadsheet className="w-4 h-4 ml-1" />
                        Excel
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportSalariesTableToPDF} data-testid="button-export-salaries-pdf">
                        <FileText className="w-4 h-4 ml-1" />
                        PDF
                      </Button>
                    </div>
                  </div>
                  {/* Filter Bar */}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* Search */}
                      <div className="lg:col-span-2">
                        <Label className="text-xs text-gray-500 mb-1 block">{isRTL ? "بحث" : "Search"}</Label>
                        <Input
                          placeholder={isRTL ? "ابحث بالاسم أو رقم الموظف أو الوظيفة..." : "Search by name, employee ID or job title..."}
                          value={salarySearchQuery}
                          onChange={(e) => setSalarySearchQuery(e.target.value)}
                          className="h-9"
                          data-testid="input-salary-search"
                        />
                      </div>
                      {/* Nationality Filter */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">{isRTL ? "الجنسية" : "Nationality"}</Label>
                        <Select value={salaryNationalityFilter} onValueChange={setSalaryNationalityFilter}>
                          <SelectTrigger className="h-9" data-testid="select-salary-nationality">
                            <SelectValue placeholder={isRTL ? "الكل" : "All"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{isRTL ? "جميع الجنسيات" : "All Nationalities"}</SelectItem>
                            {uniqueNationalities.map(nat => (
                              <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Salary Range */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">{isRTL ? "نطاق الراتب (من)" : "Salary Range (From)"}</Label>
                        <Input
                          type="number"
                          placeholder={isRTL ? "الحد الأدنى" : "Minimum"}
                          value={salaryMinFilter}
                          onChange={(e) => setSalaryMinFilter(e.target.value)}
                          className="h-9"
                          data-testid="input-salary-min"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">{isRTL ? "نطاق الراتب (إلى)" : "Salary Range (To)"}</Label>
                        <Input
                          type="number"
                          placeholder={isRTL ? "الحد الأقصى" : "Maximum"}
                          value={salaryMaxFilter}
                          onChange={(e) => setSalaryMaxFilter(e.target.value)}
                          className="h-9"
                          data-testid="input-salary-max"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex items-center gap-4">
                        <Label className="text-xs text-gray-500">{isRTL ? "ترتيب حسب:" : "Sort by:"}</Label>
                        <Select value={salarySortField} onValueChange={setSalarySortField}>
                          <SelectTrigger className="h-8 w-[140px]" data-testid="select-salary-sort">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employeeName">{isRTL ? "الاسم" : "Name"}</SelectItem>
                            <SelectItem value="salary">{isRTL ? "الراتب الأساسي" : "Basic Salary"}</SelectItem>
                            <SelectItem value="totalSalary">{isRTL ? "صافي الراتب" : "Net Salary"}</SelectItem>
                            <SelectItem value="branchId">{isRTL ? "الفرع" : "Branch"}</SelectItem>
                            <SelectItem value="jobTitle">{isRTL ? "الوظيفة" : "Job Title"}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8"
                          onClick={() => setSalarySortOrder(prev => prev === "asc" ? "desc" : "asc")}
                        >
                          {salarySortOrder === "asc" ? (isRTL ? "تصاعدي ↑" : "Ascending ↑") : (isRTL ? "تنازلي ↓" : "Descending ↓")}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-white">
                          {salaryFilteredEmployees.length} {isRTL ? "من" : "of"} {filteredEmployees.length} {isRTL ? "موظف" : "employees"}
                        </Badge>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSalarySearchQuery("");
                            setSalaryNationalityFilter("all");
                            setSalaryMinFilter("");
                            setSalaryMaxFilter("");
                            setSalarySortField("employeeName");
                            setSalarySortOrder("asc");
                          }}
                        >
                          {isRTL ? "إعادة تعيين" : "Reset"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-right w-10">{isRTL ? "م" : "#"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "رقم الموظف" : "Emp ID"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "الموظف" : "Employee"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "الفرع" : "Branch"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "الوظيفة" : "Job Title"}</TableHead>
                          <TableHead className="text-right">{isRTL ? "الجنسية" : "Nationality"}</TableHead>
                          <TableHead className="text-center bg-blue-50">{isRTL ? "الأساسي" : "Basic"}</TableHead>
                          <TableHead className="text-center bg-amber-50">{isRTL ? "بدل سكن" : "Housing"}</TableHead>
                          <TableHead className="text-center bg-amber-50">{isRTL ? "بدل مواصلات" : "Transport"}</TableHead>
                          <TableHead className="text-center bg-amber-50">{isRTL ? "بدل طعام" : "Food"}</TableHead>
                          <TableHead className="text-center bg-amber-50">{isRTL ? "بدلات أخرى" : "Other"}</TableHead>
                          <TableHead className="text-center bg-red-50">{isRTL ? "التأمينات" : "Insurance"}</TableHead>
                          <TableHead className="text-center bg-green-50 font-bold">{isRTL ? "الصافي" : "Net"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salaryFilteredEmployees.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                              {isRTL ? "لا توجد نتائج مطابقة للبحث" : "No matching results found"}
                            </TableCell>
                          </TableRow>
                        ) : (
                          salaryFilteredEmployees.map((emp, index) => {
                            const storedIns = emp.socialInsuranceDeduction || 0;
                            const insurance = emp.nationality === "سعودي" 
                              ? (storedIns > 0 ? storedIns : Math.round((emp.salary || 0) * 0.0975))
                              : 0;
                            return (
                              <TableRow key={emp.id} className="hover:bg-gray-50">
                                <TableCell className="text-center">{index + 1}</TableCell>
                                <TableCell className="text-amber-600 font-mono text-sm">{emp.employeeNumber || "-"}</TableCell>
                                <TableCell className="font-medium">{emp.employeeName}</TableCell>
                                <TableCell>{getBranchName(emp.branchId)}</TableCell>
                                <TableCell>{emp.jobTitle}</TableCell>
                                <TableCell>
                                  <Badge variant={emp.nationality === "سعودي" ? "default" : "outline"} className={emp.nationality === "سعودي" ? "bg-green-100 text-green-800" : ""}>
                                    {emp.nationality}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center bg-blue-50/50">{formatCurrency(emp.salary, isRTL)}</TableCell>
                                <TableCell className="text-center bg-amber-50/50">{emp.housingAllowance ? formatCurrency(emp.housingAllowance, isRTL) : "-"}</TableCell>
                                <TableCell className="text-center bg-amber-50/50">{emp.transportAllowance ? formatCurrency(emp.transportAllowance, isRTL) : "-"}</TableCell>
                                <TableCell className="text-center bg-amber-50/50">{emp.foodAllowance ? formatCurrency(emp.foodAllowance, isRTL) : "-"}</TableCell>
                                <TableCell className="text-center bg-amber-50/50">{emp.otherAllowances ? formatCurrency(emp.otherAllowances, isRTL) : "-"}</TableCell>
                                <TableCell className="text-center bg-red-50/50 text-red-600">
                                  {insurance > 0 ? `- ${formatCurrency(insurance, isRTL)}` : "-"}
                                </TableCell>
                                <TableCell className="text-center bg-green-50/50 font-bold text-green-700">{formatCurrency(emp.totalSalary, isRTL)}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Table Summary */}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">{isRTL ? "إجمالي الموظفين (المعروضين)" : "Total Employees (Displayed)"}</p>
                        <p className="font-bold text-lg">{salaryFilteredEmployees.length}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">{isRTL ? "إجمالي الرواتب الأساسية" : "Total Base Salaries"}</p>
                        <p className="font-bold text-lg text-blue-700">
                          {formatCurrency(salaryFilteredEmployees.reduce((sum, e) => sum + (e.salary || 0), 0), isRTL)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">{isRTL ? "إجمالي البدلات" : "Total Allowances"}</p>
                        <p className="font-bold text-lg text-amber-700">
                          {formatCurrency(salaryFilteredEmployees.reduce((sum, e) => sum + (e.housingAllowance || 0) + (e.transportAllowance || 0) + (e.foodAllowance || 0) + (e.otherAllowances || 0), 0), isRTL)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">{isRTL ? "صافي الرواتب المستحقة" : "Net Salaries Due"}</p>
                        <p className="font-bold text-lg text-green-700">
                          {formatCurrency(salaryFilteredEmployees.reduce((sum, e) => sum + (e.totalSalary || 0), 0), isRTL)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="flex justify-end mb-4">
                <Button variant="outline" size="sm" onClick={exportAnalyticsToExcel} data-testid="button-export-analytics-excel">
                  <FileSpreadsheet className={`w-4 h-4 ${isRTL ? "ml-1" : "mr-1"}`} />
                  {isRTL ? "تصدير التحليلات Excel" : "Export Analytics Excel"}
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{isRTL ? "مقارنة الحضور والغياب" : "Attendance vs Absence Comparison"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: isRTL ? "حضور" : "Present", value: overviewStats.presentCount },
                            { name: isRTL ? "غياب" : "Absent", value: overviewStats.absentCount },
                            { name: isRTL ? "تأخير" : "Late", value: overviewStats.lateCount },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#ef4444" />
                          <Cell fill="#f59e0b" />
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{isRTL ? "إحصائيات الموظفين حسب الحالة" : "Employee Statistics by Status"}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { label: isRTL ? "نشط" : "Active", value: filteredEmployees.filter(e => e.status === "active").length, color: "bg-green-500" },
                        { label: isRTL ? "غير نشط" : "Inactive", value: filteredEmployees.filter(e => e.status === "inactive").length, color: "bg-gray-500" },
                        { label: isRTL ? "في إجازة" : "On Leave", value: filteredEmployees.filter(e => e.status === "on_leave").length, color: "bg-yellow-500" },
                        { label: isRTL ? "منتهي" : "Terminated", value: filteredEmployees.filter(e => e.status === "terminated").length, color: "bg-red-500" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${item.color}`} />
                          <span className="flex-1">{item.label}</span>
                          <span className="font-bold">{item.value}</span>
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${item.color}`} 
                              style={{ width: `${(item.value / filteredEmployees.length) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <Card data-testid="card-nationality-distribution">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {isRTL ? "توزيع الجنسيات" : "Nationality Distribution"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={nationalityDistribution} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#f59e0b" name={isRTL ? "عدد الموظفين" : "Employee Count"} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="card-late-analysis">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-red-500" />
                      {isRTL ? "أكثر الموظفين تأخراً" : "Most Late Employees"}
                    </CardTitle>
                    <CardDescription>{isRTL ? "أعلى 10 موظفين في عدد أيام التأخير" : "Top 10 employees with late days"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {lateAnalysis.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">{isRTL ? "لا توجد سجلات تأخير" : "No late records"}</div>
                    ) : (
                      <div className="space-y-2">
                        {lateAnalysis.map((emp, index) => (
                          <div key={index} className="flex items-center gap-3 p-2 bg-red-50 rounded">
                            <span className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-700 rounded-full text-sm font-bold">
                              {index + 1}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{emp.name}</p>
                              <p className="text-xs text-gray-500">{emp.branch}</p>
                            </div>
                            <Badge className="bg-red-100 text-red-800">{emp.lateDays} {isRTL ? "يوم" : "days"}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-overtime-analysis">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-500" />
                      {isRTL ? "تحليل ساعات العمل حسب الفرع" : "Work Hours Analysis by Branch"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={overtimeAnalysis}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="totalHours" fill="#3b82f6" name={isRTL ? "إجمالي الساعات" : "Total Hours"} />
                        <Bar dataKey="overtime" fill="#10b981" name={isRTL ? "ساعات إضافية" : "Overtime"} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="card-branch-ranking">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-amber-500" />
                      {isRTL ? "ترتيب الفروع حسب الأداء" : "Branch Performance Ranking"}
                    </CardTitle>
                    <CardDescription>{isRTL ? "التقييم الشامل بناءً على السعودة والحضور والإنتاجية" : "Comprehensive evaluation based on Saudization, attendance, and productivity"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {branchPerformanceRanking.slice(0, 5).map((branch, index) => (
                        <div key={branch.branchId} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`w-8 h-8 flex items-center justify-center rounded-full text-white font-bold ${
                                index === 0 ? "bg-amber-500" : index === 1 ? "bg-gray-400" : index === 2 ? "bg-amber-700" : "bg-gray-300"
                              }`}>
                                {index + 1}
                              </span>
                              <span className="font-medium">{branch.branchName}</span>
                            </div>
                            <span className="text-lg font-bold text-amber-600">{branch.totalScore}/100</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="text-center">
                              <p className="text-gray-500">{isRTL ? "السعودة" : "Saudization"}</p>
                              <p className="font-bold">{branch.saudiScore}/25</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-500">{isRTL ? "الحضور" : "Attendance"}</p>
                              <p className="font-bold">{branch.attendanceScore}/25</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-500">{isRTL ? "الإنتاجية" : "Productivity"}</p>
                              <p className="font-bold">{branch.productivityScore}/25</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-500">{isRTL ? "الكفاءة" : "Efficiency"}</p>
                              <p className="font-bold">{branch.efficiencyScore}/25</p>
                            </div>
                          </div>
                          <div className="mt-2 bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-amber-600" 
                              style={{ width: `${branch.totalScore}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Additional Analytics Sections */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Tenure Distribution */}
                <Card data-testid="card-tenure-distribution">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-indigo-500" />
                      {isRTL ? "توزيع الموظفين حسب مدة الخدمة" : "Employee Distribution by Tenure"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={tenureDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {tenureDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Early Warning Indicators */}
                <Card data-testid="card-early-warning">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      {isRTL ? "مؤشرات الإنذار المبكر" : "Early Warning Indicators"}
                    </CardTitle>
                    <CardDescription>{isRTL ? "موظفين يحتاجون متابعة بسبب نمط الحضور" : "Employees requiring follow-up due to attendance patterns"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {earlyWarningIndicators.length === 0 ? (
                      <div className="text-center py-8 text-green-600">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                        {isRTL ? "لا توجد تنبيهات حالياً" : "No alerts currently"}
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {earlyWarningIndicators.slice(0, 8).map((warning, index) => (
                          <div key={index} className={`flex items-center justify-between p-2 rounded ${warning.severity === "high" ? "bg-red-50" : "bg-yellow-50"}`}>
                            <div>
                              <p className="font-medium text-sm">{warning.emp.employeeName}</p>
                              <p className="text-xs text-gray-500">{warning.type}: {warning.description}</p>
                            </div>
                            <Badge className={`${warning.severity === "high" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                              {warning.severity === "high" ? (isRTL ? "عالي" : "High") : (isRTL ? "متوسط" : "Medium")}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Schedule vs Attendance Variance */}
                <Card data-testid="card-schedule-variance">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-500" />
                      {isRTL ? "مقارنة الجدولة بالحضور الفعلي" : "Schedule vs Actual Attendance"}
                    </CardTitle>
                    <CardDescription>{isRTL ? "تحليل الفروقات بين الورديات المجدولة والحضور" : "Variance analysis between scheduled shifts and attendance"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {scheduleVarianceAnalysis.summary.total === 0 ? (
                      <div className="text-center py-8 text-gray-500">{isRTL ? "لا توجد بيانات جدولة" : "No schedule data"}</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                          <div className="p-2 bg-green-50 rounded">
                            <p className="text-xl font-bold text-green-700">{scheduleVarianceAnalysis.summary.onTime}</p>
                            <p className="text-xs text-green-600">{isRTL ? "في الموعد" : "On Time"}</p>
                          </div>
                          <div className="p-2 bg-yellow-50 rounded">
                            <p className="text-xl font-bold text-yellow-700">{scheduleVarianceAnalysis.summary.late}</p>
                            <p className="text-xs text-yellow-600">{isRTL ? "متأخر" : "Late"}</p>
                          </div>
                          <div className="p-2 bg-red-50 rounded">
                            <p className="text-xl font-bold text-red-700">{scheduleVarianceAnalysis.summary.absent}</p>
                            <p className="text-xs text-red-600">{isRTL ? "غائب" : "Absent"}</p>
                          </div>
                          <div className="p-2 bg-blue-50 rounded">
                            <p className="text-xl font-bold text-blue-700">{scheduleVarianceAnalysis.summary.total}</p>
                            <p className="text-xs text-blue-600">{isRTL ? "إجمالي" : "Total"}</p>
                          </div>
                        </div>
                        {scheduleVarianceAnalysis.variances.length > 0 && (
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {scheduleVarianceAnalysis.variances.map((v, i) => (
                              <div key={i} className="flex items-center justify-between text-sm p-1 bg-gray-50 rounded">
                                <span>{v.name}</span>
                                <span className={`font-bold ${v.attendanceRate >= 80 ? "text-green-600" : v.attendanceRate >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                                  {v.attendanceRate}%
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Cashier Sales Performance */}
                <Card data-testid="card-cashier-performance">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      {isRTL ? "أداء الكاشير والمبيعات" : "Cashier & Sales Performance"}
                    </CardTitle>
                    <CardDescription>{isRTL ? "ربط موظفي الكاشير بإجمالي المبيعات" : "Cashier employees linked to total sales"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {cashierPerformanceAnalysis.cashierPerformance.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">{isRTL ? "لا توجد بيانات مبيعات" : "No sales data available"}</div>
                    ) : (
                      <>
                        <div className="p-3 bg-green-50 rounded-lg mb-4 text-center">
                          <p className="text-2xl font-bold text-green-700">{formatCurrency(cashierPerformanceAnalysis.totalSales, isRTL)}</p>
                          <p className="text-xs text-green-600">{isRTL ? "إجمالي المبيعات للشهر" : "Total Monthly Sales"}</p>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {cashierPerformanceAnalysis.cashierPerformance.map((cashier, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <p className="font-medium text-sm">{cashier.name}</p>
                                <p className="text-xs text-gray-500">{isRTL ? `${cashier.daysWorked} يوم عمل` : `${cashier.daysWorked} work days`}</p>
                              </div>
                              <div className={isRTL ? "text-left" : "text-right"}>
                                <p className="font-bold text-green-700">{formatCurrency(cashier.totalSales, isRTL)}</p>
                                <p className="text-xs text-gray-500">{isRTL ? `متوسط: ${formatCurrency(cashier.avgDaily, isRTL)}` : `Avg: ${formatCurrency(cashier.avgDaily, isRTL)}`}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="kpis" className="space-y-4" data-testid="tab-content-kpis">
              <div className="flex justify-end mb-4 gap-2">
                <Button variant="outline" size="sm" onClick={exportKPIsToExcel} data-testid="button-export-kpis-excel">
                  <FileSpreadsheet className="w-4 h-4 ml-1" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportKPIsToPDF} data-testid="button-export-kpis-pdf">
                  <FileText className="w-4 h-4 ml-1" />
                  PDF
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200" data-testid="kpi-total-employees">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-700">{formatNumber(overviewStats.totalEmployees)}</p>
                      <p className="text-sm text-blue-600">{isRTL ? "إجمالي الموظفين" : "Total Employees"}</p>
                      <p className="text-xs text-blue-500 mt-1">{isRTL ? `نشط: ${filteredEmployees.filter(e => e.status === "active").length}` : `Active: ${filteredEmployees.filter(e => e.status === "active").length}`}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200" data-testid="kpi-attendance-rate">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-700">{overviewStats.attendanceRate}%</p>
                      <p className="text-sm text-green-600">{isRTL ? "نسبة الحضور" : "Attendance Rate"}</p>
                      <p className="text-xs text-green-500 mt-1">{isRTL ? `${formatNumber(overviewStats.presentCount)} يوم حضور` : `${formatNumber(overviewStats.presentCount)} present days`}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200" data-testid="kpi-total-salaries">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-amber-700">{formatCurrency(overviewStats.totalSalaries, isRTL)}</p>
                      <p className="text-sm text-amber-600">{isRTL ? "إجمالي الرواتب" : "Total Salaries"}</p>
                      <p className="text-xs text-amber-500 mt-1">{isRTL ? `متوسط: ${formatCurrency(overviewStats.totalEmployees > 0 ? Math.round(overviewStats.totalSalaries / overviewStats.totalEmployees) : 0, isRTL)}` : `Avg: ${formatCurrency(overviewStats.totalEmployees > 0 ? Math.round(overviewStats.totalSalaries / overviewStats.totalEmployees) : 0, isRTL)}`}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200" data-testid="kpi-saudization">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-teal-700">{overviewStats.totalEmployees > 0 ? Math.round((overviewStats.saudiEmployees / overviewStats.totalEmployees) * 100) : 0}%</p>
                      <p className="text-sm text-teal-600">{isRTL ? "نسبة السعودة" : "Saudization Rate"}</p>
                      <p className="text-xs text-teal-500 mt-1">{isRTL ? `${formatNumber(overviewStats.saudiEmployees)} موظف سعودي` : `${formatNumber(overviewStats.saudiEmployees)} Saudi employees`}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-top-employees">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      {isRTL ? "أعلى 10 موظفين راتباً" : "Top 10 Highest Paid Employees"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table data-testid="table-top-employees">
                      <TableHeader>
                        <TableRow>
                          <TableHead className={isRTL ? "text-right" : "text-left"}>#</TableHead>
                          <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الموظف" : "Employee"}</TableHead>
                          <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الفرع" : "Branch"}</TableHead>
                          <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الوظيفة" : "Job Title"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "الراتب" : "Salary"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topEmployeesBySalary.map((emp, index) => (
                          <TableRow key={emp.id} data-testid={`row-top-employee-${emp.id}`}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">{emp.employeeName}</TableCell>
                            <TableCell>{getBranchName(emp.branchId)}</TableCell>
                            <TableCell>{emp.jobTitle}</TableCell>
                            <TableCell className="text-center font-bold">{formatCurrency(emp.totalSalary || emp.salary, isRTL)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card data-testid="card-allowances-breakdown">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="w-5 h-5" />
                      {isRTL ? "تحليل البدلات" : "Allowances Breakdown"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {allowancesBreakdown.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={allowancesBreakdown}
                              cx="50%"
                              cy="50%"
                              outerRadius={70}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                              {allowancesBreakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatCurrency(Number(value), isRTL)} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          {allowancesBreakdown.map((item) => (
                            <div key={item.name} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-sm flex-1">{item.name}</span>
                              <span className="font-bold text-sm">{formatCurrency(item.value, isRTL)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-10 text-gray-500">{isRTL ? "لا توجد بدلات مسجلة" : "No allowances recorded"}</div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-insurance-summary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      {isRTL ? "ملخص التأمينات الاجتماعية" : "Social Insurance Summary"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg" data-testid="text-total-insurance">
                        <div>
                          <p className="text-sm text-purple-600">{isRTL ? "إجمالي التأمينات" : "Total Insurance"}</p>
                          <p className="text-2xl font-bold text-purple-700">{formatCurrency(overviewStats.totalInsurance, isRTL)}</p>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-full">
                          <Wallet className="w-8 h-8 text-purple-600" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg text-center" data-testid="text-saudi-count">
                          <p className="text-lg font-bold">{formatNumber(overviewStats.saudiEmployees)}</p>
                          <p className="text-xs text-gray-500">{isRTL ? "موظف سعودي" : "Saudi Employees"}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg text-center" data-testid="text-avg-insurance">
                          <p className="text-lg font-bold">{formatCurrency(overviewStats.saudiEmployees > 0 ? Math.round(overviewStats.totalInsurance / overviewStats.saudiEmployees) : 0, isRTL)}</p>
                          <p className="text-xs text-gray-500">{isRTL ? "متوسط التأمينات" : "Avg. Insurance"}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-branches-summary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      {isRTL ? "ملخص الفروع" : "Branches Summary"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {branchComparisonData.slice(0, 5).map((branch, index) => (
                        <div key={branch.branchId} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                          <span className="w-6 h-6 flex items-center justify-center bg-amber-100 text-amber-700 rounded-full text-sm font-bold">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium">{branch.branchName}</p>
                            <p className="text-xs text-gray-500">{branch.employeeCount} {isRTL ? "موظف" : "employees"}</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-sm">{formatCurrency(branch.totalSalary, isRTL)}</p>
                            <Badge className={branch.attendanceRate >= 80 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                              {branch.attendanceRate}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ==================== ENHANCED KPI SECTIONS ==================== */}

              {/* 1. مؤشرات الأداء المقارنة - مقارنة الشهر الحالي بالسابق */}
              <Card data-testid="card-comparative-metrics">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
                  <CardTitle className="flex items-center gap-2 text-indigo-800">
                    <TrendingUp className="w-5 h-5" />
                    {isRTL ? "مؤشرات الأداء المقارنة" : "Comparative Performance Metrics"}
                  </CardTitle>
                  <CardDescription>{isRTL ? "مقارنة الشهر الحالي بالشهر السابق" : "Current month vs previous month comparison"}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-700">{formatNumber(overviewStats.totalEmployees)}</p>
                      <p className="text-xs text-blue-600">{isRTL ? "إجمالي الموظفين" : "Total Employees"}</p>
                      {previousMonthStats && (
                        <div className={`text-xs mt-1 flex items-center justify-center gap-1 ${getChangeIndicator(overviewStats.totalEmployees, previousMonthStats.totalEmployees).isPositive ? "text-green-600" : "text-red-600"}`}>
                          {getChangeIndicator(overviewStats.totalEmployees, previousMonthStats.totalEmployees).isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                          {getChangeIndicator(overviewStats.totalEmployees, previousMonthStats.totalEmployees).change}%
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-700">{overviewStats.attendanceRate}%</p>
                      <p className="text-xs text-green-600">{isRTL ? "نسبة الحضور" : "Attendance Rate"}</p>
                      {previousMonthStats && (
                        <div className={`text-xs mt-1 flex items-center justify-center gap-1 ${getChangeIndicator(overviewStats.attendanceRate, previousMonthStats.attendanceRate).isPositive ? "text-green-600" : "text-red-600"}`}>
                          {getChangeIndicator(overviewStats.attendanceRate, previousMonthStats.attendanceRate).isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                          {getChangeIndicator(overviewStats.attendanceRate, previousMonthStats.attendanceRate).change}%
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg text-center">
                      <p className="text-2xl font-bold text-amber-700">{formatCurrency(overviewStats.totalSalaries, isRTL)}</p>
                      <p className="text-xs text-amber-600">{isRTL ? "إجمالي الرواتب" : "Total Salaries"}</p>
                      {previousMonthStats && (
                        <div className={`text-xs mt-1 flex items-center justify-center gap-1 ${getChangeIndicator(overviewStats.totalSalaries, previousMonthStats.totalSalaries).isPositive ? "text-green-600" : "text-red-600"}`}>
                          {getChangeIndicator(overviewStats.totalSalaries, previousMonthStats.totalSalaries).isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                          {getChangeIndicator(overviewStats.totalSalaries, previousMonthStats.totalSalaries).change}%
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-700">{formatCurrency(productivityMetrics.avgCostPerEmployee, isRTL)}</p>
                      <p className="text-xs text-purple-600">{isRTL ? "متوسط تكلفة الموظف" : "Avg. Employee Cost"}</p>
                    </div>
                  </div>

                  {/* Salary Trend Chart (6 Months) */}
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-700 mb-3">{isRTL ? "اتجاه الرواتب خلال 6 أشهر" : "Salary Trend Over 6 Months"}</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={salaryTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={(value) => formatNumber(value)} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value), isRTL)} />
                        <Legend />
                        <Line type="monotone" dataKey="totalSalary" stroke="#f59e0b" name={isRTL ? "إجمالي الرواتب" : "Total Salaries"} strokeWidth={2} />
                        <Line type="monotone" dataKey="avgSalary" stroke="#10b981" name={isRTL ? "متوسط الراتب" : "Average Salary"} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* 2. مؤشرات الإنتاجية */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-productivity-metrics">
                  <CardHeader className="bg-gradient-to-r from-cyan-50 to-teal-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-cyan-800">
                      <Clock className="w-5 h-5" />
                      {isRTL ? "مؤشرات الإنتاجية" : "Productivity Metrics"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg text-center">
                        <p className="text-2xl font-bold text-cyan-700">{formatNumber(productivityMetrics.totalWorkingHours)}</p>
                        <p className="text-xs text-cyan-600">{isRTL ? "إجمالي ساعات العمل" : "Total Working Hours"}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg text-center">
                        <p className="text-2xl font-bold text-teal-700">{productivityMetrics.avgHoursPerEmployee}</p>
                        <p className="text-xs text-teal-600">{isRTL ? "متوسط ساعات/موظف" : "Avg. Hours/Employee"}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-700">{formatCurrency(productivityMetrics.costPerHour, isRTL)}</p>
                        <p className="text-xs text-blue-600">{isRTL ? "تكلفة الساعة" : "Cost Per Hour"}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg text-center">
                        <p className="text-2xl font-bold text-indigo-700">{formatCurrency(productivityMetrics.avgCostPerEmployee, isRTL)}</p>
                        <p className="text-xs text-indigo-600">{isRTL ? "تكلفة الموظف الشهرية" : "Monthly Employee Cost"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. مؤشرات الدوران الوظيفي */}
                <Card data-testid="card-turnover-metrics">
                  <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-orange-800">
                      <RefreshCw className="w-5 h-5" />
                      {isRTL ? "مؤشرات الدوران الوظيفي" : "Turnover Metrics"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-700">{turnoverMetrics.newEmployees}</p>
                        <p className="text-xs text-green-600">{isRTL ? "موظفين جدد هذا الشهر" : "New Employees This Month"}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg text-center">
                        <p className="text-2xl font-bold text-red-700">{turnoverMetrics.terminatedEmployees}</p>
                        <p className="text-xs text-red-600">{isRTL ? "مستقيلين/منتهية عقودهم" : "Resigned/Terminated"}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-700">{turnoverMetrics.stabilityRate}%</p>
                        <p className="text-xs text-blue-600">{isRTL ? "معدل الاستقرار" : "Stability Rate"}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg text-center">
                        <p className="text-2xl font-bold text-purple-700">{turnoverMetrics.avgTenureMonths}</p>
                        <p className="text-xs text-purple-600">{isRTL ? "متوسط مدة الخدمة (شهر)" : "Avg. Tenure (months)"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 4. مؤشرات التكاليف */}
              <Card data-testid="card-cost-analysis">
                <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
                  <CardTitle className="flex items-center gap-2 text-emerald-800">
                    <DollarSign className="w-5 h-5" />
                    {isRTL ? "تحليل التكاليف" : "Cost Analysis"}
                  </CardTitle>
                  <CardDescription>{isRTL ? "توزيع تكاليف الموظفين" : "Employee cost distribution"}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg text-center">
                      <p className="text-xl font-bold text-green-700">{formatCurrency(costAnalysis.baseSalaries, isRTL)}</p>
                      <p className="text-xs text-green-600">{isRTL ? "الرواتب الأساسية" : "Base Salaries"}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg text-center">
                      <p className="text-xl font-bold text-blue-700">{formatCurrency(costAnalysis.totalAllowances, isRTL)}</p>
                      <p className="text-xs text-blue-600">{isRTL ? `البدلات (${costAnalysis.allowancePercentage}%)` : `Allowances (${costAnalysis.allowancePercentage}%)`}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg text-center">
                      <p className="text-xl font-bold text-purple-700">{formatCurrency(costAnalysis.totalInsurance, isRTL)}</p>
                      <p className="text-xs text-purple-600">{isRTL ? `التأمينات (${costAnalysis.insurancePercentage}%)` : `Insurance (${costAnalysis.insurancePercentage}%)`}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg text-center">
                      <p className="text-xl font-bold text-orange-700">{formatCurrency(costAnalysis.overtimeCost, isRTL)}</p>
                      <p className="text-xs text-orange-600">{isRTL ? `العمل الإضافي (${costAnalysis.overtimeHours} ساعة)` : `Overtime (${costAnalysis.overtimeHours} hrs)`}</p>
                    </div>
                  </div>

                  {/* Cost Distribution by Job Title */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-3">{isRTL ? "توزيع التكاليف حسب الوظيفة" : "Cost Distribution by Job Title"}</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {costAnalysis.costDistribution.map((item, index) => (
                        <div key={item.jobTitle} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                          <span className="w-6 h-6 flex items-center justify-center bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.jobTitle}</p>
                            <p className="text-xs text-gray-500">{item.count} {isRTL ? "موظف" : "employees"} - {isRTL ? "متوسط" : "avg"}: {formatCurrency(item.avgCost, isRTL)}</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-sm">{formatCurrency(item.totalCost, isRTL)}</p>
                            <Badge className="bg-gray-100 text-gray-800">{item.percentage}%</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 5. رسوم بيانية إضافية */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* مقارنة الحضور بين الفروع */}
                <Card data-testid="card-branch-attendance-comparison">
                  <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-violet-800">
                      <BarChart3 className="w-5 h-5" />
                      {isRTL ? "مقارنة الحضور بين الفروع" : "Branch Attendance Comparison"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={branchComparisonData.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" tick={{ fontSize: 9 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="attendanceRate" fill="#8b5cf6" name={isRTL ? "نسبة الحضور %" : "Attendance Rate %"} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* توزيع الموظفين حسب سنوات الخبرة */}
                <Card data-testid="card-experience-distribution">
                  <CardHeader className="bg-gradient-to-r from-pink-50 to-rose-50 border-b">
                    <CardTitle className="flex items-center gap-2 text-pink-800">
                      <CalendarDays className="w-5 h-5" />
                      {isRTL ? "توزيع الموظفين حسب سنوات الخبرة" : "Employee Distribution by Experience"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={experienceDistribution}
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {experienceDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* 6. التنبيهات الذكية */}
              <Card data-testid="card-smart-alerts">
                <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 border-b">
                  <CardTitle className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="w-5 h-5" />
                    {isRTL ? "التنبيهات الذكية" : "Smart Alerts"}
                  </CardTitle>
                  <CardDescription>{isRTL ? "تنبيهات تحتاج انتباهك" : "Alerts that need your attention"}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {smartAlerts.length === 0 ? (
                    <div className="text-center py-8 text-green-600">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                      <p className="font-medium">{isRTL ? "لا توجد تنبيهات حالياً" : "No alerts currently"}</p>
                      <p className="text-sm text-gray-500">{isRTL ? "جميع المؤشرات ضمن المعدل الطبيعي" : "All metrics are within normal range"}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {smartAlerts.map((alert, index) => (
                        <div
                          key={index}
                          className={`flex items-start gap-3 p-3 rounded-lg ${
                            alert.type === "danger" ? "bg-red-50 border border-red-200" :
                            alert.type === "warning" ? "bg-yellow-50 border border-yellow-200" :
                            "bg-blue-50 border border-blue-200"
                          }`}
                        >
                          <div className={`p-2 rounded-full ${
                            alert.type === "danger" ? "bg-red-100" :
                            alert.type === "warning" ? "bg-yellow-100" :
                            "bg-blue-100"
                          }`}>
                            <AlertCircle className={`w-5 h-5 ${
                              alert.type === "danger" ? "text-red-600" :
                              alert.type === "warning" ? "text-yellow-600" :
                              "text-blue-600"
                            }`} />
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium ${
                              alert.type === "danger" ? "text-red-800" :
                              alert.type === "warning" ? "text-yellow-800" :
                              "text-blue-800"
                            }`}>{alert.title}</p>
                            <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                          </div>
                          <Badge className={
                            alert.type === "danger" ? "bg-red-100 text-red-800" :
                            alert.type === "warning" ? "bg-yellow-100 text-yellow-800" :
                            "bg-blue-100 text-blue-800"
                          }>{alert.count}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Health Certificates Tab */}
            <TabsContent value="health-certificates" className="space-y-4" data-testid="tab-content-health-certificates">
              <div className="flex justify-end mb-4 gap-2">
                <Button variant="outline" size="sm" onClick={async () => {
                  const XLSX = await import("xlsx");
                  const ws = XLSX.utils.json_to_sheet(healthCertificateAnalysis.needsRenewal.map(emp => ({
                    "رقم الموظف": emp.employeeNumber || "",
                    "الاسم": emp.employeeName,
                    "الفرع": getBranchName(emp.branchId),
                    "الوظيفة": emp.jobTitle,
                    "حالة الشهادة": emp.healthCertificate === "valid" ? "صالحة" : emp.healthCertificate === "expired" ? "منتهية" : "لا توجد",
                    "تاريخ الانتهاء": emp.healthCertificateExpiry || "--",
                    "الجوال": emp.phoneNumber || "",
                  })));
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "الشهادات الصحية");
                  XLSX.writeFile(wb, `health_certificates_${selectedMonth}.xlsx`);
                }} data-testid="button-export-health-excel">
                  <FileSpreadsheet className="w-4 h-4 ml-1" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  try {
                    const response = await fetch("/api/pdf/health-certificates", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        month: selectedMonth,
                        complianceRate: healthCertificateAnalysis.complianceRate,
                        employees: healthCertificateAnalysis.needsRenewal.map(emp => ({
                          employeeName: emp.employeeName,
                          branchName: getBranchName(emp.branchId),
                          jobTitle: emp.jobTitle,
                          status: emp.healthCertificate === "valid" ? "صالحة" : emp.healthCertificate === "expired" ? "منتهية" : "لا توجد",
                          expiryDate: emp.healthCertificateExpiry || "--",
                        })),
                      }),
                    });
                    if (!response.ok) throw new Error("Failed to generate PDF");
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `health_certificates_${selectedMonth}.pdf`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                  } catch (error) {
                    console.error("Error exporting health certificates PDF:", error);
                    toast({
                      title: isRTL ? "فشل تصدير PDF للشهادات الصحية" : "Failed to export health certificates PDF",
                      description: (error as Error)?.message,
                      variant: "destructive",
                    });
                  }
                }} data-testid="button-export-health-pdf">
                  <FileText className="w-4 h-4 ml-1" />
                  PDF
                </Button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200" data-testid="health-valid-count">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <CheckCircle className="w-8 h-8 mx-auto text-green-600 mb-2" />
                      <p className="text-3xl font-bold text-green-700">{formatNumber(healthCertificateAnalysis.valid)}</p>
                      <p className="text-sm text-green-600">{isRTL ? "شهادات صالحة" : "Valid Certificates"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200" data-testid="health-expired-count">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <XCircle className="w-8 h-8 mx-auto text-red-600 mb-2" />
                      <p className="text-3xl font-bold text-red-700">{formatNumber(healthCertificateAnalysis.expired)}</p>
                      <p className="text-sm text-red-600">{isRTL ? "شهادات منتهية" : "Expired Certificates"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200" data-testid="health-none-count">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                      <p className="text-3xl font-bold text-gray-700">{formatNumber(healthCertificateAnalysis.none)}</p>
                      <p className="text-sm text-gray-600">{isRTL ? "بدون شهادة" : "No Certificate"}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className={`bg-gradient-to-br ${healthCertificateAnalysis.complianceRate >= 80 ? "from-teal-50 to-teal-100 border-teal-200" : healthCertificateAnalysis.complianceRate >= 50 ? "from-yellow-50 to-yellow-100 border-yellow-200" : "from-red-50 to-red-100 border-red-200"}`} data-testid="health-compliance-rate">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <TrendingUp className={`w-8 h-8 mx-auto mb-2 ${healthCertificateAnalysis.complianceRate >= 80 ? "text-teal-600" : healthCertificateAnalysis.complianceRate >= 50 ? "text-yellow-600" : "text-red-600"}`} />
                      <p className={`text-3xl font-bold ${healthCertificateAnalysis.complianceRate >= 80 ? "text-teal-700" : healthCertificateAnalysis.complianceRate >= 50 ? "text-yellow-700" : "text-red-700"}`}>{healthCertificateAnalysis.complianceRate}%</p>
                      <p className={`text-sm ${healthCertificateAnalysis.complianceRate >= 80 ? "text-teal-600" : healthCertificateAnalysis.complianceRate >= 50 ? "text-yellow-600" : "text-red-600"}`}>{isRTL ? "نسبة الامتثال" : "Compliance Rate"}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Expiring Soon Alerts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-red-200" data-testid="health-expiring-30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {isRTL ? "تنتهي خلال 30 يوم" : "Expiring in 30 days"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-700">{healthCertificateAnalysis.expiringWithin30.length}</p>
                    {healthCertificateAnalysis.expiringWithin30.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                        {healthCertificateAnalysis.expiringWithin30.map((item, i) => (
                          <p key={i} className="text-xs text-red-600">{item.emp.employeeName} ({item.daysLeft} {isRTL ? "يوم" : "days"})</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-yellow-200" data-testid="health-expiring-60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-yellow-700 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {isRTL ? "تنتهي خلال 60 يوم" : "Expiring in 60 days"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-yellow-700">{healthCertificateAnalysis.expiringWithin60.length}</p>
                    {healthCertificateAnalysis.expiringWithin60.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                        {healthCertificateAnalysis.expiringWithin60.map((item, i) => (
                          <p key={i} className="text-xs text-yellow-600">{item.emp.employeeName} ({item.daysLeft} {isRTL ? "يوم" : "days"})</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-blue-200" data-testid="health-expiring-90">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {isRTL ? "تنتهي خلال 90 يوم" : "Expiring in 90 days"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-blue-700">{healthCertificateAnalysis.expiringWithin90.length}</p>
                    {healthCertificateAnalysis.expiringWithin90.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                        {healthCertificateAnalysis.expiringWithin90.map((item, i) => (
                          <p key={i} className="text-xs text-blue-600">{item.emp.employeeName} ({item.daysLeft} {isRTL ? "يوم" : "days"})</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Branch Compliance Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="health-branch-compliance">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      {isRTL ? "نسبة الامتثال حسب الفرع" : "Compliance Rate by Branch"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {healthCertificateAnalysis.branchCompliance.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={healthCertificateAnalysis.branchCompliance} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, 100]} />
                          <YAxis dataKey="branchName" type="category" width={100} />
                          <Tooltip formatter={(value) => `${value}%`} />
                          <Bar dataKey="rate" fill="#10b981" name={isRTL ? "نسبة الامتثال" : "Compliance Rate"}>
                            {healthCertificateAnalysis.branchCompliance.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.rate >= 80 ? "#10b981" : entry.rate >= 50 ? "#f59e0b" : "#ef4444"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-10 text-gray-500">{isRTL ? "لا توجد بيانات" : "No data available"}</div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="health-job-compliance">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      {isRTL ? "نسبة الامتثال حسب الوظيفة" : "Compliance Rate by Job Title"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {healthCertificateAnalysis.jobCompliance.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {healthCertificateAnalysis.jobCompliance.map((job, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div>
                              <p className="font-medium text-sm">{job.job}</p>
                              <p className="text-xs text-gray-500">{job.valid}/{job.total} {isRTL ? "موظف" : "employees"}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${job.rate >= 80 ? "bg-green-500" : job.rate >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                                  style={{ width: `${job.rate}%` }}
                                />
                              </div>
                              <span className={`font-bold text-sm ${job.rate >= 80 ? "text-green-600" : job.rate >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                                {job.rate}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 text-gray-500">{isRTL ? "لا توجد بيانات" : "No data available"}</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Renewal Needed Table */}
              <Card data-testid="health-renewal-table">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    {isRTL ? "الموظفين الذين يحتاجون تجديد الشهادة الصحية" : "Employees Needing Health Certificate Renewal"}
                  </CardTitle>
                  <CardDescription>{isRTL ? "شهادات منتهية أو غير موجودة أو تنتهي خلال 30 يوم" : "Expired, missing, or expiring within 30 days"}</CardDescription>
                </CardHeader>
                <CardContent>
                  {healthCertificateAnalysis.needsRenewal.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">{isRTL ? "الموظف" : "Employee"}</TableHead>
                            <TableHead className="text-right">{isRTL ? "الفرع" : "Branch"}</TableHead>
                            <TableHead className="text-right">{isRTL ? "الوظيفة" : "Job Title"}</TableHead>
                            <TableHead className="text-right">{isRTL ? "الحالة" : "Status"}</TableHead>
                            <TableHead className="text-right">{isRTL ? "تاريخ الانتهاء" : "Expiry Date"}</TableHead>
                            <TableHead className="text-right">{isRTL ? "الجوال" : "Phone"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {healthCertificateAnalysis.needsRenewal.map((emp, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{emp.employeeName}</TableCell>
                              <TableCell>{getBranchName(emp.branchId)}</TableCell>
                              <TableCell>{emp.jobTitle}</TableCell>
                              <TableCell>
                                <Badge className={
                                  emp.healthCertificate === "expired" ? "bg-red-100 text-red-800" :
                                  emp.healthCertificate === "none" || !emp.healthCertificate ? "bg-gray-100 text-gray-800" :
                                  "bg-yellow-100 text-yellow-800"
                                }>
                                  {emp.healthCertificate === "expired" ? (isRTL ? "منتهية" : "Expired") : 
                                   emp.healthCertificate === "none" || !emp.healthCertificate ? (isRTL ? "لا توجد" : "None") : (isRTL ? "تنتهي قريباً" : "Expiring Soon")}
                                </Badge>
                              </TableCell>
                              <TableCell>{emp.healthCertificateExpiry || "--"}</TableCell>
                              <TableCell dir="ltr">{emp.phoneNumber || "--"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-green-600">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                      {isRTL ? "جميع الموظفين لديهم شهادات صحية سارية" : "All employees have valid health certificates"}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Comprehensive Comparisons Tab */}
            <TabsContent value="comparisons" className="space-y-4" data-testid="tab-content-comparisons">
              <div className="flex justify-end mb-4 gap-2">
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!comprehensiveComparisons) return;
                  const XLSX = await import("xlsx");
                  const wb = XLSX.utils.book_new();
                  const branchSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.branchSalaryStats.map(b => ({
                    [isRTL ? "الفرع" : "Branch"]: b.branchName,
                    [isRTL ? "عدد الموظفين" : "Employee Count"]: b.employeeCount,
                    [isRTL ? "إجمالي الرواتب" : "Total Salary"]: b.totalSalary,
                    [isRTL ? "متوسط الراتب" : "Avg Salary"]: b.avgSalary,
                    [isRTL ? "أعلى راتب" : "Max Salary"]: b.maxSalary,
                    [isRTL ? "أقل راتب" : "Min Salary"]: b.minSalary,
                    [isRTL ? "الأعلى راتباً" : "Highest Paid"]: b.highestPaid,
                    [isRTL ? "الأقل راتباً" : "Lowest Paid"]: b.lowestPaid,
                  })));
                  XLSX.utils.book_append_sheet(wb, branchSheet, isRTL ? "مقارنة الفروع" : "Branch Comparison");
                  const natSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.nationalityStats.map(n => ({
                    [isRTL ? "الجنسية" : "Nationality"]: n.nationality,
                    [isRTL ? "العدد" : "Count"]: n.count,
                    [isRTL ? "النسبة" : "Percentage"]: `${n.percentage}%`,
                    [isRTL ? "متوسط الراتب" : "Avg Salary"]: n.avgSalary,
                    [isRTL ? "إجمالي الرواتب" : "Total Salary"]: n.totalSalary,
                  })));
                  XLSX.utils.book_append_sheet(wb, natSheet, isRTL ? "مقارنة الجنسيات" : "Nationality Comparison");
                  const jobSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.jobAcrossBranches.map(j => ({
                    [isRTL ? "الوظيفة" : "Job Title"]: j.jobTitle,
                    [isRTL ? "العدد" : "Count"]: j.totalCount,
                    [isRTL ? "متوسط الراتب" : "Avg Salary"]: j.overallAvgSalary,
                    [isRTL ? "أعلى فرع" : "Highest Branch"]: j.highestPayingBranch,
                    [isRTL ? "أقل فرع" : "Lowest Branch"]: j.lowestPayingBranch,
                    [isRTL ? "فجوة الراتب" : "Salary Gap"]: j.salaryGap,
                  })));
                  XLSX.utils.book_append_sheet(wb, jobSheet, isRTL ? "مقارنة الوظائف" : "Job Comparison");
                  const tenureSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.tenureRanges.map(t => ({
                    [isRTL ? "مدة الخدمة" : "Tenure"]: t.range,
                    [isRTL ? "عدد الموظفين" : "Employee Count"]: t.count,
                  })));
                  XLSX.utils.book_append_sheet(wb, tenureSheet, isRTL ? "مدة الخدمة" : "Tenure");
                  const salaryGapSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.salaryGapByJob.map(g => ({
                    [isRTL ? "الوظيفة" : "Job Title"]: g.jobTitle,
                    [isRTL ? "أعلى جنسية" : "Highest Paid Nat."]: g.highestPaidNat,
                    [isRTL ? "أقل جنسية" : "Lowest Paid Nat."]: g.lowestPaidNat,
                    [isRTL ? "فجوة الراتب" : "Salary Gap"]: g.maxGap,
                  })));
                  XLSX.utils.book_append_sheet(wb, salaryGapSheet, isRTL ? "فجوة الرواتب" : "Salary Gap");
                  const allowancesSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.allowancesAnalysis.map(a => ({
                    [isRTL ? "الفرع" : "Branch"]: a.branchName,
                    [isRTL ? "الموظفين" : "Employees"]: a.employeeCount,
                    [isRTL ? "بدل السكن" : "Housing"]: a.housingAllowance,
                    [isRTL ? "بدل النقل" : "Transport"]: a.transportAllowance,
                    [isRTL ? "بدل الطعام" : "Food"]: a.foodAllowance,
                    [isRTL ? "بدلات أخرى" : "Other"]: a.otherAllowances,
                    [isRTL ? "إجمالي البدلات" : "Total Allowances"]: a.totalAllowances,
                    [isRTL ? "متوسط/موظف" : "Avg/Employee"]: a.avgAllowancePerEmployee,
                  })));
                  XLSX.utils.book_append_sheet(wb, allowancesSheet, isRTL ? "تحليل البدلات" : "Allowances Analysis");
                  const costSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.monthlyCostAnalysis.map(c => ({
                    [isRTL ? "الفرع" : "Branch"]: c.branchName,
                    [isRTL ? "الموظفين" : "Employees"]: c.employeeCount,
                    [isRTL ? "الرواتب" : "Salaries"]: c.totalSalaries,
                    [isRTL ? "البدلات" : "Allowances"]: c.totalAllowances,
                    [isRTL ? "التأمينات" : "Insurance"]: c.socialInsurance,
                    [isRTL ? "إجمالي التكلفة" : "Total Cost"]: c.totalCost,
                    [isRTL ? "تكلفة/موظف" : "Cost/Employee"]: c.costPerEmployee,
                  })));
                  XLSX.utils.book_append_sheet(wb, costSheet, isRTL ? "التكلفة الشهرية" : "Monthly Cost");
                  XLSX.writeFile(wb, `comparisons_report_${selectedMonth}.xlsx`);
                }} data-testid="button-export-comparisons-excel">
                  <FileSpreadsheet className="w-4 h-4 ml-1" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!comprehensiveComparisons) return;
                  try {
                    const response = await fetch("/api/pdf/comparisons", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({
                        month: selectedMonth,
                        branchStats: comprehensiveComparisons.branchSalaryStats.map(b => ({
                          branchName: b.branchName,
                          employeeCount: b.employeeCount,
                          avgSalary: b.avgSalary,
                          maxSalary: b.maxSalary,
                          minSalary: b.minSalary,
                        })),
                        nationalityStats: comprehensiveComparisons.nationalityStats.map(n => ({
                          nationality: n.nationality,
                          count: n.count,
                          percentage: n.percentage,
                          avgSalary: n.avgSalary,
                        })),
                      }),
                    });
                    if (!response.ok) throw new Error("Failed to generate PDF");
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `comparisons_report_${selectedMonth}.pdf`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                  } catch (error) {
                    console.error("Error exporting comparisons PDF:", error);
                    toast({
                      title: isRTL ? "فشل تصدير PDF للمقارنات" : "Failed to export comparisons PDF",
                      description: (error as Error)?.message,
                      variant: "destructive",
                    });
                  }
                }} data-testid="button-export-comparisons-pdf">
                  <FileText className="w-4 h-4 ml-1" />
                  PDF
                </Button>
              </div>

              {comprehensiveComparisons ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-blue-700">{formatNumber(comprehensiveComparisons.summary.totalBranches)}</p>
                        <p className="text-sm text-blue-600">{isRTL ? "عدد الفروع" : "Total Branches"}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-green-700">{formatNumber(comprehensiveComparisons.summary.totalActiveEmployees)}</p>
                        <p className="text-sm text-green-600">{isRTL ? "موظف نشط" : "Active Employees"}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-amber-700">{formatCurrency(comprehensiveComparisons.summary.overallAvgSalary, isRTL)}</p>
                        <p className="text-sm text-amber-600">{isRTL ? "متوسط الراتب" : "Average Salary"}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-lg font-bold text-teal-700">{comprehensiveComparisons.summary.highestAvgBranch}</p>
                        <p className="text-sm text-teal-600">{isRTL ? "أعلى متوسط" : "Highest Average"}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-lg font-bold text-purple-700">{comprehensiveComparisons.summary.lowestAvgBranch}</p>
                        <p className="text-sm text-purple-600">{isRTL ? "أقل متوسط" : "Lowest Average"}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Branch Salary Comparison */}
                  <Card data-testid="card-branch-salary-comparison">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        {isRTL ? "مقارنة الرواتب حسب الفروع" : "Salary Comparison by Branch"}
                      </CardTitle>
                      <CardDescription>{isRTL ? "أعلى وأقل راتب في كل فرع مع المتوسط" : "Highest and lowest salary in each branch with average"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right w-[120px]">{isRTL ? "الفرع" : "Branch"}</TableHead>
                              <TableHead className="text-center w-[80px]">{isRTL ? "عدد الموظفين" : "Employees"}</TableHead>
                              <TableHead className="text-center w-[100px]">{isRTL ? "إجمالي الرواتب" : "Total Salaries"}</TableHead>
                              <TableHead className="text-center w-[90px]">{isRTL ? "متوسط الراتب" : "Avg. Salary"}</TableHead>
                              <TableHead className="text-center w-[80px]">{isRTL ? "أعلى راتب" : "Max Salary"}</TableHead>
                              <TableHead className="text-center w-[80px]">{isRTL ? "أقل راتب" : "Min Salary"}</TableHead>
                              <TableHead className="text-center w-[140px]">{isRTL ? "الأعلى راتباً" : "Highest Paid"}</TableHead>
                              <TableHead className="text-center w-[140px]">{isRTL ? "الأقل راتباً" : "Lowest Paid"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comprehensiveComparisons.branchSalaryStats.map((branch, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium text-right">{branch.branchName}</TableCell>
                                <TableCell className="text-center">{formatNumber(branch.employeeCount)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.totalSalary, isRTL)}</TableCell>
                                <TableCell className="text-center font-bold text-amber-600">{formatCurrency(branch.avgSalary, isRTL)}</TableCell>
                                <TableCell className="text-center text-green-600">{formatCurrency(branch.maxSalary, isRTL)}</TableCell>
                                <TableCell className="text-center text-red-600">{formatCurrency(branch.minSalary, isRTL)}</TableCell>
                                <TableCell className="text-center">{branch.highestPaid}</TableCell>
                                <TableCell className="text-center">{branch.lowestPaid}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Nationality Comparison */}
                    <Card data-testid="card-nationality-comparison">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          {isRTL ? "مقارنة حسب الجنسيات" : "Comparison by Nationality"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={comprehensiveComparisons.nationalityStats.slice(0, 8)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="nationality" />
                            <YAxis />
                            <Tooltip formatter={(value) => formatNumber(Number(value))} />
                            <Bar dataKey="count" fill="#f59e0b" name={isRTL ? "العدد" : "Count"} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                          {comprehensiveComparisons.nationalityStats.map((nat, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <span className="font-medium">{nat.nationality}</span>
                                <span className="text-xs text-gray-500 mr-2">({nat.percentage}%)</span>
                              </div>
                              <div className="text-left">
                                <span className="font-bold">{formatNumber(nat.count)}</span>
                                <span className="text-xs text-gray-500 mr-2">{isRTL ? "متوسط" : "avg"}: {formatCurrency(nat.avgSalary, isRTL)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Employee Count per Branch */}
                    <Card data-testid="card-branch-count-comparison">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="w-5 h-5" />
                          {isRTL ? "عدد الموظفين حسب الفرع" : "Employees by Branch"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={comprehensiveComparisons.branchEmployeeCounts} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="branchName" type="category" width={80} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="active" stackId="a" fill="#10b981" name={isRTL ? "نشط" : "Active"} />
                            <Bar dataKey="onLeave" stackId="a" fill="#f59e0b" name={isRTL ? "إجازة" : "On Leave"} />
                            <Bar dataKey="terminated" stackId="a" fill="#ef4444" name={isRTL ? "منتهي" : "Terminated"} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Job Title Comparison Across Branches */}
                  <Card data-testid="card-job-comparison-branches">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        {isRTL ? "مقارنة الوظائف عبر الفروع" : "Job Comparison Across Branches"}
                      </CardTitle>
                      <CardDescription>{isRTL ? "متوسط الراتب لكل وظيفة مع الفرق بين الفروع" : "Average salary per job title with branch differences"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto max-h-96">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right w-[120px]">{isRTL ? "الوظيفة" : "Job Title"}</TableHead>
                              <TableHead className="text-center w-[70px]">{isRTL ? "العدد" : "Count"}</TableHead>
                              <TableHead className="text-center w-[100px]">{isRTL ? "متوسط الراتب" : "Avg. Salary"}</TableHead>
                              <TableHead className="text-center w-[120px]">{isRTL ? "أعلى فرع" : "Highest Branch"}</TableHead>
                              <TableHead className="text-center w-[120px]">{isRTL ? "أقل فرع" : "Lowest Branch"}</TableHead>
                              <TableHead className="text-center w-[90px]">{isRTL ? "فجوة الراتب" : "Salary Gap"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comprehensiveComparisons.jobAcrossBranches.map((job, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium text-right">{job.jobTitle}</TableCell>
                                <TableCell className="text-center">{formatNumber(job.totalCount)}</TableCell>
                                <TableCell className="text-center font-bold text-amber-600">{formatCurrency(job.overallAvgSalary, isRTL)}</TableCell>
                                <TableCell className="text-center text-green-600">{job.highestPayingBranch}</TableCell>
                                <TableCell className="text-center text-red-600">{job.lowestPayingBranch}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={job.salaryGap > 1000 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                                    {formatCurrency(job.salaryGap, isRTL)}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Salary Distribution */}
                  <Card data-testid="card-salary-distribution">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="w-5 h-5" />
                        {isRTL ? "توزيع الرواتب" : "Salary Distribution"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={comprehensiveComparisons.salaryRanges}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#8b5cf6" name={isRTL ? "عدد الموظفين" : "Employee Count"} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Tenure Distribution - مدة الخدمة */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card data-testid="card-tenure-distribution">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="w-5 h-5" />
                          {isRTL ? "توزيع الموظفين حسب مدة الخدمة" : "Employee Distribution by Tenure"}
                        </CardTitle>
                        <CardDescription>{isRTL ? `متوسط مدة الخدمة: ${comprehensiveComparisons.summary.avgTenure} سنة` : `Average tenure: ${comprehensiveComparisons.summary.avgTenure} years`}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={comprehensiveComparisons.tenureRanges}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="range" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#10b981" name={isRTL ? "عدد الموظفين" : "Employee Count"} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          {comprehensiveComparisons.tenureRanges.map((range, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm font-medium">{range.range}</span>
                              <Badge variant="secondary">{formatNumber(range.count)} {isRTL ? "موظف" : "employees"}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-tenure-by-branch">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="w-5 h-5" />
                          {isRTL ? "متوسط مدة الخدمة حسب الفرع" : "Average Tenure by Branch"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {comprehensiveComparisons.tenureByBranch.map((branch, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <span className="font-medium">{branch.branchName}</span>
                                <span className="text-xs text-gray-500 mr-2">({branch.count} {isRTL ? "موظف" : "employees"})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${branch.avgTenure >= 3 ? "bg-green-500" : branch.avgTenure >= 1 ? "bg-yellow-500" : "bg-red-500"}`}
                                    style={{ width: `${Math.min(branch.avgTenure * 20, 100)}%` }}
                                  />
                                </div>
                                <Badge className={
                                  branch.avgTenure >= 3 ? "bg-green-100 text-green-800" :
                                  branch.avgTenure >= 1 ? "bg-yellow-100 text-yellow-800" :
                                  "bg-red-100 text-red-800"
                                }>
                                  {branch.avgTenure} {isRTL ? "سنة" : "yrs"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Salary Gap Analysis - تحليل الفجوة الراتبية */}
                  <Card data-testid="card-salary-gap-analysis">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-red-500" />
                        {isRTL ? "تحليل الفجوة الراتبية بين الجنسيات لنفس الوظيفة" : "Salary Gap Analysis by Nationality per Job"}
                      </CardTitle>
                      <CardDescription>{isRTL ? "الوظائف التي بها فرق في الراتب بين الجنسيات المختلفة" : "Jobs with salary differences between nationalities"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {comprehensiveComparisons.salaryGapByJob.length > 0 ? (
                        <div className="overflow-x-auto max-h-96">
                          <Table className="table-fixed w-full">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right w-[100px]">{isRTL ? "الوظيفة" : "Job Title"}</TableHead>
                                <TableHead className="text-center w-[250px]">{isRTL ? "الجنسيات والرواتب" : "Nationalities & Salaries"}</TableHead>
                                <TableHead className="text-center w-[90px]">{isRTL ? "أعلى جنسية" : "Highest Nat."}</TableHead>
                                <TableHead className="text-center w-[90px]">{isRTL ? "أقل جنسية" : "Lowest Nat."}</TableHead>
                                <TableHead className="text-center w-[90px]">{isRTL ? "فجوة الراتب" : "Salary Gap"}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {comprehensiveComparisons.salaryGapByJob.map((job, i) => (
                                <TableRow key={i}>
                                  <TableCell className="font-medium text-right">{job.jobTitle}</TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex flex-wrap gap-1 justify-center">
                                      {job.nationalityComparisons.map((nat, j) => (
                                        <Badge key={j} variant="outline" className="text-xs">
                                          {nat.nationality}: {formatCurrency(nat.avgSalary, isRTL)} ({nat.count})
                                        </Badge>
                                      ))}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center text-green-600 font-medium">{job.highestPaidNat}</TableCell>
                                  <TableCell className="text-center text-red-600 font-medium">{job.lowestPaidNat}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge className={
                                      job.maxGap > 2000 ? "bg-red-100 text-red-800" :
                                      job.maxGap > 1000 ? "bg-yellow-100 text-yellow-800" :
                                      "bg-green-100 text-green-800"
                                    }>
                                      {formatCurrency(job.maxGap, isRTL)}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500" />
                          {isRTL ? "لا توجد فجوات راتبية ملحوظة بين الجنسيات" : "No notable salary gaps between nationalities"}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* تحليل البدلات حسب الفرع */}
                  <Card data-testid="card-allowances-analysis">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-blue-500" />
                        {isRTL ? "تحليل البدلات حسب الفرع" : "Allowances Analysis by Branch"}
                      </CardTitle>
                      <CardDescription>{isRTL ? "مقارنة بدل السكن والنقل والطعام بين الفروع" : "Housing, transport, and food allowance comparison across branches"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={comprehensiveComparisons.allowancesAnalysis}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="branchName" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value), isRTL)} />
                          <Legend />
                          <Bar dataKey="housingAllowance" stackId="a" fill="#3b82f6" name={isRTL ? "بدل السكن" : "Housing"} />
                          <Bar dataKey="transportAllowance" stackId="a" fill="#10b981" name={isRTL ? "بدل النقل" : "Transport"} />
                          <Bar dataKey="foodAllowance" stackId="a" fill="#f59e0b" name={isRTL ? "بدل الطعام" : "Food"} />
                          <Bar dataKey="otherAllowances" stackId="a" fill="#8b5cf6" name={isRTL ? "بدلات أخرى" : "Other"} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 overflow-x-auto">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right w-[120px]">{isRTL ? "الفرع" : "Branch"}</TableHead>
                              <TableHead className="text-center w-[80px]">{isRTL ? "الموظفين" : "Employees"}</TableHead>
                              <TableHead className="text-center w-[100px]">{isRTL ? "بدل السكن" : "Housing"}</TableHead>
                              <TableHead className="text-center w-[100px]">{isRTL ? "بدل النقل" : "Transport"}</TableHead>
                              <TableHead className="text-center w-[110px]">{isRTL ? "إجمالي البدلات" : "Total Allow."}</TableHead>
                              <TableHead className="text-center w-[100px]">{isRTL ? "متوسط/موظف" : "Avg/Employee"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comprehensiveComparisons.allowancesAnalysis.map((branch, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium text-right">{branch.branchName}</TableCell>
                                <TableCell className="text-center">{formatNumber(branch.employeeCount)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.housingAllowance, isRTL)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.transportAllowance, isRTL)}</TableCell>
                                <TableCell className="text-center font-bold text-blue-600">{formatCurrency(branch.totalAllowances, isRTL)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.avgAllowancePerEmployee, isRTL)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* التكلفة الشهرية الإجمالية */}
                  <Card data-testid="card-monthly-cost-analysis">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        {isRTL ? "التكلفة الشهرية الإجمالية لكل فرع" : "Total Monthly Cost by Branch"}
                      </CardTitle>
                      <CardDescription>
                        {isRTL 
                          ? `إجمالي التكاليف: ${formatCurrency(comprehensiveComparisons.summary.grandTotalCost || 0, isRTL)} (رواتب: ${formatCurrency(comprehensiveComparisons.summary.grandTotalSalaries || 0, isRTL)} + بدلات: ${formatCurrency(comprehensiveComparisons.summary.grandTotalAllowances || 0, isRTL)} + تأمينات: ${formatCurrency(comprehensiveComparisons.summary.grandTotalInsurance || 0, isRTL)})`
                          : `Total costs: ${formatCurrency(comprehensiveComparisons.summary.grandTotalCost || 0, isRTL)} (Salaries: ${formatCurrency(comprehensiveComparisons.summary.grandTotalSalaries || 0, isRTL)} + Allowances: ${formatCurrency(comprehensiveComparisons.summary.grandTotalAllowances || 0, isRTL)} + Insurance: ${formatCurrency(comprehensiveComparisons.summary.grandTotalInsurance || 0, isRTL)})`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={comprehensiveComparisons.monthlyCostAnalysis} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                          <YAxis dataKey="branchName" type="category" width={100} />
                          <Tooltip formatter={(value) => formatCurrency(Number(value), isRTL)} />
                          <Legend />
                          <Bar dataKey="totalSalaries" stackId="a" fill="#10b981" name={isRTL ? "الرواتب" : "Salaries"} />
                          <Bar dataKey="totalAllowances" stackId="a" fill="#3b82f6" name={isRTL ? "البدلات" : "Allowances"} />
                          <Bar dataKey="socialInsurance" stackId="a" fill="#f59e0b" name={isRTL ? "التأمينات" : "Insurance"} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 overflow-x-auto">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right w-[120px]">{isRTL ? "الفرع" : "Branch"}</TableHead>
                              <TableHead className="text-center w-[80px]">{isRTL ? "الموظفين" : "Employees"}</TableHead>
                              <TableHead className="text-center w-[100px]">{isRTL ? "الرواتب" : "Salaries"}</TableHead>
                              <TableHead className="text-center w-[90px]">{isRTL ? "البدلات" : "Allowances"}</TableHead>
                              <TableHead className="text-center w-[90px]">{isRTL ? "التأمينات" : "Insurance"}</TableHead>
                              <TableHead className="text-center w-[110px]">{isRTL ? "إجمالي التكلفة" : "Total Cost"}</TableHead>
                              <TableHead className="text-center w-[100px]">{isRTL ? "تكلفة/موظف" : "Cost/Employee"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comprehensiveComparisons.monthlyCostAnalysis.map((branch, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium text-right">{branch.branchName}</TableCell>
                                <TableCell className="text-center">{formatNumber(branch.employeeCount)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.totalSalaries, isRTL)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.totalAllowances, isRTL)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.socialInsurance, isRTL)}</TableCell>
                                <TableCell className="text-center font-bold text-green-600">{formatCurrency(branch.totalCost, isRTL)}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-purple-100 text-purple-800">
                                    {formatCurrency(branch.costPerEmployee, isRTL)}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ترتيب الفروع حسب الكفاءة المالية */}
                  <Card data-testid="card-efficiency-ranking">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                        {isRTL ? "ترتيب الفروع حسب تكلفة الموظف" : "Branch Ranking by Employee Cost"}
                      </CardTitle>
                      <CardDescription>{isRTL ? "الفروع مرتبة من الأقل تكلفة إلى الأعلى (الأقل = الأكثر كفاءة)" : "Branches ranked from lowest to highest cost (lowest = most efficient)"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[...comprehensiveComparisons.monthlyCostAnalysis].sort((a, b) => a.costPerEmployee - b.costPerEmployee).map((branch, i) => {
                          const maxCost = Math.max(...comprehensiveComparisons.monthlyCostAnalysis.map(b => b.costPerEmployee));
                          const percentage = maxCost > 0 ? (branch.costPerEmployee / maxCost) * 100 : 0;
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                i === 0 ? "bg-green-500" : i === 1 ? "bg-blue-500" : i === 2 ? "bg-amber-500" : "bg-gray-400"
                              }`}>
                                {i + 1}
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                  <span className="font-medium">{branch.branchName}</span>
                                  <span className="text-sm text-gray-600">{formatCurrency(branch.costPerEmployee, isRTL)} / {isRTL ? "موظف" : "employee"}</span>
                                </div>
                                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${i === 0 ? "bg-green-500" : i === 1 ? "bg-blue-500" : i === 2 ? "bg-amber-500" : "bg-gray-400"}`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-10 text-gray-500">{isRTL ? "لا توجد بيانات" : "No data available"}</div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <Dialog open={showSalaryClosingDialog} onOpenChange={setShowSalaryClosingDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                تقرير إغلاق الرواتب الشهرية
              </DialogTitle>
              <DialogDescription>
                إنشاء تقرير شهري شامل للرواتب يتضمن الحضور والغياب وساعات العمل
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>الفرع *</Label>
                  <Select value={salaryClosingBranch} onValueChange={setSalaryClosingBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {branches?.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الشهر *</Label>
                  <Input 
                    type="month" 
                    value={salaryClosingMonth} 
                    onChange={(e) => setSalaryClosingMonth(e.target.value)}
                  />
                </div>
              </div>

              {salaryClosingBranch && salaryClosingData.length > 0 && (
                <>
                  {salaryClosingUnlinkedCount > 0 && (
                    <Card className="border-orange-200 bg-orange-50">
                      <CardContent className="py-3">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-orange-800">
                              تنبيه: {formatNumber(salaryClosingUnlinkedCount)} سجل حضور غير مرتبط لهذا الفرع/الشهر
                            </p>
                            <div className="flex gap-4 mt-1 text-sm text-orange-700">
                              <span>سجلات حضور: {formatNumber(salaryClosingUnlinkedSummary.presentRecords)}</span>
                              <span>إجمالي الساعات: {formatNumber(Math.round(salaryClosingUnlinkedSummary.totalHours * 10) / 10)}</span>
                            </div>
                            <p className="text-sm text-orange-600 mt-1">
                              هذه السجلات غير مضمنة في حساب الرواتب - ملف Excel يحتوي على تفاصيل كاملة للمراجعة
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!salaryClosingReady && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-800" data-testid="alert-loading-salary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري تحميل بيانات الجدول والبصمات لـ {getBranchName(salaryClosingBranch)} - {salaryClosingMonth}...</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={exportSalaryClosingToExcel}
                      disabled={!salaryClosingReady || salaryClosingData.length === 0}
                      data-testid="button-export-salary-excel"
                    >
                      <FileSpreadsheet className="w-4 h-4 ml-2" />
                      تصدير Excel
                    </Button>
                    <Button
                      variant="outline"
                      onClick={exportSalaryClosingToPDF}
                      disabled={!salaryClosingReady || salaryClosingData.length === 0}
                      data-testid="button-export-salary-pdf"
                    >
                      <Download className="w-4 h-4 ml-2" />
                      تصدير PDF
                    </Button>
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">
                        ملخص الرواتب - {getBranchName(salaryClosingBranch)} - {salaryClosingMonth}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg" data-testid="card-employee-count">
                          <p className="text-2xl font-bold text-blue-600">{salaryClosingData.length}</p>
                          <p className="text-sm text-gray-600">عدد الموظفين</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg" data-testid="card-gross-salary">
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.grossSalary, 0))}
                          </p>
                          <p className="text-sm text-gray-600">إجمالي الرواتب</p>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg" data-testid="card-absence-deduction" title="إجمالي خصومات الغياب: عدد أيام الغياب × (الراتب الإجمالي ÷ 30)">
                          <p className="text-2xl font-bold text-orange-600">
                            {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.absenceDeduction, 0))}
                          </p>
                          <p className="text-sm text-gray-600">خصم الغياب</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-lg" data-testid="card-social-insurance">
                          <p className="text-2xl font-bold text-red-600">
                            {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.socialInsurance, 0))}
                          </p>
                          <p className="text-sm text-gray-600">التأمينات الاجتماعية</p>
                        </div>
                        <div className="text-center p-3 bg-orange-100 rounded-lg border border-orange-300" data-testid="card-manual-deductions" title="إجمالي السُلف والخصومات اليدوية المُدخلة لهذا الشهر">
                          <p className="text-2xl font-bold text-orange-700">
                            {formatCurrency(salaryClosingData.reduce((sum, e) => sum + (e.manualDeductionsTotal || 0), 0))}
                          </p>
                          <p className="text-sm text-gray-700">سُلف وخصومات</p>
                        </div>
                        <div className="text-center p-3 bg-amber-50 rounded-lg" data-testid="card-net-salary">
                          <p className="text-2xl font-bold text-amber-600">
                            {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.netSalary, 0))}
                          </p>
                          <p className="text-sm text-gray-600">صافي الرواتب</p>
                        </div>
                      </div>

                      {/* ملخص الحضور والغياب من الجدول الموقّع */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                        <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-100" data-testid="summary-scheduled-days">
                          <p className="text-xl font-bold text-blue-700">
                            {salaryClosingData.reduce((sum, e) => sum + e.scheduledWorkDays, 0)}
                          </p>
                          <p className="text-[11px] text-gray-600">أيام عمل مجدولة</p>
                        </div>
                        <div className="text-center p-2 bg-green-50 rounded-lg border border-green-100" data-testid="summary-present">
                          <p className="text-xl font-bold text-green-700">
                            {salaryClosingData.reduce((sum, e) => sum + e.presentDays, 0)}
                          </p>
                          <p className="text-[11px] text-gray-600">إجمالي الحضور</p>
                        </div>
                        <div className="text-center p-2 bg-red-50 rounded-lg border border-red-100" data-testid="summary-absent">
                          <p className="text-xl font-bold text-red-700">
                            {salaryClosingData.reduce((sum, e) => sum + e.absentDays, 0)}
                          </p>
                          <p className="text-[11px] text-gray-600">إجمالي الغياب</p>
                        </div>
                        <div className="text-center p-2 bg-amber-50 rounded-lg border border-amber-100" data-testid="summary-off">
                          <p className="text-xl font-bold text-amber-700">
                            {salaryClosingData.reduce((sum, e) => sum + e.offDays, 0)}
                          </p>
                          <p className="text-[11px] text-gray-600">إجمالي الإجازات</p>
                        </div>
                        <div className="text-center p-2 bg-purple-50 rounded-lg border border-purple-100" data-testid="summary-hours">
                          <p className="text-xl font-bold text-purple-700">
                            {Math.round(salaryClosingData.reduce((sum, e) => sum + e.totalHours, 0) * 10) / 10}
                          </p>
                          <p className="text-[11px] text-gray-600">إجمالي الساعات</p>
                        </div>
                      </div>

                      {/* مؤشر مصدر البيانات: تايم شيت موقّع vs جدول vs بصمة فقط */}
                      {(() => {
                        const signedCount = salaryClosingData.filter(e => e.dataSource === "signed_timesheet").length;
                        const scheduleCount = salaryClosingData.filter(e => e.dataSource === "schedule_attendance").length;
                        const attendanceOnlyCount = salaryClosingData.filter(e => e.dataSource === "attendance_only").length;
                        const total = salaryClosingData.length;
                        if (total === 0) return null;
                        const signedPct = Math.round((signedCount / total) * 100);
                        return (
                          <div className="mb-4 p-3 border rounded-lg bg-gradient-to-r from-emerald-50 to-blue-50" data-testid="data-source-summary">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-gray-700">مصدر بيانات الحضور لكل موظف</p>
                              <Badge className={signedPct === 100 ? "bg-emerald-600" : signedPct >= 50 ? "bg-emerald-500" : "bg-orange-500"}>
                                {signedPct}% موقّع
                              </Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="flex items-center gap-2 p-2 bg-emerald-100 rounded text-xs" data-testid="count-signed">
                                <span className="text-emerald-700 font-bold text-lg">{signedCount}</span>
                                <div>
                                  <p className="font-semibold text-emerald-900">✓ تايم شيت موقّع</p>
                                  <p className="text-[10px] text-emerald-700">مصدر الحقيقة</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-blue-100 rounded text-xs" data-testid="count-schedule">
                                <span className="text-blue-700 font-bold text-lg">{scheduleCount}</span>
                                <div>
                                  <p className="font-semibold text-blue-900">جدول + بصمة</p>
                                  <p className="text-[10px] text-blue-700">لم يتم توقيع التايم شيت</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 p-2 bg-orange-100 rounded text-xs" data-testid="count-attendance-only">
                                <span className="text-orange-700 font-bold text-lg">{attendanceOnlyCount}</span>
                                <div>
                                  <p className="font-semibold text-orange-900">بصمة فقط</p>
                                  <p className="text-[10px] text-orange-700">بدون جدول ولا توقيع</p>
                                </div>
                              </div>
                            </div>
                            {signedCount < total && (
                              <p className="text-[11px] text-gray-600 mt-2">
                                💡 لضمان الدقة الكاملة وحل أي تناقض في البيانات، أنصح بإصدار وتوقيع التايم شيت لكل الموظفين قبل إغلاق الرواتب.
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      {salaryClosingData.every(e => e.scheduledWorkDays === 0) && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800" data-testid="alert-no-schedule">
                          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold">لا يوجد جدول دوام موقّع لهذا الفرع في هذا الشهر</p>
                            <p className="text-xs text-amber-700 mt-1">الأرقام تعتمد على سجلات الحضور المباشرة فقط. لحساب أدق، أنشئ الجدول الأسبوعي للموظفين من قسم "جدول الدوام".</p>
                          </div>
                        </div>
                      )}

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className={isRTL ? "text-right" : "text-left"}>#</TableHead>
                            <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "رقم الموظف" : "Employee #"}</TableHead>
                            <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الاسم" : "Name"}</TableHead>
                            <TableHead className={isRTL ? "text-right" : "text-left"}>{isRTL ? "الوظيفة" : "Job Title"}</TableHead>
                            <TableHead className={isRTL ? "text-right" : "text-left"} title={isRTL ? "البنك ورقم الحساب البنكي / الآيبان (من ملف الموظف)" : "Bank & IBAN (from employee profile)"}>{isRTL ? "البنك / الآيبان" : "Bank / IBAN"}</TableHead>
                            <TableHead className="text-center" title={isRTL ? "أيام العمل المجدولة (من الجدول الموقّع)" : "Scheduled work days"}>{isRTL ? "أيام العمل" : "Work Days"}</TableHead>
                            <TableHead className="text-center">{isRTL ? "الحضور" : "Present"}</TableHead>
                            <TableHead className="text-center">{isRTL ? "الغياب" : "Absent"}</TableHead>
                            <TableHead className="text-center" title={isRTL ? "الإجازات (isOff في الجدول الموقّع)" : "Off days from signed schedule"}>{isRTL ? "الإجازات" : "Off"}</TableHead>
                            <TableHead className="text-center">{isRTL ? "الساعات" : "Hours"}</TableHead>
                            <TableHead className="text-center">{isRTL ? "الراتب" : "Salary"}</TableHead>
                            <TableHead className="text-center">{isRTL ? "البدلات" : "Allowances"}</TableHead>
                            <TableHead className="text-center" title={isRTL ? "قيمة اليوم = الراتب الإجمالي ÷ 30" : "Daily rate = Gross salary / 30"}>{isRTL ? "قيمة اليوم" : "Daily Rate"}</TableHead>
                            <TableHead className="text-center" title={isRTL ? "خصم الغياب = أيام الغياب × قيمة اليوم" : "Absence deduction = absent days × daily rate"}>{isRTL ? "خصم الغياب" : "Absence Deduction"}</TableHead>
                            <TableHead className="text-center">{isRTL ? "التأمينات" : "Insurance"}</TableHead>
                            <TableHead className="text-center bg-orange-50" title={isRTL ? "السُلف والخصومات اليدوية الشهرية — اضغط للإضافة/التعديل" : "Manual advances & deductions — click to edit"}>{isRTL ? "سُلف/خصومات" : "Advances/Deductions"}</TableHead>
                            <TableHead className="text-center">{isRTL ? "الصافي" : "Net"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salaryClosingData.map((emp, index) => (
                            <TableRow key={emp.id} className={emp.noWorkAtAll ? "bg-red-50/60" : (emp.dataSource === "signed_timesheet" ? "bg-emerald-50/30" : "")}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-mono">{emp.employeeNumber}</TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{emp.employeeName}</span>
                                  {emp.dataSource === "signed_timesheet" && (
                                    <Badge
                                      className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-1.5 py-0"
                                      title={`تايم شيت موقّع #${emp.signedReportInfo?.id} — مصدر الحقيقة`}
                                      data-testid={`badge-signed-${emp.id}`}
                                    >
                                      ✓ موقّع
                                    </Badge>
                                  )}
                                  {emp.dataSource === "schedule_attendance" && (
                                    <Badge
                                      className="bg-blue-100 text-blue-800 border-blue-300 text-[10px] px-1.5 py-0"
                                      title="محسوب من الجدول + البصمة (لا يوجد تايم شيت موقّع)"
                                      data-testid={`badge-schedule-${emp.id}`}
                                    >
                                      جدول
                                    </Badge>
                                  )}
                                  {emp.dataSource === "attendance_only" && !emp.noWorkAtAll && (
                                    <Badge
                                      className="bg-orange-100 text-orange-800 border-orange-300 text-[10px] px-1.5 py-0"
                                      title="محسوب من البصمة فقط (لا يوجد جدول ولا تايم شيت موقّع)"
                                      data-testid={`badge-attendance-only-${emp.id}`}
                                    >
                                      بصمة فقط
                                    </Badge>
                                  )}
                                  {emp.noWorkAtAll && (
                                    <Badge
                                      className="bg-red-100 text-red-800 border-red-400 text-[10px] px-1.5 py-0"
                                      title="لا يوجد أي حضور أو جدول أو تايم شيت موقّع لهذا الموظف خلال الشهر — يُحتسب غياب كامل والراتب يصير صفر"
                                      data-testid={`badge-no-work-${emp.id}`}
                                    >
                                      ⚠️ غائب الشهر كامل
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{emp.jobTitle}</TableCell>
                              <TableCell className="text-xs" data-testid={`cell-bank-${emp.id}`}>
                                {emp.bankAccountNumber || emp.bankName ? (
                                  <div className="flex flex-col gap-0.5 leading-tight">
                                    {emp.bankName && (
                                      <span className="text-gray-700 font-medium">{emp.bankName}</span>
                                    )}
                                    {emp.bankAccountNumber && (
                                      <span className="font-mono text-[11px] text-gray-900 dir-ltr text-left" style={{ direction: "ltr", textAlign: "left" }}>
                                        {emp.bankAccountNumber}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0" title="لا توجد بيانات بنكية في ملف الموظف — أضفها من شاشة الموظفين">
                                    ⚠️ غير مسجّل
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-blue-100 text-blue-800">{emp.scheduledWorkDays}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button type="button" data-testid={`btn-present-${emp.id}`}>
                                      <Badge className="bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer">{emp.presentDays}</Badge>
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-72 max-h-80 overflow-y-auto" side="top">
                                    <div className="text-xs font-semibold mb-2 text-green-800">
                                      أيام الحضور المحتسبة ({emp.presentDays})
                                    </div>
                                    {emp.presentDates.length === 0 ? (
                                      <p className="text-xs text-gray-500">لا توجد أيام حضور.</p>
                                    ) : (
                                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                                        {emp.presentDates.map(d => (
                                          <div key={d} className="bg-green-50 px-2 py-1 rounded text-center font-mono">{d}</div>
                                        ))}
                                      </div>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell className="text-center">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button type="button" data-testid={`btn-absent-${emp.id}`}>
                                      <Badge className="bg-red-100 text-red-800 hover:bg-red-200 cursor-pointer">{emp.absentDays}</Badge>
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 max-h-96 overflow-y-auto" side="top">
                                    <div className="text-xs font-semibold mb-2 text-red-800">
                                      أيام الغياب المحتسبة ({emp.absentDays})
                                    </div>
                                    {emp.absentDays === 0 ? (
                                      <p className="text-xs text-gray-500">لا توجد أيام غياب.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {emp.absentDatesExplicit.length > 0 && (
                                          <div>
                                            <div className="text-[11px] font-semibold text-red-700 mb-1">
                                              مسجل كغياب صريح ({emp.absentDatesExplicit.length}):
                                            </div>
                                            <div className="grid grid-cols-2 gap-1 text-[11px]">
                                              {emp.absentDatesExplicit.map(d => (
                                                <div key={d} className="bg-red-50 px-2 py-1 rounded text-center font-mono">{d}</div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {emp.absentDatesMissing.length > 0 && (
                                          <div>
                                            <div className="text-[11px] font-semibold text-orange-700 mb-1">
                                              يوم مجدول بدون سجل حضور ({emp.absentDatesMissing.length}):
                                            </div>
                                            <div className="grid grid-cols-2 gap-1 text-[11px]">
                                              {emp.absentDatesMissing.map(d => (
                                                <div key={d} className="bg-orange-50 px-2 py-1 rounded text-center font-mono">{d}</div>
                                              ))}
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-1">
                                              لو تم تسجيل الحضور لاحقاً، سيتم إعادة الحساب تلقائياً.
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell className="text-center">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button type="button" data-testid={`btn-off-${emp.id}`}>
                                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer">{emp.offDays}</Badge>
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-72 max-h-80 overflow-y-auto" side="top">
                                    <div className="text-xs font-semibold mb-2 text-amber-800">
                                      أيام الإجازة ({emp.offDays})
                                    </div>
                                    {emp.offDates.length === 0 ? (
                                      <p className="text-xs text-gray-500">لا توجد أيام إجازة.</p>
                                    ) : (
                                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                                        {emp.offDates.map(d => (
                                          <div key={d} className="bg-amber-50 px-2 py-1 rounded text-center font-mono">{d}</div>
                                        ))}
                                      </div>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell className="text-center">{emp.totalHours}</TableCell>
                              <TableCell className="text-center">{formatCurrency(emp.baseSalary, isRTL)}</TableCell>
                              <TableCell className="text-center">{formatCurrency(emp.allowances, isRTL)}</TableCell>
                              <TableCell className="text-center text-gray-600 text-xs">{formatCurrency(emp.dailyRate, isRTL)}</TableCell>
                              <TableCell className="text-center text-red-600">
                                {emp.absenceDeduction > 0 ? `- ${formatCurrency(emp.absenceDeduction, isRTL)}` : "-"}
                              </TableCell>
                              <TableCell className="text-center text-red-600">
                                {emp.socialInsurance > 0 ? `- ${formatCurrency(emp.socialInsurance, isRTL)}` : "-"}
                              </TableCell>
                              <TableCell className="text-center bg-orange-50/40">
                                <DeductionsPopover
                                  branchEmployeeId={emp.id}
                                  branchId={salaryClosingBranch}
                                  month={salaryClosingMonth}
                                  employeeName={emp.employeeName}
                                  initialDeductions={emp.manualDeductions || []}
                                  totalAmount={emp.manualDeductionsTotal || 0}
                                  onChanged={() => {}}
                                />
                              </TableCell>
                              <TableCell className="text-center font-bold">{formatCurrency(emp.netSalary, isRTL)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}

              {salaryClosingBranch && salaryClosingData.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>{isRTL ? "لا يوجد موظفين نشطين في هذا الفرع" : "No active employees in this branch"}</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
