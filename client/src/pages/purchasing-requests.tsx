import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ShoppingCart, Search, Filter, Clock, CheckCircle, XCircle, 
  ArrowLeft, Eye, Package, Truck
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExportButtons } from "@/components/export-buttons";

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

type Branch = {
  id: string;
  name: string;
};

const STATUS_OPTIONS = [
  { value: "pending", labelAr: "قيد الانتظار", labelEn: "Pending", color: "bg-yellow-500", icon: Clock },
  { value: "approved", labelAr: "موافق عليه", labelEn: "Approved", color: "bg-green-500", icon: CheckCircle },
  { value: "rejected", labelAr: "مرفوض", labelEn: "Rejected", color: "bg-red-500", icon: XCircle },
  { value: "ordered", labelAr: "تم الطلب", labelEn: "Ordered", color: "bg-blue-500", icon: Package },
  { value: "received", labelAr: "تم الاستلام", labelEn: "Received", color: "bg-cyan-500", icon: Truck },
  { value: "cancelled", labelAr: "ملغي", labelEn: "Cancelled", color: "bg-gray-400", icon: XCircle },
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

export default function PurchasingRequestsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<PurchasingRequest | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: requests = [] } = useQuery<PurchasingRequest[]>({
    queryKey: ["/api/purchasing/requests"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest(`/api/purchasing/requests/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchasing/requests"] });
      toast({
        title: isRTL ? "تم التحديث" : "Updated",
        description: isRTL ? "تم تحديث حالة الطلب بنجاح" : "Request status updated successfully",
      });
    },
    onError: () => {
      toast({
        title: isRTL ? "خطأ" : "Error",
        description: isRTL ? "فشل في تحديث حالة الطلب" : "Failed to update request status",
        variant: "destructive",
      });
    },
  });

  const filteredRequests = requests.filter(request => {
    if (filterStatus !== "all" && request.status !== filterStatus) return false;
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

  const exportColumns = [
    { header: isRTL ? "رقم الطلب" : "Request #", key: "requestNumber", width: 18 },
    { header: isRTL ? "الفرع" : "Branch", key: "branchName", width: 18 },
    { header: isRTL ? "الحالة" : "Status", key: "statusText", width: 15 },
    { header: isRTL ? "المورد" : "Vendor", key: "vendorName", width: 18 },
    { header: isRTL ? "التاريخ" : "Date", key: "dateText", width: 15 },
  ];

  const exportData = filteredRequests.map(r => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === r.status);
    return {
      requestNumber: r.requestNumber,
      branchName: getBranchName(r.branchId),
      statusText: statusOption ? (isRTL ? statusOption.labelAr : statusOption.labelEn) : r.status,
      vendorName: r.vendorName || "-",
      dateText: r.createdAt ? new Date(r.createdAt).toLocaleDateString("ar-SA") : "",
    };
  });

  return (
    <Layout>
      <div className="p-4 space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/warehouse-dashboard">
              <Button variant="ghost" size="icon" data-testid="btn-back">
                <ArrowLeft className={`w-5 h-5 ${isRTL ? "rotate-180" : ""}`} />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isRTL ? "طلبات المشتريات" : "Purchasing Requests"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isRTL ? "إدارة طلبات الشراء من الموردين" : "Manage purchase orders from vendors"}
              </p>
            </div>
          </div>
          <ExportButtons
            data={exportData}
            columns={exportColumns}
            fileName={`purchasing-requests-${new Date().toISOString().split('T')[0]}`}
            title={isRTL ? "طلبات المشتريات" : "Purchasing Requests"}
            sheetName={isRTL ? "المشتريات" : "Purchasing"}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={isRTL ? "بحث برقم الطلب أو المورد..." : "Search by request number or vendor..."}
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? "قائمة طلبات المشتريات" : "Purchasing Requests List"}</CardTitle>
            <CardDescription>
              {isRTL ? `${filteredRequests.length} طلب` : `${filteredRequests.length} requests`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isRTL ? "رقم الطلب" : "Request #"}</TableHead>
                    <TableHead>{isRTL ? "الفرع" : "Branch"}</TableHead>
                    <TableHead>{isRTL ? "المورد" : "Vendor"}</TableHead>
                    <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{isRTL ? "التكلفة المتوقعة" : "Est. Cost"}</TableHead>
                    <TableHead>{isRTL ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{isRTL ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {isRTL ? "لا توجد طلبات مشتريات" : "No purchasing requests found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRequests.map((request) => (
                      <TableRow key={request.id} data-testid={`row-request-${request.id}`}>
                        <TableCell className="font-mono font-medium">{request.requestNumber}</TableCell>
                        <TableCell>{getBranchName(request.branchId)}</TableCell>
                        <TableCell>{request.vendorName || "-"}</TableCell>
                        <TableCell>{getStatusBadge(request.status, isRTL)}</TableCell>
                        <TableCell>
                          {request.totalEstimatedCost ? `${parseFloat(request.totalEstimatedCost).toLocaleString()} ر.س` : "-"}
                        </TableCell>
                        <TableCell>
                          {request.createdAt ? new Date(request.createdAt).toLocaleDateString("ar-SA") : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedRequest(request);
                                setIsDetailsOpen(true);
                              }}
                              data-testid={`btn-view-${request.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {request.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600"
                                  onClick={() => updateStatusMutation.mutate({ id: request.id, status: "approved" })}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`btn-approve-${request.id}`}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600"
                                  onClick={() => updateStatusMutation.mutate({ id: request.id, status: "rejected" })}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`btn-reject-${request.id}`}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {request.status === "approved" && (
                              <Button
                                variant="ghost"
                                size="sm"
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
                                size="sm"
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

        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isRTL ? "تفاصيل طلب المشتريات" : "Purchasing Request Details"}</DialogTitle>
              <DialogDescription>
                {selectedRequest?.requestNumber}
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{isRTL ? "الفرع" : "Branch"}</p>
                    <p className="font-medium">{getBranchName(selectedRequest.branchId)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? "الحالة" : "Status"}</p>
                    <div className="mt-1">{getStatusBadge(selectedRequest.status, isRTL)}</div>
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
                    <p className="text-muted-foreground">{isRTL ? "الطالب" : "Requested By"}</p>
                    <p className="font-medium">{selectedRequest.requestedByName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? "تاريخ الإنشاء" : "Created"}</p>
                    <p className="font-medium">
                      {selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleDateString("ar-SA") : "-"}
                    </p>
                  </div>
                </div>
                {selectedRequest.notes && (
                  <div>
                    <p className="text-muted-foreground text-sm">{isRTL ? "ملاحظات" : "Notes"}</p>
                    <p className="text-sm mt-1">{selectedRequest.notes}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                {isRTL ? "إغلاق" : "Close"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
