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
import { useAuth } from "@/hooks/useAuth";
import { Plus, Loader2, Building2, ArrowRight, MapPin, Settings } from "lucide-react";
import { Link } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import type { Branch, InventoryItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const branchFormSchema = z.object({
  id: z.string().min(1, "معرف الفرع مطلوب").regex(/^[a-zA-Z0-9_-]+$/, "المعرف يجب أن يكون بالإنجليزية (أحرف/أرقام/شرطات)"),
  name: z.string().min(1, "اسم الفرع مطلوب"),
});

type BranchFormData = z.infer<typeof branchFormSchema>;

export default function BranchesPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [locationData, setLocationData] = useState({
    latitude: "",
    longitude: "",
    locationRadius: "200",
    address: "",
  });
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // فقط المدير (admin) يمكنه إدارة الفروع
  const isAdmin = user?.role === "admin";

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

  const updateLocationMutation = useMutation({
    mutationFn: async ({ branchId, data }: { branchId: string; data: typeof locationData }) => {
      const res = await apiRequest("PATCH", `/api/branches/${branchId}/location`, {
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
        locationRadius: parseInt(data.locationRadius) || 200,
        address: data.address || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: "تم حفظ موقع الفرع بنجاح" });
      setIsLocationDialogOpen(false);
      setSelectedBranch(null);
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "خطأ", description: "المتصفح لا يدعم تحديد الموقع", variant: "destructive" });
      return;
    }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setIsGettingLocation(false);
        toast({ title: "تم تحديد الموقع الحالي" });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({ title: "خطأ", description: "فشل في تحديد الموقع", variant: "destructive" });
      },
      { enableHighAccuracy: true }
    );
  };

  const openLocationDialog = (branch: Branch) => {
    setSelectedBranch(branch);
    setLocationData({
      latitude: branch.latitude?.toString() || "",
      longitude: branch.longitude?.toString() || "",
      locationRadius: (branch.locationRadius || 200).toString(),
      address: branch.address || "",
    });
    setIsLocationDialogOpen(true);
  };

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
      <div className="page-container space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="gap-2 h-11 sm:h-9" data-testid="button-back">
                <ArrowRight className="h-4 w-4" />
                لوحة الأصول
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground" data-testid="text-branches-title">إدارة الفروع</h1>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">إضافة ومتابعة فروع المخبز</p>
            </div>
          </div>
          {isAdmin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 h-11 sm:h-9" data-testid="button-add-branch">
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
                    className="h-11 sm:h-10"
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
                    className="h-11 sm:h-10"
                    data-testid="input-branch-name"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} className="h-11 sm:h-9" data-testid="button-submit-branch">
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                    إضافة الفرع
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>

        <Card>
          <CardHeader className="p-3 sm:p-4 md:p-6">
            <CardTitle className="text-lg sm:text-xl md:text-2xl">قائمة الفروع</CardTitle>
            <CardDescription className="text-xs sm:text-sm">عدد الفروع: {branches.length}</CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-[100px] hidden sm:table-cell">المعرف</TableHead>
                    <TableHead className="text-right">اسم الفرع</TableHead>
                    <TableHead className="text-right w-[120px]">الموقع</TableHead>
                    <TableHead className="text-right w-[120px]">عدد الأصناف</TableHead>
                    <TableHead className="text-right w-[150px]">إجمالي القيمة</TableHead>
                    {isAdmin && <TableHead className="text-right w-[80px]">إعدادات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        لا توجد فروع مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    branches.map((branch) => {
                      const stats = getBranchStats(branch.id);
                      const hasLocation = branch.latitude && branch.longitude;
                      return (
                        <TableRow key={branch.id} data-testid={`row-branch-${branch.id}`}>
                          <TableCell className="font-mono text-xs sm:text-sm hidden sm:table-cell">{branch.id}</TableCell>
                          <TableCell className="font-medium text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                              {branch.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            {hasLocation ? (
                              <Badge variant="default" className="text-[10px] sm:text-xs bg-green-100 text-green-700 hover:bg-green-100">
                                <MapPin className="w-3 h-3 ml-1" />
                                {branch.locationRadius || 200}م
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] sm:text-xs text-orange-600 border-orange-300">
                                غير محدد
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] sm:text-xs">{stats.itemCount} صنف</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-green-600 text-xs sm:text-sm">
                            {stats.totalValue.toLocaleString('en-US')} ريال
                          </TableCell>
                          {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openLocationDialog(branch)}
                              className="h-8 w-8 p-0"
                              data-testid={`btn-location-${branch.id}`}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Location Settings Dialog */}
        <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                إعدادات موقع الفرع
              </DialogTitle>
              <DialogDescription>
                {selectedBranch?.name} - تحديد الموقع الجغرافي للتحقق من حضور الموظفين
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation}
                  className="flex-1 h-11"
                >
                  {isGettingLocation ? (
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  ) : (
                    <MapPin className="w-4 h-4 ml-2" />
                  )}
                  تحديد الموقع الحالي
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>خط العرض (Latitude)</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="مثال: 21.485811"
                    value={locationData.latitude}
                    onChange={(e) => setLocationData(prev => ({ ...prev, latitude: e.target.value }))}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label>خط الطول (Longitude)</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="مثال: 39.192505"
                    value={locationData.longitude}
                    onChange={(e) => setLocationData(prev => ({ ...prev, longitude: e.target.value }))}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>نطاق السماح (بالمتر)</Label>
                <Input
                  type="number"
                  placeholder="200"
                  value={locationData.locationRadius}
                  onChange={(e) => setLocationData(prev => ({ ...prev, locationRadius: e.target.value }))}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  المسافة المسموحة للموظف من موقع الفرع لتسجيل الحضور
                </p>
              </div>

              <div className="space-y-2">
                <Label>العنوان (اختياري)</Label>
                <Textarea
                  placeholder="مثال: شارع الملك فهد، حي الروضة، جدة"
                  value={locationData.address}
                  onChange={(e) => setLocationData(prev => ({ ...prev, address: e.target.value }))}
                  rows={2}
                />
              </div>

              {locationData.latitude && locationData.longitude && (
                <div className="p-3 bg-muted rounded-lg">
                  <a
                    href={`https://www.google.com/maps?q=${locationData.latitude},${locationData.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" />
                    عرض على خرائط جوجل
                  </a>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsLocationDialogOpen(false)}
                className="h-11"
              >
                إلغاء
              </Button>
              <Button
                onClick={() => {
                  if (selectedBranch) {
                    updateLocationMutation.mutate({ branchId: selectedBranch.id, data: locationData });
                  }
                }}
                disabled={updateLocationMutation.isPending}
                className="h-11"
              >
                {updateLocationMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                حفظ الموقع
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
