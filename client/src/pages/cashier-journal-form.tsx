import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useParams, Link } from "wouter";
import { ArrowRight, Save, Send, Plus, Trash2, Wallet, CreditCard, Smartphone, Truck, AlertCircle, AlertTriangle, CheckCircle, Calculator, Users, Receipt, Camera, ImageIcon, X, Upload, FileDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Branch, CashierSalesJournal, CashierPaymentBreakdown, JournalAttachment } from "@shared/schema";
import { ATTACHMENT_TYPE_LABELS, ATTACHMENT_TYPES, type AttachmentType } from "@shared/schema";

const PAYMENT_CATEGORIES = {
  cash: { label: "نقدي", color: "bg-green-100 text-green-700" },
  cards: { label: "بطاقات وشبكة", color: "bg-blue-100 text-blue-700" },
  apps: { label: "تطبيقات التوصيل (آجل)", color: "bg-purple-100 text-purple-700" },
};

const PAYMENT_METHODS = [
  { value: "cash", label: "نقداً", icon: Wallet, category: "cash" },
  { value: "card", label: "بطاقة ائتمان", icon: CreditCard, category: "cards" },
  { value: "mada", label: "مدى", icon: CreditCard, category: "cards" },
  { value: "apple_pay", label: "Apple Pay", icon: Smartphone, category: "cards" },
  { value: "stc_pay", label: "STC Pay", icon: Smartphone, category: "cards" },
  { value: "hunger_station", label: "هنقرستيشن", icon: Truck, category: "apps" },
  { value: "toyou", label: "ToYou", icon: Truck, category: "apps" },
  { value: "jahez", label: "جاهز", icon: Truck, category: "apps" },
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
}

export default function CashierJournalFormPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

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

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: existingJournal, isLoading: loadingJournal } = useQuery<CashierSalesJournal & { paymentBreakdowns: CashierPaymentBreakdown[] }>({
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
          existingJournal.paymentBreakdowns.map((b) => ({
            paymentMethod: b.paymentMethod,
            amount: b.amount,
            transactionCount: b.transactionCount || 0,
            notes: b.notes || "",
          }))
        );
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

  const handleSave = () => {
    if (getTotalsMismatch()) {
      toast({ 
        title: "لا يمكن الحفظ", 
        description: "مجموع التفصيل لا يطابق إجمالي المبيعات", 
        variant: "destructive" 
      });
      return;
    }

    const data = {
      ...formData,
      paymentBreakdowns: paymentBreakdowns.filter((b) => b.amount > 0),
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSaveAndPost = async () => {
    if (getTotalsMismatch()) {
      toast({ 
        title: "لا يمكن الترحيل", 
        description: "مجموع التفصيل لا يطابق إجمالي المبيعات", 
        variant: "destructive" 
      });
      return;
    }

    const canvas = signatureCanvasRef.current;
    const signatureData = canvas ? canvas.toDataURL("image/png") : undefined;

    if (isEdit) {
      const data = {
        ...formData,
        paymentBreakdowns: paymentBreakdowns.filter((b) => b.amount > 0),
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

  const updatePaymentBreakdown = (index: number, field: string, value: any) => {
    const updated = [...paymentBreakdowns];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentBreakdowns(updated);

    if (field === "amount") {
      const cashBreakdown = updated.find((b) => b.paymentMethod === "cash");
      if (cashBreakdown) {
        setFormData((prev) => ({ ...prev, cashTotal: cashBreakdown.amount }));
      }
    }
  };

  const getBreakdownTotal = () => {
    return paymentBreakdowns.reduce((sum, b) => sum + (b.amount || 0), 0);
  };

  const getTotalsMismatch = () => {
    const breakdownTotal = getBreakdownTotal();
    const diff = Math.abs(formData.totalSales - breakdownTotal);
    return diff > 0.01;
  };

  const calculateDiscrepancy = () => {
    return formData.actualCashDrawer - formData.cashTotal;
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

  const canSave = !getTotalsMismatch() && formData.totalSales > 0 && formData.branchId && formData.cashierName;

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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        setIsDrawing(true);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      const rect = canvas.getBoundingClientRect();
      if (ctx) {
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
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
  };

  const discrepancyStatus = getDiscrepancyStatus();
  const averageTicket = calculateAverageTicket();

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: "يرجى السماح بفتح النوافذ المنبثقة لتحميل التقرير", variant: "destructive" });
      return;
    }

    const branchName = branches?.find(b => b.id === formData.branchId)?.name || formData.branchId;
    const logoUrl = '/attached_assets/logo_-5_1765206843638.png';
    
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    const categoryTotals = getCategoryTotals();
    const expectedCash = formData.openingBalance + categoryTotals.cash;
    const discrepancy = formData.actualCashDrawer - categoryTotals.cash;
    const discrepancyStatusText = discrepancy === 0 ? 'متوازن' : discrepancy < 0 ? 'عجز' : 'فائض';

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
      card: "بطاقة ائتمان",
      mada: "مدى",
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

    const htmlContent = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير يومية الكاشير - ${formData.journalDate}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 30px; background: white; color: #333; font-size: 13px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #d4a853; padding-bottom: 20px; }
    .header .logo { max-height: 70px; margin-bottom: 10px; }
    .header h1 { font-size: 22px; color: #333; margin-bottom: 5px; }
    .header .subtitle { color: #666; font-size: 14px; }
    .header .journal-date { background: linear-gradient(135deg, #d4a853 0%, #c49843 100%); color: white; padding: 8px 20px; border-radius: 20px; display: inline-block; margin-top: 10px; font-weight: bold; }
    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; }
    .info-box { background: #f8f9fa; padding: 15px; border-radius: 10px; text-align: center; border: 1px solid #e9ecef; }
    .info-box .label { color: #666; font-size: 11px; margin-bottom: 5px; }
    .info-box .value { font-size: 16px; font-weight: bold; color: #333; }
    .section { margin-bottom: 25px; page-break-inside: avoid; }
    .section-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 15px; padding: 10px 15px; background: linear-gradient(135deg, #d4a853 0%, #c49843 100%); color: white; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    th, td { border: 1px solid #ddd; padding: 12px 10px; text-align: right; }
    th { background: #f5f5f5; font-weight: 600; color: #333; }
    tr:nth-child(even) { background: #fafafa; }
    .amount { font-weight: bold; }
    .amount.positive { color: #28a745; }
    .amount.negative { color: #dc3545; }
    .status-badge { padding: 4px 12px; border-radius: 15px; font-size: 11px; font-weight: 600; display: inline-block; }
    .status-approved { background: #d4edda; color: #155724; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-rejected { background: #f8d7da; color: #721c24; }
    .status-balanced { background: #d4edda; color: #155724; }
    .status-shortage { background: #f8d7da; color: #721c24; }
    .status-surplus { background: #cce5ff; color: #004085; }
    .summary-row { background: #f8f9fa !important; font-weight: bold; }
    .reconciliation-box { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 20px; border-radius: 10px; margin-top: 15px; }
    .reconciliation-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .reconciliation-item { display: flex; justify-content: space-between; padding: 10px; background: white; border-radius: 8px; border: 1px solid #dee2e6; }
    .reconciliation-item .label { color: #666; }
    .reconciliation-item .value { font-weight: bold; }
    .discrepancy-result { text-align: center; padding: 20px; background: white; border-radius: 10px; margin-top: 15px; border: 2px solid #d4a853; }
    .discrepancy-result .amount { font-size: 24px; }
    .notes-box { background: #fffbeb; padding: 15px; border-radius: 10px; border: 1px solid #fbbf24; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #d4a853; display: flex; justify-content: space-between; align-items: center; }
    .footer .company { font-weight: bold; color: #d4a853; }
    .footer .timestamp { color: #666; font-size: 11px; }
    .signature-area { margin-top: 30px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; }
    .signature-box { border-top: 2px solid #333; padding-top: 10px; text-align: center; }
    .signature-box .title { font-weight: bold; margin-bottom: 40px; }
    .print-btn { position: fixed; top: 20px; left: 20px; background: #d4a853; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 14px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    .print-btn:hover { background: #c49843; }
    @media print { .print-btn { display: none; } .signature-area { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">طباعة / حفظ PDF</button>
  
  <div class="header">
    <img src="${logoUrl}" alt="Butter Bakery" class="logo" onerror="this.style.display='none'">
    <h1>تقرير يومية الكاشير</h1>
    <p class="subtitle">بتر بيكري - Butter Bakery</p>
    <div class="journal-date">${formatDate(formData.journalDate)}</div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="label">الفرع</div>
      <div class="value">${branchName}</div>
    </div>
    <div class="info-box">
      <div class="label">اسم الكاشير</div>
      <div class="value">${formData.cashierName}</div>
    </div>
    <div class="info-box">
      <div class="label">الوردية</div>
      <div class="value">${SHIFT_LABELS[formData.shiftType] || formData.shiftType}</div>
    </div>
    <div class="info-box">
      <div class="label">الحالة</div>
      <div class="value">
        <span class="status-badge status-${existingJournal?.status === 'approved' ? 'approved' : existingJournal?.status === 'rejected' ? 'rejected' : 'pending'}">
          ${STATUS_LABELS[existingJournal?.status || 'draft'] || 'مسودة'}
        </span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">ملخص المبيعات</div>
    <table>
      <tr>
        <th>البند</th>
        <th>المبلغ (ر.س)</th>
      </tr>
      <tr>
        <td>إجمالي المبيعات</td>
        <td class="amount positive">${formData.totalSales.toLocaleString('ar-SA')}</td>
      </tr>
      <tr>
        <td>المبيعات النقدية</td>
        <td class="amount">${categoryTotals.cash.toLocaleString('ar-SA')}</td>
      </tr>
      <tr>
        <td>مبيعات الشبكة (بطاقات)</td>
        <td class="amount">${categoryTotals.cards.toLocaleString('ar-SA')}</td>
      </tr>
      <tr>
        <td>مبيعات التوصيل</td>
        <td class="amount">${categoryTotals.apps.toLocaleString('ar-SA')}</td>
      </tr>
      <tr class="summary-row">
        <td>عدد العمليات</td>
        <td>${formData.transactionCount}</td>
      </tr>
      <tr class="summary-row">
        <td>عدد العملاء</td>
        <td>${formData.customerCount}</td>
      </tr>
      <tr class="summary-row">
        <td>متوسط قيمة الفاتورة</td>
        <td>${averageTicket.toFixed(2)} ر.س</td>
      </tr>
    </table>
  </div>

  ${paymentBreakdowns.length > 0 ? `
  <div class="section">
    <div class="section-title">تفصيل طرق الدفع</div>
    <table>
      <tr>
        <th>طريقة الدفع</th>
        <th>المبلغ (ر.س)</th>
        <th>عدد العمليات</th>
      </tr>
      ${paymentBreakdowns.filter(p => p.amount > 0).map(p => `
        <tr>
          <td>${PAYMENT_METHOD_LABELS[p.paymentMethod] || p.paymentMethod}</td>
          <td class="amount">${p.amount.toLocaleString('ar-SA')}</td>
          <td>${p.transactionCount}</td>
        </tr>
      `).join('')}
    </table>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">مطابقة الصندوق</div>
    <div class="reconciliation-box">
      <div class="reconciliation-grid">
        <div class="reconciliation-item">
          <span class="label">رصيد الافتتاح</span>
          <span class="value">${formData.openingBalance.toLocaleString('ar-SA')} ر.س</span>
        </div>
        <div class="reconciliation-item">
          <span class="label">المبيعات النقدية</span>
          <span class="value">${categoryTotals.cash.toLocaleString('ar-SA')} ر.س</span>
        </div>
        <div class="reconciliation-item">
          <span class="label">المتوقع في الصندوق</span>
          <span class="value">${expectedCash.toLocaleString('ar-SA')} ر.س</span>
        </div>
        <div class="reconciliation-item">
          <span class="label">الفعلي في الصندوق</span>
          <span class="value">${formData.actualCashDrawer.toLocaleString('ar-SA')} ر.س</span>
        </div>
      </div>
      <div class="discrepancy-result">
        <p style="margin-bottom: 10px;">الفرق (العجز/الفائض)</p>
        <span class="amount ${discrepancy < 0 ? 'negative' : discrepancy > 0 ? 'positive' : ''}">
          ${discrepancy.toLocaleString('ar-SA')} ر.س
        </span>
        <span class="status-badge status-${discrepancy === 0 ? 'balanced' : discrepancy < 0 ? 'shortage' : 'surplus'}" style="margin-right: 10px;">
          ${discrepancyStatusText}
        </span>
      </div>
    </div>
  </div>

  ${formData.notes ? `
  <div class="section">
    <div class="section-title">ملاحظات</div>
    <div class="notes-box">
      <p>${formData.notes}</p>
    </div>
  </div>
  ` : ''}

  <div class="signature-area">
    <div class="signature-box">
      <div class="title">توقيع الكاشير</div>
      <p>${formData.cashierName}</p>
    </div>
    <div class="signature-box">
      <div class="title">توقيع المدير</div>
      <p>________________</p>
    </div>
  </div>

  <div class="footer">
    <div class="company">بتر بيكري - Butter Bakery</div>
    <div class="timestamp">تم إنشاء هذا التقرير بتاريخ: ${new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
  </div>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
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
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/cashier-journals">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-primary" data-testid="page-title">
                {isEdit ? "تعديل يومية المبيعات" : "يومية مبيعات جديدة"}
              </h1>
            </div>
          </div>
          {isEdit && (
            <Button onClick={handleExportPDF} className="gap-2 bg-amber-600 hover:bg-amber-700" data-testid="button-export-pdf">
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
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الفرع *</Label>
                    <Select value={formData.branchId} onValueChange={(v) => setFormData({ ...formData, branchId: v })} disabled={isReadOnly}>
                      <SelectTrigger data-testid="select-branch">
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches?.map((branch) => (
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
                      data-testid="input-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الوردية *</Label>
                    <Select value={formData.shiftType} onValueChange={(v) => setFormData({ ...formData, shiftType: v })} disabled={isReadOnly}>
                      <SelectTrigger data-testid="select-shift">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                      className="bg-muted cursor-not-allowed"
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
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-lg font-semibold">إجمالي المبيعات (ر.س) *</Label>
                    <Input
                      type="number"
                      value={formData.totalSales || ""}
                      onChange={(e) => setFormData({ ...formData, totalSales: parseFloat(e.target.value) || 0 })}
                      className="text-xl font-bold h-14"
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
                      value={formData.transactionCount || ""}
                      onChange={(e) => setFormData({ ...formData, transactionCount: parseInt(e.target.value) || 0 })}
                      className="h-14"
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
                    value={formData.openingBalance || ""}
                    onChange={(e) => setFormData({ ...formData, openingBalance: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    disabled={isReadOnly}
                    data-testid="input-opening-balance"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row justify-between items-center">
                <div>
                  <CardTitle>تفصيل المبيعات حسب طريقة الدفع</CardTitle>
                  <CardDescription>أدخل المبيعات لكل طريقة دفع</CardDescription>
                </div>
                {!isReadOnly && (
                  <Button variant="outline" size="sm" onClick={addPaymentBreakdown} data-testid="button-add-payment">
                    <Plus className="w-4 h-4 mr-1" />
                    إضافة
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentBreakdowns.map((breakdown, index) => {
                  const method = PAYMENT_METHODS.find((m) => m.value === breakdown.paymentMethod);
                  const Icon = method?.icon || Wallet;

                  return (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg" data-testid={`payment-row-${index}`}>
                      <Icon className="w-5 h-5 text-muted-foreground" />
                      <Select
                        value={breakdown.paymentMethod}
                        onValueChange={(v) => updatePaymentBreakdown(index, "paymentMethod", v)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="المبلغ"
                          value={breakdown.amount || ""}
                          onChange={(e) => updatePaymentBreakdown(index, "amount", parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly}
                          data-testid={`input-payment-amount-${index}`}
                        />
                      </div>
                      <div className="w-24">
                        <Input
                          type="number"
                          placeholder="عدد"
                          value={breakdown.transactionCount || ""}
                          onChange={(e) => updatePaymentBreakdown(index, "transactionCount", parseInt(e.target.value) || 0)}
                          disabled={isReadOnly}
                          data-testid={`input-payment-count-${index}`}
                        />
                      </div>
                      {paymentBreakdowns.length > 1 && !isReadOnly && (
                        <Button variant="ghost" size="sm" onClick={() => removePaymentBreakdown(index)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
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
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200">
              <CardHeader className="bg-amber-50">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  تسوية الصندوق النقدي
                </CardTitle>
                <CardDescription>مطابقة الرصيد الفعلي مع المتوقع في الصندوق</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>المبيعات النقدية المتوقعة (ر.س)</Label>
                    <Input type="number" value={formData.cashTotal.toFixed(2)} readOnly className="bg-muted text-lg font-bold" data-testid="input-expected-cash" />
                    <p className="text-xs text-muted-foreground">تُحسب تلقائياً من تفصيل المبيعات النقدية</p>
                  </div>
                  <div className="space-y-2">
                    <Label>الرصيد الفعلي في الصندوق (ر.س) *</Label>
                    <Input
                      type="number"
                      value={formData.actualCashDrawer || ""}
                      onChange={(e) => setFormData({ ...formData, actualCashDrawer: parseFloat(e.target.value) || 0 })}
                      className="text-lg font-bold"
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {ATTACHMENT_TYPES.map((type) => (
                      <Button
                        key={type}
                        variant="outline"
                        className="h-20 flex flex-col items-center justify-center gap-2"
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
            <Card>
              <CardHeader>
                <CardTitle>التوقيع الإلكتروني</CardTitle>
                <CardDescription>وقّع لتأكيد صحة البيانات</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <canvas
                    ref={signatureCanvasRef}
                    width={280}
                    height={150}
                    className="w-full cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    data-testid="canvas-signature"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={clearSignature} className="w-full" data-testid="button-clear-signature">
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
                  <span className="font-bold text-lg">{formData.totalSales.toFixed(2)} ر.س</span>
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
                
                <Separator />
                <div className="text-xs font-semibold text-muted-foreground">تسوية النقدي</div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المبيعات النقدية</span>
                  <span className="font-medium">{formData.cashTotal.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الرصيد الفعلي</span>
                  <span className="font-medium">{formData.actualCashDrawer.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">الفارق</span>
                  <span className={`font-bold text-lg ${calculateDiscrepancy() === 0 ? "text-green-600" : calculateDiscrepancy() < 0 ? "text-red-600" : "text-amber-600"}`}>
                    {calculateDiscrepancy().toFixed(2)} ر.س
                  </span>
                </div>
                {discrepancyStatus.isShortage && (
                  <div className="mt-2 p-2 bg-red-100 rounded text-red-700 text-xs text-center">
                    عجز مُسجَّل على الكاشير
                  </div>
                )}
                {getDiscrepancyAnalysis().type === "possible_misclass" && (
                  <div className="mt-2 p-2 bg-amber-100 rounded text-amber-700 text-xs">
                    <AlertCircle className="w-3 h-3 inline ml-1" />
                    {getDiscrepancyAnalysis().message}
                  </div>
                )}
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
                    className="w-full gap-2"
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
                      className="w-full gap-2 bg-green-600 hover:bg-green-700"
                      onClick={handleSaveAndPost}
                      disabled={postMutation.isPending || updateMutation.isPending || !canSave}
                      data-testid="button-save-post"
                    >
                      <Send className="w-4 h-4" />
                      حفظ وترحيل
                    </Button>
                  )}
                  {getTotalsMismatch() && (
                    <p className="text-xs text-red-500 text-center">
                      لا يمكن الحفظ: مجموع التفصيل لا يطابق إجمالي المبيعات
                    </p>
                  )}
                </>
              )}
              {isReadOnly && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
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
      </div>
    </Layout>
  );
}
