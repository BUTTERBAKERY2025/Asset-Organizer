import { useState, useRef, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import logo from "@assets/logo_-5_1765206843638.png";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Download, Printer, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import type { Branch, InventoryItem } from "@shared/schema";
import { AdvancedFilters, defaultFilters, type FilterConfig } from "@/components/advanced-filters";
import { ItemCardDialog } from "@/components/item-card-dialog";

type InventoryItemWithBranch = InventoryItem & { branchName?: string };

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeBranch, setActiveBranch] = useState("medina");
  const [showPrices, setShowPrices] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [advancedFilters, setAdvancedFilters] = useState<FilterConfig>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<FilterConfig>(defaultFilters);
  const [selectedItem, setSelectedItem] = useState<InventoryItemWithBranch | null>(null);
  const [isItemCardOpen, setIsItemCardOpen] = useState(false);

  const { data: branches = [], isLoading: branchesLoading } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  const { data: inventoryItems = [], isLoading: inventoryLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
  });

  const isLoading = branchesLoading || inventoryLoading;

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(b => { map[b.id] = b.name; });
    return map;
  }, [branches]);

  const isGlobalSearch = activeBranch === "all";

  const allItems: InventoryItemWithBranch[] = useMemo(() => {
    return inventoryItems.map(item => ({
      ...item,
      branchName: branchMap[item.branchId] || item.branchId
    }));
  }, [inventoryItems, branchMap]);

  const currentBranchItems: InventoryItemWithBranch[] = useMemo(() => {
    return inventoryItems
      .filter(item => item.branchId === activeBranch)
      .map(item => ({
        ...item,
        branchName: branchMap[item.branchId] || item.branchId
      }));
  }, [inventoryItems, activeBranch, branchMap]);

  const currentBranchName = branchMap[activeBranch] || activeBranch;

  const displayedInventory = isGlobalSearch ? allItems : currentBranchItems;

  const advancedFilteredItems = useMemo(() => {
    return displayedInventory.filter(item => {
      if (appliedFilters.status !== "all" && item.status !== appliedFilters.status) {
        return false;
      }
      
      if (appliedFilters.priceMin !== "") {
        const minPrice = parseFloat(appliedFilters.priceMin);
        if (!isNaN(minPrice) && (item.price || 0) < minPrice) {
          return false;
        }
      }
      
      if (appliedFilters.priceMax !== "") {
        const maxPrice = parseFloat(appliedFilters.priceMax);
        if (!isNaN(maxPrice) && (item.price || 0) > maxPrice) {
          return false;
        }
      }
      
      if (appliedFilters.lastCheckFrom !== "" && item.lastCheck) {
        const fromDate = new Date(appliedFilters.lastCheckFrom);
        const itemDate = new Date(item.lastCheck);
        if (itemDate < fromDate) {
          return false;
        }
      }
      
      if (appliedFilters.lastCheckTo !== "" && item.lastCheck) {
        const toDate = new Date(appliedFilters.lastCheckTo);
        const itemDate = new Date(item.lastCheck);
        if (itemDate > toDate) {
          return false;
        }
      }
      
      if (appliedFilters.needsInspection) {
        if (!item.nextInspectionDate) return false;
        const now = new Date();
        const inspectionDate = new Date(item.nextInspectionDate);
        if (inspectionDate > now) {
          return false;
        }
      }
      
      return true;
    });
  }, [displayedInventory, appliedFilters]);

  const groupedInventory = useMemo(() => {
    return advancedFilteredItems.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, InventoryItemWithBranch[]>);
  }, [advancedFilteredItems]);

  const allCategories = useMemo(() => {
    return Array.from(new Set(displayedInventory.map(i => i.category)));
  }, [displayedInventory]);

  const filteredCategories = useMemo(() => {
    return Object.keys(groupedInventory).filter(category => {
      if (selectedCategory !== "all" && category !== selectedCategory) {
        return false;
      }

      const items = groupedInventory[category];
      const hasMatchingItems = items.some(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return hasMatchingItems || category.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [groupedInventory, selectedCategory, searchQuery]);

  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: isGlobalSearch ? "بحث شامل - كل الفروع" : `جرد الأصول - ${currentBranchName}`,
  });

  const handleExport = () => {
    const itemsToExport = isGlobalSearch ? allItems : currentBranchItems;
    
    const exportData = itemsToExport.map(item => {
      const price = item.price || 0;
      const quantity = item.quantity;
      const total = price * quantity;
      const vat = total * 0.15;
      const totalWithVat = total + vat;
      const branchInfo = item.branchName ? { "الفرع": item.branchName } : {};

      return {
        ...branchInfo,
        "الفئة": item.category,
        "اسم الصنف": item.name,
        "الكمية": item.quantity,
        "الوحدة": item.unit,
        "السعر الفردي": price,
        "إجمالي القيمة (قبل الضريبة)": total,
        "الضريبة (15%)": vat,
        "الإجمالي شامل الضريبة": totalWithVat,
        "الحالة": getStatusLabel(item.status),
        "آخر فحص": item.lastCheck || "-",
        "ملاحظات": item.notes || ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    
    const wscols = [
      ...(isGlobalSearch ? [{wch: 20}] : []),
      {wch: 20},
      {wch: 40},
      {wch: 10},
      {wch: 10},
      {wch: 15},
      {wch: 20},
      {wch: 15},
      {wch: 20},
      {wch: 15},
      {wch: 15},
      {wch: 30},
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    
    const date = new Date().toISOString().split('T')[0];
    const fileName = `inventory_${isGlobalSearch ? 'all_branches' : activeBranch}_${date}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  };

  const getStatusLabel = (status?: string | null) => {
    switch(status) {
      case "good": return "جيد";
      case "maintenance": return "صيانة";
      case "damaged": return "تالف";
      case "missing": return "مفقود";
      default: return "غير محدد";
    }
  };

  const getStatusBadge = (status?: string | null) => {
    switch(status) {
      case "good": 
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 gap-1"><CheckCircle2 className="w-3 h-3" /> جيد</Badge>;
      case "maintenance": 
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200 gap-1"><AlertTriangle className="w-3 h-3" /> صيانة</Badge>;
      case "damaged": 
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200 gap-1"><XCircle className="w-3 h-3" /> تالف</Badge>;
      case "missing": 
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-200 gap-1"><HelpCircle className="w-3 h-3" /> مفقود</Badge>;
      default: 
        return <Badge variant="outline" className="gap-1">غير محدد</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'SAR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const itemsForStats = isGlobalSearch ? allItems : currentBranchItems;
  const totalItems = itemsForStats.reduce((acc, item) => acc + item.quantity, 0);
  const totalValue = itemsForStats.reduce((acc, item) => acc + ((item.price || 0) * item.quantity), 0);
  const totalVat = totalValue * 0.15;
  const totalValueWithVat = totalValue + totalVat;
  
  const unpricedItemsCount = itemsForStats.filter(item => !item.price || item.price === 0).length;
  
  const categorySummaries = Object.keys(groupedInventory).map(category => {
    const items = groupedInventory[category];
    const value = items.reduce((acc, item) => acc + ((item.price || 0) * item.quantity), 0);
    return {
      category,
      count: items.reduce((acc, item) => acc + item.quantity, 0),
      itemsCount: items.length,
      value,
      vat: value * 0.15,
      total: value * 1.15
    };
  });

  const InventoryList = () => (
    <>
      {displayedInventory.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/20">
          <p className="text-muted-foreground text-lg">لا توجد بيانات متاحة لهذا الفرع حالياً</p>
        </div>
      ) : (
        filteredCategories.map((category) => {
          const categoryItems = groupedInventory[category];
          const categoryTotalValue = categoryItems.reduce((acc, item) => acc + ((item.price || 0) * item.quantity), 0);
          
          return (
            <Card key={category} className="overflow-hidden border-none shadow-sm ring-1 ring-border/50 break-inside-avoid mb-6">
              <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4 print:bg-transparent print:border-b-2 print:border-black">
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-4">
                    <CardTitle className="text-xl text-primary font-bold print:text-black">{category}</CardTitle>
                    {showPrices && (
                      <span className="text-sm text-muted-foreground font-mono print:text-black">
                         (Total: {formatCurrency(categoryTotalValue)})
                      </span>
                    )}
                  </div>
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm print:hidden">
                    {formatNumber(categoryItems.length)} عنصر
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30 print:bg-transparent">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-right w-[50px] print:text-black font-bold">#</TableHead>
                      <TableHead className="text-right w-[60px] print:text-black font-bold">الصورة</TableHead>
                      {isGlobalSearch && (
                        <TableHead className="text-right w-[120px] print:text-black font-bold text-primary">الفرع</TableHead>
                      )}
                      <TableHead className="text-right print:text-black font-bold">البيان / اسم الأصل</TableHead>
                      <TableHead className="text-right w-[80px] print:text-black font-bold">الكمية</TableHead>
                      {showPrices && (
                        <>
                          <TableHead className="text-right w-[100px] print:text-black font-bold">السعر</TableHead>
                          <TableHead className="text-right w-[100px] print:text-black font-bold">الإجمالي</TableHead>
                          <TableHead className="text-right w-[100px] print:text-black font-bold">الضريبة (15%)</TableHead>
                          <TableHead className="text-right w-[110px] print:text-black font-bold">الصافي</TableHead>
                        </>
                      )}
                      <TableHead className="text-right w-[100px] print:text-black font-bold">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryItems
                      .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((item, index) => {
                        const total = (item.price || 0) * item.quantity;
                        const vat = total * 0.15;
                        const totalWithVat = total + vat;
                        
                        return (
                          <TableRow 
                            key={item.id} 
                            className="hover:bg-muted/20 transition-colors print:border-black cursor-pointer" 
                            data-testid={`row-item-${item.id}`}
                            onClick={() => { setSelectedItem(item); setIsItemCardOpen(true); }}
                          >
                            <TableCell className="font-medium text-muted-foreground print:text-black font-mono text-xs">{formatNumber(index + 1)}</TableCell>
                            <TableCell className="p-1">
                              {item.imageUrl ? (
                                <img 
                                  src={item.imageUrl} 
                                  alt={item.name}
                                  className="w-12 h-12 object-cover rounded-md border border-border shadow-sm"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-12 h-12 bg-muted/50 rounded-md flex items-center justify-center text-muted-foreground/50 text-xs">
                                  -
                                </div>
                              )}
                            </TableCell>
                            {isGlobalSearch && (
                               <TableCell className="font-medium text-primary print:text-black text-sm">{item.branchName}</TableCell>
                            )}
                            <TableCell className="font-semibold text-foreground/90 print:text-black">
                              {item.name}
                              {item.lastCheck && <div className="text-xs text-muted-foreground print:hidden">آخر فحص: {item.lastCheck}</div>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-bold min-w-[3rem] justify-center print:border-black print:text-black font-mono">
                                {formatNumber(item.quantity)}
                              </Badge>
                            </TableCell>
                            {showPrices && (
                              <>
                                <TableCell className="text-muted-foreground print:text-black font-mono text-xs">
                                  {item.price ? formatCurrency(item.price) : "-"}
                                </TableCell>
                                <TableCell className="text-foreground print:text-black font-mono text-xs">
                                  {item.price ? formatCurrency(total) : "-"}
                                </TableCell>
                                <TableCell className="text-muted-foreground print:text-black font-mono text-xs">
                                  {item.price ? formatCurrency(vat) : "-"}
                                </TableCell>
                                <TableCell className="font-bold text-green-700 print:text-black font-mono text-xs">
                                  {item.price ? formatCurrency(totalWithVat) : "-"}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="print:text-black">
                              <div className="print:hidden scale-90 origin-right">{getStatusBadge(item.status)}</div>
                              <div className="hidden print:block text-xs">{getStatusLabel(item.status)}</div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {showPrices && (
                        <TableRow className="bg-muted/50 font-bold border-t-2 border-primary/20 print:border-black">
                          <TableCell colSpan={isGlobalSearch ? 6 : 5} className="text-center print:text-black">إجمالي {category}</TableCell>
                          <TableCell className="font-mono print:text-black">{formatCurrency(categoryTotalValue)}</TableCell>
                          <TableCell className="font-mono print:text-black">{formatCurrency(categoryTotalValue * 0.15)}</TableCell>
                          <TableCell className="font-mono text-green-700 print:text-black">{formatCurrency(categoryTotalValue * 1.15)}</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </>
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">جاري تحميل البيانات...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col space-y-6 print:space-y-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">جرد الأصول والمعدات</h1>
            <p className="text-muted-foreground mt-1">إدارة ومتابعة أصول الفروع وتجهيزاتها</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={handlePrint} data-testid="button-print">
              <Printer className="w-4 h-4" />
              <span>طباعة</span>
            </Button>
            <Button className="gap-2" onClick={handleExport} data-testid="button-export">
              <Download className="w-4 h-4" />
              <span>تصدير Excel</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription>إجمالي الأصول</CardDescription>
              <CardTitle className="text-3xl text-primary font-mono" data-testid="text-total-items">{formatNumber(totalItems)}</CardTitle>
            </CardHeader>
          </Card>
          
          {showPrices && (
            <>
              <Card className="bg-card">
                <CardHeader className="pb-2">
                  <CardDescription>القيمة قبل الضريبة</CardDescription>
                  <CardTitle className="text-2xl font-mono" data-testid="text-total-value">{formatCurrency(totalValue)}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-card">
                <CardHeader className="pb-2">
                  <CardDescription>قيمة الضريبة (15%)</CardDescription>
                  <CardTitle className="text-2xl font-mono text-muted-foreground">{formatCurrency(totalVat)}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-green-50/50 border-green-100">
                <CardHeader className="pb-2">
                  <CardDescription>الإجمالي شامل الضريبة</CardDescription>
                  <CardTitle className="text-2xl text-green-700 font-mono" data-testid="text-total-with-vat">{formatCurrency(totalValueWithVat)}</CardTitle>
                </CardHeader>
              </Card>
            </>
          )}
          
          {unpricedItemsCount > 0 && showPrices && (
            <Card className="bg-orange-50/50 border-orange-100 md:col-span-4">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="bg-orange-100 p-2 rounded-full">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-bold text-orange-800">تنبيه: يوجد {unpricedItemsCount} صنف بدون قيمة مالية</p>
                  <p className="text-sm text-orange-600">يرجى مراجعة الأصناف وتحديث أسعارها لضمان دقة التقرير المالي.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div ref={componentRef} className="print:w-full">
          <div className="hidden print:flex flex-col items-center mb-8 border-b-2 border-black pb-4 pt-4">
            <div className="flex items-center gap-4 mb-4">
               <img src={logo} alt="Butter Bakery" className="w-32 h-auto" />
            </div>
            
            <div className="flex justify-between w-full px-12 mt-4 text-sm font-bold border-t border-black pt-4">
               <span>الفرع: {currentBranchName}</span>
               <span>تاريخ التقرير: {new Date().toLocaleDateString('en-GB')}</span>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-6 text-base border-2 border-primary/20 bg-primary/5 p-4 rounded-lg w-full text-center font-bold print:border-black print:bg-transparent">
               <div className="flex flex-col">
                  <span className="text-muted-foreground print:text-black text-sm">إجمالي الأصول</span>
                  <span className="text-xl font-mono">{formatNumber(totalItems)}</span>
               </div>
               
               {showPrices && (
                 <>
                   <div className="flex flex-col border-r border-primary/20 print:border-black px-4">
                      <span className="text-muted-foreground print:text-black text-sm">القيمة قبل الضريبة</span>
                      <span className="text-xl font-mono">{formatCurrency(totalValue)}</span>
                   </div>
                   <div className="flex flex-col border-r border-primary/20 print:border-black px-4">
                      <span className="text-muted-foreground print:text-black text-sm">الإجمالي شامل الضريبة</span>
                      <span className="text-xl font-mono text-green-700 print:text-black">{formatCurrency(totalValueWithVat)}</span>
                   </div>
                   <div className="flex flex-col border-r border-primary/20 print:border-black px-4">
                      <span className="text-muted-foreground print:text-black text-sm">أصناف غير مسعرة</span>
                      <span className={`text-xl font-mono ${unpricedItemsCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {unpricedItemsCount}
                      </span>
                   </div>
                 </>
               )}
            </div>
          </div>

          <Tabs defaultValue="medina" className="w-full" onValueChange={setActiveBranch} value={activeBranch}>
            <TabsList className="w-full md:w-auto grid grid-cols-2 md:inline-flex h-auto p-1 bg-muted/50 print:hidden">
              {branches.map(branch => (
                <TabsTrigger key={branch.id} value={branch.id} className="py-2.5 px-6 text-base" data-testid={`tab-branch-${branch.id}`}>
                  {branch.name}
                </TabsTrigger>
              ))}
              <TabsTrigger value="all" className="py-2.5 px-6 text-base font-bold text-primary" data-testid="tab-branch-all">بحث شامل (كل الفروع)</TabsTrigger>
            </TabsList>

            <div className="mt-6 flex flex-col md:flex-row items-start md:items-center gap-4 bg-card p-4 rounded-lg border border-border shadow-sm print:hidden">
              <div className="relative flex-1 w-full md:w-auto max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="بحث عن أصل أو معدة..." 
                  className="pr-10 bg-background/50 border-muted"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-full md:w-[200px]">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="تصفية حسب الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفئات</SelectItem>
                      {allCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 border-r pr-4 mr-4">
                  <Switch 
                    id="show-prices" 
                    checked={showPrices}
                    onCheckedChange={setShowPrices}
                    data-testid="switch-show-prices"
                  />
                  <Label htmlFor="show-prices" className="cursor-pointer">إظهار الأسعار</Label>
                </div>
                
                <AdvancedFilters
                  filters={advancedFilters}
                  onFiltersChange={setAdvancedFilters}
                  onApply={() => setAppliedFilters(advancedFilters)}
                  onClear={() => {
                    setAdvancedFilters(defaultFilters);
                    setAppliedFilters(defaultFilters);
                  }}
                />
              </div>
            </div>

            {branches.map(branch => (
              <TabsContent key={branch.id} value={branch.id} className="mt-6 space-y-8 print:mt-0 print:space-y-4">
                <InventoryList />
              </TabsContent>
            ))}

            <TabsContent value="all" className="mt-6 space-y-8 print:mt-0 print:space-y-4">
               {searchQuery.length > 0 || selectedCategory !== 'all' ? (
                 <InventoryList />
               ) : (
                 <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/20">
                   <p className="text-muted-foreground text-lg font-bold mb-2">البحث الشامل في جميع الفروع</p>
                   <p className="text-muted-foreground">استخدم شريط البحث أو الفلاتر أعلاه للبحث عن أصل معين في كل الفروع في وقت واحد.</p>
                   <p className="text-muted-foreground text-sm mt-2">(سيظهر اسم الفرع بجانب كل نتيجة)</p>
                 </div>
               )}
            </TabsContent>
          </Tabs>

          {showPrices && (
            <div className="hidden print:block mt-8 mb-8 break-inside-avoid">
              <h3 className="text-xl font-bold mb-4 border-b border-black pb-2">ملخص المجموعات</h3>
              <Table className="border border-black">
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-black">
                    <TableHead className="text-right font-bold text-black border-black">المجموعة / الفئة</TableHead>
                    <TableHead className="text-right font-bold text-black border-black">عدد الأصناف</TableHead>
                    <TableHead className="text-right font-bold text-black border-black">إجمالي الكميات</TableHead>
                    <TableHead className="text-right font-bold text-black border-black">القيمة (قبل الضريبة)</TableHead>
                    <TableHead className="text-right font-bold text-black border-black">الضريبة (15%)</TableHead>
                    <TableHead className="text-right font-bold text-black border-black">الإجمالي (شامل الضريبة)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categorySummaries.map((summary) => (
                    <TableRow key={summary.category} className="border-black">
                      <TableCell className="font-bold border-black">{summary.category}</TableCell>
                      <TableCell className="font-mono border-black">{summary.itemsCount}</TableCell>
                      <TableCell className="font-mono border-black">{summary.count}</TableCell>
                      <TableCell className="font-mono border-black">{formatCurrency(summary.value)}</TableCell>
                      <TableCell className="font-mono border-black">{formatCurrency(summary.vat)}</TableCell>
                      <TableCell className="font-mono font-bold border-black">{formatCurrency(summary.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 border-black font-bold text-lg">
                    <TableCell className="border-black">المجموع الكلي</TableCell>
                    <TableCell className="font-mono border-black">{categorySummaries.reduce((acc, s) => acc + s.itemsCount, 0)}</TableCell>
                    <TableCell className="font-mono border-black">{formatNumber(totalItems)}</TableCell>
                    <TableCell className="font-mono border-black">{formatCurrency(totalValue)}</TableCell>
                    <TableCell className="font-mono border-black">{formatCurrency(totalVat)}</TableCell>
                    <TableCell className="font-mono border-black">{formatCurrency(totalValueWithVat)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}

          <div className="hidden print:flex justify-between items-end mt-12 pt-8 border-t border-black text-sm">
             <div className="text-center">
                <p className="mb-8 font-bold">مدير الفرع</p>
                <p>_________________</p>
             </div>
             <div className="text-center">
                <p className="mb-8 font-bold">المحاسب</p>
                <p>_________________</p>
             </div>
             <div className="text-center">
                <p className="mb-8 font-bold">الاعتماد</p>
                <p>_________________</p>
             </div>
          </div>
        </div>
      </div>

      <ItemCardDialog
        item={selectedItem}
        branchName={selectedItem?.branchName}
        open={isItemCardOpen}
        onOpenChange={setIsItemCardOpen}
      />
    </Layout>
  );
}
