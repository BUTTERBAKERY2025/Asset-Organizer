import React, { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { BranchBarHandoffs, fetchBranchBarHandoffs } from "@/components/branch-bar-handoffs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getHttpStatus, HttpError } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { TablePagination, usePagination } from "@/components/ui/pagination";
import type { Branch, FinishedGoodsInventory, FinishedGoodsTransfer } from "@shared/schema";
import { isNewCatalogReferenceAllowed } from "@shared/catalog-activity";
import type { Product } from "@shared/schema";
import { 
  Package, ArrowRight, Building, ShoppingCart, Refrigerator, Snowflake, ChefHat,
  RefreshCw, Search, History, Filter, Calendar, Download, FileSpreadsheet, Printer
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReactToPrint } from "react-to-print";
import { Link } from "wouter";

const DESTINATION_TYPES = [
  { value: "branch", label: "فرع آخر", icon: Building },
  { value: "display_bar", label: "بار العرض", icon: ShoppingCart },
  { value: "kitchen_trolley", label: "عربة المطبخ", icon: ChefHat },
  { value: "freezer", label: "الفريزر", icon: Snowflake },
  { value: "refrigerator", label: "الثلاجة", icon: Refrigerator },
];

export function FinishedGoodsWorkspace({ embedded = false, initialBranchId, productIds, onChanged }: {
  embedded?: boolean; initialBranchId?: string; productIds?: number[]; onChanged?: () => void;
}) {
  const [branchId, setBranchId] = useState<string>(initialBranchId || "");
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
  const [receiptTransfer, setReceiptTransfer] = useState<FinishedGoodsTransfer | null>(null);
  const [receiptQuantity, setReceiptQuantity] = useState("");
  const receiptLinkConsumed = useRef(false);
  const returnDeliveryId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("deliveryId") : null;
  
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);
  const barRequestRef = useRef<{ payload: string; key: string } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { itemsPerPage, getPageItems } = usePagination(15);
  const { user } = useAuth();
  const { canEdit, canView, isLoading: permissionsLoading } = usePermissions();
  useEffect(() => {
    if (embedded) {
      setBranchId(initialBranchId || "");
      setShowTransferDialog(false);
      setSelectedItem(null);
      setReceiptTransfer(null);
    }
  }, [embedded, initialBranchId]);

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  useEffect(() => {
    if (embedded) return;
    if (branches && branches.length > 0 && !branchId) {
      const requested = new URLSearchParams(window.location.search).get("branchId");
      setBranchId(branches.find(branch => branch.id === requested)?.id || branches[0].id);
    } else if (branches && branches.length === 0 && new URLSearchParams(window.location.search).has("transferId")
      && !receiptLinkConsumed.current) {
      receiptLinkConsumed.current = true;
      toast({ title: "لا يوجد فرع استلام متاح لهذه المهمة", variant: "destructive" });
    }
  }, [branches, branchId, toast, embedded]);

  const { data: inventory, isLoading, error: inventoryError, refetch } = useQuery<FinishedGoodsInventory[]>({
    queryKey: ["/api/finished-goods-inventory", branchId, selectedDate, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      if (selectedDate) params.set("productionDate", selectedDate);
      if (categoryFilter) params.set("category", categoryFilter);
      const res = await fetch(`/api/finished-goods-inventory?${params}`, { credentials: "include" });
      if (!res.ok) throw new HttpError(res.status, (await res.json().catch(() => ({}))).error || "تعذر تحميل مخزون الفرع");
      return res.json();
    },
    enabled: !!branchId,
  });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const selectableProductIds = new Set(products.filter(isNewCatalogReferenceAllowed).map(product => product.id));

  const { data: transfers, error: transferError, isError: transfersError } = useQuery<FinishedGoodsTransfer[]>({
    queryKey: ["/api/finished-goods-transfers", branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      const res = await fetch(`/api/finished-goods-transfers?${params}`, { credentials: "include" });
      if (!res.ok) throw new HttpError(res.status, (await res.json().catch(() => ({}))).error || "تعذر تحميل التحويلات");
      return res.json();
    },
    enabled: !!branchId,
  });
  useEffect(() => {
    if (embedded || receiptLinkConsumed.current || !branchId) return;
    const raw = new URLSearchParams(window.location.search).get("transferId");
    if (!raw) return;
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id <= 0) {
      receiptLinkConsumed.current = true;
      toast({ title: "رابط التحويل غير صالح", variant: "destructive" });
      return;
    }
    if ((!transfers && !transfersError) || permissionsLoading) return;
    receiptLinkConsumed.current = true;
    const transfer = !transfersError && !permissionsLoading && canView("production") ? transfers?.find(row => row.id === id) : undefined;
    if (!transfer || transfer.transportPolicy !== "branch_receipt" || transfer.destinationBranchId !== branchId) {
      toast({ title: "التحويل غير متاح في فرع الاستلام المحدد", variant: "destructive" });
    } else if (transfer.status === "in_transit" && canEdit("production")) {
      setReceiptTransfer(transfer);
      setReceiptQuantity(String(transfer.quantity));
    } else if (transfer.status === "received") {
      toast({ title: "الاستلام مسجل بالفعل", description: "ارجع لمهمة التوصيل لاعتماد الإيصال." });
    } else {
      toast({ title: "لا يمكن فتح الاستلام", description: "تحقق من صلاحيتك وحالة الشحنة.", variant: "destructive" });
    }
  }, [branchId, transfers, transfersError, permissionsLoading, canEdit, canView, toast, embedded]);

  const { data: logs, error: logsError, isError: historyError } = useQuery({
    queryKey: ["/api/production-inventory-logs", branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", branchId);
      const res = await fetch(`/api/production-inventory-logs?${params}`, { credentials: "include" });
      if (!res.ok) throw new HttpError(res.status, (await res.json().catch(() => ({}))).error || "تعذر تحميل سجل الحركات");
      return res.json();
    },
    enabled: !!branchId && showHistoryDialog,
  });
  // Observe the same query as the child so a revoked bar read also masks cached inventory/transfer data.
  // Disabled observation never issues a second read; the mounted handoff component owns refetch/retry.
  const { error: handoffError } = useQuery({
    queryKey: ["/api/branch-bar-handoffs", branchId],
    queryFn: () => fetchBranchBarHandoffs(branchId),
    enabled: false,
  });

  const transferMutation = useMutation({
    mutationFn: async (data: {
      inventoryId: number;
      quantity: number;
      destinationType: string;
      destinationBranchId?: string;
      notes?: string;
    }) => {
      if (data.destinationType === "display_bar") {
        const payload = JSON.stringify({ inventoryId: data.inventoryId, quantity: data.quantity, notes: data.notes || "" });
        if (!barRequestRef.current || barRequestRef.current.payload !== payload)
          barRequestRef.current = { payload, key: crypto.randomUUID() };
        const res = await apiRequest("POST", "/api/branch-bar-handoffs", {
          inventoryId: data.inventoryId, quantity: data.quantity,
          notes: data.notes, idempotencyKey: barRequestRef.current.key,
        });
        return res.json();
      }
      const res = await apiRequest("POST", `/api/finished-goods-inventory/${data.inventoryId}/transfer`, {
        quantity: data.quantity,
        destinationType: data.destinationType,
        destinationBranchId: data.destinationBranchId,
        notes: data.notes,
      });
      return res.json();
    },
    onSuccess: () => {
      barRequestRef.current = null;
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/branch-bar-handoffs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finished-goods-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-inventory-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/central-kitchen-order-journey"] });
      onChanged?.();
      setShowTransferDialog(false);
      setSelectedItem(null);
      setTransferQuantity("");
      setTransferNotes("");
      toast({ title: destinationType === "branch" ? "تم حجز الكمية، بانتظار شحنها من المصدر" : destinationType === "display_bar" ? "تم حجز الكمية، وثّق خروجها ثم يؤكد البار استلامها" : "تم التحويل بنجاح" });
    },
    onError: (error: any) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const shipmentMutation = useMutation({
    mutationFn: async ({ id, action, quantity }: { id: number; action: "dispatch" | "receive" | "cancel"; quantity?: number }) => {
      const res = await apiRequest("POST", `/api/finished-goods-transfers/${id}/${action}`,
        action === "receive" ? { receivedQuantity: quantity } : {});
      return res.json();
    },
    onSuccess: (_result, variables) => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/finished-goods-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production-inventory-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/central-kitchen-order-journey"] });
      onChanged?.();
      setReceiptTransfer(null);
      toast({ title: variables.action === "receive" ? "تم تأكيد الاستلام الفعلي" : variables.action === "dispatch" ? "تم توثيق خروج الشحنة" : "تم إلغاء الحجز" });
    },
    onError: (error: Error) => toast({ title: "خطأ", description: error.message, variant: "destructive" }),
  });

  const accessDenied = permissionsLoading || !canView("production") ||
    [inventoryError, transferError, logsError, handoffError].some(error => [401, 403].includes(getHttpStatus(error) ?? 0));
  const inventoryReady = !accessDenied && !inventoryError && !!inventory;
  const transfersReady = !accessDenied && !transfersError && !!transfers;
  const historyReady = !accessDenied && !historyError && !!logs;
  const mayEditInventory = inventoryReady && canEdit("production");
  const mayEditTransfers = transfersReady && canEdit("production");
  const filteredInventory = (inventoryReady ? inventory : undefined)?.filter(item => {
    if (item.branchId !== branchId || (embedded && productIds && !productIds.includes(item.productId ?? -1))) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return item.productName.toLowerCase().includes(query) ||
           item.productCategory?.toLowerCase().includes(query);
  }) || [];
  const scopedTransfers = (transfersReady ? transfers : undefined)?.filter(transfer =>
    !embedded || ((transfer.sourceBranchId === branchId || transfer.destinationBranchId === branchId)
      && (!productIds || productIds.includes(transfer.productId ?? -1)))) || [];

  const paginatedInventory = getPageItems(filteredInventory, currentPage);
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);

  const categories = Array.from(new Set((inventoryReady ? inventory : undefined)?.map(i => i.productCategory).filter(Boolean))) as string[];

  const handleTransfer = () => {
    if (!mayEditInventory) return;
    if (!selectedItem || selectedItem.branchId !== branchId ||
      (embedded && productIds && !productIds.includes(selectedItem.productId ?? -1))) return;
    const liveItem = inventoryReady ? inventory?.find(item => item.id === selectedItem.id) : undefined;
    const qty = parseInt(transferQuantity, 10);
    if (!liveItem || !Number.isInteger(qty) || String(qty) !== transferQuantity.trim() || qty <= 0 || qty > liveItem.quantity - liveItem.reservedQuantity) {
      toast({ title: "الكمية لم تعد متاحة", description: "حدّث المخزون واختر كمية متاحة قبل المتابعة.", variant: "destructive" });
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
    if (!mayEditInventory || item.branchId !== branchId || !filteredInventory.some(row => row.id === item.id)) return;
    setSelectedItem(item);
    setTransferQuantity(String(item.quantity - item.reservedQuantity));
    setDestinationType("display_bar");
    setDestinationBranchId("");
    setTransferNotes("");
    setShowTransferDialog(true);
  };
  const availableSelected = inventoryReady ? inventory?.find(item => item.id === selectedItem?.id && item.branchId === branchId) : undefined;

  const getDestinationLabel = (type: string) => {
    return DESTINATION_TYPES.find(d => d.value === type)?.label || type;
  };

  const getBranchName = (id: string | null | undefined) => {
    if (!id) return "-";
    return branches?.find(b => b.id === id)?.name || id;
  };

  const handlePrint = useReactToPrint({ contentRef: printRef });

  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    if (!filteredInventory.length) {
      toast({ title: "لا توجد بيانات للتصدير", variant: "destructive" });
      return;
    }
    const exportData = filteredInventory.map(item => ({
      "المنتج": item.productName,
      "الفئة": item.productCategory || "-",
      "الكمية": item.quantity,
      "الوحدة": item.unit,
      "تاريخ الإنتاج": item.productionDate,
      "الفرع": getBranchName(item.branchId),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "مخزون الإنتاج النهائي");
    const fileName = `finished-goods-inventory-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast({ title: "تم تصدير البيانات بنجاح" });
  };

  const exportToCSV = () => {
    if (!filteredInventory.length) {
      toast({ title: "لا توجد بيانات للتصدير", variant: "destructive" });
      return;
    }
    const headers = ["المنتج", "الفئة", "الكمية", "الوحدة", "تاريخ الإنتاج", "الفرع"];
    const rows = filteredInventory.map(item => [
      item.productName,
      item.productCategory || "-",
      item.quantity,
      item.unit,
      item.productionDate,
      getBranchName(item.branchId),
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finished-goods-inventory-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "تم تصدير البيانات بنجاح" });
  };

  // Do not briefly expose the previously selected branch while an embedded journey changes destination.
  if (embedded && branchId !== (initialBranchId || "")) return null;

  const content = (
      <div className={embedded ? "space-y-3" : "page-container space-y-4 sm:space-y-6"} dir="rtl">
        {embedded && !branchId && <p role="status" className="text-sm text-muted-foreground">حدد فرع الوجهة لعرض مخزون الإنتاج.</p>}
        {embedded && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">مخزون الفرع مشترك وقد يجمع استلامات ودفعات متعددة؛ هذه الكميات ليست منسوبة لهذا الطلب وحده. رصيد استلام البار تراكمي ولا يوضح المتاح بعد المبيعات أو الهدر.</p>}
        {accessDenied && <p role="alert" className="text-sm text-destructive">لم يعد الوصول إلى مخزون الفرع متاحاً. تحقق من صلاحيتك وأعد التحميل.</p>}
        {branchId && (!accessDenied || (handoffError && !permissionsLoading && !inventoryError && !transferError && !logsError && canView("production"))) && <BranchBarHandoffs branchId={branchId} productIds={embedded ? productIds : undefined} embedded={embedded} canEdit={!accessDenied && canEdit("production")} onChanged={() => { void refetch(); void queryClient.invalidateQueries({ queryKey: ["/api/finished-goods-transfers"] }); void queryClient.invalidateQueries({ queryKey: ["/api/central-kitchen-order-journey"] }); onChanged?.(); }} />}
        {!embedded && <>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
              مخزون الإنتاج النهائي
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">إدارة وتحويل المنتجات النهائية للفروع أو بار العرض</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {returnDeliveryId && /^[1-9]\d*$/.test(returnDeliveryId) && <Link href={`/driver-deliveries?deliveryId=${returnDeliveryId}`}><Button variant="outline" size="sm">العودة لمهمة التوصيل لاعتماد الإيصال</Button></Link>}
            <Link href="/kitchen-warehouse-shipping"><Button variant="outline" size="sm">شحن المنتجات للمستودعات المستقلة</Button></Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="btn-export">
                  <Download className="h-4 w-4 ml-1" />
                  تصدير
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToExcel} data-testid="btn-export-excel">
                  <FileSpreadsheet className="h-4 w-4 ml-2" />
                  تصدير Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV} data-testid="btn-export-csv">
                  <FileSpreadsheet className="h-4 w-4 ml-2" />
                  تصدير CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlePrint()} data-testid="btn-print">
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة / PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" disabled={accessDenied} onClick={() => setShowHistoryDialog(true)} data-testid="btn-history">
              <History className="h-4 w-4 ml-1" />
              سجل الحركات
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh">
              <RefreshCw className="h-4 w-4 ml-1" />
              تحديث
            </Button>
          </div>
        </div>

        </>}
        {embedded && <Card>
          <CardHeader className="p-3 pb-1"><CardTitle className="text-base">دفعات المخزون · اختر الدفعة للحجز إلى البار</CardTitle>
            <CardDescription>الكميات تخص مخزون الفرع المشترك: الإجمالي، المحجوز، والمتاح الآن.</CardDescription></CardHeader>
          <CardContent className="space-y-2 p-3">
            {isLoading && <Skeleton className="h-12 w-full" />}
            {inventoryError && <p role="alert" className="text-sm text-destructive">{inventoryError instanceof Error ? inventoryError.message : "تعذر عرض المخزون"}</p>}
            {inventoryReady && !filteredInventory.length && <p className="text-sm text-muted-foreground">لا توجد دفعات لهذه المنتجات في الفرع.</p>}
            {filteredInventory.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <div><strong>{item.productName}</strong> · دفعة {item.productionDate}<p className="text-xs text-muted-foreground">إجمالي {item.quantity} · محجوز {item.reservedQuantity} · متاح {item.quantity - item.reservedQuantity} {item.unit}</p></div>
              {mayEditInventory && item.productId != null && selectableProductIds.has(item.productId) && <Button size="sm" disabled={item.quantity - item.reservedQuantity <= 0} onClick={() => openTransferDialog(item)}>حجز للبار</Button>}
            </div>)}
          </CardContent>
        </Card>}
        {!embedded && <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-4 w-4" />
              الفلاتر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div>
                <Label className="text-xs sm:text-sm">الفرع</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger data-testid="select-branch" className="h-10 sm:h-9">
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
                <Label className="text-xs sm:text-sm">تاريخ الإنتاج</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  data-testid="input-date"
                  className="h-10 sm:h-9"
                />
              </div>
              <div>
                <Label className="text-xs sm:text-sm">الفئة</Label>
                <Select value={categoryFilter || "all"} onValueChange={(val) => setCategoryFilter(val === "all" ? "" : val)}>
                  <SelectTrigger data-testid="select-category" className="h-10 sm:h-9">
                    <SelectValue placeholder="كل الفئات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفئات</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">البحث</Label>
                <div className="relative">
                  <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث عن منتج..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-8 h-10 sm:h-9"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>}
        {!embedded && <div ref={printRef} className="print:p-4">
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6 pb-3">
              <div className="hidden print:block text-center mb-4">
                <h1 className="text-xl font-bold">مخزون الإنتاج النهائي</h1>
                <p className="text-sm text-muted-foreground">
                  {branches?.find(b => b.id === branchId)?.name} - {format(new Date(), "yyyy-MM-dd")}
                </p>
              </div>
              <CardTitle className="text-base sm:text-lg print:hidden">المخزون المتاح</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {filteredInventory.length} منتج متاح للتحويل
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
              {inventoryError || accessDenied ? (
                <p role="alert" className="text-sm text-destructive">{accessDenied ? "مخزون الفرع غير متاح." : inventoryError instanceof Error ? inventoryError.message : "تعذر عرض المخزون"}</p>
              ) : isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد منتجات في المخزون
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">المنتج</TableHead>
                      <TableHead className="hidden md:table-cell text-xs sm:text-sm">الفئة</TableHead>
                      <TableHead className="text-center text-xs sm:text-sm">الإجمالي / المحجوز / المتاح</TableHead>
                      <TableHead className="hidden sm:table-cell text-xs sm:text-sm">الوحدة</TableHead>
                      <TableHead className="hidden md:table-cell text-xs sm:text-sm">تاريخ الإنتاج</TableHead>
                      <TableHead className="text-left text-xs sm:text-sm">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInventory.map((item) => (
                      <TableRow key={item.id} data-testid={`row-inventory-${item.id}`}>
                        <TableCell className="font-medium text-xs sm:text-sm">{item.productName}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="text-[10px] sm:text-xs">{item.productCategory || "-"}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold text-sm sm:text-lg">{item.quantity} / {item.reservedQuantity} / {item.quantity - item.reservedQuantity}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs sm:text-sm">{item.unit}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs sm:text-sm">{item.productionDate}</TableCell>
                        <TableCell>
                           {mayEditInventory && item.productId != null && selectableProductIds.has(item.productId) && <Button
                            size="sm"
                            onClick={() => openTransferDialog(item)}
                            disabled={item.quantity - item.reservedQuantity <= 0}
                            data-testid={`btn-transfer-${item.id}`}
                            className="h-8 sm:h-9 text-xs sm:text-sm"
                          >
                            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                            <span className="hidden sm:inline">تحويل</span>
                            <span className="sm:hidden">نقل</span>
                           </Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
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
        </div>}

        {embedded && transfersError && !accessDenied && <p role="alert" className="text-sm text-destructive">تعذر عرض التحويلات في الفرع.</p>}
        {embedded && scopedTransfers.some(t => t.transportPolicy === "branch_receipt" && t.destinationBranchId === branchId && t.status === "in_transit") && <Card><CardHeader className="p-3 pb-1"><CardTitle className="text-base">استلامات مستقلة بانتظار التأكيد</CardTitle></CardHeader><CardContent className="space-y-2 p-3">{scopedTransfers.filter(t => t.transportPolicy === "branch_receipt" && t.destinationBranchId === branchId && t.status === "in_transit").map(t => <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"><span>#{t.id} · {t.productName} · {t.quantity} {t.unit}</span>{mayEditTransfers && <Button size="sm" onClick={() => { setReceiptTransfer(t); setReceiptQuantity(String(t.quantity)); }}>تأكيد الاستلام الفعلي</Button>}</div>)}</CardContent></Card>}
        {!embedded && <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6 pb-3">
            <CardTitle className="text-base sm:text-lg">آخر التحويلات</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            {!transfersReady ? (
              <p role="alert" className="text-sm text-destructive">{transfersError || accessDenied ? "تعذر عرض التحويلات في الفرع." : "جارٍ تحميل التحويلات..."}</p>
            ) : transfers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                لا توجد تحويلات
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">المنتج</TableHead>
                    <TableHead className="text-center text-xs sm:text-sm">الكمية</TableHead>
                    <TableHead className="text-xs sm:text-sm">الوجهة</TableHead>
                    <TableHead className="hidden md:table-cell text-xs sm:text-sm">الفرع المستهدف</TableHead>
                    <TableHead className="hidden sm:table-cell text-xs sm:text-sm">التاريخ</TableHead>
                    <TableHead className="text-xs sm:text-sm">الحالة / الإجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scopedTransfers.slice(0, 10).map((transfer) => (
                    <TableRow key={transfer.id} data-testid={`row-transfer-${transfer.id}`}>
                      <TableCell className="font-medium text-xs sm:text-sm">{transfer.productName}</TableCell>
                      <TableCell className="text-center text-xs sm:text-sm">{transfer.quantity}</TableCell>
                      <TableCell className="text-xs sm:text-sm">{getDestinationLabel(transfer.destinationType)}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs sm:text-sm">{getBranchName(transfer.destinationBranchId)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-xs sm:text-sm">{transfer.transferDate}</TableCell>
                      <TableCell>
                        <Badge variant={transfer.status === "completed" ? "default" : "secondary"} className="text-[10px] sm:text-xs">
                          {transfer.status === "completed" ? "مكتمل" : transfer.status === "pending" ? "محجوز" : transfer.status === "in_transit" ? "قيد النقل" : transfer.status === "received" ? `مستلم (${transfer.receivedQuantity ?? transfer.quantity})` : transfer.status === "cancelled" ? "ملغي" : transfer.status}
                        </Badge>
                        {mayEditTransfers && transfer.transportPolicy === "branch_receipt" && transfer.status === "pending" && transfer.sourceBranchId === branchId && <>
                          <Link href={`/driver-deliveries?sourceType=finished_goods_transfer&sourceId=${transfer.id}`}><Button size="sm" variant="link">إسناد السائق وتوثيق التسليم</Button></Link>
                          <span className="text-xs text-amber-800">الشحن بعد تأكيد السائق</span>
                          <Button size="sm" variant="outline" disabled={shipmentMutation.isPending} onClick={() => shipmentMutation.mutate({ id: transfer.id, action: "dispatch" })}>شحن</Button>
                          <Button size="sm" variant="ghost" disabled={shipmentMutation.isPending} onClick={() => shipmentMutation.mutate({ id: transfer.id, action: "cancel" })}>إلغاء الحجز</Button>
                        </>}
                        {mayEditTransfers && transfer.transportPolicy === "branch_receipt" && transfer.status === "in_transit" && transfer.destinationBranchId === branchId && <Button size="sm" disabled={shipmentMutation.isPending} onClick={() => { setReceiptTransfer(transfer); setReceiptQuantity(String(transfer.quantity)); }}>تأكيد الاستلام الفعلي</Button>}
                        {transfer.transportPolicy === "branch_receipt" && transfer.status === "in_transit" && <Link href={`/driver-deliveries?sourceType=finished_goods_transfer&sourceId=${transfer.id}`}><Button size="sm" variant="link">مهام السائق</Button></Link>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>}

        {mayEditInventory && <Dialog open={showTransferDialog && mayEditInventory} onOpenChange={setShowTransferDialog}>
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
                  <span className="font-bold">{(availableSelected?.quantity || 0) - (availableSelected?.reservedQuantity || 0)} {selectedItem?.unit}</span>
              </div>
              <div>
                <Label>الكمية للتحويل</Label>
                <Input
                  type="number"
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  min={1}
                    max={(availableSelected?.quantity || 0) - (availableSelected?.reservedQuantity || 0)}
                  data-testid="input-transfer-quantity"
                />
              </div>
              <div>
                <Label>الوجهة</Label>
                <Select value={destinationType} onValueChange={setDestinationType} disabled={embedded}>
                  <SelectTrigger data-testid="select-destination-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(embedded ? DESTINATION_TYPES.filter(dest => dest.value === "display_bar") : DESTINATION_TYPES).map(dest => (
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
                disabled={transferMutation.isPending || !availableSelected || Number(transferQuantity) > availableSelected.quantity - availableSelected.reservedQuantity}
                data-testid="btn-confirm-transfer"
              >
                 {transferMutation.isPending ? "جاري التحويل..." : destinationType === "branch" ? "إنشاء طلب النقل" : "تأكيد التحويل"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>}

        <Dialog open={!!receiptTransfer && mayEditTransfers && !!scopedTransfers.find(t => t.id === receiptTransfer?.id && t.status === "in_transit")} onOpenChange={open => { if (!open) setReceiptTransfer(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تأكيد الاستلام الفعلي</DialogTitle>
              <DialogDescription>أدخل الكمية المستلمة فعلياً. لن يضاف المخزون إلا بعد التأكيد.</DialogDescription>
            </DialogHeader>
            <Label htmlFor="fg-received-quantity">الكمية المستلمة (المرسلة: {receiptTransfer?.quantity})</Label>
            <Input id="fg-received-quantity" type="number" min={0} max={receiptTransfer?.quantity} value={receiptQuantity} onChange={e => setReceiptQuantity(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setReceiptTransfer(null)}>رجوع</Button>
              <Button disabled={!mayEditTransfers || shipmentMutation.isPending || !/^\d+$/.test(receiptQuantity) || Number(receiptQuantity) > (receiptTransfer?.quantity || 0)}
                onClick={() => receiptTransfer && mayEditTransfers && scopedTransfers.some(t => t.id === receiptTransfer.id && t.status === "in_transit") && shipmentMutation.mutate({ id: receiptTransfer.id, action: "receive", quantity: Number(receiptQuantity) })}>تأكيد الاستلام</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showHistoryDialog && !accessDenied} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                سجل حركات المخزون
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {historyError ? <p role="alert" className="text-destructive">تعذر عرض سجل الحركات.</p> : !historyReady ? (
                <p className="text-muted-foreground">جارٍ تحميل سجل الحركات...</p>
              ) : logs.length === 0 ? (
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
  );
  return embedded ? content : <Layout>{content}</Layout>;
}

export default function FinishedGoodsInventoryPage() {
  return <FinishedGoodsWorkspace />;
}
