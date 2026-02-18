import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { 
  Target, TrendingUp, TrendingDown, Users, Trophy, ChevronLeft, Calendar, 
  Award, AlertTriangle, Bell, Clock, CheckCircle2, Settings, 
  Sun, Moon, DollarSign, Receipt, User as UserIcon, RefreshCw, BarChart as BarChartIcon,
  Star, Search, CalendarDays, X, FileSpreadsheet, Printer, FileText, Package, Download
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import type { Branch, PerformanceAlert, ShiftPerformanceTracking, User, CashierIncentiveStatement } from "@shared/schema";
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
  const [datePreset, setDatePreset] = useState<string>("today");
  
  // Report filters
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(today);
  const [reportCashierId, setReportCashierId] = useState<string>("all");
  const [reportCashierOpen, setReportCashierOpen] = useState(false);
  
  // Targets tab specific filter
  const [targetCashierId, setTargetCashierId] = useState<string>("all");
  const [targetCashierOpen, setTargetCashierOpen] = useState(false);

  const [showProductAchievementDialog, setShowProductAchievementDialog] = useState(false);
  const [selectedProductCommission, setSelectedProductCommission] = useState<any>(null);
  const [achievedQuantity, setAchievedQuantity] = useState("");
  const [achievementShiftDate, setAchievementShiftDate] = useState("");
  const [achievementShiftType, setAchievementShiftType] = useState("");
  const [submittingAchievement, setSubmittingAchievement] = useState(false);

  const [stmtPeriodFrom, setStmtPeriodFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [stmtPeriodTo, setStmtPeriodTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [stmtCashierId, setStmtCashierId] = useState<string>("");
  const [stmtCashierOpen, setStmtCashierOpen] = useState(false);
  const [stmtViewMode, setStmtViewMode] = useState<'list' | 'detail'>('list');
  const [selectedStatement, setSelectedStatement] = useState<any>(null);
  const [stmtNotes, setStmtNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingStmtId, setRejectingStmtId] = useState<number | null>(null);

  const { user } = useAuth();
  const { branches, userBranchId, canSelectBranch } = useBranches();
  const { canView, canCreate, canEdit, canDelete, canApprove } = usePermissions();
  
  // Check if user can view all cashiers' data (admin/manager or has approve permission ONLY on cashier_performance or cashier_journal)
  const canViewAllCashiers = useMemo(() => {
    if (!user) return false;
    return user.role === 'admin' || user.role === 'manager' 
      || canApprove("cashier_performance") || canApprove("cashier_journal");
  }, [user, canApprove]);

  const canViewChallenges = canView("smart_incentives_challenges");
  const canCreateChallenges = canCreate("smart_incentives_challenges");
  const canEditChallenges = canEdit("smart_incentives_challenges");
  const canDeleteChallenges = canDelete("smart_incentives_challenges");
  const canViewCommissions = canView("smart_incentives_commissions");
  const canCreateCommissions = canCreate("smart_incentives_commissions");
  const canEditCommissions = canEdit("smart_incentives_commissions");
  const canDeleteCommissions = canDelete("smart_incentives_commissions");
  const canViewBonus = canView("smart_incentives_bonus");
  const canApproveBonus = canApprove("smart_incentives_bonus");
  const canViewWallet = canView("smart_incentives_wallet");
  const canApproveWallet = canApprove("smart_incentives_wallet");
  const canViewStatements = canView("smart_incentives_statements") || !canViewAllCashiers;
  const canCreateStatements = canCreate("smart_incentives_statements");
  const canApproveStatements = canApprove("smart_incentives_statements");
  const canViewSettings = canView("smart_incentives_settings");

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

  // Reset cashier filters when branch changes (only for admins)
  useEffect(() => {
    if (canViewAllCashiers) {
      setTargetCashierId("all");
    }
    setReportCashierId("all");
  }, [selectedBranch, canViewAllCashiers]);

  // For non-admin cashiers, always lock to their own ID
  useEffect(() => {
    if (user && !canViewAllCashiers) {
      setStmtCashierId(user.id);
      setTargetCashierId(user.id);
    }
  }, [user, canViewAllCashiers]);

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/branch-cashiers"],
    enabled: canViewAllCashiers,
  });

  const selfUser = useMemo(() => {
    if (user && !canViewAllCashiers) {
      return [user as User];
    }
    return [];
  }, [user, canViewAllCashiers]);

  const effectiveUsers = canViewAllCashiers ? allUsers : selfUser;

  // Fetch all cashier IDs who have journal entries for the dropdown (independent of cashier filter)
  const { data: allBranchJournals = [] } = useQuery<CashierJournalReport[]>({
    queryKey: ["/api/cashier-journals-report-cashiers", selectedBranch, reportStartDate, reportEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") params.append("branchId", selectedBranch);
      params.append("startDate", reportStartDate);
      params.append("endDate", reportEndDate);
      const res = await fetch(`/api/cashier-journals-report?${params}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.journals || [];
    },
    enabled: !!reportStartDate && !!reportEndDate && canViewAllCashiers,
  });

  // Filter cashiers for report tab: only show users who have journal entries in the data
  const reportBranchCashiers = useMemo(() => {
    const journalCashierIds = new Set(allBranchJournals.map(j => j.cashierId));
    const usersPool = effectiveUsers;
    const branchFiltered = selectedBranch === "all"
      ? usersPool.filter(u => u.isActive === 'active')
      : usersPool.filter(u => (u.branchId === selectedBranch || !canViewAllCashiers) && u.isActive === 'active');
    if (!canViewAllCashiers && branchFiltered.length > 0) {
      return branchFiltered;
    }
    if (journalCashierIds.size > 0) {
      return branchFiltered.filter(u => journalCashierIds.has(u.id));
    }
    return branchFiltered.filter(u => u.role === 'cashier' || (u as any).jobTitle === 'cashier');
  }, [effectiveUsers, selectedBranch, allBranchJournals, canViewAllCashiers]);

  const { data: shiftTargets = [], isLoading: targetsLoading, refetch: refetchTargets } = useQuery<any[]>({
    queryKey: ["/api/smart-incentives/challenges-as-targets", selectedBranch, selectedDate, selectedShift],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      if (selectedShift !== "all") params.append("shiftType", selectedShift);
      const res = await fetch(`/api/smart-incentives/challenges-as-targets?${params}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: productSales = [], refetch: refetchProductSales } = useQuery<any[]>({
    queryKey: ["/api/smart-incentives/product-sales", targetCashierId, selectedDate, selectedBranch],
    queryFn: async () => {
      const params = new URLSearchParams({ date: selectedDate });
      if (targetCashierId && targetCashierId !== 'all') {
        params.set("cashierId", targetCashierId);
      } else if (selectedBranch && selectedBranch !== 'all') {
        params.set("branchId", selectedBranch);
      } else {
        return [];
      }
      const res = await fetch(`/api/smart-incentives/product-sales?${params}`);
      return res.ok ? res.json() : [];
    },
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

  const currentYearMonth = selectedDate.substring(0, 7);
  const { data: topCashierPoints = [], isLoading: pointsLoading } = useQuery<Array<{ cashierId: string; cashierName: string; branchId: string; branchName: string; totalPoints: number; totalAmount: number; challengeCount: number }>>({
    queryKey: ["/api/smart-incentives/top-cashiers", currentYearMonth],
    queryFn: async () => {
      const res = await fetch(`/api/smart-incentives/top-cashiers?yearMonth=${currentYearMonth}&limit=50`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15000,
    retry: 2,
    refetchOnMount: 'always',
  });

  const getCashierPoints = (cashierId: string) => {
    const found = topCashierPoints.find(c => c.cashierId === cashierId);
    return found ? { totalPoints: found.totalPoints, totalAmount: found.totalAmount, challengeCount: found.challengeCount } : null;
  };

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

  const { data: journalsResponse, isLoading: journalsLoading } = useQuery<{
    journals: CashierJournalReport[];
    myContributionPercent: number | null;
  }>({
    queryKey: ["/api/cashier-journals-report", selectedBranch, reportStartDate, reportEndDate, reportCashierId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") params.append("branchId", selectedBranch);
      params.append("startDate", reportStartDate);
      params.append("endDate", reportEndDate);
      if (reportCashierId !== "all") params.append("cashierId", reportCashierId);
      console.log("[cashier-journals-report] Fetching:", params.toString());
      const res = await fetch(`/api/cashier-journals-report?${params}`);
      if (!res.ok) {
        console.log("[cashier-journals-report] Error:", res.status);
        return { journals: [], myContributionPercent: null };
      }
      const data = await res.json();
      console.log("[cashier-journals-report] Got:", data.journals?.length || 0, "records");
      return data;
    },
    enabled: !!reportStartDate && !!reportEndDate,
  });

  const cashierJournals = journalsResponse?.journals || [];
  const serverContributionPercent = journalsResponse?.myContributionPercent ?? null;

  // Calculate contribution analysis
  const contributionData = useMemo(() => {
    if (!cashierJournals.length) return [];
    
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
    
    return Array.from(cashierTotals.values()).map(c => {
      let contributionPercent: number;
      if (!canViewAllCashiers && serverContributionPercent !== null) {
        contributionPercent = serverContributionPercent;
      } else {
        contributionPercent = branchTotal > 0 ? (c.totalSales / branchTotal) * 100 : 0;
      }
      
      return {
        ...c,
        branchTotal: canViewAllCashiers ? branchTotal : 0,
        contributionPercent,
        avgDailySales: c.totalSales / (uniqueDates.size || 1),
      };
    }).sort((a, b) => b.contributionPercent - a.contributionPercent);
  }, [cashierJournals, serverContributionPercent, canViewAllCashiers]);

  const { data: incentiveStatements = [], isLoading: loadingStatements, refetch: refetchStatements } = useQuery({
    queryKey: ["/api/smart-incentives/incentive-statements", selectedBranch, stmtCashierId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") params.set("branchId", selectedBranch);
      if (stmtCashierId) params.set("cashierId", stmtCashierId);
      const res = await fetch(`/api/smart-incentives/incentive-statements?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: myIncentiveSummary, isLoading: loadingMyIncentive } = useQuery<{
    cashierId: string;
    pointValue: number;
    challenges: Array<{ id: number; name: string; challengeType: string; targetValue: number; basePoints: number; shiftType: string; validFrom: string; validTo: string | null }>;
    dailyDetails: Array<{
      date: string;
      challenges: Array<{ name: string; type: string; targetValue: number; actualValue: number; achievementPercent: number; achieved: boolean; basePoints: number; shiftType: string | null }>;
      ledgerEntries: Array<{ pointsType: string; sourceName: string | null; pointsEarned: number; amountEarned: number; status: string; shiftType: string | null }>;
      totalPoints: number;
      totalAmount: number;
    }>;
    totals: { totalPoints: number; totalAmount: number; earnedAmount: number; approvedAmount: number; paidAmount: number };
  }>({
    queryKey: ["/api/smart-incentives/my-incentive-summary", stmtPeriodFrom, stmtPeriodTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("dateFrom", stmtPeriodFrom);
      params.set("dateTo", stmtPeriodTo);
      const res = await fetch(`/api/smart-incentives/my-incentive-summary?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !canViewAllCashiers,
  });

  const createStatementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/smart-incentives/incentive-statements", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast.success("تم إنشاء كشف الحوافز بنجاح");
      refetchStatements();
      setStmtNotes("");
    },
    onError: (err: any) => {
      const msg = err.message || "";
      const cleanMsg = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg;
      try {
        const parsed = JSON.parse(cleanMsg);
        toast.error(parsed.error || "فشل في إنشاء الكشف");
      } catch {
        toast.error(cleanMsg || "فشل في إنشاء الكشف");
      }
    },
  });

  const updateStatementStatusMutation = useMutation({
    mutationFn: async ({ id, status, rejectionReason }: { id: number; status: string; rejectionReason?: string }) => {
      const res = await apiRequest("PATCH", `/api/smart-incentives/incentive-statements/${id}/status`, { status, rejectionReason });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast.success("تم تحديث حالة الكشف بنجاح");
      refetchStatements();
      if (data && selectedStatement && data.id === selectedStatement.id) {
        setSelectedStatement(data);
      }
      setShowRejectDialog(false);
      setRejectionReason("");
      setRejectingStmtId(null);
    },
    onError: (err: any) => {
      const msg = err.message || "";
      const cleanMsg = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg;
      try {
        const parsed = JSON.parse(cleanMsg);
        toast.error(parsed.error || "فشل في تحديث الحالة");
      } catch {
        toast.error(cleanMsg || "فشل في تحديث الحالة");
      }
    },
  });

  const markAlertReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("PATCH", `/api/performance-alerts/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance-alerts"] });
    }
  });

  const getStmtStatusInfo = (status: string) => {
    switch (status) {
      case 'draft': return { label: 'مسودة', color: 'bg-gray-100 text-gray-700', icon: '📝' };
      case 'submitted': return { label: 'مقدم للاعتماد', color: 'bg-blue-100 text-blue-700', icon: '📤' };
      case 'approved': return { label: 'معتمد', color: 'bg-green-100 text-green-700', icon: '✅' };
      case 'rejected': return { label: 'مرفوض', color: 'bg-red-100 text-red-700', icon: '❌' };
      case 'paid': return { label: 'تم الصرف', color: 'bg-purple-100 text-purple-700', icon: '💰' };
      default: return { label: status, color: 'bg-gray-100 text-gray-700', icon: '📋' };
    }
  };

  const getPointsTypeLabel = (type: string) => {
    switch (type) {
      case 'daily_challenge': return 'تحدي يومي';
      case 'product_commission': return 'عمولة صنف';
      case 'branch_bonus': return 'مكافأة فرع';
      case 'manual_adjustment': return 'تعديل يدوي';
      default: return type;
    }
  };

  const handleCreateStatement = () => {
    if (!stmtCashierId) {
      toast.error("يجب اختيار الكاشير");
      return;
    }
    if (!selectedBranch || selectedBranch === "all") {
      toast.error("يجب اختيار فرع محدد");
      return;
    }
    createStatementMutation.mutate({
      cashierId: stmtCashierId,
      branchId: selectedBranch,
      periodFrom: stmtPeriodFrom,
      periodTo: stmtPeriodTo,
      notes: stmtNotes || undefined,
    });
  };

  const handleExportStatementExcel = async (stmt: any) => {
    const XLSX = await import("xlsx");
    const data = stmt.statementData ? JSON.parse(stmt.statementData) : null;
    if (!data) return;
    
    const rows = data.entries.map((e: any, i: number) => ({
      '#': i + 1,
      'التاريخ': e.date,
      'الشفت': e.shiftType === 'morning' ? 'صباحي' : e.shiftType === 'evening' ? 'مسائي' : '-',
      'النوع': getPointsTypeLabel(e.type),
      'المصدر': e.source || '-',
      'النقاط': e.points,
      'المبلغ (ر.س)': e.amount?.toFixed(2),
      'ملاحظات': e.notes || '-',
    }));

    rows.push({
      '#': '',
      'التاريخ': '',
      'الشفت': '',
      'النوع': '',
      'المصدر': 'الإجمالي',
      'النقاط': data.summary.totalPoints,
      'المبلغ (ر.س)': data.summary.totalAmount?.toFixed(2),
      'ملاحظات': '',
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "كشف الحوافز");
    XLSX.writeFile(wb, `incentive_statement_${stmt.statementNumber}.xlsx`);
    toast.success("تم تصدير الكشف بنجاح");
  };

  const escapeHtml = (str: string | number | null | undefined): string => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  const exportMyIncentivePDF = () => {
    if (!myIncentiveSummary) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("يرجى السماح بفتح النوافذ المنبثقة لتحميل التقرير");
      return;
    }
    const currentDate = new Date().toLocaleDateString('en-US');
    const cashierName = escapeHtml(user ? `${user.firstName || user.username || ''} ${user.lastName || ''}`.trim() : '');
    const branchName = escapeHtml(branches?.find((b: any) => b.id === (userBranchId || selectedBranch))?.name || '');
    const logoUrl = '/attached_assets/logo_-5_1765206843638.png';

    const challengeRows = myIncentiveSummary.challenges.map(ch => {
      let totalAchieved = 0;
      let totalTarget = 0;
      let daysAchieved = 0;
      let totalDays = 0;
      myIncentiveSummary.dailyDetails.forEach(day => {
        const match = day.challenges.find(dc => dc.name === ch.name && dc.type === ch.challengeType);
        if (match) {
          totalDays++;
          totalTarget += match.targetValue;
          totalAchieved += match.actualValue;
          if (match.achieved) daysAchieved++;
        }
      });
      const overallPercent = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
      return {
        name: escapeHtml(ch.name),
        type: ch.challengeType === 'avg_ticket' ? 'متوسط فاتورة' : ch.challengeType === 'customer_count' ? 'عدد العملاء' : 'مبيعات',
        target: ch.targetValue,
        validFrom: escapeHtml(ch.validFrom),
        validTo: escapeHtml(ch.validTo || '-'),
        basePoints: ch.basePoints,
        totalDays,
        daysAchieved,
        totalAchieved: ch.challengeType === 'customer_count' ? Math.round(totalAchieved) : totalAchieved.toFixed(2),
        overallPercent,
      };
    });

    const dailyRows = myIncentiveSummary.dailyDetails.map(day => {
      const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const challengeDetails = day.challenges.map(ch => {
        const status = ch.achieved ? '✅' : '❌';
        return `${status} ${escapeHtml(ch.name)}: ${ch.actualValue.toFixed(ch.type === 'customer_count' ? 0 : 2)}/${ch.targetValue.toFixed(ch.type === 'customer_count' ? 0 : 2)} (${ch.achievementPercent}%)`;
      }).join('<br/>');
      const ledgerDetails = day.ledgerEntries.map(e => {
        const typeName = escapeHtml(e.sourceName || (() => {
          switch(e.pointsType) {
            case 'challenge_avg_ticket': return 'تحدي متوسط الفاتورة';
            case 'challenge_customers': return 'تحدي عدد العملاء';
            case 'challenge_sales': return 'تحدي المبيعات';
            case 'product_commission': return 'عمولة منتج';
            case 'branch_bonus': return 'مكافأة فرع';
            default: return e.pointsType;
          }
        })());
        return `${typeName}: +${e.pointsEarned} نقطة (${e.amountEarned.toFixed(2)} ر.س)`;
      }).join('<br/>');
      return { dateStr, date: day.date, challengeDetails, ledgerDetails, totalPoints: day.totalPoints, totalAmount: day.totalAmount };
    });

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>كشف حساب حوافزي - ${cashierName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px; background: white; color: #333; font-size: 11px; }
    .header { text-align: center; margin-bottom: 15px; border-bottom: 3px solid #d4a853; padding-bottom: 12px; }
    .header .logo { max-height: 55px; margin-bottom: 8px; }
    .header h1 { font-size: 18px; color: #333; margin-bottom: 3px; }
    .header .sub { color: #666; font-size: 12px; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
    .info-box { background: #f9f9f9; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; text-align: center; }
    .info-box .label { font-size: 10px; color: #666; margin-bottom: 2px; }
    .info-box .value { font-size: 16px; font-weight: bold; color: #d4a853; }
    .info-box .unit { font-size: 9px; color: #999; }
    .info-box.green .value { color: #16a34a; }
    .info-box.blue .value { color: #2563eb; }
    .info-box.purple .value { color: #7c3aed; }
    .section { margin-bottom: 15px; }
    .section-title { font-size: 13px; font-weight: bold; color: #333; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #f0d78c; display: flex; align-items: center; gap: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { border: 1px solid #ddd; padding: 6px 5px; text-align: right; font-size: 10px; }
    th { background: #f5f0e0; font-weight: 700; color: #333; }
    tr:nth-child(even) { background: #fafafa; }
    .achieved { color: #16a34a; font-weight: bold; }
    .not-achieved { color: #ef4444; }
    .highlight { background: #fffbeb; font-weight: bold; }
    .summary-row { background: #f5f0e0 !important; font-weight: bold; }
    .cashier-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px; background: #fffbeb; border: 1px solid #d4a853; border-radius: 8px; padding: 12px; }
    .cashier-info div { text-align: center; }
    .cashier-info .ci-label { font-size: 10px; color: #92400e; }
    .cashier-info .ci-value { font-size: 13px; font-weight: bold; color: #333; }
    .footer { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; color: #888; font-size: 9px; }
    .print-btn { position: fixed; top: 15px; left: 15px; background: #d4a853; color: white; border: none; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 13px; font-weight: bold; z-index: 100; }
    .print-btn:hover { background: #c49843; }
    @media print { .no-print { display: none; } body { padding: 10px; } }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">طباعة / حفظ PDF</button>

  <div class="header">
    <img src="${logoUrl}" alt="Butter Bakery" class="logo" onerror="this.style.display='none'" />
    <h1>كشف حساب الحوافز</h1>
    <div class="sub">تقرير مفصل بالتحديات والإنجازات والنقاط المكتسبة</div>
  </div>

  <div class="cashier-info">
    <div><div class="ci-label">اسم الكاشير</div><div class="ci-value">${cashierName}</div></div>
    <div><div class="ci-label">الفرع</div><div class="ci-value">${branchName}</div></div>
    <div><div class="ci-label">الفترة</div><div class="ci-value">${stmtPeriodFrom} → ${stmtPeriodTo}</div></div>
  </div>

  <div class="info-grid">
    <div class="info-box"><div class="label">إجمالي النقاط</div><div class="value">${myIncentiveSummary.totals.totalPoints}</div><div class="unit">نقطة</div></div>
    <div class="info-box green"><div class="label">القيمة بالريال</div><div class="value">${myIncentiveSummary.totals.totalAmount.toFixed(2)}</div><div class="unit">ر.س</div></div>
    <div class="info-box blue"><div class="label">معتمدة</div><div class="value">${myIncentiveSummary.totals.approvedAmount.toFixed(2)}</div><div class="unit">ر.س</div></div>
    <div class="info-box purple"><div class="label">مصروفة</div><div class="value">${myIncentiveSummary.totals.paidAmount.toFixed(2)}</div><div class="unit">ر.س</div></div>
  </div>

  ${challengeRows.length > 0 ? `
  <div class="section">
    <div class="section-title">🎯 ملخص التحديات المعينة</div>
    <table>
      <thead>
        <tr>
          <th>التحدي</th>
          <th>النوع</th>
          <th>الهدف اليومي</th>
          <th>من تاريخ</th>
          <th>إلى تاريخ</th>
          <th>النقاط الأساسية</th>
          <th>أيام الإنجاز</th>
          <th>إجمالي المحقق</th>
          <th>نسبة الإنجاز</th>
        </tr>
      </thead>
      <tbody>
        ${challengeRows.map(r => `
        <tr>
          <td style="font-weight:bold">${r.name}</td>
          <td>${r.type}</td>
          <td>${r.target}</td>
          <td>${r.validFrom}</td>
          <td>${r.validTo}</td>
          <td>${r.basePoints} نقطة</td>
          <td><span class="${r.daysAchieved > 0 ? 'achieved' : 'not-achieved'}">${r.daysAchieved}</span> / ${r.totalDays} يوم</td>
          <td>${r.totalAchieved}</td>
          <td class="${r.overallPercent >= 100 ? 'achieved' : r.overallPercent >= 75 ? '' : 'not-achieved'}">${r.overallPercent}%</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <div class="section">
    <div class="section-title">📋 السجل اليومي التفصيلي</div>
    <table>
      <thead>
        <tr>
          <th style="width:90px">التاريخ</th>
          <th>التحديات والإنجاز</th>
          <th>القيود والنقاط</th>
          <th style="width:60px">النقاط</th>
          <th style="width:70px">المبلغ (ر.س)</th>
        </tr>
      </thead>
      <tbody>
        ${dailyRows.map(r => `
        <tr>
          <td style="font-weight:bold; white-space:nowrap">${r.dateStr}</td>
          <td style="font-size:9px; line-height:1.5">${r.challengeDetails || '<span style="color:#999">-</span>'}</td>
          <td style="font-size:9px; line-height:1.5">${r.ledgerDetails || '<span style="color:#999">-</span>'}</td>
          <td style="text-align:center; font-weight:bold; color:#d97706">${r.totalPoints}</td>
          <td style="text-align:center; font-weight:bold; color:#16a34a">${r.totalAmount.toFixed(2)}</td>
        </tr>`).join('')}
        <tr class="summary-row">
          <td colspan="3" style="text-align:left; font-size:11px">الإجمالي</td>
          <td style="text-align:center; font-size:12px; color:#92400e">${myIncentiveSummary.totals.totalPoints}</td>
          <td style="text-align:center; font-size:12px; color:#16a34a">${myIncentiveSummary.totals.totalAmount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>تاريخ الطباعة: ${currentDate} | نظام إدارة حوافز الكاشير - باتر</p>
    <p style="margin-top:3px">هذا التقرير صادر آلياً من النظام</p>
  </div>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    toast.success("تم فتح تقرير PDF للطباعة");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount) + ' ر.س';
  };

  const exportReportExcel = async () => {
    const XLSX = await import("xlsx");
    if (cashierJournals.length === 0) return toast.error("لا توجد بيانات للتصدير");
    const data = cashierJournals.map(j => ({
      'التاريخ': j.date,
      'الكاشير': j.cashierName,
      'الشفت': j.shiftType === 'morning' ? 'صباحي' : 'مسائي',
      'المبيعات': j.totalSales,
      'نقدي': j.cashSales,
      'بطاقات': j.cardSales,
      'الحركات': j.transactionCount,
      'متوسط الفاتورة': j.averageTicket,
    }));
    data.push({
      'التاريخ': 'الإجمالي',
      'الكاشير': '',
      'الشفت': '',
      'المبيعات': cashierJournals.reduce((s, j) => s + j.totalSales, 0),
      'نقدي': cashierJournals.reduce((s, j) => s + j.cashSales, 0),
      'بطاقات': cashierJournals.reduce((s, j) => s + j.cardSales, 0),
      'الحركات': cashierJournals.reduce((s, j) => s + j.transactionCount, 0),
      'متوسط الفاتورة': 0,
    });
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تقرير الكاشير");
    XLSX.writeFile(wb, `تقرير_الكاشير_${reportStartDate}_${reportEndDate}.xlsx`);
    toast.success("تم تصدير التقرير بنجاح");
  };

  const exportReportCSV = () => {
    if (cashierJournals.length === 0) return toast.error("لا توجد بيانات للتصدير");
    const headers = ['التاريخ', 'الكاشير', 'الشفت', 'المبيعات', 'نقدي', 'بطاقات', 'الحركات', 'متوسط الفاتورة'];
    const rows = cashierJournals.map(j => [
      j.date, j.cashierName, j.shiftType === 'morning' ? 'صباحي' : 'مسائي',
      j.totalSales, j.cashSales, j.cardSales, j.transactionCount, j.averageTicket
    ]);
    const bom = '\uFEFF';
    const csv = bom + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_الكاشير_${reportStartDate}_${reportEndDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تصدير التقرير بنجاح");
  };

  const printReport = () => {
    if (cashierJournals.length === 0) return toast.error("لا توجد بيانات للطباعة");
    const printContent = `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تقرير الكاشير</title>
        <style>
          body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 20px; }
          h2 { text-align: center; color: #8B4513; margin-bottom: 5px; }
          .subtitle { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f3f1ec; color: #8B4513; padding: 8px; border: 1px solid #ddd; font-size: 13px; }
          td { padding: 7px 8px; border: 1px solid #ddd; font-size: 12px; text-align: right; }
          tr:nth-child(even) { background: #fafaf8; }
          .total-row { background: #fff8eb !important; font-weight: bold; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h2>تقرير الكاشير التفصيلي</h2>
        <p class="subtitle">الفترة: ${reportStartDate} إلى ${reportEndDate}</p>
        <table>
          <thead><tr>
            <th>التاريخ</th><th>الكاشير</th><th>الشفت</th><th>المبيعات</th><th>نقدي</th><th>بطاقات</th><th>الحركات</th><th>م. الفاتورة</th>
          </tr></thead>
          <tbody>
            ${cashierJournals.map(j => `<tr>
              <td>${j.date}</td><td>${j.cashierName}</td>
              <td>${j.shiftType === 'morning' ? 'صباحي' : 'مسائي'}</td>
              <td>${formatCurrency(j.totalSales)}</td><td>${formatCurrency(j.cashSales)}</td>
              <td>${formatCurrency(j.cardSales)}</td><td>${j.transactionCount}</td>
              <td>${formatCurrency(j.averageTicket)}</td>
            </tr>`).join('')}
            <tr class="total-row">
              <td colspan="3">الإجمالي</td>
              <td>${formatCurrency(cashierJournals.reduce((s, j) => s + j.totalSales, 0))}</td>
              <td>${formatCurrency(cashierJournals.reduce((s, j) => s + j.cashSales, 0))}</td>
              <td>${formatCurrency(cashierJournals.reduce((s, j) => s + j.cardSales, 0))}</td>
              <td>${cashierJournals.reduce((s, j) => s + j.transactionCount, 0)}</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>
      </body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(printContent); win.document.close(); win.print(); }
  };

  const handleSubmitProductAchievement = async () => {
    if (!selectedProductCommission || !achievedQuantity || !achievementShiftDate || !achievementShiftType) {
      toast.error("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }
    const qty = parseInt(achievedQuantity);
    const targetQty = selectedProductCommission.productCommission.targetQuantity;
    if (qty < targetQty) {
      toast.error(`لم تكمل الهدف - الكمية المطلوبة ${targetQty} قطعة وأنت أدخلت ${qty} فقط`);
      return;
    }

    const existingSale = productSales.find((s: any) =>
      s.commissionId === selectedProductCommission.productCommission.commissionId &&
      s.salesDate === achievementShiftDate &&
      s.shiftType === achievementShiftType &&
      s.cashierId === selectedProductCommission.cashierId
    );
    if (existingSale) {
      toast.error("تم تسجيل الإنجاز مسبقاً لهذا التاريخ والشفت - لا يمكن التكرار");
      return;
    }

    setSubmittingAchievement(true);
    try {
      const res = await fetch("/api/smart-incentives/product-commission-achievement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashierId: selectedProductCommission.cashierId,
          commissionId: selectedProductCommission.productCommission.commissionId,
          date: achievementShiftDate,
          shiftType: achievementShiftType,
          quantitySold: qty,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "فشل في تسجيل الإنجاز");
        return;
      }
      if (result.isTargetMet) {
        toast.success(`تم تحقيق الهدف! 🎉 ${result.pointsAwarded > 0 ? `تم منح ${result.pointsAwarded} نقطة` : ''}`);
      }
      refetchProductSales();
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/challenges-as-targets"] });
      setShowProductAchievementDialog(false);
      setAchievedQuantity("");
      setAchievementShiftDate("");
      setAchievementShiftType("");
      setSelectedProductCommission(null);
    } catch (e) {
      toast.error("خطأ في تسجيل الإنجاز");
    } finally {
      setSubmittingAchievement(false);
    }
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
    const found = effectiveUsers.find(u => u.id === cashierId);
    if (found) {
      return `${found.firstName || found.username || ''} ${found.lastName || ''}`.trim() || cashierId;
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

  const setQuickDate = (preset: string) => {
    const now = new Date();
    setDatePreset(preset);
    switch(preset) {
      case 'today':
        setSelectedDate(now.toISOString().split('T')[0]);
        break;
      case 'yesterday': {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        setSelectedDate(yesterday.toISOString().split('T')[0]);
        break;
      }
      case 'week': {
        setSelectedDate(now.toISOString().split('T')[0]);
        break;
      }
      case 'month': {
        setSelectedDate(now.toISOString().split('T')[0]);
        break;
      }
    }
  };

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-4 mb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/targets-dashboard">
                <Button variant="ghost" size="icon" data-testid="button-back" className="h-10 w-10 rounded-xl bg-amber-50 hover:bg-amber-100">
                  <ChevronLeft className="h-5 w-5 text-amber-700" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-amber-900" data-testid="text-page-title">
                  تتبع أداء الكاشير بالشفتات
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {user && (
                    <span className="text-xs text-amber-600 flex items-center gap-1" data-testid="text-cashier-name">
                      <UserIcon className="h-3 w-3" />
                      {user.firstName || user.username || 'الكاشير'} {user.lastName || ''}
                      {selectedBranchData && <span className="text-gray-400">• {selectedBranchData.name}</span>}
                    </span>
                  )}
                  {!user && <p className="text-xs text-muted-foreground">مراقبة الأهداف والأداء لكل كاشير حسب الشفت</p>}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh" className="h-9 text-sm rounded-lg">
                <RefreshCw className="h-4 w-4 ml-1" />
                <span className="hidden sm:inline">تحديث</span>
              </Button>
              <Link href="/incentives-management">
                <Button variant="outline" className="h-9 text-sm rounded-lg bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" data-testid="btn-goto-incentives">
                  <Award className="h-4 w-4 ml-1" />
                  <span className="hidden sm:inline">الحوافز</span>
                </Button>
              </Link>
              <Link href="/targets-planning">
                <Button variant="outline" className="h-9 text-sm rounded-lg" data-testid="btn-goto-targets-planning">
                  <Calendar className="h-4 w-4 ml-1" />
                  <span className="hidden sm:inline">التخطيط</span>
                </Button>
              </Link>
              {canViewAllCashiers && (
                <Link href="/incentives-management">
                  <Button variant="outline" className="h-9 text-sm rounded-lg bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100" data-testid="btn-goto-challenges">
                    <Settings className="h-4 w-4 ml-1" />
                    إدارة التحديات
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        <Card className="border-amber-200 shadow-sm" data-testid="filter-card">
          <CardHeader className="pb-3 bg-gradient-to-l from-amber-50/50 to-transparent">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                <Search className="h-4 w-4" />
                البحث والفلاتر
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => { setSelectedDate(today); setSelectedShift('all'); if(canSelectBranch) setSelectedBranch('all'); setDatePreset('today'); }} className="text-xs text-gray-500 hover:text-red-500" data-testid="btn-reset-filters">
                <X className="h-3 w-3 ml-1" />
                مسح الفلاتر
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: 'today', label: 'اليوم', icon: CalendarDays },
                { key: 'yesterday', label: 'أمس', icon: Clock },
                { key: 'week', label: 'هذا الأسبوع', icon: Calendar },
                { key: 'month', label: 'هذا الشهر', icon: Calendar },
              ].map(p => (
                <Button
                  key={p.key}
                  variant={datePreset === p.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setQuickDate(p.key)}
                  className={`h-8 text-xs ${datePreset === p.key ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
                  data-testid={`btn-date-${p.key}`}
                >
                  <p.icon className="h-3 w-3 ml-1" />
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">التاريخ</Label>
                <Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setDatePreset(''); }} className="h-10" data-testid="input-date" />
              </div>
              {canSelectBranch && (
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">الفرع</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger className="h-10" data-testid="select-filter-branch"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {branches.map((branch) => (<SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">الشفت</Label>
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger className="h-10" data-testid="select-filter-shift"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الشفتات</SelectItem>
                    {SHIFT_TYPES.map((shift) => (<SelectItem key={shift.value} value={shift.value}>{shift.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-md" data-testid="card-total-target">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-100">إجمالي الأهداف</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(summaryStats.totalTarget)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/20">
                  <Target className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-md" data-testid="card-total-achieved">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-100">إجمالي المحقق</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1">{formatCurrency(summaryStats.totalAchieved)}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/20">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-0 shadow-md ${summaryStats.avgPercent >= 100 ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' : summaryStats.avgPercent >= 70 ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white' : 'bg-gradient-to-br from-red-500 to-red-600 text-white'}`} data-testid="card-avg-percent">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-80">نسبة الإنجاز</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1">{summaryStats.avgPercent.toFixed(1)}%</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/20">
                  <BarChartIcon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-0 shadow-md ${summaryStats.alertCount > 0 ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white'}`} data-testid="card-alerts">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs opacity-80">تنبيهات نشطة</p>
                  <p className="text-xl sm:text-2xl font-bold mt-1">{summaryStats.alertCount}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/20">
                  <Bell className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="targets" className="space-y-4">
          <TabsList data-testid="tabs-main" className="flex-wrap h-auto gap-1 bg-amber-50/50 p-1.5 rounded-xl border border-amber-100">
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
            {canViewStatements && (
              <TabsTrigger value="incentive-statements" data-testid="tab-incentive-statements" className="text-xs sm:text-sm">
                <FileText className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                كشف حساب الحوافز
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="targets" className="space-y-4">
            {/* Cashier filter only - branch filter is in main header */}
            {canViewAllCashiers && (
              <div className="flex flex-wrap items-center gap-4 p-3 bg-gradient-to-l from-amber-50 to-gray-50 rounded-lg border border-amber-100">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">تصفية:</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-gray-600">الكاشير:</Label>
                  <Popover open={targetCashierOpen} onOpenChange={setTargetCashierOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" aria-expanded={targetCashierOpen} className="w-56 h-9 text-sm bg-white justify-between font-normal" data-testid="select-targets-cashier">
                        <span className="truncate">
                          {targetCashierId === "all" ? "جميع الكاشيرين" : (() => { const c = reportBranchCashiers.find(u => u.id === targetCashierId); return c ? `${c.firstName || c.username} ${c.lastName || ''}` : "جميع الكاشيرين"; })()}
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="start">
                      <Command shouldFilter={true}>
                        <CommandInput placeholder="ابحث عن كاشير..." data-testid="search-targets-cashier" />
                        <CommandList>
                          <CommandEmpty>لا توجد نتائج</CommandEmpty>
                          <CommandGroup>
                            <CommandItem value="all-cashiers" onSelect={() => { setTargetCashierId("all"); setTargetCashierOpen(false); }}>
                              <Check className={`ml-2 h-4 w-4 ${targetCashierId === "all" ? "opacity-100" : "opacity-0"}`} />
                              جميع الكاشيرين
                            </CommandItem>
                            {reportBranchCashiers.map((c) => (
                              <CommandItem key={c.id} value={`${c.firstName || c.username} ${c.lastName || ''}`} onSelect={() => { setTargetCashierId(c.id); setTargetCashierOpen(false); }}>
                                <Check className={`ml-2 h-4 w-4 ${targetCashierId === c.id ? "opacity-100" : "opacity-0"}`} />
                                {c.firstName || c.username} {c.lastName || ''}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Incentive Points Summary Section - only for admins/managers */}
            {canViewAllCashiers && topCashierPoints.length > 0 && (
              <Card className="border-emerald-200 mb-4" data-testid="incentive-points-summary">
                <CardHeader className="bg-gradient-to-l from-emerald-50 to-transparent pb-3">
                  <CardTitle className="flex items-center gap-2 text-emerald-700">
                    <Star className="h-5 w-5 text-emerald-500" />
                    نقاط الحوافز الذكية - {currentYearMonth}
                  </CardTitle>
                  <CardDescription>نقاط الحوافز المكتسبة للكاشيرين خلال الشهر الحالي</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {topCashierPoints
                      .filter(c => targetCashierId === 'all' || c.cashierId === targetCashierId)
                      .map((cashier) => (
                      <div key={cashier.cashierId} className="border rounded-lg p-3 bg-emerald-50/50 text-center" data-testid={`incentive-card-${cashier.cashierId}`}>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <UserIcon className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-800 truncate">{cashier.cashierName}</span>
                        </div>
                        <div className="text-xs text-gray-500 mb-2">{cashier.branchName}</div>
                        <div className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 text-amber-500" />
                          <span className="text-lg font-bold text-emerald-700">{cashier.totalPoints}</span>
                          <span className="text-xs text-gray-500">نقطة</span>
                        </div>
                        <div className="text-xs text-emerald-600 mt-1">
                          SAR {cashier.totalAmount.toFixed(0)}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {cashier.challengeCount} تحدي
                        </div>
                      </div>
                    ))}
                  </div>
                  {topCashierPoints.filter(c => targetCashierId === 'all' || c.cashierId === targetCashierId).length === 0 && (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      لا توجد نقاط حوافز للكاشير المحدد
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-amber-200">
                <CardHeader className="bg-gradient-to-l from-amber-50 to-transparent pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Sun className="h-5 w-5 text-amber-500" />
                    الشفت الصباحي
                  </CardTitle>
                  <CardDescription>التحديات اليومية والأداء - الفترة الصباحية</CardDescription>
                </CardHeader>
                <CardContent>
                  {shiftTargets.filter(t => t.shiftType === 'morning' && (targetCashierId === 'all' || t.cashierId === targetCashierId)).length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      لم يتم تعيين تحديات يومية للشفت الصباحي
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {shiftTargets.filter(t => t.shiftType === 'morning' && (targetCashierId === 'all' || t.cashierId === targetCashierId)).map((target) => {
                        const actualSales = getCashierActualSales(target.cashierId || '', 'morning');
                        const achieved = actualSales.totalSales;
                        const dailyTarget = Number(target.targetAmount);
                        const dailyTransactions = Number(target.targetTransactions) || 0;
                        const targetTicket = Number(target.targetTicketValue) || 0;
                        const salesPercent = dailyTarget ? (achieved / dailyTarget) * 100 : 0;
                        const transactionsPercent = dailyTransactions ? (actualSales.transactionCount / dailyTransactions) * 100 : 0;
                        const ticketPercent = targetTicket ? (actualSales.averageTicket / targetTicket) * 100 : 0;
                        const availablePercents = [
                          ...(dailyTarget > 0 ? [salesPercent] : []),
                          ...(dailyTransactions > 0 ? [transactionsPercent] : []),
                          ...(targetTicket > 0 ? [ticketPercent] : []),
                        ];
                        const percent = availablePercents.length > 0 ? Math.max(...availablePercents) : 0;
                        const periodType = (target as any).periodType || 'daily';
                        const startDate = (target as any).startDate || target.targetDate;
                        const endDate = (target as any).endDate || target.targetDate;
                        const periodLabel = periodType === 'weekly' ? 'أسبوعي' : periodType === 'monthly' ? 'شهري' : 'يومي';
                        
                        return (
                          <div key={target.id} className="border rounded-md p-2.5 hover:bg-gray-50/50 transition-colors" data-testid={`target-morning-${target.id}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <UserIcon className="h-3.5 w-3.5 text-gray-500" />
                                <span className="text-sm font-medium">{getCashierName(target.cashierId)}</span>
                                {(() => {
                                  const pts = getCashierPoints(target.cashierId || '');
                                  return pts && pts.totalPoints > 0 ? (
                                    <Badge className="bg-emerald-500 text-white text-[9px] h-4 px-1" data-testid={`points-morning-${target.id}`}>
                                      <Star className="h-2.5 w-2.5 ml-0.5" />{pts.totalPoints}
                                    </Badge>
                                  ) : null;
                                })()}
                                {(target as any).challenges && (target as any).challenges.map((ch: any) => (
                                  <Badge key={ch.id} variant="outline" className="text-[9px] h-4 px-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                                    {ch.name}
                                  </Badge>
                                ))}
                              </div>
                              <Badge className={`${ALERT_COLORS[getAlertLevel(percent)].badge} text-[10px] h-5`}>
                                {percent.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="space-y-1.5">
                              {dailyTarget > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 w-16 shrink-0">المبيعات</span>
                                  <Progress value={Math.min(salesPercent, 100)} className="h-1.5 flex-1" />
                                  <span className="text-[10px] text-gray-600 w-28 text-left shrink-0">{formatCurrency(achieved)} / {formatCurrency(dailyTarget)}</span>
                                </div>
                              )}
                              {dailyTransactions > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 w-16 shrink-0">الحركات</span>
                                  <Progress value={Math.min(transactionsPercent, 100)} className="h-1.5 flex-1" />
                                  <span className="text-[10px] text-gray-600 w-28 text-left shrink-0">{actualSales.transactionCount} / {dailyTransactions}</span>
                                </div>
                              )}
                              {targetTicket > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 w-16 shrink-0">م. الفاتورة</span>
                                  <Progress value={Math.min(ticketPercent, 100)} className="h-1.5 flex-1" />
                                  <span className="text-[10px] text-gray-600 w-28 text-left shrink-0">{formatCurrency(actualSales.averageTicket)} / {formatCurrency(targetTicket)}</span>
                                </div>
                              )}
                              {(() => {
                                const excessSales = Math.max(0, achieved - dailyTarget);
                                const { tier, reward } = calculateIncentive(percent, excessSales);
                                if (!tier) return null;
                                return (
                                  <div className="flex items-center justify-between pt-1 border-t border-dashed">
                                    <div className="flex items-center gap-1">
                                      <Trophy className="h-3 w-3 text-amber-500" />
                                      <span className="text-[10px] font-medium text-amber-700">{tier.name}</span>
                                    </div>
                                    <Badge className="bg-green-500 text-white text-[9px] h-4 px-1">
                                      {formatCurrency(reward)}
                                    </Badge>
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

              <Card className="border-indigo-200">
                <CardHeader className="bg-gradient-to-l from-indigo-50 to-transparent pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Moon className="h-5 w-5 text-indigo-500" />
                    الشفت المسائي
                  </CardTitle>
                  <CardDescription>التحديات اليومية والأداء - الفترة المسائية</CardDescription>
                </CardHeader>
                <CardContent>
                  {shiftTargets.filter(t => t.shiftType === 'evening' && (targetCashierId === 'all' || t.cashierId === targetCashierId)).length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      لم يتم تعيين تحديات يومية للشفت المسائي
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {shiftTargets.filter(t => t.shiftType === 'evening' && (targetCashierId === 'all' || t.cashierId === targetCashierId)).map((target) => {
                        const actualSales = getCashierActualSales(target.cashierId || '', 'evening');
                        const achieved = actualSales.totalSales;
                        const dailyTarget = Number(target.targetAmount);
                        const dailyTransactions = Number(target.targetTransactions) || 0;
                        const targetTicket = Number(target.targetTicketValue) || 0;
                        const salesPercent = dailyTarget ? (achieved / dailyTarget) * 100 : 0;
                        const transactionsPercent = dailyTransactions ? (actualSales.transactionCount / dailyTransactions) * 100 : 0;
                        const ticketPercent = targetTicket ? (actualSales.averageTicket / targetTicket) * 100 : 0;
                        const availablePercents = [
                          ...(dailyTarget > 0 ? [salesPercent] : []),
                          ...(dailyTransactions > 0 ? [transactionsPercent] : []),
                          ...(targetTicket > 0 ? [ticketPercent] : []),
                        ];
                        const percent = availablePercents.length > 0 ? Math.max(...availablePercents) : 0;
                        const periodType = (target as any).periodType || 'daily';
                        const startDate = (target as any).startDate || target.targetDate;
                        const endDate = (target as any).endDate || target.targetDate;
                        const periodLabel = periodType === 'weekly' ? 'أسبوعي' : periodType === 'monthly' ? 'شهري' : 'يومي';
                        
                        return (
                          <div key={target.id} className="border rounded-md p-2.5 hover:bg-gray-50/50 transition-colors" data-testid={`target-evening-${target.id}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <UserIcon className="h-3.5 w-3.5 text-gray-500" />
                                <span className="text-sm font-medium">{getCashierName(target.cashierId)}</span>
                                {(() => {
                                  const pts = getCashierPoints(target.cashierId || '');
                                  return pts && pts.totalPoints > 0 ? (
                                    <Badge className="bg-emerald-500 text-white text-[9px] h-4 px-1" data-testid={`points-evening-${target.id}`}>
                                      <Star className="h-2.5 w-2.5 ml-0.5" />{pts.totalPoints}
                                    </Badge>
                                  ) : null;
                                })()}
                                {(target as any).challenges && (target as any).challenges.map((ch: any) => (
                                  <Badge key={ch.id} variant="outline" className="text-[9px] h-4 px-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                                    {ch.name}
                                  </Badge>
                                ))}
                              </div>
                              <Badge className={`${ALERT_COLORS[getAlertLevel(percent)].badge} text-[10px] h-5`}>
                                {percent.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="space-y-1.5">
                              {dailyTarget > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 w-16 shrink-0">المبيعات</span>
                                  <Progress value={Math.min(salesPercent, 100)} className="h-1.5 flex-1" />
                                  <span className="text-[10px] text-gray-600 w-28 text-left shrink-0">{formatCurrency(achieved)} / {formatCurrency(dailyTarget)}</span>
                                </div>
                              )}
                              {dailyTransactions > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 w-16 shrink-0">الحركات</span>
                                  <Progress value={Math.min(transactionsPercent, 100)} className="h-1.5 flex-1" />
                                  <span className="text-[10px] text-gray-600 w-28 text-left shrink-0">{actualSales.transactionCount} / {dailyTransactions}</span>
                                </div>
                              )}
                              {targetTicket > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 w-16 shrink-0">م. الفاتورة</span>
                                  <Progress value={Math.min(ticketPercent, 100)} className="h-1.5 flex-1" />
                                  <span className="text-[10px] text-gray-600 w-28 text-left shrink-0">{formatCurrency(actualSales.averageTicket)} / {formatCurrency(targetTicket)}</span>
                                </div>
                              )}
                              {(() => {
                                const excessSales = Math.max(0, achieved - dailyTarget);
                                const { tier, reward } = calculateIncentive(percent, excessSales);
                                if (!tier) return null;
                                return (
                                  <div className="flex items-center justify-between pt-1 border-t border-dashed">
                                    <div className="flex items-center gap-1">
                                      <Trophy className="h-3 w-3 text-amber-500" />
                                      <span className="text-[10px] font-medium text-amber-700">{tier.name}</span>
                                    </div>
                                    <Badge className="bg-green-500 text-white text-[9px] h-4 px-1">
                                      {formatCurrency(reward)}
                                    </Badge>
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

            {shiftTargets.filter(t => (t as any).productCommission && (targetCashierId === 'all' || t.cashierId === targetCashierId)).length > 0 && (
              <Card className="border-purple-200 mt-6">
                <CardHeader className="bg-gradient-to-l from-purple-50 to-transparent pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-500" />
                    عمولات الأصناف المستهدفة
                  </CardTitle>
                  <CardDescription>أهداف بيع الأصناف المحددة والنقاط المرتبطة</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {shiftTargets
                      .filter(t => (t as any).productCommission && (targetCashierId === 'all' || t.cashierId === targetCashierId))
                      .map((target) => {
                        const pc = (target as any).productCommission;
                        const existingSale = productSales.find((s: any) => s.commissionId === pc.commissionId && s.shiftType === target.shiftType);
                        const soldQty = existingSale?.quantitySold || 0;
                        const progressPercent = pc.targetQuantity > 0 ? (soldQty / pc.targetQuantity) * 100 : 0;
                        const isCompleted = existingSale?.isTargetMet;
                        
                        return (
                          <div
                            key={`pc-${pc.commissionId}-${target.cashierId}-${target.shiftType}`}
                            className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${isCompleted ? 'bg-green-50 border-green-300' : 'bg-white hover:bg-purple-50 border-purple-200'}`}
                            onClick={() => {
                              if (isCompleted) {
                                toast.info("تم تسجيل الإنجاز مسبقاً لهذا الصنف");
                                return;
                              }
                              setSelectedProductCommission(target);
                              setAchievedQuantity("");
                              setAchievementShiftDate(selectedDate);
                              setAchievementShiftType(target.shiftType || "morning");
                              setShowProductAchievementDialog(true);
                            }}
                            data-testid={`product-commission-${pc.commissionId}-${target.cashierId}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <Package className="h-4 w-4 text-purple-500" />
                                <span className="font-medium text-sm">{pc.productName}</span>
                              </div>
                              {isCompleted && (
                                <Badge className="bg-green-500 text-white text-[9px] h-4 px-1">
                                  <CheckCircle2 className="h-2.5 w-2.5 ml-0.5" />محقق
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mb-1">
                              {getCashierName(target.cashierId)} • {target.shiftType === 'morning' ? 'صباحي' : 'مسائي'}
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <Progress value={Math.min(progressPercent, 100)} className="h-2 flex-1" />
                              <span className="text-xs font-mono text-gray-600">{soldQty}/{pc.targetQuantity}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-purple-600">🎯 {pc.pointsOnTarget} نقطة</span>
                              {pc.bonusPointsPerExtra > 0 && (
                                <span className="text-amber-600">+{pc.bonusPointsPerExtra}/قطعة زيادة</span>
                              )}
                            </div>
                            {existingSale?.pointsAwarded > 0 && (
                              <div className="mt-1 text-center">
                                <Badge className="bg-emerald-500 text-white text-[9px]">
                                  <Star className="h-2.5 w-2.5 ml-0.5" />{existingSale.pointsAwarded} نقطة مكتسبة
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}
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
            <Card className="border-blue-200">
              <CardHeader className="pb-3 bg-gradient-to-l from-blue-50 to-transparent">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Receipt className="h-5 w-5 text-blue-600" />
                      تقرير الكاشير التفصيلي
                    </CardTitle>
                    <CardDescription>عرض يوميات كل كاشير حسب الفترة المختارة</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportReportExcel} className="h-8 gap-1.5 text-xs border-green-300 text-green-700 hover:bg-green-50" data-testid="btn-export-excel">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportReportCSV} className="h-8 gap-1.5 text-xs border-blue-300 text-blue-700 hover:bg-blue-50" data-testid="btn-export-csv">
                      <FileText className="h-3.5 w-3.5" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={printReport} className="h-8 gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50" data-testid="btn-print-report">
                      <Printer className="h-3.5 w-3.5" />
                      طباعة
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters - date range and cashier only, branch is in main header */}
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gradient-to-l from-blue-50 to-gray-50 rounded-lg border border-blue-100">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-700">الفترة:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-600">من:</Label>
                    <Input 
                      type="date" 
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-36 h-9 text-sm bg-white"
                      data-testid="input-report-start"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-600">إلى:</Label>
                    <Input 
                      type="date" 
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-36 h-9 text-sm bg-white"
                      data-testid="input-report-end"
                    />
                  </div>
                  {/* Only show cashier filter for users who can view all cashiers */}
                  {canViewAllCashiers && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-600">الكاشير:</Label>
                      <Popover open={reportCashierOpen} onOpenChange={setReportCashierOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" role="combobox" aria-expanded={reportCashierOpen} className="w-56 h-9 text-sm bg-white justify-between font-normal" data-testid="select-report-cashier">
                            <span className="truncate">
                              {reportCashierId === "all" ? "جميع الكاشيرين" : (() => { const c = reportBranchCashiers.find(u => u.id === reportCashierId); return c ? `${c.firstName || c.username} ${c.lastName || ''}` : "جميع الكاشيرين"; })()}
                            </span>
                            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          <Command shouldFilter={true}>
                            <CommandInput placeholder="ابحث عن كاشير..." data-testid="search-report-cashier" />
                            <CommandList>
                              <CommandEmpty>لا توجد نتائج</CommandEmpty>
                              <CommandGroup>
                                <CommandItem value="all-cashiers-report" onSelect={() => { setReportCashierId("all"); setReportCashierOpen(false); }}>
                                  <Check className={`ml-2 h-4 w-4 ${reportCashierId === "all" ? "opacity-100" : "opacity-0"}`} />
                                  جميع الكاشيرين
                                </CommandItem>
                                {reportBranchCashiers.map((c) => (
                                  <CommandItem key={c.id} value={`${c.firstName || c.username} ${c.lastName || ''}`} onSelect={() => { setReportCashierId(c.id); setReportCashierOpen(false); }}>
                                    <Check className={`ml-2 h-4 w-4 ${reportCashierId === c.id ? "opacity-100" : "opacity-0"}`} />
                                    {c.firstName || c.username} {c.lastName || ''}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                  {journalsLoading && (
                    <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                  )}
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
            <Card className="border-purple-200">
              <CardHeader className="pb-3 bg-gradient-to-l from-purple-50 to-transparent">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Trophy className="h-5 w-5 text-purple-600" />
                      {canViewAllCashiers ? 'نسبة مساهمة الكاشير من المبيعات' : 'نسبة مساهمتي من المبيعات'}
                    </CardTitle>
                    <CardDescription>
                      {canViewAllCashiers 
                        ? 'قياس مساهمة كل كاشير من إجمالي مبيعات الفرع للفترة المختارة'
                        : 'نسبة مساهمتك في إجمالي مبيعات الفرع للفترة المختارة'
                      }
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Date Filters only - branch filter is in main header */}
                <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-gradient-to-l from-purple-50 to-gray-50 rounded-lg border border-purple-100">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium text-purple-700">الفترة:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-600">من:</Label>
                    <Input 
                      type="date" 
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-36 h-9 text-sm bg-white"
                      data-testid="input-contribution-start"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-gray-600">إلى:</Label>
                    <Input 
                      type="date" 
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-36 h-9 text-sm bg-white"
                      data-testid="input-contribution-end"
                    />
                  </div>
                </div>

                {/* Summary Cards - Different view for regular cashiers */}
                {canViewAllCashiers ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl text-center border border-blue-200 shadow-sm">
                      <DollarSign className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs text-blue-600 font-medium">إجمالي المبيعات</p>
                      <p className="text-xl font-bold text-blue-700">
                        {formatCurrency(contributionData.reduce((s, c) => s + c.totalSales, 0))}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl text-center border border-green-200 shadow-sm">
                      <Users className="h-6 w-6 text-green-600 mx-auto mb-1" />
                      <p className="text-xs text-green-600 font-medium">عدد الكاشيرين</p>
                      <p className="text-xl font-bold text-green-700">{contributionData.length}</p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl text-center border border-amber-200 shadow-sm">
                      <Receipt className="h-6 w-6 text-amber-600 mx-auto mb-1" />
                      <p className="text-xs text-amber-600 font-medium">عدد الحركات</p>
                      <p className="text-xl font-bold text-amber-700">
                        {contributionData.reduce((s, c) => s + c.transactionCount, 0)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl text-center border border-purple-200 shadow-sm">
                      <Calendar className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                      <p className="text-xs text-purple-600 font-medium">الفترة</p>
                      <p className="text-sm font-bold text-purple-700">{reportStartDate}</p>
                      <p className="text-sm font-bold text-purple-700">{reportEndDate}</p>
                    </div>
                  </div>
                ) : (
                  /* For regular cashiers - show contribution % and transaction count only (no sales amounts to protect branch total) */
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {contributionData.length > 0 && (
                      <>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl text-center border border-purple-200 shadow-sm">
                          <Trophy className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                          <p className="text-xs text-purple-600 font-medium">نسبة مساهمتي من الفرع</p>
                          <p className="text-3xl font-bold text-purple-700">
                            {contributionData[0]?.contributionPercent?.toFixed(1) || 0}%
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl text-center border border-amber-200 shadow-sm">
                          <Receipt className="h-6 w-6 text-amber-600 mx-auto mb-1" />
                          <p className="text-xs text-amber-600 font-medium">عدد حركاتي</p>
                          <p className="text-xl font-bold text-amber-700">
                            {contributionData[0]?.transactionCount || 0}
                          </p>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl text-center border border-green-200 shadow-sm">
                          <Calendar className="h-6 w-6 text-green-600 mx-auto mb-1" />
                          <p className="text-xs text-green-600 font-medium">الفترة</p>
                          <p className="text-sm font-bold text-green-700">{reportStartDate}</p>
                          <p className="text-sm font-bold text-green-700">{reportEndDate}</p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Contribution Chart & Table - Only for managers */}
                {contributionData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>لا توجد بيانات للفترة المختارة</p>
                  </div>
                ) : canViewAllCashiers ? (
                  <div className="space-y-6">
                    {/* Pie Chart with Legend Grid */}
                    <div className="flex flex-col lg:flex-row items-start gap-6">
                      <div className="h-72 w-full lg:w-1/2 flex-shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={contributionData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={100}
                              paddingAngle={2}
                              dataKey="contributionPercent"
                              nameKey="cashierName"
                              label={false}
                            >
                              {contributionData.map((_, i) => (
                                <Cell key={i} fill={['#8B4513', '#D4A574', '#CD853F', '#A0522D', '#DEB887', '#F5DEB3', '#C4A882', '#966F33', '#B8860B', '#DAA520'][i % 10]} />
                              ))}
                            </Pie>
                            <RechartsTooltip 
                              formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
                              contentStyle={{ direction: 'rtl', fontFamily: 'Cairo, sans-serif', fontSize: '13px' }}
                              labelStyle={{ fontWeight: 'bold' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-full lg:w-1/2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm self-center">
                        {contributionData.map((c, i) => (
                          <div key={c.cashierId} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50" data-testid={`legend-item-${c.cashierId}`}>
                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: ['#8B4513', '#D4A574', '#CD853F', '#A0522D', '#DEB887', '#F5DEB3', '#C4A882', '#966F33', '#B8860B', '#DAA520'][i % 10] }} />
                            <span className="truncate text-xs text-gray-700 flex-1">{c.cashierName}</span>
                            <span className="font-bold text-xs text-amber-700 flex-shrink-0">{c.contributionPercent.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
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
                ) : (
                  /* Simple view for regular cashiers - just their contribution visualization */
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="relative w-40 h-40 mb-4">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="#e5e7eb"
                          strokeWidth="12"
                          fill="none"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="#8B4513"
                          strokeWidth="12"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${(contributionData[0]?.contributionPercent || 0) * 2.51} 251`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-amber-700">
                          {contributionData[0]?.contributionPercent?.toFixed(1) || 0}%
                        </span>
                        <span className="text-xs text-gray-500">نسبة مساهمتي</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      مساهمتك في إجمالي مبيعات الفرع للفترة المحددة
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="incentive-statements" className="space-y-4">
            {!canViewAllCashiers ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-amber-600" />
                      كشف حساب حوافزي
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      ملخص التحديات والنقاط المحققة خلال الفترة المحددة
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-gradient-to-l from-amber-50 to-gray-50 rounded-lg border border-amber-100">
                      <div>
                        <Label className="text-xs font-bold">من تاريخ</Label>
                        <Input type="date" value={stmtPeriodFrom} onChange={(e) => setStmtPeriodFrom(e.target.value)} className="h-9 text-xs" data-testid="input-my-stmt-from" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold">إلى تاريخ</Label>
                        <Input type="date" value={stmtPeriodTo} onChange={(e) => setStmtPeriodTo(e.target.value)} className="h-9 text-xs" data-testid="input-my-stmt-to" />
                      </div>
                      <Button variant="outline" size="sm" onClick={exportMyIncentivePDF} disabled={!myIncentiveSummary || loadingMyIncentive} className="h-9 text-xs gap-1" data-testid="button-export-my-incentive-pdf">
                        <Download className="h-3.5 w-3.5 text-red-600" />
                        تصدير PDF
                      </Button>
                    </div>

                    {loadingMyIncentive ? (
                      <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
                    ) : !myIncentiveSummary ? (
                      <div className="text-center py-8 text-muted-foreground">لا توجد بيانات</div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                            <p className="text-[10px] text-emerald-600 font-medium">إجمالي النقاط</p>
                            <p className="text-xl font-bold text-emerald-700" data-testid="text-total-points">{myIncentiveSummary.totals.totalPoints}</p>
                            <p className="text-[10px] text-emerald-500">نقطة</p>
                          </div>
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                            <p className="text-[10px] text-amber-600 font-medium">القيمة بالريال</p>
                            <p className="text-xl font-bold text-amber-700" data-testid="text-total-amount">{myIncentiveSummary.totals.totalAmount.toFixed(2)}</p>
                            <p className="text-[10px] text-amber-500">ر.س</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                            <p className="text-[10px] text-blue-600 font-medium">معتمدة</p>
                            <p className="text-xl font-bold text-blue-700" data-testid="text-approved-amount">{myIncentiveSummary.totals.approvedAmount.toFixed(2)}</p>
                            <p className="text-[10px] text-blue-500">ر.س</p>
                          </div>
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                            <p className="text-[10px] text-purple-600 font-medium">مصروفة</p>
                            <p className="text-xl font-bold text-purple-700" data-testid="text-paid-amount">{myIncentiveSummary.totals.paidAmount.toFixed(2)}</p>
                            <p className="text-[10px] text-purple-500">ر.س</p>
                          </div>
                        </div>

                        {myIncentiveSummary.challenges.length > 0 && (
                          <Card className="border-amber-200">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Target className="h-4 w-4 text-amber-600" />
                                التحديات المعينة لك حالياً
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {myIncentiveSummary.challenges.map(ch => (
                                  <div key={ch.id} className="flex items-center justify-between p-2 bg-amber-50/50 rounded-md border border-amber-100" data-testid={`my-challenge-${ch.id}`}>
                                    <div>
                                      <span className="text-xs font-medium">{ch.name}</span>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                                          {ch.challengeType === 'avg_ticket' ? 'متوسط فاتورة' : ch.challengeType === 'customer_count' ? 'عدد العملاء' : 'مبيعات'}
                                        </Badge>
                                        <span className="text-[10px] text-gray-500">
                                          الهدف: {ch.targetValue} {ch.challengeType === 'customer_count' ? 'عميل' : 'ر.س'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-left">
                                      <Badge className="bg-amber-500 text-white text-[10px]">{ch.basePoints} نقطة</Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-amber-600" />
                              سجل الأداء اليومي
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {myIncentiveSummary.dailyDetails.length === 0 ? (
                              <div className="text-center py-6 text-muted-foreground text-sm">
                                لا توجد بيانات في الفترة المحددة
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {myIncentiveSummary.dailyDetails.map(day => (
                                  <div key={day.date} className="border rounded-lg overflow-hidden" data-testid={`day-summary-${day.date}`}>
                                    <div className="flex items-center justify-between p-2.5 bg-gradient-to-l from-gray-50 to-white">
                                      <div className="flex items-center gap-2">
                                        <CalendarDays className="h-3.5 w-3.5 text-gray-500" />
                                        <span className="text-sm font-medium">{new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                      </div>
                                      {day.totalPoints > 0 && (
                                        <div className="flex items-center gap-2">
                                          <Badge className="bg-emerald-500 text-white text-[10px]">
                                            <Star className="h-2.5 w-2.5 ml-0.5" />{day.totalPoints} نقطة
                                          </Badge>
                                          <Badge className="bg-amber-500 text-white text-[10px]">
                                            {day.totalAmount.toFixed(2)} ر.س
                                          </Badge>
                                        </div>
                                      )}
                                    </div>
                                    {day.challenges.length > 0 && (
                                      <div className="px-3 py-2 bg-gray-50/50 border-t">
                                        <p className="text-[10px] text-gray-500 font-medium mb-1.5">التحديات والإنجاز</p>
                                        <div className="space-y-1.5">
                                          {day.challenges.map((ch, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-xs">
                                              <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${ch.achieved ? 'bg-green-500' : 'bg-red-400'}`}></span>
                                                <span className="text-gray-700">{ch.name}</span>
                                                <Badge variant="outline" className="text-[9px] h-4 px-1">
                                                  {ch.type === 'avg_ticket' ? 'متوسط فاتورة' : ch.type === 'customer_count' ? 'عدد العملاء' : 'مبيعات'}
                                                </Badge>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-500">
                                                  {ch.actualValue.toFixed(ch.type === 'customer_count' ? 0 : 2)} / {ch.targetValue.toFixed(ch.type === 'customer_count' ? 0 : 2)}
                                                </span>
                                                <span className={`font-bold text-xs min-w-[40px] text-left ${ch.achievementPercent >= 100 ? 'text-green-600' : ch.achievementPercent >= 75 ? 'text-amber-600' : 'text-red-500'}`}>
                                                  {ch.achievementPercent}%
                                                </span>
                                                {ch.achieved ? (
                                                  <Badge className="bg-green-100 text-green-700 border-green-200 text-[9px] h-4 px-1">{ch.basePoints} نقطة</Badge>
                                                ) : (
                                                  <Badge variant="outline" className="text-gray-400 text-[9px] h-4 px-1">لم يتحقق</Badge>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {day.ledgerEntries.length > 0 && (
                                      <div className="divide-y border-t">
                                        {day.ledgerEntries.map((entry, idx) => (
                                          <div key={idx} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-gray-50/50">
                                            <div className="flex items-center gap-2">
                                              <span className={`w-1.5 h-1.5 rounded-full ${entry.status === 'paid' ? 'bg-green-500' : entry.status === 'approved' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                                              <span className="text-gray-700">{entry.sourceName || (() => {
                                                switch(entry.pointsType) {
                                                  case 'challenge_avg_ticket': return 'تحدي متوسط الفاتورة';
                                                  case 'challenge_customers': return 'تحدي عدد العملاء';
                                                  case 'challenge_sales': return 'تحدي المبيعات';
                                                  case 'product_commission': return 'عمولة منتج';
                                                  case 'branch_bonus': return 'مكافأة فرع';
                                                  default: return entry.pointsType;
                                                }
                                              })()}</span>
                                              {entry.shiftType && (
                                                <Badge variant="outline" className="text-[9px] h-3.5 px-1">
                                                  {entry.shiftType === 'morning' ? 'صباحي' : 'مسائي'}
                                                </Badge>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <span className="text-emerald-600 font-medium">+{entry.pointsEarned}</span>
                                              <span className="text-amber-600 font-medium w-16 text-left">{entry.amountEarned.toFixed(2)} ر.س</span>
                                              <Badge variant="outline" className={`text-[9px] h-4 px-1 ${entry.status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : entry.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                {entry.status === 'paid' ? 'مصروف' : entry.status === 'approved' ? 'معتمد' : 'مكتسب'}
                                              </Badge>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-amber-600" />
                      كشف حساب حوافز الكاشير
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      إنشاء ومراجعة واعتماد كشوفات حوافز الكاشير للصرف
                    </CardDescription>
                  </div>
                  {stmtViewMode === 'detail' && (
                    <Button variant="outline" size="sm" onClick={() => { setStmtViewMode('list'); setSelectedStatement(null); }}>
                      <ChevronLeft className="h-4 w-4 ml-1" />
                      العودة للقائمة
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {stmtViewMode === 'list' ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-l from-amber-50 to-gray-50 rounded-lg border border-amber-100 p-3 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs font-bold">من تاريخ</Label>
                          <Input type="date" value={stmtPeriodFrom} onChange={(e) => setStmtPeriodFrom(e.target.value)} className="h-9 text-xs" data-testid="input-stmt-from" />
                        </div>
                        <div>
                          <Label className="text-xs font-bold">إلى تاريخ</Label>
                          <Input type="date" value={stmtPeriodTo} onChange={(e) => setStmtPeriodTo(e.target.value)} className="h-9 text-xs" data-testid="input-stmt-to" />
                        </div>
                        <div>
                          <Label className="text-xs font-bold">الكاشير</Label>
                          {!canViewAllCashiers ? (
                            <Input
                              value={getCashierName(stmtCashierId)}
                              disabled
                              className="h-9 text-xs bg-gray-50"
                              data-testid="select-stmt-cashier"
                            />
                          ) : (
                            <Popover open={stmtCashierOpen} onOpenChange={setStmtCashierOpen}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={stmtCashierOpen} className="w-full h-9 text-xs bg-white justify-between font-normal" data-testid="select-stmt-cashier">
                                  {stmtCashierId ? (() => { const c = reportBranchCashiers.find((c: any) => c.id === stmtCashierId); return c ? `${c.firstName || c.username || c.id} ${c.lastName || ''}` : "اختر الكاشير"; })() : "اختر الكاشير"}
                                  <ChevronsUpDown className="mr-2 h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-0" align="start">
                                <Command shouldFilter={true}>
                                  <CommandInput placeholder="ابحث عن كاشير..." data-testid="search-stmt-cashier" />
                                  <CommandList>
                                    <CommandEmpty>لا توجد نتائج</CommandEmpty>
                                    <CommandGroup>
                                      {reportBranchCashiers.map((c: any) => (
                                        <CommandItem key={c.id} value={`${c.firstName || c.username} ${c.lastName || ''}`} onSelect={() => { setStmtCashierId(c.id); setStmtCashierOpen(false); }}>
                                          <Check className={`ml-2 h-3 w-3 ${stmtCashierId === c.id ? "opacity-100" : "opacity-0"}`} />
                                          {c.firstName || c.username || c.id} {c.lastName || ''}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                        <div className="flex items-end gap-2">
                          {canCreateStatements && (
                            <Button onClick={handleCreateStatement} disabled={createStatementMutation.isPending || !stmtCashierId || !selectedBranch || selectedBranch === "all"} className="bg-amber-600 hover:bg-amber-700 h-9 text-xs flex-1" data-testid="button-create-statement">
                              {createStatementMutation.isPending ? "جاري الإنشاء..." : "إنشاء كشف"}
                            </Button>
                          )}
                        </div>
                      </div>
                      {stmtCashierId && (
                        <div>
                          <Label className="text-xs">ملاحظات (اختياري)</Label>
                          <Input value={stmtNotes} onChange={(e) => setStmtNotes(e.target.value)} placeholder="ملاحظات إضافية على الكشف..." className="h-8 text-xs" />
                        </div>
                      )}
                    </div>

                    {loadingStatements ? (
                      <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                    ) : incentiveStatements.length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">لا توجد كشوفات حوافز بعد</p>
                        <p className="text-gray-400 text-xs mt-1">اختر الكاشير والفترة ثم اضغط "إنشاء كشف"</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-right text-xs font-bold">رقم الكشف</TableHead>
                              <TableHead className="text-right text-xs font-bold">الكاشير</TableHead>
                              <TableHead className="text-right text-xs font-bold">الفترة</TableHead>
                              <TableHead className="text-center text-xs font-bold">النقاط</TableHead>
                              <TableHead className="text-center text-xs font-bold">المبلغ</TableHead>
                              <TableHead className="text-center text-xs font-bold">القيود</TableHead>
                              <TableHead className="text-center text-xs font-bold">الحالة</TableHead>
                              <TableHead className="text-center text-xs font-bold">إجراءات</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {incentiveStatements.map((stmt: any) => {
                              const statusInfo = getStmtStatusInfo(stmt.status);
                              return (
                                <TableRow key={stmt.id} className="hover:bg-amber-50/30 cursor-pointer" onClick={() => { setSelectedStatement(stmt); setStmtViewMode('detail'); }}>
                                  <TableCell className="text-xs font-mono font-bold text-amber-700">{stmt.statementNumber}</TableCell>
                                  <TableCell className="text-xs">{getCashierName(stmt.cashierId)}</TableCell>
                                  <TableCell className="text-xs">{stmt.periodFrom} → {stmt.periodTo}</TableCell>
                                  <TableCell className="text-center text-xs font-bold">{stmt.totalPoints}</TableCell>
                                  <TableCell className="text-center text-xs font-bold text-green-700">{stmt.totalAmount?.toFixed(2)} ر.س</TableCell>
                                  <TableCell className="text-center text-xs">{stmt.entriesCount}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge className={`text-[10px] ${statusInfo.color}`}>{statusInfo.icon} {statusInfo.label}</Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleExportStatementExcel(stmt)} title="تصدير Excel" data-testid={`button-export-stmt-${stmt.id}`}>
                                        <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                                      </Button>
                                      {stmt.status === 'draft' && canCreateStatements && (
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => updateStatementStatusMutation.mutate({ id: stmt.id, status: 'submitted' })} title="تقديم للاعتماد" data-testid={`button-submit-stmt-${stmt.id}`}>
                                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                                        </Button>
                                      )}
                                      {stmt.status === 'submitted' && canApproveStatements && (
                                        <>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => updateStatementStatusMutation.mutate({ id: stmt.id, status: 'approved' })} title="اعتماد" data-testid={`button-approve-stmt-${stmt.id}`}>
                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                          </Button>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setRejectingStmtId(stmt.id); setShowRejectDialog(true); }} title="رفض" data-testid={`button-reject-stmt-${stmt.id}`}>
                                            <X className="h-3.5 w-3.5 text-red-600" />
                                          </Button>
                                        </>
                                      )}
                                      {stmt.status === 'approved' && canApproveStatements && (
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => updateStatementStatusMutation.mutate({ id: stmt.id, status: 'paid' })} title="صرف" data-testid={`button-pay-stmt-${stmt.id}`}>
                                          <DollarSign className="h-3.5 w-3.5 text-purple-600" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ) : selectedStatement ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-l from-amber-50 to-white border border-amber-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-lg text-amber-800">{selectedStatement.statementNumber}</h3>
                          <p className="text-xs text-gray-500">تاريخ الإنشاء: {new Date(selectedStatement.createdAt).toLocaleDateString('en-US')}</p>
                        </div>
                        <Badge className={`text-sm px-3 py-1 ${getStmtStatusInfo(selectedStatement.status).color}`}>
                          {getStmtStatusInfo(selectedStatement.status).icon} {getStmtStatusInfo(selectedStatement.status).label}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-white rounded p-2 border">
                          <span className="text-gray-500">الكاشير:</span>
                          <p className="font-bold">{getCashierName(selectedStatement.cashierId)}</p>
                        </div>
                        <div className="bg-white rounded p-2 border">
                          <span className="text-gray-500">الفرع:</span>
                          <p className="font-bold">{branches?.find((b: any) => b.id === selectedStatement.branchId)?.name || selectedStatement.branchId}</p>
                        </div>
                        <div className="bg-white rounded p-2 border">
                          <span className="text-gray-500">الفترة:</span>
                          <p className="font-bold">{selectedStatement.periodFrom} → {selectedStatement.periodTo}</p>
                        </div>
                        <div className="bg-white rounded p-2 border">
                          <span className="text-gray-500">عدد القيود:</span>
                          <p className="font-bold">{selectedStatement.entriesCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-amber-700">إجمالي النقاط</p>
                        <p className="text-xl font-bold text-amber-800">{selectedStatement.totalPoints}</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-green-700">إجمالي المبلغ</p>
                        <p className="text-xl font-bold text-green-800">{selectedStatement.totalAmount?.toFixed(2)} <span className="text-xs">ر.س</span></p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-blue-700">تحديات يومية</p>
                        <p className="text-lg font-bold text-blue-800">{selectedStatement.dailyChallengePoints || 0}</p>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-purple-700">عمولات أصناف</p>
                        <p className="text-lg font-bold text-purple-800">{selectedStatement.productCommissionPoints || 0}</p>
                      </div>
                      <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 text-center">
                        <p className="text-[10px] text-pink-700">مكافآت فرع</p>
                        <p className="text-lg font-bold text-pink-800">{selectedStatement.branchBonusPoints || 0}</p>
                      </div>
                    </div>

                    {(() => {
                      const data = selectedStatement.statementData ? JSON.parse(selectedStatement.statementData) : null;
                      if (!data || !data.entries) return <p className="text-center text-gray-500 py-4 text-sm">لا توجد بيانات تفصيلية</p>;
                      return (
                        <div className="overflow-x-auto border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50">
                                <TableHead className="text-right text-xs font-bold w-10">#</TableHead>
                                <TableHead className="text-right text-xs font-bold">التاريخ</TableHead>
                                <TableHead className="text-center text-xs font-bold">الشفت</TableHead>
                                <TableHead className="text-right text-xs font-bold">النوع</TableHead>
                                <TableHead className="text-right text-xs font-bold">المصدر</TableHead>
                                <TableHead className="text-center text-xs font-bold">النقاط</TableHead>
                                <TableHead className="text-center text-xs font-bold">المبلغ (ر.س)</TableHead>
                                <TableHead className="text-right text-xs font-bold">ملاحظات</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.entries.map((entry: any, idx: number) => (
                                <TableRow key={idx} className="hover:bg-amber-50/20">
                                  <TableCell className="text-xs text-gray-500">{idx + 1}</TableCell>
                                  <TableCell className="text-xs">{entry.date}</TableCell>
                                  <TableCell className="text-center text-xs">
                                    {entry.shiftType === 'morning' ? '☀️ صباحي' : entry.shiftType === 'evening' ? '🌙 مسائي' : '-'}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <Badge variant="outline" className="text-[10px]">{getPointsTypeLabel(entry.type)}</Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">{entry.source || '-'}</TableCell>
                                  <TableCell className="text-center text-xs font-bold text-amber-700">{entry.points}</TableCell>
                                  <TableCell className="text-center text-xs font-bold text-green-700">{entry.amount?.toFixed(2)}</TableCell>
                                  <TableCell className="text-xs text-gray-500 max-w-[150px] truncate">{entry.notes || '-'}</TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-amber-50 font-bold">
                                <TableCell colSpan={5} className="text-left text-xs">الإجمالي</TableCell>
                                <TableCell className="text-center text-xs text-amber-800">{data.summary.totalPoints}</TableCell>
                                <TableCell className="text-center text-xs text-green-800">{data.summary.totalAmount?.toFixed(2)}</TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })()}

                    {selectedStatement.notes && (
                      <div className="bg-gray-50 rounded-lg p-3 border text-xs">
                        <span className="font-bold">ملاحظات: </span>{selectedStatement.notes}
                      </div>
                    )}
                    {selectedStatement.rejectionReason && (
                      <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-xs text-red-700">
                        <span className="font-bold">سبب الرفض: </span>{selectedStatement.rejectionReason}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 justify-center pt-2 border-t">
                      <Button variant="outline" size="sm" onClick={() => handleExportStatementExcel(selectedStatement)} className="text-xs" data-testid="button-detail-export-excel">
                        <FileSpreadsheet className="h-3.5 w-3.5 ml-1 text-green-600" />
                        تصدير Excel
                      </Button>
                      {selectedStatement.status === 'draft' && canCreateStatements && (
                        <Button size="sm" className="text-xs bg-blue-600 hover:bg-blue-700" onClick={() => updateStatementStatusMutation.mutate({ id: selectedStatement.id, status: 'submitted' })} data-testid="button-detail-submit">
                          <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
                          تقديم للاعتماد
                        </Button>
                      )}
                      {selectedStatement.status === 'submitted' && canApproveStatements && (
                        <>
                          <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700" onClick={() => updateStatementStatusMutation.mutate({ id: selectedStatement.id, status: 'approved' })} data-testid="button-detail-approve">
                            <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
                            اعتماد الكشف
                          </Button>
                          <Button size="sm" variant="destructive" className="text-xs" onClick={() => { setRejectingStmtId(selectedStatement.id); setShowRejectDialog(true); }} data-testid="button-detail-reject">
                            <X className="h-3.5 w-3.5 ml-1" />
                            رفض
                          </Button>
                        </>
                      )}
                      {selectedStatement.status === 'approved' && canApproveStatements && (
                        <Button size="sm" className="text-xs bg-purple-600 hover:bg-purple-700" onClick={() => updateStatementStatusMutation.mutate({ id: selectedStatement.id, status: 'paid' })} data-testid="button-detail-pay">
                          <DollarSign className="h-3.5 w-3.5 ml-1" />
                          تأكيد الصرف
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={showProductAchievementDialog} onOpenChange={setShowProductAchievementDialog}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-500" />
                تسجيل إنجاز صنف
              </DialogTitle>
            </DialogHeader>
            {selectedProductCommission && (
              <div className="space-y-4">
                <div className="bg-purple-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{selectedProductCommission.productCommission.productName}</span>
                    <Badge variant="outline" className="text-xs">{selectedProductCommission.productCommission.commissionType === 'weekly_product' ? 'أسبوعي' : selectedProductCommission.productCommission.commissionType === 'monthly_product' ? 'شهري' : 'جديد'}</Badge>
                  </div>
                  <div className="text-xs text-gray-600">
                    الكاشير: {getCashierName(selectedProductCommission.cashierId)}
                  </div>
                  <div className="text-xs text-gray-600">
                    الهدف: {selectedProductCommission.productCommission.targetQuantity} قطعة
                  </div>
                  <div className="text-xs text-purple-700">
                    🎯 {selectedProductCommission.productCommission.pointsOnTarget} نقطة عند تحقيق الهدف
                    {selectedProductCommission.productCommission.bonusPointsPerExtra > 0 && ` + ${selectedProductCommission.productCommission.bonusPointsPerExtra} نقطة لكل قطعة إضافية`}
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <p className="text-xs text-amber-800 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    يتم إدخال الأصناف نهاية الشفت فقط - مرة واحدة لكل تاريخ وشفت
                  </p>
                  <p className="text-[10px] text-amber-700 mt-1">لا يتم تسجيل الإنجاز إذا كانت الكمية أقل من الهدف المحدد</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold">تاريخ الشفت</Label>
                    <Input
                      type="date"
                      value={achievementShiftDate}
                      onChange={(e) => setAchievementShiftDate(e.target.value)}
                      className="h-10 text-sm"
                      data-testid="input-achievement-date"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold">نوع الشفت</Label>
                    <Select value={achievementShiftType} onValueChange={setAchievementShiftType}>
                      <SelectTrigger className="h-10" data-testid="select-achievement-shift">
                        <SelectValue placeholder="اختر الشفت" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">صباحي</SelectItem>
                        <SelectItem value="evening">مسائي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold">الكمية المباعة</Label>
                  <Input
                    type="number"
                    value={achievedQuantity}
                    onChange={(e) => setAchievedQuantity(e.target.value)}
                    placeholder={`الهدف: ${selectedProductCommission.productCommission.targetQuantity}`}
                    className="h-11 sm:h-10 text-center text-lg font-bold"
                    min="0"
                    data-testid="input-achieved-quantity"
                  />
                  {achievedQuantity && parseInt(achievedQuantity) >= selectedProductCommission.productCommission.targetQuantity && (
                    <p className="text-green-600 text-xs mt-1 text-center font-medium">✅ الهدف محقق!</p>
                  )}
                  {achievedQuantity && parseInt(achievedQuantity) > 0 && parseInt(achievedQuantity) < selectedProductCommission.productCommission.targetQuantity && (
                    <p className="text-red-600 text-xs mt-1 text-center font-medium">❌ لم تكمل الهدف - يجب بيع {selectedProductCommission.productCommission.targetQuantity} قطعة على الأقل</p>
                  )}
                </div>

                {achievementShiftDate && (
                  <div className="text-center text-xs text-gray-500 bg-gray-50 rounded p-1.5">
                    📅 التاريخ: {achievementShiftDate} • {achievementShiftType === 'morning' ? '☀️ صباحي' : '🌙 مسائي'}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                onClick={handleSubmitProductAchievement}
                disabled={
                  submittingAchievement ||
                  !achievedQuantity ||
                  !achievementShiftDate ||
                  !achievementShiftType ||
                  parseInt(achievedQuantity) < (selectedProductCommission?.productCommission?.targetQuantity || 0)
                }
                className="bg-purple-600 hover:bg-purple-700 w-full"
                data-testid="button-submit-achievement"
              >
                {submittingAchievement ? "جاري التسجيل..." : "تسجيل الإنجاز"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                رفض كشف الحوافز
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label className="text-xs font-bold">سبب الرفض</Label>
              <Input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="أدخل سبب الرفض..."
                className="h-10"
                data-testid="input-rejection-reason"
              />
            </div>
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={() => {
                  if (rejectingStmtId) {
                    updateStatementStatusMutation.mutate({ id: rejectingStmtId, status: 'rejected', rejectionReason });
                  }
                }}
                disabled={!rejectionReason.trim()}
                className="w-full"
                data-testid="button-confirm-reject"
              >
                تأكيد الرفض
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
