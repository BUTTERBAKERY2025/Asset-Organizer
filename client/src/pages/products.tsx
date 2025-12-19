import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Factory, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@shared/schema";

const PRODUCT_CATEGORIES = [
  { value: "bread", label: "خبز" },
  { value: "pastry", label: "معجنات" },
  { value: "cake", label: "كيك وحلويات" },
  { value: "sandwich", label: "ساندويتشات" },
  { value: "cookies", label: "كوكيز وبسكويت" },
  { value: "other", label: "أخرى" },
];

export default function ProductsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    nameEn: "",
    category: "",
    unit: "قطعة",
    preparationTime: "",
    bakingTime: "",
    notes: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/products", "POST", data),
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
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest(`/api/products/${id}`, "PATCH", data),
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
    mutationFn: async (id: number) => apiRequest(`/api/products/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "تم حذف المنتج بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف المنتج", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", nameEn: "", category: "", unit: "قطعة", preparationTime: "", bakingTime: "", notes: "" });
    setEditingProduct(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      preparationTime: formData.preparationTime ? parseInt(formData.preparationTime) : null,
      bakingTime: formData.bakingTime ? parseInt(formData.bakingTime) : null,
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
      nameEn: product.nameEn || "",
      category: product.category,
      unit: product.unit || "قطعة",
      preparationTime: product.preparationTime?.toString() || "",
      bakingTime: product.bakingTime?.toString() || "",
      notes: product.notes || "",
    });
    setIsDialogOpen(true);
  };

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryLabel = (value: string) => PRODUCT_CATEGORIES.find(c => c.value === value)?.label || value;

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">إدارة المنتجات</h1>
            <p className="text-muted-foreground">قائمة المنتجات والمخبوزات</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-product">
                <Plus className="w-4 h-4 ml-2" />
                إضافة منتج
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
                <DialogDescription>أدخل بيانات المنتج</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>اسم المنتج *</Label>
                  <Input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: خبز صامولي"
                    data-testid="input-product-name"
                  />
                </div>
                <div>
                  <Label>الاسم بالإنجليزية</Label>
                  <Input
                    value={formData.nameEn}
                    onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder="e.g. Samoli Bread"
                  />
                </div>
                <div>
                  <Label>التصنيف *</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="اختر التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>وقت التحضير (دقيقة)</Label>
                    <Input
                      type="number"
                      value={formData.preparationTime}
                      onChange={e => setFormData({ ...formData, preparationTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>وقت الخبز (دقيقة)</Label>
                    <Input
                      type="number"
                      value={formData.bakingTime}
                      onChange={e => setFormData({ ...formData, bakingTime: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>إلغاء</Button>
                <Button onClick={handleSubmit} disabled={!formData.name || !formData.category} data-testid="button-save-product">
                  {editingProduct ? "تحديث" : "إضافة"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن منتج..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pr-10"
              data-testid="input-search"
            />
          </div>
          <Badge variant="secondary">{products?.length || 0} منتج</Badge>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : filteredProducts?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Factory className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد منتجات</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                إضافة أول منتج
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts?.map(product => (
              <Card key={product.id} data-testid={`product-card-${product.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      {product.nameEn && (
                        <CardDescription className="text-xs">{product.nameEn}</CardDescription>
                      )}
                    </div>
                    <Badge variant="outline">{getCategoryLabel(product.category)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {product.preparationTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>تحضير: {product.preparationTime}د</span>
                      </div>
                    )}
                    {product.bakingTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>خبز: {product.bakingTime}د</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(product)} data-testid={`edit-product-${product.id}`}>
                      <Edit className="w-3 h-3 ml-1" />
                      تعديل
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(product.id)} data-testid={`delete-product-${product.id}`}>
                      <Trash2 className="w-3 h-3 ml-1" />
                      حذف
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
