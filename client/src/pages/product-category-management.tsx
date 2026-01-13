import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Tag,
  Save,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";
import { COMPARISON_CATEGORIES, MADE_TO_ORDER_CATEGORIES } from "@shared/schema";

interface UncategorizedProduct {
  productName: string;
}

interface ProductStorageSetting {
  id: number;
  productName: string;
  productCategory: string | null;
  isStorable: boolean;
  maxStorageDays: number;
  storageType: string | null;
  notes: string | null;
}

export default function ProductCategoryManagementPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});
  const [bulkCategory, setBulkCategory] = useState<string>("");

  const { data: uncategorizedProducts = [], isLoading: loadingUncategorized } = useQuery<UncategorizedProduct[]>({
    queryKey: ["/api/uncategorized-products"],
  });

  const { data: storageSettings = [], isLoading: loadingSettings } = useQuery<ProductStorageSetting[]>({
    queryKey: ["/api/product-storage-settings"],
  });

  const bulkCategorizeMutation = useMutation({
    mutationFn: async (products: { productName: string; productCategory: string }[]) => {
      const res = await apiRequest("POST", "/api/bulk-categorize-products", { products });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "تم الحفظ",
        description: `تم تحديث ${data.updated} منتج`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/uncategorized-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/product-storage-settings"] });
      setSelectedProducts({});
      setBulkCategory("");
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل حفظ التصنيفات",
        variant: "destructive",
      });
    },
  });

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return uncategorizedProducts;
    return uncategorizedProducts.filter(p => 
      p.productName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [uncategorizedProducts, searchTerm]);

  const handleSingleCategory = (productName: string, category: string) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productName]: category
    }));
  };

  const handleBulkApply = () => {
    if (!bulkCategory) return;
    const newSelections: Record<string, string> = {};
    filteredProducts.forEach(p => {
      newSelections[p.productName] = bulkCategory;
    });
    setSelectedProducts(prev => ({
      ...prev,
      ...newSelections
    }));
  };

  const handleSave = () => {
    const products = Object.entries(selectedProducts)
      .filter(([_, category]) => category)
      .map(([productName, productCategory]) => ({
        productName,
        productCategory
      }));
    
    if (products.length === 0) {
      toast({
        title: "تنبيه",
        description: "لم يتم اختيار أي منتج للحفظ",
        variant: "destructive",
      });
      return;
    }
    
    bulkCategorizeMutation.mutate(products);
  };

  const categorizedCount = storageSettings.filter(s => s.productCategory).length;
  const uncategorizedCount = uncategorizedProducts.length;
  const selectedCount = Object.values(selectedProducts).filter(Boolean).length;

  if (loadingUncategorized || loadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/production-comparisons")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Tag className="h-6 w-6" />
              إدارة تصنيفات المنتجات
            </h1>
            <p className="text-muted-foreground">
              تصنيف المنتجات لتفعيل استثناء فئات المشروبات والبيتزا من تقارير الهالك
            </p>
          </div>
        </div>
        
        <Button
          onClick={handleSave}
          disabled={selectedCount === 0 || bulkCategorizeMutation.isPending}
          data-testid="button-save-categories"
        >
          <Save className="h-4 w-4 ml-2" />
          حفظ التغييرات ({selectedCount})
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">منتجات مصنفة</p>
                <p className="text-2xl font-bold text-green-600">{categorizedCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">منتجات غير مصنفة</p>
                <p className="text-2xl font-bold text-orange-600">{uncategorizedCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">محدد للحفظ</p>
                <p className="text-2xl font-bold text-blue-600">{selectedCount}</p>
              </div>
              <Tag className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {uncategorizedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">منتجات تحتاج تصنيف</p>
              <p className="text-sm text-amber-700">
                يوجد {uncategorizedCount} منتج بدون تصنيف. المنتجات غير المصنفة لن يتم استثناؤها بشكل صحيح من تقارير الهالك.
                قم بتصنيف المنتجات ثم أعد تشغيل المقارنة لتحديث البيانات.
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>المنتجات غير المصنفة</CardTitle>
          <CardDescription>
            اختر الفئة المناسبة لكل منتج. المنتجات في فئات "باريستا" و"بيتزا" ستُستثنى من حساب الهالك
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <Label>بحث</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث عن منتج..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                  data-testid="input-search-products"
                />
              </div>
            </div>
            
            <div className="flex items-end gap-2">
              <div>
                <Label>تصنيف جماعي</Label>
                <Select value={bulkCategory} onValueChange={setBulkCategory}>
                  <SelectTrigger className="w-[180px]" data-testid="select-bulk-category">
                    <SelectValue placeholder="اختر فئة" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPARISON_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                        {(MADE_TO_ORDER_CATEGORIES as readonly string[]).includes(cat) && (
                          <span className="text-xs text-purple-600 mr-2">(حسب الطلب)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                onClick={handleBulkApply}
                disabled={!bulkCategory}
                data-testid="button-apply-bulk"
              >
                <Filter className="h-4 w-4 ml-2" />
                تطبيق على الكل
              </Button>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p>جميع المنتجات مصنفة</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-[50%]">اسم المنتج</TableHead>
                    <TableHead className="text-right">الفئة</TableHead>
                    <TableHead className="text-center w-[100px]">حسب الطلب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const selectedCat = selectedProducts[product.productName];
                    const isMadeToOrder = selectedCat && (MADE_TO_ORDER_CATEGORIES as readonly string[]).includes(selectedCat);
                    
                    return (
                      <TableRow key={product.productName} data-testid={`row-product-${product.productName}`}>
                        <TableCell className="font-medium">{product.productName}</TableCell>
                        <TableCell>
                          <Select
                            value={selectedCat || ""}
                            onValueChange={(value) => handleSingleCategory(product.productName, value)}
                          >
                            <SelectTrigger 
                              className="w-full" 
                              data-testid={`select-category-${product.productName}`}
                            >
                              <SelectValue placeholder="اختر الفئة" />
                            </SelectTrigger>
                            <SelectContent>
                              {COMPARISON_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          {isMadeToOrder && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                              نعم
                            </Badge>
                          )}
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>فئات المنتجات حسب الطلب</CardTitle>
          <CardDescription>
            هذه الفئات يتم إنتاجها عند طلب العميل ولا يوجد فيها هالك
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(MADE_TO_ORDER_CATEGORIES as readonly string[]).map((cat) => (
              <Badge 
                key={cat} 
                variant="outline" 
                className="bg-purple-50 text-purple-700 border-purple-200 px-4 py-2"
              >
                {cat}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            المنتجات المصنفة ضمن هذه الفئات ستُستثنى تلقائياً من حساب الهالك عند تشغيل المقارنة
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
