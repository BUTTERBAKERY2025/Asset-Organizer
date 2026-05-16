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
  Boxes, Plus, Search, Filter, AlertTriangle, Package,
  ArrowLeft, Edit, Trash2, CheckCircle
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type WarehouseItem = {
  id: number;
  name: string;
  nameEn: string;
  sku: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  reorderPoint: number;
  unitCost: number;
  isActive: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const MATERIAL_CATEGORIES = [
  { value: "raw_materials", labelAr: "مواد خام", labelEn: "Raw Materials", color: "bg-amber-500" },
  { value: "consumables", labelAr: "مستهلكات", labelEn: "Consumables", color: "bg-blue-500" },
  { value: "packaging", labelAr: "مواد تغليف", labelEn: "Packaging", color: "bg-purple-500" },
  { value: "primary_production", labelAr: "مواد إنتاج أولية", labelEn: "Primary Production", color: "bg-green-500" },
];

const UNITS = [
  { value: "كجم", labelAr: "كيلوجرام", labelEn: "Kilogram" },
  { value: "جرام", labelAr: "جرام", labelEn: "Gram" },
  { value: "لتر", labelAr: "لتر", labelEn: "Liter" },
  { value: "مل", labelAr: "مليلتر", labelEn: "Milliliter" },
  { value: "قطعة", labelAr: "قطعة", labelEn: "Piece" },
  { value: "علبة", labelAr: "علبة", labelEn: "Box" },
  { value: "كرتون", labelAr: "كرتون", labelEn: "Carton" },
  { value: "كيس", labelAr: "كيس", labelEn: "Bag" },
];

function getCategoryBadge(category: string, isRTL: boolean) {
  const cat = MATERIAL_CATEGORIES.find(c => c.value === category);
  if (!cat) return <Badge variant="outline">{category}</Badge>;
  return (
    <Badge className={`${cat.color} text-white`}>
      {isRTL ? cat.labelAr : cat.labelEn}
    </Badge>
  );
}

function getStockStatus(item: WarehouseItem, isRTL: boolean) {
  if (item.currentStock <= item.minStock) {
    return <Badge variant="destructive">{isRTL ? "نفاد" : "Out of Stock"}</Badge>;
  }
  if (item.currentStock <= item.reorderPoint) {
    return <Badge className="bg-yellow-500 text-white">{isRTL ? "منخفض" : "Low Stock"}</Badge>;
  }
  return <Badge className="bg-green-500 text-white">{isRTL ? "متوفر" : "In Stock"}</Badge>;
}

export default function WarehouseInventoryPage() {
  const { t, i18n } = useTranslation("platform-home");
  const isRTL = i18n.language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStock, setFilterStock] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    nameEn: "",
    sku: "",
    category: "raw_materials",
    unit: "كجم",
    currentStock: 0,
    minStock: 0,
    reorderPoint: 0,
    unitCost: 0,
    notes: "",
  });

  const { data: items = [], isLoading } = useQuery<WarehouseItem[]>({
    queryKey: ["/api/warehouse/items", filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterCategory !== "all") params.append("category", filterCategory);
      params.append("isActive", "true");
      const response = await fetch(`/api/warehouse/items?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch items");
      return response.json();
    },
    staleTime: 1000 * 60 * 30, // 30 minutes - warehouse catalog
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/warehouse/items", {
        ...data,
        isActive: true,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: isRTL ? "تم إضافة المادة بنجاح" : "Item added successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: isRTL ? "فشل في إضافة المادة" : "Failed to add item",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const response = await apiRequest("PUT", `/api/warehouse/items/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      setIsEditOpen(false);
      setSelectedItem(null);
      toast({ title: isRTL ? "تم تحديث المادة بنجاح" : "Item updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: isRTL ? "فشل في تحديث المادة" : "Failed to update item",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/warehouse/items/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      toast({ title: isRTL ? "تم حذف المادة بنجاح" : "Item deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: isRTL ? "فشل في حذف المادة" : "Failed to delete item",
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      nameEn: "",
      sku: "",
      category: "raw_materials",
      unit: "كجم",
      currentStock: 0,
      minStock: 0,
      reorderPoint: 0,
      unitCost: 0,
      notes: "",
    });
  };

  const handleEdit = (item: WarehouseItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      nameEn: item.nameEn || "",
      sku: item.sku || "",
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock,
      minStock: item.minStock,
      reorderPoint: item.reorderPoint,
      unitCost: item.unitCost || 0,
      notes: item.notes || "",
    });
    setIsEditOpen(true);
  };

  const filteredItems = items.filter(item => {
    if (filterStock === "low" && item.currentStock > item.reorderPoint) return false;
    if (filterStock === "ok" && item.currentStock <= item.reorderPoint) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        item.nameEn?.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const lowStockItems = items.filter(item => item.currentStock <= item.reorderPoint);

  const ItemForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{isRTL ? "اسم المادة (عربي)" : "Item Name (Arabic)"}</Label>
          <Input 
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={isRTL ? "اسم المادة" : "Item name"}
            data-testid="input-name-ar"
          />
        </div>
        <div className="space-y-2">
          <Label>{isRTL ? "اسم المادة (إنجليزي)" : "Item Name (English)"}</Label>
          <Input 
            value={formData.nameEn}
            onChange={(e) => setFormData(prev => ({ ...prev, nameEn: e.target.value }))}
            placeholder="Item name"
            data-testid="input-name-en"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{isRTL ? "رمز المادة (SKU)" : "SKU"}</Label>
          <Input 
            value={formData.sku}
            onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
            placeholder="SKU-001"
            data-testid="input-sku"
          />
        </div>
        <div className="space-y-2">
          <Label>{isRTL ? "التصنيف" : "Category"}</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
            <SelectTrigger data-testid="select-category">
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
          <Label>{isRTL ? "الوحدة" : "Unit"}</Label>
          <Select value={formData.unit} onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}>
            <SelectTrigger data-testid="select-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((unit) => (
                <SelectItem key={unit.value} value={unit.value}>
                  {isRTL ? unit.labelAr : unit.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{isRTL ? "تكلفة الوحدة" : "Unit Cost"}</Label>
          <Input 
            type="number"
            min={0}
            step={0.01}
            value={formData.unitCost}
            onChange={(e) => setFormData(prev => ({ ...prev, unitCost: parseFloat(e.target.value) || 0 }))}
            data-testid="input-cost"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{isRTL ? "المخزون الحالي" : "Current Stock"}</Label>
          <Input 
            type="number"
            min={0}
            value={formData.currentStock}
            onChange={(e) => setFormData(prev => ({ ...prev, currentStock: parseFloat(e.target.value) || 0 }))}
            data-testid="input-current-stock"
          />
        </div>
        <div className="space-y-2">
          <Label>{isRTL ? "الحد الأدنى" : "Min Stock"}</Label>
          <Input 
            type="number"
            min={0}
            value={formData.minStock}
            onChange={(e) => setFormData(prev => ({ ...prev, minStock: parseFloat(e.target.value) || 0 }))}
            data-testid="input-min-stock"
          />
        </div>
        <div className="space-y-2">
          <Label>{isRTL ? "نقطة إعادة الطلب" : "Reorder Point"}</Label>
          <Input 
            type="number"
            min={0}
            value={formData.reorderPoint}
            onChange={(e) => setFormData(prev => ({ ...prev, reorderPoint: parseFloat(e.target.value) || 0 }))}
            data-testid="input-reorder"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{isRTL ? "ملاحظات" : "Notes"}</Label>
        <Textarea 
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."}
          data-testid="input-notes"
        />
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 max-w-none space-y-4 sm:space-y-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/warehouse-dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                <ArrowLeft className={`w-4 h-4 sm:w-5 sm:h-5 ${isRTL ? "rotate-180" : ""}`} />
              </Button>
            </Link>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-amber-500 flex items-center justify-center">
              <Boxes className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
                {isRTL ? "مخزون المستودع" : "Warehouse Inventory"}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {isRTL ? "إدارة مخزون المواد الخام والمستلزمات" : "Manage raw materials and supplies inventory"}
              </p>
            </div>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-add-item" className="w-full sm:w-auto">
                <Plus className={`w-4 h-4 ${isRTL ? "ml-2" : "mr-2"}`} />
                <span className="hidden sm:inline">{isRTL ? "إضافة مادة" : "Add Item"}</span>
                <span className="sm:hidden">{isRTL ? "إضافة" : "Add"}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{isRTL ? "إضافة مادة جديدة" : "Add New Item"}</DialogTitle>
                <DialogDescription>
                  {isRTL ? "أدخل تفاصيل المادة الجديدة" : "Enter details for the new item"}
                </DialogDescription>
              </DialogHeader>
              <ItemForm />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  {isRTL ? "إلغاء" : "Cancel"}
                </Button>
                <Button 
                  onClick={() => createMutation.mutate(formData)} 
                  disabled={!formData.name || createMutation.isPending}
                  data-testid="btn-submit-item"
                >
                  {createMutation.isPending ? (isRTL ? "جاري الإضافة..." : "Adding...") : (isRTL ? "إضافة" : "Add")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {lowStockItems.length > 0 && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    {isRTL ? `${lowStockItems.length} مواد تحتاج إعادة طلب` : `${lowStockItems.length} items need reordering`}
                  </p>
                  {lowStockItems.length <= 5 ? (
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      {lowStockItems.map(i => i.name).join('، ')}
                    </p>
                  ) : (
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      {isRTL 
                        ? `انقر على فلتر "منخفض" لعرض جميع المواد التي تحتاج إعادة طلب`
                        : `Click "Low Stock" filter to view all items needing reorder`
                      }
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={isRTL ? "بحث باسم المادة أو الرمز..." : "Search by name or SKU..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 sm:h-10"
              data-testid="input-search"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px] sm:w-[180px] h-9 sm:h-10" data-testid="filter-category">
                <Filter className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <SelectValue placeholder={isRTL ? "التصنيف" : "Category"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "جميع التصنيفات" : "All Categories"}</SelectItem>
                {MATERIAL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {isRTL ? cat.labelAr : cat.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStock} onValueChange={setFilterStock}>
              <SelectTrigger className="w-[100px] sm:w-[150px] h-9 sm:h-10" data-testid="filter-stock">
                <SelectValue placeholder={isRTL ? "الحالة" : "Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isRTL ? "كل الحالات" : "All Status"}</SelectItem>
                <SelectItem value="low">{isRTL ? "منخفض" : "Low Stock"}</SelectItem>
                <SelectItem value="ok">{isRTL ? "متوفر" : "In Stock"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">{isRTL ? "اسم المادة" : "Item Name"}</TableHead>
                    <TableHead className="hidden md:table-cell">{isRTL ? "الرمز" : "SKU"}</TableHead>
                    <TableHead className="hidden sm:table-cell">{isRTL ? "التصنيف" : "Category"}</TableHead>
                    <TableHead>{isRTL ? "المخزون" : "Stock"}</TableHead>
                    <TableHead className="hidden lg:table-cell">{isRTL ? "الحد الأدنى" : "Min Stock"}</TableHead>
                    <TableHead>{isRTL ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="hidden md:table-cell">{isRTL ? "التكلفة" : "Cost"}</TableHead>
                    <TableHead>{isRTL ? "إجراء" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      {isRTL ? "جاري التحميل..." : "Loading..."}
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {isRTL ? "لا توجد مواد" : "No items found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} data-testid={`item-row-${item.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm sm:text-base">{item.name}</p>
                          {item.nameEn && <p className="text-[10px] sm:text-xs text-muted-foreground">{item.nameEn}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell font-mono text-xs sm:text-sm">{item.sku || "-"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{getCategoryBadge(item.category, isRTL)}</TableCell>
                      <TableCell>
                        <span className={`text-xs sm:text-sm ${item.currentStock <= item.reorderPoint ? "text-red-500 font-bold" : ""}`}>
                          {item.currentStock} {item.unit}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs sm:text-sm">{item.minStock} {item.unit}</TableCell>
                      <TableCell>{getStockStatus(item, isRTL)}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs sm:text-sm">{item.unitCost ? `${item.unitCost.toFixed(2)} ر.س` : "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 sm:h-8 sm:w-8"
                            onClick={() => handleEdit(item)}
                            data-testid={`btn-edit-${item.id}`}
                          >
                            <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 sm:h-8 sm:w-8"
                            onClick={() => {
                              if (confirm(isRTL ? "هل أنت متأكد من حذف هذه المادة؟" : "Are you sure you want to delete this item?")) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            data-testid={`btn-delete-${item.id}`}
                          >
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                          </Button>
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

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{isRTL ? "تعديل المادة" : "Edit Item"}</DialogTitle>
              <DialogDescription>
                {isRTL ? `تعديل بيانات ${selectedItem?.name}` : `Edit details for ${selectedItem?.name}`}
              </DialogDescription>
            </DialogHeader>
            <ItemForm isEdit />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button 
                onClick={() => {
                  if (selectedItem) {
                    updateMutation.mutate({ id: selectedItem.id, data: formData });
                  }
                }} 
                disabled={!formData.name || updateMutation.isPending}
                data-testid="btn-save-item"
              >
                {updateMutation.isPending ? (isRTL ? "جاري الحفظ..." : "Saving...") : (isRTL ? "حفظ" : "Save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
