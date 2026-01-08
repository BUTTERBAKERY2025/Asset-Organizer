import React, { useState, useRef, useMemo } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getQueryFn } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import pdfMake from "pdfmake/build/pdfmake";
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
} from "lucide-react";
import type { BranchEmployee, AttendanceRecord, TimesheetReport } from "@shared/schema";

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "0 ريال";
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) + " ريال";
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
  const [, navigate] = useLocation();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [showSalaryClosingDialog, setShowSalaryClosingDialog] = useState(false);
  const [salaryClosingBranch, setSalaryClosingBranch] = useState<string>("");
  const [salaryClosingMonth, setSalaryClosingMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const { data: branches } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: employees, isLoading: employeesLoading } = useQuery<BranchEmployee[]>({
    queryKey: ["/api/branch-employees"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: attendanceRecords, isLoading: attendanceLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: timesheetReports } = useQuery<TimesheetReport[]>({
    queryKey: ["/api/timesheet-reports"],
    queryFn: getQueryFn({ on401: "returnNull" }),
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
    return {
      ids: new Set(filteredEmployees.map(emp => emp.id)),
      employeeIds: new Set(filteredEmployees.map(emp => emp.id.toString())),
    };
  }, [filteredEmployees]);

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
        if (!matchesByBranchEmployeeId && !matchesByEmployeeId) return false;
      }
      return true;
    });
  }, [attendanceRecords, selectedBranch, selectedMonth, selectedJobTitle, selectedEmployee, filteredEmployeeLookup]);

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
      .reduce((sum, emp) => sum + (emp.socialInsuranceDeduction || 0), 0);
    
    const attendanceCount = allBranchMonthAttendance.length;
    const presentCount = allBranchMonthAttendance.filter(r => r.status === "present").length;
    const absentCount = allBranchMonthAttendance.filter(r => r.status === "absent").length;
    const lateCount = allBranchMonthAttendance.filter(r => r.status === "late").length;
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
  }, [filteredEmployees, allBranchMonthAttendance]);

  const employeeLookupByRecord = useMemo(() => {
    if (!filteredEmployees) return new Map<string, number>();
    const lookup = new Map<string, number>();
    filteredEmployees.forEach(emp => {
      lookup.set(`bid:${emp.id}`, emp.id);
      lookup.set(`eid:${emp.id.toString()}`, emp.id);
      if (emp.employeeNumber) {
        lookup.set(`enum:${emp.employeeNumber}`, emp.id);
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
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredEmployees]);

  const jobTitleChartData = useMemo(() => {
    const map = new Map<string, number>();
    filteredEmployees.forEach(emp => {
      map.set(emp.jobTitle, (map.get(emp.jobTitle) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredEmployees]);

  const branchSalaryData = useMemo(() => {
    const map = new Map<string, number>();
    filteredEmployees.forEach(emp => {
      const branchName = getBranchName(emp.branchId);
      map.set(branchName, (map.get(branchName) || 0) + (emp.totalSalary || emp.salary || 0));
    });
    return Array.from(map.entries()).map(([name, salary]) => ({ name, salary }));
  }, [filteredEmployees, branches]);

  const branchComparisonData = useMemo(() => {
    if (!employees || !branches || !attendanceRecords) return [];
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = `${selectedMonth}-31`;
    
    return branches.map(branch => {
      const branchEmps = employees.filter(emp => emp.branchId === branch.id && emp.status === "active");
      const branchAttendance = attendanceRecords.filter(rec => 
        rec.branchId === branch.id && 
        rec.attendanceDate >= monthStart && 
        rec.attendanceDate <= monthEnd
      );
      
      const employeeCount = branchEmps.length;
      const saudiCount = branchEmps.filter(emp => emp.nationality === "سعودي").length;
      const saudiPercentage = employeeCount > 0 ? Math.round((saudiCount / employeeCount) * 100) : 0;
      const totalSalary = branchEmps.reduce((sum, emp) => sum + (emp.totalSalary || emp.salary || 0), 0);
      const avgSalary = employeeCount > 0 ? Math.round(totalSalary / employeeCount) : 0;
      const totalInsurance = branchEmps.filter(emp => emp.nationality === "سعودي")
        .reduce((sum, emp) => sum + (emp.socialInsuranceDeduction || 0), 0);
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
  }, [employees, branches, attendanceRecords, selectedMonth]);

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
    
    employees.filter(emp => emp.status === "active").forEach(emp => {
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
        (rec.branchEmployeeId === emp.id || rec.employeeId === emp.id.toString()) &&
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
  }, [employees, branches, attendanceRecords, selectedMonth, getBranchName]);

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
      { name: "بدل السكن", value: totals.housing, color: "#3b82f6" },
      { name: "بدل النقل", value: totals.transport, color: "#10b981" },
      { name: "بدل الطعام", value: totals.food, color: "#f59e0b" },
      { name: "بدلات أخرى", value: totals.other, color: "#8b5cf6" },
    ].filter(item => item.value > 0);
  }, [filteredEmployees]);

  const { salaryClosingData, salaryClosingUnlinkedCount, salaryClosingUnlinkedRecords, salaryClosingUnlinkedSummary } = useMemo(() => {
    if (!salaryClosingBranch || salaryClosingBranch === "all") return { salaryClosingData: [], salaryClosingUnlinkedCount: 0, salaryClosingUnlinkedRecords: [] as AttendanceRecord[], salaryClosingUnlinkedSummary: { totalRecords: 0, presentRecords: 0, totalHours: 0 } };
    
    const branchEmployees = employees?.filter(emp => emp.branchId === salaryClosingBranch && emp.status === "active") || [];
    const monthStart = `${salaryClosingMonth}-01`;
    const monthEnd = `${salaryClosingMonth}-31`;
    const monthAttendance = attendanceRecords?.filter(rec => 
      rec.branchId === salaryClosingBranch && 
      rec.attendanceDate >= monthStart && 
      rec.attendanceDate <= monthEnd
    ) || [];

    const employeeLookup = new Map<string, number>();
    branchEmployees.forEach(emp => {
      employeeLookup.set(`bid:${emp.id}`, emp.id);
      employeeLookup.set(`eid:${emp.id.toString()}`, emp.id);
      if (emp.employeeNumber) {
        employeeLookup.set(`enum:${emp.employeeNumber}`, emp.id);
      }
    });
    
    const matchEmployee = (rec: AttendanceRecord): number | null => {
      if (rec.branchEmployeeId && employeeLookup.has(`bid:${rec.branchEmployeeId}`)) {
        return employeeLookup.get(`bid:${rec.branchEmployeeId}`)!;
      }
      if (rec.employeeId && employeeLookup.has(`eid:${rec.employeeId}`)) {
        return employeeLookup.get(`eid:${rec.employeeId}`)!;
      }
      const employeeNumber = (rec as any).employeeNumber;
      if (employeeNumber && employeeLookup.has(`enum:${employeeNumber}`)) {
        return employeeLookup.get(`enum:${employeeNumber}`)!;
      }
      return null;
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
      const empAttendance = monthAttendance.filter(a => matchEmployee(a) === emp.id);
      const presentDays = empAttendance.filter(a => a.status === "present" || a.status === "late").length;
      const absentDays = empAttendance.filter(a => a.status === "absent").length;
      const lateDays = empAttendance.filter(a => a.status === "late").length;
      
      const totalHours = empAttendance.reduce((sum, a) => {
        if (a.workingHours) return sum + Number(a.workingHours);
        return sum;
      }, 0);

      const baseSalary = emp.salary || 0;
      const allowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
      const grossSalary = baseSalary + allowances;
      const socialInsurance = emp.nationality === "سعودي" ? (emp.socialInsuranceDeduction || 0) : 0;
      const netSalary = grossSalary - socialInsurance;

      return {
        id: emp.id,
        employeeNumber: emp.employeeNumber,
        employeeName: emp.employeeName,
        jobTitle: emp.jobTitle,
        nationality: emp.nationality,
        presentDays,
        absentDays,
        lateDays,
        totalHours: Math.round(totalHours * 10) / 10,
        baseSalary,
        allowances,
        grossSalary,
        socialInsurance,
        netSalary,
      };
    });
    
    return { salaryClosingData: data, salaryClosingUnlinkedCount: unlinkedList.length, salaryClosingUnlinkedRecords: unlinkedList, salaryClosingUnlinkedSummary: unlinkedSummary };
  }, [salaryClosingBranch, salaryClosingMonth, employees, attendanceRecords]);

  const exportUnlinkedRecordsToExcel = () => {
    if (unlinkedRecords.length === 0) return;
    const data = unlinkedRecords.map((rec, index) => ({
      "م": index + 1,
      "التاريخ": rec.attendanceDate,
      "اسم الموظف (غير مرتبط)": rec.employeeName,
      "معرف الموظف": rec.employeeId || "-",
      "الفرع": getBranchName(rec.branchId),
      "الحالة": rec.status === "present" ? "حاضر" : rec.status === "absent" ? "غائب" : rec.status === "late" ? "متأخر" : rec.status,
      "وقت الحضور": rec.actualCheckIn || "-",
      "وقت الانصراف": rec.actualCheckOut || "-",
      "ساعات العمل": rec.workingHours || 0,
      "ملاحظات": rec.notes || "-",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "سجلات غير مرتبطة");
    XLSX.writeFile(wb, `سجلات_حضور_غير_مرتبطة_${selectedMonth}.xlsx`);
  };

  const exportAttendanceToExcel = () => {
    const data = filteredEmployees.map((emp, index) => {
      const attendance = attendanceByEmployee.get(emp.id) || { present: 0, absent: 0, late: 0, total: 0 };
      const rate = attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0;
      return {
        "م": index + 1,
        "الموظف": emp.employeeName,
        "الفرع": getBranchName(emp.branchId),
        "الوظيفة": emp.jobTitle,
        "أيام الحضور": attendance.present,
        "أيام الغياب": attendance.absent,
        "أيام التأخير": attendance.late,
        "نسبة الحضور": `${rate}%`,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير الحضور");
    XLSX.writeFile(wb, `تقرير_الحضور_${selectedMonth}.xlsx`);
  };

  const exportSalaryClosingToExcel = () => {
    if (salaryClosingData.length === 0) return;
    const wb = XLSX.utils.book_new();
    
    const summaryData = [
      { "البيان": "الفرع", "القيمة": getBranchName(salaryClosingBranch) },
      { "البيان": "الشهر", "القيمة": salaryClosingMonth },
      { "البيان": "عدد الموظفين", "القيمة": salaryClosingData.length },
      { "البيان": "إجمالي الرواتب", "القيمة": salaryClosingData.reduce((sum, e) => sum + e.grossSalary, 0) },
      { "البيان": "إجمالي التأمينات الاجتماعية", "القيمة": salaryClosingData.reduce((sum, e) => sum + e.socialInsurance, 0) },
      { "البيان": "صافي الرواتب المستحقة", "القيمة": salaryClosingData.reduce((sum, e) => sum + e.netSalary, 0) },
      { "البيان": "", "القيمة": "" },
      { "البيان": "سجلات حضور غير مرتبطة", "القيمة": salaryClosingUnlinkedCount },
      { "البيان": "سجلات حضور (غير مرتبطة)", "القيمة": salaryClosingUnlinkedSummary.presentRecords },
      { "البيان": "إجمالي ساعات غير مرتبطة", "القيمة": Math.round(salaryClosingUnlinkedSummary.totalHours * 10) / 10 },
      { "البيان": "ملاحظة", "القيمة": salaryClosingUnlinkedCount > 0 ? "توجد سجلات حضور غير مرتبطة بموظفين - راجع ورقة السجلات غير المرتبطة للتفاصيل والمراجعة" : "جميع السجلات مرتبطة بموظفين" },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص");
    
    const data = salaryClosingData.map((emp, index) => ({
      "م": index + 1,
      "رقم الموظف": emp.employeeNumber,
      "الاسم": emp.employeeName,
      "الوظيفة": emp.jobTitle,
      "الجنسية": emp.nationality,
      "أيام الحضور": emp.presentDays,
      "أيام الغياب": emp.absentDays,
      "أيام التأخير": emp.lateDays,
      "إجمالي الساعات": emp.totalHours,
      "الراتب الأساسي": emp.baseSalary,
      "البدلات": emp.allowances,
      "إجمالي الراتب": emp.grossSalary,
      "التأمينات الاجتماعية": emp.socialInsurance,
      "صافي الراتب": emp.netSalary,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "تفاصيل الرواتب");
    
    if (salaryClosingUnlinkedRecords.length > 0) {
      const unlinkedData = salaryClosingUnlinkedRecords.map((rec, index) => ({
        "م": index + 1,
        "التاريخ": rec.attendanceDate,
        "اسم الموظف (غير مرتبط)": rec.employeeName,
        "معرف الموظف": rec.employeeId || "-",
        "الحالة": rec.status === "present" ? "حاضر" : rec.status === "absent" ? "غائب" : rec.status === "late" ? "متأخر" : rec.status,
        "وقت الحضور": rec.actualCheckIn || "-",
        "وقت الانصراف": rec.actualCheckOut || "-",
        "ساعات العمل": rec.workingHours || 0,
        "ملاحظات": rec.notes || "-",
      }));
      const wsUnlinked = XLSX.utils.json_to_sheet(unlinkedData);
      XLSX.utils.book_append_sheet(wb, wsUnlinked, "سجلات غير مرتبطة");
    }
    
    XLSX.writeFile(wb, `إغلاق_الرواتب_${getBranchName(salaryClosingBranch)}_${salaryClosingMonth}.xlsx`);
  };

  const exportSalaryClosingToPDF = () => {
    if (salaryClosingData.length === 0) return;
    
    const tableBody = [
      [
        { text: "م", style: "tableHeader" },
        { text: "الموظف", style: "tableHeader" },
        { text: "الوظيفة", style: "tableHeader" },
        { text: "الحضور", style: "tableHeader" },
        { text: "الغياب", style: "tableHeader" },
        { text: "الساعات", style: "tableHeader" },
        { text: "الراتب", style: "tableHeader" },
        { text: "البدلات", style: "tableHeader" },
        { text: "التأمينات", style: "tableHeader" },
        { text: "الصافي", style: "tableHeader" },
      ],
      ...salaryClosingData.map((emp, index) => [
        { text: String(index + 1), alignment: "center" as const },
        { text: emp.employeeName, alignment: "right" as const },
        { text: emp.jobTitle, alignment: "right" as const },
        { text: String(emp.presentDays), alignment: "center" as const },
        { text: String(emp.absentDays), alignment: "center" as const },
        { text: String(emp.totalHours), alignment: "center" as const },
        { text: formatNumber(emp.baseSalary), alignment: "center" as const },
        { text: formatNumber(emp.allowances), alignment: "center" as const },
        { text: emp.socialInsurance > 0 ? formatNumber(emp.socialInsurance) : "-", alignment: "center" as const, color: "red" },
        { text: formatNumber(emp.netSalary), alignment: "center" as const, bold: true },
      ]),
    ];

    const totals = salaryClosingData.reduce((acc, emp) => ({
      baseSalary: acc.baseSalary + emp.baseSalary,
      allowances: acc.allowances + emp.allowances,
      socialInsurance: acc.socialInsurance + emp.socialInsurance,
      netSalary: acc.netSalary + emp.netSalary,
    }), { baseSalary: 0, allowances: 0, socialInsurance: 0, netSalary: 0 });

    const unlinkedWarning = salaryClosingUnlinkedCount > 0 
      ? { text: `تحذير: ${salaryClosingUnlinkedCount} سجل حضور غير مرتبط (${salaryClosingUnlinkedSummary.presentRecords} سجل حضور، ${Math.round(salaryClosingUnlinkedSummary.totalHours * 10) / 10} ساعة) - غير مضمنة في هذا التقرير. راجع ملف Excel للتفاصيل والمراجعة.`, color: "orange", margin: [0, 15, 0, 0], fontSize: 9 }
      : null;

    const docDefinition: any = {
      pageOrientation: "landscape",
      content: [
        { text: "تقرير إغلاق الرواتب الشهرية", style: "header", alignment: "center" },
        { text: `الفرع: ${getBranchName(salaryClosingBranch)} | الشهر: ${salaryClosingMonth}`, alignment: "center", margin: [0, 0, 0, 10] },
        { text: `عدد الموظفين: ${salaryClosingData.length} | إجمالي الرواتب: ${formatCurrency(totals.netSalary)}`, alignment: "center", margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto", "auto", "auto", "auto"],
            body: tableBody,
          },
          layout: "lightHorizontalLines",
        },
        { text: "", margin: [0, 20, 0, 0] },
        {
          table: {
            widths: ["*", "auto", "auto", "auto", "auto"],
            body: [
              [
                { text: "الإجمالي", bold: true, alignment: "right" as const },
                { text: formatCurrency(totals.baseSalary), alignment: "center" as const },
                { text: formatCurrency(totals.allowances), alignment: "center" as const },
                { text: formatCurrency(totals.socialInsurance), alignment: "center" as const, color: "red" },
                { text: formatCurrency(totals.netSalary), alignment: "center" as const, bold: true },
              ],
            ],
          },
        },
        ...(unlinkedWarning ? [unlinkedWarning] : []),
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        tableHeader: { bold: true, fontSize: 9, fillColor: "#f3f4f6", alignment: "center" },
      },
      defaultStyle: { font: "Roboto", fontSize: 8 },
    };

    pdfMake.createPdf(docDefinition).download(`إغلاق_الرواتب_${getBranchName(salaryClosingBranch)}_${salaryClosingMonth}.pdf`);
  };

  const isLoading = employeesLoading || attendanceLoading;

  return (
    <Layout>
      <div className="p-6 space-y-6" dir="rtl" ref={printRef}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/attendance-dashboard")} data-testid="button-back">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">التقارير الشاملة</h1>
              <p className="text-gray-500">تقارير تحليلية شاملة لموظفي الفروع والحضور والرواتب</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="default" 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setShowSalaryClosingDialog(true)}
              data-testid="button-salary-closing"
            >
              <Wallet className="w-4 h-4 ml-2" />
              إغلاق الرواتب الشهرية
            </Button>
          </div>
        </div>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>الفرع</Label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder="جميع الفروع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفروع</SelectItem>
                    {branches?.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الشهر</Label>
                <Input 
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  data-testid="input-month"
                />
              </div>
              <div className="space-y-2">
                <Label>الوظيفة</Label>
                <Select value={selectedJobTitle} onValueChange={setSelectedJobTitle}>
                  <SelectTrigger data-testid="select-job">
                    <SelectValue placeholder="جميع الوظائف" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الوظائف</SelectItem>
                    {jobTitles.map((job) => (
                      <SelectItem key={job} value={job}>{job}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الموظف</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger data-testid="select-employee">
                    <SelectValue placeholder="جميع الموظفين" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الموظفين</SelectItem>
                    {employees?.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id.toString()}>{emp.employeeName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={() => {
                  setSelectedBranch("all");
                  setSelectedJobTitle("all");
                  setSelectedEmployee("all");
                }} data-testid="button-reset-filters">
                  <RefreshCw className="w-4 h-4 ml-2" />
                  إعادة تعيين
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(overviewStats.totalEmployees)}</p>
                  <p className="text-xs text-gray-500">إجمالي الموظفين</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{overviewStats.attendanceRate}%</p>
                  <p className="text-xs text-gray-500">نسبة الحضور</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(overviewStats.absentCount)}</p>
                  <p className="text-xs text-gray-500">أيام الغياب</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(overviewStats.totalSalaries)}</p>
                  <p className="text-xs text-gray-500">إجمالي الرواتب</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(overviewStats.saudiEmployees)}</p>
                  <p className="text-xs text-gray-500">الموظفين السعوديين</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Wallet className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(overviewStats.totalInsurance)}</p>
                  <p className="text-xs text-gray-500">التأمينات الاجتماعية</p>
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
                      {formatNumber(unlinkedRecordsCount)} سجل حضور غير مرتبط
                    </p>
                    <p className="text-sm text-orange-600">
                      سجلات لا يمكن ربطها بموظفين محددين - قم بتصديرها للمراجعة
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
                  <Download className="w-4 h-4 ml-2" />
                  تصدير للمراجعة
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
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <BarChart3 className="w-4 h-4 ml-1" />
                نظرة عامة
              </TabsTrigger>
              <TabsTrigger value="branch-comparison" data-testid="tab-branch-comparison">
                <Building2 className="w-4 h-4 ml-1" />
                مقارنة الفروع
              </TabsTrigger>
              <TabsTrigger value="job-comparison" data-testid="tab-job-comparison">
                <Users className="w-4 h-4 ml-1" />
                مقارنة الوظائف
              </TabsTrigger>
              <TabsTrigger value="attendance" data-testid="tab-attendance">
                <Calendar className="w-4 h-4 ml-1" />
                الحضور
              </TabsTrigger>
              <TabsTrigger value="salaries" data-testid="tab-salaries">
                <DollarSign className="w-4 h-4 ml-1" />
                الرواتب
              </TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-analytics">
                <TrendingUp className="w-4 h-4 ml-1" />
                التحليلات
              </TabsTrigger>
              <TabsTrigger value="kpis" data-testid="tab-kpis">
                <PieChartIcon className="w-4 h-4 ml-1" />
                المؤشرات
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChartIcon className="w-5 h-5" />
                      توزيع الموظفين حسب الجنسية
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={nationalityChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {nationalityChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      توزيع الموظفين حسب الوظيفة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={jobTitleChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#f59e0b" name="عدد الموظفين" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    إجمالي الرواتب حسب الفرع
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={branchSalaryData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="salary" fill="#10b981" name="إجمالي الرواتب" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="branch-comparison" className="space-y-4" data-testid="tab-content-branch-comparison">
              <Card data-testid="card-branch-comparison-table">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    مقارنة شاملة بين الفروع
                  </CardTitle>
                  <CardDescription>مقارنة مؤشرات الأداء والموظفين والرواتب عبر جميع الفروع لشهر {selectedMonth}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">الفرع</TableHead>
                          <TableHead className="text-center">الموظفين</TableHead>
                          <TableHead className="text-center">السعوديين</TableHead>
                          <TableHead className="text-center">نسبة السعودة</TableHead>
                          <TableHead className="text-center">إجمالي الرواتب</TableHead>
                          <TableHead className="text-center">متوسط الراتب</TableHead>
                          <TableHead className="text-center">نسبة الحضور</TableHead>
                          <TableHead className="text-center">الغياب</TableHead>
                          <TableHead className="text-center">ساعات العمل</TableHead>
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
                            <TableCell className="text-center">{formatCurrency(branch.totalSalary)}</TableCell>
                            <TableCell className="text-center">{formatCurrency(branch.avgSalary)}</TableCell>
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
                    <CardTitle>مقارنة عدد الموظفين</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="employeeCount" fill="#3b82f6" name="إجمالي الموظفين" />
                        <Bar dataKey="saudiCount" fill="#10b981" name="السعوديين" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>مقارنة نسب الحضور والغياب</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="attendanceRate" fill="#10b981" name="نسبة الحضور %" />
                        <Bar dataKey="absentRate" fill="#ef4444" name="نسبة الغياب %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>مقارنة متوسط الرواتب</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="avgSalary" fill="#f59e0b" name="متوسط الراتب" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>مقارنة ساعات العمل</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={branchComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="totalHours" fill="#8b5cf6" name="إجمالي الساعات" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="job-comparison" className="space-y-4" data-testid="tab-content-job-comparison">
              <Card data-testid="card-job-comparison">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    مقارنة الوظائف عبر الفروع
                  </CardTitle>
                  <CardDescription>تحليل فروقات الرواتب لنفس المسمى الوظيفي في فروع مختلفة (مرتبة حسب أكبر فرق)</CardDescription>
                </CardHeader>
                <CardContent>
                  {jobComparisonData.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      لا توجد وظائف متكررة في أكثر من فرع للمقارنة
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {jobComparisonData.slice(0, 10).map((job) => (
                        <Card key={job.jobTitle} className="border-amber-200">
                          <CardHeader className="py-3 bg-amber-50">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{job.jobTitle}</CardTitle>
                              <div className="flex items-center gap-4 text-sm">
                                <span>العدد الكلي: <strong>{job.totalCount}</strong></span>
                                <span>المتوسط: <strong>{formatCurrency(job.avgSalary)}</strong></span>
                                <Badge className={job.salaryVariance > 1000 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                                  فرق: {formatCurrency(job.salaryVariance)}
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="py-3">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-right">الفرع</TableHead>
                                  <TableHead className="text-center">العدد</TableHead>
                                  <TableHead className="text-center">متوسط الراتب</TableHead>
                                  <TableHead className="text-center">أقل راتب</TableHead>
                                  <TableHead className="text-center">أعلى راتب</TableHead>
                                  <TableHead className="text-center">نسبة الحضور</TableHead>
                                  <TableHead className="text-center">الفرق عن المتوسط</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {job.branches.map((branch) => {
                                  const diff = branch.avgSalary - job.avgSalary;
                                  return (
                                    <TableRow key={branch.branchName}>
                                      <TableCell className="font-medium">{branch.branchName}</TableCell>
                                      <TableCell className="text-center">{branch.count}</TableCell>
                                      <TableCell className="text-center font-bold">{formatCurrency(branch.avgSalary)}</TableCell>
                                      <TableCell className="text-center text-gray-500">{formatCurrency(branch.minSalary)}</TableCell>
                                      <TableCell className="text-center text-gray-500">{formatCurrency(branch.maxSalary)}</TableCell>
                                      <TableCell className="text-center">
                                        <Badge className={branch.attendanceRate >= 80 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                                          {branch.attendanceRate}%
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <span className={diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-500"}>
                                          {diff > 0 ? "+" : ""}{formatCurrency(diff)}
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
                  تصدير Excel
                </Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>تقرير الحضور والغياب التفصيلي</CardTitle>
                  <CardDescription>بيانات الحضور لشهر {selectedMonth}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">م</TableHead>
                        <TableHead className="text-right">الموظف</TableHead>
                        <TableHead className="text-right">الفرع</TableHead>
                        <TableHead className="text-right">الوظيفة</TableHead>
                        <TableHead className="text-center">الحضور</TableHead>
                        <TableHead className="text-center">الغياب</TableHead>
                        <TableHead className="text-center">التأخير</TableHead>
                        <TableHead className="text-center">نسبة الحضور</TableHead>
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

            <TabsContent value="salaries" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>تقرير الرواتب التفصيلي</CardTitle>
                  <CardDescription>بيانات الرواتب والبدلات لجميع الموظفين</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">م</TableHead>
                        <TableHead className="text-right">الموظف</TableHead>
                        <TableHead className="text-right">الفرع</TableHead>
                        <TableHead className="text-right">الوظيفة</TableHead>
                        <TableHead className="text-center">الراتب الأساسي</TableHead>
                        <TableHead className="text-center">البدلات</TableHead>
                        <TableHead className="text-center">التأمينات</TableHead>
                        <TableHead className="text-center">صافي الراتب</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp, index) => {
                        const allowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
                        const insurance = emp.nationality === "سعودي" ? (emp.socialInsuranceDeduction || 0) : 0;
                        return (
                          <TableRow key={emp.id}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">{emp.employeeName}</TableCell>
                            <TableCell>{getBranchName(emp.branchId)}</TableCell>
                            <TableCell>{emp.jobTitle}</TableCell>
                            <TableCell className="text-center">{formatCurrency(emp.salary)}</TableCell>
                            <TableCell className="text-center">{formatCurrency(allowances)}</TableCell>
                            <TableCell className="text-center text-red-600">
                              {insurance > 0 ? `- ${formatCurrency(insurance)}` : "-"}
                            </TableCell>
                            <TableCell className="text-center font-bold">{formatCurrency(emp.totalSalary)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>مقارنة الحضور والغياب</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "حضور", value: overviewStats.presentCount },
                            { name: "غياب", value: overviewStats.absentCount },
                            { name: "تأخير", value: overviewStats.lateCount },
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
                    <CardTitle>إحصائيات الموظفين حسب الحالة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { label: "نشط", value: filteredEmployees.filter(e => e.status === "active").length, color: "bg-green-500" },
                        { label: "غير نشط", value: filteredEmployees.filter(e => e.status === "inactive").length, color: "bg-gray-500" },
                        { label: "في إجازة", value: filteredEmployees.filter(e => e.status === "on_leave").length, color: "bg-yellow-500" },
                        { label: "منتهي", value: filteredEmployees.filter(e => e.status === "terminated").length, color: "bg-red-500" },
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
            </TabsContent>

            <TabsContent value="kpis" className="space-y-4" data-testid="tab-content-kpis">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200" data-testid="kpi-total-employees">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-700">{formatNumber(overviewStats.totalEmployees)}</p>
                      <p className="text-sm text-blue-600">إجمالي الموظفين</p>
                      <p className="text-xs text-blue-500 mt-1">نشط: {filteredEmployees.filter(e => e.status === "active").length}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200" data-testid="kpi-attendance-rate">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-700">{overviewStats.attendanceRate}%</p>
                      <p className="text-sm text-green-600">نسبة الحضور</p>
                      <p className="text-xs text-green-500 mt-1">{formatNumber(overviewStats.presentCount)} يوم حضور</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200" data-testid="kpi-total-salaries">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-amber-700">{formatCurrency(overviewStats.totalSalaries)}</p>
                      <p className="text-sm text-amber-600">إجمالي الرواتب</p>
                      <p className="text-xs text-amber-500 mt-1">متوسط: {formatCurrency(overviewStats.totalEmployees > 0 ? Math.round(overviewStats.totalSalaries / overviewStats.totalEmployees) : 0)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200" data-testid="kpi-saudization">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-teal-700">{overviewStats.totalEmployees > 0 ? Math.round((overviewStats.saudiEmployees / overviewStats.totalEmployees) * 100) : 0}%</p>
                      <p className="text-sm text-teal-600">نسبة السعودة</p>
                      <p className="text-xs text-teal-500 mt-1">{formatNumber(overviewStats.saudiEmployees)} موظف سعودي</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-top-employees">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      أعلى 10 موظفين راتباً
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table data-testid="table-top-employees">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">م</TableHead>
                          <TableHead className="text-right">الموظف</TableHead>
                          <TableHead className="text-right">الفرع</TableHead>
                          <TableHead className="text-right">الوظيفة</TableHead>
                          <TableHead className="text-center">الراتب</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topEmployeesBySalary.map((emp, index) => (
                          <TableRow key={emp.id} data-testid={`row-top-employee-${emp.id}`}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell className="font-medium">{emp.employeeName}</TableCell>
                            <TableCell>{getBranchName(emp.branchId)}</TableCell>
                            <TableCell>{emp.jobTitle}</TableCell>
                            <TableCell className="text-center font-bold">{formatCurrency(emp.totalSalary || emp.salary)}</TableCell>
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
                      تحليل البدلات
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
                            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          {allowancesBreakdown.map((item) => (
                            <div key={item.name} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-sm flex-1">{item.name}</span>
                              <span className="font-bold text-sm">{formatCurrency(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-10 text-gray-500">لا توجد بدلات مسجلة</div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-insurance-summary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      ملخص التأمينات الاجتماعية
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg" data-testid="text-total-insurance">
                        <div>
                          <p className="text-sm text-purple-600">إجمالي التأمينات</p>
                          <p className="text-2xl font-bold text-purple-700">{formatCurrency(overviewStats.totalInsurance)}</p>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-full">
                          <Wallet className="w-8 h-8 text-purple-600" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg text-center" data-testid="text-saudi-count">
                          <p className="text-lg font-bold">{formatNumber(overviewStats.saudiEmployees)}</p>
                          <p className="text-xs text-gray-500">موظف سعودي</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg text-center" data-testid="text-avg-insurance">
                          <p className="text-lg font-bold">{formatCurrency(overviewStats.saudiEmployees > 0 ? Math.round(overviewStats.totalInsurance / overviewStats.saudiEmployees) : 0)}</p>
                          <p className="text-xs text-gray-500">متوسط التأمينات</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-branches-summary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      ملخص الفروع
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
                            <p className="text-xs text-gray-500">{branch.employeeCount} موظف</p>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-sm">{formatCurrency(branch.totalSalary)}</p>
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
                    <SelectContent>
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

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={exportSalaryClosingToExcel}>
                      <FileSpreadsheet className="w-4 h-4 ml-2" />
                      تصدير Excel
                    </Button>
                    <Button variant="outline" onClick={exportSalaryClosingToPDF}>
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
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-600">{salaryClosingData.length}</p>
                          <p className="text-sm text-gray-600">عدد الموظفين</p>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.grossSalary, 0))}
                          </p>
                          <p className="text-sm text-gray-600">إجمالي الرواتب</p>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <p className="text-2xl font-bold text-red-600">
                            {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.socialInsurance, 0))}
                          </p>
                          <p className="text-sm text-gray-600">التأمينات الاجتماعية</p>
                        </div>
                        <div className="text-center p-3 bg-amber-50 rounded-lg">
                          <p className="text-2xl font-bold text-amber-600">
                            {formatCurrency(salaryClosingData.reduce((sum, e) => sum + e.netSalary, 0))}
                          </p>
                          <p className="text-sm text-gray-600">صافي الرواتب</p>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">م</TableHead>
                            <TableHead className="text-right">رقم الموظف</TableHead>
                            <TableHead className="text-right">الاسم</TableHead>
                            <TableHead className="text-right">الوظيفة</TableHead>
                            <TableHead className="text-center">الحضور</TableHead>
                            <TableHead className="text-center">الغياب</TableHead>
                            <TableHead className="text-center">الساعات</TableHead>
                            <TableHead className="text-center">الراتب</TableHead>
                            <TableHead className="text-center">البدلات</TableHead>
                            <TableHead className="text-center">التأمينات</TableHead>
                            <TableHead className="text-center">الصافي</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salaryClosingData.map((emp, index) => (
                            <TableRow key={emp.id}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell className="font-mono">{emp.employeeNumber}</TableCell>
                              <TableCell className="font-medium">{emp.employeeName}</TableCell>
                              <TableCell>{emp.jobTitle}</TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-green-100 text-green-800">{emp.presentDays}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className="bg-red-100 text-red-800">{emp.absentDays}</Badge>
                              </TableCell>
                              <TableCell className="text-center">{emp.totalHours}</TableCell>
                              <TableCell className="text-center">{formatCurrency(emp.baseSalary)}</TableCell>
                              <TableCell className="text-center">{formatCurrency(emp.allowances)}</TableCell>
                              <TableCell className="text-center text-red-600">
                                {emp.socialInsurance > 0 ? `- ${formatCurrency(emp.socialInsurance)}` : "-"}
                              </TableCell>
                              <TableCell className="text-center font-bold">{formatCurrency(emp.netSalary)}</TableCell>
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
                  <p>لا يوجد موظفين نشطين في هذا الفرع</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
