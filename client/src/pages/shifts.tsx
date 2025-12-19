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
import { Plus, Search, Edit, Trash2, Clock, Users, Calendar, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Shift, Branch } from "@shared/schema";

const SHIFT_STATUS = {
  scheduled: { label: "مجدولة", color: "bg-blue-100 text-blue-800" },
  active: { label: "نشطة", color: "bg-green-100 text-green-800" },
  completed: { label: "مكتملة", color: "bg-gray-100 text-gray-800" },
  cancelled: { label: "ملغاة", color: "bg-red-100 text-red-800" },
};

export default function ShiftsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    branchId: "",
    name: "",
    date: new Date().toISOString().split('T')[0],
    startTime: "06:00",
    endTime: "14:00",
    supervisorName: "",
    employeeCount: "0",
    notes: "",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shifts, isLoading } = useQuery<Shift[]>({
    queryKey: ["/api/shifts"],
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("/api/shifts", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "تم إنشاء الوردية بنجاح" });
      resetForm();
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في إنشاء الوردية", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest(`/api/shifts/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "تم تحديث الوردية بنجاح" });
      resetForm();
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في تحديث الوردية", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/shifts/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "تم حذف الوردية بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل في حذف الوردية", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      branchId: "",
      name: "",
      date: new Date().toISOString().split('T')[0],
      startTime: "06:00",
      endTime: "14:00",
      supervisorName: "",
      employeeCount: "0",
      notes: "",
    });
    setEditingShift(null);
    setIsDialogOpen(false);
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      employeeCount: parseInt(formData.employeeCount) || 0,
    };

    if (editingShift) {
      updateMutation.mutate({ id: editingShift.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      branchId: shift.branchId,
      name: shift.name,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      supervisorName: shift.supervisorName || "",
      employeeCount: shift.employeeCount?.toString() || "0",
      notes: shift.notes || "",
    });
    setIsDialogOpen(true);
  };

  const getBranchName = (branchId: string) => branches?.find(b => b.id === branchId)?.name || branchId;

  const filteredShifts = shifts?.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getBranchName(s.branchId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">إدارة الورديات</h1>
            <p className="text-muted-foreground">جدولة وإدارة ورديات العمل</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-shift">
                <Plus className="w-4 h-4 ml-2" />
                إنشاء وردية
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingShift ? "تعديل الوردية" : "إنشاء وردية جديدة"}</DialogTitle>
                <DialogDescription>أدخل بيانات الوردية</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>الفرع *</Label>
                  <Select value={formData.branchId} onValueChange={v => setFormData({ ...formData, branchId: v })}>
                    <SelectTrigger data-testid="select-branch">
                      <SelectValue placeholder="اختر الفرع" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches?.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>اسم الوردية *</Label>
                  <Input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: الوردية الصباحية"
                    data-testid="input-shift-name"
                  />
                </div>
                <div>
                  <Label>التاريخ *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    data-testid="input-date"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>وقت البدء *</Label>
                    <Input
                      type="time"
                      value={formData.startTime}
                      onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>وقت الانتهاء *</Label>
                    <Input
                      type="time"
                      value={formData.endTime}
                      onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>المشرف</Label>
                  <Input
                    value={formData.supervisorName}
                    onChange={e => setFormData({ ...formData, supervisorName: e.target.value })}
                    placeholder="اسم المشرف"
                  />
                </div>
                <div>
                  <Label>عدد الموظفين</Label>
                  <Input
                    type="number"
                    value={formData.employeeCount}
                    onChange={e => setFormData({ ...formData, employeeCount: e.target.value })}
                  />
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
                <Button 
                  onClick={handleSubmit} 
                  disabled={!formData.branchId || !formData.name || !formData.date}
                  data-testid="button-save-shift"
                >
                  {editingShift ? "تحديث" : "إنشاء"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن وردية..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pr-10"
              data-testid="input-search"
            />
          </div>
          <Badge variant="secondary">{shifts?.length || 0} وردية</Badge>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : filteredShifts?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">لا توجد ورديات</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                إنشاء أول وردية
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShifts?.map(shift => (
              <Card key={shift.id} data-testid={`shift-card-${shift.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{shift.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {getBranchName(shift.branchId)}
                      </CardDescription>
                    </div>
                    <Badge className={SHIFT_STATUS[shift.status as keyof typeof SHIFT_STATUS]?.color || "bg-gray-100"}>
                      {SHIFT_STATUS[shift.status as keyof typeof SHIFT_STATUS]?.label || shift.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{shift.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{shift.startTime} - {shift.endTime}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {shift.supervisorName && (
                      <span className="text-muted-foreground">المشرف: {shift.supervisorName}</span>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{shift.employeeCount || 0} موظف</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(shift)} data-testid={`edit-shift-${shift.id}`}>
                      <Edit className="w-3 h-3 ml-1" />
                      تعديل
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(shift.id)} data-testid={`delete-shift-${shift.id}`}>
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
