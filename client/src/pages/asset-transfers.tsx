import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeftRight, Plus, Search, Check, X, Clock, Send, Package, Building2, FileText, Eye, Hash, MapPin, Tag, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { TablePagination } from "@/components/ui/pagination";
import type { AssetTransfer, InventoryItem, Branch } from "@shared/schema";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  approved: "تمت الموافقة",
  in_transit: "في الطريق",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  in_transit: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function AssetTransfersPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<AssetTransfer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [newTransfer, setNewTransfer] = useState({
    itemId: "",
    fromBranchId: "",
    toBranchId: "",
    quantity: 1,
    reason: "",
    notes: "",
  });

  const [confirmData, setConfirmData] = useState({
    receiverName: "",
    signature: "",
  });

  const [assetSearch, setAssetSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: transfers = [], isLoading } = useQuery<AssetTransfer[]>({
    queryKey: ["/api/asset-transfers"],
  });

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newTransfer) => {
      const res = await fetch("/api/asset-transfers", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create transfer");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-transfers"] });
      setIsCreateOpen(false);
      setNewTransfer({ itemId: "", fromBranchId: "", toBranchId: "", quantity: 1, reason: "", notes: "" });
      toast({ title: "تم إنشاء طلب التحويل بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "فشل إنشاء طلب التحويل", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/asset-transfers/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve transfer");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-transfers"] });
      toast({ title: "تمت الموافقة على التحويل" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "فشل الموافقة على التحويل", variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ id, receiverName, signature }: { id: number; receiverName: string; signature?: string }) => {
      const res = await fetch(`/api/asset-transfers/${id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ receiverName, signature }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to confirm transfer");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      setIsConfirmOpen(false);
      setSelectedTransfer(null);
      setConfirmData({ receiverName: "", signature: "" });
      toast({ title: "تم تأكيد استلام الأصل بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "فشل تأكيد الاستلام", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      const res = await fetch(`/api/asset-transfers/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to cancel transfer");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-transfers"] });
      toast({ title: "تم إلغاء التحويل" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message || "فشل إلغاء التحويل", variant: "destructive" });
    },
  });

  const filteredTransfers = transfers.filter((transfer) => {
    const item = items.find((i) => i.id === transfer.itemId);
    const matchesSearch = item?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         transfer.transferNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || transfer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getBranchName = (branchId: string) => {
    return branches.find((b) => b.id === branchId)?.name || branchId;
  };

  const getItemName = (itemId: string) => {
    return items.find((i) => i.id === itemId)?.name || itemId;
  };

  const handleCreateTransfer = () => {
    if (!newTransfer.itemId || !newTransfer.fromBranchId || !newTransfer.toBranchId) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    if (newTransfer.fromBranchId === newTransfer.toBranchId) {
      toast({ title: "خطأ", description: "لا يمكن التحويل لنفس الفرع", variant: "destructive" });
      return;
    }
    createMutation.mutate(newTransfer);
  };

  const handleConfirmReceipt = () => {
    if (!selectedTransfer || !confirmData.receiverName) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم المستلم", variant: "destructive" });
      return;
    }
    confirmMutation.mutate({
      id: selectedTransfer.id,
      receiverName: confirmData.receiverName,
      signature: confirmData.signature || undefined,
    });
  };

  const handleItemSelect = (item: InventoryItem) => {
    setSelectedItem(item);
    setNewTransfer({
      ...newTransfer,
      itemId: item.id,
      fromBranchId: item.branchId,
      quantity: 1,
    });
    setAssetSearch("");
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = 
        item.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
        item.id.toLowerCase().includes(assetSearch.toLowerCase()) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(assetSearch.toLowerCase()));
      const matchesBranch = branchFilter === "all" || item.branchId === branchFilter;
      return matchesSearch && matchesBranch && item.quantity > 0;
    });
  }, [items, assetSearch, branchFilter]);

  const resetCreateDialog = () => {
    setIsCreateOpen(false);
    setNewTransfer({ itemId: "", fromBranchId: "", toBranchId: "", quantity: 1, reason: "", notes: "" });
    setSelectedItem(null);
    setAssetSearch("");
    setBranchFilter("all");
  };

  const pendingCount = transfers.filter((t) => t.status === "pending").length;
  const approvedCount = transfers.filter((t) => t.status === "approved").length;
  const completedCount = transfers.filter((t) => t.status === "completed").length;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">تحويلات الأصول</h1>
            <p className="text-gray-600">إدارة تحويلات الأصول والمعدات بين الفروع</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) resetCreateDialog(); else setIsCreateOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700" data-testid="button-create-transfer">
                <Plus className="h-4 w-4 ml-2" />
                طلب تحويل جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <ArrowLeftRight className="h-5 w-5 text-amber-600" />
                  إنشاء طلب تحويل جديد
                </DialogTitle>
                <DialogDescription>ابحث عن الأصل المراد تحويله وحدد الفرع المستلم</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                {!selectedItem ? (
                  <>
                    <div className="space-y-3">
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        البحث عن الأصل
                      </Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            value={assetSearch}
                            onChange={(e) => setAssetSearch(e.target.value)}
                            placeholder="ابحث بالاسم أو الرقم التسلسلي أو رمز الأصل..."
                            className="pr-10"
                            data-testid="input-asset-search"
                          />
                        </div>
                        <Select value={branchFilter} onValueChange={setBranchFilter}>
                          <SelectTrigger className="w-40" data-testid="select-branch-filter">
                            <SelectValue placeholder="كل الفروع" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">كل الفروع</SelectItem>
                            {branches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <ScrollArea className="h-64 border rounded-lg">
                      {filteredItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-gray-500">
                          <Package className="h-10 w-10 text-gray-300 mb-2" />
                          <p>لا توجد أصول مطابقة للبحث</p>
                        </div>
                      ) : (
                        <div className="p-2 space-y-2">
                          {filteredItems.slice(0, 20).map((item) => (
                            <div
                              key={item.id}
                              onClick={() => handleItemSelect(item)}
                              className="p-3 border rounded-lg hover:bg-amber-50 hover:border-amber-300 cursor-pointer transition-colors"
                              data-testid={`item-option-${item.id}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900">{item.name}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {item.category}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Hash className="h-3 w-3" />
                                      {item.id}
                                    </span>
                                    {item.serialNumber && (
                                      <span className="flex items-center gap-1 font-mono">
                                        <Tag className="h-3 w-3" />
                                        {item.serialNumber}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {getBranchName(item.branchId)}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-left">
                                  <span className="text-sm font-medium text-gray-700">
                                    الكمية: {item.quantity.toLocaleString('en-US')} {item.unit}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                          {filteredItems.length > 20 && (
                            <p className="text-center text-sm text-gray-500 py-2">
                              يظهر 20 من {filteredItems.length} نتيجة - حدد البحث للمزيد
                            </p>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                  </>
                ) : (
                  <>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="font-semibold text-lg">{selectedItem.name}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Hash className="h-4 w-4" />
                              <span>رمز الأصل:</span>
                              <span className="font-mono font-medium text-gray-900">{selectedItem.id}</span>
                            </div>
                            {selectedItem.serialNumber && (
                              <div className="flex items-center gap-2 text-gray-600">
                                <Tag className="h-4 w-4" />
                                <span>الرقم التسلسلي:</span>
                                <span className="font-mono font-medium text-gray-900">{selectedItem.serialNumber}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-gray-600">
                              <Package className="h-4 w-4" />
                              <span>التصنيف:</span>
                              <span className="font-medium text-gray-900">{selectedItem.category}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <MapPin className="h-4 w-4" />
                              <span>الفرع الحالي:</span>
                              <span className="font-medium text-gray-900">{getBranchName(selectedItem.branchId)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <span>الكمية المتاحة:</span>
                              <span className="font-bold text-gray-900">{selectedItem.quantity.toLocaleString('en-US')} {selectedItem.unit}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(null);
                            setNewTransfer({ ...newTransfer, itemId: "", fromBranchId: "" });
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <X className="h-4 w-4" />
                          تغيير
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <Label className="text-base font-semibold">تفاصيل التحويل</Label>
                      
                      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 text-center">
                          <div className="text-xs text-gray-500 mb-1">من</div>
                          <div className="flex items-center justify-center gap-2">
                            <Building2 className="h-4 w-4 text-red-500" />
                            <span className="font-medium">{getBranchName(newTransfer.fromBranchId)}</span>
                          </div>
                        </div>
                        <ArrowRight className="h-6 w-6 text-amber-600" />
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1 text-center">إلى</div>
                          <Select value={newTransfer.toBranchId} onValueChange={(v) => setNewTransfer({ ...newTransfer, toBranchId: v })}>
                            <SelectTrigger data-testid="select-to-branch" className="border-amber-300">
                              <SelectValue placeholder="اختر الفرع المستلم" />
                            </SelectTrigger>
                            <SelectContent>
                              {branches.filter((b) => b.id !== newTransfer.fromBranchId).map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-green-500" />
                                    {branch.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>الكمية المراد تحويلها</Label>
                          <Input
                            type="number"
                            min={1}
                            max={selectedItem.quantity}
                            value={newTransfer.quantity}
                            onChange={(e) => setNewTransfer({ ...newTransfer, quantity: Math.min(parseInt(e.target.value) || 1, selectedItem.quantity) })}
                            data-testid="input-quantity"
                          />
                          <p className="text-xs text-gray-500">الحد الأقصى: {selectedItem.quantity.toLocaleString('en-US')}</p>
                        </div>
                        <div className="space-y-2">
                          <Label>سبب التحويل <span className="text-red-500">*</span></Label>
                          <Input
                            value={newTransfer.reason}
                            onChange={(e) => setNewTransfer({ ...newTransfer, reason: e.target.value })}
                            placeholder="مثال: نقص في الفرع المستلم"
                            data-testid="input-reason"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>ملاحظات إضافية</Label>
                        <Textarea
                          value={newTransfer.notes}
                          onChange={(e) => setNewTransfer({ ...newTransfer, notes: e.target.value })}
                          placeholder="أي ملاحظات أخرى تتعلق بالتحويل (اختياري)"
                          rows={2}
                          data-testid="input-notes"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={resetCreateDialog}>إلغاء</Button>
                {selectedItem && (
                  <Button 
                    onClick={handleCreateTransfer} 
                    disabled={createMutation.isPending || !newTransfer.toBranchId || !newTransfer.reason}
                    className="bg-amber-600 hover:bg-amber-700"
                    data-testid="button-submit-transfer"
                  >
                    {createMutation.isPending ? (
                      <>جاري الإنشاء...</>
                    ) : (
                      <>
                        <Send className="h-4 w-4 ml-2" />
                        إرسال طلب التحويل
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">قيد الانتظار</p>
                  <p className="text-2xl font-bold" data-testid="count-pending">{pendingCount.toLocaleString('en-US')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Send className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">تمت الموافقة</p>
                  <p className="text-2xl font-bold" data-testid="count-approved">{approvedCount.toLocaleString('en-US')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Check className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">مكتملة</p>
                  <p className="text-2xl font-bold" data-testid="count-completed">{completedCount.toLocaleString('en-US')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                سجل التحويلات
                <Badge variant="secondary" className="mr-2">
                  إجمالي: {filteredTransfers.length} عملية نقل
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="بحث..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 w-64"
                    data-testid="input-search"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40" data-testid="select-status-filter">
                    <SelectValue placeholder="كل الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الحالات</SelectItem>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="approved">تمت الموافقة</SelectItem>
                    <SelectItem value="completed">مكتمل</SelectItem>
                    <SelectItem value="cancelled">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransfers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>لا توجد تحويلات</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-3 px-4 font-medium">رقم التحويل</th>
                      <th className="text-right py-3 px-4 font-medium">الأصل</th>
                      <th className="text-right py-3 px-4 font-medium">من</th>
                      <th className="text-right py-3 px-4 font-medium">إلى</th>
                      <th className="text-right py-3 px-4 font-medium">التاريخ</th>
                      <th className="text-right py-3 px-4 font-medium">الحالة</th>
                      <th className="text-right py-3 px-4 font-medium">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransfers.slice((currentPage - 1) * 10, currentPage * 10).map((transfer) => (
                      <tr key={transfer.id} className="border-b hover:bg-gray-50" data-testid={`row-transfer-${transfer.id}`}>
                        <td className="py-3 px-4 font-mono text-sm">{transfer.transferNumber}</td>
                        <td className="py-3 px-4">{getItemName(transfer.itemId)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            {getBranchName(transfer.fromBranchId)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            {getBranchName(transfer.toBranchId)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {transfer.requestedAt ? format(new Date(transfer.requestedAt), "dd/MM/yyyy", { locale: ar }) : "-"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={statusColors[transfer.status] || "bg-gray-100"}>
                            {statusLabels[transfer.status] || transfer.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTransfer(transfer);
                                setIsDetailOpen(true);
                              }}
                              data-testid={`button-view-${transfer.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {transfer.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => approveMutation.mutate(transfer.id)}
                                  disabled={approveMutation.isPending}
                                  className="text-green-600 hover:text-green-700"
                                  data-testid={`button-approve-${transfer.id}`}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => cancelMutation.mutate({ id: transfer.id })}
                                  disabled={cancelMutation.isPending}
                                  className="text-red-600 hover:text-red-700"
                                  data-testid={`button-cancel-${transfer.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {transfer.status === "approved" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedTransfer(transfer);
                                  setIsConfirmOpen(true);
                                }}
                                data-testid={`button-confirm-${transfer.id}`}
                              >
                                تأكيد الاستلام
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <TablePagination
                  currentPage={currentPage}
                  totalItems={filteredTransfers.length}
                  itemsPerPage={10}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد استلام الأصل</DialogTitle>
            <DialogDescription>
              {selectedTransfer && `تأكيد استلام: ${getItemName(selectedTransfer.itemId)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم المستلم</Label>
              <Input
                value={confirmData.receiverName}
                onChange={(e) => setConfirmData({ ...confirmData, receiverName: e.target.value })}
                placeholder="أدخل اسم المستلم"
                data-testid="input-receiver-name"
              />
            </div>
            <div className="space-y-2">
              <Label>التوقيع (اختياري)</Label>
              <Textarea
                value={confirmData.signature}
                onChange={(e) => setConfirmData({ ...confirmData, signature: e.target.value })}
                placeholder="يمكنك كتابة اسمك كتوقيع أو تركه فارغاً"
                data-testid="input-signature"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>إلغاء</Button>
            <Button onClick={handleConfirmReceipt} disabled={confirmMutation.isPending} data-testid="button-submit-confirm">
              {confirmMutation.isPending ? "جاري التأكيد..." : "تأكيد الاستلام"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل التحويل</DialogTitle>
          </DialogHeader>
          {selectedTransfer && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">رقم التحويل</p>
                  <p className="font-mono">{selectedTransfer.transferNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">الحالة</p>
                  <Badge className={statusColors[selectedTransfer.status]}>
                    {statusLabels[selectedTransfer.status]}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">الأصل</p>
                <p className="font-medium">{getItemName(selectedTransfer.itemId)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">من فرع</p>
                  <p>{getBranchName(selectedTransfer.fromBranchId)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">إلى فرع</p>
                  <p>{getBranchName(selectedTransfer.toBranchId)}</p>
                </div>
              </div>
              {selectedTransfer.reason && (
                <div>
                  <p className="text-sm text-gray-500">سبب التحويل</p>
                  <p>{selectedTransfer.reason}</p>
                </div>
              )}
              {selectedTransfer.notes && (
                <div>
                  <p className="text-sm text-gray-500">ملاحظات</p>
                  <p>{selectedTransfer.notes}</p>
                </div>
              )}
              {selectedTransfer.receiverName && (
                <div>
                  <p className="text-sm text-gray-500">المستلم</p>
                  <p>{selectedTransfer.receiverName}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">تاريخ الطلب</p>
                  <p>{selectedTransfer.requestedAt ? format(new Date(selectedTransfer.requestedAt), "dd/MM/yyyy HH:mm") : "-"}</p>
                </div>
                {selectedTransfer.approvedAt && (
                  <div>
                    <p className="text-gray-500">تاريخ الموافقة</p>
                    <p>{format(new Date(selectedTransfer.approvedAt), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                )}
                {selectedTransfer.receivedAt && (
                  <div>
                    <p className="text-gray-500">تاريخ الاستلام</p>
                    <p>{format(new Date(selectedTransfer.receivedAt), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
