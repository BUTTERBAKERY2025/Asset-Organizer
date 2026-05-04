import { useState, useEffect, useRef, useMemo } from "react";
import { Layout } from "@/components/layout";
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
  const [pendingSubmitAction, setPendingSubmitAction] = useState<(() => void) | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { itemsPerPage, getPageItems } = usePagination(15);
  const { user, isAdmin } = useAuth();
  const { canEdit, canDelete } = usePermissions();

  const canModifyRecords = isAdmin || canEdit("production");
  const canDeleteRecords = isAdmin || canDelete("production");

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
    refetchInterval: autoRefresh ? 60000 : false,
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
    refetchInterval: autoRefresh ? 60000 : false,
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
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/daily-production/batches", data);
      return res.json();
    },
    onSuccess: (result: any) => {
      refetchBatches();
      refetchUnfinished();
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats", branchId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/finished-goods-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/display-bar/receipts"] });
      const wasDisplayBar = destination === 'display_bar' && status === 'finished';
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
      toast({ 
        title: "تم تسجيل الدفعة بنجاح", 
        description: wasDisplayBar 
          ? `تم الربط التلقائي مع بار العرض - سجلها: ${user?.firstName || user?.username}` 
          : `سجلها: ${user?.firstName || user?.username}` 
      });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/daily-production/batches/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      refetchBatches();
      refetchUnfinished();
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats", branchId, selectedDate] });
      setEditingBatch(null);
      toast({ title: "تم تحديث الدفعة بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/daily-production/batches/${id}`);
    },
    onSuccess: () => {
      refetchBatches();
      refetchUnfinished();
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats", branchId, selectedDate] });
      toast({ title: "تم حذف الدفعة" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Finish a batch (mark as completed) - includes who finished it
  // Backend automatically transfers to finished goods inventory
  const finishBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      const finisherName = user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.username || "";
      const res = await apiRequest("PATCH", `/api/daily-production/batches/${batchId}`, {
        status: "finished",
        finishedAt: new Date().toISOString(),
        finishedById: user?.id || null,
        finishedByName: finisherName || null,
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      refetchBatches();
      refetchUnfinished();
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats", branchId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ["/api/finished-goods-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/display-bar/receipts"] });
      toast({ title: "تم اكتمال الدفعة", description: result?.destination === 'display_bar' ? "تم ترحيلها للمخزون وبار العرض تلقائياً" : "تم تحديث حالة الدفعة وترحيلها للمخزون النهائي" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Carry-over: create a new batch today based on unfinished batch from previous day
  // Also marks the source batch as finished to prevent duplicates
  const carryOverMutation = useMutation({
    mutationFn: async (sourceBatch: DailyProductionBatch) => {
      // First, create the new batch
      const res = await apiRequest("POST", "/api/daily-production/batches", {
        branchId: sourceBatch.branchId,
        productId: sourceBatch.productId,
        productName: sourceBatch.productName,
        productCategory: sourceBatch.productCategory,
        quantity: sourceBatch.quantity,
        unit: sourceBatch.unit,
        destination: sourceBatch.destination,
        notes: `ترحيل من ${format(new Date(sourceBatch.producedAt), "yyyy-MM-dd")}`,
        productionDate: selectedDate, // Carry over to current selected date
        status: "in_progress",
        chefId: sourceBatch.chefId,
        chefName: sourceBatch.chefName,
        sourceBatchId: sourceBatch.id,
      });
      
      // Then mark the source batch as finished (carried over)
      await apiRequest("PATCH", `/api/daily-production/batches/${sourceBatch.id}`, {
        status: "finished",
        finishedAt: new Date().toISOString(),
        notes: (sourceBatch.notes ? sourceBatch.notes + " | " : "") + "تم ترحيله",
      });
      
      return res.json();
    },
    onSuccess: () => {
      refetchBatches();
      refetchUnfinished();
      queryClient.invalidateQueries({ queryKey: ["/api/daily-production/stats", branchId, selectedDate] });
      toast({ title: "تم الترحيل", description: "تم ترحيل الدفعة لليوم الحالي" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  // Helper to execute the actual batch creation
  const executeCreateBatch = () => {
    const numericQuantity = parseInt(quantity, 10);
    const product = products?.find(p => p.name === productName);
    const resolvedCategory = productCategory || product?.category || null;
    createMutation.mutate({
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
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !productName || !quantity || !destination) {
      toast({ title: "بيانات ناقصة", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    if (!selectedChefId) {
      toast({ title: "بيانات ناقصة", description: "يرجى اختيار الشيف المنتج", variant: "destructive" });
      return;
    }
    
    const numericQuantity = parseInt(quantity, 10);
    if (isNaN(numericQuantity) || numericQuantity <= 0) {
      toast({ title: "خطأ", description: "الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر", variant: "destructive" });
      return;
    }
    
    const product = products?.find(p => p.name === productName);
    const resolvedCategory = productCategory || product?.category || null;
    
    // Check for matching in-progress batch (only for sweets category)
    if (isSweetsCategory(resolvedCategory)) {
      const matchingBatch = findMatchingInProgressBatch(productName, product?.id);
      if (matchingBatch) {
        // Show dialog to ask user what to do
        setMatchingInProgressBatch(matchingBatch);
        setPendingSubmitAction(() => executeCreateBatch);
        setShowInProgressDialog(true);
        return;
      }
    }
    
    // No matching in-progress batch, proceed normally
    executeCreateBatch();
  };

  // Handle dialog: mark existing as finished, then create new batch
  const handleFinishExistingAndCreate = async () => {
    if (!matchingInProgressBatch) return;
    
    try {
      await finishBatchMutation.mutateAsync(matchingInProgressBatch.id);
      // After finishing, execute the pending create action
      if (pendingSubmitAction) {
        pendingSubmitAction();
      }
    } catch (error) {
      console.error("Error finishing batch:", error);
    } finally {
      setShowInProgressDialog(false);
      setMatchingInProgressBatch(null);
      setPendingSubmitAction(null);
    }
  };

  // Handle dialog: continue with new batch without finishing existing
  const handleContinueNewBatch = () => {
    if (pendingSubmitAction) {
      pendingSubmitAction();
    }
    setShowInProgressDialog(false);
    setMatchingInProgressBatch(null);
    setPendingSubmitAction(null);
  };

  // Handle dialog: cancel
  const handleCancelInProgressDialog = () => {
    setShowInProgressDialog(false);
    setMatchingInProgressBatch(null);
    setPendingSubmitAction(null);
  };

  // Helper to execute quick entry batch creation
  const executeQuickEntry = (product: Product, qty: number) => {
    createMutation.mutate({
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
    });
  };

  const handleQuickEntry = (product: Product, qty: number) => {
    // Check for matching in-progress batch (only for sweets category)
    if (isSweetsCategory(product.category)) {
      const matchingBatch = findMatchingInProgressBatch(product.name, product.id);
      if (matchingBatch) {
        // Show dialog to ask user what to do
        setMatchingInProgressBatch(matchingBatch);
        setPendingSubmitAction(() => () => executeQuickEntry(product, qty));
        setShowInProgressDialog(true);
        return;
      }
    }
    
    // No matching in-progress batch, proceed normally
    executeQuickEntry(product, qty);
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
    });
  };

  const openEditDialog = (batch: DailyProductionBatch) => {
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
    const filtered = products?.filter(p => p.category && BAKERY_CATEGORIES.includes(p.category)) || [];
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
    return products
      .filter(p => p.category && BAKERY_CATEGORIES.includes(p.category))
      .sort((a, b) => (productCounts[b.name] || 0) - (productCounts[a.name] || 0))
      .slice(0, 8);
  }, [batches, products]);

  const categoryFilteredProducts = useMemo(() => {
    const allBakery = products?.filter(p => p.category && BAKERY_CATEGORIES.includes(p.category)) || [];
    let filtered = selectedCategoryFilter === "الكل" ? allBakery : allBakery.filter(p => p.category === selectedCategoryFilter);
    if (productSearch) {
      const search = productSearch.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(search));
    }
    return filtered;
  }, [products, selectedCategoryFilter, productSearch]);

  const categoryCounts = useMemo(() => {
    const allBakery = products?.filter(p => p.category && BAKERY_CATEGORIES.includes(p.category)) || [];
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

  const handleProductCardClick = (product: Product) => {
    setQuantityDialogProduct(product);
    setQuickQuantity("");
    setTimeout(() => quantityInputRef.current?.focus(), 100);
  };

  const handleQuickQuantitySubmit = () => {
    if (!quantityDialogProduct) return;
    const qty = parseInt(quickQuantity, 10);
    if (isNaN(qty) || qty <= 0) return;

    if (!selectedChefId) {
      toast({ title: "اختر الشيف أولاً", description: "يرجى اختيار الشيف المنتج قبل تسجيل الإنتاج", variant: "destructive" });
      return;
    }

    handleQuickEntry(quantityDialogProduct, qty);
    setQuantityDialogProduct(null);
    setQuickQuantity("");
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
      <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/production-dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg sm:rounded-xl">
              <Factory className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground" data-testid="text-page-title">الإنتاج الفعلي اليومي</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">تسجيل ومتابعة دفعات الإنتاج على مدار اليوم</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/finished-goods-inventory">
              <Button variant="outline" size="sm" className="gap-1 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm" data-testid="btn-finished-goods">
                <Package className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">مخزون الإنتاج النهائي</span>
                <span className="sm:hidden">المخزون</span>
              </Button>
            </Link>
            {user && (
              <Badge variant="outline" className="gap-1 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs">
                <User className="h-3 w-3" />
                {user.firstName || user.username}
                {isAdmin && <Shield className="h-3 w-3 text-amber-600 mr-1" />}
              </Badge>
            )}
          </div>
        </div>

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
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

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
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
                  onClick={() => setShowManualEntry(true)}
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
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground">إدخال يدوي</span>
                  <span className="text-[10px] text-muted-foreground mt-1">منتج غير مدرج</span>
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
                            <p className="text-xs text-muted-foreground">
                              {batch.quantity} {batch.unit || "قطعة"} - {format(new Date(batch.producedAt), "yyyy-MM-dd")}
                            </p>
                          </div>
                          {canModifyRecords ? (
                            <div className="flex items-center gap-1 shrink-0 mr-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                                onClick={() => finishBatchMutation.mutate(batch.id)}
                                disabled={finishBatchMutation.isPending}
                              >
                                <CheckCircle className="h-3 w-3" />
                                اكتمل
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                                onClick={() => carryOverMutation.mutate(batch)}
                                disabled={carryOverMutation.isPending}
                              >
                                <Repeat className="h-3 w-3" />
                                ترحيل
                              </Button>
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
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500" onClick={() => finishBatchMutation.mutate(batch.id)} disabled={finishBatchMutation.isPending}>
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canModifyRecords && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" onClick={() => openEditDialog(batch)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canDeleteRecords && (
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
                                      <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(batch.id)}>
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
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-600" />
              إدخال منتج يدوي
            </DialogTitle>
            <DialogDescription>أدخل بيانات منتج غير موجود في القائمة</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(e);
            if (productName && quantity) {
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
              <Button type="button" variant="outline" onClick={() => setShowManualEntry(false)} className="h-11">
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !productName || !quantity}
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
      <Dialog open={!!quantityDialogProduct} onOpenChange={() => setQuantityDialogProduct(null)}>
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
                onClick={() => setQuantityDialogProduct(null)}
                className="h-12 text-sm"
              >
                إلغاء
              </Button>
              <Button
                onClick={handleQuickQuantitySubmit}
                disabled={!quickQuantity || parseInt(quickQuantity) <= 0 || createMutation.isPending}
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
      <Dialog open={showInProgressDialog} onOpenChange={setShowInProgressDialog}>
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
            {canModifyRecords ? (
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
    </Layout>
  );
}
