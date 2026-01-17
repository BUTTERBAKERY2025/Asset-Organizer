import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import type { Branch, FinishedGoodsInventory, FinishedGoodsTransfer } from "@shared/schema";
import { 
  Package, ArrowRight, Building, ShoppingCart, Refrigerator, Snowflake, ChefHat,
  RefreshCw, Search, History, Filter, Calendar
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DESTINATION_TYPES = [
  { value: "branch", label: "فرع آخر", icon: Building },
  { value: "display_bar", label: "بار العرض", icon: ShoppingCart },
  { value: "kitchen_trolley", label: "عربة المطبخ", icon: ChefHat },
  { value: "freezer", label: "الفريزر", icon: Snowflake },
  { value: "refrigerator", label: "الثلاجة", icon: Refrigerator },
];

export default function FinishedGoodsInventoryPage() {
  const [branchId, setBranchId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FinishedGoodsInventory | null>(null);
  const [transferQuantity, setTransferQuantity] = useState<string>("");
  const [destinationType, setDestinationType] = useState<string>("display_bar");
  const [destinationBranchId, setDestinationBranchId] = useState<string>("");
  const [transferNotes, setTransferNotes] = useState<string>("");
  
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { itemsPerPage, getPageItems } = usePagination(15);
  const { user } = useAuth();

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  useEffect(() => {
    if (branches && branches.length > 0 && !branchId) {
      setBranchId(branches[0].id);
    }
  }, [branches, branchId]);

  const { data: inventory, isLoading, refetch } = useQuery<FinishedGoodsInventory[]>({
    queryKey: ["/api/finished-goods-inventory", branchId, selectedDate, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      if (selectedDate) params.set("productionDate", selectedDate);
      if (categoryFilter) params.set("category", categoryFilter);
      const res = await fetch(`/api/finished-goods-inventory?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
    enabled: !!branchId,
  });

  const { data: transfers } = useQuery<FinishedGoodsTransfer[]>({
    queryKey: ["/api/finished-goods-transfers", branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("sourceBranchId", branchId);
      const res = await fetch(`/api/finished-goods-transfers?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transfers");
      return res.json();
    },
    enabled: !!branchId,
  });

  const { data: logs } = useQuery({
    queryKey: ["/api/production-inventory-logs", branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      const res = await fetch(`/api/production-inventory-logs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: !!branchId && showHistoryDialog,
  });

  const transferMutation = useMutation({
    mutationFn: async (data: {
      inventoryId: number;
      quantity: number;
      destinationType: string;
      destinationBranchId?: string;
      notes?: string;
    }) => {
      const res = await apiRequest("POST", `/api/finished-goods-inventory/${data.inventoryId}/transfer`, {
        quantity: data.quantity,
        destinationType: data.destinationType,
        destinationBranchId: data.destinationBranchId,
        notes: data.notes,
      });
      return res.json();
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/finished-goods-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-inventory-logs"] });
      setShowTransferDialog(false);
      setSelectedItem(null);
      setTransferQuantity("");
      setTransferNotes("");
      toast({ title: "تم التحويل بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const filteredInventory = inventory?.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return item.productName.toLowerCase().includes(query) ||
           item.productCategory?.toLowerCase().includes(query);
  }) || [];

  const paginatedInventory = getPageItems(filteredInventory, currentPage);
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);

  const categories = Array.from(new Set(inventory?.map(i => i.productCategory).filter(Boolean))) as string[];

  const handleTransfer = () => {
    if (!selectedItem) return;
    const qty = parseInt(transferQuantity, 10);
    if (!qty || qty <= 0 || qty > selectedItem.quantity) {
      toast({ title: "خطأ", description: "الكمية غير صحيحة", variant: "destructive" });
      return;
    }
    if (destinationType === "branch" && !destinationBranchId) {
      toast({ title: "خطأ", description: "يرجى اختيار الفرع المستهدف", variant: "destructive" });
      return;
    }
    
    transferMutation.mutate({
      inventoryId: selectedItem.id,
      quantity: qty,
      destinationType,
      destinationBranchId: destinationType === "branch" ? destinationBranchId : undefined,
      notes: transferNotes || undefined,
    });
  };

  const openTransferDialog = (item: FinishedGoodsInventory) => {
    setSelectedItem(item);
    setTransferQuantity(String(item.quantity));
    setDestinationType("display_bar");
    setDestinationBranchId("");
    setTransferNotes("");
    setShowTransferDialog(true);
  };

  const getDestinationLabel = (type: string) => {
    return DESTINATION_TYPES.find(d => d.value === type)?.label || type;
  };

  const getBranchName = (id: string | null | undefined) => {
    if (!id) return "-";
    return branches?.find(b => b.id === id)?.name || id;
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6 text-amber-600" />
              مخزون الإنتاج النهائي
            </h1>
            <p className="text-muted-foreground">إدارة وتحويل المنتجات النهائية للفروع أو بار العرض</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowHistoryDialog(true)} data-testid="btn-history">
              <History className="h-4 w-4 ml-1" />
              سجل الحركات
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh">
              <RefreshCw className="h-4 w-4 ml-1" />
              تحديث
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              الفلاتر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>الفرع</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder="اختر الفرع" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>تاريخ الإنتاج</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  data-testid="input-date"
                />
              </div>
              <div>
                <Label>الفئة</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="كل الفئات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">كل الفئات</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat || ""}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>البحث</Label>
                <div className="relative">
                  <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث عن منتج..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-8"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">المخزون المتاح</CardTitle>
            <CardDescription>
              {filteredInventory.length} منتج متاح للتحويل
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد منتجات في المخزون
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead>الفئة</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead>الوحدة</TableHead>
                      <TableHead>تاريخ الإنتاج</TableHead>
                      <TableHead className="text-left">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInventory.map((item) => (
                      <TableRow key={item.id} data-testid={`row-inventory-${item.id}`}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.productCategory || "-"}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold text-lg">{item.quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{item.productionDate}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => openTransferDialog(item)}
                            disabled={item.quantity <= 0}
                            data-testid={`btn-transfer-${item.id}`}
                          >
                            <ArrowRight className="h-4 w-4 ml-1" />
                            تحويل
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredInventory.length > itemsPerPage && (
                  <div className="mt-4">
                    <TablePagination
                      currentPage={currentPage}
                      totalItems={filteredInventory.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">آخر التحويلات</CardTitle>
          </CardHeader>
          <CardContent>
            {!transfers || transfers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                لا توجد تحويلات
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المنتج</TableHead>
                    <TableHead className="text-center">الكمية</TableHead>
                    <TableHead>الوجهة</TableHead>
                    <TableHead>الفرع المستهدف</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers.slice(0, 10).map((transfer) => (
                    <TableRow key={transfer.id} data-testid={`row-transfer-${transfer.id}`}>
                      <TableCell className="font-medium">{transfer.productName}</TableCell>
                      <TableCell className="text-center">{transfer.quantity}</TableCell>
                      <TableCell>{getDestinationLabel(transfer.destinationType)}</TableCell>
                      <TableCell>{getBranchName(transfer.destinationBranchId)}</TableCell>
                      <TableCell>{transfer.transferDate}</TableCell>
                      <TableCell>
                        <Badge variant={transfer.status === "completed" ? "default" : "secondary"}>
                          {transfer.status === "completed" ? "مكتمل" : transfer.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>تحويل منتج</DialogTitle>
              <DialogDescription>
                تحويل {selectedItem?.productName} من المخزون
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الكمية المتاحة:</span>
                <span className="font-bold">{selectedItem?.quantity} {selectedItem?.unit}</span>
              </div>
              <div>
                <Label>الكمية للتحويل</Label>
                <Input
                  type="number"
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  min={1}
                  max={selectedItem?.quantity}
                  data-testid="input-transfer-quantity"
                />
              </div>
              <div>
                <Label>الوجهة</Label>
                <Select value={destinationType} onValueChange={setDestinationType}>
                  <SelectTrigger data-testid="select-destination-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINATION_TYPES.map(dest => (
                      <SelectItem key={dest.value} value={dest.value}>
                        {dest.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {destinationType === "branch" && (
                <div>
                  <Label>الفرع المستهدف</Label>
                  <Select value={destinationBranchId} onValueChange={setDestinationBranchId}>
                    <SelectTrigger data-testid="select-destination-branch">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.filter(b => b.id !== branchId).map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>ملاحظات (اختياري)</Label>
                <Textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="أي ملاحظات إضافية..."
                  data-testid="input-transfer-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTransferDialog(false)}>إلغاء</Button>
              <Button 
                onClick={handleTransfer} 
                disabled={transferMutation.isPending}
                data-testid="btn-confirm-transfer"
              >
                {transferMutation.isPending ? "جاري التحويل..." : "تأكيد التحويل"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                سجل حركات المخزون
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {!logs || logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد حركات مسجلة
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المنتج</TableHead>
                      <TableHead>نوع الحركة</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-center">الرصيد قبل</TableHead>
                      <TableHead className="text-center">الرصيد بعد</TableHead>
                      <TableHead>التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{log.productName}</TableCell>
                        <TableCell>
                          <Badge variant={log.movementType === "production_in" ? "default" : "secondary"}>
                            {log.movementType === "production_in" ? "إنتاج" : "تحويل"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{log.quantity}</TableCell>
                        <TableCell className="text-center">{log.balanceBefore}</TableCell>
                        <TableCell className="text-center">{log.balanceAfter}</TableCell>
                        <TableCell>{format(new Date(log.createdAt), "yyyy-MM-dd HH:mm", { locale: ar })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
