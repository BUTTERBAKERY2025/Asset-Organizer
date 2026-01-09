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
import { downloadArabicPdf, getArabicDefaultStyle, getArabicTableHeaderStyle } from "@/lib/pdfmake-arabic";
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
  const [salarySearchQuery, setSalarySearchQuery] = useState<string>("");
  const [salaryMinFilter, setSalaryMinFilter] = useState<string>("");
  const [salaryMaxFilter, setSalaryMaxFilter] = useState<string>("");
  const [salaryNationalityFilter, setSalaryNationalityFilter] = useState<string>("all");
  const [salarySortField, setSalarySortField] = useState<string>("employeeName");
  const [salarySortOrder, setSalarySortOrder] = useState<"asc" | "desc">("asc");

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

  const { data: employeeSchedules } = useQuery<{ id: number; employeeId: string; branchEmployeeId: number | null; scheduleDate: string; shiftStart: string; shiftEnd: string; status: string }[]>({
    queryKey: ["/api/employee-schedules", { startDate: `${selectedMonth}-01`, endDate: `${selectedMonth}-31` }],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: cashierJournals } = useQuery<{ id: number; branchId: string; cashierName: string; cashierId: string; reportDate: string; totalSales: number; totalCash: number; status: string }[]>({
    queryKey: ["/api/cashier-journals"],
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
      .reduce((sum, emp) => {
        const storedDeduction = emp.socialInsuranceDeduction || 0;
        if (storedDeduction > 0) return sum + storedDeduction;
        const baseSalary = emp.salary || 0;
        return sum + Math.round(baseSalary * 0.0975);
      }, 0);
    
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
    const sorted = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    
    // Show top 5 and group rest as "أخرى"
    if (sorted.length > 5) {
      const top5 = sorted.slice(0, 5);
      const othersSum = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
      return [...top5, { name: "أخرى", value: othersSum }];
    }
    return sorted;
  }, [filteredEmployees]);

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
    currentDate.setMonth(currentDate.getMonth() - 1);
    const prevMonth = currentDate.toISOString().slice(0, 7);
    const prevMonthStart = `${prevMonth}-01`;
    const prevMonthEnd = `${prevMonth}-31`;
    
    const prevAttendance = attendanceRecords.filter(rec => {
      if (selectedBranch !== "all" && rec.branchId !== selectedBranch) return false;
      return rec.attendanceDate >= prevMonthStart && rec.attendanceDate <= prevMonthEnd;
    });
    
    const prevPresentCount = prevAttendance.filter(r => r.status === "present").length;
    const prevTotalAttendance = prevAttendance.length;
    const prevAttendanceRate = prevTotalAttendance > 0 ? Math.round((prevPresentCount / prevTotalAttendance) * 100) : 0;
    
    const prevTotalSalaries = filteredEmployees.reduce((sum, emp) => sum + (emp.totalSalary || emp.salary || 0), 0);
    
    return {
      attendanceRate: prevAttendanceRate,
      totalSalaries: prevTotalSalaries,
      totalEmployees: filteredEmployees.length,
    };
  }, [employees, attendanceRecords, selectedMonth, selectedBranch, filteredEmployees]);

  const getChangeIndicator = (current: number, previous: number | undefined) => {
    if (!previous || previous === 0) return { change: 0, isPositive: true };
    const change = Math.round(((current - previous) / previous) * 100);
    return { change, isPositive: change >= 0 };
  };

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
      const storedInsurance = emp.socialInsuranceDeduction || 0;
      const socialInsurance = emp.nationality === "سعودي" 
        ? (storedInsurance > 0 ? storedInsurance : Math.round(baseSalary * 0.0975))
        : 0;
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
    console.log("PDF export button clicked, data length:", salaryClosingData.length);
    if (salaryClosingData.length === 0) {
      console.log("No data to export");
      alert("لا توجد بيانات للتصدير");
      return;
    }
    
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
        { text: String(index + 1), alignment: "center" as const, font: "Roboto" },
        { text: emp.employeeName, alignment: "right" as const },
        { text: emp.jobTitle, alignment: "right" as const },
        { text: String(emp.presentDays), alignment: "center" as const, font: "Roboto" },
        { text: String(emp.absentDays), alignment: "center" as const, font: "Roboto" },
        { text: String(emp.totalHours), alignment: "center" as const, font: "Roboto" },
        { text: formatNumber(emp.baseSalary), alignment: "center" as const, font: "Roboto" },
        { text: formatNumber(emp.allowances), alignment: "center" as const, font: "Roboto" },
        { text: emp.socialInsurance > 0 ? formatNumber(emp.socialInsurance) : "-", alignment: "center" as const, color: "red", font: "Roboto" },
        { text: formatNumber(emp.netSalary), alignment: "center" as const, bold: true, font: "Roboto" },
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
        { text: [{ text: `الفرع: ${getBranchName(salaryClosingBranch)} | الشهر: ` }, { text: salaryClosingMonth, font: "Roboto" }], alignment: "center", margin: [0, 0, 0, 10] },
        { text: [{ text: `عدد الموظفين: ` }, { text: String(salaryClosingData.length), font: "Roboto" }, { text: ` | إجمالي الرواتب: ` }, { text: formatCurrency(totals.netSalary), font: "Roboto" }], alignment: "center", margin: [0, 0, 0, 20] },
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
                { text: formatCurrency(totals.baseSalary), alignment: "center" as const, font: "Roboto" },
                { text: formatCurrency(totals.allowances), alignment: "center" as const, font: "Roboto" },
                { text: formatCurrency(totals.socialInsurance), alignment: "center" as const, color: "red", font: "Roboto" },
                { text: formatCurrency(totals.netSalary), alignment: "center" as const, bold: true, font: "Roboto" },
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
      defaultStyle: { fontSize: 8 },
    };

    try {
      console.log("Calling downloadArabicPdf...");
      downloadArabicPdf(docDefinition, `إغلاق_الرواتب_${getBranchName(salaryClosingBranch)}_${salaryClosingMonth}.pdf`);
      console.log("downloadArabicPdf completed");
    } catch (error) {
      console.error("Error in exportSalaryClosingToPDF:", error);
      alert("خطأ في تصدير PDF: " + (error as Error).message);
    }
  };

  // ==================== NEW EXPORT FUNCTIONS ====================

  const exportBranchComparisonToExcel = () => {
    if (branchComparisonData.length === 0) return;
    const data = branchComparisonData.map((branch, index) => ({
      "م": index + 1,
      "الفرع": branch.branchName,
      "عدد الموظفين": branch.employeeCount,
      "السعوديين": branch.saudiCount,
      "نسبة السعودة %": branch.saudiPercentage,
      "إجمالي الرواتب": branch.totalSalary,
      "متوسط الراتب": branch.avgSalary,
      "التأمينات": branch.totalInsurance,
      "البدلات": branch.totalAllowances,
      "نسبة الحضور %": branch.attendanceRate,
      "نسبة الغياب %": branch.absentRate,
      "أيام الحضور": branch.presentCount,
      "أيام الغياب": branch.absentCount,
      "أيام التأخير": branch.lateCount,
      "إجمالي الساعات": branch.totalHours,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "مقارنة الفروع");
    XLSX.writeFile(wb, `مقارنة_الفروع_${selectedMonth}.xlsx`);
  };

  const exportBranchComparisonToPDF = () => {
    if (branchComparisonData.length === 0) return;
    const tableBody = [
      [
        { text: "الفرع", style: "tableHeader" },
        { text: "الموظفين", style: "tableHeader" },
        { text: "السعودة %", style: "tableHeader" },
        { text: "الرواتب", style: "tableHeader" },
        { text: "الحضور %", style: "tableHeader" },
        { text: "الساعات", style: "tableHeader" },
      ],
      ...branchComparisonData.map((branch) => [
        { text: branch.branchName, alignment: "right" as const },
        { text: String(branch.employeeCount), alignment: "center" as const, font: "Roboto" },
        { text: `${branch.saudiPercentage}%`, alignment: "center" as const, font: "Roboto" },
        { text: formatNumber(branch.totalSalary), alignment: "center" as const, font: "Roboto" },
        { text: `${branch.attendanceRate}%`, alignment: "center" as const, font: "Roboto" },
        { text: String(branch.totalHours), alignment: "center" as const, font: "Roboto" },
      ]),
    ];
    const docDefinition: any = {
      pageOrientation: "landscape",
      content: [
        { text: "تقرير مقارنة الفروع", style: "header", alignment: "center" },
        { text: [{ text: "الشهر: " }, { text: selectedMonth, font: "Roboto" }], alignment: "center", margin: [0, 0, 0, 20] },
        { table: { headerRows: 1, widths: ["*", "auto", "auto", "auto", "auto", "auto"], body: tableBody }, layout: "lightHorizontalLines" },
      ],
      styles: { header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] }, tableHeader: { bold: true, fontSize: 10, fillColor: "#f3f4f6", alignment: "center" } },
      defaultStyle: { fontSize: 9 },
    };
    downloadArabicPdf(docDefinition, `مقارنة_الفروع_${selectedMonth}.pdf`);
  };

  const exportJobComparisonToExcel = () => {
    if (jobComparisonData.length === 0) return;
    const data: any[] = [];
    jobComparisonData.forEach((job, jobIndex) => {
      job.branches.forEach((branch, branchIndex) => {
        data.push({
          "م": branchIndex === 0 ? jobIndex + 1 : "",
          "المسمى الوظيفي": branchIndex === 0 ? job.jobTitle : "",
          "الفرع": branch.branchName,
          "العدد": branch.count,
          "متوسط الراتب": branch.avgSalary,
          "أدنى راتب": branch.minSalary,
          "أعلى راتب": branch.maxSalary,
          "نسبة الحضور %": branch.attendanceRate,
          "الفرق عن المتوسط": branch.avgSalary - job.avgSalary,
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "مقارنة الوظائف");
    XLSX.writeFile(wb, `مقارنة_الوظائف_${selectedMonth}.xlsx`);
  };

  const exportJobComparisonToPDF = () => {
    if (jobComparisonData.length === 0) return;
    const tableBody: any[] = [[
      { text: "الوظيفة", style: "tableHeader" },
      { text: "الفرع", style: "tableHeader" },
      { text: "العدد", style: "tableHeader" },
      { text: "متوسط الراتب", style: "tableHeader" },
      { text: "الفرق", style: "tableHeader" },
    ]];
    jobComparisonData.forEach((job) => {
      job.branches.forEach((branch, idx) => {
        tableBody.push([
          { text: idx === 0 ? job.jobTitle : "", alignment: "right" as const },
          { text: branch.branchName, alignment: "right" as const },
          { text: String(branch.count), alignment: "center" as const, font: "Roboto" },
          { text: formatNumber(branch.avgSalary), alignment: "center" as const, font: "Roboto" },
          { text: formatNumber(branch.avgSalary - job.avgSalary), alignment: "center" as const, color: branch.avgSalary >= job.avgSalary ? "green" : "red", font: "Roboto" },
        ]);
      });
    });
    const docDefinition: any = {
      pageOrientation: "portrait",
      content: [
        { text: "تقرير مقارنة الوظائف عبر الفروع", style: "header", alignment: "center" },
        { text: [{ text: "الشهر: " }, { text: selectedMonth, font: "Roboto" }], alignment: "center", margin: [0, 0, 0, 20] },
        { table: { headerRows: 1, widths: ["*", "*", "auto", "auto", "auto"], body: tableBody }, layout: "lightHorizontalLines" },
      ],
      styles: { header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] }, tableHeader: { bold: true, fontSize: 10, fillColor: "#f3f4f6", alignment: "center" } },
      defaultStyle: { fontSize: 9 },
    };
    downloadArabicPdf(docDefinition, `مقارنة_الوظائف_${selectedMonth}.pdf`);
  };

  const exportSalariesTableToExcel = () => {
    if (filteredEmployees.length === 0) return;
    const data = filteredEmployees.map((emp, index) => {
      const allowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
      const storedIns = emp.socialInsuranceDeduction || 0;
      const insurance = emp.nationality === "سعودي" ? (storedIns > 0 ? storedIns : Math.round((emp.salary || 0) * 0.0975)) : 0;
      return {
        "م": index + 1,
        "الموظف": emp.employeeName,
        "رقم الموظف": emp.employeeNumber,
        "الفرع": getBranchName(emp.branchId),
        "الوظيفة": emp.jobTitle,
        "الجنسية": emp.nationality,
        "الراتب الأساسي": emp.salary || 0,
        "البدلات": allowances,
        "إجمالي الراتب": emp.totalSalary || emp.salary || 0,
        "التأمينات": insurance,
        "صافي الراتب": (emp.totalSalary || emp.salary || 0) - insurance,
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "جدول الرواتب");
    XLSX.writeFile(wb, `جدول_الرواتب_التفصيلي_${selectedMonth}.xlsx`);
  };

  const exportSalariesTableToPDF = () => {
    if (filteredEmployees.length === 0) return;
    const tableBody: any[] = [[
      { text: "م", style: "tableHeader" },
      { text: "الموظف", style: "tableHeader" },
      { text: "الوظيفة", style: "tableHeader" },
      { text: "الراتب", style: "tableHeader" },
      { text: "البدلات", style: "tableHeader" },
      { text: "التأمينات", style: "tableHeader" },
      { text: "الصافي", style: "tableHeader" },
    ]];
    filteredEmployees.forEach((emp, index) => {
      const allowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
      const storedIns = emp.socialInsuranceDeduction || 0;
      const insurance = emp.nationality === "سعودي" ? (storedIns > 0 ? storedIns : Math.round((emp.salary || 0) * 0.0975)) : 0;
      const netSalary = (emp.totalSalary || emp.salary || 0) - insurance;
      tableBody.push([
        { text: String(index + 1), alignment: "center" as const, font: "Roboto" },
        { text: emp.employeeName, alignment: "right" as const },
        { text: emp.jobTitle, alignment: "right" as const },
        { text: formatNumber(emp.salary || 0), alignment: "center" as const, font: "Roboto" },
        { text: formatNumber(allowances), alignment: "center" as const, font: "Roboto" },
        { text: insurance > 0 ? formatNumber(insurance) : "-", alignment: "center" as const, color: "red", font: "Roboto" },
        { text: formatNumber(netSalary), alignment: "center" as const, bold: true, font: "Roboto" },
      ]);
    });
    const docDefinition: any = {
      pageOrientation: "landscape",
      content: [
        { text: "جدول الرواتب التفصيلي", style: "header", alignment: "center" },
        { text: [{ text: "الشهر: " }, { text: selectedMonth, font: "Roboto" }], alignment: "center", margin: [0, 0, 0, 20] },
        { table: { headerRows: 1, widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto"], body: tableBody }, layout: "lightHorizontalLines" },
      ],
      styles: { header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] }, tableHeader: { bold: true, fontSize: 10, fillColor: "#f3f4f6", alignment: "center" } },
      defaultStyle: { fontSize: 9 },
    };
    downloadArabicPdf(docDefinition, `جدول_الرواتب_${selectedMonth}.pdf`);
  };

  const exportAnalyticsToExcel = () => {
    if (filteredEmployees.length === 0) return;
    const wb = XLSX.utils.book_new();
    
    const empData = filteredEmployees.map((emp, index) => {
      const allowances = (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.foodAllowance || 0) + (emp.otherAllowances || 0);
      const storedIns = emp.socialInsuranceDeduction || 0;
      const insurance = emp.nationality === "سعودي" ? (storedIns > 0 ? storedIns : Math.round((emp.salary || 0) * 0.0975)) : 0;
      return {
        "م": index + 1,
        "الموظف": emp.employeeName,
        "الفرع": getBranchName(emp.branchId),
        "الوظيفة": emp.jobTitle,
        "الجنسية": emp.nationality,
        "الراتب الأساسي": emp.salary || 0,
        "البدلات": allowances,
        "التأمينات": insurance,
      };
    });
    const wsEmp = XLSX.utils.json_to_sheet(empData);
    XLSX.utils.book_append_sheet(wb, wsEmp, "بيانات الموظفين");
    
    const branchDistData = branchComparisonData.map((b: { branchName: string; employeeCount: number }) => ({
      "الفرع": b.branchName,
      "عدد الموظفين": b.employeeCount,
    }));
    const wsBranch = XLSX.utils.json_to_sheet(branchDistData);
    XLSX.utils.book_append_sheet(wb, wsBranch, "توزيع الفروع");
    
    const jobData = jobTitleChartData.map(j => ({
      "الوظيفة": j.name,
      "العدد": j.value,
    }));
    const wsJob = XLSX.utils.json_to_sheet(jobData);
    XLSX.utils.book_append_sheet(wb, wsJob, "توزيع الوظائف");
    
    XLSX.writeFile(wb, `تحليلات_الموظفين_${selectedMonth}.xlsx`);
  };

  const exportKPIsToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const kpiData = [
      { "المؤشر": "إجمالي الموظفين", "القيمة": overviewStats.totalEmployees },
      { "المؤشر": "الموظفين النشطين", "القيمة": filteredEmployees.filter(e => e.status === "active").length },
      { "المؤشر": "نسبة الحضور", "القيمة": `${overviewStats.attendanceRate}%` },
      { "المؤشر": "أيام الحضور", "القيمة": overviewStats.presentCount },
      { "المؤشر": "أيام الغياب", "القيمة": overviewStats.absentCount },
      { "المؤشر": "إجمالي الرواتب", "القيمة": overviewStats.totalSalaries },
      { "المؤشر": "متوسط الراتب", "القيمة": overviewStats.totalEmployees > 0 ? Math.round(overviewStats.totalSalaries / overviewStats.totalEmployees) : 0 },
      { "المؤشر": "عدد السعوديين", "القيمة": overviewStats.saudiEmployees },
      { "المؤشر": "نسبة السعودة", "القيمة": `${overviewStats.totalEmployees > 0 ? Math.round((overviewStats.saudiEmployees / overviewStats.totalEmployees) * 100) : 0}%` },
      { "المؤشر": "إجمالي التأمينات", "القيمة": overviewStats.totalInsurance },
    ];
    const wsKPI = XLSX.utils.json_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, wsKPI, "المؤشرات الرئيسية");
    
    const topData = topEmployeesBySalary.map((emp, index) => ({
      "م": index + 1,
      "الموظف": emp.employeeName,
      "الفرع": getBranchName(emp.branchId),
      "الوظيفة": emp.jobTitle,
      "الراتب": emp.totalSalary || emp.salary,
    }));
    const wsTop = XLSX.utils.json_to_sheet(topData);
    XLSX.utils.book_append_sheet(wb, wsTop, "أعلى الرواتب");
    
    const allowData = allowancesBreakdown.map(a => ({
      "البدل": a.name,
      "القيمة": a.value,
    }));
    const wsAllow = XLSX.utils.json_to_sheet(allowData);
    XLSX.utils.book_append_sheet(wb, wsAllow, "البدلات");
    
    const branchSummary = branchComparisonData.map((b, index) => ({
      "م": index + 1,
      "الفرع": b.branchName,
      "الموظفين": b.employeeCount,
      "الرواتب": b.totalSalary,
      "نسبة الحضور": `${b.attendanceRate}%`,
    }));
    const wsBranch = XLSX.utils.json_to_sheet(branchSummary);
    XLSX.utils.book_append_sheet(wb, wsBranch, "ملخص الفروع");
    
    XLSX.writeFile(wb, `مؤشرات_الأداء_${selectedMonth}.xlsx`);
  };

  const exportKPIsToPDF = () => {
    const docDefinition: any = {
      pageOrientation: "portrait",
      content: [
        { text: "تقرير مؤشرات الأداء الرئيسية", style: "header", alignment: "center" },
        { text: [{ text: "الشهر: " }, { text: selectedMonth, font: "Roboto" }], alignment: "center", margin: [0, 0, 0, 20] },
        {
          columns: [
            { text: [{ text: "إجمالي الموظفين: " }, { text: formatNumber(overviewStats.totalEmployees), font: "Roboto" }], width: "*" },
            { text: [{ text: "نسبة الحضور: " }, { text: `${overviewStats.attendanceRate}%`, font: "Roboto" }], width: "*" },
          ],
          margin: [0, 0, 0, 10],
        },
        {
          columns: [
            { text: [{ text: "إجمالي الرواتب: " }, { text: formatCurrency(overviewStats.totalSalaries), font: "Roboto" }], width: "*" },
            { text: [{ text: "نسبة السعودة: " }, { text: `${overviewStats.totalEmployees > 0 ? Math.round((overviewStats.saudiEmployees / overviewStats.totalEmployees) * 100) : 0}%`, font: "Roboto" }], width: "*" },
          ],
          margin: [0, 0, 0, 10],
        },
        { text: [{ text: "إجمالي التأمينات الاجتماعية: " }, { text: formatCurrency(overviewStats.totalInsurance), font: "Roboto" }], margin: [0, 0, 0, 20] },
        { text: "أعلى 10 موظفين راتباً", style: "subheader", margin: [0, 10, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "*", "auto", "auto"],
            body: [
              [{ text: "م", style: "tableHeader" }, { text: "الموظف", style: "tableHeader" }, { text: "الوظيفة", style: "tableHeader" }, { text: "الراتب", style: "tableHeader" }],
              ...topEmployeesBySalary.map((emp, index) => [
                { text: String(index + 1), alignment: "center" as const, font: "Roboto" },
                { text: emp.employeeName, alignment: "right" as const },
                { text: emp.jobTitle, alignment: "right" as const },
                { text: formatNumber(emp.totalSalary || emp.salary), alignment: "center" as const, font: "Roboto" },
              ]),
            ],
          },
          layout: "lightHorizontalLines",
        },
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        subheader: { fontSize: 14, bold: true },
        tableHeader: { bold: true, fontSize: 10, fillColor: "#f3f4f6", alignment: "center" },
      },
      defaultStyle: { fontSize: 10 },
    };
    downloadArabicPdf(docDefinition, `مؤشرات_الأداء_${selectedMonth}.pdf`);
  };

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
    const WORK_PERMIT_MONTHLY = 66; // 800 ريال/سنة
    const IQAMA_FEES_MONTHLY = 54; // 650 ريال/سنة
    const NON_SAUDI_INSURANCE_RATE = 0.02; // 2% تأمين إصابات العمل

    const nonSaudiByNationality = new Map<string, { 
      count: number; 
      totalBaseSalary: number; 
      totalHousing: number;
      insurableSalary: number;
      insuranceCost: number;
      workPermitCost: number;
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
      existing.iqamaCost += IQAMA_FEES_MONTHLY;
      existing.totalMonthlyCost += insuranceCost + WORK_PERMIT_MONTHLY + IQAMA_FEES_MONTHLY;
      nonSaudiByNationality.set(nat, existing);
    });

    const nonSaudiCostAnalysis = Array.from(nonSaudiByNationality.entries()).map(([nationality, data]) => ({
      nationality,
      ...data,
    })).sort((a, b) => b.count - a.count);

    const totalNonSaudiCount = nonSaudiCostAnalysis.reduce((sum, n) => sum + n.count, 0);
    const totalNonSaudiInsurance = nonSaudiCostAnalysis.reduce((sum, n) => sum + n.insuranceCost, 0);
    const totalNonSaudiWorkPermit = nonSaudiCostAnalysis.reduce((sum, n) => sum + n.workPermitCost, 0);
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
    const laborFeesOnly = totalNonSaudiWorkPermit + totalNonSaudiIqama; // رسوم العمالة بدون التأمين (لتجنب الازدواجية)
    const muqabilMaliMonthly = excessWorkers * MUQABIL_MALI_MONTHLY;
    
    const governmentCosts = {
      // التأمينات الاجتماعية (حصة صاحب العمل فقط)
      gosiSaudiEmployee: totalGosiEmployee, // للعرض فقط - يُخصم من الموظف
      gosiSaudiEmployer: totalGosiEmployer, // تكلفة على صاحب العمل
      gosiNonSaudiEmployer: totalNonSaudiInsurance, // 2% تأمين إصابات العمل
      totalGosiEmployerOnly: totalGosiEmployer + totalNonSaudiInsurance, // إجمالي التأمينات على صاحب العمل
      // رسوم العمالة (منفصلة عن التأمين)
      workPermitTotal: totalNonSaudiWorkPermit,
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
                  <SelectContent className="max-h-60 overflow-y-auto">
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
                  <SelectContent className="max-h-60 overflow-y-auto">
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
                  <SelectContent className="max-h-60 overflow-y-auto">
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
            <div className="overflow-x-auto pb-2">
              <TabsList className="flex w-max min-w-full gap-1 text-xs">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <BarChart3 className="w-4 h-4 ml-1" />
                نظرة عامة
              </TabsTrigger>
              <TabsTrigger value="data-quality" data-testid="tab-data-quality">
                <AlertCircle className="w-4 h-4 ml-1" />
                جودة البيانات
              </TabsTrigger>
              <TabsTrigger value="compliance" data-testid="tab-compliance">
                <CheckCircle className="w-4 h-4 ml-1" />
                الامتثال
              </TabsTrigger>
              <TabsTrigger value="turnover" data-testid="tab-turnover">
                <RefreshCw className="w-4 h-4 ml-1" />
                الدوران
              </TabsTrigger>
              <TabsTrigger value="branch-comparison" data-testid="tab-branch-comparison">
                <Building2 className="w-4 h-4 ml-1" />
                الفروع
              </TabsTrigger>
              <TabsTrigger value="job-comparison" data-testid="tab-job-comparison">
                <Users className="w-4 h-4 ml-1" />
                الوظائف
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
              <TabsTrigger value="health-certificates" data-testid="tab-health-certificates">
                <CheckCircle className="w-4 h-4 ml-1" />
                الشهادات الصحية
              </TabsTrigger>
              <TabsTrigger value="comparisons" data-testid="tab-comparisons">
                <BarChart3 className="w-4 h-4 ml-1" />
                المقارنات
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
                        <p className="text-sm text-blue-600 font-medium">إجمالي الموظفين</p>
                        <p className="text-3xl font-bold text-blue-800">{formatNumber(overviewStats.totalEmployees)}</p>
                        <p className="text-xs text-blue-500 mt-1">
                          نشط: {formatNumber(overviewStats.activeEmployees)}
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
                        <p className="text-sm text-green-600 font-medium">إجمالي الرواتب</p>
                        <p className="text-2xl font-bold text-green-800">{formatCurrency(overviewStats.totalSalaries)}</p>
                        <p className="text-xs text-green-500 mt-1">
                          تأمينات: {formatCurrency(overviewStats.totalInsurance)}
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
                        <p className="text-sm text-amber-600 font-medium">نسبة السعودة</p>
                        <p className="text-3xl font-bold text-amber-800">
                          {overviewStats.totalEmployees > 0 ? Math.round((overviewStats.saudiEmployees / overviewStats.totalEmployees) * 100) : 0}%
                        </p>
                        <p className="text-xs text-amber-500 mt-1">
                          {formatNumber(overviewStats.saudiEmployees)} سعودي من {formatNumber(overviewStats.totalEmployees)}
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
                        <p className="text-sm text-purple-600 font-medium">معدل الحضور</p>
                        <p className="text-3xl font-bold text-purple-800">{overviewStats.attendanceRate}%</p>
                        <div className="flex items-center gap-2 mt-1">
                          {previousMonthStats && (
                            <span className={`text-xs flex items-center gap-1 ${getChangeIndicator(overviewStats.attendanceRate, previousMonthStats.attendanceRate).isPositive ? "text-green-600" : "text-red-600"}`}>
                              {getChangeIndicator(overviewStats.attendanceRate, previousMonthStats.attendanceRate).isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                              {Math.abs(getChangeIndicator(overviewStats.attendanceRate, previousMonthStats.attendanceRate).change)}% من الشهر السابق
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
                      توزيع الموظفين حسب الجنسية
                    </CardTitle>
                    <CardDescription>أعلى 5 جنسيات + أخرى</CardDescription>
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
                      توزيع الموظفين حسب الوظيفة
                    </CardTitle>
                    <CardDescription>أعلى 8 وظائف (إجمالي {jobTitleFullData.length} وظيفة)</CardDescription>
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
                        و {jobTitleFullData.length - 8} وظائف أخرى...
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
                    إجمالي الرواتب حسب الفرع
                  </CardTitle>
                  <CardDescription>مرتب من الأعلى للأقل</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={branchSalaryData} margin={{ top: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(value) => formatNumber(value)} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar 
                        dataKey="salary" 
                        fill="#10b981" 
                        name="إجمالي الرواتب"
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
                        <p className="text-sm text-green-600">حضور</p>
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
                        <p className="text-sm text-red-600">غياب</p>
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
                        <p className="text-sm text-yellow-600">تأخير</p>
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
                      <p className="text-sm text-gray-600">مؤشر جودة البيانات</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-orange-700">{dataQualityMetrics.employeesWithMissingAttendance.length}</p>
                      <p className="text-sm text-orange-600">حضور ناقص</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-700">{dataQualityMetrics.employeesWithMissingSalary.length}</p>
                      <p className="text-sm text-red-600">رواتب غير مدخلة</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-purple-700">{dataQualityMetrics.employeesWithAnomalies.length}</p>
                      <p className="text-sm text-purple-600">قيم غير منطقية</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-missing-attendance">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-700">
                      <AlertCircle className="w-5 h-5" />
                      موظفين بحضور ناقص
                    </CardTitle>
                    <CardDescription>موظفين لديهم أكثر من 5 أيام حضور مفقودة</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dataQualityMetrics.employeesWithMissingAttendance.length === 0 ? (
                      <div className="text-center py-8 text-green-600">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                        جميع سجلات الحضور مكتملة
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {dataQualityMetrics.employeesWithMissingAttendance.map(({ emp, missingDays, percentage }) => (
                          <div key={emp.id} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                            <div>
                              <p className="font-medium text-sm">{emp.employeeName}</p>
                              <p className="text-xs text-gray-500">{getBranchName(emp.branchId)}</p>
                            </div>
                            <Badge className="bg-orange-100 text-orange-800">{missingDays} يوم ({percentage}%)</Badge>
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
                      قيم غير منطقية
                    </CardTitle>
                    <CardDescription>بيانات تحتاج مراجعة وتصحيح</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {dataQualityMetrics.employeesWithAnomalies.length === 0 ? (
                      <div className="text-center py-8 text-green-600">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                        لا توجد قيم غير منطقية
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
                              {item.severity === "high" ? "عالي" : item.severity === "medium" ? "متوسط" : "منخفض"}
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
                      <p className="text-sm text-gray-600">نسبة السعودة</p>
                      <p className="text-xs text-gray-500">المطلوب: {complianceMetrics.requiredSaudization}%</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-700">{formatCurrency(complianceMetrics.totalGosi)}</p>
                      <p className="text-sm text-blue-600">إجمالي التأمينات</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-teal-50 border-teal-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-teal-700">{complianceMetrics.saudiEmployees}</p>
                      <p className="text-sm text-teal-600">موظفين سعوديين</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className={`${complianceMetrics.criticalExpiries > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className={`text-3xl font-bold ${complianceMetrics.criticalExpiries > 0 ? "text-red-700" : "text-green-700"}`}>{complianceMetrics.expiringContracts.length}</p>
                      <p className={`text-sm ${complianceMetrics.criticalExpiries > 0 ? "text-red-600" : "text-green-600"}`}>وثائق تنتهي قريباً</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-gosi-report">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      تقرير التأمينات الاجتماعية (GOSI)
                    </CardTitle>
                    <CardDescription>حصة الموظف 9.75% + حصة صاحب العمل 11.75%</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-700">{formatCurrency(complianceMetrics.totalGosiEmployee)}</p>
                          <p className="text-xs text-blue-600">حصة الموظف (9.75%)</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-700">{formatCurrency(complianceMetrics.totalGosiEmployer)}</p>
                          <p className="text-xs text-blue-600">حصة صاحب العمل (11.75%)</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-800">{formatCurrency(complianceMetrics.totalGosi)}</p>
                          <p className="text-xs text-blue-600">الإجمالي</p>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right">الموظف</TableHead>
                              <TableHead className="text-center">الراتب الأساسي</TableHead>
                              <TableHead className="text-center">حصة الموظف</TableHead>
                              <TableHead className="text-center">حصة صاحب العمل</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {complianceMetrics.gosiReport.slice(0, 10).map(row => (
                              <TableRow key={row.emp.id}>
                                <TableCell className="text-right">{row.emp.employeeName}</TableCell>
                                <TableCell className="text-center">{formatCurrency(row.baseSalary)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(row.employeeContribution)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(row.employerContribution)}</TableCell>
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
                      وثائق تنتهي خلال 60 يوم
                    </CardTitle>
                    <CardDescription>إقامات وجوازات تحتاج تجديد</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {complianceMetrics.expiringContracts.length === 0 ? (
                      <div className="text-center py-8 text-green-600">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                        لا توجد وثائق تنتهي قريباً
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {complianceMetrics.expiringContracts.map((item, index) => (
                          <div key={index} className={`flex items-center justify-between p-2 rounded ${item.daysLeft <= 30 ? "bg-red-50" : "bg-yellow-50"}`}>
                            <div>
                              <p className="font-medium text-sm">{item.emp.employeeName}</p>
                              <p className="text-xs text-gray-500">
                                {item.type === "iqama" ? "إقامة" : item.type === "passport" ? "جواز" : "عقد"} - ينتهي: {formatDate(item.expiryDate)}
                              </p>
                            </div>
                            <Badge className={`${item.daysLeft <= 30 ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                              {item.daysLeft} يوم
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
                    تكاليف الموظفين غير السعوديين على صاحب العمل
                  </CardTitle>
                  <CardDescription>
                    تأمين إصابات العمل (2%) + رسوم رخصة العمل (66 ريال/شهر) + رسوم الإقامة (54 ريال/شهر)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* ملخص التكاليف */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{formatNumber(complianceMetrics.totalNonSaudiCount)}</p>
                      <p className="text-xs text-gray-600">غير سعودي</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-xl font-bold text-blue-600">{formatCurrency(complianceMetrics.totalNonSaudiInsurance)}</p>
                      <p className="text-xs text-gray-600">تأمين 2%</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-xl font-bold text-purple-600">{formatCurrency(complianceMetrics.totalNonSaudiWorkPermit)}</p>
                      <p className="text-xs text-gray-600">رخصة العمل</p>
                    </div>
                    <div className="text-center p-3 bg-teal-50 rounded-lg">
                      <p className="text-xl font-bold text-teal-600">{formatCurrency(complianceMetrics.totalNonSaudiIqama)}</p>
                      <p className="text-xs text-gray-600">رسوم الإقامة</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-xl font-bold text-red-600">{formatCurrency(complianceMetrics.totalNonSaudiMonthlyCost)}</p>
                      <p className="text-xs text-gray-600">إجمالي شهري</p>
                    </div>
                  </div>

                  {/* جدول التفاصيل حسب الجنسية */}
                  {complianceMetrics.nonSaudiCostAnalysis.length > 0 && (
                    <div className="overflow-x-auto">
                      <Table className="table-fixed w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right w-[100px]">الجنسية</TableHead>
                            <TableHead className="text-center w-[60px]">العدد</TableHead>
                            <TableHead className="text-center w-[100px]">الراتب+السكن</TableHead>
                            <TableHead className="text-center w-[80px]">تأمين 2%</TableHead>
                            <TableHead className="text-center w-[80px]">رخصة العمل</TableHead>
                            <TableHead className="text-center w-[80px]">الإقامة</TableHead>
                            <TableHead className="text-center w-[100px]">إجمالي التكلفة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {complianceMetrics.nonSaudiCostAnalysis.map((nat, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-right">{nat.nationality}</TableCell>
                              <TableCell className="text-center">{formatNumber(nat.count)}</TableCell>
                              <TableCell className="text-center">{formatCurrency(nat.insurableSalary)}</TableCell>
                              <TableCell className="text-center text-blue-600">{formatCurrency(nat.insuranceCost)}</TableCell>
                              <TableCell className="text-center text-purple-600">{formatCurrency(nat.workPermitCost)}</TableCell>
                              <TableCell className="text-center text-teal-600">{formatCurrency(nat.iqamaCost)}</TableCell>
                              <TableCell className="text-center font-bold text-red-600">{formatCurrency(nat.totalMonthlyCost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* مقارنة التكاليف */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-bold mb-3 text-gray-700">مقارنة تكاليف صاحب العمل الشهرية</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-green-100 rounded-lg text-center">
                        <p className="text-lg font-bold text-green-700">{formatCurrency(complianceMetrics.totalEmployerCostSaudi)}</p>
                        <p className="text-xs text-green-600">السعوديين (11.75%)</p>
                        <p className="text-xs text-gray-500">{complianceMetrics.saudiEmployees} موظف</p>
                      </div>
                      <div className="p-3 bg-orange-100 rounded-lg text-center">
                        <p className="text-lg font-bold text-orange-700">{formatCurrency(complianceMetrics.totalEmployerCostNonSaudi)}</p>
                        <p className="text-xs text-orange-600">غير السعوديين (2%+رسوم)</p>
                        <p className="text-xs text-gray-500">{complianceMetrics.totalNonSaudiCount} موظف</p>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-lg text-center">
                        <p className="text-lg font-bold text-blue-700">{formatCurrency(complianceMetrics.totalEmployerCost)}</p>
                        <p className="text-xs text-blue-600">الإجمالي الشهري</p>
                        <p className="text-xs text-gray-500">{complianceMetrics.saudiEmployees + complianceMetrics.totalNonSaudiCount} موظف</p>
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
                        <p className="font-bold text-red-800">تحذير: نسبة السعودة أقل من المطلوب</p>
                        <p className="text-sm text-red-600">
                          يجب توظيف {Math.ceil((complianceMetrics.requiredSaudization / 100 * (complianceMetrics.saudiEmployees + complianceMetrics.nonSaudiEmployees)) - complianceMetrics.saudiEmployees)} موظف سعودي إضافي للوصول للنسبة المطلوبة ({complianceMetrics.requiredSaudization}%)
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
                    تحذيرات الشهادات الصحية
                  </CardTitle>
                  <CardDescription>الشهادات المنتهية أو القريبة من الانتهاء</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className={`text-center p-3 rounded-lg ${healthCertificateAnalysis.expired > 0 ? "bg-red-50" : "bg-green-50"}`}>
                      <p className={`text-2xl font-bold ${healthCertificateAnalysis.expired > 0 ? "text-red-600" : "text-green-600"}`}>{formatNumber(healthCertificateAnalysis.expired)}</p>
                      <p className="text-xs text-gray-600">منتهية</p>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${healthCertificateAnalysis.expiringWithin30.length > 0 ? "bg-orange-50" : "bg-green-50"}`}>
                      <p className={`text-2xl font-bold ${healthCertificateAnalysis.expiringWithin30.length > 0 ? "text-orange-600" : "text-green-600"}`}>{formatNumber(healthCertificateAnalysis.expiringWithin30.length)}</p>
                      <p className="text-xs text-gray-600">تنتهي خلال 30 يوم</p>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${healthCertificateAnalysis.none > 0 ? "bg-yellow-50" : "bg-green-50"}`}>
                      <p className={`text-2xl font-bold ${healthCertificateAnalysis.none > 0 ? "text-yellow-600" : "text-green-600"}`}>{formatNumber(healthCertificateAnalysis.none)}</p>
                      <p className="text-xs text-gray-600">بدون شهادة</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-50">
                      <p className="text-2xl font-bold text-green-600">{healthCertificateAnalysis.complianceRate}%</p>
                      <p className="text-xs text-gray-600">نسبة الامتثال</p>
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
                            {item.daysLeft <= 0 ? "منتهية" : `${item.daysLeft} يوم`}
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
                    نسبة السعودة حسب الفرع
                  </CardTitle>
                  <CardDescription>المطلوب: {complianceMetrics.requiredSaudization}% لكل فرع</CardDescription>
                </CardHeader>
                <CardContent>
                  {complianceMetrics.branchSaudization.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">لا توجد بيانات</div>
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
                              <span className="text-gray-600">إجمالي الموظفين:</span>
                              <span className="font-medium">{formatNumber(branch.total)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-green-600">سعوديين:</span>
                              <span className="font-medium text-green-700">{formatNumber(branch.saudis)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-orange-600">غير سعوديين:</span>
                              <span className="font-medium text-orange-700">{formatNumber(branch.nonSaudis)}</span>
                            </div>
                            {branch.neededSaudis > 0 && (
                              <div className="flex justify-between pt-1 border-t">
                                <span className="text-red-600">المطلوب توظيفهم:</span>
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
                    تقرير التكاليف الحكومية الشامل
                  </CardTitle>
                  <CardDescription>جميع الرسوم والتكاليف الحكومية الشهرية والسنوية</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* التأمينات الاجتماعية */}
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        التأمينات الاجتماعية (شهري)
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>حصة الموظف السعودي (9.75%):</span>
                          <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.gosiSaudiEmployee)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>حصة صاحب العمل للسعوديين (11.75%):</span>
                          <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.gosiSaudiEmployer)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>تأمين إصابات العمل لغير السعوديين (2%):</span>
                          <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.gosiNonSaudiEmployer)}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t font-bold text-blue-800">
                          <span>إجمالي التأمينات (صاحب العمل):</span>
                          <span>{formatCurrency(complianceMetrics.governmentCosts.totalGosiEmployerOnly)}</span>
                        </div>
                      </div>
                    </div>

                    {/* رسوم العمالة */}
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        رسوم العمالة (شهري)
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>رخص العمل (66 ريال/موظف):</span>
                          <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.workPermitTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>رسوم الإقامة (54 ريال/موظف):</span>
                          <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.iqamaFeesTotal)}</span>
                        </div>
                        {complianceMetrics.governmentCosts.excessWorkers > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>المقابل المالي ({complianceMetrics.governmentCosts.excessWorkers} عامل فائض):</span>
                            <span className="font-medium">{formatCurrency(complianceMetrics.governmentCosts.muqabilMaliMonthly)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t font-bold text-purple-800">
                          <span>إجمالي رسوم العمالة:</span>
                          <span>{formatCurrency(complianceMetrics.governmentCosts.laborFeesTotal + complianceMetrics.governmentCosts.muqabilMaliMonthly)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* الإجمالي */}
                  <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-2xl font-bold text-gray-800">{formatCurrency(complianceMetrics.governmentCosts.totalMonthlyEmployerCost)}</p>
                        <p className="text-sm text-gray-600">إجمالي تكاليف صاحب العمل الشهرية</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg">
                        <p className="text-2xl font-bold text-gray-800">{formatCurrency(complianceMetrics.governmentCosts.totalYearlyEmployerCost)}</p>
                        <p className="text-sm text-gray-600">إجمالي تكاليف صاحب العمل السنوية</p>
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
                    حالة وثائق الموظفين
                  </CardTitle>
                  <CardDescription>نسبة اكتمال ملفات الموظفين</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* ملخص الحالة */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">{formatNumber(complianceMetrics.documentStatusSummary.complete)}</p>
                      <p className="text-xs text-gray-600">مكتمل</p>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{formatNumber(complianceMetrics.documentStatusSummary.incomplete)}</p>
                      <p className="text-xs text-gray-600">ناقص</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{formatNumber(complianceMetrics.documentStatusSummary.expired)}</p>
                      <p className="text-xs text-gray-600">منتهي</p>
                    </div>
                    <div className={`text-center p-3 rounded-lg ${complianceMetrics.documentStatusSummary.completionRate >= 80 ? "bg-green-50" : complianceMetrics.documentStatusSummary.completionRate >= 60 ? "bg-yellow-50" : "bg-red-50"}`}>
                      <p className={`text-2xl font-bold ${complianceMetrics.documentStatusSummary.completionRate >= 80 ? "text-green-600" : complianceMetrics.documentStatusSummary.completionRate >= 60 ? "text-yellow-600" : "text-red-600"}`}>{complianceMetrics.documentStatusSummary.completionRate}%</p>
                      <p className="text-xs text-gray-600">نسبة الاكتمال</p>
                    </div>
                  </div>

                  {/* قائمة الموظفين بمشاكل */}
                  {complianceMetrics.employeeDocumentStatus.filter(e => e.status !== "complete").length > 0 && (
                    <div className="overflow-x-auto">
                      <Table className="table-fixed w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right w-[150px]">الموظف</TableHead>
                            <TableHead className="text-center w-[100px]">الفرع</TableHead>
                            <TableHead className="text-center w-[80px]">الحالة</TableHead>
                            <TableHead className="text-right w-[250px]">المشاكل</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {complianceMetrics.employeeDocumentStatus.filter(e => e.status !== "complete").slice(0, 15).map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-right">{item.emp.employeeName}</TableCell>
                              <TableCell className="text-center text-sm">{branches?.find(b => b.id === item.emp.branchId)?.name || item.emp.branchId}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`${item.status === "expired" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                                  {item.status === "expired" ? "منتهي" : "ناقص"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs text-gray-600">{item.issues.slice(0, 3).join(" • ")}</TableCell>
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
                    تصدير تقارير الجهات الحكومية
                  </CardTitle>
                  <CardDescription>تقارير جاهزة للتقديم للجهات الحكومية</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2"
                      onClick={() => {
                        const data = complianceMetrics.gosiReport.map(r => ({
                          "اسم الموظف": r.emp.employeeName,
                          "رقم الهوية": r.emp.iqamaNumber || "",
                          "الراتب الأساسي": r.baseSalary,
                          "حصة الموظف (9.75%)": r.employeeContribution,
                          "حصة صاحب العمل (11.75%)": r.employerContribution,
                          "الإجمالي": r.totalContribution,
                        }));
                        const ws = XLSX.utils.json_to_sheet(data);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "تقرير التأمينات");
                        XLSX.writeFile(wb, `تقرير_التأمينات_${new Date().toISOString().split('T')[0]}.xlsx`);
                      }}
                    >
                      <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                      <span className="font-medium">تقرير التأمينات الاجتماعية</span>
                      <span className="text-xs text-gray-500">Excel</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2"
                      onClick={() => {
                        const data = filteredEmployees.filter(e => e.nationality !== "سعودي" && e.status === "active").map(emp => ({
                          "اسم الموظف": emp.employeeName,
                          "الجنسية": emp.nationality,
                          "رقم الإقامة": emp.iqamaNumber || "",
                          "تاريخ انتهاء الإقامة": emp.iqamaExpiry || "",
                          "رقم الجواز": emp.passportNumber || "",
                          "المسمى الوظيفي": emp.jobTitle || "",
                          "الفرع": branches?.find(b => b.id === emp.branchId)?.name || emp.branchId,
                        }));
                        const ws = XLSX.utils.json_to_sheet(data);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "العمالة الوافدة");
                        XLSX.writeFile(wb, `تقرير_مكتب_العمل_${new Date().toISOString().split('T')[0]}.xlsx`);
                      }}
                    >
                      <FileSpreadsheet className="w-8 h-8 text-purple-600" />
                      <span className="font-medium">تقرير مكتب العمل</span>
                      <span className="text-xs text-gray-500">Excel</span>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col items-center gap-2"
                      onClick={() => {
                        const data = complianceMetrics.branchSaudization.map(b => ({
                          "الفرع": b.branchName,
                          "إجمالي الموظفين": b.total,
                          "السعوديين": b.saudis,
                          "غير السعوديين": b.nonSaudis,
                          "نسبة السعودة": `${b.rate}%`,
                          "الحالة": b.status === "green" ? "ملتزم" : b.status === "yellow" ? "قريب" : "غير ملتزم",
                          "المطلوب توظيفهم": b.neededSaudis,
                        }));
                        const ws = XLSX.utils.json_to_sheet(data);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "نسب السعودة");
                        XLSX.writeFile(wb, `تقرير_السعودة_${new Date().toISOString().split('T')[0]}.xlsx`);
                      }}
                    >
                      <FileSpreadsheet className="w-8 h-8 text-teal-600" />
                      <span className="font-medium">تقرير نسب السعودة</span>
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
                      <p className="text-sm text-gray-600">نسبة الدوران</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-700">{formatNumber(turnoverAnalysis.totalActive)}</p>
                      <p className="text-sm text-green-600">نشط</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-700">{formatNumber(turnoverAnalysis.totalTerminated)}</p>
                      <p className="text-sm text-red-600">منتهي</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-yellow-700">{formatNumber(turnoverAnalysis.totalOnLeave)}</p>
                      <p className="text-sm text-yellow-600">في إجازة</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-turnover-by-branch">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      الدوران حسب الفرع
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {turnoverAnalysis.turnoverByBranch.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">لا توجد بيانات</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={turnoverAnalysis.turnoverByBranch} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="branchName" type="category" width={100} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="active" fill="#10b981" name="نشط" />
                          <Bar dataKey="terminated" fill="#ef4444" name="منتهي" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-turnover-by-job">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      أعلى وظائف في الدوران
                    </CardTitle>
                    <CardDescription>الوظائف ذات أعلى نسبة ترك عمل</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {turnoverAnalysis.turnoverByJob.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">لا توجد بيانات</div>
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
                              <span>نشط: {job.active}</span>
                              <span>منتهي: {job.terminated}</span>
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
                        مقارنة شاملة بين الفروع
                      </CardTitle>
                      <CardDescription>مقارنة مؤشرات الأداء والموظفين والرواتب عبر جميع الفروع لشهر {selectedMonth}</CardDescription>
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
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        مقارنة الوظائف عبر الفروع
                      </CardTitle>
                      <CardDescription>تحليل فروقات الرواتب لنفس المسمى الوظيفي في فروع مختلفة (مرتبة حسب أكبر فرق)</CardDescription>
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
                  { range: "أقل من 2,000", min: 0, max: 2000, count: 0 },
                  { range: "2,000 - 4,000", min: 2000, max: 4000, count: 0 },
                  { range: "4,000 - 6,000", min: 4000, max: 6000, count: 0 },
                  { range: "6,000 - 8,000", min: 6000, max: 8000, count: 0 },
                  { range: "8,000 - 10,000", min: 8000, max: 10000, count: 0 },
                  { range: "أكثر من 10,000", min: 10000, max: Infinity, count: 0 },
                ];
                filteredEmployees.forEach(emp => {
                  const salary = emp.totalSalary || 0;
                  const range = salaryRanges.find(r => salary >= r.min && salary < r.max);
                  if (range) range.count++;
                });

                // Allowances breakdown
                const allowancesBreakdown = [
                  { name: "بدل سكن", value: salaryStats.totalHousing, color: "#f59e0b" },
                  { name: "بدل مواصلات", value: salaryStats.totalTransport, color: "#3b82f6" },
                  { name: "بدل طعام", value: salaryStats.totalFood, color: "#10b981" },
                  { name: "بدلات أخرى", value: salaryStats.totalOther, color: "#8b5cf6" },
                ].filter(a => a.value > 0);

                return (
                  <>
                    {/* KPI Cards Row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <DollarSign className="w-6 h-6 mx-auto text-green-600 mb-1" />
                            <p className="text-xs text-green-600">إجمالي الرواتب</p>
                            <p className="text-lg font-bold text-green-800">{formatCurrency(salaryStats.totalNet)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <Wallet className="w-6 h-6 mx-auto text-blue-600 mb-1" />
                            <p className="text-xs text-blue-600">الرواتب الأساسية</p>
                            <p className="text-lg font-bold text-blue-800">{formatCurrency(salaryStats.totalBasic)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <TrendingUp className="w-6 h-6 mx-auto text-amber-600 mb-1" />
                            <p className="text-xs text-amber-600">إجمالي البدلات</p>
                            <p className="text-lg font-bold text-amber-800">{formatCurrency(salaryStats.totalAllowances)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <Shield className="w-6 h-6 mx-auto text-red-600 mb-1" />
                            <p className="text-xs text-red-600">التأمينات الاجتماعية</p>
                            <p className="text-lg font-bold text-red-800">{formatCurrency(salaryStats.totalInsurance)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <Users className="w-6 h-6 mx-auto text-purple-600 mb-1" />
                            <p className="text-xs text-purple-600">متوسط الراتب</p>
                            <p className="text-lg font-bold text-purple-800">{formatCurrency(avgSalary)}</p>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                        <CardContent className="pt-4">
                          <div className="text-center">
                            <BarChart3 className="w-6 h-6 mx-auto text-teal-600 mb-1" />
                            <p className="text-xs text-teal-600">تكلفة الموظف</p>
                            <p className="text-lg font-bold text-teal-800">{formatCurrency(costPerEmployee)}</p>
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
                            توزيع الرواتب حسب الفرع
                          </CardTitle>
                          <CardDescription>إجمالي الرواتب والبدلات لكل فرع</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={branchSalaryChartData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" tickFormatter={(v) => formatNumber(v)} />
                              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                              <Legend />
                              <Bar dataKey="basic" stackId="a" fill="#3b82f6" name="الأساسي" radius={[0, 0, 0, 0]} />
                              <Bar dataKey="allowances" stackId="a" fill="#f59e0b" name="البدلات" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Salary Ranges Chart */}
                      <Card>
                        <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 border-b">
                          <CardTitle className="flex items-center gap-2 text-purple-800">
                            <BarChart3 className="w-5 h-5" />
                            توزيع نطاقات الرواتب
                          </CardTitle>
                          <CardDescription>عدد الموظفين في كل نطاق</CardDescription>
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
                                    <span className="text-sm font-medium text-gray-700">{range.range} ريال</span>
                                    <span className="text-sm font-bold text-gray-900">{range.count} موظف</span>
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
                            توزيع البدلات
                          </CardTitle>
                          <CardDescription>نسبة كل نوع من البدلات</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                          {allowancesBreakdown.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">لا توجد بدلات مسجلة</div>
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
                                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
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
                                        <span className="text-sm font-bold text-gray-900">{formatCurrency(item.value)}</span>
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
                            ملخص الرواتب حسب الفرع
                          </CardTitle>
                          <CardDescription>إجماليات كل فرع</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">الفرع</TableHead>
                                <TableHead className="text-center">الموظفين</TableHead>
                                <TableHead className="text-center">الأساسي</TableHead>
                                <TableHead className="text-center">البدلات</TableHead>
                                <TableHead className="text-center">الصافي</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {branchSalaryChartData.map((branch) => (
                                <TableRow key={branch.name}>
                                  <TableCell className="font-medium">{branch.name}</TableCell>
                                  <TableCell className="text-center">{branch.count}</TableCell>
                                  <TableCell className="text-center text-sm">{formatCurrency(branch.basic)}</TableCell>
                                  <TableCell className="text-center text-sm">{formatCurrency(branch.allowances)}</TableCell>
                                  <TableCell className="text-center font-bold text-green-700">{formatCurrency(branch.net)}</TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-gray-50 font-bold">
                                <TableCell>الإجمالي</TableCell>
                                <TableCell className="text-center">{salaryStats.count}</TableCell>
                                <TableCell className="text-center">{formatCurrency(salaryStats.totalBasic)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(salaryStats.totalAllowances)}</TableCell>
                                <TableCell className="text-center text-green-700">{formatCurrency(salaryStats.totalNet)}</TableCell>
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
                      <CardTitle>جدول الرواتب التفصيلي</CardTitle>
                      <CardDescription>بيانات الرواتب والبدلات المفصلة لجميع الموظفين</CardDescription>
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
                        <Label className="text-xs text-gray-500 mb-1 block">بحث</Label>
                        <Input
                          placeholder="ابحث بالاسم أو رقم الموظف أو الوظيفة..."
                          value={salarySearchQuery}
                          onChange={(e) => setSalarySearchQuery(e.target.value)}
                          className="h-9"
                          data-testid="input-salary-search"
                        />
                      </div>
                      {/* Nationality Filter */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">الجنسية</Label>
                        <Select value={salaryNationalityFilter} onValueChange={setSalaryNationalityFilter}>
                          <SelectTrigger className="h-9" data-testid="select-salary-nationality">
                            <SelectValue placeholder="الكل" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">جميع الجنسيات</SelectItem>
                            {uniqueNationalities.map(nat => (
                              <SelectItem key={nat} value={nat}>{nat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Salary Range */}
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">نطاق الراتب (من)</Label>
                        <Input
                          type="number"
                          placeholder="الحد الأدنى"
                          value={salaryMinFilter}
                          onChange={(e) => setSalaryMinFilter(e.target.value)}
                          className="h-9"
                          data-testid="input-salary-min"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">نطاق الراتب (إلى)</Label>
                        <Input
                          type="number"
                          placeholder="الحد الأقصى"
                          value={salaryMaxFilter}
                          onChange={(e) => setSalaryMaxFilter(e.target.value)}
                          className="h-9"
                          data-testid="input-salary-max"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <div className="flex items-center gap-4">
                        <Label className="text-xs text-gray-500">ترتيب حسب:</Label>
                        <Select value={salarySortField} onValueChange={setSalarySortField}>
                          <SelectTrigger className="h-8 w-[140px]" data-testid="select-salary-sort">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employeeName">الاسم</SelectItem>
                            <SelectItem value="salary">الراتب الأساسي</SelectItem>
                            <SelectItem value="totalSalary">صافي الراتب</SelectItem>
                            <SelectItem value="branchId">الفرع</SelectItem>
                            <SelectItem value="jobTitle">الوظيفة</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8"
                          onClick={() => setSalarySortOrder(prev => prev === "asc" ? "desc" : "asc")}
                        >
                          {salarySortOrder === "asc" ? "تصاعدي ↑" : "تنازلي ↓"}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-white">
                          {salaryFilteredEmployees.length} من {filteredEmployees.length} موظف
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
                          إعادة تعيين
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
                          <TableHead className="text-right w-10">م</TableHead>
                          <TableHead className="text-right">رقم الموظف</TableHead>
                          <TableHead className="text-right">الموظف</TableHead>
                          <TableHead className="text-right">الفرع</TableHead>
                          <TableHead className="text-right">الوظيفة</TableHead>
                          <TableHead className="text-right">الجنسية</TableHead>
                          <TableHead className="text-center bg-blue-50">الأساسي</TableHead>
                          <TableHead className="text-center bg-amber-50">بدل سكن</TableHead>
                          <TableHead className="text-center bg-amber-50">بدل مواصلات</TableHead>
                          <TableHead className="text-center bg-amber-50">بدل طعام</TableHead>
                          <TableHead className="text-center bg-amber-50">بدلات أخرى</TableHead>
                          <TableHead className="text-center bg-red-50">التأمينات</TableHead>
                          <TableHead className="text-center bg-green-50 font-bold">الصافي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salaryFilteredEmployees.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={13} className="text-center py-8 text-gray-500">
                              لا توجد نتائج مطابقة للبحث
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
                                <TableCell className="text-center bg-blue-50/50">{formatCurrency(emp.salary)}</TableCell>
                                <TableCell className="text-center bg-amber-50/50">{emp.housingAllowance ? formatCurrency(emp.housingAllowance) : "-"}</TableCell>
                                <TableCell className="text-center bg-amber-50/50">{emp.transportAllowance ? formatCurrency(emp.transportAllowance) : "-"}</TableCell>
                                <TableCell className="text-center bg-amber-50/50">{emp.foodAllowance ? formatCurrency(emp.foodAllowance) : "-"}</TableCell>
                                <TableCell className="text-center bg-amber-50/50">{emp.otherAllowances ? formatCurrency(emp.otherAllowances) : "-"}</TableCell>
                                <TableCell className="text-center bg-red-50/50 text-red-600">
                                  {insurance > 0 ? `- ${formatCurrency(insurance)}` : "-"}
                                </TableCell>
                                <TableCell className="text-center bg-green-50/50 font-bold text-green-700">{formatCurrency(emp.totalSalary)}</TableCell>
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
                        <p className="text-gray-500">إجمالي الموظفين (المعروضين)</p>
                        <p className="font-bold text-lg">{salaryFilteredEmployees.length}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">إجمالي الرواتب الأساسية</p>
                        <p className="font-bold text-lg text-blue-700">
                          {formatCurrency(salaryFilteredEmployees.reduce((sum, e) => sum + (e.salary || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">إجمالي البدلات</p>
                        <p className="font-bold text-lg text-amber-700">
                          {formatCurrency(salaryFilteredEmployees.reduce((sum, e) => sum + (e.housingAllowance || 0) + (e.transportAllowance || 0) + (e.foodAllowance || 0) + (e.otherAllowances || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">صافي الرواتب المستحقة</p>
                        <p className="font-bold text-lg text-green-700">
                          {formatCurrency(salaryFilteredEmployees.reduce((sum, e) => sum + (e.totalSalary || 0), 0))}
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
                  <FileSpreadsheet className="w-4 h-4 ml-1" />
                  تصدير التحليلات Excel
                </Button>
              </div>
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <Card data-testid="card-nationality-distribution">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      توزيع الجنسيات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={nationalityDistribution} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#f59e0b" name="عدد الموظفين" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="card-late-analysis">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-red-500" />
                      أكثر الموظفين تأخراً
                    </CardTitle>
                    <CardDescription>أعلى 10 موظفين في عدد أيام التأخير</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {lateAnalysis.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">لا توجد سجلات تأخير</div>
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
                            <Badge className="bg-red-100 text-red-800">{emp.lateDays} يوم</Badge>
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
                      تحليل ساعات العمل حسب الفرع
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
                        <Bar dataKey="totalHours" fill="#3b82f6" name="إجمالي الساعات" />
                        <Bar dataKey="overtime" fill="#10b981" name="ساعات إضافية" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card data-testid="card-branch-ranking">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-amber-500" />
                      ترتيب الفروع حسب الأداء
                    </CardTitle>
                    <CardDescription>التقييم الشامل بناءً على السعودة والحضور والإنتاجية</CardDescription>
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
                              <p className="text-gray-500">السعودة</p>
                              <p className="font-bold">{branch.saudiScore}/25</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-500">الحضور</p>
                              <p className="font-bold">{branch.attendanceScore}/25</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-500">الإنتاجية</p>
                              <p className="font-bold">{branch.productivityScore}/25</p>
                            </div>
                            <div className="text-center">
                              <p className="text-gray-500">الكفاءة</p>
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
                      توزيع الموظفين حسب مدة الخدمة
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
                      مؤشرات الإنذار المبكر
                    </CardTitle>
                    <CardDescription>موظفين يحتاجون متابعة بسبب نمط الحضور</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {earlyWarningIndicators.length === 0 ? (
                      <div className="text-center py-8 text-green-600">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                        لا توجد تنبيهات حالياً
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
                              {warning.severity === "high" ? "عالي" : "متوسط"}
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
                      مقارنة الجدولة بالحضور الفعلي
                    </CardTitle>
                    <CardDescription>تحليل الفروقات بين الورديات المجدولة والحضور</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {scheduleVarianceAnalysis.summary.total === 0 ? (
                      <div className="text-center py-8 text-gray-500">لا توجد بيانات جدولة</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                          <div className="p-2 bg-green-50 rounded">
                            <p className="text-xl font-bold text-green-700">{scheduleVarianceAnalysis.summary.onTime}</p>
                            <p className="text-xs text-green-600">في الموعد</p>
                          </div>
                          <div className="p-2 bg-yellow-50 rounded">
                            <p className="text-xl font-bold text-yellow-700">{scheduleVarianceAnalysis.summary.late}</p>
                            <p className="text-xs text-yellow-600">متأخر</p>
                          </div>
                          <div className="p-2 bg-red-50 rounded">
                            <p className="text-xl font-bold text-red-700">{scheduleVarianceAnalysis.summary.absent}</p>
                            <p className="text-xs text-red-600">غائب</p>
                          </div>
                          <div className="p-2 bg-blue-50 rounded">
                            <p className="text-xl font-bold text-blue-700">{scheduleVarianceAnalysis.summary.total}</p>
                            <p className="text-xs text-blue-600">إجمالي</p>
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
                      أداء الكاشير والمبيعات
                    </CardTitle>
                    <CardDescription>ربط موظفي الكاشير بإجمالي المبيعات</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {cashierPerformanceAnalysis.cashierPerformance.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">لا توجد بيانات مبيعات</div>
                    ) : (
                      <>
                        <div className="p-3 bg-green-50 rounded-lg mb-4 text-center">
                          <p className="text-2xl font-bold text-green-700">{formatCurrency(cashierPerformanceAnalysis.totalSales)}</p>
                          <p className="text-xs text-green-600">إجمالي المبيعات للشهر</p>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {cashierPerformanceAnalysis.cashierPerformance.map((cashier, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <p className="font-medium text-sm">{cashier.name}</p>
                                <p className="text-xs text-gray-500">{cashier.daysWorked} يوم عمل</p>
                              </div>
                              <div className="text-left">
                                <p className="font-bold text-green-700">{formatCurrency(cashier.totalSales)}</p>
                                <p className="text-xs text-gray-500">متوسط: {formatCurrency(cashier.avgDaily)}</p>
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

            {/* Health Certificates Tab */}
            <TabsContent value="health-certificates" className="space-y-4" data-testid="tab-content-health-certificates">
              <div className="flex justify-end mb-4 gap-2">
                <Button variant="outline" size="sm" onClick={() => {
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
                <Button variant="outline" size="sm" onClick={() => {
                  const docDefinition: any = {
                    content: [
                      { text: "تقرير الشهادات الصحية", style: "header", alignment: "center" },
                      { text: [{ text: "الشهر: " }, { text: selectedMonth, font: "Roboto" }], alignment: "center", margin: [0, 5, 0, 15] },
                      { text: [{ text: "نسبة الامتثال: " }, { text: `${healthCertificateAnalysis.complianceRate}%`, font: "Roboto" }], alignment: "center", margin: [0, 0, 0, 10] },
                      {
                        table: {
                          headerRows: 1,
                          widths: ["*", "*", "*", "*", "*"],
                          body: [
                            ["الموظف", "الفرع", "الوظيفة", "الحالة", "تاريخ الانتهاء"],
                            ...healthCertificateAnalysis.needsRenewal.map(emp => [
                              emp.employeeName,
                              getBranchName(emp.branchId),
                              emp.jobTitle,
                              emp.healthCertificate === "valid" ? "صالحة" : emp.healthCertificate === "expired" ? "منتهية" : "لا توجد",
                              { text: emp.healthCertificateExpiry || "--", font: "Roboto" }
                            ])
                          ]
                        }
                      }
                    ],
                    styles: { header: { fontSize: 18, bold: true } }
                  };
                  downloadArabicPdf(docDefinition, `health_certificates_${selectedMonth}.pdf`);
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
                      <p className="text-sm text-green-600">شهادات صالحة</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200" data-testid="health-expired-count">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <XCircle className="w-8 h-8 mx-auto text-red-600 mb-2" />
                      <p className="text-3xl font-bold text-red-700">{formatNumber(healthCertificateAnalysis.expired)}</p>
                      <p className="text-sm text-red-600">شهادات منتهية</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200" data-testid="health-none-count">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                      <p className="text-3xl font-bold text-gray-700">{formatNumber(healthCertificateAnalysis.none)}</p>
                      <p className="text-sm text-gray-600">بدون شهادة</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className={`bg-gradient-to-br ${healthCertificateAnalysis.complianceRate >= 80 ? "from-teal-50 to-teal-100 border-teal-200" : healthCertificateAnalysis.complianceRate >= 50 ? "from-yellow-50 to-yellow-100 border-yellow-200" : "from-red-50 to-red-100 border-red-200"}`} data-testid="health-compliance-rate">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <TrendingUp className={`w-8 h-8 mx-auto mb-2 ${healthCertificateAnalysis.complianceRate >= 80 ? "text-teal-600" : healthCertificateAnalysis.complianceRate >= 50 ? "text-yellow-600" : "text-red-600"}`} />
                      <p className={`text-3xl font-bold ${healthCertificateAnalysis.complianceRate >= 80 ? "text-teal-700" : healthCertificateAnalysis.complianceRate >= 50 ? "text-yellow-700" : "text-red-700"}`}>{healthCertificateAnalysis.complianceRate}%</p>
                      <p className={`text-sm ${healthCertificateAnalysis.complianceRate >= 80 ? "text-teal-600" : healthCertificateAnalysis.complianceRate >= 50 ? "text-yellow-600" : "text-red-600"}`}>نسبة الامتثال</p>
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
                      تنتهي خلال 30 يوم
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-700">{healthCertificateAnalysis.expiringWithin30.length}</p>
                    {healthCertificateAnalysis.expiringWithin30.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                        {healthCertificateAnalysis.expiringWithin30.map((item, i) => (
                          <p key={i} className="text-xs text-red-600">{item.emp.employeeName} ({item.daysLeft} يوم)</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-yellow-200" data-testid="health-expiring-60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-yellow-700 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      تنتهي خلال 60 يوم
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-yellow-700">{healthCertificateAnalysis.expiringWithin60.length}</p>
                    {healthCertificateAnalysis.expiringWithin60.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                        {healthCertificateAnalysis.expiringWithin60.map((item, i) => (
                          <p key={i} className="text-xs text-yellow-600">{item.emp.employeeName} ({item.daysLeft} يوم)</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-blue-200" data-testid="health-expiring-90">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      تنتهي خلال 90 يوم
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-blue-700">{healthCertificateAnalysis.expiringWithin90.length}</p>
                    {healthCertificateAnalysis.expiringWithin90.length > 0 && (
                      <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                        {healthCertificateAnalysis.expiringWithin90.map((item, i) => (
                          <p key={i} className="text-xs text-blue-600">{item.emp.employeeName} ({item.daysLeft} يوم)</p>
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
                      نسبة الامتثال حسب الفرع
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
                          <Bar dataKey="rate" fill="#10b981" name="نسبة الامتثال">
                            {healthCertificateAnalysis.branchCompliance.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.rate >= 80 ? "#10b981" : entry.rate >= 50 ? "#f59e0b" : "#ef4444"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-10 text-gray-500">لا توجد بيانات</div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="health-job-compliance">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      نسبة الامتثال حسب الوظيفة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {healthCertificateAnalysis.jobCompliance.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {healthCertificateAnalysis.jobCompliance.map((job, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div>
                              <p className="font-medium text-sm">{job.job}</p>
                              <p className="text-xs text-gray-500">{job.valid}/{job.total} موظف</p>
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
                      <div className="text-center py-10 text-gray-500">لا توجد بيانات</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Renewal Needed Table */}
              <Card data-testid="health-renewal-table">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                    الموظفين الذين يحتاجون تجديد الشهادة الصحية
                  </CardTitle>
                  <CardDescription>شهادات منتهية أو غير موجودة أو تنتهي خلال 30 يوم</CardDescription>
                </CardHeader>
                <CardContent>
                  {healthCertificateAnalysis.needsRenewal.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">الموظف</TableHead>
                            <TableHead className="text-right">الفرع</TableHead>
                            <TableHead className="text-right">الوظيفة</TableHead>
                            <TableHead className="text-right">الحالة</TableHead>
                            <TableHead className="text-right">تاريخ الانتهاء</TableHead>
                            <TableHead className="text-right">الجوال</TableHead>
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
                                  {emp.healthCertificate === "expired" ? "منتهية" : 
                                   emp.healthCertificate === "none" || !emp.healthCertificate ? "لا توجد" : "تنتهي قريباً"}
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
                      جميع الموظفين لديهم شهادات صحية سارية
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Comprehensive Comparisons Tab */}
            <TabsContent value="comparisons" className="space-y-4" data-testid="tab-content-comparisons">
              <div className="flex justify-end mb-4 gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  if (!comprehensiveComparisons) return;
                  const wb = XLSX.utils.book_new();
                  const branchSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.branchSalaryStats.map(b => ({
                    "الفرع": b.branchName,
                    "عدد الموظفين": b.employeeCount,
                    "إجمالي الرواتب": b.totalSalary,
                    "متوسط الراتب": b.avgSalary,
                    "أعلى راتب": b.maxSalary,
                    "أقل راتب": b.minSalary,
                    "الأعلى راتباً": b.highestPaid,
                    "الأقل راتباً": b.lowestPaid,
                  })));
                  XLSX.utils.book_append_sheet(wb, branchSheet, "مقارنة الفروع");
                  const natSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.nationalityStats.map(n => ({
                    "الجنسية": n.nationality,
                    "العدد": n.count,
                    "النسبة": `${n.percentage}%`,
                    "متوسط الراتب": n.avgSalary,
                    "إجمالي الرواتب": n.totalSalary,
                  })));
                  XLSX.utils.book_append_sheet(wb, natSheet, "مقارنة الجنسيات");
                  const jobSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.jobAcrossBranches.map(j => ({
                    "الوظيفة": j.jobTitle,
                    "العدد": j.totalCount,
                    "متوسط الراتب": j.overallAvgSalary,
                    "أعلى فرع": j.highestPayingBranch,
                    "أقل فرع": j.lowestPayingBranch,
                    "فجوة الراتب": j.salaryGap,
                  })));
                  XLSX.utils.book_append_sheet(wb, jobSheet, "مقارنة الوظائف");
                  const tenureSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.tenureRanges.map(t => ({
                    "مدة الخدمة": t.range,
                    "عدد الموظفين": t.count,
                  })));
                  XLSX.utils.book_append_sheet(wb, tenureSheet, "مدة الخدمة");
                  const salaryGapSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.salaryGapByJob.map(g => ({
                    "الوظيفة": g.jobTitle,
                    "أعلى جنسية": g.highestPaidNat,
                    "أقل جنسية": g.lowestPaidNat,
                    "فجوة الراتب": g.maxGap,
                  })));
                  XLSX.utils.book_append_sheet(wb, salaryGapSheet, "فجوة الرواتب");
                  const allowancesSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.allowancesAnalysis.map(a => ({
                    "الفرع": a.branchName,
                    "الموظفين": a.employeeCount,
                    "بدل السكن": a.housingAllowance,
                    "بدل النقل": a.transportAllowance,
                    "بدل الطعام": a.foodAllowance,
                    "بدلات أخرى": a.otherAllowances,
                    "إجمالي البدلات": a.totalAllowances,
                    "متوسط/موظف": a.avgAllowancePerEmployee,
                  })));
                  XLSX.utils.book_append_sheet(wb, allowancesSheet, "تحليل البدلات");
                  const costSheet = XLSX.utils.json_to_sheet(comprehensiveComparisons.monthlyCostAnalysis.map(c => ({
                    "الفرع": c.branchName,
                    "الموظفين": c.employeeCount,
                    "الرواتب": c.totalSalaries,
                    "البدلات": c.totalAllowances,
                    "التأمينات": c.socialInsurance,
                    "إجمالي التكلفة": c.totalCost,
                    "تكلفة/موظف": c.costPerEmployee,
                  })));
                  XLSX.utils.book_append_sheet(wb, costSheet, "التكلفة الشهرية");
                  XLSX.writeFile(wb, `comparisons_report_${selectedMonth}.xlsx`);
                }} data-testid="button-export-comparisons-excel">
                  <FileSpreadsheet className="w-4 h-4 ml-1" />
                  Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  if (!comprehensiveComparisons) return;
                  const docDefinition: any = {
                    content: [
                      { text: "تقرير المقارنات الشامل", style: "header", alignment: "center" },
                      { text: [{ text: "الشهر: " }, { text: selectedMonth, font: "Roboto" }], alignment: "center", margin: [0, 5, 0, 15] },
                      { text: "مقارنة الفروع", style: "subheader", margin: [0, 10, 0, 5] },
                      {
                        table: {
                          headerRows: 1,
                          widths: ["*", "auto", "auto", "auto", "auto"],
                          body: [
                            ["الفرع", "العدد", "المتوسط", "الأعلى", "الأقل"],
                            ...comprehensiveComparisons.branchSalaryStats.map(b => [
                              b.branchName, { text: b.employeeCount.toString(), font: "Roboto" }, { text: b.avgSalary.toString(), font: "Roboto" }, { text: b.maxSalary.toString(), font: "Roboto" }, { text: b.minSalary.toString(), font: "Roboto" }
                            ])
                          ]
                        }
                      },
                      { text: "مقارنة الجنسيات", style: "subheader", margin: [0, 15, 0, 5] },
                      {
                        table: {
                          headerRows: 1,
                          widths: ["*", "auto", "auto", "auto"],
                          body: [
                            ["الجنسية", "العدد", "النسبة", "متوسط الراتب"],
                            ...comprehensiveComparisons.nationalityStats.map(n => [
                              n.nationality, { text: n.count.toString(), font: "Roboto" }, { text: `${n.percentage}%`, font: "Roboto" }, { text: n.avgSalary.toString(), font: "Roboto" }
                            ])
                          ]
                        }
                      }
                    ],
                    styles: { header: { fontSize: 18, bold: true }, subheader: { fontSize: 14, bold: true } }
                  };
                  downloadArabicPdf(docDefinition, `comparisons_report_${selectedMonth}.pdf`);
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
                        <p className="text-sm text-blue-600">عدد الفروع</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-green-700">{formatNumber(comprehensiveComparisons.summary.totalActiveEmployees)}</p>
                        <p className="text-sm text-green-600">موظف نشط</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-amber-700">{formatCurrency(comprehensiveComparisons.summary.overallAvgSalary)}</p>
                        <p className="text-sm text-amber-600">متوسط الراتب</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-lg font-bold text-teal-700">{comprehensiveComparisons.summary.highestAvgBranch}</p>
                        <p className="text-sm text-teal-600">أعلى متوسط</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                      <CardContent className="pt-4 text-center">
                        <p className="text-lg font-bold text-purple-700">{comprehensiveComparisons.summary.lowestAvgBranch}</p>
                        <p className="text-sm text-purple-600">أقل متوسط</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Branch Salary Comparison */}
                  <Card data-testid="card-branch-salary-comparison">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        مقارنة الرواتب حسب الفروع
                      </CardTitle>
                      <CardDescription>أعلى وأقل راتب في كل فرع مع المتوسط</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right w-[120px]">الفرع</TableHead>
                              <TableHead className="text-center w-[80px]">عدد الموظفين</TableHead>
                              <TableHead className="text-center w-[100px]">إجمالي الرواتب</TableHead>
                              <TableHead className="text-center w-[90px]">متوسط الراتب</TableHead>
                              <TableHead className="text-center w-[80px]">أعلى راتب</TableHead>
                              <TableHead className="text-center w-[80px]">أقل راتب</TableHead>
                              <TableHead className="text-center w-[140px]">الأعلى راتباً</TableHead>
                              <TableHead className="text-center w-[140px]">الأقل راتباً</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comprehensiveComparisons.branchSalaryStats.map((branch, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium text-right">{branch.branchName}</TableCell>
                                <TableCell className="text-center">{formatNumber(branch.employeeCount)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.totalSalary)}</TableCell>
                                <TableCell className="text-center font-bold text-amber-600">{formatCurrency(branch.avgSalary)}</TableCell>
                                <TableCell className="text-center text-green-600">{formatCurrency(branch.maxSalary)}</TableCell>
                                <TableCell className="text-center text-red-600">{formatCurrency(branch.minSalary)}</TableCell>
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
                          مقارنة حسب الجنسيات
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={comprehensiveComparisons.nationalityStats.slice(0, 8)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="nationality" />
                            <YAxis />
                            <Tooltip formatter={(value) => formatNumber(Number(value))} />
                            <Bar dataKey="count" fill="#f59e0b" name="العدد" />
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
                                <span className="text-xs text-gray-500 mr-2">متوسط: {formatCurrency(nat.avgSalary)}</span>
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
                          عدد الموظفين حسب الفرع
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
                            <Bar dataKey="active" stackId="a" fill="#10b981" name="نشط" />
                            <Bar dataKey="onLeave" stackId="a" fill="#f59e0b" name="إجازة" />
                            <Bar dataKey="terminated" stackId="a" fill="#ef4444" name="منتهي" />
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
                        مقارنة الوظائف عبر الفروع
                      </CardTitle>
                      <CardDescription>متوسط الراتب لكل وظيفة مع الفرق بين الفروع</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto max-h-96">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right w-[120px]">الوظيفة</TableHead>
                              <TableHead className="text-center w-[70px]">العدد</TableHead>
                              <TableHead className="text-center w-[100px]">متوسط الراتب</TableHead>
                              <TableHead className="text-center w-[120px]">أعلى فرع</TableHead>
                              <TableHead className="text-center w-[120px]">أقل فرع</TableHead>
                              <TableHead className="text-center w-[90px]">فجوة الراتب</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comprehensiveComparisons.jobAcrossBranches.map((job, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium text-right">{job.jobTitle}</TableCell>
                                <TableCell className="text-center">{formatNumber(job.totalCount)}</TableCell>
                                <TableCell className="text-center font-bold text-amber-600">{formatCurrency(job.overallAvgSalary)}</TableCell>
                                <TableCell className="text-center text-green-600">{job.highestPayingBranch}</TableCell>
                                <TableCell className="text-center text-red-600">{job.lowestPayingBranch}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={job.salaryGap > 1000 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}>
                                    {formatCurrency(job.salaryGap)}
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
                        توزيع الرواتب
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={comprehensiveComparisons.salaryRanges}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#8b5cf6" name="عدد الموظفين" />
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
                          توزيع الموظفين حسب مدة الخدمة
                        </CardTitle>
                        <CardDescription>متوسط مدة الخدمة: {comprehensiveComparisons.summary.avgTenure} سنة</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={comprehensiveComparisons.tenureRanges}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="range" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#10b981" name="عدد الموظفين" />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          {comprehensiveComparisons.tenureRanges.map((range, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm font-medium">{range.range}</span>
                              <Badge variant="secondary">{formatNumber(range.count)} موظف</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-tenure-by-branch">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="w-5 h-5" />
                          متوسط مدة الخدمة حسب الفرع
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {comprehensiveComparisons.tenureByBranch.map((branch, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div>
                                <span className="font-medium">{branch.branchName}</span>
                                <span className="text-xs text-gray-500 mr-2">({branch.count} موظف)</span>
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
                                  {branch.avgTenure} سنة
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
                        تحليل الفجوة الراتبية بين الجنسيات لنفس الوظيفة
                      </CardTitle>
                      <CardDescription>الوظائف التي بها فرق في الراتب بين الجنسيات المختلفة</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {comprehensiveComparisons.salaryGapByJob.length > 0 ? (
                        <div className="overflow-x-auto max-h-96">
                          <Table className="table-fixed w-full">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right w-[100px]">الوظيفة</TableHead>
                                <TableHead className="text-center w-[250px]">الجنسيات والرواتب</TableHead>
                                <TableHead className="text-center w-[90px]">أعلى جنسية</TableHead>
                                <TableHead className="text-center w-[90px]">أقل جنسية</TableHead>
                                <TableHead className="text-center w-[90px]">فجوة الراتب</TableHead>
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
                                          {nat.nationality}: {formatCurrency(nat.avgSalary)} ({nat.count})
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
                                      {formatCurrency(job.maxGap)}
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
                          لا توجد فجوات راتبية ملحوظة بين الجنسيات
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* تحليل البدلات حسب الفرع */}
                  <Card data-testid="card-allowances-analysis">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-blue-500" />
                        تحليل البدلات حسب الفرع
                      </CardTitle>
                      <CardDescription>مقارنة بدل السكن والنقل والطعام بين الفروع</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={comprehensiveComparisons.allowancesAnalysis}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="branchName" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="housingAllowance" stackId="a" fill="#3b82f6" name="بدل السكن" />
                          <Bar dataKey="transportAllowance" stackId="a" fill="#10b981" name="بدل النقل" />
                          <Bar dataKey="foodAllowance" stackId="a" fill="#f59e0b" name="بدل الطعام" />
                          <Bar dataKey="otherAllowances" stackId="a" fill="#8b5cf6" name="بدلات أخرى" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 overflow-x-auto">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right w-[120px]">الفرع</TableHead>
                              <TableHead className="text-center w-[80px]">الموظفين</TableHead>
                              <TableHead className="text-center w-[100px]">بدل السكن</TableHead>
                              <TableHead className="text-center w-[100px]">بدل النقل</TableHead>
                              <TableHead className="text-center w-[110px]">إجمالي البدلات</TableHead>
                              <TableHead className="text-center w-[100px]">متوسط/موظف</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comprehensiveComparisons.allowancesAnalysis.map((branch, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium text-right">{branch.branchName}</TableCell>
                                <TableCell className="text-center">{formatNumber(branch.employeeCount)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.housingAllowance)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.transportAllowance)}</TableCell>
                                <TableCell className="text-center font-bold text-blue-600">{formatCurrency(branch.totalAllowances)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.avgAllowancePerEmployee)}</TableCell>
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
                        التكلفة الشهرية الإجمالية لكل فرع
                      </CardTitle>
                      <CardDescription>
                        إجمالي التكاليف: {formatCurrency(comprehensiveComparisons.summary.grandTotalCost || 0)} 
                        (رواتب: {formatCurrency(comprehensiveComparisons.summary.grandTotalSalaries || 0)} + 
                        بدلات: {formatCurrency(comprehensiveComparisons.summary.grandTotalAllowances || 0)} + 
                        تأمينات: {formatCurrency(comprehensiveComparisons.summary.grandTotalInsurance || 0)})
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={comprehensiveComparisons.monthlyCostAnalysis} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`} />
                          <YAxis dataKey="branchName" type="category" width={100} />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="totalSalaries" stackId="a" fill="#10b981" name="الرواتب" />
                          <Bar dataKey="totalAllowances" stackId="a" fill="#3b82f6" name="البدلات" />
                          <Bar dataKey="socialInsurance" stackId="a" fill="#f59e0b" name="التأمينات" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 overflow-x-auto">
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-right w-[120px]">الفرع</TableHead>
                              <TableHead className="text-center w-[80px]">الموظفين</TableHead>
                              <TableHead className="text-center w-[100px]">الرواتب</TableHead>
                              <TableHead className="text-center w-[90px]">البدلات</TableHead>
                              <TableHead className="text-center w-[90px]">التأمينات</TableHead>
                              <TableHead className="text-center w-[110px]">إجمالي التكلفة</TableHead>
                              <TableHead className="text-center w-[100px]">تكلفة/موظف</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {comprehensiveComparisons.monthlyCostAnalysis.map((branch, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium text-right">{branch.branchName}</TableCell>
                                <TableCell className="text-center">{formatNumber(branch.employeeCount)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.totalSalaries)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.totalAllowances)}</TableCell>
                                <TableCell className="text-center">{formatCurrency(branch.socialInsurance)}</TableCell>
                                <TableCell className="text-center font-bold text-green-600">{formatCurrency(branch.totalCost)}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className="bg-purple-100 text-purple-800">
                                    {formatCurrency(branch.costPerEmployee)}
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
                        ترتيب الفروع حسب تكلفة الموظف
                      </CardTitle>
                      <CardDescription>الفروع مرتبة من الأقل تكلفة إلى الأعلى (الأقل = الأكثر كفاءة)</CardDescription>
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
                                  <span className="text-sm text-gray-600">{formatCurrency(branch.costPerEmployee)} / موظف</span>
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
                <div className="text-center py-10 text-gray-500">لا توجد بيانات</div>
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
