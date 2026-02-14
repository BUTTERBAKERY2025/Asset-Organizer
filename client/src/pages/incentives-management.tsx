import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useBranches } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import {
  Gift, Award, DollarSign, Settings, ChevronLeft, Calculator, Check, X, Plus,
  FileSpreadsheet, FileText, ArrowRight, Wallet, Target, Trophy, Star,
  Trash2, TrendingUp, Users, Calendar, Eye, Pencil, RefreshCw, MoreVertical
} from "lucide-react";
import { Link } from "wouter";
import * as XLSX from "xlsx";
import type {
  Branch, IncentiveTier, IncentiveAward,
  CashierDailyChallenge, ProductCommission, BranchAchievementBonus,
  CashierPointsLedger, PointSettings
} from "@shared/schema";

const REWARD_TYPE_LABELS: Record<string, string> = {
  fixed: "مبلغ ثابت",
  percentage: "نسبة مئوية",
  both: "ثابت + نسبة",
};

const AWARD_STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  approved: "معتمد",
  paid: "مدفوع",
  cancelled: "ملغى",
  earned: "مكتسب",
};

const AWARD_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  approved: "bg-blue-500",
  paid: "bg-green-500",
  cancelled: "bg-gray-500",
  earned: "bg-emerald-500",
};

const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  avg_ticket: "متوسط الفاتورة",
  customer_count: "عدد العملاء",
  shift_sales: "مبيعات الشفت",
};

const COMMISSION_TYPE_LABELS: Record<string, string> = {
  weekly_product: "صنف الأسبوع",
  monthly_product: "صنف الشهر",
  new_product: "صنف جديد",
};

const POINTS_TYPE_LABELS: Record<string, string> = {
  challenge_avg_ticket: "تحدي متوسط الفاتورة",
  challenge_customers: "تحدي عدد العملاء",
  challenge_sales: "تحدي المبيعات",
  product_commission: "عمولة صنف",
  branch_bonus: "مكافأة فرع",
};

interface CalculatedAward {
  branchId: string;
  branchName: string;
  targetAmount: number;
  achievedAmount: number;
  achievementPercent: number;
  tierName: string;
  tierId: number;
  calculatedReward: number;
  status: string;
}

export default function IncentivesManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { branches, canSelectBranch } = useBranches();
  const { canView, canCreate, canEdit, canDelete, canApprove } = usePermissions();
  const { isAdmin } = useAuth();

  const getDefaultTab = () => {
    if (isAdmin || canView("smart_incentives_settings")) return "point-settings";
    if (isAdmin || canView("smart_incentives_challenges")) return "challenges";
    if (isAdmin || canView("smart_incentives_commissions")) return "commissions";
    if (isAdmin || canView("smart_incentives_bonus")) return "branch-bonus";
    if (isAdmin || canView("smart_incentives_wallet")) return "wallet";
    if (isAdmin || canView("smart_incentives_statements")) return "awards";
    return "point-settings";
  };

  const hasAnyAccess = isAdmin ||
    canView("smart_incentives_settings") ||
    canView("smart_incentives_challenges") ||
    canView("smart_incentives_commissions") ||
    canView("smart_incentives_bonus") ||
    canView("smart_incentives_wallet") ||
    canView("smart_incentives_statements");

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [showNewTierDialog, setShowNewTierDialog] = useState(false);
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  const [viewChallenge, setViewChallenge] = useState<any>(null);
  const [editChallenge, setEditChallenge] = useState<any>(null);
  const [showCommissionDialog, setShowCommissionDialog] = useState(false);
  const [showBranchBonusDialog, setShowBranchBonusDialog] = useState(false);

  const [calculatedAwards, setCalculatedAwards] = useState<CalculatedAward[]>([]);

  const [walletBranchId, setWalletBranchId] = useState("");
  const [walletCashierId, setWalletCashierId] = useState("");
  const [walletDateFrom, setWalletDateFrom] = useState("");
  const [walletDateTo, setWalletDateTo] = useState("");

  const [calcBranchId, setCalcBranchId] = useState("");
  const [calcDateFrom, setCalcDateFrom] = useState("");
  const [calcDateTo, setCalcDateTo] = useState("");
  const [batchCalcResult, setBatchCalcResult] = useState<{ processedCount: number; totalJournals: number; totalPoints: number; totalAmount: number; journalDetails?: Array<{journalId: number; cashierName: string; journalDate: string; status: string; points: number; diagnostics: Array<{challengeName: string; challengeType: string; targetValue: number; actualValue: number; met: boolean; reason?: string}>}> } | null>(null);

  const [newTier, setNewTier] = useState({
    name: "", description: "", minAchievementPercent: "", maxAchievementPercent: "",
    rewardType: "fixed", fixedAmount: "", percentageRate: "", applicableTo: "all", sortOrder: "0",
  });

  const [newChallenge, setNewChallenge] = useState({
    name: "", challengeType: "avg_ticket", branchId: "", cashierId: "", targetValue: "",
    basePoints: "", bonusPointsPerUnit: "0", shiftType: "", validFrom: "", validTo: "",
  });

  const [newCommission, setNewCommission] = useState({
    productName: "", productCategory: "", commissionType: "weekly_product",
    branchId: "", cashierId: "", targetQuantity: "", pointsOnTarget: "", bonusPointsPerExtra: "0",
    validFrom: "", validTo: "",
  });

  const [newBranchBonus, setNewBranchBonus] = useState({
    branchId: "", yearMonth: "", targetAmount: "",
    distributionMethod: "contribution_ratio",
    tiers: [{ fromPercent: "80", toPercent: "99", bonusAmount: "" }] as { fromPercent: string; toPercent: string; bonusAmount: string }[],
  });

  const [pointSettingsForm, setPointSettingsForm] = useState({
    pointValue: "0.5", maxDailyPoints: "", maxMonthlyPoints: "", seasonalMultiplier: "1",
  });

  const { data: pointSettings } = useQuery<PointSettings>({
    queryKey: ["/api/smart-incentives/point-settings"],
  });

  const { data: topCashierPoints = [] } = useQuery<Array<{ cashierId: string; cashierName: string; branchId: string; branchName: string; totalPoints: number; totalAmount: number; challengeCount: number }>>({
    queryKey: ["/api/smart-incentives/top-cashiers", selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/smart-incentives/top-cashiers?yearMonth=${selectedMonth}&limit=50`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 15000,
    refetchOnMount: 'always',
  });

  const { data: challenges = [], isLoading: challengesLoading } = useQuery<CashierDailyChallenge[]>({
    queryKey: ["/api/smart-incentives/challenges"],
  });

  const { data: commissions = [], isLoading: commissionsLoading } = useQuery<ProductCommission[]>({
    queryKey: ["/api/smart-incentives/product-commissions"],
  });

  const { data: branchBonuses = [], isLoading: branchBonusLoading } = useQuery<BranchAchievementBonus[]>({
    queryKey: ["/api/smart-incentives/branch-bonus"],
  });

  const branchTargetBranchId = newBranchBonus.branchId;
  const branchTargetYearMonth = newBranchBonus.yearMonth;
  const branchTargetEnabled = !!branchTargetBranchId && !!branchTargetYearMonth;
  const { data: fetchedBranchTargets = [], isFetching: branchTargetFetching } = useQuery<any[]>({
    queryKey: ["/api/targets/monthly", { branchId: branchTargetBranchId, yearMonth: branchTargetYearMonth }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("branchId", branchTargetBranchId);
      params.set("yearMonth", branchTargetYearMonth);
      const res = await fetch(`/api/targets/monthly?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: branchTargetEnabled,
  });

  const autoTargetAmount = fetchedBranchTargets.length > 0 ? String(fetchedBranchTargets[0].targetAmount) : "";
  const hasAutoTarget = fetchedBranchTargets.length > 0;

  useEffect(() => {
    if (!branchTargetEnabled) return;
    if (hasAutoTarget) {
      setNewBranchBonus(prev => ({ ...prev, targetAmount: autoTargetAmount }));
    } else if (!branchTargetFetching) {
      setNewBranchBonus(prev => ({ ...prev, targetAmount: "" }));
    }
  }, [branchTargetBranchId, branchTargetYearMonth, autoTargetAmount, hasAutoTarget, branchTargetFetching, branchTargetEnabled]);

  const { data: tiers = [], isLoading: tiersLoading } = useQuery<IncentiveTier[]>({
    queryKey: ["/api/incentives/tiers"],
  });

  const { data: awards = [], isLoading: awardsLoading } = useQuery<IncentiveAward[]>({
    queryKey: ["/api/incentives/awards"],
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const ledgerQueryEnabled = !!walletCashierId;
  const ledgerParams = new URLSearchParams();
  if (walletCashierId) ledgerParams.set("cashierId", walletCashierId);
  if (walletDateFrom) ledgerParams.set("dateFrom", walletDateFrom);
  if (walletDateTo) ledgerParams.set("dateTo", walletDateTo);

  const { data: ledgerEntries = [], isLoading: ledgerLoading } = useQuery<CashierPointsLedger[]>({
    queryKey: ["/api/smart-incentives/points-ledger", walletCashierId, walletDateFrom, walletDateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (walletCashierId) params.set("cashierId", walletCashierId);
      if (walletDateFrom) params.set("dateFrom", walletDateFrom);
      if (walletDateTo) params.set("dateTo", walletDateTo);
      params.set("_t", Date.now().toString());
      const res = await fetch(`/api/smart-incentives/points-ledger?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: ledgerQueryEnabled,
    staleTime: 15000,
    refetchOnWindowFocus: true,
  });

  const { data: pointsSummary } = useQuery<any>({
    queryKey: ["/api/smart-incentives/points-summary", walletCashierId, selectedMonth],
    queryFn: async () => {
      if (!walletCashierId) return null;
      const res = await fetch(`/api/smart-incentives/points-summary/${walletCashierId}?yearMonth=${selectedMonth}&_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!walletCashierId,
    staleTime: 15000,
    refetchOnWindowFocus: true,
  });

  const savePointSettingsMutation = useMutation({
    mutationFn: async (data: typeof pointSettingsForm) => {
      const res = await fetch("/api/smart-incentives/point-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointValue: parseFloat(data.pointValue) || 0.5,
          maxDailyPoints: data.maxDailyPoints ? parseInt(data.maxDailyPoints) : null,
          maxMonthlyPoints: data.maxMonthlyPoints ? parseInt(data.maxMonthlyPoints) : null,
          seasonalMultiplier: parseFloat(data.seasonalMultiplier) || 1,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to save point settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/point-settings"] });
      toast({ title: "تم حفظ إعدادات النقاط بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في حفظ إعدادات النقاط", variant: "destructive" });
    },
  });

  const createChallengeMutation = useMutation({
    mutationFn: async (data: typeof newChallenge) => {
      const res = await fetch("/api/smart-incentives/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          challengeType: data.challengeType,
          branchId: data.branchId || null,
          cashierId: data.cashierId || null,
          targetValue: parseFloat(data.targetValue),
          basePoints: parseInt(data.basePoints),
          bonusPointsPerUnit: parseFloat(data.bonusPointsPerUnit) || 0,
          shiftType: data.shiftType || null,
          validFrom: data.validFrom,
          validTo: data.validTo || null,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create challenge");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/challenges"] });
      setShowChallengeDialog(false);
      setNewChallenge({ name: "", challengeType: "avg_ticket", branchId: "", cashierId: "", targetValue: "", basePoints: "", bonusPointsPerUnit: "0", shiftType: "", validFrom: "", validTo: "" });
      toast({ title: "تم إنشاء التحدي بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في إنشاء التحدي", variant: "destructive" });
    },
  });

  const updateChallengeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/smart-incentives/challenges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update challenge");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/challenges"] });
      setEditChallenge(null);
      toast({ title: "تم تحديث التحدي بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في تحديث التحدي", variant: "destructive" });
    },
  });

  const deleteChallengeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/smart-incentives/challenges/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete challenge");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/challenges"] });
      toast({ title: "تم حذف التحدي بنجاح" });
    },
  });

  const createCommissionMutation = useMutation({
    mutationFn: async (data: typeof newCommission) => {
      const res = await fetch("/api/smart-incentives/product-commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: data.productName,
          productCategory: data.productCategory || null,
          commissionType: data.commissionType,
          branchId: data.branchId || null,
          cashierId: (data.cashierId && data.cashierId !== "all") ? data.cashierId : null,
          targetQuantity: parseInt(data.targetQuantity),
          pointsOnTarget: parseInt(data.pointsOnTarget),
          bonusPointsPerExtra: parseFloat(data.bonusPointsPerExtra) || 0,
          validFrom: data.validFrom,
          validTo: data.validTo || null,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create commission");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/product-commissions"] });
      setShowCommissionDialog(false);
      setNewCommission({ productName: "", productCategory: "", commissionType: "weekly_product", branchId: "", cashierId: "", targetQuantity: "", pointsOnTarget: "", bonusPointsPerExtra: "0", validFrom: "", validTo: "" });
      toast({ title: "تم إنشاء العمولة بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في إنشاء العمولة", variant: "destructive" });
    },
  });

  const deleteCommissionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/smart-incentives/product-commissions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete commission");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/product-commissions"] });
      toast({ title: "تم حذف العمولة بنجاح" });
    },
  });

  const createBranchBonusMutation = useMutation({
    mutationFn: async (data: typeof newBranchBonus) => {
      const tiersData = data.tiers
        .filter(t => t.fromPercent && t.bonusAmount)
        .map(t => ({
          fromPercent: parseFloat(t.fromPercent) || 0,
          toPercent: t.toPercent ? (parseFloat(t.toPercent) || null) : null,
          bonusAmount: parseFloat(t.bonusAmount) || 0,
        }));
      if (tiersData.length === 0) throw new Error("يجب إضافة شريحة واحدة على الأقل");
      const validAmounts = tiersData.map(t => t.bonusAmount).filter(a => a > 0);
      const maxBonus = validAmounts.length > 0 ? Math.max(...validAmounts) : 0;
      const res = await fetch("/api/smart-incentives/branch-bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: data.branchId,
          yearMonth: data.yearMonth,
          bonusPool: maxBonus,
          targetAmount: parseFloat(data.targetAmount),
          distributionMethod: data.distributionMethod,
          bonusTiers: JSON.stringify(tiersData),
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create branch bonus");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/branch-bonus"] });
      setShowBranchBonusDialog(false);
      setNewBranchBonus({ branchId: "", yearMonth: "", targetAmount: "", distributionMethod: "contribution_ratio", tiers: [{ fromPercent: "80", toPercent: "99", bonusAmount: "" }] });
      toast({ title: "تم إنشاء مكافأة الفرع بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في إنشاء مكافأة الفرع", variant: "destructive" });
    },
  });

  const deleteBranchBonusMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/smart-incentives/branch-bonus/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete branch bonus");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/branch-bonus"] });
      toast({ title: "تم حذف مكافأة الفرع بنجاح" });
    },
  });

  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [showCalculationResult, setShowCalculationResult] = useState(false);
  const [calculatingBonusId, setCalculatingBonusId] = useState<number | null>(null);

  const calculateBonusMutation = useMutation({
    mutationFn: async (id: number) => {
      setCalculatingBonusId(id);
      const res = await fetch(`/api/smart-incentives/branch-bonus/${id}/calculate`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل في الاحتساب");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/branch-bonus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/points-ledger"] });
      setCalculationResult(data);
      setShowCalculationResult(true);
      setCalculatingBonusId(null);
      toast({ title: "تم احتساب المكافأة بنجاح وتوزيعها على الكاشيرات" });
    },
    onError: (error: any) => {
      setCalculatingBonusId(null);
      toast({ title: error.message || "خطأ في احتساب المكافأة", variant: "destructive" });
    },
  });

  const resetCalculationMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/smart-incentives/branch-bonus/${id}/reset-calculation`, { method: "POST" });
      if (!res.ok) throw new Error("فشل في إعادة التعيين");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/branch-bonus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/points-ledger"] });
      toast({ title: "تم إعادة تعيين الاحتساب - يمكنك إعادة الاحتساب" });
    },
    onError: () => {
      toast({ title: "خطأ في إعادة التعيين", variant: "destructive" });
    },
  });

  const [manualAdjustBonusId, setManualAdjustBonusId] = useState<number | null>(null);
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});
  const [manualComment, setManualComment] = useState("");

  const [editBonusDialogOpen, setEditBonusDialogOpen] = useState(false);
  const [editBonusData, setEditBonusData] = useState<{
    id: number;
    branchId: string;
    yearMonth: string;
    targetAmount: string;
    distributionMethod: string;
    tiers: { fromPercent: string; toPercent: string; bonusAmount: string }[];
  } | null>(null);

  const updateBranchBonusMutation = useMutation({
    mutationFn: async (data: { id: number; targetAmount: number; distributionMethod: string; bonusTiers: string; bonusPool: number }) => {
      const res = await fetch(`/api/smart-incentives/branch-bonus/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetAmount: data.targetAmount,
          distributionMethod: data.distributionMethod,
          bonusTiers: data.bonusTiers,
          bonusPool: data.bonusPool,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل في تحديث المكافأة");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/branch-bonus"] });
      setEditBonusDialogOpen(false);
      setEditBonusData(null);
      toast({ title: "تم تحديث المكافأة بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "خطأ في تحديث المكافأة", variant: "destructive" });
    },
  });

  const manualAdjustMutation = useMutation({
    mutationFn: async ({ id, adjustments, comment }: { id: number; adjustments: any[]; comment: string }) => {
      const res = await fetch(`/api/smart-incentives/branch-bonus/${id}/manual-adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustments, comment }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "فشل في التعديل اليدوي");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/branch-bonus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/points-ledger"] });
      setManualAdjustBonusId(null);
      setManualAmounts({});
      setManualComment("");
      toast({ title: "تم حفظ التوزيع اليدوي بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "خطأ في التعديل اليدوي", variant: "destructive" });
    },
  });

  const createTierMutation = useMutation({
    mutationFn: async (data: typeof newTier) => {
      const res = await fetch("/api/incentives/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          minAchievementPercent: parseFloat(data.minAchievementPercent),
          maxAchievementPercent: data.maxAchievementPercent ? parseFloat(data.maxAchievementPercent) : null,
          rewardType: data.rewardType,
          fixedAmount: data.fixedAmount ? parseFloat(data.fixedAmount) : null,
          percentageRate: data.percentageRate ? parseFloat(data.percentageRate) : null,
          applicableTo: data.applicableTo,
          sortOrder: parseInt(data.sortOrder),
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to create tier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives/tiers"] });
      setShowNewTierDialog(false);
      setNewTier({ name: "", description: "", minAchievementPercent: "", maxAchievementPercent: "", rewardType: "fixed", fixedAmount: "", percentageRate: "", applicableTo: "all", sortOrder: "0" });
      toast({ title: "تم إنشاء مستوى الحافز بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في إنشاء مستوى الحافز", variant: "destructive" });
    },
  });

  const calculateIncentivesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/incentives/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth: selectedMonth }),
      });
      if (!res.ok) throw new Error("Failed to calculate incentives");
      return res.json();
    },
    onSuccess: (data) => {
      setCalculatedAwards(data);
      toast({ title: "تم حساب الحوافز بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في حساب الحوافز", variant: "destructive" });
    },
  });

  const approveAwardMutation = useMutation({
    mutationFn: async (awardId: number) => {
      const res = await fetch(`/api/incentives/awards/${awardId}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to approve award");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives/awards"] });
      toast({ title: "تم اعتماد الحافز بنجاح" });
    },
  });

  const payAwardMutation = useMutation({
    mutationFn: async (awardId: number) => {
      const res = await fetch(`/api/incentives/awards/${awardId}/pay`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to mark as paid");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives/awards"] });
      toast({ title: "تم تسجيل صرف الحافز بنجاح" });
    },
  });

  const saveCalculatedAwardsMutation = useMutation({
    mutationFn: async (awardsList: CalculatedAward[]) => {
      const promises = awardsList.map((award) =>
        fetch("/api/incentives/awards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            awardType: "monthly",
            branchId: award.branchId,
            periodStart: `${selectedMonth}-01`,
            periodEnd: `${selectedMonth}-31`,
            targetAmount: award.targetAmount,
            achievedAmount: award.achievedAmount,
            achievementPercent: award.achievementPercent,
            tierId: award.tierId,
            calculatedReward: award.calculatedReward,
            finalReward: award.calculatedReward,
            status: "pending",
          }),
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incentives/awards"] });
      setCalculatedAwards([]);
      toast({ title: "تم حفظ سجلات الحوافز بنجاح" });
    },
  });

  const batchCalcMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/smart-incentives/calculate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: calcBranchId, dateFrom: calcDateFrom, dateTo: calcDateTo }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل الاحتساب");
      return res.json();
    },
    onSuccess: (data) => {
      setBatchCalcResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/points-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/points-summary"] });
      toast({ title: `تم احتساب النقاط لـ ${data.processedCount} يومية | ${data.totalPoints} نقطة` });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-SA", {
      style: "currency",
      currency: "SAR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return "جميع الفروع";
    return branches.find((b) => b.id === branchId)?.name || branchId;
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "-";
    const u = allUsers.find((u: any) => u.id === userId);
    return u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username || userId : userId;
  };

  const walletSummary = {
    totalPoints: ledgerEntries.reduce((s, e) => s + (e.pointsEarned || 0), 0),
    totalAmount: ledgerEntries.reduce((s, e) => s + (e.amountEarned || 0), 0),
    pending: ledgerEntries.filter((e) => e.status === "earned").length,
    approved: ledgerEntries.filter((e) => e.status === "approved" || e.status === "paid").length,
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    if (awards?.length) {
      const filteredAwards = awards.filter((a) => a.periodStart?.startsWith(selectedMonth));
      const data = filteredAwards.map((a) => ({
        الفرع: getBranchName(a.branchId || ""),
        "الفترة من": a.periodStart,
        "الفترة إلى": a.periodEnd,
        الهدف: a.targetAmount,
        المحقق: a.achievedAmount,
        النسبة: `${a.achievementPercent?.toFixed(1)}%`,
        المكافأة: a.finalReward,
        الحالة: AWARD_STATUS_LABELS[a.status] || a.status,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "سجل الحوافز");
    }

    if (challenges?.length) {
      const cData = challenges.map((c) => ({
        الاسم: c.name,
        النوع: CHALLENGE_TYPE_LABELS[c.challengeType] || c.challengeType,
        الفرع: getBranchName(c.branchId),
        الهدف: c.targetValue,
        "النقاط الأساسية": c.basePoints,
        "من تاريخ": c.validFrom,
        "إلى تاريخ": c.validTo || "-",
      }));
      const ws2 = XLSX.utils.json_to_sheet(cData);
      XLSX.utils.book_append_sheet(wb, ws2, "التحديات اليومية");
    }

    if (commissions?.length) {
      const pData = commissions.map((c) => ({
        المنتج: c.productName,
        الفئة: c.productCategory || "-",
        "الكمية المستهدفة": c.targetQuantity,
        "النقاط عند الهدف": c.pointsOnTarget,
        "من تاريخ": c.validFrom,
      }));
      const ws3 = XLSX.utils.json_to_sheet(pData);
      XLSX.utils.book_append_sheet(wb, ws3, "عمولة الأصناف");
    }

    if (ledgerEntries?.length) {
      const lData = ledgerEntries.map((e) => ({
        التاريخ: e.transactionDate,
        النوع: POINTS_TYPE_LABELS[e.pointsType] || e.pointsType,
        المصدر: e.sourceName || "-",
        النقاط: e.pointsEarned,
        المبلغ: e.amountEarned,
        الحالة: AWARD_STATUS_LABELS[e.status] || e.status,
      }));
      const ws4 = XLSX.utils.json_to_sheet(lData);
      XLSX.utils.book_append_sheet(wb, ws4, "رصيد النقاط");
    }

    if (tiers?.length) {
      const tiersData = tiers.map((t) => ({
        المستوى: t.name,
        الوصف: t.description || "",
        "من نسبة": `${t.minAchievementPercent}%`,
        "إلى نسبة": `${t.maxAchievementPercent}%`,
        "نوع المكافأة": REWARD_TYPE_LABELS[t.rewardType] || t.rewardType,
        "مبلغ ثابت": t.fixedAmount || 0,
        "نسبة مئوية": `${t.percentageRate || 0}%`,
      }));
      const ws5 = XLSX.utils.json_to_sheet(tiersData);
      XLSX.utils.book_append_sheet(wb, ws5, "مستويات الحوافز");
    }

    XLSX.writeFile(wb, `الحوافز_${selectedMonth}.xlsx`);
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/cashier-journals">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-amber-900 flex items-center gap-3">
                <Gift className="h-6 w-6 sm:h-8 sm:w-8" />
                إدارة الحوافز الذكية
              </h1>
              <p className="text-amber-700 mt-1 text-sm sm:text-base">نظام النقاط والتحديات والعمولات</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm">الشهر:</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-36 sm:w-40 h-11 sm:h-10"
                data-testid="input-month-selector"
              />
            </div>

            <Button variant="outline" onClick={exportToExcel} data-testid="button-export-excel" className="h-11 sm:h-9">
              <FileSpreadsheet className="h-4 w-4 ml-2" />
              <span className="hidden sm:inline">تصدير Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>

            <Link href="/targets-dashboard">
              <Button variant="outline" className="h-11 sm:h-9" data-testid="btn-goto-targets-dashboard">
                <TrendingUp className="h-4 w-4 ml-1" />
                <span className="hidden sm:inline">لوحة الأهداف</span>
              </Button>
            </Link>

            <Link href="/cashier-shift-performance">
              <Button variant="outline" className="h-11 sm:h-9" data-testid="btn-goto-shift-performance">
                <Users className="h-4 w-4 ml-1" />
                <span className="hidden sm:inline">أداء الشفتات</span>
              </Button>
            </Link>

            <Link href="/targets-planning">
              <Button variant="outline" className="h-11 sm:h-9" data-testid="btn-goto-targets-planning">
                <Calendar className="h-4 w-4 ml-1" />
                <span className="hidden sm:inline">تخطيط الأهداف</span>
              </Button>
            </Link>
          </div>
        </div>

        {topCashierPoints.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="incentive-overview-stats">
            <Card className="border-emerald-200 bg-gradient-to-bl from-emerald-50 to-white">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs text-emerald-700">كاشيرين نشطين</span>
                </div>
                <div className="text-2xl font-bold text-emerald-800" data-testid="stat-active-cashiers">{topCashierPoints.length}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-gradient-to-bl from-amber-50 to-white">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Star className="h-4 w-4 text-amber-600" />
                  <span className="text-xs text-amber-700">إجمالي النقاط</span>
                </div>
                <div className="text-2xl font-bold text-amber-800" data-testid="stat-total-points">{topCashierPoints.reduce((s, c) => s + c.totalPoints, 0)}</div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-gradient-to-bl from-blue-50 to-white">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <DollarSign className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-700">إجمالي المبالغ SAR</span>
                </div>
                <div className="text-2xl font-bold text-blue-800" data-testid="stat-total-amount">{topCashierPoints.reduce((s, c) => s + c.totalAmount, 0).toFixed(0)}</div>
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-gradient-to-bl from-purple-50 to-white">
              <CardContent className="p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Target className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-purple-700">التحديات المنجزة</span>
                </div>
                <div className="text-2xl font-bold text-purple-800" data-testid="stat-total-challenges">{topCashierPoints.reduce((s, c) => s + c.challengeCount, 0)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {!hasAnyAccess ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <X className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-lg font-bold text-red-700">ليس لديك صلاحية للوصول إلى هذه الصفحة</p>
            </CardContent>
          </Card>
        ) : (
        <Tabs defaultValue={getDefaultTab()} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {(isAdmin || canView("smart_incentives_settings")) && (
            <TabsTrigger value="point-settings" className="flex items-center gap-1 text-xs sm:text-sm" data-testid="tab-point-settings">
              <Settings className="h-3.5 w-3.5" />
              إعدادات النقاط
            </TabsTrigger>
            )}
            {(isAdmin || canView("smart_incentives_challenges")) && (
            <TabsTrigger value="challenges" className="flex items-center gap-1 text-xs sm:text-sm" data-testid="tab-challenges">
              <Target className="h-3.5 w-3.5" />
              التحديات اليومية
            </TabsTrigger>
            )}
            {(isAdmin || canView("smart_incentives_commissions")) && (
            <TabsTrigger value="commissions" className="flex items-center gap-1 text-xs sm:text-sm" data-testid="tab-commissions">
              <Trophy className="h-3.5 w-3.5" />
              عمولة الأصناف
            </TabsTrigger>
            )}
            {(isAdmin || canView("smart_incentives_bonus")) && (
            <TabsTrigger value="branch-bonus" className="flex items-center gap-1 text-xs sm:text-sm" data-testid="tab-branch-bonus">
              <TrendingUp className="h-3.5 w-3.5" />
              عمولة الفرع
            </TabsTrigger>
            )}
            {(isAdmin || canView("smart_incentives_wallet")) && (
            <TabsTrigger value="wallet" className="flex items-center gap-1 text-xs sm:text-sm" data-testid="tab-wallet">
              <Wallet className="h-3.5 w-3.5" />
              رصيد الكاشير
            </TabsTrigger>
            )}
            {(isAdmin || canView("smart_incentives_statements")) && (
            <TabsTrigger value="awards" className="flex items-center gap-1 text-xs sm:text-sm" data-testid="tab-awards">
              <Award className="h-3.5 w-3.5" />
              سجل الحوافز
            </TabsTrigger>
            )}
            {(isAdmin || canView("smart_incentives_wallet")) && (
            <TabsTrigger value="calculate" className="flex items-center gap-1 text-xs sm:text-sm bg-green-50 text-green-700 data-[state=active]:bg-green-600 data-[state=active]:text-white" data-testid="tab-calculate">
              <Calculator className="h-3.5 w-3.5" />
              احتساب النقاط
            </TabsTrigger>
            )}
          </TabsList>

          {/* Tab 1: Point Settings */}
          {(isAdmin || canView("smart_incentives_settings")) && <TabsContent value="point-settings">
            <div className="space-y-6">
              <Card className="border-blue-200">
                <CardHeader className="bg-blue-50 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <Star className="h-5 w-5" />
                    ما هي إعدادات النقاط؟
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-sm text-gray-700 space-y-3">
                    <p>هذه الصفحة تحدد <strong>القواعد الأساسية</strong> لنظام الحوافز بالكامل. كل كاشير يجمع نقاط من التحديات اليومية، وهنا تحدد كم تساوي كل نقطة بالريال وما هي الحدود.</p>
                    <div className="bg-white border rounded-lg p-3 mt-2">
                      <p className="font-bold text-amber-700 mb-2">مثال عملي:</p>
                      <p>لو قيمة النقطة = <strong>0.50 ريال</strong> وكاشير جمع <strong>100 نقطة</strong> في اليوم</p>
                      <p>= 100 × 0.50 = <strong className="text-green-700 text-lg">50 ريال مكافأة</strong></p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-amber-600" />
                    ضبط الإعدادات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 p-4 bg-gray-50 rounded-lg border">
                      <Label className="text-base font-bold">قيمة النقطة الواحدة (بالريال)</Label>
                      <p className="text-xs text-gray-500">كم ريال تساوي كل نقطة يكسبها الكاشير؟</p>
                      <Input
                        type="number"
                        step="0.1"
                        value={pointSettingsForm.pointValue}
                        onChange={(e) => setPointSettingsForm({ ...pointSettingsForm, pointValue: e.target.value })}
                        placeholder="مثال: 0.5 يعني كل نقطة = نصف ريال"
                        data-testid="input-point-value"
                        className="h-11 sm:h-10"
                      />
                      <p className="text-xs text-blue-600">القيم الشائعة: 0.25 - 0.50 - 1.00 ريال</p>
                    </div>

                    <div className="space-y-2 p-4 bg-gray-50 rounded-lg border">
                      <Label className="text-base font-bold">الحد الأقصى للنقاط اليومية</Label>
                      <p className="text-xs text-gray-500">أقصى عدد نقاط يمكن للكاشير كسبها في يوم واحد (اتركه فارغ = بدون حد)</p>
                      <Input
                        type="number"
                        value={pointSettingsForm.maxDailyPoints}
                        onChange={(e) => setPointSettingsForm({ ...pointSettingsForm, maxDailyPoints: e.target.value })}
                        placeholder="مثال: 200 نقطة = 100 ريال كحد أقصى يومياً"
                        data-testid="input-max-daily-points"
                        className="h-11 sm:h-10"
                      />
                    </div>

                    <div className="space-y-2 p-4 bg-gray-50 rounded-lg border">
                      <Label className="text-base font-bold">الحد الأقصى للنقاط الشهرية</Label>
                      <p className="text-xs text-gray-500">أقصى عدد نقاط يمكن للكاشير كسبها في الشهر (اتركه فارغ = بدون حد)</p>
                      <Input
                        type="number"
                        value={pointSettingsForm.maxMonthlyPoints}
                        onChange={(e) => setPointSettingsForm({ ...pointSettingsForm, maxMonthlyPoints: e.target.value })}
                        placeholder="مثال: 5000 نقطة = 2500 ريال كحد أقصى شهرياً"
                        data-testid="input-max-monthly-points"
                        className="h-11 sm:h-10"
                      />
                    </div>

                    <div className="space-y-2 p-4 bg-gray-50 rounded-lg border">
                      <Label className="text-base font-bold">معامل الموسم (مضاعف النقاط)</Label>
                      <p className="text-xs text-gray-500">في المواسم والأعياد يمكنك مضاعفة النقاط. القيمة 1 = عادي، 1.5 = مرة ونصف، 2 = ضعف</p>
                      <Input
                        type="number"
                        step="0.1"
                        value={pointSettingsForm.seasonalMultiplier}
                        onChange={(e) => setPointSettingsForm({ ...pointSettingsForm, seasonalMultiplier: e.target.value })}
                        placeholder="1 = عادي | 1.5 = موسم | 2 = ضعف"
                        data-testid="input-seasonal-multiplier"
                        className="h-11 sm:h-10"
                      />
                      <p className="text-xs text-blue-600">مثال: في رمضان اجعلها 1.5 لتشجيع الكاشير</p>
                    </div>
                  </div>

                  {pointSettings && pointSettings.pointValue && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                        <Check className="h-4 w-4" />
                        الإعدادات المحفوظة حالياً
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="text-center p-2 bg-white rounded border">
                          <p className="text-xl font-bold text-amber-700">{pointSettings.pointValue} ر.س</p>
                          <p className="text-xs text-gray-500">قيمة النقطة</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded border">
                          <p className="text-xl font-bold text-blue-700">{pointSettings.maxDailyPoints || "∞"}</p>
                          <p className="text-xs text-gray-500">حد يومي</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded border">
                          <p className="text-xl font-bold text-purple-700">{pointSettings.maxMonthlyPoints || "∞"}</p>
                          <p className="text-xs text-gray-500">حد شهري</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded border">
                          <p className="text-xl font-bold text-green-700">×{pointSettings.seasonalMultiplier}</p>
                          <p className="text-xs text-gray-500">معامل الموسم</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(isAdmin || canEdit("smart_incentives_settings")) && (
                  <Button
                    onClick={() => savePointSettingsMutation.mutate(pointSettingsForm)}
                    disabled={savePointSettingsMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto"
                    data-testid="button-save-point-settings"
                  >
                    {savePointSettingsMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
                  </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>}

          {/* Tab 2: Daily Challenges */}
          {(isAdmin || canView("smart_incentives_challenges")) && <TabsContent value="challenges">
            <div className="space-y-6">
              <Card className="border-blue-200">
                <CardHeader className="bg-blue-50 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <Star className="h-5 w-5" />
                    ما هي التحديات اليومية؟
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-sm text-gray-700 space-y-3">
                    <p>التحديات اليومية هي <strong>أهداف تحددها للكاشير</strong>. إذا حقق الكاشير الهدف في يوميته، يحصل على نقاط تتحول لمكافأة مالية.</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div className="bg-white border-2 border-orange-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-5 w-5 text-orange-600" />
                          <span className="font-bold text-orange-800">متوسط الفاتورة</span>
                        </div>
                        <p className="text-xs text-gray-600">حدد هدف لمتوسط قيمة الفاتورة</p>
                        <div className="bg-orange-50 rounded p-2 mt-2 text-xs">
                          <p><strong>مثال:</strong> الهدف 45 ريال</p>
                          <p>الكاشير حقق 52 ريال</p>
                          <p className="text-green-700 font-bold">= 50 نقطة أساسية + 14 إضافية</p>
                        </div>
                      </div>

                      <div className="bg-white border-2 border-blue-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-5 w-5 text-blue-600" />
                          <span className="font-bold text-blue-800">عدد العملاء</span>
                        </div>
                        <p className="text-xs text-gray-600">حدد هدف لعدد العملاء في الوردية</p>
                        <div className="bg-blue-50 rounded p-2 mt-2 text-xs">
                          <p><strong>مثال:</strong> الهدف 80 عميل</p>
                          <p>الكاشير خدم 95 عميل</p>
                          <p className="text-green-700 font-bold">= 30 نقطة أساسية + 15 إضافية</p>
                        </div>
                      </div>

                      <div className="bg-white border-2 border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <span className="font-bold text-green-800">مبيعات الوردية</span>
                        </div>
                        <p className="text-xs text-gray-600">حدد هدف لإجمالي مبيعات الوردية</p>
                        <div className="bg-green-50 rounded p-2 mt-2 text-xs">
                          <p><strong>مثال:</strong> الهدف 5,000 ريال</p>
                          <p>الكاشير باع 6,200 ريال</p>
                          <p className="text-green-700 font-bold">= 40 نقطة أساسية + 24 إضافية</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                      <p className="font-bold text-amber-800 mb-1">كيف يتم الاحتساب تلقائياً؟</p>
                      <p className="text-xs text-amber-700">1. أنشئ تحدي من هنا (مثلاً: متوسط فاتورة 45 ريال = 50 نقطة)</p>
                      <p className="text-xs text-amber-700">2. الكاشير يسجل يوميته في صفحة يومية الكاشير كالمعتاد</p>
                      <p className="text-xs text-amber-700">3. عند اعتماد اليومية من المشرف ← النظام يقارن البيانات بالتحدي تلقائياً</p>
                      <p className="text-xs text-amber-700">4. إذا تحقق الهدف ← تُضاف النقاط في محفظة الكاشير تلقائياً</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-amber-600" />
                      إدارة التحديات
                    </CardTitle>
                    <CardDescription>أنشئ تحديات للكاشير وحدد الأهداف والنقاط</CardDescription>
                  </div>
                  <Dialog open={showChallengeDialog} onOpenChange={setShowChallengeDialog}>
                    {(isAdmin || canCreate("smart_incentives_challenges")) && (
                    <DialogTrigger asChild>
                      <Button data-testid="button-add-challenge" className="bg-amber-600 hover:bg-amber-700 h-11 sm:h-9">
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة تحدي
                      </Button>
                    </DialogTrigger>
                    )}
                    <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
                      <DialogHeader>
                        <DialogTitle>إضافة تحدي يومي جديد</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3">
                        <div>
                          <Label className="font-bold text-sm">اسم التحدي</Label>
                          <Input value={newChallenge.name} onChange={(e) => setNewChallenge({ ...newChallenge, name: e.target.value })} placeholder="مثال: تحدي متوسط الفاتورة - صباحي" data-testid="input-challenge-name" className="h-9 mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="font-bold text-sm">نوع التحدي</Label>
                            <Select value={newChallenge.challengeType} onValueChange={(v) => setNewChallenge({ ...newChallenge, challengeType: v })}>
                              <SelectTrigger data-testid="select-challenge-type" className="h-9 mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="avg_ticket">متوسط الفاتورة</SelectItem>
                                <SelectItem value="customer_count">عدد العملاء</SelectItem>
                                <SelectItem value="shift_sales">مبيعات الوردية</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="font-bold text-sm">الفرع</Label>
                            <Select value={newChallenge.branchId} onValueChange={(v) => setNewChallenge({ ...newChallenge, branchId: v, cashierId: "" })}>
                              <SelectTrigger data-testid="select-challenge-branch" className="h-9 mt-1"><SelectValue placeholder="جميع الفروع" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">جميع الفروع</SelectItem>
                                {branches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label className="font-bold text-sm">الكاشير (اختياري)</Label>
                          <Select value={newChallenge.cashierId} onValueChange={(v) => setNewChallenge({ ...newChallenge, cashierId: v })}>
                            <SelectTrigger data-testid="select-challenge-cashier" className="h-9 mt-1"><SelectValue placeholder="جميع الكاشيرات" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">جميع الكاشيرات</SelectItem>
                              {allUsers
                                .filter((u: any) => {
                                  const isActiveCashier = u.isActive !== "inactive" && (u.role === "employee" || u.role === "cashier" || u.role === "admin");
                                  if (!newChallenge.branchId || newChallenge.branchId === "all") return isActiveCashier;
                                  return isActiveCashier && u.branchId === newChallenge.branchId;
                                })
                                .map((u: any) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username}
                                    {u.jobTitle ? ` - ${u.jobTitle}` : ""}
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                          {newChallenge.branchId && newChallenge.branchId !== "all" && (
                            <p className="text-xs text-blue-600 mt-1">يعرض فقط موظفي الفرع المحدد</p>
                          )}
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">الشفت <span className="text-red-500">*</span></Label>
                          <Select value={newChallenge.shiftType} onValueChange={(v) => setNewChallenge({...newChallenge, shiftType: v})}>
                            <SelectTrigger className="h-9" data-testid="select-challenge-shift">
                              <SelectValue placeholder="اختر الشفت" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="morning">صباحي</SelectItem>
                              <SelectItem value="evening">مسائي</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="font-bold text-sm">الهدف</Label>
                            <Input type="number" value={newChallenge.targetValue} onChange={(e) => setNewChallenge({ ...newChallenge, targetValue: e.target.value })} placeholder="45" data-testid="input-challenge-target" className="h-9 mt-1" />
                          </div>
                          <div>
                            <Label className="font-bold text-sm">النقاط الأساسية</Label>
                            <Input type="number" value={newChallenge.basePoints} onChange={(e) => setNewChallenge({ ...newChallenge, basePoints: e.target.value })} placeholder="50" data-testid="input-challenge-base-points" className="h-9 mt-1" />
                          </div>
                          <div>
                            <Label className="font-bold text-sm">إضافي/وحدة</Label>
                            <Input type="number" value={newChallenge.bonusPointsPerUnit} onChange={(e) => setNewChallenge({ ...newChallenge, bonusPointsPerUnit: e.target.value })} placeholder="0" data-testid="input-challenge-bonus" className="h-9 mt-1" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="font-bold text-sm">تاريخ البداية</Label>
                            <Input type="date" value={newChallenge.validFrom} onChange={(e) => setNewChallenge({ ...newChallenge, validFrom: e.target.value })} data-testid="input-challenge-valid-from" className="h-9 mt-1" />
                          </div>
                          <div>
                            <Label className="font-bold text-sm">تاريخ النهاية (اختياري)</Label>
                            <Input type="date" value={newChallenge.validTo} onChange={(e) => setNewChallenge({ ...newChallenge, validTo: e.target.value })} data-testid="input-challenge-valid-to" className="h-9 mt-1" />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={() => createChallengeMutation.mutate(newChallenge)} disabled={createChallengeMutation.isPending || !newChallenge.name || !newChallenge.targetValue || !newChallenge.basePoints || !newChallenge.validFrom} className="bg-amber-600 hover:bg-amber-700" data-testid="button-save-challenge">
                          {createChallengeMutation.isPending ? "جاري الحفظ..." : "حفظ التحدي"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {challengesLoading ? (
                    <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                  ) : challenges.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-lg font-bold mb-1">لا توجد تحديات بعد</p>
                      <p className="text-sm">اضغط "إضافة تحدي" لإنشاء أول تحدي يومي للكاشير</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="min-w-[700px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>اسم التحدي</TableHead>
                            <TableHead>ماذا يُقاس؟</TableHead>
                            <TableHead className="hidden md:table-cell">الفرع</TableHead>
                            <TableHead>الكاشير</TableHead>
                            <TableHead>الهدف المطلوب</TableHead>
                            <TableHead>النقاط عند التحقيق</TableHead>
                            <TableHead className="hidden sm:table-cell">نقاط إضافية/وحدة</TableHead>
                            <TableHead className="hidden md:table-cell">الفترة</TableHead>
                            <TableHead>إجراء</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {challenges.map((c) => (
                            <TableRow key={c.id} data-testid={`row-challenge-${c.id}`}>
                              <TableCell className="font-medium text-xs sm:text-sm">{c.name}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{CHALLENGE_TYPE_LABELS[c.challengeType] || c.challengeType}</Badge></TableCell>
                              <TableCell className="text-xs hidden md:table-cell">{getBranchName(c.branchId)}</TableCell>
                              <TableCell className="text-xs">{c.cashierId ? getUserName(c.cashierId) : <span className="text-gray-400">الكل</span>}</TableCell>
                              <TableCell className="font-mono text-xs sm:text-sm font-bold">{c.targetValue}</TableCell>
                              <TableCell className="font-mono text-xs sm:text-sm text-green-700 font-bold">{c.basePoints} نقطة</TableCell>
                              <TableCell className="font-mono text-xs hidden sm:table-cell">{c.bonusPointsPerUnit || 0} نقطة</TableCell>
                              <TableCell className="text-xs hidden md:table-cell">{c.validFrom} {c.validTo ? `← ${c.validTo}` : "← مستمر"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-700 h-8 w-8 p-0" onClick={() => setViewChallenge(c)} data-testid={`button-view-challenge-${c.id}`} title="عرض التفاصيل">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {(isAdmin || canEdit("smart_incentives_challenges")) && (
                                  <Button variant="ghost" size="sm" className="text-amber-500 hover:text-amber-700 h-8 w-8 p-0" onClick={() => setEditChallenge({ ...c })} data-testid={`button-edit-challenge-${c.id}`} title="تعديل">
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                  )}
                                  {(isAdmin || canDelete("smart_incentives_challenges")) && (
                                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-8 w-8 p-0" onClick={() => deleteChallengeMutation.mutate(c.id)} data-testid={`button-delete-challenge-${c.id}`} title="حذف">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* View Challenge Dialog */}
              <Dialog open={!!viewChallenge} onOpenChange={(open) => !open && setViewChallenge(null)}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-blue-600" />
                      تفاصيل التحدي
                    </DialogTitle>
                  </DialogHeader>
                  {viewChallenge && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">اسم التحدي</p>
                          <p className="font-bold text-sm">{viewChallenge.name}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">نوع التحدي</p>
                          <p className="font-bold text-sm">{CHALLENGE_TYPE_LABELS[viewChallenge.challengeType] || viewChallenge.challengeType}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">الفرع</p>
                          <p className="font-bold text-sm">{getBranchName(viewChallenge.branchId)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">الكاشير</p>
                          <p className="font-bold text-sm">{viewChallenge.cashierId ? getUserName(viewChallenge.cashierId) : "جميع الكاشيرات"}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                          <p className="text-xs text-amber-600">الهدف المطلوب</p>
                          <p className="font-bold text-lg text-amber-800">{viewChallenge.targetValue}</p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                          <p className="text-xs text-green-600">النقاط الأساسية</p>
                          <p className="font-bold text-lg text-green-800">{viewChallenge.basePoints}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                          <p className="text-xs text-blue-600">إضافي/وحدة</p>
                          <p className="font-bold text-lg text-blue-800">{viewChallenge.bonusPointsPerUnit || 0}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">تاريخ البداية</p>
                          <p className="font-bold text-sm">{viewChallenge.validFrom}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">تاريخ النهاية</p>
                          <p className="font-bold text-sm">{viewChallenge.validTo || "مستمر"}</p>
                        </div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">الحالة</p>
                        <Badge className={viewChallenge.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {viewChallenge.isActive ? "نشط" : "متوقف"}
                        </Badge>
                      </div>
                    </div>
                  )}
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => { setEditChallenge({ ...viewChallenge }); setViewChallenge(null); }}>
                      <Pencil className="h-4 w-4 ml-2" />
                      تعديل
                    </Button>
                    <Button variant="outline" onClick={() => setViewChallenge(null)}>إغلاق</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Edit Challenge Dialog */}
              <Dialog open={!!editChallenge} onOpenChange={(open) => !open && setEditChallenge(null)}>
                <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Pencil className="h-5 w-5 text-amber-600" />
                      تعديل التحدي
                    </DialogTitle>
                  </DialogHeader>
                  {editChallenge && (
                    <div className="space-y-3">
                      <div>
                        <Label className="font-bold text-sm">اسم التحدي</Label>
                        <Input value={editChallenge.name} onChange={(e) => setEditChallenge({ ...editChallenge, name: e.target.value })} className="h-9 mt-1" data-testid="input-edit-challenge-name" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="font-bold text-sm">نوع التحدي</Label>
                          <Select value={editChallenge.challengeType} onValueChange={(v) => setEditChallenge({ ...editChallenge, challengeType: v })}>
                            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="avg_ticket">متوسط الفاتورة</SelectItem>
                              <SelectItem value="customer_count">عدد العملاء</SelectItem>
                              <SelectItem value="shift_sales">مبيعات الوردية</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="font-bold text-sm">الفرع</Label>
                          <Select value={editChallenge.branchId || "all"} onValueChange={(v) => setEditChallenge({ ...editChallenge, branchId: v === "all" ? null : v, cashierId: "" })}>
                            <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="جميع الفروع" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">جميع الفروع</SelectItem>
                              {branches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="font-bold text-sm">الكاشير (اختياري)</Label>
                        <Select value={editChallenge.cashierId || "all"} onValueChange={(v) => setEditChallenge({ ...editChallenge, cashierId: v === "all" ? null : v })}>
                          <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="جميع الكاشيرات" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">جميع الكاشيرات</SelectItem>
                            {allUsers
                              .filter((u: any) => {
                                const isActiveCashier = u.isActive !== "inactive" && (u.role === "employee" || u.role === "cashier" || u.role === "admin");
                                if (!editChallenge.branchId || editChallenge.branchId === "all") return isActiveCashier;
                                return isActiveCashier && u.branchId === editChallenge.branchId;
                              })
                              .map((u: any) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username}
                                  {u.jobTitle ? ` - ${u.jobTitle}` : ""}
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">الشفت <span className="text-red-500">*</span></Label>
                        <Select value={editChallenge.shiftType || ""} onValueChange={(v) => setEditChallenge({...editChallenge, shiftType: v})}>
                          <SelectTrigger className="h-9" data-testid="select-edit-challenge-shift">
                            <SelectValue placeholder="اختر الشفت" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="morning">صباحي</SelectItem>
                            <SelectItem value="evening">مسائي</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label className="font-bold text-sm">الهدف</Label>
                          <Input type="number" value={editChallenge.targetValue} onChange={(e) => setEditChallenge({ ...editChallenge, targetValue: parseFloat(e.target.value) || 0 })} className="h-9 mt-1" data-testid="input-edit-challenge-target" />
                        </div>
                        <div>
                          <Label className="font-bold text-sm">النقاط الأساسية</Label>
                          <Input type="number" value={editChallenge.basePoints} onChange={(e) => setEditChallenge({ ...editChallenge, basePoints: parseInt(e.target.value) || 0 })} className="h-9 mt-1" data-testid="input-edit-challenge-points" />
                        </div>
                        <div>
                          <Label className="font-bold text-sm">إضافي/وحدة</Label>
                          <Input type="number" value={editChallenge.bonusPointsPerUnit || 0} onChange={(e) => setEditChallenge({ ...editChallenge, bonusPointsPerUnit: parseFloat(e.target.value) || 0 })} className="h-9 mt-1" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="font-bold text-sm">تاريخ البداية</Label>
                          <Input type="date" value={editChallenge.validFrom} onChange={(e) => setEditChallenge({ ...editChallenge, validFrom: e.target.value })} className="h-9 mt-1" />
                        </div>
                        <div>
                          <Label className="font-bold text-sm">تاريخ النهاية</Label>
                          <Input type="date" value={editChallenge.validTo || ""} onChange={(e) => setEditChallenge({ ...editChallenge, validTo: e.target.value || null })} className="h-9 mt-1" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="font-bold text-sm">الحالة:</Label>
                        <Button
                          variant={editChallenge.isActive ? "default" : "outline"}
                          size="sm"
                          className={editChallenge.isActive ? "bg-green-600 hover:bg-green-700" : ""}
                          onClick={() => setEditChallenge({ ...editChallenge, isActive: !editChallenge.isActive })}
                        >
                          {editChallenge.isActive ? "نشط" : "متوقف"}
                        </Button>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditChallenge(null)}>إلغاء</Button>
                    <Button
                      className="bg-amber-600 hover:bg-amber-700"
                      disabled={updateChallengeMutation.isPending}
                      onClick={() => {
                        if (!editChallenge) return;
                        updateChallengeMutation.mutate({
                          id: editChallenge.id,
                          data: {
                            name: editChallenge.name,
                            challengeType: editChallenge.challengeType,
                            branchId: editChallenge.branchId || null,
                            cashierId: editChallenge.cashierId || null,
                            targetValue: editChallenge.targetValue,
                            basePoints: editChallenge.basePoints,
                            bonusPointsPerUnit: editChallenge.bonusPointsPerUnit || 0,
                            shiftType: editChallenge.shiftType || null,
                            validFrom: editChallenge.validFrom,
                            validTo: editChallenge.validTo || null,
                            isActive: editChallenge.isActive,
                          },
                        });
                      }}
                      data-testid="button-save-edit-challenge"
                    >
                      {updateChallengeMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>}

          {/* Tab 3: Product Commissions */}
          {(isAdmin || canView("smart_incentives_commissions")) && <TabsContent value="commissions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-600" />
                    عمولة الأصناف
                  </CardTitle>
                  <CardDescription>إدارة عمولات المنتجات المستهدفة</CardDescription>
                </div>
                <Dialog open={showCommissionDialog} onOpenChange={setShowCommissionDialog}>
                  {(isAdmin || canCreate("smart_incentives_commissions")) && (
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-commission" className="bg-amber-600 hover:bg-amber-700 h-11 sm:h-9">
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة عمولة
                    </Button>
                  </DialogTrigger>
                  )}
                  <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>إضافة عمولة صنف جديد</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>اسم المنتج</Label>
                        <Input value={newCommission.productName} onChange={(e) => setNewCommission({ ...newCommission, productName: e.target.value })} placeholder="مثال: كرواسون شوكولاتة" data-testid="input-commission-product" className="h-11 sm:h-10" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>الفئة</Label>
                          <Input value={newCommission.productCategory} onChange={(e) => setNewCommission({ ...newCommission, productCategory: e.target.value })} placeholder="معجنات" data-testid="input-commission-category" className="h-11 sm:h-10" />
                        </div>
                        <div>
                          <Label>نوع العمولة</Label>
                          <Select value={newCommission.commissionType} onValueChange={(v) => setNewCommission({ ...newCommission, commissionType: v })}>
                            <SelectTrigger data-testid="select-commission-type" className="h-11 sm:h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="weekly_product">صنف الأسبوع</SelectItem>
                              <SelectItem value="monthly_product">صنف الشهر</SelectItem>
                              <SelectItem value="new_product">صنف جديد</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>الفرع (اختياري)</Label>
                          <Select value={newCommission.branchId} onValueChange={(v) => setNewCommission({ ...newCommission, branchId: v, cashierId: "" })}>
                            <SelectTrigger data-testid="select-commission-branch" className="h-11 sm:h-10"><SelectValue placeholder="جميع الفروع" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">جميع الفروع</SelectItem>
                              {branches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>الكاشير (اختياري)</Label>
                          <Select value={newCommission.cashierId} onValueChange={(v) => setNewCommission({ ...newCommission, cashierId: v })}>
                            <SelectTrigger data-testid="select-commission-cashier" className="h-11 sm:h-10"><SelectValue placeholder="جميع الكاشيرات" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">جميع الكاشيرات</SelectItem>
                              {allUsers
                                .filter((u: any) => {
                                  const isActiveCashier = u.isActive !== "inactive" && (u.role === "employee" || u.role === "cashier" || u.role === "admin");
                                  if (!newCommission.branchId || newCommission.branchId === "all") return isActiveCashier;
                                  return isActiveCashier && u.branchId === newCommission.branchId;
                                })
                                .map((u: any) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>الكمية المستهدفة</Label>
                          <Input type="number" value={newCommission.targetQuantity} onChange={(e) => setNewCommission({ ...newCommission, targetQuantity: e.target.value })} placeholder="50" data-testid="input-commission-target-qty" className="h-11 sm:h-10" />
                        </div>
                        <div>
                          <Label>نقاط عند الهدف</Label>
                          <Input type="number" value={newCommission.pointsOnTarget} onChange={(e) => setNewCommission({ ...newCommission, pointsOnTarget: e.target.value })} placeholder="20" data-testid="input-commission-points" className="h-11 sm:h-10" />
                        </div>
                      </div>
                      <div>
                        <Label>نقاط إضافية لكل قطعة زيادة</Label>
                        <Input type="number" value={newCommission.bonusPointsPerExtra} onChange={(e) => setNewCommission({ ...newCommission, bonusPointsPerExtra: e.target.value })} placeholder="0" data-testid="input-commission-bonus" className="h-11 sm:h-10" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>تاريخ البداية</Label>
                          <Input type="date" value={newCommission.validFrom} onChange={(e) => setNewCommission({ ...newCommission, validFrom: e.target.value })} data-testid="input-commission-valid-from" className="h-11 sm:h-10" />
                        </div>
                        <div>
                          <Label>تاريخ النهاية</Label>
                          <Input type="date" value={newCommission.validTo} onChange={(e) => setNewCommission({ ...newCommission, validTo: e.target.value })} data-testid="input-commission-valid-to" className="h-11 sm:h-10" />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => createCommissionMutation.mutate(newCommission)} disabled={createCommissionMutation.isPending || !newCommission.productName || !newCommission.targetQuantity || !newCommission.pointsOnTarget || !newCommission.validFrom} className="bg-amber-600 hover:bg-amber-700" data-testid="button-save-commission">
                        {createCommissionMutation.isPending ? "جاري الحفظ..." : "حفظ العمولة"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {commissionsLoading ? (
                  <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                ) : commissions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">لا توجد عمولات مسجلة</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[700px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>المنتج</TableHead>
                          <TableHead className="hidden sm:table-cell">الفئة</TableHead>
                          <TableHead>النوع</TableHead>
                          <TableHead>الكاشير</TableHead>
                          <TableHead>الكمية</TableHead>
                          <TableHead>النقاط</TableHead>
                          <TableHead className="hidden md:table-cell">مكافأة/قطعة</TableHead>
                          <TableHead className="hidden md:table-cell">الصلاحية</TableHead>
                          <TableHead>إجراء</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {commissions.map((c) => (
                          <TableRow key={c.id} data-testid={`row-commission-${c.id}`}>
                            <TableCell className="font-medium text-xs sm:text-sm">{c.productName}</TableCell>
                            <TableCell className="text-xs hidden sm:table-cell">{c.productCategory || "-"}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{COMMISSION_TYPE_LABELS[c.commissionType] || c.commissionType}</Badge></TableCell>
                            <TableCell className="text-xs">{(c as any).cashierId ? getUserName((c as any).cashierId) : <span className="text-gray-400">الكل</span>}</TableCell>
                            <TableCell className="font-mono text-xs sm:text-sm">{c.targetQuantity}</TableCell>
                            <TableCell className="font-mono text-xs sm:text-sm">{c.pointsOnTarget}</TableCell>
                            <TableCell className="font-mono text-xs hidden md:table-cell">{c.bonusPointsPerExtra || 0}</TableCell>
                            <TableCell className="text-xs hidden md:table-cell">{c.validFrom} {c.validTo ? `- ${c.validTo}` : ""}</TableCell>
                            <TableCell>
                              {(isAdmin || canDelete("smart_incentives_commissions")) && (
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-8 w-8 p-0" onClick={() => deleteCommissionMutation.mutate(c.id)} data-testid={`button-delete-commission-${c.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>}

          {/* Tab 4: Branch Achievement Bonus */}
          {(isAdmin || canView("smart_incentives_bonus")) && <TabsContent value="branch-bonus">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                    عمولة الفرع
                  </CardTitle>
                  <CardDescription>مكافأة تحقيق هدف الفرع الشهري</CardDescription>
                </div>
                <Dialog open={showBranchBonusDialog} onOpenChange={setShowBranchBonusDialog}>
                  {(isAdmin || canCreate("smart_incentives_bonus")) && (
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-branch-bonus" className="bg-amber-600 hover:bg-amber-700 h-11 sm:h-9">
                      <Plus className="h-4 w-4 ml-2" />
                      إضافة مكافأة
                    </Button>
                  </DialogTrigger>
                  )}
                  <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>إضافة مكافأة فرع جديدة</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pl-1">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>الفرع</Label>
                          <Select value={newBranchBonus.branchId} onValueChange={(v) => setNewBranchBonus({ ...newBranchBonus, branchId: v })}>
                            <SelectTrigger data-testid="select-branch-bonus-branch" className="h-10"><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                            <SelectContent>
                              {branches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>الشهر</Label>
                          <Input type="month" value={newBranchBonus.yearMonth} onChange={(e) => setNewBranchBonus({ ...newBranchBonus, yearMonth: e.target.value })} data-testid="input-branch-bonus-month" className="h-10" />
                        </div>
                      </div>

                      {branchTargetEnabled && (
                        <div className={`p-3 rounded-lg border ${hasAutoTarget ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium">الهدف الشهري للفرع</span>
                              {branchTargetFetching && <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />}
                            </div>
                            {hasAutoTarget && (
                              <Badge variant="outline" className="text-[10px] px-1.5 h-5 border-green-400 text-green-700 bg-white">
                                <Check className="h-2.5 w-2.5 ml-0.5" />
                                من تخطيط الأهداف
                              </Badge>
                            )}
                          </div>
                          {hasAutoTarget ? (
                            <p className="text-lg font-bold text-green-700 mt-1">{formatCurrency(parseFloat(newBranchBonus.targetAmount))} ريال</p>
                          ) : !branchTargetFetching ? (
                            <div className="mt-2">
                              <p className="text-[11px] text-amber-700 mb-1">لم يتم العثور على هدف - أدخل يدوياً</p>
                              <Input 
                                type="number" 
                                value={newBranchBonus.targetAmount} 
                                onChange={(e) => setNewBranchBonus({ ...newBranchBonus, targetAmount: e.target.value })} 
                                placeholder="أدخل الهدف الشهري"
                                data-testid="input-branch-bonus-target" 
                                className="h-9 bg-white"
                              />
                            </div>
                          ) : null}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="flex items-center gap-1.5 text-sm font-semibold">
                            <Award className="h-4 w-4 text-amber-600" />
                            شرائح المكافأة حسب نسبة التحقيق
                          </Label>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                            onClick={() => setNewBranchBonus(prev => ({ ...prev, tiers: [...prev.tiers, { fromPercent: "", toPercent: "", bonusAmount: "" }] }))}
                            data-testid="button-add-tier"
                          >
                            <Plus className="h-3 w-3" />
                            إضافة شريحة
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {newBranchBonus.tiers.map((tier, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200" data-testid={`tier-row-${idx}`}>
                              <div className="flex items-center gap-1.5 flex-1">
                                <span className="text-xs text-gray-500 whitespace-nowrap">من</span>
                                <Input 
                                  type="number" 
                                  value={tier.fromPercent} 
                                  onChange={(e) => {
                                    const tiers = [...newBranchBonus.tiers];
                                    tiers[idx] = { ...tiers[idx], fromPercent: e.target.value };
                                    setNewBranchBonus(prev => ({ ...prev, tiers }));
                                  }}
                                  placeholder="80"
                                  className="h-8 w-16 text-center text-sm"
                                  data-testid={`input-tier-from-${idx}`}
                                />
                                <span className="text-xs text-gray-500">%</span>
                                <span className="text-xs text-gray-500 whitespace-nowrap">إلى</span>
                                <Input 
                                  type="number" 
                                  value={tier.toPercent} 
                                  onChange={(e) => {
                                    const tiers = [...newBranchBonus.tiers];
                                    tiers[idx] = { ...tiers[idx], toPercent: e.target.value };
                                    setNewBranchBonus(prev => ({ ...prev, tiers }));
                                  }}
                                  placeholder="فأعلى"
                                  className="h-8 w-16 text-center text-sm"
                                  data-testid={`input-tier-to-${idx}`}
                                />
                                <span className="text-xs text-gray-500">%</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-500">=</span>
                                <Input 
                                  type="number" 
                                  value={tier.bonusAmount} 
                                  onChange={(e) => {
                                    const tiers = [...newBranchBonus.tiers];
                                    tiers[idx] = { ...tiers[idx], bonusAmount: e.target.value };
                                    setNewBranchBonus(prev => ({ ...prev, tiers }));
                                  }}
                                  placeholder="2000"
                                  className="h-8 w-20 text-center text-sm font-bold"
                                  data-testid={`input-tier-amount-${idx}`}
                                />
                                <span className="text-xs text-gray-500">ر.س</span>
                              </div>
                              {newBranchBonus.tiers.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => setNewBranchBonus(prev => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== idx) }))}
                                  data-testid={`button-delete-tier-${idx}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        {newBranchBonus.tiers.length > 0 && newBranchBonus.tiers.some(t => t.bonusAmount) && (
                          <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800">
                            <span className="font-semibold">أقصى مكافأة: </span>
                            {formatCurrency(Math.max(...newBranchBonus.tiers.filter(t => t.bonusAmount).map(t => parseFloat(t.bonusAmount) || 0)))} ريال
                          </div>
                        )}
                      </div>

                      <div>
                        <Label>طريقة التوزيع على فريق العمل</Label>
                        <Select value={newBranchBonus.distributionMethod} onValueChange={(v) => setNewBranchBonus({ ...newBranchBonus, distributionMethod: v })}>
                          <SelectTrigger data-testid="select-distribution-method" className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contribution_ratio">حسب نسبة المساهمة في المبيعات</SelectItem>
                            <SelectItem value="equal">توزيع متساوي</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={() => createBranchBonusMutation.mutate(newBranchBonus)} 
                        disabled={createBranchBonusMutation.isPending || !newBranchBonus.branchId || !newBranchBonus.yearMonth || !newBranchBonus.targetAmount || newBranchBonus.tiers.some(t => !t.fromPercent || !t.bonusAmount)} 
                        className="bg-amber-600 hover:bg-amber-700" 
                        data-testid="button-save-branch-bonus"
                      >
                        {createBranchBonusMutation.isPending ? "جاري الحفظ..." : "حفظ المكافأة"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={editBonusDialogOpen} onOpenChange={(open) => { setEditBonusDialogOpen(open); if (!open) setEditBonusData(null); }}>
                  <DialogContent className="max-w-lg" dir="rtl">
                    <DialogHeader>
                      <DialogTitle>تعديل إعدادات المكافأة</DialogTitle>
                    </DialogHeader>
                    {editBonusData && (
                      <div className="space-y-4 max-h-[70vh] overflow-y-auto pl-1">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-gray-600">الفرع</Label>
                            <div className="h-10 flex items-center px-3 bg-gray-100 rounded border text-sm">
                              {branches.find(br => br.id === editBonusData.branchId)?.name || editBonusData.branchId}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">الشهر</Label>
                            <div className="h-10 flex items-center px-3 bg-gray-100 rounded border text-sm">
                              {editBonusData.yearMonth}
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-gray-600">الهدف الشهري (ريال)</Label>
                          <Input
                            type="number"
                            value={editBonusData.targetAmount}
                            onChange={(e) => setEditBonusData({ ...editBonusData, targetAmount: e.target.value })}
                            placeholder="أدخل الهدف الشهري"
                            className="h-10"
                            data-testid="input-edit-target"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="flex items-center gap-1.5 text-sm font-semibold">
                              <Award className="h-4 w-4 text-amber-600" />
                              شرائح المكافأة حسب نسبة التحقيق
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                              onClick={() => setEditBonusData(prev => prev ? { ...prev, tiers: [...prev.tiers, { fromPercent: "", toPercent: "", bonusAmount: "" }] } : prev)}
                              data-testid="button-edit-add-tier"
                            >
                              <Plus className="h-3 w-3" />
                              إضافة شريحة
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {editBonusData.tiers.map((tier, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200" data-testid={`edit-tier-row-${idx}`}>
                                <div className="flex items-center gap-1.5 flex-1">
                                  <span className="text-xs text-gray-500 whitespace-nowrap">من</span>
                                  <Input
                                    type="number"
                                    value={tier.fromPercent}
                                    onChange={(e) => {
                                      const t = [...editBonusData.tiers];
                                      t[idx] = { ...t[idx], fromPercent: e.target.value };
                                      setEditBonusData({ ...editBonusData, tiers: t });
                                    }}
                                    placeholder="80"
                                    className="h-8 w-16 text-center text-sm"
                                    data-testid={`input-edit-tier-from-${idx}`}
                                  />
                                  <span className="text-xs text-gray-500">%</span>
                                  <span className="text-xs text-gray-500 whitespace-nowrap">إلى</span>
                                  <Input
                                    type="number"
                                    value={tier.toPercent}
                                    onChange={(e) => {
                                      const t = [...editBonusData.tiers];
                                      t[idx] = { ...t[idx], toPercent: e.target.value };
                                      setEditBonusData({ ...editBonusData, tiers: t });
                                    }}
                                    placeholder="فأعلى"
                                    className="h-8 w-16 text-center text-sm"
                                    data-testid={`input-edit-tier-to-${idx}`}
                                  />
                                  <span className="text-xs text-gray-500">%</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-gray-500">=</span>
                                  <Input
                                    type="number"
                                    value={tier.bonusAmount}
                                    onChange={(e) => {
                                      const t = [...editBonusData.tiers];
                                      t[idx] = { ...t[idx], bonusAmount: e.target.value };
                                      setEditBonusData({ ...editBonusData, tiers: t });
                                    }}
                                    placeholder="2000"
                                    className="h-8 w-20 text-center text-sm font-bold"
                                    data-testid={`input-edit-tier-amount-${idx}`}
                                  />
                                  <span className="text-xs text-gray-500">ر.س</span>
                                </div>
                                {editBonusData.tiers.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => setEditBonusData(prev => prev ? { ...prev, tiers: prev.tiers.filter((_, i) => i !== idx) } : prev)}
                                    data-testid={`button-edit-delete-tier-${idx}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                          {editBonusData.tiers.length > 0 && editBonusData.tiers.some(t => t.bonusAmount) && (
                            <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200 text-xs text-amber-800">
                              <span className="font-semibold">أقصى مكافأة: </span>
                              {formatCurrency(Math.max(...editBonusData.tiers.filter(t => t.bonusAmount).map(t => parseFloat(t.bonusAmount) || 0)))} ريال
                            </div>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs text-gray-600">طريقة التوزيع على فريق العمل</Label>
                          <Select value={editBonusData.distributionMethod} onValueChange={(v) => setEditBonusData({ ...editBonusData, distributionMethod: v })}>
                            <SelectTrigger data-testid="select-edit-distribution-method" className="h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contribution_ratio">حسب نسبة المساهمة في المبيعات</SelectItem>
                              <SelectItem value="equal">توزيع متساوي</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setEditBonusDialogOpen(false); setEditBonusData(null); }}>
                        إلغاء
                      </Button>
                      <Button
                        onClick={() => {
                          if (!editBonusData) return;
                          const tiersData = editBonusData.tiers.filter(t => t.fromPercent && t.bonusAmount).map(t => ({
                            fromPercent: parseFloat(t.fromPercent),
                            toPercent: t.toPercent ? parseFloat(t.toPercent) : null,
                            bonusAmount: parseFloat(t.bonusAmount),
                          }));
                          const maxBonus = tiersData.length > 0 ? Math.max(...tiersData.map(t => t.bonusAmount)) : 0;
                          updateBranchBonusMutation.mutate({
                            id: editBonusData.id,
                            targetAmount: parseFloat(editBonusData.targetAmount) || 0,
                            distributionMethod: editBonusData.distributionMethod,
                            bonusTiers: JSON.stringify(tiersData),
                            bonusPool: maxBonus,
                          });
                        }}
                        disabled={updateBranchBonusMutation.isPending || !editBonusData?.targetAmount || editBonusData?.tiers.some(t => !t.fromPercent || !t.bonusAmount)}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="button-save-edit-bonus"
                      >
                        {updateBranchBonusMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {branchBonusLoading ? (
                  <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                ) : branchBonuses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">لا توجد مكافآت فروع مسجلة</div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="space-y-3">
                      {branchBonuses.map((b) => {
                        let tiers: any[] | null = null;
                        try { if (b.bonusTiers) tiers = JSON.parse(b.bonusTiers); } catch { tiers = null; }
                        let calcDetails: any = null;
                        try { if (b.calculationDetails) calcDetails = JSON.parse(b.calculationDetails); } catch { calcDetails = null; }
                        const isCalculated = b.calculationStatus === "calculated" || b.calculationStatus === "manual_adjusted";
                        const isManualAdjusted = b.calculationStatus === "manual_adjusted";
                        const isEditing = manualAdjustBonusId === b.id;
                        const isCalculating = calculatingBonusId === b.id;
                        return (
                          <div key={b.id} className={`border rounded-lg p-4 hover:shadow-sm transition-shadow ${isCalculated ? "border-green-300 bg-green-50/30" : ""}`} data-testid={`row-branch-bonus-${b.id}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div>
                                  <span className="font-semibold text-sm">{getBranchName(b.branchId)}</span>
                                  <span className="text-xs text-gray-500 mr-2">| {b.yearMonth}</span>
                                </div>
                                <Badge variant="outline" className="text-[10px] h-5">{b.distributionMethod === "contribution_ratio" ? "حسب المساهمة" : "توزيع متساوي"}</Badge>
                                {isCalculated && <Badge className="bg-green-600 text-[10px] h-5">تم الاحتساب</Badge>}
                              </div>
                              <div className="flex items-center gap-1">
                                {!isCalculated && (
                                  <Button
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs px-3"
                                    onClick={() => {
                                      if (window.confirm("هل تريد احتساب المكافأة لهذا الشهر؟ سيتم حساب المبيعات الفعلية ومقارنتها بالهدف وتوزيع المكافأة على الكاشيرات.")) {
                                        calculateBonusMutation.mutate(b.id);
                                      }
                                    }}
                                    disabled={isCalculating || calculateBonusMutation.isPending}
                                    data-testid={`button-calculate-bonus-${b.id}`}
                                  >
                                    {isCalculating ? (
                                      <><RefreshCw className="h-3.5 w-3.5 ml-1.5 animate-spin" /> جاري الاحتساب...</>
                                    ) : (
                                      <><Calculator className="h-3.5 w-3.5 ml-1.5" /> احتساب نهاية الشهر</>
                                    )}
                                  </Button>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 text-xs px-2 gap-1" data-testid={`button-actions-${b.id}`}>
                                      <MoreVertical className="h-4 w-4" />
                                      إجراءات
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    {(isAdmin || canEdit("smart_incentives_bonus")) && (
                                    <DropdownMenuItem
                                      className="text-xs gap-2 cursor-pointer"
                                      onClick={() => {
                                        const existingTiers = tiers || [];
                                        setEditBonusData({
                                          id: b.id,
                                          branchId: b.branchId,
                                          yearMonth: b.yearMonth,
                                          targetAmount: String(b.targetAmount),
                                          distributionMethod: b.distributionMethod,
                                          tiers: existingTiers.length > 0
                                            ? existingTiers.map((t: any) => ({ fromPercent: String(t.fromPercent), toPercent: String(t.toPercent || ""), bonusAmount: String(t.bonusAmount) }))
                                            : [{ fromPercent: "80", toPercent: "99", bonusAmount: "" }],
                                        });
                                        setEditBonusDialogOpen(true);
                                      }}
                                      data-testid={`menu-edit-settings-${b.id}`}
                                    >
                                      <Settings className="h-3.5 w-3.5 text-blue-600" />
                                      <span>تعديل الهدف والشرائح</span>
                                    </DropdownMenuItem>
                                    )}
                                    {(isAdmin || canEdit("smart_incentives_bonus")) && (
                                    <DropdownMenuItem
                                      className="text-xs gap-2 cursor-pointer"
                                      onClick={() => {
                                        const existingTiers = tiers || [];
                                        setEditBonusData({
                                          id: b.id,
                                          branchId: b.branchId,
                                          yearMonth: b.yearMonth,
                                          targetAmount: String(b.targetAmount),
                                          distributionMethod: b.distributionMethod === "contribution_ratio" ? "equal" : "contribution_ratio",
                                          tiers: existingTiers.length > 0
                                            ? existingTiers.map((t: any) => ({ fromPercent: String(t.fromPercent), toPercent: String(t.toPercent || ""), bonusAmount: String(t.bonusAmount) }))
                                            : [{ fromPercent: "80", toPercent: "99", bonusAmount: "" }],
                                        });
                                        setEditBonusDialogOpen(true);
                                      }}
                                      data-testid={`menu-change-distribution-${b.id}`}
                                    >
                                      <Users className="h-3.5 w-3.5 text-green-600" />
                                      <span>تغيير طريقة التوزيع</span>
                                    </DropdownMenuItem>
                                    )}
                                    {isCalculated && (isAdmin || canEdit("smart_incentives_bonus")) && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-xs gap-2 cursor-pointer"
                                          onClick={() => {
                                            setManualAdjustBonusId(b.id);
                                            const amounts: Record<string, string> = {};
                                            calcDetails?.distribution?.forEach((d: any) => { amounts[d.cashierId] = String(d.amount); });
                                            setManualAmounts(amounts);
                                            setManualComment("");
                                          }}
                                          data-testid={`menu-manual-adjust-${b.id}`}
                                        >
                                          <Pencil className="h-3.5 w-3.5 text-purple-600" />
                                          <span>تعديل يدوي في المكافأة</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-xs gap-2 cursor-pointer text-orange-600"
                                          onClick={() => {
                                            if (window.confirm("هل تريد إعادة تعيين الاحتساب؟ سيتم إلغاء جميع النقاط الموزعة على الكاشيرات.")) {
                                              resetCalculationMutation.mutate(b.id);
                                            }
                                          }}
                                          data-testid={`menu-reset-bonus-${b.id}`}
                                        >
                                          <RefreshCw className="h-3.5 w-3.5" />
                                          <span>إعادة الاحتساب</span>
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {(isAdmin || canDelete("smart_incentives_bonus")) && (
                                    <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-xs gap-2 cursor-pointer text-red-600"
                                      onClick={() => {
                                        if (window.confirm("هل تريد حذف هذه المكافأة نهائياً؟")) {
                                          deleteBranchBonusMutation.mutate(b.id);
                                        }
                                      }}
                                      data-testid={`menu-delete-bonus-${b.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      <span>حذف المكافأة</span>
                                    </DropdownMenuItem>
                                    </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                              <Target className="h-3.5 w-3.5 text-green-600" />
                              <span>الهدف: <span className="font-bold text-green-700">{formatCurrency(b.targetAmount)}</span></span>
                            </div>
                            {tiers && tiers.length > 0 ? (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {tiers.map((tier: any, idx: number) => (
                                  <div key={idx} className={`border rounded px-2.5 py-1.5 text-xs ${
                                    isCalculated && calcDetails && b.achievementPercent >= tier.fromPercent && (!tier.toPercent || b.achievementPercent <= tier.toPercent)
                                      ? "bg-green-100 border-green-400 ring-1 ring-green-400"
                                      : "bg-amber-50 border-amber-200"
                                  }`}>
                                    <span className="text-gray-600">{tier.fromPercent}%{tier.toPercent ? ` - ${tier.toPercent}%` : ' فأعلى'}</span>
                                    <span className="mx-1.5">=</span>
                                    <span className="font-bold text-amber-700">{formatCurrency(tier.bonusAmount)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 mb-2">
                                <span>المكافأة: <span className="font-bold text-green-600">{formatCurrency(b.bonusPool)}</span></span>
                              </div>
                            )}

                            {isCalculated && (
                              <div className="mt-3 border-t pt-3 space-y-2">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  <div className="bg-blue-50 rounded p-2 text-center">
                                    <div className="text-[10px] text-blue-600">المبيعات الفعلية</div>
                                    <div className="font-bold text-sm text-blue-800">{formatCurrency(b.actualSales || 0)}</div>
                                  </div>
                                  <div className="bg-purple-50 rounded p-2 text-center">
                                    <div className="text-[10px] text-purple-600">نسبة الإنجاز</div>
                                    <div className={`font-bold text-sm ${(b.achievementPercent || 0) >= 100 ? "text-green-700" : "text-purple-800"}`}>{b.achievementPercent || 0}%</div>
                                  </div>
                                  <div className="bg-green-50 rounded p-2 text-center">
                                    <div className="text-[10px] text-green-600">المكافأة المستحقة</div>
                                    <div className="font-bold text-sm text-green-800">{formatCurrency(b.matchedTierAmount || 0)}</div>
                                  </div>
                                  <div className="bg-amber-50 rounded p-2 text-center">
                                    <div className="text-[10px] text-amber-600">عدد الكاشيرات</div>
                                    <div className="font-bold text-sm text-amber-800">{calcDetails?.cashierCount || 0}</div>
                                  </div>
                                </div>

                                {calcDetails?.distribution && calcDetails.distribution.length > 0 && (
                                  <div className="mt-2">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <div className="text-xs font-semibold text-gray-700">
                                        {isManualAdjusted ? "التوزيع اليدوي:" : "توزيع المكافأة على الكاشيرات:"}
                                        {isManualAdjusted && <Badge className="bg-orange-500 text-[9px] h-4 mr-2">تعديل يدوي</Badge>}
                                      </div>
                                    </div>

                                    {isEditing ? (
                                      <div className="space-y-2 bg-purple-50/50 border border-purple-200 rounded-lg p-3">
                                        <div className="space-y-1.5">
                                          {calcDetails.distribution.map((d: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2 bg-white border rounded px-3 py-2 text-xs">
                                              <Users className="h-3 w-3 text-gray-400 shrink-0" />
                                              <span className="font-medium min-w-[80px]">{d.name}</span>
                                              <span className="text-gray-400 text-[10px]">مبيعات: {formatCurrency(d.sales)}</span>
                                              <div className="flex items-center gap-1 mr-auto">
                                                <Input
                                                  type="number"
                                                  value={manualAmounts[d.cashierId] || ""}
                                                  onChange={(e) => setManualAmounts(prev => ({ ...prev, [d.cashierId]: e.target.value }))}
                                                  className="h-7 w-24 text-xs text-center"
                                                  placeholder="المبلغ"
                                                  data-testid={`input-manual-amount-${d.cashierId}`}
                                                />
                                                <span className="text-[10px] text-gray-500">ريال</span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="bg-white border rounded p-2">
                                          <div className="flex items-center justify-between mb-1">
                                            <Label className="text-xs font-semibold text-purple-700">إجمالي التوزيع اليدوي</Label>
                                            <span className="text-sm font-bold text-purple-800">
                                              {formatCurrency(Object.values(manualAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0))} ريال
                                            </span>
                                          </div>
                                        </div>
                                        <div>
                                          <Label className="text-xs text-gray-600 mb-1 block">سبب التعديل اليدوي <span className="text-red-500">*</span></Label>
                                          <textarea
                                            value={manualComment}
                                            onChange={(e) => setManualComment(e.target.value)}
                                            className="w-full border rounded p-2 text-xs h-16 resize-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
                                            placeholder="اكتب سبب التعديل اليدوي للتوزيع..."
                                            data-testid="textarea-manual-comment"
                                          />
                                        </div>
                                        <div className="flex items-center gap-2 justify-end">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => { setManualAdjustBonusId(null); setManualAmounts({}); setManualComment(""); }}
                                          >
                                            إلغاء
                                          </Button>
                                          <Button
                                            size="sm"
                                            className="bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs px-4"
                                            disabled={!manualComment.trim() || manualAdjustMutation.isPending}
                                            onClick={() => {
                                              const adjustments = calcDetails.distribution.map((d: any) => ({
                                                cashierId: d.cashierId,
                                                name: d.name,
                                                sales: d.sales,
                                                amount: manualAmounts[d.cashierId] || "0",
                                              }));
                                              manualAdjustMutation.mutate({ id: b.id, adjustments, comment: manualComment });
                                            }}
                                            data-testid="button-save-manual-adjust"
                                          >
                                            {manualAdjustMutation.isPending ? "جاري الحفظ..." : "حفظ التوزيع اليدوي"}
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-1">
                                        {calcDetails.distribution.map((d: any, idx: number) => (
                                          <div key={idx} className={`flex items-center justify-between border rounded px-3 py-1.5 text-xs ${d.manualAdjust ? "bg-purple-50 border-purple-200" : "bg-white"}`}>
                                            <div className="flex items-center gap-2">
                                              <Users className="h-3 w-3 text-gray-400" />
                                              <span className="font-medium">{d.name}</span>
                                              {d.share > 0 && <span className="text-gray-400">({d.share}%)</span>}
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <span className="text-gray-500">مبيعات: {formatCurrency(d.sales)}</span>
                                              <span className="font-bold text-green-700">{formatCurrency(d.amount)} ريال</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {calcDetails?.manualAdjustment && !isEditing && (
                                      <div className="mt-2 bg-purple-50 border border-purple-200 rounded p-2 text-xs">
                                        <div className="flex items-center gap-1 text-purple-700 font-semibold mb-1">
                                          <Pencil className="h-3 w-3" />
                                          <span>ملاحظة التعديل اليدوي:</span>
                                        </div>
                                        <p className="text-purple-800">{calcDetails.manualAdjustment.comment}</p>
                                        <div className="text-[10px] text-purple-500 mt-1">
                                          إجمالي: {formatCurrency(calcDetails.manualAdjustment.totalAdjusted)} ريال
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(b.matchedTierAmount || 0) === 0 && !calcDetails?.manualAdjustment && (
                                  <div className="bg-orange-50 border border-orange-200 rounded p-2 text-xs text-orange-700">
                                    <span className="font-semibold">ملاحظة:</span> نسبة الإنجاز لم تصل لأي شريحة من شرائح المكافأة. لم يتم توزيع أي مكافأة.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>}

          {/* Tab 5: Cashier Wallet / Ledger */}
          {(isAdmin || canView("smart_incentives_wallet")) && <TabsContent value="wallet">
            <div className="space-y-4">
              {topCashierPoints.length > 0 && (
                <Card className="border-emerald-200" data-testid="wallet-top-performers">
                  <CardHeader className="bg-gradient-to-l from-emerald-50 to-transparent pb-2">
                    <CardTitle className="flex items-center gap-2 text-emerald-700 text-base">
                      <Trophy className="h-5 w-5 text-amber-500" />
                      أفضل الكاشيرين - {selectedMonth}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {topCashierPoints.slice(0, 5).map((cashier, idx) => (
                        <div
                          key={cashier.cashierId}
                          className={`border rounded-lg p-2 text-center cursor-pointer transition-colors hover:bg-emerald-50 ${walletCashierId === cashier.cashierId ? 'bg-emerald-100 border-emerald-400' : 'bg-white'}`}
                          onClick={() => { setWalletCashierId(cashier.cashierId); setWalletBranchId(cashier.branchId); }}
                          data-testid={`top-performer-${idx}`}
                        >
                          <div className="flex items-center justify-center gap-1 mb-1">
                            {idx === 0 && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                            <span className="text-xs font-medium text-gray-800 truncate">{cashier.cashierName}</span>
                          </div>
                          <div className="flex items-center justify-center gap-1">
                            <Star className="h-3 w-3 text-amber-400" />
                            <span className="text-sm font-bold text-emerald-700">{cashier.totalPoints}</span>
                          </div>
                          <div className="text-[10px] text-gray-500">{cashier.branchName}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-amber-600" />
                      رصيد الكاشير
                    </CardTitle>
                    <CardDescription>عرض رصيد النقاط والمعاملات</CardDescription>
                  </div>
                  {ledgerQueryEnabled && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/points-ledger"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/smart-incentives/points-summary"] });
                      }}
                      data-testid="btn-refresh-wallet"
                    >
                      <RefreshCw className="h-4 w-4 ml-1" />
                      تحديث
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <Label>الفرع</Label>
                      <Select value={walletBranchId} onValueChange={(v) => { setWalletBranchId(v); setWalletCashierId(""); }}>
                        <SelectTrigger data-testid="select-wallet-branch" className="h-11 sm:h-10"><SelectValue placeholder="جميع الفروع" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">جميع الفروع</SelectItem>
                          {branches.map((b) => (<SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>الكاشير</Label>
                      <Select value={walletCashierId} onValueChange={setWalletCashierId}>
                        <SelectTrigger data-testid="select-wallet-cashier" className="h-11 sm:h-10"><SelectValue placeholder="اختر الكاشير" /></SelectTrigger>
                        <SelectContent>
                          {allUsers
                            .filter((u: any) => {
                              const isCashier = u.isActive !== "inactive" && (u.role === "employee" || u.role === "cashier" || u.role === "admin");
                              if (!walletBranchId || walletBranchId === "all") return isCashier;
                              return isCashier && u.branchId === walletBranchId;
                            })
                            .map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username}
                                {u.jobTitle ? ` - ${u.jobTitle}` : ""}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                      {walletBranchId && walletBranchId !== "all" && (
                        <p className="text-xs text-blue-600 mt-1">يعرض فقط موظفي الفرع المحدد</p>
                      )}
                    </div>
                    <div>
                      <Label>من تاريخ</Label>
                      <Input type="date" value={walletDateFrom} onChange={(e) => setWalletDateFrom(e.target.value)} data-testid="input-wallet-date-from" className="h-11 sm:h-10" />
                    </div>
                    <div>
                      <Label>إلى تاريخ</Label>
                      <Input type="date" value={walletDateTo} onChange={(e) => setWalletDateTo(e.target.value)} data-testid="input-wallet-date-to" className="h-11 sm:h-10" />
                    </div>
                  </div>

                  {ledgerQueryEnabled && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="p-4 text-center">
                          <Star className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                          <p className="text-xs text-amber-700">إجمالي النقاط</p>
                          <p className="text-lg font-bold text-amber-900" data-testid="text-total-points">{walletSummary.totalPoints}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-green-200 bg-green-50">
                        <CardContent className="p-4 text-center">
                          <DollarSign className="h-5 w-5 text-green-600 mx-auto mb-1" />
                          <p className="text-xs text-green-700">إجمالي المبلغ</p>
                          <p className="text-lg font-bold text-green-900" data-testid="text-total-amount">{formatCurrency(walletSummary.totalAmount)}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="p-4 text-center">
                          <Calendar className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                          <p className="text-xs text-yellow-700">معلقة</p>
                          <p className="text-lg font-bold text-yellow-900" data-testid="text-pending-count">{walletSummary.pending}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-blue-200 bg-blue-50">
                        <CardContent className="p-4 text-center">
                          <Check className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                          <p className="text-xs text-blue-700">معتمدة</p>
                          <p className="text-lg font-bold text-blue-900" data-testid="text-approved-count">{walletSummary.approved}</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {!ledgerQueryEnabled ? (
                    <div className="text-center py-8 text-gray-500">اختر كاشير أو تاريخ لعرض الرصيد</div>
                  ) : ledgerLoading ? (
                    <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                  ) : ledgerEntries.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">لا توجد معاملات</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="min-w-[600px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>التاريخ</TableHead>
                            <TableHead>النوع</TableHead>
                            <TableHead className="hidden sm:table-cell">المصدر</TableHead>
                            <TableHead>النقاط</TableHead>
                            <TableHead>المبلغ</TableHead>
                            <TableHead>الحالة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledgerEntries.map((entry) => (
                            <TableRow key={entry.id} data-testid={`row-ledger-${entry.id}`}>
                              <TableCell className="text-xs sm:text-sm">{entry.transactionDate}</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{POINTS_TYPE_LABELS[entry.pointsType] || entry.pointsType}</Badge></TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{entry.sourceName || "-"}</TableCell>
                              <TableCell className="font-mono text-xs sm:text-sm font-bold text-amber-600">+{entry.pointsEarned}</TableCell>
                              <TableCell className="font-mono text-xs sm:text-sm text-green-600">{formatCurrency(entry.amountEarned)}</TableCell>
                              <TableCell>
                                <Badge className={`text-[10px] sm:text-xs ${AWARD_STATUS_COLORS[entry.status] || "bg-gray-500"}`}>
                                  {AWARD_STATUS_LABELS[entry.status] || entry.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>}

          {/* Tab 6: Awards History */}
          {(isAdmin || canView("smart_incentives_statements")) && <TabsContent value="awards">
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-amber-600" />
                      مستويات الحوافز
                    </CardTitle>
                    <CardDescription>تعريف مستويات المكافآت حسب نسبة تحقيق الهدف</CardDescription>
                  </div>
                  <Dialog open={showNewTierDialog} onOpenChange={setShowNewTierDialog}>
                    {(isAdmin || canCreate("smart_incentives_statements")) && (
                    <DialogTrigger asChild>
                      <Button data-testid="button-add-tier" className="h-11 sm:h-9">
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة مستوى
                      </Button>
                    </DialogTrigger>
                    )}
                    <DialogContent className="max-w-md" dir="rtl">
                      <DialogHeader>
                        <DialogTitle>إضافة مستوى حافز جديد</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>اسم المستوى</Label>
                          <Input value={newTier.name} onChange={(e) => setNewTier({ ...newTier, name: e.target.value })} placeholder="مثال: المستوى الذهبي" data-testid="input-tier-name" className="h-11 sm:h-10" />
                        </div>
                        <div>
                          <Label>الوصف</Label>
                          <Input value={newTier.description} onChange={(e) => setNewTier({ ...newTier, description: e.target.value })} placeholder="وصف المستوى" data-testid="input-tier-description" className="h-11 sm:h-10" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>الحد الأدنى %</Label>
                            <Input type="number" value={newTier.minAchievementPercent} onChange={(e) => setNewTier({ ...newTier, minAchievementPercent: e.target.value })} placeholder="80" data-testid="input-min-percent" className="h-11 sm:h-10" />
                          </div>
                          <div>
                            <Label>الحد الأقصى %</Label>
                            <Input type="number" value={newTier.maxAchievementPercent} onChange={(e) => setNewTier({ ...newTier, maxAchievementPercent: e.target.value })} placeholder="99" data-testid="input-max-percent" className="h-11 sm:h-10" />
                          </div>
                        </div>
                        <div>
                          <Label>نوع المكافأة</Label>
                          <Select value={newTier.rewardType} onValueChange={(v) => setNewTier({ ...newTier, rewardType: v })}>
                            <SelectTrigger data-testid="select-reward-type" className="h-11 sm:h-10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                              <SelectItem value="percentage">نسبة مئوية</SelectItem>
                              <SelectItem value="both">ثابت + نسبة</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>المبلغ الثابت (ريال)</Label>
                            <Input type="number" value={newTier.fixedAmount} onChange={(e) => setNewTier({ ...newTier, fixedAmount: e.target.value })} placeholder="500" data-testid="input-fixed-amount" className="h-11 sm:h-10" />
                          </div>
                          <div>
                            <Label>النسبة %</Label>
                            <Input type="number" value={newTier.percentageRate} onChange={(e) => setNewTier({ ...newTier, percentageRate: e.target.value })} placeholder="2" data-testid="input-percentage-rate" className="h-11 sm:h-10" />
                          </div>
                        </div>
                        <div>
                          <Label>الترتيب</Label>
                          <Input type="number" value={newTier.sortOrder} onChange={(e) => setNewTier({ ...newTier, sortOrder: e.target.value })} data-testid="input-sort-order" className="h-11 sm:h-10" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={() => createTierMutation.mutate(newTier)} disabled={createTierMutation.isPending || !newTier.name || !newTier.minAchievementPercent} className="bg-amber-600 hover:bg-amber-700" data-testid="button-save-tier">
                          {createTierMutation.isPending ? "جاري الحفظ..." : "حفظ المستوى"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {tiersLoading ? (
                    <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                  ) : tiers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">لا توجد مستويات حوافز</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="min-w-[600px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>المستوى</TableHead>
                            <TableHead className="hidden sm:table-cell">الوصف</TableHead>
                            <TableHead>من %</TableHead>
                            <TableHead>إلى %</TableHead>
                            <TableHead>نوع المكافأة</TableHead>
                            <TableHead className="hidden md:table-cell">المبلغ</TableHead>
                            <TableHead className="hidden md:table-cell">النسبة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tiers.map((tier) => (
                            <TableRow key={tier.id} data-testid={`row-tier-${tier.id}`}>
                              <TableCell className="font-medium text-xs sm:text-sm">{tier.name}</TableCell>
                              <TableCell className="text-xs hidden sm:table-cell">{tier.description || "-"}</TableCell>
                              <TableCell className="font-mono text-xs sm:text-sm">{tier.minAchievementPercent}%</TableCell>
                              <TableCell className="font-mono text-xs sm:text-sm">{tier.maxAchievementPercent}%</TableCell>
                              <TableCell><Badge variant="outline" className="text-xs">{REWARD_TYPE_LABELS[tier.rewardType] || tier.rewardType}</Badge></TableCell>
                              <TableCell className="font-mono text-xs hidden md:table-cell">{tier.fixedAmount ? formatCurrency(tier.fixedAmount) : "-"}</TableCell>
                              <TableCell className="font-mono text-xs hidden md:table-cell">{tier.percentageRate ? `${tier.percentageRate}%` : "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-amber-600" />
                      سجل الحوافز والمكافآت
                    </CardTitle>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => calculateIncentivesMutation.mutate()}
                      disabled={calculateIncentivesMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700 h-11 sm:h-9"
                      data-testid="button-calculate"
                    >
                      <Calculator className="h-4 w-4 ml-2" />
                      {calculateIncentivesMutation.isPending ? "جاري الحساب..." : "احسب الحوافز"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {calculatedAwards.length > 0 && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-green-800">الحوافز المحسوبة ({calculatedAwards.length})</h3>
                        <Button size="sm" onClick={() => saveCalculatedAwardsMutation.mutate(calculatedAwards)} disabled={saveCalculatedAwardsMutation.isPending} className="bg-green-600 hover:bg-green-700" data-testid="button-save-calculated">
                          {saveCalculatedAwardsMutation.isPending ? "جاري الحفظ..." : "حفظ الحوافز"}
                        </Button>
                      </div>
                      <div className="overflow-x-auto">
                        <Table className="min-w-[500px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>الفرع</TableHead>
                              <TableHead>الهدف</TableHead>
                              <TableHead>المحقق</TableHead>
                              <TableHead>النسبة</TableHead>
                              <TableHead>المستوى</TableHead>
                              <TableHead>المكافأة</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {calculatedAwards.map((a, i) => (
                              <TableRow key={i} data-testid={`row-calculated-${i}`}>
                                <TableCell className="text-xs sm:text-sm">{a.branchName}</TableCell>
                                <TableCell className="font-mono text-xs sm:text-sm">{formatCurrency(a.targetAmount)}</TableCell>
                                <TableCell className="font-mono text-xs sm:text-sm">{formatCurrency(a.achievedAmount)}</TableCell>
                                <TableCell className={`font-bold text-xs sm:text-sm ${a.achievementPercent >= 100 ? "text-green-600" : "text-amber-600"}`}>{a.achievementPercent.toFixed(1)}%</TableCell>
                                <TableCell className="text-xs sm:text-sm">{a.tierName}</TableCell>
                                <TableCell className="font-mono font-bold text-green-600 text-xs sm:text-sm">{formatCurrency(a.calculatedReward)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {awardsLoading ? (
                    <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                  ) : awards.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">لا توجد سجلات حوافز</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="min-w-[600px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>الفرع</TableHead>
                            <TableHead className="hidden md:table-cell">الفترة</TableHead>
                            <TableHead className="hidden sm:table-cell">الهدف</TableHead>
                            <TableHead className="hidden md:table-cell">المحقق</TableHead>
                            <TableHead>النسبة</TableHead>
                            <TableHead>الحافز</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead>الإجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {awards.map((award) => (
                            <TableRow key={award.id} data-testid={`row-award-${award.id}`}>
                              <TableCell className="font-medium text-xs sm:text-sm">{getBranchName(award.branchId)}</TableCell>
                              <TableCell className="text-xs sm:text-sm hidden md:table-cell">{award.periodStart} - {award.periodEnd}</TableCell>
                              <TableCell className="font-mono text-xs sm:text-sm hidden sm:table-cell">{formatCurrency(award.targetAmount)}</TableCell>
                              <TableCell className="font-mono text-xs sm:text-sm hidden md:table-cell">{formatCurrency(award.achievedAmount)}</TableCell>
                              <TableCell className={`font-bold text-xs sm:text-sm ${award.achievementPercent >= 100 ? "text-green-600" : "text-amber-600"}`}>
                                {award.achievementPercent.toFixed(1)}%
                              </TableCell>
                              <TableCell className="font-mono font-bold text-green-600 text-xs sm:text-sm">
                                {formatCurrency(award.finalReward)}
                              </TableCell>
                              <TableCell>
                                <Badge className={`text-[10px] sm:text-xs ${AWARD_STATUS_COLORS[award.status]}`}>
                                  {AWARD_STATUS_LABELS[award.status]}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {award.status === "pending" && (isAdmin || canApprove("smart_incentives_statements")) && (
                                    <Button size="sm" variant="outline" className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3" onClick={() => approveAwardMutation.mutate(award.id)} data-testid={`button-approve-${award.id}`}>
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {award.status === "approved" && (isAdmin || canApprove("smart_incentives_statements")) && (
                                    <Button size="sm" variant="outline" className="text-green-600 h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3" onClick={() => payAwardMutation.mutate(award.id)} data-testid={`button-pay-${award.id}`}>
                                      <DollarSign className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>}

          {/* Tab 7: Calculate Points */}
          {(isAdmin || canView("smart_incentives_wallet")) && <TabsContent value="calculate">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-green-600" />
                    احتساب النقاط من يوميات الكاشير
                  </CardTitle>
                  <CardDescription>
                    يتم احتساب النقاط تلقائياً عند اعتماد يومية الكاشير. يمكنك أيضاً تشغيل الاحتساب الجماعي لفترة محددة.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <h4 className="font-bold text-blue-800 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      كيف يعمل النظام
                    </h4>
                    <div className="text-sm text-blue-700 space-y-2">
                      <p><strong>1. الربط التلقائي:</strong> عند اعتماد يومية كاشير، يتم تلقائياً مقارنة بياناتها (متوسط الفاتورة، عدد العملاء، إجمالي المبيعات) بالتحديات اليومية المفعّلة.</p>
                      <p><strong>2. احتساب النقاط:</strong> إذا حقق الكاشير الهدف المطلوب، تُسجل النقاط الأساسية + الإضافية تلقائياً في محفظته.</p>
                      <p><strong>3. المعامل الموسمي:</strong> النقاط تُضرب في معامل الموسم المحدد في إعدادات النقاط.</p>
                      <p><strong>4. الحد اليومي:</strong> لا تتجاوز نقاط اليوم الواحد الحد الأقصى المحدد في الإعدادات.</p>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                    <h4 className="font-bold text-amber-800 flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      خطوات التشغيل
                    </h4>
                    <div className="text-sm text-amber-700 space-y-2">
                      <p>1. تأكد من إعداد <strong>إعدادات النقاط</strong> (قيمة النقطة، الحدود)</p>
                      <p>2. أنشئ <strong>تحديات يومية</strong> (متوسط الفاتورة / عدد العملاء / مبيعات الوردية)</p>
                      <p>3. عند اعتماد يومية كاشير → <strong>النقاط تُحسب تلقائياً</strong></p>
                      <p>4. راجع النتائج في تبويب <strong>رصيد الكاشير</strong></p>
                    </div>
                  </div>

                  <Card className="border-green-200">
                    <CardHeader className="bg-green-50">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Calculator className="h-4 w-4 text-green-600" />
                        احتساب جماعي لفترة محددة
                      </CardTitle>
                      <CardDescription>احتساب النقاط لجميع يوميات الكاشير المعتمدة في فترة محددة</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label>الفرع</Label>
                          <Select value={calcBranchId} onValueChange={setCalcBranchId}>
                            <SelectTrigger data-testid="select-calc-branch">
                              <SelectValue placeholder="اختر الفرع" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches.map((b: Branch) => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>من تاريخ</Label>
                          <Input type="date" value={calcDateFrom} onChange={(e) => setCalcDateFrom(e.target.value)} data-testid="input-calc-date-from" />
                        </div>
                        <div>
                          <Label>إلى تاريخ</Label>
                          <Input type="date" value={calcDateTo} onChange={(e) => setCalcDateTo(e.target.value)} data-testid="input-calc-date-to" />
                        </div>
                      </div>
                      <Button
                        onClick={() => batchCalcMutation.mutate()}
                        disabled={!calcBranchId || !calcDateFrom || !calcDateTo || batchCalcMutation.isPending}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        data-testid="button-batch-calculate"
                      >
                        {batchCalcMutation.isPending ? (
                          <span className="flex items-center gap-2">
                            <span className="animate-spin">⏳</span> جاري الاحتساب...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Calculator className="h-4 w-4" />
                            تشغيل الاحتساب الجماعي
                          </span>
                        )}
                      </Button>

                      {batchCalcResult && (
                        <div className="bg-green-50 border border-green-300 rounded-lg p-4 mt-4 space-y-4">
                          <h4 className="font-bold text-green-800 mb-2">نتائج الاحتساب</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="text-center p-3 bg-white rounded-lg border">
                              <p className="text-2xl font-bold text-green-700">{batchCalcResult.processedCount}</p>
                              <p className="text-xs text-gray-500">يومية تم معالجتها</p>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border">
                              <p className="text-2xl font-bold text-blue-700">{batchCalcResult.totalJournals}</p>
                              <p className="text-xs text-gray-500">إجمالي اليوميات</p>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border">
                              <p className="text-2xl font-bold text-amber-700">{batchCalcResult.totalPoints}</p>
                              <p className="text-xs text-gray-500">نقاط مكتسبة</p>
                            </div>
                            <div className="text-center p-3 bg-white rounded-lg border">
                              <p className="text-2xl font-bold text-purple-700">{batchCalcResult.totalAmount?.toFixed(2)} ر.س</p>
                              <p className="text-xs text-gray-500">القيمة المالية</p>
                            </div>
                          </div>
                          {batchCalcResult.journalDetails && batchCalcResult.journalDetails.length > 0 && (
                            <div className="mt-4">
                              <h5 className="font-semibold text-gray-700 mb-2">تفاصيل اليوميات</h5>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {batchCalcResult.journalDetails.map((jd) => (
                                  <div key={jd.journalId} className={`p-3 rounded-lg border text-sm ${jd.points > 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-medium">{jd.cashierName} - يومية #{jd.journalId}</span>
                                      <span className="text-xs text-gray-500">{jd.journalDate} | {jd.status}</span>
                                    </div>
                                    {jd.points > 0 ? (
                                      <p className="text-green-700 font-bold">+{jd.points} نقطة</p>
                                    ) : (
                                      <p className="text-yellow-700">0 نقطة</p>
                                    )}
                                    {jd.diagnostics && jd.diagnostics.length > 0 && (
                                      <div className="mt-1 space-y-1">
                                        {jd.diagnostics.map((d, idx) => (
                                          <div key={idx} className={`text-xs p-1.5 rounded ${d.met ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
                                            <span className="font-medium">{d.challengeName}</span>
                                            {d.met ? (
                                              <span> ✓ تحقق (الفعلي: {d.actualValue} | الهدف: {d.targetValue})</span>
                                            ) : (
                                              <span> ✗ {d.reason}</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {(!jd.diagnostics || jd.diagnostics.length === 0) && jd.points === 0 && (
                                      <p className="text-xs text-gray-500 mt-1">لا توجد تحديات مطابقة لهذه اليومية</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </div>
          </TabsContent>}
        </Tabs>
        )}
      </div>
    </Layout>
  );
}
