import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useBranches } from "@/hooks/useBranches";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Target, Plus, Calendar, TrendingUp, Building2, Settings, Play, Edit, Trash2, Copy, Lock, Unlock, FileSpreadsheet, FileText, CheckCircle, RefreshCw, Zap, PenLine, Save, X, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import * as XLSX from "xlsx";
import { downloadArabicPdf } from "@/lib/pdfmake-arabic";
import type { Branch, BranchMonthlyTarget, TargetWeightProfile, TargetDailyAllocation, SeasonHoliday } from "@shared/schema";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TablePagination } from "@/components/ui/pagination";
import { Moon, Sun, Heart, Flag, Coffee, PartyPopper, Star, Flower } from "lucide-react";
import { ExportButtons } from "@/components/export-buttons";

const TARGET_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  active: "نشط",
  locked: "مُقفل",
  archived: "مؤرشف",
};

const TARGET_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500",
  active: "bg-green-500",
  locked: "bg-blue-500",
  archived: "bg-gray-400",
};

const MONTHS = [
  { value: "01", label: "يناير" },
  { value: "02", label: "فبراير" },
  { value: "03", label: "مارس" },
  { value: "04", label: "أبريل" },
  { value: "05", label: "مايو" },
  { value: "06", label: "يونيو" },
  { value: "07", label: "يوليو" },
  { value: "08", label: "أغسطس" },
  { value: "09", label: "سبتمبر" },
  { value: "10", label: "أكتوبر" },
  { value: "11", label: "نوفمبر" },
  { value: "12", label: "ديسمبر" },
];

const YEARS = Array.from({ length: 10 }, (_, i) => {
  const year = new Date().getFullYear() - 2 + i;
  return { value: year.toString(), label: year.toString() };
});

const exportColumns = [
  { header: "الفرع", key: "branchName", width: 20 },
  { header: "الهدف الشهري", key: "targetAmount", width: 15 },
  { header: "الشهر", key: "yearMonth", width: 12 },
  { header: "الحالة", key: "status", width: 12 },
  { header: "ملاحظات", key: "notes", width: 30 },
];

export default function TargetsPlanning() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonthNum, setSelectedMonthNum] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const selectedMonth = `${selectedYear}-${selectedMonthNum}`;
  const [showNewTargetDialog, setShowNewTargetDialog] = useState(false);
  const [showBulkCreateDialog, setShowBulkCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [editingTarget, setEditingTarget] = useState<BranchMonthlyTarget | null>(null);
  const [filterBranch, setFilterBranch] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [editingAllocation, setEditingAllocation] = useState<number | null>(null);
  const [allocationEditValue, setAllocationEditValue] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("targets");
  
  const [newTarget, setNewTarget] = useState({
    branchId: "",
    yearMonth: selectedMonth,
    targetAmount: "",
    profileId: null as number | null,
    notes: ""
  });

  const [bulkTargets, setBulkTargets] = useState<{
    selectedBranches: string[];
    targetAmount: string;
    profileId: number | null;
    useCustomAmounts: boolean;
    customAmounts: Record<string, string>;
  }>({
    selectedBranches: [],
    targetAmount: "",
    profileId: null,
    useCustomAmounts: false,
    customAmounts: {}
  });

  const [copyFromMonth, setCopyFromMonth] = useState(() => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { branches, canSelectBranch, userBranchId } = useBranches();

  useEffect(() => {
    if (userBranchId) {
      setFilterBranch(userBranchId);
      setNewTarget(prev => ({ ...prev, branchId: userBranchId }));
    } else if (canSelectBranch) {
      setFilterBranch("all");
    }
  }, [userBranchId, canSelectBranch]);

  const { data: targets = [], isLoading: targetsLoading } = useQuery<BranchMonthlyTarget[]>({
    queryKey: ["/api/targets/monthly", { yearMonth: selectedMonth }],
    queryFn: async () => {
      const res = await fetch(`/api/targets/monthly?yearMonth=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to fetch targets");
      return res.json();
    }
  });

  const { data: previousMonthTargets = [] } = useQuery<BranchMonthlyTarget[]>({
    queryKey: ["/api/targets/monthly", { yearMonth: copyFromMonth }],
    queryFn: async () => {
      const res = await fetch(`/api/targets/monthly?yearMonth=${copyFromMonth}`);
      if (!res.ok) throw new Error("Failed to fetch previous targets");
      return res.json();
    },
    enabled: showCopyDialog
  });

  const { data: profiles = [] } = useQuery<TargetWeightProfile[]>({
    queryKey: ["/api/targets/profiles"],
  });

  const { data: allocations = [] } = useQuery<TargetDailyAllocation[]>({
    queryKey: ["/api/targets/monthly", selectedTargetId, "allocations"],
    queryFn: async () => {
      if (!selectedTargetId) return [];
      const res = await fetch(`/api/targets/monthly/${selectedTargetId}/allocations`);
      if (!res.ok) throw new Error("Failed to fetch allocations");
      return res.json();
    },
    enabled: !!selectedTargetId
  });

  // Fetch holidays for selected month
  const { data: holidays = [] } = useQuery<SeasonHoliday[]>({
    queryKey: ["/api/seasons-holidays/by-month", { yearMonth: selectedMonth }],
    queryFn: async () => {
      const res = await fetch(`/api/seasons-holidays/by-month?yearMonth=${selectedMonth}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Helper to get holidays for a specific date
  const getHolidaysForDate = (dateStr: string): SeasonHoliday[] => {
    return holidays.filter(h => {
      const date = new Date(dateStr);
      const start = new Date(h.startDate);
      const end = new Date(h.endDate);
      return date >= start && date <= end;
    });
  };

  // Holiday type colors
  const HOLIDAY_TYPE_COLORS: Record<string, string> = {
    islamic: "#0ea5e9",
    national: "#16a34a", 
    international: "#8b5cf6",
    season: "#f97316",
    custom: "#f59e0b",
  };

  // Holiday type icons
  const getHolidayIcon = (type: string, category?: string | null) => {
    if (category === 'eid_fitr' || category === 'eid_adha' || category === 'ramadan') return Moon;
    if (category === 'valentines') return Heart;
    if (category === 'national_day' || category === 'founding_day') return Flag;
    if (category === 'coffee_day') return Coffee;
    if (category === 'new_year') return PartyPopper;
    if (category === 'mothers_day') return Flower;
    if (type === 'season') return Sun;
    return Star;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedMonthNum, filterBranch, filterStatus]);

  const createTargetMutation = useMutation({
    mutationFn: async (data: typeof newTarget) => {
      const res = await fetch("/api/targets/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          targetAmount: parseFloat(data.targetAmount),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create target");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets/monthly"] });
      setShowNewTargetDialog(false);
      setNewTarget({ branchId: "", yearMonth: selectedMonth, targetAmount: "", profileId: null, notes: "" });
      toast({ title: "تم إنشاء الهدف بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  });

  const updateTargetMutation = useMutation({
    mutationFn: async (data: { id: number; targetAmount: number; profileId: number | null; notes: string; status?: string }) => {
      const res = await fetch(`/api/targets/monthly/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update target");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets/monthly"] });
      setShowEditDialog(false);
      setEditingTarget(null);
      toast({ title: "تم تحديث الهدف بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  });

  const generateAllocationsMutation = useMutation({
    mutationFn: async (targetId: number) => {
      const res = await fetch(`/api/targets/monthly/${targetId}/generate-allocations`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate allocations");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets/monthly"] });
      toast({ title: "تم توزيع الهدف على أيام الشهر بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في توزيع الهدف", variant: "destructive" });
    }
  });

  const updateAllocationMutation = useMutation({
    mutationFn: async (data: { id: number; dailyTarget: number }) => {
      const res = await fetch(`/api/targets/allocations/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyTarget: data.dailyTarget, isManualOverride: true }),
      });
      if (!res.ok) throw new Error("Failed to update allocation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets/monthly", selectedTargetId, "allocations"] });
      setEditingAllocation(null);
      toast({ title: "تم تحديث الهدف اليومي" });
    }
  });

  const deleteTargetMutation = useMutation({
    mutationFn: async (targetId: number) => {
      const res = await fetch(`/api/targets/monthly/${targetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete target");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets/monthly"] });
      toast({ title: "تم حذف الهدف بنجاح" });
    }
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const branchId of bulkTargets.selectedBranches) {
        const amount = bulkTargets.useCustomAmounts 
          ? parseFloat(bulkTargets.customAmounts[branchId] || "0")
          : parseFloat(bulkTargets.targetAmount);
        
        if (amount > 0) {
          const res = await fetch("/api/targets/monthly", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              branchId,
              yearMonth: selectedMonth,
              targetAmount: amount,
              profileId: bulkTargets.profileId,
            }),
          });
          if (res.ok) results.push(await res.json());
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets/monthly"] });
      setShowBulkCreateDialog(false);
      setBulkTargets({ selectedBranches: [], targetAmount: "", profileId: null, useCustomAmounts: false, customAmounts: {} });
      toast({ title: `تم إنشاء ${results.length} هدف بنجاح` });
    }
  });

  const copyFromPreviousMonthMutation = useMutation({
    mutationFn: async (adjustmentPercent: number) => {
      const results = [];
      for (const prevTarget of previousMonthTargets) {
        const newAmount = prevTarget.targetAmount * (1 + adjustmentPercent / 100);
        const res = await fetch("/api/targets/monthly", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branchId: prevTarget.branchId,
            yearMonth: selectedMonth,
            targetAmount: Math.round(newAmount),
            profileId: prevTarget.profileId,
            notes: `منسوخ من ${copyFromMonth} مع تعديل ${adjustmentPercent}%`,
          }),
        });
        if (res.ok) results.push(await res.json());
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets/monthly"] });
      setShowCopyDialog(false);
      toast({ title: `تم نسخ ${results.length} هدف من الشهر السابق` });
    }
  });

  const getBranchName = (branchId: string) => {
    return branches.find(b => b.id === branchId)?.name || branchId;
  };

  const getProfileName = (profileId: number | null) => {
    if (!profileId) return "الافتراضي";
    return profiles.find(p => p.id === profileId)?.name || "غير محدد";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SA', { 
      style: 'currency', 
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[date.getDay()];
  };

  const filteredTargets = targets.filter(t => {
    if (filterBranch !== "all" && t.branchId !== filterBranch) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  const exportData = filteredTargets.map(t => ({
    ...t,
    branchName: getBranchName(t.branchId),
  }));

  const totalTarget = filteredTargets.reduce((sum, t) => sum + t.targetAmount, 0);
  const branchesWithTargets = new Set(targets.map(t => t.branchId));
  const branchesWithoutTargets = branches.filter(b => !branchesWithTargets.has(b.id));

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    if (targets?.length) {
      const data = targets.map(t => ({
        'الفرع': branches.find(b => b.id === t.branchId)?.name || t.branchId,
        'الشهر': t.yearMonth,
        'الهدف الشهري': t.targetAmount,
        'الحالة': TARGET_STATUS_LABELS[t.status] || t.status,
        'ملاحظات': t.notes || ''
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'الأهداف الشهرية');
    }
    
    if (allocations?.length) {
      const allocData = allocations.map(a => ({
        'التاريخ': a.targetDate,
        'اليوم': getDayName(a.targetDate),
        'الهدف اليومي': a.dailyTarget,
        'الوزن': `${a.weightPercent}%`,
        'سبب التخصيص': a.overrideReason || ''
      }));
      const ws2 = XLSX.utils.json_to_sheet(allocData);
      XLSX.utils.book_append_sheet(wb, ws2, 'التوزيع اليومي');
    }
    
    if (profiles?.length) {
      const profileData = profiles.map(p => ({
        'الملف': p.name,
        'أحد': `${p.sundayWeight}%`,
        'اثنين': `${p.mondayWeight}%`,
        'ثلاثاء': `${p.tuesdayWeight}%`,
        'أربعاء': `${p.wednesdayWeight}%`,
        'خميس': `${p.thursdayWeight}%`,
        'جمعة': `${p.fridayWeight}%`,
        'سبت': `${p.saturdayWeight}%`,
        'افتراضي': p.isDefault ? 'نعم' : 'لا',
        'نشط': p.isActive ? 'نعم' : 'لا'
      }));
      const ws3 = XLSX.utils.json_to_sheet(profileData);
      XLSX.utils.book_append_sheet(wb, ws3, 'ملفات التوزيع');
    }
    
    XLSX.writeFile(wb, `الأهداف_الشهرية_${selectedMonth}.xlsx`);
  };

  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تخطيط الأهداف - ${selectedMonth}</title>
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 20px; direction: rtl; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f59e0b; color: white; }
            h1, h2 { color: #92400e; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { display: flex; justify-content: space-around; margin: 20px 0; gap: 20px; }
            .card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; text-align: center; }
            @media print { body { print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>تخطيط الأهداف الشهرية</h1>
            <p>الشهر: ${selectedMonth}</p>
          </div>
          <div class="summary">
            <div class="card"><strong>إجمالي الأهداف:</strong><br/>${formatCurrency(totalTarget)}</div>
            <div class="card"><strong>عدد الفروع:</strong><br/>${targets.length}</div>
          </div>
          ${targets?.length ? `
            <h2>الأهداف الشهرية</h2>
            <table>
              <thead><tr><th>الفرع</th><th>الهدف الشهري</th><th>ملف التوزيع</th><th>الحالة</th></tr></thead>
              <tbody>${targets.map(t => `<tr><td>${branches.find(b => b.id === t.branchId)?.name || t.branchId}</td><td>${formatCurrency(t.targetAmount)}</td><td>${getProfileName(t.profileId)}</td><td>${TARGET_STATUS_LABELS[t.status] || t.status}</td></tr>`).join('')}</tbody>
            </table>
          ` : ''}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const handleEditTarget = (target: BranchMonthlyTarget) => {
    setEditingTarget(target);
    setShowEditDialog(true);
  };

  const handleSaveAllocation = (allocId: number) => {
    const value = parseFloat(allocationEditValue);
    if (!isNaN(value) && value >= 0) {
      updateAllocationMutation.mutate({ id: allocId, dailyTarget: value });
    }
  };

  const selectedTargetInfo = targets.find(t => t.id === selectedTargetId);

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/cashier-journals">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-amber-900 flex items-center gap-2 sm:gap-3">
                <Target className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8" />
                تخطيط الأهداف الشهرية
              </h1>
              <p className="text-xs sm:text-sm text-amber-700 mt-1">تحديد وتوزيع الأهداف على الفروع والأيام</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="hidden sm:inline">السنة:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24 h-11 sm:h-10" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => (
                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="hidden sm:inline">الشهر:</Label>
              <Select value={selectedMonthNum} onValueChange={setSelectedMonthNum}>
                <SelectTrigger className="w-28 h-11 sm:h-10" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" onClick={exportToExcel} className="h-11 sm:h-9" data-testid="button-export-excel">
              <FileSpreadsheet className="h-4 w-4 sm:ml-2" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            
            <Button variant="outline" onClick={exportToPDF} className="h-11 sm:h-9" data-testid="button-export-pdf">
              <FileText className="h-4 w-4 sm:ml-2" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs sm:text-sm opacity-90">إجمالي الأهداف</div>
              <div className="text-lg sm:text-2xl font-bold font-mono">{formatCurrency(totalTarget)}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs sm:text-sm opacity-90">الفروع المستهدفة</div>
              <div className="text-lg sm:text-2xl font-bold">{targets.length} / {branches.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs sm:text-sm opacity-90">أهداف نشطة</div>
              <div className="text-lg sm:text-2xl font-bold">{targets.filter(t => t.status === 'active').length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <CardContent className="p-3 sm:p-4">
              <div className="text-xs sm:text-sm opacity-90">فروع بدون أهداف</div>
              <div className="text-lg sm:text-2xl font-bold">{branchesWithoutTargets.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <span className="font-medium text-amber-900 text-sm sm:text-base">إجراءات سريعة:</span>
              
              <Dialog open={showNewTargetDialog} onOpenChange={setShowNewTargetDialog}>
                <DialogTrigger asChild>
                  <Button className="h-11 sm:h-9 bg-amber-600 hover:bg-amber-700" data-testid="button-add-target">
                    <Plus className="h-4 w-4 sm:ml-2" />
                    <span className="hidden sm:inline">هدف لفرع واحد</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إضافة هدف شهري جديد</DialogTitle>
                    <DialogDescription>حدد الفرع والهدف المالي للشهر</DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>الفرع</Label>
                      <Select
                        value={newTarget.branchId || userBranchId || ""}
                        onValueChange={(v) => setNewTarget({ ...newTarget, branchId: v })}
                        disabled={!canSelectBranch}
                      >
                        <SelectTrigger className="h-11 sm:h-10" data-testid="select-branch">
                          <SelectValue placeholder="اختر الفرع" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>السنة والشهر</Label>
                      <div className="flex gap-2">
                        <Select
                          value={newTarget.yearMonth.split('-')[0]}
                          onValueChange={(v) => setNewTarget({ ...newTarget, yearMonth: `${v}-${newTarget.yearMonth.split('-')[1]}` })}
                        >
                          <SelectTrigger className="w-24 h-11 sm:h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {YEARS.map(y => (
                              <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={newTarget.yearMonth.split('-')[1]}
                          onValueChange={(v) => setNewTarget({ ...newTarget, yearMonth: `${newTarget.yearMonth.split('-')[0]}-${v}` })}
                        >
                          <SelectTrigger className="w-28 h-11 sm:h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTHS.map(m => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div>
                      <Label>الهدف الشهري (ريال)</Label>
                      <Input
                        type="number"
                        value={newTarget.targetAmount}
                        onChange={(e) => setNewTarget({ ...newTarget, targetAmount: e.target.value })}
                        placeholder="مثال: 500000"
                        className="h-11 sm:h-10"
                        data-testid="input-target-amount"
                      />
                    </div>
                    
                    <div>
                      <Label>ملف توزيع الأوزان</Label>
                      <Select
                        value={newTarget.profileId?.toString() || "default"}
                        onValueChange={(v) => setNewTarget({ ...newTarget, profileId: v === "default" ? null : parseInt(v) })}
                      >
                        <SelectTrigger className="h-11 sm:h-10" data-testid="select-profile">
                          <SelectValue placeholder="اختر ملف التوزيع" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">الملف الافتراضي</SelectItem>
                          {profiles.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>ملاحظات</Label>
                      <Textarea
                        value={newTarget.notes}
                        onChange={(e) => setNewTarget({ ...newTarget, notes: e.target.value })}
                        placeholder="ملاحظات إضافية..."
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowNewTargetDialog(false)} className="h-11 sm:h-9">إلغاء</Button>
                    <Button 
                      onClick={() => createTargetMutation.mutate(newTarget)}
                      disabled={!newTarget.branchId || !newTarget.targetAmount || createTargetMutation.isPending}
                      className="h-11 sm:h-9"
                      data-testid="button-save-target"
                    >
                      {createTargetMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={showBulkCreateDialog} onOpenChange={setShowBulkCreateDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-11 sm:h-9" data-testid="button-bulk-create">
                    <Zap className="h-4 w-4 sm:ml-2" />
                    <span className="hidden sm:inline">أهداف لعدة فروع</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>إنشاء أهداف لعدة فروع</DialogTitle>
                    <DialogDescription>حدد الفروع وأهدافها دفعة واحدة</DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={bulkTargets.selectedBranches.length === branchesWithoutTargets.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBulkTargets(prev => ({ ...prev, selectedBranches: branchesWithoutTargets.map(b => b.id) }));
                          } else {
                            setBulkTargets(prev => ({ ...prev, selectedBranches: [] }));
                          }
                        }}
                      />
                      <span className="font-medium">تحديد جميع الفروع بدون أهداف ({branchesWithoutTargets.length})</span>
                    </div>
                    
                    <div className="border rounded-lg p-4 space-y-2">
                      {branches.map(branch => {
                        const hasTarget = branchesWithTargets.has(branch.id);
                        const isSelected = bulkTargets.selectedBranches.includes(branch.id);
                        
                        return (
                          <div key={branch.id} className={`flex items-center gap-4 p-2 rounded ${hasTarget ? 'bg-gray-100' : ''}`}>
                            <Checkbox
                              checked={isSelected}
                              disabled={hasTarget}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setBulkTargets(prev => ({ ...prev, selectedBranches: [...prev.selectedBranches, branch.id] }));
                                } else {
                                  setBulkTargets(prev => ({ ...prev, selectedBranches: prev.selectedBranches.filter(id => id !== branch.id) }));
                                }
                              }}
                            />
                            <span className={`flex-1 ${hasTarget ? 'text-gray-400' : ''}`}>
                              {branch.name}
                              {hasTarget && <Badge className="mr-2 bg-green-500">لديه هدف</Badge>}
                            </span>
                            {bulkTargets.useCustomAmounts && isSelected && (
                              <Input
                                type="number"
                                className="w-32 h-11 sm:h-10"
                                placeholder="الهدف"
                                value={bulkTargets.customAmounts[branch.id] || ""}
                                onChange={(e) => setBulkTargets(prev => ({
                                  ...prev,
                                  customAmounts: { ...prev.customAmounts, [branch.id]: e.target.value }
                                }))}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={bulkTargets.useCustomAmounts}
                        onCheckedChange={(checked) => setBulkTargets(prev => ({ ...prev, useCustomAmounts: !!checked }))}
                      />
                      <span>تحديد مبلغ مختلف لكل فرع</span>
                    </div>
                    
                    {!bulkTargets.useCustomAmounts && (
                      <div>
                        <Label>الهدف الموحد لجميع الفروع (ريال)</Label>
                        <Input
                          type="number"
                          value={bulkTargets.targetAmount}
                          onChange={(e) => setBulkTargets(prev => ({ ...prev, targetAmount: e.target.value }))}
                          placeholder="مثال: 500000"
                          className="h-11 sm:h-10"
                        />
                      </div>
                    )}
                    
                    <div>
                      <Label>ملف التوزيع</Label>
                      <Select
                        value={bulkTargets.profileId?.toString() || "default"}
                        onValueChange={(v) => setBulkTargets(prev => ({ ...prev, profileId: v === "default" ? null : parseInt(v) }))}
                      >
                        <SelectTrigger className="h-11 sm:h-10">
                          <SelectValue placeholder="الملف الافتراضي" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">الملف الافتراضي</SelectItem>
                          {profiles.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowBulkCreateDialog(false)} className="h-11 sm:h-9">إلغاء</Button>
                    <Button 
                      onClick={() => bulkCreateMutation.mutate()}
                      disabled={bulkTargets.selectedBranches.length === 0 || bulkCreateMutation.isPending}
                      className="h-11 sm:h-9"
                    >
                      {bulkCreateMutation.isPending ? "جاري الإنشاء..." : `إنشاء ${bulkTargets.selectedBranches.length} هدف`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-11 sm:h-9" data-testid="button-copy-from-month">
                    <Copy className="h-4 w-4 sm:ml-2" />
                    <span className="hidden sm:inline">نسخ من شهر سابق</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md" dir="rtl">
                  <DialogHeader>
                    <DialogTitle>نسخ الأهداف من شهر سابق</DialogTitle>
                    <DialogDescription>نسخ أهداف الشهر السابق مع إمكانية التعديل</DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div>
                      <Label>نسخ من شهر</Label>
                      <div className="flex gap-2">
                        <Select
                          value={copyFromMonth.split('-')[0]}
                          onValueChange={(v) => setCopyFromMonth(`${v}-${copyFromMonth.split('-')[1]}`)}
                        >
                          <SelectTrigger className="w-24 h-11 sm:h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {YEARS.map(y => (
                              <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={copyFromMonth.split('-')[1]}
                          onValueChange={(v) => setCopyFromMonth(`${copyFromMonth.split('-')[0]}-${v}`)}
                        >
                          <SelectTrigger className="w-28 h-11 sm:h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTHS.map(m => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {previousMonthTargets.length > 0 ? (
                      <div className="border rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">الأهداف في {copyFromMonth}:</p>
                        {previousMonthTargets.map(t => (
                          <div key={t.id} className="flex justify-between py-1">
                            <span>{getBranchName(t.branchId)}</span>
                            <span className="font-mono">{formatCurrency(t.targetAmount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">لا توجد أهداف في هذا الشهر</p>
                    )}
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Button variant="outline" onClick={() => copyFromPreviousMonthMutation.mutate(0)} className="h-11 sm:h-9">نسخ كما هي</Button>
                      <Button variant="outline" onClick={() => copyFromPreviousMonthMutation.mutate(5)} className="h-11 sm:h-9">+5%</Button>
                      <Button variant="outline" onClick={() => copyFromPreviousMonthMutation.mutate(10)} className="h-11 sm:h-9">+10%</Button>
                      <Button variant="outline" onClick={() => copyFromPreviousMonthMutation.mutate(15)} className="h-11 sm:h-9">+15%</Button>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCopyDialog(false)} className="h-11 sm:h-9">إلغاء</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Link href="/targets-dashboard">
                <Button variant="outline" className="h-11 sm:h-9">
                  <TrendingUp className="h-4 w-4 sm:ml-2" />
                  <span className="hidden sm:inline">لوحة الأداء</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="targets" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              الأهداف الشهرية
            </TabsTrigger>
            <TabsTrigger value="allocations" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              التوزيع اليومي
            </TabsTrigger>
            <TabsTrigger value="profiles" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              ملفات الأوزان
            </TabsTrigger>
          </TabsList>

          <TabsContent value="targets">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-amber-600" />
                    أهداف الفروع لشهر {selectedMonth}
                    <Badge variant="secondary" className="mr-2">
                      {filteredTargets.length} هدف
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <Select value={filterBranch} onValueChange={setFilterBranch}>
                      <SelectTrigger className="w-36 sm:w-40 h-11 sm:h-10">
                        <SelectValue placeholder="تصفية بالفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفروع</SelectItem>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-28 sm:w-32 h-11 sm:h-10">
                        <SelectValue placeholder="الحالة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="draft">مسودة</SelectItem>
                        <SelectItem value="active">نشط</SelectItem>
                        <SelectItem value="locked">مُقفل</SelectItem>
                      </SelectContent>
                    </Select>
                    <ExportButtons
                      data={exportData}
                      columns={exportColumns}
                      fileName={`الأهداف-${selectedMonth}`}
                      title="تقرير الأهداف الشهرية"
                      subtitle={`الشهر: ${selectedMonthNum}/${selectedYear}`}
                      sheetName="الأهداف"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {targetsLoading ? (
                  <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                ) : filteredTargets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    لا توجد أهداف مسجلة لهذا الشهر
                  </div>
                ) : (
                  <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead>الهدف الشهري</TableHead>
                        <TableHead>ملف التوزيع</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>ملاحظات</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTargets.slice((currentPage - 1) * 10, currentPage * 10).map((target) => (
                        <TableRow key={target.id} data-testid={`row-target-${target.id}`}>
                          <TableCell className="font-medium">{getBranchName(target.branchId)}</TableCell>
                          <TableCell className="font-mono text-lg font-bold text-amber-700">{formatCurrency(target.targetAmount)}</TableCell>
                          <TableCell>{getProfileName(target.profileId)}</TableCell>
                          <TableCell>
                            <Badge className={TARGET_STATUS_COLORS[target.status]}>
                              {TARGET_STATUS_LABELS[target.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-gray-500">{target.notes || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-amber-50 hover:bg-amber-100 border-amber-300"
                                onClick={() => generateAllocationsMutation.mutate(target.id)}
                                disabled={generateAllocationsMutation.isPending}
                                title="توزيع / إعادة توزيع على الأيام"
                                data-testid={`button-generate-${target.id}`}
                              >
                                <Play className="h-4 w-4 text-amber-600" />
                                <span className="mr-1 text-xs">{target.status === 'draft' ? 'توزيع' : 'إعادة التوزيع'}</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-blue-50 hover:bg-blue-100 border-blue-300"
                                onClick={() => {
                                  setSelectedTargetId(target.id);
                                  setActiveTab("allocations");
                                }}
                                title="عرض التوزيع اليومي"
                                data-testid={`button-view-${target.id}`}
                              >
                                <Calendar className="h-4 w-4 text-blue-600" />
                                <span className="mr-1 text-xs">عرض</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-gray-50 hover:bg-gray-100 border-gray-300"
                                onClick={() => handleEditTarget(target)}
                                title="تعديل الهدف"
                                data-testid={`button-edit-${target.id}`}
                              >
                                <Edit className="h-4 w-4 text-gray-600" />
                                <span className="mr-1 text-xs">تعديل</span>
                              </Button>
                              {target.status === 'draft' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-green-50 hover:bg-green-100 border-green-300"
                                    onClick={() => updateTargetMutation.mutate({ id: target.id, targetAmount: target.targetAmount, profileId: target.profileId, notes: target.notes || '', status: 'active' })}
                                    title="تفعيل الهدف"
                                  >
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <span className="mr-1 text-xs">تفعيل</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-red-50 hover:bg-red-100 border-red-300"
                                    onClick={() => deleteTargetMutation.mutate(target.id)}
                                    title="حذف الهدف"
                                    data-testid={`button-delete-${target.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                    <span className="mr-1 text-xs">حذف</span>
                                  </Button>
                                </>
                              )}
                              {target.status === 'active' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-indigo-50 hover:bg-indigo-100 border-indigo-300"
                                  onClick={() => updateTargetMutation.mutate({ id: target.id, targetAmount: target.targetAmount, profileId: target.profileId, notes: target.notes || '', status: 'locked' })}
                                  title="قفل الهدف"
                                >
                                  <Lock className="h-4 w-4 text-indigo-600" />
                                  <span className="mr-1 text-xs">قفل</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    currentPage={currentPage}
                    totalItems={filteredTargets.length}
                    itemsPerPage={10}
                    onPageChange={setCurrentPage}
                  />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allocations">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-amber-600" />
                      التوزيع اليومي للهدف
                    </CardTitle>
                    <CardDescription>
                      {selectedTargetInfo ? (
                        <span className="text-lg">
                          {getBranchName(selectedTargetInfo.branchId)} - {formatCurrency(selectedTargetInfo.targetAmount)}
                        </span>
                      ) : (
                        <>اختر هدفًا من القائمة لعرض التوزيع اليومي</>
                      )}
                    </CardDescription>
                  </div>
                  {selectedTargetId && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select 
                        value={selectedTargetId.toString()} 
                        onValueChange={(v) => setSelectedTargetId(parseInt(v))}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="اختر هدف" />
                        </SelectTrigger>
                        <SelectContent>
                          {targets.map(t => (
                            <SelectItem key={t.id} value={t.id.toString()}>
                              {getBranchName(t.branchId)} - {formatCurrency(t.targetAmount)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {allocations.length > 0 && (
                        <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const selectedTarget = targets.find(t => t.id === selectedTargetId);
                            const branchName = selectedTarget ? getBranchName(selectedTarget.branchId) : 'Unknown';
                            const data = allocations.map(alloc => {
                              const date = new Date(alloc.targetDate);
                              const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                              const isWeekend = date.getDay() === 4 || date.getDay() === 5 || date.getDay() === 6;
                              const isEndOfMonth = date.getDate() >= 27;
                              return {
                                'التاريخ': new Date(alloc.targetDate).toLocaleDateString('en-GB'),
                                'اليوم': dayNames[date.getDay()],
                                'الهدف اليومي': alloc.dailyTarget,
                                'النسبة %': alloc.weightPercent.toFixed(2),
                                'ويكند': isWeekend ? 'نعم' : 'لا',
                                'نهاية الشهر': isEndOfMonth ? 'نعم' : 'لا',
                                'عيد/مناسبة': alloc.isHoliday ? 'نعم' : 'لا',
                                'تعديل يدوي': alloc.isManualOverride ? 'نعم' : 'لا',
                              };
                            });
                            const ws = XLSX.utils.json_to_sheet(data);
                            const wb = XLSX.utils.book_new();
                            XLSX.utils.book_append_sheet(wb, ws, 'التوزيع اليومي');
                            XLSX.writeFile(wb, `توزيع_${branchName}_${selectedTarget?.yearMonth || 'monthly'}.xlsx`);
                          }}
                          className="min-h-[44px]"
                          data-testid="btn-export-allocations"
                        >
                          <FileSpreadsheet className="h-4 w-4 ml-2" />
                          Excel
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const selectedTarget = targets.find(t => t.id === selectedTargetId);
                            const branchName = selectedTarget ? getBranchName(selectedTarget.branchId) : 'غير معروف';
                            const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                            
                            const totalTarget = allocations.reduce((sum, a) => sum + a.dailyTarget, 0);
                            const weekendDays = allocations.filter(a => {
                              const d = new Date(a.targetDate);
                              return d.getDay() === 4 || d.getDay() === 5 || d.getDay() === 6;
                            });
                            const endOfMonthDays = allocations.filter(a => new Date(a.targetDate).getDate() >= 27);
                            
                            const printWindow = window.open('', '_blank');
                            if (!printWindow) {
                              toast({ title: "خطأ", description: "يرجى السماح بفتح النوافذ المنبثقة", variant: "destructive" });
                              return;
                            }
                            
                            const logoUrl = '/attached_assets/logo_-5_1765206843638.png';
                            
                            const tableRows = allocations.map(alloc => {
                              const date = new Date(alloc.targetDate);
                              const isWeekend = date.getDay() === 4 || date.getDay() === 5 || date.getDay() === 6;
                              const isEndOfMonth = date.getDate() >= 27;
                              const rowClass = isWeekend && isEndOfMonth ? 'weekend eom' : isWeekend ? 'weekend' : isEndOfMonth ? 'eom' : '';
                              return '<tr class="' + rowClass + '"><td>' + new Date(alloc.targetDate).toLocaleDateString('en-GB') + '</td><td>' + dayNames[date.getDay()] + '</td><td>' + alloc.dailyTarget.toLocaleString('en-US') + ' ر.س</td><td>' + alloc.weightPercent.toFixed(2) + '%</td><td>' + (isWeekend ? '✓' : '-') + '</td><td>' + (isEndOfMonth ? '✓' : '-') + '</td></tr>';
                            }).join('');
                            
                            const htmlContent = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>تقرير التوزيع اليومي للأهداف - ' + branchName + '</title><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet"><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: Cairo, sans-serif; direction: rtl; padding: 20px; background: white; color: #333; font-size: 11px; } .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #d4a853; padding-bottom: 15px; } .header .logo { max-height: 60px; margin-bottom: 10px; } .header h1 { font-size: 20px; color: #333; margin-bottom: 5px; } .header .subtitle { color: #666; font-size: 14px; } .summary { display: flex; justify-content: space-around; background: linear-gradient(135deg, #fef3c7, #ffedd5); padding: 15px; border-radius: 8px; margin-bottom: 20px; } .summary-item { text-align: center; } .summary-item .label { color: #666; font-size: 11px; } .summary-item .value { font-size: 16px; font-weight: bold; color: #92400e; } table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; } th, td { border: 1px solid #ddd; padding: 6px 4px; text-align: center; } th { background: #d4a853; color: white; font-weight: 600; } tr:nth-child(even) { background: #fafafa; } .weekend { background: #fef3c7 !important; } .eom { background: #ffedd5 !important; } .weekend.eom { background: linear-gradient(135deg, #fef3c7, #ffedd5) !important; } .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; color: #888; font-size: 9px; } .print-btn { position: fixed; top: 20px; left: 20px; background: #d4a853; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-family: Cairo, sans-serif; font-size: 14px; font-weight: bold; } .print-btn:hover { background: #c49843; } @media print { body { padding: 10px; } .no-print { display: none; } }</style></head><body><button class="print-btn no-print" onclick="window.print()">طباعة / حفظ PDF</button><div class="header"><img src="' + logoUrl + '" alt="Butter Bakery" class="logo" onerror="this.style.display=\'none\'" /><h1>تقرير التوزيع اليومي للأهداف</h1><div class="subtitle">' + branchName + ' - ' + (selectedTarget?.yearMonth || '') + '</div></div><div class="summary"><div class="summary-item"><div class="label">إجمالي الهدف</div><div class="value">' + totalTarget.toLocaleString('en-US') + ' ر.س</div></div><div class="summary-item"><div class="label">أيام الويكند</div><div class="value">' + weekendDays.length + ' يوم</div></div><div class="summary-item"><div class="label">نهاية الشهر</div><div class="value">' + endOfMonthDays.length + ' يوم</div></div><div class="summary-item"><div class="label">عدد الأيام</div><div class="value">' + allocations.length + ' يوم</div></div></div><table><thead><tr><th>التاريخ</th><th>اليوم</th><th>الهدف اليومي</th><th>النسبة</th><th>ويكند</th><th>نهاية الشهر</th></tr></thead><tbody>' + tableRows + '</tbody><tfoot><tr style="background: #f5f5f5; font-weight: bold;"><td colspan="2">الإجمالي</td><td>' + totalTarget.toLocaleString('en-US') + ' ر.س</td><td>100%</td><td colspan="2"></td></tr></tfoot></table><div class="footer"><p>BUTTER BAKERY SYSTEM - CEO COMMAND</p><p>' + new Date().toLocaleString('en-GB') + '</p></div></body></html>';
                            
                            printWindow.document.write(htmlContent);
                            printWindow.document.close();
                          }}
                          className="min-h-[44px]"
                          data-testid="btn-export-allocations-pdf"
                        >
                          <FileText className="h-4 w-4 ml-2" />
                          PDF
                        </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedTargetId ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">اختر هدفًا من قائمة الأهداف الشهرية لعرض التوزيع اليومي</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {targets.map(t => (
                        <Button 
                          key={t.id} 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedTargetId(t.id)}
                        >
                          {getBranchName(t.branchId)}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : allocations.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">لم يتم توزيع الهدف بعد</p>
                    <Button onClick={() => generateAllocationsMutation.mutate(selectedTargetId)}>
                      <Play className="h-4 w-4 ml-2" />
                      توزيع الهدف على أيام الشهر
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-7 gap-2">
                      {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
                        <div key={day} className="text-center font-bold text-gray-600 p-2">{day}</div>
                      ))}
                      
                      {/* Add empty cells before the first day to align with correct weekday */}
                      {allocations.length > 0 && (() => {
                        // Parse date string correctly to avoid timezone issues
                        const dateStr = allocations[0].targetDate;
                        const [year, month, day] = typeof dateStr === 'string' 
                          ? dateStr.split('T')[0].split('-').map(Number)
                          : [new Date(dateStr).getFullYear(), new Date(dateStr).getMonth() + 1, new Date(dateStr).getDate()];
                        const firstDate = new Date(year, month - 1, day);
                        const firstDayOfWeek = firstDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
                        console.log('First date:', dateStr, 'Parsed:', firstDate, 'Day of week:', firstDayOfWeek);
                        return Array.from({ length: firstDayOfWeek }, (_, i) => (
                          <div key={`empty-${i}`} className="p-3"></div>
                        ));
                      })()}
                      
                      {allocations.map((alloc) => {
                        const date = new Date(alloc.targetDate);
                        const dayOfMonth = date.getDate();
                        const isWeekend = date.getDay() === 4 || date.getDay() === 5 || date.getDay() === 6; // Thu, Fri, Sat
                        const isEndOfMonth = dayOfMonth >= 27; // End of month boost days
                        const isEditing = editingAllocation === alloc.id;
                        const dateHolidays = getHolidaysForDate(alloc.targetDate);
                        const hasHoliday = dateHolidays.length > 0;
                        
                        // Check if the day has passed (before today)
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const targetDate = new Date(alloc.targetDate);
                        targetDate.setHours(0, 0, 0, 0);
                        const isPast = targetDate < today;
                        const isToday = targetDate.getTime() === today.getTime();
                        
                        return (
                          <div
                            key={alloc.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md relative ${
                              isPast ? 'bg-gray-100 border-gray-300 opacity-60' :
                              isToday ? 'bg-green-50 border-green-400 ring-2 ring-green-300' :
                              hasHoliday ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-300' :
                              alloc.isHoliday ? 'bg-red-50 border-red-200' :
                              alloc.isManualOverride ? 'bg-blue-50 border-blue-200' :
                              (isWeekend && isEndOfMonth) ? 'bg-gradient-to-br from-amber-100 to-orange-100 border-orange-300' :
                              isEndOfMonth ? 'bg-orange-50 border-orange-200' :
                              isWeekend ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
                            }`}
                            data-testid={`allocation-${alloc.id}`}
                            onClick={() => {
                              if (!isEditing) {
                                setEditingAllocation(alloc.id);
                                setAllocationEditValue(alloc.dailyTarget.toString());
                              }
                            }}
                          >
                            {/* Holiday badges */}
                            {hasHoliday && (
                              <div className="absolute -top-2 -left-2 flex gap-1">
                                <TooltipProvider>
                                  {dateHolidays.slice(0, 2).map((holiday, idx) => {
                                    const IconComponent = getHolidayIcon(holiday.type, holiday.category);
                                    const bgColor = holiday.color || HOLIDAY_TYPE_COLORS[holiday.type] || '#f59e0b';
                                    return (
                                      <Tooltip key={idx}>
                                        <TooltipTrigger asChild>
                                          <div 
                                            className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                                            style={{ backgroundColor: bgColor }}
                                          >
                                            <IconComponent className="h-3 w-3 text-white" />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-right">
                                          <p className="font-bold">{holiday.name}</p>
                                          {holiday.description && <p className="text-xs text-gray-500">{holiday.description}</p>}
                                          {holiday.weightMultiplier > 1 && (
                                            <p className="text-xs text-amber-600">معامل الهدف: {holiday.weightMultiplier}x</p>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })}
                                </TooltipProvider>
                              </div>
                            )}
                            
                            <div className="flex justify-between items-start">
                              <div className="text-sm font-bold text-gray-800">{dayOfMonth}</div>
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); handleSaveAllocation(alloc.id); }}>
                                    <Save className="h-3 w-3 text-green-600" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); setEditingAllocation(null); }}>
                                    <X className="h-3 w-3 text-red-600" />
                                  </Button>
                                </div>
                              ) : (
                                <PenLine className="h-3 w-3 text-gray-400" />
                              )}
                            </div>
                            <div className="text-xs text-gray-500">{new Date(alloc.targetDate).toLocaleDateString('en-GB')}</div>
                            {isEditing ? (
                              <Input
                                type="number"
                                className="mt-1 h-7 text-sm"
                                value={allocationEditValue}
                                onChange={(e) => setAllocationEditValue(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                              />
                            ) : (
                              <div className="text-sm font-mono mt-1 text-amber-700 font-bold">
                                {formatCurrency(alloc.dailyTarget)}
                              </div>
                            )}
                            <div className="text-xs text-gray-400">
                              {alloc.weightPercent.toFixed(1)}%
                            </div>
                            {/* Holiday name badge */}
                            {hasHoliday && (
                              <div className="text-xs mt-1 text-purple-600 font-medium truncate">
                                {dateHolidays[0].name}
                              </div>
                            )}
                            {alloc.isManualOverride && !hasHoliday && (
                              <Badge variant="outline" className="text-xs mt-1">معدل</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Color Legend */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium mb-2">دليل الألوان:</p>
                      <div className="flex flex-wrap gap-2 md:gap-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-4 h-4 rounded bg-amber-50 border border-amber-200"></div>
                          <span>ويكند (خميس/جمعة/سبت)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-4 h-4 rounded bg-orange-50 border border-orange-200"></div>
                          <span>نهاية الشهر (27-31)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-4 h-4 rounded bg-gradient-to-br from-amber-100 to-orange-100 border border-orange-300"></div>
                          <span>ويكند + نهاية شهر</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-4 h-4 rounded bg-green-50 border-2 border-green-400"></div>
                          <span>اليوم الحالي</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300 opacity-60"></div>
                          <span>أيام سابقة</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-4 h-4 rounded bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-300"></div>
                          <span>أعياد/مناسبات</span>
                        </div>
                      </div>
                    </div>

                    {/* Holiday Legend */}
                    {holidays.length > 0 && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium mb-2">دليل المناسبات لهذا الشهر:</p>
                        <div className="flex flex-wrap gap-2">
                          {holidays.map((holiday, idx) => {
                            const IconComponent = getHolidayIcon(holiday.type, holiday.category);
                            const bgColor = holiday.color || HOLIDAY_TYPE_COLORS[holiday.type] || '#f59e0b';
                            return (
                              <div key={idx} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: `${bgColor}20`, border: `1px solid ${bgColor}` }}>
                                <IconComponent className="h-3 w-3" style={{ color: bgColor }} />
                                <span>{holiday.name}</span>
                                <span className="text-gray-400">({new Date(holiday.startDate).toLocaleDateString('en-GB')})</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Statistics Summary */}
                    {(() => {
                      const weekendDays = allocations.filter(a => {
                        const d = new Date(a.targetDate);
                        return d.getDay() === 4 || d.getDay() === 5 || d.getDay() === 6;
                      });
                      const endOfMonthDays = allocations.filter(a => {
                        const d = new Date(a.targetDate);
                        return d.getDate() >= 27;
                      });
                      const weekendTotal = weekendDays.reduce((sum, a) => sum + a.dailyTarget, 0);
                      const endOfMonthTotal = endOfMonthDays.reduce((sum, a) => sum + a.dailyTarget, 0);
                      const totalTarget = allocations.reduce((sum, a) => sum + a.dailyTarget, 0);
                      const maxTarget = Math.max(...allocations.map(a => a.dailyTarget));
                      const minTarget = Math.min(...allocations.map(a => a.dailyTarget));
                      const avgTarget = totalTarget / allocations.length;
                      
                      return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                          <div className="text-center p-2">
                            <div className="text-xs text-gray-500 mb-1">أيام الويكند</div>
                            <div className="font-bold text-amber-700">{weekendDays.length} يوم</div>
                            <div className="text-xs text-gray-600">{formatCurrency(weekendTotal)}</div>
                            <div className="text-xs text-amber-600">({((weekendTotal / totalTarget) * 100).toFixed(1)}%)</div>
                          </div>
                          <div className="text-center p-2">
                            <div className="text-xs text-gray-500 mb-1">نهاية الشهر</div>
                            <div className="font-bold text-orange-700">{endOfMonthDays.length} يوم</div>
                            <div className="text-xs text-gray-600">{formatCurrency(endOfMonthTotal)}</div>
                            <div className="text-xs text-orange-600">({((endOfMonthTotal / totalTarget) * 100).toFixed(1)}%)</div>
                          </div>
                          <div className="text-center p-2">
                            <div className="text-xs text-gray-500 mb-1">أعلى هدف</div>
                            <div className="font-bold text-green-700">{formatCurrency(maxTarget)}</div>
                            <div className="text-xs text-gray-500">متوسط: {formatCurrency(avgTarget)}</div>
                          </div>
                          <div className="text-center p-2">
                            <div className="text-xs text-gray-500 mb-1">أدنى هدف</div>
                            <div className="font-bold text-red-700">{formatCurrency(minTarget)}</div>
                            <div className="text-xs text-gray-500">فرق: {formatCurrency(maxTarget - minTarget)}</div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <span className="font-medium">إجمالي التوزيع اليومي:</span>
                      <span className="font-mono text-lg font-bold text-amber-700">
                        {formatCurrency(allocations.reduce((sum, a) => sum + a.dailyTarget, 0))}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profiles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-amber-600" />
                  ملفات توزيع الأوزان
                </CardTitle>
                <CardDescription>
                  تحديد أوزان الأيام والمواسم لتوزيع الأهداف بشكل ذكي
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profiles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">لا توجد ملفات أوزان</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>اسم الملف</TableHead>
                        <TableHead>أحد</TableHead>
                        <TableHead>اثنين</TableHead>
                        <TableHead>ثلاثاء</TableHead>
                        <TableHead>أربعاء</TableHead>
                        <TableHead>خميس</TableHead>
                        <TableHead>جمعة</TableHead>
                        <TableHead>سبت</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((profile) => (
                        <TableRow key={profile.id} data-testid={`row-profile-${profile.id}`}>
                          <TableCell className="font-medium">
                            {profile.name}
                            {profile.isDefault && <Badge className="mr-2 bg-amber-500">افتراضي</Badge>}
                          </TableCell>
                          <TableCell>{profile.sundayWeight}%</TableCell>
                          <TableCell>{profile.mondayWeight}%</TableCell>
                          <TableCell>{profile.tuesdayWeight}%</TableCell>
                          <TableCell>{profile.wednesdayWeight}%</TableCell>
                          <TableCell className="font-bold text-amber-600">{profile.thursdayWeight}%</TableCell>
                          <TableCell className="font-bold text-amber-600">{profile.fridayWeight}%</TableCell>
                          <TableCell>{profile.saturdayWeight}%</TableCell>
                          <TableCell>
                            <Badge variant={profile.isActive ? "default" : "secondary"}>
                              {profile.isActive ? "نشط" : "غير نشط"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل الهدف الشهري</DialogTitle>
              <DialogDescription>
                {editingTarget && getBranchName(editingTarget.branchId)} - {editingTarget?.yearMonth}
              </DialogDescription>
            </DialogHeader>
            
            {editingTarget && (
              <div className="space-y-4">
                <div>
                  <Label>الهدف الشهري (ريال)</Label>
                  <Input
                    type="number"
                    value={editingTarget.targetAmount}
                    onChange={(e) => setEditingTarget({ ...editingTarget, targetAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                
                <div>
                  <Label>ملف التوزيع</Label>
                  <Select
                    value={editingTarget.profileId?.toString() || "default"}
                    onValueChange={(v) => setEditingTarget({ ...editingTarget, profileId: v === "default" ? null : parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">الملف الافتراضي</SelectItem>
                      {profiles.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={editingTarget.notes || ""}
                    onChange={(e) => setEditingTarget({ ...editingTarget, notes: e.target.value })}
                  />
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>إلغاء</Button>
              <Button 
                onClick={() => editingTarget && updateTargetMutation.mutate({
                  id: editingTarget.id,
                  targetAmount: editingTarget.targetAmount,
                  profileId: editingTarget.profileId,
                  notes: editingTarget.notes || ""
                })}
                disabled={updateTargetMutation.isPending}
              >
                {updateTargetMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
