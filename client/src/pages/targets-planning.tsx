import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Target, Plus, Calendar, TrendingUp, Building2, Settings, Play, Edit, Trash2, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import type { Branch, BranchMonthlyTarget, TargetWeightProfile, TargetDailyAllocation } from "@shared/schema";

const TARGET_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  active: "نشط",
  locked: "مُقفل",
  archived: "مؤرشف",
};

const TARGET_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500",
  active: "bg-green-500",
  locked: "bg-blue-500",
  archived: "bg-gray-400",
};

export default function TargetsPlanning() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showNewTargetDialog, setShowNewTargetDialog] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [newTarget, setNewTarget] = useState({
    branchId: "",
    yearMonth: selectedMonth,
    targetAmount: "",
    profileId: null as number | null,
    notes: ""
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: targets = [], isLoading: targetsLoading } = useQuery<BranchMonthlyTarget[]>({
    queryKey: ["/api/targets/monthly", { yearMonth: selectedMonth }],
    queryFn: async () => {
      const res = await fetch(`/api/targets/monthly?yearMonth=${selectedMonth}`);
      if (!res.ok) throw new Error("Failed to fetch targets");
      return res.json();
    }
  });

  const { data: profiles = [] } = useQuery<TargetWeightProfile[]>({
    queryKey: ["/api/targets/profiles"],
  });

  const { data: allocations = [] } = useQuery<TargetDailyAllocation[]>({
    queryKey: ["/api/targets/monthly", selectedTargetId, "allocations"],
    queryFn: async () => {
      if (!selectedTargetId) return [];
      const res = await fetch(`/api/targets/monthly/${selectedTargetId}/allocations`);
      if (!res.ok) throw new Error("Failed to fetch allocations");
      return res.json();
    },
    enabled: !!selectedTargetId
  });

  const createTargetMutation = useMutation({
    mutationFn: async (data: typeof newTarget) => {
      const res = await fetch("/api/targets/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          targetAmount: parseFloat(data.targetAmount),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create target");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets/monthly"] });
      setShowNewTargetDialog(false);
      setNewTarget({ branchId: "", yearMonth: selectedMonth, targetAmount: "", profileId: null, notes: "" });
      toast({ title: "تم إنشاء الهدف بنجاح" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    }
  });

  const generateAllocationsMutation = useMutation({
    mutationFn: async (targetId: number) => {
      const res = await fetch(`/api/targets/monthly/${targetId}/generate-allocations`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to generate allocations");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets/monthly"] });
      toast({ title: "تم توزيع الهدف على أيام الشهر بنجاح" });
    },
    onError: () => {
      toast({ title: "خطأ في توزيع الهدف", variant: "destructive" });
    }
  });

  const deleteTargetMutation = useMutation({
    mutationFn: async (targetId: number) => {
      const res = await fetch(`/api/targets/monthly/${targetId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete target");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/targets/monthly"] });
      toast({ title: "تم حذف الهدف بنجاح" });
    }
  });

  const getBranchName = (branchId: string) => {
    return branches.find(b => b.id === branchId)?.name || branchId;
  };

  const getProfileName = (profileId: number | null) => {
    if (!profileId) return "الافتراضي";
    return profiles.find(p => p.id === profileId)?.name || "غير محدد";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SA', { 
      style: 'currency', 
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return days[date.getDay()];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/operations-reports">
              <Button variant="ghost" size="icon">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-amber-900 flex items-center gap-3">
                <Target className="h-8 w-8" />
                تخطيط الأهداف الشهرية
              </h1>
              <p className="text-amber-700 mt-1">تحديد وتوزيع الأهداف على الفروع والأيام</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>الشهر:</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-40"
                data-testid="input-month-selector"
              />
            </div>
            
            <Dialog open={showNewTargetDialog} onOpenChange={setShowNewTargetDialog}>
              <DialogTrigger asChild>
                <Button className="bg-amber-600 hover:bg-amber-700" data-testid="button-add-target">
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة هدف جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إضافة هدف شهري جديد</DialogTitle>
                  <DialogDescription>حدد الفرع والهدف المالي للشهر</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label>الفرع</Label>
                    <Select
                      value={newTarget.branchId}
                      onValueChange={(v) => setNewTarget({ ...newTarget, branchId: v })}
                    >
                      <SelectTrigger data-testid="select-branch">
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>الشهر</Label>
                    <Input
                      type="month"
                      value={newTarget.yearMonth}
                      onChange={(e) => setNewTarget({ ...newTarget, yearMonth: e.target.value })}
                      data-testid="input-target-month"
                    />
                  </div>
                  
                  <div>
                    <Label>الهدف الشهري (ريال)</Label>
                    <Input
                      type="number"
                      value={newTarget.targetAmount}
                      onChange={(e) => setNewTarget({ ...newTarget, targetAmount: e.target.value })}
                      placeholder="مثال: 500000"
                      data-testid="input-target-amount"
                    />
                  </div>
                  
                  <div>
                    <Label>ملف توزيع الأوزان</Label>
                    <Select
                      value={newTarget.profileId?.toString() || "default"}
                      onValueChange={(v) => setNewTarget({ ...newTarget, profileId: v === "default" ? null : parseInt(v) })}
                    >
                      <SelectTrigger data-testid="select-profile">
                        <SelectValue placeholder="اختر ملف التوزيع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">الملف الافتراضي</SelectItem>
                        {profiles.map(p => (
                          <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewTargetDialog(false)}>إلغاء</Button>
                  <Button 
                    onClick={() => createTargetMutation.mutate(newTarget)}
                    disabled={!newTarget.branchId || !newTarget.targetAmount || createTargetMutation.isPending}
                    data-testid="button-save-target"
                  >
                    {createTargetMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="targets" className="space-y-4">
          <TabsList>
            <TabsTrigger value="targets" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              الأهداف الشهرية
            </TabsTrigger>
            <TabsTrigger value="allocations" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              التوزيع اليومي
            </TabsTrigger>
            <TabsTrigger value="profiles" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              ملفات الأوزان
            </TabsTrigger>
          </TabsList>

          <TabsContent value="targets">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-amber-600" />
                  أهداف الفروع لشهر {selectedMonth}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {targetsLoading ? (
                  <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                ) : targets.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    لا توجد أهداف مسجلة لهذا الشهر
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الفرع</TableHead>
                        <TableHead>الهدف الشهري</TableHead>
                        <TableHead>ملف التوزيع</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {targets.map((target) => (
                        <TableRow key={target.id} data-testid={`row-target-${target.id}`}>
                          <TableCell className="font-medium">{getBranchName(target.branchId)}</TableCell>
                          <TableCell className="font-mono">{formatCurrency(target.targetAmount)}</TableCell>
                          <TableCell>{getProfileName(target.profileId)}</TableCell>
                          <TableCell>
                            <Badge className={TARGET_STATUS_COLORS[target.status]}>
                              {TARGET_STATUS_LABELS[target.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {target.status === 'draft' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generateAllocationsMutation.mutate(target.id)}
                                  disabled={generateAllocationsMutation.isPending}
                                  data-testid={`button-generate-${target.id}`}
                                >
                                  <Play className="h-4 w-4 ml-1" />
                                  توزيع
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedTargetId(target.id)}
                                data-testid={`button-view-${target.id}`}
                              >
                                <Calendar className="h-4 w-4" />
                              </Button>
                              {target.status === 'draft' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600"
                                  onClick={() => deleteTargetMutation.mutate(target.id)}
                                  data-testid={`button-delete-${target.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allocations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-600" />
                  التوزيع اليومي للهدف
                </CardTitle>
                <CardDescription>
                  {selectedTargetId ? (
                    <>عرض توزيع الهدف على أيام الشهر</>
                  ) : (
                    <>اختر هدفًا من القائمة لعرض التوزيع اليومي</>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedTargetId ? (
                  <div className="text-center py-8 text-gray-500">
                    اختر هدفًا من قائمة الأهداف الشهرية لعرض التوزيع اليومي
                  </div>
                ) : allocations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    لم يتم توزيع الهدف بعد. اضغط على زر "توزيع" في قائمة الأهداف.
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-2">
                    {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
                      <div key={day} className="text-center font-bold text-gray-600 p-2">{day}</div>
                    ))}
                    
                    {allocations.map((alloc) => {
                      const date = new Date(alloc.targetDate);
                      const dayOfMonth = date.getDate();
                      const isWeekend = date.getDay() === 4 || date.getDay() === 5;
                      
                      return (
                        <div
                          key={alloc.id}
                          className={`p-3 rounded-lg border ${
                            alloc.isHoliday ? 'bg-red-50 border-red-200' :
                            alloc.isManualOverride ? 'bg-blue-50 border-blue-200' :
                            isWeekend ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'
                          }`}
                          data-testid={`allocation-${alloc.id}`}
                        >
                          <div className="text-sm font-bold text-gray-800">{dayOfMonth}</div>
                          <div className="text-xs text-gray-500">{getDayName(alloc.targetDate)}</div>
                          <div className="text-sm font-mono mt-1 text-amber-700">
                            {formatCurrency(alloc.dailyTarget)}
                          </div>
                          <div className="text-xs text-gray-400">
                            {alloc.weightPercent.toFixed(1)}%
                          </div>
                          {alloc.isManualOverride && (
                            <Badge variant="outline" className="text-xs mt-1">معدل</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profiles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-amber-600" />
                  ملفات توزيع الأوزان
                </CardTitle>
                <CardDescription>
                  تحديد أوزان الأيام والمواسم لتوزيع الأهداف بشكل ذكي
                </CardDescription>
              </CardHeader>
              <CardContent>
                {profiles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">لا توجد ملفات أوزان</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>اسم الملف</TableHead>
                        <TableHead>أحد</TableHead>
                        <TableHead>اثنين</TableHead>
                        <TableHead>ثلاثاء</TableHead>
                        <TableHead>أربعاء</TableHead>
                        <TableHead>خميس</TableHead>
                        <TableHead>جمعة</TableHead>
                        <TableHead>سبت</TableHead>
                        <TableHead>الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((profile) => (
                        <TableRow key={profile.id} data-testid={`row-profile-${profile.id}`}>
                          <TableCell className="font-medium">
                            {profile.name}
                            {profile.isDefault && <Badge className="mr-2 bg-amber-500">افتراضي</Badge>}
                          </TableCell>
                          <TableCell>{profile.sundayWeight}%</TableCell>
                          <TableCell>{profile.mondayWeight}%</TableCell>
                          <TableCell>{profile.tuesdayWeight}%</TableCell>
                          <TableCell>{profile.wednesdayWeight}%</TableCell>
                          <TableCell className="font-bold text-amber-600">{profile.thursdayWeight}%</TableCell>
                          <TableCell className="font-bold text-amber-600">{profile.fridayWeight}%</TableCell>
                          <TableCell>{profile.saturdayWeight}%</TableCell>
                          <TableCell>
                            <Badge variant={profile.isActive ? "default" : "secondary"}>
                              {profile.isActive ? "نشط" : "غير نشط"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
