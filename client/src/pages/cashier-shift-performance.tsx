import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Target, TrendingUp, TrendingDown, Users, Trophy, ChevronLeft, Calendar, 
  Award, AlertTriangle, Bell, Clock, CheckCircle2, Plus, Settings, 
  Sun, Moon, DollarSign, Receipt, User as UserIcon, RefreshCw, BarChart as BarChartIcon,
  Pencil
} from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import type { Branch, CashierShiftTarget, PerformanceAlert, ShiftPerformanceTracking, User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const SHIFT_TYPES = [
  { value: "morning", label: "الشفت الصباحي", icon: Sun, color: "bg-amber-500" },
  { value: "evening", label: "الشفت المسائي", icon: Moon, color: "bg-indigo-500" },
];

const CASHIER_ROLES = [
  { value: "main", label: "كاشير رئيسي" },
  { value: "assistant", label: "كاشير مساعد" },
  { value: "trainee", label: "متدرب" },
];

const ALERT_COLORS = {
  critical: { bg: "bg-red-100", border: "border-red-500", text: "text-red-700", badge: "bg-red-500" },
  warning: { bg: "bg-amber-100", border: "border-amber-500", text: "text-amber-700", badge: "bg-amber-500" },
  on_track: { bg: "bg-blue-100", border: "border-blue-500", text: "text-blue-700", badge: "bg-blue-500" },
  exceeding: { bg: "bg-green-100", border: "border-green-500", text: "text-green-700", badge: "bg-green-500" },
};

interface CashierData {
  id: string;
  name: string;
  role: string;
  target: number;
  achieved: number;
  avgTicket: number;
  transactions: number;
}

export default function CashierShiftPerformance() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedShift, setSelectedShift] = useState<string>("all");
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [editingTarget, setEditingTarget] = useState<CashierShiftTarget | null>(null);
  
  // Report filters
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(today);
  const [reportCashierId, setReportCashierId] = useState<string>("all");
  const [newTarget, setNewTarget] = useState({
    cashierId: "",
    branchId: "",
    shiftType: "morning",
    cashierRole: "main",
    periodType: "weekly" as "daily" | "weekly" | "monthly",
    startDate: today,
    endDate: "",
    totalTargetAmount: 0,
    totalTargetTransactions: 0,
    targetAmount: 0, // Daily distributed
    targetTransactions: 0, // Daily distributed
    targetTicketValue: 0,
  });

  const { user } = useAuth();
  const { branches, userBranchId, canSelectBranch } = useBranches();

  const selectedBranchData = useMemo(() => {
    if (selectedBranch === "all") return null;
    return branches.find(b => b.id === selectedBranch);
  }, [selectedBranch, branches]);

  useEffect(() => {
    if (userBranchId) {
      setSelectedBranch(userBranchId);
    } else if (canSelectBranch) {
      setSelectedBranch("all");
    }
  }, [userBranchId, canSelectBranch]);

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Filter cashiers by selected branch in the dialog
  const branchCashiers = useMemo(() => {
    if (!newTarget.branchId) return [];
    return allUsers.filter(u => u.branchId === newTarget.branchId && u.isActive === 'active');
  }, [allUsers, newTarget.branchId]);

  const { data: shiftTargets = [], isLoading: targetsLoading, refetch: refetchTargets } = useQuery<CashierShiftTarget[]>({
    queryKey: ["/api/cashier-shift-targets", selectedBranch, selectedDate, selectedShift],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      if (selectedShift !== "all") params.append("shiftType", selectedShift);
      const res = await fetch(`/api/cashier-shift-targets?${params}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: performanceAlerts = [], refetch: refetchAlerts } = useQuery<PerformanceAlert[]>({
    queryKey: ["/api/performance-alerts", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      const res = await fetch(`/api/performance-alerts?${params}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: shiftTracking = [], refetch: refetchTracking } = useQuery<ShiftPerformanceTracking[]>({
    queryKey: ["/api/shift-performance-tracking", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      const res = await fetch(`/api/shift-performance-tracking?${params}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Fetch incentive tiers for calculating rewards
  interface IncentiveTier {
    id: number;
    name: string;
    description: string | null;
    minAchievementPercent: number;
    maxAchievementPercent: number | null;
    rewardType: string;
    fixedAmount: number | null;
    percentageRate: number | null;
    isActive: boolean;
    sortOrder: number;
  }

  const { data: incentiveTiers = [] } = useQuery<IncentiveTier[]>({
    queryKey: ["/api/incentive-tiers"],
    queryFn: async () => {
      const res = await fetch("/api/incentive-tiers");
      if (!res.ok) return [];
      const data = await res.json();
      return data.filter((t: IncentiveTier) => t.isActive).sort((a: IncentiveTier, b: IncentiveTier) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }
  });

  // Calculate incentive based on achievement percentage
  const calculateIncentive = (achievementPercent: number, excessSales: number = 0): { tier: IncentiveTier | null; reward: number } => {
    if (!incentiveTiers.length) return { tier: null, reward: 0 };
    
    // Find the matching tier
    const matchingTier = incentiveTiers.find(tier => {
      const minMatch = achievementPercent >= tier.minAchievementPercent;
      const maxMatch = tier.maxAchievementPercent === null || achievementPercent <= tier.maxAchievementPercent;
      return minMatch && maxMatch;
    });
    
    if (!matchingTier) return { tier: null, reward: 0 };
    
    let reward = 0;
    if (matchingTier.rewardType === 'fixed' && matchingTier.fixedAmount) {
      reward = matchingTier.fixedAmount;
    } else if (matchingTier.rewardType === 'percentage' && matchingTier.percentageRate) {
      reward = excessSales * (matchingTier.percentageRate / 100);
    } else if (matchingTier.rewardType === 'both') {
      reward = (matchingTier.fixedAmount || 0) + (excessSales * ((matchingTier.percentageRate || 0) / 100));
    }
    
    return { tier: matchingTier, reward: Math.round(reward * 100) / 100 };
  };

  // Fetch actual cashier sales from journals
  interface CashierSalesData {
    cashierId: string;
    cashierName: string;
    branchId: string;
    shiftType: string;
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
  }

  const { data: cashierSales = [], refetch: refetchSales } = useQuery<CashierSalesData[]>({
    queryKey: ["/api/cashier-performance-sales", selectedBranch, selectedDate, selectedShift],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      if (selectedShift !== "all") params.append("shiftType", selectedShift);
      const res = await fetch(`/api/cashier-performance-sales?${params}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Get actual sales for a specific cashier and shift
  const getCashierActualSales = (cashierId: string, shiftType: string) => {
    const sale = cashierSales.find(s => s.cashierId === cashierId && s.shiftType === shiftType);
    return sale || { totalSales: 0, transactionCount: 0, averageTicket: 0 };
  };

  // Fetch cashier journals for detailed report
  interface CashierJournalReport {
    id: number;
    cashierId: string;
    cashierName: string;
    branchId: string;
    branchName: string;
    date: string;
    shiftType: string;
    totalSales: number;
    cashSales: number;
    cardSales: number;
    transactionCount: number;
    averageTicket: number;
  }

  const { data: cashierJournals = [] } = useQuery<CashierJournalReport[]>({
    queryKey: ["/api/cashier-journals-report", selectedBranch, reportStartDate, reportEndDate, reportCashierId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      params.append("startDate", reportStartDate);
      params.append("endDate", reportEndDate);
      if (reportCashierId !== "all") params.append("cashierId", reportCashierId);
      const res = await fetch(`/api/cashier-journals-report?${params}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Calculate contribution analysis
  const contributionData = useMemo(() => {
    if (!cashierJournals.length) return [];
    
    // Group by cashier
    const cashierTotals = new Map<string, { 
      cashierId: string;
      cashierName: string;
      totalSales: number;
      transactionCount: number;
      daysWorked: number;
      shifts: { morning: number; evening: number };
    }>();
    
    const branchTotal = cashierJournals.reduce((sum, j) => sum + j.totalSales, 0);
    const uniqueDates = new Set(cashierJournals.map(j => j.date));
    
    cashierJournals.forEach(j => {
      const existing = cashierTotals.get(j.cashierId);
      if (existing) {
        existing.totalSales += j.totalSales;
        existing.transactionCount += j.transactionCount;
        if (j.shiftType === 'morning') existing.shifts.morning += j.totalSales;
        else existing.shifts.evening += j.totalSales;
      } else {
        cashierTotals.set(j.cashierId, {
          cashierId: j.cashierId,
          cashierName: j.cashierName,
          totalSales: j.totalSales,
          transactionCount: j.transactionCount,
          daysWorked: 1,
          shifts: {
            morning: j.shiftType === 'morning' ? j.totalSales : 0,
            evening: j.shiftType === 'evening' ? j.totalSales : 0,
          }
        });
      }
    });
    
    return Array.from(cashierTotals.values()).map(c => ({
      ...c,
      branchTotal,
      contributionPercent: branchTotal > 0 ? (c.totalSales / branchTotal) * 100 : 0,
      avgDailySales: c.totalSales / (uniqueDates.size || 1),
    })).sort((a, b) => b.contributionPercent - a.contributionPercent);
  }, [cashierJournals]);

  const createTargetMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/cashier-shift-targets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-shift-targets"] });
      setShowTargetDialog(false);
      resetNewTarget();
      toast.success("تم حفظ الهدف بنجاح");
    },
    onError: (error: any) => {
      console.error("Error creating target:", error);
      toast.error(error?.message || "فشل في حفظ الهدف. تحقق من الصلاحيات أو البيانات.");
    }
  });

  const updateTargetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/cashier-shift-targets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-shift-targets"] });
      setEditingTarget(null);
      resetNewTarget();
      toast.success("تم تحديث الهدف بنجاح");
    },
    onError: (error: any) => {
      console.error("Error updating target:", error);
      toast.error(error?.message || "فشل في تحديث الهدف. تحقق من الصلاحيات.");
    }
  });

  const openEditDialog = (target: CashierShiftTarget) => {
    setEditingTarget(target);
    setNewTarget({
      cashierId: target.cashierId || "",
      branchId: target.branchId || "",
      shiftType: target.shiftType || "morning",
      cashierRole: target.cashierRole || "main",
      periodType: (target as any).periodType || "daily",
      startDate: (target as any).startDate || target.targetDate || today,
      endDate: (target as any).endDate || target.targetDate || today,
      totalTargetAmount: Number((target as any).totalTargetAmount) || Number(target.targetAmount) || 0,
      totalTargetTransactions: Number((target as any).totalTargetTransactions) || Number(target.targetTransactions) || 0,
      targetAmount: Number(target.targetAmount) || 0,
      targetTransactions: Number(target.targetTransactions) || 0,
      targetTicketValue: Number(target.targetTicketValue) || 0,
    });
    setShowTargetDialog(true);
  };

  // Calculate number of days in period
  const calculateDaysInPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(diffDays, 1);
  };

  // Auto-calculate end date based on period type
  const calculateEndDate = (startDate: string, periodType: string) => {
    const start = new Date(startDate);
    let end: Date;
    
    if (periodType === "weekly") {
      end = new Date(start);
      end.setDate(end.getDate() + 6); // 7 days including start
    } else if (periodType === "monthly") {
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1); // End of month
    } else {
      end = start; // daily
    }
    
    return end.toISOString().split('T')[0];
  };

  // Calculate daily targets from total
  const calculateDailyTargets = (totalAmount: number, totalTransactions: number, days: number) => {
    const dailyAmount = Math.round((totalAmount / days) * 100) / 100;
    const dailyTransactions = Math.round(totalTransactions / days);
    const ticketValue = dailyTransactions > 0 ? Math.round((dailyAmount / dailyTransactions) * 100) / 100 : 0;
    return { dailyAmount, dailyTransactions, ticketValue };
  };

  const handleSaveTarget = () => {
    const days = calculateDaysInPeriod(newTarget.startDate, newTarget.endDate);
    const { dailyAmount, dailyTransactions, ticketValue } = calculateDailyTargets(
      newTarget.totalTargetAmount, 
      newTarget.totalTargetTransactions, 
      days
    );

    const targetData = {
      cashierId: newTarget.cashierId,
      branchId: newTarget.branchId,
      shiftType: newTarget.shiftType,
      cashierRole: newTarget.cashierRole,
      periodType: newTarget.periodType,
      startDate: newTarget.startDate,
      endDate: newTarget.endDate,
      totalTargetAmount: newTarget.totalTargetAmount,
      totalTargetTransactions: newTarget.totalTargetTransactions,
      targetAmount: dailyAmount,
      targetTransactions: dailyTransactions,
      targetTicketValue: ticketValue,
      targetDate: newTarget.startDate, // Legacy field
    };

    if (editingTarget) {
      updateTargetMutation.mutate({
        id: editingTarget.id,
        data: targetData
      });
    } else {
      createTargetMutation.mutate(targetData);
    }
  };

  const markAlertReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("PATCH", `/api/performance-alerts/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance-alerts"] });
    }
  });

  const resetNewTarget = () => {
    setNewTarget({
      cashierId: "",
      branchId: "",
      shiftType: "morning",
      cashierRole: "main",
      periodType: "weekly",
      startDate: today,
      endDate: calculateEndDate(today, "weekly"),
      totalTargetAmount: 0,
      totalTargetTransactions: 0,
      targetAmount: 0,
      targetTransactions: 0,
      targetTicketValue: 0,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount) + ' ر.س';
  };

  const getPercentColor = (percent: number) => {
    if (percent >= 100) return "text-green-600";
    if (percent >= 80) return "text-amber-600";
    return "text-red-600";
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-green-500";
    if (percent >= 80) return "bg-amber-500";
    return "bg-red-500";
  };

  const getAlertLevel = (percent: number): keyof typeof ALERT_COLORS => {
    if (percent >= 100) return "exceeding";
    if (percent >= 80) return "on_track";
    if (percent >= 60) return "warning";
    return "critical";
  };

  const getCashierName = (cashierId: string) => {
    const user = allUsers.find(u => u.id === cashierId);
    if (user) {
      return `${user.firstName || user.username || ''} ${user.lastName || ''}`.trim() || cashierId;
    }
    return cashierId;
  };

  const summaryStats = useMemo(() => {
    if (!shiftTargets.length) return { totalTarget: 0, totalAchieved: 0, avgPercent: 0, alertCount: 0 };
    
    const totalTarget = shiftTargets.reduce((sum, t) => sum + (Number(t.targetAmount) || 0), 0);
    // Use actual cashier sales instead of shiftTracking
    const totalAchieved = cashierSales.reduce((sum, s) => sum + (s.totalSales || 0), 0);
    const avgPercent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
    const alertCount = performanceAlerts.filter(a => !a.isRead).length;
    
    return { totalTarget, totalAchieved, avgPercent, alertCount };
  }, [shiftTargets, performanceAlerts, cashierSales]);

  const shiftChartData = useMemo(() => {
    const morningTargets = shiftTargets.filter(t => t.shiftType === 'morning');
    const eveningTargets = shiftTargets.filter(t => t.shiftType === 'evening');
    // Use actual cashier sales
    const morningSales = cashierSales.filter(s => s.shiftType === 'morning');
    const eveningSales = cashierSales.filter(s => s.shiftType === 'evening');
    
    return [
      {
        name: "الشفت الصباحي",
        target: morningTargets.reduce((sum, t) => sum + (Number(t.targetAmount) || 0), 0),
        achieved: morningSales.reduce((sum, s) => sum + (s.totalSales || 0), 0),
      },
      {
        name: "الشفت المسائي",
        target: eveningTargets.reduce((sum, t) => sum + (Number(t.targetAmount) || 0), 0),
        achieved: eveningSales.reduce((sum, s) => sum + (s.totalSales || 0), 0),
      }
    ];
  }, [shiftTargets, cashierSales]);

  const handleRefresh = () => {
    refetchTargets();
    refetchAlerts();
    refetchTracking();
    refetchSales();
  };

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/targets-dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back" className="h-11 w-11 sm:h-8 sm:w-8">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#8B4513]" data-testid="text-page-title">
                تتبع أداء الكاشير بالشفتات
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">مراقبة الأهداف والأداء لكل كاشير حسب الشفت</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh" className="h-11 sm:h-9 text-sm">
              <RefreshCw className="h-4 w-4 ml-1 sm:ml-2" />
              <span className="hidden sm:inline">تحديث</span>
            </Button>
            <Dialog open={showTargetDialog} onOpenChange={(open) => {
              setShowTargetDialog(open);
              if (!open) {
                setEditingTarget(null);
                resetNewTarget();
              }
            }}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-target" className="h-11 sm:h-9 text-sm">
                  <Plus className="h-4 w-4 ml-1 sm:ml-2" />
                  <span className="hidden sm:inline">إضافة هدف جديد</span>
                  <span className="sm:hidden">هدف جديد</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader className="pb-2">
                  <DialogTitle className="text-base">{editingTarget ? "تعديل هدف الكاشير" : "إضافة هدف كاشير جديد"}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  {/* Row 1: Branch & Cashier */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <Label className="text-xs">الفرع</Label>
                      <Select 
                        value={newTarget.branchId} 
                        onValueChange={(v) => setNewTarget({...newTarget, branchId: v, cashierId: ""})}
                        disabled={!!editingTarget}
                      >
                        <SelectTrigger data-testid="select-branch" className="h-9">
                          <SelectValue placeholder="اختر الفرع" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch: { id: string; name: string }) => (
                            <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">الكاشير</Label>
                      <Select 
                        value={newTarget.cashierId} 
                        onValueChange={(v) => setNewTarget({...newTarget, cashierId: v})}
                        disabled={!newTarget.branchId || !!editingTarget}
                      >
                        <SelectTrigger data-testid="select-cashier-id" className="h-9">
                          <SelectValue placeholder={newTarget.branchId ? "اختر" : "الفرع أولاً"} />
                        </SelectTrigger>
                        <SelectContent>
                          {branchCashiers.length > 0 ? (
                            branchCashiers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.firstName || user.username} {user.lastName || ""}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="_empty" disabled>لا يوجد كاشير</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 2: Shift Type & Cashier Role */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <Label className="text-xs">نوع الشفت</Label>
                      <Select 
                        value={newTarget.shiftType} 
                        onValueChange={(v) => setNewTarget({...newTarget, shiftType: v})}
                        disabled={!!editingTarget}
                      >
                        <SelectTrigger data-testid="select-shift-type" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SHIFT_TYPES.map((shift) => (
                            <SelectItem key={shift.value} value={shift.value}>{shift.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">دور الكاشير</Label>
                      <Select value={newTarget.cashierRole} onValueChange={(v) => setNewTarget({...newTarget, cashierRole: v})}>
                        <SelectTrigger data-testid="select-cashier-role" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CASHIER_ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Row 3: Period Type & Date Range */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-1">
                      <Label className="text-xs">نوع الفترة</Label>
                      <Select 
                        value={newTarget.periodType} 
                        onValueChange={(v: "daily" | "weekly" | "monthly") => {
                          const endDate = calculateEndDate(newTarget.startDate, v);
                          setNewTarget({...newTarget, periodType: v, endDate});
                        }}
                      >
                        <SelectTrigger data-testid="select-period-type" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">يومي</SelectItem>
                          <SelectItem value="weekly">أسبوعي</SelectItem>
                          <SelectItem value="monthly">شهري</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">من</Label>
                      <Input 
                        type="date" 
                        value={newTarget.startDate}
                        onChange={(e) => {
                          const startDate = e.target.value;
                          const endDate = calculateEndDate(startDate, newTarget.periodType);
                          setNewTarget({...newTarget, startDate, endDate});
                        }}
                        data-testid="input-start-date"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">إلى</Label>
                      <Input 
                        type="date" 
                        value={newTarget.endDate}
                        onChange={(e) => setNewTarget({...newTarget, endDate: e.target.value})}
                        data-testid="input-end-date"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Period days info - inline badge */}
                  {newTarget.startDate && newTarget.endDate && (
                    <div className="flex justify-center">
                      <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                        {calculateDaysInPeriod(newTarget.startDate, newTarget.endDate)} يوم
                      </span>
                    </div>
                  )}

                  {/* Row 4: Targets */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1">
                      <Label className="text-xs">هدف المبيعات للفترة (ر.س)</Label>
                      <Input 
                        type="number" 
                        value={newTarget.totalTargetAmount} 
                        onChange={(e) => setNewTarget({...newTarget, totalTargetAmount: Number(e.target.value)})}
                        data-testid="input-total-target-amount"
                        className="h-9"
                        placeholder="70000"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">عدد الحركات المستهدفة</Label>
                      <Input 
                        type="number" 
                        value={newTarget.totalTargetTransactions} 
                        onChange={(e) => setNewTarget({...newTarget, totalTargetTransactions: Number(e.target.value)})}
                        data-testid="input-total-target-transactions"
                        className="h-9"
                        placeholder="700"
                      />
                    </div>
                  </div>
                  
                  {/* Calculated Daily Targets - Compact */}
                  {newTarget.totalTargetAmount > 0 && newTarget.startDate && newTarget.endDate && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <div className="text-xs font-medium text-amber-800 mb-1">الأهداف اليومية الموزعة:</div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">
                          المبيعات: <strong className="text-amber-700">{formatCurrency(Math.round(newTarget.totalTargetAmount / calculateDaysInPeriod(newTarget.startDate, newTarget.endDate)))}</strong>
                        </span>
                        <span className="text-gray-600">
                          الحركات: <strong className="text-amber-700">{Math.round(newTarget.totalTargetTransactions / calculateDaysInPeriod(newTarget.startDate, newTarget.endDate))}</strong>
                        </span>
                        <span className="text-gray-600">
                          م. الفاتورة: <strong className="text-amber-700">{newTarget.totalTargetTransactions > 0 ? formatCurrency(Math.round(newTarget.totalTargetAmount / newTarget.totalTargetTransactions)) : "0"}</strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowTargetDialog(false);
                    setEditingTarget(null);
                    resetNewTarget();
                  }} data-testid="button-cancel" className="h-11 sm:h-9">
                    إلغاء
                  </Button>
                  <Button 
                    onClick={handleSaveTarget} 
                    disabled={(createTargetMutation.isPending || updateTargetMutation.isPending) || 
                      (!editingTarget && (!newTarget.branchId || !newTarget.cashierId)) || 
                      !newTarget.totalTargetAmount || !newTarget.startDate || !newTarget.endDate}
                    data-testid="button-save-target"
                    className="h-11 sm:h-9"
                  >
                    {(createTargetMutation.isPending || updateTargetMutation.isPending) 
                      ? "جاري الحفظ..." 
                      : editingTarget ? "تحديث الهدف" : "حفظ الهدف"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
          {/* Cashier Name Display */}
          {user && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <UserIcon className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800" data-testid="text-cashier-name">
                {user.firstName || user.username || 'الكاشير'} {user.lastName || ''}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label className="text-sm">التاريخ:</Label>
            <Input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-36 sm:w-44 h-11 sm:h-10"
              data-testid="input-date"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">الفرع:</Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-36 sm:w-44 h-11 sm:h-10" data-testid="select-filter-branch" disabled={!canSelectBranch}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canSelectBranch && <SelectItem value="all">جميع الفروع</SelectItem>}
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">الشفت:</Label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger className="w-36 sm:w-44 h-11 sm:h-10" data-testid="select-filter-shift">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الشفتات</SelectItem>
                {SHIFT_TYPES.map((shift) => (
                  <SelectItem key={shift.value} value={shift.value}>{shift.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card data-testid="card-total-target">
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-full bg-blue-100">
                  <Target className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">إجمالي الأهداف</p>
                  <p className="text-lg sm:text-2xl font-bold">{formatCurrency(summaryStats.totalTarget)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-achieved">
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-full bg-green-100">
                  <DollarSign className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">إجمالي المحقق</p>
                  <p className="text-lg sm:text-2xl font-bold">{formatCurrency(summaryStats.totalAchieved)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-percent">
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-full bg-amber-100">
                  <BarChartIcon className="h-4 w-4 sm:h-6 sm:w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">نسبة الإنجاز</p>
                  <p className={`text-lg sm:text-2xl font-bold ${getPercentColor(summaryStats.avgPercent)}`}>
                    {summaryStats.avgPercent.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-alerts">
            <CardContent className="p-3 sm:pt-6 sm:px-6">
              <div className="flex items-center gap-2 sm:gap-4">
                <div className={`p-2 sm:p-3 rounded-full ${summaryStats.alertCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <Bell className={`h-4 w-4 sm:h-6 sm:w-6 ${summaryStats.alertCount > 0 ? 'text-red-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">تنبيهات نشطة</p>
                  <p className="text-lg sm:text-2xl font-bold">{summaryStats.alertCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="targets" className="space-y-4">
          <TabsList data-testid="tabs-main" className="flex-wrap h-auto gap-1">
            <TabsTrigger value="targets" data-testid="tab-targets" className="text-xs sm:text-sm">
              <Target className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
              الأهداف
            </TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance" className="text-xs sm:text-sm">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
              الأداء
            </TabsTrigger>
            <TabsTrigger value="cashier-report" data-testid="tab-cashier-report" className="text-xs sm:text-sm">
              <Receipt className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
              تقرير الكاشير
            </TabsTrigger>
            <TabsTrigger value="contribution" data-testid="tab-contribution" className="text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
              نسبة المساهمة
            </TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts" className="text-xs sm:text-sm">
              <Bell className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
              التنبيهات
              {summaryStats.alertCount > 0 && (
                <Badge className="mr-1 bg-red-500 text-white text-xs">{summaryStats.alertCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="targets" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sun className="h-5 w-5 text-amber-500" />
                    الشفت الصباحي
                  </CardTitle>
                  <CardDescription>أهداف وأداء الكاشيرين في الفترة الصباحية</CardDescription>
                </CardHeader>
                <CardContent>
                  {shiftTargets.filter(t => t.shiftType === 'morning').length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد أهداف للشفت الصباحي
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {shiftTargets.filter(t => t.shiftType === 'morning').map((target) => {
                        const actualSales = getCashierActualSales(target.cashierId || '', 'morning');
                        const achieved = actualSales.totalSales;
                        const dailyTarget = Number(target.targetAmount);
                        const dailyTransactions = Number(target.targetTransactions) || 0;
                        const targetTicket = Number(target.targetTicketValue) || 0;
                        const percent = dailyTarget ? (achieved / dailyTarget) * 100 : 0;
                        const transactionsPercent = dailyTransactions ? (actualSales.transactionCount / dailyTransactions) * 100 : 0;
                        const ticketPercent = targetTicket ? (actualSales.averageTicket / targetTicket) * 100 : 0;
                        const periodType = (target as any).periodType || 'daily';
                        const startDate = (target as any).startDate || target.targetDate;
                        const endDate = (target as any).endDate || target.targetDate;
                        const periodLabel = periodType === 'weekly' ? 'أسبوعي' : periodType === 'monthly' ? 'شهري' : 'يومي';
                        
                        return (
                          <div key={target.id} className="border rounded-lg p-4" data-testid={`target-morning-${target.id}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4" />
                                <span className="font-medium">{getCashierName(target.cashierId)}</span>
                                <Badge variant="outline">{CASHIER_ROLES.find(r => r.value === target.cashierRole)?.label}</Badge>
                                <Badge variant="secondary" className="text-xs">{periodLabel}</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={ALERT_COLORS[getAlertLevel(percent)].badge}>
                                  {percent.toFixed(0)}%
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEditDialog(target)}
                                  data-testid={`button-edit-target-${target.id}`}
                                >
                                  <Pencil className="h-4 w-4 text-gray-500" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Period info */}
                            {periodType !== 'daily' && (
                              <div className="text-xs text-gray-400 mb-2">
                                الفترة: {startDate} إلى {endDate}
                              </div>
                            )}
                            
                            <div className="space-y-3">
                              {/* Sales Progress */}
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-muted-foreground">المبيعات اليومية</span>
                                  <span className={getPercentColor(percent)}>{percent.toFixed(0)}%</span>
                                </div>
                                <Progress value={Math.min(percent, 100)} className="h-2" />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                  <span>الهدف: {formatCurrency(dailyTarget)}</span>
                                  <span>المحقق: {formatCurrency(achieved)}</span>
                                </div>
                              </div>
                              
                              {/* Transactions Progress */}
                              {dailyTransactions > 0 && (
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">عدد الحركات</span>
                                    <span className={getPercentColor(transactionsPercent)}>{transactionsPercent.toFixed(0)}%</span>
                                  </div>
                                  <Progress value={Math.min(transactionsPercent, 100)} className="h-1.5" />
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>الهدف: {dailyTransactions}</span>
                                    <span>المحقق: {actualSales.transactionCount}</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Average Ticket Progress */}
                              {targetTicket > 0 && (
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">متوسط الفاتورة</span>
                                    <span className={getPercentColor(ticketPercent)}>{ticketPercent.toFixed(0)}%</span>
                                  </div>
                                  <Progress value={Math.min(ticketPercent, 100)} className="h-1.5" />
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>الهدف: {formatCurrency(targetTicket)}</span>
                                    <span>الفعلي: {formatCurrency(actualSales.averageTicket)}</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Incentive Calculation */}
                              {(() => {
                                const excessSales = Math.max(0, achieved - dailyTarget);
                                const { tier, reward } = calculateIncentive(percent, excessSales);
                                if (!tier) return null;
                                return (
                                  <div className="mt-3 pt-3 border-t border-dashed">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-amber-500" />
                                        <span className="text-sm font-medium text-amber-700">{tier.name}</span>
                                      </div>
                                      <Badge className="bg-green-500 text-white">
                                        حافز: {formatCurrency(reward)}
                                      </Badge>
                                    </div>
                                    {tier.description && (
                                      <p className="text-xs text-gray-500 mt-1">{tier.description}</p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Moon className="h-5 w-5 text-indigo-500" />
                    الشفت المسائي
                  </CardTitle>
                  <CardDescription>أهداف وأداء الكاشيرين في الفترة المسائية</CardDescription>
                </CardHeader>
                <CardContent>
                  {shiftTargets.filter(t => t.shiftType === 'evening').length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد أهداف للشفت المسائي
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {shiftTargets.filter(t => t.shiftType === 'evening').map((target) => {
                        const actualSales = getCashierActualSales(target.cashierId || '', 'evening');
                        const achieved = actualSales.totalSales;
                        const dailyTarget = Number(target.targetAmount);
                        const dailyTransactions = Number(target.targetTransactions) || 0;
                        const targetTicket = Number(target.targetTicketValue) || 0;
                        const percent = dailyTarget ? (achieved / dailyTarget) * 100 : 0;
                        const transactionsPercent = dailyTransactions ? (actualSales.transactionCount / dailyTransactions) * 100 : 0;
                        const ticketPercent = targetTicket ? (actualSales.averageTicket / targetTicket) * 100 : 0;
                        const periodType = (target as any).periodType || 'daily';
                        const startDate = (target as any).startDate || target.targetDate;
                        const endDate = (target as any).endDate || target.targetDate;
                        const periodLabel = periodType === 'weekly' ? 'أسبوعي' : periodType === 'monthly' ? 'شهري' : 'يومي';
                        
                        return (
                          <div key={target.id} className="border rounded-lg p-4" data-testid={`target-evening-${target.id}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4" />
                                <span className="font-medium">{getCashierName(target.cashierId)}</span>
                                <Badge variant="outline">{CASHIER_ROLES.find(r => r.value === target.cashierRole)?.label}</Badge>
                                <Badge variant="secondary" className="text-xs">{periodLabel}</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={ALERT_COLORS[getAlertLevel(percent)].badge}>
                                  {percent.toFixed(0)}%
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEditDialog(target)}
                                  data-testid={`button-edit-target-${target.id}`}
                                >
                                  <Pencil className="h-4 w-4 text-gray-500" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Period info */}
                            {periodType !== 'daily' && (
                              <div className="text-xs text-gray-400 mb-2">
                                الفترة: {startDate} إلى {endDate}
                              </div>
                            )}
                            
                            <div className="space-y-3">
                              {/* Sales Progress */}
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-muted-foreground">المبيعات اليومية</span>
                                  <span className={getPercentColor(percent)}>{percent.toFixed(0)}%</span>
                                </div>
                                <Progress value={Math.min(percent, 100)} className="h-2" />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                  <span>الهدف: {formatCurrency(dailyTarget)}</span>
                                  <span>المحقق: {formatCurrency(achieved)}</span>
                                </div>
                              </div>
                              
                              {/* Transactions Progress */}
                              {dailyTransactions > 0 && (
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">عدد الحركات</span>
                                    <span className={getPercentColor(transactionsPercent)}>{transactionsPercent.toFixed(0)}%</span>
                                  </div>
                                  <Progress value={Math.min(transactionsPercent, 100)} className="h-1.5" />
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>الهدف: {dailyTransactions}</span>
                                    <span>المحقق: {actualSales.transactionCount}</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Average Ticket Progress */}
                              {targetTicket > 0 && (
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">متوسط الفاتورة</span>
                                    <span className={getPercentColor(ticketPercent)}>{ticketPercent.toFixed(0)}%</span>
                                  </div>
                                  <Progress value={Math.min(ticketPercent, 100)} className="h-1.5" />
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>الهدف: {formatCurrency(targetTicket)}</span>
                                    <span>الفعلي: {formatCurrency(actualSales.averageTicket)}</span>
                                  </div>
                                </div>
                              )}
                              
                              {/* Incentive Calculation */}
                              {(() => {
                                const excessSales = Math.max(0, achieved - dailyTarget);
                                const { tier, reward } = calculateIncentive(percent, excessSales);
                                if (!tier) return null;
                                return (
                                  <div className="mt-3 pt-3 border-t border-dashed">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-amber-500" />
                                        <span className="text-sm font-medium text-amber-700">{tier.name}</span>
                                      </div>
                                      <Badge className="bg-green-500 text-white">
                                        حافز: {formatCurrency(reward)}
                                      </Badge>
                                    </div>
                                    {tier.description && (
                                      <p className="text-xs text-gray-500 mt-1">{tier.description}</p>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>مقارنة أداء الشفتات</CardTitle>
                  <CardDescription>الهدف مقابل المحقق لكل شفت</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shiftChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip 
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend />
                        <Bar dataKey="target" name="الهدف" fill="#3b82f6" />
                        <Bar dataKey="achieved" name="المحقق" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>تتبع الأداء اللحظي</CardTitle>
                  <CardDescription>حالة الشفتات النشطة</CardDescription>
                </CardHeader>
                <CardContent>
                  {shiftTracking.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      لا يوجد تتبع أداء نشط حالياً
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {shiftTracking.map((track) => {
                        const currentPercent = Number(track.achievementPercentage || 0);
                        const isActive = !track.status;
                        return (
                          <div key={track.id} className="border rounded-lg p-4" data-testid={`tracking-${track.id}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {track.shiftType === 'morning' ? (
                                  <Sun className="h-5 w-5 text-amber-500" />
                                ) : (
                                  <Moon className="h-5 w-5 text-indigo-500" />
                                )}
                                <span className="font-medium">
                                  {SHIFT_TYPES.find(s => s.value === track.shiftType)?.label}
                                </span>
                                <Badge variant={isActive ? 'default' : 'secondary'}>
                                  {isActive ? 'نشط' : 'مكتمل'}
                                </Badge>
                              </div>
                              <span className={`text-lg font-bold ${getPercentColor(currentPercent)}`}>
                                {currentPercent.toFixed(1)}%
                              </span>
                            </div>
                            <Progress value={Math.min(currentPercent, 100)} className="h-3" />
                            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                              <div className="text-center">
                                <p className="text-muted-foreground">المعاملات</p>
                                <p className="font-semibold">{track.totalTransactions || 0}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">متوسط الفاتورة</p>
                                <p className="font-semibold">{formatCurrency(Number(track.averageTicket || 0))}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">آخر تحديث</p>
                                <p className="font-semibold text-xs">
                                  {track.updatedAt ? new Date(track.updatedAt).toLocaleTimeString('en-GB') : '-'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  تنبيهات الأداء
                </CardTitle>
                <CardDescription>تنبيهات تلقائية عند انحراف الأداء عن الأهداف</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceAlerts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>لا توجد تنبيهات - الأداء ضمن المستهدف</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {performanceAlerts.map((alert) => {
                      const severityMap: Record<string, keyof typeof ALERT_COLORS> = {
                        'critical': 'critical',
                        'warning': 'warning',
                        'info': 'on_track',
                        'success': 'exceeding',
                      };
                      const colors = ALERT_COLORS[severityMap[alert.alertLevel] || 'warning'];
                      return (
                        <div 
                          key={alert.id} 
                          className={`border-r-4 rounded-lg p-4 ${colors.bg} ${colors.border}`}
                          data-testid={`alert-${alert.id}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className={`h-5 w-5 mt-0.5 ${colors.text}`} />
                              <div>
                                <p className={`font-medium ${colors.text}`}>{alert.message}</p>
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  <span>{alert.branchId}</span>
                                  <span>•</span>
                                  <span>{alert.shiftType === 'morning' ? 'صباحي' : 'مسائي'}</span>
                                  <span>•</span>
                                  <span>{alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString('en-GB') : '-'}</span>
                                </div>
                              </div>
                            </div>
                            {!alert.isRead && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => markAlertReadMutation.mutate(alert.id)}
                                data-testid={`button-mark-read-${alert.id}`}
                              >
                                تم القراءة
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* تقرير الكاشير التفصيلي */}
          <TabsContent value="cashier-report" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-5 w-5" />
                  تقرير الكاشير التفصيلي
                </CardTitle>
                <CardDescription>عرض يوميات كل كاشير حسب الفترة المختارة</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">من:</Label>
                    <Input 
                      type="date" 
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-32 h-9 text-sm"
                      data-testid="input-report-start"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">إلى:</Label>
                    <Input 
                      type="date" 
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-32 h-9 text-sm"
                      data-testid="input-report-end"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">الكاشير:</Label>
                    <Select value={reportCashierId} onValueChange={setReportCashierId}>
                      <SelectTrigger className="w-40 h-9 text-sm" data-testid="select-report-cashier">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الكاشيرين</SelectItem>
                        {branchCashiers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.firstName || c.username} {c.lastName || ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Report Table */}
                {cashierJournals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>لا توجد بيانات للفترة المختارة</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">الكاشير</TableHead>
                          <TableHead className="text-right">الشفت</TableHead>
                          <TableHead className="text-right">المبيعات</TableHead>
                          <TableHead className="text-right">نقدي</TableHead>
                          <TableHead className="text-right">بطاقات</TableHead>
                          <TableHead className="text-right">الحركات</TableHead>
                          <TableHead className="text-right">م. الفاتورة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cashierJournals.map((j) => (
                          <TableRow key={j.id} data-testid={`journal-row-${j.id}`}>
                            <TableCell className="font-medium">{j.date}</TableCell>
                            <TableCell>{j.cashierName}</TableCell>
                            <TableCell>
                              <Badge variant={j.shiftType === 'morning' ? 'default' : 'secondary'} className="text-xs">
                                {j.shiftType === 'morning' ? 'صباحي' : 'مسائي'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-bold text-green-600">{formatCurrency(j.totalSales)}</TableCell>
                            <TableCell>{formatCurrency(j.cashSales)}</TableCell>
                            <TableCell>{formatCurrency(j.cardSales)}</TableCell>
                            <TableCell>{j.transactionCount}</TableCell>
                            <TableCell>{formatCurrency(j.averageTicket)}</TableCell>
                          </TableRow>
                        ))}
                        {/* Totals Row */}
                        <TableRow className="bg-amber-50 font-bold">
                          <TableCell colSpan={3}>الإجمالي</TableCell>
                          <TableCell className="text-green-700">{formatCurrency(cashierJournals.reduce((s, j) => s + j.totalSales, 0))}</TableCell>
                          <TableCell>{formatCurrency(cashierJournals.reduce((s, j) => s + j.cashSales, 0))}</TableCell>
                          <TableCell>{formatCurrency(cashierJournals.reduce((s, j) => s + j.cardSales, 0))}</TableCell>
                          <TableCell>{cashierJournals.reduce((s, j) => s + j.transactionCount, 0)}</TableCell>
                          <TableCell>-</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* نسبة مساهمة الكاشير */}
          <TabsContent value="contribution" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5" />
                  نسبة مساهمة الكاشير من المبيعات
                </CardTitle>
                <CardDescription>قياس مساهمة كل كاشير من إجمالي مبيعات الفرع للفترة المختارة</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-blue-600">إجمالي المبيعات</p>
                    <p className="text-lg font-bold text-blue-700">
                      {formatCurrency(contributionData.reduce((s, c) => s + c.totalSales, 0))}
                    </p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-green-600">عدد الكاشيرين</p>
                    <p className="text-lg font-bold text-green-700">{contributionData.length}</p>
                  </div>
                  <div className="bg-amber-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-amber-600">عدد الحركات</p>
                    <p className="text-lg font-bold text-amber-700">
                      {contributionData.reduce((s, c) => s + c.transactionCount, 0)}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg text-center">
                    <p className="text-xs text-purple-600">الفترة</p>
                    <p className="text-sm font-bold text-purple-700">{reportStartDate} - {reportEndDate}</p>
                  </div>
                </div>

                {/* Contribution Chart & Table */}
                {contributionData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>لا توجد بيانات للفترة المختارة</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Pie Chart */}
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={contributionData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="contributionPercent"
                            nameKey="cashierName"
                            label={({ name, percent }) => `${name}: ${percent.toFixed(0)}%`}
                          >
                            {contributionData.map((_, i) => (
                              <Cell key={i} fill={['#8B4513', '#D4A574', '#F5DEB3', '#DEB887', '#CD853F', '#A0522D'][i % 6]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">#</TableHead>
                            <TableHead className="text-right">الكاشير</TableHead>
                            <TableHead className="text-right">المبيعات</TableHead>
                            <TableHead className="text-right">نسبة المساهمة</TableHead>
                            <TableHead className="text-right">صباحي</TableHead>
                            <TableHead className="text-right">مسائي</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contributionData.map((c, i) => (
                            <TableRow key={c.cashierId} data-testid={`contribution-row-${c.cashierId}`}>
                              <TableCell>
                                {i === 0 && <Trophy className="h-4 w-4 text-amber-500" />}
                                {i > 0 && (i + 1)}
                              </TableCell>
                              <TableCell className="font-medium">{c.cashierName}</TableCell>
                              <TableCell className="font-bold text-green-600">{formatCurrency(c.totalSales)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={c.contributionPercent} className="h-2 w-16" />
                                  <span className="font-bold text-amber-700">{c.contributionPercent.toFixed(1)}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">{formatCurrency(c.shifts.morning)}</TableCell>
                              <TableCell className="text-xs">{formatCurrency(c.shifts.evening)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
