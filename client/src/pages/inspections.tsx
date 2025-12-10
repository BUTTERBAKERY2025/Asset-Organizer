import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, AlertTriangle, CheckCircle2, Clock, Loader2, Bell, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Branch, InventoryItem } from "@shared/schema";

export default function InspectionsPage() {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [intervalDays, setIntervalDays] = useState("30");
  const [filterBranch, setFilterBranch] = useState("all");
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

  const branchMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(b => { map[b.id] = b.name; });
    return map;
  }, [branches]);

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InventoryItem> }) => {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({ title: "تم تحديث جدولة الفحص بنجاح" });
      setScheduleDialogOpen(false);
      setSelectedItem(null);
    },
    onError: () => {
      toast({ title: "حدث خطأ أثناء التحديث", variant: "destructive" });
    },
  });

  const itemsNeedingInspection = useMemo(() => {
    const now = new Date();
    return inventoryItems
      .filter(item => {
        if (filterBranch !== "all" && item.branchId !== filterBranch) return false;
        if (!item.nextInspectionDate) return false;
        return new Date(item.nextInspectionDate) <= now;
      })
      .sort((a, b) => {
        const dateA = new Date(a.nextInspectionDate!);
        const dateB = new Date(b.nextInspectionDate!);
        return dateA.getTime() - dateB.getTime();
      });
  }, [inventoryItems, filterBranch]);

  const scheduledItems = useMemo(() => {
    const now = new Date();
    return inventoryItems
      .filter(item => {
        if (filterBranch !== "all" && item.branchId !== filterBranch) return false;
        if (!item.nextInspectionDate) return false;
        return new Date(item.nextInspectionDate) > now;
      })
      .sort((a, b) => {
        const dateA = new Date(a.nextInspectionDate!);
        const dateB = new Date(b.nextInspectionDate!);
        return dateA.getTime() - dateB.getTime();
      });
  }, [inventoryItems, filterBranch]);

  const unscheduledItems = useMemo(() => {
    return inventoryItems
      .filter(item => {
        if (filterBranch !== "all" && item.branchId !== filterBranch) return false;
        return !item.nextInspectionDate;
      });
  }, [inventoryItems, filterBranch]);

  const handleScheduleInspection = () => {
    if (!selectedItem) return;
    
    const days = parseInt(intervalDays);
    if (isNaN(days) || days <= 0) {
      toast({ title: "يرجى إدخال عدد أيام صحيح", variant: "destructive" });
      return;
    }

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);

    updateItemMutation.mutate({
      id: selectedItem.id,
      data: {
        nextInspectionDate: nextDate,
        inspectionIntervalDays: days,
      },
    });
  };

  const handleMarkInspected = (item: InventoryItem) => {
    const days = item.inspectionIntervalDays || 30;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + days);

    updateItemMutation.mutate({
      id: item.id,
      data: {
        lastCheck: new Date().toISOString().split('T')[0],
        nextInspectionDate: nextDate,
      },
    });
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

  return (
    <Layout>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-page-title">
              جدولة الفحص الدوري
            </h1>
            <p className="text-muted-foreground mt-1">إدارة مواعيد فحص الأصول وتتبع التنبيهات</p>
          </div>
          <Select value={filterBranch} onValueChange={setFilterBranch}>
            <SelectTrigger className="w-[200px]" data-testid="select-filter-branch">
              <SelectValue placeholder="اختر الفرع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفروع</SelectItem>
              {branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-red-50/50 border-red-200">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                تحتاج فحص فوري
              </CardDescription>
              <CardTitle className="text-3xl text-red-600 font-mono" data-testid="text-overdue-count">
                {itemsNeedingInspection.length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-yellow-50/50 border-yellow-200">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                مجدولة للفحص
              </CardDescription>
              <CardTitle className="text-3xl text-yellow-600 font-mono" data-testid="text-scheduled-count">
                {scheduledItems.length}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-gray-50/50 border-gray-200">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-gray-500" />
                بدون جدولة
              </CardDescription>
              <CardTitle className="text-3xl text-gray-600 font-mono" data-testid="text-unscheduled-count">
                {unscheduledItems.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {itemsNeedingInspection.length > 0 && (
          <Card className="border-red-200">
            <CardHeader className="bg-red-50/50">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <Bell className="w-5 h-5" />
                تنبيهات - أصول تحتاج فحص فوري
              </CardTitle>
              <CardDescription>هذه الأصول تجاوزت موعد الفحص المحدد</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الأصل</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">تاريخ الفحص المستحق</TableHead>
                    <TableHead className="text-right">التأخير</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsNeedingInspection.map(item => {
                    const dueDate = new Date(item.nextInspectionDate!);
                    const now = new Date();
                    const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <TableRow key={item.id} className="bg-red-50/30" data-testid={`row-overdue-${item.id}`}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{branchMap[item.branchId]}</TableCell>
                        <TableCell>{dueDate.toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{diffDays} يوم</Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            onClick={() => handleMarkInspected(item)}
                            disabled={updateItemMutation.isPending}
                            data-testid={`button-mark-inspected-${item.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 ml-1" />
                            تم الفحص
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              الأصول المجدولة للفحص
            </CardTitle>
            <CardDescription>أصول لها مواعيد فحص قادمة</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {scheduledItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد أصول مجدولة للفحص
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الأصل</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">موعد الفحص القادم</TableHead>
                    <TableHead className="text-right">الفترة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledItems.slice(0, 20).map(item => {
                    const nextDate = new Date(item.nextInspectionDate!);
                    
                    return (
                      <TableRow key={item.id} data-testid={`row-scheduled-${item.id}`}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{branchMap[item.branchId]}</TableCell>
                        <TableCell>{nextDate.toLocaleDateString('en-GB')}</TableCell>
                        <TableCell>
                          <Badge variant="outline">كل {item.inspectionIntervalDays || 30} يوم</Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedItem(item);
                              setIntervalDays(String(item.inspectionIntervalDays || 30));
                              setScheduleDialogOpen(true);
                            }}
                            data-testid={`button-edit-schedule-${item.id}`}
                          >
                            تعديل الجدولة
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-gray-500" />
              أصول بدون جدولة فحص
            </CardTitle>
            <CardDescription>يمكنك إضافة جدولة فحص دوري لهذه الأصول</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {unscheduledItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                جميع الأصول لها جدولة فحص
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الأصل</TableHead>
                    <TableHead className="text-right">الفرع</TableHead>
                    <TableHead className="text-right">الفئة</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unscheduledItems.slice(0, 20).map(item => (
                    <TableRow key={item.id} data-testid={`row-unscheduled-${item.id}`}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{branchMap[item.branchId]}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>
                        <Button 
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setIntervalDays("30");
                            setScheduleDialogOpen(true);
                          }}
                          data-testid={`button-add-schedule-${item.id}`}
                        >
                          <Calendar className="w-4 h-4 ml-1" />
                          جدولة فحص
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>جدولة فحص دوري</DialogTitle>
            <DialogDescription>
              تحديد فترة الفحص الدوري للأصل: {selectedItem?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>فترة الفحص (بالأيام)</Label>
              <Input
                type="number"
                value={intervalDays}
                onChange={(e) => setIntervalDays(e.target.value)}
                placeholder="30"
                data-testid="input-interval-days"
              />
              <p className="text-sm text-muted-foreground">
                سيتم تذكيرك بفحص هذا الأصل كل {intervalDays} يوم
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={handleScheduleInspection}
              disabled={updateItemMutation.isPending}
              data-testid="button-confirm-schedule"
            >
              حفظ الجدولة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
