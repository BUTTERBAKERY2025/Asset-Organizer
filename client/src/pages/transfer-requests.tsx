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
  Send, Plus, Search, Filter, Clock, CheckCircle, Truck, 
  ArrowLeft, FileText, MapPin, User, Calendar, PenTool
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SignaturePad, SignatureDisplay } from "@/components/signature-pad";
import { ExportButtons } from "@/components/export-buttons";

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

const STATUS_OPTIONS = [
  { value: "pending", labelAr: "قيد الانتظار", labelEn: "Pending", color: "bg-yellow-500", icon: Clock },
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

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isUpdateStatusOpen, setIsUpdateStatusOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<MaterialTransfer | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [newTransfer, setNewTransfer] = useState({
    sourceBranchId: "main_warehouse",
    sourceBranchName: isRTL ? "المستودع الرئيسي" : "Main Warehouse",
    destinationBranchId: "",
    destinationBranchName: "",
    transferDate: new Date().toISOString().split('T')[0],
    driverName: "",
    vehicleNumber: "",
    notes: "",
    items: [] as { itemName: string; quantity: number; unit: string }[],
  });

  const [statusUpdate, setStatusUpdate] = useState({
    status: "",
    notes: "",
    receiverSignature: null as string | null,
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: transfers = [], isLoading } = useQuery<MaterialTransfer[]>({
    queryKey: ["/api/warehouse/material-transfers", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
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
    mutationFn: async ({ id, status, notes, receiverSignature }: { id: number; status: string; notes?: string; receiverSignature?: string | null }) => {
      const response = await apiRequest("PUT", `/api/warehouse/material-transfers/${id}/status`, {
        status,
        notes,
        receiverSignature,
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
    setNewTransfer({
      sourceBranchId: "main_warehouse",
      sourceBranchName: isRTL ? "المستودع الرئيسي" : "Main Warehouse",
      destinationBranchId: "",
      destinationBranchName: "",
      transferDate: new Date().toISOString().split('T')[0],
      driverName: "",
      vehicleNumber: "",
      notes: "",
      items: [],
    });
  };

  const handleViewDetails = (transfer: MaterialTransfer) => {
    setSelectedTransfer(transfer);
    setIsViewOpen(true);
  };

  const handleUpdateStatus = (transfer: MaterialTransfer) => {
    setSelectedTransfer(transfer);
    setStatusUpdate({ status: "", notes: "", receiverSignature: null });
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

  const getNextStatus = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case "pending": return ["in_transit", "cancelled"];
      case "in_transit": return ["delivered", "cancelled"];
      default: return [];
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
                  {isRTL ? "تحويل جديد" : "New Transfer"}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{isRTL ? "إنشاء أمر تحويل جديد" : "Create New Transfer"}</DialogTitle>
                <DialogDescription>
                  {isRTL ? "أدخل تفاصيل التحويل" : "Enter transfer details"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{isRTL ? "من" : "From"}</Label>
                  <Input 
                    value={isRTL ? "المستودع الرئيسي" : "Main Warehouse"}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "إلى (الفرع)" : "To (Branch)"}</Label>
                  <Select 
                    value={newTransfer.destinationBranchId} 
                    onValueChange={(value) => setNewTransfer(prev => ({ ...prev, destinationBranchId: value }))}
                  >
                    <SelectTrigger data-testid="select-destination">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{isRTL ? "تاريخ التحويل" : "Transfer Date"}</Label>
                    <Input 
                      type="date" 
                      value={newTransfer.transferDate}
                      onChange={(e) => setNewTransfer(prev => ({ ...prev, transferDate: e.target.value }))}
                      data-testid="input-transfer-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{isRTL ? "رقم المركبة" : "Vehicle Number"}</Label>
                    <Input 
                      value={newTransfer.vehicleNumber}
                      onChange={(e) => setNewTransfer(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                      placeholder="ABC-1234"
                      data-testid="input-vehicle"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{isRTL ? "اسم السائق" : "Driver Name"}</Label>
                  <Input 
                    value={newTransfer.driverName}
                    onChange={(e) => setNewTransfer(prev => ({ ...prev, driverName: e.target.value }))}
                    placeholder={isRTL ? "اسم السائق" : "Driver name"}
                    data-testid="input-driver"
                  />
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
                  onClick={() => createMutation.mutate(newTransfer)} 
                  disabled={!newTransfer.destinationBranchId || createMutation.isPending}
                  data-testid="btn-submit-transfer"
                >
                  {createMutation.isPending ? (isRTL ? "جاري الإنشاء..." : "Creating...") : (isRTL ? "إنشاء التحويل" : "Create Transfer")}
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
                          {getNextStatus(transfer.status).length > 0 && (
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                {isRTL ? "تفاصيل التحويل" : "Transfer Details"}
              </DialogTitle>
            </DialogHeader>
            {selectedTransfer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{isRTL ? "رقم التحويل" : "Transfer #"}</p>
                    <p className="font-mono">{selectedTransfer.transferNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isRTL ? "الحالة" : "Status"}</p>
                    {getStatusBadge(selectedTransfer.status, isRTL)}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                  <div className="flex-1 text-center">
                    <MapPin className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{isRTL ? "من" : "From"}</p>
                    <p className="font-medium">{selectedTransfer.sourceBranchName || (isRTL ? "المستودع الرئيسي" : "Main Warehouse")}</p>
                  </div>
                  <Send className="w-5 h-5 text-primary" />
                  <div className="flex-1 text-center">
                    <MapPin className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{isRTL ? "إلى" : "To"}</p>
                    <p className="font-medium">{selectedTransfer.destinationBranchName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">{isRTL ? "السائق" : "Driver"}</p>
                      <p>{selectedTransfer.driverName || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">{isRTL ? "المركبة" : "Vehicle"}</p>
                      <p>{selectedTransfer.vehicleNumber || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground">{isRTL ? "تاريخ التحويل" : "Transfer Date"}</p>
                      <p>{new Date(selectedTransfer.transferDate).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}</p>
                    </div>
                  </div>
                  {selectedTransfer.receivedByName && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <div>
                        <p className="text-muted-foreground">{isRTL ? "استلمه" : "Received By"}</p>
                        <p>{selectedTransfer.receivedByName}</p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedTransfer.notes && (
                  <div>
                    <p className="text-muted-foreground text-sm">{isRTL ? "ملاحظات" : "Notes"}</p>
                    <p className="text-sm">{selectedTransfer.notes}</p>
                  </div>
                )}
                
                {selectedTransfer.receiverSignature && (
                  <SignatureDisplay 
                    signature={selectedTransfer.receiverSignature} 
                    label={isRTL ? "توقيع المستلم" : "Receiver Signature"} 
                  />
                )}
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
                    {selectedTransfer && getNextStatus(selectedTransfer.status).map((status) => {
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
                    });
                  }
                }}
                disabled={!statusUpdate.status || updateStatusMutation.isPending || (statusUpdate.status === "delivered" && !statusUpdate.receiverSignature)}
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
