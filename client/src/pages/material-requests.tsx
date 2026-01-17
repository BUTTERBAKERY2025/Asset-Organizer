import { useState } from "react";
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
  PackageCheck, Plus, Search, Filter, Clock, CheckCircle, XCircle, 
  AlertCircle, Eye, Edit, Trash2, Send, ArrowLeft, FileText, Truck
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type MaterialRequest = {
  id: number;
  requestNumber: string;
  branchId: string;
  branchName: string;
  requestType: string;
  priority: string;
  status: string;
  requestDate: string;
  requiredDate: string;
  totalItems: number;
  notes: string;
  requestedBy: string;
  requestedByName: string;
  reviewedBy: string;
  reviewedByName: string;
  reviewedAt: string;
  reviewNotes: string;
  createdAt: string;
};

type MaterialRequestItem = {
  id: number;
  requestId: number;
  itemId: number;
  itemName: string;
  category: string;
  requestedQuantity: number;
  approvedQuantity: number;
  unit: string;
  notes: string;
};

type Branch = {
  id: string;
  name: string;
  nameAr: string;
};

const MATERIAL_CATEGORIES = [
  { value: "raw_materials", labelAr: "مواد خام", labelEn: "Raw Materials" },
  { value: "consumables", labelAr: "مستهلكات", labelEn: "Consumables" },
  { value: "packaging", labelAr: "مواد تغليف", labelEn: "Packaging" },
  { value: "primary_production", labelAr: "مواد إنتاج أولية", labelEn: "Primary Production" },
];

const PRIORITY_OPTIONS = [
  { value: "normal", labelAr: "عادي", labelEn: "Normal" },
  { value: "urgent", labelAr: "عاجل", labelEn: "Urgent" },
  { value: "critical", labelAr: "حرج", labelEn: "Critical" },
];

const STATUS_OPTIONS = [
  { value: "draft", labelAr: "مسودة", labelEn: "Draft", color: "bg-gray-500" },
  { value: "pending", labelAr: "قيد الانتظار", labelEn: "Pending", color: "bg-yellow-500" },
  { value: "approved", labelAr: "موافق عليه", labelEn: "Approved", color: "bg-green-500" },
  { value: "rejected", labelAr: "مرفوض", labelEn: "Rejected", color: "bg-red-500" },
  { value: "fulfilled", labelAr: "منفذ", labelEn: "Fulfilled", color: "bg-blue-500" },
  { value: "forwarded_to_purchasing", labelAr: "محول للمشتريات", labelEn: "Forwarded to Purchasing", color: "bg-purple-500" },
  { value: "cancelled", labelAr: "ملغي", labelEn: "Cancelled", color: "bg-gray-400" },
];

function getStatusBadge(status: string, isRTL: boolean) {
  const statusOption = STATUS_OPTIONS.find(s => s.value === status);
  if (!statusOption) return <Badge>{status}</Badge>;
  return (
    <Badge className={`${statusOption.color} text-white`}>
      {isRTL ? statusOption.labelAr : statusOption.labelEn}
    </Badge>
  );
}

function getPriorityBadge(priority: string, isRTL: boolean) {
  const priorityOption = PRIORITY_OPTIONS.find(p => p.value === priority);
  if (!priorityOption) return <Badge variant="outline">{priority}</Badge>;
  const colors = {
    normal: "bg-gray-100 text-gray-800",
    urgent: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };
  return (
    <Badge className={colors[priority as keyof typeof colors] || ""}>
      {isRTL ? priorityOption.labelAr : priorityOption.labelEn}
    </Badge>
  );
}

export default function MaterialRequestsPage() {
  const { t, i18n } = useTranslation("platform-home");
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isFulfillOpen, setIsFulfillOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [fulfillData, setFulfillData] = useState({ driverName: "", vehicleNumber: "", notes: "" });

  const [newRequest, setNewRequest] = useState({
    branchId: "",
    branchName: "",
    requestType: "raw_materials",
    priority: "normal",
    requiredDate: "",
    notes: "",
    items: [] as { itemName: string; category: string; requestedQuantity: number; unit: string; notes: string }[],
  });

  const [reviewData, setReviewData] = useState({
    status: "",
    reviewNotes: "",
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: requests = [], isLoading } = useQuery<MaterialRequest[]>({
    queryKey: ["/api/warehouse/material-requests", filterStatus, filterBranch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterBranch !== "all") params.append("branchId", filterBranch);
      const response = await fetch(`/api/warehouse/material-requests?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch requests");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newRequest) => {
      const branch = branches.find(b => b.id === data.branchId);
      const response = await apiRequest("POST", "/api/warehouse/material-requests", {
        ...data,
        branchName: branch?.nameAr || branch?.name || "",
        requestDate: new Date().toISOString().split('T')[0],
        status: "pending",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/material-requests"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: isRTL ? "تم إنشاء الطلب بنجاح" : "Request created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: isRTL ? "فشل في إنشاء الطلب" : "Failed to create request",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: number; status: string; reviewNotes: string }) => {
      const response = await apiRequest("POST", `/api/warehouse/material-requests/${id}/review`, {
        status,
        reviewNotes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/material-requests"] });
      setIsReviewOpen(false);
      setSelectedRequest(null);
      toast({ title: isRTL ? "تم تحديث حالة الطلب" : "Request status updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: isRTL ? "فشل في تحديث الحالة" : "Failed to update status",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const fulfillMutation = useMutation({
    mutationFn: async ({ id, driverName, vehicleNumber, notes }: { id: number; driverName: string; vehicleNumber: string; notes: string }) => {
      const response = await apiRequest("POST", `/api/warehouse/material-requests/${id}/fulfill`, {
        driverName,
        vehicleNumber,
        notes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/material-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/material-transfers"] });
      setIsFulfillOpen(false);
      setSelectedRequest(null);
      setFulfillData({ driverName: "", vehicleNumber: "", notes: "" });
      toast({ 
        title: isRTL ? "تم تنفيذ الطلب بنجاح" : "Request fulfilled successfully",
        description: isRTL ? `تم إنشاء تحويل جديد` : `Transfer created`
      });
    },
    onError: (error: any) => {
      toast({ 
        title: isRTL ? "فشل في تنفيذ الطلب" : "Failed to fulfill request",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setNewRequest({
      branchId: "",
      branchName: "",
      requestType: "raw_materials",
      priority: "normal",
      requiredDate: "",
      notes: "",
      items: [],
    });
  };

  const addItem = () => {
    setNewRequest(prev => ({
      ...prev,
      items: [...prev.items, { itemName: "", category: prev.requestType, requestedQuantity: 1, unit: "كجم", notes: "" }],
    }));
  };

  const removeItem = (index: number) => {
    setNewRequest(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setNewRequest(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  };

  const handleCreateRequest = () => {
    if (!newRequest.branchId) {
      toast({ title: isRTL ? "يرجى اختيار الفرع" : "Please select a branch", variant: "destructive" });
      return;
    }
    if (newRequest.items.length === 0) {
      toast({ title: isRTL ? "يرجى إضافة مادة واحدة على الأقل" : "Please add at least one item", variant: "destructive" });
      return;
    }
    createMutation.mutate(newRequest);
  };

  const handleReview = (request: MaterialRequest) => {
    setSelectedRequest(request);
    setReviewData({ status: "", reviewNotes: "" });
    setIsReviewOpen(true);
  };

  const handleViewDetails = (request: MaterialRequest) => {
    setSelectedRequest(request);
    setIsViewOpen(true);
  };

  const handleFulfill = (request: MaterialRequest) => {
    setSelectedRequest(request);
    setFulfillData({ driverName: "", vehicleNumber: "", notes: "" });
    setIsFulfillOpen(true);
  };

  const filteredRequests = requests.filter(request => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        request.requestNumber.toLowerCase().includes(query) ||
        request.branchName.toLowerCase().includes(query) ||
        request.requestedByName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

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
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
              <PackageCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isRTL ? "طلبات المواد" : "Material Requests"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isRTL ? "إنشاء ومتابعة طلبات المواد الخام والمستلزمات" : "Create and track raw material requests"}
              </p>
            </div>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-create-request">
                <Plus className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                {isRTL ? "طلب جديد" : "New Request"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{isRTL ? "إنشاء طلب مواد جديد" : "Create New Material Request"}</DialogTitle>
                <DialogDescription>
                  {isRTL ? "أدخل تفاصيل الطلب والمواد المطلوبة" : "Enter request details and required materials"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? "الفرع" : "Branch"}</Label>
                    <Select value={newRequest.branchId} onValueChange={(value) => setNewRequest(prev => ({ ...prev, branchId: value }))}>
                      <SelectTrigger data-testid="select-branch">
                        <SelectValue placeholder={isRTL ? "اختر الفرع" : "Select branch"} />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {isRTL ? branch.nameAr || branch.name : branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "نوع المواد" : "Material Type"}</Label>
                    <Select value={newRequest.requestType} onValueChange={(value) => setNewRequest(prev => ({ ...prev, requestType: value }))}>
                      <SelectTrigger data-testid="select-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIAL_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {isRTL ? cat.labelAr : cat.labelEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? "الأولوية" : "Priority"}</Label>
                    <Select value={newRequest.priority} onValueChange={(value) => setNewRequest(prev => ({ ...prev, priority: value }))}>
                      <SelectTrigger data-testid="select-priority">
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
                    <Label>{isRTL ? "تاريخ الاستحقاق" : "Required Date"}</Label>
                    <Input 
                      type="date" 
                      value={newRequest.requiredDate}
                      onChange={(e) => setNewRequest(prev => ({ ...prev, requiredDate: e.target.value }))}
                      data-testid="input-required-date"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
                  <Textarea 
                    value={newRequest.notes}
                    onChange={(e) => setNewRequest(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."}
                    data-testid="input-notes"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{isRTL ? "المواد المطلوبة" : "Requested Items"}</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem} data-testid="btn-add-item">
                      <Plus className="w-4 h-4 mr-1" />
                      {isRTL ? "إضافة مادة" : "Add Item"}
                    </Button>
                  </div>
                  {newRequest.items.map((item, index) => (
                    <Card key={index} className="p-3">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4">
                          <Label className="text-xs">{isRTL ? "اسم المادة" : "Item Name"}</Label>
                          <Input 
                            value={item.itemName}
                            onChange={(e) => updateItem(index, "itemName", e.target.value)}
                            placeholder={isRTL ? "اسم المادة" : "Item name"}
                            data-testid={`input-item-name-${index}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">{isRTL ? "الكمية" : "Quantity"}</Label>
                          <Input 
                            type="number"
                            min={1}
                            value={item.requestedQuantity}
                            onChange={(e) => updateItem(index, "requestedQuantity", parseInt(e.target.value) || 1)}
                            data-testid={`input-item-qty-${index}`}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">{isRTL ? "الوحدة" : "Unit"}</Label>
                          <Select value={item.unit} onValueChange={(value) => updateItem(index, "unit", value)}>
                            <SelectTrigger data-testid={`select-item-unit-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="كجم">كجم</SelectItem>
                              <SelectItem value="جرام">جرام</SelectItem>
                              <SelectItem value="لتر">لتر</SelectItem>
                              <SelectItem value="مل">مل</SelectItem>
                              <SelectItem value="قطعة">قطعة</SelectItem>
                              <SelectItem value="علبة">علبة</SelectItem>
                              <SelectItem value="كرتون">كرتون</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">{isRTL ? "ملاحظة" : "Note"}</Label>
                          <Input 
                            value={item.notes}
                            onChange={(e) => updateItem(index, "notes", e.target.value)}
                            placeholder={isRTL ? "ملاحظة" : "Note"}
                            data-testid={`input-item-note-${index}`}
                          />
                        </div>
                        <div className="col-span-1">
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeItem(index)}
                            data-testid={`btn-remove-item-${index}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {newRequest.items.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {isRTL ? "لم تتم إضافة أي مواد بعد" : "No items added yet"}
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  {isRTL ? "إلغاء" : "Cancel"}
                </Button>
                <Button onClick={handleCreateRequest} disabled={createMutation.isPending} data-testid="btn-submit-request">
                  {createMutation.isPending ? (isRTL ? "جاري الإرسال..." : "Submitting...") : (isRTL ? "إرسال الطلب" : "Submit Request")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={isRTL ? "بحث برقم الطلب أو الفرع..." : "Search by request number or branch..."}
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
          <Select value={filterBranch} onValueChange={setFilterBranch}>
            <SelectTrigger className="w-[180px]" data-testid="filter-branch">
              <SelectValue placeholder={isRTL ? "الفرع" : "Branch"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isRTL ? "جميع الفروع" : "All Branches"}</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {isRTL ? branch.nameAr || branch.name : branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? "رقم الطلب" : "Request #"}</TableHead>
                  <TableHead>{isRTL ? "الفرع" : "Branch"}</TableHead>
                  <TableHead>{isRTL ? "نوع المواد" : "Type"}</TableHead>
                  <TableHead>{isRTL ? "الأولوية" : "Priority"}</TableHead>
                  <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isRTL ? "تاريخ الطلب" : "Request Date"}</TableHead>
                  <TableHead>{isRTL ? "مقدم الطلب" : "Requested By"}</TableHead>
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
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {isRTL ? "لا توجد طلبات" : "No requests found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((request) => {
                    const typeLabel = MATERIAL_CATEGORIES.find(c => c.value === request.requestType);
                    return (
                      <TableRow key={request.id} data-testid={`request-row-${request.id}`}>
                        <TableCell className="font-mono text-sm">{request.requestNumber}</TableCell>
                        <TableCell>{request.branchName}</TableCell>
                        <TableCell>{isRTL ? typeLabel?.labelAr : typeLabel?.labelEn}</TableCell>
                        <TableCell>{getPriorityBadge(request.priority, isRTL)}</TableCell>
                        <TableCell>{getStatusBadge(request.status, isRTL)}</TableCell>
                        <TableCell>{new Date(request.requestDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</TableCell>
                        <TableCell>{request.requestedByName || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleViewDetails(request)}
                              data-testid={`btn-view-${request.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {request.status === "pending" && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleReview(request)}
                                data-testid={`btn-review-${request.id}`}
                              >
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              </Button>
                            )}
                            {request.status === "approved" && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleFulfill(request)}
                                data-testid={`btn-fulfill-${request.id}`}
                                title={isRTL ? "تنفيذ الطلب" : "Fulfill Request"}
                              >
                                <Truck className="w-4 h-4 text-blue-500" />
                              </Button>
                            )}
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {isRTL ? "تفاصيل الطلب" : "Request Details"}
              </DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{isRTL ? "رقم الطلب" : "Request #"}</p>
                    <p className="font-mono">{selectedRequest.requestNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? "الحالة" : "Status"}</p>
                    {getStatusBadge(selectedRequest.status, isRTL)}
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? "الفرع" : "Branch"}</p>
                    <p>{selectedRequest.branchName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? "الأولوية" : "Priority"}</p>
                    {getPriorityBadge(selectedRequest.priority, isRTL)}
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? "تاريخ الطلب" : "Request Date"}</p>
                    <p>{new Date(selectedRequest.requestDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? "مقدم الطلب" : "Requested By"}</p>
                    <p>{selectedRequest.requestedByName || "-"}</p>
                  </div>
                </div>
                {selectedRequest.notes && (
                  <div>
                    <p className="text-muted-foreground text-sm">{isRTL ? "ملاحظات" : "Notes"}</p>
                    <p className="text-sm">{selectedRequest.notes}</p>
                  </div>
                )}
                {selectedRequest.reviewNotes && (
                  <div>
                    <p className="text-muted-foreground text-sm">{isRTL ? "ملاحظات المراجعة" : "Review Notes"}</p>
                    <p className="text-sm">{selectedRequest.reviewNotes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? "مراجعة الطلب" : "Review Request"}</DialogTitle>
              <DialogDescription>
                {isRTL ? `مراجعة الطلب رقم ${selectedRequest?.requestNumber}` : `Review request ${selectedRequest?.requestNumber}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{isRTL ? "القرار" : "Decision"}</Label>
                <Select value={reviewData.status} onValueChange={(value) => setReviewData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger data-testid="select-review-status">
                    <SelectValue placeholder={isRTL ? "اختر القرار" : "Select decision"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">{isRTL ? "موافقة" : "Approve"}</SelectItem>
                    <SelectItem value="rejected">{isRTL ? "رفض" : "Reject"}</SelectItem>
                    <SelectItem value="forwarded_to_purchasing">{isRTL ? "تحويل للمشتريات" : "Forward to Purchasing"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "ملاحظات المراجعة" : "Review Notes"}</Label>
                <Textarea 
                  value={reviewData.reviewNotes}
                  onChange={(e) => setReviewData(prev => ({ ...prev, reviewNotes: e.target.value }))}
                  placeholder={isRTL ? "أدخل ملاحظاتك..." : "Enter your notes..."}
                  data-testid="input-review-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReviewOpen(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button 
                onClick={() => {
                  if (selectedRequest && reviewData.status) {
                    reviewMutation.mutate({
                      id: selectedRequest.id,
                      status: reviewData.status,
                      reviewNotes: reviewData.reviewNotes,
                    });
                  }
                }}
                disabled={!reviewData.status || reviewMutation.isPending}
                data-testid="btn-submit-review"
              >
                {reviewMutation.isPending ? (isRTL ? "جاري التحديث..." : "Updating...") : (isRTL ? "تأكيد" : "Confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isFulfillOpen} onOpenChange={setIsFulfillOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                {isRTL ? "تنفيذ الطلب" : "Fulfill Request"}
              </DialogTitle>
              <DialogDescription>
                {isRTL ? `إنشاء تحويل لتنفيذ الطلب رقم ${selectedRequest?.requestNumber}` : `Create transfer to fulfill request ${selectedRequest?.requestNumber}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{isRTL ? "اسم السائق" : "Driver Name"}</Label>
                <Input
                  value={fulfillData.driverName}
                  onChange={(e) => setFulfillData(prev => ({ ...prev, driverName: e.target.value }))}
                  placeholder={isRTL ? "أدخل اسم السائق..." : "Enter driver name..."}
                  data-testid="input-driver-name"
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "رقم المركبة" : "Vehicle Number"}</Label>
                <Input
                  value={fulfillData.vehicleNumber}
                  onChange={(e) => setFulfillData(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                  placeholder={isRTL ? "أدخل رقم المركبة..." : "Enter vehicle number..."}
                  data-testid="input-vehicle-number"
                />
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
                <Textarea 
                  value={fulfillData.notes}
                  onChange={(e) => setFulfillData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."}
                  data-testid="input-fulfill-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsFulfillOpen(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button 
                onClick={() => {
                  if (selectedRequest) {
                    fulfillMutation.mutate({
                      id: selectedRequest.id,
                      driverName: fulfillData.driverName,
                      vehicleNumber: fulfillData.vehicleNumber,
                      notes: fulfillData.notes,
                    });
                  }
                }}
                disabled={fulfillMutation.isPending}
                data-testid="btn-submit-fulfill"
              >
                {fulfillMutation.isPending ? (isRTL ? "جاري التنفيذ..." : "Processing...") : (isRTL ? "تنفيذ" : "Fulfill")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
