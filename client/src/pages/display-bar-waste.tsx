import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { usePermissions } from "@/hooks/usePermissions";
import { apiRequest } from "@/lib/queryClient";
import { 
  Package, AlertTriangle, Plus, Camera, Trash2, Check, X, 
  FileText, TrendingDown, Clock, Building2, Calendar, CheckCircle2, User,
  Eye, Printer, FileDown, Hash, Image, Save, Search, RefreshCw, ArrowRight,
  ChevronDown, ChevronUp, Calculator, ExternalLink, BarChart3, Upload, Factory
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { TablePagination } from "@/components/ui/pagination";
import { ExportButtons } from "@/components/export-buttons";
import { ProductSelector } from "@/components/product-selector";
import { exportToExcel } from "@/lib/export-utils";
import { WASTE_REASON_LABELS, DISPLAY_BAR_CATEGORY_LABELS } from "@shared/schema";
import type { Branch, Product, WasteReport, WasteItem } from "@shared/schema";

interface AddedReceiptItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  time: string;
}

interface DailyWasteEntry {
  productId: number;
  productName: string;
  category: string;
  receivedQuantity: number;
  wasteQuantity: number;
  wasteReason: string;
  reasonDetails: string;
  imageUrl: string;
  unitPrice: number;
  isFromReceipt: boolean;
}

const WASTE_REASONS = [
  { value: "expired", label: "منتهي الصلاحية" },
  { value: "damaged", label: "تالف" },
  { value: "quality_issue", label: "مشكلة جودة" },
  { value: "overproduction", label: "إنتاج زائد" },
  { value: "other", label: "أخرى" },
];

export default function DisplayBarWastePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canApprove } = usePermissions();
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [receiptBranch, setReceiptBranch] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState("receipts");
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showWasteDialog, setShowWasteDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comparisonStartDate, setComparisonStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [comparisonEndDate, setComparisonEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRunningComparison, setIsRunningComparison] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const comparisonFileRef = useRef<HTMLInputElement>(null);

  const [receiptForm, setReceiptForm] = useState({
    productId: "",
    quantity: "",
    notes: "",
  });

  const [addedReceiptItems, setAddedReceiptItems] = useState<AddedReceiptItem[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showReceiptDialog) {
      setAddedReceiptItems([]);
    }
  }, [showReceiptDialog]);

  const [wasteForm, setWasteForm] = useState({
    productId: "",
    quantity: "",
    wasteReason: "expired",
    reasonDetails: "",
    imageUrl: "",
  });

  const [selectedWasteReportId, setSelectedWasteReportId] = useState<number | null>(null);
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<any | null>(null);
  const [showReceiptDetailDialog, setShowReceiptDetailDialog] = useState(false);
  const [viewingReport, setViewingReport] = useState<WasteReport | null>(null);
  const [showReportDetailsDialog, setShowReportDetailsDialog] = useState(false);
  const reportPrintRef = useRef<HTMLDivElement>(null);
  
  const [dailyWasteEntries, setDailyWasteEntries] = useState<DailyWasteEntry[]>([]);
  const [showAddUnlistedProduct, setShowAddUnlistedProduct] = useState(false);
  const [unlistedProductId, setUnlistedProductId] = useState("");
  const [dailyWasteSearch, setDailyWasteSearch] = useState("");
  const [wasteBranch, setWasteBranch] = useState("");
  const [wasteShift, setWasteShift] = useState<string>("morning");
  const [wasteImageInputRef, setWasteImageInputRef] = useState<number | null>(null);
  const wasteFileInputRef = useRef<HTMLInputElement>(null);
  const [wasteEntriesInitialized, setWasteEntriesInitialized] = useState("");
  const [savedReportId, setSavedReportId] = useState<number | null>(null);
  const [savedReportStatus, setSavedReportStatus] = useState<string>("draft");
  const [historyDateFrom, setHistoryDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [historyDateTo, setHistoryDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [historyBranch, setHistoryBranch] = useState<string>("all");
  const [historyStatus, setHistoryStatus] = useState<string>("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedReportId, setExpandedReportId] = useState<number | null>(null);
  const [showDailySummary, setShowDailySummary] = useState(true);
  const [analyticsDateFrom, setAnalyticsDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [analyticsDateTo, setAnalyticsDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [analyticsBranch, setAnalyticsBranch] = useState<string>("all");
  const [analyticsCategory, setAnalyticsCategory] = useState<string>("all");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [showProductDetailDialog, setShowProductDetailDialog] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  const SHIFT_OPTIONS = [
    { value: "morning", label: "الوردية الصباحية", time: "06:00 - 14:00" },
    { value: "evening", label: "الوردية المسائية", time: "14:00 - 22:00" },
    { value: "night", label: "الوردية الليلية", time: "22:00 - 06:00" },
  ];

  const { branches, canSelectBranch, userBranchId } = useBranches();

  useEffect(() => {
    if (userBranchId) {
      setSelectedBranch(userBranchId);
      setWasteBranch(userBranchId);
    } else if (canSelectBranch) {
      setSelectedBranch("all");
    }
  }, [userBranchId, canSelectBranch]);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ["/api/display-bar/receipts", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      const res = await fetch(`/api/display-bar/receipts?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: wasteReports = [] } = useQuery<WasteReport[]>({
    queryKey: ["/api/waste-reports", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) {
        params.append("dateFrom", selectedDate);
        params.append("dateTo", selectedDate);
      }
      const res = await fetch(`/api/waste-reports?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: wasteStats } = useQuery({
    queryKey: ["/api/waste-reports/stats"],
  });

  interface WasteAnalytics {
    date: string;
    branchId: string;
    daily: { wasteValue: number; wasteItems: number; sales: number; wastePercent: number; reportsCount: number };
    monthly: { wasteValue: number; wasteItems: number; sales: number; wastePercent: number; reportsCount: number };
    wasteByReason: Record<string, { count: number; value: number }>;
  }
  
  const { data: wasteAnalytics } = useQuery<WasteAnalytics>({
    queryKey: ["/api/waste-reports/analytics", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      const res = await fetch(`/api/waste-reports/analytics?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  interface DailySummaryItem {
    id: number;
    branchId: string;
    productId: number;
    summaryDate: string;
    openingQuantity: number;
    receivedQuantity: number;
    soldQuantity: number;
    wastedQuantity: number;
    closingQuantity: number;
    notes: string | null;
  }

  const { data: dailySummary = [], isLoading: isSummaryLoading } = useQuery<DailySummaryItem[]>({
    queryKey: ["/api/display-bar/summary", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      const res = await fetch(`/api/display-bar/summary?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: selectedBranch !== "all" && activeTab === "waste",
  });

  const calculateSummaryMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/display-bar/summary/calculate", {
        branchId: selectedBranch,
        date: selectedDate,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/display-bar/summary"] });
      toast({ title: "تم حساب الملخص اليومي بنجاح" });
    },
    onError: (err: any) => toast({ title: err.message || "حدث خطأ في حساب الملخص", variant: "destructive" }),
  });

  const { data: wasteHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/waste-reports/history", historyBranch, historyDateFrom, historyDateTo, historyStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (historyBranch !== "all") params.append("branchId", historyBranch);
      if (historyDateFrom) params.append("dateFrom", historyDateFrom);
      if (historyDateTo) params.append("dateTo", historyDateTo);
      if (historyStatus !== "all") params.append("status", historyStatus);
      const res = await fetch(`/api/waste-reports/history?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "history",
  });

  const { data: comparisons, refetch: refetchComparisons } = useQuery({
    queryKey: ["/api/production-comparisons", selectedBranch, comparisonStartDate, comparisonEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") params.set("branchId", selectedBranch);
      params.set("startDate", comparisonStartDate);
      params.set("endDate", comparisonEndDate);
      const res = await fetch(`/api/production-comparisons?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch comparisons");
      return res.json();
    },
    enabled: activeTab === "comparison" && !!comparisonStartDate && !!comparisonEndDate && selectedBranch !== "all",
  });

  const { data: comparisonSummary, refetch: refetchComparisonSummary } = useQuery({
    queryKey: ["/api/production-comparisons/summary", selectedBranch, comparisonStartDate, comparisonEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "all") params.set("branchId", selectedBranch);
      params.set("startDate", comparisonStartDate);
      params.set("endDate", comparisonEndDate);
      const res = await fetch(`/api/production-comparisons/summary?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: activeTab === "comparison" && !!comparisonStartDate && !!comparisonEndDate && selectedBranch !== "all",
  });

  const { data: detailedAnalytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ["/api/waste-reports/analytics-detailed", analyticsBranch, analyticsDateFrom, analyticsDateTo, analyticsCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (analyticsBranch !== "all") params.append("branchId", analyticsBranch);
      params.append("dateFrom", analyticsDateFrom);
      params.append("dateTo", analyticsDateTo);
      if (analyticsCategory !== "all") params.append("category", analyticsCategory);
      const res = await fetch(`/api/waste-reports/analytics-detailed?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: activeTab === "reports",
  });

  const { data: productWasteDetails, isLoading: isLoadingProductDetails } = useQuery({
    queryKey: ["/api/waste-reports/product-details", selectedProductId, analyticsBranch, analyticsDateFrom, analyticsDateTo],
    queryFn: async () => {
      if (!selectedProductId) return null;
      const params = new URLSearchParams();
      if (analyticsBranch !== "all") params.append("branchId", analyticsBranch);
      params.append("dateFrom", analyticsDateFrom);
      params.append("dateTo", analyticsDateTo);
      const res = await fetch(`/api/waste-reports/product-details/${selectedProductId}?${params}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedProductId && showProductDetailDialog,
  });

  const openProductDetail = (productId: number) => {
    setSelectedProductId(productId);
    setSelectedImageIndex(0);
    setShowProductDetailDialog(true);
  };

  const CATEGORY_LABELS: Record<string, string> = {
    pastries: "معجنات", sweets: "حلويات", bread: "خبز", cakes: "كيك",
    cookies: "كوكيز", drinks: "مشروبات", sandwiches: "ساندويتشات", other: "أخرى"
  };

  const CATEGORY_COLORS: Record<string, string> = {
    pastries: "bg-amber-500", sweets: "bg-pink-500", bread: "bg-yellow-600",
    cakes: "bg-purple-500", cookies: "bg-orange-500", drinks: "bg-blue-500",
    sandwiches: "bg-green-500", other: "bg-gray-500"
  };

  const REASON_COLORS: Record<string, string> = {
    expired: "bg-red-500", damaged: "bg-orange-500", quality_issue: "bg-amber-500",
    overproduction: "bg-blue-500", other: "bg-gray-500"
  };

  const paginatedHistory = wasteHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);

  const historyExportColumns = [
    { header: "التاريخ", key: "reportDate", width: 12 },
    { header: "الفرع", key: "branchName", width: 15 },
    { header: "الوردية", key: "shiftLabel", width: 12 },
    { header: "عدد الأصناف", key: "totalItems", width: 12 },
    { header: "إجمالي القيمة", key: "totalValue", width: 15 },
    { header: "الحالة", key: "statusLabel", width: 10 },
    { header: "المسجل", key: "reporterName", width: 20 },
  ];

  const historyExportData = wasteHistory.map((r: any) => ({
    ...r,
    branchName: getBranchName(r.branchId),
    shiftLabel: SHIFT_OPTIONS.find(s => s.value === r.shiftName)?.label || r.shiftName || "-",
    statusLabel: r.status === "draft" ? "مسودة" : r.status === "submitted" ? "مرسل" : r.status === "approved" ? "معتمد" : "مرفوض",
  }));

  const canApproveWaste = canApprove("operations") || user?.role === "admin" || user?.role === "manager";

  const { data: viewingReportItems = [], isFetching: isFetchingItems, isSuccess: isItemsSuccess } = useQuery<WasteItem[]>({
    queryKey: ["/api/waste-reports", viewingReport?.id, "items"],
    queryFn: async () => {
      if (!viewingReport?.id) return [];
      const res = await fetch(`/api/waste-reports/${viewingReport.id}/items`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!viewingReport?.id && showReportDetailsDialog,
    staleTime: 0,
  });

  const handleCloseReportDialog = () => {
    setShowReportDetailsDialog(false);
    setViewingReport(null);
  };

  const isItemsReady = isItemsSuccess && !isFetchingItems && viewingReportItems.length > 0;

  const handleViewReport = (report: WasteReport) => {
    setViewingReport(report);
    setShowReportDetailsDialog(true);
  };

  const handlePrintReport = () => {
    if (reportPrintRef.current) {
      const printContent = reportPrintRef.current;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html dir="rtl">
            <head>
              <title>تقرير الهالك - ${viewingReport?.reportDate}</title>
              <style>
                body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; direction: rtl; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
                th { background-color: #f5f5f5; font-weight: bold; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: #D4A574; margin: 0; }
                .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 5px 0; border-bottom: 1px solid #eee; }
                .total-row { background-color: #fef3c7; font-weight: bold; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
                @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
              <div class="footer">
                <p>تم الطباعة بتاريخ: ${new Date().toLocaleDateString('en-GB')}</p>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const handleExportReportToExcel = () => {
    if (!viewingReport) {
      toast({ title: "لا يوجد تقرير للتصدير", variant: "destructive" });
      return;
    }
    if (isFetchingItems) {
      toast({ title: "جاري تحميل البيانات...", description: "يرجى الانتظار" });
      return;
    }
    if (!isItemsReady) {
      toast({ title: "التقرير فارغ - لا توجد أصناف للتصدير", variant: "destructive" });
      return;
    }

    const exportData = viewingReportItems.map((item, index) => ({
      rowNum: index + 1,
      productName: getProductName(item.productId),
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      totalValue: item.totalValue || 0,
      wasteReason: WASTE_REASONS.find(r => r.value === item.wasteReason)?.label || item.wasteReason,
      notes: item.reasonDetails || "-",
    }));

    const columns = [
      { header: "#", key: "rowNum", width: 5 },
      { header: "الصنف", key: "productName", width: 25 },
      { header: "الكمية", key: "quantity", width: 10 },
      { header: "سعر الوحدة", key: "unitPrice", width: 12 },
      { header: "الإجمالي", key: "totalValue", width: 12 },
      { header: "سبب الهالك", key: "wasteReason", width: 15 },
      { header: "ملاحظات", key: "notes", width: 20 },
    ];

    const headerInfo = [
      { label: "التاريخ", value: viewingReport.reportDate },
      { label: "الفرع", value: getBranchName(viewingReport.branchId) },
      { label: "المسجل", value: viewingReport.reporterName || "-" },
      { label: "إجمالي الهالك", value: `${(viewingReport.totalValue || 0).toLocaleString()} ر.س` },
    ];

    exportToExcel(
      exportData,
      columns,
      `تقرير-الهالك-${viewingReport.reportDate}`,
      "تفاصيل الهالك",
      headerInfo
    );
    
    toast({ title: "تم تصدير التقرير بنجاح" });
  };

  const handleSalesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBranch || selectedBranch === "all") return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("branchId", selectedBranch);
      formData.append("defaultDate", comparisonStartDate);
      const res = await fetch("/api/production-comparisons/upload-sales", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل الرفع");
      const result = await res.json();
      setUploadResult(result);
      toast({ title: "تم رفع بيانات المبيعات بنجاح", description: `${result.recordsImported} سجل | ${result.uniqueProducts} منتج` });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (comparisonFileRef.current) comparisonFileRef.current.value = "";
    }
  };

  const handleRunComparison = async () => {
    if (!selectedBranch || selectedBranch === "all") {
      toast({ title: "يرجى اختيار فرع محدد", variant: "destructive" }); return;
    }
    setIsRunningComparison(true);
    try {
      const res = await fetch("/api/production-comparisons/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId: selectedBranch, startDate: comparisonStartDate, endDate: comparisonEndDate }),
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error || "فشل المقارنة");
      const result = await res.json();
      toast({ title: "تمت المقارنة بنجاح", description: `${result.comparisonsCreated} مقارنة` });
      refetchComparisons();
      refetchComparisonSummary();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setIsRunningComparison(false);
    }
  };

  const handleExportComparison = () => {
    if (!comparisons || !Array.isArray(comparisons) || comparisons.length === 0) {
      toast({ title: "لا توجد بيانات للتصدير", variant: "destructive" });
      return;
    }
    const exportData = comparisons.map((item: any, index: number) => ({
      rowNum: index + 1,
      productName: item.productName || "-",
      productCategory: item.productCategory || "-",
      producedQuantity: item.producedQuantity || 0,
      soldQuantity: item.soldQuantity || 0,
      difference: item.difference || 0,
      productionValue: item.productionValue || 0,
      salesValue: item.salesValue || 0,
      status: item.status === "normal" ? "طبيعي" : item.status === "waste" ? "هدر" : item.status === "shortage" ? "عجز" : "مخزون",
    }));
    const columns = [
      { header: "#", key: "rowNum", width: 5 },
      { header: "المنتج", key: "productName", width: 25 },
      { header: "الفئة", key: "productCategory", width: 15 },
      { header: "الكمية المنتجة", key: "producedQuantity", width: 12 },
      { header: "الكمية المباعة", key: "soldQuantity", width: 12 },
      { header: "الفرق", key: "difference", width: 10 },
      { header: "قيمة الإنتاج", key: "productionValue", width: 15 },
      { header: "قيمة المبيعات", key: "salesValue", width: 15 },
      { header: "الحالة", key: "status", width: 10 },
    ];
    exportToExcel(exportData, columns, `مقارنة_المبيعات_${comparisonStartDate}_${comparisonEndDate}`, "مقارنة المبيعات");
    toast({ title: "تم تصدير المقارنة بنجاح" });
  };

  const createReceiptMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/display-bar/receipts", data),
    onSuccess: (result: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/display-bar/receipts"] });
      const product = products.find(p => p.id === variables.productId);
      setAddedReceiptItems(prev => [...prev, {
        id: Date.now(),
        productId: variables.productId,
        productName: product?.name || "منتج",
        quantity: variables.quantity,
        time: variables.receiptTime,
      }]);
      setReceiptForm({ productId: "", quantity: "", notes: "" });
      toast({ title: "تم إضافة الصنف بنجاح", description: "يمكنك إضافة صنف آخر" });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const createWasteReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/waste-reports", data);
      return response.json();
    },
    onSuccess: (report: any) => {
      setSelectedWasteReportId(report.id);
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports"] });
      if (report.existing) {
        toast({ title: "يوجد تقرير بالفعل لهذا التاريخ والوردية - تم فتحه" });
      } else {
        toast({ title: "تم إنشاء تقرير الهالك بنجاح" });
      }
    },
    onError: (err: any) => toast({ title: err.message || "حدث خطأ في إنشاء التقرير", variant: "destructive" }),
  });

  const addWasteItemMutation = useMutation({
    mutationFn: async ({ reportId, data }: { reportId: number; data: any }) => 
      apiRequest("POST", `/api/waste-reports/${reportId}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports"] });
      setWasteForm({ productId: "", quantity: "", wasteReason: "expired", reasonDetails: "", imageUrl: "" });
      toast({ title: "تم إضافة الصنف التالف" });
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const updateWasteReportMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      if (!id || isNaN(id)) throw new Error("معرف التقرير غير صالح");
      const response = await apiRequest("PATCH", `/api/waste-reports/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports"] });
      toast({ title: "تم تحديث التقرير" });
    },
    onError: (err: any) => toast({ title: err.message || "حدث خطأ في تحديث التقرير", variant: "destructive" }),
  });

  const handleReceiptSubmit = () => {
    if (!receiptForm.productId || !receiptForm.quantity || !receiptBranch) {
      toast({ title: "يرجى اختيار الفرع والمنتج والكمية", variant: "destructive" });
      return;
    }
    createReceiptMutation.mutate({
      branchId: receiptBranch,
      productId: parseInt(receiptForm.productId),
      quantity: parseInt(receiptForm.quantity),
      receiptDate: new Date().toISOString().split("T")[0],
      receiptTime: new Date().toTimeString().slice(0, 5),
      notes: receiptForm.notes,
      createdBy: user?.id,
    });
  };

  const handleCreateWasteReport = () => {
    const branchId = wasteBranch || (selectedBranch !== "all" ? selectedBranch : "");
    if (!branchId) {
      toast({ title: "يرجى اختيار الفرع أولاً", variant: "destructive" });
      return;
    }
    createWasteReportMutation.mutate({
      branchId,
      reportDate: selectedDate,
      shiftName: wasteShift || null,
      status: "draft",
    });
  };

  const handleAddWasteItem = () => {
    if (!selectedWasteReportId || !wasteForm.productId || !wasteForm.quantity) {
      toast({ title: "يرجى تعبئة الحقول المطلوبة", variant: "destructive" });
      return;
    }
    const product = products.find(p => p.id === parseInt(wasteForm.productId));
    addWasteItemMutation.mutate({
      reportId: selectedWasteReportId,
      data: {
        productId: parseInt(wasteForm.productId),
        quantity: parseInt(wasteForm.quantity),
        unitPrice: product?.basePrice || 0,
        totalValue: (product?.basePrice || 0) * parseInt(wasteForm.quantity),
        wasteReason: wasteForm.wasteReason,
        reasonDetails: wasteForm.reasonDetails,
        imageUrl: wasteForm.imageUrl,
      },
    });
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setWasteForm(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getProductName = (productId: number) => products.find(p => p.id === productId)?.name || "-";
  const getBranchName = (branchId: string | number | null | undefined) => {
    if (!branchId) return "-";
    const id = String(branchId);
    return branches.find(b => b.id === id)?.name || "-";
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-gray-100 text-gray-700",
      submitted: "bg-blue-100 text-blue-700",
      approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      draft: "مسودة",
      submitted: "مرسل",
      approved: "معتمد",
      rejected: "مرفوض",
    };
    return <Badge className={styles[status]}>{labels[status]}</Badge>;
  };

  const filteredReceipts = receipts;
  const filteredWasteReports = wasteReports;

  const receiptOrders = useMemo(() => {
    const orderMap: Record<string, any> = {};
    filteredReceipts.forEach((r: any) => {
      const isAutoFromProduction = r.productionBatch?.startsWith('PROD-') || r.notes?.includes('استلام تلقائي من الإنتاج');
      const key = `${r.branchId}_${r.receiptDate}_${isAutoFromProduction ? 'auto_production' : (r.receivedBy || 'unknown')}`;
      if (!orderMap[key]) {
        orderMap[key] = {
          id: key,
          orderNumber: Object.keys(orderMap).length + 1,
          branchId: r.branchId,
          branchName: getBranchName(r.branchId),
          receiptDate: r.receiptDate,
          createdBy: r.receivedBy,
          createdByName: isAutoFromProduction ? "ربط تلقائي من الإنتاج" : (r.receivedByName || user?.username || "غير معروف"),
          items: [],
          totalQuantity: 0,
          firstTime: r.receiptTime,
          lastTime: r.receiptTime,
          isAutoFromProduction,
        };
      }
      const itemIndex = orderMap[key].items.length + 1;
      orderMap[key].items.push({
        ...r,
        index: itemIndex,
        productName: getProductName(r.productId),
        isAutoFromProduction,
        productionBatchRef: r.productionBatch,
      });
      orderMap[key].totalQuantity += r.quantity || 0;
      if (r.receiptTime < orderMap[key].firstTime) orderMap[key].firstTime = r.receiptTime;
      if (r.receiptTime > orderMap[key].lastTime) orderMap[key].lastTime = r.receiptTime;
    });
    return Object.values(orderMap).sort((a: any, b: any) => 
      b.lastTime.localeCompare(a.lastTime)
    );
  }, [filteredReceipts, branches, products, user]);

  const paginatedReceiptOrders = receiptOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedWasteReports = filteredWasteReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const aggregatedReceivedProducts = useMemo(() => {
    const productMap: Record<number, { productId: number; productName: string; category: string; totalQuantity: number; unitPrice: number }> = {};
    filteredReceipts.forEach((r: any) => {
      if (!productMap[r.productId]) {
        const product = products.find(p => p.id === r.productId);
        productMap[r.productId] = {
          productId: r.productId,
          productName: product?.name || "غير معروف",
          category: product?.category || "other",
          totalQuantity: 0,
          unitPrice: product?.basePrice || 0,
        };
      }
      productMap[r.productId].totalQuantity += r.quantity || 0;
    });
    return Object.values(productMap).sort((a, b) => a.productName.localeCompare(b.productName, "ar"));
  }, [filteredReceipts, products]);

  const productsRef = useRef(products);
  productsRef.current = products;
  const wasteReportsRef = useRef(wasteReports);
  wasteReportsRef.current = wasteReports;
  const loadedReportRef = useRef<string>("");

  const initializeWasteEntriesFromProducts = useCallback(() => {
    const entries: DailyWasteEntry[] = aggregatedReceivedProducts.map(p => ({
      productId: p.productId,
      productName: p.productName,
      category: p.category,
      receivedQuantity: p.totalQuantity,
      wasteQuantity: 0,
      wasteReason: "expired",
      reasonDetails: "",
      imageUrl: "",
      unitPrice: p.unitPrice,
      isFromReceipt: true,
    }));
    setDailyWasteEntries(entries);
  }, [aggregatedReceivedProducts]);

  useEffect(() => {
    const initKey = `${selectedBranch}_${selectedDate}`;
    if (selectedBranch !== "all" && aggregatedReceivedProducts.length > 0 && wasteEntriesInitialized !== initKey) {
      initializeWasteEntriesFromProducts();
      setWasteEntriesInitialized(initKey);
      loadedReportRef.current = "";
    } else if (selectedBranch === "all") {
      setDailyWasteEntries([]);
      setWasteEntriesInitialized("");
      setSavedReportId(null);
      setSavedReportStatus("draft");
      loadedReportRef.current = "";
    }
  }, [aggregatedReceivedProducts.length, selectedBranch, selectedDate, wasteEntriesInitialized]);

  useEffect(() => {
    if (selectedBranch === "all" || wasteReports.length === 0) return;
    const existingReport = wasteReports.find(
      (r: WasteReport) => r.branchId === selectedBranch && r.reportDate === selectedDate
    );
    const loadKey = `${selectedBranch}_${selectedDate}_${existingReport?.id ?? 'none'}`;
    if (loadKey === loadedReportRef.current) return;
    loadedReportRef.current = loadKey;

    if (existingReport) {
      setSavedReportId(existingReport.id);
      setSavedReportStatus(existingReport.status || "draft");
      fetch(`/api/waste-reports/${existingReport.id}/items`, { credentials: "include" })
        .then(res => res.ok ? res.json() : [])
        .then((savedItems: any[]) => {
          if (!Array.isArray(savedItems) || savedItems.length === 0) return;
          setDailyWasteEntries(prev => {
            const updated = [...prev];
            savedItems.forEach((item: any) => {
              const idx = updated.findIndex(e => e.productId === item.productId);
              if (idx >= 0) {
                updated[idx] = {
                  ...updated[idx],
                  wasteQuantity: item.quantity || 0,
                  wasteReason: item.wasteReason || "expired",
                  reasonDetails: item.reasonDetails || "",
                  imageUrl: item.imageUrl || "",
                };
              } else {
                const product = productsRef.current.find(p => p.id === item.productId);
                updated.push({
                  productId: item.productId,
                  productName: product?.name || "غير معروف",
                  category: product?.category || "other",
                  receivedQuantity: 0,
                  wasteQuantity: item.quantity || 0,
                  wasteReason: item.wasteReason || "damaged",
                  reasonDetails: item.reasonDetails || "",
                  imageUrl: item.imageUrl || "",
                  unitPrice: item.unitPrice || product?.basePrice || 0,
                  isFromReceipt: false,
                });
              }
            });
            return updated;
          });
        })
        .catch(err => console.error("Error loading saved waste items:", err));
    } else {
      setSavedReportId(null);
      setSavedReportStatus("draft");
    }
  }, [selectedBranch, selectedDate, wasteReports]);

  useEffect(() => {
    if (selectedBranch !== "all") {
      setWasteBranch(selectedBranch);
    }
  }, [selectedBranch]);

  const handleWasteEntryChange = (productId: number, field: keyof DailyWasteEntry, value: any) => {
    setDailyWasteEntries(prev => prev.map(entry => 
      entry.productId === productId ? { ...entry, [field]: value } : entry
    ));
  };

  const handleWasteImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && wasteImageInputRef !== null) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleWasteEntryChange(wasteImageInputRef, "imageUrl", reader.result as string);
        setWasteImageInputRef(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const addUnlistedProduct = () => {
    if (!unlistedProductId) return;
    const product = products.find(p => p.id === parseInt(unlistedProductId));
    if (!product) return;
    if (dailyWasteEntries.some(e => e.productId === product.id)) {
      toast({ title: "المنتج موجود بالفعل في القائمة", variant: "destructive" });
      return;
    }
    setDailyWasteEntries(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      category: product.category || "other",
      receivedQuantity: 0,
      wasteQuantity: 0,
      wasteReason: "damaged",
      reasonDetails: "",
      imageUrl: "",
      unitPrice: product.basePrice || 0,
      isFromReceipt: false,
    }]);
    setUnlistedProductId("");
    setShowAddUnlistedProduct(false);
    toast({ title: "تمت إضافة الصنف" });
  };

  const filteredDailyWasteEntries = dailyWasteEntries.filter(entry => 
    dailyWasteSearch === "" || entry.productName.includes(dailyWasteSearch)
  );

  const wasteEntriesWithQuantity = dailyWasteEntries.filter(e => e.wasteQuantity > 0);
  const totalWasteValue = wasteEntriesWithQuantity.reduce((sum, e) => sum + (e.wasteQuantity * e.unitPrice), 0);
  const totalWasteItems = wasteEntriesWithQuantity.length;

  const saveDailyWasteReportMutation = useMutation({
    mutationFn: async () => {
      if (!wasteBranch) throw new Error("يرجى اختيار الفرع");
      if (wasteEntriesWithQuantity.length === 0) throw new Error("لا يوجد أصناف هالكة للحفظ");
      
      const response = await apiRequest("POST", "/api/waste-reports", {
        branchId: wasteBranch,
        reportDate: selectedDate,
        shiftName: wasteShift,
        status: "draft",
        reporterName: user?.username,
        totalItems: totalWasteItems,
        totalValue: totalWasteValue,
      });
      const reportData = await response.json();
      
      if (reportData.existing) {
        await apiRequest("PATCH", `/api/waste-reports/${reportData.id}`, {
          totalItems: totalWasteItems,
          totalValue: totalWasteValue,
        });
      }
      
      const batchItems = wasteEntriesWithQuantity.map(entry => ({
        productId: entry.productId,
        quantity: entry.wasteQuantity,
        unitPrice: entry.unitPrice,
        totalValue: entry.wasteQuantity * entry.unitPrice,
        wasteReason: entry.wasteReason,
        reasonDetails: (entry.reasonDetails || '').slice(0, 500),
        imageUrl: (entry.imageUrl || '').slice(0, 2000),
      }));
      
      await apiRequest("PUT", `/api/waste-reports/${reportData.id}/items/batch`, { items: batchItems });
      return reportData;
    },
    onSuccess: (reportData: any) => {
      loadedReportRef.current = `${wasteBranch}_${selectedDate}_${reportData.id}`;
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports/analytics"] });
      setSavedReportId(reportData.id);
      setSavedReportStatus(reportData.status || "draft");
      toast({ title: reportData.existing ? "تم تحديث تقرير الهالك الموجود" : "تم حفظ تقرير الهالك اليومي بنجاح" });
    },
    onError: (err: any) => {
      console.error("Save waste report error:", err);
      toast({ title: err.message || "حدث خطأ في حفظ التقرير", variant: "destructive" });
    },
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: async (reportId: number) => {
      const itemsRes = await fetch(`/api/waste-reports/${reportId}/items`, { credentials: "include" });
      const items = itemsRes.ok ? await itemsRes.json() : [];
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error("لا يمكن إرسال تقرير بدون أصناف - يرجى حفظ الأصناف أولاً");
      }
      const response = await apiRequest("PATCH", `/api/waste-reports/${reportId}`, { status: "submitted" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports/history"] });
      setSavedReportStatus("submitted");
      toast({ title: "تم إرسال التقرير للاعتماد بنجاح" });
    },
    onError: (err: any) => toast({ title: err.message || "حدث خطأ في إرسال التقرير", variant: "destructive" }),
  });

  const approveReportMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/waste-reports/${id}`, { status });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/waste-reports/history"] });
      toast({ title: variables.status === "approved" ? "تم اعتماد التقرير بنجاح" : "تم رفض التقرير" });
    },
    onError: (err: any) => toast({ title: err.message || "حدث خطأ", variant: "destructive" }),
  });

  const receiptExportColumns = [
    { header: "التاريخ", key: "receiptDate", width: 12 },
    { header: "الوقت", key: "receiptTime", width: 10 },
    { header: "المنتج", key: "productName", width: 25 },
    { header: "الكمية", key: "quantity", width: 10 },
    { header: "الفرع", key: "branchName", width: 15 },
    { header: "ملاحظات", key: "notes", width: 25 },
  ];

  const wasteExportColumns = [
    { header: "التاريخ", key: "reportDate", width: 12 },
    { header: "الفرع", key: "branchName", width: 15 },
    { header: "عدد الأصناف", key: "totalItems", width: 12 },
    { header: "إجمالي القيمة", key: "totalValue", width: 15 },
    { header: "الحالة", key: "statusLabel", width: 10 },
    { header: "المسجل", key: "reporterName", width: 20 },
  ];

  const receiptsExportData = filteredReceipts.map((r: any) => ({
    ...r,
    productName: getProductName(r.productId),
    branchName: getBranchName(r.branchId),
  }));

  const wasteExportData = filteredWasteReports.map((r: WasteReport) => ({
    ...r,
    branchName: getBranchName(r.branchId),
    statusLabel: r.status === "draft" ? "مسودة" : r.status === "submitted" ? "مرسل" : r.status === "approved" ? "معتمد" : "مرفوض",
  }));

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto space-y-3 sm:space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/operations">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                بار العرض والهالك
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">إدارة استلام الإنتاج ومتابعة الهالك اليومي</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!canSelectBranch}>
              <SelectTrigger className="w-36 sm:w-40 h-11 sm:h-10" data-testid="select-branch">
                <Building2 className="w-4 h-4 ml-2" />
                <SelectValue placeholder="الفرع" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {canSelectBranch && <SelectItem value="all">جميع الفروع</SelectItem>}
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-36 sm:w-40 h-11 sm:h-10"
              data-testid="input-date"
            />
          </div>
        </div>

        {/* Stats Cards - Basic */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-bold text-blue-700">{receiptOrders.length}</div>
                  <div className="text-[10px] sm:text-[11px] text-blue-600/70">أوامر استلام</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50/50 border-green-100">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-green-100 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-bold text-green-700">
                    {filteredReceipts.reduce((sum: number, r: any) => sum + (r.quantity || 0), 0)}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-green-600/70">وحدات مستلمة</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-red-50/50 border-red-100">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-bold text-red-700">{filteredWasteReports.length}</div>
                  <div className="text-[10px] sm:text-[11px] text-red-600/70">تقارير الهالك</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-amber-50/50 border-amber-100">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-bold text-amber-700">
                    {filteredWasteReports.reduce((sum: number, r: WasteReport) => sum + (r.totalValue || 0), 0).toLocaleString()} ر.س
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-amber-600/70">قيمة الهالك</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Waste vs Sales Analytics */}
        {wasteAnalytics && (
          <Card className="border-2 border-primary/20 bg-gradient-to-l from-primary/5 to-amber-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-primary" />
                تحليل الهدر مقابل المبيعات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Daily Waste */}
                <div className="bg-white rounded-lg p-3 border shadow-sm">
                  <div className="text-xs text-muted-foreground mb-1">هالك اليوم</div>
                  <div className="text-lg font-bold text-red-600">
                    {(wasteAnalytics.daily?.wasteValue || 0).toLocaleString()} ر.س
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {wasteAnalytics.daily?.wasteItems || 0} صنف
                  </div>
                </div>
                
                {/* Daily Sales */}
                <div className="bg-white rounded-lg p-3 border shadow-sm">
                  <div className="text-xs text-muted-foreground mb-1">مبيعات اليوم</div>
                  <div className="text-lg font-bold text-green-600">
                    {(wasteAnalytics.daily?.sales || 0).toLocaleString()} ر.س
                  </div>
                  <div className="text-xs text-muted-foreground">
                    من يومية الكاشير
                  </div>
                </div>
                
                {/* Daily Waste % */}
                <div className="bg-white rounded-lg p-3 border shadow-sm">
                  <div className="text-xs text-muted-foreground mb-1">نسبة الهدر اليومي</div>
                  <div className={`text-lg font-bold ${(wasteAnalytics.daily?.wastePercent || 0) > 5 ? 'text-red-600' : (wasteAnalytics.daily?.wastePercent || 0) > 2 ? 'text-amber-600' : 'text-green-600'}`}>
                    {(wasteAnalytics.daily?.wastePercent || 0).toFixed(2)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(wasteAnalytics.daily?.wastePercent || 0) > 5 ? 'مرتفع - يحتاج مراجعة' : (wasteAnalytics.daily?.wastePercent || 0) > 2 ? 'متوسط' : 'ممتاز'}
                  </div>
                </div>
                
                {/* Monthly Waste % */}
                <div className="bg-white rounded-lg p-3 border shadow-sm">
                  <div className="text-xs text-muted-foreground mb-1">نسبة الهدر الشهري</div>
                  <div className={`text-lg font-bold ${(wasteAnalytics.monthly?.wastePercent || 0) > 5 ? 'text-red-600' : (wasteAnalytics.monthly?.wastePercent || 0) > 2 ? 'text-amber-600' : 'text-green-600'}`}>
                    {(wasteAnalytics.monthly?.wastePercent || 0).toFixed(2)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    هالك: {(wasteAnalytics.monthly?.wasteValue || 0).toLocaleString()} من {(wasteAnalytics.monthly?.sales || 0).toLocaleString()} ر.س
                  </div>
                </div>
              </div>
              
              {/* Waste by Reason */}
              {wasteAnalytics.wasteByReason && Object.keys(wasteAnalytics.wasteByReason).length > 0 && (
                <div className="mt-4 pt-3 border-t">
                  <div className="text-sm font-medium mb-2">أسباب الهالك اليوم</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(wasteAnalytics.wasteByReason).map(([reason, data]) => (
                      <Badge key={reason} variant="outline" className="text-xs">
                        {WASTE_REASONS.find(r => r.value === reason)?.label || reason}: {data.count} قطعة ({data.value.toLocaleString()} ر.س)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); setHistoryPage(1); }}>
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="receipts" className="gap-1" data-testid="tab-receipts">
                <Package className="w-4 h-4" />
                استلام الإنتاج
              </TabsTrigger>
              <TabsTrigger value="waste" className="gap-1" data-testid="tab-daily-waste">
                <AlertTriangle className="w-4 h-4" />
                الهالك اليومي
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1" data-testid="tab-waste-history">
                <FileText className="w-4 h-4" />
                سجل الهالك
              </TabsTrigger>
              <TabsTrigger value="comparison" className="gap-1" data-testid="tab-comparison">
                <BarChart3 className="w-4 h-4" />
                مقارنة المبيعات
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-1" data-testid="tab-reports">
                <TrendingDown className="w-4 h-4" />
                تقارير تفصيلية
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              {activeTab === "receipts" && (
                <>
                  <ExportButtons
                    data={receiptsExportData}
                    columns={receiptExportColumns}
                    fileName={`استلام_الانتاج_${selectedDate}`}
                    title="تقرير استلام الإنتاج"
                    subtitle={`التاريخ: ${selectedDate}`}
                  />
                  <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1 h-11 sm:h-9" data-testid="btn-add-receipt">
                        <Plus className="w-4 h-4" />
                        استلام جديد
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-lg">استلام إنتاج جديد</DialogTitle>
                      </DialogHeader>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gradient-to-l from-primary/5 to-primary/10 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">الفرع</p>
                            <Select value={receiptBranch} onValueChange={setReceiptBranch}>
                              <SelectTrigger className="h-7 text-xs w-[120px] border-0 bg-white/50 p-1">
                                <SelectValue placeholder="اختر الفرع" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60 overflow-y-auto">
                                {branches.map(b => (
                                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">المسؤول</p>
                            <p className="text-sm font-medium">{user?.username || "غير معروف"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">التاريخ</p>
                            <p className="text-sm font-medium">{currentTime.toLocaleDateString('en-GB')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">الوقت</p>
                            <p className="text-sm font-medium">{currentTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div className="space-y-4">
                          <div className="bg-muted/30 p-4 rounded-lg border">
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <Plus className="w-4 h-4 text-primary" />
                              إضافة صنف سريع
                            </h4>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs">المنتج (ابحث بالاسم أو الكود)</Label>
                                <ProductSelector
                                  products={products.filter(p => p.isActive !== "false" && p.category !== "باريستا" && p.category !== "بيتزا")}
                                  value={receiptForm.productId}
                                  onSelect={(id) => setReceiptForm(f => ({ ...f, productId: id }))}
                                  placeholder="ابحث عن المنتج..."
                                  showPrice={true}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs">الكمية</Label>
                                  <Input
                                    type="number"
                                    value={receiptForm.quantity}
                                    onChange={(e) => setReceiptForm(f => ({ ...f, quantity: e.target.value }))}
                                    placeholder="الكمية"
                                    data-testid="input-quantity-receipt"
                                    className="h-11 sm:h-10 text-center text-lg font-semibold"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">ملاحظات</Label>
                                  <Input
                                    value={receiptForm.notes}
                                    onChange={(e) => setReceiptForm(f => ({ ...f, notes: e.target.value }))}
                                    placeholder="اختياري"
                                    data-testid="input-notes-receipt"
                                    className="h-11 sm:h-10"
                                  />
                                </div>
                              </div>
                              <Button 
                                onClick={handleReceiptSubmit} 
                                className="w-full gap-2 h-11 sm:h-9" 
                                disabled={createReceiptMutation.isPending || !receiptForm.productId || !receiptForm.quantity || !receiptBranch}
                              >
                                {createReceiptMutation.isPending ? (
                                  <>جاري الإضافة...</>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4" />
                                    إضافة الصنف
                                  </>
                                )}
                              </Button>
                              {!receiptBranch && (
                                <p className="text-xs text-destructive text-center">يرجى اختيار الفرع أولاً</p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              الأصناف المضافة
                            </h4>
                            <Badge variant="secondary">{addedReceiptItems.length} صنف</Badge>
                          </div>
                          
                          {addedReceiptItems.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">لم يتم إضافة أصناف بعد</p>
                              <p className="text-xs">اختر المنتج والكمية ثم اضغط إضافة</p>
                            </div>
                          ) : (
                            <ScrollArea className="h-[280px] border rounded-lg">
                              <div className="p-2 space-y-2">
                                {addedReceiptItems.map((item, index) => (
                                  <div 
                                    key={item.id} 
                                    className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-100"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm">
                                        {index + 1}
                                      </div>
                                      <div>
                                        <div className="font-medium text-sm">{item.productName}</div>
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          {item.time}
                                        </div>
                                      </div>
                                    </div>
                                    <Badge className="bg-green-600">{item.quantity} وحدة</Badge>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                          
                          {addedReceiptItems.length > 0 && (
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                className="flex-1"
                                onClick={() => setShowReceiptDialog(false)}
                              >
                                إنهاء وإغلاق
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
              {activeTab === "waste" && (
                <>
                  <ExportButtons
                    data={wasteExportData}
                    columns={wasteExportColumns}
                    fileName={`تقرير_الهالك_${selectedDate}`}
                    title="تقرير الهالك اليومي"
                    subtitle={`التاريخ: ${selectedDate}`}
                  />
                  <Dialog open={showWasteDialog} onOpenChange={(open) => {
                      setShowWasteDialog(open);
                      if (!open) {
                        setSelectedWasteReportId(null);
                      }
                    }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="destructive" className="gap-1 h-11 sm:h-9" data-testid="btn-add-waste">
                        <AlertTriangle className="w-4 h-4" />
                        تقرير هالك جديد
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-lg flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          {!selectedWasteReportId ? "إنشاء تقرير هالك جديد" : "إضافة أصناف تالفة"}
                        </DialogTitle>
                      </DialogHeader>

                      {!selectedWasteReportId ? (
                        <div className="space-y-5">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gradient-to-l from-red-50 to-amber-50 rounded-lg border">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">الفرع</p>
                                <Select value={wasteBranch || (selectedBranch !== "all" ? selectedBranch : "")} onValueChange={setWasteBranch}>
                                  <SelectTrigger className="h-7 text-xs border-0 bg-white/50 p-1" data-testid="select-waste-dialog-branch">
                                    <SelectValue placeholder="اختر الفرع" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60 overflow-y-auto">
                                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-purple-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground">الوردية</p>
                                <Select value={wasteShift} onValueChange={setWasteShift}>
                                  <SelectTrigger className="h-7 text-xs border-0 bg-white/50 p-1" data-testid="select-waste-dialog-shift">
                                    <SelectValue placeholder="اختر" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="morning">صباحية</SelectItem>
                                    <SelectItem value="evening">مسائية</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-amber-600" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">التاريخ</p>
                                <p className="text-sm font-medium">{selectedDate}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                <User className="w-4 h-4 text-green-600" />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">المسؤول</p>
                                <p className="text-sm font-medium">{user?.username || "غير معروف"}</p>
                              </div>
                            </div>
                          </div>

                          <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
                              <AlertTriangle className="w-8 h-8 text-red-400" />
                            </div>
                            <p className="text-muted-foreground text-sm mb-5">سيتم إنشاء تقرير هالك جديد بالبيانات أعلاه</p>
                            <Button
                              onClick={handleCreateWasteReport}
                              disabled={createWasteReportMutation.isPending || !(wasteBranch || (selectedBranch !== "all" ? selectedBranch : ""))}
                              variant="destructive"
                              className="w-full max-w-xs mx-auto h-11"
                            >
                              {createWasteReportMutation.isPending ? "جاري الإنشاء..." : "إنشاء التقرير"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm flex items-center gap-2 border border-green-200">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            تم إنشاء التقرير بنجاح. يمكنك الآن إضافة الأصناف التالفة.
                          </div>

                          <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                            <h4 className="font-semibold text-sm flex items-center gap-2">
                              <Plus className="w-4 h-4 text-red-500" />
                              إضافة صنف تالف
                            </h4>
                            <div>
                              <Label className="text-xs">المنتج التالف</Label>
                              <ProductSelector
                                products={products.filter(p => p.isActive !== "false")}
                                value={wasteForm.productId}
                                onSelect={(id) => setWasteForm(f => ({ ...f, productId: id }))}
                                placeholder="ابحث عن المنتج..."
                                showPrice={true}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">الكمية</Label>
                                <Input
                                  type="number"
                                  value={wasteForm.quantity}
                                  onChange={(e) => setWasteForm(f => ({ ...f, quantity: e.target.value }))}
                                  placeholder="الكمية"
                                  data-testid="input-quantity-waste"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">سبب الإتلاف</Label>
                                <Select value={wasteForm.wasteReason} onValueChange={(v) => setWasteForm(f => ({ ...f, wasteReason: v }))}>
                                  <SelectTrigger data-testid="select-reason">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60 overflow-y-auto">
                                    {WASTE_REASONS.map(r => (
                                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">تفاصيل إضافية</Label>
                              <Textarea
                                value={wasteForm.reasonDetails}
                                onChange={(e) => setWasteForm(f => ({ ...f, reasonDetails: e.target.value }))}
                                placeholder="وصف حالة المنتج..."
                                rows={2}
                                data-testid="input-details-waste"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">صورة المنتج التالف</Label>
                              <div className="mt-1">
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={handleImageCapture}
                                  className="hidden"
                                />
                                {wasteForm.imageUrl ? (
                                  <div className="relative">
                                    <img src={wasteForm.imageUrl} alt="صورة المنتج" className="w-full h-32 object-cover rounded-lg" />
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="absolute top-2 left-2"
                                      onClick={() => setWasteForm(f => ({ ...f, imageUrl: "" }))}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    className="w-full h-16 border-dashed text-xs"
                                    onClick={() => fileInputRef.current?.click()}
                                  >
                                    <Camera className="w-5 h-5 ml-2" />
                                    التقاط صورة
                                  </Button>
                                )}
                              </div>
                            </div>
                            <Button onClick={handleAddWasteItem} variant="destructive" className="w-full h-10" disabled={addWasteItemMutation.isPending}>
                              {addWasteItemMutation.isPending ? "جاري الإضافة..." : "إضافة الصنف التالف"}
                            </Button>
                          </div>

                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setShowWasteDialog(false);
                              setSelectedWasteReportId(null);
                            }}
                          >
                            إنهاء وإغلاق
                          </Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>

          <TabsContent value="receipts" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="w-full text-xs sm:text-sm min-w-[600px]">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 sm:p-3 text-right font-medium">رقم الأمر</th>
                        <th className="p-2 sm:p-3 text-right font-medium">الفرع</th>
                        <th className="p-2 sm:p-3 text-right font-medium hidden md:table-cell">المستلم</th>
                        <th className="p-2 sm:p-3 text-right font-medium hidden sm:table-cell">التاريخ</th>
                        <th className="p-2 sm:p-3 text-right font-medium hidden md:table-cell">الوقت</th>
                        <th className="p-2 sm:p-3 text-right font-medium">عدد الأصناف</th>
                        <th className="p-2 sm:p-3 text-right font-medium">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedReceiptOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground">
                            لا توجد أوامر استلام لهذا اليوم
                          </td>
                        </tr>
                      ) : (
                        paginatedReceiptOrders.map((order: any, index: number) => (
                          <tr key={order.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setSelectedReceiptOrder(order); setShowReceiptDetailDialog(true); }}>
                            <td className="p-2 sm:p-3">
                              <div className="flex items-center gap-1 sm:gap-2">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <Hash className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                                </div>
                                <span className="font-bold text-primary text-xs sm:text-sm">#{(currentPage - 1) * itemsPerPage + index + 1}</span>
                              </div>
                            </td>
                            <td className="p-2 sm:p-3">
                              <Badge variant="outline" className="gap-1 text-[10px] sm:text-xs">
                                <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                {order.branchName}
                              </Badge>
                            </td>
                            <td className="p-2 sm:p-3 hidden md:table-cell">
                              {order.isAutoFromProduction ? (
                                <Badge variant="secondary" className="gap-1 text-[10px] sm:text-xs bg-green-50 text-green-700 border-green-200">
                                  <Factory className="w-2.5 h-2.5" />
                                  ربط تلقائي من الإنتاج
                                </Badge>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-muted-foreground" />
                                  {order.createdByName}
                                </div>
                              )}
                            </td>
                            <td className="p-2 sm:p-3 hidden sm:table-cell">{order.receiptDate}</td>
                            <td className="p-2 sm:p-3 hidden md:table-cell">
                              <div className="flex items-center gap-1 text-muted-foreground text-xs">
                                <Clock className="w-3 h-3" />
                                {order.firstTime} - {order.lastTime}
                              </div>
                            </td>
                            <td className="p-2 sm:p-3">
                              <Badge className="bg-green-100 text-green-700 text-[10px] sm:text-xs">{order.items.length} صنف</Badge>
                              <span className="text-[10px] sm:text-xs text-muted-foreground mr-1 sm:mr-2 hidden sm:inline">({order.totalQuantity} وحدة)</span>
                            </td>
                            <td className="p-2 sm:p-3">
                              <Button size="sm" variant="ghost" className="gap-1 h-11 sm:h-9 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedReceiptOrder(order); setShowReceiptDetailDialog(true); }}>
                                <Eye className="w-4 h-4" />
                                <span className="hidden sm:inline">عرض</span>
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {receiptOrders.length > itemsPerPage && (
                  <div className="p-3 border-t">
                    <TablePagination
                      currentPage={currentPage}
                      totalItems={receiptOrders.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <Dialog open={showReceiptDetailDialog} onOpenChange={setShowReceiptDetailDialog}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    سند استلام إنتاج للعرض
                  </span>
                  <div className="flex gap-2">
                    <ExportButtons
                      data={selectedReceiptOrder?.items || []}
                      columns={[
                        { header: "#", key: "index", width: 5 },
                        { header: "الصنف", key: "productName", width: 30 },
                        { header: "الكمية", key: "quantity", width: 10 },
                        { header: "الوقت", key: "receiptTime", width: 10 },
                        { header: "ملاحظات", key: "notes", width: 25 },
                      ]}
                      fileName={`سند_استلام_${selectedReceiptOrder?.orderNumber || ''}`}
                      title="سند استلام إنتاج للعرض"
                      subtitle={`فرع ${selectedReceiptOrder?.branchName || ''}`}
                      headerInfo={selectedReceiptOrder ? [
                        { label: "رقم السند", value: `#${selectedReceiptOrder.orderNumber}` },
                        { label: "الفرع", value: selectedReceiptOrder.branchName },
                        { label: "المستلم", value: selectedReceiptOrder.createdByName },
                        { label: "التاريخ", value: selectedReceiptOrder.receiptDate },
                        { label: "وقت البداية", value: selectedReceiptOrder.firstTime },
                        { label: "وقت النهاية", value: selectedReceiptOrder.lastTime },
                        { label: "عدد الأصناف", value: `${selectedReceiptOrder.items.length} صنف` },
                        { label: "إجمالي الوحدات", value: `${selectedReceiptOrder.totalQuantity} وحدة` },
                      ] : []}
                    />
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              {selectedReceiptOrder && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gradient-to-l from-primary/5 to-primary/10 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Hash className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">رقم السند</p>
                        <p className="text-lg font-bold text-primary">#{selectedReceiptOrder.orderNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">الفرع</p>
                        <p className="font-medium">{selectedReceiptOrder.branchName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">المستلم</p>
                        <p className="font-medium">{selectedReceiptOrder.createdByName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">التاريخ والوقت</p>
                        <p className="font-medium">{selectedReceiptOrder.receiptDate}</p>
                        <p className="text-xs text-muted-foreground">{selectedReceiptOrder.firstTime} - {selectedReceiptOrder.lastTime}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 font-semibold flex items-center justify-between">
                      <span>الأصناف المستلمة</span>
                      <Badge variant="secondary">{selectedReceiptOrder.items.length} صنف - {selectedReceiptOrder.totalQuantity} وحدة</Badge>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="p-3 text-right font-medium">#</th>
                          <th className="p-3 text-right font-medium">الصنف</th>
                          <th className="p-3 text-right font-medium">الكمية</th>
                          <th className="p-3 text-right font-medium">الوقت</th>
                          <th className="p-3 text-right font-medium">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedReceiptOrder.items.map((item: any, idx: number) => (
                          <tr key={item.id} className="hover:bg-muted/20">
                            <td className="p-3 text-muted-foreground">{idx + 1}</td>
                            <td className="p-3 font-medium">{item.productName}</td>
                            <td className="p-3">
                              <Badge variant="secondary">{item.quantity}</Badge>
                            </td>
                            <td className="p-3 text-muted-foreground">{item.receiptTime}</td>
                            <td className="p-3 text-muted-foreground">{item.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-primary/5">
                        <tr>
                          <td colSpan={2} className="p-3 font-bold">الإجمالي</td>
                          <td className="p-3">
                            <Badge className="bg-primary text-white">{selectedReceiptOrder.totalQuantity} وحدة</Badge>
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowReceiptDetailDialog(false)}>
                      إغلاق
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <TabsContent value="waste" className="mt-4 space-y-4">
            <input
              ref={wasteFileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleWasteImageCapture}
              className="hidden"
            />

            {selectedBranch === "all" && (
              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardContent className="p-6 text-center">
                  <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-yellow-800 mb-2">يرجى اختيار فرع محدد</h3>
                  <p className="text-yellow-700">لتسجيل الهالك اليومي، يجب عليك اختيار فرع محدد من القائمة أعلاه</p>
                </CardContent>
              </Card>
            )}
            
            {selectedBranch !== "all" && (
            <>
            <Card className="border-orange-200 bg-gradient-to-l from-orange-50/50 to-red-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    تقرير الهالك اليومي - {new Date(selectedDate).toLocaleDateString("en-GB")}
                  </span>
                  <div className="flex items-center gap-2">
                    <Select value={wasteBranch} onValueChange={setWasteBranch}>
                      <SelectTrigger className="w-36 sm:w-40 h-11 sm:h-10" data-testid="select-waste-branch">
                        <Building2 className="w-4 h-4 ml-2" />
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={wasteShift} onValueChange={setWasteShift}>
                      <SelectTrigger className="w-40 sm:w-44 h-11 sm:h-10" data-testid="select-waste-shift">
                        <Clock className="w-4 h-4 ml-2" />
                        <SelectValue placeholder="الوردية" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {SHIFT_OPTIONS.map(shift => (
                          <SelectItem key={shift.value} value={shift.value}>
                            <div className="flex flex-col">
                              <span>{shift.label}</span>
                              <span className="text-[10px] text-muted-foreground">{shift.time}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => { setDailyWasteEntries([]); setWasteEntriesInitialized(""); loadedReportRef.current = ""; queryClient.invalidateQueries({ queryKey: ["/api/waste-reports"] }); }}
                      className="gap-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      تحديث
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">أصناف مستلمة</div>
                    <div className="text-xl font-bold text-blue-600">{aggregatedReceivedProducts.length}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">أصناف بها هالك</div>
                    <div className="text-xl font-bold text-orange-600">{totalWasteItems}</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">إجمالي قيمة الهالك</div>
                    <div className="text-xl font-bold text-red-600">{totalWasteValue.toLocaleString()} ر.س</div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">الوردية</div>
                    <div className="text-lg font-bold text-purple-600">
                      {SHIFT_OPTIONS.find(s => s.value === wasteShift)?.label || "صباحية"}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <div className="text-xs text-muted-foreground">التاريخ</div>
                    <div className="text-lg font-bold">{new Date(selectedDate).toLocaleDateString("en-GB")}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-indigo-200 bg-gradient-to-l from-indigo-50/30 to-blue-50/30" data-testid="daily-summary-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <button
                    className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                    onClick={() => setShowDailySummary(!showDailySummary)}
                    data-testid="btn-toggle-daily-summary"
                  >
                    {showDailySummary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    <Calculator className="w-5 h-5 text-indigo-600" />
                    ملخص حركة المنتجات اليومي
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs" data-testid="badge-summary-count">
                      {dailySummary.length} صنف
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-9"
                      onClick={() => calculateSummaryMutation.mutate()}
                      disabled={calculateSummaryMutation.isPending || selectedBranch === "all"}
                      data-testid="btn-calculate-daily-summary"
                    >
                      {calculateSummaryMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Calculator className="w-4 h-4" />
                      )}
                      حساب الملخص اليومي
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              {showDailySummary && (
                <CardContent className="pt-0">
                  {isSummaryLoading ? (
                    <div className="text-center py-6 text-muted-foreground">جاري تحميل الملخص...</div>
                  ) : dailySummary.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg bg-white/50">
                      <Calculator className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">لا يوجد ملخص يومي بعد</p>
                      <p className="text-xs">اضغط على "حساب الملخص اليومي" لحساب ملخص حركة المنتجات</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-daily-summary">
                        <thead className="bg-indigo-50/80">
                          <tr>
                            <th className="p-2 text-right font-medium">#</th>
                            <th className="p-2 text-right font-medium">اسم المنتج</th>
                            <th className="p-2 text-center font-medium">الافتتاحي</th>
                            <th className="p-2 text-center font-medium">المستلم</th>
                            <th className="p-2 text-center font-medium">المباع</th>
                            <th className="p-2 text-center font-medium">الهالك</th>
                            <th className="p-2 text-center font-medium">الختامي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {dailySummary.map((item, index) => (
                            <tr key={item.id} className="hover:bg-white/50" data-testid={`row-summary-${item.productId}`}>
                              <td className="p-2 text-muted-foreground">{index + 1}</td>
                              <td className="p-2 font-medium">{getProductName(item.productId)}</td>
                              <td className="p-2 text-center">{item.openingQuantity}</td>
                              <td className="p-2 text-center text-blue-600 font-medium">{item.receivedQuantity}</td>
                              <td className="p-2 text-center text-gray-400">{item.soldQuantity}</td>
                              <td className="p-2 text-center text-red-600 font-medium">{item.wastedQuantity}</td>
                              <td className={`p-2 text-center font-bold ${item.closingQuantity < 0 ? 'text-red-600' : item.closingQuantity > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                {item.closingQuantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-indigo-50/50 font-medium">
                          <tr>
                            <td className="p-2" colSpan={2}>الإجمالي</td>
                            <td className="p-2 text-center">{dailySummary.reduce((s, i) => s + i.openingQuantity, 0)}</td>
                            <td className="p-2 text-center text-blue-600">{dailySummary.reduce((s, i) => s + i.receivedQuantity, 0)}</td>
                            <td className="p-2 text-center text-gray-400">{dailySummary.reduce((s, i) => s + i.soldQuantity, 0)}</td>
                            <td className="p-2 text-center text-red-600">{dailySummary.reduce((s, i) => s + i.wastedQuantity, 0)}</td>
                            <td className={`p-2 text-center font-bold ${dailySummary.reduce((s, i) => s + i.closingQuantity, 0) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {dailySummary.reduce((s, i) => s + i.closingQuantity, 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <CardTitle className="text-base">الأصناف المستلمة اليوم</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="بحث عن صنف..."
                        value={dailyWasteSearch}
                        onChange={(e) => setDailyWasteSearch(e.target.value)}
                        className="pr-9 w-48 h-9"
                        data-testid="input-waste-search"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowAddUnlistedProduct(true)}
                      className="gap-1"
                      disabled={savedReportStatus === "submitted" || savedReportStatus === "approved"}
                    >
                      <Plus className="w-4 h-4" />
                      إضافة صنف غير مستلم
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-right font-medium w-8">#</th>
                        <th className="p-3 text-right font-medium">الصنف</th>
                        <th className="p-3 text-right font-medium w-24">الكمية المستلمة</th>
                        <th className="p-3 text-right font-medium w-24">كمية الهالك</th>
                        <th className="p-3 text-right font-medium w-20">المتبقي</th>
                        <th className="p-3 text-right font-medium w-32">سبب الهالك</th>
                        <th className="p-3 text-right font-medium w-40">ملاحظات</th>
                        <th className="p-3 text-right font-medium w-20">صورة</th>
                        <th className="p-3 text-right font-medium w-20">القيمة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredDailyWasteEntries.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-muted-foreground">
                            {dailyWasteSearch ? "لا توجد نتائج للبحث" : "لا توجد أصناف مستلمة لهذا اليوم"}
                          </td>
                        </tr>
                      ) : (
                        filteredDailyWasteEntries.map((entry, idx) => (
                          <tr key={entry.productId} className={`hover:bg-muted/30 ${!entry.isFromReceipt ? 'bg-yellow-50/50' : ''} ${entry.wasteQuantity > 0 ? 'bg-red-50/30' : ''}`}>
                            <td className="p-2 text-muted-foreground text-center">{idx + 1}</td>
                            <td className="p-2">
                              <div className="font-medium">{entry.productName}</div>
                              {!entry.isFromReceipt && (
                                <Badge variant="outline" className="text-[10px] bg-yellow-100 text-yellow-700 mt-1">مضاف يدوياً</Badge>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              <Badge variant="secondary">{entry.receivedQuantity}</Badge>
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min="0"
                                max={entry.receivedQuantity || 9999}
                                value={entry.wasteQuantity || ""}
                                onChange={(e) => handleWasteEntryChange(entry.productId, "wasteQuantity", parseInt(e.target.value) || 0)}
                                className="w-20 h-8 text-center"
                                placeholder="0"
                                data-testid={`input-waste-qty-${entry.productId}`}
                                disabled={savedReportStatus === "submitted" || savedReportStatus === "approved"}
                              />
                            </td>
                            <td className="p-2 text-center">
                              {(() => {
                                const remaining = entry.receivedQuantity - entry.wasteQuantity;
                                return (
                                  <Badge 
                                    className={remaining > 0 ? "bg-green-100 text-green-700" : remaining === 0 && entry.wasteQuantity > 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}
                                    data-testid={`remaining-${entry.productId}`}
                                  >
                                    {remaining}
                                  </Badge>
                                );
                              })()}
                            </td>
                            <td className="p-2">
                              <Select
                                value={entry.wasteReason}
                                onValueChange={(val) => handleWasteEntryChange(entry.productId, "wasteReason", val)}
                                disabled={savedReportStatus === "submitted" || savedReportStatus === "approved"}
                              >
                                <SelectTrigger className="h-11 sm:h-10 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-60 overflow-y-auto">
                                  {WASTE_REASONS.map(r => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Input
                                value={entry.reasonDetails}
                                onChange={(e) => handleWasteEntryChange(entry.productId, "reasonDetails", e.target.value)}
                                className="h-8 text-xs"
                                placeholder="تفاصيل..."
                                disabled={savedReportStatus === "submitted" || savedReportStatus === "approved"}
                              />
                            </td>
                            <td className="p-2 text-center">
                              {entry.imageUrl ? (
                                <div className="relative inline-block">
                                  <img src={entry.imageUrl} alt="صورة" className="w-10 h-10 object-cover rounded cursor-pointer" onClick={() => window.open(entry.imageUrl, '_blank')} />
                                  {savedReportStatus !== "submitted" && savedReportStatus !== "approved" && (
                                  <button
                                    className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                                    onClick={() => handleWasteEntryChange(entry.productId, "imageUrl", "")}
                                  >
                                    ×
                                  </button>
                                  )}
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  disabled={savedReportStatus === "submitted" || savedReportStatus === "approved"}
                                  onClick={() => {
                                    setWasteImageInputRef(entry.productId);
                                    wasteFileInputRef.current?.click();
                                  }}
                                >
                                  <Camera className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              )}
                            </td>
                            <td className="p-2 text-center">
                              {entry.wasteQuantity > 0 && (
                                <span className="font-medium text-red-600 text-xs">
                                  {(entry.wasteQuantity * entry.unitPrice).toLocaleString()}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {wasteEntriesWithQuantity.length > 0 && (
                      <tfoot className="bg-red-50">
                        <tr>
                          <td colSpan={3} className="p-3 font-bold text-red-700">إجمالي الهالك</td>
                          <td className="p-3 text-center">
                            <Badge className="bg-red-100 text-red-700">{wasteEntriesWithQuantity.reduce((s, e) => s + e.wasteQuantity, 0)}</Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Badge className="bg-green-100 text-green-700">
                              {dailyWasteEntries.reduce((s, e) => s + (e.receivedQuantity - e.wasteQuantity), 0)}
                            </Badge>
                          </td>
                          <td colSpan={3}></td>
                          <td className="p-3 text-center font-bold text-red-700">{totalWasteValue.toLocaleString()} ر.س</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>

            {savedReportId && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">حالة التقرير:</span>
                        {getStatusBadge(savedReportStatus)}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>مسودة</span>
                        <span>←</span>
                        <span className={savedReportStatus === "submitted" || savedReportStatus === "approved" ? "text-blue-600 font-medium" : ""}>مرسل</span>
                        <span>←</span>
                        <span className={savedReportStatus === "approved" ? "text-green-600 font-medium" : ""}>معتمد</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {savedReportStatus === "draft" && (
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1"
                          onClick={() => submitForApprovalMutation.mutate(savedReportId)}
                          disabled={submitForApprovalMutation.isPending}
                          data-testid="btn-submit-approval"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {submitForApprovalMutation.isPending ? "جاري الإرسال..." : "إرسال للاعتماد"}
                        </Button>
                      )}
                      {savedReportStatus === "submitted" && canApproveWaste && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            className="gap-1 bg-green-600 hover:bg-green-700"
                            onClick={() => approveReportMutation.mutate({ id: savedReportId, status: "approved" })}
                            disabled={approveReportMutation.isPending}
                            data-testid="btn-approve-report"
                          >
                            <Check className="w-4 h-4" />
                            اعتماد
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1"
                            onClick={() => approveReportMutation.mutate({ id: savedReportId, status: "rejected" })}
                            disabled={approveReportMutation.isPending}
                            data-testid="btn-reject-report"
                          >
                            <X className="w-4 h-4" />
                            رفض
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          const report = wasteReports.find((r: WasteReport) => r.id === savedReportId);
                          if (report) handleViewReport(report);
                        }}
                        data-testid="btn-view-saved-report"
                      >
                        <Eye className="w-4 h-4" />
                        عرض التقرير
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between items-center">
              <ExportButtons
                data={wasteEntriesWithQuantity.map((e, i) => ({
                  index: i + 1,
                  productName: e.productName,
                  receivedQuantity: e.receivedQuantity,
                  wasteQuantity: e.wasteQuantity,
                  remaining: e.receivedQuantity - e.wasteQuantity,
                  wasteReasonLabel: WASTE_REASONS.find(r => r.value === e.wasteReason)?.label || e.wasteReason,
                  reasonDetails: e.reasonDetails,
                  totalValue: (e.wasteQuantity * e.unitPrice).toLocaleString(),
                }))}
                columns={[
                  { header: "#", key: "index", width: 5 },
                  { header: "الصنف", key: "productName", width: 25 },
                  { header: "الكمية المستلمة", key: "receivedQuantity", width: 12 },
                  { header: "كمية الهالك", key: "wasteQuantity", width: 12 },
                  { header: "المتبقي", key: "remaining", width: 10 },
                  { header: "السبب", key: "wasteReasonLabel", width: 15 },
                  { header: "ملاحظات", key: "reasonDetails", width: 20 },
                  { header: "القيمة", key: "totalValue", width: 12 },
                ]}
                fileName={`تقرير_الهالك_${selectedDate}`}
                title="تقرير الهالك اليومي"
                subtitle={`الفرع: ${getBranchName(wasteBranch)} - التاريخ: ${new Date(selectedDate).toLocaleDateString("en-GB")} - الوردية: ${SHIFT_OPTIONS.find(s => s.value === wasteShift)?.label || wasteShift}`}
                headerInfo={[
                  { label: "الفرع", value: getBranchName(wasteBranch) },
                  { label: "التاريخ", value: new Date(selectedDate).toLocaleDateString("en-GB") },
                  { label: "الوردية", value: SHIFT_OPTIONS.find(s => s.value === wasteShift)?.label || wasteShift },
                  { label: "عدد الأصناف الهالكة", value: `${totalWasteItems}` },
                  { label: "إجمالي القيمة", value: `${totalWasteValue.toLocaleString()} ر.س` },
                ]}
                disabled={wasteEntriesWithQuantity.length === 0}
              />
              <Button 
                onClick={() => saveDailyWasteReportMutation.mutate()}
                disabled={saveDailyWasteReportMutation.isPending || !wasteBranch || wasteEntriesWithQuantity.length === 0 || savedReportStatus === "submitted" || savedReportStatus === "approved"}
                className="gap-2"
                data-testid="btn-save-waste-report"
              >
                {saveDailyWasteReportMutation.isPending ? (
                  <>جاري الحفظ...</>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    حفظ تقرير الهالك
                  </>
                )}
              </Button>
            </div>

            <Dialog open={showAddUnlistedProduct} onOpenChange={setShowAddUnlistedProduct}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    إضافة صنف هالك غير مستلم
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    يمكنك إضافة صنف تالف لم يكن ضمن الأصناف المستلمة من الإنتاج اليوم
                  </p>
                  <div>
                    <Label>اختر المنتج</Label>
                    <ProductSelector
                      products={products.filter(p => !dailyWasteEntries.some(e => e.productId === p.id))}
                      value={unlistedProductId}
                      onSelect={(id) => setUnlistedProductId(id)}
                      placeholder="ابحث عن المنتج..."
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={addUnlistedProduct} disabled={!unlistedProductId} className="flex-1 h-11 sm:h-9">
                      إضافة الصنف
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddUnlistedProduct(false)}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </>
            )}

          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    سجل تقارير الهالك
                  </span>
                  <div className="flex items-center gap-2">
                    <Link href={`/production-reports?branchId=${historyBranch !== "all" ? historyBranch : ""}&dateFrom=${historyDateFrom}&dateTo=${historyDateTo}`}>
                      <Button variant="outline" size="sm" className="gap-1 h-9" data-testid="link-production-reports">
                        <ExternalLink className="w-4 h-4" />
                        عرض في تقارير التشغيل
                      </Button>
                    </Link>
                  <ExportButtons
                    data={historyExportData}
                    columns={historyExportColumns}
                    fileName={`سجل_الهالك_${historyDateFrom}_${historyDateTo}`}
                    title="سجل تقارير الهالك"
                    subtitle={`من ${historyDateFrom} إلى ${historyDateTo}`}
                    disabled={wasteHistory.length === 0}
                  />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <div className="flex items-center gap-1">
                    <Label className="text-xs whitespace-nowrap">من:</Label>
                    <Input
                      type="date"
                      value={historyDateFrom}
                      onChange={(e) => { setHistoryDateFrom(e.target.value); setHistoryPage(1); }}
                      className="w-36 h-9"
                      data-testid="input-history-date-from"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs whitespace-nowrap">إلى:</Label>
                    <Input
                      type="date"
                      value={historyDateTo}
                      onChange={(e) => { setHistoryDateTo(e.target.value); setHistoryPage(1); }}
                      className="w-36 h-9"
                      data-testid="input-history-date-to"
                    />
                  </div>
                  <Select value={historyBranch} onValueChange={(v) => { setHistoryBranch(v); setHistoryPage(1); }}>
                    <SelectTrigger className="w-36 h-9" data-testid="select-history-branch">
                      <Building2 className="w-4 h-4 ml-1" />
                      <SelectValue placeholder="الفرع" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={historyStatus} onValueChange={(v) => { setHistoryStatus(v); setHistoryPage(1); }}>
                    <SelectTrigger className="w-32 h-9" data-testid="select-history-status">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="draft">مسودة</SelectItem>
                      <SelectItem value="submitted">مرسل</SelectItem>
                      <SelectItem value="approved">معتمد</SelectItem>
                      <SelectItem value="rejected">مرفوض</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary" className="text-xs">{wasteHistory.length} تقرير</Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-right font-medium">التاريخ</th>
                        <th className="p-3 text-right font-medium">الفرع</th>
                        <th className="p-3 text-right font-medium">الوردية</th>
                        <th className="p-3 text-right font-medium">عدد الأصناف</th>
                        <th className="p-3 text-right font-medium">إجمالي القيمة</th>
                        <th className="p-3 text-right font-medium">الحالة</th>
                        <th className="p-3 text-right font-medium">المسجل</th>
                        <th className="p-3 text-right font-medium">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedHistory.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-muted-foreground">
                            لا توجد تقارير هالك في الفترة المحددة
                          </td>
                        </tr>
                      ) : (
                        paginatedHistory.map((report: any) => (
                          <React.Fragment key={report.id}>
                            <tr className="hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedReportId(expandedReportId === report.id ? null : report.id)} data-testid={`row-history-report-${report.id}`}>
                              <td className="p-3">{report.reportDate}</td>
                              <td className="p-3">
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <Building2 className="w-3 h-3" />
                                  {getBranchName(report.branchId)}
                                </Badge>
                              </td>
                              <td className="p-3 text-xs">
                                {SHIFT_OPTIONS.find(s => s.value === report.shiftName)?.label || report.shiftName || "-"}
                              </td>
                              <td className="p-3">
                                <Badge variant="outline">{report.totalItems}</Badge>
                              </td>
                              <td className="p-3 font-medium text-red-600">
                                {(report.totalValue || 0).toLocaleString()} ر.س
                              </td>
                              <td className="p-3">{getStatusBadge(report.status)}</td>
                              <td className="p-3 text-xs">{report.reporterName || "-"}</td>
                              <td className="p-3">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => { e.stopPropagation(); handleViewReport(report); }}
                                    data-testid={`btn-view-history-${report.id}`}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  {report.status === "draft" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs"
                                      onClick={(e) => { e.stopPropagation(); approveReportMutation.mutate({ id: report.id, status: "submitted" }); }}
                                      data-testid={`btn-submit-history-${report.id}`}
                                    >
                                      إرسال
                                    </Button>
                                  )}
                                  {report.status === "submitted" && canApproveWaste && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="text-xs bg-green-600 hover:bg-green-700"
                                        onClick={(e) => { e.stopPropagation(); approveReportMutation.mutate({ id: report.id, status: "approved" }); }}
                                        data-testid={`btn-approve-history-${report.id}`}
                                      >
                                        اعتماد
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="text-xs"
                                        onClick={(e) => { e.stopPropagation(); approveReportMutation.mutate({ id: report.id, status: "rejected" }); }}
                                        data-testid={`btn-reject-history-${report.id}`}
                                      >
                                        رفض
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {expandedReportId === report.id && report.items && (
                              <tr>
                                <td colSpan={8} className="p-0">
                                  <div className="bg-muted/20 p-4 border-t border-b">
                                    <div className="text-sm font-medium mb-2 flex items-center gap-2">
                                      <Package className="w-4 h-4" />
                                      أصناف التقرير ({report.items.length})
                                    </div>
                                    {report.items.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">لا توجد أصناف</p>
                                    ) : (
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-muted/40">
                                            <th className="p-2 text-right">#</th>
                                            <th className="p-2 text-right">الصنف</th>
                                            <th className="p-2 text-right">الكمية</th>
                                            <th className="p-2 text-right">سعر الوحدة</th>
                                            <th className="p-2 text-right">الإجمالي</th>
                                            <th className="p-2 text-right">السبب</th>
                                            <th className="p-2 text-right">ملاحظات</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {report.items.map((item: any, idx: number) => (
                                            <tr key={item.id}>
                                              <td className="p-2">{idx + 1}</td>
                                              <td className="p-2 font-medium">{getProductName(item.productId)}</td>
                                              <td className="p-2">{item.quantity}</td>
                                              <td className="p-2">{(item.unitPrice || 0).toLocaleString()} ر.س</td>
                                              <td className="p-2 text-red-600">{(item.totalValue || 0).toLocaleString()} ر.س</td>
                                              <td className="p-2">{WASTE_REASONS.find(r => r.value === item.wasteReason)?.label || item.wasteReason}</td>
                                              <td className="p-2">{item.reasonDetails || "-"}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                    {report.status === "approved" && report.approvedAt && (
                                      <div className="mt-2 text-xs text-green-700 bg-green-50 p-2 rounded">
                                        تم الاعتماد بتاريخ: {new Date(report.approvedAt).toLocaleDateString('en-GB')}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {wasteHistory.length > itemsPerPage && (
                  <div className="p-3 border-t">
                    <TablePagination
                      currentPage={historyPage}
                      totalItems={wasteHistory.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setHistoryPage}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comparison" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-right">
                  <BarChart3 className="w-5 h-5" />
                  مقارنة الإنتاج بالمبيعات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-right block mb-1">من تاريخ</Label>
                    <Input
                      type="date"
                      value={comparisonStartDate}
                      onChange={(e) => setComparisonStartDate(e.target.value)}
                      data-testid="input-comparison-start-date"
                    />
                  </div>
                  <div>
                    <Label className="text-right block mb-1">إلى تاريخ</Label>
                    <Input
                      type="date"
                      value={comparisonEndDate}
                      onChange={(e) => setComparisonEndDate(e.target.value)}
                      data-testid="input-comparison-end-date"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      onClick={() => comparisonFileRef.current?.click()}
                      disabled={isUploading || !selectedBranch || selectedBranch === "all"}
                      variant="outline"
                      data-testid="button-upload-sales"
                    >
                      <Upload className="w-4 h-4 ml-2" />
                      {isUploading ? "جاري الرفع..." : "رفع بيانات المبيعات"}
                    </Button>
                    <input
                      ref={comparisonFileRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleSalesUpload}
                      className="hidden"
                      data-testid="input-sales-file"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      onClick={handleRunComparison}
                      disabled={isRunningComparison || !selectedBranch || selectedBranch === "all"}
                      data-testid="button-run-comparison"
                    >
                      <Calculator className="w-4 h-4 ml-2" />
                      {isRunningComparison ? "جاري المقارنة..." : "تشغيل المقارنة"}
                    </Button>
                  </div>
                </div>

                {(!selectedBranch || selectedBranch === "all") && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-right">
                    <p className="text-amber-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      يرجى اختيار فرع محدد لإجراء المقارنة
                    </p>
                  </div>
                )}

                {uploadResult && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-right" data-testid="upload-result">
                    <p className="text-green-700 font-medium">تم رفع بيانات المبيعات بنجاح</p>
                    <p className="text-green-600 text-sm mt-1">
                      {uploadResult.recordsImported} سجل مستورد | {uploadResult.uniqueProducts} منتج فريد
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {comparisonSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-total-produced">
                  <CardContent className="p-4 text-right">
                    <p className="text-sm text-muted-foreground">إجمالي الإنتاج</p>
                    <p className="text-2xl font-bold text-blue-600">{(comparisonSummary.totalProduced || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-total-sold">
                  <CardContent className="p-4 text-right">
                    <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                    <p className="text-2xl font-bold text-green-600">{(comparisonSummary.totalSold || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-total-waste">
                  <CardContent className="p-4 text-right">
                    <p className="text-sm text-muted-foreground">إجمالي الهدر</p>
                    <p className="text-2xl font-bold text-red-600">{(comparisonSummary.totalWaste || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-total-shortage">
                  <CardContent className="p-4 text-right">
                    <p className="text-sm text-muted-foreground">إجمالي العجز</p>
                    <p className="text-2xl font-bold text-orange-600">{(comparisonSummary.totalShortage || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-right">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    نتائج المقارنة
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportComparison}
                    disabled={!comparisons || !Array.isArray(comparisons) || comparisons.length === 0}
                    data-testid="button-export-comparison"
                  >
                    <FileDown className="w-4 h-4 ml-2" />
                    تصدير Excel
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!comparisons || !Array.isArray(comparisons) || comparisons.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>لا توجد نتائج مقارنة</p>
                    <p className="text-sm mt-1">قم برفع بيانات المبيعات ثم تشغيل المقارنة</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse" data-testid="table-comparison-results">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="p-3 border font-medium">المنتج</th>
                          <th className="p-3 border font-medium">الفئة</th>
                          <th className="p-3 border font-medium">الكمية المنتجة</th>
                          <th className="p-3 border font-medium">الكمية المباعة</th>
                          <th className="p-3 border font-medium">الفرق</th>
                          <th className="p-3 border font-medium">قيمة الإنتاج</th>
                          <th className="p-3 border font-medium">قيمة المبيعات</th>
                          <th className="p-3 border font-medium">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisons.map((item: any, index: number) => {
                          const diff = item.difference || 0;
                          const diffColor = diff === 0 ? "text-green-600" : diff > 0 ? "text-red-600" : "text-orange-600";
                          const statusMap: Record<string, { label: string; className: string }> = {
                            normal: { label: "طبيعي", className: "bg-green-100 text-green-700" },
                            waste: { label: "هدر", className: "bg-red-100 text-red-700" },
                            shortage: { label: "عجز", className: "bg-orange-100 text-orange-700" },
                            stored: { label: "مخزون", className: "bg-blue-100 text-blue-700" },
                          };
                          const status = statusMap[item.status] || statusMap.normal;
                          return (
                            <tr key={item.id || index} className="hover:bg-muted/30" data-testid={`row-comparison-${index}`}>
                              <td className="p-3 border font-medium">{item.productName || "-"}</td>
                              <td className="p-3 border">{item.productCategory || "-"}</td>
                              <td className="p-3 border">{(item.producedQuantity || 0).toLocaleString()}</td>
                              <td className="p-3 border">{(item.soldQuantity || 0).toLocaleString()}</td>
                              <td className={`p-3 border font-bold ${diffColor}`}>{diff > 0 ? `+${diff}` : diff}</td>
                              <td className="p-3 border">{(item.productionValue || 0).toLocaleString()} ر.س</td>
                              <td className="p-3 border">{(item.salesValue || 0).toLocaleString()} ر.س</td>
                              <td className="p-3 border">
                                <Badge className={status.className} data-testid={`badge-status-${index}`}>{status.label}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detailed Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            {/* Filter Bar */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs mb-1 block">الفرع</Label>
                    <Select value={analyticsBranch} onValueChange={setAnalyticsBranch}>
                      <SelectTrigger data-testid="select-analytics-branch">
                        <SelectValue placeholder="جميع الفروع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفروع</SelectItem>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">من تاريخ</Label>
                    <Input type="date" value={analyticsDateFrom} onChange={e => setAnalyticsDateFrom(e.target.value)} data-testid="input-analytics-date-from" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">إلى تاريخ</Label>
                    <Input type="date" value={analyticsDateTo} onChange={e => setAnalyticsDateTo(e.target.value)} data-testid="input-analytics-date-to" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">الفئة</Label>
                    <Select value={analyticsCategory} onValueChange={setAnalyticsCategory}>
                      <SelectTrigger data-testid="select-analytics-category">
                        <SelectValue placeholder="جميع الفئات" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفئات</SelectItem>
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {isLoadingAnalytics ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="mr-2 text-muted-foreground">جاري تحميل التقارير...</span>
              </div>
            ) : !detailedAnalytics ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <TrendingDown className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">لا توجد بيانات للفترة المحددة</p>
                  <p className="text-sm mt-1">حاول تغيير الفلاتر أو توسيع نطاق التاريخ</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-xs text-muted-foreground mb-1">إجمالي قيمة الهالك</div>
                      <div className="text-2xl font-bold text-red-600" data-testid="kpi-total-value">
                        {(detailedAnalytics.summary?.totalValue || 0).toLocaleString()} ر.س
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-xs text-muted-foreground mb-1">إجمالي الكمية</div>
                      <div className="text-2xl font-bold text-amber-600" data-testid="kpi-total-quantity">
                        {(detailedAnalytics.summary?.totalQuantity || 0).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-xs text-muted-foreground mb-1">متوسط الهدر اليومي</div>
                      <div className="text-2xl font-bold text-orange-600" data-testid="kpi-avg-daily">
                        {(detailedAnalytics.summary?.avgWastePerDay || 0).toLocaleString()} ر.س
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-xs text-muted-foreground mb-1">عدد التقارير</div>
                      <div className="text-2xl font-bold text-blue-600" data-testid="kpi-report-count">
                        {(detailedAnalytics.summary?.reportCount || 0).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Trend Chart */}
                {detailedAnalytics.byDate && detailedAnalytics.byDate.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">اتجاه الهالك اليومي</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]" data-testid="chart-daily-trend">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={detailedAnalytics.byDate}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(value: number) => [`${value.toLocaleString()} ر.س`, "قيمة الهالك"]} />
                            <Bar dataKey="totalValue" fill="#dc2626" radius={[4, 4, 0, 0]} name="قيمة الهالك" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Top 10 Most Wasted Products */}
                {detailedAnalytics.topDamaged && detailedAnalytics.topDamaged.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">أكثر 10 أصناف هدراً</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse text-sm" data-testid="table-top-products">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="p-3 border font-medium">#</th>
                              <th className="p-3 border font-medium">الصنف</th>
                              <th className="p-3 border font-medium">الفئة</th>
                              <th className="p-3 border font-medium">الكمية</th>
                              <th className="p-3 border font-medium">القيمة</th>
                              <th className="p-3 border font-medium">مرات التكرار</th>
                              <th className="p-3 border font-medium">آخر تاريخ</th>
                              <th className="p-3 border font-medium">السبب الرئيسي</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailedAnalytics.topDamaged.map((item: any, index: number) => (
                              <tr key={index} className="hover:bg-muted/30" data-testid={`row-top-product-${index}`}>
                                <td className="p-3 border">{index + 1}</td>
                                <td className="p-3 border font-medium">
                                  <button
                                    className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                                    onClick={() => openProductDetail(item.productId)}
                                    data-testid={`btn-product-detail-${item.productId}`}
                                  >
                                    {item.productName || "-"}
                                  </button>
                                </td>
                                <td className="p-3 border">
                                  <Badge variant="outline">{CATEGORY_LABELS[item.category] || item.category || "-"}</Badge>
                                </td>
                                <td className="p-3 border">{(item.totalQuantity || 0).toLocaleString()}</td>
                                <td className="p-3 border text-red-600 font-medium">{(item.totalValue || 0).toLocaleString()} ر.س</td>
                                <td className="p-3 border">{item.occurrences || 0}</td>
                                <td className="p-3 border">{item.lastWasteDate || "-"}</td>
                                <td className="p-3 border">
                                  {item.topReasonLabel || WASTE_REASONS.find(r => r.value === item.topReason)?.label || item.topReason || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recurring Waste Patterns */}
                {detailedAnalytics.recurring && detailedAnalytics.recurring.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        أنماط الهدر المتكررة
                        <Badge className="bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3 ml-1" />
                          {detailedAnalytics.recurring.length} صنف متكرر
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse text-sm" data-testid="table-recurring-waste">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="p-3 border font-medium">الصنف</th>
                              <th className="p-3 border font-medium">الفئة</th>
                              <th className="p-3 border font-medium">عدد المرات</th>
                              <th className="p-3 border font-medium">الكمية الإجمالية</th>
                              <th className="p-3 border font-medium">القيمة الإجمالية</th>
                              <th className="p-3 border font-medium">السبب الرئيسي</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailedAnalytics.recurring.map((item: any, index: number) => (
                              <tr key={index} className="hover:bg-muted/30" data-testid={`row-recurring-${index}`}>
                                <td className="p-3 border font-medium">
                                  <button
                                    className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                                    onClick={() => openProductDetail(item.productId)}
                                    data-testid={`btn-recurring-detail-${item.productId}`}
                                  >
                                    {item.productName || "-"}
                                  </button>
                                </td>
                                <td className="p-3 border">
                                  <Badge variant="outline">{CATEGORY_LABELS[item.category] || item.category || "-"}</Badge>
                                </td>
                                <td className="p-3 border">
                                  <Badge className="bg-red-100 text-red-700">{item.occurrences}</Badge>
                                </td>
                                <td className="p-3 border">{(item.totalQuantity || 0).toLocaleString()}</td>
                                <td className="p-3 border text-red-600 font-medium">{(item.totalValue || 0).toLocaleString()} ر.س</td>
                                <td className="p-3 border">
                                  {item.topReasonLabel || WASTE_REASONS.find(r => r.value === item.topReason)?.label || item.topReason || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Category Breakdown & Reason Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category Breakdown */}
                  {detailedAnalytics.byCategory && detailedAnalytics.byCategory.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">توزيع الهالك حسب الفئة</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {detailedAnalytics.byCategory.map((data: any) => (
                            <div key={data.category} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg" data-testid={`category-${data.category}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[data.category] || "bg-gray-400"}`} />
                                <span className="font-medium">{data.categoryLabel || CATEGORY_LABELS[data.category] || data.category}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span>{(data.totalQuantity || 0).toLocaleString()} قطعة</span>
                                <span className="text-red-600 font-medium">{(data.totalValue || 0).toLocaleString()} ر.س</span>
                                <Badge variant="outline">{data.percentage || 0}%</Badge>
                              </div>
                            </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Reason Breakdown */}
                  {detailedAnalytics.byReason && detailedAnalytics.byReason.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">توزيع الهالك حسب السبب</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {detailedAnalytics.byReason.map((data: any) => (
                            <div key={data.reason} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg" data-testid={`reason-${data.reason}`}>
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${REASON_COLORS[data.reason] || "bg-gray-400"}`} />
                                <span className="font-medium">{data.reasonLabel || WASTE_REASONS.find(r => r.value === data.reason)?.label || data.reason}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span>{(data.totalQuantity || 0).toLocaleString()} قطعة</span>
                                <span className="text-red-600 font-medium">{(data.totalValue || 0).toLocaleString()} ر.س</span>
                                <Badge variant="outline">{data.percentage || 0}%</Badge>
                              </div>
                            </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Branch Comparison */}
                {analyticsBranch === "all" && detailedAnalytics.byBranch && detailedAnalytics.byBranch.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">مقارنة الفروع</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse text-sm" data-testid="table-branch-comparison">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="p-3 border font-medium">الفرع</th>
                              <th className="p-3 border font-medium">الكمية</th>
                              <th className="p-3 border font-medium">القيمة</th>
                              <th className="p-3 border font-medium">عدد التقارير</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailedAnalytics.byBranch.map((data: any, index: number) => (
                              <tr key={data.branchId} className="hover:bg-muted/30" data-testid={`row-branch-${index}`}>
                                <td className="p-3 border font-medium">{data.branchName || getBranchName(data.branchId)}</td>
                                <td className="p-3 border">{(data.totalQuantity || 0).toLocaleString()}</td>
                                <td className="p-3 border text-red-600 font-medium">{(data.totalValue || 0).toLocaleString()} ر.س</td>
                                <td className="p-3 border">{data.reportCount || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Export Button */}
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      if (!detailedAnalytics) return;
                      const exportData = (detailedAnalytics.topDamaged || []).map((item: any, index: number) => ({
                        rowNum: index + 1,
                        productName: item.productName || "-",
                        category: item.categoryLabel || CATEGORY_LABELS[item.category] || item.category || "-",
                        quantity: item.totalQuantity || 0,
                        value: item.totalValue || 0,
                        frequency: item.occurrences || 0,
                        lastDate: item.lastWasteDate || "-",
                        mainReason: item.topReasonLabel || WASTE_REASONS.find(r => r.value === item.topReason)?.label || item.topReason || "-",
                      }));
                      const columns = [
                        { header: "#", key: "rowNum", width: 5 },
                        { header: "الصنف", key: "productName", width: 25 },
                        { header: "الفئة", key: "category", width: 15 },
                        { header: "الكمية", key: "quantity", width: 10 },
                        { header: "القيمة", key: "value", width: 15 },
                        { header: "مرات التكرار", key: "frequency", width: 12 },
                        { header: "آخر تاريخ", key: "lastDate", width: 12 },
                        { header: "السبب الرئيسي", key: "mainReason", width: 15 },
                      ];
                      const headerInfo = [
                        { label: "الفترة", value: `${analyticsDateFrom} - ${analyticsDateTo}` },
                        { label: "الفرع", value: analyticsBranch === "all" ? "جميع الفروع" : getBranchName(analyticsBranch) },
                        { label: "إجمالي الهالك", value: `${(detailedAnalytics.summary?.totalValue || 0).toLocaleString()} ر.س` },
                        { label: "عدد التقارير", value: String(detailedAnalytics.summary?.reportCount || 0) },
                      ];
                      exportToExcel(exportData, columns, `تقرير_تفصيلي_${analyticsDateFrom}_${analyticsDateTo}`, "التقرير التفصيلي", headerInfo);
                      toast({ title: "تم تصدير التقرير بنجاح" });
                    }}
                    className="gap-2"
                    data-testid="btn-export-analytics"
                  >
                    <FileDown className="w-4 h-4" />
                    تصدير التقرير
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Report Details Dialog */}
      <Dialog open={showReportDetailsDialog} onOpenChange={(open) => !open && handleCloseReportDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                تفاصيل تقرير الهالك
              </span>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleExportReportToExcel}
                  disabled={!isItemsReady}
                >
                  <FileDown className="w-4 h-4 ml-2" />
                  {isFetchingItems ? "جاري التحميل..." : "Excel"}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handlePrintReport}
                  disabled={!isItemsReady}
                >
                  <Printer className="w-4 h-4 ml-2" />
                  {isFetchingItems ? "جاري التحميل..." : "طباعة"}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div ref={reportPrintRef}>
            <div className="header text-center mb-6">
              <h1 className="text-2xl font-bold text-[#D4A574]">BUTTER BAKERY</h1>
              <p className="text-lg font-medium">تقرير الهالك اليومي</p>
            </div>

            {viewingReport && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="info-row">
                    <span className="text-muted-foreground">التاريخ:</span>
                    <span className="font-medium mr-2">{viewingReport.reportDate}</span>
                  </div>
                  <div className="info-row">
                    <span className="text-muted-foreground">الفرع:</span>
                    <span className="font-medium mr-2">{getBranchName(viewingReport.branchId)}</span>
                  </div>
                  <div className="info-row">
                    <span className="text-muted-foreground">الحالة:</span>
                    <span className="mr-2">{getStatusBadge(viewingReport.status)}</span>
                  </div>
                  <div className="info-row">
                    <span className="text-muted-foreground">المسجل:</span>
                    <span className="font-medium mr-2">{viewingReport.reporterName || "-"}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-3 text-right font-medium border">#</th>
                        <th className="p-3 text-right font-medium border">الصنف</th>
                        <th className="p-3 text-right font-medium border">الكمية</th>
                        <th className="p-3 text-right font-medium border">سعر الوحدة</th>
                        <th className="p-3 text-right font-medium border">الإجمالي</th>
                        <th className="p-3 text-right font-medium border">سبب الهالك</th>
                        <th className="p-3 text-right font-medium border">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {isFetchingItems ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground border">
                            <div className="flex items-center justify-center gap-2">
                              <RefreshCw className="w-5 h-5 animate-spin" />
                              جاري تحميل الأصناف...
                            </div>
                          </td>
                        </tr>
                      ) : viewingReportItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-muted-foreground border">
                            لا توجد أصناف في هذا التقرير
                          </td>
                        </tr>
                      ) : (
                        viewingReportItems.map((item, index) => (
                          <tr key={item.id} className="hover:bg-muted/30">
                            <td className="p-3 border">{index + 1}</td>
                            <td className="p-3 border">{getProductName(item.productId)}</td>
                            <td className="p-3 border text-center">{item.quantity}</td>
                            <td className="p-3 border">{(item.unitPrice || 0).toLocaleString()} ر.س</td>
                            <td className="p-3 border font-medium">{(item.totalValue || 0).toLocaleString()} ر.س</td>
                            <td className="p-3 border">
                              {WASTE_REASONS.find(r => r.value === item.wasteReason)?.label || item.wasteReason}
                            </td>
                            <td className="p-3 border">{item.reasonDetails || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="total-row bg-amber-50 font-bold">
                        <td colSpan={4} className="p-3 border text-left">الإجمالي</td>
                        <td className="p-3 border text-red-600">
                          {(viewingReport.totalValue || 0).toLocaleString()} ر.س
                        </td>
                        <td colSpan={2} className="p-3 border">
                          عدد الأصناف: {viewingReportItems.length}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {viewingReport.status === "approved" && viewingReport.approvedAt && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-700">
                      تم الاعتماد بتاريخ: {new Date(viewingReport.approvedAt).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showProductDetailDialog} onOpenChange={setShowProductDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              تفاصيل هالك الصنف
              {productWasteDetails?.product && (
                <Badge variant="outline" className="text-sm">
                  {productWasteDetails.product.categoryLabel}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {isLoadingProductDetails ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="mr-2 text-muted-foreground">جاري تحميل البيانات...</span>
            </div>
          ) : !productWasteDetails ? (
            <div className="text-center py-12 text-muted-foreground">
              لا توجد بيانات
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">معلومات الصنف</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">اسم الصنف:</span>
                      <span className="font-medium">{productWasteDetails.product.name}</span>
                    </div>
                    {productWasteDetails.product.nameEn && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الاسم بالإنجليزية:</span>
                        <span className="font-medium">{productWasteDetails.product.nameEn}</span>
                      </div>
                    )}
                    {productWasteDetails.product.sku && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">رمز المنتج:</span>
                        <span className="font-medium">{productWasteDetails.product.sku}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الفئة:</span>
                      <Badge variant="outline">{productWasteDetails.product.categoryLabel}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الوحدة:</span>
                      <span>{productWasteDetails.product.unit}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">السعر:</span>
                      <span className="font-medium">{(productWasteDetails.product.basePrice || 0).toLocaleString()} ر.س</span>
                    </div>
                    {productWasteDetails.product.description && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الوصف:</span>
                        <span className="text-xs max-w-[200px] text-left">{productWasteDetails.product.description}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الحالة:</span>
                      <Badge className={productWasteDetails.product.isActive === "true" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {productWasteDetails.product.isActive === "true" ? "نشط" : "غير نشط"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">ملخص الهالك</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">إجمالي الكمية المهدرة:</span>
                      <span className="font-bold text-red-600">{(productWasteDetails.summary.totalQuantity || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">إجمالي قيمة الهالك:</span>
                      <span className="font-bold text-red-600">{(productWasteDetails.summary.totalValue || 0).toLocaleString()} ر.س</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">عدد مرات الهدر:</span>
                      <span className="font-medium">{productWasteDetails.summary.entryCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">متوسط الكمية لكل مرة:</span>
                      <span>{productWasteDetails.summary.avgQuantityPerEntry || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">السبب الرئيسي:</span>
                      <Badge className="bg-amber-100 text-amber-700">{productWasteDetails.summary.topReasonLabel || "-"}</Badge>
                    </div>
                    {productWasteDetails.summary.firstDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">أول تاريخ هدر:</span>
                        <span>{productWasteDetails.summary.firstDate}</span>
                      </div>
                    )}
                    {productWasteDetails.summary.lastDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">آخر تاريخ هدر:</span>
                        <span>{productWasteDetails.summary.lastDate}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {productWasteDetails.images && productWasteDetails.images.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      صور الهالك
                      <Badge variant="outline">{productWasteDetails.images.length} صورة</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-center bg-muted/30 rounded-lg p-4 min-h-[200px]">
                        <img
                          src={productWasteDetails.images[selectedImageIndex]}
                          alt={`صورة هالك ${selectedImageIndex + 1}`}
                          className="max-h-[300px] object-contain rounded-lg shadow-md"
                          data-testid="img-product-waste-main"
                        />
                      </div>
                      {productWasteDetails.images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {productWasteDetails.images.map((imgUrl: string, idx: number) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedImageIndex(idx)}
                              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                                idx === selectedImageIndex ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-400"
                              }`}
                              data-testid={`btn-image-thumb-${idx}`}
                            >
                              <img src={imgUrl} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {productWasteDetails.reasonBreakdown && productWasteDetails.reasonBreakdown.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">توزيع حسب السبب</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {productWasteDetails.reasonBreakdown.map((r: any) => (
                        <div key={r.reason} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${REASON_COLORS[r.reason] || "bg-gray-400"}`} />
                            <span className="text-sm font-medium">{r.reasonLabel}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span>{r.quantity} قطعة</span>
                            <Badge variant="outline">{r.percentage}%</Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {productWasteDetails.branchBreakdown && productWasteDetails.branchBreakdown.length > 1 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">توزيع حسب الفرع</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {productWasteDetails.branchBreakdown.map((b: any) => (
                          <div key={b.branchId} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                            <span className="text-sm font-medium">{b.branchName}</span>
                            <div className="flex items-center gap-3 text-sm">
                              <span>{b.quantity} قطعة</span>
                              <span className="text-red-600 font-medium">{(b.value || 0).toLocaleString()} ر.س</span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {productWasteDetails.entries && productWasteDetails.entries.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      سجل الهالك التفصيلي
                      <Badge variant="outline">{productWasteDetails.entries.length} سجل</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-sm" data-testid="table-product-waste-entries">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="p-2.5 border font-medium">التاريخ</th>
                            <th className="p-2.5 border font-medium">الفرع</th>
                            <th className="p-2.5 border font-medium">الكمية</th>
                            <th className="p-2.5 border font-medium">سعر الوحدة</th>
                            <th className="p-2.5 border font-medium">القيمة</th>
                            <th className="p-2.5 border font-medium">السبب</th>
                            <th className="p-2.5 border font-medium">التفاصيل</th>
                            <th className="p-2.5 border font-medium">الحالة</th>
                            <th className="p-2.5 border font-medium">صورة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {productWasteDetails.entries.map((entry: any, idx: number) => (
                            <tr key={idx} className="hover:bg-muted/30" data-testid={`row-product-entry-${idx}`}>
                              <td className="p-2.5 border whitespace-nowrap">{entry.reportDate}</td>
                              <td className="p-2.5 border">{entry.branchName}</td>
                              <td className="p-2.5 border">{entry.quantity}</td>
                              <td className="p-2.5 border">{(entry.unitPrice || 0).toLocaleString()} ر.س</td>
                              <td className="p-2.5 border text-red-600 font-medium">{(entry.totalValue || 0).toLocaleString()} ر.س</td>
                              <td className="p-2.5 border">
                                <Badge variant="outline" className="text-xs">{entry.wasteReasonLabel}</Badge>
                              </td>
                              <td className="p-2.5 border text-xs max-w-[150px] truncate">{entry.reasonDetails || "-"}</td>
                              <td className="p-2.5 border">
                                <Badge className={
                                  entry.reportStatus === "approved" ? "bg-green-100 text-green-700" :
                                  entry.reportStatus === "submitted" ? "bg-blue-100 text-blue-700" :
                                  "bg-gray-100 text-gray-700"
                                }>
                                  {entry.reportStatus === "approved" ? "معتمد" :
                                   entry.reportStatus === "submitted" ? "مرسل" : "مسودة"}
                                </Badge>
                              </td>
                              <td className="p-2.5 border text-center">
                                {entry.imageUrl ? (
                                  <a href={entry.imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                                    عرض
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
