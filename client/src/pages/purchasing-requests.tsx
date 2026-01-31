import { useState, useRef } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ShoppingCart, Search, Filter, Clock, CheckCircle, XCircle, 
  ArrowLeft, Eye, Package, Truck, Plus, Printer, Edit, Trash2,
  AlertTriangle, Calendar, ChevronsUpDown, Check
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExportButtons } from "@/components/export-buttons";
import { useReactToPrint } from "react-to-print";
import { cn } from "@/lib/utils";

type PurchasingRequest = {
  id: number;
  requestNumber: string;
  sourceMaterialRequestId: number;
  branchId: string;
  status: string;
  priority: string;
  totalEstimatedCost: string;
  vendorName: string;
  expectedDeliveryDate: string;
  notes: string;
  requestedBy: string;
  requestedByName: string;
  approvedBy: string;
  approvedByName: string;
  createdAt: string;
};

type PurchasingRequestItem = {
  id: number;
  itemId: number;
  itemName: string;
  requestedQuantity: number;  // Database field name
  approvedQuantity: number;   // Used to store available quantity
  unit: string;
  unitPrice: string | null;   // Database field name
};

type PurchasingRequestWithItems = PurchasingRequest & {
  items: PurchasingRequestItem[];
};

type Branch = {
  id: string;
  name: string;
};

type WarehouseItem = {
  id: number;
  name: string;
  unit: string;
  category: string;
};

const STATUS_OPTIONS = [
  { value: "pending", labelAr: "قيد الانتظار", labelEn: "Pending", color: "bg-yellow-500", icon: Clock },
  { value: "approved", labelAr: "موافق عليه", labelEn: "Approved", color: "bg-green-500", icon: CheckCircle },
  { value: "rejected", labelAr: "مرفوض", labelEn: "Rejected", color: "bg-red-500", icon: XCircle },
  { value: "ordered", labelAr: "تم الطلب", labelEn: "Ordered", color: "bg-blue-500", icon: Package },
  { value: "received", labelAr: "تم الاستلام", labelEn: "Received", color: "bg-cyan-500", icon: Truck },
  { value: "cancelled", labelAr: "ملغي", labelEn: "Cancelled", color: "bg-gray-400", icon: XCircle },
];

const PRIORITY_OPTIONS = [
  { value: "low", labelAr: "منخفضة", labelEn: "Low", color: "bg-gray-400" },
  { value: "normal", labelAr: "عادية", labelEn: "Normal", color: "bg-blue-500" },
  { value: "high", labelAr: "عالية", labelEn: "High", color: "bg-orange-500" },
  { value: "urgent", labelAr: "عاجلة", labelEn: "Urgent", color: "bg-red-500" },
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

function getPriorityBadge(priority: string, isRTL: boolean) {
  const priorityOption = PRIORITY_OPTIONS.find(p => p.value === priority);
  if (!priorityOption) return <Badge variant="outline">{priority}</Badge>;
  return (
    <Badge className={`${priorityOption.color} text-white`}>
      {isRTL ? priorityOption.labelAr : priorityOption.labelEn}
    </Badge>
  );
}

export default function PurchasingRequestsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<PurchasingRequestWithItems | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Create form state
  const [newRequest, setNewRequest] = useState({
    branchId: "",
    priority: "normal",
    vendorName: "",
    expectedDeliveryDate: "",
    notes: "",
    items: [] as { itemId: number; itemName: string; quantityRequested: string; availableQuantity: string; unit: string; estimatedUnitCost: string }[]
  });

  // Edit form state
  const [editData, setEditData] = useState({
    vendorName: "",
    expectedDeliveryDate: "",
    notes: ""
  });

  // Track open state for each item's combobox
  const [openItemPopovers, setOpenItemPopovers] = useState<Record<number, boolean>>({});

  const { data: requests = [] } = useQuery<PurchasingRequest[]>({
    queryKey: ["/api/purchasing/requests"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: warehouseItems = [] } = useQuery<WarehouseItem[]>({
    queryKey: ["/api/warehouse/items"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, additionalData }: { id: number; status: string; additionalData?: any }) => {
      const response = await apiRequest("PUT", `/api/purchasing/requests/${id}/status`, { status, ...additionalData });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/requests"] });
      toast({
        title: isRTL ? "تم التحديث" : "Updated",
        description: isRTL ? "تم تحديث حالة الطلب بنجاح" : "Request status updated successfully",
      });
      setIsDetailsOpen(false);
      setIsEditOpen(false);
    },
    onError: () => {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: isRTL ? "فشل في تحديث حالة الطلب" : "Failed to update request status",
        variant: "destructive",
      });
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: typeof newRequest) => {
      const response = await apiRequest("POST", "/api/purchasing/requests", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/requests"] });
      toast({
        title: isRTL ? "تم الإنشاء" : "Created",
        description: isRTL ? "تم إنشاء طلب المشتريات بنجاح" : "Purchasing request created successfully",
      });
      setIsCreateOpen(false);
      resetCreateForm();
    },
    onError: () => {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: isRTL ? "فشل في إنشاء طلب المشتريات" : "Failed to create purchasing request",
        variant: "destructive",
      });
    },
  });

  const resetCreateForm = () => {
    setNewRequest({
      branchId: "",
      priority: "normal",
      vendorName: "",
      expectedDeliveryDate: "",
      notes: "",
      items: []
    });
  };

  const addItemToRequest = () => {
    setNewRequest(prev => ({
      ...prev,
      items: [...prev.items, { itemId: 0, itemName: "", quantityRequested: "1", availableQuantity: "", unit: "unit", estimatedUnitCost: "" }]
    }));
  };

  const removeItemFromRequest = (index: number) => {
    setNewRequest(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItemInRequest = (index: number, field: string, value: any) => {
    setNewRequest(prev => {
      const items = [...prev.items];
      if (field === 'itemId') {
        const item = warehouseItems.find(i => i.id === value);
        if (item) {
          items[index] = { ...items[index], itemId: value, itemName: item.name, unit: item.unit };
        }
      } else {
        items[index] = { ...items[index], [field]: value };
      }
      return { ...prev, items };
    });
  };

  const fetchRequestDetails = async (id: number) => {
    try {
      const response = await apiRequest("GET", `/api/purchasing/requests/${id}`);
      const data = await response.json();
      setSelectedRequest(data);
      setIsDetailsOpen(true);
    } catch (error) {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: isRTL ? "فشل في جلب تفاصيل الطلب" : "Failed to fetch request details",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = () => {
    if (selectedRequest) {
      setEditData({
        vendorName: selectedRequest.vendorName || "",
        expectedDeliveryDate: selectedRequest.expectedDeliveryDate || "",
        notes: selectedRequest.notes || ""
      });
      setIsEditOpen(true);
    }
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedRequest?.requestNumber || "purchasing-request",
  });

  const filteredRequests = requests.filter(request => {
    if (filterStatus !== "all" && request.status !== filterStatus) return false;
    if (filterBranch !== "all" && request.branchId !== filterBranch) return false;
    if (filterPriority !== "all" && request.priority !== filterPriority) return false;
    if (filterDateFrom && new Date(request.createdAt) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(request.createdAt) > new Date(filterDateTo + "T23:59:59")) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        request.requestNumber.toLowerCase().includes(query) ||
        request.vendorName?.toLowerCase().includes(query) ||
        request.requestedByName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.name || branchId;
  };

  const calculateTotalCost = () => {
    return newRequest.items.reduce((sum, item) => {
      const qty = parseFloat(item.quantityRequested) || 0;
      const cost = parseFloat(item.estimatedUnitCost) || 0;
      return sum + (qty * cost);
    }, 0);
  };

  const exportColumns = [
    { header: isRTL ? "رقم الطلب" : "Request #", key: "requestNumber", width: 18 },
    { header: isRTL ? "الفرع" : "Branch", key: "branchName", width: 18 },
    { header: isRTL ? "الحالة" : "Status", key: "statusText", width: 15 },
    { header: isRTL ? "الأولوية" : "Priority", key: "priorityText", width: 12 },
    { header: isRTL ? "المورد" : "Vendor", key: "vendorName", width: 18 },
    { header: isRTL ? "التكلفة" : "Cost", key: "cost", width: 15 },
    { header: isRTL ? "التاريخ" : "Date", key: "dateText", width: 15 },
  ];

  const exportData = filteredRequests.map(r => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === r.status);
    const priorityOption = PRIORITY_OPTIONS.find(p => p.value === r.priority);
    return {
      requestNumber: r.requestNumber,
      branchName: getBranchName(r.branchId),
      statusText: statusOption ? (isRTL ? statusOption.labelAr : statusOption.labelEn) : r.status,
      priorityText: priorityOption ? (isRTL ? priorityOption.labelAr : priorityOption.labelEn) : r.priority,
      vendorName: r.vendorName || "-",
      cost: r.totalEstimatedCost ? `${parseFloat(r.totalEstimatedCost).toLocaleString()} ر.س` : "-",
      dateText: r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "",
    };
  });

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/warehouse-dashboard">
              <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowLeft className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />
              </Button>
            </Link>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
                {isRTL ? "طلبات المشتريات" : "Purchasing Requests"}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {isRTL ? "إدارة طلبات الشراء من الموردين" : "Manage purchase orders from vendors"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button onClick={() => setIsCreateOpen(true)} className="flex-1 sm:flex-none h-11 sm:h-9" data-testid="btn-create-request">
              <Plus className="w-4 h-4 mr-2" />
              {isRTL ? "طلب جديد" : "New Request"}
            </Button>
            <ExportButtons
              data={exportData}
              columns={exportColumns}
              fileName={`purchasing-requests-${new Date().toISOString().split('T')[0]}`}
              title={isRTL ? "طلبات المشتريات" : "Purchasing Requests"}
              sheetName={isRTL ? "المشتريات" : "Purchasing"}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={isRTL ? "بحث برقم الطلب أو المورد..." : "Search by request number or vendor..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 sm:h-9"
              data-testid="input-search"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[140px] h-11 sm:h-9" data-testid="filter-status">
                <Filter className="w-4 h-4 mr-1 sm:mr-2" />
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
              <SelectTrigger className="w-full sm:w-[140px] h-11 sm:h-9" data-testid="filter-branch">
                <SelectValue placeholder={isRTL ? "الفرع" : "Branch"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "كل الفروع" : "All Branches"}</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-full sm:w-[120px] h-11 sm:h-9" data-testid="filter-priority">
                <SelectValue placeholder={isRTL ? "الأولوية" : "Priority"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "كل الأولويات" : "All Priorities"}</SelectItem>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {isRTL ? opt.labelAr : opt.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="flex-1 sm:w-[130px] h-11 sm:h-9"
              data-testid="filter-date-from"
            />
            <span className="text-muted-foreground text-xs">-</span>
            <Input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="flex-1 sm:w-[130px] h-11 sm:h-9"
              data-testid="filter-date-to"
            />
          </div>
        </div>

        <Card>
          <CardHeader className="p-3 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{isRTL ? "قائمة طلبات المشتريات" : "Purchasing Requests List"}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {isRTL ? `${filteredRequests.length} طلب` : `${filteredRequests.length} requests`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">{isRTL ? "رقم الطلب" : "Request #"}</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">{isRTL ? "الفرع" : "Branch"}</TableHead>
                    <TableHead className="text-xs sm:text-sm">{isRTL ? "المورد" : "Vendor"}</TableHead>
                    <TableHead className="text-xs sm:text-sm">{isRTL ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">{isRTL ? "الأولوية" : "Priority"}</TableHead>
                    <TableHead className="text-xs sm:text-sm">{isRTL ? "التكلفة" : "Cost"}</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden lg:table-cell">{isRTL ? "تاريخ التسليم" : "Delivery"}</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell">{isRTL ? "التاريخ" : "Date"}</TableHead>
                    <TableHead className="text-xs sm:text-sm">{isRTL ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {isRTL ? "لا توجد طلبات مشتريات" : "No purchasing requests found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((request) => (
                      <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                        <TableCell className="font-mono font-medium text-xs sm:text-sm">{request.requestNumber}</TableCell>
                        <TableCell className="text-xs sm:text-sm hidden md:table-cell">{getBranchName(request.branchId)}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{request.vendorName || "-"}</TableCell>
                        <TableCell><span className="text-[10px] sm:text-xs">{getStatusBadge(request.status, isRTL)}</span></TableCell>
                        <TableCell className="hidden md:table-cell"><span className="text-[10px] sm:text-xs">{getPriorityBadge(request.priority, isRTL)}</span></TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {request.totalEstimatedCost ? `${parseFloat(request.totalEstimatedCost).toLocaleString()} ر.س` : "-"}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                          {request.expectedDeliveryDate ? new Date(request.expectedDeliveryDate).toLocaleDateString("en-GB") : "-"}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm hidden sm:table-cell">
                          {request.createdAt ? new Date(request.createdAt).toLocaleDateString("en-GB") : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => fetchRequestDetails(request.id)}
                              data-testid={`btn-view-${request.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {request.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-green-600"
                                  onClick={() => updateStatusMutation.mutate({ id: request.id, status: "approved" })}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`btn-approve-${request.id}`}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-600"
                                  onClick={() => updateStatusMutation.mutate({ id: request.id, status: "rejected" })}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`btn-reject-${request.id}`}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-gray-500"
                                  onClick={() => updateStatusMutation.mutate({ id: request.id, status: "cancelled" })}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`btn-cancel-${request.id}`}
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {request.status === "approved" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-blue-600"
                                onClick={() => updateStatusMutation.mutate({ id: request.id, status: "ordered" })}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`btn-order-${request.id}`}
                              >
                                <Package className="w-4 h-4" />
                              </Button>
                            )}
                            {request.status === "ordered" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-cyan-600"
                                onClick={() => updateStatusMutation.mutate({ id: request.id, status: "received" })}
                                disabled={updateStatusMutation.isPending}
                                data-testid={`btn-receive-${request.id}`}
                              >
                                <Truck className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Details Dialog with Print */}
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{isRTL ? "تفاصيل طلب المشتريات" : "Purchasing Request Details"}</span>
                <div className="flex gap-2">
                  {selectedRequest?.status === "pending" && (
                    <Button variant="outline" size="sm" onClick={openEditDialog} data-testid="btn-edit-request">
                      <Edit className="w-4 h-4 mr-1" />
                      {isRTL ? "تعديل" : "Edit"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handlePrint()} data-testid="btn-print-request">
                    <Printer className="w-4 h-4 mr-1" />
                    {isRTL ? "طباعة" : "Print"}
                  </Button>
                </div>
              </DialogTitle>
              <DialogDescription>
                {selectedRequest?.requestNumber}
              </DialogDescription>
            </DialogHeader>
            
            <div ref={printRef} className="space-y-4 print:p-4">
              {/* Print Header */}
              <div className="hidden print:block text-center mb-4">
                <h1 className="text-xl font-bold">{isRTL ? "طلب مشتريات" : "Purchasing Request"}</h1>
                <p className="text-lg">{selectedRequest?.requestNumber}</p>
              </div>

              {selectedRequest && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">{isRTL ? "الفرع" : "Branch"}</p>
                      <p className="font-medium">{getBranchName(selectedRequest.branchId)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{isRTL ? "الحالة" : "Status"}</p>
                      <div className="mt-1">{getStatusBadge(selectedRequest.status, isRTL)}</div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{isRTL ? "الأولوية" : "Priority"}</p>
                      <div className="mt-1">{getPriorityBadge(selectedRequest.priority, isRTL)}</div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{isRTL ? "المورد" : "Vendor"}</p>
                      <p className="font-medium">{selectedRequest.vendorName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{isRTL ? "التكلفة المتوقعة" : "Est. Cost"}</p>
                      <p className="font-medium">
                        {selectedRequest.totalEstimatedCost ? `${parseFloat(selectedRequest.totalEstimatedCost).toLocaleString()} ر.س` : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{isRTL ? "تاريخ التسليم المتوقع" : "Expected Delivery"}</p>
                      <p className="font-medium">
                        {selectedRequest.expectedDeliveryDate ? new Date(selectedRequest.expectedDeliveryDate).toLocaleDateString("en-GB") : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{isRTL ? "الطالب" : "Requested By"}</p>
                      <p className="font-medium">{selectedRequest.requestedByName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{isRTL ? "تاريخ الإنشاء" : "Created"}</p>
                      <p className="font-medium">
                        {selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleDateString("en-GB") : "-"}
                      </p>
                    </div>
                    {selectedRequest.approvedByName && (
                      <div>
                        <p className="text-muted-foreground">{isRTL ? "الموافق" : "Approved By"}</p>
                        <p className="font-medium">{selectedRequest.approvedByName}</p>
                      </div>
                    )}
                  </div>

                  {selectedRequest.notes && (
                    <div>
                      <p className="text-muted-foreground text-sm">{isRTL ? "ملاحظات" : "Notes"}</p>
                      <p className="text-sm mt-1 p-2 bg-muted rounded">{selectedRequest.notes}</p>
                    </div>
                  )}

                  <Separator />

                  {/* Items Table */}
                  <div>
                    <h3 className="font-semibold mb-2">{isRTL ? "الأصناف المطلوبة" : "Requested Items"}</h3>
                    {selectedRequest.items && selectedRequest.items.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>{isRTL ? "الصنف" : "Item"}</TableHead>
                            <TableHead className="text-center">{isRTL ? "الكمية المطلوبة" : "Req Qty"}</TableHead>
                            <TableHead className="text-center">{isRTL ? "الكمية المتوفرة" : "Available"}</TableHead>
                            <TableHead>{isRTL ? "الوحدة" : "Unit"}</TableHead>
                            <TableHead className="text-center">{isRTL ? "سعر الوحدة" : "Unit Price"}</TableHead>
                            <TableHead className="text-center">{isRTL ? "الإجمالي" : "Total"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedRequest.items.map((item, idx) => (
                            <TableRow key={item.id || idx}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell className="font-medium">{item.itemName}</TableCell>
                              <TableCell className="text-center font-mono">{item.requestedQuantity || 0}</TableCell>
                              <TableCell className="text-center font-mono">{item.approvedQuantity || 0}</TableCell>
                              <TableCell>{item.unit}</TableCell>
                              <TableCell className="text-center font-mono">
                                {item.unitPrice ? `${parseFloat(item.unitPrice).toLocaleString()} ر.س` : "-"}
                              </TableCell>
                              <TableCell className="text-center font-mono font-bold">
                                {item.unitPrice && item.requestedQuantity 
                                  ? `${(parseFloat(item.unitPrice) * item.requestedQuantity).toLocaleString()} ر.س` 
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center py-4 text-muted-foreground">
                        {isRTL ? "لا توجد أصناف في هذا الطلب" : "No items in this request"}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="print:hidden">
              <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                {isRTL ? "إغلاق" : "Close"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Request Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isRTL ? "إنشاء طلب مشتريات جديد" : "Create New Purchasing Request"}</DialogTitle>
              <DialogDescription>
                {isRTL ? "أدخل تفاصيل الطلب والأصناف المطلوبة" : "Enter request details and items"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isRTL ? "الفرع" : "Branch"} *</Label>
                  <Select value={newRequest.branchId} onValueChange={(v) => setNewRequest(prev => ({ ...prev, branchId: v }))}>
                    <SelectTrigger data-testid="create-branch">
                      <SelectValue placeholder={isRTL ? "اختر الفرع" : "Select Branch"} />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "الأولوية" : "Priority"}</Label>
                  <Select value={newRequest.priority} onValueChange={(v) => setNewRequest(prev => ({ ...prev, priority: v }))}>
                    <SelectTrigger data-testid="create-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {isRTL ? opt.labelAr : opt.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "اسم المورد" : "Vendor Name"}</Label>
                  <Input
                    value={newRequest.vendorName}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, vendorName: e.target.value }))}
                    placeholder={isRTL ? "اسم المورد (اختياري)" : "Vendor name (optional)"}
                    data-testid="create-vendor"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "تاريخ التسليم المتوقع" : "Expected Delivery Date"}</Label>
                  <Input
                    type="date"
                    value={newRequest.expectedDeliveryDate}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                    data-testid="create-delivery-date"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
                <Textarea
                  value={newRequest.notes}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."}
                  data-testid="create-notes"
                />
              </div>

              <Separator />

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{isRTL ? "الأصناف المطلوبة" : "Requested Items"}</Label>
                  <Button variant="outline" size="sm" onClick={addItemToRequest} data-testid="btn-add-item">
                    <Plus className="w-4 h-4 mr-1" />
                    {isRTL ? "إضافة صنف" : "Add Item"}
                  </Button>
                </div>

                {newRequest.items.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground border rounded">
                    {isRTL ? "اضغط على 'إضافة صنف' لإضافة أصناف للطلب" : "Click 'Add Item' to add items to the request"}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {newRequest.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 border rounded">
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">{isRTL ? "الصنف" : "Item"}</Label>
                          <Popover 
                            open={openItemPopovers[idx] || false} 
                            onOpenChange={(open) => setOpenItemPopovers(prev => ({ ...prev, [idx]: open }))}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openItemPopovers[idx] || false}
                                className="w-full justify-between font-normal"
                                data-testid={`item-select-${idx}`}
                              >
                                {item.itemId ? (
                                  <span className="truncate">{item.itemName}</span>
                                ) : (
                                  <span className="text-muted-foreground">{isRTL ? "اختر صنف..." : "Select item..."}</span>
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[320px] p-0" align="start" side="bottom" sideOffset={4}>
                              <Command shouldFilter={true}>
                                <CommandInput placeholder={isRTL ? "ابحث عن صنف..." : "Search item..."} data-testid={`item-search-${idx}`} />
                                <CommandEmpty>{isRTL ? "لا توجد نتائج" : "No results found"}</CommandEmpty>
                                <ScrollArea className="h-[250px]">
                                  <CommandGroup heading={isRTL ? "الأصناف" : "Items"}>
                                    {warehouseItems.map((wi) => (
                                      <CommandItem
                                        key={wi.id}
                                        value={wi.name}
                                        onSelect={() => {
                                          updateItemInRequest(idx, 'itemId', wi.id);
                                          setOpenItemPopovers(prev => ({ ...prev, [idx]: false }));
                                        }}
                                        className="cursor-pointer"
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            item.itemId === wi.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <span className="flex-1 truncate">{wi.name}</span>
                                        <span className="text-xs text-muted-foreground ml-2">{wi.category}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </ScrollArea>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">{isRTL ? "الكمية المطلوبة" : "Req Qty"}</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantityRequested}
                            onChange={(e) => updateItemInRequest(idx, 'quantityRequested', e.target.value)}
                            data-testid={`item-qty-${idx}`}
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs text-red-600">{isRTL ? "الكمية المتوفرة *" : "Avail Qty *"}</Label>
                          <Input
                            type="number"
                            min="0"
                            value={item.availableQuantity}
                            onChange={(e) => updateItemInRequest(idx, 'availableQuantity', e.target.value)}
                            placeholder={isRTL ? "إلزامي" : "Required"}
                            className={!item.availableQuantity ? "border-red-300" : ""}
                            data-testid={`item-available-qty-${idx}`}
                          />
                        </div>
                        <div className="col-span-1 space-y-1">
                          <Label className="text-xs">{isRTL ? "الوحدة" : "Unit"}</Label>
                          <Input value={item.unit} disabled className="bg-muted text-xs" />
                        </div>
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">{isRTL ? "سعر الوحدة" : "Unit Price"}</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.estimatedUnitCost}
                            onChange={(e) => updateItemInRequest(idx, 'estimatedUnitCost', e.target.value)}
                            placeholder="0.00"
                            data-testid={`item-price-${idx}`}
                          />
                        </div>
                        <div className="col-span-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500"
                            onClick={() => removeItemFromRequest(idx)}
                            data-testid={`btn-remove-item-${idx}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {newRequest.items.length > 0 && (
                  <div className="flex justify-end p-3 bg-muted rounded">
                    <div className="text-lg font-bold">
                      {isRTL ? "الإجمالي:" : "Total:"} {calculateTotalCost().toLocaleString()} ر.س
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetCreateForm(); }} data-testid="btn-cancel-create">
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button 
                onClick={() => {
                  const missingAvailableQty = newRequest.items.some(item => !item.availableQuantity || item.availableQuantity === "");
                  if (missingAvailableQty) {
                    toast({
                      title: isRTL ? "خطأ" : "Error",
                      description: isRTL ? "يجب إدخال الكمية المتوفرة لجميع الأصناف" : "Available quantity is required for all items",
                      variant: "destructive",
                    });
                    return;
                  }
                  createRequestMutation.mutate(newRequest);
                }}
                disabled={!newRequest.branchId || newRequest.items.length === 0 || newRequest.items.some(item => !item.availableQuantity) || createRequestMutation.isPending}
                data-testid="btn-submit-create"
              >
                {createRequestMutation.isPending ? (isRTL ? "جاري الإنشاء..." : "Creating...") : (isRTL ? "إنشاء الطلب" : "Create Request")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Request Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isRTL ? "تعديل طلب المشتريات" : "Edit Purchasing Request"}</DialogTitle>
              <DialogDescription>
                {selectedRequest?.requestNumber}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{isRTL ? "اسم المورد" : "Vendor Name"}</Label>
                <Input
                  value={editData.vendorName}
                  onChange={(e) => setEditData(prev => ({ ...prev, vendorName: e.target.value }))}
                  placeholder={isRTL ? "اسم المورد" : "Vendor name"}
                  data-testid="edit-vendor"
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "تاريخ التسليم المتوقع" : "Expected Delivery Date"}</Label>
                <Input
                  type="date"
                  value={editData.expectedDeliveryDate}
                  onChange={(e) => setEditData(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                  data-testid="edit-delivery-date"
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
                <Textarea
                  value={editData.notes}
                  onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={isRTL ? "ملاحظات..." : "Notes..."}
                  data-testid="edit-notes"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button 
                onClick={() => {
                  if (selectedRequest) {
                    updateStatusMutation.mutate({ 
                      id: selectedRequest.id, 
                      status: selectedRequest.status,
                      additionalData: editData 
                    });
                  }
                }}
                disabled={updateStatusMutation.isPending}
                data-testid="btn-submit-edit"
              >
                {updateStatusMutation.isPending ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ التغييرات" : "Save Changes")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
