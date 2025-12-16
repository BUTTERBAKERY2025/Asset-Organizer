import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeftRight, Plus, Search, Check, X, Clock, Send, Package, Building2, FileText, Eye } from "lucide-react";
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

  const handleItemSelect = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      setNewTransfer({
        ...newTransfer,
        itemId,
        fromBranchId: item.branchId,
      });
    }
  };

  const pendingCount = transfers.filter((t) => t.status === "pending").length;
  const approvedCount = transfers.filter((t) => t.status === "approved").length;
  const completedCount = transfers.filter((t) => t.status === "completed").length;

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
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700" data-testid="button-create-transfer">
                <Plus className="h-4 w-4 ml-2" />
                طلب تحويل جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg" dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء طلب تحويل جديد</DialogTitle>
                <DialogDescription>حدد الأصل والفرع المراد التحويل إليه</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>الأصل / المعدة</Label>
                  <Select value={newTransfer.itemId} onValueChange={handleItemSelect}>
                    <SelectTrigger data-testid="select-item">
                      <SelectValue placeholder="اختر الأصل" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} - {getBranchName(item.branchId)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>من فرع</Label>
                    <Select value={newTransfer.fromBranchId} onValueChange={(v) => setNewTransfer({ ...newTransfer, fromBranchId: v })}>
                      <SelectTrigger data-testid="select-from-branch">
                        <SelectValue placeholder="الفرع المرسل" />
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
                    <Label>إلى فرع</Label>
                    <Select value={newTransfer.toBranchId} onValueChange={(v) => setNewTransfer({ ...newTransfer, toBranchId: v })}>
                      <SelectTrigger data-testid="select-to-branch">
                        <SelectValue placeholder="الفرع المستلم" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.filter((b) => b.id !== newTransfer.fromBranchId).map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>سبب التحويل</Label>
                  <Input
                    value={newTransfer.reason}
                    onChange={(e) => setNewTransfer({ ...newTransfer, reason: e.target.value })}
                    placeholder="أدخل سبب التحويل"
                    data-testid="input-reason"
                  />
                </div>

                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={newTransfer.notes}
                    onChange={(e) => setNewTransfer({ ...newTransfer, notes: e.target.value })}
                    placeholder="ملاحظات إضافية (اختياري)"
                    data-testid="input-notes"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>إلغاء</Button>
                <Button onClick={handleCreateTransfer} disabled={createMutation.isPending} data-testid="button-submit-transfer">
                  {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء الطلب"}
                </Button>
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
                    {filteredTransfers.map((transfer) => (
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
