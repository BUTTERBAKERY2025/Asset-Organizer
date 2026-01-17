import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Send, Plus, Search, Filter, Clock, CheckCircle, Truck, 
  ArrowLeft, FileText, MapPin, User, Calendar, PenTool, Building2, Warehouse, Trash2, Package, Printer, Download, MessageCircle, FileSpreadsheet, MoreHorizontal, XCircle, Copy
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useReactToPrint } from "react-to-print";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad, SignatureDisplay } from "@/components/signature-pad";
import { ExportButtons } from "@/components/export-buttons";
import { useBranches } from "@/hooks/useBranches";
import { generateTransferPdf, generateQuickTransferPdf } from "@/lib/pdf-utils";

type MaterialTransfer = {
  id: number;
  transferNumber: string;
  requestId: number;
  sourceBranchId: string;
  sourceBranchName: string;
  destinationBranchId: string;
  destinationBranchName: string;
  status: string;
  transferDate: string;
  driverName: string;
  vehicleNumber: string;
  departureTime: string;
  arrivalTime: string;
  receivedBy: string;
  receivedByName: string;
  receiverSignature: string;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
};

type Branch = {
  id: string;
  name: string;
  nameAr: string;
};

type WarehouseItem = {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  isActive: boolean;
};

type TransferItem = {
  id: number;
  transferId: number;
  itemId: number;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  receivedQuantity: number | null;
  notes: string | null;
  availableQuantity?: number | null;
};

const STATUS_OPTIONS = [
  { value: "pending", labelAr: "قيد الانتظار", labelEn: "Pending", color: "bg-yellow-500", icon: Clock },
  { value: "approved", labelAr: "تمت الموافقة", labelEn: "Approved", color: "bg-emerald-500", icon: CheckCircle },
  { value: "rejected", labelAr: "مرفوض", labelEn: "Rejected", color: "bg-red-500", icon: Clock },
  { value: "in_transit", labelAr: "في الطريق", labelEn: "In Transit", color: "bg-blue-500", icon: Truck },
  { value: "delivered", labelAr: "تم التسليم", labelEn: "Delivered", color: "bg-green-500", icon: CheckCircle },
  { value: "cancelled", labelAr: "ملغي", labelEn: "Cancelled", color: "bg-gray-400", icon: Clock },
];

function getStatusBadge(status: string, isRTL: boolean) {
  const statusOption = STATUS_OPTIONS.find(s => s.value === status);
  if (!statusOption) return <Badge>{status}</Badge>;
  const Icon = statusOption.icon;
  return (
    <Badge className={`${statusOption.color} text-white flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {isRTL ? statusOption.labelAr : statusOption.labelEn}
    </Badge>
  );
}

export default function TransferRequestsPage() {
  const { t, i18n } = useTranslation("platform-home");
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { branches, userBranchId, canSelectBranch } = useBranches();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isUpdateStatusOpen, setIsUpdateStatusOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<MaterialTransfer | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [transferType, setTransferType] = useState<"to_warehouse" | "between_branches">("to_warehouse");
  const printRef = useRef<HTMLDivElement>(null);

  // Print functionality with portrait orientation
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedTransfer ? `Transfer-${selectedTransfer.transferNumber}` : "Transfer",
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 15mm;
      }
      @media print {
        body { -webkit-print-color-adjust: exact; }
      }
    `,
  });

  // Fetch transfer items when viewing details
  const { data: transferItems = [], isLoading: isLoadingItems } = useQuery<TransferItem[]>({
    queryKey: ["/api/warehouse/material-transfers", selectedTransfer?.id, "items"],
    queryFn: async () => {
      if (!selectedTransfer) return [];
      const response = await fetch(`/api/warehouse/material-transfers/${selectedTransfer.id}/items`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedTransfer && isViewOpen,
  });

  // For non-admins, source branch is always their own branch
  const userBranch = branches.find(b => b.id === userBranchId);
  const isMainWarehouse = userBranchId === "main_warehouse";

  const [newTransfer, setNewTransfer] = useState({
    sourceBranchId: userBranchId || "",
    sourceBranchName: "",
    destinationBranchId: "",
    destinationBranchName: "",
    notes: "",
    items: [] as { itemId: number; itemName: string; category: string; quantity: number; availableQuantity: number | null; unit: string; notes: string }[],
  });

  // Fetch warehouse items for selection
  const { data: warehouseItems = [] } = useQuery<WarehouseItem[]>({
    queryKey: ["/api/warehouse/items"],
    queryFn: async () => {
      const response = await fetch("/api/warehouse/items?isActive=true");
      if (!response.ok) throw new Error("Failed to fetch items");
      return response.json();
    },
  });

  // Add item to transfer
  const addTransferItem = () => {
    setNewTransfer(prev => ({
      ...prev,
      items: [...prev.items, { itemId: 0, itemName: "", category: "", quantity: 1, availableQuantity: null, unit: "كجم", notes: "" }],
    }));
  };

  // Remove item from transfer
  const removeTransferItem = (index: number) => {
    setNewTransfer(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Update item field
  const updateTransferItem = (index: number, field: string, value: string | number) => {
    setNewTransfer(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  // Initialize transfer form: source = warehouse, destination = user's branch
  // This models the correct flow: branch requests items FROM warehouse
  useEffect(() => {
    if (userBranchId && userBranch && !canSelectBranch) {
      // Non-admin: source = warehouse, destination = their branch
      setNewTransfer(prev => ({
        ...prev,
        sourceBranchId: "main_warehouse",
        sourceBranchName: isRTL ? "المستودع الرئيسي" : "Main Warehouse",
        destinationBranchId: userBranchId,
        destinationBranchName: userBranch.name,
      }));
    } else if (canSelectBranch) {
      // Admin - default source to warehouse, can select destination
      setNewTransfer(prev => ({
        ...prev,
        sourceBranchId: "main_warehouse",
        sourceBranchName: isRTL ? "المستودع الرئيسي" : "Main Warehouse",
      }));
    }
  }, [userBranchId, userBranch, canSelectBranch, isRTL]);

  const [statusUpdate, setStatusUpdate] = useState({
    status: "",
    notes: "",
    receiverSignature: null as string | null,
    // Dispatch fields (for in_transit status)
    driverName: "",
    vehicleNumber: "",
    transferDate: new Date().toISOString().split('T')[0],
  });

  const { data: transfers = [], isLoading } = useQuery<MaterialTransfer[]>({
    queryKey: ["/api/warehouse/material-transfers", filterStatus, userBranchId, canSelectBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      // For non-admin branch users, filter by their branch (as source or destination)
      // Admins (canSelectBranch=true) see all transfers
      if (userBranchId && !canSelectBranch) {
        params.append("branchId", userBranchId);
      }
      const response = await fetch(`/api/warehouse/material-transfers?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch transfers");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newTransfer) => {
      const destBranch = branches.find(b => b.id === data.destinationBranchId);
      const response = await apiRequest("POST", "/api/warehouse/material-transfers", {
        ...data,
        destinationBranchName: destBranch?.name || "",
        status: "pending",
        transferDate: new Date().toISOString().split('T')[0], // Set request date
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/material-transfers"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: isRTL ? "تم إنشاء أمر التحويل بنجاح" : "Transfer created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: isRTL ? "فشل في إنشاء التحويل" : "Failed to create transfer",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes, receiverSignature, driverName, vehicleNumber, transferDate }: { 
      id: number; 
      status: string; 
      notes?: string; 
      receiverSignature?: string | null;
      driverName?: string;
      vehicleNumber?: string;
      transferDate?: string;
    }) => {
      const response = await apiRequest("PUT", `/api/warehouse/material-transfers/${id}/status`, {
        status,
        notes,
        receiverSignature,
        driverName,
        vehicleNumber,
        transferDate,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/material-transfers"] });
      setIsUpdateStatusOpen(false);
      setSelectedTransfer(null);
      toast({ title: isRTL ? "تم تحديث حالة التحويل" : "Transfer status updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: isRTL ? "فشل في تحديث الحالة" : "Failed to update status",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    // Reset to correct flow: source = warehouse, destination = branch
    setNewTransfer({
      sourceBranchId: "main_warehouse",
      sourceBranchName: isRTL ? "المستودع الرئيسي" : "Main Warehouse",
      destinationBranchId: canSelectBranch ? "" : (userBranchId || ""),
      destinationBranchName: canSelectBranch ? "" : (userBranch?.name || ""),
      notes: "",
      items: [],
    });
    setTransferType("to_warehouse");
  };

  const handleViewDetails = (transfer: MaterialTransfer) => {
    setSelectedTransfer(transfer);
    setIsViewOpen(true);
  };

  const handleUpdateStatus = (transfer: MaterialTransfer) => {
    setSelectedTransfer(transfer);
    setStatusUpdate({ 
      status: "", 
      notes: "", 
      receiverSignature: null,
      driverName: "",
      vehicleNumber: "",
      transferDate: new Date().toISOString().split('T')[0],
    });
    setIsUpdateStatusOpen(true);
  };

  // Quick WhatsApp share from table row
  const handleQuickWhatsApp = (transfer: MaterialTransfer) => {
    const statusLabel = STATUS_OPTIONS.find(s => s.value === transfer.status)?.labelAr || transfer.status;
    const destName = transfer.destinationBranchName || 'غير محدد';
    const srcName = transfer.sourceBranchName || 'المستودع الرئيسي';
    
    const message = `🧈 *باتر - طلب تحويل مواد*

📋 *رقم الطلب:* ${transfer.transferNumber}
📊 *الحالة:* ${statusLabel}
📍 *من:* ${srcName}
📍 *إلى:* ${destName}
📅 *التاريخ:* ${transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString('ar-SA') : '-'}
${transfer.driverName ? `🚚 *السائق:* ${transfer.driverName}` : ''}
${transfer.vehicleNumber ? `🚗 *المركبة:* ${transfer.vehicleNumber}` : ''}

_مُرسل من نظام باتر_`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  // Quick PDF download from table row (lazy-loaded)
  const handleQuickPdf = async (transfer: MaterialTransfer) => {
    try {
      await generateQuickTransferPdf(transfer as any);
      toast({
        title: isRTL ? "تم تحميل الملف" : "File Downloaded",
        description: isRTL ? "تم تحميل ملف PDF بنجاح" : "PDF downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: isRTL ? "فشل في إنشاء PDF" : "Failed to generate PDF",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Cancel/reject a transfer
  const handleCancelTransfer = async (transfer: MaterialTransfer) => {
    if (!confirm(isRTL ? 'هل أنت متأكد من إلغاء هذا الطلب؟' : 'Are you sure you want to cancel this request?')) {
      return;
    }
    try {
      await apiRequest("PUT", `/api/warehouse/material-transfers/${transfer.id}/status`, {
        status: 'cancelled',
        notes: isRTL ? 'تم الإلغاء بواسطة المستخدم' : 'Cancelled by user',
      });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/material-transfers"] });
      toast({ title: isRTL ? "تم إلغاء الطلب" : "Request cancelled" });
    } catch (error: any) {
      toast({ 
        title: isRTL ? "فشل في إلغاء الطلب" : "Failed to cancel",
        description: error.message,
        variant: "destructive" 
      });
    }
  };

  const filteredTransfers = useMemo(() => transfers.filter(transfer => {
    // Filter by branch (destination or source)
    if (filterBranch !== "all") {
      const matchesBranch = transfer.destinationBranchId === filterBranch || 
                           transfer.sourceBranchId === filterBranch;
      if (!matchesBranch) return false;
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        transfer.transferNumber.toLowerCase().includes(query) ||
        transfer.sourceBranchName?.toLowerCase().includes(query) ||
        transfer.destinationBranchName?.toLowerCase().includes(query) ||
        transfer.driverName?.toLowerCase().includes(query)
      );
    }
    return true;
  }), [transfers, filterBranch, searchQuery]);

  // Download PDF only (lazy-loaded)
  const handleDownloadPdf = async () => {
    if (!selectedTransfer) return;
    try {
      await generateTransferPdf(selectedTransfer as any, transferItems as any);
      toast({
        title: isRTL ? "تم تحميل الملف" : "File Downloaded",
        description: isRTL ? "تم تحميل ملف PDF بنجاح" : "PDF downloaded successfully",
      });
    } catch (error: any) {
      toast({
        title: isRTL ? "فشل في إنشاء PDF" : "Failed to generate PDF",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Download single transfer as Excel
  const handleDownloadTransferExcel = async () => {
    if (!selectedTransfer || transferItems.length === 0) {
      toast({
        title: isRTL ? "لا توجد بيانات" : "No Data",
        description: isRTL ? "لا توجد أصناف للتصدير" : "No items to export",
        variant: "destructive",
      });
      return;
    }

    try {
      const XLSX = await import('xlsx-js-style');
      
      const headers = ["#", "الصنف", "التصنيف", "المتوفر", "الكمية", "الوحدة", "ملاحظات"];
      
      const rows = transferItems.map((item, index) => [
        index + 1,
        item.itemName,
        item.category || "-",
        item.availableQuantity ?? "-",
        item.quantity,
        item.unit,
        item.notes || "-",
      ]);

      const data = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      
      const headerStyle = {
        font: { name: "Tahoma", sz: 12, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "D4A853" } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        }
      };
      
      const cellStyle = {
        font: { name: "Tahoma", sz: 11 },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "CCCCCC" } },
          bottom: { style: "thin", color: { rgb: "CCCCCC" } },
          left: { style: "thin", color: { rgb: "CCCCCC" } },
          right: { style: "thin", color: { rgb: "CCCCCC" } },
        }
      };

      const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1");
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellAddress]) continue;
          worksheet[cellAddress].s = row === 0 ? headerStyle : cellStyle;
        }
      }

      const colWidths = [
        { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, 
        { wch: 10 }, { wch: 10 }, { wch: 20 }
      ];
      worksheet['!cols'] = colWidths;
      
      (worksheet as any)['!views'] = [{ rightToLeft: true }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, selectedTransfer.transferNumber);
      XLSX.writeFile(workbook, `${selectedTransfer.transferNumber}.xlsx`);
      
      toast({
        title: isRTL ? "تم التصدير" : "Exported",
        description: isRTL ? "تم تصدير البيانات إلى ملف Excel" : "Data exported to Excel file",
      });
    } catch (error: any) {
      toast({
        title: isRTL ? "فشل في التصدير" : "Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Share via WhatsApp (text only)
  const handleWhatsAppShare = () => {
    if (!selectedTransfer) return;
    
    const statusLabel = STATUS_OPTIONS.find(s => s.value === selectedTransfer.status)?.labelAr || selectedTransfer.status;
    const destName = selectedTransfer.destinationBranchName || 'غير محدد';
    const srcName = selectedTransfer.sourceBranchName || 'المستودع الرئيسي';
    
    const itemsList = transferItems.map((item, i) => 
      `${i + 1}. ${item.itemName} - ${item.quantity} ${item.unit}`
    ).join('\n');
    
    const message = `📦 *أمر تحويل مواد*
━━━━━━━━━━━━━━
رقم التحويل: ${selectedTransfer.transferNumber}
الحالة: ${statusLabel}
━━━━━━━━━━━━━━
من: ${srcName}
إلى: ${destName}
━━━━━━━━━━━━━━
*الأصناف:*
${itemsList || 'لا توجد أصناف'}
━━━━━━━━━━━━━━
${selectedTransfer.driverName ? `السائق: ${selectedTransfer.driverName}` : ''}
${selectedTransfer.vehicleNumber ? `المركبة: ${selectedTransfer.vehicleNumber}` : ''}
${selectedTransfer.notes ? `ملاحظات: ${selectedTransfer.notes}` : ''}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Export to Excel with Arabic RTL support (lazy-loaded)
  const handleExportExcel = async () => {
    if (!filteredTransfers || filteredTransfers.length === 0) {
      toast({
        title: isRTL ? "لا توجد بيانات" : "No Data",
        description: isRTL ? "لا توجد طلبات تحويل للتصدير" : "No transfer requests to export",
        variant: "destructive",
      });
      return;
    }

    try {
      const XLSX = await import('xlsx-js-style');
      
      const headers = ["رقم التحويل", "من", "إلى", "الحالة", "السائق", "المركبة", "تاريخ التحويل", "ملاحظات", "أنشأه"];
      
      const rows = filteredTransfers.map((transfer) => [
        transfer.transferNumber,
        transfer.sourceBranchName || "المستودع الرئيسي",
        transfer.destinationBranchName || "-",
        STATUS_OPTIONS.find(s => s.value === transfer.status)?.labelAr || transfer.status,
        transfer.driverName || "-",
        transfer.vehicleNumber || "-",
        transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString('ar-SA') : "-",
        transfer.notes || "-",
        transfer.createdByName || "-",
      ]);

      const data = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      
      const headerStyle = {
        font: { name: "Tahoma", sz: 12, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "D4A853" } },
        alignment: { horizontal: "right", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        }
      };
      
      const cellStyle = {
        font: { name: "Tahoma", sz: 11 },
        alignment: { horizontal: "right", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "CCCCCC" } },
          bottom: { style: "thin", color: { rgb: "CCCCCC" } },
          left: { style: "thin", color: { rgb: "CCCCCC" } },
          right: { style: "thin", color: { rgb: "CCCCCC" } },
        }
      };

      const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1");
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!worksheet[cellAddress]) continue;
          worksheet[cellAddress].s = row === 0 ? headerStyle : cellStyle;
        }
      }

      const colWidths = [
        { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, 
        { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 15 }
      ];
      worksheet['!cols'] = colWidths;
      
      (worksheet as any)['!views'] = [{ rightToLeft: true }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "طلبات التحويل");
      XLSX.writeFile(workbook, `طلبات-التحويل-${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: isRTL ? "تم التصدير" : "Exported",
        description: isRTL ? "تم تصدير البيانات إلى ملف Excel" : "Data exported to Excel file",
      });
    } catch (error: any) {
      toast({
        title: isRTL ? "فشل في التصدير" : "Export failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const exportColumns = [
    { header: isRTL ? "رقم التحويل" : "Transfer #", key: "transferNumber", width: 18 },
    { header: isRTL ? "من" : "From", key: "sourceBranchName", width: 18 },
    { header: isRTL ? "إلى" : "To", key: "destinationBranchName", width: 18 },
    { header: isRTL ? "الحالة" : "Status", key: "statusText", width: 15 },
    { header: isRTL ? "السائق" : "Driver", key: "driverName", width: 15 },
    { header: isRTL ? "رقم المركبة" : "Vehicle #", key: "vehicleNumber", width: 12 },
    { header: isRTL ? "التاريخ" : "Date", key: "dateText", width: 15 },
  ];

  const exportData = filteredTransfers.map(t => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === t.status);
    return {
      transferNumber: t.transferNumber,
      sourceBranchName: t.sourceBranchName || (isRTL ? "المستودع الرئيسي" : "Main Warehouse"),
      destinationBranchName: t.destinationBranchName,
      statusText: statusOption ? (isRTL ? statusOption.labelAr : statusOption.labelEn) : t.status,
      driverName: t.driverName || "",
      vehicleNumber: t.vehicleNumber || "",
      dateText: t.transferDate ? new Date(t.transferDate).toLocaleDateString("ar-SA") : "",
    };
  });

  // Status workflow: Warehouse (source) approves → dispatches → Branch (destination) confirms delivery
  const getNextStatus = (transfer: MaterialTransfer): string[] => {
    // Admins can manage all transfers
    if (canSelectBranch) {
      switch (transfer.status) {
        case "pending": return ["approved", "rejected", "cancelled"];
        case "approved": return ["in_transit", "cancelled"];
        case "in_transit": return ["delivered"];
        default: return [];
      }
    }
    
    // Non-admin users: check if they are source (warehouse) or destination (branch)
    const isWarehouse = transfer.sourceBranchId === "main_warehouse" && userBranchId === "main_warehouse";
    const isDestination = transfer.destinationBranchId === userBranchId;
    
    switch (transfer.status) {
      case "pending":
        // Warehouse approves/rejects requests from branches
        if (isWarehouse) {
          return ["approved", "rejected"];
        }
        // Requesting branch can cancel their own request
        if (isDestination) {
          return ["cancelled"];
        }
        return [];
      case "approved":
        // Warehouse dispatches after approval
        if (isWarehouse) {
          return ["in_transit", "cancelled"];
        }
        return [];
      case "in_transit":
        // Destination branch confirms delivery
        if (isDestination) {
          return ["delivered"];
        }
        return [];
      default:
        return [];
    }
  };

  return (
    <Layout>
      <div className="p-4 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/warehouse-dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isRTL ? "طلبات التحويل والطلب" : "Transfer & Order Requests"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isRTL 
                  ? "إدارة طلبات الأصناف من المستودع الرئيسي وتتبع حالة التحويلات" 
                  : "Manage item requests from main warehouse and track transfer status"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButtons
              data={exportData}
              columns={exportColumns}
              fileName={`transfers-${new Date().toISOString().split('T')[0]}`}
              title={isRTL ? "طلبات التحويل" : "Transfer Requests"}
              sheetName={isRTL ? "التحويلات" : "Transfers"}
            />
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="btn-create-transfer">
                  <Plus className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                  {isRTL ? "طلب جديد" : "New Request"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-600" />
                  {isRTL ? "طلب أصناف من المستودع الرئيسي" : "Request Items from Main Warehouse"}
                </DialogTitle>
                <DialogDescription>
                  {isRTL 
                    ? "حدد الأصناف والكميات المطلوبة من المستودع - سيتم إرسال الطلب للموافقة ثم الإرسال"
                    : "Specify items and quantities needed from warehouse - request will be sent for approval then dispatch"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Request Info Banner - Shows flow dynamically based on selection */}
                <div className="p-3 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-center gap-4 text-sm">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm">
                      {newTransfer.sourceBranchId === "main_warehouse" ? (
                        <Warehouse className="w-5 h-5 text-green-600" />
                      ) : (
                        <Building2 className="w-5 h-5 text-green-600" />
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">{isRTL ? "المصدر" : "Source"}</p>
                        <p className="font-bold text-green-700">
                          {newTransfer.sourceBranchName || (isRTL ? "المستودع الرئيسي" : "Main Warehouse")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Send className="w-4 h-4" />
                      <span className="text-xs">{isRTL ? "إرسال إلى" : "sends to"}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">{isRTL ? "الوجهة" : "Destination"}</p>
                        <p className="font-bold text-blue-700">
                          {newTransfer.destinationBranchName || (isRTL ? "اختر الفرع" : "Select Branch")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin can select source/destination */}
                {canSelectBranch && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isRTL ? "الفرع الطالب (المستلم)" : "Requesting Branch (Receiver)"}</Label>
                      <Select 
                        value={newTransfer.destinationBranchId} 
                        onValueChange={(value) => {
                          const branch = branches.find(b => b.id === value);
                          setNewTransfer(prev => ({ 
                            ...prev, 
                            destinationBranchId: value,
                            destinationBranchName: branch ? (isRTL ? branch.name : branch.name) : ""
                          }));
                        }}
                      >
                        <SelectTrigger data-testid="select-destination">
                          <SelectValue placeholder={isRTL ? "اختر الفرع" : "Select branch"} />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{isRTL ? "المصدر (المرسل)" : "Source (Sender)"}</Label>
                      <Select 
                        value={newTransfer.sourceBranchId} 
                        onValueChange={(value) => {
                          const branch = branches.find(b => b.id === value);
                          setNewTransfer(prev => ({ 
                            ...prev, 
                            sourceBranchId: value,
                            sourceBranchName: branch ? branch.name : (isRTL ? "المستودع الرئيسي" : "Main Warehouse")
                          }));
                        }}
                      >
                        <SelectTrigger data-testid="select-source">
                          <SelectValue placeholder={isRTL ? "اختر المصدر" : "Select source"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main_warehouse">
                            {isRTL ? "المستودع الرئيسي" : "Main Warehouse"}
                          </SelectItem>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Items Section */}
                <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      {isRTL ? "الأصناف المطلوب تحويلها" : "Items to Transfer"}
                    </Label>
                    <Button type="button" variant="outline" size="sm" onClick={addTransferItem} data-testid="btn-add-item">
                      <Plus className="w-4 h-4" />
                      {isRTL ? "إضافة صنف" : "Add Item"}
                    </Button>
                  </div>
                  
                  {newTransfer.items.map((item, index) => (
                    <div key={index} className="space-y-2 border-b pb-3" data-testid={`item-row-${index}`}>
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-6">
                          <Label className="text-xs">{isRTL ? "الصنف" : "Item"}</Label>
                          <Select 
                            value={item.itemId ? item.itemId.toString() : ""}
                            onValueChange={(value) => {
                              const selectedItem = warehouseItems.find(i => i.id === parseInt(value));
                              if (selectedItem) {
                                updateTransferItem(index, "itemId", selectedItem.id);
                                updateTransferItem(index, "itemName", selectedItem.name);
                                updateTransferItem(index, "category", selectedItem.category);
                                updateTransferItem(index, "unit", selectedItem.unit);
                              }
                            }}
                          >
                            <SelectTrigger data-testid={`select-item-${index}`}>
                              <SelectValue placeholder={isRTL ? "اختر الصنف" : "Select item"} />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouseItems.map((wItem) => (
                                <SelectItem key={wItem.id} value={wItem.id.toString()}>
                                  {wItem.name} ({wItem.category})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">{isRTL ? "الوحدة" : "Unit"}</Label>
                          <Input value={item.unit} disabled className="bg-muted" />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">{isRTL ? "ملاحظات" : "Notes"}</Label>
                          <Input 
                            value={item.notes}
                            onChange={(e) => updateTransferItem(index, "notes", e.target.value)}
                            placeholder="..."
                            data-testid={`input-item-notes-${index}`}
                          />
                        </div>
                        <div className="col-span-1">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-700"
                            onClick={() => removeTransferItem(index)}
                            data-testid={`btn-remove-item-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-3">
                          <Label className="text-xs text-blue-600 font-medium">
                            {isRTL ? "الكمية المتوفرة بالفرع *" : "Available in Branch *"}
                          </Label>
                          <Input 
                            type="number" 
                            min="0"
                            value={item.availableQuantity ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                              updateTransferItem(index, "availableQuantity", val);
                            }}
                            placeholder={isRTL ? "أدخل الكمية المتوفرة" : "Enter available qty"}
                            className="border-blue-300 focus:border-blue-500"
                            data-testid={`input-available-qty-${index}`}
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs text-orange-600 font-medium">
                            {isRTL ? "الكمية المطلوبة *" : "Requested Qty *"}
                          </Label>
                          <Input 
                            type="number" 
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateTransferItem(index, "quantity", parseInt(e.target.value) || 1)}
                            className="border-orange-300 focus:border-orange-500"
                            data-testid={`input-qty-${index}`}
                          />
                        </div>
                        {item.availableQuantity !== null && item.quantity > item.availableQuantity && (
                          <div className="col-span-6">
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              ⚠️ {isRTL ? "الكمية المطلوبة أكبر من المتوفرة!" : "Requested qty exceeds available!"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {newTransfer.items.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {isRTL ? "لم تتم إضافة أي أصناف بعد - اضغط على 'إضافة صنف'" : "No items added yet - click 'Add Item'"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
                  <Textarea 
                    value={newTransfer.notes}
                    onChange={(e) => setNewTransfer(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."}
                    data-testid="input-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  {isRTL ? "إلغاء" : "Cancel"}
                </Button>
                <Button 
                  onClick={() => {
                    if (newTransfer.items.length === 0) {
                      toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "يجب إضافة صنف واحد على الأقل" : "Please add at least one item", variant: "destructive" });
                      return;
                    }
                    const missingAvailableQty = newTransfer.items.some(item => item.availableQuantity === null);
                    if (missingAvailableQty) {
                      toast({ title: isRTL ? "خطأ" : "Error", description: isRTL ? "يجب إدخال الكمية المتوفرة بالفرع لجميع الأصناف" : "Please enter available quantity for all items", variant: "destructive" });
                      return;
                    }
                    createMutation.mutate(newTransfer);
                  }} 
                  disabled={!newTransfer.destinationBranchId || !newTransfer.sourceBranchId || newTransfer.items.length === 0 || newTransfer.items.some(item => item.availableQuantity === null) || createMutation.isPending}
                  data-testid="btn-submit-transfer"
                >
                  {createMutation.isPending ? (isRTL ? "جاري الإرسال..." : "Submitting...") : (isRTL ? "إرسال الطلب" : "Submit Request")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { status: "pending", color: "bg-yellow-50 border-yellow-200", icon: "🕐", textColor: "text-yellow-700" },
            { status: "approved", color: "bg-blue-50 border-blue-200", icon: "✓", textColor: "text-blue-700" },
            { status: "in_transit", color: "bg-purple-50 border-purple-200", icon: "🚚", textColor: "text-purple-700" },
            { status: "delivered", color: "bg-green-50 border-green-200", icon: "✅", textColor: "text-green-700" },
            { status: "rejected", color: "bg-red-50 border-red-200", icon: "✗", textColor: "text-red-700" },
          ].map(({ status, color, icon, textColor }) => {
            const statusOpt = STATUS_OPTIONS.find(s => s.value === status);
            const count = transfers.filter(t => t.status === status).length;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
                className={`p-3 rounded-lg border ${color} ${filterStatus === status ? "ring-2 ring-offset-1" : ""} transition-all hover:scale-[1.02] cursor-pointer`}
                data-testid={`status-card-${status}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">{icon}</span>
                  <span className={`text-2xl font-bold ${textColor}`}>{count}</span>
                </div>
                <p className={`text-xs mt-1 ${textColor}`}>
                  {statusOpt ? (isRTL ? statusOpt.labelAr : statusOpt.labelEn) : status}
                </p>
              </button>
            );
          })}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
            <Input 
              placeholder={isRTL ? "بحث برقم التحويل أو السائق..." : "Search by transfer number or driver..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={isRTL ? "pr-9" : "pl-9"}
              data-testid="input-search"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]" data-testid="filter-status">
              <Filter className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
              <SelectValue placeholder={isRTL ? "الحالة" : "Status"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? "جميع الحالات" : "All Statuses"}</SelectItem>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {isRTL ? opt.labelAr : opt.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterBranch} onValueChange={setFilterBranch}>
            <SelectTrigger className="w-[180px]" data-testid="filter-branch">
              <Building2 className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
              <SelectValue placeholder={isRTL ? "الفرع" : "Branch"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? "جميع الفروع" : "All Branches"}</SelectItem>
              <SelectItem value="main_warehouse">{isRTL ? "المستودع الرئيسي" : "Main Warehouse"}</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={handleExportExcel}
            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
            data-testid="btn-export-excel"
          >
            <FileSpreadsheet className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
            {isRTL ? "تصدير Excel" : "Export Excel"}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">{isRTL ? "رقم الطلب" : "Request #"}</TableHead>
                  <TableHead className="font-bold">{isRTL ? "المصدر (المستودع)" : "Source"}</TableHead>
                  <TableHead className="font-bold">{isRTL ? "الوجهة (الفرع)" : "Destination"}</TableHead>
                  <TableHead className="font-bold">{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="font-bold">{isRTL ? "التاريخ" : "Date"}</TableHead>
                  <TableHead className="font-bold">{isRTL ? "معلومات الإرسال" : "Dispatch Info"}</TableHead>
                  <TableHead className="font-bold text-center">{isRTL ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      {isRTL ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      {isRTL ? "لا توجد طلبات تحويل" : "No transfer requests found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => {
                    const nextStatuses = getNextStatus(transfer);
                    return (
                      <TableRow key={transfer.id} data-testid={`transfer-row-${transfer.id}`} className="hover:bg-muted/30">
                        <TableCell>
                          <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{transfer.transferNumber}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Warehouse className="w-4 h-4 text-green-600" />
                            <span>{transfer.sourceBranchName || (isRTL ? "المستودع الرئيسي" : "Main Warehouse")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-600" />
                            <span className="font-medium">{transfer.destinationBranchName || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(transfer.status, isRTL)}</TableCell>
                        <TableCell className="text-sm">{new Date(transfer.transferDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</TableCell>
                        <TableCell>
                          {transfer.driverName ? (
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-1">
                                <Truck className="w-3 h-3 text-muted-foreground" />
                                <span>{transfer.driverName}</span>
                              </div>
                              {transfer.vehicleNumber && (
                                <span className="text-xs text-muted-foreground">{transfer.vehicleNumber}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-center items-center">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleViewDetails(transfer)}
                              data-testid={`btn-view-${transfer.id}`}
                            >
                              <FileText className={`w-4 h-4 ${isRTL ? "ml-1" : "mr-1"}`} />
                              {isRTL ? "عرض" : "View"}
                            </Button>
                            {nextStatuses.length > 0 && (
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => handleUpdateStatus(transfer)}
                                data-testid={`btn-update-${transfer.id}`}
                                className={
                                  nextStatuses.includes("approved") ? "bg-blue-600 hover:bg-blue-700" :
                                  nextStatuses.includes("in_transit") ? "bg-purple-600 hover:bg-purple-700" :
                                  nextStatuses.includes("delivered") ? "bg-green-600 hover:bg-green-700" :
                                  ""
                                }
                              >
                                {nextStatuses.includes("approved") && (isRTL ? "موافقة" : "Approve")}
                                {nextStatuses.includes("in_transit") && (isRTL ? "إرسال" : "Dispatch")}
                                {nextStatuses.includes("delivered") && (isRTL ? "تأكيد الاستلام" : "Confirm")}
                                {!nextStatuses.includes("approved") && !nextStatuses.includes("in_transit") && !nextStatuses.includes("delivered") && (isRTL ? "تحديث" : "Update")}
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`btn-more-${transfer.id}`}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align={isRTL ? "start" : "end"}>
                                <DropdownMenuItem onClick={() => handleQuickWhatsApp(transfer)} data-testid={`btn-whatsapp-${transfer.id}`}>
                                  <MessageCircle className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"} text-green-600`} />
                                  {isRTL ? "مشاركة واتساب" : "Share WhatsApp"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewDetails(transfer)} data-testid={`btn-print-${transfer.id}`}>
                                  <Printer className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                                  {isRTL ? "طباعة" : "Print"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleQuickPdf(transfer)} data-testid={`btn-pdf-${transfer.id}`}>
                                  <Download className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"} text-red-600`} />
                                  {isRTL ? "تحميل PDF" : "Download PDF"}
                                </DropdownMenuItem>
                                {(transfer.status === 'pending' && (canSelectBranch || transfer.destinationBranchId === userBranchId)) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleCancelTransfer(transfer)} 
                                      className="text-red-600"
                                      data-testid={`btn-cancel-${transfer.id}`}
                                    >
                                      <XCircle className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                                      {isRTL ? "إلغاء الطلب" : "Cancel Request"}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  {isRTL ? "تفاصيل طلب التحويل" : "Transfer Request Details"}
                </DialogTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePrint()} data-testid="btn-print">
                    <Printer className="w-4 h-4 mr-1" />
                    {isRTL ? "طباعة" : "Print"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDownloadPdf}
                    className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                    data-testid="btn-pdf"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDownloadTransferExcel}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                    data-testid="btn-excel"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-1" />
                    Excel
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleWhatsAppShare}
                    className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                    data-testid="btn-whatsapp"
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    {isRTL ? "واتساب" : "WhatsApp"}
                  </Button>
                </div>
              </div>
            </DialogHeader>
            {selectedTransfer && (
              <div ref={printRef} className="space-y-6 p-4 print:p-8">
                {/* Header for print */}
                <div className="hidden print:block text-center mb-6">
                  <h1 className="text-2xl font-bold">{isRTL ? "أمر تحويل مواد" : "Material Transfer Order"}</h1>
                  <p className="text-lg">{selectedTransfer.transferNumber}</p>
                </div>

                {/* Transfer Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-b pb-4">
                  <div>
                    <p className="text-muted-foreground text-xs">{isRTL ? "رقم التحويل" : "Transfer #"}</p>
                    <p className="font-mono font-bold">{selectedTransfer.transferNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{isRTL ? "الحالة" : "Status"}</p>
                    {getStatusBadge(selectedTransfer.status, isRTL)}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{isRTL ? "تاريخ الطلب" : "Request Date"}</p>
                    <p>{selectedTransfer.transferDate ? new Date(selectedTransfer.transferDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US') : "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{isRTL ? "أنشأه" : "Created By"}</p>
                    <p>{selectedTransfer.createdByName || "-"}</p>
                  </div>
                </div>
                
                {/* Source/Destination */}
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg print:bg-gray-100">
                  <div className="flex-1 text-center">
                    <MapPin className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{isRTL ? "من" : "From"}</p>
                    <p className="font-bold">{selectedTransfer.sourceBranchName || (isRTL ? "المستودع الرئيسي" : "Main Warehouse")}</p>
                  </div>
                  <Send className="w-6 h-6 text-primary" />
                  <div className="flex-1 text-center">
                    <MapPin className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{isRTL ? "إلى" : "To"}</p>
                    <p className="font-bold">{selectedTransfer.destinationBranchName || (isRTL ? "غير محدد" : "Not specified")}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h3 className="font-bold mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    {isRTL ? "الأصناف المحولة" : "Transfer Items"}
                  </h3>
                  {isLoadingItems ? (
                    <p className="text-center py-4 text-muted-foreground">{isRTL ? "جاري التحميل..." : "Loading..."}</p>
                  ) : transferItems.length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground">{isRTL ? "لا توجد أصناف" : "No items"}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>{isRTL ? "الصنف" : "Item"}</TableHead>
                          <TableHead>{isRTL ? "التصنيف" : "Category"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "المتوفر" : "Available"}</TableHead>
                          <TableHead className="text-center">{isRTL ? "الكمية" : "Qty"}</TableHead>
                          <TableHead>{isRTL ? "الوحدة" : "Unit"}</TableHead>
                          {selectedTransfer.status === "delivered" && (
                            <TableHead className="text-center">{isRTL ? "المستلم" : "Received"}</TableHead>
                          )}
                          <TableHead>{isRTL ? "ملاحظات" : "Notes"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transferItems.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                            <TableCell className="font-medium">{item.itemName}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{item.availableQuantity ?? '-'}</TableCell>
                            <TableCell className="text-center font-bold">{item.quantity}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            {selectedTransfer.status === "delivered" && (
                              <TableCell className="text-center">{item.receivedQuantity ?? item.quantity}</TableCell>
                            )}
                            <TableCell className="text-xs text-muted-foreground">{item.notes || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Dispatch Info (if in transit or delivered) */}
                {(selectedTransfer.status === "in_transit" || selectedTransfer.status === "delivered") && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm border-t pt-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground text-xs">{isRTL ? "السائق" : "Driver"}</p>
                        <p className="font-medium">{selectedTransfer.driverName || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-muted-foreground text-xs">{isRTL ? "المركبة" : "Vehicle"}</p>
                        <p className="font-medium">{selectedTransfer.vehicleNumber || "-"}</p>
                      </div>
                    </div>
                    {selectedTransfer.receivedByName && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <div>
                          <p className="text-muted-foreground text-xs">{isRTL ? "استلمه" : "Received By"}</p>
                          <p className="font-medium">{selectedTransfer.receivedByName}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {selectedTransfer.notes && (
                  <div className="border-t pt-4">
                    <p className="text-muted-foreground text-xs mb-1">{isRTL ? "ملاحظات" : "Notes"}</p>
                    <p className="text-sm bg-muted p-2 rounded">{selectedTransfer.notes}</p>
                  </div>
                )}
                
                {/* Signature */}
                {selectedTransfer.receiverSignature && (
                  <div className="border-t pt-4">
                    <SignatureDisplay 
                      signature={selectedTransfer.receiverSignature} 
                      label={isRTL ? "توقيع المستلم" : "Receiver Signature"} 
                    />
                  </div>
                )}

                {/* Print Footer */}
                <div className="hidden print:block border-t pt-4 mt-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="text-center">
                      <p className="text-sm mb-8">{isRTL ? "توقيع المُرسل" : "Sender Signature"}</p>
                      <div className="border-t border-dashed pt-2">________________</div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm mb-8">{isRTL ? "توقيع المستلم" : "Receiver Signature"}</p>
                      <div className="border-t border-dashed pt-2">________________</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isUpdateStatusOpen} onOpenChange={setIsUpdateStatusOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? "تحديث حالة التحويل" : "Update Transfer Status"}</DialogTitle>
              <DialogDescription>
                {isRTL ? `تحديث حالة التحويل رقم ${selectedTransfer?.transferNumber}` : `Update status for transfer ${selectedTransfer?.transferNumber}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{isRTL ? "الحالة الجديدة" : "New Status"}</Label>
                <Select value={statusUpdate.status} onValueChange={(value) => setStatusUpdate(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger data-testid="select-new-status">
                    <SelectValue placeholder={isRTL ? "اختر الحالة" : "Select status"} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedTransfer && getNextStatus(selectedTransfer).map((status) => {
                      const opt = STATUS_OPTIONS.find(s => s.value === status);
                      return (
                        <SelectItem key={status} value={status}>
                          {isRTL ? opt?.labelAr : opt?.labelEn}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              {/* Dispatch fields for in_transit status */}
              {statusUpdate.status === "in_transit" && (
                <div className="space-y-3 border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/20">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {isRTL ? "بيانات الإرسال" : "Dispatch Information"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{isRTL ? "تاريخ الإرسال" : "Dispatch Date"}</Label>
                      <Input 
                        type="date" 
                        value={statusUpdate.transferDate}
                        onChange={(e) => setStatusUpdate(prev => ({ ...prev, transferDate: e.target.value }))}
                        data-testid="input-dispatch-date"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{isRTL ? "رقم المركبة" : "Vehicle Number"}</Label>
                      <Input 
                        value={statusUpdate.vehicleNumber}
                        onChange={(e) => setStatusUpdate(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                        placeholder="ABC-1234"
                        data-testid="input-dispatch-vehicle"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isRTL ? "اسم السائق" : "Driver Name"}</Label>
                    <Input 
                      value={statusUpdate.driverName}
                      onChange={(e) => setStatusUpdate(prev => ({ ...prev, driverName: e.target.value }))}
                      placeholder={isRTL ? "اسم السائق" : "Driver name"}
                      data-testid="input-dispatch-driver"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
                <Textarea 
                  value={statusUpdate.notes}
                  onChange={(e) => setStatusUpdate(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."}
                  data-testid="input-status-notes"
                />
              </div>
              {statusUpdate.status === "delivered" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <PenTool className="w-4 h-4" />
                    {isRTL ? "توقيع المستلم" : "Receiver Signature"}
                  </Label>
                  <SignaturePad
                    onSignatureChange={(sig) => setStatusUpdate(prev => ({ ...prev, receiverSignature: sig }))}
                    label={isRTL ? "وقّع هنا لتأكيد الاستلام" : "Sign here to confirm receipt"}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUpdateStatusOpen(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button 
                onClick={() => {
                  if (selectedTransfer && statusUpdate.status) {
                    updateStatusMutation.mutate({
                      id: selectedTransfer.id,
                      status: statusUpdate.status,
                      notes: statusUpdate.notes,
                      receiverSignature: statusUpdate.receiverSignature,
                      // Include dispatch fields for in_transit
                      ...(statusUpdate.status === "in_transit" && {
                        driverName: statusUpdate.driverName,
                        vehicleNumber: statusUpdate.vehicleNumber,
                        transferDate: statusUpdate.transferDate,
                      }),
                    });
                  }
                }}
                disabled={
                  !statusUpdate.status || 
                  updateStatusMutation.isPending || 
                  (statusUpdate.status === "delivered" && !statusUpdate.receiverSignature) ||
                  (statusUpdate.status === "in_transit" && (!statusUpdate.driverName || !statusUpdate.vehicleNumber))
                }
                data-testid="btn-confirm-status"
              >
                {updateStatusMutation.isPending ? (isRTL ? "جاري التحديث..." : "Updating...") : (isRTL ? "تأكيد" : "Confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
