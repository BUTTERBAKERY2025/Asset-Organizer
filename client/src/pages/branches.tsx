import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Building2 } from "lucide-react";
import type { Branch, InventoryItem } from "@shared/schema";

const branchFormSchema = z.object({
  id: z.string().min(1, "معرف الفرع مطلوب").regex(/^[a-zA-Z0-9_-]+$/, "المعرف يجب أن يكون بالإنجليزية (أحرف/أرقام/شرطات)"),
  name: z.string().min(1, "اسم الفرع مطلوب"),
});

type BranchFormData = z.infer<typeof branchFormSchema>;

export default function BranchesPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: BranchFormData) => {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create branch");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: "تم إضافة الفرع بنجاح" });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const form = useForm<BranchFormData>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      id: "",
      name: "",
    },
  });

  const getBranchStats = (branchId: string) => {
    const branchItems = inventoryItems.filter(item => item.branchId === branchId);
    const totalValue = branchItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
    return {
      itemCount: branchItems.length,
      totalValue,
    };
  };

  if (branchesLoading) {
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
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-branches-title">إدارة الفروع</h1>
            <p className="text-muted-foreground mt-1">إضافة ومتابعة فروع المخبز</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-branch">
                <Plus className="w-4 h-4" />
                <span>إضافة فرع جديد</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>إضافة فرع جديد</DialogTitle>
                <DialogDescription>أدخل بيانات الفرع الجديد</DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="id">معرف الفرع (بالإنجليزية) *</Label>
                  <Input
                    {...form.register("id")}
                    placeholder="مثال: jeddah"
                    data-testid="input-branch-id"
                  />
                  {form.formState.errors.id && (
                    <p className="text-sm text-destructive">{form.formState.errors.id.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">المعرف سيُستخدم في رموز الأصناف (مثال: j-1, j-2)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">اسم الفرع (بالعربية) *</Label>
                  <Input
                    {...form.register("name")}
                    placeholder="مثال: فرع جدة"
                    data-testid="input-branch-name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-branch">
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                    إضافة الفرع
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>قائمة الفروع</CardTitle>
            <CardDescription>عدد الفروع: {branches.length}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-[100px]">المعرف</TableHead>
                    <TableHead className="text-right">اسم الفرع</TableHead>
                    <TableHead className="text-right w-[120px]">عدد الأصناف</TableHead>
                    <TableHead className="text-right w-[150px]">إجمالي القيمة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        لا توجد فروع مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    branches.map((branch) => {
                      const stats = getBranchStats(branch.id);
                      return (
                        <TableRow key={branch.id} data-testid={`row-branch-${branch.id}`}>
                          <TableCell className="font-mono">{branch.id}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              {branch.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{stats.itemCount} صنف</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-green-600">
                            {stats.totalValue.toLocaleString('en-US')} ريال
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
