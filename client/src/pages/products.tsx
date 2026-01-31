import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Package, Filter, X, Download, FileSpreadsheet, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { TablePagination } from "@/components/ui/pagination";
import { ExportButtons } from "@/components/export-buttons";
import type { Product } from "@shared/schema";

const PRODUCT_CATEGORIES = [
  { value: "إفطار", label: "إفطار" },
  { value: "مخبوزات", label: "مخبوزات" },
  { value: "حلويات", label: "حلويات" },
  { value: "بيتزا", label: "بيتزا" },
  { value: "باريستا", label: "باريستا" },
  { value: "تجمعات", label: "تجمعات" },
  { value: "أخرى", label: "أخرى" },
];

const PRODUCT_TYPES = [
  { value: "finish", label: "نهائي (للبيع)", color: "bg-green-100 text-green-700" },
  { value: "inventory", label: "مخزني (خام)", color: "bg-blue-100 text-blue-700" },
];

const UNITS = [
  { value: "قطعة", label: "قطعة" },
  { value: "كوب", label: "كوب" },
  { value: "طبق", label: "طبق" },
  { value: "باكيت", label: "باكيت" },
  { value: "زجاجة", label: "زجاجة" },
  { value: "تذكرة/حجز", label: "تذكرة/حجز" },
];

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [formData, setFormData] = useState({
    name: "",
    nameEn: "",
    sku: "",
    category: "",
    productType: "finish",
    unit: "قطعة",
    basePrice: "",
    priceExclVat: "",
    vatAmount: "",
    vatRate: "0.15",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "تم إضافة المنتج بنجاح" });
      resetForm();
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إضافة المنتج", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "تم تحديث المنتج بنجاح" });
      resetForm();
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث المنتج", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "تم حذف المنتج بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف المنتج", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", nameEn: "", sku: "", category: "", productType: "finish", unit: "قطعة", basePrice: "", priceExclVat: "", vatAmount: "", vatRate: "0.15" });
    setEditingProduct(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    const data = {
      name: formData.name,
      nameEn: formData.nameEn,
      sku: formData.sku,
      category: formData.category,
      productType: formData.productType,
      unit: formData.unit,
      basePrice: formData.basePrice ? parseFloat(formData.basePrice) : null,
      priceExclVat: formData.priceExclVat ? parseFloat(formData.priceExclVat) : null,
      vatAmount: formData.vatAmount ? parseFloat(formData.vatAmount) : null,
      vatRate: formData.vatRate ? parseFloat(formData.vatRate) : 0.15,
      isActive: true,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      nameEn: (product as any).nameEn || "",
      sku: (product as any).sku || "",
      category: product.category,
      productType: (product as any).productType || "finish",
      unit: product.unit || "قطعة",
      basePrice: product.basePrice?.toString() || "",
      priceExclVat: (product as any).priceExclVat?.toString() || "",
      vatAmount: (product as any).vatAmount?.toString() || "",
      vatRate: (product as any).vatRate?.toString() || "0.15",
    });
    setIsDialogOpen(true);
  };

  const handlePriceExclVatChange = (value: string) => {
    const priceExclVat = parseFloat(value) || 0;
    const vatRate = parseFloat(formData.vatRate) || 0.15;
    const vatAmount = priceExclVat * vatRate;
    const basePrice = priceExclVat + vatAmount;
    setFormData({
      ...formData,
      priceExclVat: value,
      vatAmount: vatAmount.toFixed(2),
      basePrice: basePrice.toFixed(2),
    });
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((p as any).sku || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchesType = productTypeFilter === "all" || (p as any).productType === productTypeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      "إفطار": "bg-orange-100 text-orange-700",
      "مخبوزات": "bg-amber-100 text-amber-700",
      "حلويات": "bg-pink-100 text-pink-700",
      "بيتزا": "bg-red-100 text-red-700",
      "باريستا": "bg-blue-100 text-blue-700",
      "تجمعات": "bg-purple-100 text-purple-700",
      "أخرى": "bg-gray-100 text-gray-700",
    };
    return colors[category] || "bg-gray-100 text-gray-700";
  };

  const getProductTypeBadgeColor = (type: string) => {
    return type === "finish" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700";
  };

  const getProductTypeLabel = (type: string) => {
    return type === "finish" ? "نهائي" : "مخزني";
  };

  const categoryCounts = PRODUCT_CATEGORIES.map(cat => ({
    ...cat,
    count: products.filter(p => p.category === cat.value).length,
  }));

  const exportColumns = [
    { header: "رمز SKU", key: "sku", width: 12 },
    { header: "اسم المنتج (عربي)", key: "name", width: 30 },
    { header: "Product Name (English)", key: "nameEn", width: 30 },
    { header: "الفئة", key: "category", width: 15 },
    { header: "نوع الصنف", key: "productTypeLabel", width: 12 },
    { header: "الوحدة", key: "unit", width: 10 },
    { header: "السعر بدون ضريبة", key: "priceExclVat", width: 15 },
    { header: "قيمة الضريبة", key: "vatAmount", width: 12 },
    { header: "السعر شامل الضريبة", key: "basePrice", width: 15 },
    { header: "نسبة الضريبة", key: "vatRatePercent", width: 12 },
  ];

  const exportData = filteredProducts.map(p => ({
    ...p,
    nameEn: (p as any).nameEn || "",
    priceExclVat: (p as any).priceExclVat || 0,
    vatAmount: (p as any).vatAmount || 0,
    vatRatePercent: `${((p as any).vatRate || 0.15) * 100}%`,
    productTypeLabel: getProductTypeLabel((p as any).productType || "finish"),
  }));

  return (
    <Layout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-10 max-w-6xl mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/operations">
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-8 sm:w-8" data-testid="btn-back">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold flex items-center gap-2">
                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                إدارة المنتجات
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">قائمة المنتجات والأسعار - {products.length} منتج</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButtons
              data={exportData}
              columns={exportColumns}
              fileName="قائمة_المنتجات"
              title="قائمة منتجات BUTTER BAKERY"
              subtitle={`إجمالي ${products.length} منتج`}
            />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-product" className="gap-1 h-11 sm:h-9">
                  <Plus className="w-4 h-4" />
                  إضافة منتج
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
                  <DialogDescription>أدخل بيانات المنتج كاملة</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>اسم المنتج (عربي) *</Label>
                      <Input
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="مثال: كرواسون شوكولاته"
                        data-testid="input-product-name"
                        className="h-11 sm:h-10"
                      />
                    </div>
                    <div>
                      <Label>Product Name (English)</Label>
                      <Input
                        value={formData.nameEn}
                        onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                        placeholder="e.g. Chocolate Croissant"
                        data-testid="input-product-name-en"
                        className="h-11 sm:h-10"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label>رمز SKU</Label>
                      <Input
                        value={formData.sku}
                        onChange={e => setFormData({ ...formData, sku: e.target.value })}
                        placeholder="sk-1234"
                        className="h-11 sm:h-10"
                      />
                    </div>
                    <div>
                      <Label>الفئة *</Label>
                      <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                        <SelectTrigger data-testid="select-category" className="h-11 sm:h-10">
                          <SelectValue placeholder="اختر الفئة" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          {PRODUCT_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>نوع الصنف *</Label>
                      <Select value={formData.productType} onValueChange={v => setFormData({ ...formData, productType: v })}>
                        <SelectTrigger data-testid="select-product-type" className="h-11 sm:h-10">
                          <SelectValue placeholder="اختر النوع" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          {PRODUCT_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>الوحدة</Label>
                      <Select value={formData.unit} onValueChange={v => setFormData({ ...formData, unit: v })}>
                        <SelectTrigger className="h-11 sm:h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          {UNITS.map(u => (
                            <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>نسبة الضريبة</Label>
                      <Select value={formData.vatRate} onValueChange={v => setFormData({ ...formData, vatRate: v })}>
                        <SelectTrigger className="h-11 sm:h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          <SelectItem value="0.15">15%</SelectItem>
                          <SelectItem value="0">0%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>السعر بدون ضريبة</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.priceExclVat}
                        onChange={e => handlePriceExclVatChange(e.target.value)}
                        placeholder="0.00"
                        className="h-11 sm:h-10"
                      />
                    </div>
                    <div>
                      <Label>قيمة الضريبة</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.vatAmount}
                        readOnly
                        className="bg-muted h-11 sm:h-10"
                      />
                    </div>
                    <div>
                      <Label>السعر شامل الضريبة</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.basePrice}
                        readOnly
                        className="bg-muted font-semibold h-11 sm:h-10"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetForm} className="h-11 sm:h-9">إلغاء</Button>
                  <Button onClick={handleSubmit} disabled={!formData.name || !formData.category} className="h-11 sm:h-9">
                    {editingProduct ? "حفظ التعديلات" : "إضافة المنتج"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">نوع الصنف:</span>
          <Badge
            variant={productTypeFilter === "all" ? "default" : "outline"}
            className="cursor-pointer px-3 py-1"
            onClick={() => { setProductTypeFilter("all"); setCurrentPage(1); }}
          >
            الكل
          </Badge>
          {PRODUCT_TYPES.map(type => (
            <Badge
              key={type.value}
              variant={productTypeFilter === type.value ? "default" : "outline"}
              className={`cursor-pointer px-3 py-1 ${productTypeFilter === type.value ? "" : type.color}`}
              onClick={() => { setProductTypeFilter(type.value); setCurrentPage(1); }}
            >
              {type.label} ({products.filter(p => (p as any).productType === type.value).length})
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant={categoryFilter === "all" ? "default" : "outline"}
            className="cursor-pointer px-3 py-1"
            onClick={() => { setCategoryFilter("all"); setCurrentPage(1); }}
          >
            الكل ({products.length})
          </Badge>
          {categoryCounts.filter(c => c.count > 0).map(cat => (
            <Badge
              key={cat.value}
              variant={categoryFilter === cat.value ? "default" : "outline"}
              className={`cursor-pointer px-3 py-1 ${categoryFilter === cat.value ? "" : getCategoryBadgeColor(cat.value)}`}
              onClick={() => { setCategoryFilter(cat.value); setCurrentPage(1); }}
            >
              {cat.label} ({cat.count})
            </Badge>
          ))}
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="البحث بالاسم أو رمز SKU..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pr-10 h-11 sm:h-10"
                  data-testid="input-search"
                />
              </div>
              {(searchTerm || categoryFilter !== "all" || productTypeFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearchTerm(""); setCategoryFilter("all"); setProductTypeFilter("all"); setCurrentPage(1); }}
                  className="gap-1 h-11 sm:h-9"
                >
                  <X className="w-4 h-4" />
                  مسح الفلاتر
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead className="bg-muted/50 text-xs">
                      <tr>
                        <th className="p-2 sm:p-3 text-right font-semibold">#</th>
                        <th className="p-2 sm:p-3 text-right font-semibold hidden md:table-cell">SKU</th>
                        <th className="p-2 sm:p-3 text-right font-semibold">اسم المنتج</th>
                        <th className="p-2 sm:p-3 text-right font-semibold">الفئة</th>
                        <th className="p-2 sm:p-3 text-right font-semibold hidden md:table-cell">النوع</th>
                        <th className="p-2 sm:p-3 text-right font-semibold hidden lg:table-cell">الوحدة</th>
                        <th className="p-2 sm:p-3 text-right font-semibold hidden lg:table-cell">السعر بدون ضريبة</th>
                        <th className="p-2 sm:p-3 text-right font-semibold hidden lg:table-cell">الضريبة</th>
                        <th className="p-2 sm:p-3 text-right font-semibold">السعر شامل</th>
                        <th className="p-2 sm:p-3 text-right font-semibold">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paginatedProducts.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-muted-foreground">
                            لا توجد منتجات مطابقة للبحث
                          </td>
                        </tr>
                      ) : (
                        paginatedProducts.map((product, index) => (
                          <tr key={product.id} className="hover:bg-muted/30" data-testid={`row-product-${product.id}`}>
                            <td className="p-2 sm:p-3 text-muted-foreground text-xs">
                              {(currentPage - 1) * itemsPerPage + index + 1}
                            </td>
                            <td className="p-2 sm:p-3 hidden md:table-cell">
                              <code className="text-[10px] sm:text-xs bg-muted px-1.5 py-0.5 rounded">
                                {(product as any).sku || "-"}
                              </code>
                            </td>
                            <td className="p-2 sm:p-3 font-medium text-xs sm:text-sm">{product.name}</td>
                            <td className="p-2 sm:p-3">
                              <Badge className={`${getCategoryBadgeColor(product.category)} text-[10px] sm:text-xs`} variant="secondary">
                                {product.category}
                              </Badge>
                            </td>
                            <td className="p-2 sm:p-3 hidden md:table-cell">
                              <Badge className={`${getProductTypeBadgeColor((product as any).productType || "finish")} text-[10px] sm:text-xs`} variant="secondary">
                                {getProductTypeLabel((product as any).productType || "finish")}
                              </Badge>
                            </td>
                            <td className="p-2 sm:p-3 text-muted-foreground hidden lg:table-cell">{product.unit}</td>
                            <td className="p-2 sm:p-3 tabular-nums hidden lg:table-cell">
                              {((product as any).priceExclVat || 0).toFixed(2)}
                            </td>
                            <td className="p-2 sm:p-3 tabular-nums text-muted-foreground hidden lg:table-cell">
                              {((product as any).vatAmount || 0).toFixed(2)}
                            </td>
                            <td className="p-2 sm:p-3 tabular-nums font-semibold text-primary text-xs sm:text-sm">
                              {(product.basePrice || 0).toFixed(2)} ر.س
                            </td>
                            <td className="p-2 sm:p-3">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 sm:h-8 sm:w-8"
                                  onClick={() => handleEdit(product)}
                                  data-testid={`button-edit-${product.id}`}
                                >
                                  <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                                  onClick={() => deleteMutation.mutate(product.id)}
                                  data-testid={`button-delete-${product.id}`}
                                >
                                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {filteredProducts.length > itemsPerPage && (
                  <div className="mt-4">
                    <TablePagination
                      currentPage={currentPage}
                      totalItems={filteredProducts.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
