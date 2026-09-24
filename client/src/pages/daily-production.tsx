import { useState, useEffect, useRef, useMemo } from "react";
import { Layout } from "@/components/layout";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";
import { ar } from "date-fns/locale";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import type { Branch, Product } from "@shared/schema";
import { getSelectableCatalogRecords } from "@shared/catalog-activity";
import { 
  Factory, Plus, Clock, Package, Trash2, RefreshCw, Calendar,
  Refrigerator, ShoppingCart, Snowflake, ChefHat, ArrowLeft,
  BarChart3, TrendingUp, FileSpreadsheet, User, Shield, FileText,
  Printer, AlertTriangle, Timer, Activity, PieChart, Search, Zap,
  Sun, Moon, Sunset, Edit2, X, Check, ArrowUpDown, TrendingDown,
  Repeat, CheckCircle, FileDown, Coffee, UtensilsCrossed, Users
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { isOperationallyLinkedProductionBatch } from "@shared/manual-production-entry";
import {
  canEnterIndependentEntry,
  getProductionSource,
  getProductionSourceLabel,
  initialIndependentEntryAcknowledgementState,
  type ProductionSourceFields,
  reduceIndependentEntryAcknowledgement,
  type IndependentEntryAcknowledgementAction,
  type IndependentEntryAcknowledgementState,
} from "@/components/central-kitchen/manual-production-ui";
import {
  assertManualProductionStorageAvailable,
  canApplyManualProductionContextGate,
  clearManualProductionIntent,
  getManualProductionIntentContext,
  isManualProductionContextCurrent,
  isProductionDateAfter,
  type ManualProductionIntent,
  type ManualProductionContextIdentity,
  type ManualProductionOperationContext,
  ManualProductionIntentMismatchError,
  ManualProductionStorageError,
  postManualProductionOperation,
  prepareManualProductionIntent,
  readManualProductionIntent,
} from "@/components/central-kitchen/manual-production-operation";

interface DailyProductionBatch {
  id: number;
  branchId: string;
  productId: number | null;
  productName: string;
  productCategory: string | null;
  quantity: number;
  unit: string | null;
  destination: string;
  shiftId: number | null;
  productionOrderId: number | null;
  producedAt: string;
  productionDate?: string | null;
  recordedBy: string | null;
  recorderName: string | null;
  notes: string | null;
  createdAt: string;
  status: string | null;
  chefId: string | null;
  chefName: string | null;
  sourceBatchId: number | null;
  finishedAt: string | null;
  finishedById: string | null;
  finishedByName: string | null;
  centralKitchenOrderItemId: number | null;
  recipeBacked: boolean | null;
  centralKitchenIdempotencyKey?: string | null;
  centralKitchenPayloadFingerprint?: string | null;
}

interface ChefUser {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle?: string;
  branchId?: string;
}

const PRODUCTION_STATUSES = [
  { value: "finished", label: "مكتمل", color: "bg-green-100 text-green-800", icon: Check },
  { value: "in_progress", label: "قيد التحضير", color: "bg-amber-100 text-amber-800", icon: Timer },
];

interface DailyStats {
  totalBatches: number;
  totalQuantity: number;
  byDestination: Record<string, number>;
  byCategory: Record<string, number>;
  byHour: Record<string, number>;
}

const DESTINATIONS = [
  { value: "display_bar", label: "بار العرض", icon: ShoppingCart, color: "bg-green-100 text-green-800", bgClass: "from-green-500 to-emerald-600" },
  { value: "kitchen_trolley", label: "ترولي المطبخ", icon: ChefHat, color: "bg-amber-100 text-amber-800", bgClass: "from-amber-500 to-orange-600" },
  { value: "freezer", label: "الفريزر", icon: Snowflake, color: "bg-blue-100 text-blue-800", bgClass: "from-blue-500 to-indigo-600" },
  { value: "refrigerator", label: "الثلاجة", icon: Refrigerator, color: "bg-cyan-100 text-cyan-800", bgClass: "from-cyan-500 to-teal-600" },
];

const SHIFTS = [
  { value: "morning", label: "صباحي", icon: Sun, time: "6:00 - 14:00", color: "bg-amber-100 text-amber-800" },
  { value: "evening", label: "مسائي", icon: Sunset, time: "14:00 - 22:00", color: "bg-orange-100 text-orange-800" },
  { value: "night", label: "ليلي", icon: Moon, time: "22:00 - 6:00", color: "bg-indigo-100 text-indigo-800" },
];

const BAKERY_CATEGORIES = ["مخبوزات", "حلويات", "إفطار", "بيتزا", "تجمعات"];

const HOUR_LABELS: Record<string, string> = {
  "06": "6 صباحاً", "07": "7 صباحاً", "08": "8 صباحاً", "09": "9 صباحاً",
  "10": "10 صباحاً", "11": "11 صباحاً", "12": "12 ظهراً", "13": "1 مساءً",
  "14": "2 مساءً", "15": "3 مساءً", "16": "4 مساءً", "17": "5 مساءً",
  "18": "6 مساءً", "19": "7 مساءً", "20": "8 مساءً", "21": "9 مساءً",
  "22": "10 مساءً", "23": "11 مساءً", "00": "12 منتصف الليل",
};

const QUICK_QUANTITIES = [1, 2, 3, 5, 10, 12, 15, 20, 24, 30];

function ProductionSourceBadge({ batch, compact = false }: { batch: ProductionSourceFields & { id?: number }; compact?: boolean }) {
  const source = getProductionSource(batch);
  const label = getProductionSourceLabel(source);
  const isLinked = source !== "unlinked_legacy";
  const badge = (
    <Badge
      variant="outline"
      className={`${compact ? "text-[9px] h-5" : "text-xs h-6"} px-1.5 py-0 whitespace-nowrap ${
        source === "linked_recipe"
          ? "border-violet-300 bg-violet-50 text-violet-800"
          : source === "linked_without_recipe"
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : source === "linked_recipe_unknown"
              ? "border-sky-300 bg-sky-50 text-sky-800"
              : "border-stone-300 bg-stone-50 text-stone-700"
      }`}
      data-testid={batch.id ? `source-badge-${batch.id}` : undefined}
    >
      {label}
    </Badge>
  );

  // The API only exposes the order-item id here. Never turn that id into an
  // order id: operations is the truthful destination until the full request
  // context is available.
  return isLinked ? (
    <Link
      href="/production-dashboard?tab=operations"
      className="inline-flex max-w-full"
      title="فتح التشغيل الفعلي للمطبخ المركزي"
    >
      {badge}
    </Link>
  ) : badge;
}

export default function DailyProductionPage() {
  const [branchId, setBranchId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [productName, setProductName] = useState<string>("");
  const [productCategory, setProductCategory] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [destination, setDestination] = useState<string>("display_bar");
  const [selectedShift, setSelectedShift] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<string>("finished");
  const [entryAcknowledgement, setEntryAcknowledgement] = useState<IndependentEntryAcknowledgementState>(
    initialIndependentEntryAcknowledgementState,
  );
  const [selectedChefId, setSelectedChefId] = useState<string>("");
  const [selectedChefName, setSelectedChefName] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string>("entry");
  const [productSearch, setProductSearch] = useState<string>("");
  const [quickMode, setQuickMode] = useState<boolean>(true);
  const [showManualEntry, setShowManualEntry] = useState<boolean>(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("الكل");
  const [quantityDialogProduct, setQuantityDialogProduct] = useState<Product | null>(null);
  const [quickQuantity, setQuickQuantity] = useState<string>("");
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [editingBatch, setEditingBatch] = useState<DailyProductionBatch | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>("");
  const [editDestination, setEditDestination] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [showInProgressDialog, setShowInProgressDialog] = useState<boolean>(false);
  const [matchingInProgressBatch, setMatchingInProgressBatch] = useState<DailyProductionBatch | null>(null);
  const [pendingSubmitAction, setPendingSubmitAction] = useState<(() => boolean) | null>(null);
  const [carryOverBatch, setCarryOverBatch] = useState<DailyProductionBatch | null>(null);
  const [uncertainCreateIntent, setUncertainCreateIntent] = useState<ManualProductionIntent<Record<string, any>> | null>(null);
  const [uncertainRescheduleIntent, setUncertainRescheduleIntent] = useState<ManualProductionIntent<Record<string, any>> | null>(null);
  const [manualOperationStorageError, setManualOperationStorageError] = useState<string | null>(null);
  const [discardIntent, setDiscardIntent] = useState<ManualProductionIntent<Record<string, any>> | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { itemsPerPage, getPageItems } = usePagination(15);
  const { user, isAdmin } = useAuth();
  const { canEdit, canDelete } = usePermissions();

  const canModifyRecords = isAdmin || canEdit("production");
  const canDeleteRecords = isAdmin || canDelete("production");
  const independentEntryAcknowledged = entryAcknowledgement.normal;
  const carryOverAcknowledged = entryAcknowledgement.carryOver;
  const authenticatedUserId = user?.id ? String(user.id) : "";
  const latestManualContextRef = useRef<ManualProductionContextIdentity>({
    userId: authenticatedUserId,
    branchId,
  });
  const latestCreateIntentRef = useRef<ManualProductionIntent<Record<string, any>> | null>(uncertainCreateIntent);
  const latestRescheduleIntentRef = useRef<ManualProductionIntent<Record<string, any>> | null>(uncertainRescheduleIntent);
  const pendingSubmitContextRef = useRef<ManualProductionContextIdentity | null>(null);
  latestManualContextRef.current = { userId: authenticatedUserId, branchId };

  const updateCreateIntent = (intent: ManualProductionIntent<Record<string, any>> | null) => {
    latestCreateIntentRef.current = intent;
    setUncertainCreateIntent(intent);
  };

  const updateRescheduleIntent = (intent: ManualProductionIntent<Record<string, any>> | null) => {
    latestRescheduleIntentRef.current = intent;
    setUncertainRescheduleIntent(intent);
  };

  const dispatchEntryAcknowledgement = (action: IndependentEntryAcknowledgementAction) => {
    setEntryAcknowledgement(previous => reduceIndependentEntryAcknowledgement(previous, action));
  };

  const requireIndependentEntryAcknowledgement = () => {
    if (canEnterIndependentEntry(independentEntryAcknowledged)) return true;
    toast({
      title: "تأكيد الإدخال المستقل مطلوب",
      description: "فعّل مربع التأكيد الذي يوضح أن هذا التسجيل لا يرتبط بطلب مطبخ مركزي ولا يستهلك وصفة.",
      variant: "destructive",
    });
    return false;
  };

  const closeCarryOverDialog = () => {
    setCarryOverBatch(null);
    dispatchEntryAcknowledgement({ type: "close_carry_over" });
  };

  const operationContext = (operation: "create" | "reschedule"): ManualProductionOperationContext => ({
    userId: authenticatedUserId,
    branchId,
    operation,
  });

  const canApplyOperationCallback = (intent: ManualProductionIntent): boolean => {
    const activeIntentKey = intent.operation === "create"
      ? latestCreateIntentRef.current?.key
      : latestRescheduleIntentRef.current?.key;
    return canApplyManualProductionContextGate(
      latestManualContextRef.current,
      getManualProductionIntentContext(intent),
      intent.key,
      activeIntentKey,
    );
  };

  const isPendingSubmitContextCurrent = (): boolean => {
    const pendingContext = pendingSubmitContextRef.current;
    return !!pendingContext
      && pendingContext.userId === latestManualContextRef.current.userId
      && pendingContext.branchId === latestManualContextRef.current.branchId;
  };

  const showManualOperationStorageError = (error: unknown) => {
    const message = error instanceof Error ? error.message : "تعذر حفظ نية العملية بأمان.";
    setManualOperationStorageError(message);
    toast({
      title: "لم يتم إرسال الطلب",
      description: message,
      variant: "destructive",
    });
  };

  // Restoring an intent only renders the resume/discard controls.  It must
  // never cause a POST on mount, after a refresh, or after a branch switch.
  useEffect(() => {
    const restoringIdentity = { userId: authenticatedUserId, branchId };
    if (latestManualContextRef.current.userId !== restoringIdentity.userId
      || latestManualContextRef.current.branchId !== restoringIdentity.branchId) {
      return;
    }
    updateCreateIntent(null);
    updateRescheduleIntent(null);
    pendingSubmitContextRef.current = null;
    setPendingSubmitAction(null);
    setMatchingInProgressBatch(null);
    setShowInProgressDialog(false);
    setEditingBatch(null);
    setManualOperationStorageError(null);
    if (!authenticatedUserId || !branchId) return;
    try {
      assertManualProductionStorageAvailable();
      const restoredCreateIntent = readManualProductionIntent<Record<string, any>>(operationContext("create"));
      const restoredRescheduleIntent = readManualProductionIntent<Record<string, any>>(operationContext("reschedule"));
      if (latestManualContextRef.current.userId !== restoringIdentity.userId
        || latestManualContextRef.current.branchId !== restoringIdentity.branchId) {
        return;
      }
      updateCreateIntent(restoredCreateIntent);
      updateRescheduleIntent(restoredRescheduleIntent);
    } catch (error) {
      if (latestManualContextRef.current.userId !== restoringIdentity.userId
        || latestManualContextRef.current.branchId !== restoringIdentity.branchId) {
        return;
      }
      showManualOperationStorageError(error);
    }
  }, [authenticatedUserId, branchId]);

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  useEffect(() => {
    if (branches && branches.length > 0 && !branchId) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId]);

  // Auto-detect current shift
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) setSelectedShift("morning");
    else if (hour >= 14 && hour < 22) setSelectedShift("evening");
    else setSelectedShift("night");
  }, []);

  const { data: batches, isLoading: batchesLoading, refetch: refetchBatches } = useQuery<DailyProductionBatch[]>({
    queryKey: ["/api/daily-production/batches", branchId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      if (selectedDate) params.set("date", selectedDate);
      params.set("_t", Date.now().toString()); // Cache buster
      const res = await fetch(`/api/daily-production/batches?${params}`, { 
        credentials: "include",
        cache: "no-store"
      });
      if (!res.ok) throw new Error("Failed to fetch batches");
      return res.json();
    },
    enabled: !!branchId,
    refetchInterval: () => (autoRefresh && !(typeof document !== "undefined" && document.hidden) ? 60000 : false),
    staleTime: 15000,
  });

  const { data: stats } = useQuery<DailyStats>({
    queryKey: ["/api/daily-production/stats", branchId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId, date: selectedDate, _t: Date.now().toString() });
      const res = await fetch(`/api/daily-production/stats?${params}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!branchId && !!selectedDate,
    refetchInterval: () => (autoRefresh && !(typeof document !== "undefined" && document.hidden) ? 60000 : false),
    staleTime: 15000,
  });

  // Previous day stats for comparison
  const previousDate = format(subDays(new Date(selectedDate), 1), "yyyy-MM-dd");
  const { data: prevStats } = useQuery<DailyStats>({
    queryKey: ["/api/daily-production/stats", branchId, previousDate],
    queryFn: async () => {
      const params = new URLSearchParams({ branchId, date: previousDate });
      const res = await fetch(`/api/daily-production/stats?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch prev stats");
      return res.json();
    },
    enabled: !!branchId && !!selectedDate,
  });

  const { data: chefs } = useQuery<ChefUser[]>({
    queryKey: ["/api/daily-production/chefs", branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      const res = await fetch(`/api/daily-production/chefs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: !!branchId,
  });

  // Fetch unfinished batches for carry-over
  const { data: unfinishedBatches, refetch: refetchUnfinished } = useQuery<DailyProductionBatch[]>({
    queryKey: ["/api/daily-production/unfinished", branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      params.set("_t", Date.now().toString());
      const res = await fetch(`/api/daily-production/unfinished?${params}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: !!branchId,
    staleTime: 15000,
  });

  // Helper to check if product category is sweets (حلويات)
  const isSweetsCategory = (category: string | null | undefined) => {
    return category === "حلويات";
  };

  const handleChefSelect = (chefId: string) => {
    setSelectedChefId(chefId);
    const chef = chefs?.find(c => c.id === chefId);
    if (chef) {
      setSelectedChefName(chef.firstName || chef.username);
    }
  };

  // Find matching in-progress batch for a product
  const findMatchingInProgressBatch = (name: string, productId?: number | null): DailyProductionBatch | null => {
    if (!unfinishedBatches || unfinishedBatches.length === 0) return null;
    
    // First try to match by productId if available
    if (productId) {
      const matchById = unfinishedBatches.find(b => b.productId === productId && b.status === "in_progress");
      if (matchById) return matchById;
    }
    
    // Fall back to matching by product name (normalized)
    const normalizedName = name.trim().toLowerCase();
    return unfinishedBatches.find(b => 
      b.productName.trim().toLowerCase() === normalizedName && b.status === "in_progress"
    ) || null;
  };

  const createMutation = useMutation({
    mutationFn: async ({
      intent,
    }: {
      intent: ManualProductionIntent<Record<string, any>>;
    }) => {
      if (intent.payload.independentEntryAcknowledged !== true) {
        throw new Error("يلزم تأكيد الإدخال المستقل قبل التسجيل.");
      }
      return postManualProductionOperation<any>(intent.requestPath, intent);
    },
    onSuccess: (result: any, variables: { intent: ManualProductionIntent<Record<string, any>> }) => {
      if (!canApplyOperationCallback(variables.intent)) return;
      try {
        clearManualProductionIntent(variables.intent);
      } catch (error) {
        updateCreateIntent(variables.intent);
        showManualOperationStorageError(error);
        return;
      }
      updateCreateIntent(null);
      refetchBatches();
      refetchUnfinished();
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats", branchId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/finished-goods-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/display-bar/receipts"] });
      const submittedPayload = variables.intent.payload;
      const wasDisplayBar = submittedPayload.destination === "display_bar"
        && submittedPayload.status === "finished";
      if (!quickMode) {
        setProductName("");
        setProductCategory("");
        setQuantity("");
        setNotes("");
        setStatus("finished");
        setSelectedChefId("");
        setSelectedChefName("");
      } else {
        setQuantity("");
      }
      // An acknowledgement applies to the entry just submitted, not to
      // future records created by a later click or an Enter key.
      dispatchEntryAcknowledgement({ type: "normal_submit_success" });
      toast({ 
        title: "تم تسجيل الدفعة بنجاح", 
        description: wasDisplayBar 
          ? `تم الربط التلقائي مع بار العرض - سجلها: ${user?.firstName || user?.username}` 
          : `سجلها: ${user?.firstName || user?.username}` 
      });
    },
    onError: (
      error: any,
      variables: { intent: ManualProductionIntent<Record<string, any>> },
    ) => {
      if (!canApplyOperationCallback(variables.intent)) return;
      dispatchEntryAcknowledgement({ type: "normal_submit_error" });
      // Any non-success is retained conservatively.  A 400/401/403 can be
      // returned after the server has already received and committed work,
      // so only a durable success callback may clear this intent.
      updateCreateIntent(variables.intent);
      toast({
        title: error?.status === 409 ? "تعارض في مفتاح العملية" : "تعذر تأكيد وصول الطلب",
        description: error?.status === 409
          ? "تم الاحتفاظ بنفس الطلب والمفتاح؛ لا تم إنشاء مفتاح جديد. راجع الحالة ثم أعد المحاولة بنفس التأكيد."
          : "تم الاحتفاظ بالطلب والمفتاح حتى بعد الخطأ؛ قد يكون الخادم سجّل الدفعة. أعد المحاولة بنفس المفتاح أو تجاهلها صراحةً.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: any;
      context: ManualProductionContextIdentity;
    }) => {
      const knownBatch = [...(batches || []), ...(unfinishedBatches || [])]
        .find(batch => batch.id === id);
      if (knownBatch && isOperationallyLinkedProductionBatch(knownBatch)) {
        throw new Error("لا يمكن تعديل دفعة مرتبطة من سجل الإنتاج العام؛ افتح التشغيل المركزي.");
      }
      const res = await apiRequest("PATCH", `/api/daily-production/batches/${id}`, data);
      return res.json();
    },
    onSuccess: (_result: any, variables: { context: ManualProductionContextIdentity }) => {
      if (!isManualProductionContextCurrent(latestManualContextRef.current, variables.context)) return;
      refetchBatches();
      refetchUnfinished();
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats", branchId, selectedDate] });
      setEditingBatch(null);
      toast({ title: "تم تحديث الدفعة بنجاح" });
    },
    onError: (error: any, variables: { context: ManualProductionContextIdentity }) => {
      if (!isManualProductionContextCurrent(latestManualContextRef.current, variables.context)) return;
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: number; context: ManualProductionContextIdentity }) => {
      const knownBatch = [...(batches || []), ...(unfinishedBatches || [])]
        .find(batch => batch.id === id);
      if (knownBatch && isOperationallyLinkedProductionBatch(knownBatch)) {
        throw new Error("لا يمكن حذف دفعة مرتبطة من سجل الإنتاج العام؛ افتح التشغيل المركزي.");
      }
      await apiRequest("DELETE", `/api/daily-production/batches/${id}`);
    },
    onSuccess: (_result: any, variables: { context: ManualProductionContextIdentity }) => {
      if (!isManualProductionContextCurrent(latestManualContextRef.current, variables.context)) return;
      refetchBatches();
      refetchUnfinished();
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats", branchId, selectedDate] });
      toast({ title: "تم حذف الدفعة" });
    },
    onError: (error: any, variables: { context: ManualProductionContextIdentity }) => {
      if (!isManualProductionContextCurrent(latestManualContextRef.current, variables.context)) return;
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Finish a batch (mark as completed) - includes who finished it
  // Backend automatically transfers to finished goods inventory
  const finishBatchMutation = useMutation({
    mutationFn: async ({
      batchId,
    }: {
      batchId: number;
      context: ManualProductionContextIdentity;
    }) => {
      const knownBatch = [...(batches || []), ...(unfinishedBatches || [])]
        .find(batch => batch.id === batchId);
      if (knownBatch && isOperationallyLinkedProductionBatch(knownBatch)) {
        throw new Error("هذه الدفعة مرتبطة بتشغيل المطبخ المركزي؛ افتح التشغيل لمعاينة الوصفة قبل الإنهاء.");
      }
      const finisherName = user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.username || "";
      const res = await apiRequest("PATCH", `/api/daily-production/batches/${batchId}`, {
        status: "finished",
        finishedAt: new Date().toISOString(),
        finishedById: user?.id || null,
        finishedByName: finisherName || null,
      });
      return res.json();
    },
    onSuccess: (
      result: any,
      variables: { context: ManualProductionContextIdentity },
    ) => {
      if (!isManualProductionContextCurrent(latestManualContextRef.current, variables.context)) return;
      refetchBatches();
      refetchUnfinished();
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats", branchId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/finished-goods-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/display-bar/receipts"] });
      toast({ title: "تم اكتمال الدفعة", description: result?.destination === 'display_bar' ? "تم ترحيلها للمخزون وبار العرض تلقائياً" : "تم تحديث حالة الدفعة وترحيلها للمخزون النهائي" });
    },
    onError: (error: any, variables: { context: ManualProductionContextIdentity }) => {
      if (!isManualProductionContextCurrent(latestManualContextRef.current, variables.context)) return;
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Carry-over reschedules the existing row.  It never creates a copy, marks
  // the source finished, or posts output stock; only its production date
  // changes on the dedicated edit-protected endpoint.
  const carryOverMutation = useMutation({
    mutationFn: async ({
      intent,
      sourceBatch,
    }: {
      intent: ManualProductionIntent<Record<string, any>>;
      sourceBatch?: DailyProductionBatch;
    }) => {
      if (sourceBatch && isOperationallyLinkedProductionBatch(sourceBatch)) {
        throw new Error("لا يمكن ترحيل دفعة مرتبطة من الإدخال العام؛ افتح تشغيل المطبخ المركزي.");
      }
      if (intent.payload.independentEntryAcknowledged !== true) {
        throw new Error("يلزم تأكيد ترحيل الدفعة المستقلة قبل المتابعة.");
      }
      return postManualProductionOperation<any>(intent.requestPath, intent);
    },
    onSuccess: (result: any, variables: { intent: ManualProductionIntent<Record<string, any>> }) => {
      if (!canApplyOperationCallback(variables.intent)) return;
      if (!result || result.rescheduled !== true) {
        updateRescheduleIntent(variables.intent);
        dispatchEntryAcknowledgement({ type: "carry_over_submit_error" });
        toast({
          title: "نتيجة إعادة الجدولة غير مؤكدة",
          description: "احتُفظ بنفس الحمولة والمفتاح؛ راجع النية قبل إعادة المحاولة.",
          variant: "destructive",
        });
        return;
      }
      try {
        clearManualProductionIntent(variables.intent);
      } catch (error) {
        updateRescheduleIntent(variables.intent);
        showManualOperationStorageError(error);
        return;
      }
      updateRescheduleIntent(null);
      refetchBatches();
      refetchUnfinished();
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats", branchId, selectedDate] });
      dispatchEntryAcknowledgement({ type: "carry_over_submit_success" });
      closeCarryOverDialog();
      toast({
        title: "تمت إعادة الجدولة",
        description: "تم نقل نفس الدفعة إلى التاريخ المحدد (المعرف نفسه) دون إنشاء نسخة أو تحريك مخزون الناتج.",
      });
    },
    onError: (
      error: any,
      variables: { intent: ManualProductionIntent<Record<string, any>> },
    ) => {
      if (!canApplyOperationCallback(variables.intent)) return;
      dispatchEntryAcknowledgement({ type: "carry_over_submit_error" });
      // Retain every failed attempt, including permission/session/validation
      // responses.  Explicit discard is the only non-success clear path.
      updateRescheduleIntent(variables.intent);
      toast({
        title: error?.status === 409 ? "تعارض في مفتاح إعادة الجدولة" : "تعذر تأكيد إعادة الجدولة",
        description: error?.status === 409
          ? "تم الاحتفاظ بنفس إعادة الجدولة والمفتاح؛ لا تم إنشاء مفتاح جديد."
          : "تم الاحتفاظ بالترحيل والمفتاح حتى بعد الخطأ؛ قد يكون الخادم نقل الدفعة. أعد المحاولة بنفس المفتاح أو تجاهلها صراحةً.",
        variant: "destructive",
      });
    },
  });

  const submitManualCreate = (payload: Record<string, any>): boolean => {
    if (uncertainCreateIntent) {
      toast({
        title: "يوجد تسجيل غير محسوم",
        description: "استأنف أو تجاهل الطلب المحفوظ أولاً؛ لا يمكن استبدال حمولة قد تكون وصلت إلى الخادم.",
        variant: "destructive",
      });
      return false;
    }
    if (!authenticatedUserId || !branchId) {
      toast({ title: "بيانات ناقصة", description: "يلزم المستخدم والفرع قبل التسجيل.", variant: "destructive" });
      return false;
    }
    const requestPath = "/api/daily-production/batches";
    let preparation: {
      intent: ManualProductionIntent<Record<string, any>>;
      reused: boolean;
    };
    try {
      preparation = prepareManualProductionIntent(
        operationContext("create"),
        payload,
        requestPath,
      );
    } catch (error) {
      if (error instanceof ManualProductionIntentMismatchError) {
        updateCreateIntent(error.existingIntent as ManualProductionIntent<Record<string, any>>);
        dispatchEntryAcknowledgement({ type: "set_normal", value: false });
        toast({
          title: "يوجد تسجيل محفوظ ببيانات مختلفة",
          description: "استأنف أو تجاهل التسجيل المحفوظ صراحةً؛ لم يتم تغيير مفتاحه.",
          variant: "destructive",
        });
      } else {
        showManualOperationStorageError(error);
      }
      return false;
    }
    if (preparation.reused) {
      updateCreateIntent(preparation.intent);
      dispatchEntryAcknowledgement({ type: "set_normal", value: false });
      toast({
        title: "يوجد تسجيل غير محسوم",
        description: "استخدم زر إعادة المحاولة في التنبيه؛ ستُستخدم الحمولة الأصلية والمفتاح نفسه.",
        variant: "destructive",
      });
      return false;
    }
    setManualOperationStorageError(null);
    updateCreateIntent(preparation.intent);
    createMutation.mutate({ intent: preparation.intent });
    return true;
  };

  // Helper to execute the actual batch creation
  const executeCreateBatch = () => {
    if (!requireIndependentEntryAcknowledgement()) return false;
    const numericQuantity = parseInt(quantity, 10);
    const product = products?.find(p => p.name === productName);
    const resolvedCategory = productCategory || product?.category || null;
    const payload = {
      branchId,
      productId: product?.id || null,
      productName,
      productCategory: resolvedCategory,
      quantity: numericQuantity,
      unit: product?.unit || "قطعة",
      destination,
      notes: notes || null,
      productionDate: selectedDate, // User's local date for timezone-independent filtering
      status: isSweetsCategory(resolvedCategory) ? status : "finished",
      chefId: selectedChefId || null,
      chefName: selectedChefName || null,
      independentEntryAcknowledged: true,
    };
    return submitManualCreate(payload);
  };

  const handleSubmit = (e: React.FormEvent): boolean => {
    e.preventDefault();
    if (!branchId || !productName || !quantity || !destination) {
      toast({ title: "بيانات ناقصة", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return false;
    }
    if (!selectedChefId) {
      toast({ title: "بيانات ناقصة", description: "يرجى اختيار الشيف المنتج", variant: "destructive" });
      return false;
    }
    if (!requireIndependentEntryAcknowledgement()) return false;
    if (uncertainCreateIntent) {
      toast({
        title: "يوجد تسجيل غير محسوم",
        description: "استأنف أو تجاهل التسجيل المحفوظ قبل تعديل أو إرسال إدخال جديد.",
        variant: "destructive",
      });
      return false;
    }
    
    const numericQuantity = parseInt(quantity, 10);
    if (isNaN(numericQuantity) || numericQuantity <= 0) {
      toast({ title: "خطأ", description: "الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر", variant: "destructive" });
      return false;
    }
    
    const product = products?.find(p => p.name === productName);
    const resolvedCategory = productCategory || product?.category || null;
    
    // Check for matching in-progress batch (only for sweets category)
    if (isSweetsCategory(resolvedCategory)) {
      const matchingBatch = findMatchingInProgressBatch(productName, product?.id);
      if (matchingBatch) {
        // Show dialog to ask user what to do
        setMatchingInProgressBatch(matchingBatch);
        pendingSubmitContextRef.current = latestManualContextRef.current;
        setPendingSubmitAction(() => executeCreateBatch);
        dispatchEntryAcknowledgement({ type: "begin_in_progress" });
        setShowInProgressDialog(true);
        setShowManualEntry(false);
        return false;
      }
    }
    
    // No matching in-progress batch, proceed normally
    executeCreateBatch();
    return true;
  };

  // Handle dialog: mark existing as finished, then create new batch
  const handleFinishExistingAndCreate = async () => {
    if (!matchingInProgressBatch) return;
    if (!isPendingSubmitContextCurrent()) {
      setShowInProgressDialog(false);
      setMatchingInProgressBatch(null);
      setPendingSubmitAction(null);
      pendingSubmitContextRef.current = null;
      return;
    }
    if (isOperationallyLinkedProductionBatch(matchingInProgressBatch)) {
      toast({
        title: "هذه الدفعة تُدار من تشغيل المطبخ المركزي",
        description: "افتح التشغيل الفعلي لمراجعة الوصفة ومعاينة الإنهاء قبل أي أثر مخزني.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await finishBatchMutation.mutateAsync({
        batchId: matchingInProgressBatch.id,
        context: pendingSubmitContextRef.current || latestManualContextRef.current,
      });
      if (!isPendingSubmitContextCurrent()) return;
      // After finishing, execute the pending create action
      if (pendingSubmitAction) {
        const submitted = pendingSubmitAction();
        if (!submitted) dispatchEntryAcknowledgement({ type: "cancel_in_progress" });
      }
    } catch (error) {
      if (isPendingSubmitContextCurrent()) {
        dispatchEntryAcknowledgement({ type: "cancel_in_progress" });
      }
      console.error("Error finishing batch:", error);
    } finally {
      if (isPendingSubmitContextCurrent()) {
        setShowInProgressDialog(false);
        setMatchingInProgressBatch(null);
        setPendingSubmitAction(null);
      }
      pendingSubmitContextRef.current = null;
    }
  };

  // Handle dialog: continue with new batch without finishing existing
  const handleContinueNewBatch = () => {
    if (!isPendingSubmitContextCurrent()) {
      setShowInProgressDialog(false);
      setMatchingInProgressBatch(null);
      setPendingSubmitAction(null);
      pendingSubmitContextRef.current = null;
      return;
    }
    let submitted = false;
    if (pendingSubmitAction) {
      submitted = pendingSubmitAction();
    }
    if (!submitted) dispatchEntryAcknowledgement({ type: "cancel_in_progress" });
    setShowInProgressDialog(false);
    setMatchingInProgressBatch(null);
    setPendingSubmitAction(null);
    pendingSubmitContextRef.current = null;
  };

  // Handle dialog: cancel
  const handleCancelInProgressDialog = () => {
    dispatchEntryAcknowledgement({ type: "cancel_in_progress" });
    setShowInProgressDialog(false);
    setMatchingInProgressBatch(null);
    setPendingSubmitAction(null);
    pendingSubmitContextRef.current = null;
  };

  // Helper to execute quick entry batch creation
  const executeQuickEntry = (product: Product, qty: number) => {
    if (!requireIndependentEntryAcknowledgement()) return false;
    if (uncertainCreateIntent) {
      toast({
        title: "يوجد تسجيل غير محسوم",
        description: "استأنف أو تجاهل التسجيل المحفوظ قبل إرسال إدخال جديد.",
        variant: "destructive",
      });
      return false;
    }
    const payload = {
      branchId,
      productId: product.id,
      productName: product.name,
      productCategory: product.category,
      quantity: qty,
      unit: product.unit || "قطعة",
      destination,
      notes: null,
      productionDate: selectedDate, // User's local date for timezone-independent filtering
      status: isSweetsCategory(product.category) ? status : "finished",
      chefId: selectedChefId || null,
      chefName: selectedChefName || null,
      independentEntryAcknowledged: true,
    };
    return submitManualCreate(payload);
  };

  const handleQuickEntry = (product: Product, qty: number): boolean => {
    if (!requireIndependentEntryAcknowledgement()) return false;
    // Check for matching in-progress batch (only for sweets category)
    if (isSweetsCategory(product.category)) {
      const matchingBatch = findMatchingInProgressBatch(product.name, product.id);
      if (matchingBatch) {
        // Show dialog to ask user what to do
        setMatchingInProgressBatch(matchingBatch);
        pendingSubmitContextRef.current = latestManualContextRef.current;
        setPendingSubmitAction(() => () => executeQuickEntry(product, qty));
        dispatchEntryAcknowledgement({ type: "begin_in_progress" });
        setShowInProgressDialog(true);
        return true;
      }
    }
    
    // No matching in-progress batch, proceed normally
    executeQuickEntry(product, qty);
    return true;
  };

  const restoreCreateIntent = () => {
    const intent = uncertainCreateIntent;
    if (!intent) return;
    if (!canApplyOperationCallback(intent)) return;
    const payload = intent.payload;
    setBranchId(String(payload.branchId || branchId));
    setSelectedDate(String(payload.productionDate || selectedDate));
    setProductName(String(payload.productName || ""));
    setProductCategory(String(payload.productCategory || ""));
    setQuantity(String(payload.quantity || ""));
    setDestination(String(payload.destination || "display_bar"));
    setStatus(String(payload.status || "finished"));
    setSelectedChefId(String(payload.chefId || ""));
    setSelectedChefName(String(payload.chefName || ""));
    setNotes(String(payload.notes || ""));
    // A retry always requires the acknowledgement again, including after a
    // refresh restored this intent.
    dispatchEntryAcknowledgement({ type: "set_normal", value: false });
    toast({
      title: "تمت استعادة بيانات التسجيل",
      description: "راجع البيانات ثم فعّل التأكيد. ستستخدم إعادة المحاولة الحمولة الأصلية والمفتاح نفسه.",
    });
  };

  const retryCreateIntent = () => {
    const intent = uncertainCreateIntent;
    if (!intent) return;
    if (!canApplyOperationCallback(intent)) return;
    if (!requireIndependentEntryAcknowledgement()) return;
    try {
      const current = readManualProductionIntent<Record<string, any>>(
        getManualProductionIntentContext(intent),
      );
      if (!current || current.key !== intent.key) {
        throw new ManualProductionStorageError("تعذر العثور على نفس التسجيل المحفوظ؛ لم يتم إنشاء مفتاح بديل.");
      }
      createMutation.mutate({ intent: current });
    } catch (error) {
      showManualOperationStorageError(error);
    }
  };

  const restoreRescheduleIntent = () => {
    const intent = uncertainRescheduleIntent;
    if (!intent) return;
    if (!canApplyOperationCallback(intent)) return;
    setSelectedDate(String(intent.payload.productionDate || selectedDate));
    dispatchEntryAcknowledgement({ type: "set_carry_over", value: false });
    toast({
      title: "تمت استعادة إعادة الجدولة",
      description: "فعّل تأكيد الترحيل ثم أعد المحاولة. ستستخدم نفس المعرف والمفتاح والحمولة.",
    });
  };

  const retryRescheduleIntent = () => {
    const intent = uncertainRescheduleIntent;
    if (!intent) return;
    if (!canApplyOperationCallback(intent)) return;
    if (!canEnterIndependentEntry(carryOverAcknowledged)) {
      toast({
        title: "تأكيد الترحيل مطلوب",
        description: "فعّل التأكيد مرة أخرى قبل إعادة إرسال نفس العملية.",
        variant: "destructive",
      });
      return;
    }
    try {
      const current = readManualProductionIntent<Record<string, any>>(
        getManualProductionIntentContext(intent),
      );
      if (!current || current.key !== intent.key) {
        throw new ManualProductionStorageError("تعذر العثور على نفس إعادة الجدولة؛ لم يتم إنشاء مفتاح بديل.");
      }
      carryOverMutation.mutate({ intent: current });
    } catch (error) {
      showManualOperationStorageError(error);
    }
  };

  const askDiscardIntent = (intent: ManualProductionIntent<Record<string, any>>) => {
    setDiscardIntent(intent);
  };

  const confirmDiscardIntent = () => {
    const intent = discardIntent;
    if (!intent) return;
    if (!canApplyOperationCallback(intent)) {
      setDiscardIntent(null);
      return;
    }
    try {
      clearManualProductionIntent(intent);
      if (intent.operation === "create") {
        updateCreateIntent(null);
      } else {
        updateRescheduleIntent(null);
      }
      setDiscardIntent(null);
      if (intent.operation === "reschedule") closeCarryOverDialog();
      toast({
        title: "تم تجاهل النية المحفوظة",
        description: "قد يكون الخادم سجّل العملية بالفعل؛ لن تتم إعادة المحاولة تلقائياً.",
      });
    } catch (error) {
      showManualOperationStorageError(error);
    }
  };

  const openCarryOver = (sourceBatch: DailyProductionBatch) => {
    if (!canModifyRecords) {
      toast({ title: "لا تملك صلاحية التعديل", description: "إعادة الجدولة تتطلب صلاحية تعديل الإنتاج.", variant: "destructive" });
      return;
    }
    if (uncertainRescheduleIntent) {
      toast({
        title: "يوجد ترحيل غير محسوم",
        description: "استأنف أو تجاهل إعادة الجدولة المحفوظة أولاً.",
        variant: "destructive",
      });
      return;
    }
    if (isOperationallyLinkedProductionBatch(sourceBatch)) {
      toast({
        title: "هذه الدفعة تُدار من تشغيل المطبخ المركزي",
        description: "لا يمكن إعادة جدولة دفعة مرتبطة؛ افتح التشغيل الفعلي.",
        variant: "destructive",
      });
      return;
    }
    const sourceDateForValidation = sourceBatch.productionDate
      || format(new Date(sourceBatch.producedAt), "yyyy-MM-dd");
    if (!isProductionDateAfter(selectedDate, sourceDateForValidation)) {
      toast({
        title: "تاريخ الترحيل غير صالح",
        description: "يجب أن يكون التاريخ المحدد بعد تاريخ إنتاج الدفعة المصدر.",
        variant: "destructive",
      });
      return;
    }
    setCarryOverBatch(sourceBatch);
    dispatchEntryAcknowledgement({ type: "open_carry_over" });
  };

  const submitCarryOver = () => {
    const sourceBatch = carryOverBatch;
    if (!sourceBatch) return;
    if (!canModifyRecords) {
      toast({ title: "لا تملك صلاحية التعديل", description: "إعادة الجدولة تتطلب صلاحية تعديل الإنتاج.", variant: "destructive" });
      return;
    }
    if (isOperationallyLinkedProductionBatch(sourceBatch)) {
      toast({
        title: "هذه الدفعة تُدار من تشغيل المطبخ المركزي",
        description: "لا يمكن إعادة جدولة دفعة مرتبطة؛ افتح التشغيل الفعلي.",
        variant: "destructive",
      });
      return;
    }
    if (!canEnterIndependentEntry(carryOverAcknowledged)) {
      toast({
        title: "تأكيد الترحيل مطلوب",
        description: "فعّل مربع التأكيد قبل إعادة جدولة الدفعة.",
        variant: "destructive",
      });
      return;
    }
    const sourceDateForValidation = sourceBatch.productionDate
      || format(new Date(sourceBatch.producedAt), "yyyy-MM-dd");
    if (!isProductionDateAfter(selectedDate, sourceDateForValidation)) {
      toast({
        title: "تاريخ الترحيل غير صالح",
        description: "يجب أن يكون التاريخ المحدد بعد تاريخ إنتاج الدفعة المصدر.",
        variant: "destructive",
      });
      return;
    }
    if (!authenticatedUserId || !branchId) {
      showManualOperationStorageError(new ManualProductionStorageError("يلزم المستخدم والفرع قبل إعادة الجدولة."));
      return;
    }
    const requestPath = `/api/daily-production/batches/${sourceBatch.id}/reschedule`;
    const payload = {
      branchId,
      productionDate: selectedDate,
      expectedProductionDate: sourceBatch.productionDate ?? null,
      expectedQuantity: sourceBatch.quantity,
      independentEntryAcknowledged: true,
    };
    let preparation: {
      intent: ManualProductionIntent<Record<string, any>>;
      reused: boolean;
    };
    try {
      preparation = prepareManualProductionIntent(
        operationContext("reschedule"),
        payload,
        requestPath,
      );
    } catch (error) {
      if (error instanceof ManualProductionIntentMismatchError) {
        updateRescheduleIntent(error.existingIntent as ManualProductionIntent<Record<string, any>>);
        dispatchEntryAcknowledgement({ type: "set_carry_over", value: false });
        toast({
          title: "يوجد ترحيل محفوظ ببيانات مختلفة",
          description: "استأنف أو تجاهل إعادة الجدولة المحفوظة صراحةً؛ لم يتم تغيير مفتاحها.",
          variant: "destructive",
        });
      } else {
        showManualOperationStorageError(error);
      }
      return;
    }
    if (preparation.reused) {
      updateRescheduleIntent(preparation.intent);
      dispatchEntryAcknowledgement({ type: "set_carry_over", value: false });
      toast({
        title: "يوجد ترحيل غير محسوم",
        description: "استخدم زر إعادة المحاولة؛ ستُستخدم الحمولة الأصلية والمفتاح نفسه.",
        variant: "destructive",
      });
      return;
    }
    setManualOperationStorageError(null);
    updateRescheduleIntent(preparation.intent);
    carryOverMutation.mutate({ intent: preparation.intent, sourceBatch });
  };

  const handleEditSave = () => {
    if (!editingBatch) return;
    const qty = parseInt(editQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "خطأ", description: "الكمية غير صحيحة", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: editingBatch.id,
      data: {
        quantity: qty,
        destination: editDestination,
        notes: editNotes || null,
      },
      context: latestManualContextRef.current,
    });
  };

  const openEditDialog = (batch: DailyProductionBatch) => {
    if (isOperationallyLinkedProductionBatch(batch)) {
      toast({
        title: "التعديل من التشغيل المركزي فقط",
        description: "لا يمكن تعديل دفعة مرتبطة أو مرتبطة بوصفة من سجل الإنتاج العام.",
        variant: "destructive",
      });
      return;
    }
    setEditingBatch(batch);
    setEditQuantity(batch.quantity.toString());
    setEditDestination(batch.destination);
    setEditNotes(batch.notes || "");
  };

  const getDestinationInfo = (dest: string) => {
    return DESTINATIONS.find(d => d.value === dest) || { label: dest, color: "bg-gray-100 text-gray-800", icon: Package, bgClass: "from-gray-500 to-slate-600" };
  };

  const formatTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "HH:mm", { locale: ar });
    } catch {
      return "";
    }
  };

  const formatFullDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "yyyy/MM/dd HH:mm:ss", { locale: ar });
    } catch {
      return dateStr;
    }
  };

  const getBranchName = (id: string) => branches?.find(b => b.id === id)?.name || id;

  const paginatedBatches = getPageItems(batches || [], currentPage);

  const batchesByHour = (batches || []).reduce((acc, batch) => {
    const hour = format(new Date(batch.producedAt), "HH");
    if (!acc[hour]) acc[hour] = [];
    acc[hour].push(batch);
    return acc;
  }, {} as Record<string, DailyProductionBatch[]>);

  const batchesByCategory = (batches || []).reduce((acc, batch) => {
    const cat = batch.productCategory || "غير مصنف";
    if (!acc[cat]) acc[cat] = { batches: [], totalQty: 0 };
    acc[cat].batches.push(batch);
    acc[cat].totalQty += batch.quantity;
    return acc;
  }, {} as Record<string, { batches: DailyProductionBatch[], totalQty: number }>);

  const batchesByDestination = (batches || []).reduce((acc, batch) => {
    if (!acc[batch.destination]) acc[batch.destination] = { batches: [], totalQty: 0 };
    acc[batch.destination].batches.push(batch);
    acc[batch.destination].totalQty += batch.quantity;
    return acc;
  }, {} as Record<string, { batches: DailyProductionBatch[], totalQty: number }>);

  const batchesByRecorder = (batches || []).reduce((acc, batch) => {
    const recorder = batch.recorderName || "غير معروف";
    if (!acc[recorder]) acc[recorder] = { batches: [], totalQty: 0 };
    acc[recorder].batches.push(batch);
    acc[recorder].totalQty += batch.quantity;
    return acc;
  }, {} as Record<string, { batches: DailyProductionBatch[], totalQty: number }>);

  // Filter products by search
  const bakeryProducts = useMemo(() => {
    const filtered = getSelectableCatalogRecords(products || []).filter(p =>
      p.category
      && BAKERY_CATEGORIES.includes(p.category)
    ) || [];
    if (!productSearch) return filtered;
    const search = productSearch.toLowerCase();
    return filtered.filter(p => 
      p.name.toLowerCase().includes(search) ||
      (p.category ?? "").toLowerCase().includes(search)
    );
  }, [products, productSearch]);

  // Popular products (most used today)
  const popularProducts = useMemo(() => {
    if (!batches || !products) return [];
    const productCounts: Record<string, number> = {};
    batches.forEach(b => {
      productCounts[b.productName] = (productCounts[b.productName] || 0) + 1;
    });
    return getSelectableCatalogRecords(products)
      .filter(p =>
        p.category
        && BAKERY_CATEGORIES.includes(p.category)
      )
      .sort((a, b) => (productCounts[b.name] || 0) - (productCounts[a.name] || 0))
      .slice(0, 8);
  }, [batches, products]);

  const categoryFilteredProducts = useMemo(() => {
    const allBakery = getSelectableCatalogRecords(products || []).filter(p =>
      p.category
      && BAKERY_CATEGORIES.includes(p.category)
    ) || [];
    let filtered = selectedCategoryFilter === "الكل" ? allBakery : allBakery.filter(p => p.category === selectedCategoryFilter);
    if (productSearch) {
      const search = productSearch.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
    }
    return filtered;
  }, [products, selectedCategoryFilter, productSearch]);

  const categoryCounts = useMemo(() => {
    const allBakery = getSelectableCatalogRecords(products || []).filter(p =>
      p.category
      && BAKERY_CATEGORIES.includes(p.category)
    ) || [];
    const counts: Record<string, number> = { "الكل": allBakery.length };
    BAKERY_CATEGORIES.forEach(cat => {
      counts[cat] = allBakery.filter(p => p.category === cat).length;
    });
    return counts;
  }, [products]);

  const todayProductQuantities = useMemo(() => {
    const map: Record<number, number> = {};
    (batches || []).forEach(b => {
      if (b.productId) {
        map[b.productId] = (map[b.productId] || 0) + b.quantity;
      }
    });
    return map;
  }, [batches]);

  const productEnNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    (products || []).forEach(p => {
      if (p.nameEn) map[p.id] = p.nameEn;
    });
    return map;
  }, [products]);

  const getEnName = (batch: DailyProductionBatch) => {
    if (batch.productId && productEnNameMap[batch.productId]) return productEnNameMap[batch.productId];
    return null;
  };

  const openManualEntry = () => {
    dispatchEntryAcknowledgement({ type: "open_normal_entry" });
    setShowManualEntry(true);
  };

  const handleManualEntryDialogChange = (open: boolean) => {
    setShowManualEntry(open);
    if (!open) dispatchEntryAcknowledgement({ type: "close_normal_entry" });
  };

  const handleProductCardClick = (product: Product) => {
    dispatchEntryAcknowledgement({ type: "open_normal_entry" });
    setQuantityDialogProduct(product);
    setQuickQuantity("");
    setTimeout(() => quantityInputRef.current?.focus(), 100);
  };

  const closeQuickQuantityDialog = () => {
    setQuantityDialogProduct(null);
    setQuickQuantity("");
    dispatchEntryAcknowledgement({ type: "close_normal_entry" });
  };

  const handleQuickQuantitySubmit = () => {
    if (!quantityDialogProduct) return;
    const qty = parseInt(quickQuantity, 10);
    if (isNaN(qty) || qty <= 0) return;

    if (!selectedChefId) {
      toast({ title: "اختر الشيف أولاً", description: "يرجى اختيار الشيف المنتج قبل تسجيل الإنتاج", variant: "destructive" });
      return;
    }

    const submitted = handleQuickEntry(quantityDialogProduct, qty);
    if (submitted) {
      setQuantityDialogProduct(null);
      setQuickQuantity("");
    }
  };

  const getDiff = (current: number, previous: number) => {
    if (!previous) return { value: current, direction: "up" };
    const diff = current - previous;
    return { value: Math.abs(diff), direction: diff >= 0 ? "up" : "down" };
  };

  const exportToExcel = async () => {
    if (!batches || batches.length === 0) return;
    const XLSX = await import("xlsx");
    
    const data = batches.map(b => ({
      "الوقت": formatFullDateTime(b.producedAt),
      "المنتج": b.productName,
      "الفئة": b.productCategory || "-",
      "الكمية": b.quantity,
      "الوحدة": b.unit || "قطعة",
      "الوجهة": getDestinationInfo(b.destination).label,
      "الحالة": b.status === 'finished' ? 'مكتمل' : b.status === 'in_progress' ? 'قيد التحضير' : '-',
      "الشيف المنتج": b.chefName || "-",
      "تاريخ الاكتمال": b.finishedAt ? format(new Date(b.finishedAt), "yyyy/MM/dd HH:mm") : '-',
      "من أكمل الدفعة": b.finishedByName || "-",
      "المسجل": b.recorderName || "-",
      "ملاحظات": b.notes || "-",
    }));

    const summaryData = [
      { "البيان": "الفرع", "القيمة": getBranchName(branchId) },
      { "البيان": "التاريخ", "القيمة": selectedDate },
      { "البيان": "إجمالي الدفعات", "القيمة": stats?.totalBatches || 0 },
      { "البيان": "إجمالي الكميات", "القيمة": stats?.totalQuantity || 0 },
      { "البيان": "", "القيمة": "" },
      { "البيان": "توزيع حسب الوجهة", "القيمة": "" },
      ...DESTINATIONS.map(d => ({
        "البيان": `  ${d.label}`,
        "القيمة": stats?.byDestination?.[d.value] || 0
      })),
    ];
    
    const wb = XLSX.utils.book_new();
    const wsData = XLSX.utils.json_to_sheet(data);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص اليوم");
    XLSX.utils.book_append_sheet(wb, wsData, "تفاصيل الإنتاج");
    XLSX.writeFile(wb, `يومية-الإنتاج-${selectedDate}-${getBranchName(branchId)}.xlsx`);
    toast({ title: "تم تصدير التقرير" });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <title>يومية الإنتاج - ${selectedDate}</title>
        <style>
          * { font-family: 'Cairo', 'Segoe UI', sans-serif; }
          body { padding: 20px; direction: rtl; }
          h1 { text-align: center; color: #b45309; margin-bottom: 5px; }
          h2 { text-align: center; color: #666; margin-top: 0; font-weight: normal; }
          .header-info { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #fef3c7; border-radius: 8px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .stat-card { padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #b45309; }
          .stat-label { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
          th { background: #b45309; color: white; }
          tr:nth-child(even) { background: #f8f9fa; }
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 15px; }
          .section-title { background: #fef3c7; padding: 8px 15px; margin: 20px 0 10px; border-radius: 5px; font-weight: bold; }
          .recorder-badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>يومية الإنتاج الفعلي</h1>
        <h2>${getBranchName(branchId)} - ${format(new Date(selectedDate), "EEEE dd MMMM yyyy", { locale: ar })}</h2>
        
        <div class="header-info">
          <span>وقت الطباعة: ${format(new Date(), "HH:mm:ss yyyy/MM/dd", { locale: ar })}</span>
          <span>المستخدم: ${user?.firstName || user?.username || "-"}</span>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats?.totalBatches || 0}</div>
            <div class="stat-label">إجمالي الدفعات</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats?.totalQuantity || 0}</div>
            <div class="stat-label">إجمالي الكميات</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats?.byDestination?.display_bar || 0}</div>
            <div class="stat-label">بار العرض</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${(stats?.byDestination?.freezer || 0) + (stats?.byDestination?.refrigerator || 0)}</div>
            <div class="stat-label">التخزين</div>
          </div>
        </div>
        
        <div class="section-title">تفاصيل الإنتاج</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الوقت</th>
              <th>المنتج</th>
              <th>الفئة</th>
              <th>الكمية</th>
              <th>الوجهة</th>
              <th>الحالة</th>
              <th>الشيف</th>
              <th>تاريخ الاكتمال</th>
              <th>من أكمل</th>
              <th>المسجل</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${(batches || []).map((b, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${formatTime(b.producedAt)}</td>
                <td>${b.productName}</td>
                <td>${b.productCategory || "-"}</td>
                <td style="text-align: center; font-weight: bold;">${b.quantity}</td>
                <td>${getDestinationInfo(b.destination).label}</td>
                <td>${b.status === 'finished' ? '<span style="color:green;">مكتمل</span>' : b.status === 'in_progress' ? '<span style="color:orange;">قيد التحضير</span>' : '-'}</td>
                <td>${b.chefName || "-"}</td>
                <td>${b.finishedAt ? format(new Date(b.finishedAt), "HH:mm dd/MM", { locale: ar }) : '-'}</td>
                <td>${b.finishedByName || "-"}</td>
                <td><span class="recorder-badge">${b.recorderName || "-"}</span></td>
                <td>${b.notes || "-"}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="section-title">ملخص حسب المسجلين</div>
        <table>
          <thead>
            <tr><th>المسجل</th><th>عدد الدفعات</th><th>إجمالي الكمية</th></tr>
          </thead>
          <tbody>
            ${Object.entries(batchesByRecorder).map(([name, data]) => `
              <tr>
                <td>${name}</td>
                <td style="text-align: center;">${data.batches.length}</td>
                <td style="text-align: center; font-weight: bold;">${data.totalQty}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>BUTTER BAKERY SYSTEM - يومية الإنتاج الفعلي</p>
          <p>تم إنشاء هذا التقرير تلقائياً</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const qtyDiff = getDiff(stats?.totalQuantity || 0, prevStats?.totalQuantity || 0);
  const batchDiff = getDiff(stats?.totalBatches || 0, prevStats?.totalBatches || 0);

  return (
    <Layout>
      <div className="page-container space-y-4 sm:space-y-6" dir="rtl">
        <PageHeader
          icon={Factory}
          tone="production"
          title="الإنتاج الفعلي اليومي"
          description="تسجيل ومتابعة دفعات الإنتاج على مدار اليوم"
          backHref="/production-dashboard"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/finished-goods-inventory">
                <Button variant="outline" size="sm" className="gap-2" data-testid="btn-finished-goods">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">مخزون الإنتاج النهائي</span>
                  <span className="sm:hidden">المخزون</span>
                </Button>
              </Link>
              {user && (
                <Badge variant="outline" className="gap-1 px-3 py-1.5 text-xs">
                  <User className="h-3 w-3" />
                  {user.firstName || user.username}
                  {isAdmin && <Shield className="h-3 w-3 text-amber-600 mr-1" />}
                </Badge>
              )}
            </div>
          }
        />

        {/* Filters and Controls */}
        <div className="flex flex-wrap gap-2 sm:gap-4 items-end">
          <div className="space-y-1 sm:space-y-2 w-full sm:w-auto sm:min-w-[200px]">
            <Label className="text-xs sm:text-sm">الفرع *</Label>
            <Select value={branchId} onValueChange={(val) => { setBranchId(val); setSelectedChefId(""); setSelectedChefName(""); }}>
              <SelectTrigger data-testid="select-branch" className="h-10 sm:h-9">
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:space-y-2 flex-1 sm:flex-none">
            <Label className="text-xs sm:text-sm">التاريخ</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-[160px] h-10 sm:h-9"
              data-testid="input-date"
            />
          </div>
          <div className="space-y-1 sm:space-y-2 flex-1 sm:flex-none">
            <Label className="text-xs sm:text-sm">الوردية</Label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger className="w-full sm:w-[140px] h-10 sm:h-9">
                <SelectValue placeholder="الوردية" />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((shift) => {
                  const Icon = shift.icon;
                  return (
                    <SelectItem key={shift.value} value={shift.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {shift.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 bg-muted/50 px-2 sm:px-3 py-2 rounded-lg">
            <Switch
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
              id="auto-refresh"
            />
            <Label htmlFor="auto-refresh" className="text-xs sm:text-sm cursor-pointer">
              تحديث تلقائي
            </Label>
            {autoRefresh && (
              <Badge variant="secondary" className="text-[10px] sm:text-xs">كل دقيقة</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => refetchBatches()} data-testid="btn-refresh" className="h-8 sm:h-9 text-xs sm:text-sm flex-1 sm:flex-none">
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
              <span className="hidden sm:inline">تحديث</span>
            </Button>
            <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!batches?.length} data-testid="btn-export" className="h-8 sm:h-9 text-xs sm:text-sm flex-1 sm:flex-none">
              <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!batches?.length} data-testid="btn-pdf" className="h-8 sm:h-9 text-xs sm:text-sm flex-1 sm:flex-none">
              <FileDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={!batches?.length} data-testid="btn-print" className="h-8 sm:h-9 text-xs sm:text-sm flex-1 sm:flex-none">
              <Printer className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
              <span className="hidden sm:inline">طباعة</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards with Comparison */}
        {branchId && (
          <div className="kpi-grid">
            <Card className="border-r-4 border-r-amber-500">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">إجمالي الدفعات</p>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <p className="text-lg sm:text-2xl font-bold text-amber-700">{stats?.totalBatches || 0}</p>
                      {prevStats && (
                        <Badge variant={batchDiff.direction === "up" ? "default" : "destructive"} className="text-[10px] sm:text-xs gap-1">
                          {batchDiff.direction === "up" ? <TrendingUp className="h-2 w-2 sm:h-3 sm:w-3" /> : <TrendingDown className="h-2 w-2 sm:h-3 sm:w-3" />}
                          {batchDiff.value}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Package className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-green-500">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">إجمالي الكميات</p>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <p className="text-lg sm:text-2xl font-bold text-green-700">{stats?.totalQuantity || 0}</p>
                      {prevStats && (
                        <Badge variant={qtyDiff.direction === "up" ? "default" : "destructive"} className="text-[10px] sm:text-xs gap-1">
                          {qtyDiff.direction === "up" ? <TrendingUp className="h-2 w-2 sm:h-3 sm:w-3" /> : <TrendingDown className="h-2 w-2 sm:h-3 sm:w-3" />}
                          {qtyDiff.value}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-blue-500">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">بار العرض</p>
                    <p className="text-lg sm:text-2xl font-bold text-blue-700">{stats?.byDestination?.display_bar || 0}</p>
                  </div>
                  <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-cyan-500">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">التخزين</p>
                    <p className="text-lg sm:text-2xl font-bold text-cyan-700">
                      {(stats?.byDestination?.freezer || 0) + (stats?.byDestination?.refrigerator || 0)}
                    </p>
                  </div>
                  <Snowflake className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Make the two production workflows explicit before any entry action. */}
        <Card className="border-violet-200 bg-violet-50/40">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-violet-100 text-violet-800">اختر مسار الإنتاج</Badge>
                  <span className="text-sm font-semibold">لا تستخدم الإدخال اليدوي لطلبات المطبخ المركزي</span>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  للطلبات المعتمدة، ابدأ من التشغيل الفعلي حتى يبقى الطلب والوصفة والإنهاء المسبق ظاهرة.
                  الإدخال اليدوي أدناه مستقل عن الطلبات ولا يملأ احتياج طلب مركزي.
                </p>
              </div>
              <Link href="/production-dashboard?tab=operations" className="shrink-0">
                <Button className="w-full gap-2 bg-violet-700 hover:bg-violet-800 lg:w-auto">
                  <Factory className="h-4 w-4" />
                  إنتاج طلبات المطبخ المعتمدة
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <input
                id="independent-entry-acknowledgement"
                type="checkbox"
                checked={independentEntryAcknowledged}
                onChange={(event) => dispatchEntryAcknowledgement({ type: "set_normal", value: event.target.checked })}
                className="mt-1 h-4 w-4 shrink-0 accent-amber-600"
                data-testid="checkbox-independent-entry"
              />
              <div className="space-y-1">
                <Label htmlFor="independent-entry-acknowledgement" className="cursor-pointer text-sm font-semibold text-amber-900">
                  إدخال مستقل (ليس لطلب مطبخ مركزي)
                </Label>
                <p className="text-xs leading-5 text-amber-800">
                  أقرّ بأن هذا المسار يسجّل مخرج إنتاج نهائي مستقل فقط عند الإكمال؛ لا يستهلك وصفة أو مواد خام،
                  ولا يلبّي أو يخصم من أي طلب مركزي.
                </p>
              </div>
            </div>
            {manualOperationStorageError && (
              <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900" role="alert">
                <p className="font-semibold">تم إيقاف الإرسال لحماية العملية</p>
                <p className="mt-1 text-xs">{manualOperationStorageError}</p>
              </div>
            )}
            {uncertainCreateIntent && (
              <div
                className="mt-3 rounded-lg border-2 border-orange-400 bg-orange-50 p-3 text-sm text-orange-950"
                role="alert"
                data-testid="manual-production-create-resume"
              >
                <p className="font-semibold">يوجد تسجيل إنتاج غير محسوم</p>
                <p className="mt-1 text-xs leading-5">
                  قد يكون الخادم سجّل «{uncertainCreateIntent.payload.productName || "الدفعة"}».
                  لم تتم استعادته تلقائياً. استأنف الحمولة الأصلية أو تجاهلها صراحةً قبل إدخال بيانات مختلفة.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={restoreCreateIntent}>
                    استعادة البيانات
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={retryCreateIntent}
                    disabled={!independentEntryAcknowledged || createMutation.isPending}
                  >
                    {createMutation.isPending ? "جاري إعادة المحاولة..." : "إعادة المحاولة بنفس المفتاح"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => askDiscardIntent(uncertainCreateIntent)}
                  >
                    تجاهل مع التحذير
                  </Button>
                </div>
              </div>
            )}
            {uncertainRescheduleIntent && (
              <div
                className="mt-3 rounded-lg border-2 border-orange-400 bg-orange-50 p-3 text-sm text-orange-950"
                role="alert"
                data-testid="manual-production-reschedule-resume"
              >
                <p className="font-semibold">يوجد ترحيل غير محسوم</p>
                <p className="mt-1 text-xs leading-5">
                  قد يكون الخادم أعاد جدولة الدفعة ذاتها. لم تتم المتابعة تلقائياً؛ استأنف أو تجاهل
                  العملية الصريحة قبل بدء ترحيل آخر.
                </p>
                <label className="mt-3 flex items-start gap-2 text-xs leading-5">
                  <input
                    type="checkbox"
                    checked={carryOverAcknowledged}
                    onChange={(event) => dispatchEntryAcknowledgement({
                      type: "set_carry_over",
                      value: event.target.checked,
                    })}
                    className="mt-1 h-4 w-4 shrink-0 accent-orange-600"
                  />
                  <span>أؤكد إعادة محاولة نفس الدفعة المستقلة دون إنشاء نسخة أو تحريك مخزون الناتج.</span>
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={restoreRescheduleIntent}>
                    استعادة الترحيل
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={retryRescheduleIntent}
                    disabled={!carryOverAcknowledged || carryOverMutation.isPending}
                  >
                    {carryOverMutation.isPending ? "جاري إعادة المحاولة..." : "إعادة المحاولة بنفس المفتاح"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => askDiscardIntent(uncertainRescheduleIntent)}
                  >
                    تجاهل مع التحذير
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full sm:grid sm:grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="entry" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">تسجيل</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Timer className="h-4 w-4" />
              <span className="hidden sm:inline">الجدول الزمني</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">التقارير</span>
            </TabsTrigger>
            <TabsTrigger value="journal" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">اليومية</span>
            </TabsTrigger>
          </TabsList>

          {/* Entry Tab - Mobile-First Redesign */}
          <TabsContent value="entry" className="mt-4">
            <div className="space-y-4">
              {/* Settings Bar - Sticky on mobile */}
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-3 border-b">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-[11px] text-muted-foreground mb-1 block">الشيف المنتج</Label>
                    <Select value={selectedChefId || undefined} onValueChange={handleChefSelect}>
                      <SelectTrigger data-testid="select-chef" className="h-11 text-sm font-medium border-amber-300 bg-amber-50/50">
                        <div className="flex items-center gap-1.5">
                          <ChefHat className="h-4 w-4 text-amber-600 shrink-0" />
                          <SelectValue placeholder="اختر الشيف" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {chefs?.map((chef) => (
                          <SelectItem key={chef.id} value={chef.id}>
                            {chef.firstName || chef.username}
                            {chef.jobTitle ? ` - ${chef.jobTitle}` : ""}
                          </SelectItem>
                        ))}
                        {chefs?.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                            لا يوجد موظفين بوظائف الإنتاج
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground mb-1 block">الوجهة</Label>
                    <Select value={destination} onValueChange={setDestination}>
                      <SelectTrigger data-testid="select-destination" className="h-11 text-sm font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DESTINATIONS.map((dest) => {
                          const Icon = dest.icon;
                          return (
                            <SelectItem key={dest.value} value={dest.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {dest.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <Label className="text-[11px] text-muted-foreground mb-1 block">بحث سريع</Label>
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="ابحث عن منتج..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="pr-10 h-11 text-sm"
                        data-testid="input-search-product"
                      />
                      {productSearch && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8"
                          onClick={() => setProductSearch("")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {!selectedChefId && (
                  <div className="mt-2 flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    يرجى اختيار الشيف المنتج قبل تسجيل أي صنف
                  </div>
                )}
              </div>

              {/* Category Tabs - Large Touch Targets */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {["الكل", ...BAKERY_CATEGORIES].map((cat) => {
                  const isActive = selectedCategoryFilter === cat;
                  const count = categoryCounts[cat] || 0;
                  const catIcons: Record<string, any> = {
                    "الكل": Package,
                    "مخبوزات": Factory,
                    "حلويات": ChefHat,
                    "إفطار": Coffee,
                    "بيتزا": UtensilsCrossed,
                    "تجمعات": Users,
                  };
                  const CatIcon = catIcons[cat] || Package;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategoryFilter(cat)}
                      className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 transition-all min-w-[80px] touch-manipulation ${
                        isActive
                          ? "border-amber-500 bg-gradient-to-b from-amber-50 to-amber-100 shadow-md shadow-amber-200/50"
                          : "border-muted bg-card hover:border-amber-300 hover:bg-amber-50/30"
                      }`}
                      data-testid={`btn-category-${cat}`}
                    >
                      <CatIcon className={`h-5 w-5 ${isActive ? "text-amber-600" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-bold ${isActive ? "text-amber-800" : "text-foreground"}`}>{cat}</span>
                      <span className={`text-[10px] ${isActive ? "text-amber-600" : "text-muted-foreground"}`}>{count} صنف</span>
                    </button>
                  );
                })}
              </div>

              {/* Product Grid - Touch Optimized Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
                {categoryFilteredProducts.map((product) => {
                  const todayQty = todayProductQuantities[product.id] || 0;
                  const isSweets = isSweetsCategory(product.category);
                  return (
                    <button
                      key={product.id}
                      onClick={() => handleProductCardClick(product)}
                      disabled={createMutation.isPending || !branchId || !selectedChefId}
                      className={`relative group flex flex-col items-center text-center p-3 sm:p-4 rounded-xl border-2 transition-all touch-manipulation active:scale-95 ${
                        !branchId || !selectedChefId
                          ? "opacity-50 cursor-not-allowed border-muted bg-muted/20"
                          : "border-muted bg-card hover:border-amber-400 hover:shadow-lg hover:shadow-amber-100/50 active:bg-amber-50 cursor-pointer"
                      }`}
                      data-testid={`btn-product-${product.id}`}
                    >
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 ${
                        isSweets ? "bg-pink-100" :
                        product.category === "إفطار" ? "bg-orange-100" :
                        product.category === "بيتزا" ? "bg-red-100" :
                        product.category === "تجمعات" ? "bg-purple-100" :
                        "bg-amber-100"
                      }`}>
                        {isSweets ? <ChefHat className="h-5 w-5 sm:h-6 sm:w-6 text-pink-600" /> :
                         product.category === "إفطار" ? <Coffee className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" /> :
                         product.category === "بيتزا" ? <UtensilsCrossed className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" /> :
                         product.category === "تجمعات" ? <Users className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" /> :
                         <Factory className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />}
                      </div>
                      <span className="text-xs sm:text-sm font-medium leading-tight line-clamp-2">{product.name}</span>
                      {product.sku && (
                        <span className="text-[10px] text-muted-foreground font-mono leading-tight">{product.sku}</span>
                      )}
                      {product.nameEn && (
                        <span className="text-xs text-muted-foreground leading-tight line-clamp-1">{product.nameEn}</span>
                      )}
                      {todayQty > 0 && (
                        <div className="absolute -top-1.5 -left-1.5 bg-green-500 text-white text-[10px] font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                          {todayQty}
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-xl bg-amber-500/0 group-hover:bg-amber-500/5 transition-colors pointer-events-none" />
                    </button>
                  );
                })}
                {/* Manual Entry Card */}
                <button
                   onClick={openManualEntry}
                  disabled={!branchId || !selectedChefId}
                  className={`flex flex-col items-center justify-center text-center p-3 sm:p-4 rounded-xl border-2 border-dashed transition-all touch-manipulation ${
                    !branchId || !selectedChefId
                      ? "opacity-50 cursor-not-allowed border-muted"
                      : "border-gray-300 hover:border-amber-400 hover:bg-amber-50/30 cursor-pointer active:scale-95"
                  }`}
                  data-testid="btn-manual-entry"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mb-2 bg-gray-100">
                    <Plus className="h-5 w-5 sm:h-6 sm:w-6 text-gray-500" />
                  </div>
                   <span className="text-xs sm:text-sm font-medium text-muted-foreground">إدخال مستقل يدوي</span>
                   <span className="text-[10px] text-muted-foreground mt-1">منتج غير مدرج · يتطلب التأكيد</span>
                </button>
                {categoryFilteredProducts.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">لا توجد منتجات مطابقة</p>
                    {productSearch && (
                      <Button variant="link" className="mt-1 text-xs" onClick={() => setProductSearch("")}>
                        مسح البحث
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Unfinished Batches Carry-Over */}
              {unfinishedBatches && unfinishedBatches.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Repeat className="h-4 w-4 text-amber-600" />
                      دفعات قيد التحضير من أيام سابقة
                      <Badge variant="outline" className="text-[10px] bg-amber-100 mr-auto">
                        {unfinishedBatches.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {unfinishedBatches.map((batch) => (
                        <div
                          key={batch.id}
                          className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-200"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{batch.productName}</p>
                            {getEnName(batch) && (
                              <p className="text-xs text-muted-foreground truncate ltr">{getEnName(batch)}</p>
                            )}
                             <div className="mt-1">
                               <ProductionSourceBadge batch={batch} compact />
                             </div>
                            <p className="text-xs text-muted-foreground">
                              {batch.quantity} {batch.unit || "قطعة"} - {format(new Date(batch.producedAt), "yyyy-MM-dd")}
                            </p>
                          </div>
                           {canModifyRecords ? (
                            <div className="flex items-center gap-1 shrink-0 mr-2">
                               {isOperationallyLinkedProductionBatch(batch) ? (
                                 <Link
                                   href="/production-dashboard?tab=operations"
                                   className="inline-flex h-8 items-center gap-1 rounded-md border border-violet-300 px-2 text-xs font-medium text-violet-800 hover:bg-violet-50"
                                 >
                                   <ArrowLeft className="h-3 w-3" />
                                   فتح التشغيل
                                 </Link>
                               ) : (
                                 <>
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     className="h-8 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                                     onClick={() => finishBatchMutation.mutate({
                                       batchId: batch.id,
                                       context: latestManualContextRef.current,
                                     })}
                                     disabled={finishBatchMutation.isPending}
                                   >
                                     <CheckCircle className="h-3 w-3" />
                                     اكتمل
                                   </Button>
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     className="h-8 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                                     onClick={() => openCarryOver(batch)}
                                     disabled={carryOverMutation.isPending || !!uncertainRescheduleIntent}
                                   >
                                     <Repeat className="h-3 w-3" />
                                     ترحيل
                                   </Button>
                                 </>
                               )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground gap-1 shrink-0">
                              <Shield className="h-3 w-3" />
                              للعرض فقط
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Today's Production Summary - Compact Cards */}
              {batches && batches.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-blue-600" />
                        إنتاج اليوم
                        <Badge variant="secondary" className="text-[10px]">{batches.length} دفعة</Badge>
                      </CardTitle>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => refetchBatches()}>
                        <RefreshCw className="h-3 w-3" />
                        تحديث
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                      {batches.slice().reverse().slice(0, 20).map((batch) => {
                        const destInfo = getDestinationInfo(batch.destination);
                        const DestIcon = destInfo.icon;
                        return (
                          <div
                            key={batch.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                            data-testid={`row-batch-${batch.id}`}
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 shrink-0">
                              <span className="text-sm font-bold text-amber-700">{batch.quantity}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{batch.productName}</p>
                              {getEnName(batch) && (
                                <p className="text-xs text-muted-foreground truncate ltr">{getEnName(batch)}</p>
                              )}
                               <div className="mt-1">
                                 <ProductionSourceBadge batch={batch} compact />
                               </div>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="flex items-center gap-0.5">
                                  <Clock className="h-2.5 w-2.5" />
                                  {formatTime(batch.producedAt)}
                                </span>
                                <Badge className={`${destInfo.color} text-[9px] px-1 py-0 h-4`}>
                                  <DestIcon className="h-2 w-2 ml-0.5" />
                                  {destInfo.label}
                                </Badge>
                                {batch.chefName && (
                                  <span className="flex items-center gap-0.5">
                                    <ChefHat className="h-2.5 w-2.5" />
                                    {batch.chefName}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                               {canModifyRecords && isSweetsCategory(batch.productCategory) && batch.status === "in_progress" && (
                                 isOperationallyLinkedProductionBatch(batch) ? (
                                   <Link
                                     href="/production-dashboard?tab=operations"
                                     className="inline-flex h-7 items-center gap-1 rounded-md border border-violet-300 px-1.5 text-[10px] text-violet-800"
                                     title="مراجعة الإنهاء من تشغيل المطبخ المركزي"
                                   >
                                     <ArrowLeft className="h-3 w-3" />
                                     التشغيل
                                   </Link>
                                 ) : (
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500" onClick={() => finishBatchMutation.mutate({
                                     batchId: batch.id,
                                     context: latestManualContextRef.current,
                                   })} disabled={finishBatchMutation.isPending}>
                                     <CheckCircle className="h-3.5 w-3.5" />
                                   </Button>
                                 )
                               )}
                               {canModifyRecords && !isOperationallyLinkedProductionBatch(batch) && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" onClick={() => openEditDialog(batch)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                               {canDeleteRecords && !isOperationallyLinkedProductionBatch(batch) && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>حذف الدفعة</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        هل أنت متأكد من حذف دفعة "{batch.productName}"؟
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                      <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate({
                                        id: batch.id,
                                        context: latestManualContextRef.current,
                                      })}>
                                        حذف
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                            {isSweetsCategory(batch.productCategory) && batch.status === "in_progress" && (
                              <Badge className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0 h-4 shrink-0">
                                <Timer className="h-2 w-2 ml-0.5" />
                                قيد التحضير
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                      {batches.length > 20 && (
                        <p className="text-center text-xs text-muted-foreground pt-2">
                          + {batches.length - 20} دفعة أخرى (اذهب لليومية للتفاصيل الكاملة)
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-6">
            {!branchId ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Timer className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>اختر الفرع لعرض الجدول الزمني</p>
                </CardContent>
              </Card>
            ) : !batches?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد دفعات مسجلة لهذا اليوم</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="w-5 h-5 text-indigo-600" />
                      الجدول الزمني للإنتاج
                    </CardTitle>
                    <CardDescription>
                      عرض الإنتاج على مدار الساعات
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 sm:space-y-4">
                      {Object.entries(batchesByHour)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([hour, hourBatches]) => (
                          <div key={hour} className="border-r-4 border-indigo-500 pr-2 sm:pr-4">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                              <Badge className="bg-indigo-100 text-indigo-800 text-xs sm:text-sm px-2 sm:px-3 py-1">
                                <Clock className="h-2 w-2 sm:h-3 sm:w-3 ml-1" />
                                {HOUR_LABELS[hour] || `${hour}:00`}
                              </Badge>
                              <span className="text-xs sm:text-sm text-muted-foreground">
                                {hourBatches.length} دفعة - {hourBatches.reduce((s, b) => s + b.quantity, 0)} قطعة
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {hourBatches.map((batch) => {
                                const destInfo = getDestinationInfo(batch.destination);
                                const DestIcon = destInfo.icon;
                                return (
                                  <div
                                    key={batch.id}
                                    className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                                  >
                                    <div className={`p-2 rounded-lg bg-gradient-to-br ${destInfo.bgClass}`}>
                                      <DestIcon className="h-4 w-4 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm truncate">{batch.productName}</p>
                                      {getEnName(batch) && (
                                        <p className="text-xs text-muted-foreground truncate ltr">{getEnName(batch)}</p>
                                      )}
                                       <div className="mt-1">
                                         <ProductionSourceBadge batch={batch} compact />
                                       </div>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{formatTime(batch.producedAt)}</span>
                                        <span>•</span>
                                        <span className="font-bold text-foreground">{batch.quantity}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          {batch.recorderName || "-"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-6">
            {!branchId ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>اختر الفرع لعرض التقارير</p>
                </CardContent>
              </Card>
            ) : !batches?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد بيانات لإنشاء التقارير</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Activity className="w-5 h-5 text-green-600" />
                      توزيع حسب الوجهة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {DESTINATIONS.map((dest) => {
                        const data = batchesByDestination[dest.value];
                        const percentage = stats?.totalQuantity 
                          ? Math.round((data?.totalQty || 0) / stats.totalQuantity * 100) 
                          : 0;
                        const Icon = dest.icon;
                        return (
                          <div key={dest.value} className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${dest.bgClass}`}>
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium text-sm">{dest.label}</span>
                                <span className="text-sm text-muted-foreground">
                                  {data?.totalQty || 0} قطعة ({percentage}%)
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full bg-gradient-to-r ${dest.bgClass}`}
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

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <PieChart className="w-5 h-5 text-purple-600" />
                      توزيع حسب الفئة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(batchesByCategory)
                        .sort(([, a], [, b]) => b.totalQty - a.totalQty)
                        .map(([category, data]) => {
                          const percentage = stats?.totalQuantity 
                            ? Math.round(data.totalQty / stats.totalQuantity * 100) 
                            : 0;
                          return (
                            <div key={category} className="flex items-center gap-3">
                              <Badge variant="outline" className="min-w-[80px] justify-center">
                                {category}
                              </Badge>
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-sm text-muted-foreground">
                                    {data.batches.length} دفعة
                                  </span>
                                  <span className="font-medium">
                                    {data.totalQty} قطعة ({percentage}%)
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-600"
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

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <User className="w-5 h-5 text-blue-600" />
                      الإنتاج حسب المسجل
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(batchesByRecorder)
                        .sort(([, a], [, b]) => b.totalQty - a.totalQty)
                        .map(([recorder, data]) => {
                          const percentage = stats?.totalQuantity 
                            ? Math.round(data.totalQty / stats.totalQuantity * 100) 
                            : 0;
                          return (
                            <div key={recorder} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                              <div className="p-2 bg-blue-100 rounded-full">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{recorder}</span>
                                  <Badge variant="secondary">{data.totalQty} قطعة</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {data.batches.length} دفعة • {percentage}% من الإجمالي
                                </p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="w-5 h-5 text-indigo-600" />
                      توزيع الإنتاج على الساعات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stats?.byHour || {})
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([hour, qty]) => (
                          <div key={hour} className="text-center p-3 bg-indigo-50 rounded-lg min-w-[70px]">
                            <p className="text-lg font-bold text-indigo-700">{qty}</p>
                            <p className="text-xs text-indigo-600">{HOUR_LABELS[hour] || `${hour}:00`}</p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Daily Journal Tab */}
          <TabsContent value="journal" className="mt-6">
            {!branchId ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>اختر الفرع لعرض يومية الإنتاج</p>
                </CardContent>
              </Card>
            ) : !batches?.length ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>لا توجد بيانات لإنشاء اليومية</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6" ref={printRef}>
                <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
                  <CardContent className="p-6">
                    <div className="text-center mb-4">
                      <h2 className="text-2xl font-bold text-amber-800">يومية الإنتاج الفعلي</h2>
                      <p className="text-amber-700">
                        {getBranchName(branchId)} - {format(new Date(selectedDate), "EEEE dd MMMM yyyy", { locale: ar })}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-amber-700">{stats?.totalBatches || 0}</p>
                        <p className="text-sm text-amber-600">إجمالي الدفعات</p>
                      </div>
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-green-700">{stats?.totalQuantity || 0}</p>
                        <p className="text-sm text-green-600">إجمالي القطع</p>
                      </div>
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-blue-700">{Object.keys(batchesByRecorder).length}</p>
                        <p className="text-sm text-blue-600">عدد المسجلين</p>
                      </div>
                      <div className="text-center p-3 bg-white/80 rounded-lg">
                        <p className="text-3xl font-bold text-purple-700">{Object.keys(batchesByHour).length}</p>
                        <p className="text-sm text-purple-600">ساعات العمل</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-600" />
                        تفاصيل الإنتاج
                      </span>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={exportToExcel}>
                          <FileSpreadsheet className="h-4 w-4 ml-2" />
                          تصدير Excel
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                          <Printer className="h-4 w-4 ml-2" />
                          طباعة
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-amber-50">
                            <TableHead className="text-right font-bold">#</TableHead>
                            <TableHead className="text-right font-bold">الوقت</TableHead>
                            <TableHead className="text-right font-bold">المنتج</TableHead>
                             <TableHead className="text-right font-bold">مصدر الدفعة</TableHead>
                            <TableHead className="text-right font-bold">الفئة</TableHead>
                            <TableHead className="text-center font-bold">الكمية</TableHead>
                            <TableHead className="text-right font-bold">الوجهة</TableHead>
                            <TableHead className="text-right font-bold">المسجل</TableHead>
                            <TableHead className="text-right font-bold">ملاحظات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batches.map((batch, index) => {
                            const destInfo = getDestinationInfo(batch.destination);
                            const DestIcon = destInfo.icon;
                            return (
                              <TableRow key={batch.id} className={index % 2 === 0 ? "bg-muted/20" : ""}>
                                <TableCell className="font-medium">{index + 1}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    {formatTime(batch.producedAt)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <span className="font-medium">{batch.productName}</span>
                                    {getEnName(batch) && (
                                      <span className="block text-xs text-muted-foreground ltr">{getEnName(batch)}</span>
                                    )}
                                  </div>
                                </TableCell>
                                 <TableCell>
                                   <ProductionSourceBadge batch={batch} />
                                 </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {batch.productCategory || "-"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center font-bold text-lg">{batch.quantity}</TableCell>
                                <TableCell>
                                  <Badge className={destInfo.color}>
                                    <DestIcon className="h-3 w-3 ml-1" />
                                    {destInfo.label}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="gap-1">
                                    <User className="h-3 w-3" />
                                    {batch.recorderName || "-"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                                  {batch.notes || "-"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-blue-600" />
                      ملخص حسب المسجلين
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-blue-50">
                          <TableHead className="text-right font-bold">المسجل</TableHead>
                          <TableHead className="text-center font-bold">عدد الدفعات</TableHead>
                          <TableHead className="text-center font-bold">إجمالي الكمية</TableHead>
                          <TableHead className="text-center font-bold">النسبة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(batchesByRecorder)
                          .sort(([, a], [, b]) => b.totalQty - a.totalQty)
                          .map(([recorder, data]) => {
                            const percentage = stats?.totalQuantity 
                              ? Math.round(data.totalQty / stats.totalQuantity * 100) 
                              : 0;
                            return (
                              <TableRow key={recorder}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-blue-600" />
                                    {recorder}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">{data.batches.length}</TableCell>
                                <TableCell className="text-center font-bold">{data.totalQty}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline">{percentage}%</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {!canModifyRecords && (
                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <div>
                          <p className="font-medium text-amber-800">ملاحظة هامة</p>
                          <p className="text-sm text-amber-700">
                            لا يمكنك تعديل أو حذف السجلات بعد إدخالها. يرجى التواصل مع المشرف أو المدير للتعديلات.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Manual Entry Dialog */}
      <Dialog open={showManualEntry} onOpenChange={handleManualEntryDialogChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-600" />
              إدخال منتج يدوي
            </DialogTitle>
            <DialogDescription>أدخل بيانات منتج غير موجود في القائمة</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <input
              id="manual-dialog-entry-acknowledgement"
              type="checkbox"
              checked={independentEntryAcknowledged}
              onChange={(event) => dispatchEntryAcknowledgement({ type: "set_normal", value: event.target.checked })}
              className="mt-1 h-4 w-4 shrink-0 accent-amber-600"
            />
            <Label htmlFor="manual-dialog-entry-acknowledgement" className="cursor-pointer text-xs leading-5 text-amber-900">
              أقرّ أن الإدخال مستقل عن الطلبات المركزية: لا استهلاك وصفة أو مواد خام ولا تلبية لطلب،
              ويُرحّل ناتج الإنتاج النهائي فقط عند الإكمال.
            </Label>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (handleSubmit(e)) {
              setShowManualEntry(false);
            }
          }} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>اسم المنتج *</Label>
              <Input
                placeholder="اكتب اسم المنتج"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="h-11"
                data-testid="input-manual-product-name"
              />
            </div>
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Select value={productCategory} onValueChange={setProductCategory}>
                <SelectTrigger className="h-11" data-testid="select-manual-category">
                  <SelectValue placeholder="اختر الفئة" />
                </SelectTrigger>
                <SelectContent>
                  {BAKERY_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الكمية *</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="أدخل الكمية"
                className="h-11"
                data-testid="input-manual-quantity"
              />
              <div className="flex flex-wrap gap-1">
                {QUICK_QUANTITIES.slice(0, 8).map((q) => (
                  <Button key={q} type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => setQuantity(q.toString())}>
                    {q}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات إضافية (اختياري)" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
               <Button type="button" variant="outline" onClick={() => handleManualEntryDialogChange(false)} className="h-11">
                إلغاء
              </Button>
              <Button
                type="submit"
                 disabled={createMutation.isPending || !productName || !quantity || !independentEntryAcknowledged}
                className="h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                data-testid="btn-manual-submit"
              >
                {createMutation.isPending ? "جاري التسجيل..." : "تسجيل الدفعة"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Quantity Popup */}
      <Dialog open={!!quantityDialogProduct} onOpenChange={(open) => !open && closeQuickQuantityDialog()}>
        <DialogContent className="max-w-[340px] sm:max-w-sm p-0 gap-0 rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white text-center">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2">
              {isSweetsCategory(quantityDialogProduct?.category) ? (
                <ChefHat className="h-7 w-7 text-white" />
              ) : (
                <Factory className="h-7 w-7 text-white" />
              )}
            </div>
            <DialogTitle className="text-lg font-bold text-white">{quantityDialogProduct?.name}</DialogTitle>
            {quantityDialogProduct?.nameEn && (
              <p className="text-amber-100/90 text-sm font-medium">{quantityDialogProduct.nameEn}</p>
            )}
            <DialogDescription className="text-amber-100 text-xs mt-1">
              {quantityDialogProduct?.category} {quantityDialogProduct?.unit ? `• ${quantityDialogProduct.unit}` : ""}
            </DialogDescription>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-right">
              <input
                id="quick-entry-acknowledgement"
                type="checkbox"
                checked={independentEntryAcknowledged}
                onChange={(event) => dispatchEntryAcknowledgement({ type: "set_normal", value: event.target.checked })}
                className="mt-1 h-4 w-4 shrink-0 accent-amber-600"
              />
              <Label htmlFor="quick-entry-acknowledgement" className="cursor-pointer text-xs leading-5 text-amber-900">
                هذا تسجيل مستقل، لا يستهلك وصفة أو مواد خام ولا يلبّي طلب مطبخ مركزي؛
                يُرحّل ناتج الإنتاج النهائي فقط عند الإكمال.
              </Label>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">الكمية</Label>
              <Input
                ref={quantityInputRef}
                type="number"
                inputMode="numeric"
                min="1"
                value={quickQuantity}
                onChange={(e) => setQuickQuantity(e.target.value)}
                placeholder="أدخل الكمية"
                className="h-14 text-2xl text-center font-bold border-2 border-amber-300 focus:border-amber-500"
                data-testid="input-quick-quantity"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQuickQuantitySubmit();
                  }
                }}
              />
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {QUICK_QUANTITIES.map((q) => (
                <Button
                  key={q}
                  type="button"
                  variant={quickQuantity === q.toString() ? "default" : "outline"}
                  className={`h-10 text-sm font-bold touch-manipulation ${quickQuantity === q.toString() ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                  onClick={() => setQuickQuantity(q.toString())}
                >
                  {q}
                </Button>
              ))}
            </div>

            {isSweetsCategory(quantityDialogProduct?.category) && (
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                <Label className="text-xs text-amber-700 flex items-center gap-1 mb-2">
                  <Timer className="h-3 w-3" />
                  حالة الإنتاج
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {PRODUCTION_STATUSES.map((s) => {
                    const Icon = s.icon;
                    return (
                      <Button
                        key={s.value}
                        type="button"
                        variant={status === s.value ? "default" : "outline"}
                        size="sm"
                        className={`h-9 flex items-center gap-1.5 ${status === s.value ? "bg-amber-500 hover:bg-amber-600" : s.color}`}
                        onClick={() => setStatus(s.value)}
                        data-testid={`btn-status-${s.value}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs">{s.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {todayProductQuantities[quantityDialogProduct?.id || 0] > 0 && (
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200 text-green-700 text-xs">
                <CheckCircle className="h-4 w-4 shrink-0" />
                تم إنتاج {todayProductQuantities[quantityDialogProduct?.id || 0]} {quantityDialogProduct?.unit || "قطعة"} اليوم
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                onClick={closeQuickQuantityDialog}
                className="h-12 text-sm"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleQuickQuantitySubmit}
               disabled={!quickQuantity || parseInt(quickQuantity) <= 0 || createMutation.isPending || !independentEntryAcknowledged}
                className="h-12 text-sm bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
                data-testid="btn-confirm-quantity"
              >
                {createMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 ml-1" />
                    تسجيل
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingBatch} onOpenChange={() => setEditingBatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل الدفعة</DialogTitle>
            <DialogDescription>
              تعديل بيانات دفعة: {editingBatch?.productName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الكمية</Label>
              <Input
                type="number"
                min="1"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>الوجهة</Label>
              <Select value={editDestination} onValueChange={setEditDestination}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESTINATIONS.map((dest) => (
                    <SelectItem key={dest.value} value={dest.value}>{dest.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBatch(null)}>
              <X className="h-4 w-4 ml-2" />
              إلغاء
            </Button>
            <Button onClick={handleEditSave} disabled={updateMutation.isPending}>
              <Check className="h-4 w-4 ml-2" />
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In-Progress Product Dialog */}
      <Dialog
        open={showInProgressDialog}
        onOpenChange={(open) => {
          if (!open) handleCancelInProgressDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              يوجد صنف قيد التحضير
            </DialogTitle>
            <DialogDescription className="text-right">
              هذا الصنف لديه دفعة سابقة قيد التحضير. ماذا تريد أن تفعل؟
            </DialogDescription>
          </DialogHeader>
          
          {matchingInProgressBatch && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
              <p className="font-medium text-amber-800">{matchingInProgressBatch.productName}</p>
              <div className="flex justify-between text-sm text-amber-700">
                <span>الكمية: {matchingInProgressBatch.quantity} {matchingInProgressBatch.unit || "قطعة"}</span>
                <span>التاريخ: {format(new Date(matchingInProgressBatch.producedAt), "yyyy-MM-dd")}</span>
              </div>
              {matchingInProgressBatch.chefName && (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <ChefHat className="h-3 w-3" />
                  {matchingInProgressBatch.chefName}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            {matchingInProgressBatch && isOperationallyLinkedProductionBatch(matchingInProgressBatch) ? (
              <div className="w-full space-y-2">
                <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
                  هذه الدفعة مرتبطة بطلب مركزي. لا يمكن إنهاؤها من الإدخال اليومي العام؛ راجع معاينة الوصفة من التشغيل الفعلي.
                </div>
                <Link
                  href="/production-dashboard?tab=operations"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-violet-700 px-4 text-sm font-medium text-white hover:bg-violet-800"
                >
                  <Factory className="h-4 w-4" />
                  فتح التشغيل الفعلي
                </Link>
              </div>
            ) : canModifyRecords ? (
              <Button
                onClick={handleFinishExistingAndCreate}
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={finishBatchMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 ml-2" />
                {finishBatchMutation.isPending ? "جاري التحديث..." : "تحويل السابق لمكتمل وتسجيل الجديد"}
              </Button>
            ) : (
              <div className="p-2 bg-gray-100 rounded text-center text-sm text-muted-foreground">
                <Shield className="h-4 w-4 inline ml-1" />
                لا تملك صلاحية تعديل الدفعة السابقة
              </div>
            )}
            <Button
              variant="outline"
              onClick={handleContinueNewBatch}
              className="w-full"
              disabled={createMutation.isPending}
            >
              <Plus className="h-4 w-4 ml-2" />
              تسجيل دفعة جديدة منفصلة
            </Button>
            <Button
              variant="ghost"
              onClick={handleCancelInProgressDialog}
              className="w-full text-muted-foreground"
            >
              <X className="h-4 w-4 ml-2" />
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Carry-over is an in-place reschedule: the batch id stays the same,
          only its date changes, and no output-stock posting happens here. */}
      <Dialog
        open={carryOverBatch !== null}
        onOpenChange={(open) => {
          if (!open) closeCarryOverDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <Repeat className="h-5 w-5" />
              تأكيد ترحيل دفعة مستقلة
            </DialogTitle>
            <DialogDescription className="text-right">
              سيعيد الترحيل جدولة نفس الدفعة إلى تاريخ لاحق. لا ينشئ نسخة ولا يحرّك مخزون الناتج؛
              لا تستخدمه لدفعة مرتبطة بطلب مركزي، وافتح التشغيل الفعلي لذلك المسار.
            </DialogDescription>
          </DialogHeader>
          {carryOverBatch && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">{carryOverBatch.productName}</p>
                <p className="mt-1 text-xs">
                  المعرف #{carryOverBatch.id} · {carryOverBatch.quantity} {carryOverBatch.unit || "قطعة"} ·
                  من {carryOverBatch.productionDate || format(new Date(carryOverBatch.producedAt), "yyyy-MM-dd")} إلى {selectedDate}
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <input
                  id="carry-over-entry-acknowledgement"
                  type="checkbox"
                  checked={carryOverAcknowledged}
                  onChange={(event) => {
                    dispatchEntryAcknowledgement({ type: "set_carry_over", value: event.target.checked });
                  }}
                  className="mt-1 h-4 w-4 shrink-0 accent-amber-600"
                />
                <Label htmlFor="carry-over-entry-acknowledgement" className="cursor-pointer text-xs leading-5 text-amber-900">
                  أقرّ أن هذه الدفعة مستقلة وغير مرتبطة بطلب مركزي، وأن العملية ستغيّر تاريخ الدفعة
                  نفسها فقط دون إنشاء نسخة أو تحريك مخزون الناتج.
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeCarryOverDialog} disabled={carryOverMutation.isPending}>
              إلغاء
            </Button>
            <Button
              onClick={submitCarryOver}
              disabled={!carryOverAcknowledged || carryOverMutation.isPending}
            >
              {carryOverMutation.isPending ? "جاري إعادة الجدولة..." : "تأكيد إعادة الجدولة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardIntent !== null} onOpenChange={(open) => !open && setDiscardIntent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تجاهل عملية غير محسومة؟</AlertDialogTitle>
            <AlertDialogDescription>
              قد يكون الخادم سجّل العملية بالفعل رغم عدم وصول النتيجة إلى المتصفح.
              سيؤدي التجاهل إلى حذف النية المحفوظة ولن تتم إعادة المحاولة تلقائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDiscardIntent}>تجاهل مع علمي بالتحذير</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
