import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { useReactToPrint } from "react-to-print";
import * as XLSX from "xlsx";
import {
  ChevronLeft,
  FileText,
  Printer,
  Calendar,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Camera,
  User,
  Filter,
  Loader2,
  AlertCircle,
  Download,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  FileSpreadsheet,
  PieChart,
  Activity,
  Award,
  AlertTriangle,
  Table,
  Eye,
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface BranchShift {
  id: number;
  branchId: string;
  shiftType: string;
  shiftDate: string;
  status: string;
  supervisorName?: string;
  employeeCount?: number;
  openingTime?: string;
  closingTime?: string;
  openingCompleted: boolean;
  closingCompleted: boolean;
  openingCompletedAt?: string;
  closingCompletedAt?: string;
  createdAt: string;
}

interface ChecklistItem {
  id: number;
  title: string;
  titleEn?: string;
  templateId: number;
  requiresPhoto: boolean;
  requiresNote: boolean;
  displayOrder: number;
}

interface ChecklistTemplate {
  id: number;
  name: string;
  type: string;
  items: ChecklistItem[];
}

interface ChecklistResponse {
  id: number;
  shiftId: number;
  itemId: number;
  checklistType: string;
  isCompleted: boolean;
  status: string;
  notes?: string;
  photoUrl?: string;
  completedAt?: string;
}

interface ShiftSignature {
  id: number;
  shiftId: number;
  signatureType: string;
  signerName: string;
  signerRole: string;
  signatureData: string;
  signedAt: string;
}

const shiftTypes = [
  { value: "morning", label: "صباحي", color: "bg-amber-500" },
  { value: "evening", label: "مسائي", color: "bg-blue-500" },
  { value: "night", label: "ليلي", color: "bg-purple-500" },
];

export default function ShiftReportsPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [selectedShiftType, setSelectedShiftType] = useState<string>("all");
  const [selectedShift, setSelectedShift] = useState<BranchShift | null>(null);
  const [reportType, setReportType] = useState<"opening" | "closing">("opening");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"daily" | "analytics">("daily");
  const printRef = useRef<HTMLDivElement>(null);
  const analyticsPrintRef = useRef<HTMLDivElement>(null);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: shifts = [], isLoading: shiftsLoading, isError: shiftsError } = useQuery<BranchShift[]>({
    queryKey: ["/api/branch-shifts/all", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/branch-shifts/dashboard/today?date=${selectedDate}`);
      if (!res.ok) throw new Error("Failed to fetch shifts");
      const data = await res.json();
      return data.shifts || [];
    },
  });

  const { data: rangeShifts = [] } = useQuery<BranchShift[]>({
    queryKey: ["/api/branch-shifts/range", dateRange.from, dateRange.to],
    queryFn: async () => {
      const allShifts: BranchShift[] = [];
      const startDate = new Date(dateRange.from);
      const endDate = new Date(dateRange.to);
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        try {
          const res = await fetch(`/api/branch-shifts/dashboard/today?date=${dateStr}`);
          if (res.ok) {
            const data = await res.json();
            if (data.shifts) {
              allShifts.push(...data.shifts);
            }
          }
        } catch (e) {
          console.error("Error fetching shifts for date:", dateStr);
        }
      }
      return allShifts;
    },
    enabled: activeView === "analytics",
  });

  const { data: checklistTemplates = [], isLoading: itemsLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: ["/api/branch-shifts/all-items"],
  });

  const { data: shiftResponses = [], isLoading: responsesLoading } = useQuery<ChecklistResponse[]>({
    queryKey: ["/api/branch-shifts/responses", selectedShift?.id],
    queryFn: async () => {
      if (!selectedShift) return [];
      const res = await fetch(`/api/branch-shifts/${selectedShift.id}/responses`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedShift,
  });

  const { data: shiftSignatures = [] } = useQuery<ShiftSignature[]>({
    queryKey: ["/api/branch-shifts/signatures", selectedShift?.id],
    queryFn: async () => {
      if (!selectedShift) return [];
      const res = await fetch(`/api/branch-shifts/${selectedShift.id}/signatures`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedShift,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `تقرير_${reportType === "opening" ? "الفتح" : "الإغلاق"}_${selectedShift?.branchId}_${selectedShift?.shiftDate}`,
  });

  const handlePrintAnalytics = useReactToPrint({
    contentRef: analyticsPrintRef,
    documentTitle: `تقرير_تحليلي_${dateRange.from}_${dateRange.to}`,
  });

  const analytics = useMemo(() => {
    const shiftsToAnalyze = activeView === "analytics" ? rangeShifts : shifts;
    const filtered = shiftsToAnalyze.filter((shift) => {
      if (selectedBranch !== "all" && shift.branchId !== selectedBranch) return false;
      if (selectedShiftType !== "all" && shift.shiftType !== selectedShiftType) return false;
      return true;
    });

    const totalShifts = filtered.length;
    const openingCompleted = filtered.filter(s => s.openingCompleted).length;
    const closingCompleted = filtered.filter(s => s.closingCompleted).length;
    const fullyCompleted = filtered.filter(s => s.openingCompleted && s.closingCompleted).length;
    const totalEmployees = filtered.reduce((sum, s) => sum + (s.employeeCount || 0), 0);
    const openingOnly = filtered.filter(s => s.openingCompleted && !s.closingCompleted).length;
    const notStarted = filtered.filter(s => !s.openingCompleted && !s.closingCompleted).length;

    const byBranch: Record<string, { total: number; opening: number; closing: number; full: number; employees: number }> = {};
    const byShiftType: Record<string, { total: number; opening: number; closing: number }> = {};
    const byDate: Record<string, { total: number; opening: number; closing: number }> = {};

    filtered.forEach(shift => {
      if (!byBranch[shift.branchId]) {
        byBranch[shift.branchId] = { total: 0, opening: 0, closing: 0, full: 0, employees: 0 };
      }
      byBranch[shift.branchId].total++;
      byBranch[shift.branchId].employees += (shift.employeeCount || 0);
      if (shift.openingCompleted) byBranch[shift.branchId].opening++;
      if (shift.closingCompleted) byBranch[shift.branchId].closing++;
      if (shift.openingCompleted && shift.closingCompleted) byBranch[shift.branchId].full++;

      if (!byShiftType[shift.shiftType]) {
        byShiftType[shift.shiftType] = { total: 0, opening: 0, closing: 0 };
      }
      byShiftType[shift.shiftType].total++;
      if (shift.openingCompleted) byShiftType[shift.shiftType].opening++;
      if (shift.closingCompleted) byShiftType[shift.shiftType].closing++;

      const date = shift.shiftDate;
      if (!byDate[date]) {
        byDate[date] = { total: 0, opening: 0, closing: 0 };
      }
      byDate[date].total++;
      if (shift.openingCompleted) byDate[date].opening++;
      if (shift.closingCompleted) byDate[date].closing++;
    });

    const openingRate = totalShifts > 0 ? Math.round((openingCompleted / totalShifts) * 100) : 0;
    const closingRate = totalShifts > 0 ? Math.round((closingCompleted / totalShifts) * 100) : 0;
    const fullCompletionRate = totalShifts > 0 ? Math.round((fullyCompleted / totalShifts) * 100) : 0;

    const branchEntries = Object.entries(byBranch);
    const bestBranch = branchEntries.sort((a, b) => {
      const rateA = a[1].total > 0 ? (a[1].full / a[1].total) : 0;
      const rateB = b[1].total > 0 ? (b[1].full / b[1].total) : 0;
      return rateB - rateA;
    })[0];

    const worstBranch = [...branchEntries].sort((a, b) => {
      const rateA = a[1].total > 0 ? (a[1].full / a[1].total) : 0;
      const rateB = b[1].total > 0 ? (b[1].full / b[1].total) : 0;
      return rateA - rateB;
    })[0];

    return {
      totalShifts,
      openingCompleted,
      closingCompleted,
      fullyCompleted,
      totalEmployees,
      openingOnly,
      notStarted,
      openingRate,
      closingRate,
      fullCompletionRate,
      byBranch,
      byShiftType,
      byDate,
      bestBranch,
      worstBranch,
    };
  }, [shifts, rangeShifts, selectedBranch, selectedShiftType, activeView]);

  const filteredShifts = shifts.filter((shift) => {
    if (selectedBranch !== "all" && shift.branchId !== selectedBranch) return false;
    if (selectedShiftType !== "all" && shift.shiftType !== selectedShiftType) return false;
    return true;
  });

  const getBranchName = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name || branchId;
  };

  const getShiftTypeName = (type: string) => {
    return shiftTypes.find((t) => t.value === type)?.label || type;
  };

  const getShiftTypeColor = (type: string) => {
    return shiftTypes.find((t) => t.value === type)?.color || "bg-gray-500";
  };

  const openReport = (shift: BranchShift, type: "opening" | "closing") => {
    setSelectedShift(shift);
    setReportType(type);
  };

  const filteredTemplates = checklistTemplates.filter((t) => t.type === reportType);
  
  const allItems = filteredTemplates.flatMap((t) => t.items);

  const getResponseForItem = (itemId: number) => {
    return shiftResponses.find((r) => r.itemId === itemId && r.checklistType === reportType);
  };

  const completedCount = allItems.filter((item) => {
    const response = getResponseForItem(item.id);
    return response?.isCompleted;
  }).length;

  const completionPercentage = allItems.length > 0 ? Math.round((completedCount / allItems.length) * 100) : 0;

  const exportToExcel = () => {
    const shiftsToExport = (activeView === "analytics" ? rangeShifts : shifts).filter((shift) => {
      if (selectedBranch !== "all" && shift.branchId !== selectedBranch) return false;
      if (selectedShiftType !== "all" && shift.shiftType !== selectedShiftType) return false;
      return true;
    });
    const wb = XLSX.utils.book_new();

    const summaryData = shiftsToExport.map(shift => {
      const statusText = shift.openingCompleted && shift.closingCompleted
        ? "مكتمل بالكامل"
        : shift.openingCompleted
          ? "فتح فقط"
          : "لم يبدأ";
      return {
        "الفرع": getBranchName(shift.branchId),
        "التاريخ": shift.shiftDate,
        "نوع الشفت": getShiftTypeName(shift.shiftType),
        "المشرف": shift.supervisorName || "-",
        "عدد الموظفين": shift.employeeCount || 0,
        "الحالة": statusText,
        "حالة الفتح": shift.openingCompleted ? "مكتمل" : "غير مكتمل",
        "حالة الإغلاق": shift.closingCompleted ? "مكتمل" : "غير مكتمل",
        "وقت إكمال الفتح": shift.openingCompletedAt ? new Date(shift.openingCompletedAt).toLocaleString("en-GB") : "-",
        "وقت إكمال الإغلاق": shift.closingCompletedAt ? new Date(shift.closingCompletedAt).toLocaleString("en-GB") : "-",
      };
    });
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    ws1["!cols"] = [
      { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 12 },
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "بيانات الشفتات");

    const kpiData = [
      { "المؤشر": "إجمالي الشفتات", "العدد": analytics.totalShifts, "النسبة": "" },
      { "المؤشر": "مكتمل بالكامل (فتح + إغلاق)", "العدد": analytics.fullyCompleted, "النسبة": `${analytics.fullCompletionRate}%` },
      { "المؤشر": "الفتح المكتمل", "العدد": analytics.openingCompleted, "النسبة": `${analytics.openingRate}%` },
      { "المؤشر": "الإغلاق المكتمل", "العدد": analytics.closingCompleted, "النسبة": `${analytics.closingRate}%` },
      { "المؤشر": "فتح فقط (بدون إغلاق)", "العدد": analytics.openingOnly, "النسبة": "" },
      { "المؤشر": "لم يبدأ", "العدد": analytics.notStarted, "النسبة": "" },
      { "المؤشر": "إجمالي الموظفين", "العدد": analytics.totalEmployees, "النسبة": "" },
    ];
    const ws2 = XLSX.utils.json_to_sheet(kpiData);
    ws2["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, "مؤشرات الأداء");

    const branchData = Object.entries(analytics.byBranch).map(([branchId, stats]) => ({
      "الفرع": getBranchName(branchId),
      "إجمالي الشفتات": stats.total,
      "الفتح المكتمل": stats.opening,
      "الإغلاق المكتمل": stats.closing,
      "مكتمل بالكامل": stats.full,
      "نسبة الإكمال": stats.total > 0 ? `${Math.round((stats.full / stats.total) * 100)}%` : "0%",
      "عدد الموظفين": stats.employees,
    }));
    const ws3 = XLSX.utils.json_to_sheet(branchData);
    ws3["!cols"] = [
      { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws3, "أداء الفروع");

    const shiftTypeData = shiftTypes.map(type => {
      const stats = analytics.byShiftType[type.value] || { total: 0, opening: 0, closing: 0 };
      return {
        "نوع الشفت": type.label,
        "إجمالي": stats.total,
        "الفتح المكتمل": stats.opening,
        "نسبة الفتح": stats.total > 0 ? `${Math.round((stats.opening / stats.total) * 100)}%` : "0%",
        "الإغلاق المكتمل": stats.closing,
        "نسبة الإغلاق": stats.total > 0 ? `${Math.round((stats.closing / stats.total) * 100)}%` : "0%",
      };
    });
    const ws4 = XLSX.utils.json_to_sheet(shiftTypeData);
    ws4["!cols"] = [
      { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws4, "أنواع الشفتات");

    const dateKeys = Object.keys(analytics.byDate).sort();
    if (dateKeys.length > 0) {
      const dailyData = dateKeys.map(date => {
        const stats = analytics.byDate[date];
        return {
          "التاريخ": date,
          "إجمالي الشفتات": stats.total,
          "الفتح المكتمل": stats.opening,
          "الإغلاق المكتمل": stats.closing,
          "نسبة الفتح": stats.total > 0 ? `${Math.round((stats.opening / stats.total) * 100)}%` : "0%",
          "نسبة الإغلاق": stats.total > 0 ? `${Math.round((stats.closing / stats.total) * 100)}%` : "0%",
        };
      });
      const ws5 = XLSX.utils.json_to_sheet(dailyData);
      ws5["!cols"] = [
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws5, "التفصيل اليومي");
    }

    const dateLabel = activeView === "analytics"
      ? `${dateRange.from}_${dateRange.to}`
      : selectedDate;
    XLSX.writeFile(wb, `تقارير_الفتح_والإغلاق_${dateLabel}.xlsx`);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <Card className="bg-gradient-to-l from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <Link href="/branch-shifts">
                  <Button variant="outline" size="icon" className="bg-white hover:bg-amber-100 h-10 w-10 sm:h-9 sm:w-9" data-testid="btn-back">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </Link>
                <div className="p-2 sm:p-3 bg-amber-600 rounded-xl">
                  <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-amber-900" data-testid="text-page-title">تقارير الفتح والإغلاق</h1>
                  <p className="text-xs sm:text-sm text-amber-700">عرض وطباعة وتحليل تقارير شفتات الفروع</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  className="gap-2 bg-white h-10 sm:h-9 text-xs sm:text-sm"
                  onClick={exportToExcel}
                  data-testid="btn-export-excel"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="hidden sm:inline">تصدير</span> Excel
                </Button>
                <Badge variant="outline" className="bg-white text-amber-800 border-amber-300 px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-xs">
                  {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as "daily" | "analytics")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 h-12">
            <TabsTrigger value="daily" className="gap-2 text-sm">
              <Table className="h-4 w-4" />
              سجل الشفتات اليومي
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              التحليلات والإحصائيات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4">
            <Card className="border-2 border-amber-100">
              <CardContent className="p-3 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600">التاريخ</Label>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="border-2 focus:border-amber-400 h-9"
                      data-testid="input-report-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600">الفرع</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className="border-2 focus:border-amber-400 h-9" data-testid="select-report-branch">
                        <SelectValue placeholder="جميع الفروع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفروع</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600">نوع الشفت</Label>
                    <Select value={selectedShiftType} onValueChange={setSelectedShiftType}>
                      <SelectTrigger className="border-2 focus:border-amber-400 h-9" data-testid="select-report-shift-type">
                        <SelectValue placeholder="جميع الشفتات" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الشفتات</SelectItem>
                        {shiftTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-3 flex-wrap">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 px-3 py-1.5" data-testid="badge-total-shifts">
                <Activity className="h-3.5 w-3.5 ml-1.5" />
                {analytics.totalShifts} شفت
              </Badge>
              <Badge className="bg-green-100 text-green-800 border-green-200 px-3 py-1.5" data-testid="badge-completed">
                <CheckCircle2 className="h-3.5 w-3.5 ml-1.5" />
                {analytics.fullyCompleted} مكتمل
              </Badge>
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 px-3 py-1.5" data-testid="badge-opening-only">
                <TrendingUp className="h-3.5 w-3.5 ml-1.5" />
                {analytics.openingOnly} فتح فقط
              </Badge>
              <Badge className="bg-red-100 text-red-800 border-red-200 px-3 py-1.5" data-testid="badge-not-started">
                <XCircle className="h-3.5 w-3.5 ml-1.5" />
                {analytics.notStarted} لم يبدأ
              </Badge>
              {analytics.totalShifts > 0 && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 px-3 py-1.5">
                  <Target className="h-3.5 w-3.5 ml-1.5" />
                  {analytics.fullCompletionRate}% نسبة الإكمال
                </Badge>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                {shiftsLoading ? (
                  <div className="py-12 text-center">
                    <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-amber-600" />
                    <p className="text-muted-foreground">جاري تحميل الشفتات...</p>
                  </div>
                ) : shiftsError ? (
                  <div className="py-12 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                    <p className="text-red-500">حدث خطأ في تحميل الشفتات</p>
                  </div>
                ) : filteredShifts.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">لا توجد شفتات في التاريخ المحدد</p>
                    <p className="text-sm mt-2">جرب تغيير التاريخ أو الفلاتر الأخرى</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="p-3 text-right font-semibold text-gray-700">الفرع</th>
                          <th className="p-3 text-center font-semibold text-gray-700">الشفت</th>
                          <th className="p-3 text-center font-semibold text-gray-700">المشرف</th>
                          <th className="p-3 text-center font-semibold text-gray-700">الموظفين</th>
                          <th className="p-3 text-center font-semibold text-gray-700">الحالة</th>
                          <th className="p-3 text-center font-semibold text-gray-700">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredShifts.map((shift) => (
                          <tr key={shift.id} className="border-b hover:bg-amber-50/50 transition-colors" data-testid={`row-shift-${shift.id}`}>
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Building2 className={`h-4 w-4 ${
                                  shift.openingCompleted && shift.closingCompleted
                                    ? "text-green-600"
                                    : shift.openingCompleted
                                      ? "text-amber-600"
                                      : "text-gray-400"
                                }`} />
                                <span className="font-medium text-gray-800">{getBranchName(shift.branchId)}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <Badge className={`text-white text-[10px] ${getShiftTypeColor(shift.shiftType)}`}>
                                {getShiftTypeName(shift.shiftType)}
                              </Badge>
                            </td>
                            <td className="p-3 text-center text-gray-600">
                              {shift.supervisorName || "-"}
                            </td>
                            <td className="p-3 text-center">
                              {shift.employeeCount && shift.employeeCount > 0 ? (
                                <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs">{shift.employeeCount}</span>
                              ) : "-"}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Badge 
                                  variant={shift.openingCompleted ? "default" : "outline"} 
                                  className={`text-[10px] px-1.5 py-0.5 ${shift.openingCompleted ? "bg-green-600" : "text-gray-400"}`}
                                >
                                  {shift.openingCompleted ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                </Badge>
                                <Badge 
                                  variant={shift.closingCompleted ? "default" : "outline"}
                                  className={`text-[10px] px-1.5 py-0.5 ${shift.closingCompleted ? "bg-green-600" : "text-gray-400"}`}
                                >
                                  {shift.closingCompleted ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                </Badge>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openReport(shift, "opening")}
                                  disabled={!shift.openingCompleted}
                                  className={`h-7 px-2 text-[10px] ${shift.openingCompleted ? "text-amber-700 hover:bg-amber-100" : "text-gray-300"}`}
                                  data-testid={`btn-view-opening-${shift.id}`}
                                >
                                  <Eye className="h-3 w-3 ml-0.5" />
                                  فتح
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openReport(shift, "closing")}
                                  disabled={!shift.closingCompleted}
                                  className={`h-7 px-2 text-[10px] ${shift.closingCompleted ? "text-blue-700 hover:bg-blue-100" : "text-gray-300"}`}
                                  data-testid={`btn-view-closing-${shift.id}`}
                                >
                                  <Eye className="h-3 w-3 ml-0.5" />
                                  إغلاق
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card className="border-2 border-blue-100">
              <CardContent className="p-3 sm:p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600">من تاريخ</Label>
                    <Input
                      type="date"
                      value={dateRange.from}
                      onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                      className="border-2 focus:border-blue-400 h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600">إلى تاريخ</Label>
                    <Input
                      type="date"
                      value={dateRange.to}
                      onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                      className="border-2 focus:border-blue-400 h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600">الفرع</Label>
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className="border-2 focus:border-blue-400 h-9">
                        <SelectValue placeholder="جميع الفروع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفروع</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600">نوع الشفت</Label>
                    <Select value={selectedShiftType} onValueChange={setSelectedShiftType}>
                      <SelectTrigger className="border-2 focus:border-blue-400 h-9">
                        <SelectValue placeholder="جميع الشفتات" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الشفتات</SelectItem>
                        {shiftTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div ref={analyticsPrintRef} className="space-y-6 print:p-8" dir="rtl">
              <div className="hidden print:block text-center mb-8">
                <h1 className="text-2xl font-bold mb-2">شركة الزبد الأفضل التجارية - BUTTER BAKERY</h1>
                <h2 className="text-xl">تقرير تحليلي للشفتات</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  من {dateRange.from} إلى {dateRange.to}
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-blue-600 font-medium">إجمالي الشفتات</p>
                        <p className="text-2xl sm:text-3xl font-bold text-blue-800">{analytics.totalShifts}</p>
                      </div>
                      <div className="p-2 bg-blue-500 rounded-xl">
                        <Activity className="h-5 w-5 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-green-600 font-medium">نسبة الإكمال الكامل</p>
                        <p className="text-2xl sm:text-3xl font-bold text-green-800">{analytics.fullCompletionRate}%</p>
                      </div>
                      <div className="p-2 bg-green-500 rounded-xl">
                        <Target className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <Progress value={analytics.fullCompletionRate} className="mt-2 h-2" />
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-amber-600 font-medium">الفتح المكتمل</p>
                        <p className="text-2xl sm:text-3xl font-bold text-amber-800">{analytics.openingCompleted}</p>
                        <p className="text-[10px] text-amber-600 mt-0.5">{analytics.openingRate}%</p>
                      </div>
                      <div className="p-2 bg-amber-500 rounded-xl">
                        <TrendingUp className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <Progress value={analytics.openingRate} className="mt-2 h-2" />
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-purple-600 font-medium">الإغلاق المكتمل</p>
                        <p className="text-2xl sm:text-3xl font-bold text-purple-800">{analytics.closingCompleted}</p>
                        <p className="text-[10px] text-purple-600 mt-0.5">{analytics.closingRate}%</p>
                      </div>
                      <div className="p-2 bg-purple-500 rounded-xl">
                        <TrendingDown className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <Progress value={analytics.closingRate} className="mt-2 h-2" />
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Card className="bg-gradient-to-br from-gray-50 to-white border">
                  <CardContent className="p-4 text-center">
                    <Users className="h-6 w-6 text-gray-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-gray-800">{analytics.totalEmployees}</p>
                    <p className="text-xs text-gray-500">إجمالي الموظفين</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-gray-50 to-white border">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-6 w-6 text-amber-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-amber-800">{analytics.openingOnly}</p>
                    <p className="text-xs text-gray-500">فتح فقط (بدون إغلاق)</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-gray-50 to-white border">
                  <CardContent className="p-4 text-center">
                    <XCircle className="h-6 w-6 text-red-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-red-800">{analytics.notStarted}</p>
                    <p className="text-xs text-gray-500">لم يبدأ</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {analytics.bestBranch && (
                  <Card className="border-2 border-green-200">
                    <CardHeader className="pb-2 bg-gradient-to-l from-green-50 to-white">
                      <CardTitle className="flex items-center gap-2 text-green-700 text-base">
                        <Award className="h-5 w-5" />
                        أفضل فرع في الالتزام
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xl font-bold text-green-800">{getBranchName(analytics.bestBranch[0])}</p>
                          <p className="text-sm text-green-600">
                            {analytics.bestBranch[1].full} من {analytics.bestBranch[1].total} شفت مكتمل
                          </p>
                        </div>
                        <div className="text-3xl font-bold text-green-600">
                          {analytics.bestBranch[1].total > 0 
                            ? Math.round((analytics.bestBranch[1].full / analytics.bestBranch[1].total) * 100) 
                            : 0}%
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {analytics.worstBranch && analytics.worstBranch[0] !== analytics.bestBranch?.[0] && (
                  <Card className="border-2 border-red-200">
                    <CardHeader className="pb-2 bg-gradient-to-l from-red-50 to-white">
                      <CardTitle className="flex items-center gap-2 text-red-700 text-base">
                        <AlertTriangle className="h-5 w-5" />
                        يحتاج متابعة
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xl font-bold text-red-800">{getBranchName(analytics.worstBranch[0])}</p>
                          <p className="text-sm text-red-600">
                            {analytics.worstBranch[1].full} من {analytics.worstBranch[1].total} شفت مكتمل
                          </p>
                        </div>
                        <div className="text-3xl font-bold text-red-600">
                          {analytics.worstBranch[1].total > 0 
                            ? Math.round((analytics.worstBranch[1].full / analytics.worstBranch[1].total) * 100) 
                            : 0}%
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card>
                <CardHeader className="pb-3 bg-gradient-to-l from-gray-50 to-white border-b">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <PieChart className="h-5 w-5 text-blue-600" />
                    أداء الفروع
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {Object.entries(analytics.byBranch).map(([branchId, stats]) => {
                      const completionRate = stats.total > 0 ? Math.round((stats.full / stats.total) * 100) : 0;
                      return (
                        <div key={branchId} className="p-3 rounded-lg border bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-amber-600" />
                              <span className="font-semibold text-sm">{getBranchName(branchId)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs flex-wrap justify-end">
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                {stats.total} شفت
                              </span>
                              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                فتح: {stats.opening}
                              </span>
                              <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                إغلاق: {stats.closing}
                              </span>
                              <span className={`px-2 py-0.5 rounded font-bold ${
                                completionRate >= 80 ? "bg-green-100 text-green-700" :
                                completionRate >= 50 ? "bg-amber-100 text-amber-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {completionRate}%
                              </span>
                            </div>
                          </div>
                          <Progress 
                            value={completionRate} 
                            className={`h-2.5 ${
                              completionRate >= 80 ? "[&>div]:bg-green-500" :
                              completionRate >= 50 ? "[&>div]:bg-amber-500" :
                              "[&>div]:bg-red-500"
                            }`}
                          />
                        </div>
                      );
                    })}
                    {Object.keys(analytics.byBranch).length === 0 && (
                      <div className="py-8 text-center text-muted-foreground">
                        <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p>لا توجد بيانات في النطاق المحدد</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3 bg-gradient-to-l from-gray-50 to-white border-b">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-5 w-5 text-purple-600" />
                    أداء أنواع الشفتات
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {shiftTypes.map(type => {
                      const stats = analytics.byShiftType[type.value] || { total: 0, opening: 0, closing: 0 };
                      const openingRate = stats.total > 0 ? Math.round((stats.opening / stats.total) * 100) : 0;
                      const closingRate = stats.total > 0 ? Math.round((stats.closing / stats.total) * 100) : 0;
                      return (
                        <div key={type.value} className={`p-4 rounded-lg border-2 ${
                          type.value === "morning" ? "border-amber-200 bg-amber-50" :
                          type.value === "evening" ? "border-blue-200 bg-blue-50" :
                          "border-purple-200 bg-purple-50"
                        }`}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`w-3 h-3 rounded-full ${type.color}`}></span>
                            <span className="font-bold text-sm">{type.label}</span>
                            <Badge variant="secondary" className="mr-auto text-xs">{stats.total}</Badge>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span>الفتح</span>
                              <span className="font-semibold">{openingRate}%</span>
                            </div>
                            <Progress value={openingRate} className="h-2" />
                            <div className="flex justify-between text-xs">
                              <span>الإغلاق</span>
                              <span className="font-semibold">{closingRate}%</span>
                            </div>
                            <Progress value={closingRate} className="h-2" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {Object.keys(analytics.byDate).length > 1 && (
                <Card>
                  <CardHeader className="pb-3 bg-gradient-to-l from-gray-50 to-white border-b">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      التفصيل اليومي
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="p-3 text-right font-semibold text-gray-700">التاريخ</th>
                            <th className="p-3 text-center font-semibold text-gray-700">الشفتات</th>
                            <th className="p-3 text-center font-semibold text-gray-700">الفتح</th>
                            <th className="p-3 text-center font-semibold text-gray-700">الإغلاق</th>
                            <th className="p-3 text-center font-semibold text-gray-700">نسبة الفتح</th>
                            <th className="p-3 text-center font-semibold text-gray-700">نسبة الإغلاق</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(analytics.byDate)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([date, stats]) => (
                              <tr key={date} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium">{date}</td>
                                <td className="p-3 text-center">{stats.total}</td>
                                <td className="p-3 text-center">{stats.opening}</td>
                                <td className="p-3 text-center">{stats.closing}</td>
                                <td className="p-3 text-center">
                                  <Badge className={`text-[10px] ${
                                    stats.total > 0 && (stats.opening / stats.total) >= 0.8
                                      ? "bg-green-100 text-green-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}>
                                    {stats.total > 0 ? Math.round((stats.opening / stats.total) * 100) : 0}%
                                  </Badge>
                                </td>
                                <td className="p-3 text-center">
                                  <Badge className={`text-[10px] ${
                                    stats.total > 0 && (stats.closing / stats.total) >= 0.8
                                      ? "bg-green-100 text-green-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}>
                                    {stats.total > 0 ? Math.round((stats.closing / stats.total) * 100) : 0}%
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-center gap-4 print:hidden">
                <Button onClick={() => handlePrintAnalytics()} className="gap-2 bg-amber-600 hover:bg-amber-700" size="lg">
                  <Printer className="h-5 w-5" />
                  طباعة التقرير التحليلي
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>
                  تقرير {reportType === "opening" ? "الفتح" : "الإغلاق"} - {getBranchName(selectedShift?.branchId || "")}
                </span>
                <Button onClick={() => handlePrint()} className="gap-2" data-testid="btn-print-report">
                  <Printer className="h-4 w-4" />
                  طباعة
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div ref={printRef} className="p-4 print:p-8" dir="rtl">
              <div className="text-center mb-6 print:mb-8">
                <h1 className="text-2xl font-bold mb-2">شركة الزبد الأفضل التجارية</h1>
                <h2 className="text-xl font-semibold text-amber-600">BUTTER BAKERY</h2>
                <h3 className="text-lg mt-4">
                  تقرير {reportType === "opening" ? "فتح" : "إغلاق"} الفرع
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg print:bg-white print:border">
                <div>
                  <span className="text-muted-foreground">الفرع:</span>
                  <span className="font-semibold mr-2">{getBranchName(selectedShift?.branchId || "")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">التاريخ:</span>
                  <span className="font-semibold mr-2">{selectedShift?.shiftDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">نوع الشفت:</span>
                  <span className="font-semibold mr-2">{getShiftTypeName(selectedShift?.shiftType || "")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">المشرف:</span>
                  <span className="font-semibold mr-2">{selectedShift?.supervisorName || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">عدد الموظفين:</span>
                  <span className="font-semibold mr-2">{selectedShift?.employeeCount || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">وقت الإكمال:</span>
                  <span className="font-semibold mr-2">
                    {reportType === "opening"
                      ? selectedShift?.openingCompletedAt
                        ? new Date(selectedShift.openingCompletedAt).toLocaleString("en-GB")
                        : "-"
                      : selectedShift?.closingCompletedAt
                        ? new Date(selectedShift.closingCompletedAt).toLocaleString("en-GB")
                        : "-"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">نسبة الإكمال:</span>
                  <span className="font-semibold mr-2">{completionPercentage}%</span>
                  <Progress value={completionPercentage} className="mt-2 h-2" />
                </div>
              </div>

              <Separator className="my-6" />

              {responsesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                  <span className="mr-2">جاري تحميل البيانات...</span>
                </div>
              ) : filteredTemplates.map((template) => (
                <div key={template.id} className="mb-6">
                  <h4 className="font-semibold text-lg mb-3 text-amber-700">{template.name}</h4>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 print:bg-gray-200">
                        <th className="border p-2 text-right w-8">#</th>
                        <th className="border p-2 text-right">البند</th>
                        <th className="border p-2 text-center w-20">الحالة</th>
                        <th className="border p-2 text-center w-20">صورة</th>
                        <th className="border p-2 text-right">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {template.items.map((item, idx) => {
                        const response = getResponseForItem(item.id);
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="border p-2 text-center">{idx + 1}</td>
                            <td className="border p-2">{item.title}</td>
                            <td className="border p-2 text-center">
                              {response?.isCompleted ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                              )}
                            </td>
                            <td className="border p-2 text-center">
                              {response?.photoUrl ? (
                                <img
                                  src={response.photoUrl}
                                  alt="صورة البند"
                                  className="h-16 w-16 object-cover rounded mx-auto cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-amber-400 transition-all"
                                  onClick={() => setPreviewImage(response.photoUrl || null)}
                                />
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="border p-2 text-sm">{response?.notes || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}

              {shiftSignatures.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <h4 className="font-semibold text-lg mb-4">التوقيعات</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {shiftSignatures
                      .filter((sig) => sig.signatureType === reportType)
                      .map((sig) => (
                        <div key={sig.id} className="border rounded-lg p-4">
                          <div className="text-sm text-muted-foreground mb-2">
                            {sig.signerRole} - {sig.signerName}
                          </div>
                          <img
                            src={sig.signatureData}
                            alt="توقيع"
                            className="max-h-20 mx-auto"
                          />
                          <div className="text-xs text-center text-muted-foreground mt-2">
                            {new Date(sig.signedAt).toLocaleString("en-GB")}
                          </div>
                        </div>
                      ))}
                  </div>
                </>
              )}

              <div className="mt-8 pt-4 border-t text-center text-sm text-muted-foreground print:mt-12">
                <p>BUTTER BAKERY SYSTEM - CEO COMMAND</p>
                <p>{new Date().toLocaleString("en-GB")}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-2">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-amber-600" />
                  معاينة الصورة
                </span>
                {previewImage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = previewImage;
                      link.download = `صورة_${new Date().getTime()}.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    <Download className="h-4 w-4" />
                    تحميل الصورة
                  </Button>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4 bg-gray-100 rounded-lg">
              {previewImage && (
                <img
                  src={previewImage}
                  alt="معاينة الصورة"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
