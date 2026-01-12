import { useState, useRef, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { useLocation, useParams, Link } from "wouter";
import { ArrowRight, Save, Send, Plus, Trash2, Wallet, CreditCard, Smartphone, Truck, AlertCircle, AlertTriangle, CheckCircle, Calculator, Users, Receipt, Camera, ImageIcon, X, Upload, FileDown, Copy, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Branch, CashierSalesJournal, CashierPaymentBreakdown, JournalAttachment } from "@shared/schema";
import { ATTACHMENT_TYPE_LABELS, ATTACHMENT_TYPES, type AttachmentType } from "@shared/schema";
import { printHtmlContent } from "@/lib/print-utils";

const PAYMENT_CATEGORIES = {
  cash: { label: "نقدي", color: "bg-green-100 text-green-700" },
  cards: { label: "بطاقات وشبكة", color: "bg-blue-100 text-blue-700" },
  apps: { label: "تطبيقات التوصيل (آجل)", color: "bg-purple-100 text-purple-700" },
};

// Payment methods ordered by most commonly used first
const PAYMENT_METHODS = [
  { value: "cash", label: "نقداً", icon: Wallet, category: "cash" },
  { value: "mada", label: "مدى", icon: CreditCard, category: "cards" },
  { value: "visa", label: "فيزا", icon: CreditCard, category: "cards" },
  { value: "mastercard", label: "ماستركارد", icon: CreditCard, category: "cards" },
  { value: "amex", label: "أمريكان إكسبريس", icon: CreditCard, category: "cards" },
  { value: "card_other", label: "بطاقة أخرى", icon: CreditCard, category: "cards" },
  // Legacy bank payment methods (for backward compatibility)
  { value: "card", label: "بطاقة ائتمان (قديم)", icon: CreditCard, category: "cards" },
  { value: "apple_pay", label: "Apple Pay", icon: Smartphone, category: "cards" },
  { value: "stc_pay", label: "STC Pay", icon: Smartphone, category: "cards" },
  // Delivery apps
  { value: "hunger_station", label: "هنقرستيشن", icon: Truck, category: "apps" },
  { value: "jahez", label: "جاهز", icon: Truck, category: "apps" },
  { value: "toyou", label: "ToYou", icon: Truck, category: "apps" },
  { value: "marsool", label: "مرسول", icon: Truck, category: "apps" },
  { value: "keeta", label: "كيتا", icon: Truck, category: "apps" },
  { value: "the_chefs", label: "ذا شيفز", icon: Truck, category: "apps" },
  { value: "talabat", label: "طلبات", icon: Truck, category: "apps" },
  { value: "other", label: "أخرى", icon: Wallet, category: "cash" },
];

const SHIFT_TYPES = [
  { value: "morning", label: "صباحي" },
  { value: "evening", label: "مسائي" },
  { value: "night", label: "ليلي" },
];

interface PaymentBreakdownInput {
  paymentMethod: string;
  amount: number;
  transactionCount: number;
  notes?: string;
  // Bank reconciliation fields - حقول مطابقة البنك
  posAmount?: number; // المبلغ من نظام نقاط البيع
  terminalAmount?: number; // المبلغ من جهاز الصراف البنكي
  bankDiscrepancy?: number; // الفرق
  bankDiscrepancyType?: string; // balanced, shortage, surplus
  terminalTransactionCount?: number; // عدد العمليات من جهاز البنك
}

// Bank payment methods that require terminal reconciliation (includes legacy methods)
const BANK_PAYMENT_METHODS = ["mada", "visa", "mastercard", "amex", "card_other", "card", "apple_pay", "stc_pay"];

const isBankPaymentMethod = (method: string): boolean => {
  return BANK_PAYMENT_METHODS.includes(method);
};

export default function CashierJournalFormPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [showShortageConfirm, setShowShortageConfirm] = useState(false);
  const [showVarianceConfirm, setShowVarianceConfirm] = useState(false);
  const [varianceConfirmed, setVarianceConfirmed] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<(() => void) | null>(null);
  const [activeTab, setActiveTab] = useState("shift");

  const isEdit = !!id;

  const getUserDisplayName = () => {
    if (!user) return "";
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    return user.username || "";
  };

  const [formData, setFormData] = useState({
    branchId: "",
    journalDate: new Date().toISOString().split("T")[0],
    shiftType: "morning",
    cashierName: "",
    cashierId: "",
    openingBalance: 0,
    totalSales: 0,
    cashTotal: 0,
    actualCashDrawer: 0,
    customerCount: 0,
    transactionCount: 0,
    notes: "",
  });

  useEffect(() => {
    if (!isEdit && user && !formData.cashierName) {
      setFormData(prev => ({
        ...prev,
        cashierName: getUserDisplayName(),
        cashierId: user.id,
        branchId: user.branchId || prev.branchId,
      }));
    }
  }, [user, isEdit]);

  const [paymentBreakdowns, setPaymentBreakdowns] = useState<PaymentBreakdownInput[]>([
    { paymentMethod: "cash", amount: 0, transactionCount: 0 },
  ]);

  // Returns state - المرتجع
  const [showReturns, setShowReturns] = useState(false);
  const [returnData, setReturnData] = useState({
    returnAmount: 0,
    returnPaymentMethod: "cash",
    returnReason: "",
    returnReference: "",
    hasReturn: false,
  });

  const [attachments, setAttachments] = useState<JournalAttachment[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<{
    attachmentType: AttachmentType;
    fileName: string;
    fileData: string;
    mimeType: string;
    fileSize: number;
  }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingType, setUploadingType] = useState<AttachmentType | null>(null);

  const { branches: filteredBranches, userBranchId, canSelectBranch } = useBranches();

  useEffect(() => {
    if (userBranchId && !formData.branchId && !isEdit) {
      setFormData(prev => ({ ...prev, branchId: userBranchId }));
    }
  }, [userBranchId, formData.branchId, isEdit]);

  const { data: existingJournal, isLoading: loadingJournal } = useQuery<CashierSalesJournal & { 
    paymentBreakdowns: CashierPaymentBreakdown[];
    signatures?: { signatureType: string; signerName: string; signatureData: string; signedAt: string }[];
  }>({
    queryKey: [`/api/cashier-journals/${id}`],
    enabled: isEdit,
  });

  const { data: existingAttachments } = useQuery<JournalAttachment[]>({
    queryKey: [`/api/cashier-journals/${id}/attachments`],
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingAttachments) {
      setAttachments(existingAttachments);
    }
  }, [existingAttachments]);

  useEffect(() => {
    if (existingJournal) {
      setFormData({
        branchId: existingJournal.branchId,
        journalDate: existingJournal.journalDate,
        shiftType: existingJournal.shiftType || "morning",
        cashierName: existingJournal.cashierName,
        cashierId: existingJournal.cashierId || "",
        openingBalance: existingJournal.openingBalance || 0,
        totalSales: existingJournal.totalSales,
        cashTotal: existingJournal.cashTotal,
        actualCashDrawer: existingJournal.actualCashDrawer,
        customerCount: existingJournal.customerCount || 0,
        transactionCount: existingJournal.transactionCount || 0,
        notes: existingJournal.notes || "",
      });
      if (existingJournal.paymentBreakdowns?.length > 0) {
        setPaymentBreakdowns(
          existingJournal.paymentBreakdowns.map((b: any) => ({
            paymentMethod: b.paymentMethod,
            amount: b.amount,
            transactionCount: b.transactionCount || 0,
            notes: b.notes || "",
            // Bank reconciliation fields
            posAmount: b.posAmount || b.amount || 0,
            terminalAmount: b.terminalAmount || 0,
            bankDiscrepancy: b.bankDiscrepancy || 0,
            bankDiscrepancyType: b.bankDiscrepancyType || 'balanced',
            terminalTransactionCount: b.terminalTransactionCount || 0,
          }))
        );
      }
      // Load returns data
      if ((existingJournal as any).hasReturn || (existingJournal as any).returnAmount > 0) {
        setReturnData({
          returnAmount: (existingJournal as any).returnAmount || 0,
          returnPaymentMethod: (existingJournal as any).returnPaymentMethod || "cash",
          returnReason: (existingJournal as any).returnReason || "",
          returnReference: (existingJournal as any).returnReference || "",
          hasReturn: (existingJournal as any).hasReturn || false,
        });
        setShowReturns(true);
      }
    }
  }, [existingJournal]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/cashier-journals", data);
      return res.json();
    },
    onSuccess: async (createdJournal: CashierSalesJournal) => {
      if (pendingAttachments.length > 0) {
        try {
          for (const attachment of pendingAttachments) {
            await apiRequest("POST", `/api/cashier-journals/${createdJournal.id}/attachments`, attachment);
          }
          setPendingAttachments([]);
        } catch (error) {
          console.error("Error uploading attachments:", error);
          toast({ title: "تحذير", description: "تم حفظ اليومية لكن فشل رفع بعض المرفقات", variant: "destructive" });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      toast({ title: "تم إنشاء اليومية بنجاح" });
      setLocation("/cashier-journals");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إنشاء اليومية", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("PATCH", `/api/cashier-journals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cashier-journals/${id}`] });
      toast({ title: "تم تحديث اليومية بنجاح" });
      setLocation("/cashier-journals");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث اليومية", variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: { signatureData?: string; signerName?: string }) =>
      apiRequest("POST", `/api/cashier-journals/${id}/submit`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      toast({ title: "تم تقديم اليومية للمراجعة" });
      setLocation("/cashier-journals");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تقديم اليومية", variant: "destructive" });
    },
  });

  const postMutation = useMutation({
    mutationFn: async (data: { signatureData?: string; signerName?: string }) =>
      apiRequest("POST", `/api/cashier-journals/${id}/post`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-journals"] });
      queryClient.invalidateQueries({ queryKey: [`/api/cashier-journals/${id}`] });
      toast({ title: "تم ترحيل اليومية بنجاح", description: "لم يعد بإمكانك تعديل هذه اليومية" });
      setLocation("/cashier-journals");
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في ترحيل اليومية", variant: "destructive" });
    },
  });

  const uploadAttachmentMutation = useMutation({
    mutationFn: async (data: { journalId: number; attachment: typeof pendingAttachments[0] }) => {
      const res = await apiRequest("POST", `/api/cashier-journals/${data.journalId}/attachments`, data.attachment);
      return res.json();
    },
    onSuccess: (newAttachment: JournalAttachment) => {
      setAttachments((prev) => [...prev, newAttachment]);
      queryClient.invalidateQueries({ queryKey: [`/api/cashier-journals/${id}/attachments`] });
      toast({ title: "تم رفع المرفق بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في رفع المرفق", variant: "destructive" });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: number) =>
      apiRequest("DELETE", `/api/cashier-journals/${id}/attachments/${attachmentId}`),
    onSuccess: (_, attachmentId) => {
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      queryClient.invalidateQueries({ queryKey: [`/api/cashier-journals/${id}/attachments`] });
      toast({ title: "تم حذف المرفق" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف المرفق", variant: "destructive" });
    },
  });

  const handleFileSelect = (type: AttachmentType) => {
    setUploadingType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*";
      fileInputRef.current.capture = "environment"; // Opens rear camera on mobile
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingType) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      
      if (isEdit && id) {
        uploadAttachmentMutation.mutate({
          journalId: parseInt(id),
          attachment: {
            attachmentType: uploadingType,
            fileName: file.name,
            fileData: base64Data,
            mimeType: file.type,
            fileSize: file.size,
          },
        });
      } else {
        setPendingAttachments((prev) => [
          ...prev,
          {
            attachmentType: uploadingType,
            fileName: file.name,
            fileData: base64Data,
            mimeType: file.type,
            fileSize: file.size,
          },
        ]);
      }
    };
    reader.readAsDataURL(file);
    
    e.target.value = "";
    setUploadingType(null);
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const isReadOnly = existingJournal && existingJournal.status !== "draft";

  // Threshold for shortage confirmation (50 SAR)
  const SHORTAGE_CONFIRM_THRESHOLD = 50;

  const doSave = () => {
    const canvas = signatureCanvasRef.current;
    const signatureData = hasSignature && canvas ? canvas.toDataURL("image/png") : undefined;

    const data = {
      ...formData,
      paymentBreakdowns: paymentBreakdowns.filter((b) => b.amount > 0 || (b.terminalAmount && b.terminalAmount > 0)),
      signatureData,
      signerName: formData.cashierName,
      // Returns data
      returnAmount: returnData.hasReturn ? returnData.returnAmount : 0,
      returnPaymentMethod: returnData.hasReturn ? returnData.returnPaymentMethod : null,
      returnReason: returnData.hasReturn ? returnData.returnReason : null,
      returnReference: returnData.hasReturn ? returnData.returnReference : null,
      hasReturn: returnData.hasReturn,
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSave = () => {
    if (!hasSignature && !isEdit) {
      toast({ 
        title: "التوقيع الإلكتروني مطلوب", 
        description: "يجب التوقيع الإلكتروني قبل حفظ اليومية", 
        variant: "destructive" 
      });
      return;
    }

    // Show warning if there's a mismatch but allow saving as draft
    if (getTotalsMismatch()) {
      toast({ 
        title: "تنبيه: فرق في الأرقام", 
        description: "سيتم حفظ اليومية كمسودة. يرجى تصحيح الفرق قبل الترحيل.", 
        variant: "default" 
      });
    }

    // Check for large shortage and show confirmation dialog
    const discrepancy = calculateDiscrepancy();
    if (discrepancy < -SHORTAGE_CONFIRM_THRESHOLD) {
      setPendingSaveAction(() => doSave);
      setShowShortageConfirm(true);
      return;
    }

    doSave();
  };

  const handleSaveAndPost = async () => {
    // Show confirmation if there's a variance, but allow posting after confirmation
    if (getTotalsMismatch() && !varianceConfirmed) {
      setShowVarianceConfirm(true);
      return;
    }
    // Reset confirmation flag for next time
    setVarianceConfirmed(false);

    const canvas = signatureCanvasRef.current;
    const signatureData = canvas ? canvas.toDataURL("image/png") : undefined;

    if (isEdit) {
      const data = {
        ...formData,
        paymentBreakdowns: paymentBreakdowns.filter((b) => b.amount > 0 || (b.terminalAmount && b.terminalAmount > 0)),
        // Returns data
        returnAmount: returnData.hasReturn ? returnData.returnAmount : 0,
        returnPaymentMethod: returnData.hasReturn ? returnData.returnPaymentMethod : null,
        returnReason: returnData.hasReturn ? returnData.returnReason : null,
        returnReference: returnData.hasReturn ? returnData.returnReference : null,
        hasReturn: returnData.hasReturn,
      };
      await updateMutation.mutateAsync(data);
    }

    postMutation.mutate({
      signatureData,
      signerName: formData.cashierName,
    });
  };

  const handleSubmit = () => {
    const canvas = signatureCanvasRef.current;
    const signatureData = canvas ? canvas.toDataURL("image/png") : undefined;

    submitMutation.mutate({
      signatureData,
      signerName: formData.cashierName,
    });
  };

  const addPaymentBreakdown = () => {
    setPaymentBreakdowns([...paymentBreakdowns, { paymentMethod: "card", amount: 0, transactionCount: 0 }]);
  };

  const removePaymentBreakdown = (index: number) => {
    setPaymentBreakdowns(paymentBreakdowns.filter((_, i) => i !== index));
  };

  // Update a single field - use functional state update to avoid stale state issues
  const updatePaymentBreakdown = (index: number, field: string, value: any) => {
    setPaymentBreakdowns(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Update cash total if we're updating amount on cash payment
      if (field === "amount") {
        const cashBreakdown = updated.find((b) => b.paymentMethod === "cash");
        if (cashBreakdown) {
          setFormData((prevForm) => ({ ...prevForm, cashTotal: cashBreakdown.amount }));
        }
      }
      
      return updated;
    });
  };

  // Update multiple fields at once - for bank payment updates that need to set both amount and posAmount
  const updatePaymentBreakdownMultiple = (index: number, updates: Partial<PaymentBreakdownInput>) => {
    setPaymentBreakdowns(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      
      // Update cash total if we're updating amount on cash payment
      if ('amount' in updates) {
        const cashBreakdown = updated.find((b) => b.paymentMethod === "cash");
        if (cashBreakdown) {
          setFormData((prevForm) => ({ ...prevForm, cashTotal: cashBreakdown.amount }));
        }
      }
      
      return updated;
    });
  };

  const getBreakdownTotal = () => {
    // Sum POS amounts only (what was sold), not terminal amounts
    // Terminal amounts are used in the comprehensive reconciliation summary
    return paymentBreakdowns.reduce((sum, b) => sum + (b.amount || 0), 0);
  };

  // Net sales = Total Sales from payment breakdowns - Returns
  // IMPORTANT: Use getBreakdownTotal() instead of formData.totalSales 
  // because formData.totalSales is not automatically updated from payment breakdowns
  const getNetSales = () => {
    const totalFromBreakdowns = getBreakdownTotal();
    return totalFromBreakdowns - (returnData.hasReturn ? returnData.returnAmount : 0);
  };

  // Get adjusted breakdown total (subtracts return from appropriate payment method)
  const getAdjustedBreakdownTotal = () => {
    const grossTotal = getBreakdownTotal();
    if (!returnData.hasReturn || returnData.returnAmount <= 0) {
      return grossTotal;
    }
    return grossTotal - returnData.returnAmount;
  };

  // Calculate total bank reconciliation discrepancy
  const getBankReconciliationSummary = () => {
    const bankPayments = paymentBreakdowns.filter(b => isBankPaymentMethod(b.paymentMethod) && (b.amount > 0 || b.terminalAmount));
    
    let totalPosAmount = 0;
    let totalTerminalAmount = 0;
    let totalPosTransactions = 0;
    let totalTerminalTransactions = 0;
    
    bankPayments.forEach(b => {
      totalPosAmount += b.posAmount || b.amount || 0;
      totalTerminalAmount += b.terminalAmount || 0;
      totalPosTransactions += b.transactionCount || 0;
      totalTerminalTransactions += b.terminalTransactionCount || 0;
    });
    
    const discrepancy = totalTerminalAmount - totalPosAmount;
    const transactionDiff = totalTerminalTransactions - totalPosTransactions;
    
    // Detect potential input error: when cash shortage equals bank surplus (wrong payment button pressed)
    const cashDiscrepancy = calculateDiscrepancy();
    const inputErrorDetected = Math.abs(cashDiscrepancy) > 0.5 && Math.abs(discrepancy) > 0.5 && 
      Math.abs(Math.abs(cashDiscrepancy) - Math.abs(discrepancy)) < 1 && 
      (cashDiscrepancy * discrepancy) < 0; // opposite signs
    
    return {
      bankPayments,
      totalPosAmount,
      totalTerminalAmount,
      totalPosTransactions,
      totalTerminalTransactions,
      discrepancy,
      transactionDiff,
      inputErrorDetected,
      type: discrepancy > 0.5 ? 'surplus' : discrepancy < -0.5 ? 'shortage' : 'balanced'
    };
  };

  const getTotalsMismatch = () => {
    // Compare breakdown total with total sales
    // If there's a return, compare gross totals (return is separate line item, not part of breakdown)
    const breakdownTotal = getBreakdownTotal();
    const diff = Math.abs(formData.totalSales - breakdownTotal);
    return diff > 0.01;
  };

  const calculateDiscrepancy = () => {
    // Use adjusted cash total if there's a cash return
    const adjustedCategoryTotals = getAdjustedCategoryTotals();
    const expectedCash = adjustedCategoryTotals.cash;
    return formData.actualCashDrawer - expectedCash;
  };

  // Calculate discrepancy for display (same as above but clearer)
  const getExpectedCashInDrawer = () => {
    const adjustedCategoryTotals = getAdjustedCategoryTotals();
    return adjustedCategoryTotals.cash;
  };

  // Comprehensive variance summary - unified source of truth
  const getVarianceSummary = () => {
    const bankSummary = getBankReconciliationSummary();
    const totalTerminal = bankSummary.totalTerminalAmount || 0;
    const actualCash = formData.actualCashDrawer || 0;
    const totalActualCollected = actualCash + totalTerminal;
    const netSalesVal = getNetSales();
    const cashDiscrepancy = calculateDiscrepancy();
    const bankDiscrepancy = bankSummary.discrepancy;
    
    // Get delivery apps total (آجل - deferred payments)
    // These should NOT be included in the expected collected amount
    // because the money comes later from the app companies
    const categoryTotals = getAdjustedCategoryTotals();
    const appsTotal = categoryTotals.apps || 0;
    
    // Expected collected = net sales - deferred apps
    // We only expect to collect cash + bank payments today
    const expectedCollected = netSalesVal - appsTotal;
    
    // Net variance = actual collected - expected collected (excluding deferred apps)
    const netVariance = totalActualCollected - expectedCollected;
    
    const absVariance = Math.abs(netVariance);
    const varianceType = absVariance <= 5 ? 'balanced' : absVariance <= 25 ? 'warning' : 'critical';
    
    return {
      netVariance,
      cashDiscrepancy,
      bankDiscrepancy,
      totalActualCollected,
      netSales: netSalesVal,
      expectedCollected, // Expected cash+bank (excluding deferred apps)
      appsTotal, // Deferred delivery apps amount
      varianceType,
      hasBankPayments: bankSummary.bankPayments.length > 0,
    };
  };

  const calculateAverageTicket = () => {
    if (formData.transactionCount > 0) {
      return formData.totalSales / formData.transactionCount;
    }
    return 0;
  };

  const getDiscrepancyStatus = () => {
    const diff = calculateDiscrepancy();
    if (diff === 0) return { label: "متوازن", color: "text-green-600 bg-green-50", isShortage: false };
    if (diff < 0) return { label: `عجز ${Math.abs(diff).toFixed(2)} ر.س`, color: "text-red-600 bg-red-50", isShortage: true };
    return { label: `زيادة ${diff.toFixed(2)} ر.س`, color: "text-amber-600 bg-amber-50", isShortage: false };
  };

  const getCategoryTotals = () => {
    const totals = { cash: 0, cards: 0, apps: 0 };
    paymentBreakdowns.forEach((b) => {
      const method = PAYMENT_METHODS.find((m) => m.value === b.paymentMethod);
      if (method) {
        totals[method.category as keyof typeof totals] += b.amount || 0;
      }
    });
    return totals;
  };

  // Get category totals adjusted for returns (subtracts return from appropriate category)
  const getAdjustedCategoryTotals = () => {
    const totals = getCategoryTotals();
    if (!returnData.hasReturn || returnData.returnAmount <= 0) {
      return totals;
    }
    
    // Find which category the return payment method belongs to
    const method = PAYMENT_METHODS.find((m) => m.value === returnData.returnPaymentMethod);
    if (method) {
      totals[method.category as keyof typeof totals] -= returnData.returnAmount;
    }
    return totals;
  };

  const getAppBreakdowns = () => {
    return paymentBreakdowns.filter((b) => {
      const method = PAYMENT_METHODS.find((m) => m.value === b.paymentMethod);
      return method?.category === "apps" && b.amount > 0;
    });
  };

  const getCardBreakdowns = () => {
    return paymentBreakdowns.filter((b) => {
      const method = PAYMENT_METHODS.find((m) => m.value === b.paymentMethod);
      return method?.category === "cards" && b.amount > 0;
    });
  };

  // Allow saving drafts even with mismatch, and allow posting with variance (after confirmation)
  const canSave = formData.totalSales > 0 && formData.branchId && formData.cashierName;
  const canPost = canSave; // Allow posting with variance - confirmation dialog will be shown

  const getDiscrepancyAnalysis = () => {
    const cashDiscrepancy = calculateDiscrepancy();
    const categoryTotals = getCategoryTotals();
    const breakdownTotal = getBreakdownTotal();
    const reportedTotal = formData.totalSales;
    
    if (cashDiscrepancy === 0) {
      return { type: "balanced", message: "الصندوق متوازن" };
    }
    
    const shortage = Math.abs(cashDiscrepancy);
    const breakdownDiff = Math.abs(breakdownTotal - reportedTotal);
    
    const expectedCashFromBreakdown = categoryTotals.cash;
    const actualCashInDrawer = formData.actualCashDrawer;
    const cashDiff = expectedCashFromBreakdown - actualCashInDrawer;
    
    const expectedNonCash = reportedTotal - actualCashInDrawer;
    const recordedNonCash = categoryTotals.cards + categoryTotals.apps;
    const nonCashVariance = Math.abs(recordedNonCash - expectedNonCash);
    
    if (cashDiscrepancy < 0) {
      if (categoryTotals.cards > 0 && breakdownDiff < 5) {
        if (Math.abs(cashDiff - (categoryTotals.cards - (reportedTotal - actualCashInDrawer - categoryTotals.apps))) < 10) {
          return { 
            type: "possible_misclass", 
            message: `عجز نقدي ${shortage.toFixed(2)} ر.س - قد يكون الكاشير ضرب حركة نقدي على أنها بطاقة. تحقق من العمليات وطابق المبالغ.` 
          };
        }
      }
      
      if (categoryTotals.cards > 0 && shortage > 10 && nonCashVariance > shortage * 0.5) {
        return { 
          type: "possible_misclass", 
          message: `عجز نقدي ${shortage.toFixed(2)} ر.س - يوجد تفاوت في تصنيف طرق الدفع. تحقق من صحة المبالغ المسجلة.` 
        };
      }
      
      return { 
        type: "shortage", 
        message: `عجز حقيقي بقيمة ${shortage.toFixed(2)} ر.س - سيُسجَّل على الكاشير` 
      };
    }
    
    return { 
      type: "surplus", 
      message: `زيادة في الصندوق بقيمة ${cashDiscrepancy.toFixed(2)} ر.س - يجب توضيح السبب` 
    };
  };

  const initCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#1e3a5f";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
    }
  };

  useEffect(() => {
    initCanvas();
  }, []);

  // Get coordinates from mouse or touch event
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      // Touch event
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      // Mouse event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent scrolling on touch
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const { x, y } = getCoordinates(e);
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling on touch
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const { x, y } = getCoordinates(e);
      if (ctx) {
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setHasSignature(true);
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasSignature(false);
  };

  const discrepancyStatus = getDiscrepancyStatus();
  const averageTicket = calculateAverageTicket();

  const handleExportPDF = () => {
    const branchName = branches?.find(b => b.id === formData.branchId)?.name || formData.branchId;
    
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    const categoryTotals = getCategoryTotals();
    const adjustedCategoryTotals = getAdjustedCategoryTotals();
    const expectedCash = formData.openingBalance + adjustedCategoryTotals.cash;
    const discrepancy = formData.actualCashDrawer - adjustedCategoryTotals.cash;
    const discrepancyStatusText = discrepancy === 0 ? 'متوازن' : discrepancy < 0 ? 'عجز' : 'فائض';
    const netSales = getNetSales();

    const STATUS_LABELS: Record<string, string> = {
      draft: "مسودة",
      submitted: "مُقدم للمراجعة", 
      approved: "معتمد",
      rejected: "مرفوض",
    };

    const SHIFT_LABELS: Record<string, string> = {
      morning: "صباحي",
      evening: "مسائي",
      night: "ليلي",
    };

    const PAYMENT_METHOD_LABELS: Record<string, string> = {
      cash: "نقداً",
      mada: "مدى",
      visa: "فيزا",
      mastercard: "ماستركارد",
      amex: "أمريكان إكسبريس",
      card_other: "بطاقة أخرى",
      card: "بطاقة ائتمان",
      apple_pay: "Apple Pay",
      stc_pay: "STC Pay",
      hunger_station: "هنقرستيشن",
      toyou: "ToYou",
      jahez: "جاهز",
      marsool: "مرسول",
      keeta: "كيتا",
      the_chefs: "ذا شيفز",
      talabat: "طلبات",
      other: "أخرى",
    };

    // Bank reconciliation summary for PDF
    const bankSummary = getBankReconciliationSummary();

    const formatDateTime = (dateVal: string | Date | null | undefined) => {
      if (!dateVal) return '-';
      const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
      return date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // Get signature from existing journal or from current canvas
    const savedCashierSig = existingJournal?.signatures?.find(s => s.signatureType === 'cashier');
    const canvas = signatureCanvasRef.current;
    const currentCanvasSignature = hasSignature && canvas ? canvas.toDataURL("image/png") : null;
    const cashierSigData = savedCashierSig?.signatureData || currentCanvasSignature;
    const supervisorSig = existingJournal?.signatures?.find(s => s.signatureType === 'supervisor');

    // Compact PDF - all data on single A4 page
    const totalTerminal = bankSummary.totalTerminalAmount || 0;
    const actualCash = formData.actualCashDrawer || 0;
    const totalActualCollected = actualCash + totalTerminal;
    const netVariance = totalActualCollected - netSales;

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>ملخص اليومية - ${formData.journalDate}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 6mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; background: white; color: #333; font-size: 9px; line-height: 1.2; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d4a853; padding-bottom: 4px; margin-bottom: 6px; }
    .header .title { font-size: 13px; font-weight: bold; }
    .header .info { font-size: 8px; color: #666; }
    .main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .section { margin-bottom: 6px; page-break-inside: avoid; }
    .section-title { font-size: 9px; font-weight: bold; color: #333; margin-bottom: 3px; padding: 2px 4px; background: #f5f5f5; border-right: 3px solid #d4a853; }
    .row { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px solid #f0f0f0; font-size: 8px; }
    .row .label { color: #666; }
    .row .value { font-weight: bold; }
    .row .value.big { font-size: 11px; color: #333; }
    .cat-row { display: flex; justify-content: space-between; padding: 2px 4px; font-size: 8px; font-weight: bold; border-radius: 2px; margin: 2px 0; }
    .cat-row.cash { background: #e8f5e9; }
    .cat-row.cards { background: #fff3e0; }
    .cat-row.apps { background: #fce4ec; }
    .sub-row { display: flex; justify-content: space-between; padding: 1px 8px; font-size: 7px; color: #666; }
    .box { background: #fafafa; padding: 4px; border-radius: 3px; margin-top: 3px; }
    .box-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 8px; }
    .variance-box { text-align: center; padding: 4px; border-radius: 4px; margin-top: 4px; }
    .variance-box.shortage { background: #ffebee; }
    .variance-box.surplus { background: #e8f5e9; }
    .variance-box.balanced { background: #e8f5e9; }
    .variance-box .amount { font-size: 12px; font-weight: bold; }
    .variance-box .amount.negative { color: #c62828; }
    .variance-box .amount.positive { color: #2e7d32; }
    .variance-box .status { font-size: 8px; font-weight: bold; }
    .final-summary { background: linear-gradient(135deg, #fef9e7 0%, #fcf3cf 100%); border: 2px solid #d4a853; border-radius: 6px; padding: 8px; margin: 6px 0; }
    .final-summary .title { font-size: 10px; font-weight: bold; text-align: center; margin-bottom: 4px; color: #333; }
    .final-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; text-align: center; }
    .final-item { padding: 4px; background: white; border-radius: 4px; }
    .final-item .label { font-size: 7px; color: #666; }
    .final-item .value { font-size: 11px; font-weight: bold; }
    .sig-section { margin-top: 6px; padding-top: 4px; border-top: 1px solid #d4a853; }
    .sig-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .sig-box { text-align: center; padding: 4px; border: 1px solid #ddd; border-radius: 4px; min-height: 50px; }
    .sig-box .role { font-size: 8px; font-weight: bold; color: #666; }
    .sig-box .sig-img { max-width: 60px; max-height: 25px; margin: 2px auto; display: block; }
    .sig-box .name { font-size: 8px; font-weight: bold; }
    .sig-box .placeholder { height: 25px; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 7px; }
    .footer { margin-top: 4px; padding-top: 3px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; font-size: 7px; color: #666; }
    .print-btn { position: fixed; top: 10px; left: 10px; background: #d4a853; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 11px; z-index: 100; }
    .bank-detail { display: flex; justify-content: space-between; padding: 1px 4px; font-size: 7px; margin: 1px 0; border-radius: 2px; }
    @media print { .print-btn { display: none !important; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">طباعة</button>
  
  <div class="header">
    <div>
      <div class="title">ملخص يومية الكاشير #${existingJournal?.id || '-'}</div>
      <div class="info">${branchName} | ${SHIFT_LABELS[formData.shiftType] || formData.shiftType} | ${formatDate(formData.journalDate)}</div>
    </div>
    <div style="text-align:left;font-size:8px;">
      <div>الكاشير: <strong>${formData.cashierName}</strong></div>
    </div>
  </div>
  
  <!-- Final Summary Banner -->
  <div class="final-summary">
    <div class="title">📊 ملخص التسوية النهائي</div>
    <div class="final-grid">
      <div class="final-item">
        <div class="label">صافي المبيعات</div>
        <div class="value">${netSales.toLocaleString('en', {minimumFractionDigits: 2})}</div>
      </div>
      <div class="final-item">
        <div class="label">إجمالي المحصّل (نقد+بنك)</div>
        <div class="value" style="color:#2e7d32;">${totalActualCollected.toLocaleString('en', {minimumFractionDigits: 2})}</div>
      </div>
      <div class="final-item">
        <div class="label">الفارق الإجمالي</div>
        <div class="value" style="color:${netVariance >= 0 ? '#2e7d32' : '#c62828'};">${netVariance >= 0 ? '+' : ''}${netVariance.toLocaleString('en', {minimumFractionDigits: 2})}</div>
      </div>
    </div>
    ${returnData.hasReturn && returnData.returnAmount > 0 ? `<div style="font-size:7px;text-align:center;color:#c62828;margin-top:3px;">شامل مرتجع: -${returnData.returnAmount.toFixed(2)} ر.س (${PAYMENT_METHOD_LABELS[returnData.returnPaymentMethod] || returnData.returnPaymentMethod})</div>` : ''}
  </div>
  
  <div class="main-grid">
    <!-- Left Column -->
    <div>
      <div class="section">
        <div class="section-title">ملخص المبيعات</div>
        <div class="row"><span class="label">إجمالي المبيعات</span><span class="value big">${formData.totalSales.toLocaleString('en', {minimumFractionDigits: 2})} ر.س</span></div>
        ${returnData.hasReturn && returnData.returnAmount > 0 ? `
        <div class="row" style="color:#c62828;"><span class="label">المرتجع</span><span class="value">-${returnData.returnAmount.toFixed(2)} ر.س</span></div>
        <div class="row" style="border-top:1px solid #ddd;"><span class="label"><strong>صافي</strong></span><span class="value big" style="color:#2e7d32;">${netSales.toFixed(2)} ر.س</span></div>
        ` : ''}
        <div class="row"><span class="label">عدد الفواتير</span><span class="value">${formData.transactionCount}</span></div>
        <div class="row"><span class="label">متوسط الفاتورة</span><span class="value">${averageTicket.toFixed(2)} ر.س</span></div>
      </div>
      
      <div class="section">
        <div class="section-title">💵 تسوية الصندوق النقدي</div>
        <div class="box">
          <div class="box-row"><span>النقدية المتوقعة</span><span>${adjustedCategoryTotals.cash.toFixed(2)} ر.س</span></div>
          <div class="box-row"><span>الفعلي في الصندوق</span><span>${formData.actualCashDrawer.toFixed(2)} ر.س</span></div>
        </div>
        <div class="variance-box ${discrepancy === 0 ? 'balanced' : discrepancy < 0 ? 'shortage' : 'surplus'}">
          <div class="amount ${discrepancy < 0 ? 'negative' : discrepancy > 0 ? 'positive' : ''}">${discrepancy >= 0 ? '+' : ''}${discrepancy.toFixed(2)} ر.س</div>
          <div class="status">${discrepancy === 0 ? 'مطابق ✓' : discrepancy < 0 ? 'عجز' : 'فائض'}</div>
        </div>
      </div>
      
      ${bankSummary.bankPayments.length > 0 ? `
      <div class="section">
        <div class="section-title">🏦 مطابقة البنك</div>
        <div class="box">
          <div class="box-row"><span>POS</span><span>${bankSummary.totalPosAmount.toFixed(2)} ر.س</span></div>
          <div class="box-row"><span>التيرمنال</span><span>${bankSummary.totalTerminalAmount.toFixed(2)} ر.س</span></div>
          <div class="box-row" style="border-top:1px solid #ddd;font-weight:bold;">
            <span>الفرق</span>
            <span style="color:${bankSummary.type === 'shortage' ? '#c62828' : bankSummary.type === 'surplus' ? '#2e7d32' : '#333'};">
              ${bankSummary.discrepancy >= 0 ? '+' : ''}${bankSummary.discrepancy.toFixed(2)} ر.س
            </span>
          </div>
        </div>
        <div style="margin-top:2px;">
          ${bankSummary.bankPayments.map(p => {
            const posAmt = p.posAmount || p.amount || 0;
            const termAmt = p.terminalAmount || 0;
            const diff = termAmt - posAmt;
            const bg = diff > 0.5 ? '#e8f5e9' : diff < -0.5 ? '#ffebee' : '#f5f5f5';
            return `<div class="bank-detail" style="background:${bg};"><span>${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</span><span>POS:${posAmt.toFixed(0)} | T:${termAmt.toFixed(0)} | <strong style="color:${diff < 0 ? '#c62828' : '#2e7d32'};">${diff >= 0 ? '+' : ''}${diff.toFixed(0)}</strong></span></div>`;
          }).join('')}
        </div>
      </div>
      ` : ''}
    </div>
    
    <!-- Right Column -->
    <div>
      <div class="section">
        <div class="section-title">تصنيف المبيعات</div>
        <div class="cat-row cash"><span>💵 نقدي</span><span>${categoryTotals.cash.toFixed(2)} ر.س</span></div>
        
        <div class="cat-row cards"><span>💳 بطاقات</span><span>${categoryTotals.cards.toFixed(2)} ر.س</span></div>
        ${paymentBreakdowns.filter(p => p.amount > 0 && ['mada', 'visa', 'mastercard', 'amex', 'card_other', 'card', 'apple_pay', 'stc_pay'].includes(p.paymentMethod)).map(p => `
        <div class="sub-row"><span>• ${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</span><span>${p.amount.toFixed(2)}</span></div>
        `).join('')}
        
        ${categoryTotals.apps > 0 ? `
        <div class="cat-row apps"><span>🚗 توصيل</span><span>${categoryTotals.apps.toFixed(2)} ر.س</span></div>
        ${paymentBreakdowns.filter(p => p.amount > 0 && ['hunger_station', 'toyou', 'jahez', 'marsool', 'keeta', 'the_chefs', 'talabat'].includes(p.paymentMethod)).map(p => `
        <div class="sub-row"><span>• ${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</span><span>${p.amount.toFixed(2)}</span></div>
        `).join('')}
        ` : ''}
      </div>
      
      ${returnData.hasReturn && returnData.returnAmount > 0 ? `
      <div class="section">
        <div class="section-title" style="color:#c62828;">🔄 المرتجع</div>
        <div class="box" style="background:#ffebee;">
          <div class="box-row"><span>المبلغ</span><span style="color:#c62828;font-weight:bold;">-${returnData.returnAmount.toFixed(2)} ر.س</span></div>
          <div class="box-row"><span>الطريقة</span><span>${PAYMENT_METHOD_LABELS[returnData.returnPaymentMethod] || returnData.returnPaymentMethod}</span></div>
          ${returnData.returnReference ? `<div class="box-row"><span>المرجع</span><span>${returnData.returnReference}</span></div>` : ''}
        </div>
      </div>
      ` : ''}
      
      ${formData.notes ? `
      <div class="section">
        <div class="section-title">ملاحظات</div>
        <div style="font-size:7px;color:#666;padding:3px;background:#fffbeb;border-radius:2px;">${formData.notes}</div>
      </div>
      ` : ''}
    </div>
  </div>
  
  <div class="sig-section">
    <div class="sig-grid">
      <div class="sig-box">
        <div class="role">توقيع الكاشير</div>
        ${cashierSigData ? `<img class="sig-img" src="${cashierSigData}" />` : '<div class="placeholder">-</div>'}
        <div class="name">${formData.cashierName}</div>
      </div>
      <div class="sig-box">
        <div class="role">المشرف</div>
        ${supervisorSig?.signatureData ? `<img class="sig-img" src="${supervisorSig.signatureData}" /><div class="name">${supervisorSig.signerName}</div>` : '<div class="placeholder">-</div><div class="name">________</div>'}
      </div>
      <div class="sig-box">
        <div class="role">المدير</div>
        ${existingJournal?.approvedBy ? `<div class="name" style="margin-top:8px;">${existingJournal.approvedBy}</div>` : '<div class="placeholder">-</div><div class="name">________</div>'}
      </div>
    </div>
  </div>
  
  <div class="footer">
    <span>بتر بيكري - Butter Bakery</span>
    <span>${new Date().toLocaleDateString('en-GB')}</span>
  </div>
</body>
</html>`;

    printHtmlContent(htmlContent);
  };

  if (isEdit && loadingJournal) {
    return (
      <Layout>
        <div className="p-6">
          <Skeleton className="h-12 w-48 mb-6" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/cashier-journals">
              <Button variant="ghost" size="sm" className="h-11 w-11 sm:h-9 sm:w-9" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary" data-testid="page-title">
                {isEdit ? "تعديل يومية المبيعات" : "يومية مبيعات جديدة"}
              </h1>
            </div>
          </div>
          {isEdit && (
            <Button onClick={handleExportPDF} className="gap-2 bg-amber-600 hover:bg-amber-700 h-11 sm:h-9" data-testid="button-export-pdf">
              <FileDown className="w-4 h-4" />
              تصدير PDF
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>معلومات اليومية</CardTitle>
                <CardDescription>بيانات الوردية والكاشير</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-3 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label>الفرع *</Label>
                    <Select value={formData.branchId} onValueChange={(v) => setFormData({ ...formData, branchId: v })} disabled={isReadOnly || !canSelectBranch}>
                      <SelectTrigger className="h-12 text-base" data-testid="select-branch">
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {filteredBranches?.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>التاريخ *</Label>
                    <Input
                      type="date"
                      value={formData.journalDate}
                      onChange={(e) => setFormData({ ...formData, journalDate: e.target.value })}
                      disabled={isReadOnly}
                      className="h-12 text-base"
                      data-testid="input-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الوردية *</Label>
                    <Select value={formData.shiftType} onValueChange={(v) => setFormData({ ...formData, shiftType: v })} disabled={isReadOnly}>
                      <SelectTrigger className="h-12 text-base" data-testid="select-shift">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {SHIFT_TYPES.map((shift) => (
                          <SelectItem key={shift.value} value={shift.value}>
                            {shift.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>اسم الكاشير *</Label>
                    <Input
                      value={formData.cashierName}
                      readOnly
                      className="bg-muted cursor-not-allowed h-12 text-base"
                      placeholder="اسم الكاشير"
                      data-testid="input-cashier-name"
                    />
                    <p className="text-xs text-muted-foreground">يتم تحديد اسم الكاشير تلقائياً من حساب المستخدم الحالي</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary/20">
              <CardHeader className="bg-primary/5">
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  إجمالي المبيعات من تقرير الشفت
                </CardTitle>
                <CardDescription>أدخل إجمالي المبيعات كما يظهر في تقرير الكاشير أو تقرير نهاية الوردية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 p-3 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label className="text-base sm:text-lg font-semibold">إجمالي المبيعات (ر.س) *</Label>
                    <Input
                      type="number"
                      value={formData.totalSales ?? ""}
                      onChange={(e) => setFormData({ ...formData, totalSales: parseFloat(e.target.value) || 0 })}
                      className="text-lg sm:text-xl font-bold h-12 sm:h-14 min-h-[48px]"
                      placeholder="0.00"
                      disabled={isReadOnly}
                      data-testid="input-total-sales"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      عدد الفواتير *
                    </Label>
                    <Input
                      type="number"
                      value={formData.transactionCount ?? ""}
                      onChange={(e) => setFormData({ ...formData, transactionCount: parseInt(e.target.value) || 0 })}
                      className="h-12 sm:h-14 min-h-[48px]"
                      placeholder="0"
                      disabled={isReadOnly}
                      data-testid="input-transaction-count"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calculator className="w-4 h-4" />
                      متوسط الفاتورة
                    </Label>
                    <div className="h-14 flex items-center justify-center bg-muted rounded-md px-4">
                      <span className="text-xl font-bold text-primary" data-testid="text-average-ticket">
                        {averageTicket.toFixed(2)} ر.س
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>رصيد سابق للدرج (عهدة)</Label>
                  <Input
                    type="number"
                    value={formData.openingBalance ?? ""}
                    onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    disabled={isReadOnly}
                    className="h-11 sm:h-10"
                    data-testid="input-opening-balance"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">تفصيل المبيعات حسب طريقة الدفع</CardTitle>
                    <CardDescription>أدخل المبيعات لكل طريقة دفع</CardDescription>
                  </div>
                  {!isReadOnly && (
                    <Button variant="outline" size="lg" className="h-12 px-4 gap-2" onClick={addPaymentBreakdown} data-testid="button-add-payment">
                      <Plus className="w-5 h-5" />
                      إضافة طريقة دفع
                    </Button>
                  )}
                </div>
                
                {/* Quick Add Buttons - Bank Payment Methods */}
                {!isReadOnly && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-3">إضافة سريعة للبطاقات البنكية:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "mada", label: "مدى", color: "bg-blue-500 hover:bg-blue-600" },
                        { value: "visa", label: "فيزا", color: "bg-indigo-500 hover:bg-indigo-600" },
                        { value: "mastercard", label: "ماستركارد", color: "bg-orange-500 hover:bg-orange-600" },
                        { value: "amex", label: "أمريكان إكسبريس", color: "bg-teal-500 hover:bg-teal-600" },
                        { value: "card_other", label: "بطاقة أخرى", color: "bg-gray-500 hover:bg-gray-600" },
                      ].filter(m => !paymentBreakdowns.some(p => p.paymentMethod === m.value)).map(method => (
                        <Button
                          key={method.value}
                          type="button"
                          size="lg"
                          className={`h-12 px-4 text-white ${method.color}`}
                          onClick={() => setPaymentBreakdowns([...paymentBreakdowns, { 
                            paymentMethod: method.value, 
                            amount: 0, 
                            transactionCount: 0,
                            posAmount: 0,
                            terminalAmount: 0,
                            terminalTransactionCount: 0
                          }])}
                          data-testid={`quick-add-${method.value}`}
                        >
                          <CreditCard className="w-5 h-5 ml-2" />
                          {method.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentBreakdowns.map((breakdown, index) => {
                  const method = PAYMENT_METHODS.find((m) => m.value === breakdown.paymentMethod);
                  const Icon = method?.icon || Wallet;
                  const isBank = isBankPaymentMethod(breakdown.paymentMethod);
                  const bankDisc = (breakdown.terminalAmount || 0) - (breakdown.posAmount || breakdown.amount || 0);
                  const bankDiscType = bankDisc > 0.5 ? 'surplus' : bankDisc < -0.5 ? 'shortage' : 'balanced';

                  return (
                    <div key={index} className={`p-4 border-2 rounded-xl ${isBank ? 'border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100/50' : 'border-gray-200 bg-gray-50/50'}`} data-testid={`payment-row-${index}`}>
                      {/* Payment Method Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isBank ? 'bg-blue-200' : 'bg-gray-200'}`}>
                            <Icon className={`w-6 h-6 ${isBank ? 'text-blue-700' : 'text-gray-600'}`} />
                          </div>
                          <Select
                            value={breakdown.paymentMethod}
                            onValueChange={(v) => {
                              if (!isBankPaymentMethod(v)) {
                                updatePaymentBreakdownMultiple(index, {
                                  paymentMethod: v,
                                  terminalAmount: 0,
                                  posAmount: 0,
                                  terminalTransactionCount: 0,
                                });
                              } else {
                                updatePaymentBreakdown(index, "paymentMethod", v);
                              }
                            }}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="w-48 h-12 text-base font-medium">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60 overflow-y-auto">
                              {PAYMENT_METHODS.map((m) => (
                                <SelectItem key={m.value} value={m.value} className="py-3">
                                  {m.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {paymentBreakdowns.length > 1 && !isReadOnly && (
                          <Button variant="ghost" size="lg" className="h-12 w-12 text-red-500 hover:text-red-600 hover:bg-red-100" onClick={() => removePaymentBreakdown(index)}>
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Amount Inputs */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">{isBank ? "مبلغ الكاشير (POS)" : "المبلغ"}</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={breakdown.amount ?? ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              if (isBank) {
                                updatePaymentBreakdownMultiple(index, { amount: val, posAmount: val });
                              } else {
                                updatePaymentBreakdown(index, "amount", val);
                              }
                            }}
                            disabled={isReadOnly}
                            className="h-14 text-xl font-bold text-center"
                            data-testid={`input-payment-amount-${index}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">عدد العمليات</Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            placeholder="0"
                            value={breakdown.transactionCount ?? ""}
                            onChange={(e) => updatePaymentBreakdown(index, "transactionCount", parseInt(e.target.value) || 0)}
                            disabled={isReadOnly}
                            className="h-14 text-xl font-bold text-center"
                            data-testid={`input-payment-count-${index}`}
                          />
                        </div>
                      </div>
                      
                      {/* Bank Reconciliation Row - Only for bank payment methods */}
                      {isBank && (
                        <div className="mt-4 pt-4 border-t-2 border-blue-300">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-bold text-blue-700">🏦 مطابقة التيرمنال</span>
                            </div>
                            {!isReadOnly && (
                              <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                className="h-11 px-4 bg-blue-50 hover:bg-blue-100 border-blue-300 gap-2"
                                onClick={() => updatePaymentBreakdown(index, "terminalAmount", breakdown.amount || 0)}
                              >
                                <Copy className="w-4 h-4" />
                                نسخ من الكاشير
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">مبلغ التيرمنال</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={breakdown.terminalAmount ?? ""}
                                onChange={(e) => updatePaymentBreakdown(index, "terminalAmount", parseFloat(e.target.value) || 0)}
                                disabled={isReadOnly}
                                className="h-14 text-xl font-bold text-center bg-white"
                                data-testid={`input-terminal-amount-${index}`}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">عدد عمليات التيرمنال</Label>
                              <Input
                                type="number"
                                inputMode="numeric"
                                placeholder="0"
                                value={breakdown.terminalTransactionCount ?? ""}
                                onChange={(e) => updatePaymentBreakdown(index, "terminalTransactionCount", parseInt(e.target.value) || 0)}
                                disabled={isReadOnly}
                                className="h-14 text-xl font-bold text-center bg-white"
                                data-testid={`input-terminal-count-${index}`}
                              />
                            </div>
                          </div>
                          {/* Discrepancy Summary */}
                          <div className={`mt-3 p-3 rounded-lg flex items-center justify-between ${bankDiscType === 'surplus' ? 'bg-emerald-100 border border-emerald-300' : bankDiscType === 'shortage' ? 'bg-red-100 border border-red-300' : 'bg-gray-100 border border-gray-300'}`}>
                            <span className="font-medium">الفرق:</span>
                            <span className={`text-xl font-bold ${bankDiscType === 'surplus' ? 'text-emerald-700' : bankDiscType === 'shortage' ? 'text-red-700' : 'text-gray-600'}`}>
                              {bankDisc >= 0 ? '+' : ''}{bankDisc.toFixed(2)} ر.س
                              {bankDiscType === 'surplus' ? ' ⬆️' : bankDiscType === 'shortage' ? ' ⬇️' : ' ✓'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <Separator />
                <div className="flex justify-between items-center text-lg font-medium">
                  <span>مجموع التفصيل</span>
                  <span data-testid="text-breakdown-total">{getBreakdownTotal().toFixed(2)} ر.س</span>
                </div>
                {getTotalsMismatch() && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>تحذير: فرق في الأرقام</AlertTitle>
                    <AlertDescription>
                      مجموع التفصيل ({getBreakdownTotal().toFixed(2)} ر.س) لا يطابق إجمالي المبيعات ({formData.totalSales.toFixed(2)} ر.س)
                      <br />
                      الفرق: {Math.abs(formData.totalSales - getBreakdownTotal()).toFixed(2)} ر.س
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Bank Reconciliation Summary */}
                {(() => {
                  const bankSummary = getBankReconciliationSummary();
                  if (bankSummary.bankPayments.length === 0) return null;
                  
                  return (
                    <>
                      <Separator />
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-3">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                          <span className="font-bold text-blue-700">ملخص مطابقة البنك</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="p-2 bg-white rounded">
                            <div className="text-muted-foreground text-xs">إجمالي POS</div>
                            <div className="font-bold">{bankSummary.totalPosAmount.toFixed(2)} ر.س</div>
                          </div>
                          <div className="p-2 bg-white rounded">
                            <div className="text-muted-foreground text-xs">إجمالي التيرمنال</div>
                            <div className="font-bold">{bankSummary.totalTerminalAmount.toFixed(2)} ر.س</div>
                          </div>
                          <div className={`p-2 rounded ${bankSummary.type === 'surplus' ? 'bg-emerald-200 border border-emerald-400' : bankSummary.type === 'shortage' ? 'bg-red-200 border border-red-400' : 'bg-gray-100'}`}>
                            <div className="text-muted-foreground text-xs">الفرق الإجمالي</div>
                            <div className={`font-bold ${bankSummary.type === 'surplus' ? 'text-emerald-800' : bankSummary.type === 'shortage' ? 'text-red-800' : ''}`}>
                              {bankSummary.discrepancy.toFixed(2)} ر.س
                            </div>
                          </div>
                          <div className={`p-2 rounded flex items-center justify-center ${bankSummary.type === 'surplus' ? 'bg-emerald-200 text-emerald-800 border border-emerald-400' : bankSummary.type === 'shortage' ? 'bg-red-200 text-red-800 border border-red-400' : 'bg-gray-100'}`}>
                            <span className="font-bold text-sm">
                              {bankSummary.type === 'surplus' ? '⬆️ زيادة في البنك' : bankSummary.type === 'shortage' ? '⬇️ عجز في البنك' : '✓ متطابق'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Bank Payment Details Breakdown */}
                        {bankSummary.bankPayments.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-blue-200">
                            <div className="text-xs text-blue-600 mb-2 font-medium">تفاصيل البطاقات البنكية:</div>
                            <div className="space-y-1">
                              {bankSummary.bankPayments.map((payment, idx) => {
                                const methodLabel = PAYMENT_METHODS.find(m => m.value === payment.paymentMethod)?.label || payment.paymentMethod;
                                const posAmt = payment.posAmount || payment.amount || 0;
                                const termAmt = payment.terminalAmount || 0;
                                const diff = termAmt - posAmt;
                                const diffStatus = diff > 0.5 ? 'surplus' : diff < -0.5 ? 'shortage' : 'balanced';
                                return (
                                  <div key={idx} className={`flex items-center justify-between text-xs p-2 rounded border ${diffStatus === 'surplus' ? 'bg-emerald-50 border-emerald-200' : diffStatus === 'shortage' ? 'bg-red-50 border-red-200' : 'bg-white/50 border-gray-200'}`}>
                                    <span className="text-gray-700 font-medium">{methodLabel}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-gray-600">POS: {posAmt.toFixed(2)}</span>
                                      <span className="text-gray-600">تيرمنال: {termAmt.toFixed(2)}</span>
                                      <span className={`font-bold px-2 py-0.5 rounded ${diffStatus === 'surplus' ? 'bg-emerald-200 text-emerald-800' : diffStatus === 'shortage' ? 'bg-red-200 text-red-800' : 'text-gray-500'}`}>
                                        ({diff >= 0 ? '+' : ''}{diff.toFixed(2)})
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Tolerance Note - for small differences within 0.5 SAR */}
                        {bankSummary.type === 'balanced' && Math.abs(bankSummary.discrepancy) > 0.01 && Math.abs(bankSummary.discrepancy) <= 0.5 && (
                          <p className="mt-2 text-xs text-blue-600 bg-blue-100 p-2 rounded">
                            ℹ️ الفرق ({Math.abs(bankSummary.discrepancy).toFixed(2)} ر.س) ضمن حد التسامح المسموح (0.50 ر.س) ويتم تداركه في إجمالي اليومية
                          </p>
                        )}
                        
                        {/* Input Error Detection Alert */}
                        {bankSummary.inputErrorDetected && (
                          <Alert className="mt-3 border-orange-300 bg-orange-50">
                            <AlertCircle className="h-4 w-4 text-orange-600" />
                            <AlertTitle className="text-orange-700">تنبيه: احتمال خطأ في الإدخال</AlertTitle>
                            <AlertDescription className="text-orange-600">
                              يُحتمل أن الكاشير ضغط زر الدفع الخاطئ! 
                              <br />
                              العجز النقدي ({Math.abs(calculateDiscrepancy()).toFixed(2)} ر.س) يساوي تقريباً الزيادة في البنك ({Math.abs(bankSummary.discrepancy).toFixed(2)} ر.س)
                              <br />
                              <strong>يرجى مراجعة عمليات الدفع والتأكد من صحتها.</strong>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Returns Section - المرتجع */}
            <Card className={`border-2 ${showReturns && returnData.hasReturn ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`}>
              <CardHeader className={`pb-2 ${showReturns && returnData.hasReturn ? 'bg-red-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-red-600" />
                    <CardTitle className={`text-base ${showReturns && returnData.hasReturn ? 'text-red-700' : 'text-gray-600'}`}>
                      المرتجعات
                    </CardTitle>
                    {returnData.hasReturn && returnData.returnAmount > 0 && (
                      <Badge variant="destructive" className="mr-2">
                        -{returnData.returnAmount.toFixed(2)} ر.س
                      </Badge>
                    )}
                  </div>
                  {!isReadOnly && (
                    <Button
                      type="button"
                      variant={showReturns ? "destructive" : "outline"}
                      size="sm"
                      className="h-12 text-base"
                      onClick={() => {
                        if (showReturns) {
                          setShowReturns(false);
                          setReturnData({ returnAmount: 0, returnPaymentMethod: "cash", returnReason: "", returnReference: "", hasReturn: false });
                        } else {
                          setShowReturns(true);
                          setReturnData(prev => ({ ...prev, hasReturn: true }));
                        }
                      }}
                      data-testid="button-toggle-returns"
                    >
                      {showReturns ? (
                        <>
                          <X className="w-4 h-4 ml-1" />
                          إلغاء المرتجع
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 ml-1" />
                          إضافة مرتجع
                        </>
                      )}
                    </Button>
                  )}
                </div>
                {!showReturns && !returnData.hasReturn && (
                  <CardDescription className="text-gray-500 text-sm mt-1">
                    اضغط على "إضافة مرتجع" في حال وجود مرتجع يُخصم من المبيعات
                  </CardDescription>
                )}
              </CardHeader>
              
              {showReturns && (
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-red-700 font-medium">مبلغ المرتجع (ر.س) *</Label>
                      <Input
                        type="number"
                        value={returnData.returnAmount || ""}
                        onChange={(e) => setReturnData(prev => ({ ...prev, returnAmount: parseFloat(e.target.value) || 0 }))}
                        className="h-14 border-red-200 focus:border-red-400 text-xl font-bold text-center"
                        placeholder="0.00"
                        disabled={isReadOnly}
                        data-testid="input-return-amount"
                      />
                      <p className="text-xs text-red-600">هذا المبلغ سيُخصم من إجمالي المبيعات</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-red-700 font-medium">طريقة الاسترداد *</Label>
                      <Select
                        value={returnData.returnPaymentMethod}
                        onValueChange={(v) => setReturnData(prev => ({ ...prev, returnPaymentMethod: v }))}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="h-12 border-red-200 text-base" data-testid="select-return-method">
                          <SelectValue placeholder="اختر طريقة الاسترداد" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">نقداً</SelectItem>
                          <SelectItem value="mada">مدى</SelectItem>
                          <SelectItem value="visa">فيزا</SelectItem>
                          <SelectItem value="mastercard">ماستركارد</SelectItem>
                          <SelectItem value="amex">أمريكان إكسبريس</SelectItem>
                          <SelectItem value="card_other">بطاقة أخرى</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">طريقة الدفع التي استخدمها العميل في الشراء الأصلي</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-700">رقم فاتورة المرتجع (اختياري)</Label>
                      <Input
                        type="text"
                        value={returnData.returnReference || ""}
                        onChange={(e) => setReturnData(prev => ({ ...prev, returnReference: e.target.value }))}
                        className="h-11"
                        placeholder="مثال: INV-2024-001234"
                        disabled={isReadOnly}
                        data-testid="input-return-reference"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-700">سبب المرتجع (اختياري)</Label>
                      <Input
                        type="text"
                        value={returnData.returnReason || ""}
                        onChange={(e) => setReturnData(prev => ({ ...prev, returnReason: e.target.value }))}
                        className="h-11"
                        placeholder="مثال: المنتج غير مطابق للطلب"
                        disabled={isReadOnly}
                        data-testid="input-return-reason"
                      />
                    </div>
                  </div>
                  
                  {returnData.returnAmount > 0 && (
                    <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
                      <div className="flex items-center gap-2 text-red-700 font-bold text-lg">
                        <AlertCircle className="w-5 h-5" />
                        <span>تأثير المرتجع على اليومية:</span>
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">إجمالي المبيعات الأصلي:</span>
                          <span className="font-medium">{formData.totalSales.toFixed(2)} ر.س</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>المرتجع:</span>
                          <span className="font-medium">-{returnData.returnAmount.toFixed(2)} ر.س</span>
                        </div>
                        <Separator className="bg-red-300" />
                        <div className="flex justify-between text-lg font-bold">
                          <span>صافي المبيعات:</span>
                          <span className="text-red-700">{getNetSales().toFixed(2)} ر.س</span>
                        </div>
                        {returnData.returnPaymentMethod === "cash" && (
                          <p className="text-xs text-red-600 mt-2 bg-red-200 p-2 rounded">
                            ⚠️ سيتم خصم المرتجع من النقد المتوقع في الصندوق
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            <Card className="border-2 border-amber-200">
              <CardHeader className="bg-amber-50">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  تسوية الصندوق النقدي
                </CardTitle>
                <CardDescription>مطابقة الرصيد الفعلي مع المتوقع في الصندوق</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 p-3 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-2">
                    <Label>المبيعات النقدية المتوقعة (ر.س)</Label>
                    <Input 
                      type="number" 
                      value={getExpectedCashInDrawer().toFixed(2)} 
                      readOnly 
                      className="bg-muted text-xl font-bold h-14 text-center" 
                      data-testid="input-expected-cash" 
                    />
                    {returnData.hasReturn && returnData.returnPaymentMethod === "cash" && returnData.returnAmount > 0 ? (
                      <p className="text-xs text-red-600">
                        النقد الأصلي: {formData.cashTotal.toFixed(2)} - المرتجع: {returnData.returnAmount.toFixed(2)} = {getExpectedCashInDrawer().toFixed(2)} ر.س
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">تُحسب تلقائياً من تفصيل المبيعات النقدية</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>الرصيد الفعلي في الصندوق (ر.س) *</Label>
                    <Input
                      type="number"
                      value={formData.actualCashDrawer ?? ""}
                      onChange={(e) => setFormData({ ...formData, actualCashDrawer: parseFloat(e.target.value) || 0 })}
                      className="text-xl font-bold h-14 text-center"
                      placeholder="0.00"
                      disabled={isReadOnly}
                      data-testid="input-actual-cash"
                    />
                    <p className="text-xs text-muted-foreground">أدخل المبلغ الفعلي الموجود في درج الكاشير</p>
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg flex items-center gap-3 ${discrepancyStatus.color}`}>
                  {discrepancyStatus.isShortage ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : calculateDiscrepancy() === 0 ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <AlertCircle className="w-6 h-6" />
                  )}
                  <span className="font-bold text-lg" data-testid="text-discrepancy">{discrepancyStatus.label}</span>
                </div>

                {discrepancyStatus.isShortage && (
                  <Alert variant="destructive" className="border-2">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertTitle className="text-lg font-bold">تنبيه هام: عجز في الصندوق</AlertTitle>
                    <AlertDescription className="text-base mt-2">
                      <p className="font-semibold">
                        هذا العجز بقيمة {Math.abs(calculateDiscrepancy()).toFixed(2)} ر.س سيُسجَّل على أمين الصندوق / الكاشير: <strong>{formData.cashierName || "غير محدد"}</strong>
                      </p>
                      <p className="mt-2 text-sm">
                        يرجى التأكد من صحة المبلغ المُدخل قبل الحفظ. في حالة وجود عجز، سيتم توثيقه وقد يتم خصمه من راتب الموظف وفقاً لسياسة الشركة.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Comprehensive Reconciliation Summary - ملخص التسوية الشاملة */}
            {(() => {
              // Use unified variance summary function
              const varianceSummary = getVarianceSummary();
              const bankSummary = getBankReconciliationSummary();
              const totalTerminal = bankSummary.totalTerminalAmount || 0;
              const actualCash = formData.actualCashDrawer || 0;
              const totalActualCollected = varianceSummary.totalActualCollected;
              const netSalesForRecon = varianceSummary.netSales;
              const appsTotal = varianceSummary.appsTotal;
              const expectedCollected = varianceSummary.expectedCollected;
              const netVariance = varianceSummary.netVariance;
              
              const cashDiscrepancy = varianceSummary.cashDiscrepancy;
              const bankDiscrepancy = varianceSummary.bankDiscrepancy;
              
              // Detect misclassification: cash surplus offsets bank shortage (or vice versa)
              const hasMisclassification = Math.abs(cashDiscrepancy) > 5 && 
                Math.abs(bankDiscrepancy) > 5 && 
                (cashDiscrepancy * bankDiscrepancy) < 0 && // opposite signs
                Math.abs(Math.abs(cashDiscrepancy) - Math.abs(bankDiscrepancy)) < 25;
              
              // Variance classification
              const varianceType = varianceSummary.varianceType;
              const varianceColor = varianceType === 'balanced' ? 'bg-emerald-100 border-emerald-300 text-emerald-800' :
                varianceType === 'warning' ? 'bg-amber-100 border-amber-300 text-amber-800' :
                'bg-red-100 border-red-300 text-red-800';
              
              if (bankSummary.bankPayments.length === 0 && actualCash === 0) return null;
              
              return (
                <Card className="border-2 border-purple-200">
                  <CardHeader className="bg-purple-50">
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      ملخص التسوية الشاملة
                    </CardTitle>
                    <CardDescription>مقارنة المبيعات المسجلة بالمحصل الفعلي (نقد + بنك) - تطبيقات التوصيل آجلة</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {/* Main Calculation */}
                    <div className="space-y-3">
                      {/* Show sales breakdown with apps deduction */}
                      <div className="p-3 bg-gray-50 rounded-lg border space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">إجمالي المبيعات (من التفصيل)</span>
                          <span className="font-medium">{getBreakdownTotal().toFixed(2)} ر.س</span>
                        </div>
                        {returnData.hasReturn && returnData.returnAmount > 0 && (
                          <div className="flex justify-between items-center text-red-600">
                            <span>المرتجع</span>
                            <span className="font-medium">-{returnData.returnAmount.toFixed(2)} ر.س</span>
                          </div>
                        )}
                        {appsTotal > 0 && (
                          <div className="flex justify-between items-center text-purple-600">
                            <span className="flex items-center gap-1">
                              <Truck className="w-3 h-3" />
                              تطبيقات التوصيل (آجل)
                            </span>
                            <span className="font-medium">-{appsTotal.toFixed(2)} ر.س</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="font-medium">المتوقع تحصيله (نقد + بنك)</span>
                          <span className="font-bold text-lg">{expectedCollected.toFixed(2)} ر.س</span>
                        </div>
                      </div>
                      
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-600 mb-2 font-medium">المحصل الفعلي:</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">النقد الفعلي:</span>
                            <span className="font-medium">{actualCash.toFixed(2)} ر.س</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">إيداعات التيرمنال:</span>
                            <span className="font-medium">{totalTerminal.toFixed(2)} ر.س</span>
                          </div>
                        </div>
                        <Separator className="my-2" />
                        <div className="flex justify-between items-center">
                          <span className="font-medium">إجمالي المحصل:</span>
                          <span className="font-bold text-lg text-blue-700">{totalActualCollected.toFixed(2)} ر.س</span>
                        </div>
                      </div>
                      
                      {/* Net Variance */}
                      <div className={`p-4 rounded-lg border-2 ${varianceColor}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-lg">صافي الفرق النهائي:</span>
                          <span className="font-bold text-xl">
                            {netVariance >= 0 ? '+' : ''}{netVariance.toFixed(2)} ر.س
                            {varianceType === 'balanced' && ' ✓'}
                          </span>
                        </div>
                        <p className="text-sm mt-1">
                          {netVariance > 5 ? 'زيادة في المحصل عن المتوقع' : 
                           netVariance < -5 ? 'عجز في المحصل عن المتوقع' : 
                           'الفرق ضمن الحد المقبول (±5 ر.س)'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          (المحصل: {totalActualCollected.toFixed(2)} - المتوقع: {expectedCollected.toFixed(2)})
                        </p>
                      </div>
                      
                      {/* Component Breakdown */}
                      <div className="p-3 bg-gray-50 rounded-lg border">
                        <div className="text-sm text-muted-foreground mb-2">تفصيل الفروقات:</div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className={`p-2 rounded ${cashDiscrepancy > 0.5 ? 'bg-emerald-100' : cashDiscrepancy < -0.5 ? 'bg-red-100' : 'bg-gray-100'}`}>
                            <div className="text-xs text-muted-foreground">فرق الصندوق النقدي:</div>
                            <div className="font-bold">{cashDiscrepancy >= 0 ? '+' : ''}{cashDiscrepancy.toFixed(2)} ر.س</div>
                          </div>
                          <div className={`p-2 rounded ${bankDiscrepancy > 0.5 ? 'bg-emerald-100' : bankDiscrepancy < -0.5 ? 'bg-red-100' : 'bg-gray-100'}`}>
                            <div className="text-xs text-muted-foreground">فرق مطابقة البنك:</div>
                            <div className="font-bold">{bankDiscrepancy >= 0 ? '+' : ''}{bankDiscrepancy.toFixed(2)} ر.س</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Misclassification Alert */}
                      {hasMisclassification && (
                        <Alert className="border-orange-300 bg-orange-50">
                          <AlertCircle className="h-4 w-4 text-orange-600" />
                          <AlertTitle className="text-orange-700">احتمال خطأ تصنيف الدفع</AlertTitle>
                          <AlertDescription className="text-orange-600">
                            {cashDiscrepancy > 0 && bankDiscrepancy < 0 ? (
                              <>
                                زيادة النقد (+{cashDiscrepancy.toFixed(2)} ر.س) تقابل عجز البنك ({bankDiscrepancy.toFixed(2)} ر.س)
                                <br />
                                <strong>السبب المحتمل:</strong> عميل دفع نقداً لكن الكاشير ضغط زر بطاقة بالخطأ
                              </>
                            ) : (
                              <>
                                عجز النقد ({cashDiscrepancy.toFixed(2)} ر.س) يقابل زيادة البنك (+{bankDiscrepancy.toFixed(2)} ر.س)
                                <br />
                                <strong>السبب المحتمل:</strong> عميل دفع ببطاقة لكن الكاشير ضغط زر نقد بالخطأ
                              </>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            <Card>
              <CardHeader>
                <CardTitle>ملاحظات</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="أي ملاحظات إضافية..."
                  rows={3}
                  disabled={isReadOnly}
                  data-testid="input-notes"
                />
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-200">
              <CardHeader className="bg-orange-50">
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  المرفقات والصور
                </CardTitle>
                <CardDescription>التقط صور من تقرير فوديكس وجهاز الشبكة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  data-testid="input-file"
                />
                
                {!isReadOnly && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {ATTACHMENT_TYPES.map((type) => (
                      <Button
                        key={type}
                        variant="outline"
                        className="h-16 sm:h-20 min-h-[64px] flex flex-col items-center justify-center gap-2"
                        onClick={() => handleFileSelect(type)}
                        data-testid={`button-upload-${type}`}
                      >
                        <Camera className="w-6 h-6" />
                        <span className="text-sm">{ATTACHMENT_TYPE_LABELS[type]}</span>
                      </Button>
                    ))}
                  </div>
                )}

                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">المرفقات المحفوظة</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="relative border rounded-lg overflow-hidden group">
                          <img
                            src={attachment.fileData}
                            alt={attachment.fileName}
                            className="w-full h-32 object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2">
                            {ATTACHMENT_TYPE_LABELS[attachment.attachmentType as AttachmentType]}
                          </div>
                          {!isReadOnly && (
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 left-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                              data-testid={`button-delete-attachment-${attachment.id}`}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pendingAttachments.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">مرفقات في انتظار الحفظ</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {pendingAttachments.map((attachment, index) => (
                        <div key={index} className="relative border rounded-lg overflow-hidden group border-dashed border-2 border-orange-300">
                          <img
                            src={attachment.fileData}
                            alt={attachment.fileName}
                            className="w-full h-32 object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-orange-500/80 text-white text-xs p-2">
                            {ATTACHMENT_TYPE_LABELS[attachment.attachmentType]}
                          </div>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 left-2 h-6 w-6"
                            onClick={() => removePendingAttachment(index)}
                            data-testid={`button-remove-pending-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">سيتم رفع هذه المرفقات بعد حفظ اليومية</p>
                  </div>
                )}

                {attachments.length === 0 && pendingAttachments.length === 0 && (
                  <div className="text-center text-muted-foreground py-4">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد مرفقات</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className={!hasSignature && !isEdit ? "border-red-300 bg-red-50/50" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  التوقيع الإلكتروني
                  {!hasSignature && !isEdit && (
                    <span className="text-xs font-normal text-red-600 bg-red-100 px-2 py-1 rounded">مطلوب</span>
                  )}
                  {hasSignature && (
                    <span className="text-xs font-normal text-green-600 bg-green-100 px-2 py-1 rounded">تم التوقيع ✓</span>
                  )}
                </CardTitle>
                <CardDescription>وقّع لتأكيد صحة البيانات</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasSignature && !isEdit && (
                  <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>يجب التوقيع الإلكتروني قبل حفظ اليومية</span>
                  </div>
                )}
                <div className={`border-2 rounded-lg overflow-hidden ${!hasSignature && !isEdit ? "border-red-300" : "border-amber-400"}`}>
                  <canvas
                    ref={signatureCanvasRef}
                    width={280}
                    height={150}
                    className="w-full cursor-crosshair bg-white touch-none"
                    style={{ touchAction: 'none' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    onTouchCancel={stopDrawing}
                    data-testid="canvas-signature"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">يدعم اللمس على الأجهزة اللوحية</p>
                <Button variant="outline" size="lg" onClick={clearSignature} className="w-full h-12" data-testid="button-clear-signature">
                  مسح التوقيع
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle>ملخص اليومية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">إجمالي المبيعات</span>
                  <span className="font-bold text-lg">{getBreakdownTotal().toFixed(2)} ر.س</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">عدد الفواتير</span>
                  <span className="font-medium">{formData.transactionCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">متوسط الفاتورة</span>
                  <span className="font-medium">{averageTicket.toFixed(2)} ر.س</span>
                </div>
                <Separator />
                
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground">تصنيف المبيعات</div>
                  <div className={`flex justify-between text-sm p-2 rounded ${PAYMENT_CATEGORIES.cash.color}`}>
                    <span className="flex items-center gap-1">
                      <Wallet className="w-3 h-3" />
                      نقدي
                    </span>
                    <span className="font-medium">{getCategoryTotals().cash.toFixed(2)} ر.س</span>
                  </div>
                  <div className={`flex justify-between text-sm p-2 rounded ${PAYMENT_CATEGORIES.cards.color}`}>
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      بطاقات وشبكة
                    </span>
                    <span className="font-medium">{getCategoryTotals().cards.toFixed(2)} ر.س</span>
                  </div>
                  {getCardBreakdowns().length > 0 && (
                    <div className="pr-4 space-y-1">
                      {getCardBreakdowns().map((b, i) => {
                        const method = PAYMENT_METHODS.find((m) => m.value === b.paymentMethod);
                        return (
                          <div key={i} className="flex justify-between text-xs text-blue-600">
                            <span>• {method?.label}</span>
                            <span>{b.amount.toFixed(2)} ر.س</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className={`flex justify-between text-sm p-2 rounded ${PAYMENT_CATEGORIES.apps.color}`}>
                    <span className="flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      تطبيقات التوصيل (آجل)
                    </span>
                    <span className="font-medium">{getCategoryTotals().apps.toFixed(2)} ر.س</span>
                  </div>
                  {getAppBreakdowns().length > 0 && (
                    <div className="pr-4 space-y-1">
                      {getAppBreakdowns().map((b, i) => {
                        const method = PAYMENT_METHODS.find((m) => m.value === b.paymentMethod);
                        return (
                          <div key={i} className="flex justify-between text-xs text-purple-600">
                            <span>• {method?.label}</span>
                            <span>{b.amount.toFixed(2)} ر.س</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Returns Summary */}
                {returnData.hasReturn && returnData.returnAmount > 0 && (
                  <>
                    <Separator />
                    <div className="text-xs font-semibold text-red-600">المرتجع</div>
                    <div className="p-2 bg-red-50 rounded border border-red-200">
                      <div className="flex justify-between text-sm text-red-700">
                        <span className="flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          مبلغ المرتجع
                        </span>
                        <span className="font-bold">-{returnData.returnAmount.toFixed(2)} ر.س</span>
                      </div>
                      <div className="flex justify-between text-xs text-red-600 mt-1">
                        <span>طريقة الاسترداد:</span>
                        <span>{PAYMENT_METHODS.find(m => m.value === returnData.returnPaymentMethod)?.label || returnData.returnPaymentMethod}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-red-200">
                        <span>صافي المبيعات:</span>
                        <span>{getNetSales().toFixed(2)} ر.س</span>
                      </div>
                    </div>
                  </>
                )}
                
                {/* Comprehensive Variance Summary - صافي الفرق النهائي */}
                {(() => {
                  const vs = getVarianceSummary();
                  const netVarColor = vs.varianceType === 'balanced' ? 'text-green-600 bg-green-50 border-green-200' : 
                    vs.varianceType === 'warning' ? 'text-amber-600 bg-amber-50 border-amber-200' : 
                    'text-red-600 bg-red-50 border-red-200';
                  
                  return (
                    <>
                      <Separator />
                      <div className="text-xs font-semibold text-purple-700">صافي الفرق النهائي</div>
                      <div className={`p-3 rounded-lg border-2 ${netVarColor}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">الفارق الإجمالي:</span>
                          <span className="font-bold text-lg">
                            {vs.netVariance >= 0 ? '+' : ''}{vs.netVariance.toFixed(2)} ر.س
                          </span>
                        </div>
                        <div className="text-xs mt-1 opacity-80">
                          (المحصل: {vs.totalActualCollected.toFixed(2)} - المبيعات: {vs.netSales.toFixed(2)})
                        </div>
                      </div>
                      
                      {/* Component breakdown - sub-discrepancies */}
                      {(Math.abs(vs.cashDiscrepancy) > 0.01 || Math.abs(vs.bankDiscrepancy) > 0.01) && (
                        <div className="space-y-2 p-2 bg-gray-50 rounded border text-xs">
                          <div className="text-muted-foreground font-medium">تفصيل الفروقات:</div>
                          <div className="flex justify-between">
                            <span>فرق الصندوق النقدي:</span>
                            <span className={vs.cashDiscrepancy > 0 ? 'text-amber-600' : vs.cashDiscrepancy < 0 ? 'text-red-600' : 'text-green-600'}>
                              {vs.cashDiscrepancy >= 0 ? '+' : ''}{vs.cashDiscrepancy.toFixed(2)} ر.س
                            </span>
                          </div>
                          {vs.hasBankPayments && (
                            <div className="flex justify-between">
                              <span>فرق مطابقة البنك:</span>
                              <span className={vs.bankDiscrepancy > 0 ? 'text-amber-600' : vs.bankDiscrepancy < 0 ? 'text-red-600' : 'text-green-600'}>
                                {vs.bankDiscrepancy >= 0 ? '+' : ''}{vs.bankDiscrepancy.toFixed(2)} ر.س
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {discrepancyStatus.isShortage && (
                        <div className="mt-2 p-2 bg-red-100 rounded text-red-700 text-xs text-center">
                          عجز مُسجَّل على الكاشير ({vs.cashDiscrepancy.toFixed(2)} ر.س)
                        </div>
                      )}
                      {getDiscrepancyAnalysis().type === "possible_misclass" && (
                        <div className="mt-2 p-2 bg-amber-100 rounded text-amber-700 text-xs">
                          <AlertCircle className="w-3 h-3 inline ml-1" />
                          {getDiscrepancyAnalysis().message}
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>

            {isReadOnly && (
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-700">للقراءة فقط</AlertTitle>
                <AlertDescription className="text-amber-600">
                  تم ترحيل هذه اليومية ولا يمكن تعديلها
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              {!isReadOnly && (
                <>
                  <Button
                    className="w-full gap-2 h-12"
                    onClick={handleSave}
                    disabled={createMutation.isPending || updateMutation.isPending || !canSave}
                    data-testid="button-save"
                  >
                    <Save className="w-4 h-4" />
                    {isEdit ? "حفظ التغييرات" : "حفظ كمسودة"}
                  </Button>
                  {isEdit && existingJournal?.status === "draft" && (
                    <Button
                      variant="default"
                      className="w-full gap-2 bg-green-600 hover:bg-green-700 h-12"
                      onClick={handleSaveAndPost}
                      disabled={postMutation.isPending || updateMutation.isPending || !canPost}
                      data-testid="button-save-post"
                    >
                      <Send className="w-4 h-4" />
                      حفظ وترحيل
                    </Button>
                  )}
                  {getTotalsMismatch() && (
                    <p className="text-xs text-amber-600 text-center">
                      تنبيه: يوجد فرق في الأرقام. سيُطلب تأكيد قبل الترحيل.
                    </p>
                  )}
                </>
              )}
              {isReadOnly && (
                <Button
                  variant="outline"
                  className="w-full gap-2 h-12"
                  onClick={() => setLocation("/cashier-journals")}
                  data-testid="button-back-list"
                >
                  <ArrowRight className="w-4 h-4" />
                  العودة للقائمة
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar - iPad Optimized */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-amber-200 shadow-lg z-50 p-2 md:p-3">
          <div className="max-w-7xl mx-auto flex flex-col gap-2">
            {/* Quick Add Payment Buttons - Always visible */}
            {!isReadOnly && (
              <div className="flex flex-col gap-1">
                {/* Bank Cards Row */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs text-blue-600 font-medium ml-1">💳 بطاقات:</span>
                  {[
                    { value: "mada", label: "مدى", color: "bg-blue-600 hover:bg-blue-700" },
                    { value: "visa", label: "فيزا", color: "bg-indigo-600 hover:bg-indigo-700" },
                    { value: "mastercard", label: "ماستركارد", color: "bg-orange-600 hover:bg-orange-700" },
                  ].filter(m => !paymentBreakdowns.some(p => p.paymentMethod === m.value)).map(method => (
                    <Button
                      key={method.value}
                      type="button"
                      size="sm"
                      className={`h-8 px-2 text-white text-xs ${method.color}`}
                      onClick={() => {
                        setPaymentBreakdowns([...paymentBreakdowns, { 
                          paymentMethod: method.value, 
                          amount: 0, 
                          transactionCount: 0,
                          posAmount: 0,
                          terminalAmount: 0,
                          terminalTransactionCount: 0
                        }]);
                      }}
                      data-testid={`quick-add-sticky-${method.value}`}
                    >
                      <CreditCard className="w-3 h-3 ml-1" />
                      {method.label}
                    </Button>
                  ))}
                </div>
                
                {/* Delivery Apps Row */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-xs text-purple-600 font-medium ml-1">🚚 توصيل:</span>
                  {[
                    { value: "hunger_station", label: "هنجرستيشن", color: "bg-orange-500 hover:bg-orange-600" },
                    { value: "keeta", label: "كيتا", color: "bg-green-500 hover:bg-green-600" },
                    { value: "jahez", label: "جاهز", color: "bg-blue-500 hover:bg-blue-600" },
                    { value: "marsool", label: "مرسول", color: "bg-purple-500 hover:bg-purple-600" },
                    { value: "toyou", label: "ToYou", color: "bg-pink-500 hover:bg-pink-600" },
                    { value: "the_chefs", label: "ذا شيفز", color: "bg-amber-600 hover:bg-amber-700" },
                  ].filter(m => !paymentBreakdowns.some(p => p.paymentMethod === m.value)).map(method => (
                    <Button
                      key={method.value}
                      type="button"
                      size="sm"
                      className={`h-8 px-2 text-white text-xs ${method.color}`}
                      onClick={() => {
                        setPaymentBreakdowns([...paymentBreakdowns, { 
                          paymentMethod: method.value, 
                          amount: 0, 
                          transactionCount: 0 
                        }]);
                      }}
                      data-testid={`quick-add-sticky-${method.value}`}
                    >
                      <Truck className="w-3 h-3 ml-1" />
                      {method.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs border-dashed"
                    onClick={addPaymentBreakdown}
                    data-testid="quick-add-sticky-other"
                  >
                    <Plus className="w-3 h-3 ml-1" />
                    أخرى
                  </Button>
                </div>
              </div>
            )}
            
            {/* Summary Stats and Action Buttons Row */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            {/* Summary Stats */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 text-sm">
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                <Receipt className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600">المبيعات:</span>
                <span className="font-bold text-lg">{formData.totalSales.toLocaleString('en')} ر.س</span>
              </div>
              {returnData.hasReturn && returnData.returnAmount > 0 && (
                <div className="flex items-center gap-2 bg-red-100 px-3 py-2 rounded-lg">
                  <RotateCcw className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">مرتجع:</span>
                  <span className="font-bold text-red-700">-{returnData.returnAmount.toLocaleString('en')}</span>
                </div>
              )}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                (() => {
                  const variance = getVarianceSummary();
                  if (variance.varianceType === 'balanced') return 'bg-green-100';
                  if (variance.varianceType === 'warning') return 'bg-amber-100';
                  return 'bg-red-100';
                })()
              }`}>
                <Calculator className="w-4 h-4" />
                <span>الفارق:</span>
                <span className={`font-bold text-lg ${
                  (() => {
                    const variance = getVarianceSummary();
                    if (variance.varianceType === 'balanced') return 'text-green-700';
                    if (variance.varianceType === 'warning') return 'text-amber-700';
                    return 'text-red-700';
                  })()
                }`}>
                  {getVarianceSummary().netVariance >= 0 ? '+' : ''}{getVarianceSummary().netVariance.toLocaleString('en', {minimumFractionDigits: 2})}
                </span>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {!isReadOnly && (
                <>
                  <Button
                    size="lg"
                    className="gap-2 h-12 px-6 text-base min-w-[140px]"
                    onClick={handleSave}
                    disabled={createMutation.isPending || updateMutation.isPending || !canSave}
                    data-testid="button-save-sticky"
                  >
                    <Save className="w-5 h-5" />
                    {isEdit ? "حفظ" : "حفظ مسودة"}
                  </Button>
                  {isEdit && existingJournal?.status === "draft" && (
                    <Button
                      size="lg"
                      className="gap-2 bg-green-600 hover:bg-green-700 h-12 px-6 text-base min-w-[140px]"
                      onClick={handleSaveAndPost}
                      disabled={postMutation.isPending || updateMutation.isPending || !canPost}
                      data-testid="button-post-sticky"
                    >
                      <Send className="w-5 h-5" />
                      ترحيل
                    </Button>
                  )}
                </>
              )}
              {isReadOnly && (
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 h-12 px-6"
                  onClick={() => setLocation("/cashier-journals")}
                >
                  <ArrowRight className="w-5 h-5" />
                  العودة للقائمة
                </Button>
              )}
            </div>
            </div>
          </div>
        </div>
        
        {/* Spacer for sticky bar */}
        <div className="h-44 md:h-36" />
      </div>

      {/* Variance Confirmation Dialog - for posting with mismatch */}
      <AlertDialog open={showVarianceConfirm} onOpenChange={setShowVarianceConfirm}>
        <AlertDialogContent className="max-w-md" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              تأكيد الترحيل مع وجود فرق
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-2">
              <p>
                يوجد فرق بين مجموع التفصيل وإجمالي المبيعات بقيمة{" "}
                <span className="font-bold text-amber-600">
                  {Math.abs(formData.totalSales - getBreakdownTotal()).toFixed(2)} ر.س
                </span>
              </p>
              <div className="bg-gray-50 p-3 rounded-md space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>إجمالي المبيعات:</span>
                  <span className="font-medium">{formData.totalSales.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between">
                  <span>مجموع التفصيل:</span>
                  <span className="font-medium">{getBreakdownTotal().toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span>الفرق:</span>
                  <span className={`font-bold ${formData.totalSales > getBreakdownTotal() ? "text-red-600" : "text-green-600"}`}>
                    {formData.totalSales > getBreakdownTotal() ? "-" : "+"}{Math.abs(formData.totalSales - getBreakdownTotal()).toFixed(2)} ر.س
                  </span>
                </div>
              </div>
              <p className="text-muted-foreground text-sm">
                هل أنت متأكد من ترحيل اليومية بهذا الفرق؟
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel className="flex-1">
              مراجعة البيانات
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => {
                setVarianceConfirmed(true);
                setShowVarianceConfirm(false);
                // Re-call handleSaveAndPost - the confirmed flag will allow it to proceed
                setTimeout(() => {
                  handleSaveAndPost();
                }, 100);
              }}
            >
              تأكيد الترحيل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shortage Confirmation Dialog */}
      <AlertDialog open={showShortageConfirm} onOpenChange={setShowShortageConfirm}>
        <AlertDialogContent className="max-w-md" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              تأكيد حفظ اليومية مع عجز كبير
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-2">
              <p>
                تم اكتشاف عجز بقيمة <span className="font-bold text-red-600">{Math.abs(calculateDiscrepancy()).toFixed(2)} ر.س</span> في الصندوق.
              </p>
              <p className="text-amber-600">
                سيُسجَّل هذا العجز على الكاشير. هل أنت متأكد من صحة البيانات؟
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel className="flex-1">
              مراجعة البيانات
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (pendingSaveAction) {
                  pendingSaveAction();
                  setPendingSaveAction(null);
                }
              }}
            >
              تأكيد الحفظ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
