import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Loader2, CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import type { Branch, InventoryItem } from "@shared/schema";

const itemFormSchema = z.object({
  id: z.string().min(1, "معرف الصنف مطلوب"),
  branchId: z.string().min(1, "الفرع مطلوب"),
  name: z.string().min(1, "اسم الصنف مطلوب"),
  quantity: z.coerce.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  unit: z.string().min(1, "الوحدة مطلوبة"),
  category: z.string().min(1, "الفئة مطلوبة"),
  price: z.coerce.number().optional().nullable(),
  status: z.string().optional().nullable(),
  lastCheck: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
});

type ItemFormData = z.infer<typeof itemFormSchema>;

const CATEGORIES = [
  "أثاث وعام",
  "باريستا",
  "المطبخ",
  "كاشير",
  "بيتزا",
  "التغليف",
  "معدات التنظيف",
  "مستلزمات الموظفين",
];

const UNITS = ["حبة", "كيلو", "لتر", "صندوق", "كرتون", "علبة"];

const STATUSES = [
  { value: "good", label: "جيد" },
  { value: "maintenance", label: "صيانة" },
  { value: "damaged", label: "تالف" },
  { value: "missing", label: "مفقود" },
];

export default function ManagePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const createMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "تم إضافة الصنف بنجاح" });
      setIsAddDialogOpen(false);
      addForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ItemFormData> }) => {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "تم تحديث الصنف بنجاح" });
      setIsEditDialogOpen(false);
      setSelectedItem(null);
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "تم حذف الصنف بنجاح" });
      setIsDeleteDialogOpen(false);
      setSelectedItem(null);
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف الصنف", variant: "destructive" });
    },
  });

  const addForm = useForm<ItemFormData>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      id: "",
      branchId: "",
      name: "",
      quantity: 1,
      unit: "حبة",
      category: "",
      price: null,
      status: "good",
      lastCheck: null,
      notes: null,
      serialNumber: null,
    },
  });

  const editForm = useForm<ItemFormData>({
    resolver: zodResolver(itemFormSchema),
  });

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(b => { map[b.id] = b.name; });
    return map;
  }, [branches]);

  const filteredItems = useMemo(() => {
    return inventoryItems.filter(item => {
      const matchesBranch = selectedBranch === "all" || item.branchId === selectedBranch;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesBranch && matchesSearch;
    });
  }, [inventoryItems, selectedBranch, searchQuery]);

  const handleEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    editForm.reset({
      id: item.id,
      branchId: item.branchId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      price: item.price,
      status: item.status,
      lastCheck: item.lastCheck,
      notes: item.notes,
      serialNumber: item.serialNumber,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsDeleteDialogOpen(true);
  };

  const getStatusBadge = (status?: string | null) => {
    switch(status) {
      case "good": 
        return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 className="w-3 h-3" /> جيد</Badge>;
      case "maintenance": 
        return <Badge className="bg-orange-100 text-orange-700 border-orange-200 gap-1"><AlertTriangle className="w-3 h-3" /> صيانة</Badge>;
      case "damaged": 
        return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" /> تالف</Badge>;
      case "missing": 
        return <Badge className="bg-gray-100 text-gray-700 border-gray-200 gap-1"><HelpCircle className="w-3 h-3" /> مفقود</Badge>;
      default: 
        return <Badge variant="outline">غير محدد</Badge>;
    }
  };

  const generateNextId = (branchId: string) => {
    const prefix = branchId === "medina" ? "m" : branchId === "tabuk" ? "t" : "r";
    const branchItems = inventoryItems.filter(item => item.branchId === branchId);
    const maxNum = branchItems.reduce((max, item) => {
      const match = item.id.match(new RegExp(`^${prefix}-(\\d+)$`));
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    return `${prefix}-${maxNum + 1}`;
  };

  const isLoading = branchesLoading || inventoryLoading;

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

  const ItemForm = ({ form, onSubmit, isLoading, isEdit = false }: {
    form: ReturnType<typeof useForm<ItemFormData>>;
    onSubmit: (data: ItemFormData) => void;
    isLoading: boolean;
    isEdit?: boolean;
  }) => (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="branchId">الفرع *</Label>
          <Select
            value={form.watch("branchId")}
            onValueChange={(value) => {
              form.setValue("branchId", value);
              if (!isEdit) {
                form.setValue("id", generateNextId(value));
              }
            }}
            disabled={isEdit}
          >
            <SelectTrigger data-testid="select-branch-form">
              <SelectValue placeholder="اختر الفرع" />
            </SelectTrigger>
            <SelectContent>
              {branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.branchId && (
            <p className="text-sm text-destructive">{form.formState.errors.branchId.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="id">معرف الصنف *</Label>
          <Input
            {...form.register("id")}
            disabled={isEdit}
            placeholder="مثال: m-1"
            data-testid="input-item-id"
          />
          {form.formState.errors.id && (
            <p className="text-sm text-destructive">{form.formState.errors.id.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">اسم الصنف *</Label>
        <Input
          {...form.register("name")}
          placeholder="اسم الصنف أو المعدة"
          data-testid="input-item-name"
        />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">الفئة *</Label>
          <Select
            value={form.watch("category")}
            onValueChange={(value) => form.setValue("category", value)}
          >
            <SelectTrigger data-testid="select-category-form">
              <SelectValue placeholder="اختر الفئة" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.category && (
            <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">الحالة</Label>
          <Select
            value={form.watch("status") || "good"}
            onValueChange={(value) => form.setValue("status", value)}
          >
            <SelectTrigger data-testid="select-status-form">
              <SelectValue placeholder="اختر الحالة" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">الكمية *</Label>
          <Input
            type="number"
            min={0}
            {...form.register("quantity")}
            data-testid="input-item-quantity"
          />
          {form.formState.errors.quantity && (
            <p className="text-sm text-destructive">{form.formState.errors.quantity.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">الوحدة *</Label>
          <Select
            value={form.watch("unit")}
            onValueChange={(value) => form.setValue("unit", value)}
          >
            <SelectTrigger data-testid="select-unit-form">
              <SelectValue placeholder="اختر الوحدة" />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map(u => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">السعر (ريال)</Label>
          <Input
            type="number"
            step="0.01"
            min={0}
            {...form.register("price")}
            placeholder="اختياري"
            data-testid="input-item-price"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="serialNumber">الرقم التسلسلي</Label>
          <Input
            {...form.register("serialNumber")}
            placeholder="اختياري"
            data-testid="input-serial-number"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastCheck">آخر فحص</Label>
          <Input
            {...form.register("lastCheck")}
            placeholder="مثال: 2025-01-01"
            data-testid="input-last-check"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea
          {...form.register("notes")}
          placeholder="ملاحظات إضافية (اختياري)"
          rows={3}
          data-testid="textarea-notes"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} data-testid="button-submit-form">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
          {isEdit ? "حفظ التعديلات" : "إضافة الصنف"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">إدارة الأصول</h1>
            <p className="text-muted-foreground mt-1">إضافة وتعديل وحذف الأصول والمعدات</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-item">
                <Plus className="w-4 h-4" />
                <span>إضافة صنف جديد</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إضافة صنف جديد</DialogTitle>
                <DialogDescription>أدخل بيانات الصنف أو المعدة الجديدة</DialogDescription>
              </DialogHeader>
              <ItemForm
                form={addForm}
                onSubmit={(data) => createMutation.mutate(data)}
                isLoading={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قائمة الأصول</CardTitle>
            <CardDescription>عدد الأصناف: {filteredItems.length}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث عن صنف..."
                  className="pr-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-manage"
                />
              </div>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-full md:w-[200px]" data-testid="select-branch-filter">
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفروع</SelectItem>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-[80px]">المعرف</TableHead>
                    <TableHead className="text-right">الصنف</TableHead>
                    <TableHead className="text-right w-[120px]">الفرع</TableHead>
                    <TableHead className="text-right w-[100px]">الفئة</TableHead>
                    <TableHead className="text-right w-[80px]">الكمية</TableHead>
                    <TableHead className="text-right w-[100px]">الحالة</TableHead>
                    <TableHead className="text-right w-[100px]">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        لا توجد نتائج
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id} data-testid={`row-manage-${item.id}`}>
                        <TableCell className="font-mono text-xs">{item.id}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-sm">{branchMap[item.branchId]}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.category}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.quantity}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(item)}
                              data-testid={`button-edit-${item.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item)}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
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

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تعديل الصنف</DialogTitle>
              <DialogDescription>تعديل بيانات الصنف: {selectedItem?.name}</DialogDescription>
            </DialogHeader>
            <ItemForm
              form={editForm}
              onSubmit={(data) => {
                if (selectedItem) {
                  updateMutation.mutate({ id: selectedItem.id, data });
                }
              }}
              isLoading={updateMutation.isPending}
              isEdit
            />
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف الصنف "{selectedItem?.name}"؟
                <br />
                هذا الإجراء لا يمكن التراجع عنه.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedItem && deleteMutation.mutate(selectedItem.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
