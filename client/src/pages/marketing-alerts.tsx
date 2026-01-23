import { useState } from "react";
import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowRight, Plus, Bell, AlertTriangle, Info, CheckCircle, 
  Clock, Eye, Check, Filter, BellRing, BellOff, Calendar,
  Megaphone, Target, ListTodo, TrendingUp
} from "lucide-react";
import { Link } from "wouter";

interface MarketingAlert {
  id: number;
  alertType: string;
  priority: string;
  title: string;
  message: string;
  campaignId: number | null;
  targetUserId: number | null;
  isRead: boolean;
  isAcknowledged: boolean;
  acknowledgedBy: number | null;
  acknowledgedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const ALERT_TYPES = [
  { value: "budget_warning", label: "تحذير الميزانية", icon: AlertTriangle, color: "text-amber-500" },
  { value: "deadline_reminder", label: "تذكير بالموعد النهائي", icon: Clock, color: "text-blue-500" },
  { value: "campaign_started", label: "بدء الحملة", icon: Megaphone, color: "text-green-500" },
  { value: "campaign_ended", label: "انتهاء الحملة", icon: Megaphone, color: "text-gray-500" },
  { value: "performance_alert", label: "تنبيه الأداء", icon: TrendingUp, color: "text-purple-500" },
  { value: "task_overdue", label: "مهمة متأخرة", icon: ListTodo, color: "text-red-500" },
  { value: "goal_achieved", label: "تم تحقيق الهدف", icon: Target, color: "text-green-600" },
  { value: "general", label: "عام", icon: Bell, color: "text-gray-500" },
];

const PRIORITIES = [
  { value: "low", label: "منخفض", color: "bg-gray-100 text-gray-700", iconColor: "text-gray-500" },
  { value: "medium", label: "متوسط", color: "bg-blue-100 text-blue-700", iconColor: "text-blue-500" },
  { value: "high", label: "عالي", color: "bg-orange-100 text-orange-700", iconColor: "text-orange-500" },
  { value: "urgent", label: "عاجل", color: "bg-red-100 text-red-700", iconColor: "text-red-500" },
];

export default function MarketingAlertsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [formData, setFormData] = useState({
    alertType: "general",
    priority: "medium",
    title: "",
    message: "",
    campaignId: null as number | null,
    expiresAt: "",
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery<MarketingAlert[]>({
    queryKey: ["/api/marketing/alerts"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/alerts");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createAlertMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/marketing/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في إنشاء التنبيه");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/alerts"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({ title: "تم إنشاء التنبيه بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنشاء التنبيه", variant: "destructive" });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/marketing/alerts/${id}/read`, { method: "PATCH" });
      if (!res.ok) throw new Error("فشل في تحديث التنبيه");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/alerts"] });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/marketing/alerts/${id}/acknowledge`, { method: "PATCH" });
      if (!res.ok) throw new Error("فشل في تأكيد التنبيه");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/alerts"] });
      toast({ title: "تم تأكيد التنبيه" });
    },
    onError: () => {
      toast({ title: "فشل في تأكيد التنبيه", variant: "destructive" });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unreadAlerts = alerts.filter(a => !a.isRead);
      await Promise.all(
        unreadAlerts.map(alert => 
          fetch(`/api/marketing/alerts/${alert.id}/read`, { method: "PATCH" })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketing/alerts"] });
      toast({ title: "تم تحديد الكل كمقروء" });
    },
  });

  const resetForm = () => {
    setFormData({
      alertType: "general",
      priority: "medium",
      title: "",
      message: "",
      campaignId: null,
      expiresAt: "",
    });
  };

  const getAlertTypeInfo = (type: string) => {
    return ALERT_TYPES.find(t => t.value === type) || ALERT_TYPES[ALERT_TYPES.length - 1];
  };

  const getPriorityInfo = (priority: string) => {
    return PRIORITIES.find(p => p.value === priority) || PRIORITIES[0];
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesPriority = filterPriority === "all" || alert.priority === filterPriority;
    const matchesType = filterType === "all" || alert.alertType === filterType;
    const matchesRead = !showUnreadOnly || !alert.isRead;
    return matchesPriority && matchesType && matchesRead;
  });

  const alertStats = {
    total: alerts.length,
    unread: alerts.filter(a => !a.isRead).length,
    urgent: alerts.filter(a => a.priority === "urgent" && !a.isAcknowledged).length,
    pending: alerts.filter(a => !a.isAcknowledged).length,
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-4" dir="rtl">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-4" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/marketing">
              <Button variant="outline" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" data-testid="button-back">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold" data-testid="page-title">التنبيهات</h1>
                {alertStats.unread > 0 && (
                  <Badge variant="destructive" className="rounded-full">
                    {alertStats.unread}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">إدارة تنبيهات وإشعارات التسويق</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {alertStats.unread > 0 && (
              <Button 
                variant="outline" 
                className="h-11 sm:h-9"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 ml-2" />
                تحديد الكل كمقروء
              </Button>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 sm:h-9" data-testid="button-add-alert">
                  <Plus className="w-4 h-4 ml-2" />
                  إنشاء تنبيه
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md" dir="rtl">
                <DialogHeader>
                  <DialogTitle>إنشاء تنبيه جديد</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>العنوان *</Label>
                    <Input
                      className="h-11 sm:h-10"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="عنوان التنبيه"
                      data-testid="input-alert-title"
                    />
                  </div>
                  <div>
                    <Label>نوع التنبيه</Label>
                    <Select
                      value={formData.alertType}
                      onValueChange={(value) => setFormData({ ...formData, alertType: value })}
                    >
                      <SelectTrigger className="h-11 sm:h-10" data-testid="select-alert-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {ALERT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <type.icon className={`w-4 h-4 ${type.color}`} />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>الأولوية</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger className="h-11 sm:h-10" data-testid="select-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            <Badge className={p.color}>{p.label}</Badge>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>الرسالة *</Label>
                    <Textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="تفاصيل التنبيه..."
                      rows={3}
                      data-testid="input-message"
                    />
                  </div>
                  <div>
                    <Label>تاريخ الانتهاء (اختياري)</Label>
                    <Input
                      className="h-11 sm:h-10"
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      data-testid="input-expires-at"
                    />
                  </div>
                  <Button
                    onClick={() => createAlertMutation.mutate(formData)}
                    disabled={!formData.title || !formData.message || createAlertMutation.isPending}
                    className="w-full h-11 sm:h-9"
                    data-testid="button-submit-alert"
                  >
                    {createAlertMutation.isPending ? "جاري الإنشاء..." : "إنشاء التنبيه"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Bell className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{alertStats.total}</p>
                  <p className="text-sm text-muted-foreground">إجمالي التنبيهات</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <BellRing className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{alertStats.unread}</p>
                  <p className="text-sm text-muted-foreground">غير مقروءة</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{alertStats.urgent}</p>
                  <p className="text-sm text-muted-foreground">عاجلة</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100">
                  <Clock className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{alertStats.pending}</p>
                  <p className="text-sm text-muted-foreground">بانتظار التأكيد</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-full sm:w-48 h-11 sm:h-10" data-testid="select-filter-priority">
                  <Filter className="w-4 h-4 ml-2" />
                  <SelectValue placeholder="الأولوية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأولويات</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-48 h-11 sm:h-10" data-testid="select-filter-type">
                  <SelectValue placeholder="نوع التنبيه" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  {ALERT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Switch
                  id="unread-filter"
                  checked={showUnreadOnly}
                  onCheckedChange={setShowUnreadOnly}
                />
                <Label htmlFor="unread-filter" className="text-sm cursor-pointer">
                  غير المقروءة فقط
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredAlerts.length > 0 ? (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => {
              const typeInfo = getAlertTypeInfo(alert.alertType);
              const priorityInfo = getPriorityInfo(alert.priority);
              const TypeIcon = typeInfo.icon;
              
              return (
                <Card 
                  key={alert.id} 
                  className={`hover:shadow-md transition-all ${!alert.isRead ? 'border-r-4 border-r-primary bg-primary/5' : ''}`}
                  data-testid={`card-alert-${alert.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${!alert.isRead ? 'bg-primary/10' : 'bg-muted'}`}>
                        <TypeIcon className={`w-5 h-5 ${typeInfo.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h3 className={`font-semibold ${!alert.isRead ? '' : 'text-muted-foreground'}`}>
                              {alert.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={priorityInfo.color}>{priorityInfo.label}</Badge>
                              <Badge variant="outline">{typeInfo.label}</Badge>
                            </div>
                          </div>
                          {alert.isAcknowledged && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 ml-1" />
                              تم التأكيد
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{alert.message}</p>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {new Date(alert.createdAt).toLocaleString('en-GB')}
                            {alert.expiresAt && (
                              <span className="text-amber-600">
                                • ينتهي: {new Date(alert.expiresAt).toLocaleDateString('en-GB')}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {!alert.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsReadMutation.mutate(alert.id)}
                                className="h-8"
                                data-testid={`button-mark-read-${alert.id}`}
                              >
                                <Eye className="w-4 h-4 ml-1" />
                                قراءة
                              </Button>
                            )}
                            {!alert.isAcknowledged && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => acknowledgeMutation.mutate(alert.id)}
                                className="h-8"
                                data-testid={`button-acknowledge-${alert.id}`}
                              >
                                <Check className="w-4 h-4 ml-1" />
                                تأكيد
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <BellOff className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">لا توجد تنبيهات</h3>
              <p className="text-muted-foreground mb-4">
                {filterPriority !== "all" || filterType !== "all" || showUnreadOnly
                  ? "لا توجد نتائج مطابقة للفلاتر المحددة"
                  : "ستظهر هنا التنبيهات والإشعارات الخاصة بالتسويق"}
              </p>
              {filterPriority === "all" && filterType === "all" && !showUnreadOnly && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="w-4 h-4 ml-2" />
                  إنشاء تنبيه جديد
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
