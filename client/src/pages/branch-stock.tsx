import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Boxes, ArrowLeft, Search, AlertTriangle, Package, Edit2, 
  TrendingDown, TrendingUp, Store, RefreshCw
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";

type Branch = {
  id: string;
  name: string;
  nameEn: string | null;
};

type BranchStockItem = {
  id: number;
  branchId: string;
  itemId: number;
  currentQuantity: number;
  dailyConsumption: number;
  lastUpdated: string;
  itemName?: string;
  itemNameEn?: string | null;
  category?: string;
  unit?: string;
  minStockLevel?: number;
};

type WarehouseItem = {
  id: number;
  name: string;
  nameEn: string | null;
  category: string;
  unit: string;
  minStockLevel: number | null;
  currentStock: number;
};

const CATEGORY_LABELS = {
  raw: { ar: "مواد خام", en: "Raw Materials" },
  consumable: { ar: "مستهلكات", en: "Consumables" },
  packaging: { ar: "مواد تغليف", en: "Packaging" },
  primary: { ar: "مواد إنتاج أولية", en: "Primary Production" },
};

export default function BranchStockPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showLowStock, setShowLowStock] = useState(false);
  const [editingItem, setEditingItem] = useState<BranchStockItem | null>(null);
  const [editQuantity, setEditQuantity] = useState(0);
  const [editConsumption, setEditConsumption] = useState(0);

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: warehouseItems = [] } = useQuery<WarehouseItem[]>({
    queryKey: ["/api/warehouse/items"],
  });

  const { data: branchStock = [], isLoading } = useQuery<BranchStockItem[]>({
    queryKey: ["/api/warehouse/branch-stock", selectedBranch],
    queryFn: async () => {
      if (!selectedBranch) return [];
      const res = await fetch(`/api/warehouse/branch-stock/${selectedBranch}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch branch stock");
      return res.json();
    },
    enabled: !!selectedBranch,
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ branchId, itemId, quantity, dailyConsumption }: { branchId: string; itemId: number; quantity: number; dailyConsumption: number }) => {
      const response = await apiRequest("PUT", `/api/warehouse/branch-stock/${branchId}/${itemId}`, {
        quantity,
        dailyConsumption,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/branch-stock", selectedBranch] });
      setEditingItem(null);
      toast({ title: isRTL ? "تم تحديث المخزون" : "Stock updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: isRTL ? "فشل في تحديث المخزون" : "Failed to update stock",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const enrichedStock = useMemo(() => {
    return branchStock.map(stock => {
      const item = warehouseItems.find(w => w.id === stock.itemId);
      return {
        ...stock,
        itemName: item?.name || `Item #${stock.itemId}`,
        itemNameEn: item?.nameEn,
        category: item?.category,
        unit: item?.unit || "وحدة",
        minStockLevel: item?.minStockLevel || 0,
      };
    });
  }, [branchStock, warehouseItems]);

  const filteredStock = useMemo(() => {
    let result = enrichedStock;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.itemName?.toLowerCase().includes(query) ||
        s.itemNameEn?.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter(s => s.category === categoryFilter);
    }

    if (showLowStock) {
      result = result.filter(s => s.currentQuantity <= (s.minStockLevel || 0));
    }

    return result;
  }, [enrichedStock, searchQuery, categoryFilter, showLowStock]);

  const lowStockItems = useMemo(() => {
    return enrichedStock.filter(s => s.currentQuantity <= (s.minStockLevel || 0));
  }, [enrichedStock]);

  const getStockStatus = (item: BranchStockItem) => {
    const minLevel = item.minStockLevel || 0;
    if (item.currentQuantity <= 0) {
      return { status: "out", color: "bg-red-500", textAr: "نفد", textEn: "Out of Stock" };
    }
    if (item.currentQuantity <= minLevel) {
      return { status: "low", color: "bg-amber-500", textAr: "منخفض", textEn: "Low Stock" };
    }
    return { status: "ok", color: "bg-green-500", textAr: "متوفر", textEn: "In Stock" };
  };

  const handleEdit = (item: BranchStockItem) => {
    setEditingItem(item);
    setEditQuantity(item.currentQuantity);
    setEditConsumption(item.dailyConsumption);
  };

  const selectedBranchData = branches.find(b => b.id === selectedBranch);

  return (
    <Layout>
      <div className="page-container space-y-4 sm:space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <PageHeader
          icon={Store}
          tone="executive"
          title={isRTL ? "مخزون الفروع" : "Branch Stock"}
          description={isRTL ? "متابعة مخزون المواد في الفروع" : "Track material stock in branches"}
          backHref="/warehouse-dashboard"
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              {isRTL ? "اختيار الفرع" : "Select Branch"}
            </CardTitle>
            <CardDescription>
              {isRTL ? "اختر الفرع لعرض مخزون المواد" : "Select a branch to view material stock"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full md:w-[300px]" data-testid="select-branch">
                <SelectValue placeholder={isRTL ? "اختر الفرع..." : "Select branch..."} />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {isRTL ? branch.name : branch.nameEn || branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedBranch && (
          <>
            {lowStockItems.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-5 h-5" />
                    {isRTL ? "تنبيهات المخزون المنخفض" : "Low Stock Alerts"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {lowStockItems.slice(0, 5).map((item) => (
                      <Badge 
                        key={item.id} 
                        variant="outline" 
                        className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40"
                      >
                        {isRTL ? item.itemName : (item.itemNameEn || item.itemName)}: {item.currentQuantity} {item.unit}
                      </Badge>
                    ))}
                    {lowStockItems.length > 5 && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40">
                        +{lowStockItems.length - 5} {isRTL ? "أخرى" : "more"}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Boxes className="w-5 h-5" />
                    {isRTL ? `مخزون ${selectedBranchData?.name || "الفرع"}` : `${selectedBranchData?.nameEn || selectedBranchData?.name || "Branch"} Stock`}
                  </CardTitle>
                  <Badge variant="secondary">
                    {filteredStock.length} {isRTL ? "صنف" : "items"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-stretch sm:items-center">
                  <div className="relative flex-1 min-w-0">
                    <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4`} />
                    <Input
                      placeholder={isRTL ? "ابحث عن المواد..." : "Search items..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`h-9 sm:h-10 ${isRTL ? "pr-10" : "pl-10"}`}
                      data-testid="input-search"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-[130px] sm:w-[180px] h-9 sm:h-10" data-testid="select-category-filter">
                        <SelectValue placeholder={isRTL ? "الفئات" : "Categories"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{isRTL ? "جميع الفئات" : "All Categories"}</SelectItem>
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {isRTL ? label.ar : label.en}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant={showLowStock ? "default" : "outline"}
                      onClick={() => setShowLowStock(!showLowStock)}
                      className="gap-1 sm:gap-2 h-9 sm:h-10 px-2 sm:px-4"
                      data-testid="btn-toggle-low-stock"
                    >
                      <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">{isRTL ? "المخزون المنخفض" : "Low Stock"}</span>
                      <span className="sm:hidden">{isRTL ? "منخفض" : "Low"}</span>
                      {lowStockItems.length > 0 && (
                        <Badge variant="destructive" className="text-[10px] sm:text-xs">
                          {lowStockItems.length}
                        </Badge>
                      )}
                    </Button>
                  </div>
                </div>

                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : filteredStock.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>{isRTL ? "لا توجد مواد متطابقة" : "No matching items"}</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">{isRTL ? "المادة" : "Item"}</TableHead>
                          <TableHead className="hidden sm:table-cell">{isRTL ? "الفئة" : "Category"}</TableHead>
                          <TableHead>{isRTL ? "الكمية" : "Qty"}</TableHead>
                          <TableHead className="hidden md:table-cell">{isRTL ? "الحد الأدنى" : "Min"}</TableHead>
                          <TableHead className="hidden lg:table-cell">{isRTL ? "الاستهلاك" : "Usage"}</TableHead>
                          <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                          <TableHead className="hidden md:table-cell">{isRTL ? "آخر تحديث" : "Updated"}</TableHead>
                          <TableHead className="w-[60px] sm:w-[80px]">{isRTL ? "إجراء" : "Action"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStock.map((item) => {
                          const status = getStockStatus(item);
                          const categoryLabel = CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS];
                          return (
                            <TableRow key={item.id} data-testid={`row-stock-${item.id}`}>
                              <TableCell className="font-medium text-xs sm:text-sm">
                                {isRTL ? item.itemName : (item.itemNameEn || item.itemName)}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <Badge variant="outline" className="text-[10px] sm:text-xs">
                                  {categoryLabel ? (isRTL ? categoryLabel.ar : categoryLabel.en) : item.category}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs sm:text-sm">
                                {item.currentQuantity} {item.unit}
                              </TableCell>
                              <TableCell className="hidden md:table-cell font-mono text-xs sm:text-sm text-muted-foreground">
                                {item.minStockLevel} {item.unit}
                              </TableCell>
                              <TableCell className="hidden lg:table-cell font-mono text-xs sm:text-sm">
                                {item.dailyConsumption} {item.unit}/{isRTL ? "يوم" : "day"}
                              </TableCell>
                              <TableCell>
                                <Badge className={`${status.color} text-white text-[10px] sm:text-xs`}>
                                  {isRTL ? status.textAr : status.textEn}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs sm:text-sm text-muted-foreground">
                                {new Date(item.lastUpdated).toLocaleDateString(isRTL ? 'en-GB' : 'en-US')}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                  onClick={() => handleEdit(item)}
                                  data-testid={`btn-edit-${item.id}`}
                                >
                                  <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isRTL ? "تحديث المخزون" : "Update Stock"}</DialogTitle>
              <DialogDescription>
                {isRTL ? `تحديث مخزون ${editingItem?.itemName}` : `Update stock for ${editingItem?.itemNameEn || editingItem?.itemName}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{isRTL ? "الكمية الحالية" : "Current Quantity"}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                    min={0}
                    data-testid="input-edit-quantity"
                  />
                  <span className="text-muted-foreground">{editingItem?.unit}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{isRTL ? "الاستهلاك اليومي" : "Daily Consumption"}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editConsumption}
                    onChange={(e) => setEditConsumption(parseInt(e.target.value) || 0)}
                    min={0}
                    data-testid="input-edit-consumption"
                  />
                  <span className="text-muted-foreground">{editingItem?.unit}/{isRTL ? "يوم" : "day"}</span>
                </div>
              </div>
              {editingItem && editQuantity > 0 && editConsumption > 0 && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? "يكفي لـ" : "Sufficient for"}: 
                    <span className="font-bold mx-1">{Math.floor(editQuantity / editConsumption)}</span>
                    {isRTL ? "يوم" : "days"}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingItem(null)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button 
                onClick={() => {
                  if (editingItem && selectedBranch) {
                    updateStockMutation.mutate({
                      branchId: selectedBranch,
                      itemId: editingItem.itemId,
                      quantity: editQuantity,
                      dailyConsumption: editConsumption,
                    });
                  }
                }}
                disabled={updateStockMutation.isPending}
                data-testid="btn-save-stock"
              >
                {updateStockMutation.isPending ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ" : "Save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
