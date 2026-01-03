import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Target, TrendingUp, TrendingDown, Users, Trophy, ChevronLeft, Calendar, 
  Award, AlertTriangle, Bell, Clock, CheckCircle2, Plus, Settings, 
  Sun, Moon, DollarSign, Receipt, User, RefreshCw, BarChart3
} from "lucide-react";
import { Link } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";
import type { Branch, CashierShiftTarget, PerformanceAlert, ShiftPerformanceTracking } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const SHIFT_TYPES = [
  { value: "morning", label: "الشفت الصباحي", icon: Sun, color: "bg-amber-500" },
  { value: "evening", label: "الشفت المسائي", icon: Moon, color: "bg-indigo-500" },
];

const CASHIER_ROLES = [
  { value: "main", label: "كاشير رئيسي" },
  { value: "assistant", label: "كاشير مساعد" },
  { value: "trainee", label: "متدرب" },
];

const ALERT_COLORS = {
  critical: { bg: "bg-red-100", border: "border-red-500", text: "text-red-700", badge: "bg-red-500" },
  warning: { bg: "bg-amber-100", border: "border-amber-500", text: "text-amber-700", badge: "bg-amber-500" },
  on_track: { bg: "bg-blue-100", border: "border-blue-500", text: "text-blue-700", badge: "bg-blue-500" },
  exceeding: { bg: "bg-green-100", border: "border-green-500", text: "text-green-700", badge: "bg-green-500" },
};

interface CashierData {
  id: string;
  name: string;
  role: string;
  target: number;
  achieved: number;
  avgTicket: number;
  transactions: number;
}

export default function CashierShiftPerformance() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedShift, setSelectedShift] = useState<string>("all");
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [newTarget, setNewTarget] = useState({
    cashierId: "",
    branchId: "",
    shiftType: "morning",
    cashierRole: "main",
    targetAmount: 0,
    minTransactions: 0,
    avgTicketTarget: 0,
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: shiftTargets = [], isLoading: targetsLoading, refetch: refetchTargets } = useQuery<CashierShiftTarget[]>({
    queryKey: ["/api/cashier-shift-targets", selectedBranch, selectedDate, selectedShift],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      if (selectedShift !== "all") params.append("shiftType", selectedShift);
      const res = await fetch(`/api/cashier-shift-targets?${params}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: performanceAlerts = [], refetch: refetchAlerts } = useQuery<PerformanceAlert[]>({
    queryKey: ["/api/performance-alerts", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      const res = await fetch(`/api/performance-alerts?${params}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: shiftTracking = [], refetch: refetchTracking } = useQuery<ShiftPerformanceTracking[]>({
    queryKey: ["/api/shift-performance-tracking", selectedBranch, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranch !== "all") params.append("branchId", selectedBranch);
      if (selectedDate) params.append("date", selectedDate);
      const res = await fetch(`/api/shift-performance-tracking?${params}`);
      if (!res.ok) return [];
      return res.json();
    }
  });

  const createTargetMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/cashier-shift-targets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashier-shift-targets"] });
      setShowTargetDialog(false);
      resetNewTarget();
    }
  });

  const markAlertReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("PATCH", `/api/performance-alerts/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance-alerts"] });
    }
  });

  const resetNewTarget = () => {
    setNewTarget({
      cashierId: "",
      branchId: "",
      shiftType: "morning",
      cashierRole: "main",
      targetAmount: 0,
      minTransactions: 0,
      avgTicketTarget: 0,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-SA', { 
      style: 'currency', 
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const getPercentColor = (percent: number) => {
    if (percent >= 100) return "text-green-600";
    if (percent >= 80) return "text-amber-600";
    return "text-red-600";
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return "bg-green-500";
    if (percent >= 80) return "bg-amber-500";
    return "bg-red-500";
  };

  const getAlertLevel = (percent: number): keyof typeof ALERT_COLORS => {
    if (percent >= 100) return "exceeding";
    if (percent >= 80) return "on_track";
    if (percent >= 60) return "warning";
    return "critical";
  };

  const summaryStats = useMemo(() => {
    if (!shiftTargets.length) return { totalTarget: 0, totalAchieved: 0, avgPercent: 0, alertCount: 0 };
    
    const totalTarget = shiftTargets.reduce((sum, t) => sum + (Number(t.targetAmount) || 0), 0);
    const totalAchieved = shiftTracking.reduce((sum, t) => sum + (Number(t.currentSalesAmount) || 0), 0);
    const avgPercent = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
    const alertCount = performanceAlerts.filter(a => !a.isRead).length;
    
    return { totalTarget, totalAchieved, avgPercent, alertCount };
  }, [shiftTargets, performanceAlerts, shiftTracking]);

  const shiftChartData = useMemo(() => {
    const morningTargets = shiftTargets.filter(t => t.shiftType === 'morning');
    const eveningTargets = shiftTargets.filter(t => t.shiftType === 'evening');
    const morningTracking = shiftTracking.filter(t => t.shiftType === 'morning');
    const eveningTracking = shiftTracking.filter(t => t.shiftType === 'evening');
    
    return [
      {
        name: "الشفت الصباحي",
        target: morningTargets.reduce((sum, t) => sum + (Number(t.targetAmount) || 0), 0),
        achieved: morningTracking.reduce((sum, t) => sum + (Number(t.currentSalesAmount) || 0), 0),
      },
      {
        name: "الشفت المسائي",
        target: eveningTargets.reduce((sum, t) => sum + (Number(t.targetAmount) || 0), 0),
        achieved: eveningTracking.reduce((sum, t) => sum + (Number(t.currentSalesAmount) || 0), 0),
      }
    ];
  }, [shiftTargets, shiftTracking]);

  const handleRefresh = () => {
    refetchTargets();
    refetchAlerts();
    refetchTracking();
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/targets-dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[#8B4513]" data-testid="text-page-title">
                تتبع أداء الكاشير بالشفتات
              </h1>
              <p className="text-muted-foreground">مراقبة الأهداف والأداء لكل كاشير حسب الشفت</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
            <Dialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-target">
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة هدف جديد
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>إضافة هدف كاشير جديد</DialogTitle>
                  <DialogDescription>تحديد هدف المبيعات والمعاملات لكاشير معين</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>الفرع</Label>
                    <Select value={newTarget.branchId} onValueChange={(v) => setNewTarget({...newTarget, branchId: v})}>
                      <SelectTrigger data-testid="select-branch">
                        <SelectValue placeholder="اختر الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>نوع الشفت</Label>
                    <Select value={newTarget.shiftType} onValueChange={(v) => setNewTarget({...newTarget, shiftType: v})}>
                      <SelectTrigger data-testid="select-shift-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIFT_TYPES.map((shift) => (
                          <SelectItem key={shift.value} value={shift.value}>{shift.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>دور الكاشير</Label>
                    <Select value={newTarget.cashierRole} onValueChange={(v) => setNewTarget({...newTarget, cashierRole: v})}>
                      <SelectTrigger data-testid="select-cashier-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CASHIER_ROLES.map((role) => (
                          <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>هدف المبيعات (ريال)</Label>
                    <Input 
                      type="number" 
                      value={newTarget.targetAmount} 
                      onChange={(e) => setNewTarget({...newTarget, targetAmount: Number(e.target.value)})}
                      data-testid="input-target-amount"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>الحد الأدنى للمعاملات</Label>
                    <Input 
                      type="number" 
                      value={newTarget.minTransactions} 
                      onChange={(e) => setNewTarget({...newTarget, minTransactions: Number(e.target.value)})}
                      data-testid="input-min-transactions"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>هدف متوسط الفاتورة (ريال)</Label>
                    <Input 
                      type="number" 
                      value={newTarget.avgTicketTarget} 
                      onChange={(e) => setNewTarget({...newTarget, avgTicketTarget: Number(e.target.value)})}
                      data-testid="input-avg-ticket-target"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowTargetDialog(false)} data-testid="button-cancel">
                    إلغاء
                  </Button>
                  <Button onClick={() => createTargetMutation.mutate({
                    ...newTarget,
                    date: selectedDate,
                  })} data-testid="button-save-target">
                    حفظ الهدف
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Label>التاريخ:</Label>
            <Input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44"
              data-testid="input-date"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label>الفرع:</Label>
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-44" data-testid="select-filter-branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفروع</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label>الشفت:</Label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger className="w-44" data-testid="select-filter-shift">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الشفتات</SelectItem>
                {SHIFT_TYPES.map((shift) => (
                  <SelectItem key={shift.value} value={shift.value}>{shift.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-target">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الأهداف</p>
                  <p className="text-2xl font-bold">{formatCurrency(summaryStats.totalTarget)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-total-achieved">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-100">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المحقق</p>
                  <p className="text-2xl font-bold">{formatCurrency(summaryStats.totalAchieved)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-percent">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-amber-100">
                  <BarChart3 className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">نسبة الإنجاز</p>
                  <p className={`text-2xl font-bold ${getPercentColor(summaryStats.avgPercent)}`}>
                    {summaryStats.avgPercent.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-alerts">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${summaryStats.alertCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <Bell className={`h-6 w-6 ${summaryStats.alertCount > 0 ? 'text-red-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">تنبيهات نشطة</p>
                  <p className="text-2xl font-bold">{summaryStats.alertCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="targets" className="space-y-4">
          <TabsList data-testid="tabs-main">
            <TabsTrigger value="targets" data-testid="tab-targets">
              <Target className="h-4 w-4 ml-2" />
              الأهداف
            </TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">
              <BarChart3 className="h-4 w-4 ml-2" />
              الأداء
            </TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              <Bell className="h-4 w-4 ml-2" />
              التنبيهات
              {summaryStats.alertCount > 0 && (
                <Badge className="mr-2 bg-red-500 text-white">{summaryStats.alertCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="targets" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sun className="h-5 w-5 text-amber-500" />
                    الشفت الصباحي
                  </CardTitle>
                  <CardDescription>أهداف وأداء الكاشيرين في الفترة الصباحية</CardDescription>
                </CardHeader>
                <CardContent>
                  {shiftTargets.filter(t => t.shiftType === 'morning').length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد أهداف للشفت الصباحي
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {shiftTargets.filter(t => t.shiftType === 'morning').map((target) => {
                        const tracking = shiftTracking.find(t => t.shiftType === 'morning' && t.branchId === target.branchId);
                        const achieved = tracking ? Number(tracking.currentSalesAmount || 0) : 0;
                        const percent = target.targetAmount ? (achieved / Number(target.targetAmount)) * 100 : 0;
                        return (
                          <div key={target.id} className="border rounded-lg p-4" data-testid={`target-morning-${target.id}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span className="font-medium">{target.cashierId}</span>
                                <Badge variant="outline">{CASHIER_ROLES.find(r => r.value === target.cashierRole)?.label}</Badge>
                              </div>
                              <Badge className={ALERT_COLORS[getAlertLevel(percent)].badge}>
                                {percent.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <Progress value={Math.min(percent, 100)} className="h-2" />
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>الهدف: {formatCurrency(Number(target.targetAmount))}</span>
                                <span>المحقق: {formatCurrency(achieved)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Moon className="h-5 w-5 text-indigo-500" />
                    الشفت المسائي
                  </CardTitle>
                  <CardDescription>أهداف وأداء الكاشيرين في الفترة المسائية</CardDescription>
                </CardHeader>
                <CardContent>
                  {shiftTargets.filter(t => t.shiftType === 'evening').length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد أهداف للشفت المسائي
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {shiftTargets.filter(t => t.shiftType === 'evening').map((target) => {
                        const tracking = shiftTracking.find(t => t.shiftType === 'evening' && t.branchId === target.branchId);
                        const achieved = tracking ? Number(tracking.currentSalesAmount || 0) : 0;
                        const percent = target.targetAmount ? (achieved / Number(target.targetAmount)) * 100 : 0;
                        return (
                          <div key={target.id} className="border rounded-lg p-4" data-testid={`target-evening-${target.id}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span className="font-medium">{target.cashierId}</span>
                                <Badge variant="outline">{CASHIER_ROLES.find(r => r.value === target.cashierRole)?.label}</Badge>
                              </div>
                              <Badge className={ALERT_COLORS[getAlertLevel(percent)].badge}>
                                {percent.toFixed(0)}%
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <Progress value={Math.min(percent, 100)} className="h-2" />
                              <div className="flex justify-between text-sm text-muted-foreground">
                                <span>الهدف: {formatCurrency(Number(target.targetAmount))}</span>
                                <span>المحقق: {formatCurrency(achieved)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>مقارنة أداء الشفتات</CardTitle>
                  <CardDescription>الهدف مقابل المحقق لكل شفت</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shiftChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip 
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend />
                        <Bar dataKey="target" name="الهدف" fill="#3b82f6" />
                        <Bar dataKey="achieved" name="المحقق" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>تتبع الأداء اللحظي</CardTitle>
                  <CardDescription>حالة الشفتات النشطة</CardDescription>
                </CardHeader>
                <CardContent>
                  {shiftTracking.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      لا يوجد تتبع أداء نشط حالياً
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {shiftTracking.map((track) => {
                        const currentPercent = Number(track.achievementPercent || 0);
                        const isActive = !track.shiftEndTime;
                        return (
                          <div key={track.id} className="border rounded-lg p-4" data-testid={`tracking-${track.id}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {track.shiftType === 'morning' ? (
                                  <Sun className="h-5 w-5 text-amber-500" />
                                ) : (
                                  <Moon className="h-5 w-5 text-indigo-500" />
                                )}
                                <span className="font-medium">
                                  {SHIFT_TYPES.find(s => s.value === track.shiftType)?.label}
                                </span>
                                <Badge variant={isActive ? 'default' : 'secondary'}>
                                  {isActive ? 'نشط' : 'مكتمل'}
                                </Badge>
                              </div>
                              <span className={`text-lg font-bold ${getPercentColor(currentPercent)}`}>
                                {currentPercent.toFixed(1)}%
                              </span>
                            </div>
                            <Progress value={Math.min(currentPercent, 100)} className="h-3" />
                            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                              <div className="text-center">
                                <p className="text-muted-foreground">المعاملات</p>
                                <p className="font-semibold">{track.currentTransactions || 0}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">متوسط الفاتورة</p>
                                <p className="font-semibold">{formatCurrency(Number(track.currentAverageTicket || 0))}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-muted-foreground">آخر تحديث</p>
                                <p className="font-semibold text-xs">
                                  {track.lastUpdatedAt ? new Date(track.lastUpdatedAt).toLocaleTimeString('ar-SA') : '-'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  تنبيهات الأداء
                </CardTitle>
                <CardDescription>تنبيهات تلقائية عند انحراف الأداء عن الأهداف</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceAlerts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>لا توجد تنبيهات - الأداء ضمن المستهدف</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {performanceAlerts.map((alert) => {
                      const severityMap: Record<string, keyof typeof ALERT_COLORS> = {
                        'critical': 'critical',
                        'warning': 'warning',
                        'info': 'on_track',
                        'success': 'exceeding',
                      };
                      const colors = ALERT_COLORS[severityMap[alert.severity] || 'warning'];
                      return (
                        <div 
                          key={alert.id} 
                          className={`border-r-4 rounded-lg p-4 ${colors.bg} ${colors.border}`}
                          data-testid={`alert-${alert.id}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className={`h-5 w-5 mt-0.5 ${colors.text}`} />
                              <div>
                                <p className={`font-medium ${colors.text}`}>{alert.message}</p>
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  <span>{alert.branchId}</span>
                                  <span>•</span>
                                  <span>{alert.shiftType === 'morning' ? 'صباحي' : 'مسائي'}</span>
                                  <span>•</span>
                                  <span>{new Date(alert.createdAt!).toLocaleTimeString('ar-SA')}</span>
                                </div>
                              </div>
                            </div>
                            {!alert.isRead && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => markAlertReadMutation.mutate(alert.id)}
                                data-testid={`button-mark-read-${alert.id}`}
                              >
                                تم القراءة
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
