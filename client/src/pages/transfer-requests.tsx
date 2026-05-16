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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Send, Plus, Search, Filter, Clock, CheckCircle, Truck, 
  ArrowLeft, FileText, MapPin, User, Calendar, PenTool, Building2, Warehouse, Trash2, Package, Printer, Download, MessageCircle, FileSpreadsheet, MoreHorizontal, XCircle, Copy, Check, ChevronsUpDown, AlertTriangle
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
  originalQuantity: number | null;
  receivedQuantity: number | null;
  notes: string | null;
  availableQuantity?: number | null;
  isModified?: boolean;
  modifiedByName?: string | null;
  modifiedAt?: string | null;
  modificationNotes?: string | null;
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
  const [isModifyQuantitiesOpen, setIsModifyQuantitiesOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<MaterialTransfer | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [transferType, setTransferType] = useState<"to_warehouse" | "between_branches">("to_warehouse");
  const [openItemIndex, setOpenItemIndex] = useState<number | null>(null);
  const [modifyingItems, setModifyingItems] = useState<Array<{ 
    itemId: number; 
    itemName: string;
    originalQuantity: number;
    currentQuantity: number;
    newQuantity: number; 
    unit: string;
    modificationNotes: string 
  }>>([]);
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
    staleTime: 1000 * 60 * 30, // 30 minutes - catalog data
    placeholderData: (prev) => prev,
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
  const updateTransferItem = (index: number, field: string, value: string | number | null) => {
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

  // State for delivery confirmation with received quantities
  const [isDeliveryConfirmOpen, setIsDeliveryConfirmOpen] = useState(false);
  const [deliveryConfirmData, setDeliveryConfirmData] = useState<{
    receivedItems: Array<{ itemId: number; itemName: string; sentQuantity: number; receivedQuantity: number; unit: string; discrepancyNotes: string }>;
    receiverSignature: string | null;
    deliveryNotes: string;
  }>({
    receivedItems: [],
    receiverSignature: null,
    deliveryNotes: ""
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
    staleTime: 1000 * 60 * 2, // 2 minutes - frequently changing
    placeholderData: (prev) => prev,
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

  // Mutation for confirming delivery with received quantities
  const confirmDeliveryMutation = useMutation({
    mutationFn: async ({ id, receivedItems, receiverSignature, deliveryNotes }: {
      id: number;
      receivedItems: Array<{ itemId: number; receivedQuantity: number; discrepancyNotes?: string }>;
      receiverSignature?: string | null;
      deliveryNotes?: string;
    }) => {
      const response = await apiRequest("POST", `/api/warehouse/material-transfers/${id}/confirm-delivery`, {
        receivedItems,
        receiverSignature,
        deliveryNotes
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/material-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/branch-stock"] });
      setIsDeliveryConfirmOpen(false);
      setSelectedTransfer(null);
      toast({ title: isRTL ? "تم تأكيد الاستلام بنجاح" : "Delivery confirmed successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: isRTL ? "فشل في تأكيد الاستلام" : "Failed to confirm delivery",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Mutation for modifying quantities by warehouse manager
  const modifyQuantitiesMutation = useMutation({
    mutationFn: async ({ id, modifications }: {
      id: number;
      modifications: Array<{ itemId: number; newQuantity: number; modificationNotes?: string }>;
    }) => {
      const response = await apiRequest("POST", `/api/warehouse/material-transfers/${id}/modify-quantities`, {
        modifications
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/material-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/material-transfers", selectedTransfer?.id, "items"] });
      setIsModifyQuantitiesOpen(false);
      setModifyingItems([]);
      toast({ title: isRTL ? "تم تعديل الكميات بنجاح" : "Quantities modified successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: isRTL ? "فشل في تعديل الكميات" : "Failed to modify quantities",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Handle opening modify quantities dialog
  const handleModifyQuantities = async (transfer: MaterialTransfer) => {
    setSelectedTransfer(transfer);
    try {
      const response = await fetch(`/api/warehouse/material-transfers/${transfer.id}/items`);
      if (response.ok) {
        const items = await response.json();
        setModifyingItems(items.map((item: TransferItem) => ({
          itemId: item.itemId,
          itemName: item.itemName,
          originalQuantity: item.originalQuantity || item.quantity,
          currentQuantity: item.quantity,
          newQuantity: item.quantity,
          unit: item.unit,
          modificationNotes: ""
        })));
        setIsModifyQuantitiesOpen(true);
      }
    } catch (error) {
      console.error("Error fetching items:", error);
      toast({
        title: isRTL ? "تعذر تحميل أصناف الطلب" : "Failed to load request items",
        description: (error as Error)?.message || (isRTL ? "تحقق من الاتصال وحاول مرة أخرى" : "Check your connection and try again"),
        variant: "destructive",
      });
    }
  };

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

  // Handle delivery confirmation with received quantities
  const handleConfirmDelivery = async (transfer: MaterialTransfer) => {
    setSelectedTransfer(transfer);
    // Fetch transfer items to populate received quantities
    try {
      const response = await fetch(`/api/warehouse/material-transfers/${transfer.id}/items`);
      if (response.ok) {
        const items = await response.json();
        setDeliveryConfirmData({
          receivedItems: items.map((item: TransferItem) => ({
            itemId: item.itemId,
            itemName: item.itemName,
            sentQuantity: item.quantity,
            receivedQuantity: item.quantity, // Default to sent quantity
            unit: item.unit,
            discrepancyNotes: ""
          })),
          receiverSignature: null,
          deliveryNotes: ""
        });
        setIsDeliveryConfirmOpen(true);
      }
    } catch (error) {
      console.error("Error fetching items for delivery confirmation:", error);
      toast({
        title: isRTL ? "تعذر تحميل أصناف التحويل" : "Failed to load transfer items",
        description: (error as Error)?.message || (isRTL ? "تحقق من الاتصال وحاول مرة أخرى" : "Check your connection and try again"),
        variant: "destructive",
      });
    }
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
📅 *التاريخ:* ${transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString('en-GB') : '-'}
${transfer.driverName ? `🚚 *السائق:* ${transfer.driverName}` : ''}
${transfer.vehicleNumber ? `🚗 *المركبة:* ${transfer.vehicleNumber}` : ''}

_مُرسل من BUTTER BAKERY SYSTEM_`;
    
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
        transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString('en-GB') : "-",
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
      dateText: t.transferDate ? new Date(t.transferDate).toLocaleDateString("en-GB") : "",
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
      <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto space-y-4 sm:space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/warehouse-dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                <ArrowLeft className={`w-4 h-4 sm:w-5 sm:h-5 ${isRTL ? "rotate-180" : ""}`} />
              </Button>
            </Link>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-500 flex items-center justify-center">
              <Send className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
                {isRTL ? "طلبات التحويل" : "Transfer Requests"}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
                {isRTL 
                  ? "إدارة طلبات الأصناف من المستودع الرئيسي" 
                  : "Manage item requests from main warehouse"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <ExportButtons
                data={exportData}
                columns={exportColumns}
                fileName={`transfers-${new Date().toISOString().split('T')[0]}`}
                title={isRTL ? "طلبات التحويل" : "Transfer Requests"}
                sheetName={isRTL ? "التحويلات" : "Transfers"}
              />
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="btn-create-transfer" className="w-full sm:w-auto">
                  <Plus className={`w-4 h-4 ${isRTL ? "ml-1 sm:ml-2" : "mr-1 sm:mr-2"}`} />
                  <span className="hidden sm:inline">{isRTL ? "طلب جديد" : "New Request"}</span>
                  <span className="sm:hidden">{isRTL ? "طلب" : "New"}</span>
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
                    <div key={index} className="space-y-3 border rounded-lg p-3 bg-white shadow-sm" data-testid={`item-row-${index}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-amber-600" />
                            <Label className="text-sm font-medium">{isRTL ? "الصنف" : "Item"}</Label>
                          </div>
                          <Popover open={openItemIndex === index} onOpenChange={(open) => setOpenItemIndex(open ? index : null)}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openItemIndex === index}
                                className="w-full justify-between text-right h-10"
                                data-testid={`select-item-${index}`}
                              >
                                {item.itemId ? (
                                  <span className="flex items-center gap-2">
                                    <span className="font-medium">{item.itemName}</span>
                                    <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">{isRTL ? "ابحث واختر الصنف..." : "Search and select item..."}</span>
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder={isRTL ? "ابحث عن صنف..." : "Search item..."} />
                                <CommandList className="max-h-[300px] overflow-y-auto">
                                  <CommandEmpty>{isRTL ? "لم يتم العثور على أصناف" : "No items found"}</CommandEmpty>
                                  <CommandGroup heading={isRTL ? "الأصناف المتاحة" : "Available Items"}>
                                    {warehouseItems.map((wItem) => (
                                      <CommandItem
                                        key={wItem.id}
                                        value={`${wItem.name} ${wItem.category}`}
                                        onSelect={() => {
                                          updateTransferItem(index, "itemId", wItem.id);
                                          updateTransferItem(index, "itemName", wItem.name);
                                          updateTransferItem(index, "category", wItem.category);
                                          updateTransferItem(index, "unit", wItem.unit);
                                          setOpenItemIndex(null);
                                        }}
                                        className="cursor-pointer"
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${item.itemId === wItem.id ? "opacity-100" : "opacity-0"}`}
                                        />
                                        <div className="flex flex-col flex-1">
                                          <span className="font-medium">{wItem.name}</span>
                                          <span className="text-xs text-muted-foreground">{wItem.category} • {wItem.unit}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6"
                          onClick={() => removeTransferItem(index)}
                          data-testid={`btn-remove-item-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">{isRTL ? "الوحدة" : "Unit"}</Label>
                          <Input value={item.unit || "-"} disabled className="bg-muted/50 text-center" />
                        </div>
                        <div>
                          <Label className="text-xs text-red-600 font-bold flex items-center gap-1">
                            <span className="text-red-500">*</span>
                            {isRTL ? "المتوفر بالفرع (مطلوب)" : "Available (Required)"}
                          </Label>
                          <Input 
                            type="number" 
                            min="0"
                            value={item.availableQuantity ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : parseInt(e.target.value);
                              updateTransferItem(index, "availableQuantity", val);
                            }}
                            placeholder={isRTL ? "أدخل الكمية المتوفرة" : "Enter available qty"}
                            className={`text-center font-bold ${item.availableQuantity === null ? 'border-red-500 bg-red-50' : 'border-blue-300 focus:border-blue-500'}`}
                            data-testid={`input-available-qty-${index}`}
                            required
                          />
                          {item.availableQuantity === null && (
                            <p className="text-xs text-red-500 mt-1">
                              {isRTL ? "⚠️ هذا الحقل إلزامي" : "⚠️ This field is required"}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-orange-600 font-medium">
                            {isRTL ? "الكمية المطلوبة" : "Qty"}
                          </Label>
                          <Input 
                            type="number" 
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateTransferItem(index, "quantity", parseInt(e.target.value) || 1)}
                            className="border-orange-300 focus:border-orange-500 text-center font-bold"
                            data-testid={`input-qty-${index}`}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">{isRTL ? "ملاحظات" : "Notes"}</Label>
                          <Input 
                            value={item.notes}
                            onChange={(e) => updateTransferItem(index, "notes", e.target.value)}
                            placeholder="..."
                            data-testid={`input-item-notes-${index}`}
                          />
                        </div>
                      </div>
                      
                      {item.availableQuantity !== null && item.quantity > item.availableQuantity && (
                        <p className="text-xs text-red-500 flex items-center gap-1 bg-red-50 p-2 rounded">
                          ⚠️ {isRTL ? "الكمية المطلوبة أكبر من المتوفرة!" : "Requested qty exceeds available!"}
                        </p>
                      )}
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
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
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
                className={`p-2 sm:p-3 rounded-lg border ${color} ${filterStatus === status ? "ring-2 ring-offset-1" : ""} transition-all hover:scale-[1.02] cursor-pointer`}
                data-testid={`status-card-${status}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-lg">{icon}</span>
                  <span className={`text-lg sm:text-2xl font-bold ${textColor}`}>{count}</span>
                </div>
                <p className={`text-[10px] sm:text-xs mt-1 ${textColor} truncate`}>
                  {statusOpt ? (isRTL ? statusOpt.labelAr : statusOpt.labelEn) : status}
                </p>
              </button>
            );
          })}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
            <Input 
              placeholder={isRTL ? "بحث برقم التحويل..." : "Search by transfer #..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`h-9 sm:h-10 ${isRTL ? "pr-9" : "pl-9"}`}
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px] sm:w-[150px] h-9 sm:h-10" data-testid="filter-status">
                <Filter className={`w-3 h-3 sm:w-4 sm:h-4 ${isRTL ? "ml-1 sm:ml-2" : "mr-1 sm:mr-2"}`} />
                <SelectValue placeholder={isRTL ? "الحالة" : "Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "جميع الحالات" : "All"}</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {isRTL ? opt.labelAr : opt.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-[120px] sm:w-[150px] h-9 sm:h-10" data-testid="filter-branch">
                <Building2 className={`w-3 h-3 sm:w-4 sm:h-4 ${isRTL ? "ml-1 sm:ml-2" : "mr-1 sm:mr-2"}`} />
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
              className="hidden sm:flex bg-green-50 hover:bg-green-100 text-green-700 border-green-200 h-9 sm:h-10"
              data-testid="btn-export-excel"
            >
              <FileSpreadsheet className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
              <span className="hidden md:inline">{isRTL ? "تصدير Excel" : "Export"}</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold text-xs sm:text-sm min-w-[100px]">{isRTL ? "رقم الطلب" : "Request #"}</TableHead>
                    <TableHead className="font-bold text-xs sm:text-sm hidden md:table-cell">{isRTL ? "المصدر" : "Source"}</TableHead>
                    <TableHead className="font-bold text-xs sm:text-sm">{isRTL ? "الوجهة" : "Dest"}</TableHead>
                    <TableHead className="font-bold text-xs sm:text-sm">{isRTL ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="font-bold text-xs sm:text-sm hidden lg:table-cell">{isRTL ? "التاريخ" : "Date"}</TableHead>
                    <TableHead className="font-bold text-xs sm:text-sm hidden lg:table-cell">{isRTL ? "الإرسال" : "Dispatch"}</TableHead>
                    <TableHead className="font-bold text-xs sm:text-sm text-center">{isRTL ? "إجراء" : "Actions"}</TableHead>
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
                          <span className="font-mono text-[10px] sm:text-sm bg-muted px-1 sm:px-2 py-1 rounded">{transfer.transferNumber}</span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                            <Warehouse className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
                            <span>{transfer.sourceBranchName || (isRTL ? "المستودع" : "Warehouse")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                            <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                            <span className="font-medium truncate max-w-[80px] sm:max-w-[1400px] mx-auto">{transfer.destinationBranchName || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(transfer.status, isRTL)}</TableCell>
                        <TableCell className="text-xs sm:text-sm hidden lg:table-cell">{new Date(transfer.transferDate).toLocaleDateString(isRTL ? 'en-GB' : 'en-US')}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {transfer.driverName ? (
                            <div className="text-xs sm:text-sm space-y-1">
                              <div className="flex items-center gap-1">
                                <Truck className="w-3 h-3 text-muted-foreground" />
                                <span>{transfer.driverName}</span>
                              </div>
                              {transfer.vehicleNumber && (
                                <span className="text-[10px] sm:text-xs text-muted-foreground">{transfer.vehicleNumber}</span>
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
                              className="h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
                              onClick={() => handleViewDetails(transfer)}
                              data-testid={`btn-view-${transfer.id}`}
                            >
                              <FileText className={`w-3 h-3 sm:w-4 sm:h-4 ${isRTL ? "ml-1" : "mr-1"}`} />
                              <span className="hidden sm:inline">{isRTL ? "عرض" : "View"}</span>
                            </Button>
                            {nextStatuses.length > 0 && (
                              <Button 
                                variant="default" 
                                size="sm"
                                className={`h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs ${
                                  nextStatuses.includes("approved") ? "bg-blue-600 hover:bg-blue-700" :
                                  nextStatuses.includes("in_transit") ? "bg-purple-600 hover:bg-purple-700" :
                                  nextStatuses.includes("delivered") ? "bg-green-600 hover:bg-green-700" :
                                  ""
                                }`}
                                onClick={() => nextStatuses.includes("delivered") ? handleConfirmDelivery(transfer) : handleUpdateStatus(transfer)}
                                data-testid={`btn-update-${transfer.id}`}
                              >
                                {nextStatuses.includes("approved") && (isRTL ? "موافقة" : "OK")}
                                {nextStatuses.includes("in_transit") && (isRTL ? "إرسال" : "Send")}
                                {nextStatuses.includes("delivered") && (isRTL ? "تأكيد" : "Confirm")}
                                {!nextStatuses.includes("approved") && !nextStatuses.includes("in_transit") && !nextStatuses.includes("delivered") && (isRTL ? "تحديث" : "Update")}
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" data-testid={`btn-more-${transfer.id}`}>
                                  <MoreHorizontal className="w-3 h-3 sm:w-4 sm:h-4" />
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
                                {(['pending', 'approved'].includes(transfer.status) && canSelectBranch) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleModifyQuantities(transfer)} 
                                      className="text-amber-600"
                                      data-testid={`btn-modify-qty-${transfer.id}`}
                                    >
                                      <Package className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                                      {isRTL ? "تعديل الكميات" : "Modify Quantities"}
                                    </DropdownMenuItem>
                                  </>
                                )}
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
            </div>
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
                    <p>{selectedTransfer.transferDate ? new Date(selectedTransfer.transferDate).toLocaleDateString(isRTL ? 'en-GB' : 'en-US') : "-"}</p>
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
                            <TableCell className="font-medium">
                              {item.itemName}
                              {item.isModified && (
                                <Badge variant="outline" className="mr-2 text-xs text-amber-600 border-amber-300">
                                  {isRTL ? "معدّل" : "Modified"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{item.availableQuantity ?? '-'}</TableCell>
                            <TableCell className="text-center font-bold">
                              {item.isModified && item.originalQuantity ? (
                                <div className="flex flex-col items-center">
                                  <span className="line-through text-muted-foreground text-xs">{item.originalQuantity}</span>
                                  <span className="text-amber-600">{item.quantity}</span>
                                </div>
                              ) : (
                                item.quantity
                              )}
                            </TableCell>
                            <TableCell>{item.unit}</TableCell>
                            {selectedTransfer.status === "delivered" && (
                              <TableCell className="text-center">{item.receivedQuantity ?? item.quantity}</TableCell>
                            )}
                            <TableCell className="text-xs text-muted-foreground">
                              {item.isModified && item.modificationNotes ? (
                                <div>
                                  <span className="text-amber-600">{item.modificationNotes}</span>
                                  {item.modifiedByName && (
                                    <span className="block text-xs text-muted-foreground">
                                      ({isRTL ? "بواسطة" : "by"}: {item.modifiedByName})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                item.notes || "-"
                              )}
                            </TableCell>
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

        {/* Delivery Confirmation Dialog with Received Quantities */}
        <Dialog open={isDeliveryConfirmOpen} onOpenChange={setIsDeliveryConfirmOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                {isRTL ? "تأكيد استلام التحويل" : "Confirm Transfer Delivery"}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? `تأكيد استلام التحويل رقم ${selectedTransfer?.transferNumber}` : `Confirm delivery for transfer ${selectedTransfer?.transferNumber}`}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Items with received quantities */}
              <div className="space-y-2">
                <Label className="font-medium">{isRTL ? "الأصناف المستلمة" : "Received Items"}</Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">{isRTL ? "الصنف" : "Item"}</TableHead>
                        <TableHead className="text-center w-24">{isRTL ? "المرسل" : "Sent"}</TableHead>
                        <TableHead className="text-center w-28">{isRTL ? "المستلم" : "Received"}</TableHead>
                        <TableHead className="text-center w-20">{isRTL ? "الفرق" : "Diff"}</TableHead>
                        <TableHead className="text-right">{isRTL ? "ملاحظات" : "Notes"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveryConfirmData.receivedItems.map((item, idx) => {
                        const diff = item.receivedQuantity - item.sentQuantity;
                        return (
                          <TableRow key={item.itemId}>
                            <TableCell className="font-medium">
                              {item.itemName}
                              <span className="text-xs text-muted-foreground mr-1">({item.unit})</span>
                            </TableCell>
                            <TableCell className="text-center font-mono">{item.sentQuantity}</TableCell>
                            <TableCell className="text-center">
                              <Input
                                type="number"
                                min={0}
                                value={item.receivedQuantity}
                                onChange={(e) => {
                                  const newItems = [...deliveryConfirmData.receivedItems];
                                  newItems[idx].receivedQuantity = parseInt(e.target.value) || 0;
                                  setDeliveryConfirmData(prev => ({ ...prev, receivedItems: newItems }));
                                }}
                                className="w-20 text-center mx-auto"
                                data-testid={`input-received-qty-${item.itemId}`}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`font-mono font-bold ${diff < 0 ? 'text-red-600' : diff > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder={isRTL ? "سبب الفرق..." : "Reason..."}
                                value={item.discrepancyNotes}
                                onChange={(e) => {
                                  const newItems = [...deliveryConfirmData.receivedItems];
                                  newItems[idx].discrepancyNotes = e.target.value;
                                  setDeliveryConfirmData(prev => ({ ...prev, receivedItems: newItems }));
                                }}
                                className="w-full text-sm"
                                data-testid={`input-discrepancy-notes-${item.itemId}`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Summary */}
                {deliveryConfirmData.receivedItems.some(item => item.receivedQuantity !== item.sentQuantity) && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {isRTL ? "يوجد فرق في الكميات المستلمة" : "There are discrepancies in received quantities"}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Delivery Notes */}
              <div className="space-y-2">
                <Label>{isRTL ? "ملاحظات التسليم" : "Delivery Notes"}</Label>
                <Textarea 
                  value={deliveryConfirmData.deliveryNotes}
                  onChange={(e) => setDeliveryConfirmData(prev => ({ ...prev, deliveryNotes: e.target.value }))}
                  placeholder={isRTL ? "ملاحظات إضافية عن التسليم..." : "Additional delivery notes..."}
                  data-testid="input-delivery-notes"
                />
              </div>
              
              {/* Signature */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  {isRTL ? "توقيع المستلم" : "Receiver Signature"}
                </Label>
                <SignaturePad
                  onSignatureChange={(sig) => setDeliveryConfirmData(prev => ({ ...prev, receiverSignature: sig }))}
                  label={isRTL ? "وقّع هنا لتأكيد الاستلام" : "Sign here to confirm receipt"}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeliveryConfirmOpen(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button 
                onClick={() => {
                  if (selectedTransfer) {
                    confirmDeliveryMutation.mutate({
                      id: selectedTransfer.id,
                      receivedItems: deliveryConfirmData.receivedItems.map(item => ({
                        itemId: item.itemId,
                        receivedQuantity: item.receivedQuantity,
                        discrepancyNotes: item.discrepancyNotes || undefined
                      })),
                      receiverSignature: deliveryConfirmData.receiverSignature,
                      deliveryNotes: deliveryConfirmData.deliveryNotes
                    });
                  }
                }}
                disabled={!deliveryConfirmData.receiverSignature || confirmDeliveryMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
                data-testid="btn-confirm-delivery"
              >
                {confirmDeliveryMutation.isPending 
                  ? (isRTL ? "جاري التأكيد..." : "Confirming...") 
                  : (isRTL ? "تأكيد الاستلام" : "Confirm Delivery")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modify Quantities Dialog - تعديل الكميات */}
        <Dialog open={isModifyQuantitiesOpen} onOpenChange={setIsModifyQuantitiesOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                {isRTL ? "تعديل كميات التحويل" : "Modify Transfer Quantities"}
              </DialogTitle>
              <DialogDescription>
                {isRTL 
                  ? "يمكنك تعديل الكميات حسب المتوفر في المستودع قبل الإرسال"
                  : "You can modify quantities based on warehouse availability before dispatch"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Warning Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  {isRTL 
                    ? "ملاحظة: سيتم تسجيل التعديلات وإظهارها في بيان التحويل. لا يمكن التعديل بعد الإرسال."
                    : "Note: Modifications will be recorded and shown in the transfer document. Cannot modify after dispatch."}
                </div>
              </div>
              
              {/* Items Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "الصنف" : "Item"}</TableHead>
                    <TableHead className="text-center">{isRTL ? "الكمية الأصلية" : "Original Qty"}</TableHead>
                    <TableHead className="text-center">{isRTL ? "الكمية الجديدة" : "New Qty"}</TableHead>
                    <TableHead>{isRTL ? "سبب التعديل" : "Reason"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modifyingItems.map((item, idx) => (
                    <TableRow key={item.itemId}>
                      <TableCell className="font-medium">
                        {item.itemName}
                        <span className="text-xs text-muted-foreground block">{item.unit}</span>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {item.originalQuantity}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={item.newQuantity}
                          onChange={(e) => {
                            const newItems = [...modifyingItems];
                            newItems[idx] = { ...item, newQuantity: parseInt(e.target.value) || 0 };
                            setModifyingItems(newItems);
                          }}
                          className="w-20 text-center mx-auto"
                          data-testid={`input-qty-${item.itemId}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.modificationNotes || ""}
                          onChange={(e) => {
                            const newItems = [...modifyingItems];
                            newItems[idx] = { ...item, modificationNotes: e.target.value };
                            setModifyingItems(newItems);
                          }}
                          placeholder={isRTL ? "الكمية غير متوفرة..." : "Quantity unavailable..."}
                          className="w-full"
                          data-testid={`input-notes-${item.itemId}`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Summary of changes */}
              {modifyingItems.some((item) => item.newQuantity !== item.originalQuantity) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-800 mb-2">
                    {isRTL ? "ملخص التعديلات:" : "Modifications Summary:"}
                  </div>
                  <div className="space-y-1">
                    {modifyingItems.filter((item) => item.newQuantity !== item.originalQuantity).map((item) => (
                      <div key={item.itemId} className="text-sm text-blue-700 flex justify-between">
                        <span>{item.itemName}</span>
                        <span className="font-mono">
                          {item.originalQuantity} → {item.newQuantity}
                          <span className={item.newQuantity < item.originalQuantity ? "text-red-600 mr-1" : "text-green-600 mr-1"}>
                            ({item.newQuantity - item.originalQuantity > 0 ? '+' : ''}{item.newQuantity - item.originalQuantity})
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModifyQuantitiesOpen(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button 
                onClick={() => {
                  if (selectedTransfer) {
                    const changedItems = modifyingItems
                      .filter((item: any) => item.newQuantity !== item.currentQuantity)
                      .map((item: any) => ({
                        itemId: item.itemId,
                        newQuantity: item.newQuantity,
                        modificationNotes: item.modificationNotes || undefined
                      }));
                    
                    if (changedItems.length > 0) {
                      modifyQuantitiesMutation.mutate({
                        id: selectedTransfer.id,
                        modifications: changedItems
                      });
                    } else {
                      setIsModifyQuantitiesOpen(false);
                    }
                  }
                }}
                disabled={modifyQuantitiesMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
                data-testid="btn-save-modifications"
              >
                {modifyQuantitiesMutation.isPending 
                  ? (isRTL ? "جاري الحفظ..." : "Saving...") 
                  : (isRTL ? "حفظ التعديلات" : "Save Changes")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
