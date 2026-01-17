import { useState, useEffect } from "react";
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
  ArrowLeft, FileText, MapPin, User, Calendar, PenTool, Building2, Warehouse, Trash2, Package, Printer, Download, MessageCircle, FileSpreadsheet
} from "lucide-react";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad, SignatureDisplay } from "@/components/signature-pad";
import { ExportButtons } from "@/components/export-buttons";
import { useBranches } from "@/hooks/useBranches";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import * as XLSX from "xlsx";

pdfMake.vfs = pdfFonts.vfs;

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

  // Generate PDF document definition
  const generatePdfDocDefinition = () => {
    if (!selectedTransfer) return null;
    
    const statusLabel = STATUS_OPTIONS.find(s => s.value === selectedTransfer.status)?.labelAr || selectedTransfer.status;
    const destName = selectedTransfer.destinationBranchName || 'غير محدد';
    const srcName = selectedTransfer.sourceBranchName || 'المستودع الرئيسي';
    
    const tableBody = [
      [
        { text: 'ملاحظات', style: 'tableHeader', alignment: 'right' },
        { text: 'الوحدة', style: 'tableHeader', alignment: 'center' },
        { text: 'الكمية', style: 'tableHeader', alignment: 'center' },
        { text: 'التصنيف', style: 'tableHeader', alignment: 'right' },
        { text: 'الصنف', style: 'tableHeader', alignment: 'right' },
        { text: '#', style: 'tableHeader', alignment: 'center' },
      ],
      ...transferItems.map((item, index) => [
        { text: item.notes || '-', alignment: 'right' },
        { text: item.unit, alignment: 'center' },
        { text: item.quantity.toString(), alignment: 'center', bold: true },
        { text: item.category || '-', alignment: 'right' },
        { text: item.itemName, alignment: 'right' },
        { text: (index + 1).toString(), alignment: 'center' },
      ])
    ];

    return {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [40, 60, 40, 60],
      content: [
        { text: 'أمر تحويل مواد', style: 'header', alignment: 'center' },
        { text: selectedTransfer.transferNumber, style: 'subheader', alignment: 'center', margin: [0, 0, 0, 20] },
        
        {
          columns: [
            { text: `الحالة: ${statusLabel}`, alignment: 'right', width: '*' },
            { text: `التاريخ: ${selectedTransfer.transferDate ? new Date(selectedTransfer.transferDate).toLocaleDateString('ar-SA') : '-'}`, alignment: 'left', width: '*' },
          ],
          margin: [0, 0, 0, 15]
        },
        
        {
          table: {
            widths: ['*', 'auto', '*'],
            body: [
              [
                { text: destName, alignment: 'center', bold: true },
                { text: '←', alignment: 'center', fontSize: 16 },
                { text: srcName, alignment: 'center', bold: true },
              ],
              [
                { text: 'إلى', alignment: 'center', color: 'gray', fontSize: 10 },
                { text: '', alignment: 'center' },
                { text: 'من', alignment: 'center', color: 'gray', fontSize: 10 },
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 20]
        },
        
        { text: 'الأصناف المحولة', style: 'sectionHeader', alignment: 'right', margin: [0, 10, 0, 10] },
        
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', '*', 'auto'],
            body: tableBody
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cccccc',
            vLineColor: () => '#cccccc',
          }
        },
        
        ...(selectedTransfer.driverName || selectedTransfer.vehicleNumber ? [
          { text: '', margin: [0, 20, 0, 0] },
          {
            columns: [
              { text: `المركبة: ${selectedTransfer.vehicleNumber || '-'}`, alignment: 'right', width: '*' },
              { text: `السائق: ${selectedTransfer.driverName || '-'}`, alignment: 'left', width: '*' },
            ]
          }
        ] : []),
        
        ...(selectedTransfer.notes ? [
          { text: 'ملاحظات:', style: 'sectionHeader', alignment: 'right', margin: [0, 15, 0, 5] },
          { text: selectedTransfer.notes, alignment: 'right' }
        ] : []),
        
        { text: '', margin: [0, 40, 0, 0] },
        {
          columns: [
            { 
              stack: [
                { text: 'توقيع المستلم', alignment: 'center' },
                { text: '________________', alignment: 'center', margin: [0, 30, 0, 0] }
              ],
              width: '*'
            },
            { 
              stack: [
                { text: 'توقيع المُرسل', alignment: 'center' },
                { text: '________________', alignment: 'center', margin: [0, 30, 0, 0] }
              ],
              width: '*'
            }
          ]
        }
      ],
      styles: {
        header: { fontSize: 18, bold: true },
        subheader: { fontSize: 14, color: 'gray' },
        sectionHeader: { fontSize: 12, bold: true },
        tableHeader: { bold: true, fillColor: '#f3f4f6', fontSize: 10 }
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 11
      }
    };
  };

  // Download PDF only
  const handleDownloadPdf = () => {
    const docDefinition = generatePdfDocDefinition();
    if (!docDefinition || !selectedTransfer) return;
    
    pdfMake.createPdf(docDefinition as any).download(`transfer-${selectedTransfer.transferNumber}.pdf`);
    
    toast({
      title: isRTL ? "تم تحميل الملف" : "File Downloaded",
      description: isRTL ? "تم تحميل ملف PDF بنجاح" : "PDF downloaded successfully",
    });
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

  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredTransfers || filteredTransfers.length === 0) {
      toast({
        title: isRTL ? "لا توجد بيانات" : "No Data",
        description: isRTL ? "لا توجد طلبات تحويل للتصدير" : "No transfer requests to export",
        variant: "destructive",
      });
      return;
    }

    const excelData = filteredTransfers.map((transfer) => ({
      "رقم التحويل": transfer.transferNumber,
      "من": transfer.sourceBranchName || "المستودع الرئيسي",
      "إلى": transfer.destinationBranchName || "-",
      "الحالة": STATUS_OPTIONS.find(s => s.value === transfer.status)?.labelAr || transfer.status,
      "السائق": transfer.driverName || "-",
      "المركبة": transfer.vehicleNumber || "-",
      "تاريخ التحويل": transfer.transferDate ? new Date(transfer.transferDate).toLocaleDateString('ar-SA') : "-",
      "ملاحظات": transfer.notes || "-",
      "أنشأه": transfer.createdByName || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "طلبات التحويل");
    
    const colWidths = [
      { wch: 18 }, // رقم التحويل
      { wch: 20 }, // من
      { wch: 20 }, // إلى
      { wch: 15 }, // الحالة
      { wch: 15 }, // السائق
      { wch: 12 }, // المركبة
      { wch: 15 }, // تاريخ التحويل
      { wch: 25 }, // ملاحظات
      { wch: 15 }, // أنشأه
    ];
    worksheet['!cols'] = colWidths;

    XLSX.writeFile(workbook, `طلبات-التحويل-${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: isRTL ? "تم التصدير" : "Exported",
      description: isRTL ? "تم تصدير البيانات إلى ملف Excel" : "Data exported to Excel file",
    });
  };

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
    items: [] as { itemId: number; itemName: string; category: string; quantity: number; unit: string; notes: string }[],
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
      items: [...prev.items, { itemId: 0, itemName: "", category: "", quantity: 1, unit: "كجم", notes: "" }],
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

  // Initialize source branch when user branch is available
  useEffect(() => {
    if (userBranchId && userBranch) {
      setNewTransfer(prev => ({
        ...prev,
        sourceBranchId: userBranchId,
        sourceBranchName: isRTL ? userBranch.nameAr || userBranch.name : userBranch.name,
      }));
    } else if (canSelectBranch) {
      // Admin - default to main warehouse as source
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
        destinationBranchName: destBranch?.nameAr || destBranch?.name || "",
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
    const sourceName = userBranch 
      ? (isRTL ? userBranch.nameAr || userBranch.name : userBranch.name)
      : (isRTL ? "المستودع الرئيسي" : "Main Warehouse");
    setNewTransfer({
      sourceBranchId: userBranchId || "main_warehouse",
      sourceBranchName: sourceName,
      destinationBranchId: "",
      destinationBranchName: "",
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

  const filteredTransfers = transfers.filter(transfer => {
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
  });

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

  // Status workflow based on user role and transfer direction
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
    
    // Non-admin users: check if they are source or destination
    const isSource = transfer.sourceBranchId === userBranchId;
    const isDestination = transfer.destinationBranchId === userBranchId;
    
    switch (transfer.status) {
      case "pending":
        // Destination branch can approve/reject incoming requests
        if (isDestination) {
          return ["approved", "rejected"];
        }
        // Source can cancel their own outgoing request
        if (isSource) {
          return ["cancelled"];
        }
        return [];
      case "approved":
        // Source branch starts the transit after approval
        if (isSource) {
          return ["in_transit", "cancelled"];
        }
        return [];
      case "in_transit":
        // Destination confirms delivery
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
                {isRTL ? "طلبات التحويل" : "Transfer Requests"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isRTL ? "تتبع تحويلات المواد بين الفروع والمستودع" : "Track material transfers between branches and warehouse"}
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
                <DialogTitle>{isRTL ? "إنشاء طلب تحويل مواد" : "Create Material Transfer Request"}</DialogTitle>
                <DialogDescription>
                  {isRTL ? "اختر الأصناف والكميات المطلوبة - سيتم إرسال الطلب للمراجعة والموافقة" : "Select items and quantities needed - request will be sent for review and approval"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Transfer Type Selection */}
                <div className="space-y-2">
                  <Label>{isRTL ? "نوع التحويل" : "Transfer Type"}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={transferType === "to_warehouse" ? "default" : "outline"}
                      className="flex items-center gap-2"
                      onClick={() => {
                        setTransferType("to_warehouse");
                        setNewTransfer(prev => ({ 
                          ...prev, 
                          destinationBranchId: "main_warehouse",
                          destinationBranchName: isRTL ? "المستودع الرئيسي" : "Main Warehouse"
                        }));
                      }}
                      data-testid="btn-type-warehouse"
                    >
                      <Warehouse className="w-4 h-4" />
                      {isRTL ? "إلى المستودع" : "To Warehouse"}
                    </Button>
                    <Button
                      type="button"
                      variant={transferType === "between_branches" ? "default" : "outline"}
                      className="flex items-center gap-2"
                      onClick={() => {
                        setTransferType("between_branches");
                        setNewTransfer(prev => ({ ...prev, destinationBranchId: "", destinationBranchName: "" }));
                      }}
                      data-testid="btn-type-branch"
                    >
                      <Building2 className="w-4 h-4" />
                      {isRTL ? "إلى فرع آخر" : "To Branch"}
                    </Button>
                  </div>
                </div>

                {/* Source Branch (Read-only for non-admins) */}
                <div className="space-y-2">
                  <Label>{isRTL ? "من (المصدر)" : "From (Source)"}</Label>
                  {canSelectBranch ? (
                    <Select 
                      value={newTransfer.sourceBranchId} 
                      onValueChange={(value) => {
                        const branch = branches.find(b => b.id === value);
                        setNewTransfer(prev => ({ 
                          ...prev, 
                          sourceBranchId: value,
                          sourceBranchName: branch ? (isRTL ? branch.nameAr || branch.name : branch.name) : ""
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
                            {isRTL ? branch.nameAr || branch.name : branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      value={newTransfer.sourceBranchName || (isRTL ? "فرعك" : "Your Branch")}
                      disabled
                      className="bg-muted"
                    />
                  )}
                </div>

                {/* Destination Selection */}
                <div className="space-y-2">
                  <Label>{isRTL ? "إلى (الوجهة)" : "To (Destination)"}</Label>
                  {transferType === "to_warehouse" && !canSelectBranch ? (
                    <Input 
                      value={isRTL ? "المستودع الرئيسي" : "Main Warehouse"}
                      disabled
                      className="bg-muted"
                    />
                  ) : (
                    <Select 
                      value={newTransfer.destinationBranchId} 
                      onValueChange={(value) => {
                        const branch = value === "main_warehouse" 
                          ? null 
                          : branches.find(b => b.id === value);
                        setNewTransfer(prev => ({ 
                          ...prev, 
                          destinationBranchId: value,
                          destinationBranchName: branch 
                            ? (isRTL ? branch.nameAr || branch.name : branch.name)
                            : (isRTL ? "المستودع الرئيسي" : "Main Warehouse")
                        }));
                      }}
                    >
                      <SelectTrigger data-testid="select-destination">
                        <SelectValue placeholder={isRTL ? "اختر الوجهة" : "Select destination"} />
                      </SelectTrigger>
                      <SelectContent>
                        {canSelectBranch && (
                          <SelectItem value="main_warehouse">
                            {isRTL ? "المستودع الرئيسي" : "Main Warehouse"}
                          </SelectItem>
                        )}
                        {branches
                          .filter(b => b.id !== newTransfer.sourceBranchId) // Exclude source branch
                          .map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {isRTL ? branch.nameAr || branch.name : branch.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

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
                    <div key={index} className="grid grid-cols-12 gap-2 items-end border-b pb-2" data-testid={`item-row-${index}`}>
                      <div className="col-span-5">
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
                        <Label className="text-xs">{isRTL ? "الكمية" : "Qty"}</Label>
                        <Input 
                          type="number" 
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateTransferItem(index, "quantity", parseInt(e.target.value) || 1)}
                          data-testid={`input-qty-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">{isRTL ? "الوحدة" : "Unit"}</Label>
                        <Input value={item.unit} disabled className="bg-muted" />
                      </div>
                      <div className="col-span-2">
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
                    createMutation.mutate(newTransfer);
                  }} 
                  disabled={!newTransfer.destinationBranchId || !newTransfer.sourceBranchId || newTransfer.items.length === 0 || createMutation.isPending}
                  data-testid="btn-submit-transfer"
                >
                  {createMutation.isPending ? (isRTL ? "جاري الإرسال..." : "Submitting...") : (isRTL ? "إرسال الطلب" : "Submit Request")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={isRTL ? "بحث برقم التحويل أو السائق..." : "Search by transfer number or driver..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]" data-testid="filter-status">
              <Filter className="w-4 h-4 mr-2" />
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
          <Button 
            variant="outline" 
            onClick={handleExportExcel}
            className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
            data-testid="btn-export-excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {isRTL ? "تصدير Excel" : "Export Excel"}
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "رقم التحويل" : "Transfer #"}</TableHead>
                  <TableHead>{isRTL ? "من" : "From"}</TableHead>
                  <TableHead>{isRTL ? "إلى" : "To"}</TableHead>
                  <TableHead>{isRTL ? "السائق" : "Driver"}</TableHead>
                  <TableHead>{isRTL ? "المركبة" : "Vehicle"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{isRTL ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      {isRTL ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filteredTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {isRTL ? "لا توجد تحويلات" : "No transfers found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransfers.map((transfer) => (
                    <TableRow key={transfer.id} data-testid={`transfer-row-${transfer.id}`}>
                      <TableCell className="font-mono text-sm">{transfer.transferNumber}</TableCell>
                      <TableCell>{transfer.sourceBranchName || (isRTL ? "المستودع الرئيسي" : "Main Warehouse")}</TableCell>
                      <TableCell>{transfer.destinationBranchName}</TableCell>
                      <TableCell>{transfer.driverName || "-"}</TableCell>
                      <TableCell>{transfer.vehicleNumber || "-"}</TableCell>
                      <TableCell>{getStatusBadge(transfer.status, isRTL)}</TableCell>
                      <TableCell>{new Date(transfer.transferDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleViewDetails(transfer)}
                            data-testid={`btn-view-${transfer.id}`}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          {getNextStatus(transfer).length > 0 && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleUpdateStatus(transfer)}
                              data-testid={`btn-update-${transfer.id}`}
                            >
                              <Truck className="w-4 h-4 text-blue-500" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
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
